import { createClient } from '@/utils/supabase/client';

// Global State
let holdTimer: ReturnType<typeof setTimeout> | null = null;
const REQUIRED_HOLD_TIME = 2000;
let isLocked = false;
let lastWorshipTime = 0;

const supabase = createClient();

// ─── 1. INITIALIZATION ───
export function attachKneelListeners() {
    const desktopBtn = document.getElementById('heroKneelBtn');
    const mobileBtn = document.getElementById('mobKneelBar'); 

    const buttons = [desktopBtn, mobileBtn];

    buttons.forEach(btn => {
        if (!btn) return;
        if ((btn as any).__kneelAttached) return;
        (btn as any).__kneelAttached = true;

        // Force Drag/Select disabled via JS as a backup to CSS
        btn.ondragstart = () => false;
        
        // MOUSE
        btn.addEventListener('mousedown', (e) => {
            // Stop browser from starting a "text selection" or "drag"
            if (e.cancelable) e.preventDefault();
            handleHoldStart(e);
        });
        btn.addEventListener('mouseup', handleHoldEnd);
        btn.addEventListener('mouseleave', handleHoldEnd);

        // TOUCH
        btn.addEventListener('touchstart', (e) => {
            if (e.cancelable) e.preventDefault();
            handleHoldStart(e);
        }, { passive: false });
        btn.addEventListener('touchend', handleHoldEnd);
        btn.addEventListener('touchcancel', handleHoldEnd);

        // CONTEXT MENU (Right Click)
        btn.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });

        console.log('[KNEEL] Listeners attached:', btn.id);
    });

    checkLockStatus();
}

// ─── 2. START ───
export function handleHoldStart(e: Event) {
    if (isLocked) return;
    
    // If timer is already running, ignore this event (prevents double-firing)
    if (holdTimer) return;

    // DESKTOP UI
    const fill = document.getElementById('heroKneelFill');
    const txtMain = document.getElementById('heroKneelText');
    
    // MOBILE UI
    const mobFill = document.getElementById('mob_kneelFill');
    const mobText = document.querySelector('.kneel-label') as HTMLElement;
    const mobBar = document.querySelector('.mob-kneel-zone') as HTMLElement;

    // ANIMATE
    if (fill) {
        fill.style.transition = `width ${REQUIRED_HOLD_TIME}ms linear`;
        fill.style.width = "100%";
    }
    if (txtMain) txtMain.innerText = "KNEELING...";

    if (mobFill) {
        mobFill.style.transition = `width ${REQUIRED_HOLD_TIME}ms linear`;
        mobFill.style.width = "100%";
    }
    if (mobText) mobText.innerText = "SUBMITTING...";
    if (mobBar) mobBar.style.borderColor = "#ffffff"; 

    // START TIMER
    holdTimer = setTimeout(() => {
        completeKneelAction();
    }, REQUIRED_HOLD_TIME);
}

// ─── 3. END (CANCEL) ───
export function handleHoldEnd(e: Event) {
    if (isLocked) return;

    if (holdTimer) {
        // User let go too early
        clearTimeout(holdTimer);
        holdTimer = null;

        // RESET UI INSTANTLY
        resetUI();
    }
}

function resetUI() {
    const fill = document.getElementById('heroKneelFill');
    const txtMain = document.getElementById('heroKneelText');
    const mobFill = document.getElementById('mob_kneelFill');
    const mobText = document.querySelector('.kneel-label') as HTMLElement;
    const mobBar = document.querySelector('.mob-kneel-zone') as HTMLElement;

    if (fill) {
        fill.style.transition = "width 0.2s ease";
        fill.style.width = "0%";
    }
    if (txtMain) txtMain.innerText = "HOLD TO KNEEL";

    if (mobFill) {
        mobFill.style.transition = "width 0.2s ease";
        mobFill.style.width = "0%";
    }
    if (mobText) mobText.innerText = "HOLD TO KNEEL";
    if (mobBar) mobBar.style.borderColor = "#c5a059";
}

// ─── 4. SUCCESS ───
async function completeKneelAction() {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    
    // LOCK LOCAL
    lastWorshipTime = Date.now();
    isLocked = true;

    // SOUND
    const snd = document.getElementById('msgSound') as HTMLAudioElement;
    if (snd) snd.play().catch(e => console.log(e));

    // REWARDS
    const deskReward = document.getElementById('kneelRewardOverlay');
    const mobReward = document.getElementById('mobKneelReward');
    if (deskReward) { deskReward.classList.remove('hidden'); deskReward.style.display = 'flex'; }
    if (mobReward) { mobReward.classList.remove('hidden'); mobReward.style.display = 'flex'; }

    // DATABASE SAVE
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
            await fetch('/api/kneel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memberEmail: user.email }),
            });
        }
    } catch (err) { console.error(err); }

    updateKneelingUI();
}

// ─── 5. UI SYNC ───
export function checkLockStatus() {
    // If needed, check DB time here. For now, we trust local session.
    if (isLocked) updateKneelingUI();
}

export function updateKneelingUI() {
    // If not locked and not holding, keep UI reset
    if (!isLocked && !holdTimer) {
        return;
    }

    const COOLDOWN_MINUTES = 60;
    const now = Date.now();
    const diffMs = now - lastWorshipTime;
    const cooldownMs = COOLDOWN_MINUTES * 60 * 1000;

    if (diffMs < cooldownMs) {
        // STILL LOCKED
        const minLeft = Math.ceil((cooldownMs - diffMs) / 60000);
        const progress = 100 - ((diffMs / cooldownMs) * 100);

        const txtMain = document.getElementById('heroKneelText');
        const fill = document.getElementById('heroKneelFill');
        const mobText = document.querySelector('.kneel-label') as HTMLElement;
        const mobFill = document.getElementById('mob_kneelFill');
        const mobBar = document.querySelector('.mob-kneel-zone') as HTMLElement;

        if (txtMain) txtMain.innerText = `LOCKED: ${minLeft}m`;
        if (fill) { fill.style.transition = "none"; fill.style.width = `${Math.max(0, progress)}%`; }

        if (mobText) mobText.innerText = `LOCKED: ${minLeft}m`;
        if (mobFill) { mobFill.style.transition = "none"; mobFill.style.width = `${Math.max(0, progress)}%`; }
        if (mobBar) { mobBar.style.borderColor = "#ff003c"; }

        setTimeout(updateKneelingUI, 60000);
    } else {
        // UNLOCK
        isLocked = false;
        resetUI();
    }
}
