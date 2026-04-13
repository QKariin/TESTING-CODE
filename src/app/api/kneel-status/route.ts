import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { cached, cacheDelete } from '@/lib/api-cache';

export const dynamic = "force-dynamic";

const TTL = 10_000; // 10s — stale kneel state is fine, button locks client-side anyway

const COOLDOWN_MS = process.env.NODE_ENV === 'development' ? 60 * 1000 : 60 * 60 * 1000;

async function getKneelStatus(memberEmail: string, tz: string) {
    // Select core fields first — kneel_history is optional (column may not exist yet)
    const { data: taskRow } = await supabaseAdmin
        .from('tasks')
        .select('lastWorship, kneelCount, "today kneeling"')
        .ilike('member_id', memberEmail)
        .maybeSingle();

    // Fetch kneel_history separately so a missing column doesn't zero out todayKneeling
    let rawKneelHistory: any = null;
    try {
        const { data: hRow } = await supabaseAdmin
            .from('tasks')
            .select('kneel_history')
            .ilike('member_id', memberEmail)
            .maybeSingle();
        rawKneelHistory = hRow?.kneel_history ?? null;
    } catch (_) { }

    const now = Date.now();
    const lastWorshipMs = taskRow?.lastWorship ? new Date(taskRow.lastWorship).getTime() : 0;
    const diffMs = now - lastWorshipMs;
    const isLocked = lastWorshipMs > 0 && diffMs < COOLDOWN_MS;
    const minLeft = isLocked ? Math.ceil((COOLDOWN_MS - diffMs) / 60000) : 0;

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: tz });
    const lastStr = lastWorshipMs > 0 ? new Date(lastWorshipMs).toLocaleDateString('en-CA', { timeZone: tz }) : null;
    const todayKneeling = lastStr === todayStr ? parseInt(taskRow?.['today kneeling'] || '0', 10) : 0;

    let kneelHours: number[] = [];
    try {
        const raw = rawKneelHistory;
        const history: string[] = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : []);
        if (history.length) {
            kneelHours = [...new Set(
                history
                    .filter(ts => { try { return new Date(ts).toLocaleDateString('en-CA', { timeZone: tz }) === todayStr; } catch { return false; } })
                    .map(ts => { try { const h = parseInt(new Date(ts).toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false }), 10); return h === 24 ? 0 : h; } catch { return -1; } })
                    .filter(h => h >= 0)
            )];
        }
    } catch (_) { }

    return { lastWorshipMs, isLocked, minLeft, kneelCount: taskRow?.kneelCount || 0, todayKneeling, kneelHours };
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const memberEmail = searchParams.get('email');
        if (!memberEmail) return NextResponse.json({ error: 'Missing email' }, { status: 400 });
        const tz = searchParams.get('tz') || 'UTC';
        const key = `kneel:${memberEmail.toLowerCase()}`;
        const data = await cached(key, TTL, () => getKneelStatus(memberEmail, tz));
        return NextResponse.json(data, { headers: { 'Cache-Control': 'private, max-age=10' } });
    } catch (err: any) {
        console.error('[kneel-status]', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const memberEmail = body.email;
        if (!memberEmail) return NextResponse.json({ error: 'Missing email' }, { status: 400 });
        const tz = body.tz || 'UTC';
        const key = `kneel:${memberEmail.toLowerCase()}`;
        const data = await cached(key, TTL, () => getKneelStatus(memberEmail, tz));
        return NextResponse.json(data);
    } catch (err: any) {
        console.error('[kneel-status]', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// Call this after a successful kneel to bust the cache immediately
export function bustKneelCache(email: string) {
    cacheDelete(`kneel:${email.toLowerCase()}`);
}
