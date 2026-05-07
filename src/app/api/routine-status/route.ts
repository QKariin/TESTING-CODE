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

    // Check today's routine from the dedicated routines table
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

    const { data: todaysRoutines } = await supabaseAdmin
        .from('routines')
        .select('submitted_at, status')
        .eq('member_id', email)
        .gte('submitted_at', todayStr + 'T00:00:00Z')
        .order('submitted_at', { ascending: false })
        .limit(5);

    if (todaysRoutines && todaysRoutines.length > 0) {
        // Check if any match today's window
        for (const r of todaysRoutines) {
            try {
                const localDate = new Date(r.submitted_at).toLocaleDateString('en-CA', { timeZone: tz });
                if (localDate === todayStr) {
                    uploadedToday = true;
                    const raw = (r.status || 'pending').toLowerCase();
                    todayStatus = raw === 'approve' ? 'approved' : raw === 'reject' ? 'rejected' : raw;
                    break;
                }
            } catch { /* skip */ }
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
