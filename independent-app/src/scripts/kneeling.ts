// src/scripts/kneeling.ts
// Ported from kneeling.js (Velo original) — adapted for Next.js/Vercel
// KEY FIX vs original: added "if (holdTimer) return;" guard at top of handleHoldStart
// because in a real browser (not Wix iframe), mobile fires BOTH touchstart AND mousedown,
// so without the guard the second call overwrites holdTimer and touchend clears it instantly.

import { getState, setState } from './profile-state';
import { createClient } from '@/utils/supabase/client';

let holdTimer: ReturnType<typeof setTimeout> | null = null;
const REQUIRED_HOLD_TIME = 2000;

// ─── ATTACH LISTENERS (called from page useEffect after DOM is ready) ─────────
export function attachKneelListeners() {
    const desktopBtn = document.getElementById('heroKneelBtn');
    const mobileBtn = document.getElementById('mobKneelBar');

    [desktopBtn, mobileBtn].forEach(btn => {
        if (!btn) return;
        if ((btn as any).__kneelAttached) return; // only attach once
        (btn as any).__kneelAttached = true;

        // mousedown + touchstart both call handleHoldStart
        // but holdTimer guard prevents double-execution on mobile
        btn.addEventListener('mousedown', handleHoldStart as EventListener, { passive: false });
        btn.addEventListener('touchstart', handleHoldStart as EventListener, { passive: false });
        btn.addEventListener('mouseup', handleHoldEnd as EventListener, { passive: false });
        btn.addEventListener('touchend', handleHoldEnd as EventListener, { passive: false });
        console.log('[kneel] attached to', btn.id || btn.className);
    });
}

// ─── 1. HOLD START ────────────────────────────────────────────────────────────
export function handleHoldStart(e?: Event) {
    // GUARD: if already timing, ignore (mobile fires both touchstart AND mousedown)
    if (holdTimer) return;

    const { isLocked } = getState();
    if (isLocked) return;

    if (e && e.cancelable) {
        e.preventDefault();   // also blocks the synthetic mousedown after touchstart
        e.stopPropagation();
    }

    // ANIMATE DESKTOP
    const fill = document.getElementById('heroKneelFill');
    const txtMain = document.getElementById('heroKneelText');
    if (fill) { fill.style.transition = `width ${REQUIRED_HOLD_TIME}ms linear`; fill.style.width = '100%'; }
    if (txtMain) txtMain.innerText = 'KNEELING...';

    // ANIMATE MOBILE
    const mobFill = document.getElementById('mob_kneelFill');
    const mobText = document.querySelector('.kneel-label') as HTMLElement | null;
    const mobBar = document.querySelector('.mob-kneel-zone') as HTMLElement | null;
    if (mobFill) { mobFill.style.transition = `width ${REQUIRED_HOLD_TIME}ms linear`; mobFill.style.width = '100%'; }
    if (mobText) mobText.innerText = 'SUBMITTING...';
    if (mobBar) mobBar.style.borderColor = 'var(--gold, #c5a059)';

    // START TIMER
    holdTimer = setTimeout(() => {
        completeKneelAction();
    }, REQUIRED_HOLD_TIME);
}

// ─── 2. HOLD END ─────────────────────────────────────────────────────────────
export function handleHoldEnd(e?: Event) {
    if (e?.cancelable) e.preventDefault();

    const { isLocked } = getState();
    if (isLocked) {
        if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
        return;
    }

    if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;

        // RESET DESKTOP
        const fill = document.getElementById('heroKneelFill');
        const txtMain = document.getElementById('heroKneelText');
        if (fill) { fill.style.transition = 'width 0.3s ease'; fill.style.width = '0%'; }
        if (txtMain) txtMain.innerText = 'HOLD TO KNEEL';

        // RESET MOBILE
        const mobFill = document.getElementById('mob_kneelFill');
        const mobText = document.querySelector('.kneel-label') as HTMLElement | null;
        const mobBar = document.querySelector('.mob-kneel-zone') as HTMLElement | null;
        if (mobFill) { mobFill.style.transition = 'width 0.3s ease'; mobFill.style.width = '0%'; }
        if (mobText) mobText.innerText = 'HOLD TO KNEEL';
        if (mobBar) mobBar.style.borderColor = '#c5a059';
    }
}

// ─── 3. COMPLETION ────────────────────────────────────────────────────────────
async function completeKneelAction() {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }

    const now = Date.now();
    setState({ lastWorshipTime: now, isLocked: true });

    updateKneelingUI();
    showRewardScreen();

    // Sound
    const snd = document.getElementById('msgSound') as HTMLAudioElement | null;
    if (snd) snd.play().catch(() => null);

    // Save to DB
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
            await fetch('/api/kneel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memberEmail: user.email }),
            });
        }
    } catch (err) {
        console.warn('[kneel] DB save failed:', err);
    }
}

