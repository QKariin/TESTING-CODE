import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Bypass RLS
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const bucket = formData.get('bucket') as string;
        const folder = formData.get('folder') as string;

        if (!file || !bucket || !folder) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const ext = file.name.split('.').pop();
        const filename = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
        const fullPath = `${folder.replace(/^\/|\/$/g, '')}/${filename}`;

        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(fullPath, buffer, {
                contentType: file.type,
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error("Supabase API Upload Error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fullPath);

        // For proofs (private bucket), we actually store the relative path for signed URLs later,
        // but historically we might have stored full publicUrl. Wait, getPublicUrl is fine.
        // Actually, we'll just return the full path in the bucket so the frontend can save it.
        const finalUrl = bucket === 'proofs' ? `/public/proofs/${fullPath}` : urlData.publicUrl;

        return NextResponse.json({ url: finalUrl, success: true });

    } catch (error: any) {
        console.error("API Upload Catch Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
