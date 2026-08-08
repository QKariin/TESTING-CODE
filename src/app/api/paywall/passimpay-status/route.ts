import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { findProfile } from '@/lib/lookup';

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
            const profile = await findProfile(memberId, 'ID, name, parameters');
            if (profile) {
                const params = profile.parameters || {};
                const updatedParams = { ...params };
                delete updatedParams.paywall;
                updatedParams.pendingCryptoPay = null;
                updatedParams.purchaseHistory = [
                    ...(params.purchaseHistory || []),
                    {
                        type: 'PAYWALL_TRIBUTE_CRYPTO',
                        amount: params.paywall?.amount || 0,
                        timestamp: new Date().toISOString(),
                        memberId,
                        name: profile.name || memberId,
                        sessionId: orderId,
                    },
                ];
                await supabaseAdmin.from('profiles').update({
                    paywall: false,
                    parameters: updatedParams,
                }).eq('ID', profile.ID);
            }
        }

        return NextResponse.json({ paid, status: data.status });
    } catch (err: any) {
        console.error('[passimpay-status] error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
