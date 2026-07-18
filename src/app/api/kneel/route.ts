// src/app/api/kneel/route.ts
// Handles kneeling submission - updates tasks table (lastWorship, kneelCount, "today kneeling")
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DbService } from '@/lib/supabase-service';
import { checkAndPromote } from '@/lib/promote';
import { getCaller, isOwnerOrCEO } from '@/lib/api-auth';

export const dynamic = "force-dynamic";

const COOLDOWN_MS = process.env.NODE_ENV === 'development' ? 60 * 1000 : 60 * 60 * 1000; // 1 min dev / 60 min prod

const TASK_FIELDS = '"ID", lastWorship, kneelCount, "today kneeling", kneel_history, member_id, "Score", "Daily Score", "Weekly Score", "Monthly Score", "Yearly Score"';

// Resolve the tasks row. Returns { task, taskId (UUID), taskEmail }.
// When found by email fallback, auto-fixes the task ID to match the profile UUID
// so we never create duplicate rows with NULL scores.
async function getTaskRow(memberId: string): Promise<{ task: any; taskId: string; taskEmail: string }> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);

    if (isUuid) {
        // Try by ID (UUID primary key)
        const { data } = await supabaseAdmin.from('tasks').select(TASK_FIELDS).eq('ID', memberId).maybeSingle();
        if (data) return { task: data, taskId: memberId, taskEmail: data.member_id || '' };

        // Fall back: get email from profile, then find task by email
        const { data: profile } = await supabaseAdmin.from('profiles').select('member_id').eq('ID', memberId).maybeSingle();
        if (profile?.member_id) {
            const { data: row } = await supabaseAdmin.from('tasks').select(TASK_FIELDS).ilike('member_id', profile.member_id).maybeSingle();
            if (row) {
                // FIX ID MISMATCH: update the task row's ID to match the profile UUID
                // so future lookups find it directly and we never create duplicates
                if (row.ID !== memberId) {
                    console.log(`[kneel] Fixing tasks ID mismatch: ${row.ID} → ${memberId} for ${profile.member_id}`);
                    await supabaseAdmin.from('tasks').update({ ID: memberId }).eq('ID', row.ID);
                    row.ID = memberId;
                }
                return { task: row, taskId: memberId, taskEmail: profile.member_id };
            }
        }
        return { task: null, taskId: memberId, taskEmail: profile?.member_id || '' };
    } else {
        // Email lookup
        const { data } = await supabaseAdmin.from('tasks').select(TASK_FIELDS).ilike('member_id', memberId).maybeSingle();
        const { data: profile } = await supabaseAdmin.from('profiles').select('ID').ilike('member_id', memberId).maybeSingle();
        return { task: data || null, taskId: data?.ID || profile?.ID || '', taskEmail: memberId };
    }
}

