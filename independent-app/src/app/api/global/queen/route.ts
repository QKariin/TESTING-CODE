import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    const [{ count: totalSubjects }, { data: profiles }] = await Promise.all([
        supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('profiles').select('parameters, avatar_url, profile_picture_url'),
    ]);

    const totalTribute = (profiles || []).reduce((sum: number, p: any) => {
        let params: any = {};
        try { params = typeof p.parameters === 'string' ? JSON.parse(p.parameters) : (p.parameters || {}); } catch {}
        return sum + parseInt(params.total_coins_spent || 0);
    }, 0);

    return NextResponse.json({
        totalSubjects: totalSubjects || 0,
        totalTribute,
    });
}
