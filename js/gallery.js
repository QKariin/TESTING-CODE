// gallery.js - TRILOGY LAYOUT (CLEANED & FIXED)
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

// --- CONSTANTS ---
const STICKER_APPROVE = "https://static.wixstatic.com/media/ce3e5b_a19d81b7f45c4a31a4aeaf03a41b999f~mv2.png";
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

function normalizeGalleryItem(item) {
    if (item.proofUrl && typeof item.proofUrl === 'string' && item.proofUrl.length > 5) return;
    const candidates = ['media', 'file', 'evidence', 'url', 'image', 'src', 'attachment', 'photo'];
    for (let key of candidates) {
        if (item[key] && typeof item[key] === 'string' && item[key].length > 5) {
            item.proofUrl = item[key];
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
    
    const slot1 = { card: document.getElementById('altarSlot1'), img: document.getElementById('imgSlot1'), ref: document.getElementById('reflectSlot1') };
    const slot2 = { card: document.getElementById('altarSlot2'), img: document.getElementById('imgSlot2') };
    const slot3 = { card: document.getElementById('altarSlot3'), img: document.getElementById('imgSlot3') };

    if (!gridFailed || !gridOkay || !slot1.card) return;

    gridFailed.innerHTML = "";
    gridOkay.innerHTML = "";

    const allItems = getGalleryList(); 

    // SOLO MODE CHECK
    if (allItems.length === 0) {
        historySection.classList.add('solo-mode');
    } else {
        historySection.classList.remove('solo-mode');
    }

    // 1. TOP 3 (THE ALTAR)
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
        let thumb = getThumbnail(getOptimizedUrl(bestOf[1].proofUrl || bestOf[1].media, 300));
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

    // 2. MIDDLE (ARCHIVE)
    const middleItems = allItems.filter(item => {
        if (bestOf.includes(item)) return false; 
        const s = (item.status || "").toLowerCase();
        return !s.includes('rej') && !s.includes('fail');
    });

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

    // 3. BOTTOM (HEAP)
    const failedItems = allItems.filter(item => {
        const s = (item.status || "").toLowerCase();
        return s.includes('rej') || s.includes('fail');
    });

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

// --- MODAL: THRONE ROOM LAYOUT (CLICK ANYWHERE FIX) ---
export function openHistoryModal(index) {
    const items = getGalleryList();
    if (!items[index]) return;

    setCurrentHistoryIndex(index);
    const item = items[index];

    let url = item.proofUrl || item.media;
    const isVideo = url.match(/\.(mp4|webm|mov)($|\?)/i);
    const mediaContainer = document.getElementById('modalMediaContainer');
    
    if (mediaContainer) {
        mediaContainer.innerHTML = isVideo ? 
            `<video src="${url}" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:contain;"></video>` :
            `<img src="${url}" style="width:100%; height:100%; object-fit:contain;">`;
    }

    const pts = getPoints(item);
    const status = (item.status || "").toLowerCase();
    
    // Check Rejection
    const isRejected = status.includes('rej') || status.includes('fail') || status.includes('deni') || status.includes('refus');

    const overlay = document.getElementById('modalGlassOverlay');
    if (overlay) {
        // OVERLAY CLICK = CLOSE
        overlay.onclick = function() { window.closeModal(); };

        let verdictText = item.adminComment || "Logged without commentary.";
        if(isRejected && !item.adminComment) verdictText = "Submission rejected. Standards not met.";

        let redemptionBtn = '';
        if (isRejected) {
            redemptionBtn = `
                <button onclick="event.stopPropagation(); window.atoneForTask(${index})" 
                        class="btn-glass-silver" 
                        style="border-color:var(--neon-red); color:var(--neon-red); box-shadow: 0 0 10px rgba(255,0,60,0.1);">
                    SEEK REDEMPTION (-100 🪙)
                </button>`;
        }

        // NOTE: We REMOVED onclick="event.stopPropagation()" from modalUI.
        // This means clicking the card bubbles up to overlay and CLOSES it.
        // We added event.stopPropagation() to the BUTTONS so they DO NOT close it.
        overlay.innerHTML = `
            <div class="modal-center-col" id="modalUI">
                <div class="modal-merit-title">${isRejected ? "CAPITAL DEDUCTED" : "MERIT ACQUIRED"}</div>
                <div class="modal-merit-value" style="color:${isRejected ? '#ff003c' : 'var(--gold)'}">
                    ${isRejected ? "0" : "+" + pts}
                </div>
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

    document.getElementById('glassModal').classList.add('active');
    document.getElementById('glassModal').classList.remove('inspect-mode');
}

// --- ACTIONS: REDEMPTION & TOGGLES ---

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
    const endTimeVal = Date.now() + 86400000; 
    const newPendingState = { task: restoredTask, endTime: endTimeVal, status: "PENDING" };
    setPendingTaskState(newPendingState);

    window.closeModal(); 
    if(window.restorePendingUI) window.restorePendingUI();
    if(window.updateTaskUIState) window.updateTaskUIState(true);

    window.parent.postMessage({ type: "PURCHASE_ITEM", itemName: "Redemption", cost: 100, messageToDom: "Redemption Paid." }, "*");
    window.parent.postMessage({ type: "savePendingState", pendingState: newPendingState, consumeQueue: false }, "*");
};

window.toggleDirective = function(index) {
    const items = getGalleryList(); 
    const item = items[index];
    if (!item) return;
    const box = document.getElementById('verdictBox');
    
    if (box.dataset.view === 'task') {
        let verdictText = item.adminComment || "Logged without commentary.";
        const status = (item.status || "").toLowerCase();
        if((status.includes('rej') || status.includes('fail')) && !item.adminComment) {
             verdictText = "Submission rejected. Standards not met.";
        }
        box.innerText = `"${verdictText}"`;
        box.style.color = "#eee"; box.style.fontStyle = "italic"; box.dataset.view = 'verdict';
    } else {
        box.innerText = item.text || "No directive data available.";
        box.style.color = "#ccc"; box.style.fontStyle = "normal"; box.dataset.view = 'task';
    }
};

window.toggleInspectMode = function() {
    const modal = document.getElementById('glassModal');
    modal.classList.add('inspect-mode');
    setTimeout(() => {
        const bg = document.querySelector('.modal-bg-photo');
        if(bg) bg.onclick = function() {
            modal.classList.remove('inspect-mode');
            bg.onclick = null; 
        };
    }, 100);
};

// --- CLOSE LOGIC ---
export function closeModal(e) {
    const modal = document.getElementById('glassModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.classList.remove('inspect-mode');
    setTimeout(() => {
        const container = document.getElementById('modalMediaContainer');
        if (container) container.innerHTML = "";
    }, 300);
}

// --- REQUIRED EXPORTS ---
export function loadMoreHistory() {
    setHistoryLimit(historyLimit + 25);
    renderGallery();
}

window.renderGallery = renderGallery;
window.openHistoryModal = openHistoryModal;
window.closeModal = closeModal;
window.setGalleryFilter = function(filterType) {
    activeStickerFilter = filterType;
    renderGallery(); 
};
