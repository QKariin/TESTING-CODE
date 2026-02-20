// src/scripts/dashboard-main.ts
// FULL MASTER CONTROLLER - Converted to TypeScript

import {
    users, currId, globalQueue, globalTributes,
    setUsers, setGlobalQueue, setGlobalTributes, setAvailableDailyTasks,
    setQueenContent, setStickerConfig, setBroadcastPresets, setTimerInterval, timerInterval,
    setArmoryTarget, setCurrId
} from './dashboard-state';

import { renderSidebar } from './dashboard-sidebar';
import { renderOperationsMonitor } from './dashboard-operations';
import { renderChat } from './dashboard-chat';
import { updateDetail } from './dashboard-users';
import { toggleMobStats } from './dashboard-utils';
import { Bridge } from './bridge';
import { unlockAudio } from './utils';
import { processCoinTransaction, secureUpdateTaskAction } from '@/actions/velo-actions';

export function initDashboard() {
    // Audio Wake-Up Strategy
    document.addEventListener('click', () => {
        const sfx = document.getElementById('msgSound') as HTMLAudioElement;
        if (sfx) {
            sfx.play().then(() => {
                sfx.pause();
                sfx.currentTime = 0;
            }).catch(e => console.log("Audio blocked - click again."));
        }
        unlockAudio(); // Helper call
    }, { once: true });

    // Daily ID Calculation
    const today = new Date();
    const dayCode = ((110 - (today.getMonth() + 1)) * 100 + (82 - today.getDate())).toString().padStart(4, '0');
    const codeEl = document.getElementById('adminDailyCode');
    if (codeEl) codeEl.innerText = dayCode;

    // Start Systems
    startTimerLoop();
    renderMainDashboard();

    console.log('Dashboard initialized. ID:', dayCode);
}

// NAVIGATION: BACK TO DASHBOARD
export function showHome() {
    console.log("NAVIGATING TO HOME");
    setCurrId(null);

    const vUser = document.getElementById('viewUser');
    if (vUser) {
        vUser.style.display = 'none';
        vUser.classList.remove('active');
    }

    const vProfile = document.getElementById('viewProfile');
    if (vProfile) {
        vProfile.style.display = 'none';
        vProfile.classList.remove('active');
    }

    const vHome = document.getElementById('viewHome');
    if (vHome) {
        vHome.style.display = 'grid';
        vHome.classList.add('active');
    }

    renderMainDashboard();
}

export function renderMainDashboard() {
    renderSidebar();
    renderOperationsMonitor();
    updateStatsDeck();
}

function updateStatsDeck() {
    const totalTributes = document.getElementById('statTributes');
    const activeTasks = document.getElementById('statActive');
    const pending = document.getElementById('statPending');
    const skipped = document.getElementById('statSkipped');

    // Kneeling Counter Elements
    const tkMins = document.getElementById('totalKneelMins');
    const tkSessions = document.getElementById('totalKneelSessions');
    const akCount = document.getElementById('activeKneelers');

    // Stats Math
    if (totalTributes) totalTributes.innerHTML = `${globalTributes.length} <span class="vs-perc">+55%</span>`;
    if (activeTasks) activeTasks.innerHTML = `${users.filter(u => u.activeTask && u.endTime && u.endTime > Date.now()).length} <span class="vs-perc">+5%</span>`;
    if (pending) pending.innerHTML = `${globalQueue.length} <span class="vs-perc neg">-14%</span>`;
    if (skipped) skipped.innerHTML = `${users.reduce((sum, u) => sum + (u.strikeCount || 0), 0)} <span class="vs-perc">+8%</span>`;

    // Kneeling Math
    const totalMins = users.reduce((sum, u) => sum + (u.kneelHistory?.totalMinutes || 0), 0);
    const totalSess = users.reduce((sum, u) => sum + (u.kneelCount || 0), 0);
    const activeK = users.filter(u => u.status === 'Kneeling').length;

    if (tkMins) tkMins.innerText = totalMins.toLocaleString();
    if (tkSessions) tkSessions.innerText = totalSess.toString();
    if (akCount) akCount.innerText = activeK.toString();

    // Best Sub Logic
    if (users.length > 0) {
        const sorted = [...users].sort((a, b) => (b.points || 0) - (a.points || 0));
        const best = sorted[0];
        const bsAv = document.getElementById('bestSubAvatar') as HTMLImageElement;
        const bsName = document.getElementById('bestSubName');
        const bsVal = document.getElementById('bestSubValue');

        if (best && bsAv && bsName && bsVal) {
            bsAv.src = best.avatar || 'https://via.placeholder.com/100';
            bsName.innerText = (best.name || "UNNAMED").toUpperCase();
            bsVal.innerText = `${(best.points || 0).toLocaleString()} PTS`;
        }
    }
}

