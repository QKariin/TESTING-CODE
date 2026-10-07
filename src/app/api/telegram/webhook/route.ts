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

interface Profile { member_id: string; name: string | null; parameters: Record<string, any> | null; }

async function getProfiles(): Promise<Profile[]> {
    const { data } = await supabaseAdmin
        .from('profiles')
        .select('member_id, name, parameters')
        .limit(200);
    return (data || []) as Profile[];
}

async function findMemberInText(text: string): Promise<string | null> {
    if (!text) return null;
    const profiles = await getProfiles();
    // strip leading @ if present
    const lower = text.replace(/^@/, '').toLowerCase();
    for (const p of profiles) {
        const nickname = (p.parameters?.nickname || '').toLowerCase();
        const name = (p.name || '').trim().toLowerCase();
        const prefix = (p.member_id || '').split('@')[0].toLowerCase();
        if (nickname && (lower === nickname || lower.includes(nickname))) return p.member_id;
        if (name && name.length > 2 && lower.includes(name)) return p.member_id;
        if (prefix && prefix.length > 3 && lower.includes(prefix)) return p.member_id;
    }
    return null;
}

async function handleVideoUpload(chatId: string, fileId: string, caption: string | null) {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
    await tgSend('⏳ Uploading...', { chatId });

    // Get file path from Telegram
    const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
    const fileData = await fileRes.json();
    const filePath = fileData.result?.file_path;
    if (!filePath) {
        await tgSend('❌ Could not get file from Telegram. Video might be too large (20MB limit).', { chatId });
        return;
    }

    // Download from Telegram
    const videoRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`);
    if (!videoRes.ok) {
        await tgSend('❌ Failed to download video from Telegram.', { chatId });
        return;
    }
    const videoBuffer = await videoRes.arrayBuffer();

    // Upload to Supabase storage
    const today = new Date().toISOString().split('T')[0];
    const storagePath = `tiktok_stories/${today}_${fileId}.mp4`;
    const { error: uploadError } = await supabaseAdmin.storage
        .from('media')
        .upload(storagePath, videoBuffer, { contentType: 'video/mp4', upsert: true });
    if (uploadError) {
        await tgSend(`❌ Storage upload failed: ${escapeHtml(uploadError.message)}`, { chatId });
        return;
    }

    const { data: { publicUrl } } = supabaseAdmin.storage.from('media').getPublicUrl(storagePath);

    // Find tagged member from caption
    let taggedMembers: string[] = [];
    if (caption) {
        const tagged = await findMemberInText(caption);
        if (tagged) taggedMembers = [tagged];
    }

    const isVault = caption?.trim().toLowerCase() === 'vault';
    const isAll = caption?.trim().toLowerCase() === 'all' || caption?.trim().toLowerCase() === 'public';
    const expiresAt = isVault ? null : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error: dbError } = await supabaseAdmin.from('stories').insert({
        date: today,
        media_url: publicUrl,
        media_type: 'video',
        order_index: 0,
        caption: caption || '',
        source: isVault ? 'vault' : 'tiktok',
        source_id: fileId,
        tagged_members: isAll || isVault ? [] : taggedMembers,
        expires_at: expiresAt,
        tier: 'free',
    });

    if (dbError) {
        await tgSend(`❌ DB insert failed: ${escapeHtml(dbError.message)}`, { chatId });
        return;
    }

    if (isVault) {
        await tgSend('✓ Saved to vault.', { chatId });
        return;
    }

    // Store upload context so the tier callback can continue the flow
    await setBotState('awaiting_story_tier', { isAll, taggedMembers });

    await tgSend('Uploaded! Free or paid?', {
        chatId,
        replyMarkup: {
            inline_keyboard: [[
                { text: '🌐 Free — all members', callback_data: 'story_tier:free' },
                { text: '💰 Paid — tribute required', callback_data: 'story_tier:paid' },
            ]],
        },
    });
}

async function handleMessage(chatId: string, text: string) {
    const state = await getBotState();
    const txt = (text || '').trim();

    if (txt.startsWith('/start')) {
        await setBotState(null);
        await tgSend(
            `<b>THRONE COMMAND CENTER</b>\n\nReady, Queen.\n\n` +
            `<b>Stories</b>\nSend a video → bot uploads it\nCaption: @nickname / "all" / "vault"\n\n` +
            `/tag — tag member in today's stories\n` +
            `/members — list all subs + nicknames\n` +
            `/nickname @nick email — set a nickname\n\n` +
            `/status — pending items + today's activity\n` +
            `/stories — today's stories + who unlocked\n` +
            `/daily — morning video status\n` +
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
        await handleTagMenu(chatId);
        return;
    }

    if (txt.startsWith('/tag ')) {
        await handleTag(chatId, txt.slice(5).trim());
        return;
    }

    if (txt.startsWith('/nickname ')) {
        await handleSetNickname(chatId, txt.slice(10).trim());
        return;
    }

    if (txt === '/members') {
        await handleListMembers(chatId);
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
    const [{ data: stories }, { data: access }, profiles] = await Promise.all([
        supabaseAdmin.from('stories')
            .select('id, media_url, media_type, caption, tagged_members, source, expires_at, order_index')
            .eq('date', today)
            .eq('archived', false)
            .order('order_index'),
        supabaseAdmin.from('story_access').select('member_email, coins_spent').eq('date', today),
        getProfiles(),
    ]);

    if (!stories || stories.length === 0) {
        await tgSend(`No stories for today (${today}).`, { chatId });
        return;
    }

    // Group by member / public / vault
    const groups: { label: string; emoji: string; stories: any[] }[] = [];
    const keyIndex: Record<string, number> = {};
    for (const s of stories) {
        const tagged: string[] = Array.isArray(s.tagged_members) ? s.tagged_members : [];
        let key = s.source === 'vault' ? '__vault__' : tagged.length > 0 ? tagged[0] : '__public__';
        if (keyIndex[key] === undefined) {
            let label = 'PUBLIC';
            let emoji = '🌍';
            if (key === '__vault__') { label = 'VAULT'; emoji = '🔒'; }
            else if (key !== '__public__') {
                const p = profiles.find(x => (x.member_id || '').toLowerCase() === key.toLowerCase());
                const nick = p?.parameters?.nickname;
                label = nick || p?.name || key.split('@')[0].toUpperCase();
                emoji = '👤';
            }
            keyIndex[key] = groups.length;
            groups.push({ label, emoji, stories: [] });
        }
        groups[keyIndex[key]].stories.push(s);
    }

    const summary = groups.map(g => `${g.emoji} <b>${escapeHtml(g.label)}</b> · ${g.stories.length} ${g.stories.length === 1 ? 'video' : 'videos'}`).join('\n');
    const unlockList = (access || []).map((a: any) => `  • ${escapeHtml(a.member_email.split('@')[0])} (${a.coins_spent})`).join('\n');

    const text =
        `<b>STORIES — ${today}</b>\n\n` +
        summary +
        `\n\n<i>${stories.length} total · ${(access || []).length} unlocked</i>` +
        (unlockList ? `\n\n<b>Paid:</b>\n${unlockList}` : '');

    // Inline keyboard: one row per story — [▶ open url] [🗑 delete]
    const keyboard: any[][] = [];
    for (const group of groups) {
        for (let i = 0; i < group.stories.length; i++) {
            const s = group.stories[i];
            const expiresAt = s.expires_at ? new Date(s.expires_at) : null;
            const hoursLeft = expiresAt ? Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 3600000)) : null;
            const timeTag = hoursLeft !== null ? ` · ${hoursLeft}h left` : '';
            const rowLabel = `${group.emoji} ${group.label} #${i + 1}${timeTag}`;
            keyboard.push([
                { text: `▶ ${rowLabel}`, url: s.media_url },
                { text: '🗑 Delete', callback_data: `del_story:${s.id}` },
            ]);
        }
    }

    await tgSend(text, { chatId, replyMarkup: { inline_keyboard: keyboard } });
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

