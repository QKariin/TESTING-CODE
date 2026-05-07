import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DbService } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

export async function POST() {
    // Get all profiles
    const { data: profiles, error: profErr } = await supabaseAdmin
        .from('profiles')
        .select('ID, member_id, parameters, timezone');

    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });

    let updated = 0;
    const results: { email: string; consistency: number }[] = [];

    for (const p of (profiles || [])) {
        const email = (p.member_id || '').toLowerCase();
        if (!email) continue;

        try {
            await DbService.recalcConsistency(email, p.timezone || 'UTC');

            // Read back the updated value
            const { data: refreshed } = await supabaseAdmin
                .from('profiles')
                .select('parameters')
                .eq('ID', p.ID)
                .maybeSingle();

            const consistency = refreshed?.parameters?.consistency || 0;
            results.push({ email, consistency });
            updated++;
        } catch (e) {
            console.warn('[backfill] error for', email, e);
        }
    }

    return NextResponse.json({ success: true, updated, results });
}
