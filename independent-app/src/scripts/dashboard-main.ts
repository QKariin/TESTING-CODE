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
import { updateDetail } from './dashboard-users';
import { toggleMobStats } from './dashboard-utils';
import { Bridge } from './bridge';
import { unlockAudio } from './utils';
import { getOptimizedUrl } from './media';
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
            bsAv.src = getOptimizedUrl(best.avatar || 'https://via.placeholder.com/100', 100);
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

// ─── QUEEN KARIN POSTS ───────────────────────────────────────────────────────

// Switch to Posts view
export function showPosts() {
    const views = ['viewHome', 'viewProfile', 'viewUser', 'viewPosts'];
    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.style.display = 'none'; el.classList.remove('active'); }
    });
    const vPosts = document.getElementById('viewPosts');
    if (vPosts) { vPosts.style.display = 'flex'; vPosts.classList.add('active'); }
    loadQueenPostsDashboard();
}

// Load posts into the dashboard list
export async function loadQueenPostsDashboard() {
    const container = document.getElementById('postsListContainer');
    if (!container) return;
    container.innerHTML = '<div style="color:#666;font-family:Orbitron;font-size:0.7rem;letter-spacing:2px;padding:20px;text-align:center;">LOADING...</div>';

    try {
        const res = await fetch('/api/posts', { cache: 'no-store' });
        const data = await res.json();

        if (!data.success || data.posts.length === 0) {
            container.innerHTML = '<div style="color:#444;font-family:Cinzel;font-size:0.8rem;padding:20px;text-align:center;">No posts yet. Be the first to speak.</div>';
            return;
        }

        container.innerHTML = data.posts.map((p: any) => `
            <div style="border:1px solid #222;border-radius:8px;padding:20px;background:#0a0a0a;display:flex;flex-direction:column;gap:10px;position:relative;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                    <div>
                        ${p.title ? `<div style="font-family:Cinzel;font-size:1rem;color:#c5a059;letter-spacing:2px;margin-bottom:5px;">${p.title}</div>` : ''}
                        ${p.content ? `<div style="font-family:Rajdhani;font-size:0.9rem;color:#ccc;line-height:1.6;">${p.content}</div>` : ''}
                    </div>
                    <button onclick="window.deleteQueenPost('${p.id}')" style="background:rgba(255,0,0,0.1);border:1px solid rgba(255,0,0,0.3);color:#ff4444;padding:4px 10px;border-radius:4px;cursor:pointer;font-family:Orbitron;font-size:0.6rem;flex-shrink:0;margin-left:15px;">DEL</button>
                </div>
                ${p.media_url ? `<div style="width:100%;max-height:300px;overflow:hidden;border-radius:6px;border:1px solid #222;"><img src="${p.media_url}" style="width:100%;object-fit:cover;max-height:300px;display:block;" /></div>` : ''}
                <div style="font-family:Orbitron;font-size:0.55rem;color:#444;letter-spacing:1px;margin-top:5px;">${new Date(p.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).toUpperCase()}</div>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = '<div style="color:#ff4444;font-family:Orbitron;font-size:0.7rem;padding:20px;">ERROR LOADING POSTS</div>';
    }
}

// Submit a new post
export async function submitQueenPost() {
    const titleEl = document.getElementById('postTitleInput') as HTMLInputElement;
    const bodyEl = document.getElementById('postBodyInput') as HTMLTextAreaElement;
    const imageInput = document.getElementById('postImageInput') as HTMLInputElement;
    const submitBtn = document.getElementById('postSubmitBtn') as HTMLButtonElement;

    const title = titleEl?.value?.trim();
    const content = bodyEl?.value?.trim();

    if (!title && !content) {
        alert('Please enter a title or content for the post.');
        return;
    }

    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'PUBLISHING...'; }

    try {
        let media_url: string | null = null;

        // Upload image if selected
        if (imageInput?.files?.[0]) {
            const { uploadToBytescale } = await import('./mediaBytescale');
            const url = await uploadToBytescale('queen_post', imageInput.files[0], 'queen_posts');
            if (url !== 'failed') media_url = url;
        }

        const res = await fetch('/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, media_url })
        });

        const data = await res.json();

        if (data.success) {
            // Reset form
            if (titleEl) titleEl.value = '';
            if (bodyEl) bodyEl.value = '';
            if (imageInput) imageInput.value = '';
            const preview = document.getElementById('postImagePreview') as HTMLImageElement;
            if (preview) { preview.src = ''; preview.style.display = 'none'; }

            loadQueenPostsDashboard();
        } else {
            alert('Failed to publish: ' + data.error);
        }
    } catch (err) {
        alert('Network error publishing post.');
    } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'PUBLISH'; }
    }
}

// Delete a post
export async function deleteQueenPost(id: string) {
    if (!confirm('Delete this post permanently?')) return;

    try {
        const res = await fetch('/api/posts', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        const data = await res.json();
        if (data.success) loadQueenPostsDashboard();
        else alert('Delete failed: ' + data.error);
    } catch (err) {
        alert('Network error deleting post.');
    }
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
    (window as any).showPosts = showPosts;
    (window as any).submitQueenPost = submitQueenPost;
    (window as any).deleteQueenPost = deleteQueenPost;
    (window as any).loadQueenPostsDashboard = loadQueenPostsDashboard;
}
