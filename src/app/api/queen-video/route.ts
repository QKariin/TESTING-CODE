import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCaller } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// GET /api/queen-video?date=YYYY-MM-DD — fetch today's video (or specific date)
export async function GET(req: Request) {
    const url = new URL(req.url);
    const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

    try {
        const { data } = await supabaseAdmin
            .from('queen_daily_videos')
            .select('*')
            .eq('date', date)
            .maybeSingle();
        return NextResponse.json({ video: data || null });
    } catch {
        return NextResponse.json({ video: null });
    }
}

// POST /api/queen-video — save today's video (admin only)
export async function POST(req: Request) {
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { videoUrl, thumbUrl, message, date } = await req.json();
    if (!videoUrl) return NextResponse.json({ error: 'Missing videoUrl' }, { status: 400 });

    const videoDate = date || new Date().toISOString().split('T')[0];

    const { data, error } = await supabaseAdmin
        .from('queen_daily_videos')
        .upsert(
            { date: videoDate, video_url: videoUrl, thumb_url: thumbUrl || null, message: message || null },
            { onConflict: 'date' }
        )
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, video: data });
}
