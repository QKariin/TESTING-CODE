import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCaller } from '@/lib/api-auth';
import { rankMeetsRequirement } from '@/lib/hierarchyRules';

export const dynamic = 'force-dynamic';

// POST /api/video-challenges/[id]/join — join or rejoin
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: challengeId } = await params;
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const body = await req.json().catch(() => ({}));
        const useCheckpoint = body.use_checkpoint === true;

        // Fetch challenge
        const { data: challenge } = await supabaseAdmin
            .from('video_challenges').select('*').eq('id', challengeId).single();
        if (!challenge) return NextResponse.json({ success: false, error: 'Challenge not found' }, { status: 404 });
        if (challenge.status !== 'active') {
            return NextResponse.json({ success: false, error: 'Challenge is not active' }, { status: 400 });
        }

        // Fetch profile
        const { data: profile } = await supabaseAdmin
            .from('profiles').select('ID, member_id, name, avatar_url, wallet, hierarchy, checkpoint')
            .ilike('member_id', caller.email).maybeSingle();
        if (!profile) return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });

        // Check tier requirement
        if (challenge.min_tier) {
            const userHierarchy = profile.hierarchy || 'Hall Boy';
            if (!rankMeetsRequirement(userHierarchy, challenge.min_tier)) {
                return NextResponse.json({
                    success: false,
                    error: `Requires ${challenge.min_tier} rank or higher. You are ${userHierarchy}.`,
                }, { status: 403 });
            }
        }

        // Check existing participation
        const { data: existing } = await supabaseAdmin
            .from('video_challenge_participants').select('*')
            .eq('challenge_id', challengeId).eq('member_id', caller.email).maybeSingle();

        // Fetch all tasks for this challenge
        const { data: tasks } = await supabaseAdmin
            .from('video_challenge_tasks').select('*')
            .eq('challenge_id', challengeId).order('position', { ascending: true });

        if (!tasks || tasks.length === 0) {
            return NextResponse.json({ success: false, error: 'Challenge has no tasks' }, { status: 400 });
        }

        const now = new Date();

        if (existing && existing.status === 'active') {
            return NextResponse.json({ success: true, already_joined: true, status: 'active' });
        }

        if (existing && existing.status === 'completed') {
            return NextResponse.json({ success: true, already_joined: true, status: 'completed' });
        }

        if (existing && existing.status === 'kicked') {
            // ── REJOIN ──
            let cost = challenge.rejoin_cost || 0;

            if (useCheckpoint) {
                const checkpointCount = Number(profile.checkpoint || 0);
                if (checkpointCount <= 0) {
                    return NextResponse.json({ success: false, error: 'No Checkpoint items available' }, { status: 400 });
                }
                // Use checkpoint instead of coins
                await supabaseAdmin.from('profiles')
                    .update({ checkpoint: checkpointCount - 1 })
                    .eq('ID', profile.ID);
                cost = 0;
            } else if (cost > 0) {
                if ((profile.wallet || 0) < cost) {
                    return NextResponse.json({
                        success: false,
                        error: `Need ${cost} coins to rejoin. You have ${profile.wallet || 0}.`,
                    }, { status: 400 });
                }
                await supabaseAdmin.from('profiles')
                    .update({ wallet: (profile.wallet || 0) - cost })
                    .eq('ID', profile.ID);
            }

            // Reactivate participant — retry the same task
            const retryTask = existing.current_task || 1;
            await supabaseAdmin.from('video_challenge_participants')
                .update({
                    status: 'active',
                    kicked_at: null,
                    rejoin_count: (existing.rejoin_count || 0) + 1,
                })
                .eq('challenge_id', challengeId)
                .eq('member_id', caller.email);

            // Create new window for the retry task
            const task = tasks.find((t: any) => t.position === retryTask);
            if (!task) return NextResponse.json({ success: false, error: 'Task not found' }, { status: 500 });

            const closesAt = new Date(now.getTime() + challenge.window_minutes * 60 * 1000);

            // Delete old expired/rejected submission for this task position if exists
            await supabaseAdmin.from('video_challenge_submissions')
                .delete()
                .eq('challenge_id', challengeId)
                .eq('member_id', caller.email)
                .eq('task_position', retryTask);

            await supabaseAdmin.from('video_challenge_submissions').insert({
                challenge_id: challengeId,
                member_id: caller.email,
                task_id: task.id,
                task_position: retryTask,
                window_opens_at: now.toISOString(),
                window_closes_at: closesAt.toISOString(),
                status: 'active',
            });

            // For scheduled mode: recreate future windows too
            if (challenge.scheduling_mode === 'scheduled') {
                await createScheduledWindows(challengeId, caller.email, tasks, retryTask + 1, challenge, now);
            }

            return NextResponse.json({
                success: true,
                rejoined: true,
                coins_charged: cost,
                used_checkpoint: useCheckpoint,
                current_task: retryTask,
                task_video: task.video_url,
                window_closes_at: closesAt.toISOString(),
            });
        }

        // ── FIRST JOIN ──
        const joinCost = challenge.join_cost || 0;
        if (joinCost > 0) {
            if ((profile.wallet || 0) < joinCost) {
                return NextResponse.json({
                    success: false,
                    error: `Need ${joinCost} coins to join. You have ${profile.wallet || 0}.`,
                }, { status: 400 });
            }
            await supabaseAdmin.from('profiles')
                .update({ wallet: (profile.wallet || 0) - joinCost })
                .eq('ID', profile.ID);
        }

        // Create participant
        const { error: joinErr } = await supabaseAdmin.from('video_challenge_participants').insert({
            challenge_id: challengeId,
            member_id: caller.email,
            status: 'active',
            current_task: 1,
            joined_at: now.toISOString(),
        });
        if (joinErr) throw joinErr;

        // Create first task window (opens immediately)
        const firstTask = tasks[0];
        const firstCloses = new Date(now.getTime() + challenge.window_minutes * 60 * 1000);

        await supabaseAdmin.from('video_challenge_submissions').insert({
            challenge_id: challengeId,
            member_id: caller.email,
            task_id: firstTask.id,
            task_position: 1,
            window_opens_at: now.toISOString(),
            window_closes_at: firstCloses.toISOString(),
            status: 'active',
        });

        // For scheduled mode: create all future windows
        if (challenge.scheduling_mode === 'scheduled') {
            await createScheduledWindows(challengeId, caller.email, tasks, 2, challenge, now);
        }

        // Post to global feed
        try {
            await supabaseAdmin.from('global_messages').insert({
                sender_email: 'system', sender_name: 'SYSTEM', sender_avatar: null,
                message: `CHALLENGE_JOIN_CARD::${JSON.stringify({
                    name: profile.name || caller.email.split('@')[0],
                    photo: profile.avatar_url || null,
                    challengeName: challenge.name,
                    challengeImage: challenge.image_url || null,
                    isVideo: true,
                })}`,
            });
        } catch (_) {}

        return NextResponse.json({
            success: true,
            joined: true,
            coins_charged: joinCost,
            current_task: 1,
            task_video: firstTask.video_url,
            task_title: firstTask.title,
            window_closes_at: firstCloses.toISOString(),
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// Helper: create scheduled windows for tasks starting from a position
async function createScheduledWindows(
    challengeId: string,
    memberEmail: string,
    tasks: any[],
    fromPosition: number,
    challenge: any,
    baseTime: Date,
) {
    const totalTasks = tasks.length;
    if (fromPosition > totalTasks) return;

    // Interval between tasks: spread evenly over duration
    const intervalMs = (challenge.duration_days * 24 * 60 * 60 * 1000) / totalTasks;

    const rows = [];
    for (let pos = fromPosition; pos <= totalTasks; pos++) {
        const task = tasks.find((t: any) => t.position === pos);
        if (!task) continue;

        const opensAt = new Date(baseTime.getTime() + (pos - 1) * intervalMs);
        const closesAt = new Date(opensAt.getTime() + challenge.window_minutes * 60 * 1000);

        rows.push({
            challenge_id: challengeId,
            member_id: memberEmail,
            task_id: task.id,
            task_position: pos,
            window_opens_at: opensAt.toISOString(),
            window_closes_at: closesAt.toISOString(),
            status: 'active',
        });
    }

    if (rows.length > 0) {
        // Delete any existing future submissions first (for rejoin case)
        await supabaseAdmin.from('video_challenge_submissions')
            .delete()
            .eq('challenge_id', challengeId)
            .eq('member_id', memberEmail)
            .gte('task_position', fromPosition);

        await supabaseAdmin.from('video_challenge_submissions').insert(rows);
    }
}
