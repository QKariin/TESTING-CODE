// Chat functionality - DESKTOP & MOBILE FIX
import {
    lastChatJson, isInitialLoad, chatLimit, lastNotifiedMessageId,
    setLastChatJson, setIsInitialLoad, setChatLimit, setLastNotifiedMessageId
} from './state.js';
import { triggerSound } from './utils.js';

let lastTickerText = "";

// --- INTERNAL URL REPAIR ---
function getSafeSrc(rawUrl) {
    if (!rawUrl) return "";
    
    // 1. WIX DATABASE IMAGES (Regex Extraction)
    // Pattern: wix:image://v1/ <THE_ID> / <FILENAME>
    if (rawUrl.includes('wix:image')) {
        const match = rawUrl.match(/wix:image:\/\/v1\/([^/]+)/); 
        if (match && match[1]) {
            // Found the ID (e.g. "82739_2398...")
            // Return clean standard Wix URL
            return `https://static.wixstatic.com/media/${match[1]}`;
        }
    }

    // 2. WIX DATABASE VIDEOS
    if (rawUrl.includes('wix:video')) {
        const match = rawUrl.match(/wix:video:\/\/v1\/([^/]+)/);
        if (match && match[1]) {
            return `https://video.wixstatic.com/video/${match[1]}/mp4/file.mp4`;
        }
    }

    // 3. BYTESCALE / MOBILE UPLOADS (HEIC Fix)
    if (rawUrl.includes('upcdn.io')) {
        // Convert /raw/ to /image/ to enable processing
        let clean = rawUrl.replace('/raw/', '/image/').replace('/thumbnail/', '/image/');
        clean = clean.split('?')[0]; // Strip old params
        // Force JPG format (browsers can't read iPhone HEIC)
        return `${clean}?w=600&q=80&f=jpg`;
    }

    // 4. ALREADY VALID HTTP LINKS
    if (rawUrl.startsWith('http')) return rawUrl;

    return rawUrl; // Fallback
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

    // 2. FILTER STREAMS
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

    // 3. TICKER (Anti-Blink)
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

    // 5. BUILD CHAT HTML
    const activeLimit = window.innerWidth <= 768 ? 20 : chatLimit;
    const visibleMessages = conversationMessages.slice(-activeLimit);

    let messagesHtml = visibleMessages.map((m) => {
        let txt = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(m.message) : m.message;
        const senderLower = (m.sender || "").toLowerCase();
        const isMe = senderLower === 'user' || senderLower === 'slave';
        
        txt = txt.replace(/\n/g, "<br>");
        const timeStr = new Date(m._createdDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const msgClass = isMe ? 'm-slave' : 'm-queen';
        let contentHtml = `<div class="msg ${msgClass}">${txt}</div>`;

        // --- MEDIA RENDERING ---
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
                
                // USE THE SAFE REPAIR FUNCTION
                const srcUrl = getSafeSrc(rawUrl);
                
                // DEBUGGING: Print broken links to console so we can see them
                if (srcUrl === "") console.log("Failed to resolve URL:", rawUrl);

                const isVideo = srcUrl.includes('.mp4') || srcUrl.includes('.mov') || srcUrl.includes('.webm') || rawUrl.includes('wix:video');

                if (isVideo) {
                    contentHtml = `<div class="msg ${msgClass}" style="padding:0; background:black;"><video src="${srcUrl}" controls style="max-width:100%; border-radius:inherit;"></video></div>`;
                } else {
                    // Added min-width and min-height so broken images are visible as broken blocks
                    contentHtml = `<div class="msg ${msgClass}" style="padding:0;">
                        <img src="${srcUrl}" 
                             style="max-width:100%; display:block; border-radius:inherit; cursor:pointer; min-height:50px;" 
                             onclick="openChatPreview('${encodeURIComponent(srcUrl)}', false)"
                             onerror="console.log('Img Load Error:', '${srcUrl}'); this.style.opacity='0.5';">
                    </div>`;
                }
            }
        }

        if (m.message && m.message.startsWith('WISHLIST::')) {
            return `<div class="msg-row" style="justify-content:center; margin:10px 0;"><div class="msg-col" style="align-items:center;">${contentHtml}<div class="msg-time">${timeStr}</div></div></div>`;
        }

        if (!isMe) {
            const avatarUrl = "https://static.wixstatic.com/media/ce3e5b_19faff471a434690b7a40aacf5bf42c4~mv2.png";
            if (!m.message.startsWith('WISHLIST::') && !m.message.startsWith('http') && !m.mediaUrl && !m.message.startsWith('wix:')) {
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
