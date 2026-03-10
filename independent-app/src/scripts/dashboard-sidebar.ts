// src/scripts/dashboard-sidebar.ts
// Dashboard Sidebar Management - Converted to TypeScript

import { users, currId, setCurrId } from './dashboard-state';
import { clean } from './utils';
import { triggerSound } from './utils';
import { getOptimizedUrl } from './media';

let currentVisualOrder: string[] = [];
let previousOnlineStates: { [key: string]: boolean } = {};
const soundMemory: { [key: string]: number } = {};

export function renderSidebar() {
    const list = document.getElementById('userList');
    if (!list || !users.length) return;

    const allDbIds = users.map(u => u.memberId);

    // Force the visual order to be unique and only include real users
    currentVisualOrder = [...new Set(currentVisualOrder)].filter(id => allDbIds.includes(id));

    // Add any missing users from the database to the end
    allDbIds.forEach(id => {
        if (!currentVisualOrder.includes(id)) currentVisualOrder.push(id);
    });

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
        if (!ls) return false;
        return (now - ls) / 60000 < 5;
    };

    users.forEach(u => {
        const isOnline = isUserOnline(u);
        const wasOnline = previousOnlineStates[u.memberId];
        const hasMsg = hasUnreadMessage(u);

        if (hasMsg) {
            currentVisualOrder = currentVisualOrder.filter(id => id !== u.memberId);
            currentVisualOrder.unshift(u.memberId);
        }

        const msgTime = u.lastMessageTime ? new Date(u.lastMessageTime).getTime() : 0;
        const lastSoundLS = Number(localStorage.getItem('sound_' + u.memberId) || 0);
        const lastSoundRAM = soundMemory[u.memberId] || 0;
        const hasMsgCurrent = hasUnreadMessageCurrentUser(u);

        const lastSound = Math.max(lastSoundLS, lastSoundRAM);
        const isNewMessage = hasMsgCurrent && msgTime > lastSound;

        if (isNewMessage) {
            soundMemory[u.memberId] = msgTime;
            localStorage.setItem('sound_' + u.memberId, msgTime.toString());
            triggerSound('sfx-notify');
        }

        else if (isOnline && (wasOnline === false || wasOnline === undefined)) {
            currentVisualOrder = currentVisualOrder.filter(id => id !== u.memberId);
            const lastOnlineIdx = currentVisualOrder.findLastIndex(id => {
                const usr = users.find(x => x.memberId === id);
                return isUserOnline(usr);
            });
            currentVisualOrder.splice(lastOnlineIdx + 1, 0, u.memberId);
        }

        previousOnlineStates[u.memberId] = isOnline;
    });

    let onlineIds = currentVisualOrder.filter(id => isUserOnline(users.find(x => x.memberId === id)));
    let offlineIds = currentVisualOrder.filter(id => !onlineIds.includes(id));

    const offlineData = offlineIds.map(id => users.find(x => x.memberId === id)).filter(u => u);
    offlineData.sort((a, b) => getLastSeenMs(b) - getLastSeenMs(a));

    currentVisualOrder = [...onlineIds, ...offlineData.map(u => u.memberId)];

    let html = '';
    currentVisualOrder.forEach(id => {
        const u = users.find(x => x.memberId === id);
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

    // In standalone app, we don't need postMessage to select user
    // We'll update the state directly or call an internal handler

    localStorage.setItem('read_' + id, Date.now().toString());
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
