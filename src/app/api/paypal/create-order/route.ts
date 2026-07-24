import { NextRequest, NextResponse } from 'next/server';
import { getPayPalToken } from '@/lib/paypal';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

const CANCEL_URLS: Record<string, string> = {
    tribute: '/tribute', keyholder: '/keyholder', coins: '/profile', paywall: '/profile',
};

const DESCRIPTIONS: Record<string, string> = {
    tribute: 'AntiGravity Entrance Tribute',
    keyholder: 'AntiGravity Keyholder Subscription',
    coins: 'AntiGravity Royal Silver Coins',
    paywall: 'AntiGravity Special Tribute',
};

export async function POST(req: NextRequest) {
    try {
        const { type, amount, memberId, tierId, coins } = await req.json();
        if (!type || !amount || !memberId) {
            return NextResponse.json({ error: 'Missing params' }, { status: 400 });
        }

        const clientId = process.env.PAYPAL_CLIENT_ID;
        const secret = process.env.PAYPAL_CLIENT_SECRET;
        if (!clientId || !secret) {
            return NextResponse.json({ error: 'PayPal not configured' }, { status: 500 });
        }

        const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://throne.qkarin.com').replace(/\/$/, '');

        // Get the user session to include userId in the return URL
        let userId = '';
        try {
            const supabase = await createClient();
            const { data: { user } } = await supabase.auth.getUser();
            userId = user?.id || '';
        } catch {}

        // Build return URL with all params needed for capture
        const returnParams = new URLSearchParams({ type, memberId });
        if (userId) returnParams.set('userId', userId);
        if (tierId) returnParams.set('tierId', tierId);
        if (coins) returnParams.set('coins', String(coins));

        const returnUrl = `${baseUrl}/api/paypal/capture?${returnParams.toString()}`;
        const cancelUrl = `${baseUrl}${CANCEL_URLS[type] || '/profile'}`;

        const description = tierId
            ? `AntiGravity Keyholder — ${tierId}`
            : coins
            ? `${Number(coins).toLocaleString()} Royal Silver Coins`
            : DESCRIPTIONS[type] || 'AntiGravity Payment';

        const accessToken = await getPayPalToken();

        const orderRes = await fetch('https://api-m.paypal.com/v2/checkout/orders', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'PayPal-Request-Id': `${type}-${memberId}-${Date.now()}`,
            },
            body: JSON.stringify({
                intent: 'CAPTURE',
                purchase_units: [{
                    amount: { currency_code: 'EUR', value: Number(amount).toFixed(2) },
                    description,
                }],
                application_context: {
                    return_url: returnUrl,
                    cancel_url: cancelUrl,
                    brand_name: 'AntiGravity by Queen Karin',
                    user_action: 'PAY_NOW',
                    shipping_preference: 'NO_SHIPPING',
                },
            }),
        });

        const order = await orderRes.json();
        const approvalUrl = order.links?.find((l: any) => l.rel === 'approve')?.href;

        if (!approvalUrl) {
            console.error('[paypal/create-order] No approval URL:', JSON.stringify(order));
            return NextResponse.json({ error: order.message || 'Could not create PayPal order' }, { status: 500 });
        }

        return NextResponse.json({ approvalUrl });
    } catch (err: any) {
        console.error('[paypal/create-order] error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
