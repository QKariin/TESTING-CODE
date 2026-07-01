// ─── GUIDED TOUR ─────────────────────────────────────────────────────────────
// Modal-based walkthrough. User taps elements to learn about them.
// Clones the element into a modal where Vlad explains it.

interface TourItem {
    desktop?: string;
    mobile?: string;
    title: string;
    text: string;
    action?: string;            // special behavior instead of modal (e.g. 'openStats')
    dotPos?: { top: string; right: string };  // dot corner position override
    cloneSelector?: string;     // override which element to show when explaining
}

const TOUR_ITEMS: TourItem[] = [
    {
        desktop: '#profilePic',
        mobile: '#hudUserPic',
        title: 'YOUR IDENTITY',
        text: 'This is your identity hub. You can set your name and upload a profile picture. Remember, the profile picture is public so everyone in the household can see it. As you climb ranks, more unlocks here.',
    },
    {
        desktop: '#desk_DashboardRank',
        mobile: '#mob_rankStamp',
        title: 'YOUR RANK',
        text: 'This is your rank. You start at the bottom like everyone else. Every rank you climb gets you closer to Queen Karin and unlocks new privileges.',
        dotPos: { top: '-6px', right: '30%' },
    },
    {
        desktop: '#desk_ProgressContainer',
        mobile: '.mob-stats-toggle-btn',
        title: 'SLAVE STATS',
        text: 'Your full stats, current rank, promotion requirements, and privileges. Tap to open and explore everything about your progress.',
        action: 'openStats',
    },
    {
        desktop: '#heroKneelBtn',
        mobile: '#mobKneelSection',
        title: 'HOLD TO KNEEL',
        text: 'Press and hold for a few seconds. You can do this once per hour. The goal is 8 times a day, but you have 24 hours so anything above that is impressive.',
        dotPos: { top: '20px', right: '6%' },
        cloneSelector: '#mobKneelBar',
    },
    {
        desktop: '#gridStat1',
        mobile: '#mob_kneelDots',
        title: 'KNEELING TRACKER',
        text: 'Each dot is one completed kneel. The goal is 8 per day. Keep showing up.',
    },
    {
        desktop: '#gridTask',
        mobile: '#mobCurrentStatus .luxury-card',
        title: 'TASKS',
        text: 'Tap request and Queen Karin gives you an order. Do it, upload photo or video proof. She reviews every submission personally. Approved tasks earn you merit.',
    },
    {
        desktop: '#coins',
        mobile: '.halo-stats-pill',
        title: 'YOUR STATS',
        text: 'Merit is your growth score, it moves you toward promotion. Coins are your currency, you spend them on tributes, messages to Queen Karin, and Her wishlist.',
    },
    {
        desktop: '#chatCard',
        mobile: '.mob-nav-queen-btn',
        title: 'MY CIRCLE',
        text: 'Direct line to Queen Karin. Each message costs coins. Got questions about the app? Talk to me instead, I am always here and it is free.',
        dotPos: { top: '-14px', right: '50%' },
        action: 'openChat',
    },
    {
        desktop: '#gridStat4',
        mobile: '#mobNavGlobal',
        title: 'LEADERBOARD',
        text: 'See how you compare to the rest of the household. Top performers earn rewards from Queen Karin. Weekly, monthly, and all-time rankings.',
        dotPos: { top: '-14px', right: '50%' },
        action: 'openGlobal',
    },
];

let _modal: HTMLDivElement | null = null;
let _isMobile = false;
let _clickHandlers: { el: HTMLElement; handler: (e: Event) => void }[] = [];
let _explored: Set<string> = new Set();
let _exploredTitles: string[] = [];
let _tourStartTime: number = 0;
let _hiddenEls: { el: HTMLElement; visibility: string }[] = [];

function _getSelector(item: TourItem): string | undefined {
    return _isMobile ? (item.mobile || item.desktop) : (item.desktop || item.mobile);
}

function _getTarget(item: TourItem): HTMLElement | null {
    const sel = _getSelector(item);
    if (!sel) return null;
    return document.querySelector(sel);
}

