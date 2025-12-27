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

    // --- 1. THE DUPLICATE KILLER (SANITIZE) ---
    const allDbIds = users.map(u => u.memberId);
    
    // Force the visual order to be unique and only include real users
    currentVisualOrder = [...new Set(currentVisualOrder)].filter(id => allDbIds.includes(id));

    // Add any missing users from the database to the end
    allDbIds.forEach(id => {
        if (!currentVisualOrder.includes(id)) currentVisualOrder.push(id);
    });

    const now = Date.now();

    // Helper: Online Check (5 min window)
    const isUserOnline = (u) => {
        if (!u || !u.lastSeen) return false;
        const ls = new Date(u.lastSeen).getTime();
        return (now - ls) / 60000 < 5; 
    };

    // --- 2. APPLY HIERARCHY MOVEMENT RULES ---
    users.forEach(u => {
        const isOnline = isUserOnline(u);
        const wasOnline = previousOnlineStates[u.memberId];
        const hasMsg = hasUnreadMessage(u);

        // A. TELEPORT: New Message (Absolute #1 Spot)
        if (hasMsg) {
            currentVisualOrder = currentVisualOrder.filter(id => id !== u.memberId);
            currentVisualOrder.unshift(u.memberId);
        }

        // B. ENTRANCE: Just logged on (Join BACK of Online group)
        else if (isOnline && (wasOnline === false || wasOnline === undefined)) {
            currentVisualOrder = currentVisualOrder.filter(id => id !== u.memberId);
            const lastOnlineIdx = currentVisualOrder.findLastIndex(id => {
                const usr = users.find(x => x.memberId === id);
                return isUserOnline(usr);
            });
            currentVisualOrder.splice(lastOnlineIdx + 1, 0, u.memberId);
        }

        // C. FALLING: Just logged off (Handled by the Sort in Step 3)
        
        // Update memory for next refresh
        previousOnlineStates[u.memberId] = isOnline;
    });

    // --- 3. SEPARATE ZONES & SORT OFFLINE BY TIME ---
    let onlineIds = currentVisualOrder.filter(id => isUserOnline(users.find(x => x.memberId === id)));
    let offlineIds = currentVisualOrder.filter(id => !onlineIds.includes(id));

    // Sort ONLY the offline IDs by their REAL lastSeen time
    const offlineData = offlineIds.map(id => users.find(x => x.memberId === id)).filter(u => u);
    offlineData.sort((a, b) => {
        const tA = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
        const tB = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
        return tB - tA; // Newest at top of offline
    });

    // Re-lock the visual order
    currentVisualOrder = [...onlineIds, ...offlineData.map(u => u.memberId)];

    // --- 4. RENDER HTML ---
    let html = '';
    currentVisualOrder.forEach(id => {
        const u = users.find(x => x.memberId === id);
        if (!u) return;

        const isActive = currId === u.memberId;
        const isQueen = u.hierarchy === "Queen";
        const hasMsg = hasUnreadMessage(u);
        const online = isUserOnline(u);
        
        const ls = u.lastSeen ? new Date(u.lastSeen).getTime() : 0;
        const diff = ls > 0 ? Math.floor((now - ls) / 60000) : 999;
        
        let statusText = "OFFLINE";
        if (online) statusText = "ONLINE";
        else if (ls > 0 && diff < 60) statusText = `${diff} MIN AGO`;
        else if (ls > 0) statusText = new Date(ls).toLocaleDateString([], {month:'short', day:'numeric'});

        html += `
            <div class="u-item ${isActive ? 'active' : ''} ${isQueen ? 'queen-item' : ''} ${hasMsg ? 'has-msg' : ''}" onclick="selUser('${u.memberId}')">
                <div class="u-avatar-main">
                    ${u.avatar ? `<img src="${getOptimizedUrl(u.avatar, 100)}" alt="${u.name}">` : ''}
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
    // 1. If I am currently viewing this person, the icon must be grey
    if (u.memberId === currId) return false;

    // 2. Otherwise, check the last message time against the last click time
    const readTime = localStorage.getItem('read_' + u.memberId);
    if (!readTime) return u.lastMessageTime > 0;
    
    // If the message is newer than the last time I clicked the user, light it up
    return u.lastMessageTime > parseInt(readTime);
}

export function selUser(id) {
    if (id === currId) return; 
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
