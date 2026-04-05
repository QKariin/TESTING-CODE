import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: challengeId } = await params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const memberEmail = user.email.toLowerCase();
        const { windowId, proofUrl } = await request.json();
        if (!windowId || !proofUrl)
            return NextResponse.json({ success: false, error: 'Missing windowId or proofUrl' }, { status: 400 });

        // Validate the window exists, belongs to this challenge, and is currently open
        const { data: win } = await supabaseAdmin
            .from('challenge_windows')
            .select('*')
            .eq('id', windowId)
            .eq('challenge_id', challengeId)
            .single();

        if (!win) return NextResponse.json({ success: false, error: 'Window not found' }, { status: 404 });

        const now = new Date();
        if (now < new Date(win.opens_at))
            return NextResponse.json({ success: false, error: 'Window not yet open' }, { status: 400 });
        if (now > new Date(win.closes_at))
            return NextResponse.json({ success: false, error: 'Window has closed' }, { status: 400 });

        // Member must be an active participant
        const { data: participant } = await supabaseAdmin
            .from('challenge_participants')
            .select('status')
            .eq('challenge_id', challengeId)
            .ilike('member_id', memberEmail)
            .single();

        if (!participant || participant.status !== 'active')
            return NextResponse.json({ success: false, error: 'Not an active participant' }, { status: 403 });

        // No duplicate submission for the same window
        const { data: existing } = await supabaseAdmin
            .from('challenge_completions')
            .select('id')
            .eq('challenge_id', challengeId)
            .eq('window_id', windowId)
            .ilike('member_id', memberEmail)
            .maybeSingle();

        if (existing)
            return NextResponse.json({ success: false, error: 'Already submitted for this window' }, { status: 400 });

        const responseTimeSecs = Math.floor((now.getTime() - new Date(win.opens_at).getTime()) / 1000);

        const { data: completion, error } = await supabaseAdmin
            .from('challenge_completions')
            .insert({
                challenge_id: challengeId,
                window_id: windowId,
                member_id: memberEmail,
                proof_url: proofUrl,
                completed_at: now.toISOString(),
                verified: false,
                response_time_seconds: responseTimeSecs,
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, completion, response_time_seconds: responseTimeSecs });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// GET — member checks challenge info, their participant status, and submissions
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: challengeId } = await params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const memberEmail = user.email.toLowerCase();

        const [{ data: challenge }, { data: windows }, { data: completions }, { data: participant }] = await Promise.all([
            supabaseAdmin.from('challenges')
                .select('id, name, theme, status, description, image_url, tasks_per_day, window_minutes, duration_days, start_date, end_date')
                .eq('id', challengeId).single(),
            supabaseAdmin.from('challenge_windows')
                .select('*').eq('challenge_id', challengeId).order('opens_at', { ascending: true }),
            supabaseAdmin.from('challenge_completions')
                .select('window_id, verified, completed_at, response_time_seconds')
                .eq('challenge_id', challengeId).ilike('member_id', memberEmail),
            supabaseAdmin.from('challenge_participants')
                .select('status, joined_at').eq('challenge_id', challengeId).ilike('member_id', memberEmail).maybeSingle(),
        ]);

        return NextResponse.json({
            success: true,
            challenge,
            windows: windows || [],
            completions: completions || [],
            participant: participant || null,  // null = not joined
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
