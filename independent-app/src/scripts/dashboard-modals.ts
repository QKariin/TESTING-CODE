// src/scripts/dashboard-modals.ts
// Dashboard Modal Management - Converted to TypeScript

import {
    currTask, pendingApproveTask, selectedStickerId, pendingRewardMedia,
    stickerConfig, availableDailyTasks, currId, users, globalQueue,
    setCurrTask, setPendingApproveTask, setSelectedStickerId, setPendingRewardMedia,
    setMediaRecorder, setAudioChunks, mediaRecorder, audioChunks,
    ACCOUNT_ID, API_KEY, setDragSrcIndex, dragSrcIndex,
    armoryTarget, setArmoryTarget, setGlobalQueue
} from './dashboard-state';
import { clean, raw, getOptimizedUrl } from './utils';
import { mediaType as mediaTypeFunction, getSignedUrl } from './media';
import { adminApproveTaskAction, adminRejectTaskAction, adminGetTasksAction, adminAssignTaskAction } from '@/actions/velo-actions';

let pendingDirectiveText = "";
let workshopFillers: any[] = [];
let workshopUserId: string | null = null;
const workshopExpandedTexts = new Set<string>();
let isConfirming = false;
let activeListFilter: boolean | null = null;

function stripHtml(html: string) {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
}

export function closeModal() {
    const modal = document.getElementById('reviewModal');
    if (modal) modal.classList.remove('active');

    const normalContent = document.getElementById('reviewNormalContent');
    const rewardOverlay = document.getElementById('reviewRewardOverlay');
    if (normalContent) normalContent.style.display = 'flex';
    if (rewardOverlay) rewardOverlay.style.display = 'none';

    setPendingApproveTask(null);
    setSelectedStickerId(null);
    setPendingRewardMedia(null);
}

export function closeListModal() {
    activeListFilter = null;
    const modal = document.getElementById('listModal');
    if (modal) modal.classList.remove('active');
}

export function openModal(taskId: string | null, memberId: string | null, mediaUrl: string | null, mediaType: string | null, taskText: string | null, isHistory: boolean = false, status: string | null = null) {
    setCurrTask({ id: taskId, memberId: memberId, mediaUrl: mediaUrl, mediaType: mediaType, text: taskText });
    const modal = document.getElementById('reviewModal');
    const mediaBox = document.getElementById('mMediaBox');
    const textEl = document.getElementById('mText');
    const actionsEl = document.getElementById('modalActions');

    if (!modal || !mediaBox || !textEl || !actionsEl) return;
    const isVideo = mediaTypeFunction(mediaUrl) === 'video';

    if (mediaUrl) {
        if (isVideo) {
            mediaBox.innerHTML = `<video src="${mediaUrl}" class="m-img" controls muted autoplay loop></video>`;
        } else {
            mediaBox.innerHTML = `<img src="${getOptimizedUrl(mediaUrl, 400)}" class="m-img">`;
        }
    } else {
        mediaBox.innerHTML = `<div style="color:#666; font-family:'Rajdhani';">NO MEDIA</div>`;
    }

    textEl.innerHTML = clean(taskText || 'No description provided.');

    if (isHistory) {
        actionsEl.innerHTML = status ? `<div class="hist-status st-${status === 'approve' ? 'app' : 'rej'}">${status.toUpperCase()}</div>` : `<button class="btn-main" onclick="window.closeModal()" style="background:#666;color:white;">CLOSE</button>`;
    } else {
        actionsEl.innerHTML = `<button class="btn-main" onclick="window.reviewTask('approve')" style="background:var(--green);color:black;">APPROVE</button><button class="btn-main" onclick="window.reviewTask('reject')" style="background:var(--red);color:white;">REJECT</button>`;
    }
    modal.classList.add('active');
}

