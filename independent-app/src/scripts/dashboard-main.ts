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
import { loadWishlistManager, openWishlistAdd, openWishlistEdit, closeWishlistModal, saveWishlistItem, deleteWishlistItem, handleWishlistImageSelect, previewWishlistUrl } from './dashboard-wishlist';
import { updateDetail } from './dashboard-users';
import { toggleMobStats } from './dashboard-utils';
import { Bridge } from './bridge';
import { unlockAudio } from './utils';
import { getOptimizedUrl } from './media';
import { processCoinTransaction, secureUpdateTaskAction } from '@/actions/velo-actions';
import { createClient } from '@/utils/supabase/client';

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
    subscribeToDashboardTaskUpdates();

    console.log('Dashboard initialized. ID:', dayCode);
}

function subscribeToDashboardTaskUpdates() {
    const supabase = createClient();
    supabase
        .channel('dashboard_tasks_watch')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'tasks',
        }, async () => {
            console.log('[DASHBOARD REALTIME] Tasks changed — refreshing review queue...');
            try {
                const res = await fetch('/api/dashboard-data');
                const data = await res.json();
                if (data.globalQueue) {
                    setGlobalQueue(data.globalQueue);
                    // Re-map reviewQueue onto each user object (case-insensitive)
                    users.forEach((u: any) => {
                        const uid = (u.memberId || u.member_id || '').toLowerCase();
                        u.reviewQueue = data.globalQueue.filter(
                            (t: any) => (t.member_id || '').toLowerCase() === uid
                        );
                    });
                    renderMainDashboard();
                }
            } catch (err) {
                console.warn('[DASHBOARD REALTIME] Queue refresh failed:', err);
            }
        })
        .subscribe();
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

    const tabMap: Record<string, string> = { ops: 'tabOps', intel: 'tabIntel', record: 'tabRecord' };
    const btnMap: Record<string, string> = { ops: 'tabBtnOps', intel: 'tabBtnIntel', record: 'tabBtnRecord' };

    document.getElementById(tabMap[tab])?.classList.remove('hidden');
    document.getElementById(btnMap[tab])?.classList.add('active');
}

export function expandFeedSection(section: 'wishlist') {
    const overlay = document.getElementById('feedSectionOverlay');
    const title = document.getElementById('feedSectionOverlayTitle');
    if (!overlay) return;
    if (title) title.textContent = section.toUpperCase();
    overlay.style.display = 'flex';
    if (section === 'wishlist') loadWishlistManager();
}

export function collapseFeedSection() {
    const overlay = document.getElementById('feedSectionOverlay');
    if (overlay) overlay.style.display = 'none';
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
            updateDetail(u);
        }
    } else {
        console.error("Wallet adjustment failed:", result.error);
        alert("Action failed: " + result.error);
    }
}

export function manageAltar(slot: number) {
    const img = document.getElementById(`adminAltarImg${slot}`) as HTMLImageElement | null;
    if (img && img.src) {
        const overlay = document.getElementById('chatMediaOverlay');
        const content = document.getElementById('chatMediaOverlayContent');
        if (overlay && content) {
            content.innerHTML = `<img src="${getOptimizedUrl(img.src, 800)}" style="max-width:100%;max-height:90vh;border-radius:8px;" />`;
            overlay.classList.remove('hidden');
        }
    }
}

// Updates the 3 Sovereign Altar slots in the dashboard user view
export function updateDashboardAltar(historyArr: any[]) {
    const approved = historyArr.filter((t: any) => t.status === 'approve' && t.proofUrl && t.proofUrl !== 'SKIPPED');
    [1, 2, 3].forEach((num, i) => {
        const slot = document.getElementById(`adminAltarSlot${num}`);
        const img = document.getElementById(`adminAltarImg${num}`) as HTMLImageElement | null;
        if (!slot || !img) return;
        const entry = approved[i];
        if (entry && entry.proofUrl) {
            img.src = entry.proofUrl;
            img.classList.remove('hidden');
        } else {
            img.src = '';
            img.classList.add('hidden');
        }
    });
    // Update counts
    const accepted = historyArr.filter((t: any) => t.status === 'approve').length;
    const pending = historyArr.filter((t: any) => t.status === 'pending').length;
    const denied = historyArr.filter((t: any) => t.status === 'reject' || t.status === 'fail').length;
    const el = (id: string) => document.getElementById(id);
    if (el('adminAcceptedCount')) el('adminAcceptedCount')!.innerText = accepted.toString();
    if (el('adminPendingCount')) el('adminPendingCount')!.innerText = pending.toString();
    if (el('adminDeniedCount')) el('adminDeniedCount')!.innerText = denied.toString();
}

