// Dashboard Operations Monitor
// Operations grid, monitoring cards, and feed management

import { users, globalQueue, globalTributes } from './dashboard-state.js';
import { getOptimizedUrl, clean, formatTimer } from './dashboard-utils.js';

export function renderOperationsMonitor() {
    renderOperationsGrid();
    renderFeedLog();
}

function renderOperationsGrid() {
    const opsList = document.getElementById('opsList');
    if (!opsList) return;
    
    // Get active users (those with active tasks or pending reviews)
    const activeUsers = users.filter(u => 
        (u.activeTask && u.endTime && u.endTime > Date.now()) || 
        (u.reviewQueue && u.reviewQueue.length > 0)
    );
    
    if (activeUsers.length === 0) {
        opsList.innerHTML = `
            <div class="ops-grid">
                <div style="grid-column: 1/-1; text-align: center; color: #666; padding: 40px; font-family: 'Rajdhani'; font-size: 0.9rem;">
                    NO ACTIVE OPERATIONS
                </div>
            </div>
        `;
        return;
    }
    
    let html = '<div class="ops-grid">';
    
    activeUsers.forEach(u => {
        const hasActiveTask = u.activeTask && u.endTime && u.endTime > Date.now();
        const hasPendingReview = u.reviewQueue && u.reviewQueue.length > 0;
        
        const cardClass = hasPendingReview ? 'red' : 'blue';
        const badgeClass = hasPendingReview ? 'badge-r' : 'badge-b';
        const badgeText = hasPendingReview ? 'REVIEW' : 'ACTIVE';
        
        let detail = '';
        let timer = '';
        
        if (hasPendingReview) {
            detail = `${u.reviewQueue.length} pending`;
        } else if (hasActiveTask) {
            detail = clean(u.activeTask.text).substring(0, 30);
            const timeLeft = u.endTime - Date.now();
            timer = formatTimer(timeLeft);
        }
        
        html += `
            <div class="mon-card ${cardClass}" onclick="selectUserFromOps('${u.memberId}')">
                <div class="mon-badge ${badgeClass}">${badgeText}</div>
                <div class="mon-av-box">
                    <img src="${getOptimizedUrl(u.avatar, 100)}" class="mon-av" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiMzMzMiLz4KPHN2ZyB4PSI4IiB5PSI4IiB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzY2NiI+CjxwYXRoIGQ9Ik0xMiAyQzEzLjEgMiAxNCAyLjkgMTQgNEMxNCA1LjEgMTMuMSA2IDEyIDZDMTAuOSA2IDEwIDUuMSAxMCA0QzEwIDIuOSAxMC45IDIgMTIgMlpNMjEgOVYyMkgxNVYxNkgxM1YyMkg3VjlDNyA4LjQ1IDcuNDUgOCA4IDhIMTZDMTYuNTUgOCAxNyA4LjQ1IDE3IDlWMTBIMTlWOUgyMVoiLz4KPC9zdmc+Cjwvc3ZnPgo='">
                </div>
                <div class="mon-name">${clean(u.name)}</div>
                <div class="mon-detail">${detail}</div>
                ${timer ? `<div class="mon-timer">${timer}</div>` : ''}
            </div>
        `;
    });
    
    html += '</div>';
    opsList.innerHTML = html;
}

function renderFeedLog() {
    const feedLog = document.getElementById('feedLog');
    if (!feedLog) return;
    
    // Combine tributes and other activities
    let feedItems = [];
    
    // Add tributes
    globalTributes.slice(0, 10).forEach(tribute => {
        feedItems.push({
            type: 'tribute',
            data: tribute,
            timestamp: new Date(tribute.date).getTime()
        });
    });
    
    // Add recent completions from global queue (approved items)
    const recentCompletions = globalQueue
        .filter(item => item.status === 'approve')
        .slice(0, 5);
    
    recentCompletions.forEach(completion => {
        feedItems.push({
            type: 'completion',
            data: completion,
            timestamp: Date.now() - Math.random() * 3600000 // Random time within last hour
        });
    });
    
    // Sort by timestamp (newest first)
    feedItems.sort((a, b) => b.timestamp - a.timestamp);
    
    let html = '';
    
    feedItems.slice(0, 15).forEach(item => {
        if (item.type === 'tribute') {
            html += renderTributeFeedCard(item.data);
        } else if (item.type === 'completion') {
            html += renderCompletionFeedCard(item.data);
        }
    });
    
    if (html === '') {
        html = `
            <div style="text-align: center; color: #666; padding: 40px; font-family: 'Rajdhani'; font-size: 0.9rem;">
                NO RECENT ACTIVITY
            </div>
        `;
    }
    
    feedLog.innerHTML = html;
}

function renderTributeFeedCard(tribute) {
    const timeStr = new Date(tribute.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    return `
        <div class="feed-trib-card">
            <img src="${getOptimizedUrl(tribute.memberAvatar || tribute.avatar, 72)}" class="ft-avatar" onerror="this.style.display='none'">
            <div class="ft-content">
                <div class="ft-top">
                    <span>${clean(tribute.memberName || 'Unknown')}</span>
                    <span>${timeStr}</span>
                </div>
                <div class="ft-main">${tribute.amount || 0} 🪙</div>
                <div class="ft-sub">${clean(tribute.reason || 'Tribute sent')}</div>
            </div>
        </div>
    `;
}

function renderCompletionFeedCard(completion) {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    return `
        <div class="feed-buy-card">
            <img src="${getOptimizedUrl(completion.avatar, 72)}" class="ft-avatar" onerror="this.style.display='none'">
            <div class="ft-content">
                <div class="ft-top">
                    <span>${clean(completion.userName || 'User')}</span>
                    <span>${timeStr}</span>
                </div>
                <div class="fb-main">TASK COMPLETED</div>
                <div class="ft-sub">${clean(completion.text || 'Task completed successfully')}</div>
            </div>
        </div>
    `;
}

function selectUserFromOps(memberId) {
    // Import and call the selUser function from sidebar
    import('./dashboard-sidebar.js').then(({ selUser }) => {
        selUser(memberId);
    });
}

// Make functions available globally
window.selectUserFromOps = selectUserFromOps;
