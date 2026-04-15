import { NextResponse } from 'next/server';
import { createClient as createAdmin } from '@supabase/supabase-js';

export async function POST(req: Request) {
    try {
        const { memberId, reason } = await req.json();
        if (!memberId || !reason) return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });

        const admin = createAdmin(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: profile, error: fetchErr } = await admin
            .from('profiles')
            .select('ID, parameters')
            .ilike('member_id', memberId)
            .maybeSingle();

        if (fetchErr || !profile) return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });

        const params = profile.parameters || {};
        params.silence_reason = reason;

        const { error: updateErr } = await admin
            .from('profiles')
            .update({ silence: true, parameters: params })
            .eq('ID', profile.ID);

        if (updateErr) return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
