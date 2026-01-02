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
        
        // Parallel Boot-up
        loadStaticData();
        loadRulesToInterface();
        syncProfileAndTasks();

        // Set up secondary refresh loops
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

/// --- LISTEN FOR HTML MESSAGES FROM VERCEL ---
$w("#html2").onMessage(async (event) => {
    const data = event.data;

    // A. HANDSHAKE (Immediate data push when Slave page loads)
    if (data.type === "UI_READY") {
        console.log("Slave UI Ready. Synchronizing...");
        await loadStaticData();
        await loadRulesToInterface();
        await syncProfileAndTasks();
        await checkDomOnlineStatus();
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
        } catch(e) { console.error("Feed Error", e); }
    }

    else if (data.type === "REVEAL_FRAGMENT") {
        const results = await wixData.query("Tasks").eq("memberId", currentUserEmail).find({ suppressAuth: true });

        if (results.items.length > 0) {
            let user = results.items[0];
            let progress = 1; // Default to Day 1
            if (user.libraryProgressIndex) progress = user.libraryProgressIndex;

            // 1. Fetch the specific content for the slave's current level
            const libraryRes = await wixData.query("DirectivesLibrary").eq("order", progress).limit(1).find({ suppressAuth: true });
            
            if (libraryRes.items.length > 0) {
                const currentMedia = libraryRes.items[0].mediaUrl;
                
                // 2. Determine which square to unblur
                let revealMap = [];
                try { revealMap = JSON.parse(user.activeRevealMap || "[]"); } catch(e) { revealMap = []; }

                const availableSquares = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(n => !revealMap.includes(n));

                if (availableSquares.length > 0) {
                    const pick = availableSquares[Math.floor(Math.random() * availableSquares.length)];
                    revealMap.push(pick);
                    user.activeRevealMap = JSON.stringify(revealMap);

                    // 3. CHECK FOR COMPLETION (9 squares)
                    if (revealMap.length === 9) {
                        let vault = [];
                        try { vault = JSON.parse(user.rewardVault || "[]"); } catch(e) { vault = []; }
                        
                        vault.push({
                            day: progress,
                            mediaUrl: currentMedia,
                            unlockedAt: new Date().toISOString()
                        });
                        user.rewardVault = JSON.stringify(vault);
                        user.libraryProgressIndex = progress + 1;
                        user.activeRevealMap = "[]"; 
                    }

                    await wixData.update("Tasks", user, { suppressAuth: true });
                    
                    // --- THE FIX: INSTANT REVEAL ECHO ---
                    // We send the new map and the media URL to Vercel IMMEDIATELY
                    /*$w("#html2").postMessage({ 
                        type: "INSTANT_REVEAL_SYNC", 
                        activeRevealMap: revealMap,
                        currentLibraryMedia: getPublicUrl(currentMedia)
                    });*/

                    // Send animation data back to frontend 
                    $w("#html2").postMessage({ 
                        type: "FRAGMENT_REVEALED", 
                        fragmentNumber: pick, 
                        day: progress, 
                        totalRevealed: revealMap.length, 
                        isComplete: revealMap.length === 9 });

                    // 4. Send Message to Chat
                    await insertMessage({
                        memberId: currentUserEmail,
                        message: "Slave unblurred fragment #" + pick + " of Level " + progress + " content.",
                        sender: "system",
                        read: false
                    });

                    // 5. Sync the UI (Deep Sync)
                    await syncProfileAndTasks();
                }
            }
        }
    }
    
    else if (data.type === "PURCHASE_REVEAL") {
        const cost = Number(data.cost);
        const results = await wixData.query("Tasks").eq("memberId", currentUserEmail).find({ suppressAuth: true });

        if (results.items.length > 0) {
            let user = results.items[0];
            
            // 1. Double check the wallet (Security)
            if ((user.wallet || 0) < cost) {
                await insertMessage({ memberId: currentUserEmail, message: "Transaction Failed: Insufficient Coins.", sender: "system", read: true });
                return;
            }

            // 2. Subtract the Coins
            user.wallet -= cost;
            
            let progress = user.libraryProgressIndex || 1;
            const libraryRes = await wixData.query("DirectivesLibrary").eq("order", progress).limit(1).find({ suppressAuth: true });

            if (libraryRes.items.length > 0) {
                const currentMedia = libraryRes.items[0].mediaUrl;
                let revealMap = [];
                try { revealMap = JSON.parse(user.activeRevealMap || "[]"); } catch(e) { revealMap = []; }

                // --- CASE A: BUY SINGLE FRAGMENT (100) ---
                if (cost === 100) {
                    const availableSquares = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(n => !revealMap.includes(n));
                    if (availableSquares.length > 0) {
                        const pick = availableSquares[Math.floor(Math.random() * availableSquares.length)];
                        revealMap.push(pick);
                        user.activeRevealMap = JSON.stringify(revealMap);

                        // If that was the last square, move to Vault
                        if (revealMap.length === 9) {
                            let vault = [];
                            try { vault = JSON.parse(user.rewardVault || "[]"); } catch(e) { vault = []; }
                            vault.push({ day: progress, mediaUrl: currentMedia, unlockedAt: new Date().toISOString() });
                            user.rewardVault = JSON.stringify(vault);
                            user.libraryProgressIndex = progress + 1;
                            user.activeRevealMap = "[]";
                        }
                    }
                } 
                // --- CASE B: BUY FULL REVEAL (500) ---
                else if (cost === 500) {
                    let vault = [];
                    try { vault = JSON.parse(user.rewardVault || "[]"); } catch(e) { vault = []; }
                    
                    // Unlock everything instantly
                    revealMap = [1, 2, 3, 4, 5, 6, 7, 8, 9];
                    vault.push({ day: progress, mediaUrl: currentMedia, unlockedAt: new Date().toISOString() });
                    
                    user.rewardVault = JSON.stringify(vault);
                    user.libraryProgressIndex = progress + 1;
                    user.activeRevealMap = "[]"; // Clear map for next level
                }

                // 3. Save to Database
                await wixData.update("Tasks", user, { suppressAuth: true });

                // 4. Send Instant Echo to UI
                $w("#html2").postMessage({ 
                    type: "INSTANT_REVEAL_SYNC", 
                    activeRevealMap: revealMap,
                    currentLibraryMedia: getPublicUrl(currentMedia)
                });

                // 5. Notify Chat
                const msg = cost === 500 ? "Slave sacrificed 500 coins for Full Disclosure." : "Slave sacrificed 100 coins for a fragment.";
                await insertMessage({ memberId: currentUserEmail, message: msg, sender: "system", read: false });

                await syncProfileAndTasks();
            }
        }
    }
    // ... C, D, E logic continue here (NOT cut, just following your snippet)

    // C. TASK PROGRESS LOGIC
    else if (data.type === "savePendingState") {
        await secureUpdateTaskAction(currentUserEmail, { pendingState: data.pendingState, consumeQueue: data.consumeQueue });
        await syncProfileAndTasks(); 
    }

    else if (data.type === "uploadEvidence") {
        const proofType = data.mimeType && data.mimeType.startsWith('video') ? "video" : "image";
        await secureUpdateTaskAction(currentUserEmail, {
            addToQueue: { id: Date.now().toString(), text: data.task, proofUrl: data.fileUrl, proofType: proofType, status: "pending" }
        });
        await insertMessage({ memberId: currentUserEmail, message: "Proof Uploaded", sender: "system", read: false });
        await syncProfileAndTasks(); 
    }

    else if (data.type === "taskSkipped") {
        // This is called when a slave fails a task (300 coin penalty)
        await secureUpdateTaskAction(currentUserEmail, { clear: true, wasSkipped: true, taskTitle: data.taskTitle });
        const result = await processCoinTransaction(currentUserEmail, -300, "TAX");
        if (result.success) { 
            await insertMessage({ memberId: currentUserEmail, message: "TASK FAILED: " + data.taskTitle, sender: "system", read: false }); 
        } 
        await syncProfileAndTasks();
    }

    // D. DEVOTION LOGIC
    else if (data.type === "FINISH_KNEELING") {
        // SECURITY LOCK: Save the kneeling completion time immediately
        const results = await wixData.query("Tasks")
            .eq("memberId", currentUserEmail)
            .find({ suppressAuth: true });

        if (results.items.length > 0) {
            let item = results.items[0];
            item.lastWorship = new Date(); // Lock the 60-minute timer
            await wixData.update("Tasks", item, { suppressAuth: true });
        }
    }

    else if (data.type === "CLAIM_KNEEL_REWARD") {
        const results = await wixData.query("Tasks")
            .eq("memberId", currentUserEmail)
            .find({ suppressAuth: true });

        if (results.items.length > 0) {
            let item = results.items[0];
            const amount = data.rewardValue;
            const type = data.rewardType; 

            if (type === 'coins') {
                item.wallet = (item.wallet || 0) + amount;
            } else {
                item.score = (item.score || 0) + amount;
                item.dailyScore = (item.dailyScore || 0) + amount;
                item.weeklyScore = (item.weeklyScore || 0) + amount;
                item.monthlyScore = (item.monthlyScore || 0) + amount;
                item.yearlyScore = (item.yearlyScore || 0) + amount;
            }
            
            item.kneelCount = (item.kneelCount || 0) + 1;
            await wixData.update("Tasks", item, { suppressAuth: true });

            const label = type === 'coins' ? "COINS" : "POINTS";
            await insertMessage({
                memberId: currentUserEmail,
                message: "Slave earned " + amount + " " + label + " for kneeling.",
                sender: "system",
                read: false
            });

            await syncProfileAndTasks();
        }
    }

    // E. CHAT & TRIBUTES
    else if (data.type === "SEND_CHAT_TO_BACKEND") {
        const profileResult = await secureGetProfile(currentUserEmail);
        if (profileResult.success) {
            const messageCoins = (profileResult.profile.parameters || {}).MessageCoins || 10;
            const result = await processCoinTransaction(currentUserEmail, -messageCoins, "TAX");
            if (result.success) { 
                await insertMessage({ memberId: currentUserEmail, message: data.text, sender: "user", read: false }); 
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
            await insertMessage({ memberId: currentUserEmail, message: "You sent " + amount + " coins. " + saying, sender: "system", read: true });
            await syncProfileAndTasks();
        }
    }

    // F. PAYMENT & PROFILE PIC
    else if (data.type === "INITIATE_STRIPE_PAYMENT") {
        try {
            const paymentUrl = await getPaymentLink(Number(data.amount));
            wixLocation.to(paymentUrl);
        } catch (err) { console.error("Payment Failed", err); }
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

    // G. VAULT RENDERING (New handler for renderVault function)
    else if (data.type === "RENDER_VAULT") {
        // Trigger a sync to send the latest vault data to frontend
        await syncProfileAndTasks();
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

    } catch (e) { console.error("Static Data Error", e); }
}

async function syncProfileAndTasks() {
    try {
        console.log("Synchronize Profile and tasks")
        const statsResults = await wixData.query("Tasks").eq("memberId", currentUserEmail).find({suppressAuth: true});
        if(statsResults.items.length === 0) return;
        let statsItem = statsResults.items[0];

        // --- THE MISSING CONNECTION ---
        // 1. Check which item the slave is currently on (Day 1, Day 2, etc.)
        // Force the ID to be a Number so the CMS can find it
        const libIndex = Number(statsItem.libraryProgressIndex || 1);

        const libRes = await wixData.query("DirectivesLibrary")
            .eq("order", libIndex) // This must match the Number type in your CMS
            .limit(1)
            .find({ suppressAuth: true });
        //console.log("%c LIBRARY CHECK: Found " + libRes.items.length + " items", "color: cyan; font-size: 15px; font-weight: bold;");

        let mediaForGrid = "";
        if (libRes.items.length > 0) {
            // Convert the Wix URL to a real web link
            //console.log("media: ", libRes.items[0].mediaUrl, libRes.items[0].mediaUrl.src)
            mediaForGrid = getPublicUrl(libRes.items[0].mediaUrl[0].src);
            //console.log(mediaForGrid)
        }


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

        // Push data to the Vercel Slave Profile
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
                profilePicture: statsItem.image_fld ? getPublicUrl(statsItem.image_fld) : "https://static.wixstatic.com/media/ce3e5b_e06c7a2254d848a480eb98107c35e246~mv2.png",
                taskQueue: currentQueue,
                joined: safeJoinedString, 
                lastWorship: statsItem.lastWorship,
                // --- THESE FOUR FIELDS RECONNECT THE REWARD SYSTEM ---
                activeRevealMap: statsItem.activeRevealMap || "[]",
                currentLibraryMedia: mediaForGrid, // This is the URL we just fetched
                libraryProgressIndex: libIndex,
                // --- ADD VAULT DATA FOR renderVault FUNCTION ---
                rewardVault: statsItem.rewardVault || "[]"
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
            statusText = isOnline ? "ONLINE" : (diffMinutes < 60 ? "LAST SEEN: " + diffMinutes + "m AGO" : "LAST SEEN: TODAY");
        }
        $w("#html2").postMessage({ type: "UPDATE_DOM_STATUS", online: isOnline, text: statusText });
    } catch (e) { console.log("Status Error", e); }
}

/*function getPublicUrl(wixUrl) {
    if (!wixUrl) return "";
    if (typeof wixUrl === "object" && wixUrl.src) wixUrl = wixUrl.src;
    if (wixUrl.startsWith("http")) return wixUrl;
    
    // THE FIX: Professional extraction for Wix Images and Videos
    if (wixUrl.startsWith("wix:image://v1/")) {
        const parts = wixUrl.split('/');
        const id = parts[3].split('#')[0];
        return `https://static.wixstatic.com/media/${id}`;
    }
    if (wixUrl.startsWith("wix:video://v1/")) {
        const parts = wixUrl.split('/');
        const id = parts[3].split('#')[0];
        return `https://video.wixstatic.com/video/${id}/mp4/file.mp4`;
    }
    return wixUrl;
}*/

function getPublicUrl(wixUrl) {
    if (!wixUrl) return "";

    // If Wix returns a media object (common on member pages)
    if (typeof wixUrl === "object") {
        if (wixUrl.src) wixUrl = wixUrl.src;
        else if (wixUrl.url) wixUrl = wixUrl.url;
        else return "";
    }

    // Ensure wixUrl is a string
    wixUrl = String(wixUrl);

    // Direct external URL
    if (wixUrl.startsWith("http")) return wixUrl;

    // Wix image format: wix:image://v1/<id>/...
    if (wixUrl.startsWith("wix:image://v1/")) {
        const parts = wixUrl.split('/');
        const id = parts[3].split('#')[0];
        return `https://static.wixstatic.com/media/${id}`;
    }

    // Wix video format: wix:video://v1/<id>/...
    if (wixUrl.startsWith("wix:video://v1/")) {
        const parts = wixUrl.split('/');
        const id = parts[3].split('#')[0];
        return `https://video.wixstatic.com/video/${id}/mp4/file.mp4`;
    }

    return wixUrl;
}