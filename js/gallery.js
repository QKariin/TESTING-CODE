// gallery.js - TRILOGY LAYOUT (FIXED FOR BYTESCALE)
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
    setPendingTaskState,
    userProfile
} from './state.js';
import { triggerSound } from './utils.js';
import { getOptimizedUrl, getThumbnail, getSignedUrl } from './media.js';

// --- NEW IMPORT: BYTESCALE HELPERS ---
import { isBytescaleUrl, getThumbnailBytescale } from './mediaBytescale.js';

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

// --- HELPER: NORMALIZE DATA ---
let normalizedCache = new Set();

function normalizeGalleryItem(item) {
    if (!item) return;

    // 1. Ensure Status is a String
    if (!item.status) item.status = "";

    // Use item ID/timestamp as cache key
    const cacheKey = item._id || item._createdDate;
    if (normalizedCache.has(cacheKey)) return;

    // 2. Find Proof URL (Aggressive Search)
    if (!item.proofUrl || item.proofUrl.length < 5) {
        const candidates = ['media', 'file', 'evidence', 'url', 'image', 'src', 'attachment', 'photo', 'cover', 'thumbnail', 'poster'];
        for (let key of candidates) {
            if (item[key] && typeof item[key] === 'string' && item[key].length > 5) {
                if (key === 'avatar') continue; // User does not want profile pics as evidence
                item.proofUrl = item[key];
                break;
            }
        }
    }
    normalizedCache.add(cacheKey);
}

// --- HELPER: SORTED LIST ---
function getSortedGallery() {
    if (!galleryData) return [];
    return [...galleryData].sort((a, b) => new Date(b._createdDate) - new Date(a._createdDate));
}

// --- HELPER: GET FILTERED LIST ---
function getGalleryList() {
    if (!galleryData || !Array.isArray(galleryData)) return [];

    // Normalize data structure first
    galleryData.forEach(normalizeGalleryItem);

    // FILTER: Service Record (Altar)
    let items = galleryData.filter(i => {
        // 1. Basic Check: Must have data
        if (!i) return false;

        // 2. Must have VISUAL PROOF (Fixes empty Altar slots)
        if (!i.proofUrl || i.proofUrl.length < 5) return false;

        // 3. THE SEPARATOR (Based on category)
        const cat = (i.category || "").toLowerCase();
        const txt = (i.text || "").toLowerCase();

        // Hide "Routine" & "System" updates
        if (cat === 'routine' || txt.includes('daily routine')) return false;
        if (cat === 'profile' || cat === 'system' || cat === 'level' || cat === 'badge' || cat === 'rank') return false;

        // 4. BLOCK AVATARS (Image Comparison)
        if (userProfile && userProfile.profilePicture && i.proofUrl) {
            if (i.proofUrl === userProfile.profilePicture) return false;
            if (userProfile.profilePicture.includes(i.proofUrl)) return false;
            const p1 = i.proofUrl.split('/').pop().split('.')[0];
            const p2 = userProfile.profilePicture.split('/').pop().split('.')[0];
            if (p1.length > 5 && p1 === p2) return false;
        }

        return true;
    });

    // Apply Sticker Filters
    if (activeStickerFilter === "DENIED") {
        items = items.filter(item => (item.status || "").toLowerCase().includes('rej'));
    } else if (activeStickerFilter === "PENDING") {
        items = items.filter(item => (item.status || "").toLowerCase().includes('pending'));
    } else if (activeStickerFilter !== "ALL") {
        items = items.filter(item => item.sticker === activeStickerFilter);
    }

    // Sort Newest First
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
        if (url === STICKER_DENIED) return;
        const isActive = (activeStickerFilter === url) ? 'active' : '';
        html += `<div class="filter-circle ${isActive}" onclick="window.setGalleryFilter('${url}')"><img src="${url}"></div>`;
    });

    filterBar.innerHTML = html;
}

