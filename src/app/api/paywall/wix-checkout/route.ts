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
                    physicalDetails: { shippingRequired: false },
                }],
                channelType: 'WEB',
                buyerInfo: { email: memberId },
                shippingInfo: { shippingDestination: { address: { country: 'FI' } } },
            }),
        });

        const checkoutText = await checkoutRes.text();
        if (!checkoutRes.ok) {
            console.error('[wix-checkout] checkout error:', checkoutRes.status, checkoutText);
            return NextResponse.json({ error: `Wix ${checkoutRes.status}: ${checkoutText || 'empty response'}` }, { status: 500 });
        }
        const checkoutData = checkoutText ? JSON.parse(checkoutText) : {};

        const checkoutId = checkoutData.checkout?.id;
        if (!checkoutId) return NextResponse.json({ error: `No checkout ID. Response: ${checkoutText}` }, { status: 500 });

        // Wix checkout URL is on the Wix site domain
        const checkoutUrl = `https://www.qkarin.com/checkout?checkoutId=${checkoutId}&memberId=${encodeURIComponent(memberId)}`;

        return NextResponse.json({ checkoutUrl, checkoutId });
    } catch (err: any) {
        console.error('[wix-checkout] error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
