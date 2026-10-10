// src/app/api/telegram/webhook/route.ts
// Telegram bot webhook — Queen's command center
// Register at: https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://throne.qkarin.com/api/telegram/webhook&secret_token={TELEGRAM_WEBHOOK_SECRET}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { tgSend, tgAnswer, tgEditMarkup, QUEEN_CHAT_ID, escapeHtml } from '@/lib/telegram';

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

async function sendStoryPush(emails: string[]) {
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '761d91da-b098-44a7-8d98-75c1cce54dd0';
    const apiKey = process.env.ONESIGNAL_REST_API_KEY;
    if (!apiKey || emails.length === 0) return;
    await Promise.all(emails.map(email =>
        fetch('https://api.onesignal.com/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${apiKey}` },
            body: JSON.stringify({
                app_id: appId,
                target_channel: 'push',
                include_aliases: { external_id: [email.toLowerCase()] },
                headings: { en: 'Queen Karin' },
                contents: { en: '✨ New story available' },
                url: 'https://throne.qkarin.com/profile',
            }),
        }).catch(() => {})
    ));
}

async function handleMediaUpload(chatId: string, fileId: string, fileUniqueId: string, caption: string | null, isPhoto: boolean) {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

    // ── Dedup check: file_unique_id is stable across re-sends of the same file ──
    const { data: existingStory } = await supabaseAdmin
        .from('stories')
        .select('id, source, media_url')
        .eq('source_id', fileUniqueId)
        .maybeSingle();

    if (existingStory) {
        // Reset it to vault state (untagged, no expiry) so we can re-assign it
        await supabaseAdmin.from('stories').update({
            archived: false,
            source: 'vault',
            expires_at: null,
            tagged_members: [],
            tier: 'free',
            tribute_price: null,
        }).eq('id', existingStory.id);

        await setBotState('awaiting_story_tier', { isAll: false, taggedMembers: [], latestStoryId: existingStory.id });
        await tgSend('♻️ This video is already in your archive. Reactivating — free or paid?', {
            chatId,
            replyMarkup: {
                inline_keyboard: [[
                    { text: '🌐 Free — all members', callback_data: 'story_tier:free' },
                    { text: '💰 Paid — tribute required', callback_data: 'story_tier:paid' },
                ]],
            },
        });
        return;
    }

    // ── New video — upload and store ──
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
    const mediaRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`);
    if (!mediaRes.ok) {
        await tgSend('❌ Failed to download file from Telegram.', { chatId });
        return;
    }
    const mediaBuffer = await mediaRes.arrayBuffer();

    // Upload to Supabase storage
    const today = new Date().toISOString().split('T')[0];
    const ext = isPhoto ? 'jpg' : 'mp4';
    const contentType = isPhoto ? 'image/jpeg' : 'video/mp4';
    const storagePath = `tiktok_stories/${today}_${fileId}.${ext}`;
    const { error: uploadError } = await supabaseAdmin.storage
        .from('media')
        .upload(storagePath, mediaBuffer, { contentType, upsert: true });
    if (uploadError) {
        await tgSend(`❌ Storage upload failed: ${escapeHtml(uploadError.message)}`, { chatId });
        return;
    }

    const { data: { publicUrl } } = supabaseAdmin.storage.from('media').getPublicUrl(storagePath);

    // Always store as vault first — tier/tag flow sets everything else
    const mediaType = isPhoto ? 'image' : 'video';
    const { data: newStory, error: dbError } = await supabaseAdmin.from('stories').insert({
        date: today,
        media_url: publicUrl,
        media_type: mediaType,
        order_index: 0,
        caption: caption || '',
        source: 'vault',
        source_id: fileUniqueId,  // stable across re-sends
        tagged_members: [],
        expires_at: null,
        tier: 'free',
    }).select('id').single();

    if (dbError) {
        await tgSend(`❌ DB insert failed: ${escapeHtml(dbError.message)}`, { chatId });
        return;
    }

    // Store story ID in state so all subsequent steps use the same row
    await setBotState('awaiting_story_tier', { isAll: false, taggedMembers: [], latestStoryId: newStory.id });

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

// ─── TASK REVIEW ─────────────────────────────────────────────────────────────
// SQL to run once in Supabase:
// ALTER TABLE tasks_database
//   ADD COLUMN IF NOT EXISTS kinks text[] DEFAULT '{}',
//   ADD COLUMN IF NOT EXISTS limits text[] DEFAULT '{}',
//   ADD COLUMN IF NOT EXISTS chastity_ok boolean DEFAULT true,
//   ADD COLUMN IF NOT EXISTS required_items text,
//   ADD COLUMN IF NOT EXISTS video_url text,
//   ADD COLUMN IF NOT EXISTS video_tier text DEFAULT 'free',
//   ADD COLUMN IF NOT EXISTS approval_video_url text,
//   ADD COLUMN IF NOT EXISTS reviewed boolean DEFAULT false;

const TASK_KINK_CATEGORIES = [
    { key: 'obedience',       label: 'Obedience & Service' },
    { key: 'chastity',        label: 'Chastity' },
    { key: 'orgasm',          label: 'Orgasm Control' },
    { key: 'humiliation',     label: 'Humiliation' },
    { key: 'punishment',      label: 'Punishment' },
    { key: 'psychological',   label: 'Psychological' },
    { key: 'bondage',         label: 'Bondage' },
    { key: 'worship',         label: 'Worship' },
    { key: 'exposure',        label: 'Exposure' },
    { key: 'findom',          label: 'Financial Dom' },
    { key: 'roleplay',        label: 'Role Play' },
    { key: 'sissification',   label: 'Sissification' },
    { key: 'extreme',         label: 'Extreme' },
];

function buildCategoryKeyboard(selected: string[], toggleAction: string, doneAction: string): any[][] {
    const rows: any[][] = [];
    for (let i = 0; i < TASK_KINK_CATEGORIES.length; i += 2) {
        const row: any[] = [];
        for (let j = i; j < i + 2 && j < TASK_KINK_CATEGORIES.length; j++) {
            const cat = TASK_KINK_CATEGORIES[j];
            const on = selected.includes(cat.key);
            row.push({ text: `${on ? '✅' : '☐'} ${cat.label}`, callback_data: `${toggleAction}:${cat.key}` });
        }
        rows.push(row);
    }
    rows.push([{ text: `✅ Done (${selected.length} selected)`, callback_data: doneAction }]);
    return rows;
}

async function startTaskReview(chatId: string) {
    const { data: task, error: taskError } = await supabaseAdmin
        .from('tasks_database')
        .select('*')
        .eq('reviewed', false)
        .limit(1)
        .maybeSingle();

    if (taskError) {
        await tgSend(`❌ DB error: ${escapeHtml(taskError.message)}`, { chatId });
        return;
    }

    if (!task) {
        await tgSend('✅ All tasks reviewed! Nothing left in queue.', { chatId });
        return;
    }

    const taskName = task.TaskText || task.Title || '(unnamed)';
    const taskCategory = Array.isArray(task.Category) ? task.Category.join(', ') : (task.Category || '');

    await setBotState('task_review_text', { taskId: task.ID, taskName, selectedKinks: [], selectedLimits: [] });

    await tgSend(
        `<b>TASK REVIEW</b>${taskCategory ? ` · <i>${escapeHtml(taskCategory)}</i>` : ''}\n\n` +
        `${escapeHtml(taskName)}\n\n` +
        `Is this text ok?`,
        {
            chatId,
            replyMarkup: { inline_keyboard: [
                [{ text: '✅ Text is good', callback_data: 'tr_confirm' }, { text: '✏️ Edit text', callback_data: 'tr_edit' }],
                [{ text: '⏭ Skip this task', callback_data: 'tr_skip' }],
            ]},
        }
    );
}

async function sendKinkStep(chatId: string, data: any) {
    const res = await tgSend(
        `<b>KINKS</b> — which categories does this task relate to?\n<i>Tap to select · tap again to deselect</i>`,
        { chatId, replyMarkup: { inline_keyboard: buildCategoryKeyboard(data.selectedKinks || [], 'tr_kink', 'tr_kink_done') } }
    );
    const kinkMsgId = res?.result?.message_id || null;
    await setBotState('task_review_kinks', { ...data, kinkMsgId });
}

async function sendLimitStep(chatId: string, data: any) {
    const res = await tgSend(
        `<b>LIMITS</b> — which categories does this task TOUCH?\n<i>Members with these as hard limits will be SKIPPED for this task</i>`,
        { chatId, replyMarkup: { inline_keyboard: buildCategoryKeyboard(data.selectedLimits || [], 'tr_lim', 'tr_lim_done') } }
    );
    const limMsgId = res?.result?.message_id || null;
    await setBotState('task_review_limits', { ...data, limMsgId });
}

async function sendChastityStep(chatId: string, data: any) {
    await setBotState('task_review_chastity', data);
    await tgSend(`<b>CHASTITY</b> — can this task be done while wearing a device?`, {
        chatId,
        replyMarkup: { inline_keyboard: [[
            { text: '✅ Yes, chastity ok', callback_data: 'tr_chastity:yes' },
            { text: '🔒 No, needs free access', callback_data: 'tr_chastity:no' },
        ]]},
    });
}

async function sendDifficultyStep(chatId: string, data: any) {
    await setBotState('task_review_difficulty', data);
    await tgSend(`<b>DIFFICULTY</b>`, {
        chatId,
        replyMarkup: { inline_keyboard: [[
            { text: '🟢 Easy', callback_data: 'tr_diff:easy' },
            { text: '🟡 Medium', callback_data: 'tr_diff:medium' },
            { text: '🔴 Hardcore', callback_data: 'tr_diff:hard' },
        ]]},
    });
}

async function sendItemsStep(chatId: string, data: any) {
    await setBotState('task_review_items', data);
    await tgSend(
        `<b>REQUIRED ITEMS</b>\n\nWhat do they need? (e.g. "rope, blindfold")\n\nType it or /skip`,
        { chatId }
    );
}

async function sendVideoStep(chatId: string, data: any) {
    await setBotState('task_review_video', data);
    await tgSend(`<b>INSTRUCTIONAL VIDEO</b>\n\nWant to attach a video for this task?\nSend a video or tap Skip.`, {
        chatId,
        replyMarkup: { inline_keyboard: [[{ text: '⏭ Skip', callback_data: 'tr_video:skip' }]] },
    });
}

async function sendApprovalStep(chatId: string, data: any) {
    await setBotState('task_review_approval', data);
    await tgSend(`<b>APPROVAL VIDEO</b>\n\nWant to attach a video to send them when you <b>approve</b> their submission?\nSend a video or tap Skip.`, {
        chatId,
        replyMarkup: { inline_keyboard: [[{ text: '⏭ Skip', callback_data: 'tr_appr:skip' }]] },
    });
}

async function finalizeTask(chatId: string, taskId: string) {
    await supabaseAdmin.from('tasks_database').update({ reviewed: true }).eq('ID', taskId);
    await setBotState(null);
    const { count } = await supabaseAdmin
        .from('challenge_task_pool').select('*', { count: 'exact', head: true }).eq('reviewed', false);
    await tgSend(
        `✅ Task saved!\n\n` +
        (count ? `<b>${count}</b> tasks left · /taskreview for next` : '🎉 All tasks reviewed!'),
        { chatId }
    );
}

async function handleTaskVideoUpload(chatId: string, fileId: string, isApproval: boolean, stateData: any) {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
    const { taskId } = stateData || {};
    await tgSend('⏳ Uploading...', { chatId });

    const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
    const fileData = await fileRes.json();
    const filePath = fileData.result?.file_path;
    if (!filePath) { await tgSend('❌ Could not get file from Telegram.', { chatId }); return; }

    const mediaRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`);
    if (!mediaRes.ok) { await tgSend('❌ Download failed.', { chatId }); return; }

    const buf = await mediaRes.arrayBuffer();
    const label = isApproval ? 'approval' : 'instruction';
    const storagePath = `task_videos/${taskId}_${label}_${Date.now()}.mp4`;

    const { error: uploadError } = await supabaseAdmin.storage
        .from('media').upload(storagePath, buf, { contentType: 'video/mp4', upsert: true });
    if (uploadError) { await tgSend(`❌ Upload failed: ${escapeHtml(uploadError.message)}`, { chatId }); return; }

    const { data: { publicUrl } } = supabaseAdmin.storage.from('media').getPublicUrl(storagePath);
    const field = isApproval ? 'approval_video_url' : 'video_url';
    await supabaseAdmin.from('tasks_database').update({ [field]: publicUrl }).eq('ID', taskId);

    if (!isApproval) {
        await setBotState('task_review_video_tier', stateData);
        await tgSend('✅ Video uploaded! Who can watch it?', {
            chatId,
            replyMarkup: { inline_keyboard: [[
                { text: '🌐 All members', callback_data: 'tr_vtier:free' },
                { text: '👑 Vault only', callback_data: 'tr_vtier:vault' },
            ]]},
        });
    } else {
        await tgSend('✅ Approval video saved.', { chatId });
        await finalizeTask(chatId, taskId);
    }
}

