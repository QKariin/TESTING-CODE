import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getCaller, isOwnerOrCEO } from '@/lib/api-auth';
import { SYSTEM_PROMPT } from './prompt';

export const dynamic = 'force-dynamic';


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

        // Fetch user profile + tasks for context (select * to avoid column-not-found failures)
        const { data: userProfile, error: profileErr } = await adminClient.from('profiles')
            .select('*')
            .ilike('member_id', memberEmail)
            .maybeSingle();
        if (profileErr) console.error('[ai-chat] Profile fetch error:', profileErr.message);

        const { data: userTasks, error: tasksErr } = await adminClient.from('tasks')
            .select('*')
            .ilike('member_id', memberEmail)
            .maybeSingle();
        if (tasksErr) console.error('[ai-chat] Tasks fetch error:', tasksErr.message);

        // Fetch wishlist items
        const { data: wishlistItems } = await adminClient.from('Wishlist')
            .select('Title, Price, Category, is_crowdfund, goal_amount, raised_amount')
            .order('Price', { ascending: true }) as { data: any[] | null };

        // Debug: log what we actually got
        console.log('[ai-chat] memberEmail:', memberEmail, '| profile found:', !!userProfile, '| tasks found:', !!userTasks);
        if (userTasks) console.log('[ai-chat] tasks keys:', Object.keys(userTasks).filter(k => userTasks[k] != null && userTasks[k] !== ''));

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
            const hasLimits = (p.limits?.length ?? 0) > 2;
            const hasKinks = ((p.kinks || p.kink)?.length ?? 0) > 2;
            const hasRoutine = (p.routine?.length ?? 0) > 5 || (p.taskdom_routine?.length ?? 0) > 5;

            userContext = `\n\nYOU ARE TALKING TO: ${p.name || p.title_fld || p.title || 'Unknown'}. Use their actual name when addressing them.`;
            userContext += `\nCURRENT RANK: ${rank}`;
            userContext += `\nTHEIR STATS — LABOR (completed tasks): ${completedTasks} | ENDURANCE (total kneels): ${kneels} | MERIT (points): ${merit} | SACRIFICE (coins spent): ${coinsSpent} | CONSISTENCY (best streak): ${bestStreak} days`;
            userContext += `\nPROFILE STATUS — Limits: ${hasLimits ? 'filled' : 'MISSING'} | Kinks: ${hasKinks ? 'filled' : 'MISSING'} | Routine: ${hasRoutine ? 'assigned' : 'NOT YET'}`;
            userContext += `\nWALLET: ${wallet} coins`;
            const skipPasses = Number(p.skippass || 0);
            const cumPasses = Number(p.cumpass || 0);
            const checkpoints = Number(p.checkpoint || 0);
            if (skipPasses || cumPasses || checkpoints) {
                userContext += `\nINVENTORY: ${skipPasses} Skip Pass, ${cumPasses} Cum Pass, ${checkpoints} Checkpoint`;
            }
        }

        if (wishlistItems && wishlistItems.length > 0) {
            const items = wishlistItems.map((w: any) => {
                let desc = `${w.Title} (${w.Price} coins`;
                if (w.is_crowdfund) desc += `, crowdfund: ${w.raised_amount || 0}/${w.goal_amount || 0} raised`;
                desc += ')';
                return desc;
            }).join(', ');
            userContext += `\n\nQUEEN KARIN'S CURRENT WISHLIST (ONLY mention if they SPECIFICALLY ask about the wishlist, tributes, or what to buy/get Her — NEVER bring this up unprompted): ${items}.`;
        }

        // Fetch conversation history from DB (persists across sessions/reloads)
        const { data: chatHistory } = await adminClient.from('chats')
            .select('sender_email, content, metadata')
            .ilike('member_id', memberEmail)
            .eq('metadata->>isAI', 'true')
            .order('created_at', { ascending: false })
            .limit(30);

        // Build messages array with full persistent history
        const messages: any[] = [
            { role: 'system', content: SYSTEM_PROMPT + userContext },
        ];

        // Add history oldest-first (DB returns newest-first)
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
