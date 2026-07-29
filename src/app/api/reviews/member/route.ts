import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCaller, isCEO } from '@/lib/api-auth';
import { resolveIdentifier } from '@/lib/lookup';

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isCEO(caller.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get('memberId');
    if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 });

    try {
        // Resolve email
        const resolved = await resolveIdentifier(memberId);
        const email = (resolved.email || memberId).toLowerCase();

        const { data: reviews } = await supabaseAdmin
            .from('reviews')
            .select('id, text, rating, status, created_at')
            .ilike('member_id', email)
            .limit(1);

        return NextResponse.json({
            success: true,
            review: reviews && reviews.length > 0 ? reviews[0] : null,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
