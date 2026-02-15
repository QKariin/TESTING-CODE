// Chat functionality - UNIVERSAL MEDIA RESOLVER
import {
    lastChatJson, isInitialLoad, chatLimit, lastNotifiedMessageId,
    setLastChatJson, setIsInitialLoad, setChatLimit, setLastNotifiedMessageId
} from './state.js';
import { triggerSound } from './utils.js';

let lastTickerText = "";

// --- THE FIX: UNIVERSAL URL PARSER ---
function resolveMediaUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return "";

    // 1. ALREADY A WEB LINK? (https://...)
    if (rawUrl.startsWith('http')) {
        // Fix Bytescale/HEIC (Mobile Uploads)
        if (rawUrl.includes('upcdn.io')) {
            let clean = rawUrl.replace('/raw/', '/image/').replace('/thumbnail/', '/image/');
            clean = clean.split('?')[0]; // Strip old params
            return `${clean}?w=600&q=80&f=jpg`; // Force JPG
        }
        return rawUrl;
    }

    // 2. WIX IMAGE (wix:image://v1/ID/name.jpg)
    if (rawUrl.includes('wix:image')) {
        // Split by '/' to break it into chunks
        const parts = rawUrl.split('/');
        
        // Find the chunk that is the ID (it's the one after 'v1')
        for (let i = 0; i < parts.length; i++) {
            if (parts[i] === 'v1' && parts[i+1]) {
                const id = parts[i+1].split('#')[0]; // Remove hash params
                return `https://static.wixstatic.com/media/${id}/v1/fill/w_600,h_600,al_c,q_80/file.jpg`;
            }
        }
    }

    // 3. WIX VIDEO (wix:video://v1/ID/name.mp4)
    if (rawUrl.includes('wix:video')) {
        const parts = rawUrl.split('/');
        for (let i = 0; i < parts.length; i++) {
            if (parts[i] === 'v1' && parts[i+1]) {
                const id = parts[i+1].split('#')[0];
                return `https://video.wixstatic.com/video/${id}/mp4/file.mp4`;
            }
        }
    }

    return ""; // Could not resolve
}

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
        const txt = m.message || "";
        if (txt.startsWith('WISHLIST::')) return false;
        const s = (m.sender || "").toLowerCase();
        return s === 'system' || txt.includes("Task Verified") || txt.includes("FAILURE");
    });

    const conversationMessages = sortedMessages.filter(m => {
        const txt = m.message || "";
        if (txt.startsWith('WISHLIST::')) return true;
        const s = (m.sender || "").toLowerCase();
        return s !== 'system' && !txt.includes("Task Verified") && !txt.includes("FAILURE");
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

    // 4. CHECK UPDATE
    const currentJson = JSON.stringify(conversationMessages);
    if (currentJson === lastChatJson) return;

    const dBox = document.getElementById('chatBox');
    const isAtBottom = dBox ? (dBox.scrollHeight - dBox.scrollTop - dBox.clientHeight < 150) : true;
    const wasInitialLoad = isInitialLoad;

    if (!isInitialLoad && conversationMessages.length > 0) {
        const lastMsg = conversationMessages[conversationMessages.length - 1];
        if (lastMsg._id !== lastNotifiedMessageId) {
            triggerSound('msgSound');
            setLastNotifiedMessageId(lastMsg._id);
        }
    }

    setLastChatJson(currentJson);
    setIsInitialLoad(false);

    // 5. BUILD MESSAGES
    const activeLimit = window.innerWidth <= 768 ? 20 : chatLimit;
    const visibleMessages = conversationMessages.slice(-activeLimit);

    let messagesHtml = visibleMessages.map((m) => {
        let txt = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(m.message) : m.message;
        const isMe = (m.sender || "").toLowerCase() === 'user' || (m.sender || "").toLowerCase() === 'slave';
        
        txt = txt.replace(/\n/g, "<br>");
        const timeStr = new Date(m._createdDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const msgClass = isMe ? 'm-slave' : 'm-queen';
        let contentHtml = `<div class="msg ${msgClass}">${txt}</div>`;

        // --- MEDIA HANDLER ---
        // Check message text OR specific media fields
        const rawUrl = m.mediaUrl || m.message; 
        const hasMediaSignal = rawUrl.startsWith('http') || rawUrl.includes('wix:') || rawUrl.includes('upcdn');

        if (m.message && (hasMediaSignal || m.message.startsWith('WISHLIST::'))) {
            
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
            else if (hasMediaSignal) {
                
                // *** RESOLVE URL ***
                const srcUrl = resolveMediaUrl(rawUrl);
                
                // If it resolves to empty, show error (helps debugging)
                if (!srcUrl) {
                    console.warn("Could not resolve:", rawUrl);
                    // Fallback to text so we don't lose the message content
                    // contentHtml = `<div class="msg ${msgClass}">[UNSUPPORTED MEDIA]</div>`; 
                } else {
                    const isVideo = srcUrl.includes('.mp4') || srcUrl.includes('.mov') || srcUrl.includes('.webm');

                    if (isVideo) {
                        contentHtml = `<div class="msg ${msgClass}" style="padding:0; background:black;"><video src="${srcUrl}" controls style="max-width:100%; border-radius:inherit;"></video></div>`;
                    } else {
                        // Image with Error Handler
                        contentHtml = `<div class="msg ${msgClass}" style="padding:0;">
                            <img src="${srcUrl}" 
                                 style="max-width:100%; display:block; border-radius:inherit; cursor:pointer;" 
                                 onclick="openChatPreview('${encodeURIComponent(srcUrl)}', false)"
                                 onerror="this.style.display='none'; this.parentElement.innerText='❌ BROKEN IMAGE'; console.error('Failed to load:', '${srcUrl}')">
                        </div>`;
                    }
                }
            }
        }

        // Layout wrappers
        if (m.message && m.message.startsWith('WISHLIST::')) {
            return `<div class="msg-row" style="justify-content:center; margin:10px 0;"><div class="msg-col" style="align-items:center;">${contentHtml}<div class="msg-time">${timeStr}</div></div></div>`;
        }

        if (!isMe) {
            const avatarUrl = "https://static.wixstatic.com/media/ce3e5b_19faff471a434690b7a40aacf5bf42c4~mv2.png";
            if (!hasMediaSignal && !m.message.startsWith('WISHLIST::')) {
                contentHtml = `<div class="msg ${msgClass}" style="display:flex; align-items:center; gap:10px;">
                    <img src="${avatarUrl}" style="width:28px; height:28px; border-radius:50%; object-fit:cover; border:1px solid #c5a059;">
                    <span>${txt}</span>
                </div>`;
            }
        }

        return `<div class="msg-row ${isMe ? 'mr-out' : 'mr-in'}">
            <div class="msg-col" style="align-items:${isMe ? 'flex-end' : 'flex-start'};">
                ${contentHtml}
                <div class="msg-time">${timeStr}</div>
            </div>
        </div>`;
    }).join('');

    if (conversationMessages.length > visibleMessages.length) {
        messagesHtml = `<div style="width:100%; text-align:center; padding:10px;"><button onclick="window.loadMoreChat()" style="background:transparent; border:none; color:#666; font-size:0.6rem;">▲ LOAD HISTORY</button></div>` + messagesHtml;
    }

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

export function openChatPreview(url, isVideo) {
    const overlay = document.getElementById('chatMediaOverlay');
    const content = document.getElementById('chatMediaOverlayContent');
    if (!overlay || !content) return;
    const decoded = decodeURIComponent(url);
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
