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
        .from('user_routines')
        .select('history')
        .eq('member_id', email.toLowerCase())
        .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const history: any[] = data?.history || [];
    // Return in descending order, matching the old format
    const entries = [...history].reverse().map((e: any) => ({
        id: e.id,
        submitted_at: e.submitted_at,
        status: e.status,
        proof_url: e.proof_url,
        proof_type: e.proof_type || 'image',
        thumbnail_url: e.thumbnail_url,
    }));

    return NextResponse.json({ entries });
}
