import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/media?url=<supabase_storage_url>
// GET /api/media?bucket=media&path=task-proofs/user/file.jpg  (direct form)
//
// Strategy: create a fresh signed URL and redirect to it (avoids streaming large files
// through the Vercel function). Falls back to streaming if signing fails.
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const rawUrl = searchParams.get('url') || '';
        const directBucket = searchParams.get('bucket') || '';
        const directPath = searchParams.get('path') || '';

        let bucket: string;
        let filePath: string;

        if (directBucket && directPath) {
            bucket = directBucket;
            filePath = decodeURIComponent(directPath);
        } else if (rawUrl) {
            const match = rawUrl.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/?]+)\/([^?]+)/);
            if (!match) {
                // Not a Supabase URL — try to proxy it directly (Wix, Cloudinary, etc.)
                if (rawUrl.startsWith('http')) {
                    try {
                        const extRes = await fetch(rawUrl, { redirect: 'follow' });
                        if (extRes.ok && extRes.body) {
                            const ct = extRes.headers.get('content-type') || 'image/jpeg';
                            return new NextResponse(extRes.body, {
                                status: 200,
                                headers: { 'Content-Type': ct, 'Cache-Control': 'public, max-age=3600' },
                            });
                        }
                    } catch { /* fall through to error */ }
                }
                console.error('[media proxy] no match for URL:', rawUrl.slice(0, 120));
                return NextResponse.json({ error: 'Not a Supabase storage URL' }, { status: 400 });
            }
            bucket = match[1];
            filePath = decodeURIComponent(match[2]);
        } else {
            return NextResponse.json({ error: 'Missing url or bucket+path' }, { status: 400 });
        }

        console.log(`[media proxy] bucket=${bucket} path=${filePath.slice(0, 80)}`);

        // Primary strategy: create a fresh signed URL and redirect (efficient — no streaming)
        const { data: signed, error: signErr } = await supabaseAdmin.storage
            .from(bucket)
            .createSignedUrl(filePath, 3600);

        if (signed?.signedUrl) {
            return NextResponse.redirect(signed.signedUrl, 307);
        }

        console.warn(`[media proxy] sign failed (${signErr?.message}), trying download`);

        // Fallback: stream the file directly
        const { data, error } = await supabaseAdmin.storage.from(bucket).download(filePath);
        if (error || !data) {
            console.error(`[media proxy] download failed: bucket=${bucket} path=${filePath} error=${error?.message}`);
            return NextResponse.json({ error: error?.message || 'Not found' }, { status: 404 });
        }

        const buffer = await data.arrayBuffer();
        const contentType = data.type || guessContentType(filePath);
        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600',
            },
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
        heic: 'image/heic', heif: 'image/heif', tiff: 'image/tiff',
        tif: 'image/tiff', bmp: 'image/bmp', svg: 'image/svg+xml',
    };
    return map[ext] || 'application/octet-stream';
}
