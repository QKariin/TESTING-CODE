import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { type } = await req.json();

        if (type !== 'entrance_tribute') {
            return NextResponse.json({ error: 'Invalid tribute type' }, { status: 400 });
        }

        // Determine identifier - email for Google/email users, twitter_{id} for Twitter users
        const identifier = user.email
            || (user.user_metadata?.provider_id ? `twitter_${user.user_metadata.provider_id}` : user.id);

        // Display name for the created profile
        const displayName = user.user_metadata?.full_name
            || user.user_metadata?.user_name
            || (user.email ? user.email.split('@')[0] : identifier);

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: 'Platform Access Fee',
                            description: 'One-time fee for full platform access and account initialization.',
                        },
                        unit_amount: 5500, // €55.00
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${req.headers.get('origin') || ''}/tribute/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.headers.get('origin') || ''}/tribute?status=cancelled`,
            metadata: {
                userId: user.id,
                email: identifier,
                name: displayName,
                type: 'ENTRANCE_TRIBUTE'
            },
        });

        return NextResponse.json({ url: session.url });
    } catch (error: any) {
        console.error('Stripe Checkout Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
