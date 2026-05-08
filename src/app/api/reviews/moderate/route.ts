import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCaller, isCEO } from '@/lib/api-auth';

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isCEO(caller.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    try {
        const { memberId, action } = await req.json();
        if (!memberId || !action) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        if (action !== 'approve' && action !== 'reject') return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

        // Resolve email
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);
        let email = memberId.toLowerCase();

        if (isUUID) {
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('member_id')
                .eq('ID', memberId)
                .single();
            if (profile?.member_id) email = profile.member_id.toLowerCase();
        }

        const newStatus = action === 'approve' ? 'approved' : 'rejected';
        const { error } = await supabaseAdmin
            .from('reviews')
            .update({ status: newStatus })
            .ilike('member_id', email);

        if (error) throw error;

        return NextResponse.json({ success: true, status: newStatus });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
