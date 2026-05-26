import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';
import { DbService } from '@/lib/supabase-service';

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

    // Insert a checkpoint routine entry (auto-approved)
    const { error } = await supabaseAdmin.from('routines').insert({
        member_id: email,
        submitted_at: new Date().toISOString(),
        status: 'approve',
        proof_url: 'CHECKPOINT',
        date: todayStr,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Recalculate consistency so the streak is preserved immediately
    try { await DbService.recalcConsistency(email, tz); } catch (_) { }

    return NextResponse.json({ success: true });
}
