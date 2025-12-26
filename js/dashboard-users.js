// Dashboard User Management
// User detail display, task queue management, and user interactions

import { 
    users, currId, cooldownInterval, histLimit, lastHistoryJson, stickerConfig,
    availableDailyTasks, 
    setCooldownInterval, setHistLimit, setLastHistoryJson 
} from './dashboard-state.js';
import { getOptimizedUrl, clean, raw, formatTimer } from './dashboard-utils.js';
import { Bridge } from './bridge.js';

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
window.toggleMainTaskExpansion = toggleMainTaskExpansion; // NEW

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
    
    const joined = u.joinedDate ? new Date(u.joinedDate).toLocaleDateString() : "N/A";
    const joinedEl = document.getElementById('dJoined');
    if (joinedEl) joinedEl.innerText = `SLAVE SINCE: ${joined}`;
    
    // 4. Trigger sub-renders
    updatePointsGrid();
    updateStickerCase(u);
    updateReviewQueue(u);
    updateActiveTask(u);
    updateTaskQueue(u); // Refreshes every 4s
    updateHistory(u);
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
                <span>+${s.val}</span></div>`;
    });
    ptsGrid.innerHTML = html;
}

function updateStickerCase(u) {
    const container = document.getElementById('userStickerCase');
    if (container) {
        if (u.stickers && u.stickers.length > 0) {
            container.innerHTML = u.stickers.map(url => `<div class="my-sticker"><img src="${getOptimizedUrl(url, 50)}"></div>`).join('');
            container.style.display = 'flex';
        } else { container.style.display = 'none'; }
    }
}

function updateReviewQueue(u) {
    const qSec = document.getElementById('userQueueSec');
    if (!qSec) return;
    if (u.reviewQueue && u.reviewQueue.length > 0) {
        qSec.style.display = 'flex';
        qSec.innerHTML = `<div class="sec-title" style="color:var(--red);">PENDING REVIEW</div>` + 
            u.reviewQueue.map(t => `<div class="pend-card" onclick="openModById('${t.id}', '${t.memberId}', false)">
                    <img src="${getOptimizedUrl(t.proofUrl, 150)}" class="pend-thumb">
                    <div class="pend-info"><div class="pend-act">PENDING</div><div class="pend-txt">${clean(t.text)}</div></div>
                </div>`).join('');
    } else { qSec.style.display = 'none'; }
}

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
        document.getElementById('dActiveText').innerText = "No Active Task";
        document.getElementById('dActiveTimer').innerText = "--:--";
    }
}

// --- UPDATED RENDERER (STEP 2 INTEGRATED) ---
export function updateTaskQueue(u) {
    const listContainer = document.getElementById('qListContainer');
    if (!listContainer) return;

    let personalTasks = u.taskQueue || [];
    // ... (Keep your stability cache logic here) ...
    const displayTasks = [...personalTasks, ...cachedFillers.slice(0, Math.max(0, 10 - personalTasks.length))];

    listContainer.innerHTML = displayTasks.map((t, idx) => {
        const isPersonal = idx < personalTasks.length;
        const niceText = clean(t);
        const isExpanded = mainDashboardExpandedTasks.has(niceText); // From Step 2 memory

        return `
            <div class="q-item-line ${isPersonal ? 'direct-order' : 'filler-task'} ${isExpanded ? 'is-expanded' : ''}">
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

function updateHistory(u) {
    const currentJson = JSON.stringify(u.history || []);
    if (currentJson !== lastHistoryJson || histLimit > 10) {
        setLastHistoryJson(currentJson);
        const hGrid = document.getElementById('userHistoryGrid');
        if (!hGrid) return;
        const cleanHist = (u.history || []).filter(h => h.status !== 'fail' && (!h.text || !h.text.toUpperCase().includes('SKIPPED')));
        let historyToShow = cleanHist.slice(0, histLimit);
        const loadBtn = document.getElementById('loadMoreHist');
        if (loadBtn) loadBtn.style.display = (cleanHist.length > histLimit) ? 'block' : 'none';
        
        hGrid.innerHTML = historyToShow.length > 0 ? historyToShow.map(h => {
            const cls = h.status === 'approve' ? 'hb-app' : 'hb-rej';
            return `<div class="h-card-mini" onclick='openModal(null, null, "${h.proofUrl||''}", "${h.proofType||'text'}", "${raw(h.text)}", true, "${h.status}")'>
                <img src="${getOptimizedUrl(h.proofUrl,150)}" class="hc-img"><div class="h-badge ${cls}">${h.status.toUpperCase()}</div></div>`;
        }).join('') : '<div style="color:#444; font-size:0.7rem;">No history.</div>';
    }
}

export function modPoints(amount) {
    if (!currId) return;
    window.parent.postMessage({ type: "adjustPoints", memberId: currId, amount: amount }, "*");
}

export function loadMoreHist() { setHistLimit(histLimit + 10); const u = users.find(x => x.memberId === currId); if (u) updateDetail(u); }

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
