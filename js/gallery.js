
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
    setPendingTaskState,
    userProfile
} from './state.js';
import { triggerSound } from './utils.js';
import { getOptimizedUrl, getThumbnail, getSignedUrl } from './media.js';

// STICKERS
const STICKER_APPROVE = "https://static.wixstatic.com/media/ce3e5b_a19d81b7f45c4a31a4aeaf03a41b999f~mv2.png";
const STICKER_DENIED = "https://static.wixstatic.com/media/ce3e5b_63a0c8320e29416896d071d5b46541d7~mv2.png";
const PLACEHOLDER_IMG = "https://static.wixstatic.com/media/ce3e5b_33f53711eece453da8f3d04caddd7743~mv2.png";
const IMG_QUEEN_MAIN = "https://static.wixstatic.com/media/ce3e5b_5fc6a144908b493b9473757471ec7ebb~mv2.png";
const IMG_STATUE_SIDE = "https://static.wixstatic.com/media/ce3e5b_5424edc9928d49e5a3c3a102cb4e3525~mv2.png";
const IMG_MIDDLE_EMPTY = "https://static.wixstatic.com/media/ce3e5b_1628753a2b5743f1bef739cc392c67b5~mv2.webp";

// "FOREVER FIX" BLACKLIST: Exact Wix IDs of Queen headshots/avatars
const BLACKLIST_IDS = [
    '5fc6a144908b493b9473757471ec7ebb', // Queen Main Avatar
    '1bd27ba758ce465fa89a36d70a68f355', // Previous Placeholder (Queen Headshot)
    'ce3e5b_5fc6a144908b493b9473757471ec7ebb',
    'ce3e5b_1bd27ba758ce465fa89a36d70a68f355'
];

let activeStickerFilter = "ALL";

// --- HELPER: POINTS ---
function getPoints(item) {
    let val = item.points || item.score || item.value || item.amount || item.reward || 0;
    return Number(val);
}

// --- HELPER: BLACKLIST CHECK ---
function isBlacklisted(url) {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase();
    // 1. Text-based blacklist
    if (lower.includes('avatar') || lower.includes('profilepic') || lower.includes('userimage')) return true;

    // 2. Exact ID-based blacklist
    return BLACKLIST_IDS.some(id => lower.includes(id.toLowerCase()));
}

function normalizeGalleryItem(item) {
    if (!item) return;

    // 1. Ensure Status is a String
    if (!item.status) item.status = "";

    // 2. Find Proof URL (Aggressive Search)
    if (!item.proofUrl || item.proofUrl.length < 5 || isBlacklisted(item.proofUrl)) {
        item.proofUrl = ""; // Reset if blacklisted or empty

        const candidates = ['file', 'evidence', 'proofUrl', 'attachment', 'media', 'url', 'image', 'src', 'photo', 'cover', 'thumbnail', 'poster'];
        const blacklistKeys = ['avatar', 'profile', 'userimage', 'owneravatar'];

        for (let key of candidates) {
            let val = item[key];
            if (val && typeof val === 'object' && val.src) val = val.src;

            if (val && typeof val === 'string' && val.length > 5) {
                const lowKey = key.toLowerCase();
                if (blacklistKeys.some(b => lowKey.includes(b))) continue;
                if (isBlacklisted(val)) continue;

                item.proofUrl = val;
                break;
            }
        }
    }
}

// --- HELPER: SORTED LIST ---
function getSortedGallery() {
    if (!galleryData) return [];
    return [...galleryData].sort((a, b) => new Date(b._createdDate) - new Date(a._createdDate));
}

