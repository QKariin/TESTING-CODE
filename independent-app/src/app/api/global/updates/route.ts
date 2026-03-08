import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    // Fetch photos, tributes, and points events in parallel
    const [photosRes, tributesRes, pointsRes] = await Promise.all([
        supabaseAdmin
            .from('chats')
            .select('member_id, content, created_at')
            .eq('type', 'global_update')
            .order('created_at', { ascending: false })
            .limit(30),
        supabaseAdmin
            .from('chats')
            .select('member_id, content, metadata, created_at')
            .eq('type', 'wishlist')
            .order('created_at', { ascending: false })
            .limit(30),
        supabaseAdmin
            .from('chats')
            .select('member_id, content, created_at')
            .eq('type', 'system')
            .ilike('content', '%MERIT%')
            .order('created_at', { ascending: false })
            .limit(30),
    ]);

    // Batch-lookup profiles for all senders
    const allEmails = [...new Set([
        ...(photosRes.data || []).map((r: any) => r.member_id),
        ...(tributesRes.data || []).map((r: any) => r.member_id),
        ...(pointsRes.data || []).map((r: any) => r.member_id),
    ].filter(Boolean))];

    const { data: profiles } = allEmails.length
        ? await supabaseAdmin
            .from('profiles')
            .select('member_id, name, avatar_url, profile_picture_url')
            .in('member_id', allEmails)
        : { data: [] };

    const profileMap = new Map<string, any>((profiles || []).map((p: any) => [p.member_id?.toLowerCase(), p]));

    function getProfile(email: string) {
        const p = profileMap.get(email?.toLowerCase());
        return {
            name: (p as any)?.name || email?.split('@')[0] || 'SUBJECT',
            avatar: (p as any)?.avatar_url || (p as any)?.profile_picture_url || null,
        };
    }

    // Photos
    const photos = (photosRes.data || []).flatMap((r: any) => {
        let parsed: any = {};
        try { parsed = JSON.parse(r.content); } catch { }
        if (!parsed.url) return [];
        const { name, avatar } = getProfile(r.member_id);
        return [{
            kind: 'photo',
            media_url: parsed.url,
            caption: parsed.caption || '',
            sender_name: name,
            sender_avatar: avatar,
            created_at: r.created_at,
        }];
    });

    // Tributes (wishlist purchases)
    const tributes = (tributesRes.data || []).map((r: any) => {
        const meta = r.metadata || {};
        const { name, avatar } = getProfile(r.member_id);
        return {
            kind: 'tribute',
            title: meta.title || r.content || 'Gift',
            image: meta.image || null,
            price: meta.price || 0,
            sender_name: name,
            sender_avatar: avatar,
            created_at: r.created_at,
        };
    });

    // Points (MERIT earned from task rewards)
    const points = (pointsRes.data || []).flatMap((r: any) => {
        const match = r.content.match(/\+(\d+)\s*MERIT/i);
        const pts = match ? parseInt(match[1]) : 0;
        if (!pts) return [];
        const { name, avatar } = getProfile(r.member_id);
        return [{
            kind: 'points',
            points: pts,
            sender_name: name,
            sender_avatar: avatar,
            created_at: r.created_at,
        }];
    });

    // Merge + sort newest first
    const updates = [...photos, ...tributes, ...points].sort(
        (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ).slice(0, 60);

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
