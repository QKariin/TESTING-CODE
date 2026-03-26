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

const DEFAULT_AVATAR = '/queen-karin.png';
const MEDAL_COLORS = ['#c5a059', '#9ca3af', '#cd7f32'];
const MEDALS = ['🥇', '🥈', '🥉'];

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
}

export function closeGlobalSection() { _showMain(); }

// ─── MAIN VIEW ────────────────────────────────────────────────────────────────

function _showMain() {
    _stopPoll();
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
    // updatesChannel intentionally kept alive while overlay is open
}

function _stopUpdatesRealtime() {
    if (updatesChannel) { updatesChannel.unsubscribe(); updatesChannel = null; }
}

// ─── OPEN EXPANDED ────────────────────────────────────────────────────────────

export function openGlobalSection(section: 'leaderboard' | 'talk' | 'updates' | 'spenders' | 'queen' | 'exchequer') {
    _stopPoll();
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
    _loadSidePanels();
    _initTalkRealtime();
    _loadUpdatesPreview();
    _initUpdatesRealtime();
    _loadSpendersPreview();
    _loadQueenPreview();
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
                    <div style="font-family:'Cinzel';font-size:${isFirst ? '0.58rem' : '0.5rem'};color:#fff;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;padding:0 2px;font-weight:${isFirst ? 700 : 400};line-height:1.2;">${e.name}</div>
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
                    <div style="font-family:'Cinzel';font-size:0.55rem;color:rgba(255,255,255,0.8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2;">${e.name}</div>
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

async function _loadSidePanels() {
    try {
        const res = await fetch('/api/global/sidepanels');
        const { kneelers, spenders, streakers } = await res.json();
        _renderMiniPanel('lbMini_kneelers', kneelers, (e: any) => `${e.count}✦`, 'rgba(74,222,128,0.7)');
        _renderMiniPanel('lbMini_spenders', spenders, (e: any) => `${e.amount.toLocaleString()}`, '#c5a059');
        _renderMiniPanel('lbMini_streakers', streakers, (e: any) => `${e.streak}d`, 'rgba(255,140,100,0.85)');
    } catch {}
}

function _renderMiniPanel(elId: string, entries: any[], valueLabel: (e: any) => string, accentColor: string) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (!entries?.length) {
        el.innerHTML = `<div style="padding:8px 10px;font-family:'Orbitron';font-size:0.35rem;color:rgba(255,255,255,0.15);text-align:center;">—</div>`;
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
            <div style="font-family:'Cinzel';font-size:0.52rem;color:rgba(255,255,255,${i === 0 ? '0.9' : '0.55'});white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;font-weight:${i === 0 ? '700' : '400'};">${e.name}</div>
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
                <div style="width:22px;height:22px;border-radius:50%;background:rgba(197,160,89,0.12);border:1px solid rgba(197,160,89,0.22);display:flex;align-items:center;justify-content:center;font-family:'Cinzel';font-size:0.5rem;color:#c5a059;flex-shrink:0;">${initial}</div>
                <div style="flex:1;min-width:0;">
                    <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(197,160,89,0.55);letter-spacing:1px;margin-bottom:2px;">${name}</div>
                    <div style="font-family:'Rajdhani';font-size:0.78rem;color:rgba(255,255,255,0.65);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${(m.message||'').startsWith('PROMOTION_CARD::') ? '✦ RANK PROMOTION' : m.message}</div>
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
        const updates = (data.updates || []).slice(0, 4);
        if (!updates.length) {
            el.innerHTML = `<div style="text-align:center;padding:24px;font-family:'Orbitron';font-size:0.48rem;color:rgba(255,255,255,0.15);">NO UPDATES YET</div>`;
            return;
        }
        el.innerHTML = updates.map((u: any) => _buildUpdateCardPreview(u)).join('');
    } catch {}
}

