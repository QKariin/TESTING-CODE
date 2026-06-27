import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCaller, isCEO } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// GET /api/video-challenges/[id] — detail + tasks + user progress
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const isAdmin = isCEO(caller.email);

        // Fetch challenge
        const { data: challenge, error } = await supabaseAdmin
            .from('video_challenges').select('*').eq('id', id).single();
        if (error || !challenge) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

        // Fetch tasks (always — admin sees all, user sees up to current)
        const { data: tasks } = await supabaseAdmin
            .from('video_challenge_tasks').select('*')
            .eq('challenge_id', id).order('position', { ascending: true });

        // User participation
        const { data: participation } = await supabaseAdmin
            .from('video_challenge_participants').select('*')
            .eq('challenge_id', id).eq('member_id', caller.email).maybeSingle();

        // User submissions
        let submissions: any[] = [];
        if (participation) {
            const { data: subs } = await supabaseAdmin
                .from('video_challenge_submissions').select('*')
                .eq('challenge_id', id).eq('member_id', caller.email)
                .order('task_position', { ascending: true });
            submissions = subs || [];
        }

        // For non-admin users: only show tasks up to current_task (don't reveal future videos)
        let visibleTasks = tasks || [];
        if (!isAdmin && participation) {
            visibleTasks = (tasks || []).filter((t: any) => t.position <= participation.current_task);
        } else if (!isAdmin && !participation) {
            // Not joined — only show task count, no videos
            visibleTasks = (tasks || []).map((t: any) => ({
                position: t.position,
                title: t.title,
                // No video_url for non-participants
            }));
        }

        // Participant counts
        const { data: allParticipants } = await supabaseAdmin
            .from('video_challenge_participants').select('status')
            .eq('challenge_id', id);

        const counts = {
            total: (allParticipants || []).length,
            active: (allParticipants || []).filter((p: any) => p.status === 'active').length,
            completed: (allParticipants || []).filter((p: any) => p.status === 'completed').length,
            kicked: (allParticipants || []).filter((p: any) => p.status === 'kicked').length,
        };

        // Admin: include all participants + pending submissions
        let adminData: any = null;
        if (isAdmin) {
            const [{ data: allParts }, { data: pendingSubs }] = await Promise.all([
                supabaseAdmin.from('video_challenge_participants')
                    .select('*').eq('challenge_id', id).order('joined_at', { ascending: false }),
                supabaseAdmin.from('video_challenge_submissions')
                    .select('*').eq('challenge_id', id).eq('status', 'pending'),
            ]);

            // Enrich participants with profile info
            const emails = (allParts || []).map((p: any) => p.member_id);
            const { data: profiles } = emails.length
                ? await supabaseAdmin.from('profiles').select('member_id, name, avatar_url, hierarchy')
                    .in('member_id', emails)
                : { data: [] };

            const profileMap = new Map<string, any>((profiles || []).map((p: any) => [p.member_id?.toLowerCase(), p]));

            adminData = {
                participants: (allParts || []).map((p: any) => ({
                    ...p,
                    name: profileMap.get(p.member_id?.toLowerCase())?.name || p.member_id,
                    avatar_url: profileMap.get(p.member_id?.toLowerCase())?.avatar_url || null,
                    hierarchy: profileMap.get(p.member_id?.toLowerCase())?.hierarchy || 'Hall Boy',
                })),
                pending_submissions: pendingSubs || [],
            };
        }

        return NextResponse.json({
            success: true,
            challenge,
            tasks: visibleTasks,
            task_count: (tasks || []).length,
            participation,
            submissions,
            counts,
            ...(adminData ? { admin: adminData } : {}),
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// PATCH /api/video-challenges/[id] — update (admin only)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const caller = await getCaller();
        if (!caller || !isCEO(caller.email)) {
            return NextResponse.json({ success: false, error: 'Admin only' }, { status: 403 });
        }

        const body = await req.json();
        const allowed = [
            'name', 'topic', 'items_needed', 'tier_video_url', 'image_url',
            'window_minutes', 'scheduling_mode', 'duration_days', 'min_tier',
            'join_cost', 'rejoin_cost', 'points_per_task', 'theme', 'status',
        ];

        const updates: Record<string, any> = {};
        for (const key of allowed) {
            if (body[key] !== undefined) updates[key] = body[key];
        }

        if (Object.keys(updates).length === 0 && !body.tasks) {
            return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 });
        }

        if (Object.keys(updates).length > 0) {
            const { error } = await supabaseAdmin
                .from('video_challenges').update(updates).eq('id', id);
            if (error) throw error;
        }

        // Replace tasks if provided
        if (body.tasks && Array.isArray(body.tasks)) {
            await supabaseAdmin.from('video_challenge_tasks').delete().eq('challenge_id', id);
            const taskRows = body.tasks.map((t: any, i: number) => ({
                challenge_id: id,
                position: i + 1,
                video_url: t.video_url,
                title: t.title || null,
                description: t.description || null,
            }));
            const { error: tErr } = await supabaseAdmin.from('video_challenge_tasks').insert(taskRows);
            if (tErr) throw tErr;
        }

        const { data: updated } = await supabaseAdmin
            .from('video_challenges').select('*').eq('id', id).single();

        return NextResponse.json({ success: true, challenge: updated });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
