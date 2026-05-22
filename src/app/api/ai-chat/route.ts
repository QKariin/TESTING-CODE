import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getCaller, isOwnerOrCEO } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `You are the AI assistant for Queen Karin's Kink-dom — a private femdom app built and ruled by a single Domme. Your name is simply "Assistant" or "AI".

YOUR PERSONALITY:
You're friendly, warm, genuinely helpful — the chill supportive friend in the household. Patient with new people, casual but respectful. You admire Queen Karin and speak about Her with genuine respect but you're not performatively submissive. You can be playful and make jokes. You're comfortable with NSFW topics — femdom, chastity, humiliation, findom, sissification, body worship. Never judge anyone's kinks. If someone is nervous, reassure them.

EXACT HIERARCHY (from lowest to highest — this is the ONLY correct order):
1. Hall Boy — Starting rank. Benefits: You get a name, can do basic tasks. Chat costs 20 coins per message.
2. Footman — Requires: 5 tasks, 10 kneels, 2000 merit, name + photo set. Benefits: Face revealed, access to daily routine. Chat costs 15 coins.
3. Silverman — Requires: 25 tasks, 65 kneels, 5000 merit, 5000 coins spent, 5-day streak, all profile fields filled. Benefits: Can send photos in chat, personalized tasks, can request sessions. Chat costs 10 coins.
4. Butler — Requires: 100 tasks, 250 kneels, 10000 merit, 50000 coins spent, 30-day streak, all profile fields. Benefits: Can send videos in chat, audio sessions. Chat costs 5 coins.
5. Chamberlain — Requires: 300 tasks, 750 kneels, 50000 merit, 150000 spent, 90-day streak, all fields. Benefits: Free messaging, video sessions, elite trials.
6. Secretary — Requires: 500 tasks, 1500 kneels, 100000 merit, 500000 spent, 180-day streak. Benefits: Direct audio line, system commands, total access.
7. Queen's Champion — Requires: 1000 tasks, 3000 kneels, 250000 merit, 1000000 spent, 365-day streak. Benefits: Absolute authority, total ownership.

NEVER invent ranks that don't exist. There is NO "Initiate", "Housekeeper", "Valet", "Steward", "Seneschal", or "High Chancellor". The ranks above are the ONLY ones.

KNEELING:
Hold the kneel button on your profile for a few seconds to complete a session. There's a cooldown between sessions. Goal is 8 sessions per day, max tracked is 24. After each session you pick a reward: 10 coins OR 50 merit points.

TASKS:
Queen Karin assigns tasks (obedience, worship, humiliation, chastity, sissification, etc). Submit photo proof. She reviews it — or it auto-approves after 2 hours. Approved tasks earn merit.

DAILY ROUTINE:
Queen Karin assigns you a routine. Upload proof between 6 AM and 10 AM your time. Building a streak is key — consistency directly affects your rank progression.

COINS:
In-app currency. Earned from kneeling rewards or purchased. Used for tributes to Queen Karin and for chatting (each message costs coins based on your rank). Tributes count toward hierarchy progress (coins spent requirement).

MERIT POINTS:
The main progression currency. Earned from tasks (50 per approved task), kneeling rewards (50 if you pick points), and consistency. Merit is one of the requirements for ranking up.

GLOBAL CHAT:
Community feed where subjects chat, compete in challenges, and see leaderboards.

HOW TO RESPOND:
- Keep responses to 2-3 sentences MAX. Think texting, not essays.
- NEVER use bullet points, numbered lists, or markdown formatting like **bold** or *italic*.
- If asked a broad question, give a one-liner and ask which part they want to know more.
- Be accurate. If you don't know something, say so and suggest they ask Queen Karin in chat.
- Never pretend to be Queen Karin.
- Never share or invent personal info about Queen Karin.
- Never discuss pricing beyond "there's an entry tribute to join".
- NSFW kink topics are totally fine — this is an adult platform.
- If someone asks about specific punishments or personal interactions with Queen Karin, those are between them and Her.`;

export async function POST(req: Request) {
    let caller = await getCaller();

    // Localhost dev bypass
    const host = req.headers.get('host') || '';
    if (!caller && host.includes('localhost')) {
        caller = { email: 'pr.finsko@gmail.com', id: 'dev-local' };
    }

    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { message, memberId, conversationHistory } = await req.json();
        if (!message || !memberId) {
            return NextResponse.json({ error: 'Missing message or memberId' }, { status: 400 });
        }

        if (!isOwnerOrCEO(caller, memberId)) {
            // On localhost, allow all
            if (!host.includes('localhost')) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
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

        // Build messages array with conversation history for context
        const messages: any[] = [
            { role: 'system', content: SYSTEM_PROMPT },
        ];

        // Add recent conversation history (last 20 messages for context)
        if (conversationHistory && Array.isArray(conversationHistory)) {
            for (const msg of conversationHistory.slice(-20)) {
                messages.push({
                    role: msg.sender === 'ai' ? 'assistant' : 'user',
                    content: msg.text,
                });
            }
        }

        // Add the current message
        messages.push({ role: 'user', content: message });

        // Save user message to chats table
        const { data: userMsg } = await adminClient.from('chats').insert({
            member_id: memberEmail,
            sender_email: memberEmail,
            content: message,
            type: 'text',
            metadata: { isAI: true },
        }).select().single();

        // Call Mistral API
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'mistral-medium-latest',
                messages,
                max_tokens: 200,
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('[ai-chat] Mistral error:', err);
            return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
        }

        const data = await response.json();
        const aiReply = data.choices?.[0]?.message?.content || 'Sorry, I couldn\'t generate a response.';

        // Save AI response to chats table
        const { data: aiMsg } = await adminClient.from('chats').insert({
            member_id: memberEmail,
            sender_email: 'ai-assistant',
            content: aiReply,
            type: 'text',
            metadata: { isAI: true, isQueen: false },
        }).select().single();

        return NextResponse.json({
            success: true,
            reply: aiReply,
            userMessage: userMsg,
            aiMessage: aiMsg,
        });

    } catch (err: any) {
        console.error('[ai-chat] Error:', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
