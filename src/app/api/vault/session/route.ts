import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCaller, isCEO, isOwnerOrCEO } from '@/lib/api-auth';
import { defaultDayTasks, generateDefaultProgram } from '@/lib/vault-program-defaults';

export const dynamic = 'force-dynamic';

// GET /api/vault/session?memberId=xxx
// Returns full vault state: active session, today's orders, daily history, adjustments, spins, trials
export async function GET(req: NextRequest) {
    const caller = await getCaller();
    const host = req.headers.get('host') || '';
    const isLocal = host.includes('localhost');

    if (!caller && !isLocal) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const memberId = req.nextUrl.searchParams.get('memberId');
    let tz = req.nextUrl.searchParams.get('tz') || '';
    if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 });

    // Resolve UUID → email if needed (vault_sessions stores email as member_id)
    let email = memberId.toLowerCase();
    let savedTz = '';
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(email);
    if (isUuid) {
        const { data: prof } = await supabaseAdmin.from('profiles').select('member_id, timezone').eq('ID', email).maybeSingle();
        if (prof?.member_id) email = prof.member_id.toLowerCase();
        if (prof?.timezone) savedTz = prof.timezone;
    } else {
        const { data: prof } = await supabaseAdmin.from('profiles').select('timezone').ilike('member_id', email).maybeSingle();
        if (prof?.timezone) savedTz = prof.timezone;
    }
    // Use client tz if provided, fall back to saved profile timezone (same as routine-status)
    if (!tz) tz = savedTz || 'UTC';
    // Save timezone only when client sends a new one that differs from saved
    if (tz !== 'UTC' && tz !== savedTz) {
        supabaseAdmin.from('profiles').update({ timezone: tz }).ilike('member_id', email).then(() => {}).catch(() => {});
    }

    // 1. Get active session
    const { data: session } = await supabaseAdmin
        .from('vault_sessions')
        .select('*')
        .eq('member_id', email)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!session) {
        // Check if there's a recently released/ended session (for polling detection)
        const { data: releasedSession } = await supabaseAdmin
            .from('vault_sessions')
            .select('id, status, release_reason')
            .eq('member_id', email)
            .in('status', ['released_early', 'completed', 'denied', 'ended'])
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        return NextResponse.json({
            active: false,
            ...(releasedSession ? { session: releasedSession } : {}),
        });
    }

    // 2. Get all daily records for this session
    const { data: dailyRecords } = await supabaseAdmin
        .from('vault_daily')
        .select('*')
        .eq('session_id', session.id)
        .order('day_number', { ascending: true });

    // 3. Get today's record — auto-create if missing
    const today = new Date().toISOString().split('T')[0];
    let todayRecord = (dailyRecords || []).find((d: any) => d.date === today);

    if (!todayRecord && session) {
        const startDate2 = new Date(session.started_at);
        const daysIn2 = Math.floor((Date.now() - startDate2.getTime()) / 86400000) + 1;
        const orders = await _getOrdersForDay(session.id, daysIn2);
        const { data: inserted, error: insertErr } = await supabaseAdmin.from('vault_daily').insert({
            session_id: session.id,
            member_id: email,
            day_number: daysIn2,
            date: today,
            orders: JSON.stringify(orders),
            orders_total: orders.length,
        }).select('*').single();
        if (inserted) {
            todayRecord = inserted;
            (dailyRecords || []).push(inserted);
        } else if (insertErr) {
            // Duplicate — row exists but wasn't found (race condition), re-fetch
            console.error('[vault/session] insert daily error:', insertErr.message);
            const { data: existing } = await supabaseAdmin.from('vault_daily')
                .select('*').eq('session_id', session.id).eq('date', today).maybeSingle();
            if (existing) todayRecord = existing;
        }
    }

    // Sync today's orders with the current program (handles program edits after daily row was created)
    if (todayRecord && session) {
        const currentOrders: any[] = typeof todayRecord.orders === 'string' ? JSON.parse(todayRecord.orders) : (todayRecord.orders || []);
        const startDate3 = new Date(session.started_at);
        const daysIn3 = Math.floor((Date.now() - startDate3.getTime()) / 86400000) + 1;
        const programOrders = await _getOrdersForDay(session.id, daysIn3);

        // Compare types + targets + labels to catch any program edits
        const programSig = programOrders.map((o: any) => `${o.type}:${o.target}:${o.label || ''}`).sort().join('|');
        const currentSig = currentOrders.map((o: any) => `${o.type}:${o.target}:${o.label || ''}`).sort().join('|');

        if (programSig !== currentSig) {
            // Merge: keep done counts for tasks that still exist, add new ones, remove old ones
            const merged = programOrders.map((po: any) => {
                const existing = currentOrders.find((co: any) => co.type === po.type);
                return existing ? { ...po, done: existing.done } : po;
            });
            const completed = merged.filter((o: any) => o.done >= o.target).length;
            await supabaseAdmin.from('vault_daily').update({
                orders: JSON.stringify(merged),
                orders_total: merged.length,
                orders_completed: completed,
            }).eq('id', todayRecord.id);
            todayRecord = { ...todayRecord, orders: JSON.stringify(merged), orders_total: merged.length, orders_completed: completed };
        }
    }

    // 4. Get adjustments log
    const { data: adjustments } = await supabaseAdmin
        .from('vault_adjustments')
        .select('*')
        .eq('session_id', session.id)
        .order('created_at', { ascending: true });

    // 5. Get spins for this session
    const { data: spins } = await supabaseAdmin
        .from('vault_spins')
        .select('*')
        .eq('session_id', session.id)
        .order('date', { ascending: true });

    // 6. Get trials for this session
    const { data: trials } = await supabaseAdmin
        .from('vault_trials')
        .select('*')
        .eq('session_id', session.id)
        .order('date', { ascending: true });

    // 7. Get begs
    const { data: begs } = await supabaseAdmin
        .from('vault_begs')
        .select('*')
        .eq('session_id', session.id)
        .order('created_at', { ascending: true });

    // 8. Today's spin check
    const todaySpin = (spins || []).find((s: any) => s.date === today);

    // 9. Calculate days in
    const startDate = new Date(session.started_at);
    const now = new Date();
    const daysIn = Math.floor((now.getTime() - startDate.getTime()) / 86400000);

    // 10. Calculate total penalty hours
    const totalPenaltyHours = (adjustments || []).reduce((sum: number, a: any) => sum + a.hours, 0);

    // Calculate chastity check window (6-10 AM in member's local time)
    let chastityWindow: { open: boolean; before: boolean; localHour: number; localMinute: number } = { open: false, before: false, localHour: 0, localMinute: 0 };
    try {
        const localHour = parseInt(new Intl.DateTimeFormat('en', { timeZone: tz, hour: '2-digit', hour12: false }).format(new Date()), 10);
        const localMinute = parseInt(new Intl.DateTimeFormat('en', { timeZone: tz, minute: '2-digit' }).format(new Date()), 10);
        chastityWindow = { open: localHour >= 6 && localHour < 10, before: localHour < 6, localHour, localMinute };
    } catch (_) {}

    // Read chastity check from vault_check_log (proper table)
    const { data: chastityCheck } = await supabaseAdmin.from('vault_check_log')
        .select('*').eq('session_id', session.id).eq('date', today).eq('type', 'chastity_check').maybeSingle();

    // Read ALL chastity check logs for this session (for dashboard history)
    const { data: allChastityChecks } = await supabaseAdmin.from('vault_check_log')
        .select('*').eq('session_id', session.id).eq('type', 'chastity_check').order('date', { ascending: true });

    // Read today's task submissions from vault_submissions table
    let todaySubmissions: any[] = [];
    let allSubmissions: any[] = [];
    try {
        const { data: ts, error: tsErr } = await supabaseAdmin.from('vault_submissions')
            .select('*').eq('session_id', session.id).eq('date', today).order('submitted_at', { ascending: true });
        if (tsErr) console.error('[vault] submissions read error:', tsErr.message);
        else todaySubmissions = ts || [];

        // Read ALL task submissions for this session (for dashboard history)
        const { data: as2, error: asErr } = await supabaseAdmin.from('vault_submissions')
            .select('*').eq('session_id', session.id).order('submitted_at', { ascending: true });
        if (asErr) console.error('[vault] all submissions read error:', asErr.message);
        else allSubmissions = as2 || [];
    } catch (e: any) {
        console.error('[vault] submissions table error:', e?.message);
    }

    // Read program directly (same source as dashboard's /api/vault/program)
    let programTasks: any[] | null = null;
    try {
        const startDateP = new Date(session.started_at);
        const dayNum = Math.floor((Date.now() - startDateP.getTime()) / 86400000) + 1;
        const { data: progRow } = await supabaseAdmin
            .from('vault_member_program')
            .select('id, program')
            .eq('session_id', session.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        let prog: Record<string, any[]> | null = null;
        if (progRow?.program) {
            prog = typeof progRow.program === 'string' ? JSON.parse(progRow.program) : progRow.program;
        }

        // Auto-regenerate if program is missing or uses stale/old task types (no config on any day-1 task)
        const day1 = prog?.['1'];
        const isStale = !prog || !day1 || day1.length === 0 || !day1.some((t: any) => t.config);
        if (isStale) {
            console.log(`[vault] Program stale or missing for session ${session.id}, regenerating from template...`);
            const freshProgram = await _generateFullProgram();
            // Update DB
            if (progRow?.id) {
                await supabaseAdmin.from('vault_member_program').update({
                    program: JSON.stringify(freshProgram),
                }).eq('id', progRow.id);
            } else {
                await supabaseAdmin.from('vault_member_program').insert({
                    session_id: session.id,
                    member_id: email,
                    program: JSON.stringify(freshProgram),
                });
            }
            prog = freshProgram;
            console.log(`[vault] Regenerated program, day ${dayNum} tasks:`, JSON.stringify(prog[String(dayNum)]?.map((t: any) => t.type)));
        }

        if (prog) {
            const dayData = prog[String(dayNum)];
            if (dayData && Array.isArray(dayData) && dayData.length > 0) {
                programTasks = dayData.map((t: any) => ({
                    type: t.type,
                    target: t.target || 1,
                    done: 0,
                    ...(t.label ? { label: t.label } : {}),
                    ...(t.config ? { config: t.config } : {}),
                }));
            }
        }
    } catch (e: any) { console.error('[vault] program read error:', e?.message); }

    // Merge program tasks with vault_daily done counts
    if (programTasks && todayRecord) {
        const currentOrders: any[] = todayRecord.orders
            ? (typeof todayRecord.orders === 'string' ? JSON.parse(todayRecord.orders) : todayRecord.orders)
            : [];
        programTasks = programTasks.map((pt: any) => {
            const existing = currentOrders.find((co: any) => co.type === pt.type);
            if (!existing) return pt;
            return {
                ...pt,
                done: existing.done,
                ...(existing.submitted ? { submitted: existing.submitted } : {}),
                ...(existing.submitted_at ? { submitted_at: existing.submitted_at } : {}),
                ...(existing.submitted_text ? { submitted_text: existing.submitted_text } : {}),
                ...(existing.submitted_photo ? { submitted_photo: existing.submitted_photo } : {}),
            };
        });
    }

    return NextResponse.json({
        active: true,
        session,
        daysIn,
        today: todayRecord || null,
        todayDate: today,
        dailyRecords: dailyRecords || [],
        adjustments: adjustments || [],
        spins: spins || [],
        todaySpin: todaySpin || null,
        trials: trials || [],
        begs: begs || [],
        totalPenaltyHours,
        chastityWindow,
        chastityCheck: chastityCheck || null,
        chastityLog: allChastityChecks || [],
        submissions: todaySubmissions || [],
        allSubmissions: allSubmissions || [],
        programTasks,
    });
}

