import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCaller, isCEO } from '@/lib/api-auth';
import { DbService } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

// POST /api/vault/unlock — unlock a vault item for a user
// body: { memberId, vaultItemId?, source, random? }
// If random=true, picks a random locked item for the user
export async function POST(req: NextRequest) {
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { memberId, source } = body;
    let { vaultItemId } = body;

    if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 });

    // Only admin can gift, or system calls (risky game, leaderboard, milestone)
    const systemSources = ['risky_game', 'leaderboard', 'milestone'];
    if (!isCEO(caller.email) && !systemSources.includes(source)) {
        return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    // Resolve email
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);
    const { data: profile } = isUuid
        ? await supabaseAdmin.from('profiles').select('member_id, ID').eq('ID', memberId).maybeSingle()
        : await supabaseAdmin.from('profiles').select('member_id, ID').ilike('member_id', memberId).maybeSingle();

    if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const email = (profile.member_id || '').toLowerCase();

    // If random, pick a random item the user hasn't unlocked yet
    if (body.random) {
        const { data: allItems } = await supabaseAdmin.from('vault_items').select('id');
        const { data: unlocked } = await supabaseAdmin.from('vault_unlocks').select('vault_item_id').eq('member_id', email);

        const unlockedIds = new Set((unlocked || []).map((u: any) => u.vault_item_id));
        const available = (allItems || []).filter((i: any) => !unlockedIds.has(i.id));

        if (available.length === 0) {
            return NextResponse.json({ success: false, reason: 'all_unlocked' });
        }

        vaultItemId = available[Math.floor(Math.random() * available.length)].id;
    }

    if (!vaultItemId) return NextResponse.json({ error: 'Missing vaultItemId' }, { status: 400 });

    // Check item exists
    const { data: item } = await supabaseAdmin.from('vault_items').select('*').eq('id', vaultItemId).maybeSingle();
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    // Insert unlock (ignore duplicate)
    const { error } = await supabaseAdmin.from('vault_unlocks').insert({
        member_id: email,
        vault_item_id: vaultItemId,
        source: source || 'gift',
    });

    if (error && error.code !== '23505') { // 23505 = unique violation (already unlocked)
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Send chat card
    const cardData = {
        item: 'vault',
        title: item.title,
        thumbnail: item.thumbnail_url,
        source: source || 'gift',
        type: item.type,
    };
    try {
        await DbService.sendMessage(
            profile.ID || memberId,
            `VAULT_UNLOCK_CARD::${JSON.stringify(cardData)}`,
            'system'
        );
    } catch (_) {}

    // Push notification
    if (email) {
        const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '761d91da-b098-44a7-8d98-75c1cce54dd0';
        const apiKey = process.env.ONESIGNAL_REST_API_KEY;
        if (apiKey) {
            fetch('https://api.onesignal.com/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${apiKey}` },
                body: JSON.stringify({
                    app_id: appId,
                    target_channel: 'push',
                    include_aliases: { external_id: [email] },
                    headings: { en: 'Queen Karin' },
                    contents: { en: `A new item was added to your Vault.` },
                    url: 'https://throne.qkarin.com/profile',
                }),
            }).catch(() => {});
        }
    }

    return NextResponse.json({
        success: true,
        vaultItemId,
        title: item.title,
        type: item.type,
    });
}
