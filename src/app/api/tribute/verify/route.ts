import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { sessionId } = await req.json();
        if (!sessionId) return NextResponse.json({ error: 'No session ID' }, { status: 400 });

        // Get the logged-in user
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Check if profile already exists for this user
        const { data: existing } = await supabaseAdmin
            .from('profiles')
            .select('ID, member_id')
            .eq('ID', user.id)
            .maybeSingle();

        // Verify Stripe payment
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        // If profile exists but has a twitter_ placeholder, update with real Stripe email
        if (existing) {
            const stripeEmailFix = session.customer_details?.email?.trim().toLowerCase();
            if (stripeEmailFix && existing.member_id && existing.member_id.startsWith('twitter_')) {
                await supabaseAdmin.from('profiles').update({ member_id: stripeEmailFix }).eq('ID', user.id);
                await supabaseAdmin.from('tasks').update({ member_id: stripeEmailFix }).eq('ID', user.id);
                console.log(`[tribute/verify] Fixed twitter placeholder → ${stripeEmailFix} for ${user.id}`);
            }
            return NextResponse.json({ success: true, alreadyExists: true });
        }
        if (session.payment_status !== 'paid') {
            return NextResponse.json({ error: 'Payment not completed' }, { status: 402 });
        }

        // Determine identifier — prefer real email from auth or Stripe over twitter placeholder
        const stripeEmail = session.customer_details?.email?.trim().toLowerCase();
        const identifier = user.email
            || stripeEmail
            || (user.user_metadata?.provider_id ? `twitter_${user.user_metadata.provider_id}` : null)
            || user.id;

        const displayName = user.user_metadata?.full_name
            || user.user_metadata?.user_name
            || (user.email ? user.email.split('@')[0] : 'Subject');

        // Create profile
        const { error } = await supabaseAdmin
            .from('profiles')
            .insert({
                ID: user.id,
                member_id: identifier,
                name: displayName,
                hierarchy: 'Hall Boy',
                score: 0,
                wallet: 5000,
                parameters: { devotion: 100 }
            });

        if (error) {
            console.error('Profile creation error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Create tasks row so task assignment works immediately
        await supabaseAdmin
            .from('tasks')
            .insert({
                ID: user.id,
                member_id: identifier,
                Name: displayName,
                Status: 'idle',
                Taskdom_History: '[]',
                taskdom_active_task: null,
                taskdom_pending_state: null,
            });

        return NextResponse.json({ success: true, created: true, identifier });
    } catch (err: any) {
        console.error('Verify tribute error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