export async function POST(req: Request) {
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { memberId, tz = 'UTC' } = await req.json();
        if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 });

        if (!isOwnerOrCEO(caller, memberId)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Fetch current record
        const { task, taskId, taskEmail } = await getTaskRow(memberId);

        const now = new Date();
        const nowMs = now.getTime();

        // Cooldown check
        if (task?.lastWorship) {
            const lastMs = new Date(task.lastWorship).getTime();
            if (nowMs - lastMs < COOLDOWN_MS) {
                const minLeft = Math.ceil((COOLDOWN_MS - (nowMs - lastMs)) / 60000);
                return NextResponse.json({ error: 'COOLDOWN', minLeft }, { status: 429 });
            }
        }

        // Chastity check gate: vault members MUST submit today's chastity check before kneeling
        // Gate applies after 10 AM local (submission window 6-10 AM has closed)
        try {
            const localHour = parseInt(
                new Intl.DateTimeFormat('en', { timeZone: tz, hour: '2-digit', hour12: false }).format(now),
                10
            );
            if (localHour >= 10) {
                const emailCheck = (taskEmail || memberId).toLowerCase();
                const todayCheckStr = now.toLocaleDateString('en-CA', { timeZone: tz });
                // Find active vault session
                const { data: vs } = await supabaseAdmin
                    .from('vault_sessions')
                    .select('id')
                    .eq('member_id', emailCheck)
                    .eq('status', 'active')
                    .order('started_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (vs) {
                    // Universal gate: must have submitted chastity check today (pending or approved)
                    const { data: checkLog } = await supabaseAdmin
                        .from('vault_check_log')
                        .select('status')
                        .eq('session_id', vs.id)
                        .eq('date', todayCheckStr)
                        .eq('type', 'chastity_check')
                        .maybeSingle();
                    if (!checkLog || checkLog.status === 'rejected') {
                        return NextResponse.json({ error: 'CHASTITY_REQUIRED' }, { status: 403 });
                    }
                }
            }
        } catch (_) {}

        // Calculate today kneeling (reset at midnight in user's local timezone)
        const todayStr = now.toLocaleDateString('en-CA', { timeZone: tz });
        const lastWorshipStr = task?.lastWorship
            ? new Date(task.lastWorship).toLocaleDateString('en-CA', { timeZone: tz })
            : null;

        const isSameDay = lastWorshipStr === todayStr;
        const prevToday = parseInt(task?.['today kneeling'] || '0', 10);
        const newTodayKneeling = isSameDay ? prevToday + 1 : 1;
        const newKneelCount = parseInt(task?.kneelCount || '0', 10) + 1;

        // Build updated kneel_history: keep today's entries + append new
        let kneelHistory: string[] = [];
        try {
            const raw = (task as any)?.kneel_history;
            const parsed: string[] = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : []);
            kneelHistory = parsed.filter((ts: string) => {
                try { return new Date(ts).toLocaleDateString('en-CA', { timeZone: tz }) === todayStr; } catch { return false; }
            });
        } catch (_) { }
        kneelHistory.push(now.toISOString());

        // Upsert by ID (UUID primary key)
        // IMPORTANT: include score columns from existing row so INSERT never creates NULL scores
        const upsertPayload: any = {
            ID: taskId,
            member_id: taskEmail,
            lastWorship: now.toISOString(),
            kneelCount: String(newKneelCount),
            'today kneeling': String(newTodayKneeling),
            'Score': task?.['Score'] ?? 0,
            'Daily Score': task?.['Daily Score'] ?? 0,
            'Weekly Score': task?.['Weekly Score'] ?? 0,
            'Monthly Score': task?.['Monthly Score'] ?? 0,
            'Yearly Score': task?.['Yearly Score'] ?? 0,
        };

        if (kneelHistory.length > 0) upsertPayload.kneel_history = kneelHistory;

        const { error } = await supabaseAdmin
            .from('tasks')
            .upsert(upsertPayload, { onConflict: '"ID"' });

        if (error) {
            console.error('[kneel] update error:', error);
            const { error: e2 } = await supabaseAdmin.from('tasks').upsert({
                ID: taskId,
                member_id: taskEmail,
                lastWorship: now.toISOString(),
                kneelCount: String(newKneelCount),
                'today kneeling': String(newTodayKneeling),
                'Score': task?.['Score'] ?? 0,
                'Daily Score': task?.['Daily Score'] ?? 0,
                'Weekly Score': task?.['Weekly Score'] ?? 0,
                'Monthly Score': task?.['Monthly Score'] ?? 0,
                'Yearly Score': task?.['Yearly Score'] ?? 0,
            }, { onConflict: '"ID"' });
            if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
        }

        // Mark reward as claimable (prevents direct API abuse)
        try {
            const { data: prof } = await supabaseAdmin.from('profiles').select('ID, parameters').ilike('member_id', taskEmail).maybeSingle();
            if (prof) {
                const params = prof.parameters || {};
                params.reward_pending = true;
                await supabaseAdmin.from('profiles').update({ parameters: params }).eq('ID', prof.ID);
            }
        } catch (_) {}

        // Sync kneel count to vault_daily orders (so kneeling counts toward perfect day)
        try {
            const emailLc = (taskEmail || memberId).toLowerCase();
            const { data: vaultSession } = await supabaseAdmin.from('vault_sessions')
                .select('id').eq('member_id', emailLc).eq('status', 'active')
                .order('started_at', { ascending: false }).limit(1).maybeSingle();
            if (vaultSession) {
                const { data: daily } = await supabaseAdmin.from('vault_daily')
                    .select('id, orders, orders_completed, orders_total')
                    .eq('session_id', vaultSession.id).eq('date', todayStr).maybeSingle();
                if (daily) {
                    const orders: any[] = typeof daily.orders === 'string' ? JSON.parse(daily.orders) : (daily.orders || []);
                    let changed = false;
                    for (const o of orders) {
                        if (o.type === 'kneel' && newTodayKneeling > (o.done || 0)) {
                            o.done = Math.min(newTodayKneeling, o.target);
                            changed = true;
                            break;
                        }
                    }
                    if (changed) {
                        const completed = orders.filter((o: any) => o.done >= o.target).length;
                        const perfect = completed >= orders.length;
                        await supabaseAdmin.from('vault_daily').update({
                            orders: JSON.stringify(orders),
                            orders_completed: completed,
                            perfect,
                        }).eq('id', daily.id);
                        // Update session streak if day just became perfect
                        if (perfect && !daily.orders_completed) {
                            const { data: sess } = await supabaseAdmin.from('vault_sessions')
                                .select('current_streak, best_streak, total_perfect_days')
                                .eq('id', vaultSession.id).single();
                            if (sess) {
                                const newStreak = (sess.current_streak || 0) + 1;
                                await supabaseAdmin.from('vault_sessions').update({
                                    current_streak: newStreak,
                                    best_streak: Math.max(sess.best_streak || 0, newStreak),
                                    total_perfect_days: (sess.total_perfect_days || 0) + 1,
                                }).eq('id', vaultSession.id);
                            }
                        }
                    }
                }
            }
        } catch (_) {}

        try { await DbService.sendMessage(memberId, 'KNEELING SESSION COMPLETED', 'system'); } catch (_) { }

        // Check if user now qualifies for promotion
        checkAndPromote(memberId).catch(() => {});

        // Push notification: schedule for when cooldown expires (1 hour later)
        try {
            const email = taskEmail || memberId;
            const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '761d91da-b098-44a7-8d98-75c1cce54dd0';
            const apiKey = process.env.ONESIGNAL_REST_API_KEY;
            if (apiKey && email) {
                const { data: prof } = await supabaseAdmin.from('profiles').select('name').ilike('member_id', email).maybeSingle();
                const name = prof?.name || email.split('@')[0];
                const sendAfter = new Date(nowMs + COOLDOWN_MS).toISOString();
                fetch('https://api.onesignal.com/notifications', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${apiKey}` },
                    body: JSON.stringify({
                        app_id: appId,
                        target_channel: 'push',
                        include_aliases: { external_id: [email.toLowerCase()] },
                        headings: { en: `🔔 Time to kneel!` },
                        contents: { en: `${name}, get back on your knees!` },
                        url: 'https://throne.qkarin.com/profile',
                        send_after: sendAfter,
                    }),
                }).catch(() => {});
            }
        } catch (_) { }

        // Return which hours today had a kneel (for dot grid)
        const kneelHours = [...new Set(kneelHistory.map(ts => {
            try {
                const h = parseInt(new Date(ts).toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false }), 10);
                return h === 24 ? 0 : h;
            } catch { return -1; }
        }).filter(h => h >= 0))];

        return NextResponse.json({
            success: true,
            kneelCount: newKneelCount,
            todayKneeling: newTodayKneeling,
            kneelHours,
        });
    } catch (err: any) {
        console.error('[kneel] unexpected error:', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