export async function openModById(taskId: string, memberId: string, isHistory: boolean, fullSigned?: string) {
    const u = users.find(x => x.memberId === memberId);
    if (!u) return;

    let history: any[] = [];
    try {
        const raw = u['Taskdom_History'];
        history = typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw || []);
    } catch { }

    let t = u.reviewQueue?.find((x: any) => x.id === taskId) || history.find((x: any) => x.id === taskId);
    if (!t && isHistory && u.history) {
        t = u.history.find((x: any) => x.id === taskId);
    }

    if (t) {
        let finalUrl = fullSigned || t.proofUrl;
        if (finalUrl && finalUrl.includes('upcdn.io') && !finalUrl.includes('&sig=')) {
            try {
                finalUrl = await getSignedUrl(getOptimizedUrl(finalUrl, 1000));
            } catch (e) {
                console.error("Failed to sign modal media:", e);
                finalUrl = getOptimizedUrl(finalUrl, 1000);
            }
        }
        openModal(taskId, memberId, finalUrl, t.proofType, t.text, isHistory, t.status);
    }
}

export function reviewTask(decision: 'approve' | 'reject') {
    if (!currTask || isConfirming) return;

    // Capture state locally to avoid race conditions
    const taskData = { ...currTask };

    if (decision === 'approve') {
        openRewardProtocol();
    } else {
        console.log("Task rejected:", taskData.id);
        isConfirming = true;
        // Optimistic update
        const u = users.find(x => x.memberId === taskData.memberId);
        if (u) u.reviewQueue = (u.reviewQueue || []).filter((x: any) => x.id !== taskData.id);

        // --- GLOBAL SYNC ---
        setGlobalQueue(globalQueue.filter((x: any) => x.id !== taskData.id));

        import('./dashboard-main').then(m => m.renderMainDashboard());
        closeModal();

        adminRejectTaskAction(taskData.id!, taskData.memberId!)
            .then(res => {
                isConfirming = false;
                if (!res.success) {
                    console.error("Reject server-side fail:", res.error);
                }
            })
            .catch(err => {
                isConfirming = false;
                console.error("Rejection error:", err);
                alert("Error: " + err.message);
            });

        // Trigger List Refresh if open
        if (activeListFilter !== null) renderGlobalReview(activeListFilter);
    }
}

function openRewardProtocol() {
    setPendingApproveTask(currTask);
    setSelectedStickerId(null);
    setPendingRewardMedia(null);

    const normalContent = document.getElementById('reviewNormalContent');
    const rewardOverlay = document.getElementById('reviewRewardOverlay');
    if (normalContent) normalContent.style.display = 'none';
    if (rewardOverlay) rewardOverlay.style.display = 'flex';

    // Copy task text for visibility during reward
    const taskTextSec = document.getElementById('reviewRewardTaskText');
    if (taskTextSec && currTask) {
        taskTextSec.innerHTML = `<div style="color:var(--gold); font-family:Orbitron; font-size:0.6rem; margin-bottom:5px; letter-spacing:1px;">TASK DESCRIPTION</div>` + clean(currTask.text || 'No description provided.');
    }

    const grid = document.getElementById('stickerGrid');
    if (!grid) return;

    const source = (stickerConfig && stickerConfig.length > 0) ? stickerConfig : [
        { id: 's10', name: '10 PTS', val: 10, url: '' },
        { id: 's50', name: '50 PTS', val: 50, url: '' }
    ];

    grid.innerHTML = source.map((s: any) => `
        <div class="sticker-card" id="stk_${s.id}" onclick="window.selectSticker('${s.id}', ${s.val})">
            ${s.url ? `<img src="${getOptimizedUrl(s.url, 100)}" class="stk-img">` : `<div style="height:40px; display:flex; align-items:center;">IMG</div>`}
            <div class="stk-name">${s.name}</div>
        </div>`).join('');

    // Default to Normal Tier (50)
    setRewardTier(50, 'tier_50');
}

