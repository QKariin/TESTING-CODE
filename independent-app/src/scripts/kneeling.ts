// src/scripts/kneeling.ts
// Kneeling — Pointer Events API (works on desktop + mobile, not cancelled by scroll)

import { getState, setState } from './profile-state';
import { createClient } from '@/utils/supabase/client';

const REQUIRED_HOLD_MS = 2000;
const COOLDOWN_MS = 60 * 60 * 1000; // 60 min

let holdTimer: ReturnType<typeof setTimeout> | null = null;
let isPointerDown = false;

// ─── PUBLIC: wire up both buttons with passive:false pointer events ────────────
export function attachKneelListeners() {
    const desktopBtn = document.getElementById('heroKneelBtn');
    const mobileBtn = document.getElementById('mobKneelBar');
    [desktopBtn, mobileBtn].forEach(btn => {
        if (!btn) return;
        // Guard: only attach once
        if ((btn as any).__kneelAttached) return;
        (btn as any).__kneelAttached = true;

        // Prevent browser from stealing gesture for scroll/zoom
        btn.style.touchAction = 'none';
        btn.style.userSelect = 'none';
        (btn.style as any).webkitUserSelect = 'none';

        btn.addEventListener('pointerdown', onDown, { passive: false });
        btn.addEventListener('pointerup', onUp, { passive: false });
        btn.addEventListener('pointerleave', onUp, { passive: false });
        btn.addEventListener('pointercancel', onCancel, { passive: false });
        console.log('[kneel] listeners attached to', btn.id);
    });
}

function onDown(e: PointerEvent) {
    e.preventDefault();
    const { isLocked } = getState();
    console.log('[kneel] pointerdown', { isLocked, isPointerDown, hasTimer: !!holdTimer });
    if (isLocked || isPointerDown || holdTimer) return;

    // Capture pointer so further events go to this element even if finger moves off
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { }

    isPointerDown = true;
    setFill(true);  // Start animation

    holdTimer = setTimeout(() => {
        console.log('[kneel] 2s elapsed → completing');
        holdTimer = null;
        isPointerDown = false;
        completeKneel();
    }, REQUIRED_HOLD_MS);
}

function onUp(e: Event) {
    console.log('[kneel] pointerup/leave', { isPointerDown, hasTimer: !!holdTimer });
    if (!isPointerDown) return;
    isPointerDown = false;
    if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
        setFill(false); // Not held long enough
    }
}

function onCancel(e: Event) {
    console.log('[kneel] pointercancel - resetting');
    isPointerDown = false;
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    setFill(false);
}

// ─── Fill bar animation helpers ───────────────────────────────────────────────
function setFill(filling: boolean) {
    const fill = document.getElementById('heroKneelFill');
    const mobFill = document.getElementById('mob_kneelFill');
    const txtMain = document.getElementById('heroKneelText');
    const mobText = document.querySelector('.kneel-label') as HTMLElement | null;
    const mobBar = document.querySelector('.mob-kneel-zone') as HTMLElement | null;

    if (filling) {
        if (fill) { fill.style.transition = `width ${REQUIRED_HOLD_MS}ms linear`; fill.style.width = '100%'; }
        if (mobFill) { mobFill.style.transition = `width ${REQUIRED_HOLD_MS}ms linear`; mobFill.style.width = '100%'; }
        if (txtMain) txtMain.innerText = 'KNEELING...';
        if (mobText) mobText.innerText = 'SUBMITTING...';
        if (mobBar) mobBar.style.borderColor = 'var(--gold, #c5a059)';
    } else {
        if (fill) { fill.style.transition = 'width 0.3s ease'; fill.style.width = '0%'; }
        if (mobFill) { mobFill.style.transition = 'width 0.3s ease'; mobFill.style.width = '0%'; }
        if (txtMain) txtMain.innerText = 'HOLD TO KNEEL';
        if (mobText) mobText.innerText = 'HOLD TO KNEEL';
        if (mobBar) mobBar.style.borderColor = '#c5a059';
    }
}

// ─── Kneel completion ─────────────────────────────────────────────────────────
async function completeKneel() {
    const { lastWorshipTime } = getState();

    // Client-side cooldown guard (server also enforces)
    if (lastWorshipTime > 0 && Date.now() - lastWorshipTime < COOLDOWN_MS) return;

    setState({ isLocked: true, lastWorshipTime: Date.now() });
    updateKneelingUI(); // show LOCKED state immediately

    // Save to DB
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
            await fetch('/api/kneel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memberEmail: user.email }),
            });
        }
    } catch (err) {
        console.warn('[kneel] DB save failed:', err);
    }

    // Sound
    const snd = document.getElementById('msgSound') as HTMLAudioElement | null;
    if (snd) snd.play().catch(() => null);

    // Show reward screen
    showRewardScreen();
}

