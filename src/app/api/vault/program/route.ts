import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/vault/program?memberId=xxx  — get a user's 30-day program
// GET /api/vault/program?template=true — get the master template
// GET /api/vault/program?config=true   — get vault_config (spin wheel, cards, etc.)
export async function GET(req: NextRequest) {
    const memberId = req.nextUrl.searchParams.get('memberId');
    const isTemplate = req.nextUrl.searchParams.get('template') === 'true';
    const isConfig = req.nextUrl.searchParams.get('config') === 'true';

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
        .eq('member_id', email)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!session) return NextResponse.json({ program: null, message: 'No active session' });

    const { data: prog } = await supabaseAdmin
        .from('vault_member_program')
        .select('*')
        .eq('session_id', session.id)
        .maybeSingle();

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
            .eq('member_id', email)
            .eq('status', 'active')
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
            // Fallback: generate from hardcoded defaults if no template exists
            for (let d = 1; d <= 30; d++) {
                program[String(d)] = _defaultDayTasks(d);
            }
        }

        // Upsert member program
        const { data: existing } = await supabaseAdmin
            .from('vault_member_program')
            .select('id')
            .eq('session_id', session.id)
            .maybeSingle();

        if (existing) {
            await supabaseAdmin.from('vault_member_program').update({
                program: JSON.stringify(program),
            }).eq('id', existing.id);
        } else {
            await supabaseAdmin.from('vault_member_program').insert({
                session_id: session.id,
                member_id: email,
                program: JSON.stringify(program),
            });
        }

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
            .eq('member_id', email)
            .eq('status', 'active')
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!session) return NextResponse.json({ error: 'No active session' }, { status: 400 });

        const { data: prog } = await supabaseAdmin
            .from('vault_member_program')
            .select('*')
            .eq('session_id', session.id)
            .maybeSingle();

        if (!prog) return NextResponse.json({ error: 'No program found. Generate first.' }, { status: 400 });

        const program = typeof prog.program === 'string' ? JSON.parse(prog.program) : prog.program;
        program[String(dayNumber)] = tasks;

        await supabaseAdmin.from('vault_member_program').update({
            program: JSON.stringify(program),
        }).eq('id', prog.id);

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

// ── Default task generator (fallback if no template) ──
function _defaultDayTasks(dayNumber: number) {
    const tasks: { type: string; target: number; label: string }[] = [
        { type: 'kneel', target: _kneelTarget(dayNumber), label: `Kneel ${_kneelTarget(dayNumber)} times` },
        { type: 'chastity_check', target: 1, label: 'Chastity check photo' },
    ];

    // Phase 1 (1-7)
    if (dayNumber <= 7) {
        if (dayNumber === 1) tasks.push({ type: 'journal', target: 1, label: 'Journal: "Why I submitted"' });
        if (dayNumber === 2) tasks.push({ type: 'spin', target: 1, label: 'Spin the wheel' });
        if (dayNumber === 3) tasks.push({ type: 'lines', target: 30, label: 'Write lines x30' });
        if (dayNumber === 4) tasks.push({ type: 'tribute', target: 3, label: 'Tribute 3 coins' });
        if (dayNumber === 5) tasks.push({ type: 'worship', target: 1, label: 'Worship message' });
        if (dayNumber === 6) tasks.push({ type: 'card', target: 1, label: 'Draw a task card' });
        if (dayNumber === 7) { tasks.push({ type: 'cold_shower', target: 60, label: 'Cold shower 60s' }); tasks.push({ type: 'confession', target: 1, label: 'Confession' }); }
    }
    // Phase 2 (8-14)
    else if (dayNumber <= 14) {
        if (dayNumber === 8) { tasks.push({ type: 'edge', target: 3, label: 'Edge 3 times' }); tasks.push({ type: 'journal', target: 1, label: 'Journal entry' }); }
        if (dayNumber === 9) { tasks.push({ type: 'spin', target: 1, label: 'Spin the wheel' }); tasks.push({ type: 'tribute', target: 5, label: 'Tribute 5 coins' }); }
        if (dayNumber === 10) { tasks.push({ type: 'lines', target: 50, label: 'Write lines x50' }); tasks.push({ type: 'corner_time', target: 10, label: 'Corner time 10min' }); }
        if (dayNumber === 11) tasks.push({ type: 'body_writing', target: 1, label: 'Body writing photo: OWNED' });
        if (dayNumber === 12) { tasks.push({ type: 'card', target: 1, label: 'Draw a task card' }); tasks.push({ type: 'worship', target: 1, label: 'Worship message' }); }
        if (dayNumber === 13) { tasks.push({ type: 'edge', target: 5, label: 'Edge 5 times' }); tasks.push({ type: 'gratitude', target: 5, label: 'Gratitude list (5 things)' }); }
        if (dayNumber === 14) { tasks.push({ type: 'tribute', target: 10, label: 'Tribute 10 coins' }); tasks.push({ type: 'confession', target: 1, label: 'Confession' }); }
    }
    // Phase 3 (15-21)
    else if (dayNumber <= 21) {
        if (dayNumber === 15) { tasks.push({ type: 'exercise', target: 50, label: 'Exercise: 50 pushups' }); tasks.push({ type: 'spin', target: 1, label: 'Spin the wheel' }); }
        if (dayNumber === 16) { tasks.push({ type: 'edge', target: 5, label: 'Edge 5 times' }); tasks.push({ type: 'lines', target: 75, label: 'Write lines x75' }); }
        if (dayNumber === 17) { tasks.push({ type: 'quiz', target: 1, label: 'Quiz: Queen\'s rules' }); tasks.push({ type: 'journal', target: 1, label: 'Journal entry' }); }
        if (dayNumber === 18) { tasks.push({ type: 'tribute', target: 10, label: 'Tribute 10 coins' }); tasks.push({ type: 'corner_time', target: 15, label: 'Corner time 15min' }); }
        if (dayNumber === 19) { tasks.push({ type: 'body_writing', target: 1, label: 'Body writing photo' }); tasks.push({ type: 'card', target: 1, label: 'Draw a task card' }); }
        if (dayNumber === 20) { tasks.push({ type: 'cold_shower', target: 90, label: 'Cold shower 90s' }); tasks.push({ type: 'worship', target: 1, label: 'Worship message' }); tasks.push({ type: 'edge', target: 5, label: 'Edge 5x' }); }
        if (dayNumber === 21) { tasks.push({ type: 'denial', target: 1, label: 'Denial day (no touching 24h)' }); tasks.push({ type: 'confession', target: 1, label: 'Confession' }); }
    }
    // Phase 4 (22-30)
    else {
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
