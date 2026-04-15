import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

const PRIVATE_PREFIXES = ['task-proofs/', 'chat/', 'admin-chat/', 'chat-media/', 'challenge-proofs/'];
const isPrivatePath = (path: string) => PRIVATE_PREFIXES.some(p => path.startsWith(p));
const SIGNED_URL_EXPIRY = 604800; // 7 days

// Extracts both the bucket name and storage path from a full Supabase Storage URL
function extractBucketAndPath(urlOrPath: string): { bucket: string; path: string } {
    try {
        const url = new URL(urlOrPath);
        // e.g. /storage/v1/object/public/{bucket}/{path}
        const match = url.pathname.match(/\/storage\/v1\/object\/(?:public|authenticated|sign)\/([^/]+)\/(.+)/);
        if (match) return { bucket: match[1], path: decodeURIComponent(match[2]) };
    } catch { }
    return { bucket: 'media', path: urlOrPath }; // fallback
}

// GET /api/media/url?bucket=media&path=task-proofs/xxx.jpg
// Or with full URL: GET /api/media/url?url=https://...supabase.co/storage/.../task-proofs/xxx.jpg
// Returns a fresh signed URL for private content (requires auth)
export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const rawPath = searchParams.get('path') || searchParams.get('url') || '';

        // Extract bucket from URL if present, fallback to query param
        const { bucket: urlBucket, path } = extractBucketAndPath(rawPath);
        const bucket = searchParams.get('bucket') || urlBucket;

        if (!path) return NextResponse.json({ error: 'Missing path' }, { status: 400 });

        // proofs bucket is always private (requires signing)
        const isProofsBucket = bucket === 'proofs';

        if (!isProofsBucket && !isPrivatePath(path)) {
            // Public path in media bucket - return public URL
            const { data: { publicUrl } } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
            return NextResponse.json({ url: publicUrl });
        }

        const { data, error } = await supabaseAdmin.storage
            .from(bucket)
            .createSignedUrl(path, SIGNED_URL_EXPIRY);

        if (error || !data?.signedUrl) {
            return NextResponse.json({ error: error?.message || 'Failed to sign URL' }, { status: 500 });
        }

        return NextResponse.json({ url: data.signedUrl });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
