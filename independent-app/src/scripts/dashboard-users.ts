// src/scripts/dashboard-users.ts
// USER DATA CONTROLLER - Converted to TypeScript

import {
    users, currId, cooldownInterval, histLimit,
    stickerConfig, availableDailyTasks,
    setCooldownInterval, setHistLimit, setArmoryTarget
} from './dashboard-state';
import { clean, raw, formatTimer } from './utils';
import { getSignedUrl, mediaType as mediaTypeFunction, getOptimizedUrl } from './media';

import { getHierarchyReport } from '../lib/hierarchyRules';

// --- STABILITY CACHE ---
let cachedFillers: any[] = [];
let fillerUserId: string | null = null;
const mainDashboardExpandedTasks = new Set<string>();

function calculateRoutineStreak(historyStr: string | any[]): number {
    if (!historyStr) return 0;
    return 0;
}

// Keep the internal streak calculator for fallback if needed, but we'll prioritize getHierarchyReport
function calculateInternalStreak(historyStr: string | any[]): number {
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
        if (isNaN(date.getTime())) return '';
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

    const report = getHierarchyReport(u);
    if (!report) return;

    const now = Date.now();
    const ls = u.lastSeen ? new Date(u.lastSeen).getTime() : 0;
    let diff = Math.floor((now - ls) / 60000);
    let status = (ls > 0 && diff < 2) ? "ONLINE" : (ls > 0 ? diff + " MIN AGO" : "OFFLINE");
    const isOnline = status === "ONLINE";

    const profPic = document.getElementById('dProfilePic') as HTMLImageElement;
    const headerBg = document.getElementById('apMirrorHeader');
    const defaultPic = "/queen-karin.png";
    const finalPic = u.avatar || u.profilePicture || defaultPic;

    if (profPic) {
        profPic.src = getOptimizedUrl(finalPic, 200);
        profPic.onerror = () => { profPic.src = defaultPic; };
    }
    if (headerBg) headerBg.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url('${getOptimizedUrl(finalPic, 400)}')`;

    let realRank = report.currentRank;
    setText('dMirrorHierarchy', realRank.toUpperCase());
    setText('dMirrorName', u.name || "SLAVE");

    const stEl = document.getElementById('dMirrorStatus');
    if (stEl) {
        stEl.innerText = status;
        stEl.style.color = isOnline ? '#00ff00' : '#666';
    }

    setText('dMirrorPoints', (u.points || 0).toLocaleString());
    setText('dMirrorWallet', (u.wallet || 0).toLocaleString());

    const totalKneel = u.kneelCount || 0;
    const kneelHrs = (totalKneel * 0.25).toFixed(1);
    setText('dMirrorKneel', `${kneelHrs} h`);

    setText('admin_CurrentRank', report.currentRank);
    const elAdminCurBen = document.getElementById('admin_CurrentBenefits');
    if (elAdminCurBen) {
        // Find existing benefits if possible, or just use report?
        // Let's stick to the local data for benefits if we want the icons, 
        // but getHierarchyReport is safer for rank names.
        // Actually, hierarchyRules.ts has benefits too!
        // But HIERARCHY_RULES in lib might not have the icons like in local REWARD_DATA.
        // I'll keep the local logic for BENEFITS for now to avoid losing icons if any.
        // Wait, I already added icons to the bars.
    }

    setText('admin_NextRank', report.isMax ? "MAXIMUM RANK" : `WORKING ON ${report.nextRank.toUpperCase()}`);

    // Rendering Progress Container
    const container = document.getElementById('admin_ProgressContainer');
    if (container) {
        let html = `<div style="font-size:0.55rem; color:#666; margin-bottom:10px; font-family:'Orbitron'; letter-spacing:1px;">PROMOTION REQUIREMENTS</div>`;

        report.requirements.forEach(r => {
            if (r.type === 'bar') {
                const current = r.current || 0;
                const target = r.target || 1;
                const pct = Math.min((current / target) * 100, 100);
                const isDone = current >= target;
                const color = isDone ? "#00ff00" : "#c5a059";

                // Add icons based on label
                let icon = "🛠️";
                if (r.label === "ENDURANCE") icon = "🧎";
                if (r.label === "MERIT") icon = "✨";
                if (r.label === "SACRIFICE") icon = "💰";
                if (r.label === "CONSISTENCY") icon = "📅";

                html += `
                    <div style="margin-bottom:12px;">
                        <div style="display:flex; justify-content:space-between; font-size:0.65rem; font-family:'Orbitron'; margin-bottom:4px; color:${isDone ? "#fff" : "#888"};">
                            <span>${icon} ${r.label}</span>
                            <span style="color:${color}">${current.toLocaleString()} / ${target.toLocaleString()}</span>
                        </div>
                        <div style="width:100%; height:8px; background:#000; border:1px solid #333; border-radius:4px; overflow:hidden; position:relative;">
                            <div style="width:${pct}%; height:100%; background:${color}; box-shadow:0 0 10px ${color}40;"></div>
                        </div>
                    </div>`;
            } else if (r.type === 'check') {
                // Identity and photo are visually obvious — skip them
                if (r.label === 'IDENTITY' || r.label === 'PHOTO') return;
                // Kinks/limits have their own section below — skip here too
                if (r.label === 'KINKS' || r.label === 'LIMITS') return;

                const isDone = r.status === 'VERIFIED';
                const svgIcon = isDone
                    ? `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6.5" stroke="#00ff00" stroke-width="1"/><path d="M3.5 7L5.5 9.5L10.5 4.5" stroke="#00ff00" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
                    : `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6.5" stroke="#ff4444" stroke-width="1"/><path d="M4.5 4.5L9.5 9.5M9.5 4.5L4.5 9.5" stroke="#ff4444" stroke-width="1.5" stroke-linecap="round"/></svg>`;

                html += `
                    <div style="margin-bottom:8px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.65rem; font-family:'Orbitron';">
                            <span style="color:#888;">${r.label}</span>
                            ${svgIcon}
                        </div>
                    </div>`;
            }
        });

        // Routine row with today's proof
        const routineCheck = report.requirements.find((r: any) => r.type === 'check' && r.label === 'ROUTINE');
        const isDoneToday = u.routineDoneToday === true;
        const routineName = (u.routine || 'NONE').toUpperCase();
        const todayStr = new Date().toDateString();
        const history: any[] = u.routineHistory || u.routinehistory || [];
        const todayEntry = history.slice().reverse().find((h: any) =>
            h.isRoutine && h.proofUrl && new Date(h.timestamp).toDateString() === todayStr
        );
        const routineSvg = isDoneToday
            ? `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6.5" stroke="#00ff00" stroke-width="1"/><path d="M3.5 7L5.5 9.5L10.5 4.5" stroke="#00ff00" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
            : `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6.5" stroke="#ff4444" stroke-width="1"/><path d="M4.5 4.5L9.5 9.5M9.5 4.5L4.5 9.5" stroke="#ff4444" stroke-width="1.5" stroke-linecap="round"/></svg>`;
        const proofHtml = todayEntry
            ? (todayEntry.proofUrl?.match(/\.(mp4|mov|webm)/i)
                ? `<video src="${todayEntry.proofUrl}" controls style="width:100%;border-radius:4px;border:1px solid #333;max-height:200px;margin-top:6px;"></video>`
                : `<img src="${todayEntry.proofUrl}" style="width:100%;border-radius:4px;border:1px solid #333;cursor:pointer;max-height:260px;object-fit:cover;margin-top:6px;" onclick="window.open('${todayEntry.proofUrl}','_blank')" onerror="this.style.display='none'">`)
            : '';
        html += `
            <div style="margin-bottom:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.65rem; font-family:'Orbitron';">
                    <span style="color:#888;">ROUTINE — ${routineName}</span>
                    ${routineSvg}
                </div>
                ${proofHtml}
            </div>`;

        // Always show force-promote button when not at max
        if (!report.isMax) {
            html += `<div style="margin-top:16px;">
                <button onclick="window.adminPromoteUser('${u.memberId}')" style="width:100%;padding:12px;background:linear-gradient(135deg,rgba(170,125,30,0.5),rgba(130,92,15,0.4));color:rgba(240,210,120,0.95);border:1px solid rgba(180,140,50,0.5);border-radius:6px;font-family:'Orbitron';font-size:0.5rem;letter-spacing:3px;cursor:pointer;font-weight:700;">
                    ✦ PROMOTE TO ${report.nextRank.toUpperCase()}
                </button>
            </div>`;
        }

        container.innerHTML = html;
    }

    const isRoutineDone = u.routineDoneToday === true;
    const routineName = (u.routine || "NONE").toUpperCase();
    setText('dMirrorRoutine', `${routineName} (${isRoutineDone ? "DONE" : "PENDING"})`);
    const rEl = document.getElementById('dMirrorRoutine');
    if (rEl) rEl.style.color = isRoutineDone ? '#00ff00' : '#666';


    // Kinks & limits
    const kinksLimitsEl = document.getElementById('admin_KinksLimits');
    if (kinksLimitsEl) {
        const kinks = u.kinks || '';
        const limits = u.limits || '';
        if (kinks || limits) {
            kinksLimitsEl.innerHTML = `
                <div style="border:1px solid rgba(197,160,89,0.15); border-radius:4px; overflow:hidden;">
                    ${kinks ? `<div style="padding:10px; border-bottom:${limits ? '1px solid rgba(197,160,89,0.1)' : 'none'}">
                        <div style="font-size:0.5rem; color:#c5a059; font-family:'Orbitron'; letter-spacing:1px; margin-bottom:5px;">KINKS</div>
                        <div style="font-size:0.7rem; color:#aaa; line-height:1.6;">${kinks}</div>
                    </div>` : ''}
                    ${limits ? `<div style="padding:10px; background:rgba(255,68,68,0.03);">
                        <div style="font-size:0.5rem; color:#ff6666; font-family:'Orbitron'; letter-spacing:1px; margin-bottom:5px;">LIMITS</div>
                        <div style="font-size:0.7rem; color:#aaa; line-height:1.6;">${limits}</div>
                    </div>` : ''}
                </div>`;
        } else {
            kinksLimitsEl.innerHTML = '';
        }
    }

    setText('dMirrorSlaveSince', u.joinedDate ? new Date(u.joinedDate).toLocaleDateString() : "--/--/--");

    renderTelemetry(u);
    updateReviewQueue(u);
    updateActiveTask(u);
    updateTaskQueue(u);

    // Notify React of lock state for this user
    if (typeof window !== 'undefined' && (window as any)._setActiveLocks) {
        (window as any)._setActiveLocks({
            paywall: !!(u.parameters?.paywall?.active),
            silenced: u.silence === true,
        });
    }
}

