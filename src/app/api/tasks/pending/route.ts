import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Lightweight endpoint: returns only pending task/routine IDs + basic info
// Used by dashboard 10s poll to detect new submissions without fetching full dashboard data
export async function GET() {
    try {
        // Pending tasks from Taskdom_History
        const { data: tasks } = await supabaseAdmin
            .from('tasks')
            .select('member_id, "Taskdom_History"');

        const pending: any[] = [];

        for (const row of (tasks || [])) {
            let history: any[] = [];
            try {
                history = typeof row.Taskdom_History === 'string'
                    ? JSON.parse(row.Taskdom_History || '[]')
                    : (row.Taskdom_History || []);
            } catch { continue; }

            for (const t of history) {
                if (t.status === 'pending') {
                    pending.push({
                        id: t.id,
                        member_id: row.member_id,
                        text: t.text || 'Task',
                        thumbnail_url: t.thumbnail_url || t.proofUrl || null,
                        isRoutine: false,
                        submitted_at: t.submitted_at || t.createdAt || null,
                    });
                }
            }
        }

        // Pending routines from user_routines
        const { data: routines } = await supabaseAdmin
            .from('user_routines')
            .select('member_id, routine_name, pending_id, pending_thumbnail_url, pending_proof_url, pending_submitted_at')
            .not('pending_id', 'is', null);

        for (const r of (routines || [])) {
            pending.push({
                id: r.pending_id,
                member_id: r.member_id,
                text: r.routine_name || 'Daily Routine',
                thumbnail_url: r.pending_thumbnail_url || r.pending_proof_url || null,
                isRoutine: true,
                submitted_at: r.pending_submitted_at || null,
            });
        }

        return NextResponse.json({ pending });
    } catch (err: any) {
        return NextResponse.json({ pending: [], error: err.message }, { status: 500 });
    }
}
