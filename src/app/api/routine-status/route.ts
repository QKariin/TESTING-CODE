import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { cached } from '@/lib/api-cache';

export const dynamic = "force-dynamic";

const TTL = 30_000; // 30s — routine status changes at most once per day

async function getRoutineStatus(memberId: string, tz: string) {
    // profiles.id = UUID, so look up by .eq('id', memberId)
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('routine')
        .eq('id', memberId)
        .maybeSingle();

    const routine = profile?.routine || null;

    // tasks.member_id = UUID, use .eq()
    const { data: taskRow } = await supabaseAdmin
        .from('tasks')
        .select('Taskdom_History')
        .eq('member_id', memberId)
        .maybeSingle();

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
                try { return new Date(t.timestamp).toLocaleDateString('en-CA', { timeZone: tz }) === todayStr; } catch { return false; }
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
        return NextResponse.json(data, { headers: { 'Cache-Control': 'private, max-age=30' } });
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
