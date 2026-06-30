// ─── GUIDED TOUR ─────────────────────────────────────────────────────────────
// Interactive walkthrough that highlights real UI elements with tooltip bubbles.

interface TourStep {
    desktop?: string;   // CSS selector for desktop
    mobile?: string;    // CSS selector for mobile
    title: string;
    text: string;
    pos?: 'top' | 'bottom' | 'left' | 'right';
    interactive?: boolean;  // allow user to interact with the highlighted element
    pad?: number;           // custom spotlight padding (default 4)
    beforeShow?: () => void;
}

const STEPS: TourStep[] = [
    {
        title: 'MEET VLAD',
        text: '',
        pos: 'bottom',
    },
    {
        title: '',
        text: 'I handle the boring stuff so Queen Karin does not have to. Questions, explanations, anything you need help with. She deals with the important things. Like you. Let me show you around.',
        pos: 'bottom',
    },
    {
        desktop: '#profilePic',
        mobile: '#hudUserPic',
        title: 'YOUR IDENTITY',
        text: 'Tap your photo to open your identity hub. You can set your name and upload a photo. I will wait, or you can come back later.',
        pos: 'bottom',
        interactive: true,
        pad: 2,
        beforeShow: () => {
            // When the identity hub opens, move tooltip to the bottom so user can interact
            const observer = new MutationObserver(() => {
                const lobby = document.getElementById('lobbyOverlay');
                if (lobby && !lobby.classList.contains('hidden')) {
                    observer.disconnect();
                    // Hide spotlight, move tooltip above the footer
                    const spot = document.getElementById('tourSpotlight');
                    if (spot) spot.style.boxShadow = 'none';
                    const tip = document.getElementById('tourTooltip');
                    if (tip) {
                        // Update text for when hub is open
                        const textEl = tip.querySelector('div[style*="margin-bottom:16px"]') as HTMLElement;
                        if (textEl) {
                            textEl.textContent = 'Right now you can set your name and the photo. I will wait, or you can come here later. Remember, the profile picture is public so everyone in the household can see it. Choose wisely what you want to use as your profile picture.';
                        }
                        Object.assign(tip.style, {
                            top: 'auto',
                            bottom: '60px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            opacity: '1',
                        });
                    }
                }
            });
            observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
            (window as any)._tourIdentityObserver = observer;
        },
    },
    {
        desktop: '#desk_DashboardRank',
        mobile: '#mob_rankStamp',
        title: 'YOUR RANK',
        text: 'This is your rank. You start at the bottom like everyone else. Every rank you climb gets you closer to Queen Karin and unlocks new privileges.',
        pos: 'bottom',
    },
    {
        desktop: '#desk_ProgressContainer',
        mobile: '#mobStatsContent',
        title: 'PROMOTION PROGRESS',
        text: 'These are your promotion requirements. Every single one has to be completed for you to move up. I will help you track what is left.',
        pos: 'bottom',
        beforeShow: () => {
            const content = document.getElementById('mobStatsContent');
            if (content && !content.classList.contains('open')) {
                (window as any).toggleMobileStats?.();
            }
        },
    },
    {
        desktop: '#heroKneelBtn',
        mobile: '#mobKneelBar',
        title: 'HOLD TO KNEEL',
        text: 'Press and hold for a few seconds. You can do this once per hour. The goal is 8 times a day, but you have 24 hours so anything above that is impressive. Go ahead, try it.',
        pos: 'top',
        interactive: true,
        pad: 2,
        beforeShow: () => {
            // Close stats drawer if it was opened by previous step
            const content = document.getElementById('mobStatsContent');
            if (content && content.classList.contains('open')) {
                (window as any).toggleMobileStats?.();
            }
            // Watch for the reward overlay to appear, then auto-advance
            const observer = new MutationObserver(() => {
                const reward = document.getElementById('mobKneelReward') || document.getElementById('kneelRewardOverlay');
                if (reward && !reward.classList.contains('hidden')) {
                    observer.disconnect();
                    // Auto-advance to the reward step
                    setTimeout(() => {
                        (window as any)._tourNextStep?.();
                    }, 600);
                }
            });
            observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
            // Store observer so we can clean up if tour ends
            (window as any)._tourKneelObserver = observer;
        },
    },
    {
        desktop: '#kneelRewardOverlay',
        mobile: '#mobKneelReward',
        title: 'CHOOSE YOUR REWARD',
        text: 'Choose your reward now. Coins go to your wallet, merit moves you toward promotion. Both are valuable, it is up to you.',
        pos: 'bottom',
        pad: 4,
        interactive: true,
        beforeShow: () => {
            // Position tooltip right under the devotion card, not at viewport bottom
            setTimeout(() => {
                const tip = document.getElementById('tourTooltip');
                const spot = document.getElementById('tourSpotlight');
                if (spot) spot.style.boxShadow = 'none';
                if (tip) {
                    Object.assign(tip.style, {
                        top: '52%',
                        bottom: 'auto',
                        left: '50%',
                        transform: 'translateX(-50%)',
                    });
                }
            }, 450);

            // Watch for the reward overlay to close (user picked a reward), then auto-advance
            const observer = new MutationObserver(() => {
                const reward = document.getElementById('mobKneelReward') || document.getElementById('kneelRewardOverlay');
                if (!reward || reward.classList.contains('hidden') || window.getComputedStyle(reward).display === 'none') {
                    observer.disconnect();
                    setTimeout(() => {
                        (window as any)._tourNextStep?.();
                    }, 500);
                }
            });
            observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class', 'style'], childList: true });
            (window as any)._tourRewardObserver = observer;
        },
    },
    {
        desktop: '#gridStat1',
        mobile: '#mob_kneelDots',
        title: 'KNEELING TRACKER',
        text: 'Each dot is one completed kneel. The goal is 8 per day. Keep showing up.',
        pos: 'bottom',
    },
    {
        desktop: '#gridTask',
        mobile: '#mobCurrentStatus .luxury-card',
        title: 'TASKS',
        text: 'Tap request and Queen Karin gives you an order. Do it, upload photo or video proof. She reviews every submission personally. Approved tasks earn you merit.',
        pos: 'bottom',
        pad: 4,
    },
    {
        desktop: '#coins',
        mobile: '#mobCoins',
        title: 'COINS',
        text: 'Your currency. You earn coins from kneeling and spend them on tributes, messages to Queen Karin, and Her wishlist. Every coin spent counts toward your Sacrifice score.',
        pos: 'bottom',
    },
    {
        desktop: '#points',
        mobile: '#mobPoints',
        title: 'MERIT',
        text: 'Your growth score. Approved tasks and kneeling rewards build it up. The more merit you earn, the closer you are to your next rank.',
        pos: 'bottom',
    },
    {
        desktop: '#chatCard',
        mobile: '.mob-nav-queen-btn',
        title: 'MY CIRCLE',
        text: 'Direct line to Queen Karin. Each message costs coins. Got questions about the app? Talk to me instead, I am always here and it is free.',
        pos: 'top',
        pad: 4,
        beforeShow: () => {
            const mob = document.getElementById('MOBILE_APP');
            if (mob && window.getComputedStyle(mob).display !== 'none') {
                const nav = document.getElementById('mobBottomNav');
                if (nav) nav.scrollIntoView({ behavior: 'smooth' });
            }
        },
    },
    {
        desktop: '#gridStat4',
        mobile: '#mobNavGlobal',
        title: 'LEADERBOARD',
        text: 'See how you compare to the rest of the household. Top performers earn rewards from Queen Karin. Weekly, monthly, and all-time rankings.',
        pos: 'top',
    },
];

