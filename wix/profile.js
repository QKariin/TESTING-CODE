import wixUsers from 'wix-users';
import wixData from 'wix-data';
import wixLocation from 'wix-location';

// --- BACKEND IMPORTS --- 
import { updatePresenceAction, secureUpdateTaskAction, processCoinTransaction } from 'backend/Actions.web.js';
import { insertMessage, loadUserMessages } from 'backend/Chat.web.js';
import { getPaymentLink } from 'backend/pay'; 
import { secureGetProfile } from 'backend/Profile.web.js';

let currentUserEmail = "";
let staticTasksPool = []; 
let lastDomStatusCheck = 0;

const funnySayings = [
    "Money talks. Yours just screamed 'QUEEN KARIN'.",
    "Your wallet belongs to Queen Karin anyway.",
    "A lovely tribute for Queen Karin. Good pet."
];

$w.onReady(async function () {
    try {
        if (wixUsers.currentUser.loggedIn) {
            currentUserEmail = await wixUsers.currentUser.getEmail();
            
            // Mark Online & Set Presence Loop
            await updatePresenceAction(currentUserEmail);
            setInterval(() => updatePresenceAction(currentUserEmail), 60000);
            
            // Parallel Boot-up
            await Promise.all([
                loadStaticData(),
                loadRulesToInterface(),
                syncProfileAndTasks()
            ]);
            
            // Set up secondary refresh loops
            setInterval(syncProfileAndTasks, 5000);
            setInterval(checkDomOnlineStatus, 60000);
        }
    } catch (error) {
        console.error("Initialization error:", error);
    }
});

// --- HELPER FUNCTION FOR RULES ---
async function loadRulesToInterface() {
    try {
        const results = await wixData.query("RULES").limit(1).find();
        if (results.items.length > 0) {
            const ruleData = results.items[0];
            $w('#html2').postMessage({
                type: 'UPDATE_RULES',
                payload: {
                    rule1: ruleData.rule1, rule2: ruleData.rule2, rule3: ruleData.rule3,
                    rule4: ruleData.rule4, rule5: ruleData.rule5, rule6: ruleData.rule6,
                    rule7: ruleData.rule7, rule8: ruleData.rule8
                }
            });
        }
    } catch (error) { 
        console.error("Error loading rules: ", error); 
    }
}

