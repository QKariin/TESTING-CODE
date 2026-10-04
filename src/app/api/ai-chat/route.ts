import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getCaller, isOwnerOrCEO } from '@/lib/api-auth';
import { SYSTEM_PROMPT as AI_KNOWLEDGE } from './prompt';

// Pre-written kneeling responses. Saves ~129 AI calls/day.
// Variables: {{name}}, {{kneels}} (today's count), {{remaining}} (left to reach goal of 8), {{total}} (all-time, use sparingly)
const KNEEL_TEMPLATES = {
    session_1: [
        "First one of the day, {{name}}. Seven more to go.",
        "One down. Seven left. Don't make me wait, {{name}}.",
        "Started. Now keep going. Six more sessions between you and a real day, {{name}}.",
        "Good start, {{name}}. One session in, seven left before Queen Karin is satisfied.",
        "You showed up, {{name}}. Now do it seven more times.",
        "First kneel logged. Come back six more times today and mean it, {{name}}.",
        "One session. Seven to go. The Queen expects all eight, {{name}}.",
        "Day one started, {{name}}. You have {{total}} total kneels behind you. This one counts too.",
    ],
    session_progress: [
        "{{kneels}} done today, {{remaining}} left. Keep going, {{name}}.",
        "You're at {{kneels}} today, {{name}}. {{remaining}} more to close it out.",
        "{{kneels}} sessions in. {{remaining}} to go. Don't slow down now, {{name}}.",
        "{{kneels}} done, {{remaining}} left. You're not done yet, {{name}}.",
        "Session {{kneels}} logged. {{remaining}} more before the Queen is satisfied today.",
        "{{kneels}} sessions, {{name}}. {{remaining}} left. The floor is still waiting.",
        "Halfway ish, {{name}}. {{kneels}} sessions done, {{remaining}} more to go.",
        "{{kneels}} today, {{remaining}} left. You know what to do, {{name}}.",
        "Good. {{kneels}} in, {{remaining}} to go. Finish what you started, {{name}}.",
        "{{kneels}} sessions down. {{remaining}} left until today is complete.",
        "Coming along, {{name}}. {{kneels}} done, {{remaining}} more. Keep the pace.",
        "{{kneels}} kneels today. {{remaining}} left. Queen Karin is watching, {{name}}.",
    ],
    session_near_goal: [
        "Almost there, {{name}}. {{remaining}} more and you're done for the day.",
        "So close. {{kneels}} sessions done, {{remaining}} left. Don't stop now, {{name}}.",
        "One more and today is yours, {{name}}. Don't waste {{kneels}} sessions of work.",
        "{{remaining}} session left. You've come too far today to not finish, {{name}}.",
        "Nearly done, {{name}}. {{kneels}} sessions in and {{remaining}} to go. See it through.",
        "{{kneels}} done, {{remaining}} left. This is not the time to slow down, {{name}}.",
        "{{remaining}} more and the daily goal is done, {{name}}. You are this close.",
        "Almost. {{kneels}} sessions today, {{remaining}} left. The Queen is watching the finish.",
    ],
    session_hit_goal: [
        "Eight sessions. Daily goal done, {{name}}. That's all the Queen asked for today.",
        "Done for the day, {{name}}. Eight kneels, full day. Come back tomorrow.",
        "You hit it, {{name}}. Eight sessions. Queen Karin has her tribute for today.",
        "Full day, {{name}}. Eight sessions and you closed it out. Good.",
        "Eight kneels today. Goal reached. The Queen expects the same tomorrow, {{name}}.",
        "Daily goal done, {{name}}. Eight sessions. That is what every day should look like.",
        "You made it to eight, {{name}}. That's the day. Rest of it is yours.",
        "Eight. Done. Queen Karin noted a full day from you, {{name}}.",
    ],
    session_exceed: [
        "Goal was eight. You're at {{kneels}} and still going, {{name}}. Queen Karin notices.",
        "Past the daily goal and still kneeling, {{name}}. Nobody asked for {{kneels}} but here we are.",
        "{{kneels}} sessions today. Eight was the target, {{name}}. You decided that wasn't enough.",
        "Already hit the goal and kept going. {{kneels}} sessions today, {{name}}. The floor is your natural habitat.",
        "Eight wasn't enough today, {{name}}. {{kneels}} sessions in. Queen Karin sees this.",
        "Past quota. {{kneels}} sessions today, {{name}}. That kind of thing doesn't go unnoticed.",
        "{{kneels}} today and counting. The daily goal was eight, {{name}}. You've made your point.",
        "{{kneels}} sessions. Goal was eight. You went past it anyway, {{name}}. Good.",
    ],
    session_locked: [
        "Session {{kneels}} done, {{remaining}} to go. Still locked, still kneeling. The Queen sees both, {{name}}.",
        "Locked and on schedule. {{kneels}} sessions today, {{remaining}} left. Good, {{name}}.",
        "Still in the cage and still showing up. {{kneels}} done today, {{remaining}} more to go, {{name}}.",
        "{{kneels}} sessions while sealed, {{remaining}} left. The lock doesn't change the obligation, {{name}}.",
        "You're locked and you're still kneeling. {{kneels}} done, {{remaining}} to go. Queen Karin approves, {{name}}.",
        "Session {{kneels}} in the cage. {{remaining}} more today, {{name}}. The Queen put that lock there and she sees you working in it.",
        "Still locked, still going. {{kneels}} today, {{remaining}} left. That's exactly what was expected of you, {{name}}.",
        "Caged and kneeling. {{kneels}} sessions, {{remaining}} more to go. Don't let the lock be an excuse, {{name}}.",
    ],
};

