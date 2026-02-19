// src/scripts/chat.ts
// Chat functionality - Converted to TypeScript

import {
    lastChatJson, isInitialLoad, chatLimit, lastNotifiedMessageId,
    setLastChatJson, setIsInitialLoad, setChatLimit, setLastNotifiedMessageId
} from './state';
import { URLS } from './config';
import { triggerSound } from './utils';
import { getSignedUrl, getOptimizedUrl, mediaType } from './media';

let lastTickerText = "";

// Mocking DOMPurify if not available globally (it usually needs to be installed via npm)
// In a real project, you would import it: import DOMPurify from 'dompurify';
const DOMPurify = (globalThis as any).DOMPurify || { sanitize: (s: string) => s };

export async function renderChat(messages: any[]) {
    const deskChat = document.getElementById('chatContent');
    const mobChat = document.getElementById('mob_chatContent');
    const ticker = document.getElementById('systemTicker');
    const mobTicker = document.getElementById('mob_systemTicker');

    if (!messages) return;
    if (!deskChat && !mobChat) return;

    // 1. SORT
    const sortedMessages = [...messages].sort(
        (a, b) => new Date(a._createdDate).getTime() - new Date(b._createdDate).getTime()
    );

    // 2. FILTER STREAMS
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
        const txt = DOMPurify.sanitize(latest.message);
        if (txt !== lastTickerText) {
            lastTickerText = txt;
            const tickerHtml = `<span style="color:#fff;">◈</span> ${txt}`;
            [ticker, mobTicker].forEach(el => {
                if (el) {
                    el.classList.remove('hidden');
                    el.innerHTML = tickerHtml;
                    el.classList.remove('ticker-flash');
                    void (el as HTMLElement).offsetWidth;
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

    // 5. RENDER CHAT
    const activeLimit = (globalThis as any).innerWidth <= 768 ? 20 : chatLimit;
    const visibleMessages = conversationMessages.slice(-activeLimit);

    const messagesHtmlArray = await Promise.all(visibleMessages.map(async (m) => {
        let txt = DOMPurify.sanitize(m.message);
        const senderLower = (m.sender || "").toLowerCase();
        const isMe = senderLower === 'user' || senderLower === 'slave';

        txt = txt.replace(/\n/g, "<br>");
        const timeStr = new Date(m._createdDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const msgClass = isMe ? 'm-slave' : 'm-queen';
        let contentHtml = `<div class="msg ${msgClass}">${txt}</div>`;

        // --- MEDIA HANDLER ---
        if (m.message) {

            // A. WISHLIST CARD
            if (m.message.startsWith('WISHLIST::')) {
                try {
                    const jsonStr = m.message.replace('WISHLIST::', '');
                    const item = JSON.parse(jsonStr);

                    let cardImgUrl = item.img || item.image || item.itemImage || "";
                    if (cardImgUrl && cardImgUrl.includes('upcdn.io')) {
                        let clean = cardImgUrl.replace('/image/', '/raw/').replace('/thumbnail/', '/raw/').split('?')[0];
                        try { cardImgUrl = await getSignedUrl(clean); }
                        catch (e) { cardImgUrl = clean; }
                    }

                    contentHtml = `
                    <div class="msg-wishlist-card" style="margin: 0 auto; padding:0; overflow:hidden; background:linear-gradient(180deg, #1a1a1a, #000); border:1px solid #c5a059; border-radius:4px; max-width:200px; width:60vw;">
                        <div style="width:100%; height:120px; overflow:hidden; position:relative;">
                             <img src="${cardImgUrl}" onload="window.forceBottom()" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'">
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

            // B. STANDARD MEDIA
            else if (m.message.startsWith('http') || m.mediaUrl || m.message.includes('wix:') || m.message.includes('upcdn')) {
                const rawUrl = m.mediaUrl || m.message;
                let srcUrl = rawUrl;

                if (rawUrl.includes('upcdn.io')) {
                    let clean = rawUrl.replace('/image/', '/raw/').replace('/thumbnail/', '/raw/').split('?')[0];
                    try { srcUrl = await getSignedUrl(clean); } catch (e) { srcUrl = clean; }
                }
                else if (rawUrl.includes('wix:image')) {
                    const parts = rawUrl.split('/');
                    for (let i = 0; i < parts.length; i++) {
                        if (parts[i] === 'v1' && parts[i + 1]) {
                            srcUrl = `https://static.wixstatic.com/media/${parts[i + 1].split('#')[0]}`;
                            break;
                        }
                    }
                }
                else if (rawUrl.includes('wix:video')) {
                    const parts = rawUrl.split('/');
                    for (let i = 0; i < parts.length; i++) {
                        if (parts[i] === 'v1' && parts[i + 1]) {
                            srcUrl = `https://video.wixstatic.com/video/${parts[i + 1].split('#')[0]}/mp4/file.mp4`;
                            break;
                        }
                    }
                }
                else {
                    srcUrl = getOptimizedUrl(rawUrl, 600);
                }

                const isVideo = mediaType(srcUrl) === "video" || srcUrl.includes(".mp4");

                if (isVideo) {
                    contentHtml = `<div class="msg ${msgClass}" style="padding:0; background:black;"><video src="${srcUrl}" onloadeddata="window.forceBottom()" controls style="max-width:100%; border-radius:inherit;"></video></div>`;
                } else {
                    contentHtml = `<div class="msg ${msgClass}" style="padding:0; overflow:hidden; width:fit-content;">
                        <img src="${srcUrl}" onload="window.forceBottom()" style="max-height:300px; width:auto; max-width:100%; display:block; border-radius:inherit;" onclick="openChatPreview('${encodeURIComponent(srcUrl)}', false)">
                    </div>`;
                }
            }
        }

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

    if (conversationMessages.length > visibleMessages.length) {
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
    if (lastChatJson) renderChat(JSON.parse(lastChatJson));
}

export function sendChatMessage() {
    const dInput = document.getElementById('chatMsgInput') as HTMLInputElement;
    const mInput = document.getElementById('mob_chatMsgInput') as HTMLInputElement;
    let activeInput: HTMLInputElement | null = null;
    if (dInput && dInput.value.trim() !== "") activeInput = dInput;
    else if (mInput && mInput.value.trim() !== "") activeInput = mInput;

    if (!activeInput) return;

    window.parent.postMessage({ type: "SEND_CHAT_TO_BACKEND", text: activeInput.value.trim() }, "*");
    if (dInput) dInput.value = "";
    if (mInput) mInput.value = "";
}

export function handleChatKey(e: KeyboardEvent) {
    if (e.key === 'Enter') sendChatMessage();
}

export function sendCoins(amount: number) {
    window.parent.postMessage({ type: "SEND_COINS", amount: amount, category: "Tribute" }, "*");
}

export function openChatPreview(url: string, isVideo: boolean) {
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
(window as any).loadMoreChat = loadMoreChat;
(window as any).openChatPreview = openChatPreview;
(window as any).closeChatPreview = closeChatPreview;
(window as any).forceBottom = forceBottom;
