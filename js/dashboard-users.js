// js/dashboard-users.js - USER DATA CONTROLLER

import { 
    users, currId, cooldownInterval, histLimit, lastHistoryJson, stickerConfig,
    availableDailyTasks, 
    setCooldownInterval, setHistLimit, setLastHistoryJson, setArmoryTarget
} from './dashboard-state.js';
import { clean, raw, formatTimer } from './dashboard-utils.js';
import { Bridge } from './bridge.js';
import { getOptimizedUrl, getSignedUrl } from './media.js';

// --- STABILITY CACHE ---
// Prevents flickering of "System Tasks" when refreshing
let cachedFillers = [];
let fillerUserId = null;
const mainDashboardExpandedTasks = new Set();

// =========================================
// MAIN UPDATE FUNCTION (Populates All Tabs)
// =========================================
export function updateDetail(u) {
    if (!u) return;
    
    // --- 1. VITALS DECK (Top Header) ---
    const now = Date.now();
    const ls = u.lastSeen ? new Date(u.lastSeen).getTime() : 0;
    let diff = Math.floor((now - ls) / 60000);
    let status = (ls > 0 && diff < 2) ? "ONLINE" : (ls > 0 ? diff + " MIN AGO" : "OFFLINE");
    
    const lsEl = document.getElementById('lastSeen');
    if (lsEl) {
        lsEl.innerText = status;
        lsEl.className = (status === "ONLINE") ? "uh-seen online" : "uh-seen";
    }
    
    // Basic Info
    setText('dName', u.name);
    setText('dRank', u.hierarchy || "SLAVE");
    setText('dWalletVal', u.coins || 0);
    
    // Stats Bar
    setText('dStrikes', u.strikeCount || 0);
    setText('dTasks', u.completed || 0);
    setText('dStreak', u.streak || 0);
    setText('dPoints', u.points || 0);

    // --- 2. TAB: OPS (Operations) ---
    updateActiveTask(u);
    updateTaskQueue(u);
    updateDailyProtocol(u); 

    // --- 3. TAB: INTEL (Data) ---
    updateTelemetry(u);
    updateDossier(u);
    updateInventory(u);

    // --- 4. TAB: RECORD (History) ---
    updateAltar(u);
    updateTrophies(u);
    updateHistory(u);
}

// Helper to safely set text
function setText(id, txt) {
    const el = document.getElementById(id);
    if(el) el.innerText = txt;
}

// =========================================
// TAB 1: OPS (OPERATIONS)
// =========================================
function updateActiveTask(u) {
    if (cooldownInterval) clearInterval(cooldownInterval);
    const activeText = document.getElementById('dActiveText');
    const activeTimer = document.getElementById('dActiveTimer');

    if (!activeText) return;

    if (u.activeTask && u.endTime && u.endTime > Date.now()) {
        activeText.innerText = clean(u.activeTask.text);
        
        const tick = () => {
            const diff = u.endTime - Date.now();
            if (diff <= 0) { 
                activeTimer.innerText = "00:00"; 
                clearInterval(cooldownInterval); 
                return; 
            }
            activeTimer.innerText = formatTimer(diff);
        };
        tick();
        const interval = setInterval(tick, 1000);
        setCooldownInterval(interval);
    } else {
        activeText.innerText = "IDLE";
        activeTimer.innerText = "--:--";
    }
}

function updateTaskQueue(u) {
    const listContainer = document.getElementById('qListContainer');
    if (!listContainer) return;

    let personalTasks = u.taskQueue || [];
    
    // Filler Logic (Random tasks to make it look busy if empty)
    if (fillerUserId !== u.memberId || cachedFillers.length === 0) {
        cachedFillers = (availableDailyTasks || []).sort(() => 0.5 - Math.random()).slice(0, 10);
        fillerUserId = u.memberId;
    }
    
    const displayTasks = [...personalTasks, ...cachedFillers.slice(0, Math.max(0, 10 - personalTasks.length))];

    listContainer.innerHTML = displayTasks.map((t, idx) => {
        const isPersonal = idx < personalTasks.length;
        const niceText = clean(t);
        const isExpanded = mainDashboardExpandedTasks.has(niceText);

        return `
            <div class="mini-active" style="border:1px solid ${isPersonal ? '#333' : '#222'}; opacity:${isPersonal ? 1 : 0.5}; margin-bottom:5px;">
                <div class="ma-status" style="color:${isPersonal ? 'var(--gold)' : '#555'}">${isPersonal ? 'CMD' : 'AUTO'}</div>
                <div class="ma-mid">
                    <div class="ma-txt" style="white-space:normal; cursor:pointer;" onclick="toggleMainTaskExpansion(this, '${raw(niceText)}')">${niceText}</div>
                </div>
                ${isPersonal ? `<button class="ma-btn" onclick="deleteQueueItem('${u.memberId}', ${idx})" style="color:red;">&times;</button>` : ''}
            </div>`;
    }).join('');
}

