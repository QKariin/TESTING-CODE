import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCaller, isCEO, isOwnerOrCEO } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// GET /api/vault/session?memberId=xxx
// Returns full vault state: active session, today's orders, daily history, adjustments, spins, trials
export async function GET(req: NextRequest) {
    const caller = await getCaller();
    const host = req.headers.get('host') || '';
    const isLocal = host.includes('localhost');

    if (!caller && !isLocal) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const memberId = req.nextUrl.searchParams.get('memberId');
    const tz = req.nextUrl.searchParams.get('tz') || 'UTC';
    if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 });

    // Resolve UUID → email if needed (vault_sessions stores email as member_id)
    let email = memberId.toLowerCase();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(email);
    if (isUuid) {
        const { data: prof } = await supabaseAdmin.from('profiles').select('member_id').eq('ID', email).maybeSingle();
        if (prof?.member_id) email = prof.member_id.toLowerCase();
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
        return NextResponse.json({ active: false });
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
        // Try to read from member's custom program first
        const orders = await _getOrdersForDay(session.id, daysIn2);
        const { data: inserted } = await supabaseAdmin.from('vault_daily').insert({
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

        // Auto-generate 30-day program from template (or defaults)
        const program = await _generateFullProgram();
        await supabaseAdmin.from('vault_member_program').insert({
            session_id: session.id,
            member_id: email,
            program: JSON.stringify(program),
        });

        // Create day 1 orders from the generated program
        const day1Tasks = program['1'] || [];
        const orders = day1Tasks.map((t: any) => ({ type: t.type, target: t.target || 1, done: 0 }));
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

            try {
                const { data: daily } = await supabaseAdmin.from('vault_daily')
                    .select('id, orders, chastity_photo').eq('session_id', session.id).eq('date', today).maybeSingle();
                if (daily) {
                    const orders: any[] = typeof daily.orders === 'string' ? JSON.parse(daily.orders) : (daily.orders || []);
                    const cc = orders.find((o: any) => o.type === 'chastity_check');
                    // Block duplicate: if already pending or approved, reject
                    if (cc && (cc.status === 'pending' || cc.status === 'approved')) {
                        return NextResponse.json({ error: 'Chastity check already submitted today', chastityStatus: cc.status }, { status: 400 });
                    }
                    // Enforce 6-10 AM window — but allow resubmit anytime if Queen rejected
                    const isRejectedRetry = cc?.status === 'rejected';
                    if (!isRejectedRetry && (localHour < 6 || localHour >= 10)) {
                        return NextResponse.json({ error: 'Chastity check window is 6:00 - 10:00 AM', windowClosed: true }, { status: 400 });
                    }
                    for (const o of orders) {
                        if (o.type === 'chastity_check') { o.status = 'pending'; o.photoUrl = photoUrl; break; }
                    }
                    await supabaseAdmin.from('vault_daily').update({
                        chastity_photo: photoUrl,
                        orders: JSON.stringify(orders),
                    }).eq('id', daily.id);
                }
            } catch (_) {}

            // Send push notification to Queen
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
        const { date: targetDate } = body;
        const date = targetDate || new Date().toISOString().split('T')[0];

        const { data: daily } = await supabaseAdmin.from('vault_daily')
            .select('id, orders, orders_completed, orders_total').eq('session_id', session.id).eq('date', date).maybeSingle();
        if (!daily) return NextResponse.json({ error: 'No daily record' }, { status: 404 });

        const orders: any[] = typeof daily.orders === 'string' ? JSON.parse(daily.orders) : (daily.orders || []);
        for (const o of orders) {
            if (o.type === 'chastity_check') { o.done = o.target; o.status = 'approved'; break; }
        }
        const completed = orders.filter((o: any) => o.done >= o.target).length;
        const perfect = completed >= orders.length;

        await supabaseAdmin.from('vault_daily').update({
            orders: JSON.stringify(orders),
            orders_completed: completed,
            perfect,
        }).eq('id', daily.id);

        // Update streak if day became perfect
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

        return NextResponse.json({ success: true, approved: true });
    }

    // ── REJECT CHASTITY CHECK ──
    if (action === 'reject_chastity') {
        const { date: targetDate, reason } = body;
        const date = targetDate || new Date().toISOString().split('T')[0];

        const { data: daily } = await supabaseAdmin.from('vault_daily')
            .select('id, orders').eq('session_id', session.id).eq('date', date).maybeSingle();
        if (!daily) return NextResponse.json({ error: 'No daily record' }, { status: 404 });

        const orders: any[] = typeof daily.orders === 'string' ? JSON.parse(daily.orders) : (daily.orders || []);
        for (const o of orders) {
            if (o.type === 'chastity_check') { o.done = 0; o.status = 'rejected'; o.rejectReason = reason || ''; delete o.photoUrl; break; }
        }
        await supabaseAdmin.from('vault_daily').update({
            chastity_photo: null,
            orders: JSON.stringify(orders),
        }).eq('id', daily.id);

        return NextResponse.json({ success: true, rejected: true });
    }

    // ── SUBMIT TASK — member submits proof/text for Queen's review ──
    if (action === 'submit_task') {
        const { orderIdx, orderType, text, photoUrl, videoUrl, submittedAt } = body;
        const today = new Date().toISOString().split('T')[0];

        const { data: daily } = await supabaseAdmin.from('vault_daily')
            .select('id, orders, submissions').eq('session_id', session.id).eq('date', today).maybeSingle();
        if (!daily) return NextResponse.json({ error: 'No daily record' }, { status: 404 });

        const orders: any[] = typeof daily.orders === 'string' ? JSON.parse(daily.orders) : (daily.orders || []);
        // Mark the order as pending
        const idx = orderIdx != null ? orderIdx : orders.findIndex((o: any) => o.type === orderType && o.status !== 'pending' && o.status !== 'approved' && o.done < o.target);
        if (idx >= 0 && idx < orders.length) {
            orders[idx].status = 'pending';
            if (photoUrl) orders[idx].photoUrl = photoUrl;
            if (videoUrl) orders[idx].videoUrl = videoUrl;
            if (text) orders[idx].submittedText = text;
        }

        // Append to submissions array (stored in vault_daily row)
        let subs: any[] = [];
        try { subs = typeof daily.submissions === 'string' ? JSON.parse(daily.submissions) : (daily.submissions || []); } catch { subs = []; }
        subs.push({
            orderIdx: idx,
            orderType: orderType || orders[idx]?.type,
            label: orders[idx]?.label || orderType,
            text: text || null,
            photoUrl: photoUrl || null,
            videoUrl: videoUrl || null,
            submittedAt: submittedAt || new Date().toISOString(),
            status: 'pending',
            queenComment: null,
        });

        await supabaseAdmin.from('vault_daily').update({
            orders: JSON.stringify(orders),
            submissions: JSON.stringify(subs),
        }).eq('id', daily.id);

        return NextResponse.json({ success: true, status: 'pending' });
    }

    // ── APPROVE TASK — Queen approves a task submission ──
    if (action === 'approve_task') {
        const { date: targetDate, submissionIdx, comment } = body;
        const date = targetDate || new Date().toISOString().split('T')[0];

        const { data: daily } = await supabaseAdmin.from('vault_daily')
            .select('id, orders, orders_completed, orders_total, submissions').eq('session_id', session.id).eq('date', date).maybeSingle();
        if (!daily) return NextResponse.json({ error: 'No daily record' }, { status: 404 });

        let subs: any[] = [];
        try { subs = typeof daily.submissions === 'string' ? JSON.parse(daily.submissions) : (daily.submissions || []); } catch { subs = []; }
        const orders: any[] = typeof daily.orders === 'string' ? JSON.parse(daily.orders) : (daily.orders || []);

        if (submissionIdx != null && subs[submissionIdx]) {
            subs[submissionIdx].status = 'approved';
            if (comment) subs[submissionIdx].queenComment = comment;
            // Mark the corresponding order as done
            const oIdx = subs[submissionIdx].orderIdx;
            if (oIdx != null && orders[oIdx]) {
                orders[oIdx].done = orders[oIdx].target;
                orders[oIdx].status = 'approved';
                if (comment) orders[oIdx].queenComment = comment;
            }
        }

        const completed = orders.filter((o: any) => o.done >= o.target).length;
        const perfect = completed >= orders.length;

        await supabaseAdmin.from('vault_daily').update({
            orders: JSON.stringify(orders),
            submissions: JSON.stringify(subs),
            orders_completed: completed,
            perfect,
        }).eq('id', daily.id);

        // Update streak if perfect
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

        return NextResponse.json({ success: true, approved: true });
    }

    // ── REJECT TASK — Queen rejects a task submission ──
    if (action === 'reject_task') {
        const { date: targetDate, submissionIdx, comment } = body;
        const date = targetDate || new Date().toISOString().split('T')[0];

        const { data: daily } = await supabaseAdmin.from('vault_daily')
            .select('id, orders, submissions').eq('session_id', session.id).eq('date', date).maybeSingle();
        if (!daily) return NextResponse.json({ error: 'No daily record' }, { status: 404 });

        let subs: any[] = [];
        try { subs = typeof daily.submissions === 'string' ? JSON.parse(daily.submissions) : (daily.submissions || []); } catch { subs = []; }
        const orders: any[] = typeof daily.orders === 'string' ? JSON.parse(daily.orders) : (daily.orders || []);

        if (submissionIdx != null && subs[submissionIdx]) {
            subs[submissionIdx].status = 'rejected';
            if (comment) subs[submissionIdx].queenComment = comment;
            const oIdx = subs[submissionIdx].orderIdx;
            if (oIdx != null && orders[oIdx]) {
                orders[oIdx].done = 0;
                orders[oIdx].status = 'rejected';
                if (comment) orders[oIdx].queenComment = comment;
                delete orders[oIdx].photoUrl;
                delete orders[oIdx].videoUrl;
                delete orders[oIdx].submittedText;
            }
        }

        await supabaseAdmin.from('vault_daily').update({
            orders: JSON.stringify(orders),
            submissions: JSON.stringify(subs),
        }).eq('id', daily.id);

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
            // Check if yesterday's chastity check was approved — if not, end the program
            // Skip day 1 (video submission day) — chastity check starts from day 2
            if (daysIn > 2) {
                const { data: yesterday } = await supabaseAdmin
                    .from('vault_daily')
                    .select('orders')
                    .eq('session_id', session.id)
                    .eq('day_number', daysIn - 1)
                    .maybeSingle();
                if (yesterday) {
                    const yOrders: any[] = typeof yesterday.orders === 'string' ? JSON.parse(yesterday.orders) : (yesterday.orders || []);
                    const yChastity = yOrders.find((o: any) => o.type === 'chastity_check');
                    if (yChastity && yChastity.status !== 'approved' && !(yChastity.done >= yChastity.target)) {
                        // Chastity check not approved — end the session
                        await supabaseAdmin.from('vault_sessions').update({
                            status: 'completed',
                            release_reason: 'Chastity check not submitted or approved. Program terminated.',
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
        let { data: prog } = await supabaseAdmin
            .from('vault_member_program')
            .select('program')
            .eq('session_id', sessionId)
            .maybeSingle();

        // Auto-generate program for sessions that don't have one yet
        if (!prog) {
            const { data: sess } = await supabaseAdmin
                .from('vault_sessions')
                .select('member_id')
                .eq('id', sessionId)
                .single();
            if (sess) {
                const program = await _generateFullProgram();
                await supabaseAdmin.from('vault_member_program').insert({
                    session_id: sessionId,
                    member_id: sess.member_id,
                    program: JSON.stringify(program),
                });
                prog = { program: JSON.stringify(program) };
            }
        }

        if (prog?.program) {
            const program = typeof prog.program === 'string' ? JSON.parse(prog.program) : prog.program;
            const dayTasks = program[String(dayNumber)];
            if (dayTasks && Array.isArray(dayTasks) && dayTasks.length > 0) {
                return dayTasks.map((t: any) => ({ type: t.type, target: t.target || 1, done: 0 }));
            }
        }
    } catch { }
    // Final fallback
    return _generateDailyOrders(dayNumber);
}

function _generateDailyOrders(dayNumber: number) {
    const orders: { type: string; target: number; done: number }[] = [
        { type: 'kneel', target: 8, done: 0 },
        { type: 'chastity_check', target: 1, done: 0 },
        { type: 'trial', target: 1, done: 0 },
    ];

    // Add spin on odd days
    if (dayNumber % 2 === 1) {
        orders.push({ type: 'spin', target: 1, done: 0 });
    }

    // Add tribute on even days or every 3rd day
    if (dayNumber % 2 === 0 || dayNumber % 3 === 0) {
        orders.push({ type: 'tribute', target: 5, done: 0 });
    }

    return orders;
}

// Generate a full 30-day program from template or defaults
async function _generateFullProgram(): Promise<Record<string, any[]>> {
    const program: Record<string, any[]> = {};
    // Try to read from vault_program_template first
    try {
        const { data: template } = await supabaseAdmin
            .from('vault_program_template')
            .select('*')
            .order('day_number');
        if (template && template.length > 0) {
            for (const row of template) {
                const tasks = typeof row.tasks === 'string' ? JSON.parse(row.tasks) : row.tasks;
                program[String(row.day_number)] = tasks;
            }
            return program;
        }
    } catch { }
    // Fallback: generate from hardcoded defaults
    for (let d = 1; d <= 30; d++) {
        program[String(d)] = _defaultDayTasks(d);
    }
    return program;
}

function _kneelTarget(day: number): number {
    if (day <= 3) return 4;
    if (day <= 6) return 6;
    if (day <= 11) return 8;
    if (day <= 14) return 10;
    if (day <= 19) return 12;
    if (day <= 24) return 14;
    if (day <= 27) return 16;
    if (day <= 29) return 18;
    return 20;
}

function _defaultDayTasks(dayNumber: number) {
    const tasks: { type: string; target: number; label: string }[] = [
        { type: 'kneel', target: _kneelTarget(dayNumber), label: `Kneel ${_kneelTarget(dayNumber)} times` },
        { type: 'chastity_check', target: 1, label: 'Chastity check photo' },
    ];
    if (dayNumber <= 7) {
        if (dayNumber === 1) tasks.push({ type: 'journal', target: 1, label: 'Journal: "Why I submitted"' });
        if (dayNumber === 2) tasks.push({ type: 'spin', target: 1, label: 'Spin the wheel' });
        if (dayNumber === 3) tasks.push({ type: 'lines', target: 30, label: 'Write lines x30' });
        if (dayNumber === 4) tasks.push({ type: 'tribute', target: 3, label: 'Tribute 3 coins' });
        if (dayNumber === 5) tasks.push({ type: 'worship', target: 1, label: 'Worship message' });
        if (dayNumber === 6) tasks.push({ type: 'card', target: 1, label: 'Draw a task card' });
        if (dayNumber === 7) { tasks.push({ type: 'cold_shower', target: 60, label: 'Cold shower 60s' }); tasks.push({ type: 'confession', target: 1, label: 'Confession' }); }
    } else if (dayNumber <= 14) {
        if (dayNumber === 8) { tasks.push({ type: 'edge', target: 3, label: 'Edge 3 times' }); tasks.push({ type: 'journal', target: 1, label: 'Journal entry' }); }
        if (dayNumber === 9) { tasks.push({ type: 'spin', target: 1, label: 'Spin the wheel' }); tasks.push({ type: 'tribute', target: 5, label: 'Tribute 5 coins' }); }
        if (dayNumber === 10) { tasks.push({ type: 'lines', target: 50, label: 'Write lines x50' }); tasks.push({ type: 'corner_time', target: 10, label: 'Corner time 10min' }); }
        if (dayNumber === 11) tasks.push({ type: 'body_writing', target: 1, label: 'Body writing photo: OWNED' });
        if (dayNumber === 12) { tasks.push({ type: 'card', target: 1, label: 'Draw a task card' }); tasks.push({ type: 'worship', target: 1, label: 'Worship message' }); }
        if (dayNumber === 13) { tasks.push({ type: 'edge', target: 5, label: 'Edge 5 times' }); tasks.push({ type: 'gratitude', target: 5, label: 'Gratitude list (5 things)' }); }
        if (dayNumber === 14) { tasks.push({ type: 'tribute', target: 10, label: 'Tribute 10 coins' }); tasks.push({ type: 'confession', target: 1, label: 'Confession' }); }
    } else if (dayNumber <= 21) {
        if (dayNumber === 15) { tasks.push({ type: 'exercise', target: 50, label: 'Exercise: 50 pushups' }); tasks.push({ type: 'spin', target: 1, label: 'Spin the wheel' }); }
        if (dayNumber === 16) { tasks.push({ type: 'edge', target: 5, label: 'Edge 5 times' }); tasks.push({ type: 'lines', target: 75, label: 'Write lines x75' }); }
        if (dayNumber === 17) { tasks.push({ type: 'quiz', target: 1, label: "Quiz: Queen's rules" }); tasks.push({ type: 'journal', target: 1, label: 'Journal entry' }); }
        if (dayNumber === 18) { tasks.push({ type: 'tribute', target: 10, label: 'Tribute 10 coins' }); tasks.push({ type: 'corner_time', target: 15, label: 'Corner time 15min' }); }
        if (dayNumber === 19) { tasks.push({ type: 'body_writing', target: 1, label: 'Body writing photo' }); tasks.push({ type: 'card', target: 1, label: 'Draw a task card' }); }
        if (dayNumber === 20) { tasks.push({ type: 'cold_shower', target: 90, label: 'Cold shower 90s' }); tasks.push({ type: 'worship', target: 1, label: 'Worship message' }); tasks.push({ type: 'edge', target: 5, label: 'Edge 5x' }); }
        if (dayNumber === 21) { tasks.push({ type: 'denial', target: 1, label: 'Denial day (no touching 24h)' }); tasks.push({ type: 'confession', target: 1, label: 'Confession' }); }
    } else {
        if (dayNumber === 22) { tasks.push({ type: 'tribute', target: 15, label: 'Tribute 15 coins' }); tasks.push({ type: 'gratitude', target: 10, label: 'Gratitude list (10 things)' }); }
        if (dayNumber === 23) { tasks.push({ type: 'edge', target: 7, label: 'Edge 7 times' }); tasks.push({ type: 'spin', target: 1, label: 'Spin the wheel' }); tasks.push({ type: 'lines', target: 100, label: 'Write lines x100' }); }
        if (dayNumber === 24) { tasks.push({ type: 'exercise', target: 75, label: 'Exercise: 75 pushups' }); tasks.push({ type: 'body_writing', target: 1, label: 'Body writing' }); tasks.push({ type: 'journal', target: 1, label: 'Journal entry' }); }
        if (dayNumber === 25) { tasks.push({ type: 'card', target: 1, label: 'Draw a task card' }); tasks.push({ type: 'corner_time', target: 20, label: 'Corner time 20min' }); tasks.push({ type: 'worship', target: 1, label: 'Worship message' }); }
        if (dayNumber === 26) { tasks.push({ type: 'cold_shower', target: 120, label: 'Cold shower 120s' }); tasks.push({ type: 'edge', target: 7, label: 'Edge 7x' }); tasks.push({ type: 'tribute', target: 10, label: 'Tribute 10 coins' }); }
        if (dayNumber === 27) { tasks.push({ type: 'denial', target: 1, label: 'Denial day' }); tasks.push({ type: 'essay', target: 1, label: 'Essay: "What I\'ve learned"' }); }
        if (dayNumber === 28) { tasks.push({ type: 'quiz', target: 1, label: 'Quiz' }); tasks.push({ type: 'confession', target: 1, label: 'Confession' }); tasks.push({ type: 'spin', target: 1, label: 'Spin the wheel' }); tasks.push({ type: 'lines', target: 100, label: 'Lines x100' }); }
        if (dayNumber === 29) { tasks.push({ type: 'edge', target: 10, label: 'Edge 10 times' }); tasks.push({ type: 'tribute', target: 20, label: 'Tribute 20 coins' }); tasks.push({ type: 'exercise', target: 100, label: 'Exercise: 100 pushups' }); }
        if (dayNumber === 30) { tasks.push({ type: 'journal', target: 1, label: 'Final devotion journal' }); tasks.push({ type: 'worship', target: 1, label: 'Worship message' }); tasks.push({ type: 'gratitude', target: 10, label: 'Gratitude (10 things)' }); tasks.push({ type: 'body_writing', target: 1, label: 'Body writing' }); tasks.push({ type: 'tribute', target: 25, label: 'Tribute 25 coins' }); }
    }
    return tasks;
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
