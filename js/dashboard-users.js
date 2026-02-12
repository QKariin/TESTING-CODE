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

const REWARD_DATA = {
    ranks: [
        {
            name: "HALL BOY", icon: "🧹", tax: 20,
            req: { tasks: 0, kneels: 0, points: 0, spent: 0, streak: 0 },
            benefits: ["Identity: You are granted a Name.", "Labor: Permission to begin Basic Tasks.", "Speak Cost: 20 Coins."]
        },
        {
            name: "FOOTMAN", icon: "👞", tax: 15,
            req: { tasks: 5, kneels: 10, points: 500, spent: 0, streak: 0, name: true, photo: true },
            benefits: ["Presence: Your Face may be revealed.", "Order: Access to the Daily Routine.", "Speak Cost: 15 Coins."]
        },
        {
            name: "SILVERMAN", icon: "🥈", tax: 10,
            req: { tasks: 25, kneels: 65, points: 2500, spent: 5000, streak: 5, limits: true, kinks: true },
            benefits: ["Chat Upgrade: Permission to send Photos.", "Devotion: Tasks tailored to your Desires.", "Booking: Permission to request Sessions.", "Speak Cost: 10 Coins."]
        },
        {
            name: "BUTLER", icon: "🤵", tax: 5,
            req: { tasks: 100, kneels: 250, points: 10000, spent: 10000, streak: 10 },
            benefits: ["Chat Upgrade: Permission to send Videos.", "Voice: Access to Audio Sessions.", "Speak Cost: 5 Coins."]
        },
        {
            name: "CHAMBERLAIN", icon: "🗝️", tax: 0,
            req: { tasks: 300, kneels: 750, points: 50000, spent: 50000, streak: 30 },
            benefits: ["Speech: All messaging is Free.", "Visuals: Access to Video Sessions.", "Honor: Access to Elite Trials."]
        },
        {
            name: "SECRETARY", icon: "💼", tax: 0,
            req: { tasks: 500, kneels: 1500, points: 100000, spent: 100000, streak: 100 },
            benefits: ["The Line: A direct Audio Connection.", "Authority: Access to System Commands.", "The Throne: Total, Unfiltered Access."]
        },
        {
            name: "QUEEN'S CHAMPION", icon: "👑", tax: 0,
            req: { tasks: 1000, kneels: 3000, points: 250000, spent: 1000000, streak: 365 },
            benefits: ["Absolute Authority.", "Manifest Will.", "Total Ownership."]
        }
    ]
};

