// kneeling.js - FINAL TWIN SYNC (DESKTOP + MOBILE REWARDS)

// 1. PATHS
import {
    isLocked, lastWorshipTime, COOLDOWN_MINUTES, gameStats, ignoreBackendUpdates, userProfile
} from '../../js/state.js';

import {
    setIsLocked, setLastWorshipTime, setIgnoreBackendUpdates
} from '../../js/state.js';

import { triggerSound } from '../../js/utils.js';

let holdTimer = null;
const REQUIRED_HOLD_TIME = 2000;

// --- 1. HOLD START ---
export function handleHoldStart(e) {
    if (isLocked) return;

    if (e && e.cancelable) {
        e.preventDefault();
        e.stopPropagation();
    }

    // TARGET ALL DESKTOP INSTANCES
    const fills = document.querySelectorAll('#fill, #heroKneelFill');
    const texts = document.querySelectorAll('#txt-main, #heroKneelText');

    fills.forEach(el => {
        el.style.transition = "width 2s linear";
        el.style.width = "100%";
    });
    texts.forEach(el => el.innerText = "KNEELING...");

    // MOBILE TARGETS
    const mobFill = document.getElementById('mob_kneelFill');
    const mobText = document.querySelector('.kneel-label');
    const mobBar = document.querySelector('.mob-kneel-zone');

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

// --- 2. HOLD END ---
export function handleHoldEnd(e) {
    if (e) e.preventDefault();

    if (isLocked) {
        if (holdTimer) clearTimeout(holdTimer);
        holdTimer = null;
        return;
    }

    if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;

        // RESET ALL DESKTOP
        const fills = document.querySelectorAll('#fill, #heroKneelFill');
        const texts = document.querySelectorAll('#txt-main, #heroKneelText');
        fills.forEach(el => {
            el.style.transition = "width 0.3s ease";
            el.style.width = "0%";
        });
        texts.forEach(el => el.innerText = "HOLD TO KNEEL");

        // RESET MOBILE
        const mobFill = document.getElementById('mob_kneelFill');
        const mobText = document.querySelector('.kneel-label');
        const mobBar = document.querySelector('.mob-kneel-zone');

        if (mobFill) {
            mobFill.style.transition = "width 0.3s ease";
            mobFill.style.width = "0%";
        }
        if (mobText) mobText.innerText = "HOLD";
        if (mobBar) mobBar.style.borderColor = "#c5a059";
    }
}

// --- 3. COMPLETION (UPDATED FOR MOBILE POPUP) ---
function completeKneelAction() {
    if (holdTimer) clearTimeout(holdTimer);
    holdTimer = null;

    const now = Date.now();
    setLastWorshipTime(now);
    setIsLocked(true);
    setIgnoreBackendUpdates(true);

    window.parent.postMessage({ type: "FINISH_KNEELING" }, "*");

    updateKneelingStatus();

    // SHOW DESKTOP REWARD
    const deskReward = document.getElementById('kneelRewardOverlay');
    if (deskReward) {
        deskReward.classList.remove('hidden');
        deskReward.style.display = 'flex';
    }

    // SHOW MOBILE REWARD (FIX ADDED HERE)
    const mobReward = document.getElementById('mobKneelReward');
    if (mobReward) {
        mobReward.classList.remove('hidden');
        mobReward.style.display = 'flex';
    }

    triggerSound('msgSound');
    setTimeout(() => { setIgnoreBackendUpdates(false); }, 15000);
}

