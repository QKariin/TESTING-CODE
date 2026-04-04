// src/scripts/dashboard-chat.ts
// Dashboard Chat Management - Refactored for Supabase Realtime

import { currId, users, adminEmail } from './dashboard-state';
import { createClient } from '@/utils/supabase/client';
import { getOptimizedUrl, mediaType } from './media';
import { clean } from './utils';
import { uploadToSupabase } from './mediaSupabase';

// Fallback if DOMPurify is not available or needs to be used from global
const purifier = (typeof window !== 'undefined' && (window as any).DOMPurify) || { sanitize: (s: string) => s };

// Single shared client — realtime subscriptions must stay on the same instance
const _supabase = createClient();

let chatChannel: any = null;
let chatPollInterval: ReturnType<typeof setInterval> | null = null;
let lastChatMsgId: string | null = null;
let lastChatMsgTimestamp: string | null = null;
let activeChatEmail: string | null = null;
const _renderedMsgIds = new Set<string>(); // dedup guard across realtime + polling

// ── Service / System message helpers ────────────────────────────────────────

function isSystemMessage(msg: any): boolean {
    if (!msg) return false;
    const sender = (msg.sender_email || msg.sender || '').toLowerCase();
    const content = (msg.content || msg.message || '').toUpperCase();
    return sender === 'system' ||
        content.includes('COINS RECEIVED') ||
        content.includes('TASK APPROVED') ||
        content.includes('POINTS RECEIVED') ||
        content.includes('TASK REJECTED') ||
        content.includes('TASK VERIFIED');
}

function getSystemLogHtml(msg: any): string {
    const d = new Date(msg.created_at || msg._createdDate || Date.now());
    const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const content = msg.content || msg.message || '';
    return `<div class="dash-syslog-entry">
        <span class="dash-syslog-text">${content}</span>
        <span class="dash-syslog-time">${dateStr} · ${timeStr}</span>
    </div>`;
}

function updateSystemTicker(msg: any) {
    if (!msg) return;
    const content = msg.content || msg.message || '';
    const el = document.getElementById('dashSystemTicker');
    if (el) {
        el.innerHTML = `<span style="color:#fff;">◈</span> ${content}`;
        el.classList.remove('ticker-flash');
        void (el as HTMLElement).offsetWidth;
        el.classList.add('ticker-flash');
    }
}

export function toggleDashSystemLog() {
    const d = document.getElementById('dashSystemLogContainer');
    if (!d) return;
    const isHidden = d.style.display === 'none' || d.classList.contains('hidden');
    if (isHidden) {
        d.classList.remove('hidden');
        d.style.display = 'flex';
    } else {
        d.classList.add('hidden');
        d.style.display = 'none';
    }
}

function appendToSystemLog(msg: any) {
    const logEl = document.getElementById('dashSystemLogContent');
    if (!logEl) return;
    logEl.insertAdjacentHTML('beforeend', getSystemLogHtml(msg));
    logEl.scrollTop = logEl.scrollHeight;
    updateSystemTicker(msg);
}

/**
 * Initializes the chat listener for a specific user (Slave).
 * Called when a user is selected in the sidebar.
 */
export async function initDashboardChat(slaveEmail: string) {
    const cleanEmail = slaveEmail.toLowerCase();
    activeChatEmail = cleanEmail;

    // 1. Clean up existing subscription + poll on the SAME client instance
    if (chatChannel) {
        _supabase.removeChannel(chatChannel);
        chatChannel = null;
    }
    if (chatPollInterval) {
        clearInterval(chatPollInterval);
        chatPollInterval = null;
    }
    lastChatMsgId = null;
    lastChatMsgTimestamp = null;
    _renderedMsgIds.clear();

    const b = document.getElementById('adminChatBox');
    if (b) b.innerHTML = '<div style="color:#444; text-align:center; padding:20px; font-family:Orbitron; font-size:0.7rem;">ESTABLISHING ENCRYPTED LINK...</div>';

    // 2. Load history
    await loadDashboardChatHistory(cleanEmail);

    // 3. Realtime subscription on shared client
    chatChannel = _supabase
        .channel('dash-chat-' + cleanEmail)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'chats',
            filter: `member_id=eq.${cleanEmail}`
        }, (payload) => {
            if (activeChatEmail !== cleanEmail) return; // switched user
            if (payload.new.id !== lastChatMsgId) {
                appendChatMessage(payload.new);
            }
        })
        .subscribe();

    // 4. Polling fallback — catches messages that realtime misses (RLS / connection issues)
    chatPollInterval = setInterval(() => pollNewMessages(cleanEmail), 4000);
}

