

// js/dashboard-main.js - FULL MASTER CONTROLLER

// --- 1. IMPORTS ---
import {
    users, currId, globalQueue, globalTributes, availableDailyTasks,
    setUsers, setGlobalQueue, setGlobalTributes, setAvailableDailyTasks,
    setQueenContent, setStickerConfig, setBroadcastPresets, setTimerInterval, timerInterval,
    setArmoryTarget, setCurrId
} from './dashboard-state.js';

import { renderSidebar } from './dashboard-sidebar.js';
import { renderOperationsMonitor } from './dashboard-operations.js';
import { renderChat } from './dashboard-chat.js';
import { updateDetail } from './dashboard-users.js';
import { toggleMobStats } from './dashboard-utils.js';
import { Bridge } from './bridge.js';
import { unlockAudio } from './utils.js';

// Side-effect imports (Modals, Navigation)
import './dashboard-modals.js';
import './dashboard-navigation.js';
import { openChatPreview, closeChatPreview } from './chat.js';

// --- 2. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', function () {

    // Audio Wake-Up Strategy
    document.addEventListener('click', () => {
        const sfx = document.getElementById('msgSound');
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

    // --- FORCE MOCK DATA LOADING (LOCAL PREVIEW) ---
    if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") {
        console.log("%c⚠️ STANDALONE MODE: INJECTING SNAPSHOT ⚠️", "color:cyan; font-size:16px; font-weight:bold;");
        setTimeout(async () => {
            try {
                const { SNAPSHOT_USERS, SNAPSHOT_QUEUE } = await import('./dashboard-snapshot.js');
                setUsers(SNAPSHOT_USERS);
                setGlobalQueue(SNAPSHOT_QUEUE);
                renderMainDashboard();

                if (!window.currId && SNAPSHOT_USERS.length > 0) {
                    setTimeout(() => {
                        window.selUser(SNAPSHOT_USERS[0].memberId);
                    }, 500);
                }
            } catch (err) {
                console.error("Snapshot load failed:", err);
            }
        }, 500);
    }

    // --- FORCE NAVIGATION LISTENER (DELEGATION) ---
    // This bypasses inline onclick issues.
    document.addEventListener('click', (e) => {
        const item = e.target.closest('.u-item');
        if (item) {
            const onclickAttr = item.getAttribute('onclick');
            if (onclickAttr) {
                const match = onclickAttr.match(/'([^']+)'/);
                if (match && match[1]) {
                    const id = match[1];
                    console.log("FORCE CLICK DETECTED ON:", id);

                    // 1. FORCE UI SWITCH
                    document.getElementById('viewHome').style.display = 'none';
                    document.getElementById('viewProfile').style.display = 'none';
                    const vUser = document.getElementById('viewUser');
                    if (vUser) {
                        vUser.style.display = 'flex';
                        vUser.classList.add('active');
                    }

                    // 2. LOAD DATA
                    if (window.selUser) {
                        try {
                            window.selUser(id);
                        } catch (err) {
                            console.error("Data load failed:", err);
                        }
                    }
                }
            }
        }
    });

    console.log('Dashboard initialized. ID:', dayCode);
});

// NAVIGATION: BACK TO DASHBOARD
export function showHome() {
    console.log("NAVIGATING TO HOME");
    setCurrId(null);

    document.getElementById('viewUser').style.display = 'none';
    document.getElementById('viewUser').classList.remove('active');

    document.getElementById('viewProfile').style.display = 'none';
    document.getElementById('viewProfile').classList.remove('active');

    const vHome = document.getElementById('viewHome');
    vHome.style.display = 'grid';
    vHome.classList.add('active');

    renderMainDashboard();
}
window.showHome = showHome;

