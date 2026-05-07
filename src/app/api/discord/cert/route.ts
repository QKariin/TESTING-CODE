import { NextResponse } from 'next/server';

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';
const APP_LINK = 'https://throne.qkarin.com';

export async function POST(req: Request) {
    if (!WEBHOOK_URL) return NextResponse.json({ success: false });

    try {
        const { name, rank, imageUrl } = await req.json();
        if (!name || !imageUrl) return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });

        await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'Throne',
                embeds: [{
                    title: 'CERTIFICATE OF SERVICE',
                    url: APP_LINK,
                    description: `**${name}** downloaded their certificate\nRank: **${rank || 'Unknown'}**\n\n[Enter the Throne](${APP_LINK})`,
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