// Isolate a single element: hide all siblings at every level up to #viewMobileHome
function _isolateElement(target: HTMLElement) {
    _hiddenEls = [];
    const root = document.getElementById('viewMobileHome');
    // Hide the ::before background image
    if (root) root.classList.add('tour-isolate');
    let current: HTMLElement | null = target;

    while (current && current !== root && current !== document.body) {
        const parent: HTMLElement | null = current.parentElement;
        if (!parent) break;
        // Hide all siblings of current
        for (let i = 0; i < parent.children.length; i++) {
            const sibling = parent.children[i] as HTMLElement;
            if (sibling === current) continue;
            if (sibling.id === 'tourDarkOverlay') continue;
            if (sibling.id === 'tourExplainPanel') continue;
            if (!sibling.style) continue;
            _hiddenEls.push({ el: sibling, visibility: sibling.style.visibility });
            sibling.style.visibility = 'hidden';
        }
        current = parent;
    }
}

// Restore all hidden elements
function _restoreElements() {
    for (const h of _hiddenEls) {
        h.el.style.visibility = h.visibility;
    }
    _hiddenEls = [];
    const root = document.getElementById('viewMobileHome');
    if (root) root.classList.remove('tour-isolate');
}

// Show explanation panel next to the actual element (no cloning, no modal)
function _showExplainModal(item: TourItem, target: HTMLElement) {
    const sel = _getSelector(item);
    if (sel) _explored.add(sel);
    if (!_exploredTitles.includes(item.title)) _exploredTitles.push(item.title);

    // Remove dots
    _removeIndicators();

    // For HOLD TO KNEEL, use the actual kneel bar as the visible element
    const visibleTarget = item.cloneSelector
        ? (document.querySelector(item.cloneSelector) as HTMLElement || target)
        : target;

    // Keep dark overlay but isolate just this element
    if (!_darkOverlay) {
        _darkOverlay = document.createElement('div');
        _darkOverlay.id = 'tourDarkOverlay';
        Object.assign(_darkOverlay.style, {
            position: 'fixed', inset: '0',
            background: 'rgba(0,0,0,0.88)',
            pointerEvents: 'none',
            zIndex: '0',
        });
        const view = document.getElementById('viewMobileHome');
        if (view) {
            view.insertBefore(_darkOverlay, view.firstChild);
        }
    }

    // Hide everything except the target element
    _isolateElement(visibleTarget);

    // Scroll target into view (upper area, leave room for explanation below)
    visibleTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Create the explanation panel (fixed at bottom)
    _modal = document.createElement('div');
    _modal.id = 'tourExplainPanel';
    Object.assign(_modal.style, {
        position: 'fixed', bottom: '0', left: '0', right: '0',
        zIndex: '10000001',
        background: 'linear-gradient(to top, #000 70%, rgba(0,0,0,0.95) 90%, transparent 100%)',
        padding: '30px 24px calc(20px + env(safe-area-inset-bottom))',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        pointerEvents: 'auto',
    });

    _modal.innerHTML = `
        <div style="max-width:360px;width:100%;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
                <img src="/vlad-avatar.png" alt="Vlad" style="width:38px;height:38px;border-radius:50%;object-fit:cover;object-position:center 20%;border:1px solid rgba(255,0,237,0.4);flex-shrink:0;box-shadow:0 0 12px rgba(255,0,237,0.15);" />
                <div style="display:flex;flex-direction:column;gap:2px;">
                    <span style="font-family:'Cinzel',serif;font-size:0.55rem;color:rgba(255,0,237,0.7);letter-spacing:2px;">VLAD</span>
                    <span style="font-family:'Cinzel',serif;font-size:0.7rem;color:#c5a059;letter-spacing:1px;">${item.title}</span>
                </div>
            </div>
            <div style="font-family:Rajdhani,sans-serif;font-size:0.88rem;color:#ccc;line-height:1.6;margin-bottom:20px;">
                ${item.text}
            </div>
            <button id="tourGotIt" style="background:linear-gradient(135deg,#c5a059,#8b6914);border:none;color:#000;padding:12px 40px;border-radius:8px;font-family:Orbitron,monospace;font-size:0.7rem;font-weight:700;cursor:pointer;letter-spacing:2px;width:100%;">GOT IT</button>
        </div>
    `;

    // Hide footer nav while panel is visible
    const nav = document.getElementById('mobBottomNav');
    if (nav) {
        _hiddenEls.push({ el: nav, visibility: nav.style.visibility });
        nav.style.visibility = 'hidden';
    }

    document.body.appendChild(_modal);

    _modal.querySelector('#tourGotIt')?.addEventListener('click', () => {
        if (_modal) { _modal.remove(); _modal = null; }
        _restoreElements();
        if (_darkOverlay) { _darkOverlay.remove(); _darkOverlay = null; }
        _addIndicators();
    });
}

