// gallery.js - ROBUST SINGLE GRID (SHOWS EVERYTHING)

import { 
    galleryData, pendingLimit, historyLimit, currentHistoryIndex, touchStartX, 
    setCurrentHistoryIndex, setHistoryLimit, setTouchStartX,
    gameStats, setGameStats, setCurrentTask, setPendingTaskState, setIgnoreBackendUpdates
} from './state.js';
import { getOptimizedUrl, cleanHTML, triggerSound } from './utils.js';

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

// --- HELPER: FIND IMAGE (BRUTE FORCE) ---
function getValidImage(item) {
    // Check every possible field
    const candidates = [item.proofUrl, item.media, item.file, item.image, item.src, item.url, item.attachment];
    for (let c of candidates) {
        if (c && typeof c === 'string' && c.length > 5) return c;
    }
    return null; 
}

// --- HELPER: GET SORTED LIST ---
function getGalleryList() {
    if (!galleryData || !Array.isArray(galleryData)) return [];

    // 1. FILTER: Show ANYTHING with a picture.
    let items = galleryData.filter(i => getValidImage(i) !== null);

    // 2. APPLY UI FILTERS
    if (activeStickerFilter === "DENIED") {
        items = items.filter(item => (item.status || "").toLowerCase().includes('rej'));
    } 
    else if (activeStickerFilter === "PENDING") {
        items = items.filter(item => (item.status || "").toLowerCase().includes('pending'));
    }
    else if (activeStickerFilter !== "ALL") {
        items = items.filter(item => item.sticker === activeStickerFilter);
    }

    // 3. SORT: Date (Newest First)
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
        </div>`;

    stickers.forEach(url => {
        if(url === STICKER_DENIED) return;
        const isActive = (activeStickerFilter === url) ? 'active' : '';
        html += `
            <div class="filter-circle ${isActive}" onclick="window.setGalleryFilter('${url}')">
                <img src="${url}">
            </div>`;
    });

    filterBar.innerHTML = html;
}

window.setGalleryFilter = function(filterType) {
    activeStickerFilter = filterType;
    renderGallery(); 
};

export function renderGallery() {
    const hGrid = document.getElementById('historyGrid');
    
    // Safety check - if HTML is missing, stop silently
    if (!hGrid) return;

    renderStickerFilters();

    const items = getGalleryList(); 

    if (items.length > 0) {
        hGrid.innerHTML = items.slice(0, historyLimit).map((item, index) => createGalleryItemHTML(item, index)).join('');
        hGrid.style.display = 'grid';
    } else {
        hGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px; color:#444; font-family:Cinzel;">NO RECORDS FOUND</div>';
    }
    
    const loadBtn = document.getElementById('loadMoreBtn');
    if (loadBtn) loadBtn.style.display = (items.length > historyLimit) ? 'block' : 'none';
}

function createGalleryItemHTML(item, index) {
    let rawUrl = getValidImage(item) || PLACEHOLDER_IMG;
    let thumbUrl = getOptimizedUrl(rawUrl, 300);
    const s = (item.status || "").toLowerCase();
    
    // Loose Logic for Status
    const isPending = s.includes('pending') || s === "";
    const isRejected = s.includes('rej') || s.includes('fail') || s.includes('denied');
    const pts = getPoints(item);

    // --- TIER LOGIC ---
    let tierClass = "item-tier-silver";
    if (isPending) tierClass = "item-tier-pending";
    else if (isRejected) tierClass = "item-tier-denied";
    else if (pts >= 50) tierClass = "item-tier-gold";
    else if (pts < 10) tierClass = "item-tier-bronze";

    // --- TEXT LABEL ---
    let barText = `+${pts}`;
    if (isPending) barText = "WAIT";
    if (isRejected) barText = "DENIED";

    const isVideo = (rawUrl || "").match(/\.(mp4|webm|mov)($|\?)/i);

    return `
        <div class="gallery-item ${tierClass}" onclick='window.openHistoryModal(${index})'>
            ${isVideo 
                ? `<video src="${thumbUrl}" class="gi-thumb" muted loop></video>` 
                : `<img src="${thumbUrl}" class="gi-thumb" loading="lazy" onerror="this.src='${PLACEHOLDER_IMG}'">`
            }

            ${isPending ? `<div class="pending-overlay"><div class="pending-icon">⏳</div></div>` : ''}
            
            <div class="merit-tag">
                <div class="tag-label">MERIT</div>
                <div class="tag-val">${barText}</div>
            </div>
        </div>`;
}

// --- REDEMPTION LOGIC ---
window.atoneForTask = function(index) {
    const items = getGalleryList();
    const task = items[index];
    if (!task) return;

    if (gameStats.coins < 100) {
        triggerSound('sfx-deny');
        alert("Insufficient Capital.");
        return;
    }

    triggerSound('coinSound');
    setGameStats({ ...gameStats, coins: gameStats.coins - 100 });
    const coinEl = document.getElementById('coins');
    if(coinEl) coinEl.innerText = gameStats.coins;

    const restoredTask = { text: task.text, category: 'redemption', timestamp: Date.now() };
    setCurrentTask(restoredTask);
    
    const endTimeVal = Date.now() + 86400000; 
    const newPendingState = { task: restoredTask, endTime: endTimeVal, status: "PENDING" };
    setPendingTaskState(newPendingState);
    
    window.closeModal(); 
    
    // Switch to Active UI
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
    let url = getValidImage(item);
    
    const isVideo = url.match(/\.(mp4|webm|mov)($|\?)/i);
    const mediaContainer = document.getElementById('modalMediaContainer');
    if (mediaContainer) {
        mediaContainer.innerHTML = isVideo 
            ? `<video src="${url}" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:contain;"></video>`
            : `<img src="${url}" style="width:100%; height:100%; object-fit:contain;">`;
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

        const statusDisplay = isPending 
            ? `<div style="font-size:3rem;">⏳</div>` 
            : `<img src="${statusImg}" style="width:100px; height:100px; object-fit:contain; margin-bottom:15px; opacity:0.8;">`;

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
                            <div class="m-points-lg" style="color:${isRejected ? 'red' : (isPending ? 'cyan' : 'gold')}">
                                ${isPending ? "CALCULATING" : "+" + pts}
                            </div>
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
    document.getElementById('glassModal').classList.remove('active');
    document.getElementById('modalMediaContainer').innerHTML = "";
}

// REQUIRED EXPORT for main.js
export function loadMoreHistory() {
    setHistoryLimit(historyLimit + 25);
    renderGallery();
}

export function openModal() {} 
export function initModalSwipeDetection() {}

// FORCE WINDOW EXPORTS (CRITICAL FOR BUTTONS)
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
