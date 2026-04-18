import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/paid-media/status?ids=uuid1,uuid2&email=sub@example.com
// Batch check unlock status for multiple paid media items
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const ids = (searchParams.get('ids') || '').split(',').filter(Boolean);
    const email = searchParams.get('email') || '';

    if (!ids.length || !email) {
        return NextResponse.json({ error: 'ids and email required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
        .from('paid_media')
        .select('id, is_unlocked, media_url')
        .in('id', ids)
        .ilike('member_id', email);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const statusMap: Record<string, { unlocked: boolean; mediaUrl?: string }> = {};
    (data || []).forEach((pm: any) => {
        statusMap[pm.id] = {
            unlocked: pm.is_unlocked === true,
            mediaUrl: pm.is_unlocked ? pm.media_url : undefined,
        };
    });

    return NextResponse.json({ statuses: statusMap });
}
