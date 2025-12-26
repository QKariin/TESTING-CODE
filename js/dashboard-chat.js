// Dashboard Chat Management
// Chat rendering, message handling, and file uploads

import { currId, lastChatJson, setLastChatJson, ACCOUNT_ID, API_KEY, users } from './dashboard-state.js';
import { getOptimizedUrl, forceBottom, isAtBottom } from './dashboard-utils.js';


let lastNotifiedMessageId = null;
let isInitialLoad = true;

export function renderChat(msgs) {
    if (!msgs || !Array.isArray(msgs)) return;
    
    const currentJson = JSON.stringify(msgs);
    if (currentJson === lastChatJson) return;
    setLastChatJson(currentJson);
    
    const b = document.getElementById('adminChatBox');
    if (!b) return;
    
    const isFreshLoad = b.innerHTML.trim() === "";
    const wasAtBottom = isAtBottom();
    
    let html = '';
    msgs.forEach(m => {
        const isMe = m.sender === 'admin';
        const timeStr = new Date(m._createdDate || m.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        let contentHtml = '';
        let avatarHtml = '';
        
        // Message content
        // Smarter Media Detection
        if (m.message) {
            const msgLower = m.message.toLowerCase();
            const isImage = msgLower.match(/\.(jpg|jpeg|png|gif|webp|avif|bmp|svg)/i) || msgLower.includes("image");
            const isVideo = msgLower.match(/\.(mp4|mov|webm)/i) || msgLower.includes(".mp4");

            if (isImage) {
                contentHtml = `<div class="msg ${isMe ? 'm-out' : 'm-in'}"><img src="${getOptimizedUrl(m.message, 300)}" onclick="openImageModal('${m.message}')" style="cursor:pointer; display:block; max-width:100%;"></div>`;
            } else if (isVideo) {
                contentHtml = `<div class="msg ${isMe ? 'm-out' : 'm-in'}"><video src="${m.message}" controls muted style="max-width:200px; max-height:200px; display:block;"></video></div>`;
            } else if (m.message.startsWith('💝 TRIBUTE:')) {
                contentHtml = renderTributeMessage(m.message, timeStr);
            } else if (m.message.includes('Task Verified') || m.message.includes('Task Rejected')) {
                contentHtml = renderSystemMessage(m.message, m.message.includes('Verified') ? 'green' : 'red');
            } else {
                contentHtml = `<div class="msg ${isMe ? 'm-out' : 'm-in'}">${m.message}</div>`;
            }
        }
        
        // Avatar
        if (!isMe) {
            const u = users.find(x => x.memberId === currId);
            const avatarUrl = u?.avatar ? getOptimizedUrl(u.avatar, 60) : '';
            avatarHtml = avatarUrl ? 
                `<img src="${avatarUrl}" class="chat-av">` : 
                `<div class="chat-av-placeholder">${(u?.name || 'U')[0]}</div>`;
        } else {
            avatarHtml = `<img src="https://static.wixstatic.com/media/ce3e5b_1bd27ba758ce465fa89a36d70a68f355~mv2.png" class="chat-av">`;
        }
        
        // Skip tribute messages for regular rendering
        if (!m.message.startsWith('💝 TRIBUTE:')) {
            html += `<div class="msg-row ${isMe ? 'mr-out' : 'mr-in'}">${!isMe ? avatarHtml : ''}${contentHtml}${isMe ? avatarHtml : ''}<div class="msg-meta ${isMe ? 'mm-out' : 'mm-in'}">${timeStr}</div></div>`;
        } else {
            html += contentHtml; // Tribute messages are already formatted
        }
    });
    
    // Add invisible anchor
    html += '<div id="chat-anchor" style="height:1px;"></div>';
    
    b.innerHTML = html;
    
    // Scroll logic
    if (isFreshLoad || wasAtBottom) {
        forceBottom();
        setTimeout(forceBottom, 100);
        setTimeout(forceBottom, 500);
    }
}

function renderTributeMessage(message, timeStr) {
    const lines = message.split('\n');
    const tributeLine = lines.find(line => line.includes('💝 TRIBUTE:'));
    const itemLine = lines.find(line => line.includes('🎁 ITEM:'));
    const costLine = lines.find(line => line.includes('💰 COST:'));
    const messageLine = lines.find(line => line.includes('💌'));
    
    const reason = tributeLine ? tributeLine.replace('💝 TRIBUTE:', '').trim() : 'Unknown';
    const item = itemLine ? itemLine.replace('🎁 ITEM:', '').trim() : 'Unknown Item';
    const cost = costLine ? costLine.replace('💰 COST:', '').trim() : '0';
    const note = messageLine ? messageLine.replace('💌', '').replace(/"/g, '').trim() : 'A silent tribute';
    
    return `
        <div class="tribute-system-container" style="margin: 15px 0; text-align: center;">
            <div class="tribute-timestamp" style="font-size: 0.7rem; color: #666; margin-bottom: 5px;">${timeStr}</div>
            <div class="tribute-card" style="background: linear-gradient(135deg, rgba(255,215,0,0.1) 0%, rgba(255,0,222,0.1) 100%); border: 1px solid var(--yellow); border-radius: 12px; padding: 15px; max-width: 300px; margin: 0 auto;">
                <div class="tribute-card-header" style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 10px;">
                    <svg style="width: 20px; height: 20px; fill: var(--yellow);" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    <div style="font-weight: 900; color: var(--yellow); font-size: 0.9rem;">TRIBUTE SENT</div>
                </div>
                <div style="color: white; font-size: 0.8rem; margin-bottom: 8px;"><strong>Item:</strong> ${item}</div>
                <div style="color: var(--yellow); font-size: 0.9rem; font-weight: bold; margin-bottom: 8px;">${cost} 🪙</div>
                <div style="color: #ccc; font-size: 0.75rem; margin-bottom: 8px;"><strong>Reason:</strong> ${reason}</div>
                <div style="color: #aaa; font-size: 0.7rem; font-style: italic;">"${note}"</div>
                <div style="margin-top: 10px; color: var(--pink); font-size: 0.7rem; font-weight: bold;">✨ For Queen Karin ✨</div>
            </div>
        </div>
    `;
}

function renderSystemMessage(message, type) {
    const color = type === 'green' ? 'var(--green)' : 'var(--red)';
    const icon = type === 'green' ? 
        '<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>' :
        '<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>';
    
    return `
        <div class="msg-${type}" style="width: 90%; align-self: center; text-align: center; margin: 10px 0; padding: 10px; background: linear-gradient(90deg, rgba(${type === 'green' ? '57,255,20' : '255,0,60'},0.1) 0%, rgba(0,0,0,0.5) 50%, rgba(${type === 'green' ? '57,255,20' : '255,0,60'},0.1) 100%); border: 1px solid ${color}; border-radius: 6px; color: ${color}; font-family: 'Orbitron'; font-size: 0.9rem; font-weight: 900; display: flex; flex-direction: column; align-items: center; gap: 5px;">
            <svg style="width: 24px; height: 24px; fill: ${color};" viewBox="0 0 24 24">${icon}</svg>
            ${message}
        </div>
    `;
}

export function sendMsg() {
    const inp = document.getElementById('adminInp');
    if (!inp || !currId) return;
    
    const text = inp.value.trim();
    if (!text) return;
    
    window.parent.postMessage({ 
        type: "adminMessage", 
        text: text 
    }, "*");
    
    inp.value = "";
}

export async function handleAdminUpload(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const isVideo = file.type.startsWith('video') || file.name.match(/\.(mp4|mov|webm)$/i);
        const fd = new FormData();
        fd.append("file", file);

        try {
            const btn = document.querySelector('.btn-plus');
            const originalText = btn.innerText;
            btn.innerText = "⏳";

            const res = await fetch(
                `https://api.bytescale.com/v2/accounts/${ACCOUNT_ID}/uploads/form_data?path=/admin`,
                { method: "POST", headers: { "Authorization": `Bearer ${API_KEY}` }, body: fd }
            );

            if (!res.ok) { 
                console.error("Upload failed"); 
                btn.innerText = originalText;
                return; 
            }
            
            const d = await res.json();

            if (d.files && d.files[0] && d.files[0].fileUrl) {
                let finalUrl = d.files[0].fileUrl;
                if (isVideo) {
                    finalUrl = finalUrl + "#.mp4";
                }
                window.parent.postMessage({ type: "adminMessage", text: finalUrl }, "*");
            }
            btn.innerText = originalText;
        } catch (err) { 
            console.error("Error", err); 
            document.querySelector('.btn-plus').innerText = "+";
        }
    }
}

function openImageModal(url) {
    import('./dashboard-modals.js').then(({ openModal }) => {
        openModal(null, null, url, 'image', 'Image Preview', true, 'IMAGE');
    });
}

// Make functions available globally
window.sendMsg = sendMsg;
window.handleAdminUpload = handleAdminUpload;
