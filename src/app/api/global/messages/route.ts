import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    const { data, error } = await supabaseAdmin
        .from('global_messages')
        .select('id, sender_email, sender_name, sender_avatar, message, media_url, media_type, reply_to, created_at')
        .order('created_at', { ascending: true })
        .limit(100);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const QUEEN_EMAILS = ['ceo@qkarin.com'];
    const safe = (data || []).map(({ sender_email, ...rest }: any) => ({
        ...rest,
        is_queen: QUEEN_EMAILS.includes((sender_email || '').toLowerCase()),
    }));
    return NextResponse.json({ messages: safe });
}

export async function POST(req: Request) {
    const body = await req.json();
    const { senderEmail, message, media_url, media_type, reply_to } = body;

    if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 });
    if (!senderEmail) return NextResponse.json({ error: 'Sender required' }, { status: 400 });

    // Get sender profile for name + avatar (Dual compatibility for UUID bugs)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(senderEmail);
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('name, avatar_url, member_id')
        .or(isUUID ? `id.eq.${senderEmail}` : `member_id.ilike.${senderEmail}`)
        .maybeSingle();

    const realEmail = (profile as any)?.member_id || senderEmail;
    const QUEEN_EMAILS = ['ceo@qkarin.com'];
    const isQueenSender = QUEEN_EMAILS.includes(realEmail.toLowerCase());
    const senderName = profile?.name || (isQueenSender ? 'QUEEN KARIN' : realEmail.split('@')[0]) || 'SUBJECT';
    const senderAvatar = profile?.avatar_url || (isQueenSender ? '/queen-karin.png' : null);

    const { data, error } = await supabaseAdmin
        .from('global_messages')
        .insert({
            sender_email: realEmail.toLowerCase(),
            sender_name: senderName,
            sender_avatar: senderAvatar,
            message: message.trim(),
            media_url: media_url || null,
            media_type: media_type || null,
            reply_to: reply_to || null,
        })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, message: data });
}
