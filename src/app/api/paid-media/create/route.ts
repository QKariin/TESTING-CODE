import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ADMIN_EMAIL = 'ceo@qkarin.com';
const ONESIGNAL_APP_ID = '761d91da-b098-44a7-8d98-75c1cce54dd0';
const ONESIGNAL_KEY = process.env.ONESIGNAL_REST_API_KEY || '';

function sendPush(targetEmail: string, title: string, body: string, url: string) {
    if (!ONESIGNAL_KEY || !targetEmail) return;
    fetch('https://api.onesignal.com/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${ONESIGNAL_KEY}` },
        body: JSON.stringify({
            app_id: ONESIGNAL_APP_ID,
            target_channel: 'push',
            include_aliases: { external_id: [targetEmail] },
            headings: { en: title },
            contents: { en: body },
            url,
        }),
    }).catch(() => {});
}

export async function POST(req: Request) {
    try {
        const { senderEmail, conversationId, mediaUrl, mediaType, thumbnailUrl, price } = await req.json();

        if (!senderEmail || !conversationId || !mediaUrl || !price) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (typeof price !== 'number' || price <= 0) {
            return NextResponse.json({ error: 'Price must be a positive number' }, { status: 400 });
        }

        // Verify sender is queen or active chatter
        const isHardcodedAdmin = ['ceo@qkarin.com', 'queen@qkarin.com'].includes(senderEmail.toLowerCase());
        let isAuthorized = isHardcodedAdmin;
        let chatterEmail: string | null = null;

        if (!isHardcodedAdmin) {
            const { data: chatterRow } = await supabaseAdmin
                .from('chatters')
                .select('email')
                .eq('email', senderEmail.toLowerCase())
                .eq('is_active', true)
                .maybeSingle();
            if (chatterRow) {
                isAuthorized = true;
                chatterEmail = senderEmail.toLowerCase();
            }
        }

        if (!isAuthorized) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // 1. Create paid_media record
        const { data: paidMedia, error: pmErr } = await supabaseAdmin
            .from('paid_media')
            .insert({
                uploader_email: senderEmail.toLowerCase(),
                member_id: conversationId.toLowerCase(),
                media_url: mediaUrl,
                media_type: mediaType || 'photo',
                thumbnail_url: thumbnailUrl || null,
                price,
            })
            .select()
            .single();

        if (pmErr || !paidMedia) {
            console.error('[paid-media/create] insert failed:', pmErr?.message);
            return NextResponse.json({ error: pmErr?.message || 'Failed to create paid media' }, { status: 500 });
        }

        // 2. Insert chat message of type 'paid_media'
        const insertData = {
            member_id: conversationId,
            sender_email: senderEmail,
            content: 'PAID_MEDIA',
            type: 'paid_media',
            metadata: {
                isQueen: true,
                paid_media_id: paidMedia.id,
                media_url: mediaUrl,
                media_type: mediaType || 'photo',
                thumbnail_url: thumbnailUrl || null,
                price,
                chatter_email: chatterEmail,
            },
        };

        const { data: chatMsg, error: chatErr } = await supabaseAdmin
            .from('chats')
            .insert(insertData)
            .select()
            .single();

        if (chatErr) {
            // Rollback: delete paid_media row
            await supabaseAdmin.from('paid_media').delete().eq('id', paidMedia.id);
            return NextResponse.json({ error: chatErr.message }, { status: 500 });
        }

        // Update backreference
        await supabaseAdmin
            .from('paid_media')
            .update({ chat_message_id: chatMsg.id })
            .eq('id', paidMedia.id);

        // Push notification to sub
        sendPush(
            conversationId,
            'Queen Karin',
            `You received exclusive media — ${price} Capital to unlock`,
            'https://throne.qkarin.com/profile'
        );

        return NextResponse.json({ success: true, data: chatMsg, paidMediaId: paidMedia.id });
    } catch (err: any) {
        console.error('[paid-media/create] error:', err);
        return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
    }
}
