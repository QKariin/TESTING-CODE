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

        if (existing) return NextResponse.json({ success: true, alreadyExists: true });

        // Verify Stripe payment
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status !== 'paid') {
            return NextResponse.json({ error: 'Payment not completed' }, { status: 402 });
        }

        // Determine identifier
        const identifier = user.email
            || (user.user_metadata?.provider_id ? `twitter_${user.user_metadata.provider_id}` : null)
            || session.customer_details?.email
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