// Renders the expandable category panel in the dashboard Record tab
export function expandAdminCategory(category: 'accepted' | 'pending' | 'routine' | 'denied') {
    const u = users.find(x => x.memberId === currId);
    if (!u) return;

    let histArr: any[] = [];
    try {
        const raw = u['Taskdom_History'];
        histArr = typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw || []);
    } catch { histArr = []; }

    const filtered = histArr.filter((t: any) => {
        if (category === 'accepted') return t.status === 'approve';
        if (category === 'pending') return t.status === 'pending';
        if (category === 'denied') return t.status === 'reject' || t.status === 'fail';
        if (category === 'routine') return t.isRoutine === true || t.category === 'Routine';
        return false;
    });

    // Reuse the task gallery modal from dashboard-modals if available
    if ((window as any).openTaskGallery) {
        (window as any).openTaskGallery(filtered, category.toUpperCase(), currId);
    } else {
        // Fallback: simple lightbox
        const old = document.getElementById('__adminCatOverlay');
        if (old) old.remove();
        const overlay = document.createElement('div');
        overlay.id = '__adminCatOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:9999;overflow-y:auto;padding:40px 20px;';
        overlay.innerHTML = `
            <div style="max-width:900px;margin:0 auto;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
                    <div style="font-family:Orbitron;font-size:0.7rem;color:#c5a059;letter-spacing:3px;">${category.toUpperCase()} — ${filtered.length} ENTRIES</div>
                    <button onclick="document.getElementById('__adminCatOverlay').remove()" style="background:none;border:1px solid #333;color:#888;font-family:Orbitron;font-size:0.5rem;padding:8px 16px;cursor:pointer;border-radius:3px;">CLOSE</button>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;">
                ${filtered.map((t: any) => {
            const isVid = /\.(mp4|mov|webm)/i.test(t.proofUrl || '');
            const media = t.proofUrl && t.proofUrl !== 'SKIPPED'
                ? (isVid
                    ? `<video src="${t.proofUrl}" style="width:100%;aspect-ratio:3/4;object-fit:cover;" muted playsinline loop></video>`
                    : `<img src="${getOptimizedUrl(t.proofUrl, 300)}" style="width:100%;aspect-ratio:3/4;object-fit:cover;" />`)
                : `<div style="aspect-ratio:3/4;display:flex;align-items:center;justify-content:center;font-size:2rem;background:#0a0a0a;">🚫</div>`;
            const date = new Date(t.timestamp || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            const statusColor = t.status === 'approve' ? '#c5a059' : t.status === 'pending' ? '#888' : '#8b0000';
            const isPending = t.status === 'pending';
            return `<div style="background:#060606;border:1px solid #1a1a1a;border-radius:6px;overflow:hidden;cursor:pointer;" onclick="this.querySelector('video,img')?.click()">
                        ${media}
                        <div style="padding:8px 10px;">
                            <div style="font-family:Orbitron;font-size:0.4rem;color:${statusColor};letter-spacing:1px;">${date} · ${(t.status || '').toUpperCase()}</div>
                            <div style="font-family:Rajdhani;font-size:0.7rem;color:#666;margin-top:4px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${(t.text || '').replace(/<[^>]+>/g, '')}</div>
                            ${isPending ? `<div style="display:flex;gap:6px;margin-top:8px;">
                                <button onclick="event.stopPropagation();(window.reviewTask||window.approveFromGallery)('${t.id}','${u.memberId}')" style="flex:1;background:#c5a059;color:#000;border:none;font-family:Orbitron;font-size:0.4rem;padding:6px;cursor:pointer;border-radius:3px;">APPROVE</button>
                                <button onclick="event.stopPropagation();(window.rejectFromGallery||function(){})('${t.id}','${u.memberId}')" style="flex:1;background:#8b0000;color:#fff;border:none;font-family:Orbitron;font-size:0.4rem;padding:6px;cursor:pointer;border-radius:3px;">REJECT</button>
                            </div>` : ''}
                        </div>
                    </div>`;
        }).join('')}
                </div>
            </div>`;
        document.body.appendChild(overlay);
    }
}

