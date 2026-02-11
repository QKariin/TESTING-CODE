
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
    if (!item) return;

    // 1. Ensure Status is a String
    if (!item.status) item.status = "";

    // Use item ID/timestamp as cache key to avoid re-normalizing
    const cacheKey = item._id || item._createdDate;
    if (normalizedCache.has(cacheKey)) return;

    // 2. Find Proof URL (Aggressive Search)
    if (!item.proofUrl || item.proofUrl.length < 5) {
        const candidates = ['media', 'file', 'evidence', 'url', 'image', 'src', 'attachment', 'photo', 'cover', 'thumbnail', 'poster'];
        for (let key of candidates) {
            if (item[key] && typeof item[key] === 'string' && item[key].length > 5) {
                // Ignore "Avatar" completely - User does not want profile pics as evidence
                if (key === 'avatar') continue;

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

// --- HELPER: GET FILTERED LIST (SEPARATED BY BUTTON TYPE) ---
function getGalleryList() {
    if (!galleryData || !Array.isArray(galleryData)) return [];

    // Normalize data structure first
    galleryData.forEach(normalizeGalleryItem);

    // FILTER: This determines what shows in the Service Record (Altar)
    let items = galleryData.filter(i => {
        // 1. Basic Check: Must have data
        if (!i) return false;

        // 2. Must have VISUAL PROOF (Fixes empty Altar slots)
        if (!i.proofUrl || i.proofUrl.length < 5) return false;

        // 3. THE SEPARATOR (Based on category)
        const cat = (i.category || "").toLowerCase();
        const txt = (i.text || "").toLowerCase();

        // Hide "Routine" uploads from here
        if (cat === 'routine' || txt.includes('daily routine')) return false;

        // Hide "System" updates (Level ups, badge earns, profile changes)
        if (cat === 'profile' || cat === 'system' || cat === 'level' || cat === 'badge' || cat === 'rank') return false;

        // 4. BLOCK AVATARS (Image Comparison)
        // If the proofUrl matches the user's current profile picture, it's not a task proof.
        if (userProfile && userProfile.profilePicture && i.proofUrl) {
            // Check for exact match or Wix media ID match
            if (i.proofUrl === userProfile.profilePicture) return false;
            if (userProfile.profilePicture.includes(i.proofUrl)) return false;

            // Wix often appends dims to the end, so check pure filename if possible
            const p1 = i.proofUrl.split('/').pop().split('.')[0];
            const p2 = userProfile.profilePicture.split('/').pop().split('.')[0];
            if (p1.length > 5 && p1 === p2) return false;
        }

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
    // Create a signature of the current state: Data Length + Data Timestamp + Filter
    const newestItem = galleryData.length > 0 ? galleryData[0]._createdDate : "0";
    const stateSig = `${galleryData.length}-${newestItem}-${activeStickerFilter}`;

    // If state hasn't changed, DO NOT TOUCH THE DOM
    if (window.lastGalleryRenderState === stateSig) return;
    window.lastGalleryRenderState = stateSig;

    // --- 1. TARGETS ---
    const gridFailed = document.getElementById('gridFailed');
    const gridOkay = document.getElementById('gridOkay');
    const gridPending = document.getElementById('gridPending');
    const historySection = document.getElementById('historySection');

    // Altar Slots (Desktop)
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

    // --- 3. SEPARATE LISTS (STRICTER) ---
    /* 
       LOGIC:
       - FAILED: Explicit "Fail", "Reject", "Denied"
       - PENDING: Explicit "Pending", "Wait", "Review" OR Empty Status (Assume pending if new)
       - ACCEPTED: Everything else (Approved, Completed, or Legacy valid)
    */

    // A. Denied
    const deniedList = allItems.filter(item => {
        const s = (item.status || "").toLowerCase();
        return s.includes('rej') || s.includes('fail') || s.includes('deni') || s.includes('refus');
    });

    // B. Pending
    const pendingList = allItems.filter(item => {
        const s = (item.status || "").toLowerCase();
        // If status is empty, treat as Pending (safer than Accepted)
        if (s === "") return true;
        return s.includes('pending') || s.includes('wait') || s.includes('review') || s.includes('process');
    });

    // C. Accepted (Candidates)
    const candidates = allItems.filter(item => {
        if (deniedList.includes(item)) return false;
        if (pendingList.includes(item)) return false;
        return true;
    });

    // --- 4. ALTAR SORTING (HIGHEST RATED) ---
    // User Request: "pictures with an highest rating"
    // Sort by Points (Desc) -> Date (Desc)
    candidates.sort((a, b) => {
        const statsA = getPoints(a);
        const statsB = getPoints(b);
        if (statsB !== statsA) return statsB - statsA; // Higher score first
        return new Date(b.date || b._createdDate) - new Date(a.date || a._createdDate); // Then newer
    });

    let bestOf = [];

    // Take top 3 highest rated items
    if (candidates.length > 0) bestOf.push(candidates.shift());
    if (candidates.length > 0) bestOf.push(candidates.shift());
    if (candidates.length > 0) bestOf.push(candidates.shift());

    // --- 5. IMAGE LOADER (SEQUENTIAL & ROBUST) ---
    const getThumb = async (item, size = 300) => {
        if (!item) return PLACEHOLDER_IMG;

        // 1. Get Initial Raw URL
        let raw = item.proofUrl || item.media || item.url || item.image || "";
        if (typeof raw === 'object' && raw.src) raw = raw.src;

        if (!raw || typeof raw !== 'string' || raw.length < 5) return PLACEHOLDER_IMG;

        // *** FIX 1: FORCE IMAGE FORMAT FOR BYTESCALE ***
        if (raw.includes("upcdn.io")) {
            // Convert /raw/ to /image/ so we get a JPG (Fixes Videos & iPhone HEIC)
            let thumbUrl = raw.replace('/raw/', '/image/');
            if (!thumbUrl.includes('?')) {
                thumbUrl += `?w=${size}&h=${size}&fit=crop&f=jpg&q=80`;
            }

            // Attempt to sign the *Thumbnail* URL, not the Raw one
            try {
                return await getSignedUrl(thumbUrl);
            } catch (e) {
                // If signing fails, return the unsigned JPG link. 
                // It is better to try loading an image than a raw video.
                return thumbUrl;
            }
        }

        // 2. Standard Logic for Non-Bytescale
        if (raw.includes('.mp4') || raw.includes('.mov') || raw.includes('.webm') || raw.startsWith('wix:video')) {
            if (item.cover) raw = item.cover;
            else if (item.thumbnail) raw = item.thumbnail;
            else if (item.poster) raw = item.poster;
        }

        if (raw.startsWith('wix:image')) {
            try { raw = "https://static.wixstatic.com/media/" + raw.split('/')[3].split('#')[0]; } catch (e) { }
        }

        try {
            return await getSignedUrl(getThumbnail(getOptimizedUrl(raw, size)));
        } catch (e) {
            return raw;
        }
    };

    // --- 6. RENDER TRACKS (ASYNC PARALLEL - RESTORED) ---
    const renderChunk = async (list, isTrash) => {
        if (!list || list.length === 0) return { desk: "", mob: "" };

        // We process all items in parallel to resolve their URLs
        const promises = list.map(async (item) => {
            const idx = allItems.indexOf(item);

            // 1. Get the Resolved URL (Async)
            // This handles Wix, Bytescale, Video Posters, everything.
            let src = await getThumb(item, 300);

            const imgStyle = isTrash ? 'filter: grayscale(100%) brightness(0.7);' : '';

            // Video Indicator
            const raw = (item.proofUrl || item.media || item.url || "").toLowerCase();
            const isVideo = raw.includes('video') || raw.includes('.mp4') || raw.includes('.mov');
            const videoIcon = isVideo ? `<div class="video-indicator">▶</div>` : "";

            const isPending = (item.status || "").toLowerCase().includes('pending');
            const overlay = isPending ? `<div class="pending-overlay"><div class="pending-badge">AWAITING<br>VERDICT</div></div>` : ``;
            const mobBadge = isPending ? `<div style="position:absolute; inset:0; background:rgba(0,0,0,0.6); display:flex; justify-content:center; align-items:center;"><div class="pending-badge" style="font-size:0.4rem; padding:3px; border-width:1px;">WATCHING</div></div>` : ``;

            let stickerHtml = "";
            if (item.sticker && !isTrash && !isPending) {
                stickerHtml = `<img src="${item.sticker}" class="gallery-sticker-badge">`;
            }

            const desk = `
                <div class="${isTrash ? 'item-trash' : 'item-blueprint'}" onclick="window.openHistoryModal(${idx})">
                    <img class="${isTrash ? 'trash-img' : 'blueprint-img'}" 
                         src="${src}" 
                         loading="lazy" 
                         style="${imgStyle}"
                         onerror="this.src='${PLACEHOLDER_IMG}'">
                    ${videoIcon}
                    ${stickerHtml}
                    ${isTrash ? '<div class="trash-stamp">DENIED</div>' : ''}
                    ${overlay}
                </div>`;

            const mob = `
                <div class="mob-scroll-item" onclick="window.openHistoryModal(${idx})" style="${isTrash ? 'height:80px; width:80px;' : ''}">
                    <img src="${src}" class="mob-scroll-img" 
                         loading="lazy" 
                         style="${imgStyle}" 
                         onerror="this.src='${PLACEHOLDER_IMG}'">
                    ${videoIcon}
                    ${stickerHtml}
                    ${mobBadge}
                </div>`;

            return { desk, mob };
        });

        const results = await Promise.all(promises);
        return {
            desk: results.map(r => r.desk).join(''),
            mob: results.map(r => r.mob).join('')
        };
    };

    // --- 7. EXECUTE RENDERS ---

    // A. Accepted (Candidates)
    // Note: Added 'await' because renderChunk is async again
    const acceptedHTML = await renderChunk(candidates, false);
    gridOkay.innerHTML = acceptedHTML.desk;
    if (recGrid) recGrid.innerHTML += acceptedHTML.mob;

    // B. Pending
    if (pendingList.length > 0) {
        const pendingHTML = await renderChunk(pendingList, false);
        if (gridPending) gridPending.innerHTML = pendingHTML.desk;
        if (recGrid) recGrid.innerHTML = pendingHTML.mob + recGrid.innerHTML;
    }

    // C. Denied (Heap)
    const deniedHTML = await renderChunk(deniedList, true);
    gridFailed.innerHTML = deniedHTML.desk;
    if (recHeap) recHeap.innerHTML = deniedHTML.mob;


    // --- 8. RENDER DESKTOP ALTAR ---
    // --- 8. RENDER DESKTOP ALTAR ---
    const renderAltarSlot = async (item, slotObj, isMain) => {
        if (!item || !slotObj.card) {
            if (slotObj.card) slotObj.card.style.display = 'none';
            return;
        }
        slotObj.card.style.display = 'flex';

        // 1. Get Initial Thumb
        let url = await getThumb(item, isMain ? 800 : 400);

        // 2. EXTERNAL IMAGE FIX (UpCDN / Bytescale / Firebase)
        // If it's an external image, getThumb might have messed it up with optimization params.
        // We prefer the RAW proofUrl if it's a direct image link.
        if (item.proofUrl && item.proofUrl.startsWith('http') && !item.proofUrl.includes('wix:')) {
            const ext = item.proofUrl.split('?')[0].split('.').pop().toLowerCase();
            if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
                url = item.proofUrl;
            }
        }

        // 3. VIDEO SAFETY
        if (typeof url === 'string' && (url.includes('.mp4') || url.includes('.mov') || url.includes('.webm') || url.startsWith('wix:video'))) {
            // ... video fallback logic ...
            if (item.cover) url = await getThumb({ proofUrl: item.cover }, isMain ? 800 : 400);
            else if (item.thumbnail) url = await getThumb({ proofUrl: item.thumbnail }, isMain ? 800 : 400);
            else url = PLACEHOLDER_IMG;
        }

        if (slotObj.img) {
            slotObj.img.src = url;
            slotObj.img.onerror = function () { this.src = PLACEHOLDER_IMG; }; // Double safety
        }
        if (slotObj.ref) {
            slotObj.ref.src = url;
            slotObj.ref.onerror = function () { this.src = PLACEHOLDER_IMG; };
        }

        const scoreEl = document.getElementById(isMain ? 'scoreSlot1' : (slotObj === slot2 ? 'scoreSlot2' : 'scoreSlot3'));
        if (scoreEl) scoreEl.innerText = getPoints(item);
    };

    await renderAltarSlot(bestOf[0], slot1, true);
    await renderAltarSlot(bestOf[1], slot2, false);
    await renderAltarSlot(bestOf[2], slot3, false);

    // --- 9. RENDER MOBILE ALTAR (INSIDE THE FUNCTION NOW) ---
    const renderMobSlot = async (item, el, size) => {
        if (!el) return;
        if (item) {
            let url = await getThumb(item, size);

            // EXTERNAL IMAGE FIX (Mobile)
            if (item.proofUrl && item.proofUrl.startsWith('http') && !item.proofUrl.includes('wix:')) {
                const ext = item.proofUrl.split('?')[0].split('.').pop().toLowerCase();
                if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
                    url = item.proofUrl;
                }
            }

            el.src = url;
            el.style.filter = "none";
            el.onerror = function () {
                this.src = IMG_QUEEN_MAIN;
                this.style.filter = "grayscale(100%) brightness(0.5)";
            };
            el.onclick = () => window.openHistoryModal(allItems.indexOf(item));
        } else {
            el.src = IMG_QUEEN_MAIN; // Fallback
            el.style.filter = "grayscale(100%) brightness(0.5)";
        }
    };

    await renderMobSlot(bestOf[0], mob1, 400);

    // Explicit Fallback for Center Slot (Queen) if empty
    if (!bestOf[0] && mob1) {
        mob1.src = "https://static.wixstatic.com/media/ce3e5b_5fc6a144908b493b9473757471ec7ebb~mv2.png";
        mob1.style.filter = "grayscale(100%) brightness(0.5)";
    }

    await renderMobSlot(bestOf[1], mob2, 300);
    await renderMobSlot(bestOf[2], mob3, 300);
}
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
window.openHistoryModal = openHistoryModal;
window.toggleHistoryView = toggleHistoryView;
window.closeModal = closeModal;
window.loadMoreHistory = loadMoreHistory;
// atoneForTask, toggleInspectMode, setGalleryFilter, toggleMobileMenu are already on window
