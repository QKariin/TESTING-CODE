import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// POST /api/upload/signed
// Returns a signed upload URL so the client can upload large files (videos)
// directly to Supabase Storage, bypassing the 4.5MB serverless body limit.
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

        // data.signedUrl — client uploads directly to this URL via PUT
        // data.path — storage path (use to get public URL after upload)
        // data.token — upload token
        const { data: { publicUrl } } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);

        return NextResponse.json({ signedUrl: data.signedUrl, path, token: data.token, publicUrl });
    } catch (err: any) {
        console.error('[upload/signed] Unexpected error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
