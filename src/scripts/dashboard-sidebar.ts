// src/scripts/dashboard-sidebar.ts
// Dashboard Sidebar Management - Converted to TypeScript

import { users, currId, setCurrId, adminReadMap, markReadInMap } from './dashboard-state';
import { clean } from './utils';
import { triggerSound } from './utils';
import { getOptimizedUrl } from './media';
import { isMemberOnline } from './dashboard-presence';
import { updateDetail } from './dashboard-users';

// onlineJoinTime: when each user first came online (only set on offline→online transition)
const onlineJoinTime: Record<string, number> = {};
const soundMemory: Record<string, number> = {};
// Track previous online state to detect actual transitions, not jitter
const prevOnlineState: Record<string, boolean> = {};

/**
 * Canonical ID for a user — always email, lowercase.
 * This is the SINGLE identifier used for read state, presence, localStorage sound keys.
 */
function canonId(u: any): string {
    return (u.member_id || u.email || u.memberId || '').toLowerCase();
}

/**
 * Mark a user's chat as read immediately.
 * Updates in-memory map (instant) and persists to server (async).
 */
export function markAsRead(id: string) {
    if (!id) return;
    const now = Date.now();
    // Find the user to get canonical email
    const user = users.find(u => u.memberId === id || canonId(u) === id.toLowerCase());
    const email = user ? canonId(user) : id.toLowerCase();

    // Update single source of truth
    markReadInMap(email, now);

    // Keep localStorage in sync (migration bridge)
    try { localStorage.setItem('read_' + email, now.toString()); } catch {}

    // Persist to server
    fetch('/api/chat/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'admin', slaveEmail: email, timestamp: new Date(now).toISOString() }),
    }).catch(() => {});
}

/**
 * @deprecated Kept for backward compat — just calls markAsRead on currId.
 */
export function markPendingRead() {
    if (currId) markAsRead(currId);
}

/**
 * Check if a user has unread messages.
 * Compares lastMessageTime against admin_read_at from the DB map.
 * Returns false if this user's chat is currently open.
 */
function hasUnreadMessage(u: any): boolean {
    const email = canonId(u);
    if (!email) return false;
    // If this user's chat is currently open, not unread
    if (currId === u.memberId || currId === email) return false;
    const msgTime = u.lastMessageTime || 0;
    if (msgTime <= 0) return false;
    const readTime = adminReadMap[email] || 0;
    return msgTime > readTime;
}

/**
 * Same as hasUnreadMessage but doesn't skip the currently open user.
 * Used for sound notifications.
 */
function hasUnreadMessageAny(u: any): boolean {
    const email = canonId(u);
    if (!email) return false;
    const msgTime = u.lastMessageTime || 0;
    if (msgTime <= 0) return false;
    const readTime = adminReadMap[email] || 0;
    return msgTime > readTime;
}

/**
 * Check if user is online — presence channel ONLY, no lastSeen fallback.
 */
function isUserOnline(u: any): boolean {
    if (!u) return false;
    const email = canonId(u);
    return email ? isMemberOnline(email) : false;
}

// ── Shared helpers ──────────────────────────────────────────────────────

const DEFAULT_PIC = "/collar-placeholder.png";
const LOCK_PATH = "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z";
const MAIL_PATH = "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z";
const TIMER_PATH = "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z";
const STAR_PATH = "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z";

function getLastSeenMs(u: any): number {
    const raw = u.lastSeen || u.lastWorship || null;
    if (!raw) return 0;
    const t = new Date(raw).getTime();
    return isNaN(t) ? 0 : t;
}

