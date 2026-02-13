import wixData from 'wix-data';
import { Permissions, webMethod } from 'wix-web-module';
import wixSecretsBackend from 'wix-secrets-backend';
import Stripe from 'stripe';

// --- IMPORT CENTRAL LOGIC FROM PUBLIC ---
import { determineRank, HIERARCHY_RULES } from 'public/hierarchyRules.js';

// --- PUBLIC API: GET RULES ---
export const getHierarchyRequirements = webMethod(Permissions.Anyone, async () => {
    return HIERARCHY_RULES;
});


// --- EXPORT THE POINTS ACTION (Local Logic) ---
export const updateScoreAction = webMethod(Permissions.Anyone, async (memberId, amount) => {
    const options = { suppressAuth: true };
    try {
        const results = await wixData.query("Tasks").eq("memberId", memberId).find(options);
        if (results.items.length > 0) {
            let item = results.items[0];
            item.score = (item.score || 0) + amount;

            // Re-Evaluate Rank on Score Change
            const newRank = determineRank(item);
            if (newRank !== item.hierarchy) {
                item.hierarchy = newRank;
            }

            await wixData.update("Tasks", item, options);
            return item;
        }
        return null; // User not found
    } catch (e) {
        console.error("updateScoreAction Error", e);
        return null;
    }
});

