import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const memberEmail = formData.get('memberEmail') as string | null;

        if (!file || !memberEmail) {
            return NextResponse.json({ error: 'Missing file or memberEmail' }, { status: 400 });
        }

        // 1. Upload to Supabase Storage (avatars bucket)
        const ext = file.name.split('.').pop() || 'jpg';
        const filename = `avatars/${memberEmail.replace(/[^a-z0-9@._-]/gi, '_')}_${Date.now()}.${ext}`;

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { error: uploadError } = await supabaseAdmin.storage
            .from('media')
            .upload(filename, buffer, {
                contentType: file.type || 'image/jpeg',
                upsert: true,
            });

        if (uploadError) {
            console.error('[upload-avatar] Storage error:', uploadError.message);
            return NextResponse.json({ error: 'Storage upload failed: ' + uploadError.message }, { status: 500 });
        }

        const { data: { publicUrl } } = supabaseAdmin.storage
            .from('media')
            .getPublicUrl(filename);

        console.log('[upload-avatar] Uploaded to:', publicUrl);

        // 2. Update profiles table — write to both columns so either lookup works
        const { error: dbError } = await supabaseAdmin
            .from('profiles')
            .update({ avatar_url: publicUrl, profile_picture_url: publicUrl })
            .ilike('member_id', memberEmail);

        if (dbError) {
            console.error('[upload-avatar] DB error:', dbError.message);
            return NextResponse.json({ error: 'DB update failed: ' + dbError.message }, { status: 500 });
        }

        console.log('[upload-avatar] DB updated for:', memberEmail);
        return NextResponse.json({ success: true, url: publicUrl });

    } catch (err: any) {
        console.error('[upload-avatar] unexpected error:', err);
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
    }
}
