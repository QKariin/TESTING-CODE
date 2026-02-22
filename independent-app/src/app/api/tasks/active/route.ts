import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const email = searchParams.get('email');

        if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

        const { data: profile, error } = await getSupabaseAdmin()
            .from('profiles')
            .select('parameters')
            .eq('member_id', email)
            .single();

        if (error || !profile) {
            return NextResponse.json({ activeTask: null });
        }

        const params = profile.parameters || {};
        const activeTask = params.activeTask;

        // Check if task exists and hasn't expired
        if (activeTask && activeTask.expiresAt) {
            const now = new Date().getTime();
            const expires = new Date(activeTask.expiresAt).getTime();

            if (now < expires) {
                return NextResponse.json({ activeTask });
            } else {
                // Task expired - clear it
                delete params.activeTask;
                await getSupabaseAdmin()
                    .from('profiles')
                    .update({ parameters: params })
                    .eq('member_id', email);
            }
        }

        return NextResponse.json({ activeTask: null });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { email } = await req.json();
        if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

        // 1. Get profile
        const { data: profile } = await getSupabaseAdmin()
            .from('profiles')
            .select('*')
            .eq('member_id', email)
            .single();

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        const params = profile.parameters || {};

        // 2. Check if already has active task
        if (params.activeTask && new Date().getTime() < new Date(params.activeTask.expiresAt).getTime()) {
            return NextResponse.json({ activeTask: params.activeTask });
        }

        // 3. Fetch random task
        const { data: tasks, error: taskError } = await getSupabaseAdmin()
            .from('tasks_database')
            .select('*');

        if (taskError || !tasks || tasks.length === 0) {
            return NextResponse.json({ error: 'Failed to fetch new task' }, { status: 500 });
        }

        const randomTask = tasks[Math.floor(Math.random() * tasks.length)];
        const taskText = randomTask.TaskText || randomTask.tasktext || 'Perform the assigned duty.';

        // 4. Create active task object (24 hours)
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24 hours

        const newActiveTask = {
            taskId: randomTask.id || `task-${Date.now()}`,
            taskText: taskText,
            assignedAt: now.toISOString(),
            expiresAt: expiresAt.toISOString()
        };

        params.activeTask = newActiveTask;

        // 5. Update profile
        await getSupabaseAdmin()
            .from('profiles')
            .update({ parameters: params })
            .eq('member_id', email);

        return NextResponse.json({ activeTask: newActiveTask });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
