// src/scripts/onboarding.ts
// First-visit onboarding - mobile only, new users only

import { createClient } from '@/utils/supabase/client';
import { uploadToSupabase } from './mediaSupabase';
import { HIERARCHY_RULES } from '../lib/hierarchyRules';

if (typeof window !== 'undefined') {
    (window as any)._testOnboarding = () => _showModal({});
}

// ─── Slide content (after setup) ─────────────────────────────────────────────

interface Slide { title: string; body: string | null; }

function getSlides(name: string): Slide[] {
    return [
        {
            title: 'THE RITUAL',
            body: `Kneeling is your core act of submission. You will complete 8 sessions per day.\n\nEach session earns you coins - the only currency that lets you speak to me. If you go silent, you kneel. That is the only way back.`,
        },
        {
            title: 'YOUR DAILY DUTY',
            body: `Each day you are assigned a task. Complete it. Submit proof.\n\nNo extensions. No excuses. Your record is permanent and visible to me at all times.`,
        },
        {
            title: 'YOUR PLACE IN THE ORDER',
            body: null,
        },
        {
            title: `DO NOT DISAPPOINT ME, ${(name || 'SLAVE').toUpperCase()}`,
            body: `Your rank. Your wallet. Your first task.\nEverything is already waiting.\n\nI will be watching.`,
        },
    ];
}

// ─── State ────────────────────────────────────────────────────────────────────

