import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const bodyText = await req.text();
        console.log('[wix-checkout] body:', bodyText);
        const { memberId, amount } = bodyText ? JSON.parse(bodyText) : {};
        if (!memberId || !amount) return NextResponse.json({ error: `Missing params — got: ${bodyText}` }, { status: 400 });

        const apiKey = process.env.WIX_API_KEY!;
        const siteId = process.env.WIX_SITE_ID!;

        // Step 1: Create checkout with custom line item (dynamic price, no product needed)
        const checkoutRes = await fetch('https://www.wixapis.com/ecom/v1/checkouts', {
            method: 'POST',
            headers: {
                'Authorization': apiKey,
                'wix-site-id': siteId,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                customLineItems: [{
                    quantity: 1,
                    price: Number(amount).toFixed(2),
                    productName: { original: 'Membership Access' },
                    itemType: { preset: 'DIGITAL' },
                }],
                channelType: 'WEB',
                buyerInfo: { email: memberId },
            }),
        });

        const checkoutText = await checkoutRes.text();
        if (!checkoutRes.ok) {
            console.error('[wix-checkout] checkout error:', checkoutRes.status, checkoutText);
            return NextResponse.json({ error: `Wix ${checkoutRes.status}: ${checkoutText || 'empty response'}` }, { status: 500 });
        }
        const checkoutData = checkoutText ? JSON.parse(checkoutText) : {};

        const checkoutId = checkoutData.checkout?.id;
        if (!checkoutId) return NextResponse.json({ error: 'No checkout ID returned' }, { status: 500 });

        // Step 2: Create redirect session → get Wix-hosted checkout URL
        const redirectRes = await fetch('https://www.wixapis.com/ecom/v1/redirect-sessions', {
            method: 'POST',
            headers: {
                'Authorization': apiKey,
                'wix-site-id': siteId,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                checkoutId,
                callbacks: {
                    postFlowUrl: 'https://throne.qkarin.com/profile',
                    thankYouPageUrl: `https://throne.qkarin.com/profile?wix_paid=1&cid=${checkoutId}&mid=${encodeURIComponent(memberId)}`,
                },
            }),
        });

        const redirectData = await redirectRes.json();
        if (!redirectRes.ok) {
            console.error('[wix-checkout] redirect session error:', redirectData);
            return NextResponse.json({ error: redirectData }, { status: 500 });
        }

        const checkoutUrl = redirectData.redirectSession?.fullUrl;
        if (!checkoutUrl) return NextResponse.json({ error: 'No redirect URL' }, { status: 500 });

        return NextResponse.json({ checkoutUrl, checkoutId });
    } catch (err: any) {
        console.error('[wix-checkout] error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