export function setRewardTier(val: number, id: string) {
    const bonusInp = document.getElementById('rewardBonus') as HTMLInputElement;
    if (bonusInp) bonusInp.value = val.toString();

    document.querySelectorAll('.reward-tier-btn').forEach(el => el.classList.remove('selected'));
    const target = document.getElementById(id);
    if (target) target.classList.add('selected');

    // Reset stickers when changing tiers to avoid confusion
    setSelectedStickerId(null);
    document.querySelectorAll('.sticker-card').forEach(el => el.classList.remove('selected'));
}

export function cancelReward() {
    const normalContent = document.getElementById('reviewNormalContent');
    const rewardOverlay = document.getElementById('reviewRewardOverlay');
    if (normalContent) normalContent.style.display = 'flex';
    if (rewardOverlay) rewardOverlay.style.display = 'none';
}

export function selectSticker(id: string, val: number) {
    setSelectedStickerId(id);
    document.querySelectorAll('.sticker-card').forEach(el => el.classList.remove('selected'));
    const target = document.getElementById('stk_' + id);
    if (target) target.classList.add('selected');

    // Add sticker value to currently selected tier base
    const activeTier = document.querySelector('.reward-tier-btn.selected');
    let baseVal = 50;
    if (activeTier) {
        if (activeTier.id === 'tier_70') baseVal = 70;
        else if (activeTier.id === 'tier_100') baseVal = 100;
    }

    const bonusInp = document.getElementById('rewardBonus') as HTMLInputElement;
    if (bonusInp) bonusInp.value = (baseVal + val).toString();
}

export async function handleRewardFileUpload(input: HTMLInputElement) {
    if (input.files?.[0]) {
        console.log("File upload requested:", input.files[0].name);
        // Upload logic here
    }
}

export function toggleRewardRecord() {
    console.log("Voice recording toggled");
}

export function confirmReward() {
    if (!pendingApproveTask || isConfirming) return;

    // Capture state locally to avoid race conditions
    const taskData = { ...pendingApproveTask };
    const bonusInp = document.getElementById('rewardBonus') as HTMLInputElement;
    const commentInp = document.getElementById('rewardComment') as HTMLInputElement;
    const bonus = parseInt(bonusInp?.value) || 50;
    const comment = commentInp?.value.trim();

    isConfirming = true;

    // --- OPTIMISTIC UPDATE START ---
    const u = users.find(x => x.memberId === taskData.memberId);
    if (u) {
        // 1. Remove from local review queue
        u.reviewQueue = (u.reviewQueue || []).filter((x: any) => x.id !== taskData.id);

        // --- GLOBAL SYNC ---
        setGlobalQueue(globalQueue.filter((x: any) => x.id !== taskData.id));

        // 2. Update local points/stats
        u.points = (u.points || 0) + bonus;
        if (u.wallet !== undefined) u.wallet = (u.wallet || 0) + bonus;
        if (u.score !== undefined) u.score = (u.score || 0) + bonus;
        if (u.parameters) {
            u.parameters.taskdom_completed_tasks = (u.parameters.taskdom_completed_tasks || 0) + 1;
        }

        // 3. Update local history entry for "Record" tab
        try {
            let history = typeof u['Taskdom_History'] === 'string' ? JSON.parse(u['Taskdom_History'] || '[]') : (u['Taskdom_History'] || []);
            const entryIdx = history.findIndex((h: any) => h.id === taskData.id);
            if (entryIdx > -1) {
                history[entryIdx].status = 'approve';
                history[entryIdx].completed = true;
                if (comment) history[entryIdx].adminComment = comment;
            }
            u['Taskdom_History'] = JSON.stringify(history);
        } catch (e) {
            console.warn("Local history update failed:", e);
        }
    }

    // 4. Force UI refresh
    import('./dashboard-main').then(m => m.renderMainDashboard());

    // 5. Update selected user detail if we are looking at them
    if (u && currId === taskData.memberId) {
        import('./dashboard-users').then(m => m.updateDetail(u));
    }

    closeModal();
    // --- OPTIMISTIC UPDATE END ---

    adminApproveTaskAction(taskData.id!, taskData.memberId!, bonus, comment)
        .then(res => {
            isConfirming = false;
            if (!res.success) {
                console.error("Approval server-side fail:", res.error);
                alert("Notice: Server failed to sync reward, but UI updated locally.");
            }
        })
        .catch(err => {
            isConfirming = false;
            console.error("Approval error:", err);
            alert("Error: " + err.message);
        });

    // Trigger List Refresh if open
    if (activeListFilter !== null) renderGlobalReview(activeListFilter);
}

