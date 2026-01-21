



// main.js - FINAL COMPLETE VERSION (DESKTOP + MOBILE)

import { CONFIG, URLS, LEVELS, FUNNY_SAYINGS, STREAM_PASSWORDS } from './config.js';
import { 
    gameStats, stats, userProfile, currentTask, taskDatabase, galleryData, 
    pendingTaskState, taskJustFinished, cooldownInterval, ignoreBackendUpdates, 
    lastChatJson, lastGalleryJson, isInitialLoad, chatLimit, lastNotifiedMessageId, 
    historyLimit, pendingLimit, currentView, resetUiTimer, taskQueue, 
    audioUnlocked, cmsHierarchyData, WISHLIST_ITEMS, lastWorshipTime, 
    currentHistoryIndex, touchStartX, isLocked, COOLDOWN_MINUTES,
    setGameStats, setStats, setUserProfile, setCurrentTask, setTaskDatabase, 
    setGalleryData, setPendingTaskState, setTaskJustFinished, setIgnoreBackendUpdates, 
    setLastChatJson, setLastGalleryJson, setIsInitialLoad, setChatLimit, 
    setLastNotifiedMessageId, setHistoryLimit, setCurrentView, setResetUiTimer, 
    setTaskQueue, setCmsHierarchyData, setWishlistItems, setLastWorshipTime, 
    setCurrentHistoryIndex, setTouchStartX, setIsLocked, setCooldownInterval, setActiveRevealMap, setVaultItems, setCurrentLibraryMedia, setLibraryProgressIndex 
} from './state.js';
import { renderRewardGrid, runTargetingAnimation } from '../profile/kneeling/reward.js';
import { triggerSound, migrateGameStatsToStats } from './utils.js';
import { switchTab, toggleStats, openSessionUI, closeSessionUI, updateSessionCost, toggleSection, renderDomVideos, renderNews, renderWishlist } from './ui.js';
import { getRandomTask, restorePendingUI, finishTask, cancelPendingTask, resetTaskDisplay } from './tasks.js';
import { renderChat, sendChatMessage, handleChatKey, sendCoins, loadMoreChat, openChatPreview, closeChatPreview, forceBottom } from './chat.js';
import { renderGallery, loadMoreHistory, initModalSwipeDetection, closeModal, toggleHistoryView, openHistoryModal, openModal } from './gallery.js';
import { handleEvidenceUpload, handleProfileUpload, handleAdminUpload } from './uploads.js';
import { handleHoldStart, handleHoldEnd, claimKneelReward, updateKneelingStatus } from '../profile/kneeling/kneeling.js';
import { Bridge } from './bridge.js';
import { getOptimizedUrl } from './media.js';

const KINK_LIST = [
    "JOI", "Humiliation", "SPH", "Findom", "D/s", "Control", "Ownership", 
    "Chastity", "CEI", "Blackmail play", "Objectification", "Degradation", 
    "Task submission", "CBT", "Training", "Power exchange", "Verbal domination", 
    "Protocol", "Obedience", "Psychological domination"
];

// =========================================
// POVERTY SYSTEM (MOCKING LOGIC)
// =========================================

window.triggerPoverty = function() {
    const overlay = document.getElementById('povertyOverlay');
    const text = document.getElementById('povertyInsult');
    
    // 1. POVERTY INSULTS LIST
    const insults = [
        "Your wallet is as empty as your worth.",
        "Do not waste my time with empty pockets.",
        "Silence is free. Serving me costs.",
        "Go beg for coins, then come back.",
        "You cannot afford to look at me.",
        "Access Denied. Reason: Poverty."
    ];

    // 2. Pick Random Insult
    if(text) text.innerText = `"${insults[Math.floor(Math.random() * insults.length)]}"`;

    // 3. SHOW THE OVERLAY (Force Flex to center it)
    if(overlay) {
        overlay.classList.remove('hidden');
        overlay.style.display = 'flex'; 
    }
};

window.closePoverty = function() {
    const overlay = document.getElementById('povertyOverlay');
    if(overlay) {
        overlay.classList.add('hidden');
        overlay.style.display = 'none';
    }
};

window.goToExchequer = function() {
    // 1. Close the Insult
    window.closePoverty();

    // 2. Close the Daily Duties (if they were there)
    if(window.closeQueenMenu) window.closeQueenMenu();

     // This reveals the "viewMobileGlobal" section
    window.toggleMobileView('global'); 

    // 4. Pop open the Store Overlay immediately
    // We wait 100ms just to make sure the view transition is done
    setTimeout(() => {
        if(window.openExchequer) window.openExchequer();
    }, 100);
};

// --- 2. CRITICAL UI FUNCTIONS ---

window.toggleTaskDetails = function(forceOpen = null) {
    if (window.event) window.event.stopPropagation();
    const panel = document.getElementById('taskDetailPanel');
    const link = document.querySelector('.see-task-link'); 
    const chatBox = document.getElementById('chatBox'); 
    if (!panel) return;
    const isOpen = panel.classList.contains('open');
    let shouldOpen = (forceOpen === true) ? true : (forceOpen === false ? false : !isOpen);

    if (shouldOpen) {
        panel.classList.add('open');
        if(chatBox) chatBox.classList.add('focused-task');
        if(link) { link.innerHTML = "▲ HIDE DIRECTIVE ▲"; link.style.opacity = "1"; }
    } else {
        panel.classList.remove('open');
        if(chatBox) chatBox.classList.remove('focused-task');
        if(link) { link.innerHTML = "▼ SEE DIRECTIVE ▼"; link.style.opacity = "1"; }
    }
};

window.updateTaskUIState = function(isActive) {
    const statusText = document.getElementById('mainStatusText');
    const idleMsg = document.getElementById('idleMessage');
    const timerRow = document.getElementById('activeTimerRow');
    const reqBtn = document.getElementById('mainButtonsArea');
    const uploadArea = document.getElementById('uploadBtnContainer');

    if (isActive) {
        if (statusText) { statusText.innerText = "WORKING"; statusText.className = "status-text-lg status-working"; }
        if (idleMsg) idleMsg.classList.add('hidden');
        if (timerRow) timerRow.classList.remove('hidden');
        if (reqBtn) reqBtn.classList.add('hidden');
        if (uploadArea) uploadArea.classList.remove('hidden');
    } else {
        if (statusText) { statusText.innerText = "UNPRODUCTIVE"; statusText.className = "status-text-lg status-unproductive"; }
        if (idleMsg) idleMsg.classList.remove('hidden');
        if (timerRow) timerRow.classList.add('hidden');
        if (reqBtn) reqBtn.classList.remove('hidden');
        if (uploadArea) uploadArea.classList.add('hidden');
        window.toggleTaskDetails(false);
    }
};

document.addEventListener('click', function(event) {
    const card = document.getElementById('taskCard');
    const panel = document.getElementById('taskDetailPanel');
    if (event.target.closest('.see-task-link')) return;
    if (panel && panel.classList.contains('open') && card && !card.contains(event.target)) {
        window.toggleTaskDetails(false);
    }
});

// --- 3. INITIALIZATION ---

