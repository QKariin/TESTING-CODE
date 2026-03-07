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
        : period === 'alltime' ? 'Taskdom_Points'
        : 'Daily Score';

    const [{ data: tasks, error }, { data: profiles }] = await Promise.all([
        supabaseAdmin
            .from('tasks')
            .select(`member_id, Name, Hierarchy, "Profile pic", "Daily Score", "Weekly Score", "Monthly Score", Taskdom_Points`),
        supabaseAdmin
            .from('profiles')
            .select('member_id, hierarchy, avatar_url'),
    ]);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // profiles keyed by member_id (which is the email address)
    const profileMap = new Map((profiles || []).map((p: any) => [p.member_id?.toLowerCase(), p]));

    interface LeaderboardEntry {
        email: string;
        name: string;
        hierarchy: string;
        avatar: string;
        score: number;
    }

    const entries: LeaderboardEntry[] = (tasks || [])
        .map((t: any) => {
            const prof: any = profileMap.get(t.member_id?.toLowerCase()) || {};
            return {
                email: t.member_id,
                name: t.Name || t.member_id?.split('@')[0] || 'SUBJECT',
                hierarchy: prof.hierarchy || t.Hierarchy || '—',
                avatar: prof.avatar_url || t['Profile pic'] || '',
                score: parseNum(t[colKey]),
            };
        })
        .filter((e: LeaderboardEntry) => e.score > 0)
        .sort((a: LeaderboardEntry, b: LeaderboardEntry) => b.score - a.score)
        .slice(0, 10);

    return NextResponse.json({ entries, period });
}
