// Dashboard User Management
// User detail display, task queue management, and user interactions

import { 
    users, currId, cooldownInterval, histLimit, lastHistoryJson, stickerConfig,
    availableDailyTasks, 
    setCooldownInterval, setHistLimit, setLastHistoryJson, setArmoryTarget
} from './dashboard-state.js';
import { clean, raw, formatTimer } from './dashboard-utils.js';
import { Bridge } from './bridge.js';
import { getOptimizedUrl, getSignedUrl } from './media.js';

// --- STEP 2: EXPANSION MEMORY ---
// This keeps tasks open during the 4-second Wix refresh
const mainDashboardExpandedTasks = new Set();

// --- BIND TO WINDOW IMMEDIATELY ---
window.modPoints = modPoints;
window.loadMoreHist = loadMoreHist;
window.openQueueTask = openQueueTask;
window.deleteQueueItem = deleteQueueItem;
window.addQueueTask = addQueueTask;
window.updateDetail = updateDetail;
window.toggleMainTaskExpansion = toggleMainTaskExpansion;

// --- STABILITY CACHE ---
let cachedFillers = [];
let fillerUserId = null;

export function updateDetail(u) {
    if (!u) return;
    
    // 1. Online Status
    const now = Date.now();
    const ls = u.lastSeen ? new Date(u.lastSeen).getTime() : 0;
    let diff = 999999;
    if (ls > 0) diff = Math.floor((now - ls) / 60000);
    
    let status = "OFFLINE";
    let isOnline = false;
    if (ls > 0 && !isNaN(diff)) {
        if (diff < 2) { status = "ONLINE"; isOnline = true; }
        else if (diff < 60) { status = diff + " MIN AGO"; }
    }
    
    const lsEl = document.getElementById('lastSeen');
    if (lsEl) {
        lsEl.innerText = status;
        if (isOnline) { 
            lsEl.classList.add('online'); 
            lsEl.style.textShadow = "0 0 5px rgba(57,255,20,0.5)"; 
        } else { 
            lsEl.classList.remove('online'); 
            lsEl.style.textShadow = "none"; 
        }
    }
    
    // 2. Application Button
    const appBtn = document.getElementById('btnAppView');
    if (appBtn) appBtn.style.display = u.application ? 'block' : 'none';
    
    // 3. Basic info
    document.getElementById('dName').innerText = u.name;
    document.getElementById('dRank').innerText = u.hierarchy;
    document.getElementById('dPoints').innerText = u.points || 0;
    
    const walletVal = document.getElementById('dWalletVal');
    if (walletVal) walletVal.innerText = u.coins || 0;
    
    document.getElementById('dTasks').innerText = u.completed || 0;
    document.getElementById('dStreak').innerText = u.streak || 0;
    document.getElementById('dStrikes').innerText = u.strikeCount || 0;
    
    // Joined Date - YOUR WORKING CODE
    const joined = u.joinedDate ? new Date(u.joinedDate).toLocaleDateString() : "N/A";
    const joinedEl = document.getElementById('dJoined');
    if (joinedEl) joinedEl.innerText = `SLAVE SINCE: ${joined}`;
    
    // 4. Trigger sub-renders
    updatePointsGrid();
    updateStickerCase(u);
    updateReviewQueue(u);
    updateActiveTask(u);
    updateTaskQueue(u);
    updateHistory(u);
    
    // NEW: Add missing function calls
    updateTelemetry(u);
    updateDossier(u);
    updateInventory(u);
    updateAltar(u);
    updateTrophies(u);
}

