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

const CEO_EMAILS = ['ceo@qkarin.com', 'queen@qkarin.com'];

// POST /api/auth/finalize
// Called after client-side exchangeCodeForSession succeeds.
// Checks profile existence, logs leads for new users.
// NOTE: A Supabase trigger (handle_new_user) may auto-create bare profiles on signup.
// We detect those (score=0, hierarchy='Hall Boy') and still capture them as leads.
export async function POST(req: Request) {
    try {
        const { email, userId, provider } = await req.json();
        if (!email) return NextResponse.json({ hasProfile: false });
        if (CEO_EMAILS.includes(email)) return NextResponse.json({ hasProfile: true });

        const admin = getAdmin();

        // Check if user has a profile (could be trigger-created or real)
        let profile: any = null;
        if (userId) {
            const { data } = await admin.from('profiles').select('ID, score, hierarchy, wallet').eq('ID', userId).maybeSingle();
            profile = data;
        }
        if (!profile && email) {
            const { data } = await admin.from('profiles').select('ID, score, hierarchy, wallet').ilike('member_id', email).maybeSingle();
            profile = data;
        }

        // Determine if this is a "real" member (has activity) vs bare trigger-created profile
        const isRealMember = profile && (
            Number(profile.score || 0) > 0 ||
            (profile.hierarchy && profile.hierarchy !== 'Hall Boy') ||
            (profile.wallet !== null && profile.wallet !== 5000 && profile.wallet !== undefined)
        );

        if (isRealMember) {
            console.log('[auth/finalize] existing member:', email);
            return NextResponse.json({ hasProfile: true });
        }

        // New user or bare trigger-created profile — log as lead
        console.log('[auth/finalize] new/bare user, logging lead:', email, 'provider:', provider, 'triggerProfile:', !!profile);
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

        // If trigger created a profile, they can still use the app — return hasProfile true
        // but they're tracked as a lead for the admin to see
        return NextResponse.json({ hasProfile: !!profile });
    } catch (err: any) {
        console.error('[auth/finalize] CATCH:', err.message, 'email:', err._email);
        return NextResponse.json({ hasProfile: false });
    }
}
