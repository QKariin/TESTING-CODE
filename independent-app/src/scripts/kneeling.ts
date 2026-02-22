// src/scripts/kneeling.ts
import { createClient } from '@/utils/supabase/client';

// Global variables
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

        // 👇 THE FIX: Force inner elements to be "ghosts"
        // This stops the "mouseleave" bug when the bar fills up under your cursor
        Array.from(btn.children).forEach((child) => {
            (child as HTMLElement).style.pointerEvents = 'none';
        });

        // Use POINTER events (handles both Mouse + Touch better)
        btn.addEventListener('pointerdown', (e) => {
            // "Capture" the pointer so even if you wiggle outside, it holds
            (btn as HTMLElement).setPointerCapture(e.pointerId);
            handleHoldStart(e);
        });

        btn.addEventListener('pointerup', (e) => {
            (btn as HTMLElement).releasePointerCapture(e.pointerId);
            handleHoldEnd(e);
        });
        
        // We still need leave/cancel just in case
        btn.addEventListener('pointerleave', handleHoldEnd);
        btn.addEventListener('pointercancel', handleHoldEnd);
        
        // Disable context menu (right click)
        btn.addEventListener('contextmenu', (e) => e.preventDefault());

        console.log('[KNEEL] Listeners attached with Pointer Events:', btn.id);
    });

    checkLockStatus();
}

// ─── 2. HOLD START ───
export function handleHoldStart(e: Event) {
    if (isLocked) return;
    if (e.cancelable) e.preventDefault(); // Stop text selection

    if (holdTimer) return; // Don't restart if already running

    console.log('[KNEEL] Hold Started...');

    // UI ELEMENTS
    const fill = document.getElementById('heroKneelFill');
    const txtMain = document.getElementById('heroKneelText');
    const mobFill = document.getElementById('mob_kneelFill');
    const mobText = document.querySelector('.kneel-label') as HTMLElement;
    const mobBar = document.querySelector('.mob-kneel-zone') as HTMLElement;

    // ANIMATE (2 seconds)
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

// ─── 3. HOLD END (Abort) ───
export function handleHoldEnd(e: Event) {
    if (isLocked) return;
    if (e.cancelable) e.preventDefault();

    if (holdTimer) {
        console.log('[KNEEL] Aborted.');
        clearTimeout(holdTimer);
        holdTimer = null;

        // RESET UI
        const fill = document.getElementById('heroKneelFill');
        const txtMain = document.getElementById('heroKneelText');
        const mobFill = document.getElementById('mob_kneelFill');
        const mobText = document.querySelector('.kneel-label') as HTMLElement;
        const mobBar = document.querySelector('.mob-kneel-zone') as HTMLElement;

        if (fill) {
            fill.style.transition = "width 0.2s ease"; // Fast reset
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
}

// ─── 4. COMPLETE (Success) ───
async function completeKneelAction() {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    console.log('[KNEEL] SUCCESS!');
    
    // 1. Lock Locally
    const now = Date.now();
    lastWorshipTime = now;
    isLocked = true;

    // 2. Sound
    const snd = document.getElementById('msgSound') as HTMLAudioElement;
    if (snd) snd.play().catch(err => console.log(err));

    // 3. Show Rewards
    const deskReward = document.getElementById('kneelRewardOverlay');
    const mobReward = document.getElementById('mobKneelReward');
    
    if (deskReward) {
        deskReward.classList.remove('hidden');
        deskReward.style.display = 'flex';
    }
    if (mobReward) {
        mobReward.classList.remove('hidden');
        mobReward.style.display = 'flex';
    }

    // 4. Save to DB
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
    if (!isLocked && !holdTimer) {
        // Only force reset if we are truly unlocked and idle
        // (Removing the aggressive reset here prevents flickering)
        return;
    }

    const COOLDOWN_MINUTES = 60;
    const now = Date.now();
    const diffMs = now - lastWorshipTime;
    const cooldownMs = COOLDOWN_MINUTES * 60 * 1000;

    if (diffMs < cooldownMs) {
        const minLeft = Math.ceil((cooldownMs - diffMs) / 60000);
        const progress = 100 - ((diffMs / cooldownMs) * 100);

        const txtMain = document.getElementById('heroKneelText');
        const fill = document.getElementById('heroKneelFill');
        
        if (txtMain) txtMain.innerText = `LOCKED: ${minLeft}m`;
        if (fill) {
            fill.style.transition = "none";
            fill.style.width = `${Math.max(0, progress)}%`;
        }

        setTimeout(updateKneelingUI, 60000);
    } else {
        isLocked = false;
        // Manual reset visual
        const fill = document.getElementById('heroKneelFill');
        const txtMain = document.getElementById('heroKneelText');
        if (fill) { fill.style.width = "0%"; fill.style.transition = "width 0.3s ease"; }
        if (txtMain) txtMain.innerText = "HOLD TO KNEEL";
    }
}
