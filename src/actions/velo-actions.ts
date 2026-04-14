'use server';

import { createClient } from '@supabase/supabase-js';
import { mapUserProfile } from '@/lib/mapUserProfile';
import { stripe } from '@/lib/stripe';
import { HIERARCHY_RULES, determineRank, getHierarchyReport, HierarchyReport, SlaveRecord } from '@/lib/hierarchyRules';
import { z } from 'zod';
import { DbService } from '@/lib/supabase-service';

// --- SUPABASE ADMIN CLIENT (Bypasses RLS) ---
// Initialize with SERVICE_ROLE_KEY for backend operations
let _adminInstance: any = null;
function getAdmin() {
    if (!_adminInstance) {
        _adminInstance = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: { autoRefreshToken: false, persistSession: false }
            }
        );
    }
    return _adminInstance;
}

// --- HELPER: GET PROFILE ---
async function getProfile(memberId: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);
    let query = getAdmin().from('profiles').select('*');

    if (isUuid) {
        query = query.or(`member_id.eq.${memberId},id.eq.${memberId}`);
    } else {
        query = query.ilike('member_id', memberId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
        console.error("[getProfile] Error lookup:", error.message);
        return null;
    }
    return data;
}

// --- HELPER: UPDATE PROFILE ---
async function updateProfile(id: string, updates: any) {
    const { data, error } = await getAdmin()
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
    // const { data, error } = await getAdmin().storage.from('uploads').createSignedUrl('folder/file.png', 60);
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

// --- HELPER: MAP USER FOR DASHBOARD ---
function mapUserForDashboard(p: any, t: any) {
    return mapUserProfile(p, t);
}

// --- 2.b GET ADMIN DASHBOARD DATA ---
export async function getAdminDashboardData() {
    try {
        const { data: profiles, error: pError } = await getAdmin()
            .from('profiles')
            .select('*')
            .order('name');

        const { data: dailyTasks, error: tError } = await getAdmin()
            .from('daily_tasks')
            .select('*');

        const { data: globalSettings, error: sError } = await getAdmin()
            .from('system_rules')
            .select('*');

        const { data: tasksData } = await getAdmin()
            .from('tasks')
            .select('member_id, "Taskdom_History", "Tribute History", taskQueue, taskdom_active_task, taskdom_pending_state, "Taskdom_CompletedTasks", "kneelCount", "today kneeling", lastWorship, "Score"');

        if (pError) throw pError;

        // Map tasks data to profiles — match by UUID (correct) with email fallback (legacy rows)
        const finalProfiles = (profiles || []).map((p: any) => {
            const t = (tasksData || []).find((x: any) =>
                x.member_id === p.id ||
                (x.member_id || '').toLowerCase() === (p.member_id || '').toLowerCase()
            );
            return mapUserForDashboard(p, t);
        });

        // Build review queue from already-fetched tasks data — no extra DB call, no URL signing (proofs load on click)
        const reviewQueue: any[] = [];
        for (const row of (tasksData || [])) {
            let history: any[] = [];
            try { history = typeof row['Taskdom_History'] === 'string' ? JSON.parse(row['Taskdom_History']) : (row['Taskdom_History'] || []); } catch { }
            for (const entry of history.filter((e: any) => e.status === 'pending')) {
                reviewQueue.push({ ...entry, member_id: row.member_id });
            }
        }

        return {
            success: true,
            users: finalProfiles,
            dailyTasks: dailyTasks || [],
            customRules: globalSettings || [],
            globalQueue: reviewQueue
        };
    } catch (e: any) {
        console.error("Dashboard Data Fetch Error", e);
        return { success: false, users: [], dailyTasks: [], globalQueue: [] };
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

        // 1. Fetch from tasks table — try UUID first (correct), fall back to email (legacy)
        let { data: taskRow } = await getAdmin().from('tasks').select('*').eq('member_id', profile.id).maybeSingle();
        if (!taskRow && profile.member_id) {
            const { data: legacyRow } = await getAdmin().from('tasks').select('*').ilike('member_id', profile.member_id).maybeSingle();
            taskRow = legacyRow;
        }

        let needsUpdate = false;
        let taskUpdates: any = {};

        // --- History Parsing ---
        let history: any[] = [];
        if (taskRow && taskRow.Taskdom_History) {
            try {
                history = typeof taskRow.Taskdom_History === 'string'
                    ? JSON.parse(taskRow.Taskdom_History)
                    : taskRow.Taskdom_History;
            } catch (e) {
                history = [];
            }
        }

        // --- Task Queue ---
        let queue: any[] = [];
        if (taskRow && taskRow.taskQueue) {
            try {
                queue = typeof taskRow.taskQueue === 'string'
                    ? JSON.parse(taskRow.taskQueue)
                    : taskRow.taskQueue;
            } catch (e) { }
        }

        if (updateData.taskQueue) {
            taskUpdates.taskQueue = typeof updateData.taskQueue === 'string' ? updateData.taskQueue : JSON.stringify(updateData.taskQueue);
            needsUpdate = true;
            queue = updateData.taskQueue;
        }

        // --- Consume Queue ---
        if (updateData.consumeQueue === true) {
            if (queue.length > 0) {
                queue.shift(); // Remove first item
                taskUpdates.taskQueue = JSON.stringify(queue);
                needsUpdate = true;
            }
        }

        // --- Pending State ---
        if (updateData.pendingState !== undefined) {
            taskUpdates.taskdom_pending_state = updateData.pendingState ? updateData.pendingState : null;
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
            taskUpdates.Taskdom_History = JSON.stringify(history);

            // Clear active task state
            if (updateData.addToQueue.category === "Task") {
                taskUpdates.taskdom_active_task = null;
                taskUpdates.taskdom_pending_state = null;
            }

            // Force Direct Assignment if it's a Directive and comes from "Force Now"
            if (updateData.addToQueue.category === "Directive" && updateData.pendingState === "PENDING") {
                const endTime = Date.now() + (3600 * 1000); // 1 hour default
                taskUpdates.taskdom_active_task = JSON.stringify({ text: updateData.addToQueue.text });
                // We don't have taskdom_end_time in tasks table natively in SQL schema, storing in active_task object is safer
                taskUpdates.taskdom_active_task = JSON.stringify({
                    text: updateData.addToQueue.text,
                    endTime: endTime
                });
                taskUpdates.taskdom_pending_state = "PENDING";
            }

            needsUpdate = true;
            taskUpdates.Status = 'pending'; // Reflect overall status
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
            taskUpdates.Taskdom_History = JSON.stringify(history);
            taskUpdates.taskdom_active_task = null;
            taskUpdates.taskdom_pending_state = null;

            // Deduct 300 coins from wallet
            const currentWallet = Number(taskRow?.Wallet || 0);
            taskUpdates.Wallet = Math.max(0, currentWallet - 300);

            needsUpdate = true;

            // Sync wallet to profiles table
            try {
                const profileWallet = Number(profile.wallet || 0);
                await getAdmin().from('profiles')
                    .update({ wallet: Math.max(0, profileWallet - 300) })
                    .ilike('member_id', memberId);
            } catch (_) {}
        }

        // --- Clear Logic ---
        if (updateData.clear === true) {
            taskUpdates.taskdom_active_task = null;
            taskUpdates.taskdom_pending_state = null;
            needsUpdate = true;
        }

        // --- Force Active Task ---
        if (updateData.forceActive) {
            const endTime = Date.now() + (24 * 3600 * 1000); // 24 hours
            taskUpdates.taskdom_active_task = JSON.stringify({
                text: updateData.forceActive.text,
                TaskText: updateData.forceActive.text,
                tasktext: updateData.forceActive.text,
                endTime: endTime,
                assigned_at: new Date().toISOString(),
                category: updateData.forceActive.category || "Directive"
            });
            taskUpdates.taskdom_pending_state = null; // Setting to null makes it ACTIVE, not pending review
            needsUpdate = true;
        }

        if (needsUpdate) {
            let result;
            if (taskRow) {
                // Update using whatever member_id the existing row has (UUID or legacy email)
                result = await getAdmin().from('tasks').update(taskUpdates).eq('member_id', taskRow.member_id);
            } else {
                // New row: always use UUID
                result = await getAdmin().from('tasks').insert({
                    member_id: profile.id,
                    Name: profile.name || 'Slave',
                    ...taskUpdates
                });
            }

            // Sync with Realtime via Chat System Message if it was forced
            if (updateData.forceActive) {
                try {
                    await getAdmin().from('chats').insert({
                        member_id: member_id,
                        sender: 'system',
                        sender_email: 'system',
                        message: `NEW DIRECTIVE ASSIGNED`,
                        content: `NEW DIRECTIVE ASSIGNED: ${updateData.forceActive.text}`,
                        type: 'system',
                        is_read: false
                    });
                } catch (e) {
                    console.error("Failed to push realtime task sync message:", e);
                }
            }
            // Return success without full report calculation for simple updates
            return { success: !result.error };
        }

        return { success: false };

    } catch (error) {
        console.error("Backend Save Error:", error);
        return { success: false };
    }
}

// --- 23. HIERARCHY MAINTENANCE (Service Plugin: Assignment) ---
export async function runHierarchyMaintenance() {
    try {
        let skip = 0;
        const limit = 50;
        let hasMore = true;
        let totalUpdated = 0;

        while (hasMore) {
            const { data: profiles, error } = await getAdmin()
                .from('profiles')
                .select('*')
                .range(skip, skip + limit - 1);

            if (error || !profiles || profiles.length === 0) {
                hasMore = false;
                break;
            }

            console.log(`Fetched ${profiles.length} profiles at offset ${skip}`);

            const updates = profiles.map(async (profile: any) => {
                const tempRecord: SlaveRecord = { ...profile };
                const newRank = determineRank(tempRecord);

                if (profile.hierarchy !== newRank) {
                    console.log(`Updating ${profile.name}: ${profile.hierarchy} -> ${newRank}`);
                    await updateProfile(profile.id, { hierarchy: newRank });
                    return 1;
                }
                return 0;
            });

            const results = await Promise.all(updates);
            totalUpdated += results.reduce((a: number, b: number) => a + b, 0);

            skip += limit;
            if (profiles.length < limit) hasMore = false;
        }

        console.log(`Hierarchy update completed. Total updated: ${totalUpdated}`);
        return { success: true, updated: totalUpdated };

    } catch (e: any) {
        console.error("Hierarchy Maintenance Error:", e);
        return { success: false, error: e.message };
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
export async function adminApproveTaskAction(taskId: string, memberId: string, bonus: number, comment: string | null) {
    try {
        await DbService.approveTask(taskId, memberId, bonus, null, comment);
        return { success: true };
    } catch (e: any) {
        console.error("adminApproveTaskAction error:", e);
        return { success: false, error: e.message };
    }
}

export async function adminRejectTaskAction(taskId: string, memberId: string) {
    try {
        await DbService.rejectTask(taskId, memberId);
        return { success: true };
    } catch (e: any) {
        console.error("adminRejectTaskAction error:", e);
        return { success: false, error: e.message };
    }
}

export async function adminGetTasksAction() {
    try {
        const tasks = await DbService.getTasksFromDatabase();
        return { success: true, tasks: tasks || [] };
    } catch (e: any) {
        console.error("adminGetTasksAction error:", e);
        return { success: false, error: e.message };
    }
}

export async function adminAssignTaskAction(memberId: string, taskText: string) {
    try {
        await DbService.assignTask(memberId, { text: taskText });
        return { success: true };
    } catch (e: any) {
        console.error("adminAssignTaskAction error:", e);
        return { success: false, error: e.message };
    }
}

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
        // Detects Cloudinary, legacy upcdn, and standard file extensions
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

        const { data: insertedItem, error } = await getAdmin()
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
        const { data, error } = await getAdmin()
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


// --- 11b. UNREAD MESSAGE STATUS (for dashboard notifications) ---
// Queries the 'chats' table (same table used by /api/chat/send + /api/chat/history)
export async function getUnreadMessageStatus(): Promise<Record<string, string>> {
    try {
        const { data, error } = await getAdmin()
            .from('chats')
            .select('member_id, created_at, metadata, type, sender_email')
            .order('created_at', { ascending: false })
            .limit(500);
        if (error || !data) return {};
        // Keep only the latest real user message per member — skip admin and system messages
        const result: Record<string, string> = {};
        for (const row of data) {
            if (!row.member_id) continue;
            const key = row.member_id.toLowerCase();
            if (result[key]) continue; // already have a newer one
            const isQueenMsg = row.metadata?.isQueen === true;
            const isSystemMsg = row.type === 'system' || (row.sender_email || '').toLowerCase() === 'system';
            if (!isQueenMsg && !isSystemMsg) {
                result[key] = row.created_at;
            }
        }
        return result;
    } catch {
        return {};
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
        const { data: profiles, error: pError } = await getAdmin()
            .from('profiles')
            .select('*')
            .limit(1000);

        const { data: tasks, error: tError } = await getAdmin()
            .from('tasks')
            .select('*')
            .limit(1000);

        if (pError) throw pError;

        return (profiles || []).map((item: any) => {
            const uTasks = (tasks || []).find((t: any) =>
                t.member_id === item.id ||
                (t.member_id || '').toLowerCase() === (item.member_id || '').toLowerCase()
            );
            return mapUserForDashboard(item, uTasks);
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

        let { data: taskRow } = await getAdmin().from('tasks').select('*').eq('member_id', profile.id).maybeSingle();
        if (!taskRow && profile.member_id) {
            const { data: legacyRow } = await getAdmin().from('tasks').select('*').ilike('member_id', profile.member_id).maybeSingle();
            taskRow = legacyRow;
        }

        if (!taskRow) return false;

        let queue: any[] = [];
        if (taskRow.taskQueue) {
            try { queue = typeof taskRow.taskQueue === 'string' ? JSON.parse(taskRow.taskQueue) : taskRow.taskQueue; } catch (e) { }
        }

        let history: any[] = [];
        if (taskRow.Taskdom_History) {
            try { history = typeof taskRow.Taskdom_History === 'string' ? JSON.parse(taskRow.Taskdom_History) : taskRow.Taskdom_History; } catch (e) { }
        }

        // Find specific task
        const index = queue.findIndex((t: any) => t.id === taskId || (t.proofUrl && t.proofUrl.includes(taskId)));

        if (index > -1) {
            const task = queue[index];

            let updates: any = {};
            let taskUpdates: any = {};
            let params = profile.parameters || {};

            // Update stats based on decision
            if (decision === 'approve') {
                updates.wallet = (Number(profile.wallet) || 0) + 10;
                params.taskdom_streak = (Number(params.taskdom_streak) || 0) + 1;
            } else {
                params.taskdom_streak = 0;
            }
            updates.parameters = params;

            // Move to history
            const historyItem = { ...task, status: decision, reviewedAt: new Date().toISOString() };
            history.unshift(historyItem);
            queue.splice(index, 1);

            // Recount approved tasks (self-heals any prior corruption)
            if (decision === 'approve') {
                const approvedCount = history.filter((t: any) => t.status === 'approve' && t.type !== 'routine').length;
                taskUpdates['Taskdom_CompletedTasks'] = String(approvedCount);
            }

            // Save back
            taskUpdates.taskQueue = JSON.stringify(queue);
            taskUpdates.Taskdom_History = JSON.stringify(history);

            await updateProfile(profile.id, updates);
            await getAdmin().from('tasks').update(taskUpdates).eq('member_id', taskRow.member_id);
            if (decision === 'approve') {
                const { DbService } = await import('@/lib/supabase-service');
                await DbService.awardPoints(profile.member_id || userId, 50);
            }

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
        } else if (type === "approved") {
            params.taskdom_approved_tasks++;
        } else if (type === "rejected") {
            params.taskdom_rejected_tasks++;
        }

        updates.parameters = params;
        await updateProfile(profile.id, updates);
        if (type === 'approved') {
            const { DbService } = await import('@/lib/supabase-service');
            await DbService.awardPoints(memberId, 5);
        }

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

    return await insertMessage({
        memberId: memberId,
        message: text,
        sender: sender,
        read: isRead
    });
}

// --- 15. DAILY TASK ROTATION (updateDailyTask.js) ---
export async function updateDailyTask() {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to midnight
    const todayIso = today.toISOString();

    console.log("🔍 Searching for today's task:", todayIso);

    try {
        // 1. Check if we already have a task for today
        // Assuming 'daily_tasks' table has a 'selected_date' column (Date/Timestamp)
        const { data: todayItems, error: todayError } = await getAdmin()
            .from('daily_tasks')
            .select('*')
            .gte('selected_date', todayIso) // Greater than or equal to midnight today
            .limit(1);

        if (todayItems && todayItems.length > 0) {
            const item = todayItems[0];
            console.log("✅ Found today's task:", item.id);
            return { source: "today", item };
        }

        console.log("⚠️ No task found for today. Searching for old tasks...");

        // 2. Find old tasks (older than 6 months or never selected)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const sixMonthsAgoIso = sixMonthsAgo.toISOString();

        // Complex query: Select tasks where selected_date < 6 months OR selected_date is NULL
        // Supabase/Postgrest doesn't support OR across different columns easily without Rpc or raw filter string
        // We'll try a simple approach: Get pool of available tasks and pick random. 
        // For efficiency, maybe just get tasks where selected_date < 6 months first.

        const { data: oldItems, error: oldError } = await getAdmin()
            .from('daily_tasks')
            .select('*')
            .lt('selected_date', sixMonthsAgoIso); // Only checking strict old dates for now

        if (!oldItems || oldItems.length === 0) {
            // Fallback: Check for NULL selected_date (fresh tasks)
            const { data: freshItems } = await getAdmin()
                .from('daily_tasks')
                .select('*')
                .is('selected_date', null);

            if (freshItems && freshItems.length > 0) {
                const randomFreshString = freshItems[Math.floor(Math.random() * freshItems.length)];
                const updatedFresh = await getAdmin()
                    .from('daily_tasks')
                    .update({ selected_date: todayIso })
                    .eq('id', randomFreshString.id)
                    .select()
                    .single();
                return { source: "fresh", item: updatedFresh.data };
            }

            console.warn("❌ No old or fresh tasks available to reuse.");
            return { source: "none", item: null };
        }

        const randomIndex = Math.floor(Math.random() * oldItems.length);
        const selectedItem = oldItems[randomIndex];

        // 3. Update the selected task to today
        const { data: updatedItem, error: updateError } = await getAdmin()
            .from('daily_tasks')
            .update({ selected_date: todayIso })
            .eq('id', selectedItem.id)
            .select()
            .single();

        if (updateError) throw updateError;

        console.log("♻️ Reused old task and updated date:", updatedItem.id);
        return { source: "reused", item: updatedItem };

    } catch (error: any) {
        console.error("🚨 Task retrieval failed:", error);
        return { source: "error", error: error.message };
    }
}

// --- 16. PROFILE VIEW GENERATOR (backend/updateProfile.js) ---

// 🔧 Utility: Recursively replace placeholders in all string fields
function enrichNodeTree(node: any, replacements: Record<string, string>) {
    const clone = JSON.parse(JSON.stringify(node));

    const replaceInString = (str: string) => {
        if (typeof str !== "string") return str;
        let res = str;
        Object.entries(replacements).forEach(([key, value]) => {
            // str.replaceAll is standard in modern JS environments
            res = res.split(`#${key}#`).join(value);
        });
        return res;
    };

    const recurse = (obj: any): any => {
        if (Array.isArray(obj)) {
            return obj.map(recurse);
        } else if (typeof obj === "object" && obj !== null) {
            const newObj: any = {};
            for (const key in obj) {
                newObj[key] = typeof obj[key] === "string"
                    ? replaceInString(obj[key])
                    : recurse(obj[key]);
            }
            return newObj;
        } else {
            return obj;
        }
    };

    return recurse(clone);
}

function generateProfileView(templateHtml: any, replacements: any) {
    if (!templateHtml || !templateHtml.nodes) return templateHtml;
    const enrichedNodes = templateHtml.nodes.map((node: any) => enrichNodeTree(node, replacements));
    return {
        ...templateHtml,
        nodes: enrichedNodes
    };
}

export async function getLastVideoSlug(memberId: string) {
    // 1. Get profile
    const profile = await getProfile(memberId);
    if (!profile) return "";

    // 2. Check for gallery in parameters or check if we added a column
    // The schema has NO 'mediagallery1'. We assume it is in parameters.
    const params = profile.parameters || {};
    const gallery = params.mediagallery1 || [];

    if (!Array.isArray(gallery) || gallery.length === 0) {
        // console.warn("⚠️ Media gallery is empty or missing."); 
        return "";
    }

    const videos = gallery.filter((media: any) => media.type === "video");
    if (!videos.length) return "";

    const lastVideo = videos[videos.length - 1];
    return lastVideo.slug || "";
}

// Renamed to avoid conflict with our own 'updateProfile' helper
// This generates the "View Model" for the profile
export async function updateProfileView(memberId: string) {
    try {
        console.log(`🔍 Searching for item with memberId: ${memberId}`);
        const profile = await getProfile(memberId);
        if (!profile) return { success: false, reason: "No matching item found" };

        const params = profile.parameters || {};

        // Validations
        // Velo checks: score !== number || !title_fld
        // We check profile.score and profile.name/title
        if (profile.score === undefined || profile.score === null) {
            return { success: false, reason: "Missing score" };
        }

        // 🔍 Fetch CanvaCode template (Stubbed, as we don't have this table)
        // We'll use a placeholder or check parameters for a stored template
        // For now, we return a "Not Implemented" structure or assume existing 'profile_view' logic
        const templateHtml = {
            nodes: [], // STUB: Add default template structure here if known
            _stub: "Template mechanism required. Add 'canva_code' table or hardcode template."
        };

        // 🔍 Fetch last 4 point messages
        // Velo: query("SlaveMessages").eq("memberId", memberId).or(.eq("memberId", "All"))
        // Supabase: .or(`member_id.eq.${memberId},member_id.eq.All`)
        const { data: messageItems } = await getAdmin()
            .from('messages')
            .select('*')
            .or(`member_id.eq.${memberId},member_id.eq.All`)
            .order('created_at', { ascending: false })
            .limit(10);

        const pointMessages = (messageItems || []).map((m: any) => m.message);
        const videoSlug = await getLastVideoSlug(memberId);

        const replacements = {
            name: profile.name || "Slave",
            score: (profile.score || 0).toLocaleString(),
            hierarchy: profile.hierarchy || "—",
            tasks: (params.tasks_pct || "—").toString(),
            presence: (params.presence_pct || "—").toString(),
            appreciation: (params.appreciation_pct || "—").toString(),
            obedience: (params.obedience_pct || "—").toString(),
            resp1: (params.resp1 || "—").toString(),
            resp2: (params.resp2 || "—").toString(),
            resp3: (params.resp3 || "—").toString(),
            resp4: (params.resp4 || "—").toString(),
            overallPerformance: (params.overallPerformance || "—").toString(),
            points1: pointMessages[0] || "—",
            points2: pointMessages[1] || "—",
            points3: pointMessages[2] || "—",
            points4: pointMessages[3] || "—",
            points5: pointMessages[4] || "—",
            points6: pointMessages[5] || "—",
            points7: pointMessages[6] || "—",
            points8: pointMessages[7] || "—",
            points9: pointMessages[8] || "—",
            points10: pointMessages[9] || "—",
            video: videoSlug
        };

        const generatedView = generateProfileView(templateHtml, replacements);

        // Save back to parameters.profile_view
        await updateProfile(profile.id, {
            parameters: { ...params, profile_view: generatedView }
        });

        console.log(`✅ Updated profile view for ${profile.id}`);
        return { success: true, updatedId: profile.id };

    } catch (e: any) {
        console.error("updateProfileView Error:", e);
        return { success: false, reason: e.message };
    }
}

// --- 17. TASK EXPIRATION JOB (update.Taskdom.js) ---
export async function checkExpiredTasks() {
    try {
        console.log("⏰ Checking for expired tasks...");

        // 1. Find profiles where a task is currently PENDING
        // In Supabase, this is inside 'parameters->taskdom_pending_state'
        // We can't easily query JSON keys with 'isNotEmpty' in standard select without PostgREST filtering syntax
        // Best approach for now: fetch all profiles with non-null parameters, then filter in code (for < 1000 users this is fine)
        // Or use .not('parameters->taskdom_pending_state', 'is', null) if supported.
        // Let's safe fetch top 1000 and filter.

        const { data: profiles, error } = await getAdmin()
            .from('profiles')
            .select('*')
            .not('parameters', 'is', null) // Ensure parameters exist
            .limit(1000);

        if (error) throw error;
        if (!profiles) return;

        const now = new Date().getTime();

        for (const profile of profiles) {
            const params = profile.parameters || {};
            const pending = params.taskdom_pending_state;

            // Check if data exists and if Time has passed
            if (pending && pending.endTime && pending.endTime < now) {
                console.log(`Task Expired for: ${profile.member_id}`);

                // --- PUNISHMENT LOGIC ---

                // Reset Streak
                params.taskdom_current_streak = 0;

                // Deduct 300 coins from wallet (not points)
                const expiredWallet = Math.max(0, Number(profile.wallet || 0) - 300);

                // Update History
                let history: any[] = [];
                if (Array.isArray(profile.routine_history)) history = profile.routine_history;
                // Velo snippet used 'taskdom_history' on the item, which we mapped to routine_history

                history.unshift({
                    text: pending.task.text || "Unknown Task",
                    status: "reject",
                    resultLabel: "TIME EXPIRED",
                    timestamp: new Date().toISOString(),
                    completed: false
                });
                if (history.length > 50) history = history.slice(0, 50);

                // CLEAR ACTIVE TASK
                params.taskdom_active_task = null;
                params.taskdom_pending_state = null;

                // ACTIVITY LOG (Velo used 'ActivityLog' collection)
                // We don't have this table. We can add to 'parameters.activity_log' or 'messages' (system)
                // Let's add to parameters.activity_log to avoid polluting messaging
                const activityLog = params.activity_log || [];
                activityLog.unshift({
                    title: `Task Expired (24h limit): ${pending.task.text}`,
                    type: "fail",
                    memberId: profile.member_id,
                    memberName: profile.name || "Slave",
                    created_at: new Date().toISOString()
                });
                if (activityLog.length > 50) params.activity_log = activityLog.slice(0, 50);
                else params.activity_log = activityLog;

                // SAVE UPDATES — deduct 300 coins, no point change
                await updateProfile(profile.id, {
                    routine_history: history,
                    parameters: params,
                    wallet: expiredWallet
                });
            }
        }

        console.log("✅ Expiration check complete.");

    } catch (error) {
        console.error("Error in checkExpiredTasks:", error);
    }
}

// --- 18. PAYMENTS (backend/pay.jsw) ---

const coinsToEuroCents: Record<number, number> = {
    1000: 1000,   // 10€
    5500: 5000,   // 50€
    12000: 10000, // 100€
    30000: 25000, // 250€
    70000: 50000, // 500€
    150000: 100000 // 1000€
};

function getEuroCentsFromCoins(coins: number) {
    return coinsToEuroCents[coins] ?? null;
}

export async function getPaymentLink(amountCoins: number, email?: string) {
    try {
        const userEmail = email; // In Velo this was wixUsersBackend.currentUser.getEmail()
        if (!userEmail) throw new Error("User email required for payment");

        const priceInCents = getEuroCentsFromCoins(amountCoins);

        // Fallback or Error if invalid coin amount
        if (!priceInCents) throw new Error("Invalid coin amount or amount too low");
        if (priceInCents < 50) throw new Error("Amount too low");

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            customer_email: userEmail,
            line_items: [{
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: `${amountCoins} Coins`,
                        description: "Tribute to the Queen"
                    },
                    unit_amount: priceInCents,
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/private?success=true&coins=${amountCoins}`,
            cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/private?canceled=true`,
            metadata: {
                wixUserEmail: userEmail,
                coinsToAdd: amountCoins.toString()
            }
        });

        return session.url;
    } catch (error: any) {
        console.error("Backend Coin Error:", error);
        throw new Error(error.message);
    }
}

// --- 19. USD COIN CHECKOUT (backend/stripepay.js) ---
export async function createCoinCheckout(amountCoins: number, priceInCents: number, userId: string) {
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `${amountCoins} Coins for Queen`,
                    },
                    unit_amount: priceInCents, // e.g., 1000 = $10.00
                },
                quantity: 1,
            }],
            mode: 'payment',
            // Redirects
            success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?payment=success`,
            cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?payment=cancel`,
            metadata: {
                wixUserId: userId, // Legacy WIX ID or Supabase ID? Let's use what's passed.
                coinsToAdd: amountCoins.toString()
            }
        });

        return session.url;
    } catch (error: any) {
        console.error("createCoinCheckout Error:", error);
        throw new Error(error.message);
    }
}

