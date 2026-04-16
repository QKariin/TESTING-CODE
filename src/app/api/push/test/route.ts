import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET /api/push/test?email=someone@example.com
// Sends a test push and returns the full OneSignal response for debugging
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
        return NextResponse.json({ error: 'Pass ?email=someone@example.com' }, { status: 400 });
    }

    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '761d91da-b098-44a7-8d98-75c1cce54dd0';
    const apiKey = process.env.ONESIGNAL_REST_API_KEY;

    if (!apiKey) {
        return NextResponse.json({ error: 'ONESIGNAL_REST_API_KEY is NOT set in env' }, { status: 500 });
    }

    const results: any = {};

    // Attempt 1: new API + include_aliases
    try {
        const res1 = await fetch('https://api.onesignal.com/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${apiKey}`,
            },
            body: JSON.stringify({
                app_id: appId,
                target_channel: 'push',
                include_aliases: { external_id: [email.toLowerCase()] },
                headings: { en: 'Test Push' },
                contents: { en: 'If you see this, push works!' },
                url: 'https://throne.qkarin.com/profile',
            }),
        });
        results.attempt1_new_api = { status: res1.status, body: await res1.json() };
    } catch (e: any) {
        results.attempt1_new_api = { error: e.message };
    }

    // Attempt 2: v1 API + include_external_user_ids
    try {
        const res2 = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${apiKey}`,
            },
            body: JSON.stringify({
                app_id: appId,
                include_external_user_ids: [email.toLowerCase()],
                headings: { en: 'Test Push v1' },
                contents: { en: 'If you see this, v1 push works!' },
                url: 'https://throne.qkarin.com/profile',
            }),
        });
        results.attempt2_v1_api = { status: res2.status, body: await res2.json() };
    } catch (e: any) {
        results.attempt2_v1_api = { error: e.message };
    }

    return NextResponse.json({
        targetEmail: email,
        appId,
        apiKeySet: true,
        apiKeyPrefix: apiKey.substring(0, 8) + '...',
        results,
    });
}
