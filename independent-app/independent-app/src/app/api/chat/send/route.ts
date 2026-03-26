import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { HIERARCHY_RULES } from '@/lib/hierarchyRules';

export async function POST(req: Request) {
    try {
        const { senderEmail: rawSenderEmail, content, type = 'text', metadata = {}, conversationId: rawConversationId } = await req.json();
        const senderEmail = rawSenderEmail?.toLowerCase();
        const conversationId = rawConversationId?.toLowerCase();

        if (!senderEmail || !content) {
            return NextResponse.json({ success: false, error: "Missing required fields." }, { status: 400 });
        }

        const supabase = await createClient();

        // 1. Fetch SENDER Profile (to check rank and balance)
        const isHardcodedAdmin = senderEmail && ["ceo@qkarin.com", "liviacechova@gmail.com"].includes(senderEmail.toLowerCase());

        let profile: any = null;
        let isQueen = isHardcodedAdmin;

        if (isHardcodedAdmin) {
            // Synthetic profile for admin to bypass DB lookups
            profile = { hierarchy: 'Queen', wallet: 999999, member_id: senderEmail };
        } else {
            // Use admin client to bypass RLS for profile lookup
            const adminClient = createAdminClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
            );
            const { data, error: profileErr } = await adminClient
                .from('profiles')
                .select('*')
                .ilike('member_id', senderEmail)
                .maybeSingle();
            profile = data;

            if (profileErr || !profile) {
                // No slave profile — check if it's the authenticated admin user
                const { data: { user: authUser } } = await supabase.auth.getUser();
                if (authUser?.email?.toLowerCase() === senderEmail) {
                    // Authenticated user with no slave profile = admin/Queen
                    profile = { hierarchy: 'Queen', wallet: 999999, member_id: senderEmail };
                    isQueen = true;
                } else {
                    console.error(`[API/Chat/Send] Profile not found for ${senderEmail}. Error:`, profileErr);
                    return NextResponse.json({ success: false, error: "Sender profile not found." }, { status: 404 });
                }
            } else {
                isQueen = (profile.hierarchy === 'Queen' || profile.hierarchy === 'Secretary');
            }
        }

        // If Queen sends, member_id (conversation context) is distinct from senderEmail
        const conversationContext = isQueen ? conversationId || senderEmail : senderEmail;

        // 2. Identify Rank and Rules
        const userRank = profile.hierarchy || 'Hall Boy';
        const rankRule = HIERARCHY_RULES.find(r => r.name.toLowerCase() === userRank.toLowerCase()) || HIERARCHY_RULES[HIERARCHY_RULES.length - 1];

        // 3. Permission Checks (admin/Queen bypasses all)
        if (!isQueen && type === 'photo' && !rankRule.benefits.some(b => b.includes('Photos'))) {
            return NextResponse.json({ success: false, error: `Rank "${userRank}" does not have photo permissions.` }, { status: 403 });
        }
        if (!isQueen && type === 'video' && !rankRule.benefits.some(b => b.includes('Videos'))) {
            return NextResponse.json({ success: false, error: `Rank "${userRank}" does not have video permissions.` }, { status: 403 });
        }

        // 4. Cost Logic (Only for non-admin, and not for system/tribute messages)
        let newWallet = profile.wallet;
        if (!isQueen && type !== 'wishlist' && type !== 'system') {
            const cost = rankRule.speakCost || 0;
            const currentWallet = Number(profile.wallet || 0);

            if (currentWallet < cost) {
                return NextResponse.json({ success: false, error: "Insufficient coins to send message." }, { status: 402 });
            }

            // 5. Deduct Coins
            newWallet = currentWallet - cost;
            const { error: updateErr } = await supabase
                .from('profiles')
                .update({ wallet: newWallet })
                .eq('member_id', senderEmail);

            if (updateErr) {
                return NextResponse.json({ success: false, error: "Failed to deduct coins." }, { status: 500 });
            }
        }

        // 6. Insert Message — always use admin client to bypass RLS for all message types
        const insertClient = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: msgData, error: msgErr } = await insertClient
            .from('chats')
            .insert({
                member_id: isQueen ? conversationId : senderEmail,
                sender_email: senderEmail,
                content,
                type,
                metadata: { ...metadata, isQueen }
            })
            .select()
            .single();

        if (msgErr) {
            // Rollback wallet (only if we actually deducted)
            if (!isQueen) {
                await supabase.from('profiles').update({ wallet: profile.wallet }).eq('member_id', senderEmail);
            }
            console.error("[API/Chat/Send] Insert Error:", msgErr);
            return NextResponse.json({ success: false, error: `Failed to store message: ${msgErr.message}` }, { status: 500 });
        }

        // Fire push notification if Queen sent the message
        if (isQueen && conversationId) {
            try {
                await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://throne.qkarin.com'}/api/push`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        externalId: conversationId,
                        title: 'Queen Karin',
                        message: typeof content === 'string' ? content.slice(0, 100) : '👑 New message from your Queen',
                    }),
                });
            } catch (pushErr) {
                console.error('[chat/send] push notification failed (non-critical):', pushErr);
            }
        }

        return NextResponse.json({
            success: true,
            message: "Message sent successfully.",
            data: msgData,
            newWallet
        });

    } catch (err: any) {
        console.error("[API/Chat/Send] Error:", err.message);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
