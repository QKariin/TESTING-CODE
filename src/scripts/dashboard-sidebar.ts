// src/scripts/dashboard-sidebar.ts
// Dashboard Sidebar Management - Converted to TypeScript

import { users, currId, setCurrId } from './dashboard-state';
import { clean } from './utils';
import { triggerSound } from './utils';
import { getOptimizedUrl } from './media';
import { isMemberOnline } from './dashboard-presence';

// firstUnreadTime: when each user's FIRST unread message arrived
const firstUnreadTime: Record<string, number> = {};
// onlineJoinTime: when each user first came online (only set on offline→online transition)
const onlineJoinTime: Record<string, number> = {};
const soundMemory: { [key: string]: number } = {};
// Track previous online state to detect actual transitions, not jitter
const prevOnlineState: Record<string, boolean> = {};

// pendingReadId: user currently open who had unread - read is deferred until we leave them
let pendingReadId: string | null = null;

/**
 * Mark the pending (currently viewed) user as read.
 * Call this when navigating AWAY from a user (selecting another, going home/posts).
 */
export function markPendingRead() {
    if (pendingReadId) {
        const now = Date.now();
        localStorage.setItem('read_' + pendingReadId, now.toString());
        // Persist to server (fire and forget)
        fetch('/api/chat/mark-read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'admin', slaveEmail: pendingReadId, timestamp: new Date(now).toISOString() }),
        }).catch(() => {});
        delete firstUnreadTime[pendingReadId];
        pendingReadId = null;
    }
}

