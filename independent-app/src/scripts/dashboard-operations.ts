// src/scripts/dashboard-operations.ts
// Dashboard Operations Monitor - Converted to TypeScript

import { users, globalQueue, globalTributes } from './dashboard-state';
import { clean, formatTimer } from './utils';
import { getOptimizedUrl } from './media';

export function renderOperationsMonitor() {
    renderOperationsGrid();
    renderFeedLog();
}

function renderOperationsGrid() {
    const opsList = document.getElementById('opsList');
    if (!opsList) return;

    let pendingTasks: any[] = [];
    let pendingRoutines: any[] = [];

    users.forEach(u => {
        if (u.reviewQueue) {
            u.reviewQueue.forEach((item: any) => {
                const enrichedItem = { ...item, memberId: u.memberId, memberName: u.name };
                if (item.isRoutine) {
                    pendingRoutines.push(enrichedItem);
                } else {
                    pendingTasks.push(enrichedItem);
                }
            });
        }
    });

    // Sort by Date to get the latest (newest first)
    const sortNewest = (a: any, b: any) => {
        const timeA = a.timestamp || new Date(a.date).getTime() || 0;
        const timeB = b.timestamp || new Date(b.date).getTime() || 0;
        return timeB - timeA;
    };
    pendingTasks.sort(sortNewest);
    pendingRoutines.sort(sortNewest);

    const latestTask = pendingTasks[0];
    const latestRoutine = pendingRoutines[0];

    const taskBg = latestTask ? getOptimizedUrl(latestTask.proofUrl, 400) : '';
    const routineBg = latestRoutine ? getOptimizedUrl(latestRoutine.proofUrl, 400) : '';

    const taskVideo = latestTask && (latestTask.proofUrl?.endsWith('.mp4') || latestTask.proofType?.includes('video'));
    const routineVideo = latestRoutine && (latestRoutine.proofUrl?.endsWith('.mp4') || latestRoutine.proofType?.includes('video'));

    let html = '<div class="ops-monitor-grid">';

    // 1. TASK CARD (GOLD)
    html += `
        <div class="ops-card task" onclick="window.showQueueFiltered(false)">
            ${taskBg ? (taskVideo ?
            `<video src="${taskBg}" class="ops-card-bg" autoplay muted loop playsinline></video>` :
            `<img src="${taskBg}" class="ops-card-bg">`) : ''}
            <div class="ops-card-overlay">
                <div class="ops-card-label">PENDING OPERATIONS</div>
                <div class="ops-card-title">TASK QUEUE</div>
                <div class="ops-counter gold">${pendingTasks.length}</div>
            </div>
        </div>
    `;

    // 2. ROUTINE CARD (SILVER)
    html += `
        <div class="ops-card routine" onclick="window.showQueueFiltered(true)">
            ${routineBg ? (routineVideo ?
            `<video src="${routineBg}" class="ops-card-bg" autoplay muted loop playsinline></video>` :
            `<img src="${routineBg}" class="ops-card-bg">`) : ''}
            <div class="ops-card-overlay">
                <div class="ops-card-label">DAILY PROTOCOLS</div>
                <div class="ops-card-title">ROUTINE QUEUE</div>
                <div class="ops-counter silver">${pendingRoutines.length}</div>
            </div>
        </div>
    `;

    html += '</div>';
    opsList.innerHTML = html;
}

export function showQueueFiltered(isRoutine: boolean) {
    if ((window as any).renderGlobalReview) {
        (window as any).renderGlobalReview(isRoutine);
    }
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
    const finalPic = getOptimizedUrl(tribute.memberAvatar || tribute.avatar || tribute.profilePicture || u?.avatar || u?.profilePicture || '', 80);

    return `
        <div class="feed-trib-card">
            <img src="${getOptimizedUrl(finalPic, 100)}" class="ft-avatar">
            <div class="ft-content">
                <div class="ft-top">
                    <span>${clean(tribute.memberName || 'Unknown')}</span>
                    <span>${timeStr}</span>
                </div>
                <div class="ft-main">${tribute.amount || 0} <i class="fas fa-coins" style="font-size:0.85rem; color:#c5a059;"></i></div>
                <div class="ft-sub">${clean(tribute.reason || 'Tribute sent')}</div>
            </div>
        </div>
    `;
}

function renderCompletionFeedCard(completion: any) {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const u = users.find(x => x.memberId === completion.memberId);
    const finalPic = getOptimizedUrl(completion.avatar || completion.profilePicture || u?.avatar || u?.profilePicture || '', 80);

    return `
        <div class="feed-buy-card">
            <img src="${getOptimizedUrl(finalPic, 100)}" class="ft-avatar">
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
    (window as any).showQueueFiltered = showQueueFiltered;
}