// --- HELPER: ROUTINE STREAK CALL (6 AM RULE) ---
function calculateRoutineStreak(historyStr) {
    if (!historyStr) return 0;

    let photos = [];
    try {
        if (typeof historyStr === 'string') photos = JSON.parse(historyStr);
        else if (Array.isArray(historyStr)) photos = historyStr;
    } catch (e) { return 0; }

    if (!photos || photos.length === 0) return 0;

    // Sort Newest First
    photos.sort((a, b) => {
        const dateA = new Date(a.date || a._createdDate || a);
        const dateB = new Date(b.date || b._createdDate || b);
        return dateB - dateA;
    });

    const getDutyDay = (d) => {
        let date = new Date(d);
        if (date.getHours() < 6) date.setDate(date.getDate() - 1);
        return date.toISOString().split('T')[0];
    };

    let streak = 0;
    const todayCode = getDutyDay(new Date());
    const newestDate = photos[0].date || photos[0]._createdDate || photos[0];
    const lastCode = getDutyDay(newestDate);

    const d1 = new Date(todayCode);
    const d2 = new Date(lastCode);
    const diffDays = (d1 - d2) / (1000 * 60 * 60 * 24);

    if (diffDays <= 1) {
        streak = 1;
        let currentCode = lastCode;

        for (let i = 1; i < photos.length; i++) {
            const itemDate = photos[i].date || photos[i]._createdDate || photos[i];
            const nextCode = getDutyDay(itemDate);
            if (nextCode === currentCode) continue;

            const dayA = new Date(currentCode);
            const dayB = new Date(nextCode);
            const gap = (dayA - dayB) / (1000 * 60 * 60 * 24);

            if (gap === 1) {
                streak++;
                currentCode = nextCode;
            } else {
                break;
            }
        }
    }
    return streak;
}

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
    // FIX: 'avatar' is the property sent from Queendom, not 'profilePicture'
    const finalPic = u.avatar || u.profilePicture || defaultPic;

    if (profPic) profPic.src = finalPic;
    // Use 0.6 opacity to ensure image is visible but text is readable
    if (headerBg) headerBg.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url('${finalPic}')`;

    // STICT READ-ONLY MODE (CENTRALIZED LOGIC)
    // The "Slave Record" (main.js) calculates the rank and updates the CMS.
    // We just display what is in the database.
    let realRank = (u.hierarchy || "HALLBOY");
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

    setText('dMirrorWallet', (u.coins || 0).toLocaleString());

    // 3. KNEELING
    const totalKneel = u.kneelCount || 0;
    const kneelHrs = (totalKneel * 0.25).toFixed(1);
    setText('dMirrorKneel', `${kneelHrs}h`);

    // 4. HIERARCHY PROGRESS (FULL MIRROR)
    const ranks = REWARD_DATA.ranks;
    // Normalize string to match config (e.g. "Hall Boy" vs "HallBoy")
    const cleanName = (name) => (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const currentRaw = u.hierarchy || "Hall Boy";

    let currentIdx = ranks.findIndex(r => cleanName(r.name) === cleanName(currentRaw));
    if (currentIdx === -1) currentIdx = 0;

    const currentRankObj = ranks[currentIdx];
    const isMax = currentIdx >= ranks.length - 1;
    const nextRankObj = isMax ? currentRankObj : ranks[currentIdx + 1];

    // Update Text Headers
    setText('admin_CurrentRank', currentRankObj.name);
    const elAdminCurBen = document.getElementById('admin_CurrentBenefits');
    if (elAdminCurBen) {
        elAdminCurBen.innerHTML = currentRankObj.benefits.map(b => `<div style="margin-bottom:4px;">${b}</div>`).join('');
    }

    setText('admin_NextRank', isMax ? "MAXIMUM RANK" : nextRankObj.name);
    const elAdminNextBen = document.getElementById('admin_NextBenefits');
    if (elAdminNextBen) {
        if (isMax) {
            elAdminNextBen.innerHTML = "<li>You have reached the apex of servitude.</li>";
        } else {
            elAdminNextBen.innerHTML = nextRankObj.benefits.map(b => `<li>${b}</li>`).join('');
        }
    }

    // Calculate Stats
    // Note: completed count might need better sourcing if 'u.completed' is missing
    const completedCount = u.completed || (u.history ? u.history.filter(h => h.status === 'approve').length : 0);

    // Calculate Routine Streak (Client-Side to match User App)
    const calculatedStreak = calculateRoutineStreak(u.routineHistory);

    const stats = {
        tasks: completedCount,
        kneels: u.kneelCount || 0,
        points: u.points || 0,
        spent: u.totalSpent || 0, // Ensure this field exists in your user object or it will be 0
        streak: calculatedStreak || u.routinestreak || 0
    };

    // Build Progress Bars
    const req = nextRankObj.req;
    const container = document.getElementById('admin_ProgressContainer');

    if (container) {
        const buildBar = (label, current, target, icon) => {
            if (isMax) target = current;
            if (target <= 0) target = 1;

            const pct = Math.min((current / target) * 100, 100);
            const isDone = current >= target;
            const color = isDone ? "#00ff00" : "#c5a059";
            const labelColor = isDone ? "#fff" : "#888";
            const valColor = isDone ? "#00ff00" : "#c5a059";

            return `
            <div style="margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between; font-size:0.65rem; font-family:'Orbitron'; margin-bottom:4px; color:${labelColor};">
                    <span>${icon} ${label}</span>
                    <span style="color:${valColor}">${current.toLocaleString()} / ${target.toLocaleString()}</span>
                </div>
                <div style="width:100%; height:6px; background:#000; border:1px solid #333; border-radius:3px; overflow:hidden;">
                    <div style="width:${pct}%; height:100%; background:${color}; box-shadow:0 0 10px ${color}40; transition: width 0.5s ease;"></div>
                </div>
            </div>`;
        };

        const buildCheck = (label, isMet, iconSvg) => {
            const statusColor = isMet ? "#00ff00" : "#ff4444";
            const statusText = isMet ? "VERIFIED" : "MISSING";
            const iconColor = isMet ? "#00ff00" : "#888"; // Grey if missing, Green if done

            return `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; font-family:'Orbitron'; font-size:0.65rem; border-bottom:1px solid #222; padding-bottom:4px;">
                <div style="display:flex; align-items:center; color:${iconColor};">
                    <div style="width:16px; height:16px; fill:${iconColor}; margin-right:8px;">${iconSvg}</div>
                    <span>${label}</span>
                </div>
                <span style="color:${statusColor}; letter-spacing:1px;">${statusText} ${isMet ? '✅' : '❌'}</span>
            </div>`;
        };

        // SVGs
        const SVG_ID = '<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
        const SVG_PHOTO = '<svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';
        const SVG_LIMITS = '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
        const SVG_KINKS = '<svg viewBox="0 0 24 24"><path d="M10.59 13.41c.41.39.41 1.03 0 1.42-.39.41-1.03.41-1.42 0a5.003 5.003 0 0 1 0-7.07l3.54-3.54a5.003 5.003 0 0 1 7.07 0 5.003 5.003 0 0 1 0 7.07l-1.49 1.49c.01-.82-.12-1.64-.4-2.42l.47-.48a2.982 2.982 0 0 0 0-4.24 2.982 2.982 0 0 0-4.24 0l-3.53 3.53a2.982 2.982 0 0 0 0 4.24zm2.82-4.24c.39-.41 1.03-.41 1.42 0a5.003 5.003 0 0 1 0 7.07l-3.54 3.54a5.003 5.003 0 0 1-7.07 0 5.003 5.003 0 0 1 0-7.07l1.49-1.49c-.01.82.12 1.64.4 2.43l-.47.47a2.982 2.982 0 0 0 0 4.24 2.982 2.982 0 0 0 4.24 0l3.53-3.53a2.982 2.982 0 0 0 0-4.24.973.973 0 0 1 0-1.42z"/></svg>';

        let html = `<div style="font-size:0.55rem; color:#666; margin-bottom:10px; font-family:'Orbitron'; letter-spacing:1px;">PROMOTION REQUIREMENTS</div>`;

        // Identity Checks (Footman+)
        if (req.name === true) {
            const hasName = (u.name && u.name !== 'Slave') || (u.title && u.title !== 'Slave');
            html += buildCheck("IDENTITY", hasName, SVG_ID);
        }
        if (req.photo === true) {
            // Check RAW profilePicture, not the fallback avatar
            const hasPhoto = (u.profilePicture && !u.profilePicture.includes('default'));
            html += buildCheck("PHOTO", hasPhoto, SVG_PHOTO);
        }

        // Preference Checks (Silverman+)
        if (req.limits === true) {
            const hasLimits = (u.limits && u.limits.length > 2);
            html += buildCheck("LIMITS", hasLimits, SVG_LIMITS);
        }
        if (req.kinks === true) {
            const hasKinks = ((u.kinks && u.kinks.length > 2) || (u.kink && u.kink.length > 2));
            html += buildCheck("KINKS", hasKinks, SVG_KINKS);
        }

        html += buildBar("LABOR", stats.tasks, req.tasks, "🛠️");
        html += buildBar("ENDURANCE", stats.kneels, req.kneels, "🧎");
        html += buildBar("MERIT", stats.points, req.points, "✨");

        if (req.spent > 0) {
            html += buildBar("SACRIFICE", stats.spent, req.spent, "💰");
        }

        if (req.streak > 0) {
            html += buildBar("CONSISTENCY", stats.streak, req.streak, "🔥");
        }

        container.innerHTML = html + `<div id="adminInlineDataEntry" style="margin-top:15px; border-top:1px solid #333; padding-top:10px; display:none;"></div>`;
    }

    const isRoutineDone = u.routineDoneToday === true;
    const routineName = (u.routine || "NONE").toUpperCase();
    const routineStatus = isRoutineDone ? "DONE" : "PENDING";
    const routineColor = isRoutineDone ? '#00ff00' : '#666';

    setText('dMirrorRoutine', `${routineName} (${routineStatus})`);

    // Tint color for both
    const rEl = document.getElementById('dMirrorRoutine');
    if (rEl) rEl.style.color = routineColor;

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
    const statusText = document.getElementById('dActiveStatus');
    const contentBox = document.getElementById('activeTaskContent');
    const idleBox = document.getElementById('idleActions');

    if (!activeText) return;

    if (u.activeTask && u.endTime && u.endTime > Date.now()) {
        // STATUS: WORKING
        if (statusText) {
            statusText.innerText = "WORKING";
            statusText.style.color = "var(--green)";
        }
        if (contentBox) contentBox.style.display = "block";
        if (idleBox) idleBox.style.display = "none";

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
        // STATUS: UNPRODUCTIVE
        if (statusText) {
            statusText.innerText = "UNPRODUCTIVE";
            statusText.style.color = "var(--red)";
        }
        if (contentBox) contentBox.style.display = "none";
        if (idleBox) idleBox.style.display = "block";

        activeText.innerText = "None";
        activeTimer.innerText = "--:--";
    }
}

// Global Toggle for Queue
window.toggleTaskQueue = function () {
    const q = document.getElementById('taskQueueContainer');
    const topPanel = document.querySelector('.admin-dash-top');

    if (q) {
        const isHidden = q.classList.toggle('hidden'); // hidden means Closed
        // If we just removed hidden (it is now visible), we Expand. 
        // If we added hidden (it is now closed), we Collapse.

        // toggle returns true if added, false if removed.
        // Wait, classList.toggle returns true if class is now present.
        // So if 'hidden' is present -> Collapsed. 
        // If 'hidden' is NOT present -> Expanded.

        if (topPanel) {
            if (!isHidden) {
                topPanel.classList.add('expanded-ops');
                topPanel.style.height = "100%"; // FORCE OVERRIDE inline style
            } else {
                topPanel.classList.remove('expanded-ops');
                topPanel.style.height = "35%"; // RESTORE ORIGINAL inline style
            }
        }
    }
};

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

// --- HIERARCHY IS NOW STRICTLY CALCULATED IN updateDetail ---
// No manual override allowed.
