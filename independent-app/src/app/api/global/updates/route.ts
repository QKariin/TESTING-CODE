import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    const { data, error } = await supabaseAdmin
        .from('chats')
        .select('member_id, content, created_at')
        .eq('type', 'global_update')
        .order('created_at', { ascending: false })
        .limit(60);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const emails = [...new Set((data || []).map((m: any) => m.member_id))];
    const { data: profiles } = emails.length
        ? await supabaseAdmin.from('profiles').select('email, name').in('email', emails)
        : { data: [] };
    const nameMap = new Map((profiles || []).map((p: any) => [p.email, p.name]));

    interface GlobalUpdate {
        media_url: string;
        caption: string;
        senderName: string;
        created_at: string;
    }

    const updates: GlobalUpdate[] = (data || []).map((m: any) => {
        let parsed: any = {};
        try { parsed = JSON.parse(m.content); } catch { }
        return {
            media_url: parsed.url || '',
            caption: parsed.caption || '',
            senderName: nameMap.get(m.member_id) || m.member_id?.split('@')[0] || 'SUBJECT',
            created_at: m.created_at,
        };
    }).filter((u: GlobalUpdate) => u.media_url);

    return NextResponse.json({ updates });
}

export async function POST(req: Request) {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const senderEmail = formData.get('email') as string;
    const caption = (formData.get('caption') as string) || '';

    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });
    if (!senderEmail) return NextResponse.json({ error: 'No sender' }, { status: 400 });

    const ext = file.name.split('.').pop() || 'jpg';
    const path = `global-updates/${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadErr } = await supabaseAdmin.storage
        .from('media')
        .upload(path, buffer, { contentType: file.type, upsert: true });

    if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

    const { data: urlData } = supabaseAdmin.storage.from('media').getPublicUrl(path);

    const { error: insertErr } = await supabaseAdmin.from('chats').insert({
        member_id: senderEmail,
        content: JSON.stringify({ url: urlData.publicUrl, caption }),
        type: 'global_update',
        sender: 'subject',
    });

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
    return NextResponse.json({ success: true, url: urlData.publicUrl });
}
