import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/stories/admin?date=YYYY-MM-DD
// Returns all non-archived, currently active stories (uses expires_at so cross-midnight stories show)
// GET /api/stories/admin?vault=true
// Returns all non-archived vault stories (no expiry gate)
export async function GET(req: Request) {
    const url = new URL(req.url);
    const vault = url.searchParams.get('vault') === 'true';
    const now = new Date().toISOString();

    let query = supabaseAdmin
        .from('stories')
        .select('id, media_url, media_type, order_index, caption, tagged_members, expires_at, created_at, source, source_id, date, tier, tribute_price')
        .eq('archived', false)
        .order('created_at', { ascending: false });

    if (vault) {
        query = query.eq('source', 'vault');
    } else {
        query = query.neq('source', 'vault').gt('expires_at', now);
    }

    const { data, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ stories: data || [] });
}

// PATCH /api/stories/admin — reassign a story, set tribute price, etc.
export async function PATCH(req: Request) {
    const { id, source, tagged_members, expires_at, tier, tribute_price } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const update: Record<string, any> = {};
    if (source !== undefined) update.source = source;
    if (tagged_members !== undefined) update.tagged_members = tagged_members;
    if (expires_at !== undefined) update.expires_at = expires_at;
    if (tier !== undefined) update.tier = tier;
    if (tribute_price !== undefined) update.tribute_price = tribute_price;

    const { error } = await supabaseAdmin.from('stories').update(update).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}

// DELETE /api/stories/admin?id=xxx
// Archives (soft-deletes) a story by id
export async function DELETE(req: Request) {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { error } = await supabaseAdmin
        .from('stories')
        .update({ archived: true })
        .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
