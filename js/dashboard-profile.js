// Dashboard Profile Management
// Queen profile rendering, content management, and uploads

import { 
    queenContent, profileMedia, users,
    setQueenContent, setProfileMedia, ACCOUNT_ID, API_KEY
} from './dashboard-state.js';
import { getOptimizedUrl, raw } from './dashboard-utils.js';

export function renderProfile() {
    const storiesList = queenContent.filter(item => item.stories);
    const gridList = queenContent.filter(item => item.page);
    const writingList = queenContent.filter(item => item.post);

    document.getElementById('cntPosts').innerText = gridList.length;
    document.getElementById('cntSubs').innerText = users.length;
    document.getElementById('cntStories').innerText = storiesList.length;

    renderStoryRail(storiesList);
    renderMediaGrid(gridList);
    renderTextGrid(writingList);
}

function renderStoryRail(storiesList) {
    const rail = document.getElementById('storyRail');
    if (!rail) return;
    
    let html = `<div class="story-ring story-add" onclick="openProfileUpload(true)">+</div>`;
    
    html += storiesList.map((s, i) => `
        <div class="story-ring" onclick="openMod(null,null,'${s.stories}','image','STORY VIEW',true,'STORY')">
            <img src="${getOptimizedUrl(s.stories, 100)}" class="story-img">
        </div>
    `).join('');
    
    rail.innerHTML = html;
}

function renderMediaGrid(gridList) {
    const grid = document.getElementById('profileMediaGrid');
    if (!grid) return;
    
    grid.innerHTML = gridList.map((p, i) => {
        let isVid = p.page && (p.page.endsWith('.mp4') || p.page.endsWith('.mov'));
        return `
            <div class="mg-item" onclick="openMod(null,null,'${p.page}','${isVid?'video':'image'}','${raw(p.post||'')}',true,'POST')">
                ${isVid ? 
                    `<video src="${p.page}"></video>` : 
                    `<img src="${getOptimizedUrl(p.page, 400)}">`
                }
                <div class="mg-type">${isVid ? 'VID' : 'IMG'}</div>
            </div>
        `;
    }).join('');
}

function renderTextGrid(writingList) {
    const txtGrid = document.getElementById('profileTextGrid');
    if (!txtGrid) return;
    
    txtGrid.innerHTML = writingList.map(p => `
        <div class="tg-card">
            <div class="tg-date">${p._createdDate ? new Date(p._createdDate).toLocaleString() : 'Just now'}</div>
            <div class="tg-body">${p.post}</div>
        </div>
    `).join('');
}

export function switchProfileTab(tab) {
    document.querySelectorAll('.qp-tab').forEach(t => t.classList.remove('active'));
    
    if (tab === 'media') {
        document.querySelectorAll('.qp-tab')[0].classList.add('active');
        document.getElementById('profileMediaGrid').classList.remove('d-none');
        document.getElementById('profileTextGrid').classList.add('d-none');
    } else {
        document.querySelectorAll('.qp-tab')[1].classList.add('active');
        document.getElementById('profileMediaGrid').classList.add('d-none');
        document.getElementById('profileTextGrid').classList.remove('d-none');
    }
}

export function openProfileUpload(isStory = false) {
    document.getElementById('profileUploadModal').classList.add('active');
    const sel = document.getElementById('puType');
    sel.value = isStory ? 'story' : 'grid';
    togglePuInputs();
}

export function closeProfileUpload() {
    document.getElementById('profileUploadModal').classList.remove('active');
    document.getElementById('puFile').value = '';
    document.getElementById('puText').value = '';
    document.getElementById('puPreviewImg').style.display = 'none';
    document.getElementById('puPreviewVid').style.display = 'none';
    setProfileMedia(null);
}

export function togglePuInputs() {
    const t = document.getElementById('puType').value;
    const mSec = document.getElementById('puMediaSec');
    if (t === 'text') {
        mSec.style.display = 'none';
    } else {
        mSec.style.display = 'block';
    }
}

export async function handleProfileFile(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const fd = new FormData();
        fd.append("file", file);
        
        try {
            const res = await fetch(
                `https://api.bytescale.com/v2/accounts/${ACCOUNT_ID}/uploads/form_data?path=/profile`, 
                { method: "POST", headers: { "Authorization": `Bearer ${API_KEY}` }, body: fd }
            );
            
            if (!res.ok) return;
            const d = await res.json();
            
            if (d.files && d.files[0]) {
                setProfileMedia({ url: d.files[0].fileUrl, type: file.type });
                
                if (file.type.startsWith("video")) {
                    document.getElementById("puPreviewVid").src = d.files[0].fileUrl;
                    document.getElementById("puPreviewVid").style.display = "block";
                    document.getElementById("puPreviewImg").style.display = "none";
                } else {
                    document.getElementById("puPreviewImg").src = d.files[0].fileUrl;
                    document.getElementById("puPreviewImg").style.display = "block";
                    document.getElementById("puPreviewVid").style.display = "none";
                }
            }
        } catch (err) {
            console.error('Profile file upload error:', err);
        }
    }
}

export function postToProfile() {
    const type = document.getElementById('puType').value;
    const caption = document.getElementById('puText').value;
    
    let payload = { collection: "QKarinonline", data: {} };

    if (type === 'text') {
        if (!caption) return;
        payload.data = { post: caption, stories: null, page: null };
    } else if (type === 'story') {
        if (!profileMedia) return;
        payload.data = { stories: profileMedia.url, post: null, page: null };
    } else if (type === 'grid') {
        if (!profileMedia) return;
        payload.data = { page: profileMedia.url, post: caption || "", stories: null };
    }

    window.parent.postMessage({ 
        type: "saveToCMS", 
        collection: "QKarinonline", 
        payload: payload.data 
    }, "*");
    
    // Update local content
    const newContent = [...queenContent];
    newContent.unshift({ ...payload.data, _createdDate: new Date().toISOString() });
    setQueenContent(newContent);
    
    renderProfile();
    closeProfileUpload();
}

function openMod(taskId, memberId, mediaUrl, mediaType, taskText, isHistory, status) {
    import('./dashboard-modals.js').then(({ openModal }) => {
        openModal(taskId, memberId, mediaUrl, mediaType, taskText, isHistory, status);
    });
}

// Make functions available globally
window.switchProfileTab = switchProfileTab;
window.openProfileUpload = openProfileUpload;
window.closeProfileUpload = closeProfileUpload;
window.togglePuInputs = togglePuInputs;
window.handleProfileFile = handleProfileFile;
window.postToProfile = postToProfile;
window.openMod = openMod;
