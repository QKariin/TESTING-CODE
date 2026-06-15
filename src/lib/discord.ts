const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';
const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://throne.qkarin.com';
const APP_LINK = 'https://throne.qkarin.com';

interface DiscordField {
    name: string;
    value: string;
    inline?: boolean;
}

interface DiscordEmbed {
    title: string;
    url?: string;
    description?: string;
    color: number;
    fields?: DiscordField[];
    footer?: { text: string };
    image?: { url: string };
    timestamp?: string;
}

function cardUrl(type: string, title: string, line1: string, line2?: string, icon?: string) {
    const p = new URLSearchParams({ type, title, line1 });
    if (line2) p.set('line2', line2);
    if (icon) p.set('icon', icon);
    return `${BASE}/api/og/discord-card?${p.toString()}`;
}

export async function sendDiscordEmbed(embed: DiscordEmbed) {
    if (!WEBHOOK_URL) return;
    try {
        embed.timestamp = embed.timestamp || new Date().toISOString();
        embed.url = embed.url || APP_LINK;
        if (!embed.footer) embed.footer = { text: 'throne.qkarin.com' };
        await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'Throne',
                embeds: [embed],
            }),
        });
    } catch (_) {}
}

// ── Pre-built notification helpers ──

export function discordDirectTribute(senderName: string, amount: number) {
    return sendDiscordEmbed({
        title: 'DIRECT TRIBUTE',
        description: `**${senderName}** knelt and offered **${amount.toLocaleString()} coins** to the Queen\n\n[Pay your tribute](${APP_LINK})`,
        color: 16766720,
        fields: [
            { name: 'Merit Earned', value: `${Math.floor(amount / 2).toLocaleString()}`, inline: true },
        ],
        image: { url: cardUrl('tribute', 'DIRECT TRIBUTE', `${senderName} offered ${amount.toLocaleString()} coins`, `Merit earned: ${Math.floor(amount / 2).toLocaleString()}`) },
    });
}

export function discordRiskyTribute(
    senderName: string, stake: number, cardName: string,
    lossAmount: number, bonusAmount: number, cardIcon?: string, hierarchy?: string,
) {
    const isJackpot = cardName === 'JACKPOT' && bonusAmount > 0;
    const isNoLoss = lossAmount === 0 && !isJackpot;

    let description: string;
    let color: number;

    if (isJackpot) {
        description = `**${senderName}** gambled **${stake.toLocaleString()} coins** and hit **JACKPOT!**\n\n[Try your luck](${APP_LINK}/profile)`;
        color = 52326;
    } else if (isNoLoss) {
        description = `**${senderName}** gambled **${stake.toLocaleString()} coins** — drew **${cardName}**, lost nothing\n\n[Try your luck](${APP_LINK}/profile)`;
        color = 16766720;
    } else {
        description = `**${senderName}** gambled **${stake.toLocaleString()} coins** — Queen took **${lossAmount.toLocaleString()}**\n\n[Try your luck](${APP_LINK}/profile)`;
        color = 13369344;
    }

    // Build risky card OG image URL (no external font deps — pure edge render)
    const p = new URLSearchParams({
        name: senderName,
        stake: stake.toString(),
        lost: lossAmount.toString(),
        won: bonusAmount.toString(),
        cardName,
    });
    if (hierarchy) p.set('hierarchy', hierarchy);
    if (isJackpot) p.set('isWin', '1');
    if (isNoLoss) p.set('noLoss', '1');
    const imageUrl = `${BASE}/api/og/risky-card?${p.toString()}`;

    return sendDiscordEmbed({
        title: isJackpot ? 'JACKPOT!' : 'RISKY TRIBUTE',
        description,
        color,
        image: { url: imageUrl },
    });
}

export function discordNewMember(name: string) {
    return sendDiscordEmbed({
        title: 'NEW ARRIVAL',
        description: `A new soul has entered the realm\nWelcome, **${name}**\n\n[Enter the Throne](${APP_LINK})`,
        color: 4853326,
        fields: [
            { name: 'Rank', value: 'Hall Boy', inline: true },
            { name: 'Starting Coins', value: '1,111', inline: true },
        ],
        image: { url: cardUrl('arrival', 'NEW ARRIVAL', `Welcome, ${name}`, 'Hall Boy — 1,111 coins') },
    });
}

export function discordPromotion(name: string, oldRank: string, newRank: string) {
    return sendDiscordEmbed({
        title: 'PROMOTION',
        description: `**${name}** has been elevated\n**${oldRank}** \u2192 **${newRank}**\n\n[See the hierarchy](${APP_LINK})`,
        color: 16766720,
        image: { url: cardUrl('promotion', 'PROMOTION', `${name} has been elevated`, `${oldRank} \u2192 ${newRank}`) },
    });
}

export function discordChallengeJoin(name: string, challengeName: string, activeCount: number) {
    return sendDiscordEmbed({
        title: 'CHALLENGE JOINED',
        description: `**${name}** entered **${challengeName}**\n\n[Join the challenge](${APP_LINK})`,
        color: 16115400,
        fields: [
            { name: 'Active Participants', value: `${activeCount}`, inline: true },
        ],
        image: { url: cardUrl('challenge', 'CHALLENGE JOINED', `${name} entered ${challengeName}`) },
    });
}

