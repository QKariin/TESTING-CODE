// src/scripts/kneeling.ts
// Ported from kneeling.js (Velo original) — adapted for Next.js/Vercel
// KEY FIX vs original: added "if (holdTimer) return;" guard at top of handleHoldStart
// because in a real browser (not Wix iframe), mobile fires BOTH touchstart AND mousedown,
// so without the guard the second call overwrites holdTimer and touchend clears it instantly.

import { getState, setState } from './profile-state';
import { supabase } from '@/lib/supabase';

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

        btn.addEventListener('mousedown', handleHoldStart as EventListener, { passive: false });
        btn.addEventListener('touchstart', handleHoldStart as EventListener, { passive: false });
        btn.addEventListener('mouseup', handleHoldEnd as EventListener, { passive: false });
        btn.addEventListener('touchend', handleHoldEnd as EventListener, { passive: false });
        btn.addEventListener('mouseleave', handleHoldEnd as EventListener, { passive: false });
        btn.addEventListener('touchcancel', handleHoldEnd as EventListener, { passive: false });
        console.log('[kneel] attached to', btn.id || btn.className);
    });
}

// --- 1. HOLD START ---
export function handleHoldStart(e?: Event) {
    const { isLocked } = getState();
    if (isLocked) return;

    if (e && e.cancelable) {
        e.preventDefault();
        e.stopPropagation();
    }

    // DESKTOP TARGETS
    const fill = document.getElementById('heroKneelFill');
    const txtMain = document.getElementById('heroKneelText');

    // MOBILE TARGETS
    const mobFill = document.getElementById('mob_kneelFill');
    const mobText = document.querySelector('.kneel-label') as HTMLElement | null;
    const mobBar = document.querySelector('.mob-kneel-zone') as HTMLElement | null;

    // ANIMATE DESKTOP
    if (fill) {
        fill.style.transition = "width 2s linear";
        fill.style.width = "100%";
    }
    if (txtMain) txtMain.innerText = "KNEELING...";

    // ANIMATE MOBILE
    if (mobFill) {
        mobFill.style.transition = "width 2s linear";
        mobFill.style.width = "100%";
    }
    if (mobText) mobText.innerText = "SUBMITTING...";
    if (mobBar) mobBar.style.borderColor = "var(--gold, #c5a059)";

    // START TIMER
    holdTimer = setTimeout(() => {
        completeKneelAction();
    }, REQUIRED_HOLD_TIME);
}

// --- 2. HOLD END ---
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
        if (fill) {
            fill.style.transition = "width 0.3s ease";
            fill.style.width = "0%";
        }
        if (txtMain) txtMain.innerText = "HOLD TO KNEEL";

        // RESET MOBILE
        const mobFill = document.getElementById('mob_kneelFill');
        const mobText = document.querySelector('.kneel-label') as HTMLElement | null;
        const mobBar = document.querySelector('.mob-kneel-zone') as HTMLElement | null;

        if (mobFill) {
            mobFill.style.transition = "width 0.3s ease";
            mobFill.style.width = "0%";
        }
        if (mobText) mobText.innerText = "HOLD TO KNEEL";
        if (mobBar) mobBar.style.borderColor = "#c5a059";
    }
}

// --- 3. COMPLETION ---
async function completeKneelAction() {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }

    const now = Date.now();
    setState({ lastWorshipTime: now, isLocked: true });

    updateKneelingUI();

    // SHOW DESKTOP REWARD
    const deskReward = document.getElementById('kneelRewardOverlay');
    if (deskReward) {
        deskReward.classList.remove('hidden');
        deskReward.style.display = 'flex';
    }

    // SHOW MOBILE REWARD
    const mobReward = document.getElementById('mobKneelReward');
    if (mobReward) {
        mobReward.classList.remove('hidden');
        mobReward.style.display = 'flex';
    }

    // Sound
    const snd = document.getElementById('msgSound') as HTMLAudioElement | null;
    if (snd) snd.play().catch(() => null);

    try {
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

        if (txtMain && fill) {
            txtMain.innerText = `LOCKED: ${minLeft}m`;
            fill.style.transition = 'none';
            fill.style.width = `${Math.max(0, progress)}%`;
        }

        if (mobText && mobFill && mobBar) {
            mobText.innerText = `LOCKED: ${minLeft}m`;
            mobFill.style.transition = 'none';
            mobFill.style.width = `${Math.max(0, progress)}%`;
            mobBar.style.borderColor = '#ff003c';
            (mobBar as HTMLElement).style.opacity = '0.7';
        }
    } else {
        setState({ isLocked: false });
        if (txtMain && fill) {
            txtMain.innerText = 'HOLD TO KNEEL';
            fill.style.transition = 'width 0.3s ease';
            fill.style.width = '0%';
        }
        if (mobText && mobFill && mobBar) {
            mobText.innerText = 'HOLD TO KNEEL';
            mobFill.style.transition = 'width 0.3s ease';
            mobFill.style.width = '0%';
            mobBar.style.borderColor = '#c5a059';
            (mobBar as HTMLElement).style.opacity = '1';
        }
    }
}
