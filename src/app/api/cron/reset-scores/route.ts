import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { discordLeaderboardChampion } from '@/lib/discord';

export const dynamic = 'force-dynamic';

// ── Leaderboard rewards: first place only ──
const REWARDS: Record<string, { items: Record<string, number>; coins: number; label: string }> = {
    'Daily Score':   { items: { skippass: 1 }, coins: 0, label: 'DAILY CHAMPION' },
    'Weekly Score':  { items: { cumpass: 1 }, coins: 1000, label: 'WEEKLY CHAMPION' },
    'Monthly Score': { items: { checkpoint: 1, cumpass: 3, skippass: 5 }, coins: 0, label: 'MONTHLY CHAMPION' },
};

const PERIOD_MAP: Record<string, string> = {
    'Daily Score': 'today',
    'Weekly Score': 'weekly',
    'Monthly Score': 'monthly',
};

async function rewardWinner(scoreCol: string) {
    const reward = REWARDS[scoreCol];
    if (!reward) return null;

    // Ask the actual leaderboard API who is #1 — same data the UI shows
    const period = PERIOD_MAP[scoreCol] || 'today';
    const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://throne.qkarin.com';
    const lbRes = await fetch(`${base}/api/global/leaderboard?period=${period}`);
    if (!lbRes.ok) {
        console.error(`[cron/reward] Leaderboard fetch failed for ${period}:`, lbRes.status);
        return null;
    }
    const lbData = await lbRes.json();
    const entries = lbData.entries || [];
    if (entries.length === 0) return null;

    const winner = entries[0];
    const topScore = Number(winner.score || 0);
    if (topScore <= 0) return null;

    console.log(`[cron/reward] ${scoreCol} leaderboard #1: ${winner.name} (${topScore}), top 3:`, entries.slice(0, 3).map((e: any) => `${e.name}: ${e.score}`));

    // Find winner's email via member_number (UUID) or name
    let winnerEmail = '';
    if (winner.member_number) {
        const { data: prof } = await supabaseAdmin.from('profiles').select('member_id').eq('ID', winner.member_number).maybeSingle();
        if (prof?.member_id) winnerEmail = prof.member_id.toLowerCase();
    }
    if (!winnerEmail) return null;

    // Fetch winner profile
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('ID, name, cumpass, skippass, checkpoint, wallet')
        .ilike('member_id', winnerEmail)
        .maybeSingle();

    if (!profile) return null;

    // Build update: increment items + add coins
    const profileUpdate: Record<string, any> = {};
    for (const [item, qty] of Object.entries(reward.items)) {
        profileUpdate[item] = (Number((profile as any)[item] || 0)) + qty;
    }
    if (reward.coins > 0) {
        profileUpdate.wallet = (Number(profile.wallet || 0)) + reward.coins;
    }

    const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdate)
        .ilike('member_id', winnerEmail);

    if (updateErr) {
        console.error(`[cron/reward] Failed to update ${winnerEmail}:`, updateErr.message);
        return null;
    }

    // Send reward card to private chat
    const itemNames: Record<string, string> = { skippass: 'Skip Pass', cumpass: 'Cum Pass', checkpoint: 'Checkpoint' };
    const itemList = Object.entries(reward.items).map(([k, v]) => `${v}x ${itemNames[k] || k}`).join(', ');
    const rewardText = reward.coins > 0 ? `${itemList} + ${reward.coins.toLocaleString()} coins` : itemList;

    const cardData = {
        title: reward.label,
        rewards: rewardText,
        score: topScore,
        period: scoreCol.replace(' Score', ''),
    };

    try {
        await supabaseAdmin.from('chats').insert({
            member_id: winnerEmail,
            sender_email: 'queen',
            content: `LEADERBOARD_REWARD_CARD::${JSON.stringify(cardData)}`,
            type: 'text',
            metadata: { isQueen: true },
        });
    } catch (_) {}

    // Post in global chat
    try {
        await supabaseAdmin.from('global_messages').insert({
            sender_email: 'system',
            sender_name: 'SYSTEM',
            sender_avatar: null,
            message: `LEADERBOARD_REWARD_CARD::${JSON.stringify({ ...cardData, winnerName: profile.name || 'SUBJECT' })}`,
        });
    } catch (_) {}

    // Push notification
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '761d91da-b098-44a7-8d98-75c1cce54dd0';
    const apiKey = process.env.ONESIGNAL_REST_API_KEY;
    if (apiKey) {
        fetch('https://api.onesignal.com/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${apiKey}` },
            body: JSON.stringify({
                app_id: appId,
                target_channel: 'push',
                include_aliases: { external_id: [winnerEmail] },
                headings: { en: 'Queen Karin' },
                contents: { en: `You are the ${reward.label}! Your reward: ${rewardText}` },
                url: 'https://throne.qkarin.com/profile',
            }),
        }).catch(() => {});
    }

    // Discord announcement
    const period = scoreCol.replace(' Score', '');
    discordLeaderboardChampion(profile.name || 'SUBJECT', period, topScore, rewardText).catch(() => {});

    console.log(`[cron/reward] ${reward.label}: ${profile.name} (${winnerEmail}) — score ${topScore} — reward: ${rewardText}`);
    return { winner: profile.name, email: winnerEmail, score: topScore, reward: rewardText };
}

