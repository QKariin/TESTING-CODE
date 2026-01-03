// --- 1. FULL IMPORTS ---
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
import { renderRewardGrid, runTargetingAnimation } from './reward.js';
import { getOptimizedUrl, SafeStorage, triggerSound, migrateGameStatsToStats, cleanHTML } from './utils.js';
import { switchTab, toggleStats, openSessionUI, closeSessionUI, updateSessionCost, toggleSection, renderDomVideos, renderNews, renderWishlist } from './ui.js';
import { getRandomTask, restorePendingUI, finishTask, cancelPendingTask, resetTaskDisplay } from './tasks.js';
import { renderChat, sendChatMessage, handleChatKey, sendCoins, loadMoreChat, openChatPreview, closeChatPreview, forceBottom } from './chat.js';
import { renderGallery, loadMoreHistory, initModalSwipeDetection, closeModal, toggleHistoryView, openHistoryModal, openModal } from './gallery.js';
import { handleEvidenceUpload, handleProfileUpload, handleAdminUpload } from './uploads.js';
import { handleHoldStart, handleHoldEnd, claimKneelReward, updateKneelingStatus } from './kneeling.js';
import { Bridge } from './bridge.js';
import { scanExisting, observeNewElements } from './bytescale.js';

// --- 2. INITIALIZATION ---
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

Bridge.listen((data) => {
    const ignoreList = ["CHAT_ECHO", "UPDATE_CHAT", "UPDATE_FULL_DATA", "UPDATE_DOM_STATUS", "instantUpdate", "instantReviewSuccess"];
    if (ignoreList.includes(data.type)) return;
    window.postMessage(data, "*"); 
});

// --- 3. THE MESSAGE LISTENER ---
window.addEventListener("message", (event) => {
    const data = event.data;

    if (data.type === "CHAT_ECHO" && data.msgObj) {
        const chatContent = document.getElementById('chatContent');
        if (chatContent) {
            const m = data.msgObj;
            const contentHtml = `<div class="msg m-slave">${m.message}</div>`;
            const timeDiv = `<div class="msg-time">${new Date(m._createdDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`;
            const rowContent = `<div class="msg-col" style="justify-content: flex-end;">${contentHtml} ${timeDiv}</div>`;
            chatContent.innerHTML += `<div class="msg-row mr-out">${rowContent}</div>`;
            forceBottom();
        }
    }

    if (data.type === 'UPDATE_RULES') {
        const rules = data.payload || {};
        for (let i = 1; i <= 8; i++) {
            const el = document.getElementById('r' + i);
            if (el && rules['rule' + i]) el.innerHTML = rules['rule' + i];
        }
    }

    if (data.type === "INIT_TASKS" || data.dailyTasks) setTaskDatabase(data.dailyTasks || data.tasks || []);
    if (data.type === "INIT_WISHLIST" || data.wishlist) {
        const items = data.wishlist || [];
        if (Array.isArray(items) && items.length > 0) {
            setWishlistItems(items);
            window.WISHLIST_ITEMS = items; 
            renderWishlist();
        }
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
            setUserProfile({ name: data.profile.name || "Slave", hierarchy: data.profile.hierarchy || "HallBoy", memberId: data.profile.memberId || "", joined: data.profile.joined });
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
            if(data.profile.profilePicture) document.getElementById('profilePic').src = getOptimizedUrl(data.profile.profilePicture, 150);
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
                } else if (!resetUiTimer) {
                    document.getElementById('cooldownSection').classList.add('hidden');
                    document.getElementById('activeBadge').classList.remove('show');
                    document.getElementById('mainButtonsArea').classList.remove('hidden');
                    document.getElementById('taskContent').innerHTML = `<h2 id="readyText" style="font-weight:bold; margin-bottom:5px; color:white; font-size:1.5rem;">Ready?</h2><p class="rajdhani" style="color:#aaa; margin:0;">Waiting for orders.</p>`;
                }
            }
        }
    }

    if (data.type === "UPDATE_CHAT" || data.chatHistory) renderChat(data.chatHistory || data.messages);
    setTimeout(styleTributeMessages, 100); 

    if (data.type === "FRAGMENT_REVEALED") {
        const { fragmentNumber, day, totalRevealed, isComplete } = data;
        import('./reward.js').then(({ runTargetingAnimation, renderRewardGrid }) => {
            runTargetingAnimation(fragmentNumber, () => {
                renderRewardGrid();
                if (isComplete) triggerSound('coinSound');
            });
        });
    }
});

