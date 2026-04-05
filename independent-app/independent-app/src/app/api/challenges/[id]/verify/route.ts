import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request, { params }: { params: { id: string } }) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const { completionId, verified, note = '' } = await request.json();
        if (!completionId || verified === undefined)
            return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });

        const { data: completion } = await supabaseAdmin
            .from('challenge_completions')
            .select('*, challenge_windows!challenge_completions_window_id_fkey(id, closes_at, opens_at)')
            .eq('id', completionId).single();

        if (!completion) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

        const window = completion.challenge_windows;
        const windowStillOpen = window && new Date(window.closes_at) > new Date();

        if (verified) {
            await supabaseAdmin.from('challenge_completions').update({
                verified: true, verified_at: new Date().toISOString(), verification_note: note || null,
            }).eq('id', completionId);

            // Award per-task points
            const { data: challenge } = await supabaseAdmin.from('challenges')
                .select('points_per_completion').eq('id', params.id).single();
            if (challenge?.points_per_completion) {
                const { data: profile } = await supabaseAdmin.from('profiles')
                    .select('score').eq('member_id', completion.member_id).single();
                if (profile) {
                    await supabaseAdmin.from('profiles')
                        .update({ score: (profile.score || 0) + challenge.points_per_completion })
                        .eq('member_id', completion.member_id);
                }
            }
            return NextResponse.json({ success: true, action: 'verified' });
        } else {
            if (windowStillOpen) {
                // Window still open — delete so they can resubmit
                await supabaseAdmin.from('challenge_completions').delete().eq('id', completionId);
                return NextResponse.json({ success: true, action: 'rejected_can_resubmit' });
            } else {
                // Window closed — eliminate
                await supabaseAdmin.from('challenge_completions').update({
                    verified: false, verification_note: note || 'Rejected',
                }).eq('id', completionId);

                await supabaseAdmin.from('challenge_participants').update({
                    status: 'eliminated',
                    eliminated_on_window_id: window?.id,
                    eliminated_at: new Date().toISOString(),
                }).eq('challenge_id', params.id).eq('member_id', completion.member_id).eq('status', 'active');

                return NextResponse.json({ success: true, action: 'rejected_eliminated' });
            }
        }
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
