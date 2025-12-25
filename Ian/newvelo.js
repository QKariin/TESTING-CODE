//import { createDomEngine } from 'public/shared-user-profile.js';
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
    // 1. Dom Engine Init for #html2
    //const testEngine = createDomEngine("#html2");
    //testEngine.init();

    // 2. Identification for Slave UI on #html2
    if (wixUsers.currentUser.loggedIn) {
        currentUserEmail = await wixUsers.currentUser.getEmail();
        updatePresenceAction(currentUserEmail);
        loadStaticData();
        loadRulesToInterface();
        syncProfileAndTasks();

        setInterval(() => updatePresenceAction(currentUserEmail), 60000);
        setInterval(syncProfileAndTasks, 5000);
        setInterval(checkDomOnlineStatus, 60000);
    }
});

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

$w("#html2").onMessage(async (event) => {
    const data = event.data;

    // --- HANDSHAKE: THE RECONNECT ---
    if (data.type === "UI_READY") {
        if (!currentUserEmail && wixUsers.currentUser.loggedIn) {
            currentUserEmail = await wixUsers.currentUser.getEmail();
        }
        if (currentUserEmail) {
            console.log("Database Reconnected for: " + currentUserEmail);
            await loadStaticData();
            await loadRulesToInterface();
            await syncProfileAndTasks();
            await checkDomOnlineStatus();
        }
    }

    // --- STAGE 1: FINISH KNEELING (Starts the 1-hour clock) ---
    else if (data.type === "FINISH_KNEELING") {
        const results = await wixData.query("Tasks").eq("memberId", currentUserEmail).find({ suppressAuth: true });
        if (results.items.length > 0) {
            let item = results.items[0];
            const now = Date.now();

            // Server-Side Cooldown Check (60,000ms = 1 Minute)
            if (item.lastWorship && (now - new Date(item.lastWorship).getTime() < 60000)) {
                return; // Cooldown active, reject the request
            }

            item.lastWorship = now; 
            item.kneelCount = (item.kneelCount || 0) + 1;
            await wixData.update("Tasks", item, { suppressAuth: true });

            await insertMessage({ memberId: currentUserEmail, message: "*kneels in devotion*", sender: "user", read: false });
            await syncProfileAndTasks();
        }
    }

    // --- STAGE 2: CLAIM REWARD (Economy Transaction) ---
    else if (data.type === "CLAIM_KNEEL_REWARD") {
        const results = await wixData.query("Tasks").eq("memberId", currentUserEmail).find({ suppressAuth: true });
        if (results.items.length > 0) {
            let item = results.items[0];
            const amount = data.rewardValue;
            if (data.rewardType === 'coins') item.wallet = (item.wallet || 0) + amount;
            else item.score = (item.score || 0) + amount;

            await wixData.update("Tasks", item, { suppressAuth: true });
            await insertMessage({ 
                memberId: currentUserEmail, 
                message: `${item.title_fld || "Slave"} earned ${amount} ${data.rewardType.toUpperCase()} for his devotion.`, 
                sender: "system", 
                read: false 
            });
            await syncProfileAndTasks();
        }
    }

    // --- PRESERVED LOGIC: FEEDS, CHAT, PURCHASES, TASKS ---
    else if (data.type === "heartbeat") { if (data.view === 'serve') await checkDomOnlineStatus(); }
    else if (data.type === "LOAD_Q_FEED") {
        try {
            const cmsResults = await wixData.query("QKarinonline").descending("_createdDate").limit(24).find({ suppressAuth: true });
            const processedItems = cmsResults.items.map(item => ({ ...item, url: getPublicUrl(item.page || item.url || item.media) }));
            $w("#html2").postMessage({ type: "UPDATE_Q_FEED", domVideos: processedItems });
        } catch(e) {}
    }
    else if (data.type === "savePendingState") { await secureUpdateTaskAction(currentUserEmail, { pendingState: data.pendingState, consumeQueue: data.consumeQueue }); await syncProfileAndTasks(); }
    else if (data.type === "uploadEvidence") {
        const proofType = data.mimeType && data.mimeType.startsWith('video') ? "video" : "image";
        await secureUpdateTaskAction(currentUserEmail, { addToQueue: { id: Date.now().toString(), text: data.task, proofUrl: data.fileUrl, proofType: proofType, status: "pending" } });
        await insertMessage({ memberId: currentUserEmail, message: "Proof Uploaded", sender: "system", read: false });
        await syncProfileAndTasks(); 
    }
    else if (data.type === "SEND_CHAT_TO_BACKEND") {
        const profileResult = await secureGetProfile(currentUserEmail);
        if (profileResult.success) {
            const messageCoins = (profileResult.profile.parameters || {}).MessageCoins || 10;
            const result = await processCoinTransaction(currentUserEmail, -messageCoins, "TAX");
            if (result.success) await insertMessage({ memberId: currentUserEmail, message: data.text, sender: "user", read: false });
            await syncChat(); 
        }
    }
    else if (data.type === "PURCHASE_ITEM") {
        const result = await processCoinTransaction(currentUserEmail, -Math.abs(data.cost), `Tribute: ${data.itemName}`);
        if (result.success) {
            await insertMessage({ memberId: currentUserEmail, message: data.messageToDom, sender: "system", read: false });
            await syncProfileAndTasks(); await syncChat();
        }
    }
    else if (data.type === "SEND_COINS") {
        const result = await processCoinTransaction(currentUserEmail, -Math.abs(data.amount), data.category);
        if (result.success) {
            const saying = funnySayings[Math.floor(Math.random() * funnySayings.length)];
            await insertMessage({ memberId: currentUserEmail, message: `You sent ${data.amount} coins. ${saying}`, sender: "system", type: "system_gold", read: true });
            await syncProfileAndTasks();
        }
    }
    else if (data.type === "INITIATE_STRIPE_PAYMENT") {
        try { const paymentUrl = await getPaymentLink(Number(data.amount)); wixLocation.to(paymentUrl); } catch (err) {}
    }
    else if (data.type === "taskSkipped") {
        await secureUpdateTaskAction(currentUserEmail, { clear: true, wasSkipped: true, taskTitle: data.taskTitle });
        await processCoinTransaction(currentUserEmail, -300, "TAX");
        await insertMessage({ memberId: currentUserEmail, message: `SKIPPED TASK: ${data.taskTitle}`, sender: "system", read: false });
        await syncProfileAndTasks();
    }
});

