import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCallerEmail, isCEO } from '@/lib/api-auth';

export const dynamic = "force-dynamic";

async function getRoutineStatus(memberEmail: string, tz: string) {
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('routine')
        .ilike('member_id', memberEmail)
        .maybeSingle();

    const routine = profile?.routine || null;

    const { data: taskRow } = await supabaseAdmin
        .from('tasks')
        .select('Taskdom_History')
        .ilike('member_id', memberEmail)
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
    const caller = await getCallerEmail();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(req.url);
        const memberEmail = searchParams.get('email');
        if (!memberEmail) return NextResponse.json({ error: 'Missing email' }, { status: 400 });
        if (!isCEO(caller) && caller !== memberEmail.toLowerCase()) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const tz = searchParams.get('tz') || 'UTC';
        return NextResponse.json(await getRoutineStatus(memberEmail, tz));
    } catch (err: any) {
        console.error('[routine-status]', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const caller = await getCallerEmail();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const memberEmail = body.email;
        if (!memberEmail) return NextResponse.json({ error: 'Missing email' }, { status: 400 });
        if (!isCEO(caller) && caller !== memberEmail.toLowerCase()) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const tz = body.tz || 'UTC';
        return NextResponse.json(await getRoutineStatus(memberEmail, tz));
    } catch (err: any) {
        console.error('[routine-status]', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
