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
  if (wixUsers.currentUser.loggedIn) {
      currentUserEmail = await wixUsers.currentUser.getEmail();
      
      // Mark Online & Set Presence Loop
      updatePresenceAction(currentUserEmail);
      setInterval(() => updatePresenceAction(currentUserEmail), 60000);
      
      // Parallel Boot-up: Load everything in the background immediately
      // We don't send it yet, we just get it ready.
      const initialDataPromise = Promise.all([
          loadStaticData(),
          loadRulesToInterface(),
          syncProfileAndTasks()
      ]);

      // Set up secondary loops
      setInterval(syncProfileAndTasks, 5000);
      setInterval(checkDomOnlineStatus, 60000);
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
    } catch (error) { console.error("Error loading rules: ", error); }
}

// --- LISTEN FOR HTML MESSAGES ---
$w("#html2").onMessage(async (event) => {
    const data = event.data;

    // --- NEW: THE HANDSHAKE ---
    // When Vercel says it is loaded, Wix sends the data immediately
    if (data.type === "UI_READY") {
        console.log("Vercel Engine Ready. Sending data...");
        await loadStaticData();
        await loadRulesToInterface();
        await syncProfileAndTasks();
        await checkDomOnlineStatus();
    }

    else if (data.type === "heartbeat") {
        if (data.view === 'serve') await checkDomOnlineStatus();
    }

    else if (data.type === "LOAD_Q_FEED") {
        try {
            const cmsResults = await wixData.query("QKarinonline")
                .descending("_createdDate")
                .limit(24)
                .find({ suppressAuth: true });

            const processedItems = cmsResults.items.map(item => {
                // FIXED: Specifically looking for the "page" field key
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
        } catch(e) { console.error("Feed Error", e); }
    }

    else if (data.type === "savePendingState") {
        await secureUpdateTaskAction(currentUserEmail, { pendingState: data.pendingState, consumeQueue: data.consumeQueue });
        await syncProfileAndTasks(); 
    }

    else if (data.type === "CLAIM_KNEEL_REWARD") {
        const results = await wixData.query("Tasks")
            .eq("memberId", currentUserEmail)
            .find({ suppressAuth: true });

        if (results.items.length > 0) {
            let item = results.items[0];
            const amount = data.rewardValue;
            const type = data.rewardType; // 'coins' or 'points'

            // Update Database
            if (type === 'coins') {
                item.wallet = (item.wallet || 0) + amount;
            } else {
                item.score = (item.score || 0) + amount;
            }
            
            item.lastWorship = new Date();
            item.kneelCount = (item.kneelCount || 0) + 1;

            await wixData.update("Tasks", item, { suppressAuth: true });

            // Send custom message to chat
            const label = type === 'coins' ? "COINS 🪙" : "POINTS ⭐";
            await insertMessage({
                memberId: currentUserEmail,
                message: `${item.title_fld || "Slave"} earned ${amount} ${label} for his kneeling.`,
                sender: "system",
                read: false
            });

            // Sync UI
            await syncProfileAndTasks();
        }
    }
    
    else if (data.type === "uploadEvidence") {
        const proofType = data.mimeType && data.mimeType.startsWith('video') ? "video" : "image";
        await secureUpdateTaskAction(currentUserEmail, {
            addToQueue: { id: Date.now().toString(), text: data.task, proofUrl: data.fileUrl, proofType: proofType, status: "pending" }
        });
        await insertMessage({ memberId: currentUserEmail, message: "Proof Uploaded", sender: "system", read: false });
        await syncProfileAndTasks(); 
    }

    else if (data.type === "SEND_CHAT_TO_BACKEND") {
        const profileResult = await secureGetProfile(currentUserEmail);
        if (profileResult.success) {
            const messageCoins = (profileResult.profile.parameters || {}).MessageCoins || 10;
            const result = await processCoinTransaction(currentUserEmail, -messageCoins, "TAX");
            if (result.success) { await insertMessage({ memberId: currentUserEmail, message: data.text, sender: "user", read: false }); } 
            else { await insertMessage({ memberId: currentUserEmail, message: "Insufficient funds", sender: "system", read: true }); }
            await syncChat(); 
        }
    }

    else if (data.type === "PURCHASE_ITEM") {
    const result = await processCoinTransaction(currentUserEmail, -Math.abs(data.cost), `Tribute: ${data.itemName}`);
    if (result.success) {
        // Send as SYSTEM message (not user message)
        await insertMessage({ 
            memberId: currentUserEmail, 
            message: data.messageToDom, 
            sender: "system",  // ← Changed from "user" to "system"
            read: false 
        });
        
        await syncProfileAndTasks();
        await syncChat();
    }
}


    else if (data.type === "SESSION_REQUEST") {
        const result = await processCoinTransaction(currentUserEmail, -Math.abs(data.cost), "Session Hold");
        if (result.success) {
            const msg = `📅 REQUEST: ${data.sessionType.toUpperCase()} SESSION\nTime: ${data.requestedTimeLabel}\nFocus: ${data.focus}`;
            await insertMessage({ memberId: currentUserEmail, message: msg, sender: "system", read: false });
            await syncChat();
            await syncProfileAndTasks();
        }
    }

    else if (data.type === "SEND_COINS") {
        const amount = Number(data.amount);
        const saying = funnySayings[Math.floor(Math.random() * funnySayings.length)];
        const result = await processCoinTransaction(currentUserEmail, -Math.abs(amount), data.category);
        if (result.success) {
            await insertMessage({ memberId: currentUserEmail, message: `You sent ${amount} coins. ${saying}`, sender: "system", type: "system_gold", read: true });
            await syncProfileAndTasks();
        }
    }

    else if (data.type === "INITIATE_STRIPE_PAYMENT") {
        try {
            const paymentUrl = await getPaymentLink(Number(data.amount));
            wixLocation.to(paymentUrl);
        } catch (err) { console.error("Payment Failed", err); }
    }

    else if (data.type === "taskSkipped") {
        await secureUpdateTaskAction(currentUserEmail, { clear: true, wasSkipped: true, taskTitle: data.taskTitle });
        const result = await processCoinTransaction(currentUserEmail, -300, "TAX");
        if (result.success) { await insertMessage({ memberId: currentUserEmail, message: `SKIPPED TASK: ${data.taskTitle}`, sender: "system", read: false }); } 
        else { await insertMessage({ memberId: currentUserEmail, message: "Insufficient funds to skip", sender: "system", read: true }); }
        await syncProfileAndTasks();
    }
});

async function loadStaticData() {
    try {
        // 1. Load Tasks (Keep this as is)
        const taskResults = await wixData.query("DailyTasks").limit(500).find({ suppressAuth: true });
        staticTasksPool = taskResults.items.map(item => item.taskText || item.title || "Serve me.");
        $w("#html2").postMessage({ type: "INIT_TASKS", tasks: staticTasksPool });

        // 2. Load Wishlist (Tributes) - FIXED FOR YOUR FIELDS
        const wishResults = await wixData.query("Wishlist").limit(500).find({ suppressAuth: true });
        
        const wishlist = wishResults.items.map(item => ({ 
            id: item._id, // Wix internal ID
            name: item.title || "GIFT", // Your 'title' field
            price: Number(item.price || 0), // Your 'price' field
            cat: "all", // Default to 'all' since you have no categories
            img: getPublicUrl(item.image) // Your 'image' field
        }));

        $w("#html2").postMessage({ type: "INIT_WISHLIST", wishlist });
        console.log("Wix: Successfully sent " + wishlist.length + " tributes.");

    } catch (e) { console.error("Static Data Error", e); }
}

async function syncProfileAndTasks() {
    try {
        const statsResults = await wixData.query("Tasks").eq("memberId", currentUserEmail).find({suppressAuth: true});
        if(statsResults.items.length === 0) return;
        let statsItem = statsResults.items[0];

        let history = [];
        if (statsItem.taskdom_history) {
            if (Array.isArray(statsItem.taskdom_history)) history = statsItem.taskdom_history;
            else if (typeof statsItem.taskdom_history === 'string') { try { history = JSON.parse(statsItem.taskdom_history); } catch(e) { history = []; } }
        }
        
        let galleryData = history.map(item => ({ 
            ...item, 
            proofUrl: getPublicUrl(item.proofUrl), sticker: getPublicUrl(item.sticker),
            adminComment: item.adminComment || "", adminMedia: getPublicUrl(item.adminMedia) || ""
        }));

        let currentQueue = statsItem.taskQueue || statsItem.taskdom_task_queue || [];
        let rawDate = statsItem.joined || statsItem._createdDate;
        let safeJoinedString = rawDate ? new Date(rawDate).toISOString() : new Date().toISOString();

        $w("#html2").postMessage({ 
            type: "UPDATE_FULL_DATA",
            profile: {
                taskdom_total_tasks: statsItem.taskdom_total_tasks || 0,
                taskdom_completed_tasks: statsItem.taskdom_completed_tasks || 0,
                taskdom_streak: statsItem.taskdom_current_streak || 0,
                points: statsItem.score || 0,
                kneelCount: statsItem.kneelCount || 0,
                coins: statsItem.wallet || 0, 
                name: statsItem.title_fld || statsItem.title || "Slave",
                hierarchy: statsItem.hierarchy || "Newbie",
                profilePicture: getPublicUrl(statsItem.image_fld) || "",
                taskQueue: currentQueue,
                joined: safeJoinedString, 
                lastWorship: statsItem.lastWorship
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
    } catch(e) {}
}

async function checkDomOnlineStatus() {
    if(Date.now() - lastDomStatusCheck < 10000) return;
    lastDomStatusCheck = Date.now();
    try {
        const results = await wixData.query("Status").eq("memberId", "xxxqkarinxxx@gmail.com").eq("type", "Online").find({suppressAuth: true});
        let isOnline = false;
        let statusText = "LAST SEEN: TODAY";
        if (results.items.length > 0) {
            const lastActive = results.items[0].date.getTime();
            const diffMinutes = Math.floor((Date.now() - lastActive) / 60000);
            isOnline = (diffMinutes < 3);
            statusText = isOnline ? "ONLINE" : (diffMinutes < 60 ? `LAST SEEN: ${diffMinutes}m AGO` : `LAST SEEN: TODAY`);
        }
        $w("#html2").postMessage({ type: "UPDATE_DOM_STATUS", online: isOnline, text: statusText });
    } catch (e) { console.log("Status Error", e); }
}

function getPublicUrl(wixUrl) {
  if (!wixUrl) return "";
  if (typeof wixUrl === "object" && wixUrl.src) return getPublicUrl(wixUrl.src);
  if (wixUrl.startsWith("http")) return wixUrl;
  if (wixUrl.startsWith("wix:image://v1/")) return `https://static.wixstatic.com/media/${wixUrl.split('/')[3].split('#')[0]}`;
  if (wixUrl.startsWith("wix:video://v1/")) return `https://video.wixstatic.com/video/${wixUrl.split('/')[3].split('#')[0]}/mp4/file.mp4`;
  return wixUrl;
}