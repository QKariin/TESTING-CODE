import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: challengeId } = await params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const memberId = user.id;
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
            .eq('member_id', memberId)
            .single();

        if (!participant || participant.status !== 'active')
            return NextResponse.json({ success: false, error: 'Not an active participant' }, { status: 403 });

        // No duplicate submission for the same window
        const { data: existing } = await supabaseAdmin
            .from('challenge_completions')
            .select('id')
            .eq('challenge_id', challengeId)
            .eq('window_id', windowId)
            .eq('member_id', memberId)
            .maybeSingle();

        if (existing)
            return NextResponse.json({ success: false, error: 'Already submitted for this window' }, { status: 400 });

        const responseTimeSecs = Math.floor((now.getTime() - new Date(win.opens_at).getTime()) / 1000);

        const { data: completion, error } = await supabaseAdmin
            .from('challenge_completions')
            .insert({
                challenge_id: challengeId,
                window_id: windowId,
                member_id: memberId,
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

// GET - member challenge data: status, stats, windows, gallery
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: challengeId } = await params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const memberId = user.id;

        const [{ data: challenge }, { data: windows }, { data: myCompletions }, { data: participant }] = await Promise.all([
            supabaseAdmin.from('challenges')
                .select('id, name, theme, status, description, image_url, tasks_per_day, window_minutes, duration_days, start_date, end_date, points_per_completion, first_place_points, second_place_points, third_place_points, task_names')
                .eq('id', challengeId).single(),
            supabaseAdmin.from('challenge_windows')
                .select('*').eq('challenge_id', challengeId).order('opens_at', { ascending: true }),
            supabaseAdmin.from('challenge_completions')
                .select('id, window_id, verified, completed_at, response_time_seconds, proof_url')
                .eq('challenge_id', challengeId).eq('member_id', memberId),
            supabaseAdmin.from('challenge_participants')
                .select('status, joined_at').eq('challenge_id', challengeId).eq('member_id', memberId).maybeSingle(),
        ]);

        // Compute per-task placement and aggregate stats
        const verified = (myCompletions || []).filter((c: any) => c.verified);
        let top3Count = 0;
        let totalPoints = 0;
        const placementMap: Record<string, { place: number; points: number }> = {};

        for (const comp of verified) {
            const { data: others } = await supabaseAdmin
                .from('challenge_completions')
                .select('response_time_seconds')
                .eq('window_id', comp.window_id)
                .eq('verified', true)
                .neq('member_id', memberId);

            const fasterCount = (others || []).filter(
                (c: any) => (c.response_time_seconds ?? 999999) < (comp.response_time_seconds ?? 999999)
            ).length;

            if (fasterCount < 3) top3Count++;

            const flat = (challenge as any)?.points_per_completion ?? 20;
            const bonusMap: Record<number, number> = {
                0: (challenge as any)?.first_place_points ?? 10,
                1: (challenge as any)?.second_place_points ?? 7,
                2: (challenge as any)?.third_place_points ?? 5,
            };
            const earned = flat + (bonusMap[fasterCount] ?? 0);
            totalPoints += earned;
            placementMap[comp.window_id] = { place: fasterCount + 1, points: earned };
        }

        const completionsWithPlacement = (myCompletions || []).map((c: any) => ({
            ...c,
            placement: placementMap[c.window_id] || null,
        }));

        return NextResponse.json({
            success: true,
            challenge,
            windows: windows || [],
            completions: completionsWithPlacement,
            participant: participant || null,
            stats: {
                tasks_done: verified.length,
                tasks_submitted: (myCompletions || []).length,
                top3_count: top3Count,
                total_points: totalPoints,
            },
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