// --- 20. PUSH NOTIFICATIONS (backend/http-functions.js) ---
export async function savePushSubscription(subscription: any) {
    try {
        if (!subscription || !subscription.endpoint) {
            return { success: false, error: "Invalid subscription" };
        }

        // Ideally we should know WHO is saving this. 
        // If called from client, we might need to pass userId or use auth check.
        // For now, let's assume userId is passed or we just store it.
        // User snippet: "const member = await currentMember.getMember();"
        // So we need memberId.

        // return { success: true }; // STUB until we have auth context in this action
        // Actually, let's assume the client passes memberId for now, or we rely on the caller.
        return { success: true, message: "Use updateProfile to save 'parameters.push_subscription'" };

    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

// New Action to actually save it to profile
export async function registerPushSubscriptionAction(memberId: string, subscription: any) {
    try {
        const profile = await getProfile(memberId);
        if (!profile) return { success: false, error: "User not found" };

        const params = profile.parameters || {};

        // Store in parameters (or a separate table 'push_subscriptions' is better for broadcasting)
        // For 1:1 notifications, parameters is fine.
        params.push_subscription = subscription;

        await updateProfile(memberId, { parameters: params });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function getAllPushSubscriptionsAction() {
    // This is for the Admin 'Push' broadcast
    // In Velo: backend/push.js -> getAllSubscriptions
    // We need to scan all profiles and collect 'parameters.push_subscription'
    // Efficient? No. But for <1000 users it works.
    try {
        const { data: profiles, error } = await getAdmin()
            .from('profiles')
            .select('parameters')
            .not('parameters', 'is', null);

        if (error) throw error;

        const subs = profiles
            .map((p: any) => p.parameters?.push_subscription)
            .filter((s: any) => s && s.endpoint);

        return { success: true, subscriptions: subs };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// --- 21. MEMBER INITIALIZATION (Public/events.js) ---
// Replaces wixMembers_onLogin logic
export async function ensureProfileExists(user: { id: string, email: string }) {
    try {
        if (!user || !user.id || !user.email) return { success: false, error: "Invalid user data" };

        // Check if profile exists
        const { data: existing } = await getAdmin()
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .single();

        if (existing) {
            return { success: true, message: "Profile exists" };
        }

        console.log(`⚠️ Profile missing for ${user.email}. Creating now...`);

        // Create Profile (Fallback if Trigger failed)
        const { error } = await getAdmin()
            .from('profiles')
            .insert({
                id: user.id,
                member_id: user.email, // Legacy mapping
                email: user.email,
                name: user.email.split('@')[0],
                score: 0,
                wallet: 0,
                hierarchy: "Hall Boy",
                parameters: {
                    devotion: 100,
                    role: "Subject"
                }
            });

        if (error) throw error;
        console.log(`✅ Profile created for ${user.email}`);
        return { success: true, created: true };

    } catch (e: any) {
        console.error("ensureProfileExists Error:", e);
        return { success: false, error: e.message };
    }
}

// --- 24. DAILY SCORE & LEADERBOARD (Service Plugin: DailyScore) ---
export async function runDailyScoreReset() {
    try {
        // 1. Get Top 10 by Daily Score
        const { data: topProfiles, error: fetchError } = await getAdmin()
            .from('profiles')
            .select('id, name, daily_score')
            .order('daily_score', { ascending: false })
            .limit(10);

        if (fetchError) throw fetchError;

        // 2. Update Leaderboard Table
        if (topProfiles && topProfiles.length > 0) {
            // Delete all previous entries
            await getAdmin().from('daily_leaderboard').delete().neq('rank', -1);

            const leaderboardEntries = topProfiles.map((p: any, index: number) => ({
                rank: index + 1,
                name: p.name || "Unknown",
                score: p.daily_score || 0
            }));

            const { error: insertError } = await getAdmin()
                .from('daily_leaderboard')
                .insert(leaderboardEntries);

            if (insertError) console.error("Leaderboard Insert Error", insertError);
        }

        // 3. Reset Daily Score for ALL profiles
        const { error: resetError } = await getAdmin()
            .from('profiles')
            .update({ daily_score: 0 })
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (resetError) throw resetError;

        return { success: true, message: "Daily Score Reset Complete" };

    } catch (e: any) {
        console.error("Daily Score Reset Error:", e);
        return { success: false, error: e.message };
    }
}

// --- 25. MONTHLY SCORE & LEADERBOARD (Service Plugin: MonthlyScore) ---
export async function runMonthlyScoreReset() {
    try {
        // 1. Get Top 3 by Monthly Score
        const { data: topProfiles, error: fetchError } = await getAdmin()
            .from('profiles')
            .select('id, name, monthly_score')
            .order('monthly_score', { ascending: false })
            .limit(3);

        if (fetchError) throw fetchError;

        // 2. Insert into Monthly Stats Log
        if (topProfiles && topProfiles.length > 0) {
            const entry = {
                name1: topProfiles[0]?.name || null,
                score1: topProfiles[0]?.monthly_score || 0,
                name2: topProfiles[1]?.name || null,
                score2: topProfiles[1]?.monthly_score || 0,
                name3: topProfiles[2]?.name || null,
                score3: topProfiles[2]?.monthly_score || 0
            };

            const { error: insertError } = await getAdmin()
                .from('monthly_leaderboard')
                .insert(entry);

            if (insertError) console.error("Monthly Log Insert Error", insertError);
        }

        // 3. Reset Monthly Score for ALL profiles
        const { error: resetError } = await getAdmin()
            .from('profiles')
            .update({ monthly_score: 0 })
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (resetError) throw resetError;

        return { success: true, message: "Monthly Score Reset Complete" };

    } catch (e: any) {
        console.error("Monthly Score Reset Error:", e);
        return { success: false, error: e.message };
    }
}

// --- 26. LEADERBOARD UPDATES (Service Plugin: Leaderboard) ---
export async function updateAllLeaderboards() {
    try {
        const TABLES = [
            { id: "daily_leaderboard", col: "daily_score", limit: 10 },
            { id: "weekly_standings", col: "weekly_score", limit: 10 },
            { id: "monthly_standings", col: "monthly_score", limit: 10 }, // Use 'monthly_standings' for current
            { id: "yearly_standings", col: "yearly_score", limit: 10 },
            { id: "overall_leaderboard", col: "score", limit: 10 }
        ];

        let results = [];

        for (const t of TABLES) {
            // 1. Get Top Items
            const { data: topProfiles, error: fetchError } = await getAdmin()
                .from('profiles')
                .select(`id, name, ${t.col}`)
                .order(t.col, { ascending: false })
                .limit(t.limit);

            if (fetchError || !topProfiles) {
                console.error(`Error fetching for ${t.id}:`, fetchError);
                continue;
            }

            // 2. Clear & Insert
            // Note: In a real prod app with high concurrency, this delete-then-insert is risky.
            // Better to use UPSERT on rank, but Supabase/Postgres needs a constraint.
            // Our schema has 'rank' as UNIQUE, so we can UPSERT.

            const entries = topProfiles.map((p: any, index: number) => ({
                rank: index + 1,
                name: p.name || "Unknown",
                score: p[t.col] || 0,
                updated_at: new Date()
            }));

            // Upsert (Conflict on 'rank')
            const { error: upsertError } = await getAdmin()
                .from(t.id)
                .upsert(entries, { onConflict: 'rank' });

            if (upsertError) console.error(`Error updating ${t.id}:`, upsertError);
            else results.push(`${t.id} updated`);
        }

        return { success: true, updated: results };

    } catch (e: any) {
        console.error("Leaderboard Update Error:", e);
        return { success: false, error: e.message };
    }
}

// --- 27. YEARLY SCORE & LEADERBOARD (Service Plugin: YearlyScore) ---
export async function runYearlyScoreReset() {
    try {
        // 1. Get Top 3 by Yearly Score
        const { data: topProfiles, error: fetchError } = await getAdmin()
            .from('profiles')
            .select('id, name, yearly_score')
            .order('yearly_score', { ascending: false })
            .limit(3);

        if (fetchError) throw fetchError;

        // 2. Insert into Yearly Stats Log
        if (topProfiles && topProfiles.length > 0) {
            const entry = {
                name1: topProfiles[0]?.name || null,
                score1: topProfiles[0]?.yearly_score || 0,
                name2: topProfiles[1]?.name || null,
                score2: topProfiles[1]?.yearly_score || 0,
                name3: topProfiles[2]?.name || null,
                score3: topProfiles[2]?.yearly_score || 0
            };

            const { error: insertError } = await getAdmin()
                .from('yearly_leaderboard')
                .insert(entry);

            if (insertError) console.error("Yearly Log Insert Error", insertError);
        }

        // 3. Reset Yearly Score for ALL profiles
        const { error: resetError } = await getAdmin()
            .from('profiles')
            .update({ yearly_score: 0 })
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (resetError) throw resetError;

        return { success: true, message: "Yearly Score Reset Complete" };

    } catch (e: any) {
        console.error("Yearly Score Reset Error:", e);
        return { success: false, error: e.message };
    }
}

