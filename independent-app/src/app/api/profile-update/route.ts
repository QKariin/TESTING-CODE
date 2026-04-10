// src/app/api/profile-update/route.ts
// Server-side profile update — uses supabaseAdmin to bypass RLS
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DbService } from '@/lib/supabase-service';
import { getCallerEmail, isCEO } from '@/lib/api-auth';

export const dynamic = "force-dynamic";

export async function OPTIONS() {
    return NextResponse.json({}, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}

export async function POST(req: Request) {
    const caller = await getCallerEmail();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const { memberEmail, field, value, cost } = body;

        if (!memberEmail || !field || value === undefined) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (!isCEO(caller) && caller !== memberEmail.toLowerCase()) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
                .ilike('member_id', memberEmail)
                .maybeSingle();

            if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
            if ((profile.wallet || 0) < cost) {
                return NextResponse.json({ error: 'INSUFFICIENT_FUNDS', wallet: profile.wallet }, { status: 402 });
            }

            // Deduct wallet
            await supabaseAdmin
                .from('profiles')
                .update({ wallet: (profile.wallet || 0) - cost })
                .ilike('member_id', memberEmail);
        }

        const { error } = await supabaseAdmin
            .from('profiles')
            .update({ [field]: value })
            .ilike('member_id', memberEmail);

        // Fetch updated profile separately
        const { data } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .ilike('member_id', memberEmail)
            .maybeSingle();

        if (error) {
            console.error('[profile-update] error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const logMap: Record<string, string> = {
            avatar_url: 'PHOTO UPDATED',
            limits: 'LIMITS UPDATED',
            kinks: 'KINKS UPDATED',
            routine: 'ROUTINE UPDATED',
            name: 'NAME UPDATED',
        };
        if (logMap[field]) {
            try { await DbService.sendMessage(memberEmail, logMap[field], 'system'); } catch (_) { }
        }

        return NextResponse.json({ success: true, profile: data });
    } catch (err: any) {
        console.error('[profile-update] unexpected error:', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