// ─── END TASK REVIEW ──────────────────────────────────────────────────────────

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
            `/taskreview — review + enrich task pool\n` +
            `/roadmap — prioritized dev to-do list\n` +
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

    if (txt.startsWith('/taskreview')) {
        await startTaskReview(chatId);
        return;
    }

    if (txt.startsWith('/skip')) {
        // Context-aware skip for task review steps
        if (state.context === 'task_review_items') {
            await sendVideoStep(chatId, state.data);
            return;
        }
        await setBotState(null);
        await tgSend('Cancelled.', { chatId });
        return;
    }

    if (txt.startsWith('/roadmap')) {
        await tgSend(
            `<b>ROADMAP — PRIORITY LIST</b>\n\n` +
            `<b>WEEKS 1–2 (foundation)</b>\n` +
            `☐ Vault task submission — make it real (store, flag, reward)\n` +
            `☐ Daily cron — morning routine check + kneeling reminder\n` +
            `☐ Streak tracking — auto-reward at 7d / 30d\n` +
            `☐ Auto-archive cron for expired stories\n\n` +
            `<b>WEEKS 3–6 (complete half-built)</b>\n` +
            `☐ Non-vault member daily task pool\n` +
            `☐ Challenge task assignment end-to-end\n` +
            `☐ Leaderboard weekly cron\n` +
            `☐ Email: welcome + password reset + digest\n\n` +
            `<b>MONTH 2–3 (self-running layer)</b>\n` +
            `☐ Behavioral triggers (missed kneeling → flag, 7d silence → check-in)\n` +
            `☐ Tier unlock automation\n` +
            `☐ Gift / cover-story system (wishlist item → story unlock)\n` +
            `☐ Story subscription tier vs PPV clean separation\n\n` +
            `<b>MONTH 4–6 (intelligence)</b>\n` +
            `☐ AI-assisted task personalization\n` +
            `☐ Pattern analysis dashboard\n` +
            `☐ Auto-response drafts in your voice\n` +
            `☐ Referral system\n\n` +
            `<i>Update with /done [item] · /roadmap to view</i>`,
            { chatId }
        );
        return;
    }

    if (txt.startsWith('/help')) {
        await tgSend(
            `<b>COMMANDS</b>\n\n` +
            `/status — pending checks, tributes, vault members\n` +
            `/stories — today's stories + who unlocked\n` +
            `/daily — morning video status\n` +
            `/tag [name] — tag member in today's stories\n` +
            `/roadmap — prioritized dev to-do list\n` +
            `/skip — cancel pending action`,
            { chatId }
        );
        return;
    }

    // Context-based replies
    if (state.context === 'awaiting_story_cover_price') {
        const { latestStoryId } = state.data || {};
        const price = parseFloat(txt);
        if (!isNaN(price) && price > 0 && latestStoryId) {
            await supabaseAdmin.from('stories').update({ tribute_price: price }).eq('id', latestStoryId);
            await tgSend(`✓ Price set: <b>€${price}</b>`, { chatId });
        }
        // Keep latestStoryId alive into tag menu
        await setBotState('awaiting_tag_for_story', { latestStoryId });
        await sendTagMenu(chatId, false);
        return;
    }

    if (state.context === 'awaiting_tag_for_story') {
        // Text search for member during upload flow
        const { latestStoryId } = state.data || {};
        const member = await findMemberInText(txt);
        if (!member) {
            await tgSend(`No member found matching "<b>${escapeHtml(txt)}</b>". Try again or use /skip.`, { chatId });
            return;
        }
        if (latestStoryId) {
            const expires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
            await supabaseAdmin.from('stories').update({
                tagged_members: [member],
                source: 'manual',
                expires_at: expires,
                archived: false,
            }).eq('id', latestStoryId);
            sendStoryPush([member]).catch(() => {});
        }
        await setBotState(null);
        await tgSend(`✓ Story live for <b>${escapeHtml(member.split('@')[0])}</b> · 24h`, { chatId });
        return;
    }

    if (state.context === 'awaiting_tag') {
        await handleTag(chatId, txt);
        return;
    }

    if (state.context === 'task_review_edit_text') {
        const { taskId } = state.data || {};
        await supabaseAdmin.from('tasks_database').update({ TaskText: txt }).eq('ID', taskId);
        await tgSend('✅ Text updated.', { chatId });
        await sendKinkStep(chatId, state.data);
        return;
    }

    if (state.context === 'task_review_items') {
        const { taskId } = state.data || {};
        await supabaseAdmin.from('tasks_database').update({ required_items: txt }).eq('ID', taskId);
        await tgSend(`✅ Items: <i>${escapeHtml(txt)}</i>`, { chatId });
        await sendVideoStep(chatId, state.data);
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
        const state = await getBotState();
        const latestStoryId = state.data?.latestStoryId;
        const name = value.split('@')[0];

        if (latestStoryId) {
            // Upload flow — activate this specific story for the member
            const expires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
            await supabaseAdmin.from('stories').update({
                tagged_members: [value],
                source: 'manual',
                expires_at: expires,
                archived: false,
            }).eq('id', latestStoryId);
            await setBotState(null);
            await tgAnswer(callbackQueryId, `Live for ${name}`);
            await tgSend(`✓ Story live for <b>${escapeHtml(name)}</b> · 24h`, { chatId });
            sendStoryPush([value]).catch(() => {});
            return;
        }

        // Manual /tag flow — tag all today's stories
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
            if (!existing.map(e => e.toLowerCase()).includes(value.toLowerCase())) {
                await supabaseAdmin.from('stories').update({ tagged_members: [...existing, value] }).eq('id', story.id);
            }
        }
        await tgAnswer(callbackQueryId, `Tagged ${name}`);
        await tgSend(`✓ Tagged <b>${escapeHtml(name)}</b> in today's stories.`, { chatId });
        sendStoryPush([value]).catch(() => {});

    } else if (action === 'tag_search') {
        const state = await getBotState();
        const latestStoryId = state.data?.latestStoryId;
        // Preserve latestStoryId so text reply can activate the story
        await setBotState(latestStoryId ? 'awaiting_tag_for_story' : 'awaiting_tag', { latestStoryId });
        await tgAnswer(callbackQueryId);
        await tgSend('Type a name or @nickname:', { chatId });

    } else if (action === 'tag_all') {
        const state = await getBotState();
        const latestStoryId = state.data?.latestStoryId;

        if (latestStoryId) {
            // Upload flow — activate this story for everyone
            const expires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
            await supabaseAdmin.from('stories').update({
                tagged_members: [],
                source: 'manual',
                expires_at: expires,
                archived: false,
            }).eq('id', latestStoryId);
            await setBotState(null);
            await tgAnswer(callbackQueryId, 'Public · 24h');
            await tgSend('✓ Story live for everyone · 24h', { chatId });
            const { data: allProfiles } = await supabaseAdmin.from('profiles').select('member_id').not('member_id', 'is', null);
            const allEmails = (allProfiles || []).map((p: any) => (p.member_id || '').toLowerCase()).filter(Boolean);
            sendStoryPush(allEmails).catch(() => {});
            return;
        }

        // Manual flow — make all current active stories public
        const now = new Date().toISOString();
        const { data: activeStories } = await supabaseAdmin
            .from('stories')
            .select('id')
            .eq('archived', false)
            .neq('source', 'vault')
            .gt('expires_at', now);
        if (activeStories && activeStories.length > 0) {
            for (const s of activeStories) {
                await supabaseAdmin.from('stories').update({ tagged_members: [] }).eq('id', s.id);
            }
        }
        await tgAnswer(callbackQueryId, 'Set to public');
        await tgSend('✓ Story is public — visible to all.', { chatId });
        const { data: allProfiles } = await supabaseAdmin.from('profiles').select('member_id').not('member_id', 'is', null);
        const allEmails = (allProfiles || []).map((p: any) => (p.member_id || '').toLowerCase()).filter(Boolean);
        sendStoryPush(allEmails).catch(() => {});

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
        const { isAll, taggedMembers, latestStoryId } = state.data || {};

        await tgAnswer(callbackQueryId, value === 'paid' ? 'Paid' : 'Free');

        if (value === 'free') {
            if (latestStoryId) {
                await supabaseAdmin.from('stories').update({ tier: 'free', tribute_price: null }).eq('id', latestStoryId);
            }
            await setBotState('awaiting_tag_for_story', { latestStoryId });
            await sendTagMenu(chatId, false);
        } else {
            // Paid — ask membership vs pay-per-view
            if (latestStoryId) {
                await supabaseAdmin.from('stories').update({ tier: 'paid' }).eq('id', latestStoryId);
            }
            await setBotState('awaiting_story_paid_type', { isAll, taggedMembers, latestStoryId });
            await tgSend('How does access work?', {
                chatId,
                replyMarkup: {
                    inline_keyboard: [[
                        { text: '👑 Membership — paying members see it free', callback_data: 'story_paid_type:membership' },
                    ], [
                        { text: '💳 Pay-per-view — everyone pays a price', callback_data: 'story_paid_type:ppv' },
                    ]],
                },
            });
        }

    } else if (action === 'story_paid_type') {
        const state = await getBotState();
        const { isAll, taggedMembers, latestStoryId } = state.data || {};
        await tgAnswer(callbackQueryId);

        if (value === 'membership') {
            // No price needed — membership gate handled by hasTributed check
            await setBotState('awaiting_tag_for_story', { latestStoryId });
            await sendTagMenu(chatId, false);
        } else {
            // PPV — ask for price
            await setBotState('awaiting_story_cover_price', { latestStoryId });
            await tgSend('Enter the price (e.g. <b>9.99</b>):', { chatId });
        }

    // ── Task review callbacks ─────────────────────────────────────────────────
    } else if (action === 'tr_confirm') {
        const state = await getBotState();
        await tgAnswer(callbackQueryId);
        await sendKinkStep(chatId, state.data);

    } else if (action === 'tr_edit') {
        const state = await getBotState();
        await setBotState('task_review_edit_text', state.data);
        await tgAnswer(callbackQueryId);
        await tgSend('Type the new task description:', { chatId });

    } else if (action === 'tr_skip') {
        await tgAnswer(callbackQueryId, 'Skipped');
        await startTaskReview(chatId);

    } else if (action === 'tr_kink') {
        const state = await getBotState();
        const { kinkMsgId } = state.data || {};
        const sel: string[] = state.data?.selectedKinks || [];
        const newSel = sel.includes(value) ? sel.filter((k: string) => k !== value) : [...sel, value];
        await setBotState('task_review_kinks', { ...state.data, selectedKinks: newSel });
        await tgAnswer(callbackQueryId);
        if (kinkMsgId) await tgEditMarkup(chatId, kinkMsgId, { inline_keyboard: buildCategoryKeyboard(newSel, 'tr_kink', 'tr_kink_done') });

    } else if (action === 'tr_kink_done') {
        const state = await getBotState();
        const { taskId, selectedKinks = [] } = state.data || {};
        await supabaseAdmin.from('tasks_database').update({ kinks: selectedKinks }).eq('ID', taskId);
        await tgAnswer(callbackQueryId, `${selectedKinks.length} kinks saved`);
        // Pre-fill limits with same categories — user can adjust in next step
        await sendLimitStep(chatId, { ...state.data, selectedLimits: [...selectedKinks] });

    } else if (action === 'tr_lim') {
        const state = await getBotState();
        const { limMsgId } = state.data || {};
        const sel: string[] = state.data?.selectedLimits || [];
        const newSel = sel.includes(value) ? sel.filter((k: string) => k !== value) : [...sel, value];
        await setBotState('task_review_limits', { ...state.data, selectedLimits: newSel });
        await tgAnswer(callbackQueryId);
        if (limMsgId) await tgEditMarkup(chatId, limMsgId, { inline_keyboard: buildCategoryKeyboard(newSel, 'tr_lim', 'tr_lim_done') });

    } else if (action === 'tr_lim_done') {
        const state = await getBotState();
        const { taskId, selectedLimits = [] } = state.data || {};
        await supabaseAdmin.from('tasks_database').update({ limits: selectedLimits }).eq('ID', taskId);
        await tgAnswer(callbackQueryId, `${selectedLimits.length} limits saved`);
        await sendChastityStep(chatId, state.data);

    } else if (action === 'tr_chastity') {
        const state = await getBotState();
        const { taskId } = state.data || {};
        const ok = value === 'yes';
        await supabaseAdmin.from('tasks_database').update({ chastity_ok: ok }).eq('ID', taskId);
        await tgAnswer(callbackQueryId);
        await sendDifficultyStep(chatId, state.data);

    } else if (action === 'tr_diff') {
        const state = await getBotState();
        const { taskId } = state.data || {};
        await supabaseAdmin.from('tasks_database').update({ difficulty: value }).eq('ID', taskId);
        await tgAnswer(callbackQueryId);
        await sendItemsStep(chatId, { ...state.data, difficulty: value });

    } else if (action === 'tr_video') {
        // Skip instructional video
        const state = await getBotState();
        await tgAnswer(callbackQueryId);
        await sendApprovalStep(chatId, state.data);

    } else if (action === 'tr_vtier') {
        const state = await getBotState();
        const { taskId } = state.data || {};
        await supabaseAdmin.from('tasks_database').update({ video_tier: value }).eq('ID', taskId);
        await tgAnswer(callbackQueryId);
        await sendApprovalStep(chatId, state.data);

    } else if (action === 'tr_appr') {
        // Skip approval video
        const state = await getBotState();
        const { taskId } = state.data || {};
        await tgAnswer(callbackQueryId);
        await finalizeTask(chatId, taskId);
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
            const videoFileId = msg.video?.file_id || msg.document?.file_id;
            const photoFileId = msg.photo?.[msg.photo.length - 1]?.file_id;
            const fileId = videoFileId || photoFileId;
            // file_unique_id is stable across re-sends; use it for dedup
            const videoUniqueId = msg.video?.file_unique_id || msg.document?.file_unique_id;
            const photoUniqueId = msg.photo?.[msg.photo.length - 1]?.file_unique_id;
            const fileUniqueId = videoUniqueId || photoUniqueId;
            if (fileId) {
                const curState = await getBotState();
                if (videoFileId && (curState.context === 'task_review_video' || curState.context === 'task_review_approval')) {
                    await handleTaskVideoUpload(chatId, videoFileId, curState.context === 'task_review_approval', curState.data);
                } else {
                    await handleMediaUpload(chatId, fileId, fileUniqueId || fileId, msg.caption || null, !!photoFileId && !videoFileId);
                }
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
