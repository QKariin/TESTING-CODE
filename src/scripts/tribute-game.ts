// src/scripts/tribute-game.ts
// Tribute menu + Direct Send + Risky Send card game for mobile profile

import { getState, setState } from '@/scripts/profile-state';

let _riskyPercent = 0;
let _riskyStake = 0;
let _busy = false;

function _el(): HTMLElement | null { return document.getElementById('mobTributeContent'); }
function _email(): string { const s = getState(); return s?.email || s?.memberId || ''; }
function _wallet(): number { return getState()?.wallet || 0; }

// ─── OPEN / CLOSE ─────────────────────────────────────────────────────────

export function openStandaloneTribute() {
    const o = document.getElementById('mobTributeStandalone');
    if (!o) return;
    o.style.display = 'flex';
    _showMenu();
}

export function closeStandaloneTribute() {
    const o = document.getElementById('mobTributeStandalone');
    if (o) o.style.display = 'none';
}

// ─── MENU ──────────────────────────────────────────────────────────────────

function _showMenu() {
    const el = _el(); if (!el) return;
    el.innerHTML = `
        <div style="display:flex;justify-content:flex-end;">
            <button onclick="window.closeStandaloneTribute()" style="color:rgba(197,160,89,0.5);background:transparent;border:1px solid rgba(197,160,89,0.15);border-radius:50%;width:36px;height:36px;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;">&#10005;</button>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;">
            <div style="font-family:'Cinzel',serif;font-size:1.4rem;color:#c5a059;letter-spacing:6px;">TRIBUTE</div>
            <div style="font-family:'Rajdhani',sans-serif;font-size:0.75rem;color:rgba(255,255,255,0.3);letter-spacing:2px;margin-bottom:16px;">CHOOSE YOUR OFFERING</div>
            ${_menuBtn('_tributeShowSend', 'SEND', 'Fixed coin amounts', 'rgba(197,160,89,0.12)', 'rgba(197,160,89,0.35)', '#c5a059')}
            ${_menuBtn('_tributeShowRisky', 'RISKY SEND', 'Gamble your coins', 'rgba(220,50,80,0.08)', 'rgba(220,50,80,0.35)', '#e03050')}
            ${_menuBtn('_tributeShowWishlist', 'WISHLIST', 'Buy Queen a gift', 'rgba(167,139,250,0.08)', 'rgba(167,139,250,0.25)', '#a78bfa')}
        </div>`;
}

function _menuBtn(fn: string, title: string, sub: string, bg: string, border: string, color: string) {
    return `<button onclick="window.${fn}()" style="width:260px;padding:18px 20px;background:linear-gradient(135deg,${bg},transparent);border:1px solid ${border};border-radius:12px;cursor:pointer;display:flex;align-items:center;gap:14px;-webkit-tap-highlight-color:transparent;">
        <div style="width:36px;height:36px;border-radius:50%;border:1px solid ${border};display:flex;align-items:center;justify-content:center;">
            <div style="width:8px;height:8px;border-radius:50%;background:${color};box-shadow:0 0 8px ${color};"></div>
        </div>
        <div><div style="font-family:'Orbitron',sans-serif;font-size:0.7rem;color:${color};letter-spacing:2px;font-weight:700;text-align:left;">${title}</div>
        <div style="font-family:'Rajdhani',sans-serif;font-size:0.68rem;color:rgba(255,255,255,0.3);text-align:left;">${sub}</div></div>
    </button>`;
}

// ─── DIRECT SEND ───────────────────────────────────────────────────────────

