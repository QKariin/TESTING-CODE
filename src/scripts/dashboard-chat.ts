// src/scripts/dashboard-chat.ts
// Dashboard Chat Management - Refactored for Supabase Realtime

import { currId, users, adminEmail, getAdminEmailFallback } from './dashboard-state';
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
let _chatGen = 0; // increments on every user switch — stale callbacks check this
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
    const raw = msg.content || msg.message || '';
    if (raw.startsWith('TASK_REVIEW_CARD::')) return false;
    const sender = (msg.sender_email || msg.sender || '').toLowerCase();
    const content = raw.toUpperCase();
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
    const u = users.find((x: any) => x.memberId === memberIdOrEmail || x.id === memberIdOrEmail || x.member_id === memberIdOrEmail);
    const activeId = u?.memberId || memberIdOrEmail;

    // ── KILL everything from previous user ──
    // Increment generation — every old callback will see a stale number and bail
    const gen = ++_chatGen;

    if (chatAbortController) chatAbortController.abort();
    chatAbortController = new AbortController();

    _saveChatToCache();

    if (chatChannel) { _supabase.removeChannel(chatChannel); chatChannel = null; }
    if (chatPollInterval) { clearInterval(chatPollInterval); chatPollInterval = null; }

    // Clear system log + ticker immediately so old user's logs don't linger
    const logEl = document.getElementById('dashSystemLogContent');
    if (logEl) logEl.innerHTML = '';
    const tickerEl = document.getElementById('dashSystemTicker');
    if (tickerEl) tickerEl.innerHTML = '';

    activeChatEmail = activeId;

    // ── Restore from cache or fetch fresh ──
    const cached = _chatCache.get(activeId.toLowerCase());
    const cacheAge = cached ? Date.now() - cached.cachedAt : Infinity;

    if (cached && cacheAge < 5 * 60 * 1000) {
        lastChatMsgId = cached.lastMsgId;
        lastChatMsgTimestamp = cached.lastTimestamp;
        _renderedMsgIds.clear();
        cached.dedupIds.forEach(id => _renderedMsgIds.add(id));

        const b = document.getElementById('adminChatBox');
        if (b) { b.innerHTML = cached.html; _attachImgScrollHandlers(b); forceBottom(); }
        const logEl = document.getElementById('dashSystemLogContent');
        if (logEl && cached.sysHtml) { logEl.innerHTML = cached.sysHtml; logEl.scrollTop = logEl.scrollHeight; }

        pollNewMessages(activeId, gen);
    } else {
        if (cached) _chatCache.delete(activeId.toLowerCase());
        lastChatMsgId = null;
        lastChatMsgTimestamp = null;
        _renderedMsgIds.clear();

        const b = document.getElementById('adminChatBox');
        if (b) b.innerHTML = '<div style="color:#444; text-align:center; padding:20px; font-family:Rajdhani,sans-serif; font-size:0.7rem;">ESTABLISHING ENCRYPTED LINK...</div>';

        await loadDashboardChatHistory(activeId, gen);
    }

    // Stale? Another user was clicked during await — stop here
    if (gen !== _chatGen) return;

    // ── Realtime subscription ──
    const activeUser = users.find((x: any) => x.memberId === activeId);
    const activeUserEmail = (activeUser?.member_id || activeUser?.email || '').toLowerCase();
    chatChannel = _supabase
        .channel('dash-chat-' + activeId + '-' + gen)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chats' }, (payload) => {
            if (gen !== _chatGen) return; // stale
            const msg = payload.new;
            if (!msg) return;
            const rowMemberId = (msg.member_id || '').toLowerCase();
            if (rowMemberId !== activeId.toLowerCase() && rowMemberId !== activeUserEmail) return;
            appendChatMessage(msg);
        })
        .subscribe();

    // Polling fallback
    chatPollInterval = setInterval(() => {
        if (gen !== _chatGen) { clearInterval(chatPollInterval!); chatPollInterval = null; return; }
        pollNewMessages(activeId, gen);
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
        _chatCache.delete(activeId.toLowerCase());
        activeChatEmail = null;
        initDashboardChat(activeId);
        return;
    }

    pollNewMessages(activeId, _chatGen);
}

async function pollNewMessages(memberId: string, gen: number) {
    if (gen !== _chatGen) return;
    if (!lastChatMsgTimestamp) return;
    try {
        const res = await fetch('/api/chat/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memberId, since: lastChatMsgTimestamp }),
        });
        if (gen !== _chatGen) return;
        if (!res.ok) return;
        const data = await res.json();
        if (gen !== _chatGen) return;
        if (!data.success) return;
        const newMsgs = (data.messages || []).filter((m: any) => {
            const id = m.id ? String(m.id) : null;
            if (id && _renderedMsgIds.has(id)) return false;
            const dk = `${(m.sender_email || '')}::${(m.content || '').slice(0, 80)}::${m.created_at || ''}`;
            if (dk.length > 10 && _renderedMsgIds.has(dk)) return false;
            return true;
        });
        if (gen !== _chatGen) return;
        newMsgs.forEach((m: any) => appendChatMessage(m));
    } catch {
        // silently drop — stale or network error
    }
}

