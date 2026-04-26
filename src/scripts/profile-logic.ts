import { getState, setState } from './profile-state';
import { createClient } from '@/utils/supabase/client';
import { getHierarchyReport } from '../lib/hierarchyRules';
import { uploadToSupabase, getVideoDuration, isVideo, extractAndUploadVideoThumbnail } from './mediaSupabase';
import { getOptimizedUrl } from './media';
import { presenceKey } from './dashboard-presence';

let globalTributes: any[] = [];
export async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
}

// ─── REWARD CLAIMING ───
let _claiming = false;
export async function claimKneelReward(type: 'coins' | 'points') {
    if (_claiming) return;
    _claiming = true;

    // Hide overlay immediately so user can't double-click
    document.getElementById('kneelRewardOverlay')?.classList.add('hidden');
    document.getElementById('mobKneelReward')?.classList.add('hidden');

    const currentState = getState();
    const { raw, id, memberId, wallet, score } = currentState;
    const pid = memberId || id;
    if (!pid) { _claiming = false; return; }

    const amount = type === 'coins' ? 10 : 50;
    console.log(`[REWARD] Claiming ${amount} ${type}...`);

    // 1. Save to DB FIRST - this writes lastWorship + kneelCount (Wix CLAIM_KNEEL_REWARD pattern)
    try {
        const res = await fetch('/api/claim-reward', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ choice: type, memberId: pid })
        });

        const data = await res.json();

        if (res.status === 429) {
            // Cooldown still active - overlay already hidden above
            console.log(`[REWARD] Cooldown still active (${data.minLeft}m left). Ignoring.`);
            _claiming = false;
            return;
        }

        if (!data.success) {
            console.error('[REWARD] Server rejected claim:', data.error);
            _claiming = false;
            return;
        }

        loadChatHistory(pid);
    } catch (err) {
        console.error('[REWARD] Save failed', err);
        _claiming = false;
        return;
    }

    // 3. Update local balance state
    const newWallet = type === 'coins' ? (wallet || 0) + amount : (wallet || 0);
    const newScore = type === 'points' ? (score || 0) + amount : (score || 0);
    setState({ wallet: newWallet, score: newScore });

    if (type === 'coins') triggerCoinShower();

    // 4. Play sound (overlay already hidden at top of function)
    const snd = document.getElementById('coinSound') as HTMLAudioElement;
    if (snd) { snd.currentTime = 0; snd.play().catch(e => console.log(e)); }

    // 5. Re-fetch fresh data so sidebar shows updated kneelCount + kneeling hours
    try {
        const freshRes = await fetch('/api/slave-profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: pid, full: true }) });
        const freshData = await freshRes.json();

        if (!freshRes.ok || freshData.error) {
            // Re-fetch failed — render with patched current state (don't overwrite with empty/error)
            const patched = { ...(raw || {}), wallet: newWallet, score: newScore };
            renderProfileSidebar(patched);
        } else {
            setState({ raw: freshData });
            renderProfileSidebar(freshData);
            const { updateKneelingHoursUI } = await import('./kneeling');
            const todayKneeling = parseInt(freshData['today kneeling'] || '0', 10);
            updateKneelingHoursUI(todayKneeling);
        }
    } catch (_) {
        // Network error — render with patched current state
        const patched = { ...(raw || {}), wallet: newWallet, score: newScore };
        renderProfileSidebar(patched);
    }
    _claiming = false;
}


// ─── TAB SWITCHING ───
export function switchTab(tab: string) {
    const views = ['viewServingTopDesktop', 'historySection', 'viewNews', 'viewBuy'];
    views.forEach(v => {
        const el = document.getElementById(v);
        if (el) {
            el.classList.add('hidden');
            el.style.display = 'none';
        }
    });

    const target = {
        'serve': 'viewServingTopDesktop',
        'record': 'historySection',
        'news': 'viewNews',
        'buy': 'viewBuy'
    }[tab];

    if (target) {
        const el = document.getElementById(target);
        if (el) {
            el.classList.remove('hidden');
            el.style.display = target === 'viewServingTopDesktop' ? 'grid' : 'flex';
        }
    }

    // Load gallery if switching to record tab and it has pending updates
    if (tab === 'record') flushGalleryIfDirty();

    const btns = document.querySelectorAll('.nav-btn');
    btns.forEach(b => b.classList.remove('active'));
}

// ─── FRAGMENT REVEAL ───
export async function revealFragment() {
    const { id, memberId } = getState();
    const pid = memberId || id;
    if (!pid) return;

    try {
        const res = await fetch('/api/profile-action', {
            method: 'POST',
            body: JSON.stringify({ type: 'REVEAL_FRAGMENT', memberId: pid })
        });
        const data = await res.json();
        if (data.success) {
            const { pick, progress, revealMapCount } = data.result;
            setState({
                revealMap: data.result.revealMap || [],
                libraryProgress: progress
            });
            renderProfileSidebar(getState().raw || getState());
            return data.result;
        }
    } catch (err) {
        console.error("Error revealing fragment", err);
    }
}

export function toggleRewardGrid() {
    const section = document.getElementById('revealSection');
    if (section) {
        section.style.display = section.style.display === 'none' ? 'flex' : 'none';
    }
}

export function triggerCoinShower() {
    for (let i = 0; i < 20; i++) {
        const coin = document.createElement('div');
        coin.className = 'coin-particle';
        coin.style.cssText = `position:fixed;width:20px;height:20px;background:radial-gradient(circle,#ffd700 0%,#b8860b 100%);border-radius:50%;left:${Math.random() * 100}vw;top:-50px;z-index:9999;transition:top 2s ease-in, opacity 2s ease-in;box-shadow:0 0 10px #ffd700;pointer-events:none;`;
        document.body.appendChild(coin);
        setTimeout(() => { coin.style.top = '110vh'; coin.style.opacity = '0'; }, 50);
        setTimeout(() => coin.remove(), 2100);
    }
}

// ─── TRIBUTE SYSTEM LOGIC ───
let globalTributesError: string | null = null;
let globalLastTribute: { title: string; price: number; senderName: string; at: string } | null = null;

export async function loadTributes() {
    try {
        const res = await fetch('/api/tributes', { cache: 'no-store' });
        const data = await res.json();
        if (data.success && data.tributes && data.tributes.length > 0) {
            globalTributes = data.tributes.sort((a: any, b: any) => {
                if (a.is_crowdfund && !b.is_crowdfund) return -1;
                if (!a.is_crowdfund && b.is_crowdfund) return 1;
                return 0;
            });
            globalLastTribute = data.lastTribute || null;
            globalTributesError = null;
            renderTributes();
        } else if (data.success && data.tributes && data.tributes.length === 0) {
            globalTributesError = "Table 'wishlist' exists, but it has 0 items inside it! You need to add items to your Supabase table.";
            renderTributes();
        } else {
            globalTributesError = data.error || "Unknown server error.";
            console.error("[Tributes API]", globalTributesError);
            renderTributes();
        }
    } catch (err: any) {
        globalTributesError = err.message || "Failed to load tributes.";
        console.error("Failed to load tributes:", err);
        renderTributes();
    }
}

function renderTributes() {
    console.log("[ProfileLogic] Rendering tributes:", globalTributes);
    const quickBox = document.getElementById('desk_QuickTribute');
    const gridDesk = document.getElementById('huntStoreGridDesk');
    const gridMob = document.getElementById('mob_huntStoreGrid');

    if (globalTributesError) {
        const errHtml = `<div style="color:red; padding:15px; font-family:'Orbitron'; font-size:0.8rem; border:1px solid red; background:rgba(255,0,0,0.1); border-radius:8px;"><b>DATABASE ERROR:</b><br/>${globalTributesError}</div>`;
        if (quickBox) quickBox.innerHTML = errHtml;
        if (gridDesk) gridDesk.innerHTML = errHtml;
        if (gridMob) gridMob.innerHTML = errHtml;
        return;
    }

    // 1. Desktop Quick Connect - Last tribute info + coffee + random wishlist item
    if (globalTributes.length >= 1) {
        const coffeeItem = globalTributes.find(t => t.title?.toLowerCase().includes('coffee'));
        const otherItems = globalTributes.filter(t => t !== coffeeItem);
        const randomItem = otherItems.length > 0 ? otherItems[Math.floor(Math.random() * otherItems.length)] : null;
        const quickItems = [coffeeItem, randomItem].filter(Boolean) as typeof globalTributes;

        // Last tribute info - read from THIS user's own profile parameters (per-user, not global)
        const st = getState();
        const userLastTribute = st.raw?.parameters?.last_tribute || null;
        const lastTributeAt = userLastTribute?.at || null;
        const lastTributeTitle = userLastTribute?.title || null;
        const senderNameFromApi = st.raw?.name || null;

        // Relative time helper
        function relativeTime(iso: string): string {
            if (!iso) return '';
            const d = new Date(iso);
            if (isNaN(d.getTime())) return '';
            const diff = Date.now() - d.getTime();
            const mins = Math.floor(diff / 60000);
            const hours = Math.floor(diff / 3600000);
            const days = Math.floor(diff / 86400000);
            if (mins < 60) return `${mins}m ago`;
            if (hours < 24) return `${hours}h ago`;
            if (days < 7) return `${days}d ago`;
            return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        }

        let lastTributeHtml = '';
        if (lastTributeAt) {
            const senderName = senderNameFromApi
                || st?.raw?.name
                || (st?.memberId ? st.memberId.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : 'Unknown');

            const tributePrice = userLastTribute?.amount ? `<span style="color:#c5a059;">&nbsp;${userLastTribute.amount} <i class="fas fa-coins" style="font-size:0.45rem;"></i></span>` : '';
            lastTributeHtml = `
            <div style="text-align:center; padding:6px 0 10px;">
                <div style="font-family:'Orbitron', sans-serif; font-size:0.5rem; color:rgba(197,160,89,0.5); letter-spacing:2px; text-transform:uppercase; margin-bottom:5px;">LAST TRIBUTE &nbsp;·&nbsp; <span style="color:rgba(255,255,255,0.7);">${senderName}</span></div>
                ${lastTributeTitle ? `<div style="font-family:'Orbitron', sans-serif; font-size:0.5rem; color:rgba(255,255,255,0.3); letter-spacing:1px; margin-bottom:3px;">${lastTributeTitle}${tributePrice}</div>` : ''}
                <div style="font-family:'Orbitron', sans-serif; font-size:0.42rem; color:rgba(197,160,89,0.35); letter-spacing:1px;">${relativeTime(lastTributeAt)}</div>
            </div>`;
        }

        const quickItemsHtml = lastTributeHtml + quickItems.map((t) => `
            <div onclick="window.buyTribute('${t.id}', '${t.title}', ${t.price})" style="position:relative; border-radius:12px; overflow:hidden; background:#0a0a14; border:1px solid rgba(197,160,89,0.2); cursor:pointer; transition:all 0.25s ease; box-shadow:0 4px 20px rgba(0,0,0,0.4);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 30px rgba(197,160,89,0.15)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 20px rgba(0,0,0,0.4)';">
                    <div style="width:100%; height:120px; background-color:#050510; position:relative; overflow:hidden;">
                        <img src="${getOptimizedUrl(t.image, 400)}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='/queen-karin.png'">
                    </div>
                <div style="position:absolute; top:10px; right:10px; background:rgba(5,5,20,0.85); border:1px solid rgba(197,160,89,0.5); border-radius:20px; padding:4px 10px; display:flex; align-items:center; gap:5px; backdrop-filter:blur(5px);">
                    <i class="fas fa-coins" style="color:#c5a059; font-size:0.7rem;"></i>
                    <span style="font-family:'Orbitron', sans-serif; font-size:0.75rem; color:#c5a059; font-weight:700; letter-spacing:1px;">${t.price.toLocaleString()}</span>
                </div>
                <div style="padding:12px 15px 15px;">
                    <div style="font-family:'Orbitron', sans-serif; font-size:0.9rem; color:#fff; font-weight:700; letter-spacing:1px; margin-bottom:10px; text-transform:uppercase;">${t.title}</div>
                    <div style="width:100%; text-align:center; background:linear-gradient(135deg, #c5a059 0%, #8b6914 100%); color:#000; font-family:'Orbitron', sans-serif; font-size:0.65rem; font-weight:700; letter-spacing:2px; padding:8px 0; border-radius:6px;">QUICK SEND</div>
                </div>
            </div>
        `).join('');

        if (quickBox) quickBox.innerHTML = quickItemsHtml;
    }

    // 2. Desktop Modal Overview AND Mobile Grid Overlay

    const renderGrid = (gridEl: HTMLElement) => {
        if (!gridEl) return;
        // Read wallet fresh inside closure so it reflects loaded profile state
        const walletForSlider = getState()?.wallet || 0;

        gridEl.innerHTML = globalTributes.map((t, index) => {
            if (t.is_crowdfund) {
                const goal = t.goal_amount || 1;
                const raised = t.raised_amount || 0;
                const progressPercent = Math.min(100, Math.round((raised / goal) * 100));
                const remaining = Math.max(10, goal - raised);
                const sliderMax = Math.min(walletForSlider > 0 ? walletForSlider : remaining, remaining);
                const sliderDefault = Math.min(200, sliderMax);

                return `
                <div class="store-item crowdfund-card" style="grid-column: span 4; position:relative; background:#0a0a14; border-radius:20px; display:flex; flex-direction:row; box-shadow:0 12px 40px rgba(0,0,0,0.6); border:1px solid rgba(197,160,89,0.25); align-items:stretch;">

                    <!-- LEFT: Info -->
                    <div style="flex:1; display:flex; flex-direction:column; gap:14px; padding:28px; min-width:0;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
                            <div style="font-family:'Orbitron', sans-serif; font-size:2rem; color:#fff; line-height:1.1; font-weight:700; letter-spacing:2px; text-transform:uppercase;">${t.title}</div>
                            ${t.top_contributor ? `
                            <div style="display:flex; flex-direction:column; align-items:flex-end; background:rgba(197,160,89,0.08); padding:8px 15px; border-radius:12px; border:1px solid rgba(197,160,89,0.3);">
                                <span style="font-family:'Orbitron', sans-serif; font-size:0.5rem; color:#c5a059; text-transform:uppercase; letter-spacing:2px;">Top Contributor</span>
                                <span style="font-family:'Orbitron', sans-serif; font-size:1.2rem; color:#fff; font-weight:bold;">${t.top_contributor}</span>
                            </div>` : ''}
                        </div>

                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="font-family:'Orbitron', sans-serif; font-size:0.85rem; color:#c5a059; font-weight:700;">${raised.toLocaleString()}</div>
                            <div style="font-family:'Orbitron', sans-serif; font-size:0.7rem; color:rgba(255,255,255,0.3);">/ ${goal.toLocaleString()}</div>
                            <i class="fas fa-coins" style="color:#c5a059; font-size:0.75rem; margin-left:2px;"></i>
                        </div>

                        <div style="width:100%; height:6px; background:rgba(255,255,255,0.08); border-radius:3px; overflow:hidden;">
                            <div style="height:100%; width:${progressPercent}%; background:linear-gradient(90deg, #c5a059, #f0d080); border-radius:3px; transition:width 0.5s ease;"></div>
                        </div>

                        <div style="display:flex; flex-direction:column; gap:12px; background:rgba(255,255,255,0.04); padding:16px; border-radius:14px; border:1px solid rgba(197,160,89,0.15); margin-top:auto;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <div style="font-family:'Orbitron', sans-serif; font-size:0.55rem; color:rgba(255,255,255,0.4); letter-spacing:2px; text-transform:uppercase;">Your contribution</div>
                                <div style="font-family:'Orbitron', sans-serif; font-size:1.6rem; color:#c5a059; font-weight:bold;" id="crowdfund_display_${t.id}">${sliderDefault.toLocaleString()} <i class="fas fa-coins" style="font-size:1rem;"></i></div>
                            </div>
                            <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                                <input type="range" id="crowdfund_input_${t.id}" min="10" max="${sliderMax}" step="10" value="${sliderDefault}"
                                    oninput="window.updateCrowdfundSlider('${t.id}', this.value)"
                                    style="flex:1; min-width:100px; height:6px; border-radius:3px; appearance:none; outline:none; background:rgba(197,160,89,0.2); cursor:pointer; accent-color:#c5a059;" />
                                <button id="crowdfund_btn_${t.id}" onclick="window.contributeCrowdfund('${t.id}', '${t.title}')"
                                    style="background:linear-gradient(135deg, #c5a059 0%, #8b6914 100%); color:#000; border:none; padding:12px 22px; border-radius:10px; font-family:'Orbitron', sans-serif; font-size:0.65rem; cursor:pointer; font-weight:700; letter-spacing:1px; box-shadow:0 6px 20px rgba(197,160,89,0.3); transition:all 0.2s; white-space:nowrap;"
                                    onmouseover="this.style.opacity='0.85'; this.style.transform='scale(1.03)';"
                                    onmouseout="this.style.opacity='1'; this.style.transform='scale(1)';">SEND ${sliderDefault.toLocaleString()} COINS</button>
                            </div>
                        </div>
                    </div>

                    <!-- RIGHT: Big image -->
                    <div style="width:260px; flex-shrink:0; background-color:#050510; position:relative; height:300px; border-radius:0 20px 20px 0; overflow:hidden; align-self:stretch;">
                        <img src="${getOptimizedUrl(t.image, 600)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;" onerror="this.src='/queen-karin.png'">
                        <div style="position:absolute; inset:0; background:linear-gradient(to right, rgba(10,10,20,0.6) 0%, transparent 40%); border-radius:0 20px 20px 0;"></div>
                    </div>
                </div>
                `;
            } else {
                return `
                <div class="store-item" style="border-radius:14px; background:#0a0a14; border:1px solid rgba(197,160,89,0.2); cursor:pointer; transition:all 0.3s ease; box-shadow:0 4px 25px rgba(0,0,0,0.5); display:flex; flex-direction:column; padding:16px 14px; gap:10px; box-sizing:border-box;"
                    onmouseover="this.style.boxShadow='0 12px 35px rgba(197,160,89,0.12)'; this.style.borderColor='rgba(197,160,89,0.5)'; this.style.transform='translateY(-4px)';"
                    onmouseout="this.style.boxShadow='0 4px 25px rgba(0,0,0,0.5)'; this.style.borderColor='rgba(197,160,89,0.2)'; this.style.transform='translateY(0)';">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <i class="fas fa-coins" style="color:#c5a059; font-size:0.65rem;"></i>
                        <span style="font-family:'Orbitron', sans-serif; font-size:0.7rem; color:#c5a059; font-weight:700; letter-spacing:1px;">${t.price.toLocaleString()}</span>
                    </div>
                    <div style="font-family:'Orbitron', sans-serif; font-size:0.8rem; color:#fff; font-weight:700; letter-spacing:1px; text-transform:uppercase; line-height:1.3; flex:1;">${t.title}</div>
                    <button onclick="event.stopPropagation(); window.buyTribute('${t.id}', '${t.title}', ${t.price})"
                        style="width:100%; background:linear-gradient(135deg, #c5a059 0%, #8b6914 100%); color:#000; border:none; padding:10px 0; border-radius:7px; font-family:'Orbitron', sans-serif; font-size:0.55rem; font-weight:700; letter-spacing:2px; cursor:pointer; transition:all 0.2s;"
                        onmouseover="this.style.opacity='0.85';"
                        onmouseout="this.style.opacity='1';">SEND GIFT</button>
                </div>
                `;
            }
        }).join('');
    };

    if (gridDesk) renderGrid(gridDesk);
    if (gridMob) renderGridMobile(gridMob);
}

function renderGridMobile(gridEl: HTMLElement) {
    if (!gridEl) return;
    console.log('[TRIBUTE] renderGridMobile called, items:', globalTributes.length, globalTributes.map(t => ({ id: t.id, title: t.title, price: t.price, image: t.image?.slice(0, 60) })));
    const walletForSlider = getState()?.wallet || 0;

    // Set the grid container itself
    gridEl.style.cssText = ''; // reset any previous inline styles
    gridEl.style.display = 'grid';
    gridEl.style.gridTemplateColumns = '1fr 1fr';
    gridEl.style.gap = '10px';
    gridEl.style.padding = '12px 10px 24px';
    gridEl.style.overflowY = 'auto';
    gridEl.style.flex = '1';
    gridEl.style.alignContent = 'start';

    gridEl.innerHTML = globalTributes.map(t => {
        const img = getOptimizedUrl(t.image, 400) || '';

        if (t.is_crowdfund) {
            const goal = t.goal_amount || 1;
            const raised = t.raised_amount || 0;
            const pct = Math.min(100, Math.round((raised / goal) * 100));
            const remaining = Math.max(10, goal - raised);
            const sliderMax = Math.min(walletForSlider > 0 ? walletForSlider : remaining, remaining);
            const sliderDefault = Math.min(200, sliderMax);

            return `
            <div style="grid-column:span 2; border-radius:14px; overflow:hidden; background:#0a0a14; border:1px solid rgba(197,160,89,0.25); box-shadow:0 4px 20px rgba(0,0,0,0.5);">
                <div style="width:100%; height:130px; background-color:#050510; position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center;">
                    <img src="${img}" style="width:100%; height:100%; object-fit:contain;" onerror="this.src='/queen-karin.png'">
                </div>
                <div style="padding:14px; display:flex; flex-direction:column; gap:10px;">
                    <div style="font-family:'Orbitron',sans-serif; font-size:1rem; color:#fff; font-weight:700; letter-spacing:1px; text-transform:uppercase;">${t.title}</div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-family:'Orbitron',sans-serif; font-size:0.75rem; color:#c5a059; font-weight:700;">${raised.toLocaleString()}</span>
                        <span style="font-family:'Orbitron',sans-serif; font-size:0.6rem; color:rgba(255,255,255,0.3);">/ ${goal.toLocaleString()}</span>
                        <i class="fas fa-coins" style="color:#c5a059; font-size:0.65rem;"></i>
                    </div>
                    <div style="width:100%; height:5px; background:rgba(255,255,255,0.08); border-radius:3px; overflow:hidden;">
                        <div style="height:100%; width:${pct}%; background:linear-gradient(90deg,#c5a059,#f0d080); border-radius:3px;"></div>
                    </div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <input type="range" id="crowdfund_input_${t.id}" min="10" max="${sliderMax}" step="10" value="${sliderDefault}"
                            oninput="window.updateCrowdfundSlider('${t.id}',this.value)"
                            style="flex:1; height:5px; appearance:none; background:rgba(197,160,89,0.2); border-radius:3px; accent-color:#c5a059;" />
                        <button id="crowdfund_btn_${t.id}" onclick="window.contributeCrowdfund('${t.id}','${t.title}')"
                            style="background:linear-gradient(135deg,#c5a059,#8b6914); color:#000; border:none; padding:9px 14px; border-radius:8px; font-family:'Orbitron',sans-serif; font-size:0.5rem; font-weight:700; letter-spacing:1px; cursor:pointer; white-space:nowrap;">
                            SEND <span id="crowdfund_display_${t.id}">${sliderDefault}</span>
                        </button>
                    </div>
                </div>
            </div>`;
        }

        return `
        <div style="border-radius:12px; background:#0a0a14; border:1px solid rgba(197,160,89,0.22); padding:12px; display:flex; flex-direction:column; gap:10px; box-shadow:0 4px 16px rgba(0,0,0,0.4);">
            <div style="display:flex; align-items:center; gap:6px;">
                <i class="fas fa-coins" style="color:#c5a059; font-size:0.55rem;"></i>
                <span style="font-family:'Orbitron',sans-serif; font-size:0.6rem; color:#c5a059; font-weight:700;">${t.price.toLocaleString()}</span>
            </div>
            <div style="font-family:'Orbitron',sans-serif; font-size:0.65rem; color:#fff; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; line-height:1.3;">${t.title}</div>
            <button onclick="event.stopPropagation(); window.buyTribute('${t.id}','${t.title}',${t.price})"
                style="width:100%; background:linear-gradient(135deg,#c5a059,#8b6914); color:#000; border:none; padding:9px 0; border-radius:6px; font-family:'Orbitron',sans-serif; font-size:0.42rem; font-weight:700; letter-spacing:1.5px; cursor:pointer;">
                SEND GIFT
            </button>
        </div>`;
    }).join('');
}

// ─── Instantly update wallet/score DOM elements after any coin spend ────────
export function updateWalletDisplay() {
    const { wallet, score } = getState();
    const w = (wallet || 0).toLocaleString();
    const p = (score || 0).toLocaleString();
    // Update all wallet/score display elements (desktop + mobile)
    document.querySelectorAll('#coins, #mobCoins').forEach(el => { (el as HTMLElement).innerText = w; });
    document.querySelectorAll('#points, #mobPoints').forEach(el => { (el as HTMLElement).innerText = p; });
}

// ─── Gift Toast: warm personal confirmation ────────────────────────────────
function showGiftToast(title: string, amount: number, merit: number) {
    const existing = document.getElementById('giftToast');
    if (existing) existing.remove();

    // Trigger coin shower
    triggerCoinShower();

    const toast = document.createElement('div');
    toast.id = 'giftToast';
    toast.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:14px;">
            <div>
                <div style="font-family:'Orbitron', sans-serif; font-size:0.55rem; color:#c5a059; letter-spacing:3px; text-transform:uppercase; margin-bottom:8px;">✦ Gift Sent</div>
                <div style="font-family:'Orbitron', sans-serif; font-size:1.25rem; color:#fff; font-weight:700; line-height:1.3;">You just gifted<br><span style="color:#c5a059;">${amount.toLocaleString()} coins</span> to Queen Karin</div>
                <div style="font-family:'Orbitron', sans-serif; font-size:0.85rem; color:rgba(255,255,255,0.5); margin-top:4px;">for <em>${title}</em></div>
            </div>
            <div style="font-family:'Orbitron', sans-serif; font-size:0.55rem; color:rgba(255,255,255,0.4); line-height:1.8; border-top:1px solid rgba(197,160,89,0.15); padding-top:12px;">She sees your devotion. Thank you - truly. 🤍<br>+${merit} merit points earned</div>
            <div style="display:flex; gap:10px;">
                <button onclick="document.getElementById('giftToast').remove(); if(window.innerWidth<=768){var ov=document.getElementById('mob_TributeOverlay');if(ov)ov.style.display='none';}" style="flex:1; background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.5); border:1px solid rgba(255,255,255,0.1); padding:10px 0; border-radius:8px; font-family:'Orbitron', sans-serif; font-size:0.55rem; letter-spacing:1px; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)';" onmouseout="this.style.background='rgba(255,255,255,0.06)';">CLOSE</button>
                <button onclick="document.getElementById('giftToast').remove(); window.toggleTributeHuntGlobal && window.toggleTributeHuntGlobal();" style="flex:2; background:linear-gradient(135deg, #c5a059 0%, #8b6914 100%); color:#000; border:none; padding:10px 0; border-radius:8px; font-family:'Orbitron', sans-serif; font-size:0.55rem; font-weight:700; letter-spacing:1px; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.opacity='0.85';" onmouseout="this.style.opacity='1';">SEND MORE ♥</button>
            </div>
        </div>
    `;
    Object.assign(toast.style, {
        position: 'fixed', bottom: '30px', right: '30px', zIndex: '99999',
        background: 'linear-gradient(135deg, #0d0d1f 0%, #1a0a2e 100%)',
        border: '1px solid rgba(197,160,89,0.4)',
        borderRadius: '18px', padding: '24px 28px',
        boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(197,160,89,0.08)',
        width: '460px', maxWidth: 'calc(100vw - 40px)',
        opacity: '0', transform: 'translateY(20px)',
        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
    });
    // Mobile-only overrides: clear footer nav (z-index 9999999, height ~85px)
    if (window.innerWidth <= 768) {
        toast.style.zIndex = '10000000';
        toast.style.bottom = 'calc(85px + env(safe-area-inset-bottom) + 16px)';
        toast.style.right = '12px';
        toast.style.left = '12px';
        toast.style.width = 'auto';
    }
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; });
}

// ─── New Message Banner: slides in when Queen sends a message ───────────────
function showNewMessageBanner(preview: string) {
    const existing = document.getElementById('queenMsgBanner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'queenMsgBanner';
    const escaped = preview.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    banner.innerHTML = `
        <div style="display:flex; align-items:flex-start; gap:14px;">
            <img src="/queen-nav.png" style="flex-shrink:0; width:44px; height:44px; border-radius:50%; object-fit:cover; border:1.5px solid rgba(197,160,89,0.6);" onerror="this.style.display='none'" />
            <div style="flex:1; min-width:0;">
                <div style="font-family:'Orbitron', sans-serif; font-size:0.5rem; color:#c5a059; letter-spacing:3px; text-transform:uppercase; margin-bottom:6px;">✦ New Message</div>
                <div style="font-family:'Orbitron', sans-serif; font-size:1.1rem; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%;">${escaped}</div>
            </div>
        </div>
        <div style="display:flex; gap:8px; margin-top:14px;">
            <button onclick="document.getElementById('queenMsgBanner').remove();" style="flex:1; background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.5); border:1px solid rgba(255,255,255,0.1); padding:9px 0; border-radius:8px; font-family:'Orbitron', sans-serif; font-size:0.5rem; letter-spacing:1px; cursor:pointer;" onmouseover="this.style.background='rgba(255,255,255,0.1)';" onmouseout="this.style.background='rgba(255,255,255,0.06)';">DISMISS</button>
            <button onclick="document.getElementById('queenMsgBanner').remove(); if(typeof window.openMobChatOverlay==='function') window.openMobChatOverlay();" style="flex:2; background:linear-gradient(135deg, #c5a059 0%, #8b6914 100%); color:#000; border:none; padding:9px 0; border-radius:8px; font-family:'Orbitron', sans-serif; font-size:0.5rem; font-weight:700; letter-spacing:1px; cursor:pointer;" onmouseover="this.style.opacity='0.85';" onmouseout="this.style.opacity='1';">OPEN CHAT ♥</button>
        </div>
    `;
    Object.assign(banner.style, {
        position: 'fixed', bottom: '30px', right: '30px', zIndex: '99999',
        background: 'linear-gradient(135deg, #0d0d1f 0%, #1a0a2e 100%)',
        border: '1px solid rgba(197,160,89,0.4)',
        borderRadius: '18px', padding: '20px 22px',
        boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(197,160,89,0.08)',
        width: '400px', maxWidth: 'calc(100vw - 40px)',
        opacity: '0', transform: 'translateY(20px)',
        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
    });
    if (window.innerWidth <= 768) {
        banner.style.zIndex = '10000000';
        banner.style.bottom = 'calc(85px + env(safe-area-inset-bottom) + 16px)';
        banner.style.right = '12px';
        banner.style.left = '12px';
        banner.style.width = 'auto';
    }
    document.body.appendChild(banner);
    requestAnimationFrame(() => { banner.style.opacity = '1'; banner.style.transform = 'translateY(0)'; });
    // Auto-dismiss after 8 seconds
    setTimeout(() => {
        const el = document.getElementById('queenMsgBanner');
        if (el) { el.style.opacity = '0'; el.style.transform = 'translateY(20px)'; setTimeout(() => el.remove(), 400); }
    }, 8000);
}

// ─── Poverty Modal: not enough coins ────────────────────────────────────────
function showPovertyModal(itemTitle: string) {
    const existing = document.getElementById('povertyModal');
    if (existing) existing.remove();

    const isMobile = window.innerWidth <= 768;

    const modal = document.createElement('div');
    modal.id = 'povertyModal';

    if (isMobile) {
        // ── MOBILE: fullscreen overlay appended to body (same pattern as gift toast) ──
        modal.innerHTML = `
            <div style="background:linear-gradient(135deg,#1a0010 0%,#0d0d1f 100%);border:1px solid rgba(255,0,60,0.35);border-radius:20px;padding:36px 28px;max-width:320px;width:100%;display:flex;flex-direction:column;gap:18px;align-items:center;text-align:center;">
                <div style="font-family:'Orbitron',sans-serif;font-size:0.5rem;color:rgba(255,0,60,0.7);letter-spacing:3px;text-transform:uppercase;">⚠ Insufficient Capital</div>
                <h2 style="font-family:'Orbitron',sans-serif;font-size:1.3rem;color:#ff003c;font-weight:700;margin:0;">DENIED</h2>
                <div id="povertyInsultDyn" style="font-family:'Orbitron',sans-serif;color:#ccc;font-size:0.9rem;line-height:1.5;">${itemTitle ? `"You cannot afford my attention."<br><span style="font-size:0.75rem;opacity:0.5;">${itemTitle}</span>` : '"You cannot afford my attention."'}</div>
                <div style="display:flex;gap:10px;width:100%;margin-top:6px;">
                    <button onclick="document.getElementById('povertyModal').remove();var w=document.getElementById('mob_TributeOverlay');if(w)w.style.display='none';" style="flex:1;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);border:1px solid rgba(255,255,255,0.1);padding:12px 0;border-radius:8px;font-family:'Orbitron',sans-serif;font-size:0.5rem;letter-spacing:1px;cursor:pointer;">CLOSE</button>
                    <button onclick="document.getElementById('povertyModal').remove();var w=document.getElementById('mob_TributeOverlay');if(w)w.style.display='none';if(window.goToExchequer)window.goToExchequer();" style="flex:2;background:linear-gradient(135deg,#c5a059 0%,#8b6914 100%);color:#000;border:none;padding:12px 0;border-radius:8px;font-family:'Orbitron',sans-serif;font-size:0.5rem;font-weight:700;letter-spacing:1px;cursor:pointer;">BOOST WALLET</button>
                </div>
            </div>
        `;
        Object.assign(modal.style, {
            position: 'fixed', inset: '0', zIndex: '2147483647',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)',
            padding: '24px',
        });
    } else {
        // ── DESKTOP: floating card bottom-right ──
        modal.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:14px;">
                <div>
                    <div style="font-family:'Orbitron', sans-serif; font-size:0.55rem; color:rgba(255,80,80,0.7); letter-spacing:3px; text-transform:uppercase; margin-bottom:8px;">⚠ Insufficient Coins</div>
                    <div style="font-family:'Orbitron', sans-serif; font-size:1.1rem; color:#fff; font-weight:700; line-height:1.4;">You don't have enough coins<br>to spoil Queen Karin right now.</div>
                    ${itemTitle ? `<div style="font-family:'Orbitron', sans-serif; font-size:0.85rem; color:rgba(255,255,255,0.4); margin-top:4px;"><em>${itemTitle}</em></div>` : ''}
                </div>
                <div style="font-family:'Orbitron', sans-serif; font-size:0.55rem; color:rgba(255,255,255,0.35); line-height:1.8; border-top:1px solid rgba(255,80,80,0.15); padding-top:12px;">She deserves the best. Earn more coins &amp; come back worthy of her attention.</div>
                <div style="display:flex; gap:10px;">
                    <button onclick="document.getElementById('povertyModal').remove()" style="flex:1; background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.5); border:1px solid rgba(255,255,255,0.1); padding:10px 0; border-radius:8px; font-family:'Orbitron', sans-serif; font-size:0.55rem; letter-spacing:1px; cursor:pointer;" onmouseover="this.style.background='rgba(255,255,255,0.1)';" onmouseout="this.style.background='rgba(255,255,255,0.06)';">CLOSE</button>
                    <button onclick="document.getElementById('povertyModal').remove(); document.getElementById('tributeHuntOverlay')?.classList.add('hidden'); if(window.goToExchequer){ window.goToExchequer(); }" style="flex:2; background:linear-gradient(135deg, #c5a059 0%, #8b6914 100%); color:#000; border:none; padding:10px 0; border-radius:8px; font-family:'Orbitron', sans-serif; font-size:0.55rem; font-weight:700; letter-spacing:1px; cursor:pointer;" onmouseover="this.style.opacity='0.85';" onmouseout="this.style.opacity='1';">ADD MORE COINS</button>
                </div>
            </div>
        `;
        Object.assign(modal.style, {
            position: 'fixed', bottom: '30px', right: '30px', zIndex: '99999',
            background: 'linear-gradient(135deg, #1a0a0a 0%, #0d0d1f 100%)',
            border: '1px solid rgba(255,80,80,0.3)',
            borderRadius: '18px', padding: '24px 28px',
            boxShadow: '0 30px 80px rgba(0,0,0,0.7)',
            width: '460px', maxWidth: 'calc(100vw - 40px)',
            opacity: '0', transform: 'translateY(20px)',
            transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        });
    }

    document.body.appendChild(modal);
    if (!isMobile) {
        requestAnimationFrame(() => { modal.style.opacity = '1'; modal.style.transform = 'translateY(0)'; });
    }
}

// Attach the crowdfund function to the global window object so the onclick handlers can find it
if (typeof window !== 'undefined') {
    (window as any).contributeCrowdfund = async function (id: string, title: string) {
        const inputEl = document.getElementById(`crowdfund_input_${id}`) as HTMLInputElement;
        if (!inputEl) return;

        const amount = parseInt(inputEl.value);
        if (isNaN(amount) || amount <= 0) {
            alert("Please enter a valid amount greater than 0.");
            return;
        }

        const { memberId, wallet } = getState();
        if (!memberId) return;

        if (wallet < amount) {
            showPovertyModal(title);
            return;
        }


        try {
            const res = await fetch('/api/tributes/contribute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memberEmail: memberId, tributeId: id, tributeTitle: title, contributionAmount: amount })
            });

            const data = await res.json();

            if (data.success) {
                const { raw } = getState();
                const updatedParams = {
                    ...(raw?.parameters || {}),
                    wishlist_spent: (Number(raw?.parameters?.wishlist_spent) || 0) + amount,
                    last_tribute: { at: new Date().toISOString(), title, amount }
                };
                const updatedRaw = { ...(raw || {}), wallet: data.newWallet, score: data.newScore, parameters: updatedParams, total_coins_spent: (raw?.total_coins_spent || 0) + (amount ?? 0) };
                setState({ wallet: data.newWallet, score: data.newScore, raw: updatedRaw });
                updateWalletDisplay();
                renderProfileSidebar(updatedRaw);

                // Close wishlist overlay
                document.getElementById('tributeHuntOverlay')?.classList.add('hidden');
                document.getElementById('mob_TributeOverlay')?.classList.add('hidden');

                showGiftToast(title, amount, data.meritGained);

                // 4. Send Chat message + immediately inject card into chat
                const tributeObj = globalTributes.find(t => t.id === id);
                const tributeImage = tributeObj?.display_url || tributeObj?.image || "";
                const wishlistMsg = {
                    sender_email: memberId,
                    type: 'wishlist',
                    content: `Contributed ${amount.toLocaleString()} to ${title}`,
                    metadata: { title, price: amount, image: tributeImage, isQueen: false },
                    created_at: new Date().toISOString()
                };
                appendChatCard(wishlistMsg);
                fetch('/api/chat/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ memberId: memberId, content: wishlistMsg.content, type: 'wishlist', metadata: wishlistMsg.metadata })
                }).catch(e => console.warn('[CHAT] Tribute message send failed:', e));

                // Re-fetch tributes to instantly update the progress bar visually
                loadTributes();
            } else {
                if (data.error === 'INSUFFICIENT_FUNDS') {
                    showPovertyModal(title);
                } else {
                    console.error('Contribution failed:', data.error);
                }
            }
        } catch (err) {
            console.error("Contribution error:", err);
        }
    };
}

