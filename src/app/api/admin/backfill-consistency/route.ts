import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function toDay(d: Date): string {
    const adjusted = new Date(d);
    if (adjusted.getUTCHours() < 6) adjusted.setUTCDate(adjusted.getUTCDate() - 1);
    return adjusted.toISOString().split('T')[0];
}

function calcConsistency(timestamps: string[]): number {
    if (!timestamps || timestamps.length === 0) return 0;

    const sorted = [...timestamps]
        .map(ts => new Date(ts))
        .filter(d => !isNaN(d.getTime()))
        .sort((a, b) => b.getTime() - a.getTime());

    if (sorted.length === 0) return 0;

    // Deduplicate by duty day
    const days: string[] = [];
    for (const d of sorted) {
        const day = toDay(d);
        if (days.length === 0 || days[days.length - 1] !== day) {
            days.push(day);
        }
    }

    // Check if the most recent day is today or yesterday
    const now = new Date();
    const todayDay = toDay(now);
    const yesterdayDate = new Date(now);
    yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
    const yesterdayDay = toDay(yesterdayDate);

    if (days[0] !== todayDay && days[0] !== yesterdayDay) {
        return 0;
    }

    // Walk from most recent, counting consecutive days
    let streak = 1;
    for (let i = 1; i < days.length; i++) {
        const prev = new Date(days[i - 1] + 'T12:00:00Z');
        const curr = new Date(days[i] + 'T12:00:00Z');
        const diffDays = Math.round((prev.getTime() - curr.getTime()) / (24 * 60 * 60 * 1000));
        if (diffDays === 1) {
            streak++;
        } else {
            break;
        }
    }

    return streak;
}

export async function POST() {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get all profiles
    const { data: profiles, error: profErr } = await supabaseAdmin
        .from('profiles')
        .select('ID, member_id, parameters');

    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });

    let updated = 0;
    const results: { email: string; consistency: number; routineUploads: number }[] = [];

    for (const p of (profiles || [])) {
        const email = (p.member_id || '').toLowerCase();

        // Read routine history from the dedicated routines table
        const { data: routines } = await supabaseAdmin
            .from('routines')
            .select('submitted_at')
            .eq('member_id', email)
            .neq('status', 'reject')
            .order('submitted_at', { ascending: false });

        const timestamps = (routines || []).map((r: any) => r.submitted_at);
        const consistency = calcConsistency(timestamps);
        const params = p.parameters || {};

        const bestStreak = Math.max(consistency, Number(params.routine_streak || 0));
        await supabaseAdmin
            .from('profiles')
            .update({
                parameters: { ...params, consistency, routine_streak: bestStreak, taskdom_current_streak: consistency },
            })
            .eq('ID', p.ID);

        results.push({ email, consistency, routineUploads: timestamps.length });
        updated++;
    }

    return NextResponse.json({ success: true, updated, results });
}