let cachedTasks: any[] = [];
let detailCache: any[] = [];
let currentCategory: string | null = null;

export async function openTaskGallery() {
    const u = users.find(x => x.memberId === currId);
    const titleEl = document.getElementById('armoryTitle');
    if (titleEl) {
        titleEl.innerText = u ? `${u.name.toUpperCase()} DIRECTIVES` : "GLOBAL DIRECTIVES";
    }

    const gallery = document.getElementById('taskQueueContainer');
    if (gallery) gallery.classList.remove('hidden');

    try {
        console.log("GALLERY: Fetching tasks...");
        const res = await adminGetTasksAction();
        const tasks = res.success ? res.tasks : [];
        cachedTasks = tasks || [];
        currentCategory = null;
        renderTaskGallery();
    } catch (err: any) {
        console.error("GALLERY_LOAD_ERROR:", err);
        const container = document.getElementById('glassTaskGrid');
        if (container) container.innerHTML = `<div style="color:#ff4444; text-align:center; padding:40px; font-family:Orbitron;">ERROR: ${err.message}</div>`;
    }
}

export function renderTaskGallery(tasksToRender?: any[]) {
    const gridContainer = document.getElementById('glassTaskGrid');
    const queueContainer = document.getElementById('armoryLiveQueue');
    if (!gridContainer || !queueContainer) return;

    const tasks = tasksToRender || cachedTasks;
    const u = users.find(x => x.memberId === currId);
    const breadcrumbHtml = `
        <div class="filter-breadcrumb" style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; margin-bottom:15px; border-bottom:1px solid rgba(197,160,89,0.1);">
            <div style="font-family:Cinzel; font-size:0.75rem; color:#888; letter-spacing:1px;">
                VIEWING: <span style="color:var(--gold)">${currentCategory ? currentCategory.toUpperCase() : 'ALL DIRECTIVES'}</span>
            </div>
            ${currentCategory ? `<button class="reset-btn" onclick="window.setTaskCategory(null)">RESET TO ALL</button>` : ''}
        </div>
    `;

    const filtered = currentCategory
        ? tasks.filter(t => (t.Category || "").toLowerCase().includes(currentCategory!))
        : tasks;

    if (filtered.length === 0) {
        gridContainer.innerHTML = breadcrumbHtml + '<div style="color:#444; text-align:center; padding:40px; font-family:Cinzel; letter-spacing:1px;">NO DIRECTIVES FOUND</div>';
    } else {
        gridContainer.innerHTML = breadcrumbHtml + `
            <div style="display:flex; flex-direction:column; gap:12px;">
                ${filtered.map((t, idx) => {
            const safeText = t.TaskText || '';
            const cleanPreview = stripHtml(safeText);
            const rawCat = t.Category || "";
            const words: string[] = [];
            const regex = /"([^"]+)"/g;
            let match;
            while ((match = regex.exec(rawCat)) !== null) words.push(match[1]);

            const catHtml = words.length > 0
                ? words.map(w => `<span class="inline-tag" onclick="event.stopPropagation(); window.setTaskCategory('${w.toLowerCase()}')">${w.toUpperCase()}</span>`).join(' ')
                : `<span class="inline-tag" style="opacity:0.3;">GENERAL</span>`;

            return `
                    <div class="task-card-mini" onclick="window.openTaskDetail(${idx}, 'directive')">
                        <div class="tcm-header">
                            <div class="tcm-title">${t.Title || (words.length > 0 ? words[0].toUpperCase() : 'DIRECTIVE')}</div>
                            <div class="tcm-difficulty">${t.Difficulty || 'MED'}</div>
                        </div>
                        <div class="tcm-text line-clamp-2">${cleanPreview}</div>
                        <div class="tcm-meta">
                            <div class="tcm-tags">${catHtml}</div>
                            <div class="tcm-actions">
                                <button class="tcm-btn enforce-btn" onclick="event.stopPropagation(); window.openTaskDetail(${idx}, 'directive', 'enforce')" title="Add to Queue">
                                    <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/></svg>
                                </button>
                                <button class="tcm-btn force-btn" onclick="event.stopPropagation(); window.openTaskDetail(${idx}, 'directive', 'force')" title="Force Active Now">
                                    <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M7,2V13H10V22L17,10H13L17,2H7Z"/></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
        }).join('')}
            </div>
        `;
    }

    // 3. RENDER COMMAND QUEUE (Left Side)
    // Get personal schedule or fillers
    const schedule = (u?.task_queue || u?.taskQueue || u?.queue || []) as any[];
    const fillersNeeded = Math.max(0, 10 - schedule.length);

    // Pick random fillers from cachedTasks if needed
    const fillers = [];
    if (fillersNeeded > 0 && cachedTasks.length > 0) {
        for (let i = 0; i < fillersNeeded; i++) {
            fillers.push(cachedTasks[Math.floor(Math.random() * cachedTasks.length)]);
        }
    }

    const fullQueue = [...schedule.map(s => ({ ...s, isPersonal: true })), ...fillers.map(f => ({ ...f, isPersonal: false }))].slice(0, 10);
    detailCache = fullQueue;

    queueContainer.innerHTML = fullQueue.map((item, idx) => {
        const text = item.text || item.TaskText || 'Unnamed Task';
        const cleanPreview = stripHtml(text);
        const isPersonal = (item as any).isPersonal;

        return `
            <div class="q-item ${isPersonal ? 'personal' : 'filler'}" onclick='window.openTaskDetail(${idx}, "queue")'>
                <div class="q-item-num">${idx + 1}</div>
                <div class="q-item-content">
                    <div class="q-item-text line-clamp-2">${cleanPreview}</div>
                    <div class="q-item-type">${isPersonal ? 'SCHEDULED' : 'ROUTINE'}</div>
                </div>
                ${isPersonal ? `<div class="q-item-remove" onclick="event.stopPropagation(); window.removeScheduledTask(${idx})">&times;</div>` : ''}
            </div>
        `;
    }).join('');
}

// Redundant forceTask removed in favor of showForceOptions flow

export async function enforceTask(taskText: string, pos?: number) {
    const decoded = decodeURIComponent(taskText);
    if (!currId) return;

    try {
        const u = users.find(x => x.memberId === currId);
        if (!u) return;

        const queue = (u.task_queue || u.taskQueue || u.queue || []) as any[];
        const newTask = { text: decoded, added_at: new Date().toISOString() };

        if (typeof pos === 'number' && pos >= 0 && pos < 10) {
            queue.splice(pos, 0, newTask);
        } else {
            queue.unshift(newTask);
        }

        // Cap at 10
        if (queue.length > 10) queue.pop();

        // Save to Supabase using velo-action for consistency
        const { secureUpdateTaskAction } = await import('@/actions/velo-actions');
        await secureUpdateTaskAction(currId, { taskQueue: queue });

        u.task_queue = queue;
        u.taskQueue = queue;
        u.queue = queue;
        renderTaskGallery();

        // Also update the dossier if visible
        import('./dashboard-users').then(m => m.updateTaskQueue(u));
    } catch (err) {
        console.error("ENFORCE_FAILED:", err);
    }
}

export async function removeScheduledTask(idx: number) {
    if (!currId) return;
    try {
        const u = users.find(x => x.memberId === currId);
        if (!u) return;

        const queue = (u.task_queue || u.taskQueue || u.queue || []) as any[];
        queue.splice(idx, 1);

        const { secureUpdateTaskAction } = await import('@/actions/velo-actions');
        await secureUpdateTaskAction(currId, { taskQueue: queue });

        u.task_queue = queue;
        u.taskQueue = queue;
        u.queue = queue;
        renderTaskGallery();

        // Also update the dossier if visible
        import('./dashboard-users').then(m => m.updateTaskQueue(u));
    } catch (err) {
        console.error("REMOVE_SCHEDULED_FAILED:", err);
    }
}

export function setTaskCategory(cat: string | null) {
    currentCategory = cat;
    renderTaskGallery();
}

export function filterTaskGallery() {
    const input = document.getElementById('taskSearchInput') as HTMLInputElement;
    if (!input) return;
    const val = input.value.toLowerCase();

    const filtered = cachedTasks.filter(t =>
        (t.Title || '').toLowerCase().includes(val) ||
        (t.TaskText || '').toLowerCase().includes(val) ||
        (t.Category || '').toLowerCase().includes(val)
    );
    renderTaskGallery(filtered);
}

export async function pickTask(taskText: string) {
    if (!currId) return;
    const cleanPrompt = clean(taskText).substring(0, 100) + (taskText.length > 100 ? "..." : "");
    if (!confirm(`Assign this directive?\n\n"${cleanPrompt}"`)) return;

    try {
        console.log("PICK: Assigning task:", taskText.substring(0, 20) + "...");
        await adminAssignTaskAction(currId, taskText);
        // Refresh UI
        const u = users.find(x => x.memberId === currId);
        if (u) {
            u.activeTask = { text: taskText };
            u.endTime = Date.now() + (3600 * 1000); // Default 1hr
            import('./dashboard-users').then(m => m.updateDetail(u));
        }
        closeTaskGallery();
    } catch (err) {
        console.error("Failed to assign task:", err);
    }
}
export function openTaskDetail(idx: number, source: 'queue' | 'directive', initialView?: 'enforce' | 'force') {
    const modal = document.getElementById('taskDetailModal');
    const content = document.getElementById('taskDetailContent');
    if (!modal || !content) return;

    let t;
    if (source === 'queue') {
        t = detailCache[idx];
    } else {
        // Directives are filtered, we need to find the right one
        const filtered = currentCategory
            ? cachedTasks.filter(item => (item.Category || "").toLowerCase().includes(currentCategory!))
            : cachedTasks;
        t = filtered[idx];
    }
    if (!t) return;

    const fullText = t.text || t.TaskText || 'No Directive Text';
    const title = t.Title || 'DIRECTIVE DETAIL';
    const cat = t.Category || t.type || 'ROUTINE';
    const diff = t.Difficulty || 'MED';
    const limits = t.Limits || 'NONE';

    content.innerHTML = `
        <div class="glass-detail-header">
            <div class="gdh-title">${title.toUpperCase()}</div>
            <div class="gdh-diff">${diff.toUpperCase()}</div>
        </div>
        <div id="directiveActionContent">
            <div class="glass-detail-body">${fullText}</div>
            <div class="glass-detail-meta">
                <div class="gdm-item"><strong>CATEGORY:</strong> ${cat}</div>
                <div class="gdm-item"><strong>LIMITS:</strong> ${limits}</div>
            </div>
            <div class="glass-detail-actions">
                <button class="btn-glass enforce" onclick="window.showEnforceOptions('${encodeURIComponent(fullText)}')">ENFORCE</button>
                <button class="btn-glass force" onclick="window.showForceOptions('${encodeURIComponent(fullText)}', ${source === 'queue' ? idx : -1})">FORCE NOW</button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');

    if (initialView === 'enforce') {
        showEnforceOptions(encodeURIComponent(fullText));
    } else if (initialView === 'force') {
        showForceOptions(encodeURIComponent(fullText));
    }
}

