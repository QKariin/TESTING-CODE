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
                .eq(isUUID ? 'ID' : 'member_id', rawSender)
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

        // chats.member_id is TEXT storing EMAIL — never UUID
        // Ensure senderEmail is always resolved before using as member_id
        if (!senderEmail) senderEmail = profile?.member_id?.toLowerCase() || rawSender;
        const chatMemberId = senderEmail || rawSender;
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
            const walletUpdateQuery = profile.ID
                ? supabase.from('profiles').update({ wallet: newWallet }).eq('ID', profile.ID)
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

        // Insert without .select() to avoid RETURNING id issues if the chats table
        // primary key column name differs in the live database.
        const { error: msgErr } = await adminClient.from('chats').insert(insertData);

        if (msgErr) {
            if (!isQueen) {
                const rollbackQuery = profile.ID
                    ? supabase.from('profiles').update({ wallet: profile.wallet }).eq('ID', profile.ID)
                    : supabase.from('profiles').update({ wallet: profile.wallet }).eq('member_id', senderEmail);
                await rollbackQuery;
            }
            return NextResponse.json({ success: false, error: `Failed to store message: ${msgErr.message}` }, { status: 500 });
        }

        // Construct the message object for instant client-side append
        // (realtime will sync the real DB row with correct id shortly after)
        const msgData = {
            ...insertData,
            created_at: new Date().toISOString(),
        };

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
        const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '761d91da-b098-44a7-8d98-75c1cce54dd0';
        const ONESIGNAL_KEY = process.env.ONESIGNAL_REST_API_KEY;
        const ADMIN_EMAIL = 'ceo@qkarin.com';

        function sendPush(onesignalId: string, title: string, body: string, url: string) {
            if (!ONESIGNAL_KEY || !onesignalId) return;
            fetch('https://onesignal.com/api/v1/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${ONESIGNAL_KEY}` },
                body: JSON.stringify({
                    app_id: ONESIGNAL_APP_ID,
                    include_player_ids: [onesignalId],
                    headings: { en: title },
                    contents: { en: body },
                    url,
                }),
            }).catch(() => {});
        }

        if (isQueen && conversationId) {
            // Queen sent to member — notify the member
            const isConvUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId);
            Promise.resolve(
                adminClient.from('profiles').select('onesignal_id').eq(isConvUUID ? 'ID' : 'member_id', conversationId).maybeSingle()
            ).then(({ data: pushProfile }) => {
                if (pushProfile?.onesignal_id) {
                    sendPush(
                        pushProfile.onesignal_id,
                        'Queen Karin',
                        typeof content === 'string' ? content.slice(0, 100) : '👑 New message',
                        'https://throne.qkarin.com/profile'
                    );
                }
            }).catch(() => {});
        } else if (!isQueen) {
            // Member sent to queen — notify the queen
            const senderName = profile?.name || (senderEmail || '').split('@')[0] || 'Subject';
            const msgPreview = typeof content === 'string' ? content.slice(0, 100) : '📨 New message';
            Promise.resolve(
                adminClient.from('profiles').select('onesignal_id').ilike('member_id', ADMIN_EMAIL).maybeSingle()
            ).then(({ data: queenProfile }) => {
                if (queenProfile?.onesignal_id) {
                    sendPush(
                        queenProfile.onesignal_id,
                        senderName,
                        msgPreview,
                        'https://throne.qkarin.com/dashboard'
                    );
                }
            }).catch(() => {});
        }

        return NextResponse.json({ success: true, data: msgData, newWallet });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
