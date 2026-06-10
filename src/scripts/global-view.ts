// src/scripts/global-view.ts
import { getState } from './profile-state';
import { createClient } from '@/utils/supabase/client';
import { getOptimizedUrl } from './media';

let currentPeriod: 'today' | 'alltime' | 'weekly' | 'monthly' = 'today';
let talkPollInterval: ReturnType<typeof setInterval> | null = null;
let presenceInterval: ReturnType<typeof setInterval> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let realtimeChannel: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let updatesChannel: any = null;

// ─── REPLY STATE ───────────────────────────────────────────────────────────────
let _glReply: { id: string; name: string; text: string } | null = null;

function _ensureGlReplyBar() {
    if (document.getElementById('globalReplyBar')) return;
    const feed = document.getElementById('globalTalkFeed');
    if (!feed) return;
    const bar = document.createElement('div');
    bar.id = 'globalReplyBar';
    bar.style.cssText = 'display:none;align-items:center;gap:10px;padding:7px 14px;background:rgba(197,160,89,0.07);border-top:1px solid rgba(197,160,89,0.18);flex-shrink:0;';
    bar.innerHTML = `
        <div style="flex:1;min-width:0;border-left:2px solid rgba(197,160,89,0.6);padding-left:8px;">
            <div id="glReplyBarName" style="font-family:Orbitron;font-size:0.33rem;color:rgba(197,160,89,0.8);letter-spacing:1px;margin-bottom:2px;"></div>
            <div id="glReplyBarText" style="font-family:Rajdhani;font-size:0.78rem;color:rgba(255,255,255,0.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
        </div>
        <button onclick="window.cancelGlReply()" style="background:none;border:none;color:rgba(255,255,255,0.35);cursor:pointer;font-size:1rem;padding:4px 6px;flex-shrink:0;line-height:1;">✕</button>`;
    feed.insertAdjacentElement('afterend', bar);
}

export function setGlReply(id: string, name: string, text: string) {
    _glReply = { id, name, text };
    _ensureGlReplyBar();
    const bar = document.getElementById('globalReplyBar');
    if (bar) bar.style.display = 'flex';
    const nameEl = document.getElementById('glReplyBarName');
    const textEl = document.getElementById('glReplyBarText');
    if (nameEl) nameEl.innerHTML = `<svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="rgba(197,160,89,0.8)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px;"><polyline points="8 16 3 11 8 6"></polyline><path d="M17 4v7a4 4 0 0 1-4 4H3"></path></svg>` + name;
    if (textEl) textEl.textContent = text.slice(0, 80);
    document.getElementById('globalTalkInput')?.focus();
}

export function cancelGlReply() {
    _glReply = null;
    const bar = document.getElementById('globalReplyBar');
    if (bar) bar.style.display = 'none';
}

const DEFAULT_AVATAR = '/collar-placeholder.png';
const MEDAL_COLORS = ['#c5a059', '#9ca3af', '#cd7f32'];
const MEDALS = ['🥇', '🥈', '🥉'];

// ─── LIKES (localStorage-based per user) ──────────────────────────────────────

const _LIKES_KEY = 'gl_liked_msgs';

function _getLikedSet(): Set<string> {
    try { return new Set(JSON.parse(localStorage.getItem(_LIKES_KEY) || '[]')); } catch { return new Set(); }
}

function _isLiked(id: string): boolean { return _getLikedSet().has(id); }

function _toggleLike(id: string): boolean {
    const s = _getLikedSet();
    const nowLiked = !s.has(id);
    if (nowLiked) s.add(id); else s.delete(id);
    try { localStorage.setItem(_LIKES_KEY, JSON.stringify([...s])); } catch {}
    return nowLiked;
}

if (typeof window !== 'undefined') {
    (window as any)._toggleGlobalLike = (id: string, btn: HTMLElement) => {
        const liked = _toggleLike(id);
        const svg = btn.querySelector('svg');
        if (svg) {
            svg.setAttribute('fill', liked ? '#e03050' : 'none');
            svg.setAttribute('stroke', liked ? '#e03050' : 'rgba(255,255,255,0.3)');
        }
        // Pop animation
        btn.style.transform = 'scale(1.3)';
        setTimeout(() => { btn.style.transform = 'scale(1)'; }, 150);
    };

    (window as any)._openGlobalLightbox = (url: string, type?: string) => {
        if (type === 'video') {
            // Collect all video URLs from the global feed for the circle strip
            const feedVideos: any[] = [];
            document.querySelectorAll('[onclick*="_openGlobalLightbox"][onclick*="video"]').forEach((el: any) => {
                const match = el.getAttribute('onclick')?.match(/_openGlobalLightbox\('([^']+)'/);
                if (match) {
                    const vidUrl = match[1].replace(/\\'/g, "'");
                    if (!feedVideos.some(v => v.media_url === vidUrl)) {
                        const bg = el.style.backgroundImage;
                        const thumbMatch = bg?.match(/url\(['"]?([^'"]+)['"]?\)/);
                        feedVideos.push({ media_url: vidUrl, thumbnail_url: thumbMatch?.[1] || null });
                    }
                }
            });
            _queenVideosList = feedVideos.length ? feedVideos : [{ media_url: url, thumbnail_url: null }];
            _playQueenVideo(url);
            return;
        }
        let lb = document.getElementById('globalChatLightbox');
        if (!lb) {
            lb = document.createElement('div');
            lb.id = 'globalChatLightbox';
            lb.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:10000002;align-items:center;justify-content:center;cursor:zoom-out;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);';
            lb.innerHTML = '<div id="globalChatLightboxMedia" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;padding:20px;box-sizing:border-box;"></div>';
            lb.addEventListener('click', (e) => {
                if (e.target === lb || e.target === document.getElementById('globalChatLightboxMedia')) {
                    lb!.style.display = 'none';
                }
            });
            document.body.appendChild(lb);
        }
        const media = document.getElementById('globalChatLightboxMedia');
        if (media) {
            media.innerHTML = `<img src="${url}" style="max-width:94vw;max-height:92vh;object-fit:contain;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,0.8);" />`;
        }
        lb.style.display = 'flex';
    };
}

// ─── OPEN / CLOSE ─────────────────────────────────────────────────────────────

export function openGlobalView() {
    const ov = document.getElementById('globalViewOverlay');
    if (!ov) return;
    ov.style.display = 'flex';
    _showMain();
}

export function closeGlobalView() {
    const ov = document.getElementById('globalViewOverlay');
    if (ov) ov.style.display = 'none';
    _stopPoll();
    _stopUpdatesRealtime();
    _pauseAllVideos();
}

export function closeGlobalSection() { _showMain(); }

// ─── MAIN VIEW ────────────────────────────────────────────────────────────────

function _showMain() {
    _stopPoll();
    _pauseAllVideos();
    _setHeader('', false);
    const main = document.getElementById('globalMainView');
    if (main) main.style.display = 'grid';
    _hidePanels();
    _loadAllPreviews();
}

function _hidePanels() {
    ['leaderboard', 'talk', 'updates', 'spenders', 'queen', 'exchequer'].forEach(s => {
        const p = document.getElementById(`gPanel_${s}`);
        if (p) p.style.display = 'none';
    });
}

function _setHeader(crumb: string, showBack: boolean) {
    const c = document.getElementById('globalBreadcrumb');
    const b = document.getElementById('globalBackBtn');
    if (c) c.textContent = crumb;
    if (b) b.style.display = showBack ? 'inline-flex' : 'none';
}

function _stopPoll() {
    if (talkPollInterval) { clearInterval(talkPollInterval); talkPollInterval = null; }
    if (presenceInterval) { clearInterval(presenceInterval); presenceInterval = null; }
    if (realtimeChannel) { realtimeChannel.unsubscribe(); realtimeChannel = null; }
    if (updatesChannel) { updatesChannel.unsubscribe(); updatesChannel = null; }
}

function _stopUpdatesRealtime() {
    if (updatesChannel) { updatesChannel.unsubscribe(); updatesChannel = null; }
}

/** Pause all playing videos in the global view overlay. */
function _pauseAllVideos() {
    const ov = document.getElementById('globalViewOverlay');
    if (!ov) return;
    ov.querySelectorAll('video').forEach(v => { v.pause(); });
}

// ─── OPEN EXPANDED ────────────────────────────────────────────────────────────

export function openGlobalSection(section: 'leaderboard' | 'talk' | 'updates' | 'spenders' | 'queen' | 'exchequer') {
    _stopPoll();
    _pauseAllVideos();
    const main = document.getElementById('globalMainView');
    if (main) main.style.display = 'none';
    _hidePanels();
    const labels: Record<string, string> = { leaderboard: 'LEADERBOARD', talk: 'COMMUNITY TALK', updates: 'UPDATES', spenders: 'BEST SPENDERS', queen: 'QUEEN KARIN', exchequer: 'ROYAL EXCHEQUER' };
    _setHeader(`GLOBAL  ›  ${labels[section] || section.toUpperCase()}`, true);
    const panel = document.getElementById(`gPanel_${section}`);
    if (panel) panel.style.display = 'flex';
    if (section === 'leaderboard') loadLeaderboard(currentPeriod);
    if (section === 'talk') { _initTalkRealtime(); }
    if (section === 'updates') { _loadUpdatesFull(); _initUpdatesRealtime(); }
    if (section === 'spenders') _loadSpendersFull();
    if (section === 'queen') _loadQueenFull();
}

// ─── LOAD ALL PREVIEWS ────────────────────────────────────────────────────────

function _loadAllPreviews() {
    loadLeaderboardPreview(currentPeriod);
    // Fetch sidepanels ONCE - share result with mini-panels + spenders preview
    _loadSidePanelsAndSpenders();
    _initTalkRealtime();
    _loadUpdatesPreview();
    _initUpdatesRealtime();
    _loadQueenPreview();
    _loadChallengesPreview();
}

async function _loadSidePanelsAndSpenders() {
    try {
        const res = await fetch('/api/global/sidepanels');
        const { kneelers, spenders, streakers } = await res.json();
        _renderMiniPanel('lbMini_kneelers', kneelers, (e: any) => `${e.count}✦`, 'rgba(74,222,128,0.7)');
        _renderMiniPanel('lbMini_spenders', spenders, (e: any) => `${e.amount.toLocaleString()}`, '#c5a059');
        _renderMiniPanel('lbMini_streakers', streakers, (e: any) => `${e.streak}d`, 'rgba(255,140,100,0.85)');
        // Also populate spenders preview without a second fetch
        const el = document.getElementById('globalPreview_spenders');
        if (el && spenders?.length) {
            el.innerHTML = spenders.slice(0, 3).map((e: any, i: number) => {
                const avatarSrc = e.avatar || DEFAULT_AVATAR;
                return `
                <div style="display:flex;align-items:center;gap:8px;padding:7px 12px;border-bottom:1px solid rgba(255,255,255,0.04);transition:background 0.12s;"
                     onmouseenter="this.style.background='rgba(197,160,89,0.05)'"
                     onmouseleave="this.style.background='transparent'">
                    <span style="font-size:${i < 3 ? '0.85rem' : '0.5rem'};width:18px;text-align:center;flex-shrink:0;">${MEDALS[i]}</span>
                    <div style="width:26px;height:26px;border-radius:50%;overflow:hidden;flex-shrink:0;border:1.5px solid ${i === 0 ? '#c5a059' : 'rgba(255,255,255,0.1)'};">
                        <img src="${avatarSrc}" style="width:100%;height:100%;object-fit:cover;display:block;" loading="lazy" onerror="this.src='${DEFAULT_AVATAR}'">
                    </div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-family:'Orbitron';font-size:0.6rem;color:rgba(255,255,255,${i === 0 ? '1' : '0.65'});white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:${i === 0 ? 700 : 400};">${e.name}</div>
                        <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(197,160,89,0.45);letter-spacing:1px;margin-top:1px;">${e.hierarchy}</div>
                    </div>
                    <div style="font-family:'Orbitron';font-size:0.58rem;color:${i === 0 ? '#c5a059' : 'rgba(255,255,255,0.35)'};font-weight:700;flex-shrink:0;">${(e.amount || 0).toLocaleString()}</div>
                </div>`;
            }).join('');
        }
    } catch {}
}

// ─── LEADERBOARD PREVIEW ─────────────────────────────────────────────────────

export async function loadLeaderboardPreview(period: 'today' | 'alltime' | 'weekly' | 'monthly' = 'today') {
    currentPeriod = period;

    ['today', 'weekly', 'monthly', 'alltime'].forEach(p => {
        const chip = document.getElementById(`lbChip_${p}`);
        if (!chip) return;
        const active = p === period;
        chip.style.background = active ? 'rgba(197,160,89,0.18)' : 'transparent';
        chip.style.color = active ? '#c5a059' : 'rgba(255,255,255,0.3)';
        chip.style.borderColor = active ? 'rgba(197,160,89,0.4)' : 'rgba(255,255,255,0.07)';
    });

    const el = document.getElementById('globalPreview_leaderboard');
    if (!el) return;
    el.innerHTML = `<div style="text-align:center;padding:30px;font-family:'Orbitron';font-size:0.5rem;color:rgba(255,255,255,0.2);">LOADING...</div>`;

    try {
        const res = await fetch(`/api/global/leaderboard?period=${period}`);
        const { entries } = await res.json();

        if (!entries?.length) {
            el.innerHTML = `<div style="text-align:center;padding:40px 20px;font-family:'Orbitron';font-size:0.5rem;color:rgba(255,255,255,0.15);">NO DATA YET</div>`;
            return;
        }

        const top3 = entries.slice(0, 3);
        const rest = entries.slice(3, 10);
        // podium order: #2 left, #1 center, #3 right
        const podiumOrder = [1, 0, 2];
        const podiumHeights = ['44px', '28px', '28px']; // base bar heights: #1 tallest
        const avatarSizes = ['52px', '38px', '38px'];

        const podium = `
        <div style="display:flex;justify-content:center;align-items:flex-end;gap:6px;padding:14px 10px 0;flex-shrink:0;">
            ${podiumOrder.map(i => {
                const e = top3[i];
                if (!e) return `<div style="flex:1;"></div>`;
                const avatarSrc = e.avatar || DEFAULT_AVATAR;
                const isFirst = i === 0;
                return `
                <div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:0;">
                    ${isFirst ? `<div style="font-size:0.85rem;margin-bottom:2px;line-height:1;">👑</div>` : `<div style="font-size:0.75rem;margin-bottom:2px;line-height:1;">${MEDALS[i]}</div>`}
                    <div style="width:${avatarSizes[i]};height:${avatarSizes[i]};border-radius:50%;overflow:hidden;border:2px solid ${MEDAL_COLORS[i]};box-shadow:0 0 ${isFirst ? '14px' : '8px'} ${MEDAL_COLORS[i]}55;margin-bottom:5px;flex-shrink:0;">
                        <img src="${avatarSrc}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.src='${DEFAULT_AVATAR}'">
                    </div>
                    <div style="font-family:'Orbitron';font-size:${isFirst ? '0.58rem' : '0.5rem'};color:#fff;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;padding:0 2px;font-weight:${isFirst ? 700 : 400};line-height:1.2;">${e.name}</div>
                    <div style="font-family:'Orbitron';font-size:0.32rem;color:${MEDAL_COLORS[i]};margin-top:1px;letter-spacing:0.5px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;padding:0 2px;">${e.hierarchy}</div>
                    <div style="font-family:'Orbitron';font-size:${isFirst ? '0.72rem' : '0.58rem'};color:${MEDAL_COLORS[i]};margin-top:3px;font-weight:700;">${(e.score || 0).toLocaleString()}</div>
                    <div style="font-family:'Orbitron';font-size:0.3rem;color:rgba(255,255,255,0.25);letter-spacing:1px;margin-bottom:5px;">pts</div>
                    <div style="background:${MEDAL_COLORS[i]};width:100%;height:${podiumHeights[i]};border-radius:5px 5px 0 0;display:flex;align-items:center;justify-content:center;">
                        <span style="font-family:'Orbitron';font-size:0.7rem;color:#000;font-weight:900;">${i + 1}</span>
                    </div>
                </div>`;
            }).join('')}
        </div>`;

        const rows = rest.map((e: any, i: number) => {
            const avatarSrc = e.avatar || DEFAULT_AVATAR;
            const rank = i + 4;
            return `
            <div style="display:flex;align-items:center;gap:8px;padding:5px 12px;border-bottom:1px solid rgba(255,255,255,0.04);transition:background 0.12s;"
                 onmouseenter="this.style.background='rgba(197,160,89,0.05)'"
                 onmouseleave="this.style.background='transparent'">
                <div style="font-family:'Orbitron';font-size:0.45rem;color:rgba(255,255,255,0.25);width:16px;text-align:right;flex-shrink:0;">${rank}</div>
                <div style="width:26px;height:26px;border-radius:50%;overflow:hidden;flex-shrink:0;border:1px solid rgba(255,255,255,0.1);">
                    <img src="${avatarSrc}" style="width:100%;height:100%;object-fit:cover;display:block;" loading="lazy" onerror="this.src='${DEFAULT_AVATAR}'">
                </div>
                <div style="flex:1;min-width:0;">
                    <div style="font-family:'Orbitron';font-size:0.55rem;color:rgba(255,255,255,0.8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2;">${e.name}</div>
                    <div style="font-family:'Orbitron';font-size:0.32rem;color:rgba(197,160,89,0.4);letter-spacing:0.5px;">${e.hierarchy}</div>
                </div>
                <div style="font-family:'Orbitron';font-size:0.5rem;color:rgba(255,255,255,0.4);font-weight:700;flex-shrink:0;">${(e.score || 0).toLocaleString()}</div>
            </div>`;
        }).join('');

        el.innerHTML = podium + (rows ? `<div style="border-top:1px solid rgba(197,160,89,0.1);">${rows}</div>` : '');
    } catch {
        el.innerHTML = `<div style="text-align:center;padding:30px;font-family:'Orbitron';font-size:0.5rem;color:#ff4444;">FAILED</div>`;
    }
}

