// main.js - FIXED: RESTORED UI STATE LOGIC

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

// --- 2. CRITICAL UI FUNCTIONS ---

// Toggle the slide-down panel
window.toggleTaskDetails = function(forceOpen = null) {
    if (window.event) window.event.stopPropagation();

    const panel = document.getElementById('taskDetailPanel');
    const link = document.querySelector('.see-task-link'); 
    const chatBox = document.getElementById('chatBox'); 
    
    if (!panel) return;

    const isOpen = panel.classList.contains('open');
    let shouldOpen;

    if (forceOpen === true) {
        shouldOpen = true;
    } else if (forceOpen === false) {
        shouldOpen = false;
    } else {
        shouldOpen = !isOpen; 
    }

    if (shouldOpen) {
        panel.classList.add('open');
        if(chatBox) chatBox.classList.add('focused-task');
        if(link) {
            link.innerHTML = "▲ HIDE DIRECTIVE ▲";
            link.style.opacity = "1"; 
        }
    } else {
        panel.classList.remove('open');
        if(chatBox) chatBox.classList.remove('focused-task');
        if(link) {
            link.innerHTML = "▼ SEE DIRECTIVE ▼";
            link.style.opacity = "1";
        }
    }
};

// --- THIS WAS MISSING: THE STATE SWITCHER ---
window.updateTaskUIState = function(isActive) {
    // 1. STATUS TEXT (Single Element)
    const statusText = document.getElementById('mainStatusText');

    // 2. CENTER CONTENT
    const idleMsg = document.getElementById('idleMessage');
    const timerRow = document.getElementById('activeTimerRow');

    // 3. BUTTONS
    const reqBtn = document.getElementById('mainButtonsArea');
    const uploadArea = document.getElementById('uploadBtnContainer');

    if (isActive) {
        // --- WORKING ---
        if (statusText) {
            statusText.innerText = "WORKING";
            statusText.className = "status-text-lg status-working";
        }
        if (idleMsg) idleMsg.classList.add('hidden');
        if (timerRow) timerRow.classList.remove('hidden');

        if (reqBtn) reqBtn.classList.add('hidden');
        if (uploadArea) uploadArea.classList.remove('hidden');
        
    } else {
        // --- UNPRODUCTIVE ---
        if (statusText) {
            statusText.innerText = "UNPRODUCTIVE";
            statusText.className = "status-text-lg status-unproductive";
        }
        if (idleMsg) idleMsg.classList.remove('hidden');
        if (timerRow) timerRow.classList.add('hidden');

        if (reqBtn) reqBtn.classList.remove('hidden');
        if (uploadArea) uploadArea.classList.add('hidden');
        
        window.toggleTaskDetails(false);
    }
};

