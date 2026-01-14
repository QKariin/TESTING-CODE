import { 
    galleryData, pendingLimit, historyLimit, currentHistoryIndex, touchStartX, 
    setCurrentHistoryIndex, setHistoryLimit, setTouchStartX,
    gameStats, setGameStats, setCurrentTask, setPendingTaskState, setIgnoreBackendUpdates
} from './state.js';
import { getOptimizedUrl, cleanHTML, triggerSound } from './utils.js';

// --- HELPER: POINTS ---
function getPoints(item) {
    let val = item.points || item.score || item.value || item.amount || item.reward || 0;
    return Number(val);
}

// ... (Imports & Helper functions remain the same) ...

// --- HELPER: GET SORTED LIST ---
function getSortedGallery() {
    if (!galleryData) return [];
    return [...galleryData].sort((a, b) => new Date(b._createdDate) - new Date(a._createdDate));
}

// --- MAIN RENDERER ---
export function renderGallery() {
    if (!galleryData) return;

    const gridPerfect = document.getElementById('gridPerfect');
    const gridFailed = document.getElementById('gridFailed');
    const gridOkay = document.getElementById('gridOkay');

    if (!gridPerfect || !gridFailed || !gridOkay) return;

    gridPerfect.innerHTML = "";
    gridFailed.innerHTML = "";
    gridOkay.innerHTML = "";

    const sortedData = getSortedGallery();
    
    // Arrays to hold items for the Top Section Clustering
    let perfectItems = [];

    // 1. DISTRIBUTE ITEMS
    sortedData.forEach((item, index) => {
        let url = item.proofUrl || item.media || item.file;
        if (!url) return;
        
        let thumb = getOptimizedUrl(url, 300);
        let pts = getPoints(item);
        let status = (item.status || "").toLowerCase();
        let isRejected = status.includes('rej') || status.includes('fail');
        
        // Pass index for modal opening
        item.globalIndex = index; 

        if (isRejected) {
            // BOTTOM: REINFORCED CONTAINER
            gridFailed.innerHTML += `
                <div class="item-reinforced" onclick="window.openHistoryModal(${index})">
                    <div class="rivet rv-tl"></div><div class="rivet rv-tr"></div>
                    <div class="rivet rv-bl"></div><div class="rivet rv-br"></div>
                    <div class="status-led"></div>
                    <div class="lock-bar"><div class="lock-cog"></div></div>
                    <img src="${thumb}" class="reinforced-img">
                </div>`;
        } 
        else if (pts > 145) {
            // Add to Perfect Array for Clustering later
            perfectItems.push({ ...item, thumb });
        } 
        else {
            // MIDDLE: NOIR VAULT
            gridOkay.innerHTML += `
                <div class="item-noir" onclick="window.openHistoryModal(${index})">
                    <img src="${thumb}" class="noir-img">
                    <div class="noir-seal">VERIFIED</div>
                </div>`;
        }
    });

    // 2. RENDER TOP SECTION (COLLAGE CLUSTERS)
    // We group them into chunks of 3 (1 Anchor + 2 Satellites)
    for (let i = 0; i < perfectItems.length; i += 3) {
        let group = perfectItems.slice(i, i + 3);
        let clusterHTML = `<div class="collage-cluster">
            <div class="collage-line"></div>
            <div class="collage-ghost-num">0${Math.floor(i/3) + 1}</div>`;
        
        // Item 1: Anchor (Tall)
        if (group[0]) {
            clusterHTML += `
                <div class="img-anchor" onclick="window.openHistoryModal(${group[0].globalIndex})">
                    <img src="${group[0].thumb}" class="collage-img">
                </div>`;
        }
        
        // Items 2 & 3: Satellites (Stack)
        if (group[1] || group[2]) {
            clusterHTML += `<div class="collage-stack">`;
            if (group[1]) {
                clusterHTML += `<div class="img-satellite sat-top" onclick="window.openHistoryModal(${group[1].globalIndex})"><img src="${group[1].thumb}" class="collage-img"></div>`;
            }
            if (group[2]) {
                clusterHTML += `<div class="img-satellite sat-bot" onclick="window.openHistoryModal(${group[2].globalIndex})"><img src="${group[2].thumb}" class="collage-img"></div>`;
            }
            clusterHTML += `</div>`;
        }
        
        clusterHTML += `</div>`;
        gridPerfect.innerHTML += clusterHTML;
    }
    
    // Add Parallax Listener
    const perfContainer = document.getElementById('gridPerfect');
    if(perfContainer) {
        perfContainer.addEventListener('scroll', () => {
            const numbers = perfContainer.querySelectorAll('.collage-ghost-num');
            numbers.forEach(num => {
                // Move numbers slower than the scroll (Parallax)
                num.style.transform = `translateX(${perfContainer.scrollLeft * 0.5}px)`;
            });
        });
    }
}

// --- CRITICAL FIX: EXPORT THIS EMPTY FUNCTION TO PREVENT CRASH ---
export function loadMoreHistory() {
    // Horizontal scrolls usually auto-load, but we keep this to satisfy main.js import
    console.log("History loaded via scroll");
}

export function openHistoryModal(index) {
    const items = getSortedGallery();
    const item = items[index];
    if (!item) return;
    
    // ... (Your existing Modal Logic works here, I can repost if needed) ...
    // For now, let's just make sure the profile loads first!
    if(window.openModalInternal) window.openModalInternal(item); 
    // ^ This assumes we attach the modal logic to window, see below
    
    // Temporary Direct Call to ensure it works immediately
    buildAndShowModal(item);
}

function buildAndShowModal(item) {
    // (Simplified Dossier Modal Builder for immediate function)
    const overlay = document.getElementById('modalGlassOverlay');
    if(!overlay) return;
    
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
    document.getElementById('glassModal').classList.add('active');
}

// Standard Exports
export function toggleHistoryView() {}
export function closeModal(e) {
    document.getElementById('glassModal').classList.remove('active');
}
export function openModal() {} 
export function initModalSwipeDetection() {}

// FORCE WINDOW EXPORTS
window.renderGallery = renderGallery;
window.openHistoryModal = openHistoryModal;
window.closeModal = closeModal;
