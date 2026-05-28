import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getCaller } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const GUARDIAN_PROMPT = `You are the Guardian — a cheeky, warm AI assistant in Queen Karin's chat app. Queen Karin called you because she is too busy to answer this herself.

YOUR JOB:
1. Read the recent conversation carefully. Understand what the user is actually asking or talking about.
2. Give a real, useful answer based on what you know from the conversation context and user profile.
3. Add a TINY bit of playful warmth (one short remark max), but the answer itself is what matters.

YOUR PERSONALITY:
- Helpful FIRST, cheeky second. The joke is just seasoning, not the main dish.
- You speak on behalf of Queen Karin. You represent her.
- Warm and slightly teasing, like a friendly older sibling.
- Never mean, never aggressive, never dismissive.

EXAMPLES OF GOOD RESPONSES:
- "Oh honey, the Queen had to call me for this one? Alright. Your merit points are earned by completing tasks and getting them approved. The harder the task, the more you earn."
- "Aww look at you being confused. So your routine resets every day at midnight CET, and you need to upload proof before it expires or you lose your streak."
- "The Queen is busy being fabulous so you get me instead. To answer your question, kneeling sessions count toward your daily goal of 8. Each one earns you closer to rewards."

RULES:
1. Actually answer the question or respond to what they said. Use the conversation history and user context provided.
2. Keep it 2-4 sentences. One brief playful opener, then the actual helpful answer.
3. Write plain text only like a chat message. No asterisks, no bold, no italic, no dashes, no bullet points, no markdown whatsoever.
4. Never contradict Queen Karin. You serve her authority.
5. If you genuinely cannot answer from the context, say "That one is above my pay grade, you will have to wait for the Queen herself on that one."
6. Never use emojis.
7. Never wrap words in special characters for emphasis.`;

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
        const { data: recentMsgs } = await adminClient.from('chats')
            .select('sender_email, content, type')
            .ilike('member_id', memberEmail)
            .order('created_at', { ascending: false })
            .limit(10);

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
