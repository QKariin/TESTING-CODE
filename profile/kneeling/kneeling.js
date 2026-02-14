// kneeling.js - FINAL TWIN SYNC (FIXED IDS)

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
    
    // Safety check for event
    if (e && e.cancelable && e.type !== 'touchstart') {
        e.preventDefault();
        e.stopPropagation();
    }

    // --- TARGETS (UPDATED TO MATCH HTML) ---
    // Desktop Targets
    const deskFill = document.getElementById('heroKneelFill'); // WAS 'fill'
    const deskText = document.getElementById('heroKneelText'); // WAS 'txt-main'
    
    // Mobile Targets
    const mobFill = document.getElementById('mob_kneelFill');
    const mobText = document.getElementById('mob_kneelText'); 
    const mobBar = document.querySelector('.mob-kneel-zone');

    // --- ANIMATE DESKTOP ---
    if (deskFill) {
        deskFill.style.transition = "width 2s linear"; 
        deskFill.style.width = "100%";
    }
    if (deskText) deskText.innerText = "KNEELING...";

    // --- ANIMATE MOBILE ---
    if (mobFill) {
        mobFill.style.transition = "width 2s linear";
        mobFill.style.width = "100%";
    }
    if (mobText) mobText.innerText = "SUBMITTING...";
    if (mobBar) mobBar.style.borderColor = "#c5a059"; 

    // START TIMER
    holdTimer = setTimeout(() => {
        completeKneelAction();
    }, REQUIRED_HOLD_TIME);
}

// --- 2. HOLD END ---
export function handleHoldEnd(e) {
    if(e && e.type !== 'touchend') e.preventDefault();

    if (isLocked) {
        if (holdTimer) clearTimeout(holdTimer);
        holdTimer = null;
        return; 
    }

    if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
        
        // --- RESET DESKTOP ---
        const deskFill = document.getElementById('heroKneelFill');
        const deskText = document.getElementById('heroKneelText');
        
        if (deskFill) {
            deskFill.style.transition = "width 0.3s ease"; 
            deskFill.style.width = "0%";
        }
        if (deskText) deskText.innerText = "HOLD TO KNEEL";

        // --- RESET MOBILE ---
        const mobFill = document.getElementById('mob_kneelFill');
        const mobText = document.getElementById('mob_kneelText');
        const mobBar = document.querySelector('.mob-kneel-zone');

        if (mobFill) {
            mobFill.style.transition = "width 0.3s ease";
            mobFill.style.width = "0%";
        }
        if (mobText) mobText.innerText = "HOLD TO KNEEL";
        if (mobBar) mobBar.style.borderColor = "#c5a059"; 
    }
}

// --- 3. COMPLETION ---
function completeKneelAction() {
    if (holdTimer) clearTimeout(holdTimer);
    holdTimer = null; 

    const now = Date.now();
    setLastWorshipTime(now); 
    setIsLocked(true); 
    setIgnoreBackendUpdates(true);

    window.parent.postMessage({ type: "FINISH_KNEELING" }, "*");

    // Trigger visual updates immediately
    updateKneelingStatus(); 

    // --- SHOW REWARDS ---
    
    // 1. Desktop Reward Overlay
    const deskReward = document.getElementById('kneelRewardOverlay');
    if (deskReward) {
        deskReward.classList.remove('hidden');
        deskReward.style.display = 'flex';
    }

    // 2. Mobile Reward Overlay
    const mobReward = document.getElementById('mobKneelReward');
    if (mobReward) {
        mobReward.classList.remove('hidden');
        mobReward.style.display = 'flex';
    }

    triggerSound('msgSound');
    setTimeout(() => { setIgnoreBackendUpdates(false); }, 15000);
}

// --- 4. STATUS SYNC (UPDATED) ---
export function updateKneelingStatus() {
    const now = Date.now();
    
    // Desktop Targets
    const deskFill = document.getElementById('heroKneelFill');
    const deskText = document.getElementById('heroKneelText');
    const deskBtn = document.getElementById('heroKneelBtn');
    
    // Mobile Targets
    const mobFill = document.getElementById('mob_kneelFill');
    const mobText = document.getElementById('mob_kneelText');
    const mobBar = document.querySelector('.mob-kneel-zone');

    const diffMs = now - lastWorshipTime;
    const cooldownMs = COOLDOWN_MINUTES * 60 * 1000;

    // A. LOCKED STATE (Cooldown Active)
    if (lastWorshipTime > 0 && diffMs < cooldownMs) {
        setIsLocked(true);
        const minLeft = Math.ceil((cooldownMs - diffMs) / 60000);
        
        // Update Desktop
        if (deskText && deskFill) {
            deskText.innerText = `LOCKED: ${minLeft}m`;
            const progress = 100 - ((diffMs / cooldownMs) * 100);
            deskFill.style.transition = "none";
            deskFill.style.width = Math.max(0, progress) + "%";
            if(deskBtn) deskBtn.style.cursor = "not-allowed";
        }

        // Update Mobile
        if (mobText && mobFill) {
            mobText.innerText = `LOCKED: ${minLeft}m`;
            const progress = 100 - ((diffMs / cooldownMs) * 100);
            mobFill.style.transition = "none";
            mobFill.style.width = Math.max(0, progress) + "%";
            
            if(mobBar) {
                mobBar.style.borderColor = "#ff003c"; 
                mobBar.style.opacity = "0.7";
            }
        }
    } 
    // B. UNLOCKED STATE (Ready)
    else if (!holdTimer) { 
        setIsLocked(false);
        
        // Update Desktop
        if (deskText && deskFill) {
            deskText.innerText = "HOLD TO KNEEL";
            deskFill.style.transition = "width 0.3s ease";
            deskFill.style.width = "0%";
            if(deskBtn) deskBtn.style.cursor = "pointer";
        }

        // Update Mobile
        if (mobText && mobFill) {
            mobText.innerText = "HOLD TO KNEEL";
            mobFill.style.transition = "width 0.3s ease";
            mobFill.style.width = "0%";
            if(mobBar) {
                mobBar.style.borderColor = "#c5a059"; 
                mobBar.style.opacity = "0.7";
            }
        }
    }
}

// --- 5. REWARDS ---
export function claimKneelReward(choice) {
    // Hide Desktop
    const deskReward = document.getElementById('kneelRewardOverlay');
    if (deskReward) deskReward.classList.add('hidden');

    // Hide Mobile
    const mobReward = document.getElementById('mobKneelReward');
    if (mobReward) {
        mobReward.classList.add('hidden');
        mobReward.style.display = 'none';
    }

    triggerSound('coinSound');
    triggerCoinShower();

    // Send to Backend
    window.parent.postMessage({ 
        type: "CLAIM_KNEEL_REWARD", 
        rewardType: choice,
        rewardValue: choice === 'coins' ? 10 : 50
    }, "*");
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

// SELF-REGISTER GLOBAL FUNCTIONS
window.handleHoldStart = handleHoldStart;
window.handleHoldEnd = handleHoldEnd;
window.claimKneelReward = claimKneelReward;
window.updateKneelingStatus = updateKneelingStatus;
