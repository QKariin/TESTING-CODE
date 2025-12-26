// Dashboard Modal Management
// Review modals, task galleries, and modal interactions

import { 
    currTask, pendingApproveTask, selectedStickerId, pendingRewardMedia, 
    messageImg, stickerConfig, availableDailyTasks, currId, users,
    setCurrTask, setPendingApproveTask, setSelectedStickerId, setPendingRewardMedia,
    setMessageImg, mediaRecorder, audioChunks, setMediaRecorder, setAudioChunks,
    ACCOUNT_ID, API_KEY, setDragSrcIndex, dragSrcIndex
} from './dashboard-state.js'; 
import { getOptimizedUrl, clean, raw } from './dashboard-utils.js';
import { Bridge } from './bridge.js'; 

// --- 1. CORE MODAL LOGIC (FIXED DUPLICATES) ---

export function closeModal() {
    const modal = document.getElementById('reviewModal');
    if (!modal) return;
    modal.classList.remove('active');
    
    // Reset the UI inside the modal
    const normalContent = document.getElementById('reviewNormalContent');
    const rewardOverlay = document.getElementById('reviewRewardOverlay');
    if (normalContent) normalContent.style.display = 'flex';
    if (rewardOverlay) rewardOverlay.style.display = 'none';
    
    // Reset reward state
    setPendingApproveTask(null);
    setSelectedStickerId(null);
    setPendingRewardMedia(null);
    if (typeof clearRewardMedia === 'function') clearRewardMedia();
}

export function openModal(taskId, memberId, mediaUrl, mediaType, taskText, isHistory = false, status = null) {
    setCurrTask({ id: taskId, memberId: memberId, mediaUrl: mediaUrl, mediaType: mediaType, text: taskText });
    
    const modal = document.getElementById('reviewModal');
    const mediaBox = document.getElementById('mMediaBox');
    const textEl = document.getElementById('mText');
    const actionsEl = document.getElementById('modalActions');
    
    if (!modal || !mediaBox || !textEl) return;

    // Set media
    if (mediaUrl) {
        if (mediaType === 'video' || mediaUrl.includes('.mp4') || mediaUrl.includes('.mov')) {
            mediaBox.innerHTML = `<video src="${mediaUrl}" class="m-img" controls muted autoplay loop></video>`;
        } else if (mediaType === 'image' || mediaUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            mediaBox.innerHTML = `<img src="${getOptimizedUrl(mediaUrl, 800)}" class="m-img">`;
        } else {
            mediaBox.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;font-family:'Rajdhani';">NO MEDIA</div>`;
        }
    } else {
        mediaBox.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;font-family:'Rajdhani';">TEXT ONLY</div>`;
    }
    
    // Set text
    textEl.innerHTML = clean(taskText || 'No description provided.');
    
    // Set actions based on context
    if (isHistory) {
        if (status) {
            actionsEl.innerHTML = `<div class="hist-status st-${status === 'approve' ? 'app' : status === 'reject' ? 'rej' : 'skip'}">${status.toUpperCase()}</div>`;
        } else {
            actionsEl.innerHTML = `<button class="btn-main" onclick="closeModal()" style="background:#666;color:white;">CLOSE</button>`;
        }
    } else {
        actionsEl.innerHTML = `
            <button class="btn-main" onclick="reviewTask('approve')" style="background:var(--green);color:black;">APPROVE</button>
            <button class="btn-main" onclick="reviewTask('reject')" style="background:var(--red);color:white;">REJECT</button>
        `;
    }
    
    modal.classList.add('active');
}

export function openModById(taskId, memberId, isHistory) {
    const u = users.find(x => x.memberId === memberId);
    if (!u) return;
    
    let task = isHistory ? u.history?.find(t => t.id === taskId) : u.reviewQueue?.find(t => t.id === taskId);
    
    if (task) {
        openModal(taskId, memberId, task.proofUrl, task.proofType, task.text, isHistory, task.status);
    }
}

// --- 2. REWARD & AUDIO LOGIC (UNTOUCHED) ---

