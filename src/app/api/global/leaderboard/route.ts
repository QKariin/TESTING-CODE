import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { mapUserProfile } from '@/lib/mapUserProfile';

export const dynamic = 'force-dynamic';

function parseNum(val: any): number {
    if (val === null || val === undefined || val === '') return 0;
    const n = Number(val);
    return isNaN(n) ? 0 : n;
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || 'today';

    const colKey = period === 'weekly' ? 'Weekly Score'
        : period === 'monthly' ? 'Monthly Score'
        : period === 'alltime' ? 'Score'
        : 'Daily Score';

    const [{ data: tasks, error }, { data: profiles, error: profErr }] = await Promise.all([
        supabaseAdmin
            .from('tasks')
            .select(`member_id, "ID", "Name", "Hierarchy", "Daily Score", "Weekly Score", "Monthly Score", "Score"`),
        supabaseAdmin
            .from('profiles')
            .select('*'),
    ]);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (profErr) console.error('[leaderboard] profiles query error:', profErr.message);

    // profiles keyed by member_id (email) AND by ID (UUID)
    const profileByEmail = new Map<string, any>();
    const profileByUuid = new Map<string, any>();
    (profiles || []).forEach((p: any) => {
        if (p.member_id) profileByEmail.set(p.member_id.toLowerCase(), p);
        if (p.ID) profileByUuid.set(p.ID.toLowerCase(), p);
    });

    const entries = (tasks || [])
        .map((t: any) => {
            const key = (t.member_id || '').toLowerCase();
            const taskUuid = (t.ID || '').toLowerCase();
            const prof: any = profileByEmail.get(key) || profileByUuid.get(taskUuid) || profileByUuid.get(key) || {};

            if (prof?.parameters?.isDemo) return null;

            // Use the same mapUserProfile that the dashboard uses — guarantees same avatar logic
            const mapped = mapUserProfile(prof, t);

            return {
                name: mapped.name || t.Name || 'SUBJECT',
                hierarchy: mapped.hierarchy || 'Hall Boy',
                avatar: mapped.avatar || '',
                score: parseNum(t[colKey]),
                member_number: prof.ID || null,
            };
        })
        .filter((e: any) => e && e.score > 0)
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 10);

    return NextResponse.json({ entries, period });
}