document.addEventListener('click', () => {
    if (!window.audioUnlocked) {
        ['msgSound', 'coinSound', 'skipSound', 'sfx-buy', 'sfx-deny'].forEach(id => {
            const sound = document.getElementById(id);
            if (sound) {
                const originalVolume = sound.volume;
                sound.volume = 0;
                sound.play().then(() => { sound.pause(); sound.currentTime = 0; sound.volume = originalVolume; }).catch(e => console.log("Audio Engine Ready"));
            }
        });
        window.audioUnlocked = true;
    }
}, { once: true });

const resizer = new ResizeObserver(() => { 
    if(window.parent) window.parent.postMessage({ iframeHeight: document.body.scrollHeight }, '*'); 
});
resizer.observe(document.body);

function initDomProfile() {
    const frame = document.getElementById('twitchFrame');
    if(frame && !frame.src) {
        const parents = ["qkarin.com", "www.qkarin.com", "entire-ecosystem.vercel.app", "html-components.wixusercontent.com", "filesusr.com", "editor.wix.com", "manage.wix.com", "localhost"];
        let parentString = "";
        parents.forEach(p => parentString += `&parent=${p}`);
        frame.src = `https://player.twitch.tv/?channel=${CONFIG.TWITCH_CHANNEL}${parentString}&muted=true&autoplay=true`;
    }
}
initDomProfile();

// --- 4. BRIDGE LISTENER ---

Bridge.listen((data) => {
    const ignoreList = ["CHAT_ECHO", "UPDATE_FULL_DATA", "UPDATE_DOM_STATUS", "instantUpdate", "instantReviewSuccess"];
    if (ignoreList.includes(data.type)) return; 
    window.postMessage(data, "*"); 
});

// =========================================

// NEW: SETTINGS LOGIC (FIXED ROUTINE CRASH)

// =========================================



let currentActionType = "";

let currentActionCost = 0;

let selectedRoutineValue = ""; // <--- NEW VARIABLE TO STORE SELECTION



// 1. NAVIGATION

window.openLobby = function() {

    document.getElementById('lobbyOverlay').classList.remove('hidden');

    window.backToLobbyMenu();

};



window.closeLobby = function() {

    document.getElementById('lobbyOverlay').classList.add('hidden');

};



window.backToLobbyMenu = function() {

    document.getElementById('lobbyMenu').classList.remove('hidden');

    document.getElementById('lobbyActionView').classList.add('hidden');

};



// 2. SETUP ACTION SCREEN

let selectedKinks = new Set(); // Store selections



window.showLobbyAction = function(type) {

    currentActionType = type;

    

    const prompt = document.getElementById('lobbyPrompt');

    const input = document.getElementById('lobbyInputText');

    const fileBtn = document.getElementById('lobbyInputFileBtn');

    const routineArea = document.getElementById('routineSelectionArea');

    const kinkArea = document.getElementById('kinkSelectionArea'); // NEW

    const costDisplay = document.getElementById('lobbyCostDisplay');



    // Reset UI

    input.classList.add('hidden');

    fileBtn.classList.add('hidden');

    routineArea.classList.add('hidden');

    if(kinkArea) kinkArea.classList.add('hidden');

    

    // Switch View

    document.getElementById('lobbyMenu').classList.add('hidden');

    document.getElementById('lobbyActionView').classList.remove('hidden');



    if (type === 'name') {

        prompt.innerText = "Enter your new name.";

        input.classList.remove('hidden');

        currentActionCost = 100;

    } 

    else if (type === 'photo') {

        prompt.innerText = "Upload a new profile picture.";

        fileBtn.classList.remove('hidden');

        currentActionCost = 500;

    }

    else if (type === 'limits') {

        prompt.innerText = "Define your hard limits.";

        input.classList.remove('hidden');

        currentActionCost = 200;

    }

    else if (type === 'routine') {

        prompt.innerText = "Select a Daily Routine.";

        routineArea.classList.remove('hidden');

        document.getElementById('routineDropdown').value = "Morning Kneel";

        window.checkRoutineDropdown();

        return; 

    }

    // *** NEW KINK LOGIC ***

    else if (type === 'kinks') {

        prompt.innerText = "Select your perversions.";

        if(kinkArea) {

            kinkArea.classList.remove('hidden');

            renderKinkGrid();

        }

        currentActionCost = 0;

    }



    costDisplay.innerText = currentActionCost;

};



// NEW: RENDER KINK GRID

function renderKinkGrid() {

    const grid = document.getElementById('kinkGrid');

    if(!grid) return;

    grid.innerHTML = ""; // Clear

    selectedKinks.clear(); // Reset selection



    KINK_LIST.forEach(kink => {

        const btn = document.createElement('div');

        btn.className = "routine-tile";

        btn.innerText = kink.toUpperCase();

        btn.onclick = () => toggleKinkSelection(btn, kink);

        grid.appendChild(btn);

    });

}



// NEW: TOGGLE SELECTION

window.toggleKinkSelection = function(el, value) {

    if (selectedKinks.has(value)) {

        selectedKinks.delete(value);

        el.classList.remove('selected');

    } else {

        selectedKinks.add(value);

        el.classList.add('selected');

    }

    

    // Update Price (100 per kink)

    currentActionCost = selectedKinks.size * 100;

    document.getElementById('lobbyCostDisplay').innerText = currentActionCost;

};



// 3. HANDLE ROUTINE TILE SELECTION (FIXED)

window.selectRoutineItem = function(el, value) {

    // 1. Visually deselect all others

    document.querySelectorAll('.routine-tile').forEach(t => t.classList.remove('selected'));

    

    // 2. Select clicked

    el.classList.add('selected');

    

    // 3. Save Value to Variable (Not Element)

    selectedRoutineValue = value;



    // 4. Handle Logic

    const input = document.getElementById('routineCustomInput');

    const costDisplay = document.getElementById('lobbyCostDisplay');

    

    if (value === 'custom') {

        input.classList.remove('hidden');

        currentActionCost = 2000;

    } else {

        input.classList.add('hidden');

        currentActionCost = 1000;

    }

    

    costDisplay.innerText = currentActionCost;

};



// 4. EXECUTE ACTION (FIXED ROUTINE SELECTION)

