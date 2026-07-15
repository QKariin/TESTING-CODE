import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { defaultDayTasks, generateDefaultProgram } from '@/lib/vault-program-defaults';

export const dynamic = 'force-dynamic';

// GET /api/vault/program?memberId=xxx  — get a user's 30-day program
// GET /api/vault/program?template=true — get the master template
// GET /api/vault/program?config=true   — get vault_config (spin wheel, cards, etc.)
export async function GET(req: NextRequest) {
    const memberId = req.nextUrl.searchParams.get('memberId');
    const isTemplate = req.nextUrl.searchParams.get('template') === 'true';
    const isConfig = req.nextUrl.searchParams.get('config') === 'true';
    const listLocked = req.nextUrl.searchParams.get('listLocked') === 'true';

    // ── LIST ALL LOCKED MEMBERS ──
    if (listLocked) {
        const { data: sessions } = await supabaseAdmin
            .from('vault_sessions')
            .select('id, member_id, started_at, lock_days, expires_at, current_streak, total_perfect_days, tier, status')
            .in('status', ['active', 'awaiting_video'])
            .order('started_at', { ascending: false });

        if (!sessions || sessions.length === 0) return NextResponse.json({ locked: [] });

        const today = new Date().toISOString().split('T')[0];
        const results = [];

        for (const s of sessions) {
            const daysIn = Math.floor((Date.now() - new Date(s.started_at).getTime()) / 86400000) + 1;
            // Get today's daily record
            const { data: todayRec } = await supabaseAdmin
                .from('vault_daily')
                .select('orders, orders_completed, orders_total, perfect')
                .eq('session_id', s.id)
                .eq('date', today)
                .maybeSingle();

            // Get profile name
            const { data: prof } = await supabaseAdmin
                .from('profiles')
                .select('name, title, avatar_url, profile_picture_url')
                .ilike('member_id', s.member_id)
                .maybeSingle();

            const orders = todayRec?.orders ? (typeof todayRec.orders === 'string' ? JSON.parse(todayRec.orders) : todayRec.orders) : [];
            const completed = orders.filter((o: any) => o.done >= o.target).length;

            results.push({
                memberId: s.member_id,
                name: prof?.name || prof?.title || s.member_id.split('@')[0],
                avatar: prof?.profile_picture_url || prof?.avatar_url || null,
                daysIn,
                lockDays: s.lock_days,
                streak: s.current_streak || 0,
                todayTotal: orders.length,
                todayDone: completed,
                todayPerfect: todayRec?.perfect || false,
                tier: s.tier,
            });
        }

        return NextResponse.json({ locked: results });
    }

    // ── GET CONFIG (spin wheel, cards, quiz, etc.) ──
    if (isConfig) {
        const { data } = await supabaseAdmin
            .from('vault_config')
            .select('*')
            .order('key');
        return NextResponse.json({ config: data || [] });
    }

    // ── GET TEMPLATE (master formula) ──
    if (isTemplate) {
        const { data } = await supabaseAdmin
            .from('vault_program_template')
            .select('*')
            .order('day_number');
        return NextResponse.json({ template: data || [] });
    }

    // ── GET MEMBER PROGRAM ──
    if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 });

    const email = memberId.toLowerCase();
    const { data: session } = await supabaseAdmin
        .from('vault_sessions')
        .select('id')
        .ilike('member_id', email)
        .in('status', ['active', 'awaiting_video'])
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!session) return NextResponse.json({ program: null, message: 'No active session' });

    let { data: prog } = await supabaseAdmin
        .from('vault_member_program')
        .select('*')
        .eq('session_id', session.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    // Auto-regenerate if program is stale (old format without configs) or missing
    if (prog?.program) {
        const program = typeof prog.program === 'string' ? JSON.parse(prog.program) : prog.program;
        const day1 = program['1'];
        const isStale = !day1 || day1.length === 0 || !day1.some((t: any) => t.config);
        if (isStale) {
            console.log(`[vault program GET] Stale program detected for ${email}, regenerating from template...`);
            // Read template
            const freshProgram: Record<string, any[]> = {};
            const { data: template } = await supabaseAdmin
                .from('vault_program_template').select('*').order('day_number');
            if (template && template.length > 0) {
                for (const row of template) {
                    freshProgram[String(row.day_number)] = typeof row.tasks === 'string' ? JSON.parse(row.tasks) : row.tasks;
                }
            } else {
                Object.assign(freshProgram, generateDefaultProgram());
            }
            await supabaseAdmin.from('vault_member_program').update({
                program: JSON.stringify(freshProgram),
            }).eq('id', prog.id);
            prog = { ...prog, program: JSON.stringify(freshProgram) };
        }
    } else if (!prog) {
        // No program at all — generate fresh
        console.log(`[vault program GET] No program for ${email}, generating fresh...`);
        const freshProgram: Record<string, any[]> = {};
        const { data: template } = await supabaseAdmin
            .from('vault_program_template').select('*').order('day_number');
        if (template && template.length > 0) {
            for (const row of template) {
                freshProgram[String(row.day_number)] = typeof row.tasks === 'string' ? JSON.parse(row.tasks) : row.tasks;
            }
        } else {
            Object.assign(freshProgram, generateDefaultProgram());
        }
        const { data: newProg } = await supabaseAdmin.from('vault_member_program').insert({
            session_id: session.id, member_id: email,
            program: JSON.stringify(freshProgram),
        }).select('*').single();
        prog = newProg;
    }

    return NextResponse.json({ program: prog });
}