// ─── SIDE PANELS inside leaderboard (kneelers / spenders / streakers) ────────
// Note: on initial load these are populated by _loadSidePanelsAndSpenders() above.
// This standalone version is kept only for manual refresh calls.

function _renderMiniPanel(elId: string, entries: any[], valueLabel: (e: any) => string, accentColor: string) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (!entries?.length) {
        el.innerHTML = `<div style="padding:8px 10px;font-family:'Orbitron';font-size:0.35rem;color:rgba(255,255,255,0.15);text-align:center;">-</div>`;
        return;
    }
    el.innerHTML = entries.slice(0, 3).map((e: any, i: number) => {
        const avatarSrc = e.avatar || DEFAULT_AVATAR;
        return `
        <div style="display:flex;align-items:center;gap:6px;padding:5px 10px;border-bottom:1px solid rgba(255,255,255,0.03);">
            <span style="font-size:0.7rem;line-height:1;flex-shrink:0;">${MEDALS[i]}</span>
            <div style="width:20px;height:20px;border-radius:50%;overflow:hidden;flex-shrink:0;border:1px solid ${i === 0 ? accentColor : 'rgba(255,255,255,0.08)'};">
                <img src="${avatarSrc}" style="width:100%;height:100%;object-fit:cover;display:block;" loading="lazy" onerror="this.src='${DEFAULT_AVATAR}'">
            </div>
            <div style="font-family:'Orbitron';font-size:0.52rem;color:rgba(255,255,255,${i === 0 ? '0.9' : '0.55'});white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;font-weight:${i === 0 ? '700' : '400'};">${e.name}</div>
            <div style="font-family:'Orbitron';font-size:0.42rem;color:${i === 0 ? accentColor : 'rgba(255,255,255,0.35)'};font-weight:700;flex-shrink:0;">${valueLabel(e)}</div>
        </div>`;
    }).join('');
}

// ─── TALK PREVIEW ─────────────────────────────────────────────────────────────

async function _loadTalkPreview() {
    const el = document.getElementById('globalPreview_talk');
    if (!el) return;
    try {
        const res = await fetch('/api/global/messages');
        const data = await res.json();
        const msgs = (data.messages || []).slice(-4);
        if (!msgs.length) {
            el.innerHTML = `<div style="text-align:center;padding:24px;font-family:'Orbitron';font-size:0.48rem;color:rgba(255,255,255,0.15);">NO MESSAGES YET</div>`;
            return;
        }
        el.innerHTML = msgs.map((m: any) => {
            const name = m.sender_name || 'SUBJECT';
            const initial = name[0].toUpperCase();
            return `
            <div style="display:flex;align-items:flex-start;gap:7px;padding:6px 12px;border-bottom:1px solid rgba(255,255,255,0.03);">
                <div style="width:22px;height:22px;border-radius:50%;background:rgba(197,160,89,0.12);border:1px solid rgba(197,160,89,0.22);display:flex;align-items:center;justify-content:center;font-family:'Orbitron';font-size:0.5rem;color:#c5a059;flex-shrink:0;">${initial}</div>
                <div style="flex:1;min-width:0;">
                    <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(197,160,89,0.55);letter-spacing:1px;margin-bottom:2px;">${name}</div>
                    <div style="font-family:'Rajdhani';font-size:0.78rem;color:rgba(255,255,255,0.65);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${
                        (m.message||'').startsWith('PROMOTION_CARD::') ? 'RANK PROMOTION' :
                        (m.message||'').startsWith('CHALLENGE_JOIN_CARD::') ? 'JOINED CHALLENGE' :
                        (m.message||'').startsWith('CHALLENGE_ELIM_CARD::') ? 'ELIMINATED' :
                        (m.message||'').startsWith('CHALLENGE_INVITE_CARD::') ? 'CHALLENGE INVITE' :
                        (m.message||'').startsWith('WELCOME_CARD::') ? 'NEW TRIBUTE' :
                        (m.message||'').startsWith('UPDATE_COINS_CARD::') ? 'COINS EARNED' :
                        (m.message||'').startsWith('UPDATE_MERIT_CARD::') ? 'MERIT EARNED' :
                        (m.message||'').startsWith('LEADERBOARD_REWARD_CARD::') ? 'LEADERBOARD CHAMPION' :
                        m.message}</div>
                </div>
            </div>`;
        }).join('');
    } catch {}
}

// ─── UPDATES PREVIEW ─────────────────────────────────────────────────────────

async function _loadUpdatesPreview() {
    const el = document.getElementById('globalPreview_updates');
    if (!el) return;
    try {
        const res = await fetch('/api/global/updates');
        const data = await res.json();
        const updates = (data.updates || []).slice(0, 10);
        if (!updates.length) {
            el.innerHTML = `<div style="text-align:center;padding:24px;font-family:'Orbitron';font-size:0.48rem;color:rgba(255,255,255,0.15);">NO UPDATES YET</div>`;
            return;
        }
        el.innerHTML = updates.map((u: any) => _buildUpdateCardPreview(u)).join('');
    } catch {}
}

function _buildUpdateCardPreview(u: any): string {
    if (u.kind === 'tribute') {
        const coverSrc = u.image || '';
        const priceVal = u.price ? Number(u.price).toLocaleString() : '';
        return `<div style="margin:6px 8px;border-radius:12px;overflow:hidden;background:#0a0a14;border:1px solid rgba(197,160,89,0.4);box-shadow:0 6px 24px rgba(0,0,0,0.5);">
            <div style="width:100%;height:120px;background-image:url('${coverSrc}');background-size:cover;background-position:center;position:relative;">
                ${priceVal ? `<div style="position:absolute;top:7px;right:8px;background:rgba(10,7,3,0.85);border:1px solid rgba(197,160,89,0.5);border-radius:20px;padding:3px 10px;font-family:'Orbitron',sans-serif;font-size:0.38rem;color:#c5a059;display:flex;align-items:center;gap:5px;letter-spacing:1px;"><i class="fas fa-coins"></i> ${priceVal}</div>` : ''}
            </div>
            <div style="padding:10px 14px 14px;">
                <div style="font-family:'Orbitron',sans-serif;font-size:0.45rem;color:rgba(197,160,89,0.7);letter-spacing:2px;margin-bottom:4px;">✦ Gift Sent</div>
                <div style="font-family:'Cinzel',serif;font-size:0.85rem;color:#fff;font-weight:700;letter-spacing:1px;">${u.title}</div>
                <div style="font-family:'Orbitron',sans-serif;font-size:0.38rem;color:rgba(255,255,255,0.35);margin-top:6px;">${u.sender_name}</div>
            </div>
        </div>`;
    }
    if (u.kind === 'points') {
        const time = new Date(u.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const initial = (u.sender_name || 'S')[0].toUpperCase();
        const avHtml = u.sender_avatar
            ? `<img src="${u.sender_avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
            : '';
        return `<div style="background:rgba(167,139,250,0.05);border:1px solid rgba(167,139,250,0.25);border-radius:12px;padding:10px 12px;display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;">
            <div style="width:36px;height:36px;border-radius:50%;background:rgba(167,139,250,0.1);border:1.5px solid rgba(167,139,250,0.35);overflow:hidden;position:relative;flex-shrink:0;">
                ${avHtml}
                <div style="display:${u.sender_avatar ? 'none' : 'flex'};position:absolute;inset:0;align-items:center;justify-content:center;font-family:'Orbitron';font-size:0.6rem;color:#a78bfa;">${initial}</div>
            </div>
            <div style="flex:1;min-width:0;">
                <div style="font-family:'Orbitron';font-size:0.36rem;color:rgba(255,255,255,0.3);letter-spacing:1px;">⚡ MERIT EARNED</div>
                <div style="font-family:'Orbitron';font-size:0.7rem;color:#fff;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${u.sender_name}</div>
                <div style="font-family:'Orbitron';font-size:0.7rem;color:#a78bfa;font-weight:700;">+${u.points} MERIT</div>
            </div>
            <div style="font-family:'Orbitron';font-size:0.35rem;color:rgba(255,255,255,0.2);flex-shrink:0;align-self:flex-start;">${time}</div>
        </div>`;
    }
    // photo
    const time = new Date(u.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `<div style="background:#0a0a14;border:1px solid rgba(197,160,89,0.15);border-radius:10px;overflow:hidden;position:relative;width:100%;"
        onmouseenter="this.querySelector('.uinfo').style.opacity='1'"
        onmouseleave="this.querySelector('.uinfo').style.opacity='0'">
        <img src="${getOptimizedUrl(u.media_url, 300)}" style="width:100%;height:90px;object-fit:cover;display:block;" loading="lazy">
        <div class="uinfo" style="position:absolute;bottom:0;left:0;right:0;padding:6px 8px;background:linear-gradient(transparent,rgba(0,0,0,0.88));opacity:0;transition:opacity 0.15s;">
            <div style="font-family:'Orbitron';font-size:0.55rem;color:#fff;">${u.sender_name} <span style="font-family:'Orbitron';font-size:0.32rem;color:rgba(255,255,255,0.3);">${time}</span></div>
        </div>
    </div>`;
}

// ─── SPENDERS PREVIEW ────────────────────────────────────────────────────────
// Populated by _loadSidePanelsAndSpenders() on initial load - no separate fetch needed.

// ─── QUEEN PREVIEW ────────────────────────────────────────────────────────────

async function _loadQueenPreview() {
    const el = document.getElementById('globalPreview_queen');
    if (!el) return;
    try {
        const res = await fetch('/api/global/queen');
        const data = await res.json();
        el.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:12px;text-align:center;gap:8px;">
                <div style="width:52px;height:52px;border-radius:50%;overflow:hidden;border:2px solid rgba(197,160,89,0.5);box-shadow:0 0 16px rgba(197,160,89,0.2);">
                    <img src="/queen-nav.png" style="width:100%;height:100%;object-fit:cover;">
                </div>
                <div>
                    <div style="font-family:'Orbitron';font-size:0.8rem;color:#c5a059;font-weight:700;letter-spacing:2px;">Queen Karin</div>
                    <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.3);letter-spacing:2px;margin-top:2px;">SUPREME AUTHORITY</div>
                </div>
                <div style="display:flex;gap:12px;margin-top:4px;">
                    <div style="text-align:center;">
                        <div style="font-family:'Orbitron';font-size:0.75rem;color:#fff;font-weight:700;">${data.totalSubjects ?? '-'}</div>
                        <div style="font-family:'Orbitron';font-size:0.35rem;color:rgba(255,255,255,0.3);letter-spacing:1px;margin-top:1px;">SUBJECTS</div>
                    </div>
                    <div style="width:1px;background:rgba(255,255,255,0.1);"></div>
                    <div style="text-align:center;">
                        <div style="font-family:'Orbitron';font-size:0.75rem;color:#c5a059;font-weight:700;">${(data.totalTribute || 0).toLocaleString()}</div>
                        <div style="font-family:'Orbitron';font-size:0.35rem;color:rgba(255,255,255,0.3);letter-spacing:1px;margin-top:1px;">TRIBUTE</div>
                    </div>
                </div>
            </div>`;
    } catch {}
}

// ─── QUICK SEND (from TALK panel main view) ───────────────────────────────────

export async function sendGlobalQuickMessage() {
    const input = document.getElementById('globalQuickInput') as HTMLInputElement;
    if (!input) return;
    const message = input.value.trim();
    if (!message) return;
    const raw = getState().raw;
    const senderEmail = raw?.member_id || raw?.email;
    if (!senderEmail) return;
    input.value = '';
    input.placeholder = 'Sending...';
    try {
        await fetch('/api/global/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, senderEmail }),
        });
        await _loadTalkPreview();
    } finally {
        input.placeholder = 'Quick message...';
    }
}

export function handleGlobalQuickKey(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); sendGlobalQuickMessage(); }
}

// ─── FULL LEADERBOARD ─────────────────────────────────────────────────────────

export async function loadLeaderboard(period: 'today' | 'alltime' | 'weekly' | 'monthly') {
    currentPeriod = period;
    ['today', 'weekly', 'monthly', 'alltime'].forEach(p => {
        const btn = document.getElementById(`lbPeriod_${p}`);
        if (!btn) return;
        const a = p === period;
        btn.style.background = a ? 'rgba(197,160,89,0.18)' : 'transparent';
        btn.style.color = a ? '#c5a059' : 'rgba(255,255,255,0.35)';
        btn.style.borderColor = a ? 'rgba(197,160,89,0.45)' : 'rgba(255,255,255,0.08)';
    });

    const list = document.getElementById('leaderboardList');
    if (!list) return;
    list.innerHTML = `<div style="text-align:center;padding:40px;font-family:'Orbitron';font-size:0.55rem;color:rgba(255,255,255,0.25);">LOADING...</div>`;

    try {
        const res = await fetch(`/api/global/leaderboard?period=${period}`);
        const { entries } = await res.json();
        _renderFullLeaderboard(entries || [], period);
    } catch {
        list.innerHTML = `<div style="text-align:center;padding:40px;font-family:'Orbitron';font-size:0.55rem;color:#ff4444;">FAILED TO LOAD</div>`;
    }
}

