const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';

interface DiscordField {
    name: string;
    value: string;
    inline?: boolean;
}

interface DiscordEmbed {
    title: string;
    description?: string;
    color: number;
    fields?: DiscordField[];
    footer?: { text: string };
    thumbnail?: { url: string };
    timestamp?: string;
}

export async function sendDiscordEmbed(embed: DiscordEmbed) {
    if (!WEBHOOK_URL) return;
    try {
        embed.timestamp = embed.timestamp || new Date().toISOString();
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
        description: `**${senderName}** knelt and offered **${amount.toLocaleString()} coins** to the Queen`,
        color: 16766720, // gold #FFD700
        fields: [
            { name: 'Merit Earned', value: `${Math.floor(amount / 2).toLocaleString()}`, inline: true },
        ],
    });
}

export function discordRiskyTribute(
    senderName: string, stake: number, cardName: string,
    lossAmount: number, bonusAmount: number,
) {
    const isJackpot = cardName === 'JACKPOT' && bonusAmount > 0;
    const isNoLoss = lossAmount === 0 && !isJackpot;

    let description: string;
    let color: number;

    if (isJackpot) {
        description = `**${senderName}** gambled **${stake.toLocaleString()} coins** and hit **JACKPOT** — won **${bonusAmount.toLocaleString()}** back!`;
        color = 52326; // green #00CC66
    } else if (isNoLoss) {
        description = `**${senderName}** gambled **${stake.toLocaleString()} coins** — drew **${cardName}**, lost nothing`;
        color = 16766720; // gold
    } else {
        description = `**${senderName}** gambled **${stake.toLocaleString()} coins** — drew **${cardName}**, Queen took **${lossAmount.toLocaleString()}**`;
        color = 13369344; // red #CC0000
    }

    return sendDiscordEmbed({
        title: isJackpot ? 'JACKPOT!' : 'RISKY TRIBUTE',
        description,
        color,
        fields: [
            { name: 'Staked', value: stake.toLocaleString(), inline: true },
            { name: isJackpot ? 'Won' : 'Lost', value: (isJackpot ? bonusAmount : lossAmount).toLocaleString(), inline: true },
            { name: 'Card', value: cardName, inline: true },
        ],
    });
}

export function discordNewMember(name: string) {
    return sendDiscordEmbed({
        title: 'NEW ARRIVAL',
        description: `A new soul has entered the realm\nWelcome, **${name}**`,
        color: 4853326, // purple #4A0E4E
        fields: [
            { name: 'Rank', value: 'Hall Boy', inline: true },
            { name: 'Starting Coins', value: '1,111', inline: true },
        ],
    });
}

export function discordPromotion(name: string, oldRank: string, newRank: string) {
    return sendDiscordEmbed({
        title: 'PROMOTION',
        description: `**${name}** has been elevated\n**${oldRank}** \u2192 **${newRank}**`,
        color: 16766720, // gold
    });
}

export function discordChallengeJoin(name: string, challengeName: string, activeCount: number) {
    return sendDiscordEmbed({
        title: 'CHALLENGE JOINED',
        description: `**${name}** entered **${challengeName}**`,
        color: 16115400, // warm white-gold #F5E6C8
        fields: [
            { name: 'Active Participants', value: `${activeCount}`, inline: true },
        ],
    });
}

export function discordChallengeVerified(name: string, taskNum: string, points: number, placement: number) {
    const medals: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd' };
    const placementStr = medals[placement] || `${placement}th`;
    return sendDiscordEmbed({
        title: 'CHALLENGE TASK VERIFIED',
        description: `**${name}** completed task **${taskNum}**`,
        color: 52326, // green
        fields: [
            { name: 'Points', value: `+${points}`, inline: true },
            { name: 'Placement', value: placementStr, inline: true },
        ],
    });
}

export function discordCoinPurchase(name: string, coins: number) {
    return sendDiscordEmbed({
        title: 'COIN PURCHASE',
        description: `**${name}** purchased **${coins.toLocaleString()} coins**`,
        color: 16766720, // gold
    });
}
