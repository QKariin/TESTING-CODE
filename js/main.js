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

        // Handle fragment reveal response from Velo
    if (data.type === "FRAGMENT_REVEALED") {
        const { fragmentNumber, day, totalRevealed, isComplete } = data;
        
        // Import and run the targeting animation
        import('./reward.js').then(({ runTargetingAnimation }) => {
            runTargetingAnimation(fragmentNumber, () => {
                // After animation completes, update the grid
                renderRewardGrid();
                
                // Show completion message if all 9 squares are done
                if (isComplete) {
                    triggerSound('coinSound');
                    // Optional: Show "LEVEL COMPLETE" message
                }
            });
        });
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
        
        // SYNC TASK QUEUE FROM PROFILE
        if (data.profile.taskQueue) {
            setTaskQueue(data.profile.taskQueue);
        }
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

        // Handle fragment reveal animation response from Velo
    if (data.type === "FRAGMENT_REVEALED") {
        const { fragmentNumber, day, totalRevealed, isComplete } = data;
        
        // Import and run the targeting animation
        import('./reward.js').then(({ runTargetingAnimation, renderRewardGrid }) => {
            runTargetingAnimation(fragmentNumber, () => {
                // After animation completes, update the grid
                renderRewardGrid();
                
                // Show completion message if all 9 squares are done
                if (isComplete) {
                    triggerSound('coinSound');
                    console.log(`Level ${day} completed! Added to vault.`);
                }
            });
        });
    }

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
let currentHuntIndex = 0;
let filteredItems = [];

function toggleTributeHunt() {
    const chatContainer = document.querySelector('.app-container') || document.body;
    const overlay = document.getElementById('tributeHuntOverlay');
    
    if (overlay.classList.contains('hidden')) {
        overlay.classList.remove('hidden');
        overlay.classList.add('tinder-focus'); // Adds the full-screen layout
        chatContainer.classList.add('tribute-focus-mode'); // Hides everything else
        showHuntStep(1);
    } else {
        overlay.classList.add('hidden');
        overlay.classList.remove('tinder-focus');
        chatContainer.classList.remove('tribute-focus-mode');
        resetTributeFlow();
    }
}

function renderHuntStore(budget) {
    const grid = document.getElementById('huntStoreGrid');
    const items = window.WISHLIST_ITEMS || [];
    filteredItems = items.filter(item => Number(item.price || item.Price || 0) <= budget);
    currentHuntIndex = 0;
    showTinderCard();
}

function showTinderCard() {
    const grid = document.getElementById('huntStoreGrid');
    const item = filteredItems[currentHuntIndex];

    if (!item) {
        grid.innerHTML = `<div style="text-align:center;"><p>NO MORE ITEMS</p><button class="action-btn" onclick="toggleTributeHunt()">EXIT</button></div>`;
        return;
    }

    grid.innerHTML = `
        <div class="tinder-focus-wrapper">
            <div id="tinderCard" class="tinder-card-main">
                <div id="likeLabel" class="swipe-indicator like">SACRIFICE</div>
                <div id="nopeLabel" class="swipe-indicator nope">SKIP</div>
                <div class="card-image-container" style="flex:1; display:flex; align-items:center; justify-content:center; padding:20px;">
                    <img src="${item.img || item.image}" style="max-width:100%; max-height:100%; object-fit:contain;" draggable="false">
                </div>
                <div style="padding:20px; text-align:center; background:#000;">
                    <div style="color:var(--neon-yellow); font-size:1.8rem; font-weight:900;">${item.price} 🪙</div>
                    <div style="color:white; letter-spacing:2px; font-size:0.8rem;">${item.name.toUpperCase()}</div>
                </div>
            </div>
        </div>
    `;
    initSwipeEvents(document.getElementById('tinderCard'), item);
}

function initSwipeEvents(card, item) {
    let startX = 0;
    let currentX = 0;

    const handleStart = (e) => {
        startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        card.style.transition = 'none';
    };

    const handleMove = (e) => {
        if (!startX) return;
        currentX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const diff = currentX - startX;
        card.style.transform = `translateX(${diff}px) rotate(${diff / 15}deg)`;
        document.getElementById('likeLabel').style.opacity = diff > 0 ? (diff / 100) : 0;
        document.getElementById('nopeLabel').style.opacity = diff < 0 ? (Math.abs(diff) / 100) : 0;
    };

    const handleEnd = () => {
        const diff = currentX - startX;
        if (diff > 120) { // BUY
            card.style.transform = `translateX(600px) rotate(45deg)`;
            selectedItem = item;
            setTimeout(() => { showHuntStep(4); }, 200);
        } else if (diff < -120) { // SKIP
            card.style.transform = `translateX(-600px) rotate(-45deg)`;
            currentHuntIndex++;
            setTimeout(() => { showTinderCard(); }, 200);
        } else { // RESET
            card.style.transform = `translateX(0) rotate(0)`;
            document.getElementById('likeLabel').style.opacity = 0;
            document.getElementById('nopeLabel').style.opacity = 0;
        }
        startX = 0;
    };

    card.addEventListener('mousedown', handleStart);
    card.addEventListener('touchstart', handleStart);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchend', handleEnd);
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

let currentHuntIndex = 0;
let filteredItems = [];

function renderHuntStore(budget) {
    const grid = document.getElementById('huntStoreGrid');
    if (!grid) return;

    // 1. Filter items by budget
    const items = window.WISHLIST_ITEMS || [];
    filteredItems = items.filter(item => Number(item.price || item.Price || 0) <= budget);
    currentHuntIndex = 0; // Start at the first item

    if (filteredItems.length === 0) {
        grid.innerHTML = '<div style="color:#666; text-align:center; padding:40px;">NO TRIBUTES IN THIS TIER...</div>';
        return;
    }

    showTinderCard();
}

function showTinderCard() {
    const grid = document.getElementById('huntStoreGrid');
    const item = filteredItems[currentHuntIndex];

    if (!item) {
        grid.innerHTML = `
            <div style="text-align:center; padding:40px;">
                <div style="font-size:2rem; margin-bottom:10px;">💨</div>
                <div style="color:#666; font-size:0.7rem;">NO MORE ITEMS IN THIS TIER</div>
                <button class="tab-btn" onclick="showHuntStep(2)" style="margin-top:15px; width:auto; padding:5px 15px;">CHANGE BUDGET</button>
            </div>`;
        return;
    }

    grid.style.perspective = "1000px";
    grid.innerHTML = `
        <div class="tinder-wrapper" style="position:relative; width:100%; height:300px; display:flex; align-items:center; justify-content:center;">
            
            <!-- Instructions Overlay -->
            <div id="swipeHint" style="position:absolute; top:-20px; width:100%; text-align:center; font-size:0.6rem; color:var(--neon-yellow); opacity:0.8; font-family:'Orbitron';">
                <i class="fas fa-arrow-left"></i> SKIP | BUY <i class="fas fa-arrow-right"></i>
            </div>

            <!-- The Card -->
            <div id="tinderCard" class="tinder-card" style="width:220px; background:#111; border:2px solid #333; border-radius:15px; padding:15px; text-align:center; transition: transform 0.1s ease, opacity 0.1s ease; cursor:grab; position:relative; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                
                <!-- Indicators that appear on swipe -->
                <div id="likeLabel" style="position:absolute; top:20px; left:10px; border:3px solid var(--neon-green); color:var(--neon-green); padding:5px 10px; border-radius:5px; font-weight:900; transform:rotate(-15deg); opacity:0; pointer-events:none;">SACRIFICE</div>
                <div id="nopeLabel" style="position:absolute; top:20px; right:10px; border:3px solid var(--neon-pink); color:var(--neon-pink); padding:5px 10px; border-radius:5px; font-weight:900; transform:rotate(15deg); opacity:0; pointer-events:none;">SKIP</div>

                <div style="height:140px; display:flex; align-items:center; justify-content:center; margin-bottom:15px;">
                    <img src="${item.img || item.image}" style="max-height:100%; max-width:100%; border-radius:8px; pointer-events:none;">
                </div>
                <div style="font-family:'Orbitron'; color:white; font-size:0.8rem; font-weight:bold; margin-bottom:5px;">${item.name.toUpperCase()}</div>
                <div style="color:var(--neon-yellow); font-size:1rem; font-weight:bold;">${item.price} 🪙</div>
                
                <div style="margin-top:15px; font-size:0.6rem; color:#666;">${currentHuntIndex + 1} / ${filteredItems.length}</div>
            </div>
        </div>
    `;

    initSwipeEvents(document.getElementById('tinderCard'), item);
}

function initSwipeEvents(card, item) {
    let startX = 0;
    let currentX = 0;
    const threshold = 100; // Pixels needed to trigger a swipe

    const handleStart = (e) => {
        startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        card.style.transition = 'none';
    };

    const handleMove = (e) => {
        if (!startX) return;
        currentX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const diff = currentX - startX;
        const rotation = diff / 10;
        const opacity = Math.min(Math.abs(diff) / 50, 1);

        card.style.transform = `translateX(${diff}px) rotate(${rotation}deg)`;

        // Show "SACRIFICE" or "SKIP" labels based on direction
        const likeLabel = document.getElementById('likeLabel');
        const nopeLabel = document.getElementById('nopeLabel');
        
        if (diff > 0) { // Swiping Right
            likeLabel.style.opacity = opacity;
            nopeLabel.style.opacity = 0;
        } else { // Swiping Left
            nopeLabel.style.opacity = opacity;
            likeLabel.style.opacity = 0;
        }
    };

    const handleEnd = () => {
        const diff = currentX - startX;
        card.style.transition = 'transform 0.4s ease, opacity 0.4s ease';

        if (diff > threshold) {
            // SWIPE RIGHT: PURCHASE
            card.style.transform = `translateX(500px) rotate(30deg)`;
            card.style.opacity = '0';
            setTimeout(() => {
                selectedItem = item;
                showHuntStep(4); // Go to confession/note step
            }, 300);
        } else if (diff < -threshold) {
            // SWIPE LEFT: NEXT
            card.style.transform = `translateX(-500px) rotate(-30deg)`;
            card.style.opacity = '0';
            setTimeout(() => {
                currentHuntIndex++;
                showTinderCard();
            }, 300);
        } else {
            // RESET
            card.style.transform = `translateX(0) rotate(0)`;
            document.getElementById('likeLabel').style.opacity = 0;
            document.getElementById('nopeLabel').style.opacity = 0;
        }
        startX = 0;
        currentX = 0;
    };

    card.addEventListener('mousedown', handleStart);
    card.addEventListener('touchstart', handleStart);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchend', handleEnd);
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

// Kneeling functions (imported from kneeling.js)
window.handleHoldStart = handleHoldStart;
window.handleHoldEnd = handleHoldEnd;
window.claimKneelReward = claimKneelReward;
window.updateKneelingStatus = updateKneelingStatus;

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

/*window.addEventListener("load", () => {
  scanExisting();
  observeNewElements();
});*/
