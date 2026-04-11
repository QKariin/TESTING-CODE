// dashboard-overview.ts — Professional queen dashboard home overview
import { getState as getDashState, users, globalTributes, globalQueue } from './dashboard-state';

// ── Activity feed ring buffer ──────────────────────────────────────────────
const _activityFeed: { time: Date; icon: string; text: string; color: string }[] = [];

export function pushActivity(icon: string, text: string, color = '#c5a059') {
    _activityFeed.unshift({ time: new Date(), icon, text, color });
    if (_activityFeed.length > 40) _activityFeed.pop();
    _renderActivityFeed();
}

function _timeAgo(d: Date): string {
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
}

function _renderActivityFeed() {
    const el = document.getElementById('ov-activity-feed');
    if (!el) return;
    if (_activityFeed.length === 0) {
        el.innerHTML = `<div style="padding:24px;text-align:center;font-family:Orbitron;font-size:0.45rem;color:rgba(255,255,255,0.15);letter-spacing:2px;">AWAITING ACTIVITY</div>`;
        return;
    }
    el.innerHTML = _activityFeed.slice(0, 12).map(a => `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid rgba(255,255,255,0.03);">
            <div style="width:32px;height:32px;border-radius:50%;background:rgba(197,160,89,0.08);border:1px solid rgba(197,160,89,0.15);display:flex;align-items:center;justify-content:center;font-size:0.85rem;flex-shrink:0;">${a.icon}</div>
            <div style="flex:1;min-width:0;">
                <div style="font-family:'Cinzel',serif;font-size:0.72rem;color:rgba(255,255,255,0.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${a.text}</div>
            </div>
            <div style="font-family:Orbitron;font-size:0.4rem;color:rgba(255,255,255,0.25);letter-spacing:1px;flex-shrink:0;">${_timeAgo(a.time)}</div>
        </div>
    `).join('');
}

// ── Revenue chart (last 7 days SVG bar chart) ──────────────────────────────
function _buildRevenueChart(): string {
    // Bucket tributes by day (last 7 days)
    const days: { label: string; value: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        days.push({
            label: d.toLocaleDateString('en-US', { weekday: 'short' }),
            value: 0
        });
    }

    // Sum tributes per day
    (globalTributes || []).forEach((t: any) => {
        const tDate = new Date(t.date || t.created_at || t.timestamp || Date.now());
        const daysAgo = Math.floor((now.getTime() - tDate.getTime()) / 86400000);
        if (daysAgo >= 0 && daysAgo < 7) {
            const idx = 6 - daysAgo;
            if (days[idx]) days[idx].value += Number(t.amount || t.price || t.coins || 0);
        }
    });

    const maxVal = Math.max(...days.map(d => d.value), 1);
    const W = 460, H = 140, barW = 42, gap = 20, padL = 10;
    const totalW = days.length * (barW + gap) - gap;
    const startX = (W - totalW) / 2;

    const bars = days.map((d, i) => {
        const x = startX + i * (barW + gap);
        const barH = Math.max(4, Math.round((d.value / maxVal) * (H - 40)));
        const y = H - 20 - barH;
        const isToday = i === 6;
        return `
            <g>
                <rect x="${x}" y="${y}" width="${barW}" height="${barH}"
                    rx="4"
                    fill="${isToday ? 'url(#goldGrad)' : 'rgba(197,160,89,0.25)'}"
                    stroke="${isToday ? 'rgba(197,160,89,0.8)' : 'rgba(197,160,89,0.15)'}"
                    stroke-width="1"
                />
                ${d.value > 0 ? `<text x="${x + barW / 2}" y="${y - 5}" text-anchor="middle" font-family="Orbitron" font-size="7" fill="rgba(197,160,89,0.8)">€${d.value >= 1000 ? (d.value / 1000).toFixed(1) + 'k' : d.value}</text>` : ''}
                <text x="${x + barW / 2}" y="${H - 4}" text-anchor="middle" font-family="Orbitron" font-size="8" fill="rgba(255,255,255,0.3)">${d.label}</text>
            </g>
        `;
    }).join('');

    return `
        <svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="overflow:visible;">
            <defs>
                <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#c5a059"/>
                    <stop offset="100%" stop-color="#8b6914"/>
                </linearGradient>
            </defs>
            <line x1="${padL}" y1="${H - 20}" x2="${W - padL}" y2="${H - 20}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
            ${bars}
        </svg>
    `;
}