async function pollNewMessages(email: string) {
    if (activeChatEmail !== email) return;
    if (!lastChatMsgTimestamp) return;
    try {
        const res = await fetch('/api/chat/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, since: lastChatMsgTimestamp }) });
        const data = await res.json();
        if (!data.success) return;
        const newMsgs = (data.messages || []).filter((m: any) => {
            const id = m.id ? String(m.id) : null;
            return id && !_renderedMsgIds.has(id);
        });
        newMsgs.forEach((m: any) => appendChatMessage(m));
    } catch (_) {}
}

async function loadDashboardChatHistory(email: string) {
    try {
        const supabase = createClient();
        let { data: { user } } = await supabase.auth.getUser();

        // LOCAL DEV BYPASS: If no user found on localhost, assume it's CEO
        let userEmail = user?.email;
        if (!userEmail && typeof window !== 'undefined' && window.location.hostname === 'localhost') {
            userEmail = 'ceo@qkarin.com';
        }

        const res = await fetch('/api/chat/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, ...(userEmail ? { requester: userEmail } : {}) }) });
        const data = await res.json();
        if (data.success) {
            const msgs = data.messages || [];
            if (msgs.length > 0) {
                const last = msgs[msgs.length - 1];
                lastChatMsgId = last.id;
                lastChatMsgTimestamp = last.created_at || new Date().toISOString();
            } else {
                lastChatMsgTimestamp = new Date().toISOString();
            }

            // Split: system messages → log panel, chat messages → chat box
            const sysMsgs = msgs.filter((m: any) => isSystemMessage(m));
            const chatMsgs = msgs.filter((m: any) => !isSystemMessage(m));

            // Populate system log
            const logEl = document.getElementById('dashSystemLogContent');
            if (logEl) {
                logEl.innerHTML = sysMsgs.map((m: any) => getSystemLogHtml(m)).join('');
                logEl.scrollTop = logEl.scrollHeight;
            }
            // Update ticker with most recent system message
            if (sysMsgs.length > 0) updateSystemTicker(sysMsgs[sysMsgs.length - 1]);

            // Populate dedup set from history
            chatMsgs.forEach((m: any) => { if (m.id) _renderedMsgIds.add(String(m.id)); });

            // Populate chat
            const html = chatMsgs.map((m: any) => renderToHtml(m)).join('');
            const b = document.getElementById('adminChatBox');
            if (b) {
                b.innerHTML = html + '<div id="chat-anchor" style="height:1px;"></div>';
                _attachImgScrollHandlers(b);
                forceBottom();
            }
        }
    } catch (err) {
        console.error("Failed to load dashboard chat history:", err);
    }
}

function appendChatMessage(msg: any) {
    // Prevent duplicates from instant-append + realtime sync
    const msgId = msg.id ? String(msg.id) : null;
    if (msgId && _renderedMsgIds.has(msgId)) return;
    if (msgId) _renderedMsgIds.add(msgId);
    lastChatMsgId = msg.id;
    if (msg.created_at) lastChatMsgTimestamp = msg.created_at;

    // System message → route to log panel, update ticker
    if (isSystemMessage(msg)) {
        appendToSystemLog(msg);
        return;
    }

    const b = document.getElementById('adminChatBox');
    if (!b) return;

    const html = renderToHtml(msg);
    const anchor = document.getElementById('chat-anchor');
    if (anchor) {
        anchor.insertAdjacentHTML('beforebegin', html);
    } else {
        b.insertAdjacentHTML('beforeend', html + '<div id="chat-anchor" style="height:1px;"></div>');
    }
    _attachImgScrollHandlers(b);
    forceBottom();
}

function renderToHtml(m: any) {
    // Admin (Queen) message: sender differs from the member owning the conversation
    const isMe = m.type !== 'system' && m.sender_email && m.member_id
        && m.sender_email.toLowerCase() !== m.member_id.toLowerCase();

    const ts = new Date(m.created_at || Date.now()).getTime();
    const timeStr = new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const content = m.content || m.message || "";

    const queenAvatar = `<img src="/queen-karin.png" class="cb-queen-av" alt="Q" onerror="this.style.display='none'" />`;

    // ── Tribute / wishlist card ── centered, no bubble
    if (m.type === 'wishlist') {
        const item = m.metadata || {};
        const itmTitle = item.title || "Tribute Item";
        const itmPrice = typeof item.price === 'number' ? item.price : (parseFloat(item.price) || 0);
        const itmImg = item.image || item.url || "";
        return `
            <div class="chat-gift-wrap">
                <div class="chat-gift-card">
                    <div class="chat-gift-img" style="background-image:url('${getOptimizedUrl(itmImg, 200)}')">
                        ${itmPrice ? `<div class="chat-gift-price"><i class="fas fa-coins"></i> ${itmPrice.toLocaleString()}</div>` : ''}
                    </div>
                    <div class="chat-gift-body">
                        <div class="chat-gift-label">✦ Tribute Sent</div>
                        <div class="chat-gift-title">${clean(itmTitle)}</div>
                    </div>
                </div>
                <div class="chat-ts" style="text-align:center;margin-top:4px">${timeStr}</div>
            </div>`;
    }

    // ── Promotion Card ── centered system announcement
    if (content.startsWith('PROMOTION_CARD::')) {
        try {
            const d = JSON.parse(content.replace('PROMOTION_CARD::', ''));
            const photoBlock = d.photo
                ? `<img src="${d.photo}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none'">`
                : '';
            return `
                <div class="chat-gift-wrap">
                    <div style="width:260px;max-width:72vw;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0e0b06 0%,#110d04 60%,#0a0703 100%);border:1px solid rgba(197,160,89,0.5);box-shadow:0 12px 40px rgba(0,0,0,0.8);">
                        <div style="position:relative;width:100%;height:150px;background:#0a0703;overflow:hidden;">
                            ${photoBlock}
                            <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,#0e0b06 100%);"></div>
                            <div style="position:absolute;top:10px;left:50%;transform:translateX(-50%);background:rgba(10,7,2,0.9);border:1px solid rgba(197,160,89,0.5);border-radius:20px;padding:4px 14px;white-space:nowrap;">
                                <span style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:#c5a059;letter-spacing:3px;">✦ RANK PROMOTION</span>
                            </div>
                        </div>
                        <div style="padding:14px 18px 18px;text-align:center;">
                            <div style="font-family:'Cinzel',serif;font-size:0.95rem;color:#fff;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">${purifier.sanitize(d.name||'')}</div>
                            <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:12px;">
                                <span style="font-family:'Orbitron',sans-serif;font-size:0.48rem;color:rgba(197,160,89,0.4);letter-spacing:1px;text-decoration:line-through;">${(d.oldRank||'').toUpperCase()}</span>
                                <span style="color:rgba(197,160,89,0.7);font-size:0.9rem;">→</span>
                                <span style="font-family:'Orbitron',sans-serif;font-size:0.55rem;color:#c5a059;letter-spacing:2px;font-weight:700;">${(d.newRank||'').toUpperCase()}</span>
                            </div>
                            <div style="width:70%;height:1px;background:linear-gradient(to right,transparent,rgba(197,160,89,0.35),transparent);margin:0 auto;"></div>
                        </div>
                    </div>
                    <div class="chat-ts" style="text-align:center;margin-top:4px">${timeStr}</div>
                </div>`;
        } catch (e) { /* fall through */ }
    }

    // ── Task Feedback Card ── centered, clickable to open history modal
    if (content.startsWith('TASK_FEEDBACK::')) {
        try {
            const data = JSON.parse(content.replace('TASK_FEEDBACK::', ''));
            const { mediaUrl: fbMedia, mediaType: fbType, note: fbNote, taskId: fbTaskId, memberId: fbMemberId } = data;
            const fbIsVideo = (fbType && (fbType === 'video' || fbType.startsWith('video/'))) || (fbMedia && /\.(mp4|mov|webm)/i.test(fbMedia));
            // Videos: use raw URL; images: use optimized URL
            const fbSrc = fbMedia ? (fbIsVideo ? fbMedia : getOptimizedUrl(fbMedia, 600)) : null;
            const mediaBlock = fbSrc
                ? (fbIsVideo
                    ? `<video src="${fbSrc}" preload="metadata" muted playsinline style="width:100%;max-height:180px;object-fit:cover;display:block;border-radius:10px 10px 0 0;cursor:pointer;" onclick="event.stopPropagation();window.openModById&&'${fbTaskId}'&&'${fbMemberId}'?window.openModById('${fbTaskId}','${fbMemberId}',true):void 0"></video>`
                    : `<img src="${fbSrc}" style="width:100%;max-height:180px;object-fit:cover;display:block;border-radius:10px 10px 0 0;cursor:pointer;" onerror="this.style.display='none'" onclick="event.stopPropagation();window.openModById&&'${fbTaskId}'&&'${fbMemberId}'?window.openModById('${fbTaskId}','${fbMemberId}',true):void 0">`)
                : '';
            const cardHtml = `
                <div class="chat-gift-wrap" style="cursor:pointer;" onclick="window.openModById&&'${fbTaskId}'&&'${fbMemberId}'?window.openModById('${fbTaskId}','${fbMemberId}',true):void 0">
                    <div style="max-width:240px;width:55vw;border-radius:12px;overflow:hidden;background:#0a080a;border:1px solid rgba(197,160,89,0.4);box-shadow:0 6px 24px rgba(0,0,0,0.6);">
                        ${mediaBlock}
                        <div style="padding:9px 12px 11px;">
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(197,160,89,0.6);letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;">✦ Task Feedback</div>
                            ${fbNote ? `<div style="font-family:'Rajdhani',sans-serif;font-size:0.85rem;color:rgba(255,255,255,0.82);line-height:1.4;">${purifier.sanitize(fbNote)}</div>` : ''}
                        </div>
                    </div>
                    <div class="chat-ts" style="text-align:center;margin-top:4px">${timeStr}</div>
                </div>`;
            return cardHtml;
        } catch (e) {
            // fall through to plain text
        }
    }

    // ── Build bubble content ──
    // Dashboard perspective: admin (isMe) → RIGHT, slave → LEFT
    const bubbleClass = isMe ? 'cb-queen' : 'cb-slave';
    const slaveAvatar = users.find(u => u.memberId === m.member_id)?.avatar || '';
    const slaveAv = slaveAvatar ? `<img src="${getOptimizedUrl(slaveAvatar, 60)}" class="cb-queen-av" alt="" />` : '';

    let bubble = '';
    if (m.type === 'photo') {
        bubble = `<div class="${bubbleClass}"><img src="${getOptimizedUrl(content, 300)}" class="chat-img-attachment" style="cursor:pointer" onclick="openChatPreview('${encodeURIComponent(content)}', false)" /></div>`;
    } else if (m.type === 'video') {
        bubble = `<div class="${bubbleClass}" style="padding:4px;"><video src="${content}" controls playsinline preload="none" class="chat-img-attachment"></video></div>`;
    } else {
        let safeHtml = purifier.sanitize(content);
        safeHtml = safeHtml.replace(/\n/g, '<br>');
        bubble = `<div class="${bubbleClass}">${safeHtml}</div>`;
    }

    // Admin (isMe) → RIGHT, no avatar
    if (isMe) {
        return `
            <div class="cb-row cb-row-me">
                <div class="cb-wrap-me">
                    ${bubble}
                    <div class="chat-ts chat-ts-right">${timeStr}</div>
                </div>
            </div>`;
    } else {
        // Slave → LEFT, slave avatar
        return `
            <div class="cb-row cb-row-queen">
                ${slaveAv}
                <div class="cb-wrap-queen">
                    ${bubble}
                    <div class="chat-ts chat-ts-left">${timeStr}</div>
                </div>
            </div>`;
    }
}

function forceBottom() {
    const scroll = () => {
        const b = document.getElementById('adminChatBox');
        if (b) b.scrollTop = b.scrollHeight + 9999;
    };
    scroll();
    setTimeout(scroll, 80);
    setTimeout(scroll, 350);
    setTimeout(scroll, 700);
}

function _attachImgScrollHandlers(container: HTMLElement) {
    container.querySelectorAll('img').forEach(img => {
        if (!(img as any)._dashScrollBound) {
            (img as any)._dashScrollBound = true;
            img.addEventListener('load', forceBottom, { once: true });
            img.addEventListener('error', forceBottom, { once: true });
        }
    });
}

export async function sendMsg() {
    const inp = document.getElementById('adminInp') as HTMLInputElement;
    const btn = document.querySelector('.btn-send') as HTMLButtonElement;

    const activeCurrId = currId || (window as any).currId;
    if (!inp || !activeCurrId) {
        console.warn(`[DASHBOARD-CHAT] Send failed: Missing input ${!inp} or currId ${!activeCurrId}`);
        return;
    }

    const text = inp.value.trim();
    if (!text) return;

    if (inp.disabled) return;
    inp.disabled = true;
    if (btn) btn.disabled = true;

    // Resolve admin email: state → window fallback → Supabase auth
    let senderEmail: string | null = adminEmail || (window as any).adminEmail || null;
    if (!senderEmail) {
        try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            senderEmail = user?.email || null;
            if (senderEmail) {
                const { setAdminEmail } = await import('./dashboard-state');
                setAdminEmail(senderEmail);
            }
        } catch (_) {}
    }
    if (!senderEmail) {
        console.error(`[DASHBOARD-CHAT] Send failed: Admin email not available.`);
        alert("Authentication Error: Admin email not found. Please ensure you are logged in.");
        inp.disabled = false;
        if (btn) btn.disabled = false;
        return;
    }

    // console.log(`[DASHBOARD-CHAT] Sending message to ${currId} from ${adminEmail}...`); // Removed email from log

    try {
        const res = await fetch('/api/chat/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                senderEmail: senderEmail,
                conversationId: activeCurrId, // sending TO this slave
                content: text,
                type: 'text'
            })
        });
        const data = await res.json();
        if (data.success) {
            console.log(`[DASHBOARD-CHAT] Message sent successfully.`);
            inp.value = "";
            // Append instantly for UX
            if (data.data) {
                appendChatMessage(data.data);
            }
        } else {
            console.error(`[DASHBOARD-CHAT] Message send API error:`, data.error);
            alert(`Error: ${data.error}`);
        }
    } catch (err) {
        console.error(`[DASHBOARD-CHAT] Message send network error:`, err);
        alert("Network Error: Failed to reach the chat server.");
    } finally {
        inp.disabled = false;
        if (btn) btn.disabled = false;
        inp.focus();
    }
}

