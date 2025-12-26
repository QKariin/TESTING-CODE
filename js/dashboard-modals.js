// Dashboard Modal Management
// Review modals, task galleries, and modal interactions

import { 
    currTask, pendingApproveTask, selectedStickerId, pendingRewardMedia, 
    messageImg, stickerConfig, availableDailyTasks, currId, users,
    setCurrTask, setPendingApproveTask, setSelectedStickerId, setPendingRewardMedia,
    setMessageImg, mediaRecorder, audioChunks, setMediaRecorder, setAudioChunks,
    ACCOUNT_ID, API_KEY, dragSrcIndex, setDragSrcIndex
} from './dashboard-state.js';
import { getOptimizedUrl, clean, raw } from './dashboard-utils.js';
import { Bridge } from './bridge.js'; 

// --- BIND TO WINDOW IMMEDIATELY (Prevents "Not Defined" errors) ---
window.closeModal = closeModal;
window.openModal = openModal;
window.openModById = openModById;
window.reviewTask = reviewTask;
window.confirmReward = confirmReward;
window.selectSticker = selectSticker;
window.toggleRewardRecord = toggleRewardRecord;
window.handleRewardFileUpload = handleRewardFileUpload;
window.clearRewardMedia = clearRewardMedia;
window.cancelReward = cancelReward;

window.openTaskGallery = openTaskGallery;
window.closeTaskGallery = closeTaskGallery;
window.filterTaskGallery = filterTaskGallery;
window.toggleTaskExpansion = toggleTaskExpansion;
window.enforceDirectiveFromArmory = enforceDirectiveFromArmory;

// --- INTERNAL WORKSHOP CACHE (Prevents 4s shuffle) ---
let workshopFillers = [];
let workshopUserId = null;

// --- 1. CORE REVIEW MODAL LOGIC (UNTOUCHED) ---

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

export function openModal(taskId, memberId, mediaUrl, mediaType, taskText, isHistory = false, status = null) {
    setCurrTask({ id: taskId, memberId: memberId, mediaUrl: mediaUrl, mediaType: mediaType, text: taskText });
    const modal = document.getElementById('reviewModal');
    const mediaBox = document.getElementById('mMediaBox');
    const textEl = document.getElementById('mText');
    const actionsEl = document.getElementById('modalActions');
    if (!modal || !mediaBox || !textEl) return;

    if (mediaUrl) {
        if (mediaType === 'video' || mediaUrl.includes('.mp4')) {
            mediaBox.innerHTML = `<video src="${mediaUrl}" class="m-img" controls muted autoplay loop></video>`;
        } else {
            mediaBox.innerHTML = `<img src="${getOptimizedUrl(mediaUrl, 800)}" class="m-img">`;
        }
    } else {
        mediaBox.innerHTML = `<div style="color:#666; font-family:'Rajdhani';">NO MEDIA</div>`;
    }
    
    textEl.innerHTML = clean(taskText || 'No description provided.');
    
    if (isHistory) {
        actionsEl.innerHTML = status ? `<div class="hist-status st-${status === 'approve' ? 'app' : 'rej'}">${status.toUpperCase()}</div>` : `<button class="btn-main" onclick="closeModal()">CLOSE</button>`;
    } else {
        actionsEl.innerHTML = `<button class="btn-main" onclick="reviewTask('approve')" style="background:var(--green);color:black;">APPROVE</button><button class="btn-main" onclick="reviewTask('reject')" style="background:var(--red);color:white;">REJECT</button>`;
    }
    modal.classList.add('active');
}

export function openModById(taskId, memberId, isHistory) {
    const u = users.find(x => x.memberId === memberId);
    if (!u) return;
    let t = isHistory ? u.history?.find(x => x.id === taskId) : u.reviewQueue?.find(x => x.id === taskId);
    if (t) openModal(taskId, memberId, t.proofUrl, t.proofType, t.text, isHistory, t.status);
}

// --- 2. REWARD & AUDIO LOGIC (UNTOUCHED) ---

export function reviewTask(decision) {
    if (!currTask) return;
    if (decision === 'approve') { openRewardProtocol(); } 
    else {
        window.parent.postMessage({ type: "reviewDecision", memberId: currTask.memberId, taskId: currTask.id, decision: 'reject' }, "*");
        const u = users.find(x => x.memberId === currTask.memberId);
        if (u) u.reviewQueue = u.reviewQueue.filter(x => x.id !== currTask.id);
        import('./dashboard-main.js').then(m => m.renderMainDashboard());
        closeModal();
    }
}

