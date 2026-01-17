// gallery.js - TRILOGY LAYOUT + MOBILE DASHBOARD SYNC (CLEAN)
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
const STICKER_DENIED = "https://static.wixstatic.com/media/ce3e5b_63a0c8320e29416896d071d5b46541d7~mv2.png";
const IMG_QUEEN_MAIN = "https://static.wixstatic.com/media/ce3e5b_5fc6a144908b493b9473757471ec7ebb~mv2.png";
const IMG_STATUE_SIDE = "https://static.wixstatic.com/media/ce3e5b_5424edc9928d49e5a3c3a102cb4e3525~mv2.png";
const IMG_MIDDLE_EMPTY = "https://static.wixstatic.com/media/ce3e5b_1628753a2b5743f1bef739cc392c67b5~mv2.webp";
const IMG_BOTTOM_EMPTY = "https://static.wixstatic.com/media/ce3e5b_33f53711eece453da8f3d04caddd7743~mv2.png";

let activeStickerFilter = "ALL";

// --- HELPERS ---
function getPoints(item) {
    let val = item.points || item.score || item.value || item.amount || item.reward || 0;
    return Number(val);
}

// NORMALIZE DATA
let normalizedCache = new Set();
function normalizeGalleryItem(item) {
    const cacheKey = item._id || item._createdDate;
    if (normalizedCache.has(cacheKey)) return;
    
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

function getGalleryList() {
    if (!galleryData || !Array.isArray(galleryData)) return [];
    galleryData.forEach(normalizeGalleryItem);
    
    let items = galleryData.filter(i => {
        const s = (i.status || "").toLowerCase();
        return (s.includes('pending') || s.includes('app') || s.includes('rej') || s === "") && i.proofUrl;
    });

    if (activeStickerFilter === "DENIED") {
        items = items.filter(item => (item.status || "").toLowerCase().includes('rej'));
    } else if (activeStickerFilter === "PENDING") {
        items = items.filter(item => (item.status || "").toLowerCase().includes('pending'));
    } else if (activeStickerFilter !== "ALL") {
        items = items.filter(item => item.sticker === activeStickerFilter);
    }

    return items.sort((a, b) => new Date(b._createdDate) - new Date(a._createdDate));
}

// --- MAIN RENDERER ---
export async function renderGallery() {
    if (!galleryData) return;

    const gridFailed = document.getElementById('gridFailed'); 
    const gridOkay = document.getElementById('gridOkay');     
    const historySection = document.getElementById('historySection');
    
    // Desktop Altar Elements
    const slot1 = { card: document.getElementById('altarSlot1'), img: document.getElementById('imgSlot1'), ref: document.getElementById('reflectSlot1') };
    const slot2 = { card: document.getElementById('altarSlot2'), img: document.getElementById('imgSlot2') };
    const slot3 = { card: document.getElementById('altarSlot3'), img: document.getElementById('imgSlot3') };
    
    // Mobile Altar Elements
    const mob1 = document.getElementById('mobImgSlot1');
    const mob2 = document.getElementById('mobImgSlot2');
    const mob3 = document.getElementById('mobImgSlot3');

    if (!gridFailed || !gridOkay) return;

    gridFailed.innerHTML = "";
    gridOkay.innerHTML = "";

    const allItems = getGalleryList(); 

    if (historySection) {
        if (allItems.length === 0) historySection.classList.add('solo-mode');
        else historySection.classList.remove('solo-mode');
    }

    // --- 1. TOP 3 (THE ALTAR) ---
    let bestOf = [...allItems]
        .filter(item => {
            const s = (item.status || "").toLowerCase();
            return !s.includes('rej') && !s.includes('fail') && !s.includes('pending');
        })
        .sort((a, b) => getPoints(b) - getPoints(a))
        .slice(0, 3);

    const getThumb = async (item, size) => {
        return await getSignedUrl(getThumbnail(getOptimizedUrl(item.proofUrl || item.media, size)));
    };

    // RANK 1
    if (bestOf[0]) {
        let thumb = await getThumb(bestOf[0], 400);
        let realIndex = allItems.indexOf(bestOf[0]);

        if(slot1.card) {
            slot1.card.style.display = 'flex';
            slot1.img.src = thumb;
            if(slot1.ref) slot1.ref.src = thumb;
            slot1.card.onclick = () => window.openHistoryModal(realIndex);
            slot1.img.style.filter = "none";
        }
        if(mob1) {
            mob1.src = thumb;
            mob1.onclick = () => window.openHistoryModal(realIndex);
        }
    } else {
        if(slot1.card) {
            slot1.img.src = IMG_QUEEN_MAIN;
            if(slot1.ref) slot1.ref.src = IMG_QUEEN_MAIN;
            slot1.card.onclick = null;
            slot1.img.style.filter = "grayscale(30%)";
        }
        if(mob1) mob1.src = IMG_QUEEN_MAIN;
    }

    // RANK 2
    if (bestOf[1]) {
        let thumb = await getThumb(bestOf[1], 300);
        let realIndex = allItems.indexOf(bestOf[1]);

        if(slot2.card) {
            slot2.card.style.display = 'flex';
            slot2.img.src = thumb;
            slot2.card.onclick = () => window.openHistoryModal(realIndex);
        }
        if(mob2) {
            mob2.src = thumb;
            mob2.onclick = () => window.openHistoryModal(realIndex);
        }
    } else {
        if(slot2.img) slot2.img.src = IMG_STATUE_SIDE;
        if(mob2) mob2.src = IMG_STATUE_SIDE;
    }

    // RANK 3
    if (bestOf[2]) {
        let thumb = await getThumb(bestOf[2], 300);
        let realIndex = allItems.indexOf(bestOf[2]);

        if(slot3.card) {
            slot3.card.style.display = 'flex';
            slot3.img.src = thumb;
            slot3.card.onclick = () => window.openHistoryModal(realIndex);
        }
        if(mob3) {
            mob3.src = thumb;
            mob3.onclick = () => window.openHistoryModal(realIndex);
        }
    } else {
        if(slot3.img) slot3.img.src = IMG_STATUE_SIDE;
        if(mob3) mob3.src = IMG_STATUE_SIDE;
    }


    // --- 2. MIDDLE (ARCHIVE) ---
    const middleItems = allItems.filter(item => {
        if (bestOf.includes(item)) return false; 
        const s = (item.status || "").toLowerCase();
        return !s.includes('rej') && !s.includes('fail');
    });

    let middleHtml = '';
    if (middleItems.length === 0 && allItems.length > 0) {
        for(let i=0; i<6; i++) middleHtml += `<div class="item-placeholder-slot"><img src="${IMG_MIDDLE_EMPTY}"></div>`;
        gridOkay.innerHTML = middleHtml;
    } else if (middleItems.length > 0) {
        const middlePromises = middleItems.map(item => getSignedUrl(getOptimizedUrl(item.proofUrl || item.media, 300)));
        const middleThumbs = await Promise.all(middlePromises);
        
        for (let i = 0; i < middleItems.length; i++) {
            const item = middleItems[i];
            const thumb = middleThumbs[i];
            const realIndex = allItems.indexOf(item);
            const isPending = (item.status || "").toLowerCase().includes('pending');
            const overlay = isPending ? `<div class="pending-overlay"><div class="pending-icon">⏳</div></div>` : ``;

            middleHtml += `
                <div class="item-blueprint" onclick="window.openHistoryModal(${realIndex})">
                    <img class="blueprint-img" src="${thumb}" loading="lazy">
                    <div class="bp-corner bl-tl"></div><div class="bp-corner bl-tr"></div>
                    <div class="bp-corner bl-bl"></div><div class="bp-corner bl-br"></div>
                    ${overlay}
                </div>`;
        }
        gridOkay.innerHTML = middleHtml;
    }

    // --- 3. BOTTOM (HEAP) ---
    const failedItems = allItems.filter(item => {
        const s = (item.status || "").toLowerCase();
        return s.includes('rej') || s.includes('fail');
    });

    let failedHtml = '';
    if (failedItems.length === 0 && allItems.length > 0) {
        for(let i=0; i<6; i++) failedHtml += `<div class="item-placeholder-slot"><img src="${IMG_BOTTOM_EMPTY}"></div>`;
        gridFailed.innerHTML = failedHtml;
    } else if (failedItems.length > 0) {
        const failedPromises = failedItems.map(item => getSignedUrl(getOptimizedUrl(item.proofUrl || item.media, 300)));
        const failedThumbs = await Promise.all(failedPromises);
        
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

    const restoredTask = { text: task.text, category: 'redemption', timestamp: Date.now() };
    setCurrentTask(restoredTask);

    const newPendingState = { task: restoredTask, endTime: Date.now() + 86400000, status: "PENDING" };
    setPendingTaskState(newPendingState);

    window.closeModal(); 
    if(window.restorePendingUI) window.restorePendingUI();
    if(window.updateTaskUIState) window.updateTaskUIState(true);
    if(window.toggleTaskDetails) window.toggleTaskDetails(true);

    window.parent.postMessage({ type: "PURCHASE_ITEM", itemName: "Redemption", cost: 100, messageToDom: "Slave paid 100 coins to retry failed task." }, "*");
    window.parent.postMessage({ type: "savePendingState", pendingState: newPendingState, consumeQueue: false }, "*");
};

// --- MODAL LOGIC ---
export async function openHistoryModal(index) {
    const items = getGalleryList();
    if (!items[index]) return;

    setCurrentHistoryIndex(index);
    const item = items[index];

    let url = item.proofUrl || item.media;
    const isVideo = mediaType(url) === 'video';
    url = await getSignedUrl(url);
    const mediaContainer = document.getElementById('modalMediaContainer');
    
    if (mediaContainer) {
        mediaContainer.innerHTML = isVideo ? 
            `<video src="${url}" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:contain;"></video>` :
            `<img src="${url}" style="width:100%; height:100%; object-fit:contain;">`;
    }

    const pts = getPoints(item);
    const status = (item.status || "").toLowerCase();
    const isRejected = status.includes('rej') || status.includes('fail') || status.includes('deni') || status.includes('refus');

    const overlay = document.getElementById('modalGlassOverlay');
    if (overlay) {
        let verdictText = item.adminComment || "Logged without commentary.";
        if(isRejected && !item.adminComment) verdictText = "Submission rejected. Standards not met.";

        let redemptionBtn = isRejected ? `
            <button onclick="event.stopPropagation(); window.atoneForTask(${index})" 
                    class="btn-glass-silver" style="border-color:var(--neon-red); color:var(--neon-red);">
                SEEK REDEMPTION (-100 🪙)
            </button>` : '';

        overlay.innerHTML = `
            <div class="modal-center-col" id="modalUI">
                <div class="modal-merit-title">${isRejected ? "CAPITAL DEDUCTED" : "MERIT ACQUIRED"}</div>
                <div class="modal-merit-value" style="color:${isRejected ? '#ff003c' : 'var(--gold)'}">${isRejected ? "0" : "+" + pts}</div>
                <div class="modal-verdict-box" id="verdictBox">"${verdictText}"</div>
                <div class="modal-btn-stack">
                    <button onclick="event.stopPropagation(); window.toggleDirective(${index})" class="btn-glass-silver">THE DIRECTIVE</button>
                    <button onclick="event.stopPropagation(); window.toggleInspectMode()" class="btn-glass-silver">INSPECT OFFERING</button>
                    ${redemptionBtn}
                    <button onclick="window.closeModal()" class="btn-glass-silver btn-glass-red">DISMISS</button>
                </div>
            </div>
        `;
    }

    const glassModal = document.getElementById('glassModal');
    if (glassModal) {
        glassModal.onclick = (e) => window.closeModal(e);
        glassModal.classList.add('active');
        glassModal.classList.remove('inspect-mode');
    }
}

// TOGGLE DIRECTIVE (HTML FIX)
window.toggleDirective = function(index) {
    const items = getGalleryList(); 
    const item = items[index];
    if (!item) return;

    const box = document.getElementById('verdictBox');
    
    if (box.dataset.view === 'task') {
        let verdictText = item.adminComment || "Logged without commentary.";
        const status = (item.status || "").toLowerCase();
        if((status.includes('rej') || status.includes('fail')) && !item.adminComment) verdictText = "Submission rejected. Standards not met.";
        
        box.innerText = `"${verdictText}"`;
        box.style.color = "#eee";
        box.style.fontStyle = "italic";
        box.dataset.view = 'verdict';
    } else {
        // USE INNERHTML FOR FORMATTING
        box.innerHTML = item.text || "No directive data available.";
        box.style.color = "#ccc";
        box.style.fontStyle = "normal";
        box.dataset.view = 'task';
    }
};

export function toggleHistoryView(view) {
    const modal = document.getElementById('glassModal');
    const overlay = document.getElementById('modalGlassOverlay');
    if (!modal || !overlay) return;

    if (view === 'proof') {
        modal.classList.add('proof-mode-active');
        overlay.classList.add('clean');
    } else {
        modal.classList.remove('proof-mode-active');
        overlay.classList.remove('clean');
    }
}

export function closeModal(e) {
    if(e && e.stopPropagation) e.stopPropagation();
    const modal = document.getElementById('glassModal');
    if (modal) {
        modal.classList.remove('active');
        modal.classList.remove('inspect-mode');
    }
    const media = document.getElementById('modalMediaContainer');
    if (media) media.innerHTML = "";
}

export function initModalSwipeDetection() {
    const modalEl = document.getElementById('glassModal');
    if (!modalEl) return;
    modalEl.addEventListener('touchstart', e => setTouchStartX(e.changedTouches[0].screenX), { passive: true });
    modalEl.addEventListener('touchend', e => {
        const diff = touchStartX - e.changedTouches[0].screenX;
        if (Math.abs(diff) > 80) {
            let nextIndex = diff > 0 ? currentHistoryIndex + 1 : currentHistoryIndex - 1;
            let items = getGalleryList();
            if (nextIndex >= 0 && nextIndex < items.length) openHistoryModal(nextIndex);
        }
    }, { passive: true });
}

window.toggleInspectMode = function() {
    const modal = document.getElementById('glassModal');
    if (modal) modal.classList.toggle('inspect-mode');
};

// Global Listeners for Modal Interaction
window.addEventListener('click', function(e) {
    const modal = document.getElementById('glassModal');
    const card = document.getElementById('modalUI');
    if (!modal || !modal.classList.contains('active')) return;
    if (card && card.contains(e.target)) return; 

    if (modal.classList.contains('inspect-mode') && modal.contains(e.target)) {
        modal.classList.remove('inspect-mode');
        return;
    }
    window.closeModal();
}, true);

// FORCE EXPORTS
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