// --- LISTEN FOR HTML MESSAGES FROM VERCEL ---
$w("#html2").onMessage(async (event) => {
    try {
        const data = event.data;
        
        // A. HANDSHAKE (Immediate data push when Slave page loads)
        if (data.type === "UI_READY") {
            console.log("Slave UI Ready. Synchronizing...");
            await Promise.all([
                loadStaticData(),
                loadRulesToInterface(),
                syncProfileAndTasks(),
                checkDomOnlineStatus()
            ]);
        }
        else if (data.type === "heartbeat") {
            if (data.view === 'serve') await checkDomOnlineStatus();
        }
        
        // B. SOCIAL FEED LOGIC
        else if (data.type === "LOAD_Q_FEED") {
            try {
                const cmsResults = await wixData.query("QKarinonline")
                    .descending("_createdDate")
                    .limit(24)
                    .find({ suppressAuth: true });
                    
                const processedItems = cmsResults.items.map(item => {
                    const rawLink = item.page || item.url || item.media;
                    return {
                        ...item,
                        url: getPublicUrl(rawLink)
                    };
                });
                
                $w("#html2").postMessage({ 
                    type: "UPDATE_Q_FEED", 
                    domVideos: processedItems 
                });
            } catch(e) { 
                console.error("Feed Error", e); 
            }
        }
        
        // C. FRAGMENT REVEAL LOGIC (FIXED)
        else if (data.type === "REVEAL_FRAGMENT") {
            try {
                const results = await wixData.query("Tasks")
                    .eq("memberId", currentUserEmail)
                    .find({ suppressAuth: true });
                    
                if (results.items.length > 0) {
                    let user = results.items[0];
                    let progress = user.libraryProgressIndex || 1; // Default to Day 1
                    
                    // 1. Fetch the specific content for the slave's current level
                    const libraryRes = await wixData.query("DirectivesLibrary")
                        .eq("order", progress)
                        .limit(1)
                        .find({ suppressAuth: true });
                        
                    if (libraryRes.items.length > 0) {
                        const currentMedia = libraryRes.items[0].mediaUrl;
                        
                        // 2. Determine which square to unblur
                        let revealMap = [];
                        try { 
                            revealMap = JSON.parse(user.activeRevealMap || "[]"); 
                        } catch(e) { 
                            revealMap = []; 
                        }
                        
                        const availableSquares = [1, 2, 3, 4, 5, 6, 7, 8, 9]
                            .filter(n => !revealMap.includes(n));
                            
                        if (availableSquares.length > 0) {
                            // Random pick from the remaining hidden squares
                            const pick = availableSquares[Math.floor(Math.random() * availableSquares.length)];
                            revealMap.push(pick);
                            user.activeRevealMap = JSON.stringify(revealMap);
                            
                            // 3. CHECK FOR COMPLETION (9 squares)
                            if (revealMap.length === 9) {
                                let vault = [];
                                try { 
                                    vault = JSON.parse(user.rewardVault || "[]"); 
                                } catch(e) { 
                                    vault = []; 
                                }
                                
                                // Move to Vault and reset for next Day/Level
                                vault.push({
                                    day: progress,
                                    mediaUrl: currentMedia,
                                    unlockedAt: new Date().toISOString()
                                });
                                user.rewardVault = JSON.stringify(vault);
                                user.libraryProgressIndex = progress + 1;
                                user.activeRevealMap = "[]"; // Clear map for next item
                            }
                            
                            // Update database
                            await wixData.update("Tasks", user, { suppressAuth: true });
                            
                            // 4. Send Message to Chat
                            await insertMessage({
                                memberId: currentUserEmail,
                                message: `Slave revealed fragment #${pick} of Day ${progress} content.${revealMap.length === 9 ? ' COMPLETE! Added to vault.' : ''}`,
                                sender: "system",
                                read: false
                            });
                            
                            // 5. Sync the UI instantly
                            await syncProfileAndTasks();
                            
                            // 6. Send fragment data to UI
                            $w("#html2").postMessage({
                                type: "FRAGMENT_REVEALED",
                                fragmentNumber: pick,
                                day: progress,
                                totalRevealed: revealMap.length,
                                isComplete: revealMap.length === 9,
                                mediaUrl: revealMap.length === 9 ? currentMedia : null
                            });
                        }
                    }
                }
            } catch (error) {
                console.error("Fragment reveal error:", error);
                $w("#html2").postMessage({
                    type: "FRAGMENT_ERROR",
                    message: "Failed to reveal fragment. Please try again."
                });
            }
        }
        
        // D. TASK PROGRESS LOGIC
        else if (data.type === "savePendingState") {
            await secureUpdateTaskAction(currentUserEmail, { 
                pendingState: data.pendingState, 
                consumeQueue: data.consumeQueue 
            });
            
            // If consumeQueue is true, remove the first item from task queue
            if (data.consumeQueue) {
                try {
                    const results = await wixData.query("Tasks")
                        .eq("memberId", currentUserEmail)
                        .find({ suppressAuth: true });
                        
                    if (results.items.length > 0) {
                        let item = results.items[0];
                        let currentQueue = item.taskQueue || [];
                        
                        if (currentQueue.length > 0) {
                            // Remove the first task from queue
                            currentQueue.shift();
                            item.taskQueue = currentQueue;
                            await wixData.update("Tasks", item, { suppressAuth: true });
                            console.log("Task consumed from queue. Remaining:", currentQueue.length);
                        }
                    }
                } catch (e) {
                    console.error("Error consuming task from queue:", e);
                }
            }
            
            await syncProfileAndTasks(); 
        }
        else if (data.type === "uploadEvidence") {
            const proofType = data.mimeType && data.mimeType.startsWith('video') ? "video" : "image";
            await secureUpdateTaskAction(currentUserEmail, {
                addToQueue: { 
                    id: Date.now().toString(), 
                    text: data.task, 
                    proofUrl: data.fileUrl, 
                    proofType: proofType, 
                    status: "pending" 
                }
            });
            await insertMessage({ 
                memberId: currentUserEmail, 
                message: "Proof Uploaded", 
                sender: "system", 
                read: false 
            });
            await syncProfileAndTasks(); 
        }
        else if (data.type === "taskSkipped") {
            // This is called when a slave fails a task (300 coin penalty)
            await secureUpdateTaskAction(currentUserEmail, { 
                clear: true, 
                wasSkipped: true, 
                taskTitle: data.taskTitle 
            });
            const result = await processCoinTransaction(currentUserEmail, -300, "TAX");
            if (result.success) { 
                await insertMessage({ 
                    memberId: currentUserEmail, 
                    message: "TASK FAILED: " + data.taskTitle, 
                    sender: "system", 
                    read: false 
                }); 
            } 
            await syncProfileAndTasks();
        }
        
              // --- KNEELING REWARDS ---
        else if (data.type === "CLAIM_KNEEL_REWARD") {
            try {
                const results = await wixData.query("Tasks").eq("memberId", currentUserEmail).find({ suppressAuth: true });
                if (results.items.length > 0) {
                    let item = results.items[0];
                    const amount = data.rewardValue;
                    const type = data.rewardType; 
                    
                    if (type === 'coins') item.wallet = (item.wallet || 0) + amount;
                    else if (type === 'points') item.score = (item.score || 0) + amount;
                    
                    item.lastWorship = new Date();
                    item.kneelCount = (item.kneelCount || 0) + 1;

                    // History Logic (For the Grid)
                    let historyLog = {};
                    try { historyLog = item.kneel_history ? JSON.parse(item.kneel_history) : {}; } catch(e) { historyLog = {}; }
                    
                    const now = new Date();
                    const todayStr = now.toDateString();
                    const currentHour = now.getHours();

                    if (historyLog.date !== todayStr) historyLog = { date: todayStr, hours: [] };
                    if (!historyLog.hours) historyLog.hours = [];
                    if (!historyLog.hours.includes(currentHour)) historyLog.hours.push(currentHour);

                    item.kneel_history = JSON.stringify(historyLog);
                    
                    await wixData.update("Tasks", item, { suppressAuth: true });
                    const label = type === 'coins' ? "COINS" : type === 'points' ? "POINTS" : "FRAGMENT";
                    await insertMessage({ memberId: currentUserEmail, message: `Slave earned ${amount} ${label} for kneeling.`, sender: "system", read: false });
                    await syncProfileAndTasks();
                }
            } catch (error) { console.error("Kneel reward error:", error); }
        }
        
        // F. CHAT & TRIBUTES
        else if (data.type === "SEND_CHAT_TO_BACKEND") {
            const profileResult = await secureGetProfile(currentUserEmail);
            if (profileResult.success) {
                const messageCoins = (profileResult.profile.parameters || {}).MessageCoins || 10;
                const result = await processCoinTransaction(currentUserEmail, -messageCoins, "TAX");
                if (result.success) { 
                    await insertMessage({ 
                        memberId: currentUserEmail, 
                        message: data.text, 
                        sender: "user", 
                        read: false 
                    }); 
                } 
                await syncChat(); 
            }
        }
        else if (data.type === "PURCHASE_ITEM") {
            const result = await processCoinTransaction(currentUserEmail, -Math.abs(data.cost), "Tribute: " + data.itemName);
            if (result.success) {
                await insertMessage({ 
                    memberId: currentUserEmail, 
                    message: data.messageToDom, 
                    sender: "system", 
                    read: false 
                });
                await syncProfileAndTasks();
                await syncChat();
            }
        }
        else if (data.type === "SEND_COINS") {
            const amount = Number(data.amount);
            const saying = funnySayings[Math.floor(Math.random() * funnySayings.length)];
            const result = await processCoinTransaction(currentUserEmail, -Math.abs(amount), data.category);
            if (result.success) {
                await insertMessage({ 
                    memberId: currentUserEmail, 
                    message: "You sent " + amount + " coins. " + saying, 
                    sender: "system", 
                    read: true 
                });
                await syncProfileAndTasks();
            }
        }
        
        // G. PAYMENT & PROFILE PIC
        else if (data.type === "INITIATE_STRIPE_PAYMENT") {
            try {
                const paymentUrl = await getPaymentLink(Number(data.amount));
                wixLocation.to(paymentUrl);
            } catch (err) { 
                console.error("Payment Failed", err); 
            }
        }
        else if (data.type === "UPDATE_PROFILE_PIC") {
            const results = await wixData.query("Tasks")
                .eq("memberId", currentUserEmail)
                .find({ suppressAuth: true });
                
            if (results.items.length > 0) {
                let item = results.items[0];
                item.image_fld = data.url; 
                await wixData.update("Tasks", item, { suppressAuth: true });
                await insertMessage({ 
                    memberId: currentUserEmail, 
                    message: "Profile Picture Updated.", 
                    sender: "system", 
                    read: false 
                });
                await syncProfileAndTasks(); 
            }
        }

        // I. GENERIC FIELD UPDATE (For Lobby Settings)
        else if (data.type === "UPDATE_CMS_FIELD") {
            try {
                const results = await wixData.query("Tasks").eq("memberId", currentUserEmail).find({ suppressAuth: true });
                if (results.items.length > 0) {
                    let item = results.items[0];
                    
                    if (data.field === "title_fld") { 
                        item.title_fld = data.value; 
                        item.title = data.value; 
                    } 
                    else if (data.field === "routine") { 
                        item.routine = data.value; 
                        await insertMessage({ memberId: currentUserEmail, message: "PROTOCOL SET: " + data.value, sender: "system", read: false });
                    }
                    else if (data.field === "kink") { 
                        item.kink = data.value; 
                    }

                    if (data.cost > 0) {
                        item.wallet = (item.wallet || 0) - data.cost;
                    }
                    
                    await wixData.update("Tasks", item, { suppressAuth: true });
                    await syncProfileAndTasks();
                }
            } catch (e) { console.error("Field Update Error", e); }
        }
        
        // H. TASK QUEUE MANAGEMENT - NEW HANDLER
        else if (data.type === "updateTaskQueue") {
            try {
                const results = await wixData.query("Tasks")
                    .eq("memberId", data.memberId)
                    .find({ suppressAuth: true });

                if (results.items.length > 0) {
                    let item = results.items[0];
                    item.taskQueue = data.queue || [];
                    await wixData.update("Tasks", item, { suppressAuth: true });
                    console.log("Task queue updated for", data.memberId, ":", data.queue);
                    
                    // If this is the current user, immediately sync their profile
                    if (data.memberId === currentUserEmail) {
                        await syncProfileAndTasks();
                    }
                }
            } catch (e) {
                console.error("Error updating task queue:", e);
            }
        }
    } catch (error) {
        console.error("Message handler error:", error);
    }
});