export async function handleAdminUpload(file: File) {
    if (!file) return;
    const activeCurrId = currId || (window as any).currId;
    if (!activeCurrId) return;

    const btn = document.querySelector('.btn-plus') as HTMLButtonElement;
    if (btn) { btn.innerText = '⏳'; btn.disabled = true; }

    try {
        const isVideo = file.type.startsWith('video/');
        const msgType = isVideo ? 'video' : 'photo';

        // Upload directly to Supabase (videos bypass API route size limit)
        const url = await uploadToSupabase('media', 'admin-chat', file);
        if (url === 'failed') {
            console.error('[DASHBOARD-CHAT] Media upload failed');
            return;
        }

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        let userEmail = user?.email;
        if (!userEmail && typeof window !== 'undefined' && window.location.hostname === 'localhost') {
            userEmail = 'ceo@qkarin.com';
        }
        if (!userEmail) return;

        const sendRes = await fetch('/api/chat/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                senderEmail: userEmail,
                conversationId: activeCurrId,
                content: url,
                type: msgType,
            }),
        });
        const sendData = await sendRes.json();
        if (sendData.success && sendData.data) {
            appendChatMessage(sendData.data);
        } else {
            console.error('[DASHBOARD-CHAT] Send error:', sendData.error);
        }
    } catch (err) {
        console.error('[DASHBOARD-CHAT] Upload error:', err);
    } finally {
        if (btn) { btn.innerText = '+'; btn.disabled = false; }
    }
}

// iOS-safe media picker for admin chat — dynamic input avoids hidden-element restriction
export function triggerAdminMediaPick() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*,video/*';
    inp.style.position = 'fixed';
    inp.style.top = '-9999px';
    document.body.appendChild(inp);
    inp.onchange = () => {
        document.body.removeChild(inp);
        if (inp.files?.[0]) handleAdminUpload(inp.files[0]);
    };
    inp.click();
}

// Global Bindings
if (typeof window !== 'undefined') {
    (window as any).sendMsg = sendMsg;
    (window as any).handleAdminUpload = handleAdminUpload;
    (window as any).triggerAdminMediaPick = triggerAdminMediaPick;
    (window as any).toggleDashSystemLog = toggleDashSystemLog;
}
