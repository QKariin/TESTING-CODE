import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const { id: challengeId } = await params;

        const { data: challenge } = await supabaseAdmin.from('challenges').select('*').eq('id', challengeId).single();
        if (!challenge) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
        if (challenge.status === 'ended') return NextResponse.json({ success: false, error: 'Already ended' }, { status: 400 });

        const { data: survivors } = await supabaseAdmin.from('challenge_participants')
            .select('*').eq('challenge_id', challengeId).in('status', ['active', 'finished']);

        const { data: completions } = await supabaseAdmin.from('challenge_completions')
            .select('*').eq('challenge_id', challengeId).eq('verified', true);

        // Rank by avg response speed
        const ranked = (survivors || []).map((p: any) => {
            const comps = (completions || []).filter((c: any) => c.member_id === p.member_id);
            const avg = comps.length ? comps.reduce((s: number, c: any) => s + (c.response_time_seconds || 9999), 0) / comps.length : 99999;
            return { ...p, avg_speed: avg };
        }).sort((a: any, b: any) => a.avg_speed - b.avg_speed);

        const { data: badges } = await supabaseAdmin.from('badges').select('*').eq('challenge_id', challengeId);
        const finisherBadge = badges?.find((b: any) => b.type === 'finisher');
        const championBadge = badges?.find((b: any) => b.type === 'champion');
        const pts: Record<number, number> = { 1: challenge.first_place_points || 10, 2: challenge.second_place_points || 7, 3: challenge.third_place_points || 5 };

        for (let i = 0; i < ranked.length; i++) {
            const p = ranked[i];
            const rank = i + 1;
            const earnedPoints = pts[rank] || 0;

            await supabaseAdmin.from('challenge_participants').update({
                status: rank === 1 ? 'champion' : 'finished',
                final_rank: rank,
                challenge_points_earned: earnedPoints,
            }).eq('challenge_id', challengeId).eq('member_id', p.member_id);

            // Add placement points to profile score
            if (earnedPoints > 0) {
                const { data: prof } = await supabaseAdmin.from('profiles').select('score').eq('member_id', p.member_id).single();
                if (prof) await supabaseAdmin.from('profiles').update({ score: (prof.score || 0) + earnedPoints }).eq('member_id', p.member_id);
            }

            // Finisher badge for all
            if (finisherBadge) {
                await supabaseAdmin.from('user_badges').upsert({
                    member_id: p.member_id, badge_id: finisherBadge.id, challenge_id: challengeId,
                    earned_at: new Date().toISOString(), is_active: true,
                }, { onConflict: 'member_id,badge_id,challenge_id' });
            }

            // Champion badge for #1
            if (rank === 1 && championBadge) {
                await supabaseAdmin.from('user_badges').upsert({
                    member_id: p.member_id, badge_id: championBadge.id, challenge_id: challengeId,
                    earned_at: new Date().toISOString(), is_active: true,
                }, { onConflict: 'member_id,badge_id,challenge_id' });
            }
        }

        await supabaseAdmin.from('challenges').update({ status: 'ended' }).eq('id', challengeId);

        return NextResponse.json({ success: true, survivors: ranked.length, champion: ranked[0] || null });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
