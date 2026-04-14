import { getState, setState } from '@/scripts/profile-state';

let holdTimer: ReturnType<typeof setTimeout> | null = null;
const REQUIRED_HOLD_TIME = 2000;

// ─── 0. SERVER SYNC (RLS-safe via admin client) ───
async function syncKneelStatusFromServer() {
    const { memberId, id } = getState();
    const userId = memberId || id;
    if (!userId) return;

    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const res = await fetch('/api/kneel-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId: userId, tz }) });
        if (!res.ok) return;
        const data = await res.json();

        // ── Update lock state ──
        if (data.lastWorshipMs) {
            setState({
                lastWorshipTime: data.lastWorshipMs,
                isLocked: data.isLocked,
            });
            console.log(`[KNEEL] Server sync: isLocked=${data.isLocked}, minLeft=${data.minLeft}m, todayKneeling=${data.todayKneeling}`);
            updateKneelingUI();
        }

        // ── Update Kneeling Hours bars + dot grid ──
        updateKneelingHoursUI(data.todayKneeling || 0);
        renderKneelDots(data.kneelHours || []);

    } catch (err) {
        console.warn('[KNEEL] Server sync failed:', err);
    }
}

// ─── Kneel Hour Dot Grid ───────────────────────────────────────────────────
export function renderKneelDots(kneelHours: number[]) {
    const currentHour = new Date().getHours();
    const hoursSet = new Set(kneelHours);
    let html = '';
    for (let h = 0; h < 24; h++) {
        const has = hoursSet.has(h);
        const past = h < currentHour;
        let cls = 'kdot';
        if (has) cls += ' kdot-lit';
        else if (past) cls += ' kdot-dim';
        else cls += ' kdot-off';
        html += `<div class="${cls}" title="${h}:00"></div>`;
    }
    const haloEl = document.getElementById('mob_kneelDots');
    if (haloEl) haloEl.innerHTML = html;
    const queenEl = document.getElementById('queen_kneelDots');
    if (queenEl) queenEl.innerHTML = html;
}

// ─── Kneeling Hours UI (called on load + after each reward claimed) ───────
export function updateKneelingHoursUI(todayCount: number) {
    const GOAL = 8;
    const MAX = 24;
    const isOverGoal = todayCount >= GOAL;

    // x/8 below goal, x/24 above goal
    const display = isOverGoal ? `${todayCount} / ${MAX}` : `${todayCount} / ${GOAL}`;
    const pct = isOverGoal
        ? Math.min((todayCount / MAX) * 100, 100)
        : Math.min((todayCount / GOAL) * 100, 100);

    const goldFill = 'linear-gradient(90deg, #c5a059, #f0d080)';
    const goldSolid = '#c5a059';

    // Desktop bar
    const deskFill = document.getElementById('deskKneelDailyFill');
    const deskText = document.getElementById('deskKneelDailyText');
    const deskCard = document.getElementById('gridStat1');
    if (deskFill) {
        deskFill.style.width = `${pct}%`;
        deskFill.style.background = isOverGoal ? goldFill : goldSolid;
    }
    if (deskText) deskText.textContent = display;
    if (deskCard && isOverGoal) {
        deskCard.style.background = 'linear-gradient(135deg, rgba(197,160,89,0.15) 0%, rgba(197,160,89,0.05) 100%)';
        deskCard.style.borderColor = 'rgba(197,160,89,0.5)';
        deskCard.style.boxShadow = '0 0 20px rgba(197,160,89,0.2)';
    }

    // Mobile bar
    const mobFill = document.getElementById('kneelDailyFill');
    const mobText = document.getElementById('kneelDailyText');
    if (mobFill) {
        mobFill.style.width = `${pct}%`;
        mobFill.style.background = isOverGoal ? goldFill : goldSolid;
    }
    if (mobText) mobText.textContent = display;
}


// ─── 1. INITIALIZATION ───
export function attachKneelListeners() {
    const desktopBtn = document.getElementById('heroKneelBtn');
    const mobileBtn = document.getElementById('mobKneelBar');

    const buttons = [desktopBtn, mobileBtn];

    buttons.forEach(btn => {
        if (!btn) return;
        if ((btn as any).__kneelAttached) return;
        (btn as any).__kneelAttached = true;

        // 1. FORCE CSS to kill selection/drag
        btn.style.touchAction = "none";
        btn.style.userSelect = "none";
        btn.style.webkitUserSelect = "none";
        (btn.style as any).webkitTouchCallout = "none"; // iOS long-press callout
        btn.ondragstart = () => false; // Old school block

        // 2. FORCE INNER ELEMENTS TO BE GHOSTS (recursive - covers text spans too)
        btn.querySelectorAll('*').forEach((child) => {
            const el = child as HTMLElement;
            el.style.pointerEvents = "none";
            el.style.userSelect = "none";
            el.style.webkitUserSelect = "none";
            (el.style as any).webkitTouchCallout = "none";
        });
        const fill = document.getElementById('heroKneelFill');
        if (fill) fill.style.pointerEvents = "none"; // Double check specific ID

        // 3. POINTER EVENTS (The Modern Fix)
        btn.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return; // Only Left Click
            e.preventDefault();
            (btn as HTMLElement).setPointerCapture(e.pointerId);
            handleHoldStart(e);
        });

        btn.addEventListener('pointerup', (e) => {
            (btn as HTMLElement).releasePointerCapture(e.pointerId);
            handleHoldEnd(e, 'pointerup');
        });

        btn.addEventListener('pointercancel', (e) => {
            (btn as HTMLElement).releasePointerCapture(e.pointerId);
            handleHoldEnd(e, 'pointercancel');
        });

        // 4. FALLBACK: WINDOW LISTENER
        // If the pointer capture fails for any reason, this catches the mouse release anywhere
        window.addEventListener('mouseup', () => {
            if (holdTimer) handleHoldEnd(null, 'global_mouseup');
        });

        // Block Context Menu
        btn.addEventListener('contextmenu', (e) => e.preventDefault());

        // iOS Safari: drive hold via touchstart/touchend - prevents context menu
        // and is more reliable than pointer events on iOS.
        // passive:false is required to allow preventDefault().
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handleHoldStart(e);
        }, { passive: false });

        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleHoldEnd(e, 'touchend');
        }, { passive: false });

        btn.addEventListener('touchcancel', (e) => {
            handleHoldEnd(e, 'touchcancel');
        }, { passive: false });

        // Block selectstart
        btn.addEventListener('selectstart', (e) => e.preventDefault());

        console.log('[KNEEL] Connected to State & DOM:', btn.id);
    });

    // Sync UI with initial in-memory state first
    updateKneelingUI();

    // Then fetch real server state (bypasses RLS) and update
    syncKneelStatusFromServer();
}

