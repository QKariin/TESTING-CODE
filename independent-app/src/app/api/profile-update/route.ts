// src/app/api/profile-update/route.ts
// Server-side profile update — uses supabaseAdmin to bypass RLS
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { memberEmail, field, value } = body;

        if (!memberEmail || !field || value === undefined) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Whitelist of allowed fields (security: don't let client update anything)
        const ALLOWED_FIELDS = ['avatar_url', 'limits', 'kinks', 'routine', 'name'];
        if (!ALLOWED_FIELDS.includes(field)) {
            return NextResponse.json({ error: 'Field not allowed' }, { status: 403 });
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
    } catch (err) {
        console.error('[profile-update] unexpected error:', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