function _buildUpdateCardPreview(u: any): string {
    if (u.kind === 'tribute') {
        const initial = (u.sender_name || 'S')[0].toUpperCase();
        const time = new Date(u.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const coverSrc = u.sender_avatar || '';
        return `<div style="margin:6px 8px;overflow:hidden;background:#0a0a14;border:1px solid rgba(197,160,89,0.35);border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,0.5);">
            <div style="width:100%;height:110px;overflow:hidden;position:relative;background:#0d0d1a;display:flex;align-items:center;justify-content:center;">
                ${coverSrc
                    ? `<img src="${coverSrc}" style="width:100%;height:100%;object-fit:cover;object-position:center;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                    : ''}
                <div style="display:${coverSrc ? 'none' : 'flex'};position:absolute;inset:0;align-items:center;justify-content:center;font-family:'Cinzel';font-size:2.5rem;color:rgba(197,160,89,0.4);">${initial}</div>
                <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 50%,rgba(10,10,20,0.85) 100%);"></div>
                <div style="position:absolute;bottom:8px;left:12px;font-family:'Orbitron';font-size:0.38rem;color:rgba(197,160,89,0.7);letter-spacing:2px;">✦ GIFT SENT</div>
            </div>
            <div style="padding:10px 12px 10px;">
                <div style="font-family:'Cinzel';font-size:0.72rem;color:#fff;font-weight:700;letter-spacing:1px;text-transform:uppercase;line-height:1.3;">${u.title}</div>
                <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;">
                    <span style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.4);letter-spacing:1px;">${u.sender_name}</span>
                    <span style="font-family:'Orbitron';font-size:0.35rem;color:rgba(255,255,255,0.2);">${time}</span>
                </div>
            </div>
        </div>`;
    }
    if (u.kind === 'points') {
        return `<div style="display:flex;align-items:center;gap:7px;padding:5px 10px;border-bottom:1px solid rgba(255,255,255,0.04);">
            <div style="font-size:0.75rem;flex-shrink:0;">⚡</div>
            <div style="flex:1;min-width:0;">
                <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.4);letter-spacing:1px;">${u.sender_name}</div>
                <div style="font-family:'Rajdhani';font-size:0.75rem;color:#a78bfa;">+${u.points} MERIT</div>
            </div>
        </div>`;
    }
    // photo
    return `<div style="display:flex;align-items:center;gap:7px;padding:5px 10px;border-bottom:1px solid rgba(255,255,255,0.04);">
        <div style="width:32px;height:32px;border-radius:4px;overflow:hidden;flex-shrink:0;">
            <img src="${getOptimizedUrl(u.media_url, 64)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy">
        </div>
        <div style="flex:1;min-width:0;">
            <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.4);letter-spacing:1px;">${u.sender_name}</div>
            ${u.caption ? `<div style="font-family:'Rajdhani';font-size:0.75rem;color:rgba(255,255,255,0.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${u.caption}</div>` : ''}
        </div>
    </div>`;
}

// ─── SPENDERS PREVIEW ────────────────────────────────────────────────────────

async function _loadSpendersPreview() {
    const el = document.getElementById('globalPreview_spenders');
    if (!el) return;
    try {
        const res = await fetch('/api/global/sidepanels');
        const { spenders } = await res.json();
        if (!spenders?.length) {
            el.innerHTML = `<div style="text-align:center;padding:24px;font-family:'Orbitron';font-size:0.48rem;color:rgba(255,255,255,0.15);">NO DATA YET</div>`;
            return;
        }
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
                    <div style="font-family:'Cinzel';font-size:0.6rem;color:rgba(255,255,255,${i === 0 ? '1' : '0.65'});white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:${i === 0 ? 700 : 400};">${e.name}</div>
                    <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(197,160,89,0.45);letter-spacing:1px;margin-top:1px;">${e.hierarchy}</div>
                </div>
                <div style="font-family:'Orbitron';font-size:0.58rem;color:${i === 0 ? '#c5a059' : 'rgba(255,255,255,0.35)'};font-weight:700;flex-shrink:0;">${(e.amount || 0).toLocaleString()}</div>
            </div>`;
        }).join('');
    } catch {}
}

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
                    <img src="/queen-karin.png" style="width:100%;height:100%;object-fit:cover;">
                </div>
                <div>
                    <div style="font-family:'Cinzel';font-size:0.8rem;color:#c5a059;font-weight:700;letter-spacing:2px;">Queen Karin</div>
                    <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.3);letter-spacing:2px;margin-top:2px;">SUPREME AUTHORITY</div>
                </div>
                <div style="display:flex;gap:12px;margin-top:4px;">
                    <div style="text-align:center;">
                        <div style="font-family:'Orbitron';font-size:0.75rem;color:#fff;font-weight:700;">${data.totalSubjects ?? '—'}</div>
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
                    <div style="font-family:'Cinzel';font-size:${i === 0 ? '0.78rem' : '0.65rem'};color:#fff;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;font-weight:${i === 0 ? 700 : 400};">${e.name}</div>
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
                <div style="font-family:'Cinzel';font-size:0.72rem;color:rgba(255,255,255,0.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e.name}</div>
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
                const myEmail = getState().raw?.member_id || getState().raw?.email || '';
                // Skip own messages — already shown optimistically on send
                if ((payload.new?.sender_email || '').toLowerCase() === myEmail.toLowerCase()) return;
                _appendMessage(payload.new);
            }
        )
        .subscribe();

    // Presence heartbeat — update last_active every 30s
    const raw = getState().raw;
    const email = raw?.member_id || raw?.email;
    if (email) {
        const heartbeat = () => fetch('/api/global/presence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        }).catch(() => {});
        heartbeat();
        presenceInterval = setInterval(heartbeat, 30000);
    }

    // Poll online users every 30s
    talkPollInterval = setInterval(_fetchAndRenderOnline, 30000);
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
    const myEmail = getState().raw?.member_id || getState().raw?.email || '';
    const wasNear = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 100;
    const el = document.createElement('div');
    el.innerHTML = _buildBubble(msg, myEmail);
    feed.appendChild(el.firstElementChild!);
    if (wasNear) feed.scrollTop = feed.scrollHeight;
}

