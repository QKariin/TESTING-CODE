import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCaller } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// GET /api/video-challenges/[id]/submit — user's progress
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: challengeId } = await params;
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        // Fetch participation
        const { data: participation } = await supabaseAdmin
            .from('video_challenge_participants').select('*')
            .eq('challenge_id', challengeId).eq('member_id', caller.email).maybeSingle();

        if (!participation) {
            return NextResponse.json({ success: true, joined: false });
        }

        // Fetch all submissions for this user
        const { data: submissions } = await supabaseAdmin
            .from('video_challenge_submissions').select('*')
            .eq('challenge_id', challengeId).eq('member_id', caller.email)
            .order('task_position', { ascending: true });

        // Fetch current task info (video)
        const { data: currentTask } = await supabaseAdmin
            .from('video_challenge_tasks').select('*')
            .eq('challenge_id', challengeId).eq('position', participation.current_task).maybeSingle();

        // Fetch challenge for context
        const { data: challenge } = await supabaseAdmin
            .from('video_challenges').select('name, task_count:video_challenge_tasks(count), window_minutes, scheduling_mode, points_per_task')
            .eq('id', challengeId).single();

        // Total task count
        const { count: taskCount } = await supabaseAdmin
            .from('video_challenge_tasks').select('*', { count: 'exact', head: true })
            .eq('challenge_id', challengeId);

        // Find the active/pending submission (current window)
        const activeSubmission = (submissions || []).find(
            (s: any) => s.status === 'active' || s.status === 'pending'
        );

        return NextResponse.json({
            success: true,
            joined: true,
            participation,
            current_task: currentTask,
            active_submission: activeSubmission || null,
            submissions: submissions || [],
            task_count: taskCount || 0,
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// POST /api/video-challenges/[id]/submit — submit proof for current task
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: challengeId } = await params;
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { proof_url, proof_type, thumbnail_url } = body;

        if (!proof_url) {
            return NextResponse.json({ success: false, error: 'proof_url is required' }, { status: 400 });
        }

        // Fetch participation
        const { data: participation } = await supabaseAdmin
            .from('video_challenge_participants').select('*')
            .eq('challenge_id', challengeId).eq('member_id', caller.email).maybeSingle();

        if (!participation || participation.status !== 'active') {
            return NextResponse.json({ success: false, error: 'Not an active participant' }, { status: 400 });
        }

        // Find the active submission (current window)
        const { data: submission } = await supabaseAdmin
            .from('video_challenge_submissions').select('*')
            .eq('challenge_id', challengeId)
            .eq('member_id', caller.email)
            .eq('task_position', participation.current_task)
            .eq('status', 'active')
            .maybeSingle();

        if (!submission) {
            return NextResponse.json({ success: false, error: 'No active window for current task' }, { status: 400 });
        }

        // Check if window is still open
        const now = new Date();
        if (now > new Date(submission.window_closes_at)) {
            return NextResponse.json({ success: false, error: 'Window has expired' }, { status: 400 });
        }

        // Normalize proof type
        const pType = (proof_type || '').startsWith('video') ? 'video' : 'image';

        // Update submission with proof
        const { error } = await supabaseAdmin
            .from('video_challenge_submissions')
            .update({
                proof_url,
                proof_type: pType,
                thumbnail_url: thumbnail_url || null,
                submitted_at: now.toISOString(),
                status: 'pending',
            })
            .eq('id', submission.id);

        if (error) throw error;

        // Push notification to admin
        try {
            const { data: profile } = await supabaseAdmin.from('profiles')
                .select('name').ilike('member_id', caller.email).maybeSingle();
            const name = profile?.name || caller.email.split('@')[0];

            const ONESIGNAL_KEY = process.env.ONESIGNAL_REST_API_KEY;
            const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '761d91da-b098-44a7-8d98-75c1cce54dd0';
            if (ONESIGNAL_KEY) {
                fetch('https://api.onesignal.com/notifications', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${ONESIGNAL_KEY}` },
                    body: JSON.stringify({
                        app_id: ONESIGNAL_APP_ID,
                        target_channel: 'push',
                        include_aliases: { external_id: ['ceo@qkarin.com'] },
                        headings: { en: 'Video Challenge Proof' },
                        subtitle: { en: 'Throne' },
                        contents: { en: `${name} submitted proof for video challenge task ${participation.current_task}` },
                        url: 'https://throne.qkarin.com/dashboard/challenges',
                    }),
                }).catch(() => {});
            }
        } catch (_) {}

        return NextResponse.json({
            success: true,
            submission_id: submission.id,
            task_position: participation.current_task,
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
