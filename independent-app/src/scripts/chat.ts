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
        (a, b) => new Date(a.created_at || a._createdDate).getTime() - new Date(b.created_at || b._createdDate).getTime()
    );

    // 2. FILTER STREAMS
    const systemMessages = sortedMessages.filter(m => {
        const s = (m.sender_email || m.sender || "").toLowerCase();
        const txt = (m.content || m.message || "");
        if (txt.startsWith('WISHLIST::')) return false;
        return s === 'system' || txt.includes("Task Verified") || txt.includes("Task Rejected");
    });

    const conversationMessages = sortedMessages.filter(m => {
        const s = (m.sender_email || m.sender || "").toLowerCase();
        const txt = (m.content || m.message || "");
        if (txt.startsWith('WISHLIST::')) return true;
        return s !== 'system' && !txt.includes("Task Verified") && !txt.includes("Task Rejected");
    });

    // 3. TICKER & LOGS

    // Render the System Log Interface
    const deskSysLog = document.getElementById('systemLogContent');
    const mobSysLog = document.getElementById('mob_systemLogContent');

    if (systemMessages.length > 0) {
        // Ticker Logic
        // Full Log HTML construction - Always render this so the list is repopulated on load
        const sysLogArray = [...systemMessages].reverse().map(m => {
            const timeStr = new Date(m.created_at || m._createdDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `
            <div style="display:flex; flex-direction:column; background:rgba(255,255,255,0.02); border-left:2px solid #c5a059; padding:10px 15px; margin-bottom:10px;">
                <span style="font-family:'Cinzel'; color:#c5a059; font-size:0.85rem;">${DOMPurify.sanitize(m.content || m.message)}</span>
                <span style="font-family:'Orbitron'; color:rgba(255,255,255,0.3); font-size:0.6rem; margin-top:5px;">${timeStr}</span>
            </div>`;
        });

        const sysLogHtml = sysLogArray.join('');
        if (deskSysLog) deskSysLog.innerHTML = sysLogHtml;
        if (mobSysLog) mobSysLog.innerHTML = sysLogHtml;

        const latest = systemMessages[systemMessages.length - 1];
        const txt = DOMPurify.sanitize(latest.content || latest.message);

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
        const lastId = lastMsg.id || lastMsg._id;
        if (lastId !== lastNotifiedMessageId) {
            triggerSound('msgSound');
            setLastNotifiedMessageId(lastId);
        }
    }

    setLastChatJson(currentJson);
    setIsInitialLoad(false);

    // 5. RENDER CHAT
    const activeLimit = (globalThis as any).innerWidth <= 768 ? 20 : chatLimit;
    const visibleMessages = conversationMessages.slice(-activeLimit);

    const messagesHtmlArray = await Promise.all(visibleMessages.map(async (m) => {
        const originalMsg = m.content || m.message || "";
        let txt = DOMPurify.sanitize(originalMsg);
        const senderLower = (m.sender_email || m.sender || "").toLowerCase();
        const isMe = senderLower === 'user' || senderLower === 'slave';
        const isQueen = m.metadata?.isQueen || (!isMe && senderLower !== 'system');

        txt = txt.replace(/\n/g, "<br>");
        const timeStr = new Date(m.created_at || m._createdDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const msgClass = isMe ? 'm-slave' : 'm-queen';
        let contentHtml = `<div class="msg ${msgClass}">${txt}</div>`;

        // --- MEDIA HANDLER ---
        if (originalMsg) {

            // A. WISHLIST CARD
            if (originalMsg.startsWith('WISHLIST::')) {
                try {
                    const jsonStr = originalMsg.replace('WISHLIST::', '');
                    const item = JSON.parse(jsonStr);

                    let cardImgUrl = item.img || item.image || item.itemImage || "";
                    if (cardImgUrl && cardImgUrl.includes('upcdn.io')) {
                        const opt = getOptimizedUrl(cardImgUrl, 300);
                        try { cardImgUrl = await getSignedUrl(opt); }
                        catch (e) { cardImgUrl = opt; }
                    }

                    contentHtml = `
                    <div class="msg-wishlist-card" style="margin:0 auto; overflow:hidden; background:#0a0a14; border:1px solid rgba(197,160,89,0.35); border-radius:14px; max-width:220px; width:60vw; box-shadow:0 8px 30px rgba(0,0,0,0.5);">
                        <div style="width:100%; height:130px; overflow:hidden; position:relative; background:#050510;">
                             <img src="${cardImgUrl}" onload="window.forceBottom()" style="width:100%; height:100%; object-fit:contain; padding:8px; box-sizing:border-box;" onerror="this.style.display='none'">
                             <div style="position:absolute; inset:0; background:linear-gradient(to bottom, transparent 50%, rgba(10,10,20,0.8) 100%);"></div>
                             <div style="position:absolute; top:8px; right:8px; background:rgba(5,5,20,0.9); border:1px solid rgba(197,160,89,0.6); border-radius:20px; padding:3px 9px; display:flex; align-items:center; gap:4px; backdrop-filter:blur(6px);">
                                 <span style="font-family:'Orbitron', sans-serif; font-size:0.6rem; color:#c5a059; font-weight:700; letter-spacing:1px;"><i class="fas fa-coins" style="font-size:0.55rem; color:#c5a059;"></i> ${item.price ? Number(item.price).toLocaleString() : ''}</span>
                             </div>
                        </div>
                        <div style="padding:10px 13px 13px;">
                            <div style="font-family:'Orbitron', sans-serif; font-size:0.45rem; color:rgba(197,160,89,0.5); letter-spacing:2px; text-transform:uppercase; margin-bottom:5px;">✦ Gift Sent</div>
                            <div style="font-family:'Cinzel', serif; font-size:0.75rem; color:#fff; font-weight:700; letter-spacing:1px; text-transform:uppercase; line-height:1.3;">${item.name || item.title || ''}</div>
                            ${item.sender ? `<div style="font-family:'Orbitron', sans-serif; font-size:0.45rem; color:rgba(255,255,255,0.35); margin-top:5px; letter-spacing:1px;">by ${item.sender}</div>` : ''}
                        </div>
                    </div>`;
                } catch (e) {
                    contentHtml = `<div class="msg ${msgClass}">🎁 TRIBUTE ERROR</div>`;
                }
            }

            // B. STANDARD MEDIA
            else if (originalMsg.startsWith('http') || m.mediaUrl || originalMsg.includes('wix:') || originalMsg.includes('upcdn')) {
                const rawUrl = m.mediaUrl || originalMsg;
                let srcUrl = rawUrl;

                if (rawUrl.includes('upcdn.io')) {
                    const opt = getOptimizedUrl(rawUrl, 600);
                    try { srcUrl = await getSignedUrl(opt); } catch (e) { srcUrl = opt; }
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

        if (originalMsg && originalMsg.startsWith('WISHLIST::')) {
            return `<div class="msg-row" style="justify-content:center; margin: 10px 0;"><div class="msg-col" style="align-items:center;">${contentHtml}<div class="msg-time">${timeStr}</div></div></div>`;
        }

        const avatarUrl = "/queen-karin.png";
        if (!isMe && !originalMsg.startsWith('WISHLIST::') && !originalMsg.startsWith('http')) {
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
export function toggleSystemLog(isMob = false) {
    if (isMob) {
        const d = document.getElementById('mobSystemLogContainer');
        if (!d) return;
        if (d.style.display === 'none' || d.classList.contains('hidden')) {
            d.classList.remove('hidden');
            d.style.display = 'flex';
        } else {
            d.classList.add('hidden');
            d.style.display = 'none';
        }
    } else {
        const d = document.getElementById('systemLogContainer');
        if (!d) return;
        if (d.style.display === 'none' || d.classList.contains('hidden')) {
            d.classList.remove('hidden');
            d.style.display = 'flex';
        } else {
            d.classList.add('hidden');
            d.style.display = 'none';
        }
    }
}

if (typeof window !== 'undefined') {
    (window as any).loadMoreChat = loadMoreChat;
    (window as any).openChatPreview = openChatPreview;
    (window as any).closeChatPreview = closeChatPreview;
    (window as any).forceBottom = forceBottom;
    (window as any).toggleSystemLog = toggleSystemLog;
}
