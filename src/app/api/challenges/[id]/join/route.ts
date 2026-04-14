import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: challengeId } = await params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const memberEmail = (user.email || '').toLowerCase();

        // Resolve UUID from profiles
        const { data: profile } = await supabaseAdmin
            .from('profiles').select('id, name, avatar_url, wallet').eq('id', user.id).maybeSingle();
        if (!profile) return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
        const memberId = profile.id;

        // Challenge must exist and be active
        const { data: challenge } = await supabaseAdmin
            .from('challenges').select('id, name, status, start_date, image_url').eq('id', challengeId).single();

        if (!challenge) return NextResponse.json({ success: false, error: 'Challenge not found' }, { status: 404 });
        const isActive = challenge.status === 'active';
        const isUpcoming = challenge.status === 'draft' &&
            challenge.start_date &&
            new Date(challenge.start_date).getTime() > Date.now();
        if (!isActive && !isUpcoming)
            return NextResponse.json({ success: false, error: 'Challenge is not open for joining' }, { status: 400 });

        // Already a participant?
        const { data: existing } = await supabaseAdmin
            .from('challenge_participants')
            .select('status')
            .eq('challenge_id', challengeId)
            .eq('member_id', memberId)
            .maybeSingle();

        if (existing) return NextResponse.json({ success: true, already_joined: true, status: existing.status });

        // Late join fee - charge 1000 coins if challenge is already running and has closed windows
        let lateJoinFee = 0;
        if (isActive) {
            const { count } = await supabaseAdmin
                .from('challenge_windows')
                .select('*', { count: 'exact', head: true })
                .eq('challenge_id', challengeId)
                .lt('closes_at', new Date().toISOString());
            if ((count ?? 0) > 0) {
                lateJoinFee = 1000;
                const currentWallet = profile.wallet ?? 0;
                if (currentWallet < lateJoinFee) {
                    return NextResponse.json({ success: false, error: `Late join fee is ${lateJoinFee} coins. You need more coins to join.` }, { status: 400 });
                }
                await supabaseAdmin.from('profiles')
                    .update({ wallet: currentWallet - lateJoinFee })
                    .eq('id', memberId);
            }
        }

        // Join
        const { error } = await supabaseAdmin.from('challenge_participants').insert({
            challenge_id: challengeId,
            member_id: memberId,
            status: 'active',
            joined_at: new Date().toISOString(),
        });
        if (error) throw error;

        // Post join card to global talk feed
        try {
            const { count: activeCount } = await supabaseAdmin
                .from('challenge_participants').select('*', { count: 'exact', head: true })
                .eq('challenge_id', challengeId).eq('status', 'active');
            await supabaseAdmin.from('global_messages').insert({
                sender_email: 'system', sender_name: 'SYSTEM', sender_avatar: null,
                message: `CHALLENGE_JOIN_CARD::${JSON.stringify({
                    name: profile.name || memberEmail.split('@')[0],
                    photo: profile.avatar_url || null,
                    challengeName: challenge.name,
                    challengeImage: (challenge as any).image_url || null,
                    activeCount: (activeCount || 0) + 1,
                })}`,
            });
        } catch (_) {}

        // Award participant badge if one exists
        const { data: badge } = await supabaseAdmin.from('badges')
            .select('id').eq('challenge_id', challengeId).eq('type', 'participant').maybeSingle();
        if (badge) {
            await supabaseAdmin.from('user_badges').upsert({
                member_id: memberId,
                badge_id: badge.id,
                challenge_id: challengeId,
                earned_at: new Date().toISOString(),
                is_active: true,
            }, { onConflict: 'member_id,badge_id,challenge_id' });
        }

        return NextResponse.json({ success: true, already_joined: false, late_join_fee: lateJoinFee });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
