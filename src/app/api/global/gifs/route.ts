import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GIPHY API — uses env key if set, falls back to public beta key
const GIPHY_KEY = process.env.GIPHY_API_KEY || 'dc6zaTOxFJmzC';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() || 'funny';

    try {
        const url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=24&rating=pg-13&lang=en`;
        const res = await fetch(url, { next: { revalidate: 30 } });
        if (!res.ok) {
            console.error('[gifs] GIPHY error:', res.status);
            return NextResponse.json({ results: [] });
        }

        const data = await res.json();
        const results = (data.data || []).map((item: any) => ({
            id: item.id,
            url: item.images?.original?.url || item.images?.downsized?.url || '',
            preview: item.images?.fixed_width_small?.url || item.images?.preview_gif?.url || '',
        })).filter((r: any) => r.url);

        return NextResponse.json({ results });
    } catch (e: any) {
        console.error('[gifs] error:', e.message);
        return NextResponse.json({ results: [] });
    }
}