async function loadStaticData() {
    try {
        const [taskRes, wishRes] = await Promise.all([
            wixData.query("DailyTasks").limit(500).find({ suppressAuth: true }),
            wixData.query("Wishlist").limit(500).find({ suppressAuth: true })
        ]);
        staticTasksPool = taskRes.items.map(item => item.taskText || item.title || "Serve me.");
        const wishlist = wishRes.items.map(item => ({ id: item._id, name: item.title || "GIFT", price: Number(item.price || 0), img: getPublicUrl(item.image) }));
        $w("#html2").postMessage({ type: "INIT_TASKS", tasks: staticTasksPool });
        $w("#html2").postMessage({ type: "INIT_WISHLIST", wishlist });
    } catch (e) {}
}

async function syncProfileAndTasks() {
    if (!currentUserEmail) return;
    try {
        const statsResults = await wixData.query("Tasks").eq("memberId", currentUserEmail).find({suppressAuth: true});
        if(statsResults.items.length === 0) return;
        let s = statsResults.items[0];
        let history = []; if (s.taskdom_history) history = Array.isArray(s.taskdom_history) ? s.taskdom_history : JSON.parse(s.taskdom_history || "[]");
        let galleryData = history.map(item => ({ ...item, proofUrl: getPublicUrl(item.proofUrl), sticker: getPublicUrl(item.sticker) }));
        $w("#html2").postMessage({ type: "UPDATE_FULL_DATA", profile: { points: s.score || 0, kneelCount: s.kneelCount || 0, coins: s.wallet || 0, name: s.title_fld || s.title || "Slave", hierarchy: s.hierarchy || "HallBoy", profilePicture: getPublicUrl(s.image_fld) || "", joined: s.joined || s._createdDate, lastWorship: s.lastWorship }, pendingState: s.taskdom_pending_state || null, galleryData: galleryData, dailyTasks: staticTasksPool });
        await syncChat();
    } catch(e) {}
}

async function syncChat() { try { let chatHistory = await loadUserMessages(currentUserEmail); $w("#html2").postMessage({ type: "UPDATE_CHAT", chatHistory: chatHistory }); } catch(e) {} }
async function checkDomOnlineStatus() {
    try {
        const results = await wixData.query("Status").eq("memberId", "xxxqkarinxxx@gmail.com").eq("type", "Online").find({suppressAuth: true});
        let status = "LAST SEEN: TODAY"; let online = false;
        if (results.items.length > 0) { const diff = Math.floor((Date.now() - results.items[0].date.getTime()) / 60000); online = (diff < 3); status = online ? "ONLINE" : `LAST SEEN: ${diff}m AGO`; }
        $w("#html2").postMessage({ type: "UPDATE_DOM_STATUS", online: online, text: status });
    } catch (e) {}
}
function getPublicUrl(wixUrl) {
  if (!wixUrl) return "";
  if (typeof wixUrl === "object" && wixUrl.src) return getPublicUrl(wixUrl.src);
  if (wixUrl.startsWith("http")) return wixUrl;
  if (wixUrl.startsWith("wix:image://v1/")) return `https://static.wixstatic.com/media/${wixUrl.split('/')[3].split('#')[0]}`;
  if (wixUrl.startsWith("wix:video://v1/")) return `https://video.wixstatic.com/video/${wixUrl.split('/')[3].split('#')[0]}/mp4/file.mp4`;
  return wixUrl;
}