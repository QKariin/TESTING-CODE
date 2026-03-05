import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Bypass RLS
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
    console.log("[API/Upload] Received upload request");
    try {
        const formData = await request.formData();
        const file = formData.get('file') as any;
        const bucket = formData.get('bucket') as string;
        const folder = formData.get('folder') as string;

        console.log(`[API/Upload] Target: ${bucket}/${folder}, File: ${file?.name}, Type: ${file?.type}`);

        if (!file || !bucket || !folder) {
            console.error("[API/Upload] Missing fields");
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const ext = file.name.split('.').pop() || 'bin';
        const filename = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
        const fullPath = `${folder.replace(/^\/|\/$/g, '')}/${filename}`;

        console.log(`[API/Upload] Uploading to path: ${fullPath}`);

        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(fullPath, buffer, {
                contentType: file.type || 'application/octet-stream',
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error("[API/Upload] Supabase Storage Error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        console.log("[API/Upload] Upload success:", data.path);
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fullPath);
        const finalUrl = bucket === 'proofs' ? `/public/proofs/${fullPath}` : urlData.publicUrl;

        console.log("[API/Upload] Returning URL:", finalUrl);
        return NextResponse.json({ url: finalUrl, success: true });

    } catch (error: any) {
        console.error("[API/Upload] Fatal Catch:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