function _showSend() {
    const el = _el(); if (!el) return;
    const w = _wallet();
    const amounts = [500, 1000, 2000, 5000, 10000];
    el.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:28px;">
            <button onclick="window._tributeShowMenu()" style="color:rgba(197,160,89,0.5);background:transparent;border:1px solid rgba(197,160,89,0.15);border-radius:50%;width:36px;height:36px;cursor:pointer;font-size:0.9rem;display:flex;align-items:center;justify-content:center;">&#8592;</button>
            <span style="font-family:'Cinzel',serif;font-size:1rem;color:#c5a059;letter-spacing:4px;">SEND TRIBUTE</span>
        </div>
        <div style="font-family:'Rajdhani',sans-serif;font-size:0.7rem;color:rgba(255,255,255,0.25);letter-spacing:2px;margin-bottom:6px;">YOUR BALANCE</div>
        <div style="font-family:'Orbitron',sans-serif;font-size:1.5rem;color:#c5a059;font-weight:700;margin-bottom:32px;display:flex;align-items:center;gap:8px;">
            <i class="fas fa-coins" style="font-size:1rem;"></i> ${w.toLocaleString()}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            ${amounts.map(a => {
                const off = w < a;
                return `<button onclick="window._tributeDirectSend(${a})" ${off ? 'disabled' : ''} style="padding:22px 0;background:${off ? 'rgba(255,255,255,0.02)' : 'linear-gradient(135deg,rgba(197,160,89,0.08),rgba(197,160,89,0.02))'};border:1px solid ${off ? 'rgba(255,255,255,0.06)' : 'rgba(197,160,89,0.3)'};border-radius:12px;cursor:${off ? 'not-allowed' : 'pointer'};opacity:${off ? '0.25' : '1'};display:flex;flex-direction:column;align-items:center;gap:6px;">
                    <span style="font-family:'Orbitron',sans-serif;font-size:1.1rem;color:#fff;font-weight:700;">${a.toLocaleString()}</span>
                    <span style="font-family:'Rajdhani',sans-serif;font-size:0.55rem;color:rgba(197,160,89,0.5);letter-spacing:2px;">COINS</span>
                </button>`;
            }).join('')}
        </div>`;
}

async function _directSend(amount: number) {
    if (_busy) return;
    _busy = true;
    const el = _el();
    if (el) el.innerHTML = `<div style="flex:1;display:flex;align-items:center;justify-content:center;"><div style="font-family:'Orbitron',sans-serif;font-size:0.8rem;color:#c5a059;letter-spacing:3px;animation:pulse 1.5s infinite;">SENDING...</div></div>`;

    try {
        const res = await fetch('/api/tribute/direct', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memberEmail: _email(), type: 'direct', amount }),
        });
        const data = await res.json();
        if (!data.success) { _showSendResult(false, amount, 0, _wallet()); return; }

        // Update local state
        const s = getState();
        if (s?.raw) { s.raw.wallet = data.newWallet; setState(s); }
        const walletEl = document.getElementById('walletDisplay') || document.getElementById('mob_walletVal');
        if (walletEl) walletEl.textContent = data.newWallet.toLocaleString();

        _showSendResult(true, amount, data.meritGained, data.newWallet);
    } catch { _showSendResult(false, amount, 0, _wallet()); }
    finally { _busy = false; }
}

function _showSendResult(ok: boolean, amount: number, merit: number, newBal: number) {
    const el = _el(); if (!el) return;
    el.innerHTML = `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;">
            <div style="font-size:3rem;">${ok ? '\u2728' : '\u274C'}</div>
            <div style="font-family:'Cinzel',serif;font-size:1.1rem;color:${ok ? '#c5a059' : '#e03050'};letter-spacing:4px;">${ok ? 'TRIBUTE SENT' : 'FAILED'}</div>
            ${ok ? `
                <div style="font-family:'Orbitron',sans-serif;font-size:1.3rem;color:#fff;font-weight:700;">${amount.toLocaleString()} COINS</div>
                <div style="font-family:'Rajdhani',sans-serif;font-size:0.8rem;color:rgba(167,139,250,0.8);">+${merit.toLocaleString()} MERIT EARNED</div>
                <div style="font-family:'Rajdhani',sans-serif;font-size:0.75rem;color:rgba(255,255,255,0.3);margin-top:8px;">New balance: ${newBal.toLocaleString()}</div>
            ` : `<div style="font-family:'Rajdhani',sans-serif;font-size:0.8rem;color:rgba(255,255,255,0.4);">Insufficient funds or error</div>`}
            <button onclick="window.closeStandaloneTribute()" style="margin-top:20px;padding:14px 40px;background:linear-gradient(135deg,rgba(197,160,89,0.15),rgba(197,160,89,0.05));border:1px solid rgba(197,160,89,0.35);border-radius:10px;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:0.7rem;color:#c5a059;letter-spacing:2px;">CLOSE</button>
        </div>`;
}

// ─── RISKY SEND ────────────────────────────────────────────────────────────

function _showRisky() {
    const el = _el(); if (!el) return;
    const w = _wallet();
    _riskyPercent = 0;
    _riskyStake = 0;

    if (w < 10) {
        el.innerHTML = `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;">
            <div style="font-family:'Cinzel',serif;font-size:1rem;color:#e03050;letter-spacing:3px;">NOT ENOUGH COINS</div>
            <button onclick="window._tributeShowMenu()" style="padding:12px 30px;border:1px solid rgba(197,160,89,0.3);border-radius:8px;background:none;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:0.65rem;color:#c5a059;letter-spacing:2px;">BACK</button>
        </div>`;
        return;
    }

    const pcts = [10, 25, 50, 75, 100];
    el.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:28px;">
            <button onclick="window._tributeShowMenu()" style="color:rgba(220,50,80,0.5);background:transparent;border:1px solid rgba(220,50,80,0.2);border-radius:50%;width:36px;height:36px;cursor:pointer;font-size:0.9rem;display:flex;align-items:center;justify-content:center;">&#8592;</button>
            <span style="font-family:'Cinzel',serif;font-size:1rem;color:#e03050;letter-spacing:4px;">RISKY SEND</span>
        </div>
        <div style="font-family:'Rajdhani',sans-serif;font-size:0.7rem;color:rgba(255,255,255,0.25);letter-spacing:2px;margin-bottom:6px;">YOUR BALANCE</div>
        <div style="font-family:'Orbitron',sans-serif;font-size:1.5rem;color:#c5a059;font-weight:700;margin-bottom:10px;">${w.toLocaleString()}</div>
        <div style="font-family:'Rajdhani',sans-serif;font-size:0.8rem;color:rgba(255,255,255,0.4);letter-spacing:1px;margin-bottom:24px;">How much of your balance do you risk?</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-bottom:24px;">
            ${pcts.map(p => `<button id="riskyPct_${p}" onclick="window._tributePickPercent(${p})" style="width:62px;padding:14px 0;border:1px solid rgba(220,50,80,0.25);border-radius:10px;background:rgba(220,50,80,0.05);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;">
                <span style="font-family:'Orbitron',sans-serif;font-size:0.85rem;color:#e03050;font-weight:700;">${p}%</span>
            </button>`).join('')}
        </div>
        <div id="riskyStakeDisplay" style="text-align:center;margin-bottom:24px;min-height:50px;"></div>
        <div id="riskyConfirmWrap" style="display:none;text-align:center;">
            <button id="riskyConfirmBtn" onclick="window._tributeRiskyConfirm()" style="padding:16px 50px;background:linear-gradient(135deg,rgba(220,50,80,0.2),rgba(220,50,80,0.05));border:1px solid rgba(220,50,80,0.5);border-radius:12px;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:0.8rem;color:#e03050;letter-spacing:3px;font-weight:700;">GAMBLE</button>
        </div>`;
}

