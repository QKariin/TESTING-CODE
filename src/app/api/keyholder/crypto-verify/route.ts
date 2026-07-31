import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { discordNewMember } from '@/lib/discord';

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

        // Payment confirmed — parse keyholder metadata from pay_url
        // Format: keyholder:tierId:days:displayName
        const parts = (order.pay_url || '').split(':');
        const tierId = parts[1] || 'weekly';
        const displayName = parts[3] || 'Subject';

        const identifier = user.email
            || order.user_email
            || (user.user_metadata?.provider_id ? `twitter_${user.user_metadata.provider_id}` : user.id);

        // Check if profile exists
        const { data: existing } = await supabaseAdmin
            .from('profiles')
            .select('ID, parameters')
            .or(`ID.eq.${user.id}${identifier ? `,member_id.ilike.${identifier}` : ''}`)
            .maybeSingle();

        if (existing) {
            // Update existing profile with keyholder reference
            const params = existing.parameters || {};
            params.keyholder_tier = tierId;
            params.keyholder_order = orderId;
            await supabaseAdmin
                .from('profiles')
                .update({ parameters: params })
                .eq('ID', existing.ID);
        } else {
            // Create new profile
            await supabaseAdmin
                .from('profiles')
                .insert({
                    ID: user.id,
                    member_id: identifier,
                    name: displayName,
                    hierarchy: 'Hall Boy',
                    score: 0,
                    wallet: 0,
                    parameters: {
                        keyholder_tier: tierId,
                        keyholder_order: orderId,
                    }
                });

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
        }

        // Discord notification
        discordNewMember(`${displayName} (Keyholder ${tierId} via crypto)`).catch(() => {});

        // Push notification to Queen
        try {
            const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://throne.qkarin.com';
            await fetch(`${baseUrl}/api/push`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    externalId: 'ceo@qkarin.com',
                    title: 'New Keyholder Sub (Crypto)',
                    message: `${displayName} joined as keyholder — ${tierId} paid with crypto`,
                }),
            });
        } catch {}

        return NextResponse.json({ status: 'completed', activated: true });
    } catch (err: any) {
        console.error('[KEYHOLDER CRYPTO-VERIFY] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
