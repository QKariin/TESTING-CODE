import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/media?url=<supabase_public_url>
// Proxies Supabase storage files via service role - works even if bucket is private.
// Also used as onerror fallback for videos/images that fail to load directly.
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const rawUrl = searchParams.get('url') || '';

        if (!rawUrl) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

        // Extract bucket and path from Supabase storage URL
        // Format: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
        const match = rawUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?.*)?$/);
        if (!match) return NextResponse.json({ error: 'Not a Supabase storage URL' }, { status: 400 });

        const bucket = match[1];
        const filePath = decodeURIComponent(match[2]);

        const { data, error } = await supabaseAdmin.storage.from(bucket).download(filePath);
        if (error || !data) {
            console.error('[media proxy] download error:', error?.message);
            return NextResponse.json({ error: error?.message || 'Not found' }, { status: 404 });
        }

        const contentType = data.type || guessContentType(filePath);
        const headers: HeadersInit = {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400',
            'Accept-Ranges': 'bytes',
        };

        return new NextResponse(data, { status: 200, headers });
    } catch (err: any) {
        console.error('[media proxy] error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

function guessContentType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const map: Record<string, string> = {
        mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
    };
    return map[ext] || 'application/octet-stream';
}
