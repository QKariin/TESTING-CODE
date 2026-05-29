import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { cached } from '@/lib/api-cache';
import { getCaller, isOwnerOrCEO } from '@/lib/api-auth';

export const dynamic = "force-dynamic";

const TTL = 15_000; // 15s cache

async function getRoutineStatus(memberId: string, tz: string) {
    // Get routine name from profiles
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);
    const { data: profile } = isUuid
        ? await supabaseAdmin.from('profiles').select('routine, member_id').eq('ID', memberId).maybeSingle()
        : await supabaseAdmin.from('profiles').select('routine, member_id').ilike('member_id', memberId).maybeSingle();

    const routine = profile?.routine || null;
    const email = (profile?.member_id || memberId).toLowerCase();

    // Save timezone to profile (fire & forget)
    if (profile && tz && tz !== 'UTC') {
        supabaseAdmin.from('profiles').update({ timezone: tz }).ilike('member_id', email).then(() => {}).catch(() => {});
    }

    // Check today's routine from user_routines table
    let uploadedToday = false;
    let todayStatus = 'none';

    const now = new Date();
    const localHour = parseInt(
        new Intl.DateTimeFormat('en', { timeZone: tz, hour: '2-digit', hour12: false }).format(now),
        10
    );
    const localMinute = parseInt(
        new Intl.DateTimeFormat('en', { timeZone: tz, minute: '2-digit' }).format(now),
        10
    );
    const windowOpen = localHour >= 6 && localHour < 10;
    const beforeWindow = localHour < 6;
    const windowDate = new Date(now);
    if (localHour < 6) windowDate.setDate(windowDate.getDate() - 1);
    const todayStr = windowDate.toLocaleDateString('en-CA', { timeZone: tz });

    const { data: userRoutine } = await supabaseAdmin
        .from('user_routines')
        .select('pending_id, pending_submitted_at, history')
        .eq('member_id', email)
        .maybeSingle();

    if (userRoutine) {
        // Check pending submission first
        if (userRoutine.pending_submitted_at) {
            try {
                const pendingDate = new Date(userRoutine.pending_submitted_at).toLocaleDateString('en-CA', { timeZone: tz });
                if (pendingDate === todayStr) {
                    uploadedToday = true;
                    todayStatus = 'pending';
                }
            } catch { /* skip */ }
        }

        // Check history for today's completed entry
        if (!uploadedToday && userRoutine.history) {
            const entries = (userRoutine.history as any[]);
            for (let i = entries.length - 1; i >= 0; i--) {
                const entry = entries[i];
                try {
                    const entryDate = entry.date || new Date(entry.submitted_at).toLocaleDateString('en-CA', { timeZone: tz });
                    if (entryDate === todayStr) {
                        uploadedToday = true;
                        const raw = (entry.status || 'pending').toLowerCase();
                        todayStatus = raw === 'approve' ? 'approved' : raw === 'reject' ? 'rejected' : raw;
                        break;
                    }
                } catch { /* skip */ }
            }
        }
    }

    return { routine, uploadedToday, todayStatus, windowOpen, beforeWindow, localHour, localMinute };
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
        const key = `routine:${memberId.toLowerCase()}`;
        const data = await cached(key, TTL, () => getRoutineStatus(memberId, tz));
        return NextResponse.json(data, { headers: { 'Cache-Control': 'private, max-age=15' } });
    } catch (err: any) {
        console.error('[routine-status]', err);
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
        const key = `routine:${memberId.toLowerCase()}`;
        const data = await cached(key, TTL, () => getRoutineStatus(memberId, tz));
        return NextResponse.json(data);
    } catch (err: any) {
        console.error('[routine-status]', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
