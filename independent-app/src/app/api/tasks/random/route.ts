import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { data: tasks, error } = await getSupabaseAdmin()
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

        return NextResponse.json({ success: true, task: randomTask });
    } catch (error: any) {
        console.error("Failed to fetch tasks:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
