import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// No auth required — only returns silence boolean + reason for the requesting user.
// Uses supabaseAdmin to bypass RLS so it always works regardless of session state.
export async function POST(req: NextRequest) {
    try {
        const { memberId } = await req.json();
        if (!memberId) return NextResponse.json({ silence: false, reason: '' });

        const { data } = await supabaseAdmin
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
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch {
        return NextResponse.json({ silence: false, reason: '' });
    }
}
