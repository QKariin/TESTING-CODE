import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCaller, isCEO, isOwnerOrCEO } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// GET /api/vault?memberId=xxx  — fetch all vault items with unlock status for a user
// GET /api/vault               — admin: fetch all items with unlock counts
export async function GET(req: NextRequest) {
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const memberId = req.nextUrl.searchParams.get('memberId');

    // Fetch all vault items
    const { data: items, error } = await supabaseAdmin
        .from('vault_items')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (memberId) {
        // User view: return items with their unlock status
        if (!isOwnerOrCEO(caller, memberId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const email = memberId.toLowerCase();
        const { data: unlocks } = await supabaseAdmin
            .from('vault_unlocks')
            .select('vault_item_id, source, unlocked_at')
            .eq('member_id', email);

        const unlockMap = new Map((unlocks || []).map((u: any) => [u.vault_item_id, u]));

        const result = (items || []).map((item: any) => ({
            id: item.id,
            title: item.title,
            type: item.type,
            thumbnail_url: item.thumbnail_url,
            media_url: unlockMap.has(item.id) ? item.media_url : null,
            unlocked: unlockMap.has(item.id),
            source: unlockMap.get(item.id)?.source || null,
            unlocked_at: unlockMap.get(item.id)?.unlocked_at || null,
        }));

        return NextResponse.json({ items: result });
    }

    // Admin view: return all items with unlock counts
    if (!isCEO(caller.email)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const { data: unlocks } = await supabaseAdmin
        .from('vault_unlocks')
        .select('vault_item_id');

    const countMap = new Map<string, number>();
    (unlocks || []).forEach((u: any) => countMap.set(u.vault_item_id, (countMap.get(u.vault_item_id) || 0) + 1));

    const result = (items || []).map((item: any) => ({
        ...item,
        unlock_count: countMap.get(item.id) || 0,
    }));

    return NextResponse.json({ items: result });
}

// POST /api/vault — admin: add a new item to the vault pool
export async function POST(req: NextRequest) {
    const caller = await getCaller();
    if (!caller || !isCEO(caller.email)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json();
    const { media_url, thumbnail_url, type, title } = body;

    if (!media_url) return NextResponse.json({ error: 'Missing media_url' }, { status: 400 });

    const { data, error } = await supabaseAdmin
        .from('vault_items')
        .insert({
            media_url,
            thumbnail_url: thumbnail_url || null,
            type: type || 'photo',
            title: title || 'Exclusive',
        })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, item: data });
}

// DELETE /api/vault — admin: remove an item from the pool
export async function DELETE(req: NextRequest) {
    const caller = await getCaller();
    if (!caller || !isCEO(caller.email)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { error } = await supabaseAdmin.from('vault_items').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
}
