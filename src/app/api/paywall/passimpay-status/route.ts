import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { orderId, memberId } = await req.json();
        if (!orderId || !memberId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

        const apiKey = (process.env.PASSIMPAY_API_KEY || '').trim();
        const platformId = (process.env.PASSIMPAY_PLATFORM_ID || '').trim();
        if (!apiKey || !platformId) return NextResponse.json({ error: 'Missing env vars' }, { status: 500 });

        // Check order status — platform_id first (PHP SDK: not in params, so prepended)
        const params = { platform_id: platformId, order_id: orderId };
        const qs = new URLSearchParams(params).toString();
        const hash = createHmac('sha256', apiKey).update(qs).digest('hex');

        const res = await fetch('https://api.passimpay.io/orderstatus', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ ...params, hash }).toString(),
        });
        const data = await res.json();
        console.log('[passimpay-status]', orderId, data);

        const paid = data.result === 1 && data.status === 'paid';

        if (paid) {
            const { data: profile } = await supabaseAdmin
                .from('profiles').select('name, parameters').ilike('member_id', memberId).single();
            if (profile) {
                const params = profile.parameters || {};
                await supabaseAdmin.from('profiles').update({
                    parameters: {
                        ...params,
                        paywall: { ...(params.paywall || {}), active: false },
                        pendingCryptoPay: null,
                        purchaseHistory: [
                            ...(params.purchaseHistory || []),
                            {
                                type: 'PAYWALL_TRIBUTE_CRYPTO',
                                amount: params.paywall?.amount || 0,
                                timestamp: new Date().toISOString(),
                                memberId,
                                name: profile.name || memberId,
                                sessionId: orderId,
                            },
                        ],
                    },
                }).ilike('member_id', memberId);
            }
        }

        return NextResponse.json({ paid, status: data.status });
    } catch (err: any) {
        console.error('[passimpay-status] error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
