// src/scripts/dashboard-modals.ts
// Dashboard Modal Management - Converted to TypeScript

import {
    currTask, pendingApproveTask, selectedStickerId, pendingRewardMedia,
    stickerConfig, availableDailyTasks, currId, users,
    setCurrTask, setPendingApproveTask, setSelectedStickerId, setPendingRewardMedia,
    setMediaRecorder, setAudioChunks, mediaRecorder, audioChunks,
    ACCOUNT_ID, API_KEY, setDragSrcIndex, dragSrcIndex,
    armoryTarget, setArmoryTarget
} from './dashboard-state';
import { clean, raw, getOptimizedUrl } from './utils';
import { mediaType as mediaTypeFunction, getSignedUrl } from './media';
import { DbService } from '@/lib/supabase-service';

let pendingDirectiveText = "";
let workshopFillers: any[] = [];
let workshopUserId: string | null = null;
const workshopExpandedTexts = new Set<string>();

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
            mediaBox.innerHTML = `<img src="${mediaUrl}" class="m-img">`;
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
    if (!currTask) return;
    if (decision === 'approve') {
        openRewardProtocol();
    } else {
        console.log("Task rejected:", currTask.id);
        DbService.rejectTask(currTask.id!, currTask.memberId!)
            .then(() => {
                const u = users.find(x => x.memberId === currTask.memberId);
                if (u) u.reviewQueue = u.reviewQueue.filter((x: any) => x.id !== currTask.id);
                import('./dashboard-main').then(m => m.renderMainDashboard());
                closeModal();
            })
            .catch(err => console.error("Rejection error:", err));
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

    const bonusInp = document.getElementById('rewardBonus') as HTMLInputElement;
    if (bonusInp) bonusInp.value = "50";
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
    const bonusInp = document.getElementById('rewardBonus') as HTMLInputElement;
    if (bonusInp) bonusInp.value = (50 + val).toString();
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
    if (!pendingApproveTask) return;
    const bonusInp = document.getElementById('rewardBonus') as HTMLInputElement;
    const commentInp = document.getElementById('rewardComment') as HTMLInputElement;
    const bonus = parseInt(bonusInp?.value) || 50;
    const comment = commentInp?.value.trim();

    DbService.approveTask(pendingApproveTask.id!, pendingApproveTask.memberId!, bonus, null, comment)
        .then(() => {
            const u = users.find(x => x.memberId === pendingApproveTask.memberId);
            if (u) u.reviewQueue = u.reviewQueue.filter((x: any) => x.id !== pendingApproveTask.id);
            import('./dashboard-main').then(m => m.renderMainDashboard());
            closeModal();
        })
        .catch(err => console.error("Approval error:", err));
}

export function openTaskGallery() {
    const u = users.find(x => x.memberId === currId);
    if (!u) return;
    const titleEl = document.getElementById('armoryTitle');
    if (titleEl) titleEl.innerText = `${u.name.toUpperCase()} TASKS`;
    const gallery = document.getElementById('taskGalleryModal');
    if (gallery) gallery.classList.add('active');
}

export function closeTaskGallery() {
    const gallery = document.getElementById('taskGalleryModal');
    if (gallery) gallery.classList.remove('active');
}

export function filterTaskGallery() {
    console.log("Filtering task gallery");
}

export function addQueueTask() {
    console.log("Adding task to queue");
}

export function deleteQueueItem(id: string) {
    console.log("Deleting queue item:", id);
}

if (typeof window !== 'undefined') {
    (window as any).closeModal = closeModal;
    (window as any).openModal = openModal;
    (window as any).openModById = openModById;
    (window as any).reviewTask = reviewTask;
    (window as any).openTaskGallery = openTaskGallery;
    (window as any).closeTaskGallery = closeTaskGallery;
    (window as any).filterTaskGallery = filterTaskGallery;
    (window as any).addQueueTask = addQueueTask;
    (window as any).deleteQueueItem = deleteQueueItem;
    (window as any).cancelReward = cancelReward;
    (window as any).selectSticker = selectSticker;
    (window as any).handleRewardFileUpload = handleRewardFileUpload;
    (window as any).toggleRewardRecord = toggleRewardRecord;
    (window as any).confirmReward = confirmReward;
}

