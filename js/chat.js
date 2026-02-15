// Chat functionality - FIXED: RAW MODE + URL SIGNING (Fixes Auth & Quota)
import {
    lastChatJson, isInitialLoad, chatLimit, lastNotifiedMessageId,
    setLastChatJson, setIsInitialLoad, setChatLimit, setLastNotifiedMessageId
} from './state.js';
import { URLS } from './config.js';
import { triggerSound } from './utils.js';
import { getSignedUrl } from './media.js'; // MUST be present in media.js
import { mediaType } from './media.js';

let lastTickerText = "";

export async function renderChat(messages) {
    const deskChat = document.getElementById('chatContent');
    const mobChat = document.getElementById('mob_chatContent');
    const ticker = document.getElementById('systemTicker');
    const mobTicker = document.getElementById('mob_systemTicker');

    if (!messages) return;
    if (!deskChat && !mobChat) return;

    // 1. SORT
    const sortedMessages = [...messages].sort(
        (a, b) => new Date(a._createdDate) - new Date(b._createdDate)
    );

    // 2. SEPARATE STREAMS
    const systemMessages = sortedMessages.filter(m => {
        const s = (m.sender || "").toLowerCase();
        const txt = (m.message || "");
        if (txt.startsWith('WISHLIST::')) return false;
        return s === 'system' || txt.includes("Task Verified") || txt.includes("Task Rejected");
    });

    const conversationMessages = sortedMessages.filter(m => {
        const s = (m.sender || "").toLowerCase();
        const txt = (m.message || "");
        if (txt.startsWith('WISHLIST::')) return true;
        return s !== 'system' && !txt.includes("Task Verified") && !txt.includes("Task Rejected");
    });

    // 3. TICKER
    if (systemMessages.length > 0) {
        const latest = systemMessages[systemMessages.length - 1];
        const txt = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(latest.message) : latest.message;
        if (txt !== lastTickerText) {
            lastTickerText = txt;
            const tickerHtml = `<span style="color:#fff;">◈</span> ${txt}`;
            [ticker, mobTicker].forEach(el => {
                if (el) {
                    el.classList.remove('hidden');
                    el.innerHTML = tickerHtml;
                    el.classList.remove('ticker-flash');
                    void el.offsetWidth;
                    el.classList.add('ticker-flash');
                }
            });
        }
    }

    // 4. CHECK UPDATES
    const currentJson = JSON.stringify(conversationMessages);
    if (currentJson === lastChatJson) return;

    if (!isInitialLoad && conversationMessages.length > 0) {
        const lastMsg = conversationMessages[conversationMessages.length - 1];
        if (lastMsg._id !== lastNotifiedMessageId) {
            triggerSound('msgSound');
            setLastNotifiedMessageId(lastMsg._id);
        }
    }

    setLastChatJson(currentJson);
    setIsInitialLoad(false);

    // 5. RENDER CHAT (ASYNC MAP FOR SIGNING)
    const activeLimit = window.innerWidth <= 768 ? 20 : chatLimit;
    const visibleMessages = conversationMessages.slice(-activeLimit);

    // We use Promise.all to wait for URL signatures
    const messagesHtmlArray = await Promise.all(visibleMessages.map(async (m) => {
        let txt = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(m.message) : m.message;
        const senderLower = (m.sender || "").toLowerCase();
        const isMe = senderLower === 'user' || senderLower === 'slave';
        
        txt = txt.replace(/\n/g, "<br>");
        const timeStr = new Date(m._createdDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const msgClass = isMe ? 'm-slave' : 'm-queen';
        let contentHtml = `<div class="msg ${msgClass}">${txt}</div>`;

        // --- MEDIA HANDLER ---
        if (m.message) {
            // A. WISHLIST
            if (m.message.startsWith('WISHLIST::')) {
                try {
                    const item = JSON.parse(m.message.replace('WISHLIST::', ''));
                    contentHtml = `
                    <div class="msg-wishlist-card" style="margin:0 auto; background:#111; border:1px solid #c5a059; border-radius:4px; width:200px;">
                        <img src="${item.img}" style="width:100%; height:120px; object-fit:cover;">
                        <div style="padding:5px; text-align:center; font-size:0.7rem; color:#fff;">${item.name}</div>
                    </div>`;
                } catch (e) { contentHtml = `<div class="msg ${msgClass}">🎁 ERROR</div>`; }
            }
            // B. IMAGES / VIDEO
            else if (m.message.startsWith('http') || m.mediaUrl || m.message.includes('wix:') || m.message.includes('upcdn')) {
                const rawUrl = m.mediaUrl || m.message;
                let srcUrl = rawUrl;

                // 1. BYTESCALE FIX (FORCE RAW + SIGN)
                if (rawUrl.includes('upcdn.io')) {
                    // Force /raw/ to avoid CPU Quota error
                    let clean = rawUrl
                        .replace('/image/', '/raw/')
                        .replace('/thumbnail/', '/raw/')
                        .split('?')[0]; // Strip old params
                    
                    // SIGN IT to fix "Auth Headers Missing" error
                    // (This assumes getSignedUrl in media.js works correctly)
                    try {
                        srcUrl = await getSignedUrl(clean);
                    } catch(e) { 
                        console.error("Signing failed", e);
                        srcUrl = clean; // Fallback try
                    }
                }
                // 2. WIX FIX (DATABASE LINKS)
                else if (rawUrl.includes('wix:image')) {
                    const parts = rawUrl.split('/');
                    for(let i=0; i<parts.length; i++) {
                        if(parts[i] === 'v1' && parts[i+1]) {
                            srcUrl = `https://static.wixstatic.com/media/${parts[i+1].split('#')[0]}`;
                            break;
                        }
                    }
                } 
                else if (rawUrl.includes('wix:video')) {
                    const parts = rawUrl.split('/');
                    for(let i=0; i<parts.length; i++) {
                        if(parts[i] === 'v1' && parts[i+1]) {
                            srcUrl = `https://video.wixstatic.com/video/${parts[i+1].split('#')[0]}/mp4/file.mp4`;
                            break;
                        }
                    }
                }

                // Render Media
                const isVideo = srcUrl.includes('.mp4') || srcUrl.includes('.mov') || srcUrl.includes('.webm') || mediaType(srcUrl) === "video";

                if (isVideo) {
                    contentHtml = `<div class="msg ${msgClass}" style="padding:0; background:black;"><video src="${srcUrl}" controls style="max-width:100%; border-radius:inherit;"></video></div>`;
                } else {
                    // Standard Image Tag
                    contentHtml = `<div class="msg ${msgClass}" style="padding:0;">
                        <img src="${srcUrl}" style="max-width:100%; display:block; border-radius:inherit; cursor:pointer;" 
                             onclick="openChatPreview('${encodeURIComponent(srcUrl)}', false)"
                             onerror="this.style.display='none'; this.parentElement.innerHTML='<a href=\\'${srcUrl}\\' target=\\'_blank\\' style=\\'color:red; font-size:10px; padding:10px; display:block;\\'>[AUTH FAILED]</a>'">
                    </div>`;
                }
            }
        }

        // Layout wrappers
        if (m.message && m.message.startsWith('WISHLIST::')) {
            return `<div class="msg-row" style="justify-content:center; margin: 10px 0;"><div class="msg-col" style="align-items:center;">${contentHtml}<div class="msg-time">${timeStr}</div></div></div>`;
        }

        const avatarUrl = "https://static.wixstatic.com/media/ce3e5b_19faff471a434690b7a40aacf5bf42c4~mv2.png";
        if (!isMe && !m.message.startsWith('WISHLIST::') && !m.message.startsWith('http')) {
            contentHtml = `<div class="msg ${msgClass}" style="display:flex; align-items:center; gap:10px;">
                <img src="${avatarUrl}" style="width:28px; height:28px; border-radius:50%; object-fit:cover; border:1px solid #c5a059;">
                <span>${txt}</span>
            </div>`;
        }

        return `<div class="msg-row ${isMe ? 'mr-out' : 'mr-in'}">
            <div class="msg-col" style="align-items:${isMe ? 'flex-end' : 'flex-start'};">
                ${contentHtml}
                <div class="msg-time">${timeStr}</div>
            </div>
        </div>`;
    }));

    const messagesHtml = messagesHtmlArray.join('');

    if (deskChat) deskChat.innerHTML = messagesHtml;
    if (mobChat) mobChat.innerHTML = messagesHtml;

    if (wasInitialLoad || isAtBottom) forceBottom();
}

export function forceBottom() {
    const dBox = document.getElementById('chatBox');
    const mBox = document.getElementById('mob_chatBox');
    if (dBox) dBox.scrollTop = dBox.scrollHeight;
    if (mBox) mBox.scrollTop = mBox.scrollHeight;
}

export function loadMoreChat() {
    setChatLimit(chatLimit + 10);
    if (lastChatJson) renderChat(JSON.parse(lastChatJson));
}

export function sendChatMessage() {
    const dInput = document.getElementById('chatMsgInput');
    const mInput = document.getElementById('mob_chatMsgInput');
    let activeInput = null;
    if (dInput && dInput.value.trim() !== "") activeInput = dInput;
    else if (mInput && mInput.value.trim() !== "") activeInput = mInput;

    if (!activeInput) return;

    window.parent.postMessage({ type: "SEND_CHAT_TO_BACKEND", text: activeInput.value.trim() }, "*");
    if (dInput) dInput.value = "";
    if (mInput) mInput.value = "";
}

export function handleChatKey(e) {
    if (e.key === 'Enter') sendChatMessage();
}

export function sendCoins(amount) {
    window.parent.postMessage({ type: "SEND_COINS", amount: amount, category: "Tribute" }, "*");
}

export function openChatPreview(url, isVideo) {
    const overlay = document.getElementById('chatMediaOverlay');
    const content = document.getElementById('chatMediaOverlayContent');
    const decoded = decodeURIComponent(url);
    if (!overlay || !content) return;
    content.innerHTML = isVideo ? `<video src="${decoded}" controls autoplay class="cmo-media"></video>` : `<img src="${decoded}" class="cmo-media">`;
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
}

export function closeChatPreview() {
    const overlay = document.getElementById('chatMediaOverlay');
    const container = document.getElementById('chatMediaOverlayContent');
    if (overlay) {
        overlay.classList.add('hidden');
        if (container) container.innerHTML = "";
    }
}

// Global Exports
window.loadMoreChat = loadMoreChat;
window.openChatPreview = openChatPreview;
window.closeChatPreview = closeChatPreview;