function openRewardProtocol() {
    setPendingApproveTask(currTask);
    setSelectedStickerId(null);
    setPendingRewardMedia(null);
    clearRewardMedia();
    document.getElementById('reviewNormalContent').style.display = 'none';
    document.getElementById('reviewRewardOverlay').style.display = 'flex';
    const grid = document.getElementById('stickerGrid');
    const source = (stickerConfig.length > 0) ? stickerConfig : [{ id: 's10', name: '10 PTS', val: 10, url: '' }];
    grid.innerHTML = source.map(s => `<div class="sticker-card" id="stk_${s.id}" onclick="selectSticker('${s.id}', ${s.val})">${s.url ? `<img src="${getOptimizedUrl(s.url, 100)}" class="stk-img">` : `IMG`}<div class="stk-name">${s.name}</div><div class="stk-val">+${s.val}</div></div>`).join('');
    document.getElementById('rewardBonus').value = 50;
    document.getElementById('rewardComment').value = "";
}

export function cancelReward() { document.getElementById('reviewNormalContent').style.display = 'flex'; document.getElementById('reviewRewardOverlay').style.display = 'none'; }

export function selectSticker(id, val) {
    setSelectedStickerId(id);
    document.querySelectorAll('.sticker-card').forEach(el => el.classList.remove('selected'));
    const target = document.getElementById('stk_' + id);
    if (target) target.classList.add('selected');
    document.getElementById('rewardBonus').value = 50 + val;
}

export async function handleRewardFileUpload(input) {
    if (input.files?.[0]) {
        const file = input.files[0], fd = new FormData();
        fd.append("file", file);
        try {
            const res = await fetch(`https://api.bytescale.com/v2/accounts/${ACCOUNT_ID}/uploads/form_data?path=/rewards`, { method: "POST", headers: { "Authorization": `Bearer ${API_KEY}` }, body: fd });
            const d = await res.json();
            if (d.files?.[0]) {
                let url = d.files[0].fileUrl;
                if (file.type.startsWith('video')) url += "#.mp4";
                setPendingRewardMedia({ url: url, type: file.type });
                showRewardPreview(url, file.type);
            }
        } catch (err) { console.error(err); }
    }
}

export function toggleRewardRecord() {
    const btn = document.getElementById("btnRecordReward");
    if (mediaRecorder?.state === "recording") { mediaRecorder.stop(); btn.classList.remove("recording"); } 
    else {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            const recorder = new MediaRecorder(stream);
            setMediaRecorder(recorder); recorder.start(); btn.classList.add("recording"); setAudioChunks([]);
            recorder.ondataavailable = e => setAudioChunks([...audioChunks, e.data]);
            recorder.onstop = async () => {
                const blob = new Blob(audioChunks, { type: "audio/mp3" }), fd = new FormData();
                fd.append("file", blob);
                const res = await fetch(`https://api.bytescale.com/v2/accounts/${ACCOUNT_ID}/uploads/form_data?path=/rewards/audio`, { method: "POST", headers: { "Authorization": `Bearer ${API_KEY}` }, body: fd });
                const d = await res.json();
                if (d.files?.[0]) { const url = d.files[0].fileUrl + "#.mp3"; setPendingRewardMedia({ url: url, type: "audio" }); showRewardPreview(url, "audio"); }
            };
        });
    }
}

function showRewardPreview(url, type) {
    const box = document.getElementById('rewardMediaPreview');
    if (box) {
        box.classList.remove('d-none');
        box.innerHTML = (type === 'video' || url.includes('.mp4')) ? `<video src="${url}" muted autoplay loop></video>` : `<img src="${url}">`;
        box.innerHTML += `<span onclick="clearRewardMedia()" style="position:absolute;top:0;right:0;background:black;cursor:pointer;padding:0 4px;">X</span>`;
    }
}

export function clearRewardMedia() { setPendingRewardMedia(null); const box = document.getElementById('rewardMediaPreview'); if (box) box.classList.add('d-none'); }

export function confirmReward() {
    if (!pendingApproveTask) return;
    let bonus = parseInt(document.getElementById('rewardBonus').value) || 50;
    const comment = document.getElementById('rewardComment').value.trim();
    let finalImage = selectedStickerId ? stickerConfig.find(s => s.id === selectedStickerId)?.url : (messageImg || null);
    window.parent.postMessage({ type: "reviewDecision", memberId: pendingApproveTask.memberId, taskId: pendingApproveTask.id, decision: 'approve', bonusCoins: bonus, sticker: finalImage, comment: comment, media: pendingRewardMedia?.url }, "*");
    closeModal();
}

// --- 3. DIRECTIVE WORKSHOP (THE MIRROR LOGIC) ---

