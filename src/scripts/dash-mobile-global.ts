// src/scripts/dash-mobile-global.ts
// Mobile global overlay for /dashboard — uses exact same DOM IDs & CSS classes as /profile
// Only difference: user identity comes from dashboard-state instead of profile-state

import { createClient } from '@/utils/supabase/client';
import { getOptimizedUrl } from '@/scripts/media';
import { getAdminEmailFallback } from '@/scripts/dashboard-state';

// ─── STATE ───────────────────────────────────────────────────────────────────
let _mobGlLoaded: Record<string, boolean> = {};
let _mobGlActivePeriod = 'today';
let _mobGlRealtimeChannel: any = null;
let _mobGlReply: { id: string; name: string; text: string } | null = null;
const _mobGlPendingSent = new Set<string>();
let _mobGlGifOpen = false;
let _mobGlGifTimeout: ReturnType<typeof setTimeout> | null = null;

const MOB_QUEEN_EMAILS = ['ceo@qkarin.com'];

function _getUserIdentity(): { email: string; name: string } | null {
    const email = getAdminEmailFallback();
    if (!email) return null;
    return { email, name: email.split('@')[0] || 'QUEEN' };
}

// ─── OPEN / CLOSE ────────────────────────────────────────────────────────────

function openMobGlobal() {
    const el = document.getElementById('mobGlobalOverlay');
    if (!el) return;
    if (el.classList.contains('mob-overlay-open')) { closeMobGlobal(); return; }
    el.style.display = 'flex';
    requestAnimationFrame(() => el.classList.add('mob-overlay-open'));
    document.querySelectorAll('.mob-nav-btn').forEach((b: any) => b.classList.remove('active'));
    document.getElementById('mobNavGlobal')?.classList.add('active');
    _switchMobGlTab('talk');
}

function closeMobGlobal() {
    const el = document.getElementById('mobGlobalOverlay');
    if (!el) return;
    el.classList.remove('mob-overlay-open');
    setTimeout(() => { if (!el.classList.contains('mob-overlay-open')) el.style.display = 'none'; }, 360);
    document.querySelectorAll('.mob-nav-btn').forEach((b: any) => b.classList.remove('active'));
    document.getElementById('mobNavHome')?.classList.add('active');
    if (_mobGlRealtimeChannel) { _mobGlRealtimeChannel.unsubscribe(); _mobGlRealtimeChannel = null; }
    _mobGlLoaded['talk'] = false;
}

// ─── TAB SWITCHING ───────────────────────────────────────────────────────────

function switchMobGlTab(tab: string) { _switchMobGlTab(tab); }

function _switchMobGlTab(tab: string) {
    document.querySelectorAll('.mob-gl-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`mobGlTab_${tab}`)?.classList.add('active');
    document.querySelectorAll('.mob-gl-panel').forEach(p => (p as HTMLElement).style.display = 'none');
    document.getElementById(`mobGlPanel_${tab}`)?.style.setProperty('display', 'flex');

    if (tab === 'rank') _loadMobGlLeaderboard(_mobGlActivePeriod);
    else if (tab === 'talk') {
        _loadMobGlTalk();
        const c = document.getElementById('mobGlTalkFeed');
        if (c) {
            requestAnimationFrame(() => requestAnimationFrame(() => { c.scrollTop = c.scrollHeight + 9999; }));
            setTimeout(() => { c.scrollTop = c.scrollHeight + 9999; }, 200);
        }
    }
    else if (tab === 'challenges') _loadMobGlChallenges();
    else if (tab === 'updates') _loadMobGlUpdates();
}

function switchMobGlPeriod(period: string) {
    _mobGlActivePeriod = period;
    Object.keys(_mobGlLoaded).forEach(k => { if (k.startsWith('rank')) delete _mobGlLoaded[k]; });
    document.querySelectorAll('.mob-gl-period-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`mobGlPeriod_${period}`)?.classList.add('active');
    _loadMobGlLeaderboard(period);
}

// ─── LEADERBOARD ─────────────────────────────────────────────────────────────

async function _loadMobGlLeaderboard(period: string) {
    if (_mobGlLoaded[`rank_${period}`]) return;
    const container = document.getElementById('mobGlRankList');
    if (!container) return;
    container.innerHTML = `<div style="text-align:center;padding:40px;color:#444;font-family:Orbitron;font-size:0.55rem;letter-spacing:2px">LOADING...</div>`;
    try {
        const res = await fetch(`/api/global/leaderboard?period=${period}`, { cache: 'no-store' });
        const data = await res.json();
        const entries: any[] = data.leaderboard || data.entries || [];
        if (!entries.length) {
            container.innerHTML = `<div style="text-align:center;padding:40px;color:#333;font-family:Orbitron;font-size:0.75rem;letter-spacing:3px">NO DATA YET</div>`;
            return;
        }
        const MEDALS = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];
        const MEDAL_COLORS = ['#c5a059', '#C0C0C0', '#CD7F32'];
        const DEFAULT_AV = '/collar-placeholder.png';
        const top3 = entries.slice(0, 3);
        const rest = entries.slice(3);

        const top3Html = top3.map((e: any, i: number) => {
            const av = getOptimizedUrl(e.avatar, 100) || DEFAULT_AV;
            return `<div class="mob-gl-rank-row mob-gl-rank-row--top mob-gl-rank-row--rank${i + 1}">
                <div class="mob-gl-rank-medal">${MEDALS[i]}</div>
                <img src="${av}" class="mob-gl-rank-avatar mob-gl-rank-avatar--top" alt="" onerror="this.onerror=null;this.src='${DEFAULT_AV}'"/>
                <div class="mob-gl-rank-info">
                    <div class="mob-gl-rank-name mob-gl-rank-name--top">${e.name || e.member_id || 'SLAVE'}</div>
                    ${e.hierarchy ? `<div class="mob-gl-rank-tier" style="color:${MEDAL_COLORS[i]}">${e.hierarchy}</div>` : ''}
                </div>
                <span class="mob-gl-rank-score mob-gl-rank-score--top" style="color:${MEDAL_COLORS[i]}">${(e.score ?? 0).toLocaleString()}</span>
            </div>`;
        }).join('');

        const restHtml = rest.map((e: any, i: number) => {
            const av = getOptimizedUrl(e.avatar, 80) || DEFAULT_AV;
            return `<div class="mob-gl-rank-row">
                <span class="mob-gl-rank-num">${i + 4}</span>
                <img src="${av}" class="mob-gl-rank-avatar" alt="" onerror="this.onerror=null;this.src='${DEFAULT_AV}'"/>
                <div class="mob-gl-rank-info">
                    <div class="mob-gl-rank-name">${e.name || e.member_id || 'SLAVE'}</div>
                    ${e.hierarchy ? `<div class="mob-gl-rank-tier">${e.hierarchy}</div>` : ''}
                </div>
                <span class="mob-gl-rank-score">${(e.score ?? 0).toLocaleString()}</span>
            </div>`;
        }).join('');

        container.innerHTML = top3Html + (restHtml ? `<div class="mob-gl-rank-divider"></div>${restHtml}` : '');
        _mobGlLoaded[`rank_${period}`] = true;
    } catch {
        container.innerHTML = `<div style="text-align:center;padding:40px;color:#333;font-family:Orbitron;font-size:0.75rem">UNABLE TO LOAD</div>`;
    }
}

// ─── TALK ────────────────────────────────────────────────────────────────────

async function _loadMobGlTalk() {
    if (_mobGlLoaded['talk']) return;
    const container = document.getElementById('mobGlTalkFeed');
    if (!container) return;
    container.innerHTML = `<div style="text-align:center;padding:40px;color:#444;font-family:Orbitron;font-size:0.55rem;letter-spacing:2px">LOADING...</div>`;
    try {
        const res = await fetch('/api/global/messages', { cache: 'no-store' });
        const data = await res.json();
        const msgs: any[] = (data.messages || []).filter((m: any) => {
            const c = m.message || '';
            return !c.startsWith('UPDATE_COINS_CARD::') && !c.startsWith('UPDATE_MERIT_CARD::');
        });
        _renderMobGlTalk(msgs);
        _mobGlLoaded['talk'] = true;
        _initMobGlRealtime();
    } catch {
        container.innerHTML = `<div style="text-align:center;padding:40px;color:#333;font-family:Orbitron;font-size:0.75rem">UNABLE TO LOAD</div>`;
    }
}

function _initMobGlRealtime() {
    if (_mobGlRealtimeChannel) return;
    const sb = createClient();
    _mobGlRealtimeChannel = sb
        .channel('dash_mob_gl_rt')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'global_messages' },
            (payload: any) => {
                const msg = payload.new;
                const content = msg.message || '';
                if (content.startsWith('UPDATE_COINS_CARD::') || content.startsWith('UPDATE_MERIT_CARD::')) return;
                const dedupKey = msg.media_url || content;
                if (_mobGlPendingSent.has(dedupKey)) { _mobGlPendingSent.delete(dedupKey); return; }
                _appendMobGlMessage(msg);
            }
        )
        .subscribe();
}

