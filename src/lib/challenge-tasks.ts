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
    // Per-difficulty pricing
    cost_soft?: number;
    cost_strict?: number;
    cost_brutal?: number;
    // Daily cashback (awarded on perfect days)
    daily_soft?: number;
    daily_strict?: number;
    daily_brutal?: number;
    // Finish bonus (awarded on tier completion)
    finish_soft?: number;
    finish_strict?: number;
    finish_brutal?: number;
}

/** Display names for difficulties */
export const DIFFICULTY_DISPLAY: Record<ChallengeDifficulty, string> = {
    easy: 'Soft',
    medium: 'Strict',
    hard: 'Brutal',
};

/** Tasks per day by difficulty (includes morning photo) */
export const TASKS_PER_DAY: Record<ChallengeDifficulty, number> = {
    easy: 2,   // 1 morning photo + 1 pool task
    medium: 3, // 1 morning photo + 2 pool tasks
    hard: 5,   // 1 morning photo + 4 pool tasks
};

/** Get tier cost for a specific difficulty */
export function getTierCost(tier: TierDef, difficulty: ChallengeDifficulty): number {
    if (difficulty === 'easy') return tier.cost_soft ?? tier.cost;
    if (difficulty === 'hard') return tier.cost_brutal ?? tier.cost;
    return tier.cost_strict ?? tier.cost;
}

/** Get daily cashback amount for a specific difficulty */
export function getDailyCashback(tier: TierDef, difficulty: ChallengeDifficulty): number {
    if (difficulty === 'easy') return tier.daily_soft ?? 0;
    if (difficulty === 'hard') return tier.daily_brutal ?? 0;
    return tier.daily_strict ?? 0;
}

/** Get finish bonus for a specific difficulty */
export function getFinishBonus(tier: TierDef, difficulty: ChallengeDifficulty): number {
    if (difficulty === 'easy') return tier.finish_soft ?? 0;
    if (difficulty === 'hard') return tier.finish_brutal ?? 0;
    return tier.finish_strict ?? 0;
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
 *
 * tasksPerDay: how many POOL tasks per day (excludes the daily morning task).
 *   - Soft (easy): 1 pool task/day
 *   - Strict (medium): 2 pool tasks/day
 *   - Brutal (hard): 4 pool tasks/day
 */
export async function assignTasksForDays(
    challengeId: string,
    memberId: string,
    startDay: number,
    endDay: number,
    attemptNumber: number,
    difficulty: ChallengeDifficulty = 'medium',
    poolTasksPerDay: number = 1,
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
        // Fixed milestone? Always takes the first slot
        const milestone = milestones.find((m: any) => m.milestone_day === day);
        if (milestone) {
            assignments.push({
                day_number: day,
                task_name: milestone.task_name,
                task_pool_id: milestone.id,
            });
        }

        // How many pool tasks this day needs
        const poolNeeded = milestone ? Math.max(0, poolTasksPerDay - 1) : poolTasksPerDay;

        for (let t = 0; t < poolNeeded; t++) {
            let available = regularPool.filter((tk: TaskPoolEntry) => !usedIds.has(tk.id) && !newlyUsedIds.has(tk.id));
            if (available.length === 0) {
                available = regularPool.filter((tk: TaskPoolEntry) => !newlyUsedIds.has(tk.id));
            }
            if (available.length === 0) {
                available = [...regularPool];
            }

            const progress = (day - startDay) / Math.max(endDay - startDay, 1);
            const pick = weightedPick(available, progress);

            newlyUsedIds.add(pick.id);
            assignments.push({
                day_number: day,
                task_name: pick.task_name,
                task_pool_id: pick.id,
            });
        }
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
