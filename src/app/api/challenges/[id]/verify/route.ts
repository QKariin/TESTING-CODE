import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DbService } from '@/lib/supabase-service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const { completionId, verified, note = '' } = await request.json();
        if (!completionId || verified === undefined)
            return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });

        const { data: completion } = await supabaseAdmin
            .from('challenge_completions')
            .select('*, challenge_windows!challenge_completions_window_id_fkey(id, closes_at, opens_at)')
            .eq('id', completionId).single();

        if (!completion) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

        const window = completion.challenge_windows;
        const windowStillOpen = window && new Date(window.closes_at) > new Date();

        if (verified) {
            await supabaseAdmin.from('challenge_completions').update({
                verified: true, verified_at: new Date().toISOString(), verification_note: note || null,
            }).eq('id', completionId);

            // Per-window placement: count already-verified completions for this window ranked faster
            const { data: otherVerified } = await supabaseAdmin
                .from('challenge_completions')
                .select('response_time_seconds')
                .eq('window_id', completion.window_id)
                .eq('verified', true)
                .neq('id', completionId);

            const thisTime = completion.response_time_seconds ?? 999999;
            const fasterCount = (otherVerified || []).filter(
                (c: any) => (c.response_time_seconds ?? 999999) < thisTime
            ).length;

            // 20 flat + 10/7/5 bonus for 1st/2nd/3rd
            const { data: challenge } = await supabaseAdmin.from('challenges')
                .select('points_per_completion, first_place_points, second_place_points, third_place_points')
                .eq('id', id).single();

            const flat = challenge?.points_per_completion ?? 20;
            const bonusMap: Record<number, number> = {
                0: challenge?.first_place_points ?? 10,
                1: challenge?.second_place_points ?? 7,
                2: challenge?.third_place_points ?? 5,
            };
            const bonus = bonusMap[fasterCount] ?? 0;
            const totalPoints = flat + bonus;

            if (totalPoints > 0) {
                const { data: profile } = await supabaseAdmin.from('profiles')
                    .select('score').eq('member_id', completion.member_id).single();
                if (profile) {
                    await supabaseAdmin.from('profiles')
                        .update({ score: (profile.score || 0) + totalPoints })
                        .eq('member_id', completion.member_id);
                }
            }

            // Fetch profile for notification cards
            const { data: prof } = await supabaseAdmin
                .from('profiles').select('name, avatar_url').ilike('member_id', completion.member_id).maybeSingle();

            // Count total verified completions for this participant in this challenge
            const { data: allVerified } = await supabaseAdmin
                .from('challenge_completions')
                .select('id')
                .eq('challenge_id', id)
                .ilike('member_id', completion.member_id)
                .eq('verified', true);

            const taskNum = (allVerified?.length || 0); // includes the one just verified
            const { data: ch } = await supabaseAdmin.from('challenges').select('duration_days, tasks_per_day').eq('id', id).single();
            const totalTasks = (ch?.duration_days || 0) * (ch?.tasks_per_day || 0);

            const cardPayload = {
                senderName: (prof as any)?.name || completion.member_id.split('@')[0],
                senderAvatar: (prof as any)?.avatar_url || null,
                taskNum: `${taskNum}/${totalTasks}`,
                passed: true,
                points: totalPoints,
                dayNumber: window?.day_number,
                windowNumber: window?.window_number,
            };

            // Personal chat
            try {
                const personalMsg = `CHALLENGE_TASK_CARD::${JSON.stringify({ ...cardPayload, personal: true })}`;
                await DbService.sendMessage(completion.member_id, personalMsg, 'system');
            } catch (_) {}

            // Global chat — only if participant is still active
            const { data: partCheck } = await supabaseAdmin
                .from('challenge_participants').select('status')
                .eq('challenge_id', id).ilike('member_id', completion.member_id).maybeSingle();
            if (partCheck?.status === 'active') {
                try {
                    await supabaseAdmin.from('global_messages').insert({
                        sender_email: 'system', sender_name: 'SYSTEM', sender_avatar: null,
                        message: `CHALLENGE_TASK_CARD::${JSON.stringify(cardPayload)}`,
                    });
                } catch (_) {}
            }

            return NextResponse.json({ success: true, action: 'verified', points_awarded: totalPoints, placement: fasterCount + 1 });
        } else {
            if (windowStillOpen) {
                // Window still open - delete so they can resubmit
                await supabaseAdmin.from('challenge_completions').delete().eq('id', completionId);
                return NextResponse.json({ success: true, action: 'rejected_can_resubmit' });
            } else {
                // Window closed - eliminate
                await supabaseAdmin.from('challenge_completions').update({
                    verified: false, verification_note: note || 'Rejected',
                }).eq('id', completionId);

                await supabaseAdmin.from('challenge_participants').update({
                    status: 'eliminated',
                    eliminated_on_window_id: window?.id,
                    eliminated_at: new Date().toISOString(),
                }).eq('challenge_id', id).eq('member_id', completion.member_id).eq('status', 'active');

                // Fetch profile for reject cards
                const { data: profR } = await supabaseAdmin
                    .from('profiles').select('name, avatar_url').ilike('member_id', completion.member_id).maybeSingle();

                const rejectPayload = {
                    senderName: (profR as any)?.name || completion.member_id.split('@')[0],
                    senderAvatar: (profR as any)?.avatar_url || null,
                    passed: false,
                    dayNumber: window?.day_number,
                    windowNumber: window?.window_number,
                };

                try {
                    await DbService.sendMessage(completion.member_id, `CHALLENGE_TASK_CARD::${JSON.stringify({ ...rejectPayload, personal: true })}`, 'system');
                } catch (_) {}
                try {
                    await supabaseAdmin.from('global_messages').insert({
                        sender_email: 'system', sender_name: 'SYSTEM', sender_avatar: null,
                        message: `CHALLENGE_TASK_CARD::${JSON.stringify(rejectPayload)}`,
                    });
                } catch (_) {}

                return NextResponse.json({ success: true, action: 'rejected_eliminated' });
            }
        }
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
