import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdmin } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    try {
        const { memberId } = await req.json();
        if (!memberId) return NextResponse.json({ silence: false, reason: '' });

        const admin = createAdmin(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data } = await admin
            .from('profiles')
            .select('silence, paywall, parameters')
            .ilike('member_id', memberId)
            .maybeSingle();

        return NextResponse.json({
            silence: data?.silence === true,
            reason: data?.parameters?.silence_reason || '',
            paywall: data?.paywall === true,
            paywallReason: data?.parameters?.paywall?.reason || '',
            paywallAmount: data?.parameters?.paywall?.amount || 0,
        });
    } catch {
        return NextResponse.json({ silence: false, reason: '' });
    }
}
