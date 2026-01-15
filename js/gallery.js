
// gallery.js - MERGED GRID (SORTED BY DATE)

import { 
    galleryData, pendingLimit, historyLimit, currentHistoryIndex, touchStartX, 
    setCurrentHistoryIndex, setHistoryLimit, setTouchStartX 
} from './state.js';
import { getOptimizedUrl, cleanHTML } from './utils.js';

// STICKERS
const STICKER_APPROVE = "https://static.wixstatic.com/media/ce3e5b_a19d81b7f45c4a31a4aeaf03a41b999f~mv2.png";
const STICKER_DENIED = "https://static.wixstatic.com/media/ce3e5b_63a0c8320e29416896d071d5b46541d7~mv2.png";

let activeStickerFilter = "ALL"; 

// --- HELPER: DATA NORMALIZER ---
function normalizeGalleryItem(item) {
    if (item.proofUrl) return; 
    const candidates = ['media', 'file', 'evidence', 'url', 'image', 'src'];
    for (let key of candidates) {
        if (item[key] && typeof item[key] === 'string') {
            item.proofUrl = item[key];
            return;
        }
    }
}

// --- HELPER: POINTS FINDER ---
function getPoints(item) {
    let val = item.points || item.score || item.value || item.amount || item.reward || 0;
    return Number(val);
}

// --- HELPER: GET MERGED LIST ---
function getGalleryList() {
    if (!galleryData) return [];

    // 1. Filter: Allow Pending, Approved, AND Rejected
    let items = galleryData.filter(i => {
        const s = (i.status || "").toLowerCase();
        return (s.includes('pending') || s.includes('app') || s.includes('rej')) && i.proofUrl;
    });

    // 2. Apply Filter Bar
    if (activeStickerFilter === "PENDING") {
        // Show ONLY Pending
        items = items.filter(item => (item.status || "").toLowerCase().includes('pending'));
    }
    else if (activeStickerFilter === "DENIED") {
        // Show ONLY Rejected
        items = items.filter(item => (item.status || "").toLowerCase().includes('rej'));
    } 
    else if (activeStickerFilter !== "ALL") {
        // Show Specific Sticker
        items = items.filter(item => item.sticker === activeStickerFilter);
    }

    // 3. SORT: BY DATE (NEWEST FIRST)
    // Pending items are usually newest, so they will naturally float to the top
    return items.sort((a, b) => {
        return new Date(b._createdDate || b.timestamp) - new Date(a._createdDate || a.timestamp);
    });
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
    if (!galleryData) return;
    galleryData.forEach(normalizeGalleryItem);

    const hGrid = document.getElementById('historyGrid');
    renderStickerFilters();

    // GET EVERYTHING (Pending + History mixed)
    const items = getGalleryList(); 

    if (hGrid) {
        hGrid.innerHTML = items.slice(0, historyLimit).map((item, index) => createGalleryItemHTML(item, index)).join('');
        hGrid.style.display = 'grid';
    }
    
    const loadBtn = document.getElementById('loadMoreBtn');
    if (loadBtn) loadBtn.style.display = (items.length > historyLimit) ? 'block' : 'none';
}

// NOTE: createPendingCardHTML is deleted because we don't use the separate grid anymore.
// Pending items now use the unified card design below.

function createGalleryItemHTML(item, index) {
    let thumbUrl = getOptimizedUrl(item.proofUrl, 300);
    const s = (item.status || "").toLowerCase();
    const statusSticker = s.includes('app') ? STICKER_APPROVE : STICKER_DENIED;
    const isVideo = (item.proofUrl || "").match(/\.(mp4|webm|mov)($|\?)/i);

    let safeSticker = item.sticker;
    if (safeSticker && (safeSticker.includes("profile") || safeSticker.includes("avatar"))) safeSticker = null;
    
    const pts = getPoints(item);
    
    // Logic for Pending vs History
    const isPending = s.includes('pending');
    
    const pendingHTML = isPending ? 
        `<div class="pending-overlay">
            <div class="pending-icon">⏳</div>
            <div class="pending-text">REVIEWING</div>
         </div>` : '';

    const footerHTML = isPending ? 
        `<div class="merit-tag" style="border-color:var(--neon-yellow);">
            <div class="tag-label" style="color:var(--neon-yellow);">STATUS</div>
            <div class="tag-val" style="color:#fff;">WAIT</div>
         </div>` 
        : 
        (pts > 0 ? 
        `<div class="merit-tag">
            <div class="tag-label">MERIT</div>
            <div class="tag-val">+${pts}</div>
         </div>` : '');

    return `
        <div class="gallery-item ${isPending ? 'is-pending' : ''}" onclick='window.openHistoryModal(${index})'>
            ${isVideo 
                ? `<video src="${thumbUrl}" class="gi-thumb" muted style="object-fit:cover;"></video>` 
                : `<img src="${thumbUrl}" class="gi-thumb" loading="lazy">`
            }

            ${pendingHTML}

            ${!isPending ? `<img src="${statusSticker}" class="gi-status-overlay">` : ''}

            ${safeSticker ? `<img src="${safeSticker}" class="gi-reward-sticker">` : ''}
            
            ${footerHTML}
        </div>`;
}

