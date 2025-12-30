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
        // ADD YOUR VERCEL LINK TO THIS LIST:
        const parents = [
            "qkarin.com", 
            "www.qkarin.com", 
            "entire-ecosystem.vercel.app", 
            "html-components.wixusercontent.com", 
            "filesusr.com", 
            "editor.wix.com", 
            "manage.wix.com", 
            "localhost"
        ];
        
        let parentString = "";
        parents.forEach(p => parentString += `&parent=${p}`);
        frame.src = `https://player.twitch.tv/?channel=${CONFIG.TWITCH_CHANNEL}${parentString}&muted=true&autoplay=true`;
    }
}
initDomProfile();

// --- THE DOUBLE MESSAGE FIX ---
// js/main.js (Slave Side)
Bridge.listen((data) => {
    // IGNORE these so they don't show up twice
    const ignoreList = [
        "CHAT_ECHO", 
        "UPDATE_CHAT", 
        "UPDATE_FULL_DATA", 
        "UPDATE_DOM_STATUS", 
        "instantUpdate", 
        "instantReviewSuccess"
    ];

    if (ignoreList.includes(data.type)) {
        return; // Stop the echo
    }

    // Only let through commands like "updateTaskQueue" or "forceActiveTask"
    window.postMessage(data, "*"); 
});