async function loadStaticData() {
    try {
        const taskResults = await wixData.query("DailyTasks").limit(500).find({ suppressAuth: true });
        staticTasksPool = taskResults.items.map(item => item.taskText || item.title || "Serve me.");
        $w("#html2").postMessage({ type: "INIT_TASKS", tasks: staticTasksPool });
        
        const wishResults = await wixData.query("Wishlist").limit(500).find({ suppressAuth: true });
        const wishlist = wishResults.items.map(item => ({ 
            id: item._id, 
            name: item.title || "GIFT", 
            price: Number(item.price || 0), 
            img: getPublicUrl(item.image) 
        }));
        $w("#html2").postMessage({ type: "INIT_WISHLIST", wishlist });
    } catch (e) { 
        console.error("Static Data Error", e); 
    }
}

async function syncProfileAndTasks() {
    try {
        const statsResults = await wixData.query("Tasks").eq("memberId", currentUserEmail).find({ suppressAuth: true });
        if(statsResults.items.length === 0) return;
        
        let statsItem = statsResults.items[0];
        const silhouette = "https://static.wixstatic.com/media/ce3e5b_e06c7a2254d848a480eb98107c35e246~mv2.png";
        const userPic = statsItem.image_fld ? getPublicUrl(statsItem.image_fld) : silhouette;
        
        let history = [];
        try { history = statsItem.taskdom_history ? JSON.parse(statsItem.taskdom_history) : []; } catch(e) { history = []; }
        
        let galleryData = history.map(item => ({ ...item, proofUrl: getPublicUrl(item.proofUrl), sticker: getPublicUrl(item.sticker), adminComment: item.adminComment || "", adminMedia: getPublicUrl(item.adminMedia) || "" }));
        
        $w("#html2").postMessage({ 
            type: "UPDATE_FULL_DATA",
            profile: {
                taskdom_total_tasks: statsItem.taskdom_total_tasks || 0,
                taskdom_completed_tasks: statsItem.taskdom_completed_tasks || 0,
                taskdom_streak: statsItem.taskdom_streak || 0,
                taskdom_skipped_tasks: statsItem.taskdom_skipped_tasks || 0,
                points: statsItem.score || 0,
                kneelCount: statsItem.kneelCount || 0,
                coins: statsItem.wallet || 0, 
                name: statsItem.title_fld || statsItem.title || "Slave",
                hierarchy: statsItem.hierarchy || "Newbie",
                profilePicture: userPic, 
                lastWorship: statsItem.lastWorship,
                
                // DATA SYNC FIXES
                kneelHistory: statsItem.kneel_history, // Syncs Grid
                routine: statsItem.routine,            // Syncs Routine Name
                
                taskQueue: statsItem.taskQueue || [],
                joined: statsItem.joined || new Date().toISOString()
            }, 
            pendingState: statsItem.taskdom_pending_state || null,
            galleryData: galleryData,
            dailyTasks: staticTasksPool 
        });
        await syncChat();
    } catch(e) { console.log("Sync Error", e); }
}