export async function buyTribute(id: string, title: string, cost: number) {
    const { memberId, wallet } = getState();
    if (!memberId) return;

    if (wallet < cost) {
        showPovertyModal(title);
        return;
    }

    try {
        const res = await fetch('/api/tributes/purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memberEmail: memberId, tributeId: id, tributeTitle: title, tributeCost: cost })
        });

        const data = await res.json();

        if (data.success) {
            const { raw } = getState();
            const updatedParams = {
                ...(raw?.parameters || {}),
                wishlist_spent: (Number(raw?.parameters?.wishlist_spent) || 0) + cost,
                last_tribute: { at: new Date().toISOString(), title, amount: cost }
            };
            const updatedRaw = { ...(raw || {}), wallet: data.newWallet, score: data.newScore, parameters: updatedParams, total_coins_spent: (raw?.total_coins_spent || 0) + (cost ?? 0) };
            setState({ wallet: data.newWallet, score: data.newScore, raw: updatedRaw });
            updateWalletDisplay();
            renderProfileSidebar(updatedRaw);

            // Close wishlist overlay first, then show toast
            document.getElementById('tributeHuntOverlay')?.classList.add('hidden');

            // Show gift toast with coin shower
            showGiftToast(title, cost, data.meritGained);

            // Re-render quick tribute section to update Last Tribute info
            loadTributes();

            // Notify chat with rich card + immediately inject card into chat
            const tributeObj = globalTributes.find(t => t.id === id);
            const tributeImage = tributeObj?.display_url || tributeObj?.image || "";
            const wishlistMsg = {
                sender_email: memberId,
                type: 'wishlist',
                content: `Purchased "${title}"`,
                metadata: { title, price: cost, image: tributeImage, isQueen: false },
                created_at: new Date().toISOString()
            };
            appendChatCard(wishlistMsg);
            fetch('/api/chat/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memberId: memberId, content: wishlistMsg.content, type: 'wishlist', metadata: wishlistMsg.metadata })
            }).catch(e => console.warn('[CHAT] Tribute message send failed:', e));

            // Close modal if open
            document.getElementById('tributeHuntOverlay')?.classList.add('hidden');
        } else {
            console.error("Purchase rejected:", data.error);
            if (data.error === 'INSUFFICIENT_FUNDS') {
                showPovertyModal(title);
            } else {
                alert("Transaction failed: " + data.error);
            }
        }

    } catch (err) {
        console.error("Critical error purchasing tribute", err);
    }
}

// Ensure functions are available globally for inline onclick handlers
if (typeof window !== 'undefined') {
    (window as any).buyTribute = buyTribute;
    (window as any).toggleTributeHuntGlobal = () => toggleTributeHunt();
    (window as any).updateCrowdfundSlider = (id: string, value: string) => {
        const v = Number(value);
        const display = document.getElementById(`crowdfund_display_${id}`);
        const btn = document.getElementById(`crowdfund_btn_${id}`);
        if (display) display.innerHTML = v.toLocaleString() + ' <i class="fas fa-coins" style="font-size:1rem;"></i>';
        if (btn) btn.textContent = 'SEND ' + v.toLocaleString() + ' COINS';
    };
}


export function toggleTributeHunt() {
    const isMobile = window.innerWidth <= 768; // basic mobile check
    if (isMobile) {
        const overlayMob = document.getElementById('mob_TributeOverlay');
        if (overlayMob) {
            if (overlayMob.style.display === 'none' || overlayMob.classList.contains('hidden')) {
                overlayMob.style.display = 'flex';
                overlayMob.classList.remove('hidden');
                // Always re-render grid so it's never stale
                const gridMob = document.getElementById('mob_huntStoreGrid');
                console.log('[TRIBUTE] Opening mobile store. Items:', globalTributes.length, 'Grid el:', !!gridMob);
                if (gridMob) renderGridMobile(gridMob);
            } else {
                overlayMob.style.display = 'none';
            }
        }
    } else {
        const overlayDesk = document.getElementById('tributeHuntOverlay');
        if (overlayDesk) {
            if (overlayDesk.style.display === 'none' || overlayDesk.classList.contains('hidden')) {
                overlayDesk.style.display = 'flex';
                overlayDesk.classList.remove('hidden');
            } else {
                overlayDesk.style.display = 'none';
            }
        }
    }
}

export function openLobby() {
    const el = document.getElementById('lobbyOverlay');
    if (!el) return;
    el.classList.remove('hidden');
    el.style.display = 'flex';
    const { memberId, id } = getState();
    const emailEl = document.getElementById('hubEmail');
    if (emailEl) emailEl.textContent = memberId || id || '';
    _updateNotifToggleUI();
}

export function closeLobby() {
    const el = document.getElementById('lobbyOverlay');
    if (!el) return;
    el.classList.add('hidden');
    el.style.display = 'none';
}

let taskInterval: any = null;

export function startTaskTimer(ms: number) {
    if (taskInterval) clearInterval(taskInterval);

    const updateUI = (totalMs: number) => {
        const h = Math.floor(totalMs / (1000 * 60 * 60));
        const m = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((totalMs % (1000 * 60)) / 1000);
        const hStr = String(h).padStart(2, '0');
        const mStr = String(m).padStart(2, '0');
        const sStr = String(s).padStart(2, '0');

        // Desktop
        const hrs = document.getElementById('timerH');
        const mins = document.getElementById('timerM');
        const secs = document.getElementById('timerS');
        if (hrs) hrs.innerText = hStr;
        if (mins) mins.innerText = mStr;
        if (secs) secs.innerText = sStr;

        // Mobile (QM)
        const qmHrs = document.getElementById('qm_timerH');
        const qmMins = document.getElementById('qm_timerM');
        const qmSecs = document.getElementById('qm_timerS');
        if (qmHrs) qmHrs.innerText = hStr;
        if (qmMins) qmMins.innerText = mStr;
        if (qmSecs) qmSecs.innerText = sStr;
    };

    let remaining = ms;
    updateUI(remaining);

    taskInterval = setInterval(() => {
        remaining -= 1000;
        if (remaining <= 0) {
            clearInterval(taskInterval);
            remaining = 0;
            const mainArea = document.getElementById('mainButtonsArea');
            const activeArea = document.getElementById('activeTaskContent');
            const readyText = document.getElementById('readyText');
            const qmIdle = document.getElementById('qm_TaskIdle');
            const qmActive = document.getElementById('qm_TaskActive');
            const mobTaskText = document.getElementById('mobTaskText');

            if (mainArea) mainArea.style.display = 'flex';
            if (activeArea) activeArea.classList.add('hidden');
            if (readyText) readyText.innerText = '-';
            if (qmIdle) qmIdle.classList.remove('hidden');
            if (qmActive) qmActive.classList.add('hidden');
            if (mobTaskText) mobTaskText.innerText = '-';
        }
        updateUI(remaining);
    }, 1000);
}

export function resetTaskUI() {
    if (taskInterval) clearInterval(taskInterval);
    taskInterval = null;

    const mainArea = document.getElementById('mainButtonsArea');
    const activeArea = document.getElementById('activeTaskContent');
    const readyText = document.getElementById('readyText');
    const qmIdle = document.getElementById('qm_TaskIdle');
    const qmActive = document.getElementById('qm_TaskActive');
    const mobTaskText = document.getElementById('mobTaskText');

    // Restore hidden stuff
    const uploadCont = document.getElementById('uploadBtnContainer');
    const mobUploadCont = document.getElementById('mobUploadBtnContainer');
    const skipConfirmCont = document.getElementById('skipConfirmContainer');
    const mobSkipConfirmCont = document.getElementById('mobSkipConfirmContainer');
    const dismissTaskCont = document.getElementById('dismissTaskContainer');
    const mobDismissTaskCont = document.getElementById('mobDismissContainer');
    const activeTimerRow = document.getElementById('activeTimerRow');

    if (uploadCont) uploadCont.style.display = 'flex';
    if (mobUploadCont) mobUploadCont.style.display = 'flex';
    if (skipConfirmCont) skipConfirmCont.style.display = 'none';
    if (mobSkipConfirmCont) mobSkipConfirmCont.style.display = 'none';
    if (dismissTaskCont) dismissTaskCont.style.display = 'none';
    if (mobDismissTaskCont) mobDismissTaskCont.style.display = 'none';
    if (activeTimerRow) { activeTimerRow.style.display = 'flex'; activeTimerRow.style.opacity = '1'; }

    const rb = document.getElementById('requestWarningBox');
    const mrb = document.getElementById('mobRequestWarningBox');
    const sBox = document.getElementById('skipWarningBox');
    const msBox = document.getElementById('mobSkipWarningBox');
    if (rb) rb.style.display = 'none';
    if (mrb) mrb.style.display = 'none';
    if (sBox) sBox.style.display = 'none';
    if (msBox) msBox.style.display = 'none';

    const btn1 = document.getElementById('newTaskBtn');
    const btn2 = document.getElementById('mobNewTaskBtn');
    if (btn1) btn1.style.display = '';
    if (btn2) btn2.style.display = '';
    const idle = document.getElementById('idleMessage');
    if (idle) idle.style.display = '';

    if (mainArea) mainArea.style.display = 'flex';
    if (activeArea) {
        activeArea.classList.add('hidden');
        activeArea.style.display = 'none';
    }
    if (readyText) {
        readyText.innerText = '-';
        readyText.style.color = 'white';
    }
    if (qmIdle) {
        qmIdle.classList.remove('hidden');
        qmIdle.style.display = 'block';
    }
    if (qmActive) {
        qmActive.classList.add('hidden');
        qmActive.style.display = 'none';
    }
    if (mobTaskText) {
        mobTaskText.innerText = '-';
        mobTaskText.style.color = 'white';
    }
}

function showTaskFeedback(message: string, color: string) {
    if (taskInterval) clearInterval(taskInterval); // Stop timer immediately
    taskInterval = null;

    const readyText = document.getElementById('readyText');
    const mobTaskText = document.getElementById('mobTaskText');
    const uploadCont = document.getElementById('uploadBtnContainer');
    const mobUploadCont = document.getElementById('mobUploadBtnContainer');
    const skipConfirmCont = document.getElementById('skipConfirmContainer');
    const mobSkipConfirmCont = document.getElementById('mobSkipConfirmContainer');
    const dismissTaskCont = document.getElementById('dismissTaskContainer');
    const mobDismissTaskCont = document.getElementById('mobDismissContainer');
    const activeTimerRow = document.getElementById('activeTimerRow');
    const mobActiveTimerRow = document.querySelector('#qm_TaskActive .card-timer-row') as HTMLElement;

    if (uploadCont) uploadCont.style.display = 'none';
    if (mobUploadCont) mobUploadCont.style.display = 'none';
    if (skipConfirmCont) skipConfirmCont.style.display = 'none';
    if (mobSkipConfirmCont) mobSkipConfirmCont.style.display = 'none';
    if (activeTimerRow) { activeTimerRow.style.opacity = '0'; activeTimerRow.style.pointerEvents = 'none'; }
    if (mobActiveTimerRow) { mobActiveTimerRow.style.opacity = '0'; mobActiveTimerRow.style.pointerEvents = 'none'; }

    if (dismissTaskCont) dismissTaskCont.style.display = 'flex';
    if (mobDismissTaskCont) mobDismissTaskCont.style.display = 'flex';

    if (readyText) {
        readyText.innerText = message;
        readyText.style.color = color;
    }
    if (mobTaskText) {
        mobTaskText.innerText = message;
        mobTaskText.style.color = color;
    }
}

export async function getRandomTask(isSilentInit = false) {
    const { id, memberId, wallet } = getState();
    const pid = memberId || id;
    if (!pid) return;

    if (!isSilentInit && (wallet || 0) < 300) {
        const rBox = document.getElementById('requestWarningBox');
        const mrBox = document.getElementById('mobRequestWarningBox');
        if (rBox) rBox.style.display = 'flex';
        if (mrBox) mrBox.style.display = 'flex';

        const btn1 = document.getElementById('newTaskBtn');
        const btn2 = document.getElementById('mobNewTaskBtn');
        if (btn1) btn1.style.display = 'none';
        if (btn2) btn2.style.display = 'none';

        const idle = document.getElementById('idleMessage');
        if (idle) idle.style.display = 'none';
        return;
    }

    try {
        console.log("Requesting task...");
        const rb = document.getElementById('requestWarningBox');
        const mrb = document.getElementById('mobRequestWarningBox');
        if (rb) rb.style.display = 'none';
        if (mrb) mrb.style.display = 'none';

        const mainArea = document.getElementById('mainButtonsArea');
        const activeArea = document.getElementById('activeTaskContent');
        const readyText = document.getElementById('readyText');
        const uploadCont = document.getElementById('uploadBtnContainer');
        const qmIdle = document.getElementById('qm_TaskIdle');
        const qmActive = document.getElementById('qm_TaskActive');
        const mobTaskText = document.getElementById('mobTaskText');

        if (!isSilentInit) {
            if (mainArea) mainArea.style.display = 'none';
            if (activeArea) {
                activeArea.classList.remove('hidden');
                activeArea.style.display = 'flex';
            }
            if (readyText) readyText.innerHTML = '<div style="margin-bottom: 10px;">CONNECTING TO QUEEN KARIN...</div><div class="spinner" style="font-size: 2rem; color: #c5a059;"><i class="fas fa-circle-notch fa-spin"></i></div>';
            if (qmIdle) qmIdle.classList.add('hidden');
            if (qmActive) { qmActive.classList.remove('hidden'); qmActive.style.display = 'block'; }
            if (mobTaskText) mobTaskText.innerHTML = '<div style="margin-bottom: 10px;">TRANSMITTING ORDERS...</div><div class="spinner" style="font-size: 2rem; color: #c5a059;"><i class="fas fa-circle-notch fa-spin"></i></div>';
            if (uploadCont) uploadCont.style.display = 'none';

            const activeTimerRow = document.getElementById('activeTimerRow');
            const mobActiveTimerRow = document.querySelector('#qm_TaskActive .card-timer-row') as HTMLElement;
            if (activeTimerRow) activeTimerRow.style.display = 'none';
            if (mobActiveTimerRow) mobActiveTimerRow.style.display = 'none';
        }

        const forceNew = !isSilentInit;
        const res = await fetch(`/api/tasks/random?memberEmail=${encodeURIComponent(pid)}&forceNew=${forceNew}`);
        const data = await res.json();

        if (!data.success) {
            if (isSilentInit) return;
            console.error("Task API Error:", data.error);
            if (readyText) readyText.innerText = 'Failed to retrieve task.';
            return;
        }

        if (!data.task) {
            resetTaskUI();
            return;
        }

        if (mainArea) mainArea.style.display = 'none';
        if (activeArea) { activeArea.classList.remove('hidden'); activeArea.style.display = 'flex'; }
        if (uploadCont) { uploadCont.classList.remove('hidden'); uploadCont.style.display = 'flex'; }
        if (qmIdle) qmIdle.classList.add('hidden');
        if (qmActive) { qmActive.classList.remove('hidden'); qmActive.style.display = 'block'; }

        const taskMsg = data.task.TaskText || data.task.tasktext || 'Perform the assigned duty.';
        if (readyText) readyText.innerHTML = taskMsg;
        if (mobTaskText) mobTaskText.innerHTML = taskMsg;

        const activeTimerRow = document.getElementById('activeTimerRow');
        const mobActiveTimerRow = document.querySelector('#qm_TaskActive .card-timer-row') as HTMLElement;
        if (activeTimerRow) activeTimerRow.style.display = 'flex';
        if (mobActiveTimerRow) mobActiveTimerRow.style.display = 'flex';

        const timeLeftMs = data.timeLeftMs || (24 * 60 * 60 * 1000);
        startTaskTimer(timeLeftMs);

    } catch (err) {
        console.error("Error getting task", err);
    }
}

export async function skipTask() {
    const { id, memberId, wallet } = getState();
    const pid = memberId || id;
    if (!pid) return;

    if ((wallet || 0) < 300) {
        const sBox = document.getElementById('skipWarningBox');
        const msBox = document.getElementById('mobSkipWarningBox');
        if (sBox) sBox.style.display = 'flex';
        if (msBox) msBox.style.display = 'flex';
        const uploadCont = document.getElementById('uploadBtnContainer');
        const mobUploadCont = document.getElementById('mobUploadBtnContainer');
        if (uploadCont) uploadCont.style.display = 'none';
        if (mobUploadCont) mobUploadCont.style.display = 'none';
        return;
    }

    const readyText = document.getElementById('readyText');
    const mobTaskText = document.getElementById('mobTaskText');

    const uploadCont = document.getElementById('uploadBtnContainer');
    const mobUploadCont = document.getElementById('mobUploadBtnContainer');
    const skipConfirmCont = document.getElementById('skipConfirmContainer');
    const mobSkipConfirmCont = document.getElementById('mobSkipConfirmContainer');

    if (uploadCont) uploadCont.style.display = 'none';
    if (mobUploadCont) mobUploadCont.style.display = 'none';
    if (skipConfirmCont) skipConfirmCont.style.display = 'flex';
    if (mobSkipConfirmCont) mobSkipConfirmCont.style.display = 'flex';

    if (readyText) {
        // readyText.innerText = "Are you sure you wish to skip this duty for 300 coins?"; 
        readyText.style.opacity = '0.3';
    }
    if (mobTaskText) {
        // mobTaskText.innerText = "Are you sure you wish to skip this duty for 300 coins?"; 
        mobTaskText.style.opacity = '0.3';
    }
}

export function cancelSkipTask() {
    const uploadCont = document.getElementById('uploadBtnContainer');
    const mobUploadCont = document.getElementById('mobUploadBtnContainer');
    const skipConfirmCont = document.getElementById('skipConfirmContainer');
    const mobSkipConfirmCont = document.getElementById('mobSkipConfirmContainer');
    const readyText = document.getElementById('readyText') as HTMLElement;
    const mobTaskText = document.getElementById('mobTaskText') as HTMLElement;

    if (uploadCont) uploadCont.style.display = 'flex';
    if (mobUploadCont) mobUploadCont.style.display = 'flex';
    if (skipConfirmCont) skipConfirmCont.style.display = 'none';
    if (mobSkipConfirmCont) mobSkipConfirmCont.style.display = 'none';

    const sBox = document.getElementById('skipWarningBox');
    const msBox = document.getElementById('mobSkipWarningBox');
    if (sBox) sBox.style.display = 'none';
    if (msBox) msBox.style.display = 'none';

    // Restore opacity only - task text is still in the element from when it was displayed
    if (readyText) { readyText.style.color = 'white'; readyText.style.opacity = '1'; }
    if (mobTaskText) { mobTaskText.style.color = 'white'; mobTaskText.style.opacity = '1'; }
}

export function cancelSkipWarning() {
    const sBox = document.getElementById('skipWarningBox');
    const msBox = document.getElementById('mobSkipWarningBox');
    if (sBox) sBox.style.display = 'none';
    if (msBox) msBox.style.display = 'none';

    const uploadCont = document.getElementById('uploadBtnContainer');
    const mobUploadCont = document.getElementById('mobUploadBtnContainer');
    if (uploadCont) uploadCont.style.display = 'flex';
    if (mobUploadCont) mobUploadCont.style.display = 'flex';
}

export function cancelRequestWarning() {
    const rBox = document.getElementById('requestWarningBox');
    const mrBox = document.getElementById('mobRequestWarningBox');
    if (rBox) rBox.style.display = 'none';
    if (mrBox) mrBox.style.display = 'none';

    const btn1 = document.getElementById('newTaskBtn');
    const btn2 = document.getElementById('mobNewTaskBtn');
    if (btn1) btn1.style.display = '';
    if (btn2) btn2.style.display = '';

    const idle = document.getElementById('idleMessage');
    if (idle) idle.style.display = '';
}

export async function executeSkipTask() {
    const { id, memberId, wallet } = getState();
    const pid = memberId || id;
    if (!pid) return;

    if ((wallet || 0) < 300) {
        cancelSkipTask();
        const sBox = document.getElementById('skipWarningBox');
        const msBox = document.getElementById('mobSkipWarningBox');
        if (sBox) sBox.style.display = 'flex';
        if (msBox) msBox.style.display = 'flex';
        const uploadCont = document.getElementById('uploadBtnContainer');
        const mobUploadCont = document.getElementById('mobUploadBtnContainer');
        if (uploadCont) uploadCont.style.display = 'none';
        if (mobUploadCont) mobUploadCont.style.display = 'none';
        return;
    }

    const skipConfirmCont = document.getElementById('skipConfirmContainer');
    const mobSkipConfirmCont = document.getElementById('mobSkipConfirmContainer');
    if (skipConfirmCont) skipConfirmCont.style.display = 'none';
    if (mobSkipConfirmCont) mobSkipConfirmCont.style.display = 'none';

    if (taskInterval) { clearInterval(taskInterval); taskInterval = null; }
    const activeTimerRow = document.getElementById('activeTimerRow');
    const mobActiveTimerRow = document.querySelector('#qm_TaskActive .card-timer-row') as HTMLElement;
    if (activeTimerRow) activeTimerRow.style.display = 'none';
    if (mobActiveTimerRow) mobActiveTimerRow.style.display = 'none';

    const readyText = document.getElementById('readyText');
    const mobTaskText = document.getElementById('mobTaskText');
    if (readyText) {
        readyText.innerHTML = '<div style="margin-bottom: 10px;">SUBMITTING REQUEST...</div><div class="spinner" style="font-size: 2rem; color: #c5a059;"><i class="fas fa-circle-notch fa-spin"></i></div>';
        readyText.style.color = '#c5a059';
        readyText.style.opacity = '1';
    }
    if (mobTaskText) {
        mobTaskText.innerHTML = '<div style="margin-bottom: 10px;">SUBMITTING REQUEST...</div><div class="spinner" style="font-size: 2rem; color: #c5a059;"><i class="fas fa-circle-notch fa-spin"></i></div>';
        mobTaskText.style.color = '#c5a059';
        mobTaskText.style.opacity = '1';
    }

    try {
        const res = await fetch('/api/tasks/skip', {
            method: 'POST',
            body: JSON.stringify({ memberId: pid })
        });
        const data = await res.json();

        if (data.success) {
            setState({ wallet: data.newWallet });
            renderProfileSidebar(getState().raw || getState());

            // Force active UI updates immediately
            const w1 = document.getElementById('coins');
            const w2 = document.getElementById('mob_coins');
            if (w1) w1.innerText = (data.newWallet || 0).toLocaleString();
            if (w2) w2.innerText = (data.newWallet || 0).toLocaleString();

            if (taskInterval) clearInterval(taskInterval);

            const mockeries = [
                "Pathetic. 300 coins deducted for your cowardice.",
                "Too weak? 300 coins gone.",
                "Another failure. -300 coins.",
                "Your incompetence is expensive.",
                "Skipping again? How utterly useless."
            ];
            const msg = mockeries[Math.floor(Math.random() * mockeries.length)];
            showTaskFeedback(msg, 'var(--red)');
            loadChatHistory(pid);
        } else {
            cancelSkipTask();
            const sBox = document.getElementById('skipWarningBox');
            const msBox = document.getElementById('mobSkipWarningBox');
            const msg = "INSUFFICIENT CAPITAL<br/><span style='font-size:0.6rem;color:#ccc;'>VISIT THE EXCHEQUER OR SERVE</span>";
            if (sBox) { sBox.innerHTML = msg; sBox.style.display = 'block'; }
            if (msBox) { msBox.innerHTML = msg; msBox.style.display = 'block'; }
        }
    } catch (err) {
        console.error("Error skipping task", err);
        cancelSkipTask();
    }
}

export function openQueenMenu() {
    const el = document.getElementById('queenOverlay');
    if (!el) return;
    el.classList.remove('hidden');
    el.style.display = 'flex';
    const { memberId, id } = getState();
    const diagUser = document.getElementById('diagUserEmail');
    if (diagUser) diagUser.textContent = `SESSION: ${memberId || id || '-'}`;
    const diagSync = document.getElementById('diagSyncTime');
    if (diagSync) diagSync.textContent = `LAST SYNC: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function closeQueenMenu() {
    const el = document.getElementById('queenOverlay');
    if (!el) return;
    el.classList.add('hidden');
    el.style.display = 'none';
}

export function toggleMobileStats() {
    const content = document.getElementById('mobStatsContent');
    const arrow = document.getElementById('mobStatsArrow');
    if (content) {
        const isOpen = content.classList.toggle('open');
        if (arrow) arrow.innerText = isOpen ? '▲' : '▼';
    }
}

export function toggleMobileChat(show: boolean) {
    if (show) {
        document.getElementById('inlineChatPanel')?.classList.remove('hidden');
        document.getElementById('btnEnterChatPanel')?.classList.add('hidden');
    } else {
        document.getElementById('inlineChatPanel')?.classList.add('hidden');
        document.getElementById('btnEnterChatPanel')?.classList.remove('hidden');
    }
}

export function mobileRequestTask() { getRandomTask(); }
export function mobileSkipTask() { skipTask(); }
export function mobileUploadEvidence(input: HTMLInputElement) {
    if (input.files && input.files[0]) {
        submitTaskEvidence(input.files[0], false);
        input.value = '';
    }
}

// ─── DAILY ROUTINE WIDGET ───────────────────────────────────────────────────
export async function updateRoutineWidget() {
    const { memberId, id } = getState();
    const userId = memberId || id;
    if (!userId) return;

    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const res = await fetch('/api/routine-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId: userId, tz }) });
        if (!res.ok) return;
        const data = await res.json();

        const display = document.getElementById('deskRoutineDisplay');
        const mobDisplay = document.getElementById('mobRoutineDisplay'); // mobile routine name display
        const btn = document.getElementById('deskRoutineActionBtn') as HTMLButtonElement | null;
        const timeMsg = document.getElementById('deskRoutineTimeMsg');

        // Mobile equivalents
        const mobBtn = document.getElementById('btnRoutineUpload') as HTMLButtonElement | null;
        const mobDone = document.getElementById('routineDoneMsg');
        const mobTime = document.getElementById('routineTimeMsg');

        // iOS-safe routine upload: create input dynamically so .click() fires
        // synchronously within the user gesture (same fix as profile photo)
        const triggerRoutineFilePick = () => {
            const inp = document.createElement('input');
            inp.type = 'file';
            inp.accept = 'image/*,video/*';
            inp.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1;';
            document.body.appendChild(inp);
            inp.onchange = () => {
                document.body.removeChild(inp);
                if (inp.files?.[0]) handleRoutineUpload(inp);
            };
            inp.click();
        };

        if (!data.routine) {
            // ── State 1: No routine set ─────────────────────────────────────
            if (display) display.textContent = 'No routine set yet';
            if (mobDisplay) mobDisplay.textContent = 'No routine set';
            if (btn) {
                btn.textContent = 'SET A ROUTINE';
                btn.style.background = 'linear-gradient(135deg, #c5a059 0%, #8b6914 100%)';
                btn.style.opacity = '1';
                (window as any).__routineAction = () => {
                    const raw = (window as any).__currentProfileRaw || getState().raw || getState();
                    const existingVal = raw?.routine || '';
                    openTextFieldModal('routine', 'ROUTINE', existingVal);
                };
            }
            if (mobBtn) { mobBtn.textContent = 'SET A ROUTINE'; mobBtn.style.opacity = '1'; mobBtn.style.cursor = 'pointer'; mobBtn.onclick = () => (window as any).__routineAction?.(); }
            if (timeMsg) { timeMsg.classList.add('hidden'); }
        } else if (data.uploadedToday && data.todayStatus === 'pending') {
            // ── State 3a: Uploaded today, Pending Approval ──────────────────
            if (display) display.textContent = 'PENDING APPROVAL';
            if (mobDisplay) mobDisplay.textContent = data.routine;
            if (btn) {
                btn.textContent = '✔ SUBMITTED';
                btn.style.background = 'linear-gradient(135deg, #1a2a1a 0%, #0d1a0d 100%)';
                btn.style.opacity = '0.7';
                btn.style.cursor = 'default';
                (window as any).__routineAction = () => { };
            }
            if (timeMsg) timeMsg.classList.add('hidden');
            if (mobBtn) { mobBtn.textContent = '✔ SUBMITTED'; mobBtn.style.opacity = '0.6'; mobBtn.style.cursor = 'default'; mobBtn.onclick = null; }
            if (mobDone) mobDone.classList.remove('hidden');
            if (mobTime) mobTime.classList.add('hidden');
        } else if (data.uploadedToday && data.todayStatus === 'approved') {
            // ── State 3b: Uploaded today, Approved ───────────────────────────
            if (display) display.textContent = data.routine;
            if (mobDisplay) mobDisplay.textContent = data.routine;
            if (btn) {
                btn.innerHTML = 'ROUTINE DONE<br><span style="font-size:0.55rem;opacity:0.7;letter-spacing:1px;">NEXT CHECK: 6AM</span>';
                btn.style.background = 'linear-gradient(135deg, #0d1a0d 0%, #1a2a1a 100%)';
                btn.style.opacity = '0.75';
                btn.style.cursor = 'default';
                (window as any).__routineAction = () => { };
            }
            if (timeMsg) timeMsg.classList.add('hidden');
            if (mobBtn) { mobBtn.textContent = 'ROUTINE DONE - NEXT: 6AM'; mobBtn.style.opacity = '0.6'; mobBtn.style.cursor = 'default'; mobBtn.onclick = null; }
            if (mobDone) mobDone.classList.remove('hidden');
            if (mobTime) mobTime.classList.add('hidden');
        } else {
            // ── State 2: Routine set, not uploaded today ────────────────────
            if (display) display.textContent = data.routine;
            if (mobDisplay) mobDisplay.textContent = data.routine;
            if (btn) {
                btn.textContent = 'UPLOAD ROUTINE';
                btn.style.background = 'linear-gradient(135deg, #c5a059 0%, #8b6914 100%)';
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
                (window as any).__routineAction = triggerRoutineFilePick;
            }
            // iOS-safe: use dynamic input instead of clicking hidden input
            if (mobBtn) { mobBtn.textContent = 'UPLOAD ROUTINE'; mobBtn.style.opacity = '1'; mobBtn.style.cursor = 'pointer'; mobBtn.onclick = triggerRoutineFilePick; }
            if (mobDone) mobDone.classList.add('hidden');
            if (timeMsg) timeMsg.classList.add('hidden');
        }

        console.log(`[ROUTINE] routine=${!!data.routine}, uploadedToday=${data.uploadedToday}`);
    } catch (err) {
        console.warn('[ROUTINE] Widget update failed:', err);
    }
}

export function handleRoutineUpload(input: HTMLInputElement) {
    if (input.files && input.files[0]) {
        submitTaskEvidence(input.files[0], true).then((success) => {
            if (!success) return;  // Don't lock UI if upload failed
            const display = document.getElementById('deskRoutineDisplay');
            const mobDisplay = document.getElementById('mobRoutineDisplay');
            const btn = document.getElementById('deskRoutineActionBtn') as HTMLButtonElement | null;
            const timeMsg = document.getElementById('deskRoutineTimeMsg');
            const mobBtn = document.getElementById('btnRoutineUpload') as HTMLButtonElement | null;
            const mobDone = document.getElementById('routineDoneMsg');
            const mobTime = document.getElementById('routineTimeMsg');
            if (display) display.textContent = 'PENDING APPROVAL';
            if (mobDisplay) mobDisplay.textContent = 'PENDING APPROVAL';
            if (btn) { btn.textContent = '✔ SUBMITTED'; btn.style.opacity = '0.7'; btn.style.cursor = 'default'; btn.disabled = true; (window as any).__routineAction = () => { }; }
            if (timeMsg) { timeMsg.textContent = 'AWAITING REVIEW'; timeMsg.classList.remove('hidden'); }
            if (mobBtn) { mobBtn.textContent = '✔ SUBMITTED'; mobBtn.style.opacity = '0.6'; mobBtn.style.cursor = 'default'; mobBtn.onclick = null; mobBtn.disabled = true; }
            if (mobDone) mobDone.classList.remove('hidden');
            if (mobTime) { mobTime.textContent = 'AWAITING REVIEW'; mobTime.classList.remove('hidden'); }
        });
    }
}

export function handleTaskEvidenceUpload(input: HTMLInputElement) {
    if (input.files && input.files[0]) {
        submitTaskEvidence(input.files[0], false);
        input.value = '';
    }
}

// iOS-safe task evidence picker - dynamic input avoids hidden-element click restriction
function showUploadNotice(html: string) {
    ['uploadNoticeDesk', 'uploadNoticeMob'].forEach(id => document.getElementById(id)?.remove());
    const makeNotice = (id: string, anchorId: string) => {
        const el = document.createElement('div');
        el.id = id;
        el.style.cssText = 'margin:10px 0;text-align:center;';
        el.innerHTML = html;
        const anchor = document.getElementById(anchorId);
        if (anchor?.parentNode) anchor.parentNode.insertBefore(el, anchor);
    };
    makeNotice('uploadNoticeDesk', 'uploadBtnContainer');
    makeNotice('uploadNoticeMob', 'mobUploadBtnContainer');
    (window as any)._clearUploadNotice = clearUploadNotice;
}

function clearUploadNotice() {
    ['uploadNoticeDesk', 'uploadNoticeMob'].forEach(id => document.getElementById(id)?.remove());
}

export function triggerTaskEvidencePick() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*,video/*';
    inp.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1;';
    document.body.appendChild(inp);
    inp.onchange = async () => {
        document.body.removeChild(inp);
        const file = inp.files?.[0];
        if (!file) return;
        // Pre-check video duration before wasting time uploading
        if (isVideo(file)) {
            const duration = await getVideoDuration(file);
            if (duration > 120) {
                const mins = Math.floor(duration / 60);
                const secs = Math.round(duration % 60);
                showUploadNotice(`<div style="font-family:'Orbitron';font-size:0.7rem;color:var(--red);letter-spacing:2px;margin-bottom:6px;">VIDEO TOO LONG</div><div style="font-family:'Rajdhani';font-size:0.9rem;color:rgba(255,255,255,0.6);margin-bottom:12px;">Your video is ${mins}m ${secs}s - maximum is 2 minutes.<br>Please trim it and try again.</div><div style="display:flex;gap:10px;justify-content:center;"><button onclick="window._clearUploadNotice()" style="padding:8px 18px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.7);font-family:'Orbitron';font-size:0.45rem;cursor:pointer;border-radius:6px;letter-spacing:1px;">DISMISS</button></div>`);
                return;
            }
        }
        submitTaskEvidence(file, false);
    };
    inp.click();
}

async function submitTaskEvidence(file: File, isRoutine: boolean = false): Promise<boolean> {
    const { id, memberId, userName } = getState();
    const pid = memberId || id;
    console.log("Starting task submission for:", pid, "File:", file.name, "Size:", file.size, "Routine:", isRoutine);

    if (!pid) {
        console.error("No memberId found in state during submission.");
        alert("Verification failed. Please refresh the page.");
        return false;
    }

    // Capture task text from UI
    const taskText = document.getElementById('readyText')?.innerHTML || "Mandatory Task";
    console.log("Task Text for submission:", taskText);

    // UI Feedback - routine and task buttons are separate
    const uploadBtn = document.getElementById('uploadBtn');        // Desktop Task
    const mobTaskBtn = document.getElementById('mobBtnUpload');    // Mobile Task
    const mobRoutineBtn = document.getElementById('btnRoutineUpload') as HTMLButtonElement | null; // Mobile Routine

    const originalText = uploadBtn?.innerText;
    const originalMobTaskText = mobTaskBtn?.innerText;
    const originalMobRoutineText = mobRoutineBtn?.innerText;

    // Routine UI feedback
    if (isRoutine) {
        const deskRoutineBtn = document.getElementById('deskRoutineActionBtn') as HTMLButtonElement | null;
        const deskRoutineDisplay = document.getElementById('deskRoutineDisplay');
        const mobRoutineDisplay = document.getElementById('mobRoutineDisplay');
        if (mobRoutineBtn) { mobRoutineBtn.innerText = 'Sending...'; mobRoutineBtn.disabled = true; }
        if (deskRoutineBtn) { deskRoutineBtn.innerText = 'Sending...'; deskRoutineBtn.disabled = true; }
        if (deskRoutineDisplay) deskRoutineDisplay.textContent = 'UPLOADING...';
        if (mobRoutineDisplay) mobRoutineDisplay.textContent = 'UPLOADING...';
    }

    // Task-only UI - do NOT touch task layout (text/timer stay as-is)
    if (!isRoutine) {
        if (uploadBtn) { uploadBtn.innerText = "UPLOADING..."; (uploadBtn as HTMLButtonElement).disabled = true; }
        if (mobTaskBtn) { mobTaskBtn.innerText = "SENDING..."; (mobTaskBtn as HTMLButtonElement).disabled = true; }
        clearUploadNotice();
        showUploadNotice('<div style="font-family:\'Rajdhani\';font-size:0.9rem;color:rgba(255,255,255,0.5);letter-spacing:1px;"><i class="fas fa-circle-notch fa-spin" style="margin-right:6px;color:#c5a059;"></i>TRANSMITTING EVIDENCE...</div>');
    }

    try {
        // 1. Upload to Supabase Storage ('media' public bucket so URLs render everywhere)
        console.log("Uploading task proof to Supabase...");
        const folder = `task-proofs/${(userName || "slave").replace(/[^a-z0-9-_]/gi, "_").toLowerCase()}`;
        const fileUrl = await uploadToSupabase("media", folder, file);
        console.log("Supabase Upload Result:", fileUrl);

        if (!fileUrl || fileUrl.startsWith("failed")) {
            const isTooLong = fileUrl?.includes("VIDEO_TOO_LONG");
            const isSizeError = fileUrl?.startsWith("failed:size");
            const sizeVal = isSizeError ? fileUrl.split(':')[2] : null;
            const noticeHtml = isTooLong
                ? `<div style="font-family:'Orbitron';font-size:0.7rem;color:var(--red);letter-spacing:2px;margin-bottom:6px;">VIDEO TOO LONG</div><div style="font-family:'Rajdhani';font-size:0.9rem;color:rgba(255,255,255,0.6);margin-bottom:12px;">Maximum 2 minutes allowed.<br>Please trim your video and try again.</div><div style="display:flex;gap:10px;justify-content:center;"><button onclick="window._clearUploadNotice()" style="padding:8px 18px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.7);font-family:'Orbitron';font-size:0.45rem;cursor:pointer;border-radius:6px;letter-spacing:1px;">DISMISS</button></div>`
                : `<div style="font-family:'Rajdhani';font-size:0.9rem;color:var(--red);letter-spacing:1px;">${isSizeError ? `Video too large (${sizeVal}) - maximum 50MB.` : 'Upload failed - please try again.'}</div>`;
            if (!isRoutine) showUploadNotice(noticeHtml);
            return false;
        }

        let thumbnailUrl: string | null = null;
        if (isVideo(file)) {
            console.log("Generating task video thumbnail...");
            thumbnailUrl = await extractAndUploadVideoThumbnail(file);
            console.log("Task thumbnail result:", thumbnailUrl);
        }

        // 2. Submit link to Postgres records
        console.log("Submitting URL to backend API...");
        const res = await fetch('/api/profile-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'SUBMIT_TASK',
                memberId: pid,
                payload: {
                    proofUrl: fileUrl,
                    thumbnailUrl,
                    proofType: file.type,
                    taskText: taskText,
                    isRoutine: isRoutine
                }
            })
        });
        const data = await res.json();
        console.log("Backend submission response:", data);

        if (data.success) {
            console.log("Submission successful!");
            if (!isRoutine) {
                clearUploadNotice();
                const mockeries = [
                    "Evidence submitted. We will see if it's as disappointing as usual.",
                    "Task uploaded. Hopefully less pathetic than your last attempt.",
                    "Transmission received. We'll judge your meager effort shortly.",
                    "Uploaded. Don't flatter yourself, it still needs approval.",
                    "Evidence sent. Awaiting validation of your so-called hard work."
                ];
                showTaskFeedback(mockeries[Math.floor(Math.random() * mockeries.length)], '#c5a059');
            }
            // Refresh gallery so the pending item appears immediately
            refreshTaskGallery(getState().email || _galleryEmail || pid);
            return true;
        } else {
            console.error("Backend submission error:", data.error);
            if (!isRoutine) showUploadNotice(`<div style="font-family:'Rajdhani';font-size:0.9rem;color:var(--red);letter-spacing:1px;">TRANSMISSION FAILED - ${data.error || 'please try again'}</div>`);
            return false;
        }
    } catch (err: any) {
        console.error("Critical submission error", err);
        if (!isRoutine) showUploadNotice(`<div style="font-family:'Rajdhani';font-size:0.9rem;color:var(--red);letter-spacing:1px;">UPLOAD FAILED - TASK STILL ACTIVE, TRY AGAIN</div>`);
        return false;
    } finally {
        if (!isRoutine) {
            if (uploadBtn && originalText) { uploadBtn.innerText = originalText; (uploadBtn as HTMLButtonElement).disabled = false; }
            if (mobTaskBtn && originalMobTaskText) { mobTaskBtn.innerText = originalMobTaskText; (mobTaskBtn as HTMLButtonElement).disabled = false; }
            if (mobRoutineBtn && originalMobRoutineText) mobRoutineBtn.innerText = originalMobRoutineText;
        }
    }
}
export function handleProfileUpload(input?: HTMLInputElement) { _doProfileUpload(); }
export function handleAdminUpload(input: HTMLInputElement) { console.log("Admin upload", input.files); }

export function handleMediaPlus() {
    const input = document.getElementById('chatMediaInput') as HTMLInputElement;
    input?.click();
}

export async function handleChatMediaUpload(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';

    const { memberId } = getState();
    if (!memberId) return;

    const isVid = file.type.startsWith('video/');
    const type = isVid ? 'video' : 'photo';

    // Show preview modal - let server enforce rank, don't block client-side
    _showMediaPreviewModal(file, isVid, async (sendBtn: HTMLButtonElement, statusEl: HTMLElement) => {
        sendBtn.disabled = true;
        sendBtn.textContent = 'UPLOADING...';
        statusEl.textContent = '';
        try {
            const { uploadToSupabase } = await import('./mediaSupabase');
            const url = await uploadToSupabase('media', 'chat', file);

            const res = await fetch('/api/chat/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memberId: memberId, content: url, type })
            });
            const data = await res.json();

            if (!data.success) {
                statusEl.textContent = data.error || 'Failed to send.';
                sendBtn.disabled = false;
                sendBtn.textContent = 'SEND';
                return false;
            }

            if (data.newWallet !== undefined) {
                setState({ wallet: data.newWallet });
                const wStr = data.newWallet.toLocaleString();
                document.querySelectorAll('#coins, #mobCoins').forEach(el => { (el as HTMLElement).innerText = wStr; });
            }
            return true; // success → close modal
        } catch (err) {
            statusEl.textContent = 'Upload failed. Try again.';
            sendBtn.disabled = false;
            sendBtn.textContent = 'SEND';
            return false;
        }
    });
}

function _showMediaPreviewModal(file: File, isVid: boolean, onSend: (btn: HTMLButtonElement, status: HTMLElement) => Promise<boolean>) {
    const existing = document.getElementById('__chatMediaPreview');
    existing?.remove();

    const objectUrl = URL.createObjectURL(file);
    const overlay = document.createElement('div');
    overlay.id = '__chatMediaPreview';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';

    const mediaEl = isVid
        ? `<video src="${objectUrl}" controls playsinline style="max-width:100%;max-height:55vh;border-radius:12px;display:block;"></video>`
        : `<img src="${objectUrl}" style="max-width:100%;max-height:55vh;border-radius:12px;display:block;object-fit:contain;" />`;

    overlay.innerHTML = `
        <div style="width:min(420px,100%);background:#0a0806;border:1px solid rgba(197,160,89,0.35);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;">
            <div style="padding:14px 18px;border-bottom:1px solid rgba(197,160,89,0.12);display:flex;align-items:center;justify-content:space-between;">
                <span style="font-family:Orbitron,sans-serif;font-size:0.48rem;color:rgba(197,160,89,0.7);letter-spacing:3px;">${isVid ? 'VIDEO' : 'PHOTO'} PREVIEW</span>
                <button id="__chatMediaClose" style="background:none;border:none;color:#555;font-size:1.2rem;cursor:pointer;line-height:1;padding:0 4px;">✕</button>
            </div>
            <div style="padding:16px;display:flex;justify-content:center;background:#050403;">
                ${mediaEl}
            </div>
            <div style="padding:14px 18px;display:flex;flex-direction:column;gap:10px;">
                <div id="__chatMediaStatus" style="font-family:Orbitron,sans-serif;font-size:0.42rem;color:#c55;text-align:center;min-height:16px;"></div>
                <div style="display:flex;gap:10px;">
                    <button id="__chatMediaCancel" style="flex:1;padding:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#666;font-family:Orbitron,sans-serif;font-size:0.48rem;letter-spacing:2px;cursor:pointer;">CANCEL</button>
                    <button id="__chatMediaSend" style="flex:2;padding:12px;background:linear-gradient(135deg,#c5a059,#8b6914);border:none;border-radius:8px;color:#000;font-family:Orbitron,sans-serif;font-size:0.48rem;font-weight:700;letter-spacing:2px;cursor:pointer;">SEND</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const close = () => { URL.revokeObjectURL(objectUrl); overlay.remove(); };
    document.getElementById('__chatMediaClose')!.onclick = close;
    document.getElementById('__chatMediaCancel')!.onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    const sendBtn = document.getElementById('__chatMediaSend') as HTMLButtonElement;
    const statusEl = document.getElementById('__chatMediaStatus') as HTMLElement;
    sendBtn.onclick = async () => {
        const ok = await onSend(sendBtn, statusEl);
        if (ok) close();
    };
}

