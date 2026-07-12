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

        // Create day 1 orders
        const orders = _generateDailyOrders(1);
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

        await _updateOrderDone(session.id, today, orderType, amount);

        // Save chastity check photo URL to vault_daily
        if (orderType === 'chastity_check' && photoUrl) {
            try {
                await supabaseAdmin.from('vault_daily').update({
                    chastity_photo: photoUrl,
                }).eq('session_id', session.id).eq('date', today);
            } catch (_) {}
        }

        return NextResponse.json({ success: true });
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

// Read orders from member's custom program, fall back to hardcoded
async function _getOrdersForDay(sessionId: string, dayNumber: number) {
    try {
        const { data: prog } = await supabaseAdmin
            .from('vault_member_program')
            .select('program')
            .eq('session_id', sessionId)
            .maybeSingle();
        if (prog?.program) {
            const program = typeof prog.program === 'string' ? JSON.parse(prog.program) : prog.program;
            const dayTasks = program[String(dayNumber)];
            if (dayTasks && Array.isArray(dayTasks) && dayTasks.length > 0) {
                // Convert to orders format (add done: 0)
                return dayTasks.map((t: any) => ({ type: t.type, target: t.target || 1, done: 0 }));
            }
        }
    } catch { }
    // Fallback to hardcoded
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