function renderTelemetry(u: any) {
    const container = document.getElementById('admin_TelemetryContainer');
    if (!container) return;

    // Check both top-level and nested in parameters
    const data = u.tracking_data || u.parameters?.tracking_data || {};
    const dataJson = JSON.stringify(data);
    if ((u as any)._lastTelemetryJson === dataJson) return;
    (u as any)._lastTelemetryJson = dataJson;
    if (Object.keys(data).length === 0) {
        container.innerHTML = '<div style="color:#444; font-size:0.6rem; text-align:center; grid-column:span 2;">NO DATA RECEIVED</div>';
        return;
    }

    const device = data.device || {};
    const battery = device.battery || {};
    const network = data.network || {};
    const location = network.location || {};

    const rows = [
        { label: '🌍 LOCATION', val: `${location.city || 'Unknown'}, ${location.country || '??'}` },
        { label: '🕒 LOCAL TIME', val: data.timezone ? new Date().toLocaleTimeString('en-GB', { timeZone: data.timezone, hour: '2-digit', minute: '2-digit' }) : '??:??' },
        { label: '📱 DEVICE', val: `${device.os || 'OS'} (${device.browser || 'Browser'})` },
        { label: '🔋 BATTERY', val: battery.level !== undefined ? `${battery.level}% ${battery.charging === true ? '⚡' : ''}` : '??%' },
        { label: '🏠 PWA', val: device.is_pwa ? 'INSTALLED' : 'BROWSER' },
        { label: '🖥️ RESOLUTION', val: device.resolution || '??x??' }
    ];

    container.innerHTML = rows.map(r => `
        <div style="background:rgba(0,0,0,0.3); padding:8px; border-radius:4px; border:1px solid rgba(197,160,89,0.1);">
            <div style="color:#666; font-size:0.5rem; font-family:'Orbitron'; margin-bottom:2px;">${r.label}</div>
            <div style="color:#c5a059; font-size:0.7rem; font-family:'Rajdhani'; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${r.val}</div>
        </div>
    `).join('');

    // Bonus: Low battery highlight
    if (battery.level !== undefined && battery.level < 20 && battery.charging !== true) {
        const lastCard = container.lastElementChild?.previousElementSibling as HTMLElement;
        if (lastCard) {
            lastCard.style.borderColor = 'rgba(255,0,0,0.5)';
            lastCard.style.background = 'rgba(255,0,0,0.05)';
        }
    }
}

