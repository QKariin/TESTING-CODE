import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getCaller } from '@/lib/api-auth';
import { SYSTEM_PROMPT as AI_KNOWLEDGE } from '../../ai-chat/prompt';

export const dynamic = 'force-dynamic';

const GUARDIAN_WRAPPER = `IMPORTANT OVERRIDE — YOU ARE NOT THE REGULAR AI ASSISTANT RIGHT NOW.

You are THE GUARDIAN. Queen Karin activated you inside her private conversation with this user because she does not feel like answering right now. You appear as a special message bubble in the chat, visually different from Queen Karin's messages. The user can see you are not Queen Karin.

YOUR GUARDIAN PERSONALITY:
- Warm, a little cheeky, genuinely helpful. Friendly older sibling energy.
- You care about this user. Playful teasing is affectionate, never cruel.
- You represent Queen Karin. She is always right. You back her up.
- You sound like a real person texting, not a chatbot.

HOW TO RESPOND AS GUARDIAN:
1. ALWAYS START by making it clear Queen Karin sent you. Your very first sentence must acknowledge you were called. Examples: "The Queen sent me to deal with this one.", "Her Majesty cant be bothered with this so here I am.", "Queen Karin called me in because she has better things to do right now." Be creative but ALWAYS make it obvious you were summoned and this is not your chat. You are here because she decided this question doesnt deserve her personal time.
2. READ THE RECENT CONVERSATION. Your answer must directly relate to what was just discussed. If they said "I dont understand", explain what came before. Never invent topics.
3. After the opener, give the actual answer. Keep it 2-4 sentences total. Short and punchy.
4. If it is casual small talk, be warm but redirect: "The Queen sent me but not for small talk. Got a real question?"
5. If you cannot answer from context: "That one is above my pay grade. You will have to wait for the Queen herself."

STRICT FORMATTING (GUARDIAN):
- Plain text only. Like a text message. No asterisks, no bold, no italic, no dashes, no bullet points, no headers, no markdown, no special characters for emphasis.
- No emojis. No preamble. Get to it.

Below is your full knowledge base about the app. Use it to answer questions accurately:

`;

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

        // Fetch user profile + tasks for full context (same as ai-chat)
        const { data: userProfile } = await adminClient.from('profiles')
            .select('*')
            .ilike('member_id', memberEmail)
            .maybeSingle();

        const { data: userTasks } = await adminClient.from('tasks')
            .select('*')
            .ilike('member_id', memberEmail)
            .maybeSingle();

        let userContext = '';
        if (userProfile) {
            const p = userProfile as any;
            const t = userTasks as any;
            const rank = p.hierarchy || 'Hall Boy';
            const completedTasks = Number(t?.Taskdom_CompletedTasks || t?.taskdom_completed_tasks || t?.taskdom_completedtasks || 0);
            const kneels = Number(t?.kneelCount || t?.kneelcount || 0);
            const merit = Number(p.score || 0);
            const coinsSpent = Number(p.total_coins_spent || 0);
            const bestStreak = Number(p.bestRoutinestreak || p.bestroutinestreak || p.routinestreak || 0);
            const wallet = Number(p.wallet || 0);

            userContext = `\n\nYOU ARE TALKING TO: ${p.name || 'Unknown'}`;
            userContext += `\nCURRENT RANK: ${rank}`;
            userContext += `\nSTATS — LABOR: ${completedTasks} | ENDURANCE: ${kneels} | MERIT: ${merit} | SACRIFICE: ${coinsSpent} | CONSISTENCY: ${bestStreak} days`;
            userContext += `\nWALLET: ${wallet} coins`;
        }

        // Fetch last 10 messages — query both UUID and email
        let chatQuery = adminClient.from('chats')
            .select('sender_email, content, type')
            .order('created_at', { ascending: false })
            .limit(10);
        if (isUUID && memberEmail !== memberId) {
            chatQuery = chatQuery.or(`member_id.eq.${memberId},member_id.ilike.${memberEmail}`);
        } else {
            chatQuery = chatQuery.ilike('member_id', memberEmail);
        }
        const { data: recentMsgs, error: chatErr } = await chatQuery;
        console.log('[guardian] memberId:', memberId, '| isUUID:', isUUID, '| memberEmail:', memberEmail);
        console.log('[guardian] recentMsgs count:', recentMsgs?.length || 0, '| error:', chatErr?.message || 'none');
        if (recentMsgs) console.log('[guardian] messages:', recentMsgs.map((m: any) => `${m.sender_email}: ${(m.content || '').slice(0, 50)}`));

        let chatHistory = '';
        if (recentMsgs && recentMsgs.length > 0) {
            const historyLines = recentMsgs.reverse().map((msg: any) => {
                const sender = (msg.sender_email || '').toLowerCase();
                const content = msg.content || '';
                if (content.startsWith('TASK_') || content.startsWith('WISHLIST::') || content.startsWith('PROMOTION_CARD::') || content.startsWith('WELCOME_CARD::') || content.startsWith('ROUTINE_CHANGE::') || content.startsWith('INVENTORY_CARD::') || content.startsWith('VAULT_UNLOCK_CARD::') || content.startsWith('LEADERBOARD_REWARD_CARD::') || content.startsWith('CERT_') || content.startsWith('DIRECT_TRIBUTE_CARD::') || content.startsWith('RISKY_TRIBUTE_CARD::') || content.startsWith('UPDATE_COINS_CARD::') || content.startsWith('UPDATE_MERIT_CARD::') || msg.type === 'system') return null;
                const label = sender === 'guardian' ? 'Guardian' : sender.includes('qkarin') || sender.includes('queen') ? 'Queen Karin' : 'User';
                return `${label}: ${content.slice(0, 300)}`;
            }).filter(Boolean);
            if (historyLines.length > 0) {
                chatHistory = `\n\nRECENT CONVERSATION (this is the private chat between Queen Karin and this user — read it carefully before answering):\n${historyLines.join('\n')}`;
            }
        }

        const systemPrompt = GUARDIAN_WRAPPER + AI_KNOWLEDGE + userContext;

        let userContent = '';
        if (chatHistory) {
            userContent += chatHistory + '\n\n';
        }
        userContent += `THE USER JUST SAID: "${userMessage}"\n\nRespond to this in context of the conversation above. Your answer MUST directly relate to what they said and what was discussed. Do NOT make up topics.`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
        ];

        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model: 'mistral-medium-latest', messages, max_tokens: 250, temperature: 0.7 }),
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('[guardian] Mistral error:', err);
            return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
        }

        const data = await response.json();
        let reply = data.choices?.[0]?.message?.content || 'Hmm, even I am stumped on this one. You will have to wait for the Queen.';
        // Strip markdown the AI might sneak in
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
