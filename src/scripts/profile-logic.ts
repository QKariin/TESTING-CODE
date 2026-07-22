import { getState, setState } from './profile-state';
import { createClient } from '@/utils/supabase/client';
import { getHierarchyReport } from '../lib/hierarchyRules';
import { uploadToSupabase, getVideoDuration, isVideo, extractAndUploadVideoThumbnail, generateImageThumbnail } from './mediaSupabase';
import { getOptimizedUrl } from './media';
import { presenceKey } from './dashboard-presence';

// ─── Custom coin confirm modal ───────────────────────────────────────────────
function _showCoinConfirm(opts: { title: string; cost: number; wallet: number; onConfirm: () => void; onCancel?: () => void; theme?: 'gold' | 'vault' }) {
    const existing = document.getElementById('_coinConfirmOverlay');
    if (existing) existing.remove();

    // Inject keyframes once
    if (!document.getElementById('_ccKeyframes')) {
        const style = document.createElement('style');
        style.id = '_ccKeyframes';
        style.textContent = '@keyframes _ccFadeIn{from{opacity:0}to{opacity:1}}';
        document.head.appendChild(style);
    }

    const isVault = opts.theme === 'vault';
    const canAfford = opts.wallet >= opts.cost;
    const ov = document.createElement('div');
    ov.id = '_coinConfirmOverlay';

    if (isVault) {
        // Full-screen vault mood
        ov.style.cssText = 'position:fixed;inset:0;z-index:10000001;display:flex;align-items:center;justify-content:center;flex-direction:column;background:#080507;animation:_ccFadeIn 0.25s ease;';
        const accent = canAfford ? 'rgba(255,255,255,0.5)' : 'rgba(255,60,60,0.5)';
        ov.innerHTML = `
            <div style="text-align:center;max-width:340px;padding:0 28px;">
                <div style="font-family:Rajdhani,sans-serif;font-size:0.85rem;color:rgba(255,255,255,0.45);letter-spacing:4px;margin-bottom:24px;">${opts.title}</div>
                <div style="font-family:Cinzel,serif;font-size:2.6rem;color:${accent};font-weight:700;letter-spacing:2px;">${opts.cost.toLocaleString()}</div>
                <div style="font-family:Rajdhani,sans-serif;font-size:0.9rem;color:rgba(255,255,255,0.35);margin-top:6px;letter-spacing:3px;">COINS</div>
                <div style="width:40px;height:1px;background:rgba(255,255,255,0.1);margin:24px auto;"></div>
                <div style="font-family:Rajdhani,sans-serif;font-size:1rem;color:rgba(255,255,255,0.4);">wallet: ${opts.wallet.toLocaleString()} coins</div>
                ${!canAfford ? '<div style="font-family:Rajdhani,sans-serif;font-size:0.9rem;color:rgba(255,60,60,0.6);margin-top:8px;">insufficient funds</div>' : ''}
                <div style="display:flex;gap:14px;margin-top:32px;">
                    <button id="_ccCancel" style="flex:1;padding:16px 0;border-radius:10px;background:transparent;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.4);font-family:Cinzel,serif;font-size:0.85rem;letter-spacing:2px;cursor:pointer;">CANCEL</button>
                    ${canAfford ? '<button id="_ccConfirm" style="flex:1;padding:16px 0;border-radius:10px;background:rgba(139,0,0,0.15);border:1px solid rgba(139,0,0,0.3);color:rgba(200,50,50,0.85);font-family:Cinzel,serif;font-size:0.85rem;letter-spacing:2px;cursor:pointer;">PROCEED</button>' : ''}
                </div>
            </div>`;
    } else {
        // Default gold theme
        ov.style.cssText = 'position:fixed;inset:0;z-index:10000001;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);animation:_ccFadeIn 0.25s ease;';
        const card = document.createElement('div');
        card.style.cssText = 'width:88%;max-width:340px;border-radius:18px;background:linear-gradient(170deg,#0c0a10 0%,#110e18 50%,#0c0a10 100%);border:1px solid rgba(197,160,89,0.25);box-shadow:0 20px 60px rgba(0,0,0,0.9),0 0 30px rgba(197,160,89,0.04);padding:28px 24px 22px;text-align:center;';
        const coinColor = canAfford ? 'rgba(197,160,89,0.9)' : 'rgba(255,60,60,0.8)';
        const walletColor = canAfford ? 'rgba(255,255,255,0.35)' : 'rgba(255,60,60,0.5)';
        card.innerHTML = `
            <div style="font-family:Cinzel,serif;font-size:0.85rem;color:rgba(197,160,89,0.6);letter-spacing:4px;margin-bottom:18px;">${opts.title}</div>
            <div style="font-family:Cinzel,serif;font-size:2.4rem;color:${coinColor};font-weight:700;letter-spacing:2px;">${opts.cost.toLocaleString()}</div>
            <div style="font-family:Rajdhani,sans-serif;font-size:0.9rem;color:rgba(197,160,89,0.5);margin-top:4px;letter-spacing:2px;">COINS</div>
            <div style="width:60px;height:1px;background:rgba(197,160,89,0.2);margin:18px auto;"></div>
            <div style="font-family:Rajdhani,sans-serif;font-size:1rem;color:${walletColor};">wallet: ${opts.wallet.toLocaleString()} coins</div>
            ${!canAfford ? '<div style="font-family:Rajdhani,sans-serif;font-size:0.9rem;color:rgba(255,60,60,0.7);margin-top:8px;">insufficient funds</div>' : ''}
            <div style="display:flex;gap:14px;margin-top:28px;">
                <button id="_ccCancel" style="flex:1;padding:16px 0;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);font-family:Cinzel,serif;font-size:0.85rem;letter-spacing:2px;cursor:pointer;">CANCEL</button>
                ${canAfford ? '<button id="_ccConfirm" style="flex:1;padding:16px 0;border-radius:10px;background:rgba(197,160,89,0.14);border:1px solid rgba(197,160,89,0.35);color:rgba(197,160,89,0.95);font-family:Cinzel,serif;font-size:0.85rem;letter-spacing:2px;cursor:pointer;">PROCEED</button>' : ''}
            </div>`;
        ov.appendChild(card);
    }

    document.body.appendChild(ov);
    const close = () => { ov.style.opacity = '0'; ov.style.transition = 'opacity 0.2s'; setTimeout(() => ov.remove(), 200); };

    ov.querySelector('#_ccCancel')!.addEventListener('click', () => { close(); opts.onCancel?.(); });
    if (canAfford) ov.querySelector('#_ccConfirm')!.addEventListener('click', () => { close(); opts.onConfirm(); });
    ov.addEventListener('click', (e) => { if (e.target === ov) { close(); opts.onCancel?.(); } });
}

// ─── DAILY VERIFICATION CODE (same formula as dashboard) ───
function getDailyCode(): string {
    const d = new Date();
    const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    return String((seed * 7 + 1337) % 9000 + 1000);
}

function showDailyCode() {
    const code = getDailyCode();
    const els = ['deskDailyCodeVal', 'mobDailyCodeVal'];
    els.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = code; });
    const containers = ['deskDailyCode', 'mobDailyCode'];
    containers.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'block'; });
}

function hideDailyCode() {
    const containers = ['deskDailyCode', 'mobDailyCode'];
    containers.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
}

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

    // Hide overlay immediately — _claiming flag prevents double-taps
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
            body: JSON.stringify({ choice: type, memberId: pid, source: 'kneel' })
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

    // 4. Play sound (overlay already hidden at top of function) — discreet metadata for phone/car
    if ('mediaSession' in navigator) {
        try { navigator.mediaSession.metadata = new MediaMetadata({ title: 'Good Boy Radio', artist: 'Live', album: '' }); } catch (_) {}
    }
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
            <div onclick="window.buyTribute('${t.id}', '${t.title}', ${t.price}, '${(t.image||'').replace(/'/g, "\\'")}')" style="position:relative; border-radius:10px; overflow:hidden; background:#0a0a14; border:1px solid rgba(197,160,89,0.2); cursor:pointer; transition:all 0.25s ease; box-shadow:0 4px 20px rgba(0,0,0,0.4); flex-shrink:1; min-height:0;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 30px rgba(197,160,89,0.15)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 20px rgba(0,0,0,0.4)';">
                    <div style="width:100%; height:80px; background-color:#050510; position:relative; overflow:hidden;">
                        <img src="${getOptimizedUrl(t.image, 400)}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='/queen-karin.png'">
                    </div>
                <div style="position:absolute; top:6px; right:6px; background:rgba(5,5,20,0.85); border:1px solid rgba(197,160,89,0.5); border-radius:20px; padding:3px 8px; display:flex; align-items:center; gap:4px; backdrop-filter:blur(5px);">
                    <i class="fas fa-coins" style="color:#c5a059; font-size:0.55rem;"></i>
                    <span style="font-family:'Orbitron', sans-serif; font-size:0.6rem; color:#c5a059; font-weight:700; letter-spacing:1px;">${t.price.toLocaleString()}</span>
                </div>
                <div style="padding:8px 10px 10px; display:flex; align-items:center; justify-content:space-between; gap:8px;">
                    <div style="font-family:'Cinzel', serif; font-size:0.8rem; color:#fff; font-weight:700; letter-spacing:1px; text-transform:uppercase;">${t.title}</div>
                    <div style="flex-shrink:0; text-align:center; background:linear-gradient(135deg, #c5a059 0%, #8b6914 100%); color:#000; font-family:'Orbitron', sans-serif; font-size:0.5rem; font-weight:700; letter-spacing:1px; padding:6px 10px; border-radius:5px;">SEND</div>
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
                            <div style="font-family:'Cinzel', serif; font-size:2rem; color:#fff; line-height:1.1; font-weight:700; letter-spacing:2px; text-transform:uppercase;">${t.title}</div>
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
                                    oninput="window.updateCrowdfundSlider(this)"
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
                    <div style="font-family:'Cinzel', serif; font-size:0.85rem; color:#fff; font-weight:700; letter-spacing:1px; text-transform:uppercase; line-height:1.3; flex:1;">${t.title}</div>
                    <button onclick="event.stopPropagation(); window.buyTribute('${t.id}', '${t.title}', ${t.price}, '${(t.image||'').replace(/'/g, "\\'")}')"
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
    // Also refresh standalone wishlist grid (landing page tribute menu) if open
    const gridStandalone = document.getElementById('standaloneWishlistGrid');
    if (gridStandalone) renderGridMobile(gridStandalone);
}

function renderGridMobile(gridEl: HTMLElement) {
    if (!gridEl) return;
    console.log('[TRIBUTE] renderGridMobile called, items:', globalTributes.length, globalTributes.map(t => ({ id: t.id, title: t.title, price: t.price, image: t.image?.slice(0, 60) })));
    const walletForSlider = getState()?.wallet || 0;

    // Set the grid container itself
    gridEl.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:12px 10px 24px;overflow-y:auto;flex:1;align-content:start;align-items:start;width:100%;min-height:0;box-sizing:border-box;';

    const items = (window as any)._vaultHideCrowdfund ? globalTributes.filter(t => !t.is_crowdfund) : globalTributes;

    gridEl.innerHTML = items.map(t => {
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
                    <div style="font-family:'Cinzel',serif; font-size:1.05rem; color:#fff; font-weight:700; letter-spacing:1px; text-transform:uppercase;">${t.title}</div>
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
                            oninput="window.updateCrowdfundSlider(this)"
                            style="flex:1; height:5px; appearance:none; background:rgba(197,160,89,0.2); border-radius:3px; accent-color:#c5a059;" />
                        <button id="crowdfund_btn_${t.id}" onclick="window.contributeCrowdfund('${t.id}','${t.title}')"
                            style="background:linear-gradient(135deg,#c5a059,#8b6914); color:#000; border:none; padding:9px 14px; border-radius:8px; font-family:'Orbitron',sans-serif; font-size:0.5rem; font-weight:700; letter-spacing:1px; cursor:pointer; white-space:nowrap;">
                            SEND <span id="crowdfund_display_${t.id}">${sliderDefault}</span>
                        </button>
                    </div>
                </div>
            </div>`;
        }

        const locked = t.price > walletForSlider;
        const lockOverlay = locked ? `<div style="position:absolute; inset:0; background:rgba(4,4,16,0.7); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); z-index:2; display:flex; align-items:center; justify-content:center;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>` : '';

        return `
        <div onclick="${locked ? '' : `window.buyTribute('${t.id}','${t.title}',${t.price},'${(t.image||'').replace(/'/g, "\\'")}')`}" style="position:relative; border-radius:12px; overflow:hidden; background:#0a0a14; border:1px solid ${locked ? 'rgba(255,255,255,0.06)' : 'rgba(197,160,89,0.22)'}; box-shadow:0 4px 16px rgba(0,0,0,0.4); aspect-ratio:3/4; cursor:${locked ? 'default' : 'pointer'};">
            ${img ? `<img src="${img}" style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'">` : ''}
            <div style="position:absolute; inset:0; background:linear-gradient(to top, rgba(4,4,16,0.95) 0%, rgba(4,4,16,0.6) 40%, transparent 65%);"></div>
            ${lockOverlay}
            <div style="position:absolute; bottom:0; left:0; right:0; padding:10px 12px 12px; display:flex; flex-direction:column; gap:6px; ${locked ? 'z-index:3;' : ''}">
                <div style="display:flex; align-items:center; gap:5px;">
                    <i class="fas fa-coins" style="color:${locked ? 'rgba(197,160,89,0.35)' : '#c5a059'}; font-size:9px;"></i>
                    <span style="font-family:'Orbitron',sans-serif; font-size:11px; color:${locked ? 'rgba(197,160,89,0.35)' : '#c5a059'}; font-weight:700;">${t.price.toLocaleString()}</span>
                </div>
                <div style="font-family:'Cinzel',serif; font-size:13px; color:${locked ? 'rgba(255,255,255,0.3)' : '#fff'}; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; line-height:1.3;">${t.title}</div>
                ${locked ? '' : `<button onclick="event.stopPropagation(); window.buyTribute('${t.id}','${t.title}',${t.price},'${(t.image||'').replace(/'/g, "\\'")}')"
                    style="width:100%; background:linear-gradient(135deg,#c5a059,#8b6914); color:#000; border:none; padding:10px 0; border-radius:6px; font-family:'Orbitron',sans-serif; font-size:9px; font-weight:700; letter-spacing:1.5px; cursor:pointer;">
                    SEND GIFT
                </button>`}
            </div>
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
function showNewMessageBanner(preview: string, mediaUrl?: string) {
    const existing = document.getElementById('queenMsgBanner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'queenMsgBanner';
    const escaped = preview.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const mediaBlock = mediaUrl
        ? `<div style="margin-top:10px;border-radius:10px;overflow:hidden;max-height:160px;border:1px solid rgba(197,160,89,0.15);"><img src="${mediaUrl}" style="width:100%;max-height:160px;object-fit:contain;display:block;" onerror="this.parentElement.style.display='none'" /></div>`
        : '';
    banner.innerHTML = `
        <div style="display:flex; align-items:flex-start; gap:14px;">
            <img src="/queen-nav.png" style="flex-shrink:0; width:44px; height:44px; border-radius:50%; object-fit:cover; border:1.5px solid rgba(197,160,89,0.6);" onerror="this.style.display='none'" />
            <div style="flex:1; min-width:0;">
                <div style="font-family:'Orbitron', sans-serif; font-size:0.5rem; color:#c5a059; letter-spacing:3px; text-transform:uppercase; margin-bottom:6px;">
                    <svg width="10" height="8" viewBox="0 0 26 20" fill="#c5a059" style="vertical-align:middle;margin-right:4px;"><path d="M2 18 L5 8 L10 13 L13 3 L16 13 L21 8 L24 18 Z"/><rect x="2" y="17" width="22" height="2" rx="1"/></svg>New Message</div>
                <div style="font-family:'Rajdhani', sans-serif; font-size:1.05rem; color:rgba(255,255,255,0.85); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; font-weight:500;">${escaped}</div>
            </div>
        </div>
        ${mediaBlock}
        <div style="display:flex; gap:8px; margin-top:14px;">
            <button onclick="document.getElementById('queenMsgBanner').remove();" style="flex:1; background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.5); border:1px solid rgba(255,255,255,0.1); padding:9px 0; border-radius:8px; font-family:'Orbitron', sans-serif; font-size:0.5rem; letter-spacing:1px; cursor:pointer;" onmouseover="this.style.background='rgba(255,255,255,0.1)';" onmouseout="this.style.background='rgba(255,255,255,0.06)';">DISMISS</button>
            <button onclick="document.getElementById('queenMsgBanner').remove(); if(typeof window.openMobChatOverlay==='function') window.openMobChatOverlay();" style="flex:2; background:linear-gradient(135deg, #c5a059 0%, #8b6914 100%); color:#000; border:none; padding:9px 0; border-radius:8px; font-family:'Orbitron', sans-serif; font-size:0.5rem; font-weight:700; letter-spacing:1px; cursor:pointer;" onmouseover="this.style.opacity='0.85';" onmouseout="this.style.opacity='1';">OPEN CHAT</button>
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

                // 4. Send Chat message — realtime subscription will render the card
                const tributeObj = globalTributes.find(t => t.id === id);
                const tributeImage = tributeObj?.display_url || tributeObj?.image || "";
                fetch('/api/chat/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ memberId: memberId, content: `Contributed ${amount.toLocaleString()} to ${title}`, type: 'wishlist', metadata: { title, price: amount, image: tributeImage, isQueen: false } })
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

let _buyingTribute = false;
export async function buyTribute(id: string, title: string, cost: number, image?: string) {
    if (_buyingTribute) return;
    _buyingTribute = true;

    const { memberId, wallet } = getState();
    if (!memberId) { _buyingTribute = false; return; }

    if (wallet < cost) {
        _buyingTribute = false;
        showPovertyModal(title);
        return;
    }

    // Disable all SEND GIFT buttons immediately
    document.querySelectorAll<HTMLButtonElement>('button').forEach(btn => {
        if (btn.textContent?.trim() === 'SEND GIFT') {
            btn.disabled = true;
            btn.style.opacity = '0.4';
            btn.style.pointerEvents = 'none';
        }
    });

    try {
        const res = await fetch('/api/tributes/purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memberEmail: memberId, tributeId: id, tributeTitle: title, tributeCost: cost, tributeImage: image || null })
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

            // Chat card is inserted by /api/tributes/purchase — realtime will render it
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
    } finally {
        _buyingTribute = false;
    }
}

// Ensure functions are available globally for inline onclick handlers
if (typeof window !== 'undefined') {
    (window as any).buyTribute = buyTribute;
    (window as any).toggleTributeHuntGlobal = () => toggleTributeHunt();
    (window as any).openTributeHunt = () => openTributeHunt();
    (window as any)._renderTributeGridMobile = (grid: HTMLElement) => renderGridMobile(grid);
    (window as any).updateCrowdfundSlider = (inputEl: HTMLInputElement) => {
        const v = Number(inputEl.value);
        // Find sibling button in the same container (works for both desktop and mobile)
        const container = inputEl.parentElement;
        if (!container) return;
        const btn = container.querySelector('button');
        const span = btn?.querySelector('span');
        if (span) {
            // Mobile: button contains "SEND <span>value</span>"
            span.textContent = v.toLocaleString();
        } else if (btn) {
            // Desktop: button text is "SEND X COINS"
            btn.textContent = 'SEND ' + v.toLocaleString() + ' COINS';
        }
        // Desktop: also update the standalone display div above the slider
        const wrapper = container.parentElement;
        const displayDiv = wrapper?.querySelector('div[id^="crowdfund_display_"]') as HTMLElement;
        if (displayDiv) {
            displayDiv.innerHTML = v.toLocaleString() + ' <i class="fas fa-coins" style="font-size:1rem;"></i>';
        }
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

export function openTributeHunt() {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        const overlayMob = document.getElementById('mob_TributeOverlay');
        if (overlayMob) {
            overlayMob.style.display = 'flex';
            overlayMob.classList.remove('hidden');
            const gridMob = document.getElementById('mob_huntStoreGrid');
            if (gridMob) renderGridMobile(gridMob);
        }
    } else {
        const overlayDesk = document.getElementById('tributeHuntOverlay');
        if (overlayDesk) {
            overlayDesk.style.display = 'flex';
            overlayDesk.classList.remove('hidden');
        }
    }
}

export function openLobby() {
    const el = document.getElementById('lobbyOverlay');
    if (!el) return;
    el.classList.remove('hidden');
    el.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    const { memberId, id } = getState();
    const emailEl = document.getElementById('hubEmail');
    if (emailEl) emailEl.textContent = memberId || id || '';
    _updateNotifToggleUI();
    _updateHubLocks();
    _updateInstallRow();
}

export function closeLobby() {
    const el = document.getElementById('lobbyOverlay');
    if (!el) return;
    el.classList.add('hidden');
    el.style.display = 'none';
    if (!_anyHubOpen()) document.body.style.overflow = '';
}

function _anyHubOpen(): boolean {
    return ['lobbyOverlay', 'queenOverlay'].some(id => {
        const el = document.getElementById(id);
        return el && !el.classList.contains('hidden') && el.style.display !== 'none';
    });
}

function _updateHubLocks() {
    const state = getState();
    const rank = (state as any).rank || 'Hall Boy';
    const rankLc = rank.toLowerCase().trim();
    const isHallBoy = rankLc === 'hall boy';
    const isHallBoyOrFootman = isHallBoy || rankLc === 'footman';
    const lockItems = [
        { row: 'hubRoutineRow', lock: 'hubRoutineLock', desc: 'hubRoutineDesc', lockedText: 'Unlock at Footman rank', locked: isHallBoy },
        { row: 'hubKinksRow', lock: 'hubKinksLock', desc: 'hubKinksDesc', lockedText: 'Unlock at Silverman rank', locked: isHallBoyOrFootman },
        { row: 'hubLimitsRow', lock: 'hubLimitsLock', desc: 'hubLimitsDesc', lockedText: 'Unlock at Silverman rank', locked: isHallBoyOrFootman },
    ];
    for (const item of lockItems) {
        const row = document.getElementById(item.row) as HTMLButtonElement | null;
        const lock = document.getElementById(item.lock);
        const desc = document.getElementById(item.desc);
        if (!row) continue;
        if (item.locked) {
            row.style.opacity = '0.45';
            row.style.pointerEvents = 'none';
            if (lock) lock.style.display = '';
            if (desc) desc.textContent = item.lockedText;
        } else {
            row.style.opacity = '';
            row.style.pointerEvents = '';
            if (lock) lock.style.display = 'none';
        }
    }
}

function _updateInstallRow() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    const state = getState();
    const raw = (window as any).__currentProfileRaw || state.raw || state;
    const alreadyClaimed = raw?.parameters?.appInstallClaimed === true;
    const show = !isStandalone && !alreadyClaimed;
    const row = document.getElementById('queenHubInstallRow');
    if (row) row.style.display = show ? '' : 'none';
}

function _sendInstallNotifyOnce(u: any) {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    if (!isStandalone) return;
    if (localStorage.getItem('_appInstallNotified')) return;
    const { memberId, id } = getState();
    const userId = memberId || id;
    if (!userId) return;
    localStorage.setItem('_appInstallNotified', '1');
    fetch('/api/app-install-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: userId, memberName: u?.name || 'Unknown' })
    }).catch(() => {});
}

export async function handleInstallApp() {
    const deferredPrompt = (window as any)._deferredInstallPrompt;
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const result = await deferredPrompt.userChoice;
        if (result.outcome === 'accepted') {
            await _claimInstallReward();
        }
        (window as any)._deferredInstallPrompt = null;
    } else {
        // Show manual instructions for iOS / browsers without beforeinstallprompt
        const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
        const msg = isIOS
            ? 'Tap the Share button at the bottom of Safari, then tap "Add to Home Screen".'
            : 'Open your browser menu and tap "Add to Home Screen" or "Install App".';
        if ((window as any).openTextFieldModal) {
            // Show a simple info overlay
            alert(msg + '\n\nOnce installed, open the app from your home screen and your 1,000 coins will be credited automatically.');
        } else {
            alert(msg);
        }
    }
}

async function _claimInstallReward() {
    const { memberId, id, raw } = getState();
    const userId = memberId || id;
    if (!userId) return;
    try {
        await fetch('/api/claim-reward', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memberId: userId, choice: 'coins', source: 'install' })
        });
        // Set appInstallClaimed + send dashboard notification (idempotent)
        await fetch('/api/app-install-notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memberId: userId, memberName: raw?.name || 'Unknown' })
        });
        const row = document.getElementById('hubInstallRow');
        if (row) row.style.display = 'none';
    } catch (e) {
        console.error('[HUB] Install reward claim failed:', e);
    }
}

// ── Certificate rank themes ──────────────────────────────────────────────────
interface CertTheme {
    tier: number;
    accent: string;
    ar: number; ag: number; ab: number;
    bgCss: string;
    bgImage?: string;
    borderCss: string;
    glow: number;
    stats: string[];
    tagline: string;
    shadow: string;
}

function getCertTheme(rank: string): CertTheme {
    switch (rank.toLowerCase().trim()) {
        case 'footman': return {
            tier: 1, accent: '#a07848', ar: 160, ag: 120, ab: 72,
            bgCss: '#0a0906',
            bgImage: '/cert-bg-footman-v12.svg',
            borderCss: '1px solid rgba(160,120,72,0.25)',
            glow: 0, stats: ['kneels', 'tasks', 'score', 'sacrifice', 'streak'],
            tagline: 'Earning the right to be seen.',
            shadow: '0 25px 70px rgba(0,0,0,0.9)',
        };
        case 'silverman': return {
            tier: 2, accent: '#a0a8b8', ar: 160, ag: 168, ab: 184,
            bgCss: 'linear-gradient(175deg,#0a0a0c 0%,#0d0d10 50%,#0a0a0c 100%)',
            bgImage: '/cert-bg-silverman-v2.svg',
            borderCss: '1px solid rgba(160,168,184,0.25)',
            glow: 0.03, stats: ['kneels', 'tasks', 'score', 'sacrifice', 'streak'],
            tagline: 'Rising through devotion.',
            shadow: '0 25px 70px rgba(0,0,0,0.9),0 0 1px rgba(160,168,184,0.3)',
        };
        case 'butler': return {
            tier: 3, accent: '#c5a059', ar: 197, ag: 160, ab: 89,
            bgCss: 'linear-gradient(175deg,#0a0806 0%,#0f0c08 30%,#0a0806 60%,#0d0b07 100%)',
            bgImage: '/cert-bg-butler-v6.svg',
            borderCss: '1.5px solid rgba(197,160,89,0.35)',
            glow: 0.04, stats: ['kneels', 'tasks', 'score', 'sacrifice', 'streak'],
            tagline: 'Trusted with purpose.',
            shadow: '0 30px 80px rgba(0,0,0,0.95),0 0 1px rgba(197,160,89,0.4)',
        };
        case 'chamberlain': return {
            tier: 4, accent: '#d4af5a', ar: 212, ag: 175, ab: 90,
            bgCss: 'linear-gradient(175deg,#0b0906 0%,#100d08 30%,#0b0906 60%,#0e0c07 100%)',
            bgImage: '/cert-bg-chamberlain-v4.svg',
            borderCss: '2px solid rgba(212,175,90,0.4)',
            glow: 0.06, stats: ['kneels', 'tasks', 'score', 'sacrifice', 'streak'],
            tagline: 'A voice in the court.',
            shadow: '0 30px 80px rgba(0,0,0,0.95),0 0 2px rgba(212,175,90,0.4)',
        };
        case 'secretary': return {
            tier: 5, accent: '#dbb960', ar: 219, ag: 185, ab: 96,
            bgCss: 'linear-gradient(175deg,#0c0a06 0%,#110e08 30%,#0c0a06 60%,#0f0d07 100%)',
            borderCss: '2px solid rgba(219,185,96,0.5)',
            glow: 0.08, stats: ['kneels', 'tasks', 'score', 'sacrifice', 'streak'],
            tagline: 'Authority earned through sacrifice.',
            shadow: '0 30px 80px rgba(0,0,0,0.95),0 0 4px rgba(219,185,96,0.3)',
        };
        case "queen's champion": return {
            tier: 6, accent: '#e8c84a', ar: 232, ag: 200, ab: 74,
            bgCss: 'linear-gradient(175deg,#0d0b06 0%,#12100a 30%,#0d0b06 60%,#100e08 100%)',
            borderCss: '2.5px solid rgba(232,200,74,0.55)',
            glow: 0.12, stats: ['kneels', 'tasks', 'score', 'sacrifice', 'streak'],
            tagline: 'Absolute devotion. Manifest will.',
            shadow: '0 30px 80px rgba(0,0,0,0.95),0 0 8px rgba(232,200,74,0.25),0 0 30px rgba(232,200,74,0.08)',
        };
        default: return { // Hall Boy
            tier: 0, accent: '#888', ar: 136, ag: 136, ab: 136,
            bgCss: 'linear-gradient(175deg,#0a0a0a 0%,#0e0e0e 50%,#0a0a0a 100%)',
            bgImage: '/cert-bg-hallboy-v2.svg',
            borderCss: '1px solid rgba(136,136,136,0.15)',
            glow: 0, stats: [],
            tagline: 'I have begun my service to Queen Karin.',
            shadow: '0 20px 60px rgba(0,0,0,0.9)',
        };
    }
}

export function showCertificate() {
    const state = getState();
    const raw = (window as any).__currentProfileRaw || state.raw || state;
    const avatarUrl = raw?.avatar_url || raw?.profile_picture_url || '';
    if (!avatarUrl || avatarUrl === '/collar-placeholder.png') {
        const m = document.createElement('div');
        m.style.cssText = 'position:fixed;inset:0;z-index:10000001;background:#020512;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;';
        m.innerHTML = `
            <div style="text-align:center;max-width:340px;">
                <div style="font-family:Orbitron,sans-serif;font-size:0.55rem;color:rgba(197,160,89,0.5);letter-spacing:6px;margin-bottom:16px;">CERTIFICATE</div>
                <div style="font-family:Cinzel,serif;font-size:1.1rem;color:#fff;letter-spacing:2px;line-height:1.6;margin-bottom:24px;">You need to add your profile picture first.</div>
                <button id="_certNoPicBtn" style="padding:14px 40px;background:linear-gradient(135deg,#0a0806,#1a150d);border:1px solid rgba(197,160,89,0.4);border-radius:8px;color:#c5a059;font-family:Orbitron,sans-serif;font-size:0.65rem;font-weight:700;letter-spacing:2px;cursor:pointer;">GOT IT</button>
            </div>
        `;
        document.body.appendChild(m);
        m.querySelector('#_certNoPicBtn')?.addEventListener('click', () => {
            m.remove();
            closeEarnCoinsModal();
            closeQueenMenu();
            closeLobby();
        });
        return;
    }
    const name = raw?.name || 'LOYAL SUBJECT';
    const rank = (state as any).rank || raw?.hierarchy || 'Hall Boy';
    const kneels = Number(raw?.kneelCount || 0);
    const tasks = Number(raw?.Taskdom_CompletedTasks || raw?.taskdom_completed_tasks || 0);
    const sacrifice = Number(raw?.total_coins_spent || 0);
    const score = Number(raw?.score || state.score || 0);
    const sinceRaw = raw?.joined_date || raw?.created_at || '';
    const since = sinceRaw ? new Date(sinceRaw).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
    const streak = Number(raw?.bestRoutinestreak || raw?.routinestreak || 0);

    const t = getCertTheme(rank);
    const a = `${t.ar},${t.ag},${t.ab}`;



    const overlay = document.createElement('div');
    overlay.id = 'certOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000001;background:rgba(0,0,0,0.95);display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:16px;box-sizing:border-box;overflow-y:auto;-webkit-overflow-scrolling:touch;';

    const card = document.createElement('div');
    card.id = 'certCard';
    card.style.cssText = `width:355px;max-width:92vw;background:${t.bgCss};border:${t.borderCss};border-radius:4px;padding:0;text-align:center;box-shadow:${t.shadow};position:relative;overflow:hidden;margin-top:24px;`;

    const statLine = (label: string, value: string) =>
        `<div style="display:flex;justify-content:space-between;align-items:baseline;padding:8px 0;border-bottom:1px solid rgba(${a},0.06);">
            <span style="font-family:'Cinzel',serif;font-size:0.82rem;color:rgba(${a},0.65);letter-spacing:1px;">${label}</span>
            <span style="font-family:'Cinzel',serif;font-size:0.88rem;color:rgba(255,255,255,0.85);font-weight:600;">${value}</span>
        </div>`;

    const statMap: Record<string, [string, string]> = {
        kneels: ['Kneeling', kneels.toLocaleString()],
        tasks: ['Tasks Completed', tasks.toLocaleString()],
        score: ['Points Earned', score.toLocaleString()],
        sacrifice: ['Sacrifice', sacrifice.toLocaleString()],
        streak: ['Best Streak', streak.toString()],
    };

    let statsHtml: string;
    if (t.stats.length > 0) {
        const lines = t.stats.map(k => statMap[k]).filter(Boolean).map(([l, v]) => statLine(l, v)).join('');
        statsHtml = `<div style="padding:4px 24px 4px;text-align:left;">
            ${lines}
            ${since ? statLine('Serving Since', since) : ''}
        </div>`;
    } else {
        statsHtml = `<div style="padding:24px 28px;">
            <div style="font-family:'Cinzel',serif;font-size:0.85rem;color:rgba(255,255,255,0.45);font-style:italic;line-height:1.8;letter-spacing:0.5px;">${t.tagline}</div>
            ${since ? `<div style="margin-top:18px;padding-top:14px;border-top:1px solid rgba(${a},0.08);font-family:'Cinzel',serif;font-size:0.6rem;color:rgba(${a},0.3);letter-spacing:3px;">SERVING SINCE</div>
            <div style="font-family:'Cinzel',serif;font-size:0.8rem;color:rgba(255,255,255,0.55);margin-top:4px;">${since}</div>` : ''}
        </div>`;
    }

    const innerBorder = t.tier >= 4
        ? `<div style="position:absolute;inset:6px;border:1px solid rgba(${a},${t.tier >= 5 ? 0.15 : 0.08});border-radius:2px;pointer-events:none;"></div>`
        : '';

    // Tier-specific decorative extras
    const topOrnament = t.tier >= 5
        ? `<div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(to right,transparent 5%,rgba(${a},0.4) 30%,rgba(${a},0.6) 50%,rgba(${a},0.4) 70%,transparent 95%);"></div>`
        : '';
    const bottomOrnament = t.tier >= 5
        ? `<div style="position:absolute;bottom:0;left:0;right:0;height:2px;background:linear-gradient(to right,transparent 10%,rgba(${a},0.3) 40%,rgba(${a},0.3) 60%,transparent 90%);"></div>`
        : '';

    const overlayHtml = `<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 0%,rgba(${a},${t.glow}) 0%,transparent 50%);pointer-events:none;"></div>`;

    card.innerHTML = `
        ${overlayHtml}
        ${innerBorder}
        ${topOrnament}
        ${bottomOrnament}

        <!-- QKARIN.COM -->
        <div style="padding:${t.tier >= 5 ? '28' : '24'}px 24px 6px;">
            <div style="font-family:'Cinzel',serif;font-size:1.5rem;color:${t.accent};font-weight:700;letter-spacing:5px;${t.tier >= 6 ? 'text-shadow:0 0 20px rgba(' + a + ',0.3);' : ''}">${t.tier >= 6 ? '\u265B ' : ''}QKARIN.COM${t.tier >= 6 ? ' \u265B' : ''}</div>
        </div>

        <!-- CERTIFICATE OF SERVICE -->
        <div style="padding:8px 24px 18px;">
            <div style="font-family:'Cinzel',serif;font-size:0.68rem;color:rgba(${a},0.55);letter-spacing:10px;">CERTIFICATE OF SERVICE</div>
        </div>

        <div style="width:85%;height:1px;background:linear-gradient(to right,transparent,rgba(${a},${t.tier >= 3 ? 0.3 : 0.15}),transparent);margin:0 auto;"></div>

        <!-- NAME + POSITION -->
        <div style="padding:16px 24px 0;">
            <div style="font-family:'Cinzel',serif;font-size:1.2rem;color:rgba(255,255,255,0.9);font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:5px;${t.tier >= 5 ? 'text-shadow:0 0 15px rgba(' + a + ',0.15);' : ''}">${name}</div>
            <div style="font-family:'Cinzel',serif;font-size:0.7rem;color:rgba(${a},${t.tier >= 3 ? 0.65 : 0.45});letter-spacing:4px;">${rank.toUpperCase()}</div>
            ${t.stats.length > 0 ? `<div style="font-family:'Cinzel',serif;font-size:0.5rem;color:rgba(${a},0.25);letter-spacing:2px;margin-top:4px;font-style:italic;">${t.tagline}</div>` : ''}
        </div>

        <div style="width:60%;height:1px;background:linear-gradient(to right,transparent,rgba(${a},${t.tier >= 3 ? 0.35 : 0.15}),transparent);margin:14px auto;"></div>

        ${statsHtml}

        <!-- FOOTER -->
        <div style="padding:12px 24px 20px;">
            <div style="font-family:'Cinzel',serif;font-size:0.5rem;color:rgba(${a},0.25);letter-spacing:3px;">QKARIN.COM</div>
        </div>
    `;

    const btnWrap = document.createElement('div');
    btnWrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;margin-top:16px;width:355px;max-width:92vw;padding-bottom:40px;';

    // Check if cert already downloaded for this rank
    const certParams = raw?.parameters || {};
    const certsDownloaded = certParams.certs_downloaded || {};
    const rankKey = rank.toLowerCase().replace(/[^a-z0-9]/g, '');
    const alreadyDownloaded = !!certsDownloaded[rankKey];

    const shareBtn = document.createElement('button');
    shareBtn.id = 'certShareBtn';
    shareBtn.style.cssText = 'width:100%;padding:15px;border-radius:4px;border:1px solid rgba(197,160,89,0.25);background:rgba(197,160,89,0.04);color:rgba(197,160,89,0.8);font-family:Cinzel,serif;font-size:0.75rem;letter-spacing:4px;cursor:pointer;font-weight:600;';

    shareBtn.textContent = 'SAVE & SHARE';
    shareBtn.onclick = async () => {
        await _saveCertificate();
        // Track download (but never block re-downloads)
        const { memberId, id } = getState();
        const userId = memberId || id;
        if (userId) {
            fetch('/api/cert-proof', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'download', memberId: userId, rank }),
            }).catch(() => {});
        }
    };

    const uploadBtn = document.createElement('button');
    uploadBtn.id = 'certUploadBtn';
    uploadBtn.style.cssText = 'width:100%;padding:15px;border-radius:4px;border:1px solid rgba(197,160,89,0.2);background:rgba(197,160,89,0.03);color:rgba(197,160,89,0.6);font-family:Cinzel,serif;font-size:0.7rem;letter-spacing:3px;cursor:pointer;font-weight:400;';

    // Lock proof upload until user reaches a new rank
    const params = (raw?.parameters || {});
    const lastProofRank = params.last_cert_proof_rank || '';
    const proofLocked = lastProofRank.toLowerCase() === rank.toLowerCase();

    if (proofLocked) {
        uploadBtn.textContent = 'PROOF SUBMITTED — UNLOCK AT NEXT RANK';
        uploadBtn.disabled = true;
        uploadBtn.style.opacity = '0.5';
        uploadBtn.style.cursor = 'not-allowed';
        uploadBtn.style.color = 'rgba(255,255,255,0.3)';
        uploadBtn.style.borderColor = 'rgba(255,255,255,0.08)';
    } else {
        uploadBtn.textContent = 'UPLOAD PROOF \u2014 EARN 300 C';
        uploadBtn.onclick = () => _uploadCertProof();
    }

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'width:100%;padding:12px;border-radius:4px;border:none;background:transparent;color:rgba(255,255,255,0.25);font-family:Cinzel,serif;font-size:0.65rem;letter-spacing:4px;cursor:pointer;';
    closeBtn.textContent = 'CLOSE';
    closeBtn.onclick = () => overlay.remove();

    const instructions = document.createElement('div');
    instructions.style.cssText = 'text-align:center;padding:8px 12px;';
    instructions.innerHTML = `
        <div style="font-family:Orbitron,sans-serif;font-size:0.45rem;color:rgba(197,160,89,0.5);letter-spacing:3px;margin-bottom:6px;">HOW TO EARN 300 COINS</div>
        <div style="font-family:Rajdhani,sans-serif;font-size:0.85rem;color:rgba(255,255,255,0.4);line-height:1.5;">
            1. Save your certificate above<br>
            2. Share it on <span style="color:rgba(197,160,89,0.7);">X</span> or <span style="color:rgba(197,160,89,0.7);">FetLife</span> and tag <span style="color:rgba(197,160,89,0.7);">@qkarin_com</span><br>
            3. Upload a screenshot as proof below
        </div>
    `;

    btnWrap.appendChild(shareBtn);
    btnWrap.appendChild(instructions);
    btnWrap.appendChild(uploadBtn);
    btnWrap.appendChild(closeBtn);
    overlay.appendChild(card);
    overlay.appendChild(btnWrap);
    document.body.appendChild(overlay);
    closeLobby();
}

async function _saveCertificate() {
    const btn = document.getElementById('certShareBtn') as HTMLButtonElement | null;
    if (btn) { btn.textContent = 'GENERATING...'; btn.disabled = true; btn.style.opacity = '0.5'; btn.style.cursor = 'not-allowed'; }

    const state = getState();
    const raw = (window as any).__currentProfileRaw || state.raw || state;
    const name = (raw?.name || 'LOYAL SUBJECT').toUpperCase();
    let rank = ((state as any).rank || raw?.hierarchy || 'Hall Boy').toUpperCase();

    const kneels = Number(raw?.kneelCount || 0);
    const tasks = Number(raw?.Taskdom_CompletedTasks || raw?.taskdom_completed_tasks || 0);
    const sacrifice = Number(raw?.total_coins_spent || 0);
    const score = Number(raw?.score || state.score || 0);
    const sinceRaw = raw?.joined_date || raw?.created_at || '';
    const since = sinceRaw ? new Date(sinceRaw).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
    const streak = Number(raw?.bestRoutinestreak || raw?.routinestreak || 0);

    const W = 1200;
    const H = 630;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    const avatarUrl = raw?.avatar_url || raw?.profile_picture_url || '';

    // Preload images, then draw
    const images: Record<string, HTMLImageElement> = {};
    const theme = getCertTheme(rank);
    const hasAvatar = avatarUrl && avatarUrl !== '/collar-placeholder.png';
    const hasBg = !!theme.bgImage;
    let pending = (hasAvatar ? 1 : 0) + (hasBg ? 1 : 0);

    function draw() {
        _drawCertificate(ctx, canvas, W, H, { name, rank, since, kneels, tasks, score, sacrifice, streak, images, theme });
    }

    if (pending === 0) {
        draw();
        return;
    }

    function onLoaded() {
        pending--;
        if (pending <= 0) draw();
    }

    // Background image (rank-specific)
    if (hasBg) {
        const bgImg = new Image();
        bgImg.crossOrigin = 'anonymous';
        bgImg.onload = () => { images.bg = bgImg; onLoaded(); };
        bgImg.onerror = () => onLoaded();
        bgImg.src = theme.bgImage!;
    }

    // Avatar
    if (hasAvatar) {
        const loadAvatarBlob = (url: string) => fetch(url)
            .then(r => { if (!r.ok) throw new Error('fetch failed'); return r.blob(); })
            .then(blob => {
                const blobUrl = URL.createObjectURL(blob);
                const avImg = new Image();
                avImg.onload = () => { images.avatar = avImg; URL.revokeObjectURL(blobUrl); onLoaded(); };
                avImg.onerror = () => { URL.revokeObjectURL(blobUrl); onLoaded(); };
                avImg.src = blobUrl;
            });

        loadAvatarBlob(avatarUrl)
            .catch(() => loadAvatarBlob(`/api/media?url=${encodeURIComponent(avatarUrl)}`))
            .catch(() => onLoaded());
    }
}

function _drawCertificate(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    W: number, H: number,
    d: { name: string; rank: string; since: string; kneels: number; tasks: number; score: number; sacrifice: number; streak: number; images: Record<string, HTMLImageElement>; theme: CertTheme }
) {
    const t = d.theme;
    const aR = t.ar, aG = t.ag, aB = t.ab;
    const white = 'rgba(255,255,255,0.9)';
    const cx = W / 2;

    // Background
    ctx.fillStyle = t.tier <= 1 ? '#0a0a0a' : '#0a0806';
    ctx.fillRect(0, 0, W, H);

    // Background image (rank-specific) — drawn as-is, no darkening
    if (d.images.bg) {
        ctx.drawImage(d.images.bg, 0, 0, W, H);
    }

    // Radial glow (scales with tier)
    if (t.glow > 0) {
        const grad = ctx.createRadialGradient(cx, 0, 0, cx, 0, W * 0.6);
        grad.addColorStop(0, `rgba(${aR},${aG},${aB},${t.glow})`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
    }

    // Outer border
    const borderAlpha = [0.15, 0.2, 0.25, 0.35, 0.4, 0.5, 0.55][t.tier];
    ctx.strokeStyle = `rgba(${aR},${aG},${aB},${borderAlpha})`;
    ctx.lineWidth = t.tier >= 5 ? 3 : t.tier >= 3 ? 2 : 1;
    ctx.strokeRect(16, 16, W - 32, H - 32);

    // Inner border for Chamberlain+ (tier >= 4)
    if (t.tier >= 4) {
        ctx.strokeStyle = `rgba(${aR},${aG},${aB},${t.tier >= 5 ? 0.15 : 0.08})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(24, 24, W - 48, H - 48);
    }

    // ── HEADER ──
    ctx.textAlign = 'center';
    ctx.font = '700 34px Cinzel, serif';
    ctx.fillStyle = `rgba(${aR},${aG},${aB},0.8)`;
    ctx.letterSpacing = '18px';
    ctx.fillText('CERTIFICATE OF SERVICE', cx, 62);
    ctx.letterSpacing = '0px';

    ctx.font = '400 16px Cinzel, serif';
    ctx.fillStyle = `rgba(${aR},${aG},${aB},0.45)`;
    ctx.letterSpacing = '5px';
    ctx.fillText('to Queen Karin', cx, 90);
    ctx.letterSpacing = '0px';

    // Top dividers
    const topDivL = ctx.createLinearGradient(60, 0, cx - 180, 0);
    topDivL.addColorStop(0, 'transparent');
    topDivL.addColorStop(1, `rgba(${aR},${aG},${aB},0.2)`);
    ctx.fillStyle = topDivL;
    ctx.fillRect(60, 108, cx - 240, 1);
    const topDivR = ctx.createLinearGradient(cx + 180, 0, W - 60, 0);
    topDivR.addColorStop(0, `rgba(${aR},${aG},${aB},0.2)`);
    topDivR.addColorStop(1, 'transparent');
    ctx.fillStyle = topDivR;
    ctx.fillRect(cx + 180, 108, W - 240 - cx, 1);

    if (t.stats.length === 0) {
        // ── HALL BOY: Centered symmetric layout — no stats ──
        const hasAvatar = !!d.images.avatar;
        const avSize = 120;
        const blockH = 42 + 42 + 20 + (hasAvatar ? avSize + 24 : 0) + 35;
        const startY = 120 + ((H - 140) - blockH) * 0.3;

        ctx.textAlign = 'center';
        ctx.font = '700 44px Cinzel, serif';
        ctx.fillStyle = white;
        ctx.fillText(d.name, cx, startY);

        ctx.font = '400 24px Cinzel, serif';
        ctx.fillStyle = `rgba(${aR},${aG},${aB},0.5)`;
        ctx.letterSpacing = '6px';
        ctx.fillText(d.rank, cx, startY + 42);
        ctx.letterSpacing = '0px';

        const divG = ctx.createLinearGradient(cx - 120, 0, cx + 120, 0);
        divG.addColorStop(0, 'transparent');
        divG.addColorStop(0.5, `rgba(${aR},${aG},${aB},0.2)`);
        divG.addColorStop(1, 'transparent');
        ctx.fillStyle = divG;
        ctx.fillRect(cx - 120, startY + 62, 240, 1);

        let curY = startY + 82;

        // Avatar (centered)
        if (hasAvatar) {
            const avX = cx - avSize / 2;
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, curY + avSize / 2, avSize / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(d.images.avatar, avX, curY, avSize, avSize);
            ctx.restore();
            ctx.beginPath();
            ctx.arc(cx, curY + avSize / 2, avSize / 2 + 2, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${aR},${aG},${aB},0.2)`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            curY += avSize + 24;
        }

        // Tagline only — no date for Hall Boy
        ctx.font = 'italic 20px Cinzel, serif';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillText(t.tagline, cx, curY);

    } else {
        // ── RANKED: Left-right layout with stats ──
        const vx = 520;
        const leftCx = vx / 2;

        ctx.textAlign = 'center';
        ctx.font = '700 36px Cinzel, serif';
        ctx.fillStyle = white;
        ctx.fillText(d.name, leftCx, 150);

        ctx.font = '400 22px Cinzel, serif';
        ctx.fillStyle = `rgba(${aR},${aG},${aB},0.6)`;
        ctx.letterSpacing = '4px';
        ctx.fillText(d.rank, leftCx, 185);
        ctx.letterSpacing = '0px';

        const divGrad1 = ctx.createLinearGradient(leftCx - 150, 0, leftCx + 150, 0);
        divGrad1.addColorStop(0, 'transparent');
        divGrad1.addColorStop(0.5, `rgba(${aR},${aG},${aB},0.3)`);
        divGrad1.addColorStop(1, 'transparent');
        ctx.fillStyle = divGrad1;
        ctx.fillRect(leftCx - 150, 205, 300, 1);

        // Avatar
        let avatarBottom = 220;
        if (d.images.avatar) {
            const avSize = 140;
            const avX = leftCx - avSize / 2;
            const avY = 220;
            avatarBottom = avY + avSize + 18;
            ctx.save();
            ctx.beginPath();
            ctx.arc(leftCx, avY + avSize / 2, avSize / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(d.images.avatar, avX, avY, avSize, avSize);
            ctx.restore();
            ctx.beginPath();
            ctx.arc(leftCx, avY + avSize / 2, avSize / 2 + 2, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${aR},${aG},${aB},0.35)`;
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Serving Since
        if (d.since) {
            const sinceY = avatarBottom + 18;
            ctx.textAlign = 'center';
            ctx.font = '400 14px Cinzel, serif';
            ctx.fillStyle = `rgba(${aR},${aG},${aB},0.4)`;
            ctx.letterSpacing = '3px';
            ctx.fillText('Serving Since', leftCx, sinceY);
            ctx.letterSpacing = '0px';
            ctx.font = '600 18px Cinzel, serif';
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.fillText(d.since, leftCx, sinceY + 28);
        }

        // ── VERTICAL DIVIDER ──
        const vGrad = ctx.createLinearGradient(0, 85, 0, H - 50);
        vGrad.addColorStop(0, 'transparent');
        vGrad.addColorStop(0.15, `rgba(${aR},${aG},${aB},0.2)`);
        vGrad.addColorStop(0.85, `rgba(${aR},${aG},${aB},0.2)`);
        vGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = vGrad;
        ctx.fillRect(vx, 85, 1, H - 135);

        // ── RIGHT SIDE: Stats ──
        const rightStart = vx + 50;
        const rightEnd = W - 55;
        const statMap: Record<string, [string, string]> = {
            kneels: ['Kneeling Hours', d.kneels.toLocaleString()],
            tasks: ['Tasks Completed', d.tasks.toLocaleString()],
            score: ['Points Earned', d.score.toLocaleString()],
            sacrifice: ['Sacrifice', d.sacrifice.toLocaleString()],
            streak: ['Best Streak', d.streak.toString()],
        };

        const stats = t.stats.map(k => statMap[k]).filter(Boolean);
        const topEdge = 110;
        const bottomEdge = H - 30;
        const availH = bottomEdge - topEdge;
        const statGap = 80;
        const blockH = (stats.length - 1) * statGap;
        const statStartY = topEdge + (availH - blockH) / 2;

        stats.forEach(([label, value], i) => {
            const y = statStartY + i * statGap;
            ctx.textAlign = 'left';
            ctx.font = '500 28px Cinzel, serif';
            ctx.fillStyle = `rgba(${aR},${aG},${aB},0.75)`;
            ctx.fillText(label, rightStart, y);
            ctx.textAlign = 'right';
            ctx.font = '600 26px Cinzel, serif';
            ctx.fillStyle = white;
            ctx.fillText(value, rightEnd, y);
            ctx.fillStyle = `rgba(${aR},${aG},${aB},0.06)`;
            ctx.fillRect(rightStart, y + 14, rightEnd - rightStart, 1);
        });
    }

    _exportCanvas(canvas);
}

function _exportCanvas(canvas: HTMLCanvasElement) {
    canvas.toBlob(async (blob) => {
        const btn = document.getElementById('certShareBtn') as HTMLButtonElement | null;
        if (!blob) {
            if (btn) { btn.textContent = 'SAVE & SHARE'; btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer'; }
            return;
        }
        const file = new File([blob], 'qkarin-certificate.png', { type: 'image/png' });

        const state = getState();
        const raw = (window as any).__currentProfileRaw || state.raw || state;
        const rank = (state as any).rank || raw?.hierarchy || 'servant';
        const name = (raw?.name || 'LOYAL SUBJECT').toUpperCase();

        // Mobile: use Share API to get "Save Image" option
        if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
            try {
                await navigator.share({ files: [file], title: 'My Service Certificate', text: `I proudly serve as ${rank} at the court of @qkarin_com 👑 #QKarin #ServingTheQueen` });
            } catch (e) {
                // User cancelled or share failed — fall through to download
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'qkarin-certificate.png';
                a.click();
                URL.revokeObjectURL(url);
            }
        } else {
            // Desktop / fallback: download
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'qkarin-certificate.png';
            a.click();
            URL.revokeObjectURL(url);
        }

        // Restore button
        if (btn) { btn.textContent = 'SAVED ✓'; btn.style.opacity = '0.6'; }
        setTimeout(() => { if (btn) { btn.textContent = 'SAVE & SHARE'; btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer'; } }, 3000);

        // Upload cert to Supabase storage and send to Discord (once per 30s)
        if (!(window as any).__certDiscordSent) {
            (window as any).__certDiscordSent = true;
            setTimeout(() => { (window as any).__certDiscordSent = false; }, 30000);
            try {
                const certUrl = await uploadToSupabase('media', 'certificates', file);
                if (certUrl && !certUrl.startsWith('failed')) {
                    fetch('/api/discord/cert', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, rank: rank.toUpperCase(), imageUrl: certUrl }),
                    }).catch(() => {});
                }
            } catch (_) {}
        }
    }, 'image/png');
}

function _uploadCertProof() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = async () => {
        const file = inp.files?.[0];
        if (!file) return;
        const { memberId, id } = getState();
        const userId = memberId || id;
        if (!userId) return;

        const btn = document.getElementById('certUploadBtn') as HTMLButtonElement;
        try {
            if (btn) { btn.textContent = 'UPLOADING...'; btn.disabled = true; btn.style.opacity = '0.5'; }

            // Step 1: Upload image via signed URL (bypasses Vercel body limit)
            const mediaUrl = await uploadToSupabase('media', 'cert-proofs', file);
            console.log('[CERT] Upload result:', mediaUrl);
            if (!mediaUrl || mediaUrl.startsWith('failed')) {
                if (btn) { btn.textContent = 'UPLOAD PROOF \u2014 EARN 300 C'; btn.disabled = false; btn.style.opacity = '1'; }
                alert('Upload failed. Please try again.');
                return;
            }

            // Step 2: Submit proof via API (cooldown check + chat message)
            const res = await fetch('/api/cert-proof', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'submit', memberId: userId, mediaUrl }),
            });
            const data = await res.json();
            if (!res.ok) {
                if (btn) { btn.textContent = 'UPLOAD PROOF \u2014 EARN 300 C'; btn.disabled = false; btn.style.opacity = '1'; }
                alert(data.error || 'Submission failed.');
                return;
            }

            // Lock the button until next rank
            if (btn) {
                btn.textContent = 'PROOF SUBMITTED — UNLOCK AT NEXT RANK';
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
                btn.style.color = 'rgba(255,255,255,0.3)';
                btn.style.borderColor = 'rgba(255,255,255,0.08)';
                btn.onclick = null;
            }

            // Update local state so reopening certificate keeps button locked
            const state0 = getState();
            const currentRank = (state0 as any).rank || (window as any).__currentProfileRaw?.hierarchy || 'Hall Boy';
            const currentRaw = (window as any).__currentProfileRaw || state0.raw || {};
            const updatedParams = { ...(currentRaw.parameters || {}), last_cert_proof_rank: currentRank };
            const updatedRaw = { ...currentRaw, parameters: updatedParams };
            setState({ raw: updatedRaw });
            (window as any).__currentProfileRaw = updatedRaw;
        } catch (e: any) {
            console.error('[CERT] Upload failed:', e);
            if (btn) { btn.textContent = 'UPLOAD PROOF \u2014 EARN 300 C'; btn.disabled = false; btn.style.opacity = '1'; }
            alert('Upload failed. Please try again.');
        }
    };
    inp.click();
}

let taskInterval: any = null;

export function startTaskTimer(ms: number) {
    if (taskInterval) clearInterval(taskInterval);

    // Task already expired — skip negative display, go straight to expiration
    if (ms <= 0) {
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

        import('@/actions/velo-actions').then(m => m.checkExpiredTasks()).catch(() => {});
        return;
    }

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

            // Trigger server-side expiration penalty
            import('@/actions/velo-actions').then(m => m.checkExpiredTasks()).catch(() => {});
        }
        updateUI(remaining);
    }, 1000);
}

export function resetTaskUI() {
    if (taskInterval) clearInterval(taskInterval);
    taskInterval = null;
    hideDailyCode();

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
        showDailyCode();

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

    // Show skip pass option if they have any
    const raw = getState().raw || {};
    const skipCount = Number(raw.skippass || 0);
    const skipOpt = document.getElementById('mobSkipPassOption');
    const skipCountEl = document.getElementById('mobSkipPassCount');
    if (skipOpt) skipOpt.style.display = skipCount > 0 ? 'block' : 'none';
    if (skipCountEl) skipCountEl.textContent = String(skipCount);

    if (readyText) {
        readyText.style.opacity = '0.3';
    }
    if (mobTaskText) {
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
    document.body.style.overflow = 'hidden';
    _updateInstallRow();
}

export function closeQueenMenu() {
    const el = document.getElementById('queenOverlay');
    if (!el) return;
    el.classList.add('hidden');
    el.style.display = 'none';
    if (!_anyHubOpen()) document.body.style.overflow = '';
}

export function closeEarnCoinsModal() {
    const modal = document.getElementById('earnCoinsModal');
    if (!modal) return;
    modal.style.opacity = '0';
    setTimeout(() => modal.remove(), 300);
}

export function toggleEarnCoins() {
    // If already open, close it
    if (document.getElementById('earnCoinsModal')) {
        closeEarnCoinsModal();
        return;
    }

    // Check install app visibility
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    const state = getState();
    const raw = (window as any).__currentProfileRaw || state.raw || state;
    const alreadyClaimed = raw?.parameters?.appInstallClaimed === true;
    const showInstall = !isStandalone && !alreadyClaimed;
    const reviewSubmitted = raw?.parameters?.reviewSubmitted === true;

    const modal = document.createElement('div');
    modal.id = 'earnCoinsModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10000001;background:#020512;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;opacity:0;transition:opacity 0.3s ease;';

    modal.innerHTML = `
        <div style="width:100%;max-width:400px;display:flex;flex-direction:column;align-items:center;gap:20px;">
            <div style="font-family:Orbitron,sans-serif;font-size:0.55rem;color:rgba(197,160,89,0.5);letter-spacing:6px;margin-bottom:4px;">EARN EXTRA COINS</div>
            <div style="width:60px;height:1px;background:linear-gradient(90deg,transparent,rgba(197,160,89,0.4),transparent);margin-bottom:8px;"></div>

            ${showInstall ? `
            <button id="earnCoinsInstallBtn" style="width:100%;padding:22px 20px;background:rgba(197,160,89,0.04);border:1px solid rgba(197,160,89,0.18);border-radius:12px;cursor:pointer;text-align:left;transition:border-color 0.2s;">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
                    <span style="font-family:Cinzel,serif;font-size:1.1rem;color:rgba(197,160,89,0.7);">+</span>
                    <div style="font-family:Orbitron,sans-serif;font-size:0.75rem;color:#fff;letter-spacing:2px;font-weight:700;">INSTALL APP</div>
                </div>
                <div style="font-family:Rajdhani,sans-serif;font-size:0.9rem;color:rgba(255,255,255,0.4);margin-bottom:8px;">Add to home screen</div>
                <div style="font-family:Orbitron,sans-serif;font-size:0.55rem;color:#4ade80;letter-spacing:2px;">+1,000 COINS</div>
            </button>` : `
            <div style="width:100%;padding:22px 20px;background:rgba(197,160,89,0.04);border:1px solid rgba(197,160,89,0.1);border-radius:12px;opacity:0.5;">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
                    <span style="font-family:Cinzel,serif;font-size:1.1rem;color:rgba(197,160,89,0.4);">+</span>
                    <div style="font-family:Orbitron,sans-serif;font-size:0.75rem;color:rgba(255,255,255,0.5);letter-spacing:2px;font-weight:700;">INSTALL APP</div>
                </div>
                <div style="font-family:Orbitron,sans-serif;font-size:0.55rem;color:rgba(74,222,128,0.5);letter-spacing:2px;">+1,000 COINS EARNED</div>
            </div>`}

            <button id="earnCoinsCertBtn" style="width:100%;padding:22px 20px;background:rgba(197,160,89,0.04);border:1px solid rgba(197,160,89,0.18);border-radius:12px;cursor:pointer;text-align:left;transition:border-color 0.2s;">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
                    <span style="font-family:Cinzel,serif;font-size:1.1rem;color:rgba(197,160,89,0.7);">C</span>
                    <div style="font-family:Orbitron,sans-serif;font-size:0.75rem;color:#fff;letter-spacing:2px;font-weight:700;">SERVICE CERTIFICATE</div>
                </div>
                <div style="font-family:Rajdhani,sans-serif;font-size:0.9rem;color:rgba(255,255,255,0.4);margin-bottom:8px;">Share on socials — upload proof</div>
                <div style="font-family:Orbitron,sans-serif;font-size:0.55rem;color:#4ade80;letter-spacing:2px;">+300 COINS</div>
            </button>

            ${reviewSubmitted ? `
            <div style="width:100%;padding:22px 20px;background:rgba(197,160,89,0.04);border:1px solid rgba(197,160,89,0.1);border-radius:12px;opacity:0.5;">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
                    <span style="font-family:Cinzel,serif;font-size:1.1rem;color:rgba(197,160,89,0.4);">R</span>
                    <div style="font-family:Orbitron,sans-serif;font-size:0.75rem;color:rgba(255,255,255,0.5);letter-spacing:2px;font-weight:700;">WRITE A REVIEW</div>
                </div>
                <div style="font-family:Orbitron,sans-serif;font-size:0.55rem;color:rgba(74,222,128,0.5);letter-spacing:2px;">FEEDBACK SUBMITTED · +500 COINS EARNED</div>
            </div>` : `
            <button id="earnCoinsReviewBtn" style="width:100%;padding:22px 20px;background:rgba(197,160,89,0.04);border:1px solid rgba(197,160,89,0.18);border-radius:12px;cursor:pointer;text-align:left;transition:border-color 0.2s;">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
                    <span style="font-family:Cinzel,serif;font-size:1.1rem;color:rgba(197,160,89,0.7);">R</span>
                    <div style="font-family:Orbitron,sans-serif;font-size:0.75rem;color:#fff;letter-spacing:2px;font-weight:700;">WRITE A REVIEW</div>
                </div>
                <div style="font-family:Rajdhani,sans-serif;font-size:0.9rem;color:rgba(255,255,255,0.4);margin-bottom:8px;">Share your experience serving the Queen</div>
                <div style="font-family:Orbitron,sans-serif;font-size:0.55rem;color:#4ade80;letter-spacing:2px;">+500 COINS</div>
            </button>`}

            <button id="earnCoinsCloseBtn" style="margin-top:16px;padding:12px 40px;background:none;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:rgba(255,255,255,0.25);font-family:Cinzel,serif;font-size:0.6rem;letter-spacing:4px;cursor:pointer;">CLOSE</button>
        </div>
    `;

    document.body.appendChild(modal);
    requestAnimationFrame(() => { modal.style.opacity = '1'; });

    // Wire up buttons
    modal.querySelector('#earnCoinsCloseBtn')?.addEventListener('click', closeEarnCoinsModal);
    modal.querySelector('#earnCoinsInstallBtn')?.addEventListener('click', () => {
        closeEarnCoinsModal();
        (window as any).handleInstallApp?.();
    });
    modal.querySelector('#earnCoinsCertBtn')?.addEventListener('click', () => {
        closeEarnCoinsModal();
        (window as any).showCertificate?.();
    });
    modal.querySelector('#earnCoinsReviewBtn')?.addEventListener('click', () => {
        closeEarnCoinsModal();
        _openReviewForm();
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeEarnCoinsModal();
    });
}

function _openReviewForm() {
    if (document.getElementById('reviewFormModal')) return;

    const modal = document.createElement('div');
    modal.id = 'reviewFormModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10000002;background:#020512;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;opacity:0;transition:opacity 0.3s ease;overflow-x:hidden;overflow-y:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;';

    modal.innerHTML = `
        <div style="width:100%;max-width:400px;display:flex;flex-direction:column;align-items:center;gap:16px;">
            <div style="font-family:Orbitron,sans-serif;font-size:0.55rem;color:rgba(197,160,89,0.5);letter-spacing:6px;">WRITE A REVIEW</div>
            <div style="width:60px;height:1px;background:linear-gradient(90deg,transparent,rgba(197,160,89,0.4),transparent);"></div>

            <div style="font-family:Rajdhani,sans-serif;font-size:0.85rem;color:rgba(255,255,255,0.4);text-align:center;">Share your experience. Your name and stats will be shown publicly, but your identity stays private.</div>

            <div id="reviewStars" style="display:flex;gap:8px;margin:4px 0;">
                ${[1,2,3,4,5].map(i => `<span data-star="${i}" style="font-size:1.8rem;cursor:pointer;color:rgba(255,255,255,0.15);transition:color 0.2s;">&#9733;</span>`).join('')}
            </div>
            <div id="reviewRatingLabel" style="font-family:Orbitron,sans-serif;font-size:0.45rem;color:rgba(197,160,89,0.4);letter-spacing:2px;height:14px;"></div>

            <textarea id="reviewTextInput" maxlength="500" rows="5" placeholder="Write at least 100 characters about your experience..."
                style="width:100%;background:rgba(255,255,255,0.03);border:1px solid rgba(197,160,89,0.18);border-radius:10px;padding:14px;color:#fff;font-family:Rajdhani,sans-serif;font-size:0.95rem;resize:none;outline:none;"></textarea>
            <div style="align-self:flex-end;font-family:Orbitron,sans-serif;font-size:0.4rem;color:rgba(255,255,255,0.2);"><span id="reviewCharCount">0</span>/500</div>

            <button id="reviewSubmitBtn" style="width:100%;padding:14px 0;background:linear-gradient(135deg,#c5a059,#8b6914);color:#000;border:none;border-radius:8px;font-family:Orbitron,sans-serif;font-size:0.6rem;font-weight:700;letter-spacing:3px;cursor:pointer;opacity:0.4;pointer-events:none;">SUBMIT REVIEW</button>

            <button id="reviewCloseBtn" style="padding:12px 40px;background:none;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:rgba(255,255,255,0.25);font-family:Cinzel,serif;font-size:0.6rem;letter-spacing:4px;cursor:pointer;">CLOSE</button>
        </div>
    `;

    document.body.appendChild(modal);
    requestAnimationFrame(() => { modal.style.opacity = '1'; });

    let selectedRating = 0;
    const ratingLabels = ['', 'POOR', 'OKAY', 'GOOD', 'GREAT', 'EXCEPTIONAL'];
    const stars = modal.querySelectorAll('#reviewStars span');
    const ratingLabel = modal.querySelector('#reviewRatingLabel') as HTMLElement;
    const textarea = modal.querySelector('#reviewTextInput') as HTMLTextAreaElement;
    const charCount = modal.querySelector('#reviewCharCount') as HTMLElement;
    const submitBtn = modal.querySelector('#reviewSubmitBtn') as HTMLButtonElement;

    function updateStars(rating: number) {
        stars.forEach((s, i) => {
            (s as HTMLElement).style.color = i < rating ? '#c5a059' : 'rgba(255,255,255,0.15)';
        });
        if (ratingLabel) ratingLabel.textContent = ratingLabels[rating] || '';
    }

    function checkReady() {
        const ready = selectedRating > 0 && textarea.value.trim().length >= 100;
        submitBtn.style.opacity = ready ? '1' : '0.4';
        submitBtn.style.pointerEvents = ready ? 'auto' : 'none';
    }

    stars.forEach(s => {
        s.addEventListener('click', () => {
            selectedRating = parseInt((s as HTMLElement).dataset.star || '0');
            updateStars(selectedRating);
            checkReady();
        });
    });

    textarea.addEventListener('input', () => {
        charCount.textContent = String(textarea.value.length);
        checkReady();
    });

    const closeReview = () => {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 300);
    };

    modal.querySelector('#reviewCloseBtn')?.addEventListener('click', closeReview);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeReview(); });

    submitBtn.addEventListener('click', async () => {
        if (submitBtn.style.pointerEvents === 'none') return;
        submitBtn.textContent = 'SUBMITTING...';
        submitBtn.style.pointerEvents = 'none';

        const { memberId, id } = getState();
        try {
            const res = await fetch('/api/reviews/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memberId: memberId || id, text: textarea.value.trim(), rating: selectedRating }),
            });
            const data = await res.json();

            if (data.success) {
                setState({ wallet: data.newWallet });
                const s = getState(); if (s?.raw) {
                    s.raw.wallet = data.newWallet;
                    if (!s.raw.parameters) s.raw.parameters = {};
                    s.raw.parameters.reviewSubmitted = true;
                }
                if ((window as any).__currentProfileRaw) {
                    if (!(window as any).__currentProfileRaw.parameters) (window as any).__currentProfileRaw.parameters = {};
                    (window as any).__currentProfileRaw.parameters.reviewSubmitted = true;
                }
                ['coins', 'mobCoins', 'walletDisplay', 'mob_walletVal'].forEach(elId => {
                    const el = document.getElementById(elId);
                    if (el) el.textContent = data.newWallet.toLocaleString();
                });

                modal.querySelector('div')!.innerHTML = `
                    <div style="display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center;">
                        <div style="font-size:2.5rem;">&#10003;</div>
                        <div style="font-family:Cinzel,serif;font-size:1.1rem;color:#c5a059;letter-spacing:4px;">THANK YOU</div>
                        <div style="font-family:Rajdhani,sans-serif;font-size:0.9rem;color:rgba(255,255,255,0.4);">Your review is now live.</div>
                        <div style="font-family:Orbitron,sans-serif;font-size:0.7rem;color:#4ade80;letter-spacing:2px;">+500 COINS EARNED</div>
                        <button onclick="this.closest('#reviewFormModal').style.opacity='0';setTimeout(()=>document.getElementById('reviewFormModal')?.remove(),300);"
                            style="margin-top:12px;padding:12px 40px;background:none;border:1px solid rgba(197,160,89,0.3);border-radius:8px;color:rgba(197,160,89,0.6);font-family:Cinzel,serif;font-size:0.6rem;letter-spacing:4px;cursor:pointer;">CLOSE</button>
                    </div>
                `;
            } else {
                submitBtn.textContent = data.error || 'FAILED';
                submitBtn.style.color = '#e03050';
                submitBtn.style.background = 'none';
                submitBtn.style.border = '1px solid rgba(220,50,80,0.3)';
                setTimeout(() => {
                    submitBtn.textContent = 'SUBMIT REVIEW';
                    submitBtn.style.color = '#000';
                    submitBtn.style.background = 'linear-gradient(135deg,#c5a059,#8b6914)';
                    submitBtn.style.border = 'none';
                    submitBtn.style.pointerEvents = 'auto';
                }, 3000);
            }
        } catch {
            submitBtn.textContent = 'ERROR';
            setTimeout(() => { submitBtn.textContent = 'SUBMIT REVIEW'; submitBtn.style.pointerEvents = 'auto'; }, 3000);
        }
    });
}

export function toggleMobileStats() {
    const content = document.getElementById('mobStatsContent');
    const arrow = document.getElementById('mobStatsArrow');
    if (content) {
        const isOpen = content.classList.toggle('open');
        if (arrow) arrow.innerText = isOpen ? '▲' : '▼';
    }
}

export function toggleNextRankBenefits() {
    const wrap = document.getElementById('drawer_NextBenefitsWrap');
    if (!wrap) return;
    if (wrap.style.maxHeight && wrap.style.maxHeight !== '0px') {
        wrap.style.maxHeight = '0';
    } else {
        wrap.style.maxHeight = wrap.scrollHeight + 'px';
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

        // Populate daily code in routine section
        const routineCodeEl = document.getElementById('deskRoutineCodeVal');
        if (routineCodeEl) routineCodeEl.textContent = getDailyCode();

        const display = document.getElementById('deskRoutineDisplay');
        const mobDisplay = document.getElementById('mobRoutineDisplay'); // mobile routine name display
        const btn = document.getElementById('deskRoutineActionBtn') as HTMLButtonElement | null;
        const timeMsg = document.getElementById('deskRoutineTimeMsg');

        // Mobile equivalents
        const mobBtn = document.getElementById('btnRoutineUpload') as HTMLButtonElement | null;
        const mobDone = document.getElementById('routineDoneMsg');
        const mobTime = document.getElementById('routineTimeMsg');

        // ── Rank gate: Hall Boy cannot use routine ──
        const _st = getState();
        const _raw = (window as any).__currentProfileRaw || _st.raw || _st;
        const rankForRoutine = ((_st as any).rank || _raw?.hierarchy || 'Hall Boy').toLowerCase().trim();

        // Video uploads: Butler and above only
        const VIDEO_RANKS = ['butler', 'chamberlain', 'secretary', "queen's champion"];
        const canUploadVideo = VIDEO_RANKS.includes(rankForRoutine);

        // iOS-safe routine upload: create input dynamically so .click() fires
        // synchronously within the user gesture (same fix as profile photo)
        const triggerRoutineFilePick = () => {
            if ((window as any).__routineSubmittedToday) return;
            const inp = document.createElement('input');
            inp.type = 'file';
            inp.accept = canUploadVideo ? 'image/*,video/*' : 'image/*';
            inp.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1;';
            document.body.appendChild(inp);
            inp.onchange = () => {
                document.body.removeChild(inp);
                const file = inp.files?.[0];
                if (!file) return;
                if (!canUploadVideo && file.type.startsWith('video/')) {
                    showUploadNotice('<div style="font-family:Cinzel,serif;font-size:0.7rem;color:rgba(197,160,89,0.7);letter-spacing:2px;padding:12px 16px;background:rgba(139,0,0,0.15);border:1px solid rgba(139,0,0,0.3);border-radius:8px;line-height:1.6;">Video uploads are reserved for <b>Butler</b> rank and above.<br><span style="font-size:0.6rem;color:rgba(255,255,255,0.3);letter-spacing:1px;">Prove your devotion first.</span></div>');
                    return;
                }
                handleRoutineUpload(inp);
            };
            inp.click();
        };
        if (rankForRoutine === 'hall boy') {
            if (display) display.textContent = 'Locked until Footman';
            if (mobDisplay) mobDisplay.textContent = 'Locked until Footman';
            if (btn) { btn.textContent = 'LOCKED'; btn.style.opacity = '0.35'; btn.style.cursor = 'not-allowed'; (window as any).__routineAction = () => {}; }
            if (mobBtn) { mobBtn.textContent = 'LOCKED'; mobBtn.style.opacity = '0.35'; mobBtn.style.cursor = 'not-allowed'; mobBtn.onclick = null; }
            if (timeMsg) timeMsg.classList.add('hidden');
            return;
        }

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
            (window as any).__routineSubmittedToday = true;
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
            (window as any).__routineSubmittedToday = true;
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
        } else if (data.windowOpen) {
            // ── State 2a: Routine set, window open (6-10 AM), can upload ──
            if (display) display.textContent = data.routine;
            if (mobDisplay) mobDisplay.textContent = data.routine;
            if (btn) {
                btn.textContent = 'UPLOAD ROUTINE';
                btn.style.background = 'linear-gradient(135deg, #c5a059 0%, #8b6914 100%)';
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
                (window as any).__routineAction = triggerRoutineFilePick;
            }
            if (mobBtn) { mobBtn.textContent = 'UPLOAD ROUTINE'; mobBtn.style.opacity = '1'; mobBtn.style.cursor = 'pointer'; mobBtn.onclick = triggerRoutineFilePick; }
            if (mobDone) mobDone.classList.add('hidden');
            if (timeMsg) {
                const minsLeft = (10 - (data.localHour || 6)) * 60 - (data.localMinute || 0);
                timeMsg.textContent = `WINDOW CLOSES IN ${minsLeft}MIN`;
                timeMsg.style.color = 'rgba(197,160,89,0.5)';
                timeMsg.classList.remove('hidden');
            }
        } else if (data.beforeWindow) {
            // ── State 2b: Before 6 AM — window not yet open ───────────────
            if (display) display.textContent = data.routine;
            if (mobDisplay) mobDisplay.textContent = data.routine;
            if (btn) {
                btn.textContent = 'OPENS AT 6:00 AM';
                btn.style.background = 'linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%)';
                btn.style.opacity = '0.5';
                btn.style.cursor = 'default';
                (window as any).__routineAction = () => {};
            }
            if (mobBtn) { mobBtn.textContent = 'OPENS AT 6:00 AM'; mobBtn.style.opacity = '0.5'; mobBtn.style.cursor = 'default'; mobBtn.onclick = null; }
            if (mobDone) mobDone.classList.add('hidden');
            if (timeMsg) timeMsg.classList.add('hidden');
        } else {
            // ── State 2c: After 10 AM, missed today ──────────────────────
            const cpRaw = (window as any).__currentProfileRaw || _st.raw || _st;
            const cpCount = Number(cpRaw?.checkpoint || 0);

            if (display) display.textContent = data.routine;
            if (mobDisplay) mobDisplay.textContent = data.routine;
            if (btn) {
                btn.textContent = cpCount > 0 ? 'USE CHECKPOINT' : 'MISSED - NEXT: 6:00 AM';
                btn.style.background = cpCount > 0 ? 'linear-gradient(135deg, #c5a059 0%, #8b6914 100%)' : 'linear-gradient(135deg, #2a1010 0%, #1a0808 100%)';
                btn.style.opacity = cpCount > 0 ? '1' : '0.6';
                btn.style.cursor = cpCount > 0 ? 'pointer' : 'default';
                (window as any).__routineAction = cpCount > 0 ? () => _showCheckpointWarning() : () => {};
            }
            if (mobBtn) {
                if (cpCount > 0) {
                    mobBtn.textContent = 'USE CHECKPOINT';
                    mobBtn.style.opacity = '1';
                    mobBtn.style.cursor = 'pointer';
                    mobBtn.onclick = () => _showCheckpointWarning();
                } else {
                    mobBtn.textContent = 'MISSED - NEXT: 6AM';
                    mobBtn.style.opacity = '0.5';
                    mobBtn.style.cursor = 'default';
                    mobBtn.onclick = null;
                }
            }
            if (mobDone) mobDone.classList.add('hidden');
            if (timeMsg) {
                if (cpCount > 0) {
                    timeMsg.innerHTML = `<span style="color:rgba(255,68,68,0.6);">STREAK AT RISK</span> &mdash; <span style="color:rgba(197,160,89,0.7);">${cpCount} CHECKPOINT${cpCount > 1 ? 'S' : ''} LEFT</span>`;
                } else {
                    timeMsg.textContent = 'ROUTINE WINDOW CLOSED';
                    timeMsg.style.color = 'rgba(255,68,68,0.5)';
                }
                timeMsg.classList.remove('hidden');
            }
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
            (window as any).__routineSubmittedToday = true;
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
        submitTaskEvidence(file, false);
    };
    inp.click();
}

async function submitTaskEvidence(file: File, isRoutine: boolean = false): Promise<boolean> {
    // Enforce rank-based video restrictions on ALL upload paths
    if (isVideo(file)) {
        const _raw = (window as any).__currentProfileRaw || getState().raw || getState();
        const _rank = ((getState() as any).rank || _raw?.hierarchy || 'Hall Boy').toLowerCase().trim();

        // Routine uploads: video only for Butler and above
        const videoRoutineRanks = ['butler', 'chamberlain', 'secretary', "queen's champion"];
        if (isRoutine && !videoRoutineRanks.includes(_rank)) {
            showUploadNotice('<div style="font-family:Cinzel,serif;font-size:0.7rem;color:rgba(197,160,89,0.7);letter-spacing:2px;padding:12px 16px;background:rgba(139,0,0,0.15);border:1px solid rgba(139,0,0,0.3);border-radius:8px;line-height:1.6;">Video uploads are reserved for <b>Butler</b> rank and above.<br><span style="font-size:0.6rem;color:rgba(255,255,255,0.3);letter-spacing:1px;">Prove your devotion first.</span></div>');
            return false;
        }

        let maxSecs = 120;
        if (_rank === 'hall boy') maxSecs = 30;
        else if (_rank === 'footman') maxSecs = 45;
        else if (_rank === 'silverman') maxSecs = 60;
        // Butler and above: 120s

        const duration = await getVideoDuration(file);
        if (duration > maxSecs) {
            const mins = Math.floor(duration / 60);
            const secs = Math.round(duration % 60);
            const limitStr = maxSecs >= 60 ? `${maxSecs / 60} minute${maxSecs > 60 ? 's' : ''}` : `${maxSecs} seconds`;
            showUploadNotice(`<div style="font-family:'Orbitron';font-size:0.7rem;color:var(--red);letter-spacing:2px;margin-bottom:6px;">VIDEO TOO LONG</div><div style="font-family:'Rajdhani';font-size:0.9rem;color:rgba(255,255,255,0.6);margin-bottom:12px;">Your video is ${mins}m ${secs}s — your rank allows ${limitStr}.<br>Please trim it and try again.</div><div style="display:flex;gap:10px;justify-content:center;"><button onclick="window._clearUploadNotice()" style="padding:8px 18px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.7);font-family:'Orbitron';font-size:0.45rem;cursor:pointer;border-radius:6px;letter-spacing:1px;">DISMISS</button></div>`);
            return false;
        }
    }

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
        } else {
            console.log("Generating image thumbnail...");
            thumbnailUrl = await generateImageThumbnail(file);
            console.log("Image thumbnail result:", thumbnailUrl);
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
                    isRoutine: isRoutine,
                    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
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

    // Enforce rank-based video duration limit on chat uploads
    if (isVid) {
        const { getVideoDuration } = await import('./mediaSupabase');
        const _raw = (window as any).__currentProfileRaw || getState().raw || getState();
        const _rank = ((getState() as any).rank || _raw?.hierarchy || 'Hall Boy').toLowerCase().trim();
        let maxSecs = 120;
        if (_rank === 'hall boy') maxSecs = 30;
        else if (_rank === 'footman') maxSecs = 45;
        else if (_rank === 'silverman') maxSecs = 60;
        const duration = await getVideoDuration(file);
        if (duration > maxSecs) {
            const mins = Math.floor(duration / 60);
            const secs = Math.round(duration % 60);
            const limitStr = maxSecs >= 60 ? `${maxSecs / 60} min` : `${maxSecs}s`;
            alert(`Video is ${mins}m ${secs}s — your rank allows max ${limitStr}. Trim it.`);
            return;
        }
    }

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

            // Render sent media immediately so it doesn't depend on realtime
            if (data.data) {
                const sentId = _msgId(data.data);
                if (sentId && !_renderedMsgIds.has(sentId)) {
                    _renderedMsgIds.add(sentId);
                    _lastChatMsgId = sentId;
                    if (data.data.created_at) _lastChatMsgTimestamp = data.data.created_at;
                    const html = renderChatMessage(data.data);
                    ['chatContent', 'mob_chatContent'].forEach(cid => {
                        const el = document.getElementById(cid);
                        if (el) el.insertAdjacentHTML('beforeend', html);
                    });
                    _scrollChatDelayed();
                }
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
function _msgId(m: any): string | null { const v = m?.id || m?.ID; return v ? String(v) : null; }
let _chatSafetyPollInterval: ReturnType<typeof setInterval> | null = null;
let _chatHealthInterval: ReturnType<typeof setInterval> | null = null;
let _lastRealtimeEvent = 0; // timestamp of last realtime event received
let _chatMemberId: string | null = null; // the memberId used for chat queries

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

    // Re-fetch routine status so UI updates from "SUBMITTED" to "DONE" / "REJECTED"
    updateRoutineWidget().catch(() => {});

    // Mark gallery as dirty so Record tab refreshes with the new routine entry
    _galleryDirty = true;
    flushGalleryIfDirty();
}

/** Tear down all intervals + realtime channels. Safe to call multiple times. */
export function cleanupChatSystem() {
    if (_chatPollInterval) { clearInterval(_chatPollInterval); _chatPollInterval = null; }
    if (_chatSafetyPollInterval) { clearInterval(_chatSafetyPollInterval); _chatSafetyPollInterval = null; }
    if (_chatHealthInterval) { clearInterval(_chatHealthInterval); _chatHealthInterval = null; }
    if (_silenceCheckInterval) { clearInterval(_silenceCheckInterval); _silenceCheckInterval = null; }
    if (_queenInterval) { clearInterval(_queenInterval); _queenInterval = null; }
    if (_queenReapplyInterval) { clearInterval(_queenReapplyInterval); _queenReapplyInterval = null; }
    if (_chatChannel) { getChatSupabase().removeChannel(_chatChannel); _chatChannel = null; }
    if (_tasksChannel) { getChatSupabase().removeChannel(_tasksChannel); _tasksChannel = null; }
    if (_statsChannel) { getChatSupabase().removeChannel(_statsChannel); _statsChannel = null; }
    if (_notifyChannel) { getChatSupabase().removeChannel(_notifyChannel); _notifyChannel = null; }
    if (_queenStatusChannel) { getChatSupabase().removeChannel(_queenStatusChannel); _queenStatusChannel = null; }
    if (_presenceCh) { _presenceCh.unsubscribe(); _presenceCh = null; }
    document.removeEventListener('visibilitychange', _onVisibilityChange);
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

/** Fired when tab visibility changes — recover chat on foreground */
function _onVisibilityChange() {
    if (document.visibilityState !== 'visible') return;
    // Tab/app just came back — poll immediately for missed messages
    _pollMissedMessages();
    // Also check if the realtime channel is dead
    if (_chatChannel) {
        const state = _chatChannel.state;
        if (state === 'errored' || state === 'closed') {
            _recoverChat();
        }
    }
}

/** Poll for missed messages since last known timestamp */
async function _pollMissedMessages() {
    if (!_chatMemberId || !_lastChatMsgTimestamp) return;
    try {
        const res = await fetch('/api/chat/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memberId: _chatMemberId, since: _lastChatMsgTimestamp }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.success) return;
        const newMsgs = (data.messages || []).filter((m: any) => {
            const id = _msgId(m);
            return !id || !_renderedMsgIds.has(id);
        });
        if (newMsgs.length === 0) return;
        const wasAtBottom = _isScrolledToBottom();
        newMsgs.forEach((m: any) => {
            const msgId = _msgId(m);
            if (msgId && _renderedMsgIds.has(msgId)) return;
            if (msgId) _renderedMsgIds.add(msgId);
            _lastChatMsgId = msgId;
            if (m.created_at) _lastChatMsgTimestamp = m.created_at;

            if (m.metadata?.isAI) return; // AI messages only in AI mode
            if ((m.content || '').startsWith('TOUR_REPORT::') || (m.content || '').startsWith('APP_INSTALL::') || (m.content || '').startsWith('VAULT_ATTENTION::')) return; // Queen-only
            if (isSystemMessage(m)) {
                updateSystemTicker(m);
                appendSystemLog(m);
                return;
            }
            const html = renderChatMessage(m);
            ['chatContent', 'mob_chatContent'].forEach(cid => {
                const el = document.getElementById(cid);
                if (el) el.insertAdjacentHTML('beforeend', html);
            });
        });
        _attachImgScrollHandlers();
        if (wasAtBottom) _scrollChatDelayed();
    } catch {}
}

/** Reconnect chat channel if it's dead, then poll for missed messages */
function _recoverChat() {
    if (!_chatChannel) return;
    const state = _chatChannel.state;
    if (state === 'errored' || state === 'closed') {
        // Channel is dead — full reconnect
        getChatSupabase().removeChannel(_chatChannel);
        _chatChannel = null;
        chatSubscribed = false;
        initChatSystem();
        return;
    }
    // Channel looks alive — just poll for anything we missed
    _pollMissedMessages();
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
        email = 'newuser@throne.test';
    }

    // For Twitter/Discord users without email, use member_id from profile state
    if (!email) {
        const stateEmail = getState().email || getState().raw?.member_id;
        if (stateEmail) email = stateEmail.toLowerCase();
    }

    console.log('[CHAT] initChatSystem starting');

    if (!email && !userId) {
        console.warn('[CHAT] initChatSystem: no email or userId from auth, skipping');
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
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    const isMobile = /iphone|ipad|ipod|android/i.test(navigator.userAgent);
    const platform = isStandalone ? 'app' : isMobile ? 'mobile' : 'desktop';
    _presenceCh.subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
            await _presenceCh.track({ id: presenceKey(email!), platform });
        }
    });

    // chats.member_id stores UUID — query by UUID, fallback to email
    _chatMemberId = userId || email!;
    await loadChatHistory(_chatMemberId);

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
            _lastRealtimeEvent = Date.now(); // track health
            const msg = payload.new;
            // chats.member_id stores UUID — compare against both UUID and email for backward compat
            const rowMemberId = (msg.member_id || '').toLowerCase();
            const matchesUser = rowMemberId === (userId || '').toLowerCase() || rowMemberId === email!.toLowerCase();
            if (!matchesUser) return;
            // Skip AI messages in regular chat — they only show in AI mode
            if (msg.metadata?.isAI) return;
            // Tour reports & app installs & vault attention are Queen-only — never show to the user
            if ((msg.content || '').startsWith('TOUR_REPORT::') || (msg.content || '').startsWith('APP_INSTALL::') || (msg.content || '').startsWith('VAULT_ATTENTION::')) return;
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
                    try {
                        if ('mediaSession' in navigator) { navigator.mediaSession.metadata = new MediaMetadata({ title: 'Good Boy Radio', artist: 'Live', album: '' }); }
                        const snd = new Audio('/audio/message.mp3'); snd.volume = 0.5; snd.play();
                    } catch (_) {}
                    // Show in-app message banner
                    const rawContent = typeof msg.content === 'string' ? msg.content : '';
                    const isGifMsg = msg.type === 'gif' || (rawContent === '[GIF]' && msg.metadata?.gifUrl);
                    const isUrlMsg = /^https?:\/\//i.test(rawContent) || /\.(gif|jpg|jpeg|png|webp|mp4|mov)(\?|$)/i.test(rawContent);
                    const gifSrc = isGifMsg ? (msg.metadata?.gifUrl || rawContent) : (isUrlMsg && /\.(gif)/i.test(rawContent) ? rawContent : null);
                    const imgSrc = !gifSrc && isUrlMsg && /\.(jpg|jpeg|png|webp)/i.test(rawContent) ? rawContent : null;
                    // Clean preview for card messages
                    let preview: string;
                    if (rawContent.startsWith('INVENTORY_CARD::')) {
                        try {
                            const cd = JSON.parse(rawContent.replace('INVENTORY_CARD::', ''));
                            const names: Record<string, string> = { skippass: 'Skip Pass', cumpass: 'Cum Pass', checkpoint: 'Checkpoint' };
                            preview = cd.source === 'gift' ? `You received a ${names[cd.item] || cd.item}` : `${names[cd.item] || cd.item} purchased`;
                        } catch { preview = 'Inventory updated'; }
                    } else if (rawContent.startsWith('VAULT_UNLOCK_CARD::')) {
                        preview = 'A new item was added to your Vault';
                    } else if (rawContent.startsWith('VAULT_LOCK_CARD::')) {
                        preview = 'Keyholder lock activated';
                    } else if (rawContent.startsWith('LOCK_EXTENDED_CARD::')) {
                        preview = 'Your lock has been extended';
                    } else if (rawContent.startsWith('LEADERBOARD_REWARD_CARD::')) {
                        preview = 'Leaderboard Reward';
                    } else if (rawContent.startsWith('CERT_APPROVED::')) {
                        preview = 'Certificate approved';
                    } else if (rawContent.startsWith('PROMOTION_CARD::') || rawContent.startsWith('WELCOME_CARD::') || rawContent.startsWith('TASK_REVIEW_CARD::') || rawContent.startsWith('ROUTINE_CHANGE::') || rawContent.startsWith('TASK_FEEDBACK::') || rawContent.startsWith('WISHLIST::')) {
                        preview = 'New message';
                    } else {
                        preview = (isGifMsg || isUrlMsg) ? 'New message' : rawContent.slice(0, 80) || 'New message';
                    }
                    showNewMessageBanner(preview, gifSrc || imgSrc || undefined);
                }
            }

            const msgId = _msgId(msg);
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
        .subscribe((status: string) => {
            if (status === 'SUBSCRIBED') _lastRealtimeEvent = Date.now();
        });

    // ── Chat reliability: 3-layer recovery ──

    // 1. Visibility recovery — poll immediately when tab/app returns to foreground
    document.removeEventListener('visibilitychange', _onVisibilityChange);
    document.addEventListener('visibilitychange', _onVisibilityChange);

    // 2. Safety-net poll — catch anything realtime missed (every 30s)
    if (_chatSafetyPollInterval) clearInterval(_chatSafetyPollInterval);
    _chatSafetyPollInterval = setInterval(_pollMissedMessages, 30000);

    // 3. Health monitor — if no realtime event in 45s, reconnect channel
    _lastRealtimeEvent = Date.now();
    if (_chatHealthInterval) clearInterval(_chatHealthInterval);
    _chatHealthInterval = setInterval(() => {
        if (!_chatChannel) return;
        const silentMs = Date.now() - _lastRealtimeEvent;
        if (silentMs > 45000) {
            const state = _chatChannel.state;
            if (state === 'errored' || state === 'closed') {
                _recoverChat();
            } else {
                // Channel says it's alive but hasn't delivered anything — poll to check
                _pollMissedMessages();
                _lastRealtimeEvent = Date.now(); // reset timer so we don't spam reconnects
            }
        }
    }, 15000);

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
                showDailyCode();
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
                if (rowEmail !== (email || '').toLowerCase()) return;

                if (fresh.wallet !== undefined || fresh.score !== undefined) {
                    setState({ wallet: fresh.wallet ?? getState().wallet, score: fresh.score ?? getState().score });
                    updateWalletDisplay();
                }
                // Paywall / silence activated or deactivated in realtime
                _applyPaywall(fresh.parameters?.paywall ?? null, fresh.member_id || email);
                _applySilence(fresh.silence === true, fresh.parameters?.silence_reason || '');
                // Vault: awaiting_video — force video proof overlay instantly (like paywall)
                const vr = fresh.parameters?.vault_request;
                if (vr && vr.status === 'awaiting_video' && vr.sessionId) {
                    _updateVaultLockButton({ active: true, status: 'awaiting_video', sessionId: vr.sessionId, lockDays: vr.lockDays } as any);
                    if (!document.getElementById('_vaultVideoOverlay')) {
                        _showVideoProofUpload({ sessionId: vr.sessionId, lockDays: vr.lockDays });
                    }
                }
                // Vault: active — redirect to vault (but not if proof upload is in progress — it handles its own redirect)
                // IMPORTANT: skip if already on /vault — presence heartbeat updates last_active constantly,
                // which triggers this handler and causes an infinite reload loop on the vault page
                else if (fresh.parameters?.active_overlay === 'vault') {
                    if (!document.getElementById('_vaultVideoOverlay') && window.location.pathname !== '/vault') {
                        window.location.href = '/vault';
                    }
                }
                // Vault lock released — reset button if active_overlay removed
                else if (!fresh.parameters?.active_overlay && !vr) {
                    _updateVaultLockButton(null);
                }
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
    if (email) initOneSignal(email);
}

async function _pollNewChatMessages(memberId: string) {
    if (!_lastChatMsgTimestamp) return;
    try {
        const res = await fetch('/api/chat/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId, since: _lastChatMsgTimestamp }) });
        const data = await res.json();
        if (!data.success) return;
        const newMsgs = (data.messages || []).filter((m: any) => {
            const id = _msgId(m);
            return id && !_renderedMsgIds.has(id);
        });
        if (newMsgs.length === 0) return;
        const wasAtBottom = _isScrolledToBottom();
        newMsgs.forEach((m: any) => {
            const id = _msgId(m);
            if (id) _renderedMsgIds.add(id);
            _lastChatMsgId = _msgId(m);
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


function _showPwaNotifPrompt(memberId: string) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000002;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;padding:24px;opacity:0;transition:opacity 0.3s ease;';
    overlay.innerHTML = `
        <div style="max-width:340px;width:100%;background:#0c0c0c;border-radius:16px;border:1px solid rgba(197,160,89,0.2);padding:32px 28px;text-align:center;">
            <div style="width:56px;height:56px;border-radius:50%;background:rgba(197,160,89,0.08);border:1px solid rgba(197,160,89,0.2);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
                <span style="font-size:1.6rem;line-height:1;">&#128276;</span>
            </div>
            <div style="font-family:'Cinzel',serif;font-size:1rem;color:#c5a059;letter-spacing:2px;margin-bottom:8px;">STAY CONNECTED</div>
            <div style="font-family:Rajdhani,sans-serif;font-size:0.85rem;color:rgba(255,255,255,0.5);line-height:1.6;margin-bottom:28px;">
                Turn on notifications so you never miss a message from Queen Karin. Task results, rewards, and royal decrees. Directly to your screen.
            </div>
            <button id="_pwaNotifAllow" style="width:100%;padding:14px;background:rgba(197,160,89,0.12);border:1px solid rgba(197,160,89,0.3);border-radius:10px;color:#c5a059;font-family:'Cinzel',serif;font-size:0.8rem;letter-spacing:2px;cursor:pointer;margin-bottom:12px;transition:background 0.2s;">ENABLE NOTIFICATIONS</button>
            <button id="_pwaNotifSkip" style="width:100%;padding:10px;background:transparent;border:none;color:rgba(255,255,255,0.25);font-family:Rajdhani,sans-serif;font-size:0.72rem;letter-spacing:1px;cursor:pointer;">MAYBE LATER</button>
        </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => { overlay.style.opacity = '1'; });

    const close = () => { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 300); };

    overlay.querySelector('#_pwaNotifAllow')?.addEventListener('click', async () => {
        close();
        const OS = (window as any).OneSignal;
        if (OS?.Notifications?.requestPermission) {
            await OS.Notifications.requestPermission();
        } else {
            await (window as any).Notification.requestPermission();
        }
        try {
            await new Promise(r => setTimeout(r, 1500));
            const subId = (window as any).OneSignal?.User?.PushSubscription?.id;
            if (subId) {
                await fetch('/api/push', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscriptionId: subId, memberId }) });
            }
        } catch {}
        _updateNotifToggleUI();
    });

    overlay.querySelector('#_pwaNotifSkip')?.addEventListener('click', () => {
        close();
        localStorage.setItem('pushBannerDismissed', String(Date.now()));
    });
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

    const isPwa = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;

    // PWA first launch: show full-screen notification prompt immediately
    if (isPwa && (window as any).Notification.permission === 'default' && !localStorage.getItem('_pwaNotifPrompted')) {
        localStorage.setItem('_pwaNotifPrompted', '1');
        setTimeout(() => _showPwaNotifPrompt(memberId), 1200);
        return;
    }

    // Don't show again if dismissed within last 7 days (but always show in PWA on first open)
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
            messages.forEach((m: any) => { const id = _msgId(m); if (id) _renderedMsgIds.add(id); });
            if (messages.length > 0) {
                const last = messages[messages.length - 1];
                _lastChatMsgId = _msgId(last);
                _lastChatMsgTimestamp = last.created_at || new Date().toISOString();
            } else {
                _lastChatMsgTimestamp = new Date().toISOString();
            }

            // 3. Split: system messages → system log, chat messages → chat box
            _lastRenderedChatTs = 0;
            const allDisplay = messages.filter((m: any) => m.content && m.content.trim());
            const sysDisplay = allDisplay.filter((m: any) => isSystemMessage(m));
            const chatDisplay = allDisplay.filter((m: any) => !isSystemMessage(m) && !m.metadata?.isAI && !(m.content || '').startsWith('TOUR_REPORT::') && !(m.content || '').startsWith('APP_INSTALL::') && !(m.content || '').startsWith('VAULT_ATTENTION::'));

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

            // 4. Update Queen online status from real presence data
            _fetchQueenStatus();

            ['chatContent', 'mob_chatContent'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = html;
            });

            // Show welcome gate as an overlay on top of chat area
            const _forceGate = new URLSearchParams(window.location.search).has('chatgate');
            document.querySelectorAll('#_chatWelcomeGate').forEach(e => e.remove());
            if (displayMessages.length === 0 || _forceGate) {
                _showChatWelcomeGate();
            }

            if (!document.getElementById('_chatWelcomeGate')) {
                _scrollChatDelayed();
            }
            _attachImgScrollHandlers();

            // Check unlock status for any paid media messages (await to ensure DOM updates)
            await _checkPaidMediaUnlocks(messages);
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
    const content = (msg.content || msg.message || '');
    // Card messages are NOT system messages — they render as rich cards in regular chat
    if (content.startsWith('INVENTORY_CARD::') || content.startsWith('VAULT_UNLOCK_CARD::') || content.startsWith('VAULT_LOCK_CARD::') || content.startsWith('LOCK_EXTENDED_CARD::') || content.startsWith('LEADERBOARD_REWARD_CARD::') || content.startsWith('PROMOTION_CARD::') || content.startsWith('WELCOME_CARD::') || content.startsWith('TASK_REVIEW_CARD::') || content.startsWith('ROUTINE_CHANGE::') || content.startsWith('TASK_FEEDBACK::') || content.startsWith('WISHLIST::')) return false;
    if (msg.type === 'system') return true; // Explicit type check
    const sender = (msg.sender_email || msg.sender || '').toLowerCase();
    const upper = content.toUpperCase();

    return sender === 'system' ||
        upper.includes('COINS RECEIVED') ||
        upper.includes('TASK APPROVED') ||
        upper.includes('POINTS RECEIVED') ||
        upper.includes('TASK REJECTED') ||
        upper.includes('TASK VERIFIED');
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

    // ── INVENTORY_CARD ──
    if (content.startsWith('INVENTORY_CARD::')) {
        try {
            const dd = JSON.parse(content.replace('INVENTORY_CARD::', ''));
            const isGift = dd.source === 'gift';
            const itemNames: Record<string, string> = { skippass: 'SKIP PASS', cumpass: 'CUM PASS', checkpoint: 'CHECKPOINT' };
            const itemIcons: Record<string, string> = {
                skippass: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c5a059" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 5H2"/><path d="M13 9H2"/><path d="M13 13H6"/><path d="M17 17l4-4-4-4"/><path d="M21 13H8"/></svg>',
                cumpass: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c5a059" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
                checkpoint: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c5a059" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            };
            const title = isGift ? `${itemNames[dd.item] || dd.item} RECEIVED` : `${itemNames[dd.item] || dd.item} PURCHASED`;
            const subtitle = isGift ? 'Gifted by Queen Karin' : `${dd.price?.toLocaleString() || 0} coins spent`;
            const icon = itemIcons[dd.item] || '';
            return `
            <div style="display:flex;flex-direction:column;background:rgba(197,160,89,0.04);border-left:2px solid rgba(197,160,89,0.5);border-radius:4px;padding:12px 16px;margin-bottom:10px;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                    ${icon}
                    <span style="font-family:Cinzel,serif;font-size:0.8rem;color:#c5a059;letter-spacing:2px;">${title}</span>
                </div>
                <div style="font-family:Rajdhani,sans-serif;font-size:0.75rem;color:rgba(255,255,255,0.4);margin-top:2px;">${subtitle}</div>
                <div style="font-family:Rajdhani,sans-serif;font-size:0.7rem;color:rgba(197,160,89,0.5);margin-top:4px;">Total: ${dd.newCount || 0}</div>
                <span style="font-family:Cinzel,serif;color:rgba(255,255,255,0.2);font-size:0.55rem;margin-top:8px;">${dateStr} - ${timeStr}</span>
            </div>`;
        } catch (_) {}
    }

    // ── TASK_REVIEW_CARD ──
    if (content.startsWith('TASK_REVIEW_CARD::')) {
        try {
            const dd = JSON.parse(content.replace('TASK_REVIEW_CARD::', ''));
            const approved = dd.status === 'approve';
            const accent = approved ? '#c5a059' : '#7a7a7a';
            const accentBorder = approved ? 'rgba(197,160,89,0.2)' : 'rgba(122,122,122,0.15)';
            const label = dd.type === 'routine' ? 'ROUTINE' : 'TASK';
            const title = approved ? `${label} APPROVED` : `${label} REJECTED`;
            const pointsText = approved && dd.points ? `<div style="font-family:'Cinzel',serif;font-size:0.8rem;color:${accent};font-weight:700;letter-spacing:2px;margin-top:4px;">+${dd.points} MERIT</div>` : '';
            const penaltyText = !approved && dd.penalty ? `<div style="font-family:'Cinzel',serif;font-size:0.8rem;color:${accent};font-weight:700;letter-spacing:2px;margin-top:4px;">-${dd.penalty} COINS</div>` : '';
            const taskText = dd.taskText ? `<div style="font-family:Rajdhani,sans-serif;font-size:0.75rem;color:rgba(255,255,255,0.4);margin-top:4px;line-height:1.4;">${dd.taskText}</div>` : '';
            const thumb = dd.thumbnail ? `<img src="${dd.thumbnail}" style="width:46px;height:64px;border-radius:6px;object-fit:cover;flex-shrink:0;border:1px solid rgba(255,255,255,0.06);margin-right:12px;" onerror="this.style.display='none'">` : '';
            const comment = dd.comment ? `<div style="font-family:Rajdhani,sans-serif;font-size:0.75rem;color:rgba(255,255,255,0.55);font-style:italic;margin-top:4px;line-height:1.4;">"${dd.comment}"</div>` : '';
            return `
            <div style="position:relative;display:flex;align-items:flex-start;background:#0c0c0c;border-radius:8px;border:1px solid ${accentBorder};border-top:2px solid ${accent};padding:12px 14px;margin-bottom:10px;">
                <div style="position:absolute;top:10px;right:12px;font-family:Rajdhani,sans-serif;font-size:0.55rem;color:rgba(255,255,255,0.18);">${dateStr} ${timeStr}</div>
                ${thumb}
                <div style="flex:1;min-width:0;">
                    <span style="font-family:'Cinzel',serif;font-size:0.7rem;color:${accent};letter-spacing:2px;font-weight:700;">${title}</span>
                    ${pointsText}${penaltyText}
                    ${taskText}${comment}
                </div>
            </div>`;
        } catch (_) {}
    }

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

    // WELCOME CARD (new member)
    if (content.startsWith('WELCOME_CARD::')) {
        try {
            const d = JSON.parse(content.replace('WELCOME_CARD::', ''));
            const wIni = (d.name || 'S')[0].toUpperCase();
            const cardHtml = `
            <div style="width:min(85%,340px);min-width:200px;margin:0 auto;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0c0a04 0%,#13100a 50%,#0c0a04 100%);border:1px solid rgba(197,160,89,0.6);box-shadow:0 12px 40px rgba(0,0,0,0.8),0 0 30px rgba(197,160,89,0.08);">
                <div style="width:100%;padding:20px 0 14px;display:flex;flex-direction:column;align-items:center;background:radial-gradient(ellipse at center top,rgba(197,160,89,0.1) 0%,transparent 70%);">
                    <div style="width:60px;height:60px;border-radius:50%;border:2px solid rgba(197,160,89,0.6);display:flex;align-items:center;justify-content:center;font-family:'Cinzel',serif;font-size:1.5rem;color:#c5a059;background:radial-gradient(circle,rgba(197,160,89,0.12) 0%,rgba(197,160,89,0.03) 100%);box-shadow:0 0 20px rgba(197,160,89,0.15),0 0 40px rgba(197,160,89,0.05);">${wIni}</div>
                </div>
                <div style="padding:4px 18px 20px;text-align:center;">
                    <div style="font-family:'Cinzel',serif;font-size:1rem;color:#fff;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:6px;">${d.name || ''}</div>
                    <div style="width:40%;height:1px;background:linear-gradient(to right,transparent,rgba(197,160,89,0.5),transparent);margin:0 auto 8px;"></div>
                    <div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(197,160,89,0.65);letter-spacing:3px;margin-bottom:12px;">HAS ENTERED THE COURT</div>
                    <div style="display:inline-flex;align-items:center;gap:5px;background:rgba(197,160,89,0.06);border:1px solid rgba(197,160,89,0.25);border-radius:20px;padding:4px 14px;"><svg width="13" height="10" viewBox="0 0 26 20" fill="#c5a059"><path d="M2 18 L5 8 L10 13 L13 3 L16 13 L21 8 L24 18 Z"/><rect x="2" y="17" width="22" height="2" rx="1"/></svg><span style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:#c5a059;letter-spacing:2px;">${(d.rank || 'HALL BOY').toUpperCase()}</span></div>
                </div>
            </div>`;
            return `<div class="cb-row" style="justify-content:center;padding:8px 0;">${cardHtml}${timeStr ? `<div class="chat-ts" style="text-align:center;margin-top:4px">${timeStr}</div>` : ''}</div>`;
        } catch (_) {
            return `<div class="cb-row cb-row-queen">${queenAvatar}<div class="cb-wrap-queen"><div class="cb-queen">New Member</div>${timeStr ? `<div class="chat-ts chat-ts-left">${timeStr}</div>` : ''}</div></div>`;
        }
    }

    // DIRECT TRIBUTE CARD (coin send - private chat)
    if (content.startsWith('DIRECT_TRIBUTE_CARD::')) {
        try {
            const d = JSON.parse(content.replace('DIRECT_TRIBUTE_CARD::', ''));
            const cardHtml = `
            <div style="width:min(75%,260px);margin:0 auto;border-radius:14px;overflow:hidden;background:linear-gradient(170deg,#0e0b06,#0d0a04,#0a0703);border:1px solid rgba(197,160,89,0.5);box-shadow:0 8px 30px rgba(0,0,0,0.6);text-align:center;padding:20px 16px;">
                <div style="font-size:1.8rem;margin-bottom:8px;">\u2728</div>
                <div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(197,160,89,0.6);letter-spacing:3px;margin-bottom:10px;">TRIBUTE SENT</div>
                <div style="font-family:'Orbitron',sans-serif;font-size:1.2rem;color:#c5a059;font-weight:700;margin-bottom:4px;">${(d.amount||0).toLocaleString()}</div>
                <div style="font-family:'Rajdhani',sans-serif;font-size:0.5rem;color:rgba(197,160,89,0.4);letter-spacing:2px;">COINS</div>
            </div>`;
            return `<div class="cb-row" style="justify-content:center;padding:8px 0;">${cardHtml}${timeStr ? `<div class="chat-ts" style="text-align:center;margin-top:4px">${timeStr}</div>` : ''}</div>`;
        } catch (_) { /* fall through */ }
    }

    // INVENTORY CARD (gift/purchase)
    if (content.startsWith('INVENTORY_CARD::')) {
        try {
            const d = JSON.parse(content.replace('INVENTORY_CARD::', ''));
            const isGift = d.source === 'gift';
            const itemNames: Record<string, string> = { skippass: 'SKIP PASS', cumpass: 'CUM PASS', checkpoint: 'CHECKPOINT' };
            const itemIcons: Record<string, string> = {
                skippass: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c5a059" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 5H2"/><path d="M13 9H2"/><path d="M13 13H6"/><path d="M17 17l4-4-4-4"/><path d="M21 13H8"/></svg>',
                cumpass: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c5a059" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
                checkpoint: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c5a059" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            };
            const title = isGift ? `${itemNames[d.item] || d.item} RECEIVED` : `${itemNames[d.item] || d.item} PURCHASED`;
            const subtitle = isGift ? 'Gifted by Queen Karin' : `${(d.price || 0).toLocaleString()} coins`;
            const cardHtml = `
            <div style="width:min(85%,260px);margin:0 auto;border-radius:14px;overflow:hidden;background:linear-gradient(170deg,#0e0b06,#110d04,#0a0703);border:1px solid rgba(197,160,89,0.5);box-shadow:0 12px 40px rgba(0,0,0,0.8);">
                <div style="padding:18px 20px;text-align:center;">
                    <div style="font-family:'Cinzel',serif;font-size:0.75rem;color:rgba(197,160,89,0.6);letter-spacing:3px;margin-bottom:10px;">${title}</div>
                    <div style="width:40%;height:1px;background:linear-gradient(to right,transparent,rgba(197,160,89,0.4),transparent);margin:0 auto 12px;"></div>
                    <div style="margin-bottom:10px;">${itemIcons[d.item] || ''}</div>
                    <div style="font-family:Rajdhani,sans-serif;font-size:0.9rem;color:rgba(255,255,255,0.5);letter-spacing:1px;">${subtitle}</div>
                    <div style="font-family:Rajdhani,sans-serif;font-size:0.75rem;color:rgba(197,160,89,0.45);margin-top:4px;">Total: ${d.newCount || 0}</div>
                </div>
            </div>`;
            return `<div class="cb-row" style="justify-content:center;padding:8px 0;">${cardHtml}${timeStr ? `<div class="chat-ts" style="text-align:center;margin-top:4px">${timeStr}</div>` : ''}</div>`;
        } catch (_) {
            return `<div class="cb-row cb-row-queen">${queenAvatar}<div class="cb-wrap-queen"><div class="cb-queen">Inventory Updated</div>${timeStr ? `<div class="chat-ts chat-ts-left">${timeStr}</div>` : ''}</div></div>`;
        }
    }

    // VAULT UNLOCK CARD
    if (content.startsWith('VAULT_UNLOCK_CARD::')) {
        try {
            const d = JSON.parse(content.replace('VAULT_UNLOCK_CARD::', ''));
            const sourceLabels: Record<string, string> = { gift: 'Gifted by Queen Karin', risky_game: 'Won in Risky Game', leaderboard: 'Leaderboard Reward', milestone: 'Milestone Reward' };
            const thumb = d.thumbnail ? `<div style="width:100%;height:120px;overflow:hidden;border-radius:14px 14px 0 0;"><img src="${d.thumbnail}" style="width:100%;height:100%;object-fit:cover;display:block;filter:blur(0);" onerror="this.style.display='none'" /></div>` : '';
            const cardHtml = `
            <div style="width:min(85%,260px);margin:0 auto;border-radius:14px;overflow:hidden;background:linear-gradient(170deg,#0e0b06,#110d04,#0a0703);border:1px solid rgba(197,160,89,0.5);box-shadow:0 12px 40px rgba(0,0,0,0.8);">
                ${thumb}
                <div style="padding:16px 20px;text-align:center;">
                    <div style="font-family:'Cinzel',serif;font-size:0.75rem;color:rgba(197,160,89,0.6);letter-spacing:3px;margin-bottom:8px;">VAULT UNLOCKED</div>
                    <div style="width:40%;height:1px;background:linear-gradient(to right,transparent,rgba(197,160,89,0.4),transparent);margin:0 auto 10px;"></div>
                    <div style="margin-bottom:8px;"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c5a059" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
                    <div style="font-family:'Cinzel',serif;font-size:0.85rem;color:rgba(255,255,255,0.7);letter-spacing:1px;margin-bottom:4px;">${d.title || 'Exclusive'}</div>
                    <div style="font-family:Rajdhani,sans-serif;font-size:0.75rem;color:rgba(197,160,89,0.45);">${sourceLabels[d.source] || 'Unlocked'}</div>
                </div>
            </div>`;
            return `<div class="cb-row" style="justify-content:center;padding:8px 0;">${cardHtml}${timeStr ? `<div class="chat-ts" style="text-align:center;margin-top:4px">${timeStr}</div>` : ''}</div>`;
        } catch (_) {
            return `<div class="cb-row cb-row-queen">${queenAvatar}<div class="cb-wrap-queen"><div class="cb-queen">Vault Item Unlocked</div>${timeStr ? `<div class="chat-ts chat-ts-left">${timeStr}</div>` : ''}</div></div>`;
        }
    }

    // VAULT LOCK CARD
    if (content.startsWith('VAULT_LOCK_CARD::')) {
        try {
            const d = JSON.parse(content.replace('VAULT_LOCK_CARD::', ''));
            const typeLabel = d.type === 'instant' ? 'Self-locked' : 'Awaiting approval';
            const cardHtml = `
            <div style="width:min(85%,260px);margin:0 auto;border-radius:14px;overflow:hidden;background:linear-gradient(170deg,#0e0406,#0d0404,#0a0303);border:1px solid rgba(139,0,0,0.4);box-shadow:0 12px 40px rgba(0,0,0,0.8);">
                <div style="padding:16px 20px;text-align:center;">
                    <div style="font-family:'Cinzel',serif;font-size:0.75rem;color:rgba(139,0,0,0.65);letter-spacing:3px;margin-bottom:8px;">KEYHOLDER LOCK</div>
                    <div style="width:40%;height:1px;background:linear-gradient(to right,transparent,rgba(139,0,0,0.35),transparent);margin:0 auto 10px;"></div>
                    <div style="margin-bottom:8px;"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(180,40,40,0.7)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
                    <div style="font-family:'Cinzel',serif;font-size:0.85rem;color:rgba(255,255,255,0.6);letter-spacing:1px;margin-bottom:4px;">${d.name||''} — ${d.days||0} Days</div>
                    <div style="font-family:Rajdhani,sans-serif;font-size:0.7rem;color:rgba(139,0,0,0.45);">${typeLabel}</div>
                </div>
            </div>`;
            return `<div class="cb-row" style="justify-content:center;padding:8px 0;">${cardHtml}${timeStr ? `<div class="chat-ts" style="text-align:center;margin-top:4px">${timeStr}</div>` : ''}</div>`;
        } catch (_) {
            return `<div class="cb-row cb-row-queen">${queenAvatar}<div class="cb-wrap-queen"><div class="cb-queen">Vault Locked</div>${timeStr ? `<div class="chat-ts chat-ts-left">${timeStr}</div>` : ''}</div></div>`;
        }
    }

    // LOCK EXTENDED CARD
    if (content.startsWith('LOCK_EXTENDED_CARD::')) {
        try {
            const d = JSON.parse(content.replace('LOCK_EXTENDED_CARD::', ''));
            const expiresLabel = d.newExpires ? new Date(d.newExpires).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
            const cardHtml = `
            <div style="width:min(85%,260px);margin:0 auto;border-radius:14px;overflow:hidden;background:linear-gradient(170deg,#0e0406,#0d0404,#0a0303);border:1px solid rgba(139,0,0,0.5);box-shadow:0 12px 40px rgba(0,0,0,0.8);">
                <div style="padding:16px 20px;text-align:center;">
                    <div style="font-family:'Cinzel',serif;font-size:0.65rem;color:rgba(139,0,0,0.65);letter-spacing:4px;margin-bottom:8px;">LOCK EXTENDED</div>
                    <div style="width:40%;height:1px;background:linear-gradient(to right,transparent,rgba(139,0,0,0.35),transparent);margin:0 auto 12px;"></div>
                    <div style="font-family:'Cinzel',serif;font-size:1.5rem;color:rgba(180,40,40,0.85);letter-spacing:2px;margin-bottom:4px;">+${d.days||0}</div>
                    <div style="font-family:'Rajdhani',sans-serif;font-size:0.65rem;color:rgba(255,255,255,0.35);letter-spacing:3px;margin-bottom:10px;">DAY${(d.days||0) !== 1 ? 'S' : ''} ADDED</div>
                    <div style="width:40%;height:1px;background:linear-gradient(to right,transparent,rgba(139,0,0,0.2),transparent);margin:0 auto 10px;"></div>
                    <div style="font-family:'Orbitron',sans-serif;font-size:0.5rem;color:rgba(255,255,255,0.25);letter-spacing:2px;">${d.newTotal||0} DAYS TOTAL</div>
                    ${expiresLabel ? `<div style="font-family:'Rajdhani',sans-serif;font-size:0.55rem;color:rgba(139,0,0,0.4);margin-top:4px;">Until ${expiresLabel}</div>` : ''}
                </div>
            </div>`;
            return `<div class="cb-row" style="justify-content:center;padding:8px 0;">${cardHtml}${timeStr ? `<div class="chat-ts" style="text-align:center;margin-top:4px">${timeStr}</div>` : ''}</div>`;
        } catch (_) {
            return `<div class="cb-row" style="justify-content:center;padding:8px 0;"><div style="font-family:'Cinzel',serif;font-size:0.65rem;color:rgba(139,0,0,0.5);">Lock extended</div></div>`;
        }
    }

    // LEADERBOARD REWARD CARD
    if (content.startsWith('LEADERBOARD_REWARD_CARD::')) {
        try {
            const d = JSON.parse(content.replace('LEADERBOARD_REWARD_CARD::', ''));
            const title = d.title || d.TITLE || 'CHAMPION';
            const rewards = d.rewards || d.REWARDS || '';
            const score = d.score || d.SCORE || 0;
            const period = d.period || d.PERIOD || '';
            const cardHtml = `
            <div style="width:min(85%,340px);min-width:200px;margin:0 auto;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0e0b06 0%,#110d04 60%,#0a0703 100%);border:1px solid rgba(197,160,89,0.6);box-shadow:0 12px 40px rgba(0,0,0,0.8),0 0 30px rgba(197,160,89,0.1);">
                <div style="padding:20px 20px;text-align:center;">
                    <div style="font-size:1.6rem;margin-bottom:6px;">👑</div>
                    <div style="font-family:'Cinzel',serif;font-size:0.8rem;color:#c5a059;letter-spacing:3px;margin-bottom:4px;">${title}</div>
                    <div style="width:40%;height:1px;background:linear-gradient(to right,transparent,rgba(197,160,89,0.5),transparent);margin:8px auto;"></div>
                    <div style="font-family:'Rajdhani',sans-serif;font-size:0.95rem;color:rgba(255,255,255,0.8);margin-bottom:6px;">${rewards}</div>
                    <div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(197,160,89,0.5);letter-spacing:2px;">SCORE: ${Number(score).toLocaleString()} · ${String(period).toUpperCase()}</div>
                </div>
            </div>`;
            return `<div class="cb-row" style="justify-content:center;padding:8px 0;">${cardHtml}${timeStr ? `<div class="chat-ts" style="text-align:center;margin-top:4px">${timeStr}</div>` : ''}</div>`;
        } catch (_) {
            return `<div class="cb-row cb-row-queen">${queenAvatar}<div class="cb-wrap-queen"><div class="cb-queen">Leaderboard Reward</div>${timeStr ? `<div class="chat-ts chat-ts-left">${timeStr}</div>` : ''}</div></div>`;
        }
    }

    // RISKY TRIBUTE CARD (gamble result - private chat)
    if (content.startsWith('RISKY_TRIBUTE_CARD::')) {
        try {
            const d = JSON.parse(content.replace('RISKY_TRIBUTE_CARD::', ''));
            const rIsWin = d.isWin;
            const rBorderColor = rIsWin ? 'rgba(197,160,89,0.5)' : d.lostAmount === 0 ? 'rgba(74,222,128,0.4)' : 'rgba(220,50,80,0.4)';
            const rBg = rIsWin ? '#0e0b06' : d.lostAmount === 0 ? '#060e08' : '#0e0606';
            const rResultText = rIsWin ? `WON +${(d.wonAmount||0).toLocaleString()}` : d.lostAmount === 0 ? 'NO LOSS' : `LOST ${(d.lostAmount||0).toLocaleString()}`;
            const rResultColor = rIsWin ? '#c5a059' : d.lostAmount === 0 ? '#4ade80' : '#e03050';
            const rIconHtml = d.icon && d.icon.startsWith('/') ? `<img src="${d.icon}" style="width:70px;height:auto;">` : `<div style="font-size:2.2rem;">${d.icon||'🎰'}</div>`;
            const cardHtml = `
            <div style="width:min(90%,320px);margin:0 auto;">
                <div style="border-radius:14px;overflow:hidden;background:linear-gradient(170deg,${rBg},#0a0a14);border:1px solid ${rBorderColor};box-shadow:0 8px 30px rgba(0,0,0,0.6);padding:14px 16px;">
                    <div style="display:flex;align-items:center;gap:14px;">
                        <div style="flex-shrink:0;width:70px;display:flex;align-items:center;justify-content:center;">${rIconHtml}</div>
                        <div style="flex:1;min-width:0;">
                            <div style="font-family:'Cinzel',serif;font-size:0.8rem;color:rgba(255,255,255,0.85);font-weight:700;margin-bottom:4px;">${d.senderName||''}</div>
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(255,255,255,0.35);letter-spacing:2px;margin-bottom:3px;">RISKY SEND</div>
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.55rem;color:${rResultColor};letter-spacing:1px;font-weight:700;margin-bottom:3px;">${d.cardName||''}</div>
                            <div style="font-family:'Rajdhani',sans-serif;font-size:0.75rem;color:rgba(255,255,255,0.45);">Staked ${(d.stakeAmount||0).toLocaleString()} · <span style="color:${rResultColor};font-weight:700;">${rResultText}</span></div>
                        </div>
                    </div>
                </div>
                <div style="margin-top:8px;text-align:center;"><button onclick="if(window.openInlineRisky){window.openInlineRisky();}" style="background:linear-gradient(135deg,rgba(197,160,89,0.15),rgba(197,160,89,0.05));border:1px solid rgba(197,160,89,0.4);color:#c5a059;font-family:'Orbitron',sans-serif;font-size:0.4rem;letter-spacing:2px;padding:6px 20px;border-radius:20px;cursor:pointer;">TRY YOUR LUCK</button></div>
            </div>`;
            return `<div class="cb-row" style="justify-content:center;padding:8px 0;">${cardHtml}${timeStr ? `<div class="chat-ts" style="text-align:center;margin-top:4px">${timeStr}</div>` : ''}</div>`;
        } catch (_) { /* fall through */ }
    }

    // CERTIFICATE PROOF SUBMITTED (user sees their own submission)
    if (content.startsWith('CERT_PROOF::')) {
        try {
            const d = JSON.parse(content.replace('CERT_PROOF::', ''));
            const imgUrl = d.mediaUrl || '';
            return `
                <div class="cb-row" style="justify-content:center;padding:8px 0;">
                    <div style="width:min(80%,300px);border-radius:14px;overflow:hidden;background:linear-gradient(170deg,#0c0a04 0%,#110e06 60%,#0a0803 100%);border:1px solid rgba(197,160,89,0.35);box-shadow:0 10px 35px rgba(0,0,0,0.7),0 0 20px rgba(197,160,89,0.04);">
                        ${imgUrl ? `<img src="${imgUrl}" style="width:100%;max-height:180px;object-fit:cover;display:block;" onerror="this.style.display='none'">` : ''}
                        <div style="padding:14px 18px 16px;text-align:center;">
                            <div style="font-family:'Cinzel',serif;font-size:0.55rem;color:rgba(197,160,89,0.5);letter-spacing:3px;margin-bottom:6px;">CERTIFICATE PROOF</div>
                            <div style="width:30%;height:1px;background:linear-gradient(to right,transparent,rgba(197,160,89,0.3),transparent);margin:0 auto 8px;"></div>
                            <div style="font-family:'Cinzel',serif;font-size:0.7rem;color:rgba(197,160,89,0.7);letter-spacing:1px;">Awaiting Approval</div>
                        </div>
                    </div>
                    ${timeStr ? `<div class="chat-ts" style="text-align:center;margin-top:4px">${timeStr}</div>` : ''}
                </div>`;
        } catch (_) { /* fall through */ }
    }

    // CERTIFICATE APPROVED
    if (content.startsWith('CERT_APPROVED::')) {
        try {
            const d = JSON.parse(content.replace('CERT_APPROVED::', ''));
            const reward = d.reward || 300;
            return `
                <div class="cb-row" style="justify-content:center;padding:8px 0;">
                    <div style="width:min(80%,300px);border-radius:14px;overflow:hidden;background:linear-gradient(170deg,#060d04 0%,#0a1306 60%,#060d04 100%);border:1px solid rgba(74,222,128,0.35);box-shadow:0 10px 35px rgba(0,0,0,0.7),0 0 20px rgba(74,222,128,0.06);">
                        <div style="padding:20px 18px;text-align:center;">
                            <div style="font-size:1.6rem;margin-bottom:8px;">&#10003;</div>
                            <div style="font-family:'Cinzel',serif;font-size:0.55rem;color:rgba(74,222,128,0.6);letter-spacing:3px;margin-bottom:8px;">CERTIFICATE APPROVED</div>
                            <div style="width:30%;height:1px;background:linear-gradient(to right,transparent,rgba(74,222,128,0.3),transparent);margin:0 auto 10px;"></div>
                            <div style="font-family:'Cinzel',serif;font-size:1rem;color:#4ade80;font-weight:700;letter-spacing:2px;">+${reward} COINS</div>
                        </div>
                    </div>
                    ${timeStr ? `<div class="chat-ts" style="text-align:center;margin-top:4px">${timeStr}</div>` : ''}
                </div>`;
        } catch (_) { /* fall through */ }
    }

    // CERTIFICATE REJECTED
    if (content.startsWith('CERT_REJECTED::')) {
        return `
            <div class="cb-row" style="justify-content:center;padding:8px 0;">
                <div style="width:min(80%,300px);border-radius:14px;overflow:hidden;background:linear-gradient(170deg,#0d0404 0%,#130606 60%,#0d0404 100%);border:1px solid rgba(255,60,60,0.25);box-shadow:0 10px 35px rgba(0,0,0,0.7);">
                    <div style="padding:20px 18px;text-align:center;">
                        <div style="font-family:'Cinzel',serif;font-size:0.55rem;color:rgba(255,60,60,0.5);letter-spacing:3px;margin-bottom:8px;">CERTIFICATE REJECTED</div>
                        <div style="width:30%;height:1px;background:linear-gradient(to right,transparent,rgba(255,60,60,0.2),transparent);margin:0 auto 10px;"></div>
                        <div style="font-family:'Cinzel',serif;font-size:0.65rem;color:rgba(255,255,255,0.5);letter-spacing:1px;">Please try again with a valid screenshot.</div>
                    </div>
                </div>
                ${timeStr ? `<div class="chat-ts" style="text-align:center;margin-top:4px">${timeStr}</div>` : ''}
            </div>`;
    }

    // ROUTINE CHANGE CARD
    if (content.startsWith('ROUTINE_CHANGE::')) {
        try {
            const d = JSON.parse(content.replace('ROUTINE_CHANGE::', ''));
            const cardHtml = `
            <div style="width:min(85%,340px);min-width:200px;margin:0 auto;border-radius:14px;overflow:hidden;background:linear-gradient(170deg,#0c0806 0%,#0e0a04 60%,#0a0703 100%);border:1px solid rgba(197,160,89,0.35);box-shadow:0 10px 35px rgba(0,0,0,0.7),0 0 20px rgba(197,160,89,0.04);">
                <div style="padding:18px 20px;text-align:center;">
                    <div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(197,160,89,0.5);letter-spacing:3px;margin-bottom:12px;">ROUTINE UPDATED</div>
                    <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
                        <span style="font-family:'Rajdhani',sans-serif;font-size:0.82rem;color:rgba(255,255,255,0.3);text-decoration:line-through;">${(d.oldRoutine || 'None').toUpperCase()}</span>
                        <span style="color:rgba(197,160,89,0.6);font-size:0.85rem;">\u2192</span>
                        <span style="font-family:'Cinzel',serif;font-size:0.9rem;color:#c5a059;font-weight:700;letter-spacing:1px;">${(d.newRoutine || 'None').toUpperCase()}</span>
                    </div>
                    <div style="width:60%;height:1px;background:linear-gradient(to right,transparent,rgba(197,160,89,0.25),transparent);margin:0 auto;"></div>
                </div>
            </div>`;
            return `<div class="cb-row" style="justify-content:center;padding:8px 0;">${cardHtml}${timeStr ? `<div class="chat-ts" style="text-align:center;margin-top:4px">${timeStr}</div>` : ''}</div>`;
        } catch (_) {
            return `<div class="cb-row cb-row-queen">${queenAvatar}<div class="cb-wrap-queen"><div class="cb-queen">Routine Updated</div>${timeStr ? `<div class="chat-ts chat-ts-left">${timeStr}</div>` : ''}</div></div>`;
        }
    }

    // TASK REVIEW CARD (approve/reject notification)
    if (content.startsWith('TASK_REVIEW_CARD::')) {
        try {
            const d = JSON.parse(content.replace('TASK_REVIEW_CARD::', ''));
            const approved = d.status === 'approve';
            const accent = approved ? '#c5a059' : '#7a7a7a';
            const accentBorder = approved ? 'rgba(197,160,89,0.2)' : 'rgba(122,122,122,0.15)';
            const label = d.type === 'routine' ? 'ROUTINE' : 'TASK';
            const statusText = approved ? 'APPROVED' : 'REJECTED';
            const thumbBlock = d.thumbnail
                ? `<img src="${d.thumbnail}" style="width:52px;height:72px;border-radius:6px;object-fit:cover;flex-shrink:0;border:1px solid rgba(255,255,255,0.06);" onerror="this.style.display='none'" />`
                : '';
            const taskTextLine = d.taskText
                ? `<div style="font-family:Rajdhani,sans-serif;font-size:0.72rem;color:rgba(255,255,255,0.4);line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;">${d.taskText}</div>`
                : '';
            const pointsText = approved && d.points
                ? `<div style="font-family:'Cinzel',serif;font-size:0.85rem;color:${accent};font-weight:700;letter-spacing:2px;text-align:center;margin:6px 0;">+${(d.points || 0).toLocaleString()} MERIT</div>`
                : d.penalty
                    ? `<div style="font-family:'Cinzel',serif;font-size:0.85rem;color:${accent};font-weight:700;letter-spacing:2px;text-align:center;margin:6px 0;">-${d.penalty} COINS</div>`
                    : '';
            const commentLine = d.comment
                ? `<div style="font-family:Rajdhani,sans-serif;font-size:0.78rem;color:rgba(255,255,255,0.55);font-style:italic;margin-top:6px;line-height:1.4;">"${d.comment}"</div>`
                : '';
            return `
                <div class="cb-row" style="justify-content:center;padding:6px 0;">
                    <div style="max-width:360px;width:88%;border-radius:12px;overflow:hidden;background:#0c0c0c;border:1px solid ${accentBorder};">
                        <div style="height:2px;background:linear-gradient(to right,transparent,${accent},transparent);opacity:0.5;"></div>
                        <div style="position:relative;display:flex;gap:14px;padding:12px 16px;">
                            ${timeStr ? `<div style="position:absolute;top:10px;right:14px;font-family:Rajdhani,sans-serif;font-size:0.58rem;color:rgba(255,255,255,0.2);">${timeStr}</div>` : ''}
                            ${thumbBlock}
                            <div style="flex:1;min-width:0;text-align:center;">
                                <div style="font-family:'Cinzel',serif;font-size:0.65rem;color:${accent};letter-spacing:2px;font-weight:700;margin-bottom:4px;">${label} ${statusText}</div>
                                ${pointsText}
                                ${taskTextLine}
                                ${commentLine}
                            </div>
                        </div>
                    </div>
                </div>`;
        } catch (_) {
            return `<div class="cb-row cb-row-queen"><div class="cb-wrap-queen"><div class="cb-queen">Task Reviewed</div></div></div>`;
        }
    }

    // TASK FEEDBACK CARD (comment card)
    if (content.startsWith('TASK_FEEDBACK::')) {
        try {
            const data = JSON.parse(content.replace('TASK_FEEDBACK::', ''));
            const { mediaUrl: fbMedia, mediaType: fbType, note: fbNote, taskId: fbTaskId, memberId: fbMemberId } = data;
            const fbIsVideo = (fbType && (fbType === 'video' || fbType.startsWith('video/'))) || (fbMedia && /\.(mp4|mov|webm)/i.test(fbMedia));
            const fbSrc = fbMedia ? (fbIsVideo ? fbMedia : getOptimizedUrl(fbMedia, 600)) : null;
            const fbThumb = data.thumbnailUrl || data.thumbnail_url || null;
            const mediaBlock = fbSrc
                ? (fbIsVideo
                    ? `<div style="position:relative;width:100%;max-height:180px;overflow:hidden;border-radius:10px 10px 0 0;cursor:pointer;background:#000;" onclick="event.stopPropagation();window.openModById&&'${fbTaskId}'&&'${fbMemberId}'?window.openModById('${fbTaskId}','${fbMemberId}',true):void 0"><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:2;"><div style="width:44px;height:44px;border-radius:50%;background:rgba(197,160,89,0.85);display:flex;align-items:center;justify-content:center;font-size:1.2rem;">▶</div></div>${fbThumb ? `<img src="${fbThumb}" style="width:100%;max-height:180px;object-fit:cover;display:block;pointer-events:none;">` : '<div style="height:120px;"></div>'}</div>`
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

    // AI ASSISTANT message — purple bubble, no avatar image
    const isAI = senderEmail === 'ai-assistant' || msg.metadata?.isAI === true;
    if (isAI && !isMe) {
        return `
            <div class="cb-row cb-row-ai-in" style="padding:4px 12px;">
                <div style="display:flex;align-items:flex-start;gap:8px;max-width:85%;">
                    <div class="ai-avatar-sm"></div>
                    <div class="msg-col" style="align-items:flex-start;">
                        <div class="cb-ai">${content}</div>
                        ${timeStr ? `<div class="chat-ts chat-ts-left">${timeStr}</div>` : ''}
                    </div>
                </div>
            </div>`;
    }

    // AI mode user message (metadata.isAI but sender is the user)
    if (isAI && isMe) {
        return `
            <div class="cb-row cb-row-ai-out" style="padding:4px 12px;">
                <div class="msg-col" style="align-items:flex-end;width:100%;">
                    <div class="cb-me">${content}</div>
                    ${timeStr ? `<div class="chat-ts chat-ts-right">${timeStr}</div>` : ''}
                </div>
            </div>`;
    }

    // GUARDIAN AI — distinct bubble, no queen avatar
    const isGuardian = senderEmail === 'guardian' || msg.metadata?.isGuardian === true;
    if (isGuardian) {
        const gHeader = '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="url(#grdG)" stroke-width="2"><defs><linearGradient id="grdG" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ff00ed"/><stop offset="100%" stop-color="#000aff"/></linearGradient></defs><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span style="font-family:Orbitron,sans-serif;font-size:0.3rem;background:linear-gradient(135deg,#ff00ed,#000aff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:2px;">THE GUARDIAN</span></div><div style="font-family:Rajdhani,sans-serif;font-size:0.35rem;color:rgba(255,0,237,0.35);letter-spacing:1px;margin-bottom:6px;">on behalf of Queen Karin</div>';
        return `<div class="cb-row cb-row-queen"><div class="cb-wrap-queen"><div class="cb-guardian">${gHeader}${content}</div>${timeStr ? `<div class="chat-ts chat-ts-left">${timeStr}</div>` : ''}</div></div>`;
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

            // Render the sent message immediately so it doesn't depend on realtime
            const sentRow = data.data;
            if (sentRow) {
                const sentId = _msgId(sentRow);
                if (sentId && !_renderedMsgIds.has(sentId)) {
                    _renderedMsgIds.add(sentId);
                    _lastChatMsgId = sentId;
                    if (sentRow.created_at) _lastChatMsgTimestamp = sentRow.created_at;
                    const html = renderChatMessage(sentRow);
                    ['chatContent', 'mob_chatContent'].forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.insertAdjacentHTML('beforeend', html);
                    });
                    _scrollChatDelayed();
                }
            }

            // Auto-summon Guardian when sub tags @vlad
            if (/@vlad/i.test(msg)) {
                fetch('/api/chat/guardian', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userMessage: msg, memberId, callerRole: 'sub' }),
                }).catch(e => console.warn('[Guardian] auto-summon failed:', e));
            }
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

// ─── AI CHAT MODE ─────────────────────────────────────────────────────────────

let _aiMode = false;
let _aiSending = false;

export function toggleAiMode(on?: boolean) {
    _aiMode = on !== undefined ? on : !_aiMode;
    const overlay = document.getElementById('mobChatOverlay');
    const header = document.getElementById('mobChatAiHeader');
    const queenHeader = document.getElementById('mobChatQueenHeader');
    const aiFooter = document.getElementById('mobChatAiFooter');
    const queenFooter = document.getElementById('mobChatFooterNormal');
    const aiBtn = document.getElementById('mobChatBtnAi');
    const chatBtn = document.getElementById('mobChatBtnChat');
    const chatContent = document.getElementById('mob_chatContent');
    const aiContent = document.getElementById('mob_aiChatContent');
    const ticker = document.getElementById('mob_systemTicker');

    // Close wishlist overlay when switching modes
    const wishlistOv = document.getElementById('mob_TributeOverlay');
    if (wishlistOv) { wishlistOv.style.display = 'none'; wishlistOv.classList.remove('mob-overlay-open'); }

    if (_aiMode) {
        overlay?.classList.add('ai-mode');
        if (header) header.style.display = 'flex';
        if (queenHeader) queenHeader.style.display = 'none';
        aiFooter?.classList.remove('footer-hidden');
        queenFooter?.classList.add('footer-hidden');
        if (aiBtn) aiBtn.classList.add('active');
        if (chatBtn) chatBtn.classList.remove('active');
        // Swap content containers
        if (chatContent) chatContent.style.display = 'none';
        if (aiContent) aiContent.style.display = '';
        if (ticker) ticker.style.display = 'none';
        _showAiChat();
    } else {
        overlay?.classList.remove('ai-mode');
        if (header) header.style.display = 'none';
        if (queenHeader) queenHeader.style.display = 'flex';
        aiFooter?.classList.add('footer-hidden');
        queenFooter?.classList.remove('footer-hidden');
        if (aiBtn) aiBtn.classList.remove('active');
        if (chatBtn) chatBtn.classList.add('active');
        // Swap content containers back
        if (chatContent) chatContent.style.display = '';
        if (aiContent) aiContent.style.display = 'none';
        if (ticker) ticker.style.display = '';
    }
    switchMobChatTab('chat');
}

const AI_TOPICS: { label: string; msg?: string; action?: string }[] = [
    { label: "I'm new, guide me around", action: 'startTour' },
    { label: 'Hierarchy', msg: 'How does the hierarchy system work?' },
    { label: 'Kneeling', msg: 'How does kneeling work?' },
    { label: 'Tasks', msg: 'How do tasks work?' },
    { label: 'Daily Routine', msg: 'How does the daily routine work?' },
    { label: 'Leaderboard', msg: 'How does the leaderboard and rewards work?' },
    { label: 'My Certificate', action: 'openCert' },
    { label: 'Coins & Tributes', msg: 'How do coins and tributes work?' },
    { label: 'Her Wishlist', action: 'openWishlist' },
];

function _aiTopicBtns(): string {
    const tour = AI_TOPICS[0];
    const rest = AI_TOPICS.slice(1);
    return `<div class="ai-topics" style="flex-direction:column;align-items:center;gap:8px;">
        <div style="margin-bottom:24px;">${tour.action
            ? `<button class="ai-topic-btn" style="background:rgba(255,0,237,0.1);border:2px solid rgba(255,0,237,0.5);padding:10px 28px;font-size:0.85rem;" onclick="window._aiAction('${tour.action}')">${tour.label}</button>`
            : `<button class="ai-topic-btn" onclick="window._sendAiTopic('${tour.msg!.replace(/'/g, "\\'")}')">${tour.label}</button>`
        }</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">${rest.map(t =>
            t.action
                ? `<button class="ai-topic-btn" onclick="window._aiAction('${t.action}')">${t.label}</button>`
                : `<button class="ai-topic-btn" onclick="window._sendAiTopic('${t.msg!.replace(/'/g, "\\'")}')">${t.label}</button>`
        ).join('')}</div>
    </div>`;
}

function _aiTopicBtnsNoTour(): string {
    const rest = AI_TOPICS.slice(1);
    return `<div class="ai-topics" style="flex-direction:column;align-items:center;gap:8px;">
        <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">${rest.map(t =>
            t.action
                ? `<button class="ai-topic-btn" onclick="window._aiAction('${t.action}')">${t.label}</button>`
                : `<button class="ai-topic-btn" onclick="window._sendAiTopic('${t.msg!.replace(/'/g, "\\'")}')">${t.label}</button>`
        ).join('')}</div>
    </div>`;
}

const AI_SUBTOPICS: Record<string, { label: string; msg: string }[]> = {
    hierarchy: [
        { label: 'My next rank', msg: 'What do I need to reach the next rank?' },
        { label: 'My benefits', msg: 'What benefits does my current rank give me?' },
        { label: 'What I unlock next', msg: 'What do I unlock when I rank up?' },
        { label: 'How far am I', msg: 'How close am I to ranking up based on my stats?' },
    ],
    kneeling: [
        { label: 'How to kneel', msg: 'Walk me through how to do a kneeling session step by step' },
        { label: 'Rewards', msg: 'What rewards do I get from kneeling?' },
        { label: 'Daily goal', msg: 'What is the daily kneeling goal and max?' },
        { label: 'Cooldown', msg: 'How does the kneeling cooldown work?' },
    ],
    tasks: [
        { label: 'Task types', msg: 'What kinds of tasks are there?' },
        { label: 'How to submit', msg: 'How do I submit proof for a task?' },
        { label: 'Rewards & penalties', msg: 'How many points do I earn from tasks and what happens if I skip or get rejected?' },
        { label: 'Higher ranks', msg: 'How do tasks change as I rank up?' },
    ],
    routine: [
        { label: 'Upload window', msg: 'When exactly can I upload my daily routine proof?' },
        { label: 'Streaks', msg: 'How do streaks work and why do they matter?' },
        { label: 'What to upload', msg: 'What kind of proof do I need for daily routine?' },
    ],
    coins: [
        { label: 'How to earn', msg: 'What are all the ways I can earn coins?' },
        { label: 'Tributes', msg: 'How do tributes work and what do they count toward?' },
        { label: 'Chat costs', msg: 'How much does it cost to chat at each rank?' },
    ],
    leaderboard: [
        { label: 'How scoring works', msg: 'How does the leaderboard scoring work?' },
        { label: 'Rewards', msg: 'What rewards does the leaderboard champion get?' },
        { label: 'When does it reset', msg: 'When do the leaderboard scores reset?' },
        { label: 'Inventory items', msg: 'What are Skip Pass, Cum Pass, and Checkpoint?' },
    ],
    merit: [
        { label: 'How to earn merit', msg: 'What are all the ways I can earn merit points?' },
        { label: 'Merit for ranking', msg: 'How much merit do I need for each rank?' },
    ],
    wishlist: [
        { label: 'What is it', msg: 'What is the wishlist and how does it work?' },
        { label: 'How to contribute', msg: 'How do I contribute to something on Her wishlist?' },
        { label: 'Crowdfund goals', msg: 'How do crowdfund goals work on the wishlist?' },
        { label: 'Does it help me rank', msg: 'Does contributing to the wishlist count toward my rank?' },
    ],
    general: [
        { label: 'What is this app', msg: 'What is this app and why does it exist?' },
        { label: 'Who is Queen Karin', msg: 'Tell me about Queen Karin' },
        { label: 'How to start', msg: 'I am new here, what should I do first?' },
    ],
};

let _lastAiTopic = 'general';

function _detectTopic(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes('hierarch') || m.includes('rank') || m.includes('promot')) return 'hierarchy';
    if (m.includes('kneel') || m.includes('worship')) return 'kneeling';
    if (m.includes('task') || m.includes('assign') || m.includes('proof')) return 'tasks';
    if (m.includes('routine') || m.includes('streak') || m.includes('daily')) return 'routine';
    if (m.includes('coin') || m.includes('tribute') || m.includes('buy') || m.includes('purchase')) return 'coins';
    if (m.includes('leaderboard') || m.includes('champion') || m.includes('reward') || m.includes('skip pass') || m.includes('cum pass') || m.includes('checkpoint') || m.includes('inventory')) return 'leaderboard';
    if (m.includes('wishlist') || m.includes('gift') || m.includes('want') || m.includes('help her')) return 'wishlist';
    if (m.includes('merit') || m.includes('point') || m.includes('progress')) return 'merit';
    return 'general';
}

function _aiFollowUpBtns(userMsg: string): string {
    _lastAiTopic = _detectTopic(userMsg);
    const subs = AI_SUBTOPICS[_lastAiTopic] || AI_SUBTOPICS.general;

    const subBtns = subs.map(s =>
        `<button class="ai-topic-btn ai-followup-btn" onclick="window._sendAiTopic('${s.msg.replace(/'/g, "\\'")}')">${s.label}</button>`
    ).join('');

    const switchBtns = AI_TOPICS.filter(t => t.msg && _detectTopic(t.msg) !== _lastAiTopic).slice(0, 4).map(t =>
        `<button class="ai-topic-btn ai-followup-btn ai-switch-btn" onclick="window._sendAiTopic('${t.msg!.replace(/'/g, "\\'")}')">${t.label}</button>`
    ).join('');

    return `<div class="ai-followup">
        <div class="ai-followup-btns">
            ${subBtns}
            <button class="ai-topic-btn ai-followup-btn ai-change-topic-btn" onclick="window._aiToggleSwitch(this)">Change topic</button>
            <button class="ai-topic-btn ai-followup-btn ai-chat-free" onclick="window._aiJustChat()">Just chat</button>
        </div>
        <div class="ai-switch-panel" style="display:none;">
            <div class="ai-followup-btns">${switchBtns}</div>
        </div>
    </div>`;
}

function _showAiChat() {
    const content = document.getElementById('mob_aiChatContent');
    const deskContent = document.getElementById('chatContent');
    if (!content) return;

    const existingAiMsgs = content.querySelectorAll('.cb-row-ai-in, .cb-row-ai-out');
    if (existingAiMsgs.length === 0 && !content.querySelector('.ai-welcome')) {
        const welcomeHtml = `
            <div class="ai-welcome" style="text-align:center;padding:12px 0;">
                <div style="display:flex;align-items:center;gap:20px;padding:18px 24px;border:1px solid rgba(255,0,237,0.2);border-radius:14px;background:rgba(0,0,0,0.4);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);margin-bottom:10px;width:100%;">
                    <img src="/vlad-avatar.png" alt="Vlad" style="width:68px;height:68px;border-radius:50%;object-fit:cover;object-position:center 20%;border:2px solid rgba(255,0,237,0.3);box-shadow:0 0 20px rgba(255,0,237,0.15);" />
                    <div style="text-align:left;">
                        <div style="font-size:1.4rem;color:rgba(255,0,237,0.85);letter-spacing:3px;"><span style="font-family:Rajdhani,sans-serif;">@</span><span style="font-family:Cinzel,serif;">VLAD</span></div>
                        <div style="font-family:Cinzel,serif;font-size:0.48rem;color:rgba(160,100,255,0.5);letter-spacing:2px;margin-top:4px;">AI ASSISTANT</div>
                    </div>
                </div>
                <div style="margin:28px 0 32px;">
                    <button class="ai-topic-btn" style="background:rgba(255,0,237,0.1);border:2px solid rgba(255,0,237,0.5);padding:10px 28px;font-size:0.85rem;" onclick="window._aiAction('startTour')">I'm new, guide me around</button>
                </div>
                <div style="font-family:Rajdhani,sans-serif;font-size:1rem;color:rgba(255,255,255,0.5);line-height:1.6;max-width:300px;margin:0 auto 32px;">
                    Hey, I'm Vlad. Pick a topic or ask me anything.
                </div>
                ${_aiTopicBtnsNoTour()}
            </div>`;
        content.innerHTML = welcomeHtml;
        if (deskContent) deskContent.innerHTML = welcomeHtml;
    }
}

// Handle action buttons (open modals, overlays, etc.)
function _aiAction(action: string) {
    if (action === 'openCert') {
        (window as any).showCertificate?.();
    } else if (action === 'openWishlist') {
        (window as any)._tributeShowWishlist?.();
    } else if (action === 'startTour') {
        // Fade out the mobile chat overlay smoothly, then start tour
        const chatOverlay = document.getElementById('mobChatOverlay');
        if (chatOverlay) {
            chatOverlay.style.transition = 'opacity 0.4s ease';
            chatOverlay.style.opacity = '0';
            setTimeout(() => {
                chatOverlay.style.display = 'none';
                chatOverlay.style.opacity = '';
                chatOverlay.style.transition = '';
            }, 400);
        }
        const deskAi = document.getElementById('mob_aiChatContent');
        if (deskAi) deskAi.style.display = 'none';
        setTimeout(() => {
            (window as any).startProfileTour?.();
        }, 450);
    }
}

// Toggle the switch-topic panel
function _aiToggleSwitch(btn: HTMLElement) {
    const panel = btn.closest('.ai-followup')?.querySelector('.ai-switch-panel') as HTMLElement;
    if (!panel) return;
    const visible = panel.style.display !== 'none';
    panel.style.display = visible ? 'none' : '';
    _scrollChatDelayed();
}

// Hide follow-up buttons, show small "Topics" return button
function _aiJustChat() {
    const content = document.getElementById('mob_aiChatContent');
    content?.querySelectorAll('.ai-followup').forEach(el => el.remove());
    if (content) {
        content.insertAdjacentHTML('beforeend',
            `<div class="ai-topics-return"><button class="ai-topic-btn ai-return-btn" onclick="window._aiShowTopics()">Topics</button></div>`
        );
    }
    document.getElementById('mob_aiMsgInput')?.focus();
    _scrollChatDelayed();
}

// Bring back full topic buttons
function _aiShowTopics() {
    const content = document.getElementById('mob_aiChatContent');
    content?.querySelectorAll('.ai-topics-return').forEach(el => el.remove());
    if (content) content.insertAdjacentHTML('beforeend', `<div class="ai-followup"><div class="ai-followup-btns">${
        AI_TOPICS.map(t =>
            t.action
                ? `<button class="ai-topic-btn ai-followup-btn" onclick="window._aiAction('${t.action}')">${t.label}</button>`
                : `<button class="ai-topic-btn ai-followup-btn" onclick="window._sendAiTopic('${t.msg!.replace(/'/g, "\\'")}')">${t.label}</button>`
        ).join('')
    }</div></div>`);
    _scrollChatDelayed();
}

let _aiFromTopicBtn = false;

// Send a topic button message as if the user typed it
export function _sendAiTopic(msg: string) {
    const input = document.getElementById('mob_aiMsgInput') as HTMLInputElement;
    if (input) {
        _aiFromTopicBtn = true;
        input.value = msg;
        sendAiMessage();
    }
}

if (typeof window !== 'undefined') {
    (window as any)._sendAiTopic = _sendAiTopic;
    (window as any)._aiAction = _aiAction;
    (window as any)._aiJustChat = _aiJustChat;
    (window as any)._aiShowTopics = _aiShowTopics;
    (window as any)._aiToggleSwitch = _aiToggleSwitch;
}

export async function sendAiMessage() {
    if (_aiSending) return;
    const { memberId } = getState();
    const inputMob = document.getElementById('mob_aiMsgInput') as HTMLInputElement;
    const msg = (inputMob?.value || '').trim();

    if (!msg || !memberId) return;

    _aiSending = true;
    if (inputMob) inputMob.value = '';

    // Disable send button
    const sendBtn = document.getElementById('mobAiSendBtn') as HTMLButtonElement;
    if (sendBtn) sendBtn.disabled = true;

    const content = document.getElementById('mob_aiChatContent');

    // Remove welcome message, follow-up buttons, and topics-return button
    content?.querySelector('.ai-welcome')?.remove();
    content?.querySelectorAll('.ai-followup').forEach(el => el.remove());
    content?.querySelectorAll('.ai-topics-return').forEach(el => el.remove());

    // Render user message immediately
    const userHtml = _renderAiMsg(msg, true);
    if (content) content.insertAdjacentHTML('beforeend', userHtml);
    _scrollChatDelayed();

    // Show typing indicator
    const typingHtml = `<div id="aiTyping" class="cb-row cb-row-ai-in" style="padding:3px 4px;">
        <div style="display:flex;align-items:center;gap:4px;">
            <div class="ai-avatar-sm"></div>
            <div class="cb-ai" style="padding:8px 14px;"><span class="ai-typing-dots"><span>.</span><span>.</span><span>.</span></span></div>
        </div>
    </div>`;
    if (content) content.insertAdjacentHTML('beforeend', typingHtml);
    _scrollChatDelayed();

    // Collect recent AI conversation for context
    const aiMsgs: { sender: string; text: string }[] = [];
    content?.querySelectorAll('.cb-row-ai-out, .cb-row-ai-in').forEach(row => {
        const bubble = row.querySelector('.cb-me, .cb-ai');
        if (bubble) {
            const isUser = row.classList.contains('cb-row-ai-out');
            aiMsgs.push({ sender: isUser ? 'user' : 'ai', text: bubble.textContent || '' });
        }
    });

    try {
        const res = await fetch('/api/ai-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: msg,
                memberId,
                conversationHistory: aiMsgs.slice(-20),
            }),
        });
        const data = await res.json();

        // Remove typing indicator
        document.getElementById('aiTyping')?.remove();

        // Remove previous follow-up buttons
        content?.querySelectorAll('.ai-followup').forEach(el => el.remove());

        if (data.success && data.reply) {
            const aiHtml = _renderAiMsg(data.reply, false);
            if (content) content.insertAdjacentHTML('beforeend', aiHtml);
        } else {
            const errHtml = _renderAiMsg(data.error || 'Sorry, something went wrong. Try again.', false);
            if (content) content.insertAdjacentHTML('beforeend', errHtml);
        }

        // Show full follow-ups for topic buttons, just small Topics button for typed messages
        if (_aiFromTopicBtn) {
            if (content) content.insertAdjacentHTML('beforeend', _aiFollowUpBtns(msg));
        } else {
            if (content) content.insertAdjacentHTML('beforeend',
                `<div class="ai-topics-return"><button class="ai-topic-btn ai-return-btn" onclick="window._aiShowTopics()">Topics</button></div>`);
        }
        _aiFromTopicBtn = false;
        _scrollChatDelayed();
    } catch (err) {
        document.getElementById('aiTyping')?.remove();
        const errHtml = _renderAiMsg('Connection error. Please try again.', false);
        if (content) content.insertAdjacentHTML('beforeend', errHtml);
        _scrollChatDelayed();
    } finally {
        _aiSending = false;
        if (sendBtn) sendBtn.disabled = false;
    }
}

export function handleAiChatKey(e: any) {
    if (e.key === 'Enter') sendAiMessage();
}

function _renderAiMsg(text: string, isUser: boolean): string {
    if (isUser) {
        return `<div class="cb-row cb-row-ai-out" style="padding:3px 6px;">
            <div class="msg-col" style="align-items:flex-end;width:100%;">
                <div class="cb-me">${text.replace(/\n/g, '<br>')}</div>
            </div>
        </div>`;
    }
    return `<div class="cb-row cb-row-ai-in" style="padding:3px 4px;">
        <div style="display:flex;align-items:flex-start;gap:4px;max-width:95%;">
            <div class="ai-avatar-sm" style="margin-top:3px;"></div>
            <div class="msg-col" style="align-items:flex-start;">
                <div class="cb-ai">${text.replace(/\n/g, '<br>')}</div>
            </div>
        </div>
    </div>`;
}

// ─── INVENTORY ────────────────────────────────────────────────────────────────

const CUMPASS_PRICES: Record<string, number> = {
    'hall boy': 500, 'footman': 750, 'silverman': 1000, 'butler': 1500,
    'chamberlain': 2500, 'secretary': 4000, "queen's champion": 5000,
};
const CHECKPOINT_PRICES: Record<string, number> = {
    'footman': 2000, 'silverman': 4000, 'butler': 8000,
    'chamberlain': 16000, 'secretary': 32000, "queen's champion": 64000,
};

function _getInvPrice(item: string, rank: string): number | null {
    const r = rank.toLowerCase();
    if (item === 'cumpass') return CUMPASS_PRICES[r] ?? null;
    if (item === 'checkpoint') return CHECKPOINT_PRICES[r] ?? null;
    return null;
}

const INV_INFO: Record<string, { icon: string; title: string; desc: string }> = {
    cumpass: { icon: '\u2665', title: 'CUM PASS', desc: 'Permission granted. Use it wisely.' },
    checkpoint: { icon: '\u2611', title: 'CHECKPOINT', desc: 'Save your daily routine streak. Emergency use only.' },
    skippass: { icon: '\u26D3', title: 'SKIP PASS', desc: 'Skip a task without penalty. Gifted by Queen Karin.' },
};

export function openInventoryModal(item: string) {
    const modal = document.getElementById('inventoryModal');
    if (!modal) return;

    const state = getState();
    const rank = (state.rank || 'Hall Boy').toLowerCase();
    const raw = state.raw || {};
    const count = Number(raw[item] || 0);
    const price = _getInvPrice(item, rank);
    const info = INV_INFO[item];
    if (!info) return;

    const iconEl = document.getElementById('invModalIcon');
    const titleEl = document.getElementById('invModalTitle');
    const descEl = document.getElementById('invModalDesc');
    const countEl = document.getElementById('invModalCount');
    const actionsEl = document.getElementById('invModalActions');
    if (iconEl) iconEl.textContent = info.icon;
    if (titleEl) titleEl.textContent = info.title;
    if (descEl) descEl.textContent = info.desc;
    if (countEl) countEl.textContent = `YOU OWN: ${count}`;

    let html = '';
    if (count > 0) {
        html += `<button onclick="window.useInventoryItem('${item}')" style="width:100%;padding:14px;border-radius:10px;background:linear-gradient(90deg,rgba(197,160,89,0.15),rgba(197,160,89,0.08));border:1px solid rgba(197,160,89,0.35);color:#c5a059;font-family:'Cinzel',serif;font-size:0.8rem;letter-spacing:2px;cursor:pointer;">USE NOW</button>`;
    }
    if (item === 'skippass') {
        html += `<div style="font-family:Rajdhani,sans-serif;font-size:0.75rem;color:rgba(255,255,255,0.3);text-align:center;padding:8px 0;">Gift only — awarded by Queen Karin</div>`;
    } else if (price !== null) {
        html += `<button onclick="window.buyInventoryItem('${item}')" style="width:100%;padding:14px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.6);font-family:'Orbitron',sans-serif;font-size:0.6rem;letter-spacing:2px;cursor:pointer;">BUY FOR ${price!.toLocaleString()} COINS</button>`;
    } else if (item === 'checkpoint') {
        html += `<div style="font-family:Rajdhani,sans-serif;font-size:0.75rem;color:rgba(255,255,255,0.3);text-align:center;padding:8px 0;">Available from Footman rank</div>`;
    }
    if (actionsEl) actionsEl.innerHTML = html;

    modal.style.display = 'flex';
}

export function closeInventoryModal() {
    const modal = document.getElementById('inventoryModal');
    if (modal) modal.style.display = 'none';
}

function _updateInvUI(item: string, count: number) {
    const idMap: Record<string, string> = { skippass: 'invSkipCount', cumpass: 'invCumCount', checkpoint: 'invCheckCount' };
    const el = document.getElementById(idMap[item]);
    if (el) el.textContent = String(count);
}

export async function buyInventoryItem(item: string) {
    const state = getState();
    const price = _getInvPrice(item, state.rank || 'Hall Boy');
    if (price === null) return;
    if (state.wallet < price) {
        alert('Insufficient coins.');
        return;
    }

    try {
        const res = await fetch('/api/inventory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'buy', item }),
        });
        const data = await res.json();
        if (data.success) {
            setState({ wallet: data.newWallet });
            if (state.raw) state.raw[item] = data.newCount;
            if (state.raw) state.raw.wallet = data.newWallet;
            ['coins', 'mobCoins', 'walletDisplay', 'mob_walletVal'].forEach(id => {
                const e = document.getElementById(id);
                if (e) e.textContent = data.newWallet.toLocaleString();
            });
            _updateInvUI(item, data.newCount);
            closeInventoryModal();
            openInventoryModal(item);
        } else {
            alert(data.error || 'Purchase failed.');
        }
    } catch {
        alert('Connection error.');
    }
}

export async function useInventoryItem(item: string) {
    const state = getState();
    const raw = state.raw || {};
    const count = Number(raw[item] || 0);
    if (count <= 0) return;

    try {
        const res = await fetch('/api/inventory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'use', item }),
        });
        const data = await res.json();
        if (data.success) {
            if (state.raw) state.raw[item] = data.newCount;
            _updateInvUI(item, data.newCount);
            closeInventoryModal();
            // Show confirmation
            if (item === 'cumpass') {
                _showInvConfirmation('Permission Granted.', "Don't waste it.");
            } else if (item === 'checkpoint') {
                _showInvConfirmation('Streak Saved.', 'Your routine is marked for today.');
            } else if (item === 'skippass') {
                _showInvConfirmation('Task Skipped.', 'No penalty applied.');
            }
        } else {
            alert(data.error || 'Failed to use item.');
        }
    } catch {
        alert('Connection error.');
    }
}

export async function useSkipPass() {
    const { id, memberId } = getState();
    const pid = memberId || id;
    if (!pid) return;

    const raw = getState().raw || {};
    const skipCount = Number(raw.skippass || 0);
    if (skipCount <= 0) return;

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
    if (readyText) { readyText.innerHTML = 'USING SKIP PASS...'; readyText.style.color = '#c5a059'; readyText.style.opacity = '1'; }
    if (mobTaskText) { mobTaskText.innerHTML = 'USING SKIP PASS...'; mobTaskText.style.color = '#c5a059'; mobTaskText.style.opacity = '1'; }

    try {
        const res = await fetch('/api/tasks/skip', {
            method: 'POST',
            body: JSON.stringify({ memberId: pid, useSkipPass: true })
        });
        const data = await res.json();

        if (data.success) {
            if (raw) raw.skippass = skipCount - 1;
            _updateInvUI('skippass', skipCount - 1);
            renderProfileSidebar(getState().raw || getState());
            if (taskInterval) clearInterval(taskInterval);
            showTaskFeedback('Skip Pass used. No penalty this time.', '#c5a059');
            loadChatHistory(pid);
        } else {
            cancelSkipTask();
        }
    } catch (err) {
        console.error('Error using skip pass', err);
        cancelSkipTask();
    }
}

function _showCheckpointWarning() {
    const raw = getState().raw || {};
    const cpCount = Number(raw.checkpoint || 0);
    if (cpCount <= 0) return;

    const rank = (getState().rank || 'Hall Boy').toLowerCase();
    const price = CHECKPOINT_PRICES[rank];
    const priceNote = price ? `Buying another costs ${price.toLocaleString()} coins.` : '';

    const overlay = document.createElement('div');
    overlay.id = 'checkpointWarning';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML = `
        <div style="max-width:320px;width:100%;background:rgba(10,5,20,0.95);border:1px solid rgba(255,68,68,0.3);border-radius:16px;padding:30px 24px;text-align:center;">
            <div style="font-size:2rem;margin-bottom:8px;">\u26A0</div>
            <div style="font-family:'Cinzel',serif;font-size:1rem;color:#ff4444;letter-spacing:3px;margin-bottom:8px;">STREAK AT RISK</div>
            <div style="font-family:'Rajdhani',sans-serif;font-size:0.85rem;color:rgba(255,255,255,0.6);line-height:1.5;margin-bottom:6px;">
                You missed your routine window. Your streak will reset to 0.
            </div>
            <div style="font-family:'Rajdhani',sans-serif;font-size:0.8rem;color:rgba(197,160,89,0.7);margin-bottom:20px;">
                You have <strong style="color:#c5a059;">${cpCount}</strong> checkpoint${cpCount > 1 ? 's' : ''} left. ${priceNote}
            </div>
            <button onclick="window._confirmCheckpoint()" style="width:100%;padding:14px;border-radius:10px;background:linear-gradient(90deg,rgba(197,160,89,0.2),rgba(197,160,89,0.1));border:1px solid rgba(197,160,89,0.4);color:#c5a059;font-family:'Cinzel',serif;font-size:0.85rem;letter-spacing:2px;cursor:pointer;margin-bottom:10px;">USE CHECKPOINT</button>
            <button onclick="document.getElementById('checkpointWarning')?.remove()" style="width:100%;padding:10px;background:none;border:none;color:rgba(255,255,255,0.35);font-family:'Orbitron',sans-serif;font-size:0.55rem;letter-spacing:2px;cursor:pointer;">LET IT BREAK</button>
        </div>
    `;
    document.body.appendChild(overlay);
}

export async function _confirmCheckpoint() {
    document.getElementById('checkpointWarning')?.remove();

    try {
        const res = await fetch('/api/inventory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'use', item: 'checkpoint' }),
        });
        const data = await res.json();
        if (data.success) {
            const raw = getState().raw || {};
            raw.checkpoint = data.newCount;
            _updateInvUI('checkpoint', data.newCount);

            // Mark routine as done for today via API
            const { memberId, id } = getState();
            const userId = memberId || id;
            if (userId) {
                await fetch('/api/routine-checkpoint', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ memberId: userId }),
                });
            }

            _showInvConfirmation('Streak Saved.', 'Your routine is marked for today.');
            setTimeout(() => updateRoutineWidget(), 1500);
        } else {
            alert(data.error || 'Failed to use checkpoint.');
        }
    } catch {
        alert('Connection error.');
    }
}

function _showInvConfirmation(title: string, sub: string) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;';
    overlay.innerHTML = `
        <div style="font-family:'Cinzel',serif;font-size:1.3rem;color:#c5a059;letter-spacing:4px;text-align:center;">${title}</div>
        <div style="font-family:'Rajdhani',sans-serif;font-size:0.9rem;color:rgba(255,255,255,0.5);text-align:center;">${sub}</div>
    `;
    overlay.addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
    setTimeout(() => overlay.remove(), 2500);
}

// ─── THE VAULT ─────────────────────────────────────────────────────────────────

async function loadVault() {
    const grid = document.getElementById('vaultGrid');
    if (!grid) return;

    const { memberId, id } = getState();
    const userId = memberId || id;
    if (!userId) return;

    try {
        const res = await fetch(`/api/vault?memberId=${encodeURIComponent(userId)}`);
        const { items } = await res.json();

        if (!items || items.length === 0) {
            grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;font-family:Rajdhani,sans-serif;font-size:0.8rem;color:rgba(255,255,255,0.15);padding:30px 0;">No items yet</div>`;
            return;
        }

        grid.innerHTML = items.map((item: any) => `
            <div onclick="${item.unlocked ? `window._openVaultPreview('${item.id}')` : ''}" style="position:relative;aspect-ratio:1;border-radius:10px;overflow:hidden;border:1px solid ${item.unlocked ? 'rgba(197,160,89,0.35)' : 'rgba(255,255,255,0.06)'};cursor:${item.unlocked ? 'pointer' : 'default'};background:#0a0703;">
                <img src="${item.thumbnail_url || item.media_url || ''}" style="width:100%;height:100%;object-fit:cover;display:block;${item.unlocked ? '' : 'filter:blur(12px) brightness(0.25);'}" onerror="this.style.display='none'" />
                ${item.unlocked ? '' : `
                    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </div>`}
                ${item.unlocked ? `
                    <div style="position:absolute;bottom:0;left:0;right:0;padding:6px 8px;background:linear-gradient(transparent,rgba(0,0,0,0.85));">
                        <div style="font-family:Cinzel,serif;font-size:0.5rem;color:rgba(197,160,89,0.7);letter-spacing:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.title || ''}</div>
                    </div>` : ''}
            </div>
        `).join('');

        // Store items for preview
        (window as any).__vaultItems = items;
    } catch {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;font-family:Rajdhani,sans-serif;font-size:0.8rem;color:rgba(255,100,100,0.4);padding:20px 0;">Failed to load</div>`;
    }
}

function _openVaultPreview(itemId: string) {
    const items = (window as any).__vaultItems || [];
    const item = items.find((i: any) => i.id === itemId);
    if (!item || !item.unlocked) return;

    const modal = document.getElementById('vaultPreviewModal');
    const content = document.getElementById('vaultPreviewContent');
    if (!modal || !content) return;

    const isVideo = item.type === 'video';
    const mediaHtml = isVideo
        ? `<video src="${item.media_url}" controls playsinline style="width:100%;max-height:70vh;border-radius:12px;border:1px solid rgba(197,160,89,0.25);"></video>`
        : `<img src="${item.media_url}" style="width:100%;max-height:70vh;object-fit:contain;border-radius:12px;border:1px solid rgba(197,160,89,0.25);" />`;

    content.innerHTML = `
        ${mediaHtml}
        <div style="font-family:Cinzel,serif;font-size:0.8rem;color:rgba(197,160,89,0.6);letter-spacing:2px;margin-top:14px;">${item.title || 'Exclusive'}</div>
    `;

    modal.style.display = 'flex';
}

if (typeof window !== 'undefined') {
    (window as any)._openVaultPreview = _openVaultPreview;
}

// ─── VAULT LOCK REQUEST ────────────────────────────────────────────────────────

const LOCK_TIERS = [
    { key: '7',   days: 7,   coins: 5500,  eur: 55,   label: '7 DAYS' },
    { key: '14',  days: 14,  coins: 10000, eur: 100,  label: '14 DAYS' },
    { key: '30',  days: 30,  coins: 15000, eur: 150,  label: '1 MONTH' },
    { key: '90',  days: 90,  coins: 30000, eur: 300,  label: '90 DAYS' },
    { key: '365', days: 365, coins: 66600, eur: 666,  label: '365 DAYS' },
];

export async function openVaultLockRequest() {
    // First check if there's already an active/pending lock
    try {
        const res = await fetch('/api/vault/apply');
        const data = await res.json();
        if (data.active) {
            if (data.status === 'awaiting_video') {
                _showVideoProofUpload({ sessionId: data.sessionId, lockDays: data.lockDays });
            } else {
                _showVaultStatus(data);
            }
            return;
        }
    } catch (_) {}

    const { wallet } = getState();

    // Inject styles — hidden scrollbars + date picker
    if (!document.getElementById('_vaultLockStyles')) {
        const style = document.createElement('style');
        style.id = '_vaultLockStyles';
        style.textContent = `
            @keyframes _vFadeIn{from{opacity:0}to{opacity:1}}
            #_vaultLockOverlay,#_vaultVideoOverlay,#_vaultLockOverlay *,#_vaultVideoOverlay *{scrollbar-width:none !important;-ms-overflow-style:none !important;}
            #_vaultLockOverlay::-webkit-scrollbar,#_vaultVideoOverlay::-webkit-scrollbar,#_vaultLockOverlay *::-webkit-scrollbar,#_vaultVideoOverlay *::-webkit-scrollbar{display:none !important;}
            #_vaultDateInput::-webkit-calendar-picker-indicator{filter:invert(0.25) sepia(1) hue-rotate(-30deg);cursor:pointer;}
        `;
        document.head.appendChild(style);
    }

    const ov = document.createElement('div');
    ov.id = '_vaultLockOverlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10000001;display:flex;flex-direction:column;align-items:center;background:#080507;animation:_vFadeIn 0.3s ease;overflow-x:hidden;overflow-y:auto;-webkit-overflow-scrolling:touch;';

    const canAffordAny = wallet >= 5500;

    ov.innerHTML = `
        <div style="width:100%;max-width:380px;padding:60px 28px 50px;text-align:center;margin:0 auto;">
            <div style="font-family:Rajdhani,sans-serif;font-size:0.8rem;color:rgba(255,255,255,0.4);letter-spacing:5px;margin-bottom:6px;">KEYHOLDER</div>
            <div style="font-family:Cinzel,serif;font-size:1.5rem;color:rgba(255,255,255,0.75);letter-spacing:5px;font-weight:700;">REQUEST</div>
            <div style="width:30px;height:1px;background:rgba(255,255,255,0.12);margin:20px auto 28px;"></div>

            <div id="_vaultTierPicker" style="display:flex;flex-direction:column;gap:10px;margin-bottom:24px;">
                ${LOCK_TIERS.map((t, i) => {
                    const canAfford = wallet >= t.coins;
                    const selected = i === 0 && canAfford;
                    return `
                    <div class="_vaultTierCard" data-tier="${t.key}" style="padding:18px 20px;border-radius:10px;border:1px solid ${selected ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'};background:${selected ? 'rgba(255,255,255,0.04)' : 'transparent'};cursor:${canAfford ? 'pointer' : 'default'};opacity:${canAfford ? '1' : '0.3'};display:flex;align-items:center;justify-content:space-between;transition:all 0.2s;" ${canAfford ? `onclick="document.querySelectorAll('._vaultTierCard').forEach(c=>{c.style.borderColor='rgba(255,255,255,0.06)';c.style.background='transparent';});this.style.borderColor='rgba(255,255,255,0.15)';this.style.background='rgba(255,255,255,0.04)';window._vaultSelectedTier='${t.key}';"` : ''}>
                        <div>
                            <div style="font-family:Cinzel,serif;font-size:1.05rem;color:rgba(255,255,255,${canAfford ? '0.8' : '0.3'});font-weight:600;letter-spacing:2px;">${t.label}</div>
                            <div style="font-family:Rajdhani,sans-serif;font-size:0.8rem;color:rgba(255,255,255,0.3);margin-top:2px;">${t.eur}€</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-family:Orbitron,sans-serif;font-size:1rem;color:rgba(255,255,255,${canAfford ? '0.6' : '0.2'});font-weight:600;">${t.coins.toLocaleString()}</div>
                            <div style="font-family:Rajdhani,sans-serif;font-size:0.7rem;color:rgba(255,255,255,0.3);letter-spacing:2px;">COINS</div>
                        </div>
                    </div>`;
                }).join('')}
            </div>

            <div style="font-family:Rajdhani,sans-serif;font-size:0.85rem;color:rgba(255,255,255,0.35);letter-spacing:1px;margin-bottom:${canAffordAny ? '0' : '10'}px;">WALLET: <span style="color:rgba(255,255,255,0.55);font-weight:600;">${wallet.toLocaleString()}</span></div>
            ${!canAffordAny ? '<button id="_vaultBoostWallet" style="margin-top:8px;padding:12px 28px;border-radius:8px;background:rgba(197,160,89,0.08);border:1px solid rgba(197,160,89,0.2);color:rgba(197,160,89,0.65);font-family:Rajdhani,sans-serif;font-size:0.85rem;letter-spacing:2px;cursor:pointer;font-weight:600;">BOOST WALLET</button>' : ''}

            <div style="width:100%;height:1px;background:rgba(255,255,255,0.06);margin:24px 0;"></div>

            <div style="display:flex;flex-direction:column;gap:10px;">
                <button id="_vaultLockNow" style="width:100%;padding:22px;border-radius:10px;background:rgba(139,0,0,0.12);border:1px solid rgba(139,0,0,0.25);color:rgba(200,50,50,0.85);font-family:Cinzel,serif;font-size:1rem;letter-spacing:3px;cursor:pointer;font-weight:700;">LOCK ME NOW</button>
                <button id="_vaultWaitQueen" style="width:100%;padding:14px;border-radius:10px;background:transparent;border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.35);font-family:Rajdhani,sans-serif;font-size:0.8rem;letter-spacing:3px;cursor:pointer;">WAIT FOR QUEEN KARIN</button>
            </div>

            <div id="_vaultDatePicker" style="display:none;margin-top:18px;">
                <div style="font-family:Rajdhani,sans-serif;font-size:0.85rem;color:rgba(255,255,255,0.4);margin-bottom:10px;letter-spacing:1px;">When should your sentence begin?</div>
                <input id="_vaultDateInput" type="datetime-local" style="width:100%;padding:14px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.6);font-family:Cinzel,serif;font-size:0.9rem;outline:none;box-sizing:border-box;text-align:center;letter-spacing:1px;" />
                <button id="_vaultSubmitDate" style="width:100%;margin-top:12px;padding:16px;border-radius:10px;background:rgba(139,0,0,0.1);border:1px solid rgba(139,0,0,0.22);color:rgba(200,50,50,0.8);font-family:Cinzel,serif;font-size:0.85rem;letter-spacing:3px;cursor:pointer;font-weight:600;">SUBMIT REQUEST</button>
            </div>

            <button id="_vaultLockClose" style="margin-top:32px;background:none;border:none;color:rgba(255,255,255,0.25);font-family:Rajdhani,sans-serif;font-size:0.8rem;letter-spacing:3px;cursor:pointer;">CANCEL</button>
        </div>
    `;

    document.body.appendChild(ov);
    // Default to first affordable tier
    const firstAffordable = LOCK_TIERS.find(t => wallet >= t.coins);
    (window as any)._vaultSelectedTier = firstAffordable?.key || '7';

    // Close
    ov.querySelector('#_vaultLockClose')!.addEventListener('click', () => _closeVaultOverlay());
    ov.addEventListener('click', (e) => { if (e.target === ov) _closeVaultOverlay(); });

    // Boost wallet — scroll to shop
    const boostBtn = ov.querySelector('#_vaultBoostWallet');
    if (boostBtn) boostBtn.addEventListener('click', () => { _closeVaultOverlay(); document.getElementById('shopSection')?.scrollIntoView({ behavior: 'smooth' }); });

    // Lock Now (instant)
    ov.querySelector('#_vaultLockNow')!.addEventListener('click', () => _submitVaultLock('apply-instant'));

    // Wait for Queen — show date picker
    ov.querySelector('#_vaultWaitQueen')!.addEventListener('click', () => {
        const dp = ov.querySelector('#_vaultDatePicker') as HTMLElement;
        if (dp) {
            dp.style.display = 'block';
            // Set default to tomorrow 9am
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(9, 0, 0, 0);
            const inp = ov.querySelector('#_vaultDateInput') as HTMLInputElement;
            if (inp) inp.value = tomorrow.toISOString().slice(0, 16);
        }
    });

    // Submit date request
    ov.querySelector('#_vaultSubmitDate')!.addEventListener('click', () => {
        const inp = ov.querySelector('#_vaultDateInput') as HTMLInputElement;
        const requestedStart = inp?.value ? new Date(inp.value).toISOString() : null;
        _submitVaultLock('apply', requestedStart);
    });
}

function _closeVaultOverlay() {
    const ov = document.getElementById('_vaultLockOverlay');
    if (ov) { ov.style.opacity = '0'; ov.style.transition = 'opacity 0.2s'; setTimeout(() => ov.remove(), 200); }
}
if (typeof window !== 'undefined') (window as any).closeVaultLockOverlay = _closeVaultOverlay;

async function _submitVaultLock(action: string, requestedStart?: string | null) {
    const tier = (window as any)._vaultSelectedTier || '7';
    const tierData = LOCK_TIERS.find(t => t.key === tier);
    if (!tierData) return;

    const { wallet } = getState();
    if (wallet < tierData.coins) {
        const ov = document.getElementById('_vaultLockOverlay');
        if (ov) ov.remove();
        // Show poverty overlay
        const pov = document.getElementById('povertyOverlay');
        if (pov) { pov.classList.remove('hidden'); pov.style.display = 'flex'; }
        return;
    }

    // Confirm
    _closeVaultOverlay();

    const isInstant = action === 'apply-instant';
    _showCoinConfirm({
        title: isInstant ? 'LOCK NOW' : 'KEYHOLDER REQUEST',
        cost: tierData.coins,
        wallet,
        theme: 'vault',
        onConfirm: async () => {
            try {
                const state = getState();
                const body: any = { action, duration: tierData.days, memberId: state.email || state.memberId };
                if (requestedStart) body.requestedStart = requestedStart;
                const res = await fetch('/api/vault/apply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (data.error) {
                    console.error('[VAULT LOCK] Error:', data);
                    alert(data.error);
                    return;
                }

                // Update wallet in state + UI
                if (data.newWallet !== undefined) {
                    setState({ wallet: data.newWallet });
                    const s = getState(); if (s?.raw) s.raw.wallet = data.newWallet;
                    ['coins', 'mobCoins', 'walletDisplay', 'mob_walletVal'].forEach(id => {
                        const e = document.getElementById(id);
                        if (e) e.textContent = data.newWallet.toLocaleString();
                    });
                }

                // Update status button
                _updateVaultLockButton({ active: true, status: data.status, lockDays: tierData.days, sessionId: data.sessionId } as any);

                // For instant: show video proof upload. For request: show confirmation.
                if (isInstant && data.status === 'awaiting_video') {
                    _showVideoProofUpload({ sessionId: data.sessionId, lockDays: tierData.days });
                } else {
                    _showVaultConfirmation(false, tierData.days);
                }
            } catch (err: any) {
                alert('Connection error. Try again.');
            }
        },
    });
}

function _showVaultConfirmation(isInstant: boolean, days: number) {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:#080507;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;animation:_vFadeIn 0.3s ease;';
    ov.innerHTML = `
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            ${isInstant ? '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>' : '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'}
        </svg>
        <div style="font-family:Cinzel,serif;font-size:1.5rem;color:rgba(255,255,255,0.7);letter-spacing:5px;text-align:center;font-weight:700;">${isInstant ? 'LOCKED' : 'REQUEST SENT'}</div>
        <div style="width:30px;height:1px;background:rgba(255,255,255,0.12);"></div>
        <div style="font-family:Rajdhani,sans-serif;font-size:1rem;color:rgba(255,255,255,0.45);text-align:center;max-width:300px;line-height:1.6;">${isInstant ? `${days} day sentence activated.<br>Send your verification video.` : `${days} day lock request submitted.<br>Waiting for Queen Karin's approval.`}</div>
    `;
    ov.addEventListener('click', () => { ov.style.opacity = '0'; ov.style.transition = 'opacity 0.3s'; setTimeout(() => ov.remove(), 300); });
    document.body.appendChild(ov);
    setTimeout(() => { ov.style.opacity = '0'; ov.style.transition = 'opacity 0.3s'; setTimeout(() => ov.remove(), 300); }, 4000);
}

function _showVaultStatus(data: any) {
    const statusLabels: Record<string, string> = {
        active: 'LOCK ACTIVE',
        pending: 'AWAITING APPROVAL',
        scheduled: 'LOCK SCHEDULED',
        denied: 'REQUEST DENIED',
        awaiting_video: 'VIDEO PROOF REQUIRED',
    };
    const icons: Record<string, string> = {
        active: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
        scheduled: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
        pending: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
        denied: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
        awaiting_video: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>',
    };

    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:10000001;display:flex;align-items:center;justify-content:center;flex-direction:column;background:#080507;animation:_vFadeIn 0.25s ease;';
    ov.innerHTML = `
        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:20px;">
            ${icons[data.status] || icons.pending}
        </svg>
        <div style="font-family:Cinzel,serif;font-size:1.3rem;color:rgba(255,255,255,0.7);letter-spacing:4px;font-weight:700;margin-bottom:8px;">${statusLabels[data.status] || data.status.toUpperCase()}</div>
        <div style="width:30px;height:1px;background:rgba(255,255,255,0.12);margin:14px 0;"></div>
        <div style="font-family:Rajdhani,sans-serif;font-size:1rem;color:rgba(255,255,255,0.45);line-height:1.6;text-align:center;">
            ${data.lockDays} day sentence${data.coinsPaid ? ` — ${data.coinsPaid.toLocaleString()} coins` : ''}
            ${data.scheduledStart ? `<br>Starts: ${new Date(data.scheduledStart).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}
        </div>
        <button style="margin-top:36px;background:none;border:none;color:rgba(255,255,255,0.3);font-family:Rajdhani,sans-serif;font-size:0.85rem;letter-spacing:3px;cursor:pointer;">CLOSE</button>
    `;
    ov.querySelector('button')!.addEventListener('click', () => ov.remove());
    ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
}

export function _updateVaultLockButton(data: { active: boolean; status?: string; lockDays?: number } | null) {
    const btn = document.getElementById('vaultLockBtn') as HTMLButtonElement | null;
    const mobBtn = document.getElementById('mobVaultLockBtn') as HTMLButtonElement | null;

    if (!data || !data.active) {
        if (btn) { btn.textContent = 'REQUEST LOCK'; btn.style.borderColor = 'rgba(139,0,0,0.3)'; btn.style.color = '#8b0000'; btn.style.opacity = '1'; btn.disabled = false; btn.onclick = null; }
        if (mobBtn) { mobBtn.textContent = 'REQUEST LOCK'; mobBtn.style.borderColor = 'rgba(139,0,0,0.3)'; mobBtn.style.color = '#8b0000'; mobBtn.style.opacity = '1'; mobBtn.disabled = false; mobBtn.onclick = null; }
        return;
    }

    const labels: Record<string, string> = { active: 'LOCKED', pending: 'AWAITING QUEEN', scheduled: 'SCHEDULED', awaiting_video: 'SUBMIT VIDEO PROOF' };
    const color = '#8b0000';
    const label = labels[data.status || ''] || 'LOCK STATUS';
    const isDisabled = data.status === 'pending' || data.status === 'scheduled' || data.status === 'active';

    // awaiting_video — button stays enabled and opens video upload
    if (data.status === 'awaiting_video') {
        const setupVideoBtn = (b: HTMLButtonElement) => {
            b.textContent = label;
            b.style.borderColor = 'rgba(139,0,0,0.4)';
            b.style.color = color;
            b.style.opacity = '1';
            b.disabled = false;
            b.onclick = () => _showVideoProofUpload(data as any);
        };
        if (btn) setupVideoBtn(btn);
        if (mobBtn) setupVideoBtn(mobBtn);
        return;
    }

    // Active lock — button navigates to /vault
    if (data.status === 'active') {
        const setupActiveBtn = (b: HTMLButtonElement) => {
            b.textContent = label;
            b.style.borderColor = 'rgba(139,0,0,0.3)';
            b.style.color = color;
            b.style.opacity = '1';
            b.disabled = false;
            b.onclick = () => { window.location.href = '/vault'; };
        };
        if (btn) setupActiveBtn(btn);
        if (mobBtn) setupActiveBtn(mobBtn);
        return;
    }

    if (btn) { btn.textContent = label; btn.style.borderColor = 'rgba(139,0,0,0.25)'; btn.style.color = color; btn.style.opacity = '0.6'; btn.disabled = true; btn.onclick = null; }
    if (mobBtn) { mobBtn.textContent = label; mobBtn.style.borderColor = 'rgba(139,0,0,0.25)'; mobBtn.style.color = color; mobBtn.style.opacity = '0.6'; mobBtn.disabled = true; mobBtn.onclick = null; }
}

const VAULT_ONBOARD_KINK_DESCS: Record<string, string> = {
    "Foot fetish": "Worship, massaging, or being controlled through feet",
    "JOI": "Being told exactly how to touch yourself",
    "Humiliation": "Being verbally degraded, embarrassed, or put in your place",
    "SPH": "Small penis humiliation, size-based degradation",
    "Findom": "Financial domination, giving money as a form of submission",
    "D/s": "Dominant/submissive power dynamic and structure",
    "Control": "Having decisions made for you: what to wear, eat, do",
    "Ownership": "Being treated as property, collared, branded, possessed",
    "Chastity": "Denial and lock-up, no release without permission",
    "CEI": "Cum eating instruction, forced or guided consumption",
    "Blackmail play": "Fantasy scenarios involving leverage and coercion",
    "Objectification": "Being treated as a thing: furniture, toy, decoration",
    "Degradation": "Being made to feel worthless, dirty, or beneath someone",
    "Task submission": "Completing assigned tasks and proving obedience",
    "CBT": "Cock and ball torture, pain-based genital control",
    "Training": "Structured programs to shape behavior and obedience",
    "Power exchange": "Giving up control and authority to a dominant",
    "Verbal domination": "Being commanded, scolded, or controlled through words",
    "Protocol": "Strict rules: how to address, behave, respond",
    "Obedience": "Following orders without question or hesitation",
    "Psychological domination": "Mind games, manipulation, mental control",
};
const VAULT_ONBOARD_LIMIT_DESCS: Record<string, string> = {
    "Face showing": "No photos or videos showing your face",
    "Public exposure": "Nothing done in public or shared publicly",
    "Financial ruin": "No demands that would cause real financial harm",
    "Permanent marks": "No tattoos, brands, or permanent body modifications",
    "Family involvement": "No contact with or mention of family members",
    "Employer contact": "No interaction with your workplace or colleagues",
    "Blood play": "Nothing involving cutting or blood",
    "Scat": "No feces-related activities",
    "Extreme pain": "No severe physical pain beyond light discomfort",
    "Breath play": "No choking, suffocation, or breath restriction",
    "Real blackmail": "No actual threats or real-world leverage",
    "Non-consensual sharing": "No sharing content without explicit permission",
    "Sleep deprivation": "No tasks that interfere with normal sleep",
    "Drug use": "No forced substance use of any kind",
    "Self-harm": "Nothing that causes real physical injury",
};

function _showVaultOnboarding(data: { sessionId: string; lockDays: number }) {
    document.getElementById('_vaultVideoOverlay')?.remove();

    // If onboarding already completed for this session, skip straight to video
    try {
        const ob = JSON.parse(localStorage.getItem(`vault_ob_${data.sessionId}`) || 'null');
        if (ob?.done) { _showVideoProofUploadDirect(data); return; }
    } catch {}

    const state = getState();
    const raw = state.raw || state;
    const existingKinks = (raw.kinks || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const existingLimits = (raw.limits || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const selectedKinks = new Set<string>(existingKinks);
    const selectedLimits = new Set<string>(existingLimits);

    const ov = document.createElement('div');
    ov.id = '_vaultVideoOverlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10000001;display:flex;flex-direction:column;background:#080507;animation:_vFadeIn 0.3s ease;overflow-y:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;-ms-overflow-style:none;';

    let step = 1;

    function renderStep() {
        if (step === 1) {
            // STEP 1: KINKS
            ov.innerHTML = `
                <div style="width:100%;max-width:420px;margin:0 auto;padding:60px 24px 100px;">
                    <div style="font-family:Rajdhani,sans-serif;font-size:0.7rem;color:rgba(255,255,255,0.2);letter-spacing:4px;text-align:center;margin-bottom:6px;">STEP 1 OF 8</div>
                    <div style="font-family:Cinzel,serif;font-size:1.4rem;color:rgba(255,255,255,0.7);letter-spacing:5px;font-weight:700;text-align:center;margin-bottom:6px;">YOUR KINKS</div>
                    <div style="font-family:Rajdhani,sans-serif;font-size:0.85rem;color:rgba(255,255,255,0.3);text-align:center;margin-bottom:32px;line-height:1.6;">Select what excites you. This helps Queen Karin<br>build a program tailored to your desires.</div>
                    <div style="width:40px;height:1px;background:rgba(197,160,89,0.2);margin:0 auto 28px;"></div>
                    <div id="_obDesc" style="min-height:44px;text-align:center;margin-bottom:20px;transition:opacity 0.2s;">
                        <div style="font-family:Rajdhani,sans-serif;font-size:0.8rem;color:rgba(255,255,255,0.2);letter-spacing:1px;line-height:1.5;">Tap a kink to see what it means</div>
                    </div>
                    <div id="_obChips" style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-bottom:40px;"></div>
                    <div style="text-align:center;">
                        <div id="_obMinMsg" style="font-family:Rajdhani,sans-serif;font-size:0.75rem;color:rgba(255,255,255,0.15);letter-spacing:2px;margin-bottom:16px;">SELECT AT LEAST 3</div>
                        <button id="_obNext" disabled style="padding:16px 48px;font-family:Orbitron,sans-serif;font-size:0.8rem;letter-spacing:4px;color:rgba(255,255,255,0.1);background:transparent;border:1px solid rgba(255,255,255,0.04);border-radius:10px;cursor:default;">NEXT</button>
                    </div>
                </div>
            `;
            const chipWrap = ov.querySelector('#_obChips')!;
            const nextBtn = ov.querySelector('#_obNext') as HTMLButtonElement;
            const minMsg = ov.querySelector('#_obMinMsg') as HTMLElement;
            const descEl = ov.querySelector('#_obDesc') as HTMLElement;

            function updateKinkBtn() {
                const ok = selectedKinks.size >= 3;
                nextBtn.disabled = !ok;
                nextBtn.style.color = ok ? '#c5a059' : 'rgba(255,255,255,0.1)';
                nextBtn.style.borderColor = ok ? 'rgba(197,160,89,0.4)' : 'rgba(255,255,255,0.04)';
                nextBtn.style.background = ok ? 'rgba(197,160,89,0.06)' : 'transparent';
                nextBtn.style.cursor = ok ? 'pointer' : 'default';
                minMsg.textContent = ok ? `${selectedKinks.size} SELECTED` : 'SELECT AT LEAST 3';
                minMsg.style.color = ok ? 'rgba(197,160,89,0.4)' : 'rgba(255,255,255,0.15)';
            }

            CHIP_LIST.forEach(kinkName => {
                const chip = document.createElement('button');
                chip.textContent = kinkName;
                const sel = selectedKinks.has(kinkName);
                chip.style.cssText = `padding:8px 16px;border-radius:20px;font-family:Rajdhani,sans-serif;font-size:0.8rem;letter-spacing:1px;cursor:pointer;transition:all 0.2s;border:1px solid ${sel ? 'rgba(197,160,89,0.5)' : 'rgba(255,255,255,0.08)'};color:${sel ? '#c5a059' : 'rgba(255,255,255,0.35)'};background:${sel ? 'rgba(197,160,89,0.08)' : 'rgba(255,255,255,0.02)'};`;
                chip.addEventListener('click', () => {
                    if (selectedKinks.has(kinkName)) { selectedKinks.delete(kinkName); chip.style.borderColor = 'rgba(255,255,255,0.08)'; chip.style.color = 'rgba(255,255,255,0.35)'; chip.style.background = 'rgba(255,255,255,0.02)'; }
                    else { selectedKinks.add(kinkName); chip.style.borderColor = 'rgba(197,160,89,0.5)'; chip.style.color = '#c5a059'; chip.style.background = 'rgba(197,160,89,0.08)'; }
                    const desc = VAULT_ONBOARD_KINK_DESCS[kinkName] || '';
                    descEl.innerHTML = `<div style="font-family:Cinzel,serif;font-size:0.85rem;color:${selectedKinks.has(kinkName) ? '#c5a059' : 'rgba(255,255,255,0.45)'};letter-spacing:2px;margin-bottom:4px;">${kinkName.toUpperCase()}</div><div style="font-family:Rajdhani,sans-serif;font-size:0.8rem;color:rgba(255,255,255,0.3);letter-spacing:0.5px;">${desc}</div>`;
                    updateKinkBtn();
                });
                chipWrap.appendChild(chip);
            });
            updateKinkBtn();
            nextBtn.addEventListener('click', () => { if (!nextBtn.disabled) { step = 2; renderStep(); } });

        } else if (step === 2) {
            // STEP 2: LIMITS
            ov.innerHTML = `
                <div style="width:100%;max-width:420px;margin:0 auto;padding:60px 24px 100px;">
                    <div style="font-family:Rajdhani,sans-serif;font-size:0.7rem;color:rgba(255,255,255,0.2);letter-spacing:4px;text-align:center;margin-bottom:6px;">STEP 2 OF 8</div>
                    <div style="font-family:Cinzel,serif;font-size:1.4rem;color:rgba(255,255,255,0.7);letter-spacing:5px;font-weight:700;text-align:center;margin-bottom:6px;">YOUR LIMITS</div>
                    <div style="font-family:Rajdhani,sans-serif;font-size:0.85rem;color:rgba(255,255,255,0.3);text-align:center;margin-bottom:32px;line-height:1.6;">Select your hard limits. These will never<br>appear in your program. Your safety matters.</div>
                    <div style="width:40px;height:1px;background:rgba(139,0,0,0.3);margin:0 auto 28px;"></div>
                    <div id="_obDesc2" style="min-height:44px;text-align:center;margin-bottom:20px;transition:opacity 0.2s;">
                        <div style="font-family:Rajdhani,sans-serif;font-size:0.8rem;color:rgba(255,255,255,0.2);letter-spacing:1px;line-height:1.5;">Tap a limit to see what it means</div>
                    </div>
                    <div id="_obChips2" style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-bottom:40px;"></div>
                    <div style="display:flex;gap:12px;justify-content:center;">
                        <button id="_obBack2" style="padding:14px 28px;font-family:Rajdhani,sans-serif;font-size:0.8rem;letter-spacing:3px;color:rgba(255,255,255,0.25);background:none;border:1px solid rgba(255,255,255,0.06);border-radius:10px;cursor:pointer;">BACK</button>
                        <button id="_obNext2" style="padding:14px 48px;font-family:Orbitron,sans-serif;font-size:0.8rem;letter-spacing:4px;color:#c5a059;background:rgba(197,160,89,0.06);border:1px solid rgba(197,160,89,0.4);border-radius:10px;cursor:pointer;">NEXT</button>
                    </div>
                </div>
            `;
            const chipWrap = ov.querySelector('#_obChips2')!;
            const descEl2 = ov.querySelector('#_obDesc2') as HTMLElement;
            Object.keys(VAULT_ONBOARD_LIMIT_DESCS).forEach(limitName => {
                const chip = document.createElement('button');
                chip.textContent = limitName;
                const sel = selectedLimits.has(limitName);
                chip.style.cssText = `padding:8px 16px;border-radius:20px;font-family:Rajdhani,sans-serif;font-size:0.8rem;letter-spacing:1px;cursor:pointer;transition:all 0.2s;border:1px solid ${sel ? 'rgba(139,0,0,0.5)' : 'rgba(255,255,255,0.08)'};color:${sel ? 'rgba(200,60,60,0.8)' : 'rgba(255,255,255,0.35)'};background:${sel ? 'rgba(139,0,0,0.08)' : 'rgba(255,255,255,0.02)'};`;
                chip.addEventListener('click', () => {
                    if (selectedLimits.has(limitName)) { selectedLimits.delete(limitName); chip.style.borderColor = 'rgba(255,255,255,0.08)'; chip.style.color = 'rgba(255,255,255,0.35)'; chip.style.background = 'rgba(255,255,255,0.02)'; }
                    else { selectedLimits.add(limitName); chip.style.borderColor = 'rgba(139,0,0,0.5)'; chip.style.color = 'rgba(200,60,60,0.8)'; chip.style.background = 'rgba(139,0,0,0.08)'; }
                    const desc = VAULT_ONBOARD_LIMIT_DESCS[limitName] || '';
                    descEl2.innerHTML = `<div style="font-family:Cinzel,serif;font-size:0.85rem;color:${selectedLimits.has(limitName) ? 'rgba(200,60,60,0.8)' : 'rgba(255,255,255,0.45)'};letter-spacing:2px;margin-bottom:4px;">${limitName.toUpperCase()}</div><div style="font-family:Rajdhani,sans-serif;font-size:0.8rem;color:rgba(255,255,255,0.3);letter-spacing:0.5px;">${desc}</div>`;
                });
                chipWrap.appendChild(chip);
            });
            ov.querySelector('#_obBack2')!.addEventListener('click', () => { step = 1; renderStep(); });
            ov.querySelector('#_obNext2')!.addEventListener('click', () => { step = 3; renderStep(); });

        } else if (step >= 3 && step <= 6) {
            // STEPS 3-6: Individual HOW IT WORKS screens
            const rules = [
                {
                    num: 3, icon: `<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="rgba(197,160,89,0.6)" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
                    title: 'DAILY CHASTITY CHECK',
                    body: 'Every morning between 6:00 and 10:00 AM in your local timezone, you must submit a photo proving you are still locked.\n\nThis is non-negotiable. Missing a check means immediate termination of your program. No warnings, no second chances.\n\nYou will receive a notification when the window opens.',
                },
                {
                    num: 4, icon: `<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="rgba(139,0,0,0.6)" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
                    title: 'DAILY ORDERS',
                    body: 'Each day you will receive tasks personally designed by Queen Karin. Writing assignments, photo proofs, challenges.\n\nThis is not a generated program. Every task is created by Queen Karin based on your kinks, your limits, and what she learns about you over time.\n\nComplete all tasks to maintain your obedience streak.',
                },
                {
                    num: 5, icon: `<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="rgba(139,0,0,0.6)" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
                    title: 'CONSEQUENCES',
                    body: 'Skipping orders costs coins and breaks your streak. Disobedience may result in penalty days added to your sentence.\n\nPerfect obedience is rewarded. Queen Karin notices everything.\n\nYour behavior shapes how she treats you.',
                },
                {
                    num: 6, icon: `<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="rgba(197,160,89,0.6)" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
                    title: 'NO EARLY RELEASE',
                    body: `Once locked, you serve your full ${data.lockDays} day sentence. There is no undo, no refund, no escape.\n\nYou may beg Queen Karin for mercy, but she decides. Early release is earned through perfect obedience, never demanded.\n\nBy continuing, you accept these terms.`,
                },
            ];
            const rule = rules[step - 3];
            const stepLabel = `${step} OF 8`;
            ov.innerHTML = `
                <div style="width:100%;max-width:420px;margin:0 auto;padding:60px 24px 100px;display:flex;flex-direction:column;align-items:center;min-height:100vh;box-sizing:border-box;">
                    <div style="font-family:Rajdhani,sans-serif;font-size:0.7rem;color:rgba(255,255,255,0.2);letter-spacing:4px;text-align:center;margin-bottom:32px;">STEP ${stepLabel}</div>

                    <div style="width:70px;height:70px;border-radius:50%;border:1px solid rgba(197,160,89,0.15);display:flex;align-items:center;justify-content:center;margin-bottom:28px;">
                        ${rule.icon}
                    </div>

                    <div style="font-family:Cinzel,serif;font-size:1.3rem;color:rgba(255,255,255,0.75);letter-spacing:5px;font-weight:700;text-align:center;margin-bottom:8px;">${rule.title}</div>
                    <div style="width:40px;height:1px;background:rgba(197,160,89,0.15);margin:0 auto 28px;"></div>

                    <div style="font-family:Rajdhani,sans-serif;font-size:0.95rem;color:rgba(255,255,255,0.4);line-height:1.8;text-align:center;max-width:340px;margin-bottom:auto;white-space:pre-line;">${rule.body}</div>

                    <div style="display:flex;gap:12px;justify-content:center;margin-top:40px;width:100%;">
                        <button id="_obRuleBack" style="padding:14px 28px;font-family:Rajdhani,sans-serif;font-size:0.8rem;letter-spacing:3px;color:rgba(255,255,255,0.25);background:none;border:1px solid rgba(255,255,255,0.06);border-radius:10px;cursor:pointer;">BACK</button>
                        <button id="_obRuleNext" style="padding:16px 36px;font-family:Orbitron,sans-serif;font-size:0.75rem;letter-spacing:4px;color:#c5a059;background:rgba(197,160,89,0.06);border:1px solid rgba(197,160,89,0.4);border-radius:10px;cursor:pointer;">I UNDERSTAND</button>
                    </div>
                </div>
            `;
            ov.querySelector('#_obRuleBack')!.addEventListener('click', () => { step = step - 1; renderStep(); });
            ov.querySelector('#_obRuleNext')!.addEventListener('click', () => {
                const next = step + 1;
                // Skip install step if app already installed
                if (next === 7 && (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone)) { step = 8; } else { step = next; }
                renderStep();
            });

        } else if (step === 7) {
            // STEP 7: INSTALL THE APP
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
            const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
            const hasPrompt = !!(window as any)._deferredInstallPrompt;

            ov.innerHTML = `
                <div style="width:100%;max-width:420px;margin:0 auto;padding:60px 24px 100px;display:flex;flex-direction:column;align-items:center;min-height:100vh;box-sizing:border-box;">
                    <div style="font-family:Rajdhani,sans-serif;font-size:0.7rem;color:rgba(255,255,255,0.2);letter-spacing:4px;text-align:center;margin-bottom:32px;">STEP 7 OF 8</div>

                    <div style="width:70px;height:70px;border-radius:50%;border:1px solid rgba(197,160,89,0.15);display:flex;align-items:center;justify-content:center;margin-bottom:28px;">
                        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="rgba(197,160,89,0.6)" stroke-width="1.5"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18.01" stroke-width="2" stroke-linecap="round"/></svg>
                    </div>

                    <div style="font-family:Cinzel,serif;font-size:1.3rem;color:rgba(255,255,255,0.75);letter-spacing:5px;font-weight:700;text-align:center;margin-bottom:8px;">INSTALL THE APP</div>
                    <div style="width:40px;height:1px;background:rgba(197,160,89,0.15);margin:0 auto 28px;"></div>

                    <div style="font-family:Rajdhani,sans-serif;font-size:0.95rem;color:rgba(255,255,255,0.4);line-height:1.8;text-align:center;max-width:340px;margin-bottom:28px;">For the best experience, install this as an app on your home screen. It takes 2 seconds.</div>

                    <div style="display:flex;flex-direction:column;gap:18px;width:100%;max-width:320px;margin-bottom:24px;">
                        <div style="display:flex;gap:14px;align-items:flex-start;">
                            <div style="width:32px;height:32px;border-radius:50%;border:1px solid rgba(197,160,89,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="rgba(197,160,89,0.5)" stroke-width="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                            </div>
                            <div style="font-family:Rajdhani,sans-serif;font-size:0.85rem;color:rgba(255,255,255,0.35);line-height:1.6;">Receive notifications for daily checks, orders, and messages from Queen Karin</div>
                        </div>
                        <div style="display:flex;gap:14px;align-items:flex-start;">
                            <div style="width:32px;height:32px;border-radius:50%;border:1px solid rgba(197,160,89,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="rgba(197,160,89,0.5)" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                            </div>
                            <div style="font-family:Rajdhani,sans-serif;font-size:0.85rem;color:rgba(255,255,255,0.35);line-height:1.6;">Full screen experience with no browser bars or distractions</div>
                        </div>
                        <div style="display:flex;gap:14px;align-items:flex-start;">
                            <div style="width:32px;height:32px;border-radius:50%;border:1px solid rgba(197,160,89,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="rgba(197,160,89,0.5)" stroke-width="1.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                            </div>
                            <div style="font-family:Rajdhani,sans-serif;font-size:0.85rem;color:rgba(255,255,255,0.35);line-height:1.6;">Instant access from your home screen, loads faster than the browser</div>
                        </div>
                    </div>

                    <div style="width:100%;max-width:320px;background:rgba(197,160,89,0.04);border:1px solid rgba(197,160,89,0.1);border-radius:10px;padding:16px 18px;margin-bottom:auto;">
                        <div style="font-family:Cinzel,serif;font-size:0.7rem;color:rgba(197,160,89,0.5);letter-spacing:3px;margin-bottom:8px;">YOUR PRIVACY</div>
                        <div style="font-family:Rajdhani,sans-serif;font-size:0.82rem;color:rgba(255,255,255,0.3);line-height:1.7;">This is not a traditional app. Nothing is downloaded from an app store. It is a shortcut to this website saved on your home screen. It does not access your contacts, photos, location, or any personal data. It has no more permissions than your browser. You can remove it at any time like any other app.</div>
                    </div>

                    ${isStandalone ? `
                        <div style="margin-top:28px;margin-bottom:12px;display:flex;align-items:center;gap:10px;">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="rgba(197,160,89,0.6)" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
                            <div style="font-family:Rajdhani,sans-serif;font-size:0.9rem;color:rgba(197,160,89,0.6);letter-spacing:2px;">ALREADY INSTALLED</div>
                        </div>
                    ` : `
                        <button id="_obInstallBtn" style="margin-top:28px;margin-bottom:12px;padding:16px 48px;font-family:Orbitron,sans-serif;font-size:0.75rem;letter-spacing:4px;color:#c5a059;background:rgba(197,160,89,0.08);border:1px solid rgba(197,160,89,0.4);border-radius:10px;cursor:pointer;transition:all 0.2s;">${hasPrompt ? 'INSTALL NOW' : (isIOS ? 'HOW TO INSTALL' : 'INSTALL NOW')}</button>
                    `}

                    <div style="display:flex;gap:12px;justify-content:center;margin-top:16px;width:100%;">
                        <button id="_obInstBack" style="padding:14px 28px;font-family:Rajdhani,sans-serif;font-size:0.8rem;letter-spacing:3px;color:rgba(255,255,255,0.25);background:none;border:1px solid rgba(255,255,255,0.06);border-radius:10px;cursor:pointer;">BACK</button>
                        <button id="_obInstNext" style="padding:16px 36px;font-family:Orbitron,sans-serif;font-size:0.75rem;letter-spacing:4px;color:#c5a059;background:rgba(197,160,89,0.06);border:1px solid rgba(197,160,89,0.4);border-radius:10px;cursor:pointer;">${isStandalone ? 'CONTINUE' : 'SKIP FOR NOW'}</button>
                    </div>
                </div>
            `;

            const installBtn = ov.querySelector('#_obInstallBtn') as HTMLButtonElement | null;
            if (installBtn) {
                installBtn.addEventListener('click', async () => {
                    const prompt = (window as any)._deferredInstallPrompt;
                    if (prompt) {
                        prompt.prompt();
                        const result = await prompt.userChoice;
                        if (result.outcome === 'accepted') {
                            installBtn.textContent = 'INSTALLED';
                            installBtn.style.borderColor = 'rgba(197,160,89,0.6)';
                            installBtn.disabled = true;
                            const nextBtn = ov.querySelector('#_obInstNext') as HTMLButtonElement;
                            if (nextBtn) nextBtn.textContent = 'CONTINUE';
                            // Claim reward silently
                            const email = state.email || state.memberId || '';
                            fetch('/api/claim-reward', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ memberId: email, choice: 'coins', source: 'install' }) }).catch(() => {});
                        }
                        (window as any)._deferredInstallPrompt = null;
                    } else {
                        const iosMsg = /iphone|ipad|ipod/i.test(navigator.userAgent);
                        if (iosMsg) {
                            installBtn.innerHTML = `<span style="font-size:0.65rem;letter-spacing:2px;line-height:1.6;">Tap <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#c5a059" stroke-width="2" style="vertical-align:middle;margin:0 2px;"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> Share, then "Add to Home Screen"</span>`;
                            installBtn.style.padding = '14px 20px';
                        } else {
                            installBtn.innerHTML = `<span style="font-size:0.65rem;letter-spacing:2px;line-height:1.6;">Open browser menu, tap "Install App"</span>`;
                            installBtn.style.padding = '14px 20px';
                        }
                    }
                });
            }

            ov.querySelector('#_obInstBack')!.addEventListener('click', () => { step = 6; renderStep(); });
            ov.querySelector('#_obInstNext')!.addEventListener('click', () => { step = 8; renderStep(); });

        } else if (step === 8) {
            // STEP 8: ABOUT YOU — tell Queen Karin about yourself
            ov.innerHTML = `
                <div style="width:100%;max-width:420px;margin:0 auto;padding:60px 24px 100px;display:flex;flex-direction:column;align-items:center;min-height:100vh;box-sizing:border-box;">
                    <div style="font-family:Rajdhani,sans-serif;font-size:0.7rem;color:rgba(255,255,255,0.2);letter-spacing:4px;text-align:center;margin-bottom:32px;">STEP 8 OF 8</div>

                    <div style="width:70px;height:70px;border-radius:50%;border:1px solid rgba(197,160,89,0.15);display:flex;align-items:center;justify-content:center;margin-bottom:28px;">
                        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="rgba(197,160,89,0.6)" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>

                    <div style="font-family:Cinzel,serif;font-size:1.3rem;color:rgba(255,255,255,0.75);letter-spacing:5px;font-weight:700;text-align:center;margin-bottom:8px;">ABOUT YOU</div>
                    <div style="width:40px;height:1px;background:rgba(197,160,89,0.15);margin:0 auto 24px;"></div>

                    <div style="font-family:Rajdhani,sans-serif;font-size:0.95rem;color:rgba(255,255,255,0.4);line-height:1.8;text-align:center;max-width:340px;margin-bottom:28px;">Tell Queen Karin anything you think she should know about you. Your experience, your mindset, what you are looking for. This will be sent directly to her.</div>

                    <textarea id="_obAboutYou" placeholder="Write here..." style="width:100%;min-height:150px;max-height:250px;background:rgba(255,255,255,0.03);border:1px solid rgba(197,160,89,0.15);color:rgba(255,255,255,0.7);padding:16px;border-radius:10px;font-family:Rajdhani,sans-serif;font-size:16px;resize:vertical;line-height:1.7;letter-spacing:0.5px;box-sizing:border-box;"></textarea>
                    <div style="font-family:Rajdhani,sans-serif;font-size:0.7rem;color:rgba(255,255,255,0.15);letter-spacing:1px;margin-top:8px;margin-bottom:auto;">OPTIONAL BUT RECOMMENDED</div>

                    <div style="display:flex;gap:12px;justify-content:center;margin-top:40px;width:100%;">
                        <button id="_obAboutBack" style="padding:14px 28px;font-family:Rajdhani,sans-serif;font-size:0.8rem;letter-spacing:3px;color:rgba(255,255,255,0.25);background:none;border:1px solid rgba(255,255,255,0.06);border-radius:10px;cursor:pointer;">BACK</button>
                        <button id="_obAccept" style="padding:16px 36px;font-family:Orbitron,sans-serif;font-size:0.75rem;letter-spacing:4px;color:#c5a059;background:rgba(197,160,89,0.06);border:1px solid rgba(197,160,89,0.4);border-radius:10px;cursor:pointer;">CONTINUE</button>
                    </div>
                </div>
            `;
            ov.querySelector('#_obAboutBack')!.addEventListener('click', () => {
                // Skip install step going back if app already installed
                if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) { step = 6; } else { step = 7; }
                renderStep();
            });
            ov.querySelector('#_obAccept')!.addEventListener('click', async () => {
                const acceptBtn = ov.querySelector('#_obAccept') as HTMLButtonElement;
                acceptBtn.disabled = true; acceptBtn.textContent = 'SAVING...'; acceptBtn.style.color = 'rgba(197,160,89,0.3)';

                const email = state.email || state.memberId || '';
                const aboutText = ((ov.querySelector('#_obAboutYou') as HTMLTextAreaElement)?.value || '').trim();
                try {
                    // Save kinks
                    const kinksStr = Array.from(selectedKinks).join(', ');
                    await fetch('/api/profile-update', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ memberEmail: email, field: 'kinks', value: kinksStr, cost: 0 }) });
                    // Save limits
                    const limitsStr = Array.from(selectedLimits).join(', ');
                    await fetch('/api/profile-update', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ memberEmail: email, field: 'limits', value: limitsStr, cost: 0 }) });
                    // Send "about me" as chat message if provided
                    if (aboutText) {
                        await fetch('/api/chat/send', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ memberId: email, content: aboutText, type: 'text' }) });
                    }
                } catch {}

                // Mark onboarding as done for this session — skip it on re-entry
                try { localStorage.setItem(`vault_ob_${data.sessionId}`, JSON.stringify({ done: true })); } catch {}

                // Proceed to video upload
                ov.remove();
                _showVideoProofUploadDirect(data);
            });
        }
        ov.scrollTop = 0;
    }

    renderStep();
    document.body.appendChild(ov);
}

function _showVideoProofUpload(data: { sessionId: string; lockDays: number }) {
    _showVaultOnboarding(data);
}

function _showVideoProofUploadDirect(data: { sessionId: string; lockDays: number }) {
    const existing = document.getElementById('_vaultVideoOverlay');
    if (existing) existing.remove();

    const ov = document.createElement('div');
    ov.id = '_vaultVideoOverlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10000001;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#080507;animation:_vFadeIn 0.3s ease;overflow:hidden;';

    // Step 1: Record video
    ov.innerHTML = `
        <div style="text-align:center;max-width:340px;padding:0 28px;">
            <div style="font-family:Rajdhani,sans-serif;font-size:0.85rem;color:rgba(255,255,255,0.4);letter-spacing:4px;margin-bottom:6px;">DAY 1</div>
            <div style="font-family:Cinzel,serif;font-size:1.4rem;color:rgba(255,255,255,0.7);letter-spacing:4px;font-weight:700;margin-bottom:6px;">VERIFICATION</div>
            <div style="font-family:Rajdhani,sans-serif;font-size:0.9rem;color:rgba(255,255,255,0.4);margin-bottom:28px;">${data.lockDays} day sentence — submit video proof</div>

            <label id="_vaultVideoLabel" style="display:flex;align-items:center;justify-content:center;width:100%;height:160px;border-radius:12px;border:1px dashed rgba(255,255,255,0.15);cursor:pointer;flex-direction:column;gap:10px;">
                <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="rgba(139,0,0,0.4)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                </svg>
                <div style="font-family:Rajdhani,sans-serif;font-size:0.85rem;color:rgba(255,255,255,0.4);letter-spacing:1px;">TAP TO RECORD VIDEO</div>
                <div style="font-family:Rajdhani,sans-serif;font-size:0.65rem;color:rgba(255,255,255,0.2);letter-spacing:1px;">MAX 2 MINUTES</div>
                <input id="_vaultVideoInput" type="file" accept="video/*" capture="user" style="display:none;" />
            </label>

            <div style="margin-top:28px;font-family:Rajdhani,sans-serif;font-size:0.7rem;color:rgba(255,255,255,0.15);letter-spacing:2px;">YOU CANNOT PROCEED WITHOUT VIDEO PROOF</div>
        </div>
    `;

    document.body.appendChild(ov);

    const fileInput = ov.querySelector('#_vaultVideoInput') as HTMLInputElement;

    fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        if (!file) return;

        const MAX_SIZE_MB = 100;
        const sizeMB = file.size / 1024 / 1024;
        if (sizeMB > MAX_SIZE_MB) {
            alert(`Video is ${sizeMB.toFixed(0)}MB — max ${MAX_SIZE_MB}MB. Record a shorter clip.`);
            return;
        }

        // Move to step 2: thumbnail picker
        _showVaultThumbPicker(ov, file, data);
    });
}

function _showVaultThumbPicker(ov: HTMLElement, file: File, data: { sessionId: string; lockDays: number }) {
    const videoUrl = URL.createObjectURL(file);

    ov.innerHTML = `
        <div style="text-align:center;max-width:380px;padding:0 24px;width:100%;">
            <div style="font-family:Rajdhani,sans-serif;font-size:0.75rem;color:rgba(255,255,255,0.3);letter-spacing:4px;margin-bottom:6px;">CHOOSE YOUR</div>
            <div style="font-family:Cinzel,serif;font-size:1.3rem;color:rgba(255,255,255,0.7);letter-spacing:4px;font-weight:700;margin-bottom:20px;">THUMBNAIL</div>

            <div style="position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:10px;overflow:hidden;margin-bottom:14px;border:1px solid rgba(139,0,0,0.25);">
                <video id="_vtpVideo" style="width:100%;height:100%;object-fit:contain;display:block;" muted playsinline preload="auto"></video>
                <div id="_vtpDuration" style="position:absolute;bottom:8px;right:10px;font-family:Rajdhani,sans-serif;font-size:0.75rem;color:rgba(255,255,255,0.7);background:rgba(0,0,0,0.6);padding:2px 8px;border-radius:4px;letter-spacing:1px;"></div>
            </div>

            <div style="font-family:Rajdhani,sans-serif;font-size:0.7rem;color:rgba(255,255,255,0.25);letter-spacing:2px;margin-bottom:6px;">SCRUB TO PICK FRAME</div>
            <input id="_vtpScrub" type="range" min="0" max="100" value="0" step="0.1" style="width:100%;margin-bottom:20px;accent-color:rgba(139,0,0,0.8);cursor:pointer;height:3px;" />

            <div id="_vtpProgress" style="display:none;margin-bottom:16px;">
                <div style="width:100%;height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;">
                    <div id="_vtpBar" style="width:0%;height:100%;background:rgba(139,0,0,0.7);transition:width 0.3s;"></div>
                </div>
                <div id="_vtpStatus" style="font-family:Rajdhani,sans-serif;font-size:0.8rem;color:rgba(255,255,255,0.35);margin-top:8px;letter-spacing:1px;">UPLOADING...</div>
            </div>

            <button id="_vtpSubmit" style="width:100%;padding:16px;border-radius:10px;background:rgba(139,0,0,0.12);border:1px solid rgba(139,0,0,0.25);color:rgba(200,50,50,0.85);font-family:Cinzel,serif;font-size:0.9rem;letter-spacing:3px;cursor:pointer;font-weight:600;">SUBMIT PROOF</button>

            <button id="_vtpBack" style="margin-top:18px;background:none;border:none;color:rgba(255,255,255,0.25);font-family:Rajdhani,sans-serif;font-size:0.8rem;letter-spacing:3px;cursor:pointer;">RE-RECORD</button>
        </div>
    `;

    const video = ov.querySelector('#_vtpVideo') as HTMLVideoElement;
    const scrub = ov.querySelector('#_vtpScrub') as HTMLInputElement;
    const submitBtn = ov.querySelector('#_vtpSubmit') as HTMLButtonElement;
    const backBtn = ov.querySelector('#_vtpBack') as HTMLElement;
    const durationEl = ov.querySelector('#_vtpDuration') as HTMLElement;
    const progressEl = ov.querySelector('#_vtpProgress') as HTMLElement;
    const barEl = ov.querySelector('#_vtpBar') as HTMLElement;
    const statusEl = ov.querySelector('#_vtpStatus') as HTMLElement;

    video.src = videoUrl;
    video.load();
    video.addEventListener('loadeddata', () => {
        video.currentTime = 0.01;
    });
    video.addEventListener('loadedmetadata', () => {
        const dur = Math.round(video.duration);
        durationEl.textContent = `${Math.floor(dur / 60)}:${(dur % 60).toString().padStart(2, '0')}`;
    });

    // Scrub to pick frame
    scrub.addEventListener('input', () => {
        if (video.duration) {
            video.currentTime = (parseFloat(scrub.value) / 100) * video.duration;
        }
    });

    // Re-record
    backBtn.addEventListener('click', () => {
        URL.revokeObjectURL(videoUrl);
        _showVideoProofUploadDirect(data);
    });

    // Submit — grab thumbnail frame, upload both
    submitBtn.addEventListener('click', async () => {
        submitBtn.disabled = true;
        submitBtn.textContent = 'UPLOADING...';
        progressEl.style.display = 'block';
        barEl.style.width = '20%';

        try {
            // 1. Capture thumbnail from current frame
            const canvas = document.createElement('canvas');
            canvas.width = Math.min(video.videoWidth, 720);
            canvas.height = Math.round(canvas.width * (video.videoHeight / Math.max(video.videoWidth, 1)));
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const thumbBlob = await new Promise<Blob>((resolve) => {
                canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85);
            });
            const thumbFile = new File([thumbBlob], `vault-thumb-${Date.now()}.jpg`, { type: 'image/jpeg' });

            // Kill video element NOW — before uploads start.
            // Do NOT call video.load() — iOS shows "Load failed" when loading with no src.
            video.pause();
            video.removeAttribute('src');
            video.remove();
            URL.revokeObjectURL(videoUrl);

            // 2. Upload video
            statusEl.textContent = 'UPLOADING VIDEO...';
            barEl.style.width = '40%';
            const vUrl = await uploadToSupabase('media', 'vault-proof', file);
            if (vUrl.startsWith('failed:')) {
                statusEl.textContent = vUrl.replace('failed:', '');
                statusEl.style.color = 'rgba(255,60,60,0.6)';
                submitBtn.disabled = false;
                submitBtn.textContent = 'SUBMIT PROOF';
                return;
            }

            // 3. Upload thumbnail
            statusEl.textContent = 'SAVING THUMBNAIL...';
            barEl.style.width = '80%';
            const tUrl = await uploadToSupabase('media', 'vault-thumb', thumbFile);
            const thumbUrl = tUrl.startsWith('failed:') ? null : tUrl;

            barEl.style.width = '100%';
            statusEl.textContent = 'ACTIVATING LOCK...';

            // 4. Submit proof to API
            const state = getState();
            const res = await fetch('/api/vault/proof', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: data.sessionId,
                    videoUrl: vUrl,
                    thumbUrl,
                    memberId: state.email || state.memberId,
                }),
            });
            const result = await res.json();
            if (result.error) {
                alert(result.error);
                submitBtn.disabled = false;
                submitBtn.textContent = 'SUBMIT PROOF';
                return;
            }
            _updateVaultLockButton({ active: true, status: 'active', lockDays: data.lockDays });
            // Show locked modal inside the same inescapable overlay, then redirect to vault
            ov.innerHTML = `
                <div style="text-align:center;max-width:340px;padding:0 28px;">
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="rgba(139,0,0,0.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:24px;">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <div style="font-family:Cinzel,serif;font-size:1.6rem;color:rgba(255,255,255,0.75);letter-spacing:6px;font-weight:700;margin-bottom:12px;">LOCKED</div>
                    <div style="width:40px;height:1px;background:rgba(139,0,0,0.3);margin:0 auto 20px;"></div>
                    <div style="font-family:Rajdhani,sans-serif;font-size:1rem;color:rgba(255,255,255,0.4);line-height:1.7;">
                        ${data.lockDays} day sentence activated.<br>
                        Find your way out of the cage.
                    </div>
                    <div style="margin-top:40px;width:24px;height:24px;border:2px solid rgba(139,0,0,0.3);border-top-color:rgba(139,0,0,0.7);border-radius:50%;animation:_vaultSpin 0.8s linear infinite;margin:40px auto 0;"></div>
                    <style>@keyframes _vaultSpin{to{transform:rotate(360deg)}}</style>
                </div>
            `;
            // Pre-fetch vault data so vault page has real data immediately (no MOCK)
            const _memberId = state.email || state.memberId || '';
            try {
                const [vaultRes, kneelRes] = await Promise.all([
                    fetch(`/api/vault/session?memberId=${encodeURIComponent(_memberId)}`).then(r => r.json()).catch(() => null),
                    fetch(`/api/kneel-status?memberId=${encodeURIComponent(_memberId)}&tz=${Intl.DateTimeFormat().resolvedOptions().timeZone}`).then(r => r.json()).catch(() => null),
                ]);
                sessionStorage.setItem('_vaultProfileCache', JSON.stringify(state.raw || state));
                if (vaultRes) sessionStorage.setItem('_vaultSessionCache', JSON.stringify(vaultRes));
                if (kneelRes) sessionStorage.setItem('_vaultKneelCache', JSON.stringify(kneelRes));
            } catch {}
            sessionStorage.setItem('_vaultFirstArrival', '1');
            // Redirect to vault after a moment
            setTimeout(() => { window.location.href = '/vault'; }, 2500);
        } catch (err: any) {
            // iOS Safari throws "Load failed" when fetch is cancelled by page navigation.
            // The realtime handler redirects to /vault which kills in-flight fetches.
            // If the proof overlay is gone (redirect happened), don't show error.
            if (!document.getElementById('_vaultVideoOverlay')) return;
            if (err.message === 'Load failed' || err.message === 'cancelled') return;
            alert(err.message || 'Connection error. Try again.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'SUBMIT PROOF';
        }
    });
}

let _vaultRealtimeChannel: any = null;

export async function checkVaultLockStatus() {
    try {
        // Use cached data from splash if available — avoids duplicate API call
        const cached = (window as any)._vaultAwaitingVideo;
        let data: any;
        if (cached) {
            delete (window as any)._vaultAwaitingVideo;
            data = { active: true, status: 'awaiting_video', sessionId: cached.sessionId, lockDays: cached.lockDays };
        } else {
            const res = await fetch('/api/vault/apply');
            data = await res.json();
        }
        _updateVaultLockButton(data);

        // Force video proof overlay if awaiting — user cannot use the app until submitted
        if (data.active && data.status === 'awaiting_video' && data.sessionId) {
            _showVideoProofUpload({ sessionId: data.sessionId, lockDays: data.lockDays });
        }

        // Subscribe to realtime vault session updates
        if (!_vaultRealtimeChannel && data.active && data.sessionId) {
            const sb = createClient();
            _vaultRealtimeChannel = sb
                .channel('vault_session_updates')
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'vault_sessions',
                    filter: `id=eq.${data.sessionId}`,
                }, (payload: any) => {
                    const updated = payload.new;
                    if (updated.status === 'awaiting_video') {
                        _updateVaultLockButton({ active: true, status: 'awaiting_video', sessionId: updated.id, lockDays: updated.lock_days } as any);
                        _showVideoProofUpload({ sessionId: updated.id, lockDays: updated.lock_days });
                    } else if (updated.status === 'active') {
                        _updateVaultLockButton({ active: true, status: 'active', lockDays: updated.lock_days });
                        _showVaultConfirmation(true, updated.lock_days);
                    } else if (updated.status === 'denied') {
                        _updateVaultLockButton(null);
                        _showVaultStatus({ status: 'denied', lockDays: updated.lock_days, coinsPaid: updated.coins_paid });
                    } else if (updated.status === 'scheduled') {
                        _updateVaultLockButton({ active: true, status: 'scheduled', lockDays: updated.lock_days });
                    } else if (updated.status === 'released_early' || updated.status === 'completed') {
                        _updateVaultLockButton(null);
                        _vaultRealtimeChannel?.unsubscribe();
                        _vaultRealtimeChannel = null;
                    }
                })
                .subscribe();
        }
    } catch (_) {}
}

// ─── PROFILE CHAT GIF PICKER ──────────────────────────────────────────────────

let _profileGifOpen = false;
let _profileGifTimeout: ReturnType<typeof setTimeout> | null = null;

async function _sendProfileGif(gifUrl: string) {
    const { memberId } = getState();
    if (!memberId) return;

    try {
        const res = await fetch('/api/chat/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memberId, content: gifUrl, type: 'gif', metadata: { gifUrl } }),
        });
        const data = await res.json();
        if (data.success && data.data) {
            const sentId = _msgId(data.data);
            if (sentId && !_renderedMsgIds.has(sentId)) {
                _renderedMsgIds.add(sentId);
                _lastChatMsgId = sentId;
                if (data.data.created_at) _lastChatMsgTimestamp = data.data.created_at;
                const html = renderChatMessage(data.data);
                ['chatContent', 'mob_chatContent'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.insertAdjacentHTML('beforeend', html);
                });
                _scrollChatDelayed();
            }
        }
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
            <span style="font-family:'Orbitron';font-size:0.32rem;color:rgba(255,255,255,0.12);letter-spacing:1px;">via GIPHY</span>
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
    const existing = document.getElementById('_payMethodPicker');
    if (existing) existing.remove();

    const isMob = window.innerWidth < 768;
    const overlay = document.createElement('div');
    overlay.id = '_payMethodPicker';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);z-index:2147483647;display:flex;align-items:center;justify-content:center;';

    const box = document.createElement('div');
    box.style.cssText = `background:linear-gradient(160deg,#0c0c1a,#08060f);border:1px solid rgba(197,160,89,0.15);border-radius:${isMob ? '14px' : '18px'};padding:${isMob ? '32px 28px' : '48px 52px'};max-width:${isMob ? '340px' : '440px'};width:90%;display:flex;flex-direction:column;align-items:center;gap:${isMob ? '16px' : '22px'};box-shadow:0 30px 80px rgba(0,0,0,0.6),0 0 1px rgba(197,160,89,0.15);`;

    box.innerHTML = `
        <div style="font-family:Cinzel,serif;font-size:${isMob ? '0.85rem' : '1rem'};color:#c5a059;letter-spacing:5px;font-weight:700;">PAYMENT METHOD</div>
        <div style="width:40px;height:1px;background:linear-gradient(90deg,transparent,rgba(197,160,89,0.25),transparent);"></div>
        <div style="font-family:Rajdhani,sans-serif;font-size:${isMob ? '0.7rem' : '0.8rem'};color:rgba(255,255,255,0.3);letter-spacing:3px;font-weight:500;">${amount.toLocaleString()} ROYAL SILVER</div>
        <div style="width:100%;margin-top:8px;display:flex;flex-direction:column;gap:12px;">
            <button id="_payCard" style="width:100%;padding:${isMob ? '16px' : '20px 24px'};background:linear-gradient(135deg,#12122a,#161630);border:1px solid rgba(197,160,89,0.2);border-radius:10px;cursor:pointer;display:flex;align-items:center;gap:14px;transition:all 0.3s ease;">
                <div style="width:42px;height:42px;border-radius:50%;background:rgba(197,160,89,0.06);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.6)" stroke-width="1.5"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                </div>
                <div style="text-align:left;">
                    <div style="font-family:Cinzel,serif;font-size:${isMob ? '0.75rem' : '0.85rem'};color:#f3e5ab;letter-spacing:3px;font-weight:600;">CARD</div>
                    <div style="font-family:Rajdhani,sans-serif;font-size:0.6rem;color:rgba(255,255,255,0.25);letter-spacing:1px;margin-top:2px;">Visa, Mastercard via Stripe</div>
                </div>
            </button>
            <button id="_payCrypto" style="width:100%;padding:${isMob ? '16px' : '20px 24px'};background:linear-gradient(135deg,#14081e,#0e0618);border:1px solid rgba(160,100,220,0.2);border-radius:10px;cursor:pointer;display:flex;align-items:center;gap:14px;transition:all 0.3s ease;">
                <div style="width:42px;height:42px;border-radius:50%;background:rgba(160,100,220,0.06);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(160,100,220,0.6)" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M9 9h4.5a1.5 1.5 0 010 3H9m1.5 0H15a1.5 1.5 0 010 3H9"/></svg>
                </div>
                <div style="text-align:left;">
                    <div style="font-family:Cinzel,serif;font-size:${isMob ? '0.75rem' : '0.85rem'};color:#d4b0f0;letter-spacing:3px;font-weight:600;">CRYPTO</div>
                    <div style="font-family:Rajdhani,sans-serif;font-size:0.6rem;color:rgba(255,255,255,0.25);letter-spacing:1px;margin-top:2px;">Bitcoin, Ethereum, USDT, Litecoin</div>
                </div>
            </button>
        </div>
        <button id="_payCancel" style="background:none;border:none;color:rgba(255,255,255,0.2);font-family:Rajdhani,sans-serif;font-size:0.65rem;letter-spacing:3px;padding:8px 20px;cursor:pointer;margin-top:4px;transition:color 0.2s;">CANCEL</button>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    box.querySelector('#_payCancel')!.addEventListener('click', () => overlay.remove());
    box.querySelector('#_payCard')!.addEventListener('click', () => { overlay.remove(); _processPayment(amount, 'card'); });
    box.querySelector('#_payCrypto')!.addEventListener('click', () => { overlay.remove(); _processPayment(amount, 'crypto'); });
}

async function _processPayment(amount: number, method: 'card' | 'crypto') {
    if (method === 'card') {
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
                console.error('[EXCHEQUER] Stripe error:', data.error);
                alert('Could not initiate payment. Please try again.');
            }
        } catch (err) {
            console.error('[EXCHEQUER] Network error:', err);
            alert('Could not reach payment service. Please try again.');
        }
        return;
    }

    // Crypto — show coin picker first
    _showCryptoCoinPicker(amount);
}

const CRYPTO_OPTIONS = [
    { ticker: 'trc20/usdt', label: 'USDT', sub: 'TRC20 · Stablecoin', color: '#26a17b', icon: '₮' },
    { ticker: 'btc', label: 'BITCOIN', sub: 'BTC · ~10 min', color: '#f7931a', icon: '₿' },
    { ticker: 'eth', label: 'ETHEREUM', sub: 'ETH · ~2 min', color: '#627eea', icon: 'Ξ' },
    { ticker: 'ltc', label: 'LITECOIN', sub: 'LTC · ~2 min', color: '#bfbbbb', icon: 'Ł' },
];

function _showCryptoCoinPicker(amount: number) {
    const existing = document.getElementById('_cryptoCoinPicker');
    if (existing) existing.remove();

    const isMob = window.innerWidth < 768;
    const overlay = document.createElement('div');
    overlay.id = '_cryptoCoinPicker';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);z-index:2147483647;display:flex;align-items:center;justify-content:center;';

    const box = document.createElement('div');
    box.style.cssText = `background:linear-gradient(160deg,#0c0c1a,#08060f);border:1px solid rgba(160,100,220,0.15);border-radius:${isMob ? '14px' : '18px'};padding:${isMob ? '32px 28px' : '48px 52px'};max-width:${isMob ? '360px' : '480px'};width:90%;display:flex;flex-direction:column;align-items:center;gap:${isMob ? '12px' : '18px'};box-shadow:0 30px 80px rgba(0,0,0,0.6),0 0 1px rgba(160,100,220,0.15);`;

    let buttonsHtml = '';
    CRYPTO_OPTIONS.forEach((opt, i) => {
        const rgb = opt.color === '#f7931a' ? '247,147,26' : opt.color === '#26a17b' ? '38,161,123' : opt.color === '#627eea' ? '98,126,234' : '191,187,187';
        buttonsHtml += `
            <button class="_coinBtn" data-idx="${i}" style="width:100%;padding:${isMob ? '14px 16px' : '18px 22px'};background:linear-gradient(135deg,rgba(${rgb},0.05),rgba(${rgb},0.02));border:1px solid rgba(${rgb},0.15);border-radius:10px;cursor:pointer;display:flex;align-items:center;gap:14px;transition:all 0.3s ease;">
                <div style="width:${isMob ? '36px' : '44px'};height:${isMob ? '36px' : '44px'};border-radius:50%;background:rgba(${rgb},0.08);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <span style="font-size:${isMob ? '1.1rem' : '1.3rem'};color:${opt.color};">${opt.icon}</span>
                </div>
                <div style="text-align:left;flex:1;">
                    <div style="font-family:Cinzel,serif;font-size:${isMob ? '0.7rem' : '0.8rem'};color:#f3e5ab;letter-spacing:2px;font-weight:600;">${opt.label}</div>
                    <div style="font-family:Rajdhani,sans-serif;font-size:0.6rem;color:rgba(255,255,255,0.25);letter-spacing:1px;margin-top:2px;">${opt.sub}</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>`;
    });

    box.innerHTML = `
        <div style="font-family:Cinzel,serif;font-size:${isMob ? '0.8rem' : '1rem'};color:#d4b0f0;letter-spacing:5px;font-weight:700;">SELECT CURRENCY</div>
        <div style="width:40px;height:1px;background:linear-gradient(90deg,transparent,rgba(160,100,220,0.25),transparent);"></div>
        <div style="font-family:Rajdhani,sans-serif;font-size:${isMob ? '0.7rem' : '0.8rem'};color:rgba(255,255,255,0.3);letter-spacing:3px;font-weight:500;">${amount.toLocaleString()} ROYAL SILVER</div>
        <div style="width:100%;margin-top:8px;display:flex;flex-direction:column;gap:10px;">
            ${buttonsHtml}
        </div>
        <button id="_coinPickerCancel" style="background:none;border:none;color:rgba(255,255,255,0.2);font-family:Rajdhani,sans-serif;font-size:0.65rem;letter-spacing:3px;padding:8px 20px;cursor:pointer;margin-top:4px;transition:color 0.2s;">BACK</button>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    box.querySelector('#_coinPickerCancel')!.addEventListener('click', () => overlay.remove());

    box.querySelectorAll('._coinBtn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const idx = parseInt((btn as HTMLElement).dataset.idx || '0', 10);
            const selected = CRYPTO_OPTIONS[idx];
            overlay.remove();
            _createCryptoPayment(amount, selected.ticker, selected.label);
        });
    });
}

async function _createCryptoPayment(amount: number, ticker: string, label: string) {
    // Show loading overlay immediately
    const existing = document.getElementById('_cryptoPayOverlay');
    if (existing) existing.remove();

    const loader = document.createElement('div');
    loader.id = '_cryptoPayOverlay';
    loader.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);z-index:2147483647;display:flex;align-items:center;justify-content:center;';
    loader.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:22px;">
            <div style="width:40px;height:40px;border:2px solid rgba(160,100,220,0.15);border-top-color:rgba(160,100,220,0.6);border-radius:50%;animation:_cryptoSpin 0.8s linear infinite;"></div>
            <div style="font-family:Rajdhani,sans-serif;font-size:0.75rem;color:rgba(255,255,255,0.35);letter-spacing:4px;font-weight:500;">PREPARING ${label} PAYMENT...</div>
        </div>
        <style>@keyframes _cryptoSpin{to{transform:rotate(360deg)}}</style>
    `;
    document.body.appendChild(loader);

    try {
        const res = await fetch('/api/crypto/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coins: amount, ticker }),
        });
        const data = await res.json();
        if (!data.success) {
            loader.remove();
            console.error('[EXCHEQUER] Crypto error:', data.error);
            alert('Could not create crypto payment. Please try again.');
            return;
        }
        loader.remove();
        _showCryptoPaymentOverlay(data, amount);
    } catch (err) {
        loader.remove();
        console.error('[EXCHEQUER] Crypto network error:', err);
        alert('Could not reach payment service. Please try again.');
    }
}

function _showCryptoPaymentOverlay(data: { address: string; amount: number; amount_eur: number; currency: string; qr_url: string; order_id: string }, coins: number) {
    const existing = document.getElementById('_cryptoPayOverlay');
    if (existing) existing.remove();

    const isMob = window.innerWidth < 768;
    const overlay = document.createElement('div');
    overlay.id = '_cryptoPayOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);z-index:2147483647;display:flex;align-items:center;justify-content:center;overflow-y:auto;padding:20px;';

    const box = document.createElement('div');
    box.style.cssText = `background:linear-gradient(160deg,#0c0c1a,#08060f);border:1px solid rgba(160,100,220,0.12);border-radius:${isMob ? '14px' : '20px'};padding:${isMob ? '28px 24px' : '44px 48px'};max-width:${isMob ? '380px' : '520px'};width:100%;display:flex;flex-direction:column;align-items:center;gap:${isMob ? '14px' : '18px'};box-shadow:0 40px 100px rgba(0,0,0,0.7),0 0 1px rgba(160,100,220,0.15);`;

    const qrSize = isMob ? 200 : 240;

    box.innerHTML = `
        <div style="font-family:Cinzel,serif;font-size:${isMob ? '0.8rem' : '1.05rem'};color:#d4b0f0;letter-spacing:${isMob ? '4px' : '6px'};font-weight:700;">CRYPTO PAYMENT</div>
        <div style="width:50px;height:1px;background:linear-gradient(90deg,transparent,rgba(160,100,220,0.25),transparent);"></div>
        <div style="font-family:Rajdhani,sans-serif;font-size:${isMob ? '0.7rem' : '0.8rem'};color:rgba(255,255,255,0.3);letter-spacing:3px;font-weight:500;">${coins.toLocaleString()} ROYAL SILVER</div>

        <div style="background:#fff;border-radius:${isMob ? '10px' : '14px'};padding:${isMob ? '12px' : '16px'};margin-top:6px;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(data.address)}" alt="QR Code" style="width:${qrSize}px;height:${qrSize}px;border-radius:6px;display:block;" />
        </div>

        <div style="text-align:center;margin-top:4px;">
            <div style="font-family:Rajdhani,sans-serif;font-size:${isMob ? '0.6rem' : '0.7rem'};color:rgba(255,255,255,0.35);letter-spacing:2px;font-weight:500;margin-bottom:6px;">SEND EXACTLY</div>
            <div style="font-family:Cinzel,serif;font-size:${isMob ? '1.3rem' : '1.6rem'};color:#f3e5ab;letter-spacing:1px;font-weight:700;">${data.amount} <span style="font-size:${isMob ? '0.6rem' : '0.75rem'};color:rgba(160,100,220,0.7);font-weight:500;letter-spacing:2px;">${data.currency}</span></div>
            <div style="font-family:Rajdhani,sans-serif;font-size:${isMob ? '0.6rem' : '0.7rem'};color:rgba(255,255,255,0.2);margin-top:2px;">(€${data.amount_eur.toFixed(2)})</div>
        </div>

        <div style="width:100%;margin-top:4px;">
            <div style="font-family:Rajdhani,sans-serif;font-size:0.6rem;color:rgba(255,255,255,0.3);letter-spacing:2px;font-weight:500;text-align:center;margin-bottom:6px;">WALLET ADDRESS</div>
            <div id="_cryptoAddr" style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:${isMob ? '0.65rem' : '0.75rem'};color:#d4b0f0;background:rgba(160,100,220,0.05);border:1px solid rgba(160,100,220,0.12);border-radius:8px;padding:${isMob ? '10px 14px' : '14px 18px'};word-break:break-all;text-align:center;cursor:pointer;width:100%;box-sizing:border-box;transition:border-color 0.2s;" title="Click to copy">${data.address}</div>
        </div>

        <button id="_cryptoCopy" style="background:rgba(160,100,220,0.08);border:1px solid rgba(160,100,220,0.2);color:#d4b0f0;font-family:Cinzel,serif;font-size:${isMob ? '0.5rem' : '0.6rem'};letter-spacing:3px;font-weight:600;padding:${isMob ? '8px 20px' : '10px 28px'};cursor:pointer;border-radius:6px;transition:all 0.2s;">COPY ADDRESS</button>

        <div style="width:100%;height:1px;background:linear-gradient(90deg,transparent,rgba(160,100,220,0.1),transparent);margin:4px 0;"></div>

        <div id="_cryptoStatus" style="font-family:Rajdhani,sans-serif;font-size:${isMob ? '0.65rem' : '0.75rem'};color:rgba(255,255,255,0.4);letter-spacing:3px;font-weight:500;display:flex;align-items:center;gap:10px;">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#a064dc;animation:_cryptoPulse 1.5s infinite;"></span>
            WAITING FOR PAYMENT...
        </div>

        <div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:${isMob ? '0.6rem' : '0.7rem'};color:rgba(255,255,255,0.18);text-align:center;line-height:1.7;max-width:${isMob ? '300px' : '400px'};">
            Send the exact amount shown above. Your coins will be credited automatically once the transaction is confirmed on the blockchain.
        </div>

        <button id="_cryptoClose" style="background:none;border:none;color:rgba(255,255,255,0.2);font-family:Rajdhani,sans-serif;font-size:0.65rem;letter-spacing:3px;padding:8px 20px;cursor:pointer;margin-top:4px;transition:color 0.2s;">CLOSE</button>
    `;

    // Pulse animation
    const style = document.createElement('style');
    style.textContent = '@keyframes _cryptoPulse{0%,100%{opacity:1}50%{opacity:0.3}}';
    box.appendChild(style);

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Copy address
    const copyFn = () => {
        navigator.clipboard.writeText(data.address).then(() => {
            const btn = document.getElementById('_cryptoCopy');
            if (btn) { btn.textContent = 'COPIED!'; setTimeout(() => { btn.textContent = 'COPY ADDRESS'; }, 2000); }
        });
    };
    box.querySelector('#_cryptoCopy')!.addEventListener('click', copyFn);
    box.querySelector('#_cryptoAddr')!.addEventListener('click', copyFn);

    // Close
    box.querySelector('#_cryptoClose')!.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    // Poll order status every 15s
    let pollCount = 0;
    const maxPolls = 120; // 30 min
    const pollInterval = setInterval(async () => {
        pollCount++;
        if (pollCount > maxPolls || !document.getElementById('_cryptoPayOverlay')) {
            clearInterval(pollInterval);
            return;
        }
        try {
            const pollRes = await fetch(`/api/crypto/status?order_id=${data.order_id}`);
            const pollData = await pollRes.json();
            if (pollData.status === 'completed') {
                clearInterval(pollInterval);
                const statusEl = document.getElementById('_cryptoStatus');
                if (statusEl) {
                    statusEl.innerHTML = '<span style="color:#4caf50;font-weight:700;">&#10003; PAYMENT CONFIRMED</span>';
                }
                setTimeout(() => { overlay.remove(); window.location.reload(); }, 2500);
            }
        } catch { /* ignore poll errors */ }
    }, 15000);
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
        profile: 'mobNavProfile', challenges: 'mobNavChallenges', queen: 'mobNavQueen', global: 'mobNavGlobal',
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
    closeEarnCoinsModal();
    ['mobChatOverlay', 'mobQueenWallOverlay', 'mobGlobalOverlay', 'mobChallengesOverlay'].forEach(id => {
        if (id === except) return;
        const el = document.getElementById(id);
        if (!el) return;
        // Close Queen Wall detail view so grid shows on re-open
        if (id === 'mobQueenWallOverlay') _closeMobPostDetail();
        el.querySelectorAll('video').forEach(v => v.pause());
        el.classList.remove('mob-overlay-open');
        el.classList.remove('mob-chat-fullscreen');
        el.style.height = '';
        el.style.top = '';
        setTimeout(() => { if (!el.classList.contains('mob-overlay-open')) el.style.display = 'none'; }, 360);
    });
    // Collapse stream player + close stream chat
    (window as any)._closeStreamChat?.();
    const streamInner = document.getElementById('streamFloatInner');
    if (streamInner && streamInner.dataset.expanded === '1') {
        (window as any)._streamExpand?.(); // toggles back to small
    }
    // Always restore bottom nav when switching overlays
    const nav = document.getElementById('mobBottomNav');
    if (nav) nav.style.display = '';
    if (except !== 'altar') closeAltarDrawer();
    closeLobby();
    closeQueenMenu();
}

function _isOverlayOpen(id: string) {
    return document.getElementById(id)?.classList.contains('mob-overlay-open') ?? false;
}

export function switchMobChatTab(tab: 'chat' | 'service') {
    // Close wishlist overlay when switching tabs
    const wishlistOv = document.getElementById('mob_TributeOverlay');
    if (wishlistOv) { wishlistOv.style.display = 'none'; wishlistOv.classList.remove('mob-overlay-open'); }

    const chatPanel = document.getElementById('mobChatTabChat');
    const svcPanel = document.getElementById('mobChatTabService');
    const chatBtn = document.getElementById('mobChatBtnChat');
    const svcBtn = document.getElementById('mobChatBtnService');
    const aiBtn = document.getElementById('mobChatBtnAi');
    if (tab === 'chat') {
        if (chatPanel) chatPanel.style.display = 'flex';
        if (svcPanel) svcPanel.style.display = 'none';
        // Active state for chat/ai is handled by toggleAiMode — only clear service here
        if (!_aiMode) {
            if (chatBtn) chatBtn.classList.add('active');
            if (aiBtn) aiBtn.classList.remove('active');
        }
        if (svcBtn) svcBtn.classList.remove('active');
        setTimeout(_scrollChat, 60);
    } else {
        if (chatPanel) chatPanel.style.display = 'none';
        if (svcPanel) svcPanel.style.display = 'flex';
        if (chatBtn) chatBtn.classList.remove('active');
        if (aiBtn) aiBtn.classList.remove('active');
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
    const chatId = getState().memberId || getState().email;
    if (content && !content.children.length && chatId) {
        loadChatHistory(chatId);
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
    // Keyboard-aware resize helper
    const _applyVPHeight = () => {
        if (!el.classList.contains('mob-chat-fullscreen')) return;
        const vp = window.visualViewport;
        const h = vp ? vp.height : window.innerHeight;
        const t = vp ? vp.offsetTop : 0;
        el.style.height = h + 'px';
        el.style.top = t + 'px';
        requestAnimationFrame(() => {
            const box = document.getElementById('mob_chatBox');
            const bc = document.getElementById('mob_chatContent');
            if (box) box.scrollTop = box.scrollHeight + 9999;
            if (bc) bc.scrollTop = bc.scrollHeight + 9999;
        });
    };

    if (input && !(input as any).__mobChatFocusAttached) {
        (input as any).__mobChatFocusAttached = true;
        input.addEventListener('focus', () => {
            const nav = document.getElementById('mobBottomNav');
            if (nav) nav.style.display = 'none';
            el.classList.add('mob-chat-fullscreen');
            const queenBtn = document.querySelector('.mob-nav-queen-btn') as HTMLElement | null;
            if (queenBtn) queenBtn.classList.add('mob-nav-queen-shrink');
            // Aggressively resize during keyboard animation
            _applyVPHeight();
            setTimeout(_applyVPHeight, 100);
            setTimeout(_applyVPHeight, 300);
            setTimeout(_applyVPHeight, 600);
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

    // Same keyboard handling for AI input
    const aiInput = document.getElementById('mob_aiMsgInput');
    if (aiInput && !(aiInput as any).__mobChatFocusAttached) {
        (aiInput as any).__mobChatFocusAttached = true;
        aiInput.addEventListener('focus', () => {
            const nav = document.getElementById('mobBottomNav');
            if (nav) nav.style.display = 'none';
            el.classList.add('mob-chat-fullscreen');
            _applyVPHeight();
            setTimeout(_applyVPHeight, 100);
            setTimeout(_applyVPHeight, 300);
        });
        aiInput.addEventListener('blur', () => {
            const nav = document.getElementById('mobBottomNav');
            if (nav) nav.style.display = '';
            el.classList.remove('mob-chat-fullscreen');
            el.style.height = '';
            el.style.top = '';
        });
    }

    // iOS keyboard: resize overlay to visual viewport when typing
    if (window.visualViewport && !(el as any).__vpAttached) {
        (el as any).__vpAttached = true;
        window.visualViewport.addEventListener('resize', _applyVPHeight);
        window.visualViewport.addEventListener('scroll', _applyVPHeight);
    }
}

export function closeMobChatOverlay() {
    const el = document.getElementById('mobChatOverlay');
    if (!el) return;
    // Reset AI mode on close
    if (_aiMode) toggleAiMode(false);
    // Close tribute overlay if open inside chat
    const tributeOv = document.getElementById('mob_TributeOverlay');
    if (tributeOv) { tributeOv.style.display = 'none'; tributeOv.classList.add('hidden'); }
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
    // Always close detail view so grid shows on re-open
    _closeMobPostDetail();
    // Pause all playing videos before hiding
    el.querySelectorAll('video').forEach(v => v.pause());
    el.classList.remove('mob-overlay-open');
    setTimeout(() => { if (!el.classList.contains('mob-overlay-open')) el.style.display = 'none'; }, 360);
    _setNavActive('profile');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _mobQueenPosts: any[] = [];

async function _loadMobQueenPosts() {
    const container = document.getElementById('mobQWallContent');
    if (!container) return;
    if (container.children.length > 0) return;
    container.innerHTML = `<div style="text-align:center;padding:50px;color:#444;font-family:Orbitron;font-size:0.55rem;letter-spacing:2px">LOADING...</div>`;
    try {
        const email = getState().email || '';
        const res = email
            ? await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'fetch', email }) })
            : await fetch('/api/posts', { cache: 'no-store' });
        const data = await res.json();
        if (!data.success || !data.posts?.length) {
            container.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#333;font-family:Orbitron;font-size:0.75rem;letter-spacing:3px">NO TRANSMISSIONS YET</div>`;
            return;
        }
        _mobQueenPosts = data.posts;
        _renderMobQueenGrid(container);
    } catch {
        container.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#333;font-family:Orbitron;font-size:0.75rem">UNABLE TO LOAD</div>`;
    }
}

function _isCeoUser(): boolean {
    const email = (getState().email || getState().memberId || '').toLowerCase();
    return email === 'ceo@qkarin.com' || email === 'queen@qkarin.com';
}

function _renderMobQueenGrid(container: HTMLElement) {
    const posts = _mobQueenPosts;

    // CEO gets a header bar with "QUEENS DISPATCH" button
    const ceoBar = _isCeoUser()
        ? `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid rgba(197,160,89,0.12);">
            <div style="display:flex;align-items:center;gap:8px;">
                <img src="/queen-nav.png" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:1px solid rgba(197,160,89,0.4);" />
                <span style="font-family:Orbitron;font-size:0.4rem;color:rgba(255,255,255,0.5);letter-spacing:2px;">YOUR FEED</span>
            </div>
            <button onclick="window._openMobCreatePost()" style="display:flex;align-items:center;gap:6px;background:none;border:1px solid rgba(197,160,89,0.4);padding:7px 14px;border-radius:2px;cursor:pointer;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c5a059" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <span style="font-family:Orbitron;font-size:0.35rem;color:#c5a059;letter-spacing:2px;">QUEENS DISPATCH</span>
            </button>
        </div>`
        : '';

    const cells = posts.map((p: any, i: number) => {
        const locked = !p.userHasAccess;
        const isVid = p.media_type === 'video';
        const hasMedia = p.media_url && !String(p.media_url).startsWith('failed');
        const thumbSrc = p.thumbnail_url || (!isVid && hasMedia ? getOptimizedUrl(p.media_url, 400) : '');

        const imgHtml = thumbSrc
            ? `<img src="${thumbSrc}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;${locked ? 'filter:blur(8px) brightness(0.3);transform:scale(1.08);' : ''}" onerror="this.style.display='none'" />`
            : hasMedia && !isVid
                ? `<img src="${getOptimizedUrl(p.media_url, 400)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;${locked ? 'filter:blur(8px) brightness(0.3);transform:scale(1.08);' : ''}" onerror="this.style.display='none'" />`
                : `<div style="width:100%;height:100%;background:radial-gradient(ellipse at center,#15100a 0%,#080808 100%);display:flex;align-items:center;justify-content:center;font-size:1.5rem;color:rgba(197,160,89,0.3);">👑</div>`;

        const videoIcon = isVid && !locked ? `<div style="position:absolute;top:8px;right:8px;z-index:2;"><svg width="18" height="18" viewBox="0 0 24 24" fill="white" opacity="0.9"><polygon points="9.5,7 9.5,17 18,12"/><rect x="4" y="6" width="2" height="12" rx="1" fill="white"/></svg></div>` : '';

        const lockOverlay = locked ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);z-index:2;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.7)" stroke-width="1.8"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke-linecap="round"/></svg></div>` : '';

        return `<div class="qw-grid-cell" onclick="window._openMobPostDetail(${i})" style="position:relative;aspect-ratio:1;overflow:hidden;cursor:pointer;background:#080808;">${imgHtml}${videoIcon}${lockOverlay}</div>`;
    }).join('');

    container.innerHTML = `${ceoBar}<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2px;">${cells}</div>`;
}

// ── Mobile Create Post ───────────────────────────────────────────────────────
let _mobCreatePostFile: File | null = null;

export function _openMobCreatePost() {
    const panel = document.getElementById('mobQwPanel_wall');
    if (!panel) return;
    document.getElementById('mobCreatePostView')?.remove();

    const html = `<div id="mobCreatePostView" style="position:absolute;inset:0;z-index:10;background:#060606;display:flex;flex-direction:column;overflow:hidden;">
        <div style="display:flex;align-items:center;padding:12px 14px;flex-shrink:0;border-bottom:1px solid rgba(255,255,255,0.06);">
            <button onclick="window._closeMobCreatePost()" style="background:none;border:none;cursor:pointer;color:rgba(255,255,255,0.7);font-size:1.4rem;padding:4px 8px;margin-right:10px;">&#8592;</button>
            <div style="flex:1;font-family:Orbitron;font-size:0.55rem;color:rgba(255,255,255,0.8);letter-spacing:3px;">NEW POST</div>
            <button id="mobCreatePostSubmitBtn" onclick="window._submitMobPost()" style="background:#c5a059;color:#000;border:none;font-family:Orbitron;font-size:0.4rem;letter-spacing:2px;padding:8px 16px;border-radius:2px;cursor:pointer;font-weight:700;">POST</button>
        </div>
        <div style="flex:1;overflow-y:auto;padding:16px 14px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;">
            <div id="mobCreatePostPreview" style="width:100%;min-height:200px;background:#0a0a0a;border:1px dashed rgba(197,160,89,0.3);border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;margin-bottom:16px;overflow:hidden;" onclick="document.getElementById('mobCreatePostFileInput').click()">
                <div id="mobCreatePostPlaceholder" style="display:flex;flex-direction:column;align-items:center;gap:10px;">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.4)" stroke-width="1.2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                    <span style="font-family:Orbitron;font-size:0.4rem;color:rgba(197,160,89,0.4);letter-spacing:2px;">TAP TO ADD PHOTO / VIDEO</span>
                </div>
            </div>
            <input type="file" id="mobCreatePostFileInput" accept="image/*,video/*" style="display:none" onchange="window._onMobCreatePostFile(this)" />
            <input id="mobCreatePostTitle" type="text" placeholder="Title (optional)" style="width:100%;background:transparent;border:none;border-bottom:1px solid rgba(197,160,89,0.15);color:#c5a059;font-family:Cinzel,serif;font-size:1rem;padding:10px 0;margin-bottom:12px;outline:none;" />
            <textarea id="mobCreatePostContent" placeholder="Write a caption..." rows="3" style="width:100%;background:transparent;border:none;border-bottom:1px solid rgba(197,160,89,0.15);color:rgba(255,255,255,0.8);font-family:Rajdhani,sans-serif;font-size:0.9rem;padding:10px 0;margin-bottom:16px;outline:none;resize:none;line-height:1.5;"></textarea>
            <div id="mobCreatePostStatus" style="font-family:Orbitron;font-size:0.4rem;color:rgba(197,160,89,0.5);letter-spacing:1.5px;text-align:center;"></div>
        </div>
    </div>`;

    panel.insertAdjacentHTML('beforeend', html);
    _mobCreatePostFile = null;
}

export function _closeMobCreatePost() {
    _mobCreatePostFile = null;
    document.getElementById('mobCreatePostView')?.remove();
}

export function _onMobCreatePostFile(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    _mobCreatePostFile = file;

    const preview = document.getElementById('mobCreatePostPreview');
    if (!preview) return;

    const placeholder = document.getElementById('mobCreatePostPlaceholder');
    if (placeholder) placeholder.style.display = 'none';

    // Show preview
    if (isVideo(file)) {
        const url = URL.createObjectURL(file);
        preview.innerHTML = `<video src="${url}" playsinline muted style="width:100%;max-height:400px;object-fit:cover;display:block;" onloadeddata="this.currentTime=1"></video>`;
    } else {
        const url = URL.createObjectURL(file);
        preview.innerHTML = `<img src="${url}" style="width:100%;max-height:400px;object-fit:cover;display:block;" />`;
    }
}

export async function _submitMobPost() {
    const title = (document.getElementById('mobCreatePostTitle') as HTMLInputElement)?.value?.trim() || '';
    const content = (document.getElementById('mobCreatePostContent') as HTMLTextAreaElement)?.value?.trim() || '';
    const status = document.getElementById('mobCreatePostStatus');
    const btn = document.getElementById('mobCreatePostSubmitBtn') as HTMLButtonElement;

    if (!title && !content && !_mobCreatePostFile) {
        if (status) status.textContent = 'ADD A PHOTO OR WRITE SOMETHING';
        return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'POSTING...'; btn.style.opacity = '0.5'; }
    if (status) status.textContent = _mobCreatePostFile ? 'UPLOADING MEDIA...' : 'CREATING POST...';

    try {
        let media_url: string | null = null;
        let thumbnail_url: string | null = null;
        let media_type = 'text';

        if (_mobCreatePostFile) {
            const file = _mobCreatePostFile;
            const fileIsVideo = isVideo(file);
            media_type = fileIsVideo ? 'video' : 'image';

            if (status) status.textContent = 'UPLOADING...';
            const url = await uploadToSupabase('media', 'queen_posts', file);
            if (url.startsWith('failed')) throw new Error('Upload failed — ' + url);
            media_url = url;

            // Generate thumbnail for videos
            if (fileIsVideo) {
                if (status) status.textContent = 'GENERATING THUMBNAIL...';
                thumbnail_url = await extractAndUploadVideoThumbnail(file);
            }
        }

        if (status) status.textContent = 'SAVING POST...';
        const res = await fetch('/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: title || null, content: content || null, media_url, thumbnail_url, media_type }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Failed to create post');

        // Close form, clear cache, and reload grid
        _closeMobCreatePost();
        const container = document.getElementById('mobQWallContent');
        if (container) container.innerHTML = '';
        _mobQueenPosts = [];
        _loadMobQueenPosts();
    } catch (err: any) {
        if (status) status.textContent = err.message?.includes('VIDEO_TOO_LONG') ? err.message.split(':').pop() : 'FAILED: ' + (err.message || 'UNKNOWN ERROR');
        if (btn) { btn.disabled = false; btn.textContent = 'POST'; btn.style.opacity = '1'; }
    }
}

function _buildMobPostDetailHtml(startIndex: number): string {
    const posts = _mobQueenPosts;
    const postsHtml = posts.slice(startIndex).map((p: any) => {
        const locked = !p.userHasAccess;
        const isVideo = p.media_type === 'video';
        const d = new Date(p.created_at || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
        const likeCount = p.likes || 0;
        const liked = p.userHasLiked || false;

        let mediaHtml = '';
        if (p.media_url && !String(p.media_url).startsWith('failed')) {
            if (locked) {
                const previewUrl = p.thumbnail_url || (!isVideo ? getOptimizedUrl(p.media_url, 600) : '');
                mediaHtml = `<div style="position:relative;width:100%;overflow:hidden;">
                    ${previewUrl ? `<img src="${previewUrl}" alt="" style="width:100%;display:block;object-fit:cover;max-height:500px;filter:blur(14px) brightness(0.3);transform:scale(1.06);" />` : `<div style="width:100%;height:250px;background:radial-gradient(ellipse at center,#15100a 0%,#080808 100%);"></div>`}
                    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(0,0,0,0.4);">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.7)" stroke-width="1.8"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke-linecap="round"/></svg>
                        ${p.price > 0 ? `<div style="font-family:Orbitron;font-size:0.5rem;color:#c5a059;letter-spacing:1.5px;">${p.price} COINS</div>` : ''}
                        ${p.min_rank && p.min_rank !== 'Hall Boy' ? `<div style="font-family:Orbitron;font-size:0.38rem;color:#555;letter-spacing:1.5px;">REQUIRES ${(p.min_rank || '').toUpperCase()}</div>` : ''}
                        ${p.price > 0 ? `<button onclick="window.unlockPost('${p.id}', ${p.price})" style="background:#c5a059;color:#000;border:none;font-family:Orbitron;font-size:0.45rem;letter-spacing:2px;padding:8px 18px;border-radius:2px;cursor:pointer;font-weight:700;">UNLOCK</button>` : ''}
                    </div>
                </div>`;
            } else if (isVideo) {
                mediaHtml = `<div style="position:relative;width:100%;background:#000;cursor:pointer;" onclick="var v=this.querySelector('video');var t=this.querySelector('.vid-thumb');if(t)t.style.display='none';if(v){this.querySelector('.vid-play-btn').style.display='none';v.style.pointerEvents='auto';v.setAttribute('controls','');this.onclick=null;this.style.cursor='default';v.play().catch(function(){});}"><div class="vid-play-btn" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:2;"><div style="width:56px;height:56px;border-radius:50%;background:rgba(197,160,89,0.9);display:flex;align-items:center;justify-content:center;font-size:1.5rem;">▶</div></div>${p.thumbnail_url ? `<img src="${p.thumbnail_url}" class="vid-thumb" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1;" />` : ''}<video src="${p.media_url}" playsinline preload="metadata" style="width:100%;display:block;object-fit:cover;pointer-events:none;"></video></div>`;
            } else {
                mediaHtml = `<img src="${getOptimizedUrl(p.media_url, 800)}" alt="" style="width:100%;display:block;object-fit:cover;" onerror="if(!this.dataset.retried){this.dataset.retried='1';this.src='/api/media?url='+encodeURIComponent(this.src);}" />`;
            }
        }

        const likeId = String(p.id);
        const heartSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="${liked ? '#e03050' : 'none'}" stroke="${liked ? '#e03050' : 'rgba(255,255,255,0.7)'}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;

        return `<div style="border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:16px;margin-bottom:16px;">
            <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;">
                <img src="/queen-nav.png" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:1px solid rgba(197,160,89,0.4);" />
                <div style="flex:1;">
                    <div style="font-family:'Cinzel',serif;font-size:0.45rem;color:#c5a059;letter-spacing:2px;">QUEEN KARIN</div>
                    <div style="font-family:Rajdhani;font-size:0.7rem;color:rgba(255,255,255,0.35);">${d}</div>
                </div>
            </div>
            ${mediaHtml}
            <div style="padding:10px 14px 0;">
                <div style="display:flex;align-items:center;gap:14px;margin-bottom:8px;">
                    <button onclick="window.togglePostLike('${likeId}',this.querySelector('svg'))" style="background:none;border:none;cursor:pointer;padding:2px;">${heartSvg}</button>
                    <span style="font-family:Orbitron;font-size:0.42rem;color:rgba(255,255,255,0.4);letter-spacing:1px;" id="likeCount_${likeId}">${likeCount}</span>
                </div>
                ${p.title ? `<div style="font-family:Cinzel,serif;font-size:0.95rem;color:#c5a059;margin-bottom:4px;">${p.title}</div>` : ''}
                ${!locked && p.content ? `<div style="font-family:Rajdhani,sans-serif;font-size:0.85rem;color:rgba(255,255,255,0.75);line-height:1.5;">${p.content}</div>` : ''}
            </div>
        </div>`;
    }).join('');

    return `<div id="mobPostDetailView" style="position:absolute;inset:0;z-index:10;background:#060606;display:flex;flex-direction:column;overflow:hidden;">
        <div style="display:flex;align-items:center;padding:12px 14px;flex-shrink:0;border-bottom:1px solid rgba(255,255,255,0.06);">
            <button onclick="window._closeMobPostDetail()" style="background:none;border:none;cursor:pointer;color:rgba(255,255,255,0.7);font-size:1.4rem;padding:4px 8px;margin-right:10px;">&#8592;</button>
            <div style="font-family:Orbitron;font-size:0.55rem;color:rgba(255,255,255,0.8);letter-spacing:3px;">POSTS</div>
        </div>
        <div style="flex:1;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;">${postsHtml}</div>
    </div>`;
}

export function _openMobPostDetail(index: number) {
    const panel = document.getElementById('mobQwPanel_wall');
    if (!panel) return;
    // Remove existing detail view if any
    document.getElementById('mobPostDetailView')?.remove();
    panel.insertAdjacentHTML('beforeend', _buildMobPostDetailHtml(index));
}

export function _closeMobPostDetail() {
    const detail = document.getElementById('mobPostDetailView');
    if (!detail) return;
    // Pause any playing videos
    detail.querySelectorAll('video').forEach(v => v.pause());
    detail.remove();
}

// ─── MOB GLOBAL OVERLAY ──────────────────────────────────────────────────────
const _mobGlLoaded: Record<string, boolean> = {};
let _mobGlActivePeriod = 'today';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _mobGlRealtimeChannel: any = null;
const _mobGlPendingSent = new Set<string>();
let _mobGlPollInterval: ReturnType<typeof setInterval> | null = null;
let _mobGlLastMsgId: string | null = null;

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
    // Close inline risky if open
    const irOv = document.getElementById('inlineRiskyOverlay');
    if (irOv) irOv.style.display = 'none';
    el.classList.remove('mob-overlay-open');
    setTimeout(() => { if (!el.classList.contains('mob-overlay-open')) el.style.display = 'none'; }, 360);
    _setNavActive('profile');
    if (_mobGlRealtimeChannel) { _mobGlRealtimeChannel.unsubscribe(); _mobGlRealtimeChannel = null; }
    if (_mobGlPollInterval) { clearInterval(_mobGlPollInterval); _mobGlPollInterval = null; }
    _mobGlLoaded['talk'] = false;
}

export function openMobChallenges() {
    if (_isOverlayOpen('mobChallengesOverlay')) { closeMobChallenges(); return; }
    _closeAllMobOverlays('mobChallengesOverlay');
    const el = document.getElementById('mobChallengesOverlay');
    if (!el) return;
    el.style.display = 'flex';
    requestAnimationFrame(() => el.classList.add('mob-overlay-open'));
    _setNavActive('challenges');
}

export function closeMobChallenges() {
    const el = document.getElementById('mobChallengesOverlay');
    if (!el) return;
    el.classList.remove('mob-overlay-open');
    setTimeout(() => { if (!el.classList.contains('mob-overlay-open')) el.style.display = 'none'; }, 360);
    _setNavActive('profile');
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
    // Clear ALL cached rank periods so switching always re-renders
    Object.keys(_mobGlLoaded).forEach(k => { if (k.startsWith('rank')) delete _mobGlLoaded[k]; });
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
        const MEDAL_COLORS_MOB = ['#c5a059', '#C0C0C0', '#CD7F32'];
        const DEFAULT_AV = '/collar-placeholder.png';
        const top3 = entries.slice(0, 3);
        const rest = entries.slice(3);

        const top3Html = top3.map((e: any, i: number) => {
            const av = getOptimizedUrl(e.avatar, 100) || DEFAULT_AV;
            return `
            <div class="mob-gl-rank-row mob-gl-rank-row--top mob-gl-rank-row--rank${i + 1}">
                <div class="mob-gl-rank-medal">${MEDALS_MOB[i]}</div>
                <img src="${av}" class="mob-gl-rank-avatar mob-gl-rank-avatar--top" alt="" onerror="this.onerror=null;this.src='${DEFAULT_AV}'"/>
                <div class="mob-gl-rank-info">
                    <div class="mob-gl-rank-name mob-gl-rank-name--top">${e.name || e.member_id || 'SLAVE'}</div>
                    ${e.hierarchy ? `<div class="mob-gl-rank-tier" style="color:${MEDAL_COLORS_MOB[i]}">${e.hierarchy}</div>` : ''}
                </div>
                <span class="mob-gl-rank-score mob-gl-rank-score--top" style="color:${MEDAL_COLORS_MOB[i]}">${(e.score ?? 0).toLocaleString()}</span>
            </div>`;
        }).join('');

        const restHtml = rest.map((e: any, i: number) => {
            const av = getOptimizedUrl(e.avatar, 80) || DEFAULT_AV;
            return `
            <div class="mob-gl-rank-row">
                <span class="mob-gl-rank-num">${i + 4}</span>
                <img src="${av}" class="mob-gl-rank-avatar" alt="" onerror="this.onerror=null;this.src='${DEFAULT_AV}'"/>
                <div class="mob-gl-rank-info">
                    <div class="mob-gl-rank-name">${e.name || e.member_id || 'SLAVE'}</div>
                    ${e.hierarchy ? `<div class="mob-gl-rank-tier">${e.hierarchy}</div>` : ''}
                </div>
                <span class="mob-gl-rank-score">${(e.score ?? 0).toLocaleString()}</span>
            </div>`;
        }).join('');

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
        const msgs: any[] = (data.messages || []).filter((m: any) => {
            const c = m.message || '';
            return !c.startsWith('UPDATE_COINS_CARD::') && !c.startsWith('UPDATE_MERIT_CARD::');
        });
        _renderMobGlTalk(msgs);
        if (msgs.length) _mobGlLastMsgId = String(msgs[msgs.length - 1].id || '');
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
                const content = msg.message || '';
                if (content.startsWith('UPDATE_COINS_CARD::') || content.startsWith('UPDATE_MERIT_CARD::')) return;
                const dedupKey = msg.media_url || content;
                if (_mobGlPendingSent.has(dedupKey)) {
                    _mobGlPendingSent.delete(dedupKey);
                    return;
                }
                if (msg.id) _mobGlLastMsgId = String(msg.id);
                _appendMobGlMessage(msg);
            }
        )
        .subscribe();

    // Safety-net poll every 30s — catches dead channels, missed events, network switches
    if (_mobGlPollInterval) clearInterval(_mobGlPollInterval);
    _mobGlPollInterval = setInterval(_pollMobGlMessages, 30000);
}

async function _pollMobGlMessages() {
    const container = document.getElementById('mobGlTalkFeed');
    if (!container) return;
    try {
        const res = await fetch('/api/global/messages', { cache: 'no-store' });
        const data = await res.json();
        const msgs: any[] = (data.messages || []).filter((m: any) => {
            const c = m.message || '';
            return !c.startsWith('UPDATE_COINS_CARD::') && !c.startsWith('UPDATE_MERIT_CARD::');
        });
        if (!msgs.length) return;
        const latestId = String(msgs[msgs.length - 1].id || '');
        if (latestId && latestId !== _mobGlLastMsgId) {
            // New messages exist that we haven't rendered — re-render the full list
            _mobGlLastMsgId = latestId;
            _renderMobGlTalk(msgs);
        }
    } catch {}
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
    const msgId = String(msg.id || '');
    const nameSafe = name.replace(/'/g, '&#39;').replace(/\\/g, '\\\\');
    const contentSafe = content.slice(0, 80).replace(/'/g, '&#39;').replace(/\\/g, '\\\\').replace(/\n/g, ' ');
    const SVG_REPLY_MOB = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path></svg>`;
    const SVG_CROWN_MOB = `<svg width="11" height="9" viewBox="0 0 26 20" fill="#c5a059" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M2 18 L5 8 L10 13 L13 3 L16 13 L21 8 L24 18 Z"/><rect x="2" y="17" width="22" height="2" rx="1"/></svg>`;
    const replyBtn = msgId ? `<button class="mob-gl-reply-btn" onclick="event.stopPropagation();window.setMobGlReply('${msgId}','${nameSafe}','${contentSafe}')" title="Reply">${SVG_REPLY_MOB}</button>` : '';
    const quoteHtml = msg.reply_to ? `<div style="border-left:2px solid rgba(197,160,89,0.5);padding:3px 8px;margin-bottom:4px;background:rgba(197,160,89,0.05);border-radius:0 4px 4px 0;">
        <div style="display:flex;align-items:center;gap:4px;font-family:'Orbitron';font-size:0.3rem;color:rgba(197,160,89,0.7);letter-spacing:1px;margin-bottom:1px;white-space:nowrap;overflow:hidden;"><svg width="9" height="9" viewBox="0 0 20 20" fill="none" stroke="rgba(197,160,89,0.7)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="8 16 3 11 8 6"></polyline><path d="M17 4v7a4 4 0 0 1-4 4H3"></path></svg><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${(msg.reply_to.sender_name || '').replace(/</g, '&lt;')}</span></div>
        <div style="font-family:'Rajdhani';font-size:0.75rem;color:rgba(255,255,255,0.38);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${(msg.reply_to.content || '').slice(0, 55).replace(/</g, '&lt;')}</div>
    </div>` : '';

    // STREAM LIVE CARD
    if (content.startsWith('STREAM_LIVE::')) {
        return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;">
            <div style="width:85%;max-width:340px;min-width:200px;">
                <div style="width:100%;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#1a0505 0%,#2a0808 60%,#1a0505 100%);border:1px solid rgba(239,68,68,0.5);box-shadow:0 12px 40px rgba(0,0,0,0.8),0 0 30px rgba(239,68,68,0.08);">
                    <div style="padding:20px;text-align:center;">
                        <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:14px;">
                            <div style="width:10px;height:10px;border-radius:50%;background:#ef4444;animation:livePulse 1.5s ease-in-out infinite;"></div>
                            <span style="font-family:'Orbitron',sans-serif;font-size:0.55rem;color:#ef4444;letter-spacing:3px;">LIVE NOW</span>
                        </div>
                        <div style="font-family:'Cinzel',serif;font-size:1rem;color:#fff;font-weight:700;letter-spacing:2px;margin-bottom:6px;">QUEEN KARIN</div>
                        <div style="font-family:'Rajdhani',sans-serif;font-size:0.85rem;color:rgba(255,255,255,0.5);margin-bottom:16px;">is streaming right now</div>
                        <a href="/profile" style="display:inline-block;padding:10px 28px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.5);border-radius:10px;text-decoration:none;font-family:'Orbitron',sans-serif;font-size:0.45rem;color:#ef4444;letter-spacing:3px;">JOIN STREAM</a>
                    </div>
                </div>
                <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div>
            </div>
        </div>`;
    }

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

    // ROUTINE CHANGE CARD - desktop global chat
    if (content.startsWith('ROUTINE_CHANGE::')) {
        try {
            const d = JSON.parse(content.replace('ROUTINE_CHANGE::', ''));
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;">
                <div style="width:85%;max-width:340px;min-width:200px;">
                    <div style="width:100%;border-radius:14px;overflow:hidden;background:linear-gradient(170deg,#0c0806 0%,#0e0a04 60%,#0a0703 100%);border:1px solid rgba(197,160,89,0.35);box-shadow:0 10px 35px rgba(0,0,0,0.7);">
                        <div style="padding:18px 20px;text-align:center;">
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(197,160,89,0.5);letter-spacing:3px;margin-bottom:12px;">ROUTINE UPDATED</div>
                            <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
                                <span style="font-family:'Rajdhani',sans-serif;font-size:0.82rem;color:rgba(255,255,255,0.3);text-decoration:line-through;">${(d.oldRoutine || 'None').toUpperCase()}</span>
                                <span style="color:rgba(197,160,89,0.6);font-size:0.85rem;">\u2192</span>
                                <span style="font-family:'Cinzel',serif;font-size:0.9rem;color:#c5a059;font-weight:700;letter-spacing:1px;">${(d.newRoutine || 'None').toUpperCase()}</span>
                            </div>
                            <div style="width:60%;height:1px;background:linear-gradient(to right,transparent,rgba(197,160,89,0.25),transparent);margin:0 auto;"></div>
                        </div>
                    </div>
                    <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div>
                </div>
            </div>`;
        } catch { /* fall through */ }
    }

    // WELCOME CARD (new member) - desktop global chat
    if (content.startsWith('WELCOME_CARD::')) {
        try {
            const d = JSON.parse(content.replace('WELCOME_CARD::', ''));
            const wIni = (d.name || 'S')[0].toUpperCase();
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:8px;">
                <div style="width:85%;max-width:340px;min-width:200px;">
                    <div style="width:100%;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0c0a04 0%,#13100a 50%,#0c0a04 100%);border:1px solid rgba(197,160,89,0.6);box-shadow:0 12px 40px rgba(0,0,0,0.8),0 0 30px rgba(197,160,89,0.08);">
                        <div style="width:100%;padding:20px 0 14px;display:flex;flex-direction:column;align-items:center;background:radial-gradient(ellipse at center top,rgba(197,160,89,0.1) 0%,transparent 70%);">
                            <div style="width:60px;height:60px;border-radius:50%;border:2px solid rgba(197,160,89,0.6);display:flex;align-items:center;justify-content:center;font-family:'Cinzel',serif;font-size:1.5rem;color:#c5a059;background:radial-gradient(circle,rgba(197,160,89,0.12) 0%,rgba(197,160,89,0.03) 100%);box-shadow:0 0 20px rgba(197,160,89,0.15),0 0 40px rgba(197,160,89,0.05);">${wIni}</div>
                        </div>
                        <div style="padding:4px 18px 20px;text-align:center;">
                            <div style="font-family:'Cinzel',serif;font-size:1rem;color:#fff;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:6px;">${d.name || ''}</div>
                            <div style="width:40%;height:1px;background:linear-gradient(to right,transparent,rgba(197,160,89,0.5),transparent);margin:0 auto 8px;"></div>
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(197,160,89,0.65);letter-spacing:3px;margin-bottom:12px;">HAS ENTERED THE COURT</div>
                            <div style="display:inline-flex;align-items:center;gap:5px;background:rgba(197,160,89,0.06);border:1px solid rgba(197,160,89,0.25);border-radius:20px;padding:4px 14px;"><svg width="13" height="10" viewBox="0 0 26 20" fill="#c5a059"><path d="M2 18 L5 8 L10 13 L13 3 L16 13 L21 8 L24 18 Z"/><rect x="2" y="17" width="22" height="2" rx="1"/></svg><span style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:#c5a059;letter-spacing:2px;">${(d.rank || 'HALL BOY').toUpperCase()}</span></div>
                        </div>
                    </div>
                    <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div>
                </div>
            </div>`;
        } catch { /* fall through */ }
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

    const hasPhoto = msg.media_url && msg.media_type !== 'video' && msg.media_type !== 'gif';
    const hasVideo = msg.media_url && msg.media_type === 'video';
    const _mobPlaySvg = `<svg width="44" height="44" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="23" fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.4)" stroke-width="2"/><path d="M19 14.5L35 24L19 33.5V14.5Z" fill="rgba(255,255,255,0.9)"/></svg>`;
    const _mobThumbStyle = msg.thumbnail_url ? `background-image:url('${msg.thumbnail_url.replace(/'/g, "\\'")}');background-size:cover;background-position:center;` : 'background:#0a0a0a;';
    const isGif = (content === '[GIF]' && msg.media_url);
    const _isMediaOnly = (hasVideo || hasPhoto || isGif) && (!content || content === '[VIDEO]' || content === '[PHOTO]' || content === '[GIF]');
    const mediaHtml = msg.media_url
        ? (hasVideo
            ? `<div style="margin-top:6px;width:160px;aspect-ratio:3/4;border-radius:10px;overflow:hidden;position:relative;cursor:pointer;${_mobThumbStyle}display:flex;align-items:center;justify-content:center;" onclick="window._openGlobalLightbox&&window._openGlobalLightbox('${msg.media_url.replace(/'/g, "\\'")}','video')">${_mobPlaySvg}</div>`
            : isGif
                ? `<img src="${msg.media_url}" style="max-width:200px;width:auto;height:auto;max-height:180px;border-radius:10px;display:block;margin-top:4px;" />`
                : `<div style="margin-top:6px;width:160px;aspect-ratio:3/4;border-radius:10px;overflow:hidden;cursor:pointer;" onclick="window._openGlobalLightbox&&window._openGlobalLightbox('${(msg.media_url||'').replace(/'/g,"\\'")}')"><img src="${msg.media_url}" style="width:100%;height:100%;object-fit:cover;display:block;" /></div>`)
        : '';

    // Like button
    const _likeId = msgId || `${(msg.created_at || '')}::${senderEmail}`;
    const _liked = typeof window !== 'undefined' && (window as any)._toggleGlobalLike ? (function(){ try { const s = JSON.parse(localStorage.getItem('gl_liked_msgs') || '[]'); return s.includes(_likeId); } catch { return false; } })() : false;
    const _heartSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="${_liked ? '#e03050' : 'none'}" stroke="${_liked ? '#e03050' : 'rgba(255,255,255,0.3)'}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
    const _likeBtn = `<button onclick="event.stopPropagation();window._toggleGlobalLike&&window._toggleGlobalLike('${_likeId.replace(/'/g, "\\'")}',this)" style="background:none;border:none;cursor:pointer;padding:3px;display:flex;align-items:center;transition:transform 0.15s;" title="Like">${_heartSvg}</button>`;

    const av = msg.sender_avatar || null;
    const avatarHtml = av
        ? `<img src="${av}" style="width:18px;height:18px;border-radius:50%;object-fit:cover;border:1px solid rgba(197,160,89,0.4);flex-shrink:0;" onerror="this.style.display='none'">`
        : `<div style="width:18px;height:18px;border-radius:50%;background:rgba(197,160,89,0.15);border:1px solid rgba(197,160,89,0.25);display:flex;align-items:center;justify-content:center;font-family:Orbitron;font-size:0.38rem;color:#c5a059;flex-shrink:0;">${(name[0]||'S').toUpperCase()}</div>`;

    // ── QUEEN bubble ──
    if (isQueen) {
        const _qHeader = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;gap:6px;">
            <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
                <img src="/queen-nav.png" style="width:22px;height:22px;border-radius:50%;object-fit:cover;border:1.5px solid rgba(197,160,89,0.7);flex-shrink:0;">
                <div style="display:flex;align-items:center;gap:4px;white-space:nowrap;flex-shrink:0;">${SVG_CROWN_MOB}<span style="font-family:'Cinzel',serif;font-size:0.72rem;color:#c5a059;letter-spacing:1px;font-weight:700;white-space:nowrap;">QUEEN KARIN</span></div>
                <span style="font-family:'Orbitron';font-size:0.38rem;color:rgba(197,160,89,0.6);white-space:nowrap;flex-shrink:0;"> · ${time}</span>
            </div>
            <div style="display:flex;align-items:center;gap:4px;">${_likeBtn}${replyBtn}</div>
        </div>`;
        const qContent = ((content === '[GIF]' || content === '[VIDEO]' || content === '[PHOTO]') && msg.media_url) ? '' : content;

        if (_isMediaOnly) {
            // Frameless — just header + media
            return `<div style="padding:4px 10px;margin-bottom:6px;">
                ${_qHeader}
                ${mediaHtml}
            </div>`;
        }
        // Text bubble with gold frame
        return `<div style="padding:8px 12px 10px;margin-bottom:6px;background:linear-gradient(135deg,rgba(197,160,89,0.14),rgba(100,75,15,0.08));border:1.5px solid rgba(197,160,89,0.75);border-radius:10px;box-shadow:0 0 14px rgba(197,160,89,0.12);overflow:hidden;">
            ${_qHeader}
            ${quoteHtml}${qContent ? `<span style="font-family:'Rajdhani',sans-serif;font-size:0.95rem;color:rgba(255,255,255,0.7);line-height:1.5;">${qContent}</span>` : ''}
            ${mediaHtml}
        </div>`;
    }

    // DIRECT TRIBUTE CARD (coin send)
    if (content.startsWith('DIRECT_TRIBUTE_CARD::')) {
        try {
            const d = JSON.parse(content.replace('DIRECT_TRIBUTE_CARD::', ''));
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;"><div style="width:220px;border-radius:14px;overflow:hidden;background:linear-gradient(170deg,#0e0b06,#0d0a04,#0a0703);border:1px solid rgba(197,160,89,0.5);box-shadow:0 8px 30px rgba(0,0,0,0.6);text-align:center;padding:20px 16px;"><div style="font-size:1.8rem;margin-bottom:8px;">\u2728</div><div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(197,160,89,0.6);letter-spacing:3px;margin-bottom:10px;">TRIBUTE SENT</div><div style="font-family:'Orbitron',sans-serif;font-size:1.2rem;color:#c5a059;font-weight:700;margin-bottom:4px;">${(d.amount||0).toLocaleString()}</div><div style="font-family:'Rajdhani',sans-serif;font-size:0.5rem;color:rgba(197,160,89,0.4);letter-spacing:2px;margin-bottom:12px;">COINS</div><div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(255,255,255,0.35);">${d.senderName||''}</div></div></div>`;
        } catch { /* fall through */ }
    }

    // RISKY TRIBUTE CARD (gamble result)
    if (content.startsWith('RISKY_TRIBUTE_CARD::')) {
        try {
            const d = JSON.parse(content.replace('RISKY_TRIBUTE_CARD::', ''));
            const isWin = d.isWin;
            const borderColor = isWin ? 'rgba(197,160,89,0.5)' : d.lostAmount === 0 ? 'rgba(74,222,128,0.4)' : 'rgba(220,50,80,0.4)';
            const bg = isWin ? '#0e0b06' : d.lostAmount === 0 ? '#060e08' : '#0e0606';
            const resultText = isWin ? `WON +${(d.wonAmount||0).toLocaleString()}` : d.lostAmount === 0 ? 'NO LOSS' : `LOST ${(d.lostAmount||0).toLocaleString()}`;
            const resultColor = isWin ? '#c5a059' : d.lostAmount === 0 ? '#4ade80' : '#e03050';
            const rIconHtml = d.icon && d.icon.startsWith('/') ? `<img src="${d.icon}" style="width:70px;height:auto;">` : `<div style="font-size:2.2rem;">${d.icon||'🎰'}</div>`;
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;"><div style="width:min(90%,320px);"><div style="border-radius:14px;overflow:hidden;background:linear-gradient(170deg,${bg},#0a0a14);border:1px solid ${borderColor};box-shadow:0 8px 30px rgba(0,0,0,0.6);padding:14px 16px;"><div style="display:flex;align-items:center;gap:14px;"><div style="flex-shrink:0;width:70px;display:flex;align-items:center;justify-content:center;">${rIconHtml}</div><div style="flex:1;min-width:0;"><div style="font-family:'Cinzel',serif;font-size:0.8rem;color:rgba(255,255,255,0.85);font-weight:700;margin-bottom:4px;">${d.senderName||''}</div><div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(255,255,255,0.35);letter-spacing:2px;margin-bottom:3px;">RISKY SEND</div><div style="font-family:'Orbitron',sans-serif;font-size:0.45rem;color:${resultColor};letter-spacing:1px;font-weight:700;margin-bottom:3px;">${d.cardName||''}</div><div style="font-family:'Rajdhani',sans-serif;font-size:0.75rem;color:rgba(255,255,255,0.45);">Staked ${(d.stakeAmount||0).toLocaleString()} · <span style="color:${resultColor};font-weight:700;">${resultText}</span></div></div></div></div><div style="margin-top:8px;text-align:center;"><button onclick="if(window.openInlineRisky){window.openInlineRisky();}" style="background:linear-gradient(135deg,rgba(197,160,89,0.15),rgba(197,160,89,0.05));border:1px solid rgba(197,160,89,0.4);color:#c5a059;font-family:'Orbitron',sans-serif;font-size:0.4rem;letter-spacing:2px;padding:6px 20px;border-radius:20px;cursor:pointer;">TRY YOUR LUCK</button></div></div></div>`;
        } catch { /* fall through */ }
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

    // LEADERBOARD REWARD CARD
    if (content.startsWith('LEADERBOARD_REWARD_CARD::')) {
        try {
            const d = JSON.parse(content.replace('LEADERBOARD_REWARD_CARD::', ''));
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;">
                <div style="width:85%;max-width:340px;min-width:200px;">
                    <div style="width:100%;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0e0b06 0%,#110d04 60%,#0a0703 100%);border:1px solid rgba(197,160,89,0.6);box-shadow:0 12px 40px rgba(0,0,0,0.8),0 0 30px rgba(197,160,89,0.1);">
                        <div style="padding:20px 20px;text-align:center;">
                            <div style="font-size:1.6rem;margin-bottom:6px;">👑</div>
                            <div style="font-family:'Cinzel',serif;font-size:0.8rem;color:#c5a059;letter-spacing:3px;margin-bottom:4px;">${d.title || 'CHAMPION'}</div>
                            <div style="width:40%;height:1px;background:linear-gradient(to right,transparent,rgba(197,160,89,0.5),transparent);margin:8px auto;"></div>
                            ${d.winnerName ? `<div style="font-family:'Orbitron',sans-serif;font-size:0.85rem;color:#fff;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">${d.winnerName}</div>` : ''}
                            <div style="font-family:'Rajdhani',sans-serif;font-size:0.95rem;color:rgba(255,255,255,0.8);margin-bottom:6px;">${d.rewards || ''}</div>
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(197,160,89,0.5);letter-spacing:2px;">SCORE: ${(d.score || 0).toLocaleString()} · ${(d.period || '').toUpperCase()}</div>
                        </div>
                    </div>
                    <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div>
                </div>
            </div>`;
        } catch { /* fall through */ }
    }

    // VAULT LOCK CARD
    if (content.startsWith('VAULT_LOCK_CARD::')) {
        try {
            const d = JSON.parse(content.replace('VAULT_LOCK_CARD::', ''));
            const initials = (d.name || 'S')[0].toUpperCase();
            const photoBlock = d.photo ? `<img src="${d.photo}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : '';
            const photoFallback = `<div style="${d.photo ? 'display:none;' : ''}position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,rgba(139,0,0,0.08),rgba(139,0,0,0.02));"><div style="width:60px;height:60px;border-radius:50%;border:1px solid rgba(139,0,0,0.4);display:flex;align-items:center;justify-content:center;font-family:'Orbitron',sans-serif;font-size:1.4rem;color:rgba(180,40,40,0.8);">${initials}</div></div>`;
            const dayLabel = d.days === 1 ? 'DAY' : 'DAYS';
            const typeLabel = d.type === 'instant' ? 'Self-locked' : 'Awaiting approval';
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;">
                <div style="width:85%;max-width:340px;min-width:200px;">
                    <div style="width:100%;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0e0406,#0d0404,#0a0303);border:1px solid rgba(139,0,0,0.4);box-shadow:0 12px 40px rgba(0,0,0,0.8);">
                        <div style="position:relative;width:100%;height:140px;background:#0a0303;overflow:hidden;">
                            ${photoBlock}${photoFallback}
                            <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,#0e0406 100%);"></div>
                            <div style="position:absolute;top:10px;left:50%;transform:translateX(-50%);background:rgba(10,2,3,0.9);border:1px solid rgba(139,0,0,0.5);border-radius:20px;padding:4px 14px;white-space:nowrap;"><span style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(180,40,40,0.7);letter-spacing:3px;">KEYHOLDER LOCK</span></div>
                        </div>
                        <div style="padding:14px 18px 18px;text-align:center;">
                            <div style="margin-bottom:8px;"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(180,40,40,0.7)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
                            <div style="font-family:'Cinzel',serif;font-size:0.85rem;color:rgba(255,255,255,0.6);letter-spacing:1px;margin-bottom:4px;">${d.name||''} — ${d.days||0} ${dayLabel}</div>
                            <div style="font-family:Rajdhani,sans-serif;font-size:0.7rem;color:rgba(139,0,0,0.45);">${typeLabel}</div>
                        </div>
                    </div>
                    <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div>
                </div>
            </div>`;
        } catch { /* fall through */ }
    }

    // LOCK EXTENDED CARD (mobile/system chat view)
    if (content.startsWith('LOCK_EXTENDED_CARD::')) {
        try {
            const d = JSON.parse(content.replace('LOCK_EXTENDED_CARD::', ''));
            const expiresLabel = d.newExpires ? new Date(d.newExpires).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;">
                <div style="width:75%;max-width:260px;min-width:160px;">
                    <div style="width:100%;border-radius:14px;overflow:hidden;background:linear-gradient(170deg,#0e0406,#0d0404,#0a0303);border:1px solid rgba(139,0,0,0.5);box-shadow:0 12px 40px rgba(0,0,0,0.8);">
                        <div style="padding:16px 20px;text-align:center;">
                            <div style="font-family:'Cinzel',serif;font-size:0.65rem;color:rgba(139,0,0,0.65);letter-spacing:4px;margin-bottom:8px;">LOCK EXTENDED</div>
                            <div style="width:40%;height:1px;background:linear-gradient(to right,transparent,rgba(139,0,0,0.35),transparent);margin:0 auto 12px;"></div>
                            <div style="font-family:'Cinzel',serif;font-size:1.5rem;color:rgba(180,40,40,0.85);letter-spacing:2px;margin-bottom:4px;">+${d.days||0}</div>
                            <div style="font-family:'Rajdhani',sans-serif;font-size:0.65rem;color:rgba(255,255,255,0.35);letter-spacing:3px;margin-bottom:10px;">DAY${(d.days||0) !== 1 ? 'S' : ''} ADDED</div>
                            <div style="width:40%;height:1px;background:linear-gradient(to right,transparent,rgba(139,0,0,0.2),transparent);margin:0 auto 10px;"></div>
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.5rem;color:rgba(255,255,255,0.25);letter-spacing:2px;">${d.newTotal||0} DAYS TOTAL</div>
                            ${expiresLabel ? `<div style="font-family:'Rajdhani',sans-serif;font-size:0.55rem;color:rgba(139,0,0,0.4);margin-top:4px;">Until ${expiresLabel}</div>` : ''}
                        </div>
                    </div>
                    <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div>
                </div>
            </div>`;
        } catch { /* fall through */ }
    }

    // UPDATE TRIBUTE CARD
    if (content.startsWith('UPDATE_TRIBUTE_CARD::')) {
        try {
            const d = JSON.parse(content.replace('UPDATE_TRIBUTE_CARD::', ''));
            const coverSrc = d.image || '';
            const priceVal = d.price ? Number(d.price).toLocaleString() : '';
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;">
                <div style="width:220px;">
                    <div style="border-radius:12px;overflow:hidden;background:#0a0a14;border:1px solid rgba(197,160,89,0.4);box-shadow:0 6px 24px rgba(0,0,0,0.5);">
                        <div style="width:100%;height:120px;background-image:url('${coverSrc}');background-size:cover;background-position:center;position:relative;">
                            ${priceVal ? `<div style="position:absolute;top:7px;right:8px;background:rgba(10,7,3,0.85);border:1px solid rgba(197,160,89,0.5);border-radius:20px;padding:3px 10px;font-family:'Orbitron',sans-serif;font-size:0.38rem;color:#c5a059;display:flex;align-items:center;gap:5px;letter-spacing:1px;"><i class="fas fa-coins"></i> ${priceVal}</div>` : ''}
                        </div>
                        <div style="padding:10px 14px 14px;">
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.45rem;color:rgba(197,160,89,0.7);letter-spacing:2px;margin-bottom:4px;">✦ Gift Sent</div>
                            <div style="font-family:'Cinzel',serif;font-size:0.85rem;color:#fff;font-weight:700;letter-spacing:1px;">${d.title||''}</div>
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.38rem;color:rgba(255,255,255,0.35);margin-top:6px;">${d.senderName||''}</div>
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

    // UPDATE COINS CARD - mobile
    if (content.startsWith('UPDATE_COINS_CARD::')) {
        try {
            const d = JSON.parse(content.replace('UPDATE_COINS_CARD::', ''));
            const cInitial = (d.senderName || 'S')[0].toUpperCase();
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;">
                <div style="width:85%;max-width:340px;min-width:200px;">
                    <div style="background:rgba(197,160,89,0.05);border:1px solid rgba(197,160,89,0.25);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;box-sizing:border-box;">
                        <div style="width:42px;height:42px;border-radius:50%;background:rgba(197,160,89,0.1);border:1.5px solid rgba(197,160,89,0.35);overflow:hidden;position:relative;flex-shrink:0;">
                            ${d.senderAvatar ? `<img src="${d.senderAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none'">` : ''}
                            <div style="display:${d.senderAvatar ? 'none' : 'flex'};position:absolute;inset:0;align-items:center;justify-content:center;font-family:'Orbitron';font-size:0.65rem;color:#c5a059;">${cInitial}</div>
                        </div>
                        <div style="flex:1;min-width:0;">
                            <div style="font-family:'Orbitron';font-size:0.4rem;color:rgba(255,255,255,0.5);letter-spacing:1px;margin-bottom:2px;">🪙 COINS EARNED</div>
                            <div style="font-family:'Orbitron';font-size:0.8rem;color:#fff;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.senderName||''}</div>
                            <div style="font-family:'Orbitron';font-size:0.82rem;color:#c5a059;font-weight:700;margin-top:2px;">+${d.points||0} COINS</div>
                        </div>
                        <div style="font-family:'Orbitron';font-size:0.36rem;color:rgba(255,255,255,0.35);flex-shrink:0;align-self:flex-start;">${time}</div>
                    </div>
                </div>
            </div>`;
        } catch { /* fall through */ }
    }

    // ROUTINE CHANGE CARD - mobile
    if (content.startsWith('ROUTINE_CHANGE::')) {
        try {
            const d = JSON.parse(content.replace('ROUTINE_CHANGE::', ''));
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;">
                <div style="width:85%;max-width:340px;min-width:200px;">
                    <div style="width:100%;border-radius:14px;overflow:hidden;background:linear-gradient(170deg,#0c0806 0%,#0e0a04 60%,#0a0703 100%);border:1px solid rgba(197,160,89,0.35);box-shadow:0 10px 35px rgba(0,0,0,0.7);">
                        <div style="padding:16px 18px;text-align:center;">
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.4rem;color:rgba(197,160,89,0.5);letter-spacing:3px;margin-bottom:10px;">ROUTINE UPDATED</div>
                            <div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:12px;flex-wrap:wrap;">
                                <span style="font-family:'Rajdhani',sans-serif;font-size:0.78rem;color:rgba(255,255,255,0.3);text-decoration:line-through;">${(d.oldRoutine || 'None').toUpperCase()}</span>
                                <span style="color:rgba(197,160,89,0.6);font-size:0.8rem;">\u2192</span>
                                <span style="font-family:'Cinzel',serif;font-size:0.85rem;color:#c5a059;font-weight:700;letter-spacing:1px;">${(d.newRoutine || 'None').toUpperCase()}</span>
                            </div>
                            <div style="width:60%;height:1px;background:linear-gradient(to right,transparent,rgba(197,160,89,0.25),transparent);margin:0 auto;"></div>
                        </div>
                    </div>
                    <div style="font-family:'Orbitron';font-size:0.36rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div>
                </div>
            </div>`;
        } catch { /* fall through */ }
    }

    // WELCOME CARD (new member) - mobile
    if (content.startsWith('WELCOME_CARD::')) {
        try {
            const d = JSON.parse(content.replace('WELCOME_CARD::', ''));
            const wIni = (d.name || 'S')[0].toUpperCase();
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;">
                <div style="width:85%;max-width:340px;min-width:200px;">
                    <div style="width:100%;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0c0a04 0%,#13100a 50%,#0c0a04 100%);border:1px solid rgba(197,160,89,0.6);box-shadow:0 12px 40px rgba(0,0,0,0.8),0 0 30px rgba(197,160,89,0.08);">
                        <div style="width:100%;padding:18px 0 12px;display:flex;flex-direction:column;align-items:center;background:radial-gradient(ellipse at center top,rgba(197,160,89,0.1) 0%,transparent 70%);">
                            <div style="width:56px;height:56px;border-radius:50%;border:2px solid rgba(197,160,89,0.6);display:flex;align-items:center;justify-content:center;font-family:'Cinzel',serif;font-size:1.4rem;color:#c5a059;background:radial-gradient(circle,rgba(197,160,89,0.12) 0%,rgba(197,160,89,0.03) 100%);box-shadow:0 0 20px rgba(197,160,89,0.15),0 0 40px rgba(197,160,89,0.05);">${wIni}</div>
                        </div>
                        <div style="padding:4px 16px 18px;text-align:center;">
                            <div style="font-family:'Cinzel',serif;font-size:0.95rem;color:#fff;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:6px;">${d.name || ''}</div>
                            <div style="width:40%;height:1px;background:linear-gradient(to right,transparent,rgba(197,160,89,0.5),transparent);margin:0 auto 8px;"></div>
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.4rem;color:rgba(197,160,89,0.65);letter-spacing:3px;margin-bottom:10px;">HAS ENTERED THE COURT</div>
                            <div style="display:inline-flex;align-items:center;gap:4px;background:rgba(197,160,89,0.06);border:1px solid rgba(197,160,89,0.25);border-radius:20px;padding:3px 12px;"><svg width="12" height="9" viewBox="0 0 26 20" fill="#c5a059"><path d="M2 18 L5 8 L10 13 L13 3 L16 13 L21 8 L24 18 Z"/><rect x="2" y="17" width="22" height="2" rx="1"/></svg><span style="font-family:'Orbitron',sans-serif;font-size:0.4rem;color:#c5a059;letter-spacing:2px;">${(d.rank || 'HALL BOY').toUpperCase()}</span></div>
                        </div>
                    </div>
                    <div style="font-family:'Orbitron';font-size:0.36rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div>
                </div>
            </div>`;
        } catch { /* fall through */ }
    }

    // Guardian (Vlad) bubble
    const isGuardian = senderEmail === 'guardian';
    if (isGuardian) {
        return `<div class="mob-gl-talk-msg" style="background:linear-gradient(135deg,rgba(255,0,237,0.10),rgba(0,10,255,0.10));border:1px solid rgba(255,0,237,0.3);box-shadow:inset 0 0 20px rgba(0,10,255,0.05);">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                <div style="display:flex;align-items:center;gap:5px;min-width:0;flex:1;">
                    <div style="width:18px;height:18px;border-radius:50%;background:linear-gradient(135deg,rgba(255,0,237,0.3),rgba(0,10,255,0.3));border:1px solid rgba(255,0,237,0.5);display:flex;align-items:center;justify-content:center;font-family:Orbitron;font-size:0.35rem;color:#fff;flex-shrink:0;">V</div>
                    <span style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(255,0,237,0.7);letter-spacing:1px;">VLAD</span>
                    <span class="mob-gl-talk-time"> \u00B7 ${time}</span>
                </div>
                ${replyBtn}
            </div>
            ${quoteHtml}<span style="font-family:'Plus Jakarta Sans',sans-serif;font-size:0.92rem;color:rgba(255,255,255,0.85);line-height:1.45;">${content}</span>
        </div>`;
    }

    const isMediaLabel = (content === '[GIF]' || content === '[VIDEO]' || content === '[PHOTO]') && mediaHtml;
    const contentEl = isMediaLabel ? '' : `<span class="mob-gl-talk-content">${content}</span>`;
    const _uMobHeader = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
        <div style="display:flex;align-items:center;gap:5px;min-width:0;flex:1;">
            ${avatarHtml}
            <span class="mob-gl-talk-name">${name}</span>
            <span class="mob-gl-talk-time"> · ${time}</span>
        </div>
        ${replyBtn}
    </div>`;

    if (_isMediaOnly) {
        // Frameless — just header + media
        return `<div style="padding:4px 10px;margin-bottom:6px;">
            ${_uMobHeader}
            ${mediaHtml}
        </div>`;
    }
    return `<div class="mob-gl-talk-msg">
        ${_uMobHeader}
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
        // Auto-summon Guardian when @vlad is tagged in global chat
        if (/@vlad/i.test(content)) {
            try {
                const gRes = await fetch('/api/global/guardian', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userMessage: content, senderName: raw?.name || senderEmail.split('@')[0], senderEmail }),
                });
                if (gRes.ok) {
                    const gData = await gRes.json();
                    if (gData.message) _appendMobGlMessage(gData.message);
                }
            } catch (e) { console.warn('[Global Guardian] auto-summon failed:', e); }
        }
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
            <span style="font-family:'Orbitron';font-size:0.32rem;color:rgba(255,255,255,0.12);letter-spacing:1px;">via GIPHY</span>
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
        const res = await fetch('/api/global/queen-videos', { cache: 'no-store' });
        const { videos } = await res.json();
        if (!videos?.length) {
            container.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;padding:40px;"><span style="font-size:2rem;opacity:0.2;">&#9654;</span><span style="font-family:'Orbitron';font-size:0.45rem;color:rgba(197,160,89,0.3);letter-spacing:2px;text-align:center;">NO VIDEOS YET</span></div>`;
            return;
        }
        _queenVideosList = videos;
        container.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:20px;padding:20px 16px;justify-content:center;">` + videos.map((v: any) => {
            const date = new Date(v.created_at);
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
            const thumb = v.thumbnail_url || '/queen-karin.png';
            return `<div style="display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;" onclick="window._playQueenVideo&&window._playQueenVideo('${v.media_url.replace(/'/g, "\\'")}')">
                <div style="width:90px;height:90px;border-radius:50%;overflow:hidden;border:2px solid rgba(197,160,89,0.5);position:relative;box-shadow:0 0 12px rgba(197,160,89,0.15);">
                    <img src="${thumb}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.src='/queen-karin.png'" />
                    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.25);">
                        <div style="width:0;height:0;border-style:solid;border-width:7px 0 7px 12px;border-color:transparent transparent transparent rgba(255,255,255,0.85);margin-left:2px;"></div>
                    </div>
                </div>
                <div style="font-family:Orbitron;font-size:0.42rem;color:rgba(197,160,89,0.7);letter-spacing:1.5px;text-align:center;">${dateStr}</div>
            </div>`;
        }).join('') + `</div>`;
        _mobGlLoaded['challenges'] = true;
    } catch {
        container.innerHTML = `<div style="text-align:center;padding:40px;color:#333;font-family:Orbitron;font-size:0.75rem">UNABLE TO LOAD</div>`;
    }
}

let _queenVideosList: any[] = [];

function _fmtTime(s: number) { const m = Math.floor(s / 60); return m + ':' + String(Math.floor(s % 60)).padStart(2, '0'); }

function _playQueenVideo(url: string) {
    const existing = document.getElementById('_queenVideoOverlay');
    if (existing) {
        const vid = existing.querySelector('video') as HTMLVideoElement;
        if (vid) { vid.src = url; vid.play().catch(() => {}); }
        existing.querySelectorAll('[data-qv-url]').forEach((el: any) => {
            el.style.border = el.dataset.qvUrl === url ? '2px solid rgba(197,160,89,1)' : '2px solid rgba(255,255,255,0.15)';
            el.style.boxShadow = el.dataset.qvUrl === url ? '0 0 10px rgba(197,160,89,0.4)' : 'none';
        });
        return;
    }
    const overlay = document.createElement('div');
    overlay.id = '_queenVideoOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999999;background:#000;display:flex;flex-direction:column;';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&#10005;';
    closeBtn.style.cssText = 'position:absolute;top:env(safe-area-inset-top,16px);right:16px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#fff;width:36px;height:36px;border-radius:50%;font-size:1.2rem;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2;margin-top:16px;';
    closeBtn.onclick = () => overlay.remove();

    // Video area — no native controls to prevent iOS fullscreen takeover
    const videoWrap = document.createElement('div');
    videoWrap.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;min-height:0;overflow:hidden;position:relative;';
    const video = document.createElement('video');
    video.src = url;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.style.cssText = 'width:100%;height:100%;object-fit:contain;';
    video.onended = () => overlay.remove();
    videoWrap.appendChild(video);

    // Tap video to play/pause
    const playPauseBtn = document.createElement('div');
    playPauseBtn.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:1;';
    playPauseBtn.innerHTML = '<div id="_qvPlayIcon" style="width:60px;height:60px;border-radius:50%;background:rgba(0,0,0,0.5);border:2px solid rgba(197,160,89,0.5);display:none;align-items:center;justify-content:center;"><div style="width:0;height:0;border-style:solid;border-width:10px 0 10px 18px;border-color:transparent transparent transparent rgba(197,160,89,0.9);margin-left:4px;"></div></div>';
    playPauseBtn.onclick = (e) => {
        e.stopPropagation();
        if (video.paused) { video.play().catch(() => {}); } else { video.pause(); }
    };
    videoWrap.appendChild(playPauseBtn);

    video.onpause = () => { const ic = overlay.querySelector('#_qvPlayIcon') as HTMLElement; if (ic) ic.style.display = 'flex'; };
    video.onplay = () => { const ic = overlay.querySelector('#_qvPlayIcon') as HTMLElement; if (ic) ic.style.display = 'none'; };

    // Custom progress bar
    const controls = document.createElement('div');
    controls.style.cssText = 'flex-shrink:0;padding:8px 16px;display:flex;align-items:center;gap:10px;';
    const timeEl = document.createElement('span');
    timeEl.style.cssText = 'font-family:Orbitron;font-size:0.38rem;color:rgba(255,255,255,0.5);min-width:32px;';
    timeEl.textContent = '0:00';
    const progressWrap = document.createElement('div');
    progressWrap.style.cssText = 'flex:1;height:4px;background:rgba(255,255,255,0.12);border-radius:2px;cursor:pointer;position:relative;';
    const progressFill = document.createElement('div');
    progressFill.style.cssText = 'height:100%;background:rgba(197,160,89,0.8);border-radius:2px;width:0%;transition:width 0.1s;';
    progressWrap.appendChild(progressFill);
    const durEl = document.createElement('span');
    durEl.style.cssText = 'font-family:Orbitron;font-size:0.38rem;color:rgba(255,255,255,0.5);min-width:32px;text-align:right;';
    durEl.textContent = '0:00';
    controls.appendChild(timeEl);
    controls.appendChild(progressWrap);
    controls.appendChild(durEl);

    video.ontimeupdate = () => {
        if (!video.duration) return;
        const pct = (video.currentTime / video.duration) * 100;
        progressFill.style.width = pct + '%';
        timeEl.textContent = _fmtTime(video.currentTime);
    };
    video.onloadedmetadata = () => { durEl.textContent = _fmtTime(video.duration); };
    progressWrap.onclick = (e) => {
        const rect = progressWrap.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        video.currentTime = pct * video.duration;
    };

    // Circle strip
    const strip = document.createElement('div');
    strip.style.cssText = 'flex-shrink:0;display:flex;gap:12px;padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));overflow-x:auto;justify-content:center;border-top:1px solid rgba(255,255,255,0.06);-webkit-overflow-scrolling:touch;';
    _queenVideosList.forEach((v: any) => {
        const circle = document.createElement('div');
        circle.dataset.qvUrl = v.media_url;
        const isActive = v.media_url === url;
        circle.style.cssText = `width:52px;height:52px;border-radius:50%;overflow:hidden;flex-shrink:0;cursor:pointer;border:2px solid ${isActive ? 'rgba(197,160,89,1)' : 'rgba(255,255,255,0.15)'};box-shadow:${isActive ? '0 0 10px rgba(197,160,89,0.4)' : 'none'};position:relative;`;
        const thumb = v.thumbnail_url || '/queen-karin.png';
        circle.innerHTML = `<img src="${thumb}" style="width:100%;height:100%;object-fit:cover;" onerror="this.src='/queen-karin.png'" /><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.2);"><div style="width:0;height:0;border-style:solid;border-width:5px 0 5px 8px;border-color:transparent transparent transparent rgba(255,255,255,0.8);margin-left:1px;"></div></div>`;
        circle.onclick = (e) => { e.stopPropagation(); (window as any)._playQueenVideo(v.media_url); };
        strip.appendChild(circle);
    });

    overlay.appendChild(closeBtn);
    overlay.appendChild(videoWrap);
    overlay.appendChild(controls);
    if (_queenVideosList.length > 1) overlay.appendChild(strip);
    document.body.appendChild(overlay);
}
function _showChatWelcomeGate() {
    document.querySelectorAll('#_chatWelcomeGate').forEach(e => e.remove());
    ['chatBox', 'mob_chatBox'].forEach(parentId => {
        const parent = document.getElementById(parentId);
        if (!parent) return;
        parent.style.position = 'relative';
        const gate = document.createElement('div');
        gate.id = '_chatWelcomeGate';
        gate.style.cssText = 'position:absolute;inset:0;z-index:50;background:rgba(5,5,5,0.98);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;text-align:center;';
        gate.innerHTML = `
            <div style="width:60px;height:60px;border-radius:50%;overflow:hidden;border:2px solid rgba(197,160,89,0.5);margin-bottom:20px;box-shadow:0 0 20px rgba(197,160,89,0.15);">
                <img src="/queen-karin.png" style="width:100%;height:100%;object-fit:cover;" />
            </div>
            <div style="font-family:Cinzel,serif;font-size:1.1rem;color:#fff;letter-spacing:3px;margin-bottom:8px;">QUEEN KARIN</div>
            <div style="width:40px;height:1px;background:linear-gradient(to right,transparent,rgba(197,160,89,0.5),transparent);margin:0 auto 16px;"></div>
            <div style="font-family:'Cormorant Garamond',serif;font-size:1.05rem;color:rgba(255,255,255,0.5);line-height:1.7;max-width:280px;margin-bottom:6px;font-style:italic;">
                This is a private audience with the Queen.
            </div>
            <div style="font-family:'Cormorant Garamond',serif;font-size:0.9rem;color:rgba(255,255,255,0.28);margin-bottom:32px;line-height:1.5;max-width:260px;">
                Before you speak, make sure you understand how things work here.
            </div>
            <div style="display:flex;flex-direction:column;gap:10px;width:100%;max-width:260px;">
                <button onclick="document.querySelectorAll('#_chatWelcomeGate').forEach(e=>e.remove());window.toggleAiMode&&window.toggleAiMode(true)" style="width:100%;padding:13px 0;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.5);font-family:Orbitron,sans-serif;font-size:0.45rem;letter-spacing:2px;cursor:pointer;border-radius:6px;transition:all 0.2s;">LEARN HOW IT WORKS</button>
                <button onclick="window._dismissChatGate&&window._dismissChatGate()" style="width:100%;padding:13px 0;background:linear-gradient(135deg,rgba(197,160,89,0.15),rgba(197,160,89,0.05));border:1px solid rgba(197,160,89,0.4);color:rgba(197,160,89,0.9);font-family:Orbitron,sans-serif;font-size:0.45rem;letter-spacing:2px;cursor:pointer;border-radius:6px;transition:all 0.2s;">ENTER THE CHAT</button>
            </div>`;
        parent.appendChild(gate);
    });
}

if (typeof window !== 'undefined') {
    (window as any)._playQueenVideo = _playQueenVideo;
    (window as any)._dismissChatGate = () => {
        const gates = document.querySelectorAll('#_chatWelcomeGate');
        gates.forEach(gate => {
            (gate as HTMLElement).innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:50px 20px;text-align:center;width:100%;height:100%;">
                <div style="width:40px;height:1px;background:linear-gradient(to right,transparent,rgba(197,160,89,0.4),transparent);margin-bottom:20px;"></div>
                <div style="font-family:'Cormorant Garamond',serif;font-size:0.95rem;color:rgba(255,255,255,0.55);line-height:1.7;max-width:290px;font-style:italic;margin-bottom:16px;">
                    Good. You made it in. Not everyone does.
                </div>
                <div style="font-family:'Cormorant Garamond',serif;font-size:0.95rem;color:rgba(255,255,255,0.55);line-height:1.7;max-width:290px;font-style:italic;margin-bottom:20px;">
                    I left 5,000 coins in your wallet. A little something from me so you can explore everything this place has to offer. Tributes, private content, rewards. It's all here, and it's all yours to play with.
                </div>
                <div style="font-family:'Cormorant Garamond',serif;font-size:0.85rem;color:rgba(255,255,255,0.22);max-width:270px;line-height:1.5;margin-bottom:28px;">
                    Now, before you step into my chat. Would you like to bring me something?
                </div>
                <div style="display:flex;flex-direction:column;gap:10px;width:100%;max-width:240px;">
                    <button onclick="document.querySelectorAll('#_chatWelcomeGate').forEach(e=>e.remove());window.closeMobChatOverlay&&window.closeMobChatOverlay();setTimeout(function(){window.openStandaloneTribute&&window.openStandaloneTribute('wishlist')},100)" style="width:100%;padding:12px 0;background:linear-gradient(135deg,rgba(197,160,89,0.15),rgba(197,160,89,0.05));border:1px solid rgba(197,160,89,0.4);color:rgba(197,160,89,0.9);font-family:Orbitron,sans-serif;font-size:0.42rem;letter-spacing:2px;cursor:pointer;border-radius:6px;">VIEW HER WISHLIST</button>
                    <button onclick="document.querySelectorAll('#_chatWelcomeGate').forEach(e=>e.remove())" style="width:100%;padding:10px 0;background:transparent;border:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.2);font-family:Orbitron,sans-serif;font-size:0.38rem;letter-spacing:2px;cursor:pointer;border-radius:6px;">I'LL TAKE MY CHANCES</button>
                </div>
            </div>`;
        });
    };
    (window as any)._openGlobalLightbox = async (url: string, type?: string) => {
        if (type === 'video') {
            // Fetch queen videos from API (same source as NEWS tab)
            if (!_queenVideosList.length) {
                try {
                    const res = await fetch('/api/global/queen-videos', { cache: 'no-store' });
                    const { videos } = await res.json();
                    if (videos?.length) _queenVideosList = videos;
                } catch {}
            }
            // Ensure clicked video is in the list
            if (!_queenVideosList.some((v: any) => v.media_url === url)) {
                _queenVideosList.unshift({ media_url: url, thumbnail_url: null });
            }
            _playQueenVideo(url);
            return;
        }
        // Photo lightbox
        let lb = document.getElementById('globalChatLightbox');
        if (!lb) {
            lb = document.createElement('div');
            lb.id = 'globalChatLightbox';
            lb.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:10000002;align-items:center;justify-content:center;cursor:zoom-out;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);';
            lb.innerHTML = '<div id="globalChatLightboxMedia" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;padding:20px;box-sizing:border-box;"></div>';
            lb.addEventListener('click', (e) => { if (e.target === lb || e.target === document.getElementById('globalChatLightboxMedia')) lb!.style.display = 'none'; });
            document.body.appendChild(lb);
        }
        const media = document.getElementById('globalChatLightboxMedia');
        if (media) media.innerHTML = `<img src="${url}" style="max-width:94vw;max-height:92vh;object-fit:contain;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,0.8);" />`;
        lb.style.display = 'flex';
    };
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
        const coverSrc = u.image || '';
        const priceVal = u.price ? Number(u.price).toLocaleString() : '';
        return `<div style="margin-bottom:16px;display:flex;justify-content:center;">
            <div style="width:220px;border-radius:12px;overflow:hidden;background:#0a0a14;border:1px solid rgba(197,160,89,0.4);box-shadow:0 6px 24px rgba(0,0,0,0.5);">
                <div style="width:100%;height:120px;background-image:url('${coverSrc}');background-size:cover;background-position:center;position:relative;">
                    ${priceVal ? `<div style="position:absolute;top:7px;right:8px;background:rgba(10,7,3,0.85);border:1px solid rgba(197,160,89,0.5);border-radius:20px;padding:3px 10px;font-family:'Orbitron',sans-serif;font-size:0.38rem;color:#c5a059;display:flex;align-items:center;gap:5px;letter-spacing:1px;"><i class="fas fa-coins"></i> ${priceVal}</div>` : ''}
                </div>
                <div style="padding:10px 14px 14px;">
                    <div style="font-family:'Orbitron',sans-serif;font-size:0.45rem;color:rgba(197,160,89,0.7);letter-spacing:2px;margin-bottom:4px;">✦ Gift Sent</div>
                    <div style="font-family:'Cinzel',serif;font-size:0.85rem;color:#fff;font-weight:700;letter-spacing:1px;">${u.title || ''}</div>
                    <div style="font-family:'Orbitron',sans-serif;font-size:0.38rem;color:rgba(255,255,255,0.35);margin-top:6px;">${u.sender_name || ''}</div>
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
    // Block locked items for low ranks
    const state0 = getState();
    const rank0 = ((state0 as any).rank || 'Hall Boy').toLowerCase().trim();
    if (type === 'routine' && rank0 === 'hall boy') return;
    if ((type === 'kinks' || type === 'limits') && (rank0 === 'hall boy' || rank0 === 'footman')) return;

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
    const wallet = getState().wallet || 0;

    _showCoinConfirm({
        title: 'PHOTO CHANGE',
        cost: 1000,
        wallet,
        onConfirm: () => {
            // iOS Safari blocks programmatic input.click() if called after any await.
            // Must create + click file input inside user gesture (the confirm button click).
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1;';
            document.body.appendChild(input);
            input.onchange = async () => { _handlePhotoFile(input); };
            input.click();
        },
    });
}

async function _handlePhotoFile(input: HTMLInputElement) {
    const file = input.files?.[0];
    document.body.removeChild(input);
    if (!file) return;

    const elProfilePic = document.getElementById('profilePic') as HTMLImageElement;
    const elHudPic = document.getElementById('hudUserPic') as HTMLImageElement;
    if (elProfilePic) elProfilePic.style.opacity = '0.5';
    if (elHudPic) elHudPic.style.opacity = '0.5';

    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const memberEmail = user?.email || getState().email || getState().raw?.member_id || user?.id;
        if (!memberEmail) {
            alert('Not logged in.');
            if (elProfilePic) elProfilePic.style.opacity = '1';
            if (elHudPic) elHudPic.style.opacity = '1';
            return;
        }

        const fd = new FormData();
        fd.append('file', file);
        fd.append('memberEmail', memberEmail);

        const res = await fetch('/api/upload-avatar', { method: 'POST', body: fd });
        const data = await res.json();

        if (elProfilePic) elProfilePic.style.opacity = '1';
        if (elHudPic) elHudPic.style.opacity = '1';

        if (data.success && data.url) {
            if (elProfilePic) elProfilePic.src = data.url;
            if (elHudPic) elHudPic.src = data.url;
            const elHaloPic = document.getElementById('mob_profilePic') as HTMLImageElement;
            if (elHaloPic) elHaloPic.src = data.url;
            if ((window as any).__currentProfileRaw) (window as any).__currentProfileRaw.avatar_url = data.url;
            const s = getState(); if (s?.raw) s.raw.avatar_url = data.url;
            try {
                await fetch('/api/profile-update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ memberEmail, field: '_deductOnly', value: '', cost: 1000 })
                });
                const newWallet = Math.max(0, (getState().wallet || 0) - 1000);
                setState({ wallet: newWallet });
                document.querySelectorAll('#coins, #mobCoins').forEach(el => { (el as HTMLElement).innerText = newWallet.toLocaleString(); });
            } catch {}
        } else {
            alert('Photo upload failed: ' + (data.error || 'Unknown error'));
        }
    } catch (err: any) {
        if (elProfilePic) elProfilePic.style.opacity = '1';
        if (elHudPic) elHudPic.style.opacity = '1';
        alert('Photo upload failed: ' + (err.message || 'Unknown error'));
    }
}

const CHIP_LIST = ["Foot fetish", "JOI", "Humiliation", "SPH", "Findom", "D/s", "Control", "Ownership", "Chastity", "CEI", "Blackmail play", "Objectification", "Degradation", "Task submission", "CBT", "Training", "Power exchange", "Verbal domination", "Protocol", "Obedience", "Psychological domination"];
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
    } else if (fieldId === 'name') {
        inner += `<div style="color:rgba(255,255,255,0.35);font-size:0.55rem;margin-bottom:14px;letter-spacing:1px;">NAME CHANGE: 5,000 ₡</div>`;
        inner += `<textarea id="_reqInput" placeholder="Enter your ${label.toLowerCase()}..." style="width:100%;min-height:90px;background:rgba(255,255,255,0.05);border:1px solid rgba(197,160,89,0.3);color:#fff;padding:10px;border-radius:6px;font-family:'Orbitron';font-size:16px;resize:vertical;">${existingValue || ''}</textarea>`;
    } else {
        inner += `<div style="color:rgba(255,255,255,0.35);font-size:0.55rem;margin-bottom:12px;">STORED IN YOUR PROFILE · FREE</div>`;
        inner += `<textarea id="_reqInput" placeholder="Enter your ${label.toLowerCase()}..." style="width:100%;min-height:90px;background:rgba(255,255,255,0.05);border:1px solid rgba(197,160,89,0.3);color:#fff;padding:10px;border-radius:6px;font-family:'Orbitron';font-size:16px;resize:vertical;">${existingValue || ''}</textarea>`;
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
        if (fieldId === 'name') {
            cost = 5000;
            const w = getState().wallet || 0;
            _showCoinConfirm({
                title: 'NAME CHANGE',
                cost: 5000,
                wallet: w,
                onConfirm: () => _doSaveField(fieldId, value, cost, email!, overlay, saveBtn),
                onCancel: () => { if (saveBtn) { saveBtn.textContent = 'SAVE'; saveBtn.disabled = false; } },
            });
            return;
        }
    }

    _doSaveField(fieldId, value, cost, email!, overlay, saveBtn);
}

async function _doSaveField(fieldId: string, value: string, cost: number, email: string, overlay: HTMLElement, saveBtn: HTMLButtonElement | null) {
    const showErr = (msg: string) => { const errEl = document.getElementById('_reqError'); if (errEl) { errEl.style.display = 'block'; errEl.textContent = msg; } if (saveBtn) { saveBtn.textContent = 'SAVE'; saveBtn.disabled = false; } };

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
        const { memberId, id } = getState();
        loadChatHistory(memberId || id || email);
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
    const lockedStyle = `width:100%;padding:12px;margin-bottom:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.2);border-radius:6px;font-family:'Orbitron';font-size:0.8rem;cursor:not-allowed;text-align:left;display:flex;justify-content:space-between;align-items:center;`;
    const rank0 = ((u.hierarchy || u.rank || 'Hall Boy') as string).toLowerCase().trim();
    const canEditLimitsKinks = rank0 !== 'hall boy' && rank0 !== 'footman';
    const canEditRoutine = rank0 !== 'hall boy';

    inner += `<button class="_manageBtn" data-action="photo" style="${btnStyle}"><span>UPDATE PHOTO</span> <span style="font-size:0.55rem;color:#c5a059;">1,000 ₡</span></button>`;
    inner += `<button class="_manageBtn" data-action="field" data-field="name" data-label="IDENTITY" data-val="${getRaw('name').replace(/"/g, '&quot;')}" style="${btnStyle}"><span>EDIT IDENTITY</span> <span style="font-size:0.55rem;color:#c5a059;">5,000 ₡</span></button>`;
    if (canEditLimitsKinks) {
        inner += `<button class="_manageBtn" data-action="field" data-field="limits" data-label="LIMITS" data-val="${getRaw('limits').replace(/"/g, '&quot;')}" style="${btnStyle}"><span>EDIT LIMITS</span> <span>&#9998;</span></button>`;
        inner += `<button class="_manageBtn" data-action="field" data-field="kinks" data-label="KINKS" data-val="${getRaw('kinks').replace(/"/g, '&quot;')}" style="${btnStyle}"><span>EDIT KINKS</span> <span>&#9998;</span></button>`;
    } else {
        inner += `<div style="${lockedStyle}"><span>LIMITS</span> <span style="font-size:0.55rem;">SILVERMAN+</span></div>`;
        inner += `<div style="${lockedStyle}"><span>KINKS</span> <span style="font-size:0.55rem;">SILVERMAN+</span></div>`;
    }
    if (canEditRoutine) {
        inner += `<button class="_manageBtn" data-action="field" data-field="routine" data-label="ROUTINE" data-val="${getRaw('routine').replace(/"/g, '&quot;')}" style="${btnStyle}"><span>EDIT ROUTINE</span> <span>&#9998;</span></button>`;
    } else {
        inner += `<div style="${lockedStyle}"><span>ROUTINE</span> <span style="font-size:0.55rem;">FOOTMAN+</span></div>`;
    }

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
    // Vault page is fully React-managed — none of the profile sidebar DOM elements exist there.
    // Calling this from vault triggers unnecessary API calls (routine-status, vault/apply)
    // and sets up duplicate realtime channels. Skip entirely.
    if (window.location.pathname === '/vault') return;

    (window as any).openManageProfileModal = () => openManageProfileModal(u);

    (window as any).__profileHandlers = { uploadPhoto: handleProfileUpload, openField: openTextFieldModal };

    // 👇 ADDED SAFETY CHECK for getHierarchyReport
    const report = getHierarchyReport(u);
    if (!report) return;

    // Trigger loading tributes exactly once when profile data lands and sidebar renders
    if (globalTributes.length === 0) loadTributes();

    // Send dashboard notification on first standalone (installed app) launch
    _sendInstallNotifyOnce(u);

    // Load routine widget state from server (bypasses RLS via admin API)
    updateRoutineWidget();

    // Load vault items
    loadVault();

    // Check vault lock status
    checkVaultLockStatus();

    // Auto-promotion is handled server-side (on routine/task approve, kneel, etc.)
    // The user sees their new rank on next page load via the PROMOTION_CARD in chat.

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
        elDrawerCurBen.innerHTML = currentBenefits.map(b => `<div>${b}</div>`).join('');
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

        const buildCertRow = (status: string) => {
            const done = status === 'VERIFIED';
            const labelColor = done ? '#00ff00' : '#c5a059';
            const certIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${labelColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
            const wrapperStyle = `display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:0.65rem;font-family:'Orbitron';letter-spacing:1px;border-bottom:1px solid rgba(255,255,255,0.05);padding-bottom:8px;`;

            if (done) {
                return `<div style="${wrapperStyle}">
                    <span style="color:${labelColor};display:flex;align-items:center;gap:8px;font-weight:bold;">
                        ${certIcon} CERTIFICATE
                    </span>
                    <span style="color:#00ff00;font-weight:bold;font-size:0.55rem;letter-spacing:1px;">✓ APPROVED</span>
                </div>`;
            }
            return `<div style="${wrapperStyle}">
                <span style="color:${labelColor};display:flex;align-items:center;gap:8px;font-weight:bold;">
                    ${certIcon} CERTIFICATE
                </span>
                <button onclick="window.showCertificate()" style="padding:2px 8px;background:transparent;color:#c5a059;border:1px solid #c5a059;border-radius:4px;font-family:'Orbitron';font-size:0.55rem;font-weight:bold;cursor:pointer;letter-spacing:1px;">OPEN</button>
            </div>`;
        };

        let html = '';
        requirements.forEach(r => {
            if (r.type === 'bar') {
                html += buildBar(r.label, iconMap[r.label] || '•', r.current ?? 0, r.target ?? 0);
            } else if (r.id === 'cert') {
                html += buildCertRow(r.status ?? '');
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
                    ? `<div style="position:relative;width:100%;height:100%;cursor:pointer;" onclick="window.openQkLightbox('video','${heroPost.media_url}')">${heroPost.thumbnail_url ? `<img src="${heroPost.thumbnail_url}" alt="" style="width:100%;height:100%;object-fit:cover;" />` : ''}<div class="qk-play-icon qk-play-hero">▶</div></div>`
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
                    ? (isVideo
                        ? `<div class="qk-card-img qk-card-media">${p.thumbnail_url ? `<img src="${p.thumbnail_url}" alt="" style="width:100%;height:100%;object-fit:cover;filter:blur(10px) brightness(0.45);transform:scale(1.05);" />` : `<div style="width:100%;height:100%;background:radial-gradient(ellipse at center,#15100a 0%,#080808 100%);"></div>`}</div>`
                        : p.thumbnail_url
                            ? `<div class="qk-card-img qk-card-media qk-blurred"><img src="${p.thumbnail_url}" alt="" /></div>`
                            : `<div class="qk-card-img qk-card-media qk-blurred"><img src="${getOptimizedUrl(p.media_url, 400)}" alt="" /></div>`)
                    : isVideo
                        ? `<div class="qk-card-img qk-card-media" onclick="window.openQkLightbox('video','${p.media_url}')">${p.thumbnail_url ? `<img src="${p.thumbnail_url}" alt="" style="width:100%;height:100%;object-fit:cover;" />` : ''}<div class="qk-play-icon">▶</div></div>`
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
            const url = t.thumbnailUrl || (isVid ? '/queen-karin.png' : t.proofUrl);

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
            heroImg.src = t.thumbnailUrl || (isVid ? '/queen-karin.png' : t.proofUrl);
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

    const allApproved = raw.filter((t: any) => (t.status === 'approve' || t.status === 'approved') && t.proofUrl && t.proofUrl !== 'SKIPPED');
    const routines = allApproved.filter((t: any) => t.isRoutine).sort((a: any, b: any) =>
        new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
    );
    const tasks = allApproved.filter((t: any) => !t.isRoutine).sort((a: any, b: any) =>
        new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
    );
    const failed = raw.filter((t: any) => t.status === 'fail' || t.status === 'reject' || t.status === 'rejected');
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
        imgMain.src = thumbUrl || url;
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
        : `<img src="${thumbUrl || url}" class="altar-card-media" loading="lazy" ${_imgFallback} />`;
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
            img.src = thumbUrl || url;
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
            : `<img src="${thumbUrl || url}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;" loading="lazy" ${_imgFallback} />`;
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
            : `<img src="${thumbUrl || url}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;filter:grayscale(0.6);" loading="lazy" ${_imgFallback} />`;
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
                : `<img src="${thumbUrl || url}" style="width:100%;aspect-ratio:3/4;object-fit:cover;filter:brightness(0.45);" loading="lazy" ${_imgFallback}>`)
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
            : `<img src="${thumbUrl || url}" style="width:100%;aspect-ratio:3/4;object-fit:cover;object-position:center top;display:block;" loading="lazy" ${_imgFallback} />`;
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
        ? `<video src="${src}" controls playsinline style="max-width:95vw;max-height:88vh;border-radius:4px;"></video>`
        : `<img src="${src}" style="max-width:95vw;max-height:88vh;object-fit:contain;border-radius:4px;" />`;
    lb.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    if (type === 'video') {
        const vid = content.querySelector('video');
        if (vid) vid.play().catch(() => {});
    }
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
    const shouldShow = paywall?.active === true;
    const isShowing = overlay.style.display === 'flex';
    // Guard: don't touch the DOM at all if state hasn't changed
    if (shouldShow === isShowing) return;
    if (paywall?.active) {
        const reasonEl = document.getElementById('paywallReason');
        const amountEl = document.getElementById('paywallAmount');
        const payBtn   = document.getElementById('paywallPayBtn');
        const cryptoBtn = document.getElementById('paywallCryptoBtn');
        if (reasonEl) reasonEl.textContent = paywall.reason || '';
        if (amountEl) amountEl.textContent  = `€${Number(paywall.amount).toFixed(2)}`;

        // Crypto pay button
        if (cryptoBtn) {
            cryptoBtn.onclick = () => {
                const amount = Number(paywall.amount) || 0;
                _showPaywallCryptoPicker(amount, memberId, overlay);
            };
        }

        if (payBtn) {
            payBtn.onclick = () => {
                // Card payments unavailable — show notice and push to crypto
                const notice = document.getElementById('paywallCardNotice');
                if (notice) notice.style.display = 'flex';
            };
        }
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    } else {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// ─── PAYWALL CRYPTO ──────────────────────────────────────────────────────────

const PAYWALL_CRYPTO_OPTIONS = [
    { ticker: 'trc20/usdt', label: 'USDT', sub: 'TRC20 · Stablecoin', color: '#26a17b', icon: '₮' },
    { ticker: 'btc', label: 'BITCOIN', sub: 'BTC · ~10 min', color: '#f7931a', icon: '₿' },
    { ticker: 'eth', label: 'ETHEREUM', sub: 'ETH · ~2 min', color: '#627eea', icon: 'Ξ' },
    { ticker: 'ltc', label: 'LITECOIN', sub: 'LTC · ~5 min', color: '#bfbbbb', icon: 'Ł' },
];

export function _showPaywallCryptoPicker(amount: number, memberId: string, paywallOverlay: HTMLElement) {
    const existing = document.getElementById('_paywallCryptoPicker');
    if (existing) existing.remove();

    const isMob = window.innerWidth < 768;
    const overlay = document.createElement('div');
    overlay.id = '_paywallCryptoPicker';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);z-index:9999999;display:flex;align-items:center;justify-content:center;';

    const box = document.createElement('div');
    box.style.cssText = `background:linear-gradient(160deg,#0c0c1a,#08060f);border:1px solid rgba(160,100,220,0.2);border-radius:${isMob ? '14px' : '18px'};padding:${isMob ? '32px 24px' : '40px 44px'};max-width:${isMob ? '340px' : '420px'};width:90%;display:flex;flex-direction:column;align-items:center;gap:14px;`;

    let btns = '';
    for (const opt of PAYWALL_CRYPTO_OPTIONS) {
        btns += `<button data-ticker="${opt.ticker}" style="width:100%;padding:14px 18px;background:rgba(255,255,255,0.03);border:1px solid ${opt.color}33;border-radius:10px;cursor:pointer;display:flex;align-items:center;gap:14px;transition:all 0.2s;">
            <div style="width:38px;height:38px;border-radius:50%;background:${opt.color}12;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px;color:${opt.color};">${opt.icon}</div>
            <div style="text-align:left;">
                <div style="font-family:Cinzel,serif;font-size:0.75rem;color:${opt.color};letter-spacing:2px;font-weight:600;">${opt.label}</div>
                <div style="font-family:Rajdhani,sans-serif;font-size:0.55rem;color:rgba(255,255,255,0.25);letter-spacing:1px;margin-top:2px;">${opt.sub}</div>
            </div>
        </button>`;
    }

    box.innerHTML = `
        <div style="font-family:Cinzel,serif;font-size:${isMob ? '0.8rem' : '0.95rem'};color:#d4b0f0;letter-spacing:5px;font-weight:700;">SELECT CRYPTO</div>
        <div style="width:40px;height:1px;background:linear-gradient(90deg,transparent,rgba(160,100,220,0.3),transparent);"></div>
        <div style="font-family:Rajdhani,sans-serif;font-size:0.75rem;color:rgba(255,255,255,0.3);letter-spacing:3px;">€${amount.toFixed(2)}</div>
        <div style="width:100%;display:flex;flex-direction:column;gap:10px;margin-top:8px;">${btns}</div>
        <button id="_pwCryptoCancel" style="background:none;border:none;color:rgba(255,255,255,0.2);font-family:Rajdhani,sans-serif;font-size:0.6rem;letter-spacing:3px;padding:8px 20px;cursor:pointer;margin-top:4px;">CANCEL</button>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    box.querySelector('#_pwCryptoCancel')!.addEventListener('click', () => overlay.remove());

    box.querySelectorAll('button[data-ticker]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const ticker = (btn as HTMLElement).dataset.ticker!;
            overlay.remove();
            await _processPaywallCrypto(amount, ticker, memberId, paywallOverlay);
        });
    });
}

async function _processPaywallCrypto(amount: number, ticker: string, memberId: string, paywallOverlay: HTMLElement) {
    // Show loading
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = '_paywallCryptoLoading';
    loadingOverlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999999;display:flex;align-items:center;justify-content:center;';
    loadingOverlay.innerHTML = '<div style="text-align:center;"><div style="font-family:Cinzel,serif;font-size:1rem;color:#d4b0f0;letter-spacing:5px;margin-bottom:12px;">CRYPTO PAYMENT</div><div style="font-family:Rajdhani,sans-serif;font-size:0.75rem;color:rgba(255,255,255,0.35);letter-spacing:4px;">PREPARING...</div></div>';
    document.body.appendChild(loadingOverlay);

    try {
        const res = await fetch('/api/paywall/crypto', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker, memberId }),
        });
        const data = await res.json();
        if (!data.address) {
            loadingOverlay.remove();
            alert('Could not create crypto payment. Try again.');
            return;
        }

        // Show payment details
        const isMob = window.innerWidth < 768;
        loadingOverlay.innerHTML = `
            <div style="background:linear-gradient(160deg,#0c0c1a,#08060f);border:1px solid rgba(160,100,220,0.2);border-radius:${isMob ? '14px' : '18px'};padding:${isMob ? '28px 20px' : '40px 44px'};max-width:${isMob ? '340px' : '420px'};width:90%;text-align:center;">
                <div style="font-family:Cinzel,serif;font-size:0.95rem;color:#d4b0f0;letter-spacing:5px;font-weight:700;margin-bottom:16px;">CRYPTO PAYMENT</div>
                <div style="font-family:Rajdhani,sans-serif;font-size:0.7rem;color:rgba(255,255,255,0.3);letter-spacing:3px;margin-bottom:20px;">€${amount.toFixed(2)}</div>
                <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(160,100,220,0.15);border-radius:10px;padding:16px;margin-bottom:16px;">
                    <div style="font-family:Rajdhani,sans-serif;font-size:0.55rem;color:rgba(255,255,255,0.3);letter-spacing:3px;margin-bottom:8px;">SEND EXACTLY</div>
                    <div style="font-family:'Courier New',monospace;font-size:1.1rem;color:#fff;word-break:break-all;margin-bottom:12px;">${data.amount}</div>
                    <div style="font-family:Rajdhani,sans-serif;font-size:0.55rem;color:rgba(255,255,255,0.3);letter-spacing:3px;margin-bottom:8px;">TO ADDRESS</div>
                    <div style="font-family:'Courier New',monospace;font-size:0.65rem;color:rgba(255,255,255,0.7);word-break:break-all;user-select:all;">${data.address}</div>
                </div>
                <div id="_pwCryptoStatus" style="font-family:Rajdhani,sans-serif;font-size:0.7rem;color:rgba(255,255,255,0.35);letter-spacing:3px;">WAITING FOR PAYMENT...</div>
                <button id="_pwCryptoClose" style="background:none;border:none;color:rgba(255,255,255,0.15);font-family:Rajdhani,sans-serif;font-size:0.55rem;letter-spacing:3px;padding:12px 20px;cursor:pointer;margin-top:16px;">CLOSE</button>
            </div>
        `;

        loadingOverlay.querySelector('#_pwCryptoClose')!.addEventListener('click', () => loadingOverlay.remove());

        // Poll for confirmation
        let polls = 0;
        const pollInterval = setInterval(async () => {
            polls++;
            if (polls > 120) { clearInterval(pollInterval); return; }
            try {
                const r = await fetch('/api/paywall/crypto-verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ paymentId: data.paymentId, memberId }),
                });
                const v = await r.json();
                if (v.paid) {
                    clearInterval(pollInterval);
                    const statusEl = document.getElementById('_pwCryptoStatus');
                    if (statusEl) {
                        statusEl.style.color = '#4caf50';
                        statusEl.textContent = '✓ PAYMENT CONFIRMED — UNLOCKING...';
                    }
                    setTimeout(() => {
                        loadingOverlay.remove();
                        paywallOverlay.style.display = 'none';
                        document.body.style.overflow = '';
                        window.location.reload();
                    }, 1500);
                }
            } catch {}
        }, 5000);
    } catch (e: any) {
        loadingOverlay.remove();
        alert('Payment error: ' + e.message);
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
    // Use querySelectorAll to handle duplicate IDs across chatContent + mob_chatContent
    document.querySelectorAll(`[id="pmWrap_${pmId}"]`).forEach((wrap: Element) => {
        wrap.classList.remove('pm-locked');
        const img = wrap.querySelector('img') as HTMLElement;
        const vid = wrap.querySelector('video') as HTMLVideoElement;
        if (img) { img.style.filter = 'none'; img.style.transform = 'scale(1)'; }
        if (vid) { vid.style.filter = 'none'; vid.style.transform = 'scale(1)'; vid.controls = true; }
    });

    document.querySelectorAll(`[id="pmOverlay_${pmId}"]`).forEach(el => el.remove());

    document.querySelectorAll(`[id="pmStatus_${pmId}"]`).forEach((el: Element) => {
        el.textContent = 'UNLOCKED';
        el.className = 'pm-status unlocked';
    });

    document.querySelectorAll(`[id="pmCard_${pmId}"]`).forEach((card: Element) => {
        if (mediaUrl) {
            (card as HTMLElement).style.cursor = 'pointer';
            (card as HTMLElement).onclick = () => _openPaidMediaModal(mediaUrl, mediaType || 'photo');
        }
    });
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
                console.log('[paid-media] revealed unlocked media:', id);
            }
        });
    } catch (err) {
        console.error('[paid-media] status check failed:', err);
    }
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