// ─── 4. REWARD SCREEN ─────────────────────────────────────────────────────────
function showRewardScreen() {
    document.getElementById('_kneelReward')?.remove();
    const overlay = document.createElement('div');
    overlay.id = '_kneelReward';
    overlay.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:99999;
        display:flex;align-items:center;justify-content:center;flex-direction:column;gap:20px;
        font-family:'Cinzel',serif;
    `;
    overlay.innerHTML = `
        <div style="font-family:'Orbitron',sans-serif;color:#c5a059;font-size:1.4rem;letter-spacing:4px;text-align:center;">◈ SUBMISSION ACCEPTED ◈</div>
        <div style="color:rgba(255,255,255,0.5);font-size:0.8rem;letter-spacing:2px;">Choose your reward</div>
        <div style="display:flex;gap:16px;margin-top:10px;">
            <button id="_rewardMerit" style="padding:14px 28px;background:rgba(197,160,89,0.1);border:1px solid #c5a059;color:#c5a059;font-family:'Orbitron',sans-serif;font-size:0.75rem;letter-spacing:2px;cursor:pointer;border-radius:4px;">+50 MERIT</button>
            <button id="_rewardCoins" style="padding:14px 28px;background:rgba(0,150,255,0.08);border:1px solid #4af;color:#4af;font-family:'Orbitron',sans-serif;font-size:0.75rem;letter-spacing:2px;cursor:pointer;border-radius:4px;">+10 COINS</button>
        </div>
        <div style="color:rgba(255,255,255,0.2);font-size:0.6rem;margin-top:6px;">Next kneel available in 60 minutes</div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('_rewardMerit')!.addEventListener('click', () => {
        overlay.remove();
        claimReward('merit');
    });
    document.getElementById('_rewardCoins')!.addEventListener('click', () => {
        overlay.remove();
        claimReward('coins');
    });
}

async function claimReward(type: 'merit' | 'coins') {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) return;
        const field = type === 'merit' ? 'score' : 'wallet';
        const delta = type === 'merit' ? 50 : 10;
        const { data: p } = await supabase.from('profiles').select('score,wallet').eq('member_id', user.email).maybeSingle();
        if (p) {
            const current = type === 'merit' ? (p.score || 0) : (p.wallet || 0);
            await fetch('/api/profile-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memberEmail: user.email, field, value: current + delta, cost: 0 }),
            });
        }
    } catch (err) {
        console.warn('[kneel-reward] failed:', err);
    }
}

// ─── 5. UI SYNC (restore locked/unlocked state on page load) ─────────────────
export function updateKneelingUI() {
    const { lastWorshipTime, cooldownMinutes } = getState();
    const now = Date.now();
    const diffMs = now - lastWorshipTime;
    const cooldownMs = (cooldownMinutes || 60) * 60 * 1000;

    const fill = document.getElementById('heroKneelFill');
    const txtMain = document.getElementById('heroKneelText');
    const mobFill = document.getElementById('mob_kneelFill');
    const mobText = document.querySelector('.kneel-label') as HTMLElement | null;
    const mobBar = document.querySelector('.mob-kneel-zone') as HTMLElement | null;

    if (lastWorshipTime > 0 && diffMs < cooldownMs) {
        setState({ isLocked: true });
        const minLeft = Math.ceil((cooldownMs - diffMs) / 60000);
        const progress = 100 - (diffMs / cooldownMs) * 100;
        if (txtMain) txtMain.innerText = `LOCKED: ${minLeft}m`;
        if (fill) { fill.style.transition = 'none'; fill.style.width = `${Math.max(0, progress)}%`; }
        if (mobText) mobText.innerText = `LOCKED: ${minLeft}m`;
        if (mobFill) { mobFill.style.transition = 'none'; mobFill.style.width = `${Math.max(0, progress)}%`; }
        if (mobBar) { mobBar.style.borderColor = '#ff003c'; (mobBar as HTMLElement).style.opacity = '0.7'; }
    } else {
        setState({ isLocked: false });
        if (txtMain) txtMain.innerText = 'HOLD TO KNEEL';
        if (fill) { fill.style.transition = 'width 0.3s ease'; fill.style.width = '0%'; }
        if (mobText) mobText.innerText = 'HOLD TO KNEEL';
        if (mobFill) { mobFill.style.transition = 'width 0.3s ease'; mobFill.style.width = '0%'; }
        if (mobBar) { mobBar.style.borderColor = '#c5a059'; (mobBar as HTMLElement).style.opacity = '1'; }
    }
}
