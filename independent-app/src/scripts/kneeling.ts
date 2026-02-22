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

        // 👇 FORCE INJECT STYLES (To ensure no dragging/selecting happens)
        btn.style.touchAction = "none";
        btn.style.userSelect = "none";
        btn.style.webkitUserSelect = "none";
        
        // Force all children (text, fill bar) to be invisible to the mouse
        Array.from(btn.children).forEach((child) => {
            (child as HTMLElement).style.pointerEvents = "none";
        });

        // 👇 USE POINTER EVENTS + CAPTURE (The Bulletproof Fix)
        btn.addEventListener('pointerdown', (e) => {
            // 1. Stop default browser actions (scrolling, text selection)
            e.preventDefault();
            
            // 2. "Capture" the pointer. 
            // This forces the browser to send ALL future events to this button
            // until we release it. This prevents "mouseleave" bugs.
            (btn as HTMLElement).setPointerCapture(e.pointerId);
            
            handleHoldStart(e);
        });

        btn.addEventListener('pointerup', (e) => {
            (btn as HTMLElement).releasePointerCapture(e.pointerId);
            handleHoldEnd(e);
        });
        
        btn.addEventListener('pointercancel', (e) => {
            (btn as HTMLElement).releasePointerCapture(e.pointerId);
            handleHoldEnd(e);
        });
        
        // Stop Right Click Menu
        btn.addEventListener('contextmenu', (e) => e.preventDefault());

        console.log('[KNEEL] Pointer Capture Listeners Attached:', btn.id);
    });

    checkLockStatus();
}

// ─── 2. START HOLD ───
export function handleHoldStart(e: Event) {
    if (isLocked) return;
    if (holdTimer) return; // Prevent double-trigger

    // DESKTOP UI
    const fill = document.getElementById('heroKneelFill');
    const txtMain = document.getElementById('heroKneelText');
    
    // MOBILE UI
    const mobFill = document.getElementById('mob_kneelFill');
    const mobText = document.querySelector('.kneel-label') as HTMLElement;
    const mobBar = document.querySelector('.mob-kneel-zone') as HTMLElement;

    // ANIMATION
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

// ─── 3. END HOLD (CANCEL) ───
export function handleHoldEnd(e: Event) {
    if (isLocked) return;

    if (holdTimer) {
        // Aborted early
        clearTimeout(holdTimer);
        holdTimer = null;

        // RESET UI
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
    if (snd) snd.play().catch(e => console.log("Audio blocked", e));

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
    if (isLocked) updateKneelingUI();
}

export function updateKneelingUI() {
    // If not locked and not holding, do nothing
    if (!isLocked && !holdTimer) return;

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

        // Keep updating only if we are actually locked
        setTimeout(updateKneelingUI, 60000);
    } else {
        // UNLOCK
        isLocked = false;
        resetUI();
    }
}