// --- HELPER: GET FILTERED LIST (SEPARATED BY BUTTON TYPE) ---
export function getGalleryList() {
    if (!galleryData || !Array.isArray(galleryData)) return [];

    // Normalize data structure first
    galleryData.forEach(normalizeGalleryItem);

    // FILTER: This determines what shows in the Service Record (Altar)
    let items = galleryData.filter(i => {
        // 1. Basic Check: Must have data
        if (!i) return false;

        // 2. No mandatory proof check - let text records through
        // if (!i.proofUrl || i.proofUrl.length < 5) return false;

        // 3. THE SEPARATOR (Based on category)
        const cat = (i.category || "").toLowerCase();
        const txt = (i.text || "").toLowerCase();

        // Hide "Routine" uploads from here (UNLESS it has text worth seeing)
        if ((cat === 'routine' || txt.includes('daily routine')) && !i.proofUrl) return false;

        // Hide "System" updates (Level ups, badge earns, profile changes)
        if (cat === 'profile' || cat === 'system' || cat === 'level' || cat === 'badge' || cat === 'rank') return false;

        // 4. BLOCK AVATARS (Image Comparison)
        // We DON'T block items from the list just because they have an avatar.
        // We let them through so the task is visible, but we swap the image for a placeholder in rendering.
        // However, we still block strict Profile/System categories.

        return true;
    });

    // Apply Sticker Filters (The buttons at the top of history)
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

    // --- 0. STATE CHECK (PREVENT BLINKING) ---
    const newestItem = galleryData.length > 0 ? galleryData[0]._createdDate : "0";
    const stateSig = `${galleryData.length}-${newestItem}-${activeStickerFilter}`;

    if (window.lastGalleryRenderState === stateSig) return;
    window.lastGalleryRenderState = stateSig;

    // --- 1. TARGETS ---
    const historySection = document.getElementById('historySection');
    const mosaicGrid = document.getElementById('mosaicGrid');
    const routineCol = document.getElementById('routineColumn');
    const statusCol = document.getElementById('statusColumn');

    // Hero Slots
    const heroMain = { img: document.getElementById('imgAltarMain'), title: document.getElementById('titleAltarMain') };
    const heroSub1 = { img: document.getElementById('imgAltarSub1'), title: document.getElementById('titleAltarSub1') };
    const heroSub2 = { img: document.getElementById('imgAltarSub2'), title: document.getElementById('titleAltarSub2') };

    // Mobile Targets (Keeping for fallback/sync)
    const recGrid = document.getElementById('mobRec_Grid');
    const recHeap = document.getElementById('mobRec_Heap');
    const mob1 = document.getElementById('mobRec_Slot1');
    const mob2 = document.getElementById('mobRec_Slot2');
    const mob3 = document.getElementById('mobRec_Slot3');

    if (!historySection && !recGrid) return;

    // Reset Containers
    if (mosaicGrid) mosaicGrid.innerHTML = "";
    if (routineCol) routineCol.innerHTML = "";
    if (statusCol) statusCol.innerHTML = "";
    if (recGrid) recGrid.innerHTML = "";
    if (recHeap) recHeap.innerHTML = "";

    // --- 2. GET DATA ---
    const allItems = getGalleryList();

    // 2a. REJECTED (Mini-Grid Target)
    const deniedList = allItems.filter(item => {
        const s = (item.status || "").toLowerCase();
        return s.includes('rej');
    });

    // 2b. APPROVED (Centerpiece & Mosaic Target)
    const approvedList = allItems.filter(item => {
        const s = (item.status || "").toLowerCase();
        return s.includes('appr');
    });

    // 2c. ROUTINES (Mini-Grid Target - Track where they upload it)
    const routineList = allItems.filter(item => {
        const cat = (item.category || "").toLowerCase();
        const txt = (item.text || "").toLowerCase();
        const isRoutine = item.isRoutine === true;
        return isRoutine || cat === 'routine' || txt.includes('daily routine');
    });

    const pendingList = allItems.filter(item => {
        const s = (item.status || "").toLowerCase();
        if (s === "") return true;
        return s.includes('pending') || s.includes('wait') || s.includes('review') || s.includes('process');
    });

    // 2d. ALTAR CANDIDATES (Approved only)
    const altarCandidates = [...approvedList].sort((a, b) => {
        const statsA = getPoints(a);
        const statsB = getPoints(b);
        if (statsB !== statsA) return statsB - statsA;
        return new Date(b._createdDate) - new Date(a._createdDate);
    });

    const bestOf = altarCandidates.slice(0, 3);

    // Standard accepted for mosaic (Approved pictures excluding Hero)
    const standardAccepted = approvedList.filter(item => !bestOf.includes(item));

    window.lastCategoryData = {
        accepted: standardAccepted,
        routine: routineList,
        pending: pendingList,
        denied: deniedList
    };

    // --- 3. HELPERS ---
    const getThumb = async (item, size = 300) => {
        if (!item) return PLACEHOLDER_IMG;

        // STRICT: Only use proofUrl (which we cleaned in normalizeGalleryItem)
        let raw = item.proofUrl || "";

        if (typeof raw === 'object' && raw.src) raw = raw.src;
        if (!raw || typeof raw !== 'string' || raw.length < 5) return PLACEHOLDER_IMG;

        if (raw.includes("upcdn.io")) {
            let thumbUrl = raw.replace('/raw/', '/image/');
            if (!thumbUrl.includes('?')) thumbUrl += `?w=${size}&h=${size}&fit=crop&f=jpg&q=80`;
            try { return await getSignedUrl(thumbUrl); } catch (e) { return thumbUrl; }
        }

        if (raw.includes('.mp4') || raw.includes('.mov') || raw.includes('.webm') || raw.startsWith('wix:video')) {
            if (item.cover) raw = item.cover;
            else if (item.thumbnail) raw = item.thumbnail;
            else if (item.poster) raw = item.poster;
        }

        if (raw.startsWith('wix:image')) {
            try { raw = "https://static.wixstatic.com/media/" + raw.split('/')[3].split('#')[0]; } catch (e) { }
        }

        try { return await getSignedUrl(getThumbnail(getOptimizedUrl(raw, size))); }
        catch (e) { return raw; }
    };

    // --- 4. RENDER HERO SLOTS ---
    // --- 4. RENDER HERO & MINI-GRIDS ---
    const renderHero = async (item, target, size, containerId) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!item || !target.img) {
            container.style.opacity = "0.3";
            container.onclick = null;
            if (target.img) target.img.src = PLACEHOLDER_IMG;
            if (target.title) target.title.innerText = "NO OFFERING";
            return;
        }

        container.style.opacity = "1";
        const idx = allItems.indexOf(item);
        container.onclick = () => window.openHistoryModal(idx);

        const src = await getThumb(item, size);
        target.img.src = src;
        target.img.onerror = () => { target.img.src = PLACEHOLDER_IMG; };

        if (target.title) {
            target.title.innerText = item.text || "SACRED OFFERING";
            if (target.title.innerText.length > 50) target.title.innerText = target.title.innerText.substring(0, 47) + "...";
        }
    };

    const renderMiniGrid = async (list, containerId) => {
        const grid = document.getElementById(containerId);
        if (!grid) return;

        if (list.length === 0) {
            grid.innerHTML = '<div class="mini-empty">SILENT VOID</div>';
            return;
        }

        const promises = list.slice(0, 6).map(async item => {
            const src = await getThumb(item, 150);
            const idx = allItems.indexOf(item);
            return `<img src="${src}" class="mini-thumb" onclick="window.openHistoryModal(${idx})" onerror="this.src='${PLACEHOLDER_IMG}'">`;
        });
        const thumbs = await Promise.all(promises);
        grid.innerHTML = thumbs.join('');
    };

    // 4a. Hero Main
    await renderHero(bestOf[0], heroMain, 800, 'altarMain');

    // 4b. Mini Grids
    await renderMiniGrid(routineList, 'gridAltarRoutine');
    await renderMiniGrid(deniedList, 'gridAltarFailed');

    // --- 5. RENDER MOSAIC (DEDICATED ENTRIES - PORTRAIT OPTIMIZED) ---
    if (mosaicGrid) {
        // FILTER: Only show items that HAVE a proofUrl
        const approvedPictures = standardAccepted.filter(item => item.proofUrl && item.proofUrl.length > 10);

        const promises = approvedPictures.map(async (item, i) => {
            const src = await getThumb(item, 500);
            const idx = allItems.indexOf(item);

            // BENTO LOGIC (5-Column Grid)
            let bentoClass = "";
            const mod = i % 11;
            if (mod === 0) bentoClass = "m-big";      // 2x2
            else if (mod === 2) bentoClass = "m-tall"; // 1x2 (Portrait)
            else if (mod === 5) bentoClass = "m-tall"; // 1x2 (Portrait)
            else if (mod === 8) bentoClass = "m-wide"; // 2x1
            else if (mod === 10) bentoClass = "m-tall"; // 1x2 (Portrait)
            // Others are standard 1x1

            const div = document.createElement('div');
            div.className = `mosaic-card ${bentoClass}`;
            div.onclick = () => window.openHistoryModal(idx);
            div.innerHTML = `
                <img src="${src}" class="hero-img" loading="lazy" onerror="this.src='${PLACEHOLDER_IMG}'">
                <div class="hero-overlay" style="padding: 15px;">
                    <div class="hero-label" style="font-size:0.5rem;">${(item.category || 'ENTRY').toUpperCase()}</div>
                    <div class="hero-title" style="font-size:0.75rem;">${(item.text || '...').substring(0, 30)}</div>
                </div>
            `;
            return div;
        });
        const nodes = await Promise.all(promises);
        nodes.forEach(n => mosaicGrid.appendChild(n));

        if (approvedPictures.length === 0) {
            mosaicGrid.innerHTML = `<div style="grid-column: 1/-1; padding: 40px; text-align: center; font-family: 'Cinzel'; color: #444;">NO APPROVED VISUALS RECORDED.</div>`;
        }
    }

    // --- 6. RENDER STATUS COLUMNS (SLATS) ---
    const renderSlat = async (item) => {
        const src = await getThumb(item, 100);
        const idx = allItems.indexOf(item);
        const isDenied = (item.status || "").toLowerCase().includes('rej');
        const isPending = (item.status || "").toLowerCase().includes('pending');

        return `
            <div class="status-item" onclick="window.openHistoryModal(${idx})">
                <img src="${src}" class="status-thumb" onerror="this.src='${PLACEHOLDER_IMG}'">
                <div class="status-info">
                    <div class="status-text">${item.text || '...'}</div>
                    <div class="status-meta">
                        ${isDenied ? '<span style="color:var(--neon-red)">VOIDED</span>' : (isPending ? '<span style="color:var(--neon-yellow)">AWAITING VERDICT</span>' : 'LOGGED')}
                        • ${new Date(item._createdDate).toLocaleDateString()}
                    </div>
                </div>
            </div>
        `;
    };

    if (routineCol) {
        if (routineList.length > 0) {
            const htmls = await Promise.all(routineList.map(item => renderSlat(item)));
            routineCol.innerHTML = htmls.join('');
        } else {
            routineCol.innerHTML = `<div style="padding: 10px; color: #444; font-size: 0.7rem;">NO ROUTINE LOGS RECORDED.</div>`;
        }
    }

    if (statusCol) {
        const combined = [...pendingList, ...deniedList];
        if (combined.length > 0) {
            const htmls = await Promise.all(combined.map(item => renderSlat(item)));
            statusCol.innerHTML = htmls.join('');
        } else {
            statusCol.innerHTML = `<div style="padding: 10px; color: #444; font-size: 0.7rem;">THE VOID IS SILENT.</div>`;
        }
    }

    // --- 7. MOBILE FALLBACKS ---
    const renderMobSlot = async (item, el, size) => {
        if (!el) return;
        if (item) {
            let url = await getThumb(item, size);
            el.src = url;
            el.style.filter = "none";
            el.onerror = function () {
                this.src = "https://static.wixstatic.com/media/ce3e5b_1bd27ba758ce465fa89a36d70a68f355~mv2.png";
                this.style.filter = "grayscale(100%) brightness(0.5)";
            };
            el.onclick = () => window.openHistoryModal(allItems.indexOf(item));
        } else {
            el.src = "https://static.wixstatic.com/media/ce3e5b_1bd27ba758ce465fa89a36d70a68f355~mv2.png";
            el.style.filter = "grayscale(100%) brightness(0.5)";
        }
    };

    if (mob1) await renderMobSlot(bestOf[0], mob1, 400);
    if (mob2) await renderMobSlot(bestOf[1], mob2, 300);
    if (mob3) await renderMobSlot(bestOf[2], mob3, 300);

    // --- 8. UI POLISH ---
    if (historySection) {
        if (allItems.length === 0) historySection.classList.add('solo-mode');
        else historySection.classList.remove('solo-mode');
    }
}

