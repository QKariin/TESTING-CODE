import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const QUEEN_EMAILS = ['ceo@qkarin.com'];

// Returns all video messages posted by the queen in global chat
export async function GET() {
    const { data, error } = await supabaseAdmin
        .from('global_messages')
        .select('*')
        .in('sender_email', QUEEN_EMAILS)
        .not('media_url', 'is', null)
        .ilike('media_type', '%video%')
        .not('created_at', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const videos = (data || []).map((row: any) => ({
        id: row.id,
        message: row.message,
        media_url: row.media_url,
        media_type: row.media_type,
        thumbnail_url: row.thumbnail_url,
        created_at: row.created_at,
        sender_name: row.sender_name || 'QUEEN KARIN',
        sender_avatar: row.sender_avatar || '/queen-karin.png',
    }));

    return NextResponse.json({ videos });
}
