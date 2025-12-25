// gallery.js - FULL STABLE VERSION

import { 
    galleryData, pendingLimit, historyLimit, currentHistoryIndex, touchStartX 
} from './state.js';
import { 
    setHistoryLimit, setCurrentHistoryIndex, setTouchStartX 
} from './state.js';
import { getOptimizedUrl, cleanHTML, triggerSound } from './utils.js';

// YOUR STICKER LINKS
const STICKER_APPROVE = "https://static.wixstatic.com/media/ce3e5b_a19d81b7f45c4a31a4aeaf03a41b999f~mv2.png";
const STICKER_DENIED = "https://static.wixstatic.com/media/ce3e5b_63a0c8320e29416896d071d5b46541d7~mv2.png";

// 1. Remember if the user is in "Proof Mode" or "Menu Mode"
let isInProofMode = false; 

export function renderGallery() {
    const pGrid = document.getElementById('pendingGrid');
    const hGrid = document.getElementById('historyGrid');
    
    const pItems = galleryData.filter(i => (i.status || "").toLowerCase() === 'pending' && i.proofUrl);
    if (pGrid) pGrid.innerHTML = pItems.slice(0, pendingLimit).map(createPendingCardHTML).join('');
    
    const pSection = document.getElementById('pendingSection');
    if (pSection) pSection.style.display = pItems.length > 0 ? 'block' : 'none';
    
    const hItems = galleryData.filter(i => {
        const s = (i.status || "").toLowerCase();
        return (s.includes('app') || s.includes('rej')) && i.proofUrl;
    });

    if (hGrid) hGrid.innerHTML = hItems.slice(0, historyLimit).map((item, index) => createGalleryItemHTML(item, index)).join('');
    
    const hSection = document.getElementById('historySection');
    if (hSection) hSection.style.display = (hItems.length > 0 || pItems.length === 0) ? 'block' : 'none';
    
    const loadBtn = document.getElementById('loadMoreBtn');
    if (loadBtn) loadBtn.style.display = hItems.length > historyLimit ? 'block' : 'none';
}

export function loadMoreHistory() {
    setHistoryLimit(historyLimit + 25);
    renderGallery();
}

