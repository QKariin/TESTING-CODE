import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateEvergreenWindows, TimeSlot } from '@/lib/evergreen-windows';
import { assignTasksForDays, getNextTier, TierDef } from '@/lib/challenge-tasks';

/**
 * POST /api/challenges/[id]/extend
 *
 * Called when a user finishes a tier and wants to extend to the next one.
 * Generates new windows + assigns new tasks for the additional days.
 * Charges the cost difference between tiers.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: challengeId } = await params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabaseAdmin
            .from('profiles').select('ID, member_id, wallet, timezone').eq('ID', user.id).maybeSingle();
        if (!profile) return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
        const memberId = profile.member_id;

        const { data: challenge } = await supabaseAdmin
            .from('challenges').select('*').eq('id', challengeId).single();
        if (!challenge) return NextResponse.json({ success: false, error: 'Challenge not found' }, { status: 404 });
        if (!challenge.is_tiered) return NextResponse.json({ success: false, error: 'Not a tiered challenge' }, { status: 400 });

        const tiers: TierDef[] = challenge.tiers || [];
        if (tiers.length === 0) return NextResponse.json({ success: false, error: 'No tiers configured' }, { status: 400 });

        // Get participant
        const { data: participant } = await supabaseAdmin
            .from('challenge_participants')
            .select('*')
            .eq('challenge_id', challengeId)
            .eq('member_id', memberId)
            .maybeSingle();

        if (!participant) return NextResponse.json({ success: false, error: 'Not a participant' }, { status: 400 });
        if (participant.status !== 'finished') {
            return NextResponse.json({ success: false, error: 'Must finish current tier before extending' }, { status: 400 });
        }

        const currentTierDays = participant.tier_days || 0;
        const nextTier = getNextTier(tiers, currentTierDays);
        if (!nextTier) return NextResponse.json({ success: false, error: 'Already at max tier' }, { status: 400 });

        // Cost = next tier cost minus what they already paid
        const currentTierCost = tiers.find(t => t.days === currentTierDays)?.cost || 0;
        const extensionCost = Math.max(0, nextTier.cost - currentTierCost);

        const wallet = profile.wallet ?? 0;
        if (wallet < extensionCost) {
            return NextResponse.json({
                success: false,
                error: `Need ${extensionCost} coins to extend. You have ${wallet}.`,
            }, { status: 400 });
        }

        // Charge
        if (extensionCost > 0) {
            await supabaseAdmin.from('profiles')
                .update({ wallet: wallet - extensionCost })
                .eq('ID', profile.ID);
        }

        // Assign tasks for the new days
        const startDay = currentTierDays + 1;
        const endDay = nextTier.days;
        const attemptNumber = (participant.rejoin_count || 0) + 1;
        const assignments = await assignTasksForDays(challengeId, memberId, startDay, endDay, attemptNumber);

        // Generate windows for new days
        const timezone = participant.timezone || profile.timezone || 'UTC';
        const chosenSlots: TimeSlot[] = participant.chosen_slots || ['morning'];
        const slotMinutes = challenge.slot_duration_minutes || challenge.window_minutes || 360;

        // Calculate when new days start: from end of current tier
        const personalStart = new Date(participant.personal_start);
        const extensionStart = new Date(personalStart);
        extensionStart.setDate(extensionStart.getDate() + currentTierDays);

        const newWindows = generateEvergreenWindows(
            challengeId, memberId, extensionStart, timezone,
            chosenSlots, endDay - currentTierDays, slotMinutes,
        );

        // Fix day numbers (generateEvergreenWindows starts from 1, we need startDay..endDay)
        const fixedWindows = newWindows.map((w, i) => ({
            ...w,
            day_number: w.day_number + currentTierDays,
            task_name: assignments[i]?.task_name || null,
        }));

        const { error: wErr } = await supabaseAdmin.from('challenge_windows').insert(fixedWindows);
        if (wErr) throw wErr;

        // Update participant
        const newEnd = new Date(personalStart);
        newEnd.setDate(newEnd.getDate() + nextTier.days);

        await supabaseAdmin.from('challenge_participants').update({
            status: 'active',
            tier_days: nextTier.days,
            current_tier: nextTier.label,
            personal_end: newEnd.toISOString(),
        }).eq('challenge_id', challengeId).eq('member_id', memberId);

        // Award previous tier badge if not already awarded
        const prevTierLabel = tiers.find(t => t.days === currentTierDays)?.label?.toLowerCase();
        if (prevTierLabel) {
            const { data: tierBadge } = await supabaseAdmin.from('badges')
                .select('id').eq('challenge_id', challengeId).eq('type', 'tier_milestone').eq('tier_level', prevTierLabel).maybeSingle();
            if (tierBadge) {
                await supabaseAdmin.from('user_badges').upsert({
                    member_id: memberId, badge_id: tierBadge.id, challenge_id: challengeId,
                    earned_at: new Date().toISOString(), is_active: true,
                }, { onConflict: 'member_id,badge_id,challenge_id' });
            }
        }

        return NextResponse.json({
            success: true,
            extended_to: nextTier.days,
            new_tier: nextTier.label,
            coins_charged: extensionCost,
            windows_created: fixedWindows.length,
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
