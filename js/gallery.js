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
import { getOptimizedUrl, getThumbnail } from './media.js';

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
function normalizeGalleryItem(item) {
    // Search for photos in any possible field
    if (item.proofUrl && typeof item.proofUrl === 'string' && item.proofUrl.length > 5) return;
    
    const candidates = ['media', 'file', 'evidence', 'url', 'image', 'src', 'attachment', 'photo'];
    for (let key of candidates) {
        if (item[key] && typeof item[key] === 'string' && item[key].length > 5) {
            item.proofUrl = item[key];
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
export function renderGallery() {
    if (!galleryData) return;

    const gridFailed = document.getElementById('gridFailed'); 
    const gridOkay = document.getElementById('gridOkay');     
    const historySection = document.getElementById('historySection'); // Parent Container
    
    // Altar Elements
    const slot1 = { card: document.getElementById('altarSlot1'), img: document.getElementById('imgSlot1'), ref: document.getElementById('reflectSlot1') };
    const slot2 = { card: document.getElementById('altarSlot2'), img: document.getElementById('imgSlot2') };
    const slot3 = { card: document.getElementById('altarSlot3'), img: document.getElementById('imgSlot3') };

    if (!gridFailed || !gridOkay || !slot1.card) return;

    gridFailed.innerHTML = "";
    gridOkay.innerHTML = "";

    const allItems = getGalleryList(); 

    // --- SOLO MODE CHECK ---
    // If 0 items, Add Class. If >0 items, Remove Class.
    if (allItems.length === 0) {
        historySection.classList.add('solo-mode');
    } else {
        historySection.classList.remove('solo-mode');
    }

    // --- 1. TOP 3 (THE ALTAR) ---
    // (This runs nicely even if empty, because we have the placeholder fallback)
    let bestOf = [...allItems]
        .filter(item => {
            const s = (item.status || "").toLowerCase();
            return !s.includes('rej') && !s.includes('fail') && !s.includes('pending');
        })
        .sort((a, b) => getPoints(b) - getPoints(a))
        .slice(0, 3);

    // Center
    slot1.card.style.display = 'flex';
    if (bestOf[0]) {
        let thumb = getThumbnail(getOptimizedUrl(bestOf[0].proofUrl || bestOf[0].media, 400));
        let realIndex = allItems.indexOf(bestOf[0]);
        slot1.img.src = thumb;
        if(slot1.ref) slot1.ref.src = thumb;
        slot1.card.onclick = () => window.openHistoryModal(realIndex);
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
        let thumb = etThumbnail(getOptimizedUrl(bestOf[1].proofUrl || bestOf[1].media, 300));
        let realIndex = allItems.indexOf(bestOf[1]);
        slot2.img.src = thumb;
        slot2.card.onclick = () => window.openHistoryModal(realIndex);
    } else {
        slot2.img.src = IMG_STATUE_SIDE;
        slot2.card.onclick = null;
    }
    // Right
    slot3.card.style.display = 'flex';
    if (bestOf[2]) {
        let thumb = getThumbnail(getOptimizedUrl(bestOf[2].proofUrl || bestOf[2].media, 300));
        let realIndex = allItems.indexOf(bestOf[2]);
        slot3.img.src = thumb;
        slot3.card.onclick = () => window.openHistoryModal(realIndex);
    } else {
        slot3.img.src = IMG_STATUE_SIDE;
        slot3.card.onclick = null;
    }


    // --- 2. MIDDLE (ARCHIVE) ---
    const middleItems = allItems.filter(item => {
        if (bestOf.includes(item)) return false; 
        const s = (item.status || "").toLowerCase();
        return !s.includes('rej') && !s.includes('fail');
    });

    // CHANGE: Only show placeholders if NOT in Solo Mode (allItems > 0)
    if (middleItems.length === 0 && allItems.length > 0) {
        for(let i=0; i<6; i++) {
            gridOkay.innerHTML += `<div class="item-placeholder-slot"><img src="${IMG_MIDDLE_EMPTY}"></div>`;
        }
    } else if (middleItems.length > 0) {
        middleItems.forEach(item => {
            let thumb = getOptimizedUrl(item.proofUrl || item.media, 300);
            let realIndex = allItems.indexOf(item);
            let isPending = (item.status || "").toLowerCase().includes('pending');
            let overlay = isPending ? `<div class="pending-overlay"><div class="pending-icon">⏳</div></div>` : ``;

            gridOkay.innerHTML += `
                <div class="item-blueprint" onclick="window.openHistoryModal(${realIndex})">
                    <img class="blueprint-img" src="${thumb}">
                    <div class="bp-corner bl-tl"></div>
                    <div class="bp-corner bl-tr"></div>
                    <div class="bp-corner bl-bl"></div>
                    <div class="bp-corner bl-br"></div>
                    ${overlay}
                </div>`;
        });
    }

    // --- 3. BOTTOM (HEAP) ---
    const failedItems = allItems.filter(item => {
        const s = (item.status || "").toLowerCase();
        return s.includes('rej') || s.includes('fail');
    });

    // CHANGE: Only show placeholders if NOT in Solo Mode
    if (failedItems.length === 0 && allItems.length > 0) {
        for(let i=0; i<6; i++) {
            gridFailed.innerHTML += `<div class="item-placeholder-slot"><img src="${IMG_BOTTOM_EMPTY}"></div>`;
        }
    } else if (failedItems.length > 0) {
        failedItems.forEach(item => {
            let thumb = getOptimizedUrl(item.proofUrl || item.media, 300);
            let realIndex = allItems.indexOf(item);
            gridFailed.innerHTML += `
                <div class="item-trash" onclick="window.openHistoryModal(${realIndex})">
                    <img class="trash-img" src="${thumb}">
                    <div class="trash-stamp">DENIED</div>
                </div>`;
        });
    }
}

// --- CRITICAL FIX: EXPORT THIS EMPTY FUNCTION TO PREVENT CRASH ---
export function loadMoreHistory() {
    setHistoryLimit(historyLimit + 25);
    renderGallery();
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

// --- MODAL ---
export function openHistoryModal(index) {
    const items = getGalleryList();
    if (!items[index]) return;

    setCurrentHistoryIndex(index);
    const item = items[index];

    let url = item.proofUrl;
    const isVideo = mediaType(url) === "video";

    const mediaContainer = document.getElementById('modalMediaContainer');
    if (mediaContainer) {
        mediaContainer.innerHTML = isVideo ? 
            `<video src="${url}" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:contain;"></video>` :
            `<img src="${url}" style="width:100%; height:100%; object-fit:contain;">`;
    }

    const overlay = document.getElementById('modalGlassOverlay');
    if (overlay) {
        const pts = getPoints(item);
        const s = (item.status || "").toLowerCase();
        const isRejected = s.includes('rej') || s.includes('fail');
        const isPending = s.includes('pending') || s === "";

        let statusImg = "";
        let statusText = "SYSTEM VERDICT";

        if (isPending) {
            statusText = "AWAITING REVIEW";
        } else {
            statusImg = s.includes('app') ? STICKER_APPROVE : (isRejected ? STICKER_DENIED : "");
        }

        const statusDisplay = isPending ? 
            `<div style="font-size:3rem;">⏳</div>` : 
            `<img src="${statusImg}" style="width:100px; height:100px; object-fit:contain; margin-bottom:15px; opacity:0.8;">`;

        let footerAction = `<button onclick="event.stopPropagation(); window.closeModal(event)" class="history-action-btn btn-close-red" style="grid-column: span 2;">CLOSE FILE</button>`;

        if (isRejected) {
            footerAction = `<button onclick="event.stopPropagation(); window.atoneForTask(${index})" class="btn-dim" style="grid-column: span 2; border-color:var(--neon-red); color:var(--neon-red); width:100%;">ATONE (-100 🪙)</button>`;
        }

        overlay.innerHTML = `
            <div id="modalCloseX" onclick="window.closeModal(event)" style="position:absolute; top:20px; right:20px; font-size:2.5rem; cursor:pointer; color:white; z-index:110;">×</div>
            <div class="theater-content dossier-layout">
                <div class="dossier-sidebar">
                    <div id="modalInfoView" class="sub-view">
                        <div class="dossier-block">
                            <div class="dossier-label">${statusText}</div>
                            ${statusDisplay}
                        </div>
                        <div class="dossier-block">
                            <div class="dossier-label">MERIT VALUE</div>
                            <div class="m-points-lg" style="color:${isRejected ? 'red' : (isPending ? 'cyan' : 'gold')}">${isPending ? "CALCULATING" : "+" + pts}</div>
                        </div>
                    </div>
                    <div id="modalFeedbackView" class="sub-view hidden">
                        <div class="dossier-label">OFFICER NOTES</div>
                        <div class="theater-text-box">${(item.adminComment || "No notes.").replace(/\n/g, '<br>')}</div>
                    </div>
                    <div id="modalTaskView" class="sub-view hidden">
                        <div class="dossier-label">DIRECTIVE</div>
                        <div class="theater-text-box">${(item.text || "").replace(/\n/g, '<br>')}</div>
                    </div>
                </div>
            </div>
            <div class="modal-footer-menu">
                <button onclick="event.stopPropagation(); window.toggleHistoryView('feedback')" class="history-action-btn">NOTES</button>
                <button onclick="event.stopPropagation(); window.toggleHistoryView('task')" class="history-action-btn">ORDER</button>
                <button onclick="event.stopPropagation(); window.toggleHistoryView('proof')" class="history-action-btn">EVIDENCE</button>
                <button onclick="event.stopPropagation(); window.toggleHistoryView('info')" class="history-action-btn">DATA</button>
                ${footerAction}
            </div>
        `;
    }

    toggleHistoryView('info');
    document.getElementById('glassModal').classList.add('active');
}

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

export function closeModal(e) {
    if (e && (e.target.id === 'modalCloseX' || e.target.classList.contains('btn-close-red'))) {
        document.getElementById('glassModal').classList.remove('active');
        document.getElementById('modalMediaContainer').innerHTML = "";
        return;
    }

    const overlay = document.getElementById('modalGlassOverlay');
    if (overlay && overlay.classList.contains('clean')) {
        toggleHistoryView('info'); 
        return;
    }
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
};
