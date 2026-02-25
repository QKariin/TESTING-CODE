import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { HIERARCHY_RULES } from '@/scripts/hierarchy-rules';

export async function POST(req: Request) {
    try {
        const { senderEmail, content, type = 'text', metadata = {}, conversationId } = await req.json();

        if (!senderEmail || !content) {
            return NextResponse.json({ success: false, error: "Missing required fields." }, { status: 400 });
        }

        const supabase = await createClient();

        // 1. Fetch SENDER Profile (to check rank and balance)
        let { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('member_id', senderEmail)
            .single();

        let isQueen = false;
        if (profileErr || !profile) {
            // FALLBACK: If profile missing but we have a conversationId and user is authenticated
            const { data: { user } } = await supabase.auth.getUser();
            if (user && user.email === senderEmail && conversationId) {
                console.warn(`[API/Chat/Send] Sender profile missing for ${senderEmail}. Treating as Queen for bootstrapping.`);
                isQueen = true;
                // Synthetic profile for logic bypass
                profile = { hierarchy: 'Queen', wallet: 999999, member_id: senderEmail } as any;

                // ASYNC: Auto-provision Queen profile so RLS works in the future
                try {
                    const bootstrapAdmin = createAdminClient(
                        process.env.NEXT_PUBLIC_SUPABASE_URL!,
                        process.env.SUPABASE_SERVICE_ROLE_KEY!
                    );
                    await bootstrapAdmin.from('profiles').upsert({
                        member_id: senderEmail,
                        id: user.id,
                        name: "Queen Karin",
                        hierarchy: 'Queen'
                    });
                } catch (e) {
                    console.error("Bootstrap profile failed", e);
                }
            } else {
                console.error(`[API/Chat/Send] Profile not found for ${senderEmail}. Error:`, profileErr);
                return NextResponse.json({ success: false, error: "Sender profile not found." }, { status: 404 });
            }
        } else {
            isQueen = (profile.hierarchy === 'Queen' || profile.hierarchy === 'Secretary');
        }
        // If Queen sends, member_id (conversation context) is distinct from senderEmail
        const conversationContext = isQueen ? conversationId || senderEmail : senderEmail;

        // 2. Identify Rank and Rules
        const userRank = profile.hierarchy || 'Hall Boy';
        const rankRule = HIERARCHY_RULES.find(r => r.name.toLowerCase() === userRank.toLowerCase()) || HIERARCHY_RULES[HIERARCHY_RULES.length - 1];

        // 3. Permission Checks
        if (type === 'photo' && !rankRule.benefits.some(b => b.includes('Photos'))) {
            return NextResponse.json({ success: false, error: `Rank "${userRank}" does not have photo permissions.` }, { status: 403 });
        }
        if (type === 'video' && !rankRule.benefits.some(b => b.includes('Videos'))) {
            return NextResponse.json({ success: false, error: `Rank "${userRank}" does not have video permissions.` }, { status: 403 });
        }

        // 4. Cost Logic (Only for non-admin)
        let newWallet = profile.wallet;
        if (!isQueen) {
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

        // 6. Insert Message
        // If Queen, use service role client to bypass RLS "chicken-and-egg" profile issue
        const insertClient = isQueen ? createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        ) : supabase;

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
