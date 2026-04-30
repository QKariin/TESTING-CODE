// src/scripts/dashboard-chat.ts
// Dashboard Chat Management - Refactored for Supabase Realtime

import { currId, users, adminEmail } from './dashboard-state';
import { isMemberOnline } from './dashboard-presence';
import { createClient } from '@/utils/supabase/client';
import { getOptimizedUrl, mediaType } from './media';
import { clean } from './utils';
import { uploadToSupabase } from './mediaSupabase';
import { updateSidebarItem } from './dashboard-sidebar';

// Fallback if DOMPurify is not available or needs to be used from global
const purifier = (typeof window !== 'undefined' && (window as any).DOMPurify) || { sanitize: (s: string) => s };

// Single shared client - realtime subscriptions must stay on the same instance
const _supabase = createClient();

let chatChannel: any = null;
let chatPollInterval: ReturnType<typeof setInterval> | null = null;
let chatAbortController: AbortController | null = null;
let lastChatMsgId: string | null = null;
let lastChatMsgTimestamp: string | null = null;
let activeChatEmail: string | null = null;
const _renderedMsgIds = new Set<string>(); // dedup guard across realtime + polling

// ── Chat cache — stores rendered HTML + state per user so switching back is instant ──
interface ChatCacheEntry {
    html: string;          // rendered chat box innerHTML
    sysHtml: string;       // system log innerHTML
    lastMsgId: string | null;
    lastTimestamp: string | null;
    dedupIds: Set<string>;
    cachedAt: number;
}
const _chatCache = new Map<string, ChatCacheEntry>();
const CACHE_MAX_ENTRIES = 30; // keep last 30 conversations in memory

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
export async function initDashboardChat(memberIdOrEmail: string) {
    // chats.member_id is EMAIL — always resolve to email for chat lookups
    const u = users.find((x: any) => x.memberId === memberIdOrEmail || x.id === memberIdOrEmail || x.member_id === memberIdOrEmail);
    const activeId = u?.member_id || u?.email || memberIdOrEmail;

    // Guard: if already initialized for this exact user AND channel is alive, skip.
    if (activeChatEmail?.toLowerCase() === activeId.toLowerCase() && chatChannel) return;

    // ── KILL everything from previous user — abort in-flight requests ──
    if (chatAbortController) chatAbortController.abort();
    chatAbortController = new AbortController();
    const signal = chatAbortController.signal;

    // Save current chat to cache before switching
    _saveChatToCache();

    activeChatEmail = activeId;

    // Clean up existing subscription + poll
    if (chatChannel) {
        _supabase.removeChannel(chatChannel);
        chatChannel = null;
    }
    if (chatPollInterval) {
        clearInterval(chatPollInterval);
        chatPollInterval = null;
    }

    // ── Try restoring from cache — but invalidate if stale (>5min) ──
    const cached = _chatCache.get(activeId.toLowerCase());
    const cacheAge = cached ? Date.now() - cached.cachedAt : Infinity;
    const CACHE_MAX_AGE = 5 * 60 * 1000;

    if (cached && cacheAge < CACHE_MAX_AGE) {
        lastChatMsgId = cached.lastMsgId;
        lastChatMsgTimestamp = cached.lastTimestamp;
        _renderedMsgIds.clear();
        cached.dedupIds.forEach(id => _renderedMsgIds.add(id));

        const b = document.getElementById('adminChatBox');
        if (b) {
            b.innerHTML = cached.html;
            _attachImgScrollHandlers(b);
            forceBottom();
        }
        const logEl = document.getElementById('dashSystemLogContent');
        if (logEl && cached.sysHtml) {
            logEl.innerHTML = cached.sysHtml;
            logEl.scrollTop = logEl.scrollHeight;
        }

        // Catch up on missed messages (non-blocking, abortable)
        pollNewMessages(activeId, signal);
    } else {
        if (cached) _chatCache.delete(activeId.toLowerCase());
        lastChatMsgId = null;
        lastChatMsgTimestamp = null;
        _renderedMsgIds.clear();

        const b = document.getElementById('adminChatBox');
        if (b) b.innerHTML = '<div style="color:#444; text-align:center; padding:20px; font-family:Orbitron; font-size:0.7rem;">ESTABLISHING ENCRYPTED LINK...</div>';

        await loadDashboardChatHistory(activeId, signal);
    }

    // If user switched during await, bail — everything was already cleaned up by the new call
    if (signal.aborted) return;

    // Realtime subscription — filter in JS (Supabase eq filter is case-sensitive)
    chatChannel = _supabase
        .channel('dash-chat-' + activeId)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'chats',
        }, (payload) => {
            const msg = payload.new;
            if (!msg) return;
            const rowMemberId = (msg.member_id || '').toLowerCase();
            if (rowMemberId !== activeId.toLowerCase()) return;
            if (activeChatEmail?.toLowerCase() !== activeId.toLowerCase()) return;
            appendChatMessage(msg);
        })
        .subscribe((status: string) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.warn('[DASH-CHAT] realtime lost, polling covers');
            }
        });

    // Polling fallback — reads live activeChatEmail each tick
    chatPollInterval = setInterval(() => {
        if (activeChatEmail) pollNewMessages(activeChatEmail);
    }, 15000);
}

