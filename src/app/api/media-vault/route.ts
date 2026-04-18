import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET — list all vault items, optionally filtered by category
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || '';

    let query = supabaseAdmin
        .from('media_vault')
        .select('*')
        .order('created_at', { ascending: false });

    if (category && category !== 'all') {
        query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ items: data || [] });
}

// POST — add a new item to the vault
export async function POST(req: Request) {
    const { mediaUrl, mediaType, thumbnailUrl, category, uploaderEmail } = await req.json();

    if (!mediaUrl) {
        return NextResponse.json({ error: 'mediaUrl required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
        .from('media_vault')
        .insert({
            media_url: mediaUrl,
            media_type: mediaType || 'photo',
            thumbnail_url: thumbnailUrl || null,
            category: category || 'uncategorized',
            uploader_email: uploaderEmail || 'unknown',
        })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, item: data });
}

// DELETE — remove a vault item
export async function DELETE(req: Request) {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { error } = await supabaseAdmin
        .from('media_vault')
        .delete()
        .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
