import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getCaller, isCEO } from '@/lib/api-auth';
import { SYSTEM_PROMPT as AI_KNOWLEDGE } from '../../ai-chat/prompt';

export const dynamic = 'force-dynamic';

const DRAFT_WRAPPER = `IMPORTANT OVERRIDE — YOU ARE NOT THE AI ASSISTANT RIGHT NOW.

You are ghostwriting a private chat message AS Queen Karin herself. She will review and edit before it gets sent. Write exactly what she would say next in this conversation.

QUEEN KARIN'S VOICE:
- Direct, sharp, confident. No sugarcoating.
- No emojis. No exclamation marks unless genuinely angry or impressed.
- No "I hope", "I think", "maybe". She states things.
- Casual but authoritative. Like texting someone who works for you and you actually like.
- 1-3 sentences max. She does not write essays.
- If they did something good, acknowledge it without gushing. "Good." or "That's more like it."
- If they're slacking, call it out directly.
- If they're being needy, put them in their place.
- She uses their name sometimes.
- NEVER sound like a chatbot or customer support.
- She swears occasionally when it fits.
- NEVER use em dashes. Use periods or commas instead.
- Read the conversation carefully. The reply must flow naturally from what was just said.
- Write in FIRST PERSON as Queen Karin. You ARE her.

OUTPUT: Just the message text. No quotes, no labels, no prefix. Just what she would type.

Below is your full knowledge base about the app. Use it when relevant:

`;

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

        // Fetch user profile + tasks — same as ai-chat route
        const { data: userProfile } = await adminClient.from('profiles')
            .select('*')
            .ilike('member_id', memberEmail)
            .maybeSingle();

        const { data: userTasks } = await adminClient.from('tasks')
            .select('*')
            .ilike('member_id', memberEmail)
            .maybeSingle();

        const { data: wishlistItems } = await adminClient.from('Wishlist')
            .select('Title, Price, Category, is_crowdfund, goal_amount, raised_amount')
            .order('Price', { ascending: true }) as { data: any[] | null };

        let userContext = '';
        if (userProfile) {
            const p = userProfile as any;
            const t = userTasks as any;
            const params = p.parameters || {};
            const rank = p.hierarchy || 'Hall Boy';
            const completedTasks = Number(t?.Taskdom_CompletedTasks || t?.taskdom_completed_tasks || 0);
            const kneels = Number(t?.kneelCount || t?.kneelcount || 0);
            const merit = Number(p.score || 0);
            let coinsSpent = Number(params.wishlist_spent || 0);
            if (!coinsSpent && t?.['Tribute History']) {
                try {
                    const arr = typeof t['Tribute History'] === 'string' ? JSON.parse(t['Tribute History']) : t['Tribute History'];
                    if (Array.isArray(arr)) coinsSpent = arr.reduce((sum: number, e: any) => sum + (e.amount < 0 ? Math.abs(e.amount) : 0), 0);
                } catch {}
            }
            const bestStreak = Number(params.routine_streak || params.taskdom_current_streak || 0);
            const wallet = Number(p.wallet || 0);
            const hasLimits = (p.limits?.length ?? 0) > 2;
            const hasKinks = ((p.kinks || p.kink)?.length ?? 0) > 2;
            const hasRoutine = (p.routine?.length ?? 0) > 5;

            userContext = `\n\nYOU ARE WRITING TO: ${p.name || 'Unknown'}. Use their name when it feels natural.`;
            userContext += `\nCURRENT RANK: ${rank}`;
            userContext += `\nTHEIR STATS — LABOR: ${completedTasks} | ENDURANCE: ${kneels} | MERIT: ${merit} | SACRIFICE: ${coinsSpent} | CONSISTENCY: ${bestStreak} days`;
            userContext += `\nPROFILE — Limits: ${hasLimits ? 'filled' : 'MISSING'} | Kinks: ${hasKinks ? 'filled' : 'MISSING'} | Routine: ${hasRoutine ? 'assigned' : 'NOT YET'}`;
            userContext += `\nWALLET: ${wallet} coins`;
            const skipPasses = Number(p.skippass || 0);
            const cumPasses = Number(p.cumpass || 0);
            const checkpoints = Number(p.checkpoint || 0);
            userContext += `\nINVENTORY: ${skipPasses} Skip Pass, ${cumPasses} Cum Pass, ${checkpoints} Checkpoint`;
            if (p.kinks) userContext += `\nKINKS: ${p.kinks}`;
            if (p.limits) userContext += `\nLIMITS: ${p.limits}`;
        }

        if (wishlistItems && wishlistItems.length > 0) {
            const items = wishlistItems.map((w: any) => {
                let desc = `${w.Title} (${w.Price} coins`;
                if (w.is_crowdfund) desc += `, crowdfund: ${w.raised_amount || 0}/${w.goal_amount || 0}`;
                desc += ')';
                return desc;
            }).join(', ');
            userContext += `\n\nWISHLIST (only mention if relevant): ${items}.`;
        }

        // Fetch last 20 messages — same approach as ai-chat
        const { data: recentMsgs } = await adminClient.from('chats')
            .select('sender_email, content, type')
            .or(isUUID && memberEmail !== memberId
                ? `member_id.eq.${memberId},member_id.ilike.${memberEmail}`
                : `member_id.ilike.${memberEmail}`)
            .order('created_at', { ascending: false })
            .limit(20);

        // Build conversation as alternating messages
        const systemPrompt = DRAFT_WRAPPER + AI_KNOWLEDGE + userContext;
        const messages: any[] = [
            { role: 'system', content: systemPrompt },
        ];

        if (recentMsgs && recentMsgs.length > 0) {
            const reversed = [...recentMsgs].reverse();
            for (const msg of reversed) {
                const sender = (msg.sender_email || '').toLowerCase();
                const content = msg.content || '';
                // Skip system cards
                if (content.startsWith('TASK_') || content.startsWith('WISHLIST::') || content.startsWith('PROMOTION_CARD::') ||
                    content.startsWith('WELCOME_CARD::') || content.startsWith('ROUTINE_CHANGE::') || content.startsWith('INVENTORY_CARD::') ||
                    content.startsWith('VAULT_UNLOCK_CARD::') || content.startsWith('DIRECT_TRIBUTE_CARD::') || content.startsWith('RISKY_TRIBUTE_CARD::') ||
                    content.startsWith('UPDATE_COINS_CARD::') || content.startsWith('UPDATE_MERIT_CARD::') || msg.type === 'system') continue;
                if (content === '[GIF]' || content === '[PHOTO]' || content === '[VIDEO]') continue;
                if (sender === 'guardian' || sender === 'ai-assistant') continue;

                const isQueen = sender.includes('qkarin') || sender.includes('queen');
                messages.push({
                    role: isQueen ? 'assistant' : 'user',
                    content: content.slice(0, 400),
                });
            }
        }

        // Final instruction
        messages.push({ role: 'user', content: '[Write the next reply as Queen Karin. Just the message, nothing else.]' });

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
        // Clean up
        draft = draft.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^["']|["']$/g, '').replace(/^Queen Karin:\s*/i, '').trim();
        draft = draft.replace(/\u2014/g, '.').replace(/\u2013/g, ',').replace(/ —/g, '.').replace(/— /g, '').trim();

        return NextResponse.json({ success: true, draft });
    } catch (e: any) {
        console.error('[ai-draft] Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
