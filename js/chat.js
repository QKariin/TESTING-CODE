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
    // 1. DEFINE TARGETS (Desktop & Mobile)
    const deskChat = document.getElementById('chatContent');
    const mobChat = document.getElementById('mob_chatContent');
    const ticker = document.getElementById('systemTicker');
    const mobTicker = document.getElementById('mob_systemTicker');

    if (!messages) return;
    // We need at least one container to work
    if (!deskChat && !mobChat) return; 

    // 2. SORTING
    const sortedMessages = [...messages].sort(
        (a, b) => new Date(a._createdDate) - new Date(b._createdDate)
    );

    // 3. ANTI-BLINK (Prevent re-render if data hasn't changed)
    const currentJson = JSON.stringify(sortedMessages);
    if (currentJson === lastChatJson) return;

    // Check scroll position (Desktop acts as the "Brain" for logic)
    const dBox = document.getElementById('chatBox');
    const isAtBottom = dBox
        ? (dBox.scrollHeight - dBox.scrollTop - dBox.clientHeight < 150)
        : true;

    const wasInitialLoad = isInitialLoad;

    // 4. NOTIFICATION LOGIC
    if (!isInitialLoad && sortedMessages.length > 0) {
        const lastMsg = sortedMessages[sortedMessages.length - 1];
        const sender = (lastMsg.sender || "").toLowerCase().trim();
        if (lastMsg._id !== lastNotifiedMessageId && (sender === 'admin' || sender === 'queen')) {
            triggerSound('msgSound');
            const glassOverlay = document.getElementById('specialGlassOverlay');
            if (glassOverlay) glassOverlay.classList.add('active');
            setLastNotifiedMessageId(lastMsg._id);
        }
    }

    setLastChatJson(currentJson);
    setIsInitialLoad(false);

    // 5. SMART SLICING
    const activeLimit = window.innerWidth <= 768 ? 20 : chatLimit; 
    const visibleMessages = sortedMessages.slice(-activeLimit);

    // PROXY URLS (Bytescale signing)
    const signingPromises = visibleMessages.map(async (m) => {
        if (m.message?.startsWith("https://upcdn.io/")) {
            m.mediaUrl = await getSignedUrl(m.message);
        }
    });
    await Promise.all(signingPromises);

    // 6. RENDER HTML
    let messagesHtml = visibleMessages.map(m => {
        let txt = DOMPurify.sanitize(m.message);
        const senderLower = (m.sender || "").toLowerCase();
        const isMe = senderLower === 'user' || senderLower === 'slave';
        
        // --- INTERCEPTOR (SYSTEM MESSAGES TO TICKER) ---
        const isSystem = senderLower === 'system';
        const isStatusUpdate = txt.includes("Verified") || txt.includes("Rejected") || txt.includes("FAILED") || txt.includes("earned");

        if (isSystem || isStatusUpdate) {
            const tickerHtml = `<span style="color:#fff;">◈</span> ${txt}`;
            
            // Update Desktop Ticker
            if (ticker) {
                ticker.classList.remove('hidden');
                ticker.innerHTML = tickerHtml;
                ticker.classList.remove('ticker-flash');
                void ticker.offsetWidth;
                ticker.classList.add('ticker-flash');
            }
            // Update Mobile Ticker (CRITICAL MISSING PIECE)
            if (mobTicker) {
                mobTicker.classList.remove('hidden');
                mobTicker.innerHTML = tickerHtml;
                mobTicker.classList.remove('ticker-flash');
                void mobTicker.offsetWidth;
                mobTicker.classList.add('ticker-flash');
            }
            return ''; // Remove from chat flow
        }

        txt = txt.replace(/\n/g, "<br>");

        // TRIBUTE CARD
        if (txt.includes("TRIBUTE:")) {
            const lines = txt.split('<br>');
            const item = lines.find(l => l.includes('ITEM:'))?.replace('ITEM:', '').trim() || "Tribute";
            const cost = lines.find(l => l.includes('COST:'))?.replace('COST:', '').trim() || "0";
            return `
                <div class="msg-row mr-out">
                    <div class="tribute-card">
                        <div class="tribute-card-title">Sacrifice Validated</div>
                        <div style="color:white; font-family:'Orbitron'; font-size:1rem; margin:10px 0;">${item}</div>
                        <div style="color:var(--gold); font-weight:bold;">${cost} 🪙</div>
                    </div>
                </div>`;
        }

        // NORMAL MESSAGES
        const timeStr = new Date(m._createdDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const msgClass = isMe ? 'm-slave' : 'm-queen';
        let contentHtml = `<div class="msg ${msgClass}">${txt}</div>`;

        // MEDIA
        if (m.message && (m.message.startsWith('http') || m.mediaUrl)) {
            const srcUrl = m.mediaUrl || m.message;
            const isVideo = mediaType(srcUrl) === "video";
            const isImage = mediaType(srcUrl) === "image";

            if (isVideo) {
                contentHtml = `<div class="msg ${msgClass}" style="padding:0; background:black; overflow:hidden;"><video src="${srcUrl}" controls style="max-width:100%; display:block;" onclick="openChatPreview('${encodeURIComponent(srcUrl)}', true)"></video></div>`;
            } else if (isImage) {
                contentHtml = `<div class="msg ${msgClass}" style="padding:0; overflow:hidden;"><img src="${srcUrl}" style="max-width:100%; display:block;" onclick="openChatPreview('${encodeURIComponent(srcUrl)}', false)"></div>`;
            } else if (m.message.startsWith('http')) {
                contentHtml = `<div class="msg ${msgClass}"><a href="${srcUrl}" target="_blank">${srcUrl}</a></div>`;
            }
            return `<div class="msg-row ${isMe ? 'mr-out' : 'mr-in'}"><div class="msg-col" style="justify-content:${isMe ? 'flex-end' : 'flex-start'};">${contentHtml}<div class="msg-time">${timeStr}</div></div></div>`;
        } else {
            return `<div class="msg-row ${isMe ? 'mr-out' : 'mr-in'}"><div class="msg-col" style="align-items: ${isMe ? 'flex-end' : 'flex-start'}; width: 100%;"><div class="msg">${txt}</div><div class="msg-time">${timeStr}</div></div></div>`;
        }
    }).join(''); 

    // LOAD MORE BUTTON
    if (sortedMessages.length > visibleMessages.length) {
        const btnHtml = `<div style="width:100%; text-align:center; padding:10px 0;"><button onclick="window.loadMoreChat()" style="background:transparent; border:none; color:var(--gold); font-size:0.55rem; padding:10px;">▲ ACCESS ARCHIVE</button></div>`;
        messagesHtml = btnHtml + messagesHtml;
    }

    // 7. INJECT CONTENT INTO BOTH CONTAINERS
    if (deskChat) deskChat.innerHTML = messagesHtml;
    if (mobChat) mobChat.innerHTML = messagesHtml;

    // 8. ATTACH LISTENERS TO BOTH (The Missing Piece!)
    // This ensures that when images load on Mobile OR Desktop, it scrolls down.
    [deskChat, mobChat].forEach(container => {
        if (!container) return;
        container.querySelectorAll("img").forEach(img => {
            img.addEventListener("load", () => setTimeout(forceBottom, 30));
        });
        container.querySelectorAll("video").forEach(v => {
            v.addEventListener("loadedmetadata", () => setTimeout(forceBottom, 30));
        });
    });

    // 9. SCROLL TO BOTTOM
    if (wasInitialLoad || isAtBottom) {
        forceBottom();
    }
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
