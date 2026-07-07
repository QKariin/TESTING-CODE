import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Tenor API v2 — requires a Google API key with Tenor API enabled
// Get one at https://console.cloud.google.com/ → APIs & Services → Tenor API
const TENOR_KEY = process.env.TENOR_API_KEY || '';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() || 'funny';

    if (!TENOR_KEY) {
        console.error('[gifs] TENOR_API_KEY not set');
        return NextResponse.json({ results: [] });
    }

    try {
        const url = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${TENOR_KEY}&client_key=throne&limit=24&contentfilter=medium&media_filter=gif,tinygif`;
        const res = await fetch(url, { next: { revalidate: 30 } });
        if (!res.ok) {
            console.error('[gifs] Tenor v2 error:', res.status, await res.text().catch(() => ''));
            return NextResponse.json({ results: [] });
        }

        const data = await res.json();
        const results = (data.results || []).map((item: any) => {
            const tiny = item.media_formats?.tinygif;
            const full = item.media_formats?.gif;
            return {
                id: item.id,
                url: full?.url || tiny?.url || '',
                preview: tiny?.url || full?.url || '',
            };
        }).filter((r: any) => r.url);

        return NextResponse.json({ results });
    } catch (e: any) {
        console.error('[gifs] error:', e.message);
        return NextResponse.json({ results: [] });
    }
}
