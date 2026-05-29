import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkAndPromote } from '@/lib/promote';

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

    // Find all user_routines with a pending submission older than 2 hours
    const { data: stale, error: fetchErr } = await supabaseAdmin
        .from('user_routines')
        .select('*')
        .not('pending_id', 'is', null)
        .lt('pending_submitted_at', twoHoursAgo);

    if (fetchErr) {
        console.error('[cron/auto-approve] fetch error:', fetchErr.message);
        return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    if (!stale || stale.length === 0) {
        return NextResponse.json({ success: true, approved: 0 });
    }

    const now = new Date().toISOString();
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    for (const ur of stale) {
        const history: any[] = ur.history || [];

        // Find the pending entry and approve it
        const pendingIdx = history.findIndex((e: any) => e.id === ur.pending_id);
        if (pendingIdx > -1) {
            history[pendingIdx].status = 'approve';
            history[pendingIdx].reviewed_at = now;
            history[pendingIdx].points_awarded = 50;
        }

        // Calculate streak
        const lastApproved = ur.last_approved_date;
        let newStreak = 1;
        if (lastApproved === yesterdayStr || lastApproved === todayStr) {
            newStreak = (ur.current_streak || 0) + 1;
        }
        const newBest = Math.max(newStreak, ur.best_streak || 0);

        await supabaseAdmin
            .from('user_routines')
            .update({
                history,
                current_streak: newStreak,
                best_streak: newBest,
                last_approved_date: todayStr,
                pending_id: null,
                pending_proof_url: null,
                pending_proof_type: null,
                pending_thumbnail_url: null,
                pending_submitted_at: null,
                updated_at: now,
            })
            .eq('member_id', ur.member_id);

        // Update profiles.parameters for backward compat
        try {
            const { data: prof } = await supabaseAdmin
                .from('profiles')
                .select('ID, parameters')
                .ilike('member_id', ur.member_id)
                .maybeSingle();
            if (prof) {
                const params = prof.parameters || {};
                params.consistency = newStreak;
                params.routine_streak = newBest;
                params.taskdom_current_streak = newStreak;
                await supabaseAdmin.from('profiles').update({ parameters: params }).eq('ID', prof.ID);
            }
        } catch (_) { }

        // Check if user now qualifies for promotion
        checkAndPromote(ur.member_id).catch(() => {});
    }

    console.log(`[cron/auto-approve] Auto-approved ${stale.length} routines`);
    return NextResponse.json({ success: true, approved: stale.length });
}
