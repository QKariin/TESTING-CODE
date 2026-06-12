import { supabaseAdmin } from '@/lib/supabase';
import { DbService } from '@/lib/supabase-service';

const AUTO_VERIFY_HOURS = 12;

/**
 * Auto-verify challenge completions older than 12 hours.
 * Runs the same flow as manual verify: points, placement, notifications.
 * Call from GET routes on page load.
 */
export async function autoVerifyOldCompletions(challengeId: string) {
    const cutoff = new Date(Date.now() - AUTO_VERIFY_HOURS * 60 * 60 * 1000).toISOString();

    // Find unverified completions with proof that are older than 12h
    const { data: old } = await supabaseAdmin
        .from('challenge_completions')
        .select('id, member_id, window_id, response_time_seconds, completed_at')
        .eq('challenge_id', challengeId)
        .eq('verified', false)
        .not('proof_url', 'is', null)
        .lt('completed_at', cutoff);

    if (!old || old.length === 0) return 0;

    const { data: challenge } = await supabaseAdmin
        .from('challenges')
        .select('points_per_completion, first_place_points, second_place_points, third_place_points, name, duration_days, tasks_per_day')
        .eq('id', challengeId)
        .single();

    if (!challenge) return 0;

    let verified = 0;

    for (const comp of old) {
        try {
            // Mark as verified
            await supabaseAdmin.from('challenge_completions').update({
                verified: true,
                verified_at: new Date().toISOString(),
                verification_note: 'Auto-verified (12h)',
            }).eq('id', comp.id);

            // Calculate placement
            const { data: otherVerified } = await supabaseAdmin
                .from('challenge_completions')
                .select('response_time_seconds')
                .eq('window_id', comp.window_id)
                .eq('verified', true)
                .neq('id', comp.id);

            const thisTime = comp.response_time_seconds ?? 999999;
            const fasterCount = (otherVerified || []).filter(
                (c: any) => (c.response_time_seconds ?? 999999) < thisTime
            ).length;

            // Award points
            const flat = challenge.points_per_completion ?? 20;
            const bonusMap: Record<number, number> = {
                0: challenge.first_place_points ?? 10,
                1: challenge.second_place_points ?? 7,
                2: challenge.third_place_points ?? 5,
            };
            const bonus = bonusMap[fasterCount] ?? 0;
            const totalPoints = flat + bonus;

            if (totalPoints > 0) {
                const { data: profile } = await supabaseAdmin
                    .from('profiles')
                    .select('score, taskdom_completed_tasks')
                    .eq('member_id', comp.member_id)
                    .single();
                if (profile) {
                    await supabaseAdmin.from('profiles').update({
                        score: (profile.score || 0) + totalPoints,
                        taskdom_completed_tasks: ((profile as any).taskdom_completed_tasks || 0) + 1,
                    }).eq('member_id', comp.member_id);
                }
            }

            // Get window info for notification
            const { data: win } = await supabaseAdmin
                .from('challenge_windows')
                .select('day_number, window_number')
                .eq('id', comp.window_id)
                .single();

            // Get profile info for notification
            const { data: prof } = await supabaseAdmin
                .from('profiles')
                .select('name, avatar_url')
                .ilike('member_id', comp.member_id)
                .maybeSingle();

            // Count total verified for this participant
            const { data: allVerified } = await supabaseAdmin
                .from('challenge_completions')
                .select('id')
                .eq('challenge_id', challengeId)
                .ilike('member_id', comp.member_id)
                .eq('verified', true);

            const taskNum = allVerified?.length || 0;
            const totalTasks = (challenge.duration_days || 0) * (challenge.tasks_per_day || 0);

            const cardPayload = {
                senderName: (prof as any)?.name || comp.member_id.split('@')[0],
                senderAvatar: (prof as any)?.avatar_url || null,
                taskNum: `${taskNum}/${totalTasks}`,
                passed: true,
                points: totalPoints,
                dayNumber: win?.day_number,
                windowNumber: win?.window_number,
            };

            // Personal chat notification
            try {
                const personalMsg = `CHALLENGE_TASK_CARD::${JSON.stringify({ ...cardPayload, personal: true })}`;
                await DbService.sendMessage(comp.member_id, personalMsg, 'system');
            } catch (_) {}

            // Global feed notification (only if still active)
            const { data: partCheck } = await supabaseAdmin
                .from('challenge_participants')
                .select('status')
                .eq('challenge_id', challengeId)
                .ilike('member_id', comp.member_id)
                .maybeSingle();

            if (partCheck?.status === 'active') {
                try {
                    await supabaseAdmin.from('global_messages').insert({
                        sender_email: 'system', sender_name: 'SYSTEM', sender_avatar: null,
                        message: `CHALLENGE_TASK_CARD::${JSON.stringify(cardPayload)}`,
                    });
                } catch (_) {}
            }

            verified++;
        } catch (_) {
            // Skip this one, continue with others
        }
    }

    return verified;
}
