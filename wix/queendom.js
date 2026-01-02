import wixData from 'wix-data';
import { reviewTaskAction, secureUpdateTaskAction } from 'backend/Actions.web.js';
import { insertMessage, loadUserMessages, markChatAsRead } from 'backend/Chat.web.js';

let currentViewedUserId = null;

const trashTalk = ["Pathetic.", "Try harder.", "Weakness.", "Do not waste my time."];
const praiseTalk = ["Good boy.", "I am pleased.", "Keep serving.", "Acceptable."];

let lastHeartbeat = Date.now();
let heartbeatInterval = null;

$w.onReady(function () {
    // 1. Data Refresh Loops
    // This is the "Slow Channel" that keeps everything in sync every 4 seconds
    setInterval(refreshDashboard, 4000); 
    refreshDashboard();

    // Fast Chat refresh
    setInterval(async () => {
        if (currentViewedUserId) await refreshChatForUser(currentViewedUserId);
    }, 1500); 

    // 2. LISTENER FOR MESSAGES FROM VERCEL DASHBOARD
    $w("#htmlMaster").onMessage(async (event) => {
        const data = event.data;
        let processed = false;

        dashboardHeartbeat(); 

        if (data.type === "selectUser") {
            currentViewedUserId = data.memberId;
            refreshChatForUser(currentViewedUserId);
            processed = true;
        }

        else if (data.type === "markAsRead") {
            await markChatAsRead(data.memberId);
            processed = true;
        }

        else if (data.type === "adminMessage") {
            await insertMessage({ memberId: currentViewedUserId, message: data.text, sender: "admin", type: 'text', read: false });
            refreshChatForUser(currentViewedUserId);
            processed = true;
        }

        else if (data.type === "reviewDecision") {
            console.log("Processing Review Data:", data);

            // --- STEP 1: AWARD POINTS ---
            if (data.decision === 'approve' && data.bonusCoins) {
                try {
                    const amount = Number(data.bonusCoins);
                    if (amount > 0) {
                        const userRes = await wixData.query("Tasks").eq("memberId", data.memberId).find({suppressAuth:true});
                        if(userRes.items.length > 0) {
                            let uItem = userRes.items[0];
                            uItem.score        = (uItem.score || 0) + amount;
                            uItem.dailyScore   = (uItem.dailyScore || 0) + amount;
                            uItem.weeklyScore  = (uItem.weeklyScore || 0) + amount;
                            uItem.monthlyScore = (uItem.monthlyScore || 0) + amount;
                            uItem.yearlyScore  = (uItem.yearlyScore || 0) + amount;

                            await wixData.update("Tasks", uItem, {suppressAuth:true});
                        }
                    }
                } catch (e) { console.error("Failed to award points:", e); }
            }

            // --- STEP 2: SEND VERDICT MESSAGES ---
            try {
                if (data.decision === 'approve') {
                    let msgText = "✔️ Task Verified.";
                    if (data.bonusCoins > 0) msgText += ` +${data.bonusCoins} Points.`;
                    if (data.comment) msgText += `\n"${data.comment}"`;
                    await insertMessage({ memberId: data.memberId, message: msgText, sender: "admin", read: false });
                } else {
                    await insertMessage({ memberId: data.memberId, message: "Task Rejected.", sender: "admin", read: false });
                }

                if (data.media) {
                    await insertMessage({ memberId: data.memberId, message: data.media, sender: "admin", read: false });
                }
            } catch (e) { console.error("Failed to send chat:", e); }

            // --- STEP 3: SAVE HISTORY ---
            if (data.decision === 'approve' && (data.sticker || data.comment || data.media)) {
                try {
                    const userRes = await wixData.query("Tasks").eq("memberId", data.memberId).find({suppressAuth:true});
                    if(userRes.items.length > 0) {
                        let item = userRes.items[0];
                        let history = [];
                        if (typeof item.taskdom_history === 'string') {
                            try { history = JSON.parse(item.taskdom_history); } catch(e) { history = []; }
                        } else { history = item.taskdom_history || []; }
                        
                        const tIndex = history.findIndex(t => t.id == data.taskId);
                        if(tIndex > -1) {
                            if(data.sticker) history[tIndex].sticker = data.sticker;
                            if(data.comment) history[tIndex].adminComment = data.comment;
                            if(data.media)   history[tIndex].adminMedia = data.media;

                            item.taskdom_history = JSON.stringify(history);
                            await wixData.update("Tasks", item, {suppressAuth:true});
                        }
                    }
                } catch(err) { console.error("Extra Data Save Error:", err); }
            }

            // --- STEP 4: UPDATE STATUS ---
            try {
                await reviewTaskAction(data.memberId, data.decision, data.taskId);
            } catch (e) { console.error("Critical Error in reviewTaskAction:", e); }

            // --- STEP 5: LOG REACTION ---
            if (data.decision === 'approve') {
                try {
                    await wixData.insert("taskreaction", {
                        memberId: data.memberId,
                        taskId: data.taskId || "unknown",
                        sticker: data.sticker,   
                        media: data.media,       
                        comment: data.comment,   
                        timestamp: new Date()
                    }, { suppressAuth: true });
                } catch (err) { console.error("Log error", err); }
            }

            // --- THE INSTANT ECHO (REVIEWS) ---
            // This tells Vercel to remove the item from the list IMMEDIATELY
            $w("#htmlMaster").postMessage({ 
                type: "instantReviewSuccess", 
                memberId: data.memberId, 
                taskId: data.taskId,
                decision: data.decision
            });

            refreshDashboard();
            processed = true;
        }

        else if (data.type === "adjustPoints") {
            try {
                const amount = Number(data.amount);
                const userRes = await wixData.query("Tasks").eq("memberId", data.memberId).find({suppressAuth:true});
                if(userRes.items.length > 0) {
                    let uItem = userRes.items[0];
                    uItem.score        = (uItem.score || 0) + amount;
                    uItem.dailyScore   = (uItem.dailyScore || 0) + amount;
                    uItem.weeklyScore  = (uItem.weeklyScore || 0) + amount;
                    uItem.monthlyScore = (uItem.monthlyScore || 0) + amount;
                    uItem.yearlyScore  = (uItem.yearlyScore || 0) + amount;
                    await wixData.update("Tasks", uItem, {suppressAuth:true});

                    // --- THE INSTANT ECHO (POINTS) ---
                    // This tells Vercel to change the points number IMMEDIATELY
                    $w("#htmlMaster").postMessage({ 
                        type: "instantUpdate", 
                        memberId: data.memberId, 
                        newPoints: uItem.score 
                    });
                }
            } catch(e) { console.error("Adjust Points Error", e); }

            let phrase = data.amount > 0 ? praiseTalk[Math.floor(Math.random() * praiseTalk.length)] : trashTalk[Math.floor(Math.random() * trashTalk.length)];
            let msg = data.amount > 0 ? `You received ${data.amount} points. ${phrase}` : `You lost ${Math.abs(data.amount)} points. ${phrase}`;
            await insertMessage({ memberId: data.memberId, message: msg, sender: "system", read: false });
            
            refreshDashboard();
            processed = true;
        }

        else if (data.type === "saveToCMS") {
             await wixData.insert(data.collection, data.payload, { suppressAuth: true });
            processed = true;
        }

        else if (data.type === "updateTaskQueue") {
            await secureUpdateTaskAction(data.memberId, { taskQueue: data.queue });
            processed = true;
        }
        
        else if (data.type === "adminTaskAction") {
            const mid = data.memberId;
            if (data.action === "cancel") {
                await secureUpdateTaskAction(mid, { clear: true });
                await insertMessage({ memberId: mid, message: "Task Cancelled by Queen Karin.", sender: "system", read: false });
            }
            if (data.action === "skip") {
                await secureUpdateTaskAction(mid, { clear: true, wasSkipped: true, taskTitle: "SKIPPED BY OWNER" });
                await insertMessage({ memberId: mid, message: "Task Skipped by Queen Karin", sender: "system", read: false });
            }
            refreshDashboard();
            processed = true;
        }

        else if (data.type === "forceActiveTask") {
            try {
                const mid = data.memberId;
                const userRes = await wixData.query("Tasks").eq("memberId", mid).find({ suppressAuth: true });
                if (userRes.items.length > 0) {
                    let uItem = userRes.items[0];
                    uItem.taskdom_pending_state = {
                        task: { text: data.taskText, category: 'forced' },
                        endTime: data.endTime,
                        status: "PENDING"
                    };
                    await wixData.update("Tasks", uItem, { suppressAuth: true });
                    await insertMessage({ 
                        memberId: mid, 
                        message: "SYSTEM: DIRECT COMMAND RECEIVED - " + data.taskText, 
                        sender: "system", 
                        read: false 
                    });
                    refreshDashboard();
                }
            } catch (e) { console.error("Force Task Error", e); }
            processed = true;
        }

        else if (data.type === "visibilitychange") {
            if (data.status) { stopHeartbeat(); } else { startHeartbeat(); }
        }
    });
});

