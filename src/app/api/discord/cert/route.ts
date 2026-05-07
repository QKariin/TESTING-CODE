import { NextResponse } from 'next/server';

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';
const APP_LINK = 'https://throne.qkarin.com';

function toBold(text: string): string {
    const boldUpper = '\u{1D400}\u{1D401}\u{1D402}\u{1D403}\u{1D404}\u{1D405}\u{1D406}\u{1D407}\u{1D408}\u{1D409}\u{1D40A}\u{1D40B}\u{1D40C}\u{1D40D}\u{1D40E}\u{1D40F}\u{1D410}\u{1D411}\u{1D412}\u{1D413}\u{1D414}\u{1D415}\u{1D416}\u{1D417}\u{1D418}\u{1D419}';
    const boldLower = '\u{1D41A}\u{1D41B}\u{1D41C}\u{1D41D}\u{1D41E}\u{1D41F}\u{1D420}\u{1D421}\u{1D422}\u{1D423}\u{1D424}\u{1D425}\u{1D426}\u{1D427}\u{1D428}\u{1D429}\u{1D42A}\u{1D42B}\u{1D42C}\u{1D42D}\u{1D42E}\u{1D42F}\u{1D430}\u{1D431}\u{1D432}\u{1D433}';
    const upper = [...boldUpper];
    const lower = [...boldLower];
    return [...text].map(ch => {
        const u = ch.charCodeAt(0);
        if (u >= 65 && u <= 90) return upper[u - 65];
        if (u >= 97 && u <= 122) return lower[u - 97];
        return ch;
    }).join('');
}

export async function POST(req: Request) {
    if (!WEBHOOK_URL) return NextResponse.json({ success: false });

    try {
        const { name, rank, imageUrl } = await req.json();
        if (!name || !imageUrl) return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });

        const boldTitle = toBold('CERTIFICATE OF SERVICE');
        const boldName = toBold(name);
        const boldRank = toBold(rank || 'Unknown');

        await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'Throne',
                embeds: [{
                    title: boldTitle,
                    url: APP_LINK,
                    description: `${boldName} downloaded their certificate\nRank: ${boldRank}\n\n[Enter the Throne](${APP_LINK})`,
                    color: 16766720,
                    image: { url: imageUrl },
                    footer: { text: 'throne.qkarin.com' },
                    timestamp: new Date().toISOString(),
                }],
            }),
        });

        return NextResponse.json({ success: true });
    } catch (_) {
        return NextResponse.json({ success: false });
    }
}
