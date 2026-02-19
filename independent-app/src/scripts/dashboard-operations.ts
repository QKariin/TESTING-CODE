// src/scripts/dashboard-operations.ts
// Dashboard Operations Monitor - Converted to TypeScript

import { users, globalQueue, globalTributes } from './dashboard-state';
import { clean, formatTimer } from './utils';

export function renderOperationsMonitor() {
    renderOperationsGrid();
    renderFeedLog();
}

function renderOperationsGrid() {
    const opsList = document.getElementById('opsList');
    if (!opsList) return;

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

        const finalPic = u.avatar || u.profilePicture || 'https://static.wixstatic.com/media/ce3e5b_78da97e06a3848df84d0b00c9e6dcfdd~mv2.png';

        html += `
            <div class="mon-card ${cardClass}" onclick="window.selectUserFromOps('${u.memberId}')">
                <div class="mon-badge ${badgeClass}">${badgeText}</div>
                <div class="mon-av-box">
                    <img src="${finalPic}" class="mon-av">
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

    let feedItems: any[] = [];

    globalTributes.slice(0, 10).forEach((tribute: any) => {
        feedItems.push({
            type: 'tribute',
            data: tribute,
            timestamp: new Date(tribute.date).getTime()
        });
    });

    const recentCompletions = globalQueue
        .filter((item: any) => item.status === 'approve')
        .slice(0, 5);

    recentCompletions.forEach((completion: any) => {
        feedItems.push({
            type: 'completion',
            data: completion,
            timestamp: Date.now() - Math.random() * 3600000
        });
    });

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

function renderTributeFeedCard(tribute: any) {
    const timeStr = new Date(tribute.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const u = users.find(x => x.memberId === tribute.memberId);
    const finalPic = tribute.memberAvatar || tribute.avatar || tribute.profilePicture || u?.avatar || u?.profilePicture || '';

    return `
        <div class="feed-trib-card">
            <img src="${finalPic}" class="ft-avatar">
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

function renderCompletionFeedCard(completion: any) {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const u = users.find(x => x.memberId === completion.memberId);
    const finalPic = completion.avatar || completion.profilePicture || u?.avatar || u?.profilePicture || '';

    return `
        <div class="feed-buy-card">
            <img src="${finalPic}" class="ft-avatar">
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

export function selectUserFromOps(memberId: string) {
    import('./dashboard-sidebar').then(({ selUser }) => {
        selUser(memberId);
    });
}

if (typeof window !== 'undefined') {
    (window as any).selectUserFromOps = selectUserFromOps;
}
