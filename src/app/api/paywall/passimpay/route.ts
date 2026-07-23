import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { memberId, amount } = await req.json();
        if (!memberId || !amount) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

        const apiKey = process.env.PASSIMPAY_API_KEY!;
        const platformId = Number(process.env.PASSIMPAY_PLATFORM_ID!);
        const orderId = `pw${Date.now()}${memberId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}`.slice(0, 64);

        // v1 API: form-encoded with hash param (matches official PHP SDK)
        const params: Record<string, string> = {
            platform_id: String(platformId),
            order_id: orderId,
            amount: Number(amount).toFixed(2),
        };
        const queryStr = new URLSearchParams(params).toString();
        const hash = createHmac('sha256', apiKey).update(queryStr).digest('hex');
        const formBody = new URLSearchParams({ ...params, hash }).toString();

        console.log('[passimpay] creating order:', orderId, 'amount:', params.amount, 'hash:', hash);

        const res = await fetch('https://api.passimpay.io/createorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formBody,
        });

        const resText = await res.text();
        const data = resText ? JSON.parse(resText) : {};
        console.log('[passimpay] response:', res.status, resText);

        if (data.result !== 1 || !data.url) {
            return NextResponse.json({ error: data.message || `HTTP ${res.status}: ${resText}` }, { status: 500 });
        }

        // Store orderId in profile so webhook can find this member
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('parameters')
            .ilike('member_id', memberId)
            .single();

        if (profile) {
            await supabaseAdmin
                .from('profiles')
                .update({
                    parameters: {
                        ...(profile.parameters || {}),
                        pendingCryptoPay: { orderId, created: new Date().toISOString() },
                    },
                })
                .ilike('member_id', memberId);
        }

        return NextResponse.json({ url: data.url, orderId });
    } catch (err: any) {
        console.error('[passimpay] error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
