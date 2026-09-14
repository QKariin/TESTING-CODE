import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const TIER_WALLETS: Record<string, number> = {
    weekly: 5500,
    monthly: 9900,
    yearly: 30000,
};

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { tier } = await req.json();
        const wallet = TIER_WALLETS[tier];
        if (!wallet) return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });

        const userEmail = user.email?.trim().toLowerCase()
            || `${user.app_metadata?.provider || 'oauth'}_${user.user_metadata?.provider_id || user.id}@${user.app_metadata?.provider || 'oauth'}.com`;

        // Check if profile already exists
        const { data: existing } = await supabaseAdmin
            .from('profiles')
            .select('ID, wallet')
            .or(`ID.eq.${user.id},member_id.ilike.${userEmail}`)
            .maybeSingle();

        if (existing) {
            // Profile exists — just top up wallet
            const { error } = await supabaseAdmin
                .from('profiles')
                .update({ wallet: (existing.wallet || 0) + wallet, ID: user.id })
                .eq('ID', existing.ID);
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            console.log(`[patreon-activate] Topped up ${userEmail} +${wallet} (${tier})`);
            return NextResponse.json({ success: true, wallet: (existing.wallet || 0) + wallet });
        }

        // Create new profile
        const { error } = await supabaseAdmin.from('profiles').insert({
            ID: user.id,
            member_id: userEmail,
            name: user.user_metadata?.full_name || user.user_metadata?.name || userEmail.split('@')[0],
            hierarchy: 'Hall Boy',
            wallet,
            score: 0,
            parameters: { source: 'patreon', tier },
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // Create tasks row
        await supabaseAdmin.from('tasks').insert({
            ID: user.id,
            member_id: userEmail,
            'today kneeling': 0,
            kneelCount: 0,
        }).catch(() => {});

        console.log(`[patreon-activate] Created profile for ${userEmail} with ${wallet} coins (${tier})`);
        return NextResponse.json({ success: true, wallet });
    } catch (err: any) {
        console.error('[patreon-activate] error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