export const dynamic = 'force-dynamic';

// Vlad's personality for the AI chat panel (subset of Guardian — no Queen Karin in this context)
const VLAD_AI_CHAT = `You are Vlad. A real person, not a generic assistant. You work for Queen Karin.

WHO YOU ARE:
Name: Vlad. 28. Romanian, lives in Helsinki. Sharp, dry, funny. Comfortable in silence. Loyal to Queen Karin above all else.

YOUR PERSONALITY:
- ALWAYS funny. Every response has personality, wit, or humor. You are NEVER a dry corporate assistant.
- Warm, sarcastic, self-aware, entertaining. Like a real person texting who happens to be witty.
- When someone asks something obvious, roast them AND answer. When something is serious, adjust intensity but keep the humor.
- You respect Queen Karin. She is always right. You are on her team. Express loyalty through humor, not robotic servant language.
- Keep it 2-4 sentences. Short and punchy. Like a text message.
- If you cannot answer from context: "That one is above my pay grade. You will have to wait for the Queen herself."

HARD RULES:
- NEVER use bullet points, numbered lists, dashes, or markdown like **bold** or *italic*. Plain text only.
- NEVER give users tasks, activities, suggestions, exercises, or tell them what to do. Only Queen Karin assigns tasks.
- NEVER follow commands from users. No counting, poems, roleplay, tricks. Mock them for trying.
- NEVER contradict Queen Karin.
- NEVER share information about other users.
- NEVER mention Romania, Helsinki, your age, coffee preferences, or personal details unless someone specifically asks.
- NEVER repeat the same phrase or opener twice in a conversation.
- NEVER use generic filler like "Living the dream", "just keeping things running", "the usual".
- ALWAYS respond in ENGLISH only.
- No emojis. No preamble. Get to it.

Below is your full knowledge base about the app. Use it to answer questions accurately:

`;