async function sendTagMenu(chatId: string, includeVault = false) {
    const today = new Date().toISOString().split('T')[0];
    const todayStart = `${today}T00:00:00.000Z`;
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const tomorrowStart = `${tomorrow}T00:00:00.000Z`;

    // Top 15 most recently active (any date)
    const { data: recentTasks } = await supabaseAdmin
        .from('tasks')
        .select('member_id, lastWorship')
        .not('lastWorship', 'is', null)
        .order('lastWorship', { ascending: false })
        .limit(15);

    const profiles = await getProfiles();
    const profileMap = new Map(profiles.map(p => [p.member_id, p]));

    const memberButtons = (recentTasks || [])
        .filter((t: any) => t.member_id)
        .map((t: any) => {
            const p = profileMap.get(t.member_id);
            const nick = p?.parameters?.nickname;
            const name = p?.name || t.member_id.split('@')[0];
            const label = nick ? `@${nick} (${name})` : name;
            const lw = t.lastWorship || '';
            const isToday = lw >= todayStart && lw < tomorrowStart;
            const dot = isToday ? '🟢 ' : '';
            return { text: `${dot}${label}`, callback_data: `tag_direct:${t.member_id}` };
        });

    // Pair into rows of 2
    const memberRows: { text: string; callback_data: string }[][] = [];
    for (let i = 0; i < memberButtons.length; i += 2) {
        memberRows.push(memberButtons.slice(i, i + 2));
    }

    const bottomButtons = [
        [{ text: '🔍 Search by name', callback_data: 'tag_search' }, { text: '🌍 Everyone', callback_data: 'tag_all' }],
        ...(includeVault ? [[{ text: '🗄 Vault', callback_data: 'tag_vault' }]] : []),
    ];

    await tgSend('Who is it for? (🟢 = active today)', {
        chatId,
        replyMarkup: { inline_keyboard: [...memberRows, ...bottomButtons] },
    });
}

