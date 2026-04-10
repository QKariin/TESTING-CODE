import { NextResponse } from 'next/server';
import { getCallerEmail } from '@/lib/api-auth';

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

// PUT /api/push — link a OneSignal subscription ID to a user's email (external_id)
export async function PUT(req: Request) {
    const caller = await getCallerEmail();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { subscriptionId } = await req.json();
        if (!subscriptionId) return NextResponse.json({ error: 'Missing subscriptionId' }, { status: 400 });

        const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '761d91da-b098-44a7-8d98-75c1cce54dd0';

        const response = await fetch(`https://api.onesignal.com/apps/${appId}/subscriptions/${subscriptionId}/user/identity`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Key ${process.env.ONESIGNAL_REST_API_KEY}`,
            },
            body: JSON.stringify({ identity: { external_id: caller } }),
        });

        const data = await response.json();
        if (!response.ok) {
            console.error('[push/link] OneSignal error:', data);
            return NextResponse.json({ error: data }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[push/link] error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