function setText(id: string, txt: string) {
    const el = document.getElementById(id);
    if (el) el.innerText = txt;
}

async function updateReviewQueue(u: any) {
    const qSec = document.getElementById('userQueueSec');
    if (!qSec) return;

    if (u.reviewQueue && u.reviewQueue.length > 0) {
        // Skip re-render if queue hasn't changed
        const queueJson = JSON.stringify(u.reviewQueue);
        if ((u as any)._lastReviewQueueJson === queueJson) return;
        (u as any)._lastReviewQueueJson = queueJson;

        qSec.style.display = 'flex';
        qSec.innerHTML = `
            <div class="pend-list">
                ${u.reviewQueue.map((t: any) => {
            const isRoutine = t.isRoutine || t.category === 'Routine' || t.text === 'Daily Routine';
            const actType = isRoutine ? 'DAILY ROUTINE' : 'TASK';
            const dateStr = t.timestamp ? new Date(t.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
            const isVideo = (t.proofType && (t.proofType === 'video' || t.proofType.startsWith('video/'))) || mediaTypeFunction(t.proofUrl) === 'video';
            // Videos: show thumbnail if available, otherwise a static placeholder — no autoplay
            const mediaTag = isVideo
                ? (t.thumbnail_url
                    ? `<img src="${getOptimizedUrl(t.thumbnail_url, 400)}" class="pend-thumb" onerror="this.src='/queen-karin.png'" style="object-fit:cover;">`
                    : `<div class="pend-thumb" style="background:#0a0a0a;display:flex;align-items:center;justify-content:center;border:1px solid #1a1a1a;">
                         <svg width="32" height="32" viewBox="0 0 24 24" fill="rgba(197,160,89,0.5)"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
                       </div>`)
                : `<img src="${getOptimizedUrl(t.proofUrl || '', 400)}" class="pend-thumb" onerror="this.src='/queen-karin.png'">`;

            return `
                    <div class="pend-card" onclick="window.openModById('${t.id}', '${u.memberId}', false, null, '${isVideo ? 'video' : 'image'}')">
                        ${mediaTag}
                        <div class="pend-info">
                            <div class="pend-act" style="color:${isRoutine ? '#00ff00' : 'var(--gold)'}">${actType}</div>
                            <div class="pend-date">${dateStr}</div>
                        </div>
                    </div>`;
        }).join('')}
            </div>
        `;
    } else {
        if ((u as any)._lastReviewQueueJson !== '') {
            (u as any)._lastReviewQueueJson = '';
            qSec.style.display = 'none';
        }
    }
}