export function handleChatKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') sendChatMessage();
}

// ---------------------------------------------------------
// NEW SUPABASE CHAT LOGIC - mirrors dashboard-chat.ts exactly
// ---------------------------------------------------------

// Single shared client - realtime subscriptions must stay on the same instance
// (same pattern as dashboard-chat.ts line 14, but lazy-loaded to fix static builds)
let _profileChatSupabase: any = null;
const getChatSupabase = () => {
    if (!_profileChatSupabase) _profileChatSupabase = createClient();
    return _profileChatSupabase;
};

let _chatChannel: any = null;
let _chatPollInterval: ReturnType<typeof setInterval> | null = null;
let _silenceCheckInterval: ReturnType<typeof setInterval> | null = null;
let _queenInterval: ReturnType<typeof setInterval> | null = null;
let _queenReapplyInterval: ReturnType<typeof setInterval> | null = null;
let _isQueenUser = false;
let _presenceCh: any = null;
let _tasksChannel: any = null;
let _statsChannel: any = null;
let _notifyChannel: any = null;
let _queenStatusChannel: any = null;
let _lastChatMsgId: string | null = null;
let _lastChatMsgTimestamp: string | null = null;
let chatSubscribed = false;
const _renderedMsgIds = new Set<string>(); // dedup guard across realtime + polling

function _showRoutineToast(approved: boolean) {
    if (typeof document === 'undefined') return;
    const existing = document.getElementById('_routineToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = '_routineToast';
    const color = approved ? '#00ff00' : '#ff4444';
    const borderColor = approved ? 'rgba(0,255,0,0.3)' : 'rgba(255,68,68,0.3)';
    const bgColor = approved ? 'rgba(0,255,0,0.07)' : 'rgba(255,68,68,0.07)';
    toast.innerHTML = approved
        ? `<span style="font-size:1rem;margin-right:8px;">✓</span> ROUTINE APPROVED`
        : `<span style="font-size:1rem;margin-right:8px;">✗</span> ROUTINE REJECTED`;
    Object.assign(toast.style, {
        position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%) translateY(-80px)',
        background: bgColor, border: `1px solid ${borderColor}`,
        color, fontFamily: 'Orbitron, sans-serif', fontSize: '0.55rem',
        letterSpacing: '3px', padding: '14px 28px', borderRadius: '8px',
        zIndex: '99999', backdropFilter: 'blur(12px)',
        boxShadow: `0 0 30px ${borderColor}`,
        transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        whiteSpace: 'nowrap',
    });
    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    // Auto-dismiss after 4s
    setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(-80px)';
        setTimeout(() => toast.remove(), 350);
    }, 4000);
}

/** Tear down all intervals + realtime channels. Safe to call multiple times. */
export function cleanupChatSystem() {
    if (_chatPollInterval) { clearInterval(_chatPollInterval); _chatPollInterval = null; }
    if (_silenceCheckInterval) { clearInterval(_silenceCheckInterval); _silenceCheckInterval = null; }
    if (_queenInterval) { clearInterval(_queenInterval); _queenInterval = null; }
    if (_queenReapplyInterval) { clearInterval(_queenReapplyInterval); _queenReapplyInterval = null; }
    if (_chatChannel) { getChatSupabase().removeChannel(_chatChannel); _chatChannel = null; }
    if (_tasksChannel) { getChatSupabase().removeChannel(_tasksChannel); _tasksChannel = null; }
    if (_statsChannel) { getChatSupabase().removeChannel(_statsChannel); _statsChannel = null; }
    if (_notifyChannel) { getChatSupabase().removeChannel(_notifyChannel); _notifyChannel = null; }
    if (_queenStatusChannel) { getChatSupabase().removeChannel(_queenStatusChannel); _queenStatusChannel = null; }
    if (_presenceCh) { _presenceCh.unsubscribe(); _presenceCh = null; }
    chatSubscribed = false;
}

function _scrollChat() {
    // Scroll outer containers
    ['chatBox', 'mob_chatBox'].forEach(id => {
        const b = document.getElementById(id);
        if (!b) return;
        b.scrollTop = b.scrollHeight + 9999;
    });
    // Also scroll inner content divs - on mobile the flex layout can make
    // mob_chatContent (overflow-y:auto) be the actual scroll container instead of mob_chatBox
    ['chatContent', 'mob_chatContent'].forEach(id => {
        const b = document.getElementById(id);
        if (!b) return;
        b.scrollTop = b.scrollHeight + 9999;
    });
}
function _scrollChatDelayed() {
    requestAnimationFrame(() => requestAnimationFrame(_scrollChat));
    setTimeout(_scrollChat, 100);
    setTimeout(_scrollChat, 400);
    setTimeout(_scrollChat, 900);
}
// After setting innerHTML, attach load handlers so images re-trigger scroll as they arrive
function _attachImgScrollHandlers() {
    ['chatContent', 'mob_chatContent'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        (el.querySelectorAll('img') as NodeListOf<HTMLImageElement>).forEach(img => {
            if (!img.complete) {
                img.addEventListener('load', _scrollChat, { once: true });
                img.addEventListener('error', _scrollChat, { once: true });
            }
        });
    });
}
function _isScrolledToBottom() {
    // Check both the outer scroll container and the inner content div.
    // On mobile, mob_chatContent may be the actual scroll container due to flex layout.
    const containers = [
        document.getElementById('mob_chatBox'),
        document.getElementById('mob_chatContent'),
        document.getElementById('chatBox'),
    ].filter(Boolean) as HTMLElement[];
    // If ANY container is near bottom, treat as "at bottom"
    return containers.some(b => (b.scrollHeight - b.scrollTop - b.clientHeight) < 160);
}

export async function initChatSystem() {
    // 🔑 KEY DIFFERENCE vs old broken code:
    // Dashboard gets email directly from supabase.auth.getUser() - never from state.
    // Profile was reading getState().memberId which could be null if initProfileState
    // hadn't fully run yet. Now we do exactly what dashboard does.
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let email = user?.email?.toLowerCase();
    const userId = user?.id || '';

    // Localhost DEV bypass (same pattern as dashboard)
    if (!email && typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        email = 'pr.finsko@gmail.com';
    }

    console.log('[CHAT] initChatSystem starting');

    if (!email) {
        console.warn('[CHAT] initChatSystem: no email from auth, skipping');
        return;
    }

    // Update state so rest of the app has the UUID memberId and email too
    if (!getState().memberId) {
        setState({ memberId: userId, email: email });
    }

    // Silence is handled by the realtime profile_stats_ subscription below - no polling needed

    if (chatSubscribed) return; // channels already set up - don't duplicate
    chatSubscribed = true;

    // Broadcast presence so dashboard knows this member is online.
    // Stored at module level so it can be unsubscribed in cleanupChatSystem().
    _presenceCh = supabase.channel('members-online');
    _presenceCh.subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
            await _presenceCh.track({ id: presenceKey(email!) });
        }
    });

    // chats.member_id is EMAIL - always query by email
    await loadChatHistory(email!);

    // 2. Realtime subscription on shared client (same as dashboard line 107-120)
    if (_chatChannel) {
        getChatSupabase().removeChannel(_chatChannel);
        _chatChannel = null;
    }
    _chatChannel = getChatSupabase()
        .channel('profile-chats-' + (userId || email))
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'chats',
            // NO row filter here - filter in JS instead to support UUID-based member_id
        }, (payload: any) => {
            const msg = payload.new;
            // chats.member_id is EMAIL - compare against email
            const rowMemberId = (msg.member_id || '').toLowerCase();
            const matchesUser = rowMemberId === email!.toLowerCase();
            if (!matchesUser) return;
            const sender = (msg.sender_email || msg.sender || '').toLowerCase();

            if (isSystemMessage(msg)) {
                updateSystemTicker(msg);
                appendSystemLog(msg);
                if (msg.content && msg.content.includes('DIRECTIVE ASSIGNED')) {
                    getRandomTask(true);
                }
                return;
            }

            // Queen message: show notification badge + sound
            if (sender !== email && sender !== 'user' && sender !== 'slave') {
                _updateQueenStatus(msg.created_at || new Date().toISOString());
                const chatOverlay = document.getElementById('mobChatOverlay');
                const isOpen = chatOverlay && (chatOverlay.style.display === 'flex' || chatOverlay.classList.contains('mob-overlay-open'));
                if (!isOpen) {
                    const badge = document.getElementById('mobMsgBadge');
                    if (badge) badge.classList.add('active');
                    const ring = document.querySelector('.mob-nav-queen-ring');
                    if (ring) ring.classList.add('has-new-msg');
                    try { const snd = new Audio('/audio/message.mp3'); snd.volume = 0.5; snd.play(); } catch (_) {}
                    // Show in-app message banner
                    const preview = typeof msg.content === 'string' ? msg.content.slice(0, 80) : '👑 New message';
                    showNewMessageBanner(preview);
                }
            }

            const msgId = msg.id ? String(msg.id) : null;
            if (msgId && _renderedMsgIds.has(msgId)) return; // already rendered
            if (msgId) _renderedMsgIds.add(msgId);
            _lastChatMsgId = msgId;
            if (msg.created_at) _lastChatMsgTimestamp = msg.created_at;

            const wasAtBottom = _isScrolledToBottom();
            const html = renderChatMessage(msg);
            ['chatContent', 'mob_chatContent'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.insertAdjacentHTML('beforeend', html);
            });
            _attachImgScrollHandlers();
            if (wasAtBottom) _scrollChatDelayed();
        })
        .subscribe();

    // Realtime handles all new chat messages - no polling needed

    // 4. Supabase realtime for tasks + profile stats - stored so they can be removed
    // NOTE: No row filter on either channel - eq() is case-sensitive and misses rows
    // when member_id casing in DB differs from auth email. Filter in JS callback instead.
    if (_tasksChannel) { getChatSupabase().removeChannel(_tasksChannel); }
    _tasksChannel = getChatSupabase()
        .channel('tasks_updates_' + email)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' },
            (payload: any) => {
                const fresh = payload.new;
                // Case-insensitive guard — tasks.member_id is UUID after migration
                const rowMemberId = (fresh?.member_id || '').toLowerCase();
                const myUuid = (getState().memberId || '').toLowerCase();
                const myEmail = (getState().email || '').toLowerCase();
                if (rowMemberId !== myUuid && rowMemberId !== myEmail) return;

                updateRoutineWidget();
                refreshTaskGallery(email!);

                // Force-assigned task - show it immediately from Realtime payload
                if (!fresh?.taskdom_active_task) return;

                let activeTask = fresh.taskdom_active_task;
                if (typeof activeTask === 'string') {
                    try { activeTask = JSON.parse(activeTask); } catch { return; }
                }

                const taskText = activeTask.text || activeTask.TaskText || activeTask.tasktext;
                if (!taskText) return;

                // Push task text to both desktop and mobile UI
                const readyText = document.getElementById('readyText');
                const mobTaskText = document.getElementById('mobTaskText');
                const mainArea = document.getElementById('mainButtonsArea');
                const activeArea = document.getElementById('activeTaskContent');
                const uploadCont = document.getElementById('uploadBtnContainer');
                const qmIdle = document.getElementById('qm_TaskIdle');
                const qmActive = document.getElementById('qm_TaskActive');
                const activeTimerRow = document.getElementById('activeTimerRow');
                const mobActiveTimerRow = document.querySelector('#qm_TaskActive .card-timer-row') as HTMLElement;

                if (mainArea) mainArea.style.display = 'none';
                if (activeArea) { activeArea.classList.remove('hidden'); activeArea.style.display = 'flex'; }
                if (uploadCont) { uploadCont.classList.remove('hidden'); uploadCont.style.display = 'flex'; }
                if (qmIdle) qmIdle.classList.add('hidden');
                if (qmActive) { qmActive.classList.remove('hidden'); qmActive.style.display = 'block'; }
                if (readyText) readyText.innerHTML = taskText;
                if (mobTaskText) mobTaskText.innerHTML = taskText;
                if (activeTimerRow) activeTimerRow.style.display = 'flex';
                if (mobActiveTimerRow) mobActiveTimerRow.style.display = 'flex';

                const endTime = activeTask.endTime || (Date.now() + 24 * 3600 * 1000);
                startTaskTimer(endTime - Date.now());
            })
        .subscribe();

    if (_statsChannel) { getChatSupabase().removeChannel(_statsChannel); }
    _statsChannel = getChatSupabase()
        .channel('profile_stats_' + email)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' },
            // No row filter - case-sensitive eq() misses rows when member_id has different
            // casing in DB. Filter in JS with case-insensitive check below.
            (payload: any) => {
                const fresh = payload.new as any;
                if (!fresh) return;
                // Case-insensitive guard
                const rowEmail = (fresh.member_id || '').toLowerCase();
                if (rowEmail !== email.toLowerCase()) return;

                if (fresh.wallet !== undefined || fresh.score !== undefined) {
                    setState({ wallet: fresh.wallet ?? getState().wallet, score: fresh.score ?? getState().score });
                    updateWalletDisplay();
                }
                // Paywall / silence activated or deactivated in realtime
                _applyPaywall(fresh.parameters?.paywall ?? null, fresh.member_id || email);
                _applySilence(fresh.silence === true, fresh.parameters?.silence_reason || '');
            })
        .subscribe();

    // 5. Routine approval/rejection broadcast — dashboard notifies member instantly
    const memberId = getState().memberId || getState().id || email;
    if (_notifyChannel) getChatSupabase().removeChannel(_notifyChannel);
    _notifyChannel = getChatSupabase()
        .channel(`member-notify-${memberId}`)
        .on('broadcast', { event: 'routine_approved' }, () => _showRoutineToast(true))
        .on('broadcast', { event: 'routine_rejected' }, () => _showRoutineToast(false))
        .subscribe();

    // 6. Queen online status — Realtime subscription on profiles table
    // Fires whenever queen's row updates (last_active, etc.) so member sees live status
    if (_queenStatusChannel) getChatSupabase().removeChannel(_queenStatusChannel);
    _queenStatusChannel = getChatSupabase()
        .channel('queen-status-live')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload: any) => {
            const row = payload.new;
            if (!row) return;
            const email = (row.member_id || '').toLowerCase();
            const name = (row.name || '').toUpperCase();
            if (email.includes('qkarin') || name.includes('QUEEN') || name.includes('KARIN')) {
                _updateQueenStatus(row.last_active || null);
            }
        })
        .subscribe();

    // Start periodic queen status polling (every 60s) so members always see live status
    const isQueen = email!.toLowerCase().includes('qkarin') || email!.toLowerCase() === 'xxxqkarinxxx@gmail.com';
    if (_queenReapplyInterval) { clearInterval(_queenReapplyInterval); _queenReapplyInterval = null; }
    if (isQueen) {
        // Current user IS the queen — always show online, no need to poll yourself
        _isQueenUser = true;
        _updateQueenStatus(new Date().toISOString());
    } else {
        _isQueenUser = false;
        if (_queenInterval) clearInterval(_queenInterval);
        _fetchQueenStatus(); // immediate fetch
        _queenInterval = setInterval(_fetchQueenStatus, 60 * 1000);
    }
    // Re-apply cached queen status every 3s — React re-renders reset DOM text to "-"
    _queenReapplyInterval = setInterval(() => {
        if (_isQueenUser) {
            _updateQueenStatus(new Date().toISOString());
        } else if (_cachedQueenIso) {
            _updateQueenStatus(_cachedQueenIso);
        }
    }, 3000);

    // 7. Push notifications - always use email as external user ID (consistent with DB lookup)
    initOneSignal(email);
}

async function _pollNewChatMessages(memberId: string) {
    if (!_lastChatMsgTimestamp) return;
    try {
        const res = await fetch('/api/chat/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId, since: _lastChatMsgTimestamp }) });
        const data = await res.json();
        if (!data.success) return;
        const newMsgs = (data.messages || []).filter((m: any) => {
            const id = m.id ? String(m.id) : null;
            return id && !_renderedMsgIds.has(id);
        });
        if (newMsgs.length === 0) return;
        const wasAtBottom = _isScrolledToBottom();
        newMsgs.forEach((m: any) => {
            const id = m.id ? String(m.id) : null;
            if (id) _renderedMsgIds.add(id);
            _lastChatMsgId = m.id;
            if (m.created_at) _lastChatMsgTimestamp = m.created_at;
            if (isSystemMessage(m)) {
                appendSystemLog(m);
                updateSystemTicker(m);
                // If a task was force-assigned via dashboard, refresh it immediately
                if (m.content && m.content.includes('DIRECTIVE ASSIGNED')) {
                    getRandomTask(true);
                }
                return;
            }
            const html = renderChatMessage(m);
            ['chatContent', 'mob_chatContent'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.insertAdjacentHTML('beforeend', html);
            });
        });
        _attachImgScrollHandlers();
        if (wasAtBottom) _scrollChatDelayed();
    } catch (_) {}
}


function initOneSignal(memberId: string) {
    // Init OneSignal in background (for subscription management)
    const w = window as any;
    w.OneSignalDeferred = w.OneSignalDeferred || [];
    w.OneSignalDeferred.push(async (OneSignal: any) => {
        try {
            await OneSignal.init({
                appId: '761d91da-b098-44a7-8d98-75c1cce54dd0',
                safari_web_id: 'web.onesignal.auto.5f8d50ad-7ec3-4f1c-a2de-134e8949294e',
                notifyButton: { enable: false },
                allowLocalhostAsSecureOrigin: true,
            });
            await OneSignal.login(memberId);
            // Always persist the current subscription ID (it may change between sessions)
            const subId = OneSignal?.User?.PushSubscription?.id;
            if (subId) {
                fetch('/api/push', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subscriptionId: subId, memberId }),
                }).catch(() => {});
            }
        } catch (e) {
            console.error('[OneSignal] init error:', e);
        }
    });

    // Show opt-in banner — skip if already granted or no API
    if (!('Notification' in window)) return;
    if ((window as any).Notification.permission === 'granted') return;

    // Don't show again if dismissed within last 7 days (but always show in PWA on first open)
    const isPwa = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    const dismissedAt = parseInt(localStorage.getItem('pushBannerDismissed') || '0', 10);
    const daysSinceDismiss = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
    if (!isPwa && dismissedAt && daysSinceDismiss < 7) return;

    const banner = document.getElementById('pushBanner');
    const allowBtn = document.getElementById('pushAllowBtn');
    const allowLabel = document.getElementById('pushAllowLabel');
    const dismissBtn = document.getElementById('pushDismissBtn');
    if (!banner) return;

    const dismiss = () => {
        banner.style.display = 'none';
        localStorage.setItem('pushBannerDismissed', String(Date.now()));
    };

    if ((window as any).Notification.permission === 'denied') {
        if (allowLabel) allowLabel.textContent = 'HOW TO ENABLE';
        allowBtn?.addEventListener('click', () => {
            dismiss();
            alert('Go to your browser settings → Site Settings → Notifications → find this site → set to Allow.');
        });
    } else {
        allowBtn?.addEventListener('click', async () => {
            dismiss();
            const OS = (window as any).OneSignal;
            if (OS?.Notifications?.requestPermission) {
                await OS.Notifications.requestPermission();
            } else {
                await (window as any).Notification.requestPermission();
            }
            // Save subscription ID to DB so queen can push to this device
            try {
                await new Promise(r => setTimeout(r, 1500)); // wait for OS to register
                const subId = (window as any).OneSignal?.User?.PushSubscription?.id;
                if (subId) {
                    await fetch('/api/push', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ subscriptionId: subId, memberId }),
                    });
                }
            } catch {}
            _updateNotifToggleUI();
        });
    }

    dismissBtn?.addEventListener('click', dismiss);

    // Only auto-show in PWA (already installed, safe to prompt). In browser, wait for scroll
    // to avoid Chrome classifying automatic permission prompts as spam.
    if (isPwa) {
        setTimeout(() => { banner.style.display = 'flex'; }, 500);
    } else {
        const onScroll = () => {
            if (window.scrollY > 300) {
                banner.style.display = 'flex';
                window.removeEventListener('scroll', onScroll);
            }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
    }
}

function _updateNotifToggleUI() {
    const statusEl = document.getElementById('notifToggleStatus');
    const descEl = document.getElementById('notifToggleDesc');
    if (!statusEl || !descEl) return;
    const perm = ('Notification' in window) ? (window as any).Notification.permission : 'unsupported';
    if (perm === 'granted') {
        statusEl.textContent = 'ON';
        statusEl.style.color = '#00cc66';
        descEl.textContent = 'Push notifications enabled';
    } else if (perm === 'denied') {
        statusEl.textContent = 'BLOCKED';
        statusEl.style.color = '#ff4444';
        descEl.textContent = 'Enable in browser settings';
    } else {
        statusEl.textContent = 'OFF';
        statusEl.style.color = '#555';
        descEl.textContent = 'Enable push notifications';
    }
}

export async function togglePushNotifications() {
    const perm = ('Notification' in window) ? (window as any).Notification.permission : 'unsupported';
    if (perm === 'granted') {
        // Already on — offer to disable via OneSignal
        const OS = (window as any).OneSignal;
        if (OS?.User?.PushSubscription?.optOut) {
            await OS.User.PushSubscription.optOut();
        }
        alert('Notifications paused. To fully block them, go to browser settings → Site Settings → Notifications.');
        _updateNotifToggleUI();
    } else if (perm === 'denied') {
        alert('Notifications are blocked. Go to browser Settings → Site Settings → Notifications → find this site → set to Allow.');
    } else {
        // Request permission
        const OS = (window as any).OneSignal;
        if (OS?.Notifications?.requestPermission) {
            await OS.Notifications.requestPermission();
        } else {
            await (window as any).Notification.requestPermission();
        }
        _updateNotifToggleUI();
    }
}

export async function loadChatHistory(memberId: string) {
    try {
        const res = await fetch('/api/chat/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId }) });
        console.log('[CHAT] fetch /api/chat/history status:', res.status);
        const data = await res.json();
        if (data.success) {
            const messages = data.messages || [];
            console.log('[CHAT] Received messages count:', messages.length);

            // Seed dedup set + track timestamps for polling
            _renderedMsgIds.clear();
            messages.forEach((m: any) => { if (m.id) _renderedMsgIds.add(String(m.id)); });
            if (messages.length > 0) {
                const last = messages[messages.length - 1];
                _lastChatMsgId = last.id;
                _lastChatMsgTimestamp = last.created_at || new Date().toISOString();
            } else {
                _lastChatMsgTimestamp = new Date().toISOString();
            }

            // 3. Split: system messages → system log, chat messages → chat box
            _lastRenderedChatTs = 0;
            const allDisplay = messages.filter((m: any) => m.content && m.content.trim());
            const sysDisplay = allDisplay.filter((m: any) => isSystemMessage(m));
            const chatDisplay = allDisplay.filter((m: any) => !isSystemMessage(m));

            // Populate system log from history
            if (sysDisplay.length > 0) {
                renderSystemLogs(sysDisplay);
                updateSystemTicker(sysDisplay[sysDisplay.length - 1]);
            }

            const displayMessages = chatDisplay;
            let html = displayMessages.map((m: any, i: number) => {
                const prevTs = i === 0 ? 0 : new Date(displayMessages[i - 1].created_at || 0).getTime();
                return renderChatMessage(m, prevTs);
            }).join('');

            if (displayMessages.length === 0) {
                html = `<div style="text-align:center;padding:40px;color:#333;font-family:Orbitron;font-size:0.75rem;letter-spacing:3px">NO MESSAGES YET</div>`;
            }

            // 4. Update Queen online status from real presence data
            _fetchQueenStatus();

            ['chatContent', 'mob_chatContent'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = html;
            });
            _scrollChatDelayed();
            _attachImgScrollHandlers();

            // Check unlock status for any paid media messages
            _checkPaidMediaUnlocks(messages);
        }
    } catch (err) {
        console.error("Failed to load chat history:", err);
        ['chatContent', 'mob_chatContent'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.innerHTML = `<div style="text-align:center;padding:40px;color:#ff4d4d;font-family:Orbitron;font-size:0.6rem;letter-spacing:1px">CONNECTION ERROR - REFRESH REQUIRED</div>`;
            }
        });
    }
}


let _galleryDirty = false;
let _galleryEmail = '';

/** Call on page load to register the email without loading anything - gallery loads lazily on first open. */
export function initGallery(email: string) {
    _galleryEmail = email;
    _galleryDirty = true;
}

async function refreshTaskGallery(email: string) {
    _galleryEmail = email;
    // Check if record/gallery section is actually visible before loading media.
    // Must check the container's inline style (set by switchTab) - getComputedStyle on
    // child elements does NOT inherit display:none from a hidden parent.
    const recordVisible = (() => {
        // Desktop: historySection is the container switchTab shows/hides via inline style
        const historySection = document.getElementById('historySection');
        if (historySection && historySection.style.display !== 'none' && historySection.style.display !== '') return true;
        // Mobile: altarDrawer gets class 'open' added when opened
        const altarDrawer = document.getElementById('altarDrawer') || document.getElementById('mobAltarDrawer');
        if (altarDrawer && altarDrawer.classList.contains('open')) return true;
        return false;
    })();

    if (!recordVisible) {
        _galleryDirty = true; // mark as needing refresh - will load when user opens it
        return;
    }

    try {
        const res = await fetch('/api/slave-profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, full: true }) });
        const data = await res.json();
        if (data && !data.error) {
            renderHistoryAndAltar(data);
            _galleryDirty = false;
        }
    } catch (err) {
        console.warn('[GALLERY] Refresh failed:', err);
    }
}

// Call this when the record/altar section is opened to load any pending gallery refresh
export async function flushGalleryIfDirty() {
    if (_galleryDirty && _galleryEmail) {
        await refreshTaskGallery(_galleryEmail);
    }
}

function isSystemMessage(msg: any) {
    if (!msg) return false;
    if (msg.type === 'system') return true; // Explicit type check
    const sender = (msg.sender_email || msg.sender || '').toLowerCase();
    const content = (msg.content || msg.message || '').toUpperCase();

    return sender === 'system' ||
        content.includes('COINS RECEIVED') ||
        content.includes('TASK APPROVED') ||
        content.includes('POINTS RECEIVED') ||
        content.includes('TASK REJECTED') ||
        content.includes('TASK VERIFIED');
}

function updateSystemTicker(msg: any) {
    if (!msg) return;
    const content = msg.content || msg.message || "";
    const tickerHtml = `<span style="color:#fff;">◈</span> ${content}`;
    ['systemTicker', 'mob_systemTicker'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = tickerHtml;
            el.classList.remove('ticker-flash');
            // Trigger reflow for animation
            void (el as HTMLElement).offsetWidth;
            el.classList.add('ticker-flash');
        }
    });
}

function getSystemLogHtml(msg: any) {
    const d = new Date(msg.created_at || msg._createdDate || Date.now());
    const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const content = msg.content || msg.message || "";
    return `
    <div style="display:flex; flex-direction:column; background:rgba(255,255,255,0.02); border-left:2px solid #c5a059; padding:10px 15px; margin-bottom:10px;">
        <span style="font-family:'Orbitron'; color:#c5a059; font-size:0.85rem;">${content}</span>
        <span style="font-family:'Orbitron'; color:rgba(255,255,255,0.3); font-size:0.6rem; margin-top:5px;">${dateStr} - ${timeStr}</span>
    </div>`;
}

export function renderSystemLogs(messages: any[]) {
    const sysLogHtml = [...messages].reverse().map(m => getSystemLogHtml(m)).join('');
    ['systemLogContent', 'mob_systemLogContent'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = sysLogHtml;
            el.scrollTop = 0;
        }
    });
}

function appendSystemLog(msg: any) {
    const html = getSystemLogHtml(msg);
    ['systemLogContent', 'mob_systemLogContent'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.insertAdjacentHTML('afterbegin', html);
            el.scrollTop = 0;
        }
    });
}

// Cached queen status — survives React re-renders that reset DOM
let _cachedQueenIso: string | null = null;

function _updateQueenStatus(lastSeenIso: string | null) {
    _cachedQueenIso = lastSeenIso;
    const dots = [document.getElementById('mobChatOnlineDot'), document.getElementById('deskChatOnlineDot')];
    const txts = [document.getElementById('mobChatStatusText2'), document.getElementById('deskChatStatusText')];

    const setStatus = (color: string, text: string, showDot: boolean) => {
        dots.forEach(d => { if (d) d.style.display = showDot ? 'block' : 'none'; });
        txts.forEach(t => { if (t) { t.style.color = color; t.textContent = text; } });
    };

    if (!lastSeenIso) {
        setStatus('#555', '-', false);
        return;
    }

    const diff = Date.now() - new Date(lastSeenIso).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 5) {
        setStatus('#22c55e', 'ONLINE', true);
    } else if (days >= 2) {
        setStatus('#555', `LAST SEEN ${days}d AGO`, false);
    } else if (days === 1) {
        setStatus('#555', 'LAST SEEN YESTERDAY', false);
    } else if (hours >= 1) {
        setStatus('#555', `LAST SEEN ${hours}h AGO`, false);
    } else {
        setStatus('#555', `LAST SEEN ${mins}m AGO`, false);
    }
}

async function _fetchQueenStatus() {
    try {
        const res = await fetch('/api/global/presence', { cache: 'no-store' });
        const data = await res.json();
        const allProfiles = data.all || [];
        // Find Queen by name or email domain
        const queenEntry =
            allProfiles.find((u: any) => {
                const n = (u.name || '').toUpperCase();
                return n.includes('QUEEN') || n.includes('KARIN');
            }) ||
            allProfiles.find((u: any) => {
                const e = (u.email || '').toLowerCase();
                return e === 'ceo@qkarin.com' || e === 'queen@qkarin.com' || e.includes('qkarin');
            });
        if (queenEntry) {
            _updateQueenStatus(queenEntry.last_active || null);
        }
    } catch {}
}

// Track paid media unlock state (set populated on chat load, updated on unlock)
const _paidMediaUnlocked = new Set<string>();

// Track timestamp of last rendered chat message for 5-min gap logic
let _lastRenderedChatTs = 0;