window.confirmLobbyAction = function() {

    // 1. Check Funds

    if (gameStats.coins < currentActionCost) {

        window.triggerPoverty();

        return;

    }



    let payload = "";

    let notifyTitle = "SYSTEM UPDATE";

    let notifyText = "Changes saved.";



    // --- A. ROUTINE LOGIC (THE FIX) ---

    if (currentActionType === 'routine') {

        // USE THE GLOBAL VARIABLE FROM TILE SELECTION

        let taskName = selectedRoutineValue; 

        

        // If Custom, read the input box

        if (taskName === 'custom') {

            taskName = document.getElementById('routineCustomInput').value;

        }

        

        // If still empty, stop here

        if(!taskName) return;



        notifyTitle = "PROTOCOL ASSIGNED";

        notifyText = taskName.toUpperCase();



        // Send to Wix

        window.parent.postMessage({ 

            type: "UPDATE_CMS_FIELD", 

            field: "routine", 

            value: taskName,

            cost: currentActionCost,

            message: "Routine set to: " + taskName

        }, "*");

        

        // Immediate UI Update

        userProfile.routine = taskName; // Update memory

        

        const btn = document.getElementById('btnDailyRoutine');

        const noMsg = document.getElementById('noRoutineMsg');

        

        if(btn) {

            btn.classList.remove('hidden');

            // Update button text inside the Queen Menu

            const txt = document.getElementById('routineBtnText'); 

            if(txt) txt.innerText = "SUBMIT: " + taskName.toUpperCase();

        }

        if(noMsg) noMsg.style.display = 'none';

    } 

    

    // --- B. PHOTO LOGIC ---

    else if (currentActionType === 'photo') {

        const fileInput = document.getElementById('lobbyFile');

        if (fileInput.files.length > 0) {

            notifyTitle = "VISUALS LOGGED";

            notifyText = "Uploading...";



            window.parent.postMessage({ 

                type: "PROCESS_PAYMENT", 

                cost: 500, 

                note: "Photo Change" 

            }, "*");

            

            if(window.handleProfileUpload) window.handleProfileUpload(fileInput);

        } else { return; }

    }

    

    // --- C. NAME LOGIC ---

    else if (currentActionType === 'name') {

        const text = document.getElementById('lobbyInputText').value;

        if(!text) return;

        

        notifyTitle = "IDENTITY REWRITTEN";

        notifyText = text.toUpperCase();



        window.parent.postMessage({ 

            type: "UPDATE_CMS_FIELD", 

            field: "title_fld", 

            value: text,

            cost: 100,

            message: "Name changed to: " + text

        }, "*");



        // Update UI

        const el = document.getElementById('mob_slaveName');

        const halo = document.getElementById('mob_slaveName'); // Halo uses same ID usually

        if(el) el.innerText = text;

        if(halo) halo.innerText = text;

        userProfile.name = text;

    }

    

    // --- D. KINKS LOGIC ---

    else if (currentActionType === 'kinks') {

        // Safe check

        if (typeof selectedKinks === 'undefined' || selectedKinks.size === 0) return;

        

        const kinkString = Array.from(selectedKinks).join(", ");

        notifyTitle = "FILE UPDATED";

        notifyText = "Kinks registered.";



        window.parent.postMessage({ 

            type: "UPDATE_CMS_FIELD", 

            field: "kink", 

            value: kinkString,

            cost: currentActionCost,

            message: "Kinks: " + kinkString

        }, "*");

    }



    // --- E. LIMITS LOGIC ---

    else {

        const text = document.getElementById('lobbyInputText').value;

        if(!text) return;



        notifyTitle = "DATA APPENDED";

        notifyText = "Limits updated.";



        window.parent.postMessage({ 

            type: "PURCHASE_ITEM", 

            itemName: currentActionType.toUpperCase() + ": " + text, 

            cost: currentActionCost, 

            messageToDom: "Limits: " + text 

        }, "*");

    }



    // FINAL: Close & Celebrate

    window.closeLobby();

    

    // Trigger the Green Notification

    if(window.showSystemNotification) {

        window.showSystemNotification(notifyTitle, notifyText);

    }

};



// --- NOTIFICATION SYSTEM ---

window.showSystemNotification = function(title, detail) {

    const overlay = document.getElementById('celebrationOverlay');

    if(!overlay) return;



    // Inject Dynamic HTML

    overlay.innerHTML = `

        <div class="glass-card" style="border: 1px solid var(--neon-green); text-align:center; padding: 30px; background: rgba(0,0,0,0.95); box-shadow: 0 0 30px rgba(0,255,0,0.2);">

            <div style="font-family:'Orbitron'; font-size:1.2rem; color:var(--neon-green); margin-bottom:10px; letter-spacing:2px;">${title}</div>

            <div style="font-family:'Cinzel'; font-size:0.9rem; color:#fff;">${detail}</div>

        </div>

    `;



    // Show

    overlay.style.pointerEvents = "auto";

    overlay.style.opacity = '1';



    // Hide after 3 seconds

    setTimeout(() => {

        overlay.style.opacity = '0';

        overlay.style.pointerEvents = "none";

    }, 3000);

};




