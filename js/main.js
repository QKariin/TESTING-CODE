





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
import { uploadToBytescale } from './mediaBytescale.js';

// --- LOCALHOST / PREVIEW BYPASS ---
// If running on Live Server, mock the user immediately so we don't get stuck on "Loading..." or Login keys.
if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") {
    console.log("⚠️ PREVIEW MODE DETECTED: MOCKING LOGIN ⚠️");
    setTimeout(() => {
        if (window.setUserProfile) {
            window.setUserProfile({
                name: "Preview Slave",
                hierarchy: "Evaluator",
                avatar: "",
                joined: new Date().toISOString(),
                coins: 5000,
                merit: 100
            });
        }
        // Force UI updates
        if (document.getElementById('subName')) document.getElementById('subName').innerText = "Preview Slave";
        if (document.getElementById('subHierarchy')) document.getElementById('subHierarchy').innerText = "Evaluator";
        if (document.getElementById('coins')) document.getElementById('coins').innerText = "5000";
        if (document.getElementById('points')) document.getElementById('points').innerText = "100";

        // Hide any potential loading/login overlays if they exist dynamically
        const overlays = document.querySelectorAll('[id*="login"], [id*="overlay"]');
        overlays.forEach(o => {
            // Don't hide the main app :)
            if (o.id !== 'sessionOverlay' && o.id !== 'celebrationOverlay') {
                o.style.display = 'none';
            }
        });
    }, 1000);
}

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

// --- HELPER: CHECK IF ROUTINE IS DONE (6 AM RESET RULE) ---
function checkRoutineStatus(lastUploadDateString) {
    if (!lastUploadDateString) return false; // Never done

    const last = new Date(lastUploadDateString);
    const now = new Date();

    // Define "Duty Start Time" for the current moment
    let dutyStart = new Date();
    dutyStart.setHours(6, 0, 0, 0); // Today at 06:00:00

    // If it is currently EARLY morning (e.g. 2 AM), the duty day started yesterday
    if (now < dutyStart) {
        dutyStart.setDate(dutyStart.getDate() - 1);
    }

    // If the last upload happened AFTER the duty window started, it counts.
    return last >= dutyStart;
}

// ==========================
// REPLACE window.triggerPoverty WITH THIS JAILBREAK VERSION
// ==========================

window.triggerPoverty = function () {
    const overlay = document.getElementById('povertyOverlay');
    const text = document.getElementById('povertyInsult');

    // Pick random insult
    const insult = POVERTY_INSULTS[Math.floor(Math.random() * POVERTY_INSULTS.length)];
    if (text) text.innerText = `"${insult}"`;

    if (overlay) {
        // *** THE FIX: Move overlay to Body so it is never hidden by a parent view ***
        if (overlay.parentElement !== document.body) {
            document.body.appendChild(overlay);
        }

        overlay.classList.remove('hidden');
        overlay.style.display = 'flex';
    }
};



window.closePoverty = function () {
    const overlay = document.getElementById('povertyOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.style.display = 'none';
    }
};

// =========================================
// ACTION PANEL (USER APP) - NEW LOGIC
// =========================================

window.switchApTab = function (tabName) {
    // 1. Buttons
    document.querySelectorAll('.ap-tab').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('nav' + tabName);
    if (btn) btn.classList.add('active');

    // 2. Views
    document.querySelectorAll('.ap-view').forEach(v => v.classList.add('hidden'));
    const view = document.getElementById('tab' + tabName);
    if (view) {
        view.classList.remove('hidden');
        view.classList.add('active');
    }
};

window.updateActionPanelStats = function () {
    if (typeof gameStats === 'undefined') return;

    // 1. CAPITAL (Gold)
    const elCapital = document.getElementById('dWalletVal');
    if (elCapital) elCapital.innerText = (gameStats.coins || 0).toLocaleString();

    // 2. KNEELING (Blue) - Shows HOURS
    const elKneel = document.getElementById('dTotalKneel');
    const elLastKneel = document.getElementById('dLastKneel');
    if (elKneel) {
        const hours = ((gameStats.kneelCount || 0) * 0.25).toFixed(1);
        elKneel.innerText = hours + "h";
    }
    if (elLastKneel && typeof userProfile !== 'undefined') {
        if (userProfile.lastKneelDate) {
            const d = new Date(userProfile.lastKneelDate);
            elLastKneel.innerText = (d.getMonth() + 1) + "/" + d.getDate();
        } else {
            elLastKneel.innerText = "--";
        }
    }

    // 3. ROUTINE (Green)
    const elRoutine = document.getElementById('dRoutineStatus');
    const elRoutineName = document.getElementById('dRoutineName');

    let isDone = false;
    if (typeof userProfile !== 'undefined' && userProfile.lastRoutineUpload && typeof checkRoutineStatus === 'function') {
        isDone = checkRoutineStatus(userProfile.lastRoutineUpload);
    }

    if (elRoutine) {
        elRoutine.innerText = isDone ? "DONE" : "PENDING";
        elRoutine.style.color = isDone ? "var(--green)" : "#555";
        if (!isDone) elRoutine.style.color = "#888";
    }

    if (elRoutineName && typeof userProfile !== 'undefined') {
        const rName = (userProfile.routine && userProfile.routine.name) ? userProfile.routine.name :
            (userProfile.routineName ? userProfile.routineName : "NONE");
        elRoutineName.innerText = rName.toUpperCase();
    }

    // 4. STREAK (Red)
    const elStreak = document.getElementById('dStreak');
    if (elStreak) elStreak.innerText = (gameStats.taskdom_streak || 0);

    // --- UPDATE ACTIVE TASK BOX ---
    updateApActiveTask();
};

function updateApActiveTask() {
    const box = document.getElementById('activeTaskBox');
    const txt = document.getElementById('miniTaskText');
    const tmr = document.getElementById('miniTaskTimer');
    if (!box) return;

    if (currentTask && currentTask.status === 'active') {
        box.style.display = 'flex';

        if (txt) txt.innerText = currentTask.text;

        if (tmr && currentTask.startTime) {
            const now = Date.now();
            const start = new Date(currentTask.startTime).getTime();
            const diff = now - start;
            const sec = Math.floor(diff / 1000) % 60;
            const min = Math.floor(diff / (1000 * 60)) % 60;
            const hrs = Math.floor(diff / (1000 * 60 * 60));
            tmr.innerText =
                (hrs < 10 ? "0" + hrs : hrs) + ":" +
                (min < 10 ? "0" + min : min) + ":" +
                (sec < 10 ? "0" + sec : sec);
        }
    } else {
        box.style.display = 'none';
    }
}



// ==========================
// REPLACE WINDOW.GOTOEXCHEQUER (Around Line 56) WITH THIS:
// ==========================

window.goToExchequer = function () {
    // 1. Close any blocking overlays (Poverty, Queen Menu)
    window.closePoverty();
    if (window.closeQueenMenu) window.closeQueenMenu();

    // 2. Switch to the Global View (Mobile) instead of 'buy' (Desktop)
    // This prevents the "Black Screen" crash
    if (window.toggleMobileView) window.toggleMobileView('global');

    // 3. Force open the Store Overlay immediately after switching views
    setTimeout(() => {
        if (window.openExchequer) window.openExchequer();
    }, 200);
};

// --- 2. CRITICAL UI FUNCTIONS ---

window.toggleTaskDetails = function (forceOpen = null) {
    if (window.event) window.event.stopPropagation();
    const panel = document.getElementById('taskDetailPanel');
    const link = document.querySelector('.see-task-link');
    const chatBox = document.getElementById('chatBox');
    if (!panel) return;
    const isOpen = panel.classList.contains('open');
    let shouldOpen = (forceOpen === true) ? true : (forceOpen === false ? false : !isOpen);

    if (shouldOpen) {
        panel.classList.add('open');
        if (chatBox) chatBox.classList.add('focused-task');
        if (link) { link.innerHTML = "▲ HIDE DIRECTIVE ▲"; link.style.opacity = "1"; }
    } else {
        panel.classList.remove('open');
        if (chatBox) chatBox.classList.remove('focused-task');
        if (link) { link.innerHTML = "▼ SEE DIRECTIVE ▼"; link.style.opacity = "1"; }
    }
};

