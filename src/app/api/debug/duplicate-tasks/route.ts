import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = ['ceo@qkarin.com'];

// GET /api/debug/duplicate-tasks
// Finds users with multiple task rows (score data could be split/lost)
//
// GET /api/debug/duplicate-tasks?fix=true
// Merges duplicate rows: keeps the one with highest scores, deletes the other
export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let callerEmail = user.email?.toLowerCase() || '';
    if (!callerEmail) {
        const { data: p } = await supabaseAdmin.from('profiles').select('member_id').eq('ID', user.id).maybeSingle();
        callerEmail = p?.member_id?.toLowerCase() || '';
    }
    if (!ADMIN_EMAILS.includes(callerEmail)) {
        return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const doFix = searchParams.get('fix') === 'true';

    // Fetch all task rows
    const { data: tasks, error } = await supabaseAdmin
        .from('tasks')
        .select('"ID", member_id, "Score", "Daily Score", "Weekly Score", "Monthly Score", "Yearly Score", kneelCount, "Taskdom_CompletedTasks", lastWorship');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Group by member_id (email)
    const byEmail = new Map<string, any[]>();
    for (const t of tasks || []) {
        const key = (t.member_id || '').toLowerCase();
        if (!key) continue;
        if (!byEmail.has(key)) byEmail.set(key, []);
        byEmail.get(key)!.push(t);
    }

    const duplicates: any[] = [];
    const fixed: any[] = [];

    for (const [email, rows] of byEmail) {
        if (rows.length <= 1) continue;

        // Find the profile's current UUID
        const { data: prof } = await supabaseAdmin.from('profiles').select('ID').ilike('member_id', email).maybeSingle();
        const profileUuid = prof?.ID || '';

        duplicates.push({
            email,
            profileUuid,
            rows: rows.map(r => ({
                ID: r.ID,
                isProfileMatch: r.ID === profileUuid,
                Score: r.Score,
                DailyScore: r['Daily Score'],
                WeeklyScore: r['Weekly Score'],
                kneelCount: r.kneelCount,
                lastWorship: r.lastWorship,
            })),
        });

        if (doFix && profileUuid) {
            // Pick the row that matches the profile UUID as the keeper
            const keeper = rows.find(r => r.ID === profileUuid) || rows[0];
            const others = rows.filter(r => r.ID !== keeper.ID);

            // Merge: take MAX of each score column from all rows
            const mergedScores: Record<string, number> = {};
            for (const col of ['Score', 'Daily Score', 'Weekly Score', 'Monthly Score', 'Yearly Score']) {
                mergedScores[col] = Math.max(...rows.map(r => Number(r[col] || 0)));
            }
            const mergedKneel = Math.max(...rows.map(r => Number(r.kneelCount || 0)));

            // Update keeper with merged scores
            await supabaseAdmin.from('tasks').update({
                ...mergedScores,
                kneelCount: String(mergedKneel),
                ID: profileUuid, // ensure ID matches profile
            }).eq('ID', keeper.ID);

            // Delete duplicates
            for (const dup of others) {
                await supabaseAdmin.from('tasks').delete().eq('ID', dup.ID);
            }

            fixed.push({ email, kept: keeper.ID, deleted: others.map(r => r.ID), mergedScores });
        }
    }

    return NextResponse.json({
        duplicateCount: duplicates.length,
        duplicates,
        ...(doFix ? { fixed } : {}),
    });
}
