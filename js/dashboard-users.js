// Dashboard User Management (TABBED EDITION)
import { 
    users, currId, cooldownInterval, histLimit, lastHistoryJson, stickerConfig,
    availableDailyTasks, 
    setCooldownInterval, setHistLimit, setLastHistoryJson 
} from './dashboard-state.js';
import { clean, raw, formatTimer } from './dashboard-utils.js';
import { Bridge } from './bridge.js';
import { getOptimizedUrl, getSignedUrl } from './media.js';

// --- BIND WINDOW FUNCTIONS ---
window.modPoints = modPoints;
window.loadMoreHist = loadMoreHist;
window.openQueueTask = openQueueTask;
window.deleteQueueItem = deleteQueueItem;
window.addQueueTask = addQueueTask;
window.updateDetail = updateDetail;
window.toggleMainTaskExpansion = toggleMainTaskExpansion; 

// --- CACHE & MEMORY ---
const mainDashboardExpandedTasks = new Set();
let cachedFillers = [];
let fillerUserId = null;

export function updateDetail(u) {
    if (!u) return;
    
    // --- 1. VITALS DECK (Always Visible) ---
    // Online Status
    const now = Date.now();
    const ls = u.lastSeen ? new Date(u.lastSeen).getTime() : 0;
    let diff = Math.floor((now - ls) / 60000);
    let status = (ls > 0 && diff < 2) ? "ONLINE" : (ls > 0 ? diff + " MIN AGO" : "OFFLINE");
    
    const lsEl = document.getElementById('lastSeen');
    if (lsEl) {
        lsEl.innerText = status;
        lsEl.classList.toggle('online', status === "ONLINE");
    }
    
    // Basic Info
    document.getElementById('dName').innerText = u.name;
    document.getElementById('dRank').innerText = u.hierarchy || "SLAVE";
    document.getElementById('dWalletVal').innerText = u.coins || 0;
    
    // --- 2. TAB: OPS (Operations) ---
    updateActiveTask(u);
    updateTaskQueue(u);
    updateDailyProtocol(u); // New

    // --- 3. TAB: INTEL (Data) ---
    updateTelemetry(u);
    updateDossier(u);
    updateInventory(u);

    // --- 4. TAB: RECORD (History) ---
    updateAltar(u);
    updateTrophies(u);
    updateHistory(u);
}

// =========================================
// TAB 1: OPS (OPERATIONS)
// =========================================

function updateActiveTask(u) {
    if (cooldownInterval) clearInterval(cooldownInterval);
    if (u.activeTask && u.endTime && u.endTime > Date.now()) {
        document.getElementById('dActiveText').innerText = clean(u.activeTask.text);
        const tick = () => {
            const diff = u.endTime - Date.now();
            if (diff <= 0) { document.getElementById('dActiveTimer').innerText = "00:00"; clearInterval(cooldownInterval); return; }
            document.getElementById('dActiveTimer').innerText = formatTimer(diff);
        };
        tick();
        const interval = setInterval(tick, 1000);
        setCooldownInterval(interval);
    } else {
        document.getElementById('dActiveText').innerText = "IDLE";
        document.getElementById('dActiveTimer').innerText = "--:--";
    }
}

