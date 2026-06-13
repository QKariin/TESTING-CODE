import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { orderId } = await req.json();
        if (!orderId) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Check order status
        const { data: order } = await supabaseAdmin
            .from('crypto_orders')
            .select('*')
            .eq('id', orderId)
            .maybeSingle();

        if (!order) return NextResponse.json({ status: 'not_found' });
        if (order.status !== 'completed') return NextResponse.json({ status: 'pending' });

        // Payment confirmed — check if profile already exists
        const { data: existing } = await supabaseAdmin
            .from('profiles')
            .select('ID')
            .eq('ID', user.id)
            .maybeSingle();

        if (existing) {
            return NextResponse.json({ status: 'completed', profileCreated: true });
        }

        // Determine identifier
        const identifier = user.email
            || order.user_email
            || (user.user_metadata?.provider_id ? `twitter_${user.user_metadata.provider_id}` : user.id);

        // Extract display name from pay_url field (we stored it as entrance_tribute:Name)
        const storedName = order.pay_url?.startsWith('entrance_tribute:')
            ? order.pay_url.split(':')[1]
            : null;
        const rawName = storedName
            || user.user_metadata?.full_name
            || user.user_metadata?.user_name
            || (user.email ? user.email.split('@')[0] : 'Subject');
        const displayName = rawName.split(' ')[0];

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
            console.error('[TRIBUTE CRYPTO-VERIFY] Profile creation error:', error);
            return NextResponse.json({ status: 'completed', profileCreated: false, error: error.message });
        }

        // Create tasks row
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

        return NextResponse.json({ status: 'completed', profileCreated: true });
    } catch (err: any) {
        console.error('[TRIBUTE CRYPTO-VERIFY] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