export function closeTaskDetail() {
    const modal = document.getElementById('taskDetailModal');
    if (modal) modal.classList.add('hidden');
}

export function closeTaskGallery() {
    const gallery = document.getElementById('taskQueueContainer');
    if (gallery) gallery.classList.add('hidden');
}

export function showEnforceOptions(taskText: string) {
    const container = document.getElementById('directiveActionContent');
    if (!container) return;

    container.innerHTML = `
        <div style="font-family:Cinzel; font-size:0.8rem; color:#888; text-align:center; margin:20px 0; letter-spacing:2px;">SELECT QUEUE POSITION</div>
        <div class="q-pos-grid">
            ${Array.from({ length: 10 }).map((_, i) => `<button class="q-pos-btn" onclick="window.enforceTask('${taskText}', ${i}); window.closeTaskDetail();">${i + 1}</button>`).join('')}
        </div>
        <button class="btn-glass" style="width:100%; margin-top:10px;" onclick="window.closeTaskDetail(); window.openTaskGallery();">BACK</button>
    `;
}

export function showForceOptions(taskText: string, queueIdx: number = -1) {
    const container = document.getElementById('directiveActionContent');
    if (!container) return;

    container.innerHTML = `
        <div class="directive-sub-actions">
            <button class="btn-directive-sub" onclick="window.enforceTask('${taskText}', 0); window.closeTaskDetail();">TOP OF THE LIST!</button>
            <button class="btn-directive-sub force-active" onclick="window.forceActiveTask('${taskText}', ${queueIdx}); window.closeTaskDetail();">FORCE NOW</button>
            <button class="btn-glass" style="width:100%; margin-top:20px;" onclick="window.closeTaskDetail(); window.openTaskGallery();">BACK</button>
        </div>
    `;
}