function _renderMobGlTalk(msgs: any[]) {
    const container = document.getElementById('mobGlTalkFeed');
    if (!container) return;
    if (!msgs.length) {
        container.innerHTML = `<div style="text-align:center;padding:40px;color:#333;font-family:Orbitron;font-size:0.75rem;letter-spacing:3px">NO MESSAGES YET</div>`;
        return;
    }
    container.innerHTML = msgs.map((m: any) => _buildMobGlBubble(m)).join('');
    const scrollBottom = () => { container.scrollTop = container.scrollHeight + 9999; };
    requestAnimationFrame(() => requestAnimationFrame(scrollBottom));
    setTimeout(scrollBottom, 200);
    setTimeout(scrollBottom, 600);
    (container.querySelectorAll('img') as NodeListOf<HTMLImageElement>).forEach(img => {
        if (!img.complete) {
            img.addEventListener('load', scrollBottom, { once: true });
            img.addEventListener('error', scrollBottom, { once: true });
        }
    });
}

function _appendMobGlMessage(msg: any) {
    const container = document.getElementById('mobGlTalkFeed');
    if (!container || !msg?.message) return;
    const el = document.createElement('div');
    el.innerHTML = _buildMobGlBubble(msg);
    container.appendChild(el.firstElementChild!);
    requestAnimationFrame(() => requestAnimationFrame(() => { container.scrollTop = container.scrollHeight + 9999; }));
}

// ─── MESSAGE BUBBLE — exact copy from profile-logic.ts _buildMobGlBubble ────

