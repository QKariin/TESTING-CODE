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

    return NextResponse.json({
        total: programs.length,
        patched: patchedCount,
        message: `Done. ${patchedCount} programs patched with kneel + chastity_check on every day.`,
    });
}