function _pickPercent(pct: number) {
    const w = _wallet();
    _riskyPercent = pct;
    _riskyStake = Math.floor(w * pct / 100);

    // Highlight selected
    [10, 25, 50, 75, 100].forEach(p => {
        const b = document.getElementById(`riskyPct_${p}`);
        if (b) {
            b.style.border = p === pct ? '1px solid #e03050' : '1px solid rgba(220,50,80,0.25)';
            b.style.background = p === pct ? 'rgba(220,50,80,0.15)' : 'rgba(220,50,80,0.05)';
        }
    });

    const display = document.getElementById('riskyStakeDisplay');
    if (display) display.innerHTML = `
        <div style="font-family:'Rajdhani',sans-serif;font-size:0.7rem;color:rgba(255,255,255,0.3);letter-spacing:2px;margin-bottom:4px;">YOU RISK</div>
        <div style="font-family:'Orbitron',sans-serif;font-size:1.6rem;color:#e03050;font-weight:700;">${_riskyStake.toLocaleString()} <span style="font-size:0.7rem;color:rgba(255,255,255,0.3);">COINS</span></div>
        ${_riskyStake < 2000 ? '<div style="font-family:\'Rajdhani\',sans-serif;font-size:0.65rem;color:rgba(197,160,89,0.5);margin-top:4px;">DOUBLE card active for bets under 2,000</div>' : ''}`;

    const wrap = document.getElementById('riskyConfirmWrap');
    if (wrap) wrap.style.display = 'block';
}