// ── Slave status breakdown donut ───────────────────────────────────────────
function _buildSlaveDonut(): string {
    const now = Date.now();
    let online = 0, recent = 0, inactive = 0;
    (users || []).forEach((u: any) => {
        const last = new Date(u.lastSeen || u.last_active || u.lastWorship || 0).getTime();
        const mins = (now - last) / 60000;
        if (mins < 10) online++;
        else if (mins < 1440) recent++;
        else inactive++;
    });
    const total = online + recent + inactive || 1;
    const onlineP = Math.round((online / total) * 100);
    const recentP = Math.round((recent / total) * 100);

    // SVG donut
    const R = 40, cx = 55, cy = 55, circumference = 2 * Math.PI * R;
    const onlineDash = (online / total) * circumference;
    const recentDash = (recent / total) * circumference;
    const inactiveDash = (inactive / total) * circumference;

    return `
        <svg width="110" height="110" viewBox="0 0 110 110">
            <!-- inactive -->
            <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="12" stroke-dasharray="${circumference}" stroke-dashoffset="0" transform="rotate(-90 ${cx} ${cy})"/>
            <!-- recent -->
            <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="rgba(197,160,89,0.4)" stroke-width="12"
                stroke-dasharray="${recentDash} ${circumference - recentDash}"
                stroke-dashoffset="${-onlineDash}"
                transform="rotate(-90 ${cx} ${cy})"/>
            <!-- online -->
            <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#c5a059" stroke-width="12"
                stroke-dasharray="${onlineDash} ${circumference - onlineDash}"
                stroke-dashoffset="0"
                transform="rotate(-90 ${cx} ${cy})"/>
            <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-family="Orbitron" font-size="14" font-weight="700" fill="#fff">${total}</text>
            <text x="${cx}" y="${cy + 10}" text-anchor="middle" font-family="Orbitron" font-size="7" fill="rgba(255,255,255,0.35)">SLAVES</text>
        </svg>
        <div style="display:flex;flex-direction:column;gap:8px;justify-content:center;">
            <div style="display:flex;align-items:center;gap:8px;">
                <div style="width:10px;height:10px;border-radius:50%;background:#c5a059;box-shadow:0 0 6px rgba(197,160,89,0.6);"></div>
                <span style="font-family:Orbitron;font-size:0.42rem;color:rgba(255,255,255,0.5);">ONLINE NOW</span>
                <span style="font-family:Orbitron;font-size:0.5rem;color:#c5a059;margin-left:auto;">${online}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
                <div style="width:10px;height:10px;border-radius:50%;background:rgba(197,160,89,0.4);"></div>
                <span style="font-family:Orbitron;font-size:0.42rem;color:rgba(255,255,255,0.5);">ACTIVE TODAY</span>
                <span style="font-family:Orbitron;font-size:0.5rem;color:rgba(197,160,89,0.6);margin-left:auto;">${recent}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
                <div style="width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,0.08);"></div>
                <span style="font-family:Orbitron;font-size:0.42rem;color:rgba(255,255,255,0.5);">DORMANT</span>
                <span style="font-family:Orbitron;font-size:0.5rem;color:rgba(255,255,255,0.25);margin-left:auto;">${inactive}</span>
            </div>
        </div>
    `;
}

// ── Main render ────────────────────────────────────────────────────────────
export function renderOverview() {
    const el = document.getElementById('ov-revenue-chart');
    if (el) el.innerHTML = _buildRevenueChart();

    const donut = document.getElementById('ov-slave-donut');
    if (donut) donut.innerHTML = _buildSlaveDonut();

    _renderActivityFeed();

    // Stats
    const totalTributes = (globalTributes || []).length;
    const todayTributes = (globalTributes || []).filter((t: any) => {
        const d = new Date(t.date || t.created_at || t.timestamp || 0);
        return d.toDateString() === new Date().toDateString();
    });
    const todayRevenue = todayTributes.reduce((s: number, t: any) => s + Number(t.amount || t.price || t.coins || 0), 0);
    const monthRevenue = (globalTributes || []).reduce((s: number, t: any) => {
        const d = new Date(t.date || t.created_at || t.timestamp || 0);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
            ? s + Number(t.amount || t.price || t.coins || 0) : s;
    }, 0);

    const online = (users || []).filter((u: any) => {
        const last = new Date(u.lastSeen || u.last_active || u.lastWorship || 0).getTime();
        return (Date.now() - last) / 60000 < 10;
    }).length;

    const topSpender = [...(users || [])].sort((a: any, b: any) =>
        (b.totalSpend || b.wallet || 0) - (a.totalSpend || a.wallet || 0)
    )[0];

    _setOv('ov-stat-today', `€${todayRevenue.toLocaleString()}`);
    _setOv('ov-stat-month', `€${monthRevenue.toLocaleString()}`);
    _setOv('ov-stat-online', String(online));
    _setOv('ov-stat-pending', String((globalQueue || []).length));
    _setOv('ov-stat-total', String(totalTributes));
    _setOv('ov-stat-slaves', String((users || []).length));

    if (topSpender) {
        _setOv('ov-top-name', (topSpender.name || topSpender.member_id || '—').toUpperCase());
        _setOv('ov-top-val', `€${(topSpender.totalSpend || topSpender.wallet || 0).toLocaleString()}`);
        const img = document.getElementById('ov-top-avatar') as HTMLImageElement;
        if (img && topSpender.avatar) { img.src = topSpender.avatar; img.style.display = 'block'; }
    }
}

function _setOv(id: string, val: string) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}
