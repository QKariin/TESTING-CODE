import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function toDay(d: Date): string {
    const adjusted = new Date(d);
    if (adjusted.getUTCHours() < 6) adjusted.setUTCDate(adjusted.getUTCDate() - 1);
    return adjusted.toISOString().split('T')[0];
}

function calcConsistency(routineHistory: string[]): number {
    if (!routineHistory || routineHistory.length === 0) return 0;

    // Sort timestamps descending (newest first)
    const sorted = [...routineHistory]
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

    // Walk backwards from the most recent day, counting consecutive days
    let streak = 1;
    for (let i = 1; i < days.length; i++) {
        const prev = new Date(days[i - 1] + 'T12:00:00Z');
        const curr = new Date(days[i] + 'T12:00:00Z');
        const diffMs = prev.getTime() - curr.getTime();
        const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
        if (diffDays === 1) {
            streak++;
        } else {
            break;
        }
    }

    // Check if the most recent day is today or yesterday — if not, streak is broken
    const now = new Date();
    const todayDay = toDay(now);
    const yesterdayDate = new Date(now);
    yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
    const yesterdayDay = toDay(yesterdayDate);

    if (days[0] !== todayDay && days[0] !== yesterdayDay) {
        return 0; // streak is broken
    }

    return streak;
}

export async function POST() {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: profiles, error } = await supabaseAdmin
        .from('profiles')
        .select('ID, member_id, routine_history, parameters');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let updated = 0;
    const results: { email: string; consistency: number }[] = [];

    for (const p of (profiles || [])) {
        const history: string[] = Array.isArray(p.routine_history) ? p.routine_history : [];
        const consistency = calcConsistency(history);
        const params = p.parameters || {};

        await supabaseAdmin
            .from('profiles')
            .update({ parameters: { ...params, consistency } })
            .eq('ID', p.ID);

        results.push({ email: p.member_id, consistency });
        updated++;
    }

    return NextResponse.json({ success: true, updated, results });
}