let _overlay: HTMLDivElement | null = null;
let _spotlight: HTMLDivElement | null = null;
let _tooltip: HTMLDivElement | null = null;
let _currentStep = 0;
let _isMobile = false;
let _scrollHandler: (() => void) | null = null;
let _scrollContainer: HTMLElement | null = null;

function _getTarget(step: TourStep): HTMLElement | null {
    const sel = _isMobile ? (step.mobile || step.desktop) : (step.desktop || step.mobile);
    if (!sel) return null;
    return document.querySelector(sel);
}

function _createOverlay() {
    // On mobile, #MOBILE_APP has z-index:999999 so we must go above it
    const Z_OVERLAY = '9999997';
    const Z_SPOT    = '9999998';
    const Z_TIP     = '9999999';

    // Overlay
    _overlay = document.createElement('div');
    _overlay.id = 'tourOverlay';
    Object.assign(_overlay.style, {
        position: 'fixed', inset: '0', zIndex: Z_OVERLAY,
        background: 'transparent', pointerEvents: 'none',
    });
    document.body.appendChild(_overlay);

    // Spotlight (hole)
    _spotlight = document.createElement('div');
    _spotlight.id = 'tourSpotlight';
    Object.assign(_spotlight.style, {
        position: 'fixed', zIndex: Z_SPOT,
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
        position: 'fixed', zIndex: Z_TIP,
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
    const pad = step.pad ?? 4;

    // Let pointer events pass through the spotlight so user can interact with the element
    _spotlight.style.pointerEvents = 'none';

    // Match the element's actual border-radius
    const computedRadius = window.getComputedStyle(target).borderRadius || '8px';

    // Position spotlight
    Object.assign(_spotlight.style, {
        top: (rect.top - pad) + 'px',
        left: (rect.left - pad) + 'px',
        width: (rect.width + pad * 2) + 'px',
        height: (rect.height + pad * 2) + 'px',
        borderRadius: computedRadius,
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
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
            <img src="/vlad-avatar.png" alt="Vlad" style="width:38px;height:38px;border-radius:50%;object-fit:cover;object-position:center 20%;border:1px solid rgba(255,0,237,0.4);flex-shrink:0;box-shadow:0 0 12px rgba(255,0,237,0.15);" />
            <div style="display:flex;flex-direction:column;gap:2px;">
                <span style="font-family:'Cinzel',serif;font-size:0.55rem;color:rgba(255,0,237,0.7);letter-spacing:2px;">VLAD</span>
                <span style="font-family:'Cinzel',serif;font-size:0.7rem;color:#c5a059;letter-spacing:1px;">${step.title}</span>
            </div>
            <span style="margin-left:auto;font-family:'Cinzel',serif;font-size:0.5rem;color:rgba(197,160,89,0.4);letter-spacing:1px;">${cur}/${total}</span>
        </div>
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

    // Intro steps with no target — fullscreen Vlad splash
    if (!target && !step.desktop && !step.mobile) {
        if (_spotlight) Object.assign(_spotlight.style, { top: '0', left: '0', width: '0', height: '0', boxShadow: 'none' });

        // Both intro slides: fullscreen Vlad background, no flicker between them
        const isFirst = _currentStep === 0;

        // Only rebuild the fullscreen container on first slide; on second just swap content
        if (isFirst) {
            Object.assign(_tooltip.style, {
                top: '0', left: '0', width: '100vw', height: '100dvh', maxWidth: '100vw',
                borderRadius: '0', border: 'none', padding: '0',
                background: '#000', transform: 'none', opacity: '1',
            });
            _tooltip.innerHTML = `
                <div id="tourVladBg" style="width:100%;height:100%;background:url(/vlad-avatar.png) center 15% / cover no-repeat;position:relative;">
                    <div style="position:absolute;inset:0;background:linear-gradient(to top, #000 0%, rgba(0,0,0,0.9) 22%, rgba(0,0,0,0.4) 50%, transparent 65%);"></div>
                    <div id="tourVladContent" style="position:absolute;bottom:0;left:0;right:0;text-align:center;padding:0 24px 24px;z-index:1;">
                        <div style="font-family:Orbitron,sans-serif;font-size:1.3rem;color:#c5a059;letter-spacing:6px;text-shadow:0 0 30px rgba(197,160,89,0.4);margin-bottom:20px;">MEET VLAD</div>
                        <div style="display:flex;gap:10px;justify-content:center;">
                            <button id="tourSkip" style="background:none;border:1px solid rgba(255,255,255,0.15);color:#555;padding:10px 20px;border-radius:8px;font-family:Orbitron,monospace;font-size:0.65rem;cursor:pointer;letter-spacing:1px;">SKIP</button>
                            <button id="tourNext" style="background:linear-gradient(135deg,#c5a059,#8b6914);border:none;color:#000;padding:10px 24px;border-radius:8px;font-family:Orbitron,monospace;font-size:0.65rem;font-weight:700;cursor:pointer;letter-spacing:1px;">NEXT</button>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Second slide: keep the background, restore tooltip visibility, fade in new text
            _tooltip.style.opacity = '1';
            const content = _tooltip.querySelector('#tourVladContent');
            if (content) {
                (content as HTMLElement).style.opacity = '0';
                (content as HTMLElement).style.transition = 'opacity 0.3s ease';
                setTimeout(() => {
                    content.innerHTML = `
                        <div style="font-family:Rajdhani,sans-serif;font-size:1rem;color:#ccc;line-height:1.6;margin-bottom:18px;">${step.text}</div>
                        <div style="display:flex;gap:10px;justify-content:center;">
                            <button id="tourSkip" style="background:none;border:1px solid rgba(255,255,255,0.15);color:#555;padding:10px 20px;border-radius:8px;font-family:Orbitron,monospace;font-size:0.65rem;cursor:pointer;letter-spacing:1px;">SKIP</button>
                            <button id="tourNext" style="background:linear-gradient(135deg,#c5a059,#8b6914);border:none;color:#000;padding:10px 24px;border-radius:8px;font-family:Orbitron,monospace;font-size:0.65rem;font-weight:700;cursor:pointer;letter-spacing:1px;">NEXT</button>
                        </div>
                    `;
                    _tooltip!.querySelector('#tourSkip')?.addEventListener('click', endTour);
                    _tooltip!.querySelector('#tourNext')?.addEventListener('click', nextStep);
                    (content as HTMLElement).style.opacity = '1';
                }, 50);
            }
            return;
        }
        _tooltip.querySelector('#tourSkip')?.addEventListener('click', endTour);
        _tooltip.querySelector('#tourNext')?.addEventListener('click', nextStep);
        requestAnimationFrame(() => { if (_tooltip) _tooltip.style.opacity = '1'; });
        return;
    }

    if (!target) {
        // Skip steps where the element doesn't exist in current layout
        _currentStep++;
        _showStep();
        return;
    }

    // Close any open overlays from previous interactive steps
    const lobby = document.getElementById('lobbyOverlay');
    if (lobby && !lobby.classList.contains('hidden')) {
        (window as any).closeLobby?.();
    }

    // Reset tooltip styles if coming from fullscreen intro or bottom-positioned
    if (_tooltip) {
        Object.assign(_tooltip.style, {
            transform: '', height: 'auto', maxWidth: '320px',
            borderRadius: '14px', border: '1px solid rgba(197,160,89,0.3)',
            padding: '20px 22px 16px', background: '#0a0a0a',
            bottom: '',
        });
    }
    // Restore spotlight
    if (_spotlight) _spotlight.style.boxShadow = '0 0 0 9999px rgba(0,0,0,0.88)';

    // Temporarily unlock scroll so we can scroll to the target
    if (_scrollContainer) _scrollContainer.style.overflow = 'auto';
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // After scroll completes, reposition and re-lock
    setTimeout(() => {
        if (_scrollContainer) _scrollContainer.style.overflow = 'hidden';
        _positionTooltip(target, step);
    }, 400);
}

function nextStep() {
    const nextIsIntro = (_currentStep + 1) < STEPS.length && !STEPS[_currentStep + 1].desktop && !STEPS[_currentStep + 1].mobile;
    // Don't fade out tooltip between intro slides — keeps background stable
    if (!nextIsIntro && _tooltip) _tooltip.style.opacity = '0';
    _currentStep++;
    setTimeout(_showStep, nextIsIntro ? 50 : 200);
}

export function startTour() {
    // Detect mobile using computed style (inline style says 'none' but CSS !important overrides it)
    const mob = document.getElementById('MOBILE_APP');
    _isMobile = !!(mob && window.getComputedStyle(mob).display !== 'none');

    _currentStep = 0;
    _createOverlay();

    // Close any open modals/overlays that might interfere
    const aiPanel = document.getElementById('mob_aiChatContent');
    if (aiPanel) aiPanel.style.display = 'none';

    // Lock scrolling on the scroll container
    _scrollContainer = document.getElementById('viewMobileHome') || document.documentElement;
    if (_scrollContainer) {
        _scrollContainer.dataset.tourOldOverflow = _scrollContainer.style.overflow;
        _scrollContainer.style.overflow = 'hidden';
    }

    // Small delay for setup
    setTimeout(_showStep, 300);
}

export function endTour() {
    if (_overlay) { _overlay.remove(); _overlay = null; }
    if (_spotlight) { _spotlight.remove(); _spotlight = null; }
    if (_tooltip) { _tooltip.remove(); _tooltip = null; }
    _currentStep = 0;
    // Restore scrolling
    if (_scrollContainer) {
        _scrollContainer.style.overflow = _scrollContainer.dataset.tourOldOverflow || '';
        delete _scrollContainer.dataset.tourOldOverflow;
        _scrollContainer = null;
    }
    // Clean up observers
    ['_tourKneelObserver', '_tourIdentityObserver', '_tourRewardObserver'].forEach(k => {
        if ((window as any)[k]) { (window as any)[k].disconnect(); (window as any)[k] = null; }
    });
}

// Expose globally
if (typeof window !== 'undefined') {
    (window as any).startProfileTour = startTour;
    (window as any).endProfileTour = endTour;
    (window as any)._tourNextStep = nextStep;

}
