import { 
    galleryData, pendingLimit, historyLimit, currentHistoryIndex, touchStartX, 
    setCurrentHistoryIndex, setHistoryLimit, setTouchStartX 
} from './state.js';
import { getOptimizedUrl, cleanHTML, triggerSound } from './utils.js';

// STICKERS (Data only, no UI circles anymore)
const STICKER_APPROVE = "https://static.wixstatic.com/media/ce3e5b_a19d81b7f45c4a31a4aeaf03a41b999f~mv2.png";
const STICKER_DENIED = "https://static.wixstatic.com/media/ce3e5b_63a0c8320e29416896d071d5b46541d7~mv2.png";

let activeStickerFilter = "ALL"; 

// --- GAZE INTERACTION (THE FLASHLIGHT) ---
window.handleGazeMove = function(e) {
    const container = document.getElementById('gazeContainer');
    if (!container) return;
    
    // Calculate mouse position relative to container
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Update CSS variables for the mask
    container.style.setProperty('--mouse-x', `${x}px`);
    container.style.setProperty('--mouse-y', `${y}px`);
};

// --- HELPER: POINTS ---
function getPoints(item) {
    let val = item.points || item.score || item.value || item.amount || item.reward || 0;
    return Number(val);
}

// --- HELPER: GET LIST ---
function getGalleryList() {
    if (!galleryData) return [];

    let items = galleryData.filter(i => {
        const s = (i.status || "").toLowerCase();
        return (s.includes('pending') || s.includes('app') || s.includes('rej')) && i.proofUrl;
    });

    if (activeStickerFilter === "DENIED") {
        items = items.filter(item => (item.status || "").toLowerCase().includes('rej'));
    } 
    else if (activeStickerFilter === "PENDING") {
        items = items.filter(item => (item.status || "").toLowerCase().includes('pending'));
    }

    // Sort by Date
    return items.sort((a, b) => new Date(b._createdDate) - new Date(a._createdDate));
}

// --- FILTER LOGIC (MONOLITHS) ---
window.setGalleryFilter = function(filterType) {
    activeStickerFilter = filterType;
    
    // Update Monolith UI
    const bars = document.querySelectorAll('.monolith-bar');
    bars.forEach(b => b.classList.remove('active'));
    
    // Map click to visual bar (0=Wait, 1=All, 2=Deny)
    if(filterType === 'PENDING') bars[0].classList.add('active');
    if(filterType === 'ALL') bars[1].classList.add('active');
    if(filterType === 'DENIED') bars[2].classList.add('active');

    renderGallery(); 
};

// --- RENDER ---
export function renderGallery() {
    if (!galleryData) return;
    
    // Normalize data
    galleryData.forEach(item => {
        if (!item.proofUrl) {
            const c = ['media', 'file', 'evidence', 'url', 'image', 'src'];
            for (let k of c) if (item[k]) item.proofUrl = item[k];
        }
    });

    const hGrid = document.getElementById('historyGrid');
    const items = getGalleryList(); 

    if (hGrid) {
        hGrid.innerHTML = items.slice(0, historyLimit).map((item, index) => createGalleryItemHTML(item, index)).join('');
    }
    
    const loadBtn = document.getElementById('loadMoreBtn');
    if (loadBtn) loadBtn.style.display = (items.length > historyLimit) ? 'block' : 'none';
}

function createGalleryItemHTML(item, index) {
    let thumbUrl = getOptimizedUrl(item.proofUrl, 300);
    const s = (item.status || "").toLowerCase();
    
    const isPending = s.includes('pending');
    const isRejected = s.includes('rej');
    const pts = getPoints(item);

    // --- TEXTURAL HIERARCHY LOGIC ---
    let styleClass = "style-shadow"; // Default (Design 1)

    if (isPending) {
        styleClass = "style-shadow"; // Pending sits deep in the wall
    } 
    else if (isRejected) {
        styleClass = "style-sealed"; // Denied is sealed shut (Design 12)
    } 
    else if (pts > 145) {
        styleClass = "style-hud"; // Elite gets the Gold Grid (Design 11)
    }

    // --- OVERLAYS ---
    let overlayHTML = "";
    
    // Elite Badge
    if (pts > 145 && !isRejected) {
        overlayHTML += `<div style="position:absolute; bottom:5px; right:5px; color:var(--gold); font-family:'Rajdhani'; font-weight:700; background:rgba(0,0,0,0.8); padding:0 4px; border:1px solid var(--gold); z-index:30;">+${pts}</div>`;
    }

    // Pending Icon
    if (isPending) {
        overlayHTML += `<div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; z-index:10;"><div style="font-size:2rem; text-shadow:0 0 10px gold;">⏳</div></div>`;
    }

    // Denied Stamp
    if (isRejected) {
        overlayHTML += `<div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; z-index:10;"><div style="font-family:'Black Ops One'; color:#333; font-size:1.2rem; transform:rotate(-15deg); border:2px solid #333; padding:5px;">SEALED</div></div>`;
    }

    const isVideo = (item.proofUrl || "").match(/\.(mp4|webm|mov)($|\?)/i);

    return `
        <div class="gallery-item ${styleClass}" onclick='window.openHistoryModal(${index})'>
            ${isVideo 
                ? `<video src="${thumbUrl}" class="gi-thumb" muted loop></video>` 
                : `<img src="${thumbUrl}" class="gi-thumb" loading="lazy">`
            }
            ${overlayHTML}
        </div>`;
}

