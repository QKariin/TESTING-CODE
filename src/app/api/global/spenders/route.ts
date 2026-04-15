import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    const { data: profiles, error } = await supabaseAdmin
        .from('profiles')
        .select('ID, name, hierarchy, parameters');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    interface SpenderEntry {
        name: string;
        hierarchy: string;
        totalSpent: number;
        member_number: string | null;
    }

    const entries: SpenderEntry[] = (profiles || []).map((p: any) => {
        let params: any = {};
        try { params = typeof p.parameters === 'string' ? JSON.parse(p.parameters) : (p.parameters || {}); } catch { }
        const totalSpent = parseInt(params.wishlist_spent || 0);
        return {
            name: p.name || 'SUBJECT',
            hierarchy: p.hierarchy || '-',
            totalSpent,
            member_number: p.ID || null,
        };
    }).filter((e: SpenderEntry) => e.totalSpent > 0);

    entries.sort((a: SpenderEntry, b: SpenderEntry) => b.totalSpent - a.totalSpent);
    return NextResponse.json({ entries: entries.slice(0, 20) });
}