function renderChatMessage(msg: any, prevTs?: number): string {
    const senderEmail = (msg.sender_email || msg.sender || '').toLowerCase();
    const isSys = isSystemMessage(msg);
    // System messages must never appear in the regular chat - they belong in the system log only
    if (isSys) return '';
    const myEmail = (getState().email || getState().memberId || '').toLowerCase();
    const isMe = !isSys && (senderEmail === 'user' || senderEmail === 'slave' || senderEmail === myEmail);

    const ts = new Date(msg.created_at || Date.now()).getTime();
    const compare = prevTs !== undefined ? prevTs : _lastRenderedChatTs;
    const showTime = (ts - compare) > 5 * 60 * 1000;
    _lastRenderedChatTs = ts;

    const timeStr = showTime ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    const queenAvatar = `<img src="/queen-nav.png" class="cb-queen-av" alt="Q" onerror="this.style.display='none'" />`;

    // Paid media card → sub sees blurred media with unlock button
    if (msg.type === 'paid_media') {
        const meta = msg.metadata || {};
        const pmId = meta.paid_media_id || '';
        const pmUrl = meta.media_url || '';
        const pmType = meta.media_type || 'photo';
        const pmPrice = meta.price || 0;
        const isVid = pmType === 'video' || /\.(mp4|mov|webm)/i.test(pmUrl);
        const unlocked = _paidMediaUnlocked.has(pmId);
        const mediaTag = isVid
            ? `<video src="${pmUrl}" preload="metadata" muted playsinline style="width:100%;max-height:240px;object-fit:cover;display:block;" ${unlocked ? 'controls' : ''}></video>`
            : `<img src="${getOptimizedUrl(pmUrl, 300)}" style="width:100%;max-height:240px;object-fit:cover;display:block;" />`;
        const clickAction = unlocked ? `onclick="window._openPaidMediaModal('${pmUrl}','${isVid ? 'video' : 'photo'}')"` : '';
        const overlay = unlocked ? '' : `
            <div class="pm-overlay" id="pmOverlay_${pmId}">
                <div class="pm-price-tag">♦ ${pmPrice.toLocaleString()}</div>
                <button class="pm-unlock-btn" id="pmBtn_${pmId}" onclick="window._unlockPaidMedia('${pmId}',${pmPrice})">UNLOCK</button>
            </div>`;
        return `
            <div class="chat-gift-wrap">
                <div class="paid-media-card" id="pmCard_${pmId}" ${clickAction}>
                    <div class="pm-img-wrap ${unlocked ? '' : 'pm-locked'}" id="pmWrap_${pmId}">${mediaTag}${overlay}</div>
                    <div class="pm-footer">
                        <span class="pm-label">EXCLUSIVE MEDIA</span>
                        <span class="pm-status ${unlocked ? 'unlocked' : 'locked'}" id="pmStatus_${pmId}">${unlocked ? 'UNLOCKED' : `♦ ${pmPrice}`}</span>
                    </div>
                </div>
                ${timeStr ? `<div class="chat-ts" style="text-align:center;margin-top:4px">${timeStr}</div>` : ''}
            </div>`;
    }

    // Gift card → centered, no bubble
    if (msg.type === 'wishlist') {
        const meta = msg.metadata || {};
        return `
            <div class="chat-gift-wrap">
                <div class="chat-gift-card">
                    <div class="chat-gift-img" style="background-image:url('${meta.image}')">
                        ${meta.price ? `<div class="chat-gift-price"><i class="fas fa-coins"></i> ${Number(meta.price).toLocaleString()}</div>` : ''}
                    </div>
                    <div class="chat-gift-body">
                        <div class="chat-gift-label">✦ Gift Sent</div>
                        <div class="chat-gift-title">${meta.title || ''}</div>
                    </div>
                </div>
                ${timeStr ? `<div class="chat-ts" style="text-align:center;margin-top:4px">${timeStr}</div>` : ''}
            </div>
        `;
    }

    let content = msg.content || msg.message || '';

    // PROMOTION CARD
    if (content.startsWith('PROMOTION_CARD::')) {
        try {
            const d = JSON.parse(content.replace('PROMOTION_CARD::', ''));
            const initials = (d.name || 'S')[0].toUpperCase();
            const photoBlock = d.photo
                ? `<img src="${d.photo}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                : '';
            const photoFallback = `<div style="${d.photo ? 'display:none;' : ''}position:absolute;inset:0;align-items:center;justify-content:center;flex-direction:column;gap:6px;background:linear-gradient(135deg,rgba(197,160,89,0.08),rgba(197,160,89,0.02));"><div style="width:60px;height:60px;border-radius:50%;border:1px solid rgba(197,160,89,0.4);display:flex;align-items:center;justify-content:center;font-family:'Orbitron',sans-serif;font-size:1.4rem;color:#c5a059;">${initials}</div></div>`;
            const cardHtml = `
            <div style="width:min(85%,340px);min-width:200px;margin:0 auto;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0e0b06 0%,#110d04 60%,#0a0703 100%);border:1px solid rgba(197,160,89,0.5);box-shadow:0 12px 40px rgba(0,0,0,0.8);">
                <div style="position:relative;width:100%;height:140px;background:#0a0703;overflow:hidden;">
                    ${photoBlock}${photoFallback}
                    <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,#0e0b06 100%);"></div>
                    <div style="position:absolute;top:10px;left:50%;transform:translateX(-50%);background:rgba(10,7,2,0.9);border:1px solid rgba(197,160,89,0.5);border-radius:20px;padding:4px 14px;white-space:nowrap;">
                        <span style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:#c5a059;letter-spacing:3px;text-transform:uppercase;">✦ RANK PROMOTION</span>
                    </div>
                </div>
                <div style="padding:14px 18px 18px;text-align:center;">
                    <div style="font-family:'Orbitron',sans-serif;font-size:0.95rem;color:#fff;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">${d.name || ''}</div>
                    <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:12px;">
                        <span style="font-family:'Orbitron',sans-serif;font-size:0.48rem;color:rgba(197,160,89,0.4);letter-spacing:1px;text-decoration:line-through;">${(d.oldRank||'').toUpperCase()}</span>
                        <span style="color:rgba(197,160,89,0.7);font-size:0.9rem;">→</span>
                        <span style="font-family:'Orbitron',sans-serif;font-size:0.55rem;color:#c5a059;letter-spacing:2px;font-weight:700;">${(d.newRank||'').toUpperCase()}</span>
                    </div>
                    <div style="width:70%;height:1px;background:linear-gradient(to right,transparent,rgba(197,160,89,0.35),transparent);margin:0 auto;"></div>
                </div>
            </div>`;
            return `<div class="cb-row" style="justify-content:center;padding:8px 0;">${cardHtml}${timeStr ? `<div class="chat-ts" style="text-align:center;margin-top:4px">${timeStr}</div>` : ''}</div>`;
        } catch (_) {
            return `<div class="cb-row cb-row-queen">${queenAvatar}<div class="cb-wrap-queen"><div class="cb-queen">✦ Rank Promotion</div>${timeStr ? `<div class="chat-ts chat-ts-left">${timeStr}</div>` : ''}</div></div>`;
        }
    }

    // TASK FEEDBACK CARD (comment card)
    if (content.startsWith('TASK_FEEDBACK::')) {
        try {
            const data = JSON.parse(content.replace('TASK_FEEDBACK::', ''));
            const { mediaUrl: fbMedia, mediaType: fbType, note: fbNote, taskId: fbTaskId, memberId: fbMemberId } = data;
            const fbIsVideo = (fbType && (fbType === 'video' || fbType.startsWith('video/'))) || (fbMedia && /\.(mp4|mov|webm)/i.test(fbMedia));
            const fbSrc = fbMedia ? (fbIsVideo ? fbMedia : getOptimizedUrl(fbMedia, 600)) : null;
            const mediaBlock = fbSrc
                ? (fbIsVideo
                    ? `<div style="position:relative;width:100%;max-height:180px;overflow:hidden;border-radius:10px 10px 0 0;cursor:pointer;background:#000;" onclick="event.stopPropagation();window.openModById&&'${fbTaskId}'&&'${fbMemberId}'?window.openModById('${fbTaskId}','${fbMemberId}',true):void 0"><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:2;"><div style="width:44px;height:44px;border-radius:50%;background:rgba(197,160,89,0.85);display:flex;align-items:center;justify-content:center;font-size:1.2rem;">▶</div></div><video src="${fbSrc}" preload="none" muted playsinline style="width:100%;max-height:180px;object-fit:cover;display:block;pointer-events:none;"></video></div>`
                    : `<img src="${fbSrc}" style="width:100%;max-height:180px;object-fit:cover;display:block;border-radius:10px 10px 0 0;cursor:pointer;" onerror="this.style.display='none'" onclick="event.stopPropagation();window.openModById&&'${fbTaskId}'&&'${fbMemberId}'?window.openModById('${fbTaskId}','${fbMemberId}',true):void 0">`)
                : '';
            return `
                <div class="cb-row" style="justify-content:center;padding:8px 0;">
                    <div style="max-width:85%;width:280px;border-radius:12px;overflow:hidden;background:#0a080a;border:1px solid rgba(197,160,89,0.4);box-shadow:0 6px 24px rgba(0,0,0,0.6);">
                        ${mediaBlock}
                        <div style="padding:9px 12px 11px;">
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(197,160,89,0.6);letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;">✦ Task Feedback</div>
                            ${fbNote ? `<div style="font-family:'Rajdhani',sans-serif;font-size:0.85rem;color:rgba(255,255,255,0.82);line-height:1.4;">${fbNote}</div>` : ''}
                        </div>
                    </div>
                    ${timeStr ? `<div class="chat-ts" style="text-align:center;margin-top:4px">${timeStr}</div>` : ''}
                </div>`;
        } catch (_) {
            return `<div class="cb-row cb-row-queen">${`<img src="/queen-nav.png" class="cb-queen-av" alt="Q" onerror="this.style.display='none'" />`}<div class="cb-wrap-queen"><div class="cb-queen">📋 Task Feedback</div>${timeStr ? `<div class="chat-ts chat-ts-left">${timeStr}</div>` : ''}</div></div>`;
        }
    }

    // GIF CARD
    if (msg.type === 'gif' || (content === '[GIF]' && msg.metadata?.gifUrl)) {
        const gifUrl = msg.metadata?.gifUrl || content;
        const gifCard = `
            <div style="max-width:240px;width:60vw;border-radius:14px;overflow:hidden;background:linear-gradient(170deg,#0e0b06,#110d04,#0a0703);border:1px solid rgba(197,160,89,0.35);box-shadow:0 8px 30px rgba(0,0,0,0.7);">
                <img src="${gifUrl}" onload="window._scrollChatBottom && window._scrollChatBottom()" style="width:100%;display:block;max-height:200px;object-fit:contain;" onerror="this.style.display='none'" />
            </div>`;
        if (isMe) {
            return `<div class="cb-row cb-row-me"><div class="cb-wrap-me">${gifCard}${timeStr ? `<div class="chat-ts chat-ts-right">${timeStr}</div>` : ''}</div></div>`;
        } else {
            return `<div class="cb-row cb-row-queen">${queenAvatar}<div class="cb-wrap-queen">${gifCard}${timeStr ? `<div class="chat-ts chat-ts-left">${timeStr}</div>` : ''}</div></div>`;
        }
    }

    if (msg.type === 'photo') {
        const rawImgUrl = getOptimizedUrl(content, 300);
        // Use /api/media proxy for Supabase URLs (handles both public & private buckets)
        const imgUrl = rawImgUrl.includes('supabase.co/storage') ? `/api/media?url=${encodeURIComponent(rawImgUrl)}` : rawImgUrl;
        content = `<img src="${imgUrl}" class="chat-img-attachment" />`;
    } else if (msg.type === 'video') {
        const vidUrl = content.includes('supabase.co/storage') ? `/api/media?url=${encodeURIComponent(content)}` : content;
        content = `<video src="${vidUrl}" class="chat-img-attachment" controls playsinline preload="none" style="max-width:100%;border-radius:8px;"></video>`;
    }

    if (isMe) {
        // SLAVE - right, charcoal, no border, no avatar
        return `
            <div class="cb-row cb-row-me">
                <div class="cb-wrap-me">
                    <div class="cb-slave">${content}</div>
                    ${timeStr ? `<div class="chat-ts chat-ts-right">${timeStr}</div>` : ''}
                </div>
            </div>
        `;
    } else {
        // QUEEN - left, black, gold border, avatar
        return `
            <div class="cb-row cb-row-queen">
                ${queenAvatar}
                <div class="cb-wrap-queen">
                    <div class="cb-queen">${content}</div>
                    ${timeStr ? `<div class="chat-ts chat-ts-left">${timeStr}</div>` : ''}
                </div>
            </div>
        `;
    }
}

function appendChatCard(msg: any) {
    const html = renderChatMessage(msg);
    ['chatContent', 'mob_chatContent'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.insertAdjacentHTML('beforeend', html);
            el.scrollTop = el.scrollHeight;
        }
    });
}

let _sendingChat = false;
export async function sendChatMessage() {
    if (_sendingChat) return;
    const { memberId, wallet } = getState();
    const inputDesk = document.getElementById('chatMsgInput') as HTMLInputElement;
    const inputMob = document.getElementById('mob_chatMsgInput') as HTMLInputElement;
    const msg = (inputDesk?.value || inputMob?.value || '').trim();

    if (!msg || !memberId) return;

    _sendingChat = true;
    // Clear input immediately to prevent re-sends
    if (inputDesk) inputDesk.value = '';
    if (inputMob) inputMob.value = '';

    // Disable send buttons
    document.querySelectorAll('.chat-btn-send').forEach(b => (b as HTMLButtonElement).disabled = true);

    // Capture and clear reply before sending
    const chatReplyTo = _profileChatReply ? { sender_name: _profileChatReply.name, content: _profileChatReply.text } : null;
    cancelProfileChatReply();

    try {
        const res = await fetch('/api/chat/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memberId: memberId, content: msg, type: 'text', metadata: chatReplyTo ? { reply_to: chatReplyTo } : {} })
        });
        const data = await res.json();

        if (data.success) {
            // Immediately update wallet - use API-returned value, fall back to client-side subtraction
            const newWallet = data.newWallet !== undefined
                ? data.newWallet
                : Math.max(0, (getState().wallet || 0) - (data.costCharged || 0));
            setState({ wallet: newWallet });
            const wStr = newWallet.toLocaleString();
            document.querySelectorAll('#coins, #mobCoins').forEach(el => { (el as HTMLElement).innerText = wStr; });
        } else {
            alert(data.error || "Failed to send message.");
        }
    } catch (err) {
        console.error("Failed to send message", err);
    } finally {
        _sendingChat = false;
        document.querySelectorAll('.chat-btn-send').forEach(b => (b as HTMLButtonElement).disabled = false);
    }
}

// ─── PROFILE CHAT GIF PICKER ──────────────────────────────────────────────────

let _profileGifOpen = false;
let _profileGifTimeout: ReturnType<typeof setTimeout> | null = null;

async function _sendProfileGif(gifUrl: string) {
    const { memberId } = getState();
    if (!memberId) return;

    try {
        await fetch('/api/chat/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memberId, content: gifUrl, type: 'gif', metadata: { gifUrl } }),
        });
    } catch {}
}

export function openProfileGifPicker() {
    if (_profileGifOpen) { closeProfileGifPicker(); return; }
    _profileGifOpen = true;

    const existing = document.getElementById('profileGifPickerOverlay');
    if (existing) existing.remove();

    // Find the chat footer to insert inline panel above it (matching dashboard mobile layout)
    // Try mobile chat first, then desktop
    const mobChatTab = document.getElementById('mobChatTabChat');
    const deskChatFooter = document.querySelector('#chatBox')?.parentElement;
    let chatFooter: Element | null = null;
    let parentContainer: Element | null = null;

    if (mobChatTab) {
        chatFooter = mobChatTab.querySelector('.chat-footer');
        parentContainer = mobChatTab;
    }
    if (!chatFooter && deskChatFooter) {
        chatFooter = deskChatFooter.querySelector('.chat-footer');
        parentContainer = deskChatFooter;
    }

    const panel = document.createElement('div');
    panel.id = 'profileGifPickerOverlay';
    panel.style.cssText = `
        max-height:45vh;overflow-y:auto;
        border-top:1px solid rgba(197,160,89,0.15);
        background:#0d0b08;padding:8px;flex-shrink:0;
    `;

    panel.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:8px;">
            <input id="profileGifSearchInput" type="text" placeholder="Search GIFs..." autocomplete="off"
                style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;font-family:'Rajdhani',sans-serif;font-size:0.95rem;padding:7px 11px;border-radius:6px;outline:none;" />
            <button onclick="window.closeProfileGifPicker()" style="background:none;border:none;color:rgba(255,255,255,0.35);font-size:1.1rem;cursor:pointer;">✕</button>
        </div>
        <div id="profileGifGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;">
            <div style="grid-column:1/-1;text-align:center;padding:20px;font-family:'Orbitron';font-size:0.5rem;color:rgba(255,255,255,0.2);">LOADING...</div>
        </div>
        <div style="padding:5px 0;text-align:right;">
            <span style="font-family:'Orbitron';font-size:0.32rem;color:rgba(255,255,255,0.12);letter-spacing:1px;">via Tenor</span>
        </div>
    `;

    // Insert inline above footer (like dashboard mobile), or fallback to body overlay
    if (chatFooter && parentContainer) {
        parentContainer.insertBefore(panel, chatFooter);
    } else {
        // Fallback: append to body as overlay
        panel.style.cssText = `
            position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
            width:min(420px, 96vw);max-height:55vh;
            background:#0d0b08;border:1px solid rgba(197,160,89,0.25);border-radius:12px;
            display:flex;flex-direction:column;overflow:hidden;z-index:1000002;
            box-shadow:0 8px 40px rgba(0,0,0,0.7);
        `;
        document.body.appendChild(panel);
    }

    const searchInput = panel.querySelector('#profileGifSearchInput') as HTMLInputElement;
    searchInput?.addEventListener('input', () => {
        if (_profileGifTimeout) clearTimeout(_profileGifTimeout);
        _profileGifTimeout = setTimeout(() => _searchProfileGifs(searchInput.value || 'funny'), 400);
    });

    _searchProfileGifs('funny');
    setTimeout(() => searchInput?.focus(), 50);
}

async function _searchProfileGifs(q: string) {
    const grid = document.getElementById('profileGifGrid');
    if (!grid) return;
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;font-family:'Orbitron';font-size:0.5rem;color:rgba(255,255,255,0.2);">LOADING...</div>`;

    try {
        const res = await fetch(`/api/global/gifs?q=${encodeURIComponent(q)}`);
        const { results } = await res.json();
        if (!results?.length) {
            grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;font-family:'Orbitron';font-size:0.5rem;color:rgba(255,255,255,0.2);">NO RESULTS</div>`;
            return;
        }
        grid.innerHTML = results.map((r: any) => `
            <div onclick="window._selectProfileGif('${encodeURIComponent(r.url)}')" style="cursor:pointer;border-radius:6px;overflow:hidden;aspect-ratio:1;background:rgba(255,255,255,0.04);">
                <img src="${r.preview}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.parentElement.style.display='none'">
            </div>
        `).join('');
    } catch {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;font-family:'Orbitron';font-size:0.5rem;color:rgba(255,255,255,0.2);">FAILED TO LOAD</div>`;
    }
}

export function closeProfileGifPicker() {
    _profileGifOpen = false;
    document.getElementById('profileGifPickerOverlay')?.remove();
}

if (typeof window !== 'undefined') {
    (window as any).openProfileGifPicker = openProfileGifPicker;
    (window as any).closeProfileGifPicker = closeProfileGifPicker;
    (window as any)._selectProfileGif = (encodedUrl: string) => {
        const url = decodeURIComponent(encodedUrl);
        closeProfileGifPicker();
        _sendProfileGif(url);
    };
}

export async function buyRealCoins(amount: number) {
    try {
        const res = await fetch('/api/stripe/coins', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coins: amount }),
        });
        const data = await res.json();
        if (data.url) {
            window.location.href = data.url;
        } else {
            console.error('[EXCHEQUER] Stripe coins error:', data.error);
            alert('Could not initiate payment. Please try again.');
        }
    } catch (err) {
        console.error('[EXCHEQUER] Network error:', err);
        alert('Could not reach payment service. Please try again.');
    }
}

export async function handleSubscribe(tierId: string) {
    try {
        const res = await fetch('/api/stripe/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tierId }),
        });
        const data = await res.json();
        if (data.url) {
            window.location.href = data.url;
        } else {
            console.error('[EXCHEQUER] Stripe subscribe error:', data.error);
            alert('Could not initiate subscription. Please try again.');
        }
    } catch (err) {
        console.error('[EXCHEQUER] Network error:', err);
        alert('Could not reach payment service. Please try again.');
    }
}

export function toggleRewardSubMenu(show: boolean) {
    document.getElementById('reward-buy-menu')?.classList.toggle('hidden', !show);
    document.getElementById('reward-main-menu')?.classList.toggle('hidden', show);
}

export async function buyRewardFragment(cost: number) {
    const { id, memberId, wallet } = getState();
    const pid = memberId || id;
    if (!pid || wallet < cost) return;

    try {
        const res = await fetch('/api/profile-action', {
            method: 'POST',
            body: JSON.stringify({
                type: 'TRANSACTION',
                memberId: pid,
                payload: { amount: -cost, category: 'FRAGMENT_BUY' }
            })
        });
        const data = await res.json();
        if (data.success) {
            setState({ wallet: wallet - cost });
            await revealFragment();
            renderProfileSidebar(getState().raw || getState());
        }
    } catch (err) {
        console.error("Error buying fragment", err);
    }
}

function _setNavActive(tab: string) {
    const navIds: Record<string, string> = {
        profile: 'mobNavProfile', record: 'mobNavRecord', queen: 'mobNavQueen', global: 'mobNavGlobal',
    };
    Object.entries(navIds).forEach(([key, id]) => {
        document.getElementById(id)?.classList.toggle('active', key === tab);
    });
}

export function mobNavTo(tab: 'profile' | 'record' | 'queen' | 'global') {
    switch (tab) {
        case 'profile':
            // Close everything that could be open
            _closeAllMobOverlays();
            closeAltarDrawer();
            document.getElementById('__altarModal')?.remove();
            document.getElementById('_reqModal')?.remove();
            document.getElementById('_manageModal')?.remove();
            document.getElementById('hubOverlay')?.classList.add('hidden');
            document.getElementById('tributeHuntOverlay')?.classList.add('hidden');
            document.getElementById('tributeHuntOverlay')?.style.setProperty('display', 'none');
            _setNavActive('profile');
            document.getElementById('viewMobileHome')?.scrollTo({ top: 0, behavior: 'smooth' });
            break;
        case 'record':
            openAltarDrawer();
            break;
        case 'queen':
            openMobQueenWall();
            break;
        case 'global':
            (window as any).openGlobalView?.();
            break;
    }
}

