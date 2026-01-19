// Dashboard Chat Management
// Chat rendering, message handling, and file uploads

import { currId, lastChatJson, setLastChatJson, ACCOUNT_ID, API_KEY, users } from './dashboard-state.js';
import { forceBottom, isAtBottom } from './dashboard-utils.js';
import { getPrivateFile } from './mediaBytescale.js';
import { getOptimizedUrl, mediaType, fileType, getSignedUrl } from './media.js';

let lastNotifiedMessageId = null;
let isInitialLoad = true;

export async function renderChat(msgs) {
    if (!msgs || !Array.isArray(msgs)) return;
    
    const currentJson = JSON.stringify(msgs);
    if (currentJson === lastChatJson) return;
    setLastChatJson(currentJson);
    
    // Proxy Bytescale URLs for private access (in parallel)
    const signingPromises = msgs.map(async (m) => {
        if (m.message && m.message.startsWith('https://')) {
            //const parts = m.message.split('/raw/');
            //if (parts.length === 2) {
                //const filePath = '/' + parts[1];
                try {
                    //m.mediaUrl = await getPrivateFile(filePath);
                    m.mediaUrl = await getSignedUrl(getOptimizedUrl(m.message, 400));
                } catch (e) {
                    console.error('Failed to sign URL', e);
                }
            //}
        }
    });
    await Promise.all(signingPromises);
    
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
            const isImage = mediaType(m.message) === "image";
            const isVideo = mediaType(m.message) === "video";

            if (isImage) {
                const srcUrl = m.mediaUrl || getOptimizedUrl(m.message, 300);
                const previewUrl = m.mediaUrl || m.message;
                contentHtml = `<div class="msg ${isMe ? 'm-out' : 'm-in'}"><img src="${srcUrl}" onclick="openChatPreview('${encodeURIComponent(previewUrl)}', false)" style="cursor:pointer; display:block; max-width:100%;"></div>`;
            } else if (isVideo) {
                const srcUrl = m.mediaUrl || m.message;
                const previewUrl = m.mediaUrl || m.message;
                contentHtml = `<div class="msg ${isMe ? 'm-out' : 'm-in'}"><video src="${srcUrl}" onclick="openChatPreview('${encodeURIComponent(previewUrl)}', true)" muted style="max-width:200px; max-height:200px; display:block;"></video></div>`;
            } else if (m.message.startsWith('💝 TRIBUTE:')) {
                contentHtml = renderTributeMessage(m.message, timeStr);
            } else if (m.message.includes('Task Verified') || m.message.includes('Task Rejected')) {
                contentHtml = renderSystemMessage(m.message, m.message.includes('Verified') ? 'green' : 'red');
            } else {
                let safeHtml = DOMPurify.sanitize(m.message);
                // Convert newlines to <br>
                safeHtml = safeHtml.replace(/\n/g, "<br>");
                contentHtml = `<div class="msg ${isMe ? 'm-out' : 'm-in'}">${safeHtml}</div>`;
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
    // Regex to remove any potential emojis from the incoming string
    const cleanMsg = message.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
    
    const lines = cleanMsg.split('\n');
    const tributeLine = lines.find(line => line.includes('TRIBUTE:'));
    const itemLine = lines.find(line => line.includes('ITEM:'));
    const costLine = lines.find(line => line.includes('COST:'));
    const messageLine = lines.find(line => line.includes('MESSAGE:')) || lines[lines.length - 1];
    
    const reason = tributeLine ? tributeLine.replace('TRIBUTE:', '').trim() : 'Adoration';
    const item = itemLine ? itemLine.replace('ITEM:', '').trim() : 'Premium Selection';
    const cost = costLine ? costLine.replace('COST:', '').trim() : '0';
    const note = messageLine ? messageLine.replace('MESSAGE:', '').replace(/"/g, '').trim() : 'A silent tribute';
    
    return `
        <div class="tribute-system-container" style="margin: 25px 0; width: 100%; display: flex; flex-direction: column; align-items: center;">
            <div class="tribute-card" style="background: rgba(10, 10, 12, 0.95); border: 1px solid var(--gold); border-radius: 0; padding: 25px; width: 85%; max-width: 290px; position: relative; box-shadow: 0 15px 40px rgba(0,0,0,0.8);">
                
                <div style="text-align: center; margin-bottom: 10px;">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M5 15l-3-8 7 3 3-8 3 8 7-3-3 8h-14z"></path>
                        <circle cx="12" cy="19" r="2"></circle>
                    </svg>
                </div>

                <div class="tribute-card-header" style="text-align: center; margin-bottom: 20px;">
                    <div style="font-family: 'Cinzel', serif; font-weight: 900; color: var(--gold); font-size: 0.7rem; letter-spacing: 4px; text-transform: uppercase;">Sacrifice Validated</div>
                </div>

                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="color: white; font-family: 'Cinzel'; font-size: 1rem; font-weight: 700; letter-spacing: 1.5px;">${item}</div>
                    <div style="color: var(--gold-bright); font-family: 'Orbitron'; font-size: 1.1rem; font-weight: 900; margin-top: 8px;">${cost} 🪙</div>
                </div>

                <div style="border-top: 1px solid rgba(212, 175, 55, 0.2); padding-top: 15px;">
                    <div style="color: var(--gold); font-family: 'Inter'; font-size: 0.6rem; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px; opacity: 0.7;">Intention: ${reason}</div>
                    <div style="color: #eee; font-family: 'Inter'; font-size: 0.85rem; font-weight: 300; line-height: 1.5; font-style: italic;">"${note}"</div>
                </div>

                <div style="text-align: center; margin-top: 20px; font-family: 'Cinzel'; color: var(--gold); font-size: 0.5rem; letter-spacing: 3px; opacity: 0.5; border-top: 1px solid rgba(212, 175, 55, 0.1); padding-top: 10px;">
                    ROYAL ASSET
                </div>
            </div>
            <div class="msg-time" style="margin-top: 10px; font-family: 'Orbitron'; font-size: 0.6rem; color: #444;">${timeStr}</div>
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
        const isVideo = fileType(file) === "video";
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
                //Not needed with bytescale
                /*if (isVideo) {
                    finalUrl = finalUrl + "#.mp4";
                }*/
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
