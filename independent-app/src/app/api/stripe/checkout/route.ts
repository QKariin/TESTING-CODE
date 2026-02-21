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

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'Entrance Tribute',
                            description: 'One-time tribute for system access and Hall Boy initialization.',
                        },
                        unit_amount: 5500, // $55.00
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${req.headers.get('origin') || ''}/tribute/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.headers.get('origin') || ''}/tribute?status=cancelled`,
            metadata: {
                userId: user.id,
                email: user.email || '',
                type: 'ENTRANCE_TRIBUTE'
            },
        });

        return NextResponse.json({ url: session.url });
    } catch (error: any) {
        console.error('Stripe Checkout Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
