import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ACCOUNT_ID = 'kW2K8hR';
const API_KEY = 'public_kW2K8hR6YbQXStTvMf5ZDYbVf1fQ';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const memberEmail = formData.get('memberEmail') as string | null;

        if (!file || !memberEmail) {
            return NextResponse.json({ error: 'Missing file or memberEmail' }, { status: 400 });
        }

        // 1. Upload to Bytescale
        const fd = new FormData();
        fd.append('file', file);

        const uploadRes = await fetch(
            `https://api.bytescale.com/v2/accounts/${ACCOUNT_ID}/uploads/form_data?path=/avatars`,
            { method: 'POST', headers: { Authorization: `Bearer ${API_KEY}` }, body: fd }
        );

        const uploadJson = await uploadRes.json();
        console.log('[upload-avatar] Bytescale response:', JSON.stringify(uploadJson));

        if (!uploadRes.ok) {
            console.error('[upload-avatar] Bytescale error:', uploadJson);
            return NextResponse.json({ error: 'Upload service error', detail: uploadJson }, { status: 500 });
        }

        // Bytescale v2 returns either files[] or a single filePath
        const publicUrl =
            uploadJson?.files?.[0]?.fileUrl ||
            uploadJson?.fileUrl ||
            (uploadJson?.filePath ? `https://upcdn.io/${ACCOUNT_ID}/raw${uploadJson.filePath}` : null);

        if (!publicUrl) {
            console.error('[upload-avatar] No URL in response:', uploadJson);
            return NextResponse.json({ error: 'No URL returned from upload', detail: uploadJson }, { status: 500 });
        }

        console.log('[upload-avatar] Got URL:', publicUrl);

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
