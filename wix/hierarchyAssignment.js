import wixData from 'wix-data';
import { Permissions, webMethod } from 'wix-web-module';
import wixSecretsBackend from 'wix-secrets-backend';
import Stripe from 'stripe';

// --- IMPORT CENTRAL LOGIC FROM PUBLIC ---
import { determineRank } from 'public/hierarchyRules.js';
// (Logic moved to public/hierarchyRules)

// --- BULK UPDATE JOB (invoke) ---
export const invoke = async ({ payload }) => {
    let skip = 0;
    const limit = 100;
    let hasMore = true;
    let totalUpdated = 0;

    while (hasMore) {
        const results = await wixData.query("Tasks")
            .skip(skip)
            .limit(limit)
            .find({ suppressAuth: true });

        const items = results.items;
        console.log(`Fetched ${items.length} items at skip=${skip}`);

        if (items.length === 0) {
            hasMore = false;
            break;
        }

        const updates = items.map(item => {
            const newRank = determineRank(item);

            // Logging
            if (!item.image_fld) console.log("No profile picture", item.title_fld);
            else if (item.kneelCount < 50) console.log("Not enough kneels", item.title_fld);

            if (item.hierarchy !== newRank) {
                console.log(`Updating ${item.title_fld}: ${item.hierarchy} -> ${newRank}`);
                item.hierarchy = newRank;
                return wixData.update("Tasks", item, { suppressAuth: true });
            }
            return Promise.resolve();
        });

        await Promise.all(updates);
        totalUpdated += updates.length;
        skip += limit;
        hasMore = results.hasNext();
    }

    console.log(`Hierarchy update completed. Total items updated: ${totalUpdated}`);
    return {};
};

// ==============================================================================
// ESSENTIAL WEB METHODS (Connected to Frontend)
// ==============================================================================

// --- 1. UPDATE SCORE ---
export const updateScoreAction = webMethod(Permissions.Anyone, async (memberId, amount) => {
    const options = { suppressAuth: true };
    try {
        const results = await wixData.query("Tasks").eq("memberId", memberId).find(options);
        if (results.items.length > 0) {
            let item = results.items[0];
            item.score = (item.score || 0) + amount;
            item.hierarchy = determineRank(item);
            await wixData.update("Tasks", item, options);
            return item;
        }
        return null;
    } catch (error) {
        console.error("updateScore Error:", error);
        return null;
    }
});

// --- 2. SECURE UPDATE TASK ---
export const secureUpdateTaskAction = webMethod(Permissions.Anyone, async (memberId, updateData) => {
    const options = { suppressAuth: true };
    try {
        const results = await wixData.query("Tasks").eq("memberId", memberId).find(options);
        if (results.items.length > 0) {
            let item = results.items[0];
            let needsUpdate = false;

            // Init Stats
            if (!item.stats) {
                item.stats = { approvedTasks: 0, rejectedTasks: 0, skippedTasks: 0, dailyCompletedTasks: 0, dailyStreak: 0, dailyScore: 0, monthlyTotalTasks: 0, monthlyScore: 0 };
                needsUpdate = true;
            }

            // Init History
            let history = [];
            try { history = Array.isArray(item.taskdom_history) ? item.taskdom_history : JSON.parse(item.taskdom_history || "[]"); } catch (e) { }

            // Updates
            if (updateData.taskQueue) { item.taskQueue = updateData.taskQueue; needsUpdate = true; }
            if (updateData.consumeQueue === true && item.taskQueue?.length > 0) { item.taskQueue.shift(); needsUpdate = true; }
            if (updateData.pendingState) { item.taskdom_pending_state = updateData.pendingState; needsUpdate = true; }

            // Evidence Upload
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

                // Rank Check
                item.hierarchy = determineRank(item);
                needsUpdate = true;
            }

            // Skipped
            if (updateData.wasSkipped === true) {
                item.taskdom_current_streak = 0;
                history.unshift({ id: Date.now().toString(), text: updateData.taskTitle || "Skipped", status: "fail", timestamp: new Date(), proofUrl: "SKIPPED" });
                item.taskdom_history = JSON.stringify(history);
                item.taskdom_active_task = null;
                item.taskdom_pending_state = null;
                needsUpdate = true;
            }

            if (updateData.clear === true) {
                item.taskdom_active_task = null;
                item.taskdom_pending_state = null;
                needsUpdate = true;
            }

            if (needsUpdate) {
                // ALWAYS CHECK RANK BEFORE SAVE
                const newRank = determineRank(item);
                if (newRank !== item.hierarchy) {
                    item.hierarchy = newRank;
                }

                await wixData.update("Tasks", item, options);
                return true;
            }
        }
        return false;
    } catch (error) { console.error(error); return false; }
});

