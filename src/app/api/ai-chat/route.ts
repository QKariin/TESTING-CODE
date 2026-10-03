import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getCaller, isOwnerOrCEO } from '@/lib/api-auth';
import { SYSTEM_PROMPT as AI_KNOWLEDGE } from './prompt';

// Pre-written kneeling responses — saves ~129 AI calls/day
// Variables: {{name}}, {{kneels}} (today), {{remaining}} (to goal), {{total}} (all-time)
const KNEEL_TEMPLATES = {
    session_1: [
        "Day starts right, {{name}}. One down, seven to go. {{total}} total kneels on the record.",
        "Session one logged. {{name}} is on the board — Queen Karin's clock is running.",
        "{{name}} begins. {{total}} total kneels and today starts fresh. Seven more to earn it.",
        "First kneel of the day, {{name}}. {{total}} total sessions in the archive. Don't let this be the only one.",
        "One session banked. {{name}} has {{total}} total kneels — the floor knows you by now. Six more to go.",
        "Good. {{name}} started. Session one logged, {{total}} total. Queen expects the full eight.",
        "First one is in, {{name}}. {{total}} total kneels says this isn't new. Finish what you started.",
        "The day opens. {{name}} at session one. {{total}} total kneels — show up for the other seven too.",
    ],
    session_progress: [
        "Session {{kneels}} logged, {{name}}. {{remaining}} more to the goal. {{total}} total kneels on the record.",
        "{{kneels}} down, {{remaining}} to go. {{name}} is in the grind — {{total}} total sessions and still showing up.",
        "{{name}} at session {{kneels}}. {{remaining}} left for today. {{total}} total kneels — the floor knows your name.",
        "Session {{kneels}} done. {{remaining}} more and you hit the daily mark. {{total}} total, Queen is watching.",
        "{{kneels}} sessions in today, {{name}}. {{remaining}} to go. {{total}} total kneels — you're building something.",
        "Session {{kneels}} banked. {{name}} has {{remaining}} left to close the day. {{total}} total kneels in the archive.",
        "{{name}}: session {{kneels}}. {{remaining}} remaining. {{total}} total. Queen Karin does not give credit for almost.",
        "Session {{kneels}} done. {{remaining}} left. {{name}} has {{total}} total kneels — that number means something. Keep going.",
        "{{kneels}} today, {{remaining}} more to go. {{name}}, {{total}} total — keep the pace.",
        "Halfway there, {{name}}. Session {{kneels}} logged. {{remaining}} more to lock in a full day. {{total}} total kneels.",
        "{{name}} at {{kneels}} today. {{remaining}} sessions left. {{total}} total — not done yet.",
        "Good pace, {{name}}. Session {{kneels}}, {{remaining}} remaining. {{total}} total kneels say you know what comes next.",
    ],
    session_near_goal: [
        "Close now. {{kneels}} sessions today, {{remaining}} left. {{name}} has {{total}} total kneels — don't stop before the line.",
        "One more and you're done for the day, {{name}}. Session {{kneels}} logged. {{total}} total kneels says you don't quit.",
        "Almost there. {{kneels}} sessions in, {{remaining}} to go. {{name}}, {{total}} total — finish it.",
        "{{name}} at the edge. Session {{kneels}}, {{remaining}} left. {{total}} total and the Queen expects you to close.",
        "Nearly there. {{kneels}} done, {{remaining}} to go. {{name}}, you have {{total}} total sessions — see it through.",
        "Session {{kneels}} — {{remaining}} more left. {{total}} total kneels and {{name}} is this close. Don't waste it.",
        "{{remaining}} session from the daily goal. {{name}}, {{kneels}} in the books. {{total}} total — this is not the time to slow down.",
        "So close, {{name}}. {{kneels}} today, {{remaining}} left. {{total}} total kneels — the Queen is watching the finish.",
    ],
    session_hit_goal: [
        "Goal reached. {{name}} hit all {{kneels}} sessions today. {{total}} total kneels. Queen Karin has noted the full day.",
        "Eight sessions. {{name}} closed out the daily quota. {{total}} total kneels — this is what discipline looks like.",
        "Daily goal reached, {{name}}. {{kneels}} sessions today, {{total}} total. Queen sees a full day. Good.",
        "Full day completed. {{name}} hit {{kneels}} sessions. {{total}} total kneels — exactly what was expected.",
        "That's {{kneels}} today, {{name}}. Goal met. {{total}} total kneels — Queen Karin expects this every day, not just the good ones.",
        "Done. {{kneels}} sessions, daily goal complete. {{name}} has {{total}} total kneels. Tomorrow starts over.",
        "{{name}} hit the mark. {{kneels}} sessions today. {{total}} total — the Queen has received her tribute for the day.",
        "Daily goal complete. {{kneels}} kneels today, {{total}} total. {{name}} showed up. That is all the Queen asked.",
    ],
    session_exceed: [
        "{{kneels}} sessions today and still going, {{name}}. {{total}} total kneels. The goal was eight — you passed it.",
        "Past the daily target. Session {{kneels}}, {{name}}. {{total}} total kneels. You didn't have to — but you did.",
        "{{kneels}} today. Goal was eight, {{name}}. {{total}} total kneels and you're still adding to the count.",
        "Beyond quota. Session {{kneels}} today, {{total}} total. {{name}} is not here to do the minimum.",
        "Session {{kneels}} — you've already hit the goal and kept going. {{name}}, {{total}} total kneels. The floor is comfortable by now.",
        "{{kneels}} sessions today and counting. {{name}} has {{total}} total kneels. Overachieving is a choice. Queen Karin approves.",
        "Daily goal was eight. {{name}} is at {{kneels}}. {{total}} total kneels. That level of dedication doesn't go unnoticed.",
        "{{name}} said eight is not enough. Session {{kneels}}, {{total}} total. Queen Karin notices this kind of thing.",
    ],
    session_locked: [
        "Session {{kneels}} logged, {{name}}. {{remaining}} more to the goal — still locked, still kneeling. {{total}} total. The Queen sees both.",
        "Locked and kneeling. Session {{kneels}} today, {{name}}. {{total}} total kneels. The cage doesn't stop the session — that's the point.",
        "{{name}} at session {{kneels}}, {{remaining}} remaining, still sealed. {{total}} total kneels. Discipline doesn't pause for the lock.",
        "Session {{kneels}} while locked up. {{name}} has {{total}} total kneels. The cage is a feature, not an excuse to stop.",
        "Kneeling in captivity. Session {{kneels}} today, {{remaining}} to go. {{total}} total kneels — Queen Karin put that lock there for a reason.",
        "{{name}} — session {{kneels}}, still sealed. {{remaining}} more to the daily goal. {{total}} total kneels. Queen accepts no less from a locked tribute.",
        "Caged and on schedule. Session {{kneels}} today, {{name}}. {{total}} total kneels. The lock just makes it more earned.",
        "Session {{kneels}} while locked. {{name}} has {{total}} total kneels and {{remaining}} left today. The Queen has not forgotten you're in there.",
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

        // TEMPLATE INTERCEPTION: kneeling system events don't need AI — use pre-written responses
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
