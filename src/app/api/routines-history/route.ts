import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCaller, isCEO } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const caller = await getCaller();
    if (!caller || !isCEO(caller.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

    const { data, error } = await supabaseAdmin
        .from('routines')
        .select('id, submitted_at, status, proof_url, proof_type, thumbnail_url')
        .eq('member_id', email.toLowerCase())
        .order('submitted_at', { ascending: false })
        .limit(200);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ entries: data || [] });
}