export async function adminTaskAction(id: string | null, action: 'skip' | 'send') {
    // id is passed from onClick, but sometimes we rely on currId
    const targetId = id || currId;
    if (!targetId) return;

    console.log("Admin task action:", action, "for ID:", targetId);

    if (action === 'send') {
        const { openTaskGallery } = await import('./dashboard-modals');
        openTaskGallery();
        return;
    }

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
                    <div style="flex:1;min-width:0;">
                        ${p.title ? `<div style="font-family:Cinzel;font-size:1rem;color:#c5a059;letter-spacing:2px;margin-bottom:5px;">${p.title}</div>` : ''}
                        ${p.content ? `<div style="font-family:Rajdhani;font-size:0.9rem;color:#ccc;line-height:1.6;">${p.content}</div>` : ''}
                    </div>
                    <button onclick="window.deleteQueenPost('${p.id}')" style="background:rgba(255,0,0,0.1);border:1px solid rgba(255,0,0,0.3);color:#ff4444;padding:4px 10px;border-radius:4px;cursor:pointer;font-family:Orbitron;font-size:0.6rem;flex-shrink:0;margin-left:15px;">DEL</button>
                </div>
                ${p.media_url ? `
                    <div style="width:100%;border-radius:6px;border:1px solid #222;overflow:hidden;">
                        ${p.media_type === 'video'
                            ? `<video src="${p.media_url}" controls style="width:100%;max-height:300px;display:block;background:#000;"></video>`
                            : `<img src="${getOptimizedUrl(p.media_url, 400)}" style="width:100%;object-fit:cover;max-height:300px;display:block;" onerror="this.insertAdjacentHTML('afterend','<div style=\\'color:#ff4444;font-family:Orbitron;font-size:0.55rem;padding:8px;\\'>IMG LOAD FAILED — check Supabase bucket is public</div>');this.remove();" />`
                        }
                        <div style="font-family:monospace;font-size:0.55rem;color:#444;padding:4px 8px;word-break:break-all;">${p.media_url}</div>
                    </div>` : ''}
                <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
                    <div style="font-family:Orbitron;font-size:0.5rem;color:#444;letter-spacing:1px;">${new Date(p.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).toUpperCase()}</div>
                    ${p.min_rank && p.min_rank !== 'Hall Boy' ? `<div style="font-family:Orbitron;font-size:0.45rem;color:#c5a059;letter-spacing:1px;background:rgba(197,160,89,0.1);border:1px solid rgba(197,160,89,0.2);padding:2px 8px;border-radius:3px;">🔒 ${p.min_rank.toUpperCase()}</div>` : ''}
                    ${p.price > 0 ? `<div style="font-family:Orbitron;font-size:0.45rem;color:#888;letter-spacing:1px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);padding:2px 8px;border-radius:3px;">💰 ${p.price} COINS</div>` : ''}
                    ${p.media_type && p.media_type !== 'text' ? `<div style="font-family:Orbitron;font-size:0.45rem;color:#888;letter-spacing:1px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);padding:2px 8px;border-radius:3px;">${p.media_type.toUpperCase()}</div>` : ''}
                    <div style="font-family:Orbitron;font-size:0.45rem;color:#888;letter-spacing:1px;">♥ ${p.likes || 0}</div>
                    ${p.is_published === false ? `<div style="font-family:Orbitron;font-size:0.45rem;color:#ff6b6b;letter-spacing:1px;background:rgba(255,107,107,0.1);border:1px solid rgba(255,107,107,0.3);padding:2px 8px;border-radius:3px;">DRAFT</div>` : ''}
                </div>
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
    const minRankEl = document.getElementById('postMinRankInput') as HTMLSelectElement;
    const priceEl = document.getElementById('postPriceInput') as HTMLInputElement;
    const mediaTypeEl = document.getElementById('postMediaTypeValue') as HTMLInputElement;
    const isPublishedEl = document.getElementById('postIsPublished') as HTMLInputElement;

    const title = titleEl?.value?.trim();
    const content = bodyEl?.value?.trim();

    if (!title && !content) {
        alert('Please enter a title or content for the post.');
        return;
    }

    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'PUBLISHING...'; }

    try {
        let media_url: string | null = null;

        // Upload image/video if selected
        if (imageInput?.files?.[0]) {
            if (submitBtn) submitBtn.innerText = 'UPLOADING...';
            const { uploadToSupabase } = await import('./mediaSupabase');
            const url = await uploadToSupabase('media', 'queen_posts', imageInput.files[0]);
            console.log('[Post upload] result:', url);
            if (url && !url.startsWith('failed')) {
                media_url = url;
            } else {
                alert('Media upload failed: ' + url + '\n\nCheck that the "media" bucket exists and is public in Supabase.');
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'PUBLISH'; }
                return;
            }
        }

        const min_rank = minRankEl?.value || 'Hall Boy';
        const price = parseInt(priceEl?.value || '0', 10) || 0;
        const media_type = mediaTypeEl?.value || 'text';
        const is_published = isPublishedEl ? isPublishedEl.checked : true;

        const res = await fetch('/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, media_url, min_rank, price, media_type, is_published })
        });

        const data = await res.json();

        if (data.success) {
            // Reset form
            if (titleEl) titleEl.value = '';
            if (bodyEl) bodyEl.value = '';
            if (imageInput) imageInput.value = '';
            const preview = document.getElementById('postImagePreview') as HTMLImageElement;
            if (preview) { preview.src = ''; preview.style.display = 'none'; }
            if (minRankEl) minRankEl.value = 'Hall Boy';
            if (priceEl) priceEl.value = '0';
            if (mediaTypeEl) mediaTypeEl.value = 'text';
            if (isPublishedEl) isPublishedEl.checked = true;

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

// ─── TASK REVIEW ACTIONS (CEO) ───────────────────────────────────────────────

export async function reviewTask(submissionId: string, memberId: string) {
    if (!confirm('APPROVE this task submission? This will award 500 coins.')) return;

    try {
        const res = await fetch('/api/tasks/review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ submissionId, memberId, action: 'approve', bonus: 500 })
        });
        const data = await res.json();

        if (data.success) {
            // Update local user state
            const u = users.find(x => x.memberId === memberId);
            if (u) {
                try {
                    const history = typeof u['Taskdom_History'] === 'string'
                        ? JSON.parse(u['Taskdom_History'] || '[]')
                        : (u['Taskdom_History'] || []);
                    const idx = history.findIndex((t: any) => t.id === submissionId);
                    if (idx > -1) { history[idx].status = 'approve'; history[idx].completed = true; }
                    u['Taskdom_History'] = JSON.stringify(history);
                } catch (_) { }
            }

            // Close overlay and refresh
            document.getElementById('__adminCatOverlay')?.remove();
            alert(`✓ APPROVED — ${data.pointsAwarded} coins awarded.`);
        } else {
            alert('Failed to approve: ' + data.error);
        }
    } catch (err) {
        alert('Network error during approval.');
    }
}

