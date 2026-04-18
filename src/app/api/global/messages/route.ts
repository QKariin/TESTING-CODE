import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function GET() {
    const { data, error } = await supabaseAdmin
        .from('global_messages')
        .select('*')
        .order('created_at', { ascending: true, nullsFirst: true })
        .limit(100);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const QUEEN_EMAILS = ['ceo@qkarin.com'];
    // Keep sender_email so client can detect own messages; is_queen added for convenience
    const safe = (data || []).map((row: any) => ({
        ...row,
        is_queen: QUEEN_EMAILS.includes((row.sender_email || '').toLowerCase()),
    }));
    return NextResponse.json({ messages: safe });
}

export async function POST(req: Request) {
    const { getCaller, isOwnerOrCEO } = await import('@/lib/api-auth');
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { senderEmail, message, media_url, media_type, reply_to } = body;

    if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 });
    if (!senderEmail) return NextResponse.json({ error: 'Sender required' }, { status: 400 });

    if (!isOwnerOrCEO(caller, senderEmail)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(senderEmail);
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('ID, name, avatar_url, member_id')
        .or(isUUID ? `ID.eq.${senderEmail}` : `member_id.ilike.${senderEmail}`)
        .maybeSingle();

    const realEmail = (profile as any)?.member_id || senderEmail;
    const QUEEN_EMAILS = ['ceo@qkarin.com'];
    const isQueenSender = QUEEN_EMAILS.includes(realEmail.toLowerCase());
    const senderName = profile?.name || (isQueenSender ? 'QUEEN KARIN' : realEmail.split('@')[0]) || 'SUBJECT';
    const senderAvatar = profile?.avatar_url || (isQueenSender ? '/queen-karin.png' : null);

    const insertData: any = {
        sender_name: senderName,
        sender_avatar: senderAvatar,
        message: message.trim(),
        media_url: media_url || null,
        media_type: media_type || null,
        reply_to: reply_to || null,
        sender_email: realEmail.toLowerCase(),
        created_at: new Date().toISOString()
    };

    // Removed sender_id logic because schema column hasn't been added

    const { data, error } = await supabaseAdmin
        .from('global_messages')
        .insert(insertData)
        .select()
        .single();

    if (error) {
        // Strip unknown/generated columns and retry
        const stripped = { ...insertData };
        if (error.message.includes('reply_to')) delete stripped.reply_to;
        if (error.message.includes('sender_email')) delete stripped.sender_email;
        if (error.message.includes('created_at')) delete stripped.created_at;
        const retry = await supabaseAdmin.from('global_messages').insert(stripped).select().single();
        if (retry.error) return NextResponse.json({ error: retry.error.message }, { status: 500 });
        return NextResponse.json({ success: true, message: retry.data });
    }
    return NextResponse.json({ success: true, message: data });
}
