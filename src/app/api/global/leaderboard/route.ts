import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

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
            .select(`member_id, ID, Name, Hierarchy, "Daily Score", "Weekly Score", "Monthly Score", "Score"`),
        supabaseAdmin
            .from('profiles')
            .select('member_id, id, name, hierarchy, avatar_url, parameters'),
    ]);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (profErr) console.error('[leaderboard] profiles query error:', profErr.message);

    // profiles keyed by member_id (email) AND by id (UUID) for robust matching
    const profileByEmail = new Map<string, any>();
    const profileByUuid = new Map<string, any>();
    (profiles || []).forEach((p: any) => {
        if (p.member_id) profileByEmail.set(p.member_id.toLowerCase(), p);
        if (p.id) profileByUuid.set(p.id.toLowerCase(), p);
    });

    function getAvatar(prof: any): string {
        if (!prof) return '';
        const params = prof.parameters || {};
        return prof.avatar_url || params.avatar_url || params.photoUrl || '';
    }

    interface LeaderboardEntry {
        name: string;
        hierarchy: string;
        avatar: string;
        score: number;
        member_number: string | null;
    }

    const entries: LeaderboardEntry[] = (tasks || [])
        .map((t: any) => {
            const key = (t.member_id || '').toLowerCase();
            const taskUuid = (t.ID || '').toLowerCase();
            const prof: any = profileByEmail.get(key) || profileByUuid.get(taskUuid) || profileByUuid.get(key) || {};
            return {
                name: prof.name || t.Name || t.member_id?.split('@')[0] || 'SUBJECT',
                hierarchy: prof.hierarchy || t.Hierarchy || 'Hall Boy',
                avatar: getAvatar(prof),
                score: parseNum(t[colKey]),
                member_number: prof.id || null,
            };
        })
        .filter((e: LeaderboardEntry) => e.score > 0)
        .sort((a: LeaderboardEntry, b: LeaderboardEntry) => b.score - a.score)
        .slice(0, 10);

    return NextResponse.json({ entries, period });
}
