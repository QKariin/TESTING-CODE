'use server';

import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';
import { HIERARCHY_RULES, determineRank, getHierarchyReport, HierarchyReport, SlaveRecord } from '@/lib/hierarchyRules';
import { z } from 'zod';

// --- SUPABASE ADMIN CLIENT (Bypasses RLS) ---
// Initialize with SERVICE_ROLE_KEY for backend operations
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

// --- HELPER: GET PROFILE ---
async function getProfile(memberId: string) {
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('member_id', memberId)
        .single();

    if (error || !data) return null;
    return data;
}

// --- HELPER: UPDATE PROFILE ---
async function updateProfile(id: string, updates: any) {
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

// --- 1. GET HIERARCHY REQUIREMENTS ---
export async function getHierarchyRequirements() {
    return HIERARCHY_RULES;
}

// --- 2. SECURE GET PROFILE ---
export async function secureGetProfile(memberId: string) {
    try {
        const profile = await getProfile(memberId);
        if (profile) return { success: true, profile };
        return { success: false, error: "User not found" };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// --- 3. UPDATE SCORE ACTION ---
export async function updateScoreAction(memberId: string, amount: number) {
    try {
        const profile = await getProfile(memberId);
        if (profile) {
            const newScore = (profile.score || 0) + amount;

            // Convert Supabase profile to SlaveRecord for logic check
            const slaveRecord: SlaveRecord = { ...profile, score: newScore };
            const report = getHierarchyReport(slaveRecord);

            await updateProfile(profile.id, {
                score: newScore,
                hierarchy: report.currentRank
            });

            return { item: { ...profile, score: newScore, hierarchy: report.currentRank }, report };
        }
        return null;
    } catch (e) {
        console.error("updateScoreAction Error", e);
        return null;
    }
}

// --- 4. SECURE UPDATE TASK (The Brain) ---
export async function secureUpdateTaskAction(memberId: string, updateData: any) {
    try {
        const profile = await getProfile(memberId);
        if (!profile) return { success: false };

        let needsUpdate = false;
        let updates: any = {};

        // --- History Parsing ---
        let history: any[] = [];
        // Handle both JSONB (array) or stringified JSON if migrated poorly
        if (Array.isArray(profile.routine_history)) {
            history = profile.routine_history;
        } else if (typeof profile.routine_history === 'string') {
            try { history = JSON.parse(profile.routine_history); } catch (e) { history = []; }
        }

        // --- Task Queue ---
        // Mapping: item.taskQueue -> profile.task_queue
        if (updateData.taskQueue) {
            updates.task_queue = updateData.taskQueue;
            needsUpdate = true;
        }

        // --- Consume Queue ---
        if (updateData.consumeQueue === true) {
            let currentQueue = updates.task_queue || profile.task_queue || [];
            if (currentQueue.length > 0) {
                currentQueue.shift(); // Remove first item
                updates.task_queue = currentQueue;
                needsUpdate = true;
            }
        }

        // --- Pending State ---
        // Mapping: item.taskdom_pending_state -> profile.parameters.taskdom_pending_state
        if (updateData.pendingState) {
            updates.parameters = { ...(profile.parameters || {}), taskdom_pending_state: updateData.pendingState };
            needsUpdate = true;
        }

        // --- Upload Evidence ---
        if (updateData.addToQueue && updateData.addToQueue.proofUrl) {
            history.unshift({
                id: updateData.addToQueue.id,
                text: updateData.addToQueue.text,
                proofUrl: updateData.addToQueue.proofUrl,
                proofType: updateData.addToQueue.proofType,
                timestamp: new Date().toISOString(),
                status: 'pending',
                completed: false
            });
            updates.routine_history = history;

            // Clear active task state
            if (updateData.addToQueue.category === "Task") {
                const currentParams = updates.parameters || profile.parameters || {};
                updates.parameters = {
                    ...currentParams,
                    taskdom_active_task: null,
                    taskdom_pending_state: null
                };
            }

            // --- Routine Streak Logic ---
            if (updateData.addToQueue.isRoutine === true) {
                // We need to implement updateStreakLogic equivalent for Supabase
                // For now, assuming basic increment or reusing library logic if portable
                // simplistic fallback:
                const currentStreak = profile.routinestreak || 0; // mapped column? or param?
                // updates.routinestreak = currentStreak + 1; // Logic needed
            }

            needsUpdate = true;
        }

        // --- Skip Logic ---
        if (updateData.wasSkipped === true) {
            history.unshift({
                id: Date.now().toString(),
                text: updateData.taskTitle || "Task Skipped",
                status: "fail",
                timestamp: new Date().toISOString(),
                proofUrl: "SKIPPED"
            });
            updates.routine_history = history;

            // Reset Streak (params or column)
            const currentParams = updates.parameters || profile.parameters || {};
            updates.parameters = {
                ...currentParams,
                taskdom_current_streak: 0,
                taskdom_active_task: null,
                taskdom_pending_state: null
            };
            needsUpdate = true;
        }

        // --- Clear Logic ---
        if (updateData.clear === true) {
            const currentParams = updates.parameters || profile.parameters || {};
            updates.parameters = {
                ...currentParams,
                taskdom_active_task: null,
                taskdom_pending_state: null
            };
            needsUpdate = true;
        }

        if (needsUpdate) {
            // Recalculate Rank
            // Construct temporary record merging existing profile + updates
            const mergedParams = { ...(profile.parameters || {}), ...(updates.parameters || {}) };
            const tempRecord: SlaveRecord = {
                ...profile,
                ...updates,
                ...mergedParams // Flatten params for logic check
            };

            const report = getHierarchyReport(tempRecord);
            updates.hierarchy = report.currentRank;

            await updateProfile(profile.id, updates);
            return { success: true, report };
        }

        return { success: false };

    } catch (error) {
        console.error("Backend Save Error:", error);
        return { success: false };
    }
}

// --- 5. PROCESS COIN TRANSACTION ---
export async function processCoinTransaction(memberId: string, amount: number, reason: string) {
    try {
        const profile = await getProfile(memberId);
        if (!profile) return { success: false, error: "User not found" };

        const currentWallet = profile.wallet || 0;

        // Check Balance
        if (amount < 0 && currentWallet < Math.abs(amount)) {
            return { success: false, error: "Insufficient funds" };
        }

        let updates: any = {
            wallet: currentWallet + amount
        };

        // Track Spent
        if (amount < 0) {
            updates.total_coins_spent = (profile.total_coins_spent || 0) + Math.abs(amount);
        }

        // Log Transaction (reward_vault or parameters.tributeHistory)
        // Schema says 'reward_vault'. Let's use that or add a specific history param.
        // Velo used 'tributeHistory'. Let's stick to parameters or a JSONB column.
        // Mapped to: reward_vault (if that's what it is) or parameters.tributeHistory
        // Let's use parameters for now to be safe.
        let tributeHistory: any[] = [];
        const params = profile.parameters || {};
        try {
            if (params.tributeHistory) {
                tributeHistory = typeof params.tributeHistory === 'string' ? JSON.parse(params.tributeHistory) : params.tributeHistory;
            }
        } catch (e) { }

        if (amount > 0 || reason.includes("Purchase") || reason.includes("Tribute")) {
            tributeHistory.unshift({
                amount: amount,
                message: reason,
                date: new Date().toISOString(),
                type: amount > 0 ? 'income' : 'expense'
            });
            if (tributeHistory.length > 50) tributeHistory = tributeHistory.slice(0, 50);

            updates.parameters = { ...params, tributeHistory };
        }

        // Recalculate Rank
        const tempRecord: SlaveRecord = { ...profile, ...updates };
        const report = getHierarchyReport(tempRecord);
        updates.hierarchy = report.currentRank;

        await updateProfile(profile.id, updates);
        return { success: true, newBalance: updates.wallet, report };

    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// --- 6. UPDATE PROFILE ACTION ---
export async function updateProfileAction(memberId: string, data: any) {
    try {
        const profile = await getProfile(memberId);
        if (!profile) return { success: false, error: "User not found" };

        let cost = 0;
        if (data.name) cost += 100;
        if (data.photo) cost += 200;
        if (data.limits && Array.isArray(data.limits)) cost += (data.limits.length * 200);
        if (data.kinks && Array.isArray(data.kinks)) cost += (data.kinks.length * 100);

        if ((profile.wallet || 0) < cost) {
            return { success: false, error: `INSUFFICIENT FUNDS. REQUIRED: ${cost}, BAL: ${profile.wallet}` };
        }

        let updates: any = {
            wallet: (profile.wallet || 0) - cost,
            total_coins_spent: (profile.total_coins_spent || 0) + cost
        };

        if (data.name) updates.title = data.name; // Mapping title -> name? Schema has 'name', Velo has 'title'
        // Schema: name TEXT. Velo: title. Let's map to 'name'.
        if (data.name) updates.name = data.name;

        if (data.photo !== undefined) {
            updates.profile_picture_url = data.photo || null; // Mapping image -> profile_picture_url
        }
        if (data.limits) updates.limits = JSON.stringify(data.limits); // Schema is TEXT
        if (data.kinks) updates.kinks = JSON.stringify(data.kinks);   // Schema is TEXT

        const tempRecord = { ...profile, ...updates };
        const report = getHierarchyReport(tempRecord);
        updates.hierarchy = report.currentRank;

        await updateProfile(profile.id, updates);
        return { success: true, hierarchy: updates.hierarchy, report, cost, newBalance: updates.wallet };

    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// --- 7. STRIPE SUBSCRIPTION ---
// --- 7. STRIPE SUBSCRIPTION ---
export async function getSubscriptionLink(email: string) {
    try {
        if (!email) throw new Error("Email is required");

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            customer_email: email,
            line_items: [{
                price: 'price_1SZiB4LjyfeWKkoZO7g9iIYs',
                quantity: 1,
            }],
            mode: 'subscription',
            success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/private`,
            cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/`,
            metadata: {
                type: "SUBSCRIPTION_55",
                email: email
            }
        });

        return session.url;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

// --- 8. REVIEW TASK (Admin) ---
export async function reviewTaskAction(memberId: string, decision: 'approve' | 'reject', submissionId: string) {
    try {
        const profile = await getProfile(memberId);
        if (!profile) return null;

        let history: any[] = [];
        if (Array.isArray(profile.routine_history)) {
            history = profile.routine_history;
        } else if (typeof profile.routine_history === 'string') {
            try { history = JSON.parse(profile.routine_history); } catch (e) { history = []; }
        }

        const taskIndex = history.findIndex((t: any) =>
            t.id === submissionId ||
            (t.status === 'pending' && t.proofUrl)
        );

        if (taskIndex > -1) {
            history[taskIndex].status = decision;
            history[taskIndex].completed = (decision === 'approve');

            let updates: any = { routine_history: history };

            // Counters
            let params = profile.parameters || {};

            if (decision === 'approve') {
                params.taskdom_completed_tasks = (params.taskdom_completed_tasks || 0) + 1;
                params.taskdom_current_streak = (params.taskdom_current_streak || 0) + 1;
            } else if (decision === 'reject') {
                params.taskdom_current_streak = 0;
            }
            updates.parameters = params;

            // Rank
            const tempRecord = { ...profile, ...updates, ...params };
            const report = getHierarchyReport(tempRecord);
            updates.hierarchy = report.currentRank;

            await updateProfile(profile.id, updates);
            return { item: { ...profile, ...updates }, report };
        }
        return null;

    } catch (e) {
        console.error("Review Error:", e);
        return null;
    }
}

// --- 9. PRESENCE (Last Seen) ---
export async function updatePresenceAction(memberId: string) {
    await updateProfile(memberId, { last_active: new Date().toISOString() });
}

// --- 10. SEND SLAVE MESSAGE (Stub) ---
export async function SendSlaveMessageAction(sender: string, type: string, message: string) {
    return true;
}