// Inject pulsing animation CSS once
function _injectPulseCSS() {
    if (document.getElementById('tourPulseCSS')) return;
    const style = document.createElement('style');
    style.id = 'tourPulseCSS';
    style.textContent = `
        #viewMobileHome.tour-isolate::before { opacity: 0 !important; }
        @keyframes tourPulse {
            0% { box-shadow: 0 0 16px rgba(197,160,89,0.6), 0 0 32px rgba(197,160,89,0.3); opacity: 1; }
            50% { box-shadow: 0 0 24px rgba(197,160,89,0.9), 0 0 48px rgba(197,160,89,0.5); opacity: 0.7; }
            100% { box-shadow: 0 0 16px rgba(197,160,89,0.6), 0 0 32px rgba(197,160,89,0.3); opacity: 1; }
        }
        .tour-dot {
            position: absolute; width: 28px; height: 28px; border-radius: 50%;
            background: radial-gradient(circle, rgba(197,160,89,0.95) 0%, rgba(197,160,89,0.4) 60%, transparent 70%);
            border: 2px solid rgba(197,160,89,0.8);
            box-shadow: 0 0 16px rgba(197,160,89,0.6), 0 0 32px rgba(197,160,89,0.3);
            z-index: 99999; cursor: pointer; pointer-events: auto;
            animation: tourPulse 1.8s ease-in-out infinite;
            display: flex; align-items: center; justify-content: center;
        }
        .tour-dot::after {
            content: '?'; font-family: 'Cinzel', serif; font-size: 0.65rem;
            color: #000; font-weight: bold;
        }
        .tour-dot-done {
            background: radial-gradient(circle, rgba(80,180,80,0.7) 0%, rgba(80,180,80,0.2) 60%, transparent 70%);
            border-color: rgba(80,180,80,0.5);
            box-shadow: 0 0 12px rgba(80,180,80,0.4);
            animation: none; width: 22px; height: 22px;
        }
        .tour-dot-done::after {
            content: '\\2713'; color: rgba(80,180,80,0.9); font-size: 0.55rem;
        }
    `;
    document.head.appendChild(style);
}

let _dots: HTMLDivElement[] = [];
let _savedPositions: { el: HTMLElement; position: string; overflow: string }[] = [];
let _darkOverlay: HTMLDivElement | null = null;
let _statsCloseHandler: ((e: MouseEvent) => void) | null = null;