export async function forceActiveTask(taskText: string, queueIdx: number = -1) {
    const decoded = decodeURIComponent(taskText);
    if (!currId) return;

    try {
        const u = users.find(x => x.memberId === currId);
        if (!u) return;

        const updates: any = {
            forceActive: {
                text: decoded,
                category: "Directive"
            }
        };

        // If forced from queue, remove it from queue
        if (queueIdx !== -1) {
            const queue = (u.task_queue || u.taskQueue || u.queue || []) as any[];
            queue.splice(queueIdx, 1);
            updates.taskQueue = queue;

            u.task_queue = queue;
            u.taskQueue = queue;
            u.queue = queue;
        }

        // Force Active logic: Set active task directly via backend
        const { secureUpdateTaskAction } = await import('@/actions/velo-actions');
        await secureUpdateTaskAction(currId, updates);

        // Update local state instantly for UI
        u.activeTask = { text: decoded, TaskText: decoded };
        u.endTime = Date.now() + (24 * 3600 * 1000); // 24 hours
        u.pendingState = null;

        // Trigger UI updates
        import('./dashboard-users').then(m => {
            m.updateDetail(u);
            m.updateTaskQueue(u);
        });
        import('./dashboard-modals').then(m => m.renderTaskGallery());
    } catch (err) {
        console.error("FORCE_ACTIVE_FAILED:", err);
    }
}

