// src/app/api/profile-update/route.ts
// Server-side profile update — uses supabaseAdmin to bypass RLS
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { memberEmail, field, value, cost } = body;

        if (!memberEmail || !field || value === undefined) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Whitelist of allowed fields
        const ALLOWED_FIELDS = ['avatar_url', 'limits', 'kinks', 'routine', 'name', 'lastKneelDate'];
        if (!ALLOWED_FIELDS.includes(field)) {
            return NextResponse.json({ error: 'Field not allowed' }, { status: 403 });
        }

        // If there's a coin cost, check and deduct wallet first
        if (cost && cost > 0) {
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('wallet')
                .eq('member_id', memberEmail)
                .maybeSingle();

            if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
            if ((profile.wallet || 0) < cost) {
                return NextResponse.json({ error: 'INSUFFICIENT_FUNDS', wallet: profile.wallet }, { status: 402 });
            }

            // Deduct wallet
            await supabaseAdmin
                .from('profiles')
                .update({ wallet: (profile.wallet || 0) - cost })
                .eq('member_id', memberEmail);
        }

        const { data, error } = await supabaseAdmin
            .from('profiles')
            .update({ [field]: value })
            .eq('member_id', memberEmail)
            .select('*')
            .maybeSingle();

        if (error) {
            console.error('[profile-update] error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, profile: data });
    } catch (err: any) {
        console.error('[profile-update] unexpected error:', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
