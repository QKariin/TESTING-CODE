import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get('url');
    if (!url || !url.startsWith('http')) return NextResponse.json({});

    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Twitterbot/1.0)' },
            signal: AbortSignal.timeout(4000),
        });
        if (!res.ok) return NextResponse.json({});
        const html = await res.text();

        const og = (prop: string): string => {
            const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']{1,500})["']`, 'i'))
                  || html.match(new RegExp(`<meta[^>]+content=["']([^"']{1,500})["'][^>]+(?:property|name)=["']${prop}["']`, 'i'));
            return m ? m[1].trim() : '';
        };

        const title = og('og:title') || html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1]?.trim() || '';
        const description = og('og:description') || og('description');
        const image = og('og:image');

        return NextResponse.json({ title, description, image }, {
            headers: { 'Cache-Control': 'public, max-age=3600' },
        });
    } catch {
        return NextResponse.json({});
    }
}
