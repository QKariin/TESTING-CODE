// Dashboard User Management
// User detail display, task queue management, and user interactions

import { 
    users, currId, cooldownInterval, histLimit, lastHistoryJson, stickerConfig,
    setCooldownInterval, setHistLimit, setLastHistoryJson 
} from './dashboard-state.js';
import { getOptimizedUrl, clean, raw, formatTimer } from './dashboard-utils.js';

export function updateDetail(u) {
    if (!u) return;
    
    // Update online status
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
    
    // Update application button
    const appBtn = document.getElementById('btnAppView');
    if (appBtn) {
        if (u.application) { 
            appBtn.style.display = 'block'; 
        } else { 
            appBtn.style.display = 'none'; 
        }
    }
    
    // Update basic info
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
    
    // Update points grid
    updatePointsGrid();
    
    // Update sticker case
    updateStickerCase(u);
    
    // Update review queue
    updateReviewQueue(u);
    
    // Update active task
    updateActiveTask(u);
    
    // Update task queue
    updateTaskQueue(u);
    
    // Update history
    updateHistory(u);
}

function updatePointsGrid() {
    const ptsGrid = document.getElementById('pointsGrid');
    if (!ptsGrid) return;
    
    let html = `
        <button class="q-btn q-minus" onclick="modPoints(-10)">-10</button>
        <button class="q-btn q-minus" onclick="modPoints(-50)">-50</button>
    `;
    
    const source = (stickerConfig.length > 0) ? stickerConfig : [
        { val: 10, url: '' }, 
        { val: 20, url: '' }
    ];
    
    source.forEach(s => {
        html += `
            <div class="q-btn-img" onclick="modPoints(${s.val})">
                ${s.url ? 
                    `<img src="${getOptimizedUrl(s.url, 50)}">` : 
                    `<svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:#444;"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`
                }
                <span>+${s.val}</span>
            </div>
        `;
    });
    
    ptsGrid.innerHTML = html;
}

function updateStickerCase(u) {
    const stickerContainer = document.getElementById('userStickerCase');
    if (!stickerContainer) return;
    
    if (u.stickers && u.stickers.length > 0) {
        stickerContainer.innerHTML = u.stickers.map(url => 
            `<div class="my-sticker" title="Awarded"><img src="${getOptimizedUrl(url, 50)}"></div>`
        ).join('');
        stickerContainer.style.display = 'flex';
    } else {
        stickerContainer.style.display = 'none';
    }
}

function updateReviewQueue(u) {
    const qSec = document.getElementById('userQueueSec');
    if (!qSec) return;
    
    if (u.reviewQueue && u.reviewQueue.length > 0) {
        qSec.style.display = 'flex';
        qSec.innerHTML = `
            <div class="sec-title" style="color:var(--red);">PENDING REVIEW</div>
            ${u.reviewQueue.map(t => `
                <div class="pend-card" onclick="openModById('${t.id}', '${t.memberId}', false)">
                    <img src="${getOptimizedUrl(t.proofUrl, 150)}" class="pend-thumb">
                    <div class="pend-info">
                        <div class="pend-act">PENDING REVIEW</div>
                        <div class="pend-txt">${clean(t.text)}</div>
                    </div>
                </div>
            `).join('')}
        `;
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
                setCooldownInterval(null);
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

function updateTaskQueue(u) {
    const qList = u.taskQueue || [];
    const listContainer = document.getElementById('qListContainer');
    if (!listContainer) return;
    
    if (qList.length === 0) {
        listContainer.innerHTML = `<div style="text-align:center;color:#666;font-size:0.7rem;">Empty</div>`;
    } else {
        listContainer.innerHTML = qList.slice(0, 10).map((t, idx) => `
            <div class="q-item-line" draggable="true" 
                 ondragstart="handleDragStart(event, ${idx})" 
                 ondragover="handleDragOver(event)" 
                 ondrop="handleDrop(event, ${idx})" 
                 ondragend="handleDragEnd(event)" 
                 onclick="openQueueTask('${u.memberId}', ${idx})">
                <span class="q-handle" onmousedown="event.stopPropagation()">≡</span>
                <span class="q-idx">${idx + 1}.</span>
                <span class="q-txt-line">${clean(t)}</span>
                <span class="q-del" onclick="event.stopPropagation(); deleteQueueItem('${u.memberId}', ${idx})">&times;</span>
            </div>
        `).join('');
    }
}

function updateHistory(u) {
    const currentJson = JSON.stringify(u.history || []);
    if (currentJson !== lastHistoryJson || histLimit > 10) {
        setLastHistoryJson(currentJson);
        
        const hGrid = document.getElementById('userHistoryGrid');
        if (!hGrid) return;
        
        const cleanHist = (u.history || []).filter(h => 
            h.status !== 'fail' && (!h.text || !h.text.toUpperCase().includes('SKIPPED'))
        );
        
        let historyToShow = cleanHist.slice(0, histLimit);
        
        const loadMoreBtn = document.getElementById('loadMoreHist');
        if (loadMoreBtn) {
            loadMoreBtn.style.display = (cleanHist.length > histLimit) ? 'block' : 'none';
        }
        
        if (historyToShow.length > 0) {
            hGrid.innerHTML = historyToShow.map(h => {
                const cls = h.status === 'approve' ? 'hb-app' : 'hb-rej';
                const statusTxt = h.status === 'approve' ? 'APPROVED' : 'REJECTED';
                const thumb = h.proofUrl ? getOptimizedUrl(h.proofUrl, 150) : '';
                const isVid = h.proofType === 'video' || (h.proofUrl && h.proofUrl.endsWith('.mp4'));
                
                return `
                    <div class="h-card-mini" onclick='openMod(null, null, "${h.proofUrl||''}", "${h.proofType||'text'}", "${raw(h.text)}", true, "${h.status}")'>
                        ${thumb ? 
                            (isVid ? 
                                `<video src="${h.proofUrl}" class="hc-img" muted></video>` : 
                                `<img src="${thumb}" class="hc-img">`
                            ) : 
                            `<div style="width:100%;height:100%;background:#222;display:flex;align-items:center;justify-content:center;color:#666;font-size:0.5rem;">TEXT</div>`
                        }
                        <div class="h-badge ${cls}">${statusTxt}</div>
                    </div>
                `;
            }).join('');
        } else {
            hGrid.innerHTML = '<div style="color:#444; font-size:0.8rem; grid-column:1/-1;">No history yet.</div>';
        }
    }
}

export function modPoints(amount) {
    if (!currId) return;
    
    window.parent.postMessage({ 
        type: "adjustPoints", 
        memberId: currId, 
        amount: amount 
    }, "*");
}

export function loadMoreHist() {
    setHistLimit(histLimit + 10);
    const u = users.find(x => x.memberId === currId);
    if (u) updateDetail(u);
}

export function openQueueTask(memberId, index) {
    const u = users.find(x => x.memberId === memberId);
    if (u && u.taskQueue && u.taskQueue[index]) {
        const task = u.taskQueue[index];
        import('./dashboard-modals.js').then(({ openModal }) => {
            openModal(null, null, '', 'text', task, true, 'QUEUE_TASK');
        });
    }
}

export function deleteQueueItem(memberId, index) {
    const u = users.find(x => x.memberId === memberId);
    if (u && u.taskQueue) {
        u.taskQueue.splice(index, 1);
        window.parent.postMessage({ 
            type: "updateTaskQueue", 
            memberId: memberId, 
            queue: u.taskQueue 
        }, "*");
        updateDetail(u);
    }
}

export function addQueueTask() {
    const input = document.getElementById('qInput');
    if (!input || !currId) return;
    
    const taskText = input.value.trim();
    if (!taskText) return;
    
    const u = users.find(x => x.memberId === currId);
    if (u) {
        if (!u.taskQueue) u.taskQueue = [];
        u.taskQueue.push(taskText);
        
        window.parent.postMessage({ 
            type: "updateTaskQueue", 
            memberId: currId, 
            queue: u.taskQueue 
        }, "*");
        
        input.value = '';
        updateDetail(u);
    }
}

// Make functions available globally
window.modPoints = modPoints;
window.loadMoreHist = loadMoreHist;
window.openQueueTask = openQueueTask;
window.deleteQueueItem = deleteQueueItem;
window.addQueueTask = addQueueTask;
