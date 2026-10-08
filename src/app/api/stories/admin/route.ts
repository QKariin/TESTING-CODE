import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/stories/admin?date=YYYY-MM-DD
// Returns all non-archived, currently active stories (uses expires_at so cross-midnight stories show)
export async function GET(req: Request) {
    const now = new Date().toISOString();

    const { data, error } = await supabaseAdmin
        .from('stories')
        .select('id, media_url, media_type, order_index, caption, tagged_members, expires_at, created_at, source, source_id, date')
        .eq('archived', false)
        .neq('source', 'vault')
        .gt('expires_at', now)
        .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ stories: data || [] });
}

// PATCH /api/stories/admin — reassign a vault story to public or a specific member
export async function PATCH(req: Request) {
    const { id, source, tagged_members, expires_at } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const update: Record<string, any> = {};
    if (source !== undefined) update.source = source;
    if (tagged_members !== undefined) update.tagged_members = tagged_members;
    if (expires_at !== undefined) update.expires_at = expires_at;

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
