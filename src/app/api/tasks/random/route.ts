import { NextRequest, NextResponse } from 'next/server';
import { DbService } from '@/lib/supabase-service';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const memberEmail = searchParams.get('memberEmail');
        const forceNew = searchParams.get('forceNew') === 'true';

        if (!memberEmail) {
            return NextResponse.json({ success: false, error: 'Missing memberEmail' }, { status: 400 });
        }

        // 1. Check if user already has an active task in the tasks table
        const profile = await DbService.getProfile(memberEmail);

        let taskRow: any = null;
        if (profile?.ID) {
            const { data } = await supabaseAdmin.from('tasks').select('taskdom_active_task').eq('ID', profile.ID).maybeSingle();
            taskRow = data;
        }
        if (!taskRow && profile?.member_id) {
            const { data } = await supabaseAdmin.from('tasks').select('taskdom_active_task').ilike('member_id', profile.member_id).maybeSingle();
            taskRow = data;
        }

        if (taskRow && taskRow.taskdom_active_task) {
            const activeTask = typeof taskRow.taskdom_active_task === 'string'
                ? JSON.parse(taskRow.taskdom_active_task)
                : taskRow.taskdom_active_task;

            const now = Date.now();
            const assignedAt = activeTask.assigned_at ? new Date(activeTask.assigned_at).getTime() : now;
            const endTime = activeTask.endTime || (assignedAt + 24 * 60 * 60 * 1000);
            const timeLeftMs = endTime - now;
            const isAdminForced = activeTask.category === 'Directive';

            // Task expired — clear it, deduct 300 coins, let them request a new one
            if (timeLeftMs <= 0 && !isAdminForced) {
                // Clear expired task in DB (checkExpiredTasks handles penalty but run inline too)
                const profileId = profile?.ID || memberEmail;
                await supabaseAdmin.from('tasks').update({
                    taskdom_active_task: null,
                    taskdom_pending_state: null,
                }).eq('ID', profileId);
                // Deduct 300 coins
                if (profile) {
                    const newWallet = Math.max(0, Number(profile.wallet || 0) - 300);
                    await supabaseAdmin.from('profiles').update({ wallet: newWallet }).eq('ID', profile.ID);
                    try {
                        await DbService.sendMessage(profile.member_id || memberEmail,
                            `TASK EXPIRED — 300 <i class="fas fa-coins" style="color:#c5a059;"></i> PENALTY.`,
                            'system');
                    } catch (_) {}
                }
                // Fall through to assign new task or return null
            } else if (timeLeftMs > 0 || isAdminForced) {
                return NextResponse.json({
                    success: true,
                    task: activeTask,
                    isReassigned: false,
                    timeLeftMs: Math.max(0, timeLeftMs),
                });
            }
        }

        // 2. If no active task and NOT forceNew, return null (don't auto-assign)
        if (!forceNew) {
            return NextResponse.json({
                success: true,
                task: null,
                isReassigned: false
            });
        }

        // 3. Otherwise (expired or forced), pick a new random task
        const { count, error } = await supabaseAdmin
            .from('tasks_database')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error("Supabase Error fetching tasks:", error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        if (!count || count === 0) {
            return NextResponse.json({ success: false, error: 'No tasks found' }, { status: 404 });
        }

        const randomIndex = Math.floor(Math.random() * count);
        const { data: tasks } = await supabaseAdmin
            .from('tasks_database')
            .select('*')
            .range(randomIndex, randomIndex);

        const randomTask = tasks?.[0];

        // 4. Assign it — use UPDATE if row exists, INSERT only as fallback
        const activeTaskPayload = { ...randomTask, assigned_at: new Date().toISOString() };
        const taskUpdate = { taskdom_active_task: JSON.stringify(activeTaskPayload) };
        const profileId = profile?.ID || memberEmail;

        // Try UPDATE first (preserves all existing columns including scores)
        const { data: updated } = await supabaseAdmin.from('tasks')
            .update(taskUpdate).eq('ID', profileId).select('ID').maybeSingle();
        if (!updated) {
            // No row with this ID — try by email
            const { data: updated2 } = await supabaseAdmin.from('tasks')
                .update(taskUpdate).ilike('member_id', profile?.member_id || memberEmail).select('ID').maybeSingle();
            if (!updated2) {
                // Truly new — INSERT (scores will be 0, not NULL)
                await supabaseAdmin.from('tasks').insert({
                    ID: profileId,
                    member_id: profile?.member_id || memberEmail,
                    Name: profile?.name || memberEmail,
                    ...taskUpdate,
                    'Score': 0, 'Daily Score': 0, 'Weekly Score': 0, 'Monthly Score': 0, 'Yearly Score': 0,
                });
            }
        }

        return NextResponse.json({
            success: true,
            task: { ...randomTask, assigned_at: new Date().toISOString() },
            isReassigned: true,
            timeLeftMs: 24 * 60 * 60 * 1000
        });
    } catch (error: any) {
        console.error("Failed to fetch tasks:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