// ─── MOB ROUTINE ─────────────────────────────────────────────────────────────
// Opens the Queen Command Hub and scrolls to the routine upload section
export function openMobRoutine() {
    openLobby();
    setTimeout(() => {
        const routineEl = document.getElementById('mobRoutineDisplay');
        if (routineEl) routineEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 220);
}

// ─── MOB CHAT OVERLAY ────────────────────────────────────────────────────────
function _closeAllMobOverlays(except?: string) {
    ['mobChatOverlay', 'mobQueenWallOverlay', 'mobGlobalOverlay'].forEach(id => {
        if (id === except) return;
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.remove('mob-overlay-open');
        el.classList.remove('mob-chat-fullscreen');
        el.style.height = '';
        el.style.top = '';
        setTimeout(() => { if (!el.classList.contains('mob-overlay-open')) el.style.display = 'none'; }, 360);
    });
    // Always restore bottom nav when switching overlays
    const nav = document.getElementById('mobBottomNav');
    if (nav) nav.style.display = '';
    if (except !== 'altar') closeAltarDrawer();
    closeLobby();
}

function _isOverlayOpen(id: string) {
    return document.getElementById(id)?.classList.contains('mob-overlay-open') ?? false;
}

export function switchMobChatTab(tab: 'chat' | 'service') {
    const chatPanel = document.getElementById('mobChatTabChat');
    const svcPanel = document.getElementById('mobChatTabService');
    const chatBtn = document.getElementById('mobChatBtnChat');
    const svcBtn = document.getElementById('mobChatBtnService');
    if (tab === 'chat') {
        if (chatPanel) chatPanel.style.display = 'flex';
        if (svcPanel) svcPanel.style.display = 'none';
        if (chatBtn) chatBtn.classList.add('active');
        if (svcBtn) svcBtn.classList.remove('active');
        setTimeout(_scrollChat, 60);
    } else {
        if (chatPanel) chatPanel.style.display = 'none';
        if (svcPanel) svcPanel.style.display = 'flex';
        if (chatBtn) chatBtn.classList.remove('active');
        if (svcBtn) svcBtn.classList.add('active');
    }
}

export function openMobChatOverlay() {
    // Toggle: if already open, close and return to profile
    if (_isOverlayOpen('mobChatOverlay')) { closeMobChatOverlay(); return; }
    _closeAllMobOverlays('mobChatOverlay');
    const el = document.getElementById('mobChatOverlay');
    if (!el) return;

    // Step 1: display:flex - browser resets scrollTop=0 on any child scroll containers.
    el.style.display = 'flex';

    // Step 2: Force sync layout so scrollHeight is computed and scroll reset is done.
    void (el as any).offsetHeight;

    // Step 3: Set scroll to bottom NOW - element is off-screen (translateY(100%)) but
    // fully rendered. CSS transform changes do NOT reset scrollTop, so this persists
    // through the slide-up animation.
    // Scroll both the outer container AND the inner content div - depending on flex
    // layout constraints, either one may be the actual scroll container on mobile.
    const b = document.getElementById('mob_chatBox');
    const bc = document.getElementById('mob_chatContent');
    if (b) b.scrollTop = b.scrollHeight + 9999;
    if (bc) bc.scrollTop = bc.scrollHeight + 9999;

    // Clear message notification
    const badge = document.getElementById('mobMsgBadge');
    if (badge) badge.classList.remove('active');
    const ring = document.querySelector('.mob-nav-queen-ring');
    if (ring) ring.classList.remove('has-new-msg');

    // Step 4: Start animation AFTER scroll is set.
    requestAnimationFrame(() => el.classList.add('mob-overlay-open'));

    _setNavActive('');
    switchMobChatTab('chat');

    // If no messages loaded yet, load them
    const content = document.getElementById('mob_chatContent');
    const email = getState().email || getState().memberId;
    if (content && !content.children.length && email) {
        loadChatHistory(email);
    }

    // Safety net scrolls - in case content is loaded async after animation
    const scrollToBottom = () => {
        if (b) b.scrollTop = b.scrollHeight + 9999;
        if (bc) bc.scrollTop = bc.scrollHeight + 9999;
    };
    el.addEventListener('transitionend', scrollToBottom, { once: true });
    setTimeout(scrollToBottom, 400);
    setTimeout(scrollToBottom, 900);

    // When input focused (typing): hide bottom nav, go fullscreen, handle keyboard
    // When input blurred: restore nav, exit fullscreen
    const input = document.getElementById('mob_chatMsgInput');
    if (input && !(input as any).__mobChatFocusAttached) {
        (input as any).__mobChatFocusAttached = true;
        input.addEventListener('focus', () => {
            const nav = document.getElementById('mobBottomNav');
            if (nav) nav.style.display = 'none';
            el.classList.add('mob-chat-fullscreen');
            const queenBtn = document.querySelector('.mob-nav-queen-btn') as HTMLElement | null;
            if (queenBtn) queenBtn.classList.add('mob-nav-queen-shrink');
        });
        input.addEventListener('blur', () => {
            const nav = document.getElementById('mobBottomNav');
            if (nav) nav.style.display = '';
            el.classList.remove('mob-chat-fullscreen');
            el.style.height = '';
            el.style.top = '';
            const queenBtn = document.querySelector('.mob-nav-queen-btn') as HTMLElement | null;
            if (queenBtn) queenBtn.classList.remove('mob-nav-queen-shrink');
        });
    }

    // iOS keyboard: resize overlay to visual viewport when typing
    if (window.visualViewport && !(el as any).__vpAttached) {
        (el as any).__vpAttached = true;
        const onVPResize = () => {
            if (!el.classList.contains('mob-chat-fullscreen')) return;
            const vp = window.visualViewport!;
            el.style.height = vp.height + 'px';
            el.style.top = vp.offsetTop + 'px';
            requestAnimationFrame(() => {
                const box = document.getElementById('mob_chatBox');
                if (box) box.scrollTop = box.scrollHeight + 9999;
            });
        };
        window.visualViewport.addEventListener('resize', onVPResize);
        window.visualViewport.addEventListener('scroll', onVPResize);
    }
}

export function closeMobChatOverlay() {
    const el = document.getElementById('mobChatOverlay');
    if (!el) return;
    // Dismiss keyboard first
    const input = document.getElementById('mob_chatMsgInput') as HTMLInputElement | null;
    if (input) input.blur();
    el.classList.remove('mob-overlay-open');
    el.classList.remove('mob-chat-fullscreen');
    // Reset inline styles from visualViewport handler
    el.style.height = '';
    el.style.top = '';
    setTimeout(() => {
        if (!el.classList.contains('mob-overlay-open')) el.style.display = 'none';
        // Restore bottom nav
        const nav = document.getElementById('mobBottomNav');
        if (nav) nav.style.display = '';
    }, 360);
    _setNavActive('profile');
}

// ─── MOB QUEEN'S WALL OVERLAY ────────────────────────────────────────────────
export function openMobQueenWall() {
    if (_isOverlayOpen('mobQueenWallOverlay')) { closeMobQueenWall(); return; }
    _closeAllMobOverlays('mobQueenWallOverlay');
    const el = document.getElementById('mobQueenWallOverlay');
    if (!el) return;
    el.style.display = 'flex';
    requestAnimationFrame(() => el.classList.add('mob-overlay-open'));
    _setNavActive('queen');
    _loadMobQueenPosts();
}

export function closeMobQueenWall() {
    const el = document.getElementById('mobQueenWallOverlay');
    if (!el) return;
    // Pause all playing videos before hiding
    el.querySelectorAll('video').forEach(v => { v.pause(); v.removeAttribute('src'); v.load(); });
    el.classList.remove('mob-overlay-open');
    setTimeout(() => { if (!el.classList.contains('mob-overlay-open')) el.style.display = 'none'; }, 360);
    _setNavActive('profile');
}

async function _loadMobQueenPosts() {
    const container = document.getElementById('mobQWallContent');
    if (!container) return;
    // Don't reload if already has content
    if (container.children.length > 0) return;
    container.innerHTML = `<div style="text-align:center;padding:50px;color:#444;font-family:Orbitron;font-size:0.55rem;letter-spacing:2px">LOADING...</div>`;
    try {
        const res = await fetch('/api/posts', { cache: 'no-store' });
        const data = await res.json();
        if (!data.success || !data.posts?.length) {
            container.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#333;font-family:Orbitron;font-size:0.75rem;letter-spacing:3px">NO TRANSMISSIONS YET</div>`;
            return;
        }
        container.innerHTML = data.posts.map((p: any) => {
            const locked = !p.userHasAccess;
            const isVideo = p.media_type === 'video';
            const d = new Date(p.created_at || p._createdDate || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();

            // Media section
            let mediaHTML = '';
            if (p.media_url) {
                if (locked) {
                    const previewUrl = p.thumbnail_url || (!isVideo ? getOptimizedUrl(p.media_url, 600) : null);
                    mediaHTML = `<div style="position:relative;width:100%;overflow:hidden;">
                        ${previewUrl ? `<img src="${previewUrl}" alt="" style="width:100%;display:block;object-fit:cover;max-height:260px;filter:blur(12px) brightness(0.35);transform:scale(1.06);" onerror="this.style.display='none'" />` : `<div style="width:100%;height:180px;background:radial-gradient(ellipse at center,#15100a 0%,#080808 100%);"></div>`}
                        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(0,0,0,0.45);">
                            <div style="width:48px;height:48px;border-radius:50%;border:2px solid rgba(197,160,89,0.5);background:rgba(197,160,89,0.06);display:flex;align-items:center;justify-content:center;">
                                ${isVideo
                                    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polygon points="6,4 20,12 6,20" fill="rgba(197,160,89,0.8)"/></svg>`
                                    : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="rgba(197,160,89,0.7)" stroke-width="1.8"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="rgba(197,160,89,0.7)" stroke-width="1.8" stroke-linecap="round"/></svg>`
                                }
                            </div>
                            ${p.price > 0 ? `<div style="font-family:Orbitron;font-size:0.48rem;color:#c5a059;letter-spacing:1.5px;display:flex;align-items:center;gap:5px;"><svg width="11" height="11" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="#c5a059" stroke-width="1.8" fill="none"/><path d="M12 6v12M9 9h4.5a1.5 1.5 0 0 1 0 3H10.5a1.5 1.5 0 0 0 0 3H15" stroke="#c5a059" stroke-width="1.5" stroke-linecap="round"/></svg>${p.price} COINS</div>` : ''}
                            ${p.min_rank && p.min_rank !== 'Hall Boy' ? `<div style="font-family:Orbitron;font-size:0.38rem;color:#555;letter-spacing:1.5px;">REQUIRES ${(p.min_rank || '').toUpperCase()}</div>` : ''}
                            ${p.price > 0 ? `<button onclick="window.unlockPost('${p.id}', ${p.price})" style="background:#c5a059;color:#000;border:none;font-family:Orbitron;font-size:0.45rem;letter-spacing:2px;padding:8px 18px;border-radius:2px;cursor:pointer;font-weight:700;">UNLOCK</button>` : ''}
                        </div>
                    </div>`;
                } else if (isVideo) {
                    mediaHTML = `<div style="position:relative;width:100%;overflow:hidden;background:#000;cursor:pointer;" onclick="var v=this.querySelector('video');if(v){this.querySelector('.vid-play-btn').style.display='none';v.setAttribute('controls','');v.setAttribute('src',v.dataset.src);v.load();v.play();}"><div class="vid-play-btn" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:2;"><div style="width:56px;height:56px;border-radius:50%;background:rgba(197,160,89,0.9);display:flex;align-items:center;justify-content:center;font-size:1.5rem;">▶</div></div><video data-src="${p.media_url}" playsinline preload="none" onerror="if(!this.dataset.retried){this.dataset.retried='1';this.src='/api/media?url='+encodeURIComponent(this.src);this.load();}" style="width:100%;display:block;max-height:340px;object-fit:cover;pointer-events:none;"></video></div>`;
                } else {
                    mediaHTML = `<img src="${getOptimizedUrl(p.media_url, 600)}" alt="" style="width:100%;display:block;object-fit:cover;max-height:340px;" onerror="if(!this.dataset.retried){this.dataset.retried='1';this.src='/api/media?url='+encodeURIComponent(this.src);}else{this.style.display='none';}" />`;
                }
            }

            return `<div class="mob-qwall-post">
                ${mediaHTML}
                <div class="mob-qwall-post-body">
                    ${p.title ? `<div class="mob-qwall-post-title">${p.title}</div>` : ''}
                    ${!locked && p.content ? `<div class="mob-qwall-post-content">${p.content}</div>` : ''}
                    <div class="mob-qwall-post-date">${d}</div>
                </div>
            </div>`;
        }).join('');
    } catch {
        container.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#333;font-family:Orbitron;font-size:0.75rem">UNABLE TO LOAD</div>`;
    }
}

// ─── MOB GLOBAL OVERLAY ──────────────────────────────────────────────────────
const _mobGlLoaded: Record<string, boolean> = {};
let _mobGlActivePeriod = 'today';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _mobGlRealtimeChannel: any = null;
const _mobGlPendingSent = new Set<string>();

// ─── REPLY STATE ──────────────────────────────────────────────────────────────
let _mobGlReply: { id: string; name: string; text: string } | null = null;
let _profileChatReply: { id: string; name: string; text: string } | null = null;

function _ensureMobGlReplyBar() {
    if (document.getElementById('mobGlReplyBar')) return;
    const feed = document.getElementById('mobGlTalkFeed');
    if (!feed) return;
    const bar = document.createElement('div');
    bar.id = 'mobGlReplyBar';
    bar.style.cssText = 'display:none;align-items:center;gap:10px;padding:7px 12px;background:rgba(197,160,89,0.07);border-top:1px solid rgba(197,160,89,0.18);flex-shrink:0;';
    bar.innerHTML = `
        <div style="flex:1;min-width:0;border-left:2px solid rgba(197,160,89,0.6);padding-left:8px;">
            <div id="mobGlReplyBarName" style="font-family:Orbitron;font-size:0.33rem;color:rgba(197,160,89,0.8);letter-spacing:1px;margin-bottom:2px;"></div>
            <div id="mobGlReplyBarText" style="font-family:Rajdhani;font-size:0.78rem;color:rgba(255,255,255,0.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
        </div>
        <button onclick="window.cancelMobGlReply()" style="background:none;border:none;color:rgba(255,255,255,0.35);cursor:pointer;font-size:1rem;padding:4px 6px;flex-shrink:0;line-height:1;">✕</button>`;
    feed.insertAdjacentElement('afterend', bar);
}

export function setMobGlReply(id: string, name: string, text: string) {
    _mobGlReply = { id, name, text };
    _ensureMobGlReplyBar();
    const bar = document.getElementById('mobGlReplyBar');
    if (bar) bar.style.display = 'flex';
    const nameEl = document.getElementById('mobGlReplyBarName');
    const textEl = document.getElementById('mobGlReplyBarText');
    if (nameEl) nameEl.innerHTML = `<svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="rgba(197,160,89,0.8)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px;"><polyline points="8 16 3 11 8 6"></polyline><path d="M17 4v7a4 4 0 0 1-4 4H3"></path></svg>` + name;
    if (textEl) textEl.textContent = text.slice(0, 80);
    document.getElementById('mobGlTalkInput')?.focus();
}

export function cancelMobGlReply() {
    _mobGlReply = null;
    const bar = document.getElementById('mobGlReplyBar');
    if (bar) bar.style.display = 'none';
}

function _ensureProfileChatReplyBar() {
    if (document.getElementById('profileChatReplyBar')) return;
    const footer = document.querySelector('.chat-footer');
    if (!footer) return;
    const bar = document.createElement('div');
    bar.id = 'profileChatReplyBar';
    bar.style.cssText = 'display:none;align-items:center;gap:10px;padding:7px 14px;background:rgba(197,160,89,0.07);border-top:1px solid rgba(197,160,89,0.18);flex-shrink:0;';
    bar.innerHTML = `
        <div style="flex:1;min-width:0;border-left:2px solid rgba(197,160,89,0.6);padding-left:8px;">
            <div id="profileChatReplyBarName" style="font-family:Orbitron;font-size:0.33rem;color:rgba(197,160,89,0.8);letter-spacing:1px;margin-bottom:2px;"></div>
            <div id="profileChatReplyBarText" style="font-family:Rajdhani;font-size:0.78rem;color:rgba(255,255,255,0.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
        </div>
        <button onclick="window.cancelProfileChatReply()" style="background:none;border:none;color:rgba(255,255,255,0.35);cursor:pointer;font-size:1rem;padding:4px 6px;flex-shrink:0;line-height:1;">✕</button>`;
    footer.insertBefore(bar, footer.firstChild);
}

export function setProfileChatReply(id: string, name: string, text: string) {
    _profileChatReply = { id, name, text };
    _ensureProfileChatReplyBar();
    const bar = document.getElementById('profileChatReplyBar');
    if (bar) bar.style.display = 'flex';
    const nameEl = document.getElementById('profileChatReplyBarName');
    const textEl = document.getElementById('profileChatReplyBarText');
    if (nameEl) nameEl.innerHTML = `<svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="rgba(197,160,89,0.8)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px;"><polyline points="8 16 3 11 8 6"></polyline><path d="M17 4v7a4 4 0 0 1-4 4H3"></path></svg>` + name;
    if (textEl) textEl.textContent = text.slice(0, 80);
    (document.getElementById('chatMsgInput') || document.getElementById('mob_chatMsgInput'))?.focus();
}

export function cancelProfileChatReply() {
    _profileChatReply = null;
    const bar = document.getElementById('profileChatReplyBar');
    if (bar) bar.style.display = 'none';
}

export function openMobGlobal() {
    if (_isOverlayOpen('mobGlobalOverlay')) { closeMobGlobal(); return; }
    _closeAllMobOverlays('mobGlobalOverlay');
    const el = document.getElementById('mobGlobalOverlay');
    if (!el) return;
    el.style.display = 'flex';
    requestAnimationFrame(() => el.classList.add('mob-overlay-open'));
    _setNavActive('global');
    _switchMobGlTab('talk');
}

export function closeMobGlobal() {
    const el = document.getElementById('mobGlobalOverlay');
    if (!el) return;
    el.classList.remove('mob-overlay-open');
    setTimeout(() => { if (!el.classList.contains('mob-overlay-open')) el.style.display = 'none'; }, 360);
    _setNavActive('profile');
    if (_mobGlRealtimeChannel) { _mobGlRealtimeChannel.unsubscribe(); _mobGlRealtimeChannel = null; }
    _mobGlLoaded['talk'] = false;
}

export function switchMobGlTab(tab: string) { _switchMobGlTab(tab); }

function _switchMobGlTab(tab: string) {
    // Update tab buttons
    document.querySelectorAll('.mob-gl-tab').forEach(t => t.classList.remove('active'));
    const activeTab = document.getElementById(`mobGlTab_${tab}`);
    if (activeTab) activeTab.classList.add('active');

    // Show/hide panels
    document.querySelectorAll('.mob-gl-panel').forEach(p => (p as HTMLElement).style.display = 'none');
    const activePanel = document.getElementById(`mobGlPanel_${tab}`);
    if (activePanel) activePanel.style.display = 'flex';

    // Load content if not loaded yet
    if (tab === 'rank') _loadMobGlLeaderboard(_mobGlActivePeriod);
    else if (tab === 'talk') {
        _loadMobGlTalk();
        // Always scroll to bottom when switching to talk (even if already loaded)
        const c = document.getElementById('mobGlTalkFeed');
        if (c) {
            requestAnimationFrame(() => requestAnimationFrame(() => { c.scrollTop = c.scrollHeight + 9999; }));
            setTimeout(() => { c.scrollTop = c.scrollHeight + 9999; }, 200);
        }
    }
    else if (tab === 'challenges') _loadMobGlChallenges();
    else if (tab === 'updates') _loadMobGlUpdates();
}

export function switchMobGlPeriod(period: string) {
    _mobGlActivePeriod = period;
    _mobGlLoaded['rank'] = false;
    document.querySelectorAll('.mob-gl-period-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`mobGlPeriod_${period}`);
    if (btn) btn.classList.add('active');
    _loadMobGlLeaderboard(period);
}

async function _loadMobGlLeaderboard(period: string) {
    if (_mobGlLoaded[`rank_${period}`]) return;
    const container = document.getElementById('mobGlRankList');
    if (!container) return;
    container.innerHTML = `<div style="text-align:center;padding:40px;color:#444;font-family:Orbitron;font-size:0.55rem;letter-spacing:2px">LOADING...</div>`;
    try {
        const res = await fetch(`/api/global/leaderboard?period=${period}`, { cache: 'no-store' });
        const data = await res.json();
        const entries: any[] = data.leaderboard || data.entries || [];
        if (!entries.length) {
            container.innerHTML = `<div style="text-align:center;padding:40px;color:#333;font-family:Orbitron;font-size:0.75rem;letter-spacing:3px">NO DATA YET</div>`;
            return;
        }
        const MEDALS_MOB = ['🥇', '🥈', '🥉'];
        const MEDAL_COLORS_MOB = ['#FFD700', '#C0C0C0', '#CD7F32'];
        const top3 = entries.slice(0, 3);
        const rest = entries.slice(3);

        const top3Html = top3.map((e: any, i: number) => `
            <div class="mob-gl-rank-row mob-gl-rank-row--top mob-gl-rank-row--rank${i + 1}">
                <div class="mob-gl-rank-medal">${MEDALS_MOB[i]}</div>
                ${e.avatar ? `<img src="${e.avatar}" class="mob-gl-rank-avatar mob-gl-rank-avatar--top" alt="" onerror="this.style.display='none'"/>` : `<div class="mob-gl-rank-avatar-placeholder mob-gl-rank-avatar--top"></div>`}
                <div class="mob-gl-rank-info">
                    <div class="mob-gl-rank-name mob-gl-rank-name--top">${e.name || e.member_id || 'SLAVE'}</div>
                    ${e.hierarchy ? `<div class="mob-gl-rank-tier" style="color:${MEDAL_COLORS_MOB[i]}">${e.hierarchy}</div>` : ''}
                </div>
                <span class="mob-gl-rank-score mob-gl-rank-score--top" style="color:${MEDAL_COLORS_MOB[i]}">${(e.score ?? 0).toLocaleString()}</span>
            </div>
        `).join('');

        const restHtml = rest.map((e: any, i: number) => `
            <div class="mob-gl-rank-row">
                <span class="mob-gl-rank-num">${i + 4}</span>
                ${e.avatar ? `<img src="${e.avatar}" class="mob-gl-rank-avatar" alt="" onerror="this.style.display='none'"/>` : `<div class="mob-gl-rank-avatar-placeholder"></div>`}
                <div class="mob-gl-rank-info">
                    <div class="mob-gl-rank-name">${e.name || e.member_id || 'SLAVE'}</div>
                    ${e.hierarchy ? `<div class="mob-gl-rank-tier">${e.hierarchy}</div>` : ''}
                </div>
                <span class="mob-gl-rank-score">${(e.score ?? 0).toLocaleString()}</span>
            </div>
        `).join('');

        container.innerHTML = top3Html + (restHtml ? `<div class="mob-gl-rank-divider"></div>${restHtml}` : '');
        _mobGlLoaded[`rank_${period}`] = true;
    } catch {
        container.innerHTML = `<div style="text-align:center;padding:40px;color:#333;font-family:Orbitron;font-size:0.75rem">UNABLE TO LOAD</div>`;
    }
}

async function _loadMobGlTalk() {
    if (_mobGlLoaded['talk']) return;
    const container = document.getElementById('mobGlTalkFeed');
    if (!container) return;
    container.innerHTML = `<div style="text-align:center;padding:40px;color:#444;font-family:Orbitron;font-size:0.55rem;letter-spacing:2px">LOADING...</div>`;
    try {
        const res = await fetch('/api/global/messages', { cache: 'no-store' });
        const data = await res.json();
        const msgs: any[] = data.messages || [];
        _renderMobGlTalk(msgs);
        _mobGlLoaded['talk'] = true;
        _initMobGlRealtime();
    } catch {
        container.innerHTML = `<div style="text-align:center;padding:40px;color:#333;font-family:Orbitron;font-size:0.75rem">UNABLE TO LOAD</div>`;
    }
}

function _initMobGlRealtime() {
    if (_mobGlRealtimeChannel) return;
    const sb = createClient();
    _mobGlRealtimeChannel = sb
        .channel('mob_global_messages_channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'global_messages' },
            (payload: any) => {
                const msg = payload.new;
                const dedupKey = msg.media_url || msg.message || '';
                if (_mobGlPendingSent.has(dedupKey)) {
                    _mobGlPendingSent.delete(dedupKey);
                    return;
                }
                _appendMobGlMessage(msg);
            }
        )
        .subscribe();
}

const MOB_QUEEN_EMAILS = ['ceo@qkarin.com'];

function _buildMobGlBubble(msg: any): string {
    const time = new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const senderEmail = (msg.sender_email || '').toLowerCase();
    const isQueen = MOB_QUEEN_EMAILS.includes(senderEmail);
    const { memberId, id } = getState();
    const myEmail = ((memberId || id || '') as string).toLowerCase();
    const isMe = !isQueen && !!myEmail && senderEmail === myEmail;
    void isMe; // reserved for future alignment; queen is sole Cinzel user
    const name = msg.sender_name || msg.sender_email?.split('@')[0] || 'SUBJECT';
    const content = msg.message || '';
    const msgId = msg.id || '';
    const nameSafe = name.replace(/'/g, '&#39;').replace(/\\/g, '\\\\');
    const contentSafe = content.slice(0, 80).replace(/'/g, '&#39;').replace(/\\/g, '\\\\').replace(/\n/g, ' ');
    const SVG_REPLY_MOB = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path></svg>`;
    const SVG_CROWN_MOB = `<svg width="11" height="9" viewBox="0 0 26 20" fill="#c5a059" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M2 18 L5 8 L10 13 L13 3 L16 13 L21 8 L24 18 Z"/><rect x="2" y="17" width="22" height="2" rx="1"/></svg>`;
    const replyBtn = msgId ? `<button class="mob-gl-reply-btn" onclick="event.stopPropagation();window.setMobGlReply('${msgId}','${nameSafe}','${contentSafe}')" title="Reply">${SVG_REPLY_MOB}</button>` : '';
    const quoteHtml = msg.reply_to ? `<div style="border-left:2px solid rgba(197,160,89,0.5);padding:3px 8px;margin-bottom:4px;background:rgba(197,160,89,0.05);border-radius:0 4px 4px 0;">
        <div style="display:flex;align-items:center;gap:4px;font-family:'Orbitron';font-size:0.3rem;color:rgba(197,160,89,0.7);letter-spacing:1px;margin-bottom:1px;white-space:nowrap;overflow:hidden;"><svg width="9" height="9" viewBox="0 0 20 20" fill="none" stroke="rgba(197,160,89,0.7)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="8 16 3 11 8 6"></polyline><path d="M17 4v7a4 4 0 0 1-4 4H3"></path></svg><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${(msg.reply_to.sender_name || '').replace(/</g, '&lt;')}</span></div>
        <div style="font-family:'Rajdhani';font-size:0.75rem;color:rgba(255,255,255,0.38);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${(msg.reply_to.content || '').slice(0, 55).replace(/</g, '&lt;')}</div>
    </div>` : '';

    // PROMOTION CARD - same card as desktop global chat
    if (content.startsWith('PROMOTION_CARD::')) {
        try {
            const d = JSON.parse(content.replace('PROMOTION_CARD::', ''));
            const initials = (d.name || 'S')[0].toUpperCase();
            const photoBlock = d.photo
                ? `<img src="${d.photo}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                : '';
            const photoFallback = `<div style="${d.photo ? 'display:none;' : ''}position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,rgba(197,160,89,0.08),rgba(197,160,89,0.02));"><div style="width:60px;height:60px;border-radius:50%;border:1px solid rgba(197,160,89,0.4);display:flex;align-items:center;justify-content:center;font-family:'Orbitron',sans-serif;font-size:1.4rem;color:#c5a059;">${initials}</div></div>`;
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;">
                <div style="width:85%;max-width:340px;min-width:200px;">
                    <div style="width:100%;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0e0b06 0%,#110d04 60%,#0a0703 100%);border:1px solid rgba(197,160,89,0.5);box-shadow:0 12px 40px rgba(0,0,0,0.8);">
                        <div style="position:relative;width:100%;height:140px;background:#0a0703;overflow:hidden;">
                            ${photoBlock}${photoFallback}
                            <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,#0e0b06 100%);"></div>
                            <div style="position:absolute;top:10px;left:50%;transform:translateX(-50%);background:rgba(10,7,2,0.9);border:1px solid rgba(197,160,89,0.5);border-radius:20px;padding:4px 14px;white-space:nowrap;"><span style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:#c5a059;letter-spacing:3px;">RANK PROMOTION</span></div>
                        </div>
                        <div style="padding:14px 18px 18px;text-align:center;">
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.95rem;color:#fff;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">${d.name || ''}</div>
                            <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:12px;">
                                <span style="font-family:'Orbitron',sans-serif;font-size:0.48rem;color:rgba(197,160,89,0.4);letter-spacing:1px;text-decoration:line-through;">${(d.oldRank || '').toUpperCase()}</span>
                                <span style="color:rgba(197,160,89,0.7);">→</span>
                                <span style="font-family:'Orbitron',sans-serif;font-size:0.55rem;color:#c5a059;letter-spacing:2px;font-weight:700;">${(d.newRank || '').toUpperCase()}</span>
                            </div>
                            <div style="width:70%;height:1px;background:linear-gradient(to right,transparent,rgba(197,160,89,0.35),transparent);margin:0 auto;"></div>
                        </div>
                    </div>
                    <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div>
                </div>
            </div>`;
        } catch { /* fall through to plain text */ }
    }

    // CHALLENGE JOIN CARD
    if (content.startsWith('CHALLENGE_JOIN_CARD::')) {
        try {
            const d = JSON.parse(content.replace('CHALLENGE_JOIN_CARD::', ''));
            const initials = (d.name || 'S')[0].toUpperCase();
            const photoBlock = d.photo ? `<img src="${d.photo}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : '';
            const bgImg = d.challengeImage ? `background-image:url('${d.challengeImage}');background-size:cover;background-position:center;` : '';
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;">
                <div style="width:85%;max-width:340px;min-width:200px;">
                    <div style="width:100%;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#060e08 0%,#040d06 60%,#030a04 100%);border:1px solid rgba(74,222,128,0.45);box-shadow:0 12px 40px rgba(0,0,0,0.8);">
                        <div style="position:relative;width:100%;height:130px;background:#030a04;overflow:hidden;${bgImg}">
                            <div style="position:absolute;inset:0;background:rgba(0,0,0,0.55);"></div>
                            <div style="position:relative;z-index:1;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
                                <div style="width:48px;height:48px;border-radius:50%;overflow:hidden;border:2px solid rgba(74,222,128,0.6);position:relative;">${photoBlock}<div style="${d.photo ? 'display:none;' : ''}position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(74,222,128,0.1);font-family:'Orbitron';font-size:1.1rem;color:#4ade80;">${initials}</div></div>
                            </div>
                            <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,#060e08 100%);"></div>
                            <div style="position:absolute;top:8px;left:50%;transform:translateX(-50%);background:rgba(3,10,4,0.9);border:1px solid rgba(74,222,128,0.5);border-radius:20px;padding:3px 12px;white-space:nowrap;"><span style="font-family:'Orbitron',sans-serif;font-size:0.4rem;color:#4ade80;letter-spacing:2px;">⚔ JOINED CHALLENGE</span></div>
                        </div>
                        <div style="padding:12px 16px 16px;text-align:center;">
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.9rem;color:#fff;font-weight:700;letter-spacing:2px;margin-bottom:4px;">${d.name||''}</div>
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(74,222,128,0.7);letter-spacing:1px;margin-bottom:8px;">${(d.challengeName||'').toUpperCase()}</div>
                            <div style="display:inline-flex;align-items:center;gap:5px;background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.2);border-radius:20px;padding:3px 12px;">
                                <span style="width:5px;height:5px;border-radius:50%;background:#4ade80;box-shadow:0 0 6px #4ade80;display:inline-block;"></span>
                                <span style="font-family:'Orbitron',sans-serif;font-size:0.4rem;color:#4ade80;letter-spacing:2px;">ACTIVE USERS: ${d.activeCount||0}</span>
                            </div>
                        </div>
                    </div>
                    <div style="font-family:'Orbitron';font-size:0.36rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div>
                </div>
            </div>`;
        } catch { /* fall through */ }
    }

    // CHALLENGE ELIMINATED CARD
    if (content.startsWith('CHALLENGE_ELIM_CARD::')) {
        try {
            const d = JSON.parse(content.replace('CHALLENGE_ELIM_CARD::', ''));
            const initials = (d.name || 'S')[0].toUpperCase();
            const photoBlock = d.photo ? `<img src="${d.photo}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : '';
            const bgImg = d.challengeImage ? `background-image:url('${d.challengeImage}');background-size:cover;background-position:center;` : '';
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;">
                <div style="width:85%;max-width:340px;min-width:200px;">
                    <div style="width:100%;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0e0606 0%,#0d0404 60%,#0a0303 100%);border:1px solid rgba(224,48,48,0.4);box-shadow:0 12px 40px rgba(0,0,0,0.8);">
                        <div style="position:relative;width:100%;height:130px;background:#0a0303;overflow:hidden;${bgImg}">
                            <div style="position:absolute;inset:0;background:rgba(0,0,0,0.6);"></div>
                            <div style="position:relative;z-index:1;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
                                <div style="width:48px;height:48px;border-radius:50%;overflow:hidden;border:2px solid rgba(224,48,48,0.5);position:relative;">${photoBlock}<div style="${d.photo ? 'display:none;' : ''}position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(224,48,48,0.1);font-family:'Orbitron';font-size:1.1rem;color:#e03030;">${initials}</div></div>
                            </div>
                            <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,#0e0606 100%);"></div>
                            <div style="position:absolute;top:8px;left:50%;transform:translateX(-50%);background:rgba(10,3,3,0.9);border:1px solid rgba(224,48,48,0.45);border-radius:20px;padding:3px 12px;white-space:nowrap;"><span style="font-family:'Orbitron',sans-serif;font-size:0.4rem;color:#e03030;letter-spacing:2px;">✕ ELIMINATED</span></div>
                        </div>
                        <div style="padding:12px 16px 16px;text-align:center;">
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.9rem;color:#fff;font-weight:700;letter-spacing:2px;margin-bottom:4px;">${d.name||''}</div>
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(224,48,48,0.7);letter-spacing:1px;margin-bottom:8px;">${(d.challengeName||'').toUpperCase()}</div>
                            <div style="display:inline-flex;align-items:center;gap:5px;background:rgba(74,222,128,0.06);border:1px solid rgba(74,222,128,0.18);border-radius:20px;padding:3px 12px;">
                                <span style="width:5px;height:5px;border-radius:50%;background:#4ade80;display:inline-block;"></span>
                                <span style="font-family:'Orbitron',sans-serif;font-size:0.4rem;color:#4ade80;letter-spacing:2px;">STILL IN: ${d.activeCount||0}</span>
                            </div>
                        </div>
                    </div>
                    <div style="font-family:'Orbitron';font-size:0.36rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div>
                </div>
            </div>`;
        } catch { /* fall through */ }
    }

    // CHALLENGE INVITE CARD
    if (content.startsWith('CHALLENGE_INVITE_CARD::')) {
        try {
            const d = JSON.parse(content.replace('CHALLENGE_INVITE_CARD::', ''));
            const bgImg = d.challengeImage ? `background-image:url('${d.challengeImage}');background-size:cover;background-position:center;` : '';
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;">
                <div style="width:85%;max-width:340px;min-width:200px;">
                    <div style="width:100%;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0e0b06 0%,#0d0a04 60%,#0a0803 100%);border:1px solid rgba(197,160,89,0.5);box-shadow:0 12px 40px rgba(0,0,0,0.8);">
                        <div style="position:relative;width:100%;height:130px;background:#0a0803;overflow:hidden;${bgImg}">
                            <div style="position:absolute;inset:0;background:rgba(0,0,0,0.55);"></div>
                            <div style="position:relative;z-index:1;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
                                <div style="font-family:'Orbitron',sans-serif;font-size:2rem;color:rgba(197,160,89,0.6);">⚔</div>
                            </div>
                            <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,#0e0b06 100%);"></div>
                            <div style="position:absolute;top:8px;left:50%;transform:translateX(-50%);background:rgba(10,8,3,0.9);border:1px solid rgba(197,160,89,0.5);border-radius:20px;padding:3px 12px;white-space:nowrap;"><span style="font-family:'Orbitron',sans-serif;font-size:0.4rem;color:#c5a059;letter-spacing:2px;">⚔ CHALLENGE INVITATION</span></div>
                        </div>
                        <div style="padding:12px 16px 16px;text-align:center;">
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.9rem;color:#fff;font-weight:700;letter-spacing:2px;margin-bottom:6px;">${(d.challengeName||'').toUpperCase()}</div>
                            <div style="font-family:'Rajdhani',sans-serif;font-size:0.78rem;color:#777;margin-bottom:10px;">${d.durationDays||'?'} days · ${d.tasksPerDay||'?'} tasks/day · ${(d.joinCost||0).toLocaleString()} coins</div>
                            <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:10px;">
                                <div style="display:inline-flex;align-items:center;gap:5px;background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.2);border-radius:20px;padding:3px 12px;">
                                    <span style="width:5px;height:5px;border-radius:50%;background:#4ade80;box-shadow:0 0 6px #4ade80;display:inline-block;"></span>
                                    <span style="font-family:'Orbitron',sans-serif;font-size:0.38rem;color:#4ade80;letter-spacing:2px;">ACTIVE: ${d.activeCount||0}</span>
                                </div>
                            </div>
                            <div onclick="(window._openChallengePanel||function(){})(event,'${d.challengeId}');event.stopPropagation();" style="padding:8px 20px;background:linear-gradient(135deg,rgba(197,160,89,0.2),rgba(197,160,89,0.08));border:1px solid rgba(197,160,89,0.4);border-radius:8px;cursor:pointer;display:inline-block;">
                                <span style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:#c5a059;letter-spacing:2px;font-weight:700;">TAP TO JOIN ⚔</span>
                            </div>
                        </div>
                    </div>
                    <div style="font-family:'Orbitron';font-size:0.36rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div>
                </div>
            </div>`;
        } catch { /* fall through */ }
    }

    const mediaHtml = msg.media_url
        ? (msg.media_type === 'video'
            ? `<div style="position:relative;width:100%;background:#000;border-radius:8px;margin-top:8px;cursor:pointer;" onclick="var v=this.querySelector('video');if(v){this.querySelector('.vid-play-btn').style.display='none';v.setAttribute('controls','');v.setAttribute('src',v.dataset.src);v.load();v.play();}"><div class="vid-play-btn" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:2;border-radius:8px;"><div style="width:50px;height:50px;border-radius:50%;background:rgba(197,160,89,0.9);display:flex;align-items:center;justify-content:center;font-size:1.3rem;">▶</div></div><video data-src="${msg.media_url}" playsinline preload="none" style="width:100%;border-radius:8px;max-height:260px;object-fit:cover;display:block;pointer-events:none;"></video></div>`
            : `<img src="${msg.media_url}" style="width:100%;border-radius:8px;margin-top:8px;max-height:260px;object-fit:cover;display:block;" />`)
        : '';

    const av = msg.sender_avatar || null;
    const avatarHtml = av
        ? `<img src="${av}" style="width:18px;height:18px;border-radius:50%;object-fit:cover;border:1px solid rgba(197,160,89,0.4);flex-shrink:0;" onerror="this.style.display='none'">`
        : `<div style="width:18px;height:18px;border-radius:50%;background:rgba(197,160,89,0.15);border:1px solid rgba(197,160,89,0.25);display:flex;align-items:center;justify-content:center;font-family:Orbitron;font-size:0.38rem;color:#c5a059;flex-shrink:0;">${(name[0]||'S').toUpperCase()}</div>`;

    if (isQueen) {
        const qAvHtml = av
            ? `<img src="${av}" style="width:18px;height:18px;border-radius:50%;object-fit:cover;border:1.5px solid rgba(197,160,89,0.7);flex-shrink:0;" onerror="this.style.display='none'">`
            : `<img src="/queen-nav.png" style="width:18px;height:18px;border-radius:50%;object-fit:cover;border:1.5px solid rgba(197,160,89,0.7);flex-shrink:0;">`;
        return `<div style="padding:8px 12px 10px;margin-bottom:6px;background:linear-gradient(135deg,rgba(197,160,89,0.14),rgba(100,75,15,0.08));border:1.5px solid rgba(197,160,89,0.75);border-radius:10px;box-shadow:0 0 14px rgba(197,160,89,0.12);overflow:hidden;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;gap:6px;">
                <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
                    ${qAvHtml}
                    <div style="display:flex;align-items:center;gap:4px;white-space:nowrap;flex-shrink:0;">${SVG_CROWN_MOB}<span style="font-family:'Orbitron',sans-serif;font-size:0.75rem;color:#c5a059;letter-spacing:1px;font-weight:700;white-space:nowrap;">QUEEN KARIN</span></div>
                    <span style="font-family:'Orbitron';font-size:0.38rem;color:rgba(197,160,89,0.6);white-space:nowrap;flex-shrink:0;"> · ${time}</span>
                </div>
                ${replyBtn}
            </div>
            ${quoteHtml}<span style="font-family:'Orbitron',sans-serif;font-size:0.82rem;color:rgba(255,255,255,0.6);line-height:1.5;">${content}</span>
            ${mediaHtml}
        </div>`;
    }

    // UPDATE PHOTO CARD
    if (content.startsWith('UPDATE_PHOTO_CARD::')) {
        try {
            const d = JSON.parse(content.replace('UPDATE_PHOTO_CARD::', ''));
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;">
                <div style="width:85%;max-width:340px;min-width:200px;">
                    <div style="background:#0a0a14;border:1px solid rgba(197,160,89,0.2);border-radius:14px;overflow:hidden;width:100%;box-shadow:0 8px 30px rgba(0,0,0,0.5);">
                        <img src="${d.mediaUrl}" style="width:100%;max-height:220px;object-fit:cover;display:block;" loading="lazy" onerror="this.style.display='none'">
                        <div style="padding:10px 14px 12px;">
                            <div style="display:flex;align-items:center;justify-content:space-between;">
                                <span style="font-family:'Orbitron';font-size:0.75rem;color:#fff;font-weight:700;">${d.senderName||''}</span>
                                <span style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.35);">${time}</span>
                            </div>
                            ${d.caption ? `<div style="font-family:'Rajdhani';font-size:0.72rem;color:rgba(255,255,255,0.5);margin-top:3px;">${d.caption}</div>` : ''}
                        </div>
                    </div>
                </div>
            </div>`;
        } catch { /* fall through */ }
    }

    // UPDATE TRIBUTE CARD
    if (content.startsWith('UPDATE_TRIBUTE_CARD::')) {
        try {
            const d = JSON.parse(content.replace('UPDATE_TRIBUTE_CARD::', ''));
            const tInitial = (d.senderName || 'S')[0].toUpperCase();
            const coverSrc = d.image || d.senderAvatar || '';
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;">
                <div style="width:85%;max-width:340px;min-width:200px;">
                    <div style="background:#0a0a14;border:1px solid rgba(197,160,89,0.35);border-radius:14px;overflow:hidden;width:100%;box-shadow:0 8px 30px rgba(0,0,0,0.5);">
                        <div style="width:100%;height:130px;overflow:hidden;position:relative;background:#0d0d1a;display:flex;align-items:center;justify-content:center;">
                            ${coverSrc ? `<img src="${coverSrc}" style="width:100%;height:100%;object-fit:cover;object-position:center;" onerror="this.style.display='none'">` : ''}
                            <div style="display:${coverSrc ? 'none' : 'flex'};position:absolute;inset:0;align-items:center;justify-content:center;font-family:'Orbitron';font-size:2.5rem;color:rgba(197,160,89,0.4);">${tInitial}</div>
                            <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 50%,rgba(10,10,20,0.88) 100%);"></div>
                            <div style="position:absolute;bottom:10px;left:14px;font-family:'Orbitron';font-size:0.4rem;color:rgba(197,160,89,0.75);letter-spacing:2px;">✦ GIFT SENT</div>
                        </div>
                        <div style="padding:10px 14px 12px;">
                            <div style="font-family:'Orbitron';font-size:0.82rem;color:#fff;font-weight:700;letter-spacing:1px;text-transform:uppercase;">${d.title||''}</div>
                            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;">
                                <span style="font-family:'Orbitron';font-size:0.42rem;color:rgba(255,255,255,0.55);letter-spacing:1px;">${d.senderName||''}</span>
                                <span style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.35);">${time}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        } catch { /* fall through */ }
    }

    // CHALLENGE TASK CARD
    if (content.startsWith('CHALLENGE_TASK_CARD::')) {
        try {
            const d = JSON.parse(content.replace('CHALLENGE_TASK_CARD::', ''));
            const cInitial = (d.senderName || 'S')[0].toUpperCase();
            const passed = d.passed !== false;
            const accentColor = passed ? '#4ade80' : '#e03030';
            const accentBg = passed ? 'rgba(74,222,128,0.05)' : 'rgba(224,48,48,0.05)';
            const accentBorder = passed ? 'rgba(74,222,128,0.25)' : 'rgba(224,48,48,0.25)';
            const label = passed ? '✓ TASK PASSED' : '✕ TASK FAILED';
            const subLabel = passed
                ? `Day ${d.dayNumber||'?'} · Task ${d.windowNumber||'?'} - continues${d.taskNum ? ` (${d.taskNum})` : ''}`
                : `Day ${d.dayNumber||'?'} · Task ${d.windowNumber||'?'} - eliminated`;
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;">
                <div style="width:85%;max-width:340px;min-width:200px;">
                    <div style="background:${accentBg};border:1px solid ${accentBorder};border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;box-sizing:border-box;">
                        <div style="width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,0.05);border:1.5px solid ${accentBorder};overflow:hidden;position:relative;flex-shrink:0;">
                            ${d.senderAvatar ? `<img src="${d.senderAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none'">` : ''}
                            <div style="display:${d.senderAvatar ? 'none' : 'flex'};position:absolute;inset:0;align-items:center;justify-content:center;font-family:'Orbitron';font-size:0.65rem;color:${accentColor};">${cInitial}</div>
                        </div>
                        <div style="flex:1;min-width:0;">
                            <div style="font-family:'Orbitron';font-size:0.4rem;color:${accentColor};letter-spacing:1px;margin-bottom:2px;">${label}</div>
                            <div style="font-family:'Orbitron';font-size:0.8rem;color:#fff;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.senderName||''}</div>
                            <div style="font-family:'Rajdhani';font-size:0.7rem;color:rgba(255,255,255,0.45);margin-top:2px;">${subLabel}</div>
                            ${passed && d.points ? `<div style="font-family:'Orbitron';font-size:0.7rem;color:#a78bfa;font-weight:700;margin-top:2px;">+${d.points} pts</div>` : ''}
                        </div>
                        <div style="font-family:'Orbitron';font-size:0.36rem;color:rgba(255,255,255,0.35);flex-shrink:0;align-self:flex-start;">${time}</div>
                    </div>
                </div>
            </div>`;
        } catch { /* fall through */ }
    }

    // GIF CARD
    if (msg.media_type === 'gif' || (content === '[GIF]' && msg.media_url)) {
        const gifUrl = msg.media_url;
        const gifCard = `
            <div style="max-width:240px;width:60vw;border-radius:14px;overflow:hidden;background:linear-gradient(170deg,#0e0b06,#110d04,#0a0703);border:1px solid rgba(197,160,89,0.35);box-shadow:0 8px 30px rgba(0,0,0,0.7);">
                <img src="${gifUrl}" style="width:100%;display:block;max-height:200px;object-fit:contain;" onerror="this.style.display='none'" />
            </div>`;
        return `<div class="mob-gl-talk-msg">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                <div style="display:flex;align-items:center;gap:5px;min-width:0;flex:1;">
                    ${avatarHtml}
                    <span class="mob-gl-talk-name">${name}</span>
                    <span class="mob-gl-talk-time"> · ${time}</span>
                </div>
                ${replyBtn}
            </div>
            ${gifCard}
        </div>`;
    }

    // UPDATE MERIT CARD
    if (content.startsWith('UPDATE_MERIT_CARD::')) {
        try {
            const d = JSON.parse(content.replace('UPDATE_MERIT_CARD::', ''));
            const mInitial = (d.senderName || 'S')[0].toUpperCase();
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;">
                <div style="width:85%;max-width:340px;min-width:200px;">
                    <div style="background:rgba(167,139,250,0.05);border:1px solid rgba(167,139,250,0.25);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;box-sizing:border-box;">
                        <div style="width:42px;height:42px;border-radius:50%;background:rgba(167,139,250,0.1);border:1.5px solid rgba(167,139,250,0.35);overflow:hidden;position:relative;flex-shrink:0;">
                            ${d.senderAvatar ? `<img src="${d.senderAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none'">` : ''}
                            <div style="display:${d.senderAvatar ? 'none' : 'flex'};position:absolute;inset:0;align-items:center;justify-content:center;font-family:'Orbitron';font-size:0.65rem;color:#a78bfa;">${mInitial}</div>
                        </div>
                        <div style="flex:1;min-width:0;">
                            <div style="font-family:'Orbitron';font-size:0.4rem;color:rgba(255,255,255,0.5);letter-spacing:1px;margin-bottom:2px;">⚡ MERIT EARNED</div>
                            <div style="font-family:'Orbitron';font-size:0.8rem;color:#fff;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.senderName||''}</div>
                            <div style="font-family:'Orbitron';font-size:0.82rem;color:#a78bfa;font-weight:700;margin-top:2px;">+${d.points||0} MERIT</div>
                        </div>
                        <div style="font-family:'Orbitron';font-size:0.36rem;color:rgba(255,255,255,0.35);flex-shrink:0;align-self:flex-start;">${time}</div>
                    </div>
                </div>
            </div>`;
        } catch { /* fall through */ }
    }

    const contentEl = `<span class="mob-gl-talk-content">${content}</span>`;

    return `<div class="mob-gl-talk-msg">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            <div style="display:flex;align-items:center;gap:5px;min-width:0;flex:1;">
                ${avatarHtml}
                <span class="mob-gl-talk-name">${name}</span>
                <span class="mob-gl-talk-time"> · ${time}</span>
            </div>
            ${replyBtn}
        </div>
        ${quoteHtml ? `<div style="margin-bottom:3px;">${quoteHtml}</div>` : ''}
        ${contentEl}
        ${mediaHtml}
    </div>`;
}

function _appendMobGlMessage(msg: any) {
    const container = document.getElementById('mobGlTalkFeed');
    if (!container || !msg?.message) return;
    const el = document.createElement('div');
    el.innerHTML = _buildMobGlBubble(msg);
    container.appendChild(el.firstElementChild!);
    requestAnimationFrame(() => requestAnimationFrame(() => { container.scrollTop = container.scrollHeight + 9999; }));
}

function _renderMobGlTalk(msgs: any[]) {
    const container = document.getElementById('mobGlTalkFeed');
    if (!container) return;
    if (!msgs.length) {
        container.innerHTML = `<div style="text-align:center;padding:40px;color:#333;font-family:Orbitron;font-size:0.75rem;letter-spacing:3px">NO MESSAGES YET</div>`;
        return;
    }
    container.innerHTML = msgs.map((m: any) => _buildMobGlBubble(m)).join('');
    const scrollBottom = () => { container.scrollTop = container.scrollHeight + 9999; };
    // Double-RAF: after layout is fully computed
    requestAnimationFrame(() => requestAnimationFrame(scrollBottom));
    setTimeout(scrollBottom, 200);
    setTimeout(scrollBottom, 600);  // catch slow image loads
    // Attach image load handlers so promo cards / avatars trigger re-scroll
    (container.querySelectorAll('img') as NodeListOf<HTMLImageElement>).forEach(img => {
        if (!img.complete) {
            img.addEventListener('load', scrollBottom, { once: true });
            img.addEventListener('error', scrollBottom, { once: true });
        }
    });
}

export async function sendMobGlMessage() {
    const input = document.getElementById('mobGlTalkInput') as HTMLInputElement;
    if (!input || !input.value.trim()) return;
    const content = input.value.trim();
    input.value = '';

    const { memberId, id, raw } = getState();
    const senderEmail = memberId || id;
    if (!senderEmail) return;

    // Capture and clear reply before sending
    const replyTo = _mobGlReply ? { sender_name: _mobGlReply.name, content: _mobGlReply.text } : null;
    cancelMobGlReply();

    // Track for dedup - realtime will fire for our own message too
    _mobGlPendingSent.add(content);

    // Optimistic update
    _appendMobGlMessage({
        sender_name: raw?.name || senderEmail.split('@')[0] || 'SUBJECT',
        sender_email: senderEmail,
        message: content,
        reply_to: replyTo,
        created_at: new Date().toISOString(),
    });

    try {
        await fetch('/api/global/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: content, senderEmail, reply_to: replyTo })
        });
    } catch {
        console.warn('[MOB_GLOBAL] Failed to send message');
    }
}

export function handleMobGlKey(e: KeyboardEvent) {
    if (e.key === 'Enter') sendMobGlMessage();
}

// ─── MOBILE GLOBAL GIF PICKER ────────────────────────────────────────────────

let _mobGlGifOpen = false;
let _mobGlGifTimeout: ReturnType<typeof setTimeout> | null = null;

async function _sendMobGlGif(gifUrl: string) {
    const { memberId, id, raw } = getState();
    const senderEmail = memberId || id;
    if (!senderEmail) return;

    // Track for dedup - realtime will fire for our own message too
    _mobGlPendingSent.add(gifUrl);

    // Optimistic render into the mobile global feed
    _appendMobGlMessage({
        sender_name: raw?.name || senderEmail.split('@')[0] || 'SUBJECT',
        sender_email: senderEmail,
        message: '[GIF]',
        media_url: gifUrl,
        media_type: 'gif',
        created_at: new Date().toISOString(),
    });

    try {
        await fetch('/api/global/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: '[GIF]', senderEmail, media_url: gifUrl, media_type: 'gif' }),
        });
    } catch {}
}

export function openMobGlGifPicker() {
    if (_mobGlGifOpen) { closeMobGlGifPicker(); return; }
    _mobGlGifOpen = true;

    const existing = document.getElementById('mobGlGifPickerOverlay');
    if (existing) existing.remove();

    const talkPanel = document.getElementById('mobGlPanel_talk');
    let talkFooter: Element | null = null;
    let parentContainer: Element | null = null;

    if (talkPanel) {
        talkFooter = talkPanel.querySelector('.mob-gl-talk-footer');
        parentContainer = talkPanel;
    }

    const panel = document.createElement('div');
    panel.id = 'mobGlGifPickerOverlay';
    panel.style.cssText = `
        max-height:45vh;overflow-y:auto;
        border-top:1px solid rgba(197,160,89,0.15);
        background:#0d0b08;padding:8px;flex-shrink:0;
    `;

    panel.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:8px;">
            <input id="mobGlGifSearchInput" type="text" placeholder="Search GIFs..." autocomplete="off"
                style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;font-family:'Rajdhani',sans-serif;font-size:0.95rem;padding:7px 11px;border-radius:6px;outline:none;" />
            <button onclick="window.closeMobGlGifPicker()" style="background:none;border:none;color:rgba(255,255,255,0.35);font-size:1.1rem;cursor:pointer;">✕</button>
        </div>
        <div id="mobGlGifGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;">
            <div style="grid-column:1/-1;text-align:center;padding:20px;font-family:'Orbitron';font-size:0.5rem;color:rgba(255,255,255,0.2);">LOADING...</div>
        </div>
        <div style="padding:5px 0;text-align:right;">
            <span style="font-family:'Orbitron';font-size:0.32rem;color:rgba(255,255,255,0.12);letter-spacing:1px;">via Tenor</span>
        </div>
    `;

    if (talkFooter && parentContainer) {
        parentContainer.insertBefore(panel, talkFooter);
    } else {
        panel.style.cssText = `
            position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
            width:min(420px, 96vw);max-height:55vh;
            background:#0d0b08;border:1px solid rgba(197,160,89,0.25);border-radius:12px;
            display:flex;flex-direction:column;overflow:hidden;z-index:1000002;
            box-shadow:0 8px 40px rgba(0,0,0,0.7);
        `;
        document.body.appendChild(panel);
    }

    const searchInput = panel.querySelector('#mobGlGifSearchInput') as HTMLInputElement;
    searchInput?.addEventListener('input', () => {
        if (_mobGlGifTimeout) clearTimeout(_mobGlGifTimeout);
        _mobGlGifTimeout = setTimeout(() => _searchMobGlGifs(searchInput.value || 'funny'), 400);
    });

    _searchMobGlGifs('funny');
    setTimeout(() => searchInput?.focus(), 50);
}

async function _searchMobGlGifs(q: string) {
    const grid = document.getElementById('mobGlGifGrid');
    if (!grid) return;
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;font-family:'Orbitron';font-size:0.5rem;color:rgba(255,255,255,0.2);">LOADING...</div>`;

    try {
        const res = await fetch(`/api/global/gifs?q=${encodeURIComponent(q)}`);
        const { results } = await res.json();
        if (!results?.length) {
            grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;font-family:'Orbitron';font-size:0.5rem;color:rgba(255,255,255,0.2);">NO RESULTS</div>`;
            return;
        }
        grid.innerHTML = results.map((r: any) => `
            <div onclick="window._selectMobGlGif('${encodeURIComponent(r.url)}')" style="cursor:pointer;border-radius:6px;overflow:hidden;aspect-ratio:1;background:rgba(255,255,255,0.04);">
                <img src="${r.preview}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.parentElement.style.display='none'">
            </div>
        `).join('');
    } catch {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;font-family:'Orbitron';font-size:0.5rem;color:rgba(255,255,255,0.2);">FAILED TO LOAD</div>`;
    }
}

export function closeMobGlGifPicker() {
    _mobGlGifOpen = false;
    document.getElementById('mobGlGifPickerOverlay')?.remove();
}

if (typeof window !== 'undefined') {
    (window as any).openMobGlGifPicker = openMobGlGifPicker;
    (window as any).closeMobGlGifPicker = closeMobGlGifPicker;
    (window as any)._selectMobGlGif = (encodedUrl: string) => {
        const url = decodeURIComponent(encodedUrl);
        closeMobGlGifPicker();
        _sendMobGlGif(url);
    };
}

async function _loadMobGlChallenges() {
    if (_mobGlLoaded['challenges']) return;
    const container = document.getElementById('mobGlChallengesFeed');
    if (!container) return;
    container.innerHTML = `<div style="text-align:center;padding:40px;color:#444;font-family:Orbitron;font-size:0.55rem;letter-spacing:2px">LOADING...</div>`;
    try {
        const [chalRes, partRes] = await Promise.all([
            fetch('/api/challenges', { cache: 'no-store' }),
            fetch('/api/challenges/my-status', { cache: 'no-store' }).catch(() => null),
        ]);
        const { challenges } = await chalRes.json();
        const myStatuses: Record<string, string> = {};
        if (partRes?.ok) {
            const partJson = await partRes.json();
            (partJson.participations || []).forEach((p: any) => { myStatuses[p.challenge_id] = p.status; });
        }
        const now = Date.now();
        const active = (challenges || []).filter((c: any) => c.status === 'active');
        const upcoming = (challenges || []).filter((c: any) =>
            c.status === 'draft' && c.start_date && new Date(c.start_date).getTime() > now
        );
        const all = [...active, ...upcoming];
        if (!all.length) {
            container.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;padding:40px;"><span style="font-size:2rem;opacity:0.2;">⚔</span><span style="font-family:'Orbitron';font-size:0.45rem;color:rgba(74,222,128,0.3);letter-spacing:2px;text-align:center;">NO ACTIVE CHALLENGES</span></div>`;
            return;
        }
        container.innerHTML = all.map((c: any) => {
            const isLive = c.status === 'active';
            const startsSoon = !isLive;
            const daysLeft = c.end_date ? Math.max(0, Math.ceil((new Date(c.end_date).getTime() - now) / 86400000)) : null;
            const startDate = c.start_date ? new Date(c.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;
            const stats = [
                { label: 'Days', val: String(c.duration_days) },
                { label: 'Tasks a day', val: String(c.tasks_per_day) },
                { label: 'Window', val: `${c.window_minutes} min` },
                { label: 'Still working', val: String(c.participant_active ?? '-') },
                ...(daysLeft !== null && isLive ? [{ label: 'Days left', val: String(daysLeft) }] : []),
                ...(startsSoon && startDate ? [{ label: 'Starts', val: startDate }] : []),
            ];
            const statsHtml = stats.map(({ label, val }) =>
                `<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
                    <span style="font-family:'Rajdhani',sans-serif;font-size:0.85rem;color:rgba(255,255,255,0.38);letter-spacing:0.5px;">${label}</span>
                    <span style="font-family:'Orbitron',sans-serif;font-size:0.85rem;color:rgba(197,160,89,0.9);font-weight:700;">${val}</span>
                </div>`
            ).join('');
            const badgeStyle = startsSoon
                ? 'background:rgba(251,191,36,0.9);color:#000;'
                : 'background:rgba(74,222,128,0.9);color:#000;';
            const badgeText = startsSoon ? 'SOON' : 'LIVE';
            const imgBlock = c.image_url
                ? `<img src="${c.image_url}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none'" alt="${c.name}">`
                : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:2rem;opacity:0.2;background:linear-gradient(135deg,rgba(197,160,89,0.1),rgba(197,160,89,0.04));">★</div>`;
            return `<div style="margin:10px 12px;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.02);">
                <div style="display:flex;gap:0;">
                    <!-- Image -->
                    <div style="width:130px;min-height:180px;flex-shrink:0;position:relative;background:rgba(197,160,89,0.06);">
                        ${imgBlock}
                        <div style="position:absolute;top:10px;left:10px;${badgeStyle}border-radius:6px;padding:3px 8px;font-family:'Orbitron',monospace;font-size:0.32rem;font-weight:700;letter-spacing:1px;">${badgeText}</div>
                    </div>
                    <!-- Info -->
                    <div style="flex:1;padding:16px 16px 14px;display:flex;flex-direction:column;gap:10px;justify-content:space-between;min-width:0;">
                        <div>
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.95rem;color:#fff;font-weight:700;letter-spacing:1px;margin-bottom:5px;">${c.name}</div>
                            ${c.description ? `<div style="font-family:'Orbitron',sans-serif;font-size:0.58rem;color:rgba(255,255,255,0.35);line-height:1.5;letter-spacing:0.5px;">${c.description}</div>` : ''}
                        </div>
                        <div style="display:flex;flex-direction:column;">${statsHtml}</div>
                        ${myStatuses[c.id]
                            ? `<div style="width:100%;padding:9px 0;border-radius:8px;border:1px solid rgba(74,222,128,0.3);text-align:center;background:rgba(74,222,128,0.08);color:#4ade80;font-family:'Orbitron';font-size:0.42rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;" onclick="(window._openChallengePanel||function(){})(event,'${c.id}');event.stopPropagation();">${myStatuses[c.id] === 'active' ? '✓ ENROLLED' : myStatuses[c.id] === 'eliminated' ? 'ELIMINATED' : myStatuses[c.id].toUpperCase()}</div>`
                            : `<button onclick="(window._openChallengePanel||function(){})(event,'${c.id}');event.stopPropagation();" style="width:100%;padding:9px 0;border-radius:8px;border:none;cursor:pointer;background:linear-gradient(135deg,#c5a059 0%,#8b6914 100%);color:#000;font-family:'Orbitron';font-size:0.52rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;box-shadow:0 4px 15px rgba(197,160,89,0.3);">JOIN CHALLENGE</button>`
                        }
                    </div>
                </div>
            </div>`;
        }).join('');
        _mobGlLoaded['challenges'] = true;
    } catch {
        container.innerHTML = `<div style="text-align:center;padding:40px;color:#333;font-family:Orbitron;font-size:0.75rem">UNABLE TO LOAD</div>`;
    }
}

export async function mobJoinChallenge(e: Event, challengeId: string) {
    e.stopPropagation();
    const btn = (e.target as HTMLElement);
    btn.textContent = '...';
    btn.setAttribute('disabled', 'true');
    try {
        const res = await fetch(`/api/challenges/${challengeId}/join`, { method: 'POST' });
        const json = await res.json();
        if (json.success) {
            btn.textContent = json.already_joined ? 'JOINED' : '✓ IN';
            btn.style.color = '#4ade80';
            btn.style.borderColor = 'rgba(74,222,128,0.3)';
        } else {
            btn.textContent = 'ERR';
        }
    } catch {
        btn.textContent = 'ERR';
    }
}

function _buildMobUpdateCard(u: any): string {
    const time = new Date(u.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (u.kind === 'tribute') {
        const coverSrc = u.image || u.sender_avatar || '';
        const initial = (u.sender_name || 'S')[0].toUpperCase();
        return `<div style="margin-bottom:16px;background:#0a0a14;border:1px solid rgba(197,160,89,0.35);border-radius:14px;overflow:hidden;width:100%;box-shadow:0 8px 30px rgba(0,0,0,0.5);">
            <div style="width:100%;height:140px;overflow:hidden;position:relative;background:#0d0d1a;display:flex;align-items:center;justify-content:center;">
                ${coverSrc ? `<img src="${coverSrc}" style="width:100%;height:100%;object-fit:cover;object-position:center;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
                <div style="display:${coverSrc ? 'none' : 'flex'};position:absolute;inset:0;align-items:center;justify-content:center;font-family:'Orbitron';font-size:3rem;color:rgba(197,160,89,0.4);">${initial}</div>
                <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 50%,rgba(10,10,20,0.88) 100%);"></div>
                <div style="position:absolute;bottom:10px;left:14px;font-family:'Orbitron';font-size:0.4rem;color:rgba(197,160,89,0.75);letter-spacing:2px;">✦ GIFT SENT</div>
            </div>
            <div style="padding:12px 14px 14px;">
                <div style="font-family:'Orbitron';font-size:0.82rem;color:#fff;font-weight:700;letter-spacing:1px;text-transform:uppercase;line-height:1.3;">${u.title || ''}</div>
                <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;">
                    <span style="font-family:'Orbitron';font-size:0.42rem;color:rgba(255,255,255,0.65);letter-spacing:1px;">${u.sender_name || ''}</span>
                    <span style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.45);">${time}</span>
                </div>
            </div>
        </div>`;
    }
    if (u.kind === 'points') {
        const initial = (u.sender_name || 'S')[0].toUpperCase();
        return `<div style="margin-bottom:16px;background:rgba(167,139,250,0.05);border:1px solid rgba(167,139,250,0.25);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:14px;width:100%;box-sizing:border-box;">
            <div style="width:42px;height:42px;border-radius:50%;background:rgba(167,139,250,0.1);border:1.5px solid rgba(167,139,250,0.35);overflow:hidden;position:relative;flex-shrink:0;">
                ${u.sender_avatar ? `<img src="${u.sender_avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
                <div style="display:${u.sender_avatar ? 'none' : 'flex'};position:absolute;inset:0;align-items:center;justify-content:center;font-family:'Orbitron';font-size:0.65rem;color:#a78bfa;">${initial}</div>
            </div>
            <div style="flex:1;min-width:0;">
                <div style="font-family:'Orbitron';font-size:0.42rem;color:rgba(255,255,255,0.55);letter-spacing:1px;margin-bottom:3px;">⚡ MERIT EARNED</div>
                <div style="font-family:'Orbitron';font-size:0.82rem;color:#fff;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${u.sender_name || ''}</div>
                <div style="font-family:'Orbitron';font-size:0.85rem;color:#a78bfa;font-weight:700;margin-top:2px;">+${u.points || 0} MERIT</div>
            </div>
            <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.45);flex-shrink:0;align-self:flex-start;">${time}</div>
        </div>`;
    }
    // photo / default
    if (u.media_url) {
        return `<div style="margin-bottom:16px;background:#0a0a14;border:1px solid rgba(197,160,89,0.1);border-radius:10px;overflow:hidden;width:100%;position:relative;">
            <img src="${getOptimizedUrl(u.media_url, 600)}" style="width:100%;max-height:240px;object-fit:cover;display:block;" loading="lazy" onerror="this.style.display='none'">
            <div style="position:absolute;bottom:0;left:0;right:0;padding:8px 10px;background:linear-gradient(transparent,rgba(0,0,0,0.88));">
                <div style="font-family:'Orbitron';font-size:0.62rem;color:#fff;">${u.sender_name || ''} <span style="font-family:'Orbitron';font-size:0.35rem;color:rgba(255,255,255,0.55);">${time}</span></div>
                ${u.caption ? `<div style="font-family:'Rajdhani';font-size:0.72rem;color:rgba(255,255,255,0.55);margin-top:2px;">${u.caption}</div>` : ''}
            </div>
        </div>`;
    }
    // fallback text card
    return `<div style="margin-bottom:16px;background:rgba(255,255,255,0.02);border:1px solid rgba(197,160,89,0.12);border-radius:8px;padding:12px 14px;">
        ${u.title ? `<div style="font-family:'Orbitron';font-size:0.7rem;color:#c5a059;letter-spacing:2px;margin-bottom:4px;">${u.title}</div>` : ''}
        ${u.content ? `<div style="font-family:'Crimson Text';font-size:0.85rem;color:#bbb;line-height:1.5;">${u.content}</div>` : ''}
        <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.35);margin-top:6px;letter-spacing:1px;">${time}</div>
    </div>`;
}

async function _loadMobGlUpdates() {
    if (_mobGlLoaded['updates']) return;
    const container = document.getElementById('mobGlUpdatesFeed');
    if (!container) return;
    container.innerHTML = `<div style="text-align:center;padding:40px;color:#444;font-family:Orbitron;font-size:0.55rem;letter-spacing:2px">LOADING...</div>`;
    try {
        const res = await fetch('/api/global/updates', { cache: 'no-store' });
        const data = await res.json();
        const updates: any[] = data.updates || data.posts || [];
        if (!updates.length) {
            container.innerHTML = `<div style="text-align:center;padding:40px;color:#333;font-family:Orbitron;font-size:0.75rem;letter-spacing:3px">NO UPDATES YET</div>`;
            return;
        }
        container.innerHTML = updates.map((u: any) => _buildMobUpdateCard(u)).join('');
        _mobGlLoaded['updates'] = true;
    } catch {
        container.innerHTML = `<div style="text-align:center;padding:40px;color:#333;font-family:Orbitron;font-size:0.75rem">UNABLE TO LOAD</div>`;
    }
}

export function closeModal() { document.getElementById('glassModal')!.style.display = 'none'; }
export function closePoverty() {
    document.getElementById('povertyModal')?.remove();
    if (window.innerWidth <= 768) {
        const wishlist = document.getElementById('mob_TributeOverlay');
        if (wishlist) wishlist.style.display = 'none';
    }
}
export function goToExchequer() {
    closePoverty();
    if (window.innerWidth <= 768) {
        closeMobChatOverlay();
        // Mobile: show the dedicated exchequer overlay
        const overlay = document.getElementById('mobExchequer');
        if (overlay) { overlay.classList.remove('hidden'); overlay.style.display = 'flex'; }
    } else {
        switchTab('buy');
    }
}
export function closeRewardCard() { document.getElementById('rewardCardOverlay')?.classList.add('hidden'); }
export function closeExchequer() {
    const overlay = document.getElementById('mobExchequer');
    if (overlay) { overlay.classList.add('hidden'); overlay.style.display = 'none'; }
}

export function showLobbyAction(type: string) {
    // Close the hub first so the modal renders on top cleanly
    closeLobby();

    const state = getState();
    const raw = (window as any).__currentProfileRaw || state.raw || state;
    const params = raw?.parameters || {};

    if (type === 'photo') {
        handleProfileUpload();
        return;
    }
    if (type === 'name') {
        openTextFieldModal('name', 'Display Name', raw?.name || '');
        return;
    }
    if (type === 'routine') {
        openTextFieldModal('routine', 'ROUTINE', raw?.routine || '');
        return;
    }
    if (type === 'kinks') {
        const existing = Array.isArray(params.kinks) ? params.kinks.join(', ') : (params.kinks || raw?.kinks || '');
        openTextFieldModal('kinks', 'KINKS', existing);
        return;
    }
    if (type === 'limits') {
        const existing = Array.isArray(params.limits) ? params.limits.join(', ') : (params.limits || raw?.limits || '');
        openTextFieldModal('limits', 'LIMITS', existing);
        return;
    }
}

export function confirmLobbyAction() { backToLobbyMenu(); }

export function backToLobbyMenu() {
    document.getElementById('lobbyMenu')?.classList.remove('hidden');
    document.getElementById('lobbyActionView')?.classList.add('hidden');
}

export function selectRoutineItem(el: HTMLElement, type: string) {
    document.querySelectorAll('.routine-tile').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
}

async function _doProfileUpload() {
    // iOS Safari blocks programmatic input.click() if called after any await.
    // Solution: create input and click it synchronously first,
    // then resolve the user email inside the onchange handler.
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1;';
    document.body.appendChild(input);

    input.onchange = async () => {
        const file = input.files?.[0];
        document.body.removeChild(input);
        if (!file) return;

        const elProfilePic = document.getElementById('profilePic') as HTMLImageElement;
        const elHudPic = document.getElementById('hudUserPic') as HTMLImageElement;
        if (elProfilePic) elProfilePic.style.opacity = '0.5';
        if (elHudPic) elHudPic.style.opacity = '0.5';

        try {
            // Get user email here (after file selected - async is fine now)
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user?.email) {
                alert('Not logged in.');
                if (elProfilePic) elProfilePic.style.opacity = '1';
                if (elHudPic) elHudPic.style.opacity = '1';
                return;
            }

            const fd = new FormData();
            fd.append('file', file);
            fd.append('memberEmail', user.email);

            const res = await fetch('/api/upload-avatar', { method: 'POST', body: fd });
            const data = await res.json();

            if (elProfilePic) elProfilePic.style.opacity = '1';
            if (elHudPic) elHudPic.style.opacity = '1';

            if (data.success && data.url) {
                if (elProfilePic) elProfilePic.src = data.url;
                if (elHudPic) elHudPic.src = data.url;
            } else {
                alert('Photo upload failed: ' + (data.error || 'Unknown error'));
            }
        } catch (err: any) {
            if (elProfilePic) elProfilePic.style.opacity = '1';
            if (elHudPic) elHudPic.style.opacity = '1';
            alert('Photo upload failed: ' + (err.message || 'Unknown error'));
        }
    };

    // Click synchronously - must happen within the user gesture on iOS
    input.click();
}

const CHIP_LIST = ["JOI", "Humiliation", "SPH", "Findom", "D/s", "Control", "Ownership", "Chastity", "CEI", "Blackmail play", "Objectification", "Degradation", "Task submission", "CBT", "Training", "Power exchange", "Verbal domination", "Protocol", "Obedience", "Psychological domination"];
const ROUTINE_OPTIONS = ["Morning Kneel", "Chastity Check", "Cleanliness Check", "Custom Order"];

export function openTextFieldModal(fieldId: string, label: string, existingValue: string = '') {
    document.getElementById('_reqModal')?.remove();
    const overlay = document.createElement('div');
    overlay.id = '_reqModal';
    const isMobile = window.innerWidth <= 768;
    overlay.style.cssText = `position: fixed; top:0; right:0; bottom:0; left:${isMobile ? '0' : '450px'}; background: #04040e; z-index: 10000000; display: flex; flex-direction: column; `;
    const box = document.createElement('div');
    box.style.cssText = `flex: 1; overflow-y: auto; padding: 24px 32px; font-family: 'Orbitron'; `;

    // Header bar
    const header = document.createElement('div');
    header.style.cssText = `display:flex;justify-content:space-between;align-items:center;padding:12px 20px;border-bottom:1px solid rgba(197,160,89,0.15);flex-shrink:0;background:rgba(0,0,0,0.4);backdrop-filter:blur(12px);`;
    header.innerHTML = `<div style="display:flex;align-items:center;gap:8px;"><div style="width:3px;height:14px;background:#c5a059;border-radius:2px;"></div><div style="font-family:Orbitron;font-size:0.85rem;color:#c5a059;letter-spacing:4px;font-weight:700;">${label.toUpperCase()}</div></div>`;
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = `display:flex;align-items:center;gap:6px;background:none;border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.45);font-family:Orbitron;font-size:0.45rem;padding:5px 14px;cursor:pointer;border-radius:4px;letter-spacing:1px;`;
    closeBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 5 5 12 12 19"/></svg>CLOSE`;
    closeBtn.onclick = () => overlay.remove();
    header.appendChild(closeBtn);
    overlay.appendChild(header);

    const isChip = fieldId === 'kinks' || fieldId === 'limits';
    const isRoutine = fieldId === 'routine';
    const costPerItem = fieldId === 'kinks' ? 100 : fieldId === 'limits' ? 200 : 0;

    let inner = '';

    // Process existing values for chips
    const existingChips = isChip && existingValue ? existingValue.split(',').map(s => s.trim()) : [];

    if (isChip) {
        inner += `<div style="color:rgba(255,255,255,0.35);font-size:0.55rem;margin-bottom:14px;letter-spacing:1px;">SAVED ITEMS ARE FREE · NEW ITEMS: ${costPerItem} ₡ EACH · MIN 3 TOTAL</div>`;
        inner += `<div id="_chipGrid" style="display:flex;flex-direction:column;gap:6px;max-height:280px;overflow-y:auto;margin-bottom:14px;padding-right:4px;">`;
        CHIP_LIST.forEach(item => {
            const isExisting = existingChips.includes(item);
            const extraClass = isExisting ? ' _selected' : '';
            const existingAttr = isExisting ? ' data-existing="true"' : '';
            if (isExisting) {
                const coinSvg = `<svg width="11" height="11" viewBox="0 0 24 24" fill="#c5a059" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;"><circle cx="12" cy="12" r="10" stroke="#c5a059" stroke-width="2" fill="none"/><path d="M12 6v12M9 9h4.5a1.5 1.5 0 0 1 0 3H10.5a1.5 1.5 0 0 0 0 3H15" stroke="#c5a059" stroke-width="1.5" stroke-linecap="round"/></svg>`;
                inner += `<div class="_reqChip${extraClass}" data-value="${item}"${existingAttr} style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border:1px solid rgba(197,160,89,0.7);background:rgba(197,160,89,0.08);color:#c5a059;font-family:'Orbitron',sans-serif;font-size:0.8rem;cursor:pointer;border-radius:4px;transition:all 0.2s;"><span style="display:flex;align-items:center;gap:7px;">${coinSvg}${item}</span><span style="font-size:0.6rem;color:rgba(197,160,89,0.6);letter-spacing:1px;">SAVED</span></div>`;
            } else {
                inner += `<div class="_reqChip" data-value="${item}" style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border:1px solid #2a2a2a;background:rgba(0,0,0,0.5);color:#888;font-family:'Orbitron',sans-serif;font-size:0.8rem;cursor:pointer;border-radius:4px;transition:all 0.2s;"><span>${item}</span><span style="font-size:0.65rem;color:#555;">${costPerItem} ₡</span></div>`;
            }
        });
        inner += `</div><div id="_reqCostDisplay" style="color:#c5a059;font-size:0.65rem;letter-spacing:2px;margin-bottom:12px;">NEW ITEMS: 0 · TOTAL COST: 0 COINS</div>`;
    } else if (isRoutine) {
        inner += `<div style="color:rgba(255,255,255,0.35);font-size:0.55rem;margin-bottom:14px;letter-spacing:1px;">PRESET: 1,000 COINS · CUSTOM: 2,000 COINS</div>`;
        inner += `<div id="_chipGrid" style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px;">`;
        ROUTINE_OPTIONS.forEach(item => {
            const cost = item === 'Custom Order' ? 2000 : 1000;
            const isSelected = existingValue && existingValue !== '' && (existingValue === item || (item === 'Custom Order' && !ROUTINE_OPTIONS.includes(existingValue)));
            const extraClass = isSelected ? ' _selected' : '';
            const borderCol = isSelected ? '#c5a059' : '#2a2a2a';
            const textCol = isSelected ? '#c5a059' : '#888';
            const bgCol = isSelected ? 'rgba(197,160,89,0.1)' : 'rgba(0,0,0,0.5)';

            inner += `<div class="_reqChip _routineChip${extraClass}" data-value="${item}" data-cost="${cost}" style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border:1px solid ${borderCol};background:${bgCol};color:${textCol};font-family:'Orbitron',sans-serif;font-size:0.85rem;cursor:pointer;border-radius:4px;transition:all 0.2s;"><span>${item}</span><span style="font-size:0.65rem;color:#555;">${cost.toLocaleString()}</span></div>`;
        });
        const isCustom = existingValue && !ROUTINE_OPTIONS.includes(existingValue);
        const customDisplay = isCustom ? 'block' : 'none';
        const customVal = isCustom ? existingValue : '';
        inner += `</div><div id="_customRoutineWrap" style="display:${customDisplay};margin-bottom:12px;"><input id="_customRoutineInput" value="${customVal}" placeholder="Describe your custom routine..." style="width:100%;padding:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(197,160,89,0.3);color:#fff;border-radius:6px;font-family:'Orbitron';font-size:0.8rem;" /></div><div id="_reqCostDisplay" style="color:#c5a059;font-size:0.65rem;letter-spacing:2px;margin-bottom:12px;">SELECT A PROTOCOL</div>`;
    } else {
        inner += `<div style="color:rgba(255,255,255,0.35);font-size:0.55rem;margin-bottom:12px;">STORED IN YOUR PROFILE · FREE</div>`;
        inner += `<textarea id="_reqInput" placeholder="Enter your ${label.toLowerCase()}..." style="width:100%;min-height:90px;background:rgba(255,255,255,0.05);border:1px solid rgba(197,160,89,0.3);color:#fff;padding:10px;border-radius:6px;font-family:'Orbitron';font-size:0.8rem;resize:vertical;">${existingValue || ''}</textarea>`;
    }

    inner += `<div id="_reqError" style="color:#ff4444;font-size:0.55rem;margin-top:6px;display:none;margin-bottom:8px;"></div>`;
    inner += `<div style="display:flex;gap:10px;margin-top:10px;"><button id="_reqSave" style="flex:1;padding:10px;background:#c5a059;color:#000;border:none;border-radius:6px;font-family:'Orbitron';font-weight:bold;cursor:pointer;letter-spacing:1px;">SAVE</button><button id="_reqCancel" style="flex:1;padding:10px;background:transparent;color:#c5a059;border:1px solid #c5a059;border-radius:6px;font-family:'Orbitron';cursor:pointer;">CANCEL</button></div>`;

    box.innerHTML = inner;
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    if (isChip) {
        const updateCostDisplay = () => {
            const newCount = box.querySelectorAll('._reqChip:not([data-existing="true"])._selected').length;
            const costDisplay = box.querySelector('#_reqCostDisplay') as HTMLElement;
            if (costDisplay) costDisplay.innerText = `NEW ITEMS: ${newCount} · TOTAL COST: ${(newCount * costPerItem).toLocaleString()} COINS`;
        };
        updateCostDisplay(); // run once on open

        box.querySelectorAll<HTMLElement>('._reqChip').forEach(chip => {
            chip.addEventListener('click', () => {
                const isExisting = chip.getAttribute('data-existing') === 'true';
                chip.classList.toggle('_selected');
                const isOn = chip.classList.contains('_selected');
                if (isExisting) {
                    chip.style.borderColor = isOn ? 'rgba(197,160,89,0.7)' : '#2a2a2a';
                    chip.style.color = isOn ? '#c5a059' : '#555';
                    chip.style.background = isOn ? 'rgba(197,160,89,0.08)' : 'rgba(0,0,0,0.3)';
                } else {
                    chip.style.borderColor = isOn ? '#c5a059' : '#2a2a2a';
                    chip.style.color = isOn ? '#c5a059' : '#888';
                    chip.style.background = isOn ? 'rgba(197,160,89,0.1)' : 'rgba(0,0,0,0.5)';
                }
                updateCostDisplay();
            });
        });
    }

    if (isRoutine) {
        box.querySelectorAll<HTMLElement>('._routineChip').forEach(chip => {
            chip.addEventListener('click', () => {
                box.querySelectorAll<HTMLElement>('._routineChip').forEach(c => {
                    c.classList.remove('_selected');
                    c.style.borderColor = '#2a2a2a'; c.style.color = '#888'; c.style.background = 'rgba(0,0,0,0.5)';
                });
                chip.classList.add('_selected');
                chip.style.borderColor = '#c5a059'; chip.style.color = '#c5a059'; chip.style.background = 'rgba(197,160,89,0.1)';

                const isCustom = chip.getAttribute('data-value') === 'Custom Order';
                const customWrap = document.getElementById('_customRoutineWrap') as HTMLElement;
                if (customWrap) customWrap.style.display = isCustom ? 'block' : 'none';
            });
        });
    }

    document.getElementById('_reqCancel')!.addEventListener('click', () => overlay.remove());
    document.getElementById('_reqSave')!.addEventListener('click', () => saveModalData(fieldId, label, overlay, box, isChip, isRoutine, costPerItem));
}

export function renderExchequerHistory(profile: any) {
    const listEl = document.getElementById('exchequerHistoryList');
    if (!listEl) return;

    if (!profile.tributeHistory || profile.tributeHistory.length === 0) {
        listEl.innerHTML = `<div style="color: #666; font-family: 'Orbitron', sans-serif; font-size: 0.8rem; text-align: center; margin-top: 20px;">NO TRANSACTIONS RECORDED</div>`;
        return;
    }

    try {
        let historyArray = profile.tributeHistory;
        if (typeof historyArray === 'string') {
            historyArray = JSON.parse(historyArray);
        }

        if (!Array.isArray(historyArray) || historyArray.length === 0) {
            listEl.innerHTML = `<div style="color: #666; font-family: 'Orbitron', sans-serif; font-size: 0.8rem; text-align: center; margin-top: 20px;">NO TRANSACTIONS RECORDED</div>`;
            return;
        }

        let html = '';
        historyArray.slice(0, 30).forEach((t: any) => {
            const isIncome = t.type === 'income' || t.amount > 0;
            const sign = isIncome ? '+' : '';
            const color = isIncome ? '#00ff00' : '#ff4444';
            const icon = isIncome ? 'fa-arrow-left' : 'fa-arrow-right';
            const _tDate = new Date(t.date || t.created_at);
            const timeStr = isNaN(_tDate.getTime()) ? '' : _tDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

            html += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); border-radius:8px;">
                    <div style="display:flex; flex-direction:column; gap:4px; overflow:hidden;">
                        <span style="font-family:'Orbitron', sans-serif; font-size:0.85rem; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${t.message || 'Transaction'}</span>
                        <span style="font-family:'Orbitron', sans-serif; font-size:0.6rem; color:#666;">${timeStr}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px; font-family:'Orbitron', sans-serif; font-size:0.9rem; font-weight:bold; color:${color}; flex-shrink:0; margin-left:10px;">
                        <span><i class="fas ${icon}" style="font-size:0.7rem; opacity:0.7;"></i></span>
                        <span>${sign}${Math.abs(t.amount || 0).toLocaleString()} <i class="fas fa-coins" style="font-size:0.8rem; opacity:0.8;"></i></span>
                    </div>
                </div>
            `;
        });

        listEl.innerHTML = html;
    } catch (e) {
        console.error("Error parsing exchequer tribute history:", e);
        listEl.innerHTML = `<div style="color: #ff4444; font-family: 'Orbitron', sans-serif; font-size: 0.8rem; text-align: center; margin-top: 20px;">ERROR LOADING LEDGER</div>`;
    }
}

async function saveModalData(fieldId: string, label: string, overlay: HTMLElement, box: HTMLElement, isChip: boolean, isRoutine: boolean, costPerItem: number) {
    // Get email from auth session, fall back to profile state (member_id)
    const supabase = createClient();
    const { data: { user } = {} } = await supabase.auth.getUser();
    const { memberId, id } = getState();
    const email = user?.email || memberId || id;
    if (!email) { console.error('[saveModalData] No email found'); return; }

    const saveBtn = document.getElementById('_reqSave') as HTMLButtonElement;
    const errEl = document.getElementById('_reqError') as HTMLElement;
    const showErr = (msg: string) => { if (errEl) { errEl.style.display = 'block'; errEl.textContent = msg; } if (saveBtn) { saveBtn.textContent = 'SAVE'; saveBtn.disabled = false; } };

    if (saveBtn) { saveBtn.textContent = 'SAVING...'; saveBtn.disabled = true; }

    let value: string;
    let cost = 0;

    if (isChip) {
        const selected = Array.from(box.querySelectorAll<HTMLElement>('._selected')).map(el => el.getAttribute('data-value') || '').filter(Boolean);
        if (selected.length < 3) { showErr('Select at least 3 items.'); return; }
        value = selected.join(', ');
        // Only charge for newly added items - existing (already paid) ones are free
        const newItems = Array.from(box.querySelectorAll<HTMLElement>('._reqChip:not([data-existing="true"])._selected')).map(el => el.getAttribute('data-value') || '').filter(Boolean);
        cost = newItems.length * costPerItem;
    } else if (isRoutine) {
        const selectedChip = box.querySelector<HTMLElement>('._routineChip._selected');
        if (!selectedChip) { showErr('Please select a protocol.'); return; }
        const picked = selectedChip.getAttribute('data-value') || '';
        cost = parseInt(selectedChip.getAttribute('data-cost') || '1000');
        if (picked === 'Custom Order') {
            const custom = (document.getElementById('_customRoutineInput') as HTMLInputElement)?.value?.trim();
            if (!custom) { showErr('Please describe your custom routine.'); return; }
            value = custom;
        } else { value = picked; }
    } else {
        value = (document.getElementById('_reqInput') as HTMLTextAreaElement)?.value?.trim() || '';
        if (!value) { showErr('Cannot be empty.'); return; }
    }

    const res = await fetch('/api/profile-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberEmail: email, field: fieldId, value, cost })
    });
    const data = await res.json();

    if (data.error === 'INSUFFICIENT_FUNDS') {
        showErr(`Insufficient coins. You need ${cost} coins but have ${data.wallet || 0}.`);
    } else if (data.success && data.profile) {
        overlay.remove();

        // Compute deducted wallet client-side immediately - don't trust API response timing
        const currentWallet = getState().wallet || 0;
        const immediateWallet = cost > 0 ? Math.max(0, currentWallet - cost) : currentWallet;

        // Patch profile so renderProfileSidebar also uses the correct wallet
        const patchedProfile = { ...data.profile, wallet: immediateWallet };
        setState({ wallet: immediateWallet, raw: patchedProfile });
        (window as any).__currentProfileRaw = patchedProfile;

        // Force DOM update immediately on all wallet displays
        const wStr = immediateWallet.toLocaleString();
        document.querySelectorAll('#coins, #mobCoins').forEach(el => { (el as HTMLElement).innerText = wStr; });

        renderProfileSidebar(patchedProfile);
        loadChatHistory(email);
    } else {
        showErr('Save failed: ' + (data.error || 'Unknown error'));
    }
}

// ─── PROFILE MANAGEMENT MODAL ───
export function openManageProfileModal(u: any) {
    document.getElementById('_manageModal')?.remove();
    const overlay = document.createElement('div');
    overlay.id = '_manageModal';
    overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10000000;display:flex;align-items:center;justify-content:center;padding:16px;`;

    const box = document.createElement('div');
    box.style.cssText = `background:#07080f;border:1px solid #c5a059;border-radius:12px;padding:24px;width:100%;max-width:320px;font-family:'Orbitron';`;

    const getRaw = (key: string) => {
        return u[key] ? (typeof u[key] === 'string' ? u[key] : JSON.stringify(u[key])) : '';
    };

    let inner = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <div style="color:#c5a059;font-size:0.85rem;letter-spacing:3px;">MANAGE PROFILE</div>
        <button id="_closeManage" style="background:none;border:none;color:#ff4444;font-size:1.2rem;cursor:pointer;">&times;</button>
    </div>`;

    const btnStyle = `width:100%;padding:12px;margin-bottom:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(197,160,89,0.3);color:#fff;border-radius:6px;font-family:'Orbitron';font-size:0.8rem;cursor:pointer;text-align:left;display:flex;justify-content:space-between;align-items:center;`;

    inner += `<button class="_manageBtn" data-action="photo" style="${btnStyle}"><span>UPDATE PHOTO</span> <span>&#9998;</span></button>`;
    inner += `<button class="_manageBtn" data-action="field" data-field="name" data-label="IDENTITY" data-val="${getRaw('name').replace(/"/g, '&quot;')}" style="${btnStyle}"><span>EDIT IDENTITY</span> <span>&#9998;</span></button>`;
    inner += `<button class="_manageBtn" data-action="field" data-field="limits" data-label="LIMITS" data-val="${getRaw('limits').replace(/"/g, '&quot;')}" style="${btnStyle}"><span>EDIT LIMITS</span> <span>&#9998;</span></button>`;
    inner += `<button class="_manageBtn" data-action="field" data-field="kinks" data-label="KINKS" data-val="${getRaw('kinks').replace(/"/g, '&quot;')}" style="${btnStyle}"><span>EDIT KINKS</span> <span>&#9998;</span></button>`;
    inner += `<button class="_manageBtn" data-action="field" data-field="routine" data-label="ROUTINE" data-val="${getRaw('routine').replace(/"/g, '&quot;')}" style="${btnStyle}"><span>EDIT ROUTINE</span> <span>&#9998;</span></button>`;

    box.innerHTML = inner;
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    overlay.querySelector('#_closeManage')?.addEventListener('click', () => overlay.remove());

    overlay.querySelectorAll<HTMLButtonElement>('._manageBtn').forEach(btn => {
        btn.addEventListener('click', () => {
            overlay.remove();
            const action = btn.getAttribute('data-action');
            if (action === 'photo') {
                handleProfileUpload();
            } else {
                openTextFieldModal(
                    btn.getAttribute('data-field') || '',
                    btn.getAttribute('data-label') || '',
                    btn.getAttribute('data-val') || ''
                );
            }
        });
    });
}

// ─── RENDER SIDEBAR ───
let isPromoting = false;

export function renderProfileSidebar(u: any) {
    if (!u || typeof document === 'undefined') return;

    (window as any).openManageProfileModal = () => openManageProfileModal(u);

    (window as any).__profileHandlers = { uploadPhoto: handleProfileUpload, openField: openTextFieldModal };

    // 👇 ADDED SAFETY CHECK for getHierarchyReport
    const report = getHierarchyReport(u);
    if (!report) return;

    // Trigger loading tributes exactly once when profile data lands and sidebar renders
    if (globalTributes.length === 0) loadTributes();

    // Load routine widget state from server (bypasses RLS via admin API)
    updateRoutineWidget();

    // ─── AUTO PROMOTION TRIGGER ───
    if (report.canPromote && !isPromoting && u.member_id) {
        isPromoting = true;
        fetch('/api/promote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memberEmail: u.member_id })
        })
            .then(res => res.json())
            .then(data => {
                if (data.success && data.promoted) {
                    // Slight delay so the user can enjoy seeing the bars hit 100% before the reload
                    setTimeout(() => {
                        alert(`✨ PROMOTION UNLOCKED ✨\nYou have been elevated to ${data.newRank.toUpperCase()}.`);
                        window.location.reload();
                    }, 800);
                } else {
                    isPromoting = false;
                }
            })
            .catch(err => {
                console.error("Auto-promote check failed", err);
                isPromoting = false;
            });
    }

    const { currentRank, nextRank, isMax, currentBenefits, nextBenefits, requirements } = report;

    const elCurRank = document.getElementById('desk_CurrentRank');
    if (elCurRank) elCurRank.innerText = currentRank.toUpperCase();

    const elWorkingOnRank = document.getElementById('desk_WorkingOnRank');
    if (elWorkingOnRank) elWorkingOnRank.innerText = isMax ? 'MAXIMUM RANK' : nextRank.toUpperCase();

    const elDashRank = document.getElementById('desk_DashboardRank');
    if (elDashRank) elDashRank.innerText = currentRank.toUpperCase();

    // Mobile drawer rank elements
    const elDrawerCurRank = document.getElementById('drawer_CurrentRank');
    if (elDrawerCurRank) elDrawerCurRank.innerText = currentRank.toUpperCase();

    const elDrawerNextRank = document.getElementById('drawer_NextRank');
    if (elDrawerNextRank) elDrawerNextRank.innerText = isMax ? 'MAXIMUM RANK' : nextRank.toUpperCase();

    const elSubName = document.getElementById('subName');
    if (elSubName) elSubName.innerText = u.name || 'SLAVE';

    const elCurEmail = document.getElementById('subEmail');
    if (elCurEmail) elCurEmail.style.display = 'none';
    const elMobEmail = document.getElementById('mob_slaveEmail');
    if (elMobEmail) elMobEmail.style.display = 'none';

    const photoSrc = u.avatar_url || u.profile_picture_url || '';
    if (photoSrc) {
        const optimizedPic = getOptimizedUrl(photoSrc, 200);
        const elProfilePic = document.getElementById('profilePic') as HTMLImageElement;
        if (elProfilePic) elProfilePic.src = optimizedPic;
        const elMobUserPic = document.getElementById('hudUserPic') as HTMLImageElement;
        if (elMobUserPic) elMobUserPic.src = optimizedPic;
        const elMobHaloPic = document.getElementById('mob_profilePic') as HTMLImageElement;
        if (elMobHaloPic) elMobHaloPic.src = optimizedPic;
    }

    const elCurBen = document.getElementById('desk_CurrentBenefits');
    if (elCurBen) {
        elCurBen.innerHTML = currentBenefits.map(b => `<li>${b}</li>`).join('');
    }

    const elNextBen = document.getElementById('desk_NextBenefits');
    if (elNextBen) {
        elNextBen.innerHTML = isMax ? '<li>You have reached the apex of servitude.</li>' : nextBenefits.map(b => `<li>${b}</li>`).join('');
    }

    const elDrawerCurBen = document.getElementById('drawer_CurrentBenefits');
    if (elDrawerCurBen) {
        elDrawerCurBen.innerHTML = currentBenefits.map(b => `<li>${b}</li>`).join('');
    }

    const elDrawerNextBen = document.getElementById('drawer_NextBenefits');
    if (elDrawerNextBen) {
        elDrawerNextBen.innerHTML = isMax ? '<li>You have reached the apex of servitude.</li>' : nextBenefits.map(b => `<li>${b}</li>`).join('');
    }

    const toggle = document.getElementById('desk_BenefitsToggle');
    if (toggle) {
        toggle.onclick = () => {
            const list = document.getElementById('desk_CurrentBenefits');
            if (list) {
                const isHidden = list.classList.toggle('hidden');
                toggle.querySelector('span:last-child')!.textContent = isHidden ? '▼' : '▲';
            }
        };
    }

    const container = document.getElementById('desk_ProgressContainer');
    if (container) {
        const buildBar = (label: string, icon: string, current: number, target: number) => {
            const t = isMax ? current : (target || 1);
            const pct = Math.min((current / t) * 100, 100);
            const done = current >= t;
            const color = done ? '#00ff00' : '#c5a059';
            const lc = done ? '#fff' : 'rgba(255,255,255,0.4)';
            const vc = done ? '#00ff00' : '#fff';
            return `<div style="margin-bottom:12px;"><div style="display:flex;justify-content:space-between;font-size:0.6rem;font-family:'Orbitron';margin-bottom:4px;color:${lc};letter-spacing:1px;"><span>${icon} ${label}</span><span style="color:${vc}">${current.toLocaleString()} / ${t.toLocaleString()}</span></div><div style="width:100%;height:8px;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.05);border-radius:4px;overflow:hidden;"><div style="width:${pct}%;height:100%;background:${color};box-shadow:0 0 10px ${color}40;transition:width 0.5s ease;"></div></div></div>`;
        };

        const buildCheck = (label: string, status: string, fieldId?: string, existingValue?: string) => {
            const done = status === 'VERIFIED';
            const safeVal = existingValue ? existingValue.replace(/"/g, '&quot;') : '';

            const labelColor = done ? '#00ff00' : '#c5a059';

            // Map specific SVGs, coloring them dynamically based on status (green if done, gold if missing)
            let baseIcon = '';
            if (label === 'LIMITS') baseIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="${labelColor}" stroke="${labelColor}" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
            else if (label === 'KINKS') baseIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${labelColor}" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;
            else if (label === 'ROUTINE') baseIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="${labelColor}" stroke="${labelColor}" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
            else if (label === 'IDENTITY') baseIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${labelColor}" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
            else if (label === 'PHOTO') baseIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${labelColor}" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;

            const iconHtml = baseIcon;

            // Calculate count for display conditionally
            let countStr = '';
            if (done && fieldId && existingValue) {
                if (fieldId === 'kinks' || fieldId === 'limits' || fieldId === 'routine') {
                    try {
                        const parsed = JSON.parse(existingValue);
                        countStr = Array.isArray(parsed) ? `${parsed.length}` : '1';
                    } catch (e) {
                        if (existingValue.includes(',')) countStr = `${existingValue.split(',').length}`;
                        else countStr = '1';
                    }
                }
            }

            // The inner content of the button / row
            let rightSide = '';
            if (done) {
                // Green Pen SVG + Count
                const penSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00ff00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>`;
                const dispCount = countStr ? `[${countStr}] ` : '';
                rightSide = `<span style="color:#00ff00;font-weight:bold;font-size:0.65rem;font-family:'Orbitron';letter-spacing:1px;display:flex;align-items:center;gap:4px;">${dispCount}${penSvg}</span>`;
            } else {
                rightSide = `<button data-prof-action="${fieldId === 'avatar_url' ? 'photo' : 'field'}" data-prof-field="${fieldId}" data-prof-label="${label}" data-prof-value="${safeVal}" style="padding:2px 8px;background:transparent;color:#c5a059;border:1px solid #c5a059;border-radius:4px;font-family:'Orbitron';font-size:0.55rem;font-weight:bold;cursor:pointer;letter-spacing:1px;">ADD</button>`;
            }

            const wrapperStyle = `display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:0.65rem;font-family:'Orbitron';letter-spacing:1px;border-bottom:1px solid rgba(255,255,255,0.05);padding-bottom:8px;`;

            if (done && fieldId) {
                return `<div style="${wrapperStyle}">
                            <button data-prof-action="${fieldId === 'avatar_url' ? 'photo' : 'field'}" data-prof-field="${fieldId}" data-prof-label="${label}" data-prof-value="${safeVal}" style="background:none;border:none;padding:0;margin:0;cursor:pointer;display:flex;align-items:center;gap:12px;width:100%;justify-content:space-between;">
                                <span style="color:${labelColor};display:flex;align-items:center;gap:8px;font-weight:bold;font-size:0.65rem;font-family:'Orbitron';letter-spacing:1px;text-transform:uppercase;">${iconHtml} ${label}</span>
                                <span style="color:rgba(255,255,255,0.1);font-size:0.8rem;">|</span>
                                ${rightSide}
                            </button>
                        </div>`;
            } else if (done) {
                return `<div style="${wrapperStyle}">
                            <div style="display:flex;align-items:center;gap:12px;width:100%;justify-content:space-between;">
                                <span style="color:${labelColor};display:flex;align-items:center;gap:8px;font-weight:bold;font-size:0.65rem;font-family:'Orbitron';letter-spacing:1px;text-transform:uppercase;">${iconHtml} ${label}</span>
                                <span style="color:rgba(255,255,255,0.1);font-size:0.8rem;">|</span>
                                ${rightSide}
                            </div>
                        </div>`;
            } else {
                // Not done row
                return `<div style="${wrapperStyle}">
                            <span style="color:${labelColor};display:flex;align-items:center;gap:8px;font-weight:bold;font-size:0.65rem;font-family:'Orbitron';letter-spacing:1px;text-transform:uppercase;">${iconHtml} ${label}</span>
                            <div style="display:flex;align-items:center;">${rightSide}</div>
                        </div>`;
            }
        };

        const iconMap: Record<string, string> = { LABOR: '', KNEELING: '', MERIT: '', SACRIFICE: '', CONSISTENCY: '' };
        const fieldIdMap: Record<string, string> = { IDENTITY: 'name', PHOTO: 'avatar_url', LIMITS: 'limits', KINKS: 'kinks', ROUTINE: 'routine' };

        let html = '';
        requirements.forEach(r => {
            if (r.type === 'bar') {
                html += buildBar(r.label, iconMap[r.label] || '•', r.current ?? 0, r.target ?? 0);
            } else {
                // Hide IDENTITY and PHOTO rows entirely if already verified
                if ((r.label === 'IDENTITY' || r.label === 'PHOTO') && r.status === 'VERIFIED') return;
                const fieldKey = fieldIdMap[r.label];
                // Safely grab the actual string value from the profile for the modal
                const _rawVal = fieldKey ? (u[fieldKey] || u.parameters?.[fieldKey] || '') : '';
                const rawValue = _rawVal ? (typeof _rawVal === 'string' ? _rawVal : JSON.stringify(_rawVal)) : '';
                html += buildCheck(r.label, r.status ?? '', fieldKey, rawValue);
            }
        });

        container.innerHTML = html;

        // Mirror to mobile drawer
        const drawerContainer = document.getElementById('drawer_ProgressContainer');
        if (drawerContainer) {
            drawerContainer.innerHTML = html;
        }

        [container, drawerContainer].forEach(c => {
            if (!c) return;
            c.querySelectorAll<HTMLButtonElement>('[data-prof-action]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const action = btn.getAttribute('data-prof-action');
                    const field = btn.getAttribute('data-prof-field') || '';
                    const label = btn.getAttribute('data-prof-label') || '';
                    const val = btn.getAttribute('data-prof-value') || '';

                    if (action === 'photo') handleProfileUpload();
                    else if (action === 'field') openTextFieldModal(field, label, val);
                });
            });
        });

        const wStr = (u.wallet || 0).toLocaleString();
        const pStr = (u.score || 0).toLocaleString();
        document.querySelectorAll('#coins, #mobCoins').forEach(el => { (el as HTMLElement).innerText = wStr; });
        document.querySelectorAll('#points, #mobPoints').forEach(el => { (el as HTMLElement).innerText = pStr; });
    }
}
// ─── QUEEN KARIN POSTS ───────────────────────────────────────────────────────
export async function loadQueenPosts() {
    const newsGrid = document.getElementById('newsGrid');

    if (newsGrid) {
        newsGrid.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;height:300px;gap:15px;">
                <div style="width:4px;height:40px;background:#c5a059;animation:pulse 1s ease-in-out infinite alternate;"></div>
                <div style="width:4px;height:60px;background:#c5a059;animation:pulse 1s ease-in-out 0.2s infinite alternate;"></div>
                <div style="width:4px;height:40px;background:#c5a059;animation:pulse 1s ease-in-out 0.4s infinite alternate;"></div>
                <style>@keyframes pulse{from{opacity:0.2;transform:scaleY(0.6)}to{opacity:1;transform:scaleY(1)}}</style>
            </div>
        `;
    }

    try {
        const email = getState().email || '';
        const res = email
            ? await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'fetch', email }) })
            : await fetch('/api/posts', { cache: 'no-store' });
        const data = await res.json();

        if (!data.success || !data.posts || data.posts.length === 0) {
            if (newsGrid) newsGrid.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:400px;gap:15px;">
                    <div style="font-size:3rem;opacity:0.3;">👑</div>
                    <div style="font-family:Orbitron;font-size:0.8rem;color:#333;letter-spacing:3px;">NO TRANSMISSIONS YET</div>
                </div>`;
            return;
        }

        const posts = data.posts;
        const latest = posts[0];

        // ── Queen Karin card next to Tribute: show latest post ────────────
        const heroCard = document.getElementById('desk_LatestKarinPhoto');
        if (heroCard && latest) {
            const cardLocked = !latest.userHasAccess;
            const cardHasMedia = latest.media_url && !String(latest.media_url).startsWith('failed');
            // Always clear heroCard background/filter - background lives inside innerHTML as its own layer
            heroCard.style.backgroundImage = '';
            heroCard.style.backgroundSize = '';
            heroCard.style.backgroundPosition = '';
            heroCard.style.filter = '';
            if (cardHasMedia && !cardLocked) {
                heroCard.style.backgroundImage = `url('${latest.media_url}')`;
                heroCard.style.backgroundSize = 'cover';
                heroCard.style.backgroundPosition = 'center top';
            }

            const isVideo = latest.media_type === 'video';
            const rankLabel = latest.min_rank && latest.min_rank !== 'Hall Boy'
                ? latest.min_rank.toUpperCase()
                : null;

            // Thumbnail or fallback for locked background - rendered as child div so blur never touches siblings
            const lockedBgUrl = latest.thumbnail_url || (latest.media_type !== 'video' ? latest.media_url : null);
            const lockedBgLayer = lockedBgUrl
                ? `<div style="position:absolute;inset:-6%;background-image:url('${lockedBgUrl}');background-size:cover;background-position:center top;filter:blur(14px) brightness(0.22);z-index:0;"></div>`
                : `<div style="position:absolute;inset:0;background:radial-gradient(ellipse at center,#18120a 0%,#0a0808 55%,#060606 100%);z-index:0;"></div>`;

            const coinSvg = `<svg width="13" height="13" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;vertical-align:middle;"><circle cx="12" cy="12" r="10" stroke="#c5a059" stroke-width="1.8" fill="none"/><path d="M12 6v12M9 9h4.5a1.5 1.5 0 0 1 0 3H10.5a1.5 1.5 0 0 0 0 3H15" stroke="#c5a059" stroke-width="1.5" stroke-linecap="round"/></svg>`;

            heroCard.innerHTML = cardLocked ? `
                <div style="position:absolute;inset:0;overflow:hidden;z-index:1;">
                    ${lockedBgLayer}

                    <!-- NEW VIDEO / NEW POST badge - top right -->
                    <div style="position:absolute;top:48px;right:12px;z-index:4;">
                        <span style="display:inline-flex;align-items:center;gap:5px;background:rgba(197,160,89,0.1);border:1px solid rgba(197,160,89,0.4);padding:3px 9px;border-radius:2px;font-family:Orbitron;font-size:0.35rem;color:#c5a059;letter-spacing:2px;">${isVideo ? '<i class="fas fa-film" style="font-size:0.6rem;"></i> NEW VIDEO' : '<i class="fas fa-image" style="font-size:0.6rem;"></i> NEW POST'}</span>
                    </div>

                    <!-- Center: play circle + UNLOCK directly below -->
                    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-58%);display:flex;flex-direction:column;align-items:center;gap:16px;z-index:3;">
                        <div style="width:60px;height:60px;border-radius:50%;border:2px solid rgba(197,160,89,0.5);background:rgba(197,160,89,0.06);display:flex;align-items:center;justify-content:center;box-shadow:0 0 30px rgba(197,160,89,0.08);">
                            ${isVideo
                                ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><polygon points="6,4 20,12 6,20" fill="rgba(197,160,89,0.75)" stroke="none"/></svg>`
                                : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="11" width="18" height="11" rx="2" stroke="rgba(197,160,89,0.6)" stroke-width="1.8"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="rgba(197,160,89,0.6)" stroke-width="1.8" stroke-linecap="round"/></svg>`
                            }
                        </div>
                        ${latest.price > 0 ? `<button onclick="event.stopPropagation();window.unlockPost('${latest.id}',${latest.price})" style="background:#c5a059;color:#000;border:none;font-family:Orbitron;font-size:0.42rem;letter-spacing:2.5px;padding:9px 22px;border-radius:2px;cursor:pointer;font-weight:700;">UNLOCK</button>` : ''}
                    </div>

                    <!-- Bottom gradient fade -->
                    <div style="position:absolute;bottom:0;left:0;right:0;height:55%;background:linear-gradient(to top,rgba(0,0,0,0.97) 0%,rgba(0,0,0,0.5) 55%,transparent 100%);pointer-events:none;z-index:2;"></div>

                    <!-- Bottom info -->
                    <div style="position:absolute;bottom:0;left:0;right:0;padding:14px 14px 16px;z-index:3;">
                        ${latest.title ? `<div style="font-family:Orbitron;font-size:0.95rem;color:#fff;letter-spacing:0.5px;margin-bottom:4px;line-height:1.3;">${latest.title}</div>` : ''}
                        ${latest.content ? `<div style="font-family:Rajdhani;font-size:0.68rem;color:rgba(255,255,255,0.35);margin-bottom:9px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.4;">${latest.content}</div>` : '<div style="margin-bottom:9px;"></div>'}
                        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
                            ${coinSvg}
                            <span style="font-family:Orbitron;font-size:0.46rem;color:#c5a059;letter-spacing:1.5px;">${latest.price} COINS</span>
                        </div>
                        ${rankLabel ? `<div style="font-family:Orbitron;font-size:0.36rem;color:#4a4a4a;letter-spacing:1.5px;">REQUIRES ${rankLabel}</div>` : ''}
                    </div>
                </div>` : `
                <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.92) 0%,rgba(0,0,0,0.2) 60%,transparent 100%);z-index:1;"></div>
                <div style="position:absolute;bottom:0;left:0;right:0;padding:16px;z-index:2;">
                    <div style="font-family:Orbitron;font-size:0.45rem;color:#c5a059;letter-spacing:2px;margin-bottom:5px;">LATEST DISPATCH</div>
                    ${latest.title ? `<div style="font-family:Orbitron;font-size:0.85rem;color:#fff;line-height:1.3;margin-bottom:3px;">${latest.title}</div>` : ''}
                    ${latest.content ? `<div style="font-family:Rajdhani;font-size:0.75rem;color:rgba(255,255,255,0.55);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.4;">${latest.content}</div>` : ''}
                </div>`;
        }

        // ── Build the full-page editorial layout ──────────────────────────
        if (!newsGrid) return;

        const CSS = `
            <style>
            .qk-feed-wrap {
                width: 100%;
                max-width: 1100px;
                margin: 0 auto;
                padding: 30px 20px;
                display: flex;
                flex-direction: column;
                gap: 30px;
            }
            .qk-header {
                display: flex;
                align-items: flex-end;
                gap: 15px;
                border-bottom: 1px solid rgba(197,160,89,0.2);
                padding-bottom: 20px;
            }
            .qk-header-title {
                font-family: Orbitron;
                font-size: 2rem;
                color: #c5a059;
                letter-spacing: 6px;
                line-height: 1;
            }
            .qk-header-sub {
                font-family: Orbitron;
                font-size: 0.5rem;
                color: #444;
                letter-spacing: 3px;
                margin-bottom: 4px;
            }
            /* HERO - tall portrait image left, text right */
            .qk-hero {
                display: grid;
                grid-template-columns: 1fr 1.1fr;
                gap: 0;
                height: 540px;
                border: 1px solid rgba(197,160,89,0.2);
                border-radius: 6px;
                overflow: hidden;
                background: #060606;
                transition: border-color 0.4s;
            }
            .qk-hero:hover { border-color: rgba(197,160,89,0.5); }
            .qk-hero-img {
                position: relative;
                overflow: hidden;
                background: #111;
            }
            .qk-hero-img img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                object-position: center top;
                display: block;
                transition: transform 0.8s cubic-bezier(0.25,0.46,0.45,0.94);
            }
            .qk-hero:hover .qk-hero-img img { transform: scale(1.04); }
            .qk-hero-img-placeholder {
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 5rem;
                background: linear-gradient(135deg,#0a0005,#1a0800);
            }
            .qk-feat-badge {
                position: absolute;
                top: 18px;
                left: 18px;
                background: #c5a059;
                color: #000;
                font-family: Orbitron;
                font-size: 0.5rem;
                padding: 5px 12px;
                letter-spacing: 3px;
                border-radius: 2px;
                z-index: 2;
            }
            .qk-hero-body {
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                padding: 35px 40px;
                background: #060606;
            }
            .qk-hero-date {
                font-family: Orbitron;
                font-size: 0.5rem;
                color: #3a3a3a;
                letter-spacing: 3px;
            }
            .qk-hero-title {
                font-family: Orbitron;
                font-size: 1.8rem;
                color: #fff;
                line-height: 1.3;
                letter-spacing: 2px;
                margin: 20px 0 15px 0;
            }
            .qk-hero-content {
                font-family: Rajdhani;
                font-size: 1rem;
                color: #888;
                line-height: 1.8;
                flex: 1;
                overflow: hidden;
            }
            .qk-hero-footer {
                display: flex;
                align-items: center;
                gap: 12px;
                border-top: 1px solid #111;
                padding-top: 20px;
                margin-top: 20px;
            }
            .qk-queen-sig {
                width: 32px;
                height: 32px;
                background: radial-gradient(circle,rgba(197,160,89,0.3),rgba(197,160,89,0.05));
                border: 1px solid rgba(197,160,89,0.4);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.9rem;
            }
            .qk-queen-name {
                font-family: Orbitron;
                font-size: 0.7rem;
                color: #c5a059;
                letter-spacing: 2px;
            }
            /* PORTRAIT GRID */
            .qk-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 18px;
            }
            .qk-card {
                background: #060606;
                border: 1px solid #161616;
                border-radius: 6px;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                transition: border-color 0.3s, transform 0.3s, box-shadow 0.3s;
                cursor: default;
            }
            .qk-card:hover {
                border-color: rgba(197,160,89,0.35);
                transform: translateY(-4px);
                box-shadow: 0 20px 40px rgba(0,0,0,0.5);
            }
            .qk-card-img {
                aspect-ratio: 3/4;
                overflow: hidden;
                background: #0d0d0d;
                position: relative;
                flex-shrink: 0;
            }
            .qk-card-img img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                object-position: center top;
                display: block;
                transition: transform 0.6s;
            }
            .qk-card:hover .qk-card-img img { transform: scale(1.06); }
            .qk-card-img-placeholder {
                width: 100%;
                aspect-ratio: 3/4;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 3rem;
                background: linear-gradient(135deg,#080808,#111);
                flex-shrink: 0;
            }
            .qk-card-body {
                padding: 16px 18px 20px;
                display: flex;
                flex-direction: column;
                gap: 8px;
                flex: 1;
            }
            .qk-card-date {
                font-family: Orbitron;
                font-size: 0.45rem;
                color: #333;
                letter-spacing: 2px;
            }
            .qk-card-title {
                font-family: Orbitron;
                font-size: 0.85rem;
                color: #ddd;
                line-height: 1.4;
            }
            .qk-card-content {
                font-family: Rajdhani;
                font-size: 0.82rem;
                color: #666;
                line-height: 1.6;
                overflow: hidden;
                display: -webkit-box;
                -webkit-line-clamp: 3;
                -webkit-box-orient: vertical;
            }
            .qk-divider {
                display: flex;
                align-items: center;
                gap: 15px;
                color: #222;
                font-family: Orbitron;
                font-size: 0.5rem;
                letter-spacing: 3px;
            }
            .qk-divider::before, .qk-divider::after {
                content: '';
                flex: 1;
                height: 1px;
                background: linear-gradient(90deg,transparent,#1a1a1a,transparent);
            }
            /* LOCK OVERLAY */
            .qk-card { position: relative; }
            .qk-lock-overlay {
                position: absolute;
                inset: 0;
                z-index: 10;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 10px;
                background: rgba(0,0,0,0.62);
                border-radius: 6px;
                overflow: hidden;
            }
            .qk-lock-icon { display: none; }
            .qk-lock-price {
                font-family: Orbitron;
                font-size: 0.48rem;
                color: #c5a059;
                letter-spacing: 1.5px;
                display: flex;
                align-items: center;
                gap: 5px;
            }
            .qk-lock-rank {
                font-family: Orbitron;
                font-size: 0.38rem;
                color: #555;
                letter-spacing: 1.5px;
            }
            .qk-unlock-btn {
                background: #c5a059;
                color: #000;
                border: none;
                font-family: Orbitron;
                font-size: 0.45rem;
                letter-spacing: 2px;
                padding: 8px 18px;
                border-radius: 2px;
                cursor: pointer;
                font-weight: 700;
            }
            .qk-unlock-btn:hover { background: #e0bb70; }
            .qk-lock-play {
                width: 48px;
                height: 48px;
                border-radius: 50%;
                border: 2px solid rgba(197,160,89,0.5);
                background: rgba(197,160,89,0.06);
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 0 24px rgba(197,160,89,0.08);
            }
            .qk-blurred img { filter: blur(10px) brightness(0.45); transform: scale(1.05); }
            /* VIDEO */
            .qk-card-video {
                width: 100%;
                height: 100%;
                object-fit: cover;
                object-position: center top;
                display: block;
                pointer-events: none;
            }
            .qk-card-media { cursor: pointer; }
            .qk-play-icon {
                position: absolute;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 2rem;
                color: rgba(255,255,255,0.85);
                text-shadow: 0 0 20px rgba(0,0,0,0.8);
                pointer-events: none;
            }
            .qk-play-hero {
                font-size: 3.5rem;
                z-index: 3;
            }
            /* LIKE BAR */
            .qk-like-bar {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 8px 18px 12px;
                border-top: 1px solid #111;
            }
            .qk-like-btn {
                background: none;
                border: none;
                color: #444;
                font-size: 1rem;
                cursor: pointer;
                padding: 0;
                line-height: 1;
                transition: color 0.2s, transform 0.15s;
            }
            .qk-like-btn:hover { color: #c5a059; transform: scale(1.2); }
            .qk-like-btn.liked { color: #c5a059; }
            .qk-like-count {
                font-family: Orbitron;
                font-size: 0.5rem;
                color: #444;
                letter-spacing: 1px;
            }
            @media (max-width: 700px) {
                .qk-hero { grid-template-columns: 1fr; height: auto; }
                .qk-hero-img { height: 300px; }
                .qk-grid { grid-template-columns: repeat(2, 1fr); }
            }
            </style>
        `;

        // Use first post with media as hero; fall back to posts[0] if none have media
        const hasMedia = (p: any) => p.media_url && !String(p.media_url).startsWith('failed');
        const heroIdx = posts.findIndex(hasMedia);
        const heroPost = heroIdx >= 0 ? posts[heroIdx] : posts[0];
        const restPosts = posts.filter((_: any, i: number) => i !== (heroIdx >= 0 ? heroIdx : 0));

        const _heroD = new Date(heroPost.created_at);
        const heroDate = isNaN(_heroD.getTime()) ? '' : _heroD.toLocaleDateString('en-GB', {
            day: 'numeric', month: 'long', year: 'numeric'
        }).toUpperCase();

        const heroLocked = !heroPost.userHasAccess;
        const heroIsVideo = heroPost.media_type === 'video';
        const heroHasMedia = heroPost.media_url && !String(heroPost.media_url).startsWith('failed');
        const heroMediaHTML = !heroHasMedia ? `<div class="qk-hero-img-placeholder">👑</div>` :
            heroLocked
                ? (heroPost.thumbnail_url
                    ? `<img src="${heroPost.thumbnail_url}" alt="" style="width:100%;height:100%;object-fit:cover;filter:blur(14px) brightness(0.25);pointer-events:none;" />`
                    : heroIsVideo
                        ? `<div style="width:100%;height:100%;background:radial-gradient(ellipse at center,#18120a 0%,#0a0808 55%,#060606 100%);"></div>`
                        : `<img src="${getOptimizedUrl(heroPost.media_url, 800)}" alt="" style="width:100%;height:100%;object-fit:cover;filter:blur(14px) brightness(0.25);pointer-events:none;" />`)
                : heroIsVideo
                    ? `<video src="${heroPost.media_url}" muted playsinline preload="none" onclick="window.openQkLightbox('video','${heroPost.media_url}')" onerror="if(!this.dataset.retried){this.dataset.retried='1';this.src='/api/media?url='+encodeURIComponent(this.src);this.load();}" style="width:100%;height:100%;object-fit:cover;cursor:pointer;"></video><div class="qk-play-icon qk-play-hero">▶</div>`
                    : `<img src="${getOptimizedUrl(heroPost.media_url, 800)}" alt="${heroPost.title || 'Queen Karin'}" onclick="window.openQkLightbox('image','${getOptimizedUrl(heroPost.media_url, 1200)}')" style="width:100%;height:100%;object-fit:cover;object-position:center top;cursor:pointer;" />`;
        const heroHTML = `
        <div class="qk-hero">
            <div class="qk-hero-img" style="position:relative;">
                <div class="qk-feat-badge">FEATURED</div>
                ${heroMediaHTML}
                ${heroLocked ? `
                <div class="qk-lock-overlay">
                    <div class="qk-lock-play">
                        ${heroIsVideo
                            ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><polygon points="6,4 20,12 6,20" fill="rgba(197,160,89,0.8)"/></svg>`
                            : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="11" width="18" height="11" rx="2" stroke="rgba(197,160,89,0.7)" stroke-width="1.8"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="rgba(197,160,89,0.7)" stroke-width="1.8" stroke-linecap="round"/></svg>`
                        }
                    </div>
                    ${heroPost.price > 0 ? `<button class="qk-unlock-btn" onclick="window.unlockPost('${heroPost.id}', ${heroPost.price})">UNLOCK</button>` : ''}
                </div>` : ''}
            </div>
            <div class="qk-hero-body">
                <div>
                    <div class="qk-hero-date">${heroDate}</div>
                    <div class="qk-hero-title">${heroPost.title || 'Queen\'s Dispatch'}</div>
                    ${!heroLocked
                        ? `<div class="qk-hero-content">${heroPost.content || ''}</div>`
                        : `<div style="margin-top:12px;display:flex;flex-direction:column;gap:8px;">
                            <div style="font-family:Orbitron;font-size:0.38rem;color:rgba(197,160,89,0.45);letter-spacing:2px;">${heroIsVideo ? 'EXCLUSIVE VIDEO' : 'EXCLUSIVE CONTENT'}</div>
                            ${heroPost.content ? `<div style="font-family:Rajdhani;font-size:0.82rem;color:rgba(255,255,255,0.28);line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${heroPost.content}</div>` : ''}
                            <div style="margin-top:6px;padding-top:12px;border-top:1px solid rgba(197,160,89,0.1);display:flex;flex-direction:column;gap:5px;">
                                ${heroPost.price > 0 ? `<div style="display:flex;align-items:center;gap:7px;"><svg width="13" height="13" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="#c5a059" stroke-width="1.8" fill="none"/><path d="M12 6v12M9 9h4.5a1.5 1.5 0 0 1 0 3H10.5a1.5 1.5 0 0 0 0 3H15" stroke="#c5a059" stroke-width="1.5" stroke-linecap="round"/></svg><span style="font-family:Orbitron;font-size:0.5rem;color:#c5a059;letter-spacing:1.5px;">${heroPost.price} COINS</span></div>` : ''}
                                ${heroPost.min_rank && heroPost.min_rank !== 'Hall Boy' ? `<div style="font-family:Orbitron;font-size:0.38rem;color:#4a4a4a;letter-spacing:1.5px;">REQUIRES ${(heroPost.min_rank || '').toUpperCase()}</div>` : ''}
                            </div>
                           </div>`
                    }
                </div>
                <div class="qk-hero-footer">
                    <div class="qk-queen-sig">👑</div>
                    <div>
                        <div class="qk-queen-name">QUEEN KARIN</div>
                    </div>
                </div>
            </div>
        </div>
        `;

        const gridHTML = restPosts.length > 0 ? `
            <div class="qk-divider">ARCHIVES</div>
            <div class="qk-grid">
                ${restPosts.map((p: any) => {
            const _pD = new Date(p.created_at);
            const d = isNaN(_pD.getTime()) ? '' : _pD.toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric'
            }).toUpperCase();
            const locked = !p.userHasAccess;
            const likeCount = p.likes || 0;
            const liked = p.userHasLiked || false;
            const isVideo = p.media_type === 'video';
            const cardHasMedia = p.media_url && !String(p.media_url).startsWith('failed');
            const cardMediaHTML = !cardHasMedia ? `<div class="qk-card-img-placeholder">👑</div>` :
                locked
                    ? (p.thumbnail_url
                        ? `<div class="qk-card-img qk-card-media qk-blurred"><img src="${p.thumbnail_url}" alt="" /></div>`
                        : isVideo
                            ? `<div class="qk-card-img qk-card-media" style="background:radial-gradient(ellipse at center,#15100a 0%,#080808 100%);"></div>`
                            : `<div class="qk-card-img qk-card-media qk-blurred"><img src="${getOptimizedUrl(p.media_url, 400)}" alt="" /></div>`)
                    : isVideo
                        ? `<div class="qk-card-img qk-card-media" onclick="window.openQkLightbox('video','${p.media_url}')"><video src="${p.media_url}" muted playsinline preload="none" class="qk-card-video"></video><div class="qk-play-icon">▶</div></div>`
                        : `<div class="qk-card-img qk-card-media" onclick="window.openQkLightbox('image','${getOptimizedUrl(p.media_url, 1200)}')"><img src="${getOptimizedUrl(p.media_url, 400)}" alt="${p.title || ''}" /></div>`;
            return `
                    <div class="qk-card${locked ? ' qk-card-locked' : ''}">
                        ${cardMediaHTML}
                        ${locked ? `
                        <div class="qk-lock-overlay">
                            <div class="qk-lock-play">
                                ${isVideo
                                    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><polygon points="6,4 20,12 6,20" fill="rgba(197,160,89,0.8)"/></svg>`
                                    : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="11" width="18" height="11" rx="2" stroke="rgba(197,160,89,0.7)" stroke-width="1.8"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="rgba(197,160,89,0.7)" stroke-width="1.8" stroke-linecap="round"/></svg>`
                                }
                            </div>
                            ${p.price > 0 ? `<div class="qk-lock-price"><svg width="11" height="11" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="#c5a059" stroke-width="1.8" fill="none"/><path d="M12 6v12M9 9h4.5a1.5 1.5 0 0 1 0 3H10.5a1.5 1.5 0 0 0 0 3H15" stroke="#c5a059" stroke-width="1.5" stroke-linecap="round"/></svg>${p.price} COINS</div>` : ''}
                            ${p.min_rank && p.min_rank !== 'Hall Boy' ? `<div class="qk-lock-rank">REQUIRES ${(p.min_rank || '').toUpperCase()}</div>` : ''}
                            ${p.price > 0 ? `<button class="qk-unlock-btn" onclick="window.unlockPost('${p.id}', ${p.price})">UNLOCK</button>` : ''}
                        </div>` : ''}
                        <div class="qk-card-body">
                            <div class="qk-card-date">${d}</div>
                            ${p.title ? `<div class="qk-card-title">${p.title}</div>` : ''}
                            ${!locked && p.content ? `<div class="qk-card-content">${p.content}</div>` : ''}
                        </div>
                        <div class="qk-like-bar">
                            <button class="qk-like-btn${liked ? ' liked' : ''}" onclick="window.togglePostLike('${p.id}', this)">${liked ? '♥' : '♡'}</button>
                            <span class="qk-like-count" id="likeCount_${p.id}">${likeCount}</span>
                        </div>
                    </div>
                    `;
        }).join('')}
            </div>
        ` : '';

        newsGrid.style.display = 'flex';
        newsGrid.style.flexDirection = 'column';
        newsGrid.style.padding = '0';
        newsGrid.style.gap = '0';
        const lightboxHTML = `
        <div id="qkLightbox" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:99999;align-items:center;justify-content:center;flex-direction:column;">
            <button onclick="window.closeQkLightbox()" style="position:absolute;top:16px;right:16px;background:none;border:none;color:#c5a059;font-size:2rem;cursor:pointer;z-index:1;">✕</button>
            <div id="qkLightboxContent" style="max-width:95vw;max-height:90vh;display:flex;align-items:center;justify-content:center;"></div>
        </div>`;
        newsGrid.innerHTML = CSS + lightboxHTML + `
            <div class="qk-feed-wrap">
                <div class="qk-header">
                    <div>
                        <div class="qk-header-sub">TRANSMISSIONS FROM THE SOVEREIGN</div>
                        <div class="qk-header-title">QUEEN KARIN</div>
                    </div>
                </div>
                ${heroHTML}
                ${gridHTML}
            </div>
        `;

    } catch (err) {
        if (newsGrid) newsGrid.innerHTML = '<div style="color:#ff4444;font-family:Orbitron;font-size:0.7rem;text-align:center;padding:40px;">ERROR LOADING POSTS</div>';
        console.error('[Queen Posts] load error', err);
    }
}

// ─── ALTAR: FAST TOP-3 LOADER ─────────────────────────────────────────────────
// Called early on page load — fetches only the 3 best-rated tasks with
// pre-signed URLs from a lightweight endpoint, no full profile needed.
export async function loadAltarTop3(memberId: string) {
    if (!memberId) return;
    try {
        const res = await fetch(`/api/altar?memberId=${encodeURIComponent(memberId)}`);
        const { top3 } = await res.json();
        if (!top3?.length) return;

        const slotIds = ['mobRec_Slot1', 'mobRec_Slot2', 'mobRec_Slot3'];
        const fallback = (img: HTMLImageElement) => {
            if (!img.dataset.retried) { img.dataset.retried = '1'; img.src = '/api/media?url=' + encodeURIComponent(img.src); }
            else if (!img.dataset.gave_up) { img.dataset.gave_up = '1'; img.style.opacity = '0.25'; img.src = '/queen-karin.png'; }
        };

        top3.forEach((t: any, i: number) => {
            const el = document.getElementById(slotIds[i]);
            if (!el) return;
            const isVid = t.proofType === 'video' || /\.(mp4|mov|webm)/i.test(t.proofUrl || '');
            const url = isVid ? (t.thumbnailUrl || '/queen-karin.png') : t.proofUrl;

            if (el.tagName === 'IMG') {
                const img = el as HTMLImageElement;
                // Don't overwrite if renderHistoryAndAltar already filled it
                if (img.dataset.loaded) return;
                img.onerror = () => fallback(img);
                img.src = url;
                img.style.pointerEvents = 'none';
            } else {
                const img = document.createElement('img');
                img.id = slotIds[i];
                img.src = url;
                img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;';
                img.onerror = () => fallback(img);
                el.replaceWith(img);
            }
        });

        // Also fill the desktop hero with #1
        const heroImg = document.getElementById('imgAltarMain') as HTMLImageElement | null;
        const heroTitle = document.getElementById('titleAltarMain');
        if (heroImg && top3[0] && !heroImg.dataset.loaded) {
            const t = top3[0];
            const isVid = t.proofType === 'video' || /\.(mp4|mov|webm)/i.test(t.proofUrl || '');
            heroImg.src = isVid ? (t.thumbnailUrl || '/queen-karin.png') : t.proofUrl;
            heroImg.onerror = () => fallback(heroImg);
            if (heroTitle) heroTitle.textContent = t.text || '';
        }
    } catch (err) {
        console.warn('[ALTAR] fast top3 load failed:', err);
    }
}

// ─── ALTAR & HISTORY GALLERY (RECORDS TAB) ───────────────────────────────────
export async function renderHistoryAndAltar(profileData: any) {
    let raw: any[] = [];
    const hist = profileData?.['Taskdom_History'];
    if (typeof hist === 'string' && hist) {
        try { raw = JSON.parse(hist); } catch { raw = []; }
    } else if (Array.isArray(hist)) {
        raw = hist;
    }
    if (!raw.length) return;

    // Pre-normalize all proofUrls: convert Wix format, resolve /api/media/url paths, filter invalid
    raw.forEach((t: any) => {
        if (!t.proofUrl || t.proofUrl === 'SKIPPED' || t.proofUrl === 'FORCED' || t.proofUrl.startsWith('failed')) {
            t.proofUrl = null;
            return;
        }
        // Convert Wix URLs to actual HTTP URLs
        if (t.proofUrl.startsWith('wix:')) {
            t.proofUrl = getOptimizedUrl(t.proofUrl) || null;
            return;
        }
        // Convert /api/media/url (returns JSON) to /api/media (returns image)
        if (t.proofUrl.startsWith('/api/media/url')) {
            try {
                const qs = t.proofUrl.split('?')[1] || '';
                const params = new URLSearchParams(qs);
                const bucket = params.get('bucket') || 'media';
                const path = params.get('path') || params.get('url') || '';
                if (path) {
                    t.proofUrl = `/api/media?bucket=${bucket}&path=${encodeURIComponent(path)}`;
                } else {
                    t.proofUrl = null;
                }
            } catch { t.proofUrl = null; }
            return;
        }
    });

    const allApproved = raw.filter((t: any) => t.status === 'approve' && t.proofUrl && t.proofUrl !== 'SKIPPED');
    const routines = allApproved.filter((t: any) => t.isRoutine);
    const tasks = allApproved.filter((t: any) => !t.isRoutine).sort((a: any, b: any) =>
        new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
    );
    const failed = raw.filter((t: any) => t.status === 'fail' || t.status === 'reject');
    const pending = raw.filter((t: any) => t.status === 'pending' && !t.isRoutine);

    // Pre-sign all Supabase storage URLs in one batch request
    const allWithUrls = [...allApproved, ...failed, ...pending].filter((t: any) => t.proofUrl);
    const urlMap = await _signUrlsBatch(allWithUrls.map((t: any) => t.proofUrl));
    const resolveUrl = (url: string) => urlMap[url] || url;

    // Hero: highest merit awarded; tiebreak by most recent timestamp
    const hero = tasks.length > 0
        ? tasks.reduce((best: any, t: any) => {
            const bm = best.meritAwarded || 0;
            const tm = t.meritAwarded || 0;
            if (tm > bm) return t;
            if (tm === bm && new Date(t.timestamp || 0) > new Date(best.timestamp || 0)) return t;
            return best;
        })
        : null;

    _renderAltarHero(hero, resolveUrl);
    _renderRoutineGrid('gridAltarRoutine', routines, resolveUrl);
    _renderFailedGrid('gridAltarFailed', failed, resolveUrl);
    _renderMosaicGrid(tasks, pending, resolveUrl);

    // Mobile altar: top 3 approved photos by merit
    const top3 = [...allApproved].sort((a: any, b: any) => {
        const dm = (b.meritAwarded || 0) - (a.meritAwarded || 0);
        if (dm !== 0) return dm;
        return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
    }).slice(0, 3);
    _renderMobileAltar(top3, allApproved, routines, failed, resolveUrl);
}

async function _signUrlsBatch(urls: string[]): Promise<Record<string, string>> {
    const unique = [...new Set(urls.filter(Boolean))];
    if (!unique.length) return {};
    try {
        const res = await fetch('/api/sign-urls', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls: unique })
        });
        const data = await res.json();
        const signedList: string[] = data.urls || unique;
        const map: Record<string, string> = {};
        unique.forEach((u, i) => { map[u] = signedList[i] || u; });
        return map;
    } catch {
        const map: Record<string, string> = {};
        unique.forEach(u => { map[u] = u; });
        return map;
    }
}

function _isVideo(url: string | null | undefined): boolean {
    if (!url) return false;
    const l = url.toLowerCase();
    return l.startsWith('wix:video') ||
        /\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(l) ||
        l.includes('/video/') ||
        (l.includes('supabase.co/storage') && /\.(mp4|webm|mov)(\?|$)/.test(l));
}

function _resolveThumbUrl(item: any, resolveUrl: (u: string) => string): string | null {
    const rawThumb = item?.thumbnail_url || item?.thumbnailUrl;
    if (!rawThumb) return null;
    return resolveUrl(rawThumb);
}

function _renderAltarHero(hero: any | null, resolveUrl: (u: string) => string) {
    const altarMain = document.getElementById('altarMain');
    const imgMain = document.getElementById('imgAltarMain') as HTMLImageElement | null;
    const titleMain = document.getElementById('titleAltarMain');

    if (!hero || !altarMain || !imgMain) return;

    const url = resolveUrl(hero.proofUrl);
    const merit = hero.meritAwarded ? `+${hero.meritAwarded} MERIT` : '';
    const thumbUrl = _resolveThumbUrl(hero, resolveUrl);

    const _heroFallback = () => { if (!imgMain.dataset.retried) { imgMain.dataset.retried = '1'; imgMain.src = '/api/media?url=' + encodeURIComponent(imgMain.src); } };
    imgMain.onerror = _heroFallback;
    if (_isVideo(url)) {
        imgMain.src = thumbUrl || '/queen-karin.png';
        imgMain.style.display = 'block';
        imgMain.style.objectFit = 'cover';
        imgMain.style.cursor = 'pointer';
    } else {
        imgMain.src = url;
        imgMain.style.display = 'block';
    }

    if (titleMain) titleMain.textContent = (hero.text || '').replace(/<[^>]+>/g, '').slice(0, 60) || '...';
    if (merit) {
        const meritEl = document.createElement('div');
        meritEl.style.cssText = 'position:absolute;bottom:60px;left:20px;background:rgba(197,160,89,0.9);color:#000;font-family:Orbitron;font-size:0.5rem;font-weight:900;padding:4px 10px;border-radius:3px;letter-spacing:1px;';
        meritEl.textContent = merit;
        altarMain.style.position = 'relative';
        altarMain.appendChild(meritEl);
    }
    altarMain.style.display = 'block';
    altarMain.onclick = () => _openHistoryModal([hero], 0, resolveUrl);
}

// Stores resolved data for the altar drawer so it can be opened at any time
let _altarResolveUrl: ((u: string) => string) | null = null;
let _altarRoutines: any[] = [];
let _altarAccepted: any[] = [];
let _altarFailed: any[] = [];
let _altarGridsFilled = false; // lazy: only fill grids when drawer first opens

export function openAltarDrawer() {
    const drawer = document.getElementById('altarDrawer');
    if (drawer?.classList.contains('open')) { closeAltarDrawer(); _setNavActive('profile'); return; }
    _closeAllMobOverlays('altar');
    const backdrop = document.getElementById('altarBackdrop');
    if (drawer) drawer.classList.add('open');
    if (backdrop) backdrop.classList.add('open');
    _setNavActive('record');
    // Lazy-load drawer grids on first open
    if (!_altarGridsFilled) {
        _fillAltarGrid('altarGrid_routine', _altarRoutines);
        _fillAltarGrid('altarGrid_accepted', _altarAccepted);
        _fillAltarGrid('altarGrid_rejected', _altarFailed, true);
        _altarGridsFilled = true;
    }
    // Load gallery if it has pending updates
    flushGalleryIfDirty();
}

export function closeAltarDrawer() {
    const drawer = document.getElementById('altarDrawer');
    const backdrop = document.getElementById('altarBackdrop');
    if (drawer) drawer.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
    _setNavActive('profile');
}

export function toggleAltarSection(section: string) {
    const body = document.getElementById(`altarSec_${section}`);
    const arrow = document.getElementById(`altarSec_arrow_${section}`);
    if (!body) return;
    const isOpen = body.classList.contains('open');
    body.classList.toggle('open', !isOpen);
    if (arrow) arrow.textContent = isOpen ? '›' : '‹';
}


// onerror fallback: 1st fail → retry via /api/media proxy; 2nd fail → show placeholder
const _imgFallback = `onerror="if(!this.dataset.retried){this.dataset.retried='1';this.src='/api/media?url='+encodeURIComponent(this.src);}else if(!this.dataset.gave_up){this.dataset.gave_up='1';this.style.opacity='0.25';this.src='/queen-karin.png';}"`;

function _makeAltarCard(t: any, list: any[], idx: number, dimmed = false): HTMLElement | null {
    const resolveUrl = _altarResolveUrl || ((u: string) => u);
    let url = t.proofUrl ? resolveUrl(t.proofUrl) : null;
    if (!url) return null;
    // Final safety: skip obviously invalid URLs
    if (url === 'SKIPPED' || url === 'FORCED' || url.startsWith('failed')) return null;
    // Normalize Wix URLs that slipped through
    if (url.startsWith('wix:')) { url = getOptimizedUrl(url); if (!url) return null; }
    const isVid = _isVideo(url);
    const dateStr = new Date(t.timestamp || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();
    const meritBadge = t.meritAwarded
        ? `<div class="altar-card-merit">+${t.meritAwarded}</div>`
        : '';
    const thumbUrl = _resolveThumbUrl(t, resolveUrl);
    const media = isVid
        ? `<img src="${thumbUrl || '/queen-karin.png'}" class="altar-card-media" loading="lazy" ${_imgFallback} />`
        : `<img src="${url}" class="altar-card-media" loading="lazy" ${_imgFallback} />`;
    const card = document.createElement('div');
    card.className = 'altar-photo-card';
    if (dimmed) card.style.filter = 'grayscale(0.65)';
    const taskText = (t.text || '').replace(/<[^>]+>/g, '');
    const commentHTML = t.adminComment
        ? `<div style="font-family:Orbitron;font-size:0.42rem;color:#c5a059;margin-top:4px;font-style:italic;">"${t.adminComment}"</div>`
        : '';
    card.innerHTML = `${media}${meritBadge}<div style="padding:8px 10px;"><div class="altar-card-date">${dateStr}</div>${taskText ? `<div style="font-family:Rajdhani;font-size:0.78rem;color:#888;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;margin-top:3px;">${taskText}</div>` : ''}${commentHTML}</div>`;
    card.onclick = () => _openHistoryModal(list, idx, resolveUrl);
    return card;
}

function _fillAltarGrid(containerId: string, list: any[], dimmed = false) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    if (!list.length) {
        el.innerHTML = '<div class="altar-empty">NO RECORDS</div>';
        return;
    }
    list.forEach((t, i) => {
        const card = _makeAltarCard(t, list, i, dimmed);
        if (card) el.appendChild(card);
    });
}

function _renderMobileAltar(top3: any[], allApproved: any[], routines: any[], failed: any[], resolveUrl: (u: string) => string) {
    // Store for drawer open/tab switch
    _altarResolveUrl = resolveUrl;
    _altarRoutines = routines;
    _altarAccepted = allApproved.filter((t: any) => !t.isRoutine);
    _altarFailed = failed;

    // Fill the 3 idol slots with top-merit photos
    const slotIds = ['mobRec_Slot1', 'mobRec_Slot2', 'mobRec_Slot3'];
    top3.forEach((t, i) => {
        const el = document.getElementById(slotIds[i]);
        if (!el) return;
        const url = resolveUrl(t.proofUrl);
        const isVid = _isVideo(url);
        const thumbUrl = _resolveThumbUrl(t, resolveUrl);
        const _slotFallback = (img: HTMLImageElement) => { if (!img.dataset.retried) { img.dataset.retried = '1'; img.src = '/api/media?url=' + encodeURIComponent(img.src); } else if (!img.dataset.gave_up) { img.dataset.gave_up = '1'; img.style.opacity = '0.25'; img.src = '/queen-karin.png'; } };
        if (isVid) {
            const img = document.createElement('img');
            img.id = slotIds[i];
            img.src = thumbUrl || '/queen-karin.png';
            img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;';
            img.onerror = () => _slotFallback(img);
            el.replaceWith(img);
        } else {
            const img = el as HTMLImageElement;
            img.dataset.loaded = 'true';
            img.style.display = '';
            img.onerror = () => _slotFallback(img);
            img.src = url;
            img.style.pointerEvents = 'none';
        }
    });

    // Fill drawer grids immediately if drawer is already open, otherwise defer until open
    const drawer = document.getElementById('altarDrawer');
    if (drawer?.classList.contains('open')) {
        _fillAltarGrid('altarGrid_routine', _altarRoutines);
        _fillAltarGrid('altarGrid_accepted', _altarAccepted);
        _fillAltarGrid('altarGrid_rejected', _altarFailed, true);
        _altarGridsFilled = true;
    } else {
        _altarGridsFilled = false;
    }
}

function _renderRoutineGrid(containerId: string, routines: any[], resolveUrl: (u: string) => string) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!routines.length) { el.innerHTML = '<div style="color:#333;font-family:Orbitron;font-size:0.4rem;text-align:center;padding:20px;letter-spacing:1px;">NO ROUTINES YET</div>'; return; }

    el.innerHTML = routines.slice(0, 6).map((t: any) => {
        const url = resolveUrl(t.proofUrl);
        const isVid = _isVideo(url);
        const dateStr = new Date(t.timestamp || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();
        const thumbUrl = _resolveThumbUrl(t, resolveUrl);
        const media = isVid
            ? `<img src="${thumbUrl || '/queen-karin.png'}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;" loading="lazy" ${_imgFallback} />`
            : `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;" loading="lazy" ${_imgFallback} />`;
        return `
            <div style="position:relative;overflow:hidden;border-radius:4px;cursor:pointer;" onclick="void(0)">
                ${media}
                <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.75));padding:4px 5px;border-radius:0 0 4px 4px;">
                    <div style="font-family:Orbitron;font-size:0.35rem;color:#fff;letter-spacing:1px;">${dateStr}</div>
                </div>
            </div>`;
    }).join('');
}

function _renderFailedGrid(containerId: string, failed: any[], resolveUrl: (u: string) => string) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!failed.length) { el.innerHTML = '<div style="color:#333;font-family:Orbitron;font-size:0.4rem;text-align:center;padding:20px;letter-spacing:1px;">NONE</div>'; return; }

    el.innerHTML = failed.slice(0, 6).map((t: any) => {
        const url = t.proofUrl ? resolveUrl(t.proofUrl) : null;
        if (!url) return `<div style="background:#0a0a0a;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;">✗</div>`;
        const isVid = _isVideo(url);
        const thumbUrl = _resolveThumbUrl(t, resolveUrl);
        return isVid
            ? `<img src="${thumbUrl || '/queen-karin.png'}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;filter:grayscale(0.6);" loading="lazy" ${_imgFallback} />`
            : `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;filter:grayscale(0.6);" loading="lazy" ${_imgFallback} />`;
    }).join('');
}

function _renderMosaicGrid(tasks: any[], pending: any[], resolveUrl: (u: string) => string) {
    const grid = document.getElementById('mosaicGrid');
    if (!grid) return;
    grid.innerHTML = '';

    // Pending first
    pending.forEach((t: any) => {
        const card = document.createElement('div');
        card.className = 'mosaic-card';
        card.style.cssText = 'position:relative;overflow:hidden;border-radius:6px;border:1px solid rgba(197,160,89,0.25);background:#060606;display:flex;flex-direction:column;cursor:default;';
        const url = t.proofUrl ? resolveUrl(t.proofUrl) : null;
        const isVidP = url ? _isVideo(url) : false;
        const thumbUrl = _resolveThumbUrl(t, resolveUrl);
        const mediaP = url
            ? (isVidP
                ? `<img src="${thumbUrl || '/queen-karin.png'}" style="width:100%;aspect-ratio:3/4;object-fit:cover;filter:brightness(0.45);" loading="lazy" ${_imgFallback}>`
                : `<img src="${url}" style="width:100%;aspect-ratio:3/4;object-fit:cover;filter:brightness(0.45);" loading="lazy" ${_imgFallback}>`)
            : `<div style="aspect-ratio:3/4;display:flex;align-items:center;justify-content:center;background:#0a0a0a;font-size:2rem;">⏳</div>`;
        card.innerHTML = `
            <div style="position:relative;">
                ${mediaP}
                <div style="position:absolute;top:8px;left:8px;background:rgba(197,160,89,0.9);color:#000;font-family:Orbitron;font-size:0.4rem;font-weight:900;padding:3px 7px;border-radius:3px;letter-spacing:1.5px;">PENDING</div>
            </div>
            <div style="padding:10px 12px;">
                <div style="font-family:Orbitron;font-size:0.45rem;color:#c5a059;letter-spacing:2px;margin-bottom:4px;">AWAITING JUDGMENT</div>
                <div style="font-family:Rajdhani;font-size:0.78rem;color:#888;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${(t.text || '').replace(/<[^>]+>/g, '')}</div>
            </div>`;
        grid.appendChild(card);
    });

    // Approved tasks (no routines), sorted by date descending
    tasks.forEach((t: any, i: number) => {
        const card = document.createElement('div');
        card.className = 'mosaic-card';
        card.style.cssText = 'position:relative;overflow:hidden;border-radius:6px;border:1px solid #1a1a1a;background:#060606;display:flex;flex-direction:column;cursor:pointer;transition:border-color 0.3s,transform 0.3s;';
        card.onmouseover = () => { card.style.borderColor = 'rgba(197,160,89,0.4)'; card.style.transform = 'translateY(-3px)'; };
        card.onmouseout = () => { card.style.borderColor = '#1a1a1a'; card.style.transform = 'translateY(0)'; };
        card.onclick = () => _openHistoryModal(tasks, i, resolveUrl);

        const url = resolveUrl(t.proofUrl);
        const dateStr = new Date(t.timestamp || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }).toUpperCase();
        const isVid = _isVideo(url);
        const thumbUrl = _resolveThumbUrl(t, resolveUrl);
        const mediaHTML = isVid
            ? `<img src="${thumbUrl || '/queen-karin.png'}" style="width:100%;aspect-ratio:3/4;object-fit:cover;object-position:center top;display:block;" loading="lazy" ${_imgFallback} />`
            : `<img src="${url}" style="width:100%;aspect-ratio:3/4;object-fit:cover;object-position:center top;display:block;" loading="lazy" ${_imgFallback} />`;
        const meritBadge = t.meritAwarded ? `<div style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.7);color:#c5a059;font-family:Orbitron;font-size:0.38rem;padding:3px 7px;border-radius:3px;letter-spacing:1px;">+${t.meritAwarded}</div>` : '';

        card.innerHTML = `
            ${mediaHTML}
            ${meritBadge}
            <div style="padding:10px 12px;">
                <div style="font-family:Orbitron;font-size:0.45rem;color:#3a3a3a;letter-spacing:2px;margin-bottom:4px;">${dateStr}</div>
                <div style="font-family:Rajdhani;font-size:0.78rem;color:#888;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${(t.text || '').replace(/<[^>]+>/g, '')}</div>
                ${t.adminComment ? `<div style="font-family:Orbitron;font-size:0.42rem;color:#c5a059;margin-top:5px;font-style:italic;">"${t.adminComment}"</div>` : ''}
            </div>`;
        grid.appendChild(card);
    });
}