// --- 3. THE MESSAGE LISTENER (CORE BRIDGE) ---
window.addEventListener("message", (event) => {
    const data = event.data;

       // A. CHAT ECHO
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

    // YOUR RULES LOGIC
    if (data.type === 'UPDATE_RULES') {
        const rules = data.payload || {};
        for (let i = 1; i <= 8; i++) {
            const el = document.getElementById('r' + i);
            if (el && rules['rule' + i]) el.innerHTML = rules['rule' + i];
        }
    }

    // YOUR TASK & WISHLIST INIT
    if (data.type === "INIT_TASKS" || data.dailyTasks) setTaskDatabase(data.dailyTasks || data.tasks || []);
    if (data.type === "INIT_WISHLIST" || data.wishlist) {
        const items = data.wishlist || [];
        if (Array.isArray(items) && items.length > 0) {
            setWishlistItems(items);
            window.WISHLIST_ITEMS = items; 
            renderWishlist();
        }
    }

    // YOUR DOM STATUS LOGIC
    if (data.type === "UPDATE_DOM_STATUS") {
        const badge = document.getElementById('chatStatusBadge');
        const ring = document.getElementById('chatStatusRing');
        const domBadge = document.getElementById('domStatusBadge');
        if(badge) { badge.innerHTML = data.online ? "ONLINE" : data.text; badge.className = data.online ? "chat-status-text chat-online" : "chat-status-text"; }
        if(ring) ring.className = data.online ? "dom-status-ring ring-active" : "dom-status-ring ring-inactive";
        if(domBadge) { domBadge.innerHTML = data.online ? '<span class="status-dot"></span> ONLINE' : `<span class="status-dot"></span> ${data.text}`; domBadge.className = data.online ? "dom-status status-online" : "dom-status"; }
    }

    // YOUR Q-FEED LOGIC
    if (data.type === "UPDATE_Q_FEED") {
        const feedData = data.domVideos || data.posts || data.feed;
        if (feedData && Array.isArray(feedData)) {
            renderDomVideos(feedData);
            renderNews(feedData);
            const pc = document.getElementById('cntPosts');
            if (pc) pc.innerText = feedData.length;
        }
    }

    // --- YOUR COMPLEX PAYLOAD LOGIC (RECOUPLED & SHIELDED) ---
    const payload = data.profile || data.galleryData || data.pendingState ? data : (data.type === "UPDATE_FULL_DATA" ? data : null);
    
    if (payload) {
        // 1. Profile Sync (Added the !ignoreBackendUpdates shield here)
        if (data.profile && !ignoreBackendUpdates) {
        setGameStats(data.profile);
        setUserProfile({
            name: data.profile.name || "Slave",
            hierarchy: data.profile.hierarchy || "HallBoy",
            memberId: data.profile.memberId || "",
            joined: data.profile.joined
        });
        // --- SYNC REWARD SYSTEM (SAFE VERSION) ---
        if (data.profile.activeRevealMap) {
            let map = [];
            try { 
                // ONLY parse if Wix sent a string. If it's already an object, just use it.
                map = (typeof data.profile.activeRevealMap === 'string') 
                    ? JSON.parse(data.profile.activeRevealMap) 
                    : data.profile.activeRevealMap;
            } catch(e) { map = []; }
            setActiveRevealMap(map);
        }
        
        if (data.profile.rewardVault) {
            let vault = [];
            try { 
                vault = (typeof data.profile.rewardVault === 'string') 
                        ? JSON.parse(data.profile.rewardVault) 
                        : data.profile.rewardVault; 
            } catch(e) { vault = []; }
            setVaultItems(vault);
        }

        setLibraryProgressIndex(data.profile.libraryProgressIndex || 1);
        setCurrentLibraryMedia(data.profile.currentLibraryMedia || "");

        // DRAW THE GRID IMMEDIATELY
        renderRewardGrid();
        if (data.profile.lastWorship) setLastWorshipTime(new Date(data.profile.lastWorship).getTime());
        setStats(migrateGameStatsToStats(data.profile, stats));
        if(data.profile.profilePicture) document.getElementById('profilePic').src = getOptimizedUrl(data.profile.profilePicture, 150);
        updateStats(); // RECONNECTS THE VISUALS
    }

      // C. INSTANT REVEAL SYNC (The Roulette Trigger)
    if (data.type === "INSTANT_REVEAL_SYNC") {
        // 1. URGENT: Update the media URL first
        if (data.currentLibraryMedia) {
            setCurrentLibraryMedia(data.currentLibraryMedia);
        }
        
        // 2. Physically draw the grid and photo NOW
        renderRewardGrid(); 

        // 3. Start the animation only after a tiny delay to let the browser breathe
        setTimeout(() => {
            const winnerId = data.activeRevealMap[data.activeRevealMap.length - 1];
            
            runTargetingAnimation(winnerId, () => {
                setActiveRevealMap(data.activeRevealMap || []);
                renderRewardGrid(); // Final reveal
            });
        }, 50); 
    }

        // 2. Gallery Data Logic (Exactly as you sent it)
        if (payload.galleryData) {
            const currentGalleryJson = JSON.stringify(payload.galleryData);
            if (currentGalleryJson !== lastGalleryJson) {
                setLastGalleryJson(currentGalleryJson);
                setGalleryData(payload.galleryData);
                renderGallery();
                updateStats();
            }
        }

        // 3. Pending Task Logic (Exactly as you sent it)
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
});

// --- 4. LOGIC FUNCTIONS ---

function updateStats() {
    const subName = document.getElementById('subName');
    if (!subName || !userProfile || !gameStats) return; 

    subName.textContent = userProfile.name || "Slave";
    document.getElementById('subHierarchy').textContent = userProfile.hierarchy || "HallBoy";
    document.getElementById('coins').textContent = gameStats.coins ?? 0;
    document.getElementById('points').textContent = gameStats.points ?? 0;

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val ?? 0;
    };

    setVal('statStreak', gameStats.taskdom_streak || gameStats.currentStreak);
    setVal('statTotal', gameStats.taskdom_total_tasks || gameStats.totalTasks);
    setVal('statCompleted', gameStats.taskdom_completed_tasks || gameStats.completedTasks);
    setVal('statSkipped', gameStats.skippedTasks || stats.skippedTasks);
    setVal('statTotalKneels', gameStats.kneelCount || gameStats.totalKneels);

    const sinceEl = document.getElementById('slaveSinceDate');
    if (sinceEl && userProfile.joined) {
        try { sinceEl.textContent = new Date(userProfile.joined).toLocaleDateString(); } catch(e) { sinceEl.textContent = "--/--/--"; }
    }

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

// --- TRIBUTE HUNT LOGIC ---
let selectedReason = "";
let selectedItem = null;

function toggleTributeHunt() {
    const overlay = document.getElementById('tributeHuntOverlay');
    const mainBtn = document.getElementById('tributeHuntBtn');
    if (!overlay || !mainBtn) return;

    if (overlay.classList.contains('hidden')) {
        overlay.classList.remove('hidden');
        mainBtn.style.border = "none";
        mainBtn.style.background = "transparent";
        mainBtn.style.color = "#666";
        mainBtn.innerHTML = `<svg style="width:22px; height:10px; fill:#666;"><use href="#icon-close"></use></svg> ABORT SACRIFICE`;
        showHuntStep(1);
    } else {
        overlay.classList.add('hidden');
        mainBtn.style.border = "1px solid var(--neon-yellow)";
        mainBtn.style.background = "#000";
        mainBtn.style.color = "var(--neon-yellow)";
        mainBtn.innerHTML = `<svg style="width:22px; height:15px; fill:var(--neon-yellow);"><use href="#icon-coin"></use></svg> TRIBUTE`;
        resetTributeFlow();
    }
}

function showHuntStep(step) {
    document.querySelectorAll('.hunt-step').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById('huntStep' + step);
    if (target) {
        target.classList.remove('hidden');
        target.querySelectorAll('.tab-btn').forEach(btn => {
            btn.style.width = "70%";
            btn.style.margin = "0 auto";
        });
    }
    const labels = ["", "INTENTION", "SACRIFICE", "THE HUNT", "CONFESSION"];
    const progressEl = document.getElementById('huntProgress');
    if (progressEl) progressEl.innerText = labels[step] || "";
}

function selectTributeReason(reason) {
    selectedReason = reason;
    showHuntStep(2);
}

function filterByBudget(max) {
    renderHuntStore(max); 
    showHuntStep(3);
}

function renderHuntStore(budget) {
    const grid = document.getElementById('huntStoreGrid');
    if (!grid) return;
    grid.innerHTML = ''; 

    const items = window.WISHLIST_ITEMS || [];
    const affordableItems = items.filter(item => Number(item.price || item.Price || 0) <= budget);

    if (affordableItems.length === 0) {
        grid.innerHTML = '<div style="grid-column:span 2; color:#666; text-align:center; padding:20px; font-size:0.7rem;">EMPTY TIER...</div>';
        return;
    }

    affordableItems.forEach(item => {
        const img = item.img || item.image || "";
        const name = item.name || item.title || "Item";
        const price = item.price || item.Price || 0;

        const itemEl = document.createElement('div');
        itemEl.className = 'store-item';
        itemEl.style.cssText = "border:1px solid #333; padding:10px; border-radius:8px; text-align:center; cursor:pointer; background:rgba(255,255,255,0.02);";
        itemEl.innerHTML = `
            <div style="height:50px; display:flex; align-items:center; justify-content:center; margin-bottom:5px;"><img src="${img}" style="max-height:100%; max-width:100%; border-radius:4px;"></div>
            <div style="font-size:0.55rem; color:white; font-weight:bold;">${name.toUpperCase()}</div>
            <div style="font-size:0.6rem; color:var(--neon-yellow);">${price} 🪙</div>
        `;

        itemEl.onclick = () => { 
            selectedItem = item; 
            const sImg = document.getElementById('huntSelectedImg');
            const sName = document.getElementById('huntSelectedName');
            const sPrice = document.getElementById('huntSelectedPrice');

            if (sImg) sImg.src = img;
            if (sName) sName.innerText = name.toUpperCase();
            if (sPrice) sPrice.innerText = price + " 🪙";
            showHuntStep(4); 
        };
        grid.appendChild(itemEl);
    });
}

function toggleHuntNote(show) {
    const container = document.getElementById('huntNoteContainer');
    const btn = document.getElementById('btnShowNote');
    if (!container || !btn) return;

    if (show) {
        container.classList.remove('hidden');
        btn.classList.add('hidden');
        const noteInput = document.getElementById('huntNote');
        if (noteInput) noteInput.focus();
    } else {
        container.classList.add('hidden');
        btn.classList.remove('hidden');
    }
}

function createTributeCard(item, reason, message, price) {
    const finalMessage = message || "A silent tribute has been offered.";
    
    return `
        <div class="tribute-card">
            <div class="tribute-card-header">
                <div class="tribute-card-title">💝 TRIBUTE SENT</div>
            </div>
            
            <div class="tribute-card-content">
                <img src="${item.img}" alt="${item.name}" class="tribute-card-image">
                <div class="tribute-card-info">
                    <div class="tribute-card-name">${item.name}</div>
                    <div class="tribute-card-price">
                        <span>${price}</span>
                        <svg style="width:16px; height:16px; fill:var(--neon-yellow);">
                            <use href="#icon-coin"></use>
                        </svg>
                    </div>
                    <div class="tribute-card-reason">Reason: ${reason}</div>
                </div>
            </div>
            
            <div class="tribute-card-message">
                <div class="tribute-card-message-text">"${finalMessage}"</div>
            </div>
            
            <div class="tribute-card-footer">
                ✨ For Queen Karin ✨
            </div>
        </div>
    `;
}

function styleTributeMessages() {
    const chatContent = document.getElementById('chatContent');
    if (!chatContent) return;
    
    // Find all messages that look like tributes
    const messages = chatContent.querySelectorAll('.msg');
    
    messages.forEach(msg => {
        const text = msg.textContent || msg.innerHTML;
        
        // Check if this is a tribute message (and not already styled)
        if (text.includes('💝 TRIBUTE:') && !msg.classList.contains('tribute-styled')) {
            msg.classList.add('tribute-styled');
            
            // Extract tribute info from the text
            const lines = text.split('\n');
            const tributeLine = lines.find(line => line.includes('💝 TRIBUTE:'));
            const messageLine = lines.find(line => line.includes('💌'));
            
            if (tributeLine && messageLine) {
                const reason = tributeLine.replace('💝 TRIBUTE:', '').trim();
                const message = messageLine.replace('💌', '').replace(/"/g, '').trim();
                
                // Get current time for timestamp
                const now = new Date();
                const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                // Replace the entire message row with banner style using SVGs
                const msgRow = msg.closest('.msg-row');
                if (msgRow) {
                    msgRow.innerHTML = `
                        <div class="tribute-system-container">
                            <div class="tribute-timestamp">${timeStr}</div>
                            <div class="tribute-card">
                                <svg class="tribute-card-icon">
                                    <use href="#icon-gift"></use>
                                </svg>
                                <div class="tribute-card-content">
                                    <div class="tribute-card-left">
                                        <div class="tribute-card-title">TRIBUTE SENT</div>
                                        <div class="tribute-card-reason">${reason}</div>
                                        <div class="tribute-card-message">"${message}"</div>
                                    </div>
                                    <div class="tribute-card-right">
                                        <div class="tribute-card-footer">For Queen Karin</div>
                                        <svg class="tribute-card-footer-icon">
                                            <use href="#icon-crown"></use>
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                    
                    // Style as system message
                    msgRow.style.justifyContent = 'center';
                    msgRow.style.margin = '15px 0';
                    msgRow.classList.add('tribute-system-row');
                }
            }
        }
    });
}


function finalizeSacrifice() {
    const noteEl = document.getElementById('huntNote');
    const note = noteEl ? noteEl.value.trim() : "";
    
    // Validation checks
    if (!selectedItem) {
        triggerSound('sfx-deny');
        alert('Please select an item first!');
        return;
    }
    
    if (!selectedReason) {
        triggerSound('sfx-deny');
        alert('Please select a reason first!');
        return;
    }
    
    if (gameStats.coins < selectedItem.price) {
        triggerSound('sfx-deny');
        alert(`Insufficient coins! You need ${selectedItem.price} coins but only have ${gameStats.coins}.`);
        return;
    }
    
    // Create the message with ALL the important info
    const finalMsg = note === "" ? "A silent tribute has been offered." : note;
    const tributeMessage = `💝 TRIBUTE: ${selectedReason}\n🎁 ITEM: ${selectedItem.name}\n💰 COST: ${selectedItem.price}\n💌 "${finalMsg}"`;
    
    // Send to Velo using the EXISTING working handler
    window.parent.postMessage({ 
        type: "PURCHASE_ITEM",
        itemName: selectedItem.name,
        cost: selectedItem.price,
        messageToDom: tributeMessage,
        itemImg: ""  // No separate image
    }, "*");
    
    // Success feedback
    triggerSound('sfx-buy');
    triggerCoinShower();
    
    // Show success message
    const overlay = document.getElementById('tributeHuntOverlay');
    overlay.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center;">
            <div style="font-size: 3rem; margin-bottom: 20px;">✨</div>
            <h2 style="font-family:'Orbitron'; font-weight: 900; color: var(--neon-pink); font-size: 1.5rem; margin-bottom: 10px;">TRIBUTE SENT</h2>
            <p style="color: #888; font-family:'Rajdhani'; margin-bottom: 20px;">Processing your tribute...</p>
            <div style="color: var(--neon-yellow); font-size: 1.2rem; margin-bottom: 30px;">${selectedItem.price} 🪙</div>
            <button class="action-btn" onclick="toggleTributeHunt()" style="background: var(--neon-green); color: black;">CLOSE</button>
        </div>
    `;
    
    setTimeout(() => {
        toggleTributeHunt();
    }, 3000);
}


// --- OTHER UTILS ---
function buyRealCoins(amount) {
    triggerSound('sfx-buy');
    window.parent.postMessage({ type: "INITIATE_STRIPE_PAYMENT", amount: amount }, "*");
}

function triggerCoinShower() {
    for (let i = 0; i < 40; i++) {
        const coin = document.createElement('div');
        coin.className = 'coin-particle';
        coin.innerHTML = `<svg style="width:100%; height:100%; fill:gold;"><use href="#icon-coin"></use></svg>`;
        coin.style.setProperty('--tx', `${Math.random() * 200 - 100}vw`);
        coin.style.setProperty('--ty', `${-(Math.random() * 80 + 20)}vh`);
        document.body.appendChild(coin);
        setTimeout(() => coin.remove(), 2000);
    }
}

function breakGlass(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    const overlay = document.getElementById('specialGlassOverlay');
    if (overlay) overlay.classList.remove('active');
    window.parent.postMessage({ type: "GLASS_BROKEN" }, "*");
}

function renderHierarchy(data) {
    const grid = document.getElementById('hierarchyGrid');
    if (!grid) return;
    grid.innerHTML = data.map(item => `<div class="rank-card">${item.Title}</div>`).join('');
}

function submitSessionRequest() {
    const checked = document.querySelector('input[name="sessionType"]:checked');
    if (!checked) return;
    window.parent.postMessage({ type: "SESSION_REQUEST", sessionType: checked.value, cost: checked.getAttribute('data-cost') }, "*");
}

// --- 6. LOOPS & MANIFEST ---
setInterval(updateKneelingStatus, 1000);
setInterval(() => { window.parent.postMessage({ type: "heartbeat", view: currentView }, "*"); }, 5000);

// Navigation & Stats
window.switchTab = switchTab;
window.toggleStats = toggleStats;
window.toggleSection = toggleSection;

// Tasks & Evidence
window.getRandomTask = getRandomTask;
window.cancelPendingTask = cancelPendingTask;
window.handleEvidenceUpload = handleEvidenceUpload;

// Chat & Preview
window.sendChatMessage = sendChatMessage;
window.handleChatKey = handleChatKey;
window.loadMoreChat = loadMoreChat;
window.openChatPreview = openChatPreview;
window.closeChatPreview = closeChatPreview;
window.breakGlass = breakGlass;

// History & Modal
window.openHistoryModal = openHistoryModal;
window.openModal = openModal;
window.closeModal = closeModal;
window.toggleHistoryView = toggleHistoryView;
window.loadMoreHistory = loadMoreHistory;

// Profile & Devotion
window.handleHoldStart = handleHoldStart;
window.handleHoldEnd = handleHoldEnd;
window.claimKneelReward = claimKneelReward;
window.updateKneelingStatus = updateKneelingStatus;
window.handleProfileUpload = handleProfileUpload;

// Tribute & Economy
window.toggleTributeHunt = toggleTributeHunt;
window.toggleHuntNote = toggleHuntNote;
window.sendCoins = sendCoins;
window.buyRealCoins = buyRealCoins;
window.triggerCoinShower = triggerCoinShower;
window.selectTributeReason = selectTributeReason;
window.filterByBudget = filterByBudget;
window.finalizeSacrifice = finalizeSacrifice;
window.showHuntStep = showHuntStep;

// Sessions & Admin
window.openSessionUI = openSessionUI;
window.closeSessionUI = closeSessionUI;
window.updateSessionCost = updateSessionCost;
window.submitSessionRequest = submitSessionRequest;
window.handleAdminUpload = handleAdminUpload;

window.WISHLIST_ITEMS = WISHLIST_ITEMS;
window.gameStats = gameStats;

// --- 8. THE HANDSHAKE ---
window.parent.postMessage({ type: "UI_READY" }, "*");

window.resetTributeFlow = function() {
    selectedReason = "";
    selectedItem = null;
    const note = document.getElementById('huntNote');
    if (note) note.value = "";
    showHuntStep(1);
};
// --- 7. STANDALONE TEST ---
if (window.self === window.top) {
    setTimeout(() => {
        window.postMessage({
            type: "UPDATE_FULL_DATA",
            profile: { 
                name: "VERCEL MASTER", coins: 7777, points: 25000, hierarchy: "HallBoy",
                joined: "2024-01-20T10:00:00Z", taskdom_streak: 7, taskdom_total_tasks: 50,
                taskdom_completed_tasks: 45, skippedTasks: 2, kneelCount: 120
            }
        }, "*");
    }, 2000); 
}