export function reviewTask(decision) {
    if (!currTask) return;
    
    if (decision === 'approve') {
        openRewardProtocol();
    } else {
        window.parent.postMessage({ type: "reviewDecision", memberId: currTask.memberId, taskId: currTask.id, decision: 'reject' }, "*");
        const u = users.find(x => x.memberId === currTask.memberId);
        if (u) { u.reviewQueue = u.reviewQueue.filter(x => x.id !== currTask.id); }
        import('./dashboard-main.js').then(({ renderMainDashboard }) => { renderMainDashboard(); });
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
    const source = (stickerConfig.length > 0) ? stickerConfig : [{ id: 's10', name: '10 PTS', val: 10, url: '' }, { id: 's20', name: '20 PTS', val: 20, url: '' }];
    
    grid.innerHTML = source.map(s => `
        <div class="sticker-card" id="stk_${s.id}" onclick="selectSticker('${s.id}', ${s.val})">
            ${s.url ? `<img src="${getOptimizedUrl(s.url, 100)}" class="stk-img">` : `<div style="font-size:1.5rem; color:#666; height:60px; display:flex; align-items:center;">IMG</div>`}
            <div class="stk-name">${s.name}</div>
            <div class="stk-val">+${s.val}</div>
        </div>`).join('');
    document.getElementById('rewardBonus').value = 50;
    document.getElementById('rewardComment').value = "";
}

export function cancelReward() {
    document.getElementById('reviewNormalContent').style.display = 'flex';
    document.getElementById('reviewRewardOverlay').style.display = 'none';
}

export function selectSticker(id, val) {
    setSelectedStickerId(id);
    document.querySelectorAll('.sticker-card').forEach(el => el.classList.remove('selected'));
    document.getElementById('stk_' + id).classList.add('selected');
    document.getElementById('rewardBonus').value = 50 + val;
}

export async function handleRewardFileUpload(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0], fd = new FormData();
        fd.append("file", file);
        try {
            const res = await fetch(`https://api.bytescale.com/v2/accounts/${ACCOUNT_ID}/uploads/form_data?path=/rewards`, { method: "POST", headers: { "Authorization": `Bearer ${API_KEY}` }, body: fd });
            if (!res.ok) return;
            const d = await res.json();
            if (d.files && d.files[0]) {
                let url = d.files[0].fileUrl;
                if (file.type.startsWith('video') || file.name.match(/\.(mp4|mov)$/i)) { url += "#.mp4"; }
                setPendingRewardMedia({ url: url, type: file.type });
                showRewardPreview(url, file.type);
            }
        } catch (err) { console.error(err); }
    }
}

export function toggleRewardRecord() {
    const btn = document.getElementById("btnRecordReward");
    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        btn.classList.remove("recording");
    } else {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            const recorder = new MediaRecorder(stream);
            setMediaRecorder(recorder);
            recorder.start();
            btn.classList.add("recording");
            setAudioChunks([]);
            recorder.ondataavailable = e => setAudioChunks([...audioChunks, e.data]);
            recorder.onstop = async () => {
                const blob = new Blob(audioChunks, { type: "audio/mp3" }), fd = new FormData();
                fd.append("file", blob);
                try {
                    const res = await fetch(`https://api.bytescale.com/v2/accounts/${ACCOUNT_ID}/uploads/form_data?path=/rewards/audio`, { method: "POST", headers: { "Authorization": `Bearer ${API_KEY}` }, body: fd });
                    const d = await res.json();
                    if (d.files && d.files[0]) {
                        const url = d.files[0].fileUrl + "#.mp3";
                        setPendingRewardMedia({ url: url, type: "audio" });
                        showRewardPreview(url, "audio");
                    }
                } catch (err) { console.error(err); }
            };
        });
    }
}

function showRewardPreview(url, type) {
    const box = document.getElementById('rewardMediaPreview');
    box.classList.remove('d-none');
    box.innerHTML = (type === 'video' || url.includes('.mp4')) ? `<video src="${url}" muted autoplay loop></video>` : `<img src="${url}">`;
    box.innerHTML += `<span onclick="clearRewardMedia()" style="position:absolute;top:0;right:0;background:black;color:white;cursor:pointer;padding:0 4px;font-size:10px;">X</span>`;
}

export function clearRewardMedia() {
    setPendingRewardMedia(null);
    const box = document.getElementById('rewardMediaPreview');
    if (box) box.classList.add('d-none');
}

