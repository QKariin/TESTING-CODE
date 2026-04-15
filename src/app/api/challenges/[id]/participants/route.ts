import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: challengeId } = await params;
        const { email, waive_fee } = await request.json();
        if (!email) return NextResponse.json({ success: false, error: 'Email required' }, { status: 400 });

        const memberEmail = email.toLowerCase();

        const { data: challenge } = await supabaseAdmin
            .from('challenges').select('id, name, status, image_url').eq('id', challengeId).single();
        if (!challenge) return NextResponse.json({ success: false, error: 'Challenge not found' }, { status: 404 });

        // Resolve UUID from profiles
        const { data: profile } = await supabaseAdmin
            .from('profiles').select('ID, name, avatar_url').ilike('member_id', memberEmail).maybeSingle();
        if (!profile) return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
        const memberId = profile.ID;

        // Check if already a participant
        const { data: existing } = await supabaseAdmin
            .from('challenge_participants')
            .select('status').eq('challenge_id', challengeId).eq('member_id', memberId).maybeSingle();

        if (existing?.status === 'active') return NextResponse.json({ success: false, error: 'Already an active participant' }, { status: 400 });

        if (existing) {
            // Re-activate (rejoin after elimination)
            await supabaseAdmin.from('challenge_participants')
                .update({ status: 'active', eliminated_on_window_id: null, eliminated_at: null })
                .eq('challenge_id', challengeId).eq('member_id', memberId);
        } else {
            // New participant
            const { error } = await supabaseAdmin.from('challenge_participants').insert({
                challenge_id: challengeId,
                member_id: memberId,
                status: 'active',
                joined_at: new Date().toISOString(),
            });
            if (error) throw error;
        }

        // Post join card
        try {
            const { count } = await supabaseAdmin.from('challenge_participants')
                .select('*', { count: 'exact', head: true }).eq('challenge_id', challengeId).eq('status', 'active');
            await supabaseAdmin.from('global_messages').insert({
                sender_email: 'system', sender_name: 'SYSTEM', sender_avatar: null,
                message: `CHALLENGE_JOIN_CARD::${JSON.stringify({
                    name: profile?.name || memberEmail.split('@')[0],
                    photo: profile?.avatar_url || null,
                    challengeName: challenge.name,
                    challengeImage: (challenge as any).image_url || null,
                    activeCount: count || 1,
                })}`,
            });
        } catch (_) {}

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