// --- 3. BRIDGE LISTENER (The Radio) ---
Bridge.listen((data) => {
    // Forward chat echoes to window (for chat.js to pick up)
    if (data.type === "CHAT_ECHO" || data.type === "UPDATE_CHAT") {
        window.postMessage(data, "*");
        return;
    }

    // Forward everything else
    window.postMessage(data, "*");

    // Instant Notification: Reward Claimed
    if (data.type === "SLAVE_REWARD_CLAIMED") {
        const u = users.find(x => x.memberId === data.memberId);
        if (u) {
            // Instant math update
            if (data.choice === 'coins') u.coins += data.value;
            else u.points += data.value;

            // Visual Pulse
            const sidebarItem = document.querySelector(`[onclick*="${data.memberId}"]`);
            if (sidebarItem) {
                const color = data.choice === 'coins' ? '#ffd700' : '#ff00de';
                sidebarItem.style.boxShadow = `inset 0 0 20px ${color}`;
                setTimeout(() => { sidebarItem.style.boxShadow = "none"; }, 2000);
            }

            // Refresh detail if viewing
            if (window.currId === data.memberId) window.updateDetail(u);
        }
    }
});

// --- 4. WIX DATA LISTENER (The Heavy Lifting) ---
window.addEventListener("message", async (event) => {
    const data = event.data;

    // A. MAIN SYNC
    if (data.type === "updateDashboard") {
        setUsers(data.users || []);
        setGlobalQueue(data.globalQueue || []);
        setGlobalTributes(data.globalTributes || []);
        setAvailableDailyTasks(data.dailyTasks || []);
        setQueenContent(data.queenCMS || []);

        // Sticker Mapping (RESTORED)
        // --- MOCK DATA LOADING (SNAPSHOT MODE) ---
        if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") {
            console.log("%c⚠️ SNAPSHOT MODE ACTIVE ⚠️", "color:cyan; font-size:16px; font-weight:bold;");

            setTimeout(async () => {
                try {
                    const { SNAPSHOT_USERS, SNAPSHOT_QUEUE } = await import('./dashboard-snapshot.js');
                    setUsers(SNAPSHOT_USERS);
                    setGlobalQueue(SNAPSHOT_QUEUE);

                    renderMainDashboard();

                    // Auto-select first user if none selected
                    if (!window.currId && SNAPSHOT_USERS.length > 0) {
                        setTimeout(() => {
                            if (window.selUser) window.selUser(SNAPSHOT_USERS[0].memberId);
                        }, 500);
                    }
                } catch (err) {
                    console.error("Snapshot load failed:", err);
                }
            }, 500);
        } else {
            renderMainDashboard();
        }
        const stickerSource = data.queenCMS?.find(item => item["10"] || item["100"]);
        if (stickerSource) {
            const vals = [10, 20, 30, 40, 50, 100];
            const newConfig = vals.map(v => ({
                id: `s${v}`,
                name: `${v} PTS`,
                val: v,
                url: stickerSource[v.toString()] || ""
            }));
            setStickerConfig(newConfig);
        }

        // Update User Detail (If open)
        if (window.currId) {
            const u = users.find(x => x.memberId === window.currId);
            if (u) updateDetail(u);
        }
    }

    // B. CHAT SYNC
    else if (data.type === "updateChat") {
        await renderChat(data.messages || []);

        const u = users.find(x => x.memberId === data.memberId);

        // Sound Logic (RESTORED)
        if (u && data.messages && data.messages.length > 0) {
            const lastMsg = data.messages[data.messages.length - 1];
            const realMsgTime = new Date(lastMsg._createdDate).getTime();

            if (realMsgTime > (u.lastMessageTime || 0) &&
                lastMsg.sender !== 'admin' &&
                data.memberId !== currId) {

                const sfx = document.getElementById('msgSound');
                if (sfx) {
                    sfx.currentTime = 0;
                    sfx.play().catch(e => { });
                }
            }
            u.lastMessageTime = realMsgTime;

            if (data.memberId === currId) {
                localStorage.setItem('read_' + data.memberId, Date.now().toString());
            }

            if (u.memberId !== currId) renderSidebar();
        }
    }

    // C. SUB-DATA LISTENERS (RESTORED)
    else if (data.type === "stickerConfig") {
        setStickerConfig(data.stickers || []);
    }

    else if (data.type === "broadcastPresets") {
        setBroadcastPresets(data.presets || []);
    }

    else if (data.type === "protocolUpdate") {
        import('./dashboard-protocol.js').then(({ updateProtocolProgress }) => {
            updateProtocolProgress();
        });
    }

    // D. INSTANT ECHO HANDLERS (RESTORED - Kills Lag)
    else if (data.type === "instantUpdate") {
        const u = users.find(x => x.memberId === data.memberId);
        if (u) {
            u.points = data.newPoints;
            if (window.currId === data.memberId) updateDetail(u);
        }
    }

    else if (data.type === "instantReviewSuccess") {
        const u = users.find(x => x.memberId === data.memberId);
        if (u && u.reviewQueue) {
            u.reviewQueue = u.reviewQueue.filter(t => t.id !== data.taskId);
            renderMainDashboard();
            if (window.currId === data.memberId) updateDetail(u);
        }
    }
});

