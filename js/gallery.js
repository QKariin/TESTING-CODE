// gallery.js - TRILOGY LAYOUT (FIXED)
import { mediaType } from './media.js';
import { 
    galleryData, 
    historyLimit,
    currentHistoryIndex,
    touchStartX,
    setCurrentHistoryIndex, 
    setHistoryLimit, 
    setTouchStartX,
    gameStats,
    setGameStats,
    setCurrentTask,
    setPendingTaskState
} from './state.js';
import { triggerSound } from './utils.js';
import { getOptimizedUrl, getThumbnail, getSignedUrl } from './media.js';

// STICKERS
const STICKER_APPROVE = "https://static.wixstatic.com/media/ce3e5b_a19d81b7f45c4a31a4aeaf03a41b999f~mv2.png";
const STICKER_DENIED = "https://static.wixstatic.com/media/ce3e5b_63a0c8320e29416896d071d5b46541d7~mv2.png";
const PLACEHOLDER_IMG = "https://static.wixstatic.com/media/ce3e5b_1bd27ba758ce465fa89a36d70a68f355~mv2.png";
const IMG_QUEEN_MAIN = "https://static.wixstatic.com/media/ce3e5b_5fc6a144908b493b9473757471ec7ebb~mv2.png";
const IMG_STATUE_SIDE = "https://static.wixstatic.com/media/ce3e5b_5424edc9928d49e5a3c3a102cb4e3525~mv2.png";
const IMG_MIDDLE_EMPTY = "https://static.wixstatic.com/media/ce3e5b_1628753a2b5743f1bef739cc392c67b5~mv2.webp";
const IMG_BOTTOM_EMPTY = "https://static.wixstatic.com/media/ce3e5b_33f53711eece453da8f3d04caddd7743~mv2.png";

let activeStickerFilter = "ALL";

// --- HELPER: POINTS ---
function getPoints(item) {
    let val = item.points || item.score || item.value || item.amount || item.reward || 0;
    return Number(val);
}

// --- HELPER: NORMALIZE DATA (FIXED) ---
let normalizedCache = new Set();

function normalizeGalleryItem(item) {
    // Use item ID/timestamp as cache key to avoid re-normalizing
    const cacheKey = item._id || item._createdDate;
    if (normalizedCache.has(cacheKey)) return;
    
    // Search for photos in any possible field
    if (item.proofUrl && typeof item.proofUrl === 'string' && item.proofUrl.length > 5) {
        normalizedCache.add(cacheKey);
        return;
    }
    
    const candidates = ['media', 'file', 'evidence', 'url', 'image', 'src', 'attachment', 'photo'];
    for (let key of candidates) {
        if (item[key] && typeof item[key] === 'string' && item[key].length > 5) {
            item.proofUrl = item[key];
            normalizedCache.add(cacheKey);
            return;
        }
    }
}

// --- HELPER: SORTED LIST ---
function getSortedGallery() {
    if (!galleryData) return [];
    return [...galleryData].sort((a, b) => new Date(b._createdDate) - new Date(a._createdDate));
}

// --- HELPER: GET FILTERED LIST ---
function getGalleryList() {
    if (!galleryData || !Array.isArray(galleryData)) return [];
    
    // Normalize ALL items first
    galleryData.forEach(normalizeGalleryItem);
    
    let items = galleryData.filter(i => {
        const s = (i.status || "").toLowerCase();
        return (s.includes('pending') || s.includes('app') || s.includes('rej') || s === "") && i.proofUrl;
    });

    // Apply Filter
    if (activeStickerFilter === "DENIED") {
        items = items.filter(item => (item.status || "").toLowerCase().includes('rej'));
    } else if (activeStickerFilter === "PENDING") {
        items = items.filter(item => (item.status || "").toLowerCase().includes('pending'));
    } else if (activeStickerFilter !== "ALL") {
        items = items.filter(item => item.sticker === activeStickerFilter);
    }

    return items.sort((a, b) => new Date(b._createdDate) - new Date(a._createdDate));
}

