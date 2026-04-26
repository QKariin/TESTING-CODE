import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateEvergreenWindows, TimeSlot } from '@/lib/evergreen-windows';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: challengeId } = await params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const memberEmail = (user.email || '').toLowerCase();

        // Resolve profile
        const { data: profile } = await supabaseAdmin
            .from('profiles').select('ID, member_id, name, avatar_url, wallet').eq('ID', user.id).maybeSingle();
        if (!profile) return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
        const memberId = profile.member_id;

        // Fetch challenge
        const { data: challenge } = await supabaseAdmin
            .from('challenges').select('*').eq('id', challengeId).single();
        if (!challenge) return NextResponse.json({ success: false, error: 'Challenge not found' }, { status: 404 });

        // Already a participant?
        const { data: existing } = await supabaseAdmin
            .from('challenge_participants')
            .select('status')
            .eq('challenge_id', challengeId)
            .eq('member_id', memberId)
            .maybeSingle();

        if (existing) return NextResponse.json({ success: true, already_joined: true, status: existing.status });

        if (challenge.is_evergreen) {
            // ── EVERGREEN JOIN ──
            const body = await req.json().catch(() => ({}));
            const timezone: string = body.timezone || 'UTC';
            const chosenSlots: TimeSlot[] = body.chosen_slots || ['morning'];

            // Validate slots
            const validSlots: TimeSlot[] = ['morning', 'afternoon', 'evening'];
            const cleanSlots = chosenSlots.filter(s => validSlots.includes(s));
            if (cleanSlots.length === 0) {
                return NextResponse.json({ success: false, error: 'Choose at least one time slot' }, { status: 400 });
            }
            if (cleanSlots.length !== challenge.tasks_per_day) {
                return NextResponse.json({
                    success: false,
                    error: `This challenge requires ${challenge.tasks_per_day} task(s) per day. Pick ${challenge.tasks_per_day} slot(s).`
                }, { status: 400 });
            }

            // Charge join cost
            const joinCost = challenge.evergreen_join_cost || 0;
            const currentWallet = profile.wallet ?? 0;
            if (currentWallet < joinCost) {
                return NextResponse.json({
                    success: false,
                    error: `Need ${joinCost} coins to join. You have ${currentWallet}.`
                }, { status: 400 });
            }

            if (joinCost > 0) {
                await supabaseAdmin.from('profiles')
                    .update({ wallet: currentWallet - joinCost })
                    .eq('ID', profile.ID);
            }

            // Create participant with personal timeline
            const now = new Date();
            const personalEnd = new Date(now);
            personalEnd.setDate(personalEnd.getDate() + challenge.duration_days);

            const { error: joinErr } = await supabaseAdmin.from('challenge_participants').insert({
                challenge_id: challengeId,
                member_id: memberId,
                status: 'active',
                joined_at: now.toISOString(),
                timezone,
                chosen_slots: cleanSlots,
                personal_start: now.toISOString(),
                personal_end: personalEnd.toISOString(),
                coins_paid: joinCost,
            });
            if (joinErr) throw joinErr;

            // Generate personal windows
            const slotMinutes = challenge.slot_duration_minutes || challenge.window_minutes || 360;
            const windows = generateEvergreenWindows(
                challengeId, memberId, now, timezone,
                cleanSlots, challenge.duration_days, slotMinutes,
            );

            const { error: wErr } = await supabaseAdmin.from('challenge_windows').insert(windows);
            if (wErr) throw wErr;

            // Save timezone on profile for future use
            await supabaseAdmin.from('profiles')
                .update({ timezone })
                .eq('ID', profile.ID);

            // Post join card to global feed
            try {
                const { count: activeCount } = await supabaseAdmin
                    .from('challenge_participants').select('*', { count: 'exact', head: true })
                    .eq('challenge_id', challengeId).eq('status', 'active');
                await supabaseAdmin.from('global_messages').insert({
                    sender_email: 'system', sender_name: 'SYSTEM', sender_avatar: null,
                    message: `CHALLENGE_JOIN_CARD::${JSON.stringify({
                        name: profile.name || memberEmail.split('@')[0],
                        photo: profile.avatar_url || null,
                        challengeName: challenge.name,
                        challengeImage: challenge.image_url || null,
                        activeCount: (activeCount || 0),
                    })}`,
                });
            } catch (_) {}

            // Award participant badge
            const { data: badge } = await supabaseAdmin.from('badges')
                .select('id').eq('challenge_id', challengeId).eq('type', 'participant').maybeSingle();
            if (badge) {
                await supabaseAdmin.from('user_badges').upsert({
                    member_id: memberId, badge_id: badge.id, challenge_id: challengeId,
                    earned_at: now.toISOString(), is_active: true,
                }, { onConflict: 'member_id,badge_id,challenge_id' });
            }

            return NextResponse.json({
                success: true,
                already_joined: false,
                is_evergreen: true,
                coins_charged: joinCost,
                windows_created: windows.length,
                first_window: windows[0] || null,
            });
        }

        // ── CLASSIC JOIN (unchanged) ──
        const isActive = challenge.status === 'active';
        const isUpcoming = challenge.status === 'draft' &&
            challenge.start_date &&
            new Date(challenge.start_date).getTime() > Date.now();
        if (!isActive && !isUpcoming)
            return NextResponse.json({ success: false, error: 'Challenge is not open for joining' }, { status: 400 });

        // Late join fee
        let lateJoinFee = 0;
        if (isActive) {
            const { count } = await supabaseAdmin
                .from('challenge_windows')
                .select('*', { count: 'exact', head: true })
                .eq('challenge_id', challengeId)
                .is('member_id', null) // only classic (shared) windows
                .lt('closes_at', new Date().toISOString());
            if ((count ?? 0) > 0) {
                lateJoinFee = 1000;
                const currentWallet = profile.wallet ?? 0;
                if (currentWallet < lateJoinFee) {
                    return NextResponse.json({ success: false, error: `Late join fee is ${lateJoinFee} coins. You need more coins to join.` }, { status: 400 });
                }
                await supabaseAdmin.from('profiles')
                    .update({ wallet: currentWallet - lateJoinFee })
                    .eq('ID', profile.ID);
            }
        }

        // Join
        const { error } = await supabaseAdmin.from('challenge_participants').insert({
            challenge_id: challengeId,
            member_id: memberId,
            status: 'active',
            joined_at: new Date().toISOString(),
        });
        if (error) throw error;

        // Post join card to global feed
        try {
            const { count: activeCount } = await supabaseAdmin
                .from('challenge_participants').select('*', { count: 'exact', head: true })
                .eq('challenge_id', challengeId).eq('status', 'active');
            await supabaseAdmin.from('global_messages').insert({
                sender_email: 'system', sender_name: 'SYSTEM', sender_avatar: null,
                message: `CHALLENGE_JOIN_CARD::${JSON.stringify({
                    name: profile.name || memberEmail.split('@')[0],
                    photo: profile.avatar_url || null,
                    challengeName: challenge.name,
                    challengeImage: challenge.image_url || null,
                    activeCount: (activeCount || 0) + 1,
                })}`,
            });
        } catch (_) {}

        // Award participant badge
        const { data: badge } = await supabaseAdmin.from('badges')
            .select('id').eq('challenge_id', challengeId).eq('type', 'participant').maybeSingle();
        if (badge) {
            await supabaseAdmin.from('user_badges').upsert({
                member_id: memberId, badge_id: badge.id, challenge_id: challengeId,
                earned_at: new Date().toISOString(), is_active: true,
            }, { onConflict: 'member_id,badge_id,challenge_id' });
        }

        return NextResponse.json({ success: true, already_joined: false, late_join_fee: lateJoinFee });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
