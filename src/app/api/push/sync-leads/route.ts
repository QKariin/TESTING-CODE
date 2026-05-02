import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '761d91da-b098-44a7-8d98-75c1cce54dd0';

// POST /api/push/sync-leads — push all leads + application emails to OneSignal as email subscribers
export async function POST() {
    try {
        // Auth check — CEO only
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const email = (user?.email || '').toLowerCase();
        if (email !== 'ceo@qkarin.com' && email !== 'queen@qkarin.com') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const apiKey = process.env.ONESIGNAL_REST_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'ONESIGNAL_REST_API_KEY not set' }, { status: 500 });
        }

        // 1. Collect all emails from leads + applications
        const [leadsRes, appsRes] = await Promise.all([
            supabaseAdmin.from('leads').select('email'),
            supabaseAdmin.from('applications').select('email'),
        ]);

        const emailSet = new Set<string>();
        (leadsRes.data || []).forEach((r: any) => { if (r.email) emailSet.add(r.email.toLowerCase().trim()); });
        (appsRes.data || []).forEach((r: any) => { if (r.email) emailSet.add(r.email.toLowerCase().trim()); });

        // Remove emails that already have profiles (they're already in the system)
        const { data: profiles } = await supabaseAdmin.from('profiles').select('member_id');
        const existingEmails = new Set((profiles || []).map((p: any) => (p.member_id || '').toLowerCase()));
        const newEmails = [...emailSet].filter(e => !existingEmails.has(e) && e.includes('@'));

        // 2. Push each email to OneSignal as an email subscriber
        let success = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const addr of newEmails) {
            try {
                const res = await fetch('https://api.onesignal.com/apps/' + ONESIGNAL_APP_ID + '/users', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Basic ${apiKey}`,
                    },
                    body: JSON.stringify({
                        identity: { external_id: addr },
                        subscriptions: [{
                            type: 'Email',
                            token: addr,
                            enabled: true,
                        }],
                    }),
                });

                if (res.ok || res.status === 409) {
                    success++;
                } else {
                    const body = await res.text();
                    failed++;
                    if (errors.length < 5) errors.push(`${addr}: ${res.status} ${body.slice(0, 100)}`);
                }
            } catch (err: any) {
                failed++;
                if (errors.length < 5) errors.push(`${addr}: ${err.message}`);
            }
        }

        return NextResponse.json({
            success: true,
            total: newEmails.length,
            synced: success,
            failed,
            skippedExisting: emailSet.size - newEmails.length,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (err: any) {
        console.error('[sync-leads]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