// --- 1. SECURE UPDATE TASK (The Brain) ---
export const secureUpdateTaskAction = webMethod(
    Permissions.Anyone,
    async (memberId, updateData) => {
        const options = { suppressAuth: true };

        try {
            // 1. Find the user in the database
            const results = await wixData.query("Tasks").eq("memberId", memberId).find(options);

            if (results.items.length > 0) {
                let item = results.items[0];
                let needsUpdate = false;

                //Initialize statistics object
                if (!item.stats) {
                    item.stats = {
                        approvedTasks: 0,
                        rejectedTasks: 0,
                        skippedTasks: 0,
                        dailyCompletedTasks: 0,
                        dailyStreak: 0,
                        dailyScore: 0,
                        monthlyTotalTasks: 0,
                        monthlyScore: 0
                    };
                    needsUpdate = true;
                }

                // --- Helper: Parse History Safely ---
                let history = [];
                if (item.taskdom_history) {
                    if (Array.isArray(item.taskdom_history)) {
                        history = item.taskdom_history;
                    } else if (typeof item.taskdom_history === 'string') {
                        try { history = JSON.parse(item.taskdom_history); } catch (e) { history = []; }
                    }
                }

                // --- [NEW] ADMIN SAVE QUEUE (From Dashboard) ---
                if (updateData.taskQueue) {
                    item.taskQueue = updateData.taskQueue;
                    needsUpdate = true;
                }

                // --- [NEW] SLAVE CONSUME QUEUE (From Slave UI) ---
                if (updateData.consumeQueue === true) {
                    if (item.taskQueue && item.taskQueue.length > 0) {
                        item.taskQueue.shift();
                        needsUpdate = true;
                    }
                }

                // --- A: SAVE ACTIVE TASK (Timer Persistence) ---
                if (updateData.pendingState) {
                    item.taskdom_pending_state = updateData.pendingState;
                    needsUpdate = true;
                }

                // --- B: UPLOAD EVIDENCE (Submission) ---
                if (updateData.addToQueue && updateData.addToQueue.proofUrl) {
                    history.unshift({
                        id: updateData.addToQueue.id,
                        text: updateData.addToQueue.text,
                        proofUrl: updateData.addToQueue.proofUrl,
                        proofType: updateData.addToQueue.proofType,
                        timestamp: new Date(),
                        status: 'pending',
                        completed: false
                    });
                    item.taskdom_history = JSON.stringify(history);

                    if (updateData.addToQueue.category === "Task") {
                        item.taskdom_active_task = null;
                        item.taskdom_pending_state = null;
                    }

                    // --- ROUTINE STREAK LOGIC ---
                    if (updateData.addToQueue.isRoutine === true) {
                        const now = new Date();
                        const last = item.lastRoutineDate ? new Date(item.lastRoutineDate) : null;

                        if (!last) {
                            item.routinestreak = 1;
                        } else {
                            // Simplify dates to YYYY-MM-DD for comparison
                            const todayStr = now.toISOString().split('T')[0];
                            const lastStr = last.toISOString().split('T')[0];
                            const yesterday = new Date(now);
                            yesterday.setDate(yesterday.getDate() - 1);
                            const yestStr = yesterday.toISOString().split('T')[0];

                            if (lastStr === yestStr) {
                                item.routinestreak = (item.routinestreak || 0) + 1;
                            } else if (lastStr !== todayStr) {
                                // If not today and not yesterday, it's older -> Reset
                                item.routinestreak = 1;
                            }
                            // If today, do nothing (keep streak)
                        }
                        item.lastRoutineDate = now;
                    }

                    // --- THE JUDGE: CHECK RANK ---
                    // Note: We check again at the bottom for safety, but checking here is fine too
                    const newRank = determineRank(item);
                    if (newRank !== item.hierarchy) {
                        item.hierarchy = newRank;
                    }

                    needsUpdate = true;
                }

                // --- C: SKIP LOGIC ---
                if (updateData.wasSkipped === true) {
                    item.taskdom_current_streak = 0;

                    history.unshift({
                        id: Date.now().toString(),
                        text: updateData.taskTitle || "Task Skipped",
                        status: "fail",
                        timestamp: new Date(),
                        proofUrl: "SKIPPED"
                    });
                    item.taskdom_history = JSON.stringify(history);

                    item.taskdom_active_task = null;
                    item.taskdom_pending_state = null;

                    needsUpdate = true;
                }

                // --- D: GENERIC CLEAR ---
                if (updateData.clear === true) {
                    item.taskdom_active_task = null;
                    item.taskdom_pending_state = null;
                    needsUpdate = true;
                }

                // --- FINAL SAVE ---
                if (needsUpdate) {
                    // ALWAYS VALIDATE RANK BEFORE SAVING
                    const currentRank = determineRank(item);
                    if (currentRank !== item.hierarchy) {
                        item.hierarchy = currentRank;
                        console.log(`Rank corrected to ${currentRank} during update.`);
                    }

                    await wixData.update("Tasks", item, options);
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error("Backend Save Error:", error);
            return false;
        }
    }
);


// --- 2. REVIEW TASK (Admin) ---
export const reviewTaskAction = webMethod(
    Permissions.Anyone,
    async (memberId, decision, submissionId) => {
        const options = { suppressAuth: true };

        try {
            const results = await wixData.query("Tasks").eq("memberId", memberId).find(options);

            if (results.items.length > 0) {
                let item = results.items[0];

                let history = [];
                if (item.taskdom_history) {
                    if (Array.isArray(item.taskdom_history)) {
                        history = item.taskdom_history;
                    } else if (typeof item.taskdom_history === 'string') {
                        try { history = JSON.parse(item.taskdom_history); } catch (e) { history = []; }
                    }
                }

                // Find the task in history
                // We check both ID match OR a pending task with matching proofUrl (fallback)
                const taskIndex = history.findIndex(t =>
                    t.id === submissionId ||
                    (t.status === 'pending' && t.proofUrl) // Takes the first pending task if ID missing
                );

                if (taskIndex > -1) {
                    // Update Status
                    history[taskIndex].status = decision;
                    history[taskIndex].completed = (decision === 'approve');
                    item.taskdom_history = JSON.stringify(history);

                    // Update Counters
                    if (decision === 'approve') {
                        item.taskdom_completed_tasks = (item.taskdom_completed_tasks || 0) + 1;
                        // Streak Logic
                        item.taskdom_current_streak = (item.taskdom_current_streak || 0) + 1;
                    } else if (decision === 'reject') {
                        item.taskdom_current_streak = 0;
                    }

                    // RE-EVALUATE RANK
                    item.hierarchy = determineRank(item);

                    await wixData.update("Tasks", item, options);
                    return item;
                }
            }
            return null;
        } catch (e) {
            console.error("Review Error:", e);
            return null;
        }
    }
);

// --- 3. PROCESS COIN TRANSACTION ---
export const processCoinTransaction = webMethod(
    Permissions.Anyone,
    async (memberId, amount, reason) => {
        const options = { suppressAuth: true };
        try {
            const results = await wixData.query("Tasks").eq("memberId", memberId).find(options);
            if (results.items.length > 0) {
                let item = results.items[0];
                let currentWallet = item.wallet || 0;

                // Check for insufficient funds if deducting
                if (amount < 0 && currentWallet < Math.abs(amount)) {
                    return { success: false, error: "Insufficient funds" };
                }

                // Update Wallet
                if (amount < 0) {
                    item.total_coins_spent = (item.total_coins_spent || 0) + Math.abs(amount);
                }
                item.wallet = currentWallet + amount;

                // Log Transaction (Tribute History)
                if (amount > 0 || reason.includes("Purchase") || reason.includes("Tribute")) {
                    let tributeHistory = [];
                    try {
                        tributeHistory = JSON.parse(item.tributeHistory || "[]");
                    } catch (e) {
                        tributeHistory = [];
                    }

                    tributeHistory.unshift({
                        amount: amount,
                        message: reason,
                        date: new Date(),
                        type: amount > 0 ? 'income' : 'expense'
                    });

                    // Keep log manageable
                    if (tributeHistory.length > 50) tributeHistory = tributeHistory.slice(0, 50);

                    item.tributeHistory = JSON.stringify(tributeHistory);
                }

                // RE-EVALUATE RANK (Spending changes rank)
                item.hierarchy = determineRank(item);

                await wixData.update("Tasks", item, options);
                return { success: true, newBalance: item.wallet };
            }
            return { success: false, error: "User not found" };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
);


// --- 4. PRESENCE (Last Seen) ---
export const updatePresenceAction = webMethod(Permissions.Anyone, async (memberId) => {
    const results = await wixData.query("Tasks").eq("memberId", memberId).find({ suppressAuth: true });
    if (results.items.length > 0) {
        let item = results.items[0];
        if (!item.lastSeen || (Date.now() - new Date(item.lastSeen).getTime() > 60000)) {
            item.lastSeen = new Date();
            await wixData.update("Tasks", item, { suppressAuth: true });
        }
    }
});

export const SendSlaveMessageAction = webMethod(Permissions.Anyone, async (sender, type, message) => { return true; });

// --- 7. PROFILE UPDATE (Name, Kinks, Limits) ---
export const updateProfileAction = webMethod(
    Permissions.Anyone,
    async (memberId, data) => {
        const options = { suppressAuth: true };
        try {
            const results = await wixData.query("Tasks").eq("memberId", memberId).find(options);
            if (results.items.length > 0) {
                let item = results.items[0];
                let cost = 0;

                // 1. CALCULATE COST
                // Name: 100
                if (data.name) cost += 100;
                // Photo: 200
                if (data.photo) cost += 200;
                // Limits: 200 per item
                if (data.limits && Array.isArray(data.limits)) {
                    cost += (data.limits.length * 200);
                }
                // Kinks: 100 per item
                if (data.kinks && Array.isArray(data.kinks)) {
                    cost += (data.kinks.length * 100);
                }

                // 2. CHECK BALANCE
                let balance = item.wallet || 0;
                if (balance < cost) {
                    return { success: false, error: `INSUFFICIENT FUNDS. REQUIRED: ${cost}, BAL: ${balance}` };
                }

                // 3. APPLY UPDATE
                item.wallet = balance - cost;
                item.total_coins_spent = (item.total_coins_spent || 0) + cost; // Track spend for promotion

                let changed = false;

                if (data.name) {
                    item.title = data.name;
                    item.title_fld = data.name; // Use title_fld for Queendom sync consistency
                    changed = true;
                }
                // Updated: Check for undefined specifically, allowing empty string (removal)
                if (data.photo !== undefined) {
                    item.image = data.photo;
                    item.image_fld = data.photo;

                    // FORCE SYNC: If removing photo, clear legacy field too
                    if (!data.photo) {
                        item.profilePicture = null;
                        item.image = null; // Ensure null if empty string
                        item.image_fld = null;
                    }

                    changed = true;
                }
                if (data.limits) { item.limits = data.limits; changed = true; }
                if (data.kinks) { item.kink = data.kinks; changed = true; }

                if (changed || cost > 0) {
                    const newRank = determineRank(item);
                    if (newRank !== item.hierarchy) {
                        item.hierarchy = newRank;
                        item.hierarchyChangeDate = new Date();
                    }
                    await wixData.update("Tasks", item, options);
                    return { success: true, hierarchy: item.hierarchy, cost: cost, newBalance: item.wallet };
                }
            }
            return { success: false, error: "User not found" };
        } catch (e) { return { success: false, error: e.message }; }
    }
);

// --- 6. HIERARCHY OVERRIDE (From Slave Record App) ---
export const setHierarchyAction = webMethod(
    Permissions.Anyone,
    async (memberId, newRank) => {
        const options = { suppressAuth: true };
        try {
            const results = await wixData.query("Tasks").eq("memberId", memberId).find(options);
            if (results.items.length > 0) {
                let item = results.items[0];
                item.hierarchy = newRank;
                await wixData.update("Tasks", item, options);
                return { success: true };
            }
            return { success: false, error: "User not found" };
        } catch (e) {
            console.error("setHierarchyAction Error", e);
            return { success: false, error: e.message };
        }
    }
);

// --- 5. STRIPE SUBSCRIPTION ---
export const getSubscriptionLink = webMethod(
    Permissions.Anyone,
    async (emailFromForm) => {
        try {
            const secretKey = await wixSecretsBackend.getSecret("STRIPE_SECRET_KEY");
            const stripe = new Stripe(secretKey);

            if (!emailFromForm) throw new Error("Email is required");

            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                customer_email: emailFromForm,
                line_items: [{
                    price: 'price_1SZiB4LjyfeWKkoZO7g9iIYs',
                    quantity: 1,
                }],
                mode: 'subscription',
                success_url: 'https://www.qkarin.com/private',
                cancel_url: 'https://www.qkarin.com/',
                metadata: {
                    type: "SUBSCRIPTION_55",
                    email: emailFromForm
                }
            });

            return session.url;
        } catch (error) {
            throw new Error(error.message);
        }
    }
);