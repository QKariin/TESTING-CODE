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

        const body = {
            platformId,
            orderId,
            amount: Number(amount).toFixed(2),
            symbol: 'EUR',
        };

        const bodyStr = JSON.stringify(body);
        const signData = `${platformId};${bodyStr};${apiKey}`;
        const signature = createHmac('sha256', apiKey).update(signData).digest('hex');

        console.log('[passimpay] creating order:', orderId, 'amount:', body.amount);

        const res = await fetch('https://api.passimpay.io/v2/createorder', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-signature': signature,
            },
            body: bodyStr,
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
