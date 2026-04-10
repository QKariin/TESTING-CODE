import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

const REJOIN_FEE = 1000;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: challengeId } = await params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const memberEmail = user.email.toLowerCase();

        // Check participant is eliminated
        const { data: participant } = await supabaseAdmin
            .from('challenge_participants').select('status')
            .eq('challenge_id', challengeId).ilike('member_id', memberEmail).maybeSingle();

        if (!participant) return NextResponse.json({ success: false, error: 'Not a participant' }, { status: 400 });
        if (participant.status === 'active') return NextResponse.json({ success: false, error: 'Already active' }, { status: 400 });

        // Check wallet
        const { data: prof } = await supabaseAdmin
            .from('profiles').select('wallet').ilike('member_id', memberEmail).maybeSingle();
        const wallet = (prof as any)?.wallet ?? 0;
        if (wallet < REJOIN_FEE) {
            return NextResponse.json({ success: false, error: `Need ${REJOIN_FEE} coins to rejoin. You have ${wallet}.` }, { status: 400 });
        }

        // Deduct coins
        await supabaseAdmin.from('profiles')
            .update({ wallet: wallet - REJOIN_FEE })
            .ilike('member_id', memberEmail);

        // Re-activate participant
        await supabaseAdmin.from('challenge_participants')
            .update({ status: 'active', eliminated_on_window_id: null, eliminated_at: null, joined_at: new Date().toISOString() })
            .eq('challenge_id', challengeId).ilike('member_id', memberEmail);

        return NextResponse.json({ success: true, coins_charged: REJOIN_FEE });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