// Simple lightbox modal for viewing a task at full-size
function _openHistoryModal(items: any[], idx: number, resolveUrl: (u: string) => string) {
    document.getElementById('__altarModal')?.remove();

    const t = items[idx];
    if (!t) return;

    const overlay = document.createElement('div');
    overlay.id = '__altarModal';
    // z-index above everything: mobile nav (9999999), all overlays
    overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.96);z-index:10000001;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;padding:20px;`;
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    const url = resolveUrl(t.proofUrl);
    const isVid = _isVideo(url);
    const dateStr = new Date(t.timestamp || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();

    // Verdict badge
    const status = (t.status || '').toLowerCase();
    let verdictHtml = '';
    if (status === 'approve' || status === 'approved') {
        verdictHtml = `<div style="display:inline-block;background:rgba(0,200,80,0.15);border:1px solid rgba(0,200,80,0.5);color:#00c850;font-family:Orbitron;font-size:0.55rem;font-weight:700;letter-spacing:3px;padding:5px 16px;border-radius:4px;">✓ APPROVED</div>`;
    } else if (status === 'reject' || status === 'rejected') {
        verdictHtml = `<div style="display:inline-block;background:rgba(255,50,50,0.15);border:1px solid rgba(255,50,50,0.5);color:#ff4444;font-family:Orbitron;font-size:0.55rem;font-weight:700;letter-spacing:3px;padding:5px 16px;border-radius:4px;">✕ REJECTED</div>`;
    }

    const meritStr = t.meritAwarded
        ? `<div style="font-family:Orbitron;font-size:0.45rem;color:#c5a059;letter-spacing:2px;">+${t.meritAwarded} MERIT AWARDED</div>`
        : `<div style="font-family:Orbitron;font-size:0.45rem;color:#444;letter-spacing:2px;">0 MERIT</div>`;

    overlay.innerHTML = `
        <button id="__altarClose" style="position:absolute;top:16px;right:16px;background:rgba(255,68,68,0.12);border:1px solid rgba(255,68,68,0.35);color:#ff4444;font-family:Orbitron;font-size:0.55rem;font-weight:700;padding:7px 16px;cursor:pointer;border-radius:4px;letter-spacing:1px;z-index:1;">✕ CLOSE</button>
        <div style="font-family:Orbitron;font-size:0.48rem;color:#555;letter-spacing:3px;">${dateStr}</div>
        ${verdictHtml}
        ${isVid
            ? `<video src="${url}" controls autoplay playsinline preload="metadata" onerror="if(!this.dataset.retried){this.dataset.retried='1';this.src='/api/media?url='+encodeURIComponent(this.src);this.load();}" style="max-height:58vh;max-width:88vw;border-radius:8px;"></video>`
            : `<img src="${url}" onerror="if(!this.dataset.retried){this.dataset.retried='1';this.src='/api/media?url='+encodeURIComponent(this.src);}" style="max-height:58vh;max-width:88vw;object-fit:contain;border-radius:8px;" />`
        }
        <div style="max-width:580px;text-align:center;">
            ${meritStr}
            <div style="font-family:Orbitron;font-size:0.85rem;color:#aaa;line-height:1.6;margin-top:6px;">${(t.text || '').replace(/<[^>]+>/g, '')}</div>
            ${t.adminComment ? `<div style="font-family:Orbitron;font-size:0.7rem;color:#c5a059;margin-top:8px;font-style:italic;">"${t.adminComment}"</div>` : ''}
        </div>
        <div style="display:flex;gap:12px;margin-top:4px;">
            ${idx > 0 ? `<button id="__altarPrev" style="background:none;border:1px solid #333;color:#666;font-family:Orbitron;font-size:0.5rem;padding:8px 16px;cursor:pointer;border-radius:3px;">← PREV</button>` : ''}
            ${idx < items.length - 1 ? `<button id="__altarNext" style="background:none;border:1px solid #333;color:#666;font-family:Orbitron;font-size:0.5rem;padding:8px 16px;cursor:pointer;border-radius:3px;">NEXT →</button>` : ''}
        </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('__altarClose')?.addEventListener('click', (e) => { e.stopPropagation(); overlay.remove(); });
    document.getElementById('__altarPrev')?.addEventListener('click', (e) => { e.stopPropagation(); overlay.remove(); _openHistoryModal(items, idx - 1, resolveUrl); });
    document.getElementById('__altarNext')?.addEventListener('click', (e) => { e.stopPropagation(); overlay.remove(); _openHistoryModal(items, idx + 1, resolveUrl); });
}

