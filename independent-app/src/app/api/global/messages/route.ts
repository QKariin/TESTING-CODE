import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    const { data, error } = await supabaseAdmin
        .from('global_messages')
        .select('id, sender_email, sender_name, sender_avatar, message, created_at')
        .order('created_at', { ascending: true })
        .limit(100);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ messages: data || [] });
}

export async function POST(req: Request) {
    const body = await req.json();
    const { senderEmail, message } = body;

    if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 });
    if (!senderEmail) return NextResponse.json({ error: 'Sender required' }, { status: 400 });

    // Get sender profile for name + avatar
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('name, avatar_url')
        .ilike('member_id', senderEmail)
        .maybeSingle();

    const senderName = profile?.name || senderEmail.split('@')[0] || 'SUBJECT';
    const senderAvatar = profile?.avatar_url || null;

    const { data, error } = await supabaseAdmin
        .from('global_messages')
        .insert({
            sender_email: senderEmail.toLowerCase(),
            sender_name: senderName,
            sender_avatar: senderAvatar,
            message: message.trim(),
        })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, message: data });
}