export function renderSidebar() {
    if (!users.length) return;

    const now = Date.now();

    const getLastSeenMs = (u: any): number => {
        const raw = u.lastSeen || u.lastWorship || null;
        if (!raw) return 0;
        const t = new Date(raw).getTime();
        return isNaN(t) ? 0 : t;
    };

    const isUserOnline = (u: any) => {
        if (!u) return false;
        // Presence channel tracks by email (member_id); memberId is UUID - use email for presence check
        if (isMemberOnline(u.member_id || u.email || '')) return true;
        const ls = getLastSeenMs(u);
        return ls > 0 && (now - ls) / 60000 < 5;
    };

    // ── Update tracking state ────────────────────────────────────────────
    users.forEach(u => {
        const online = isUserOnline(u);
        const wasOnline = prevOnlineState[u.memberId] ?? false;
        const hasMsg = hasUnreadMessage(u);
        const msgTime = u.lastMessageTime ? new Date(u.lastMessageTime).getTime() : 0;

        // Track first unread time - set only once per streak
        if (hasMsg && msgTime > 0 && !firstUnreadTime[u.memberId]) {
            firstUnreadTime[u.memberId] = msgTime;
        }
        // Clear only if no longer unread AND not the pending-read user (still being viewed)
        if (!hasMsg && u.memberId !== pendingReadId) {
            delete firstUnreadTime[u.memberId];
        }

        // ── Online join time: only update on actual offline→online transition ──
        // This prevents jitter at the 5-min boundary from moving users around
        if (online && !wasOnline) {
            // Genuine transition: came online now
            onlineJoinTime[u.memberId] = now;
        }
        if (!online) {
            delete onlineJoinTime[u.memberId];
        }
        // Record current state for next render comparison
        prevOnlineState[u.memberId] = online;

        // Sound notification
        const lastSoundLS = Number(localStorage.getItem('sound_' + u.memberId) || 0);
        const lastSoundRAM = soundMemory[u.memberId] || 0;
        const lastSound = Math.max(lastSoundLS, lastSoundRAM);
        if (hasUnreadMessageCurrentUser(u) && msgTime > lastSound) {
            soundMemory[u.memberId] = msgTime;
            localStorage.setItem('sound_' + u.memberId, msgTime.toString());
            triggerSound('sfx-notify');
        }
    });

    // ── Sort into 3 groups ───────────────────────────────────────────────
    // For GROUP membership: pendingReadId stays in unread group while being viewed
    const hasUnreadForSort = (u: any) =>
        u.memberId === pendingReadId ? true : hasUnreadMessage(u);

    // Group 1: has unread - FIFO queue: earliest message = top
    const withUnread = users
        .filter(u => hasUnreadForSort(u))
        .sort((a, b) => (firstUnreadTime[a.memberId] || 0) - (firstUnreadTime[b.memberId] || 0));

    const withUnreadIds = new Set(withUnread.map(u => u.memberId));

    // Group 2: online, no unread - stable by first time seen online
    const onlineNoUnread = users
        .filter(u => isUserOnline(u) && !withUnreadIds.has(u.memberId))
        .sort((a, b) => (onlineJoinTime[a.memberId] || now) - (onlineJoinTime[b.memberId] || now));

    // Group 3: offline, no unread - most recently seen first
    const offlineNoUnread = users
        .filter(u => !isUserOnline(u) && !withUnreadIds.has(u.memberId))
        .sort((a, b) => getLastSeenMs(b) - getLastSeenMs(a));

    const sorted = [...withUnread, ...onlineNoUnread, ...offlineNoUnread];

    // ── FLIP: record positions before re-render ──────────────────────────
    const list = document.getElementById('userList');
    if (!list) return;
    const beforeRects: Record<string, DOMRect> = {};
    list.querySelectorAll<HTMLElement>('.u-item[data-id]').forEach(el => {
        beforeRects[el.dataset.id!] = el.getBoundingClientRect();
    });

    let html = '';
    sorted.forEach(u => {
        if (!u) return;

        const isActive = currId === u.memberId;
        const isQueen = u.hierarchy === "Queen";
        // Visual dot: only show if actually unread (not for the currently open pending user)
        const hasMsg = hasUnreadMessage(u);
        const online = isUserOnline(u);

        const ls = getLastSeenMs(u);
        let statusText = "OFFLINE";

        if (online) {
            statusText = "ONLINE";
        } else if (ls > 0) {
            const diffMins = Math.floor((now - ls) / 60000);
            const diffHours = Math.floor(diffMins / 60);

            if (diffMins < 60) {
                statusText = `${Math.max(1, diffMins)} MIN AGO`;
            } else if (diffHours < 24) {
                statusText = `${diffHours} HR${diffHours > 1 ? 'S' : ''} AGO`;
            } else if (diffHours < 48) {
                statusText = "YESTERDAY";
            } else {
                statusText = new Date(ls).toLocaleDateString([], { month: 'short', day: 'numeric' });
            }
        }

        const defaultPic = "/collar-placeholder.png";
        let rawPic = u.avatar || u.profilePicture || defaultPic;
        if (rawPic === "null" || rawPic === "undefined" || !rawPic) rawPic = defaultPic;
        const finalPic = getOptimizedUrl(rawPic, 80) || defaultPic;

        const isSilenced = u.silence === true;
        const isPaywalled = !!(u.parameters?.paywall?.active) || u.paywall === true;
        const isLocked = isSilenced || isPaywalled;
        const lockColor = isSilenced ? 'rgba(220,60,60,0.85)' : 'rgba(197,160,89,0.85)';
        const lockBg = isSilenced ? 'rgba(220,60,60,0.08)' : 'rgba(197,160,89,0.07)';
        const lockBorder = isSilenced ? 'rgba(220,60,60,0.4)' : 'rgba(197,160,89,0.4)';
        const lockLabel = isSilenced ? 'SILENCED' : 'PAYWALLED';
        const lockPath = "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z";

        if (isLocked) {
            html += `
                <div class="u-item ${isActive ? 'active' : ''}" data-id="${u.memberId}" onclick="window.selUser('${u.memberId}')" style="cursor:pointer;position:relative;overflow:hidden;background:${lockBg};border:1px solid ${lockBorder};justify-content:center;align-items:center;flex-direction:column;gap:4px;min-height:68px;padding:10px 15px;">
                    <img src="${finalPic}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.07;filter:blur(2px);pointer-events:none;" onerror="this.onerror=null;this.src='${defaultPic}'">
                    <svg viewBox="0 0 24 24" style="width:28px;height:28px;fill:${lockColor};position:relative;z-index:1;flex-shrink:0;"><path d="${lockPath}"/></svg>
                    <div style="font-family:Orbitron,sans-serif;font-size:0.42rem;color:${lockColor};letter-spacing:3px;position:relative;z-index:1;">${lockLabel}</div>
                    <div style="font-family:Orbitron,sans-serif;font-size:0.62rem;color:rgba(255,255,255,0.55);letter-spacing:1px;position:relative;z-index:1;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${clean(u.name)}</div>
                </div>
            `;
        } else {
            const mailPath = "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z";
            const timerPath = "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z";
            const starPath = "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z";
            const hasActiveTask = u.activeTask && (!u.endTime || u.endTime > Date.now());
            const hasPendingReview = u.reviewQueue && u.reviewQueue.length > 0;

            html += `
                <div class="u-item ${isActive ? 'active' : ''} ${isQueen ? 'queen-item' : ''} ${hasMsg ? 'has-msg' : ''}" data-id="${u.memberId}" onclick="window.selUser('${u.memberId}')" style="cursor:pointer;position:relative;overflow:hidden;flex-direction:column;align-items:flex-start;gap:5px;padding:10px 14px;min-height:68px;">
                    <img src="${finalPic}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.08;filter:blur(2px);pointer-events:none;" onerror="this.onerror=null;this.src='${defaultPic}'">
                    ${online ? '<div class="online-dot" style="position:absolute;top:8px;right:8px;z-index:2;"></div>' : ''}
                    <div style="display:flex;gap:6px;position:relative;z-index:1;">
                        <div class="icon-box" title="${hasMsg ? 'New Message' : 'Message'}"><svg class="svg-icon ${hasMsg ? 'active-msg' : 'icon-dim'}" viewBox="0 0 24 24"><path d="${mailPath}"/></svg></div>
                        <div class="icon-box" title="${hasActiveTask ? 'Active Task' : 'Timer'}"><svg class="svg-icon ${hasActiveTask ? 'active-grey' : 'icon-dim'}" viewBox="0 0 24 24"><path d="${timerPath}"/></svg></div>
                        <div class="icon-box" title="${hasPendingReview ? 'Pending Review' : 'Review'}"><svg class="svg-icon ${hasPendingReview ? 'active-pink' : 'icon-dim'}" viewBox="0 0 24 24"><path d="${starPath}"/></svg></div>
                    </div>
                    <div class="u-name" style="position:relative;z-index:1;">${clean(u.name)}</div>
                    <div class="u-seen ${online ? 'online' : ''}" style="position:relative;z-index:1;">${statusText}</div>
                </div>
            `;
        }
    });

    list.innerHTML = html;

    // ── FLIP: animate items from their old position to new ───────────────
    list.querySelectorAll<HTMLElement>('.u-item[data-id]').forEach(el => {
        const id = el.dataset.id!;
        const before = beforeRects[id];
        if (!before) return; // new item - fade in instead
        const after = el.getBoundingClientRect();
        const dy = before.top - after.top;
        if (Math.abs(dy) < 2) return; // didn't move, skip
        el.style.transition = 'none';
        el.style.transform = `translateY(${dy}px)`;
        requestAnimationFrame(() => {
            el.style.transition = 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
            el.style.transform = 'translateY(0)';
        });
    });
}

