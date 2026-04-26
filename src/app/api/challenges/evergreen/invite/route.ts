import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getJoinCost } from '@/lib/evergreen-windows';

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const { challenge_id, member_id } = await request.json();
        if (!challenge_id || !member_id)
            return NextResponse.json({ success: false, error: 'Missing challenge_id or member_id' }, { status: 400 });

        // Fetch challenge
        const { data: challenge } = await supabaseAdmin
            .from('challenges').select('*').eq('id', challenge_id).single();
        if (!challenge) return NextResponse.json({ success: false, error: 'Challenge not found' }, { status: 404 });
        if (!challenge.is_evergreen) return NextResponse.json({ success: false, error: 'Only evergreen challenges can be invited via chat' }, { status: 400 });

        // Count active participants
        const { count } = await supabaseAdmin
            .from('challenge_participants').select('*', { count: 'exact', head: true })
            .eq('challenge_id', challenge_id).eq('status', 'active');

        const joinCost = challenge.evergreen_join_cost || getJoinCost(challenge.duration_days);

        const cardData = {
            challengeId: challenge.id,
            challengeName: challenge.name,
            challengeImage: challenge.image_url || null,
            durationDays: challenge.duration_days,
            tasksPerDay: challenge.tasks_per_day,
            joinCost,
            activeCount: count || 0,
        };

        // Insert invite card into the user's personal chat
        const { error: chatErr } = await supabaseAdmin.from('chats').insert({
            member_id: member_id.toLowerCase(),
            sender_email: 'system',
            sender_name: 'SYSTEM',
            content: `CHALLENGE_INVITE_CARD::${JSON.stringify(cardData)}`,
            type: 'system',
            created_at: new Date().toISOString(),
        });

        if (chatErr) throw chatErr;

        return NextResponse.json({ success: true, invited: member_id });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