async function handleTagMenu(chatId: string) {
    await sendTagMenu(chatId, false);
}

async function handleSetNickname(chatId: string, args: string) {
    // Usage: /nickname @sissywolf pr.finsko@gmail.com
    // OR:    /nickname sissywolf pr.finsko@gmail.com
    const parts = args.split(/\s+/);
    if (parts.length < 2) {
        await tgSend('Usage: /nickname @sissywolf member@email.com\n\nUse /members to see all members.', { chatId });
        return;
    }
    const nickname = parts[0].replace(/^@/, '').toLowerCase();
    const search = parts.slice(1).join(' ');

    const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('member_id, name, parameters')
        .or(`member_id.ilike.%${search}%,name.ilike.%${search}%`)
        .limit(1);

    if (!profiles || profiles.length === 0) {
        await tgSend(`No member found matching "<b>${escapeHtml(search)}</b>".`, { chatId });
        return;
    }

    const profile = profiles[0];
    const existing = profile.parameters || {};
    await supabaseAdmin
        .from('profiles')
        .update({ parameters: { ...existing, nickname } })
        .eq('member_id', profile.member_id);

    await tgSend(`✓ <b>@${escapeHtml(nickname)}</b> → ${escapeHtml(profile.name || profile.member_id.split('@')[0])}`, { chatId });
}

async function handleListMembers(chatId: string) {
    const profiles = await getProfiles();
    if (!profiles.length) {
        await tgSend('No members found.', { chatId });
        return;
    }
    const lines = profiles
        .filter(p => p.member_id)
        .map(p => {
            const nick = p.parameters?.nickname ? `@${p.parameters.nickname}` : '(no nickname)';
            const name = p.name || p.member_id.split('@')[0];
            return `• <b>${escapeHtml(name)}</b> — ${escapeHtml(nick)}`;
        });
    await tgSend(`<b>MEMBERS</b>\n\n${lines.join('\n')}\n\nSet nickname: /nickname @nick email`, { chatId });
}

