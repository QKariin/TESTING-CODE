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

        const { data: taskRow } = await supabaseAdmin
            .from('tasks')
            .select('taskdom_active_task')
            .eq('member_id', profile?.member_id || memberEmail)
            .maybeSingle();

        if (taskRow && taskRow.taskdom_active_task) {
            const activeTask = typeof taskRow.taskdom_active_task === 'string'
                ? JSON.parse(taskRow.taskdom_active_task)
                : taskRow.taskdom_active_task;

            const assignedAt = new Date(activeTask.assigned_at).getTime();
            const now = new Date().getTime();
            const hoursPassed = (now - assignedAt) / (1000 * 60 * 60);

            // If task is less than 24 hours old, return it
            if (activeTask.assigned_at && hoursPassed < 24) {
                return NextResponse.json({
                    success: true,
                    task: activeTask,
                    isReassigned: false,
                    timeLeftMs: (24 * 60 * 60 * 1000) - (now - assignedAt)
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

        // 4. Assign it efficiently reusing our profile fetch
        const activeTaskPayload = { ...randomTask, assigned_at: new Date().toISOString() };

        await supabaseAdmin.from('tasks').upsert({
            member_id: profile?.member_id || memberEmail,
            Name: profile?.name || memberEmail,
            taskdom_active_task: JSON.stringify(activeTaskPayload)
        }, { onConflict: 'member_id' });

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
