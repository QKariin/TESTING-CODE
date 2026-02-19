// src/scripts/kneeling.ts
// Kneeling Logic - Converted to TypeScript

import { getState, setState } from './profile-state';

let holdTimer: NodeJS.Timeout | null = null;
const REQUIRED_HOLD_TIME = 2000;

export function handleHoldStart(e: React.MouseEvent | React.TouchEvent) {
    const { isLocked } = getState();
    if (isLocked) return;

    if (e.cancelable) {
        e.preventDefault();
        e.stopPropagation();
    }

    // DESKTOP TARGETS
    const fill = document.getElementById('heroKneelFill');
    const txtMain = document.getElementById('heroKneelText');

    // MOBILE TARGETS
    const mobFill = document.getElementById('mob_kneelFill');
    const mobText = document.querySelector('.kneel-label') as HTMLElement;
    const mobBar = document.querySelector('.mob-kneel-zone') as HTMLElement;

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
    if (mobBar) mobBar.style.borderColor = "var(--gold)";

    // START TIMER
    holdTimer = setTimeout(() => {
        completeKneelAction();
    }, REQUIRED_HOLD_TIME);
}

export function handleHoldEnd(e?: React.MouseEvent | React.TouchEvent) {
    if (e?.cancelable) e.preventDefault();

    const { isLocked } = getState();
    if (isLocked) {
        if (holdTimer) clearTimeout(holdTimer);
        holdTimer = null;
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
        const mobText = document.querySelector('.kneel-label') as HTMLElement;
        const mobBar = document.querySelector('.mob-kneel-zone') as HTMLElement;

        if (mobFill) {
            mobFill.style.transition = "width 0.3s ease";
            mobFill.style.width = "0%";
        }
        if (mobText) mobText.innerText = "HOLD TO KNEEL";
        if (mobBar) mobBar.style.borderColor = "#c5a059";
    }
}

async function completeKneelAction() {
    if (holdTimer) clearTimeout(holdTimer);
    holdTimer = null;

    const { memberId } = getState();
    if (!memberId) return;

    const now = Date.now();
    setState({ lastWorshipTime: now, isLocked: true });

    // Show Reward Overlays
    const deskReward = document.getElementById('kneelRewardOverlay');
    if (deskReward) deskReward.classList.remove('hidden');

    const mobReward = document.getElementById('mobKneelReward');
    if (mobReward) mobReward.classList.remove('hidden');

    // Trigger Sound (Need to implement triggerSound or use HTMLAudioElement)
    const msgSound = document.getElementById('msgSound') as HTMLAudioElement;
    if (msgSound) msgSound.play().catch(e => console.log("Sound error", e));

    updateKneelingUI();
}

export function updateKneelingUI() {
    const { lastWorshipTime, cooldownMinutes } = getState();
    const now = Date.now();

    const fill = document.getElementById('heroKneelFill');
    const txtMain = document.getElementById('heroKneelText');
    const mobFill = document.getElementById('mob_kneelFill');
    const mobText = document.querySelector('.kneel-label') as HTMLElement;
    const mobBar = document.querySelector('.mob-kneel-zone') as HTMLElement;

    const diffMs = now - lastWorshipTime;
    const cooldownMs = cooldownMinutes * 60 * 1000;

    if (lastWorshipTime > 0 && diffMs < cooldownMs) {
        const minLeft = Math.ceil((cooldownMs - diffMs) / 60000);
        const progress = 100 - ((diffMs / cooldownMs) * 100);

        if (txtMain) txtMain.innerText = `LOCKED: ${minLeft}m`;
        if (fill) {
            fill.style.transition = "none";
            fill.style.width = Math.max(0, progress) + "%";
        }

        if (mobText) mobText.innerText = `LOCKED: ${minLeft}m`;
        if (mobFill) {
            mobFill.style.transition = "none";
            mobFill.style.width = Math.max(0, progress) + "%";
        }
        if (mobBar) {
            mobBar.style.borderColor = "#ff003c";
            mobBar.style.opacity = "0.7";
        }
    } else {
        setState({ isLocked: false });
        if (txtMain) txtMain.innerText = "HOLD TO KNEEL";
        if (fill) {
            fill.style.transition = "width 0.3s ease";
            fill.style.width = "0%";
        }
        if (mobText) mobText.innerText = "HOLD TO KNEEL";
        if (mobFill) {
            mobFill.style.transition = "width 0.3s ease";
            mobFill.style.width = "0%";
        }
        if (mobBar) {
            mobBar.style.borderColor = "#c5a059";
            mobBar.style.opacity = "1";
        }
    }
}
