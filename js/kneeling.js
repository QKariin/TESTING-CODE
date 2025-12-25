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

    // Lock immediately
    const now = Date.now();
    setLastWorshipTime(now); 
    setIsLocked(true); 
    setIgnoreBackendUpdates(true);

    // Update UI immediately
    updateKneelingStatus();

    // Tell backend to start timer
    window.parent.postMessage({ type: "FINISH_KNEELING" }, "*");

    // Show reward popup (optional bonus)
    const rewardMenu = document.getElementById('kneelRewardOverlay');
    if (rewardMenu) rewardMenu.classList.remove('hidden');

    triggerSound('msgSound');
    
    // Release shield after backend sync
    setTimeout(() => { setIgnoreBackendUpdates(false); }, 15000);
}

// --- REWARD SYSTEM (BONUS) ---
export function claimKneelReward(choice) {
    const rewardMenu = document.getElementById('kneelRewardOverlay');
    if (rewardMenu) rewardMenu.classList.add('hidden');

    triggerSound('coinSound');
    
    // Coin shower effect
    triggerCoinShower();

    window.parent.postMessage({ 
        type: "CLAIM_KNEEL_REWARD", 
        rewardType: choice,
        rewardValue: choice === 'coins' ? 10 : 50
    }, "*");
}

// --- STATUS UPDATE LOGIC ---
export function updateKneelingStatus() {
    const now = Date.now();
    
    // Daily ID generation (moved from main.js)
    const d = new Date();
    const seed = d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
    const code = Math.floor((Math.abs(Math.sin(seed)) * 9000)) + 1000;
    if (document.getElementById('dailyRandomId')) document.getElementById('dailyRandomId').innerText = "#" + code;

    const btn = document.getElementById('btn');
    const txtMain = document.getElementById('txt-main');
    const fill = document.getElementById('fill');
    const txtSub = document.getElementById('txt-sub');
    
    if (!btn || !txtMain || !fill) return;

    const diffMs = now - lastWorshipTime;
    const cooldownMs = COOLDOWN_MINUTES * 60 * 1000;

    if (lastWorshipTime > 0 && diffMs < cooldownMs) {
        setIsLocked(true);
        const minLeft = Math.ceil((cooldownMs - diffMs) / 60000);
        txtMain.innerText = `LOCKED: ${minLeft}m`;
        const progress = 100 - ((diffMs / cooldownMs) * 100);
        fill.style.transition = "none"; 
        fill.style.width = Math.max(0, progress) + "%";
        btn.style.cursor = "not-allowed";
    } else if (!holdTimer) {
        setIsLocked(false);
        txtMain.innerText = "KNEEL";
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