// ─── RENDER ALL MESSAGES ──────────────────────────────────────────────────────

function _renderMessages(messages: any[], scrollBottom: boolean) {
    const feed = document.getElementById('globalTalkFeed');
    if (!feed) return;
    const myEmail = getState().raw?.member_id || getState().raw?.email || '';
    if (!messages.length) {
        feed.innerHTML = `<div style="text-align:center;padding:60px 20px;font-family:'Orbitron';font-size:0.6rem;color:rgba(255,255,255,0.18);letter-spacing:3px;">BE THE FIRST TO SPEAK</div>`;
        return;
    }
    const wasNear = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 100;
    feed.innerHTML = messages.map(m => _buildBubble(m, myEmail)).join('');
    if (scrollBottom || wasNear) feed.scrollTop = feed.scrollHeight;
}

const QUEEN_EMAILS = ['ceo@qkarin.com', 'liviacechova@gmail.com'];

function _buildBubble(msg: any, myEmail: string): string {
    const senderEmailLower = (msg.sender_email || '').toLowerCase();
    const isMe = senderEmailLower === myEmail.toLowerCase();
    const isQueen = QUEEN_EMAILS.includes(senderEmailLower);
    const content = msg.message || '';
    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // ── Promotion Card ── centered
    if (content.startsWith('PROMOTION_CARD::')) {
        try {
            const d = JSON.parse(content.replace('PROMOTION_CARD::', ''));
            const photoBlock = d.photo
                ? `<img src="${d.photo}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none'">`
                : '';
            return `<div style="display:flex;justify-content:center;padding:8px 14px;margin-bottom:14px;">
                <div>
                    <div style="width:260px;max-width:72vw;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0e0b06 0%,#110d04 60%,#0a0703 100%);border:1px solid rgba(197,160,89,0.5);box-shadow:0 12px 40px rgba(0,0,0,0.8);">
                        <div style="position:relative;width:100%;height:150px;background:#0a0703;overflow:hidden;">
                            ${photoBlock}
                            <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,#0e0b06 100%);"></div>
                            <div style="position:absolute;top:10px;left:50%;transform:translateX(-50%);background:rgba(10,7,2,0.9);border:1px solid rgba(197,160,89,0.5);border-radius:20px;padding:4px 14px;white-space:nowrap;">
                                <span style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:#c5a059;letter-spacing:3px;">✦ RANK PROMOTION</span>
                            </div>
                        </div>
                        <div style="padding:14px 18px 18px;text-align:center;">
                            <div style="font-family:'Cinzel',serif;font-size:0.95rem;color:#fff;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">${d.name||''}</div>
                            <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:12px;">
                                <span style="font-family:'Orbitron',sans-serif;font-size:0.48rem;color:rgba(197,160,89,0.4);letter-spacing:1px;text-decoration:line-through;">${(d.oldRank||'').toUpperCase()}</span>
                                <span style="color:rgba(197,160,89,0.7);font-size:0.9rem;">→</span>
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
    const name = msg.sender_name || 'SUBJECT';
    const av = msg.sender_avatar;
    const initial = (name[0] || 'S').toUpperCase();

    // Build media block if present
    const mediaHtml = msg.media_url ? (
        msg.media_type === 'video'
            ? `<video src="${msg.media_url}" controls playsinline preload="metadata" style="width:100%;border-radius:8px;margin-top:8px;max-height:300px;object-fit:cover;display:block;"></video>`
            : `<img src="${msg.media_url}" style="width:100%;border-radius:8px;margin-top:8px;max-height:300px;object-fit:cover;display:block;" />`
    ) : '';
    const hasMedia = !!msg.media_url;

    // Queen/admin message — golden bubble, right-aligned if sent by me, left if by another queen
    if (isQueen) {
        if (isMe) {
            return `<div style="display:flex;flex-direction:column;align-items:flex-end;margin-bottom:14px;padding:0 14px;">
                <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(197,160,89,0.5);margin-bottom:4px;letter-spacing:1px;">QUEEN KARIN · ${time}</div>
                <div style="max-width:${hasMedia ? '85%' : '70%'};padding:9px 13px;background:linear-gradient(135deg,rgba(197,160,89,0.18),rgba(139,109,20,0.12));border:1px solid rgba(197,160,89,0.45);border-radius:14px 14px 3px 14px;box-shadow:0 0 12px rgba(197,160,89,0.15);overflow:hidden;">
                    <div style="font-family:'Rajdhani';font-size:0.92rem;color:#f0d888;line-height:1.45;">${msg.message}</div>
                    ${mediaHtml}
                </div>
            </div>`;
        }
        const avatarHtml = av
            ? `<img src="${av}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
            : '';
        return `<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:14px;padding:0 14px;">
            <div style="width:32px;height:32px;border-radius:50%;background:rgba(197,160,89,0.15);border:1px solid rgba(197,160,89,0.5);overflow:hidden;flex-shrink:0;position:relative;box-shadow:0 0 8px rgba(197,160,89,0.3);">
                ${avatarHtml}
                <div style="display:${av ? 'none' : 'flex'};position:absolute;inset:0;align-items:center;justify-content:center;font-family:'Cinzel';font-size:0.6rem;color:#c5a059;">♛</div>
            </div>
            <div style="max-width:${hasMedia ? '85%' : '70%'};">
                <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(197,160,89,0.7);margin-bottom:4px;letter-spacing:1px;">QUEEN KARIN · ${time}</div>
                <div style="padding:9px 13px;background:linear-gradient(135deg,rgba(197,160,89,0.18),rgba(139,109,20,0.12));border:1px solid rgba(197,160,89,0.45);border-radius:3px 14px 14px 14px;box-shadow:0 0 12px rgba(197,160,89,0.15);overflow:hidden;">
                    <div style="font-family:'Rajdhani';font-size:0.92rem;color:#f0d888;line-height:1.45;">${msg.message}</div>
                    ${mediaHtml}
                </div>
            </div>
        </div>`;
    }

    if (isMe) {
        return `<div style="display:flex;flex-direction:column;align-items:flex-end;margin-bottom:14px;padding:0 14px;">
            <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.22);margin-bottom:4px;letter-spacing:1px;">YOU · ${time}</div>
            <div style="max-width:70%;padding:9px 13px;background:rgba(55,55,60,0.85);border:1px solid rgba(100,100,110,0.3);border-radius:14px 14px 3px 14px;">
                <div style="font-family:'Rajdhani';font-size:0.92rem;color:#e8e8e8;line-height:1.45;">${msg.message}</div>
            </div>
        </div>`;
    }

    const avatarHtml = av
        ? `<img src="${av}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        : '';
    return `<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:14px;padding:0 14px;">
        <div style="width:32px;height:32px;border-radius:50%;background:rgba(197,160,89,0.1);border:1px solid rgba(197,160,89,0.25);overflow:hidden;flex-shrink:0;position:relative;">
            ${avatarHtml}
            <div style="display:${av ? 'none' : 'flex'};position:absolute;inset:0;align-items:center;justify-content:center;font-family:'Cinzel';font-size:0.6rem;color:#c5a059;">${initial}</div>
        </div>
        <div style="max-width:70%;">
            <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(197,160,89,0.55);margin-bottom:4px;letter-spacing:1px;">${name} · ${time}</div>
            <div style="padding:9px 13px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:3px 14px 14px 14px;">
                <div style="font-family:'Rajdhani';font-size:0.92rem;color:#e8e8e8;line-height:1.45;">${msg.message}</div>
            </div>
        </div>
    </div>`;
}

// ─── ONLINE USERS STRIP ───────────────────────────────────────────────────────

async function _fetchAndRenderOnline() {
    try {
        const res = await fetch('/api/global/presence');
        const { online } = await res.json();
        _renderOnlineUsers(online || []);
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
        const avHtml = u.avatar
            ? `<img src="${u.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div style="display:none;position:absolute;inset:0;align-items:center;justify-content:center;font-family:'Cinzel';font-size:0.55rem;color:#c5a059;">${initial}</div>`
            : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Cinzel';font-size:0.55rem;color:#c5a059;">${initial}</div>`;
        return `<div title="${u.name}" style="position:relative;flex-shrink:0;">
            <div style="width:30px;height:30px;border-radius:50%;background:rgba(197,160,89,0.1);border:1.5px solid rgba(74,222,128,0.45);overflow:hidden;position:relative;">
                ${avHtml}
            </div>
            <div style="position:absolute;bottom:0;right:0;width:7px;height:7px;border-radius:50%;background:#4ade80;border:1.5px solid #04040e;box-shadow:0 0 5px #4ade80;"></div>
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

    // Optimistic: show instantly with local profile data
    const QUEEN_EMAILS_LOCAL = ['ceo@qkarin.com', 'liviacechova@gmail.com'];
    const isQueenLocal = QUEEN_EMAILS_LOCAL.includes(senderEmail.toLowerCase());
    const senderName = raw?.name || (isQueenLocal ? 'QUEEN KARIN' : senderEmail.split('@')[0]) || 'SUBJECT';
    const senderAvatar = raw?.avatar_url || raw?.avatar || (isQueenLocal ? '/queen-karin.png' : null);
    _appendMessage({
        sender_email: senderEmail,
        sender_name: senderName,
        sender_avatar: senderAvatar,
        message,
        created_at: new Date().toISOString(),
    });

    try {
        await fetch('/api/global/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, senderEmail }),
        });
        // Realtime will NOT duplicate — the optimistic bubble already shows it.
        // On next poll/open the real record loads with correct name/avatar.
    } catch {}
}

export function handleGlobalTalkKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendGlobalMessage(); }
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
    const time = new Date(u.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const coverSrc = u.sender_avatar || '';
    const initial = (u.sender_name || 'S')[0].toUpperCase();
    return `
    <div style="background:#0a0a14;border:1px solid rgba(197,160,89,0.35);border-radius:14px;overflow:hidden;max-width:320px;width:100%;box-shadow:0 8px 30px rgba(0,0,0,0.5);">
        <div style="width:100%;height:140px;overflow:hidden;position:relative;background:#0d0d1a;display:flex;align-items:center;justify-content:center;">
            ${coverSrc
                ? `<img src="${coverSrc}" style="width:100%;height:100%;object-fit:cover;object-position:center;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                : ''}
            <div style="display:${coverSrc ? 'none' : 'flex'};position:absolute;inset:0;align-items:center;justify-content:center;font-family:'Cinzel';font-size:3rem;color:rgba(197,160,89,0.4);">${initial}</div>
            <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 50%,rgba(10,10,20,0.88) 100%);"></div>
            <div style="position:absolute;bottom:10px;left:14px;font-family:'Orbitron';font-size:0.4rem;color:rgba(197,160,89,0.75);letter-spacing:2px;">✦ GIFT SENT</div>
        </div>
        <div style="padding:12px 14px 14px;">
            <div style="font-family:'Cinzel';font-size:0.82rem;color:#fff;font-weight:700;letter-spacing:1px;text-transform:uppercase;line-height:1.3;">${u.title}</div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;">
                <span style="font-family:'Orbitron';font-size:0.42rem;color:rgba(255,255,255,0.4);letter-spacing:1px;">${u.sender_name}</span>
                <span style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.2);">${time}</span>
            </div>
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
    <div style="background:rgba(167,139,250,0.05);border:1px solid rgba(167,139,250,0.25);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:14px;max-width:320px;width:100%;">
        <div style="width:42px;height:42px;border-radius:50%;background:rgba(167,139,250,0.1);border:1.5px solid rgba(167,139,250,0.35);overflow:hidden;position:relative;flex-shrink:0;">
            ${avHtml}
            <div style="display:${u.sender_avatar ? 'none' : 'flex'};position:absolute;inset:0;align-items:center;justify-content:center;font-family:'Cinzel';font-size:0.65rem;color:#a78bfa;">${initial}</div>
        </div>
        <div style="flex:1;min-width:0;">
            <div style="font-family:'Orbitron';font-size:0.42rem;color:rgba(255,255,255,0.35);letter-spacing:1px;margin-bottom:3px;">⚡ MERIT EARNED</div>
            <div style="font-family:'Cinzel';font-size:0.82rem;color:#fff;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${u.sender_name}</div>
            <div style="font-family:'Orbitron';font-size:0.85rem;color:#a78bfa;font-weight:700;margin-top:2px;">+${u.points} MERIT</div>
        </div>
        <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.2);flex-shrink:0;align-self:flex-start;">${time}</div>
    </div>`;
}

function _buildPhotoCard(u: any): string {
    const time = new Date(u.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `
    <div style="background:#0a0a14;border:1px solid rgba(197,160,89,0.1);border-radius:10px;overflow:hidden;max-width:320px;width:100%;position:relative;"
         onmouseenter="this.querySelector('.uinfo').style.opacity='1'"
         onmouseleave="this.querySelector('.uinfo').style.opacity='0'">
        <img src="${getOptimizedUrl(u.media_url, 400)}" style="width:100%;max-height:220px;object-fit:cover;display:block;" loading="lazy">
        <div class="uinfo" style="position:absolute;bottom:0;left:0;right:0;padding:8px 10px;background:linear-gradient(transparent,rgba(0,0,0,0.88));opacity:0;transition:opacity 0.15s;">
            <div style="font-family:'Cinzel';font-size:0.62rem;color:#fff;">${u.sender_name} <span style="font-family:'Orbitron';font-size:0.35rem;color:rgba(255,255,255,0.3);">${time}</span></div>
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
                        if (preview) preview.innerHTML = updates.slice(0, 4).map((u: any) => _buildUpdateCardPreview(u)).join('');
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
                        <div style="font-family:'Cinzel';font-size:${i === 0 ? '0.78rem' : '0.65rem'};color:#fff;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;font-weight:${i === 0 ? 700 : 400};">${e.name}</div>
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
                    <div style="font-family:'Cinzel';font-size:0.72rem;color:rgba(255,255,255,0.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e.name}</div>
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
                        <img src="/queen-karin.png" style="width:100%;height:100%;object-fit:cover;">
                    </div>
                    <div style="position:absolute;bottom:-2px;right:-2px;width:20px;height:20px;border-radius:50%;background:#c5a059;display:flex;align-items:center;justify-content:center;font-size:0.65rem;">👑</div>
                </div>
                <div>
                    <div style="font-family:'Cinzel';font-size:1.5rem;color:#c5a059;font-weight:700;letter-spacing:4px;">Queen Karin</div>
                    <div style="font-family:'Orbitron';font-size:0.5rem;color:rgba(255,255,255,0.35);letter-spacing:3px;margin-top:5px;">SUPREME AUTHORITY · DOMAIN RULER</div>
                </div>
                <div style="width:100%;height:1px;background:linear-gradient(90deg,transparent,rgba(197,160,89,0.3),transparent);"></div>
                <div style="display:flex;gap:30px;justify-content:center;">
                    <div>
                        <div style="font-family:'Orbitron';font-size:1.4rem;color:#fff;font-weight:700;">${data.totalSubjects ?? '—'}</div>
                        <div style="font-family:'Orbitron';font-size:0.45rem;color:rgba(255,255,255,0.35);letter-spacing:2px;margin-top:3px;">SUBJECTS</div>
                    </div>
                    <div style="width:1px;background:rgba(255,255,255,0.08);"></div>
                    <div>
                        <div style="font-family:'Orbitron';font-size:1.4rem;color:#c5a059;font-weight:700;">${(data.totalTribute || 0).toLocaleString()}</div>
                        <div style="font-family:'Orbitron';font-size:0.45rem;color:rgba(255,255,255,0.35);letter-spacing:2px;margin-top:3px;">TOTAL TRIBUTE</div>
                    </div>
                </div>
                <div style="width:100%;height:1px;background:linear-gradient(90deg,transparent,rgba(197,160,89,0.15),transparent);"></div>
                <div style="font-family:'Cinzel';font-size:0.75rem;color:rgba(255,255,255,0.4);font-style:italic;line-height:1.7;max-width:320px;">
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
            <div id="qkGalleryLightbox" onclick="this.style.display='none'" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;align-items:center;justify-content:center;cursor:zoom-out;">
                <span id="qkLightboxMedia"></span>
            </div>
        `;
        el.dataset.loaded = '1';
    } catch {
        el.innerHTML = `<div style="text-align:center;padding:40px;font-family:Orbitron;font-size:0.55rem;color:#ff4444;">FAILED TO LOAD</div>`;
    }
}

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

