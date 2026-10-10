import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/utils/supabase/server';

// Subscription tiers — must match the IDs used in the pricing UI
// initiate  €18.99/mo — photo proof, weekly review, kneeling + leaderboard, no chat
// devotee   €55/mo    — video proof, 48h review, Queen's comments, chat, routine, challenges
// property  €99/mo    — video tasks, open chat, personalized stories, everything
const SUBSCRIPTION_TIERS: Record<string, { amountCents: number; name: string; label: string }> = {
    initiate: { amountCents:  1899, name: 'INITIATE',  label: 'Initiate — Monthly Subscription'  },
    devotee:  { amountCents:  5500, name: 'DEVOTEE',   label: 'Devoted One — Monthly Subscription' },
    property: { amountCents:  9900, name: 'PROPERTY',  label: 'Her Property — Monthly Subscription' },
};

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { tierId } = await req.json();
        const tier = SUBSCRIPTION_TIERS[tierId];

        if (!tier) {
            return NextResponse.json({ error: 'Invalid subscription tier' }, { status: 400 });
        }

        const origin = req.headers.get('origin') || '';

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: tier.name,
                            description: tier.label,
                        },
                        unit_amount: tier.amountCents,
                        recurring: { interval: 'month' },
                    },
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${origin}/profile?subscription=success&tier=${tierId}`,
            cancel_url: `${origin}/profile?subscription=cancelled`,
            customer_email: user.email,
            metadata: {
                type: 'SUBSCRIPTION',
                tierId,
                email: user.email || '',
                userId: user.id || '',
            },
        });

        return NextResponse.json({ url: session.url });
    } catch (error: any) {
        console.error('[STRIPE SUBSCRIBE] Checkout error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
