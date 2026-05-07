import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DbService } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

async function runBackfill() {
    const { data: profiles, error: profErr } = await supabaseAdmin
        .from('profiles')
        .select('ID, member_id, parameters');

    if (profErr) return { error: profErr.message };

    let updated = 0;
    const results: { email: string; consistency: number }[] = [];

    for (const p of (profiles || [])) {
        const email = (p.member_id || '').toLowerCase();
        if (!email) continue;

        try {
            // Get user's timezone from profile if available
            let tz = 'UTC';
            try {
                const { data: tzProf } = await supabaseAdmin
                    .from('profiles')
                    .select('timezone')
                    .eq('ID', p.ID)
                    .maybeSingle();
                if (tzProf?.timezone) tz = tzProf.timezone;
            } catch { /* timezone column may not exist */ }

            await DbService.recalcConsistency(email, tz);

            // Read back the updated value
            const { data: refreshed } = await supabaseAdmin
                .from('profiles')
                .select('parameters')
                .eq('ID', p.ID)
                .maybeSingle();

            const consistency = refreshed?.parameters?.consistency || 0;
            results.push({ email, consistency });
            updated++;
        } catch (e: any) {
            console.warn('[backfill] error for', email, e?.message || e);
            results.push({ email, consistency: -1 });
        }
    }

    return { success: true, updated, results };
}

export async function POST() {
    const result = await runBackfill();
    return NextResponse.json(result);
}

export async function GET() {
    const result = await runBackfill();
    return NextResponse.json(result);
}
