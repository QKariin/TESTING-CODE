import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { cached } from '@/lib/api-cache';

export const dynamic = "force-dynamic";

const TTL = 15_000; // 15s cache

// Resolve tasks row for any memberId (UUID or legacy email)
async function getTaskRow(memberId: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);

    if (isUuid) {
        const { data } = await supabaseAdmin
            .from('tasks')
            .select('Taskdom_History')
            .eq('member_id', memberId)
            .maybeSingle();
        if (data) return data;

        // UUID user but tasks row might still use email — look up via profiles
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('id, member_id')
            .eq('id', memberId)
            .maybeSingle();
        // Try by profiles.id
        if (profile?.id && profile.id !== memberId) {
            const { data: rowById } = await supabaseAdmin
                .from('tasks')
                .select('Taskdom_History')
                .eq('member_id', profile.id)
                .maybeSingle();
            if (rowById) return rowById;
        }
        // Try by profiles.member_id (email)
        if (profile?.member_id) {
            const { data: row } = await supabaseAdmin
                .from('tasks')
                .select('Taskdom_History')
                .ilike('member_id', profile.member_id)
                .maybeSingle();
            if (row) return row;
        }
    } else {
        // Legacy email lookup
        const { data } = await supabaseAdmin
            .from('tasks')
            .select('Taskdom_History')
            .ilike('member_id', memberId)
            .maybeSingle();
        if (data) return data;
    }
    return null;
}

async function getRoutineStatus(memberId: string, tz: string) {
    // Get routine name from profiles — UUID uses id column, email uses member_id
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);
    const { data: profile } = isUuid
        ? await supabaseAdmin.from('profiles').select('routine').eq('id', memberId).maybeSingle()
        : await supabaseAdmin.from('profiles').select('routine').ilike('member_id', memberId).maybeSingle();

    const routine = profile?.routine || null;

    // Get Taskdom_History with legacy fallback
    const taskRow = await getTaskRow(memberId);

    let uploadedToday = false;
    let todayStatus = 'none';
    if (taskRow?.Taskdom_History) {
        try {
            const history = typeof taskRow.Taskdom_History === 'string'
                ? JSON.parse(taskRow.Taskdom_History)
                : taskRow.Taskdom_History;

            const now = new Date();
            const localHour = parseInt(
                new Intl.DateTimeFormat('en', { timeZone: tz, hour: '2-digit', hour12: false }).format(now),
                10
            );
            const windowDate = new Date(now);
            if (localHour < 6) windowDate.setDate(windowDate.getDate() - 1);
            const todayStr = windowDate.toLocaleDateString('en-CA', { timeZone: tz });

            const todaysRoutine = Array.isArray(history) && history.find((t: any) => {
                if (!t.isRoutine || !t.timestamp) return false;
                try {
                    // Check both local-window date and simple local date to handle midnight uploads
                    const localDate = new Date(t.timestamp).toLocaleDateString('en-CA', { timeZone: tz });
                    return localDate === todayStr;
                } catch { return false; }
            });

            if (todaysRoutine) {
                uploadedToday = true;
                const raw = (todaysRoutine.status || todaysRoutine.Status || 'pending').toLowerCase();
                todayStatus = raw === 'approve' ? 'approved' : raw === 'reject' ? 'rejected' : raw;
            }
        } catch (err) {
            console.error('Failed parsing Taskdom_History', err);
        }
    }

    return { routine, uploadedToday, todayStatus };
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const memberId = searchParams.get('memberId') || searchParams.get('email');
        if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 });
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
    try {
        const body = await req.json();
        const memberId = body.memberId || body.email;
        if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 });
        const tz = body.tz || 'UTC';
        const key = `routine:${memberId.toLowerCase()}`;
        const data = await cached(key, TTL, () => getRoutineStatus(memberId, tz));
        return NextResponse.json(data);
    } catch (err: any) {
        console.error('[routine-status]', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
