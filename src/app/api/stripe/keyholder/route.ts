import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

const TIERS: Record<string, { amountCents: number; name: string; label: string; days: number }> = {
    trial:   { amountCents:  2900, name: 'Chastity Trial — 3 Days',  label: '3-day keyholder access',   days: 3  },
    weekly:  { amountCents:  5500, name: 'Chastity Week — 7 Days',   label: '7-day keyholder access',   days: 7  },
    monthly: { amountCents: 15000, name: 'Chastity Month — 30 Days', label: '30-day keyholder access',  days: 30 },
};

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { tierId } = await req.json();
        const tier = TIERS[tierId];

        if (!tier) {
            return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
        }

        const identifier = user.email
            || (user.user_metadata?.provider_id ? `twitter_${user.user_metadata.provider_id}` : user.id);

        const rawName = user.user_metadata?.full_name
            || user.user_metadata?.user_name
            || (user.email ? user.email.split('@')[0] : identifier);
        const displayName = rawName.split(' ')[0];

        // Mark profile as chastity source immediately
        try {
            await supabaseAdmin
                .from('profiles')
                .update({
                    parameters: supabaseAdmin.rpc ? undefined : undefined, // handled below
                })
                .ilike('member_id', identifier);

            // Use raw update to merge into parameters JSONB
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('ID, parameters')
                .ilike('member_id', identifier)
                .maybeSingle();

            if (profile) {
                const params = profile.parameters || {};
                await supabaseAdmin
                    .from('profiles')
                    .update({
                        parameters: { ...params, source: 'chastity', chastity_tier: tierId },
                    })
                    .eq('ID', profile.ID);
            }
        } catch (e) {
            console.warn('[keyholder] Could not mark profile:', e);
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
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${origin}/profile`,
            cancel_url: `${origin}/keyholder?status=cancelled`,
            metadata: {
                userId: user.id,
                email: identifier,
                name: displayName,
                type: 'CHASTITY_KEYHOLDER',
                tierId,
                days: String(tier.days),
            },
        });

        return NextResponse.json({ url: session.url });
    } catch (error: any) {
        console.error('[Stripe Keyholder] Checkout error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
