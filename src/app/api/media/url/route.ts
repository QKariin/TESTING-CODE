import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

const PRIVATE_PREFIXES = ['task-proofs/', 'chat/', 'admin-chat/', 'chat-media/', 'challenge-proofs/'];
const isPrivatePath = (path: string) => PRIVATE_PREFIXES.some(p => path.startsWith(p));
const SIGNED_URL_EXPIRY = 604800; // 7 days

// Extracts the storage path from a full Supabase Storage URL
function extractPath(urlOrPath: string): string {
    try {
        const url = new URL(urlOrPath);
        // e.g. /storage/v1/object/public/media/task-proofs/xxx.jpg
        const match = url.pathname.match(/\/storage\/v1\/object\/(?:public|authenticated|sign)\/[^/]+\/(.+)/);
        if (match) return decodeURIComponent(match[1]);
    } catch { }
    return urlOrPath; // already a path
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
        const bucket = searchParams.get('bucket') || 'media';
        const rawPath = searchParams.get('path') || searchParams.get('url') || '';
        const path = extractPath(rawPath);

        if (!path) return NextResponse.json({ error: 'Missing path' }, { status: 400 });

        if (!isPrivatePath(path)) {
            // Public path — just return public URL
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
