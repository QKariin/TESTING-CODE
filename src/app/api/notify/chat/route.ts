import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '761d91da-b098-44a7-8d98-75c1cce54dd0';
const ADMIN_EMAIL = 'ceo@qkarin.com';

// POST /api/notify/chat
// Called by Supabase Database Webhook on INSERT to public.chats
// Payload: { type: 'INSERT', table: 'chats', record: { sender_email, conversation_id, content, type, ... } }
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const record = body?.record;
        if (!record) return NextResponse.json({ ok: false, reason: 'no record' });

        const senderEmail = (record.sender_email || record.sender || '').toLowerCase();
        const content = record.content || record.message || '';
        const conversationId = record.conversation_id || record.member_id || '';

        // Only notify queen when a NON-queen message arrives
        const isFromQueen = senderEmail === ADMIN_EMAIL || senderEmail === 'queen';
        if (isFromQueen) return NextResponse.json({ ok: true, reason: 'queen message, skipped' });

        // Skip system messages
        if (senderEmail === 'system' || typeof content === 'string' && content.startsWith('TASK_FEEDBACK::')) {
            return NextResponse.json({ ok: true, reason: 'system message, skipped' });
        }

        const ONESIGNAL_KEY = process.env.ONESIGNAL_REST_API_KEY;
        if (!ONESIGNAL_KEY) {
            console.error('[notify/chat] ONESIGNAL_REST_API_KEY not set');
            return NextResponse.json({ ok: false, reason: 'no api key' });
        }

        // Get sender name for notification title
        const { data: senderProfile } = await supabaseAdmin
            .from('profiles')
            .select('name')
            .ilike('member_id', senderEmail)
            .maybeSingle();
        const senderName = senderProfile?.name || senderEmail.split('@')[0] || 'Subject';

        // Get queen's OneSignal subscription ID
        const { data: queenProfile } = await supabaseAdmin
            .from('profiles')
            .select('onesignal_id')
            .ilike('member_id', ADMIN_EMAIL)
            .maybeSingle();

        const onesignalId = queenProfile?.onesignal_id;
        if (!onesignalId) {
            console.warn('[notify/chat] Queen has no onesignal_id saved — enable notifications in the dashboard first');
            return NextResponse.json({ ok: false, reason: 'queen not subscribed' });
        }

        const msgPreview = typeof content === 'string'
            ? content.replace(/^TASK_FEEDBACK::.*/, '📋 Task feedback').slice(0, 100)
            : '📨 New message';

        const res = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Key ${ONESIGNAL_KEY}`,
            },
            body: JSON.stringify({
                app_id: ONESIGNAL_APP_ID,
                include_subscription_ids: [onesignalId],
                headings: { en: senderName },
                contents: { en: msgPreview },
                url: 'https://throne.qkarin.com/dashboard',
            }),
        });

        const data = await res.json();
        console.log('[notify/chat] OneSignal response:', res.status, JSON.stringify(data));

        return NextResponse.json({ ok: true, status: res.status, data });
    } catch (err: any) {
        console.error('[notify/chat] error:', err.message);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}
