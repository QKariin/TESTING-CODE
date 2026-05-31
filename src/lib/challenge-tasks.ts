/**
 * Tiered Challenge — Task Assignment Engine
 *
 * Picks milestone tasks for milestone days + random pool tasks for other days.
 * Excludes tasks the user has been assigned in previous attempts.
 * Weights random picks by difficulty (easy early, hard late).
 */

import { supabaseAdmin } from '@/lib/supabase';

interface TaskPoolEntry {
    id: string;
    task_name: string;
    task_description: string | null;
    difficulty: 'easy' | 'medium' | 'hard';
    is_milestone: boolean;
    milestone_day: number | null;
}

export interface TierDef {
    days: number;
    label: string;
    cost: number;
}

export interface TaskAssignment {
    day_number: number;
    task_name: string;
    task_pool_id: string;
}

export type ChallengeDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Which pool difficulties are eligible for each user-chosen difficulty:
 *   easy   → easy + medium tasks
 *   medium → all tasks (easy + medium + hard)
 *   hard   → medium + hard tasks only
 */
const DIFFICULTY_FILTER: Record<ChallengeDifficulty, ChallengeDifficulty[]> = {
    easy:   ['easy', 'medium'],
    medium: ['easy', 'medium', 'hard'],
    hard:   ['medium', 'hard'],
};

/**
 * Assign tasks from pool for a range of days.
 * Milestone tasks land on their fixed day. Other days get random pool picks.
 * Previously assigned tasks (across all attempts) are excluded when possible.
 * Difficulty filters which pool tasks are eligible.
 */
export async function assignTasksForDays(
    challengeId: string,
    memberId: string,
    startDay: number,
    endDay: number,
    attemptNumber: number,
    difficulty: ChallengeDifficulty = 'medium',
): Promise<TaskAssignment[]> {
    const { data: pool } = await supabaseAdmin
        .from('challenge_task_pool')
        .select('id, task_name, task_description, difficulty, is_milestone, milestone_day')
        .eq('challenge_id', challengeId);

    if (!pool || pool.length === 0) return [];

    const milestones = pool.filter((t: any) => t.is_milestone && t.milestone_day != null);
    const allRegular = pool.filter((t: any) => !t.is_milestone) as TaskPoolEntry[];

    // Filter pool by chosen difficulty
    const allowed = DIFFICULTY_FILTER[difficulty] || DIFFICULTY_FILTER.medium;
    let regularPool = allRegular.filter(t => allowed.includes(t.difficulty));
    // Fallback: if filtering leaves nothing, use all
    if (regularPool.length === 0) regularPool = allRegular;

    // Past assignments for this member (all attempts)
    const { data: pastAssignments } = await supabaseAdmin
        .from('challenge_task_assignments')
        .select('task_pool_id')
        .eq('challenge_id', challengeId)
        .eq('member_id', memberId);

    const usedIds = new Set((pastAssignments || []).map((a: any) => a.task_pool_id));
    const newlyUsedIds = new Set<string>();

    const assignments: TaskAssignment[] = [];

    for (let day = startDay; day <= endDay; day++) {
        // Fixed milestone?
        const milestone = milestones.find((m: any) => m.milestone_day === day);
        if (milestone) {
            assignments.push({
                day_number: day,
                task_name: milestone.task_name,
                task_pool_id: milestone.id,
            });
            continue;
        }

        // Random from pool
        let available = regularPool.filter((t: TaskPoolEntry) => !usedIds.has(t.id) && !newlyUsedIds.has(t.id));

        // Fallback: if exhausted, allow repeats but avoid this attempt's picks
        if (available.length === 0) {
            available = regularPool.filter((t: TaskPoolEntry) => !newlyUsedIds.has(t.id));
        }
        // Last resort: pick anything
        if (available.length === 0) {
            available = [...regularPool];
        }

        // Weighted pick by difficulty vs day progress
        const progress = (day - startDay) / Math.max(endDay - startDay, 1);
        const pick = weightedPick(available, progress);

        newlyUsedIds.add(pick.id);
        assignments.push({
            day_number: day,
            task_name: pick.task_name,
            task_pool_id: pick.id,
        });
    }

    // Persist assignments
    if (assignments.length > 0) {
        await supabaseAdmin.from('challenge_task_assignments').insert(
            assignments.map(a => ({
                challenge_id: challengeId,
                member_id: memberId,
                day_number: a.day_number,
                task_pool_id: a.task_pool_id,
                attempt_number: attemptNumber,
            }))
        );
    }

    return assignments;
}

/** Weighted random: easy tasks early, hard tasks late */
function weightedPick(pool: TaskPoolEntry[], progress: number): TaskPoolEntry {
    const weighted = pool.map(t => {
        let weight = 1;
        if (t.difficulty === 'easy' && progress < 0.3) weight = 3;
        else if (t.difficulty === 'medium' && progress >= 0.3 && progress < 0.7) weight = 3;
        else if (t.difficulty === 'hard' && progress >= 0.7) weight = 3;
        return { task: t, weight };
    });

    const total = weighted.reduce((s, w) => s + w.weight, 0);
    let rand = Math.random() * total;
    for (const w of weighted) {
        rand -= w.weight;
        if (rand <= 0) return w.task;
    }
    return weighted[weighted.length - 1].task;
}

/** Find which tier a day count corresponds to */
export function getTierForDays(tiers: TierDef[], days: number): TierDef | null {
    return tiers.find(t => t.days === days) || null;
}

/** Get the next tier above the current one */
export function getNextTier(tiers: TierDef[], currentDays: number): TierDef | null {
    const sorted = [...tiers].sort((a, b) => a.days - b.days);
    const idx = sorted.findIndex(t => t.days === currentDays);
    if (idx === -1 || idx === sorted.length - 1) return null;
    return sorted[idx + 1];
}

/** Get all tiers sorted ascending */
export function getSortedTiers(tiers: TierDef[]): TierDef[] {
    return [...tiers].sort((a, b) => a.days - b.days);
}