// Create pulsing dots directly on each explainable element
function _addIndicators() {
    _injectPulseCSS();
    _removeDots();

    // Add dark overlay for contrast — inserted as FIRST child so content paints above it
    if (!_darkOverlay) {
        _darkOverlay = document.createElement('div');
        _darkOverlay.id = 'tourDarkOverlay';
        Object.assign(_darkOverlay.style, {
            position: 'fixed', inset: '0',
            background: 'rgba(0,0,0,0.88)',
            pointerEvents: 'none',
            zIndex: '0',
        });
        const view = document.getElementById('viewMobileHome');
        if (view) {
            view.insertBefore(_darkOverlay, view.firstChild);
        } else {
            document.body.appendChild(_darkOverlay);
        }
    }

    for (let i = 0; i < TOUR_ITEMS.length; i++) {
        const item = TOUR_ITEMS[i];
        const target = _getTarget(item);
        if (!target) continue;
        const sel = _getSelector(item);
        const isDone = sel ? _explored.has(sel) : false;

        // Ensure the target has position so absolute dot is relative to it
        // Also force overflow visible so dot can poke out like a sticker
        const computedStyle = window.getComputedStyle(target);
        _savedPositions.push({
            el: target,
            position: target.style.position,
            overflow: target.style.overflow,
        });
        if (computedStyle.position === 'static') {
            target.style.position = 'relative';
        }
        target.style.overflow = 'visible';

        // Also force overflow on parent (e.g. footer nav bar clips its children)
        const parent = target.parentElement;
        if (parent) {
            const parentOverflow = window.getComputedStyle(parent).overflow;
            if (parentOverflow === 'hidden' || parentOverflow === 'clip') {
                _savedPositions.push({ el: parent, position: parent.style.position, overflow: parent.style.overflow });
                parent.style.overflow = 'visible';
            }
        }

        const dot = document.createElement('div');
        dot.className = isDone ? 'tour-dot tour-dot-done' : 'tour-dot';

        // Position dot — custom or default top-right corner
        if (item.dotPos) {
            dot.style.top = item.dotPos.top;
            dot.style.right = item.dotPos.right;
            // If centered (right: 50%), shift left by half dot width
            if (item.dotPos.right === '50%') {
                dot.style.transform = 'translateX(50%)';
            }
        } else {
            dot.style.top = '-6px';
            dot.style.right = '-6px';
        }

        dot.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (item.action === 'openStats') {
                _openStatsDrawer(item);
            } else if (item.action === 'openChat') {
                _openOverlayWithExplanation(item, 'openMobChatOverlay');
            } else if (item.action === 'openGlobal') {
                _openOverlayWithExplanation(item, 'openMobGlobal');
            } else {
                _showExplainModal(item, target);
            }
        });

        target.appendChild(dot);
        _dots.push(dot);
    }

    // Show explore prompt
    if (!document.getElementById('tourExplorePrompt')) {
        const prompt = document.createElement('div');
        prompt.id = 'tourExplorePrompt';
        Object.assign(prompt.style, {
            position: 'fixed', top: '10px', left: '50%', transform: 'translateX(-50%)',
            zIndex: '10000001', background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(197,160,89,0.3)', borderRadius: '12px',
            padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        });
        prompt.innerHTML = `
            <img src="/vlad-avatar.png" alt="Vlad" style="width:28px;height:28px;border-radius:50%;object-fit:cover;object-position:center 20%;border:1px solid rgba(255,0,237,0.3);" />
            <span style="font-family:Rajdhani,sans-serif;font-size:0.78rem;color:#ccc;">Tap a <span style="color:#c5a059;">?</span> to learn about it</span>
            <button id="tourEndBtn" style="background:none;border:1px solid rgba(255,255,255,0.15);color:#666;padding:5px 12px;border-radius:6px;font-family:Orbitron,monospace;font-size:0.5rem;cursor:pointer;letter-spacing:1px;margin-left:4px;">END</button>
        `;
        document.body.appendChild(prompt);
        prompt.querySelector('#tourEndBtn')?.addEventListener('click', endTour);
    }
}

