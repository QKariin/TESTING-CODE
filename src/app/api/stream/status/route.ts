import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { discordStreamLive } from '@/lib/discord';

export const dynamic = 'force-dynamic';

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const CF_LIVE_INPUT_ID = process.env.CLOUDFLARE_LIVE_INPUT_ID || '';

const CF_SUBDOMAIN = 'customer-d8ziir1df1lqjii2.cloudflarestream.com';
const CF_STREAM_ID = '9a3ae8586ec9914c65a5c3a752671fd6';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const NOTIF_COOLDOWN_MIN = 60; // 1 hour in minutes

// GET /api/stream/status — check if stream is live
export async function GET() {
    let isLive = false;
    let method = 'none';

    // Method 1: Cloudflare API (most reliable)
    if (CF_ACCOUNT_ID && CF_API_TOKEN && CF_LIVE_INPUT_ID) {
        try {
            const res = await fetch(
                `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/live_inputs/${CF_LIVE_INPUT_ID}`,
                {
                    headers: { 'Authorization': `Bearer ${CF_API_TOKEN}` },
                    cache: 'no-store',
                }
            );
            if (res.ok) {
                const data = await res.json();
                const state = data?.result?.status?.current?.state;
                isLive = state === 'connected';
                method = `cf-api:${state || 'unknown'}`;
            } else {
                method = `cf-api:http${res.status}`;
            }
        } catch (e) {
            method = 'cf-api:error';
            console.error('[stream/status] CF API error:', e);
        }
    } else {
        method = 'cf-api:no-env';
    }

    // Method 2: Fallback — Cloudflare Stream lifecycle endpoint (no API key needed)
    if (!isLive) {
        try {
            const res = await fetch(
                `https://${CF_SUBDOMAIN}/${CF_STREAM_ID}/lifecycle`,
                { cache: 'no-store' }
            );
            if (res.ok) {
                const data = await res.json();
                isLive = data.live === true;
                method += `|lifecycle:${JSON.stringify(data)}`;
            } else {
                method += `|lifecycle:http${res.status}`;
            }
        } catch {
            method += '|lifecycle:error';
        }
    }

    console.log(`[stream/status] GET → live=${isLive} method=${method}`);
    return NextResponse.json({ live: isLive, method });
}

// POST /api/stream/status — auto-triggered when stream goes live, sends push to all
// Deduplicated via DB: only sends once per hour regardless of how many clients/instances call it
export async function POST() {
    // Dedup via DB: check if STREAM_LIVE was posted to global_messages recently
    try {
        const { data: recent } = await supabaseAdmin.from('global_messages')
            .select('id')
            .eq('sender_email', 'system')
            .like('message', 'STREAM_LIVE::%')
            .gte('created_at', new Date(Date.now() - NOTIF_COOLDOWN_MIN * 60 * 1000).toISOString())
            .limit(1);
        if (recent && recent.length > 0) {
            console.log('[stream/status] POST skipped — dedup hit, recent STREAM_LIVE exists');
            return NextResponse.json({ success: true, skipped: true });
        }
    } catch (e) {
        console.error('[stream/status] Dedup check error:', e);
    }

    // Verify stream is actually live before sending
    let isLive = false;
    try {
        const res = await fetch(
            `https://${CF_SUBDOMAIN}/${CF_STREAM_ID}/lifecycle`,
            { cache: 'no-store' }
        );
        if (res.ok) {
            const data = await res.json();
            isLive = data.live === true;
        }
    } catch {}

    if (!isLive) {
        console.log('[stream/status] POST skipped — lifecycle says not live');
        return NextResponse.json({ success: false, reason: 'not live' });
    }

    console.log('[stream/status] POST — stream is live, sending notifications...');

    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '761d91da-b098-44a7-8d98-75c1cce54dd0';
    const apiKey = process.env.ONESIGNAL_REST_API_KEY;

    let pushData = null;
    if (apiKey) {
        try {
            const pushRes = await fetch('https://api.onesignal.com/notifications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${apiKey}`,
                },
                body: JSON.stringify({
                    app_id: appId,
                    included_segments: ['All'],
                    headings: { en: 'Queen Karin is LIVE' },
                    contents: { en: 'The Queen is streaming now. Join and watch.' },
                    url: 'https://throne.qkarin.com/profile',
                }),
            });
            pushData = await pushRes.json();
            console.log('[stream] Push sent to all:', pushData);
        } catch (e) {
            console.error('[stream] Push error:', e);
        }
    }

    // Discord notification
    discordStreamLive().catch(() => {});

    // Post to global chat
    try {
        await supabaseAdmin.from('global_messages').insert({
            sender_email: 'system',
            sender_name: 'SYSTEM',
            sender_avatar: null,
            message: 'STREAM_LIVE::{}',
            channel: 'global',
        });
    } catch {}

    return NextResponse.json({ success: true, push: pushData });
}