function createPendingCardHTML(item) {
    const cleanText = cleanHTML(item.text).replace(/"/g, '&quot;');
    const isVideo = item.proofUrl.match(/\.(mp4|webm|mov)$/i);
    let thumb = getOptimizedUrl(item.proofUrl, 400);
    
    const encUrl = encodeURIComponent(item.proofUrl || "");
    const encText = encodeURIComponent(item.text || "");
    
    return `<div class="pending-card" onclick='window.openModal("${encUrl}", "PENDING", "${encText}", ${isVideo ? true : false})'>
                <div class="pc-media">
                    <img src="${thumb}" class="pc-thumb" loading="lazy">
                    <div class="pc-gradient"></div>
                    <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center;">
                        <svg style="width:30px; height:30px; fill:var(--neon-yellow);"><use href="#icon-timer"></use></svg>
                    </div>
                </div>
                <div class="pc-content"><div class="pc-badge">PENDING</div><div class="pc-title">${cleanText}</div></div>
            </div>`;
}

function createGalleryItemHTML(item, index) {
    let thumbUrl = getOptimizedUrl(item.proofUrl, 300);
    const s = (item.status || "").toLowerCase();
    const statusSticker = s.includes('app') ? STICKER_APPROVE : STICKER_DENIED;

    return `
        <div class="gallery-item" onclick='window.openHistoryModal(${index})'>
            <img src="${thumbUrl}" class="gi-thumb" style="opacity: ${s.includes('rej') ? '0.3' : '0.7'};">
            <img src="${statusSticker}" class="gi-status-sticker" style="position:absolute; top:5px; right:5px; width:40px; height:40px; z-index:10; filter:drop-shadow(0 0 5px black);">
            ${item.sticker ? `<img src="${item.sticker}" class="gi-reward-sticker" style="position:absolute; bottom:5px; left:5px; width:30px; height:30px; z-index:10;">` : ''}
        </div>`;
}

export function openHistoryModal(index) {
    const historyItems = galleryData.filter(i => {
        const s = (i.status || "").toLowerCase();
        return (s.includes('app') || s.includes('rej')) && i.proofUrl;
    });

    if (!historyItems[index]) return;
    setCurrentHistoryIndex(index);
    const item = historyItems[index];

    // Detect Video vs Image
    const isVideo = item.proofUrl.match(/\.(mp4|webm|mov)($|\?)/i);
    const mediaContainer = document.getElementById('modalMediaContainer');
    
    if (mediaContainer) {
        mediaContainer.innerHTML = isVideo 
            ? `<video src="${item.proofUrl}" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:contain;"></video>`
            : `<img src="${item.proofUrl}" style="width:100%; height:100%; object-fit:contain;">`;
    }

    // Set Info View
    const pointsEl = document.getElementById('modalPoints');
    if (pointsEl) pointsEl.innerText = `+${item.points || 0} PTS`;

    const stickerEl = document.getElementById('modalStatusSticker');
    if (stickerEl) {
        const s = (item.status || "").toLowerCase();
        stickerEl.src = s.includes('app') ? STICKER_APPROVE : STICKER_DENIED;
    }

    const rewardStickerEl = document.getElementById('modalSticker');
    if (rewardStickerEl) {
        rewardStickerEl.innerHTML = item.sticker ? `<img src="${item.sticker}" style="width:80px; height:80px; object-fit:contain;">` : "";
    }

    // Set Text Views
    const fbText = document.getElementById('modalFeedbackText');
    if (fbText) fbText.innerHTML = (item.adminComment || "The Queen has observed your work.").replace(/\n/g, '<br>');
    
    const taskText = document.getElementById('modalOrderText');
    if (taskText) taskText.innerHTML = (item.text || "No task description.").replace(/\n/g, '<br>');

    // Stay in the same view (Proof vs Menu) when swiping
    toggleHistoryView(isInProofMode ? 'proof' : 'info');
    document.getElementById('glassModal').classList.add('active');
}

export function toggleHistoryView(view) {
    const modal = document.getElementById('glassModal');
    const overlay = document.getElementById('modalGlassOverlay');
    if (!modal || !overlay) return;

    // Record if we are in proof mode
    isInProofMode = (view === 'proof');

    const views = {
        info: document.getElementById('modalInfoView'),
        feedback: document.getElementById('modalFeedbackView'),
        task: document.getElementById('modalTaskView')
    };

    Object.values(views).forEach(v => v?.classList.add('hidden'));

    if (view === 'proof') {
        modal.classList.add('proof-mode-active');
        overlay.classList.add('clean');
    } else {
        modal.classList.remove('proof-mode-active');
        overlay.classList.remove('clean');
        if (views[view]) views[view].classList.remove('hidden');
        else if (views.info) views.info.classList.remove('hidden');
    }
}

export function closeModal(e) {
    const overlay = document.getElementById('modalGlassOverlay');
    if (overlay && overlay.classList.contains('clean')) {
        if (e && e.target.id === 'modalCloseX') { /* continue */ } 
        else { toggleHistoryView('info'); return; }
    }
    if (e && e.target.id !== 'glassModal' && e.target.id !== 'modalCloseX' && !e.target.classList.contains('btn-close-red')) return;

    const modal = document.getElementById('glassModal');
    if (modal) {
        modal.classList.remove('active');
        document.getElementById('modalMediaContainer').innerHTML = "";
    }
}

export function openModal(url, status, text, isVideo) {
    const mediaContainer = document.getElementById('modalMediaContainer');
    if (mediaContainer) {
        mediaContainer.innerHTML = isVideo 
            ? `<video src="${decodeURIComponent(url)}" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:contain;"></video>`
            : `<img src="${decodeURIComponent(url)}" style="width:100%; height:100%; object-fit:contain;">`;
    }
    
    // Safety check for modalStatus element
    const statusEl = document.getElementById('modalStatus');
    if (statusEl) {
        statusEl.innerText = status;
        statusEl.style.color = "var(--neon-yellow)";
    }
    
    const orderEl = document.getElementById('modalOrderText');
    if (orderEl) orderEl.innerText = decodeURIComponent(text);

    toggleHistoryView('task');
    document.getElementById('glassModal').classList.add('active');
}

export function initModalSwipeDetection() {
    const modalEl = document.getElementById('glassModal');
    if (!modalEl) return;
    modalEl.addEventListener('touchstart', e => setTouchStartX(e.changedTouches[0].screenX), { passive: true });
    modalEl.addEventListener('touchend', e => {
        const touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;
        if (Math.abs(diff) > 80) {
            if (diff > 0) openHistoryModal(currentHistoryIndex + 1);
            else openHistoryModal(currentHistoryIndex - 1);
        }
    }, { passive: true });
}