// --- SOVEREIGN ALTAR INTERACTION HELPERS ---
window.expandCategory = async function (category) {
    const overlay = document.getElementById('categoryExpansionOverlay');
    const grid = document.getElementById('expansionGrid');
    const title = document.getElementById('expansionTitle');
    const canvas = document.getElementById('orbitalCanvas');

    if (!overlay || !grid || !title) return;

    // 1. Get List Based on Category
    // We already have these separate in the renderGallery scope, but let's re-acquire the ones we need
    // To be efficient, we can store them in a window variable during renderGallery
    const data = window.lastCategoryData ? window.lastCategoryData[category] : [];

    // 2. Setup UI
    title.innerText = category.toUpperCase() + (category === 'denied' ? ' (THE VOID)' : ' OFFERINGS');
    grid.innerHTML = "";
    overlay.classList.remove('hidden');
    if (canvas) canvas.style.filter = "blur(15px) scale(0.9)";

    // 3. Render Grid
    if (data.length === 0) {
        grid.innerHTML = `<div style="color:#666; font-family:'Cinzel'; text-align:center; grid-column:1/-1; padding-top:50px;">NO RECORDS FOUND IN THIS SECTOR.</div>`;
    } else {
        // Reuse renderChunk logic or simple loop
        for (let item of data) {
            const el = document.createElement('div');
            el.className = 'item-blueprint';
            if (category === 'denied') el.classList.add('item-trash');

            const img = document.createElement('img');
            img.className = category === 'denied' ? 'trash-img' : 'blueprint-img';
            img.src = await getSignedUrl(item.proofUrl || PLACEHOLDER_IMG);

            el.appendChild(img);
            el.onclick = () => window.openHistoryModal(getGalleryList().indexOf(item));
            grid.appendChild(el);
        }
    }
};

