import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/stories/admin — currently active stories
// GET /api/stories/admin?all=true — ALL stories ever (expired, archived, vault) for the archive strip
export async function GET(req: Request) {
    const url = new URL(req.url);
    const all = url.searchParams.get('all') === 'true';
    const now = new Date().toISOString();

    let query = supabaseAdmin
        .from('stories')
        .select('id, media_url, media_type, order_index, caption, tagged_members, expires_at, created_at, source, source_id, date, tier, tribute_price, archived')
        .order('created_at', { ascending: false });

    if (all) {
        // ALL TIME: every single story ever posted, no filters — limit 500
        query = query.limit(500);
    } else {
        // ACTIVE: currently live stories only
        query = query.eq('archived', false).neq('source', 'vault').gt('expires_at', now);
    }

    const { data, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ stories: data || [] });
}

// PATCH /api/stories/admin — reassign a story, set tribute price, etc.
export async function PATCH(req: Request) {
    const { id, source, tagged_members, expires_at, tier, tribute_price, archived } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const update: Record<string, any> = {};
    if (source !== undefined) update.source = source;
    if (tagged_members !== undefined) update.tagged_members = tagged_members;
    if (expires_at !== undefined) update.expires_at = expires_at;
    if (tier !== undefined) update.tier = tier;
    if (tribute_price !== undefined) update.tribute_price = tribute_price;
    if (archived !== undefined) update.archived = archived;

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