export function confirmReward() {
    if (!pendingApproveTask) return;
    let bonus = parseInt(document.getElementById('rewardBonus').value) || 50;
    const comment = document.getElementById('rewardComment').value.trim();
    let finalImage = selectedStickerId ? stickerConfig.find(s => s.id === selectedStickerId)?.url : (messageImg || null);
    window.parent.postMessage({ type: "reviewDecision", memberId: pendingApproveTask.memberId, taskId: pendingApproveTask.id, decision: 'approve', bonusCoins: bonus, sticker: finalImage, comment: comment, media: pendingRewardMedia?.url }, "*");
    const u = users.find(x => x.memberId === pendingApproveTask.memberId);
    if (u) { u.reviewQueue = u.reviewQueue.filter(x => x.id !== pendingApproveTask.id); }
    import('./dashboard-main.js').then(({ renderMainDashboard }) => { renderMainDashboard(); });
    closeModal();
}

// --- 3. COMMAND ARMORY (QUEEN QUEUE LOGIC - STEP 6) ---

export function openTaskGallery() {
    const grid = document.getElementById('glassTaskGrid');
    if (!grid) return;
    const searchInp = document.getElementById('taskSearchInput');
    if (searchInp) searchInp.value = "";
    renderArmoryGrid(availableDailyTasks);
    document.getElementById('taskGalleryModal').classList.add('active');
}

export function filterTaskGallery() {
    const query = document.getElementById('taskSearchInput')?.value.toLowerCase() || "";
    const filtered = availableDailyTasks.filter(task => (typeof task === 'string' ? task : (task.text || "")).toLowerCase().includes(query));
    renderArmoryGrid(filtered);
}

function renderArmoryGrid(tasks) {
    const grid = document.getElementById('glassTaskGrid');
    if (!grid) return;
    if (tasks.length === 0) { grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;color:#444;">NO DIRECTIVES MATCHED</div>`; return; }

    grid.innerHTML = tasks.map(t => {
        const niceText = clean(t), safeText = raw(niceText);
        return `<div class="armory-item" onclick="enforceDirective(this, '${safeText}')"><div class="armory-text">${niceText}</div></div>`;
    }).join('');
}

window.enforceDirective = function(element, text) {
    const u = users.find(x => x.memberId === currId);
    if (!u) return;

    // CAPACITY GUARD (Limit 10)
    if (u.taskQueue && u.taskQueue.length >= 10) {
        element.style.borderColor = "var(--red)";
        const old = element.innerHTML;
        element.innerHTML = `<div style="color:var(--red); font-size:0.6rem; font-weight:900;">CAPACITY REACHED</div>`;
        setTimeout(() => { element.style.borderColor = ""; element.innerHTML = old; }, 2000);
        return;
    }

    // PRIORITY #1 LOGIC (unshift)
    if (!u.taskQueue) u.taskQueue = [];
    u.taskQueue.unshift(text);

    // FEEDBACK
    element.style.borderColor = "var(--blue)";
    element.innerHTML = `<div style="color:var(--blue); font-weight:900; letter-spacing:2px; font-size:0.7rem;">TRANSMITTING...</div>`;

    syncTaskChanges(u);
    setTimeout(() => { closeTaskGallery(); }, 600);
};

export function closeTaskGallery() { document.getElementById('taskGalleryModal').classList.remove('active'); }

// --- 4. DRAG & DROP LOGIC ---

export function handleDragStart(e, idx) { setDragSrcIndex(idx); e.dataTransfer.effectAllowed = 'move'; e.target.style.opacity = '0.4'; }
export function handleDragOver(e) { if (e.preventDefault) e.preventDefault(); e.dataTransfer.dropEffect = 'move'; return false; }
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
    }
    return false;
}

function syncTaskChanges(user) {
    window.parent.postMessage({ type: "updateTaskQueue", memberId: user.memberId, queue: user.taskQueue }, "*");
    Bridge.send("updateTaskQueue", { memberId: user.memberId, queue: user.taskQueue });
    import('./dashboard-users.js').then(({ updateDetail }) => { updateDetail(user); });
}

// Bindings
window.openModal = openModal;
window.openModById = openModById;
window.closeModal = closeModal;
window.reviewTask = reviewTask;
window.cancelReward = cancelReward;
window.selectSticker = selectSticker;
window.handleRewardFileUpload = handleRewardFileUpload;
window.toggleRewardRecord = toggleRewardRecord;
window.clearRewardMedia = clearRewardMedia;
window.confirmReward = confirmReward;
window.openTaskGallery = openTaskGallery;
window.closeTaskGallery = closeTaskGallery;
window.filterTaskGallery = filterTaskGallery;
window.handleDragStart = handleDragStart;
window.handleDragOver = handleDragOver;
window.handleDragEnd = handleDragEnd;
window.handleDrop = handleDrop;