function startTimerLoop() {
    if (timerInterval) clearInterval(timerInterval);
    const interval = setInterval(() => {
        if (currId) {
            const u = users.find(x => x.memberId === currId);
            if (u) updateDetail(u);
        }
    }, 1000);
    setTimerInterval(interval);
}

export function switchAdminTab(tab: 'ops' | 'intel' | 'record') {
    const tabs = document.querySelectorAll('.ap-tab');
    const views = document.querySelectorAll('.ap-view');

    tabs.forEach(t => t.classList.remove('active'));
    views.forEach(v => v.classList.add('hidden'));

    if (tab === 'ops') {
        tabs[0].classList.add('active');
        document.getElementById('tabOps')?.classList.remove('hidden');
    } else if (tab === 'intel') {
        tabs[1].classList.add('active');
        document.getElementById('tabIntel')?.classList.remove('hidden');
    } else {
        tabs[2].classList.add('active');
        document.getElementById('tabRecord')?.classList.remove('hidden');
    }
}


export async function adjustWallet(action: 'add' | 'sub') {
    if (!currId) return;
    console.log(`Adjusting wallet for ${currId}: ${action}`);

    const amount = action === 'add' ? 100 : -100;
    const result = await processCoinTransaction(currId, amount, "Admin Manual Adjustment");

    if (result.success) {
        // Update local state
        const u = users.find(x => x.memberId === currId);
        if (u) {
            u.wallet = result.newBalance;
            // Re-render detail view if needed
            // We need to call updateDetail(u) but it's currently a stub in this file.
            // Let's manually update the DOM elements if updateDetail isn't available or working.
            const walletEl = document.getElementById('dMirrorWallet');
            if (walletEl) walletEl.innerText = (u.wallet || 0).toLocaleString();
        }
    } else {
        console.error("Wallet adjustment failed:", result.error);
        alert("Action failed: " + result.error);
    }
}

export function manageAltar(slot: number) {
    console.log("Managing altar slot:", slot);
    // TODO: Implement Altar backend logic
}

export async function adminTaskAction(id: string | null, action: 'skip' | 'send') {
    // id is passed from onClick, but sometimes we rely on currId
    const targetId = id || currId;
    if (!targetId) return;

    console.log("Admin task action:", action, "for ID:", targetId);

    if (action === 'skip') {
        const result = await secureUpdateTaskAction(targetId, {
            wasSkipped: true,
            taskTitle: "Admin Force Skip"
        });

        if (result.success) {
            // Update local state
            const u = users.find(x => x.memberId === targetId);
            if (u) {
                // Manually reset local state to match backend
                u.activeTask = null;
                u.endTime = null;
                if (!u.parameters) u.parameters = {};
                u.parameters.taskdom_active_task = null;
                u.parameters.taskdom_end_time = null;

                // Force UI update
                const statusEl = document.getElementById('dActiveStatus');
                const textEl = document.getElementById('dActiveText');
                if (statusEl) { statusEl.innerText = "UNPRODUCTIVE"; statusEl.style.color = "#666"; }
                if (textEl) textEl.innerText = "None";
            }
        } else {
            alert("Failed to skip task.");
        }
    }
}

export function toggleTaskQueue() {
    const container = document.getElementById('taskQueueContainer');
    if (container) container.classList.toggle('hidden');
}

// Global Exports for legacy window compatibility
if (typeof window !== 'undefined') {
    (window as any).showHome = showHome;
    (window as any).renderMainDashboard = renderMainDashboard;
    (window as any).initDashboard = initDashboard;
    (window as any).switchAdminTab = switchAdminTab;
    (window as any).adjustWallet = adjustWallet;
    (window as any).manageAltar = manageAltar;
    (window as any).adminTaskAction = adminTaskAction;
    (window as any).toggleTaskQueue = toggleTaskQueue;
}
