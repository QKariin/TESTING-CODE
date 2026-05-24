import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';

const CUMPASS_PRICES: Record<string, number> = {
    'hall boy': 500,
    'footman': 750,
    'silverman': 1000,
    'butler': 1500,
    'chamberlain': 2500,
    'secretary': 4000,
    "queen's champion": 5000,
};

const CHECKPOINT_PRICES: Record<string, number> = {
    'footman': 2000,
    'silverman': 4000,
    'butler': 8000,
    'chamberlain': 16000,
    'secretary': 32000,
    "queen's champion": 64000,
};

function getPrice(item: string, rank: string): number | null {
    const r = rank.toLowerCase();
    if (item === 'cumpass') return CUMPASS_PRICES[r] ?? null;
    if (item === 'checkpoint') return CHECKPOINT_PRICES[r] ?? null;
    return null; // skippass is never buyable
}

async function getCallerEmail(): Promise<string | null> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        let email = user?.email?.toLowerCase() || null;
        if (!email && user?.id) {
            const { data: p } = await supabaseAdmin.from('profiles').select('member_id').eq('ID', user.id).maybeSingle();
            if (p?.member_id) email = p.member_id.toLowerCase();
        }
        return email;
    } catch { return null; }
}

export async function POST(request: NextRequest) {
    const callerEmail = await getCallerEmail();
    if (!callerEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { action, item } = body; // action: 'buy' | 'use', item: 'cumpass' | 'skippass' | 'checkpoint'

    if (!['buy', 'use'].includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    if (!['cumpass', 'skippass', 'checkpoint'].includes(item)) return NextResponse.json({ error: 'Invalid item' }, { status: 400 });

    // Fetch current profile
    const { data: profile, error: pErr } = await supabaseAdmin
        .from('profiles')
        .select('wallet, hierarchy, cumpass, skippass, checkpoint')
        .ilike('member_id', callerEmail)
        .maybeSingle();

    if (pErr || !profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const rank = (profile.hierarchy || 'Hall Boy').toLowerCase();

    if (action === 'buy') {
        if (item === 'skippass') return NextResponse.json({ error: 'Skip passes cannot be purchased' }, { status: 400 });

        const price = getPrice(item, rank);
        if (price === null) return NextResponse.json({ error: 'Item not available at your rank' }, { status: 400 });

        const wallet = Number(profile.wallet || 0);
        if (wallet < price) return NextResponse.json({ error: 'Insufficient coins', needed: price, wallet }, { status: 400 });

        // Deduct coins and add item
        const { error: updateErr } = await supabaseAdmin
            .from('profiles')
            .update({
                wallet: wallet - price,
                [item]: (Number(profile[item as keyof typeof profile]) || 0) + 1,
            })
            .ilike('member_id', callerEmail);

        if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

        return NextResponse.json({
            success: true,
            item,
            newCount: (Number(profile[item as keyof typeof profile]) || 0) + 1,
            newWallet: wallet - price,
            price,
        });
    }

    if (action === 'use') {
        const current = Number(profile[item as keyof typeof profile] || 0);
        if (current <= 0) return NextResponse.json({ error: 'No passes available' }, { status: 400 });

        // Decrement item count
        const { error: updateErr } = await supabaseAdmin
            .from('profiles')
            .update({ [item]: current - 1 })
            .ilike('member_id', callerEmail);

        if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

        return NextResponse.json({
            success: true,
            item,
            newCount: current - 1,
        });
    }
}