window.updateTaskUIState = function (isActive) {
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

document.addEventListener('click', function (event) {
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
    if (window.parent) window.parent.postMessage({ iframeHeight: document.body.scrollHeight }, '*');
});
resizer.observe(document.body);

function initDomProfile() {
    const frame = document.getElementById('twitchFrame');
    if (frame && !frame.src) {
        // Updated to include custom domain c.qkarin.com
        const parents = ["qkarin.com", "www.qkarin.com", "entire-ecosystem.vercel.app", "c.qkarin.com", "html-components.wixusercontent.com", "filesusr.com", "editor.wix.com", "manage.wix.com", "localhost"];
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

window.openLobby = function () {

    document.getElementById('lobbyOverlay').classList.remove('hidden');

    window.backToLobbyMenu();

};



window.closeLobby = function () {

    document.getElementById('lobbyOverlay').classList.add('hidden');

};



window.backToLobbyMenu = function () {

    document.getElementById('lobbyMenu').classList.remove('hidden');

    document.getElementById('lobbyActionView').classList.add('hidden');

};



// 2. SETUP ACTION SCREEN

let selectedKinks = new Set(); // Store selections



window.showLobbyAction = function (type) {

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

    if (kinkArea) kinkArea.classList.add('hidden');



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

        if (kinkArea) {

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

    if (!grid) return;

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

window.toggleKinkSelection = function (el, value) {

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

window.selectRoutineItem = function (el, value) {

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

window.confirmLobbyAction = function () {

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

        if (!taskName) return;



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



        if (btn) {

            btn.classList.remove('hidden');

            // Update button text inside the Queen Menu

            const txt = document.getElementById('routineBtnText');

            if (txt) txt.innerText = "SUBMIT: " + taskName.toUpperCase();

        }

        if (noMsg) noMsg.style.display = 'none';

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



            if (window.handleProfileUpload) window.handleProfileUpload(fileInput);

        } else { return; }

    }



    // --- C. NAME LOGIC ---

    else if (currentActionType === 'name') {

        const text = document.getElementById('lobbyInputText').value;

        if (!text) return;



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

        if (el) el.innerText = text;

        if (halo) halo.innerText = text;

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

        if (!text) return;



        notifyTitle = "DATA APPENDED";

        notifyText = "Limits updated.";



        window.parent.postMessage({
            type: "UPDATE_CMS_FIELD",
            field: "limits",
            value: text,
            cost: currentActionCost,
            message: "Limits set: " + text
        }, "*");

    }



    // FINAL: Close & Celebrate

    window.closeLobby();



    // Trigger the Green Notification

    if (window.showSystemNotification) {

        window.showSystemNotification(notifyTitle, notifyText);

    }

};



// --- NOTIFICATION SYSTEM ---

// --- NOTIFICATION SYSTEM (Green = Reward, Red = Penalty) ---
window.showSystemNotification = function (title, detail, isPenalty = false) {
    const overlay = document.getElementById('celebrationOverlay');
    if (!overlay) return;

    // 1. Determine Style Class
    // If penalty, we add 'angry'. If not, just standard glass-card.
    const containerClass = isPenalty ? "glass-card angry" : "glass-card";

    // 2. Build Internal HTML based on type
    let contentHtml = "";

    if (isPenalty) {
        // ANGRY RED LAYOUT
        contentHtml = `
            <div class="angry-title"> ${title}</div>
            <div class="angry-text">${detail}</div>
        `;
    } else {
        // STANDARD GREEN LAYOUT (Original)
        contentHtml = `
            <div style="font-family:'Orbitron'; font-size:1.2rem; color:var(--neon-green); margin-bottom:10px; letter-spacing:2px; text-shadow:0 0 20px var(--neon-green);">
                ${title}
            </div>
            <div style="font-family:'Cinzel'; font-size:0.9rem; color:#fff;">
                ${detail}
            </div>
        `;
    }

    // 3. Inject and Animate
    overlay.innerHTML = `<div class="${containerClass}" style="text-align:center; padding: 30px; min-width: 280px;">${contentHtml}</div>`;

    overlay.style.pointerEvents = "auto";
    overlay.style.opacity = '1';

    // 4. Hide after 3.5 seconds
    setTimeout(() => {
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = "none";
    }, 3500);
};




window.addEventListener("message", (event) => {
    try {
        const data = event.data;

        // 1. CHAT & RULES
        if (data.type === "CHAT_ECHO" && data.msgObj) renderChat([data.msgObj], true);

        if (data.type === 'UPDATE_RULES') {
            const rules = data.payload || {};
            for (let i = 1; i <= 8; i++) {
                const el = document.getElementById('r' + i);
                if (el && rules['rule' + i]) el.innerHTML = rules['rule' + i];
            }
        }

        // 2. INIT STATIC DATA
        if (data.type === "INIT_TASKS") {
            setTaskDatabase(data.tasks || []);
        }
        if (data.type === "INIT_WISHLIST" || data.wishlist) {
            setWishlistItems(data.wishlist || []);
            window.WISHLIST_ITEMS = data.wishlist || [];
            renderWishlist();
        }

        // 3. STATUS UPDATES (Header Signals)
        if (data.type === "UPDATE_DOM_STATUS") {
            const badge = document.getElementById('chatStatusBadge');
            const ring = document.getElementById('chatStatusRing');
            const domBadge = document.getElementById('domStatusBadge');

            if (badge) {
                badge.innerHTML = data.online ? "ONLINE" : data.text;
                badge.className = data.online ? "chat-status-text chat-online" : "chat-status-text";
            }
            if (ring) ring.className = data.online ? "dom-status-ring ring-active" : "dom-status-ring ring-inactive";
            if (domBadge) domBadge.className = data.online ? "dom-status status-online" : "dom-status";

            const mobText = document.getElementById('mobChatStatusText');
            const mobDot = document.getElementById('mobChatOnlineDot');
            const hudDot = document.getElementById('hudDomStatus');

            if (mobText) {
                mobText.innerText = data.online ? "ONLINE NOW" : data.text.toUpperCase();
                mobText.style.color = data.online ? "#00ff00" : "#888";
            }

            if (mobDot) mobDot.className = data.online ? 'status-dot online' : 'status-dot';
            if (hudDot) hudDot.className = data.online ? 'hud-status-dot online' : 'hud-status-dot offline';
        }

        if (data.type === "UPDATE_Q_FEED") {
            const feedData = data.domVideos || data.posts || data.feed;
            if (feedData && Array.isArray(feedData)) {
                if (typeof renderDomVideos === 'function') renderDomVideos(feedData);
                if (typeof renderNews === 'function') renderNews(feedData);
                const pc = document.getElementById('cntPosts');
                if (pc) pc.innerText = feedData.length;
            }
        }

        // 4. MAIN DATA SYNC (Profile & Stats)
        const payload = data.profile || data.galleryData || data.pendingState ? data : (data.type === "UPDATE_FULL_DATA" ? data : null);

        if (payload) {
            // A. GALLERY
            if (payload.galleryData) {
                setGalleryData(payload.galleryData);
                const currentGalleryJson = JSON.stringify(payload.galleryData);
                if (currentGalleryJson !== lastGalleryJson) {
                    setLastGalleryJson(currentGalleryJson);
                    renderGallery();
                    if (window.renderDesktopRecord) window.renderDesktopRecord(); // SYNC DESKTOP
                }
            }

            // B. PROFILE
            if (data.profile && !ignoreBackendUpdates) {

                // --- TRUTH CHECK (Routine Date) ---
                let confirmedDate = data.profile.lastRoutine || "";

                // Check specific routineHistory field
                if (data.profile.routineHistory || data.profile.routinehistory) {
                    let rh = data.profile.routineHistory || data.profile.routinehistory;
                    if (typeof rh === 'string' && (rh.startsWith('[') || rh.startsWith('{'))) {
                        try { rh = JSON.parse(rh); } catch (e) { }
                    }
                    if (Array.isArray(rh) && rh.length > 0) {
                        rh.sort((a, b) => new Date(b.date || b._createdDate || b) - new Date(a.date || a._createdDate || a));
                        const newest = rh[0];
                        const rDate = newest.date || newest._createdDate || newest;
                        if (!confirmedDate || new Date(rDate) > new Date(confirmedDate)) confirmedDate = rDate;
                    }
                }

                // Protect Local Updates
                if (typeof userProfile !== 'undefined' && userProfile.lastRoutine) {
                    const localTime = new Date(userProfile.lastRoutine).getTime();
                    const incomingTime = confirmedDate ? new Date(confirmedDate).getTime() : 0;
                    if (localTime > incomingTime) confirmedDate = userProfile.lastRoutine;
                }
                data.profile.lastRoutine = confirmedDate;

                // --- INTEGRATION: MAP CMS FIELDS TO GAME STATS ---
                // This ensures the Hierarchy Modal can read the progress
                setGameStats({
                    ...data.profile, // Load everything

                    // Explicit Mappings for Hierarchy Logic
                    total_coins_spent: data.profile.tributetotal || 0, // NEW CMS FIELD
                    routine_streak: data.profile.routinestreak || 0,   // NEW CMS FIELD
                    kneelCount: data.profile.kneelCount || 0,
                    taskdom_completed: data.profile.taskdom_completed_tasks || 0
                });

                setUserProfile({
                    name: data.profile.name || "Slave",
                    hierarchy: data.profile.hierarchy || "HallBoy",
                    memberId: data.profile.memberId || "",
                    joined: data.profile.joined,
                    profilePicture: data.profile.profilePicture,
                    routine: data.profile.routine,
                    kneelHistory: data.profile.kneelHistory,
                    lastRoutine: confirmedDate,
                    routineHistory: data.profile.routineHistory, // Save full history for display

                    // NEW: REQUIRED FOR HIERARCHY LOGIC
                    kinks: data.profile.kinks,
                    limits: data.profile.limits,
                    rawImage: data.profile.rawImage
                });

                if (data.profile.taskQueue) setTaskQueue(data.profile.taskQueue);

                if (data.profile.activeRevealMap) {
                    try { setActiveRevealMap(JSON.parse(data.profile.activeRevealMap)); } catch (e) { setActiveRevealMap([]); }
                }

                if (data.profile.rewardVault) {
                    try { setVaultItems(JSON.parse(data.profile.rewardVault)); } catch (e) { setVaultItems([]); }
                }

                setLibraryProgressIndex(data.profile.libraryProgressIndex || 1);
                setCurrentLibraryMedia(data.profile.currentLibraryMedia || "");

                renderRewardGrid();
                if (data.profile.lastWorship) setLastWorshipTime(new Date(data.profile.lastWorship).getTime());
                setStats(migrateGameStatsToStats(data.profile, stats));

                // Profile Pic Sync
                if (data.profile.profilePicture) {
                    const rawUrl = data.profile.profilePicture;
                    const picEl = document.getElementById('profilePic');
                    if (picEl) picEl.src = getOptimizedUrl(rawUrl, 150);

                    const mobPic = document.getElementById('mob_profilePic');
                    const mobBg = document.getElementById('mob_bgPic');
                    const hudPic = document.getElementById('hudSlavePic');

                    let finalUrl = rawUrl;
                    if (rawUrl.startsWith("wix:image")) {
                        const uri = rawUrl.split('/')[3].split('#')[0];
                        finalUrl = `https://static.wixstatic.com/media/${uri}`;
                    }
                    if (mobPic) mobPic.src = finalUrl;
                    if (mobBg) mobBg.src = finalUrl;
                    if (hudPic) hudPic.src = finalUrl;

                    if (typeof userProfile !== 'undefined') userProfile.profilePicture = rawUrl;
                }
                updateStats();

                // TRIGGER UI REFRESH
                if (window.syncMobileDashboard) window.syncMobileDashboard();
                if (window.renderDesktopRecord) window.renderDesktopRecord(); // SYNC DESKTOP
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
                        if (rt) rt.innerText = "AWAITING ORDERS";

                        // New Vision UI support
                        const im = document.getElementById('idleMessage');
                        if (im) im.innerText = "Awaiting direct orders from the Void...";
                        const tr = document.getElementById('activeTimerRow');
                        if (tr) tr.classList.add('hidden');
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
    } catch (err) { console.error("Main error:", err); }
});

// --- EXPORTS & HELPERS ---
window.handleUploadStart = function (inputElement) {
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

    // --- VISUAL HIERARCHY LOGIC (STRICT) ---
    // Start with what the DB says
    let visualRank = userProfile.hierarchy || "Hall Boy";

    // 1. GATEKEEPER: Identity & Photo
    // If these are missing, you ARE Hall Boy, no matter what the DB says (catch latency)
    if (!userProfile.name || userProfile.name === "Slave" || !userProfile.profilePicture) {
        visualRank = "Hall Boy";
    }

    // 2. GATEKEEPER: Preferences (Silverman+)
    // If you are visually marked as Silverman+, but have no Kinks, degrade to Footman visually
    // (This hides the rank until they fix it)
    const dbRankLower = visualRank.toLowerCase().replace(/[^a-z0-9]/g, "");
    const isAboveFootman = dbRankLower !== "hallboy" && dbRankLower !== "footman";

    if (isAboveFootman) {
        const hasKinks = (userProfile.kinks && userProfile.kinks.length > 2);
        const hasLimits = (userProfile.limits && userProfile.limits.length > 2);

        if (!hasKinks || !hasLimits) {
            visualRank = "Footman";
        }
    }

    // 3. NO OPTIMISTIC PROMOTION. 
    // We strictly follow the backend, only applying local degradation for instant feedback.

    // Update Basic Desktop Elements
    subName.textContent = userProfile.name || "Slave";
    if (subHierarchy) subHierarchy.textContent = visualRank; // VISUAL PROMOTION
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
    if (mobRank) mobRank.innerText = visualRank; // VISUAL PROMOTION

    if (mobPoints) mobPoints.innerText = gameStats.points || 0;

    // --- NEW ACTION PANEL SYNC ---
    if (window.updateActionPanelStats) window.updateActionPanelStats();
    if (mobCoins) mobCoins.innerText = gameStats.coins || 0;

    if (mobStreak) mobStreak.innerText = gameStats.taskdom_streak || 0;
    if (mobTotal) mobTotal.innerText = gameStats.taskdom_total_tasks || 0;
    if (mobKneels) mobKneels.innerText = gameStats.kneelCount || 0;

    // Daily Duties Logic
    const dailyKneels = (gameStats.kneelHistory ? JSON.parse(gameStats.kneelHistory).hours?.length || 0 : 0);
    if (mobDailyKneels) mobDailyKneels.innerText = dailyKneels + " / 8";

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
    if (grid) {
        grid.innerHTML = '';
        let loggedHours = [];
        const now = new Date();

        if (userProfile.kneelHistory) {
            try {
                const hObj = JSON.parse(userProfile.kneelHistory);
                loggedHours = hObj.hours || [];
            } catch (e) { console.error("Grid parse error", e); }
        }

        for (let i = 0; i < 24; i++) {
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
        try { sinceEl.textContent = new Date(userProfile.joined).toLocaleDateString(); } catch (e) { sinceEl.textContent = "--/--/--"; }
    }

    if (typeof LEVELS !== 'undefined' && LEVELS.length > 0) {
        let nextLevel = LEVELS.find(l => l.min > gameStats.points) || LEVELS[LEVELS.length - 1];
        const nln = document.getElementById('nextLevelName');
        const pnd = document.getElementById('pointsNeeded');

        if (nln) nln.innerText = nextLevel.name;
        if (pnd) pnd.innerText = Math.max(0, nextLevel.min - gameStats.points) + " to go";

        const pb = document.getElementById('progressBar');
        const progress = ((gameStats.points - 0) / (nextLevel.min - 0)) * 100;
        if (pb) pb.style.width = Math.min(100, Math.max(0, progress)) + "%";

        const sp = document.getElementById('satisfactionPercent');
        if (sp) sp.innerText = Math.round(Math.min(100, Math.max(0, progress))) + "%";
    }

    updateKneelingStatus();
}

// =========================================
// REWARD SYSTEM CONFIG & RENDER
// =========================================

const ICONS = {
    rank: "M12 2l-10 9h20l-10-9zm0 5l6 5.5h-12l6-5.5z M12 14l-8 7h16l-8-7z", // Chevron Stack
    task: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-5-5 1.41-1.41L11 14.17l7.59-7.59L20 8l-9 9z", // Check Circle
    kneel: "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z", // Clock/Time
    spend: "M12,2L2,12L12,22L22,12L12,2Z M12,18L6,12L12,6L18,12L12,18Z" // Diamond Gem
};

// --- CONFIGURATION: RANKS & MEDALS ---
const REWARD_DATA = {
    // 1. THE HIERARCHY (FETCHED FROM BACKEND)
    ranks: [], // EMPTY - Fetched via INIT_HIERARCHY_RULES

    // ... (Keep the medals section as is) ...

    // 2. THE MEDALS (Side Quests - Restored)
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

// --- NEW LISTENER FOR BACKEND RULES ---
window.addEventListener("message", (event) => {
    // SAFETY: Wix posts many messages, check for our type
    const data = event.data;
    if (data && data.type === "INIT_HIERARCHY_RULES") {
        console.log("RECEIVED HIERARCHY RULES:", data.rules);
        if (data.rules && Array.isArray(data.rules)) {
            // MAP BACKEND RULES TO FRONTEND STRUCTURE
            REWARD_DATA.ranks = data.rules.map(r => {
                // --- EMERGENCY PATCH: FORCE SILVERMAN & FOOTMAN FLAGS ---
                // (In case Backend cache is stale)
                if (r.name === "Silverman") {
                    r.req.limits = true;
                    r.req.kinks = true;
                    r.req.routine = true;
                }
                if (r.name === "Footman") {
                    r.req.name = true;
                    r.req.photo = true;
                    r.req.prefs = true; // Just in case
                }
                // ----------------------------------------------

                return {
                    ...r,
                    icon: ICONS.rank, // Default Icon
                    // Map Tax based on Rank Name (Legacy Logic preservation)
                    tax: r.name === "Hall Boy" ? 20 : (r.name === "Footman" ? 15 : (r.name === "Silverman" ? 10 : (r.name === "Butler" ? 5 : 0)))
                };
            });

            // Reverse array if needed? Backend sends Champion -> Hallboy (Desc). 
            // Frontend usually expects Hallboy -> Champion (Asc) for progress bars.
            // Backend HIERARCHY_RULES is Descending (Champion first).
            // Frontend REWARD_DATA.ranks was Ascending (HallBoy first).
            // WE MUST REVERSE IT!
            REWARD_DATA.ranks.reverse();

            // REFRESH DRAWER IF OPEN (Fix race condition)
            if (window.updateHierarchyDrawer) window.updateHierarchyDrawer();
        }
    }
});

// --- NEW: HIERARCHY DRAWER LOGIC ---
window.updateHierarchyDrawer = function (currentStreak) {
    // 1. Safety Check: Do the elements exist?
    // BLOCK IF EDITING (Fix disappearing overlay)
    if (window.isEditingProfile === true) return;

    const container = document.getElementById('drawer_ProgressContainer');
    // REWARD_DATA is available in local scope
    if (!container || !window.gameStats) return;

    const ranks = REWARD_DATA.ranks;

    // SAFETY CHECK: IF RANKS NOT LOADED YET (Wait for Backend Message)
    if (!ranks || ranks.length === 0) {
        container.innerHTML = '<div style="color:#666; font-size:0.7rem; text-align:center; padding:20px; font-family:"Orbitron";">LOADING HIERARCHY...</div>';
        return;
    }

    // 2. Identify Ranks (Current vs Next)
    // Normalize string to match config (e.g. "Hall Boy" vs "HallBoy")
    const cleanName = (name) => (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");

    // --- GATEKEEPER START (Copied from updateStats) ---
    let currentRaw = userProfile.hierarchy || "Hall Boy";

    // 1. GATEKEEPER: Identity & Photo
    const SILHOUETTE = "ce3e5b_e06c7a2254d848a480eb98107c35e246";
    // Check if name is "Slave" (default) or empty OR photo is missing/silhouette
    if (!userProfile.name || userProfile.name === "Slave" || !userProfile.profilePicture || userProfile.profilePicture.includes(SILHOUETTE)) {
        currentRaw = "Hall Boy";
    }

    // 2. GATEKEEPER: Preferences (Silverman+)
    const dbRankLower = currentRaw.toLowerCase().replace(/[^a-z0-9]/g, "");
    const isAboveFootman = dbRankLower !== "hallboy" && dbRankLower !== "footman";

    if (isAboveFootman) {
        const hasKinks = (userProfile.kinks && userProfile.kinks.length > 2);
        const hasLimits = (userProfile.limits && userProfile.limits.length > 2);

        if (!hasKinks || !hasLimits) {
            currentRaw = "Footman";
        }
    }
    // --- GATEKEEPER END ---

    let currentIdx = ranks.findIndex(r => cleanName(r.name) === cleanName(currentRaw));
    if (currentIdx === -1) currentIdx = 0;

    // Define Targets
    const currentRankObj = ranks[currentIdx];
    // If max rank, stay on current. Otherwise, look at next.
    const isMax = currentIdx >= ranks.length - 1;
    const nextRankObj = isMax ? currentRankObj : ranks[currentIdx + 1];

    // 3. Update Text Headers
    const elCurrentName = document.getElementById('drawer_CurrentRank');
    const elCurrentBen = document.getElementById('drawer_CurrentBenefits');
    const elNextName = document.getElementById('drawer_NextRank');
    const elNextBenList = document.getElementById('drawer_NextBenefits');

    if (elCurrentName) elCurrentName.innerText = currentRankObj.name;
    if (elCurrentBen) {
        elCurrentBen.innerHTML = currentRankObj.benefits.map(b => `<div style="margin-bottom:4px;">${b}</div>`).join('');
    }

    if (elNextName) {
        elNextName.innerText = isMax ? "MAXIMUM RANK" : nextRankObj.name;
        elNextName.style.color = isMax ? "#c5a059" : "#c5a059"; // Gold
    }

    if (elNextBenList) {
        if (isMax) {
            elNextBenList.innerHTML = "<li>You have reached the apex of servitude.</li>";
        } else {
            elNextBenList.innerHTML = nextRankObj.benefits.map(b => `<li>${b}</li>`).join('');
        }
    }

    // 4. Calculate Stats (Consolidated)
    const stats = {
        tasks: gameStats.taskdom_completed || 0,
        kneels: gameStats.kneelCount || 0,
        points: gameStats.points || 0,
        spent: gameStats.total_coins_spent || 0,
        // Use the passed streak or fallback
        streak: currentStreak || 0
    };

    // 5. Build Progress Bars (The "Green Bar" Logic)
    const req = nextRankObj.req; // Requirements for NEXT rank

    // Helper to generate HTML for one bar
    const buildBar = (label, current, target, icon) => {
        if (isMax) target = current; // If max, bar is full
        if (target <= 0) target = 1; // Prevent divide by zero

        const pct = Math.min((current / target) * 100, 100);
        const isDone = current >= target;

        // Colors: Green (#00ff00) if done, Gold (#c5a059) if in progress
        const color = isDone ? "#00ff00" : "#c5a059";
        const labelColor = isDone ? "#fff" : "#888";
        const valColor = isDone ? "#00ff00" : "#c5a059";

        return `
        <div style="margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; font-size:0.65rem; font-family:'Orbitron'; margin-bottom:4px; color:${labelColor};">
                <span>${icon} ${label}</span>
                <span style="color:${valColor}">${current.toLocaleString()} / ${target.toLocaleString()}</span>
            </div>
            <div style="width:100%; height:6px; background:#000; border:1px solid #333; border-radius:3px; overflow:hidden;">
                <div style="width:${pct}%; height:100%; background:${color}; box-shadow:0 0 10px ${color}40; transition: width 0.5s ease;"></div>
            </div>
        </div>`;
    };

    const buildCheck = (label, isMet, iconSvg, type) => {
        const statusColor = isMet ? "#00ff00" : "#ff4444";
        const statusText = isMet ? "VERIFIED" : "MISSING";
        const iconColor = isMet ? "#00ff00" : "#888"; // Grey if missing, Green if done

        // USER APP: ADD BUTTONS ARE REQUIRED
        let actionBtn = "";
        if (!isMet && !isMax) {
            actionBtn = `<span onclick="window.openDataEntry('${type}')" style="cursor:pointer; color:#ffd700; font-size:0.6rem; border:1px solid #ffd700; padding:2px 6px; border-radius:4px; margin-left:8px;">ADD</span>`;
        }

        return `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; font-family:'Orbitron'; font-size:0.65rem; border-bottom:1px solid #222; padding-bottom:4px;">
            <div style="display:flex; align-items:center; color:${iconColor};">
                <div style="width:16px; height:16px; fill:${iconColor}; margin-right:8px;">${iconSvg}</div>
                <span>${label}</span>
            </div>
            <div style="display:flex; align-items:center;">
                <span style="color:${statusColor}; letter-spacing:1px;">${statusText} ${isMet ? '✅' : '❌'}</span>
                ${actionBtn}
            </div>
        </div>`;
    };

    // SVGs
    const SVG_ID = '<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
    const SVG_PHOTO = '<svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';
    const SVG_LIMITS = '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
    const SVG_KINKS = '<svg viewBox="0 0 24 24"><path d="M10.59 13.41c.41.39.41 1.03 0 1.42-.39.41-1.03.41-1.42 0a5.003 5.003 0 0 1 0-7.07l3.54-3.54a5.003 5.003 0 0 1 7.07 0 5.003 5.003 0 0 1 0 7.07l-1.49 1.49c.01-.82-.12-1.64-.4-2.42l.47-.48a2.982 2.982 0 0 0 0-4.24 2.982 2.982 0 0 0-4.24 0l-3.53 3.53a2.982 2.982 0 0 0 0 4.24zm2.82-4.24c.39-.41 1.03-.41 1.42 0a5.003 5.003 0 0 1 0 7.07l-3.54 3.54a5.003 5.003 0 0 1-7.07 0 5.003 5.003 0 0 1 0-7.07l1.49-1.49c-.01.82.12 1.64.4 2.43l-.47.47a2.982 2.982 0 0 0 0 4.24 2.982 2.982 0 0 0 4.24 0l3.53-3.53a2.982 2.982 0 0 0 0-4.24.973.973 0 0 1 0-1.42z"/></svg>';

    let html = `<div style="font-size:0.55rem; color:#666; margin-bottom:10px; font-family:'Orbitron'; letter-spacing:1px;">PROMOTION REQUIREMENTS</div>`;

    // Identity Checks (Footman+)
    if (req.name) {
        // Name must exist and NOT be "Slave" or "New Slave" (Case Insensitive)
        const name = (userProfile.name || userProfile.title || "").trim().toUpperCase();
        const hasName = (name.length > 0 && name !== "SLAVE" && name !== "NEW SLAVE");
        html += buildCheck("IDENTITY", hasName, SVG_ID, 'name');
    }
    if (req.photo) {
        // Check RAW image. Must exist AND not be the default silhouette.
        let raw = userProfile.rawImage;
        // Fallback: If raw is missing but profilePicture is CUSTOM (not default), use that
        if (!raw && userProfile.profilePicture && !userProfile.profilePicture.includes('ce3e5b_e06c7a')) {
            raw = userProfile.profilePicture;
        }

        const hasPhoto = (raw && raw.length > 5 && !raw.includes('ce3e5b_e06c7a'));

        html += buildCheck("PHOTO", hasPhoto, SVG_PHOTO, 'photo');
    }

    // Preference Checks (Silverman+)
    if (req.limits) {
        const hasLimits = (userProfile.limits && userProfile.limits.length > 2);
        html += buildCheck("LIMITS", hasLimits, SVG_LIMITS, 'limits');
    }
    if (req.kinks) {
        const hasKinks = ((userProfile.kinks && userProfile.kinks.length > 2) || (userProfile.kink && userProfile.kink.length > 2));
        html += buildCheck("KINKS", hasKinks, SVG_KINKS, 'kinks');
    }

    if (req.routine) {
        // Check if routine is set (length > 5)
        const hasRoutine = (userProfile.routine && userProfile.routine.length > 5);
        // Using ID SVG as placeholder for Routine/Order
        html += buildCheck("ROUTINE", hasRoutine, SVG_ID, 'routine');
    }

    // BARS (Conditional)
    html += buildBar("LABOR", stats.tasks, req.tasks, "🛠️");
    html += buildBar("ENDURANCE", stats.kneels, req.kneels, "🧎");
    html += buildBar("MERIT", stats.points, req.points, "✨");

    if (req.spent > 0) {
        html += buildBar("SACRIFICE", stats.spent, req.spent, "💰");
    }

    if (req.streak > 0) {
        html += buildBar("CONSISTENCY", stats.streak, req.streak, "🔥");
    }

    // DEBUG INFO REMOVED

    container.innerHTML = html + `<div id="inlineDataEntry" style="margin-top:15px; border-top:1px solid #333; padding-top:10px; display:none;"></div>`;
};


// --- INLINE DATA ENTRY (Jailed in Slave Stats Drawer) ---
window.isEditingProfile = false;

// --- INLINE DATA ENTRY (Jailed in Slave Stats Drawer) ---
window.openDataEntry = function (type) {
    const container = document.getElementById('drawer_ProgressContainer');
    if (!container) return;

    window.isEditingProfile = true; // LOCK UPDATE

    // LUXURY STYLES (Gold & Black, Elegant Fonts)
    const btnStyle = "background:#c5a059; color:#000; border:1px solid #c5a059; padding:12px; font-family:'Cinzel', serif; letter-spacing:1px; font-size:0.9rem; font-weight:bold; cursor:pointer; width:100%; margin-top:15px; text-transform:uppercase; transition:all 0.3s; box-shadow:0 4px 15px rgba(197, 160, 89, 0.2);";
    const backStyle = "background:transparent; color:#666; border:none; padding:10px; font-family:'Cinzel', serif; font-size:0.8rem; cursor:pointer; width:100%; margin-top:5px; transition:all 0.2s; text-decoration:underline;";
    const inputStyle = "width:100%; background:rgba(255,255,255,0.05); color:#fff; border:1px solid #333; border-bottom:1px solid #c5a059; padding:12px; font-family:'Cinzel', serif; font-size:1rem; margin-bottom:15px; outline:none;";
    const labelStyle = "color:#888; font-family:'Cinzel', serif; font-size:0.7rem; letter-spacing:1px; margin-bottom:5px; text-transform:uppercase;";
    const headerStyle = "color:#c5a059; font-family:'Cinzel', serif; font-size:1.2rem; text-align:center; margin-bottom:25px; border-bottom:1px solid #333; padding-bottom:10px;";
    const costStyle = "color:#c5a059; font-family:'Cinzel', serif; font-size:0.9rem; text-align:center; margin-top:15px; padding:10px; border-top:1px solid rgba(255,255,255,0.1);";

    let contentHtml = '';
    let baseCost = 0;
    let itemCost = 0;

    if (type === 'name') baseCost = 100;
    if (type === 'photo') baseCost = 200;
    if (type === 'kinks') itemCost = 100;
    if (type === 'limits') itemCost = 200;

    // Helper for Kink/Limit Chips (Vertical List)
    const renderChips = (dataType) => {
        const list = (typeof KINK_LIST !== 'undefined') ? KINK_LIST : ["JOI", "Humiliation", "Control", "Chastity", "Pain", "Service"];
        let chipsHtml = `<div id="chipContainer" style="display:flex; flex-direction:column; gap:8px; max-height:300px; overflow-y:auto; padding-right:5px; margin-bottom:15px;">`;
        list.forEach(item => {
            chipsHtml += `
                <div class="kink-chip" 
                     onclick="window.toggleChip(this, ${itemCost})" 
                     data-value="${item}"
                     style="width:100%; padding:12px; border:1px solid #333; background:rgba(0,0,0,0.6); font-size:0.9rem; font-family:'Cinzel', serif; color:#aaa; cursor:pointer; transition:all 0.2s; display:flex; justify-content:space-between; align-items:center;">
                    <span>${item}</span>
                    <span class="cost-badge" style="font-size:0.7rem; color:#666;">${itemCost}</span>
                </div>`;
        });
        chipsHtml += `</div><style>#chipContainer::-webkit-scrollbar{display:none;} .kink-chip.selected{border-color:#c5a059; color:#c5a059; background:rgba(197,160,89,0.1);}</style>`;
        return chipsHtml;
    };

    if (type === 'name') {
        contentHtml = `
            <div style="${headerStyle}">Identity Protocol</div>
            <div style="text-align:left;">
                <div style="${labelStyle}">Designation</div>
                <input type="text" id="inlineNameInput" placeholder="Enter Name..." style="${inputStyle}">
            </div>
            <div id="costDisplay" style="${costStyle}">Cost: ${baseCost} Coins</div>
            <button id="actionBtn" onclick="window.saveInlineData('name')" style="${btnStyle}">Confirm Identity</button>
        `;
    } else if (type === 'photo') {
        contentHtml = `
            <div style="${headerStyle}">Visual Verification</div>
            <div style="text-align:center; margin-bottom:15px;">
                <input type="file" id="inlinePhotoUpload" accept="image/*" style="display:none;" onchange="window.previewInlinePhoto(this)">
                <label for="inlinePhotoUpload" style="display:block; padding:20px; border:1px dashed #444; color:#888; font-family:'Cinzel', serif; cursor:pointer; background:rgba(0,0,0,0.3); transition:all 0.2s;" onmouseover="this.style.borderColor='#c5a059';this.style.color='#c5a059'" onmouseout="this.style.borderColor='#444';this.style.color='#888'">
                    CLICK TO SELECT IMAGE
                </label>
                <div id="inlinePhotoPreview" style="width:120px; height:120px; margin:20px auto; border-radius:50%; background:#111; background-size:cover; background-position:center; display:none; border:2px solid #c5a059; box-shadow:0 0 20px rgba(197,160,89,0.2);"></div>
            </div>
            <div id="costDisplay" style="${costStyle}">Cost: ${baseCost} Coins</div>
            <button id="actionBtn" onclick="window.saveInlineData('photo')" style="${btnStyle}">Upload Verification</button>
        `;
    } else if (type === 'limits') {
        contentHtml = `
            <div style="${headerStyle}">Hard Limits</div>
            ${renderChips('limits')}
            <div id="costDisplay" style="${costStyle}">Total Cost: 0 Coins</div>
            <button id="actionBtn" onclick="window.saveInlineData('limits')" style="${btnStyle}">Update Limits</button>
        `;
    } else if (type === 'kinks') {
        contentHtml = `
            <div style="${headerStyle}">Desired Protocols</div>
            ${renderChips('kinks')}
            <div id="costDisplay" style="${costStyle}">Total Cost: 0 Coins</div>
            <button id="actionBtn" onclick="window.saveInlineData('kinks')" style="${btnStyle}">Update Desires</button>
        `;
    }

    container.innerHTML = `
        <div style="padding:20px; border:1px solid #c5a059; background:#050505; box-shadow:0 0 50px rgba(0,0,0,1); position:relative;">
             ${contentHtml}
            <button onclick="window.closeDataEntry()" style="${backStyle}">Return</button>
        </div>
    `;
};

window.toggleChip = function (el, costPerItem) {
    el.classList.toggle('selected');
    // Recalc Total
    const count = document.querySelectorAll('.kink-chip.selected').length;
    const total = count * costPerItem;
    // Update Display Only
    const display = document.getElementById('costDisplay');
    if (display) display.innerText = `TOTAL COST: ${total} COINS`;
};

window.closeDataEntry = function () {
    window.isEditingProfile = false; // RELEASE LOCK
    // Restore the view
    if (window.updateHierarchyDrawer && window.gameStats) {
        window.updateHierarchyDrawer(window.gameStats.taskdom_streak || 0);
    }
};

// --- NEW HELPER: PHOTO PREVIEW ---
window.previewInlinePhoto = function (input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const preview = document.getElementById('inlinePhotoPreview');
            if (preview) {
                preview.style.display = 'block';
                preview.style.backgroundImage = `url(${e.target.result})`;
            }
        }
        reader.readAsDataURL(input.files[0]);
    }
};

window.saveInlineData = async function (type) {
    const btn = document.getElementById('actionBtn');
    if (btn) btn.innerText = "PROCESSING...";

    let payload = {};

    if (type === 'name') {
        const val = document.getElementById('inlineNameInput').value;
        if (!val) { if (btn) btn.innerText = "CONFIRM IDENTITY"; return; }
        // FIX: Backend expects 'name', not 'value'
        payload = { name: val, cost: 100 };
    }

    if (type === 'photo') {
        const fileInput = document.getElementById('inlinePhotoUpload');
        if (!fileInput || !fileInput.files || !fileInput.files[0]) {
            alert("Please select a photo first.");
            if (btn) btn.innerText = "SUBMIT VERIFICATION";
            return;
        }

        try {
            if (btn) btn.innerText = "UPLOADING...";
            const file = fileInput.files[0];
            const folder = (userProfile.name || "slave").replace(/[^a-z0-9-_]/gi, "_").toLowerCase();
            const url = await uploadToBytescale("profile", file, folder);

            if (url === "failed") throw new Error("API returned failed");

            console.log("Uploaded URL:", url);
            // FIX: Backend expects 'photo', not 'value'
            payload = { photo: url, cost: 200 };
        } catch (err) {
            console.error("Upload Error:", err);
            alert("Upload Failed. Please try again.");
            if (btn) btn.innerText = "SUBMIT VERIFICATION";
            return;
        }
    }

    if (type === 'kinks') {
        const selected = Array.from(document.querySelectorAll('.kink-chip.selected')).map(el => el.getAttribute('data-value'));
        if (selected.length < 3) {
            alert("Please select at least 3 items.");
            if (btn) btn.innerText = "SUBMIT";
            return;
        }
        // FIX: Backend expects 'kinks'
        payload = { kinks: selected, cost: selected.length * 100 };
    }

    if (type === 'limits') {
        const selected = Array.from(document.querySelectorAll('.kink-chip.selected')).map(el => el.getAttribute('data-value'));
        if (selected.length < 3) {
            alert("Please select at least 3 items.");
            if (btn) btn.innerText = "SUBMIT";
            return;
        }
        // FIX: Backend expects 'limits'
        payload = { limits: selected, cost: selected.length * 200 };
    }

    // SEND TO WIX (BRIDGE)
    window.parent.postMessage({ type: "UPDATE_PROFILE", payload }, "*");

    // Fallback UI reset
    setTimeout(() => {
        window.closeDataEntry();
        // Optimistic Update
        if (type === 'photo') {
            userProfile.rawImage = payload.photo;
            // Force update ALL profile images in DOM
            const imgs = document.querySelectorAll('img[src*="wixstatic"], .halo-ring, #deskProfilePic, #mobProfilePic');
            imgs.forEach(img => {
                if (img.tagName === 'IMG') img.src = payload.photo;
                else img.style.backgroundImage = `url(${payload.photo})`;
            });
        }
        if (type === 'name') userProfile.name = payload.name;

        if (window.updateHierarchyDrawer) window.updateHierarchyDrawer();
    }, 1000);
};

// --- NEW: DESKTOP RECORD RENDERER ---
let isRenderPending = false;
window.renderDesktopRecord = function () {
    // PREVENT BLINKING: Debounce 3-second triggers
    if (isRenderPending) return;

    // If called, wait a moment to see if other calls come in, then render once
    isRenderPending = true;
    requestAnimationFrame(() => {
        if (window.renderGallery) window.renderGallery();
        isRenderPending = false;
    });
};

window.renderRewards = function () {
    // 1. GET DATA
    const currentRank = (userProfile?.hierarchy || "Hall Boy").toUpperCase();
    const totalTasks = gameStats.taskdom_completed || 0;
    const totalKneels = gameStats.kneelCount || 0;
    const totalSpent = gameStats.total_coins_spent || 0;

    // ============================================================
    // PART A: DAILY DISCIPLINE (The Streak)
    // ============================================================
    let streakCount = 0;
    let routinePhotos = [];

    // 1. DATA SOURCE: Prefer specific history, fallback to gallery
    let rawHistory = userProfile.routineHistory || userProfile.routinehistory;

    if (rawHistory) {
        if (typeof rawHistory === 'string') {
            try { routinePhotos = JSON.parse(rawHistory); } catch (e) { routinePhotos = []; }
        } else if (Array.isArray(rawHistory)) {
            routinePhotos = rawHistory;
        }
    }
    else if (typeof galleryData !== 'undefined' && Array.isArray(galleryData)) {
        routinePhotos = galleryData.filter(item => (item.category || "").toLowerCase() === 'routine');
    }

    // 2. SORT (Newest First)
    routinePhotos.sort((a, b) => {
        const dateA = new Date(a.date || a._createdDate || a);
        const dateB = new Date(b.date || b._createdDate || b);
        return dateB - dateA;
    });

    // 3. CALCULATE STREAK (6 AM Rule)
    if (routinePhotos.length > 0) {
        const getDutyDay = (d) => {
            let date = new Date(d);
            if (date.getHours() < 6) date.setDate(date.getDate() - 1);
            return date.toISOString().split('T')[0];
        };

        const todayCode = getDutyDay(new Date());
        const newestDate = routinePhotos[0].date || routinePhotos[0]._createdDate || routinePhotos[0];
        const lastCode = getDutyDay(newestDate);

        const d1 = new Date(todayCode);
        const d2 = new Date(lastCode);
        const diffDays = (d1 - d2) / (1000 * 60 * 60 * 24);

        if (diffDays <= 1) {
            streakCount = 1;
            let currentCode = lastCode;

            for (let i = 1; i < routinePhotos.length; i++) {
                const itemDate = routinePhotos[i].date || routinePhotos[i]._createdDate || routinePhotos[i];
                const nextCode = getDutyDay(itemDate);
                if (nextCode === currentCode) continue;

                const dayA = new Date(currentCode);
                const dayB = new Date(nextCode);
                const gap = (dayA - dayB) / (1000 * 60 * 60 * 24);

                if (gap === 1) {
                    streakCount++;
                    currentCode = nextCode;
                } else {
                    break;
                }
            }
        }
    }

    // 4. RENDER ROUTINE UI
    const strVal = document.getElementById('dispStreakVal');
    const strBest = document.getElementById('dispBestStreak');
    const strShelf = document.getElementById('shelfRoutine');

    if (strVal) {
        strVal.innerText = streakCount;
        strVal.style.color = "#c5a059";
        if (strVal.parentElement) {
            strVal.parentElement.style.borderColor = "#c5a059";
            strVal.parentElement.style.background = "linear-gradient(180deg, #1a1a1a 0%, #000 100%)";
        }
    }

    if (strBest) strBest.innerText = Math.max(streakCount, gameStats.bestRoutineStreak || 0);

    if (strShelf) {
        if (routinePhotos.length === 0) {
            strShelf.innerHTML = `< div style = "color:#666; font-family:'Cinzel'; font-size:0.6rem; padding:10px; letter-spacing:1px;" > SUBMISSION REQUIRED</div > `;
        } else {
            strShelf.innerHTML = routinePhotos.slice(0, 10).map(item => {
                let rawSrc = (typeof item === 'object') ? (item.proof || item.url || item.image) : item;
                if (!rawSrc) return "";

                // WIX URL FIXER
                let thumb = rawSrc;
                if (rawSrc.startsWith('wix:image')) {
                    try {
                        const id = rawSrc.split('/')[3].split('#')[0];
                        thumb = `https://static.wixstatic.com/media/${id}/v1/fill/w_150,h_150,q_70/thumb.jpg`;
                    } catch (e) { }
                }

                return `<img src="${thumb}" style="width:90px; height:90px; object-fit:cover; border:1px solid #444; border-radius:2px; flex-shrink:0; margin-right:8px; filter:sepia(20%) brightness(0.9);">`;
            }).join('');
        }
    }

    // ============================================================
    // PART B: HIERARCHY PODIUM (Past / Present / Future)
    // ============================================================
    const shelfRank = document.getElementById('shelfRanks');
    if (shelfRank) {
        // --- ROBUST MATCHING (Fixes "Hall Boy" vs "HallBoy" vs "Newbie") ---
        const clean = (s) => (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        const userClean = clean(userProfile?.hierarchy || "Hall Boy");

        let currentIdx = REWARD_DATA.ranks.findIndex(r => clean(r.name) === userClean);

        // [REMOVED OPTIMISTIC PROMOTION LOGIC]
        // The Backend now strictly controls hierarchy. We trust userProfile.hierarchy.

        // 4. MOBILE UPDATE (The New Connection)

        // 4. MOBILE UPDATE (The New Connection)
        if (window.updateHierarchyDrawer) window.updateHierarchyDrawer(streakCount);

        // Final Safety: Default to 0
        if (currentIdx === -1) currentIdx = 0;

        let html = "";

        // 1. PREVIOUS (Small, Dim)
        if (currentIdx > 0) {
            const prev = REWARD_DATA.ranks[currentIdx - 1];
            html += `
            <div class="reward-badge shape-hex unlocked" style="transform:scale(0.8); opacity:0.5; filter:grayscale(100%); margin:0 5px;"
                 onclick="window.openHierarchyCard('${prev.name}', ${streakCount})">
                <div class="rb-inner">
                    <svg class="rb-icon" viewBox="0 0 24 24"><path d="${prev.icon}"/></svg>
                    <div class="rb-label">${prev.name}</div>
                </div>
            </div>`;
        }

        // 2. CURRENT (Big, Gold)
        const curr = REWARD_DATA.ranks[currentIdx];
        html += `
        <div class="reward-badge shape-hex unlocked" style="transform:scale(1.2); z-index:10; border-color:#c5a059; box-shadow:0 0 25px rgba(197, 160, 89, 0.25); margin:0 10px;"
             onclick="window.openHierarchyCard('${curr.name}', ${streakCount})">
            <div class="rb-inner">
                <svg class="rb-icon" viewBox="0 0 24 24" style="fill:#c5a059;"><path d="${curr.icon}"/></svg>
                <div class="rb-label" style="color:#fff; text-shadow:0 0 5px #c5a059;">${curr.name}</div>
            </div>
        </div>`;

        // 3. NEXT (Small, Locked)
        if (currentIdx < REWARD_DATA.ranks.length - 1) {
            const next = REWARD_DATA.ranks[currentIdx + 1];
            html += `
            <div class="reward-badge shape-hex locked" style="transform:scale(0.8); opacity:0.8; margin:0 5px;"
                 onclick="window.openHierarchyCard('${next.name}', ${streakCount})">
                <div class="rb-inner">
                    <div style="font-size:1.2rem; margin-bottom:5px;">🔒</div>
                    <div class="rb-label">${next.name}</div>
                </div>
            </div>`;
        }

        shelfRank.innerHTML = html;
        shelfRank.style.justifyContent = "center";
        shelfRank.style.overflow = "visible";
    }

    // ============================================================
    // PART C: STANDARD SHELVES (Tasks, Kneel, Spend)
    // ============================================================
    const buildShelf = (containerId, data, shapeClass, checkFn, currentVal, typeLabel) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = data.map((item, index) => {
            const targetVal = item.limit;
            const isUnlocked = currentVal >= targetVal;
            const statusClass = isUnlocked ? "unlocked" : "locked";
            const isLegendary = index === data.length - 1 ? "legendary" : "";

            return `
                <div class="reward-badge ${shapeClass} ${statusClass} ${isLegendary}" 
                     onclick="window.openRewardCard('${item.name}', '${item.icon}', ${currentVal}, ${targetVal}, '${typeLabel}')">
                    <div class="rb-inner" style="display:flex; flex-direction:column; align-items:center;">
                        <svg class="rb-icon" viewBox="0 0 24 24"><path d="${item.icon}"/></svg>
                        <div class="rb-label">${item.name}</div>
                    </div>
                </div>
            `;
        }).join('');
    };

    // Ensure arrays exist before mapping
    if (REWARD_DATA.tasks) buildShelf('shelfTasks', REWARD_DATA.tasks, 'shape-chip', null, totalTasks, 'task');
    if (REWARD_DATA.kneeling) buildShelf('shelfKneel', REWARD_DATA.kneeling, 'shape-circle', null, totalKneels, 'kneel');
    if (REWARD_DATA.spending) buildShelf('shelfSpend', REWARD_DATA.spending, 'shape-diamond', null, totalSpent, 'spend');
};

window.openRewardCard = function (name, iconPath, current, target, type) {
    // FIX: Look specifically inside the Trophy Jail
    const overlay = document.querySelector('#trophySectionJail #rewardCardOverlay');
    if (!overlay) return;

    const container = overlay.querySelector('.mob-reward-card');

    // Logic
    const isUnlocked = current >= target;
    const percentage = Math.min((current / target) * 100, 100);

    // Get Quote Helper
    const getQuote = (t, unlock) => {
        if (unlock) return "Accepted. You may continue.";
        return "You are not there yet. Suffer more.";
    };

    // Inject HTML
    container.innerHTML = `
        <div class="rc-header">
            <div class="rc-icon-large"><svg viewBox="0 0 24 24"><path d="${iconPath}"/></svg></div>
            <div class="rc-meta">
                <div class="rc-title">${name}</div>
                <div class="rc-status" style="color:${isUnlocked ? '#00ff00' : '#666'}">${isUnlocked ? "ACQUIRED" : "LOCKED"}</div>
            </div>
        </div>
        <div class="rc-quote">${getQuote(type, isUnlocked)}</div>
        <div class="rc-progress-wrap">
            <div class="rc-progress-labels"><span id="rcCurrent">${current.toLocaleString()}</span><span id="rcTarget">/ ${target.toLocaleString()}</span></div>
            <div class="rc-track"><div class="rc-fill" style="width:${percentage}%"></div></div>
        </div>
        <button class="mob-action-btn" onclick="window.closeRewardCard()">ACKNOWLEDGE</button>
    `;

    // Remove old classes just in case
    container.classList.remove('unlocked-mode');
    if (isUnlocked) container.classList.add('unlocked-mode');

    overlay.classList.remove('hidden');
};

window.closeRewardCard = function () {
    // Target the specific jailed overlay
    const overlay = document.querySelector('#trophySectionJail #rewardCardOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
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
// 1. TOGGLE: Opens the menu and immediately loads the grid
window.toggleTributeHunt = function () {
    // Detect environment
    const isMobile = window.innerWidth <= 768;
    const root = isMobile ? document.getElementById('MOBILE_APP') : document.getElementById('DESKTOP_APP');

    // Find the specific overlay inside the active root
    const overlay = root.querySelector('#tributeHuntOverlay');

    if (!overlay) return;

    if (overlay.classList.contains('hidden')) {
        overlay.classList.remove('hidden');
        renderSimpleStore(root); // Load items immediately
    } else {
        overlay.classList.add('hidden');
    }
};

// 2. RENDER: Loops through wishlist and makes simple buttons
window.renderSimpleStore = function (rootElement) {
    const grid = rootElement.querySelector('#huntStoreGrid');
    if (!grid) return;

    grid.innerHTML = ""; // Clear old stuff

    // Use global wishlist data
    const items = window.WISHLIST_ITEMS || [];

    if (items.length === 0) {
        grid.innerHTML = "<div style='color:#666; width:200%; text-align:center;'>NO ITEMS LOADED</div>";
        return;
    }

    items.forEach(item => {
        // Create the card
        const card = document.createElement('div');
        card.className = "store-item"; // Reuse your existing CSS class
        card.style.cursor = "pointer";
        card.onclick = () => window.quickBuyItem(item); // Click to buy

        card.innerHTML = `
            <img src="${item.img || item.image}" style="width:100%; height:100px; object-fit:cover; opacity:0.8;">
            <div style="padding:10px; text-align:center;">
                <div style="color:#c5a059; font-family:'Orbitron'; font-weight:bold;">${item.price}</div>
                <div style="color:#ccc; font-size:0.7rem; font-family:'Cinzel'; margin-top:5px;">${item.name.toUpperCase()}</div>
            </div>
        `;
        grid.appendChild(card);
    });
};

// 3. BUY: Instant purchase logic
window.quickBuyItem = function (item) {
    // Check Money
    if (window.gameStats.coins < item.price) {
        triggerSound('sfx-deny');
        window.triggerPoverty(); // Your existing poverty popup
        return;
    }

    // Success Sound
    triggerSound('sfx-buy');

    // Send to Backend
    // Send to Backend
    window.parent.postMessage({
        type: "PURCHASE_ITEM",
        itemName: item.name,
        cost: item.price,
        itemImage: item.img || item.image, // Pass the image
        // We still send a text fallback for messageToDom just in case, but real magic is in profile.js
        messageToDom: `🎁 TRIBUTE SENT: ${item.name}`
    }, "*");

    // Visual Feedback (Coin Shower)
    if (window.triggerCoinShower) window.triggerCoinShower();

    // Close Menu
    window.toggleTributeHunt();

    // Optional: Show Green Notification
    if (window.showSystemNotification) window.showSystemNotification("TRIBUTE SENT", item.name);
};


function buyRealCoins(amount) { triggerSound('sfx-buy'); window.parent.postMessage({ type: "INITIATE_STRIPE_PAYMENT", amount: amount }, "*"); }
function triggerCoinShower() { for (let i = 0; i < 40; i++) { const coin = document.createElement('div'); coin.className = 'coin-particle'; coin.innerHTML = `<svg style="width:100%; height:100%; fill:gold;"><use href="#icon-coin"></use></svg>`; coin.style.setProperty('--tx', `${Math.random() * 200 - 100}vw`); coin.style.setProperty('--ty', `${-(Math.random() * 80 + 20)}vh`); document.body.appendChild(coin); setTimeout(() => coin.remove(), 2000); } }
function breakGlass(e) { if (e && e.stopPropagation) e.stopPropagation(); const overlay = document.getElementById('specialGlassOverlay'); if (overlay) overlay.classList.remove('active'); window.parent.postMessage({ type: "GLASS_BROKEN" }, "*"); }
function submitSessionRequest() { const checked = document.querySelector('input[name="sessionType"]:checked'); if (!checked) return; window.parent.postMessage({ type: "SESSION_REQUEST", sessionType: checked.value, cost: checked.getAttribute('data-cost') }, "*"); }

// =========================================
// PART 1: MOBILE LOGIC (BRAIN & NAVIGATION)
// =========================================

// 5. STATS EXPANDER (SIMPLE TOGGLE)
window.toggleMobileStats = function () {
    const drawer = document.getElementById('mobStatsContent');
    const arrow = document.getElementById('mobStatsArrow');

    if (drawer) {
        // Toggle the class that handles the animation (CSS)
        drawer.classList.toggle('open');

        // Rotate Arrow
        if (arrow) {
            arrow.innerText = drawer.classList.contains('open') ? "▲" : "▼";
        }
    }
};

// ==========================
// REPLACE window.toggleMobileView WITH THIS VERSION
// ==========================

window.toggleMobileView = function (viewName) {
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
        if (el) el.style.display = 'none';
    });

    if (chatCard) chatCard.style.setProperty('display', 'none', 'important');

    // 4. SHOW TARGET VIEW
    if (viewName === 'home' && home) {
        home.style.display = 'flex';
        if (window.syncMobileDashboard) window.syncMobileDashboard();
        window.parent.postMessage({ type: "LOAD_Q_FEED" }, "*");
    }
    else if (viewName === 'chat') {
        if (chatCard && mobileApp) {
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
        if (window.renderGallery) window.renderGallery();
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
        if (card) {
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
window.openQueenMenu = function () {
    const menu = document.getElementById('queenOverlay');
    if (menu) {
        menu.classList.remove('hidden');
        menu.style.display = 'flex';
        // Force a data refresh so the progress bar updates
        if (window.syncMobileDashboard) window.syncMobileDashboard();
    }
};

window.closeQueenMenu = function () {
    const menu = document.getElementById('queenOverlay');
    if (menu) {
        menu.classList.add('hidden');
        menu.style.display = 'none';
    }
};
// 3. KNEEL BUTTON
window.triggerKneel = function () {
    const sidebar = document.querySelector('.layout-left');
    const realBtn = document.querySelector('.kneel-bar-graphic');

    if (sidebar) sidebar.classList.add('mobile-open');

    if (realBtn) {
        realBtn.style.boxShadow = "0 0 20px var(--neon-red)";
        setTimeout(() => realBtn.style.boxShadow = "", 1000);
    }
};

window.syncMobileDashboard = function () {
    if (!gameStats || !userProfile) return;

    // --- HEADER ---
    const dateEl = document.getElementById('dutyDateDisplay');
    if (dateEl) dateEl.innerText = new Date().toLocaleDateString().toUpperCase();

    // --- 1. PROTOCOL STATUS (6 AM LOCK) ---
    const routineName = userProfile.routine || "NO PROTOCOL";
    const rDisplay = document.getElementById('mobRoutineDisplay');
    if (rDisplay) rDisplay.innerText = routineName.toUpperCase();

    // A. Define the 6 AM Logic
    const check6AmLock = (dateStr) => {
        if (!dateStr) return false;
        const last = new Date(dateStr);
        const now = new Date();

        // Duty Day starts at 6:00 AM
        let dutyStart = new Date();
        dutyStart.setHours(6, 0, 0, 0);

        // If now is 4 AM, the duty day started Yesterday at 6 AM
        if (now < dutyStart) dutyStart.setDate(dutyStart.getDate() - 1);

        // If upload is newer than the duty start, it's DONE.
        return last >= dutyStart;
    };

    // B. Check Status
    const lastDate = userProfile.lastRoutine || userProfile.lastRoutineSubmission;
    // We check the Date OR the local flag (for instant feedback)
    const isDone = check6AmLock(lastDate) || gameStats.routineDoneToday === true;

    const hasRoutine = userProfile.routine && userProfile.routine.trim().length > 0;

    // C. Update UI Elements
    const btnUpload = document.getElementById('btnRoutineUpload');
    const msgTime = document.getElementById('routineTimeMsg'); // "Window Closed"
    const msgDone = document.getElementById('routineDoneMsg'); // "Accepted"

    if (btnUpload) {
        if (!hasRoutine) {
            // Case: No routine assigned
            btnUpload.classList.add('hidden');
            if (msgTime) { msgTime.innerText = "NO PROTOCOL ASSIGNED"; msgTime.classList.remove('hidden'); }
            if (msgDone) msgDone.classList.add('hidden');
        }
        else if (isDone) {
            // Case: DONE -> LOCK BUTTON
            btnUpload.classList.add('hidden'); // Hide button

            if (msgTime) msgTime.classList.add('hidden');

            if (msgDone) {
                // YOUR CUSTOM TEXT
                msgDone.innerHTML = `<span style="color:var(--neon-green)">ACCEPTED.</span><br><span style="color:#666; font-size:0.7rem;">LOCKED UNTIL 06:00</span>`;
                msgDone.classList.remove('hidden');
            }
        }
        else {
            // Case: NOT DONE -> SHOW BUTTON
            btnUpload.classList.remove('hidden');
            btnUpload.disabled = false;

            if (msgTime) msgTime.classList.add('hidden');
            if (msgDone) msgDone.classList.add('hidden');
        }
    }

    // --- 2. LABOR (Task Logic) ---
    const activeRow = document.getElementById('activeTimerRow');
    const isWorking = activeRow && !activeRow.classList.contains('hidden');

    const taskIdle = document.getElementById('dash_TaskIdle');
    const activeCard = document.getElementById('dash_TaskActive');
    const mobTaskText = document.getElementById('mobTaskText');
    const activeTimerRow = document.getElementById('activeTimerRow');
    const idleMessage = document.getElementById('idleMessage');

    if (isWorking) {
        if (taskIdle) taskIdle.classList.add('hidden');
        if (activeCard) activeCard.classList.remove('hidden');
        if (activeTimerRow) activeTimerRow.classList.remove('hidden');
        if (idleMessage) idleMessage.classList.add('hidden');

        if (mobTaskText && typeof currentTask !== 'undefined' && currentTask) {
            mobTaskText.innerHTML = currentTask.instruction || currentTask.text || "AWAITING ORDERS";
        } else if (mobTaskText) {
            const desktopText = document.getElementById('readyText');
            mobTaskText.innerHTML = desktopText ? desktopText.innerHTML : "PROCESSING...";
        }
    } else {
        if (taskIdle) taskIdle.classList.remove('hidden');
        if (activeCard) activeCard.classList.add('hidden');
        if (activeTimerRow) activeTimerRow.classList.add('hidden');
        if (idleMessage) idleMessage.classList.remove('hidden');
    }
};

// --- HANDLE ROUTINE UPLOAD (Immediate Lock) ---
window.handleRoutineUpload = function (input) {
    if (input.files && input.files.length > 0) {

        // 1. Send to Backend
        if (window.handleEvidenceUpload) {
            window.handleEvidenceUpload(input, "Routine");
        }

        // 2. CRITICAL: Update the Timestamp LOCALLY right now
        // This makes the "6 AM Logic" see it as Done immediately
        const now = new Date().toISOString();

        if (window.userProfile) {
            window.userProfile.lastRoutine = now; // Update main profile memory
            window.userProfile.lastRoutineSubmission = now; // Safety for alternate keys
        }

        if (window.gameStats) {
            gameStats.routineDoneToday = true; // Legacy flag
        }

        // 3. Update the Dashboard (This will run the logic, see the new date, and lock the button)
        if (window.syncMobileDashboard) window.syncMobileDashboard();
    }
};

// ==========================
// EXCHEQUER LOGIC (MOBILE)
// ==========================

window.openExchequer = function () {
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

window.closeExchequer = function () {
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

window.handleMediaPlus = function () {
    // Get Rank (Default to Hall Boy if missing)
    let currentRank = userProfile?.hierarchy || "Hall Boy";

    // Normalize string (Case insensitive check)
    const rankIndex = HIERARCHY_LEVELS.findIndex(r => r.toLowerCase() === currentRank.toLowerCase());
    console.log("Current Rank:", currentRank, "Index:", rankIndex);

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

window.triggerRankMock = function (customTitle) {
    const overlay = document.getElementById('povertyOverlay');
    const title = overlay.querySelector('.mob-reward-title');
    const text = document.getElementById('povertyInsult');
    const stamp = overlay.querySelector('.mob-rank-stamp');

    if (!overlay) return;

    const insult = RANK_INSULTS[Math.floor(Math.random() * RANK_INSULTS.length)];

    if (title) {
        title.innerText = customTitle || "RANK INSUFFICIENT";
        title.style.color = "#888";
    }
    if (text) text.innerText = `"${insult}"`;
    if (stamp) {
        stamp.innerText = "SILENCE";
        stamp.style.borderColor = "#888";
    }

    if (overlay.parentElement !== document.body) document.body.appendChild(overlay);
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';

    if (window.triggerSound) triggerSound('sfx-deny');
};

// 1. GLOBAL VARIABLE (Must be attached to window)
window.isRequestingTask = false;

window.mobileRequestTask = function () {
    // 1. SAFETY CHECK
    if (!window.gameStats) return;

    // 2. POVERTY CHECK (Added parseInt for safety)
    if (parseInt(gameStats.coins || 0) < 300) {
        window.triggerPoverty();
        if (window.triggerSound) triggerSound('sfx-deny');
        return;
    }

    // 3. LOCK THE UI (Stop the interval from resetting it)
    window.isRequestingTask = true;

    // 4. SET "LOADING" STATE UI (Target BOTH Dashboard and Menu)
    // Dashboard IDs
    const dIdle = document.getElementById('dash_TaskIdle');
    const dActive = document.getElementById('dash_TaskActive');
    if (dIdle) dIdle.classList.add('hidden');
    if (dActive) dActive.classList.remove('hidden');

    // Queen Menu IDs (Legacy)
    const qIdle = document.getElementById('qm_TaskIdle');
    const qActive = document.getElementById('qm_TaskActive');
    if (qIdle) qIdle.classList.add('hidden');
    if (qActive) qActive.classList.remove('hidden');

    // Text Pulse
    const txt = document.getElementById('mobTaskText');
    if (txt) {
        txt.innerHTML = "ESTABLISHING LINK...";
        txt.className = "text-pulse";
    }

    // 5. EXECUTE AFTER DELAY
    setTimeout(() => {
        // Generate the task (starts the desktop timer)
        if (window.getRandomTask) window.getRandomTask();

        // Wait a moment for the Desktop DOM to actually update, then unlock
        setTimeout(() => {
            window.isRequestingTask = false;
            if (window.syncMobileDashboard) window.syncMobileDashboard();
        }, 1000); // 1 second buffer
    }, 800);
};

window.mobileUploadEvidence = function (input) {
    if (input.files && input.files.length > 0) {

        // 1. Trigger the Backend Upload
        window.handleEvidenceUpload(input);

        // 2. UI FEEDBACK
        const btn = document.getElementById('mobBtnUpload');
        if (btn) btn.innerText = "SENDING...";

        // 3. SHOW SUCCESS & CLOSE TASK (After 1.5 seconds)
        setTimeout(() => {
            // Show Green Notification
            if (window.showSystemNotification) {
                window.showSystemNotification("EVIDENCE SENT", "STATUS: PENDING REVIEW");
            }

            // RESET UI TO "UNACTIVE"
            window.updateTaskUIState(false);

            // Reset Button Text
            if (btn) btn.innerText = "UPLOAD";

            // Force Mobile Sync
            window.syncMobileDashboard();
        }, 1500);
    }
};

window.mobileSkipTask = function () {
    console.log("Skip Clicked");

    // 1. CHECK FUNDS (Need 300)
    if (parseInt(gameStats.coins || 0) < 300) {
        window.triggerPoverty();
        return;
    }

    // 2. DEDUCT COINS
    gameStats.coins -= 300;
    if (window.updateStats) window.updateStats(); // Refresh headers immediately

    // 3. PLAY SOUND & INSULT
    triggerSound('sfx-deny');

    // 4. SHOW NOTIFICATION
    if (window.showSystemNotification) {
        window.showSystemNotification("Task ABORTED", "PENALTY: 300 coins", true);
    }

    // 5. CANCEL TASK (Backend)
    if (window.cancelPendingTask) window.cancelPendingTask();

    // 6. FORCE UI RESET (Crucial Fix)
    window.updateTaskUIState(false);
    if (window.syncMobileDashboard) window.syncMobileDashboard();
};

// TRIBUTE TO THE "BLINKING" VERSION (Force Refresh Loop)
// The user requested this specifically because it ensures images eventually load.
setInterval(() => {
    if (window.renderGallery) window.renderGallery();
}, 3000);

// TIMER SYNC & VISUALIZATION (UPDATED TO HANDLE ALL IDS)
setInterval(() => {
    // 1. Get Source (Desktop Hidden Elements)
    const desktopH = document.getElementById('timerH');
    const desktopM = document.getElementById('timerM');
    const desktopS = document.getElementById('timerS');

    // 2. Mobile Dashboard Elements (DASH_)
    const dH = document.getElementById('dash_timerH');
    const dM = document.getElementById('dash_timerM');
    const dS = document.getElementById('dash_timerS');

    // 3. Queen Menu Elements (QM_)
    const qH = document.getElementById('qm_timerH');
    const qM = document.getElementById('qm_timerM');
    const qS = document.getElementById('qm_timerS');

    // 4. Update Values
    if (desktopH) {
        const hTxt = desktopH.innerText;
        const mTxt = desktopM.innerText;
        const sTxt = desktopS.innerText;

        // Update Dashboard
        if (dH) { dH.innerText = hTxt; dM.innerText = mTxt; dS.innerText = sTxt; }

        // Update Queen Menu Card
        if (qH) { qH.innerText = hTxt; qM.innerText = mTxt; qS.innerText = sTxt; }

        // Update Rings (Dashboard)
        const hVal = parseInt(hTxt) || 0;
        const mVal = parseInt(mTxt) || 0;
        const sVal = parseInt(sTxt) || 0;

        const ringH = document.getElementById('ring_H');
        const ringM = document.getElementById('ring_M');
        const ringS = document.getElementById('ring_S');

        if (ringH) ringH.style.background = `conic-gradient(#c5a059 ${(hVal / 24) * 360}deg, rgba(197, 160, 89, 0.1) 0deg)`;
        if (ringM) ringM.style.background = `conic-gradient(#c5a059 ${(mVal / 60) * 360}deg, rgba(197, 160, 89, 0.1) 0deg)`;
        if (ringS) ringS.style.background = `conic-gradient(#c5a059 ${(sVal / 60) * 360}deg, rgba(197, 160, 89, 0.1) 0deg)`;
    }

    // --- VISIBILITY SYNC (THE FIX) ---

    // IF WE ARE CURRENTLY REQUESTING A TASK, DO NOT RUN THIS LOGIC
    if (window.isRequestingTask === true) return;

    const activeRow = document.getElementById('activeTimerRow');
    if (!activeRow) return;

    const isWorking = !activeRow.classList.contains('hidden');

    // A. Update Dashboard (dash_ IDs)
    const dashIdle = document.getElementById('dash_TaskIdle');
    const dashActive = document.getElementById('dash_TaskActive');

    if (dashIdle && dashActive) {
        if (isWorking) {
            dashIdle.classList.add('hidden');
            dashActive.classList.remove('hidden');
            const light = document.getElementById('mob_statusLight');
            const text = document.getElementById('mob_statusText');
            if (light) light.className = 'status-light green';
            if (text) text.innerText = "WORKING";
        } else {
            dashIdle.classList.remove('hidden');
            dashActive.classList.add('hidden');
            const light = document.getElementById('mob_statusLight');
            const text = document.getElementById('mob_statusText');
            if (light) light.className = 'status-light red';
            if (text) text.innerText = "UNPRODUCTIVE";
        }
    }

    // B. Update Queen Menu (qm_ IDs)
    const qmIdle = document.getElementById('qm_TaskIdle');
    const qmActive = document.getElementById('qm_TaskActive');

    if (qmIdle && qmActive) {
        if (isWorking) {
            qmIdle.classList.add('hidden');
            qmActive.classList.remove('hidden');
        } else {
            qmIdle.classList.remove('hidden');
            qmActive.classList.add('hidden');
        }
    }
}, 500);

window.parent.postMessage({ type: "LOAD_Q_FEED" }, "*");
window.parent.postMessage({ type: "UI_READY" }, "*");
setTimeout(() => { if (window.renderDesktopRecord) window.renderDesktopRecord(); }, 1000); // Initial Desktop Load

window.toggleMobileChat = function (open) {
    const btn = document.getElementById('btnEnterChatPanel');
    const panel = document.getElementById('inlineChatPanel');
    const scrollBox = document.getElementById('mob_chatBox');

    if (open) {
        btn.classList.add('hidden');       // Hide Button
        panel.classList.remove('hidden');  // Show Chat
        // Auto-scroll to bottom
        if (scrollBox) setTimeout(() => { scrollBox.scrollTop = scrollBox.scrollHeight; }, 50);
    } else {
        btn.classList.remove('hidden');    // Show Button
        panel.classList.add('hidden');     // Hide Chat
    }
};