function _buildMobGlBubble(msg: any): string {
    const time = new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const senderEmail = (msg.sender_email || '').toLowerCase();
    const isQueen = MOB_QUEEN_EMAILS.includes(senderEmail);
    const myEmail = (getAdminEmailFallback() || '').toLowerCase();
    const isMe = !isQueen && !!myEmail && senderEmail === myEmail;
    void isMe;
    const name = msg.sender_name || msg.sender_email?.split('@')[0] || 'SUBJECT';
    const content = msg.message || '';
    const msgId = String(msg.id || '');
    const nameSafe = name.replace(/'/g, '&#39;').replace(/\\/g, '\\\\');
    const contentSafe = content.slice(0, 80).replace(/'/g, '&#39;').replace(/\\/g, '\\\\').replace(/\n/g, ' ');
    const SVG_REPLY_MOB = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path></svg>`;
    const SVG_CROWN_MOB = `<svg width="11" height="9" viewBox="0 0 26 20" fill="#c5a059" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M2 18 L5 8 L10 13 L13 3 L16 13 L21 8 L24 18 Z"/><rect x="2" y="17" width="22" height="2" rx="1"/></svg>`;
    const replyBtn = msgId ? `<button class="mob-gl-reply-btn" onclick="event.stopPropagation();window.setMobGlReply('${msgId}','${nameSafe}','${contentSafe}')" title="Reply">${SVG_REPLY_MOB}</button>` : '';
    const quoteHtml = msg.reply_to ? `<div style="border-left:2px solid rgba(197,160,89,0.5);padding:3px 8px;margin-bottom:4px;background:rgba(197,160,89,0.05);border-radius:0 4px 4px 0;">
        <div style="display:flex;align-items:center;gap:4px;font-family:'Orbitron';font-size:0.3rem;color:rgba(197,160,89,0.7);letter-spacing:1px;margin-bottom:1px;white-space:nowrap;overflow:hidden;"><svg width="9" height="9" viewBox="0 0 20 20" fill="none" stroke="rgba(197,160,89,0.7)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="8 16 3 11 8 6"></polyline><path d="M17 4v7a4 4 0 0 1-4 4H3"></path></svg><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${(msg.reply_to.sender_name || '').replace(/</g, '&lt;')}</span></div>
        <div style="font-family:'Rajdhani';font-size:0.75rem;color:rgba(255,255,255,0.38);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${(msg.reply_to.content || '').slice(0, 55).replace(/</g, '&lt;')}</div>
    </div>` : '';

    // STREAM LIVE CARD
    if (content.startsWith('STREAM_LIVE::')) {
        return `<div style="display:flex;justify-content:center;padding:6px 0;margin-bottom:6px;">
            <div style="width:75%;min-width:240px;max-width:420px;">
                <div style="width:100%;border-radius:14px;overflow:hidden;background:linear-gradient(170deg,#0a0205 0%,#0e0308 60%,#080103 100%);border:1px solid rgba(239,68,68,0.4);box-shadow:0 10px 30px rgba(239,68,68,0.1);">
                    <div style="position:relative;width:100%;height:120px;background:#080103;overflow:hidden;">
                        <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(239,68,68,0.06),rgba(197,160,89,0.04));display:flex;align-items:center;justify-content:center;">
                            <div style="width:50px;height:50px;border-radius:50%;border:2px solid rgba(239,68,68,0.5);display:flex;align-items:center;justify-content:center;background:rgba(239,68,68,0.08);">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5"><polygon points="5 3 19 12 5 21 5 3" fill="rgba(239,68,68,0.3)"/></svg>
                            </div>
                        </div>
                        <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 50%,#0a0205 100%);"></div>
                        <div style="position:absolute;top:8px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:5px;background:rgba(10,2,5,0.9);border:1px solid rgba(239,68,68,0.5);border-radius:20px;padding:3px 12px;white-space:nowrap;">
                            <div style="width:5px;height:5px;border-radius:50%;background:#ef4444;animation:livePulse 1.5s ease-in-out infinite;"></div>
                            <span style="font-family:'Orbitron',sans-serif;font-size:0.38rem;color:#ef4444;letter-spacing:3px;">LIVE NOW</span>
                        </div>
                    </div>
                    <div style="padding:12px 16px 16px;text-align:center;">
                        <div style="font-family:'Orbitron',sans-serif;font-size:0.75rem;color:#fff;font-weight:700;letter-spacing:3px;margin-bottom:4px;">QUEEN KARIN</div>
                        <div style="font-family:'Rajdhani',sans-serif;font-size:0.8rem;color:rgba(255,255,255,0.5);margin-bottom:10px;">is streaming right now</div>
                        <a href="/profile" style="display:inline-flex;align-items:center;gap:5px;padding:7px 18px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.4);border-radius:20px;text-decoration:none;font-family:'Orbitron',sans-serif;font-size:0.38rem;color:#ef4444;letter-spacing:2px;">
                            <div style="width:5px;height:5px;border-radius:50%;background:#ef4444;animation:livePulse 1.5s ease-in-out infinite;"></div>
                            JOIN STREAM
                        </a>
                    </div>
                </div>
                <div style="font-family:'Orbitron';font-size:0.35rem;color:rgba(255,255,255,0.18);text-align:center;margin-top:3px;letter-spacing:1px;">${time}</div>
            </div>
        </div>`;
    }

    // PROMOTION CARD
    if (content.startsWith('PROMOTION_CARD::')) {
        try {
            const d = JSON.parse(content.replace('PROMOTION_CARD::', ''));
            const initials = (d.name || 'S')[0].toUpperCase();
            const photoBlock = d.photo ? `<img src="${d.photo}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : '';
            const photoFallback = `<div style="${d.photo ? 'display:none;' : ''}position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,rgba(197,160,89,0.08),rgba(197,160,89,0.02));"><div style="width:60px;height:60px;border-radius:50%;border:1px solid rgba(197,160,89,0.4);display:flex;align-items:center;justify-content:center;font-family:'Orbitron',sans-serif;font-size:1.4rem;color:#c5a059;">${initials}</div></div>`;
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;"><div style="width:85%;max-width:340px;min-width:200px;"><div style="width:100%;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0e0b06 0%,#110d04 60%,#0a0703 100%);border:1px solid rgba(197,160,89,0.5);box-shadow:0 12px 40px rgba(0,0,0,0.8);"><div style="position:relative;width:100%;height:140px;background:#0a0703;overflow:hidden;">${photoBlock}${photoFallback}<div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,#0e0b06 100%);"></div><div style="position:absolute;top:10px;left:50%;transform:translateX(-50%);background:rgba(10,7,2,0.9);border:1px solid rgba(197,160,89,0.5);border-radius:20px;padding:4px 14px;white-space:nowrap;"><span style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:#c5a059;letter-spacing:3px;">RANK PROMOTION</span></div></div><div style="padding:14px 18px 18px;text-align:center;"><div style="font-family:'Orbitron',sans-serif;font-size:0.95rem;color:#fff;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">${d.name || ''}</div><div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:12px;"><span style="font-family:'Orbitron',sans-serif;font-size:0.48rem;color:rgba(197,160,89,0.4);letter-spacing:1px;text-decoration:line-through;">${(d.oldRank || '').toUpperCase()}</span><span style="color:rgba(197,160,89,0.7);">\u2192</span><span style="font-family:'Orbitron',sans-serif;font-size:0.55rem;color:#c5a059;letter-spacing:2px;font-weight:700;">${(d.newRank || '').toUpperCase()}</span></div><div style="width:70%;height:1px;background:linear-gradient(to right,transparent,rgba(197,160,89,0.35),transparent);margin:0 auto;"></div></div></div><div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div></div></div>`;
        } catch { /* fall through */ }
    }

    // ROUTINE CHANGE CARD
    if (content.startsWith('ROUTINE_CHANGE::')) {
        try {
            const d = JSON.parse(content.replace('ROUTINE_CHANGE::', ''));
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;"><div style="width:85%;max-width:340px;min-width:200px;"><div style="width:100%;border-radius:14px;overflow:hidden;background:linear-gradient(170deg,#0c0806 0%,#0e0a04 60%,#0a0703 100%);border:1px solid rgba(197,160,89,0.35);box-shadow:0 10px 35px rgba(0,0,0,0.7);"><div style="padding:16px 18px;text-align:center;"><div style="font-family:'Orbitron',sans-serif;font-size:0.4rem;color:rgba(197,160,89,0.5);letter-spacing:3px;margin-bottom:10px;">ROUTINE UPDATED</div><div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:12px;flex-wrap:wrap;"><span style="font-family:'Rajdhani',sans-serif;font-size:0.78rem;color:rgba(255,255,255,0.3);text-decoration:line-through;">${(d.oldRoutine || 'None').toUpperCase()}</span><span style="color:rgba(197,160,89,0.6);font-size:0.8rem;">\u2192</span><span style="font-family:'Cinzel',serif;font-size:0.85rem;color:#c5a059;font-weight:700;letter-spacing:1px;">${(d.newRoutine || 'None').toUpperCase()}</span></div><div style="width:60%;height:1px;background:linear-gradient(to right,transparent,rgba(197,160,89,0.25),transparent);margin:0 auto;"></div></div></div><div style="font-family:'Orbitron';font-size:0.36rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div></div></div>`;
        } catch { /* fall through */ }
    }

    // WELCOME CARD
    if (content.startsWith('WELCOME_CARD::')) {
        try {
            const d = JSON.parse(content.replace('WELCOME_CARD::', ''));
            const wIni = (d.name || 'S')[0].toUpperCase();
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;"><div style="width:85%;max-width:340px;min-width:200px;"><div style="width:100%;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0c0a04 0%,#13100a 50%,#0c0a04 100%);border:1px solid rgba(197,160,89,0.6);box-shadow:0 12px 40px rgba(0,0,0,0.8),0 0 30px rgba(197,160,89,0.08);"><div style="width:100%;padding:18px 0 12px;display:flex;flex-direction:column;align-items:center;background:radial-gradient(ellipse at center top,rgba(197,160,89,0.1) 0%,transparent 70%);"><div style="width:56px;height:56px;border-radius:50%;border:2px solid rgba(197,160,89,0.6);display:flex;align-items:center;justify-content:center;font-family:'Cinzel',serif;font-size:1.4rem;color:#c5a059;background:radial-gradient(circle,rgba(197,160,89,0.12) 0%,rgba(197,160,89,0.03) 100%);box-shadow:0 0 20px rgba(197,160,89,0.15),0 0 40px rgba(197,160,89,0.05);">${wIni}</div></div><div style="padding:4px 16px 18px;text-align:center;"><div style="font-family:'Cinzel',serif;font-size:0.95rem;color:#fff;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:6px;">${d.name || ''}</div><div style="width:40%;height:1px;background:linear-gradient(to right,transparent,rgba(197,160,89,0.5),transparent);margin:0 auto 8px;"></div><div style="font-family:'Orbitron',sans-serif;font-size:0.4rem;color:rgba(197,160,89,0.65);letter-spacing:3px;margin-bottom:10px;">HAS ENTERED THE COURT</div><div style="display:inline-flex;align-items:center;gap:4px;background:rgba(197,160,89,0.06);border:1px solid rgba(197,160,89,0.25);border-radius:20px;padding:3px 12px;"><svg width="12" height="9" viewBox="0 0 26 20" fill="#c5a059"><path d="M2 18 L5 8 L10 13 L13 3 L16 13 L21 8 L24 18 Z"/><rect x="2" y="17" width="22" height="2" rx="1"/></svg><span style="font-family:'Orbitron',sans-serif;font-size:0.4rem;color:#c5a059;letter-spacing:2px;">${(d.rank || 'HALL BOY').toUpperCase()}</span></div></div></div><div style="font-family:'Orbitron';font-size:0.36rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div></div></div>`;
        } catch { /* fall through */ }
    }

    // CHALLENGE JOIN CARD
    if (content.startsWith('CHALLENGE_JOIN_CARD::')) {
        try {
            const d = JSON.parse(content.replace('CHALLENGE_JOIN_CARD::', ''));
            const initials = (d.name || 'S')[0].toUpperCase();
            const photoBlock = d.photo ? `<img src="${d.photo}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : '';
            const bgImg = d.challengeImage ? `background-image:url('${d.challengeImage}');background-size:cover;background-position:center;` : '';
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;"><div style="width:85%;max-width:340px;min-width:200px;"><div style="width:100%;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#060e08 0%,#040d06 60%,#030a04 100%);border:1px solid rgba(74,222,128,0.45);box-shadow:0 12px 40px rgba(0,0,0,0.8);"><div style="position:relative;width:100%;height:130px;background:#030a04;overflow:hidden;${bgImg}"><div style="position:absolute;inset:0;background:rgba(0,0,0,0.55);"></div><div style="position:relative;z-index:1;width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><div style="width:48px;height:48px;border-radius:50%;overflow:hidden;border:2px solid rgba(74,222,128,0.6);position:relative;">${photoBlock}<div style="${d.photo ? 'display:none;' : ''}position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(74,222,128,0.1);font-family:'Orbitron';font-size:1.1rem;color:#4ade80;">${initials}</div></div></div><div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,#060e08 100%);"></div><div style="position:absolute;top:8px;left:50%;transform:translateX(-50%);background:rgba(3,10,4,0.9);border:1px solid rgba(74,222,128,0.5);border-radius:20px;padding:3px 12px;white-space:nowrap;"><span style="font-family:'Orbitron',sans-serif;font-size:0.4rem;color:#4ade80;letter-spacing:2px;">\u2694 JOINED CHALLENGE</span></div></div><div style="padding:12px 16px 16px;text-align:center;"><div style="font-family:'Orbitron',sans-serif;font-size:0.9rem;color:#fff;font-weight:700;letter-spacing:2px;margin-bottom:4px;">${d.name||''}</div><div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(74,222,128,0.7);letter-spacing:1px;margin-bottom:8px;">${(d.challengeName||'').toUpperCase()}</div><div style="display:inline-flex;align-items:center;gap:5px;background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.2);border-radius:20px;padding:3px 12px;"><span style="width:5px;height:5px;border-radius:50%;background:#4ade80;box-shadow:0 0 6px #4ade80;display:inline-block;"></span><span style="font-family:'Orbitron',sans-serif;font-size:0.4rem;color:#4ade80;letter-spacing:2px;">ACTIVE USERS: ${d.activeCount||0}</span></div></div></div><div style="font-family:'Orbitron';font-size:0.36rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div></div></div>`;
        } catch { /* fall through */ }
    }

    // CHALLENGE ELIMINATED CARD
    if (content.startsWith('CHALLENGE_ELIM_CARD::')) {
        try {
            const d = JSON.parse(content.replace('CHALLENGE_ELIM_CARD::', ''));
            const initials = (d.name || 'S')[0].toUpperCase();
            const photoBlock = d.photo ? `<img src="${d.photo}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : '';
            const bgImg = d.challengeImage ? `background-image:url('${d.challengeImage}');background-size:cover;background-position:center;` : '';
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;"><div style="width:85%;max-width:340px;min-width:200px;"><div style="width:100%;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0e0606 0%,#0d0404 60%,#0a0303 100%);border:1px solid rgba(224,48,48,0.4);box-shadow:0 12px 40px rgba(0,0,0,0.8);"><div style="position:relative;width:100%;height:130px;background:#0a0303;overflow:hidden;${bgImg}"><div style="position:absolute;inset:0;background:rgba(0,0,0,0.6);"></div><div style="position:relative;z-index:1;width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><div style="width:48px;height:48px;border-radius:50%;overflow:hidden;border:2px solid rgba(224,48,48,0.5);position:relative;">${photoBlock}<div style="${d.photo ? 'display:none;' : ''}position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(224,48,48,0.1);font-family:'Orbitron';font-size:1.1rem;color:#e03030;">${initials}</div></div></div><div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,#0e0606 100%);"></div><div style="position:absolute;top:8px;left:50%;transform:translateX(-50%);background:rgba(10,3,3,0.9);border:1px solid rgba(224,48,48,0.45);border-radius:20px;padding:3px 12px;white-space:nowrap;"><span style="font-family:'Orbitron',sans-serif;font-size:0.4rem;color:#e03030;letter-spacing:2px;">\u2715 ELIMINATED</span></div></div><div style="padding:12px 16px 16px;text-align:center;"><div style="font-family:'Orbitron',sans-serif;font-size:0.9rem;color:#fff;font-weight:700;letter-spacing:2px;margin-bottom:4px;">${d.name||''}</div><div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(224,48,48,0.7);letter-spacing:1px;margin-bottom:8px;">${(d.challengeName||'').toUpperCase()}</div><div style="display:inline-flex;align-items:center;gap:5px;background:rgba(74,222,128,0.06);border:1px solid rgba(74,222,128,0.18);border-radius:20px;padding:3px 12px;"><span style="width:5px;height:5px;border-radius:50%;background:#4ade80;display:inline-block;"></span><span style="font-family:'Orbitron',sans-serif;font-size:0.4rem;color:#4ade80;letter-spacing:2px;">STILL IN: ${d.activeCount||0}</span></div></div></div><div style="font-family:'Orbitron';font-size:0.36rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div></div></div>`;
        } catch { /* fall through */ }
    }

    // CHALLENGE INVITE CARD
    if (content.startsWith('CHALLENGE_INVITE_CARD::')) {
        try {
            const d = JSON.parse(content.replace('CHALLENGE_INVITE_CARD::', ''));
            const bgImg = d.challengeImage ? `background-image:url('${d.challengeImage}');background-size:cover;background-position:center;` : '';
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;"><div style="width:85%;max-width:340px;min-width:200px;"><div style="width:100%;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0e0b06 0%,#0d0a04 60%,#0a0803 100%);border:1px solid rgba(197,160,89,0.5);box-shadow:0 12px 40px rgba(0,0,0,0.8);"><div style="position:relative;width:100%;height:130px;background:#0a0803;overflow:hidden;${bgImg}"><div style="position:absolute;inset:0;background:rgba(0,0,0,0.55);"></div><div style="position:relative;z-index:1;width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><div style="font-family:'Orbitron',sans-serif;font-size:2rem;color:rgba(197,160,89,0.6);">\u2694</div></div><div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,#0e0b06 100%);"></div><div style="position:absolute;top:8px;left:50%;transform:translateX(-50%);background:rgba(10,8,3,0.9);border:1px solid rgba(197,160,89,0.5);border-radius:20px;padding:3px 12px;white-space:nowrap;"><span style="font-family:'Orbitron',sans-serif;font-size:0.4rem;color:#c5a059;letter-spacing:2px;">\u2694 CHALLENGE INVITATION</span></div></div><div style="padding:12px 16px 16px;text-align:center;"><div style="font-family:'Orbitron',sans-serif;font-size:0.9rem;color:#fff;font-weight:700;letter-spacing:2px;margin-bottom:6px;">${(d.challengeName||'').toUpperCase()}</div><div style="font-family:'Rajdhani',sans-serif;font-size:0.78rem;color:#777;margin-bottom:10px;">${d.durationDays||'?'} days \u00B7 ${d.tasksPerDay||'?'} tasks/day \u00B7 ${(d.joinCost||0).toLocaleString()} coins</div><div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:10px;"><div style="display:inline-flex;align-items:center;gap:5px;background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.2);border-radius:20px;padding:3px 12px;"><span style="width:5px;height:5px;border-radius:50%;background:#4ade80;box-shadow:0 0 6px #4ade80;display:inline-block;"></span><span style="font-family:'Orbitron',sans-serif;font-size:0.38rem;color:#4ade80;letter-spacing:2px;">ACTIVE: ${d.activeCount||0}</span></div></div></div></div><div style="font-family:'Orbitron';font-size:0.36rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div></div></div>`;
        } catch { /* fall through */ }
    }

    // LEADERBOARD REWARD CARD
    if (content.startsWith('LEADERBOARD_REWARD_CARD::')) {
        try {
            const d = JSON.parse(content.replace('LEADERBOARD_REWARD_CARD::', ''));
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;"><div style="width:85%;max-width:340px;min-width:200px;"><div style="width:100%;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0e0b06 0%,#110d04 60%,#0a0703 100%);border:1px solid rgba(197,160,89,0.6);box-shadow:0 12px 40px rgba(0,0,0,0.8),0 0 30px rgba(197,160,89,0.1);"><div style="padding:20px 20px;text-align:center;"><div style="font-size:1.6rem;margin-bottom:6px;">👑</div><div style="font-family:'Cinzel',serif;font-size:0.8rem;color:#c5a059;letter-spacing:3px;margin-bottom:4px;">${d.title || 'CHAMPION'}</div><div style="width:40%;height:1px;background:linear-gradient(to right,transparent,rgba(197,160,89,0.5),transparent);margin:8px auto;"></div>${d.winnerName ? `<div style="font-family:'Orbitron',sans-serif;font-size:0.85rem;color:#fff;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">${d.winnerName}</div>` : ''}<div style="font-family:'Rajdhani',sans-serif;font-size:0.95rem;color:rgba(255,255,255,0.8);margin-bottom:6px;">${d.rewards || ''}</div><div style="font-family:'Orbitron',sans-serif;font-size:0.4rem;color:rgba(197,160,89,0.5);letter-spacing:2px;">SCORE: ${(d.score || 0).toLocaleString()} · ${(d.period || '').toUpperCase()}</div></div></div><div style="font-family:'Orbitron';font-size:0.36rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div></div></div>`;
        } catch { /* fall through */ }
    }

    // UPDATE TRIBUTE CARD
    if (content.startsWith('UPDATE_TRIBUTE_CARD::')) {
        try {
            const d = JSON.parse(content.replace('UPDATE_TRIBUTE_CARD::', ''));
            const coverSrc = d.image || '';
            const priceVal = d.price ? Number(d.price).toLocaleString() : '';
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;"><div style="width:220px;"><div style="border-radius:12px;overflow:hidden;background:#0a0a14;border:1px solid rgba(197,160,89,0.4);box-shadow:0 6px 24px rgba(0,0,0,0.5);"><div style="width:100%;height:120px;background-image:url('${coverSrc}');background-size:cover;background-position:center;position:relative;">${priceVal ? `<div style="position:absolute;top:7px;right:8px;background:rgba(10,7,3,0.85);border:1px solid rgba(197,160,89,0.5);border-radius:20px;padding:3px 10px;font-family:'Orbitron',sans-serif;font-size:0.38rem;color:#c5a059;display:flex;align-items:center;gap:5px;letter-spacing:1px;"><i class="fas fa-coins"></i> ${priceVal}</div>` : ''}</div><div style="padding:10px 14px 14px;"><div style="font-family:'Orbitron',sans-serif;font-size:0.45rem;color:rgba(197,160,89,0.7);letter-spacing:2px;margin-bottom:4px;">\u2726 Gift Sent</div><div style="font-family:'Cinzel',serif;font-size:0.85rem;color:#fff;font-weight:700;letter-spacing:1px;">${d.title||''}</div><div style="font-family:'Orbitron',sans-serif;font-size:0.38rem;color:rgba(255,255,255,0.35);margin-top:6px;">${d.senderName||''}</div></div></div></div></div>`;
        } catch { /* fall through */ }
    }

    // DIRECT TRIBUTE CARD (coin send)
    if (content.startsWith('DIRECT_TRIBUTE_CARD::')) {
        try {
            const d = JSON.parse(content.replace('DIRECT_TRIBUTE_CARD::', ''));
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;"><div style="width:220px;border-radius:14px;overflow:hidden;background:linear-gradient(170deg,#0e0b06,#0d0a04,#0a0703);border:1px solid rgba(197,160,89,0.5);box-shadow:0 8px 30px rgba(0,0,0,0.6);text-align:center;padding:20px 16px;"><div style="font-size:1.8rem;margin-bottom:8px;">\u2728</div><div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(197,160,89,0.6);letter-spacing:3px;margin-bottom:10px;">TRIBUTE SENT</div><div style="font-family:'Orbitron',sans-serif;font-size:1.2rem;color:#c5a059;font-weight:700;margin-bottom:4px;">${(d.amount||0).toLocaleString()}</div><div style="font-family:'Rajdhani',sans-serif;font-size:0.5rem;color:rgba(197,160,89,0.4);letter-spacing:2px;margin-bottom:12px;">COINS</div><div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(255,255,255,0.35);">${d.senderName||''}</div></div></div>`;
        } catch { /* fall through */ }
    }

    // RISKY TRIBUTE CARD (gamble result)
    if (content.startsWith('RISKY_TRIBUTE_CARD::')) {
        try {
            const d = JSON.parse(content.replace('RISKY_TRIBUTE_CARD::', ''));
            const isWin = d.isWin;
            const borderColor = isWin ? 'rgba(197,160,89,0.5)' : d.lostAmount === 0 ? 'rgba(74,222,128,0.4)' : 'rgba(220,50,80,0.4)';
            const bg = isWin ? '#0e0b06' : d.lostAmount === 0 ? '#060e08' : '#0e0606';
            const resultText = isWin ? `WON +${(d.wonAmount||0).toLocaleString()}` : d.lostAmount === 0 ? 'MERCY - LOST NOTHING' : `LOST ${(d.lostAmount||0).toLocaleString()}`;
            const resultColor = isWin ? '#c5a059' : d.lostAmount === 0 ? '#4ade80' : '#e03050';
            const rIconHtml = d.icon && d.icon.startsWith('/') ? `<img src="${d.icon}" style="width:70px;height:auto;">` : `<div style="font-size:2.2rem;">${d.icon||'🎰'}</div>`;
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;"><div style="width:min(90%,320px);border-radius:14px;overflow:hidden;background:linear-gradient(170deg,${bg},#0a0a14);border:1px solid ${borderColor};box-shadow:0 8px 30px rgba(0,0,0,0.6);padding:14px 16px;"><div style="display:flex;align-items:center;gap:14px;"><div style="flex-shrink:0;width:70px;display:flex;align-items:center;justify-content:center;">${rIconHtml}</div><div style="flex:1;min-width:0;"><div style="font-family:'Cinzel',serif;font-size:0.8rem;color:rgba(255,255,255,0.85);font-weight:700;margin-bottom:4px;">${d.senderName||''}</div><div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(255,255,255,0.35);letter-spacing:2px;margin-bottom:3px;">RISKY SEND</div><div style="font-family:'Orbitron',sans-serif;font-size:0.55rem;color:${resultColor};letter-spacing:1px;font-weight:700;margin-bottom:3px;">${d.cardName||''}</div><div style="font-family:'Rajdhani',sans-serif;font-size:0.75rem;color:rgba(255,255,255,0.45);">Staked ${(d.stakeAmount||0).toLocaleString()} · <span style="color:${resultColor};font-weight:700;">${resultText}</span></div></div></div></div></div>`;
        } catch { /* fall through */ }
    }

    // UPDATE PHOTO CARD
    if (content.startsWith('UPDATE_PHOTO_CARD::')) {
        try {
            const d = JSON.parse(content.replace('UPDATE_PHOTO_CARD::', ''));
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;"><div style="width:85%;max-width:340px;min-width:200px;"><div style="background:#0a0a14;border:1px solid rgba(197,160,89,0.2);border-radius:14px;overflow:hidden;width:100%;box-shadow:0 8px 30px rgba(0,0,0,0.5);"><img src="${d.mediaUrl}" style="width:100%;max-height:220px;object-fit:cover;display:block;" loading="lazy" onerror="this.style.display='none'"><div style="padding:10px 14px 12px;"><div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-family:'Orbitron';font-size:0.75rem;color:#fff;font-weight:700;">${d.senderName||''}</span><span style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.35);">${time}</span></div>${d.caption ? `<div style="font-family:'Rajdhani';font-size:0.72rem;color:rgba(255,255,255,0.5);margin-top:3px;">${d.caption}</div>` : ''}</div></div></div></div>`;
        } catch { /* fall through */ }
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
            const label = passed ? '\u2713 TASK PASSED' : '\u2715 TASK FAILED';
            const subLabel = passed ? `Day ${d.dayNumber||'?'} \u00B7 Task ${d.windowNumber||'?'} - continues${d.taskNum ? ` (${d.taskNum})` : ''}` : `Day ${d.dayNumber||'?'} \u00B7 Task ${d.windowNumber||'?'} - eliminated`;
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;"><div style="width:85%;max-width:340px;min-width:200px;"><div style="background:${accentBg};border:1px solid ${accentBorder};border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;box-sizing:border-box;"><div style="width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,0.05);border:1.5px solid ${accentBorder};overflow:hidden;position:relative;flex-shrink:0;">${d.senderAvatar ? `<img src="${d.senderAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none'">` : ''}<div style="display:${d.senderAvatar ? 'none' : 'flex'};position:absolute;inset:0;align-items:center;justify-content:center;font-family:'Orbitron';font-size:0.65rem;color:${accentColor};">${cInitial}</div></div><div style="flex:1;min-width:0;"><div style="font-family:'Orbitron';font-size:0.4rem;color:${accentColor};letter-spacing:1px;margin-bottom:2px;">${label}</div><div style="font-family:'Orbitron';font-size:0.8rem;color:#fff;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.senderName||''}</div><div style="font-family:'Rajdhani';font-size:0.7rem;color:rgba(255,255,255,0.45);margin-top:2px;">${subLabel}</div>${passed && d.points ? `<div style="font-family:'Orbitron';font-size:0.7rem;color:#a78bfa;font-weight:700;margin-top:2px;">+${d.points} pts</div>` : ''}</div><div style="font-family:'Orbitron';font-size:0.36rem;color:rgba(255,255,255,0.35);flex-shrink:0;align-self:flex-start;">${time}</div></div></div></div>`;
        } catch { /* fall through */ }
    }

    // UPDATE MERIT CARD
    if (content.startsWith('UPDATE_MERIT_CARD::')) {
        try {
            const d = JSON.parse(content.replace('UPDATE_MERIT_CARD::', ''));
            const mInitial = (d.senderName || 'S')[0].toUpperCase();
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;"><div style="width:85%;max-width:340px;min-width:200px;"><div style="background:rgba(167,139,250,0.05);border:1px solid rgba(167,139,250,0.25);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;box-sizing:border-box;"><div style="width:42px;height:42px;border-radius:50%;background:rgba(167,139,250,0.1);border:1.5px solid rgba(167,139,250,0.35);overflow:hidden;position:relative;flex-shrink:0;">${d.senderAvatar ? `<img src="${d.senderAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none'">` : ''}<div style="display:${d.senderAvatar ? 'none' : 'flex'};position:absolute;inset:0;align-items:center;justify-content:center;font-family:'Orbitron';font-size:0.65rem;color:#a78bfa;">${mInitial}</div></div><div style="flex:1;min-width:0;"><div style="font-family:'Orbitron';font-size:0.4rem;color:rgba(255,255,255,0.5);letter-spacing:1px;margin-bottom:2px;">\u26A1 MERIT EARNED</div><div style="font-family:'Orbitron';font-size:0.8rem;color:#fff;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.senderName||''}</div><div style="font-family:'Orbitron';font-size:0.82rem;color:#a78bfa;font-weight:700;margin-top:2px;">+${d.points||0} MERIT</div></div><div style="font-family:'Orbitron';font-size:0.36rem;color:rgba(255,255,255,0.35);flex-shrink:0;align-self:flex-start;">${time}</div></div></div></div>`;
        } catch { /* fall through */ }
    }

    // UPDATE COINS CARD
    if (content.startsWith('UPDATE_COINS_CARD::')) {
        try {
            const d = JSON.parse(content.replace('UPDATE_COINS_CARD::', ''));
            const cInitial = (d.senderName || 'S')[0].toUpperCase();
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:6px;"><div style="width:85%;max-width:340px;min-width:200px;"><div style="background:rgba(197,160,89,0.05);border:1px solid rgba(197,160,89,0.25);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;box-sizing:border-box;"><div style="width:42px;height:42px;border-radius:50%;background:rgba(197,160,89,0.1);border:1.5px solid rgba(197,160,89,0.35);overflow:hidden;position:relative;flex-shrink:0;">${d.senderAvatar ? `<img src="${d.senderAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none'">` : ''}<div style="display:${d.senderAvatar ? 'none' : 'flex'};position:absolute;inset:0;align-items:center;justify-content:center;font-family:'Orbitron';font-size:0.65rem;color:#c5a059;">${cInitial}</div></div><div style="flex:1;min-width:0;"><div style="font-family:'Orbitron';font-size:0.4rem;color:rgba(255,255,255,0.5);letter-spacing:1px;margin-bottom:2px;">🪙 COINS EARNED</div><div style="font-family:'Orbitron';font-size:0.8rem;color:#fff;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.senderName||''}</div><div style="font-family:'Orbitron';font-size:0.82rem;color:#c5a059;font-weight:700;margin-top:2px;">+${d.points||0} COINS</div></div><div style="font-family:'Orbitron';font-size:0.36rem;color:rgba(255,255,255,0.35);flex-shrink:0;align-self:flex-start;">${time}</div></div></div></div>`;
        } catch { /* fall through */ }
    }

    const hasPhoto = msg.media_url && msg.media_type !== 'video' && msg.media_type !== 'gif';
    const hasVideo = msg.media_url && msg.media_type === 'video';
    const isGif = (content === '[GIF]' && msg.media_url);
    const _isMediaOnly = (hasVideo || hasPhoto || isGif) && (!content || content === '[VIDEO]' || content === '[PHOTO]' || content === '[GIF]');
    const _mobPlaySvg = `<svg width="44" height="44" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="23" fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.4)" stroke-width="2"/><path d="M19 14.5L35 24L19 33.5V14.5Z" fill="rgba(255,255,255,0.9)"/></svg>`;
    const _mobThumbStyle = msg.thumbnail_url ? `background-image:url('${msg.thumbnail_url.replace(/'/g, "\\'")}');background-size:cover;background-position:center;` : 'background:#0a0a0a;';
    const mediaHtml = msg.media_url
        ? (hasVideo
            ? `<div style="margin-top:6px;width:160px;aspect-ratio:3/4;border-radius:10px;overflow:hidden;position:relative;cursor:pointer;${_mobThumbStyle}display:flex;align-items:center;justify-content:center;" onclick="window._openGlobalLightbox&&window._openGlobalLightbox('${msg.media_url.replace(/'/g, "\\'")}','video')">${_mobPlaySvg}</div>`
            : isGif
                ? `<img src="${msg.media_url}" style="max-width:200px;width:auto;height:auto;max-height:180px;border-radius:10px;display:block;margin-top:4px;" />`
                : `<div style="margin-top:6px;width:160px;aspect-ratio:3/4;border-radius:10px;overflow:hidden;cursor:pointer;" onclick="window._openGlobalLightbox&&window._openGlobalLightbox('${(msg.media_url||'').replace(/'/g,"\\'")}')"><img src="${msg.media_url}" style="width:100%;height:100%;object-fit:cover;display:block;" /></div>`)
        : '';

    // Like button
    const _likeId = msgId || `${(msg.created_at || '')}::${senderEmail}`;
    const _liked = typeof window !== 'undefined' ? (function(){ try { const s = JSON.parse(localStorage.getItem('gl_liked_msgs') || '[]'); return s.includes(_likeId); } catch { return false; } })() : false;
    const _heartSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="${_liked ? '#e03050' : 'none'}" stroke="${_liked ? '#e03050' : 'rgba(255,255,255,0.3)'}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
    const _likeBtn = `<button onclick="event.stopPropagation();window._toggleGlobalLike&&window._toggleGlobalLike('${_likeId.replace(/'/g, "\\'")}',this)" style="background:none;border:none;cursor:pointer;padding:3px;display:flex;align-items:center;transition:transform 0.15s;" title="Like">${_heartSvg}</button>`;

    const av = msg.sender_avatar || null;
    const avatarHtml = av
        ? `<img src="${av}" style="width:18px;height:18px;border-radius:50%;object-fit:cover;border:1px solid rgba(197,160,89,0.4);flex-shrink:0;" onerror="this.style.display='none'">`
        : `<div style="width:18px;height:18px;border-radius:50%;background:rgba(197,160,89,0.15);border:1px solid rgba(197,160,89,0.25);display:flex;align-items:center;justify-content:center;font-family:Orbitron;font-size:0.38rem;color:#c5a059;flex-shrink:0;">${(name[0]||'S').toUpperCase()}</div>`;

    // QUEEN bubble
    if (isQueen) {
        const _qHeader = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;gap:6px;"><div style="display:flex;align-items:center;gap:5px;flex-shrink:0;"><img src="/queen-nav.png" style="width:22px;height:22px;border-radius:50%;object-fit:cover;border:1.5px solid rgba(197,160,89,0.7);flex-shrink:0;"><div style="display:flex;align-items:center;gap:4px;white-space:nowrap;flex-shrink:0;">${SVG_CROWN_MOB}<span style="font-family:'Cinzel',serif;font-size:0.72rem;color:#c5a059;letter-spacing:1px;font-weight:700;white-space:nowrap;">QUEEN KARIN</span></div><span style="font-family:'Orbitron';font-size:0.38rem;color:rgba(197,160,89,0.6);white-space:nowrap;flex-shrink:0;"> \u00B7 ${time}</span></div><div style="display:flex;align-items:center;gap:4px;">${_likeBtn}${replyBtn}</div></div>`;
        const qContent = ((content === '[GIF]' || content === '[VIDEO]' || content === '[PHOTO]') && msg.media_url) ? '' : content;

        if (_isMediaOnly) {
            return `<div style="padding:4px 10px;margin-bottom:6px;">${_qHeader}${mediaHtml}</div>`;
        }
        return `<div style="padding:8px 12px 10px;margin-bottom:6px;background:linear-gradient(135deg,rgba(197,160,89,0.14),rgba(100,75,15,0.08));border:1.5px solid rgba(197,160,89,0.75);border-radius:10px;box-shadow:0 0 14px rgba(197,160,89,0.12);overflow:hidden;">${_qHeader}${quoteHtml}${qContent ? `<span style="font-family:'Rajdhani',sans-serif;font-size:0.95rem;color:rgba(255,255,255,0.7);line-height:1.5;">${qContent}</span>` : ''}${mediaHtml}</div>`;
    }

    // GIF CARD
    if (msg.media_type === 'gif' || (content === '[GIF]' && msg.media_url)) {
        const gifUrl = msg.media_url;
        return `<div class="mob-gl-talk-msg"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;"><div style="display:flex;align-items:center;gap:5px;min-width:0;flex:1;">${avatarHtml}<span class="mob-gl-talk-name">${name}</span><span class="mob-gl-talk-time"> \u00B7 ${time}</span></div>${replyBtn}</div><div style="max-width:240px;width:60vw;border-radius:14px;overflow:hidden;background:linear-gradient(170deg,#0e0b06,#110d04,#0a0703);border:1px solid rgba(197,160,89,0.35);box-shadow:0 8px 30px rgba(0,0,0,0.7);"><img src="${gifUrl}" style="width:100%;display:block;max-height:200px;object-fit:contain;" onerror="this.style.display='none'" /></div></div>`;
    }

    // Guardian (Vlad) bubble
    const isGuardian = senderEmail === 'guardian';
    if (isGuardian) {
        return `<div class="mob-gl-talk-msg" style="background:linear-gradient(135deg,rgba(255,0,237,0.10),rgba(0,10,255,0.10));border:1px solid rgba(255,0,237,0.3);box-shadow:inset 0 0 20px rgba(0,10,255,0.05);">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                <div style="display:flex;align-items:center;gap:5px;min-width:0;flex:1;">
                    <div style="width:18px;height:18px;border-radius:50%;background:linear-gradient(135deg,rgba(255,0,237,0.3),rgba(0,10,255,0.3));border:1px solid rgba(255,0,237,0.5);display:flex;align-items:center;justify-content:center;font-family:Orbitron;font-size:0.35rem;color:#fff;flex-shrink:0;">V</div>
                    <span style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(255,0,237,0.7);letter-spacing:1px;">VLAD</span>
                    <span class="mob-gl-talk-time"> \u00B7 ${time}</span>
                </div>
                ${replyBtn}
            </div>
            ${quoteHtml}<span style="font-family:'Plus Jakarta Sans',sans-serif;font-size:0.92rem;color:rgba(255,255,255,0.85);line-height:1.45;">${content}</span>
        </div>`;
    }

    // Default message bubble
    const isMediaLabel = (content === '[GIF]' || content === '[VIDEO]' || content === '[PHOTO]') && mediaHtml;
    const contentEl = isMediaLabel ? '' : `<span class="mob-gl-talk-content">${content}</span>`;
    const _uMobHeader = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
        <div style="display:flex;align-items:center;gap:5px;min-width:0;flex:1;">
            ${avatarHtml}
            <span class="mob-gl-talk-name">${name}</span>
            <span class="mob-gl-talk-time"> \u00B7 ${time}</span>
        </div>
        ${replyBtn}
    </div>`;

    if (_isMediaOnly) {
        return `<div style="padding:4px 10px;margin-bottom:6px;">${_uMobHeader}${mediaHtml}</div>`;
    }
    return `<div class="mob-gl-talk-msg">
        ${_uMobHeader}
        ${quoteHtml ? `<div style="margin-bottom:3px;">${quoteHtml}</div>` : ''}
        ${contentEl}
        ${mediaHtml}
    </div>`;
}

// ─── SEND MESSAGE ────────────────────────────────────────────────────────────

async function sendMobGlMessage() {
    const input = document.getElementById('mobGlTalkInput') as HTMLInputElement;
    if (!input || !input.value.trim()) return;
    const content = input.value.trim();
    input.value = '';

    const user = _getUserIdentity();
    if (!user) return;

    const replyTo = _mobGlReply ? { sender_name: _mobGlReply.name, content: _mobGlReply.text } : null;
    cancelMobGlReply();
    _mobGlPendingSent.add(content);

    _appendMobGlMessage({
        sender_name: user.name,
        sender_email: user.email,
        message: content,
        reply_to: replyTo,
        created_at: new Date().toISOString(),
    });

    try {
        await fetch('/api/global/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: content, senderEmail: user.email, reply_to: replyTo })
        });
        // Auto-summon Guardian when @vlad is tagged in global chat
        if (/@vlad/i.test(content)) {
            try {
                const gRes = await fetch('/api/global/guardian', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userMessage: content, senderName: user.name, senderEmail: user.email }),
                });
                if (gRes.ok) {
                    const gData = await gRes.json();
                    if (gData.message) _appendMobGlMessage(gData.message);
                }
            } catch (e) { console.warn('[Global Guardian] auto-summon failed:', e); }
        }
    } catch {}
}

function handleMobGlKey(e: KeyboardEvent) {
    if (e.key === 'Enter') sendMobGlMessage();
}

// ─── REPLY ───────────────────────────────────────────────────────────────────

function _ensureReplyBar() {
    if (document.getElementById('mobGlReplyBar')) return;
    const feed = document.getElementById('mobGlTalkFeed');
    if (!feed) return;
    const bar = document.createElement('div');
    bar.id = 'mobGlReplyBar';
    bar.style.cssText = 'display:none;align-items:center;gap:10px;padding:7px 14px;background:rgba(197,160,89,0.07);border-top:1px solid rgba(197,160,89,0.18);flex-shrink:0;';
    bar.innerHTML = `
        <div style="flex:1;min-width:0;border-left:2px solid rgba(197,160,89,0.6);padding-left:8px;">
            <div id="mobGlReplyBarName" style="font-family:Orbitron;font-size:0.33rem;color:rgba(197,160,89,0.8);letter-spacing:1px;margin-bottom:2px;"></div>
            <div id="mobGlReplyBarText" style="font-family:Rajdhani;font-size:0.78rem;color:rgba(255,255,255,0.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
        </div>
        <button onclick="window.cancelMobGlReply()" style="background:none;border:none;color:rgba(255,255,255,0.35);cursor:pointer;font-size:1rem;padding:4px 6px;flex-shrink:0;line-height:1;">\u2715</button>`;
    feed.insertAdjacentElement('afterend', bar);
}

function setMobGlReply(id: string, name: string, text: string) {
    _mobGlReply = { id, name, text };
    _ensureReplyBar();
    const bar = document.getElementById('mobGlReplyBar');
    if (bar) bar.style.display = 'flex';
    const nameEl = document.getElementById('mobGlReplyBarName');
    const textEl = document.getElementById('mobGlReplyBarText');
    if (nameEl) nameEl.innerHTML = `<svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="rgba(197,160,89,0.8)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px;"><polyline points="8 16 3 11 8 6"></polyline><path d="M17 4v7a4 4 0 0 1-4 4H3"></path></svg>` + name;
    if (textEl) textEl.textContent = text.slice(0, 80);
    document.getElementById('mobGlTalkInput')?.focus();
}

function cancelMobGlReply() {
    _mobGlReply = null;
    const bar = document.getElementById('mobGlReplyBar');
    if (bar) bar.style.display = 'none';
}

// ─── GIF PICKER ──────────────────────────────────────────────────────────────

async function _sendMobGlGif(gifUrl: string) {
    const user = _getUserIdentity();
    if (!user) return;
    _mobGlPendingSent.add(gifUrl);
    _appendMobGlMessage({
        sender_name: user.name, sender_email: user.email,
        message: '[GIF]', media_url: gifUrl, media_type: 'gif',
        created_at: new Date().toISOString(),
    });
    try {
        await fetch('/api/global/messages', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: '[GIF]', senderEmail: user.email, media_url: gifUrl, media_type: 'gif' }),
        });
    } catch {}
}

function openMobGlGifPicker() {
    if (_mobGlGifOpen) { closeMobGlGifPicker(); return; }
    _mobGlGifOpen = true;
    document.getElementById('mobGlGifPickerOverlay')?.remove();

    const talkPanel = document.getElementById('mobGlPanel_talk');
    const talkFooter = talkPanel?.querySelector('.mob-gl-talk-footer') || null;

    const panel = document.createElement('div');
    panel.id = 'mobGlGifPickerOverlay';
    panel.style.cssText = 'max-height:45vh;overflow-y:auto;border-top:1px solid rgba(197,160,89,0.15);background:#0d0b08;padding:8px;flex-shrink:0;';
    panel.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:8px;">
            <input id="mobGlGifSearchInput" type="text" placeholder="Search GIFs..." autocomplete="off" style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;font-family:'Rajdhani',sans-serif;font-size:0.95rem;padding:7px 11px;border-radius:6px;outline:none;" />
            <button onclick="window.closeMobGlGifPicker()" style="background:none;border:none;color:rgba(255,255,255,0.35);font-size:1.1rem;cursor:pointer;">\u2715</button>
        </div>
        <div id="mobGlGifGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;">
            <div style="grid-column:1/-1;text-align:center;padding:20px;font-family:'Orbitron';font-size:0.5rem;color:rgba(255,255,255,0.2);">LOADING...</div>
        </div>
        <div style="padding:5px 0;text-align:right;"><span style="font-family:'Orbitron';font-size:0.32rem;color:rgba(255,255,255,0.12);letter-spacing:1px;">via Tenor</span></div>
    `;

    if (talkFooter && talkPanel) {
        talkPanel.insertBefore(panel, talkFooter);
    } else {
        panel.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);width:min(420px, 96vw);max-height:55vh;background:#0d0b08;border:1px solid rgba(197,160,89,0.25);border-radius:12px;display:flex;flex-direction:column;overflow:hidden;z-index:1000002;box-shadow:0 8px 40px rgba(0,0,0,0.7);';
        document.body.appendChild(panel);
    }

    const searchInput = panel.querySelector('#mobGlGifSearchInput') as HTMLInputElement;
    searchInput?.addEventListener('input', () => {
        if (_mobGlGifTimeout) clearTimeout(_mobGlGifTimeout);
        _mobGlGifTimeout = setTimeout(() => _searchMobGlGifs(searchInput.value || 'funny'), 400);
    });
    _searchMobGlGifs('funny');
    setTimeout(() => searchInput?.focus(), 50);
}

async function _searchMobGlGifs(q: string) {
    const grid = document.getElementById('mobGlGifGrid');
    if (!grid) return;
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;font-family:'Orbitron';font-size:0.5rem;color:rgba(255,255,255,0.2);">LOADING...</div>`;
    try {
        const res = await fetch(`/api/global/gifs?q=${encodeURIComponent(q)}`);
        const { results } = await res.json();
        if (!results?.length) { grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;font-family:'Orbitron';font-size:0.5rem;color:rgba(255,255,255,0.2);">NO RESULTS</div>`; return; }
        grid.innerHTML = results.map((r: any) => `<div onclick="window._selectMobGlGif('${encodeURIComponent(r.url)}')" style="cursor:pointer;border-radius:6px;overflow:hidden;aspect-ratio:1;background:rgba(255,255,255,0.04);"><img src="${r.preview}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.parentElement.style.display='none'"></div>`).join('');
    } catch { grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;font-family:'Orbitron';font-size:0.5rem;color:rgba(255,255,255,0.2);">FAILED</div>`; }
}

function closeMobGlGifPicker() {
    _mobGlGifOpen = false;
    document.getElementById('mobGlGifPickerOverlay')?.remove();
}

// ─── CHALLENGES ──────────────────────────────────────────────────────────────

async function _loadMobGlChallenges() {
    if (_mobGlLoaded['challenges']) return;
    const container = document.getElementById('mobGlChallengesFeed');
    if (!container) return;
    container.innerHTML = `<div style="text-align:center;padding:40px;color:#444;font-family:Orbitron;font-size:0.55rem;letter-spacing:2px">LOADING...</div>`;
    try {
        const res = await fetch('/api/global/queen-videos', { cache: 'no-store' });
        const { videos } = await res.json();
        if (!videos?.length) {
            container.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;padding:40px;"><span style="font-size:2rem;opacity:0.2;">&#9654;</span><span style="font-family:'Orbitron';font-size:0.45rem;color:rgba(197,160,89,0.3);letter-spacing:2px;text-align:center;">NO VIDEOS YET</span></div>`;
            return;
        }
        _queenVideosList = videos;
        container.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:20px;padding:20px 16px;justify-content:center;">` + videos.map((v: any) => {
            const date = new Date(v.created_at);
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
            const thumb = v.thumbnail_url || '/queen-karin.png';
            return `<div style="display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;" onclick="window._playQueenVideo&&window._playQueenVideo('${v.media_url.replace(/'/g, "\\'")}')">
                <div style="width:90px;height:90px;border-radius:50%;overflow:hidden;border:2px solid rgba(197,160,89,0.5);position:relative;box-shadow:0 0 12px rgba(197,160,89,0.15);">
                    <img src="${thumb}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.src='/queen-karin.png'" />
                    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.25);">
                        <div style="width:0;height:0;border-style:solid;border-width:7px 0 7px 12px;border-color:transparent transparent transparent rgba(255,255,255,0.85);margin-left:2px;"></div>
                    </div>
                </div>
                <div style="font-family:Orbitron;font-size:0.42rem;color:rgba(197,160,89,0.7);letter-spacing:1.5px;text-align:center;">${dateStr}</div>
            </div>`;
        }).join('') + `</div>`;
        _mobGlLoaded['challenges'] = true;
    } catch { container.innerHTML = `<div style="text-align:center;padding:40px;color:#333;font-family:Orbitron;font-size:0.75rem">UNABLE TO LOAD</div>`; }
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
if (typeof window !== 'undefined') {
    (window as any)._playQueenVideo = _playQueenVideo;
    (window as any)._openGlobalLightbox = async (url: string, type?: string) => {
        if (type === 'video') {
            if (!_queenVideosList.length) {
                try {
                    const res = await fetch('/api/global/queen-videos', { cache: 'no-store' });
                    const { videos } = await res.json();
                    if (videos?.length) _queenVideosList = videos;
                } catch {}
            }
            if (!_queenVideosList.some((v: any) => v.media_url === url)) {
                _queenVideosList.unshift({ media_url: url, thumbnail_url: null });
            }
            _playQueenVideo(url);
            return;
        }
        let lb = document.getElementById('globalChatLightbox');
        if (!lb) {
            lb = document.createElement('div');
            lb.id = 'globalChatLightbox';
            lb.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:10000002;align-items:center;justify-content:center;cursor:zoom-out;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);';
            lb.innerHTML = '<div id="globalChatLightboxMedia" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;padding:20px;box-sizing:border-box;"></div>';
            lb.addEventListener('click', (e) => { if (e.target === lb || e.target === document.getElementById('globalChatLightboxMedia')) lb!.style.display = 'none'; });
            document.body.appendChild(lb);
        }
        const media = document.getElementById('globalChatLightboxMedia');
        if (media) media.innerHTML = `<img src="${url}" style="max-width:94vw;max-height:92vh;object-fit:contain;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,0.8);" />`;
        lb.style.display = 'flex';
    };
}

// ─── UPDATES ─────────────────────────────────────────────────────────────────

function _buildMobUpdateCard(u: any): string {
    const time = new Date(u.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (u.kind === 'tribute') {
        const coverSrc = u.image || '';
        const priceVal = u.price ? Number(u.price).toLocaleString() : '';
        return `<div style="margin-bottom:16px;display:flex;justify-content:center;"><div style="width:220px;border-radius:12px;overflow:hidden;background:#0a0a14;border:1px solid rgba(197,160,89,0.4);box-shadow:0 6px 24px rgba(0,0,0,0.5);"><div style="width:100%;height:120px;background-image:url('${coverSrc}');background-size:cover;background-position:center;position:relative;">${priceVal ? `<div style="position:absolute;top:7px;right:8px;background:rgba(10,7,3,0.85);border:1px solid rgba(197,160,89,0.5);border-radius:20px;padding:3px 10px;font-family:'Orbitron',sans-serif;font-size:0.38rem;color:#c5a059;display:flex;align-items:center;gap:5px;letter-spacing:1px;"><i class="fas fa-coins"></i> ${priceVal}</div>` : ''}</div><div style="padding:10px 14px 14px;"><div style="font-family:'Orbitron',sans-serif;font-size:0.45rem;color:rgba(197,160,89,0.7);letter-spacing:2px;margin-bottom:4px;">\u2726 Gift Sent</div><div style="font-family:'Cinzel',serif;font-size:0.85rem;color:#fff;font-weight:700;letter-spacing:1px;">${u.title || ''}</div><div style="font-family:'Orbitron',sans-serif;font-size:0.38rem;color:rgba(255,255,255,0.35);margin-top:6px;">${u.sender_name || ''}</div></div></div></div>`;
    }
    if (u.kind === 'points') {
        const initial = (u.sender_name || 'S')[0].toUpperCase();
        return `<div style="margin-bottom:16px;background:rgba(167,139,250,0.05);border:1px solid rgba(167,139,250,0.25);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:14px;width:100%;box-sizing:border-box;"><div style="width:42px;height:42px;border-radius:50%;background:rgba(167,139,250,0.1);border:1.5px solid rgba(167,139,250,0.35);overflow:hidden;position:relative;flex-shrink:0;">${u.sender_avatar ? `<img src="${u.sender_avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}<div style="display:${u.sender_avatar ? 'none' : 'flex'};position:absolute;inset:0;align-items:center;justify-content:center;font-family:'Orbitron';font-size:0.65rem;color:#a78bfa;">${initial}</div></div><div style="flex:1;min-width:0;"><div style="font-family:'Orbitron';font-size:0.42rem;color:rgba(255,255,255,0.55);letter-spacing:1px;margin-bottom:3px;">\u26A1 MERIT EARNED</div><div style="font-family:'Orbitron';font-size:0.82rem;color:#fff;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${u.sender_name || ''}</div><div style="font-family:'Orbitron';font-size:0.85rem;color:#a78bfa;font-weight:700;margin-top:2px;">+${u.points || 0} MERIT</div></div><div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.45);flex-shrink:0;align-self:flex-start;">${time}</div></div>`;
    }
    if (u.media_url) {
        return `<div style="margin-bottom:16px;background:#0a0a14;border:1px solid rgba(197,160,89,0.1);border-radius:10px;overflow:hidden;width:100%;position:relative;"><img src="${getOptimizedUrl(u.media_url, 600)}" style="width:100%;max-height:240px;object-fit:cover;display:block;" loading="lazy" onerror="this.style.display='none'"><div style="position:absolute;bottom:0;left:0;right:0;padding:8px 10px;background:linear-gradient(transparent,rgba(0,0,0,0.88));"><div style="font-family:'Orbitron';font-size:0.62rem;color:#fff;">${u.sender_name || ''} <span style="font-family:'Orbitron';font-size:0.35rem;color:rgba(255,255,255,0.55);">${time}</span></div>${u.caption ? `<div style="font-family:'Rajdhani';font-size:0.72rem;color:rgba(255,255,255,0.55);margin-top:2px;">${u.caption}</div>` : ''}</div></div>`;
    }
    return `<div style="margin-bottom:16px;background:rgba(255,255,255,0.02);border:1px solid rgba(197,160,89,0.12);border-radius:8px;padding:12px 14px;">${u.title ? `<div style="font-family:'Orbitron';font-size:0.7rem;color:#c5a059;letter-spacing:2px;margin-bottom:4px;">${u.title}</div>` : ''}${u.content ? `<div style="font-family:'Crimson Text';font-size:0.85rem;color:#bbb;line-height:1.5;">${u.content}</div>` : ''}<div style="font-family:'Orbitron';font-size:0.38rem;color:rgba(255,255,255,0.35);margin-top:6px;letter-spacing:1px;">${time}</div></div>`;
}

async function _loadMobGlUpdates() {
    if (_mobGlLoaded['updates']) return;
    const container = document.getElementById('mobGlUpdatesFeed');
    if (!container) return;
    container.innerHTML = `<div style="text-align:center;padding:40px;color:#444;font-family:Orbitron;font-size:0.55rem;letter-spacing:2px">LOADING...</div>`;
    try {
        const res = await fetch('/api/global/updates', { cache: 'no-store' });
        const data = await res.json();
        const updates: any[] = data.updates || data.posts || [];
        if (!updates.length) { container.innerHTML = `<div style="text-align:center;padding:40px;color:#333;font-family:Orbitron;font-size:0.75rem;letter-spacing:3px">NO UPDATES YET</div>`; return; }
        container.innerHTML = updates.map((u: any) => _buildMobUpdateCard(u)).join('');
        _mobGlLoaded['updates'] = true;
    } catch { container.innerHTML = `<div style="text-align:center;padding:40px;color:#333;font-family:Orbitron;font-size:0.75rem">UNABLE TO LOAD</div>`; }
}

// ─── WINDOW BINDINGS — same names as profile-logic.ts ────────────────────────

export function bindDashMobGlobal() {
    if (typeof window === 'undefined') return;
    // Use exact same window.* names as profile so the HTML onclick handlers work
    (window as any).openMobGlobal = openMobGlobal;
    (window as any).closeMobGlobal = closeMobGlobal;
    (window as any).switchMobGlTab = switchMobGlTab;
    (window as any).switchMobGlPeriod = switchMobGlPeriod;
    (window as any).sendMobGlMessage = sendMobGlMessage;
    (window as any).handleMobGlKey = handleMobGlKey;
    (window as any).setMobGlReply = setMobGlReply;
    (window as any).cancelMobGlReply = cancelMobGlReply;
    (window as any).openMobGlGifPicker = openMobGlGifPicker;
    (window as any).closeMobGlGifPicker = closeMobGlGifPicker;
    (window as any)._selectMobGlGif = (encodedUrl: string) => {
        closeMobGlGifPicker();
        _sendMobGlGif(decodeURIComponent(encodedUrl));
    };
}

// Re-export for direct imports
export { openMobGlobal as openDashMobGlobal, closeMobGlobal as closeDashMobGlobal };
