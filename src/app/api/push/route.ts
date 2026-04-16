import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

// POST /api/push - send a push notification to a specific user via OneSignal
// externalId is the user's email (same as their OneSignal external_id)
export async function POST(req: Request) {
    try {
        const { externalId, title, message } = await req.json();

        if (!externalId || !message) {
            return NextResponse.json({ error: 'Missing externalId or message' }, { status: 400 });
        }

        const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '761d91da-b098-44a7-8d98-75c1cce54dd0';
        const apiKey = process.env.ONESIGNAL_REST_API_KEY;
        if (!apiKey) {
            console.error('[push] ONESIGNAL_REST_API_KEY not set');
            return NextResponse.json({ error: 'Push not configured' }, { status: 500 });
        }

        // Target by external_id (email) — no DB lookup needed
        const response = await fetch('https://api.onesignal.com/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Key ${apiKey}`,
            },
            body: JSON.stringify({
                app_id: appId,
                target_channel: 'push',
                include_aliases: { external_id: [externalId.toLowerCase()] },
                headings: { en: title || 'Queen Karin' },
                contents: { en: message },
                url: 'https://throne.qkarin.com/profile',
            }),
        });

        const data = await response.json();
        console.log('[push] OneSignal response:', response.status, JSON.stringify(data));

        if (!response.ok) {
            return NextResponse.json({ error: data }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch (err: any) {
        console.error('[push] error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// PUT /api/push - save OneSignal subscription ID to the user's profile
// Accepts either Supabase auth session (queen/admin) or explicit memberId in body (subs)
export async function PUT(req: Request) {
    try {
        const { subscriptionId, memberId: bodyMemberId } = await req.json();
        if (!subscriptionId) return NextResponse.json({ error: 'Missing subscriptionId' }, { status: 400 });

        const { createClient: createAdminClient } = await import('@supabase/supabase-js');
        const admin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Resolve target: Supabase auth session first, then explicit memberId from body
        let targetEmail: string | null = null;
        try {
            const supabase = await createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) targetEmail = user.email;
        } catch {}

        if (!targetEmail && bodyMemberId) targetEmail = String(bodyMemberId).toLowerCase();
        if (!targetEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetEmail);
        const updateQuery = admin.from('profiles').update({ onesignal_id: subscriptionId });
        const { error } = await (isUuid
            ? updateQuery.eq('ID', targetEmail)
            : updateQuery.ilike('member_id', targetEmail));
        if (error) console.error('[push/save] DB error:', error.message);
        else console.log('[push/save] Saved onesignal_id', subscriptionId, 'for', targetEmail);

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[push/save] error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