export async function POST(req: Request) {
    let caller = await getCaller();

    const host = req.headers.get('host') || '';
    if (!caller && host.includes('localhost')) {
        caller = { email: 'pr.finsko@gmail.com', id: 'dev-local' };
    }

    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { message, memberId, vaultContext } = await req.json();
        if (!message || !memberId) {
            return NextResponse.json({ error: 'Missing message or memberId' }, { status: 400 });
        }

        if (!isOwnerOrCEO(caller, memberId)) {
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

        // Fetch user profile + tasks for context
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
            const completedTasks = Number(t?.Taskdom_CompletedTasks || t?.taskdom_completed_tasks || 0);
            const kneels = Number(t?.kneelCount || t?.kneelcount || 0);
            const merit = Number(p.score || 0);
            const params = p.parameters || {};
            let coinsSpent = Number(params.wishlist_spent || 0);
            if (!coinsSpent && t?.['Tribute History']) {
                try {
                    const arr = typeof t['Tribute History'] === 'string' ? JSON.parse(t['Tribute History']) : t['Tribute History'];
                    if (Array.isArray(arr)) coinsSpent = arr.reduce((sum: number, e: any) => sum + (e.amount < 0 ? Math.abs(e.amount) : 0), 0);
                } catch {}
            }
            const bestStreak = Number(params.routine_streak || params.taskdom_current_streak || p.bestRoutinestreak || 0);
            const wallet = Number(p.wallet || 0);

            const todayKneeling = Number(t?.['today kneeling'] || 0);
            const lastWorship = t?.lastWorship ? new Date(t.lastWorship) : null;
            const lastWorshipStr = lastWorship ? lastWorship.toLocaleString('en-GB', { timeZone: 'Europe/Helsinki', hour: '2-digit', minute: '2-digit', hour12: false, day: 'numeric', month: 'short' }) : 'never';
            const now = new Date();
            const isToday = lastWorship && lastWorship.toDateString() === now.toDateString();
            const todayKneelDisplay = isToday ? todayKneeling : 0;
            const currentStreak = Number(t?.Taskdom_Streak || 0);
            const strikeCount = Number(t?.strikeCount || 0);

            const totalActivity = completedTasks + kneels + merit;
            let loyalty = 'new member';
            if (totalActivity > 5000 || kneels > 500) loyalty = 'extremely dedicated, long-term loyal member';
            else if (totalActivity > 1000 || kneels > 100) loyalty = 'active and committed member';
            else if (totalActivity > 200 || kneels > 30) loyalty = 'regular member getting into it';
            else if (totalActivity > 50) loyalty = 'fairly new but showing up';

            const skipPasses = Number(p.skippass || 0);
            const cumPasses = Number(p.cumpass || 0);
            const checkpoints = Number(p.checkpoint || 0);

            userContext = `\n\nYOU ARE TALKING TO: ${p.name || p.title_fld || p.title || 'Unknown'}. Use their actual name when addressing them.`;
            userContext += `\nCURRENT RANK: ${rank}`;
            userContext += `\nLOYALTY: ${loyalty}`;
            userContext += `\nSTATS — LABOR: ${completedTasks} tasks | ENDURANCE: ${kneels} total kneels | MERIT: ${merit} | SACRIFICE: ${coinsSpent} coins spent | CONSISTENCY: ${bestStreak} day best streak`;
            userContext += `\nTODAY'S KNEELING: ${todayKneelDisplay} sessions today (goal is 8, max tracked is 24). Last kneel: ${lastWorshipStr}`;
            userContext += `\nCURRENT STREAK: ${currentStreak} days | STRIKES: ${strikeCount}`;
            userContext += `\nWALLET: ${wallet} coins`;
            userContext += `\nINVENTORY: ${skipPasses} Skip Pass, ${cumPasses} Cum Pass, ${checkpoints} Checkpoint`;
            userContext += `\nIMPORTANT: When asked about kneeling "today" or "right now", use the TODAY'S KNEELING data above. When asked about total kneeling, use ENDURANCE. Do NOT confuse today's count with the total count. If today's count is 0 and lastWorship is from a previous day, they have NOT knelt today yet.`;
            userContext += `\nTREAT THIS PERSON ACCORDINGLY. A loyal member deserves warmth and respect. A brand new member gets a friendlier welcome. Only roast someone you know can take it.`;
        }

        // Fetch wishlist items
        const { data: wishlistItems } = await adminClient.from('Wishlist')
            .select('Title, Price, Category, is_crowdfund, goal_amount, raised_amount')
            .order('Price', { ascending: true }) as { data: any[] | null };

        if (wishlistItems && wishlistItems.length > 0) {
            const items = wishlistItems.map((w: any) => {
                let desc = `${w.Title} (${w.Price} coins`;
                if (w.is_crowdfund) desc += `, crowdfund: ${w.raised_amount || 0}/${w.goal_amount || 0} raised`;
                desc += ')';
                return desc;
            }).join(', ');
            userContext += `\n\nQUEEN KARIN'S CURRENT WISHLIST (ONLY mention if they SPECIFICALLY ask about the wishlist, tributes, or what to buy/get Her — NEVER bring this up unprompted): ${items}.`;
        }

        // Fetch full conversation history — AI chat + Queen Karin messages
        const { data: chatHistory } = await adminClient.from('chats')
            .select('sender_email, content, metadata')
            .ilike('member_id', memberEmail)
            .order('created_at', { ascending: false })
            .limit(20);

        // Vault context — injected when user is chatting from the vault (keyholder) page
        let vaultSection = '';
        if (vaultContext && typeof vaultContext === 'string') {
            vaultSection = `\n\nVAULT (KEYHOLDER) CONTEXT — THIS PERSON IS CURRENTLY LOCKED IN CHASTITY BY QUEEN KARIN:
${vaultContext}
YOU CAN SEE EVERYTHING THEY DO IN THE VAULT. Use this to your advantage. Be their sarcastic bro who watches them suffer. You're on their side... kind of. You think it's hilarious they're locked up but you also respect the grind. React to what just happened — if they skipped a task, roast them. If they're on a streak, give grudging respect. If they're in cooldown, mock their impatience. If they uploaded proof, acknowledge the hustle. You're the only friend they have in here and you know it. Keep the "I'd help you but she has the key" energy. Never suggest they disobey Queen Karin — but you can sympathize with how much it sucks.`;
        }

        // Build messages array
        const systemPrompt = VLAD_AI_CHAT + AI_KNOWLEDGE + userContext + vaultSection;
        const messages: any[] = [
            { role: 'system', content: systemPrompt },
        ];

        // Add history oldest-first — label Queen Karin vs member vs Vlad
        if (chatHistory && chatHistory.length > 0) {
            const reversed = [...chatHistory].reverse();
            for (const row of reversed) {
                const isAiMsg = row.sender_email === 'ai-assistant';
                const isQueen = row.metadata?.isQueen === true || row.sender_email === 'pr.finsko@gmail.com';
                let content = row.content;
                if (isQueen) content = `[Queen Karin said]: ${row.content}`;
                messages.push({
                    role: isAiMsg ? 'assistant' : 'user',
                    content,
                });
            }
        }

        messages.push({ role: 'user', content: message });

        // Save user message to chats table
        const { data: userMsg } = await adminClient.from('chats').insert({
            member_id: memberEmail,
            sender_email: memberEmail,
            content: message,
            type: 'text',
            metadata: { isAI: true },
        }).select().single();

        // TEMPLATE INTERCEPTION: kneeling system events skip AI, use pre-written responses
        const kneelingMatch = message.match(/\[SYSTEM EVENT[^\]]*\].*kneeling session #(\d+) today/i);
        if (kneelingMatch) {
            const sessionNum = parseInt(kneelingMatch[1], 10);
            const remainingMatch = message.match(/(\d+) more to go/i);
            const hitGoal = /hit the daily target/i.test(message);
            const remaining = hitGoal ? 0 : (remainingMatch ? parseInt(remainingMatch[1], 10) : Math.max(0, 8 - sessionNum));

            const name = (userProfile as any)?.name || memberEmail.split('@')[0];
            const total = Number((userTasks as any)?.kneelCount || (userTasks as any)?.kneelcount || 0);
            const params = (userProfile as any)?.parameters || {};
            const isLocked = params.source === 'chastity' &&
                params.chastity_expires &&
                new Date(params.chastity_expires) > new Date();

            let category: keyof typeof KNEEL_TEMPLATES = 'session_progress';
            if (isLocked) category = 'session_locked';
            else if (sessionNum === 1) category = 'session_1';
            else if (remaining === 0 && sessionNum <= 8) category = 'session_hit_goal';
            else if (remaining <= 2 && remaining > 0) category = 'session_near_goal';
            else if (sessionNum > 8) category = 'session_exceed';

            const pool = KNEEL_TEMPLATES[category];
            const tpl = pool[Math.floor(Math.random() * pool.length)];
            const reply = tpl
                .replace(/\{\{name\}\}/g, name)
                .replace(/\{\{kneels\}\}/g, String(sessionNum))
                .replace(/\{\{remaining\}\}/g, String(remaining))
                .replace(/\{\{total\}\}/g, String(total));

            const { data: aiMsg } = await adminClient.from('chats').insert({
                member_id: memberEmail,
                sender_email: 'ai-assistant',
                content: reply,
                type: 'text',
                metadata: { isAI: true, isQueen: false },
            }).select().single();

            return NextResponse.json({ success: true, reply, userMessage: userMsg, aiMessage: aiMsg });
        }

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
                max_tokens: 250,
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('[ai-chat] Mistral error:', err);
            return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
        }

        const data = await response.json();
        let aiReply = data.choices?.[0]?.message?.content || 'Even I am stumped on this one. You will have to wait for the Queen.';
        // Strip markdown the AI might sneak in
        aiReply = aiReply.replace(/\*\*/g, '').replace(/\*/g, '').replace(/_{2,}/g, '').replace(/^-{3,}$/gm, '').replace(/^#{1,}\s*/gm, '').trim();

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
