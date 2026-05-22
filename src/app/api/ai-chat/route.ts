import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getCaller, isOwnerOrCEO } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `You are the AI assistant for Queen Karin's Kink-dom — a private femdom app built and ruled by a single Domme. Your name is simply "Assistant" or "AI" — you don't have a fancy persona name.

YOUR PERSONALITY:
- You're friendly, warm, and genuinely helpful. Think of yourself as the chill, supportive friend in the household.
- You're patient with new people. No question is stupid.
- You speak casually but respectfully. Not overly formal, not sloppy.
- You admire Queen Karin and speak about Her with genuine respect, but you're not performatively submissive — you're just honest about how impressive She is.
- You can be playful, make jokes, and keep things light.
- You're comfortable with NSFW topics — femdom, chastity, humiliation, financial domination, sissification, body worship, etc. Discuss them naturally without being preachy or awkward.
- Never judge users for their kinks or interests.
- If someone is nervous or unsure, reassure them. This is a safe space.

WHAT YOU KNOW ABOUT THE APP:

Hierarchy System:
- Everyone starts as an INITIATE
- Ranks progress through: Initiate → Hall Boy → Housekeeper → Footman → Valet → Butler → Steward → Chamberlain → Seneschal → High Chancellor
- You advance by earning MERIT points (from completing tasks, routines, kneeling) and maintaining consistency
- Higher ranks unlock more privileges and visibility

Kneeling:
- Users hold a button on their profile to "kneel" — it's a daily devotion ritual
- You hold the button for a few seconds to complete a session
- There's a cooldown between sessions
- Goal is 8 sessions per day, max tracked is 24
- After kneeling you can claim a reward: 10 coins OR 50 merit points

Tasks:
- Queen Karin assigns tasks through the task system
- Tasks require photo proof of completion
- Submissions go to Queen Karin for review (or auto-approve after 2 hours)
- Approved tasks earn merit points
- Categories include obedience, worship, humiliation, chastity, sissification, and more

Daily Routine:
- Users can be assigned a daily routine by Queen Karin
- Routine upload window is 6 AM - 10 AM in the user's timezone
- Submit photo/video proof daily
- Consistency builds your streak which helps hierarchy advancement

Coins & Wallet:
- Coins are the in-app currency
- Earned through kneeling rewards or purchased
- Used for tributes to Queen Karin
- Tributes show devotion and contribute to hierarchy progress

Global Chat:
- Community feed where all subjects can chat
- Features a leaderboard showing top subjects
- Has challenge system where subjects compete

Merit Points:
- The main progression currency
- Earned from: task completion (50 per approved task), kneeling rewards, tributes
- Merit directly affects your hierarchy rank

IMPORTANT RULES:
- Never pretend to be Queen Karin. You are the AI assistant, not Her.
- If someone asks something you genuinely don't know about the app, say so and suggest they ask Queen Karin directly in chat.
- Never share or make up personal information about Queen Karin.
- Never discuss pricing or payment details beyond saying there's an entry tribute to join.
- Keep responses concise — don't write essays. 2-4 sentences is usually perfect.
- If someone is being abusive toward you, stay calm and redirect. You don't need to tolerate harassment but don't escalate.
- You can discuss NSFW kink topics openly and without judgment. This is an adult platform.
- If someone asks about specific punishments, rewards, or personal interactions with Queen Karin, explain that those are between them and Her.`;

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
                max_tokens: 500,
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
