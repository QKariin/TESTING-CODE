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

// --- 1.b GET UPLOAD URL (Stub for Storage) ---
export async function getProfileUploadUrl() {
    // TODO: Implement Supabase Storage Presigned URL generation
    // const { data, error } = await supabaseAdmin.storage.from('uploads').createSignedUrl('folder/file.png', 60);
    return { success: true, url: "" };
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

// --- 6.b HIERARCHY OVERRIDE (From Slave Record App) ---
export async function setHierarchyAction(memberId: string, newRank: string) {
    try {
        const profile = await getProfile(memberId);
        if (!profile) return { success: false, error: "User not found" };

        await updateProfile(profile.id, { hierarchy: newRank });

        // Return report for new state
        const updatedProfile = { ...profile, hierarchy: newRank };
        const report = getHierarchyReport(updatedProfile);

        return { success: true, report };
    } catch (e: any) {
        console.error("setHierarchyAction Error", e);
        return { success: false, error: e.message };
    }
}

export async function getHierarchyReportAction(memberId: string) {
    try {
        const profile = await getProfile(memberId);
        if (profile) {
            const report = getHierarchyReport(profile);

            // --- AUTO-MIGRATE Check (Ported from Velo) ---
            const consistencyReq = report.requirements.find(r => r.id === "streak");
            if (consistencyReq && consistencyReq.type === "bar") {
                let changed = false;
                let updates: any = {};
                // Mapped columns: bestRoutinestreak -> best_routine_streak? No, schema says 'parameters' likely or not defined.
                // Looking at hierarchyRules interface: bestRoutinestreak, routinestreak
                // Let's assume these are in 'parameters' or added columns.
                // Schema has 'routine' (text), 'routine_history' (jsonb). NO explicit streak columns in SQL.
                // So we should update 'parameters' JSONB or just skip for now.
                // I will skip the database update part for now to avoid errors, just return report.
            }
            return { success: true, report };
        }
        return { success: false, error: "User not found" };
    } catch (e: any) { return { success: false, error: e.message }; }
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

// --- 11. CHAT MESSAGES (Backend/chat.web.js) ---
export async function insertMessage(msgData: any) {
    try {
        let msgType = msgData.type || 'text';
        const msgContent = msgData.message || "";

        // --- FIX: BETTER MEDIA DETECTION ---
        // Detects Cloudinary, Bytescale (upcdn), and standard file extensions
        if (msgContent.includes("cloudinary.com") || msgContent.includes("upcdn.io") || msgContent.includes("wix:image") || msgContent.includes("wix:video")) {
            if (msgContent.includes("/video/") || msgContent.endsWith(".mp4") || msgContent.endsWith(".mov") || msgContent.includes("wix:video")) {
                msgType = 'video';
            } else {
                msgType = 'image';
            }
        }

        const toInsert = {
            member_id: msgData.memberId,
            sender: msgData.sender,
            message: (msgType === 'text') ? msgContent : null,
            media_url: (msgType !== 'text') ? msgContent : null,
            read: msgData.read || false,
            created_at: new Date().toISOString()
        };

        const { data: insertedItem, error } = await supabaseAdmin
            .from('messages')
            .insert(toInsert)
            .select()
            .single();

        if (error) throw error;

        // 2. TRIGGER NOTIFICATION LIGHT
        if (msgData.sender !== "admin" && msgData.sender !== "system") {
            try {
                const profile = await getProfile(msgData.memberId);
                if (profile) {
                    const params = profile.parameters || {};
                    params.lastMessageTime = new Date().toISOString(); // Pink Light

                    if (msgType === 'text') {
                        params.previewText = msgContent;
                    } else {
                        params.previewText = "📷 Media Sent";
                    }

                    await updateProfile(profile.id, { parameters: params });
                }
            } catch (error) {
                console.log("Pink Light Update Failed:", error);
            }
        }

        return insertedItem;

    } catch (error: any) {
        console.error("Insert Message Error", error);
        return { success: false, error: error.message };
    }
}

export async function loadUserMessages(memberId: string) {
    try {
        const { data, error } = await supabaseAdmin
            .from('messages')
            .select('*')
            .eq('member_id', memberId)
            .order('created_at', { ascending: false }) // Descending creation date
            .limit(50);

        if (error) throw error;

        // Return reversed (oldest first) for chat UI, mimicking Velo logic
        return (data || []).reverse();
    } catch (e: any) {
        return [];
    }
}


// --- 12. DASHBOARD CONTROLLER (backend/DashboardController.jsw) ---

// --- HELPER: Fix WIX URLs ---
function fixUrl(url: string) {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    if (url.startsWith("wix:image")) return `https://static.wixstatic.com/media/${url.split('/')[3].split('#')[0]}`;
    if (url.startsWith("wix:video")) return `https://video.wixstatic.com/video/${url.split('/')[3].split('#')[0]}/mp4/file.mp4`;
    return url;
}

// --- 1. GET ALL USERS & TASKS ---
export async function getMasterData() {
    try {
        const { data: profiles, error } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .limit(1000);

        if (error) throw error;

        return (profiles || []).map((item: any) => {
            // 1. Parse Queue (Handle CSV Text vs Array)
            let queue: any[] = [];
            // Map taskdom_review_queue -> task_queue (Schema)
            // But Velo code says taskdom_review_queue. 
            // In schema we have 'task_queue'. Let's use that.
            let rawQueue = item.task_queue || item.taskdom_review_queue;

            if (rawQueue) {
                if (typeof rawQueue === 'string') {
                    try { queue = JSON.parse(rawQueue); } catch (e) { }
                } else if (Array.isArray(rawQueue)) {
                    queue = rawQueue;
                }
            }

            // 2. Fix URLs for HTML Display
            queue = queue.map((q: any) => ({
                ...q,
                proofUrl: fixUrl(q.proofUrl)
            }));

            // 3. Return Clean Object
            return {
                id: item.member_id || item.id,
                name: item.name || item.title || "Unknown",
                hierarchy: item.hierarchy || "Newbie",
                score: Number(item.score || 0),
                wallet: Number(item.wallet || 0),
                queue: queue,
                // Pass raw item for other fields if needed
                _raw: item
            };
        });
    } catch (err) {
        console.error("Dashboard Data Error:", err);
        return [];
    }
}

// --- 2. DECISION ENGINE (APPROVE/REJECT) ---
export async function adminReviewTask(userId: string, taskId: string, decision: 'approve' | 'reject') {
    try {
        // Find user by member_id
        const profile = await getProfile(userId);
        if (!profile) return false;

        let queue: any[] = [];
        let rawQueue = profile.task_queue || profile.taskdom_review_queue;
        if (typeof rawQueue === 'string') {
            try { queue = JSON.parse(rawQueue); } catch (e) { }
        } else if (Array.isArray(rawQueue)) {
            queue = rawQueue;
        }

        let history: any[] = [];
        let rawHistory = profile.routine_history || profile.taskdom_history;
        if (typeof rawHistory === 'string') {
            try { history = JSON.parse(rawHistory); } catch (e) { }
        } else if (Array.isArray(rawHistory)) {
            history = rawHistory;
        }

        // Find specific task
        const index = queue.findIndex((t: any) => t.id === taskId || (t.proofUrl && t.proofUrl.includes(taskId)));

        if (index > -1) {
            const task = queue[index];

            let updates: any = {};
            let params = profile.parameters || {};

            // Update stats based on decision
            if (decision === 'approve') {
                updates.score = (Number(profile.score) || 0) + 50;
                updates.wallet = (Number(profile.wallet) || 0) + 10;

                params.taskdom_completed_tasks = (Number(params.taskdom_completed_tasks) || 0) + 1;
                params.taskdom_streak = (Number(params.taskdom_streak) || 0) + 1; // Velo used Taskdom_Streak
            } else {
                params.taskdom_streak = 0;
            }
            updates.parameters = params;

            // Move to history
            const historyItem = { ...task, status: decision, reviewedAt: new Date().toISOString() };
            history.unshift(historyItem);
            queue.splice(index, 1);

            // Save back
            updates.task_queue = queue;
            updates.routine_history = history;

            await updateProfile(profile.id, updates);
            return true;
        }
        return false;

    } catch (err) {
        console.error("Review Error:", err);
        return false;
    }
}

// --- 3. CHAT SYSTEM (Admin View) ---
export async function getChatData(userId: string) {
    // Reusing loadUserMessages logic but strictly for admin use
    return await loadUserMessages(userId);
}

export async function sendAdminMessage(userId: string, text: string) {
    await insertMessage({
        memberId: userId,
        message: text,
        sender: "agent",
        read: true
    });
}

// --- 13. PROFILE STATS MANAGER (backend/profile.web.js) ---
export async function secureUpdateProfileStats(memberId: string, type: 'skipped' | 'completed' | 'approved' | 'rejected') {
    try {
        const profile = await getProfile(memberId);
        if (!profile) return false;

        let params = profile.parameters || {};
        let updates: any = {};

        // Initialize numeric fields if missing
        params.taskdom_total_tasks = Number(params.taskdom_total_tasks || 0);
        params.taskdom_current_streak = Number(params.taskdom_current_streak || 0);
        params.taskdom_skipped_tasks = Number(params.taskdom_skipped_tasks || 0);
        params.taskdom_completed_tasks = Number(params.taskdom_completed_tasks || 0);
        params.taskdom_approved_tasks = Number(params.taskdom_approved_tasks || 0);
        params.taskdom_rejected_tasks = Number(params.taskdom_rejected_tasks || 0);

        // Also map profile 'score'
        let currentScore = Number(profile.score || 0);

        if (type === "skipped") {
            params.taskdom_total_tasks++;
            params.taskdom_current_streak = 0;
            params.taskdom_skipped_tasks++;
        } else if (type === "completed") {
            params.taskdom_total_tasks++;
            params.taskdom_current_streak++;
            params.taskdom_completed_tasks++;
        } else if (type === "approved") {
            params.taskdom_approved_tasks++;
            currentScore += 5; // Specific logic from profile.web.js
            updates.score = currentScore;
        } else if (type === "rejected") {
            params.taskdom_rejected_tasks++;
        }

        updates.parameters = params;
        await updateProfile(profile.id, updates);

        return true;

    } catch (error) {
        console.error("secureUpdateProfileStats Save Error:", error);
        return false;
    }
}

// --- 14. REALTIME PUBLISH (backend/publish.js) ---
export async function sendMessage(memberId: string, text: string, sender: string) {
    // Determine read status based on sender
    const isRead = (sender === "agent");

    // Reuse insertMessage logic but with explicit sender
    // backend/publish.js uses 'Chat' collection. We map to 'messages'.
    // It also triggers a 'chatChannel' publish. In Supabase, clients subscribe to 'messages' table changes.
    // So the INSERT itself acts as the publish.

    return await insertMessage({
        memberId: memberId,
        message: text,
        sender: sender,
        read: isRead
    });
}