function updateTaskQueue(u) {
    const listContainer = document.getElementById('qListContainer');
    if (!listContainer) return;

    let personalTasks = u.taskQueue || [];
    // Only fetch filler if user changed or empty
    if (fillerUserId !== u.memberId || cachedFillers.length === 0) {
        cachedFillers = (availableDailyTasks || []).sort(() => 0.5 - Math.random()).slice(0, 10);
        fillerUserId = u.memberId;
    }
    const displayTasks = [...personalTasks, ...cachedFillers.slice(0, Math.max(0, 10 - personalTasks.length))];

    listContainer.innerHTML = displayTasks.map((t, idx) => {
        const isPersonal = idx < personalTasks.length;
        const niceText = clean(t);
        return `
            <div class="q-item-line ${isPersonal ? 'direct-order' : 'filler-task'}">
                <div class="dr-card-header">
                    <span class="q-handle">${isPersonal ? '★' : ''}</span>
                    ${isPersonal ? `<span class="q-badge-queen">QUEEN</span>` : '<span style="font-size:0.4rem; color:#333;">SYSTEM</span>'}
                    ${isPersonal ? `<span class="q-del" onclick="event.stopPropagation(); deleteQueueItem('${u.memberId}', ${idx})">&times;</span>` : ''}
                </div>
                <div class="q-txt-line">${niceText}</div>
            </div>`;
    }).join('');
}