function updatePointsGrid() {
    const ptsGrid = document.getElementById('pointsGrid');
    if (!ptsGrid) return;
    
    let html = `<button class="q-btn q-minus" onclick="modPoints(-10)">-10</button>
                <button class="q-btn q-minus" onclick="modPoints(-50)">-50</button>`;
    
    const source = (stickerConfig.length > 0) ? stickerConfig : [{ val: 10, url: '' }, { val: 20, url: '' }];
    source.forEach(s => {
        html += `<div class="q-btn-img" onclick="modPoints(${s.val})">
            ${s.url ? `<img src="${getOptimizedUrl(s.url, 50)}">` : `<svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:#444;"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`}
            <span>+${s.val}</span>
        </div>`;
    });
    ptsGrid.innerHTML = html;
}

function updateStickerCase(u) {
    const container = document.getElementById('userStickerCase');
    if (container) {
        if (u.stickers && u.stickers.length > 0) {
            container.innerHTML = u.stickers.map(url => 
                `<div class="my-sticker"><img src="${getOptimizedUrl(url, 50)}"></div>`
            ).join('');
            container.style.display = 'flex';
        } else { 
            container.style.display = 'none'; 
        }
    }
}

function updateReviewQueue(u) {
    const qSec = document.getElementById('userQueueSec');
    if (!qSec) return;
    
    if (u.reviewQueue && u.reviewQueue.length > 0) {
        qSec.style.display = 'flex';
        qSec.innerHTML = `<div class="sec-title" style="color:var(--red);">PENDING REVIEW</div>` + 
            u.reviewQueue.map(t => 
                `<div class="pend-card" onclick="openModById('${t.id}', '${t.memberId}', false)">
                    <img src="${getOptimizedUrl(t.proofUrl, 150)}" class="pend-thumb">
                    <div class="pend-info">
                        <div class="pend-act">PENDING</div>
                        <div class="pend-txt">${clean(t.text)}</div>
                    </div>
                </div>`
            ).join('');
    } else { 
        qSec.style.display = 'none'; 
    }
}

function updateActiveTask(u) {
    if (cooldownInterval) clearInterval(cooldownInterval);
    
    if (u.activeTask && u.endTime && u.endTime > Date.now()) {
        document.getElementById('dActiveText').innerText = clean(u.activeTask.text);
        
        const tick = () => {
            const diff = u.endTime - Date.now();
            if (diff <= 0) { 
                document.getElementById('dActiveTimer').innerText = "00:00"; 
                clearInterval(cooldownInterval); 
                return; 
            }
            document.getElementById('dActiveTimer').innerText = formatTimer(diff);
        };
        tick();
        const interval = setInterval(tick, 1000);
        setCooldownInterval(interval);
    } else {
        document.getElementById('dActiveText').innerText = "No Active Task";
        document.getElementById('dActiveTimer').innerText = "--:--";
    }
}

// --- UPDATED RENDERER (STEP 2 INTEGRATED) ---
export function updateTaskQueue(u) {
    const listContainer = document.getElementById('qListContainer');
    if (!listContainer) return;
    
    let personalTasks = u.taskQueue || [];
    
    // Stability cache logic
    if (fillerUserId !== u.memberId || cachedFillers.length === 0) {
        cachedFillers = (availableDailyTasks || []).sort(() => 0.5 - Math.random()).slice(0, 10);
        fillerUserId = u.memberId;
    }
    
    const displayTasks = [...personalTasks, ...cachedFillers.slice(0, Math.max(0, 10 - personalTasks.length))];
    
    listContainer.innerHTML = displayTasks.map((t, idx) => {
        const isPersonal = idx < personalTasks.length;
        const niceText = clean(t);
        const isExpanded = mainDashboardExpandedTasks.has(niceText);
        
        return `<div class="q-item-line ${isPersonal ? 'direct-order' : 'filler-task'} ${isExpanded ? 'is-expanded' : ''}">
            <div class="dr-card-header">
                <span class="q-handle">${isPersonal ? '★' : ''}</span>
                ${isPersonal ? `<span class="q-badge-queen">QUEEN</span>` : '<span style="font-size:0.4rem; color:#333;">SYSTEM</span>'}
                ${isPersonal ? `<span class="q-del" onclick="event.stopPropagation(); deleteQueueItem('${u.memberId}', ${idx})">&times;</span>` : '<span></span>'}
            </div>
            <div class="q-txt-line">${niceText}</div>
            <div class="dr-mirror-arrow" onclick="event.stopPropagation(); toggleMainTaskExpansion(this, '${raw(niceText)}')">▼</div>
        </div>`;
    }).join('');
}

// THE MEMORY TOGGLE FUNCTION
export function toggleMainTaskExpansion(btn, taskText) {
    const card = btn.closest('.compact-task-card');
    if (!card) return;
    
    if (mainDashboardExpandedTasks.has(taskText)) {
        mainDashboardExpandedTasks.delete(taskText);
        card.classList.remove('is-expanded');
    } else {
        mainDashboardExpandedTasks.add(taskText);
        card.classList.add('is-expanded');
    }
}

window.assignFillerTask = function(text) {
    const u = users.find(x => x.memberId === currId);
    if (!u) return;
    if (!u.taskQueue) u.taskQueue = [];
    u.taskQueue.push(text);
    fillerUserId = null;
    window.parent.postMessage({ type: "updateTaskQueue", memberId: currId, queue: u.taskQueue }, "*");
    Bridge.send("updateTaskQueue", { memberId: currId, queue: u.taskQueue });
    updateDetail(u);
};

async function updateHistory(u) {
    const currentJson = JSON.stringify(u.history || []);
    if (currentJson !== lastHistoryJson || histLimit > 10) {
        setLastHistoryJson(currentJson);
        const hGrid = document.getElementById('userHistoryGrid');
        if (!hGrid) return;
        
        const cleanHist = (u.history || []).filter(h => h.status && h.status !== 'fail' && (!h.text || !h.text.toUpperCase().includes('SKIPPED')));
        let historyToShow = cleanHist.slice(0, histLimit);
        
        const loadBtn = document.getElementById('loadMoreHist');
        if (loadBtn) loadBtn.style.display = (cleanHist.length > histLimit) ? 'block' : 'none';
        
        const signingPromises = historyToShow.map(async h => {
            console.log("RAW:", h.proofUrl);
            h.thumbSigned = await getSignedUrl(getOptimizedUrl(h.proofUrl, 150));
            h.fullSigned = await getSignedUrl(h.proofUrl);
            console.log("thumb:", h.thumbSigned);
        });
        await Promise.all(signingPromises);
        
        hGrid.innerHTML = historyToShow.length > 0 ? historyToShow.map(h => {
            const cls = h.status === 'approve' ? 'hb-app' : 'hb-rej';
            return `<div class="h-card-mini" onclick='openModal(null, null, "${h.fullSigned||''}", "${h.proofType||'text'}", "${raw(h.text)}", true, "${h.status}")'>
                <img src="${h.thumbSigned}" class="hc-img">
                <div class="h-badge ${cls}">${h.status.toUpperCase()}</div>
            </div>`;
        }).join('') : '<div style="color:#444; font-size:0.7rem;">No history.</div>';
    }
}

// === MISSING FUNCTIONS FROM ORIGINAL ===

function updateTelemetry(u) {
    const total = u.kneelCount || 0; 
    const hours = (total * 0.25).toFixed(1); // Assuming 15m per kneel
    
    setText('dTotalKneel', `${hours} HRS`);
    setText('dLastKneel', u.lastKneelDate ? new Date(u.lastKneelDate).toLocaleDateString() : "NEVER");
}

function updateDossier(u) {
    const grid = document.getElementById('dossierGrid');
    if(!grid) return;
    
    let content = "";
    if(u.kinks) content += `<div style="margin-bottom:10px;"><div style="color:var(--blue); font-size:0.6rem; margin-bottom:2px;">KINKS</div><div style="color:#ccc; font-size:0.8rem; line-height:1.2;">${u.kinks}</div></div>`;
    if(u.limits) content += `<div><div style="color:var(--red); font-size:0.6rem; margin-bottom:2px;">LIMITS</div><div style="color:#ccc; font-size:0.8rem; line-height:1.2;">${u.limits}</div></div>`;
    
    if(!content) content = '<div style="color:#444; font-size:0.7rem;">FILE EMPTY</div>';
    grid.innerHTML = content;
}

function updateInventory(u) {
    const grid = document.getElementById('inventoryGrid');
    if(!grid) return;

    let items = [];
    if (u.purchasedItems) {
        if (Array.isArray(u.purchasedItems)) items = u.purchasedItems;
        else if (typeof u.purchasedItems === 'string') {
            try { items = JSON.parse(u.purchasedItems); } catch(e) {}
        }
    }

    if(items.length === 0) {
        grid.innerHTML = '<div style="color:#444; font-size:0.7rem; text-align:center;">NO TRIBUTES</div>';
        return;
    }

    grid.innerHTML = items.map(i => `
        <div style="background:#111; border:1px solid #333; padding:5px; display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
            <div style="font-size:0.7rem; color:var(--gold); font-family:'Cinzel';">${i.name || i.itemName || "Item"}</div>
            <div style="font-size:0.6rem; color:#666;">${i.price || i.cost || 0}</div>
        </div>
    `).join('');
}

function updateAltar(u) {
    // Future expansion: Make these droppable targets
}

function updateTrophies(u) {
    const container = document.getElementById('userStickerCase');
    if(!container) return;

    const ranks = ["Hall Boy", "Footman", "Silverman", "Butler", "Chamberlain", "Secretary", "Champion"];
    const current = u.hierarchy || "";
    const idx = ranks.findIndex(r => r.toLowerCase() === current.toLowerCase());

    let html = '<div style="display:flex; gap:5px; flex-wrap:wrap;">';
    ranks.forEach((r, i) => {
        const unlocked = i <= idx;
        const color = unlocked ? "var(--gold)" : "#333";
        const bg = unlocked ? "rgba(197, 160, 89, 0.1)" : "transparent";
        html += `<div style="border:1px solid ${color}; background:${bg}; padding:4px 8px; font-size:0.6rem; color:${color}; border-radius:4px;" title="${r}">
            ${i+1}
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

// Helper function
function setText(id, txt) {
    const el = document.getElementById(id);
    if(el) el.innerText = txt;
}

// === EXPORTED FUNCTIONS ===

export function modPoints(amount) {
    if (!currId) return;
    window.parent.postMessage({ type: "adjustPoints", memberId: currId, amount: amount }, "*");
}

export function loadMoreHist() { 
    setHistLimit(histLimit + 10); 
    const u = users.find(x => x.memberId === currId); 
    if (u) updateDetail(u); 
}

export function openQueueTask(memberId, index) {
    const u = users.find(x => x.memberId === memberId);
    if (u?.taskQueue?.[index]) {
        import('./dashboard-modals.js').then(m => m.openModal(null, null, '', 'text', u.taskQueue[index], true, 'QUEUE_TASK'));
    }
}

export function deleteQueueItem(memberId, index) {
    const u = users.find(x => x.memberId === memberId);
    if (u?.taskQueue) {
        u.taskQueue.splice(index, 1);
        fillerUserId = null;
        window.parent.postMessage({ type: "updateTaskQueue", memberId: memberId, queue: u.taskQueue }, "*");
        Bridge.send("updateTaskQueue", { memberId: memberId, queue: u.taskQueue });
        updateDetail(u);
    }
}

export function addQueueTask() {
    const input = document.querySelector('#tabOps #qInput') || document.getElementById('qInput');
    
    if (!input) return console.error("Input #qInput not found!");
    
    if (!currId) {
        alert("Select a Slave first.");
        return;
    }

    const txt = input.value.trim();

    if (!txt) {
        // SCENARIO A: Input is Empty -> OPEN DATABASE (Armory)
        console.log("Input empty. Opening Task Gallery for QUEUE...");
        setArmoryTarget('queue'); 
        
        if(window.openTaskGallery) {
            window.openTaskGallery();
        } else {
            console.error("openTaskGallery function not found on window!");
        }
        return;
    }
    
    // SCENARIO B: Input has Text -> ADD MANUAL TASK
    const u = users.find(x => x.memberId === currId);
    if (u) {
        if (!u.taskQueue) u.taskQueue = [];
        u.taskQueue.push(txt);
        fillerUserId = null;
        
        window.parent.postMessage({ type: "updateTaskQueue", memberId: currId, queue: u.taskQueue }, "*");
        
        if(window.Bridge) {
            window.Bridge.send("updateTaskQueue", { memberId: currId, queue: u.taskQueue });
        }

        input.value = '';
        updateDetail(u); 
    }
}
