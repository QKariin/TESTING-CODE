import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getCaller, isOwnerOrCEO } from '@/lib/api-auth';
import { SYSTEM_PROMPT as AI_KNOWLEDGE } from './prompt';

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

        // Fetch conversation history from DB (AI chat messages)
        const { data: chatHistory } = await adminClient.from('chats')
            .select('sender_email, content, metadata')
            .ilike('member_id', memberEmail)
            .eq('metadata->>isAI', 'true')
            .order('created_at', { ascending: false })
            .limit(30);

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

        // Add history oldest-first
        if (chatHistory && chatHistory.length > 0) {
            const reversed = [...chatHistory].reverse();
            for (const row of reversed) {
                const isAiMsg = row.sender_email === 'ai-assistant';
                messages.push({
                    role: isAiMsg ? 'assistant' : 'user',
                    content: row.content,
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