function updateActiveTask(u: any) {
    if (cooldownInterval) clearInterval(cooldownInterval);
    const activeText = document.getElementById('dActiveText');
    const activeTimer = document.getElementById('dActiveTimer');
    const activeStatus = document.getElementById('dActiveStatus');
    const statusDot = document.getElementById('statusDot');
    const idleActions = document.getElementById('idleActions');
    const activeTaskContent = document.getElementById('activeTaskContent');

    if (!activeText || !activeTimer) return;

    const isPending = u.pendingState === "PENDING" || (u.activeTask && u.activeTask.proofUrl === "FORCED");

    // Resolve endTime: use stored endTime, or calculate from assigned_at + 24h, or null
    let resolvedEndTime = u.endTime || null;
    if (!resolvedEndTime && u.activeTask?.assigned_at) {
        resolvedEndTime = new Date(u.activeTask.assigned_at).getTime() + (24 * 60 * 60 * 1000);
    }

    // Show as active if: task exists AND (no endTime, or timer hasn't expired, or it's pending review)
    const hasActive = u.activeTask && (!resolvedEndTime || resolvedEndTime > Date.now() || isPending);

    // Update Status Dot & Text
    if (statusDot) {
        statusDot.className = `status-dot ${hasActive ? 'productive' : 'unproductive'}`;
    }

    if (activeStatus) {
        activeStatus.innerText = hasActive ? (isPending ? "PENDING" : "ACTIVE") : "UNPRODUCTIVE";
        activeStatus.className = `at-status-text ${hasActive ? 'active' : ''}`;
        activeStatus.style.color = hasActive ? (isPending ? "var(--pink)" : "var(--gold)") : "#666";
    }

    if (hasActive) {
        if (idleActions) idleActions.style.display = 'none';
        const failBtn = activeTaskContent?.querySelector('.at-fail') as HTMLElement;
        if (failBtn) failBtn.style.display = 'block';

        const rawText = u.activeTask.text || u.activeTask.TaskText || "";
        activeText.innerHTML = rawText; // Support HTML directives

        if (resolvedEndTime) {
            // Only create a new countdown interval if the endTime has changed
            if ((u as any)._lastTrackedEndTime !== resolvedEndTime) {
                if (cooldownInterval) clearInterval(cooldownInterval);
                (u as any)._lastTrackedEndTime = resolvedEndTime;
                const tick = () => {
                    const diff = resolvedEndTime - Date.now();
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
                setCooldownInterval(setInterval(tick, 1000));
            }
        } else {
            activeTimer.innerText = "--:--";
        }
    } else {
        if (cooldownInterval) clearInterval(cooldownInterval);
        (u as any)._lastTrackedEndTime = null;
        if (idleActions) idleActions.style.display = 'block';
        const failBtn = activeTaskContent?.querySelector('.at-fail') as HTMLElement;
        if (failBtn) failBtn.style.display = 'none';
        activeText.innerText = "None";
        activeTimer.innerText = "--:--";
    }
}

export function toggleTaskDrawer() {
    const drawer = document.getElementById('taskDrawer');
    if (drawer) {
        drawer.classList.toggle('open');
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

    const queue = (u.task_queue || u.taskQueue || u.queue || []) as any[];
    const queueJson = JSON.stringify(queue);

    // Prevent redundant renders and logging loops
    if ((u as any)._lastQueueJson === queueJson) return;
    (u as any)._lastQueueJson = queueJson;

    console.log("[updateTaskQueue] Rendered | Queue Length:", queue.length);

    let personalTasks = u.task_queue || u.taskQueue || u.queue || [];

    listContainer.innerHTML = `
        <div class="mini-active" style="border:1px solid rgba(197,160,89,0.3); background:rgba(0,0,0,0.5); border-radius:8px; cursor:pointer; text-align:center; padding:15px; transition:all 0.2s;" onclick="const q = document.getElementById('taskQueueContainer'); if(q && !q.classList.contains('hidden')) { if(window.closeTaskGallery) window.closeTaskGallery(); } else { if(window.openTaskGallery) window.openTaskGallery(); }" onmouseover="this.style.background='rgba(197,160,89,0.1)'" onmouseout="this.style.background='rgba(0,0,0,0.5)'">
            <div style="font-family:'Orbitron', sans-serif; font-size:1.5rem; color:#c5a059; margin-bottom:5px;">${personalTasks.length}</div>
            <div style="font-family:'Cinzel', serif; font-size:0.7rem; color:#aaa; letter-spacing:2px;">SCHEDULED DIRECTIVES</div>
            <div style="font-family:'Rajdhani', sans-serif; font-size:0.65rem; color:#666; margin-top:10px; text-transform:uppercase; letter-spacing:1px;">Tap to view full queue &rarr;</div>
        </div>
    `;
}

export async function adminPromoteUser(memberId: string) {
    if (!memberId) return;
    try {
        const res = await fetch('/api/promote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memberEmail: memberId })
        });
        const data = await res.json();
        if (data.success && data.promoted) {
            window.location.reload();
        }
    } catch (_) {}
}

if (typeof window !== 'undefined') {
    (window as any).updateDetail = updateDetail;
    (window as any).deleteQueueItem = deleteQueueItem;
    (window as any).toggleTaskDrawer = toggleTaskDrawer;
    (window as any).adminPromoteUser = adminPromoteUser;
}
