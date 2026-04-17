import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

function parseNum(val: any): number {
    if (val === null || val === undefined || val === '') return 0;
    const n = Number(val);
    return isNaN(n) ? 0 : n;
}

function parseTributeHistory(val: any): number {
    if (!val) return 0;
    try {
        const arr = typeof val === 'string' ? JSON.parse(val) : val;
        if (Array.isArray(arr)) {
            // amounts can be negative (expense entries) or positive (older format) - sum absolute values
            return arr.reduce((sum: number, item: any) => {
                const raw = typeof item === 'number' ? item : parseNum(item?.amount ?? item?.coins ?? item?.value ?? 0);
                return sum + Math.abs(raw);
            }, 0);
        }
        return parseNum(arr);
    } catch {
        return parseNum(val);
    }
}

export async function GET() {
    const [{ data: tasks }, { data: profiles }] = await Promise.all([
        supabaseAdmin.from('tasks').select('*'),
        supabaseAdmin.from('profiles').select('*'),
    ]);

    // profiles keyed by member_id (which is the email address)
    const profileMap = new Map((profiles || []).map((p: any) => [p.member_id?.toLowerCase(), p]));

    const kneelers: any[] = [];
    const spenders: any[] = [];
    const streakers: any[] = [];

    for (const t of (tasks || [])) {
        const prof: any = profileMap.get(t.member_id?.toLowerCase()) || {};
        const base = {
            name: prof.name || t.Name || t.member_id?.split('@')[0] || 'SUBJECT',
            hierarchy: prof.hierarchy || t.Hierarchy || '-',
            avatar: prof.avatar_url || '',
        };

        const count = parseNum(t.kneelCount);
        if (count > 0) kneelers.push({ ...base, count });

        // Tribute History from tasks; fallback to profiles.parameters.total_coins_spent
        let amount = parseTributeHistory(t['Tribute History']);
        if (amount === 0) {
            let params: any = {};
            try { params = typeof prof.parameters === 'string' ? JSON.parse(prof.parameters) : (prof.parameters || {}); } catch { }
            amount = parseNum(params.wishlist_spent);
        }
        if (amount > 0) spenders.push({ ...base, amount });

        const streak = parseNum(t.Taskdom_Streak);
        if (streak > 0) streakers.push({ ...base, streak });
    }

    kneelers.sort((a, b) => b.count - a.count);
    spenders.sort((a, b) => b.amount - a.amount);
    streakers.sort((a, b) => b.streak - a.streak);

    return NextResponse.json({
        kneelers: kneelers.slice(0, 3),
        spenders: spenders.slice(0, 3),
        streakers: streakers.slice(0, 3),
    });
}