window.addEventListener("message", (event) => {
    try {
        const data = event.data;

        if (data.type === "CHAT_ECHO" && data.msgObj) renderChat([data.msgObj], true);

        if (data.type === 'UPDATE_RULES') {
            const rules = data.payload || {};
            for (let i = 1; i <= 8; i++) {
                const el = document.getElementById('r' + i);
                if (el && rules['rule' + i]) el.innerHTML = rules['rule' + i];
            }
        }

        if (data.type === "INIT_TASKS") {
            setTaskDatabase(data.tasks || []);
        }
        if (data.type === "INIT_WISHLIST" || data.wishlist) {
            setWishlistItems(data.wishlist || []);
            window.WISHLIST_ITEMS = data.wishlist || []; 
            renderWishlist();
        }

        // UPDATED STATUS HANDLER (DESKTOP + MOBILE)
        if (data.type === "UPDATE_DOM_STATUS") {
            // 1. Desktop Updates
            const badge = document.getElementById('chatStatusBadge');
            const ring = document.getElementById('chatStatusRing');
            const domBadge = document.getElementById('domStatusBadge');
            
            if(badge) { 
                badge.innerHTML = data.online ? "ONLINE" : data.text; 
                badge.className = data.online ? "chat-status-text chat-online" : "chat-status-text"; 
            }
            if(ring) ring.className = data.online ? "dom-status-ring ring-active" : "dom-status-ring ring-inactive";
            if(domBadge) { 
                domBadge.innerHTML = data.online ? '<span class="status-dot"></span> ONLINE' : `<span class="status-dot"></span> ${data.text}`; 
                domBadge.className = data.online ? "dom-status status-online" : "dom-status"; 
            }

            // 2. Mobile Updates (The New Header)
            const mobText = document.getElementById('mobChatStatusText');
            const mobDot = document.getElementById('mobChatOnlineDot');
            const hudDot = document.getElementById('hudDomStatus'); // The Dashboard Circle

            if(mobText) {
                mobText.innerText = data.online ? "ONLINE NOW" : data.text.toUpperCase();
                mobText.style.color = data.online ? "#00ff00" : "#888";
            }
            
            const dotClass = data.online ? 'status-dot online' : 'status-dot'; // Reuse class logic
            if(mobDot) mobDot.className = dotClass;
            
            // Update Dashboard HUD too
            if(hudDot) hudDot.className = data.online ? 'hud-status-dot online' : 'hud-status-dot offline';
        }

        if (data.type === "UPDATE_Q_FEED") {
            const feedData = data.domVideos || data.posts || data.feed;
            if (feedData && Array.isArray(feedData)) {
                renderDomVideos(feedData);
                renderNews(feedData);
                const pc = document.getElementById('cntPosts');
                if (pc) pc.innerText = feedData.length;
            }
        }

        const payload = data.profile || data.galleryData || data.pendingState ? data : (data.type === "UPDATE_FULL_DATA" ? data : null);
        
        if (payload) {
            if (data.profile && !ignoreBackendUpdates) {
                setGameStats(data.profile);
                setUserProfile({
                    name: data.profile.name || "Slave",
                    hierarchy: data.profile.hierarchy || "HallBoy",
                    memberId: data.profile.memberId || "",
                    joined: data.profile.joined,
                    profilePicture: data.profile.profilePicture, // <--- ADD THIS LINE
                    routine: data.profile.routine,
                    kneelHistory: data.profile.kneelHistory
                    
                });
                
                if (data.profile.taskQueue) setTaskQueue(data.profile.taskQueue);
                
                if (data.profile.activeRevealMap) {
                    let map = [];
                    try { map = (typeof data.profile.activeRevealMap === 'string') ? JSON.parse(data.profile.activeRevealMap) : data.profile.activeRevealMap; } catch(e) { map = []; }
                    setActiveRevealMap(map);
                }
                
                if (data.profile.rewardVault) {
                    let vault = [];
                    try { vault = (typeof data.profile.rewardVault === 'string') ? JSON.parse(data.profile.rewardVault) : data.profile.rewardVault; } catch(e) { vault = []; }
                    setVaultItems(vault);
                }

                setLibraryProgressIndex(data.profile.libraryProgressIndex || 1);
                setCurrentLibraryMedia(data.profile.currentLibraryMedia || "");

                renderRewardGrid();
                if (data.profile.lastWorship) setLastWorshipTime(new Date(data.profile.lastWorship).getTime());
                setStats(migrateGameStatsToStats(data.profile, stats));
                // *** DIRECT IMAGE SYNC (DESKTOP + MOBILE) ***
                if(data.profile.profilePicture) {
                    const rawUrl = data.profile.profilePicture;
                    
                    // 1. Update Desktop (Existing Logic)
                    const picEl = document.getElementById('profilePic');
                    if(picEl) picEl.src = getOptimizedUrl(rawUrl, 150);
        
                    // 2. Update Mobile (Direct Injection)
                    const mobPic = document.getElementById('mob_profilePic'); // Hexagon
                    const mobBg = document.getElementById('mob_bgPic');       // Background
                    
                    // Decode Wix URL if needed
                    let finalUrl = rawUrl;
                    if (rawUrl.startsWith("wix:image")) {
                        const uri = rawUrl.split('/')[3].split('#')[0];
                        finalUrl = `https://static.wixstatic.com/media/${uri}`;
                    }
        
                    if(mobPic) mobPic.src = finalUrl;
                    if(mobBg) mobBg.src = finalUrl;
                    
                    // 3. Force Save to Memory (Safe Way)
                    if(typeof userProfile !== 'undefined') {
                        userProfile.profilePicture = rawUrl;
                    }
                }
                updateStats(); 
            }

            if (data.type === "INSTANT_REVEAL_SYNC") {
                if (data.currentLibraryMedia) setCurrentLibraryMedia(data.currentLibraryMedia);
                renderRewardGrid(); 
                setTimeout(() => {
                    const winnerId = data.activeRevealMap[data.activeRevealMap.length - 1];
                    runTargetingAnimation(winnerId, () => {
                        setActiveRevealMap(data.activeRevealMap || []);
                        renderRewardGrid(); 
                    });
                }, 50); 
            }

            if (payload.galleryData) {
                const currentGalleryJson = JSON.stringify(payload.galleryData);
                if (currentGalleryJson !== lastGalleryJson) {
                    setLastGalleryJson(currentGalleryJson);
                    setGalleryData(payload.galleryData);
                    renderGallery();
                    updateStats();
                }
            }

            if (payload.pendingState !== undefined) {
                if (!taskJustFinished && !ignoreBackendUpdates) {
                    setPendingTaskState(payload.pendingState);
                    if (pendingTaskState) {
                        setCurrentTask(pendingTaskState.task);
                        restorePendingUI();
                        window.updateTaskUIState(true);
                    } else if (!resetUiTimer) {
                        window.updateTaskUIState(false);
                        const rt = document.getElementById('readyText');
                        if(rt) rt.innerText = "AWAITING ORDERS";
                    }
                }
            }
        }

        if (data.type === "UPDATE_CHAT" || data.chatHistory) renderChat(data.chatHistory || data.messages);

        if (data.type === "FRAGMENT_REVEALED") {
            const { fragmentNumber, isComplete } = data;
            import('../profile/kneeling/reward.js').then(({ runTargetingAnimation, renderRewardGrid }) => {
                runTargetingAnimation(fragmentNumber, () => {
                    renderRewardGrid();
                    if (isComplete) triggerSound('coinSound');
                });
            });
        }
    } catch(err) { console.error("Main error:", err); }
});

// --- EXPORTS & HELPERS ---
window.handleUploadStart = function(inputElement) {
    if (inputElement.files && inputElement.files.length > 0) {
        const btn = document.getElementById('btnUpload');
        if (btn) { btn.innerHTML = '...'; btn.style.background = '#333'; btn.style.color = '#ffd700'; btn.style.cursor = 'wait'; }
        if (typeof handleEvidenceUpload === 'function') handleEvidenceUpload(inputElement);
    }
};

window.switchTab = switchTab;
window.toggleStats = toggleStats;
window.openSessionUI = openSessionUI;
window.closeSessionUI = closeSessionUI;
window.updateSessionCost = updateSessionCost;
window.submitSessionRequest = submitSessionRequest;
window.sendChatMessage = sendChatMessage;
window.handleChatKey = handleChatKey;
window.loadMoreChat = loadMoreChat;
window.openChatPreview = openChatPreview;
window.closeChatPreview = closeChatPreview;
window.breakGlass = breakGlass;
window.openHistoryModal = openHistoryModal;
window.openModal = openModal;
window.closeModal = closeModal;
window.toggleHistoryView = toggleHistoryView;
window.loadMoreHistory = loadMoreHistory;
window.handleHoldStart = handleHoldStart;
window.handleHoldEnd = handleHoldEnd;
window.claimKneelReward = claimKneelReward;
window.updateKneelingStatus = updateKneelingStatus;
window.toggleTributeHunt = toggleTributeHunt;
window.selectTributeReason = selectTributeReason;
window.setTributeNote = setTributeNote;
window.filterByBudget = filterByBudget;
window.showTributeStep = showTributeStep;
window.toggleHuntNote = toggleHuntNote;
window.finalizeSacrifice = finalizeSacrifice;
window.resetTributeFlow = resetTributeFlow;
window.buyRealCoins = buyRealCoins;
window.getRandomTask = getRandomTask;
window.cancelPendingTask = cancelPendingTask;
window.handleEvidenceUpload = handleEvidenceUpload;
window.handleProfileUpload = handleProfileUpload;
window.handleAdminUpload = handleAdminUpload;
window.WISHLIST_ITEMS = WISHLIST_ITEMS;
window.gameStats = gameStats;