async function refreshDashboard() {
    try {
        const usersResult = await wixData.query("Tasks").descending("joined").limit(100).find({ suppressAuth: true });
        const dailyTasksResult = await wixData.query("DailyTasks").limit(1000).find({ suppressAuth: true });
        const dailyTasksList = dailyTasksResult.items.map(i => i.taskText || i.title || i.task); 
        
        const cmsResult = await wixData.query("QKarinonline").find({ suppressAuth: true });
        const cmsItems = cmsResult.items;

        let allUsers = [];
        let globalQueue = [];
        let globalTributes = []; 

        usersResult.items.forEach(u => {
            let displayName = u.title_fld || u.title || "Slave";
            
            // --- THE SILHOUETTE FIX ---
            // If image_fld is empty, we use this default silhouette URL
            const silhouette = "https://static.wixstatic.com/media/ce3e5b_e06c7a2254d848a480eb98107c35e246~mv2.png";
            let avatarUrl = u.image_fld ? getPublicUrl(u.image_fld) : silhouette;
            
            let history = [];
            if (u.taskdom_history) {
                if (typeof u.taskdom_history === 'string') {
                    try { history = JSON.parse(u.taskdom_history); } catch(e) { history = []; }
                } else { history = u.taskdom_history; }
            }

            let tributeHistory = [];
            let rawTrib = u.tributeHistory || u.tributeLog || "[]";
            if (typeof rawTrib === 'string') {
                try { tributeHistory = JSON.parse(rawTrib); } catch(e) { tributeHistory = []; }
            } else if (Array.isArray(rawTrib)) { tributeHistory = rawTrib; }

            if (tributeHistory.length > 0) {
                globalTributes.push(...tributeHistory.map(t => ({...t, memberName: displayName, memberId: u.memberId, avatar: avatarUrl})));
            }

            let userReviewQueue = history.filter(t => 
                t.status === 'pending' && t.status !== 'fail' && !(t.text && t.text.toUpperCase().includes('SKIPPED'))
            ).map(t => ({ ...t, proofUrl: getPublicUrl(t.proofUrl), memberId: u.memberId, userName: displayName }));

            let userHistoryDisplay = history.filter(t => t.status !== 'pending' || t.status === 'fail').map(t => ({ ...t, proofUrl: getPublicUrl(t.proofUrl) }));

            globalQueue.push(...userReviewQueue);

            allUsers.push({
                memberId: u.memberId,
                name: displayName,
                hierarchy: u.hierarchy || "Newbie",
                avatar: avatarUrl, // This now sends the silhouette if image is missing
                joinedDate: u.joined,
                lastSeen: u.lastSeen,
                lastMessageTime: u.lastMessageTime || 0, 
                totalTasks: u.taskdom_total_tasks || 0,
                completed: u.taskdom_completed_tasks || 0,
                streak: u.taskdom_current_streak || 0,
                points: u.score || 0,
                coins: u.wallet || 0,
                reviewQueue: userReviewQueue,
                history: userHistoryDisplay,
                stickers: u.stickers || [], 
                taskQueue: u.taskQueue || u.taskdom_task_queue || [], 
                activeTask: u.taskdom_pending_state ? u.taskdom_pending_state.task : null,
                endTime: u.taskdom_pending_state ? u.taskdom_pending_state.endTime : null
            });
        });

        globalTributes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        $w("#htmlMaster").postMessage({ 
            type: "updateDashboard", 
            users: allUsers, 
            globalQueue: globalQueue,
            globalTributes: globalTributes,
            dailyTasks: dailyTasksList,
            queenCMS: cmsItems
        });

    } catch (err) { console.error("Dash Refresh Error", err); }
}

