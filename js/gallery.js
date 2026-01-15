// gallery.js - TRILOGY LAYOUT (FIXED)
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
import { getOptimizedUrl, triggerSound } from './utils.js';

// STICKERS
const STICKER_APPROVE = "https://static.wixstatic.com/media/ce3e5b_a19d81b7f45c4a31a4aeaf03a41b999f~mv2.png";
const STICKER_DENIED = "https://static.wixstatic.com/media/ce3e5b_63a0c8320e29416896d071d5b46541d7~mv2.png";
const PLACEHOLDER_IMG = "https://static.wixstatic.com/media/ce3e5b_1bd27ba758ce465fa89a36d70a68f355~mv2.png";

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

    // 1. Get Containers
    const gridFailed = document.getElementById('gridFailed'); // Bottom
    const gridOkay = document.getElementById('gridOkay');     // Middle
    
    // Altar Elements
    const slot1 = { card: document.getElementById('altarSlot1'), img: document.getElementById('imgSlot1'), ref: document.getElementById('reflectSlot1'), txt: document.getElementById('scoreSlot1') };
    const slot2 = { card: document.getElementById('altarSlot2'), img: document.getElementById('imgSlot2'), txt: document.getElementById('scoreSlot2') };
    const slot3 = { card: document.getElementById('altarSlot3'), img: document.getElementById('imgSlot3'), txt: document.getElementById('scoreSlot3') };

    // Safety Check
    if (!gridFailed || !gridOkay || !slot1.card) return;

    // Clear Lists
    gridFailed.innerHTML = "";
    gridOkay.innerHTML = "";

    // 2. Get All Items
    const allItems = getGalleryList(); // Uses your existing filter logic

    // 3. Find TOP 3 for the Altar (By Score, Approved Only)
    // We clone the array to sort by score without messing up the date sort for later
    let bestOf = [...allItems]
        .filter(item => {
            const s = (item.status || "").toLowerCase();
            return !s.includes('rej') && !s.includes('fail') && !s.includes('pending');
        })
        .sort((a, b) => getPoints(b) - getPoints(a))
        .slice(0, 3); // Take top 3

    // --- RENDER ALTAR (Rank 1) ---
    if (bestOf[0]) {
        let item = bestOf[0];
        let thumb = getOptimizedUrl(item.proofUrl || item.media, 400);
        let realIndex = allItems.indexOf(item); // Find original index for click

        slot1.card.style.display = 'flex';
        slot1.img.src = thumb;
        if(slot1.ref) slot1.ref.src = thumb;
        slot1.txt.innerText = "+" + getPoints(item);
        slot1.card.onclick = () => window.openHistoryModal(realIndex);
    } else { slot1.card.style.display = 'none'; }

    // --- RENDER LEFT (Rank 2) ---
    if (bestOf[1]) {
        let item = bestOf[1];
        let thumb = getOptimizedUrl(item.proofUrl || item.media, 300);
        let realIndex = allItems.indexOf(item);

        slot2.card.style.display = 'flex';
        slot2.img.src = thumb;
        slot2.txt.innerText = "+" + getPoints(item);
        slot2.card.onclick = () => window.openHistoryModal(realIndex);
    } else { slot2.card.style.display = 'none'; }

    // --- RENDER RIGHT (Rank 3) ---
    if (bestOf[2]) {
        let item = bestOf[2];
        let thumb = getOptimizedUrl(item.proofUrl || item.media, 300);
        let realIndex = allItems.indexOf(item);

        slot3.card.style.display = 'flex';
        slot3.img.src = thumb;
        slot3.txt.innerText = "+" + getPoints(item);
        slot3.card.onclick = () => window.openHistoryModal(realIndex);
    } else { slot3.card.style.display = 'none'; }


    // 4. RENDER THE REST (Middle & Bottom)
    allItems.forEach((item, index) => {
        // SKIP if it's on the Altar
        if (bestOf.includes(item)) return;

        // Normal render logic
        let url = item.proofUrl || item.media || item.file;
        if (!url) return;
        
        let thumb = getOptimizedUrl(url, 300);
        let status = (item.status || "").toLowerCase();
        let isRejected = status.includes('rej') || status.includes('fail');
        let isPending = status.includes('pending');

        let html = "";

        // BOTTOM: FAILED
        if (isRejected) {
            html = `
                <div class="item-trash" onclick="window.openHistoryModal(${index})">
                    <img class="trash-img" src="${thumb}">
                    <div class="trash-stamp">DENIED</div>
                </div>`;
            gridFailed.innerHTML += html;
        } 
        // MIDDLE: EVERYTHING ELSE (Standard)
        else {
            const overlay = isPending ? 
                `<div class="pending-overlay"><div class="pending-icon">⏳</div></div>` : ``;

            html = `
                <div class="item-archive" onclick="window.openHistoryModal(${index})">
                    <img class="archive-img" src="${thumb}">
                    ${overlay}
                </div>`;
            gridOkay.innerHTML += html;
        }
    });
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
    const isVideo = url.match(/\.(mp4|webm|mov)($|\?)/i);

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