export async function unlockPost(postId: string, price: number) {
    const email = getState().email;
    if (!email) return;
    if (!confirm(`Unlock this post for ${price} coins?`)) return;

    const res = await fetch(`/api/posts/${postId}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });
    const data = await res.json();

    if (data.success) {
        if (data.newWallet !== undefined) setState({ wallet: data.newWallet });
        loadQueenPosts();
    } else if (data.error === 'INSUFFICIENT_FUNDS') {
        const pm = document.getElementById('povertyModal');
        if (pm) pm.style.display = 'flex';
    } else {
        alert(data.error || 'Unlock failed');
    }
}

export async function togglePostLike(postId: string, btnEl: HTMLButtonElement) {
    const email = getState().email;
    if (!email) return;

    const res = await fetch(`/api/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!data.success) return;

    const liked = data.liked;
    btnEl.textContent = liked ? '♥' : '♡';
    btnEl.classList.toggle('liked', liked);
    const countEl = document.getElementById(`likeCount_${postId}`);
    if (countEl) {
        const current = parseInt(countEl.textContent || '0');
        countEl.textContent = String(liked ? current + 1 : Math.max(current - 1, 0));
    }
}

export function openQkLightbox(type: 'image' | 'video', src: string) {
    const lb = document.getElementById('qkLightbox');
    const content = document.getElementById('qkLightboxContent');
    if (!lb || !content) return;
    content.innerHTML = type === 'video'
        ? `<video src="${src}" controls autoplay playsinline style="max-width:95vw;max-height:88vh;border-radius:4px;"></video>`
        : `<img src="${src}" style="max-width:95vw;max-height:88vh;object-fit:contain;border-radius:4px;" />`;
    lb.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

export function closeQkLightbox() {
    const lb = document.getElementById('qkLightbox');
    const content = document.getElementById('qkLightboxContent');
    if (lb) lb.style.display = 'none';
    if (content) content.innerHTML = '';
    document.body.style.overflow = '';
}

// ─── PAYWALL ──────────────────────────────────────────────────────────────────

export function _applyPaywall(paywall: any, memberId: string) {
    const overlay = document.getElementById('paywallOverlay');
    if (!overlay) return;
    if (paywall?.active) {
        const reasonEl = document.getElementById('paywallReason');
        const amountEl = document.getElementById('paywallAmount');
        const payBtn   = document.getElementById('paywallPayBtn');
        if (reasonEl) reasonEl.textContent = paywall.reason || '';
        if (amountEl) amountEl.textContent  = `€${Number(paywall.amount).toFixed(2)}`;
        if (payBtn) {
            payBtn.onclick = async () => {
                payBtn.textContent = 'LOADING...';
                (payBtn as HTMLButtonElement).disabled = true;
                try {
                    const res = await fetch('/api/stripe/paywall-checkout', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ memberId }),
                    });
                    const data = await res.json();
                    if (!data.clientSecret) throw new Error(data.error || 'Failed');

                    const { loadStripe } = await import('@stripe/stripe-js');
                    const stripeInstance = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
                    if (!stripeInstance) throw new Error('Stripe failed to load');

                    // Hide info card, show payment widget
                    const infoDiv = overlay.querySelector('div') as HTMLElement;
                    const embedContainer = document.getElementById('paywallEmbedContainer') as HTMLElement;
                    infoDiv.style.display = 'none';
                    embedContainer.style.display = 'block';

                    const appearance = {
                        theme: 'night' as const,
                        variables: {
                            colorPrimary: '#c5a059',
                            colorBackground: '#0a0a14',
                            colorText: '#ffffff',
                            colorDanger: '#ff4444',
                            fontFamily: 'Orbitron, sans-serif',
                            borderRadius: '8px',
                        },
                    };

                    const elements = stripeInstance.elements({ clientSecret: data.clientSecret, appearance });

                    const confirmBtn = document.getElementById('paywallConfirmBtn') as HTMLButtonElement;
                    const errorEl = document.getElementById('paywallPayError') as HTMLElement;
                    const divider = document.getElementById('paywallDivider') as HTMLElement;

                    const handleSuccess = async (intentId: string) => {
                        confirmBtn.textContent = 'UNLOCKING...';
                        await fetch('/api/paywall/verify', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ intentId, memberId }),
                        });
                        overlay.style.display = 'none';
                        document.body.style.overflow = '';
                        window.location.reload();
                    };

                    // Express Checkout (Apple Pay / Google Pay)
                    const expressElement = elements.create('expressCheckout');
                    expressElement.mount('#paywallExpressElement');
                    expressElement.on('confirm', async (event: any) => {
                        const { error, paymentIntent } = await stripeInstance.confirmPayment({
                            elements,
                            confirmParams: { return_url: window.location.href },
                            redirect: 'if_required',
                        });
                        if (error) { event.paymentFailed({ reason: 'fail' }); return; }
                        if (paymentIntent?.status === 'succeeded') await handleSuccess(paymentIntent.id);
                    });
                    expressElement.on('ready', (event: any) => {
                        if (event.availablePaymentMethods && Object.keys(event.availablePaymentMethods).length > 0) {
                            divider.style.display = 'block';
                        }
                    });

                    // Card fallback
                    const paymentElement = elements.create('payment');
                    paymentElement.mount('#paywallPaymentElement');

                    confirmBtn.onclick = async () => {
                        confirmBtn.textContent = 'PROCESSING...';
                        confirmBtn.disabled = true;
                        errorEl.style.display = 'none';

                        const { error, paymentIntent } = await stripeInstance.confirmPayment({
                            elements,
                            confirmParams: { return_url: window.location.href },
                            redirect: 'if_required',
                        });

                        if (error) {
                            errorEl.textContent = error.message || 'Payment failed';
                            errorEl.style.display = 'block';
                            confirmBtn.textContent = 'CONFIRM PAYMENT';
                            confirmBtn.disabled = false;
                            return;
                        }

                        if (paymentIntent?.status === 'succeeded') await handleSuccess(paymentIntent.id);
                    };
                } catch (e: any) {
                    payBtn.textContent = 'PAY NOW';
                    (payBtn as HTMLButtonElement).disabled = false;
                    alert('Payment error: ' + e.message);
                }
            };
        }
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    } else {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// ─── SILENCE ──────────────────────────────────────────────────────────────────

export function _applySilence(active: boolean, reason: string = '') {
    if (typeof window === 'undefined') return;

    // 1. Update React state - triggers early return lock screen
    const setter = (window as any)._setSilenceOverlay;
    if (setter) setter(active, reason);

    const OVERLAY_ID = '__silenceLock';
    const STYLE_ID = '__silenceStyle';

    if (active) {
        // 2. Inject CSS that forcibly hides #MOBILE_APP and #DESKTOP_APP - overrides
        //    profile-mobile.css "display:block !important" via later declaration + higher specificity
        let styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = STYLE_ID;
            document.head.appendChild(styleEl);
        }
        styleEl.textContent = '#MOBILE_APP{display:none!important;visibility:hidden!important}#DESKTOP_APP{display:none!important;visibility:hidden!important}';

        // 3. Inject full-screen DOM overlay - z-index 2147483647 beats everything
        if (!document.getElementById(OVERLAY_ID)) {
            const overlay = document.createElement('div');
            overlay.id = OVERLAY_ID;
            overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100dvh;background:rgba(8,2,2,0.97);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:2147483647;padding:24px;box-sizing:border-box;font-family:Orbitron,sans-serif;';
            const safeReason = reason.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            overlay.innerHTML = `<div style="max-width:420px;width:100%;text-align:center;"><svg viewBox="0 0 24 24" width="52" height="52" fill="rgba(220,60,60,0.7)" style="display:block;margin:0 auto 16px"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.68L5.68 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.68L18.32 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"/></svg><div style="font-family:Orbitron,sans-serif;font-size:0.55rem;color:rgba(220,60,60,0.6);letter-spacing:4px;text-transform:uppercase;margin-bottom:24px;">ACCESS REVOKED</div><div style="background:rgba(220,60,60,0.04);border:1px solid rgba(220,60,60,0.2);border-radius:14px;padding:28px 24px;"><div style="font-family:Orbitron,sans-serif;font-size:0.38rem;color:rgba(220,60,60,0.4);letter-spacing:3px;margin-bottom:12px;text-transform:uppercase;">Message from Queen Karin</div><div id="__silenceLockReason" style="font-size:1.05rem;color:#fff;line-height:1.6;letter-spacing:0.5px;">${safeReason}</div></div></div>`;
            document.body.appendChild(overlay);
        } else {
            const el = document.getElementById('__silenceLockReason');
            if (el) el.textContent = reason;
        }
    } else {
        document.getElementById(OVERLAY_ID)?.remove();
        document.getElementById(STYLE_ID)?.remove();
    }
}

