import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { memberId, amount } = await req.json();
        if (!memberId || !amount) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

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
                checkout: {
                    lineItems: [{
                        quantity: 1,
                        price: Number(amount).toFixed(2),
                        productName: { original: 'Paywall Tribute' },
                        itemType: { custom: 'DEFAULT' },
                        physicalDetails: { shippingRequired: false },
                    }],
                    channelType: 'WEB',
                    buyerInfo: { email: memberId },
                    customFields: [{ title: 'memberId', value: memberId }],
                },
            }),
        });

        const checkoutData = await checkoutRes.json();
        if (!checkoutRes.ok) {
            console.error('[wix-checkout] checkout error:', checkoutData);
            return NextResponse.json({ error: checkoutData }, { status: 500 });
        }

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