// --- 5. RENDER FUNCTIONS ---
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
    if (tkSessions) tkSessions.innerText = totalSess;
    if (akCount) akCount.innerText = activeK;

    // Best Sub Logic
    if (users.length > 0) {
        const sorted = [...users].sort((a, b) => (b.points || 0) - (a.points || 0));
        const best = sorted[0];
        const bsAv = document.getElementById('bestSubAvatar');
        const bsName = document.getElementById('bestSubName');
        const bsVal = document.getElementById('bestSubValue');

        if (best && bsAv && bsName && bsVal) {
            bsAv.src = best.avatar || 'https://via.placeholder.com/100';
            bsName.innerText = best.name.toUpperCase();
            bsVal.innerText = `${(best.points || 0).toLocaleString()} PTS`;
        }
    }
}

function startTimerLoop() {
    if (timerInterval) clearInterval(timerInterval);
    const interval = setInterval(() => {
        // Only tick the current user details if visible
        if (window.currId) {
            const u = users.find(x => x.memberId === window.currId);
            if (u) updateDetail(u);
        }
        // Also tick protocol?
        // ... (Protocol logic sits in dashboard-protocol.js usually)
    }, 1000);
    setTimerInterval(interval);
}

// --- 6. NEW TABS & WALLET LOGIC ---

function switchAdminTab(tabName) {
    // 1. Highlight Button
    document.querySelectorAll('.ap-tab').forEach(btn => {
        btn.classList.remove('active');
        if (btn.innerText.toLowerCase() === tabName) btn.classList.add('active');
    });

    // 2. Update Views
    document.querySelectorAll('.ap-view').forEach(view => {
        view.classList.add('hidden');
        view.classList.remove('active');
    });

    // 3. Show Target
    const targetId = 'tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1);
    const target = document.getElementById(targetId);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('active');
    }
}

function adjustWallet(action) {
    if (!currId) return alert("Select a user first.");
    const amountStr = prompt(action === 'add' ? "Amount to ADD:" : "Amount to DEDUCT:");
    const amount = parseInt(amountStr);

    if (!amount || isNaN(amount)) return;

    const finalAmount = action === 'add' ? amount : -amount;

    // Send to Wix
    window.parent.postMessage({ type: "adjustCoins", memberId: currId, amount: finalAmount }, "*");

    // Optimistic Update
    const u = users.find(x => x.memberId === currId);
    if (u) {
        u.coins = (u.coins || 0) + finalAmount;
        document.getElementById('dWalletVal').innerText = u.coins;
    }
}

function manageAltar(slotId) {
    alert(`Altar Slot ${slotId} Manager - Coming Soon`);
}

// --- 7. EXPORTS (GLOBAL BINDING) ---
window.renderMainDashboard = renderMainDashboard;
window.adminTaskAction = function (mid, action) {
    if (action === 'send') {
        setArmoryTarget("active");
        window.openTaskGallery();
    }
    else if (action === 'skip') {
        window.parent.postMessage({ type: "adminTaskAction", memberId: mid, action: "skip" }, "*");
        // Optional: Open Armory after skip to replace it immediately
        setArmoryTarget("active");
        window.openTaskGallery();
    }
};
window.toggleMobStats = toggleMobStats;
window.openChatPreview = openChatPreview;
window.closeChatPreview = closeChatPreview;

// NEW EXPORTS
window.switchAdminTab = switchAdminTab;
window.adjustWallet = adjustWallet;
window.manageAltar = manageAltar;
Object.defineProperty(window, 'currId', { get: () => currId });
