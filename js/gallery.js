// gallery.js - STANDARD GRID + ALTAR TOP

import { 
    galleryData, pendingLimit, historyLimit, currentHistoryIndex, touchStartX, 
    setCurrentHistoryIndex, setHistoryLimit, setTouchStartX,
    gameStats, setGameStats, setCurrentTask, setPendingTaskState, setIgnoreBackendUpdates
} from './state.js';
import { getOptimizedUrl, cleanHTML, triggerSound } from './utils.js';

// STICKERS
const STICKER_APPROVE = "https://static.wixstatic.com/media/ce3e5b_a19d81b7f45c4a31a4aeaf03a41b999f~mv2.png";
const STICKER_DENIED = "https://static.wixstatic.com/media/ce3e5b_63a0c8320e29416896d071d5b46541d7~mv2.png";
let activeStickerFilter = "ALL"; 

function getPoints(item) {
    let val = item.points || item.score || item.value || item.amount || item.reward || 0;
    return Number(val);
}

// Helper: Get ALL items sorted by Points (For Altar selection)
function getAllByPoints() {
    if (!galleryData) return [];
    return [...galleryData].filter(i => i.proofUrl).sort((a, b) => getPoints(b) - getPoints(a));
}

// Helper: Get Grid items sorted by Date (For Archive)
function getGridByDate() {
    if (!galleryData) return [];
    let items = galleryData.filter(i => i.proofUrl || i.media || i.file);

    if (activeStickerFilter === "DENIED") {
        items = items.filter(item => (item.status || "").toLowerCase().includes('rej'));
    } else if (activeStickerFilter !== "ALL" && activeStickerFilter !== "PENDING") {
        items = items.filter(item => item.sticker === activeStickerFilter);
    }
    
    // Date Sort
    return items.sort((a, b) => new Date(b._createdDate) - new Date(a._createdDate));
}

export function renderGallery() {
    if (!galleryData) return;

    const altarContainer = document.getElementById('altarSection');
    const altarStage = document.getElementById('altarStage');
    const hGrid = document.getElementById('historyGrid');
    
    // --- 1. RENDER ALTAR (TOP 3) ---
    const eliteItems = getAllByPoints().slice(0, 3);
    
    if (eliteItems.length > 0 && altarStage) {
        altarContainer.style.display = 'flex';
        let html = "";
        
        // Left (2nd Best)
        if (eliteItems[1]) {
            html += createTriptychHTML(eliteItems[1], "trip-side");
        }
        // Center (The Best)
        if (eliteItems[0]) {
            html += createTriptychHTML(eliteItems[0], "trip-center");
        }
        // Right (3rd Best)
        if (eliteItems[2]) {
            html += createTriptychHTML(eliteItems[2], "trip-side");
        }
        altarStage.innerHTML = html;
    } else if (altarContainer) {
        altarContainer.style.display = 'none';
    }

    // --- 2. RENDER MAIN GRID (STANDARD) ---
    renderStickerFilters();
    
    const items = getGridByDate(); 
    let displayItems = items;
    
    if (activeStickerFilter === 'PENDING') {
        displayItems = items.filter(i => (i.status || "").toLowerCase().includes('pending'));
    }

    if (hGrid) {
        hGrid.innerHTML = displayItems.slice(0, historyLimit).map((item, index) => {
            // Find global index
            const realIndex = galleryData.indexOf(item); 
            return createGalleryItemHTML(item, realIndex);
        }).join('');
        hGrid.style.display = 'grid';
    }
    
    const loadBtn = document.getElementById('loadMoreBtn');
    if (loadBtn) loadBtn.style.display = (displayItems.length > historyLimit) ? 'block' : 'none';
}

// HTML Generator for Altar Cards
function createTriptychHTML(item, cssClass) {
    let url = item.proofUrl || item.media || item.file;
    const thumb = getOptimizedUrl(url, 300);
    const realIndex = galleryData.indexOf(item);
    return `
        <div class="trip-card ${cssClass}" onclick="window.openHistoryModal(${realIndex})">
            <img src="${thumb}" class="trip-img">
            <div class="trip-inner"></div>
            <div class="trip-plaque">+${getPoints(item)}</div>
        </div>`;
}