let sacrificeHoldTimer = null;
let sacrificeHoldPercent = 0;

export function startSacrificeHold() {
    const ring = document.getElementById('sacrificeFill');
    if (!ring) return;

    sacrificeHoldPercent = 0;
    sacrificeHoldTimer = setInterval(() => {
        sacrificeHoldPercent += 2; // Takes 2-3 seconds to fill
        
        // Calculate SVG Dash Offset (Circumference is ~283)
        const offset = 283 - (283 * (sacrificeHoldPercent / 100));
        ring.style.strokeDashoffset = offset;

        if (sacrificeHoldPercent >= 100) {
            clearInterval(sacrificeHoldTimer);
            finalizeSacrifice(); // Trigger the purchase
        }
    }, 40); // Smooth update
}

export function endSacrificeHold() {
    clearInterval(sacrificeHoldTimer);
    const ring = document.getElementById('sacrificeFill');
    if (ring) {
        ring.style.strokeDashoffset = 283; // Reset the ring
    }
}

// Add these to your window global assignments at the bottom of main.js
window.startSacrificeHold = startSacrificeHold;
window.endSacrificeHold = endSacrificeHold;

// --- 4. LOGIC FUNCTIONS ---
function updateStats() {
    const subName = document.getElementById('subName');
    if (!subName || !userProfile || !gameStats) return; 
    subName.textContent = userProfile.name || "Slave";
    document.getElementById('subHierarchy').textContent = userProfile.hierarchy || "HallBoy";
    document.getElementById('coins').textContent = gameStats.coins ?? 0;
    document.getElementById('points').textContent = gameStats.points ?? 0;
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val ?? 0; };
    setVal('statStreak', gameStats.taskdom_streak || gameStats.currentStreak);
    setVal('statTotal', gameStats.taskdom_total_tasks || gameStats.totalTasks);
    setVal('statCompleted', gameStats.taskdom_completed_tasks || gameStats.completedTasks);
    setVal('statSkipped', gameStats.skippedTasks || stats.skippedTasks);
    setVal('statTotalKneels', gameStats.kneelCount || gameStats.totalKneels);
    const sinceEl = document.getElementById('slaveSinceDate');
    if (sinceEl && userProfile.joined) { try { sinceEl.textContent = new Date(userProfile.joined).toLocaleDateString(); } catch(e) { sinceEl.textContent = "--/--/--"; } }
    if (typeof LEVELS !== 'undefined' && LEVELS.length > 0) {
        let nextLevel = LEVELS.find(l => l.min > gameStats.points) || LEVELS[LEVELS.length - 1];
        document.getElementById('nextLevelName').innerText = nextLevel.name;
        document.getElementById('pointsNeeded').innerText = Math.max(0, nextLevel.min - gameStats.points) + " to go";
        const prevLevel = [...LEVELS].reverse().find(l => l.min <= gameStats.points) || {min: 0};
        const range = nextLevel.min - prevLevel.min;
        const progress = range > 0 ? ((gameStats.points - prevLevel.min) / range) * 100 : 100;
        const pb = document.getElementById('progressBar');
        if (pb) pb.style.width = Math.min(100, Math.max(0, progress)) + "%";
    }
    updateKneelingStatus(); 
}

// --- TRIBUTE HUNT LOGIC (ELEGANT MODE) ---
let currentHuntIndex = 0;
let filteredItems = [];
let selectedReason = "";
let selectedItem = null;

export function toggleTributeHunt() {
    const overlay = document.getElementById('tributeHuntOverlay');
    if (overlay.classList.contains('hidden')) {
        selectedReason = ""; selectedItem = null;
        if(document.getElementById('huntNote')) document.getElementById('huntNote').value = "";
        overlay.classList.remove('hidden');
        showHuntStep(1); 
    } else {
        overlay.classList.add('hidden');
    }
}

export function showHuntStep(step) {
    document.querySelectorAll('.hunt-step').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById('huntStep' + step);
    if (target) target.classList.remove('hidden');
    const labels = ["", "INTENTION", "SEARCHING", "THE HUNT", "CONFESSION"];
    const progressEl = document.getElementById('huntProgress');
    if (progressEl) progressEl.innerText = labels[step] || "";
}

export function selectTributeReason(reason) {
    selectedReason = reason;
    renderHuntStore(999999); // SKIP BUDGET STEP
}

