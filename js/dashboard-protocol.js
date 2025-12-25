// Dashboard Protocol Management
// Silence Protocol, exclusions, and broadcast functionality

import { 
    excludedIds, broadcastExclusions, protocolActive, protocolGoal, 
    protocolProgress, newbieImmunity, users, broadcastMedia, broadcastPresets,
    setExcludedIds, setBroadcastExclusions, setProtocolActive, setProtocolGoal,
    setProtocolProgress, setNewbieImmunity, setBroadcastMedia, setBroadcastPresets,
    ACCOUNT_ID, API_KEY
} from './dashboard-state.js';

export function toggleProtocol() {
    const btn = document.getElementById('pdBtn');
    const controls = document.getElementById('pdControls');
    const progress = document.getElementById('pdProgress');
    
    if (!protocolActive) {
        // Start protocol
        setProtocolActive(true);
        setProtocolGoal(parseInt(document.getElementById('pdGoal').value) || 1000);
        setProtocolProgress(0);
        
        btn.innerText = 'ACTIVE';
        btn.classList.remove('engage');
        btn.classList.add('active-btn');
        
        controls.style.display = 'none';
        progress.style.display = 'flex';
        
        updateProtocolProgress();
        
        // Send to backend
        window.parent.postMessage({ 
            type: "startProtocol", 
            goal: protocolGoal,
            excludedIds: excludedIds,
            newbieImmunity: newbieImmunity
        }, "*");
        
    } else {
        // Stop protocol
        setProtocolActive(false);
        
        btn.innerText = 'ENGAGE';
        btn.classList.remove('active-btn');
        btn.classList.add('engage');
        
        controls.style.display = 'flex';
        progress.style.display = 'none';
        
        // Send to backend
        window.parent.postMessage({ type: "stopProtocol" }, "*");
    }
}

export function updateProtocolProgress() {
    if (!protocolActive) return;
    
    const fill = document.getElementById('pdFill');
    const text = document.getElementById('pdText');
    
    if (fill && text) {
        const percentage = Math.min(100, (protocolProgress / protocolGoal) * 100);
        fill.style.width = percentage + '%';
        text.innerText = `${protocolProgress} / ${protocolGoal} COINS COLLECTED`;
        
        if (protocolProgress >= protocolGoal) {
            // Protocol completed
            toggleProtocol();
            window.parent.postMessage({ type: "protocolCompleted" }, "*");
        }
    }
}

export function toggleNewbieImmunity() {
    setNewbieImmunity(!newbieImmunity);
    const checkbox = document.getElementById('pdImmunity');
    if (checkbox) {
        if (newbieImmunity) {
            checkbox.classList.add('checked');
        } else {
            checkbox.classList.remove('checked');
        }
    }
}

export function openExclusionModal() {
    const list = document.getElementById('exclusionList');
    if (!list) return;
    
    list.innerHTML = users.map(u => {
        const isEx = excludedIds.includes(u.memberId);
        return `
            <div class="ex-item ${isEx ? 'selected' : ''}" onclick="toggleExclusion('${u.memberId}')">
                <div class="ex-check">${isEx ? '✕' : ''}</div>
                <span style="font-family:'Rajdhani'; font-weight:bold; color:white;">${u.name}</span>
            </div>
        `;
    }).join('');
    
    document.getElementById('exclusionModal').classList.add('active');
}

export function closeExclusionModal() {
    document.getElementById('exclusionModal').classList.remove('active');
}

export function toggleExclusion(id) {
    if (excludedIds.includes(id)) {
        setExcludedIds(excludedIds.filter(x => x !== id));
    } else {
        setExcludedIds([...excludedIds, id]);
    }
    openExclusionModal(); // Refresh the list
}

export function openBroadcastModal() {
    setBroadcastExclusions([]);
    renderBrUserList();
    document.getElementById('broadcastModal').classList.add('active');
}

export function renderBrUserList() {
    const list = document.getElementById('brUserList');
    if (!list) return;
    
    list.innerHTML = users.map(u => {
        const isEx = broadcastExclusions.includes(u.memberId);
        return `
            <div class="ex-item ${isEx ? 'selected' : ''}" onclick="toggleBrExclusion('${u.memberId}')">
                <div class="ex-check">${isEx ? '✕' : ''}</div>
                <span style="font-family:'Rajdhani'; font-weight:bold; color:white;">${u.name}</span>
            </div>
        `;
    }).join('');
}

export function toggleBrExclusion(id) {
    if (broadcastExclusions.includes(id)) {
        setBroadcastExclusions(broadcastExclusions.filter(x => x !== id));
    } else {
        setBroadcastExclusions([...broadcastExclusions, id]);
    }
    renderBrUserList();
}