// ═══════════════════════════════════════════════════════════
// PAID MEDIA — unlock flow for subs
// ═══════════════════════════════════════════════════════════

async function _unlockPaidMedia(paidMediaId: string, price: number) {
    const { wallet, email, memberId } = getState();
    const memberEmail = email || memberId || '';

    if ((wallet || 0) < price) {
        showPovertyModal('this exclusive media');
        return;
    }

    const btn = document.getElementById(`pmBtn_${paidMediaId}`) as HTMLButtonElement;
    if (btn) { btn.textContent = 'UNLOCKING...'; btn.disabled = true; }

    try {
        const res = await fetch('/api/paid-media/unlock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paidMediaId, email: memberEmail }),
        });
        const data = await res.json();

        if (data.success) {
            const newWallet = data.newWallet ?? ((wallet || 0) - price);
            setState({ wallet: newWallet });
            document.querySelectorAll('#coins, #mobCoins').forEach(el => {
                (el as HTMLElement).innerText = newWallet.toLocaleString();
            });

            _paidMediaUnlocked.add(paidMediaId);
            _revealPaidMedia(paidMediaId, data.mediaUrl, data.mediaType);
        } else if (data.error === 'INSUFFICIENT_FUNDS') {
            showPovertyModal('this exclusive media');
        } else {
            alert(data.error || 'Failed to unlock.');
        }
    } catch (err) {
        console.error('[paid-media] unlock error:', err);
    }

    if (btn) { btn.textContent = 'UNLOCK'; btn.disabled = false; }
}

/** Animate the blur-break reveal and make card clickable */
function _revealPaidMedia(pmId: string, mediaUrl?: string, mediaType?: string) {
    const wrap = document.getElementById(`pmWrap_${pmId}`);
    const overlay = document.getElementById(`pmOverlay_${pmId}`);
    const card = document.getElementById(`pmCard_${pmId}`);
    const statusEl = document.getElementById(`pmStatus_${pmId}`);

    // Remove blur directly on the image/video element
    if (wrap) {
        wrap.classList.remove('pm-locked');
        const img = wrap.querySelector('img') as HTMLElement;
        const vid = wrap.querySelector('video') as HTMLVideoElement;
        if (img) { img.style.filter = 'none'; img.style.transform = 'scale(1)'; }
        if (vid) { vid.style.filter = 'none'; vid.style.transform = 'scale(1)'; vid.controls = true; }
    }

    // Remove overlay
    if (overlay) overlay.remove();

    if (statusEl) { statusEl.textContent = 'UNLOCKED'; statusEl.className = 'pm-status unlocked'; }

    // Make card clickable for fullscreen view
    if (card && mediaUrl) {
        card.style.cursor = 'pointer';
        card.onclick = () => _openPaidMediaModal(mediaUrl, mediaType || 'photo');
    }
}

/** Fullscreen modal to view unlocked media */
function _openPaidMediaModal(url: string, type: string) {
    const existing = document.getElementById('pmModal');
    if (existing) existing.remove();

    const isVid = type === 'video' || /\.(mp4|mov|webm)/i.test(url);
    const mediaEl = isVid
        ? `<video src="${url}" controls autoplay playsinline style="max-width:100%;max-height:85vh;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,0.8);"></video>`
        : `<img src="${url}" style="max-width:100%;max-height:85vh;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,0.8);object-fit:contain;" />`;

    const modal = document.createElement('div');
    modal.id = 'pmModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;padding:16px;animation:fadeIn 0.25s ease;';
    modal.innerHTML = `
        <div style="position:absolute;top:16px;right:20px;font-size:2rem;color:#fff;cursor:pointer;z-index:2;opacity:0.7;" onclick="this.parentElement.remove()">✕</div>
        ${mediaEl}
    `;
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
}

/** Batch-check unlock status for paid media messages on chat load */
async function _checkPaidMediaUnlocks(messages: any[]) {
    const paidMediaIds = messages
        .filter((m: any) => m.type === 'paid_media' && m.metadata?.paid_media_id)
        .map((m: any) => m.metadata.paid_media_id);

    if (paidMediaIds.length === 0) return;

    const { email, memberId } = getState();
    const memberEmail = email || memberId || '';
    if (!memberEmail) return;

    try {
        const res = await fetch(`/api/paid-media/status?ids=${paidMediaIds.join(',')}&email=${encodeURIComponent(memberEmail)}`);
        if (!res.ok) return;
        const data = await res.json();
        const statuses = data.statuses || {};

        Object.entries(statuses).forEach(([id, s]: [string, any]) => {
            if (s.unlocked) {
                _paidMediaUnlocked.add(id);
                _revealPaidMedia(id, s.mediaUrl, s.mediaType);
            }
        });
    } catch {}
}

// Expose to window for onclick handlers
if (typeof window !== 'undefined') {
    (window as any)._unlockPaidMedia = _unlockPaidMedia;
    (window as any)._openPaidMediaModal = _openPaidMediaModal;
}

// ─── QUEEN'S GALLERY ─────────────────────────────────────────────────────────

const GALLERY_LABELS: Record<string, string> = {
    femdom: 'FEMDOM',
    regularlife: 'DAILY LIFE',
    feet: 'FEET',
};

let _galleryData: any[] | null = null;

export function switchMobQwTab(tab: 'wall' | 'gallery') {
    ['wall', 'gallery'].forEach(t => {
        const btn = document.getElementById(`mobQwTab_${t}`);
        const panel = document.getElementById(`mobQwPanel_${t}`);
        if (btn) btn.classList.toggle('active', t === tab);
        if (panel) panel.style.display = t === tab ? 'flex' : 'none';
    });
    if (tab === 'gallery' && !_galleryData) _loadGalleryAlbums();
}

async function _loadGalleryAlbums() {
    const el = document.getElementById('mobGalleryContent');
    if (!el) return;
    el.innerHTML = `<div style="text-align:center;padding:40px 0;color:#333;font-family:'Orbitron',sans-serif;font-size:0.5rem;letter-spacing:2px;">LOADING...</div>`;
    try {
        const res = await fetch('/api/gallery');
        const json = await res.json();
        _galleryData = json.albums || [];
    } catch {
        _galleryData = [];
    }
    _renderGalleryAlbums(el);
}

function _renderGalleryAlbums(el: HTMLElement) {
    if (!_galleryData || _galleryData.length === 0) {
        el.innerHTML = `<div style="text-align:center;padding:60px 20px;"><div style="font-family:'Cinzel',serif;font-size:1.1rem;color:rgba(197,160,89,0.4);margin-bottom:10px;">Gallery</div><div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:#333;letter-spacing:2px;">NO CONTENT YET</div></div>`;
        return;
    }

    const cardsHtml = _galleryData.map((album: any) => {
        const coverUrl = album.coverUrl ? getOptimizedUrl(album.coverUrl, 400) : '';
        const label = GALLERY_LABELS[album.category] || album.label || album.category.toUpperCase();
        return `
        <div class="mob-gallery-album-card" onclick="window.openGalleryAlbum('${album.category}')">
            ${coverUrl ? `<img class="mob-gallery-album-cover" src="${coverUrl}" alt="" loading="lazy" onerror="this.style.display='none'" />` : `<div style="width:100%;height:100%;background:linear-gradient(135deg,rgba(197,160,89,0.08),rgba(197,160,89,0.02));"></div>`}
            <div class="mob-gallery-album-info">
                <div class="mob-gallery-album-name">${label}</div>
                <div class="mob-gallery-album-count">${album.count} PHOTO${album.count !== 1 ? 'S' : ''}</div>
            </div>
        </div>`;
    }).join('');

    el.innerHTML = `
        <div style="font-family:'Cinzel',serif;font-size:1.2rem;color:#c5a059;letter-spacing:3px;margin-bottom:18px;">Gallery</div>
        <div class="mob-gallery-albums">${cardsHtml}</div>
    `;
}

export function openGalleryAlbum(category: string) {
    const el = document.getElementById('mobGalleryContent');
    if (!el || !_galleryData) return;

    const album = _galleryData.find((a: any) => a.category === category);
    if (!album) return;

    const label = GALLERY_LABELS[category] || album.label || category.toUpperCase();
    const items = album.items || [];

    const gridHtml = items.map((item: any) => {
        const thumb = getOptimizedUrl(item.thumbnail_url || item.media_url, 300);
        const full = item.media_url;
        const isPaid = (item.price || 0) > 0;
        const isVideo = item.media_type === 'video';

        if (isPaid) {
            return `
            <div class="mob-gallery-thumb mob-gallery-thumb-locked">
                <img src="${thumb}" alt="" loading="lazy" />
                <div class="mob-gallery-lock-overlay">
                    <span style="font-size:1.2rem;">🔒</span>
                    <span class="mob-gallery-lock-price"><i class="fas fa-coins"></i> ${item.price}</span>
                </div>
            </div>`;
        }

        const clickAction = isVideo
            ? `onclick="window._openPaidMediaModal('${full}','video')"`
            : `onclick="window._openPaidMediaModal('${full}','photo')"`;

        return `
        <div class="mob-gallery-thumb" ${clickAction}>
            <img src="${thumb}" alt="" loading="lazy" />
            ${isVideo ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;"><div style="width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;"><span style="color:#fff;font-size:0.9rem;margin-left:2px;">▶</span></div></div>` : ''}
        </div>`;
    }).join('');

    el.innerHTML = `
        <button class="mob-gallery-back" onclick="window.backToGalleryAlbums()">‹ BACK</button>
        <div class="mob-gallery-album-title">${label}</div>
        <div style="font-family:'Orbitron',sans-serif;font-size:0.38rem;color:#444;letter-spacing:2px;text-align:center;margin-bottom:16px;">${items.length} PHOTO${items.length !== 1 ? 'S' : ''}</div>
        <div class="mob-gallery-grid">${gridHtml}</div>
    `;
}

export function backToGalleryAlbums() {
    const el = document.getElementById('mobGalleryContent');
    if (!el) return;
    _renderGalleryAlbums(el);
}
