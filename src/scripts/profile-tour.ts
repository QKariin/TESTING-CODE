// ─── GUIDED TOUR ─────────────────────────────────────────────────────────────
// Interactive walkthrough that highlights real UI elements with tooltip bubbles.

interface TourStep {
    desktop?: string;   // CSS selector for desktop
    mobile?: string;    // CSS selector for mobile
    title: string;
    text: string;
    pos?: 'top' | 'bottom' | 'left' | 'right';
    beforeShow?: () => void;   // run before showing this step (e.g. scroll into view)
}

const STEPS: TourStep[] = [
    {
        desktop: '#profilePic',
        mobile: '#hudUserPic',
        title: 'YOUR IDENTITY',
        text: 'This is you. Tap to upload your photo. Queen Karin sees this every time she reviews your work.',
        pos: 'bottom',
    },
    {
        desktop: '#desk_DashboardRank',
        mobile: '#mob_rankStamp',
        title: 'YOUR RANK',
        text: 'Your place in the hierarchy. You start as a Hall Boy. Every rank you climb brings you closer to the Queen.',
        pos: 'bottom',
    },
    {
        desktop: '#desk_ProgressContainer',
        mobile: '#mobStatsContent',
        title: 'PROMOTION PROGRESS',
        text: 'Five categories: Labor, Endurance, Merit, Sacrifice, Consistency. Fill every bar to become eligible for promotion.',
        pos: 'bottom',
        beforeShow: () => {
            // On mobile, expand the stats drawer so bars are visible
            const arrow = document.getElementById('mobStatsArrow');
            const content = document.getElementById('mobStatsContent');
            if (content && content.style.display === 'none') arrow?.click();
        },
    },
    {
        desktop: '#heroKneelBtn',
        mobile: '#mobKneelBar',
        title: 'HOLD TO KNEEL',
        text: 'The most fundamental act of devotion. Hold it for a few seconds. Once per hour, 8 times a day is the goal. This is how you prove consistency.',
        pos: 'top',
    },
    {
        desktop: '#gridStat1',
        mobile: '#mob_kneelDots',
        title: 'KNEELING PROGRESS',
        text: 'Every dot is a session. 8 per day. After each kneel you choose: 10 coins or 50 merit. Consistency here builds your Endurance score.',
        pos: 'bottom',
    },
    {
        desktop: '#gridStat2',
        mobile: '#mobRoutineDisplay',
        title: 'DAILY ROUTINE',
        text: 'Pick something simple you can do every single morning. Upload proof before 10am. Your streak is the most important metric. Consistency outranks intensity.',
        pos: 'bottom',
    },
    {
        desktop: '#gridTask',
        mobile: '#mobNewTaskBtn',
        title: 'TASKS & DIRECTIVES',
        text: 'Request a task. Submit photo or video proof. Queen Karin reviews every single one personally. Approved tasks earn merit. Rejected ones cost 300 coins.',
        pos: 'bottom',
    },
    {
        desktop: '#coins',
        mobile: '#mobCoins',
        title: 'YOUR COINS',
        text: 'Your currency. Earn from kneeling rewards. Spend on tributes, chat messages, and the wishlist. Coins spent count toward your Sacrifice score.',
        pos: 'bottom',
    },
    {
        desktop: '#points',
        mobile: '#mobPoints',
        title: 'MERIT POINTS',
        text: 'Your growth score. Earned from approved tasks and kneeling. The higher your merit, the closer you get to promotion.',
        pos: 'bottom',
    },
    {
        desktop: '#chatCard',
        mobile: '#mobNavProfile',
        title: 'CHAT',
        text: 'Talk directly to Queen Karin. Each message costs coins based on your rank. You can also ask Vlad, the AI assistant, anything about the app.',
        pos: 'top',
        beforeShow: () => {
            // On mobile, point to the chat icon in bottom nav
            const mob = document.getElementById('MOBILE_APP');
            if (mob && mob.style.display !== 'none') {
                const nav = document.getElementById('mobBottomNav');
                if (nav) nav.scrollIntoView({ behavior: 'smooth' });
            }
        },
    },
    {
        desktop: '#gridStat4',
        mobile: '#mobNavGlobal',
        title: 'LEADERBOARD & COMMUNITY',
        text: 'Compete with the household. Top performers earn Skip Passes, Cum Passes, and Checkpoints. Weekly, monthly, and all-time rankings.',
        pos: 'top',
    },
];

let _overlay: HTMLDivElement | null = null;
let _spotlight: HTMLDivElement | null = null;
let _tooltip: HTMLDivElement | null = null;
let _currentStep = 0;
let _isMobile = false;

function _getTarget(step: TourStep): HTMLElement | null {
    const sel = _isMobile ? (step.mobile || step.desktop) : (step.desktop || step.mobile);
    if (!sel) return null;
    return document.querySelector(sel);
}

function _createOverlay() {
    // Overlay
    _overlay = document.createElement('div');
    _overlay.id = 'tourOverlay';
    Object.assign(_overlay.style, {
        position: 'fixed', inset: '0', zIndex: '99997',
        background: 'transparent', pointerEvents: 'none',
    });
    document.body.appendChild(_overlay);

    // Spotlight (hole)
    _spotlight = document.createElement('div');
    _spotlight.id = 'tourSpotlight';
    Object.assign(_spotlight.style, {
        position: 'fixed', zIndex: '99998',
        borderRadius: '12px',
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.88)',
        transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
        pointerEvents: 'none',
    });
    document.body.appendChild(_spotlight);

    // Tooltip
    _tooltip = document.createElement('div');
    _tooltip.id = 'tourTooltip';
    Object.assign(_tooltip.style, {
        position: 'fixed', zIndex: '99999',
        background: '#0a0a0a',
        border: '1px solid rgba(197,160,89,0.3)',
        borderRadius: '14px',
        padding: '20px 22px 16px',
        maxWidth: '320px', width: '90vw',
        fontFamily: 'Rajdhani, sans-serif',
        color: '#ccc', fontSize: '0.88rem', lineHeight: '1.5',
        transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
        opacity: '0',
        pointerEvents: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    });
    document.body.appendChild(_tooltip);
}