async function syncChat() {
    try {
        let chatHistory = await loadUserMessages(currentUserEmail);
        $w("#html2").postMessage({ type: "UPDATE_CHAT", chatHistory: chatHistory });
    } catch(e) {
        console.error("Chat sync error:", e);
    }
}

async function checkDomOnlineStatus() {
    if(Date.now() - lastDomStatusCheck < 10000) return;
    lastDomStatusCheck = Date.now();
    
    try {
        const results = await wixData.query("Status")
            .eq("memberId", "xxxqkarinxxx@gmail.com")
            .eq("type", "Online")
            .find({ suppressAuth: true });
            
        let isOnline = false;
        let statusText = "LAST SEEN: TODAY";
        
        if (results.items.length > 0) {
            const lastActive = results.items[0].date.getTime();
            const diffMinutes = Math.floor((Date.now() - lastActive) / 60000);
            isOnline = (diffMinutes < 3);
            statusText = isOnline ? "ONLINE" : (diffMinutes < 60 ? "LAST SEEN: " + diffMinutes + "m AGO" : "LAST SEEN: TODAY");
        }
        
        $w("#html2").postMessage({ 
            type: "UPDATE_DOM_STATUS", 
            online: isOnline, 
            text: statusText 
        });
    } catch (e) { 
        console.log("Status Error", e); 
    }
}

function getPublicUrl(wixUrl) {
    if (!wixUrl) return "";
    if (typeof wixUrl === "object" && wixUrl.src) return getPublicUrl(wixUrl.src);
    if (wixUrl.startsWith("http")) return wixUrl;
    if (wixUrl.startsWith("wix:image://v1/")) {
        return `https://static.wixstatic.com/media/${wixUrl.split('/')[3].split('#')[0]}`;
    }
    if (wixUrl.startsWith("wix:video://v1/")) {
        return `https://video.wixstatic.com/video/${wixUrl.split('/')[3].split('#')[0]}/mp4/file.mp4`;
    }
    return wixUrl;
}