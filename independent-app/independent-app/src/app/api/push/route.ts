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

        // Look up the user's saved OneSignal subscription ID from their profile
        const { createClient } = await import('@supabase/supabase-js');
        const admin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const { data: profile } = await admin
            .from('profiles')
            .select('onesignal_id')
            .ilike('member_id', externalId)
            .maybeSingle();

        const onesignalId = profile?.onesignal_id;
        console.log('[push] onesignal_id for', externalId, ':', onesignalId || 'NOT FOUND');
        if (!onesignalId) {
            return NextResponse.json({ success: false, error: 'No push subscription for this user' });
        }

        const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '761d91da-b098-44a7-8d98-75c1cce54dd0';
        const response = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Key ${process.env.ONESIGNAL_REST_API_KEY}`,
            },
            body: JSON.stringify({
                app_id: appId,
                include_player_ids: [onesignalId],
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

// PUT /api/push — save OneSignal subscription ID to the user's profile
export async function PUT(req: Request) {
    const caller = await getCallerEmail();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { subscriptionId } = await req.json();
        if (!subscriptionId) return NextResponse.json({ error: 'Missing subscriptionId' }, { status: 400 });

        const { createClient } = await import('@supabase/supabase-js');
        const admin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { error } = await admin.from('profiles').update({ onesignal_id: subscriptionId }).ilike('member_id', caller);
        if (error) console.error('[push/save] DB error:', error.message);
        else console.log('[push/save] Saved onesignal_id', subscriptionId, 'for', caller);

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[push/link] error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
