// Chat functionality - FIXED FOR MODULES
import { 
    lastChatJson, isInitialLoad, chatLimit, lastNotifiedMessageId 
} from './state.js';
import { 
    setLastChatJson, setIsInitialLoad, setChatLimit, setLastNotifiedMessageId 
} from './state.js'; // IMPORT THE SETTERS
import { URLS } from './config.js';
import { triggerSound } from './utils.js';

export function renderChat(messages) {
    const chatBoxContainer = document.getElementById('chatBox');
    const chatContent = document.getElementById('chatContent');
    const loadMoreBtn = document.getElementById('chatLoadMoreBtn');

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

    if (loadMoreBtn)
        loadMoreBtn.style.display = sortedMessages.length > chatLimit ? 'block' : 'none';

    const visibleMessages = sortedMessages.slice(
        Math.max(sortedMessages.length - chatLimit, 0)
    );

    // 4. RENDER HTML
    chatContent.innerHTML = visibleMessages.map(m => {
        let txt = (m.message || "").replace(/<[^>]+>/g, "").trim();
        const isMe = m.sender === 'user';
        const isSystem = m.sender === 'system';

        if (isSystem) {
            let sysClass = "";
            let sysIcon = "#icon-check";
            const lower = txt.toLowerCase();

            if (lower.includes("tribute") || lower.includes("coins")) {
                sysClass = "sys-gold"; sysIcon = "#icon-coin";
            } else if (lower.includes("insufficient") || lower.includes("rejected")) {
                sysClass = "sys-red"; sysIcon = "#icon-close";
            }

            return `
                <div class="msg-row system-row">
                    <div class="msg-system ${sysClass}">
                        <svg class="sys-icon"><use href="${sysIcon}"></use></svg>
                        ${txt}
                    </div>
                </div>`;
        }

        let msgClass = isMe ? 'm-slave' : 'm-queen';
        if (!isMe) {
            if (txt.includes("Verified")) msgClass = 'm-approve';
            else if (txt.includes("Rejected")) msgClass = 'm-reject';
        }

        let contentHtml = `<div class="msg ${msgClass}">${txt}</div>`;

        // MEDIA DETECTION
        if (m.message && m.message.startsWith('http')) {
            const url = m.message.toLowerCase();

            const isVideo = url.match(/\.(mp4|webm|mov)(\?|$)/);
            const isImage = url.match(/\.(jpg|jpeg|png|gif|webp|avif|bmp|svg)(\?|$)/);

            if (isVideo) {
                contentHtml = `
                    <div class="msg ${msgClass}" style="padding:0; background:black;">
                        <video 
                            src="${m.message}" 
                            controls 
                            style="max-width:100%; border-radius:8px; display:block; cursor:pointer;"
                            onclick="openChatPreview('${encodeURIComponent(m.message)}', true)">
                        </video>
                    </div>`;
            } 
            else if (isImage) {
                contentHtml = `
                    <div class="msg ${msgClass}" style="padding:0;">
                        <img 
                            src="${m.message}" 
                            style="max-width:100%; border-radius:8px; display:block; cursor:pointer;"
                            onclick="openChatPreview('${encodeURIComponent(m.message)}', false)">
                    </div>`;
            } 
            else {
                // Normal link
                contentHtml = `
                    <div class="msg ${msgClass}">
                        <a href="${m.message}" target="_blank" rel="noopener noreferrer">${m.message}</a>
                    </div>`;
            }
        }

        const avatar = isMe ? "" : `<img src="${URLS.QUEEN_AVATAR}" class="msg-avatar">`;
        const timeStr = new Date(m._createdDate).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <div class="msg-row ${isMe ? 'mr-out' : 'mr-in'}">
                ${avatar}
                <div class="msg-col" style="justify-content:${isMe ? 'flex-end' : 'flex-start'};">
                    ${contentHtml}
                    <div class="msg-time">${timeStr}</div>
                </div>
            </div>`;
    }).join('');

    // 5. ATTACH MEDIA LOAD LISTENERS (Fixes scroll issue)
    chatContent.querySelectorAll("img").forEach(img => {
        img.addEventListener("load", () => {
            setTimeout(forceBottom, 30);
        });
    });

    chatContent.querySelectorAll("video").forEach(video => {
        video.addEventListener("loadedmetadata", () => {
            setTimeout(forceBottom, 30);
        });
    });

    // 6. AUTO-SCROLL
    if (wasInitialLoad || isAtBottom) {
        forceBottom();
    }
}

export function forceBottom() {
    const b = document.getElementById('chatBox');
    if (b) b.scrollTop = b.scrollHeight;
}

export function loadMoreChat() {
    setChatLimit(chatLimit + 10); // FIXED: Using Setter
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
    container.innerHTML = ""; // stops video + clears image
}