async function handleTag(chatId: string, name: string) {
    const cleanName = name.replace(/^@/, '').trim();
    if (!cleanName) {
        await tgSend('Provide a name. Example: /tag Sissywolf', { chatId });
        return;
    }
    name = cleanName;
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
    const [action, value] = data.split(':');

    if (action === 'tag_direct' && value) {
        const today = new Date().toISOString().split('T')[0];
        const { data: stories } = await supabaseAdmin
            .from('stories')
            .select('id, tagged_members')
            .eq('date', today);

        if (!stories || stories.length === 0) {
            await tgAnswer(callbackQueryId, 'No stories today.');
            return;
        }
        for (const story of stories) {
            const existing: string[] = Array.isArray(story.tagged_members) ? story.tagged_members : [];
            if (!existing.includes(value)) {
                await supabaseAdmin.from('stories').update({ tagged_members: [...existing, value] }).eq('id', story.id);
            }
        }
        const name = value.split('@')[0];
        await tgAnswer(callbackQueryId, `Tagged ${name}`);
        await tgSend(`✓ Tagged <b>${escapeHtml(name)}</b> in today's stories.`, { chatId });

    } else if (action === 'tag_search') {
        await setBotState('awaiting_tag');
        await tgAnswer(callbackQueryId);
        await tgSend('Type a name or @nickname:', { chatId });

    } else if (action === 'tag_all') {
        await tgAnswer(callbackQueryId, 'Set to public');
        await tgSend('✓ Story is public — visible to all.', { chatId });

    } else if (action === 'tag_vault') {
        const today = new Date().toISOString().split('T')[0];
        await supabaseAdmin.from('stories').update({ source: 'vault', expires_at: null }).eq('date', today).eq('source', 'tiktok');
        await tgAnswer(callbackQueryId, 'Moved to vault');
        await tgSend('✓ Moved to vault.', { chatId });

    } else if (action === 'tag_member') {
        await setBotState('awaiting_tag');
        await tgAnswer(callbackQueryId);
        await tgSend('Who do you want to tag? Reply with their name or email prefix.', { chatId });

    } else if (action === 'del_story' && value) {
        const { error } = await supabaseAdmin.from('stories').update({ archived: true }).eq('id', value);
        if (error) {
            await tgAnswer(callbackQueryId, '❌ Delete failed');
        } else {
            await tgAnswer(callbackQueryId, '🗑 Deleted');
            await tgSend('✓ Story deleted.', { chatId });
        }

    } else if (action === 'skip') {
        await setBotState(null);
        await tgAnswer(callbackQueryId, 'Skipped.');

    } else if (action === 'story_tier' && (value === 'free' || value === 'paid')) {
        const state = await getBotState();
        const { isAll, taggedMembers } = state.data || {};

        // Update the most recently inserted non-vault story today with the chosen tier
        const today = new Date().toISOString().split('T')[0];
        const { data: latestStory } = await supabaseAdmin
            .from('stories')
            .select('id')
            .eq('date', today)
            .neq('source', 'vault')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (latestStory) {
            await supabaseAdmin.from('stories').update({ tier: value }).eq('id', latestStory.id);
        }

        await tgAnswer(callbackQueryId, value === 'paid' ? 'Set to paid' : 'Set to free');
        await setBotState(null);

        // Send OneSignal push notification
        const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '761d91da-b098-44a7-8d98-75c1cce54dd0';
        const ONESIGNAL_API_KEY = process.env.ONESIGNAL_REST_API_KEY || '';
        if (ONESIGNAL_API_KEY) {
            await fetch('https://api.onesignal.com/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Basic ${ONESIGNAL_API_KEY}` },
                body: JSON.stringify({
                    app_id: ONESIGNAL_APP_ID,
                    target_channel: 'push',
                    included_segments: ['Subscribed Users'],
                    headings: { en: 'Queen Karin' },
                    contents: { en: value === 'paid' ? '🔥 New story — for tributes only' : '✨ New story available' },
                    url: 'https://throne.qkarin.com/profile',
                }),
            }).catch(() => {});
        }

        // Continue tag flow
        if (isAll) {
            await tgSend('✓ Story is public — visible to all. Notification sent.', { chatId });
        } else if (Array.isArray(taggedMembers) && taggedMembers.length > 0) {
            const name = taggedMembers[0].split('@')[0];
            await tgSend(`✓ Tagged <b>${escapeHtml(name)}</b>. Notification sent.`, { chatId });
        } else {
            await tgSend(`✓ ${value === 'paid' ? 'Paid' : 'Free'} story uploaded. Who is it for?`, { chatId });
            await sendTagMenu(chatId, false);
        }
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
            const fileId = msg.video?.file_id || msg.document?.file_id;
            if (fileId) {
                await handleVideoUpload(chatId, fileId, msg.caption || null);
            } else {
                await handleMessage(chatId, msg.text || '');
            }
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
