import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCaller, isCEO } from '@/lib/api-auth';
import { kneelTarget } from '@/lib/vault-program-defaults';

export const dynamic = 'force-dynamic';

/**
 * POST /api/vault/migrate-programs
 * One-shot migration: ensures every day in every vault_member_program has kneel + chastity_check.
 * CEO-only.
 */
export async function POST(req: NextRequest) {
    const caller = await getCaller();
    if (!caller || !isCEO(caller.email)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: programs, error } = await supabaseAdmin
        .from('vault_member_program')
        .select('id, program');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!programs || programs.length === 0) return NextResponse.json({ patched: 0, message: 'No programs found' });

    let patchedCount = 0;

    for (const row of programs) {
        const program: Record<string, any[]> = typeof row.program === 'string'
            ? JSON.parse(row.program)
            : (row.program || {});

        let changed = false;

        for (const [dayStr, tasks] of Object.entries(program)) {
            if (!Array.isArray(tasks)) continue;
            const dayNum = parseInt(dayStr, 10);

            if (!tasks.some((t: any) => t.type === 'kneel')) {
                const kt = kneelTarget(dayNum);
                tasks.unshift({ type: 'kneel', target: kt, label: `Kneel ${kt} times` });
                changed = true;
            }

            if (!tasks.some((t: any) => t.type === 'chastity_check')) {
                const kneelIdx = tasks.findIndex((t: any) => t.type === 'kneel');
                tasks.splice(kneelIdx + 1, 0, { type: 'chastity_check', target: 1, label: 'Chastity check-in' });
                changed = true;
            }
        }

        if (changed) {
            await supabaseAdmin.from('vault_member_program').update({
                program: JSON.stringify(program),
            }).eq('id', row.id);
            patchedCount++;
        }
    }

    // Also patch vault_program_template (the master template used by dashboard)
    let templatePatched = 0;
    const { data: tplRows } = await supabaseAdmin
        .from('vault_program_template')
        .select('id, day_number, tasks');

    if (tplRows) {
        for (const row of tplRows) {
            const tasks: any[] = typeof row.tasks === 'string' ? JSON.parse(row.tasks) : (row.tasks || []);
            let changed = false;

            if (!tasks.some((t: any) => t.type === 'kneel')) {
                const kt = kneelTarget(row.day_number);
                tasks.unshift({ type: 'kneel', target: kt, label: `Kneel ${kt} times` });
                changed = true;
            }

            if (!tasks.some((t: any) => t.type === 'chastity_check')) {
                const kneelIdx = tasks.findIndex((t: any) => t.type === 'kneel');
                tasks.splice(kneelIdx + 1, 0, { type: 'chastity_check', target: 1, label: 'Chastity check-in' });
                changed = true;
            }

            if (changed) {
                await supabaseAdmin.from('vault_program_template').update({
                    tasks: JSON.stringify(tasks),
                }).eq('id', row.id);
                templatePatched++;
            }
        }
    }

    return NextResponse.json({
        total: programs.length,
        patched: patchedCount,
        templatePatched,
        message: `Done. ${patchedCount} member programs + ${templatePatched} template days patched.`,
    });
}