// Runs daily at 22:59 UTC = 23:59 CET (Europe/Prague)
export async function GET(req: Request) {
    // Auth check - only enforced if CRON_SECRET is actually set and non-empty
    const envSecret = (process.env.CRON_SECRET || '').trim();
    if (envSecret) {
        const authHeader = req.headers.get('authorization') || '';
        const incoming = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
        if (incoming !== envSecret) {
            console.error('[cron/reset-scores] Unauthorized. incoming:', JSON.stringify(incoming), 'expected:', JSON.stringify(envSecret));
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    console.log('[cron/reset-scores] Fired at UTC:', new Date().toISOString());

    // Get current time in Prague timezone
    const now = new Date();
    const pragueTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Prague' }));
    const pragueHour = pragueTime.getHours();

    // Only run if it's 23:XX in Prague (handles DST — cron fires at both 21:59 and 22:59 UTC)
    if (pragueHour !== 23) {
        console.log(`[cron/reset-scores] Skipped — Prague hour is ${pragueHour}, not 23`);
        return NextResponse.json({ skipped: true, pragueHour });
    }

    const dayOfWeek = pragueTime.getDay(); // 0=Sunday
    const date = pragueTime.getDate();
    const month = pragueTime.getMonth() + 1;
    const year = pragueTime.getFullYear();
    const lastDayOfMonth = new Date(year, month, 0).getDate();

    const resets: string[] = ['Daily Score']; // Always reset daily
    if (dayOfWeek === 1) resets.push('Weekly Score');
    if (date === lastDayOfMonth) resets.push('Monthly Score');
    if (month === 12 && date === 31) resets.push('Yearly Score');

    // ── REWARD WINNERS BEFORE RESETTING ──
    const rewards: any[] = [];
    for (const field of resets) {
        const result = await rewardWinner(field);
        if (result) rewards.push({ period: field, ...result });
    }

    // ── RESET SCORES ──
    const updates: Record<string, number> = {};
    for (const field of resets) updates[field] = 0;

    console.log('[cron/reset-scores] Resetting fields:', resets, 'Prague time:', pragueTime.toISOString());

    const { error, count } = await supabaseAdmin
        .from('tasks')
        .update(updates)
        .not('member_id', 'is', null)
        .select('member_id', { count: 'exact', head: true });

    if (error) {
        console.error('[cron/reset-scores] Supabase error:', error.message, error.details);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log(`[cron/reset-scores] Success. Rows affected: ${count ?? 'unknown'}. Reset: ${resets.join(', ')}. Rewards: ${rewards.length}`);
    return NextResponse.json({ success: true, reset: resets, rowsAffected: count, rewards });
}
