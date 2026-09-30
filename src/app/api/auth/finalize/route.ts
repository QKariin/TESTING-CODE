import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

// POST /api/auth/finalize
// Called after client-side exchangeCodeForSession succeeds.
// Checks profile existence, logs leads for new users.
export async function POST(req: Request) {
    try {
        const { email, userId, provider } = await req.json();
        if (!email) return NextResponse.json({ hasProfile: false });

        const admin = getAdmin();

        const { data: profile } = await admin
            .from('profiles')
            .select('ID')
            .or(`ID.eq.${userId}${email ? `,member_id.ilike.${email}` : ''}`)
            .limit(1)
            .maybeSingle();

        if (profile) {
            console.log('[auth/finalize] existing member:', email);
            return NextResponse.json({ hasProfile: true });
        }

        // No profile — log as lead
        console.log('[auth/finalize] no profile found, logging lead:', email, 'provider:', provider);
        const now = new Date().toISOString();
        const { data: existing, error: selectErr } = await admin.from('leads').select('id, attempts').eq('email', email).maybeSingle();
        if (selectErr) console.error('[auth/finalize] leads select error:', selectErr.message);
        if (existing) {
            const { error: updErr } = await admin.from('leads').update({ last_seen: now, attempts: (existing.attempts || 1) + 1 }).eq('email', email);
            if (updErr) console.error('[auth/finalize] leads update error:', updErr.message);
        } else {
            const { error: insErr } = await admin.from('leads').insert({ email, provider: provider || 'unknown', first_seen: now, last_seen: now, attempts: 1 });
            if (insErr) console.error('[auth/finalize] leads insert error:', insErr.message);
        }

        return NextResponse.json({ hasProfile: false });
    } catch (err: any) {
        console.error('[auth/finalize] CATCH:', err.message, 'email:', err._email);
        return NextResponse.json({ hasProfile: false });
    }
}
