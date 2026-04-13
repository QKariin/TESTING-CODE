import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Accepts an array of Supabase storage URLs, returns signed versions (2hr expiry).
// Non-storage URLs pass through unchanged.
export async function POST(req: Request) {
    try {
        const { urls } = await req.json();
        if (!Array.isArray(urls)) return NextResponse.json({ urls: [] }, { status: 400 });

        // Public buckets — files are already accessible via public URL, no signing needed.
        // Signing them creates ?token= URLs that bypass Vercel CDN cache and hit Supabase directly.
        const PUBLIC_BUCKETS = ['media', 'avatars', 'public'];

        const signed = await Promise.all(urls.map(async (url: string) => {
            if (!url || typeof url !== 'string') return url;

            // Only process Supabase storage URLs
            const match = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/?]+)\/(.+?)(?:\?|$)/);
            if (!match) return url;

            const [, bucket, rawPath] = match;

            // Public bucket files: return the canonical public URL so Vercel CDN can cache it
            if (PUBLIC_BUCKETS.includes(bucket)) {
                const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
                return `${supabaseUrl}/storage/v1/object/public/${bucket}/${decodeURIComponent(rawPath)}`;
            }

            const path = decodeURIComponent(rawPath);

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
