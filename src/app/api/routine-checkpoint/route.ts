import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';

async function getCallerEmail(): Promise<string | null> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        let email = user?.email?.toLowerCase() || null;
        if (!email && user?.id) {
            const { data: p } = await supabaseAdmin.from('profiles').select('member_id').eq('ID', user.id).maybeSingle();
            if (p?.member_id) email = p.member_id.toLowerCase();
        }
        return email;
    } catch { return null; }
}

export async function POST(request: NextRequest) {
    const callerEmail = await getCallerEmail();
    if (!callerEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { memberId } = await request.json();
    if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 });

    // Look up profile
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);
    const { data: profile } = isUuid
        ? await supabaseAdmin.from('profiles').select('member_id, timezone').eq('ID', memberId).maybeSingle()
        : await supabaseAdmin.from('profiles').select('member_id, timezone').ilike('member_id', memberId).maybeSingle();

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const email = (profile.member_id || '').toLowerCase();
    const tz = profile.timezone || 'UTC';

    // Calculate today's date in user's timezone
    const now = new Date();
    const localHour = parseInt(
        new Intl.DateTimeFormat('en', { timeZone: tz, hour: '2-digit', hour12: false }).format(now), 10
    );
    const windowDate = new Date(now);
    if (localHour < 6) windowDate.setDate(windowDate.getDate() - 1);
    const todayStr = windowDate.toLocaleDateString('en-CA', { timeZone: tz });

    // Insert a checkpoint into user_routines history (auto-approved)
    const nowIso = new Date().toISOString();
    const checkpointEntry = {
        id: Date.now().toString(),
        date: todayStr,
        submitted_at: nowIso,
        status: 'approve',
        proof_url: 'CHECKPOINT',
        proof_type: 'image',
        thumbnail_url: null,
        points_awarded: 0,
    };

    const { data: userRoutine } = await supabaseAdmin
        .from('user_routines')
        .select('*')
        .eq('member_id', email)
        .maybeSingle();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (userRoutine) {
        const history = [...(userRoutine.history || []), checkpointEntry];
        const lastApproved = userRoutine.last_approved_date;
        let newStreak = 1;
        if (lastApproved === yesterdayStr || lastApproved === todayStr) {
            newStreak = (userRoutine.current_streak || 0) + 1;
        }
        const newBest = Math.max(newStreak, userRoutine.best_streak || 0);

        const { error } = await supabaseAdmin
            .from('user_routines')
            .update({
                history,
                current_streak: newStreak,
                best_streak: newBest,
                last_approved_date: todayStr,
                pending_id: null,
                pending_proof_url: null,
                pending_proof_type: null,
                pending_thumbnail_url: null,
                pending_submitted_at: null,
                updated_at: nowIso,
            })
            .eq('member_id', email);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
        const { error } = await supabaseAdmin
            .from('user_routines')
            .insert({
                member_id: email,
                routine_name: 'Daily Routine',
                history: [checkpointEntry],
                current_streak: 1,
                best_streak: 1,
                last_approved_date: todayStr,
            });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update profiles.parameters for backward compat
    try {
        const { data: prof } = await supabaseAdmin.from('profiles').select('ID, parameters').ilike('member_id', email).maybeSingle();
        if (prof) {
            const ur = userRoutine;
            const streak = ur ? Math.max(1, (ur.last_approved_date === yesterdayStr || ur.last_approved_date === todayStr) ? (ur.current_streak || 0) + 1 : 1) : 1;
            const best = Math.max(streak, ur?.best_streak || 0);
            const params = prof.parameters || {};
            params.consistency = streak;
            params.routine_streak = best;
            params.taskdom_current_streak = streak;
            await supabaseAdmin.from('profiles').update({ parameters: params }).eq('ID', prof.ID);
        }
    } catch (_) { }

    return NextResponse.json({ success: true });
}