// --- RENDERERS ---
function renderStickerFilters() {
    const filterBar = document.getElementById('stickerFilterBar');
    if (!filterBar || !galleryData) return;

    const stickers = new Set();
    galleryData.forEach(item => {
        if (item.sticker && item.sticker.length > 10) stickers.add(item.sticker);
    });

    let html = `
        <div class="filter-circle ${activeStickerFilter === 'ALL' ? 'active' : ''}" onclick="window.setGalleryFilter('ALL')">
            <span class="filter-all-text">ALL</span>
        </div>
        <div class="filter-circle ${activeStickerFilter === 'PENDING' ? 'active' : ''}" onclick="window.setGalleryFilter('PENDING')" style="${activeStickerFilter === 'PENDING' ? 'border-color:var(--neon-yellow);' : ''}">
            <span class="filter-all-text" style="color:var(--neon-yellow); font-size:0.5rem;">WAIT</span>
        </div>
        <div class="filter-circle ${activeStickerFilter === 'DENIED' ? 'active' : ''}" onclick="window.setGalleryFilter('DENIED')" style="${activeStickerFilter === 'DENIED' ? 'border-color:var(--neon-red);' : ''}">
            <span class="filter-all-text" style="color:var(--neon-red); font-size:0.5rem;">DENY</span>
        </div>
    `;

    stickers.forEach(url => {
        if(url === STICKER_DENIED) return;
        const isActive = (activeStickerFilter === url) ? 'active' : '';
        html += `<div class="filter-circle ${isActive}" onclick="window.setGalleryFilter('${url}')"><img src="${url}"></div>`;
    });

    filterBar.innerHTML = html;
}

