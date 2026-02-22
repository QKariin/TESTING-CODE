// src/scripts/kneeling.ts
// Kneeling Logic — Fixed hold detection + DB save + cooldown restore

import { getState, setState } from './profile-state';
import { createClient } from '@/utils/supabase/client';

let holdTimer: ReturnType<typeof setTimeout> | null = null;
let holdStarted = false;
const REQUIRED_HOLD_TIME = 2000;

// ─── ATTACH LISTENERS (called from page useEffect, NOT React props) ───────────
export function attachKneelListeners() {
    const desktopBtn = document.getElementById('heroKneelBtn');
    const mobileBtn = document.getElementById('mobKneelBar');

    [desktopBtn, mobileBtn].forEach(btn => {
        if (!btn) return;
        // Remove any previous listeners by cloning the node
        // (safe: the button has no React-managed children that need reconciliation)
        btn.addEventListener('mousedown', handleHoldStart, { passive: false });
        btn.addEventListener('touchstart', handleHoldStart, { passive: false });
        btn.addEventListener('mouseup', handleHoldEnd, { passive: false });
        btn.addEventListener('mouseleave', handleHoldEnd, { passive: false });
        btn.addEventListener('touchend', handleHoldEnd, { passive: false });
        btn.addEventListener('touchcancel', cancelHold, { passive: false });
    });
}

function cancelHold() {
    holdStarted = false;
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    // Reset visuals
    const fill = document.getElementById('heroKneelFill');
    const txtMain = document.getElementById('heroKneelText');
    if (fill) { fill.style.transition = 'width 0.3s ease'; fill.style.width = '0%'; }
    if (txtMain) txtMain.innerText = 'HOLD TO KNEEL';
    const mobFill = document.getElementById('mob_kneelFill');
    const mobText = document.querySelector('.kneel-label') as HTMLElement | null;
    const mobBar = document.querySelector('.mob-kneel-zone') as HTMLElement | null;
    if (mobFill) { mobFill.style.transition = 'width 0.3s ease'; mobFill.style.width = '0%'; }
    if (mobText) mobText.innerText = 'HOLD TO KNEEL';
    if (mobBar) mobBar.style.borderColor = '#c5a059';
}

// ─── 1. HOLD START ────────────────────────────────────────────────────────────
export function handleHoldStart(e: any) {
    const { isLocked } = getState();
    if (isLocked) return;
    if (holdTimer) return; // already running, ignore duplicate fires

    // Prevent scroll cancelling the hold on mobile
    if (e.cancelable) e.preventDefault();

    holdStarted = true;

    // Animate desktop
    const fill = document.getElementById('heroKneelFill');
    const txtMain = document.getElementById('heroKneelText');
    if (fill) { fill.style.transition = 'width 2s linear'; fill.style.width = '100%'; }
    if (txtMain) txtMain.innerText = 'KNEELING...';

    // Animate mobile
    const mobFill = document.getElementById('mob_kneelFill');
    const mobText = document.querySelector('.kneel-label') as HTMLElement | null;
    const mobBar = document.querySelector('.mob-kneel-zone') as HTMLElement | null;
    if (mobFill) { mobFill.style.transition = 'width 2s linear'; mobFill.style.width = '100%'; }
    if (mobText) mobText.innerText = 'SUBMITTING...';
    if (mobBar) mobBar.style.borderColor = 'var(--gold)';

    holdTimer = setTimeout(() => {
        completeKneelAction();
    }, REQUIRED_HOLD_TIME);
}

// ─── 2. HOLD END ─────────────────────────────────────────────────────────────
export function handleHoldEnd(e?: any) {
    // Don't cancel if already completed (holdTimer already cleared by completeKneelAction)
    if (!holdStarted) return;
    holdStarted = false;

    const { isLocked } = getState();
    if (isLocked) {
        if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
        return;
    }

    if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;

        // Reset desktop
        const fill = document.getElementById('heroKneelFill');
        const txtMain = document.getElementById('heroKneelText');
        if (fill) { fill.style.transition = 'width 0.3s ease'; fill.style.width = '0%'; }
        if (txtMain) txtMain.innerText = 'HOLD TO KNEEL';

        // Reset mobile
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
    holdStarted = false;

    const { memberId } = getState();
    if (!memberId) return;

    const now = Date.now();
    setState({ lastWorshipTime: now, isLocked: true });

    updateKneelingUI();

    // Show reward overlays
    const deskReward = document.getElementById('kneelRewardOverlay');
    if (deskReward) { deskReward.classList.remove('hidden'); deskReward.style.display = 'flex'; }
    const mobReward = document.getElementById('mobKneelReward');
    if (mobReward) { mobReward.classList.remove('hidden'); mobReward.style.display = 'flex'; }

    // Sound
    const msgSound = document.getElementById('msgSound') as HTMLAudioElement | null;
    if (msgSound) msgSound.play().catch(() => null);

    // Save to DB (update lastKneelDate + increment kneelCount)
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
            await fetch('/api/profile-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    memberEmail: user.email,
                    field: 'lastKneelDate',
                    value: new Date(now).toISOString(),
                    cost: 0,
                })
            });
        }
    } catch (err) {
        console.warn('[kneel] DB save failed:', err);
    }
}

// ─── 4. UI SYNC ───────────────────────────────────────────────────────────────
export function updateKneelingUI() {
    const { lastWorshipTime, cooldownMinutes, isLocked } = getState();
    const now = Date.now();
    const diffMs = now - lastWorshipTime;
    const cooldownMs = cooldownMinutes * 60 * 1000;

    const fill = document.getElementById('heroKneelFill');
    const txtMain = document.getElementById('heroKneelText');
    const mobFill = document.getElementById('mob_kneelFill');
    const mobText = document.querySelector('.kneel-label') as HTMLElement | null;
    const mobBar = document.querySelector('.mob-kneel-zone') as HTMLElement | null;

    if (lastWorshipTime > 0 && diffMs < cooldownMs) {
        const minLeft = Math.ceil((cooldownMs - diffMs) / 60000);
        const progress = 100 - (diffMs / cooldownMs) * 100;

        if (txtMain) txtMain.innerText = `LOCKED: ${minLeft}m`;
        if (fill) { fill.style.transition = 'none'; fill.style.width = Math.max(0, progress) + '%'; }
        if (mobText) mobText.innerText = `LOCKED: ${minLeft}m`;
        if (mobFill) { mobFill.style.transition = 'none'; mobFill.style.width = Math.max(0, progress) + '%'; }
        if (mobBar) { mobBar.style.borderColor = '#ff003c'; mobBar.style.opacity = '0.7'; }
    } else {
        setState({ isLocked: false });
        if (txtMain) txtMain.innerText = 'HOLD TO KNEEL';
        if (fill) { fill.style.transition = 'width 0.3s ease'; fill.style.width = '0%'; }
        if (mobText) mobText.innerText = 'HOLD TO KNEEL';
        if (mobFill) { mobFill.style.transition = 'width 0.3s ease'; mobFill.style.width = '0%'; }
        if (mobBar) { mobBar.style.borderColor = '#c5a059'; mobBar.style.opacity = '1'; }
    }
}
