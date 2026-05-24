import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';
import { DbService } from '@/lib/supabase-service';

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

    if (!['buy', 'use', 'gift'].includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    if (!['cumpass', 'skippass', 'checkpoint'].includes(item)) return NextResponse.json({ error: 'Invalid item' }, { status: 400 });

    const ADMIN_EMAILS = ['ceo@qkarin.com'];

    // Gift action: admin only, target a specific user
    if (action === 'gift') {
        if (!ADMIN_EMAILS.includes(callerEmail)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

        const { memberId, quantity } = body;
        if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 });
        const qty = Math.max(1, Number(quantity) || 1);

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);
        const { data: target } = isUuid
            ? await supabaseAdmin.from('profiles').select('cumpass, skippass, checkpoint, member_id').eq('ID', memberId).maybeSingle()
            : await supabaseAdmin.from('profiles').select('cumpass, skippass, checkpoint, member_id').ilike('member_id', memberId).maybeSingle();

        if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const current = Number(target[item as keyof typeof target] || 0);
        const { error: updateErr } = await supabaseAdmin
            .from('profiles')
            .update({ [item]: current + qty })
            .eq(isUuid ? 'ID' : 'member_id', memberId);

        if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

        // Send inventory card to chat
        const newCount = current + qty;
        const cardData = { item, source: 'gift', newCount };
        try { await DbService.sendMessage(memberId, `INVENTORY_CARD::${JSON.stringify(cardData)}`, 'system'); } catch (_) { }

        // Send push notification
        const ITEM_NAMES: Record<string, string> = { skippass: 'Skip Pass', cumpass: 'Cum Pass', checkpoint: 'Checkpoint' };
        const targetEmail = (target.member_id || '').toLowerCase();
        if (targetEmail) {
            const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '761d91da-b098-44a7-8d98-75c1cce54dd0';
            const apiKey = process.env.ONESIGNAL_REST_API_KEY;
            if (apiKey) {
                fetch('https://api.onesignal.com/notifications', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${apiKey}` },
                    body: JSON.stringify({
                        app_id: appId,
                        target_channel: 'push',
                        include_aliases: { external_id: [targetEmail] },
                        headings: { en: 'Queen Karin' },
                        contents: { en: `You received a ${ITEM_NAMES[item] || item} from Queen Karin.` },
                        url: 'https://throne.qkarin.com/profile',
                    }),
                }).catch(() => {});
            }
        }

        return NextResponse.json({ success: true, item, newCount });
    }

    // Fetch current profile for buy/use
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

        const newCount = (Number(profile[item as keyof typeof profile]) || 0) + 1;

        // Send inventory card to chat
        const cardData = { item, source: 'buy', price, newCount };
        // Look up user's UUID for message sending
        const { data: pLookup } = await supabaseAdmin.from('profiles').select('ID').ilike('member_id', callerEmail).maybeSingle();
        if (pLookup?.ID) {
            try { await DbService.sendMessage(pLookup.ID, `INVENTORY_CARD::${JSON.stringify(cardData)}`, 'system'); } catch (_) { }
        }

        return NextResponse.json({
            success: true,
            item,
            newCount,
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