// --- MODAL ---
export function openHistoryModal(index) {
    const items = getGalleryList();
    if (!items[index]) return;
    
    setCurrentHistoryIndex(index);
    const item = items[index];
    const s = (item.status || "").toLowerCase();
    const isRejected = s.includes('rej');
    const isPending = s.includes('pending');
    const pts = getPoints(item);

    const isVideo = item.proofUrl.match(/\.(mp4|webm|mov)($|\?)/i);
    const mediaContainer = document.getElementById('modalMediaContainer');
    if (mediaContainer) {
        mediaContainer.innerHTML = isVideo 
            ? `<video src="${item.proofUrl}" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:contain;"></video>`
            : `<img src="${item.proofUrl}" style="width:100%; height:100%; object-fit:contain;">`;
    }

    const overlay = document.getElementById('modalGlassOverlay');
    if (overlay) {
        // ... (Keep existing modal HTML structure, it works well with the new CSS) ...
        // Just ensuring fonts are updated via CSS class 'dossier-layout'
        
        let footerAction = `<button onclick="event.stopPropagation(); window.closeModal(event)" class="history-action-btn btn-close-red" style="grid-column: span 2;">CLOSE FILE</button>`;
        if (isRejected) {
            footerAction = `<button onclick="event.stopPropagation(); window.atoneForTask(${index})" class="btn-atone" style="grid-column: span 2;">ATONE (-100 🪙)</button>`;
        }

        overlay.innerHTML = `
            <div id="modalCloseX" onclick="window.closeModal(event)" style="position:absolute; top:20px; right:20px; font-size:2.5rem; cursor:pointer; color:white; z-index:110;">×</div>
            
            <div class="theater-content dossier-layout">
                <div class="dossier-sidebar">
                    <div id="modalInfoView" class="sub-view">
                        <div class="dossier-block">
                            <div class="dossier-label">STATUS</div>
                            <div style="font-size:1.5rem; font-family:'Courier Prime'; color:${isRejected ? 'red' : (isPending ? 'yellow' : 'gold')}">
                                ${isPending ? 'ANALYZING' : (isRejected ? 'PURGED' : 'ARCHIVED')}
                            </div>
                        </div>
                        <div class="dossier-block">
                            <div class="dossier-label">VALUE</div>
                            <div class="m-points-lg" style="font-family:'Courier Prime'; font-size:3rem;">${pts}</div>
                        </div>
                    </div>

                    <div id="modalFeedbackView" class="sub-view hidden">
                        <div class="dossier-label">OFFICER NOTES</div>
                        <div class="theater-text-box" style="font-family:'Courier Prime'; font-size:0.8rem;">${(item.adminComment || "No notes.").replace(/\n/g, '<br>')}</div>
                    </div>
                    
                    <div id="modalTaskView" class="sub-view hidden">
                         <div class="dossier-label">DIRECTIVE</div>
                         <div class="theater-text-box" style="font-family:'Courier Prime'; font-size:0.8rem;">${(item.text || "").replace(/\n/g, '<br>')}</div>
                    </div>
                </div>
            </div>

            <div class="modal-footer-menu">
                <button onclick="event.stopPropagation(); window.toggleHistoryView('feedback')" class="history-action-btn">NOTES</button>
                <button onclick="event.stopPropagation(); window.toggleHistoryView('task')" class="history-action-btn">ORDER</button>
                <button onclick="event.stopPropagation(); window.toggleHistoryView('proof')" class="history-action-btn">EVIDENCE</button>
                <button onclick="event.stopPropagation(); window.toggleHistoryView('info')" class="history-action-btn">DATA</button>
                ${footerAction}
            </div>
        `;
    }

    toggleHistoryView('info');
    document.getElementById('glassModal').classList.add('active');
}

// ... (Rest of exports same as before) ...
export function toggleHistoryView(view) { /* ... same ... */ }
export function closeModal(e) { /* ... same ... */ }
export function openModal(url, status, text, isVideo) { /* ... same ... */ }
export function loadMoreHistory() { setHistoryLimit(historyLimit + 25); renderGallery(); }
export function initModalSwipeDetection() { /* ... same ... */ }

window.renderGallery = renderGallery;
window.openHistoryModal = openHistoryModal;
window.toggleHistoryView = toggleHistoryView;
window.closeModal = closeModal;
window.openModal = openModal;
window.setGalleryFilter = function(filterType) {
    activeStickerFilter = filterType;
    renderGallery(); 
};