// REPLACE your renderGallery function with this:
export async function renderGallery() {
    if (!galleryData) return;
    console.log("Rendering gallery with", galleryData.length, "items. Active filter:", activeStickerFilter);

    const gridFailed = document.getElementById('gridFailed'); 
    const gridOkay = document.getElementById('gridOkay');     
    const historySection = document.getElementById('historySection');
    
    // Altar Elements
    const slot1 = { card: document.getElementById('altarSlot1'), img: document.getElementById('imgSlot1'), ref: document.getElementById('reflectSlot1') };
    const slot2 = { card: document.getElementById('altarSlot2'), img: document.getElementById('imgSlot2') };
    const slot3 = { card: document.getElementById('altarSlot3'), img: document.getElementById('imgSlot3') };

    if (!gridFailed || !gridOkay || !slot1.card) return;

    gridFailed.innerHTML = "";
    gridOkay.innerHTML = "";

    const allItems = getGalleryList(); 

    // --- SOLO MODE CHECK ---
    if (allItems.length === 0) {
        historySection.classList.add('solo-mode');
    } else {
        historySection.classList.remove('solo-mode');
    }

    // --- 1. TOP 3 (THE ALTAR) - PARALLEL LOADING ---
    let bestOf = [...allItems]
        .filter(item => {
            const s = (item.status || "").toLowerCase();
            return !s.includes('rej') && !s.includes('fail') && !s.includes('pending');
        })
        .sort((a, b) => getPoints(b) - getPoints(a))
        .slice(0, 3);

    // Load altar images in parallel
    const altarPromises = bestOf.map((item, idx) => 
        getSignedUrl(getThumbnail(getOptimizedUrl(item.proofUrl || item.media, idx === 0 ? 400 : 300)))
    );
    const altarThumbs = await Promise.all(altarPromises);

    // Center
    slot1.card.style.display = 'flex';
    if (bestOf[0]) {
        slot1.img.src = altarThumbs[0];
        if(slot1.ref) slot1.ref.src = altarThumbs[0];
        let realIndex = allItems.indexOf(bestOf[0]);
        slot1.card.onclick = async () => {await window.openHistoryModal(realIndex);};
        slot1.img.style.filter = "none";
    } else {
        slot1.img.src = IMG_QUEEN_MAIN;
        if(slot1.ref) slot1.ref.src = IMG_QUEEN_MAIN;
        slot1.card.onclick = null;
        slot1.img.style.filter = "grayscale(30%)"; 
    }

    // Left
    slot2.card.style.display = 'flex';
    if (bestOf[1]) {
        slot2.img.src = altarThumbs[1];
        let realIndex = allItems.indexOf(bestOf[1]);
        slot2.card.onclick = async () => {await window.openHistoryModal(realIndex);};
    } else {
        slot2.img.src = IMG_STATUE_SIDE;
        slot2.card.onclick = null;
    }

    // Right
    slot3.card.style.display = 'flex';
    if (bestOf[2]) {
        slot3.img.src = altarThumbs[2];
        let realIndex = allItems.indexOf(bestOf[2]);
        slot3.card.onclick = async () => {await window.openHistoryModal(realIndex);};
    } else {
        slot3.img.src = IMG_STATUE_SIDE;
        slot3.card.onclick = null;
    }

    // --- 2. MIDDLE (ARCHIVE) - BATCH DOM UPDATES ---
    const middleItems = allItems.filter(item => {
        if (bestOf.includes(item)) return false; 
        const s = (item.status || "").toLowerCase();
        return !s.includes('rej') && !s.includes('fail');
    });

    let middleHtml = '';
    if (middleItems.length === 0 && allItems.length > 0) {
        for(let i=0; i<6; i++) {
            middleHtml += `<div class="item-placeholder-slot"><img src="${IMG_MIDDLE_EMPTY}"></div>`;
        }
        gridOkay.innerHTML = middleHtml;
    } else if (middleItems.length > 0) {
        // Load all middle images in parallel
        const middlePromises = middleItems.map(item => 
            getSignedUrl(getOptimizedUrl(item.proofUrl || item.media, 300))
        );
        const middleThumbs = await Promise.all(middlePromises);
        
        // Build HTML string all at once
        for (let i = 0; i < middleItems.length; i++) {
            const item = middleItems[i];
            const thumb = middleThumbs[i];
            const realIndex = allItems.indexOf(item);
            const isPending = (item.status || "").toLowerCase().includes('pending');
            const overlay = isPending ? `<div class="pending-overlay"><div class="pending-icon">⏳</div></div>` : ``;

            middleHtml += `
                <div class="item-blueprint" onclick="window.openHistoryModal(${realIndex})">
                    <img class="blueprint-img" src="${thumb}" loading="lazy">
                    <div class="bp-corner bl-tl"></div>
                    <div class="bp-corner bl-tr"></div>
                    <div class="bp-corner bl-bl"></div>
                    <div class="bp-corner bl-br"></div>
                    ${overlay}
                </div>`;
        }
        gridOkay.innerHTML = middleHtml;
    }

    // --- 3. BOTTOM (HEAP) - BATCH DOM UPDATES ---
    const failedItems = allItems.filter(item => {
        const s = (item.status || "").toLowerCase();
        return s.includes('rej') || s.includes('fail');
    });

    let failedHtml = '';
    if (failedItems.length === 0 && allItems.length > 0) {
        for(let i=0; i<6; i++) {
            failedHtml += `<div class="item-placeholder-slot"><img src="${IMG_BOTTOM_EMPTY}"></div>`;
        }
        gridFailed.innerHTML = failedHtml;
    } else if (failedItems.length > 0) {
        // Load all failed images in parallel
        const failedPromises = failedItems.map(item => 
            getSignedUrl(getOptimizedUrl(item.proofUrl || item.media, 300))
        );
        const failedThumbs = await Promise.all(failedPromises);
        
        // Build HTML string all at once
        for (let i = 0; i < failedItems.length; i++) {
            const item = failedItems[i];
            const thumb = failedThumbs[i];
            const realIndex = allItems.indexOf(item);
            
            failedHtml += `
                <div class="item-trash" onclick="window.openHistoryModal(${realIndex})">
                    <img class="trash-img" src="${thumb}" loading="lazy">
                    <div class="trash-stamp">DENIED</div>
                </div>`;
        }
        gridFailed.innerHTML = failedHtml;
    }
}

// --- CRITICAL FIX: EXPORT THIS EMPTY FUNCTION TO PREVENT CRASH ---
export function loadMoreHistory() {
    setHistoryLimit(historyLimit + 25);
    renderGallery();
    console.log("Increased history limit to", historyLimit);
}

