// POST /api/admin/backfill-tiers
// One-shot migration: stamp subscriptionTier onto every existing profile
//
// Logic:
//   - Any profile with wallet > 0 OR score > 0 → 'property'  (they paid, full access)
//   - Any profile with wallet = 0 AND score = 0 → skip (no payment evidence)
//   - Never overwrites an already-set subscriptionTier

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCaller, isCEO } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    const caller = await getCaller();
    if (!caller || !isCEO(caller.email)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all profiles that don't yet have a subscriptionTier set
    const { data: profiles, error } = await supabaseAdmin
        .from('profiles')
        .select('ID, wallet, score, parameters')
        .or('parameters->>subscriptionTier.is.null,parameters->>subscriptionTier.eq.');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let stamped = 0;
    let skipped = 0;

    for (const profile of (profiles || [])) {
        const hasPaid = Number(profile.wallet || 0) > 0 || Number(profile.score || 0) > 0;
        if (!hasPaid) { skipped++; continue; }

        const params = profile.parameters || {};
        params.subscriptionTier = 'property';

        await supabaseAdmin
            .from('profiles')
            .update({ parameters: params })
            .eq('ID', profile.ID);

        stamped++;
    }

    return NextResponse.json({
        success: true,
        stamped,
        skipped,
        message: `${stamped} profiles set to property tier. ${skipped} skipped (no payment evidence).`,
    });
}
