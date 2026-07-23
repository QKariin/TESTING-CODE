import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { checkoutId, memberId } = await req.json();
        if (!checkoutId || !memberId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

        const apiKey = process.env.WIX_API_KEY!;
        const siteId = process.env.WIX_SITE_ID!;

        // Verify checkout status with Wix
        const res = await fetch(`https://www.wixapis.com/ecom/v1/checkouts/${checkoutId}`, {
            headers: {
                'Authorization': apiKey,
                'wix-site-id': siteId,
            },
        });

        const data = await res.json();
        const checkout = data.checkout;

        // Payment confirmed if an order was created
        const paid = !!(checkout?.completedOrder || checkout?.orderId);
        if (!paid) return NextResponse.json({ paid: false, status: checkout?.status });

        // Unlock paywall in Supabase
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('parameters, name')
            .ilike('member_id', memberId)
            .single();

        if (profile) {
            const params = profile.parameters || {};
            const amount = Number(checkout?.priceSummary?.total?.amount || 0);
            await supabaseAdmin
                .from('profiles')
                .update({
                    parameters: {
                        ...params,
                        paywall: { ...(params.paywall || {}), active: false },
                        purchaseHistory: [
                            ...(params.purchaseHistory || []),
                            {
                                type: 'PAYWALL_TRIBUTE',
                                amount,
                                timestamp: new Date().toISOString(),
                                memberId,
                                name: profile.name || memberId,
                                sessionId: checkoutId,
                            },
                        ],
                    },
                })
                .ilike('member_id', memberId);
        }

        return NextResponse.json({ paid: true });
    } catch (err: any) {
        console.error('[wix-verify] error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
