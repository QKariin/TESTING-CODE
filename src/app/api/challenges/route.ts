import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getJoinCost } from '@/lib/evergreen-windows';

export async function GET() {
    try {
        const { data: challenges, error } = await supabaseAdmin
            .from('challenges')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Single query for all participants across all challenges - then count in JS
        const challengeIds = (challenges || []).map((c: any) => c.id);
        const { data: allParticipants } = challengeIds.length
            ? await supabaseAdmin.from('challenge_participants').select('challenge_id, status').in('challenge_id', challengeIds)
            : { data: [] };

        const enriched = (challenges || []).map((c: any) => {
            const cp = (allParticipants || []).filter((p: any) => p.challenge_id === c.id);
            return {
                ...c,
                participant_total: cp.length,
                participant_active: cp.filter((p: any) => p.status === 'active').length,
                participant_eliminated: cp.filter((p: any) => p.status === 'eliminated').length,
            };
        });

        return NextResponse.json({ success: true, challenges: enriched });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const {
            name, theme = 'gold', description = '',
            duration_days, tasks_per_day, window_minutes,
            points_per_completion = 20,
            first_place_points = 10, second_place_points = 7, third_place_points = 5,
            start_date, image_url = null, task_times = null, task_names = null,
            // Evergreen fields
            is_evergreen = false, slot_duration_minutes = 360,
            evergreen_join_cost = null, evergreen_rejoin_cost = 1000,
            // Tiered fields
            is_tiered = false, tiers = null, task_pool = null,
        } = body;

        // Classic challenges require start_date; evergreen don't
        if (!name || !duration_days || !tasks_per_day)
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });

        if (!is_evergreen && !start_date)
            return NextResponse.json({ success: false, error: 'Classic challenges require a start date' }, { status: 400 });

        if (!is_evergreen && !window_minutes)
            return NextResponse.json({ success: false, error: 'Classic challenges require window_minutes' }, { status: 400 });

        const durationNum = Number(duration_days);
        const tpd = Number(tasks_per_day);

        if (is_tiered) {
            // ── TIERED CHALLENGE ──
            // Always evergreen + 1 task/day. Duration = max tier days.
            const tiersArr = Array.isArray(tiers) ? tiers : [];
            if (tiersArr.length === 0) {
                return NextResponse.json({ success: false, error: 'Tiered challenges need at least one tier' }, { status: 400 });
            }
            const maxDays = Math.max(...tiersArr.map((t: any) => Number(t.days)));
            const lowestCost = Math.min(...tiersArr.map((t: any) => Number(t.cost)));

            const { data: challenge, error: cErr } = await supabaseAdmin
                .from('challenges')
                .insert({
                    name, theme, description, status: 'active', is_template: false,
                    is_evergreen: true, is_tiered: true,
                    tiers: tiersArr,
                    duration_days: maxDays, tasks_per_day: 1,
                    window_minutes: Number(slot_duration_minutes) || 360,
                    slot_duration_minutes: Number(slot_duration_minutes) || 360,
                    evergreen_join_cost: lowestCost,
                    evergreen_rejoin_cost: Number(evergreen_rejoin_cost) || lowestCost,
                    points_per_completion: Number(points_per_completion),
                    first_place_points: Number(first_place_points),
                    second_place_points: Number(second_place_points),
                    third_place_points: Number(third_place_points),
                    start_date: null, end_date: null,
                    image_url: image_url || null,
                    task_names: null,
                })
                .select().single();

            if (cErr) throw cErr;

            // Insert task pool
            const poolTasks = Array.isArray(task_pool) ? task_pool : [];
            if (poolTasks.length > 0) {
                const poolRows = poolTasks.map((t: any) => ({
                    challenge_id: challenge.id,
                    task_name: t.task_name || '',
                    task_description: t.task_description || null,
                    difficulty: ['easy', 'medium', 'hard'].includes(t.difficulty) ? t.difficulty : 'medium',
                    is_milestone: !!t.is_milestone,
                    milestone_day: t.is_milestone ? (t.milestone_day || null) : null,
                }));
                const { error: poolErr } = await supabaseAdmin.from('challenge_task_pool').insert(poolRows);
                if (poolErr) throw poolErr;
            }

            // Create tier milestone badges + participant badge
            const badgeRows: { challenge_id: string; type: string; name: string; description: string; rarity: string; tier_level: string | null }[] = [
                { challenge_id: challenge.id, type: 'participant', name: `${name} - Participant`, description: `Joined the ${name} challenge`, rarity: 'common', tier_level: null },
            ];
            for (const tier of tiersArr) {
                const level = (tier.label || '').toLowerCase();
                badgeRows.push({
                    challenge_id: challenge.id,
                    type: 'tier_milestone',
                    name: `${name} - ${tier.label}`,
                    description: `Survived ${tier.days} days of ${name}`,
                    rarity: level === 'legendary' ? 'legendary' : level === 'gold' ? 'rare' : 'common',
                    tier_level: level,
                });
            }
            await supabaseAdmin.from('badges').insert(badgeRows);

            return NextResponse.json({
                success: true, challenge,
                windows_created: 0,
                is_tiered: true,
                tiers: tiersArr,
                pool_tasks: poolTasks.length,
            });
        }

        if (is_evergreen) {
            // ── EVERGREEN CHALLENGE ──
            const joinCost = evergreen_join_cost ?? getJoinCost(durationNum);

            const { data: challenge, error: cErr } = await supabaseAdmin
                .from('challenges')
                .insert({
                    name, theme, description, status: 'active', is_template: false,
                    is_evergreen: true,
                    duration_days: durationNum, tasks_per_day: tpd,
                    window_minutes: Number(slot_duration_minutes),
                    slot_duration_minutes: Number(slot_duration_minutes),
                    evergreen_join_cost: joinCost,
                    evergreen_rejoin_cost: Number(evergreen_rejoin_cost),
                    points_per_completion: Number(points_per_completion),
                    first_place_points: Number(first_place_points),
                    second_place_points: Number(second_place_points),
                    third_place_points: Number(third_place_points),
                    start_date: null, end_date: null,
                    image_url: image_url || null,
                    task_names: task_names || null,
                })
                .select().single();

            if (cErr) throw cErr;

            // No global windows for evergreen — they're generated per participant on join

            // Auto-create badge definitions
            await supabaseAdmin.from('badges').insert([
                { challenge_id: challenge.id, type: 'participant', name: `${name} - Participant`, description: `Joined the ${name} challenge`, rarity: 'common' },
                { challenge_id: challenge.id, type: 'finisher', name: `${name} - Finisher`, description: `Completed the ${name} challenge`, rarity: 'rare' },
                { challenge_id: challenge.id, type: 'champion', name: `${name} - Champion`, description: `Won the ${name} challenge`, rarity: 'legendary' },
            ]);

            return NextResponse.json({ success: true, challenge, windows_created: 0, is_evergreen: true });
        }

        // ── CLASSIC CHALLENGE (unchanged) ──
        const wmin = Number(window_minutes);
        const startDt = new Date(start_date);
        const endDt = new Date(startDt);
        endDt.setDate(endDt.getDate() + durationNum);

        const { data: challenge, error: cErr } = await supabaseAdmin
            .from('challenges')
            .insert({
                name, theme, description, status: 'draft', is_template: true,
                duration_days: durationNum, tasks_per_day: tpd,
                window_minutes: wmin,
                points_per_completion: Number(points_per_completion),
                first_place_points: Number(first_place_points),
                second_place_points: Number(second_place_points),
                third_place_points: Number(third_place_points),
                start_date: startDt.toISOString(),
                end_date: endDt.toISOString(),
                image_url: image_url || null,
                task_names: task_names || null,
            })
            .select().single();

        if (cErr) throw cErr;

        // Generate windows - use provided task_times or distribute evenly 08:00–22:00
        const windows: any[] = [];
        for (let day = 1; day <= durationNum; day++) {
            const dayDate = new Date(startDt);
            dayDate.setDate(dayDate.getDate() + (day - 1));
            const dayTimes = task_times && Array.isArray(task_times[0]) ? task_times[day - 1] : task_times;
            for (let w = 0; w < tpd; w++) {
                let opensAt: Date;
                if (dayTimes && Array.isArray(dayTimes) && dayTimes[w]) {
                    const [h, m] = (dayTimes[w] as string).split(':').map(Number);
                    opensAt = new Date(dayDate);
                    opensAt.setHours(h, m, 0, 0);
                } else {
                    const interval = Math.floor((14 * 60) / (tpd + 1));
                    opensAt = new Date(dayDate);
                    opensAt.setHours(8, 0, 0, 0);
                    opensAt.setMinutes(opensAt.getMinutes() + interval * (w + 1));
                }
                const closesAt = new Date(opensAt);
                closesAt.setMinutes(closesAt.getMinutes() + wmin);
                windows.push({
                    challenge_id: challenge.id,
                    day_number: day,
                    window_number: w + 1,
                    opens_at: opensAt.toISOString(),
                    closes_at: closesAt.toISOString(),
                    verification_code: Math.floor(10000 + Math.random() * 90000),
                });
            }
        }

        const { error: wErr } = await supabaseAdmin.from('challenge_windows').insert(windows);
        if (wErr) throw wErr;

        // Auto-create 3 badge definitions
        await supabaseAdmin.from('badges').insert([
            { challenge_id: challenge.id, type: 'participant', name: `${name} - Participant`, description: `Joined the ${name} challenge`, rarity: 'common' },
            { challenge_id: challenge.id, type: 'finisher', name: `${name} - Finisher`, description: `Completed the ${name} challenge`, rarity: 'rare' },
            { challenge_id: challenge.id, type: 'champion', name: `${name} - Champion`, description: `Won the ${name} challenge`, rarity: 'legendary' },
        ]);

        return NextResponse.json({ success: true, challenge, windows_created: windows.length });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
