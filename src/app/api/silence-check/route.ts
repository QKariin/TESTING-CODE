import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { findProfile, identifierFilter } from '@/lib/lookup';

// No auth required - only returns silence boolean + reason for the requesting user.
// Uses supabaseAdmin to bypass RLS so it always works regardless of session state.
export async function POST(req: NextRequest) {
    try {
        const { memberId } = await req.json();
        if (!memberId) return NextResponse.json({ silence: false, reason: '' });

        const data = await findProfile(memberId, 'silence, paywall, hierarchy, parameters');

        // If paywalled, stamp last_seen — fire and forget, no await
        if (data?.paywall === true) {
            const f = identifierFilter(memberId);
            supabaseAdmin
                .from('profiles')
                .update({ parameters: { ...(data.parameters || {}), last_seen: new Date().toISOString() } })
                [f.method](f.column, f.value)
                .then(() => {}).catch(() => {});
        }

        return NextResponse.json({
            silence: data?.silence === true,
            reason: data?.parameters?.silence_reason || '',
            paywall: data?.paywall === true,
            paywallReason: data?.parameters?.paywall?.reason || '',
            paywallAmount: data?.parameters?.paywall?.amount || 0,
            hierarchy: data?.hierarchy || 'Hall Boy',
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch {
        return NextResponse.json({ silence: false, reason: '' });
    }
}