// Open a chat/global overlay and show explanation panel on top
function _openOverlayWithExplanation(item: TourItem, fnName: string) {
    const sel = _getSelector(item);
    if (sel) _explored.add(sel);
    if (!_exploredTitles.includes(item.title)) _exploredTitles.push(item.title);

    // Remove dots
    _removeIndicators();

    // Open the overlay via the global function
    const fn = (window as any)[fnName];
    if (fn) fn();

    // Create explanation panel INSIDE the overlay, absolutely positioned to cover messages but stay below header (z-index: 2)
    setTimeout(() => {
        const overlayId = fnName === 'openMobChatOverlay' ? 'mobChatOverlay' : 'mobGlobalOverlay';
        const overlay = document.getElementById(overlayId);
        if (!overlay) return;

        _modal = document.createElement('div');
        _modal.id = 'tourExplainPanel';
        Object.assign(_modal.style, {
            position: 'absolute', top: '0', left: '0', right: '0', bottom: '0',
            background: '#000',
            zIndex: '1',   // header is z-index: 2, so header stays visible above this
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
            padding: '24px',
        });

        _modal.innerHTML = `
            <div style="max-width:360px;width:100%;">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
                    <img src="/vlad-avatar.png" alt="Vlad" style="width:38px;height:38px;border-radius:50%;object-fit:cover;object-position:center 20%;border:1px solid rgba(255,0,237,0.4);flex-shrink:0;box-shadow:0 0 12px rgba(255,0,237,0.15);" />
                    <div style="display:flex;flex-direction:column;gap:2px;">
                        <span style="font-family:'Cinzel',serif;font-size:0.55rem;color:rgba(255,0,237,0.7);letter-spacing:2px;">VLAD</span>
                        <span style="font-family:'Cinzel',serif;font-size:0.7rem;color:#c5a059;letter-spacing:1px;">${item.title}</span>
                    </div>
                </div>
                <div style="font-family:Rajdhani,sans-serif;font-size:0.88rem;color:#ccc;line-height:1.6;margin-bottom:16px;">
                    ${item.text}
                </div>
                <button id="tourGotIt" style="background:linear-gradient(135deg,#c5a059,#8b6914);border:none;color:#000;padding:12px 40px;border-radius:8px;font-family:Orbitron,monospace;font-size:0.7rem;font-weight:700;cursor:pointer;letter-spacing:2px;width:100%;">GOT IT</button>
            </div>
        `;

        overlay.appendChild(_modal);

        _modal.querySelector('#tourGotIt')?.addEventListener('click', () => {
            if (_modal) { _modal.remove(); _modal = null; }
            if (fnName === 'openMobChatOverlay') {
                (window as any).closeMobChatOverlay?.();
            } else if (fnName === 'openMobGlobal') {
                (window as any).closeMobGlobal?.();
            }
            _addIndicators();
        });
    }, 350);
}

