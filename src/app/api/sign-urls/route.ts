import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Accepts an array of Supabase storage URLs, returns signed versions (2hr expiry).
// Non-storage URLs pass through unchanged.
export async function POST(req: Request) {
    try {
        const { urls } = await req.json();
        if (!Array.isArray(urls)) return NextResponse.json({ urls: [] }, { status: 400 });

        // Buckets whose content is globally public (no signing needed).
        const PUBLIC_BUCKETS = ['avatars', 'public'];

        // Within the 'media' bucket, these folder prefixes require signed access.
        // They are uploaded via signed URLs (not public), so the public URL returns 403.
        const PRIVATE_MEDIA_PREFIXES = ['task-proofs/', 'admin-chat/', 'chat-media/', 'challenge-proofs/'];

        const signed = await Promise.all(urls.map(async (url: string) => {
            if (!url || typeof url !== 'string') return url;

            // Only process Supabase storage URLs
            const match = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/?]+)\/(.+?)(?:\?|$)/);
            if (!match) return url;

            const [, bucket, rawPath] = match;
            const path = decodeURIComponent(rawPath);

            // Truly public buckets (avatars, public) — return canonical public URL
            if (PUBLIC_BUCKETS.includes(bucket)) {
                const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
                return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
            }

            // 'media' bucket: public paths serve fine via public URL; private paths need signing
            if (bucket === 'media') {
                const isPrivate = PRIVATE_MEDIA_PREFIXES.some(p => path.startsWith(p));
                if (!isPrivate) {
                    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
                    return `${supabaseUrl}/storage/v1/object/public/media/${path}`;
                }
                // Private path within media bucket — create fresh signed URL
            }

            // All other buckets (or private paths in media) — sign it
            try {
                const { data, error } = await supabaseAdmin.storage
                    .from(bucket)
                    .createSignedUrl(path, 7200);
                if (error || !data?.signedUrl) return url;
                return data.signedUrl;
            } catch {
                return url;
            }
        }));

        return NextResponse.json({ urls: signed });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
