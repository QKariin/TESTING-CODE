import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// POST /api/push — send a push notification to a specific user via OneSignal
export async function POST(req: Request) {
    try {
        const { externalId, title, message } = await req.json();

        if (!externalId || !message) {
            return NextResponse.json({ error: 'Missing externalId or message' }, { status: 400 });
        }

        const response = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Key ${process.env.ONESIGNAL_REST_API_KEY}`,
            },
            body: JSON.stringify({
                app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '761d91da-b098-44a7-8d98-75c1cce54dd0',
                target_channel: 'push',
                include_aliases: { external_id: [externalId] },
                headings: { en: title || 'Queen Karin' },
                contents: { en: message },
                url: 'https://throne.qkarin.com/profile',
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[push] OneSignal error:', data);
            return NextResponse.json({ error: data }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch (err: any) {
        console.error('[push] error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