export function discordChallengeVerified(name: string, taskNum: string, points: number, placement: number) {
    const medals: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd' };
    const placementStr = medals[placement] || `${placement}th`;
    return sendDiscordEmbed({
        title: 'CHALLENGE TASK VERIFIED',
        description: `**${name}** completed task **${taskNum}**\n\n[Join the challenge](${APP_LINK})`,
        color: 52326,
        fields: [
            { name: 'Points', value: `+${points}`, inline: true },
            { name: 'Placement', value: placementStr, inline: true },
        ],
        image: { url: cardUrl('task_ok', 'TASK VERIFIED', `${name} completed task ${taskNum}`, `+${points} points — ${placementStr} place`) },
    });
}

export function discordRoutineSubmitted(name: string) {
    return sendDiscordEmbed({
        title: 'DAILY ROUTINE',
        description: `**${name}** submitted their daily routine\n\n[Start your devotion](${APP_LINK})`,
        color: 4853326,
        image: { url: cardUrl('routine', 'DAILY ROUTINE', `${name} submitted their daily routine`) },
    });
}

export function discordTaskReviewed(name: string, action: 'approve' | 'reject', points?: number) {
    if (action === 'approve') {
        return sendDiscordEmbed({
            title: 'TASK APPROVED',
            description: `**${name}**'s task has been approved\n\n[Enter the Throne](${APP_LINK})`,
            color: 52326,
            fields: [
                { name: 'Points Earned', value: `+${(points || 0).toLocaleString()}`, inline: true },
            ],
            image: { url: cardUrl('task_ok', 'TASK APPROVED', `${name}'s task has been approved`, `+${(points || 0).toLocaleString()} points earned`) },
        });
    }
    return sendDiscordEmbed({
        title: 'TASK REJECTED',
        description: `**${name}**'s task has been rejected\n\n[Enter the Throne](${APP_LINK})`,
        color: 13369344,
        fields: [
            { name: 'Penalty', value: '-300 coins', inline: true },
        ],
        image: { url: cardUrl('task_fail', 'TASK REJECTED', `${name}'s task has been rejected`, '-300 coins penalty') },
    });
}

export function discordReviewSubmitted(name: string, rating: number) {
    const starsStr = '\u2605'.repeat(rating) + '\u2606'.repeat(5 - rating);
    return sendDiscordEmbed({
        title: 'NEW REVIEW',
        description: `**${name}** left a **${rating}-star** review\n${starsStr}\n\n[View in dashboard](${APP_LINK}/dashboard)`,
        color: 16766720,
        fields: [
            { name: 'Rating', value: `${rating}/5`, inline: true },
        ],
        image: { url: cardUrl('review', 'NEW REVIEW', `${name} left a ${rating}-star review`, starsStr) },
    });
}

export function discordLeaderboardChampion(name: string, period: string, score: number, reward: string) {
    const titles: Record<string, string> = { Daily: 'DAILY CHAMPION', Weekly: 'WEEKLY CHAMPION', Monthly: 'MONTHLY CHAMPION' };
    const title = titles[period] || `${period.toUpperCase()} CHAMPION`;
    return sendDiscordEmbed({
        title,
        description: `**${name}** dominated the ${period.toLowerCase()} leaderboard\n\n[See the leaderboard](${APP_LINK})`,
        color: 16766720,
        fields: [
            { name: 'Score', value: score.toLocaleString(), inline: true },
            { name: 'Reward', value: reward, inline: true },
        ],
        image: { url: cardUrl('champion', title, `${name} — Score: ${score.toLocaleString()}`, reward) },
    });
}

export function discordStreamLive() {
    return sendDiscordEmbed({
        title: 'QUEEN KARIN IS LIVE',
        description: `The Queen is streaming right now. Join and watch.\n\n[Join the stream](${APP_LINK}/profile)`,
        color: 15548997, // red
        image: { url: cardUrl('stream', 'QUEEN IS LIVE', 'The Queen is streaming right now', 'Join and watch') },
    });
}

export function discordQueenVideo(thumbnailUrl?: string | null) {
    return sendDiscordEmbed({
        title: 'NEW VIDEO FROM THE QUEEN',
        description: `**Queen Karin** just posted a new video\n\n[Watch now](${APP_LINK}/profile)`,
        color: 16766720,
        image: thumbnailUrl
            ? { url: thumbnailUrl }
            : { url: cardUrl('stream', 'NEW VIDEO', 'Queen Karin posted a new video', 'Watch now on Throne') },
    });
}

export function discordWishlistPurchase(senderName: string, itemTitle: string, cost: number, itemImage?: string | null) {
    return sendDiscordEmbed({
        title: 'WISHLIST TRIBUTE',
        description: `**${senderName}** purchased **${itemTitle}** for the Queen\n\n[See the wishlist](${APP_LINK})`,
        color: 16766720,
        fields: [
            { name: 'Cost', value: `${cost.toLocaleString()} coins`, inline: true },
        ],
        image: { url: itemImage || cardUrl('wishlist', 'WISHLIST TRIBUTE', `${senderName} purchased ${itemTitle}`, `${cost.toLocaleString()} coins`) },
    });
}