// --- REDEMPTION LOGIC ---
window.atoneForTask = function(index) {
    const items = getGalleryList();
    const task = items[index];
    if (!task) return;

    if (gameStats.coins < 100) {
        triggerSound('sfx-deny');
        alert("Insufficient Capital. You need 100 coins to atone.");
        return;
    }

    triggerSound('coinSound');
    setGameStats({ ...gameStats, coins: gameStats.coins - 100 });

    const coinEl = document.getElementById('coins');
    if(coinEl) coinEl.innerText = gameStats.coins;

    const restoredTask = { 
        text: task.text, 
        category: 'redemption', 
        timestamp: Date.now() 
    };
    setCurrentTask(restoredTask);

    const endTimeVal = Date.now() + 86400000; 
    const newPendingState = { 
        task: restoredTask, 
        endTime: endTimeVal, 
        status: "PENDING" 
    };
    setPendingTaskState(newPendingState);

    window.closeModal(); 
    
    if(window.restorePendingUI) window.restorePendingUI();
    if(window.updateTaskUIState) window.updateTaskUIState(true);
    if(window.toggleTaskDetails) window.toggleTaskDetails(true);

    window.parent.postMessage({ 
        type: "PURCHASE_ITEM", 
        itemName: "Redemption",
        cost: 100,
        messageToDom: "Slave paid 100 coins to retry failed task." 
    }, "*");

    window.parent.postMessage({ 
        type: "savePendingState", 
        pendingState: newPendingState, 
        consumeQueue: false 
    }, "*");
};

// REPLACE openHistoryModal
export async function openHistoryModal(index) {
    const items = getGalleryList();
    if (!items[index]) return;

    setCurrentHistoryIndex(index);
    const item = items[index];

    // 1. Setup Background Media
    let url = item.proofUrl || item.media;
    const isVideo = mediaType(url) === 'video';
    url = await getSignedUrl(url);
    const mediaContainer = document.getElementById('modalMediaContainer');
    
    if (mediaContainer) {
        mediaContainer.innerHTML = isVideo ? 
            `<video src="${url}" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:contain;"></video>` :
            `<img src="${url}" style="width:100%; height:100%; object-fit:contain;">`;
    }

    // 2. Setup Data
    const pts = getPoints(item);
    const status = (item.status || "").toLowerCase();
    
    // CRITICAL FIX: Add 'deni' and 'refus' to ensure the button shows for "Denied" tasks
    const isRejected = status.includes('rej') || status.includes('fail') || status.includes('deni') || status.includes('refus');

    // 3. Build UI
    const overlay = document.getElementById('modalGlassOverlay');
    if (overlay) {
        let verdictText = item.adminComment || "Logged without commentary.";
        // If rejected but no comment, show default text
        if(isRejected && !item.adminComment) verdictText = "Submission rejected. Standards not met.";

        // --- REDEMPTION BUTTON GENERATOR ---
        let redemptionBtn = '';
        if (isRejected) {
            redemptionBtn = `
                <button onclick="event.stopPropagation(); window.atoneForTask(${index})" 
                        class="btn-glass-silver" 
                        style="border-color:var(--neon-red); color:var(--neon-red); box-shadow: 0 0 10px rgba(255,0,60,0.1);">
                    SEEK REDEMPTION (-100 🪙)
                </button>`;
        }

        overlay.innerHTML = `
            <!-- FIX 1: Add stopPropagation here so clicks inside the box DON'T close the modal -->
            <div class="modal-center-col" id="modalUI">
                
                <div class="modal-merit-title">${isRejected ? "CAPITAL DEDUCTED" : "MERIT ACQUIRED"}</div>
                <div class="modal-merit-value" style="color:${isRejected ? '#ff003c' : 'var(--gold)'}">
                    ${isRejected ? "0" : "+" + pts}
                </div>

                <div class="modal-verdict-box" id="verdictBox">
                    "${verdictText}"
                </div>

                <div class="modal-btn-stack">
                    <button onclick="event.stopPropagation(); window.toggleDirective(${index})" class="btn-glass-silver">THE DIRECTIVE</button>
                    
                    <button onclick="event.stopPropagation(); window.toggleInspectMode()" class="btn-glass-silver">INSPECT OFFERING</button>
                    
                    ${redemptionBtn}
                    
                    <!-- This button forces close specifically -->
                    <button onclick="window.closeModal()" class="btn-glass-silver btn-glass-red">DISMISS</button>
                </div>
            </div>
        `;
    }

    // FIX 2: Activate the background click to close
    const glassModal = document.getElementById('glassModal');
    if (glassModal) {
        glassModal.onclick = (e) => window.closeModal(e);
        glassModal.classList.add('active');
        glassModal.classList.remove('inspect-mode');
    }
}