// ─── 2. START HOLD ───
export function handleHoldStart(e: Event) {
    // 👇 CHECK GLOBAL STATE
    const { isLocked } = getState();
    if (isLocked) {
        console.log('[KNEEL] Locked. Ignoring click.');
        return;
    }

    if (holdTimer) return; // Already running

    console.log('[KNEEL] Started...');

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
    if (mobBar) {
        mobBar.style.borderColor = "rgba(197,160,89,0.95)";
        mobBar.style.boxShadow = "inset 0 1px 0 rgba(255,248,210,0.22), inset 0 -4px 14px rgba(0,0,0,0.65), 0 0 22px rgba(197,160,89,0.28), 0 6px 24px rgba(0,0,0,0.72)";
    }

    // START TIMER
    holdTimer = setTimeout(() => {
        completeKneelAction();
    }, REQUIRED_HOLD_TIME);
}

// ─── 3. END HOLD ───
export function handleHoldEnd(e: Event | null, reason: string = 'unknown') {
    const { isLocked } = getState();
    if (isLocked) return;

    if (holdTimer) {
        console.log(`[KNEEL] Aborted by: ${reason}`); // 👈 CHECK CONSOLE IF IT FAILS
        clearTimeout(holdTimer);
        holdTimer = null;
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
    if (mobBar) {
        mobBar.style.borderColor = "rgba(197,160,89,0.88)";
        mobBar.style.boxShadow = "inset 0 1px 0 rgba(255,248,210,0.18), inset 0 -4px 14px rgba(0,0,0,0.65), 0 0 16px rgba(197,160,89,0.14), 0 6px 24px rgba(0,0,0,0.72)";
    }
}

// ─── 4. COMPLETE ───
async function completeKneelAction() {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    console.log('[KNEEL] SUCCESS!');

    // Lock UI immediately so user can't double-kneel
    setState({
        isLocked: true,
        lastWorshipTime: Date.now()
    });

    // Sound
    const snd = document.getElementById('msgSound') as HTMLAudioElement;
    if (snd) snd.play().catch(e => console.log(e));

    // Write to DB: increment kneelCount + today kneeling + lastWorship
    const { memberId, id } = getState();
    const userId = memberId || id;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (userId) {
        try {
            const res = await fetch('/api/kneel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memberId: userId, tz })
            });
            const data = await res.json();
            if (res.ok && typeof data.todayKneeling === 'number') {
                updateKneelingHoursUI(data.todayKneeling);
                renderKneelDots(data.kneelHours || []);
            }
        } catch (err) {
            console.warn('[KNEEL] DB write failed:', err);
        }
    }

    // Show reward overlay
    const deskReward = document.getElementById('kneelRewardOverlay');
    const mobReward = document.getElementById('mobKneelReward');
    if (deskReward) { deskReward.classList.remove('hidden'); deskReward.style.display = 'flex'; }
    if (mobReward) { mobReward.classList.remove('hidden'); mobReward.style.display = 'flex'; }

    updateKneelingUI();
}

// ─── 5. UI SYNC ───
export function updateKneelingUI() {
    // 👇 READ FROM GLOBAL STATE
    const { isLocked, lastWorshipTime, cooldownMinutes } = getState();

    // If holding, don't interrupt
    if (!isLocked && holdTimer) return;

    if (!isLocked && !holdTimer) {
        // Only reset if we are visibly wrong (prevent flickering)
        const txtMain = document.getElementById('heroKneelText');
        if (txtMain && txtMain.innerText !== "HOLD TO KNEEL") resetUI();
        return;
    }

    const minutes = cooldownMinutes || 60;
    const now = Date.now();
    const diffMs = now - lastWorshipTime;
    const cooldownMs = minutes * 60 * 1000;

    if (diffMs < cooldownMs) {
        // STILL LOCKED
        if (!isLocked) setState({ isLocked: true }); // Sync state if mismatched

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
        if (mobBar) { mobBar.style.borderColor = "rgba(80,3,3,0.9)"; mobBar.style.boxShadow = "inset 0 1px 0 rgba(120,5,5,0.12), inset 0 -4px 14px rgba(0,0,0,0.7), 0 0 14px rgba(60,2,2,0.35), 0 6px 24px rgba(0,0,0,0.85)"; }
    } else {
        // UNLOCK
        if (isLocked) setState({ isLocked: false });
        resetUI();
    }
}
