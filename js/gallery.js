
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
    setPendingTaskState
} from './state.js';
import { triggerSound } from './utils.js';
import { getOptimizedUrl, getThumbnail, getSignedUrl } from './media.js';

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

// --- HELPER: NORMALIZE DATA (FIXED) ---
let normalizedCache = new Set();

function normalizeGalleryItem(item) {
    // Use item ID/timestamp as cache key to avoid re-normalizing
    const cacheKey = item._id || item._createdDate;
    if (normalizedCache.has(cacheKey)) return;
    
    // Search for photos in any possible field
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

// --- HELPER: SORTED LIST ---
function getSortedGallery() {
    if (!galleryData) return [];
    return [...galleryData].sort((a, b) => new Date(b._createdDate) - new Date(a._createdDate));
}

// --- HELPER: GET FILTERED LIST (SEPARATED BY BUTTON TYPE) ---
function getGalleryList() {
    if (!galleryData || !Array.isArray(galleryData)) return [];
    
    // Normalize data structure first
    galleryData.forEach(normalizeGalleryItem);
    
    // FILTER: This determines what shows in the Service Record (Altar)
    let items = galleryData.filter(i => {
        // 1. Basic Check: Must have an image
        if (!i.proofUrl) return false;

        // 2. STATUS CHECK: Show Pending, Approved, or Rejected
        const s = (i.status || "").toLowerCase();
        const isVisibleStatus = s.includes('pending') || s.includes('app') || s.includes('rej') || s === "";
        if (!isVisibleStatus) return false;

        // 3. THE SEPARATOR (Based on which button was used)
        const cat = (i.category || "").toLowerCase();
        const txt = (i.text || "").toLowerCase();

        // If it was uploaded via the "Routine" button -> HIDE IT from here
        // (It belongs in the top "Daily Discipline" shelf)
        if (cat === 'routine') return false; 

        // Double Safety: If the text says "Daily Routine", HIDE IT
        if (txt.includes('daily routine')) return false;

        // Otherwise, it's a normal Task -> SHOW IT
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
        if(url === STICKER_DENIED) return;
        const isActive = (activeStickerFilter === url) ? 'active' : '';
        html += `<div class="filter-circle ${isActive}" onclick="window.setGalleryFilter('${url}')"><img src="${url}"></div>`;
    });

    filterBar.innerHTML = html;
}

export async function renderGallery() {
    if (!galleryData) return;
    
    // --- 1. TARGETS ---
    const gridFailed = document.getElementById('gridFailed'); 
    const gridOkay = document.getElementById('gridOkay');     
    const historySection = document.getElementById('historySection');
    
    const slot1 = { card: document.getElementById('altarSlot1'), img: document.getElementById('imgSlot1'), ref: document.getElementById('reflectSlot1') };
    const slot2 = { card: document.getElementById('altarSlot2'), img: document.getElementById('imgSlot2') };
    const slot3 = { card: document.getElementById('altarSlot3'), img: document.getElementById('imgSlot3') };

    const mob1 = document.getElementById('mobImgSlot1');
    const mob2 = document.getElementById('mobImgSlot2');
    const mob3 = document.getElementById('mobImgSlot3');
    const recGrid = document.getElementById('mobRec_Grid'); 
    const recHeap = document.getElementById('mobRec_Heap'); 

    if (!gridFailed || !gridOkay) return;

    // Reset
    gridFailed.innerHTML = "";
    gridOkay.innerHTML = "";
    if(recGrid) recGrid.innerHTML = "";
    if(recHeap) recHeap.innerHTML = "";

    // --- 2. GET FILTERED DATA (No Routines) ---
    const allItems = getGalleryList(); 

    if (historySection) {
        if (allItems.length === 0) historySection.classList.add('solo-mode');
        else historySection.classList.remove('solo-mode');
    }

    // Separate Lists
    const acceptedList = allItems.filter(i => {
        const s = (i.status || "").toLowerCase();
        return !s.includes('rej') && !s.includes('fail');
    });
    
    const deniedList = allItems.filter(i => {
        const s = (i.status || "").toLowerCase();
        return s.includes('rej') || s.includes('fail');
    });

    const bestOf = acceptedList.slice(0, 3);
    const archiveList = acceptedList.slice(3);

    // --- 3. HELPER: ROBUST THUMBNAIL (THE FIX) ---
    const getSecureThumb = async (item, size) => {
        if (!item) return PLACEHOLDER_IMG;
        
        let raw = item.proofUrl || item.media || item.url || item.image || "";
        
        // A. Video Handling (Try to find a cover)
        if (typeof raw === 'string' && (raw.includes('.mp4') || raw.includes('.mov'))) {
            if (item.cover) raw = item.cover;
            else if (item.thumbnail) raw = item.thumbnail;
            else return "https://static.wixstatic.com/media/ce3e5b_1bd27ba758ce465fa89a36d70a68f355~mv2.png"; // Fallback Icon
        }

        // B. Wix URL Fix (Regex Method - More Reliable)
        if (raw.startsWith('wix:image')) {
            try {
                // Regex: Find the file ID (alphanumeric + underscore + dot + extension)
                // e.g. wix:image://v1/5b30b6_.../file.jpg#...
                const matches = raw.match(/wix:image:\/\/v1\/([^/]+)\//);
                if (matches && matches[1]) {
                    const id = matches[1];
                    // Construct valid HTTPS url with resizing
                    return `https://static.wixstatic.com/media/${id}/v1/fill/w_${size},h_${size},al_c,q_70/file.jpg`;
                } else {
                    // Fail-safe: Just try to grab the 4th segment
                    const parts = raw.split('/');
                    const id = parts[3].split('#')[0];
                    return `https://static.wixstatic.com/media/${id}`; // Master image (no resize)
                }
            } catch(e) { 
                return PLACEHOLDER_IMG; 
            }
        }

        // C. Standard/Bytescale URL (Needs Signing)
        try {
            return await getSignedUrl(getThumbnail(getOptimizedUrl(raw, size)));
        } catch(e) {
            // If signing fails, return raw URL as last resort (often works for public files)
            return raw; 
        }
    };

    // --- 4. RENDER PYRAMID (Top 3) ---
    const [thumb1, thumb2, thumb3] = await Promise.all([
        getSecureThumb(bestOf[0], 400),
        getSecureThumb(bestOf[1], 300),
        getSecureThumb(bestOf[2], 300)
    ]);

    // Slot 1
    if (bestOf[0]) {
        let idx = allItems.indexOf(bestOf[0]);
        if(slot1.card) { slot1.card.style.display='flex'; slot1.img.src=thumb1; if(slot1.ref) slot1.ref.src=thumb1; slot1.card.onclick=()=>window.openHistoryModal(idx); }
        if(mob1) { mob1.src=thumb1; mob1.parentElement.onclick=()=>window.openHistoryModal(idx); mob1.style.display='block'; }
        if(rec1) { rec1.src=thumb1; rec1.onclick=()=>window.openHistoryModal(idx); }
    } else {
        if(slot1.card) slot1.card.style.display='none';
        if(mob1) mob1.style.display='none';
    }

    // Slot 2
    if (bestOf[1]) {
        let idx = allItems.indexOf(bestOf[1]);
        if(slot2.card) { slot2.card.style.display='flex'; slot2.img.src=thumb2; slot2.card.onclick=()=>window.openHistoryModal(idx); }
        if(mob2) { mob2.src=thumb2; mob2.style.display='block'; mob2.parentElement.onclick=()=>window.openHistoryModal(idx); }
        if(rec2) { rec2.src=thumb2; rec2.onclick=()=>window.openHistoryModal(idx); }
    } else {
        if(slot2.card) slot2.img.src = IMG_STATUE_SIDE;
        if(mob2) mob2.src = IMG_STATUE_SIDE;
        if(rec2) rec2.src = IMG_STATUE_SIDE;
    }

    // Slot 3
    if (bestOf[2]) {
        let idx = allItems.indexOf(bestOf[2]);
        if(slot3.card) { slot3.card.style.display='flex'; slot3.img.src=thumb3; slot3.card.onclick=()=>window.openHistoryModal(idx); }
        if(mob3) { mob3.src=thumb3; mob3.style.display='block'; mob3.parentElement.onclick=()=>window.openHistoryModal(idx); }
        if(rec3) { rec3.src=thumb3; rec3.onclick=()=>window.openHistoryModal(idx); }
    } else {
        if(slot3.card) slot3.img.src = IMG_STATUE_SIDE;
        if(mob3) mob3.src = IMG_STATUE_SIDE;
        if(rec3) rec3.src = IMG_STATUE_SIDE;
    }

    // --- 5. RENDER LISTS (Archive & Heap) ---
    const renderChunk = async (list, isTrash) => {
        const promises = list.map(async (item) => {
            const src = await getSecureThumb(item, 250);
            const idx = allItems.indexOf(item);
            const isPending = (item.status || "").includes('pending');
            
            const desk = `<div class="${isTrash?'item-trash':'item-blueprint'}" onclick="window.openHistoryModal(${idx})"><img class="${isTrash?'trash-img':'blueprint-img'}" src="${src}" loading="lazy" onerror="this.src='${PLACEHOLDER_IMG}'">${isTrash?'<div class="trash-stamp">DENIED</div>':''}${isPending?'<div class="pending-overlay"><div class="pending-icon">⏳</div></div>':''}</div>`;
            const mob = `<div class="mob-scroll-item" onclick="window.openHistoryModal(${idx})" style="${isTrash?'height:80px; width:80px;':''}"><img class="mob-scroll-img" src="${src}" loading="lazy">${isPending?'<div style="position:absolute; inset:0; background:rgba(0,0,0,0.5); display:flex; justify-content:center; align-items:center;">⏳</div>':''}</div>`;
            return { desk, mob };
        });
        const res = await Promise.all(promises);
        return { desk: res.map(r=>r.desk).join(''), mob: res.map(r=>r.mob).join('') };
    };

    if (archiveList.length > 0) {
        const html = await renderChunk(archiveList, false);
        if(gridOkay) gridOkay.innerHTML = html.desk;
        if(recGrid) recGrid.innerHTML = html.mob;
    }

    if (deniedList.length > 0) {
        const html = await renderChunk(deniedList, true);
        if(gridFailed) gridFailed.innerHTML = html.desk;
        if(recHeap) recHeap.innerHTML = html.mob;
    }
}

// --- CRITICAL FIX: EXPORT THIS EMPTY FUNCTION TO PREVENT CRASH ---
export function loadMoreHistory() {
    setHistoryLimit(historyLimit + 25);
    renderGallery();
    console.log("Increased history limit to", historyLimit);
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
        if(isRejected && !item.adminComment) verdictText = "Submission rejected. Standards not met.";

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
    }
}

// REPLACE OR ADD toggleDirective (Fixes the text swapping)
// REPLACE YOUR toggleDirective FUNCTION WITH THIS
window.toggleDirective = function(index) {
    const items = getGalleryList(); 
    const item = items[index];
    if (!item) return;

    const box = document.getElementById('verdictBox');
    
    // Check current view state
    if (box.dataset.view === 'task') {
        // Switch back to Verdict (Admin comments are usually plain text, so innerText is fine here, but you can change to innerHTML if needed)
        let verdictText = item.adminComment || "Logged without commentary.";
        const status = (item.status || "").toLowerCase();
        if((status.includes('rej') || status.includes('fail')) && !item.adminComment) {
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

// REPLACE your closeModal with this simple version
export function closeModal(e) {
    // If we have an event (e), stop it from triggering other things
    if(e && e.stopPropagation) e.stopPropagation();

    // Force Close Everything
    const modal = document.getElementById('glassModal');
    if (modal) {
        modal.classList.remove('active');
        modal.classList.remove('inspect-mode'); // Reset inspect mode too
    }
    
    // Clear the Media/Video to stop it playing in background
    const media = document.getElementById('modalMediaContainer');
    if (media) media.innerHTML = "";
}

// Helper to ensure clean closing
function forceClose() {
    const modal = document.getElementById('glassModal');
    if (modal) modal.classList.remove('active');
    
    const media = document.getElementById('modalMediaContainer');
    if (media) media.innerHTML = "";
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

// ADD THIS FUNCTION
window.toggleInspectMode = function() {
    const modal = document.getElementById('glassModal');
    if (modal) {
        modal.classList.toggle('inspect-mode');
    }
};

// --- PASTE THIS AT THE VERY BOTTOM OF gallery.js ---

window.addEventListener('click', function(e) {
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

window.toggleMobileMenu = function() {
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

// ... inside renderGallery ...

    // --- SYNC MOBILE ALTAR ---
    const mob1 = document.getElementById('mobImgSlot1');
    const mob2 = document.getElementById('mobImgSlot2');
    const mob3 = document.getElementById('mobImgSlot3');

    // Slot 1 (Center)
    if (mob1) {
        if (bestOf[0]) {
            // Re-use logic for thumbnail
            let thumb = getThumbnail(getOptimizedUrl(bestOf[0].proofUrl || bestOf[0].media, 400));
            mob1.src = thumb;
            mob1.style.filter = "none";
            mob1.onclick = () => window.openHistoryModal(allItems.indexOf(bestOf[0]));
        } else {
            // Set default Queen image if empty
            mob1.src = "https://static.wixstatic.com/media/ce3e5b_5fc6a144908b493b9473757471ec7ebb~mv2.png";
            mob1.style.filter = "grayscale(100%) brightness(0.5)";
        }
    }

    // Slot 2 (Left)
    if (mob2 && bestOf[1]) {
        let thumb = getThumbnail(getOptimizedUrl(bestOf[1].proofUrl || bestOf[1].media, 300));
        mob2.src = thumb;
        mob2.onclick = () => window.openHistoryModal(allItems.indexOf(bestOf[1]));
    }

    // Slot 3 (Right)
    if (mob3 && bestOf[2]) {
        let thumb = getThumbnail(getOptimizedUrl(bestOf[2].proofUrl || bestOf[2].media, 300));
        mob3.src = thumb;
        mob3.onclick = () => window.openHistoryModal(allItems.indexOf(bestOf[2]));
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
    console.log("render render", filterType);
};