// --- 4. STATUS SYNC ---
export function updateKneelingStatus() {
    const now = Date.now();

    const today = new Date();
    const m = today.getMonth() + 1;
    const day = today.getDate();
    const dayCode = ((110 - m) * 100 + (82 - day)).toString().padStart(4, '0');
    const idEl = document.getElementById('dailyRandomId');
    if (idEl) idEl.innerText = "#" + dayCode;

    // TARGETS
    const btns = document.querySelectorAll('#btn, #heroKneelBtn');
    const textEls = document.querySelectorAll('#txt-main, #heroKneelText');
    const fillEls = document.querySelectorAll('#fill, #heroKneelFill');
    const txtSub = document.getElementById('txt-sub');

    // MOBILE
    const mobFill = document.getElementById('mob_kneelFill');
    const mobText = document.querySelector('.kneel-label');
    const mobBar = document.querySelector('.mob-kneel-zone');

    const diffMs = now - lastWorshipTime;
    const cooldownMs = COOLDOWN_MINUTES * 60 * 1000;

    // A. LOCKED STATE
    if (lastWorshipTime > 0 && diffMs < cooldownMs) {
        setIsLocked(true);
        const minLeft = Math.ceil((cooldownMs - diffMs) / 60000);

        // Desktop
        textEls.forEach(el => el.innerText = `LOCKED: ${minLeft}m`);
        const progress = 100 - ((diffMs / cooldownMs) * 100);
        fillEls.forEach(el => {
            el.style.transition = "none";
            el.style.width = Math.max(0, progress) + "%";
        });
        btns.forEach(el => el.style.cursor = "not-allowed");

        // Mobile
        if (mobText && mobFill) {
            mobText.innerText = `LOCKED: ${minLeft}m`;
            const progress = 100 - ((diffMs / cooldownMs) * 100);
            mobFill.style.transition = "none";
            mobFill.style.width = Math.max(0, progress) + "%";

            if (mobBar) {
                mobBar.style.borderColor = "#ff003c";
                mobBar.style.opacity = "0.7";
            }
        }
    }
    // B. UNLOCKED STATE
    else if (!holdTimer) {
        setIsLocked(false);

        // Desktop
        textEls.forEach(el => el.innerText = "HOLD TO KNEEL");
        fillEls.forEach(el => {
            el.style.transition = "width 0.3s ease";
            el.style.width = "0%";
        });
        btns.forEach(el => el.style.cursor = "pointer");

        // Mobile
        if (mobText && mobFill) {
            mobText.innerText = "HOLD TO KNEEL";
            mobFill.style.transition = "width 0.3s ease";
            mobFill.style.width = "0%";
            if (mobBar) {
                mobBar.style.borderColor = "#c5a059";
                mobBar.style.opacity = "0.7";
            }
        }
    }

    if (txtSub && gameStats) {
        txtSub.innerText = `TODAY KNEELING: ${gameStats.todayKneeling || 0}`;
    }
}

// --- 5. REWARDS (UPDATED TO CLOSE BOTH POPUPS) ---
export function claimKneelReward(choice) {
    // Hide Desktop
    const deskReward = document.getElementById('kneelRewardOverlay');
    if (deskReward) deskReward.classList.add('hidden');

    // Hide Mobile (FIX ADDED HERE)
    const mobReward = document.getElementById('mobKneelReward');
    if (mobReward) {
        mobReward.classList.add('hidden');
        mobReward.style.display = 'none';
    }

    triggerSound('coinSound');
    triggerCoinShower();

    window.parent.postMessage({
        type: "CLAIM_KNEEL_REWARD",
        rewardType: choice,
        rewardValue: choice === 'coins' ? 10 : 50
    }, "*");

    import('../../js/bridge.js').then(({ Bridge }) => {
        if (userProfile) {
            Bridge.send("SLAVE_REWARD_CLAIMED", {
                memberId: userProfile.memberId,
                choice: choice,
                value: choice === 'coins' ? 10 : 50,
                timestamp: Date.now()
            });
        }
    });
}

function triggerCoinShower() {
    for (let i = 0; i < 40; i++) {
        const coin = document.createElement('div');
        coin.className = 'coin-particle';
        coin.innerHTML = `<svg style="width:100%; height:100%; fill:gold;"><use href="#icon-coin"></use></svg>`;
        coin.style.setProperty('--tx', `${Math.random() * 200 - 100}vw`);
        coin.style.setProperty('--ty', `${-(Math.random() * 80 + 20)}vh`);
        document.body.appendChild(coin);
        setTimeout(() => coin.remove(), 2000);
    }
}

// SELF-REGISTER
window.handleHoldStart = handleHoldStart;
window.handleHoldEnd = handleHoldEnd;
window.claimKneelReward = claimKneelReward;
window.updateKneelingStatus = updateKneelingStatus;