// --- 3. REVIEW TASK ---
export const reviewTaskAction = webMethod(Permissions.Anyone, async (memberId, decision, submissionId) => {
    const options = { suppressAuth: true };
    try {
        const results = await wixData.query("Tasks").eq("memberId", memberId).find(options);
        if (results.items.length > 0) {
            let item = results.items[0];
            let history = [];
            try { history = Array.isArray(item.taskdom_history) ? item.taskdom_history : JSON.parse(item.taskdom_history || "[]"); } catch (e) { }

            const taskIndex = history.findIndex(t => t.id === submissionId || (t.status === 'pending' && t.proofUrl));

            if (taskIndex > -1) {
                history[taskIndex].status = decision;
                history[taskIndex].completed = (decision === 'approve');
                item.taskdom_history = JSON.stringify(history);

                if (decision === 'approve') {
                    item.taskdom_completed_tasks = (item.taskdom_completed_tasks || 0) + 1;
                    item.taskdom_current_streak = (item.taskdom_current_streak || 0) + 1;
                    item.hierarchy = determineRank(item);
                } else if (decision === 'reject') {
                    item.taskdom_current_streak = 0;
                }
                await wixData.update("Tasks", item, options);
                return item;
            }
        }
        return null;
    } catch (e) { return null; }
});

// --- 4. COIN TRANSACTIONS ---
export const processCoinTransaction = webMethod(Permissions.Anyone, async (memberId, amount, reason) => {
    const options = { suppressAuth: true };
    try {
        const results = await wixData.query("Tasks").eq("memberId", memberId).find(options);
        if (results.items.length > 0) {
            let item = results.items[0];
            let currentWallet = item.wallet || 0;

            if (amount < 0 && currentWallet < Math.abs(amount)) return { success: false, error: "Insufficient funds" };

            if (amount < 0) item.total_coins_spent = (item.total_coins_spent || 0) + Math.abs(amount);
            item.wallet = currentWallet + amount;

            if (amount > 0 || reason.includes("Purchase") || reason.includes("Tribute")) {
                let tHist = [];
                try { tHist = JSON.parse(item.tributeHistory || "[]"); } catch (e) { }
                tHist.unshift({ amount: amount, message: reason, date: new Date(), type: amount > 0 ? 'income' : 'expense' });
                if (tHist.length > 50) tHist = tHist.slice(0, 50);
                item.tributeHistory = JSON.stringify(tHist);
            }

            // Rank Check
            item.hierarchy = determineRank(item);

            await wixData.update("Tasks", item, options);
            return { success: true, newBalance: item.wallet };
        }
        return { success: false, error: "User not found" };
    } catch (e) { return { success: false, error: e.message }; }
});

// --- 5. PRESENCE ---
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

// --- 6. HIERARCHY OVERRIDE ---
export const setHierarchyAction = webMethod(Permissions.Anyone, async (memberId, newRank) => {
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
    } catch (e) { return { success: false, error: e.message }; }
});

// --- 7. STRIPE ---
export const getSubscriptionLink = webMethod(Permissions.Anyone, async (emailFromForm) => {
    try {
        const secretKey = await wixSecretsBackend.getSecret("STRIPE_SECRET_KEY");
        const stripe = new Stripe(secretKey);
        if (!emailFromForm) throw new Error("Email is required");
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            customer_email: emailFromForm,
            line_items: [{ price: 'price_1SZiB4LjyfeWKkoZO7g9iIYs', quantity: 1 }],
            mode: 'subscription',
            success_url: 'https://www.qkarin.com/private',
            cancel_url: 'https://www.qkarin.com/',
            metadata: { type: "SUBSCRIPTION_55", email: emailFromForm }
        });
        return session.url;
    } catch (error) { throw new Error(error.message); }
});