export async function renderGallery() {
    if (!galleryData) return;

    // --- 0. STATE CHECK ---
    const newestItem = galleryData.length > 0 ? galleryData[0]._createdDate : "0";
    const stateSig = `${galleryData.length}-${newestItem}-${activeStickerFilter}`;
    if (window.lastGalleryRenderState === stateSig) return;
    window.lastGalleryRenderState = stateSig;

    // --- 1. TARGETS ---
    const gridFailed = document.getElementById('gridFailed');
    const gridOkay = document.getElementById('gridOkay');
    const gridPending = document.getElementById('gridPending');
    const historySection = document.getElementById('historySection');

    // Altar Slots
    const slot1 = { card: document.getElementById('altarSlot1'), img: document.getElementById('imgSlot1'), ref: document.getElementById('reflectSlot1') };
    const slot2 = { card: document.getElementById('altarSlot2'), img: document.getElementById('imgSlot2') };
    const slot3 = { card: document.getElementById('altarSlot3'), img: document.getElementById('imgSlot3') };

    // Mobile Altar Slots
    const mob1 = document.getElementById('mobRec_Slot1');
    const mob2 = document.getElementById('mobRec_Slot2');
    const mob3 = document.getElementById('mobRec_Slot3');

    // Mobile Lists
    const recGrid = document.getElementById('mobRec_Grid');
    const recHeap = document.getElementById('mobRec_Heap');

    if (!gridFailed || !gridOkay) return;

    // Reset
    gridFailed.innerHTML = "";
    gridOkay.innerHTML = "";
    if (gridPending) gridPending.innerHTML = "";
    if (recGrid) recGrid.innerHTML = "";
    if (recHeap) recHeap.innerHTML = "";

    // --- 2. GET DATA ---
    const allItems = getGalleryList();

    if (historySection) {
        if (allItems.length === 0) historySection.classList.add('solo-mode');
        else historySection.classList.remove('solo-mode');
    }

    // --- 3. SEPARATE LISTS ---
    // A. Denied
    const deniedList = allItems.filter(item => {
        const s = (item.status || "").toLowerCase();
        return s.includes('rej') || s.includes('fail') || s.includes('deni') || s.includes('refus');
    });

    // B. Pending
    const pendingList = allItems.filter(item => {
        const s = (item.status || "").toLowerCase();
        if (s === "") return true;
        return s.includes('pending') || s.includes('wait') || s.includes('review') || s.includes('process');
    });

    // C. Accepted
    const candidates = allItems.filter(item => {
        if (deniedList.includes(item)) return false;
        if (pendingList.includes(item)) return false;
        return true;
    });

    // --- 4. ALTAR SORTING ---
    candidates.sort((a, b) => {
        const statsA = getPoints(a);
        const statsB = getPoints(b);
        if (statsB !== statsA) return statsB - statsA;
        return new Date(b.date || b._createdDate) - new Date(a.date || a._createdDate);
    });

    let bestOf = [];
    if (candidates.length > 0) bestOf.push(candidates.shift());
    if (candidates.length > 0) bestOf.push(candidates.shift());
    if (candidates.length > 0) bestOf.push(candidates.shift());

    // --- 5. IMAGE LOADER (THE FIX FOR BYTESCALE) ---
    const getThumb = (item, size = 300) => {
        if (!item) return PLACEHOLDER_IMG;

        let raw = item.proofUrl || item.media || item.url || item.image || "";
        if (!raw || raw.length < 5) return PLACEHOLDER_IMG;

        // *** THE FIX: INTERCEPT BYTESCALE URLS ***
        // If it comes from upcdn.io, force it to be a thumbnail (JPG).
        // This solves 3 problems:
        // 1. Videos (mp4) become Image Posters
        // 2. HEIC files (iPhone) become JPGs
        // 3. Huge Raw files become small thumbnails
        if (isBytescaleUrl(raw)) {
            return getThumbnailBytescale(raw);
        }

        // --- Standard Logic for Non-Bytescale ---
        
        // 1. External URL Pass-through (Firebase/Other)
        if (raw.startsWith('http') && !raw.includes('wix:')) {
             if (/\.(jpg|jpeg|png|webp|gif)$/i.test(raw.split('?')[0])) {
                 return raw; 
             }
             // If generic http video/unknown, return raw (might fail in img tag)
             // or return placeholder. For now, try raw.
             return raw; 
        }

        let finalId = "";

        // 2. Extract Wix ID
        if (raw.startsWith('wix:image')) {
            finalId = raw.split('/')[3];
        } 
        else if (raw.startsWith('wix:video')) {
            const posterMatch = raw.match(/posterUri=([^&]+)/);
            finalId = posterMatch ? posterMatch[1] : "";
        }
        else {
            finalId = raw.split('/').pop().split('?')[0];
        }

        if (!finalId) return PLACEHOLDER_IMG;
        return `https://static.wixstatic.com/media/${finalId}/v1/fill/w_${size},h_${size},al_c,q_70/thumb.jpg`;
    };

    // --- 6. RENDER TRACKS ---
    const renderChunk = async (list, isTrash) => {
        if (!list || list.length === 0) return { desk: "", mob: "" };

        // We process these synchronously mapping to string to ensure order
        const results = list.map((item) => {
            const src = getThumb(item, 300); // Uses new logic
            const idx = allItems.indexOf(item);
            const imgStyle = isTrash ? 'filter: grayscale(100%) brightness(0.7);' : '';

            // Video Indicator (Visual Only)
            const rawUrl = (item.proofUrl || item.media || "").toLowerCase();
            const isVideo = rawUrl.includes('video') || rawUrl.includes('.mp4') || rawUrl.includes('.mov');
            const videoIcon = isVideo ? `<div class="video-indicator">▶</div>` : "";

            const mediaHtml = `<img class="${isTrash ? 'trash-img' : 'blueprint-img'}" 
                                   src="${src}" 
                                   loading="lazy" 
                                   style="${imgStyle}" 
                                   onerror="this.src='${PLACEHOLDER_IMG}'">`;

            const isPending = (item.status || "").toLowerCase().includes('pending');
            const overlay = isPending ? `<div class="pending-overlay"><div class="pending-badge">AWAITING<br>VERDICT</div></div>` : ``;
            const mobBadge = isPending ? `<div style="position:absolute; inset:0; background:rgba(0,0,0,0.6); display:flex; justify-content:center; align-items:center;"><div class="pending-badge" style="font-size:0.4rem; padding:3px; border-width:1px;">WATCHING</div></div>` : ``;

            let stickerHtml = "";
            if (item.sticker && !isTrash && !isPending) {
                stickerHtml = `<img src="${item.sticker}" class="gallery-sticker-badge">`;
            }

            const desk = `
                <div class="${isTrash ? 'item-trash' : 'item-blueprint'}" onclick="window.openHistoryModal(${idx})">
                    ${mediaHtml}
                    ${videoIcon}
                    ${stickerHtml}
                    ${isTrash ? '<div class="trash-stamp">DENIED</div>' : ''}
                    ${overlay}
                </div>`;

            const mob = `
                <div class="mob-scroll-item" onclick="window.openHistoryModal(${idx})" style="${isTrash ? 'height:80px; width:80px;' : ''}">
                    <img src="${src}" class="mob-scroll-img" loading="lazy" style="${imgStyle}" onerror="this.src='${PLACEHOLDER_IMG}'">
                    ${videoIcon}
                    ${stickerHtml}
                    ${mobBadge}
                </div>`;

            return { desk, mob };
        });

        return { desk: results.map(r => r.desk).join(''), mob: results.map(r => r.mob).join('') };
    };

    // --- 7. EXECUTE RENDERS ---

    // A. Accepted
    const acceptedHTML = await renderChunk(candidates, false);
    gridOkay.innerHTML = acceptedHTML.desk;
    if (recGrid) recGrid.innerHTML += acceptedHTML.mob;

    // B. Pending
    if (pendingList.length > 0) {
        const pendingHTML = await renderChunk(pendingList, false);
        if (gridPending) gridPending.innerHTML = pendingHTML.desk;
        if (recGrid) recGrid.innerHTML = pendingHTML.mob + recGrid.innerHTML; // Prepend pending
    }

    // C. Denied
    const deniedHTML = await renderChunk(deniedList, true);
    gridFailed.innerHTML = deniedHTML.desk;
    if (recHeap) recHeap.innerHTML = deniedHTML.mob;

    // --- 8. RENDER DESKTOP ALTAR ---
    const renderAltarSlot = (item, slotObj, isMain) => {
        if (!item || !slotObj.card) {
            if (slotObj.card) slotObj.card.style.display = 'none';
            return;
        }
        slotObj.card.style.display = 'flex';

        let url = getThumb(item, isMain ? 800 : 400);

        if (slotObj.img) {
            slotObj.img.src = url;
            slotObj.img.onerror = function () { this.src = PLACEHOLDER_IMG; };
        }
        if (slotObj.ref) {
            slotObj.ref.src = url;
            slotObj.ref.onerror = function () { this.src = PLACEHOLDER_IMG; };
        }

        const scoreEl = document.getElementById(isMain ? 'scoreSlot1' : (slotObj === slot2 ? 'scoreSlot2' : 'scoreSlot3'));
        if (scoreEl) scoreEl.innerText = getPoints(item);
    };

    renderAltarSlot(bestOf[0], slot1, true);
    renderAltarSlot(bestOf[1], slot2, false);
    renderAltarSlot(bestOf[2], slot3, false);

    // --- 9. RENDER MOBILE ALTAR ---
    const renderMobSlot = (item, el, size) => {
        if (!el) return;
        if (item) {
            let url = getThumb(item, size);
            el.src = url;
            el.style.filter = "none";
            el.onerror = function () {
                this.src = IMG_QUEEN_MAIN;
                this.style.filter = "grayscale(100%) brightness(0.5)";
            };
            el.onclick = () => window.openHistoryModal(allItems.indexOf(item));
        } else {
            el.src = IMG_QUEEN_MAIN;
            el.style.filter = "grayscale(100%) brightness(0.5)";
        }
    };

    renderMobSlot(bestOf[0], mob1, 400);

    if (!bestOf[0] && mob1) {
        mob1.src = "https://static.wixstatic.com/media/ce3e5b_5fc6a144908b493b9473757471ec7ebb~mv2.png";
        mob1.style.filter = "grayscale(100%) brightness(0.5)";
    }

    renderMobSlot(bestOf[1], mob2, 300);
    renderMobSlot(bestOf[2], mob3, 300);
}

