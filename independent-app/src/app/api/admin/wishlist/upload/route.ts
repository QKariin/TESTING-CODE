import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

        const ext = file.name.split('.').pop() || 'jpg';
        const path = `wishlist/${Date.now()}.${ext}`;
        const buffer = Buffer.from(await file.arrayBuffer());

        const { error } = await supabaseAdmin.storage
            .from('media')
            .upload(path, buffer, { contentType: file.type, upsert: true });

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        const { data: urlData } = supabaseAdmin.storage.from('media').getPublicUrl(path);
        return NextResponse.json({ success: true, url: urlData.publicUrl });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