/** Save the currently visible chat to the in-memory cache */
function _saveChatToCache() {
    if (!activeChatEmail) return;
    const b = document.getElementById('adminChatBox');
    const logEl = document.getElementById('dashSystemLogContent');
    if (!b) return;

    const entry: ChatCacheEntry = {
        html: b.innerHTML,
        sysHtml: logEl?.innerHTML || '',
        lastMsgId: lastChatMsgId,
        lastTimestamp: lastChatMsgTimestamp,
        dedupIds: new Set(_renderedMsgIds),
        cachedAt: Date.now(),
    };
    _chatCache.set(activeChatEmail.toLowerCase(), entry);

    // Evict oldest entries if cache is too large
    if (_chatCache.size > CACHE_MAX_ENTRIES) {
        let oldestKey = '';
        let oldestTime = Infinity;
        _chatCache.forEach((v, k) => {
            if (v.cachedAt < oldestTime) { oldestTime = v.cachedAt; oldestKey = k; }
        });
        if (oldestKey) _chatCache.delete(oldestKey);
    }
}

/** Force-reconnect the chat channel + poll immediately. Called on tab visibility restore. */
export function reconnectDashboardChat() {
    if (!activeChatEmail) return;
    const activeId = activeChatEmail;

    const needsFullReinit = !chatChannel ||
        chatChannel.state === 'errored' ||
        chatChannel.state === 'closed';

    if (needsFullReinit) {
        console.log('[DASH-CHAT] channel dead or missing, re-initializing');
        _chatCache.delete(activeId.toLowerCase());
        activeChatEmail = null; // reset guard so initDashboardChat runs
        initDashboardChat(activeId);
        return;
    }

    // Channel alive — poll for missed messages
    pollNewMessages(activeId);
}

async function pollNewMessages(memberId: string, signal?: AbortSignal) {
    if (activeChatEmail?.toLowerCase() !== memberId.toLowerCase()) return;
    if (!lastChatMsgTimestamp) return;
    try {
        const res = await fetch('/api/chat/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memberId, since: lastChatMsgTimestamp }),
            signal: signal,
        });
        if (!res.ok) return;
        if (activeChatEmail?.toLowerCase() !== memberId.toLowerCase()) return;
        const data = await res.json();
        if (!data.success) return;
        if (activeChatEmail?.toLowerCase() !== memberId.toLowerCase()) return;
        const newMsgs = (data.messages || []).filter((m: any) => {
            const id = m.id ? String(m.id) : null;
            if (id && _renderedMsgIds.has(id)) return false;
            return true;
        });
        newMsgs.forEach((m: any) => appendChatMessage(m));
    } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.warn('[DASH-CHAT] poll error:', err);
    }
}

async function loadDashboardChatHistory(memberId: string, signal?: AbortSignal, _retryCount = 0) {
    try {
        const res = await fetch('/api/chat/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memberId }),
            signal: signal,
        });

        // Auth failure — retry up to 2x with 2s delay
        if (!res.ok && _retryCount < 2) {
            console.warn(`[DASH-CHAT] history load failed (${res.status}), retrying in 2s...`);
            await new Promise(r => setTimeout(r, 2000));
            if (signal?.aborted || activeChatEmail !== memberId) return;
            return loadDashboardChatHistory(memberId, signal, _retryCount + 1);
        }

        // Stale check after network wait
        if (signal?.aborted || activeChatEmail !== memberId) return;

        const data = await res.json();

        if (!data.success) {
            if (_retryCount >= 2) {
                const b = document.getElementById('adminChatBox');
                if (b) b.innerHTML = '<div style="color:#e85d75; text-align:center; padding:20px; font-family:Orbitron; font-size:0.6rem;">LINK FAILED — TAP TO RETRY</div>';
                b?.addEventListener('click', () => {
                    if (activeChatEmail === memberId) loadDashboardChatHistory(memberId, undefined, 0);
                }, { once: true });
            }
            return;
        }

        // Final stale check before touching the DOM
        if (signal?.aborted || activeChatEmail !== memberId) return;

        const msgs = data.messages || [];
        if (msgs.length > 0) {
            const last = msgs[msgs.length - 1];
            lastChatMsgId = last.id;
            lastChatMsgTimestamp = last.created_at || new Date().toISOString();
        } else {
            lastChatMsgTimestamp = new Date().toISOString();
        }

        const sysMsgs = msgs.filter((m: any) => isSystemMessage(m));
        const chatMsgs = msgs.filter((m: any) => !isSystemMessage(m));

        const logEl = document.getElementById('dashSystemLogContent');
        if (logEl) {
            logEl.innerHTML = sysMsgs.map((m: any) => getSystemLogHtml(m)).join('');
            logEl.scrollTop = logEl.scrollHeight;
        }
        if (sysMsgs.length > 0) updateSystemTicker(sysMsgs[sysMsgs.length - 1]);

        // Populate dedup set from ALL messages so realtime doesn't re-add them
        msgs.forEach((m: any) => { if (m.id) _renderedMsgIds.add(String(m.id)); });

        const html = chatMsgs.map((m: any) => renderToHtml(m)).join('');
        const b = document.getElementById('adminChatBox');
        if (b) {
            b.innerHTML = html + '<div id="chat-anchor" style="height:1px;"></div>';
            _attachImgScrollHandlers(b);
            forceBottom();
        }
    } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.error('[DASH-CHAT] history load error:', err);
        if (_retryCount < 2) {
            await new Promise(r => setTimeout(r, 2000));
            if (signal?.aborted || activeChatEmail !== memberId) return;
            return loadDashboardChatHistory(memberId, signal, _retryCount + 1);
        }
        // Show error after all retries exhausted (network exceptions too, not just API errors)
        if (activeChatEmail === memberId) {
            const b = document.getElementById('adminChatBox');
            if (b) b.innerHTML = '<div style="color:#e85d75; text-align:center; padding:20px; font-family:Orbitron; font-size:0.6rem;">LINK FAILED — TAP TO RETRY</div>';
            b?.addEventListener('click', () => {
                if (activeChatEmail === memberId) loadDashboardChatHistory(memberId, undefined, 0);
            }, { once: true });
        }
    }
}

