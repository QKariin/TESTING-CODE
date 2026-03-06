import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    const { data: messages, error } = await supabaseAdmin
        .from('chats')
        .select('member_id, content, created_at')
        .eq('type', 'global_talk')
        .order('created_at', { ascending: true })
        .limit(100);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const emails = [...new Set((messages || []).map((m: any) => m.member_id))];
    const { data: profiles } = emails.length
        ? await supabaseAdmin.from('profiles').select('email, name').in('email', emails)
        : { data: [] };

    const nameMap = new Map((profiles || []).map((p: any) => [p.email, p.name]));

    const enriched = (messages || []).map((m: any) => ({
        ...m,
        senderName: nameMap.get(m.member_id) || m.member_id?.split('@')[0] || 'SUBJECT',
    }));

    return NextResponse.json({ messages: enriched });
}

export async function POST(req: Request) {
    const body = await req.json();
    const { content, senderEmail } = body;
    if (!content?.trim()) return NextResponse.json({ error: 'Content required' }, { status: 400 });
    if (!senderEmail) return NextResponse.json({ error: 'Sender required' }, { status: 400 });

    const { data, error } = await supabaseAdmin
        .from('chats')
        .insert({
            member_id: senderEmail,
            content: content.trim(),
            type: 'global_talk',
            sender: 'subject',
        })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, message: data });
}