window.closeCategoryExpansion = function () {
    const overlay = document.getElementById('categoryExpansionOverlay');
    const canvas = document.getElementById('orbitalCanvas');
    if (overlay) overlay.classList.add('hidden');
    if (canvas) canvas.style.filter = "none";
};
// --- CRITICAL FIX: EXPORT THIS EMPTY FUNCTION TO PREVENT CRASH ---
export function loadMoreHistory() {
    setHistoryLimit(historyLimit + 25);
    window.lastGalleryRenderState = null; // Force re-render
    renderGallery();
    console.log("Increased history limit to", historyLimit);
}

// --- FORCE WINDOW EXPORTS ---
window.renderGallery = renderGallery;
window.setGalleryFilter = function (filterType) {
    activeStickerFilter = filterType;
    window.lastGalleryRenderState = null; // Force re-render (though signature check handles filter too, being safe)
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

// REPLACE openHistoryModal
export async function openHistoryModal(index) {
    const items = getGalleryList();
    if (!items[index]) return;

    setCurrentHistoryIndex(index);
    const item = items[index];

    // 1. Setup Background Media
    let url = item.proofUrl || item.media;
    const isVideo = mediaType(url) === 'video';
    url = await getSignedUrl(url);
    const mediaContainer = document.getElementById('modalMediaContainer');

    if (mediaContainer) {
        mediaContainer.innerHTML = isVideo ?
            `<video src="${url}" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:contain;"></video>` :
            `<img src="${url}" style="width:100%; height:100%; object-fit:contain;">`;
    }

    // 2. Setup Data
    const pts = getPoints(item);
    const status = (item.status || "").toLowerCase();

    // CRITICAL FIX: Add 'deni' and 'refus' to ensure the button shows for "Denied" tasks
    const isRejected = status.includes('rej') || status.includes('fail') || status.includes('deni') || status.includes('refus');

    // 3. Build UI
    const overlay = document.getElementById('modalGlassOverlay');
    if (overlay) {
        let verdictText = item.adminComment || "Logged without commentary.";
        // If rejected but no comment, show default text
        if (isRejected && !item.adminComment) verdictText = "Submission rejected. Standards not met.";

        // --- REDEMPTION BUTTON GENERATOR ---
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
            <!-- FIX 1: Add stopPropagation here so clicks inside the box DON'T close the modal -->
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
                    
                    <!-- This button forces close specifically -->
                    <button onclick="window.closeModal()" class="btn-glass-silver btn-glass-red">DISMISS</button>
                </div>
            </div>
        `;
    }

    // FIX 2: Activate the background click to close
    const glassModal = document.getElementById('glassModal');
    if (glassModal) {
        glassModal.onclick = (e) => window.closeModal(e);
        glassModal.classList.add('active');
        glassModal.classList.remove('inspect-mode');

        // *** ADD THIS LINE: LOCK THE DASHBOARD ***
        document.getElementById('viewMobileHome').style.overflow = 'hidden';
    }
}

// REPLACE OR ADD toggleDirective (Fixes the text swapping)
// REPLACE YOUR toggleDirective FUNCTION WITH THIS
window.toggleDirective = function (index) {
    const items = getGalleryList();
    const item = items[index];
    if (!item) return;

    const box = document.getElementById('verdictBox');

    // Check current view state
    if (box.dataset.view === 'task') {
        // Switch back to Verdict (Admin comments are usually plain text, so innerText is fine here, but you can change to innerHTML if needed)
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
        // Switch to Task/Directive
        // --- THE FIX IS HERE --- 
        // We change .innerText to .innerHTML so the <p> and <br> tags render correctly
        box.innerHTML = item.text || "No directive data available.";

        box.style.color = "#ccc";
        box.style.fontStyle = "normal";
        box.dataset.view = 'task';
    }
};

// --- VIEW HELPERS ---
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

// REPLACE your closeModal with this simple version
export function closeModal(e) {
    if (e && e.stopPropagation) e.stopPropagation();

    const modal = document.getElementById('glassModal');
    if (modal) {
        modal.classList.remove('active');
        modal.classList.remove('inspect-mode');
    }

    const media = document.getElementById('modalMediaContainer');
    if (media) media.innerHTML = "";

    // *** ADD THIS LINE: UNLOCK THE DASHBOARD ***
    document.getElementById('viewMobileHome').style.overflow = 'auto';
}

// Helper to ensure clean closing
function forceClose() {
    const modal = document.getElementById('glassModal');
    if (modal) modal.classList.remove('active');

    const media = document.getElementById('modalMediaContainer');
    if (media) media.innerHTML = "";
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

// ADD THIS FUNCTION
window.toggleInspectMode = function () {
    const modal = document.getElementById('glassModal');
    if (modal) {
        modal.classList.toggle('inspect-mode');
    }
};

// --- PASTE THIS AT THE VERY BOTTOM OF gallery.js ---

window.addEventListener('click', function (e) {
    const modal = document.getElementById('glassModal');
    const card = document.getElementById('modalUI');

    // 1. If Modal is NOT open, stop here. Do nothing.
    if (!modal || !modal.classList.contains('active')) return;

    // 2. CHECK: Did we click INSIDE the Black Card (Text/Buttons)?
    if (card && card.contains(e.target)) {
        return;
    }

    // 3. CHECK: Are we in INSPECT MODE? (Photo only)
    if (modal.classList.contains('inspect-mode')) {
        // If we clicked the BLURRED BACKGROUND or IMAGE (Inside the modal wrapper)
        if (modal.contains(e.target)) {
            // User wants to revert back to the text card
            modal.classList.remove('inspect-mode');
            return;
        }

    }

    window.closeModal();
}, true); // 'true' ensures we catch the click before other listeners stop it

// --- PASTE AT BOTTOM OF gallery.js ---

window.toggleMobileMenu = function () {
    const sidebar = document.querySelector('.layout-left');
    if (sidebar) {
        sidebar.classList.toggle('mobile-open');
    }
};

// Use event delegation instead of adding listeners to each button
document.addEventListener('click', (e) => {
    if (e.target.closest('.nav-btn, .kneel-bar-graphic')) {
        const sidebar = document.querySelector('.layout-left');
        if (sidebar) sidebar.classList.remove('mobile-open');
    }
});


// --- FORCE WINDOW EXPORTS ---
window.renderGallery = renderGallery;
window.getGalleryList = getGalleryList;
window.openHistoryModal = openHistoryModal;
window.toggleHistoryView = toggleHistoryView;
window.closeModal = closeModal;
window.loadMoreHistory = loadMoreHistory;
// atoneForTask, toggleInspectMode, setGalleryFilter, toggleMobileMenu are already on window