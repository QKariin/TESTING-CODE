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
    const chatBoxContainer = document.getElementById('chatBox');
    const chatContent = document.getElementById('chatContent');
    const loadMoreBtn = document.getElementById('chatLoadMoreBtn'); // External button (hidden)
    const ticker = document.getElementById('systemTicker'); // [NEW] Target the Ticker

    if (!messages || !chatContent) return;

    // 1. SORTING
    const sortedMessages = [...messages].sort(
        (a, b) => new Date(a._createdDate) - new Date(b._createdDate)
    );

    // 2. ANTI-BLINK
    const currentJson = JSON.stringify(sortedMessages);
    if (currentJson === lastChatJson) return;

    const isAtBottom = chatBoxContainer
        ? (chatBoxContainer.scrollHeight - chatBoxContainer.scrollTop - chatBoxContainer.clientHeight < 150)
        : false;

    const wasInitialLoad = isInitialLoad;

    // 3. NOTIFICATION LOGIC
    if (!isInitialLoad && sortedMessages.length > 0) {
        const lastMsg = sortedMessages[sortedMessages.length - 1];
        const sender = (lastMsg.sender || "").toLowerCase().trim();

        if (
            lastMsg._id !== lastNotifiedMessageId &&
            (sender === 'admin' || sender === 'queen')
        ) {
            triggerSound('msgSound');
            const glassOverlay = document.getElementById('specialGlassOverlay');
            if (glassOverlay) glassOverlay.classList.add('active');
            setLastNotifiedMessageId(lastMsg._id);
        }
    }

    setLastChatJson(currentJson);
    setIsInitialLoad(false);

    // Hide old external button
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';

    // ============================================================
    // 4. SMART SLICING
    // ============================================================
    const activeLimit = window.innerWidth <= 768 ? 10 : chatLimit;
    const visibleMessages = sortedMessages.slice(-activeLimit);

    // Proxy Bytescale URLs
    const signingPromises = visibleMessages.map(async (m) => {
        if (m.message?.startsWith("https://upcdn.io/")) {
            m.mediaUrl = await getSignedUrl(m.message);
        }
    });
    await Promise.all(signingPromises);

    // 5. RENDER HTML
    let messagesHtml = visibleMessages.map(m => {
        let txt = DOMPurify.sanitize(m.message);
        
        const senderLower = (m.sender || "").toLowerCase();
        const isMe = senderLower === 'user' || senderLower === 'slave';
        
        // --- 1. INTERCEPTOR LOGIC (Send System Msgs to Ticker) ---
        const isSystem = senderLower === 'system';
        const isStatusUpdate = txt.includes("Verified") || txt.includes("Rejected") || txt.includes("FAILED") || txt.includes("earned") || txt.includes("System");

        if (isSystem || isStatusUpdate) {
            // ONLY UPDATE TICKER IF IT EXISTS
            if (ticker) {
                ticker.classList.remove('hidden');
                ticker.innerHTML = `<span style="color:#fff;">◈</span> ${txt}`;
                
                // Trigger Flash Animation
                ticker.classList.remove('ticker-flash');
                void ticker.offsetWidth; // Force Reflow
                ticker.classList.add('ticker-flash');
            }
            return ''; // STOP. Do not print this to the chat log.
        }

        // --- 2. NORMAL CHAT LOGIC ---
        txt = txt.replace(/\n/g, "<br>");

        // TRIBUTE CARD LOGIC
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

        // MEDIA DETECTION
        if (m.message && (m.message.startsWith('http') || m.mediaUrl)) {
            const originalUrl = m.message.toLowerCase();
            const srcUrl = m.mediaUrl || m.message;
            const isVideo = mediaType(srcUrl) === "video";
            const isImage = mediaType(srcUrl) === "image";

            if (isVideo) {
                contentHtml = `
                    <div class="msg ${msgClass}" style="padding:0; background:black; overflow:hidden;">
                        <video src="${srcUrl}" controls style="max-width:100%; display:block; cursor:pointer;"
                               onclick="openChatPreview('${encodeURIComponent(srcUrl)}', true)">
                        </video>
                    </div>`;
            } else if (isImage) {
                contentHtml = `
                    <div class="msg ${msgClass}" style="padding:0; overflow:hidden;">
                        <img src="${srcUrl}" style="max-width:100%; display:block; cursor:pointer;"
                             onclick="openChatPreview('${encodeURIComponent(srcUrl)}', false)">
                    </div>`;
            } else if (m.message.startsWith('http')) {
                contentHtml = `<div class="msg ${msgClass}"><a href="${srcUrl}" target="_blank" rel="noopener noreferrer">${srcUrl}</a></div>`;
            }
            
            return `
                <div class="msg-row ${isMe ? 'mr-out' : 'mr-in'}">
                    <div class="msg-col" style="justify-content:${isMe ? 'flex-end' : 'flex-start'};">
                        ${contentHtml}
                        <div class="msg-time">${timeStr}</div>
                    </div>
                </div>`;
        }
        else {
            return `
                <div class="msg-row ${isMe ? 'mr-out' : 'mr-in'}">
                    <div class="msg-col" style="align-items: ${isMe ? 'flex-end' : 'flex-start'}; width: 100%;">
                        <div class="msg">${txt}</div>
                        <div class="msg-time">${timeStr}</div>
                    </div>
                </div>`;
        }
    }).join(''); 

    // ============================================================
    // 6. INJECT "ACCESS ARCHIVE" BUTTON
    // ============================================================
    if (sortedMessages.length > visibleMessages.length) {
        messagesHtml = `
            <div id="historyTrigger" style="width:100%; text-align:center; padding:15px 0;">
                <button onclick="window.loadMoreChat()" style="
                    background: transparent; 
                    border: 1px solid var(--gold); 
                    color: var(--gold); 
                    font-family: 'Orbitron', sans-serif; 
                    font-size: 0.65rem; 
                    padding: 8px 20px; 
                    cursor: pointer; 
                    letter-spacing: 2px;
                ">
                    ▲ ACCESS ARCHIVE
                </button>
            </div>
        ` + messagesHtml;
    }

    // APPLY TO DOM
    chatContent.innerHTML = messagesHtml;

    // Load Listeners
    chatContent.querySelectorAll("img").forEach(img => {
        img.addEventListener("load", () => setTimeout(forceBottom, 30));
    });
    chatContent.querySelectorAll("video").forEach(v => {
        v.addEventListener("loadedmetadata", () => setTimeout(forceBottom, 30));
    });

    if (wasInitialLoad || isAtBottom) {
        forceBottom();
    }
}

export function forceBottom() {
    const b = document.getElementById('chatBox');
    if (b) b.scrollTop = b.scrollHeight;
}

export function loadMoreChat() {
    setChatLimit(chatLimit + 10);
    if (lastChatJson) {
        renderChat(JSON.parse(lastChatJson));
    }
}

export function sendChatMessage() {
    const input = document.getElementById('chatMsgInput');
    const txt = input?.value.trim();
    if (!txt) return;
    window.parent.postMessage({ type: "SEND_CHAT_TO_BACKEND", text: txt }, "*");
    input.value = "";
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
