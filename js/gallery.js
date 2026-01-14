// gallery.js - THE TRILOGY (Collage / Noir / Reinforced)

import { 
    galleryData, pendingLimit, historyLimit, currentHistoryIndex, touchStartX, 
    setCurrentHistoryIndex, setHistoryLimit, setTouchStartX,
    gameStats, setGameStats, setCurrentTask, setPendingTaskState, setIgnoreBackendUpdates
} from './state.js';
import { getOptimizedUrl, cleanHTML, triggerSound } from './utils.js';

// STICKERS
const STICKER_APPROVE = "https://static.wixstatic.com/media/ce3e5b_a19d81b7f45c4a31a4aeaf03a41b999f~mv2.png";
const STICKER_DENIED = "https://static.wixstatic.com/media/ce3e5b_63a0c8320e29416896d071d5b46541d7~mv2.png";

// --- HELPER: POINTS ---
function getPoints(item) {
    let val = item.points || item.score || item.value || item.amount || item.reward || 0;
    return Number(val);
}

// --- HELPER: SORTED LIST ---
function getSortedGallery() {
    if (!galleryData) return [];
    // Sort by Date (Newest First)
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
    
    // Array to hold Elite items for clustering
    let perfectItems = [];

    // 1. DISTRIBUTE ITEMS INTO BUCKETS
    sortedData.forEach((item, index) => {
        let url = item.proofUrl || item.media || item.file;
        if (!url) return;
        
        let thumb = getOptimizedUrl(url, 300);
        let pts = getPoints(item);
        let status = (item.status || "").toLowerCase();
        let isRejected = status.includes('rej') || status.includes('fail');
        let isPending = status.includes('pending');
        
        // Save global index for modal
        item.globalIndex = index; 

        // A. FAILED -> BOTTOM (Reinforced Container)
        if (isRejected) {
            gridFailed.innerHTML += `
                <div class="item-reinforced" onclick="window.openHistoryModal(${index})">
                    <div class="rivet rv-tl"></div><div class="rivet rv-tr"></div>
                    <div class="rivet rv-bl"></div><div class="rivet rv-br"></div>
                    <div class="status-led"></div>
                    <div class="lock-bar"><div class="lock-cog"></div></div>
                    <img src="${thumb}" class="reinforced-img">
                </div>`;
        } 
        // B. ELITE -> TOP (Collage Queue)
        else if (pts > 145) {
            perfectItems.push({ ...item, thumb });
        } 
        // C. STANDARD/PENDING -> MIDDLE (Noir Vault)
        else {
            const sealText = isPending ? "ANALYZING" : "VERIFIED";
            gridOkay.innerHTML += `
                <div class="item-noir" onclick="window.openHistoryModal(${index})">
                    <img src="${thumb}" class="noir-img">
                    <div class="noir-seal">${sealText}</div>
                </div>`;
        }
    });

    // 2. RENDER TOP SECTION (COLLAGE CLUSTERS)
    // Groups items in sets of 3 for the parallax layout
    for (let i = 0; i < perfectItems.length; i += 3) {
        let group = perfectItems.slice(i, i + 3);
        
        let clusterHTML = `
        <div class="collage-cluster">
            <div class="collage-line"></div>
            <div class="collage-ghost-num">0${Math.floor(i/3) + 1}</div>`;
        
        // Anchor (Main Vertical)
        if (group[0]) {
            clusterHTML += `
                <div class="img-anchor" onclick="window.openHistoryModal(${group[0].globalIndex})">
                    <img src="${group[0].thumb}" class="collage-img">
                </div>`;
        }
        
        // Satellites (Stacked)
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
    
    // Parallax Effect Listener
    const perfContainer = document.getElementById('gridPerfect');
    if(perfContainer) {
        perfContainer.addEventListener('scroll', () => {
            const numbers = perfContainer.querySelectorAll('.collage-ghost-num');
            numbers.forEach(num => {
                num.style.transform = `translateX(${perfContainer.scrollLeft * 0.5}px)`;
            });
        });
    }
}

// --- REDEMPTION LOGIC ---
window.atoneForTask = function(index) {
    const items = getSortedGallery();
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

    // Restore Task
    const restoredTask = { text: task.text, category: 'redemption', timestamp: Date.now() };
    setCurrentTask(restoredTask);
    
    const endTimeVal = Date.now() + 86400000; 
    const newPendingState = { task: restoredTask, endTime: endTimeVal, status: "PENDING" };
    setPendingTaskState(newPendingState);
    
    window.closeModal(); 
    
    // Update UI State
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

// --- MODAL LOGIC (DOSSIER STYLE) ---

export function openHistoryModal(index) {
    const items = getSortedGallery();
    const item = items[index];
    if (!item) return;
    
    setCurrentHistoryIndex(index);

    const isVideo = (item.proofUrl || "").match(/\.(mp4|webm|mov)($|\?)/i);
    const mediaContainer = document.getElementById('modalMediaContainer');
    if (mediaContainer) {
        mediaContainer.innerHTML = isVideo 
            ? `<video src="${item.proofUrl}" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:contain;"></video>`
            : `<img src="${item.proofUrl}" style="width:100%; height:100%; object-fit:contain;">`;
    }

    const overlay = document.getElementById('modalGlassOverlay');
    if (overlay) {
        const pts = getPoints(item);
        const s = (item.status || "").toLowerCase();
        const isRejected = s.includes('rej') || s.includes('fail');
        const isPending = s.includes('pending');
        
        let statusImg = "";
        let statusText = "SYSTEM VERDICT";
        
        if (isPending) {
            statusText = "AWAITING REVIEW";
        } else {
            statusImg = s.includes('app') ? STICKER_APPROVE : (isRejected ? STICKER_DENIED : "");
        }

        const statusDisplay = isPending 
            ? `<div style="font-size:3rem;">⏳</div>` 
            : `<img src="${statusImg}" style="width:100px; height:100px; object-fit:contain; margin-bottom:15px; opacity:0.8;">`;

        let footerAction = `<button onclick="event.stopPropagation(); window.closeModal(event)" class="history-action-btn btn-close-red" style="grid-column: span 2;">CLOSE FILE</button>`;
        if (isRejected) {
            footerAction = `<button onclick="event.stopPropagation(); window.atoneForTask(${index})" class="btn-skip-small" style="grid-column: span 2; border-color:var(--neon-red); color:var(--neon-red); width:100%;">ATONE (-100 🪙)</button>`;
        }

        overlay.innerHTML = `
            <div id="modalCloseX" onclick="window.closeModal(event)" style="position:absolute; top:20px; right:20px; font-size:2.5rem; cursor:pointer; color:white; z-index:110;">×</div>
            
            <div class="theater-content dossier-layout">
                <div class="dossier-sidebar">
                    <div id="modalInfoView" class="sub-view">
                        <div class="dossier-block">
                            <div class="dossier-label">${statusText}</div>
                            ${statusDisplay}
                        </div>
                        <div class="dossier-block">
                            <div class="dossier-label">MERIT VALUE</div>
                            <div class="m-points-lg" style="color:${isRejected ? 'red' : (isPending ? 'cyan' : 'gold')}">
                                ${isPending ? "CALCULATING" : "+" + pts}
                            </div>
                        </div>
                    </div>

                    <div id="modalFeedbackView" class="sub-view hidden">
                        <div class="dossier-label">OFFICER NOTES</div>
                        <div class="theater-text-box">${(item.adminComment || "No notes.").replace(/\n/g, '<br>')}</div>
                    </div>
                    
                    <div id="modalTaskView" class="sub-view hidden">
                         <div class="dossier-label">DIRECTIVE</div>
                         <div class="theater-text-box">${(item.text || "").replace(/\n/g, '<br>')}</div>
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

export function closeModal(e) {
    if (e && (e.target.id === 'modalCloseX' || e.target.classList.contains('btn-close-red'))) {
        document.getElementById('glassModal').classList.remove('active');
        document.getElementById('modalMediaContainer').innerHTML = "";
        return;
    }
    const overlay = document.getElementById('modalGlassOverlay');
    if (overlay && overlay.classList.contains('clean')) {
        toggleHistoryView('info'); 
        return;
    }
}

// Prevent main.js crash
export function loadMoreHistory() {
    renderGallery();
}

export function initModalSwipeDetection() {
    // Keep empty or add logic if needed
}

// FORCE WINDOW EXPORTS
window.renderGallery = renderGallery;
window.openHistoryModal = openHistoryModal;
window.toggleHistoryView = toggleHistoryView;
window.closeModal = closeModal;
window.atoneForTask = window.atoneForTask; // ensure global access
