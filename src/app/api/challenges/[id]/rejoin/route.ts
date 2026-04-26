import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateEvergreenWindows, TimeSlot } from '@/lib/evergreen-windows';

const CLASSIC_REJOIN_FEE = 1000;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: challengeId } = await params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const memberEmail = user.email.toLowerCase();

        // Resolve profile
        const { data: prof } = await supabaseAdmin
            .from('profiles').select('ID, member_id, wallet, timezone').ilike('member_id', memberEmail).maybeSingle();
        if (!prof) return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
        const memberId = prof.member_id;

        // Fetch challenge
        const { data: challenge } = await supabaseAdmin
            .from('challenges').select('*').eq('id', challengeId).single();
        if (!challenge) return NextResponse.json({ success: false, error: 'Challenge not found' }, { status: 404 });

        // Check participant is eliminated
        const { data: participant } = await supabaseAdmin
            .from('challenge_participants').select('status, rejoin_count, chosen_slots, timezone')
            .eq('challenge_id', challengeId).eq('member_id', memberId).maybeSingle();

        if (!participant) return NextResponse.json({ success: false, error: 'Not a participant' }, { status: 400 });
        if (participant.status === 'active') return NextResponse.json({ success: false, error: 'Already active' }, { status: 400 });

        // Determine rejoin cost
        const rejoinFee = challenge.is_evergreen
            ? (challenge.evergreen_rejoin_cost || 1000)
            : CLASSIC_REJOIN_FEE;

        // Check wallet
        const wallet = prof.wallet ?? 0;
        if (wallet < rejoinFee) {
            return NextResponse.json({ success: false, error: `Need ${rejoinFee} coins to rejoin. You have ${wallet}.` }, { status: 400 });
        }

        // Deduct coins
        await supabaseAdmin.from('profiles')
            .update({ wallet: wallet - rejoinFee })
            .eq('ID', prof.ID);

        if (challenge.is_evergreen) {
            // ── EVERGREEN REJOIN ──
            const body = await request.json().catch(() => ({}));
            const timezone: string = body.timezone || participant.timezone || prof.timezone || 'UTC';
            const chosenSlots: TimeSlot[] = body.chosen_slots || participant.chosen_slots || ['morning'];

            const now = new Date();
            const personalEnd = new Date(now);
            personalEnd.setDate(personalEnd.getDate() + challenge.duration_days);

            // Delete old personal windows
            await supabaseAdmin.from('challenge_windows')
                .delete()
                .eq('challenge_id', challengeId)
                .eq('member_id', memberId);

            // Reset participant — restart from Day 1
            await supabaseAdmin.from('challenge_participants').update({
                status: 'active',
                eliminated_on_window_id: null,
                eliminated_at: null,
                personal_start: now.toISOString(),
                personal_end: personalEnd.toISOString(),
                timezone,
                chosen_slots: chosenSlots,
                rejoin_count: (participant.rejoin_count || 0) + 1,
                coins_paid: rejoinFee,
            }).eq('challenge_id', challengeId).eq('member_id', memberId);

            // Generate fresh personal windows
            const slotMinutes = challenge.slot_duration_minutes || challenge.window_minutes || 360;
            const windows = generateEvergreenWindows(
                challengeId, memberId, now, timezone,
                chosenSlots, challenge.duration_days, slotMinutes,
            );

            const { error: wErr } = await supabaseAdmin.from('challenge_windows').insert(windows);
            if (wErr) throw wErr;

            return NextResponse.json({
                success: true,
                coins_charged: rejoinFee,
                is_evergreen: true,
                windows_created: windows.length,
                rejoin_count: (participant.rejoin_count || 0) + 1,
            });
        }

        // ── CLASSIC REJOIN (unchanged) ──
        await supabaseAdmin.from('challenge_participants')
            .update({ status: 'active', eliminated_on_window_id: null, eliminated_at: null, joined_at: new Date().toISOString() })
            .eq('challenge_id', challengeId).eq('member_id', memberId);

        return NextResponse.json({ success: true, coins_charged: rejoinFee });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
