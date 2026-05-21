import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DbService } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

// Runs every 30 minutes — auto-approves pending routines older than 2 hours
export async function GET(req: Request) {
    const envSecret = (process.env.CRON_SECRET || '').trim();
    if (envSecret) {
        const authHeader = req.headers.get('authorization') || '';
        const incoming = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
        if (incoming !== envSecret) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    // Find all pending routines submitted more than 2 hours ago
    const { data: stale, error: fetchErr } = await supabaseAdmin
        .from('routines')
        .select('id, member_id, proof_url, proof_type, thumbnail_url, submitted_at')
        .eq('status', 'pending')
        .lt('submitted_at', twoHoursAgo);

    if (fetchErr) {
        console.error('[cron/auto-approve] fetch error:', fetchErr.message);
        return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    if (!stale || stale.length === 0) {
        return NextResponse.json({ success: true, approved: 0 });
    }

    // Batch-update all stale routines to approved
    const ids = stale.map((r: any) => r.id);
    const { error: updateErr } = await supabaseAdmin
        .from('routines')
        .update({ status: 'approve', reviewed_at: new Date().toISOString() })
        .in('id', ids);

    if (updateErr) {
        console.error('[cron/auto-approve] update error:', updateErr.message);
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Update Taskdom_History in tasks table so record page shows approved routines
    const routinesByUser: Record<string, any[]> = {};
    for (const r of stale) {
        if (!routinesByUser[r.member_id]) routinesByUser[r.member_id] = [];
        routinesByUser[r.member_id].push(r);
    }
    for (const [email, routines] of Object.entries(routinesByUser)) {
        try {
            const { data: taskRow } = await supabaseAdmin
                .from('tasks')
                .select('ID, "Taskdom_History"')
                .ilike('member_id', email)
                .maybeSingle();
            if (taskRow) {
                let history: any[] = [];
                try { history = typeof taskRow['Taskdom_History'] === 'string' ? JSON.parse(taskRow['Taskdom_History']) : (taskRow['Taskdom_History'] || []); } catch { history = []; }
                for (const r of routines) {
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
                }
                await supabaseAdmin.from('tasks').update({ 'Taskdom_History': JSON.stringify(history) }).eq('ID', taskRow.ID);
            }
        } catch (e) { console.warn('[cron/auto-approve] history update error for', email, e); }
    }

    // Recalculate consistency for each affected user
    const uniqueEmails = [...new Set(stale.map((r: any) => r.member_id as string))];
    for (const email of uniqueEmails) {
        try { await DbService.recalcConsistency(email as string); } catch (e) { console.warn('[cron/auto-approve] recalc error for', email, e); }
    }

    console.log(`[cron/auto-approve] Auto-approved ${ids.length} routines for ${uniqueEmails.length} users`);
    return NextResponse.json({ success: true, approved: ids.length, users: uniqueEmails.length });
}