function _renderFullLeaderboard(entries: any[], period: string) {
    const list = document.getElementById('leaderboardList');
    if (!list) return;
    if (!entries.length) {
        list.innerHTML = `<div style="text-align:center;padding:80px;font-family:'Orbitron';font-size:0.6rem;color:rgba(255,255,255,0.18);">NO DATA YET</div>`;
        return;
    }

    const top3 = entries.slice(0, 3);
    const rest = entries.slice(3);
    const pHeights = ['80px', '56px', '56px'];
    const order = [1, 0, 2];

    const podium = `
        <div style="display:flex;justify-content:center;align-items:flex-end;gap:12px;padding:28px 16px 0;margin-bottom:28px;">
            ${order.map(i => {
                const e = top3[i]; if (!e) return '';
                const avatarSrc = e.avatar || DEFAULT_AVATAR;
                return `
                <div style="display:flex;flex-direction:column;align-items:center;width:${i === 0 ? '130px' : '110px'};">
                    <div style="font-size:${i === 0 ? '2rem' : '1.4rem'};margin-bottom:6px;">${MEDALS[i]}</div>
                    <div style="width:${i === 0 ? '60px' : '48px'};height:${i === 0 ? '60px' : '48px'};border-radius:50%;overflow:hidden;border:2.5px solid ${MEDAL_COLORS[i]};box-shadow:0 0 16px ${MEDAL_COLORS[i]}55;margin-bottom:8px;">
                        <img src="${avatarSrc}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.src='${DEFAULT_AVATAR}'">
                    </div>
                    <div style="font-family:'Orbitron';font-size:${i === 0 ? '0.78rem' : '0.65rem'};color:#fff;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;font-weight:${i === 0 ? 700 : 400};">${e.name}</div>
                    <div style="font-family:'Orbitron';font-size:0.4rem;color:${MEDAL_COLORS[i]};margin-top:2px;letter-spacing:1px;">${e.hierarchy}</div>
                    <div style="font-family:'Orbitron';font-size:${i === 0 ? '1.1rem' : '0.85rem'};color:${MEDAL_COLORS[i]};margin-top:6px;font-weight:700;">${(e.score || 0).toLocaleString()}</div>
                    <div style="font-family:'Orbitron';font-size:0.35rem;color:rgba(255,255,255,0.3);letter-spacing:1px;">pts</div>
                    <div style="margin-top:8px;background:${MEDAL_COLORS[i]};width:100%;height:${pHeights[i]};border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:center;">
                        <span style="font-family:'Orbitron';font-size:0.9rem;color:#000;font-weight:900;">${i + 1}</span>
                    </div>
                </div>`;
            }).join('')}
        </div>`;

    const rows = rest.map((e: any, i: number) => {
        const avatarSrc = e.avatar || DEFAULT_AVATAR;
        return `
        <div style="display:flex;align-items:center;gap:14px;padding:12px 24px;border-bottom:1px solid rgba(255,255,255,0.04);transition:background 0.12s;"
             onmouseenter="this.style.background='rgba(197,160,89,0.04)'"
             onmouseleave="this.style.background='transparent'">
            <div style="font-family:'Orbitron';font-size:0.6rem;color:rgba(255,255,255,0.22);width:24px;text-align:right;flex-shrink:0;">${i + 4}</div>
            <div style="width:38px;height:38px;border-radius:50%;overflow:hidden;flex-shrink:0;border:1.5px solid rgba(255,255,255,0.1);">
                <img src="${avatarSrc}" style="width:100%;height:100%;object-fit:cover;display:block;" loading="lazy" onerror="this.src='${DEFAULT_AVATAR}'">
            </div>
            <div style="flex:1;min-width:0;">
                <div style="font-family:'Orbitron';font-size:0.72rem;color:rgba(255,255,255,0.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e.name}</div>
                <div style="font-family:'Orbitron';font-size:0.42rem;color:rgba(197,160,89,0.5);margin-top:1px;letter-spacing:1px;">${e.hierarchy}</div>
            </div>
            <div style="text-align:right;">
                <div style="font-family:'Orbitron';font-size:0.72rem;color:rgba(255,255,255,0.5);font-weight:700;">${(e.score || 0).toLocaleString()}</div>
                <div style="font-family:'Orbitron';font-size:0.35rem;color:rgba(255,255,255,0.22);letter-spacing:1px;">pts</div>
            </div>
        </div>`;
    }).join('');

    list.innerHTML = podium + (rows ? `<div>${rows}</div>` : '');
}

// ─── FULL TALK ─────────────────────────────────────────────────────────────────

export async function loadTalkFull(scrollBottom = true) { await _fetchAndRenderMessages(scrollBottom); }

// ─── REALTIME INIT ────────────────────────────────────────────────────────────

function _initTalkRealtime() {
    // Initial load
    _fetchAndRenderMessages(true);
    _fetchAndRenderOnline();

    // Realtime subscription on global_messages
    realtimeChannel = createClient()
        .channel('global_messages_channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'global_messages' },
            (payload: any) => {
                const content = payload.new?.message || '';
                if (content.startsWith('UPDATE_COINS_CARD::') || content.startsWith('UPDATE_MERIT_CARD::')) return;
                const raw = getState().raw;
                const myEmail = (raw?.member_id || raw?.email || '').toLowerCase();
                // Skip own messages - already shown optimistically on send
                if (myEmail && (payload.new?.sender_email || '').toLowerCase() === myEmail) return;
                // Strip email before passing to renderer
                const { sender_email: _stripped, ...safeMsg } = payload.new || {};
                _appendMessage(safeMsg);
            }
        )
        .subscribe();

    // Online list loaded once on open - no interval needed.
    // Presence is tracked via Supabase Realtime (profile page track()), not DB heartbeats.
}

// ─── FETCH MESSAGES ───────────────────────────────────────────────────────────

async function _fetchAndRenderMessages(scrollBottom: boolean) {
    try {
        const res = await fetch('/api/global/messages');
        const { messages } = await res.json();
        _renderMessages(messages || [], scrollBottom);
    } catch {}
}

// ─── APPEND A SINGLE NEW MESSAGE (realtime) ───────────────────────────────────

function _appendMessage(msg: any) {
    const feed = document.getElementById('globalTalkFeed');
    if (!feed) return;
    const raw = getState().raw;
    const myName = raw?.name || raw?.member_id?.split('@')[0] || '';
    const myEmail = ((raw?.member_id || raw?.email || '') as string).toLowerCase();
    const wasNear = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 100;
    const el = document.createElement('div');
    el.innerHTML = _buildBubble(msg, myName, myEmail);
    feed.appendChild(el.firstElementChild!);
    if (wasNear) feed.scrollTop = feed.scrollHeight;
}

// ─── RENDER ALL MESSAGES ──────────────────────────────────────────────────────

function _renderMessages(messages: any[], scrollBottom: boolean) {
    const feed = document.getElementById('globalTalkFeed');
    if (!feed) return;
    messages = messages.filter(m => {
        const c = m.message || '';
        return !c.startsWith('UPDATE_COINS_CARD::') && !c.startsWith('UPDATE_MERIT_CARD::');
    });
    const raw = getState().raw;
    const myName = raw?.name || raw?.member_id?.split('@')[0] || '';
    const myEmail = ((raw?.member_id || raw?.email || '') as string).toLowerCase();
    if (!messages.length) {
        feed.innerHTML = `<div style="text-align:center;padding:60px 20px;font-family:'Orbitron';font-size:0.6rem;color:rgba(255,255,255,0.18);letter-spacing:3px;">BE THE FIRST TO SPEAK</div>`;
        return;
    }
    const wasNear = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 100;
    feed.innerHTML = messages.map(m => _buildBubble(m, myName, myEmail)).join('');
    if (scrollBottom || wasNear) {
        // Double-RAF + timeout to ensure scroll after full paint and image loads
        requestAnimationFrame(() => {
            feed.scrollTop = feed.scrollHeight;
            requestAnimationFrame(() => { feed.scrollTop = feed.scrollHeight; });
        });
        setTimeout(() => { feed.scrollTop = feed.scrollHeight; }, 300);
    }
}