export function appendChatMessage(msg: any) {
    // Guard: only render messages for the currently active conversation
    if (activeChatEmail && msg.member_id) {
        if ((msg.member_id || '').toLowerCase() !== activeChatEmail.toLowerCase()) return;
    }

    // Prevent duplicates — use real DB id (now returned by send API)
    const msgId = msg.id ? String(msg.id) : null;
    if (msgId && _renderedMsgIds.has(msgId)) return;
    if (msgId) _renderedMsgIds.add(msgId);
    lastChatMsgId = msg.id;
    if (msg.created_at) lastChatMsgTimestamp = msg.created_at;

    // Update sidebar card for this conversation — shows unread dot instantly
    if (msg.created_at && activeChatEmail) {
        const msgTs = new Date(msg.created_at).getTime();
        const u = users.find(x => (x.memberId || '').toLowerCase() === activeChatEmail!.toLowerCase());
        if (u && msgTs > (u.lastMessageTime || 0)) {
            u.lastMessageTime = msgTs;
            updateSidebarItem(u.memberId);
        }
    }

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
    // Admin (Queen) message: flagged by metadata.isQueen on insert
    const isMe = m.type !== 'system' && m.metadata?.isQueen === true;

    const ts = new Date(m.created_at || Date.now()).getTime();
    const timeStr = new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const content = m.content || m.message || "";

    const queenAvatar = `<img src="/queen-nav.png" class="cb-queen-av" alt="Q" onerror="this.style.display='none'" />`;

    // ── Paid media card (dashboard view — always shows clear) ──
    if (m.type === 'paid_media') {
        const meta = m.metadata || {};
        const pmUrl = meta.media_url || '';
        const pmType = meta.media_type || 'photo';
        const pmPrice = meta.price || 0;
        const pmId = meta.paid_media_id || '';
        const isVideo = pmType === 'video' || /\.(mp4|mov|webm)/i.test(pmUrl);
        const mediaTag = isVideo
            ? `<video src="${pmUrl}" preload="none" muted playsinline style="width:100%;max-height:200px;object-fit:cover;display:block;" controls></video>`
            : `<img src="${getOptimizedUrl(pmUrl, 300)}" style="width:100%;max-height:200px;object-fit:cover;display:block;" onerror="this.style.display='none'" />`;
        return `
            <div class="chat-gift-wrap">
                <div class="paid-media-card">
                    <div class="pm-img-wrap">${mediaTag}</div>
                    <div class="pm-footer">
                        <span class="pm-label">PAID MEDIA</span>
                        <span class="pm-price-tag" style="font-size:0.7rem;">♦ ${pmPrice.toLocaleString()}</span>
                        <span class="pm-status" id="pmStatus_${pmId}">SENT</span>
                    </div>
                </div>
                <div class="chat-ts" style="text-align:center;margin-top:4px">${timeStr}</div>
            </div>`;
    }

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
                    <div style="width:260px;max-width:72vw;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0e0b06 0%,#110d04 60%,#0a0703 100%);border:1px solid rgba(var(--gold-rgb),0.5);box-shadow:0 12px 40px rgba(0,0,0,0.8);">
                        <div style="position:relative;width:100%;height:150px;background:#0a0703;overflow:hidden;">
                            ${photoBlock}
                            <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,#0e0b06 100%);"></div>
                            <div style="position:absolute;top:10px;left:50%;transform:translateX(-50%);background:rgba(10,7,2,0.9);border:1px solid rgba(var(--gold-rgb),0.5);border-radius:20px;padding:4px 14px;white-space:nowrap;">
                                <span style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:var(--gold);letter-spacing:3px;">✦ RANK PROMOTION</span>
                            </div>
                        </div>
                        <div style="padding:14px 18px 18px;text-align:center;">
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.95rem;color:#fff;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">${purifier.sanitize(d.name||'')}</div>
                            <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:12px;">
                                <span style="font-family:'Orbitron',sans-serif;font-size:0.48rem;color:rgba(var(--gold-rgb),0.4);letter-spacing:1px;text-decoration:line-through;">${(d.oldRank||'').toUpperCase()}</span>
                                <span style="color:rgba(var(--gold-rgb),0.7);font-size:0.9rem;">→</span>
                                <span style="font-family:'Orbitron',sans-serif;font-size:0.55rem;color:var(--gold);letter-spacing:2px;font-weight:700;">${(d.newRank||'').toUpperCase()}</span>
                            </div>
                            <div style="width:70%;height:1px;background:linear-gradient(to right,transparent,rgba(var(--gold-rgb),0.35),transparent);margin:0 auto;"></div>
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
                    ? `<video src="${fbSrc}" preload="none" muted playsinline style="width:100%;max-height:180px;object-fit:cover;display:block;border-radius:10px 10px 0 0;cursor:pointer;" onclick="event.stopPropagation();window.openModById&&'${fbTaskId}'&&'${fbMemberId}'?window.openModById('${fbTaskId}','${fbMemberId}',true):void 0"></video>`
                    : `<img src="${fbSrc}" style="width:100%;max-height:180px;object-fit:cover;display:block;border-radius:10px 10px 0 0;cursor:pointer;" onerror="this.style.display='none'" onclick="event.stopPropagation();window.openModById&&'${fbTaskId}'&&'${fbMemberId}'?window.openModById('${fbTaskId}','${fbMemberId}',true):void 0">`)
                : '';
            const cardHtml = `
                <div class="chat-gift-wrap" style="cursor:pointer;" onclick="window.openModById&&'${fbTaskId}'&&'${fbMemberId}'?window.openModById('${fbTaskId}','${fbMemberId}',true):void 0">
                    <div style="max-width:240px;width:55vw;border-radius:12px;overflow:hidden;background:#0a080a;border:1px solid rgba(var(--gold-rgb),0.4);box-shadow:0 6px 24px rgba(0,0,0,0.6);">
                        ${mediaBlock}
                        <div style="padding:9px 12px 11px;">
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(var(--gold-rgb),0.6);letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;">✦ Task Feedback</div>
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

    // ── GIF card ── centered, no bubble
    if (m.type === 'gif' || (content === '[GIF]' && m.metadata?.gifUrl)) {
        const gifUrl = m.metadata?.gifUrl || content;
        return `
            <div class="chat-gift-wrap">
                <div style="max-width:260px;width:65vw;border-radius:14px;overflow:hidden;background:linear-gradient(170deg,#0e0b06,#110d04,#0a0703);border:1px solid rgba(var(--gold-rgb),0.35);box-shadow:0 8px 30px rgba(0,0,0,0.7);">
                    <div style="width:100%;overflow:hidden;background:#0a0703;">
                        <img src="${gifUrl}" style="width:100%;display:block;max-height:200px;object-fit:contain;" onerror="this.style.display='none'" />
                    </div>
                </div>
                <div class="chat-ts" style="text-align:center;margin-top:4px">${timeStr}</div>
            </div>`;
    }

    // ── Build bubble content ──
    // Dashboard perspective: admin (isMe) → RIGHT, slave → LEFT
    const bubbleClass = isMe ? 'cb-queen' : 'cb-slave';
    const slaveAvatar = users.find(u => u.memberId === m.member_id)?.avatar || '';
    const slaveAv = slaveAvatar ? `<img src="${getOptimizedUrl(slaveAvatar, 60)}" class="cb-queen-av" alt="" />` : '';

    let bubble = '';
    if (m.type === 'photo') {
        const rawImgUrl = getOptimizedUrl(content, 300);
        const imgUrl = rawImgUrl.includes('supabase.co/storage') ? `/api/media?url=${encodeURIComponent(rawImgUrl)}` : rawImgUrl;
        bubble = `<div class="${bubbleClass}"><img src="${imgUrl}" class="chat-img-attachment" style="cursor:pointer" onclick="openChatPreview('${encodeURIComponent(content)}', false)" /></div>`;
    } else if (m.type === 'video') {
        const vidUrl = content.includes('supabase.co/storage') ? `/api/media?url=${encodeURIComponent(content)}` : content;
        bubble = `<div class="${bubbleClass}" style="padding:4px;"><video src="${vidUrl}" controls playsinline preload="none" class="chat-img-attachment"></video></div>`;
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
        if (!b) return;
        b.scrollTop = b.scrollHeight + 9999;
    };
    scroll();
    requestAnimationFrame(() => requestAnimationFrame(scroll));
    setTimeout(scroll, 150);
}

function _attachImgScrollHandlers(container: HTMLElement) {
    // img elements
    container.querySelectorAll('img').forEach(img => {
        if (!(img as any)._dashScrollBound) {
            (img as any)._dashScrollBound = true;
            if (!img.complete) {
                img.addEventListener('load', forceBottom, { once: true });
                img.addEventListener('error', forceBottom, { once: true });
            }
        }
    });
    // video elements - bind on loadedmetadata since preload="none" means no load event
    container.querySelectorAll('video').forEach(vid => {
        if (!(vid as any)._dashScrollBound) {
            (vid as any)._dashScrollBound = true;
            vid.addEventListener('loadedmetadata', forceBottom, { once: true });
            vid.addEventListener('error', forceBottom, { once: true });
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
    // chats.member_id is EMAIL — resolve user's email for the conversation
    const convUser = users.find((x: any) => x.memberId === activeCurrId || x.id === activeCurrId);
    const conversationEmail = convUser?.member_id || convUser?.email || activeCurrId;

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
                conversationId: conversationEmail, // email - chats.member_id is TEXT
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

    const isVideo = file.type.startsWith('video/');
    const msgType = isVideo ? 'video' : 'photo';
    const objectUrl = URL.createObjectURL(file);
    // chats.member_id is EMAIL
    const mediaConvUser = users.find((x: any) => x.memberId === activeCurrId || x.id === activeCurrId);
    const mediaConvEmail = mediaConvUser?.member_id || mediaConvUser?.email || activeCurrId;

    // Show preview modal before uploading
    const existing = document.getElementById('__adminMediaPreview');
    existing?.remove();

    const overlay = document.createElement('div');
    overlay.id = '__adminMediaPreview';
    const sidebarLeft = window.innerWidth <= 900 ? '0px' : '320px';
    overlay.style.cssText = `position:fixed;top:0;right:0;bottom:0;left:${sidebarLeft};z-index:99999;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;`;

    const mediaEl = isVideo
        ? `<video src="${objectUrl}" controls playsinline style="max-width:100%;max-height:55vh;border-radius:12px;display:block;"></video>`
        : `<img src="${objectUrl}" style="max-width:100%;max-height:55vh;border-radius:12px;display:block;object-fit:contain;" />`;

    overlay.innerHTML = `
        <div style="width:min(420px,100%);background:#0a0806;border:1px solid rgba(197,160,89,0.35);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;">
            <div style="padding:14px 18px;border-bottom:1px solid rgba(197,160,89,0.12);display:flex;align-items:center;justify-content:space-between;">
                <span style="font-family:Orbitron,sans-serif;font-size:0.48rem;color:rgba(197,160,89,0.7);letter-spacing:3px;">${isVideo ? 'VIDEO' : 'PHOTO'} PREVIEW</span>
                <button id="__adminMediaClose" style="background:none;border:none;color:#555;font-size:1.2rem;cursor:pointer;line-height:1;padding:0 4px;">✕</button>
            </div>
            <div style="padding:16px;display:flex;justify-content:center;background:#050403;">
                ${mediaEl}
            </div>
            <div style="padding:14px 18px;display:flex;flex-direction:column;gap:10px;">
                <div id="__adminMediaStatus" style="font-family:Orbitron,sans-serif;font-size:0.42rem;color:#c55;text-align:center;min-height:16px;"></div>
                <div style="display:flex;gap:10px;">
                    <button id="__adminMediaCancel" style="flex:1;padding:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#666;font-family:Orbitron,sans-serif;font-size:0.48rem;letter-spacing:2px;cursor:pointer;">CANCEL</button>
                    <button id="__adminMediaSend" style="flex:2;padding:12px;background:linear-gradient(135deg,#c5a059,#8b6914);border:none;border-radius:8px;color:#000;font-family:Orbitron,sans-serif;font-size:0.48rem;font-weight:700;letter-spacing:2px;cursor:pointer;">SEND</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const close = () => { URL.revokeObjectURL(objectUrl); overlay.remove(); };
    document.getElementById('__adminMediaClose')!.onclick = close;
    document.getElementById('__adminMediaCancel')!.onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    const sendBtn = document.getElementById('__adminMediaSend') as HTMLButtonElement;
    const statusEl = document.getElementById('__adminMediaStatus') as HTMLElement;

    sendBtn.onclick = async () => {
        sendBtn.disabled = true;
        sendBtn.textContent = 'UPLOADING...';
        statusEl.textContent = '';
        try {
            const url = await uploadToSupabase('media', 'admin-chat', file);
            if (url === 'failed') {
                statusEl.textContent = 'Upload failed. Try again.';
                sendBtn.disabled = false; sendBtn.textContent = 'SEND';
                return;
            }

            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            let userEmail = user?.email;
            if (!userEmail && typeof window !== 'undefined' && window.location.hostname === 'localhost') {
                userEmail = 'ceo@qkarin.com';
            }
            if (!userEmail) { close(); return; }

            const sendRes = await fetch('/api/chat/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ senderEmail: userEmail, conversationId: mediaConvEmail, content: url, type: msgType }),
            });
            const sendData = await sendRes.json();
            if (sendData.success && sendData.data) {
                appendChatMessage(sendData.data);
                close();
            } else {
                statusEl.textContent = sendData.error || 'Send failed.';
                sendBtn.disabled = false; sendBtn.textContent = 'SEND';
            }
        } catch (err) {
            console.error('[DASHBOARD-CHAT] Upload error:', err);
            statusEl.textContent = 'Network error. Try again.';
            sendBtn.disabled = false; sendBtn.textContent = 'SEND';
        }
    };
}

