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

    // 1. SORT ALL MESSAGES BY TIME
    const sortedMessages = [...messages].sort(
        (a, b) => new Date(a._createdDate) - new Date(b._createdDate)
    );

    // 2. SEPARATE THE STREAMS (The Logic Fix)
    
    // Stream A: System Messages (For the Ticker)
    const systemMessages = sortedMessages.filter(m => (m.sender || "").toLowerCase() === 'system');
    
    // Stream B: Conversation (For the Chat Window)
    const conversationMessages = sortedMessages.filter(m => (m.sender || "").toLowerCase() !== 'system');

    // 3. UPDATE TICKER (Top Bar)
    // We take the ABSOLUTE LATEST system message, no matter how old it is vs conversation
    if (systemMessages.length > 0) {
        const latestSys = systemMessages[systemMessages.length - 1];
        const txt = DOMPurify.sanitize(latestSys.message);
        const tickerHtml = `<span style="color:#fff;">◈</span> ${txt}`;

        if (ticker) {
            ticker.classList.remove('hidden');
            ticker.innerHTML = tickerHtml;
            // Trigger Flash Animation
            ticker.classList.remove('ticker-flash');
            void ticker.offsetWidth;
            ticker.classList.add('ticker-flash');
        }
        if (mobTicker) {
            mobTicker.classList.remove('hidden');
            mobTicker.innerHTML = tickerHtml;
            // Trigger Flash Animation
            mobTicker.classList.remove('ticker-flash');
            void mobTicker.offsetWidth; 
            mobTicker.classList.add('ticker-flash');
        }
    }

    // 4. ANTI-BLINK (Check against Conversation Stream only)
    const currentJson = JSON.stringify(conversationMessages);
    if (currentJson === lastChatJson) return;

    // 5. SCROLL CHECK
    const dBox = document.getElementById('chatBox');
    const isAtBottom = dBox ? (dBox.scrollHeight - dBox.scrollTop - dBox.clientHeight < 150) : true;
    const wasInitialLoad = isInitialLoad;

    // 6. NOTIFICATIONS (Sound)
    if (!isInitialLoad && conversationMessages.length > 0) {
        const lastMsg = conversationMessages[conversationMessages.length - 1];
        if (lastMsg._id !== lastNotifiedMessageId) {
            triggerSound('msgSound');
            setLastNotifiedMessageId(lastMsg._id);
        }
    }

    setLastChatJson(currentJson);
    setIsInitialLoad(false);

    // 7. SLICING (Show Last X Conversation Items)
    // We slice from conversationMessages, so even if there are 100 system logs, 
    // we still show 20 real chat messages.
    const activeLimit = window.innerWidth <= 768 ? 20 : chatLimit; 
    const visibleMessages = conversationMessages.slice(-activeLimit);

    // 8. RENDER CHAT BUBBLES
    let messagesHtml = visibleMessages.map((m) => {
        let txt = DOMPurify.sanitize(m.message);
        const senderLower = (m.sender || "").toLowerCase();
        const isMe = senderLower === 'user' || senderLower === 'slave';
        
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
    if (conversationMessages.length > visibleMessages.length) {
        messagesHtml = `<div style="width:100%; text-align:center; padding:10px;"><button onclick="window.loadMoreChat()" style="background:transparent; border:none; color:#666; font-size:0.6rem;">▲ LOAD HISTORY</button></div>` + messagesHtml;
    }

    // 9. INJECT
    if (deskChat) deskChat.innerHTML = messagesHtml;
    if (mobChat) mobChat.innerHTML = messagesHtml;

    // 10. SCROLL
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