function _buildBubble(msg: any, myName: string, myEmail: string = ''): string {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const isMe = msg.is_me === true ||
        (!!myEmail && (msg.sender_email || '').toLowerCase() === myEmail) ||
        (!!myName && msg.sender_name === myName);
    const isQueen = msg.is_queen === true || msg.sender_name === 'QUEEN KARIN';
    const content = msg.message || '';
    const time = new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgId = String(msg.id || '');
    const name = msg.sender_name || 'SUBJECT';
    const av = msg.sender_avatar;
    const senderNameSafe = name.replace(/'/g, '&#39;').replace(/\\/g, '\\\\');
    const contentSafe = content.slice(0, 80).replace(/'/g, '&#39;').replace(/\\/g, '\\\\').replace(/\n/g, ' ');
    const SVG_REPLY = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path></svg>`;
    const SVG_CROWN = `<svg width="13" height="10" viewBox="0 0 26 20" fill="#c5a059" style="flex-shrink:0;"><path d="M2 18 L5 8 L10 13 L13 3 L16 13 L21 8 L24 18 Z"/><rect x="2" y="17" width="22" height="2" rx="1"/></svg>`;
    const replyBtn = msgId ? `<button class="gl-reply-btn" onclick="event.stopPropagation();window.setGlReply('${msgId}','${senderNameSafe}','${contentSafe}')" title="Reply">${SVG_REPLY}</button>` : '';
    const quoteHtml = msg.reply_to ? `<div style="border-left:2px solid rgba(197,160,89,0.5);padding:3px 8px;margin-bottom:5px;background:rgba(197,160,89,0.05);border-radius:0 4px 4px 0;">
        <div style="display:flex;align-items:center;gap:4px;font-family:'Orbitron';font-size:0.3rem;color:rgba(197,160,89,0.7);letter-spacing:1px;margin-bottom:2px;"><svg width="9" height="9" viewBox="0 0 20 20" fill="none" stroke="rgba(197,160,89,0.7)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 16 3 11 8 6"></polyline><path d="M17 4v7a4 4 0 0 1-4 4H3"></path></svg><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${(msg.reply_to.sender_name || '').replace(/</g, '&lt;')}</span></div>
        <div style="font-family:'Rajdhani';font-size:0.78rem;color:rgba(255,255,255,0.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${(msg.reply_to.content || '').slice(0, 60).replace(/</g, '&lt;')}</div>
    </div>` : '';

    // ── Stream Live Card ──
    if (content.startsWith('STREAM_LIVE::')) {
        return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:8px;">
            <div style="width:70%;min-width:260px;max-width:480px;">
                <div style="width:100%;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0a0205 0%,#0e0308 60%,#080103 100%);border:1px solid rgba(239,68,68,0.4);box-shadow:0 12px 40px rgba(239,68,68,0.1),0 0 0 1px rgba(0,0,0,0.8);">
                    <div style="position:relative;width:100%;height:140px;background:#080103;overflow:hidden;">
                        <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(239,68,68,0.06),rgba(197,160,89,0.04));display:flex;align-items:center;justify-content:center;">
                            <div style="width:60px;height:60px;border-radius:50%;border:2px solid rgba(239,68,68,0.5);display:flex;align-items:center;justify-content:center;background:rgba(239,68,68,0.08);">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5"><polygon points="5 3 19 12 5 21 5 3" fill="rgba(239,68,68,0.3)"/></svg>
                            </div>
                        </div>
                        <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 50%,#0a0205 100%);"></div>
                        <div style="position:absolute;top:10px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:6px;background:rgba(10,2,5,0.9);border:1px solid rgba(239,68,68,0.5);border-radius:20px;padding:4px 14px;white-space:nowrap;">
                            <div style="width:6px;height:6px;border-radius:50%;background:#ef4444;animation:livePulse 1.5s ease-in-out infinite;"></div>
                            <span style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:#ef4444;letter-spacing:3px;">LIVE NOW</span>
                        </div>
                    </div>
                    <div style="padding:14px 18px 18px;text-align:center;">
                        <div style="font-family:'Orbitron',sans-serif;font-size:0.85rem;color:#fff;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:6px;">Queen Karin</div>
                        <div style="font-family:'Rajdhani',sans-serif;font-size:0.85rem;color:rgba(255,255,255,0.5);margin-bottom:12px;">is streaming right now</div>
                        <a href="/profile" style="display:inline-flex;align-items:center;gap:6px;padding:8px 22px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.4);border-radius:20px;text-decoration:none;font-family:'Orbitron',sans-serif;font-size:0.4rem;color:#ef4444;letter-spacing:2px;transition:all 0.2s;">
                            <div style="width:5px;height:5px;border-radius:50%;background:#ef4444;animation:livePulse 1.5s ease-in-out infinite;"></div>
                            JOIN STREAM
                        </a>
                    </div>
                </div>
                <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div>
            </div>
        </div>`;
    }

    // ── Promotion Card ── centered
    if (content.startsWith('PROMOTION_CARD::')) {
        try {
            const d = JSON.parse(content.replace('PROMOTION_CARD::', ''));
            const initials = (d.name || 'S')[0].toUpperCase();
            const photoBlock = d.photo ? `<img src="${d.photo}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : '';
            const photoFallback = `<div style="${d.photo ? 'display:none;' : ''}position:absolute;inset:0;align-items:center;justify-content:center;background:linear-gradient(135deg,rgba(197,160,89,0.08),rgba(197,160,89,0.02));"><div style="width:60px;height:60px;border-radius:50%;border:1px solid rgba(197,160,89,0.4);display:flex;align-items:center;justify-content:center;font-family:'Orbitron',sans-serif;font-size:1.4rem;color:#c5a059;">${initials}</div></div>`;
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:8px;">
                <div style="width:60%;min-width:240px;max-width:480px;">
                    <div style="width:100%;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0e0b06 0%,#110d04 60%,#0a0703 100%);border:1px solid rgba(197,160,89,0.5);box-shadow:0 12px 40px rgba(0,0,0,0.8);">
                        <div style="position:relative;width:100%;height:150px;background:#0a0703;overflow:hidden;">
                            ${photoBlock}${photoFallback}
                            <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,#0e0b06 100%);"></div>
                            <div style="position:absolute;top:10px;left:50%;transform:translateX(-50%);background:rgba(10,7,2,0.9);border:1px solid rgba(197,160,89,0.5);border-radius:20px;padding:4px 14px;white-space:nowrap;"><span style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:#c5a059;letter-spacing:3px;">RANK PROMOTION</span></div>
                        </div>
                        <div style="padding:14px 18px 18px;text-align:center;">
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.95rem;color:#fff;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">${d.name||''}</div>
                            <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:12px;">
                                <span style="font-family:'Orbitron',sans-serif;font-size:0.48rem;color:rgba(197,160,89,0.4);letter-spacing:1px;text-decoration:line-through;">${(d.oldRank||'').toUpperCase()}</span>
                                <span style="color:rgba(197,160,89,0.7);">→</span>
                                <span style="font-family:'Orbitron',sans-serif;font-size:0.55rem;color:#c5a059;letter-spacing:2px;font-weight:700;">${(d.newRank||'').toUpperCase()}</span>
                            </div>
                            <div style="width:70%;height:1px;background:linear-gradient(to right,transparent,rgba(197,160,89,0.35),transparent);margin:0 auto;"></div>
                        </div>
                    </div>
                    <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div>
                </div>
            </div>`;
        } catch (e) { /* fall through */ }
    }

    // ── Challenge Join Card ──
    if (content.startsWith('CHALLENGE_JOIN_CARD::')) {
        try {
            const d = JSON.parse(content.replace('CHALLENGE_JOIN_CARD::', ''));
            const initials = (d.name || 'S')[0].toUpperCase();
            const photoBlock = d.photo ? `<img src="${d.photo}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : '';
            const photoFallback = `<div style="${d.photo ? 'display:none;' : ''}position:absolute;inset:0;align-items:center;justify-content:center;background:linear-gradient(135deg,rgba(74,222,128,0.08),rgba(74,222,128,0.02));"><div style="width:60px;height:60px;border-radius:50%;border:1px solid rgba(74,222,128,0.4);display:flex;align-items:center;justify-content:center;font-family:'Orbitron',sans-serif;font-size:1.4rem;color:#4ade80;">${initials}</div></div>`;
            const bgImg = d.challengeImage ? `background-image:url('${d.challengeImage}');background-size:cover;background-position:center;` : '';
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:8px;">
                <div style="width:60%;min-width:240px;max-width:480px;">
                    <div style="width:100%;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#060e08 0%,#040d06 60%,#030a04 100%);border:1px solid rgba(74,222,128,0.45);box-shadow:0 12px 40px rgba(0,0,0,0.8);">
                        <div style="position:relative;width:100%;height:140px;background:#030a04;overflow:hidden;${bgImg}">
                            <div style="position:absolute;inset:0;background:rgba(0,0,0,0.55);"></div>
                            <div style="position:relative;z-index:1;width:100%;height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;">
                                <div style="width:52px;height:52px;border-radius:50%;overflow:hidden;border:2px solid rgba(74,222,128,0.6);position:relative;">${photoBlock}<div style="${d.photo ? 'display:none;' : ''}position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(74,222,128,0.1);font-family:'Orbitron';font-size:1.2rem;color:#4ade80;">${initials}</div></div>
                            </div>
                            <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,#060e08 100%);"></div>
                            <div style="position:absolute;top:10px;left:50%;transform:translateX(-50%);background:rgba(3,10,4,0.9);border:1px solid rgba(74,222,128,0.5);border-radius:20px;padding:4px 14px;white-space:nowrap;"><span style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:#4ade80;letter-spacing:3px;">⚔ JOINED CHALLENGE</span></div>
                        </div>
                        <div style="padding:14px 18px 18px;text-align:center;">
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.95rem;color:#fff;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">${d.name||''}</div>
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.45rem;color:rgba(74,222,128,0.7);letter-spacing:1px;margin-bottom:10px;">${(d.challengeName||'').toUpperCase()}</div>
                            <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.2);border-radius:20px;padding:4px 14px;">
                                <span style="width:6px;height:6px;border-radius:50%;background:#4ade80;box-shadow:0 0 6px #4ade80;display:inline-block;"></span>
                                <span style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:#4ade80;letter-spacing:2px;">ACTIVE USERS: ${d.activeCount||0}</span>
                            </div>
                        </div>
                    </div>
                    <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div>
                </div>
            </div>`;
        } catch (e) { /* fall through */ }
    }

    // ── Challenge Eliminated Card ──
    if (content.startsWith('CHALLENGE_ELIM_CARD::')) {
        try {
            const d = JSON.parse(content.replace('CHALLENGE_ELIM_CARD::', ''));
            const initials = (d.name || 'S')[0].toUpperCase();
            const photoBlock = d.photo ? `<img src="${d.photo}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : '';
            const bgImg = d.challengeImage ? `background-image:url('${d.challengeImage}');background-size:cover;background-position:center;` : '';
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:8px;">
                <div style="width:60%;min-width:240px;max-width:480px;">
                    <div style="width:100%;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0e0606 0%,#0d0404 60%,#0a0303 100%);border:1px solid rgba(224,48,48,0.4);box-shadow:0 12px 40px rgba(0,0,0,0.8);">
                        <div style="position:relative;width:100%;height:140px;background:#0a0303;overflow:hidden;${bgImg}">
                            <div style="position:absolute;inset:0;background:rgba(0,0,0,0.6);"></div>
                            <div style="position:relative;z-index:1;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
                                <div style="width:52px;height:52px;border-radius:50%;overflow:hidden;border:2px solid rgba(224,48,48,0.5);position:relative;">${photoBlock}<div style="${d.photo ? 'display:none;' : ''}position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(224,48,48,0.1);font-family:'Orbitron';font-size:1.2rem;color:#e03030;">${initials}</div></div>
                            </div>
                            <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,#0e0606 100%);"></div>
                            <div style="position:absolute;top:10px;left:50%;transform:translateX(-50%);background:rgba(10,3,3,0.9);border:1px solid rgba(224,48,48,0.45);border-radius:20px;padding:4px 14px;white-space:nowrap;"><span style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:#e03030;letter-spacing:3px;">✕ ELIMINATED</span></div>
                        </div>
                        <div style="padding:14px 18px 18px;text-align:center;">
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.95rem;color:#fff;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">${d.name||''}</div>
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.45rem;color:rgba(224,48,48,0.7);letter-spacing:1px;margin-bottom:10px;">${(d.challengeName||'').toUpperCase()}</div>
                            <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(74,222,128,0.06);border:1px solid rgba(74,222,128,0.18);border-radius:20px;padding:4px 14px;">
                                <span style="width:6px;height:6px;border-radius:50%;background:#4ade80;box-shadow:0 0 6px #4ade80;display:inline-block;"></span>
                                <span style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:#4ade80;letter-spacing:2px;">STILL IN: ${d.activeCount||0}</span>
                            </div>
                        </div>
                    </div>
                    <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div>
                </div>
            </div>`;
        } catch (e) { /* fall through */ }
    }

    // ── Challenge Invite Card ──
    if (content.startsWith('CHALLENGE_INVITE_CARD::')) {
        try {
            const d = JSON.parse(content.replace('CHALLENGE_INVITE_CARD::', ''));
            const bgImg = d.challengeImage ? `background-image:url('${d.challengeImage}');background-size:cover;background-position:center;` : '';
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:8px;">
                <div style="width:60%;min-width:240px;max-width:480px;">
                    <div style="width:100%;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0e0b06 0%,#0d0a04 60%,#0a0803 100%);border:1px solid rgba(197,160,89,0.5);box-shadow:0 12px 40px rgba(0,0,0,0.8);">
                        <div style="position:relative;width:100%;height:140px;background:#0a0803;overflow:hidden;${bgImg}">
                            <div style="position:absolute;inset:0;background:rgba(0,0,0,0.55);"></div>
                            <div style="position:relative;z-index:1;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
                                <div style="font-family:'Orbitron',sans-serif;font-size:2.2rem;color:rgba(197,160,89,0.6);">⚔</div>
                            </div>
                            <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,#0e0b06 100%);"></div>
                            <div style="position:absolute;top:10px;left:50%;transform:translateX(-50%);background:rgba(10,8,3,0.9);border:1px solid rgba(197,160,89,0.5);border-radius:20px;padding:4px 14px;white-space:nowrap;"><span style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:#c5a059;letter-spacing:3px;">⚔ CHALLENGE INVITATION</span></div>
                        </div>
                        <div style="padding:14px 18px 18px;text-align:center;">
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.95rem;color:#fff;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">${(d.challengeName||'').toUpperCase()}</div>
                            <div style="font-family:'Rajdhani',sans-serif;font-size:0.82rem;color:#777;margin-bottom:12px;">${d.durationDays||'?'} days · ${d.tasksPerDay||'?'} tasks/day · ${(d.joinCost||0).toLocaleString()} coins</div>
                            <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:12px;">
                                <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.2);border-radius:20px;padding:4px 14px;">
                                    <span style="width:6px;height:6px;border-radius:50%;background:#4ade80;box-shadow:0 0 6px #4ade80;display:inline-block;"></span>
                                    <span style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:#4ade80;letter-spacing:2px;">ACTIVE: ${d.activeCount||0}</span>
                                </div>
                            </div>
                            <div style="padding:10px 24px;background:linear-gradient(135deg,rgba(197,160,89,0.2),rgba(197,160,89,0.08));border:1px solid rgba(197,160,89,0.4);border-radius:8px;cursor:pointer;display:inline-block;">
                                <span style="font-family:'Orbitron',sans-serif;font-size:0.45rem;color:#c5a059;letter-spacing:2px;font-weight:700;">TAP TO JOIN ⚔</span>
                            </div>
                        </div>
                    </div>
                    <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div>
                </div>
            </div>`;
        } catch (e) { /* fall through */ }
    }

    // ── Leaderboard Reward Card ──
    if (content.startsWith('LEADERBOARD_REWARD_CARD::')) {
        try {
            const d = JSON.parse(content.replace('LEADERBOARD_REWARD_CARD::', ''));
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:8px;">
                <div style="width:60%;min-width:240px;max-width:480px;">
                    <div style="width:100%;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0e0b06 0%,#110d04 60%,#0a0703 100%);border:1px solid rgba(197,160,89,0.6);box-shadow:0 12px 40px rgba(0,0,0,0.8),0 0 30px rgba(197,160,89,0.1);">
                        <div style="padding:20px 20px;text-align:center;">
                            <div style="font-size:1.6rem;margin-bottom:6px;">👑</div>
                            <div style="font-family:'Cinzel',serif;font-size:0.8rem;color:#c5a059;letter-spacing:3px;margin-bottom:4px;">${d.title || 'CHAMPION'}</div>
                            <div style="width:40%;height:1px;background:linear-gradient(to right,transparent,rgba(197,160,89,0.5),transparent);margin:8px auto;"></div>
                            ${d.winnerName ? `<div style="font-family:'Orbitron',sans-serif;font-size:0.85rem;color:#fff;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">${d.winnerName}</div>` : ''}
                            <div style="font-family:'Rajdhani',sans-serif;font-size:0.95rem;color:rgba(255,255,255,0.8);margin-bottom:6px;">${d.rewards || ''}</div>
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(197,160,89,0.5);letter-spacing:2px;">SCORE: ${(d.score || 0).toLocaleString()} · ${(d.period || '').toUpperCase()}</div>
                        </div>
                    </div>
                    <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div>
                </div>
            </div>`;
        } catch (e) { /* fall through */ }
    }

    // ── GIF Card ── same style as promotion card
    if ((msg.media_type === 'gif' || (msg.message === '[GIF]' && msg.media_url)) && msg.media_url) {
        const _imgErr = `onerror="if(!this.dataset.retried){this.dataset.retried='1';this.src='/api/media?url='+encodeURIComponent(this.src);}"`;
        return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:8px;">
            <div style="width:60%;min-width:220px;max-width:360px;">
                <div style="width:100%;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0e0b06 0%,#110d04 60%,#0a0703 100%);border:1px solid rgba(197,160,89,0.35);box-shadow:0 12px 40px rgba(0,0,0,0.8);">
                    <div style="width:100%;overflow:hidden;background:#0a0703;">
                        <img src="${msg.media_url}" ${_imgErr} style="width:100%;display:block;max-height:240px;object-fit:contain;" />
                    </div>
                    <div style="padding:10px 16px 14px;text-align:center;border-top:1px solid rgba(197,160,89,0.12);">
                        <div style="font-family:'Orbitron',sans-serif;font-size:0.82rem;color:#fff;font-weight:700;letter-spacing:2px;text-transform:uppercase;">${name}</div>
                    </div>
                </div>
                <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div>
            </div>
        </div>`;
    }

    // UPDATE PHOTO CARD (profile update announcements — keep as card)
    if (content.startsWith('UPDATE_PHOTO_CARD::')) {
        try {
            const d = JSON.parse(content.replace('UPDATE_PHOTO_CARD::', ''));
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:8px;">
                <div style="width:60%;min-width:240px;max-width:480px;">
                    <div style="background:#0a0a14;border:1px solid rgba(197,160,89,0.2);border-radius:14px;overflow:hidden;width:100%;box-shadow:0 8px 30px rgba(0,0,0,0.5);">
                        <img src="${d.mediaUrl}" style="width:100%;max-height:240px;object-fit:cover;display:block;" loading="lazy" onerror="this.style.display='none'">
                        <div style="padding:10px 14px 12px;">
                            <div style="display:flex;align-items:center;justify-content:space-between;">
                                <span style="font-family:'Orbitron';font-size:0.75rem;color:#fff;font-weight:700;">${d.senderName||''}</span>
                                <span style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.35);">${time}</span>
                            </div>
                            ${d.caption ? `<div style="font-family:'Rajdhani';font-size:0.72rem;color:rgba(255,255,255,0.5);margin-top:3px;">${d.caption}</div>` : ''}
                        </div>
                    </div>
                </div>
            </div>`;
        } catch (e) { /* fall through */ }
    }

    // DIRECT TRIBUTE CARD (coin send)
    if (content.startsWith('DIRECT_TRIBUTE_CARD::')) {
        try {
            const d = JSON.parse(content.replace('DIRECT_TRIBUTE_CARD::', ''));
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:8px;"><div style="width:220px;border-radius:14px;overflow:hidden;background:linear-gradient(170deg,#0e0b06,#0d0a04,#0a0703);border:1px solid rgba(197,160,89,0.5);box-shadow:0 8px 30px rgba(0,0,0,0.6);text-align:center;padding:20px 16px;"><div style="font-size:1.8rem;margin-bottom:8px;">\u2728</div><div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(197,160,89,0.6);letter-spacing:3px;margin-bottom:10px;">TRIBUTE SENT</div><div style="font-family:'Orbitron',sans-serif;font-size:1.2rem;color:#c5a059;font-weight:700;margin-bottom:4px;">${(d.amount||0).toLocaleString()}</div><div style="font-family:'Rajdhani',sans-serif;font-size:0.5rem;color:rgba(197,160,89,0.4);letter-spacing:2px;margin-bottom:12px;">COINS</div><div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(255,255,255,0.35);">${d.senderName||''}</div></div></div>`;
        } catch (e) { /* fall through */ }
    }

    // RISKY TRIBUTE CARD (gamble result)
    if (content.startsWith('RISKY_TRIBUTE_CARD::')) {
        try {
            const d = JSON.parse(content.replace('RISKY_TRIBUTE_CARD::', ''));
            const isWin = d.isWin;
            const borderColor = isWin ? 'rgba(197,160,89,0.5)' : d.lostAmount === 0 ? 'rgba(74,222,128,0.4)' : 'rgba(220,50,80,0.4)';
            const bg = isWin ? '#0e0b06' : d.lostAmount === 0 ? '#060e08' : '#0e0606';
            const resultText = isWin ? `WON +${(d.wonAmount||0).toLocaleString()}` : d.lostAmount === 0 ? 'NO LOSS' : `LOST ${(d.lostAmount||0).toLocaleString()}`;
            const resultColor = isWin ? '#c5a059' : d.lostAmount === 0 ? '#4ade80' : '#e03050';
            const rIconHtml = d.icon && d.icon.startsWith('/') ? `<img src="${d.icon}" style="width:70px;height:auto;">` : `<div style="font-size:2.2rem;">${d.icon||'🎰'}</div>`;
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:8px;"><div style="width:min(90%,320px);"><div style="border-radius:14px;overflow:hidden;background:linear-gradient(170deg,${bg},#0a0a14);border:1px solid ${borderColor};box-shadow:0 8px 30px rgba(0,0,0,0.6);padding:14px 16px;"><div style="display:flex;align-items:center;gap:14px;"><div style="flex-shrink:0;width:70px;display:flex;align-items:center;justify-content:center;">${rIconHtml}</div><div style="flex:1;min-width:0;"><div style="font-family:'Cinzel',serif;font-size:0.8rem;color:rgba(255,255,255,0.85);font-weight:700;margin-bottom:4px;">${d.senderName||''}</div><div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(255,255,255,0.35);letter-spacing:2px;margin-bottom:3px;">RISKY SEND</div><div style="font-family:'Orbitron',sans-serif;font-size:0.55rem;color:${resultColor};letter-spacing:1px;font-weight:700;margin-bottom:3px;">${d.cardName||''}</div><div style="font-family:'Rajdhani',sans-serif;font-size:0.75rem;color:rgba(255,255,255,0.45);">Staked ${(d.stakeAmount||0).toLocaleString()} · <span style="color:${resultColor};font-weight:700;">${resultText}</span></div></div></div></div><div style="margin-top:8px;text-align:center;"><button onclick="if(window.openInlineRisky){window.openInlineRisky();}" style="background:linear-gradient(135deg,rgba(197,160,89,0.15),rgba(197,160,89,0.05));border:1px solid rgba(197,160,89,0.4);color:#c5a059;font-family:'Orbitron',sans-serif;font-size:0.4rem;letter-spacing:2px;padding:6px 20px;border-radius:20px;cursor:pointer;">TRY YOUR LUCK</button></div></div></div>`;
        } catch (e) { /* fall through */ }
    }

    // UPDATE TRIBUTE CARD
    if (content.startsWith('UPDATE_TRIBUTE_CARD::')) {
        try {
            const d = JSON.parse(content.replace('UPDATE_TRIBUTE_CARD::', ''));
            const coverSrc = d.image || '';
            const priceVal = d.price ? Number(d.price).toLocaleString() : '';
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:8px;">
                <div style="width:220px;">
                    <div style="border-radius:12px;overflow:hidden;background:#0a0a14;border:1px solid rgba(197,160,89,0.4);box-shadow:0 6px 24px rgba(0,0,0,0.5);">
                        <div style="width:100%;height:120px;background-image:url('${coverSrc}');background-size:cover;background-position:center;position:relative;">
                            ${priceVal ? `<div style="position:absolute;top:7px;right:8px;background:rgba(10,7,3,0.85);border:1px solid rgba(197,160,89,0.5);border-radius:20px;padding:3px 10px;font-family:'Orbitron',sans-serif;font-size:0.38rem;color:#c5a059;display:flex;align-items:center;gap:5px;letter-spacing:1px;"><i class="fas fa-coins"></i> ${priceVal}</div>` : ''}
                        </div>
                        <div style="padding:10px 14px 14px;">
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.45rem;color:rgba(197,160,89,0.7);letter-spacing:2px;margin-bottom:4px;">✦ Gift Sent</div>
                            <div style="font-family:'Cinzel',serif;font-size:0.85rem;color:#fff;font-weight:700;letter-spacing:1px;">${d.title||''}</div>
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.38rem;color:rgba(255,255,255,0.35);margin-top:6px;">${d.senderName||''}</div>
                        </div>
                    </div>
                </div>
            </div>`;
        } catch (e) { /* fall through */ }
    }

    // CHALLENGE TASK CARD
    if (content.startsWith('CHALLENGE_TASK_CARD::')) {
        try {
            const d = JSON.parse(content.replace('CHALLENGE_TASK_CARD::', ''));
            const cInitial = (d.senderName || 'S')[0].toUpperCase();
            const passed = d.passed !== false;
            const accentColor = passed ? '#4ade80' : '#e03030';
            const accentBg = passed ? 'rgba(74,222,128,0.05)' : 'rgba(224,48,48,0.05)';
            const accentBorder = passed ? 'rgba(74,222,128,0.25)' : 'rgba(224,48,48,0.25)';
            const label = passed ? '✓ TASK PASSED' : '✕ TASK FAILED';
            const subLabel = passed
                ? `Day ${d.dayNumber||'?'} · Task ${d.windowNumber||'?'} - continues${d.taskNum ? ` (${d.taskNum})` : ''}`
                : `Day ${d.dayNumber||'?'} · Task ${d.windowNumber||'?'} - eliminated`;
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:8px;">
                <div style="width:60%;min-width:240px;max-width:480px;">
                    <div style="background:${accentBg};border:1px solid ${accentBorder};border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;box-sizing:border-box;">
                        <div style="width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,0.05);border:1.5px solid ${accentBorder};overflow:hidden;position:relative;flex-shrink:0;">
                            ${d.senderAvatar ? `<img src="${d.senderAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none'">` : ''}
                            <div style="display:${d.senderAvatar ? 'none' : 'flex'};position:absolute;inset:0;align-items:center;justify-content:center;font-family:'Orbitron';font-size:0.65rem;color:${accentColor};">${cInitial}</div>
                        </div>
                        <div style="flex:1;min-width:0;">
                            <div style="font-family:'Orbitron';font-size:0.42rem;color:${accentColor};letter-spacing:1px;margin-bottom:3px;">${label}</div>
                            <div style="font-family:'Orbitron';font-size:0.82rem;color:#fff;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.senderName||''}</div>
                            <div style="font-family:'Rajdhani';font-size:0.72rem;color:rgba(255,255,255,0.45);margin-top:2px;">${subLabel}</div>
                            ${passed && d.points ? `<div style="font-family:'Orbitron';font-size:0.72rem;color:#a78bfa;font-weight:700;margin-top:2px;">+${d.points} pts</div>` : ''}
                        </div>
                        <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.35);flex-shrink:0;align-self:flex-start;">${time}</div>
                    </div>
                </div>
            </div>`;
        } catch (e) { /* fall through */ }
    }

    // UPDATE MERIT CARD
    if (content.startsWith('UPDATE_MERIT_CARD::')) {
        try {
            const d = JSON.parse(content.replace('UPDATE_MERIT_CARD::', ''));
            const mInitial = (d.senderName || 'S')[0].toUpperCase();
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:8px;">
                <div style="width:60%;min-width:240px;max-width:480px;">
                    <div style="background:rgba(167,139,250,0.05);border:1px solid rgba(167,139,250,0.25);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;box-sizing:border-box;">
                        <div style="width:42px;height:42px;border-radius:50%;background:rgba(167,139,250,0.1);border:1.5px solid rgba(167,139,250,0.35);overflow:hidden;position:relative;flex-shrink:0;">
                            ${d.senderAvatar ? `<img src="${d.senderAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none'">` : ''}
                            <div style="display:${d.senderAvatar ? 'none' : 'flex'};position:absolute;inset:0;align-items:center;justify-content:center;font-family:'Orbitron';font-size:0.65rem;color:#a78bfa;">${mInitial}</div>
                        </div>
                        <div style="flex:1;min-width:0;">
                            <div style="font-family:'Orbitron';font-size:0.42rem;color:rgba(255,255,255,0.5);letter-spacing:1px;margin-bottom:3px;">⚡ MERIT EARNED</div>
                            <div style="font-family:'Orbitron';font-size:0.82rem;color:#fff;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.senderName||''}</div>
                            <div style="font-family:'Orbitron';font-size:0.85rem;color:#a78bfa;font-weight:700;margin-top:2px;">+${d.points||0} MERIT</div>
                        </div>
                        <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.35);flex-shrink:0;align-self:flex-start;">${time}</div>
                    </div>
                </div>
            </div>`;
        } catch (e) { /* fall through */ }
    }

    // UPDATE COINS CARD
    if (content.startsWith('UPDATE_COINS_CARD::')) {
        try {
            const d = JSON.parse(content.replace('UPDATE_COINS_CARD::', ''));
            const cInitial = (d.senderName || 'S')[0].toUpperCase();
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:8px;">
                <div style="width:60%;min-width:240px;max-width:480px;">
                    <div style="background:rgba(197,160,89,0.05);border:1px solid rgba(197,160,89,0.25);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;box-sizing:border-box;">
                        <div style="width:42px;height:42px;border-radius:50%;background:rgba(197,160,89,0.1);border:1.5px solid rgba(197,160,89,0.35);overflow:hidden;position:relative;flex-shrink:0;">
                            ${d.senderAvatar ? `<img src="${d.senderAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none'">` : ''}
                            <div style="display:${d.senderAvatar ? 'none' : 'flex'};position:absolute;inset:0;align-items:center;justify-content:center;font-family:'Orbitron';font-size:0.65rem;color:#c5a059;">${cInitial}</div>
                        </div>
                        <div style="flex:1;min-width:0;">
                            <div style="font-family:'Orbitron';font-size:0.42rem;color:rgba(255,255,255,0.5);letter-spacing:1px;margin-bottom:3px;">🪙 COINS EARNED</div>
                            <div style="font-family:'Orbitron';font-size:0.82rem;color:#fff;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.senderName||''}</div>
                            <div style="font-family:'Orbitron';font-size:0.85rem;color:#c5a059;font-weight:700;margin-top:2px;">+${d.points||0} COINS</div>
                        </div>
                        <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.35);flex-shrink:0;align-self:flex-start;">${time}</div>
                    </div>
                </div>
            </div>`;
        } catch (e) { /* fall through */ }
    }

    // WELCOME CARD (new member)
    if (content.startsWith('WELCOME_CARD::')) {
        try {
            const d = JSON.parse(content.replace('WELCOME_CARD::', ''));
            const wIni = (d.name || 'S')[0].toUpperCase();
            const SVG_CROWN = `<svg width="14" height="11" viewBox="0 0 26 20" fill="#c5a059"><path d="M2 18 L5 8 L10 13 L13 3 L16 13 L21 8 L24 18 Z"/><rect x="2" y="17" width="22" height="2" rx="1"/></svg>`;
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:8px;">
                <div style="width:60%;min-width:240px;max-width:480px;">
                    <div style="width:100%;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0c0a04 0%,#13100a 50%,#0c0a04 100%);border:1px solid rgba(197,160,89,0.6);box-shadow:0 12px 40px rgba(0,0,0,0.8),0 0 30px rgba(197,160,89,0.08);">
                        <div style="position:relative;width:100%;padding:22px 0 16px;display:flex;flex-direction:column;align-items:center;background:radial-gradient(ellipse at center top,rgba(197,160,89,0.1) 0%,transparent 70%);">
                            <div style="width:68px;height:68px;border-radius:50%;border:2px solid rgba(197,160,89,0.6);display:flex;align-items:center;justify-content:center;font-family:'Cinzel',serif;font-size:1.6rem;color:#c5a059;background:radial-gradient(circle,rgba(197,160,89,0.12) 0%,rgba(197,160,89,0.03) 100%);box-shadow:0 0 20px rgba(197,160,89,0.15),0 0 40px rgba(197,160,89,0.05);">${wIni}</div>
                        </div>
                        <div style="padding:4px 18px 22px;text-align:center;">
                            <div style="font-family:'Cinzel',serif;font-size:1.05rem;color:#fff;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">${d.name || ''}</div>
                            <div style="width:40%;height:1px;background:linear-gradient(to right,transparent,rgba(197,160,89,0.5),transparent);margin:0 auto 10px;"></div>
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(197,160,89,0.65);letter-spacing:3px;margin-bottom:14px;">HAS ENTERED THE COURT</div>
                            <div style="display:inline-flex;align-items:center;gap:5px;background:rgba(197,160,89,0.06);border:1px solid rgba(197,160,89,0.25);border-radius:20px;padding:4px 14px;">${SVG_CROWN}<span style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:#c5a059;letter-spacing:2px;">${(d.rank || 'HALL BOY').toUpperCase()}</span></div>
                        </div>
                    </div>
                    <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div>
                </div>
            </div>`;
        } catch (e) { /* fall through */ }
    }

    const isGif = (content === '[GIF]' && msg.media_url);
    const _vidErr = `onerror="if(!this.dataset.retried){this.dataset.retried='1';this.src='/api/media?url='+encodeURIComponent(this.src);this.load();}"`;
    const _imgErr = `onerror="if(!this.dataset.retried){this.dataset.retried='1';this.src='/api/media?url='+encodeURIComponent(this.src);}"`;
    const hasPhoto = msg.media_url && msg.media_type !== 'video' && msg.media_type !== 'gif';
    const hasVideo = msg.media_url && msg.media_type === 'video';
    const _isMediaOnly = (hasVideo || hasPhoto || isGif) && (!content || content === '[VIDEO]' || content === '[PHOTO]' || content === '[GIF]');
    const _playSvg = `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="23" fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.4)" stroke-width="2"/><path d="M19 14.5L35 24L19 33.5V14.5Z" fill="rgba(255,255,255,0.9)"/></svg>`;
    const _thumbBg = (msg.thumbnail_url) ? `background-image:url('${msg.thumbnail_url.replace(/'/g, "\\'")}');background-size:cover;background-position:center;` : 'background:#0a0a0a;';
    const mediaHtml = msg.media_url ? (
        hasVideo
            ? `<div style="margin-top:6px;width:160px;aspect-ratio:3/4;border-radius:10px;overflow:hidden;position:relative;cursor:pointer;${_thumbBg}display:flex;align-items:center;justify-content:center;" onclick="window._openGlobalLightbox('${msg.media_url.replace(/'/g, "\\'")}','video')">${_playSvg}</div>`
            : isGif
                ? `<img src="${msg.media_url}" ${_imgErr} style="max-width:220px;width:auto;height:auto;max-height:200px;border-radius:10px;display:block;margin-top:4px;" />`
                : `<div style="margin-top:6px;width:160px;aspect-ratio:3/4;border-radius:10px;overflow:hidden;cursor:pointer;" onclick="window._openGlobalLightbox('${(msg.media_url || '').replace(/'/g, "\\'")}')"><img src="${msg.media_url}" ${_imgErr} style="width:100%;height:100%;object-fit:cover;display:block;" /></div>`
    ) : '';

    // Like button helper
    const likeId = msgId || `${(msg.created_at || '')}::${(msg.sender_email || '')}`;
    const liked = _isLiked(likeId);
    const heartSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="${liked ? '#e03050' : 'none'}" stroke="${liked ? '#e03050' : 'rgba(255,255,255,0.3)'}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
    const likeBtn = `<button class="gl-like-btn" onclick="event.stopPropagation();window._toggleGlobalLike('${likeId.replace(/'/g, "\\'")}',this)" style="background:none;border:none;cursor:pointer;padding:4px;display:flex;align-items:center;gap:4px;transition:transform 0.15s;" title="Like">${heartSvg}</button>`;

    // ── QUEEN bubble ──
    if (isQueen) {
        const qAv = av
            ? `<img src="${av}" style="width:22px;height:22px;border-radius:50%;object-fit:cover;border:1.5px solid rgba(197,160,89,0.7);flex-shrink:0;" onerror="this.style.display='none'">`
            : `<img src="/queen-nav.png" style="width:22px;height:22px;border-radius:50%;object-fit:cover;border:1.5px solid rgba(197,160,89,0.7);flex-shrink:0;">`;
        const _qTextContent = (isGif || hasVideo || (content === '[PHOTO]' && hasPhoto)) ? '' : content;
        const _qHeader = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;gap:6px;">
            <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
                ${qAv}
                <div style="display:flex;align-items:center;gap:4px;white-space:nowrap;flex-shrink:0;">${SVG_CROWN}<span style="font-family:'Cinzel',serif;font-size:0.65rem;color:#c5a059;letter-spacing:1px;font-weight:700;">QUEEN KARIN</span></div>
                <span style="font-family:'Orbitron';font-size:0.35rem;color:rgba(197,160,89,0.55);white-space:nowrap;flex-shrink:0;"> · ${time}</span>
            </div>
            <div style="display:flex;align-items:center;gap:4px;">${likeBtn}${replyBtn}</div>
        </div>`;

        if (_isMediaOnly) {
            // Frameless — just header + media, no border/background
            return `<div class="gl-msg-row" style="margin-bottom:8px;padding:4px 13px;">
                ${_qHeader}
                ${mediaHtml}
            </div>`;
        }
        // Text bubble with gold frame
        return `<div class="gl-msg-row" style="margin-bottom:8px;">
            <div style="padding:9px 13px 11px;background:linear-gradient(135deg,rgba(197,160,89,0.14),rgba(100,75,15,0.08));border:1.5px solid rgba(197,160,89,0.75);border-radius:10px;box-shadow:0 0 14px rgba(197,160,89,0.1);">
                ${_qHeader}
                ${quoteHtml}${_qTextContent ? `<div style="font-family:'Rajdhani',sans-serif;font-size:0.95rem;color:rgba(255,255,255,0.7);line-height:1.5;">${_qTextContent}</div>` : ''}
                ${mediaHtml}
            </div>
        </div>`;
    }

    // ── Regular user bubble ──
    const initial = (name[0] || 'S').toUpperCase();
    const userAv = av
        ? `<img src="${av}" style="width:22px;height:22px;border-radius:50%;object-fit:cover;border:1px solid rgba(197,160,89,0.35);flex-shrink:0;" onerror="this.style.display='none'">`
        : `<div style="width:22px;height:22px;border-radius:50%;background:rgba(197,160,89,0.12);border:1px solid rgba(197,160,89,0.25);display:flex;align-items:center;justify-content:center;font-family:'Orbitron';font-size:0.42rem;color:#c5a059;flex-shrink:0;">${initial}</div>`;
    const _uHeader = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
        <div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1;">
            ${userAv}
            <span style="font-family:'Orbitron',sans-serif;font-size:0.45rem;color:rgba(197,160,89,0.6);letter-spacing:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</span>
            <span style="font-family:'Orbitron';font-size:0.35rem;color:rgba(255,255,255,0.3);white-space:nowrap;flex-shrink:0;"> · ${time}</span>
        </div>
        <div style="display:flex;align-items:center;gap:4px;">${likeBtn}${replyBtn}</div>
    </div>`;
    const _uTextContent = (isGif || hasVideo || (content === '[PHOTO]' && hasPhoto)) ? '' : content;

    if (_isMediaOnly) {
        // Frameless — just header + media
        return `<div class="gl-msg-row" style="margin-bottom:8px;padding:4px 13px;">
            ${_uHeader}
            ${mediaHtml}
        </div>`;
    }
    return `<div class="gl-msg-row" style="margin-bottom:8px;">
        <div style="padding:9px 13px 11px;background:rgba(255,255,255,0.02);border:1px solid rgba(180,180,200,0.18);border-radius:10px;">
            ${_uHeader}
            ${quoteHtml}${_uTextContent ? `<div style="font-family:'Rajdhani',sans-serif;font-size:0.92rem;color:rgba(255,255,255,0.7);line-height:1.45;">${_uTextContent}</div>` : ''}
            ${mediaHtml}
        </div>
    </div>`;
}

// ─── ONLINE USERS STRIP ───────────────────────────────────────────────────────

async function _fetchAndRenderOnline() {
    try {
        const res = await fetch('/api/dashboard-data');
        const data = await res.json();
        const now = Date.now();
        const users = (data.users || []).map((u: any) => ({
            name: u.name,
            avatar: u.avatar || u.image || u.profilePicture || null,
            online: !!(u.lastSeen && (now - new Date(u.lastSeen).getTime()) / 60000 < 5),
        }));
        users.sort((a: { online: boolean }, b: { online: boolean }) => (b.online ? 1 : 0) - (a.online ? 1 : 0));
        _renderOnlineUsers(users);
    } catch {}
}

function _renderOnlineUsers(users: any[]) {
    const strip = document.getElementById('globalOnlineStrip');
    if (!strip) return;
    if (!users.length) {
        strip.innerHTML = `<span style="font-family:'Orbitron';font-size:0.35rem;color:rgba(255,255,255,0.2);letter-spacing:2px;">NO ONE ONLINE</span>`;
        return;
    }
    strip.innerHTML = users.map(u => {
        const initial = (u.name || 'S')[0].toUpperCase();
        const isOnline = u.online === true;
        const borderColor = isOnline ? 'rgba(100,220,100,0.7)' : 'rgba(80,80,80,0.4)';
        const dotColor = isOnline ? '#4ade80' : '#444';
        const imgFilter = isOnline ? '' : 'filter:grayscale(1);opacity:0.45;';
        const nameColor = isOnline ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)';
        const avHtml = u.avatar
            ? `<img src="${u.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;${imgFilter}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div style="display:none;position:absolute;inset:0;align-items:center;justify-content:center;font-family:'Orbitron';font-size:0.8rem;color:#c5a059;">${initial}</div>`
            : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Orbitron';font-size:0.8rem;color:${isOnline ? '#c5a059' : '#444'};">${initial}</div>`;
        return `<div title="${u.name}" style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:4px;position:relative;">
            <div style="width:54px;height:54px;border-radius:50%;background:rgba(20,20,20,0.8);border:2px solid ${borderColor};overflow:hidden;position:relative;">
                ${avHtml}
            </div>
            <div style="position:absolute;top:38px;right:2px;width:12px;height:12px;border-radius:50%;background:${dotColor};border:2px solid #04040e;"></div>
            <div style="font-family:'Orbitron';font-size:0.32rem;color:${nameColor};letter-spacing:0.5px;max-width:58px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;">${u.name}</div>
        </div>`;
    }).join('');
}

// ─── SEND ─────────────────────────────────────────────────────────────────────

export async function sendGlobalMessage() {
    const input = document.getElementById('globalTalkInput') as HTMLInputElement;
    if (!input) return;
    const message = input.value.trim();
    if (!message) return;
    const raw = getState().raw;
    const senderEmail = raw?.member_id || raw?.email;
    if (!senderEmail) return;
    input.value = '';

    // Capture and clear reply before sending
    const replyTo = _glReply ? { sender_name: _glReply.name, content: _glReply.text } : null;
    cancelGlReply();

    // Optimistic: show instantly with local profile data
    const QUEEN_EMAILS_LOCAL = ['ceo@qkarin.com'];
    const isQueenLocal = QUEEN_EMAILS_LOCAL.includes(senderEmail.toLowerCase());
    const senderName = raw?.name || (isQueenLocal ? 'QUEEN KARIN' : senderEmail.split('@')[0]) || 'SUBJECT';
    const senderAvatar = raw?.avatar_url || raw?.avatar || (isQueenLocal ? '/queen-nav.png' : null);
    _appendMessage({
        sender_name: senderName,
        sender_avatar: senderAvatar,
        sender_email: senderEmail,
        is_queen: isQueenLocal,
        is_me: true,
        message,
        reply_to: replyTo,
        created_at: new Date().toISOString(),
    });

    try {
        await fetch('/api/global/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, senderEmail, reply_to: replyTo }),
        });
        // Realtime will NOT duplicate - the optimistic bubble already shows it.
        // On next poll/open the real record loads with correct name/avatar.
    } catch {}
}