// Global Click Listener (Handles Outside Clicks Only)
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
                sound.play().then(() => {
                    sound.pause();
                    sound.currentTime = 0;
                    sound.volume = originalVolume;
                }).catch(e => console.log("Audio Engine Ready"));
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

        if (data.type === "INIT_TASKS" || data.dailyTasks) setTaskDatabase(data.dailyTasks || data.tasks || []);
        if (data.type === "INIT_WISHLIST" || data.wishlist) {
            setWishlistItems(data.wishlist || []);
            window.WISHLIST_ITEMS = data.wishlist || []; 
            renderWishlist();
        }

        if (data.type === "UPDATE_DOM_STATUS") {
            const badge = document.getElementById('chatStatusBadge');
            const ring = document.getElementById('chatStatusRing');
            const domBadge = document.getElementById('domStatusBadge');
            if(badge) { badge.innerHTML = data.online ? "ONLINE" : data.text; badge.className = data.online ? "chat-status-text chat-online" : "chat-status-text"; }
            if(ring) ring.className = data.online ? "dom-status-ring ring-active" : "dom-status-ring ring-inactive";
            if(domBadge) { domBadge.innerHTML = data.online ? '<span class="status-dot"></span> ONLINE' : `<span class="status-dot"></span> ${data.text}`; domBadge.className = data.online ? "dom-status status-online" : "dom-status"; }
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
                    joined: data.profile.joined
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
                if(data.profile.profilePicture) {
                    const picEl = document.getElementById('profilePic');
                    if(picEl) picEl.src = getOptimizedUrl(data.profile.profilePicture, 150);
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
                    console.log("Gallery data updated from backend.");
                    updateStats();
                }
            }

            if (payload.pendingState !== undefined) {
                if (!taskJustFinished && !ignoreBackendUpdates) {
                    setPendingTaskState(payload.pendingState);
                    if (pendingTaskState) {
                        setCurrentTask(pendingTaskState.task);
                        restorePendingUI();
                        
                        // FIXED: UPDATE UI BUT DO NOT FORCE OPEN DRAWER
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
        if (btn) {
            btn.innerHTML = '...';
            btn.style.background = '#333';
            btn.style.color = '#ffd700'; 
            btn.style.cursor = 'wait';
        }
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
    const subName = document.getElementById('subName');
    const subHierarchy = document.getElementById('subHierarchy');
    const coinsEl = document.getElementById('coins');
    const pointsEl = document.getElementById('points');

    if (!subName || !userProfile || !gameStats) return; 

    subName.textContent = userProfile.name || "Slave";
    if (subHierarchy) subHierarchy.textContent = userProfile.hierarchy || "HallBoy";
    if (coinsEl) coinsEl.textContent = gameStats.coins ?? 0;
    if (pointsEl) pointsEl.textContent = gameStats.points ?? 0;

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val ?? 0; };
    if(gameStats) {
        setVal('statStreak', gameStats.taskdom_streak || gameStats.currentStreak);
        setVal('statTotal', gameStats.taskdom_total_tasks || gameStats.totalTasks);
        setVal('statCompleted', gameStats.taskdom_completed_tasks || gameStats.completedTasks);
        setVal('statSkipped', gameStats.skippedTasks || stats.skippedTasks);
        setVal('statTotalKneels', gameStats.kneelCount || gameStats.totalKneels);
    }

    const sinceEl = document.getElementById('slaveSinceDate');
    if (sinceEl) {
        if (userProfile && userProfile.joined) {
            try { sinceEl.textContent = new Date(userProfile.joined).toLocaleDateString(); } catch(e) { sinceEl.textContent = "--/--/--"; }
        } else {
            sinceEl.textContent = "--/--/--";
        }
    }

    if (typeof LEVELS !== 'undefined' && LEVELS.length > 0) {
        let nextLevel = LEVELS.find(l => l.min > gameStats.points) || LEVELS[LEVELS.length - 1];
        const nln = document.getElementById('nextLevelName');
        const pnd = document.getElementById('pointsNeeded');
        if(nln) nln.innerText = nextLevel.name;
        if(pnd) pnd.innerText = Math.max(0, nextLevel.min - gameStats.points) + " to go";
        
        const prevLevel = [...LEVELS].reverse().find(l => l.min <= gameStats.points) || {min: 0};
        const range = nextLevel.min - prevLevel.min;
        const progress = range > 0 ? ((gameStats.points - prevLevel.min) / range) * 100 : 100;
        const pb = document.getElementById('progressBar');
        if (pb) pb.style.width = Math.min(100, Math.max(0, progress)) + "%";
    }
    updateKneelingStatus(); 
}

// =========================================
// PART 1: BUTTON LOGIC (KEEP THIS)
// =========================================

// 1. PROFILE BUTTON
window.toggleMobileMenu = function() {
    const sidebar = document.querySelector('.layout-left');
    if (sidebar) sidebar.classList.toggle('mobile-open');
};

// 2. KNEEL BUTTON
window.triggerKneel = function() {
    const sidebar = document.querySelector('.layout-left');
    const realBtn = document.querySelector('.kneel-bar-graphic');

    if (sidebar) sidebar.classList.add('mobile-open'); // Open drawer

    if (realBtn) {
        // Highlight logic
        realBtn.style.boxShadow = "0 0 20px var(--neon-red)";
        realBtn.style.borderColor = "var(--neon-red)";
        setTimeout(() => {
            realBtn.style.boxShadow = "";
            realBtn.style.borderColor = "";
        }, 1000);
    }
};

// 3. LOGS BUTTON (With Chat Scroll Fix)
window.toggleMobileView = function(viewName) {
    if (viewName === 'chat') {
        const chatContainer = document.querySelector('.chat-container');
        if (chatContainer) {
            chatContainer.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        // Force scroll to bottom of chat history
        const chatBox = document.getElementById('chatBox');
        if (chatBox) {
            setTimeout(() => { chatBox.scrollTop = chatBox.scrollHeight; }, 300);
        }
    }
    const sidebar = document.querySelector('.layout-left');
    if (sidebar) sidebar.classList.remove('mobile-open');
};

// 4. AUTO-CLOSE DRAWER
document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('.nav-btn');
    const sidebar = document.querySelector('.layout-left');
    if (navLinks && sidebar) {
        navLinks.forEach(btn => {
            btn.addEventListener('click', () => sidebar.classList.remove('mobile-open'));
        });
    }
});


// =========================================
// PART 2: FINAL APP MODE (NATIVE FLOW)
// =========================================