export function renderGlobalReview(filterRoutine: boolean) {
    activeListFilter = filterRoutine;
    const modal = document.getElementById('listModal');
    const header = document.getElementById('mListHeader');
    const grid = document.getElementById('mListGrid');
    if (!modal || !grid || !header) return;

    let allPending: any[] = [];
    users.forEach(u => {
        if (u.reviewQueue) {
            u.reviewQueue.forEach((t: any) => {
                allPending.push({ ...t, memberId: u.memberId, memberName: u.name });
            });
        }
    });

    const filtered = allPending.filter((t: any) => {
        const isRoutine = t.isRoutine || t.category === 'Routine' || t.text === 'Daily Routine';
        return isRoutine === filterRoutine;
    });

    // Sort by Date (newest first)
    filtered.sort((a, b) => {
        const timeA = a.timestamp || new Date(a.date).getTime() || 0;
        const timeB = b.timestamp || new Date(b.date).getTime() || 0;
        return timeB - timeA;
    });

    const title = filterRoutine ? "DAILY ROUTINE QUEUE" : "TASK REVIEW QUEUE";
    const color = filterRoutine ? "#00ff00" : "var(--gold)";

    header.innerHTML = `
        <div style="font-family:'Orbitron'; font-size:1.5rem; color:${color}; letter-spacing:3px; font-weight:900;">
            ${title}
        </div>
        <div style="font-family:'Rajdhani'; color:#666; font-size:0.9rem; margin-top:5px;">${filtered.length} ITEMS PENDING</div>
    `;

    grid.innerHTML = filtered.map((t: any) => {
        const dateStr = t.timestamp ? new Date(t.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        const isVideo = t.proofType === 'video' || mediaTypeFunction(t.proofUrl) === 'video';
        const optUrl = getOptimizedUrl(t.proofUrl || '', 600);

        return `
            <div class="ops-card ${filterRoutine ? 'routine' : 'task'}" onclick="window.openModById('${t.id}', '${t.memberId}', false)">
                ${isVideo ?
                `<video src="${optUrl}" class="ops-card-bg" autoplay muted loop playsinline></video>` :
                `<img src="${optUrl}" class="ops-card-bg">`}
                <div class="ops-card-overlay">
                    <div class="ops-card-label" style="color:${color}">${filterRoutine ? 'ROUTINE' : 'TASK'}</div>
                    <div class="ops-card-title">${clean(t.memberName)}</div>
                    <div style="font-family:'Rajdhani'; font-size:0.8rem; color:#aaa; letter-spacing:1px;">${dateStr}</div>
                </div>
            </div>`;
    }).join('');

    if (filtered.length === 0) {
        grid.innerHTML = `<div style="width:100%; text-align:center; padding:100px; color:#444; font-family:'Orbitron'; font-size:1.2rem; background:rgba(255,255,255,0.02); border-radius:12px; border:1px dashed #222;">NO PENDING ${filterRoutine ? 'ROUTINES' : 'TASKS'}</div>`;
    }

    modal.classList.add('active');
}

// Redundant local handlers removed in favor of dashboard-users.ts implementations

if (typeof window !== 'undefined') {
    (window as any).closeModal = closeModal;
    (window as any).openModal = openModal;
    (window as any).openModById = openModById;
    (window as any).reviewTask = reviewTask;
    (window as any).openTaskGallery = openTaskGallery;
    (window as any).closeTaskGallery = closeTaskGallery;
    (window as any).openTaskDetail = openTaskDetail;
    (window as any).closeTaskDetail = closeTaskDetail;
    (window as any).setTaskCategory = setTaskCategory;
    (window as any).filterTaskGallery = filterTaskGallery;
    (window as any).pickTask = pickTask;
    (window as any).enforceTask = enforceTask;
    (window as any).removeScheduledTask = removeScheduledTask;
    (window as any).showEnforceOptions = showEnforceOptions;
    (window as any).showForceOptions = showForceOptions;
    (window as any).forceActiveTask = forceActiveTask;
    (window as any).cancelReward = cancelReward;
    (window as any).selectSticker = selectSticker;
    (window as any).handleRewardFileUpload = handleRewardFileUpload;
    (window as any).toggleRewardRecord = toggleRewardRecord;
    (window as any).confirmReward = confirmReward;
    (window as any).renderGlobalReview = renderGlobalReview;
    (window as any).closeListModal = closeListModal;
    (window as any).setRewardTier = setRewardTier;
}