// --- HISTORY LOADER ---
export function loadMoreHistory() {
    setHistoryLimit(historyLimit + 25);
    window.lastGalleryRenderState = null;
    renderGallery();
    console.log("Increased history limit to", historyLimit);
}

// --- FORCE WINDOW EXPORTS ---
window.renderGallery = renderGallery;
window.setGalleryFilter = function (filterType) {
    activeStickerFilter = filterType;
    window.lastGalleryRenderState = null;
    renderGallery();
};

// --- REDEMPTION LOGIC ---
window.atoneForTask = function (index) {
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
    if (coinEl) coinEl.innerText = gameStats.coins;

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

    if (window.restorePendingUI) window.restorePendingUI();
    if (window.updateTaskUIState) window.updateTaskUIState(true);
    if (window.toggleTaskDetails) window.toggleTaskDetails(true);

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

// MODAL OPENER
export async function openHistoryModal(index) {
    const items = getGalleryList();
    if (!items[index]) return;

    setCurrentHistoryIndex(index);
    const item = items[index];

    // 1. Setup Background Media
    let url = item.proofUrl || item.media;
    
    // --- BYTESCALE MODAL FIX ---
    // In the Modal, we WANT the Video to play (if possible), 
    // but we still need to handle HEIC or Unsigned files.
    // For now, let's trust the raw URL in the modal or sign it if needed.
    // Bytescale raw URLs usually play in <video> tags if the browser supports the format.
    
    const isVideo = (url || "").includes('.mp4') || (url || "").includes('.mov') || (url || "").includes('video');
    
    const mediaContainer = document.getElementById('modalMediaContainer');

    if (mediaContainer) {
        mediaContainer.innerHTML = isVideo ?
            `<video src="${url}" autoplay loop muted playsinline controls style="width:100%; height:100%; object-fit:contain;"></video>` :
            `<img src="${url}" style="width:100%; height:100%; object-fit:contain;">`;
    }

    // 2. Setup Data
    const pts = getPoints(item);
    const status = (item.status || "").toLowerCase();
    const isRejected = status.includes('rej') || status.includes('fail') || status.includes('deni') || status.includes('refus');

    // 3. Build UI
    const overlay = document.getElementById('modalGlassOverlay');
    if (overlay) {
        let verdictText = item.adminComment || "Logged without commentary.";
        if (isRejected && !item.adminComment) verdictText = "Submission rejected. Standards not met.";

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
        document.getElementById('viewMobileHome').style.overflow = 'hidden';
    }
}

// TOGGLE DIRECTIVE
window.toggleDirective = function (index) {
    const items = getGalleryList();
    const item = items[index];
    if (!item) return;

    const box = document.getElementById('verdictBox');

    if (box.dataset.view === 'task') {
        let verdictText = item.adminComment || "Logged without commentary.";
        const status = (item.status || "").toLowerCase();
        if ((status.includes('rej') || status.includes('fail')) && !item.adminComment) {
            verdictText = "Submission rejected. Standards not met.";
        }
        box.innerText = `"${verdictText}"`;
        box.style.color = "#eee";
        box.style.fontStyle = "italic";
        box.dataset.view = 'verdict';
    } else {
        box.innerHTML = item.text || "No directive data available.";
        box.style.color = "#ccc";
        box.style.fontStyle = "normal";
        box.dataset.view = 'task';
    }
};

// VIEW HELPERS
export function toggleHistoryView(view) {
    const modal = document.getElementById('glassModal');
    const overlay = document.getElementById('modalGlassOverlay');
    if (!modal || !overlay) return;

    const views = ['modalInfoView', 'modalFeedbackView', 'modalTaskView'];
    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
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
        if (target) target.classList.remove('hidden');
    }
}