// REPLACE OR ADD toggleDirective (Fixes the text swapping)
// REPLACE YOUR toggleDirective FUNCTION WITH THIS
window.toggleDirective = function(index) {
    const items = getGalleryList(); 
    const item = items[index];
    if (!item) return;

    const box = document.getElementById('verdictBox');
    
    // Check current view state
    if (box.dataset.view === 'task') {
        // Switch back to Verdict (Admin comments are usually plain text, so innerText is fine here, but you can change to innerHTML if needed)
        let verdictText = item.adminComment || "Logged without commentary.";
        const status = (item.status || "").toLowerCase();
        if((status.includes('rej') || status.includes('fail')) && !item.adminComment) {
             verdictText = "Submission rejected. Standards not met.";
        }
        
        box.innerText = `"${verdictText}"`;
        box.style.color = "#eee";
        box.style.fontStyle = "italic";
        box.dataset.view = 'verdict';
    } else {
        // Switch to Task/Directive
        // --- THE FIX IS HERE --- 
        // We change .innerText to .innerHTML so the <p> and <br> tags render correctly
        box.innerHTML = item.text || "No directive data available.";
        
        box.style.color = "#ccc";
        box.style.fontStyle = "normal";
        box.dataset.view = 'task';
    }
};

// --- VIEW HELPERS ---
export function toggleHistoryView(view) {
    const modal = document.getElementById('glassModal');
    const overlay = document.getElementById('modalGlassOverlay');
    if (!modal || !overlay) return;

    const views = ['modalInfoView', 'modalFeedbackView', 'modalTaskView'];
    views.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('hidden');
    });

    if (view === 'proof') {
        modal.classList.add('proof-mode-active');
        overlay.classList.add('clean');
    } else {
        modal.classList.remove('proof-mode-active');
        overlay.classList.remove('clean');

        let targetId = 'modalInfoView';
        if (view === 'feedback') targetId = 'modalFeedbackView';
        if (view === 'task') targetId = 'modalTaskView';

        const target = document.getElementById(targetId);
        if(target) target.classList.remove('hidden');
    }
}

// REPLACE your closeModal with this simple version
export function closeModal(e) {
    // If we have an event (e), stop it from triggering other things
    if(e && e.stopPropagation) e.stopPropagation();

    // Force Close Everything
    const modal = document.getElementById('glassModal');
    if (modal) {
        modal.classList.remove('active');
        modal.classList.remove('inspect-mode'); // Reset inspect mode too
    }
    
    // Clear the Media/Video to stop it playing in background
    const media = document.getElementById('modalMediaContainer');
    if (media) media.innerHTML = "";
}

// Helper to ensure clean closing
function forceClose() {
    const modal = document.getElementById('glassModal');
    if (modal) modal.classList.remove('active');
    
    const media = document.getElementById('modalMediaContainer');
    if (media) media.innerHTML = "";
}

export function openModal() {}

export function initModalSwipeDetection() {
    const modalEl = document.getElementById('glassModal');
    if (!modalEl) return;

    modalEl.addEventListener('touchstart', e => setTouchStartX(e.changedTouches[0].screenX), { passive: true });
    
    modalEl.addEventListener('touchend', e => {
        const touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;

        if (Math.abs(diff) > 80) {
            let historyItems = getGalleryList();
            let nextIndex = currentHistoryIndex;
            
            if (diff > 0) nextIndex++; 
            else nextIndex--; 
            
            if (nextIndex >= 0 && nextIndex < historyItems.length) {
                openHistoryModal(nextIndex);
            }
        }
    }, { passive: true });
}

