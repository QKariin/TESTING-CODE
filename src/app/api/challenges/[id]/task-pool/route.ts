import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/** GET — fetch all pool tasks for a challenge */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { data, error } = await supabaseAdmin
            .from('challenge_task_pool')
            .select('*')
            .eq('challenge_id', id)
            .order('is_milestone', { ascending: false })
            .order('milestone_day', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: true });

        if (error) throw error;
        return NextResponse.json({ success: true, tasks: data || [] });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

/** POST — bulk-set the entire task pool (replaces existing) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const { tasks } = await req.json();
        if (!Array.isArray(tasks)) {
            return NextResponse.json({ success: false, error: 'tasks must be an array' }, { status: 400 });
        }

        // Delete existing pool for this challenge
        await supabaseAdmin
            .from('challenge_task_pool')
            .delete()
            .eq('challenge_id', id);

        if (tasks.length === 0) {
            return NextResponse.json({ success: true, count: 0 });
        }

        // Insert new pool
        const rows = tasks.map((t: any) => ({
            challenge_id: id,
            task_name: t.task_name || t.name || '',
            task_description: t.task_description || t.description || null,
            difficulty: ['easy', 'medium', 'hard'].includes(t.difficulty) ? t.difficulty : 'medium',
            is_milestone: !!t.is_milestone,
            milestone_day: t.is_milestone ? (t.milestone_day || null) : null,
        }));

        const { error } = await supabaseAdmin.from('challenge_task_pool').insert(rows);
        if (error) throw error;

        return NextResponse.json({ success: true, count: rows.length });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