export function handleGlobalTalkKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendGlobalMessage(); }
}

// ─── GIF PICKER ───────────────────────────────────────────────────────────────

let _gifPickerOpen = false;
let _gifSearchTimeout: ReturnType<typeof setTimeout> | null = null;

async function _sendGif(gifUrl: string) {
    const raw = getState().raw;
    const senderEmail = raw?.member_id || raw?.email;
    if (!senderEmail) return;

    const QUEEN_EMAILS_LOCAL = ['ceo@qkarin.com'];
    const isQueenLocal = QUEEN_EMAILS_LOCAL.includes(senderEmail.toLowerCase());
    const senderName = raw?.name || (isQueenLocal ? 'QUEEN KARIN' : senderEmail.split('@')[0]) || 'SUBJECT';
    const senderAvatar = raw?.avatar_url || raw?.avatar || (isQueenLocal ? '/queen-nav.png' : null);

    // Optimistic render
    _appendMessage({
        sender_name: senderName,
        sender_avatar: senderAvatar,
        sender_email: senderEmail,
        is_queen: isQueenLocal,
        is_me: true,
        message: '[GIF]',
        media_url: gifUrl,
        media_type: 'gif',
        created_at: new Date().toISOString(),
    });

    try {
        await fetch('/api/global/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: '[GIF]', senderEmail, media_url: gifUrl, media_type: 'gif' }),
        });
    } catch {}
}