function getStatusText(u: any, now: number): string {
    const online = isUserOnline(u);
    if (online) return "ONLINE";
    const ls = getLastSeenMs(u);
    if (ls <= 0) return "OFFLINE";
    const diffMins = Math.floor((now - ls) / 60000);
    const diffHours = Math.floor(diffMins / 60);
    if (diffMins < 60) return `${Math.max(1, diffMins)} MIN AGO`;
    if (diffHours < 24) return `${diffHours} HR${diffHours > 1 ? 'S' : ''} AGO`;
    if (diffHours < 48) return "YESTERDAY";
    return new Date(ls).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Build the HTML for a single user card */
function buildItemHtml(u: any, now: number): string {
    const isActive = currId === u.memberId;
    const isQueen = u.hierarchy === "Queen";
    const hasMsg = hasUnreadMessage(u);
    const online = isUserOnline(u);
    const statusText = getStatusText(u, now);

    let rawPic = u.avatar || u.profilePicture || DEFAULT_PIC;
    if (rawPic === "null" || rawPic === "undefined" || !rawPic) rawPic = DEFAULT_PIC;
    const finalPic = getOptimizedUrl(rawPic, 80) || DEFAULT_PIC;

    const isSilenced = u.silence === true;
    const isPaywalled = !!(u.parameters?.paywall?.active) || u.paywall === true;
    const isLocked = isSilenced || isPaywalled;

    if (isLocked) {
        const lockColor = isSilenced ? 'rgba(220,60,60,0.85)' : 'rgba(197,160,89,0.85)';
        const lockBg = isSilenced ? 'rgba(220,60,60,0.08)' : 'rgba(197,160,89,0.07)';
        const lockBorder = isSilenced ? 'rgba(220,60,60,0.4)' : 'rgba(197,160,89,0.4)';
        const lockLabel = isSilenced ? 'SILENCED' : 'PAYWALLED';
        return `
            <div class="u-item ${isActive ? 'active' : ''}" data-id="${u.memberId}" onclick="window.selUser('${u.memberId}')" style="cursor:pointer;position:relative;overflow:hidden;background:${lockBg};border:1px solid ${lockBorder};justify-content:center;align-items:center;flex-direction:column;gap:4px;min-height:68px;padding:10px 15px;">
                <img src="${finalPic}" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.07;filter:blur(2px);pointer-events:none;" onerror="this.onerror=null;this.src='${DEFAULT_PIC}'">
                <svg viewBox="0 0 24 24" style="width:28px;height:28px;fill:${lockColor};position:relative;z-index:1;flex-shrink:0;"><path d="${LOCK_PATH}"/></svg>
                <div style="font-family:Orbitron,sans-serif;font-size:0.42rem;color:${lockColor};letter-spacing:3px;position:relative;z-index:1;">${lockLabel}</div>
                <div style="font-family:Orbitron,sans-serif;font-size:0.62rem;color:rgba(255,255,255,0.55);letter-spacing:1px;position:relative;z-index:1;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${clean(u.name)}</div>
            </div>
        `;
    }

    let resolvedEndTime = u.endTime || null;
    if (!resolvedEndTime && u.activeTask?.assigned_at) {
        resolvedEndTime = new Date(u.activeTask.assigned_at).getTime() + (24 * 60 * 60 * 1000);
    }
    const hasActiveTask = u.activeTask && (!resolvedEndTime || resolvedEndTime > Date.now());
    const hasPendingReview = u.reviewQueue && u.reviewQueue.length > 0;

    return `
        <div class="u-item ${isActive ? 'active' : ''} ${isQueen ? 'queen-item' : ''} ${hasMsg ? 'has-msg' : ''}" data-id="${u.memberId}" onclick="window.selUser('${u.memberId}')" style="cursor:pointer;position:relative;overflow:hidden;flex-direction:column;align-items:flex-start;gap:5px;padding:10px 14px;min-height:68px;">
            <img src="${finalPic}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.08;filter:blur(2px);pointer-events:none;" onerror="this.onerror=null;this.src='${DEFAULT_PIC}'">
            ${online ? '<div class="online-dot" style="position:absolute;top:8px;right:8px;z-index:2;"></div>' : ''}
            <div style="display:flex;gap:6px;position:relative;z-index:1;">
                <div class="icon-box" title="${hasMsg ? 'New Message' : 'Message'}"><svg class="svg-icon ${hasMsg ? 'active-msg' : 'icon-dim'}" viewBox="0 0 24 24"><path d="${MAIL_PATH}"/></svg></div>
                <div class="icon-box" title="${hasActiveTask ? 'Active Task' : 'Timer'}"><svg class="svg-icon ${hasActiveTask ? 'active-grey' : 'icon-dim'}" viewBox="0 0 24 24"><path d="${TIMER_PATH}"/></svg></div>
                <div class="icon-box" title="${hasPendingReview ? 'Pending Review' : 'Review'}"><svg class="svg-icon ${hasPendingReview ? 'active-pink' : 'icon-dim'}" viewBox="0 0 24 24"><path d="${STAR_PATH}"/></svg></div>
            </div>
            <div class="u-name" style="position:relative;z-index:1;font-family:'Cinzel',serif;letter-spacing:2px;">${clean(u.name)}</div>
            <div class="u-seen ${online ? 'online' : ''}" style="position:relative;z-index:1;">${statusText}</div>
        </div>
    `;
}

/** Compute sorted order — same 4-tier sort as before */
function getSortedUsers(now: number): any[] {
    const onlineWithUnread = users
        .filter(u => isUserOnline(u) && hasUnreadMessage(u))
        .sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
    const onlineIds = new Set(onlineWithUnread.map(u => u.memberId));

    const onlineNoUnread = users
        .filter(u => isUserOnline(u) && !onlineIds.has(u.memberId))
        .sort((a, b) => (onlineJoinTime[canonId(a)] || now) - (onlineJoinTime[canonId(b)] || now));
    const allOnlineIds = new Set([...onlineIds, ...onlineNoUnread.map(u => u.memberId)]);

    const offlineWithUnread = users
        .filter(u => !allOnlineIds.has(u.memberId) && hasUnreadMessage(u))
        .sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
    const offlineNoUnread = users
        .filter(u => !allOnlineIds.has(u.memberId) && !hasUnreadMessage(u))
        .sort((a, b) => getLastSeenMs(b) - getLastSeenMs(a));

    return [...onlineWithUnread, ...onlineNoUnread, ...offlineWithUnread, ...offlineNoUnread];
}

// Track last known sort order to detect when reorder is needed
let _lastSortOrder: string[] = [];

/**
 * Full sidebar render — used on first load and when users array changes (new user added, etc.)
 */
export function renderSidebar() {
    if (!users.length) return;

    const now = Date.now();

    // ── Update tracking state ────────────────────────────────────────────
    updateTrackingState(now);

    const sorted = getSortedUsers(now);
    _lastSortOrder = sorted.map(u => u.memberId);

    const list = document.getElementById('userList');
    if (!list) return;

    // Full rebuild — only on init or structural changes
    let html = '';
    sorted.forEach(u => { if (u) html += buildItemHtml(u, now); });
    list.innerHTML = html;
}

/**
 * Incremental update — patches a single user's card in-place without touching others.
 * If the sort order changed, moves only the affected card(s).
 */
export function updateSidebarItem(memberId: string) {
    const list = document.getElementById('userList');
    if (!list) return;

    const now = Date.now();
    const u = users.find(x => x.memberId === memberId);
    if (!u) return;

    // Update tracking state for just this user
    const email = canonId(u);
    const online = isUserOnline(u);
    const wasOnline = prevOnlineState[email] ?? false;
    if (online && !wasOnline) onlineJoinTime[email] = now;
    if (!online) delete onlineJoinTime[email];
    prevOnlineState[email] = online;

    // Sound notification
    const lastSound = soundMemory[email] || 0;
    const msgTime = u.lastMessageTime || 0;
    if (hasUnreadMessageAny(u) && msgTime > lastSound) {
        soundMemory[email] = msgTime;
        triggerSound('sfx-notify');
    }

    // Find existing card and replace its content
    const existing = list.querySelector<HTMLElement>(`.u-item[data-id="${memberId}"]`);
    if (!existing) {
        // User not in sidebar yet — do a full render
        renderSidebar();
        return;
    }

    // Build new HTML and swap the element
    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildItemHtml(u, now).trim();
    const newEl = wrapper.firstElementChild as HTMLElement;
    if (newEl) {
        existing.replaceWith(newEl);
    }

    // Check if sort order changed — if so, move the card to the right position
    const newSorted = getSortedUsers(now);
    const newOrder = newSorted.map(x => x.memberId);

    // Only reorder if this user's position actually changed
    const oldIdx = _lastSortOrder.indexOf(memberId);
    const newIdx = newOrder.indexOf(memberId);
    if (oldIdx !== newIdx) {
        reorderSidebar(newOrder);
    }
}

/**
 * Reorder existing DOM nodes without rebuilding them.
 * Uses FLIP animation for the items that actually moved.
 */
function reorderSidebar(newOrder: string[]) {
    const list = document.getElementById('userList');
    if (!list) return;

    // Record positions before reorder
    const beforeRects: Record<string, DOMRect> = {};
    list.querySelectorAll<HTMLElement>('.u-item[data-id]').forEach(el => {
        beforeRects[el.dataset.id!] = el.getBoundingClientRect();
    });

    // Move DOM nodes to match new order (no innerHTML, no destroy/recreate)
    newOrder.forEach(id => {
        const el = list.querySelector<HTMLElement>(`.u-item[data-id="${id}"]`);
        if (el) list.appendChild(el); // moves existing node to end in order
    });

    _lastSortOrder = newOrder;

    // FLIP animate only items that actually moved
    list.querySelectorAll<HTMLElement>('.u-item[data-id]').forEach(el => {
        const id = el.dataset.id!;
        const before = beforeRects[id];
        if (!before) return;
        const after = el.getBoundingClientRect();
        const dy = before.top - after.top;
        if (Math.abs(dy) < 2) return;
        el.style.transition = 'none';
        el.style.transform = `translateY(${dy}px)`;
        requestAnimationFrame(() => {
            el.style.transition = 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
            el.style.transform = 'translateY(0)';
        });
    });
}

/** Update presence tracking state + sound notifications for all users */
function updateTrackingState(now: number) {
    users.forEach(u => {
        const email = canonId(u);
        const online = isUserOnline(u);
        const wasOnline = prevOnlineState[email] ?? false;
        if (online && !wasOnline) onlineJoinTime[email] = now;
        if (!online) delete onlineJoinTime[email];
        prevOnlineState[email] = online;

        const lastSound = soundMemory[email] || 0;
        const msgTime = u.lastMessageTime || 0;
        if (hasUnreadMessageAny(u) && msgTime > lastSound) {
            soundMemory[email] = msgTime;
            triggerSound('sfx-notify');
        }
    });
}

export function selUser(id: string) {
    if (id === currId) return;

    // Close any React overlay panels (GLOBAL / CHALLENGES) so the user view is visible
    (window as any)._closeOverlays?.();

    // Mark this user's chat as read immediately — you see it, it's read
    markAsRead(id);

    // Don't clear chatBox here — initDashboardChat saves the current chat to cache
    // first, then replaces it with cached or fresh content

    setCurrId(id);

    // Just swap the active highlight - no re-render, no reorder
    document.querySelectorAll('#userList .u-item').forEach(el => el.classList.remove('active'));
    const target = document.querySelector(`#userList .u-item[data-id="${id}"]`);
    if (target) target.classList.add('active');

    // Remove the visual mail dot and dim the icon (they're reading it now) but DON'T change sort position
    if (target) {
        target.classList.remove('has-msg');
        const mailSvg = target.querySelector('.active-msg');
        if (mailSvg) {
            mailSvg.classList.remove('active-msg');
            mailSvg.classList.add('icon-dim');
        }
    }

    const vHome = document.getElementById('viewHome');
    if (vHome) vHome.style.display = 'none';
    const vProfile = document.getElementById('viewProfile');
    if (vProfile) vProfile.style.display = 'none';
    const vUser = document.getElementById('viewUser');
    if (vUser) { vUser.style.display = 'flex'; vUser.classList.add('active'); }

    // Update detail panel instantly — no async delay
    const openUser = users.find(x => x.memberId === id);
    if (openUser) updateDetail(openUser);

    // Load chat (async — needs network fetch, but uses cache when available)
    import('./dashboard-chat').then(({ initDashboardChat }) => {
        initDashboardChat(id);
    });
}

if (typeof window !== 'undefined') {
    (window as any).selUser = selUser;
}
