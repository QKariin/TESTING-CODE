// src/scripts/dashboard-users.ts
// USER DATA CONTROLLER - Converted to TypeScript

import {
    users, currId, cooldownInterval, histLimit,
    stickerConfig, availableDailyTasks,
    setCooldownInterval, setHistLimit, setArmoryTarget
} from './dashboard-state';
import { clean, raw, formatTimer } from './utils';
import { getSignedUrl, mediaType as mediaTypeFunction, getOptimizedUrl } from './media';

// --- STABILITY CACHE ---
let cachedFillers: any[] = [];
let fillerUserId: string | null = null;
const mainDashboardExpandedTasks = new Set<string>();

const REWARD_DATA = {
    ranks: [
        {
            name: "HALL BOY", icon: "🧹", tax: 20,
            req: { tasks: 0, kneels: 0, points: 0, spent: 0, streak: 0 },
            benefits: ["Identity: You are granted a Name.", "Labor: Permission to begin Basic Tasks.", "Speak Cost: 20 Coins."]
        },
        {
            name: "FOOTMAN", icon: "👞", tax: 15,
            req: { tasks: 5, kneels: 10, points: 2000, spent: 0, streak: 0, name: true, photo: true },
            benefits: ["Presence: Your Face may be revealed.", "Order: Access to the Daily Routine.", "Speak Cost: 15 Coins."]
        },
        {
            name: "SILVERMAN", icon: "🥈", tax: 10,
            req: { tasks: 25, kneels: 65, points: 5000, spent: 5000, streak: 5, limits: true, kinks: true },
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

function calculateRoutineStreak(historyStr: string | any[]): number {
    if (!historyStr) return 0;

    let photos: any[] = [];
    try {
        if (typeof historyStr === 'string') photos = JSON.parse(historyStr);
        else if (Array.isArray(historyStr)) photos = historyStr;
    } catch (e) { return 0; }

    if (!photos || photos.length === 0) return 0;

    photos.sort((a, b) => {
        const dateA = new Date(a.date || a._createdDate || a).getTime();
        const dateB = new Date(b.date || b._createdDate || b).getTime();
        return dateB - dateA;
    });

    const getDutyDay = (d: any) => {
        let date = new Date(d);
        if (date.getHours() < 6) date.setDate(date.getDate() - 1);
        return date.toISOString().split('T')[0];
    };

    let streak = 0;
    const todayCode = getDutyDay(new Date());
    const newestDate = photos[0].date || photos[0]._createdDate || photos[0];
    const lastCode = getDutyDay(newestDate);

    const d1 = new Date(todayCode).getTime();
    const d2 = new Date(lastCode).getTime();
    const diffDays = (d1 - d2) / (1000 * 60 * 60 * 24);

    if (diffDays <= 1) {
        streak = 1;
        let currentCode = lastCode;

        for (let i = 1; i < photos.length; i++) {
            const itemDate = photos[i].date || photos[i]._createdDate || photos[i];
            const nextCode = getDutyDay(itemDate);
            if (nextCode === currentCode) continue;

            const dayA = new Date(currentCode).getTime();
            const dayB = new Date(nextCode).getTime();
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

export async function updateDetail(u: any) {
    if (!u) return;

    const now = Date.now();
    const ls = u.lastSeen ? new Date(u.lastSeen).getTime() : 0;
    let diff = Math.floor((now - ls) / 60000);
    let status = (ls > 0 && diff < 2) ? "ONLINE" : (ls > 0 ? diff + " MIN AGO" : "OFFLINE");
    const isOnline = status === "ONLINE";

    const profPic = document.getElementById('dProfilePic') as HTMLImageElement;
    const headerBg = document.getElementById('apMirrorHeader');
    const defaultPic = "https://static.wixstatic.com/media/ce3e5b_78da97e06a3848df84d0b00c9e6dcfdd~mv2.png";
    const finalPic = u.avatar || u.profilePicture || defaultPic;

    if (profPic) profPic.src = getOptimizedUrl(finalPic, 200);
    if (headerBg) headerBg.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url('${getOptimizedUrl(finalPic, 400)}')`;

    let realRank = (u.hierarchy || "HALL BOY");
    setText('dMirrorHierarchy', realRank.toUpperCase());
    setText('dMirrorName', u.name || "SLAVE");

    const stEl = document.getElementById('dMirrorStatus');
    if (stEl) {
        stEl.innerText = status;
        stEl.style.color = isOnline ? '#00ff00' : '#666';
    }

    setText('dMirrorPoints', (u.points || 0).toLocaleString());
    setText('dMirrorWallet', (u.coins || 0).toLocaleString());

    const totalKneel = u.kneelCount || 0;
    const kneelHrs = (totalKneel * 0.25).toFixed(1);
    setText('dMirrorKneel', `${kneelHrs}h`);

    const ranks = REWARD_DATA.ranks;
    const cleanName = (name: string) => (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const currentRaw = u.hierarchy || "Hall Boy";

    let currentIdx = ranks.findIndex(r => cleanName(r.name) === cleanName(currentRaw));
    if (currentIdx === -1) currentIdx = 0;

    const currentRankObj = ranks[currentIdx];
    const isMax = currentIdx >= ranks.length - 1;
    const nextRankObj = isMax ? currentRankObj : ranks[currentIdx + 1];

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

    const calculatedStreak = calculateRoutineStreak(u.routineHistory);
    const stats = {
        tasks: u.completed || u.taskdom_completed_tasks || 0,
        kneels: u.kneelCount || 0,
        points: u.points || 0,
        spent: u.total_coins_spent || u.totalSpent || u.tributetotal || 0,
        streak: u.bestRoutinestreak || u.routinestreak || calculatedStreak || 0
    };

    const container = document.getElementById('admin_ProgressContainer');
    if (container) {
        let html = `<div style="font-size:0.55rem; color:#666; margin-bottom:10px; font-family:'Orbitron'; letter-spacing:1px;">PROMOTION REQUIREMENTS</div>`;

        // Bar builder (simplified for TS)
        const buildBar = (label: string, current: number, target: number, icon: string) => {
            const pct = Math.min((current / (target || 1)) * 100, 100);
            const isDone = current >= target;
            const color = isDone ? "#00ff00" : "#c5a059";
            return `
                <div style="margin-bottom:12px;">
                    <div style="display:flex; justify-content:space-between; font-size:0.65rem; font-family:'Orbitron'; margin-bottom:4px; color:${isDone ? "#fff" : "#888"};">
                        <span>${icon} ${label}</span>
                        <span style="color:${color}">${current.toLocaleString()} / ${target.toLocaleString()}</span>
                    </div>
                    <div style="width:100%; height:8px; background:#000; border:1px solid #333; border-radius:4px; overflow:hidden; position:relative;">
                        <div style="width:${pct}%; height:100%; background:${color}; box-shadow:0 0 10px ${color}40;"></div>
                    </div>
                </div>`;
        };

        const req = nextRankObj.req;
        html += buildBar("LABOR", stats.tasks, req.tasks, "🛠️");
        html += buildBar("ENDURANCE", stats.kneels, req.kneels, "🧎");
        html += buildBar("MERIT", stats.points, req.points, "✨");
        if (req.spent > 0) html += buildBar("SACRIFICE", stats.spent, req.spent, "💰");
        if (req.streak > 0) html += buildBar("CONSISTENCY", stats.streak, req.streak, "🔥");

        container.innerHTML = html;
    }

    const isRoutineDone = u.routineDoneToday === true;
    const routineName = (u.routine || "NONE").toUpperCase();
    setText('dMirrorRoutine', `${routineName} (${isRoutineDone ? "DONE" : "PENDING"})`);
    const rEl = document.getElementById('dMirrorRoutine');
    if (rEl) rEl.style.color = isRoutineDone ? '#00ff00' : '#666';

    setText('dMirrorSlaveSince', u.joinedDate ? new Date(u.joinedDate).toLocaleDateString() : "--/--/--");

    updateReviewQueue(u);
    updateActiveTask(u);
    updateTaskQueue(u);
}

function setText(id: string, txt: string) {
    const el = document.getElementById(id);
    if (el) el.innerText = txt;
}

async function updateReviewQueue(u: any) {
    const qSec = document.getElementById('userQueueSec');
    if (!qSec) return;

    if (u.reviewQueue && u.reviewQueue.length > 0) {
        qSec.style.display = 'flex';
        qSec.innerHTML = `<div class="sec-title" style="color:var(--red);">PENDING REVIEW</div>` +
            u.reviewQueue.map((t: any) => `
                <div class="pend-card" onclick="window.openModById('${t.id}', '${u.memberId}', false)">
                    <img src="${getOptimizedUrl(t.proofUrl || '', 200)}" class="pend-thumb">
                    <div class="pend-info">
                        <div class="pend-act">PENDING</div>
                        <div class="pend-txt">${clean(t.text)}</div>
                    </div>
                </div>`).join('');
    } else {
        qSec.style.display = 'none';
    }
}

function updateActiveTask(u: any) {
    if (cooldownInterval) clearInterval(cooldownInterval);
    const activeText = document.getElementById('dActiveText');
    const activeTimer = document.getElementById('dActiveTimer');
    const activeStatus = document.getElementById('dActiveStatus');

    if (!activeText || !activeTimer) return;

    const isPending = u.pendingState === "PENDING" || (u.activeTask && u.activeTask.proofUrl === "FORCED");

    if (u.activeTask && u.endTime && u.endTime > Date.now()) {
        const rawText = u.activeTask.text || u.activeTask.TaskText || "";
        activeText.innerHTML = rawText; // Support HTML directives

        if (activeStatus) {
            activeStatus.innerText = isPending ? "PENDING" : "ACTIVE";
            activeStatus.style.color = isPending ? "var(--pink)" : "var(--gold)";
        }

        const tick = () => {
            const diff = u.endTime - Date.now();
            if (diff <= 0) {
                activeTimer.innerText = "00:00";
                if (activeStatus && !isPending) {
                    activeStatus.innerText = "OVERDUE";
                    activeStatus.style.color = "var(--red)";
                }
                clearInterval(cooldownInterval);
                return;
            }
            activeTimer.innerText = formatTimer(diff);
        };
        tick();
        const interval = setInterval(tick, 1000);
        setCooldownInterval(interval);
    } else {
        activeText.innerText = "None";
        activeTimer.innerText = "--:--";
        if (activeStatus) {
            activeStatus.innerText = "UNPRODUCTIVE";
            activeStatus.style.color = "#666";
        }
    }
}

export async function deleteQueueItem(memberId: string, idx: number) {
    const u = users.find(x => x.memberId === memberId);
    if (!u) return;

    let queue = u.task_queue || u.taskQueue || u.queue || [];
    queue.splice(idx, 1);

    try {
        const { secureUpdateTaskAction } = await import('@/actions/velo-actions');
        await secureUpdateTaskAction(memberId, { taskQueue: queue });
        u.task_queue = queue;
        u.taskQueue = queue;
        u.queue = queue;
        updateTaskQueue(u);
    } catch (err) {
        console.error("Failed to delete queue item:", err);
    }
}

export function updateTaskQueue(u: any) {
    const listContainer = document.getElementById('qListContainer');
    if (!listContainer) return;

    let personalTasks = u.task_queue || u.taskQueue || u.queue || [];

    if (fillerUserId !== u.memberId || cachedFillers.length === 0) {
        cachedFillers = (availableDailyTasks || []).sort(() => 0.5 - Math.random()).slice(0, 10);
        fillerUserId = u.memberId;
    }

    const displayTasks = [...personalTasks, ...cachedFillers.slice(0, Math.max(0, 10 - personalTasks.length))];

    listContainer.innerHTML = displayTasks.map((t, idx) => {
        const isPersonal = idx < personalTasks.length;
        const taskText = typeof t === 'string' ? t : (t.text || t.TaskText || 'Unnamed Task');
        const niceText = clean(taskText);
        return `
            <div class="mini-active" style="border:1px solid ${isPersonal ? '#333' : '#222'}; opacity:${isPersonal ? 1 : 0.5}; margin-bottom:5px;">
                <div class="ma-status" style="color:${isPersonal ? 'var(--gold)' : '#555'}">${isPersonal ? 'CMD' : 'AUTO'}</div>
                <div class="ma-mid">
                    <div class="ma-txt">${niceText}</div>
                </div>
                ${isPersonal ? `<button class="ma-btn" onclick="window.deleteQueueItem('${u.memberId}', ${idx})" style="color:red; background:none; border:none; cursor:pointer; font-size:1.2rem; padding:0 5px;">&times;</button>` : ''}
            </div>`;
    }).join('');
}

// Global functions for window
if (typeof window !== 'undefined') {
    (window as any).updateDetail = updateDetail;
    (window as any).deleteQueueItem = deleteQueueItem;
}