export function openGifPicker() {
    if (_gifPickerOpen) { closeGifPicker(); return; }
    _gifPickerOpen = true;

    const existing = document.getElementById('gifPickerOverlay');
    if (existing) existing.remove();

    // Find a container to insert the GIF picker inline
    // 1. Mobile global talk panel
    const mobTalkPanel = document.getElementById('mobGlPanel_talk');
    // 2. Desktop global talk feed (GlobalContent)
    const deskTalkFeed = document.getElementById('globalTalkFeed');

    const panel = document.createElement('div');
    panel.id = 'gifPickerOverlay';

    panel.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:8px;">
            <input id="gifSearchInput" type="text" placeholder="Search GIFs..." autocomplete="off"
                style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;font-family:'Rajdhani',sans-serif;font-size:0.95rem;padding:7px 11px;border-radius:6px;outline:none;" />
            <button onclick="window.closeGifPicker()" style="background:none;border:none;color:rgba(255,255,255,0.35);font-size:1.1rem;cursor:pointer;">✕</button>
        </div>
        <div id="gifGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;max-height:35vh;overflow-y:auto;">
            <div style="grid-column:1/-1;text-align:center;padding:20px;font-family:'Orbitron';font-size:0.5rem;color:rgba(255,255,255,0.2);">LOADING...</div>
        </div>
        <div style="padding:5px 0;text-align:right;">
            <span style="font-family:'Orbitron';font-size:0.32rem;color:rgba(255,255,255,0.12);letter-spacing:1px;">via Tenor</span>
        </div>
    `;

    if (mobTalkPanel) {
        // Mobile: insert above footer
        const talkFooter = mobTalkPanel.querySelector('.mob-gl-talk-footer');
        panel.style.cssText = 'border-top:1px solid rgba(197,160,89,0.15);background:#0d0b08;padding:8px;flex-shrink:0;';
        if (talkFooter) mobTalkPanel.insertBefore(panel, talkFooter);
        else mobTalkPanel.appendChild(panel);
    } else if (deskTalkFeed) {
        // Desktop GlobalContent: insert after the talk feed (before the footer bar)
        const feedParent = deskTalkFeed.parentElement;
        const footer = deskTalkFeed.nextElementSibling;
        panel.style.cssText = 'border-top:1px solid rgba(197,160,89,0.15);background:#0d0b08;padding:8px;flex-shrink:0;';
        if (feedParent && footer) feedParent.insertBefore(panel, footer);
        else if (feedParent) feedParent.appendChild(panel);
        else document.body.appendChild(panel);
    } else {
        // Fallback: fixed overlay
        panel.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);width:min(420px, 96vw);max-height:55vh;background:#0d0b08;border:1px solid rgba(197,160,89,0.25);border-radius:12px;padding:8px;overflow-y:auto;z-index:2147483640;box-shadow:0 8px 40px rgba(0,0,0,0.7);';
        document.body.appendChild(panel);
    }

    const searchInput = panel.querySelector('#gifSearchInput') as HTMLInputElement;
    searchInput?.addEventListener('input', () => {
        if (_gifSearchTimeout) clearTimeout(_gifSearchTimeout);
        _gifSearchTimeout = setTimeout(() => _searchGifs(searchInput.value || 'funny'), 400);
    });

    // Load trending on open
    _searchGifs('funny');
    setTimeout(() => searchInput?.focus(), 50);
}

async function _searchGifs(q: string) {
    const grid = document.getElementById('gifGrid');
    if (!grid) return;
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;font-family:'Orbitron';font-size:0.5rem;color:rgba(255,255,255,0.2);">LOADING...</div>`;

    try {
        const res = await fetch(`/api/global/gifs?q=${encodeURIComponent(q)}`);
        const { results } = await res.json();
        if (!results?.length) {
            grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;font-family:'Orbitron';font-size:0.5rem;color:rgba(255,255,255,0.2);">NO RESULTS</div>`;
            return;
        }
        grid.innerHTML = results.map((r: any) => `
            <div onclick="window._selectGif('${encodeURIComponent(r.url)}')" style="cursor:pointer;border-radius:6px;overflow:hidden;aspect-ratio:1;background:rgba(255,255,255,0.04);">
                <img src="${r.preview}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.parentElement.style.display='none'">
            </div>
        `).join('');
    } catch {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;font-family:'Orbitron';font-size:0.5rem;color:rgba(255,255,255,0.2);">FAILED TO LOAD</div>`;
    }
}

export function closeGifPicker() {
    _gifPickerOpen = false;
    document.getElementById('gifPickerOverlay')?.remove();
}

if (typeof window !== 'undefined') {
    (window as any).openGifPicker = openGifPicker;
    (window as any).closeGifPicker = closeGifPicker;
    (window as any)._selectGif = (encodedUrl: string) => {
        const url = decodeURIComponent(encodedUrl);
        closeGifPicker();
        _sendGif(url);
    };
}

// ─── FULL UPDATES ─────────────────────────────────────────────────────────────

async function _loadUpdatesFull() {
    const grid = document.getElementById('globalUpdatesGrid');
    if (!grid) return;
    grid.innerHTML = `<div style="text-align:center;padding:40px;font-family:'Orbitron';font-size:0.55rem;color:rgba(255,255,255,0.25);">LOADING...</div>`;
    try {
        const res = await fetch('/api/global/updates');
        const { updates } = await res.json();
        if (!updates?.length) {
            grid.innerHTML = `<div style="text-align:center;padding:60px;font-family:'Orbitron';font-size:0.6rem;color:rgba(255,255,255,0.18);">NO UPDATES YET</div>`;
            return;
        }
        grid.innerHTML = updates.map((u: any) => _buildUpdateCard(u)).join('');
    } catch {
        grid.innerHTML = `<div style="text-align:center;padding:40px;font-family:'Orbitron';font-size:0.55rem;color:#ff4444;">FAILED</div>`;
    }
}

// ─── UPDATE CARD BUILDERS ─────────────────────────────────────────────────────

function _buildUpdateCard(u: any): string {
    if (u.kind === 'tribute') return _buildTributeCard(u);
    if (u.kind === 'points') return _buildPointsCard(u);
    return _buildPhotoCard(u);
}

function _buildTributeCard(u: any): string {
    const coverSrc = u.image || '';
    const priceVal = u.price ? Number(u.price).toLocaleString() : '';
    return `
    <div style="border-radius:12px;overflow:hidden;background:#0a0a14;border:1px solid rgba(197,160,89,0.4);box-shadow:0 6px 24px rgba(0,0,0,0.5);">
        <div style="width:100%;height:120px;background-image:url('${coverSrc}');background-size:cover;background-position:center;position:relative;">
            ${priceVal ? `<div style="position:absolute;top:7px;right:8px;background:rgba(10,7,3,0.85);border:1px solid rgba(197,160,89,0.5);border-radius:20px;padding:3px 10px;font-family:'Orbitron',sans-serif;font-size:0.38rem;color:#c5a059;display:flex;align-items:center;gap:5px;letter-spacing:1px;"><i class="fas fa-coins"></i> ${priceVal}</div>` : ''}
        </div>
        <div style="padding:10px 14px 14px;">
            <div style="font-family:'Orbitron',sans-serif;font-size:0.45rem;color:rgba(197,160,89,0.7);letter-spacing:2px;margin-bottom:4px;">✦ Gift Sent</div>
            <div style="font-family:'Cinzel',serif;font-size:0.85rem;color:#fff;font-weight:700;letter-spacing:1px;">${u.title}</div>
            <div style="font-family:'Orbitron',sans-serif;font-size:0.38rem;color:rgba(255,255,255,0.35);margin-top:6px;">${u.sender_name}</div>
        </div>
    </div>`;
}