export async function rejectFromGallery(submissionId: string, memberId: string) {
    if (!confirm('REJECT this task submission? This will deduct 300 coins from the slave.')) return;

    try {
        const res = await fetch('/api/tasks/review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ submissionId, memberId, action: 'reject' })
        });
        const data = await res.json();

        if (data.success) {
            // Update local user state
            const u = users.find(x => x.memberId === memberId);
            if (u) {
                try {
                    const history = typeof u['Taskdom_History'] === 'string'
                        ? JSON.parse(u['Taskdom_History'] || '[]')
                        : (u['Taskdom_History'] || []);
                    const idx = history.findIndex((t: any) => t.id === submissionId);
                    if (idx > -1) { history[idx].status = 'reject'; history[idx].completed = false; }
                    u['Taskdom_History'] = JSON.stringify(history);
                } catch (_) { }
            }

            // Close overlay and refresh
            document.getElementById('__adminCatOverlay')?.remove();
            alert(`✗ REJECTED — 300 coin penalty applied.`);
        } else {
            alert('Failed to reject: ' + data.error);
        }
    } catch (err) {
        alert('Network error during rejection.');
    }
}

// Global Exports for legacy window compatibility
if (typeof window !== 'undefined') {
    (window as any).showHome = showHome;
    (window as any).renderMainDashboard = renderMainDashboard;
    (window as any).initDashboard = initDashboard;
    (window as any).switchAdminTab = switchAdminTab;
    (window as any).expandFeedSection = expandFeedSection;
    (window as any).collapseFeedSection = collapseFeedSection;
    (window as any).openWishlistAdd = openWishlistAdd;
    (window as any).openWishlistEdit = openWishlistEdit;
    (window as any).closeWishlistModal = closeWishlistModal;
    (window as any).saveWishlistItem = saveWishlistItem;
    (window as any).deleteWishlistItem = deleteWishlistItem;
    (window as any).handleWishlistImageSelect = handleWishlistImageSelect;
    (window as any).previewWishlistUrl = previewWishlistUrl;
    (window as any).adjustWallet = adjustWallet;
    (window as any).manageAltar = manageAltar;
    (window as any).adminTaskAction = adminTaskAction;
    (window as any).toggleTaskQueue = toggleTaskQueue;
    (window as any).showPosts = showPosts;
    (window as any).submitQueenPost = submitQueenPost;
    (window as any).deleteQueenPost = deleteQueenPost;
    (window as any).loadQueenPostsDashboard = loadQueenPostsDashboard;
    (window as any).reviewTask = reviewTask;
    (window as any).approveFromGallery = reviewTask; // alias for backward compat
    (window as any).rejectFromGallery = rejectFromGallery;
}

