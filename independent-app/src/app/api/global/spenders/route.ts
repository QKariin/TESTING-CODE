import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    const { data: profiles, error } = await supabaseAdmin
        .from('profiles')
        .select('email, name, hierarchy, parameters');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const entries = (profiles || []).map((p: any) => {
        let params: any = {};
        try { params = typeof p.parameters === 'string' ? JSON.parse(p.parameters) : (p.parameters || {}); } catch {}
        const totalSpent = parseInt(params.total_coins_spent || 0);
        return {
            email: p.email,
            name: p.name || p.email?.split('@')[0] || 'SUBJECT',
            hierarchy: p.hierarchy || '—',
            totalSpent,
        };
    }).filter(e => e.totalSpent > 0);

    entries.sort((a, b) => b.totalSpent - a.totalSpent);
    return NextResponse.json({ entries: entries.slice(0, 20) });
}