interface OBState {
    memberId: string;
    rawParams: any;
    overlay: HTMLElement;
    name: string;
    photoUrl: string | null;
    photoSelected: boolean;
    slideIndex: number; // -2 = welcome, -1 = setup, 0+ = slides
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function checkAndShowOnboarding(raw: any): Promise<void> {
    const forceShow = new URLSearchParams(window.location.search).get('onboarding') === '1';
    if (!forceShow && window.innerWidth >= 768) return;
    if (!forceShow && raw?.parameters?.onboarding_seen === true) return;
    if (!forceShow && ((raw?.score || 0) > 0 || (raw?.kneelCount || 0) > 0)) {
        const mid = raw?.member_id || raw?.memberId;
        if (mid) _markSeen(mid, raw?.parameters || {}).catch(() => {});
        return;
    }
    _showModal(raw);
}

async function _markSeen(memberId: string, existingParams: any): Promise<void> {
    try {
        const supabase = createClient();
        await supabase.from('profiles')
            .update({ parameters: { ...existingParams, onboarding_seen: true } })
            .ilike('member_id', memberId);
    } catch {}
}

// ─── Shared styles ────────────────────────────────────────────────────────────

function _injectStyles(): void {
    if (document.getElementById('ob-style')) return;
    const s = document.createElement('style');
    s.id = 'ob-style';
    s.textContent = `
        #onboardingOverlay * { box-sizing: border-box; }
        #onboardingOverlay input { transition: border-color .2s; }
        #onboardingOverlay input:focus { border-color: rgba(197,160,89,0.6) !important; outline: none; }
        #onboardingOverlay button { transition: opacity .15s; }
        #onboardingOverlay button:not(:disabled):active { opacity: .8; }
        .ob-gold-line { width:36px;height:1px;background:#c5a059;opacity:.35;margin-bottom:22px; }
        .ob-label { font-family:'Orbitron',sans-serif;font-size:0.42rem;letter-spacing:3px;color:rgba(197,160,89,0.55); }
        .ob-title { font-family:'Orbitron',sans-serif;font-size:0.78rem;letter-spacing:2px;color:#ffffff;line-height:1.5;margin-bottom:8px; }
        .ob-body p { margin:0 0 10px;color:rgba(255,255,255,0.45);line-height:1.75;font-size:0.95rem; }
        .ob-body .gap { height:6px; }
        .ob-btn { width:100%;padding:14px;background:linear-gradient(135deg,#c5a059,#8b6914);border:none;color:#000;font-family:'Orbitron',sans-serif;font-size:0.52rem;font-weight:700;letter-spacing:2px;cursor:pointer;border-radius:6px; }
        .ob-btn:disabled { opacity:.3;cursor:not-allowed; }
    `;
    document.head.appendChild(s);
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

function _showModal(raw: any): void {
    document.getElementById('onboardingOverlay')?.remove();
    _injectStyles();

    const overlay = document.createElement('div');
    overlay.id = 'onboardingOverlay';
    overlay.style.cssText = `
        position:fixed;inset:0;z-index:9999;
        background:rgba(4,3,2,0.97);
        display:flex;align-items:flex-start;justify-content:center;
        overflow-y:auto;
        font-family:'Rajdhani',sans-serif;
        -webkit-overflow-scrolling:touch;
    `;
    document.body.appendChild(overlay);

    const state: OBState = {
        memberId: raw?.member_id || raw?.memberId || '',
        rawParams: raw?.parameters || {},
        overlay,
        name: '',
        photoUrl: null,
        photoSelected: false,
        slideIndex: -2, // start at welcome
    };

    _renderWelcome(state);
}

// ─── Welcome screen ───────────────────────────────────────────────────────────

function _renderWelcome(state: OBState): void {
    state.overlay.innerHTML = `
        <div style="width:100%;max-width:420px;padding:52px 28px 40px;display:flex;flex-direction:column;min-height:100svh;justify-content:space-between;">

            <div class="ob-label" style="margin-bottom:0;">PRIVATE ACCESS</div>

            <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:40px 0 32px;">

                <div class="ob-label" style="margin-bottom:14px;color:rgba(197,160,89,0.8);">QUEEN KARIN</div>
                <div class="ob-title" style="font-size:1rem;margin-bottom:10px;">YOU HAVE JUST ENTERED<br>MY PRIVATE SPACE.</div>
                <div class="ob-gold-line"></div>

                <div class="ob-body">
                    <p>This is not a public platform. There is no team behind it, no support line, and no other Mistress. I built this. I run this. I am the only Dominant here.</p>
                    <p>What you are looking at is a high-precision system built specifically to track and manage submission - your kneeling, your tasks, your tributes, your obedience. All of it is logged and visible to me in real time.</p>
                    <p>This server is private. Entry is not given freely. If you are here, I have chosen to allow it.</p>
                    <p style="color:rgba(255,255,255,0.6);">I expect full obedience from every sub who enters. No exceptions. No negotiations.</p>
                </div>
            </div>

            <div>
                <button id="ob-enter" class="ob-btn">I UNDERSTAND - ENTER</button>
            </div>
        </div>
    `;

    state.overlay.querySelector('#ob-enter')?.addEventListener('click', () => {
        state.slideIndex = -1;
        _renderSetup(state);
    });
}

// ─── Setup (name + photo) ─────────────────────────────────────────────────────

function _renderSetup(state: OBState): void {
    state.overlay.innerHTML = `
        <div style="width:100%;max-width:420px;padding:52px 28px 40px;display:flex;flex-direction:column;min-height:100svh;justify-content:space-between;">

            <div class="ob-label">IDENTIFY YOURSELF</div>

            <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:32px 0 24px;">

                <div class="ob-title">BEFORE YOU GO FURTHER</div>
                <div class="ob-gold-line"></div>
                <div class="ob-body" style="margin-bottom:28px;">
                    <p>Your name and photo identify you in the Global presence feed, the leaderboard, and throughout this space. Choose a name you use in your private world - not your legal name.</p>
                </div>

                <!-- Photo -->
                <div style="margin-bottom:26px;">
                    <div style="display:flex;align-items:center;gap:7px;margin-bottom:10px;">
                        <span class="ob-label" style="letter-spacing:2px;">PHOTO</span>
                        <span style="color:#e05252;font-size:0.65rem;">required</span>
                        <span id="ob-photo-q" style="width:16px;height:16px;border-radius:50%;border:1px solid rgba(255,255,255,0.15);display:inline-flex;align-items:center;justify-content:center;font-size:0.58rem;color:rgba(255,255,255,0.3);cursor:pointer;">?</span>
                    </div>
                    <div id="ob-photo-tip" style="display:none;background:rgba(197,160,89,0.06);border:1px solid rgba(197,160,89,0.15);border-radius:6px;padding:10px 12px;font-size:0.8rem;color:rgba(255,255,255,0.4);line-height:1.55;margin-bottom:12px;">
                        Your photo is shown next to your name in the Global strip and leaderboard. Other members in this community will see it. Use something from your private world.
                    </div>
                    <div style="display:flex;align-items:center;gap:16px;">
                        <div id="ob-photo" style="width:72px;height:72px;border-radius:50%;border:1.5px solid rgba(197,160,89,0.3);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;background:rgba(197,160,89,0.03);flex-shrink:0;">
                            <i class="fas fa-camera" style="color:rgba(197,160,89,0.35);font-size:1rem;"></i>
                        </div>
                        <div>
                            <div id="ob-photo-status" style="font-size:0.82rem;color:rgba(255,255,255,0.25);margin-bottom:4px;">No photo selected</div>
                            <div style="font-size:0.75rem;color:rgba(255,255,255,0.15);">Tap the circle to upload</div>
                        </div>
                    </div>
                </div>

                <!-- Name -->
                <div>
                    <div style="display:flex;align-items:center;gap:7px;margin-bottom:10px;">
                        <span class="ob-label" style="letter-spacing:2px;">YOUR NAME</span>
                        <span style="color:#e05252;font-size:0.65rem;">required</span>
                        <span id="ob-name-q" style="width:16px;height:16px;border-radius:50%;border:1px solid rgba(255,255,255,0.15);display:inline-flex;align-items:center;justify-content:center;font-size:0.58rem;color:rgba(255,255,255,0.3);cursor:pointer;">?</span>
                    </div>
                    <div id="ob-name-tip" style="display:none;background:rgba(197,160,89,0.06);border:1px solid rgba(197,160,89,0.15);border-radius:6px;padding:10px 12px;font-size:0.8rem;color:rgba(255,255,255,0.4);line-height:1.55;margin-bottom:12px;">
                        This is how the Queen and other members will know you. It appears in the leaderboard and when you speak. Do not use your real name.
                    </div>
                    <input id="ob-name" type="text" placeholder="Enter a name..." maxlength="30" autocomplete="off" spellcheck="false"
                        style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#fff;font-family:'Rajdhani',sans-serif;font-size:1.05rem;padding:11px 14px;border-radius:6px;"
                    />
                </div>
            </div>

            <div>
                <button id="ob-continue" class="ob-btn" disabled>CONTINUE</button>
                <div style="font-size:0.7rem;color:rgba(255,255,255,0.12);text-align:center;margin-top:12px;">Both fields are required to proceed.</div>
            </div>
        </div>
    `;

    // Tooltips
    ['photo', 'name'].forEach(key => {
        state.overlay.querySelector(`#ob-${key}-q`)?.addEventListener('click', () => {
            const tip = state.overlay.querySelector(`#ob-${key}-tip`) as HTMLElement;
            if (tip) tip.style.display = tip.style.display === 'none' ? 'block' : 'none';
        });
    });

    // Photo
    const photoEl = state.overlay.querySelector('#ob-photo') as HTMLElement;
    const photoStatus = state.overlay.querySelector('#ob-photo-status') as HTMLElement;
    photoEl?.addEventListener('click', () => {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'image/*';
        inp.onchange = async () => {
            const file = inp.files?.[0];
            if (!file) return;
            const localUrl = URL.createObjectURL(file);
            photoEl.innerHTML = `<img src="${localUrl}" style="width:100%;height:100%;object-fit:cover;">`;
            photoStatus.textContent = 'Uploading...';
            photoStatus.style.color = 'rgba(197,160,89,0.6)';
            state.photoSelected = true;
            _checkSetupReady(state);
            try {
                const pub = await uploadToSupabase('media', 'avatars', file);
                state.photoUrl = pub.startsWith('failed') ? null : pub;
                photoStatus.textContent = state.photoUrl ? 'Photo ready' : 'Saved locally';
                photoStatus.style.color = state.photoUrl ? 'rgba(100,200,100,0.6)' : 'rgba(255,255,255,0.3)';
            } catch {
                state.photoUrl = null;
                photoStatus.textContent = 'Saved locally';
                photoStatus.style.color = 'rgba(255,255,255,0.3)';
            }
            _checkSetupReady(state);
        };
        inp.click();
    });

    // Name
    const nameInput = state.overlay.querySelector('#ob-name') as HTMLInputElement;
    nameInput?.addEventListener('input', () => {
        state.name = nameInput.value.trim();
        _checkSetupReady(state);
    });

    // Continue
    state.overlay.querySelector('#ob-continue')?.addEventListener('click', async () => {
        if (!state.name || !state.photoSelected) return;
        const btn = state.overlay.querySelector('#ob-continue') as HTMLButtonElement;
        btn.textContent = 'SAVING...';
        btn.disabled = true;
        try {
            if (state.memberId) {
                const supabase = createClient();
                const updates: any = { name: state.name };
                if (state.photoUrl) updates.avatar_url = state.photoUrl;
                await supabase.from('profiles').update(updates).ilike('member_id', state.memberId);
            }
        } catch {}
        state.slideIndex = 0;
        _renderSlide(state);
    });
}

function _checkSetupReady(state: OBState): void {
    const btn = state.overlay.querySelector('#ob-continue') as HTMLButtonElement;
    if (!btn) return;
    const ready = !!state.name && state.photoSelected;
    btn.disabled = !ready;
    btn.style.opacity = ready ? '1' : '0.3';
}

// ─── Slides ───────────────────────────────────────────────────────────────────

function _renderSlide(state: OBState): void {
    const slides = getSlides(state.name);
    const slide = slides[state.slideIndex];
    const isLast = state.slideIndex === slides.length - 1;
    const total = slides.length;

    const dots = slides.map((_, i) => `
        <div style="width:${i === state.slideIndex ? '20' : '6'}px;height:6px;border-radius:3px;background:${i === state.slideIndex ? '#c5a059' : 'rgba(255,255,255,0.12)'};transition:all .3s;"></div>
    `).join('');

    let bodyHtml = '';
    if (slide.body) {
        bodyHtml = slide.body.split('\n').map(l =>
            l.trim() ? `<p>${l}</p>` : `<div class="gap"></div>`
        ).join('');
    } else {
        const hallBoy = HIERARCHY_RULES.find(r => r.name === 'Hall Boy');
        const footman  = HIERARCHY_RULES.find(r => r.name === 'Footman');
        bodyHtml = `
            <div style="border:1px solid rgba(197,160,89,0.18);border-radius:6px;padding:16px;margin-bottom:12px;">
                <div class="ob-label" style="margin-bottom:12px;color:#c5a059;">CURRENT - HALL BOY</div>
                ${(hallBoy?.benefits || []).map(b => `<div style="font-size:0.85rem;color:rgba(255,255,255,0.42);margin-bottom:7px;padding-left:10px;border-left:1px solid rgba(197,160,89,0.2);">${b}</div>`).join('')}
            </div>
            <div style="border:1px solid rgba(255,255,255,0.07);border-radius:6px;padding:16px;">
                <div class="ob-label" style="margin-bottom:12px;color:rgba(255,255,255,0.22);">NEXT - FOOTMAN</div>
                ${(footman?.benefits || []).map(b => `<div style="font-size:0.85rem;color:rgba(255,255,255,0.22);margin-bottom:7px;padding-left:10px;border-left:1px solid rgba(255,255,255,0.07);">${b}</div>`).join('')}
                <div style="font-size:0.7rem;color:rgba(255,255,255,0.15);margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);">5 tasks &nbsp;·&nbsp; 10 kneels &nbsp;·&nbsp; 2,000 merit points</div>
            </div>
        `;
    }

    state.overlay.innerHTML = `
        <div style="width:100%;max-width:420px;padding:52px 28px 40px;display:flex;flex-direction:column;min-height:100svh;justify-content:space-between;">

            <div class="ob-label">${state.slideIndex + 1} / ${total}</div>

            <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:32px 0 24px;">
                <div class="ob-title">${slide.title}</div>
                <div class="ob-gold-line"></div>
                <div class="ob-body">${bodyHtml}</div>
            </div>

            <div>
                <div style="display:flex;gap:6px;margin-bottom:18px;">${dots}</div>
                <button id="ob-next" class="ob-btn">${isLast ? 'BEGIN MY SERVICE' : 'NEXT'}</button>
            </div>
        </div>
    `;

    state.overlay.querySelector('#ob-next')?.addEventListener('click', () => {
        if (isLast) _complete(state);
        else { state.slideIndex++; _renderSlide(state); }
    });
}

// ─── Complete ─────────────────────────────────────────────────────────────────

async function _complete(state: OBState): Promise<void> {
    state.overlay.style.transition = 'opacity 0.4s';
    state.overlay.style.opacity = '0';
    setTimeout(() => state.overlay.remove(), 420);
    if (state.memberId) _markSeen(state.memberId, state.rawParams).catch(() => {});
    if (state.name) {
        try {
            const { getState, setState } = await import('./profile-state');
            const raw = getState().raw || {};
            setState({ userName: state.name, raw: { ...raw, name: state.name, avatar_url: state.photoUrl || raw.avatar_url } });
            const { renderProfileSidebar } = await import('./profile-logic');
            renderProfileSidebar(getState().raw);
        } catch {}
    }
}
