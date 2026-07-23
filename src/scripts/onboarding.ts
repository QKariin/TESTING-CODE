// src/scripts/onboarding.ts
// First-visit onboarding - new users set name + photo before entering

import { createClient } from '@/utils/supabase/client';
import { uploadToSupabase } from './mediaSupabase';

if (typeof window !== 'undefined') {
    (window as any)._testOnboarding = () => _showModal({});
}

// ─── Slide content (after setup) ─────────────────────────────────────────────

interface Slide { title: string; body: string | null; }

function getSlides(name: string): Slide[] {
    return [
        {
            title: `WELCOME, ${(name || 'SLAVE').toUpperCase()}`,
            body: `I am Queen Karin. I built this place myself. Every detail, every rule, every reward. There is no one else behind it. Just me.\n\nI left coins in your wallet so you can explore everything. When you enter, tap "I'M NEW HERE, GUIDE ME" and it will show you how everything works.\n\nI will be watching. Make me proud.`,
        },
    ];
}

// Guard against React strict mode double-mount calling _showModal twice
let _onboardingActive = false;

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
    if (_onboardingActive) return; // already showing (React strict mode guard)
    if (window.location.hostname === 'localhost') return; // skip on local dev
    const forceShow = new URLSearchParams(window.location.search).get('onboarding') === '1';
    if (!forceShow && raw?.parameters?.onboarding_seen === true) return;
    if (!forceShow && ((raw?.score || 0) > 0 || (raw?.kneelCount || 0) > 0)) {
        const mid = raw?.member_id || raw?.memberId;
        if (mid) _markSeen(mid, raw?.parameters || {}).catch(() => {});
        return;
    }
    _onboardingActive = true;
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
        .ob-label { font-family:Cinzel,serif;font-size:0.42rem;letter-spacing:3px;color:rgba(197,160,89,0.55); }
        .ob-title { font-family:Cinzel,serif;font-size:0.78rem;letter-spacing:2px;color:#ffffff;line-height:1.5;margin-bottom:8px; }
        .ob-body p { margin:0 0 10px;color:rgba(255,255,255,0.45);line-height:1.75;font-size:0.95rem; }
        .ob-body .gap { height:6px; }
        .ob-btn { width:100%;padding:14px;background:linear-gradient(135deg,#c5a059,#8b6914);border:none;color:#000;font-family:Cinzel,serif;font-size:0.52rem;font-weight:700;letter-spacing:2px;cursor:pointer;border-radius:6px; }
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
        position:fixed;inset:0;z-index:2147483646;
        background:#030201;
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
        <div style="position:fixed;inset:0;background:url('/queen-bg-mobile.jpg') center 15% / cover no-repeat;opacity:0.18;pointer-events:none;"></div>
        <div style="position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;padding:48px 28px 0;">

            <div class="ob-label">PRIVATE ACCESS</div>

            <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;text-align:center;width:100%;padding-bottom:60px;">
                <div style="width:50px;height:1px;background:linear-gradient(90deg,transparent,rgba(197,160,89,0.6),transparent);"></div>
                <div style="font-family:Cinzel,serif;font-size:1.3rem;color:#c5a059;font-weight:700;letter-spacing:6px;">ONBOARDING</div>
                <div style="font-family:'Dancing Script',cursive;font-size:1.8rem;color:rgba(255,255,255,0.5);font-weight:500;line-height:1.2;">Submissive Soul</div>
                <div style="width:50px;height:1px;background:linear-gradient(90deg,transparent,rgba(197,160,89,0.6),transparent);"></div>
                <div style="height:12px;"></div>
                <button id="ob-enter" style="width:100%;max-width:420px;padding:16px;background:linear-gradient(135deg,#c5a059,#8b6914);border:none;color:#000;font-family:Cinzel,serif;font-size:0.7rem;font-weight:700;letter-spacing:3px;cursor:pointer;border-radius:6px;">I'M READY, QUEEN KARIN</button>
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
        <div style="width:100%;max-width:420px;padding:52px 28px 80px;display:flex;flex-direction:column;min-height:100svh;justify-content:space-between;">

            <div class="ob-label">IDENTIFY YOURSELF</div>

            <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 0 24px;">

                <!-- Photo — large, centered, face first -->
                <div id="ob-photo" style="width:160px;height:160px;border-radius:50%;border:2px solid rgba(197,160,89,0.35);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;background:rgba(197,160,89,0.03);margin-bottom:12px;box-shadow:0 0 30px rgba(197,160,89,0.08);">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.3)" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-7 8-7s8 3 8 7"/></svg>
                </div>
                <div id="ob-photo-status" style="font-size:0.75rem;color:rgba(255,255,255,0.2);margin-bottom:6px;">Tap to upload your photo</div>
                <div class="ob-label" style="font-size:0.35rem;margin-bottom:32px;color:rgba(255,255,255,0.12);">This is how others will see you</div>

                <!-- Name -->
                <div style="width:100%;">
                    <div class="ob-label" style="letter-spacing:2px;margin-bottom:10px;text-align:center;">CHOOSE A NAME</div>
                    <input id="ob-name" type="text" placeholder="Not your real name..." maxlength="30" autocomplete="off" spellcheck="false"
                        style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#fff;font-family:'Rajdhani',sans-serif;font-size:1.05rem;padding:11px 14px;border-radius:6px;text-align:center;"
                    />
                </div>
            </div>

            <div>
                <button id="ob-continue" class="ob-btn" disabled>CONTINUE</button>
                <div style="font-size:0.7rem;color:rgba(255,255,255,0.1);text-align:center;margin-top:12px;">Both are required.</div>
            </div>
        </div>
    `;

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

    const bodyHtml = (slide.body || '').split('\n').map(l =>
        l.trim() ? `<p style="font-size:1.05rem;line-height:1.8;color:rgba(255,255,255,0.5);margin:0 0 14px;">${l}</p>` : `<div style="height:14px;"></div>`
    ).join('');

    const avatarHtml = state.photoUrl || state.photoSelected
        ? `<div style="width:160px;height:160px;border-radius:50%;overflow:hidden;border:2px solid rgba(197,160,89,0.4);margin:0 auto 32px;box-shadow:0 0 35px rgba(197,160,89,0.15);"><img src="${state.photoUrl || ''}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.style.display='none'" /></div>`
        : '';

    state.overlay.innerHTML = `
        <div style="width:100%;max-width:420px;padding:52px 28px 80px;display:flex;flex-direction:column;min-height:100svh;justify-content:center;">

            <div style="text-align:center;margin-bottom:32px;">
                <div style="font-family:Cinzel,serif;font-size:1.4rem;letter-spacing:4px;color:#fff;font-weight:700;line-height:1.5;">${slide.title}</div>
                <div class="ob-gold-line" style="margin:18px auto 0;"></div>
            </div>

            ${avatarHtml}

            <div style="text-align:center;margin-bottom:40px;padding:0 8px;">${bodyHtml}</div>

            <div>
                <button id="ob-next" class="ob-btn" style="font-family:Cinzel,serif;font-size:0.6rem;padding:16px;">BEGIN MY SERVICE</button>
            </div>
        </div>
    `;

    state.overlay.querySelector('#ob-next')?.addEventListener('click', () => {
        _complete(state);
    });
}

// ─── Complete ─────────────────────────────────────────────────────────────────

async function _complete(state: OBState): Promise<void> {
    _onboardingActive = false;
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

        // Announce to global chat + Discord now that they've chosen their name
        try {
            await fetch('/api/welcome-announce', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memberId: state.memberId, name: state.name }),
            });
        } catch {}
    }
}
