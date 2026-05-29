import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Backfills profiles.parameters consistency/streak from user_routines
async function runBackfill() {
    const { data: userRoutines, error } = await supabaseAdmin
        .from('user_routines')
        .select('member_id, current_streak, best_streak');

    if (error) return { error: error.message };

    let updated = 0;
    const results: { email: string; consistency: number }[] = [];

    for (const ur of (userRoutines || [])) {
        try {
            const { data: prof } = await supabaseAdmin
                .from('profiles')
                .select('ID, parameters')
                .ilike('member_id', ur.member_id)
                .maybeSingle();
            if (!prof) continue;

            const params = prof.parameters || {};
            params.consistency = ur.current_streak || 0;
            params.routine_streak = ur.best_streak || 0;
            params.taskdom_current_streak = ur.current_streak || 0;

            await supabaseAdmin.from('profiles').update({
                parameters: params,
                bestRoutinestreak: ur.best_streak || 0,
                routinestreak: ur.current_streak || 0,
            }).eq('ID', prof.ID);

            results.push({ email: ur.member_id, consistency: ur.current_streak || 0 });
            updated++;
        } catch (e: any) {
            console.warn('[backfill] error for', ur.member_id, e?.message || e);
            results.push({ email: ur.member_id, consistency: -1 });
        }
    }

    return { success: true, updated, results };
}

export async function POST() {
    const result = await runBackfill();
    return NextResponse.json(result);
}

export async function GET() {
    const result = await runBackfill();
    return NextResponse.json(result);
}
