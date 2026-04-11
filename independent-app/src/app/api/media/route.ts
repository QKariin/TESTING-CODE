import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Do NOT use force-dynamic — allow Vercel CDN to cache responses
export const revalidate = 86400; // 24 hours

// GET /api/media?url=<supabase_public_url>
// For PUBLIC buckets: redirects directly to Supabase URL (zero proxy egress)
// For PRIVATE buckets: generates a signed URL and redirects (no file download through server)
// Falls back to proxy download only if signed URL fails
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const rawUrl = searchParams.get('url') || '';

        if (!rawUrl) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

        const match = rawUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?.*)?$/);
        if (!match) {
            // Not a Supabase URL — redirect directly
            return NextResponse.redirect(rawUrl);
        }

        const bucket = match[1];
        const filePath = decodeURIComponent(match[2]);

        // Try to generate a signed URL and redirect — no file passes through this server
        const { data: signData, error: signErr } = await supabaseAdmin.storage
            .from(bucket)
            .createSignedUrl(filePath, 3600);

        if (!signErr && signData?.signedUrl) {
            return NextResponse.redirect(signData.signedUrl, {
                headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' }
            });
        }

        // Last resort: proxy download (private bucket, signed URL failed)
        const { data, error } = await supabaseAdmin.storage.from(bucket).download(filePath);
        if (error || !data) {
            return NextResponse.json({ error: error?.message || 'Not found' }, { status: 404 });
        }

        const contentType = data.type || guessContentType(filePath);
        return new NextResponse(data, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400, s-maxage=86400',
            }
        });
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
