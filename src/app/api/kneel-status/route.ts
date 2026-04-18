import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { cached, cacheDelete } from '@/lib/api-cache';
import { getCaller, isOwnerOrCEO } from '@/lib/api-auth';

export const dynamic = "force-dynamic";

const TTL = 10_000; // 10s
const COOLDOWN_MS = process.env.NODE_ENV === 'development' ? 60 * 1000 : 60 * 60 * 1000;

// Resolve tasks row with UUID + legacy email fallback
async function getTasksRow(memberId: string, fields: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);

    if (isUuid) {
        const { data } = await supabaseAdmin.from('tasks').select(fields).eq('ID', memberId).maybeSingle();
        if (data) return data;

        // Fallback: find email via profile, look up task by email
        const { data: profile } = await supabaseAdmin
            .from('profiles').select('member_id').eq('ID', memberId).maybeSingle();
        if (profile?.member_id) {
            const { data: row } = await supabaseAdmin
                .from('tasks').select(fields).ilike('member_id', profile.member_id).maybeSingle();
            if (row) return row;
        }
    } else {
        const { data } = await supabaseAdmin.from('tasks').select(fields).ilike('member_id', memberId).maybeSingle();
        if (data) return data;
    }
    return null;
}

async function getKneelStatus(memberId: string, tz: string) {
    const taskRow = await getTasksRow(memberId, 'lastWorship, kneelCount, "today kneeling"');

    // Fetch kneel_history separately — column may not exist yet
    let rawKneelHistory: any = null;
    try {
        const hRow = await getTasksRow(memberId, 'kneel_history');
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

    // Fallback: if kneel_history is missing but lastWorship is today, derive hour from it
    if (kneelHours.length === 0 && lastStr === todayStr && lastWorshipMs > 0) {
        try {
            const h = parseInt(new Date(lastWorshipMs).toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false }), 10);
            const safeH = h === 24 ? 0 : h;
            if (safeH >= 0) kneelHours = [safeH];
        } catch (_) { }
    }

    return { lastWorshipMs, isLocked, minLeft, kneelCount: taskRow?.kneelCount || 0, todayKneeling, kneelHours };
}

export async function GET(req: Request) {
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(req.url);
        const memberId = searchParams.get('memberId') || searchParams.get('email');
        if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 });
        if (!isOwnerOrCEO(caller, memberId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const tz = searchParams.get('tz') || 'UTC';
        const key = `kneel:${memberId.toLowerCase()}`;
        const data = await cached(key, TTL, () => getKneelStatus(memberId, tz));
        return NextResponse.json(data, { headers: { 'Cache-Control': 'private, max-age=10' } });
    } catch (err: any) {
        console.error('[kneel-status]', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const memberId = body.memberId || body.email;
        if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 });
        if (!isOwnerOrCEO(caller, memberId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const tz = body.tz || 'UTC';
        const key = `kneel:${memberId.toLowerCase()}`;
        const data = await cached(key, TTL, () => getKneelStatus(memberId, tz));
        return NextResponse.json(data);
    } catch (err: any) {
        console.error('[kneel-status]', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// Call this after a successful kneel to bust the cache immediately
export function bustKneelCache(memberId: string) {
    cacheDelete(`kneel:${memberId.toLowerCase()}`);
}