function updateDailyProtocol(u) {
    const container = document.getElementById('userRoutineList');
    if(!container) return;

    if (!u.routine) {
        container.innerHTML = '<div style="color:#666; font-size:0.7rem; text-align:center; padding:10px;">NO ROUTINE ASSIGNED</div>';
        return;
    }

    const isDone = u.routineDoneToday === true;
    const color = isDone ? 'var(--green)' : '#666';
    const icon = isDone ? 'COMPLETED' : 'PENDING';

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; background:#111; padding:10px; border:1px solid #333; border-left:3px solid ${color};">
            <div style="font-family:'Cinzel'; color:#fff; font-size:0.9rem;">${u.routine.toUpperCase()}</div>
            <div style="color:${color}; font-weight:bold; font-size:0.7rem; font-family:'Orbitron';">${icon}</div>
        </div>
    `;
}

// =========================================
// TAB 2: INTEL (DATA)
// =========================================
function updateTelemetry(u) {
    const total = u.kneelCount || 0; 
    const hours = (total * 0.25).toFixed(1); // Assuming 15m per kneel
    
    setText('dTotalKneel', `${hours} HRS`);
    // Need kneelHistory array from Velo to do this properly, defaulting for now
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

    // Handle string or array parsing for purchased items
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

// =========================================
// TAB 3: RECORD (HISTORY & GLORY)
// =========================================
function updateAltar(u) {
    // This connects to the HTML slots we made
    // Future expansion: Make these droppable targets
}

function updateTrophies(u) {
    const container = document.getElementById('userStickerCase');
    if(!container) return;

    // Ranks Visualizer
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

async function updateHistory(u) {
    const currentJson = JSON.stringify(u.history || []);
    if (currentJson !== lastHistoryJson || histLimit > 10) {
        setLastHistoryJson(currentJson);
        const hGrid = document.getElementById('userHistoryGrid');
        if (!hGrid) return;

        const cleanHist = (u.history || []).filter(h => h.status && h.status !== 'fail');
        const historyToShow = cleanHist.slice(0, histLimit);
        
        // Show/Hide Load More
        const loadBtn = document.getElementById('loadMoreHist');
        if (loadBtn) loadBtn.style.display = (cleanHist.length > histLimit) ? 'block' : 'none';

        // Sign URLs
        const signingPromises = historyToShow.map(async h => {
            if(h.proofUrl && h.proofUrl.startsWith('https://upcdn')) h.thumbSigned = await getSignedUrl(getOptimizedUrl(h.proofUrl, 150));
            else h.thumbSigned = getOptimizedUrl(h.proofUrl, 150);
        });
        await Promise.all(signingPromises);

        hGrid.innerHTML = historyToShow.length > 0 ? historyToShow.map(h => {
            const cls = h.status === 'approve' ? 'hb-app' : 'hb-rej';
            const img = h.thumbSigned || '';
            // Only show if image exists
            if(!img) return '';
            return `<div class="h-card-mini" style="position:relative; width:100%; aspect-ratio:1/1; background:black; border:1px solid #333; cursor:pointer;" 
                     onclick='openModal(null, null, "${h.proofUrl}", "${h.proofType||'text'}", "${raw(h.text)}", true, "${h.status}")'>
                <img src="${img}" style="width:100%; height:100%; object-fit:cover; opacity:0.7;">
                <div class="h-badge ${cls}" style="position:absolute; bottom:0; left:0; width:100%; font-size:0.5rem; text-align:center;">${h.status.toUpperCase()}</div>
            </div>`;
        }).join('') : '<div style="color:#444; font-size:0.7rem; padding:10px;">No history records.</div>';
    }
}

// =========================================
// ACTION FUNCTIONS (EXPOSED TO WINDOW)
// =========================================
export function addQueueTask() {
    // 1. Target the input inside OPS tab
    const input = document.querySelector('#tabOps #qInput') || document.getElementById('qInput');
    
    if (!input) return console.error("Input #qInput not found!");
    
    if (!currId) {
        alert("Select a Slave first.");
        return;
    }

    const txt = input.value.trim();

    // 2. SMART GATEWAY LOGIC
    if (!txt) {
        // SCENARIO A: Input is Empty -> OPEN DATABASE (Armory)
        console.log("Input empty. Opening Task Gallery for QUEUE...");
        
        // Tell the system: "Whatever I click next goes to the QUEUE"
        setArmoryTarget('queue'); 
        
        // Open the Modal
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
        
        // Add to local
        u.taskQueue.push(txt);
        
        // Send to Backend
        window.parent.postMessage({ type: "updateTaskQueue", memberId: currId, queue: u.taskQueue }, "*");
        
        // Instant Bridge
        if(window.Bridge) {
            window.Bridge.send("updateTaskQueue", { memberId: currId, queue: u.taskQueue });
        }

        // Cleanup
        input.value = '';
        updateDetail(u); 
    }
}
export function deleteQueueItem(memberId, index) {
    const u = users.find(x => x.memberId === memberId);
    if (u?.taskQueue) {
        u.taskQueue.splice(index, 1);
        window.parent.postMessage({ type: "updateTaskQueue", memberId: memberId, queue: u.taskQueue }, "*");
        Bridge.send("updateTaskQueue", { memberId: memberId, queue: u.taskQueue });
        updateDetail(u);
    }
}

export function toggleMainTaskExpansion(btn, taskText) {
    const card = btn.closest('.mini-active'); // Adjust to match your HTML
    // Logic to expand text if needed, for now just placeholder
}

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
         // Assuming you have an openModal import or global availability
         // window.openModal(...) 
    }
}

// --- CRITICAL: BIND TO WINDOW SCOPE ---
window.updateDetail = updateDetail;
window.addQueueTask = addQueueTask;
window.deleteQueueItem = deleteQueueItem;
window.modPoints = modPoints;
window.loadMoreHist = loadMoreHist;
window.openQueueTask = openQueueTask;
window.toggleMainTaskExpansion = toggleMainTaskExpansion;