export function renderHuntStore(budget) {
    const items = window.WISHLIST_ITEMS || [];
    filteredItems = items.filter(item => Number(item.price || item.Price || 0) <= budget);
    currentHuntIndex = 0;
    if (filteredItems.length === 0) {
        const grid = document.getElementById('huntStoreGrid');
        if(grid) grid.innerHTML = `<div style="text-align:center;"><p style="color:#666;">VAULT EMPTY</p></div>`;
        return;
    }
    showHuntStep(3); 
    showTinderCard();
}

export function showTinderCard() {
    const grid = document.getElementById('huntStoreGrid');
    if (!grid) return;
    const item = filteredItems[currentHuntIndex];
    if (!item) {
        grid.innerHTML = `<div style="text-align:center;"><p style="color:#666;">END OF LIST</p><button class="action-btn" onclick="showHuntStep(1)">RESTART</button></div>`;
        return;
    }
    grid.innerHTML = `
        <div id="tinderCard" class="tinder-card-main">
            <div id="likeLabel" class="swipe-indicator like">SACRIFICE</div>
            <div id="nopeLabel" class="swipe-indicator nope">SKIP</div>
            <img src="${item.img || item.image}" draggable="false">
            <div class="tinder-card-info">
                <div style="color:var(--neon-yellow); font-size:1.8rem; font-weight:900;">${item.price} 🪙</div>
                <div style="color:white; letter-spacing:2px; font-weight:bold; font-size:0.8rem;">${item.name.toUpperCase()}</div>
            </div>
        </div>`;
    initSwipeEvents(document.getElementById('tinderCard'), item);
}

