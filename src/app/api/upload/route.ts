import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const bucket = (formData.get('bucket') as string) || 'media';
        const folder = (formData.get('folder') as string) || 'uploads';

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Use safe ext passed from client (handles HEIC→jpg, empty ext, uppercase)
        const rawExt = (formData.get('ext') as string) || file.name.split('.').pop() || 'bin';
        const ext = rawExt.toLowerCase().slice(0, 5);
        const filename = `${folder}/${crypto.randomUUID()}.${ext}`;

        // Upload File directly - avoids loading entire video into a Buffer
        const { error } = await supabaseAdmin.storage
            .from(bucket)
            .upload(filename, file, {
                contentType: file.type || 'application/octet-stream',
                upsert: true,
            });

        if (error) {
            console.error('[upload] storage error:', error.message);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const { data: { publicUrl } } = supabaseAdmin.storage
            .from(bucket)
            .getPublicUrl(filename);

        return NextResponse.json({ url: publicUrl });
    } catch (err: any) {
        console.error('[upload] unexpected error:', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