// ─── RISKY: CARD GAME ──────────────────────────────────────────────────────

function _riskyConfirm() {
    const el = _el(); if (!el) return;
    el.innerHTML = `
        <div style="text-align:center;margin-bottom:20px;">
            <div style="font-family:'Cinzel',serif;font-size:1.1rem;color:#e03050;letter-spacing:4px;margin-bottom:8px;">PICK YOUR FATE</div>
            <div style="font-family:'Rajdhani',sans-serif;font-size:0.75rem;color:rgba(255,255,255,0.3);">Stake: <span style="color:#e03050;font-weight:700;">${_riskyStake.toLocaleString()}</span> coins</div>
        </div>
        <div id="riskyCardGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;max-width:300px;margin:0 auto;">
            ${Array.from({ length: 9 }, (_, i) => `
                <button id="riskyCard_${i}" onclick="window._tributeRiskyPick(${i})" style="width:100%;aspect-ratio:1;background:linear-gradient(135deg,rgba(220,50,80,0.1),rgba(10,5,8,0.9));border:1px solid rgba(220,50,80,0.3);border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1.5rem;color:rgba(220,50,80,0.4);transition:all 0.2s;-webkit-tap-highlight-color:transparent;" onmouseenter="this.style.border='1px solid rgba(220,50,80,0.7)';this.style.background='rgba(220,50,80,0.15)'" onmouseleave="this.style.border='1px solid rgba(220,50,80,0.3)';this.style.background='linear-gradient(135deg,rgba(220,50,80,0.1),rgba(10,5,8,0.9))'">?</button>
            `).join('')}
        </div>
        <div style="text-align:center;margin-top:20px;">
            <div style="font-family:'Rajdhani',sans-serif;font-size:0.65rem;color:rgba(255,255,255,0.2);letter-spacing:1px;">TAP A CARD TO REVEAL YOUR FATE</div>
        </div>`;
}

