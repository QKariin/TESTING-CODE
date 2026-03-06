import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || 'today';

    const [{ data: tasks, error: tErr }, { data: profiles, error: pErr }] = await Promise.all([
        supabaseAdmin.from('tasks').select('member_id, kneelCount, "today kneeling"'),
        supabaseAdmin.from('profiles').select('email, name, hierarchy'),
    ]);

    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

    const profileMap = new Map((profiles || []).map((p: any) => [p.email, p]));

    const todayStr = new Date().toISOString().split('T')[0];

    interface LeaderboardEntry {
        email: string;
        name: string;
        hierarchy: string;
        kneelCount: number;
        todayHours: number;
    }

    const entries: LeaderboardEntry[] = (tasks || []).map((t: any) => {
        const prof = profileMap.get(t.member_id) || {};
        let todayHours = 0;
        try {
            const tk = typeof t['today kneeling'] === 'string'
                ? JSON.parse(t['today kneeling'])
                : t['today kneeling'];
            if (tk?.date === todayStr) todayHours = parseFloat(tk.hours || 0);
        } catch { }

        return {
            email: t.member_id,
            name: (prof as any).name || t.member_id?.split('@')[0] || 'SUBJECT',
            hierarchy: (prof as any).hierarchy || '—',
            kneelCount: parseInt(t.kneelCount || 0),
            todayHours,
        };
    });

    if (period === 'today') {
        entries.sort((a: LeaderboardEntry, b: LeaderboardEntry) => b.todayHours - a.todayHours);
        return NextResponse.json({ entries: entries.filter(e => e.todayHours > 0).slice(0, 20) });
    } else {
        entries.sort((a: LeaderboardEntry, b: LeaderboardEntry) => b.kneelCount - a.kneelCount);
        return NextResponse.json({ entries: entries.filter(e => e.kneelCount > 0).slice(0, 20) });
    }
}
