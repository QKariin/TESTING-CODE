import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCaller } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// POST /api/video-challenges/[id]/request-task — request next task (on_request mode)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: challengeId } = await params;
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        // Fetch challenge
        const { data: challenge } = await supabaseAdmin
            .from('video_challenges').select('*').eq('id', challengeId).single();
        if (!challenge) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

        if (challenge.scheduling_mode !== 'on_request') {
            return NextResponse.json({
                success: false,
                error: 'This challenge uses scheduled windows, not on-request',
            }, { status: 400 });
        }

        // Fetch participation
        const { data: participation } = await supabaseAdmin
            .from('video_challenge_participants').select('*')
            .eq('challenge_id', challengeId).eq('member_id', caller.email).maybeSingle();

        if (!participation || participation.status !== 'active') {
            return NextResponse.json({ success: false, error: 'Not an active participant' }, { status: 400 });
        }

        // Check that previous task is approved
        const prevPosition = participation.current_task - 1;
        if (prevPosition >= 1) {
            const { data: prevSubmission } = await supabaseAdmin
                .from('video_challenge_submissions').select('status')
                .eq('challenge_id', challengeId)
                .eq('member_id', caller.email)
                .eq('task_position', prevPosition)
                .maybeSingle();

            if (!prevSubmission || prevSubmission.status !== 'approved') {
                return NextResponse.json({
                    success: false,
                    error: 'Previous task must be approved before requesting next',
                }, { status: 400 });
            }
        }

        // Check that no active/pending window exists already
        const { data: existingActive } = await supabaseAdmin
            .from('video_challenge_submissions').select('id, status')
            .eq('challenge_id', challengeId)
            .eq('member_id', caller.email)
            .eq('task_position', participation.current_task)
            .in('status', ['active', 'pending'])
            .maybeSingle();

        if (existingActive) {
            return NextResponse.json({
                success: false,
                error: existingActive.status === 'pending'
                    ? 'Current task is still pending review'
                    : 'Window already open for current task',
            }, { status: 400 });
        }

        // Fetch the task for current position
        const { data: task } = await supabaseAdmin
            .from('video_challenge_tasks').select('*')
            .eq('challenge_id', challengeId)
            .eq('position', participation.current_task)
            .maybeSingle();

        if (!task) {
            return NextResponse.json({ success: false, error: 'No more tasks available' }, { status: 400 });
        }

        // Create new window
        const now = new Date();
        const closesAt = new Date(now.getTime() + challenge.window_minutes * 60 * 1000);

        // Delete old expired/rejected submission for this position if exists
        await supabaseAdmin.from('video_challenge_submissions')
            .delete()
            .eq('challenge_id', challengeId)
            .eq('member_id', caller.email)
            .eq('task_position', participation.current_task)
            .in('status', ['expired', 'rejected']);

        const { error } = await supabaseAdmin.from('video_challenge_submissions').insert({
            challenge_id: challengeId,
            member_id: caller.email,
            task_id: task.id,
            task_position: participation.current_task,
            window_opens_at: now.toISOString(),
            window_closes_at: closesAt.toISOString(),
            status: 'active',
        });

        if (error) throw error;

        return NextResponse.json({
            success: true,
            task_position: participation.current_task,
            task: {
                video_url: task.video_url,
                title: task.title,
                description: task.description,
            },
            window_opens_at: now.toISOString(),
            window_closes_at: closesAt.toISOString(),
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