function initSwipeEvents(card, item) {
    let startX = 0; let currentX = 0;
    const handleStart = (e) => { startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX; card.style.transition = 'none'; };
    const handleMove = (e) => {
        if (!startX) return;
        currentX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const diff = currentX - startX;
        card.style.transform = `translateX(${diff}px) rotate(${diff / 15}deg)`;
        const like = document.getElementById('likeLabel'); const nope = document.getElementById('nopeLabel');
        if(like) like.style.opacity = diff > 0 ? Math.min(diff / 100, 1) : 0;
        if(nope) nope.style.opacity = diff < 0 ? Math.min(Math.abs(diff) / 100, 1) : 0;
    };
    const handleEnd = () => {
        const diff = currentX - startX;
        card.style.transition = 'transform 0.4s ease, opacity 0.4s ease';

        if (diff > 100) { // SWIPE RIGHT: SACRIFICE
            card.style.transform = `translateX(600px) rotate(45deg)`;
            selectedItem = item;
            document.getElementById('huntSelectedImg').src = item.img || item.image;
            document.getElementById('huntSelectedName').innerText = item.name.toUpperCase();
            document.getElementById('huntSelectedPrice').innerText = item.price + " 🪙";
            setTimeout(() => { showHuntStep(4); }, 200);
        } else if (diff < -100) { // SWIPE LEFT: SKIP (This is the fix you needed)
            card.style.transform = `translateX(-600px) rotate(-45deg)`;
            card.style.opacity = "0";
            currentHuntIndex++; // Move to next item
            setTimeout(() => { showTinderCard(); }, 300); // Draw the next one
        } else { // RESET
            card.style.transform = `translateX(0) rotate(0)`;
            if(document.getElementById('likeLabel')) document.getElementById('likeLabel').style.opacity = 0;
            if(document.getElementById('nopeLabel')) document.getElementById('nopeLabel').style.opacity = 0;
        }
        startX = 0;
    };

export function finalizeSacrifice() {
    const note = document.getElementById('huntNote') ? document.getElementById('huntNote').value.trim() : "";
    if (!selectedItem || !selectedReason) return;
    if (gameStats.coins < selectedItem.price) { triggerSound('sfx-deny'); alert('Insufficient coins!'); return; }
    const tributeMessage = `💝 TRIBUTE: ${selectedReason}\n🎁 ITEM: ${selectedItem.name}\n💰 COST: ${selectedItem.price}\n💌 "${note || "A silent tribute."}"`;
    window.parent.postMessage({ type: "PURCHASE_ITEM", itemName: selectedItem.name, cost: selectedItem.price, messageToDom: tributeMessage }, "*");
    triggerSound('sfx-buy'); triggerCoinShower(); toggleTributeHunt();
}

export function styleTributeMessages() {
    const chatContent = document.getElementById('chatContent'); if (!chatContent) return;
    chatContent.querySelectorAll('.msg').forEach(msg => {
        const text = msg.textContent || msg.innerHTML;
        if (text.includes('💝 TRIBUTE:') && !msg.classList.contains('tribute-styled')) {
            msg.classList.add('tribute-styled');
            const lines = text.split('\n');
            const tributeLine = lines.find(l => l.includes('💝 TRIBUTE:'));
            const messageLine = lines.find(l => l.includes('💌'));
            if (tributeLine && messageLine) {
                const reason = tributeLine.replace('💝 TRIBUTE:', '').trim();
                const message = messageLine.replace('💌', '').replace(/"/g, '').trim();
                const msgRow = msg.closest('.msg-row');
                if (msgRow) {
                    msgRow.innerHTML = `<div class="tribute-system-container"><div class="tribute-timestamp">${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div><div class="tribute-card"><svg class="tribute-card-icon"><use href="#icon-gift"></use></svg><div class="tribute-card-content"><div class="tribute-card-left"><div class="tribute-card-title">TRIBUTE SENT</div><div class="tribute-card-reason">${reason}</div><div class="tribute-card-message">"${message}"</div></div><div class="tribute-card-right"><div class="tribute-card-footer">For Queen Karin</div><svg class="tribute-card-footer-icon"><use href="#icon-crown"></use></svg></div></div></div></div>`;
                    msgRow.style.justifyContent = 'center'; msgRow.style.margin = '15px 0'; msgRow.classList.add('tribute-system-row');
                }
            }
        }
    });
}

// --- UTILS & HANDLERS ---
export function buyRealCoins(amount) { triggerSound('sfx-buy'); window.parent.postMessage({ type: "INITIATE_STRIPE_PAYMENT", amount: amount }, "*"); }
function triggerCoinShower() {
    for (let i = 0; i < 40; i++) {
        const coin = document.createElement('div'); coin.className = 'coin-particle';
        coin.innerHTML = `<svg style="width:100%;height:100%;fill:gold;"><use href="#icon-coin"></use></svg>`;
        coin.style.setProperty('--tx', `${Math.random() * 200 - 100}vw`); coin.style.setProperty('--ty', `${-(Math.random() * 80 + 20)}vh`);
        document.body.appendChild(coin); setTimeout(() => coin.remove(), 2000);
    }
}
export function breakGlass(e) { if (e && e.stopPropagation) e.stopPropagation(); const overlay = document.getElementById('specialGlassOverlay'); if (overlay) overlay.classList.remove('active'); window.parent.postMessage({ type: "GLASS_BROKEN" }, "*"); }
export function submitSessionRequest() { const checked = document.querySelector('input[name="sessionType"]:checked'); if (!checked) return; window.parent.postMessage({ type: "SESSION_REQUEST", sessionType: checked.value, cost: checked.getAttribute('data-cost') }, "*"); }
export function resetTributeFlow() { selectedReason = ""; selectedItem = null; if (document.getElementById('huntNote')) document.getElementById('huntNote').value = ""; showHuntStep(1); }

setInterval(updateKneelingStatus, 1000);
setInterval(() => { window.parent.postMessage({ type: "heartbeat", view: currentView }, "*"); }, 5000);

window.toggleTributeHunt = toggleTributeHunt;
window.selectTributeReason = selectTributeReason;
window.showHuntStep = showHuntStep;
window.finalizeSacrifice = finalizeSacrifice;
window.resetTributeFlow = resetTributeFlow;
window.switchTab = switchTab;
window.toggleStats = toggleStats;
window.toggleSection = toggleSection;
window.handleHoldStart = handleHoldStart;
window.handleHoldEnd = handleHoldEnd;
window.claimKneelReward = claimKneelReward;
window.updateKneelingStatus = updateKneelingStatus;
window.getRandomTask = getRandomTask;
window.cancelPendingTask = cancelPendingTask;
window.handleEvidenceUpload = handleEvidenceUpload;
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
window.handleProfileUpload = handleProfileUpload;
window.openSessionUI = openSessionUI;
window.closeSessionUI = closeSessionUI;
window.updateSessionCost = updateSessionCost;
window.submitSessionRequest = submitSessionRequest;
window.handleAdminUpload = handleAdminUpload;
window.WISHLIST_ITEMS = WISHLIST_ITEMS;
window.gameStats = gameStats;
window.parent.postMessage({ type: "UI_READY" }, "*");
