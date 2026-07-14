import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DbService } from '@/lib/supabase-service';
import { checkAndPromote } from '@/lib/promote';
import { cacheDelete } from '@/lib/api-cache';

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

    for (const ur of stale) {
        const history: any[] = ur.history || [];

        // Find the pending entry and approve it
        const pendingIdx = history.findIndex((e: any) => e.id === ur.pending_id);
        if (pendingIdx > -1) {
            history[pendingIdx].status = 'approve';
            history[pendingIdx].reviewed_at = now;
            history[pendingIdx].points_awarded = 50;
        }

        // Use the entry's date (stored in user's timezone at submission time)
        // This ensures streaks work regardless of cron timing or user timezone
        const entryDate = pendingIdx > -1 ? history[pendingIdx].date : null;
        const approvedDate = entryDate || new Date().toISOString().split('T')[0];

        // Calculate streak using user-tz dates (entry.date + last_approved_date are both in user's tz)
        const lastApproved = ur.last_approved_date;
        let newStreak = 1;
        if (lastApproved && approvedDate) {
            const last = new Date(lastApproved + 'T12:00:00');
            const current = new Date(approvedDate + 'T12:00:00');
            const diffDays = Math.round((current.getTime() - last.getTime()) / (86400000));
            if (diffDays === 0 || diffDays === 1) {
                newStreak = (ur.current_streak || 0) + 1;
            }
        }
        const newBest = Math.max(newStreak, ur.best_streak || 0);

        await supabaseAdmin
            .from('user_routines')
            .update({
                history,
                current_streak: newStreak,
                best_streak: newBest,
                last_approved_date: approvedDate,
                pending_id: null,
                pending_proof_url: null,
                pending_proof_type: null,
                pending_thumbnail_url: null,
                pending_submitted_at: null,
                updated_at: now,
            })
            .eq('member_id', ur.member_id);

        // Bust routine-status cache so next fetch returns approved
        cacheDelete(`routine:${ur.member_id.toLowerCase()}`);

        // Award points (same as manual approval)
        try {
            await DbService.awardPoints(ur.member_id, 50);
        } catch (_) { }

        // Update profiles.parameters for backward compat + notify member
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

                // Send TASK_REVIEW_CARD so it shows in chat + Record tab
                const thumb = ur.pending_thumbnail_url || ur.pending_proof_url || null;
                const cardData = { status: 'approve', points: 50, type: 'routine', taskText: ur.routine_name || 'Daily Routine', thumbnail: thumb };
                try { await DbService.sendMessage(prof.ID, `TASK_REVIEW_CARD::${JSON.stringify(cardData)}`, 'system'); } catch (_) { }

                // Broadcast to profile page so UI updates from "SUBMITTED" to "DONE"
                const ch = supabaseAdmin.channel(`member-notify-${prof.ID}`);
                await ch.subscribe();
                await ch.send({ type: 'broadcast', event: 'routine_approved', payload: {} });
                setTimeout(() => supabaseAdmin.removeChannel(ch), 1500);
            }
        } catch (_) { }

        // Check if user now qualifies for promotion
        checkAndPromote(ur.member_id).catch(() => {});
    }

    // ── AUTO-APPROVE VAULT CHASTITY CHECKS (from Taskdom_History) ──
    let chastityApproved = 0;
    try {
        const { data: taskRows } = await supabaseAdmin.from('tasks').select('member_id, "Taskdom_History"');
        for (const row of (taskRows || [])) {
            let history: any[] = [];
            try { history = typeof row.Taskdom_History === 'string' ? JSON.parse(row.Taskdom_History || '[]') : (row.Taskdom_History || []); } catch { continue; }
            let changed = false;
            for (const entry of history) {
                if (entry.status === 'pending' && entry.text === 'Chastity Check' && entry.timestamp) {
                    const age = Date.now() - new Date(entry.timestamp).getTime();
                    if (age > 2 * 60 * 60 * 1000) {
                        entry.status = 'approve';
                        entry.completed = true;
                        entry.reviewed_at = now;
                        changed = true;
                        chastityApproved++;

                        // Also mark vault_daily order as done
                        try {
                            const email = row.member_id.toLowerCase();
                            const { data: sess } = await supabaseAdmin.from('vault_sessions')
                                .select('id').eq('member_id', email).eq('status', 'active').limit(1).maybeSingle();
                            if (sess) {
                                const today = new Date().toISOString().split('T')[0];
                                const { data: daily } = await supabaseAdmin.from('vault_daily')
                                    .select('id, orders, orders_completed, orders_total')
                                    .eq('session_id', sess.id).eq('date', today).maybeSingle();
                                if (daily) {
                                    const orders: any[] = typeof daily.orders === 'string' ? JSON.parse(daily.orders) : (daily.orders || []);
                                    for (const o of orders) {
                                        if (o.type === 'chastity_check') { o.done = o.target; o.status = 'approved'; break; }
                                    }
                                    const completed = orders.filter((o: any) => o.done >= o.target).length;
                                    await supabaseAdmin.from('vault_daily').update({
                                        orders: JSON.stringify(orders),
                                        orders_completed: completed,
                                        perfect: completed >= orders.length,
                                    }).eq('id', daily.id);
                                }
                            }
                        } catch (_) {}
                    }
                }
            }
            if (changed) {
                await supabaseAdmin.from('tasks').update({ 'Taskdom_History': JSON.stringify(history) }).eq('member_id', row.member_id);
            }
        }
    } catch (err: any) {
        console.error('[cron/auto-approve] chastity error:', err.message);
    }

    console.log(`[cron/auto-approve] Auto-approved ${stale.length} routines, ${chastityApproved} chastity checks`);
    return NextResponse.json({ success: true, approved: stale.length, chastityApproved });
}
