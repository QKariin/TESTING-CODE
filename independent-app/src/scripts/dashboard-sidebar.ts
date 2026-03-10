// src/scripts/dashboard-sidebar.ts
// Dashboard Sidebar Management - Converted to TypeScript

import { users, currId, setCurrId } from './dashboard-state';
import { clean } from './utils';
import { triggerSound } from './utils';
import { getOptimizedUrl } from './media';

// firstUnreadTime: when each user's FIRST unread message arrived (cleared on open)
const firstUnreadTime: Record<string, number> = {};
// onlineJoinTime: when each user first came online this session (stable)
const onlineJoinTime: Record<string, number> = {};
const soundMemory: { [key: string]: number } = {};

export function renderSidebar() {
    const list = document.getElementById('userList');
    if (!list || !users.length) return;

    const now = Date.now();

    const getLastSeenMs = (u: any): number => {
        const raw = u.lastSeen || u.lastWorship || null;
        if (!raw) return 0;
        const t = new Date(raw).getTime();
        return isNaN(t) ? 0 : t;
    };

    const isUserOnline = (u: any) => {
        if (!u) return false;
        const ls = getLastSeenMs(u);
        return ls > 0 && (now - ls) / 60000 < 5;
    };

    // ── Update tracking state ────────────────────────────────────────────
    users.forEach(u => {
        const online = isUserOnline(u);
        const hasMsg = hasUnreadMessage(u);
        const msgTime = u.lastMessageTime ? new Date(u.lastMessageTime).getTime() : 0;

        // Track first unread time — set only once per unread streak, never overwrite
        if (hasMsg && msgTime > 0 && !firstUnreadTime[u.memberId]) {
            firstUnreadTime[u.memberId] = msgTime;
        }
        // Clear if no longer has unread (was read)
        if (!hasMsg) {
            delete firstUnreadTime[u.memberId];
        }

        // Track online join time — set when first seen online, cleared when offline
        if (online && !onlineJoinTime[u.memberId]) {
            onlineJoinTime[u.memberId] = now;
        }
        if (!online) {
            delete onlineJoinTime[u.memberId];
        }

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
    // Group 1: has unread — FIFO queue: first message received = TOP
    const withUnread = users
        .filter(u => hasUnreadMessage(u))
        .sort((a, b) => (firstUnreadTime[a.memberId] || 0) - (firstUnreadTime[b.memberId] || 0));

    const withUnreadIds = new Set(withUnread.map(u => u.memberId));

    // Group 2: online, no unread — stable order by when they came online (first = top)
    const onlineNoUnread = users
        .filter(u => isUserOnline(u) && !withUnreadIds.has(u.memberId))
        .sort((a, b) => (onlineJoinTime[a.memberId] || now) - (onlineJoinTime[b.memberId] || now));

    // Group 3: offline, no unread — most recently seen first
    const offlineNoUnread = users
        .filter(u => !isUserOnline(u) && !withUnreadIds.has(u.memberId))
        .sort((a, b) => getLastSeenMs(b) - getLastSeenMs(a));

    const sorted = [...withUnread, ...onlineNoUnread, ...offlineNoUnread];

    let html = '';
    sorted.forEach(u => {
        if (!u) return;

        const isActive = currId === u.memberId;
        const isQueen = u.hierarchy === "Queen";
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

        const defaultPic = "https://static.wixstatic.com/media/ce3e5b_78da97e06a3848df84d0b00c9e6dcfdd~mv2.png";
        let rawPic = u.avatar || u.profilePicture || defaultPic;
        if (rawPic === "null" || rawPic === "undefined" || !rawPic) rawPic = defaultPic;
        const finalPic = getOptimizedUrl(rawPic, 80) || defaultPic;

        html += `
            <div class="u-item ${isActive ? 'active' : ''} ${isQueen ? 'queen-item' : ''} ${hasMsg ? 'has-msg' : ''}" onclick="window.selUser('${u.memberId}')" style="cursor: pointer;">
                <div class="u-avatar-main">
                    <img src="${finalPic}" alt="${clean(u.name)}" onerror="this.onerror=null;this.src='${defaultPic}'">
                    <div class="notif-dot"></div>
                    ${online ? '<div class="online-dot"></div>' : ''}
                </div>
                <div class="u-info">
                    <div class="u-name">${clean(u.name)}</div>
                    <div class="u-seen ${online ? 'online' : ''}">${statusText}</div>
                </div>
                <div class="u-right-col">
                    ${renderUserIcons(u)}
                </div>
            </div>
        `;
    });

    list.innerHTML = html;
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

    localStorage.setItem('read_' + id, Date.now().toString());
    // Clear unread queue position so they return to stable online order
    delete firstUnreadTime[id];
    const chatBox = document.getElementById('adminChatBox');
    if (chatBox) chatBox.innerHTML = "";

    setCurrId(id);

    // Update UI visibility (using domestic message bus or direct DOM)
    const vHome = document.getElementById('viewHome');
    if (vHome) vHome.style.display = 'none';

    const vProfile = document.getElementById('viewProfile');
    if (vProfile) vProfile.style.display = 'none';

    const vUser = document.getElementById('viewUser');
    if (vUser) {
        vUser.style.display = 'flex';
        vUser.classList.add('active');
    }

    renderSidebar();

    // Trigger update for user detail and chat
    Promise.all([
        import('./dashboard-users'),
        import('./dashboard-chat')
    ]).then(([{ updateDetail }, { initDashboardChat }]) => {
        const u = users.find(x => x.memberId === id);
        if (u) updateDetail(u);
        initDashboardChat(id);
    });
}

if (typeof window !== 'undefined') {
    (window as any).selUser = selUser;
}
