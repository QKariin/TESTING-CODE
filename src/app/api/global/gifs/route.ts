import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Uses Tenor API v1 — get a free key at https://tenor.com/developer
// Set TENOR_API_KEY in your .env.local — falls back to demo key for now
const TENOR_KEY = process.env.TENOR_API_KEY || 'LIVDSRZULELA';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() || 'funny';

    try {
        const url = `https://api.tenor.com/v1/search?q=${encodeURIComponent(q)}&key=${TENOR_KEY}&limit=24&media_filter=minimal&contentfilter=medium&ar_range=all`;
        const res = await fetch(url, { next: { revalidate: 30 } });
        if (!res.ok) return NextResponse.json({ results: [] });

        const data = await res.json();
        const results = (data.results || []).map((item: any) => {
            const tiny = item.media?.[0]?.tinygif;
            const full = item.media?.[0]?.gif;
            return {
                id: item.id,
                url: full?.url || tiny?.url || '',
                preview: tiny?.url || full?.url || '',
            };
        }).filter((r: any) => r.url);

        return NextResponse.json({ results });
    } catch {
        return NextResponse.json({ results: [] });
    }
}
