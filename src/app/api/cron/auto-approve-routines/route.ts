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

    // ── AUTO-APPROVE VAULT CHASTITY CHECKS (from vault_check_log table) ──
    let chastityApproved = 0;
    try {
        const { data: pendingChecks } = await supabaseAdmin
            .from('vault_check_log')
            .select('*')
            .eq('status', 'pending')
            .lt('submitted_at', twoHoursAgo);

        for (const chk of (pendingChecks || [])) {
            // Update vault_check_log
            await supabaseAdmin.from('vault_check_log').update({
                status: 'approved',
                reviewed_at: now,
            }).eq('id', chk.id);

            // Sync vault_daily order
            try {
                const { data: daily } = await supabaseAdmin.from('vault_daily')
                    .select('id, session_id, orders, orders_completed, orders_total')
                    .eq('session_id', chk.session_id).eq('date', chk.date).maybeSingle();
                if (daily) {
                    const orders: any[] = typeof daily.orders === 'string' ? JSON.parse(daily.orders) : (daily.orders || []);
                    for (const o of orders) {
                        if (o.type === 'chastity_check') { o.done = o.target; break; }
                    }
                    const completed = orders.filter((o: any) => o.done >= o.target).length;
                    const perfect = completed >= orders.length;
                    await supabaseAdmin.from('vault_daily').update({
                        orders: JSON.stringify(orders), orders_completed: completed, perfect,
                    }).eq('id', daily.id);

                    if (perfect) {
                        const { data: sess } = await supabaseAdmin.from('vault_sessions')
                            .select('current_streak, best_streak, total_perfect_days').eq('id', chk.session_id).single();
                        if (sess) {
                            const ns = (sess.current_streak || 0) + 1;
                            await supabaseAdmin.from('vault_sessions').update({
                                current_streak: ns, best_streak: Math.max(sess.best_streak || 0, ns),
                                total_perfect_days: (sess.total_perfect_days || 0) + 1,
                            }).eq('id', chk.session_id);
                        }
                    }
                }
            } catch (_) {}

            chastityApproved++;
        }
    } catch (err: any) {
        console.error('[cron/auto-approve] chastity error:', err.message);
    }

    // ── AUTO-APPROVE VAULT TASK SUBMISSIONS (from vault_submissions table) ──
    let tasksApproved = 0;
    try {
        const { data: pendingSubs } = await supabaseAdmin
            .from('vault_submissions')
            .select('*')
            .eq('status', 'pending')
            .lt('submitted_at', twoHoursAgo);

        for (const sub of (pendingSubs || [])) {
            await supabaseAdmin.from('vault_submissions').update({
                status: 'approved',
                reviewed_at: now,
            }).eq('id', sub.id);

            // Update order done count in vault_daily
            try {
                const { data: daily } = await supabaseAdmin.from('vault_daily')
                    .select('id, orders, orders_completed, orders_total')
                    .eq('session_id', sub.session_id).eq('date', sub.date).maybeSingle();
                if (daily) {
                    const orders: any[] = typeof daily.orders === 'string' ? JSON.parse(daily.orders) : (daily.orders || []);
                    if (sub.order_idx != null && orders[sub.order_idx]) {
                        orders[sub.order_idx].done = orders[sub.order_idx].target;
                    }
                    const completed = orders.filter((o: any) => o.done >= o.target).length;
                    const perfect = completed >= orders.length;
                    await supabaseAdmin.from('vault_daily').update({
                        orders: JSON.stringify(orders), orders_completed: completed, perfect,
                    }).eq('id', daily.id);

                    if (perfect) {
                        const { data: sess } = await supabaseAdmin.from('vault_sessions')
                            .select('current_streak, best_streak, total_perfect_days').eq('id', sub.session_id).single();
                        if (sess) {
                            const ns = (sess.current_streak || 0) + 1;
                            await supabaseAdmin.from('vault_sessions').update({
                                current_streak: ns, best_streak: Math.max(sess.best_streak || 0, ns),
                                total_perfect_days: (sess.total_perfect_days || 0) + 1,
                            }).eq('id', sub.session_id);
                        }
                    }
                }
            } catch (_) {}

            tasksApproved++;
        }
    } catch (err: any) {
        console.error('[cron/auto-approve] vault tasks error:', err.message);
    }

    // ── 6 AM CHASTITY CHECK REMINDER (push notification) ──
    // Cron runs every 30 min. For each active vault session, check if it's ~6 AM
    // in the member's saved timezone. If so, send a push reminder.
    let reminders = 0;
    try {
        const { data: activeSessions } = await supabaseAdmin
            .from('vault_sessions')
            .select('id, member_id')
            .eq('status', 'active');

        for (const sess of (activeSessions || [])) {
            try {
                const { data: prof } = await supabaseAdmin.from('profiles')
                    .select('timezone').ilike('member_id', sess.member_id).maybeSingle();
                const tz = prof?.timezone || 'UTC';

                // Get current hour in member's timezone
                const localHour = parseInt(new Intl.DateTimeFormat('en', { timeZone: tz, hour: '2-digit', hour12: false }).format(new Date()), 10);
                const localMinute = parseInt(new Intl.DateTimeFormat('en', { timeZone: tz, minute: '2-digit' }).format(new Date()), 10);

                // Send at 6:00-6:59 (cron runs every 30 min — widened window ensures at least one hit)
                if (localHour === 6) {
                    // Check they haven't already submitted today
                    const todayLocal = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date()); // YYYY-MM-DD
                    const { data: existing } = await supabaseAdmin.from('vault_check_log')
                        .select('id').eq('session_id', sess.id).eq('date', todayLocal).eq('type', 'chastity_check').maybeSingle();

                    if (!existing) {
                        const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '761d91da-b098-44a7-8d98-75c1cce54dd0';
                        const ONESIGNAL_KEY = process.env.ONESIGNAL_REST_API_KEY;
                        if (ONESIGNAL_KEY) {
                            fetch('https://api.onesignal.com/notifications', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', Authorization: `Key ${ONESIGNAL_KEY}` },
                                body: JSON.stringify({
                                    app_id: ONESIGNAL_APP_ID,
                                    target_channel: 'push',
                                    include_aliases: { external_id: [sess.member_id.toLowerCase()] },
                                    headings: { en: 'Chastity Check Time' },
                                    subtitle: { en: 'Vault' },
                                    contents: { en: 'Your chastity check window is open. Submit your proof now.' },
                                    url: 'https://throne.qkarin.com/vault',
                                }),
                            }).catch(() => {});
                            reminders++;
                        }
                    }
                }
            } catch (_) {}
        }
    } catch (err: any) {
        console.error('[cron/auto-approve] reminder error:', err.message);
    }

    console.log(`[cron/auto-approve] Auto-approved ${stale.length} routines, ${chastityApproved} chastity checks, ${tasksApproved} vault tasks, ${reminders} reminders sent`);
    return NextResponse.json({ success: true, approved: stale.length, chastityApproved, tasksApproved, reminders });
}
