// gallery.js - FIXED & ROBUST
import { 
    galleryData, historyLimit, currentHistoryIndex, touchStartX, 
    setCurrentHistoryIndex, setHistoryLimit, setTouchStartX,
    gameStats, setGameStats, setCurrentTask, setPendingTaskState
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

// --- HELPER: NORMALIZE DATA ---
function normalizeGalleryItem(item) {
    // If proofUrl exists and is valid, keep it
    if (item.proofUrl && typeof item.proofUrl === 'string' && item.proofUrl.length > 5) return item;

    // Search for any possible image key
    const candidates = ['media', 'file', 'evidence', 'url', 'image', 'src', 'attachment', 'photo'];
    for (let key of candidates) {
        if (item[key] && typeof item[key] === 'string' && item[key].length > 5) {
            item.proofUrl = item[key];
            break;
        }
    }
    return item;
}

// --- HELPER: GET SORTED LIST ---
function getGalleryList() {
    if (!galleryData || !Array.isArray(galleryData)) return [];

    // Normalize everything first so we have proofUrl ready
    let items = galleryData.map(normalizeGalleryItem).filter(i => {
        const s = (i.status || "").toLowerCase();
        const hasUrl = i.proofUrl && i.proofUrl.length > 5;
        
        // Return only items that have an image and a valid status
        return hasUrl && (s.includes('pending') || s.includes('app') || s.includes('rej') || s === "");
    });

    // Apply Filters
    if (activeStickerFilter === "DENIED") {
        items = items.filter(item => (item.status || "").toLowerCase().includes('rej'));
    } 
    else if (activeStickerFilter === "PENDING") {
        items = items.filter(item => (item.status || "").toLowerCase().includes('pending'));
    }
    else if (activeStickerFilter !== "ALL") {
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
        <div class="filter-circle ${activeStickerFilter === 'PENDING' ? 'active' : ''}" onclick="window.setGalleryFilter('PENDING')" style="${activeStickerFilter === 'PENDING' ? 'border-color:cyan;' : ''}">
            <span class="filter-all-text" style="color:cyan; font-size:0.5rem;">WAIT</span>
        </div>
        <div class="filter-circle ${activeStickerFilter === 'DENIED' ? 'active' : ''}" onclick="window.setGalleryFilter('DENIED')" style="${activeStickerFilter === 'DENIED' ? 'border-color:red;' : ''}">
            <span class="filter-all-text" style="color:red; font-size:0.5rem;">DENY</span>
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

export function renderGallery() {
    const hGrid = document.getElementById('historyGrid');
    if (!hGrid || !galleryData) return;

    renderStickerFilters();

    const items = getGalleryList(); 

    if (items.length > 0) {
        hGrid.innerHTML = items.slice(0, historyLimit).map((item, index) => createGalleryItemHTML(item, index)).join('');
        hGrid.style.display = 'grid';
    } else {
        hGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px; color:#444;">NO RECORDS FOUND</div>';
    }
    
    const loadBtn = document.getElementById('loadMoreBtn');
    if (loadBtn) loadBtn.style.display = (items.length > historyLimit) ? 'block' : 'none';
}

function createGalleryItemHTML(item, index) {
    let url = item.proofUrl || PLACEHOLDER_IMG;
    let thumbUrl = getOptimizedUrl(url, 300);
    const s = (item.status || "").toLowerCase();
    
    const isPending = s.includes('pending') || s === "";
    const isRejected = s.includes('rej') || s.includes('fail');
    const pts = getPoints(item);

    let tierClass = "item-tier-silver";
    if (isPending) tierClass = "item-tier-pending";
    else if (isRejected) tierClass = "item-tier-denied";
    else if (pts >= 50) tierClass = "item-tier-gold";
    else if (pts < 10) tierClass = "item-tier-bronze";

    let barText = `+${pts}`;
    if (isPending) barText = "WAIT";
    if (isRejected) barText = "DENIED";

    const isVideo = (url || "").match(/\.(mp4|webm|mov)($|\?)/i);

    return `
        <div class="gallery-item ${tierClass}" onclick='window.openHistoryModal(${index})'>
            ${isVideo 
                ? `<video src="${thumbUrl}" class="gi-thumb" muted loop></video>` 
                : `<img src="${thumbUrl}" class="gi-thumb" loading="lazy" onerror="this.src='${PLACEHOLDER_IMG}'">`
            }
            ${isPending ? `<div class="pending-overlay">⏳</div>` : ''}
            <div class="merit-tag">
                <div class="tag-label">MERIT</div>
                <div class="tag-val">${barText}</div>
            </div>
        </div>`;
}

// --- MODAL & ACTIONS ---

window.atoneForTask = function(index) {
    const items = getGalleryList();
    const task = items[index];
    if (!task || gameStats.coins < 100) return;

    triggerSound('coinSound');
    setGameStats({ ...gameStats, coins: gameStats.coins - 100 });
    
    const newPendingState = { 
        task: { text: task.text, category: 'redemption', timestamp: Date.now() }, 
        endTime: Date.now() + 86400000, 
        status: "PENDING" 
    };
    
    setPendingTaskState(newPendingState);
    window.closeModal();
    renderGallery();
};

export function openHistoryModal(index) {
    const items = getGalleryList();
    const item = items[index];
    if (!item) return;
    
    setCurrentHistoryIndex(index);
    let url = item.proofUrl;
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
        
        let statusImg = s.includes('app') ? STICKER_APPROVE : (isRejected ? STICKER_DENIED : "");
        let statusDisplay = isPending ? `<div style="font-size:3rem;">⏳</div>` : `<img src="${statusImg}" style="width:100px;">`;

        overlay.innerHTML = `
            <div id="modalCloseX" onclick="window.closeModal(event)">×</div>
            <div class="theater-content">
                <div class="dossier-block">
                    <div class="dossier-label">STATUS</div>
                    ${statusDisplay}
                </div>
                <div class="dossier-block">
                    <div class="dossier-label">POINTS</div>
                    <div class="m-points-lg">${pts}</div>
                </div>
            </div>
            <div class="modal-footer-menu">
                <button onclick="window.closeModal(event)" class="history-action-btn">CLOSE</button>
                ${isRejected ? `<button onclick="window.atoneForTask(${index})" class="history-action-btn">ATONE (-100)</button>` : ''}
            </div>`;
    }
    document.getElementById('glassModal').classList.add('active');
}

export function closeModal(e) {
    document.getElementById('glassModal').classList.remove('active');
}

export function loadMoreHistory() {
    setHistoryLimit(historyLimit + 25);
    renderGallery();
}

// --- WINDOW EXPORTS ---
window.renderGallery = renderGallery;
window.openHistoryModal = openHistoryModal;
window.closeModal = closeModal;
window.setGalleryFilter = (type) => { activeStickerFilter = type; renderGallery(); };
window.loadMoreHistory = loadMoreHistory;
