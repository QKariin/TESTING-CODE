import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { HIERARCHY_RULES } from '@/scripts/hierarchy-rules';

export async function POST(req: Request) {
    try {
        const { senderEmail, content, type = 'text', metadata = {} } = await req.json();

        if (!senderEmail || !content) {
            return NextResponse.json({ success: false, error: "Missing required fields." }, { status: 400 });
        }

        const supabase = await createClient();

        // 1. Fetch User Profile
        const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('member_id', senderEmail)
            .single();

        if (profileErr || !profile) {
            return NextResponse.json({ success: false, error: "User profile not found." }, { status: 404 });
        }

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

        // 4. Cost Logic
        const cost = rankRule.speakCost || 0;
        const currentWallet = Number(profile.wallet || 0);

        if (currentWallet < cost) {
            return NextResponse.json({ success: false, error: "Insufficient coins to send message." }, { status: 402 });
        }

        // 5. Deduct Coins
        const newWallet = currentWallet - cost;
        const { error: updateErr } = await supabase
            .from('profiles')
            .update({ wallet: newWallet })
            .eq('member_id', senderEmail);

        if (updateErr) {
            return NextResponse.json({ success: false, error: "Failed to deduct coins." }, { status: 500 });
        }

        // 6. Insert Message
        const { data: msgData, error: msgErr } = await supabase
            .from('chats')
            .insert({
                member_id: senderEmail,
                content,
                type,
                metadata
            })
            .select()
            .single();

        if (msgErr) {
            // Rollback wallet (optional but recommended)
            await supabase.from('profiles').update({ wallet: currentWallet }).eq('member_id', senderEmail);
            return NextResponse.json({ success: false, error: "Failed to store message." }, { status: 500 });
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