function updateDailyProtocol(u) {
    const container = document.getElementById('userRoutineList');
    if(!container) return;

    if (!u.routine) {
        container.innerHTML = '<div style="color:#666; font-size:0.7rem; text-align:center;">NO ROUTINE ASSIGNED</div>';
        return;
    }

    // Logic: Check if they uploaded evidence today
    const isDone = u.routineDoneToday === true; // Requires this flag from backend
    const statusColor = isDone ? 'var(--green)' : '#666';
    const statusIcon = isDone ? '✔' : '☐';

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; background:#111; padding:10px; border:1px solid #333;">
            <div style="font-family:'Cinzel'; color:#fff;">${u.routine.toUpperCase()}</div>
            <div style="color:${statusColor}; font-weight:bold;">${statusIcon}</div>
        </div>
    `;
}

// =========================================
// TAB 2: INTEL (DATA)
// =========================================

function updateTelemetry(u) {
    // Kneeling Stats
    const total = u.kneelCount || 0; 
    // Mocking "Hours" for now based on count * avg session (e.g. 15 mins)
    const hours = Math.floor((total * 15) / 60); 

    document.getElementById('dTotalKneel').innerText = `${hours}h`;
    document.getElementById('dLastKneel').innerText = u.lastKneelDate ? new Date(u.lastKneelDate).toLocaleDateString() : "Never";
}

function updateDossier(u) {
    const grid = document.getElementById('dossierGrid');
    if(!grid) return;

    let html = "";
    
    // KINKS
    if(u.kinks) {
        html += `<div style="margin-bottom:10px;"><div style="color:var(--blue); font-size:0.6rem;">KINKS</div>`;
        html += `<div style="color:#ccc; font-size:0.8rem;">${u.kinks}</div></div>`;
    }

    // LIMITS (Red)
    if(u.limits) {
        html += `<div><div style="color:var(--red); font-size:0.6rem;">HARD LIMITS</div>`;
        html += `<div style="color:#ccc; font-size:0.8rem;">${u.limits}</div></div>`;
    }

    if(html === "") html = '<div style="color:#444; font-size:0.7rem;">FILE EMPTY</div>';
    grid.innerHTML = html;
}

function updateInventory(u) {
    const grid = document.getElementById('inventoryGrid');
    if(!grid) return;

    // This requires u.purchasedItems array from backend
    const items = u.purchasedItems || [];
    
    if(items.length === 0) {
        grid.innerHTML = '<div style="color:#444; font-size:0.7rem;">NO TRIBUTES</div>';
        return;
    }

    grid.innerHTML = items.map(item => `
        <div style="background:#111; border:1px solid #333; padding:5px; text-align:center;">
            <div style="font-size:0.7rem; color:var(--gold);">${item.name}</div>
            <div style="font-size:0.6rem; color:#666;">${item.price}</div>
        </div>
    `).join('');
}


// =========================================
// TAB 3: RECORD (HISTORY & GLORY)
// =========================================

function updateAltar(u) {
    // Altar Images (Top 3 Highest Rated)
    const slots = [1, 2, 3];
    slots.forEach(i => {
        const el = document.getElementById('adminAltar' + i);
        if(!el) return;
        
        // Mock logic: Try to find image tagged as "altar1", "altar2", etc.
        // Or just take top 3 history items for now
        const img = u.history?.[i-1]?.proofUrl; 
        
        if (img) {
            el.style.backgroundImage = `url(${getOptimizedUrl(img, 100)})`;
            el.innerText = "";
        } else {
            el.style.backgroundImage = "none";
            el.innerText = "EMPTY";
        }
    });
}

function updateTrophies(u) {
    const container = document.getElementById('userStickerCase');
    if(!container) return;

    // Reuse the logic from the Mobile App (Hexagons/Diamonds)
    // For now, we will just list the Ranks they have passed
    const currentRank = u.hierarchy || "Hall Boy";
    const rankList = ["Hall Boy", "Footman", "Silverman", "Butler", "Chamberlain", "Secretary", "Champion"];
    const myIndex = rankList.indexOf(currentRank);

    let html = "";
    rankList.forEach((r, idx) => {
        const active = idx <= myIndex;
        const color = active ? "var(--gold)" : "#333";
        html += `<div style="border:1px solid ${color}; width:30px; height:30px; display:flex; align-items:center; justify-content:center; font-size:0.6rem; color:${color}; margin-right:5px; border-radius:4px;" title="${r}">
            ${idx+1}
        </div>`;
    });
    
    container.innerHTML = `<div style="display:flex;">${html}</div>`;
}

async function updateHistory(u) {
    const currentJson = JSON.stringify(u.history || []);
    if (currentJson !== lastHistoryJson || histLimit > 10) {
        setLastHistoryJson(currentJson);
        const hGrid = document.getElementById('userHistoryGrid');
        if (!hGrid) return;

        const cleanHist = (u.history || []).filter(h => h.status && h.status !== 'fail');
        let historyToShow = cleanHist.slice(0, histLimit);
        
        const loadBtn = document.getElementById('loadMoreHist');
        if (loadBtn) loadBtn.style.display = (cleanHist.length > histLimit) ? 'block' : 'none';

        // Sign URLs
        const signingPromises = historyToShow.map(async h => {
            h.thumbSigned = await getSignedUrl(getOptimizedUrl(h.proofUrl, 150));
        });
        await Promise.all(signingPromises);

        hGrid.innerHTML = historyToShow.length > 0 ? historyToShow.map(h => {
            const cls = h.status === 'approve' ? 'hb-app' : 'hb-rej';
            return `<div class="h-card-mini" onclick='openModal(null, null, "${h.proofUrl}", "${h.proofType||'text'}", "${raw(h.text)}", true, "${h.status}")'>
                <img src="${h.thumbSigned}" class="hc-img"><div class="h-badge ${cls}">${h.status.toUpperCase()}</div></div>`;
        }).join('') : '<div style="color:#444; font-size:0.7rem;">No history.</div>';
    }
}


// --- UTILS ---
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

export function modPoints(amount) {
    if (!currId) return;
    window.parent.postMessage({ type: "adjustPoints", memberId: currId, amount: amount }, "*");
}

export function loadMoreHist() { setHistLimit(histLimit + 10); const u = users.find(x => x.memberId === currId); if (u) updateDetail(u); }

export function openQueueTask(memberId, index) { /* (Preserve from old file if needed, usually redundant now) */ }

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
    const input = document.getElementById('qInput');
    const txt = input?.value.trim();
    if (!txt || !currId) return;
    const u = users.find(x => x.memberId === currId);
    if (u) {
        if (!u.taskQueue) u.taskQueue = [];
        u.taskQueue.push(txt);
        fillerUserId = null;
        window.parent.postMessage({ type: "updateTaskQueue", memberId: currId, queue: u.taskQueue }, "*");
        Bridge.send("updateTaskQueue", { memberId: currId, queue: u.taskQueue });
        input.value = '';
        updateDetail(u);
    }
}