// POST /api/vault/session
// Actions: create, adjust, spin, trial, beg, complete_order, claim_reward
export async function POST(req: NextRequest) {
    const caller = await getCaller();
    const host = req.headers.get('host') || '';
    const isLocal = host.includes('localhost');

    if (!caller && !isLocal) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, memberId } = body;

    if (!action || !memberId) {
        return NextResponse.json({ error: 'Missing action or memberId' }, { status: 400 });
    }

    // Resolve UUID → email if needed (vault_sessions stores email as member_id)
    let email = memberId.toLowerCase();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(email);
    if (isUuid) {
        const { data: prof } = await supabaseAdmin.from('profiles').select('member_id').eq('ID', email).maybeSingle();
        if (prof?.member_id) email = prof.member_id.toLowerCase();
    }

    // ── CREATE SESSION ──
    if (action === 'create') {
        const { tier, lockDays } = body;
        if (!tier || !lockDays) return NextResponse.json({ error: 'Missing tier or lockDays' }, { status: 400 });

        // Only admin/CEO can create sessions
        if (caller && !isCEO(caller.email) && !isLocal) {
            return NextResponse.json({ error: 'Admin only' }, { status: 403 });
        }

        // Deactivate any previous active sessions for this member
        const { data: oldSessions } = await supabaseAdmin
            .from('vault_sessions')
            .select('id')
            .eq('member_id', email)
            .in('status', ['active', 'awaiting_video']);
        if (oldSessions && oldSessions.length > 0) {
            const oldIds = oldSessions.map((s: any) => s.id);
            await supabaseAdmin
                .from('vault_sessions')
                .update({ status: 'ended' })
                .in('id', oldIds);
            // Delete old programs — fresh template copy every time
            await supabaseAdmin
                .from('vault_member_program')
                .delete()
                .in('session_id', oldIds);
        }

        const expiresAt = new Date(Date.now() + lockDays * 86400000).toISOString();

        const { data: session, error } = await supabaseAdmin
            .from('vault_sessions')
            .insert({
                member_id: email,
                tier,
                lock_days: lockDays,
                expires_at: expiresAt,
            })
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // ALWAYS copy the LATEST master template — fresh program every join
        const program = await _generateFullProgram();
        console.log(`[vault] Generated program for ${email}, day 1 tasks:`, JSON.stringify(program['1']));
        const { error: progErr } = await supabaseAdmin.from('vault_member_program').insert({
            session_id: session.id,
            member_id: email,
            program: JSON.stringify(program),
        });
        if (progErr) console.error('[vault] Failed to insert program:', progErr.message);

        // Create day 1 orders from the generated program (include label + config)
        const day1Tasks = program['1'] || [];
        const orders = day1Tasks.map((t: any) => {
            const order: any = { type: t.type, target: t.target || 1, done: 0 };
            if (t.label) order.label = t.label;
            if (t.config) order.config = t.config;
            return order;
        });
        await supabaseAdmin.from('vault_daily').insert({
            session_id: session.id,
            member_id: email,
            day_number: 1,
            date: new Date().toISOString().split('T')[0],
            orders: JSON.stringify(orders),
            orders_total: orders.length,
        });

        // Log initial adjustment
        await supabaseAdmin.from('vault_adjustments').insert({
            session_id: session.id,
            member_id: email,
            hours: lockDays * 24,
            reason: `Lock started: ${lockDays} day ${tier} sentence`,
        });

        return NextResponse.json({ success: true, session });
    }

    // ── GET ACTIVE SESSION (helper) ──
    const { data: session } = await supabaseAdmin
        .from('vault_sessions')
        .select('*')
        .eq('member_id', email)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!session) {
        return NextResponse.json({ error: 'No active session' }, { status: 404 });
    }

    // ── ADJUST TIME ──
    if (action === 'adjust') {
        const { hours, reason } = body;
        if (!hours || !reason) return NextResponse.json({ error: 'Missing hours or reason' }, { status: 400 });

        // Insert adjustment record
        const { error: adjErr } = await supabaseAdmin.from('vault_adjustments').insert({
            session_id: session.id,
            member_id: email,
            hours,
            reason,
        });
        if (adjErr) return NextResponse.json({ error: adjErr.message }, { status: 500 });

        // Update session penalty_hours and expires_at
        const newPenalty = (session.penalty_hours || 0) + hours;
        const newExpires = new Date(new Date(session.expires_at).getTime() + hours * 3600000).toISOString();

        await supabaseAdmin.from('vault_sessions').update({
            penalty_hours: newPenalty,
            expires_at: newExpires,
        }).eq('id', session.id);

        return NextResponse.json({ success: true, penaltyHours: newPenalty, expiresAt: newExpires });
    }

    // ── RECORD SPIN ──
    if (action === 'spin') {
        const { resultText, resultType } = body;
        const today = new Date().toISOString().split('T')[0];

        const { error } = await supabaseAdmin.from('vault_spins').insert({
            session_id: session.id,
            member_id: email,
            date: today,
            result_text: resultText,
            result_type: resultType,
        });

        // Update today's daily spin order if exists
        await _updateOrderDone(session.id, today, 'spin');

        if (error && error.code === '23505') {
            return NextResponse.json({ error: 'Already spun today' }, { status: 409 });
        }
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ success: true });
    }

    // ── SUBMIT TRIAL ──
    if (action === 'trial') {
        const { prompt, response, proofUrl } = body;
        const today = new Date().toISOString().split('T')[0];
        const daysIn = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 86400000) + 1;

        const { error } = await supabaseAdmin.from('vault_trials').insert({
            session_id: session.id,
            member_id: email,
            day_number: daysIn,
            date: today,
            prompt,
            response,
            proof_url: proofUrl || null,
            status: 'submitted',
            submitted_at: new Date().toISOString(),
        });

        await _updateOrderDone(session.id, today, 'trial');

        if (error && error.code === '23505') {
            return NextResponse.json({ error: 'Already submitted today' }, { status: 409 });
        }
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ success: true });
    }

    // ── SUBMIT BEG ──
    if (action === 'beg') {
        const { message } = body;
        if (!message) return NextResponse.json({ error: 'Missing message' }, { status: 400 });

        const { error } = await supabaseAdmin.from('vault_begs').insert({
            session_id: session.id,
            member_id: email,
            message,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ success: true });
    }

    // ── COMPLETE ORDER ──
    if (action === 'complete_order') {
        const { orderType, amount, photoUrl } = body;
        const today = new Date().toISOString().split('T')[0];

        // Chastity check: enforce 6-10 AM window, save photo, DON'T mark as done — needs Queen's approval
        if (orderType === 'chastity_check' && photoUrl) {
            const tz = body.tz || 'UTC';
            const localHour = parseInt(
                new Intl.DateTimeFormat('en', { timeZone: tz, hour: '2-digit', hour12: false }).format(new Date()),
                10
            );

            // Check existing submission in vault_check_log (proper table, not JSON)
            const { data: existing } = await supabaseAdmin.from('vault_check_log')
                .select('id, status').eq('session_id', session.id).eq('date', today).eq('type', 'chastity_check').maybeSingle();

            if (existing && (existing.status === 'pending' || existing.status === 'approved')) {
                return NextResponse.json({ error: 'Chastity check already submitted today', chastityStatus: existing.status }, { status: 400 });
            }
            // Enforce 6-10 AM window — allow resubmit anytime if Queen rejected
            const isRejectedRetry = existing?.status === 'rejected';
            if (!isRejectedRetry && (localHour < 6 || localHour >= 10)) {
                return NextResponse.json({ error: 'Chastity check window is 6:00 - 10:00 AM', windowClosed: true }, { status: 400 });
            }

            // Write to vault_check_log (proper table — same pattern as user_routines)
            if (existing) {
                // Re-submit after rejection
                await supabaseAdmin.from('vault_check_log').update({
                    proof_url: photoUrl,
                    status: 'pending',
                    submitted_at: new Date().toISOString(),
                    reviewed_at: null,
                    queen_comment: null,
                }).eq('id', existing.id);
            } else {
                await supabaseAdmin.from('vault_check_log').insert({
                    session_id: session.id,
                    member_id: email,
                    date: today,
                    type: 'chastity_check',
                    proof_url: photoUrl,
                    status: 'pending',
                    submitted_at: new Date().toISOString(),
                });
            }

            // No need to touch vault_daily orders — chastity status lives in vault_check_log

            // Push notification to Queen
            try {
                const { data: prof } = await supabaseAdmin.from('profiles').select('name').ilike('member_id', email).maybeSingle();
                const name = prof?.name || 'A subject';
                const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '761d91da-b098-44a7-8d98-75c1cce54dd0';
                const ONESIGNAL_KEY = process.env.ONESIGNAL_REST_API_KEY;
                if (ONESIGNAL_KEY) {
                    fetch('https://api.onesignal.com/notifications', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Key ${ONESIGNAL_KEY}` },
                        body: JSON.stringify({
                            app_id: ONESIGNAL_APP_ID,
                            target_channel: 'push',
                            include_aliases: { external_id: ['ceo@qkarin.com'] },
                            headings: { en: 'Chastity Check Submitted' },
                            subtitle: { en: 'Vault' },
                            contents: { en: `${name} submitted their daily chastity check photo` },
                            url: 'https://throne.qkarin.com/dashboard',
                        }),
                    }).catch(() => {});
                }
            } catch (_) {}

            return NextResponse.json({ success: true, chastityStatus: 'pending' });
        }

        await _updateOrderDone(session.id, today, orderType, amount);
        return NextResponse.json({ success: true });
    }

    // ── APPROVE CHASTITY CHECK ──
    if (action === 'approve_chastity') {
        const { date: targetDate, comment } = body;
        const date = targetDate || new Date().toISOString().split('T')[0];

        await supabaseAdmin.from('vault_check_log').update({
            status: 'approved',
            reviewed_at: new Date().toISOString(),
            queen_comment: comment || null,
        }).eq('session_id', session.id).eq('date', date).eq('type', 'chastity_check');

        await _syncChastityOrder(session.id, date, 'approved');

        // Broadcast to member so their vault page updates instantly
        _notifyMember(email, 'chastity_reviewed', { status: 'approved', date });
        // Push notification
        _pushToMember(email, 'Chastity Approved', 'Your chastity check has been approved by Queen.');

        return NextResponse.json({ success: true, approved: true });
    }

    // ── REJECT CHASTITY CHECK ──
    if (action === 'reject_chastity') {
        const { date: targetDate, reason } = body;
        const date = targetDate || new Date().toISOString().split('T')[0];

        await supabaseAdmin.from('vault_check_log').update({
            status: 'rejected',
            reviewed_at: new Date().toISOString(),
            queen_comment: reason || null,
        }).eq('session_id', session.id).eq('date', date).eq('type', 'chastity_check');

        await _syncChastityOrder(session.id, date, 'rejected');

        _notifyMember(email, 'chastity_reviewed', { status: 'rejected', date });
        _pushToMember(email, 'Chastity Rejected', reason || 'Your chastity check was rejected. Resubmit.');

        return NextResponse.json({ success: true, rejected: true });
    }

    // ── SUBMIT TASK — member submits proof/text for Queen's review ──
    if (action === 'submit_task') {
        const { orderType, text, photoUrl, videoUrl } = body;
        const today = new Date().toISOString().split('T')[0];

        console.log('[vault] submit_task:', { email, orderType, sessionId: session.id, today });

        const { data: daily, error: dailyErr } = await supabaseAdmin.from('vault_daily')
            .select('id, orders').eq('session_id', session.id).eq('date', today)
            .order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (dailyErr) console.error('[vault] submit_task daily lookup error:', dailyErr.message);
        if (!daily) {
            console.error('[vault] submit_task: no vault_daily for session', session.id, 'date', today);
            // Still try to insert into vault_submissions even without vault_daily
            try {
                await supabaseAdmin.from('vault_submissions').insert({
                    session_id: session.id, member_id: email, date: today,
                    order_idx: 0, order_type: orderType || 'unknown', label: orderType || null,
                    text: text || null, photo_url: photoUrl || null, video_url: videoUrl || null,
                    status: 'pending',
                });
            } catch {}
            return NextResponse.json({ success: true, status: 'pending' });
        }

        const orders: any[] = typeof daily.orders === 'string' ? JSON.parse(daily.orders) : (daily.orders || []);
        console.log('[vault] submit_task orders count:', orders.length, 'looking for type:', orderType);
        const idx = orders.findIndex((o: any) => o.type === orderType && o.done < o.target && o.submitted !== 'pending');

        // Mark the order as submitted in vault_daily orders JSON (reliable fallback)
        if (idx >= 0 && idx < orders.length) {
            orders[idx].submitted = 'pending';
            orders[idx].submitted_at = new Date().toISOString();
            if (text) orders[idx].submitted_text = text;
            if (photoUrl) orders[idx].submitted_photo = photoUrl;
            if (videoUrl) orders[idx].submitted_video = videoUrl;
            const { error: updErr } = await supabaseAdmin.from('vault_daily').update({
                orders: JSON.stringify(orders),
            }).eq('id', daily.id);
            console.log('[vault] submit_task vault_daily updated:', idx, updErr ? 'ERROR: ' + updErr.message : 'OK');
        } else {
            console.log('[vault] submit_task: no matching order found for type', orderType, 'idx:', idx);
        }

        // Also insert into vault_submissions table if it exists
        try {
            const { error: subErr } = await supabaseAdmin.from('vault_submissions').insert({
                session_id: session.id,
                member_id: email,
                date: today,
                order_idx: idx >= 0 ? idx : 0,
                order_type: orderType || orders[idx]?.type || 'unknown',
                label: orders[idx]?.label || orderType || null,
                text: text || null,
                photo_url: photoUrl || null,
                video_url: videoUrl || null,
                status: 'pending',
            });
            if (subErr) console.error('[vault] submit_task vault_submissions insert error:', subErr.message);
        } catch (e: any) {
            console.error('[vault] vault_submissions table missing:', e?.message);
        }

        return NextResponse.json({ success: true, status: 'pending' });
    }

    // ── SAVE GAMBLE RESULT — persist gamble outcome so it survives page reload ──
    if (action === 'save_gamble') {
        const { orderType, gambleResult } = body;
        if (!orderType || gambleResult === undefined) return NextResponse.json({ error: 'Missing orderType or gambleResult' }, { status: 400 });

        const today = new Date().toISOString().split('T')[0];
        const { data: daily } = await supabaseAdmin.from('vault_daily')
            .select('id, orders').eq('session_id', session.id).eq('date', today)
            .order('created_at', { ascending: false }).limit(1).maybeSingle();

        if (!daily) return NextResponse.json({ success: true }); // no daily record yet, ignore

        const orders: any[] = typeof daily.orders === 'string' ? JSON.parse(daily.orders) : (daily.orders || []);
        const idx = orders.findIndex((o: any) => o.type === orderType && o.done < o.target);
        if (idx >= 0) {
            orders[idx].gambleResult = gambleResult;
            await supabaseAdmin.from('vault_daily').update({ orders: JSON.stringify(orders) }).eq('id', daily.id);
        }
        return NextResponse.json({ success: true });
    }

    // ── APPROVE TASK — Queen approves a task submission ──
    if (action === 'approve_task') {
        const { date: targetDate, submissionId, comment } = body;
        const date = targetDate || new Date().toISOString().split('T')[0];

        // Update the submission row in vault_submissions
        await supabaseAdmin.from('vault_submissions').update({
            status: 'approved',
            reviewed_at: new Date().toISOString(),
            queen_comment: comment || null,
        }).eq('id', submissionId);

        // Get the submission to find order_idx
        const { data: sub } = await supabaseAdmin.from('vault_submissions')
            .select('order_idx').eq('id', submissionId).single();

        // Update order done count in vault_daily
        const { data: daily } = await supabaseAdmin.from('vault_daily')
            .select('id, orders, orders_completed, orders_total').eq('session_id', session.id).eq('date', date).maybeSingle();
        if (daily) {
            const orders: any[] = typeof daily.orders === 'string' ? JSON.parse(daily.orders) : (daily.orders || []);
            const oIdx = sub?.order_idx;
            if (oIdx != null && orders[oIdx]) {
                orders[oIdx].done = orders[oIdx].target;
            }
            const completed = orders.filter((o: any) => o.done >= o.target).length;
            const perfect = completed >= orders.length;

            await supabaseAdmin.from('vault_daily').update({
                orders: JSON.stringify(orders),
                orders_completed: completed,
                perfect,
            }).eq('id', daily.id);

            if (perfect) {
                const { data: sess } = await supabaseAdmin.from('vault_sessions')
                    .select('current_streak, best_streak, total_perfect_days').eq('id', session.id).single();
                if (sess) {
                    const ns = (sess.current_streak || 0) + 1;
                    await supabaseAdmin.from('vault_sessions').update({
                        current_streak: ns, best_streak: Math.max(sess.best_streak || 0, ns),
                        total_perfect_days: (sess.total_perfect_days || 0) + 1,
                    }).eq('id', session.id);
                }
            }
        }

        // Broadcast to member so their vault page updates instantly
        _notifyMember(email, 'task_reviewed', { status: 'approved', submissionId });
        _pushToMember(email, 'Task Approved', 'Your task submission has been approved by Queen.');

        return NextResponse.json({ success: true, approved: true });
    }

    // ── REJECT TASK — Queen rejects a task submission ──
    if (action === 'reject_task') {
        const { date: targetDate, submissionId, comment } = body;
        const date = targetDate || new Date().toISOString().split('T')[0];

        // Update the submission row
        await supabaseAdmin.from('vault_submissions').update({
            status: 'rejected',
            reviewed_at: new Date().toISOString(),
            queen_comment: comment || null,
        }).eq('id', submissionId);

        // Get the submission to find order_idx
        const { data: sub } = await supabaseAdmin.from('vault_submissions')
            .select('order_idx').eq('id', submissionId).single();

        // Reset order done count
        const { data: daily } = await supabaseAdmin.from('vault_daily')
            .select('id, orders').eq('session_id', session.id).eq('date', date).maybeSingle();
        if (daily) {
            const orders: any[] = typeof daily.orders === 'string' ? JSON.parse(daily.orders) : (daily.orders || []);
            const oIdx = sub?.order_idx;
            if (oIdx != null && orders[oIdx]) {
                orders[oIdx].done = 0;
            }
            await supabaseAdmin.from('vault_daily').update({
                orders: JSON.stringify(orders),
            }).eq('id', daily.id);
        }

        // Broadcast to member
        _notifyMember(email, 'task_reviewed', { status: 'rejected', submissionId });
        _pushToMember(email, 'Task Rejected', comment || 'Your task submission was rejected. Resubmit.');

        return NextResponse.json({ success: true, rejected: true });
    }

    // ── CLAIM FREEDOM REWARD ──
    if (action === 'claim_reward') {
        const today = new Date().toISOString().split('T')[0];

        // Check today is perfect
        const { data: todayRecord } = await supabaseAdmin
            .from('vault_daily')
            .select('*')
            .eq('session_id', session.id)
            .eq('date', today)
            .maybeSingle();

        if (!todayRecord || !todayRecord.perfect) {
            return NextResponse.json({ error: 'Not all orders complete' }, { status: 400 });
        }

        if (todayRecord.reward_claimed) {
            return NextResponse.json({ error: 'Already claimed today' }, { status: 409 });
        }

        await supabaseAdmin.from('vault_daily').update({ reward_claimed: true }).eq('id', todayRecord.id);

        const rewardUntil = Date.now() + 60 * 60 * 1000;
        return NextResponse.json({ success: true, rewardUntil });
    }

    // ── RECORD TRIBUTE ──
    if (action === 'tribute') {
        const { amount } = body;
        if (!amount) return NextResponse.json({ error: 'Missing amount' }, { status: 400 });

        const { error } = await supabaseAdmin.from('vault_tributes').insert({
            session_id: session.id,
            member_id: email,
            amount,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        const today = new Date().toISOString().split('T')[0];
        await _updateOrderDone(session.id, today, 'tribute', amount);

        return NextResponse.json({ success: true });
    }

    // ── ENSURE TODAY ── create today's daily record if missing, or reset if pre-seeded
    if (action === 'ensure_today') {
        const today = new Date().toISOString().split('T')[0];
        const daysIn = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 86400000) + 1;

        const { data: existing } = await supabaseAdmin
            .from('vault_daily')
            .select('*')
            .eq('session_id', session.id)
            .eq('date', today)
            .maybeSingle();

        if (!existing) {
            // Check if yesterday's chastity check was submitted
            // Skip day 1-2 (video submission day) — chastity check starts from day 3
            if (daysIn > 2) {
                const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

                // Check vault_check_log first (proper table)
                let chastitySubmitted = false;
                try {
                    const { data: yCheck } = await supabaseAdmin.from('vault_check_log')
                        .select('status').eq('session_id', session.id).eq('date', yesterday).eq('type', 'chastity_check').maybeSingle();
                    if (yCheck) chastitySubmitted = true;
                } catch {}

                // Fallback: check orders JSON done count (for when vault_check_log doesn't exist yet)
                if (!chastitySubmitted) {
                    const { data: yDaily } = await supabaseAdmin.from('vault_daily')
                        .select('orders').eq('session_id', session.id).eq('day_number', daysIn - 1).maybeSingle();
                    const yOrders: any[] = yDaily ? (typeof yDaily.orders === 'string' ? JSON.parse(yDaily.orders) : (yDaily.orders || [])) : [];
                    const cc = yOrders.find((o: any) => o.type === 'chastity_check');
                    if (cc && cc.done >= cc.target) chastitySubmitted = true;

                    // Only terminate if yesterday HAD a chastity order AND it wasn't done
                    if (cc && !chastitySubmitted) {
                        await supabaseAdmin.from('vault_sessions').update({
                            status: 'completed',
                            release_reason: 'Chastity check not submitted. Program terminated.',
                        }).eq('id', session.id);
                        return NextResponse.json({ success: false, ended: true, reason: 'chastity_failed' });
                    }
                }
            }

            const orders = await _getOrdersForDay(session.id, daysIn);
            await supabaseAdmin.from('vault_daily').insert({
                session_id: session.id,
                member_id: email,
                day_number: daysIn,
                date: today,
                orders: JSON.stringify(orders),
                orders_total: orders.length,
            });
        } else if (existing.perfect) {
            // Record shows perfect but verify against real data — if no spin/trial exists, it's fake
            const { data: todaySpin } = await supabaseAdmin
                .from('vault_spins').select('id').eq('session_id', session.id).eq('date', today).maybeSingle();
            const { data: todayTrial } = await supabaseAdmin
                .from('vault_trials').select('id').eq('session_id', session.id).eq('date', today).maybeSingle();
            if (!todaySpin && !todayTrial) {
                // No real activity — reset pre-seeded record
                const orders = await _getOrdersForDay(session.id, daysIn);
                await supabaseAdmin.from('vault_daily').update({
                    orders: JSON.stringify(orders),
                    orders_total: orders.length,
                    orders_completed: 0,
                    perfect: false,
                    reward_claimed: false,
                }).eq('id', existing.id);
            }
        }

        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// ── HELPERS ──

// Read orders from member's custom program; auto-generate program if missing
async function _getOrdersForDay(sessionId: string, dayNumber: number) {
    try {
        let { data: prog, error: progErr } = await supabaseAdmin
            .from('vault_member_program')
            .select('program')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (progErr) console.error('[vault] _getOrdersForDay query error:', progErr.message);

        // Auto-generate program for sessions that don't have one yet
        if (!prog) {
            console.log(`[vault] No program for session ${sessionId}, auto-generating...`);
            const { data: sess } = await supabaseAdmin
                .from('vault_sessions')
                .select('member_id')
                .eq('id', sessionId)
                .single();
            if (sess) {
                const program = await _generateFullProgram();
                const { error: insertErr } = await supabaseAdmin.from('vault_member_program').insert({
                    session_id: sessionId,
                    member_id: sess.member_id,
                    program: JSON.stringify(program),
                });
                if (insertErr) console.error('[vault] Failed to insert auto-generated program:', insertErr.message);
                else console.log(`[vault] Auto-generated program for session ${sessionId}`);
                prog = { program: JSON.stringify(program) };
            }
        }

        if (prog?.program) {
            const program = typeof prog.program === 'string' ? JSON.parse(prog.program) : prog.program;
            const dayTasks = program[String(dayNumber)];
            if (dayTasks && Array.isArray(dayTasks) && dayTasks.length > 0) {
                return dayTasks.map((t: any) => {
                    const order: any = { type: t.type, target: t.target || 1, done: 0 };
                    if (t.label) order.label = t.label;
                    if (t.config) order.config = t.config;
                    return order;
                });
            }
            console.warn(`[vault] Program found but day ${dayNumber} has no tasks, falling back to defaults`);
        }
    } catch (err: any) {
        console.error('[vault] _getOrdersForDay error:', err?.message || err);
    }
    // Final fallback
    return _generateDailyOrders(dayNumber);
}

function _generateDailyOrders(dayNumber: number) {
    // Use the shared defaults (same as dashboard template)
    const tasks = defaultDayTasks(dayNumber);
    return tasks.map((t: any) => {
        const order: any = { type: t.type, target: t.target || 1, done: 0 };
        if (t.label) order.label = t.label;
        if (t.config) order.config = t.config;
        return order;
    });
}

// Generate a full 30-day program from template or defaults
async function _generateFullProgram(): Promise<Record<string, any[]>> {
    const program: Record<string, any[]> = {};
    // ALWAYS read LATEST from vault_program_template
    try {
        const { data: template, error: tplErr } = await supabaseAdmin
            .from('vault_program_template')
            .select('*')
            .order('day_number');
        if (tplErr) console.error('[vault] Template read error:', tplErr.message);
        if (template && template.length > 0) {
            console.log(`[vault] Found ${template.length} template rows, copying to member program`);
            for (const row of template) {
                const tasks = typeof row.tasks === 'string' ? JSON.parse(row.tasks) : row.tasks;
                program[String(row.day_number)] = tasks;
            }
            return program;
        }
        console.log('[vault] No template found, using hardcoded defaults');
    } catch (e: any) {
        console.error('[vault] _generateFullProgram error:', e?.message);
    }
    // Fallback: use shared defaults (same as dashboard)
    return generateDefaultProgram();
}

async function _updateOrderDone(sessionId: string, date: string, orderType: string, amount?: number) {
    const { data: daily } = await supabaseAdmin
        .from('vault_daily')
        .select('*')
        .eq('session_id', sessionId)
        .eq('date', date)
        .maybeSingle();

    if (!daily) return;

    const orders = typeof daily.orders === 'string' ? JSON.parse(daily.orders) : (daily.orders || []);
    let updated = false;

    for (const o of orders) {
        if (o.type === orderType && o.done < o.target) {
            if (amount !== undefined) {
                o.done = Math.min(o.target, o.done + amount);
            } else {
                o.done = o.target;
            }
            updated = true;
            break;
        }
    }

    if (!updated) return;

    const completed = orders.filter((o: any) => o.done >= o.target).length;
    const perfect = completed >= orders.length;

    await supabaseAdmin.from('vault_daily').update({
        orders: JSON.stringify(orders),
        orders_completed: completed,
        perfect,
    }).eq('id', daily.id);

    // Update session streak if day just became perfect
    if (perfect) {
        const { data: session } = await supabaseAdmin
            .from('vault_sessions')
            .select('current_streak, best_streak, total_perfect_days')
            .eq('id', sessionId)
            .single();

        if (session) {
            const newStreak = (session.current_streak || 0) + 1;
            const bestStreak = Math.max(session.best_streak || 0, newStreak);
            await supabaseAdmin.from('vault_sessions').update({
                current_streak: newStreak,
                best_streak: bestStreak,
                total_perfect_days: (session.total_perfect_days || 0) + 1,
            }).eq('id', sessionId);
        }
    }
}

// Sync vault_daily order status when chastity check is approved/rejected via vault_check_log
async function _syncChastityOrder(sessionId: string, date: string, status: 'approved' | 'rejected') {
    try {
        const { data: daily } = await supabaseAdmin.from('vault_daily')
            .select('id, orders, orders_completed, orders_total').eq('session_id', sessionId).eq('date', date).maybeSingle();
        if (!daily) return;

        const orders: any[] = typeof daily.orders === 'string' ? JSON.parse(daily.orders) : (daily.orders || []);
        for (const o of orders) {
            if (o.type === 'chastity_check') {
                o.done = status === 'approved' ? o.target : 0;
                break;
            }
        }
        const completed = orders.filter((o: any) => o.done >= o.target).length;
        const perfect = completed >= orders.length;

        await supabaseAdmin.from('vault_daily').update({
            orders: JSON.stringify(orders),
            orders_completed: completed,
            perfect,
        }).eq('id', daily.id);

        // Update streak if perfect
        if (perfect) {
            const { data: sess } = await supabaseAdmin.from('vault_sessions')
                .select('current_streak, best_streak, total_perfect_days').eq('id', sessionId).single();
            if (sess) {
                const ns = (sess.current_streak || 0) + 1;
                await supabaseAdmin.from('vault_sessions').update({
                    current_streak: ns, best_streak: Math.max(sess.best_streak || 0, ns),
                    total_perfect_days: (sess.total_perfect_days || 0) + 1,
                }).eq('id', sessionId);
            }
        }
    } catch (_) {}
}

// Broadcast realtime event to member's vault page so it refreshes instantly
async function _notifyMember(memberEmail: string, event: string, payload: any) {
    try {
        const { data: prof } = await supabaseAdmin.from('profiles').select('ID').ilike('member_id', memberEmail).maybeSingle();
        if (!prof) return;
        const ch = supabaseAdmin.channel(`vault-notify-${prof.ID}`);
        await ch.subscribe();
        await ch.send({ type: 'broadcast', event, payload });
        setTimeout(() => supabaseAdmin.removeChannel(ch), 1500);
    } catch (_) {}
}

// Send push notification to member via OneSignal
function _pushToMember(memberEmail: string, title: string, message: string) {
    try {
        const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '761d91da-b098-44a7-8d98-75c1cce54dd0';
        const ONESIGNAL_KEY = process.env.ONESIGNAL_REST_API_KEY;
        if (!ONESIGNAL_KEY) return;
        fetch('https://api.onesignal.com/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Key ${ONESIGNAL_KEY}` },
            body: JSON.stringify({
                app_id: ONESIGNAL_APP_ID,
                target_channel: 'push',
                include_aliases: { external_id: [memberEmail.toLowerCase()] },
                headings: { en: title },
                subtitle: { en: 'Vault' },
                contents: { en: message },
                url: 'https://throne.qkarin.com/vault',
            }),
        }).catch(() => {});
    } catch (_) {}
}
