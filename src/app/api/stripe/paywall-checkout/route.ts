import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient as createAdmin } from '@supabase/supabase-js';

export async function POST(req: Request) {
    try {
        const { memberId } = await req.json();
        if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 });

        const admin = createAdmin(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: profile } = await admin
            .from('profiles')
            .select('parameters, name')
            .ilike('member_id', memberId)
            .maybeSingle();

        const paywall = profile?.parameters?.paywall;
        if (!paywall?.active) {
            return NextResponse.json({ error: 'No active paywall' }, { status: 400 });
        }

        const amountCents = Math.round(Number(paywall.amount) * 100);
        if (amountCents < 50) return NextResponse.json({ error: 'Amount too low' }, { status: 400 });

        const intent = await stripe.paymentIntents.create({
            amount: amountCents,
            currency: 'eur',
            metadata: {
                type: 'PAYWALL_TRIBUTE',
                memberId,
                reason: paywall.reason,
            },
        });

        return NextResponse.json({ clientSecret: intent.client_secret, intentId: intent.id });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