function renderUserIcons(u: any) {
    let html = '';
    const hasMsg = hasUnreadMessage(u);

    const mailPath = "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z";
    if (hasMsg) {
        html += `<div class="icon-box" title="New Message"><svg class="svg-icon active-msg" viewBox="0 0 24 24"><path d="${mailPath}"/></svg></div>`;
    } else {
        html += `<div class="icon-box"><svg class="svg-icon icon-dim" viewBox="0 0 24 24"><path d="${mailPath}"/></svg></div>`;
    }

    const timerPath = "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z";
    const hasActiveTask = u.activeTask && (!u.endTime || u.endTime > Date.now());
    if (hasActiveTask) {
        html += `<div class="icon-box" title="Active Task"><svg class="svg-icon active-grey" viewBox="0 0 24 24"><path d="${timerPath}"/></svg></div>`;
    } else {
        html += `<div class="icon-box"><svg class="svg-icon icon-dim" viewBox="0 0 24 24"><path d="${timerPath}"/></svg></div>`;
    }

    const starPath = "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z";
    if (u.reviewQueue && u.reviewQueue.length > 0) {
        html += `<div class="icon-box" title="Pending Review"><svg class="svg-icon active-pink" viewBox="0 0 24 24"><path d="${starPath}"/></svg></div>`;
    } else {
        html += `<div class="icon-box"><svg class="svg-icon icon-dim" viewBox="0 0 24 24"><path d="${starPath}"/></svg></div>`;
    }

    const lockPath = "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z";
    const isSilenced = u.silence === true;
    const isPaywalled = !!(u.parameters?.paywall?.active) || u.paywall === true;
    if (isSilenced) {
        html += `<div class="icon-box" title="Silenced"><svg class="svg-icon" viewBox="0 0 24 24" style="fill:rgba(220,60,60,0.85)"><path d="${lockPath}"/></svg></div>`;
    } else if (isPaywalled) {
        html += `<div class="icon-box" title="Paywalled"><svg class="svg-icon" viewBox="0 0 24 24" style="fill:rgba(197,160,89,0.85)"><path d="${lockPath}"/></svg></div>`;
    } else {
        html += `<div class="icon-box"><svg class="svg-icon icon-dim" viewBox="0 0 24 24"><path d="${lockPath}"/></svg></div>`;
    }

    return html;
}