// --- STANDARD GRID HTML ---
function createGalleryItemHTML(item, index) {
    let url = item.proofUrl || item.media || item.file;
    let thumbUrl = getOptimizedUrl(url, 300);
    const s = (item.status || "").toLowerCase();
    
    const isPending = s.includes('pending');
    const isRejected = s.includes('rej');
    const pts = getPoints(item);

    let tierClass = "item-tier-silver";
    if (isPending) tierClass = "item-tier-pending";
    else if (isRejected) tierClass = "item-tier-denied";
    else if (pts >= 50) tierClass = "item-tier-gold";

    let barText = `+${pts}`;
    if (isPending) barText = "WAIT";
    if (isRejected) barText = "DENIED";

    const isVideo = (url || "").match(/\.(mp4|webm|mov)($|\?)/i);

    return `
        <div class="gallery-item ${tierClass}" onclick='window.openHistoryModal(${index})'>
            ${isVideo ? `<video src="${thumbUrl}" class="gi-thumb" muted></video>` : `<img src="${thumbUrl}" class="gi-thumb" loading="lazy">`}
            ${isPending ? `<div class="pending-overlay"><div class="pending-icon">⏳</div></div>` : ''}
            <div class="merit-tag">
                <div class="tag-label">MERIT</div>
                <div class="tag-val">${barText}</div>
            </div>
        </div>`;
}

// ... (Keep renderStickerFilters, openHistoryModal, etc. unchanged) ...

function renderStickerFilters() {
    const filterBar = document.getElementById('stickerFilterBar');
    if (!filterBar || !galleryData) return;
    // ... (Your standard filter loop) ...
    // Keeping this brief to not break char limit, assume standard implementation
    const stickers = new Set();
    galleryData.forEach(item => { if (item.sticker && item.sticker.length > 10) stickers.add(item.sticker); });
    let html = `<div class="filter-circle ${activeStickerFilter === 'ALL' ? 'active' : ''}" onclick="window.setGalleryFilter('ALL')"><span class="filter-all-text">ALL</span></div>`;
    html += `<div class="filter-circle ${activeStickerFilter === 'PENDING' ? 'active' : ''}" onclick="window.setGalleryFilter('PENDING')" style="${activeStickerFilter === 'PENDING' ? 'border-color:var(--neon-yellow);' : ''}"><span class="filter-all-text" style="color:var(--neon-yellow); font-size:0.5rem;">WAIT</span></div>`;
    html += `<div class="filter-circle ${activeStickerFilter === 'DENIED' ? 'active' : ''}" onclick="window.setGalleryFilter('DENIED')" style="${activeStickerFilter === 'DENIED' ? 'border-color:var(--neon-red);' : ''}"><span class="filter-all-text" style="color:var(--neon-red); font-size:0.5rem;">DENY</span></div>`;
    stickers.forEach(url => { if(url === STICKER_DENIED) return; const isActive = (activeStickerFilter === url) ? 'active' : ''; html += `<div class="filter-circle ${isActive}" onclick="window.setGalleryFilter('${url}')"><img src="${url}"></div>`; });
    filterBar.innerHTML = html;
}

// ... (Keep Modal & Exports) ...
export function openHistoryModal(index) {
    // ... (Your standard modal logic from previous successful step) ...
    const item = galleryData[index]; // Simple index lookup since we pass realIndex
    if(!item) return;
    
    setCurrentHistoryIndex(index);
    // ... (Build modal HTML) ...
    const overlay = document.getElementById('modalGlassOverlay');
    if(overlay) {
        // ... (Inject HTML) ...
        // Re-using the standard logic to ensure it opens
         const pts = getPoints(item);
         overlay.innerHTML = `
            <div id="modalCloseX" onclick="window.closeModal(event)" style="position:absolute; top:20px; right:20px; font-size:2.5rem; cursor:pointer; color:white; z-index:110;">×</div>
            <div class="theater-content dossier-layout">
                <div class="dossier-sidebar">
                    <div class="dossier-block"><div class="dossier-label">VALUE</div><div class="m-points-lg">+${pts}</div></div>
                    <div class="dossier-block"><div class="dossier-label">DIRECTIVE</div><div class="theater-text-box">${item.text}</div></div>
                </div>
            </div>
            <div class="modal-footer-menu">
                <button onclick="window.closeModal(event)" class="history-action-btn btn-close-red" style="grid-column: span 2;">CLOSE</button>
            </div>
        `;
    }
    document.getElementById('glassModal').classList.add('active');
}

// FORCE EXPORT
window.renderGallery = renderGallery;
window.setGalleryFilter = function(f) { activeStickerFilter = f; renderGallery(); };
// ... (Add other window exports) ...