export function closeModal(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    const modal = document.getElementById('glassModal');
    if (modal) {
        modal.classList.remove('active');
        modal.classList.remove('inspect-mode');
    }
    const media = document.getElementById('modalMediaContainer');
    if (media) media.innerHTML = "";
    document.getElementById('viewMobileHome').style.overflow = 'auto';
}

export function openModal() { }

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

window.toggleInspectMode = function () {
    const modal = document.getElementById('glassModal');
    if (modal) modal.classList.toggle('inspect-mode');
};

window.addEventListener('click', function (e) {
    const modal = document.getElementById('glassModal');
    const card = document.getElementById('modalUI');
    if (!modal || !modal.classList.contains('active')) return;
    if (card && card.contains(e.target)) return;
    if (modal.classList.contains('inspect-mode')) {
        if (modal.contains(e.target)) {
            modal.classList.remove('inspect-mode');
            return;
        }
    }
    window.closeModal();
}, true);

window.toggleMobileMenu = function () {
    const sidebar = document.querySelector('.layout-left');
    if (sidebar) sidebar.classList.toggle('mobile-open');
};

document.addEventListener('click', (e) => {
    if (e.target.closest('.nav-btn, .kneel-bar-graphic')) {
        const sidebar = document.querySelector('.layout-left');
        if (sidebar) sidebar.classList.remove('mobile-open');
    }
});

// Force Exports
window.renderGallery = renderGallery;
window.openHistoryModal = openHistoryModal;
window.toggleHistoryView = toggleHistoryView;
window.closeModal = closeModal;
window.loadMoreHistory = loadMoreHistory;
