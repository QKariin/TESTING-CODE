import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { HIERARCHY_RULES, rankMeetsRequirement } from '@/lib/hierarchyRules';

export async function POST(req: Request) {
    try {
        const { memberId: rawMemberId, senderEmail: rawSenderEmail, content, type = 'text', metadata = {}, conversationId: rawConversationId } = await req.json();
        // Accept memberId (UUID) as primary, fall back to senderEmail for backward compat
        const rawSender = rawMemberId || rawSenderEmail;
        let senderEmail = rawSenderEmail?.toLowerCase();
        let conversationId = rawConversationId?.toLowerCase();

        if (!rawSender || !content) {
            return NextResponse.json({ success: false, error: "Missing required fields." }, { status: 400 });
        }

        const supabase = await createClient();
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawSender);
        const isHardcodedAdmin = !isUUID && senderEmail && ["ceo@qkarin.com"].includes(senderEmail.toLowerCase());

        let profile: any = null;
        let isQueen = isHardcodedAdmin;

        const adminClient = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        if (isHardcodedAdmin) {
            profile = { hierarchy: 'Queen', wallet: 999999, member_id: senderEmail };
        } else {
            // Look up profile by UUID (profiles.id) or email (profiles.member_id)
            const { data, error: profileErr } = await adminClient
                .from('profiles')
                .select('*')
                .eq(isUUID ? 'id' : 'member_id', rawSender)
                .maybeSingle();
            profile = data;

            if (profile) {
                // Always resolve senderEmail from profile for display purposes
                senderEmail = profile.member_id?.toLowerCase() || senderEmail;
            }

            if (profileErr || !profile) {
                // 🔄 PROFILE AUTO-CREATION: Ensure every chat sender has a profile.
                if (!isUUID && senderEmail) {
                    const { data: newProfile, error: createErr } = await adminClient
                        .from('profiles')
                        .insert({
                            member_id: senderEmail,
                            name: senderEmail.split('@')[0],
                            score: 0,
                            wallet: 0,
                            hierarchy: 'Hall Boy'
                        })
                        .select()
                        .single();

                    if (!createErr && newProfile) {
                        profile = newProfile;
                        isQueen = false;
                    }
                }
            }

            if (!profile) {
                const { data: { user: authUser } } = await supabase.auth.getUser();
                if (authUser?.id === rawSender || authUser?.email?.toLowerCase() === senderEmail) {
                    profile = { hierarchy: 'Queen', wallet: 999999, member_id: senderEmail };
                    isQueen = true;
                } else {
                    return NextResponse.json({ success: false, error: "Sender profile not found." }, { status: 404 });
                }
            } else {
                isQueen = rankMeetsRequirement(profile.hierarchy, "Secretary");
            }
        }

        // For chats.member_id: use UUID if available, else fall back to email
        const chatMemberId = isUUID ? rawSender : (senderEmail || rawSender);
        const conversationContext = isQueen ? conversationId || chatMemberId : chatMemberId;
        const userRank = profile.hierarchy || 'Hall Boy';
        const rankRule = HIERARCHY_RULES.find(r => r.name.toLowerCase() === userRank.toLowerCase()) || HIERARCHY_RULES[HIERARCHY_RULES.length - 1];

        if (!isQueen && type === 'photo' && !rankMeetsRequirement(userRank, 'Silverman')) return NextResponse.json({ success: false, error: `Rank error` }, { status: 403 });
        if (!isQueen && type === 'video' && !rankMeetsRequirement(userRank, 'Butler')) return NextResponse.json({ success: false, error: `Rank error` }, { status: 403 });

        let newWallet = profile.wallet;
        if (!isQueen && type !== 'wishlist' && type !== 'system') {
            const cost = rankRule.speakCost || 0;
            const currentWallet = Number(profile.wallet || 0);

            if (currentWallet < cost) return NextResponse.json({ success: false, error: "Insufficient coins" }, { status: 402 });

            newWallet = currentWallet - cost;
            // Update wallet by profile UUID if available, else by email
            const walletUpdateQuery = profile.id
                ? supabase.from('profiles').update({ wallet: newWallet }).eq('id', profile.id)
                : supabase.from('profiles').update({ wallet: newWallet }).eq('member_id', senderEmail);
            const { error: updateErr } = await walletUpdateQuery;
            if (updateErr) return NextResponse.json({ success: false, error: "Failed to deduct coins." }, { status: 500 });
        }

        const insertData: any = {
            member_id: conversationContext,
            sender_email: senderEmail,
            content,
            type,
            metadata: { ...metadata, isQueen }
        };


        const { data: msgData, error: msgErr } = await adminClient.from('chats').insert(insertData).select().single();

        if (msgErr) {
            if (msgErr.message.includes('sender_email') || msgErr.message.includes('member_id')) {
                delete insertData.sender_email;
                delete insertData.member_id;
                const retry = await adminClient.from('chats').insert(insertData).select().single();
                if (retry.error) {
                    if (!isQueen) {
                        const rollbackQuery = profile.id
                            ? supabase.from('profiles').update({ wallet: profile.wallet }).eq('id', profile.id)
                            : supabase.from('profiles').update({ wallet: profile.wallet }).eq('member_id', senderEmail);
                        await rollbackQuery;
                    }
                    return NextResponse.json({ success: false, error: retry.error.message }, { status: 500 });
                }
                return NextResponse.json({ success: true, data: retry.data, newWallet });
            }
            if (!isQueen) {
                const rollbackQuery = profile.id
                    ? supabase.from('profiles').update({ wallet: profile.wallet }).eq('id', profile.id)
                    : supabase.from('profiles').update({ wallet: profile.wallet }).eq('member_id', senderEmail);
                await rollbackQuery;
            }
            return NextResponse.json({ success: false, error: `Failed to store message: ${msgErr.message}` }, { status: 500 });
        }

        // When a tribute/wishlist is sent, also post a card to global chat
        if (type === 'wishlist' && !msgErr) {
            try {
                const meta = metadata || {};
                await adminClient.from('global_messages').insert({
                    sender_email: 'system',
                    sender_name: 'SYSTEM',
                    sender_avatar: null,
                    message: `UPDATE_TRIBUTE_CARD::${JSON.stringify({
                        senderName: profile?.name || senderEmail.split('@')[0],
                        senderAvatar: profile?.avatar_url || null,
                        title: meta.title || content,
                        image: meta.image || null,
                        price: meta.price || 0,
                    })}`,
                });
            } catch (_) {}
        }

        // Fire push notification in background - don't block the response
        if (isQueen && conversationId) {
            // conversationId is UUID - look up by profiles.id
            const isConvUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId);
            Promise.resolve(
                adminClient
                    .from('profiles')
                    .select('onesignal_id')
                    .eq(isConvUUID ? 'id' : 'member_id', conversationId)
                    .maybeSingle()
            ).then(({ data: pushProfile }) => {
                const onesignalId = pushProfile?.onesignal_id;
                if (!onesignalId) return;
                fetch('https://onesignal.com/api/v1/notifications', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Key ${process.env.ONESIGNAL_REST_API_KEY}`,
                    },
                    body: JSON.stringify({
                        app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '761d91da-b098-44a7-8d98-75c1cce54dd0',
                        include_player_ids: [onesignalId],
                        headings: { en: 'Queen Karin' },
                        contents: { en: typeof content === 'string' ? content.slice(0, 100) : '👑 New message' },
                        url: 'https://throne.qkarin.com/profile',
                    }),
                }).catch(() => {});
            }).catch(() => {});
        }

        return NextResponse.json({ success: true, data: msgData, newWallet });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