function _positionTooltip(target: HTMLElement, step: TourStep) {
    if (!_spotlight || !_tooltip) return;

    const rect = target.getBoundingClientRect();
    const pad = 8;

    // Position spotlight
    Object.assign(_spotlight.style, {
        top: (rect.top - pad) + 'px',
        left: (rect.left - pad) + 'px',
        width: (rect.width + pad * 2) + 'px',
        height: (rect.height + pad * 2) + 'px',
    });

    // Determine tooltip position
    const pos = step.pos || 'bottom';
    const tooltipW = Math.min(320, window.innerWidth * 0.9);
    let top = 0, left = 0;

    if (pos === 'bottom') {
        top = rect.bottom + pad + 12;
        left = rect.left + rect.width / 2 - tooltipW / 2;
    } else if (pos === 'top') {
        top = rect.top - pad - 12;
        left = rect.left + rect.width / 2 - tooltipW / 2;
    } else if (pos === 'right') {
        top = rect.top + rect.height / 2 - 60;
        left = rect.right + pad + 12;
    } else {
        top = rect.top + rect.height / 2 - 60;
        left = rect.left - pad - tooltipW - 12;
    }

    // Clamp to viewport
    left = Math.max(10, Math.min(left, window.innerWidth - tooltipW - 10));
    if (pos === 'top') {
        // Measure tooltip height and position above
        _tooltip.style.visibility = 'hidden';
        _tooltip.style.opacity = '1';
        const h = _tooltip.offsetHeight;
        _tooltip.style.visibility = '';
        _tooltip.style.opacity = '0';
        top = rect.top - pad - 12 - h;
        if (top < 10) top = rect.bottom + pad + 12; // flip to bottom if no room
    }
    if (top < 10) top = 10;
    if (top + 200 > window.innerHeight) top = window.innerHeight - 220;

    Object.assign(_tooltip.style, {
        top: top + 'px',
        left: left + 'px',
        width: tooltipW + 'px',
    });

    // Build tooltip content
    const total = STEPS.length;
    const cur = _currentStep + 1;
    const isLast = _currentStep === total - 1;

    _tooltip.innerHTML = `
        <div style="font-family:Orbitron,monospace;font-size:0.6rem;color:rgba(197,160,89,0.5);letter-spacing:3px;margin-bottom:8px;">${cur} / ${total}</div>
        <div style="font-family:Orbitron,sans-serif;font-size:0.82rem;color:#c5a059;letter-spacing:1px;margin-bottom:8px;">${step.title}</div>
        <div style="margin-bottom:16px;">${step.text}</div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button id="tourSkip" style="background:none;border:1px solid rgba(255,255,255,0.1);color:#555;padding:8px 16px;border-radius:8px;font-family:Orbitron,monospace;font-size:0.65rem;cursor:pointer;letter-spacing:1px;">SKIP</button>
            <button id="tourNext" style="background:linear-gradient(135deg,#c5a059,#8b6914);border:none;color:#000;padding:8px 20px;border-radius:8px;font-family:Orbitron,monospace;font-size:0.65rem;font-weight:700;cursor:pointer;letter-spacing:1px;">${isLast ? 'DONE' : 'NEXT'}</button>
        </div>
    `;

    // Bind buttons
    _tooltip.querySelector('#tourSkip')?.addEventListener('click', endTour);
    _tooltip.querySelector('#tourNext')?.addEventListener('click', isLast ? endTour : nextStep);

    // Fade in
    requestAnimationFrame(() => {
        if (_tooltip) _tooltip.style.opacity = '1';
    });
}

function _showStep() {
    if (_currentStep >= STEPS.length) { endTour(); return; }

    const step = STEPS[_currentStep];

    // Run beforeShow hook
    if (step.beforeShow) step.beforeShow();

    const target = _getTarget(step);
    if (!target) {
        // Skip steps where the element doesn't exist in current layout
        _currentStep++;
        _showStep();
        return;
    }

    // Scroll target into view
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Small delay for scroll to complete
    setTimeout(() => {
        _positionTooltip(target, step);
    }, 400);
}

function nextStep() {
    if (_tooltip) _tooltip.style.opacity = '0';
    _currentStep++;
    setTimeout(_showStep, 200);
}

export function startTour() {
    // Detect mobile
    const mob = document.getElementById('MOBILE_APP');
    _isMobile = !!(mob && mob.style.display !== 'none' && mob.offsetParent !== null);

    _currentStep = 0;
    _createOverlay();

    // Close any open modals/overlays that might interfere
    const aiPanel = document.getElementById('mob_aiChatContent');
    if (aiPanel) aiPanel.style.display = 'none';

    // Small delay for setup
    setTimeout(_showStep, 300);
}

export function endTour() {
    if (_overlay) { _overlay.remove(); _overlay = null; }
    if (_spotlight) { _spotlight.remove(); _spotlight = null; }
    if (_tooltip) { _tooltip.remove(); _tooltip = null; }
    _currentStep = 0;
}

// Expose globally
if (typeof window !== 'undefined') {
    (window as any).startProfileTour = startTour;
    (window as any).endProfileTour = endTour;
}
