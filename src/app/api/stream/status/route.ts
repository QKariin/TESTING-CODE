import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const CF_LIVE_INPUT_ID = process.env.CLOUDFLARE_LIVE_INPUT_ID || '';

const CF_SUBDOMAIN = 'customer-d8ziir1df1lqjii2.cloudflarestream.com';
const CF_STREAM_ID = '9a3ae8586ec9914c65a5c3a752671fd6';
const HLS_URL = `https://${CF_SUBDOMAIN}/${CF_STREAM_ID}/manifest/video.m3u8`;

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/stream/status — check if stream is live
export async function GET() {
    let isLive = false;

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
                isLive = data?.result?.status?.current?.state === 'connected';
            }
        } catch (e) {
            console.error('[stream/status] CF API error:', e);
        }
    }

    // Method 2: Fallback — try fetching HLS manifest
    if (!isLive) {
        try {
            const res = await fetch(HLS_URL, { method: 'GET', cache: 'no-store' });
            if (res.ok) {
                const text = await res.text();
                isLive = text.includes('#EXTINF') || text.includes('#EXT-X-STREAM-INF');
            }
        } catch {}
    }

    return NextResponse.json({ live: isLive });
}

// POST /api/stream/status — Queen triggers "going live" (sends push to all)
export async function POST(req: Request) {
    const { getCaller, isCEO } = await import('@/lib/api-auth');
    const caller = await getCaller();
    if (!caller || !isCEO(caller.email)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '761d91da-b098-44a7-8d98-75c1cce54dd0';
    const apiKey = process.env.ONESIGNAL_REST_API_KEY;

    if (!apiKey) {
        return NextResponse.json({ error: 'Push not configured' }, { status: 500 });
    }

    // Send push notification to ALL subscribers
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

    const pushData = await pushRes.json();

    // Also post to global chat
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