// POST /api/vault/program
// Actions: save_template, generate_program, update_day, save_config
export async function POST(req: NextRequest) {
    const body = await req.json();
    const { action } = body;

    // ── SAVE TEMPLATE (the master formula) ──
    if (action === 'save_template') {
        const { days } = body; // { "1": [...tasks], "2": [...], ... "30": [...] }
        if (!days) return NextResponse.json({ error: 'Missing days' }, { status: 400 });

        // Delete old template
        await supabaseAdmin.from('vault_program_template').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        // Insert new rows
        const rows: any[] = [];
        for (const [dayNum, tasks] of Object.entries(days)) {
            rows.push({
                day_number: parseInt(dayNum),
                tasks: JSON.stringify(tasks),
            });
        }
        const { error } = await supabaseAdmin.from('vault_program_template').insert(rows);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // Auto-regenerate programs for all active sessions from new template
        try {
            const { data: activeSessions } = await supabaseAdmin
                .from('vault_sessions')
                .select('id, member_id')
                .in('status', ['active', 'awaiting_video']);
            if (activeSessions && activeSessions.length > 0) {
                for (const s of activeSessions) {
                    await supabaseAdmin.from('vault_member_program').delete().eq('session_id', s.id);
                    await supabaseAdmin.from('vault_member_program').insert({
                        session_id: s.id,
                        member_id: s.member_id,
                        program: JSON.stringify(days),
                    });
                }
                console.log(`[vault] Regenerated programs for ${activeSessions.length} active sessions from new template`);
            }
        } catch (e: any) {
            console.error('[vault] Failed to regenerate active programs:', e?.message);
        }

        return NextResponse.json({ success: true });
    }

    // ── GENERATE PROGRAM FOR USER (from template) ──
    if (action === 'generate_program') {
        const { memberId } = body;
        if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 });

        const email = memberId.toLowerCase();
        const { data: session } = await supabaseAdmin
            .from('vault_sessions')
            .select('id')
            .ilike('member_id', email)
            .in('status', ['active', 'awaiting_video'])
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!session) return NextResponse.json({ error: 'No active session' }, { status: 400 });

        // Read template
        const { data: template } = await supabaseAdmin
            .from('vault_program_template')
            .select('*')
            .order('day_number');

        // Build program JSON from template
        const program: Record<string, any[]> = {};
        if (template && template.length > 0) {
            for (const row of template) {
                const tasks = typeof row.tasks === 'string' ? JSON.parse(row.tasks) : row.tasks;
                program[String(row.day_number)] = tasks;
            }
        } else {
            // Fallback: use shared defaults (same as dashboard)
            const defaults = generateDefaultProgram();
            Object.assign(program, defaults);
        }

        // Delete old program and insert fresh copy from template
        await supabaseAdmin.from('vault_member_program').delete().eq('session_id', session.id);
        await supabaseAdmin.from('vault_member_program').insert({
            session_id: session.id,
            member_id: email,
            program: JSON.stringify(program),
        });

        return NextResponse.json({ success: true, program });
    }

    // ── UPDATE SINGLE DAY FOR USER ──
    if (action === 'update_day') {
        const { memberId, dayNumber, tasks } = body;
        if (!memberId || !dayNumber || !tasks) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

        const email = memberId.toLowerCase();
        const { data: session } = await supabaseAdmin
            .from('vault_sessions')
            .select('id')
            .ilike('member_id', email)
            .in('status', ['active', 'awaiting_video'])
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!session) return NextResponse.json({ error: 'No active session' }, { status: 400 });

        let { data: prog } = await supabaseAdmin
            .from('vault_member_program')
            .select('*')
            .eq('session_id', session.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        let program: Record<string, any>;
        if (!prog) {
            // Auto-create program if it doesn't exist
            program = generateDefaultProgram();
            const { data: created } = await supabaseAdmin.from('vault_member_program').insert({
                session_id: session.id,
                member_id: email,
                program: JSON.stringify(program),
            }).select('id').single();
            if (!created) return NextResponse.json({ error: 'Failed to create program' }, { status: 500 });
            prog = { id: created.id, program };
        } else {
            program = typeof prog.program === 'string' ? JSON.parse(prog.program) : prog.program;
        }
        program[String(dayNumber)] = tasks;

        await supabaseAdmin.from('vault_member_program').update({
            program: JSON.stringify(program),
        }).eq('id', prog.id);

        // If editing today's day, also update the live vault_daily record
        try {
            const { data: fullSession } = await supabaseAdmin
                .from('vault_sessions').select('started_at').eq('id', session.id).single();
            if (fullSession?.started_at) {
                const daysIn = Math.floor((Date.now() - new Date(fullSession.started_at).getTime()) / 86400000) + 1;
                if (daysIn === dayNumber) {
                    const today = new Date().toISOString().split('T')[0];
                    const { data: daily } = await supabaseAdmin
                        .from('vault_daily').select('id, orders')
                        .eq('session_id', session.id).eq('date', today).maybeSingle();
                    if (daily) {
                        // Merge new tasks while preserving progress (done counts)
                        const oldOrders: any[] = typeof daily.orders === 'string' ? JSON.parse(daily.orders) : (daily.orders || []);
                        const newOrders = tasks.map((t: any) => {
                            const existing = oldOrders.find((o: any) => o.type === t.type);
                            return { type: t.type, target: t.target || 1, done: existing?.done || 0 };
                        });
                        const completed = newOrders.filter((o: any) => o.done >= o.target).length;
                        await supabaseAdmin.from('vault_daily').update({
                            orders: JSON.stringify(newOrders),
                            orders_total: newOrders.length,
                            orders_completed: completed,
                            perfect: completed >= newOrders.length,
                        }).eq('id', daily.id);
                    }
                }
            }
        } catch (_) {}

        return NextResponse.json({ success: true });
    }

    // ── SAVE CONFIG (spin wheel, cards, quiz, etc.) ──
    if (action === 'save_config') {
        const { key, value } = body;
        if (!key || !value) return NextResponse.json({ error: 'Missing key/value' }, { status: 400 });

        // Upsert by key
        const { data: existing } = await supabaseAdmin
            .from('vault_config')
            .select('id')
            .eq('key', key)
            .maybeSingle();

        if (existing) {
            await supabaseAdmin.from('vault_config').update({
                value: JSON.stringify(value),
                updated_at: new Date().toISOString(),
            }).eq('id', existing.id);
        } else {
            await supabaseAdmin.from('vault_config').insert({
                key,
                value: JSON.stringify(value),
                updated_at: new Date().toISOString(),
            });
        }

        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// Old defaults removed — now using shared @/lib/vault-program-defaults
