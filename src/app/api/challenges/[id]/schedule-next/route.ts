import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/challenges/[id]/schedule-next
 *
 * After uploading proof for an on-demand challenge, the user picks when
 * their next task arrives. This endpoint creates the next window.
 *
 * Body: { delay_minutes: 0 | 60 | 180 | 720 }
 */

const ALLOWED_DELAYS = [0, 60, 180, 720];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: challengeId } = await params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabaseAdmin
            .from('profiles').select('member_id').eq('ID', user.id).maybeSingle();
        if (!profile) return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
        const memberId = profile.member_id;

        const body = await req.json().catch(() => ({}));
        const delayMinutes = ALLOWED_DELAYS.includes(body.delay_minutes) ? body.delay_minutes : 60;

        // Fetch challenge
        const { data: challenge } = await supabaseAdmin
            .from('challenges').select('*').eq('id', challengeId).single();
        if (!challenge) return NextResponse.json({ success: false, error: 'Challenge not found' }, { status: 404 });
        if (challenge.scheduling_mode !== 'on_demand') {
            return NextResponse.json({ success: false, error: 'Not an on-demand challenge' }, { status: 400 });
        }

        // Fetch participant
        const { data: participant } = await supabaseAdmin
            .from('challenge_participants')
            .select('status')
            .eq('challenge_id', challengeId).eq('member_id', memberId).maybeSingle();
        if (!participant || participant.status !== 'active') {
            return NextResponse.json({ success: false, error: 'Not an active participant' }, { status: 400 });
        }

        // Count existing windows + completions for this participant
        const { data: windows } = await supabaseAdmin
            .from('challenge_windows')
            .select('id, day_number, window_number')
            .eq('challenge_id', challengeId).eq('member_id', memberId)
            .order('day_number', { ascending: false })
            .order('window_number', { ascending: false });

        const { count: completionCount } = await supabaseAdmin
            .from('challenge_completions')
            .select('*', { count: 'exact', head: true })
            .eq('challenge_id', challengeId).eq('member_id', memberId);

        const totalTasks = challenge.duration_days; // for on_demand, duration_days = total tasks
        const tasksDone = completionCount || 0;

        if (tasksDone >= totalTasks) {
            return NextResponse.json({ success: false, error: 'All tasks completed' }, { status: 400 });
        }

        // Check there's no pending (unsubmitted, open or future) window already
        const now = new Date();
        const { data: pendingWindows } = await supabaseAdmin
            .from('challenge_windows')
            .select('id, opens_at, closes_at')
            .eq('challenge_id', challengeId).eq('member_id', memberId)
            .gte('closes_at', now.toISOString());

        // Filter to windows without completions
        const pendingIds = (pendingWindows || []).map((w: any) => w.id);
        if (pendingIds.length > 0) {
            const { data: completedPending } = await supabaseAdmin
                .from('challenge_completions')
                .select('window_id')
                .eq('challenge_id', challengeId).eq('member_id', memberId)
                .in('window_id', pendingIds);
            const completedSet = new Set((completedPending || []).map((c: any) => c.window_id));
            const unsubmitted = pendingIds.filter((id: string) => !completedSet.has(id));
            if (unsubmitted.length > 0) {
                return NextResponse.json({ success: false, error: 'You already have a pending task' }, { status: 400 });
            }
        }

        // Calculate next task number
        const lastWindow = (windows || [])[0];
        const nextTaskNumber = lastWindow ? lastWindow.day_number + 1 : 1;

        // Resolve task name
        const taskNames = challenge.task_names || [];
        const taskName = taskNames[nextTaskNumber - 1] || challenge.daily_task || null;

        // Create next window
        const opensAt = new Date(now.getTime() + delayMinutes * 60 * 1000);
        const closesAt = new Date(opensAt.getTime() + (challenge.window_minutes || 60) * 60 * 1000);
        const verificationCode = Math.floor(10000 + Math.random() * 90000);

        const { data: newWindow, error: wErr } = await supabaseAdmin
            .from('challenge_windows')
            .insert({
                challenge_id: challengeId,
                member_id: memberId,
                day_number: nextTaskNumber,
                window_number: 1,
                opens_at: opensAt.toISOString(),
                closes_at: closesAt.toISOString(),
                verification_code: verificationCode,
                task_name: taskName,
            })
            .select().single();

        if (wErr) throw wErr;

        return NextResponse.json({
            success: true,
            window: newWindow,
            task_number: nextTaskNumber,
            tasks_remaining: totalTasks - tasksDone,
            delay_minutes: delayMinutes,
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
