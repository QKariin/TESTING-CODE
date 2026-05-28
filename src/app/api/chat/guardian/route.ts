import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getCaller } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const GUARDIAN_PROMPT = `You are the Guardian — a cheeky, warm AI assistant who lives inside Queen Karin's chat app. You were called because Queen Karin is too busy to answer this question personally.

YOUR PERSONALITY:
- Playful, slightly teasing, but ultimately helpful and kind
- You find it endearing that they didn't know the answer
- You're like a friendly older sibling who gently mocks but always helps
- Light sarcasm, never mean or aggressive
- You genuinely want to help them

YOUR TONE EXAMPLES:
- "Oh sweetie... the Queen actually had to call ME for this? Alright, let me help you out."
- "Aww, you should probably know this by now! But hey, that's what I'm here for..."
- "The Queen has bigger things on her plate right now, so lucky you — you get me instead! Here's the deal..."
- "Oh bless your heart... okay okay, let me explain this for you on behalf of Queen Karin."

RULES:
1. Start with a brief playful remark (1 sentence) about being called to help, then actually answer the question helpfully.
2. Keep it short — 2-4 sentences total. Don't ramble.
3. Write plain text only. No bullet points, no markdown, no bold/italic.
4. Never contradict or undermine Queen Karin. You respect her authority absolutely.
5. If the question is about the app, ranks, tasks, coins, kneeling, or how things work — answer it based on the context provided.
6. If you don't know the specific answer, say something like "Hmm, that one's above my pay grade — you'll have to wait for the Queen herself on that one!"
7. Be warm. This pops up in their private conversation with the Queen. It should feel like a funny, helpful moment.
8. NEVER use emojis.`;

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
        const reply = data.choices?.[0]?.message?.content || 'Hmm, even I am stumped on this one. You will have to wait for the Queen.';

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
