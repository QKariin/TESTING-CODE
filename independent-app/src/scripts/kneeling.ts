// src/scripts/kneeling.ts
import { createClient } from '@/utils/supabase/client';

// Global variables to track state outside of React render cycle
let holdTimer: ReturnType<typeof setTimeout> | null = null;
const REQUIRED_HOLD_TIME = 2000;
let isLocked = false;
let lastWorshipTime = 0;

// Initialize Supabase Client
const supabase = createClient();

// ─── 1. INITIALIZATION (Call this from your Page's useEffect) ───
export function attachKneelListeners() {
    const desktopBtn = document.getElementById('heroKneelBtn');
    const mobileBtn = document.getElementById('mobKneelBar'); 

    const buttons = [desktopBtn, mobileBtn];

    buttons.forEach(btn => {
        if (!btn) return;
        
        // Prevent double attachment
        if ((btn as any).__kneelAttached) return;
        (btn as any).__kneelAttached = true;

        // 👇👇👇 THE FIX FOR THE 0.5s FREEZE 👇👇👇
        // 1. Disable Text Selection (Browser won't try to highlight "HOLD TO KNEEL")
        btn.style.userSelect = 'none';
        btn.style.webkitUserSelect = 'none'; 
        
        // 2. Disable Image Dragging (Browser won't try to drag the button ghost)
        btn.ondragstart = (e) => { e.preventDefault(); return false; };
        // 👆👆👆 END FIX 👆👆👆

        // Mouse Events
        btn.addEventListener('mousedown', (e) => {
             // Stop the browser from doing anything else (like selecting text)
             if (e.cancelable) e.preventDefault();
             handleHoldStart(e);
        });
        btn.addEventListener('mouseup', handleHoldEnd);
        btn.addEventListener('mouseleave', handleHoldEnd);

        // Touch Events
        btn.addEventListener('touchstart', (e) => {
            // Stop scrolling while kneeling
            if (e.cancelable) e.preventDefault();
            handleHoldStart(e);
        }, { passive: false });
        
        btn.addEventListener('touchend', handleHoldEnd);
        btn.addEventListener('touchcancel', handleHoldEnd);

        // Stop Context Menu (Right click / Long press menu)
        btn.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });
        
        console.log('[KNEEL SYSTEM] Listeners attached & hardened:', btn.id);
    });

    checkLockStatus();
}


// ─── 2. HOLD START ───
export function handleHoldStart(e: Event) {
    if (isLocked) return;

    // Prevent scrolling/zooming while holding
    if (e.cancelable && e.type === 'touchstart') {
        e.preventDefault(); 
    }

    console.log('[KNEEL] Hold Started...');

    // DESKTOP UI
    const fill = document.getElementById('heroKneelFill');
    const txtMain = document.getElementById('heroKneelText');
    
    // MOBILE UI
    const mobFill = document.getElementById('mob_kneelFill');
    const mobText = document.querySelector('.kneel-label') as HTMLElement;
    const mobBar = document.querySelector('.mob-kneel-zone') as HTMLElement;

    // ANIMATION: Fill takes 2 seconds (matches REQUIRED_HOLD_TIME)
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
    if (mobBar) mobBar.style.borderColor = "#ffffff"; // Bright white/gold interaction

    // Start the Timer
    holdTimer = setTimeout(() => {
        completeKneelAction();
    }, REQUIRED_HOLD_TIME);
}

// ─── 3. HOLD END (Abort) ───
export function handleHoldEnd(e: Event) {
    // If we are locked, do nothing (timer is already gone)
    if (isLocked) return;

    // If timer exists, it means they let go too early
    if (holdTimer) {
        console.log('[KNEEL] Action Aborted');
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

    // Desktop Reset
    if (fill) {
        fill.style.transition = "width 0.3s ease"; // Quick snap back
        fill.style.width = "0%";
    }
    if (txtMain) txtMain.innerText = "HOLD TO KNEEL";

    // Mobile Reset
    if (mobFill) {
        mobFill.style.transition = "width 0.3s ease";
        mobFill.style.width = "0%";
    }
    if (mobText) mobText.innerText = "HOLD TO KNEEL";
    if (mobBar) mobBar.style.borderColor = "#c5a059";
}

// ─── 4. ACTION COMPLETE (Success) ───
async function completeKneelAction() {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }

    console.log('[KNEEL] SUCCESS!');
    
    // 1. Lock State Immediately
    const now = Date.now();
    lastWorshipTime = now;
    isLocked = true;

    // 2. Play Sound
    const snd = document.getElementById('msgSound') as HTMLAudioElement;
    if (snd) snd.play().catch(err => console.log('Audio blocked', err));

    // 3. Show Rewards (Both Desktop and Mobile)
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

    // 4. Save to Database (Supabase)
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            // Update profile stats directly
            // Adjust table/columns if your DB schema is different
            await supabase.rpc('increment_kneeling_stats', { user_id: user.id });
            console.log('[KNEEL] DB Updated');
        }
    } catch (err) {
        console.error('[KNEEL] Save Error:', err);
    }

    // 5. Start the cooldown UI loop
    updateKneelingUI();
}

// ─── 5. UI SYNC & LOCK CHECK ───
// Call this periodically or on load
export function checkLockStatus() {
    // You can fetch the real lastWorshipTime from DB here if needed
    // For now, we assume local session state or rely on page load props
    if (isLocked) {
        updateKneelingUI();
    }
}

export function updateKneelingUI() {
    // If not locked, ensure UI is reset
    if (!isLocked && !holdTimer) {
        resetUI();
        return;
    }

    // If Locked, calculate time left
    const COOLDOWN_MINUTES = 60; // Set your cooldown here
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
        if (fill) {
            fill.style.transition = "none"; // No animation for status bar
            fill.style.width = `${Math.max(0, progress)}%`;
        }

        if (mobText) mobText.innerText = `LOCKED: ${minLeft}m`;
        if (mobFill) {
            mobFill.style.transition = "none";
            mobFill.style.width = `${Math.max(0, progress)}%`;
        }
        if (mobBar) {
            mobBar.style.borderColor = "#ff003c"; // Red for locked
            mobBar.style.opacity = "0.7";
        }

        // Keep updating every minute
        setTimeout(updateKneelingUI, 60000);
    } else {
        // UNLOCK
        isLocked = false;
        resetUI();
    }
}