function updateStats() {
    // 1. DESKTOP UPDATE (Original Logic - Keep safe)
    const subName = document.getElementById('subName');
    const subHierarchy = document.getElementById('subHierarchy');
    const coinsEl = document.getElementById('coins');
    const pointsEl = document.getElementById('points');

    if (!subName || !userProfile || !gameStats) return; 

    // Update Desktop Elements
    subName.textContent = userProfile.name || "Slave";
    if (subHierarchy) subHierarchy.textContent = userProfile.hierarchy || "HallBoy";
    if (coinsEl) coinsEl.textContent = gameStats.coins ?? 0;
    if (pointsEl) pointsEl.textContent = gameStats.points ?? 0;

    // 2. MOBILE UPDATE (The New Connection)
    // Header Identity
    const mobName = document.getElementById('mob_slaveName');
    const mobRank = document.getElementById('mob_rankStamp');
    const mobPic = document.getElementById('mob_profilePic');
    
    // Header Stats (Visible)
    const mobPoints = document.getElementById('mobPoints');
    const mobCoins = document.getElementById('mobCoins');

    // Drawer Stats (Hidden)
    const mobStreak = document.getElementById('mobStreak');
    const mobTotal = document.getElementById('mobTotal');
    const mobKneels = document.getElementById('mobKneels');

    // FILL DATA
    if (mobName) mobName.innerText = userProfile.name || "SLAVE";
    if (mobRank) mobRank.innerText = userProfile.hierarchy || "INITIATE";
    
    // Merit & Net
    if (mobPoints) mobPoints.innerText = gameStats.points || 0;
    if (mobCoins) mobCoins.innerText = gameStats.coins || 0;

    // Drawer Data
    if (mobStreak) mobStreak.innerText = gameStats.taskdom_streak || 0;
    if (mobTotal) mobTotal.innerText = gameStats.taskdom_total_tasks || 0;
    if (mobKneels) mobKneels.innerText = gameStats.kneelCount || 0;

    // Profile Picture Logic (Wix Fix)
    if (mobPic && userProfile.profilePicture) {
        let rawUrl = userProfile.profilePicture;
        if (rawUrl.startsWith("wix:image")) {
            const uri = rawUrl.split('/')[3].split('#')[0];
            mobPic.src = `https://static.wixstatic.com/media/${uri}`;
        } else {
            mobPic.src = rawUrl;
        }
    }

// --- GRID SYNC (TRUST THE BACKEND) ---
    const grid = document.getElementById('mob_streakGrid');
    if(grid) {
        grid.innerHTML = '';
        let loggedHours = [];
        const now = new Date();

        if (userProfile.kneelHistory) {
            try {
                const hObj = JSON.parse(userProfile.kneelHistory);
                
                // FIX: Trust the backend data. 
                // The backend already resets this at midnight.
                // We do not check the date here to avoid Timezone bugs.
                loggedHours = hObj.hours || [];
                
            } catch(e) { console.error("Grid parse error", e); }
        }

        for(let i=0; i<24; i++) {
            const sq = document.createElement('div');
            sq.className = 'streak-sq';
            
            // 1. Is this hour logged? (Gold)
            if (loggedHours.includes(i)) {
                sq.classList.add('active');
            }
            // 2. Has this hour passed? (Dim/Dark)
            else if (i < now.getHours()) {
                sq.style.opacity = "0.3"; 
                sq.style.borderColor = "#333";
            }
            // 3. Future hours are normal style
            
            grid.appendChild(sq);
        }
    }

    // 4. DESKTOP EXTRAS (Progress Bar etc)
    const sinceEl = document.getElementById('slaveSinceDate');
    if (sinceEl && userProfile.joined) {
         try { sinceEl.textContent = new Date(userProfile.joined).toLocaleDateString(); } catch(e) { sinceEl.textContent = "--/--/--"; }
    }

    if (typeof LEVELS !== 'undefined' && LEVELS.length > 0) {
        let nextLevel = LEVELS.find(l => l.min > gameStats.points) || LEVELS[LEVELS.length - 1];
        const nln = document.getElementById('nextLevelName');
        const pnd = document.getElementById('pointsNeeded');
        
        if(nln) nln.innerText = nextLevel.name;
        if(pnd) pnd.innerText = Math.max(0, nextLevel.min - gameStats.points) + " to go";
        
        const pb = document.getElementById('progressBar');
        const progress = ((gameStats.points - 0) / (nextLevel.min - 0)) * 100;
        if (pb) pb.style.width = Math.min(100, Math.max(0, progress)) + "%";
    }
    
    updateKneelingStatus();
}

// =========================================
// PART 3: TRIBUTE & BACKEND FUNCTIONS (RESTORED)
// =========================================

let currentHuntIndex = 0, filteredItems = [], selectedReason = "", selectedNote = "", selectedItem = null;
function toggleTributeHunt() { const overlay = document.getElementById('tributeHuntOverlay'); if (overlay.classList.contains('hidden')) { selectedReason = ""; selectedItem = null; if(document.getElementById('huntNote')) document.getElementById('huntNote').value = ""; overlay.classList.remove('hidden'); showTributeStep(1); } else { overlay.classList.add('hidden'); resetTributeFlow(); } }
function showTributeStep(step) { document.querySelectorAll('.tribute-step').forEach(el => el.classList.add('hidden')); const target = document.getElementById('tributeStep' + step); if (target) target.classList.remove('hidden'); const progressEl = document.getElementById('huntProgress'); if (progressEl) progressEl.innerText = ["", "INTENTION", "THE HUNT", "CONFESSION"][step] || ""; }
function selectTributeReason(reason) { selectedReason = reason; renderHuntStore(gameStats.coins); showTributeStep(2); }
function setTributeNote(note) { showTributeStep(3); }
function filterByBudget(max) { renderHuntStore(max); showTributeStep(3); }
function renderHuntStore(budget) { const grid = document.getElementById('huntStoreGrid'); if (!grid) return; filteredItems = (window.WISHLIST_ITEMS || []).filter(item => Number(item.price || item.Price || 0) <= budget); currentHuntIndex = 0; if (filteredItems.length === 0) { grid.innerHTML = '<div style="color:#666; text-align:center; padding:40px;">NO TRIBUTES IN THIS TIER...</div>'; return; } showTinderCard(); }
function showTinderCard() { const grid = document.getElementById('huntStoreGrid'); const item = filteredItems[currentHuntIndex]; if (!item) { grid.innerHTML = `<div style="text-align:center; padding:40px;"><div style="font-size:2rem; margin-bottom:10px;">💨</div><div style="color:#666; font-size:0.7rem;">NO MORE ITEMS IN THIS TIER</div><button class="tab-btn" onclick="showTributeStep(2)" style="margin-top:15px; width:auto; padding:5px 15px;">CHANGE BUDGET</button></div>`; return; } grid.style.perspective = "1000px"; grid.innerHTML = `<div id="tinderCard" class="tinder-card-main"><div id="likeLabel" class="swipe-indicator like">SACRIFICE</div><div id="nopeLabel" class="swipe-indicator nope">SKIP</div><img src="${item.img || item.image}" draggable="false"><div class="tinder-card-info"><div style="color:var(--neon-yellow); font-size:1.8rem; font-weight:900;">${item.price} 🪙</div><div style="color:white; letter-spacing:2px; font-weight:bold; font-size:0.8rem;">${item.name.toUpperCase()}</div></div></div>`; initSwipeEvents(document.getElementById('tinderCard'), item); }
function initSwipeEvents(card, item) { let startX = 0; let currentX = 0; const handleStart = (e) => { startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX; card.style.transition = 'none'; }; const handleMove = (e) => { if (!startX) return; currentX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX; const diff = currentX - startX; card.style.transform = `translateX(${diff}px) rotate(${diff / 15}deg)`; const likeLabel = document.getElementById('likeLabel'); const nopeLabel = document.getElementById('nopeLabel'); if(likeLabel) likeLabel.style.opacity = diff > 0 ? (diff / 100) : 0; if(nopeLabel) nopeLabel.style.opacity = diff < 0 ? (Math.abs(diff) / 100) : 0; }; const handleEnd = () => { const diff = currentX - startX; card.style.transition = 'transform 0.4s ease, opacity 0.4s ease'; if (diff > 120) { card.style.transform = `translateX(600px) rotate(45deg)`; selectedItem = item; if(document.getElementById('huntSelectedImg')) document.getElementById('huntSelectedImg').src = item.img || item.image; if(document.getElementById('huntSelectedName')) document.getElementById('huntSelectedName').innerText = item.name.toUpperCase(); if(document.getElementById('huntSelectedPrice')) document.getElementById('huntSelectedPrice').innerText = item.price + " 🪙"; setTimeout(() => { showTributeStep(4); }, 200); } else if (diff < -120) { card.style.transform = `translateX(-600px) rotate(-45deg)`; card.style.opacity = "0"; currentHuntIndex++; setTimeout(() => { showTinderCard(); }, 300); } else { card.style.transform = `translateX(0) rotate(0)`; if(document.getElementById('likeLabel')) document.getElementById('likeLabel').style.opacity = 0; if(document.getElementById('nopeLabel')) document.getElementById('nopeLabel').style.opacity = 0; } startX = 0; }; card.addEventListener('mousedown', handleStart); card.addEventListener('touchstart', handleStart); window.addEventListener('mousemove', handleMove); window.addEventListener('touchmove', handleMove); window.addEventListener('mouseup', handleEnd); window.addEventListener('touchend', handleEnd); }
function toggleHuntNote(show) { const container = document.getElementById('huntNoteContainer'); const btn = document.getElementById('btnShowNote'); if (!container || !btn) return; if (show) { container.classList.remove('hidden'); btn.classList.add('hidden'); document.getElementById('huntNote').focus(); } else { container.classList.add('hidden'); btn.classList.remove('hidden'); } }
function finalizeSacrifice() { 
    const noteEl = document.getElementById('huntNote'); 
    const note = noteEl ? noteEl.value.trim() : ""; 
    
    if (!selectedItem || !selectedReason) return; 
    
    // *** THE FIX: USE POVERTY SYSTEM INSTEAD OF ALERT ***
    if (gameStats.coins < selectedItem.price) { 
        triggerSound('sfx-deny'); 
        window.triggerPoverty(); 
        return; 
    } 
    
    const tributeMessage = `💝 TRIBUTE: ${selectedReason}\n🎁 ITEM: ${selectedItem.name}\n💰 COST: ${selectedItem.price}\n💌 "${note || "A silent tribute."}"`; 
    
    window.parent.postMessage({ 
        type: "PURCHASE_ITEM", 
        itemName: selectedItem.name, 
        cost: selectedItem.price, 
        messageToDom: tributeMessage 
    }, "*"); 
    
    triggerSound('sfx-buy'); 
    triggerCoinShower(); 
    toggleTributeHunt(); 
}
function buyRealCoins(amount) { triggerSound('sfx-buy'); window.parent.postMessage({ type: "INITIATE_STRIPE_PAYMENT", amount: amount }, "*"); }
function triggerCoinShower() { for (let i = 0; i < 40; i++) { const coin = document.createElement('div'); coin.className = 'coin-particle'; coin.innerHTML = `<svg style="width:100%; height:100%; fill:gold;"><use href="#icon-coin"></use></svg>`; coin.style.setProperty('--tx', `${Math.random() * 200 - 100}vw`); coin.style.setProperty('--ty', `${-(Math.random() * 80 + 20)}vh`); document.body.appendChild(coin); setTimeout(() => coin.remove(), 2000); } }
function breakGlass(e) { if (e && e.stopPropagation) e.stopPropagation(); const overlay = document.getElementById('specialGlassOverlay'); if (overlay) overlay.classList.remove('active'); window.parent.postMessage({ type: "GLASS_BROKEN" }, "*"); }
function submitSessionRequest() { const checked = document.querySelector('input[name="sessionType"]:checked'); if (!checked) return; window.parent.postMessage({ type: "SESSION_REQUEST", sessionType: checked.value, cost: checked.getAttribute('data-cost') }, "*"); }
function resetTributeFlow() { selectedReason = ""; selectedNote = ""; selectedItem = null; const note = document.getElementById('huntNote'); if (note) note.value = ""; showTributeStep(1); }

