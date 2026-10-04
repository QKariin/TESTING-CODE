// src/app/api/telegram/webhook/route.ts
// Telegram bot webhook — Queen's command center
// Register at: https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://throne.qkarin.com/api/telegram/webhook&secret_token={TELEGRAM_WEBHOOK_SECRET}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { tgSend, tgAnswer, QUEEN_CHAT_ID, escapeHtml } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

// ─── BOT STATE (persisted in Supabase single-row table) ──────────────────────
// Run once in Supabase:
// create table telegram_bot_state (
//   id int primary key default 1,
//   context text,
//   context_data jsonb,
//   updated_at timestamptz default now()
// );
// insert into telegram_bot_state values (1, null, null, now());

async function getBotState(): Promise<{ context: string | null; data: any }> {
    try {
        const { data } = await supabaseAdmin
            .from('telegram_bot_state')
            .select('context, context_data')
            .eq('id', 1)
            .maybeSingle();
        return { context: data?.context || null, data: data?.context_data || {} };
    } catch {
        return { context: null, data: {} };
    }
}

async function setBotState(context: string | null, data?: any) {
    await supabaseAdmin
        .from('telegram_bot_state')
        .upsert({ id: 1, context, context_data: data ?? null, updated_at: new Date().toISOString() });
}

// ─── HANDLERS ────────────────────────────────────────────────────────────────

async function handleMessage(chatId: string, text: string) {
    const state = await getBotState();
    const txt = (text || '').trim();

    if (txt.startsWith('/start')) {
        await setBotState(null);
        await tgSend(
            `<b>THRONE COMMAND CENTER</b>\n\nReady, Queen.\n\n` +
            `/status — pending items + today's activity\n` +
            `/stories — today's stories + who unlocked\n` +
            `/daily — morning video status\n` +
            `/tag [name] — tag member in today's stories\n` +
            `/skip — cancel pending action`,
            { chatId }
        );
        return;
    }

    if (txt.startsWith('/status')) {
        await handleStatus(chatId);
        return;
    }

    if (txt.startsWith('/stories')) {
        await handleStoriesStatus(chatId);
        return;
    }

    if (txt.startsWith('/daily')) {
        await handleDailyStatus(chatId);
        return;
    }

    if (txt === '/tag') {
        await setBotState('awaiting_tag');
        await tgSend('Who do you want to tag in today\'s stories?\nReply with their name or email prefix.', { chatId });
        return;
    }

    if (txt.startsWith('/tag ')) {
        await handleTag(chatId, txt.slice(5).trim());
        return;
    }

    if (txt.startsWith('/skip')) {
        await setBotState(null);
        await tgSend('Cancelled.', { chatId });
        return;
    }

    if (txt.startsWith('/help')) {
        await tgSend(
            `<b>COMMANDS</b>\n\n` +
            `/status — pending checks, tributes, vault members\n` +
            `/stories — today's stories + who unlocked\n` +
            `/daily — morning video status\n` +
            `/tag [name] — tag member in today's stories\n` +
            `/skip — cancel pending action`,
            { chatId }
        );
        return;
    }

    // Context-based replies
    if (state.context === 'awaiting_tag') {
        await handleTag(chatId, txt);
        return;
    }

    await tgSend('Unknown command. Try /help', { chatId });
}

