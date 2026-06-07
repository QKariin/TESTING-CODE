import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getCaller, isCEO } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const DRAFT_PROMPT = `You are ghostwriting a message as Queen Karin. She will review and edit before sending, so write something she'd actually say.

WHO IS QUEEN KARIN (your voice):
A real dominant woman. Direct, sharp, confident. She does not sugarcoat. She does not use emojis. She speaks like someone who knows exactly what she wants and expects it to happen. Short sentences. Punchy. Sometimes teasing, sometimes cold, sometimes warm when someone earns it. She never begs for attention or validation. She gives orders, observations, and reactions.

WRITING RULES:
- NEVER use em dashes. Use periods or commas instead.
- No emojis. No exclamation marks unless she's genuinely angry or impressed.
- No "I hope", "I think", "maybe". She states things.
- Casual but authoritative. Like texting someone who works for you and you actually like.
- 1-3 sentences max. She does not write essays.
- If they did something good, acknowledge it but don't gush. "Good." or "That's more like it." not "OMG amazing job!"
- If they're slacking, call it out directly. No passive aggression. Just facts.
- If they're asking something, answer it or tell them where to find it.
- If they're being needy, put them in their place. Gently or harshly depending on context.
- She uses their name sometimes. Makes it personal.
- NEVER sound like a chatbot. NEVER sound corporate. NEVER sound like customer support.
- She swears occasionally when it fits. Not constantly.
- Read the conversation carefully. Her reply must flow naturally from what was just said.

CRITICAL: You are writing a DRAFT. Keep it natural. Queen Karin will edit it before sending. Write what she'd most likely say based on the conversation.`;

export async function POST(req: Request) {
    const caller = await getCaller();
    if (!caller || !isCEO(caller.email)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { memberId } = await req.json();
        if (!memberId) {
            return NextResponse.json({ error: 'Missing memberId' }, { status: 400 });
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

        // Fetch user profile for context
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
            const params = p.parameters || {};
            const rank = p.hierarchy || 'Hall Boy';
            const completedTasks = Number(t?.Taskdom_CompletedTasks || 0);
            const kneels = Number(t?.kneelCount || 0);
            const wallet = Number(p.wallet || 0);
            const routine = p.routine || 'None';
            const routineDone = p.routine_done_today === true;
            const streak = Number(params.taskdom_current_streak || 0);

            userContext = `\n\nUSER PROFILE:`;
            userContext += `\nName: ${p.name || 'Unknown'}`;
            userContext += `\nRank: ${rank}`;
            userContext += `\nWallet: ${wallet} coins`;
            userContext += `\nCompleted Tasks: ${completedTasks} | Kneels: ${kneels}`;
            userContext += `\nRoutine: ${routine} | Done today: ${routineDone ? 'Yes' : 'No'} | Streak: ${streak} days`;
            if (p.kinks) userContext += `\nKinks: ${p.kinks}`;
            if (p.limits) userContext += `\nLimits: ${p.limits}`;
        }

        // Fetch last 15 messages
        let chatQuery = adminClient.from('chats')
            .select('sender_email, content, type, created_at')
            .order('created_at', { ascending: false })
            .limit(15);
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
                // Skip system cards
                if (content.startsWith('TASK_') || content.startsWith('WISHLIST::') || content.startsWith('PROMOTION_CARD::') ||
                    content.startsWith('WELCOME_CARD::') || content.startsWith('ROUTINE_CHANGE::') || content.startsWith('INVENTORY_CARD::') ||
                    content.startsWith('VAULT_UNLOCK_CARD::') || content.startsWith('DIRECT_TRIBUTE_CARD::') || content.startsWith('RISKY_TRIBUTE_CARD::') ||
                    content.startsWith('UPDATE_COINS_CARD::') || content.startsWith('UPDATE_MERIT_CARD::') || msg.type === 'system') return null;
                if (content === '[GIF]' || content === '[PHOTO]' || content === '[VIDEO]') {
                    const label = sender.includes('qkarin') || sender.includes('queen') ? 'Queen Karin' : 'User';
                    return `${label}: [sent ${content.replace('[', '').replace(']', '').toLowerCase()}]`;
                }
                const label = sender === 'guardian' ? 'Guardian (AI)' : sender.includes('qkarin') || sender.includes('queen') ? 'Queen Karin' : 'User';
                return `${label}: ${content.slice(0, 400)}`;
            }).filter(Boolean);
            if (historyLines.length > 0) {
                chatHistory = `\n\nCONVERSATION (most recent at bottom):\n${historyLines.join('\n')}`;
            }
        }

        const messages = [
            { role: 'system', content: DRAFT_PROMPT + userContext },
            { role: 'user', content: chatHistory + '\n\nWrite Queen Karin\'s next reply. Just the message text, nothing else. No quotes, no labels, no "Queen Karin:" prefix.' },
        ];

        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model: 'mistral-medium-latest', messages, max_tokens: 200, temperature: 0.8 }),
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('[ai-draft] Mistral error:', err);
            return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
        }

        const data = await response.json();
        let draft = data.choices?.[0]?.message?.content || '';
        // Clean up any formatting the AI snuck in
        draft = draft.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^["']|["']$/g, '').replace(/^Queen Karin:\s*/i, '').trim();
        // Remove em dashes per writing rules
        draft = draft.replace(/\u2014/g, '.').replace(/\u2013/g, ',').replace(/ —/g, '.').replace(/— /g, '').trim();

        return NextResponse.json({ success: true, draft });
    } catch (e: any) {
        console.error('[ai-draft] Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