(function() {
    // Only run on Mobile
    if (window.innerWidth > 768) return;

    // 1. LOCK THE FRAME, BUT LET THE CONTENT BREATHE
    function lockVisuals() {
        const height = window.innerHeight;
        
        // A. BODY: FROZEN SOLID
        Object.assign(document.body.style, {
            height: height + 'px',
            width: '100%',
            position: 'fixed',      // Pins the app to the glass
            overflow: 'hidden',     // No body scroll
            inset: '0',
            overscrollBehavior: 'none', // STOPS THE BODY HOP (Modern CSS)
            touchAction: 'none'     // Stops dragging the background
        });

        // B. APP CONTAINER: FROZEN
        const app = document.querySelector('.app-container');
        if (app) Object.assign(app.style, { height: '100%', overflow: 'hidden' });

        // C. CONTENT STAGE: FREE TO MOVE
        const stage = document.querySelector('.content-stage');
        if (stage) {
            Object.assign(stage.style, {
                height: '100%',
                overflowY: 'auto',              // Force Scrollbar
                webkitOverflowScrolling: 'touch', // Native iOS Momentum
                paddingBottom: '100px',
                
                // THE MAGIC COMBO:
                overscrollBehaviorY: 'contain', // Bounces INSIDE, doesn't bounce BODY
                touchAction: 'pan-y'            // Explicitly allows 1-finger scrolling
            });
        }
        
        // D. CHAT: FREE TO MOVE
        const chat = document.querySelector('.chat-body-frame');
        if (chat) {
             Object.assign(chat.style, {
                overscrollBehaviorY: 'contain',
                touchAction: 'pan-y'
            });
        }
    }

    // 2. BUILD FOOTER
    function buildAppFooter() {
        if (document.getElementById('app-mode-footer')) return;
        
        const footer = document.createElement('div');
        footer.id = 'app-mode-footer';
        
        Object.assign(footer.style, {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            position: 'fixed', bottom: '0', left: '0', width: '100%', height: '80px',
            background: 'linear-gradient(to top, #000 40%, rgba(0,0,0,0.95))',
            padding: '0 30px', paddingBottom: 'env(safe-area-inset-bottom)',
            zIndex: '2147483647', borderTop: '1px solid rgba(197, 160, 89, 0.3)',
            backdropFilter: 'blur(10px)', pointerEvents: 'auto', 
            touchAction: 'none' // Footer itself cannot be dragged
        });

        // Stop drags on footer only
        footer.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

        footer.innerHTML = `
            <button onclick="window.toggleMobileMenu()" style="background:none; border:none; color:#666; display:flex; flex-direction:column; align-items:center; gap:4px; font-family:'Cinzel',serif; font-size:0.65rem;">
                <span style="font-size:1.4rem; color:#888;">◈</span>
                <span>PROFILE</span>
            </button>
            <div style="position:relative; top:-20px;">
                <button onclick="window.triggerKneel()" style="width:70px; height:70px; border-radius:50%; background:radial-gradient(circle at 30% 30%, #c5a059, #5a4a22); border:2px solid #fff; box-shadow:0 0 20px rgba(197,160,89,0.6); color:#000; font-family:'Cinzel',serif; font-weight:700; font-size:0.7rem; cursor:pointer;">
                    KNEEL
                </button>
            </div>
            <button onclick="window.toggleMobileView('chat')" style="background:none; border:none; color:#666; display:flex; flex-direction:column; align-items:center; gap:4px; font-family:'Cinzel',serif; font-size:0.65rem;">
                <span style="font-size:1.4rem; color:#888;">❖</span>
                <span>LOGS</span>
            </button>
        `;
        document.body.appendChild(footer);
    }

    // 3. RUN
    window.addEventListener('load', () => { lockVisuals(); buildAppFooter(); });
    window.addEventListener('resize', lockVisuals);
    lockVisuals(); buildAppFooter();
})();
// Tribute logic
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
function finalizeSacrifice() { const noteEl = document.getElementById('huntNote'); const note = noteEl ? noteEl.value.trim() : ""; if (!selectedItem || !selectedReason) return; if (gameStats.coins < selectedItem.price) { triggerSound('sfx-deny'); alert('Insufficient coins!'); return; } const tributeMessage = `💝 TRIBUTE: ${selectedReason}\n🎁 ITEM: ${selectedItem.name}\n💰 COST: ${selectedItem.price}\n💌 "${note || "A silent tribute."}"`; window.parent.postMessage({ type: "PURCHASE_ITEM", itemName: selectedItem.name, cost: selectedItem.price, messageToDom: tributeMessage }, "*"); triggerSound('sfx-buy'); triggerCoinShower(); toggleTributeHunt(); }
function buyRealCoins(amount) { triggerSound('sfx-buy'); window.parent.postMessage({ type: "INITIATE_STRIPE_PAYMENT", amount: amount }, "*"); }
function triggerCoinShower() { for (let i = 0; i < 40; i++) { const coin = document.createElement('div'); coin.className = 'coin-particle'; coin.innerHTML = `<svg style="width:100%; height:100%; fill:gold;"><use href="#icon-coin"></use></svg>`; coin.style.setProperty('--tx', `${Math.random() * 200 - 100}vw`); coin.style.setProperty('--ty', `${-(Math.random() * 80 + 20)}vh`); document.body.appendChild(coin); setTimeout(() => coin.remove(), 2000); } }
function breakGlass(e) { if (e && e.stopPropagation) e.stopPropagation(); const overlay = document.getElementById('specialGlassOverlay'); if (overlay) overlay.classList.remove('active'); window.parent.postMessage({ type: "GLASS_BROKEN" }, "*"); }
function submitSessionRequest() { const checked = document.querySelector('input[name="sessionType"]:checked'); if (!checked) return; window.parent.postMessage({ type: "SESSION_REQUEST", sessionType: checked.value, cost: checked.getAttribute('data-cost') }, "*"); }
function resetTributeFlow() { selectedReason = ""; selectedNote = ""; selectedItem = null; const note = document.getElementById('huntNote'); if (note) note.value = ""; showTributeStep(1); }

window.parent.postMessage({ type: "UI_READY" }, "*");
