// src/scripts/dashboard-chat.ts
// Dashboard Chat Management - Converted to TypeScript

import { currId, lastChatJson, setLastChatJson, ACCOUNT_ID, API_KEY, users } from './dashboard-state';
import { forceBottom, isAtBottom } from './dashboard-utils';
import { getSignedUrl, getOptimizedUrl, mediaType, fileType } from './media';
import { DbService } from '@/lib/supabase-service';

// Mocking DOMPurify
const DOMPurify = (globalThis as any).DOMPurify || { sanitize: (s: string) => s };

let lastNotifiedMessageId: string | null = null;
let isInitialLoad: boolean = true;

export async function renderChat(msgs: any[]) {
    if (!msgs || !Array.isArray(msgs)) return;

    const currentJson = JSON.stringify(msgs);
    if (currentJson === lastChatJson) return;
    setLastChatJson(currentJson);

    // Proxy Bytescale URLs for private access
    const signingPromises = msgs.map(async (m) => {
        if (m.message && m.message.startsWith('https://')) {
            try {
                m.mediaUrl = await getSignedUrl(getOptimizedUrl(m.message, 400));
            } catch (e) {
                console.error('Failed to sign URL', e);
            }
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

        if (m.message) {
            // 1. WISHLIST CARD
            if (m.message.startsWith('WISHLIST::')) {
                try {
                    const jsonStr = m.message.replace('WISHLIST::', '');
                    const item = JSON.parse(jsonStr);

                    const cardInner = `
                    <div class="msg-wishlist-card" style="margin: 0 auto; padding:0; overflow:hidden; background:linear-gradient(180deg, #1a1a1a, #000); border:1px solid #c5a059; border-radius:4px; max-width:200px; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
                        <div style="width:100%; height:120px; overflow:hidden; position:relative;">
                             <img src="${item.img}" style="width:100%; height:100%; object-fit:cover;">
                             <div style="position:absolute; bottom:0; left:0; width:100%; background:rgba(0,0,0,0.7); color:#c5a059; font-size:0.6rem; padding:2px; text-align:center;">
                                 TRIBUTE SENT
                             </div>
                        </div>
                        <div style="padding:8px; text-align:center;">
                            <div style="color:#eee; font-family:'Cinzel'; font-size:0.6rem; margin-bottom:2px; opacity:0.8;">${item.sender} sent</div>
                            <div style="color:#fff; font-family:'Cinzel'; font-size:0.7rem; margin-bottom:4px;">${item.name}</div>
                            <div style="color:#c5a059; font-family:'Orbitron'; font-size:0.8rem; font-weight:bold;">${item.price}</div>
                        </div>
                    </div>`;

                    contentHtml = `<div class="msg-row" style="justify-content:center; margin-bottom:15px; width:100%; display:flex;"><div class="msg-col" style="align-items:center;">${cardInner}<div class="msg-time" style="text-align:center; width:100%; margin-top:5px;">${timeStr}</div></div></div>`;

                } catch (e) {
                    console.error("Failed to parse wishlist card", e);
                    contentHtml = `<div class="msg ${isMe ? 'm-out' : 'm-in'}">🎁 TRIBUTE ERROR</div>`;
                }
            }
            else {
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
                    safeHtml = safeHtml.replace(/\n/g, "<br>");
                    contentHtml = `<div class="msg ${isMe ? 'm-out' : 'm-in'}">${safeHtml}</div>`;
                }
            }
        }

        if (!isMe) {
            const u = users.find(x => x.memberId === currId);
            const defaultPic = "https://static.wixstatic.com/media/ce3e5b_78da97e06a3848df84d0b00c9e6dcfdd~mv2.png";
            const finalPic = u?.avatar || u?.profilePicture || defaultPic;
            avatarHtml = `<img src="${finalPic}" class="chat-av">`;
        } else {
            avatarHtml = `<img src="https://static.wixstatic.com/media/ce3e5b_1bd27ba758ce465fa89a36d70a68f355~mv2.png" class="chat-av">`;
        }

        if (!m.message.startsWith('💝 TRIBUTE:') && !m.message.startsWith('WISHLIST::')) {
            html += `<div class="msg-row ${isMe ? 'mr-out' : 'mr-in'}">${!isMe ? avatarHtml : ''}${contentHtml}${isMe ? avatarHtml : ''}<div class="msg-meta ${isMe ? 'mm-out' : 'mm-in'}">${timeStr}</div></div>`;
        } else {
            html += contentHtml;
        }
    });

    html += '<div id="chat-anchor" style="height:1px;"></div>';
    b.innerHTML = html;

    if (isFreshLoad || wasAtBottom) {
        forceBottom();
        setTimeout(forceBottom, 100);
        setTimeout(forceBottom, 500);
    }
}

function renderTributeMessage(message: string, timeStr: string) {
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

function renderSystemMessage(message: string, type: string) {
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

export async function sendMsg() {
    const inp = document.getElementById('adminInp') as HTMLInputElement;
    if (!inp || !currId) return;

    const text = inp.value.trim();
    if (!text) return;

    try {
        await DbService.sendMessage(currId, text, 'queen');
        inp.value = "";
        // Refresh chat locally if needed or rely on sync loop
    } catch (err) {
        console.error("Failed to send message", err);
    }
}

export async function handleAdminUpload(input: HTMLInputElement) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const fd = new FormData();
        fd.append("file", file);

        try {
            const btn = document.querySelector('.btn-plus') as HTMLButtonElement;
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
                window.parent.postMessage({ type: "adminMessage", text: finalUrl }, "*");
            }
            btn.innerText = originalText;
        } catch (err) {
            console.error("Error", err);
            const btn = document.querySelector('.btn-plus') as HTMLButtonElement;
            if (btn) btn.innerText = "+";
        }
    }
}

(window as any).sendMsg = sendMsg;
(window as any).handleAdminUpload = handleAdminUpload;
