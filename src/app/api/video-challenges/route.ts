import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCaller, isCEO } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// GET /api/video-challenges — list all video challenges
export async function GET() {
    try {
        const { data: challenges, error } = await supabaseAdmin
            .from('video_challenges')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const ids = (challenges || []).map((c: any) => c.id);
        const [{ data: participants }, { data: pending }] = await Promise.all([
            ids.length
                ? supabaseAdmin.from('video_challenge_participants').select('challenge_id, status').in('challenge_id', ids)
                : { data: [] as any[] },
            ids.length
                ? supabaseAdmin.from('video_challenge_submissions').select('challenge_id').eq('status', 'pending').in('challenge_id', ids)
                : { data: [] as any[] },
        ]);

        // Count tasks per challenge
        const { data: taskCounts } = ids.length
            ? await supabaseAdmin.from('video_challenge_tasks').select('challenge_id').in('challenge_id', ids)
            : { data: [] as any[] };

        const enriched = (challenges || []).map((c: any) => {
            const cp = (participants || []).filter((p: any) => p.challenge_id === c.id);
            return {
                ...c,
                task_count: (taskCounts || []).filter((t: any) => t.challenge_id === c.id).length,
                participant_total: cp.length,
                participant_active: cp.filter((p: any) => p.status === 'active').length,
                pending_review_count: (pending || []).filter((p: any) => p.challenge_id === c.id).length,
            };
        });

        return NextResponse.json({ success: true, challenges: enriched });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// POST /api/video-challenges — create (admin only)
export async function POST(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller || !isCEO(caller.email)) {
            return NextResponse.json({ success: false, error: 'Admin only' }, { status: 403 });
        }

        const body = await req.json();
        const {
            name, topic, items_needed, tier_video_url, image_url,
            window_minutes = 60, scheduling_mode = 'scheduled',
            duration_days = 7, min_tier = null,
            join_cost = 0, rejoin_cost = 0,
            points_per_task = 100, theme = 'default',
            tasks = [],
        } = body;

        if (!name) return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
        if (!tasks.length) return NextResponse.json({ success: false, error: 'At least one video task is required' }, { status: 400 });

        // Create challenge
        const { data: challenge, error: cErr } = await supabaseAdmin
            .from('video_challenges')
            .insert({
                name, topic, items_needed, tier_video_url, image_url,
                window_minutes: Number(window_minutes),
                scheduling_mode,
                duration_days: Number(duration_days),
                min_tier, join_cost: Number(join_cost),
                rejoin_cost: Number(rejoin_cost),
                points_per_task: Number(points_per_task),
                theme,
                status: 'draft',
            })
            .select().single();

        if (cErr) throw cErr;

        // Insert tasks in order
        const taskRows = tasks.map((t: any, i: number) => ({
            challenge_id: challenge.id,
            position: i + 1,
            video_url: t.video_url,
            title: t.title || null,
            description: t.description || null,
        }));

        const { error: tErr } = await supabaseAdmin.from('video_challenge_tasks').insert(taskRows);
        if (tErr) throw tErr;

        return NextResponse.json({ success: true, challenge, task_count: taskRows.length });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
