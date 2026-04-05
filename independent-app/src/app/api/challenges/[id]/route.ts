import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
    try {
        const { id } = params;

        const { data: challenge, error: cErr } = await supabaseAdmin
            .from('challenges').select('*').eq('id', id).single();
        if (cErr || !challenge) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

        const [{ data: windows }, { data: completions }, { data: participants }, { data: pending }] = await Promise.all([
            supabaseAdmin.from('challenge_windows').select('*').eq('challenge_id', id).order('opens_at', { ascending: true }),
            supabaseAdmin.from('challenge_completions').select('*').eq('challenge_id', id),
            supabaseAdmin.from('challenge_participants').select('*, profiles!challenge_participants_member_id_fkey(name, hierarchy, avatar_url, profile_picture_url)').eq('challenge_id', id),
            supabaseAdmin.from('challenge_completions')
                .select('*, challenge_windows!challenge_completions_window_id_fkey(day_number, window_number, verification_code, opens_at, closes_at), profiles!challenge_completions_member_id_fkey(name, avatar_url, profile_picture_url)')
                .eq('challenge_id', id).eq('verified', false).not('proof_url', 'is', null).order('completed_at', { ascending: true }),
        ]);

        const now = new Date();

        // Auto-eliminate: active participants who missed a closed window
        for (const p of (participants || []).filter((p: any) => p.status === 'active')) {
            for (const w of (windows || []).filter((w: any) => new Date(w.closes_at) < now)) {
                const done = (completions || []).some((c: any) => c.window_id === w.id && c.member_id === p.member_id);
                if (!done) {
                    await supabaseAdmin.from('challenge_participants').update({
                        status: 'eliminated',
                        eliminated_on_window_id: w.id,
                        eliminated_at: now.toISOString(),
                    }).eq('challenge_id', id).eq('member_id', p.member_id);
                    p.status = 'eliminated';
                    p.eliminated_on_window_id = w.id;
                    break;
                }
            }
        }

        // Build leaderboard
        const leaderboard = (participants || []).map((p: any) => {
            const prof = p.profiles || {};
            const userComps = (completions || []).filter((c: any) => c.member_id === p.member_id);
            const avgSpeed = userComps.length
                ? Math.round(userComps.reduce((s: number, c: any) => s + (c.response_time_seconds || 0), 0) / userComps.length)
                : null;
            const eliminatedWindow = (windows || []).find((w: any) => w.id === p.eliminated_on_window_id);
            return {
                ...p,
                name: prof.name || p.member_id,
                avatar: prof.avatar_url || prof.profile_picture_url || null,
                hierarchy: prof.hierarchy,
                completions_count: userComps.length,
                avg_response_seconds: avgSpeed,
                eliminated_day: eliminatedWindow?.day_number || null,
                eliminated_window_num: eliminatedWindow?.window_number || null,
            };
        }).sort((a: any, b: any) => {
            if (a.status === 'champion') return -1;
            if (b.status === 'champion') return 1;
            if (a.status === 'active' && b.status !== 'active') return -1;
            if (b.status === 'active' && a.status !== 'active') return 1;
            if (a.status === 'active' && b.status === 'active') {
                if (a.avg_response_seconds === null) return 1;
                if (b.avg_response_seconds === null) return -1;
                return a.avg_response_seconds - b.avg_response_seconds;
            }
            return 0;
        });

        return NextResponse.json({ success: true, challenge, leaderboard, windows, completions, pending_verifications: pending || [] });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { data, error } = await supabaseAdmin
            .from('challenges').update(body).eq('id', params.id).select().single();
        if (error) throw error;
        return NextResponse.json({ success: true, challenge: data });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