// iOS-safe media picker for admin chat - must be in viewport (not offscreen) for iOS gallery to open
export function triggerAdminMediaPick() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*,video/*';
    inp.multiple = false;
    inp.style.cssText = 'position:fixed;top:50%;left:50%;width:1px;height:1px;opacity:0.01;z-index:99999;';
    document.body.appendChild(inp);
    inp.onchange = () => {
        const file = inp.files?.[0];
        try { document.body.removeChild(inp); } catch {}
        if (file) handleAdminUpload(file);
    };
    inp.click();
}

// ─── PRIVATE CHAT GIF PICKER ──────────────────────────────────────────────────

let _chatGifOpen = false;
let _chatGifTimeout: ReturnType<typeof setTimeout> | null = null;

async function _sendChatGif(gifUrl: string) {
    const activeCurrId = currId || (window as any).currId;
    if (!activeCurrId) return;

    const convUser = users.find((x: any) => x.memberId === activeCurrId || x.id === activeCurrId);
    const conversationEmail = convUser?.member_id || convUser?.email || activeCurrId;

    let senderEmail: string | null = adminEmail || (window as any).adminEmail || null;
    if (!senderEmail) return;

    try {
        const res = await fetch('/api/chat/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                senderEmail,
                conversationId: conversationEmail,
                content: gifUrl,
                type: 'gif',
                metadata: { isQueen: true, gifUrl },
            }),
        });
        const data = await res.json();
        if (data.success && data.data) appendChatMessage(data.data);
    } catch {}
}

export function openChatGifPicker() {
    if (_chatGifOpen) { closeChatGifPicker(); return; }
    _chatGifOpen = true;

    const existing = document.getElementById('chatGifPickerOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'chatGifPickerOverlay';
    overlay.style.cssText = `
        position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
        width:min(420px, 96vw);max-height:55vh;
        background:#0d0b08;border:1px solid rgba(197,160,89,0.25);border-radius:12px;
        display:flex;flex-direction:column;overflow:hidden;z-index:999;
        box-shadow:0 8px 40px rgba(0,0,0,0.7);
    `;

    overlay.innerHTML = `
        <div style="padding:10px 12px 8px;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;display:flex;gap:8px;align-items:center;">
            <input id="chatGifSearchInput" type="text" placeholder="Search GIFs..." autocomplete="off"
                style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;font-family:'Rajdhani',sans-serif;font-size:0.95rem;padding:7px 11px;border-radius:6px;outline:none;" />
            <button onclick="window.closeChatGifPicker()" style="background:none;border:none;color:rgba(255,255,255,0.35);font-size:1.1rem;cursor:pointer;padding:4px 6px;line-height:1;">✕</button>
        </div>
        <div id="chatGifGrid" style="flex:1;overflow-y:auto;padding:8px;display:grid;grid-template-columns:repeat(3,1fr);gap:5px;">
            <div style="grid-column:1/-1;text-align:center;padding:30px;font-family:'Orbitron';font-size:0.5rem;color:rgba(255,255,255,0.2);">SEARCHING...</div>
        </div>
        <div style="padding:5px 10px;text-align:right;flex-shrink:0;">
            <span style="font-family:'Orbitron';font-size:0.32rem;color:rgba(255,255,255,0.12);letter-spacing:1px;">via Tenor</span>
        </div>
    `;

    document.body.appendChild(overlay);

    const searchInput = overlay.querySelector('#chatGifSearchInput') as HTMLInputElement;
    searchInput?.addEventListener('input', () => {
        if (_chatGifTimeout) clearTimeout(_chatGifTimeout);
        _chatGifTimeout = setTimeout(() => _searchChatGifs(searchInput.value || 'funny'), 400);
    });

    _searchChatGifs('funny');
    setTimeout(() => searchInput?.focus(), 50);
}

async function _searchChatGifs(q: string) {
    const grid = document.getElementById('chatGifGrid');
    if (!grid) return;
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;font-family:'Orbitron';font-size:0.5rem;color:rgba(255,255,255,0.2);">LOADING...</div>`;

    try {
        const res = await fetch(`/api/global/gifs?q=${encodeURIComponent(q)}`);
        const { results } = await res.json();
        if (!results?.length) {
            grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;font-family:'Orbitron';font-size:0.5rem;color:rgba(255,255,255,0.2);">NO RESULTS</div>`;
            return;
        }
        grid.innerHTML = results.map((r: any) => `
            <div onclick="window._selectChatGif('${encodeURIComponent(r.url)}')" style="cursor:pointer;border-radius:6px;overflow:hidden;aspect-ratio:1;background:rgba(255,255,255,0.04);">
                <img src="${r.preview}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.parentElement.style.display='none'">
            </div>
        `).join('');
    } catch {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;font-family:'Orbitron';font-size:0.5rem;color:rgba(255,255,255,0.2);">FAILED TO LOAD</div>`;
    }
}

export function closeChatGifPicker() {
    _chatGifOpen = false;
    document.getElementById('chatGifPickerOverlay')?.remove();
}

// ═══════════════════════════════════════════════════════════
// MEDIA VAULT — persistent gallery with categories
// ═══════════════════════════════════════════════════════════

const VAULT_CATEGORIES = ['all', 'feet', 'lifestyle', 'sexy', 'videos'];
let _vaultItems: any[] = [];
let _vaultFilter = 'all';
let _vaultSelectedId: string | null = null;
let _galleryOpen = false;
let _vaultLoaded = false;

export function toggleMediaGallery() {
    const profilePanel = document.getElementById('chatterProfilePanel');
    const galleryPanel = document.getElementById('paidMediaGallery');
    const btnProfile = document.getElementById('panelTabProfile');
    const btnMedia = document.getElementById('panelTabMedia');
    if (!profilePanel || !galleryPanel) return;

    _galleryOpen = !_galleryOpen;
    profilePanel.style.display = _galleryOpen ? 'none' : '';
    galleryPanel.style.display = _galleryOpen ? '' : 'none';
    if (btnProfile) btnProfile.style.borderBottom = _galleryOpen ? 'none' : '2px solid #c5a059';
    if (btnMedia) btnMedia.style.borderBottom = _galleryOpen ? '2px solid #c5a059' : 'none';

    // Load vault on first open
    if (_galleryOpen && !_vaultLoaded) {
        _vaultLoaded = true;
        _loadVault();
    }
}

async function _loadVault() {
    const grid = document.getElementById('vaultGrid');
    if (grid) grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;font-family:Orbitron;font-size:0.4rem;color:#333;letter-spacing:1px;">LOADING...</div>`;

    try {
        const res = await fetch('/api/media-vault');
        const data = await res.json();
        _vaultItems = data.items || [];
        _renderVault();
    } catch {
        if (grid) grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;font-family:Orbitron;font-size:0.4rem;color:#dc3c3c;">FAILED TO LOAD</div>`;
    }
}

export function filterVault(category: string) {
    _vaultFilter = category;
    _vaultSelectedId = null;
    _updateSendBar();

    // Update category pill styles
    document.querySelectorAll('#vaultCategoryBar button').forEach((btn: any) => {
        const cat = btn.dataset.cat;
        btn.style.background = cat === category ? 'rgba(197,160,89,0.15)' : 'transparent';
        btn.style.color = cat === category ? '#c5a059' : '#555';
    });

    _renderVault();
}

function _renderVault() {
    const grid = document.getElementById('vaultGrid');
    if (!grid) return;

    const filtered = _vaultFilter === 'all'
        ? _vaultItems
        : _vaultFilter === 'videos'
            ? _vaultItems.filter(v => v.media_type === 'video')
            : _vaultItems.filter(v => v.category === _vaultFilter);

    if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:30px;font-family:Orbitron;font-size:0.4rem;color:#333;letter-spacing:1px;">NO MEDIA</div>`;
        return;
    }

    grid.innerHTML = filtered.map(item => {
        const isVid = item.media_type === 'video';
        const selected = item.id === _vaultSelectedId;
        const tag = isVid
            ? `<video src="${item.media_url}" muted preload="metadata"></video>`
            : `<img src="${getOptimizedUrl(item.media_url, 200)}" loading="lazy" />`;
        return `
            <div class="mg-thumb${selected ? ' vault-selected' : ''}" onclick="window._selectVaultItem('${item.id}')">
                ${tag}
                ${isVid ? '<div style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.7);border-radius:3px;padding:2px 5px;font-family:Orbitron;font-size:0.3rem;color:#c5a059;">VIDEO</div>' : ''}
                ${selected ? '<div class="mg-selected">✓</div>' : ''}
            </div>`;
    }).join('');
}

function _selectVaultItem(id: string) {
    _vaultSelectedId = _vaultSelectedId === id ? null : id;
    _renderVault();
    _updateSendBar();
}

function _updateSendBar() {
    const bar = document.getElementById('vaultSendBar');
    const preview = document.getElementById('vaultSelectedPreview');
    if (!bar) return;

    if (!_vaultSelectedId) {
        bar.style.display = 'none';
        return;
    }

    bar.style.display = '';
    const item = _vaultItems.find(v => v.id === _vaultSelectedId);
    if (preview && item) {
        const isVid = item.media_type === 'video';
        preview.innerHTML = isVid
            ? `<video src="${item.media_url}" controls preload="metadata" style="width:100%;max-height:120px;border-radius:8px;"></video>`
            : `<img src="${getOptimizedUrl(item.media_url, 400)}" style="width:100%;max-height:120px;border-radius:8px;object-fit:contain;" />`;
    }
}

export async function handleGalleryDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const drop = document.getElementById('galleryDropZone');
    if (drop) drop.classList.remove('dragging');
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
        await _uploadToVault(files[i]);
    }
}

export function handleGalleryPick() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*,video/*';
    inp.multiple = true;
    inp.onchange = async () => {
        if (!inp.files) return;
        for (let i = 0; i < inp.files.length; i++) {
            await _uploadToVault(inp.files[i]);
        }
    };
    inp.click();
}

async function _uploadToVault(file: File) {
    const isVid = file.type.startsWith('video/') || /\.(mp4|mov|webm)/i.test(file.name);

    // Prompt for category
    const cat = prompt(`Category for "${file.name}":\n\nfeet / lifestyle / sexy / uncategorized`, isVid ? 'videos' : 'uncategorized');
    const category = (cat || 'uncategorized').toLowerCase().trim();

    // Show uploading indicator
    const grid = document.getElementById('vaultGrid');
    const placeholderId = `vault_uploading_${Date.now()}`;
    if (grid) {
        grid.insertAdjacentHTML('afterbegin', `
            <div class="mg-thumb" id="${placeholderId}" style="background:#111;display:flex;align-items:center;justify-content:center;">
                <div style="font-family:Orbitron;font-size:0.3rem;color:#555;letter-spacing:1px;">UPLOADING...</div>
            </div>
        `);
    }

    const url = await uploadToSupabase('media', 'paid-media', file);
    const ph = document.getElementById(placeholderId);

    if (url.startsWith('failed')) {
        if (ph) ph.innerHTML = `<div style="font-family:Orbitron;font-size:0.3rem;color:#dc3c3c;">FAILED</div>`;
        setTimeout(() => ph?.remove(), 2000);
        return;
    }

    // Save to vault DB
    try {
        const res = await fetch('/api/media-vault', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mediaUrl: url,
                mediaType: isVid ? 'video' : 'photo',
                category: isVid ? 'videos' : category,
                uploaderEmail: adminEmail,
            }),
        });
        const data = await res.json();
        if (data.success && data.item) {
            _vaultItems.unshift(data.item);
            ph?.remove();
            _renderVault();
        }
    } catch {
        if (ph) ph.innerHTML = `<div style="font-family:Orbitron;font-size:0.3rem;color:#dc3c3c;">SAVE FAILED</div>`;
    }
}

export async function sendPaidMedia() {
    if (!_vaultSelectedId) return;
    const item = _vaultItems.find(v => v.id === _vaultSelectedId);
    if (!item) return;

    const priceInput = document.getElementById('galleryPriceInput') as HTMLInputElement;
    const price = parseInt(priceInput?.value || '0');
    if (!price || price <= 0) {
        priceInput?.focus();
        priceInput?.style.setProperty('border-color', '#dc3c3c');
        return;
    }

    const conversationEmail = currId ? (users.find((u: any) => u.memberId === currId)?.member_id || currId) : '';
    if (!conversationEmail) return;

    const sendBtn = document.getElementById('gallerySendBtn');
    if (sendBtn) { sendBtn.textContent = 'SENDING...'; (sendBtn as HTMLButtonElement).disabled = true; }

    try {
        const res = await fetch('/api/paid-media/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                senderEmail: adminEmail,
                conversationId: conversationEmail,
                mediaUrl: item.media_url,
                mediaType: item.media_type,
                thumbnailUrl: item.thumbnail_url || null,
                price,
            }),
        });
        const data = await res.json();
        if (data.success) {
            // Construct message locally for instant append (real row syncs via realtime)
            const localMsg = {
                member_id: conversationEmail,
                sender_email: adminEmail,
                content: 'PAID_MEDIA',
                type: 'paid_media',
                created_at: new Date().toISOString(),
                metadata: {
                    isQueen: true,
                    paid_media_id: data.paidMediaId,
                    media_url: item.media_url,
                    media_type: item.media_type,
                    thumbnail_url: item.thumbnail_url || null,
                    price,
                },
            };
            appendChatMessage(localMsg);
            _vaultSelectedId = null;
            _renderVault();
            _updateSendBar();
            if (priceInput) priceInput.value = '';
        }
    } catch (err) {
        console.error('[paid-media] send failed:', err);
    }

    if (sendBtn) { sendBtn.textContent = 'SEND PAID MEDIA'; (sendBtn as HTMLButtonElement).disabled = false; }
}

// Global Bindings
if (typeof window !== 'undefined') {
    (window as any).sendMsg = sendMsg;
    (window as any).handleAdminUpload = handleAdminUpload;
    (window as any).triggerAdminMediaPick = triggerAdminMediaPick;
    (window as any).toggleDashSystemLog = toggleDashSystemLog;
    (window as any).openChatGifPicker = openChatGifPicker;
    (window as any).closeChatGifPicker = closeChatGifPicker;
    (window as any)._selectChatGif = (encodedUrl: string) => {
        const url = decodeURIComponent(encodedUrl);
        closeChatGifPicker();
        _sendChatGif(url);
    };
    (window as any).toggleMediaGallery = toggleMediaGallery;
    (window as any).handleGalleryDrop = handleGalleryDrop;
    (window as any).handleGalleryPick = handleGalleryPick;
    (window as any).sendPaidMedia = sendPaidMedia;
    (window as any)._selectVaultItem = _selectVaultItem;
    (window as any).filterVault = filterVault;
}