export function closeBroadcastModal() {
    document.getElementById('broadcastModal').classList.remove('active');
    document.getElementById('brText').value = "";
    document.getElementById('brFile').value = "";
    document.getElementById('brPreviewImg').style.display = 'none';
    document.getElementById('brPreviewVid').style.display = 'none';
    setBroadcastMedia(null);
    document.getElementById('presetList').style.display = 'none';
}

export async function handleBroadcastFile(input) {
    if (input.files[0]) {
        const file = input.files[0];
        const isVideo = file.type.startsWith('video') || file.name.match(/\.(mp4|mov)$/i);
        const fd = new FormData();
        fd.append("file", file);

        try {
            const res = await fetch(
                `https://api.bytescale.com/v2/accounts/${ACCOUNT_ID}/uploads/form_data?path=/broadcasts`, 
                { method: "POST", headers: { "Authorization": `Bearer ${API_KEY}` }, body: fd }
            );
            
            if (!res.ok) return;
            const d = await res.json();
            
            if (d.files && d.files[0]) {
                let media = d.files[0].fileUrl;
                if (isVideo) media += "#.mp4";
                setBroadcastMedia(media);

                if (isVideo) {
                    const v = document.getElementById('brPreviewVid');
                    v.src = media;
                    v.style.display = 'block';
                    document.getElementById('brPreviewImg').style.display = 'none';
                } else {
                    const i = document.getElementById('brPreviewImg');
                    i.src = media;
                    i.style.display = 'block';
                    document.getElementById('brPreviewVid').style.display = 'none';
                }
            }
        } catch (e) {
            console.error('Broadcast file upload error:', e);
        }
    }
}

export function sendBroadcast() {
    const text = document.getElementById('brText').value.trim();
    
    if (!text && !broadcastMedia) {
        alert("Please enter a message or upload media!");
        return;
    }
    
    const targetUsers = users.filter(u => !broadcastExclusions.includes(u.memberId));
    
    window.parent.postMessage({ 
        type: "sendBroadcast",
        message: text,
        media: broadcastMedia,
        targetUsers: targetUsers.map(u => u.memberId)
    }, "*");
    
    closeBroadcastModal();
    alert(`Broadcast sent to ${targetUsers.length} users!`);
}

export function saveBroadcastPreset() {
    const txt = document.getElementById('brText').value;
    if (!txt && !broadcastMedia) {
        alert("Nothing to save!");
        return;
    }
    
    window.parent.postMessage({ 
        type: "saveToCMS", 
        collection: "BROADCAST", 
        payload: { planedt: txt, planedm: broadcastMedia } 
    }, "*");
    
    setBroadcastPresets([...broadcastPresets, { planedt: txt, planedm: broadcastMedia }]);
    alert("Saved to Presets!");
}

export function togglePresets() {
    const list = document.getElementById('presetList');
    if (!list) return;
    
    if (list.style.display === 'none') {
        list.style.display = 'flex';
        renderPresetList();
    } else {
        list.style.display = 'none';
    }
}

function renderPresetList() {
    const list = document.getElementById('presetList');
    if (!list) return;
    
    list.innerHTML = broadcastPresets.map((preset, i) => `
        <div class="preset-item" onclick="loadPreset(${i})">
            ${preset.planedm ? `<img src="${preset.planedm}" class="preset-img">` : '<div class="preset-img" style="background:#333;"></div>'}
            <div class="preset-txt">${preset.planedt || 'No text'}</div>
        </div>
    `).join('');
}

export function loadPreset(index) {
    const preset = broadcastPresets[index];
    if (!preset) return;
    
    if (preset.planedt) {
        document.getElementById('brText').value = preset.planedt;
    }
    
    if (preset.planedm) {
        setBroadcastMedia(preset.planedm);
        const isVideo = preset.planedm.includes('.mp4') || preset.planedm.includes('.mov');
        
        if (isVideo) {
            const v = document.getElementById('brPreviewVid');
            v.src = preset.planedm;
            v.style.display = 'block';
            document.getElementById('brPreviewImg').style.display = 'none';
        } else {
            const i = document.getElementById('brPreviewImg');
            i.src = preset.planedm;
            i.style.display = 'block';
            document.getElementById('brPreviewVid').style.display = 'none';
        }
    }
    
    togglePresets();
}

// Make functions available globally
window.toggleProtocol = toggleProtocol;
window.toggleNewbieImmunity = toggleNewbieImmunity;
window.openExclusionModal = openExclusionModal;
window.closeExclusionModal = closeExclusionModal;
window.toggleExclusion = toggleExclusion;
window.openBroadcastModal = openBroadcastModal;
window.closeBroadcastModal = closeBroadcastModal;
window.toggleBrExclusion = toggleBrExclusion;
window.handleBroadcastFile = handleBroadcastFile;
window.sendBroadcast = sendBroadcast;
window.saveBroadcastPreset = saveBroadcastPreset;
window.togglePresets = togglePresets;
window.loadPreset = loadPreset;
