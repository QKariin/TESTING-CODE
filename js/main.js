



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

const POVERTY_INSULTS = [
    "Your wallet is as empty as your worth.",
    "Do not waste my time with empty pockets.",
    "Silence is free. Serving me costs.",
    "Go beg for coins, then come back.",
    "You cannot afford to look at me.",
    "Access Denied. Reason: Poverty."
];

// ==========================
// REPLACE window.triggerPoverty WITH THIS JAILBREAK VERSION
// ==========================

window.triggerPoverty = function() {
    const overlay = document.getElementById('povertyOverlay');
    const text = document.getElementById('povertyInsult');
    
    // Pick random insult
    const insult = POVERTY_INSULTS[Math.floor(Math.random() * POVERTY_INSULTS.length)];
    if(text) text.innerText = `"${insult}"`;

    if(overlay) {
        // *** THE FIX: Move overlay to Body so it is never hidden by a parent view ***
        if (overlay.parentElement !== document.body) {
            document.body.appendChild(overlay);
        }

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

// ==========================
// REPLACE WINDOW.GOTOEXCHEQUER (Around Line 56) WITH THIS:
// ==========================

window.goToExchequer = function() {
    // 1. Close any blocking overlays (Poverty, Queen Menu)
    window.closePoverty();
    if(window.closeQueenMenu) window.closeQueenMenu();

    // 2. Switch to the Global View (Mobile) instead of 'buy' (Desktop)
    // This prevents the "Black Screen" crash
    if(window.toggleMobileView) window.toggleMobileView('global');

    // 3. Force open the Store Overlay immediately after switching views
    setTimeout(() => {
        if(window.openExchequer) window.openExchequer();
    }, 200);
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
    // 1. DESKTOP UPDATE (Basic Header)
    const subName = document.getElementById('subName');
    const subHierarchy = document.getElementById('subHierarchy');
    const coinsEl = document.getElementById('coins');
    const pointsEl = document.getElementById('points');

    if (!subName || !userProfile || !gameStats) return; 

    // Update Basic Desktop Elements
    subName.textContent = userProfile.name || "Slave";
    if (subHierarchy) subHierarchy.textContent = userProfile.hierarchy || "HallBoy";
    if (coinsEl) coinsEl.textContent = gameStats.coins ?? 0;
    if (pointsEl) pointsEl.textContent = gameStats.points ?? 0;

    // --- CONNECT DESKTOP EXPANDED STATS ---
    if (document.getElementById('statStreak')) document.getElementById('statStreak').innerText = gameStats.taskdom_streak || 0;
    if (document.getElementById('statTotal')) document.getElementById('statTotal').innerText = gameStats.taskdom_total_tasks || 0;
    if (document.getElementById('statCompleted')) document.getElementById('statCompleted').innerText = gameStats.taskdom_completed || 0;
    if (document.getElementById('statSkipped')) document.getElementById('statSkipped').innerText = gameStats.taskdom_skipped || 0;
    if (document.getElementById('statTotalKneels')) document.getElementById('statTotalKneels').innerText = gameStats.kneelCount || 0;

    if (window.renderRewards) window.renderRewards();


    // 2. MOBILE UPDATE (The New Connection)
    // Header Identity
    const mobName = document.getElementById('mob_slaveName');
    const mobRank = document.getElementById('mob_rankStamp');
    const mobPic = document.getElementById('mob_profilePic'); // Center Hexagon
    
    // Header Stats (Visible)
    const mobPoints = document.getElementById('mobPoints');
    const mobCoins = document.getElementById('mobCoins');

    // Drawer Stats (Hidden)
    const mobStreak = document.getElementById('mobStreak');
    const mobTotal = document.getElementById('mobTotal');
    const mobKneels = document.getElementById('mobKneels');

    // Daily duties
    const mobDailyKneels = document.getElementById('kneelDailyText');
    const kneelDailyFill = document.getElementById("kneelDailyFill");

    // FILL MOBILE TEXT DATA
    if (mobName) mobName.innerText = userProfile.name || "SLAVE";
    if (mobRank) mobRank.innerText = userProfile.hierarchy || "INITIATE";
    
    if (mobPoints) mobPoints.innerText = gameStats.points || 0;
    if (mobCoins) mobCoins.innerText = gameStats.coins || 0;

    if (mobStreak) mobStreak.innerText = gameStats.taskdom_streak || 0;
    if (mobTotal) mobTotal.innerText = gameStats.taskdom_total_tasks || 0;
    if (mobKneels) mobKneels.innerText = gameStats.kneelCount || 0;

    // Daily Duties Logic
    const dailyKneels = (gameStats.kneelHistory ? JSON.parse(gameStats.kneelHistory).hours?.length || 0 : 0);
    if (mobDailyKneels) mobDailyKneels.innerText = dailyKneels  + " / 8";

    if (kneelDailyFill) {
        const percent = Math.min((dailyKneels / 8) * 100, 100);
        kneelDailyFill.style.width = percent + "%";
    }
    
    // --- [FIX] PROFILE PICTURE LOGIC (SYNC ALL 3 IMAGES) ---
    if (userProfile.profilePicture) {
        let rawUrl = userProfile.profilePicture;
        let finalUrl = rawUrl;

        // Fix Wix URLs
        if (rawUrl.startsWith("wix:image")) {
            const uri = rawUrl.split('/')[3].split('#')[0];
            finalUrl = `https://static.wixstatic.com/media/${uri}`;
        }

        // 1. Update the Big Hexagon (Dashboard Center)
        if (mobPic) mobPic.src = finalUrl;
        
        // 2. Update the Background Blur
        const mobBg = document.getElementById('mob_bgPic');
        if (mobBg) mobBg.src = finalUrl;

        // 3. Update the Right Circle (Slave ID)
        const rightCircle = document.getElementById('hudSlavePic');
        if (rightCircle) rightCircle.src = finalUrl;

        // 4. Update Desktop Avatar (Just in case)
        const deskPic = document.getElementById('profilePic');
        if (deskPic) deskPic.src = finalUrl;
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
// REWARD SYSTEM CONFIG & RENDER
// =========================================
// =========================================
// LUXURY REWARD SYSTEM (SVG + SHAPES)
// =========================================

// SVG PATHS (Simplified for performance)
const ICONS = {
    rank: "M12 2l-10 9h20l-10-9zm0 5l6 5.5h-12l6-5.5z M12 14l-8 7h16l-8-7z", // Chevron Stack
    task: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-5-5 1.41-1.41L11 14.17l7.59-7.59L20 8l-9 9z", // Check Circle
    kneel: "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z", // Clock/Time
    spend: "M12,2L2,12L12,22L22,12L12,2Z M12,18L6,12L12,6L18,12L12,18Z" // Diamond Gem
};

const REWARD_DATA = {
    ranks: [
        { name: "INITIATE", icon: ICONS.rank },
        { name: "FOOTMAN", icon: ICONS.rank },
        { name: "SILVERMAN", icon: ICONS.rank },
        { name: "BUTLER", icon: ICONS.rank },
        { name: "CHAMBERLAIN", icon: ICONS.rank },
        { name: "SECRETARY", icon: ICONS.rank },
        { name: "CHAMPION", icon: ICONS.rank }
    ],
    tasks: [
        { limit: 10, name: "LABORER", icon: ICONS.task },
        { limit: 50, name: "TOOL", icon: ICONS.task },
        { limit: 100, name: "DRONE", icon: ICONS.task },
        { limit: 500, name: "MACHINE", icon: ICONS.task },
        { limit: 1000, name: "ARCHITECT", icon: ICONS.task }
    ],
    kneeling: [
        { limit: 10, name: "BENT", icon: ICONS.kneel },
        { limit: 50, name: "SORE", icon: ICONS.kneel },
        { limit: 100, name: "TRAINED", icon: ICONS.kneel },
        { limit: 500, name: "FURNITURE", icon: ICONS.kneel },
        { limit: 1000, name: "STATUE", icon: ICONS.kneel }
    ],
    spending: [
        { limit: 1000, name: "TITHE", icon: ICONS.spend },
        { limit: 10000, name: "SUPPORTER", icon: ICONS.spend },
        { limit: 50000, name: "PATRON", icon: ICONS.spend },
        { limit: 100000, name: "FINANCIER", icon: ICONS.spend },
        { limit: 500000, name: "WHALE", icon: ICONS.spend }
    ]
};

window.renderRewards = function() {
    if (!window.gameStats) return;

    // 1. GET DATA
    const currentRank = window.userProfile?.hierarchy || "Hall Boy";
    const totalTasks = window.gameStats.taskdom_completed || 0;
    const totalKneels = window.gameStats.kneelCount || 0;
    const totalSpent = window.gameStats.total_coins_spent || 0; 

    // HELPER: BUILD SHELF
    // shapeClass = 'shape-hex', 'shape-circle', etc.
    // UPDATED HELPER: BUILD SHELF WITH CLICK HANDLER
    const buildShelf = (containerId, data, shapeClass, checkFn, currentVal, typeLabel) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = data.map((item, index) => {
            // Determine Target Value
            // For Ranks, target is simply the index (0, 1, 2). Current is User's Rank Index.
            // For others, item.limit is the target.
            const targetVal = (typeLabel === 'rank') ? index : item.limit;
            
            // Logic for Ranks is slightly different (Current >= Target Index)
            const isUnlocked = (typeLabel === 'rank') 
                ? (currentVal >= index) 
                : (currentVal >= targetVal);

            const statusClass = isUnlocked ? "unlocked" : "locked";
            const isLegendary = index === data.length - 1 ? "legendary" : "";
            
            // Generate Click Handler
            // We pass the raw data to the opener function
            // Note: For Ranks, we visualize '1/1' if unlocked, '0/1' if locked for simplicity
            const displayCurrent = (typeLabel === 'rank') ? (isUnlocked ? 1 : 0) : currentVal;
            const displayTarget = (typeLabel === 'rank') ? 1 : targetVal;

            return `
                <div class="reward-badge ${shapeClass} ${statusClass} ${isLegendary}" 
                     onclick="window.openRewardCard('${item.name}', '${item.icon}', ${displayCurrent}, ${displayTarget}, '${typeLabel}')">
                    <div class="rb-inner" style="display:flex; flex-direction:column; align-items:center;">
                        <svg class="rb-icon" viewBox="0 0 24 24"><path d="${item.icon}"/></svg>
                        <div class="rb-label">${item.name}</div>
                    </div>
                </div>
            `;
        }).join('');
    };

    // 2. RENDER CALLS (Updated with Type Labels and Current Values)
    const rankList = REWARD_DATA.ranks.map(r => r.name.toLowerCase());
    const myRankIndex = rankList.findIndex(r => r === currentRank.toLowerCase());

    // Note: Passing 'currentVal' and 'typeLabel' now
    buildShelf('shelfRanks', REWARD_DATA.ranks, 'shape-hex', null, myRankIndex, 'rank');
    buildShelf('shelfTasks', REWARD_DATA.tasks, 'shape-chip', null, totalTasks, 'task');
    buildShelf('shelfKneel', REWARD_DATA.kneeling, 'shape-circle', null, totalKneels, 'kneel');
    buildShelf('shelfSpend', REWARD_DATA.spending, 'shape-diamond', null, totalSpent, 'spend');
    };

window.openRewardCard = function(name, iconPath, current, target, type) {
    const overlay = document.getElementById('rewardCardOverlay');
    const container = overlay.querySelector('.mob-reward-card');
    
    // Elements
    const elIcon = document.getElementById('rcIcon');
    const elTitle = document.getElementById('rcTitle');
    const elStatus = document.getElementById('rcStatus');
    const elQuote = document.getElementById('rcQuote');
    const elCurrent = document.getElementById('rcCurrent');
    const elTarget = document.getElementById('rcTarget');
    const elFill = document.getElementById('rcFill');

    // Logic
    const isUnlocked = current >= target;
    const percentage = Math.min((current / target) * 100, 100);

    // 1. Set Visuals
    elIcon.innerHTML = `<svg viewBox="0 0 24 24"><path d="${iconPath}"/></svg>`;
    elTitle.innerText = name;
    
    if (isUnlocked) {
        container.classList.add('unlocked-mode');
        elStatus.innerText = "ACQUIRED";
        elQuote.innerHTML = getQuote(type, true); // Get Praise
    } else {
        container.classList.remove('unlocked-mode');
        elStatus.innerText = "LOCKED";
        elQuote.innerHTML = getQuote(type, false); // Get Insult
    }

    // 2. Set Progress
    elCurrent.innerText = current.toLocaleString(); // Adds commas (1,000)
    elTarget.innerText = "/ " + target.toLocaleString();
    elFill.style.width = percentage + "%";

    // 3. Show
    overlay.classList.remove('hidden');
};

window.closeRewardCard = function() {
    document.getElementById('rewardCardOverlay').classList.add('hidden');
};

// Helper: Generates Flavor Text
function getQuote(type, isUnlocked) {
    const insults = [
        "You are not there yet. Suffer more.",
        "Pathetic. Is this your best?",
        "Do not look at me until you finish this.",
        "Your dedication is lacking."
    ];
    const praise = [
        "Accepted. You may continue.",
        "Adequate service. Do not get arrogant.",
        "I see your effort. Keep going.",
        "This pleases me. Briefly."
    ];

    // Specific overrides
    if (type === 'spend' && !isUnlocked) return "Your wallet is too full. Empty it.";
    if (type === 'kneel' && !isUnlocked) return "Your knees are too strong. Break them.";

    return isUnlocked 
        ? praise[Math.floor(Math.random() * praise.length)] 
        : insults[Math.floor(Math.random() * insults.length)];
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

// ==========================
// REPLACE window.toggleMobileView WITH THIS VERSION
// ==========================

window.toggleMobileView = function(viewName) {
    // 1. CLEANUP POPOVERS
    if (window.closeLobby) window.closeLobby();
    if (window.closeQueenMenu) window.closeQueenMenu();
    if (window.closePoverty) window.closePoverty();

    // 2. DEFINE VIEWS
    const home = document.getElementById('viewMobileHome');
    const mobRecord = document.getElementById('viewMobileRecord');
    const mobGlobal = document.getElementById('viewMobileGlobal');
    
    // Desktop/Shared Views to hide
    const chatCard = document.getElementById('chatCard');
    const mobileApp = document.getElementById('MOBILE_APP');
    const history = document.getElementById('historySection');
    const news = document.getElementById('viewNews');
    const protocol = document.getElementById('viewProtocol');
    
    // 3. HIDE EVERYTHING (Aggressive Reset)
    const views = [home, mobRecord, mobGlobal, history, news, protocol];
    views.forEach(el => { 
        if(el) el.style.display = 'none'; 
    });

    if (chatCard) chatCard.style.setProperty('display', 'none', 'important');

    // 4. SHOW TARGET VIEW
    if (viewName === 'home' && home) {
        home.style.display = 'flex';
        if(window.syncMobileDashboard) window.syncMobileDashboard();
    }
    else if (viewName === 'chat') {
        if(chatCard && mobileApp) {
            if (chatCard.parentElement !== mobileApp) mobileApp.appendChild(chatCard);
            chatCard.style.removeProperty('display');
            chatCard.style.display = 'flex';
            // Scroll fix
            const chatBox = document.getElementById('chatBox');
            if (chatBox) setTimeout(() => { chatBox.scrollTop = chatBox.scrollHeight; }, 100);
        }
    }
    else if (viewName === 'record' && mobRecord) {
        mobRecord.style.display = 'flex';
        if(window.renderGallery) window.renderGallery();
    }
    else if (viewName === 'queen' && news) {
        news.style.display = 'block';
    }
    // *** THE FIX FOR GLOBAL ***
    else if (viewName === 'global' && mobGlobal) {
        mobGlobal.style.display = 'flex';
        
        // FORCE STYLES VIA JS (Fixes "Invisible" issue)
        mobGlobal.style.backgroundColor = "#000";
        mobGlobal.style.color = "#fff";
        mobGlobal.style.zIndex = "100";
        
        // Paint the headers inside it manually to be safe
        const headers = mobGlobal.querySelectorAll('.mob-name, .mob-header, div');
        headers.forEach(h => h.style.color = "#fff");
        
        const card = mobGlobal.querySelector('.mob-card');
        if(card) {
            card.style.border = "1px solid #333";
            card.style.background = "rgba(20,20,20,0.8)";
            card.style.padding = "20px";
            card.style.borderRadius = "8px";
        }
    }
    
    // 5. SIDEBAR CLEANUP
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
}; 

// PUT THIS AT THE VERY BOTTOM OF MAIN.JS
window.handleRoutineUpload = function(input) {
    if(input.files.length > 0) {
        window.handleEvidenceUpload(input); 
        gameStats.routineDoneToday = true; 
        window.syncMobileDashboard();
    }
};

// ==========================
// EXCHEQUER LOGIC (MOBILE)
// ==========================

window.openExchequer = function() {
    const store = document.getElementById('mobExchequer');
    
    if (store) {
        // 1. JAILBREAK: Move store to Body so it is never hidden by parent views
        if (store.parentElement !== document.body) {
            document.body.appendChild(store);
        }

        // 2. FORCE Z-INDEX: Make sure it sits on top (just under the poverty alert)
        store.style.zIndex = "2147483640"; 

        // 3. SHOW IT
        store.classList.remove('hidden');
        store.style.display = 'flex'; 
    } else {
        console.error("Exchequer Overlay not found! Check HTML IDs.");
    }
};

window.closeExchequer = function() {
    const store = document.getElementById('mobExchequer');
    if (store) {
        store.classList.add('hidden');
        store.style.display = 'none';
    }
};

// --- RANK DEFINITIONS (MATCHING YOUR IMAGE) ---
const HIERARCHY_LEVELS = [
    "Hall Boy", 
    "Footman", 
    "Silverman", 
    "Butler", 
    "Chamberlain", 
    "Secretary", 
    "Queen's Champion"
];

// MOCKING INSULTS
const RANK_INSULTS = [
    "You are too pathetic to send media.",
    "Silverman rank required. Know your place.",
    "I do not want to see your face.",
    "Earn your stripes before you try to impress me."
];

window.handleMediaPlus = function() {
    // Get Rank (Default to Hall Boy if missing)
    let currentRank = window.userProfile?.hierarchy || "Hall Boy";
    
    // Normalize string (Case insensitive check)
    const rankIndex = HIERARCHY_LEVELS.findIndex(r => r.toLowerCase() === currentRank.toLowerCase());
    
    // SILVERMAN IS INDEX 2. BUTLER IS INDEX 3.
    const SILVERMAN_IDX = 2;
    const BUTLER_IDX = 3;

    // 1. CHECK: BELOW SILVERMAN -> REJECT
    if (rankIndex < SILVERMAN_IDX) {
        triggerRankMock("SILVERMAN REQUIRED");
        return;
    }

    // 2. CONFIGURE INPUT BASED ON RANK
    const fileInput = document.getElementById('chatMediaInput');
    
    if (rankIndex < BUTLER_IDX) {
        // SILVERMAN: Photos Only
        fileInput.setAttribute("accept", "image/*");
        // Optional: Notify user they can't send video yet
        // console.log("Rank: Silverman. Photos allowed. Videos restricted.");
    } else {
        // BUTLER+: Photos & Videos
        fileInput.setAttribute("accept", "image/*,video/*");
    }

    // 3. OPEN PICKER
    fileInput.click();
};

window.triggerRankMock = function(customTitle) {
    const overlay = document.getElementById('povertyOverlay');
    const title = overlay.querySelector('.mob-reward-title');
    const text = document.getElementById('povertyInsult');
    const stamp = overlay.querySelector('.mob-rank-stamp');

    if (!overlay) return;

    const insult = RANK_INSULTS[Math.floor(Math.random() * RANK_INSULTS.length)];

    if(title) {
        title.innerText = customTitle || "RANK INSUFFICIENT";
        title.style.color = "#888";
    }
    if(text) text.innerText = `"${insult}"`;
    if(stamp) {
        stamp.innerText = "SILENCE";
        stamp.style.borderColor = "#888";
    }
    
    if (overlay.parentElement !== document.body) document.body.appendChild(overlay);
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
    
    if(window.triggerSound) triggerSound('sfx-deny');
};
// =========================================
// PART 2: FINAL APP MODE (NATIVE FLOW)
// =========================================

// =========================================
// FINAL PART: APP NAVIGATION BAR (FORCE RENDER)
// =========================================

(function() {
    // 1. Force Visual Lock (Anti-Bounce)
    function lockVisuals() {
        if (window.innerWidth > 768) return; // Mobile Only

        const lockStyles = {
            position: 'fixed',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            inset: '0',
            overscrollBehavior: 'none',
            touchAction: 'none', 
            backgroundColor: '#000000'
        };
        Object.assign(document.documentElement.style, lockStyles);
        Object.assign(document.body.style, lockStyles);

        const allowedSelectors = '#mobHomeScroll, #mobGlobalScroll, #mobRecordScroll, .chat-body-frame, .qm-scroll-content, .mob-horiz-scroll, #gridOkay, #gridFailed';
        const scrollables = document.querySelectorAll(allowedSelectors);
        
        scrollables.forEach(el => {
            if (!el) return;
            el.style.overflowY = 'auto';
            el.style.webkitOverflowScrolling = 'touch';
            el.style.overscrollBehavior = 'contain'; 
            el.style.touchAction = 'pan-y'; 
            
            if (el.classList.contains('mob-horiz-scroll') || el.id.includes('grid')) {
                el.style.touchAction = 'pan-x pan-y';
                el.style.overflowX = 'auto';
                el.style.overflowY = 'hidden';
            }
        });

        document.addEventListener('touchmove', function(e) {
            const target = e.target;
            const scrollableParent = target.closest(allowedSelectors);
            if (!scrollableParent && e.cancelable) e.preventDefault();
        }, { passive: false });
    }

    // 2. Build The Footer
    function buildAppFooter() {
        // Run only on mobile
        if (window.innerWidth > 768) return;

        // If exists, don't rebuild
        if (document.getElementById('app-mode-footer')) return;
        
        const footer = document.createElement('div');
        footer.id = 'app-mode-footer';
        
        // CSS INJECTION (Max Z-Index to stay on top of everything)
        Object.assign(footer.style, {
            display: 'flex', 
            justifyContent: 'space-around',
            alignItems: 'center',
            position: 'fixed', 
            bottom: '0', 
            left: '0', 
            width: '100%', 
            height: '60px',
            background: 'linear-gradient(to top, #000 40%, rgba(0,0,0,0.95))',
            paddingBottom: 'env(safe-area-inset-bottom)', /* Handles iPhone Home Bar */
            zIndex: '2147483647', 
            borderTop: '1px solid rgba(197, 160, 89, 0.3)',
            backdropFilter: 'blur(10px)', 
            pointerEvents: 'auto', 
            touchAction: 'none'
        });

        footer.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

        const btnStyle = "background:none; border:none; color:#666; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; font-family:'Cinzel',serif; font-size:0.55rem; width:20%; height:100%; cursor:pointer; -webkit-tap-highlight-color: transparent;";
        const centerStyle = "background:none; border:none; color:#ff003c; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; font-family:'Cinzel',serif; font-size:0.55rem; width:20%; height:100%; cursor:pointer; -webkit-tap-highlight-color: transparent;";

        footer.innerHTML = `
            <button onclick="window.toggleMobileView('home')" style="${btnStyle}">
                <span style="font-size:1.4rem;color:#888;">◈</span><span>PROFILE</span>
            </button>
            <button onclick="window.toggleMobileView('record')" style="${btnStyle}">
                <span style="font-size:1.4rem;color:#888;">▦</span><span>RECORD</span>
            </button>
            <button onclick="window.toggleMobileView('chat')" style="${centerStyle}">
                <img src="https://static.wixstatic.com/media/ce3e5b_19faff471a434690b7a40aacf5bf42c4~mv2.png" alt="Avatar" style="width:70px;height:70px;border-radius:50%;object-fit:cover;border:1px solid #ff003c;box-shadow:0 0 10px rgba(255,0,60,0.3);">
            </button>
            <button onclick="window.toggleMobileView('queen')" style="${btnStyle}">
                <span style="font-size:1.4rem;color:#888;">♛</span><span>QUEEN</span>
            </button>
            <button onclick="window.toggleMobileView('global')" style="${btnStyle}">
                <span style="font-size:1.4rem;color:#888;">⊕</span><span>GLOBAL</span>
            </button>`;
        
        document.body.appendChild(footer);
    }

    // 3. Init
    window.addEventListener('load', () => { lockVisuals(); buildAppFooter(); });
    window.addEventListener('resize', () => { lockVisuals(); buildAppFooter(); });
    
    // Force run immediately in case load event passed
    lockVisuals(); 
    buildAppFooter();

})();
// ==========================
// REPLACE FROM LINE 1235 DOWN TO LINE 1270 WITH THIS:
// ==========================

// 1. GLOBAL VARIABLE (Must be attached to window)
window.isRequestingTask = false; 

window.mobileRequestTask = function() {
    // 1. SAFETY CHECK
    if (!window.gameStats) return;

    // 2. POVERTY CHECK (Added parseInt for safety)
    if (parseInt(gameStats.coins || 0) < 300) {
        window.triggerPoverty(); 
        if(window.triggerSound) triggerSound('sfx-deny');
        return; 
    }

    // 3. LOCK THE UI (Stop the interval from resetting it)
    window.isRequestingTask = true; // <--- CHANGED THIS TO WINDOW

    // 4. SET "LOADING" STATE UI
    const idleCard = document.getElementById('qm_TaskIdle');
    const activeCard = document.getElementById('qm_TaskActive');
    
    if (idleCard) idleCard.classList.add('hidden');
    if (activeCard) activeCard.classList.remove('hidden');

    const txt = document.getElementById('mobTaskText');
    if(txt) {
        txt.innerHTML = "ESTABLISHING LINK...";
        txt.className = "text-pulse"; 
    }

    // 5. EXECUTE AFTER DELAY
    setTimeout(() => {
        // Generate the task (starts the desktop timer)
        if(window.getRandomTask) window.getRandomTask(); 
        
        // Wait a moment for the Desktop DOM to actually update, then unlock
        setTimeout(() => { 
            window.isRequestingTask = false; // <--- CHANGED THIS TO WINDOW
            if(window.syncMobileDashboard) window.syncMobileDashboard(); 
        }, 1000); // 1 second buffer
    }, 800);
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
    // 1. CHECK FUNDS (Need 300)
    if (gameStats.coins < 300) {
        window.triggerPoverty(); // Reuse your poverty overlay
        return;
    }

    // 2. DEDUCT COINS
    gameStats.coins -= 300;
    window.updateStats(); // Refresh headers

    // 3. PLAY SOUND & INSULT
    triggerSound('sfx-deny');
    
    const insults = [
        "WEAKNESS DETECTED.", 
        "PATHETIC. -300 COINS.", 
        "YOU PAY FOR YOUR FAILURE.", 
        "DISAPPOINTING."
    ];
    const randomInsult = insults[Math.floor(Math.random() * insults.length)];

    // Show Red Notification
    if(window.showSystemNotification) {
        window.showSystemNotification("PROTOCOL ABORTED", randomInsult);
    }

    // 4. CANCEL TASK & RESET UI
    if(window.cancelPendingTask) window.cancelPendingTask(); // Backend cleanup
    
    // FORCE UI RESET
    window.updateTaskUIState(false);
    window.syncMobileDashboard();
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

    // 3. Queen Menu Elements
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

    // --- VISIBILITY SYNC (THE FIX) ---
    
    // IF WE ARE CURRENTLY REQUESTING A TASK, DO NOT RUN THIS LOGIC
    // This prevents the screen from flickering back to "Idle" while loading
    if (window.isRequestingTask === true) return; 

    const activeRow = document.getElementById('activeTimerRow');
    const mobTimer = document.getElementById('mob_activeTimer');
    const mobRequestBtn = document.getElementById('mob_btnRequest');
    
    if (activeRow) {
        const isWorking = !activeRow.classList.contains('hidden');
        
        // 1. Update Dashboard
        if (mobTimer && mobRequestBtn) {
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

        // 2. Update Queen Menu (The Cards)
        const taskIdle = document.getElementById('qm_TaskIdle');
        const taskActive = document.getElementById('qm_TaskActive');

        if(taskIdle && taskActive) {
            if (isWorking) {
                taskIdle.classList.add('hidden');
                taskActive.classList.remove('hidden');
            } else {
                taskIdle.classList.remove('hidden');
                taskActive.classList.add('hidden');
            }
        }
    }
}, 500);
window.parent.postMessage({ type: "UI_READY" }, "*");