async function refreshChatForUser(memberId) {
    if(!memberId) return;
    try {
        const msgs = await loadUserMessages(memberId);
        $w("#htmlMaster").postMessage({ type: "updateChat", memberId: memberId, messages: msgs });
    } catch(e) {}
}

async function dashboardHeartbeat() {
    try {
        lastHeartbeat = Date.now();
        const results = await wixData.query("Status")
            .eq("memberId", "xxxqkarinxxx@gmail.com")
            .eq("type", "Online")
            .find({suppressAuth: true});

        if(results.items.length > 0) {
            let item = results.items[0];
            item.date = new Date();
            await wixData.update("Status", item, {suppressAuth: true});
        }
    } catch(e) { console.error("Backend Heartbeat failed:", e); }
}

function startHeartbeat() {
    if (!heartbeatInterval) {
        heartbeatInterval = setInterval(dashboardHeartbeat, 30_000); 
    }
}

function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

function getPublicUrl(wixUrl) {
    if (!wixUrl) return "";
    if (wixUrl.startsWith("http")) return wixUrl; 
    if (wixUrl.startsWith("wix:image://v1/")) return `https://static.wixstatic.com/media/${wixUrl.split('/')[3].split('#')[0]}`;
    if (wixUrl.startsWith("wix:video://v1/")) return `https://video.wixstatic.com/video/${wixUrl.split('/')[3].split('#')[0]}/mp4/file.mp4`;
    return wixUrl;
}