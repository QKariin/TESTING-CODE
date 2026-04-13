// src/scripts/chat.ts
// Chat functionality - Converted to TypeScript

import {
    lastChatJson, isInitialLoad, chatLimit, lastNotifiedMessageId,
    setLastChatJson, setIsInitialLoad, setChatLimit, setLastNotifiedMessageId
} from './state';
import { URLS } from './config';
import { triggerSound } from './utils';
import { getOptimizedUrl, mediaType } from './media';

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
    const _isSystem = (m: any) => {
        const s = (m.sender_email || m.sender || "").toLowerCase();
        const txt = (m.content || m.message || "");
        if (txt.startsWith('WISHLIST::') || txt.startsWith('TASK_FEEDBACK::') || txt.startsWith('PROMOTION_CARD::')) return false;
        if (s === 'system' || m.type === 'system' || m.metadata?.isSystem === true) return true;
        const up = txt.toUpperCase();
        return up.includes("TASK VERIFIED") || up.includes("TASK REJECTED") ||
               up.includes("TASK APPROVED") || up.includes("TASK DENIED") ||
               up.includes("KNEELING") || up.includes("REWARD CLAIMED") ||
               up.includes("SESSION COMPLETED") || up.includes("MERIT EARNED") ||
               up.includes("RANK PROMOTED") || up.includes("COINS AWARDED");
    };

    const systemMessages = sortedMessages.filter(m => _isSystem(m));
    const conversationMessages = sortedMessages.filter(m => !_isSystem(m));

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

        // Quote block for replied-to messages
        const replyTo = m.metadata?.reply_to;
        const quoteHtml = replyTo ? `<div style="border-left:2px solid rgba(197,160,89,0.5);padding:4px 8px;margin-bottom:5px;background:rgba(197,160,89,0.05);border-radius:0 4px 4px 0;">
            <div style="font-family:'Orbitron';font-size:0.3rem;color:rgba(197,160,89,0.7);letter-spacing:1px;margin-bottom:2px;">↩ ${(replyTo.sender_name || '').replace(/</g, '&lt;')}</div>
            <div style="font-family:'Rajdhani';font-size:0.78rem;color:rgba(255,255,255,0.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px;">${(replyTo.content || '').slice(0, 60).replace(/</g, '&lt;')}</div>
        </div>` : '';

        // Reply button
        const msgId = m.id || m._id || '';
        const senderNameSafe = (m.sender_name || (isMe ? 'You' : 'Queen Karin')).replace(/'/g, '&#39;').replace(/\\/g, '\\\\');
        const contentSafe = (originalMsg).slice(0, 80).replace(/'/g, '&#39;').replace(/\\/g, '\\\\').replace(/\n/g, ' ');
        const SVG_REPLY = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path></svg>`;
        const replyBtn = msgId ? `<button class="chat-reply-btn" onclick="event.stopPropagation();window.setProfileChatReply('${msgId}','${senderNameSafe}','${contentSafe}')" title="Reply">${SVG_REPLY}</button>` : '';

        let contentHtml = `<div class="msg ${msgClass}">${quoteHtml}${txt}</div>`;

        // --- MEDIA HANDLER ---
        if (originalMsg) {

            // A. PROMOTION CARD
            if (originalMsg.startsWith('PROMOTION_CARD::')) {
                try {
                    const d = JSON.parse(originalMsg.replace('PROMOTION_CARD::', ''));
                    const initials = (d.name || 'S')[0].toUpperCase();
                    const photoBlock = d.photo
                        ? `<img src="${d.photo}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                        : '';
                    const photoFallback = `<div style="${d.photo ? 'display:none;' : ''}position:absolute;inset:0;align-items:center;justify-content:center;flex-direction:column;gap:6px;background:linear-gradient(135deg,rgba(197,160,89,0.08),rgba(197,160,89,0.02));"><div style="width:60px;height:60px;border-radius:50%;border:1px solid rgba(197,160,89,0.4);display:flex;align-items:center;justify-content:center;font-family:'Cinzel',serif;font-size:1.4rem;color:#c5a059;">${initials}</div></div>`;
                    contentHtml = `
                    <div style="width:min(60%,480px);min-width:240px;margin:0 auto;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0e0b06 0%,#110d04 60%,#0a0703 100%);border:1px solid rgba(197,160,89,0.5);box-shadow:0 12px 40px rgba(0,0,0,0.8);">
                        <div style="position:relative;width:100%;height:150px;background:#0a0703;overflow:hidden;">
                            ${photoBlock}${photoFallback}
                            <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,#0e0b06 100%);"></div>
                            <div style="position:absolute;top:10px;left:50%;transform:translateX(-50%);background:rgba(10,7,2,0.9);border:1px solid rgba(197,160,89,0.5);border-radius:20px;padding:4px 14px;white-space:nowrap;">
                                <span style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:#c5a059;letter-spacing:3px;text-transform:uppercase;">✦ RANK PROMOTION</span>
                            </div>
                        </div>
                        <div style="padding:14px 18px 18px;text-align:center;">
                            <div style="font-family:'Cinzel',serif;font-size:0.95rem;color:#fff;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">${DOMPurify.sanitize(d.name || '')}</div>
                            <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:12px;">
                                <span style="font-family:'Orbitron',sans-serif;font-size:0.48rem;color:rgba(197,160,89,0.4);letter-spacing:1px;text-decoration:line-through;">${(d.oldRank||'').toUpperCase()}</span>
                                <span style="color:rgba(197,160,89,0.7);font-size:0.9rem;">→</span>
                                <span style="font-family:'Orbitron',sans-serif;font-size:0.55rem;color:#c5a059;letter-spacing:2px;font-weight:700;">${(d.newRank||'').toUpperCase()}</span>
                            </div>
                            <div style="width:70%;height:1px;background:linear-gradient(to right,transparent,rgba(197,160,89,0.35),transparent);margin:0 auto;"></div>
                        </div>
                    </div>`;
                } catch (e) {
                    contentHtml = `<div class="msg m-queen">✦ Rank Promotion</div>`;
                }
            }

            // B. TASK FEEDBACK CARD
            else if (originalMsg.startsWith('TASK_FEEDBACK::')) {
                try {
                    const data = JSON.parse(originalMsg.replace('TASK_FEEDBACK::', ''));
                    const { mediaUrl: fbMedia, mediaType: fbType, note: fbNote, taskId: fbTaskId, memberId: fbMemberId } = data;
                    const fbIsVideo = (fbType && (fbType === 'video' || fbType.startsWith('video/'))) || (fbMedia && /\.(mp4|mov|webm)/i.test(fbMedia));
                    // Videos: use raw URL; images: use optimized URL
                    const fbSrc = fbMedia ? (fbIsVideo ? fbMedia : getOptimizedUrl(fbMedia, 600)) : null;

                    const mediaBlock = fbSrc
                        ? (fbIsVideo
                            ? `<video src="${fbSrc}" class="tf-media" preload="none" muted playsinline style="width:100%;max-height:200px;object-fit:cover;display:block;border-radius:10px 10px 0 0;cursor:pointer;" onclick="(window.openModById && '${fbTaskId}' && '${fbMemberId}') ? window.openModById('${fbTaskId}','${fbMemberId}',true) : window.openChatPreview('${encodeURIComponent(fbSrc || '')}',true)"></video>`
                            : `<img src="${fbSrc}" style="width:100%;max-height:200px;object-fit:cover;display:block;border-radius:10px 10px 0 0;cursor:pointer;" onerror="this.style.display='none'" onclick="(window.openModById && '${fbTaskId}' && '${fbMemberId}') ? window.openModById('${fbTaskId}','${fbMemberId}',true) : window.openChatPreview('${encodeURIComponent(fbSrc || '')}',false)">`)
                        : '';

                    contentHtml = `
                    <div style="max-width:260px;width:60vw;border-radius:12px;overflow:hidden;background:#0a080a;border:1px solid rgba(197,160,89,0.4);box-shadow:0 8px 30px rgba(0,0,0,0.6);" onclick="window.openModById && '${fbTaskId}' && '${fbMemberId}' ? window.openModById('${fbTaskId}','${fbMemberId}',true) : null">
                        ${mediaBlock}
                        <div style="padding:10px 13px 12px;">
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.45rem;color:rgba(197,160,89,0.6);letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">✦ Task Feedback</div>
                            ${fbNote ? `<div style="font-family:'Rajdhani',sans-serif;font-size:0.85rem;color:rgba(255,255,255,0.85);line-height:1.4;">${DOMPurify.sanitize(fbNote)}</div>` : ''}
                        </div>
                    </div>`;
                } catch (e) {
                    contentHtml = `<div class="msg m-queen">📋 Task Feedback</div>`;
                }
            }

            // B. WISHLIST CARD
            else if (originalMsg.startsWith('WISHLIST::')) {
                try {
                    const jsonStr = originalMsg.replace('WISHLIST::', '');
                    const item = JSON.parse(jsonStr);

                    let cardImgUrl = item.img || item.image || item.itemImage || "";
                    if (cardImgUrl) {
                        cardImgUrl = getOptimizedUrl(cardImgUrl, 300);
                    }

                    contentHtml = `
                    <div class="msg-wishlist-card" style="margin:0 auto; overflow:hidden; background:#0a0a14; border:1px solid rgba(197,160,89,0.35); border-radius:14px; max-width:220px; width:60vw; box-shadow:0 8px 30px rgba(0,0,0,0.5);">
                        <div style="width:100%; height:130px; overflow:hidden; position:relative; background:#050510;">
                             <img src="${cardImgUrl}" onload="window.forceBottom()" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'">
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
            else if (originalMsg.startsWith('http') || m.mediaUrl || originalMsg.includes('wix:')) {
                const rawUrl = m.mediaUrl || originalMsg;
                let srcUrl = getOptimizedUrl(rawUrl, 600);

                if (rawUrl.includes('wix:image')) {
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
                    contentHtml = `<div class="msg ${msgClass}" style="padding:0; background:black;"><video src="${srcUrl}" onloadeddata="window.forceBottom()" controls playsinline preload="none" style="max-width:100%; border-radius:inherit;" onerror="this.closest('.msg').innerHTML='<div style=\\'padding:10px;font-family:Orbitron;font-size:0.5rem;color:rgba(255,100,100,0.7);\\'>VIDEO UNAVAILABLE</div>'"></video></div>`;
                } else {
                    contentHtml = `<div class="msg ${msgClass}" style="padding:0; overflow:hidden; width:240px; max-width:70vw; border-radius:12px;">
                        <img src="${srcUrl}" onload="window.forceBottom()" style="width:100%; height:200px; object-fit:cover; display:block; cursor:pointer;" onclick="openChatPreview('${encodeURIComponent(srcUrl)}', false)">
                    </div>`;
                }
            }
        }

        if (originalMsg && (originalMsg.startsWith('WISHLIST::') || originalMsg.startsWith('TASK_FEEDBACK::') || originalMsg.startsWith('PROMOTION_CARD::'))) {
            return `<div class="msg-row" style="justify-content:center; margin: 10px 0;"><div class="msg-col" style="align-items:center;">${contentHtml}<div class="msg-time">${timeStr}</div></div></div>`;
        }

        const avatarUrl = "/queen-karin.png";
        if (!isMe && !originalMsg.startsWith('WISHLIST::') && !originalMsg.startsWith('TASK_FEEDBACK::') && !originalMsg.startsWith('PROMOTION_CARD::') && !originalMsg.startsWith('http')) {
            contentHtml = `<div class="msg ${msgClass}">
                <div style="display:flex;align-items:center;gap:10px;">
                    <img src="${avatarUrl}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:1px solid #c5a059;flex-shrink:0;">
                    <div style="flex:1;">${quoteHtml}<span>${txt}</span></div>
                </div>
            </div>`;
        }

        return `<div class="msg-row chat-msg-row ${isMe ? 'mr-out' : 'mr-in'}">
            <div class="msg-col" style="align-items:${isMe ? 'flex-end' : 'flex-start'};">
                <div style="display:flex;align-items:center;gap:8px;">
                    ${isMe ? replyBtn : ''}
                    ${contentHtml}
                    ${!isMe ? replyBtn : ''}
                </div>
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
    const scroll = () => {
        const dBox = document.getElementById('chatBox');
        const mBox = document.getElementById('mob_chatBox');
        if (dBox) dBox.scrollTop = dBox.scrollHeight;
        if (mBox) mBox.scrollTop = mBox.scrollHeight;
    };
    // Immediate scroll + delayed scroll after images/media have loaded
    scroll();
    setTimeout(scroll, 80);
    setTimeout(scroll, 300);
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