async function _riskyPick(cardIndex: number) {
    if (_busy) return;
    _busy = true;

    // Disable all cards immediately
    for (let i = 0; i < 9; i++) {
        const c = document.getElementById(`riskyCard_${i}`);
        if (c) { c.style.pointerEvents = 'none'; }
    }

    // Highlight chosen card
    const chosen = document.getElementById(`riskyCard_${cardIndex}`);
    if (chosen) {
        chosen.style.border = '2px solid #e03050';
        chosen.style.boxShadow = '0 0 20px rgba(220,50,80,0.4)';
    }

    try {
        const res = await fetch('/api/tribute/direct', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memberEmail: _email(), type: 'risky', stakePercent: _riskyPercent, cardIndex }),
        });
        const data = await res.json();
        if (!data.success) {
            _showRiskyResult(null);
            return;
        }

        // Update local state
        const s = getState();
        if (s?.raw) { s.raw.wallet = data.newWallet; setState(s); }
        const walletEl = document.getElementById('walletDisplay') || document.getElementById('mob_walletVal');
        if (walletEl) walletEl.textContent = data.newWallet.toLocaleString();

        // Animate reveal: flip all cards except chosen first, then chosen last
        const order = Array.from({ length: 9 }, (_, i) => i).filter(i => i !== cardIndex);
        order.push(cardIndex);

        for (let step = 0; step < order.length; step++) {
            await _delay(250);
            const idx = order[step];
            const card = document.getElementById(`riskyCard_${idx}`);
            const info = data.allCards[idx];
            if (!card || !info) continue;

            const isChosen = idx === cardIndex;
            const lossText = info.lossPct === 0 ? '' : `${Math.round(info.lossPct * 100)}%`;
            const nameColor = info.name === 'DOUBLE' ? '#c5a059' : info.name === 'MERCY' ? '#4ade80' : info.lossPct <= 0.25 ? '#facc15' : info.lossPct <= 0.5 ? '#fb923c' : '#e03050';

            card.style.transition = 'all 0.4s ease';
            card.style.transform = 'rotateY(90deg)';

            await _delay(200);

            card.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
                    <span style="font-size:1.2rem;">${info.icon}</span>
                    <span style="font-family:'Orbitron',sans-serif;font-size:0.4rem;color:${nameColor};letter-spacing:1px;font-weight:700;">${info.name}</span>
                    ${lossText ? `<span style="font-family:'Orbitron',sans-serif;font-size:0.35rem;color:rgba(255,255,255,0.3);">-${lossText}</span>` : ''}
                </div>`;
            card.style.background = isChosen ? `linear-gradient(135deg,${nameColor}22,rgba(10,5,8,0.9))` : 'rgba(10,5,8,0.8)';
            card.style.border = isChosen ? `2px solid ${nameColor}` : '1px solid rgba(255,255,255,0.08)';
            card.style.boxShadow = isChosen ? `0 0 24px ${nameColor}44` : 'none';
            card.style.transform = 'rotateY(0deg)';
        }

        // Wait then show result
        await _delay(1200);
        _showRiskyResult(data);
    } catch {
        _showRiskyResult(null);
    } finally { _busy = false; }
}

function _showRiskyResult(data: any) {
    const el = _el(); if (!el) return;

    if (!data) {
        el.innerHTML = `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;">
            <div style="font-size:2rem;">\u274C</div>
            <div style="font-family:'Cinzel',serif;font-size:1rem;color:#e03050;letter-spacing:3px;">FAILED</div>
            <div style="font-family:'Rajdhani',sans-serif;font-size:0.8rem;color:rgba(255,255,255,0.4);">Something went wrong</div>
            <button onclick="window.closeStandaloneTribute()" style="margin-top:16px;padding:12px 36px;border:1px solid rgba(197,160,89,0.3);border-radius:10px;background:none;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:0.65rem;color:#c5a059;letter-spacing:2px;">CLOSE</button>
        </div>`;
        return;
    }

    const isWin = data.cardName === 'DOUBLE' && data.bonusAmount > 0;
    const isMercy = data.cardName === 'MERCY' || (data.cardName === 'DOUBLE' && data.bonusAmount === 0 && data.lossAmount === 0);
    const isLoss = data.lossAmount > 0;

    let titleColor = '#e03050';
    let bg = 'rgba(220,50,80,0.06)';
    let borderColor = 'rgba(220,50,80,0.3)';
    if (isWin) { titleColor = '#c5a059'; bg = 'rgba(197,160,89,0.06)'; borderColor = 'rgba(197,160,89,0.3)'; }
    else if (isMercy) { titleColor = '#4ade80'; bg = 'rgba(74,222,128,0.06)'; borderColor = 'rgba(74,222,128,0.3)'; }

    el.innerHTML = `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;">
            <div style="font-size:3.5rem;">${data.cardIcon}</div>
            <div style="font-family:'Cinzel',serif;font-size:1.3rem;color:${titleColor};letter-spacing:5px;font-weight:700;">${data.cardName}</div>
            <div style="width:200px;padding:16px;border-radius:14px;background:${bg};border:1px solid ${borderColor};text-align:center;margin:8px 0;">
                ${isWin ? `
                    <div style="font-family:'Rajdhani',sans-serif;font-size:0.7rem;color:rgba(255,255,255,0.3);letter-spacing:2px;margin-bottom:6px;">YOU WON</div>
                    <div style="font-family:'Orbitron',sans-serif;font-size:1.4rem;color:#c5a059;font-weight:700;">+${data.bonusAmount.toLocaleString()}</div>
                    <div style="font-family:'Rajdhani',sans-serif;font-size:0.6rem;color:rgba(197,160,89,0.5);letter-spacing:1px;">COINS</div>
                ` : isMercy ? `
                    <div style="font-family:'Rajdhani',sans-serif;font-size:0.7rem;color:rgba(255,255,255,0.3);letter-spacing:2px;margin-bottom:6px;">YOU LOST</div>
                    <div style="font-family:'Orbitron',sans-serif;font-size:1.4rem;color:#4ade80;font-weight:700;">NOTHING</div>
                    <div style="font-family:'Rajdhani',sans-serif;font-size:0.6rem;color:rgba(74,222,128,0.5);letter-spacing:1px;">QUEEN SHOWS MERCY</div>
                ` : `
                    <div style="font-family:'Rajdhani',sans-serif;font-size:0.7rem;color:rgba(255,255,255,0.3);letter-spacing:2px;margin-bottom:6px;">YOU LOST</div>
                    <div style="font-family:'Orbitron',sans-serif;font-size:1.4rem;color:#e03050;font-weight:700;">-${data.lossAmount.toLocaleString()}</div>
                    <div style="font-family:'Rajdhani',sans-serif;font-size:0.6rem;color:rgba(220,50,80,0.5);letter-spacing:1px;">COINS</div>
                `}
            </div>
            ${data.meritGained > 0 ? `<div style="font-family:'Rajdhani',sans-serif;font-size:0.75rem;color:rgba(167,139,250,0.7);">+${data.meritGained.toLocaleString()} MERIT EARNED</div>` : ''}
            <div style="font-family:'Rajdhani',sans-serif;font-size:0.7rem;color:rgba(255,255,255,0.25);margin-top:4px;">Balance: ${data.newWallet.toLocaleString()} coins</div>
            <button onclick="window.closeStandaloneTribute()" style="margin-top:16px;padding:14px 44px;background:linear-gradient(135deg,rgba(197,160,89,0.12),rgba(197,160,89,0.04));border:1px solid rgba(197,160,89,0.35);border-radius:10px;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:0.7rem;color:#c5a059;letter-spacing:2px;">CLOSE</button>
        </div>`;
}

// ─── WISHLIST (existing overlay) ───────────────────────────────────────────

function _showWishlist() {
    closeStandaloneTribute();
    // Open the existing tribute overlay from profile-logic
    if ((window as any).toggleTributeHunt) (window as any).toggleTributeHunt();
}

// ─── HELPERS ───────────────────────────────────────────────────────────────

function _delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── BIND TO WINDOW ────────────────────────────────────────────────────────

export function bindTributeGame() {
    (window as any).openStandaloneTribute = openStandaloneTribute;
    (window as any).closeStandaloneTribute = closeStandaloneTribute;
    (window as any)._tributeShowMenu = _showMenu;
    (window as any)._tributeShowSend = _showSend;
    (window as any)._tributeShowRisky = _showRisky;
    (window as any)._tributeShowWishlist = _showWishlist;
    (window as any)._tributeDirectSend = _directSend;
    (window as any)._tributePickPercent = _pickPercent;
    (window as any)._tributeRiskyConfirm = _riskyConfirm;
    (window as any)._tributeRiskyPick = _riskyPick;
}
