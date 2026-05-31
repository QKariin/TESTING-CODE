import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateEvergreenWindows, TimeSlot } from '@/lib/evergreen-windows';
import { discordChallengeJoin } from '@/lib/discord';
import { assignTasksForDays, getTierForDays, getTierCost, TierDef, ChallengeDifficulty, TASKS_PER_DAY } from '@/lib/challenge-tasks';

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

        if (challenge.is_tiered) {
            // ── TIERED JOIN ──
            const body = await req.json().catch(() => ({}));
            const timezone: string = body.timezone || 'UTC';
            const chosenSlots: TimeSlot[] = body.chosen_slots || ['morning'];
            const tierDays: number = body.tier_days;
            const difficulty: ChallengeDifficulty = ['easy', 'medium', 'hard'].includes(body.difficulty) ? body.difficulty : 'medium';

            const tiers: TierDef[] = challenge.tiers || [];
            const selectedTier = getTierForDays(tiers, tierDays);
            if (!selectedTier) {
                return NextResponse.json({ success: false, error: `Invalid tier: ${tierDays} days` }, { status: 400 });
            }

            // Determine tasks per day based on difficulty
            const tasksPerDay = TASKS_PER_DAY[difficulty] || 3;
            const poolTasksPerDay = tasksPerDay - 1; // first task is always morning photo

            // Validate slots — need enough slots for tasks
            const validSlots: TimeSlot[] = ['morning', 'afternoon', 'evening'];
            const cleanSlots = chosenSlots.filter(s => validSlots.includes(s));
            // Auto-assign slots based on tasks per day
            const allSlots: TimeSlot[] = ['morning', 'afternoon', 'evening'];
            const neededSlots = Math.min(tasksPerDay, 3);
            const finalSlots = cleanSlots.length >= neededSlots ? cleanSlots.slice(0, neededSlots) : allSlots.slice(0, neededSlots);

            // Charge tier cost (per-difficulty pricing)
            const joinCost = getTierCost(selectedTier, difficulty);
            const currentWallet = profile.wallet ?? 0;
            if (currentWallet < joinCost) {
                return NextResponse.json({
                    success: false,
                    error: `Need ${joinCost} coins to join. You have ${currentWallet}.`,
                }, { status: 400 });
            }
            if (joinCost > 0) {
                await supabaseAdmin.from('profiles')
                    .update({ wallet: currentWallet - joinCost })
                    .eq('ID', profile.ID);
            }

            const now = new Date();
            const personalEnd = new Date(now);
            personalEnd.setDate(personalEnd.getDate() + tierDays);

            // Create participant
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
                tier_days: tierDays,
                current_tier: selectedTier.label,
                difficulty,
            });
            if (joinErr) throw joinErr;

            // Assign pool tasks (filtered by difficulty, multiple per day)
            const assignments = await assignTasksForDays(challengeId, memberId, 1, tierDays, 1, difficulty, poolTasksPerDay);

            // Generate personal windows — one per slot per day
            const slotMinutes = challenge.slot_duration_minutes || challenge.window_minutes || 360;
            const windows = generateEvergreenWindows(
                challengeId, memberId, now, timezone,
                finalSlots, tierDays, slotMinutes,
            );

            // Bake task names into windows
            // Window 1 each day = daily morning task, rest = pool assignments
            const dailyTask = challenge.daily_task || 'Morning photo check-in';
            const windowsWithTasks = windows.map(w => {
                if (w.window_number === 1) {
                    // First window each day = morning photo
                    return { ...w, task_name: dailyTask };
                }
                // Remaining windows get pool task assignments
                const dayAssignments = assignments.filter(a => a.day_number === w.day_number);
                const poolIndex = w.window_number - 2; // 0-based index into pool tasks
                const assignment = dayAssignments[poolIndex];
                return { ...w, task_name: assignment?.task_name || null };
            });

            const { error: wErr } = await supabaseAdmin.from('challenge_windows').insert(windowsWithTasks);
            if (wErr) throw wErr;

            // Save timezone
            await supabaseAdmin.from('profiles').update({ timezone }).eq('ID', profile.ID);

            // Global feed card
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
                        activeCount: activeCount || 0,
                        tier: selectedTier.label,
                        tierDays: tierDays,
                    })}`,
                });
            } catch (_) {}

            // Participant badge
            const { data: badge } = await supabaseAdmin.from('badges')
                .select('id').eq('challenge_id', challengeId).eq('type', 'participant').maybeSingle();
            if (badge) {
                await supabaseAdmin.from('user_badges').upsert({
                    member_id: memberId, badge_id: badge.id, challenge_id: challengeId,
                    earned_at: now.toISOString(), is_active: true,
                }, { onConflict: 'member_id,badge_id,challenge_id' });
            }

            discordChallengeJoin(profile.name || memberEmail.split('@')[0], `${challenge.name} (${selectedTier.label})`, 0).catch(() => {});

            return NextResponse.json({
                success: true,
                already_joined: false,
                is_tiered: true,
                tier: selectedTier.label,
                tier_days: tierDays,
                coins_charged: joinCost,
                windows_created: windowsWithTasks.length,
                first_window: windowsWithTasks[0] || null,
            });
        }

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

            // Discord notification
            discordChallengeJoin(profile.name || memberEmail.split('@')[0], challenge.name, 0).catch(() => {});

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

        // Discord notification
        discordChallengeJoin(profile.name || memberEmail.split('@')[0], challenge.name, 0).catch(() => {});

        return NextResponse.json({ success: true, already_joined: false, late_join_fee: lateJoinFee });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
