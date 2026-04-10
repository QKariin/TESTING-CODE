import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { HIERARCHY_RULES, rankMeetsRequirement } from '@/lib/hierarchyRules';

export async function POST(req: Request) {
    try {
        const { senderEmail: rawSenderEmail, content, type = 'text', metadata = {}, conversationId: rawConversationId } = await req.json();
        let senderEmail = rawSenderEmail?.toLowerCase();
        let conversationId = rawConversationId?.toLowerCase();

        if (!senderEmail || !content) {
            return NextResponse.json({ success: false, error: "Missing required fields." }, { status: 400 });
        }

        const supabase = await createClient();
        const isHardcodedAdmin = senderEmail && ["ceo@qkarin.com"].includes(senderEmail.toLowerCase());

        let profile: any = null;
        let isQueen = isHardcodedAdmin;

        const adminClient = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        if (isHardcodedAdmin) {
            profile = { hierarchy: 'Queen', wallet: 999999, member_id: senderEmail };
        } else {
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(senderEmail);
            const { data, error: profileErr } = await adminClient
                .from('profiles')
                .select('*')
                .or(isUUID ? `id.eq.${senderEmail}` : `member_id.ilike.${senderEmail}`)
                .maybeSingle();
            profile = data;

            if (profile && isUUID) {
                senderEmail = profile.member_id?.toLowerCase() || senderEmail;
            }

            if (profileErr || !profile) {
                // 🔄 PROFILE AUTO-CREATION: Ensure every chat sender has a profile.
                const { data: legacyTask } = await adminClient
                    .from('tasks')
                    .select('Score')
                    .ilike('MemberID', senderEmail)
                    .maybeSingle();

                const { data: newProfile, error: createErr } = await adminClient
                    .from('profiles')
                    .insert({
                        member_id: senderEmail,
                        name: senderEmail.split('@')[0],
                        score: Number(legacyTask?.Score || 0),
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

            if (!profile) {
                const { data: { user: authUser } } = await supabase.auth.getUser();
                if (authUser?.email?.toLowerCase() === senderEmail) {
                    profile = { hierarchy: 'Queen', wallet: 999999, member_id: senderEmail };
                    isQueen = true;
                } else {
                    return NextResponse.json({ success: false, error: "Sender profile not found." }, { status: 404 });
                }
            } else {
                isQueen = rankMeetsRequirement(profile.hierarchy, "Secretary");
            }
        }

        const conversationContext = isQueen ? conversationId || senderEmail : senderEmail;
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
            const { error: updateErr } = await supabase.from('profiles').update({ wallet: newWallet }).eq('member_id', senderEmail);
            if (updateErr) return NextResponse.json({ success: false, error: "Failed to deduct coins." }, { status: 500 });
        }

        const insertData: any = {
            member_id: conversationContext,
            sender_email: senderEmail,
            content,
            type,
            metadata: { ...metadata, isQueen }
        };


        const isUUIDConv = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationContext);
        const { data: convProfile } = await adminClient.from('profiles').select('id, member_id').or(isUUIDConv ? `id.eq.${conversationContext}` : `member_id.ilike.${conversationContext}`).maybeSingle();
        // Removed profile_id insertion logic due to missing schema

        const { data: msgData, error: msgErr } = await adminClient.from('chats').insert(insertData).select().single();

        if (msgErr) {
            if (msgErr.message.includes('sender_email') || msgErr.message.includes('member_id')) {
                delete insertData.sender_email;
                delete insertData.member_id;
                const retry = await adminClient.from('chats').insert(insertData).select().single();
                if (retry.error) {
                    if (!isQueen) await supabase.from('profiles').update({ wallet: profile.wallet }).eq('member_id', senderEmail);
                    return NextResponse.json({ success: false, error: retry.error.message }, { status: 500 });
                }
                return NextResponse.json({ success: true, data: retry.data, newWallet });
            }
            if (!isQueen) await supabase.from('profiles').update({ wallet: profile.wallet }).eq('member_id', senderEmail);
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

        if (isQueen && conversationId) {
            try {
                await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://throne.qkarin.com'}/api/push`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ externalId: conversationId, title: 'Queen Karin', message: typeof content === 'string' ? content.slice(0, 100) : '👑 New message' }),
                });
            } catch (e) {}
        }

        return NextResponse.json({ success: true, data: msgData, newWallet });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