function _buildPointsCard(u: any): string {
    const time = new Date(u.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const initial = (u.sender_name || 'S')[0].toUpperCase();
    const avHtml = u.sender_avatar
        ? `<img src="${u.sender_avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        : '';
    return `
    <div style="background:rgba(167,139,250,0.05);border:1px solid rgba(167,139,250,0.25);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:14px;">
        <div style="width:42px;height:42px;border-radius:50%;background:rgba(167,139,250,0.1);border:1.5px solid rgba(167,139,250,0.35);overflow:hidden;position:relative;flex-shrink:0;">
            ${avHtml}
            <div style="display:${u.sender_avatar ? 'none' : 'flex'};position:absolute;inset:0;align-items:center;justify-content:center;font-family:'Orbitron';font-size:0.65rem;color:#a78bfa;">${initial}</div>
        </div>
        <div style="flex:1;min-width:0;">
            <div style="font-family:'Orbitron';font-size:0.42rem;color:rgba(255,255,255,0.35);letter-spacing:1px;margin-bottom:3px;">⚡ MERIT EARNED</div>
            <div style="font-family:'Orbitron';font-size:0.82rem;color:#fff;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${u.sender_name}</div>
            <div style="font-family:'Orbitron';font-size:0.85rem;color:#a78bfa;font-weight:700;margin-top:2px;">+${u.points} MERIT</div>
        </div>
        <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.2);flex-shrink:0;align-self:flex-start;">${time}</div>
    </div>`;
}

function _buildPhotoCard(u: any): string {
    const time = new Date(u.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `
    <div style="background:#0a0a14;border:1px solid rgba(197,160,89,0.1);border-radius:10px;overflow:hidden;position:relative;"
         onmouseenter="this.querySelector('.uinfo').style.opacity='1'"
         onmouseleave="this.querySelector('.uinfo').style.opacity='0'">
        <img src="${getOptimizedUrl(u.media_url, 400)}" style="width:100%;max-height:220px;object-fit:cover;display:block;" loading="lazy">
        <div class="uinfo" style="position:absolute;bottom:0;left:0;right:0;padding:8px 10px;background:linear-gradient(transparent,rgba(0,0,0,0.88));opacity:0;transition:opacity 0.15s;">
            <div style="font-family:'Orbitron';font-size:0.62rem;color:#fff;">${u.sender_name} <span style="font-family:'Orbitron';font-size:0.35rem;color:rgba(255,255,255,0.3);">${time}</span></div>
            ${u.caption ? `<div style="font-family:'Rajdhani';font-size:0.72rem;color:rgba(255,255,255,0.55);margin-top:2px;">${u.caption}</div>` : ''}
        </div>
    </div>`;
}

// ─── UPDATES REALTIME ─────────────────────────────────────────────────────────

function _initUpdatesRealtime() {
    if (updatesChannel) return; // already subscribed

    updatesChannel = createClient()
        .channel('global_updates_channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chats' },
            (payload: any) => {
                const row = payload.new;
                const isWishlist = row.type === 'wishlist';
                const isMerit = row.type === 'system' && /MERIT/i.test(row.content || '');
                const isPhoto = row.type === 'global_update';
                if (!isWishlist && !isMerit && !isPhoto) return;

                // Re-fetch with enriched profile data, update both full grid and main-view preview
                fetch('/api/global/updates')
                    .then(r => r.json())
                    .then(({ updates }) => {
                        if (!updates?.length) return;
                        const grid = document.getElementById('globalUpdatesGrid');
                        if (grid) grid.innerHTML = updates.map((u: any) => _buildUpdateCard(u)).join('');
                        const preview = document.getElementById('globalPreview_updates');
                        if (preview) preview.innerHTML = updates.slice(0, 10).map((u: any) => _buildUpdateCardPreview(u)).join('');
                    })
                    .catch(() => {});
            }
        )
        .subscribe();
}

// ─── FULL SPENDERS ────────────────────────────────────────────────────────────

async function _loadSpendersFull() {
    const list = document.getElementById('spendersList');
    if (!list) return;
    list.innerHTML = `<div style="text-align:center;padding:40px;font-family:'Orbitron';font-size:0.55rem;color:rgba(255,255,255,0.25);">LOADING...</div>`;
    try {
        const res = await fetch('/api/global/sidepanels');
        const { spenders } = await res.json();
        if (!spenders?.length) {
            list.innerHTML = `<div style="text-align:center;padding:80px;font-family:'Orbitron';font-size:0.6rem;color:rgba(255,255,255,0.18);">NO DATA YET</div>`;
            return;
        }

        const top3 = spenders.slice(0, 3);
        const rest = spenders.slice(3);
        const order = [1, 0, 2];
        const pHeights = ['80px', '56px', '56px'];

        const podium = `
            <div style="display:flex;justify-content:center;align-items:flex-end;gap:12px;padding:28px 16px 0;margin-bottom:28px;">
                ${order.map(i => {
                    const e = top3[i]; if (!e) return '';
                    const avatarSrc = e.avatar || DEFAULT_AVATAR;
                    return `
                    <div style="display:flex;flex-direction:column;align-items:center;width:${i === 0 ? '130px' : '110px'};">
                        <div style="font-size:${i === 0 ? '2rem' : '1.4rem'};margin-bottom:6px;">${MEDALS[i]}</div>
                        <div style="width:${i === 0 ? '60px' : '48px'};height:${i === 0 ? '60px' : '48px'};border-radius:50%;overflow:hidden;border:2.5px solid ${MEDAL_COLORS[i]};box-shadow:0 0 16px ${MEDAL_COLORS[i]}55;margin-bottom:8px;">
                            <img src="${avatarSrc}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.src='${DEFAULT_AVATAR}'">
                        </div>
                        <div style="font-family:'Orbitron';font-size:${i === 0 ? '0.78rem' : '0.65rem'};color:#fff;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;font-weight:${i === 0 ? 700 : 400};">${e.name}</div>
                        <div style="font-family:'Orbitron';font-size:0.4rem;color:${MEDAL_COLORS[i]};margin-top:2px;letter-spacing:1px;">${e.hierarchy}</div>
                        <div style="font-family:'Orbitron';font-size:${i === 0 ? '1.1rem' : '0.85rem'};color:${MEDAL_COLORS[i]};margin-top:6px;font-weight:700;">${(e.amount || 0).toLocaleString()}</div>
                        <div style="font-family:'Orbitron';font-size:0.35rem;color:rgba(255,255,255,0.3);letter-spacing:1px;">COINS SPENT</div>
                        <div style="margin-top:8px;background:${MEDAL_COLORS[i]};width:100%;height:${pHeights[i]};border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:center;">
                            <span style="font-family:'Orbitron';font-size:0.9rem;color:#000;font-weight:900;">${i + 1}</span>
                        </div>
                    </div>`;
                }).join('')}
            </div>`;

        const rows = rest.map((e: any, i: number) => {
            const avatarSrc = e.avatar || DEFAULT_AVATAR;
            return `
            <div style="display:flex;align-items:center;gap:14px;padding:12px 24px;border-bottom:1px solid rgba(255,255,255,0.04);transition:background 0.12s;"
                 onmouseenter="this.style.background='rgba(197,160,89,0.04)'"
                 onmouseleave="this.style.background='transparent'">
                <div style="font-family:'Orbitron';font-size:0.6rem;color:rgba(255,255,255,0.22);width:24px;text-align:right;flex-shrink:0;">${i + 4}</div>
                <div style="width:38px;height:38px;border-radius:50%;overflow:hidden;flex-shrink:0;border:1.5px solid rgba(255,255,255,0.1);">
                    <img src="${avatarSrc}" style="width:100%;height:100%;object-fit:cover;display:block;" loading="lazy" onerror="this.src='${DEFAULT_AVATAR}'">
                </div>
                <div style="flex:1;min-width:0;">
                    <div style="font-family:'Orbitron';font-size:0.72rem;color:rgba(255,255,255,0.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e.name}</div>
                    <div style="font-family:'Orbitron';font-size:0.42rem;color:rgba(197,160,89,0.5);margin-top:1px;letter-spacing:1px;">${e.hierarchy}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-family:'Orbitron';font-size:0.72rem;color:#c5a059;font-weight:700;">${(e.amount || 0).toLocaleString()}</div>
                    <div style="font-family:'Orbitron';font-size:0.35rem;color:rgba(197,160,89,0.4);letter-spacing:1px;">COINS</div>
                </div>
            </div>`;
        }).join('');

        list.innerHTML = podium + (rows ? `<div>${rows}</div>` : '');
    } catch {
        list.innerHTML = `<div style="text-align:center;padding:40px;font-family:'Orbitron';font-size:0.55rem;color:#ff4444;">FAILED TO LOAD</div>`;
    }
}

// ─── QUEEN FULL ───────────────────────────────────────────────────────────────

async function _loadQueenFull() {
    const panel = document.getElementById('queenFullContent');
    if (!panel) return;
    try {
        const res = await fetch('/api/global/queen');
        const data = await res.json();
        panel.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;padding:40px 20px;gap:20px;max-width:480px;margin:0 auto;text-align:center;">
                <div style="position:relative;">
                    <div style="width:110px;height:110px;border-radius:50%;overflow:hidden;border:3px solid #c5a059;box-shadow:0 0 30px rgba(197,160,89,0.35);">
                        <img src="/queen-nav.png" style="width:100%;height:100%;object-fit:cover;">
                    </div>
                    <div style="position:absolute;bottom:-2px;right:-2px;width:20px;height:20px;border-radius:50%;background:#c5a059;display:flex;align-items:center;justify-content:center;font-size:0.65rem;">👑</div>
                </div>
                <div>
                    <div style="font-family:'Orbitron';font-size:1.5rem;color:#c5a059;font-weight:700;letter-spacing:4px;">Queen Karin</div>
                    <div style="font-family:'Orbitron';font-size:0.5rem;color:rgba(255,255,255,0.35);letter-spacing:3px;margin-top:5px;">SUPREME AUTHORITY · DOMAIN RULER</div>
                </div>
                <div style="width:100%;height:1px;background:linear-gradient(90deg,transparent,rgba(197,160,89,0.3),transparent);"></div>
                <div style="display:flex;gap:30px;justify-content:center;">
                    <div>
                        <div style="font-family:'Orbitron';font-size:1.4rem;color:#fff;font-weight:700;">${data.totalSubjects ?? '-'}</div>
                        <div style="font-family:'Orbitron';font-size:0.45rem;color:rgba(255,255,255,0.35);letter-spacing:2px;margin-top:3px;">SUBJECTS</div>
                    </div>
                    <div style="width:1px;background:rgba(255,255,255,0.08);"></div>
                    <div>
                        <div style="font-family:'Orbitron';font-size:1.4rem;color:#c5a059;font-weight:700;">${(data.totalTribute || 0).toLocaleString()}</div>
                        <div style="font-family:'Orbitron';font-size:0.45rem;color:rgba(255,255,255,0.35);letter-spacing:2px;margin-top:3px;">TOTAL TRIBUTE</div>
                    </div>
                </div>
                <div style="width:100%;height:1px;background:linear-gradient(90deg,transparent,rgba(197,160,89,0.15),transparent);"></div>
                <div style="font-family:'Orbitron';font-size:0.75rem;color:rgba(255,255,255,0.4);font-style:italic;line-height:1.7;max-width:320px;">
                    "Obedience is not weakness. It is the highest form of devotion."
                </div>
            </div>`;
    } catch {}
}

// ─── QUEEN TAB SWITCHER ───────────────────────────────────────────────────────

export function openQueenTab(tab: string) {
    const profileEl = document.getElementById('queenProfileContent');
    const galleryEl = document.getElementById('queenGalleryContent');
    const profileBtn = document.getElementById('queenTab_profile');
    const galleryBtn = document.getElementById('queenTab_gallery');

    if (tab === 'gallery') {
        if (profileEl) profileEl.style.display = 'none';
        if (galleryEl) galleryEl.style.display = 'block';
        if (profileBtn) { profileBtn.style.background = 'transparent'; profileBtn.style.color = 'rgba(255,255,255,0.35)'; }
        if (galleryBtn) { galleryBtn.style.background = 'rgba(197,160,89,0.18)'; galleryBtn.style.color = '#c5a059'; }
        _loadQueenGallery();
    } else {
        if (profileEl) profileEl.style.display = 'block';
        if (galleryEl) galleryEl.style.display = 'none';
        if (profileBtn) { profileBtn.style.background = 'rgba(197,160,89,0.18)'; profileBtn.style.color = '#c5a059'; }
        if (galleryBtn) { galleryBtn.style.background = 'transparent'; galleryBtn.style.color = 'rgba(255,255,255,0.35)'; }
    }
}

export function openGalleryLightbox(url: string, type: string) {
    const lb = document.getElementById('qkGalleryLightbox');
    const media = document.getElementById('qkLightboxMedia');
    if (!lb || !media) return;
    media.innerHTML = type === 'video'
        ? `<video src="${url}" controls autoplay style="max-width:90vw;max-height:90vh;object-fit:contain;border-radius:6px;"></video>`
        : `<img src="${url}" style="max-width:90vw;max-height:90vh;object-fit:contain;border-radius:6px;" />`;
    lb.style.display = 'flex';
}

async function _loadQueenGallery() {
    const el = document.getElementById('queenGalleryContent');
    if (!el) return;
    if (el.dataset.loaded === '1') return;

    el.innerHTML = `<div style="text-align:center;padding:40px;font-family:Orbitron;font-size:0.55rem;color:rgba(255,255,255,0.25);letter-spacing:2px;">LOADING...</div>`;

    try {
        const res = await fetch('/api/global/gallery');
        const { items } = await res.json();

        if (!items?.length) {
            el.innerHTML = `<div style="text-align:center;padding:60px;font-family:Orbitron;font-size:0.6rem;color:rgba(255,255,255,0.18);letter-spacing:2px;">NO GALLERY ITEMS YET</div>`;
            return;
        }

        const grid = items.map((item: any) => `
            <div class="qk-gal-item" onclick="window.openGalleryLightbox('${item.url}','${item.type}')">
                ${item.type === 'video'
                    ? `<video src="${item.url}" preload="none" muted playsinline></video>`
                    : `<img src="${getOptimizedUrl(item.url, 400)}" alt="" loading="lazy" />`
                }
                ${item.caption ? `<div class="qk-gal-caption">${item.caption}</div>` : ''}
            </div>
        `).join('');

        el.innerHTML = `
            <div class="qk-gal-grid">${grid}</div>
            <div id="qkGalleryLightbox" onclick="this.style.display='none'" style="display:none;position:fixed;top:0;right:0;bottom:0;left:320px;background:rgba(0,0,0,0.92);z-index:9999;align-items:center;justify-content:center;cursor:zoom-out;">
                <span id="qkLightboxMedia"></span>
            </div>
        `;
        el.dataset.loaded = '1';
    } catch {
        el.innerHTML = `<div style="text-align:center;padding:40px;font-family:Orbitron;font-size:0.55rem;color:#ff4444;">FAILED TO LOAD</div>`;
    }
}

// ─── CHAT PHOTO UPLOAD ────────────────────────────────────────────────────────

export async function handleGlobalChatPhotoUpload(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    const raw = getState().raw;
    const senderEmail = raw?.member_id || raw?.email;
    if (!senderEmail) return;

    const isVideo = file.type.startsWith('video/');

    // For videos, open a thumbnail picker modal first
    if (isVideo) {
        _openVideoThumbnailPicker(file, senderEmail, raw);
        input.value = '';
        return;
    }

    // Show uploading indicator in input
    const btn = document.querySelector<HTMLButtonElement>('button[title="Send photo"]');
    if (btn) btn.textContent = '⏳';

    try {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const fd = new FormData();
        fd.append('file', file);
        fd.append('bucket', 'media');
        fd.append('folder', 'global-chat');
        fd.append('ext', ext);
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd });
        const uploadData = await uploadRes.json();
        if (!uploadData.url) { if (btn) btn.textContent = '📷'; return; }

        const QUEEN_EMAILS = ['ceo@qkarin.com'];
        const isQueenLocal = QUEEN_EMAILS.includes(senderEmail.toLowerCase());
        const senderName = raw?.name || (isQueenLocal ? 'QUEEN KARIN' : senderEmail.split('@')[0]) || 'SUBJECT';
        const senderAvatar = raw?.avatar_url || raw?.avatar || (isQueenLocal ? '/queen-nav.png' : null);

        // Optimistic render
        _appendMessage({
            sender_name: senderName,
            sender_avatar: senderAvatar,
            sender_email: senderEmail,
            is_queen: isQueenLocal,
            is_me: true,
            message: '[PHOTO]',
            media_url: uploadData.url,
            media_type: 'image',
            created_at: new Date().toISOString(),
        });

        await fetch('/api/global/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: '[PHOTO]', senderEmail, media_url: uploadData.url, media_type: 'image' }),
        });
    } finally {
        input.value = '';
        if (btn) btn.textContent = '📷';
    }
}

// ─── VIDEO THUMBNAIL PICKER ──────────────────────────────────────────────────

