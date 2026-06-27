import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCaller, isCEO } from '@/lib/api-auth';
import { DbService } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

// GET /api/video-challenges/[id]/review — pending submissions for this challenge
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: challengeId } = await params;
        const caller = await getCaller();
        if (!caller || !isCEO(caller.email)) {
            return NextResponse.json({ success: false, error: 'Admin only' }, { status: 403 });
        }

        const { data: submissions, error } = await supabaseAdmin
            .from('video_challenge_submissions').select('*')
            .eq('challenge_id', challengeId)
            .eq('status', 'pending')
            .order('submitted_at', { ascending: true });

        if (error) throw error;

        // Enrich with profile info + task info
        const memberIds = [...new Set((submissions || []).map((s: any) => s.member_id))];
        const taskIds = [...new Set((submissions || []).map((s: any) => s.task_id))];

        const [{ data: profiles }, { data: tasks }] = await Promise.all([
            memberIds.length
                ? supabaseAdmin.from('profiles').select('member_id, name, avatar_url').in('member_id', memberIds)
                : { data: [] },
            taskIds.length
                ? supabaseAdmin.from('video_challenge_tasks').select('id, title, position').in('id', taskIds)
                : { data: [] },
        ]);

        const profileMap = new Map<string, any>((profiles || []).map((p: any) => [p.member_id?.toLowerCase(), p]));
        const taskMap = new Map<string, any>((tasks || []).map((t: any) => [t.id, t]));

        // Sign proof URLs
        const enriched = await Promise.all((submissions || []).map(async (s: any) => {
            let signedProofUrl = s.proof_url;
            if (s.proof_url && s.proof_url.includes('proofs/')) {
                let path = '';
                if (s.proof_url.includes('/object/public/proofs/')) {
                    path = s.proof_url.split('/object/public/proofs/')[1].split('?')[0];
                } else if (s.proof_url.includes('/public/proofs/')) {
                    path = s.proof_url.split('/public/proofs/')[1].split('?')[0];
                }
                if (path) {
                    try {
                        const { data: signData } = await supabaseAdmin.storage
                            .from('proofs').createSignedUrl(path, 604800);
                        if (signData?.signedUrl) signedProofUrl = signData.signedUrl;
                    } catch (_) {}
                }
            }

            const prof = profileMap.get(s.member_id?.toLowerCase());
            const task = taskMap.get(s.task_id);
            return {
                ...s,
                proof_url: signedProofUrl,
                member_name: prof?.name || s.member_id,
                member_avatar: prof?.avatar_url || null,
                task_title: task?.title || `Task ${s.task_position}`,
            };
        }));

        return NextResponse.json({ success: true, submissions: enriched });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// POST /api/video-challenges/[id]/review — approve or reject
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: challengeId } = await params;
        const caller = await getCaller();
        if (!caller || !isCEO(caller.email)) {
            return NextResponse.json({ success: false, error: 'Admin only' }, { status: 403 });
        }

        const body = await req.json();
        const { submission_id, action } = body;

        if (!submission_id || !['approve', 'reject'].includes(action)) {
            return NextResponse.json({ success: false, error: 'submission_id and action (approve/reject) required' }, { status: 400 });
        }

        // Fetch submission
        const { data: submission } = await supabaseAdmin
            .from('video_challenge_submissions').select('*')
            .eq('id', submission_id).eq('challenge_id', challengeId).single();

        if (!submission) return NextResponse.json({ success: false, error: 'Submission not found' }, { status: 404 });
        if (submission.status !== 'pending') {
            return NextResponse.json({ success: false, error: `Submission is ${submission.status}, not pending` }, { status: 400 });
        }

        // Fetch challenge
        const { data: challenge } = await supabaseAdmin
            .from('video_challenges').select('points_per_task, scheduling_mode').eq('id', challengeId).single();

        // Total task count
        const { count: taskCount } = await supabaseAdmin
            .from('video_challenge_tasks').select('*', { count: 'exact', head: true })
            .eq('challenge_id', challengeId);

        const now = new Date().toISOString();

        if (action === 'approve') {
            const points = challenge?.points_per_task || 100;

            // Update submission
            await supabaseAdmin.from('video_challenge_submissions')
                .update({ status: 'approved', reviewed_at: now, points_awarded: points })
                .eq('id', submission_id);

            // Award points to leaderboard
            try { await DbService.awardPoints(submission.member_id, points); } catch (_) {}

            // Advance participant to next task
            const nextTask = submission.task_position + 1;
            const isCompleted = nextTask > (taskCount || 0);

            // Calculate total points
            const { data: approvedSubs } = await supabaseAdmin.from('video_challenge_submissions')
                .select('points_awarded').eq('challenge_id', challengeId)
                .eq('member_id', submission.member_id).eq('status', 'approved');
            const totalPoints = (approvedSubs || []).reduce((sum: number, s: any) => sum + (s.points_awarded || 0), 0) + points;

            await supabaseAdmin.from('video_challenge_participants')
                .update({
                    current_task: nextTask,
                    total_points: totalPoints,
                    ...(isCompleted ? { status: 'completed', completed_at: now } : {}),
                })
                .eq('challenge_id', challengeId)
                .eq('member_id', submission.member_id);

            // Send chat card to user
            try {
                const { data: profile } = await supabaseAdmin.from('profiles')
                    .select('ID').ilike('member_id', submission.member_id).maybeSingle();
                if (profile) {
                    const cardData = {
                        status: 'approve', points, type: 'video_challenge',
                        taskText: `Video Challenge Task ${submission.task_position}`,
                        thumbnail: submission.thumbnail_url || submission.proof_url,
                    };
                    await DbService.sendMessage(profile.ID, `TASK_REVIEW_CARD::${JSON.stringify(cardData)}`, 'system');
                }
            } catch (_) {}

            return NextResponse.json({
                success: true, action: 'approved',
                points_awarded: points,
                is_completed: isCompleted,
                next_task: isCompleted ? null : nextTask,
            });

        } else {
            // ── REJECT → kick ──
            await supabaseAdmin.from('video_challenge_submissions')
                .update({ status: 'rejected', reviewed_at: now })
                .eq('id', submission_id);

            await supabaseAdmin.from('video_challenge_participants')
                .update({ status: 'kicked', kicked_at: now })
                .eq('challenge_id', challengeId)
                .eq('member_id', submission.member_id);

            // Send rejection card
            try {
                const { data: profile } = await supabaseAdmin.from('profiles')
                    .select('ID').ilike('member_id', submission.member_id).maybeSingle();
                if (profile) {
                    const cardData = {
                        status: 'reject', points: 0, type: 'video_challenge',
                        taskText: `Video Challenge Task ${submission.task_position}`,
                        thumbnail: submission.thumbnail_url || submission.proof_url,
                    };
                    await DbService.sendMessage(profile.ID, `TASK_REVIEW_CARD::${JSON.stringify(cardData)}`, 'system');
                }
            } catch (_) {}

            return NextResponse.json({ success: true, action: 'rejected', kicked: true });
        }
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
