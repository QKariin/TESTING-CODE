// Chat functionality - STRICT REVERT + AUTH/QUOTA FIX
import {
    lastChatJson, isInitialLoad, chatLimit, lastNotifiedMessageId,
    setLastChatJson, setIsInitialLoad, setChatLimit, setLastNotifiedMessageId
} from './state.js';
import { URLS } from './config.js';
import { triggerSound } from './utils.js';
import { getOptimizedUrl, getSignedUrl } from './media.js'; // Added getSignedUrl
import { mediaType } from './media.js';

// Add this variable at the TOP of chat.js (outside the function)
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

    // 2. SEPARATE STREAMS (STRICTER FILTER)
    const systemMessages = sortedMessages.filter(m => {
        const s = (m.sender || "").toLowerCase();
        const txt = (m.message || "");

        // EXCLUDE WISHLIST FROM TICKER (It goes to main chat)
        if (txt.startsWith('WISHLIST::')) return false;

        // Catch 'system' sender OR any auto-generated messages
        return s === 'system' ||
            txt.includes("Task Verified") ||
            txt.includes("Task Rejected") ||
            txt.includes("FAILURE RECORDED") ||
            txt.includes("earned");
    });

    const conversationMessages = sortedMessages.filter(m => {
        const s = (m.sender || "").toLowerCase();
        const txt = (m.message || "");

        // ALWAYS ALLOW WISHLIST CARDS
        if (txt.startsWith('WISHLIST::')) return true;

        // Only allow Human Conversation
        return s !== 'system' &&
            !txt.includes("Task Verified") &&
            !txt.includes("Task Rejected") &&
            !txt.includes("FAILURE RECORDED") &&
            !txt.includes("earned");
    });

    // 3. TICKER LOGIC (ANTI-BLINK FIX)
    if (systemMessages.length > 0) {
        const latest = systemMessages[systemMessages.length - 1];
        const txt = DOMPurify.sanitize(latest.message);

        // ONLY ANIMATE IF TEXT CHANGED
        if (txt !== lastTickerText) {
            lastTickerText = txt; // Update memory
            const tickerHtml = `<span style="color:#fff;">◈</span> ${txt}`;

            [ticker, mobTicker].forEach(el => {
                if (el) {
                    el.classList.remove('hidden');
                    el.innerHTML = tickerHtml;
                    // Reset Animation
                    el.classList.remove('ticker-flash');
                    void el.offsetWidth; // Force Reflow
                    el.classList.add('ticker-flash');
                }
            });
        } else {
            // Text is same, just ensure it's visible (No Flash)
            [ticker, mobTicker].forEach(el => {
                if (el) el.classList.remove('hidden');
            });
        }
    }

    // 4. CHAT LOGIC (Standard)
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

    // 5. RENDER CHAT (ASYNC MAP REQUIRED FOR URL SIGNING)
    const activeLimit = window.innerWidth <= 768 ? 20 : chatLimit;
    const visibleMessages = conversationMessages.slice(-activeLimit);

    // We must use Promise.all to wait for signatures to fix "auth_headers_missing"
    const messagesHtmlArray = await Promise.all(visibleMessages.map(async (m) => {
        let txt = DOMPurify.sanitize(m.message);
        const senderLower = (m.sender || "").toLowerCase();
        const isMe = senderLower === 'user' || senderLower === 'slave';

        txt = txt.replace(/\n/g, "<br>");
        const timeStr = new Date(m._createdDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const msgClass = isMe ? 'm-slave' : 'm-queen';
        let contentHtml = `<div class="msg ${msgClass}">${txt}</div>`;

        // Media
        if (m.message) {
            // 1. WISHLIST CARD (EXACT ORIGINAL RESTORED)
            if (m.message.startsWith('WISHLIST::')) {
                try {
                    const jsonStr = m.message.replace('WISHLIST::', '');
                    const item = JSON.parse(jsonStr);

                    contentHtml = `
                    <div class="msg-wishlist-card" style="margin: 0 auto; padding:0; overflow:hidden; background:linear-gradient(180deg, #1a1a1a, #000); border:1px solid #c5a059; border-radius:4px; max-width:200px; width:60vw;">
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
                } catch (e) {
                    console.error("Failed to parse wishlist card", e);
                    contentHtml = `<div class="msg ${msgClass}">🎁 TRIBUTE ERROR</div>`;
                }
            }
            // 2. STANDARD MEDIA (FIXED FOR AUTH & QUOTA)
            else if (m.message.startsWith('http') || m.mediaUrl || m.message.includes('wix:image') || m.message.includes('wix:video')) {
                const rawUrl = m.mediaUrl || m.message;
                let srcUrl = rawUrl;

                // --- BYTESCALE FIX (FORCE RAW + SIGN) ---
                if (rawUrl.includes('upcdn.io')) {
                    // Force /raw/ to avoid CPU Quota error
                    let clean = rawUrl
                        .replace('/image/', '/raw/')
                        .replace('/thumbnail/', '/raw/')
                        .split('?')[0]; // Strip old params
                    
                    // SIGN IT to fix "Auth Headers Missing" error
                    try {
                        srcUrl = await getSignedUrl(clean);
                    } catch(e) { 
                        srcUrl = clean; // Fallback
                    }
                }
                // --- WIX FIX (DATABASE LINKS) ---
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
                else {
                    srcUrl = getOptimizedUrl(rawUrl, 600); 
                }

                if (mediaType(srcUrl) === "video" || srcUrl.includes(".mp4")) {
                    contentHtml = `<div class="msg ${msgClass}" style="padding:0; background:black;"><video src="${srcUrl}" controls style="max-width:100%;"></video></div>`;
                } else {
                    // Assume Image
                    contentHtml = `<div class="msg ${msgClass}" style="padding:0;"><img src="${srcUrl}" style="max-width:100%; display:block; border-radius:inherit;" onclick="openChatPreview('${encodeURIComponent(srcUrl)}', false)"></div>`;
                }
            }
        }

        // Center Wishlist Cards specifically
        if (m.message && m.message.startsWith('WISHLIST::')) {
            return `<div class="msg-row" style="justify-content:center; margin: 10px 0;"><div class="msg-col" style="align-items:center;">${contentHtml}<div class="msg-time">${timeStr}</div></div></div>`;
        }

        // Avatar Logic (Queen Only - Inside Bubble)
        if (!isMe) {
            const avatarUrl = "https://static.wixstatic.com/media/ce3e5b_19faff471a434690b7a40aacf5bf42c4~mv2.png";
            // Inject avatar INSIDE the message bubble for Queen text messages
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
    })); // End Map

    const messagesHtml = messagesHtmlArray.join('');

    if (conversationMessages.length > visibleMessages.length) {
        // Updated HTML join logic means we need to prepend the button manually
        const btnHtml = `<div style="width:100%; text-align:center; padding:10px;"><button onclick="window.loadMoreChat()" style="background:transparent; border:none; color:#666; font-size:0.6rem;">▲ LOAD HISTORY</button></div>`;
        if (deskChat) deskChat.innerHTML = btnHtml + messagesHtml;
        if (mobChat) mobChat.innerHTML = btnHtml + messagesHtml;
    } else {
        if (deskChat) deskChat.innerHTML = messagesHtml;
        if (mobChat) mobChat.innerHTML = messagesHtml;
    }

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
    if (lastChatJson) {
        renderChat(JSON.parse(lastChatJson));
    }
}

export function sendChatMessage() {
    const dInput = document.getElementById('chatMsgInput');
    const mInput = document.getElementById('mob_chatMsgInput');

    // Determine which input is being used
    let activeInput = null;
    if (dInput && dInput.value.trim() !== "") activeInput = dInput;
    else if (mInput && mInput.value.trim() !== "") activeInput = mInput;

    if (!activeInput) return; // No text found

    const txt = activeInput.value.trim();
    window.parent.postMessage({ type: "SEND_CHAT_TO_BACKEND", text: txt }, "*");

    // Clear BOTH inputs to be safe
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
