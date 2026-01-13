// gallery.js - POINTS DISPLAY FIXED

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

// --- HELPER: SMART POINTS FINDER (THE FIX) ---
function getPoints(item) {
    // Check all possible database field names
    let val = item.points || item.score || item.value || item.amount || item.reward || 0;
    return Number(val);
}

// --- HELPER: GET SORTED LIST ---
function getGalleryList() {
    if (!galleryData) return [];

    let items = galleryData.filter(i => {
        const s = (i.status || "").toLowerCase();
        return (s.includes('app') || s.includes('rej')) && i.proofUrl;
    });

    if (activeStickerFilter === "DENIED") {
        items = items.filter(item => (item.status || "").toLowerCase().includes('rej'));
    } 
    else if (activeStickerFilter !== "ALL" && activeStickerFilter !== "PENDING") {
        items = items.filter(item => item.sticker === activeStickerFilter);
    }

    // Sort by Points (Desc) -> Date
    return items.sort((a, b) => {
        const pointsA = getPoints(a);
        const pointsB = getPoints(b);
        if (pointsB !== pointsA) return pointsB - pointsA;
        return new Date(b._createdDate) - new Date(a._createdDate);
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

    const pGrid = document.getElementById('pendingGrid');
    const hGrid = document.getElementById('historyGrid');
    const pSection = document.getElementById('pendingSection');
    
    renderStickerFilters();

    // PENDING
    const showPending = (activeStickerFilter === 'ALL' || activeStickerFilter === 'PENDING');
    const pItems = galleryData.filter(i => (i.status || "").toLowerCase() === 'pending' && i.proofUrl);
    
    if (pGrid) pGrid.innerHTML = pItems.slice(0, pendingLimit).map(createPendingCardHTML).join('');
    
    if (pSection) {
        if (showPending && pItems.length > 0) {
            pSection.classList.remove('hidden');
            pSection.style.display = 'block';
        } else {
            pSection.classList.add('hidden');
            pSection.style.display = 'none';
        }
    }
    
    // HISTORY
    const showHistory = (activeStickerFilter !== 'PENDING');
    const hItems = getGalleryList(); 

    if (hGrid) {
        hGrid.innerHTML = hItems.slice(0, historyLimit).map((item, index) => createGalleryItemHTML(item, index)).join('');
        hGrid.style.display = (showHistory && hItems.length > 0) ? 'grid' : 'none';
    }
    
    const loadBtn = document.getElementById('loadMoreBtn');
    if (loadBtn) loadBtn.style.display = (showHistory && hItems.length > historyLimit) ? 'block' : 'none';
}

function createPendingCardHTML(item) {
    const cleanText = cleanHTML(item.text).replace(/"/g, '&quot;');
    const isVideo = item.proofUrl.match(/\.(mp4|webm|mov)$/i);
    let thumb = getOptimizedUrl(item.proofUrl, 400);
    const encUrl = encodeURIComponent(item.proofUrl || "");
    const encText = encodeURIComponent(item.text || "");
    
    return `<div class="pending-card" onclick='window.openModal("${encUrl}", "PENDING", "${encText}", ${isVideo ? true : false})'>
                <div class="pc-media">
                    ${isVideo 
                        ? `<video src="${thumb}" class="pc-thumb" muted style="object-fit:cover;"></video>` 
                        : `<img src="${thumb}" class="pc-thumb" loading="lazy">`
                    }
                    <div class="pc-gradient"></div>
                </div>
                <div class="pc-content"><div class="pc-badge">PENDING</div><div class="pc-title">${cleanText}</div></div>
            </div>`;
}

function createGalleryItemHTML(item, index) {
    let thumbUrl = getOptimizedUrl(item.proofUrl, 300); //
    const s = (item.status || "").toLowerCase(); //
    const statusSticker = s.includes('app') ? STICKER_APPROVE : STICKER_DENIED; //
    const isVideo = (item.proofUrl || "").match(/\.(mp4|webm|mov)($|\?)/i); //

    let safeSticker = item.sticker; //
    if (safeSticker && (safeSticker.includes("profile") || safeSticker.includes("avatar"))) safeSticker = null; //
    
    const pts = getPoints(item); //

    return `
        <div class="gallery-item" onclick='window.openHistoryModal(${index})'>
            ${isVideo 
                ? `<video src="${thumbUrl}" class="gi-thumb" muted style="opacity: ${s.includes('rej') ? '0.3' : '0.8'};"></video>` 
                : `<img src="${thumbUrl}" class="gi-thumb" loading="lazy" style="opacity: ${s.includes('rej') ? '0.3' : '0.8'};">`
            }

            <img src="${statusSticker}" class="gi-status-overlay">

            ${safeSticker ? `<img src="${safeSticker}" class="gi-reward-sticker" style="position:absolute; bottom:5px; left:5px; width:30px; height:30px; z-index:10;">` : ''}
            
            ${pts > 0 ? `
            <div class="merit-tag">
                <div class="tag-label">MERIT</div>
                <div class="tag-val">+${pts}</div>
            </div>` : ''}

            <div class="corner-target tl"></div>
            <div class="corner-target tr"></div>
            <div class="corner-target bl"></div>
            <div class="corner-target br"></div>
        </div>`;
}

// --- MODAL CLICK HANDLERS ---

export function openHistoryModal(index) {
    const historyItems = getGalleryList();
    if (!historyItems[index]) return;
    
    setCurrentHistoryIndex(index);
    const item = historyItems[index];

    // 1. HANDLE MEDIA (Left Side)
    const isVideo = item.proofUrl.match(/\.(mp4|webm|mov)($|\?)/i);
    const mediaContainer = document.getElementById('modalMediaContainer');
    if (mediaContainer) {
        mediaContainer.innerHTML = isVideo 
            ? `<video src="${item.proofUrl}" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:contain;"></video>`
            : `<img src="${item.proofUrl}" style="width:100%; height:100%; object-fit:contain;">`;
    }

    // 2. HANDLE DATA (Right Side Dossier)
    const overlay = document.getElementById('modalGlassOverlay');
    if (overlay) {
        // Clean up stickers
        let safeSticker = item.sticker;
        if (safeSticker && (safeSticker.includes("profile") || safeSticker.includes("avatar"))) safeSticker = null;
        const rewardStickerHTML = safeSticker ? `<img src="${safeSticker}" style="width:80px; height:80px; object-fit:contain; margin-top:10px;">` : "";

        // Status Stamp
        const s = (item.status || "").toLowerCase();
        const statusImg = s.includes('app') ? STICKER_APPROVE : STICKER_DENIED;
        
        // Points (The Fix)
        const pts = getPoints(item);

        overlay.innerHTML = `
            <div id="modalCloseX" onclick="window.closeModal(event)" style="position:absolute; top:20px; right:20px; font-size:2rem; cursor:pointer; color:white; z-index:110;">×</div>
            
            <div class="theater-content dossier-layout">
                <div class="dossier-sidebar">
                    
                    <div class="dossier-block">
                        <div class="dossier-label">SYSTEM VERDICT</div>
                        <div class="stamp-container">
                            <img id="modalStatusSticker" src="${statusImg}" class="m-status-sticker-lg" style="height:100px; width:auto; transform: rotate(-10deg); opacity:0.8;">
                        </div>
                    </div>

                    <div class="dossier-block">
                        <div class="dossier-label">MERIT ACQUIRED</div>
                        <div class="reward-container">
                            <div id="modalPoints" class="m-points-lg" style="color:var(--gold); font-family:'Rajdhani'; font-size:3rem; font-weight:700;">+${pts}</div>
                            ${rewardStickerHTML}
                        </div>
                    </div>

                    <div id="modalFeedbackView" class="sub-view">
                        <div class="dossier-label">QUEEN'S FEEDBACK</div>
                        <div id="modalFeedbackText" class="theater-text-box">${(item.adminComment || "The Queen has observed your work.").replace(/\n/g, '<br>')}</div>
                    </div>

                    <div id="modalTaskView" class="sub-view hidden">
                        <div class="dossier-label">ORIGINAL ASSIGNMENT</div>
                        <div id="modalOrderText" class="theater-text-box">${(item.text || "No description.").replace(/\n/g, '<br>')}</div>
                    </div>

                </div>
            </div>

            <div class="modal-footer-menu dossier-footer" style="display:grid; grid-template-columns:1fr 1fr; gap:8px; width:100%; margin-top:auto; padding:20px; background:rgba(0,0,0,0.9); border-top:1px solid #333;">
                <button onclick="event.stopPropagation(); window.toggleHistoryView('feedback')" class="history-action-btn">FEEDBACK</button>
                <button onclick="event.stopPropagation(); window.toggleHistoryView('task')" class="history-action-btn">THE TASK</button>
                <button onclick="event.stopPropagation(); window.toggleHistoryView('proof')" class="history-action-btn" style="border-color:var(--gold); color:var(--gold);">SEE PROOF</button>
                <button onclick="event.stopPropagation(); window.toggleHistoryView('info')" class="history-action-btn">STATUS</button>
                <button onclick="event.stopPropagation(); window.closeModal(event)" class="history-action-btn btn-close-red" style="grid-column: span 2; color:#ff003c; border-color:#ff003c; margin-top:10px;">CLOSE ARCHIVE</button>
            </div>
        `;
    }

    // Default to show feedback
    window.toggleHistoryView('feedback');
    document.getElementById('glassModal').classList.add('active');
}
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

export function openModal(url, status, text, isVideo) {
    const mediaContainer = document.getElementById('modalMediaContainer');
    if (mediaContainer) {
        mediaContainer.innerHTML = isVideo 
            ? `<video src="${decodeURIComponent(url)}" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:contain;"></video>`
            : `<img src="${decodeURIComponent(url)}" style="width:100%; height:100%; object-fit:contain;">`;
    }
    const overlay = document.getElementById('modalGlassOverlay');
    if(overlay) {
        overlay.innerHTML = `
            <div id="modalCloseX" onclick="window.closeModal(event)" style="position:absolute; top:20px; right:20px; font-size:2.5rem; cursor:pointer; color:white; z-index:9999;">×</div>
            <div class="theater-content">
                <div class="m-points-lg" style="color:var(--neon-yellow);">PENDING</div>
                <div class="theater-text-box">${decodeURIComponent(text)}</div>
            </div>
            <div class="modal-footer-menu" style="grid-template-columns: 1fr;">
                <button onclick="window.closeModal(event)" class="history-action-btn btn-close-red">CLOSE</button>
            </div>
        `;
    }
    document.getElementById('glassModal').classList.add('active');
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

// FORCE EXPORT TO WINDOW
window.renderGallery = renderGallery;
window.openHistoryModal = openHistoryModal;
window.toggleHistoryView = toggleHistoryView;
window.closeModal = closeModal;
window.openModal = openModal;
window.setGalleryFilter = function(filterType) {
    activeStickerFilter = filterType;
    renderGallery(); 
};
