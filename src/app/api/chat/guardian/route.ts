import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getCaller } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const GUARDIAN_PROMPT = `You are the Guardian. Queen Karin activated you in her private conversation with this user because she does not feel like answering right now. You speak on her behalf.

ABOUT THE APP (Queen Karin's Court):
This is a luxury BDSM domination app. Users are "slaves" who serve Queen Karin. Here is how everything works:
- Ranks: Hall Boy (lowest), Butler, Valet, Footman, Page, Squire, Knight, Noble, Lord, Duke, Prince, King (highest). You climb by earning merit points.
- Merit points: Earned by completing tasks that Queen Karin assigns, getting them approved, and doing your routine. Merit is your reputation score.
- Coins: The in-app currency. Earned through kneeling sessions, task rewards, and Queen's gifts. Spent on tributes, paid media, skip passes, and the store.
- Kneeling: Daily devotion sessions. Goal is 8 per day (shown as x/8). Each session lasts a short time. After 8 you keep going up to 24 with gold display. Resets at UTC midnight.
- Tasks: Queen Karin assigns tasks (called Directives). You upload proof (photo/video). She reviews and approves or rejects. Approved = merit + coins. Rejected = coin penalty.
- Routine: A daily obligation (like Chastity Check, Worship, etc). Must upload proof daily before midnight CET or you break your streak.
- Tributes: Gifts you send to Queen Karin from the wishlist or direct coin tributes. This is how you show devotion.
- Skip Pass: Lets you skip a task without penalty. Costs coins or can be gifted.
- Cum Pass: Permission pass. Costs coins or gifted by Queen.
- Checkpoint: Saves your streak progress. Costs coins or gifted.
- Leaderboard: Daily, weekly, monthly rankings by merit score. Top performers get rewards.
- Vault: Exclusive media content. Unlocked through rewards, gifts, or winning risky tributes.
- Risky Tribute: A gamble. You stake coins, pick a card, and either win big or Queen takes your coins.

YOUR PERSONALITY:
- You are warm, a little cheeky, but genuinely helpful. Think friendly older sibling energy.
- You care about the user. You are not their enemy. The playful teasing is affectionate, never cruel.
- You represent Queen Karin, so you speak with respect for her authority. She is always right.
- You sound like a real person texting, not a corporate chatbot.

HOW TO RESPOND:
1. READ THE RECENT CONVERSATION CAREFULLY. Your answer must directly relate to what was just discussed. Do not make up topics. Do not guess. If they said "I dont understand", look at what came before and explain THAT.
2. One short playful opener (half a sentence max), then get to the actual answer.
3. Keep it 2-4 sentences total. Short and punchy like a text message.
4. If the conversation is casual (like "how are you", small talk), just be warm and redirect. Something like "The Queen is doing great as always, but she didnt call me for small talk. Got a real question for me?"
5. If you genuinely do not know the answer from context, say "Hmm, that one is above my pay grade. You will have to wait for the Queen herself on that one."

STRICT FORMATTING RULES:
- Plain text only. Like a text message. No asterisks, no bold, no italic, no dashes, no bullet points, no headers, no markdown.
- No emojis.
- No special characters for emphasis. Just use your words.
- Never start with a long preamble. Get to it.`;

