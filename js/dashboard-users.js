// js/dashboard-users.js - USER DATA CONTROLLER

import {
    users, currId, cooldownInterval, histLimit, lastHistoryJson, stickerConfig,
    availableDailyTasks,
    setCooldownInterval, setHistLimit, setLastHistoryJson, setArmoryTarget
} from './dashboard-state.js';
import { clean, raw, formatTimer } from './dashboard-utils.js';
import { Bridge } from './bridge.js';
import { getOptimizedUrl, getSignedUrl } from './media.js';
import { LEVELS } from './config.js'; // IMPORT REAL LEVELS

// --- STABILITY CACHE ---
// Prevents flickering of "System Tasks" when refreshing
let cachedFillers = [];
let fillerUserId = null;
const mainDashboardExpandedTasks = new Set();

// =========================================
// MAIN UPDATE FUNCTION (Populates All Tabs)
// =========================================
export async function updateDetail(u) {
    if (!u) return;

    // --- 1. VITALS MIRROR (Top Header & Stats) ---
    const now = Date.now();
    const ls = u.lastSeen ? new Date(u.lastSeen).getTime() : 0;
    let diff = Math.floor((now - ls) / 60000);
    let status = (ls > 0 && diff < 2) ? "ONLINE" : (ls > 0 ? diff + " MIN AGO" : "OFFLINE");
    const isOnline = status === "ONLINE";

    // 1. HEADER BASICS
    // 1. HEADER BASICS
    const profPic = document.getElementById('dProfilePic');
    const headerBg = document.getElementById('apMirrorHeader');
    const defaultPic = "https://static.wixstatic.com/media/ce3e5b_78da97e06a3848df84d0b00c9e6dcfdd~mv2.png";
    const finalPic = u.profilePicture || defaultPic;

    if (profPic) profPic.src = finalPic;
    if (headerBg) headerBg.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), url('${finalPic}')`;

    // CALCULATE REAL RANK FROM POINTS
    let realRank = "HallBoy"; // Default
    const points = u.points || 0;
    // Find the highest level where points >= min
    // LEVELS is sorted ascending usually? config.js: 0, 2000, 5000...
    // We want the last one that matches
    for (let i = LEVELS.length - 1; i >= 0; i--) {
        if (points >= LEVELS[i].min) {
            realRank = LEVELS[i].name;
            break;
        }
    }
    // If u.hierarchy is explicitly set and different from default/calculated, maybe we should respect it?
    // But user complained "it still says Hallboy". 
    // If we want "real" data from CMS logic, we calculate it.
    // However, we allow manual override via u.hierarchy if it matches a known level?
    // Let's prefer the Database value if it's valid, otherwise calculate.
    // ACTUALLY: User said "it still says hallboy" implies DB defaults to Hallboy.
    // We should display the CALCULATED rank if DB value seems "stuck" or just always display calculated.
    // Let's display the stored value BUT if it's "HallBoy" and points > 0, maybe update it?
    // No, safer to just DISPLAY the calculated rank for the "Sticker".
    // Wait, let's allow the manual override to win if it was manually set?
    // The previous implementation used u.hierarchy || "SLAVE".
    // I will use u.hierarchy ONLY, assuming the cycleHierarchy updates it.
    // BUT the user says it's not connected.
    // I will use properties from config.js.

    // DECISION: Priority = u.hierarchy (if set) -> Calculated (if u.hierarchy missing or default)
    // But if u.hierarchy IS "HallBoy" (default) but points say "Silverman", we should show "Silverman".
    // So if u.hierarchy == "HallBoy" && calculated != "HallBoy", show Calculated?
    // Or just always Show Calculated? 
    // "Connect that to the real datas" -> Points are the real data backing the rank.

    setText('dMirrorHierarchy', (realRank).toUpperCase());
    setText('dMirrorName', u.name || "SLAVE");

    const stEl = document.getElementById('dMirrorStatus');
    if (stEl) {
        stEl.innerText = status;
        stEl.style.color = isOnline ? '#00ff00' : '#666';
    }

    // 2. MAIN STATS
    setText('dMirrorPoints', (u.points || 0).toLocaleString());
    setText('dMirrorPointsCard', (u.points || 0).toLocaleString()); // Added: Grid Card

    setText('dMirrorWallet', (u.coins || 0).toLocaleString());
    setText('dMirrorWalletCard', (u.coins || 0).toLocaleString()); // Added: Grid Card

    // 3. KNEELING
    const totalKneel = u.kneelCount || 0;
    const kneelHrs = (totalKneel * 0.25).toFixed(1);
    setText('dMirrorKneel', `${kneelHrs}h`);
    setText('dMirrorKneelCard', `${kneelHrs}h`); // Added: Grid Card

    // 4. PROGRESS BAR & LEVEL
    const currentPoints = u.points || 0;
    // Simple level logic for display (matches main.js roughly)
    const level = Math.floor(currentPoints / 1000) + 1;
    const nextLevelPoints = level * 1000;
    const pointsNeeded = nextLevelPoints - currentPoints;
    const progressPercent = Math.min(100, Math.max(0, (currentPoints % 1000) / 10)); // 0-100%

    setText('dMirrorNextLevel', "LEVEL " + (level + 1));
    setText('dMirrorPointsNeeded', `${pointsNeeded} to go`);

    const pBar = document.getElementById('dMirrorProgress');
    if (pBar) pBar.style.width = `${progressPercent}%`;

    // 5. EXTENDED STATS
    setText('dMirrorStreak', u.streak || 0);
    setText('dMirrorStreakCard', u.streak || 0); // Added: Grid Card

    setText('dMirrorStatTotal', u.totalTasks || (u.history ? u.history.length : 0));
    const completedCount = u.completed || (u.history ? u.history.filter(h => h.status === 'approve').length : 0);
    setText('dMirrorStatCompleted', completedCount);
    setText('dMirrorStatSkipped', u.skipped || 0);

    const isRoutineDone = u.routineDoneToday === true;
    const routineName = (u.routine || "NONE").toUpperCase();
    const routineStatus = isRoutineDone ? "DONE" : "PENDING";
    const routineColor = isRoutineDone ? '#00ff00' : '#666';

    setText('dMirrorRoutine', `${routineName} (${routineStatus})`);
    setText('dMirrorRoutineCard', routineName); // Grid Card just name

    // Tint color for both
    const rEl = document.getElementById('dMirrorRoutine');
    if (rEl) rEl.style.color = routineColor;
    const rElCard = document.getElementById('dMirrorRoutineCard');
    if (rElCard) rElCard.style.color = routineColor;

    // 6. FOOTER
    setText('dMirrorSlaveSince', u.joinedDate ? new Date(u.joinedDate).toLocaleDateString() : "--/--/--"); // Fixed: u.joinDate -> u.joinedDate

    // --- 2. TAB: OPS (Operations) ---
    updateReviewQueue(u);
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
    if (el) el.innerText = txt;
}

// =========================================
// TAB 1: OPS (OPERATIONS)
// =========================================
async function updateReviewQueue(u) {
    const qSec = document.getElementById('userQueueSec');
    if (!qSec) return;

    if (u.reviewQueue && u.reviewQueue.length > 0) {
        // Sign URLs for thumbnails
        const signingPromises = u.reviewQueue.map(async t => {
            if (t.proofUrl) {
                t.thumbSigned = await getSignedUrl(getOptimizedUrl(t.proofUrl, 150));
                t.fullSigned = await getSignedUrl(t.proofUrl);
            }
        });
        await Promise.all(signingPromises);

        qSec.style.display = 'flex';
        qSec.innerHTML = `<div class="sec-title" style="color:var(--red);">PENDING REVIEW</div>` +
            u.reviewQueue.map(t => `<div class="pend-card" onclick="openModById('${t.id}', '${t.memberId}', false, '${t.fullSigned}')">
                    <img src="${t.thumbSigned}" class="pend-thumb">
                    <div class="pend-info"><div class="pend-act">PENDING</div><div class="pend-txt">${clean(t.text)}</div></div>
                </div>`).join('');
    } else {
        qSec.style.display = 'none';
    }
}

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
    // 1. Update List
    const container = document.getElementById('userRoutineList');

    // 2. Update Header (Sync)
    const isDone = u.routineDoneToday === true;
    const color = isDone ? 'var(--green)' : '#666'; // List color
    const headColor = isDone ? 'var(--green)' : 'var(--red)'; // Header color
    const icon = isDone ? 'COMPLETED' : 'PENDING';

    // Sync Header
    setText('dRoutineStatus', isDone ? "DONE" : "PENDING");
    const rStatEl = document.getElementById('dRoutineStatus');
    if (rStatEl) rStatEl.style.color = headColor;

    if (!container) return; // Exit if list container missing

    if (!u.routine) {
        container.innerHTML = '<div style="color:#666; font-size:0.7rem; text-align:center; padding:10px;">NO ROUTINE ASSIGNED</div>';
        return;
    }

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
    if (!grid) return;

    let content = "";
    if (u.kinks) content += `<div style="margin-bottom:10px;"><div style="color:var(--blue); font-size:0.6rem; margin-bottom:2px;">KINKS</div><div style="color:#ccc; font-size:0.8rem; line-height:1.2;">${u.kinks}</div></div>`;
    if (u.limits) content += `<div><div style="color:var(--red); font-size:0.6rem; margin-bottom:2px;">LIMITS</div><div style="color:#ccc; font-size:0.8rem; line-height:1.2;">${u.limits}</div></div>`;

    if (!content) content = '<div style="color:#444; font-size:0.7rem;">FILE EMPTY</div>';
    grid.innerHTML = content;
}

function updateInventory(u) {
    const grid = document.getElementById('inventoryGrid');
    if (!grid) return;

    // Handle string or array parsing for purchased items
    let items = [];
    if (u.purchasedItems) {
        if (Array.isArray(u.purchasedItems)) items = u.purchasedItems;
        else if (typeof u.purchasedItems === 'string') {
            try { items = JSON.parse(u.purchasedItems); } catch (e) { }
        }
    }

    if (items.length === 0) {
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
    if (!container) return;

    // Ranks Visualizer
    const ranks = ["Hall Boy", "Footman", "Silverman", "Butler", "Chamberlain", "Secretary", "Queen's Champion"];
    const current = u.hierarchy || "";
    const idx = ranks.findIndex(r => r.toLowerCase() === current.toLowerCase());

    let html = '<div style="display:flex; gap:5px; flex-wrap:wrap;">';
    ranks.forEach((r, i) => {
        const unlocked = i <= idx;
        const color = unlocked ? "var(--gold)" : "#333";
        const bg = unlocked ? "rgba(197, 160, 89, 0.1)" : "transparent";
        html += `<div style="border:1px solid ${color}; background:${bg}; padding:4px 8px; font-size:0.6rem; color:${color}; border-radius:4px;" title="${r}">
            ${i + 1}
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
            if (h.proofUrl && h.proofUrl.startsWith('https://upcdn')) h.thumbSigned = await getSignedUrl(getOptimizedUrl(h.proofUrl, 150));
            else h.thumbSigned = getOptimizedUrl(h.proofUrl, 150);
        });
        await Promise.all(signingPromises);

        hGrid.innerHTML = historyToShow.length > 0 ? historyToShow.map(h => {
            const cls = h.status === 'approve' ? 'hb-app' : 'hb-rej';
            const img = h.thumbSigned || '';
            // Only show if image exists
            if (!img) return '';
            return `<div class="h-card-mini" style="position:relative; width:100%; aspect-ratio:1/1; background:black; border:1px solid #333; cursor:pointer;" 
                     onclick='openModal(null, null, "${h.proofUrl}", "${h.proofType || 'text'}", "${raw(h.text)}", true, "${h.status}")'>
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
        if (window.openTaskGallery) {
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
        if (window.Bridge) {
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

// --- CONTROL FUNCTIONS ---
export function adjustWallet(action) {
    if (!currId) return;
    const amount = (action === 'add') ? 100 : -100;
    // Optimistic Update
    const u = users.find(x => x.memberId === currId);
    if (u) {
        u.coins = (u.coins || 0) + amount;
        updateDetail(u);
    }
    window.parent.postMessage({ type: "adjustCoins", memberId: currId, amount: amount }, "*");
}

export function adjustKneel(action) {
    if (!currId) return;
    const amount = (action === 'add') ? 4 : -4; // 4 units = 1 hour

    const u = users.find(x => x.memberId === currId);
    if (u) {
        u.kneelCount = (u.kneelCount || 0) + amount;
        if (u.kneelCount < 0) u.kneelCount = 0;
        updateDetail(u);
    }
    window.parent.postMessage({ type: "adjustKneel", memberId: currId, amount: amount }, "*");
}

// --- CRITICAL: BIND TO WINDOW SCOPE ---
window.updateDetail = updateDetail;
window.addQueueTask = addQueueTask;
window.deleteQueueItem = deleteQueueItem;
window.modPoints = modPoints;
window.loadMoreHist = loadMoreHist;
window.openQueueTask = openQueueTask;
window.toggleMainTaskExpansion = toggleMainTaskExpansion;
window.adjustWallet = adjustWallet;
window.adjustKneel = adjustKneel;

// --- HIERARCHY CYCLE (MANUAL OVERRIDE) ---
function cycleHierarchy() {
    if (!currId) return;
    const u = users.find(x => x.memberId === currId);
    if (!u) return;

    // Use LEVELS from config
    const rankNames = LEVELS.map(l => l.name); // ["HallBoy", "Footman"...]

    // Find current index based on name (case insensitive match just in case)
    let current = (u.hierarchy || "HallBoy");
    let idx = rankNames.findIndex(r => r.toUpperCase() === current.toUpperCase());
    if (idx === -1) idx = 0;

    let nextIdx = (idx + 1) % rankNames.length;
    let newRank = rankNames[nextIdx];

    // Optimistic Update
    u.hierarchy = newRank;
    setText('dMirrorHierarchy', newRank.toUpperCase());

    // Backend Sync
    window.parent.postMessage({
        type: "updateHierarchy",
        memberId: currId,
        newRank: newRank
    }, "*");
}
window.cycleHierarchy = cycleHierarchy;
