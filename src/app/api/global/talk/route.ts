import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    const [messagesRes, onlineRes] = await Promise.all([
        supabaseAdmin
            .from('chats')
            .select('id, member_id, content, created_at, type')
            .eq('type', 'global_talk')
            .order('created_at', { ascending: true })
            .limit(100),
        supabaseAdmin
            .from('profiles')
            .select('member_id, id, name, avatar_url, profile_picture_url, last_active')
            .gte('last_active', new Date(Date.now() - 2 * 60 * 1000).toISOString()),
    ]);

    if (messagesRes.error) return NextResponse.json({ error: messagesRes.error.message }, { status: 500 });

    const messages = messagesRes.data || [];
    const emails = [...new Set(messages.map((m: any) => m.member_id))];
    const { data: profiles } = emails.length
        ? await supabaseAdmin.from('profiles').select('member_id, id, name').in('member_id', emails)
        : { data: [] };

    const nameMap = new Map((profiles || []).map((p: any) => [p.member_id, p.name]));
    const idMap = new Map((profiles || []).map((p: any) => [p.member_id, p.id]));

    const enriched = messages.map((m: any) => ({
        id: m.id,
        content: m.content,
        created_at: m.created_at,
        senderName: nameMap.get(m.member_id) || 'SUBJECT',
        member_number: idMap.get(m.member_id) || null,
        type: m.type,
    }));

    const online = (onlineRes.data || []).map((p: any) => ({
        name: p.name || 'SUBJECT',
        avatar: p.avatar_url || p.profile_picture_url || null,
        member_number: p.id || null,
    }));

    return NextResponse.json({ messages: enriched, online });
}

export async function POST(req: Request) {
    const { getCaller, isOwnerOrCEO } = await import('@/lib/api-auth');
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { content, senderEmail } = body;
    if (!content?.trim()) return NextResponse.json({ error: 'Content required' }, { status: 400 });
    if (!senderEmail) return NextResponse.json({ error: 'Sender required' }, { status: 400 });

    if (!isOwnerOrCEO(caller, senderEmail)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
        .from('chats')
        .insert({
            member_id: senderEmail.toLowerCase(),
            content: content.trim(),
            type: 'global_talk',
            sender: 'subject',
        })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, message: data });
}
