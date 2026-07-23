import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const bodyText = await req.text();
        const signature = req.headers.get('x-signature') || '';
        const apiKey = process.env.PASSIMPAY_API_KEY!;

        // Verify webhook signature
        const expected = createHmac('sha256', apiKey).update(bodyText).digest('hex');
        if (signature && signature !== expected) {
            console.warn('[passimpay webhook] invalid signature, got:', signature, 'expected:', expected);
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        const payload = JSON.parse(bodyText);
        console.log('[passimpay webhook]', JSON.stringify(payload));

        const { type, orderId } = payload;

        if (type !== 'deposit' || !orderId) {
            return NextResponse.json({ ok: true });
        }

        // Find profile that has this pending orderId
        const { data: allProfiles } = await supabaseAdmin
            .from('profiles')
            .select('member_id, name, parameters')
            .not('parameters->pendingCryptoPay', 'is', null);

        const profile = (allProfiles || []).find(
            (p: any) => p.parameters?.pendingCryptoPay?.orderId === orderId
        );

        if (!profile) {
            console.warn('[passimpay webhook] no profile found for orderId:', orderId);
            return NextResponse.json({ ok: true });
        }

        const memberId = profile.member_id;
        const params = profile.parameters || {};

        await supabaseAdmin
            .from('profiles')
            .update({
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
            })
            .ilike('member_id', memberId);

        console.log('[passimpay webhook] paywall cleared for:', memberId);
        return NextResponse.json({ ok: true });
    } catch (err: any) {
        console.error('[passimpay webhook] error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