// =========================================
// PART 1: MOBILE LOGIC (BRAIN & NAVIGATION)
// =========================================

// 5. STATS EXPANDER (SIMPLE TOGGLE)
window.toggleMobileStats = function() {
    const drawer = document.getElementById('mobStatsContent');
    const arrow = document.getElementById('mobStatsArrow');
    
    if(drawer) {
        // Toggle the class that handles the animation (CSS)
        drawer.classList.toggle('open');
        
        // Rotate Arrow
        if(arrow) {
            arrow.innerText = drawer.classList.contains('open') ? "▲" : "▼";
        }
    }
};

// 3. MAIN NAVIGATION CONTROLLER (FINAL SAFE VERSION)
window.toggleMobileView = function(viewName) {
    // --- 1. CLEANUP (Reset Overlays - KEPT SAFE) ---
    if (window.closeLobby) window.closeLobby();
    if (window.closeQueenMenu) window.closeQueenMenu(); // Added Queen Menu closing too
    if (window.closePoverty) window.closePoverty();

    // --- 2. DEFINE VIEWS ---
    const home = document.getElementById('viewMobileHome');
    
    // Mobile Specific Views (The new ones)
    const mobRecord = document.getElementById('viewMobileRecord');
    const mobGlobal = document.getElementById('viewMobileGlobal'); // <--- UPDATED ID
    
    // Desktop/Shared Views
    const chatCard = document.getElementById('chatCard');
    const mobileApp = document.getElementById('MOBILE_APP');
    const history = document.getElementById('historySection');
    const news = document.getElementById('viewNews');
    const protocol = document.getElementById('viewProtocol');
    
    // --- 3. HIDE EVERYTHING ---
    const views = [home, mobRecord, mobGlobal, history, news, protocol];
    views.forEach(el => { if(el) el.style.display = 'none'; });

    // Reset Chat Visibility
    if (chatCard) chatCard.style.setProperty('display', 'none', 'important');

    // --- 4. SHOW TARGET ---
    if (viewName === 'home') {
        if(home) {
            home.style.display = 'flex';
            if(window.syncMobileDashboard) window.syncMobileDashboard();
        }
    }
    else if (viewName === 'chat') {
        if(chatCard && mobileApp) {
            // Teleport logic
            if (chatCard.parentElement !== mobileApp) {
                mobileApp.appendChild(chatCard);
            }
            chatCard.style.removeProperty('display');
            chatCard.style.display = 'flex';
            
            const chatBox = document.getElementById('chatBox');
            if (chatBox) setTimeout(() => { chatBox.scrollTop = chatBox.scrollHeight; }, 100);
        }
    }
    else if (viewName === 'record') {
        // Open Mobile Vault
        if (mobRecord) {
            mobRecord.style.display = 'flex';
            if(window.renderGallery) window.renderGallery();
        }
    }
    else if (viewName === 'queen') {
        if(news) news.style.display = 'block';
    }
    else if (viewName === 'global') {
        // Open Mobile Global (Exchequer/Protocol)
        if(mobGlobal) {
            mobGlobal.style.display = 'flex';
        }
    }
    
    // --- 5. SIDEBAR CLEANUP ---
    const sidebar = document.querySelector('.layout-left');
    if (sidebar) sidebar.classList.remove('mobile-open');
    document.querySelectorAll('.mf-btn').forEach(btn => btn.classList.remove('active'));
};

// QUEEN'S MENU NAVIGATION
window.openQueenMenu = function() {
    const menu = document.getElementById('queenOverlay');
    if (menu) {
        menu.classList.remove('hidden');
        menu.style.display = 'flex';
        // Force a data refresh so the progress bar updates
        if(window.syncMobileDashboard) window.syncMobileDashboard();
    }
};

