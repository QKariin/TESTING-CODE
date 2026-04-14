import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Private folders — serve via signed URLs, not public URLs
const PRIVATE_PREFIXES = ['task-proofs/', 'chat/', 'admin-chat/', 'chat-media/', 'challenge-proofs/'];
const isPrivatePath = (path: string) => PRIVATE_PREFIXES.some(p => path.startsWith(p));

// Signed URL expiry: 7 days (604800 seconds) — refreshed on next load
const SIGNED_URL_EXPIRY = 604800;

// POST /api/upload/signed
// Returns a signed upload URL so the client can upload large files directly to Supabase Storage.
// For private paths, also returns a signed download URL instead of a public URL.
export async function POST(req: NextRequest) {
    try {
        const { bucket, path } = await req.json();
        if (!bucket || !path) {
            return NextResponse.json({ error: 'Missing bucket or path' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin.storage
            .from(bucket)
            .createSignedUploadUrl(path);

        if (error || !data) {
            console.error('[upload/signed] Error creating signed URL:', error?.message);
            return NextResponse.json({ error: error?.message || 'Failed to create signed URL' }, { status: 500 });
        }

        let fileUrl: string;

        if (isPrivatePath(path)) {
            // Private content — return a signed download URL
            const { data: signedData, error: signedErr } = await supabaseAdmin.storage
                .from(bucket)
                .createSignedUrl(path, SIGNED_URL_EXPIRY);

            if (signedErr || !signedData?.signedUrl) {
                // Fallback: return path so the client can request a fresh signed URL later
                fileUrl = `/api/media/url?bucket=${bucket}&path=${encodeURIComponent(path)}`;
            } else {
                fileUrl = signedData.signedUrl;
            }
        } else {
            // Public content — return permanent public URL
            const { data: { publicUrl } } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
            fileUrl = publicUrl;
        }

        return NextResponse.json({ signedUrl: data.signedUrl, path, token: data.token, publicUrl: fileUrl });
    } catch (err: any) {
        console.error('[upload/signed] Unexpected error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