export function openTaskGallery() {
    const u = users.find(x => x.memberId === currId);
    if (!u) return;

    // Header Sync: [SLAVE NAME] TASKS
    const titleEl = document.getElementById('armoryTitle');
    if (titleEl) titleEl.innerText = `${u.name.toUpperCase()} TASKS`;

    renderWorkshopLiveQueue(u);
    renderWorkshopLibrary(availableDailyTasks);

    document.getElementById('taskGalleryModal').classList.add('active');
}

function renderWorkshopLiveQueue(u) {
    const list = document.getElementById('armoryLiveQueue');
    if (!list) return;

    let personal = u.taskQueue || [];
    
    // Stability cache check
    if (u.memberId !== workshopUserId) {
        workshopUserId = u.memberId;
        workshopFillers = availableDailyTasks.filter(t => !personal.includes(t)).sort(() => 0.5 - Math.random());
    }

    let fillers = workshopFillers.slice(0, 10 - personal.length);
    let fullList = [...personal, ...fillers];

    list.innerHTML = fullList.map((t, i) => createMirroredCard(t, i, i < personal.length)).join('');
}

function renderWorkshopLibrary(tasks) {
    const grid = document.getElementById('glassTaskGrid');
    if (!grid) return;
    grid.innerHTML = tasks.map((t, i) => createMirroredCard(t, i, false, true)).join('');
}

export function filterTaskGallery() {
    const q = document.getElementById('taskSearchInput')?.value.toLowerCase() || "";
    const filtered = availableDailyTasks.filter(t => (typeof t === 'string' ? t : (t.text || "")).toLowerCase().includes(q));
    renderWorkshopLibrary(filtered);
}

function createMirroredCard(task, index, isActiveOrder, isLibrary = false) {
    const niceText = clean(task);
    const safeText = raw(niceText);
    const num = (index + 1).toString().padStart(2, '0');
    
    return `
        <div class="mirror-card ${isActiveOrder ? 'direct-order' : (isLibrary ? '' : 'filler-task')}">
            <div class="mirror-icon">${isActiveOrder ? '★' : '⚡'}</div>
            
            <div class="dr-text-wrapper">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                    <span style="font-size:0.6rem; font-weight:900; color:#444;">SLOT ${num}</span>
                    ${isActiveOrder ? `<span class="q-tag">QUEEN ORDER</span>` : ''}
                </div>
                <div class="dr-serif-text">${niceText}</div>
                ${isLibrary ? `<div class="dr-armory-btn" onclick="enforceDirectiveFromArmory(this, '${safeText}')">ENFORCE DIRECTIVE</div>` : ''}
            </div>

            <div class="dr-mirror-arrow" onclick="event.stopPropagation(); toggleTaskExpansion(this)">▼</div>
        </div>`;
}

export function toggleTaskExpansion(btn) {
    const row = btn.closest('.mirror-card');
    if (row) row.classList.toggle('is-expanded');
}

export function enforceDirectiveFromArmory(element, text) {
    const u = users.find(x => x.memberId === currId);
    if (!u) return;

    if (u.taskQueue && u.taskQueue.length >= 10) {
        alert("Slave capacity reached. Remove an order first.");
        return;
    }

    if (!u.taskQueue) u.taskQueue = [];
    u.taskQueue.unshift(text); // Priority #1 slot

    element.innerText = "TRANSMITTING...";
    element.style.background = "var(--pink)";

    syncTaskChanges(u);
    setTimeout(() => { renderWorkshopLiveQueue(u); }, 400);
}

export function closeTaskGallery() { document.getElementById('taskGalleryModal').classList.remove('active'); }

// --- 4. SYNC & DRAG LOGIC ---

function syncTaskChanges(user) {
    window.parent.postMessage({ type: "updateTaskQueue", memberId: user.memberId, queue: user.taskQueue }, "*");
    Bridge.send("updateTaskQueue", { memberId: user.memberId, queue: user.taskQueue });
    import('./dashboard-users.js').then(m => m.updateDetail(user));
}

export function handleDragStart(e, idx) { setDragSrcIndex(idx); e.dataTransfer.effectAllowed = 'move'; e.target.style.opacity = '0.4'; }
export function handleDragOver(e) { e.preventDefault(); return false; }
export function handleDragEnd(e) { e.target.style.opacity = '1'; }
export function handleDrop(e, dropIndex) {
    if (e.stopPropagation) e.stopPropagation();
    if (dragSrcIndex === null || dragSrcIndex === dropIndex) return false;
    const u = users.find(x => x.memberId === currId);
    if (u?.taskQueue) {
        const item = u.taskQueue[dragSrcIndex];
        u.taskQueue.splice(dragSrcIndex, 1);
        u.taskQueue.splice(dropIndex, 0, item);
        syncTaskChanges(u);
        renderWorkshopLiveQueue(u);
    }
    return false;
}