window.closeQueenMenu = function() {
    const menu = document.getElementById('queenOverlay');
    if (menu) {
        menu.classList.add('hidden');
        menu.style.display = 'none';
    }
};
// 3. KNEEL BUTTON
window.triggerKneel = function() {
    const sidebar = document.querySelector('.layout-left');
    const realBtn = document.querySelector('.kneel-bar-graphic');
    
    if (sidebar) sidebar.classList.add('mobile-open'); 

    if (realBtn) {
        realBtn.style.boxShadow = "0 0 20px var(--neon-red)";
        setTimeout(() => realBtn.style.boxShadow = "", 1000);
    }
};

window.syncMobileDashboard = function() {
    if (!gameStats || !userProfile) return;

    // --- HEADER DATA ---
    const dateEl = document.getElementById('dutyDateDisplay');
    if(dateEl) dateEl.innerText = new Date().toLocaleDateString().toUpperCase();

    // --- 1. PROTOCOL ---
    // If we fixed the CMS issue, this will now work:
    const routineName = userProfile.routine || "NO PROTOCOL"; 
    const rDisplay = document.getElementById('mobRoutineDisplay');
    if(rDisplay) rDisplay.innerText = routineName.toUpperCase();

    // Status Check
    const nowHour = new Date().getHours();
    const isMorning = nowHour >= 7; 
    const isDone = gameStats.routineDoneToday === true; // Requires simple memory flag

    const btnUpload = document.getElementById('btnRoutineUpload');
    const msgTime = document.getElementById('routineTimeMsg');
    const msgDone = document.getElementById('routineDoneMsg');

    if (isDone) {
        if(btnUpload) btnUpload.classList.add('hidden');
        if(msgTime) msgTime.classList.add('hidden');
        if(msgDone) msgDone.classList.remove('hidden');
    } else if (isMorning) {
        if(btnUpload) btnUpload.classList.remove('hidden');
        if(msgTime) msgTime.classList.add('hidden');
        if(msgDone) msgDone.classList.add('hidden');
    } else {
        if(btnUpload) btnUpload.classList.add('hidden');
        if(msgTime) msgTime.classList.remove('hidden');
        if(msgDone) msgDone.classList.add('hidden');
    }

     // --- 2. LABOR ---
    const activeRow = document.getElementById('activeTimerRow'); // Desktop source
    const isWorking = activeRow && !activeRow.classList.contains('hidden');
    
    const taskIdle = document.getElementById('qm_TaskIdle');
    const taskActive = document.getElementById('qm_TaskActive');
    
    // NEW: Get Task Text
    const mobTaskText = document.getElementById('mobTaskText');

    if (isWorking) {
        if(taskIdle) taskIdle.classList.add('hidden');
        if(taskActive) taskActive.classList.remove('hidden');

        // *** INJECT TASK TEXT ***
        // We use the same source as the desktop (currentTask global var)
        if (mobTaskText && typeof currentTask !== 'undefined' && currentTask) {
            mobTaskText.innerText = currentTask.instruction || currentTask.text || "AWAITING ORDERS";
        } else if (mobTaskText) {
            // Fallback if currentTask isn't ready yet, try reading desktop text
            const desktopText = document.getElementById('readyText');
            mobTaskText.innerText = desktopText ? desktopText.innerText : "PROCESSING...";
        }

    } else {
        if(taskIdle) taskIdle.classList.remove('hidden');
        if(taskActive) taskActive.classList.add('hidden');
    }

window.handleRoutineUpload = function(input) {
    if(input.files.length > 0) {
        // 1. Send to backend
        window.handleEvidenceUpload(input); 
        
        // 2. Mark as done locally for immediate UI update
        gameStats.routineDoneToday = true; 
        
        // 3. Refresh UI
        window.syncMobileDashboard();
    }
}
};

// ==========================
// EXCHEQUER LOGIC (MOBILE)
// ==========================

window.openExchequer = function() {
    const store = document.getElementById('mobExchequer');
    if (store) {
        store.classList.remove('hidden');
        store.style.display = 'flex'; // Force visible
    } else {
        console.error("Exchequer Overlay not found!");
    }
};

window.closeExchequer = function() {
    const store = document.getElementById('mobExchequer');
    if (store) {
        store.classList.add('hidden');
        store.style.display = 'none';
    }
};
// =========================================
// PART 2: FINAL APP MODE (NATIVE FLOW)
// =========================================

(function() {
    // Only run on Mobile
    if (window.innerWidth > 768) return;

    // 1. LOCK THE FRAME, BUT LET THE CONTENT BREATHE
    function lockVisuals() {
        const height = window.innerHeight;
        
        Object.assign(document.body.style, {
            height: height + 'px',
            width: '100%',
            position: 'fixed',
            overflow: 'hidden',
            inset: '0',
            overscrollBehavior: 'none',
            touchAction: 'none'
        });

        const app = document.querySelector('.app-container');
        if (app) Object.assign(app.style, { height: '100%', overflow: 'hidden' });

        const scrollables = document.querySelectorAll('.content-stage, .chat-body-frame, #viewMobileHome, #historySection, #viewNews');
        scrollables.forEach(el => {
            Object.assign(el.style, {
                height: '100%',
                overflowY: 'auto',              
                webkitOverflowScrolling: 'touch', 
                paddingBottom: '100px',
                overscrollBehaviorY: 'contain',
                touchAction: 'pan-y'
            });
        });
    }

// 2. BUILD FOOTER (FULL WIDTH 5-SLOT)
    function buildAppFooter() {
        if (document.getElementById('app-mode-footer')) return;
        
        const footer = document.createElement('div');
        footer.id = 'app-mode-footer';
        
        Object.assign(footer.style, {
            display: 'flex', 
            justifyContent: 'space-around', // Equal spacing
            alignItems: 'center',
            
            // FULL WIDTH STYLE
            position: 'fixed', 
            bottom: '0', 
            left: '0', 
            width: '100%', 
            height: '60px',
            
            background: 'linear-gradient(to top, #000 40%, rgba(0,0,0,0.95))',
            paddingBottom: 'env(safe-area-inset-bottom)',
            zIndex: '2147483647', 
            borderTop: '1px solid rgba(197, 160, 89, 0.3)', // Gold Border
            backdropFilter: 'blur(10px)', 
            pointerEvents: 'auto', 
            touchAction: 'none'
        });

        footer.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

        // STANDARD BUTTON STYLE (Width = 20% because 100% / 5 buttons)
        const btnStyle = "background:none; border:none; color:#666; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; font-family:'Cinzel',serif; font-size:0.55rem; width:20%; height:100%; cursor:pointer;";
        
        // ACTIVE/HIGHLIGHT STYLE (For the Middle Chat Button)
        const chatStyle = "background:none; border:none; color:#ff003c; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; font-family:'Cinzel',serif; font-size:0.55rem; width:20%; height:100%; cursor:pointer; text-shadow: 0 0 10px rgba(255,0,60,0.4);";

       footer.innerHTML = `
<button onclick="window.toggleMobileView('home')" style="${btnStyle}"><span style="font-size:1.4rem;color:#888;">◈</span><span>PROFILE</span></button>
<button onclick="window.toggleMobileView('record')" style="${btnStyle}"><span style="font-size:1.4rem;color:#888;">▦</span><span>RECORD</span></button>
<button onclick="window.toggleMobileView('chat')" style="${chatStyle};display:inline-flex;align-items:center;justify-content:center;padding:0;min-width:60px;">
<img src="https://static.wixstatic.com/media/ce3e5b_19faff471a434690b7a40aacf5bf42c4~mv2.png" alt="Avatar" style="width:68px;height:68px;border-radius:50%;object-fit:cover;border:1px solid #ff003c;display:block;">
</button>
<button onclick="window.toggleMobileView('queen')" style="${btnStyle}"><span style="font-size:1.4rem;color:#888;">♛</span><span>QUEEN</span></button>
<button onclick="window.toggleMobileView('global')" style="${btnStyle}">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
<span>GLOBAL</span></button>`;
document.body.appendChild(footer);
    }

    // 3. RUN
    window.addEventListener('load', () => { 
        lockVisuals(); 
        buildAppFooter();
        // FORCE HOME ON LOAD
        if(window.toggleMobileView) window.toggleMobileView('home'); 
    });
    window.addEventListener('resize', lockVisuals);
    lockVisuals(); buildAppFooter();
})();

