// src/scripts/global-view.ts
import { getState } from './profile-state';

let currentPeriod: 'today' | 'alltime' | 'weekly' | 'monthly' = 'today';
let talkPollInterval: ReturnType<typeof setInterval> | null = null;

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
}

export function closeGlobalSection() { _showMain(); }

// ─── MAIN VIEW ────────────────────────────────────────────────────────────────

function _showMain() {
    _stopPoll();
    _setHeader('GLOBAL', false);
    const main = document.getElementById('globalMainView');
    if (main) main.style.display = 'flex';
    _hidePanels();
    _loadAllPreviews();
}

function _hidePanels() {
    ['leaderboard', 'talk', 'updates', 'spenders', 'queen'].forEach(s => {
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
}

// ─── OPEN EXPANDED ────────────────────────────────────────────────────────────

export function openGlobalSection(section: 'leaderboard' | 'talk' | 'updates' | 'spenders' | 'queen') {
    _stopPoll();
    const main = document.getElementById('globalMainView');
    if (main) main.style.display = 'none';
    _hidePanels();
    const labels: Record<string, string> = { leaderboard: 'LEADERBOARD', talk: 'COMMUNITY TALK', updates: 'UPDATES', spenders: 'BEST SPENDERS', queen: 'QUEEN KARIN' };
    _setHeader(`GLOBAL  ›  ${labels[section] || section.toUpperCase()}`, true);
    const panel = document.getElementById(`gPanel_${section}`);
    if (panel) panel.style.display = 'flex';
    if (section === 'leaderboard') loadLeaderboard(currentPeriod);
    if (section === 'talk') { _loadTalkFull(true); talkPollInterval = setInterval(() => _loadTalkFull(false), 8000); }
    if (section === 'updates') _loadUpdatesFull();
    if (section === 'spenders') _loadSpendersFull();
    if (section === 'queen') _loadQueenFull();
}

// ─── LOAD ALL PREVIEWS ────────────────────────────────────────────────────────

function _loadAllPreviews() {
    loadLeaderboardPreview(currentPeriod);
    _loadTalkPreview();
    _loadUpdatesPreview();
    _loadSpendersPreview();
    _loadQueenPreview();
}

// ─── LEADERBOARD PREVIEW ─────────────────────────────────────────────────────

export async function loadLeaderboardPreview(period: 'today' | 'alltime' | 'weekly' | 'monthly' = 'today') {
    currentPeriod = period;

    // update chips
    ['today', 'alltime', 'weekly', 'monthly'].forEach(p => {
        const chip = document.getElementById(`lbChip_${p}`);
        if (!chip) return;
        const active = p === period;
        chip.style.background = active ? 'rgba(197,160,89,0.2)' : 'transparent';
        chip.style.color = active ? '#c5a059' : 'rgba(255,255,255,0.28)';
        chip.style.borderColor = active ? 'rgba(197,160,89,0.4)' : 'rgba(255,255,255,0.07)';
    });

    const el = document.getElementById('globalPreview_leaderboard');
    if (!el) return;

    if (period === 'weekly' || period === 'monthly') {
        el.innerHTML = `<div style="text-align:center;padding:40px 20px;font-family:'Orbitron';font-size:0.55rem;color:rgba(255,255,255,0.15);letter-spacing:3px;">COMING SOON</div>`;
        const cnt = document.getElementById('lbPreviewCount');
        if (cnt) cnt.textContent = '';
        return;
    }

    el.innerHTML = `<div style="text-align:center;padding:30px;font-family:'Orbitron';font-size:0.5rem;color:rgba(255,255,255,0.2);">LOADING...</div>`;

    try {
        const res = await fetch(`/api/global/leaderboard?period=${period}`);
        const data = await res.json();
        const entries = data.entries || [];

        const cnt = document.getElementById('lbPreviewCount');
        if (cnt) cnt.textContent = entries.length ? `${entries.length} RANKED` : '';

        if (!entries.length) {
            el.innerHTML = `<div style="text-align:center;padding:40px 20px;font-family:'Orbitron';font-size:0.5rem;color:rgba(255,255,255,0.15);">NO DATA YET</div>`;
            return;
        }

        const maxVal = entries[0] ? (period === 'today' ? entries[0].todayHours : entries[0].kneelCount) : 1;
        const medals = ['🥇', '🥈', '🥉'];
        const barColors = ['#c5a059', '#9ca3af', '#cd7f32'];

        el.innerHTML = entries.slice(0, 8).map((e: any, i: number) => {
            const val = period === 'today' ? e.todayHours : e.kneelCount;
            const pct = maxVal > 0 ? Math.max(4, Math.round((val / maxVal) * 100)) : 4;
            const barColor = i < 3 ? barColors[i] : 'rgba(197,160,89,0.35)';
            const nameColor = i === 0 ? '#fff' : 'rgba(255,255,255,0.75)';
            return `
            <div style="display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid rgba(255,255,255,0.04);transition:background 0.12s;cursor:default;"
                 onmouseenter="this.style.background='rgba(197,160,89,0.06)'"
                 onmouseleave="this.style.background='transparent'">
                <span style="font-size:${i < 3 ? '1rem' : '0.6rem'};width:22px;text-align:center;flex-shrink:0;line-height:1;">${i < 3 ? medals[i] : i + 1}</span>
                <div style="flex:1;min-width:0;">
                    <div style="font-family:'Cinzel';font-size:0.65rem;color:${nameColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:${i === 0 ? '700' : '400'};">${e.name}</div>
                    <div style="font-family:'Orbitron';font-size:0.42rem;color:rgba(197,160,89,0.5);margin-top:1px;letter-spacing:1px;">${e.hierarchy}</div>
                </div>
                <div style="flex:0 0 80px;display:flex;align-items:center;gap:6px;">
                    <div style="flex:1;height:3px;background:rgba(255,255,255,0.07);border-radius:2px;overflow:hidden;">
                        <div style="height:100%;width:${pct}%;background:${barColor};border-radius:2px;"></div>
                    </div>
                    <div style="font-family:'Orbitron';font-size:0.55rem;color:#c5a059;font-weight:700;width:30px;text-align:right;flex-shrink:0;">${period === 'today' ? val + 'h' : val}</div>
                </div>
            </div>`;
        }).join('');
    } catch {
        el.innerHTML = `<div style="text-align:center;padding:30px;font-family:'Orbitron';font-size:0.5rem;color:#ff4444;">FAILED</div>`;
    }
}

// ─── TALK PREVIEW ─────────────────────────────────────────────────────────────

async function _loadTalkPreview() {
    const el = document.getElementById('globalPreview_talk');
    if (!el) return;
    try {
        const res = await fetch('/api/global/talk');
        const data = await res.json();
        const msgs = (data.messages || []).slice(-4);
        if (!msgs.length) {
            el.innerHTML = `<div style="text-align:center;padding:24px;font-family:'Orbitron';font-size:0.48rem;color:rgba(255,255,255,0.15);">NO MESSAGES YET</div>`;
            return;
        }
        el.innerHTML = msgs.map((m: any) => {
            const initial = (m.senderName || 'S')[0].toUpperCase();
            return `
            <div style="display:flex;align-items:flex-start;gap:8px;padding:7px 12px;border-bottom:1px solid rgba(255,255,255,0.03);">
                <div style="width:24px;height:24px;border-radius:50%;background:rgba(197,160,89,0.15);border:1px solid rgba(197,160,89,0.25);display:flex;align-items:center;justify-content:center;font-family:'Cinzel';font-size:0.55rem;color:#c5a059;flex-shrink:0;margin-top:1px;">${initial}</div>
                <div style="flex:1;min-width:0;">
                    <div style="font-family:'Orbitron';font-size:0.42rem;color:rgba(197,160,89,0.6);letter-spacing:1px;margin-bottom:2px;">${m.senderName || 'SUBJECT'}</div>
                    <div style="font-family:'Rajdhani';font-size:0.82rem;color:rgba(255,255,255,0.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3;">${m.content}</div>
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
        const updates = (data.updates || []).slice(0, 6);
        if (!updates.length) {
            el.innerHTML = `<div style="text-align:center;padding:24px;font-family:'Orbitron';font-size:0.48rem;color:rgba(255,255,255,0.15);">NO PHOTOS YET</div>`;
            return;
        }
        el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;padding:6px;">
            ${updates.map((u: any) => `
                <div style="aspect-ratio:1;border-radius:4px;overflow:hidden;background:#0a0a14;position:relative;"
                     onmouseenter="this.querySelector('.uov').style.opacity='1'"
                     onmouseleave="this.querySelector('.uov').style.opacity='0'">
                    <img src="${u.media_url}" style="width:100%;height:100%;object-fit:cover;display:block;" loading="lazy">
                    <div class="uov" style="position:absolute;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;padding:4px 5px;opacity:0;transition:opacity 0.15s;">
                        <div style="font-family:'Cinzel';font-size:0.5rem;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${u.senderName}</div>
                    </div>
                </div>`).join('')}
        </div>`;
    } catch {}
}

// ─── QUICK SEND (from main view) ──────────────────────────────────────────────

export async function sendGlobalQuickMessage() {
    const input = document.getElementById('globalQuickInput') as HTMLInputElement;
    if (!input) return;
    const content = input.value.trim();
    if (!content) return;
    const raw = getState().raw;
    if (!raw?.email) return;
    input.value = '';
    input.placeholder = 'Sending...';
    try {
        await fetch('/api/global/talk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, senderEmail: raw.email }),
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
    ['today', 'alltime', 'weekly', 'monthly'].forEach(p => {
        const btn = document.getElementById(`lbPeriod_${p}`);
        if (!btn) return;
        const a = p === period;
        btn.style.background = a ? 'rgba(197,160,89,0.18)' : 'transparent';
        btn.style.color = a ? '#c5a059' : 'rgba(255,255,255,0.35)';
        btn.style.borderColor = a ? 'rgba(197,160,89,0.45)' : 'rgba(255,255,255,0.08)';
    });

    const list = document.getElementById('leaderboardList');
    if (!list) return;

    if (period === 'weekly' || period === 'monthly') {
        list.innerHTML = `<div style="text-align:center;padding:80px 20px;font-family:'Orbitron';font-size:0.6rem;color:rgba(255,255,255,0.18);letter-spacing:3px;">COMING SOON</div>`;
        return;
    }

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
    const medals = ['🥇', '🥈', '🥉'];
    const pColors = ['#c5a059', '#9ca3af', '#cd7f32'];
    const pHeights = ['72px', '52px', '52px'];
    const order = [1, 0, 2];

    const podium = `
        <div style="display:flex;justify-content:center;align-items:flex-end;gap:10px;padding:28px 16px 0;margin-bottom:24px;">
            ${order.map(i => {
                const e = top3[i]; if (!e) return '';
                const val = period === 'today' ? e.todayHours + 'h' : e.kneelCount;
                return `
                <div style="display:flex;flex-direction:column;align-items:center;width:${i === 0 ? '120px' : '100px'};">
                    <div style="font-size:${i === 0 ? '2rem' : '1.4rem'};margin-bottom:4px;">${medals[i]}</div>
                    <div style="font-family:'Cinzel';font-size:${i === 0 ? '0.75rem' : '0.65rem'};color:#fff;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;font-weight:${i === 0 ? 700 : 400};">${e.name}</div>
                    <div style="font-family:'Orbitron';font-size:0.43rem;color:${pColors[i]};margin-top:2px;letter-spacing:1px;">${e.hierarchy}</div>
                    <div style="font-family:'Orbitron';font-size:${i === 0 ? '1.1rem' : '0.85rem'};color:#c5a059;margin-top:6px;font-weight:700;">${val}</div>
                    <div style="margin-top:8px;background:${pColors[i]};width:100%;height:${pHeights[i]};border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:center;">
                        <span style="font-family:'Orbitron';font-size:0.8rem;color:#000;font-weight:900;">${i + 1}</span>
                    </div>
                </div>`;
            }).join('')}
        </div>`;

    const rows = rest.map((e: any, i: number) => {
        const val = period === 'today' ? e.todayHours + 'h' : e.kneelCount;
        return `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 24px;border-bottom:1px solid rgba(255,255,255,0.04);transition:background 0.12s;"
             onmouseenter="this.style.background='rgba(197,160,89,0.04)'"
             onmouseleave="this.style.background='transparent'">
            <div style="font-family:'Orbitron';font-size:0.6rem;color:rgba(255,255,255,0.22);width:24px;text-align:right;flex-shrink:0;">${i + 4}</div>
            <div style="flex:1;min-width:0;">
                <div style="font-family:'Cinzel';font-size:0.72rem;color:rgba(255,255,255,0.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e.name}</div>
                <div style="font-family:'Orbitron';font-size:0.42rem;color:rgba(197,160,89,0.5);margin-top:1px;letter-spacing:1px;">${e.hierarchy}</div>
            </div>
            <div style="font-family:'Orbitron';font-size:0.72rem;color:#c5a059;font-weight:700;flex-shrink:0;">${val}</div>
        </div>`;
    }).join('');

    list.innerHTML = podium + (rows ? `<div>${rows}</div>` : '');
}

// ─── FULL TALK ─────────────────────────────────────────────────────────────────

async function _loadTalkFull(scrollBottom: boolean) {
    try {
        const res = await fetch('/api/global/talk');
        const { messages } = await res.json();
        _renderTalkFull(messages || [], scrollBottom);
    } catch {}
}

function _renderTalkFull(messages: any[], scrollBottom: boolean) {
    const feed = document.getElementById('globalTalkFeed');
    if (!feed) return;
    const myEmail = getState().raw?.email || '';
    if (!messages.length) {
        feed.innerHTML = `<div style="text-align:center;padding:60px 20px;font-family:'Orbitron';font-size:0.6rem;color:rgba(255,255,255,0.18);letter-spacing:3px;">BE THE FIRST TO SPEAK</div>`;
        return;
    }
    const wasNear = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 80;
    feed.innerHTML = messages.map((msg: any) => {
        const isMe = msg.member_id === myEmail;
        const name = msg.senderName || 'SUBJECT';
        const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `
        <div style="display:flex;flex-direction:column;align-items:${isMe ? 'flex-end' : 'flex-start'};margin-bottom:12px;padding:0 16px;">
            <div style="font-family:'Orbitron';font-size:0.43rem;color:rgba(255,255,255,0.28);margin-bottom:3px;letter-spacing:1px;">${isMe ? 'YOU' : name} · ${time}</div>
            <div style="max-width:72%;padding:9px 13px;background:${isMe ? 'rgba(197,160,89,0.12)' : 'rgba(255,255,255,0.05)'};border:1px solid ${isMe ? 'rgba(197,160,89,0.28)' : 'rgba(255,255,255,0.07)'};border-radius:${isMe ? '12px 12px 3px 12px' : '12px 12px 12px 3px'};">
                <div style="font-family:'Rajdhani';font-size:0.9rem;color:#e8e8e8;line-height:1.45;">${msg.content}</div>
            </div>
        </div>`;
    }).join('');
    if (scrollBottom || wasNear) feed.scrollTop = feed.scrollHeight;
}

export async function sendGlobalMessage() {
    const input = document.getElementById('globalTalkInput') as HTMLInputElement;
    if (!input) return;
    const content = input.value.trim();
    if (!content) return;
    const raw = getState().raw;
    if (!raw?.email) return;
    input.value = '';
    try {
        await fetch('/api/global/talk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, senderEmail: raw.email }),
        });
        await _loadTalkFull(true);
    } catch {}
}

export function handleGlobalTalkKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendGlobalMessage(); }
}

// ─── FULL UPDATES ─────────────────────────────────────────────────────────────

async function _loadUpdatesFull() {
    const grid = document.getElementById('globalUpdatesGrid');
    if (!grid) return;
    grid.innerHTML = `<div style="text-align:center;padding:40px;font-family:'Orbitron';font-size:0.55rem;color:rgba(255,255,255,0.25);grid-column:1/-1;">LOADING...</div>`;
    try {
        const res = await fetch('/api/global/updates');
        const { updates } = await res.json();
        if (!updates?.length) {
            grid.innerHTML = `<div style="text-align:center;padding:60px;font-family:'Orbitron';font-size:0.6rem;color:rgba(255,255,255,0.18);grid-column:1/-1;">NO UPDATES YET</div>`;
            return;
        }
        grid.innerHTML = updates.map((u: any) => `
            <div style="position:relative;aspect-ratio:1;border-radius:8px;overflow:hidden;background:#0a0a14;border:1px solid rgba(197,160,89,0.1);"
                 onmouseenter="this.querySelector('.uinfo').style.opacity='1'"
                 onmouseleave="this.querySelector('.uinfo').style.opacity='0'">
                <img src="${u.media_url}" style="width:100%;height:100%;object-fit:cover;display:block;" loading="lazy">
                <div class="uinfo" style="position:absolute;bottom:0;left:0;right:0;padding:7px 9px;background:linear-gradient(transparent,rgba(0,0,0,0.85));opacity:0;transition:opacity 0.15s;">
                    <div style="font-family:'Cinzel';font-size:0.58rem;color:#fff;">${u.senderName}</div>
                    ${u.caption ? `<div style="font-family:'Rajdhani';font-size:0.68rem;color:rgba(255,255,255,0.5);">${u.caption}</div>` : ''}
                </div>
            </div>`).join('');
    } catch {
        grid.innerHTML = `<div style="text-align:center;padding:40px;font-family:'Orbitron';font-size:0.55rem;color:#ff4444;grid-column:1/-1;">FAILED</div>`;
    }
}

// ─── SPENDERS PREVIEW ────────────────────────────────────────────────────────

async function _loadSpendersPreview() {
    const el = document.getElementById('globalPreview_spenders');
    if (!el) return;
    try {
        const res = await fetch('/api/global/spenders');
        const { entries } = await res.json();
        if (!entries?.length) {
            el.innerHTML = `<div style="text-align:center;padding:24px;font-family:'Orbitron';font-size:0.48rem;color:rgba(255,255,255,0.15);">NO DATA YET</div>`;
            return;
        }
        const medals = ['🥇', '🥈', '🥉'];
        el.innerHTML = entries.slice(0, 5).map((e: any, i: number) => `
            <div style="display:flex;align-items:center;gap:8px;padding:7px 12px;border-bottom:1px solid rgba(255,255,255,0.04);transition:background 0.12s;"
                 onmouseenter="this.style.background='rgba(197,160,89,0.05)'"
                 onmouseleave="this.style.background='transparent'">
                <span style="font-size:${i < 3 ? '0.9rem' : '0.55rem'};width:20px;text-align:center;flex-shrink:0;">${i < 3 ? medals[i] : i + 1}</span>
                <div style="flex:1;min-width:0;">
                    <div style="font-family:'Cinzel';font-size:0.65rem;color:rgba(255,255,255,${i === 0 ? '1' : '0.7'});white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:${i === 0 ? 700 : 400};">${e.name}</div>
                    <div style="font-family:'Orbitron';font-size:0.42rem;color:rgba(197,160,89,0.5);letter-spacing:1px;margin-top:1px;">${e.hierarchy}</div>
                </div>
                <div style="font-family:'Orbitron';font-size:0.6rem;color:#c5a059;font-weight:700;flex-shrink:0;">${e.totalSpent.toLocaleString()}</div>
            </div>`).join('');
    } catch {}
}

// ─── SPENDERS FULL ────────────────────────────────────────────────────────────

async function _loadSpendersFull() {
    const list = document.getElementById('spendersList');
    if (!list) return;
    list.innerHTML = `<div style="text-align:center;padding:40px;font-family:'Orbitron';font-size:0.55rem;color:rgba(255,255,255,0.25);">LOADING...</div>`;
    try {
        const res = await fetch('/api/global/spenders');
        const { entries } = await res.json();
        if (!entries?.length) {
            list.innerHTML = `<div style="text-align:center;padding:80px;font-family:'Orbitron';font-size:0.6rem;color:rgba(255,255,255,0.18);">NO DATA YET</div>`;
            return;
        }

        const top3 = entries.slice(0, 3);
        const rest = entries.slice(3);
        const medals = ['🥇', '🥈', '🥉'];
        const pColors = ['#c5a059', '#9ca3af', '#cd7f32'];
        const pHeights = ['72px', '52px', '52px'];
        const order = [1, 0, 2];

        const podium = `
            <div style="display:flex;justify-content:center;align-items:flex-end;gap:10px;padding:28px 16px 0;margin-bottom:24px;">
                ${order.map(i => {
                    const e = top3[i]; if (!e) return '';
                    return `
                    <div style="display:flex;flex-direction:column;align-items:center;width:${i === 0 ? '120px' : '100px'};">
                        <div style="font-size:${i === 0 ? '2rem' : '1.4rem'};margin-bottom:4px;">${medals[i]}</div>
                        <div style="font-family:'Cinzel';font-size:${i === 0 ? '0.72rem' : '0.62rem'};color:#fff;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;font-weight:${i === 0 ? 700 : 400};">${e.name}</div>
                        <div style="font-family:'Orbitron';font-size:0.43rem;color:${pColors[i]};margin-top:2px;letter-spacing:1px;">${e.hierarchy}</div>
                        <div style="font-family:'Orbitron';font-size:${i === 0 ? '0.9rem' : '0.75rem'};color:#c5a059;margin-top:6px;font-weight:700;">${e.totalSpent.toLocaleString()}</div>
                        <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(197,160,89,0.5);margin-top:1px;letter-spacing:1px;">COINS SPENT</div>
                        <div style="margin-top:8px;background:${pColors[i]};width:100%;height:${pHeights[i]};border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:center;">
                            <span style="font-family:'Orbitron';font-size:0.8rem;color:#000;font-weight:900;">${i + 1}</span>
                        </div>
                    </div>`;
                }).join('')}
            </div>`;

        const rows = rest.map((e: any, i: number) => `
            <div style="display:flex;align-items:center;gap:12px;padding:12px 24px;border-bottom:1px solid rgba(255,255,255,0.04);transition:background 0.12s;"
                 onmouseenter="this.style.background='rgba(197,160,89,0.04)'"
                 onmouseleave="this.style.background='transparent'">
                <div style="font-family:'Orbitron';font-size:0.6rem;color:rgba(255,255,255,0.22);width:24px;text-align:right;flex-shrink:0;">${i + 4}</div>
                <div style="flex:1;min-width:0;">
                    <div style="font-family:'Cinzel';font-size:0.72rem;color:rgba(255,255,255,0.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e.name}</div>
                    <div style="font-family:'Orbitron';font-size:0.42rem;color:rgba(197,160,89,0.5);margin-top:1px;letter-spacing:1px;">${e.hierarchy}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-family:'Orbitron';font-size:0.72rem;color:#c5a059;font-weight:700;">${e.totalSpent.toLocaleString()}</div>
                    <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(197,160,89,0.4);letter-spacing:1px;">COINS</div>
                </div>
            </div>`).join('');

        list.innerHTML = podium + (rows ? `<div>${rows}</div>` : '');
    } catch {
        list.innerHTML = `<div style="text-align:center;padding:40px;font-family:'Orbitron';font-size:0.55rem;color:#ff4444;">FAILED TO LOAD</div>`;
    }
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
                    <img src="https://static.wixstatic.com/media/ce3e5b_e06c7a2254d848a480eb98107c35e246~mv2.png" style="width:100%;height:100%;object-fit:cover;">
                </div>
                <div>
                    <div style="font-family:'Cinzel';font-size:0.8rem;color:#c5a059;font-weight:700;letter-spacing:2px;">Queen Karin</div>
                    <div style="font-family:'Orbitron';font-size:0.4rem;color:rgba(255,255,255,0.3);letter-spacing:2px;margin-top:2px;">SUPREME AUTHORITY</div>
                </div>
                <div style="display:flex;gap:12px;margin-top:4px;">
                    <div style="text-align:center;">
                        <div style="font-family:'Orbitron';font-size:0.75rem;color:#fff;font-weight:700;">${data.totalSubjects ?? '—'}</div>
                        <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.3);letter-spacing:1px;margin-top:1px;">SUBJECTS</div>
                    </div>
                    <div style="width:1px;background:rgba(255,255,255,0.1);"></div>
                    <div style="text-align:center;">
                        <div style="font-family:'Orbitron';font-size:0.75rem;color:#c5a059;font-weight:700;">${(data.totalTribute || 0).toLocaleString()}</div>
                        <div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.3);letter-spacing:1px;margin-top:1px;">TRIBUTE</div>
                    </div>
                </div>
            </div>`;
    } catch {}
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
                        <img src="https://static.wixstatic.com/media/ce3e5b_e06c7a2254d848a480eb98107c35e246~mv2.png" style="width:100%;height:100%;object-fit:cover;">
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
