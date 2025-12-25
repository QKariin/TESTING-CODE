// Dashboard Sidebar Management
// User list rendering and sidebar interactions

import { users, currId, setCurrId } from './dashboard-state.js';
import { getOptimizedUrl, clean } from './dashboard-utils.js';

export function renderSidebar() {
    const list = document.getElementById('userList');
    if (!list) return;

    // Sort users: Queen first, then by last message time
    const sortedUsers = [...users].sort((a, b) => {
        if (a.hierarchy === "Queen" && b.hierarchy !== "Queen") return -1;
        if (b.hierarchy === "Queen" && a.hierarchy !== "Queen") return 1;
        return (b.lastMessageTime || 0) - (a.lastMessageTime || 0);
    });

    let html = '';
    sortedUsers.forEach(u => {
        const isActive = currId === u.memberId;
        const isQueen = u.hierarchy === "Queen";
        const hasMsg = hasUnreadMessage(u);
        
        const now = Date.now();
        const ls = u.lastSeen ? new Date(u.lastSeen).getTime() : 0;
        let diff = 999999;
        if (ls > 0) diff = Math.floor((now - ls) / 60000);
        
        let status = "OFFLINE";
        let isOnline = false;
        if (ls > 0 && !isNaN(diff)) {
            if (diff < 2) { status = "ONLINE"; isOnline = true; }
            else if (diff < 60) { status = diff + " MIN AGO"; }
        }

        const activeClass = isActive ? 'active' : '';
        const queenClass = isQueen ? 'queen-item' : '';
        const msgClass = hasMsg ? 'has-msg' : '';
        const onlineClass = isOnline ? 'online' : '';

        html += `
            <div class="u-item ${activeClass} ${queenClass} ${msgClass}" onclick="selUser('${u.memberId}')">
                <div class="u-avatar-main">
                    ${u.avatar ? `<img src="${getOptimizedUrl(u.avatar, 100)}" alt="${u.name}">` : ''}
                    <div class="notif-dot"></div>
                </div>
                <div class="u-info">
                    <div class="u-name">${clean(u.name)}</div>
                    <div class="u-seen ${onlineClass}">${status}</div>
                    <div class="u-name-mob" style="display:none;">${clean(u.name).substring(0, 8)}</div>
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
    
    // Active task icon
    if (u.activeTask && u.endTime && u.endTime > Date.now()) {
        html += `<div class="icon-box"><svg class="svg-icon active-icon" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></div>`;
    } else {
        html += `<div class="icon-box"><svg class="svg-icon icon-dim" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></div>`;
    }
    
    // Review queue icon
    if (u.reviewQueue && u.reviewQueue.length > 0) {
        html += `<div class="icon-box"><svg class="svg-icon active-icon" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>`;
    } else {
        html += `<div class="icon-box"><svg class="svg-icon icon-dim" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>`;
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
