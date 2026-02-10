// Chat functionality - FIXED FOR MODULES & LUXURY UI & SYSTEM TICKER
import { 
    lastChatJson, isInitialLoad, chatLimit, lastNotifiedMessageId 
} from './state.js';
import { 
    setLastChatJson, setIsInitialLoad, setChatLimit, setLastNotifiedMessageId 
} from './state.js'; 
import { URLS } from './config.js';
import { triggerSound } from './utils.js';
import { getSignedUrl } from './media.js';
import { mediaType } from './media.js';

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

    // 2. ANTI-BLINK
    const currentJson = JSON.stringify(sortedMessages);
    if (currentJson === lastChatJson) return;

    // 3. SCROLL CHECK
    const dBox = document.getElementById('chatBox');
    const isAtBottom = dBox ? (dBox.scrollHeight - dBox.scrollTop - dBox.clientHeight < 150) : true;
    const wasInitialLoad = isInitialLoad;

    // 4. NOTIFICATION SOUND
    if (!isInitialLoad && sortedMessages.length > 0) {
        const lastMsg = sortedMessages[sortedMessages.length - 1];
        const sender = (lastMsg.sender || "").toLowerCase().trim();
        if (lastMsg._id !== lastNotifiedMessageId && (sender === 'admin' || sender === 'queen')) {
            triggerSound('msgSound');
            setLastNotifiedMessageId(lastMsg._id);
        }
    }

    setLastChatJson(currentJson);
    setIsInitialLoad(false);

    // 5. SLICING (Show last 20)
    const activeLimit = window.innerWidth <= 768 ? 20 : chatLimit; 
    const visibleMessages = sortedMessages.slice(-activeLimit);

    // 6. RENDER LOOP
    let messagesHtml = visibleMessages.map((m, index) => {
        let txt = DOMPurify.sanitize(m.message);
        const senderLower = (m.sender || "").toLowerCase();
        const isMe = senderLower === 'user' || senderLower === 'slave';
        const isSystem = senderLower === 'system';
        const isLatest = index === visibleMessages.length - 1;

        // --- TICKER LOGIC (The Fix) ---
        // Only the VERY LATEST system message goes to the Ticker.
        // Older ones stay in history as logs.
        if (isSystem && isLatest) {
            const tickerHtml = `<span style="color:#fff;">◈</span> ${txt}`;
            if (ticker) {
                ticker.classList.remove('hidden');
                ticker.innerHTML = tickerHtml;
                ticker.classList.remove('ticker-flash');
                void ticker.offsetWidth;
                ticker.classList.add('ticker-flash');
            }
            if (mobTicker) {
                mobTicker.classList.remove('hidden');
                mobTicker.innerHTML = tickerHtml;
                mobTicker.classList.remove('ticker-flash');
                void mobTicker.offsetWidth;
                mobTicker.classList.add('ticker-flash');
            }
            // We return empty string here so it doesn't duplicate in the chat box
            return ''; 
        }

        // --- HISTORY LOGS (Old System Messages) ---
        if (isSystem) {
            // Render as a small system log instead of a bubble
            const isBad = txt.includes("FAILED") || txt.includes("Rejected") || txt.includes("PENALTY");
            const color = isBad ? "#ff003c" : "#c5a059";
            return `
                <div class="msg-row system-row">
                    <div class="msg-system" style="color:${color}; border-color:${color}40;">
                        ${txt}
                    </div>
                </div>`;
        }

        // --- NORMAL CHAT BUBBLES ---
        txt = txt.replace(/\n/g, "<br>");
        const timeStr = new Date(m._createdDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const msgClass = isMe ? 'm-slave' : 'm-queen';
        let contentHtml = `<div class="msg ${msgClass}">${txt}</div>`;

        // Media Handling
        if (m.message && (m.message.startsWith('http') || m.mediaUrl)) {
            const srcUrl = m.mediaUrl || m.message;
            if (mediaType(srcUrl) === "video") {
                contentHtml = `<div class="msg ${msgClass}" style="padding:0; background:black;"><video src="${srcUrl}" controls style="max-width:100%;"></video></div>`;
            } else if (mediaType(srcUrl) === "image") {
                contentHtml = `<div class="msg ${msgClass}" style="padding:0;"><img src="${srcUrl}" style="max-width:100%;" onclick="openChatPreview('${encodeURIComponent(srcUrl)}', false)"></div>`;
            }
        }

        return `<div class="msg-row ${isMe ? 'mr-out' : 'mr-in'}"><div class="msg-col" style="align-items:${isMe?'flex-end':'flex-start'};">${contentHtml}<div class="msg-time">${timeStr}</div></div></div>`;
    }).join(''); 

    // LOAD MORE BUTTON
    if (sortedMessages.length > visibleMessages.length) {
        messagesHtml = `<div style="width:100%; text-align:center; padding:10px;"><button onclick="window.loadMoreChat()" style="background:transparent; border:none; color:#666; font-size:0.6rem;">▲ LOAD HISTORY</button></div>` + messagesHtml;
    }

    // 7. INJECT
    if (deskChat) deskChat.innerHTML = messagesHtml;
    if (mobChat) mobChat.innerHTML = messagesHtml;

    // 8. SCROLL
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
    if(dInput) dInput.value = "";
    if(mInput) mInput.value = "";
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
