import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

        // Validate it's an image
        if (!file.type.startsWith('image/')) {
            return NextResponse.json({ error: 'Only image files allowed' }, { status: 400 });
        }

        // Use a fresh admin client — avoids proxy issues with storage
        const adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const storagePath = `wishlist/${fileName}`;

        // Upload the File object directly — more reliable than Buffer in serverless
        const { error: uploadError } = await adminClient.storage
            .from('media')
            .upload(storagePath, file, {
                contentType: file.type,
                upsert: false,
            });

        if (uploadError) {
            console.error('[wishlist/upload] Supabase upload error:', uploadError);
            return NextResponse.json({ error: uploadError.message }, { status: 500 });
        }

        const { data: urlData } = adminClient.storage
            .from('media')
            .getPublicUrl(storagePath);

        console.log('[wishlist/upload] Success:', urlData.publicUrl);
        return NextResponse.json({ success: true, url: urlData.publicUrl });

    } catch (err: any) {
        console.error('[wishlist/upload] Caught error:', err);
        return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 });
    }
}
