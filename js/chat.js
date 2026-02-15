// Chat functionality - FINAL FIXED VERSION
import {
    lastChatJson, isInitialLoad, chatLimit, lastNotifiedMessageId,
    setLastChatJson, setIsInitialLoad, setChatLimit, setLastNotifiedMessageId
} from './state.js';
import { URLS } from './config.js';
import { triggerSound } from './utils.js';
import { getOptimizedUrl, mediaType } from './media.js';

// Global variable for Anti-Blink Ticker
let lastTickerText = "";

export async function renderChat(messages) {
    const deskChat = document.getElementById('chatContent');
    const mobChat = document.getElementById('mob_chatContent');
    const ticker = document.getElementById('systemTicker');
    const mobTicker = document.getElementById('mob_systemTicker');

    if (!messages) return;
    if (!deskChat && !mobChat) return;

    // 1. SORT (Oldest to Newest)
    const sortedMessages = [...messages].sort(
        (a, b) => new Date(a._createdDate) - new Date(b._createdDate)
    );

    // 2. SEPARATE STREAMS
    const systemMessages = sortedMessages.filter(m => {
        const s = (m.sender || "").toLowerCase();
        const txt = (m.message || "");
        
        // Wishlist items are NOT ticker messages
        if (txt.startsWith('WISHLIST::')) return false;

        return s === 'system' ||
            txt.includes("Task Verified") ||
            txt.includes("Task Rejected") ||
            txt.includes("FAILURE RECORDED") ||
            txt.includes("earned");
    });

    const conversationMessages = sortedMessages.filter(m => {
        const s = (m.sender || "").toLowerCase();
        const txt = (m.message || "");

        // Wishlist items ARE conversation messages
        if (txt.startsWith('WISHLIST::')) return true;

        return s !== 'system' &&
            !txt.includes("Task Verified") &&
            !txt.includes("Task Rejected") &&
            !txt.includes("FAILURE RECORDED") &&
            !txt.includes("earned");
    });

    // 3. TICKER LOGIC
    if (systemMessages.length > 0) {
        const latest = systemMessages[systemMessages.length - 1];
        // Ensure DOMPurify exists, otherwise fallback
        const txt = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(latest.message) : latest.message;

        if (txt !== lastTickerText) {
            lastTickerText = txt;
            const tickerHtml = `<span style="color:#fff;">◈</span> ${txt}`;

            [ticker, mobTicker].forEach(el => {
                if (el) {
                    el.classList.remove('hidden');
                    el.innerHTML = tickerHtml;
                    el.classList.remove('ticker-flash');
                    void el.offsetWidth; // Force Reflow
                    el.classList.add('ticker-flash');
                }
            });
        } else {
            [ticker, mobTicker].forEach(el => {
                if (el) el.classList.remove('hidden');
            });
        }
    }

    // 4. CHECK FOR UPDATES
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

    // 5. RENDER CHAT BUBBLES
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

        // --- MEDIA HANDLER (IMAGES / VIDEO / WISHLIST) ---
        if (m.message) {
            // A. WISHLIST CARD
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
                    contentHtml = `<div class="msg ${msgClass}">🎁 TRIBUTE ERROR</div>`;
                }
            }
            // B. IMAGES & VIDEOS (SAFER ID EXTRACTION)
            else if (m.message.startsWith('http') || m.mediaUrl || m.message.includes('wix:image') || m.message.includes('wix:video')) {
                let rawUrl = m.mediaUrl || m.message;
                let srcUrl = rawUrl;
                let isVideo = false;

                console.log("Processing Media URL:", rawUrl); // Check Console (F12) to see the real link

                // --- WIX URL FIXER (SPLIT METHOD) ---
                if (rawUrl.includes('wix:image')) {
                    try {
                        // 1. Remove the protocol prefix to isolate the rest
                        // Handles "wix:image://v1/" OR "wix:image://V1/"
                        let cleanPath = rawUrl.replace(/wix:image:\/\/v1\//i, "").replace(/wix:image:\/\//i, "");
                        
                        // 2. The ID is now the first part before the next slash
                        const id = cleanPath.split('/')[0].split('#')[0]; 

                        // 3. Build the Simple Web Link (No filters initially to ensure it works)
                        srcUrl = `https://static.wixstatic.com/media/${id}`;
                        
                    } catch(e) { console.error("Chat Image Error:", e); }
                } 
                else if (rawUrl.includes('wix:video')) {
                    try {
                        let cleanPath = rawUrl.replace(/wix:video:\/\/v1\//i, "").replace(/wix:video:\/\//i, "");
                        const id = cleanPath.split('/')[0].split('#')[0];
                        srcUrl = `https://video.wixstatic.com/video/${id}/mp4/file.mp4`;
                        isVideo = true;
                    } catch(e) { console.error("Chat Video Error:", e); }
                }
                // --- STANDARD URLS ---
                else {
                    srcUrl = getOptimizedUrl(rawUrl, 600);
                    if (/\.(mp4|mov|webm)($|\?)/i.test(srcUrl)) {
                        isVideo = true;
                    }
                }

                // Render
                if (isVideo) {
                    contentHtml = `<div class="msg ${msgClass}" style="padding:0; background:black;"><video src="${srcUrl}" controls style="max-width:100%; border-radius:inherit;"></video></div>`;
                } else {
                    contentHtml = `<div class="msg ${msgClass}" style="padding:0;"><img src="${srcUrl}" style="max-width:100%; display:block; border-radius:inherit; cursor:pointer;" onclick="openChatPreview('${encodeURIComponent(srcUrl)}', false)" onerror="this.style.display='none';"></div>`;
                }
            }
        }

        // Center Wishlist Cards
        if (m.message && m.message.startsWith('WISHLIST::')) {
            return `<div class="msg-row" style="justify-content:center; margin: 10px 0;"><div class="msg-col" style="align-items:center;">${contentHtml}<div class="msg-time">${timeStr}</div></div></div>`;
        }

        // Queen Avatar Logic
        if (!isMe) {
            const avatarUrl = "https://static.wixstatic.com/media/ce3e5b_19faff471a434690b7a40aacf5bf42c4~mv2.png";
            // Don't show avatar for media/cards, only text
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

    // Load History Button
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
    if (lastChatJson) {
        renderChat(JSON.parse(lastChatJson));
    }
}

export function sendChatMessage() {
    const dInput = document.getElementById('chatMsgInput');
    const mInput = document.getElementById('mob_chatMsgInput');

    let activeInput = null;
    if (dInput && dInput.value.trim() !== "") activeInput = dInput;
    else if (mInput && mInput.value.trim() !== "") activeInput = mInput;

    if (!activeInput) return;

    const txt = activeInput.value.trim();
    window.parent.postMessage({ type: "SEND_CHAT_TO_BACKEND", text: txt }, "*");

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
    if (!overlay || !container) return;
    overlay.classList.add('hidden');
    container.innerHTML = "";
}

// Global Exports
window.loadMoreChat = loadMoreChat;
window.openChatPreview = openChatPreview;
window.closeChatPreview = closeChatPreview;
