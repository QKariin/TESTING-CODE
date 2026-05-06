import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCaller, isCEO } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isCEO(caller.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { memberId, newRoutine } = await req.json();
    if (!memberId || typeof newRoutine !== 'string') {
        return NextResponse.json({ error: 'memberId and newRoutine required' }, { status: 400 });
    }

    // Fetch current routine
    const { data: profile, error: fetchErr } = await supabaseAdmin
        .from('profiles')
        .select('routine, member_id, ID')
        .or(`ID.eq.${memberId},member_id.ilike.${memberId}`)
        .limit(1)
        .maybeSingle();

    if (fetchErr || !profile) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const oldRoutine = profile.routine || '';
    const trimmed = newRoutine.trim();

    // Update routine in profiles
    const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update({ routine: trimmed })
        .eq('ID', profile.ID);

    if (updateErr) {
        return NextResponse.json({ error: 'Update failed: ' + updateErr.message }, { status: 500 });
    }

    // Send ROUTINE_CHANGE card to chat
    const payload = JSON.stringify({ oldRoutine, newRoutine: trimmed });
    await supabaseAdmin.from('messages').insert({
        sender_email: caller.email,
        conversation_id: profile.ID,
        content: 'ROUTINE_CHANGE::' + payload,
        type: 'text',
    });

    return NextResponse.json({ success: true, oldRoutine, newRoutine: trimmed });
}
