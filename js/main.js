// main.js - FINAL FIXED VERSION (VALIDATED)

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
// 1. POVERTY & LOBBY SYSTEM
// =========================================

const POVERTY_INSULTS = [
    "Your wallet is as empty as your worth.",
    "Do not waste my time with empty pockets.",
    "Silence is free. Serving me costs.",
    "Go beg for coins, then come back.",
    "You cannot afford to look at me."
];

window.triggerPoverty = function() {
    const overlay = document.getElementById('povertyOverlay');
    const text = document.getElementById('povertyInsult');
    const insult = POVERTY_INSULTS[Math.floor(Math.random() * POVERTY_INSULTS.length)];
    if(text) text.innerText = `"${insult}"`;
    if(overlay) {
        overlay.classList.remove('hidden');
        overlay.style.display = 'flex';
    }
};

window.closePoverty = function() {
    const overlay = document.getElementById('povertyOverlay');
    if(overlay) overlay.style.display = 'none';
};

window.goToExchequer = function() {
    window.closePoverty();
    window.toggleMobileView('buy'); 
};

// Lobby Navigation
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

// Queen Menu Navigation
window.openQueenMenu = function() {
    const menu = document.getElementById('queenOverlay');
    if (menu) {
        menu.classList.remove('hidden');
        menu.style.display = 'flex';
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

// Action Logic
let currentActionType = "";
let currentActionCost = 0;
let selectedRoutineValue = "";
let selectedKinks = new Set();

window.showLobbyAction = function(type) {
    currentActionType = type;
    const prompt = document.getElementById('lobbyPrompt');
    const input = document.getElementById('lobbyInputText');
    const fileBtn = document.getElementById('lobbyInputFileBtn');
    const routineArea = document.getElementById('routineSelectionArea');
    const kinkArea = document.getElementById('kinkSelectionArea');
    const costDisplay = document.getElementById('lobbyCostDisplay');

    input.classList.add('hidden');
    fileBtn.classList.add('hidden');
    routineArea.classList.add('hidden');
    if(kinkArea) kinkArea.classList.add('hidden');
    
    document.getElementById('lobbyMenu').classList.add('hidden');
    document.getElementById('lobbyActionView').classList.remove('hidden');

    if (type === 'name') { prompt.innerText = "Enter Name"; input.classList.remove('hidden'); currentActionCost = 100; } 
    else if (type === 'photo') { prompt.innerText = "Upload Photo"; fileBtn.classList.remove('hidden'); currentActionCost = 500; }
    else if (type === 'kinks') { prompt.innerText = "Select Kinks"; if(kinkArea) { kinkArea.classList.remove('hidden'); renderKinkGrid(); } currentActionCost = 0; }
    else if (type === 'limits') { prompt.innerText = "Define Limits"; input.classList.remove('hidden'); currentActionCost = 200; }
    else if (type === 'routine') {
        prompt.innerText = "Select Routine"; routineArea.classList.remove('hidden');
        selectedRoutineValue = "";
        document.querySelectorAll('.routine-tile').forEach(t => t.classList.remove('selected'));
        currentActionCost = 0;
    }
    costDisplay.innerText = currentActionCost;
};

function renderKinkGrid() {
    const grid = document.getElementById('kinkGrid');
    if(!grid) return;
    grid.innerHTML = ""; 
    selectedKinks.clear();
    KINK_LIST.forEach(kink => {
        const btn = document.createElement('div');
        btn.className = "routine-tile";
        btn.innerText = kink.toUpperCase();
        btn.onclick = () => window.toggleKinkSelection(btn, kink);
        grid.appendChild(btn);
    });
}
window.toggleKinkSelection = function(el, value) {
    if (selectedKinks.has(value)) { selectedKinks.delete(value); el.classList.remove('selected'); } 
    else { selectedKinks.add(value); el.classList.add('selected'); }
    currentActionCost = selectedKinks.size * 100;
    document.getElementById('lobbyCostDisplay').innerText = currentActionCost;
};
window.selectRoutineItem = function(el, value) {
    document.querySelectorAll('.routine-tile').forEach(t => t.classList.remove('selected'));
    el.classList.add('selected');
    selectedRoutineValue = value;
    const input = document.getElementById('routineCustomInput');
    if (value === 'custom') { input.classList.remove('hidden'); currentActionCost = 2000; } 
    else { input.classList.add('hidden'); currentActionCost = 1000; }
    document.getElementById('lobbyCostDisplay').innerText = currentActionCost;
};

window.confirmLobbyAction = function() {
    if (gameStats.coins < currentActionCost) { window.triggerPoverty(); return; }

    let notifyTitle = "UPDATE"; let notifyText = "Saved.";

    if (currentActionType === 'routine') {
        let taskName = selectedRoutineValue;
        if (taskName === 'custom') taskName = document.getElementById('routineCustomInput').value;
        if(!taskName) return;
        notifyTitle = "PROTOCOL ASSIGNED"; notifyText = taskName;
        window.parent.postMessage({ type: "UPDATE_CMS_FIELD", field: "routine", value: taskName, cost: currentActionCost }, "*");
        userProfile.routine = taskName;
    } 
    else if (currentActionType === 'photo') {
        const fileInput = document.getElementById('lobbyFile');
        if (fileInput.files.length > 0) {
            notifyTitle = "UPLOADING";
            window.parent.postMessage({ type: "PROCESS_PAYMENT", cost: 500 }, "*");
            if(window.handleProfileUpload) window.handleProfileUpload(fileInput);
        } else return;
    }
    else if (currentActionType === 'name') {
        const text = document.getElementById('lobbyInputText').value;
        if(!text) return;
        notifyTitle = "IDENTITY REWRITTEN"; notifyText = text;
        window.parent.postMessage({ type: "UPDATE_CMS_FIELD", field: "title_fld", value: text, cost: 100 }, "*");
        userProfile.name = text; updateStats();
    }
    else if (currentActionType === 'kinks') {
        const kinkString = Array.from(selectedKinks).join(", ");
        notifyTitle = "KINKS LOGGED";
        window.parent.postMessage({ type: "UPDATE_CMS_FIELD", field: "kink", value: kinkString, cost: currentActionCost }, "*");
    }
    else {
        const text = document.getElementById('lobbyInputText').value;
        window.parent.postMessage({ type: "PURCHASE_ITEM", itemName: "LIMITS: " + text, cost: currentActionCost }, "*");
    }

    window.closeLobby();
    window.showSystemNotification(notifyTitle, notifyText);
};

window.showSystemNotification = function(title, detail) {
    const overlay = document.getElementById('celebrationOverlay');
    if(!overlay) return;
    overlay.innerHTML = `<div class="glass-card" style="border: 1px solid var(--neon-green); text-align:center; padding: 30px; background: rgba(0,0,0,0.95);"><div style="font-family:'Orbitron'; color:var(--neon-green);">${title}</div><div style="font-family:'Cinzel'; color:#fff;">${detail}</div></div>`;
    overlay.style.opacity = '1';
    setTimeout(() => { overlay.style.opacity = '0'; }, 3000);
};

// --- 2. CORE DESKTOP UI ---
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

// --- 3. INIT & BRIDGE ---
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

Bridge.listen((data) => {
    const ignoreList = ["CHAT_ECHO", "instantUpdate", "instantReviewSuccess"];
    if (ignoreList.includes(data.type)) return; 
    window.postMessage(data, "*"); 
});

window.addEventListener("message", (event) => {
    try {
        const data = event.data;
        if (data.type === "CHAT_ECHO" && data.msgObj) renderChat([data.msgObj], true);
        if (data.type === "INIT_TASKS") setTaskDatabase(data.tasks || []);
        if (data.type === "INIT_WISHLIST") { setWishlistItems(data.wishlist || []); window.WISHLIST_ITEMS = data.wishlist || []; renderWishlist(); }
        
        if (data.type === "UPDATE_FULL_DATA") {
            if (data.profile) {
                setGameStats(data.profile);
                setUserProfile({
                    name: data.profile.name || "Slave",
                    hierarchy: data.profile.hierarchy || "HallBoy",
                    memberId: data.profile.memberId || "",
                    joined: data.profile.joined,
                    profilePicture: data.profile.profilePicture,
                    kneelHistory: data.profile.kneelHistory,
                    routine: data.profile.routine
                });
                
                // Direct Image Sync
                if(data.profile.profilePicture) {
                    const rawUrl = data.profile.profilePicture;
                    const picEl = document.getElementById('profilePic');
                    if(picEl) picEl.src = getOptimizedUrl(rawUrl, 150);

                    const mobPic = document.getElementById('mob_profilePic');
                    const mobBg = document.getElementById('mob_bgPic');
                    const hudPic = document.getElementById('hudSlavePic');
                    let finalUrl = rawUrl;
                    if (rawUrl.startsWith("wix:image")) {
                        const uri = rawUrl.split('/')[3].split('#')[0];
                        finalUrl = `https://static.wixstatic.com/media/${uri}`;
                    }
                    if(mobPic) mobPic.src = finalUrl;
                    if(mobBg) mobBg.src = finalUrl;
                    if(hudPic) hudPic.src = finalUrl;
                }
                updateStats(); 
            }
            if (data.galleryData) { setGalleryData(data.galleryData); renderGallery(); }
        }
        if (data.type === "UPDATE_CHAT" || data.chatHistory) renderChat(data.chatHistory || data.messages);
    } catch(err) { console.error("Main error:", err); }
});

// --- 4. EXPORTS & HELPERS ---
window.handleUploadStart = function(inputElement) {
    if (inputElement.files && inputElement.files.length > 0) {
        const isRoutine = inputElement.id === 'routineUpload';
        if (isRoutine) {
            window.parent.postMessage({ type: "COMPLETE_ROUTINE" }, "*");
            window.showSystemNotification("EVIDENCE SENT", "Daily routine logged.");
            // Mark local done too for speed
            const todayStr = new Date().toDateString();
            const btn = document.getElementById('btnDailyRoutine');
            if(btn) btn.classList.add('hidden');
        } else {
            const btn = document.getElementById('btnUpload');
            if (btn) { btn.innerHTML = '...'; btn.style.background = '#333'; btn.style.color = '#ffd700'; }
        }
        if (typeof handleEvidenceUpload === 'function') handleEvidenceUpload(inputElement);
    }
};
window.handleRoutineUpload = window.handleUploadStart;
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
    const subName = document.getElementById('subName');
    const coinsEl = document.getElementById('coins');
    if (subName) subName.textContent = userProfile.name || "Slave";
    if (coinsEl) coinsEl.textContent = gameStats.coins ?? 0;
    
    // Mobile Sync
    if (window.syncMobileDashboard) window.syncMobileDashboard();
    updateKneelingStatus();
}

// --- MOBILE LOGIC ---
window.toggleMobileStats = function() {
    const drawer = document.getElementById('mobStatsContent');
    const arrow = document.getElementById('mobStatsArrow');
    if(drawer) { drawer.classList.toggle('open'); if(arrow) arrow.innerText = drawer.classList.contains('open') ? "▲" : "▼"; }
};

window.toggleMobileView = function(viewName) {
    const home = document.getElementById('viewMobileHome');
    const mobRecord = document.getElementById('viewMobileRecord');
    const chatCard = document.getElementById('chatCard');
    const mobileApp = document.getElementById('MOBILE_APP');
    const history = document.getElementById('historySection');
    const news = document.getElementById('viewNews');
    const protocol = document.getElementById('viewProtocol');
    
    [home, mobRecord, history, news, protocol].forEach(el => { if(el) el.style.display = 'none'; });
    if (chatCard) chatCard.style.setProperty('display', 'none', 'important');

    if (viewName === 'home') {
        if(home) { home.style.display = 'flex'; if(window.syncMobileDashboard) window.syncMobileDashboard(); }
    }
    else if (viewName === 'chat') {
        if(chatCard && mobileApp) {
            if (chatCard.parentElement !== mobileApp) mobileApp.appendChild(chatCard);
            chatCard.style.removeProperty('display');
            chatCard.style.display = 'flex';
            setTimeout(() => { document.getElementById('chatBox').scrollTop = 9999; }, 100);
        }
    }
    else if (viewName === 'record') {
        if (mobRecord) {
            mobRecord.style.display = 'flex';
            if(window.renderGallery) window.renderGallery();
        }
    }
    else if (viewName === 'queen') { if(news) news.style.display = 'block'; }
    
    const sidebar = document.querySelector('.layout-left');
    if (sidebar) sidebar.classList.remove('mobile-open');
};

window.triggerKneel = function() {
    const sidebar = document.querySelector('.layout-left');
    const realBtn = document.querySelector('.kneel-bar-graphic');
    if (sidebar) sidebar.classList.add('mobile-open'); 
    if (realBtn) { realBtn.style.boxShadow = "0 0 20px var(--neon-red)"; setTimeout(() => realBtn.style.boxShadow = "", 1000); }
};

window.syncMobileDashboard = function() {
    if (!gameStats || !userProfile) return;
    const elName = document.getElementById('mob_slaveName');
    const elRank = document.getElementById('mob_rankStamp');
    const elPoints = document.getElementById('mobPoints');
    const elCoins = document.getElementById('mobCoins');

    if (elName) elName.innerText = userProfile.name || "SLAVE";
    if (elRank) elRank.innerText = userProfile.hierarchy || "INITIATE";
    if (elPoints) elPoints.innerText = gameStats.points || 0;
    if (elCoins) elCoins.innerText = gameStats.coins || 0;

    const mobStreak = document.getElementById('mobStreak');
    const mobTotal = document.getElementById('mobTotal');
    const mobKneels = document.getElementById('mobKneels');
    if (mobStreak) mobStreak.innerText = gameStats.taskdom_streak || 0;
    if (mobTotal) mobTotal.innerText = gameStats.taskdom_total_tasks || 0;
    if (mobKneels) mobKneels.innerText = gameStats.kneelCount || 0;

    // Grid
    const grid = document.getElementById('mob_streakGrid');
    if(grid) {
        grid.innerHTML = '';
        let loggedHours = [];
        const now = new Date();
        if (userProfile.kneelHistory) {
            try {
                const hObj = JSON.parse(userProfile.kneelHistory);
                if (hObj.date === now.toDateString()) { loggedHours = hObj.hours || []; }
            } catch(e) {}
        }
        for(let i=0; i<24; i++) {
            const sq = document.createElement('div');
            sq.className = 'streak-sq';
            if (loggedHours.includes(i)) sq.classList.add('active');
            else if (i < now.getHours()) { sq.style.opacity = "0.3"; sq.style.borderColor = "#333"; }
            grid.appendChild(sq);
        }
    }
    
    // Queen Menu
    const kneelFill = document.getElementById('kneelDailyFill');
    const kneelText = document.getElementById('kneelDailyText');
    if (kneelFill && kneelText) {
        const count = gameStats.todayKneeling || (gameStats.kneelCount % 8) || 0; 
        const goal = 8;
        kneelFill.style.width = Math.min(100, (count/goal)*100) + "%";
        kneelText.innerText = `${count} / ${goal}`;
    }

    const routineBtn = document.getElementById('btnDailyRoutine');
    const noRoutineMsg = document.getElementById('noRoutineMsg');
    
    if (userProfile.routine && userProfile.routine.length > 2) {
        const now = new Date();
        const isTime = now.getHours() >= 7; 
        
        let isDoneToday = false;
        if (userProfile.kneelHistory) {
            try {
                const hObj = JSON.parse(userProfile.kneelHistory);
                if (hObj.date === now.toDateString() && hObj.routineDone === true) isDoneToday = true;
            } catch(e) {}
        }

        if (isTime && !isDoneToday) {
            if (routineBtn) { routineBtn.classList.remove('hidden'); routineBtn.innerText = "SUBMIT: " + userProfile.routine.toUpperCase(); }
            if (noRoutineMsg) noRoutineMsg.style.display = 'none';
        } else {
            if (routineBtn) routineBtn.classList.add('hidden');
            if (noRoutineMsg) {
                noRoutineMsg.style.display = 'block';
                noRoutineMsg.innerText = isDoneToday ? "DUTY COMPLETED" : "AWAITING 07:00";
                noRoutineMsg.style.color = isDoneToday ? "#00ff00" : "#666";
            }
        }
    } else {
        if (routineBtn) routineBtn.classList.add('hidden');
        if (noRoutineMsg) { noRoutineMsg.style.display = 'block'; noRoutineMsg.innerText = "NO ROUTINE ASSIGNED"; }
    }
    
    // Operations Card
    const activeRow = document.getElementById('activeTimerRow');
    if (activeRow) {
        const isWorking = !activeRow.classList.contains('hidden');
        const light = document.getElementById('mob_statusLight');
        const text = document.getElementById('mob_statusText');
        const timer = document.getElementById('mob_activeTimer');
        const btn = document.getElementById('mob_btnRequest');
        if (isWorking) {
            if(light) light.className = 'status-light green';
            if(text) text.innerText = "WORKING";
            if(timer) timer.classList.remove('hidden');
            if(btn) btn.classList.add('hidden');
        } else {
            if(light) light.className = 'status-light red';
            if(text) text.innerText = "UNPRODUCTIVE";
            if(timer) timer.classList.add('hidden');
            if(btn) btn.classList.remove('hidden');
        }
    }
};

// APP ENGINE
(function() {
    if (window.innerWidth > 768) return;
    function lockVisuals() {
        Object.assign(document.body.style, { height: window.innerHeight + 'px', width: '100%', position: 'fixed', overflow: 'hidden', inset: '0', overscrollBehavior: 'none', touchAction: 'none' });
        const app = document.querySelector('.app-container');
        if (app) Object.assign(app.style, { height: '100%', overflow: 'hidden' });
        document.querySelectorAll('.content-stage, .chat-body-frame, #viewMobileHome, #viewMobileRecord, #viewNews').forEach(el => {
            Object.assign(el.style, { height: '100%', overflowY: 'auto', webkitOverflowScrolling: 'touch', paddingBottom: '100px', overscrollBehaviorY: 'contain', touchAction: 'pan-y' });
        });
    }
    function buildAppFooter() {
        if (document.getElementById('app-mode-footer')) { document.getElementById('app-mode-footer').remove(); }
        const footer = document.createElement('div');
        footer.id = 'app-mode-footer';
        Object.assign(footer.style, { display: 'flex', justifyContent: 'space-around', alignItems: 'center', position: 'fixed', bottom: '0', left: '0', width: '100%', height: '80px', background: 'linear-gradient(to top, #000 40%, rgba(0,0,0,0.95))', paddingBottom: 'env(safe-area-inset-bottom)', zIndex: '2147483647', borderTop: '1px solid rgba(197, 160, 89, 0.3)', backdropFilter: 'blur(10px)', pointerEvents: 'auto', touchAction: 'none' });
        const btnStyle = "background:none; border:none; color:#666; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; font-family:'Cinzel',serif; font-size:0.55rem; width:20%; height:100%; cursor:pointer;";
        const chatStyle = "background:none; border:none; color:#ff003c; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; font-family:'Cinzel',serif; font-size:0.55rem; width:20%; height:100%; cursor:pointer; text-shadow: 0 0 10px rgba(255,0,60,0.4);";
        footer.innerHTML = `<button class="mf-btn" onclick="window.toggleMobileView('home')" style="${btnStyle}"><span style="font-size:1.4rem;">◈</span><span>PROFILE</span></button><button class="mf-btn" onclick="window.toggleMobileView('record')" style="${btnStyle}"><span style="font-size:1.4rem;">▦</span><span>RECORD</span></button><button class="mf-btn" onclick="window.toggleMobileView('chat')" style="${chatStyle}"><span style="font-size:1.6rem;">❖</span><span>LOGS</span></button><button class="mf-btn" onclick="window.toggleMobileView('queen')" style="${btnStyle}"><span style="font-size:1.4rem;">♛</span><span>QUEEN</span></button><button class="mf-btn" onclick="window.toggleMobileView('global')" style="${btnStyle}"><span style="font-size:1.4rem;">🌐</span><span>GLOBAL</span></button>`;
        document.body.appendChild(footer);
    }
    window.addEventListener('load', () => { lockVisuals(); buildAppFooter(); if(window.toggleMobileView) window.toggleMobileView('home'); });
    window.addEventListener('resize', lockVisuals);
})();

// TIMER SYNC
setInterval(() => {
    const desktopH = document.getElementById('timerH');
    const desktopM = document.getElementById('timerM');
    const desktopS = document.getElementById('timerS');
    const mobileH = document.getElementById('m_timerH');
    const mobileM = document.getElementById('m_timerM');
    const mobileS = document.getElementById('m_timerS');
    const ringH = document.getElementById('ring_H');
    const ringM = document.getElementById('ring_M');
    const ringS = document.getElementById('ring_S');
    if (desktopH && mobileH) {
        const hVal = parseInt(desktopH.innerText) || 0;
        const mVal = parseInt(desktopM.innerText) || 0;
        const sVal = parseInt(desktopS.innerText) || 0;
        mobileH.innerText = desktopH.innerText; mobileM.innerText = desktopM.innerText; mobileS.innerText = desktopS.innerText;
        if(ringH) ringH.style.background = `conic-gradient(#c5a059 ${(hVal / 24) * 360}deg, rgba(197, 160, 89, 0.1) 0deg)`;
        if(ringM) ringM.style.background = `conic-gradient(#c5a059 ${(mVal / 60) * 360}deg, rgba(197, 160, 89, 0.1) 0deg)`;
        if(ringS) ringS.style.background = `conic-gradient(#c5a059 ${(sVal / 60) * 360}deg, rgba(197, 160, 89, 0.1) 0deg)`;
    }
}, 500);

window.parent.postMessage({ type: "UI_READY" }, "*");
