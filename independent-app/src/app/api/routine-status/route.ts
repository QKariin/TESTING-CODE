import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const memberEmail = searchParams.get('email');

        if (!memberEmail) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

        // Only fetch routine from profiles (routine_history column does not exist)
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('routine')
            .ilike('member_id', memberEmail)
            .maybeSingle();

        const routine = profile?.routine || null;

        // Fetch tasks history to see if they uploaded a routine today
        const { data: taskRow } = await supabaseAdmin
            .from('tasks')
            .select('Taskdom_History')
            .ilike('member_id', memberEmail)
            .maybeSingle();

        let uploadedToday = false;
        if (taskRow?.Taskdom_History) {
            try {
                const history = typeof taskRow.Taskdom_History === 'string'
                    ? JSON.parse(taskRow.Taskdom_History)
                    : taskRow.Taskdom_History;

                const todayStr = new Date().toISOString().split('T')[0];
                uploadedToday = Array.isArray(history) && history.some((t: any) => {
                    if (!t.isRoutine || !t.timestamp) return false;
                    try { return new Date(t.timestamp).toISOString().split('T')[0] === todayStr; } catch { return false; }
                });
            } catch (err) {
                console.error('Failed parsing Taskdom_History', err);
            }
        }

        return NextResponse.json({
            routine,           // null = no routine set | string = their routine text
            uploadedToday,     // true = already uploaded today
        });
    } catch (err: any) {
        console.error('[routine-status]', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