function hasUnreadMessage(u: any) {
    if (u.memberId === currId) return false;
    const readTime = localStorage.getItem('read_' + u.memberId);
    if (!readTime) return u.lastMessageTime > 0;
    return u.lastMessageTime > parseInt(readTime);
}

function hasUnreadMessageCurrentUser(u: any) {
    const readTime = localStorage.getItem('read_' + u.memberId);
    if (!readTime) return u.lastMessageTime > 0;
    return u.lastMessageTime > parseInt(readTime);
}

export function selUser(id: string) {
    if (id === currId) return;

    // Close any React overlay panels (GLOBAL / CHALLENGES) so the user view is visible
    (window as any)._closeOverlays?.();

    // ── Mark the PREVIOUS user as read (deferred - only now that we're leaving them) ──
    markPendingRead();

    // If the user we're opening has unread messages, defer their read mark
    const u = users.find(x => x.memberId === id);
    if (u) {
        const readTime = localStorage.getItem('read_' + id);
        const hasUnread = readTime
            ? (u.lastMessageTime || 0) > parseInt(readTime)
            : (u.lastMessageTime || 0) > 0;
        if (hasUnread) {
            pendingReadId = id;
        }
    }
    // NOTE: do NOT write localStorage.read here - deferred until we leave this user

    const chatBox = document.getElementById('adminChatBox');
    if (chatBox) chatBox.innerHTML = "";

    setCurrId(id);

    // Just swap the active highlight - no re-render, no reorder
    document.querySelectorAll('#userList .u-item').forEach(el => el.classList.remove('active'));
    const target = document.querySelector(`#userList .u-item[data-id="${id}"]`);
    if (target) target.classList.add('active');

    // Remove the visual mail dot (they're reading it now) but DON'T change sort position
    if (target) target.classList.remove('has-msg');

    const vHome = document.getElementById('viewHome');
    if (vHome) vHome.style.display = 'none';
    const vProfile = document.getElementById('viewProfile');
    if (vProfile) vProfile.style.display = 'none';
    const vUser = document.getElementById('viewUser');
    if (vUser) { vUser.style.display = 'flex'; vUser.classList.add('active'); }

    // Trigger update for user detail and chat
    Promise.all([
        import('./dashboard-users'),
        import('./dashboard-chat')
    ]).then(([{ updateDetail }, { initDashboardChat }]) => {
        const openUser = users.find(x => x.memberId === id);
        if (openUser) updateDetail(openUser);
        initDashboardChat(id);
    });
}

if (typeof window !== 'undefined') {
    (window as any).selUser = selUser;
}
