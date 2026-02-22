import { NextRequest, NextResponse } from 'next/server';
import { DbService } from '@/lib/supabase-service';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const memberEmail = searchParams.get('memberEmail');

        if (!memberEmail) {
            return NextResponse.json({ success: false, error: 'Missing memberEmail' }, { status: 400 });
        }

        // 1. Check if user already has an active task
        const profile = await DbService.getProfile(memberEmail);
        if (profile?.parameters?.active_task) {
            const activeTask = profile.parameters.active_task;
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

        // 2. Otherwise/If expired, pick a new random task
        const { data: tasks, error } = await supabaseAdmin
            .from('tasks_database')
            .select('*');

        if (error) {
            console.error("Supabase Error fetching tasks:", error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        if (!tasks || tasks.length === 0) {
            return NextResponse.json({ success: false, error: 'No tasks found' }, { status: 404 });
        }

        const randomIndex = Math.floor(Math.random() * tasks.length);
        const randomTask = tasks[randomIndex];

        // 3. Assign it in the database
        await DbService.assignTask(memberEmail, randomTask);

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