// ─── Reward Screen ────────────────────────────────────────────────────────────
function showRewardScreen() {
    document.getElementById('_kneelReward')?.remove();

    const overlay = document.createElement('div');
    overlay.id = '_kneelReward';
    overlay.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:99999;
        display:flex;align-items:center;justify-content:center;flex-direction:column;gap:20px;
    `;
    overlay.innerHTML = `
        <div style="font-family:'Orbitron';color:#c5a059;font-size:1.4rem;letter-spacing:4px;text-align:center;">
            ◈ SUBMISSION ACCEPTED ◈
        </div>
        <div style="font-family:'Cinzel';color:rgba(255,255,255,0.5);font-size:0.8rem;letter-spacing:2px;">
            Choose your reward
        </div>
        <div style="display:flex;gap:16px;margin-top:10px;">
            <button id="_rewardMerit" style="padding:14px 28px;background:rgba(197,160,89,0.1);border:1px solid #c5a059;color:#c5a059;font-family:'Orbitron';font-size:0.75rem;letter-spacing:2px;cursor:pointer;border-radius:4px;transition:background 0.2s;">
                +50 MERIT
            </button>
            <button id="_rewardNet" style="padding:14px 28px;background:rgba(0,150,255,0.08);border:1px solid #4af;color:#4af;font-family:'Orbitron';font-size:0.75rem;letter-spacing:2px;cursor:pointer;border-radius:4px;transition:background 0.2s;">
                +10 COINS
            </button>
        </div>
        <div style="font-family:'Cinzel';color:rgba(255,255,255,0.2);font-size:0.6rem;margin-top:6px;">
            Next kneel available in 60 minutes
        </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('_rewardMerit')!.addEventListener('click', () => {
        claimReward('merit');
        overlay.remove();
    });
    document.getElementById('_rewardNet')!.addEventListener('click', () => {
        claimReward('coins');
        overlay.remove();
    });
}

async function claimReward(type: 'merit' | 'coins') {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) return;

        const field = type === 'merit' ? 'score' : 'wallet';
        const delta = type === 'merit' ? 50 : 10;

        // Fetch current value then increment
        const { data: profile } = await supabase
            .from('profiles')
            .select('score, wallet')
            .eq('member_id', user.email)
            .maybeSingle();

        if (profile) {
            const current = type === 'merit' ? (profile.score || 0) : (profile.wallet || 0);
            await fetch('/api/profile-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    memberEmail: user.email,
                    field,
                    value: current + delta,
                    cost: 0,
                }),
            });
        }
    } catch (err) {
        console.warn('[kneel-reward] failed:', err);
    }
}

// ─── UI SYNC (called on page load to restore LOCKED/UNLOCKED state) ───────────
export function updateKneelingUI() {
    const { lastWorshipTime, cooldownMinutes } = getState();
    const now = Date.now();
    const diffMs = now - lastWorshipTime;
    const cooldownMs = (cooldownMinutes || 60) * 60 * 1000;

    const fill = document.getElementById('heroKneelFill');
    const txtMain = document.getElementById('heroKneelText');
    const mobFill = document.getElementById('mob_kneelFill');
    const mobText = document.querySelector('.kneel-label') as HTMLElement | null;
    const mobBar = document.querySelector('.mob-kneel-zone') as HTMLElement | null;

    if (lastWorshipTime > 0 && diffMs < cooldownMs) {
        setState({ isLocked: true });
        const minLeft = Math.ceil((cooldownMs - diffMs) / 60000);
        const progress = 100 - (diffMs / cooldownMs) * 100;

        if (txtMain) txtMain.innerText = `LOCKED: ${minLeft}m`;
        if (fill) { fill.style.transition = 'none'; fill.style.width = `${Math.max(0, progress)}%`; }
        if (mobText) mobText.innerText = `LOCKED: ${minLeft}m`;
        if (mobFill) { mobFill.style.transition = 'none'; mobFill.style.width = `${Math.max(0, progress)}%`; }
        if (mobBar) { mobBar.style.borderColor = '#ff003c'; (mobBar as HTMLElement).style.opacity = '0.7'; }
    } else {
        setState({ isLocked: false });
        if (txtMain) txtMain.innerText = 'HOLD TO KNEEL';
        if (fill) { fill.style.transition = 'width 0.3s ease'; fill.style.width = '0%'; }
        if (mobText) mobText.innerText = 'HOLD TO KNEEL';
        if (mobFill) { mobFill.style.transition = 'width 0.3s ease'; mobFill.style.width = '0%'; }
        if (mobBar) { mobBar.style.borderColor = '#c5a059'; (mobBar as HTMLElement).style.opacity = '1'; }
    }
}

// Legacy exports (still used in page.tsx imports)
export function handleHoldStart() { }
export function handleHoldEnd() { }