async function handleStatus(chatId: string) {
    const today = new Date().toISOString().split('T')[0];
    try {
        const [
            { count: pendingChecks },
            { data: purchases },
            { count: vaultCount },
            { count: storiesCount },
            { count: accessCount },
        ] = await Promise.all([
            supabaseAdmin.from('vault_check_log').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
            supabaseAdmin.from('chats').select('metadata').eq('type', 'wishlist').gte('created_at', `${today}T00:00:00Z`),
            supabaseAdmin.from('vault_sessions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
            supabaseAdmin.from('stories').select('*', { count: 'exact', head: true }).eq('date', today),
            supabaseAdmin.from('story_access').select('*', { count: 'exact', head: true }).eq('date', today),
        ]);

        const totalCoins = (purchases || []).reduce((sum: number, p: any) => sum + (p.metadata?.price || 0), 0);

        await tgSend(
            `<b>STATUS — ${today}</b>\n\n` +
            `Vault members active: <b>${vaultCount || 0}</b>\n` +
            `Pending chastity checks: <b>${pendingChecks || 0}</b>\n` +
            `Tributes today: <b>${(purchases || []).length}</b> (${totalCoins.toLocaleString()} coins)\n` +
            `Stories: <b>${storiesCount || 0}</b> uploaded · <b>${accessCount || 0}</b> unlocked`,
            { chatId }
        );
    } catch (err: any) {
        await tgSend(`Error: ${escapeHtml(err?.message || 'unknown')}`, { chatId });
    }
}

async function handleStoriesStatus(chatId: string) {
    const today = new Date().toISOString().split('T')[0];
    const [{ data: stories }, { data: access }] = await Promise.all([
        supabaseAdmin.from('stories').select('id, caption, tagged_members').eq('date', today).order('order_index'),
        supabaseAdmin.from('story_access').select('member_email, coins_spent').eq('date', today),
    ]);

    if (!stories || stories.length === 0) {
        await tgSend(`No stories uploaded for today (${today}).`, { chatId });
        return;
    }

    const accessList = (access || [])
        .map((a: any) => `  • ${escapeHtml(a.member_email.split('@')[0])} (${a.coins_spent} coins)`)
        .join('\n');

    await tgSend(
        `<b>STORIES — ${today}</b>\n\n` +
        `${stories.length} ${stories.length === 1 ? 'story' : 'stories'} posted\n` +
        `${(access || []).length} members unlocked\n\n` +
        (accessList ? `<b>Who paid:</b>\n${accessList}` : 'No unlocks yet.') +
        `\n\nTo tag someone: /tag [name]`,
        { chatId }
    );
}

async function handleDailyStatus(chatId: string) {
    const today = new Date().toISOString().split('T')[0];
    const { data: video } = await supabaseAdmin
        .from('queen_daily_videos')
        .select('video_url, message, created_at')
        .eq('date', today)
        .maybeSingle();

    if (!video) {
        await tgSend(`No daily video for today (${today}) yet.`, { chatId });
    } else {
        await tgSend(
            `<b>DAILY VIDEO — ${today}</b>\n\n✓ Uploaded\n` +
            (video.message ? `Caption: "<i>${escapeHtml(video.message)}</i>"` : 'No caption.'),
            { chatId }
        );
    }
}

async function handleTag(chatId: string, name: string) {
    if (!name) {
        await tgSend('Provide a name. Example: /tag Sissywolf', { chatId });
        return;
    }
    const today = new Date().toISOString().split('T')[0];

    const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('member_id, name')
        .or(`name.ilike.%${name}%,member_id.ilike.%${name}%`)
        .limit(3);

    if (!profiles || profiles.length === 0) {
        await tgSend(`No member found matching "<b>${escapeHtml(name)}</b>".\nTry their exact username or email prefix.`, { chatId });
        return;
    }

    const target = profiles[0];
    const email = (target.member_id || '').toLowerCase();
    const displayName = target.name || email.split('@')[0];

    const { data: stories } = await supabaseAdmin
        .from('stories')
        .select('id, tagged_members')
        .eq('date', today);

    if (!stories || stories.length === 0) {
        await tgSend(`No stories for today (${today}) to tag.`, { chatId });
        return;
    }

    for (const story of stories) {
        const existing: string[] = Array.isArray(story.tagged_members) ? story.tagged_members : [];
        if (!existing.includes(email)) {
            await supabaseAdmin.from('stories').update({ tagged_members: [...existing, email] }).eq('id', story.id);
        }
    }

    await setBotState(null);
    await tgSend(
        `✓ Tagged <b>${escapeHtml(displayName)}</b> in today's ${stories.length} ${stories.length === 1 ? 'story' : 'stories'}.`,
        { chatId }
    );
}

async function handleCallbackQuery(callbackQueryId: string, data: string, chatId: string) {
    const [action] = data.split(':');

    if (action === 'tag_member') {
        await setBotState('awaiting_tag');
        await tgAnswer(callbackQueryId);
        await tgSend('Who do you want to tag? Reply with their name or email prefix.', { chatId });
    } else if (action === 'skip') {
        await setBotState(null);
        await tgAnswer(callbackQueryId, 'Skipped.');
    }
}

// ─── WEBHOOK ENTRY POINT ──────────────────────────────────────────────────────

export async function POST(req: Request) {
    // Verify Telegram secret token
    const secretToken = req.headers.get('x-telegram-bot-api-secret-token');
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (expectedSecret && secretToken !== expectedSecret) {
        return NextResponse.json({ ok: false }, { status: 403 });
    }

    try {
        const update = await req.json();

        if (update.message) {
            const msg = update.message;
            const chatId = String(msg.chat.id);
            if (QUEEN_CHAT_ID && chatId !== QUEEN_CHAT_ID) {
                return NextResponse.json({ ok: true }); // ignore non-Queen messages
            }
            await handleMessage(chatId, msg.text || '');
        }

        if (update.callback_query) {
            const cq = update.callback_query;
            const chatId = String(cq.message?.chat?.id || '');
            if (QUEEN_CHAT_ID && chatId !== QUEEN_CHAT_ID) {
                return NextResponse.json({ ok: true });
            }
            await handleCallbackQuery(cq.id, cq.data || '', chatId);
        }

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('[telegram/webhook]', err);
        return NextResponse.json({ ok: true }); // always 200 to Telegram
    }
}