window.mobileRequestTask = function() {
    // 1. THE GATEKEEPER: Check for 300 Coins
    // (If you have less than 300, she won't even talk to you)
    if (gameStats.coins < 300) {
        window.triggerPoverty(); // <--- SHOWS THE POVERTY OVERLAY
        
        if(window.triggerSound) triggerSound('sfx-deny');
        
        return; // <--- STOP! Do not switch view, do not get task.
    }

    // 2. IF YOU HAVE MONEY: Proceed with the fancy animation
    const taskIdle = document.getElementById('qm_TaskIdle');
    const taskActive = document.getElementById('qm_TaskActive');
    const txt = document.getElementById('mobTaskText');
    
    // Switch View
    if(taskIdle) taskIdle.classList.add('hidden');
    if(taskActive) taskActive.classList.remove('hidden');

    // Show "Connecting..."
    if(txt) {
        txt.innerHTML = "ESTABLISHING LINK...";
        txt.classList.add('text-pulse');
    }

    // 3. GET THE TASK
    setTimeout(() => {
        window.getRandomTask(); 
        
        setTimeout(() => {
            if(txt) txt.classList.remove('text-pulse');
            window.syncMobileDashboard(); 
        }, 800);
    }, 300);
};

window.mobileUploadEvidence = function(input) {
    if (input.files && input.files.length > 0) {
        
        // 1. Trigger the Backend Upload
        window.handleEvidenceUpload(input);

        // 2. UI FEEDBACK
        const btn = document.getElementById('mobBtnUpload');
        if(btn) btn.innerText = "SENDING...";

        // 3. SHOW SUCCESS & CLOSE TASK (After 1.5 seconds)
        setTimeout(() => {
            // Show Green Notification (Reuse your system notification)
            if(window.showSystemNotification) {
                window.showSystemNotification("EVIDENCE SENT", "STATUS: PENDING REVIEW");
            }
            
            // RESET UI TO "UNACTIVE"
            // We trick the system into thinking we are idle
            window.updateTaskUIState(false); 
            
            // Reset Button Text
            if(btn) btn.innerText = "UPLOAD";
            
            // Force Mobile Sync
            window.syncMobileDashboard();
        }, 1500);
    }
};

window.mobileSkipTask = function() {
    // 1. CHECK FUNDS (Strict Check)
    if (gameStats.coins < 300) {
        // Trigger the Fancy Overlay
        window.triggerPoverty(); 
        
        // STOP HERE - Do not run the old logic that shows the cheap alert
        return; 
    }

    // 2. IF RICH ENOUGH:
    gameStats.coins -= 300;
    if(window.updateStats) window.updateStats(); 
    if(window.triggerSound) triggerSound('sfx-deny');

    if(window.showSystemNotification) {
        window.showSystemNotification("PROTOCOL ABORTED", "PENALTY: -300 COINS");
    }

    if(window.cancelPendingTask) window.cancelPendingTask(); 
    
    window.updateTaskUIState(false);
    if(window.syncMobileDashboard) window.syncMobileDashboard();
};

// TIMER SYNC & VISUALIZATION
setInterval(() => {
    // 1. Get Source (Desktop Hidden Elements)
    const desktopH = document.getElementById('timerH');
    const desktopM = document.getElementById('timerM');
    const desktopS = document.getElementById('timerS');
    
    // 2. Mobile Dashboard Elements
    const mobileH = document.getElementById('m_timerH');
    const mobileM = document.getElementById('m_timerM');
    const mobileS = document.getElementById('m_timerS');

    // 3. Queen Menu Elements (NEW)
    const qmH = document.getElementById('qm_timerH');
    const qmM = document.getElementById('qm_timerM');
    const qmS = document.getElementById('qm_timerS');
    
    // 4. Update Values
    if (desktopH) {
        const hTxt = desktopH.innerText;
        const mTxt = desktopM.innerText;
        const sTxt = desktopS.innerText;

        // Update Dashboard
        if(mobileH) { mobileH.innerText = hTxt; mobileM.innerText = mTxt; mobileS.innerText = sTxt; }
        
        // Update Queen Menu Card
        if(qmH) { qmH.innerText = hTxt; qmM.innerText = mTxt; qmS.innerText = sTxt; }

        // Update Rings (Dashboard)
        const hVal = parseInt(hTxt) || 0;
        const mVal = parseInt(mTxt) || 0;
        const sVal = parseInt(sTxt) || 0;
        
        const ringH = document.getElementById('ring_H');
        const ringM = document.getElementById('ring_M');
        const ringS = document.getElementById('ring_S');
        
        if(ringH) ringH.style.background = `conic-gradient(#c5a059 ${(hVal/24)*360}deg, rgba(197, 160, 89, 0.1) 0deg)`;
        if(ringM) ringM.style.background = `conic-gradient(#c5a059 ${(mVal/60)*360}deg, rgba(197, 160, 89, 0.1) 0deg)`;
        if(ringS) ringS.style.background = `conic-gradient(#c5a059 ${(sVal/60)*360}deg, rgba(197, 160, 89, 0.1) 0deg)`;
    }

    // Sync Visibility Logic (Moved inside the same interval for efficiency)
    const activeRow = document.getElementById('activeTimerRow');
    const mobTimer = document.getElementById('mob_activeTimer');
    const mobRequestBtn = document.getElementById('mob_btnRequest');
    
    if (activeRow && mobTimer && mobRequestBtn) {
        const isWorking = !activeRow.classList.contains('hidden');
        if (isWorking) {
            mobTimer.classList.remove('hidden');
            mobRequestBtn.classList.add('hidden');
            const light = document.getElementById('mob_statusLight');
            const text = document.getElementById('mob_statusText');
            if(light) light.className = 'status-light green';
            if(text) text.innerText = "WORKING";
        } else {
            mobTimer.classList.add('hidden');
            mobRequestBtn.classList.remove('hidden');
            const light = document.getElementById('mob_statusLight');
            const text = document.getElementById('mob_statusText');
            if(light) light.className = 'status-light red';
            if(text) text.innerText = "UNPRODUCTIVE";
        }
    }
}, 500);

window.parent.postMessage({ type: "UI_READY" }, "*");
