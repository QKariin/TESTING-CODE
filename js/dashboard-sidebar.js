// Dashboard Sidebar Management
// User list rendering and sidebar interactions

import { users, currId, setCurrId } from './dashboard-state.js';
import { getOptimizedUrl, clean } from './dashboard-utils.js';

// --- ADD THESE TWO LINES AT THE TOP ---
let currentVisualOrder = []; 
let previousOnlineStates = {}; // <--- THIS WAS MISSING AND CAUSED THE CRASH

export function renderSidebar() {
    const list = document.getElementById('userList');
    if (!list || !users.length) return;

    // --- 1. SANITIZE & INITIALIZE ---
    const allDbIds = users.map(u => u.memberId);
    
    // Initial load: Capture starting order
    if (currentVisualOrder.length === 0) {
        currentVisualOrder = [...allDbIds];
    }

    // Remove people who left the DB and add new people who joined
    currentVisualOrder = currentVisualOrder.filter(id => allDbIds.includes(id));
    allDbIds.forEach(id => {
        if (!currentVisualOrder.includes(id)) currentVisualOrder.push(id);
    });

    const now = Date.now();

    // Helper to check online status (same math used in the icons)
    const checkOnline = (u) => {
        const ls = u?.lastSeen ? new Date(u.lastSeen).getTime() : 0;
        return ls > 0 && (now - ls) / 60000 < 2;
    };

    // --- 2. APPLY ELITE HIERARCHY RULES ---
    users.forEach(u => {
        const isOnline = checkOnline(u);
        const wasOnline = previousOnlineStates[u.memberId];
        const hasMsg = hasUnreadMessage(u);

        // RULE A: TELEPORT ON NEW MESSAGE (Absolute Top)
        if (hasMsg) {
            currentVisualOrder = currentVisualOrder.filter(id => id !== u.memberId);
            currentVisualOrder.unshift(u.memberId);
        }

        // RULE B: JOINING ONLINE (End of Online Group)
        else if (isOnline && wasOnline === false) {
            currentVisualOrder = currentVisualOrder.filter(id => id !== u.memberId);
            const lastOnlineIdx = currentVisualOrder.findLastIndex(id => {
                const usr = users.find(x => x.memberId === id);
                return checkOnline(usr);
            });
            currentVisualOrder.splice(lastOnlineIdx + 1, 0, u.memberId);
        }

        // RULE C: FALLING OFFLINE (Top of Offline Group)
        else if (!isOnline && wasOnline === true) {
            currentVisualOrder = currentVisualOrder.filter(id => id !== u.memberId);
            const firstOfflineIdx = currentVisualOrder.findIndex(id => {
                const usr = users.find(x => x.memberId === id);
                return !checkOnline(usr);
            });
            if (firstOfflineIdx === -1) currentVisualOrder.push(u.memberId);
            else currentVisualOrder.splice(firstOfflineIdx, 0, u.memberId);
        }

        // Update memory for next 4-second loop
        previousOnlineStates[u.memberId] = isOnline;
    });

    // --- 3. RENDER THE STABLE HTML ---
    let html = '';
    currentVisualOrder.forEach(id => {
        const u = users.find(x => x.memberId === id);
        if (!u) return;

        const isActive = currId === u.memberId;
        const isQueen = u.hierarchy === "Queen";
        const hasMsg = hasUnreadMessage(u);
        const isOnline = checkOnline(u);
        
        const ls = u.lastSeen ? new Date(u.lastSeen).getTime() : 0;
        const diff = ls > 0 ? Math.floor((now - ls) / 60000) : 999999;
        
        let status = "OFFLINE";
        if (isOnline) status = "ONLINE";
        else if (ls > 0 && diff < 60) status = diff + " MIN AGO";

        html += `
            <div class="u-item ${isActive ? 'active' : ''} ${isQueen ? 'queen-item' : ''} ${hasMsg ? 'has-msg' : ''}" onclick="selUser('${u.memberId}')">
                <div class="u-avatar-main">
                    ${u.avatar ? `<img src="${getOptimizedUrl(u.avatar, 100)}" alt="${u.name}">` : ''}
                </div>
                <div class="u-info">
                    <div class="u-name">${clean(u.name)}</div>
                    <div class="u-seen ${isOnline ? 'online' : ''}">${status}</div>
                </div>
                <div class="u-right-col">
                    ${renderUserIcons(u)}
                </div>
            </div>
        `;
    });

    list.innerHTML = html;
}

function renderUserIcons(u) {
    let html = '';
    const hasMsg = hasUnreadMessage(u);
    
    // 1. MAIL ICON (Message Status)
    const mailPath = "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z";
    if (hasMsg) {
        html += `<div class="icon-box" title="New Message"><svg class="svg-icon active-msg" viewBox="0 0 24 24"><path d="${mailPath}"/></svg></div>`;
    } else {
        html += `<div class="icon-box"><svg class="svg-icon icon-dim" viewBox="0 0 24 24"><path d="${mailPath}"/></svg></div>`;
    }

    // 2. TIMER ICON (Active Task - Blue)
    const timerPath = "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z";
    if (u.activeTask && u.endTime && u.endTime > Date.now()) {
        html += `<div class="icon-box" title="Active Task"><svg class="svg-icon active-blue" viewBox="0 0 24 24"><path d="${timerPath}"/></svg></div>`;
    } else {
        html += `<div class="icon-box"><svg class="svg-icon icon-dim" viewBox="0 0 24 24"><path d="${timerPath}"/></svg></div>`;
    }

    // 3. STAR ICON (Pending Review - Pink)
    const starPath = "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z";
    if (u.reviewQueue && u.reviewQueue.length > 0) {
        html += `<div class="icon-box" title="Pending Review"><svg class="svg-icon active-pink" viewBox="0 0 24 24"><path d="${starPath}"/></svg></div>`;
    } else {
        html += `<div class="icon-box"><svg class="svg-icon icon-dim" viewBox="0 0 24 24"><path d="${starPath}"/></svg></div>`;
    }

    return html;
}

function hasUnreadMessage(u) {
    const readTime = localStorage.getItem('read_' + u.memberId);
    if (!readTime) return u.lastMessageTime > 0;
    return u.lastMessageTime > parseInt(readTime);
}

export function selUser(id) {
    if (typeof window.parent !== 'undefined') {
        window.parent.postMessage({ type: "selectUser", memberId: id }, "*");
    }
    localStorage.setItem('read_' + id, Date.now().toString());
    document.getElementById('adminChatBox').innerHTML = "";
    setCurrId(id);
    
    // Hide other views and show user view
    document.getElementById('viewHome').style.display = 'none';
    document.getElementById('viewProfile').style.display = 'none';
    document.getElementById('viewUser').classList.add('active');
    
    // Mark as read
    localStorage.setItem('read_' + id, Date.now());
    renderSidebar();
    
    // Reset history limit and update user details
    import('./dashboard-state.js').then(({ setHistLimit }) => {
        setHistLimit(10);
    });
    
    const u = users.find(x => x.memberId === id);
    if (u) {
        import('./dashboard-users.js').then(({ updateDetail }) => {
            updateDetail(u);
        });
    }
}

// Make functions available globally
window.selUser = selUser;