function _openVideoThumbnailPicker(file: File, senderEmail: string, raw: any) {
    const overlay = document.createElement('div');
    overlay.id = 'videoThumbPickerOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);';

    const modal = document.createElement('div');
    modal.style.cssText = 'background:#0e0e12;border:1px solid rgba(197,160,89,0.35);border-radius:14px;padding:28px 24px;max-width:520px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.8);';

    modal.innerHTML = `
        <div style="font-family:'Cinzel',serif;font-size:0.85rem;color:#c5a059;letter-spacing:3px;text-align:center;margin-bottom:6px;">PICK A THUMBNAIL</div>
        <div style="font-family:'Orbitron',sans-serif;font-size:0.38rem;color:rgba(255,255,255,0.3);text-align:center;letter-spacing:2px;margin-bottom:20px;">SCRUB THE VIDEO OR UPLOAD YOUR OWN</div>
        <div style="position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:8px;overflow:hidden;margin-bottom:14px;">
            <video id="thumbPickerVideo" style="width:100%;height:100%;object-fit:contain;display:block;" muted playsinline></video>
        </div>
        <input id="thumbPickerScrub" type="range" min="0" max="100" value="0" step="0.1" style="width:100%;margin-bottom:16px;accent-color:#c5a059;cursor:pointer;" />
        <div style="display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;">
            <label style="padding:8px 16px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.6);font-family:'Orbitron';font-size:0.42rem;cursor:pointer;border-radius:6px;letter-spacing:1px;text-align:center;">
                UPLOAD THUMBNAIL
                <input id="thumbPickerCustom" type="file" accept="image/*" style="display:none;" />
            </label>
            <button id="thumbPickerConfirm" style="padding:8px 24px;background:linear-gradient(135deg,#c5a059,#a07830);border:none;color:#000;font-family:'Orbitron';font-size:0.48rem;font-weight:700;cursor:pointer;border-radius:6px;letter-spacing:1px;">USE THIS FRAME</button>
            <button id="thumbPickerCancel" style="padding:8px 16px;background:none;border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.4);font-family:'Orbitron';font-size:0.42rem;cursor:pointer;border-radius:6px;letter-spacing:1px;">CANCEL</button>
        </div>
        <div id="thumbPickerStatus" style="font-family:'Orbitron';font-size:0.38rem;color:rgba(197,160,89,0.5);text-align:center;margin-top:12px;letter-spacing:1px;display:none;"></div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const video = document.getElementById('thumbPickerVideo') as HTMLVideoElement;
    const scrub = document.getElementById('thumbPickerScrub') as HTMLInputElement;
    const confirmBtn = document.getElementById('thumbPickerConfirm') as HTMLButtonElement;
    const cancelBtn = document.getElementById('thumbPickerCancel') as HTMLButtonElement;
    const customInput = document.getElementById('thumbPickerCustom') as HTMLInputElement;
    const statusEl = document.getElementById('thumbPickerStatus') as HTMLElement;

    let customThumbFile: File | null = null;

    // Load video from file
    const videoUrl = URL.createObjectURL(file);
    video.src = videoUrl;
    video.addEventListener('loadedmetadata', () => {
        video.currentTime = 0;
    });

    // Scrub to pick frame
    scrub.addEventListener('input', () => {
        if (video.duration) {
            video.currentTime = (parseFloat(scrub.value) / 100) * video.duration;
        }
        customThumbFile = null;
        confirmBtn.textContent = 'USE THIS FRAME';
    });

    // Custom thumbnail upload
    customInput.addEventListener('change', () => {
        const f = customInput.files?.[0];
        if (!f) return;
        customThumbFile = f;
        const reader = new FileReader();
        reader.onload = () => {
            video.style.display = 'none';
            const parent = video.parentElement!;
            let img = parent.querySelector('img#thumbPreviewImg') as HTMLImageElement;
            if (!img) {
                img = document.createElement('img');
                img.id = 'thumbPreviewImg';
                img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;';
                parent.appendChild(img);
            }
            img.src = reader.result as string;
            confirmBtn.textContent = 'USE CUSTOM THUMBNAIL';
        };
        reader.readAsDataURL(f);
    });

    // Cancel
    cancelBtn.addEventListener('click', () => {
        URL.revokeObjectURL(videoUrl);
        overlay.remove();
    });
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) { URL.revokeObjectURL(videoUrl); overlay.remove(); }
    });

    // Confirm — capture frame or use custom, then upload both video + thumbnail
    confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        statusEl.style.display = 'block';
        statusEl.textContent = 'UPLOADING VIDEO...';

        try {
            // 1) Upload the video via signed URL (bypasses Next.js body size limit)
            const vExt = (file.name.split('.').pop() || 'mp4').toLowerCase();
            const vPath = `global-chat/${crypto.randomUUID()}.${vExt}`;
            const signRes = await fetch('/api/upload/signed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bucket: 'media', path: vPath }),
            });
            const signData = await signRes.json();
            if (!signData.signedUrl) { statusEl.textContent = 'VIDEO UPLOAD FAILED'; confirmBtn.disabled = false; return; }

            // Direct upload to Supabase Storage
            const upRes = await fetch(signData.signedUrl, {
                method: 'PUT',
                headers: { 'Content-Type': file.type || 'video/mp4' },
                body: file,
            });
            if (!upRes.ok) { statusEl.textContent = 'VIDEO UPLOAD FAILED'; confirmBtn.disabled = false; return; }
            const videoPublicUrl = signData.publicUrl;

            // 2) Upload the thumbnail (small, can use normal route)
            statusEl.textContent = 'UPLOADING THUMBNAIL...';
            let thumbBlob: Blob;
            if (customThumbFile) {
                thumbBlob = customThumbFile;
            } else {
                // Capture current frame from canvas
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth || 640;
                canvas.height = video.videoHeight || 360;
                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                thumbBlob = await new Promise<Blob>((res) => canvas.toBlob(b => res(b!), 'image/jpeg', 0.85));
            }

            const tFd = new FormData();
            tFd.append('file', new File([thumbBlob], 'thumb.jpg', { type: customThumbFile?.type || 'image/jpeg' }));
            tFd.append('bucket', 'media');
            tFd.append('folder', 'global-chat');
            tFd.append('ext', customThumbFile ? (customThumbFile.name.split('.').pop() || 'jpg') : 'jpg');
            const tRes = await fetch('/api/upload', { method: 'POST', body: tFd });
            const tData = await tRes.json();
            const thumbUrl = tData.url || '';

            // 3) Send message with video + thumbnail
            const QUEEN_EMAILS = ['ceo@qkarin.com'];
            const isQueenLocal = QUEEN_EMAILS.includes(senderEmail.toLowerCase());
            const senderName = raw?.name || (isQueenLocal ? 'QUEEN KARIN' : senderEmail.split('@')[0]) || 'SUBJECT';
            const senderAvatar = raw?.avatar_url || raw?.avatar || (isQueenLocal ? '/queen-nav.png' : null);

            _appendMessage({
                sender_name: senderName,
                sender_avatar: senderAvatar,
                sender_email: senderEmail,
                is_queen: isQueenLocal,
                is_me: true,
                message: '[VIDEO]',
                media_url: videoPublicUrl,
                media_type: 'video',
                thumbnail_url: thumbUrl,
                created_at: new Date().toISOString(),
            });

            await fetch('/api/global/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: '[VIDEO]', senderEmail, media_url: videoPublicUrl, media_type: 'video', thumbnail_url: thumbUrl }),
            });

            URL.revokeObjectURL(videoUrl);
            overlay.remove();
        } catch (err) {
            statusEl.textContent = 'UPLOAD FAILED';
            confirmBtn.disabled = false;
        }
    });
}

// ─── NEWS (QUEEN VIDEOS) PREVIEW ──────────────────────────────────────────────

async function _loadChallengesPreview() {
    const el = document.getElementById('globalPreview_challenges');
    if (!el) return;
    try {
        const res = await fetch('/api/global/queen-videos');
        const { videos } = await res.json();
        _queenVideosList = videos || [];
        if (!videos?.length) {
            el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;padding:16px;"><span style="font-size:1.4rem;opacity:0.2;">&#9654;</span><span style="font-family:'Orbitron';font-size:0.38rem;color:rgba(197,160,89,0.3);letter-spacing:2px;text-align:center;">NO VIDEOS YET</span></div>`;
            return;
        }
        el.innerHTML = videos.slice(0, 4).map((v: any) => {
            const date = new Date(v.created_at);
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
            const thumb = v.thumbnail_url || '/queen-karin.png';
            const caption = (v.message || '').replace(/<[^>]+>/g, '');
            return `<div style="display:flex;gap:12px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.04);cursor:pointer;" onclick="window._playQueenVideo&&window._playQueenVideo('${v.media_url.replace(/'/g, "\\'")}')">
                <div style="width:80px;height:50px;flex-shrink:0;border-radius:6px;overflow:hidden;position:relative;background:#000;">
                    <img src="${thumb}" style="width:100%;height:100%;object-fit:cover;" onerror="this.src='/queen-karin.png'" />
                    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
                        <div style="width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,0.5);border:1px solid rgba(197,160,89,0.5);display:flex;align-items:center;justify-content:center;">
                            <div style="width:0;height:0;border-style:solid;border-width:4px 0 4px 7px;border-color:transparent transparent transparent rgba(197,160,89,0.9);margin-left:1px;"></div>
                        </div>
                    </div>
                </div>
                <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;">
                    ${caption ? `<div style="font-family:'Rajdhani',sans-serif;font-size:0.78rem;color:rgba(255,255,255,0.55);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${caption}</div>` : ''}
                    <div style="font-family:Orbitron;font-size:0.32rem;color:rgba(255,255,255,0.2);letter-spacing:1px;margin-top:2px;">${dateStr}</div>
                </div>
            </div>`;
        }).join('');
    } catch {
        el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.15);">-</div>`;
    }
}

let _queenVideosList: any[] = [];

function _fmtTime(s: number) { const m = Math.floor(s / 60); return m + ':' + String(Math.floor(s % 60)).padStart(2, '0'); }

function _playQueenVideo(url: string) {
    const existing = document.getElementById('_queenVideoOverlay');
    if (existing) {
        const vid = existing.querySelector('video') as HTMLVideoElement;
        if (vid) { vid.src = url; vid.play().catch(() => {}); }
        existing.querySelectorAll('[data-qv-url]').forEach((el: any) => {
            el.style.border = el.dataset.qvUrl === url ? '2px solid rgba(197,160,89,1)' : '2px solid rgba(255,255,255,0.15)';
            el.style.boxShadow = el.dataset.qvUrl === url ? '0 0 10px rgba(197,160,89,0.4)' : 'none';
        });
        return;
    }
    const overlay = document.createElement('div');
    overlay.id = '_queenVideoOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999999;background:#000;display:flex;flex-direction:column;';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&#10005;';
    closeBtn.style.cssText = 'position:absolute;top:env(safe-area-inset-top,16px);right:16px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#fff;width:36px;height:36px;border-radius:50%;font-size:1.2rem;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2;margin-top:16px;';
    closeBtn.onclick = () => overlay.remove();

    // Video area — no native controls to prevent iOS fullscreen takeover
    const videoWrap = document.createElement('div');
    videoWrap.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;min-height:0;overflow:hidden;position:relative;';
    const video = document.createElement('video');
    video.src = url;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.style.cssText = 'width:100%;height:100%;object-fit:contain;';
    video.onended = () => overlay.remove();
    videoWrap.appendChild(video);

    // Tap video to play/pause
    const playPauseBtn = document.createElement('div');
    playPauseBtn.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:1;';
    playPauseBtn.innerHTML = '<div id="_qvPlayIcon" style="width:60px;height:60px;border-radius:50%;background:rgba(0,0,0,0.5);border:2px solid rgba(197,160,89,0.5);display:none;align-items:center;justify-content:center;"><div style="width:0;height:0;border-style:solid;border-width:10px 0 10px 18px;border-color:transparent transparent transparent rgba(197,160,89,0.9);margin-left:4px;"></div></div>';
    playPauseBtn.onclick = (e) => {
        e.stopPropagation();
        if (video.paused) { video.play().catch(() => {}); } else { video.pause(); }
    };
    videoWrap.appendChild(playPauseBtn);

    video.onpause = () => { const ic = overlay.querySelector('#_qvPlayIcon') as HTMLElement; if (ic) ic.style.display = 'flex'; };
    video.onplay = () => { const ic = overlay.querySelector('#_qvPlayIcon') as HTMLElement; if (ic) ic.style.display = 'none'; };

    // Custom progress bar
    const controls = document.createElement('div');
    controls.style.cssText = 'flex-shrink:0;padding:8px 16px;display:flex;align-items:center;gap:10px;';
    const timeEl = document.createElement('span');
    timeEl.style.cssText = 'font-family:Orbitron;font-size:0.38rem;color:rgba(255,255,255,0.5);min-width:32px;';
    timeEl.textContent = '0:00';
    const progressWrap = document.createElement('div');
    progressWrap.style.cssText = 'flex:1;height:4px;background:rgba(255,255,255,0.12);border-radius:2px;cursor:pointer;position:relative;';
    const progressFill = document.createElement('div');
    progressFill.style.cssText = 'height:100%;background:rgba(197,160,89,0.8);border-radius:2px;width:0%;transition:width 0.1s;';
    progressWrap.appendChild(progressFill);
    const durEl = document.createElement('span');
    durEl.style.cssText = 'font-family:Orbitron;font-size:0.38rem;color:rgba(255,255,255,0.5);min-width:32px;text-align:right;';
    durEl.textContent = '0:00';
    controls.appendChild(timeEl);
    controls.appendChild(progressWrap);
    controls.appendChild(durEl);

    video.ontimeupdate = () => {
        if (!video.duration) return;
        const pct = (video.currentTime / video.duration) * 100;
        progressFill.style.width = pct + '%';
        timeEl.textContent = _fmtTime(video.currentTime);
    };
    video.onloadedmetadata = () => { durEl.textContent = _fmtTime(video.duration); };
    progressWrap.onclick = (e) => {
        const rect = progressWrap.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        video.currentTime = pct * video.duration;
    };

    // Circle strip
    const strip = document.createElement('div');
    strip.style.cssText = 'flex-shrink:0;display:flex;gap:12px;padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));overflow-x:auto;justify-content:center;border-top:1px solid rgba(255,255,255,0.06);-webkit-overflow-scrolling:touch;';
    _queenVideosList.forEach((v: any) => {
        const circle = document.createElement('div');
        circle.dataset.qvUrl = v.media_url;
        const isActive = v.media_url === url;
        circle.style.cssText = `width:52px;height:52px;border-radius:50%;overflow:hidden;flex-shrink:0;cursor:pointer;border:2px solid ${isActive ? 'rgba(197,160,89,1)' : 'rgba(255,255,255,0.15)'};box-shadow:${isActive ? '0 0 10px rgba(197,160,89,0.4)' : 'none'};position:relative;`;
        const thumb = v.thumbnail_url || '/queen-karin.png';
        circle.innerHTML = `<img src="${thumb}" style="width:100%;height:100%;object-fit:cover;" onerror="this.src='/queen-karin.png'" /><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.2);"><div style="width:0;height:0;border-style:solid;border-width:5px 0 5px 8px;border-color:transparent transparent transparent rgba(255,255,255,0.8);margin-left:1px;"></div></div>`;
        circle.onclick = (e) => { e.stopPropagation(); (window as any)._playQueenVideo(v.media_url); };
        strip.appendChild(circle);
    });

    overlay.appendChild(closeBtn);
    overlay.appendChild(videoWrap);
    overlay.appendChild(controls);
    if (_queenVideosList.length > 1) overlay.appendChild(strip);
    document.body.appendChild(overlay);
}
if (typeof window !== 'undefined') (window as any)._playQueenVideo = _playQueenVideo;

// ─── PHOTO UPLOAD ─────────────────────────────────────────────────────────────

export async function handleGlobalPhotoUpload(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    const raw = getState().raw;
    if (!raw?.email) return;
    const btn = document.getElementById('globalUploadBtn');
    if (btn) btn.textContent = 'UPLOADING...';
    const formData = new FormData();
    formData.append('file', file);
    formData.append('email', raw.email);
    try {
        const res = await fetch('/api/global/updates', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) { input.value = ''; await _loadUpdatesFull(); }
    } finally {
        if (btn) btn.textContent = '+ SHARE PHOTO';
    }
}

