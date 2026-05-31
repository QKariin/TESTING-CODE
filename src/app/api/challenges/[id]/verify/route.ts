import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DbService } from '@/lib/supabase-service';
import { discordChallengeVerified } from '@/lib/discord';
import { getTierForDays, getDailyCashback, getFinishBonus, TierDef, ChallengeDifficulty, TASKS_PER_DAY } from '@/lib/challenge-tasks';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const { completionId, verified, note = '' } = await request.json();
        if (!completionId || verified === undefined)
            return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });

        const { data: completion } = await supabaseAdmin
            .from('challenge_completions')
            .select('*, challenge_windows!challenge_completions_window_id_fkey(id, day_number, window_number, closes_at, opens_at)')
            .eq('id', completionId).single();

        if (!completion) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

        const window = completion.challenge_windows;
        const windowStillOpen = window && new Date(window.closes_at) > new Date();

        if (verified) {
            await supabaseAdmin.from('challenge_completions').update({
                verified: true, verified_at: new Date().toISOString(), verification_note: note || null,
            }).eq('id', completionId);

            // Per-window placement: count already-verified completions for this window ranked faster
            const { data: otherVerified } = await supabaseAdmin
                .from('challenge_completions')
                .select('response_time_seconds')
                .eq('window_id', completion.window_id)
                .eq('verified', true)
                .neq('id', completionId);

            const thisTime = completion.response_time_seconds ?? 999999;
            const fasterCount = (otherVerified || []).filter(
                (c: any) => (c.response_time_seconds ?? 999999) < thisTime
            ).length;

            // 20 flat + 10/7/5 bonus for 1st/2nd/3rd
            const { data: challenge } = await supabaseAdmin.from('challenges')
                .select('points_per_completion, first_place_points, second_place_points, third_place_points, is_tiered, tiers, name')
                .eq('id', id).single();

            const flat = challenge?.points_per_completion ?? 20;
            const bonusMap: Record<number, number> = {
                0: challenge?.first_place_points ?? 10,
                1: challenge?.second_place_points ?? 7,
                2: challenge?.third_place_points ?? 5,
            };
            const bonus = bonusMap[fasterCount] ?? 0;
            const totalPoints = flat + bonus;

            if (totalPoints > 0) {
                const { data: profile } = await supabaseAdmin.from('profiles')
                    .select('score, taskdom_completed_tasks').eq('member_id', completion.member_id).single();
                if (profile) {
                    await supabaseAdmin.from('profiles')
                        .update({
                            score: (profile.score || 0) + totalPoints,
                            taskdom_completed_tasks: ((profile as any).taskdom_completed_tasks || 0) + 1,
                        })
                        .eq('member_id', completion.member_id);
                }
            }

            // Fetch profile for notification cards
            const { data: prof } = await supabaseAdmin
                .from('profiles').select('name, avatar_url').ilike('member_id', completion.member_id).maybeSingle();

            // Count total verified completions for this participant in this challenge
            const { data: allVerified } = await supabaseAdmin
                .from('challenge_completions')
                .select('id')
                .eq('challenge_id', id)
                .ilike('member_id', completion.member_id)
                .eq('verified', true);

            const taskNum = (allVerified?.length || 0); // includes the one just verified
            const { data: ch } = await supabaseAdmin.from('challenges').select('duration_days, tasks_per_day').eq('id', id).single();
            const totalTasks = (ch?.duration_days || 0) * (ch?.tasks_per_day || 0);

            const cardPayload = {
                senderName: (prof as any)?.name || completion.member_id.split('@')[0],
                senderAvatar: (prof as any)?.avatar_url || null,
                taskNum: `${taskNum}/${totalTasks}`,
                passed: true,
                points: totalPoints,
                dayNumber: window?.day_number,
                windowNumber: window?.window_number,
            };

            // Personal chat
            try {
                const personalMsg = `CHALLENGE_TASK_CARD::${JSON.stringify({ ...cardPayload, personal: true })}`;
                await DbService.sendMessage(completion.member_id, personalMsg, 'system');
            } catch (_) {}

            // Global chat — only if participant is still active
            const { data: partCheck } = await supabaseAdmin
                .from('challenge_participants').select('status')
                .eq('challenge_id', id).ilike('member_id', completion.member_id).maybeSingle();
            if (partCheck?.status === 'active') {
                try {
                    await supabaseAdmin.from('global_messages').insert({
                        sender_email: 'system', sender_name: 'SYSTEM', sender_avatar: null,
                        message: `CHALLENGE_TASK_CARD::${JSON.stringify(cardPayload)}`,
                    });
                } catch (_) {}
            }

            // Discord notification
            discordChallengeVerified(
                (prof as any)?.name || completion.member_id.split('@')[0],
                `${taskNum}/${totalTasks}`, totalPoints, fasterCount + 1,
            ).catch(() => {});

            // ── TIERED: perfect day detection + cashback + tier completion ──
            let tierCompleted: string | null = null;
            let nextTierOffer: any = null;
            let dailyCashbackAwarded = 0;
            let finishBonusAwarded = 0;
            if (ch && challenge?.is_tiered && challenge?.tiers) {
                const { data: part } = await supabaseAdmin.from('challenge_participants')
                    .select('tier_days, current_tier, rejoin_count, difficulty, perfect_days, coins_earned')
                    .eq('challenge_id', id).ilike('member_id', completion.member_id).maybeSingle();

                if (part?.tier_days) {
                    const difficulty: ChallengeDifficulty = (part.difficulty as ChallengeDifficulty) || 'medium';
                    const tasksPerDay = TASKS_PER_DAY[difficulty] || 3;
                    const tiers: TierDef[] = challenge.tiers as TierDef[];
                    const currentTier = getTierForDays(tiers, part.tier_days);

                    // Check if this verification completes a perfect day
                    const dayNumber = window?.day_number;
                    if (dayNumber && currentTier) {
                        // Get all windows for this day
                        const { data: dayWindows } = await supabaseAdmin
                            .from('challenge_windows')
                            .select('id')
                            .eq('challenge_id', id)
                            .ilike('member_id', completion.member_id)
                            .eq('day_number', dayNumber);

                        // Count verified completions that belong to this day's windows
                        const dayWindowIds = new Set((dayWindows || []).map((w: any) => w.id));
                        const { data: allMyCompletions } = await supabaseAdmin
                            .from('challenge_completions')
                            .select('id, window_id, verified')
                            .eq('challenge_id', id)
                            .ilike('member_id', completion.member_id)
                            .eq('verified', true);

                        const verifiedCountForDay = (allMyCompletions || []).filter(
                            (c: any) => dayWindowIds.has(c.window_id)
                        ).length;

                        const totalWindowsForDay = dayWindows?.length || tasksPerDay;

                        if (verifiedCountForDay >= totalWindowsForDay) {
                            // PERFECT DAY! Award daily cashback
                            const cashback = getDailyCashback(currentTier, difficulty);
                            if (cashback > 0) {
                                // Credit to wallet
                                const { data: memberProfile } = await supabaseAdmin
                                    .from('profiles').select('wallet').ilike('member_id', completion.member_id).maybeSingle();
                                if (memberProfile) {
                                    await supabaseAdmin.from('profiles')
                                        .update({ wallet: (memberProfile.wallet || 0) + cashback })
                                        .ilike('member_id', completion.member_id);
                                }
                                dailyCashbackAwarded = cashback;
                            }
                            // Increment perfect_days
                            await supabaseAdmin.from('challenge_participants').update({
                                perfect_days: (part.perfect_days || 0) + 1,
                                coins_earned: (part.coins_earned || 0) + cashback,
                            }).eq('challenge_id', id).ilike('member_id', completion.member_id);
                        }
                    }

                    // Check if full tier is complete
                    const tierTotalTasks = part.tier_days * tasksPerDay;
                    if (taskNum >= tierTotalTasks) {
                        // Tier complete — mark as finished
                        const finishBonus = currentTier ? getFinishBonus(currentTier, difficulty) : 0;
                        if (finishBonus > 0) {
                            const { data: memberProfile } = await supabaseAdmin
                                .from('profiles').select('wallet').ilike('member_id', completion.member_id).maybeSingle();
                            if (memberProfile) {
                                await supabaseAdmin.from('profiles')
                                    .update({ wallet: (memberProfile.wallet || 0) + finishBonus })
                                    .ilike('member_id', completion.member_id);
                            }
                            finishBonusAwarded = finishBonus;
                        }

                        await supabaseAdmin.from('challenge_participants').update({
                            status: 'finished',
                            coins_earned: (part.coins_earned || 0) + dailyCashbackAwarded + finishBonus,
                        }).eq('challenge_id', id).ilike('member_id', completion.member_id);

                        tierCompleted = part.current_tier;

                        // Award tier badge
                        const tierLevel = (part.current_tier || '').toLowerCase();
                        const { data: tierBadge } = await supabaseAdmin.from('badges')
                            .select('id').eq('challenge_id', id).eq('type', 'tier_milestone').eq('tier_level', tierLevel).maybeSingle();
                        if (tierBadge) {
                            await supabaseAdmin.from('user_badges').upsert({
                                member_id: completion.member_id, badge_id: tierBadge.id, challenge_id: id,
                                earned_at: new Date().toISOString(), is_active: true,
                            }, { onConflict: 'member_id,badge_id,challenge_id' });
                        }

                        // Check if there's a next tier to offer
                        const tiersList = (challenge.tiers as any[]).sort((a: any, b: any) => a.days - b.days);
                        const currentIdx = tiersList.findIndex((t: any) => t.days === part.tier_days);
                        if (currentIdx !== -1 && currentIdx < tiersList.length - 1) {
                            const next = tiersList[currentIdx + 1];
                            nextTierOffer = {
                                label: next.label,
                                days: next.days,
                                cost_soft: (next.cost_soft || next.cost || 0) - (tiersList[currentIdx].cost_soft || tiersList[currentIdx].cost || 0),
                                cost_strict: (next.cost_strict || next.cost || 0) - (tiersList[currentIdx].cost_strict || tiersList[currentIdx].cost || 0),
                                cost_brutal: (next.cost_brutal || next.cost || 0) - (tiersList[currentIdx].cost_brutal || tiersList[currentIdx].cost || 0),
                            };
                        }

                        // Post tier completion card to global feed
                        try {
                            const tierCardData = {
                                title: `${part.current_tier?.toUpperCase()} TIER COMPLETE`,
                                tier: part.current_tier,
                                challengeName: challenge.name || '',
                                winnerName: (prof as any)?.name || completion.member_id.split('@')[0],
                                days: part.tier_days,
                                difficulty: part.difficulty,
                                finishBonus: finishBonusAwarded,
                                nextTier: nextTierOffer,
                            };
                            await supabaseAdmin.from('global_messages').insert({
                                sender_email: 'system', sender_name: 'SYSTEM', sender_avatar: null,
                                message: `CHALLENGE_TIER_CARD::${JSON.stringify(tierCardData)}`,
                            });
                        } catch (_) {}
                    }
                }
            }

            // ── EVERGREEN + DIFFICULTY: perfect day + cashback (non-tiered) ──
            if (!challenge?.is_tiered && challenge?.difficulty_pricing && ch) {
                const dp = challenge.difficulty_pricing as any;
                const { data: part } = await supabaseAdmin.from('challenge_participants')
                    .select('difficulty, perfect_days, coins_earned, tier_days')
                    .eq('challenge_id', id).ilike('member_id', completion.member_id).maybeSingle();

                if (part?.difficulty) {
                    const difficulty: ChallengeDifficulty = (part.difficulty as ChallengeDifficulty) || 'medium';
                    const tasksPerDay = TASKS_PER_DAY[difficulty] || 3;
                    const dayNumber = window?.day_number;

                    if (dayNumber) {
                        const { data: dayWindows } = await supabaseAdmin
                            .from('challenge_windows').select('id')
                            .eq('challenge_id', id).ilike('member_id', completion.member_id).eq('day_number', dayNumber);

                        const dayWindowIds = new Set((dayWindows || []).map((w: any) => w.id));
                        const { data: allMyCompletions } = await supabaseAdmin
                            .from('challenge_completions').select('id, window_id')
                            .eq('challenge_id', id).ilike('member_id', completion.member_id).eq('verified', true);

                        const verifiedCountForDay = (allMyCompletions || []).filter((c: any) => dayWindowIds.has(c.window_id)).length;

                        if (verifiedCountForDay >= (dayWindows?.length || tasksPerDay)) {
                            // Perfect day — award daily cashback
                            const dailyKey = difficulty === 'easy' ? 'daily_soft' : difficulty === 'hard' ? 'daily_brutal' : 'daily_strict';
                            const cashback = dp[dailyKey] ?? 0;
                            if (cashback > 0) {
                                const { data: memberProfile } = await supabaseAdmin
                                    .from('profiles').select('wallet').ilike('member_id', completion.member_id).maybeSingle();
                                if (memberProfile) {
                                    await supabaseAdmin.from('profiles')
                                        .update({ wallet: (memberProfile.wallet || 0) + cashback })
                                        .ilike('member_id', completion.member_id);
                                }
                                dailyCashbackAwarded = cashback;
                            }
                            await supabaseAdmin.from('challenge_participants').update({
                                perfect_days: (part.perfect_days || 0) + 1,
                                coins_earned: (part.coins_earned || 0) + cashback,
                            }).eq('challenge_id', id).ilike('member_id', completion.member_id);
                        }
                    }

                    // Check if challenge fully complete
                    const totalTasks = ch.duration_days * tasksPerDay;
                    if (taskNum >= totalTasks) {
                        const finishKey = difficulty === 'easy' ? 'finish_soft' : difficulty === 'hard' ? 'finish_brutal' : 'finish_strict';
                        const finishBonus = dp[finishKey] ?? 0;
                        if (finishBonus > 0) {
                            const { data: memberProfile } = await supabaseAdmin
                                .from('profiles').select('wallet').ilike('member_id', completion.member_id).maybeSingle();
                            if (memberProfile) {
                                await supabaseAdmin.from('profiles')
                                    .update({ wallet: (memberProfile.wallet || 0) + finishBonus })
                                    .ilike('member_id', completion.member_id);
                            }
                            finishBonusAwarded = finishBonus;
                        }
                        await supabaseAdmin.from('challenge_participants').update({
                            status: 'finished',
                            coins_earned: (part.coins_earned || 0) + dailyCashbackAwarded + finishBonus,
                        }).eq('challenge_id', id).ilike('member_id', completion.member_id);
                    }
                }
            }

            return NextResponse.json({
                success: true, action: 'verified', points_awarded: totalPoints, placement: fasterCount + 1,
                tier_completed: tierCompleted, next_tier: nextTierOffer,
                daily_cashback: dailyCashbackAwarded, finish_bonus: finishBonusAwarded,
            });
        } else {
            if (windowStillOpen) {
                // Window still open - delete so they can resubmit
                await supabaseAdmin.from('challenge_completions').delete().eq('id', completionId);
                return NextResponse.json({ success: true, action: 'rejected_can_resubmit' });
            } else {
                // Window closed - eliminate
                await supabaseAdmin.from('challenge_completions').update({
                    verified: false, verification_note: note || 'Rejected',
                }).eq('id', completionId);

                await supabaseAdmin.from('challenge_participants').update({
                    status: 'eliminated',
                    eliminated_on_window_id: window?.id,
                    eliminated_at: new Date().toISOString(),
                }).eq('challenge_id', id).eq('member_id', completion.member_id).eq('status', 'active');

                // Fetch profile for reject cards
                const { data: profR } = await supabaseAdmin
                    .from('profiles').select('name, avatar_url').ilike('member_id', completion.member_id).maybeSingle();

                const rejectPayload = {
                    senderName: (profR as any)?.name || completion.member_id.split('@')[0],
                    senderAvatar: (profR as any)?.avatar_url || null,
                    passed: false,
                    dayNumber: window?.day_number,
                    windowNumber: window?.window_number,
                };

                try {
                    await DbService.sendMessage(completion.member_id, `CHALLENGE_TASK_CARD::${JSON.stringify({ ...rejectPayload, personal: true })}`, 'system');
                } catch (_) {}
                try {
                    await supabaseAdmin.from('global_messages').insert({
                        sender_email: 'system', sender_name: 'SYSTEM', sender_avatar: null,
                        message: `CHALLENGE_TASK_CARD::${JSON.stringify(rejectPayload)}`,
                    });
                } catch (_) {}

                return NextResponse.json({ success: true, action: 'rejected_eliminated' });
            }
        }
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