async function loadDashboardChatHistory(memberId: string, gen: number, _retryCount = 0) {
    try {
        const res = await fetch('/api/chat/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memberId }),
        });

        if (gen !== _chatGen) return;

        if (!res.ok && _retryCount < 4) {
            await new Promise(r => setTimeout(r, 1000));
            if (gen !== _chatGen) return;
            return loadDashboardChatHistory(memberId, gen, _retryCount + 1);
        }

        const data = await res.json();
        if (gen !== _chatGen) return;

        if (!data.success) {
            if (_retryCount >= 4) _showRetryUI(memberId, gen);
            return;
        }

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

        msgs.forEach((m: any) => {
            if (m.id) _renderedMsgIds.add(String(m.id));
            const dk = `${(m.sender_email || '')}::${(m.content || '').slice(0, 80)}::${m.created_at || ''}`;
            if (dk.length > 10) _renderedMsgIds.add(dk);
        });

        if (gen !== _chatGen) return;

        const html = chatMsgs.map((m: any) => renderToHtml(m)).join('');
        const b = document.getElementById('adminChatBox');
        if (b) {
            b.innerHTML = html + '<div id="chat-anchor" style="height:1px;"></div>';
            _attachImgScrollHandlers(b);
            forceBottom();
        }
    } catch (err: any) {
        if (gen !== _chatGen) return;
        if (_retryCount < 4) {
            await new Promise(r => setTimeout(r, 1000));
            if (gen !== _chatGen) return;
            return loadDashboardChatHistory(memberId, gen, _retryCount + 1);
        }
        _showRetryUI(memberId, gen);
    }
}

function _showRetryUI(memberId: string, gen: number) {
    if (gen !== _chatGen) return;
    const b = document.getElementById('adminChatBox');
    if (!b) return;
    b.innerHTML = '<div style="color:#e85d75; text-align:center; padding:20px; font-family:Rajdhani,sans-serif; font-size:0.6rem;">LINK FAILED — TAP TO RETRY</div>';
    b.addEventListener('click', () => {
        if (gen === _chatGen) {
            b.innerHTML = '<div style="color:#444; text-align:center; padding:20px; font-family:Rajdhani,sans-serif; font-size:0.7rem;">ESTABLISHING ENCRYPTED LINK...</div>';
            loadDashboardChatHistory(memberId, gen, 0);
        }
    }, { once: true });
    setTimeout(() => {
        if (gen === _chatGen && b.textContent?.includes('LINK FAILED')) {
            b.innerHTML = '<div style="color:#444; text-align:center; padding:20px; font-family:Rajdhani,sans-serif; font-size:0.7rem;">ESTABLISHING ENCRYPTED LINK...</div>';
            loadDashboardChatHistory(memberId, gen, 0);
        }
    }, 5000);
}

