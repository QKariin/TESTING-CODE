// Kneeling system - dedicated module for devotion mechanics
import { 
    isLocked, lastWorshipTime, COOLDOWN_MINUTES, gameStats, ignoreBackendUpdates
} from './state.js';
import { 
    setIsLocked, setLastWorshipTime, setIgnoreBackendUpdates 
} from './state.js';
import { triggerSound } from './utils.js';

// Hold timer for the progress bar
let holdTimer = null;
const REQUIRED_HOLD_TIME = 2000;

// --- HOLD TO KNEEL MECHANICS ---
export function handleHoldStart(e) {
    if (isLocked) return;
    
    // Stop mobile text selection
    if (e && e.type === 'touchstart' && e.cancelable) {
        e.preventDefault();
    }

    const fill = document.getElementById('fill');
    const txtMain = document.getElementById('txt-main');
    
    if (fill) {
        fill.style.transition = "width 2s linear"; 
        fill.style.width = "100%";
    }
    if (txtMain) txtMain.innerText = "KNEELING...";

    holdTimer = setTimeout(() => {
        completeKneelAction();
    }, REQUIRED_HOLD_TIME);
}

export function handleHoldEnd() {
    // If already locked, don't reset UI
    if (isLocked) {
        if (holdTimer) clearTimeout(holdTimer);
        holdTimer = null;
        return; 
    }

    if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
        const fill = document.getElementById('fill');
        const txtMain = document.getElementById('txt-main');
        if (fill) {
            fill.style.transition = "width 0.3s ease"; 
            fill.style.width = "0%";
        }
        if (txtMain) txtMain.innerText = "KNEEL";
    }
}

// --- CORE KNEELING COMPLETION ---
function completeKneelAction() {
    if (holdTimer) clearTimeout(holdTimer);
    holdTimer = null; 

    // 1. START THE LOCKDOWN IMMEDIATELY
    const now = Date.now();
    setLastWorshipTime(now); // Save the current time as the start of the 60m
    setIsLocked(true); 
    setIgnoreBackendUpdates(true);

    // 2. TELL WIX THE ACTION IS DONE (Permanent Save)
    window.parent.postMessage({ type: "FINISH_KNEELING" }, "*");

    // 3. UPDATE THE BAR (Change it to "LOCKED: 60m" right now)
    updateKneelingStatus();

    // 4. SHOW THE REWARD POPUP (Over the chat, as requested)
    const rewardMenu = document.getElementById('kneelRewardOverlay');
    if (rewardMenu) {
        rewardMenu.classList.remove('hidden');
    }

    triggerSound('msgSound');
    
    // Release the update shield after 15 seconds
    setTimeout(() => { setIgnoreBackendUpdates(false); }, 15000);
}

// --- REWARD SYSTEM (BONUS) ---
export function claimKneelReward(choice) {
    const rewardMenu = document.getElementById('kneelRewardOverlay');
    if (rewardMenu) rewardMenu.classList.add('hidden');

    triggerSound('coinSound');
    triggerCoinShower();

    // 1. Tell Wix (Permanent Database Save)
    window.parent.postMessage({ 
        type: "CLAIM_KNEEL_REWARD", 
        rewardType: choice,
        rewardValue: choice === 'coins' ? 10 : 50
    }, "*");

    // 2. THE BRIDGE SHOUT: Tell the Queen's Dashboard instantly
    import('./bridge.js').then(({ Bridge }) => {
        Bridge.send("SLAVE_REWARD_CLAIMED", {
            memberId: userProfile.memberId,
            choice: choice,
            value: choice === 'coins' ? 10 : 50,
            timestamp: Date.now()
        });
    });
}


// --- STATUS UPDATE LOGIC ---
export function updateKneelingStatus() {
    const now = Date.now();
    
    // --- SYNCED SHADOW MATH ID ---
    const today = new Date();
    const m = today.getMonth() + 1; 
    const day = today.getDate();
    const dayCode = ((110 - m) * 100 + (82 - day)).toString().padStart(4, '0');
    
    if (document.getElementById('dailyRandomId')) {
        document.getElementById('dailyRandomId').innerText = "#" + dayCode;
    }

    const btn = document.getElementById('btn');
    const txtMain = document.getElementById('txt-main');
    const fill = document.getElementById('fill');
    const txtSub = document.getElementById('txt-sub');
    
    if (!btn || !txtMain || !fill) return;

    const diffMs = now - lastWorshipTime;
    const cooldownMs = COOLDOWN_MINUTES * 60 * 1000;

    // 1. Check if we are in the COOLDOWN period
    if (lastWorshipTime > 0 && diffMs < cooldownMs) {
        setIsLocked(true);
        const minLeft = Math.ceil((cooldownMs - diffMs) / 60000);
        txtMain.innerText = `LOCKED: ${minLeft}m`;
        const progress = 100 - ((diffMs / cooldownMs) * 100);
        fill.style.transition = "none"; // No transition while locked
        fill.style.width = Math.max(0, progress) + "%";
        btn.style.cursor = "not-allowed";
    } 
    // 2. ONLY reset the UI if the user is NOT currently holding the button
    else if (!holdTimer) { 
        setIsLocked(false);
        txtMain.innerText = "KNEEL";
        fill.style.transition = "width 0.3s ease"; // Smooth reset
        fill.style.width = "0%";
        btn.style.cursor = "pointer";
    }

    if (txtSub) {
        txtSub.innerText = `TODAY KNEELING: ${gameStats.todayKneeling || 0}`;
    }
}

// --- COIN SHOWER EFFECT ---
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