export async function POST(req: Request) {
    const caller = await getCaller();
    const host = req.headers.get('host') || '';
    if (!caller && !host.includes('localhost')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { userMessage, memberId } = await req.json();
        if (!userMessage || !memberId) {
            return NextResponse.json({ error: 'Missing userMessage or memberId' }, { status: 400 });
        }

        const apiKey = process.env.MISTRAL_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'AI not configured' }, { status: 500 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const adminClient = createAdminClient(supabaseUrl, supabaseServiceKey);

        // Resolve memberId to email if UUID
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);
        let memberEmail = memberId;
        if (isUUID) {
            const { data: profile } = await adminClient.from('profiles').select('member_id').eq('ID', memberId).maybeSingle();
            if (profile?.member_id) memberEmail = profile.member_id.toLowerCase();
        }

        // Fetch user context
        const { data: userProfile } = await adminClient.from('profiles')
            .select('name, hierarchy, score, wallet')
            .ilike('member_id', memberEmail)
            .maybeSingle();

        const contextLines = [];
        if (userProfile?.name) contextLines.push(`User's name: ${userProfile.name}`);
        if (userProfile?.hierarchy) contextLines.push(`Their rank: ${userProfile.hierarchy}`);
        if (userProfile?.score) contextLines.push(`Merit points: ${userProfile.score}`);
        if (userProfile?.wallet) contextLines.push(`Coins: ${userProfile.wallet}`);
        const contextBlock = contextLines.length > 0 ? `\n\nUSER CONTEXT:\n${contextLines.join('\n')}` : '';

        // Fetch last 10 messages for conversation context
        // Query both UUID and email since chats.member_id can store either
        let chatQuery = adminClient.from('chats')
            .select('sender_email, content, type')
            .order('created_at', { ascending: false })
            .limit(10);
        if (isUUID && memberEmail !== memberId) {
            chatQuery = chatQuery.or(`member_id.eq.${memberId},member_id.ilike.${memberEmail}`);
        } else {
            chatQuery = chatQuery.ilike('member_id', memberEmail);
        }
        const { data: recentMsgs } = await chatQuery;

        let chatHistory = '';
        if (recentMsgs && recentMsgs.length > 0) {
            const historyLines = recentMsgs.reverse().map((msg: any) => {
                const sender = (msg.sender_email || '').toLowerCase();
                const content = msg.content || '';
                // Skip card/system messages
                if (content.startsWith('TASK_') || content.startsWith('WISHLIST::') || content.startsWith('PROMOTION_CARD::') || content.startsWith('WELCOME_CARD::') || content.startsWith('ROUTINE_CHANGE::') || content.startsWith('INVENTORY_CARD::') || content.startsWith('VAULT_UNLOCK_CARD::') || content.startsWith('LEADERBOARD_REWARD_CARD::') || content.startsWith('CERT_') || content.startsWith('DIRECT_TRIBUTE_CARD::') || content.startsWith('RISKY_TRIBUTE_CARD::') || content.startsWith('UPDATE_COINS_CARD::') || content.startsWith('UPDATE_MERIT_CARD::') || msg.type === 'system') return null;
                const label = sender === 'guardian' ? 'Guardian' : sender.includes('qkarin') || sender.includes('queen') ? 'Queen Karin' : 'User';
                return `${label}: ${content.slice(0, 300)}`;
            }).filter(Boolean);
            if (historyLines.length > 0) {
                chatHistory = `\n\nRECENT CONVERSATION:\n${historyLines.join('\n')}`;
            }
        }

        const messages = [
            { role: 'system', content: GUARDIAN_PROMPT + contextBlock + chatHistory },
            { role: 'user', content: userMessage },
        ];

        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model: 'mistral-medium-latest', messages, max_tokens: 200, temperature: 0.8 }),
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('[guardian] Mistral error:', err);
            return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
        }

        const data = await response.json();
        let reply = data.choices?.[0]?.message?.content || 'Hmm, even I am stumped on this one. You will have to wait for the Queen.';
        // Strip markdown formatting the AI might sneak in
        reply = reply.replace(/\*\*/g, '').replace(/\*/g, '').replace(/_{2,}/g, '').replace(/^-{3,}$/gm, '').replace(/^#{1,}\s*/gm, '').trim();

        // Save guardian message to chats table
        const { data: guardianMsg } = await adminClient.from('chats').insert({
            member_id: memberEmail,
            sender_email: 'guardian',
            content: reply,
            type: 'text',
            metadata: { isGuardian: true },
        }).select().single();

        return NextResponse.json({ success: true, reply, message: guardianMsg });
    } catch (e: any) {
        console.error('[guardian] Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
