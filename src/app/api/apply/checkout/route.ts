import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function POST(req: Request) {
    try {
        const { applicationId, email, name, amount } = await req.json();
        if (!email || !applicationId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const unitAmount = Math.max(9500, Math.round((amount || 95) * 100)); // min €95

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            customer_email: email,
            line_items: [{
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: 'Ownership Application Fee',
                        description: 'Application for ownership consideration by Queen Karin.',
                    },
                    unit_amount: unitAmount,
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${req.headers.get('origin') || ''}/apply/success?session_id={CHECKOUT_SESSION_ID}&aid=${applicationId}`,
            cancel_url: `${req.headers.get('origin') || ''}/apply?cancelled=1`,
            metadata: {
                type: 'APPLICATION_FEE',
                applicationId,
                email,
                name: name || '',
            },
        });

        return NextResponse.json({ url: session.url });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