// ADD THIS FUNCTION
window.toggleInspectMode = function() {
    const modal = document.getElementById('glassModal');
    if (modal) {
        modal.classList.toggle('inspect-mode');
    }
};

// --- PASTE THIS AT THE VERY BOTTOM OF gallery.js ---

window.addEventListener('click', function(e) {
    const modal = document.getElementById('glassModal');
    const card = document.getElementById('modalUI');

    // 1. If Modal is NOT open, stop here. Do nothing.
    if (!modal || !modal.classList.contains('active')) return;

    // 2. CHECK: Did we click INSIDE the Black Card (Text/Buttons)?
    if (card && card.contains(e.target)) {
        return;
    }

    // 3. CHECK: Are we in INSPECT MODE? (Photo only)
    if (modal.classList.contains('inspect-mode')) {
        // If we clicked the BLURRED BACKGROUND or IMAGE (Inside the modal wrapper)
        if (modal.contains(e.target)) {
            // User wants to revert back to the text card
            modal.classList.remove('inspect-mode');
            return;
        }
    
    }

    window.closeModal();
}, true); // 'true' ensures we catch the click before other listeners stop it

// --- PASTE AT BOTTOM OF gallery.js ---

window.toggleMobileMenu = function() {
    const sidebar = document.querySelector('.layout-left');
    if (sidebar) {
        sidebar.classList.toggle('mobile-open');
    }
};

// Use event delegation instead of adding listeners to each button
document.addEventListener('click', (e) => {
    if (e.target.closest('.nav-btn, .kneel-bar-graphic')) {
        const sidebar = document.querySelector('.layout-left');
        if (sidebar) sidebar.classList.remove('mobile-open');
    }
});

// ... inside renderGallery ...

    // --- SYNC MOBILE ALTAR ---
    const mob1 = document.getElementById('mobImgSlot1');
    const mob2 = document.getElementById('mobImgSlot2');
    const mob3 = document.getElementById('mobImgSlot3');

    // Slot 1 (Center)
    if (mob1) {
        if (bestOf[0]) {
            // Re-use logic for thumbnail
            let thumb = getThumbnail(getOptimizedUrl(bestOf[0].proofUrl || bestOf[0].media, 400));
            mob1.src = thumb;
            mob1.style.filter = "none";
            mob1.onclick = () => window.openHistoryModal(allItems.indexOf(bestOf[0]));
        } else {
            // Set default Queen image if empty
            mob1.src = "https://static.wixstatic.com/media/ce3e5b_5fc6a144908b493b9473757471ec7ebb~mv2.png";
            mob1.style.filter = "grayscale(100%) brightness(0.5)";
        }
    }

    // Slot 2 (Left)
    if (mob2 && bestOf[1]) {
        let thumb = getThumbnail(getOptimizedUrl(bestOf[1].proofUrl || bestOf[1].media, 300));
        mob2.src = thumb;
        mob2.onclick = () => window.openHistoryModal(allItems.indexOf(bestOf[1]));
    }

    // Slot 3 (Right)
    if (mob3 && bestOf[2]) {
        let thumb = getThumbnail(getOptimizedUrl(bestOf[2].proofUrl || bestOf[2].media, 300));
        mob3.src = thumb;
        mob3.onclick = () => window.openHistoryModal(allItems.indexOf(bestOf[2]));
    }

// FORCE WINDOW EXPORTS
window.renderGallery = renderGallery;
window.openHistoryModal = openHistoryModal;
window.toggleHistoryView = toggleHistoryView;
window.closeModal = closeModal;
window.atoneForTask = window.atoneForTask;
window.loadMoreHistory = loadMoreHistory;
window.setGalleryFilter = function(filterType) {
    activeStickerFilter = filterType;
    renderGallery(); 
    console.log("render render", filterType);
};