// --- MODAL LOGIC ---
export function openHistoryModal(index) {
    const items = getGalleryList();
    if (!items[index]) return;
    
    setCurrentHistoryIndex(index);
    const item = items[index];
    const s = (item.status || "").toLowerCase();
    const isPending = s.includes('pending');

    const isVideo = item.proofUrl.match(/\.(mp4|webm|mov)($|\?)/i);
    const mediaContainer = document.getElementById('modalMediaContainer');
    if (mediaContainer) {
        mediaContainer.innerHTML = isVideo 
            ? `<video src="${item.proofUrl}" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:contain;"></video>`
            : `<img src="${item.proofUrl}" style="width:100%; height:100%; object-fit:contain;">`;
    }

    const overlay = document.getElementById('modalGlassOverlay');
    if (overlay) {
        let safeSticker = item.sticker;
        if (safeSticker && (safeSticker.includes("profile") || safeSticker.includes("avatar"))) safeSticker = null;
        const stickerHTML = safeSticker ? `<img src="${safeSticker}" style="width:120px; height:120px; object-fit:contain; margin-bottom:15px;">` : "";

        // Status Image Logic
        let statusImg = "";
        let statusText = "SYSTEM VERDICT";
        
        if (isPending) {
            statusText = "AWAITING REVIEW";
            // No image for pending, or use a clock icon
        } else {
            statusImg = s.includes('app') ? STICKER_APPROVE : STICKER_DENIED;
        }

        const statusDisplay = isPending 
            ? `<div style="font-size:3rem;">⏳</div>` 
            : `<img src="${statusImg}" style="width:100px; height:100px; object-fit:contain; margin-bottom:15px; opacity:0.8;">`;

        const pts = getPoints(item);

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
                            <div class="dossier-label">MERIT ACQUIRED</div>
                            <div id="modalPoints" class="m-points-lg" style="color:var(--gold); font-family:'Rajdhani'; font-size:3.5rem; font-weight:700;">
                                ${isPending ? "CALCULATING..." : "+" + pts}
                            </div>
                            ${stickerHTML}
                        </div>
                    </div>

                    <div id="modalFeedbackView" class="sub-view hidden">
                        <div class="dossier-label">QUEEN'S FEEDBACK</div>
                        <div class="theater-text-box">${(item.adminComment || "Pending review.").replace(/\n/g, '<br>')}</div>
                    </div>

                    <div id="modalTaskView" class="sub-view hidden">
                        <div class="dossier-label">ORIGINAL DIRECTIVE</div>
                        <div class="theater-text-box">${(item.text || "No description.").replace(/\n/g, '<br>')}</div>
                    </div>
                </div>
            </div>

            <div class="modal-footer-menu" style="display:grid; grid-template-columns:1fr 1fr; gap:8px; width:100%; margin-top:auto; padding:20px; background:rgba(0,0,0,0.95); z-index:100;">
                <button onclick="event.stopPropagation(); window.toggleHistoryView('feedback')" class="history-action-btn">FEEDBACK</button>
                <button onclick="event.stopPropagation(); window.toggleHistoryView('task')" class="history-action-btn">THE TASK</button>
                <button onclick="event.stopPropagation(); window.toggleHistoryView('proof')" class="history-action-btn" style="border-color:var(--gold); color:var(--gold);">SEE PROOF</button>
                <button onclick="event.stopPropagation(); window.toggleHistoryView('info')" class="history-action-btn">STATUS</button>
                <button onclick="event.stopPropagation(); window.closeModal(event)" class="history-action-btn btn-close-red" style="grid-column: span 2; margin-top:10px;">CLOSE ARCHIVE</button>
            </div>
        `;
    }

    toggleHistoryView('info');
    document.getElementById('glassModal').classList.add('active');
}

export function toggleHistoryView(view) {
    const modal = document.getElementById('glassModal');
    const overlay = document.getElementById('modalGlassOverlay');
    if (!modal || !overlay) return;

    // isInProofMode = (view === 'proof');

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

export function openModal(url, status, text, isVideo) {
    // Legacy support (redirects to history modal logic if possible, 
    // but this is mostly used for pending from other places)
    // Since everything is in history now, this might not be needed much.
}

export function loadMoreHistory() {
    setHistoryLimit(historyLimit + 25);
    renderGallery();
}

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

// FORCE EXPORT
window.renderGallery = renderGallery;
window.openHistoryModal = openHistoryModal;
window.toggleHistoryView = toggleHistoryView;
window.closeModal = closeModal;
window.openModal = openModal;
window.setGalleryFilter = function(filterType) {
    activeStickerFilter = filterType;
    renderGallery(); 
};