export function appendChatMessage(msg: any) {
    // Guard: only render messages for the currently active conversation
    // Compare by UUID (new) or email (old records) — both must match the active user
    if (activeChatEmail && msg.member_id) {
        const msgMid = (msg.member_id || '').toLowerCase();
        const activeId = activeChatEmail.toLowerCase();
        // Also check email for backward compat (old records store email)
        const activeUser = users.find((x: any) => (x.memberId || '').toLowerCase() === activeId);
        const activeEmail = (activeUser?.member_id || activeUser?.email || '').toLowerCase();
        if (msgMid !== activeId && msgMid !== activeEmail) return;
    }

    // Prevent duplicates — use real DB id (now returned by send API)
    const msgId = msg.id ? String(msg.id) : null;
    if (msgId && _renderedMsgIds.has(msgId)) return;
    if (msgId) _renderedMsgIds.add(msgId);
    // Fallback dedup by content+sender+timestamp — catches duplicates when id is
    // missing or differs between API response and realtime payload
    const _dedupKey = `${(msg.sender_email || '')}::${(msg.content || '').slice(0, 80)}::${msg.created_at || ''}`;
    if (_dedupKey.length > 10 && _renderedMsgIds.has(_dedupKey)) return;
    if (_dedupKey.length > 10) _renderedMsgIds.add(_dedupKey);
    lastChatMsgId = msg.id;
    if (msg.created_at) lastChatMsgTimestamp = msg.created_at;

    // Update sidebar card for this conversation — shows unread dot instantly
    // Skip admin-sent messages — only slave messages should trigger unread
    const senderLc = (msg.sender_email || '').toLowerCase();
    const adminLc = (getAdminEmailFallback() || '').toLowerCase();
    const isAdminMsg = adminLc && senderLc === adminLc;
    if (msg.created_at && activeChatEmail && !isAdminMsg) {
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
                                <span style="font-family:Rajdhani,sans-serif;font-size:0.42rem;color:var(--gold);letter-spacing:3px;">✦ RANK PROMOTION</span>
                            </div>
                        </div>
                        <div style="padding:14px 18px 18px;text-align:center;">
                            <div style="font-family:Rajdhani,sans-serif;font-size:0.95rem;color:#fff;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">${purifier.sanitize(d.name||'')}</div>
                            <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:12px;">
                                <span style="font-family:Rajdhani,sans-serif;font-size:0.48rem;color:rgba(var(--gold-rgb),0.4);letter-spacing:1px;text-decoration:line-through;">${(d.oldRank||'').toUpperCase()}</span>
                                <span style="color:rgba(var(--gold-rgb),0.7);font-size:0.9rem;">→</span>
                                <span style="font-family:Rajdhani,sans-serif;font-size:0.55rem;color:var(--gold);letter-spacing:2px;font-weight:700;">${(d.newRank||'').toUpperCase()}</span>
                            </div>
                            <div style="width:70%;height:1px;background:linear-gradient(to right,transparent,rgba(var(--gold-rgb),0.35),transparent);margin:0 auto;"></div>
                        </div>
                    </div>
                    <div class="chat-ts" style="text-align:center;margin-top:4px">${timeStr}</div>
                </div>`;
        } catch (e) { /* fall through */ }
    }

    // ── Welcome Card (new member) ──
    if (content.startsWith('WELCOME_CARD::')) {
        try {
            const d = JSON.parse(content.replace('WELCOME_CARD::', ''));
            const wIni = (d.name || 'S')[0].toUpperCase();
            const SVG_CROWN = `<svg width="13" height="10" viewBox="0 0 26 20" fill="var(--gold)"><path d="M2 18 L5 8 L10 13 L13 3 L16 13 L21 8 L24 18 Z"/><rect x="2" y="17" width="22" height="2" rx="1"/></svg>`;
            return `
                <div class="chat-gift-wrap">
                    <div style="width:260px;max-width:72vw;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0c0a04 0%,#13100a 50%,#0c0a04 100%);border:1px solid rgba(var(--gold-rgb),0.6);box-shadow:0 12px 40px rgba(0,0,0,0.8),0 0 30px rgba(var(--gold-rgb),0.08);">
                        <div style="width:100%;padding:18px 0 12px;display:flex;flex-direction:column;align-items:center;background:radial-gradient(ellipse at center top,rgba(var(--gold-rgb),0.1) 0%,transparent 70%);">
                            <div style="width:56px;height:56px;border-radius:50%;border:2px solid rgba(var(--gold-rgb),0.6);display:flex;align-items:center;justify-content:center;font-family:'Cinzel',serif;font-size:1.4rem;color:var(--gold);background:radial-gradient(circle,rgba(var(--gold-rgb),0.12) 0%,rgba(var(--gold-rgb),0.03) 100%);box-shadow:0 0 20px rgba(var(--gold-rgb),0.15),0 0 40px rgba(var(--gold-rgb),0.05);">${wIni}</div>
                        </div>
                        <div style="padding:4px 16px 18px;text-align:center;">
                            <div style="font-family:'Cinzel',serif;font-size:0.95rem;color:#fff;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:6px;">${purifier.sanitize(d.name || '')}</div>
                            <div style="width:40%;height:1px;background:linear-gradient(to right,transparent,rgba(var(--gold-rgb),0.5),transparent);margin:0 auto 8px;"></div>
                            <div style="font-family:Rajdhani,sans-serif;font-size:0.38rem;color:rgba(var(--gold-rgb),0.65);letter-spacing:3px;margin-bottom:10px;">HAS ENTERED THE COURT</div>
                            <div style="display:inline-flex;align-items:center;gap:5px;background:rgba(var(--gold-rgb),0.06);border:1px solid rgba(var(--gold-rgb),0.25);border-radius:20px;padding:3px 12px;">${SVG_CROWN}<span style="font-family:Rajdhani,sans-serif;font-size:0.42rem;color:var(--gold);letter-spacing:2px;">${(d.rank || 'HALL BOY').toUpperCase()}</span></div>
                            <button onclick="event.stopPropagation();window._shareNewMemberOnX('${purifier.sanitize(d.name || '').replace(/'/g, "\\'")}','${(d.rank || 'Hall Boy').replace(/'/g, "\\'")}','${(d.avatar || '').replace(/'/g, "\\'")}')" style="display:block;margin:10px auto 0;padding:5px 16px;border-radius:4px;border:1px solid rgba(255,255,255,0.15);background:rgba(0,0,0,0.5);color:#fff;font-family:Rajdhani,sans-serif;font-size:0.4rem;letter-spacing:2px;cursor:pointer;">SHARE ON X</button>
                        </div>
                    </div>
                    <div class="chat-ts" style="text-align:center;margin-top:4px">${timeStr}</div>
                </div>`;
        } catch (e) { /* fall through */ }
    }

    // ── Certificate Proof Card ──
    if (content.startsWith('CERT_PROOF::')) {
        try {
            const d = JSON.parse(content.replace('CERT_PROOF::', ''));
            const imgUrl = d.mediaUrl || '';
            const userName = purifier.sanitize(d.userName || 'Unknown');
            const proofMemberId = (d.memberId || m.sender_email || m.member_id || '').replace(/'/g, "\\'");
            const cid = m.id || Date.now();
            return `
                <div class="chat-gift-wrap">
                    <div style="max-width:300px;width:70vw;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0c0a04 0%,#13100a 50%,#0c0a04 100%);border:1px solid rgba(197,160,89,0.4);box-shadow:0 12px 40px rgba(0,0,0,0.8),0 0 20px rgba(197,160,89,0.06);">
                        ${imgUrl ? `<div style="position:relative;"><img src="${imgUrl}" style="width:100%;max-height:220px;object-fit:cover;display:block;cursor:pointer;" onclick="window.open('${imgUrl}','_blank')" onerror="this.style.display='none'"><div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 50%,#0c0a04 100%);pointer-events:none;"></div></div>` : ''}
                        <div style="padding:14px 18px 18px;text-align:center;">
                            <div style="font-family:'Cinzel',serif;font-size:0.48rem;color:rgba(197,160,89,0.5);letter-spacing:3px;text-transform:uppercase;margin-bottom:6px;">Certificate Proof</div>
                            <div style="width:30%;height:1px;background:linear-gradient(to right,transparent,rgba(197,160,89,0.35),transparent);margin:0 auto 10px;"></div>
                            <div style="font-family:'Cinzel',serif;font-size:0.9rem;color:#fff;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;">${userName}</div>
                            <div id="certAction_${cid}" style="display:flex;gap:10px;">
                                <button onclick="event.stopPropagation();window._approveCertProof('${proofMemberId}','${cid}')" style="flex:1;padding:10px 8px;border-radius:8px;border:1px solid rgba(74,222,128,0.35);background:rgba(74,222,128,0.06);color:#4ade80;font-family:'Cinzel',serif;font-size:0.6rem;letter-spacing:2px;cursor:pointer;transition:all 0.2s;">APPROVE +300</button>
                                <button onclick="event.stopPropagation();window._rejectCertProof('${proofMemberId}','${cid}')" style="flex:1;padding:10px 8px;border-radius:8px;border:1px solid rgba(255,60,60,0.2);background:rgba(255,60,60,0.04);color:rgba(255,60,60,0.6);font-family:'Cinzel',serif;font-size:0.6rem;letter-spacing:2px;cursor:pointer;transition:all 0.2s;">REJECT</button>
                            </div>
                        </div>
                    </div>
                    ${timeStr ? `<div class="chat-ts" style="text-align:center;margin-top:4px">${timeStr}</div>` : ''}
                </div>`;
        } catch (e) { /* fall through */ }
    }

    // ── Certificate Approved/Rejected (dashboard sees these too) ──
    if (content.startsWith('CERT_APPROVED::')) {
        try {
            const d = JSON.parse(content.replace('CERT_APPROVED::', ''));
            return `<div class="chat-gift-wrap"><div style="max-width:260px;width:60vw;border-radius:12px;background:rgba(74,222,128,0.04);border:1px solid rgba(74,222,128,0.25);padding:14px 18px;text-align:center;"><div style="font-family:'Cinzel',serif;font-size:0.45rem;color:rgba(74,222,128,0.6);letter-spacing:3px;margin-bottom:4px;">CERTIFICATE APPROVED</div><div style="font-family:'Cinzel',serif;font-size:0.85rem;color:#4ade80;font-weight:700;">+${d.reward || 300} COINS</div></div>${timeStr ? `<div class="chat-ts" style="text-align:center;margin-top:4px">${timeStr}</div>` : ''}</div>`;
        } catch (_) { /* fall through */ }
    }

    if (content.startsWith('CERT_REJECTED::')) {
        return `<div class="chat-gift-wrap"><div style="max-width:260px;width:60vw;border-radius:12px;background:rgba(255,60,60,0.04);border:1px solid rgba(255,60,60,0.15);padding:14px 18px;text-align:center;"><div style="font-family:'Cinzel',serif;font-size:0.45rem;color:rgba(255,60,60,0.5);letter-spacing:3px;">CERTIFICATE REJECTED</div></div>${timeStr ? `<div class="chat-ts" style="text-align:center;margin-top:4px">${timeStr}</div>` : ''}</div>`;
    }

    // ── Routine Change Card ──
    if (content.startsWith('ROUTINE_CHANGE::')) {
        try {
            const d = JSON.parse(content.replace('ROUTINE_CHANGE::', ''));
            return `<div class="chat-gift-wrap">
                <div style="max-width:360px;width:70%;border-radius:12px;overflow:hidden;background:linear-gradient(170deg,#0c0806 0%,#0e0a04 60%,#0a0703 100%);border:1px solid rgba(197,160,89,0.35);box-shadow:0 8px 30px rgba(0,0,0,0.6);">
                    <div style="padding:18px 20px;text-align:center;">
                        <div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(197,160,89,0.5);letter-spacing:3px;margin-bottom:12px;">ROUTINE UPDATED</div>
                        <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
                            <span style="font-family:'Rajdhani',sans-serif;font-size:0.82rem;color:rgba(255,255,255,0.3);text-decoration:line-through;">${(d.oldRoutine || 'None').toUpperCase()}</span>
                            <span style="color:rgba(197,160,89,0.6);font-size:0.85rem;">\u2192</span>
                            <span style="font-family:'Cinzel',serif;font-size:0.9rem;color:#c5a059;font-weight:700;letter-spacing:1px;">${(d.newRoutine || 'None').toUpperCase()}</span>
                        </div>
                        <div style="width:60%;height:1px;background:linear-gradient(to right,transparent,rgba(197,160,89,0.25),transparent);margin:0 auto;"></div>
                    </div>
                </div>
                ${timeStr ? `<div class="chat-ts" style="text-align:center;margin-top:4px">${timeStr}</div>` : ''}
            </div>`;
        } catch { return ''; }
    }

    // ── Task Feedback Card ── centered, clickable to open history modal
    if (content.startsWith('TASK_FEEDBACK::')) {
        try {
            const data = JSON.parse(content.replace('TASK_FEEDBACK::', ''));
            const { mediaUrl: fbMedia, mediaType: fbType, note: fbNote, taskId: fbTaskId, memberId: fbMemberId } = data;
            const fbIsVideo = (fbType && (fbType === 'video' || fbType.startsWith('video/'))) || (fbMedia && /\.(mp4|mov|webm)/i.test(fbMedia));
            // Videos: use raw URL; images: use optimized URL
            const fbSrc = fbMedia ? (fbIsVideo ? fbMedia : getOptimizedUrl(fbMedia, 600)) : null;
            // Look up thumbnail: first from payload, then from user's task/routine history
            let fbThumb = data.thumbnailUrl || data.thumbnail_url || null;
            if (!fbThumb && fbIsVideo && fbTaskId) {
                const u = users.find((x: any) => x.memberId === fbMemberId);
                if (u) {
                    let hist: any[] = [];
                    try { hist = typeof u.Taskdom_History === 'string' ? JSON.parse(u.Taskdom_History) : (u.Taskdom_History || []); } catch {}
                    const entry = hist.find((e: any) => e.id === fbTaskId);
                    if (entry?.thumbnail_url) fbThumb = entry.thumbnail_url;
                }
            }
            const fbThumbSrc = fbIsVideo && fbThumb ? fbThumb : null;
            const mediaBlock = fbSrc
                ? (fbIsVideo
                    ? `<div style="position:relative;width:100%;max-height:180px;overflow:hidden;border-radius:10px 10px 0 0;cursor:pointer;background:#0a0a0a;" onclick="event.stopPropagation();window.openModById&&'${fbTaskId}'&&'${fbMemberId}'?window.openModById('${fbTaskId}','${fbMemberId}',true):void 0">
                        ${fbThumbSrc ? `<img src="${fbThumbSrc}" style="width:100%;max-height:180px;object-fit:cover;display:block;" onerror="this.style.display='none'">` : '<div style="height:120px;"></div>'}
                        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;"><svg width="36" height="36" viewBox="0 0 24 24" fill="rgba(255,255,255,0.8)" style="filter:drop-shadow(0 2px 6px rgba(0,0,0,0.6));"><path d="M8 5v14l11-7z"/></svg></div>
                       </div>`
                    : `<img src="${fbSrc}" style="width:100%;max-height:180px;object-fit:cover;display:block;border-radius:10px 10px 0 0;cursor:pointer;" onerror="this.style.display='none'" onclick="event.stopPropagation();window.openModById&&'${fbTaskId}'&&'${fbMemberId}'?window.openModById('${fbTaskId}','${fbMemberId}',true):void 0">`)
                : '';
            const cardHtml = `
                <div class="chat-gift-wrap" style="cursor:pointer;" onclick="window.openModById&&'${fbTaskId}'&&'${fbMemberId}'?window.openModById('${fbTaskId}','${fbMemberId}',true):void 0">
                    <div style="max-width:240px;width:55vw;border-radius:12px;overflow:hidden;background:#0a080a;border:1px solid rgba(var(--gold-rgb),0.4);box-shadow:0 6px 24px rgba(0,0,0,0.6);">
                        ${mediaBlock}
                        <div style="padding:9px 12px 11px;">
                            <div style="font-family:Rajdhani,sans-serif;font-size:0.42rem;color:rgba(var(--gold-rgb),0.6);letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;">✦ Task Feedback</div>
                            ${fbNote ? `<div style="font-family:Rajdhani,sans-serif;font-size:0.85rem;color:rgba(255,255,255,0.82);line-height:1.4;">${purifier.sanitize(fbNote)}</div>` : ''}
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

    // ── Task Review Card ──
    if (content.startsWith('TASK_REVIEW_CARD::')) {
        try {
            const d = JSON.parse(content.replace('TASK_REVIEW_CARD::', ''));
            const approved = d.status === 'approve';
            const borderColor = approved ? 'rgba(74,222,128,0.5)' : 'rgba(255,60,60,0.4)';
            const accentColor = approved ? '#4ade80' : '#e85d75';
            const icon = approved ? '✓' : '✗';
            const label = d.type === 'routine' ? 'ROUTINE' : 'TASK';
            const statusText = approved ? 'APPROVED' : 'REJECTED';
            const pointsLine = approved && d.points
                ? `<div style="font-family:'Cinzel',serif;font-size:0.75rem;color:${accentColor};font-weight:700;letter-spacing:1px;">+${(d.points || 0).toLocaleString()} MERIT</div>`
                : d.penalty
                    ? `<div style="font-family:'Cinzel',serif;font-size:0.75rem;color:${accentColor};font-weight:700;letter-spacing:1px;">-${d.penalty} COINS</div>`
                    : '';
            const commentLine = d.comment
                ? `<div style="font-family:Rajdhani,sans-serif;font-size:0.45rem;color:rgba(255,255,255,0.4);margin-top:6px;font-style:italic;">"${purifier.sanitize(d.comment)}"</div>`
                : '';
            return `
                <div class="chat-gift-wrap">
                    <div style="max-width:260px;width:65vw;border-radius:14px;overflow:hidden;background:linear-gradient(170deg,#0e0b06,#110d04,#0a0703);border:1px solid ${borderColor};box-shadow:0 12px 40px rgba(0,0,0,0.8);">
                        <div style="padding:18px 20px;text-align:center;">
                            <div style="font-family:'Cinzel',serif;font-size:0.42rem;color:${accentColor};letter-spacing:3px;margin-bottom:10px;">${label} ${statusText}</div>
                            <div style="width:40%;height:1px;background:linear-gradient(to right,transparent,${borderColor},transparent);margin:0 auto 12px;"></div>
                            <div style="font-size:1.6rem;margin-bottom:8px;">${icon}</div>
                            ${pointsLine}
                            ${commentLine}
                        </div>
                    </div>
                    <div class="chat-ts" style="text-align:center;margin-top:4px">${timeStr}</div>
                </div>`;
        } catch { /* fall through */ }
    }

    // ── Direct Tribute Card ──
    if (content.startsWith('DIRECT_TRIBUTE_CARD::')) {
        try {
            const d = JSON.parse(content.replace('DIRECT_TRIBUTE_CARD::', ''));
            const amt = (d.amount || 0).toLocaleString();
            return `
                <div class="chat-gift-wrap">
                    <div style="max-width:260px;width:65vw;border-radius:14px;overflow:hidden;background:linear-gradient(170deg,#0e0b06,#110d04,#0a0703);border:1px solid rgba(var(--gold-rgb),0.5);box-shadow:0 12px 40px rgba(0,0,0,0.8);">
                        <div style="padding:18px 20px;text-align:center;">
                            <div style="font-family:'Cinzel',serif;font-size:0.42rem;color:rgba(var(--gold-rgb),0.5);letter-spacing:3px;margin-bottom:10px;">DIRECT TRIBUTE</div>
                            <div style="width:40%;height:1px;background:linear-gradient(to right,transparent,rgba(var(--gold-rgb),0.4),transparent);margin:0 auto 12px;"></div>
                            <div style="font-family:'Cinzel',serif;font-size:0.85rem;color:#c5a059;font-weight:700;letter-spacing:1px;margin-bottom:6px;">${amt} <i class="fas fa-coins" style="font-size:0.7rem;"></i></div>
                            <div style="font-family:Rajdhani,sans-serif;font-size:0.4rem;color:rgba(255,255,255,0.35);letter-spacing:2px;">from ${purifier.sanitize(d.senderName || '')}</div>
                        </div>
                    </div>
                    <div class="chat-ts" style="text-align:center;margin-top:4px">${timeStr}</div>
                </div>`;
        } catch { /* fall through */ }
    }

    // ── Risky Tribute Card ──
    if (content.startsWith('RISKY_TRIBUTE_CARD::')) {
        try {
            const d = JSON.parse(content.replace('RISKY_TRIBUTE_CARD::', ''));
            const isWin = d.isWin && d.wonAmount > 0;
            const borderColor = isWin ? 'rgba(74,222,128,0.5)' : (d.lostAmount > 0 ? 'rgba(255,60,60,0.4)' : 'rgba(var(--gold-rgb),0.4)');
            const accentColor = isWin ? '#4ade80' : (d.lostAmount > 0 ? '#e85d75' : '#c5a059');
            const label = isWin ? 'JACKPOT' : d.cardName || 'RISKY TRIBUTE';
            const resultText = isWin
                ? `Won ${(d.wonAmount || 0).toLocaleString()} coins back`
                : d.lostAmount > 0
                    ? `Queen took ${(d.lostAmount || 0).toLocaleString()} coins`
                    : 'Lost nothing';
            return `
                <div class="chat-gift-wrap">
                    <div style="max-width:260px;width:65vw;border-radius:14px;overflow:hidden;background:linear-gradient(170deg,#0e0b06,#110d04,#0a0703);border:1px solid ${borderColor};box-shadow:0 12px 40px rgba(0,0,0,0.8);">
                        <div style="padding:18px 20px;text-align:center;">
                            <div style="font-family:'Cinzel',serif;font-size:0.42rem;color:${accentColor};letter-spacing:3px;margin-bottom:10px;">${label}</div>
                            <div style="width:40%;height:1px;background:linear-gradient(to right,transparent,${borderColor},transparent);margin:0 auto 12px;"></div>
                            ${d.icon ? `<img src="${d.icon}" style="width:48px;height:48px;margin-bottom:10px;opacity:0.8;" onerror="this.style.display='none'" />` : ''}
                            <div style="font-family:Rajdhani,sans-serif;font-size:0.55rem;color:rgba(255,255,255,0.5);letter-spacing:1px;margin-bottom:4px;">Staked ${(d.stakeAmount || 0).toLocaleString()}</div>
                            <div style="font-family:'Cinzel',serif;font-size:0.7rem;color:${accentColor};font-weight:700;letter-spacing:1px;">${resultText}</div>
                            <div style="font-family:Rajdhani,sans-serif;font-size:0.4rem;color:rgba(255,255,255,0.35);letter-spacing:2px;margin-top:8px;">from ${purifier.sanitize(d.senderName || '')}</div>
                        </div>
                    </div>
                    <div class="chat-ts" style="text-align:center;margin-top:4px">${timeStr}</div>
                </div>`;
        } catch { /* fall through */ }
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
    // chats.member_id stores UUID — resolve to UUID for the conversation
    const convUser = users.find((x: any) => x.memberId === activeCurrId || x.id === activeCurrId);
    const conversationUUID = convUser?.memberId || activeCurrId;

    const text = inp.value.trim();
    if (!text) return;

    if (inp.disabled) return;
    inp.disabled = true;
    if (btn) btn.disabled = true;

    // Resolve admin email: state → window → sessionStorage → Supabase auth
    let senderEmail: string | null = getAdminEmailFallback();
    if (!senderEmail) {
        try {
            const { data: { user } } = await _supabase.auth.getUser();
            senderEmail = user?.email || null;
            if (senderEmail) {
                const { setAdminEmail } = await import('./dashboard-state');
                setAdminEmail(senderEmail);
            }
        } catch (_) {}
    }
    if (!senderEmail) {
        console.error(`[DASHBOARD-CHAT] Send failed: Admin email not available.`);
        alert("Authentication Error: Admin email not found. Please refresh the page.");
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
                conversationId: conversationUUID,
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
    // chats.member_id stores UUID
    const mediaConvUser = users.find((x: any) => x.memberId === activeCurrId || x.id === activeCurrId);
    const mediaConvUUID = mediaConvUser?.memberId || activeCurrId;

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
                <span style="font-family:Rajdhani,sans-serif;font-size:0.48rem;color:rgba(197,160,89,0.7);letter-spacing:3px;">${isVideo ? 'VIDEO' : 'PHOTO'} PREVIEW</span>
                <button id="__adminMediaClose" style="background:none;border:none;color:#555;font-size:1.2rem;cursor:pointer;line-height:1;padding:0 4px;">✕</button>
            </div>
            <div style="padding:16px;display:flex;justify-content:center;background:#050403;">
                ${mediaEl}
            </div>
            <div style="padding:14px 18px;display:flex;flex-direction:column;gap:10px;">
                <div id="__adminMediaStatus" style="font-family:Rajdhani,sans-serif;font-size:0.42rem;color:#c55;text-align:center;min-height:16px;"></div>
                <div style="display:flex;gap:10px;">
                    <button id="__adminMediaCancel" style="flex:1;padding:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#666;font-family:Rajdhani,sans-serif;font-size:0.48rem;letter-spacing:2px;cursor:pointer;">CANCEL</button>
                    <button id="__adminMediaSend" style="flex:2;padding:12px;background:linear-gradient(135deg,#c5a059,#8b6914);border:none;border-radius:8px;color:#000;font-family:Rajdhani,sans-serif;font-size:0.48rem;font-weight:700;letter-spacing:2px;cursor:pointer;">SEND</button>
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

            let userEmail = getAdminEmailFallback();
            if (!userEmail) {
                const { data: { user } } = await _supabase.auth.getUser();
                userEmail = user?.email || null;
            }
            if (!userEmail && typeof window !== 'undefined' && window.location.hostname === 'localhost') {
                userEmail = 'ceo@qkarin.com';
            }
            if (!userEmail) { close(); return; }

            const sendRes = await fetch('/api/chat/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ senderEmail: userEmail, conversationId: mediaConvUUID, content: url, type: msgType }),
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
    const conversationUUID = convUser?.memberId || activeCurrId;

    let senderEmail: string | null = getAdminEmailFallback();
    if (!senderEmail) return;

    try {
        const res = await fetch('/api/chat/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                senderEmail,
                conversationId: conversationUUID,
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
                style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;font-family:Rajdhani,sans-serif;font-size:0.95rem;padding:7px 11px;border-radius:6px;outline:none;" />
            <button onclick="window.closeChatGifPicker()" style="background:none;border:none;color:rgba(255,255,255,0.35);font-size:1.1rem;cursor:pointer;padding:4px 6px;line-height:1;">✕</button>
        </div>
        <div id="chatGifGrid" style="flex:1;overflow-y:auto;padding:8px;display:grid;grid-template-columns:repeat(3,1fr);gap:5px;">
            <div style="grid-column:1/-1;text-align:center;padding:30px;font-family:Rajdhani,sans-serif;font-size:0.5rem;color:rgba(255,255,255,0.2);">SEARCHING...</div>
        </div>
        <div style="padding:5px 10px;text-align:right;flex-shrink:0;">
            <span style="font-family:Rajdhani,sans-serif;font-size:0.32rem;color:rgba(255,255,255,0.12);letter-spacing:1px;">via Tenor</span>
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
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;font-family:Rajdhani,sans-serif;font-size:0.5rem;color:rgba(255,255,255,0.2);">LOADING...</div>`;

    try {
        const res = await fetch(`/api/global/gifs?q=${encodeURIComponent(q)}`);
        const { results } = await res.json();
        if (!results?.length) {
            grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;font-family:Rajdhani,sans-serif;font-size:0.5rem;color:rgba(255,255,255,0.2);">NO RESULTS</div>`;
            return;
        }
        grid.innerHTML = results.map((r: any) => `
            <div onclick="window._selectChatGif('${encodeURIComponent(r.url)}')" style="cursor:pointer;border-radius:6px;overflow:hidden;aspect-ratio:1;background:rgba(255,255,255,0.04);">
                <img src="${r.preview}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.parentElement.style.display='none'">
            </div>
        `).join('');
    } catch {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;font-family:Rajdhani,sans-serif;font-size:0.5rem;color:rgba(255,255,255,0.2);">FAILED TO LOAD</div>`;
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
    if (grid) grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;font-family:Rajdhani,sans-serif;font-size:0.4rem;color:#333;letter-spacing:1px;">LOADING...</div>`;

    try {
        const res = await fetch('/api/media-vault');
        const data = await res.json();
        _vaultItems = data.items || [];
        _renderVault();
    } catch {
        if (grid) grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;font-family:Rajdhani,sans-serif;font-size:0.4rem;color:#dc3c3c;">FAILED TO LOAD</div>`;
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
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:30px;font-family:Rajdhani,sans-serif;font-size:0.4rem;color:#333;letter-spacing:1px;">NO MEDIA</div>`;
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
                ${isVid ? '<div style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.7);border-radius:3px;padding:2px 5px;font-family:Rajdhani,sans-serif;font-size:0.3rem;color:#c5a059;">VIDEO</div>' : ''}
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
                <div style="font-family:Rajdhani,sans-serif;font-size:0.3rem;color:#555;letter-spacing:1px;">UPLOADING...</div>
            </div>
        `);
    }

    const url = await uploadToSupabase('media', 'paid-media', file);
    const ph = document.getElementById(placeholderId);

    if (url.startsWith('failed')) {
        if (ph) ph.innerHTML = `<div style="font-family:Rajdhani,sans-serif;font-size:0.3rem;color:#dc3c3c;">FAILED</div>`;
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
        if (ph) ph.innerHTML = `<div style="font-family:Rajdhani,sans-serif;font-size:0.3rem;color:#dc3c3c;">SAVE FAILED</div>`;
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
async function _approveCertProof(memberId: string, cardId: string) {
    try {
        const res = await fetch('/api/cert-proof', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'approve', memberId }),
        });
        const data = await res.json();
        if (!res.ok) { alert(data.error || 'Failed'); return; }
        const el = document.getElementById(`certAction_${cardId}`);
        if (el) el.innerHTML = '<div style="font-family:Rajdhani,sans-serif;font-size:0.42rem;color:#4ade80;letter-spacing:2px;text-align:center;">APPROVED +300 COINS</div>';
    } catch (e) { alert('Error approving proof.'); }
}

async function _rejectCertProof(memberId: string, cardId: string) {
    try {
        const res = await fetch('/api/cert-proof', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reject', memberId }),
        });
        const data = await res.json();
        if (!res.ok) { alert(data.error || 'Failed'); return; }
        const el = document.getElementById(`certAction_${cardId}`);
        if (el) el.innerHTML = '<div style="font-family:Rajdhani,sans-serif;font-size:0.42rem;color:rgba(255,60,60,0.7);letter-spacing:2px;text-align:center;">REJECTED</div>';
    } catch (e) { alert('Error rejecting proof.'); }
}

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
    (window as any)._shareNewMemberOnX = _shareNewMemberOnX;
    (window as any)._approveCertProof = _approveCertProof;
    (window as any)._rejectCertProof = _rejectCertProof;
}

function _shareNewMemberOnX(name: string, rank: string, avatarUrl: string) {
    const W = 1200, H = 630;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    function draw(avImg: HTMLImageElement | null, sigImg: HTMLImageElement | null) {
        // Background
        ctx.fillStyle = '#0a0806';
        ctx.fillRect(0, 0, W, H);
        const grad = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, W * 0.6);
        grad.addColorStop(0, 'rgba(197,160,89,0.06)');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Borders
        ctx.strokeStyle = 'rgba(197,160,89,0.35)';
        ctx.lineWidth = 2;
        ctx.strokeRect(16, 16, W - 32, H - 32);
        ctx.strokeStyle = 'rgba(197,160,89,0.1)';
        ctx.lineWidth = 1;
        ctx.strokeRect(24, 24, W - 48, H - 48);

        const gold = '#c5a059';
        const white = 'rgba(255,255,255,0.9)';
        const cx = W / 2;

        // Headline
        ctx.textAlign = 'center';
        ctx.font = '700 28px Cinzel, serif';
        ctx.fillStyle = 'rgba(197,160,89,0.7)';
        ctx.letterSpacing = '8px';
        ctx.fillText('A NEW SUBJECT', cx, 80);
        ctx.letterSpacing = '0px';
        ctx.font = '400 15px Cinzel, serif';
        ctx.fillStyle = 'rgba(197,160,89,0.45)';
        ctx.letterSpacing = '5px';
        ctx.fillText('HAS ENTERED THE COURT', cx, 110);
        ctx.letterSpacing = '0px';

        // Divider
        const topDiv = ctx.createLinearGradient(200, 0, W - 200, 0);
        topDiv.addColorStop(0, 'transparent');
        topDiv.addColorStop(0.5, 'rgba(197,160,89,0.3)');
        topDiv.addColorStop(1, 'transparent');
        ctx.fillStyle = topDiv;
        ctx.fillRect(200, 130, W - 400, 1);

        // Avatar
        const avSize = 160;
        const avY = 170;
        if (avImg) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, avY + avSize / 2, avSize / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avImg, cx - avSize / 2, avY, avSize, avSize);
            ctx.restore();
            ctx.beginPath();
            ctx.arc(cx, avY + avSize / 2, avSize / 2 + 2, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(197,160,89,0.4)';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else {
            // Initial circle
            ctx.beginPath();
            ctx.arc(cx, avY + avSize / 2, avSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(197,160,89,0.08)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(197,160,89,0.4)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.font = '700 60px Cinzel, serif';
            ctx.fillStyle = gold;
            ctx.textAlign = 'center';
            ctx.fillText((name || 'S')[0].toUpperCase(), cx, avY + avSize / 2 + 20);
        }

        // Name
        ctx.textAlign = 'center';
        ctx.font = '700 38px Cinzel, serif';
        ctx.fillStyle = white;
        ctx.fillText(name.toUpperCase(), cx, avY + avSize + 55);

        // Rank
        ctx.font = '400 22px Cinzel, serif';
        ctx.fillStyle = 'rgba(197,160,89,0.6)';
        ctx.letterSpacing = '4px';
        ctx.fillText(rank.toUpperCase(), cx, avY + avSize + 90);
        ctx.letterSpacing = '0px';

        // Divider under rank
        const btmDiv = ctx.createLinearGradient(300, 0, W - 300, 0);
        btmDiv.addColorStop(0, 'transparent');
        btmDiv.addColorStop(0.5, 'rgba(197,160,89,0.25)');
        btmDiv.addColorStop(1, 'transparent');
        ctx.fillStyle = btmDiv;
        ctx.fillRect(300, avY + avSize + 108, W - 600, 1);

        // Signature
        if (sigImg) {
            const sigW = 240;
            const sigH = sigW * (sigImg.naturalHeight / sigImg.naturalWidth);
            ctx.globalAlpha = 0.45;
            ctx.drawImage(sigImg, cx - sigW / 2, H - sigH - 35, sigW, sigH);
            ctx.globalAlpha = 1.0;
        }

        // Export
        canvas.toBlob(async (blob) => {
            if (!blob) return;
            const file = new File([blob], 'new-member.png', { type: 'image/png' });
            if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
                try {
                    await navigator.share({ files: [file], text: `A new subject has entered my court 👑 @qkarin_com #QKarin`, title: 'New Member' });
                    return;
                } catch (_) {}
            }
            // Desktop: download + open X
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'new-member.png'; a.click();
            URL.revokeObjectURL(url);
            const text = `A new subject has entered my court 👑 @qkarin_com #QKarin`;
            setTimeout(() => window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank'), 500);
        }, 'image/png');
    }

    // Load images
    let avImg: HTMLImageElement | null = null;
    let sigImg: HTMLImageElement | null = null;
    let pending = 2;
    function done() { pending--; if (pending <= 0) draw(avImg, sigImg); }

    const sig = new Image();
    sig.crossOrigin = 'anonymous';
    sig.onload = () => { sigImg = sig; done(); };
    sig.onerror = () => done();
    sig.src = '/signature.svg';

    if (avatarUrl) {
        fetch(avatarUrl, { mode: 'cors' })
            .then(r => r.blob())
            .then(blob => {
                const u = URL.createObjectURL(blob);
                const img = new Image();
                img.onload = () => { avImg = img; URL.revokeObjectURL(u); done(); };
                img.onerror = () => { URL.revokeObjectURL(u); done(); };
                img.src = u;
            })
            .catch(() => done());
    } else {
        done();
    }
}
