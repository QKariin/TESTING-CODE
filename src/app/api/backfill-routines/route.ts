import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// One-time backfill: writes all approved routines into Taskdom_History
export async function GET(req: Request) {
    const envSecret = (process.env.CRON_SECRET || '').trim();
    if (envSecret) {
        const authHeader = req.headers.get('authorization') || '';
        const incoming = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
        const { searchParams } = new URL(req.url);
        const querySecret = (searchParams.get('secret') || '').trim();
        if (incoming !== envSecret && querySecret !== envSecret) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    // Fetch all approved routines
    const { data: approved, error: fetchErr } = await supabaseAdmin
        .from('routines')
        .select('id, member_id, proof_url, proof_type, thumbnail_url, submitted_at, status')
        .eq('status', 'approve');

    if (fetchErr) {
        return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    if (!approved || approved.length === 0) {
        return NextResponse.json({ success: true, backfilled: 0 });
    }

    // Group by user
    const byUser: Record<string, any[]> = {};
    for (const r of approved) {
        if (!byUser[r.member_id]) byUser[r.member_id] = [];
        byUser[r.member_id].push(r);
    }

    let totalAdded = 0;
    for (const [email, routines] of Object.entries(byUser)) {
        try {
            const { data: taskRow } = await supabaseAdmin
                .from('tasks')
                .select('ID, "Taskdom_History"')
                .ilike('member_id', email)
                .maybeSingle();

            if (!taskRow) continue;

            let history: any[] = [];
            try {
                history = typeof taskRow['Taskdom_History'] === 'string'
                    ? JSON.parse(taskRow['Taskdom_History'])
                    : (taskRow['Taskdom_History'] || []);
            } catch { history = []; }

            // Track existing routine IDs to avoid duplicates
            const existingIds = new Set(history.filter((h: any) => h.isRoutine && h.id).map((h: any) => h.id));

            let added = 0;
            for (const r of routines) {
                if (existingIds.has(r.id)) continue;
                history.push({
                    id: r.id,
                    text: 'Daily Routine',
                    proofUrl: r.proof_url,
                    proofType: r.proof_type,
                    thumbnail_url: r.thumbnail_url,
                    timestamp: r.submitted_at,
                    status: 'approve',
                    isRoutine: true,
                });
                added++;
            }

            if (added > 0) {
                await supabaseAdmin.from('tasks').update({ 'Taskdom_History': JSON.stringify(history) }).eq('ID', taskRow.ID);
                totalAdded += added;
            }
        } catch (e) {
            console.warn('[backfill-routines] error for', email, e);
        }
    }

    console.log(`[backfill-routines] Backfilled ${totalAdded} routines for ${Object.keys(byUser).length} users`);
    return NextResponse.json({ success: true, backfilled: totalAdded, users: Object.keys(byUser).length });
}
