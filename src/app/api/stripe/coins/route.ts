import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/utils/supabase/server';

// Coin package catalogue - coins → cents (EUR)
// Prices: 5,500=€50 | 12,000=€100 | 30,000=€250 | 70,000=€500 | 150,000=€1,000
const COIN_PACKAGES: Record<number, { amountCents: number; label: string }> = {
    1000:   { amountCents:   1000, label: '1,000 Royal Silver'              },
    5500:   { amountCents:   5000, label: '5,500 Royal Silver'              },
    12000:  { amountCents:  10000, label: '12,000 Royal Silver'             },
    30000:  { amountCents:  25000, label: '30,000 Royal Silver - Treasury Vault' },
    70000:  { amountCents:  50000, label: '70,000 Royal Silver - Best Value'     },
    150000: { amountCents: 100000, label: '150,000 Royal Silver - Emperor'       },
};

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { coins } = await req.json();
        const pkg = COIN_PACKAGES[coins];

        if (!pkg) {
            return NextResponse.json({ error: 'Invalid coin package' }, { status: 400 });
        }

        const origin = req.headers.get('origin') || '';

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: pkg.label,
                            description: `${coins.toLocaleString()} coins deposited to your Royal Exchequer wallet.`,
                        },
                        unit_amount: pkg.amountCents,
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${origin}/profile?exchequer=success&coins=${coins}&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/profile?exchequer=cancelled`,
            customer_email: user.email,
            metadata: {
                type: 'COIN_PURCHASE',
                coinsToAdd: String(coins),
                // Keep legacy keys so existing webhook branch still fires
                wixUserEmail: user.email || '',
                wixUserId: user.id || '',
                email: user.email || '',
                userId: user.id || '',
            },
        });

        return NextResponse.json({ url: session.url });
    } catch (error: any) {
        console.error('[STRIPE COINS] Checkout error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