// Open the slave stats drawer and show explanation
function _openStatsDrawer(item: TourItem) {
    const sel = _getSelector(item);
    if (sel) _explored.add(sel);
    if (!_exploredTitles.includes(item.title)) _exploredTitles.push(item.title);

    // Remove dots
    _removeIndicators();

    // Open the drawer
    const content = document.getElementById('mobStatsContent');
    const arrow = document.getElementById('mobStatsArrow');
    if (content && !content.classList.contains('open')) {
        content.classList.add('open');
        if (arrow) arrow.innerText = '▲';
    }

    // Keep dark overlay
    if (!_darkOverlay) {
        _darkOverlay = document.createElement('div');
        _darkOverlay.id = 'tourDarkOverlay';
        Object.assign(_darkOverlay.style, {
            position: 'fixed', inset: '0',
            background: 'rgba(0,0,0,0.88)',
            pointerEvents: 'none',
            zIndex: '0',
        });
        const view = document.getElementById('viewMobileHome');
        if (view) view.insertBefore(_darkOverlay, view.firstChild);
    }

    // Isolate the stats WRAPPER (contains both toggle button and drawer)
    const toggle = document.querySelector('.mob-stats-toggle-btn') as HTMLElement;
    const statsWrapper = toggle?.parentElement;
    if (statsWrapper) {
        _isolateElement(statsWrapper);
        statsWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Hide footer nav
    const nav = document.getElementById('mobBottomNav');
    if (nav) {
        _hiddenEls.push({ el: nav, visibility: nav.style.visibility });
        nav.style.visibility = 'hidden';
    }

    // Show explanation panel at bottom
    _modal = document.createElement('div');
    _modal.id = 'tourExplainPanel';
    Object.assign(_modal.style, {
        position: 'fixed', bottom: '0', left: '0', right: '0',
        zIndex: '10000001',
        background: 'linear-gradient(to top, #000 70%, rgba(0,0,0,0.95) 90%, transparent 100%)',
        padding: '30px 24px calc(20px + env(safe-area-inset-bottom))',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        pointerEvents: 'auto',
    });

    _modal.innerHTML = `
        <div style="max-width:360px;width:100%;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
                <img src="/vlad-avatar.png" alt="Vlad" style="width:38px;height:38px;border-radius:50%;object-fit:cover;object-position:center 20%;border:1px solid rgba(255,0,237,0.4);flex-shrink:0;box-shadow:0 0 12px rgba(255,0,237,0.15);" />
                <div style="display:flex;flex-direction:column;gap:2px;">
                    <span style="font-family:'Cinzel',serif;font-size:0.55rem;color:rgba(255,0,237,0.7);letter-spacing:2px;">VLAD</span>
                    <span style="font-family:'Cinzel',serif;font-size:0.7rem;color:#c5a059;letter-spacing:1px;">${item.title}</span>
                </div>
            </div>
            <div style="font-family:Rajdhani,sans-serif;font-size:0.88rem;color:#ccc;line-height:1.6;margin-bottom:20px;">
                ${item.text}
            </div>
            <button id="tourGotIt" style="background:linear-gradient(135deg,#c5a059,#8b6914);border:none;color:#000;padding:12px 40px;border-radius:8px;font-family:Orbitron,monospace;font-size:0.7rem;font-weight:700;cursor:pointer;letter-spacing:2px;width:100%;">GOT IT</button>
        </div>
    `;

    document.body.appendChild(_modal);

    _modal.querySelector('#tourGotIt')?.addEventListener('click', () => {
        if (_modal) { _modal.remove(); _modal = null; }
        // Close the drawer
        if (content?.classList.contains('open')) {
            content.classList.remove('open');
            if (arrow) arrow.innerText = '▼';
        }
        _restoreElements();
        if (_darkOverlay) { _darkOverlay.remove(); _darkOverlay = null; }
        _addIndicators();
    });
}

function _removeDots() {
    for (const dot of _dots) dot.remove();
    _dots = [];
    for (const saved of _savedPositions) {
        saved.el.style.position = saved.position;
        saved.el.style.overflow = saved.overflow;
    }
    _savedPositions = [];
    if (_darkOverlay) { _darkOverlay.remove(); _darkOverlay = null; }
    if (_statsCloseHandler) {
        document.removeEventListener('click', _statsCloseHandler);
        _statsCloseHandler = null;
    }
}

function _removeIndicators() {
    _removeDots();
    _clickHandlers = [];
}

// ─── INTRO SLIDES ──────────────────────────────────────────────────────────

let _introOverlay: HTMLDivElement | null = null;
let _introStep = 0;

function _showIntro() {
    _introOverlay = document.createElement('div');
    _introOverlay.id = 'tourIntro';
    Object.assign(_introOverlay.style, {
        position: 'fixed', inset: '0', zIndex: '10000001',
        background: '#000', opacity: '0', transition: 'opacity 0.3s ease',
    });

    _introOverlay.innerHTML = `
        <div style="width:100%;height:100%;background:url(/vlad-avatar.png) center 15% / cover no-repeat;position:relative;">
            <div style="position:absolute;inset:0;background:linear-gradient(to top, #000 0%, rgba(0,0,0,0.9) 22%, rgba(0,0,0,0.4) 50%, transparent 65%);"></div>
            <div id="tourIntroContent" style="position:absolute;bottom:0;left:0;right:0;text-align:center;padding:0 24px 24px;z-index:1;">
                <div style="font-family:Orbitron,sans-serif;font-size:1.3rem;color:#c5a059;letter-spacing:6px;text-shadow:0 0 30px rgba(197,160,89,0.4);margin-bottom:20px;">MEET VLAD</div>
                <div style="display:flex;gap:10px;justify-content:center;">
                    <button id="introSkip" style="background:none;border:1px solid rgba(255,255,255,0.15);color:#555;padding:10px 20px;border-radius:8px;font-family:Orbitron,monospace;font-size:0.65rem;cursor:pointer;letter-spacing:1px;">SKIP</button>
                    <button id="introNext" style="background:linear-gradient(135deg,#c5a059,#8b6914);border:none;color:#000;padding:10px 24px;border-radius:8px;font-family:Orbitron,monospace;font-size:0.65rem;font-weight:700;cursor:pointer;letter-spacing:1px;">NEXT</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(_introOverlay);

    _introOverlay.querySelector('#introSkip')?.addEventListener('click', _finishIntro);
    _introOverlay.querySelector('#introNext')?.addEventListener('click', _introNextSlide);

    requestAnimationFrame(() => {
        if (_introOverlay) _introOverlay.style.opacity = '1';
    });
}

function _introNextSlide() {
    _introStep++;
    if (_introStep === 1) {
        // Second slide — Vlad's intro text
        const content = _introOverlay?.querySelector('#tourIntroContent');
        if (content) {
            (content as HTMLElement).style.opacity = '0';
            (content as HTMLElement).style.transition = 'opacity 0.3s ease';
            setTimeout(() => {
                content.innerHTML = `
                    <div style="font-family:Rajdhani,sans-serif;font-size:1rem;color:#ccc;line-height:1.6;margin-bottom:18px;">I handle the boring stuff so Queen Karin does not have to. Questions, explanations, anything you need help with. She deals with the important things. Like you. Let me show you around.</div>
                    <div style="display:flex;gap:10px;justify-content:center;">
                        <button id="introSkip" style="background:none;border:1px solid rgba(255,255,255,0.15);color:#555;padding:10px 20px;border-radius:8px;font-family:Orbitron,monospace;font-size:0.65rem;cursor:pointer;letter-spacing:1px;">SKIP</button>
                        <button id="introNext" style="background:linear-gradient(135deg,#c5a059,#8b6914);border:none;color:#000;padding:10px 24px;border-radius:8px;font-family:Orbitron,monospace;font-size:0.65rem;font-weight:700;cursor:pointer;letter-spacing:1px;">LET'S GO</button>
                    </div>
                `;
                content.querySelector('#introSkip')?.addEventListener('click', _finishIntro);
                content.querySelector('#introNext')?.addEventListener('click', _finishIntro);
                (content as HTMLElement).style.opacity = '1';
            }, 50);
        }
    } else {
        _finishIntro();
    }
}

function _finishIntro() {
    if (_introOverlay) {
        _introOverlay.style.opacity = '0';
        setTimeout(() => {
            _introOverlay?.remove();
            _introOverlay = null;
            // Enter explore mode
            _addIndicators();
        }, 300);
    }
}

// ─── PUBLIC API ─────────────────────────────────────────────────────────────

export function startTour() {
    const mob = document.getElementById('MOBILE_APP');
    _isMobile = !!(mob && window.getComputedStyle(mob).display !== 'none');
    _explored = new Set();
    _exploredTitles = [];
    _tourStartTime = Date.now();
    _introStep = 0;

    // Close chat overlay
    const chatOverlay = document.getElementById('mobChatOverlay');
    if (chatOverlay) chatOverlay.style.display = 'none';
    const aiPanel = document.getElementById('mob_aiChatContent');
    if (aiPanel) aiPanel.style.display = 'none';

    // Start with Vlad intro
    setTimeout(_showIntro, 300);
}

export function endTour() {
    // Send tour report before cleanup
    _sendTourReport();

    _removeIndicators();
    _restoreElements();
    if (_modal) { _modal.remove(); _modal = null; }
    if (_introOverlay) { _introOverlay.remove(); _introOverlay = null; }
    if (_darkOverlay) { _darkOverlay.remove(); _darkOverlay = null; }
    // Close stats drawer if left open
    const statsContent = document.getElementById('mobStatsContent');
    const statsArrow = document.getElementById('mobStatsArrow');
    if (statsContent?.classList.contains('open')) {
        statsContent.classList.remove('open');
        if (statsArrow) statsArrow.innerText = '▼';
    }
    // Close overlays if left open
    (window as any).closeMobChatOverlay?.();
    (window as any).closeMobGlobal?.();
    const prompt = document.getElementById('tourExplorePrompt');
    if (prompt) prompt.remove();
    const css = document.getElementById('tourPulseCSS');
    if (css) css.remove();
    _explored = new Set();
    _exploredTitles = [];
}

function _sendTourReport() {
    if (!_tourStartTime) return;
    const durationSeconds = Math.round((Date.now() - _tourStartTime) / 1000);
    // Only report if they spent at least 3 seconds (not accidental open/close)
    if (durationSeconds < 3) return;

    const raw = (window as any).__currentProfileRaw || {};
    const memberId = raw.member_id || '';
    const memberName = raw.name || 'Unknown';
    if (!memberId) return;

    fetch('/api/tour-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            memberId,
            memberName,
            explored: _exploredTitles,
            totalItems: TOUR_ITEMS.length,
            durationSeconds,
        }),
    }).catch(() => {});
}

// Expose globally
if (typeof window !== 'undefined') {
    (window as any).startProfileTour = startTour;
    (window as any).endProfileTour = endTour;
}
