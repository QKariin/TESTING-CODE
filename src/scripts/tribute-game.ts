// src/scripts/tribute-game.ts
// Tribute menu + Direct Send + Risky Send card game for mobile profile

import { getState, setState } from '@/scripts/profile-state';

let _riskyPercent = 0;
let _riskyStake = 0;
let _busy = false;

function _el(): HTMLElement | null { return document.getElementById('mobTributeContent'); }
function _email(): string { const s = getState(); return s?.email || s?.memberId || ''; }
function _wallet(): number { return getState()?.wallet || 0; }

const _boostBtn = `<button onclick="window.closeStandaloneTribute();if(window.goToExchequer)window.goToExchequer();" style="padding:9px 24px;background:linear-gradient(135deg,rgba(197,160,89,0.12),rgba(197,160,89,0.04));border:1px solid rgba(197,160,89,0.3);border-radius:20px;cursor:pointer;-webkit-tap-highlight-color:transparent;"><span style="font-family:'Orbitron',sans-serif;font-size:0.5rem;color:#c5a059;letter-spacing:2px;">BOOST WALLET</span></button>`;

const _lossQuotes = [
    "Thank you for the donation, darling. I'll spend it better than you ever could.",
    "You really thought luck was on your side? How adorable.",
    "That's what happens when you gamble against a Queen.",
    "Your coins look so much better in my treasury.",
    "Did that hurt? Good. Now go earn more for me.",
    "I didn't even have to lift a finger. You ruined yourself.",
    "Another foolish bet. I love watching you lose.",
    "You should know by now - the house always wins. And I am the house.",
    "Honestly? I expected nothing less from you.",
    "Your loss is my gain. As it should be.",
    "Maybe next time you'll think twice. Or maybe you won't. I hope you won't.",
    "Aww, don't cry. You can always earn more... and lose it all over again.",
    "This is why I'm the Queen and you're the one gambling.",
    "I'll put your coins to much better use. Trust me on that.",
    "The audacity to gamble and then lose. Pathetic. I love it.",
];

const _mercyQuotes = [
    "Consider yourself lucky. I was feeling generous today.",
    "You escaped this time. Don't get used to it.",
    "Mercy is a rare gift from me. Remember that.",
    "I'll let you keep your coins... for now.",
    "Not today, little one. But next time? No promises.",
];

const _winQuotes = [
    "Fine. Take your coins. You won't be this lucky twice.",
    "Enjoy it while it lasts. I always get what's mine.",
    "A small victory for you. A minor inconvenience for me.",
    "Don't let it go to your head. You're still mine.",
    "Lucky you. Now come back and try again.",
];

function _randomQuote(arr: string[]) { return arr[Math.floor(Math.random() * arr.length)]; }

function _updateWallet(newWallet: number) {
    setState({ wallet: newWallet });
    const s = getState();
    if (s?.raw) s.raw.wallet = newWallet;
    ['coins', 'mobCoins', 'walletDisplay', 'mob_walletVal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = newWallet.toLocaleString();
    });
}

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
        <div style="display:flex;flex-direction:column;height:100%;min-height:100%;">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
                <div style="font-family:'Cinzel',serif;font-size:1.4rem;color:#c5a059;letter-spacing:6px;">TRIBUTE</div>
                <button onclick="window.closeStandaloneTribute()" style="color:rgba(197,160,89,0.5);background:transparent;border:1px solid rgba(197,160,89,0.15);border-radius:50%;width:36px;height:36px;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;">&#10005;</button>
            </div>
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;">
                <div style="font-family:'Rajdhani',sans-serif;font-size:0.75rem;color:rgba(255,255,255,0.3);letter-spacing:2px;">CHOOSE YOUR OFFERING</div>
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                    <i class="fas fa-coins" style="color:#c5a059;font-size:0.8rem;"></i>
                    <span style="font-family:'Orbitron',sans-serif;font-size:1.1rem;color:#c5a059;font-weight:700;">${_wallet().toLocaleString()}</span>
                </div>
                <button onclick="window._tributeShowSend()" style="width:300px;height:100px;background:rgba(197,160,89,0.03);border:1px solid rgba(197,160,89,0.3);padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent;border-radius:14px;overflow:hidden;display:block;box-shadow:0 4px 20px rgba(0,0,0,0.4);">
                    <img src="/tribute-send.svg" style="width:100%;height:100%;object-fit:contain;display:block;">
                </button>
                <button onclick="window._tributeShowRisky()" style="width:300px;height:100px;background:rgba(197,160,89,0.03);border:1px solid rgba(197,160,89,0.3);padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent;border-radius:14px;overflow:hidden;display:block;box-shadow:0 4px 20px rgba(0,0,0,0.4);">
                    <img src="/tribute-risky.svg" style="width:100%;height:100%;object-fit:contain;display:block;">
                </button>
                <button onclick="window._tributeShowWishlist()" style="width:300px;height:100px;background:rgba(197,160,89,0.03);border:1px solid rgba(197,160,89,0.3);padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent;border-radius:14px;overflow:hidden;display:block;box-shadow:0 4px 20px rgba(0,0,0,0.4);">
                    <img src="/tribute-wishlist.svg" style="width:100%;height:100%;object-fit:contain;display:block;">
                </button>
                ${_boostBtn}
            </div>
        </div>`;
}

// ─── DIRECT SEND ───────────────────────────────────────────────────────────

function _showSend() {
    const el = _el(); if (!el) return;
    const w = _wallet();
    const amounts = [500, 1000, 2000, 5000, 10000];
    el.innerHTML = `
        <div style="display:flex;flex-direction:column;height:100%;min-height:100%;">
            <div style="display:flex;align-items:center;gap:12px;flex-shrink:0;">
                <button onclick="window._tributeShowMenu()" style="color:rgba(197,160,89,0.5);background:transparent;border:1px solid rgba(197,160,89,0.15);border-radius:50%;width:36px;height:36px;cursor:pointer;font-size:0.9rem;display:flex;align-items:center;justify-content:center;">&#8592;</button>
                <span style="font-family:'Cinzel',serif;font-size:1rem;color:#c5a059;letter-spacing:4px;">SEND TRIBUTE</span>
            </div>
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;">
                <div style="text-align:center;margin-bottom:8px;">
                    <div style="font-family:'Rajdhani',sans-serif;font-size:0.7rem;color:rgba(255,255,255,0.25);letter-spacing:2px;margin-bottom:6px;">YOUR BALANCE</div>
                    <div style="font-family:'Orbitron',sans-serif;font-size:1.6rem;color:#c5a059;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;">
                        <i class="fas fa-coins" style="font-size:1rem;"></i> ${w.toLocaleString()}
                    </div>
                </div>
                <div style="width:100%;max-width:300px;margin-top:32px;">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                        ${amounts.map(a => {
                            const off = w < a;
                            return `<button onclick="window._tributeDirectSend(${a})" ${off ? 'disabled' : ''} style="padding:24px 0;background:${off ? 'rgba(255,255,255,0.02)' : 'linear-gradient(135deg,rgba(197,160,89,0.08),rgba(197,160,89,0.02))'};border:1px solid ${off ? 'rgba(255,255,255,0.06)' : 'rgba(197,160,89,0.3)'};border-radius:12px;cursor:${off ? 'not-allowed' : 'pointer'};opacity:${off ? '0.25' : '1'};display:flex;flex-direction:column;align-items:center;gap:6px;">
                                <span style="font-family:'Orbitron',sans-serif;font-size:1.1rem;color:#fff;font-weight:700;">${a.toLocaleString()}</span>
                                <span style="font-family:'Rajdhani',sans-serif;font-size:0.55rem;color:rgba(197,160,89,0.5);letter-spacing:2px;">COINS</span>
                            </button>`;
                        }).join('')}
                    </div>
                </div>
                <div style="margin-top:24px;">${_boostBtn}</div>
            </div>
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

        _updateWallet(data.newWallet);
        _showSendResult(true, amount, data.meritGained, data.newWallet);
    } catch { _showSendResult(false, amount, 0, _wallet()); }
    finally { _busy = false; }
}

function _showSendResult(ok: boolean, amount: number, merit: number, newBal: number) {
    const el = _el(); if (!el) return;
    el.innerHTML = `
        <div style="display:flex;flex-direction:column;height:100%;min-height:100%;">
            <div style="display:flex;align-items:center;gap:12px;flex-shrink:0;">
                <button onclick="window._tributeShowMenu()" style="color:rgba(197,160,89,0.5);background:transparent;border:1px solid rgba(197,160,89,0.15);border-radius:50%;width:36px;height:36px;cursor:pointer;font-size:0.9rem;display:flex;align-items:center;justify-content:center;">&#8592;</button>
            </div>
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;">
                <div style="font-size:3rem;">${ok ? '\u2728' : '\u274C'}</div>
                <div style="font-family:'Cinzel',serif;font-size:1.1rem;color:${ok ? '#c5a059' : '#e03050'};letter-spacing:4px;">${ok ? 'TRIBUTE SENT' : 'FAILED'}</div>
                ${ok ? `
                    <div style="font-family:'Orbitron',sans-serif;font-size:1.3rem;color:#fff;font-weight:700;">${amount.toLocaleString()} COINS</div>
                    <div style="font-family:'Rajdhani',sans-serif;font-size:0.8rem;color:rgba(167,139,250,0.8);">+${merit.toLocaleString()} MERIT EARNED</div>
                    <div style="font-family:'Rajdhani',sans-serif;font-size:0.75rem;color:rgba(255,255,255,0.3);margin-top:8px;">New balance: ${newBal.toLocaleString()}</div>
                ` : `<div style="font-family:'Rajdhani',sans-serif;font-size:0.8rem;color:rgba(255,255,255,0.4);">Insufficient funds or error</div>`}
                <div style="display:flex;gap:12px;margin-top:16px;">
                    <button onclick="window.closeStandaloneTribute()" style="padding:14px 36px;background:linear-gradient(135deg,rgba(197,160,89,0.15),rgba(197,160,89,0.05));border:1px solid rgba(197,160,89,0.35);border-radius:10px;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:0.7rem;color:#c5a059;letter-spacing:2px;">CLOSE</button>
                </div>
                <div style="margin-top:8px;">${_boostBtn}</div>
            </div>
        </div>`;
}

// ─── RISKY SEND ────────────────────────────────────────────────────────────

function _showRisky() {
    const el = _el(); if (!el) return;
    const w = _wallet();
    _riskyPercent = 0;
    _riskyStake = 0;

    if (w < 10) {
        el.innerHTML = `<div style="display:flex;flex-direction:column;height:100%;min-height:100%;">
            <div style="display:flex;align-items:center;gap:12px;flex-shrink:0;">
                <button onclick="window._tributeShowMenu()" style="color:rgba(197,160,89,0.5);background:transparent;border:1px solid rgba(197,160,89,0.15);border-radius:50%;width:36px;height:36px;cursor:pointer;font-size:0.9rem;display:flex;align-items:center;justify-content:center;">&#8592;</button>
            </div>
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;">
                <div style="font-family:'Cinzel',serif;font-size:1rem;color:rgba(197,160,89,0.6);letter-spacing:3px;">NOT ENOUGH COINS</div>
                <div style="display:flex;gap:12px;">
                    <button onclick="window._tributeShowMenu()" style="padding:12px 30px;border:1px solid rgba(197,160,89,0.3);border-radius:8px;background:none;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:0.65rem;color:#c5a059;letter-spacing:2px;">BACK</button>
                </div>
                <div style="margin-top:8px;">${_boostBtn}</div>
            </div>
        </div>`;
        return;
    }

    const pcts = [10, 25, 50, 75, 100];
    el.innerHTML = `
        <div style="display:flex;flex-direction:column;height:100%;min-height:100%;">
            <div style="display:flex;align-items:center;gap:12px;flex-shrink:0;">
                <button onclick="window._tributeShowMenu()" style="color:rgba(197,160,89,0.5);background:transparent;border:1px solid rgba(197,160,89,0.15);border-radius:50%;width:36px;height:36px;cursor:pointer;font-size:0.9rem;display:flex;align-items:center;justify-content:center;">&#8592;</button>
                <span style="font-family:'Cinzel',serif;font-size:1rem;color:#c5a059;letter-spacing:4px;">RISKY SEND</span>
            </div>
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;">
                <div style="text-align:center;margin-bottom:20px;">
                    <div style="font-family:'Rajdhani',sans-serif;font-size:0.65rem;color:rgba(255,255,255,0.25);letter-spacing:2px;margin-bottom:4px;">YOUR BALANCE</div>
                    <div style="font-family:'Orbitron',sans-serif;font-size:1.6rem;color:#c5a059;font-weight:700;">${w.toLocaleString()}</div>
                </div>
                <div style="text-align:center;margin-bottom:24px;">
                    <div style="font-family:'Rajdhani',sans-serif;font-size:0.85rem;color:rgba(255,255,255,0.4);letter-spacing:1px;">How much do you dare to risk?</div>
                </div>
                <div style="display:flex;gap:10px;justify-content:center;margin-bottom:28px;">
                    ${pcts.map(p => `<button id="riskyPct_${p}" onclick="window._tributePickPercent(${p})" style="width:58px;padding:14px 0;border:1px solid rgba(197,160,89,0.2);border-radius:10px;background:rgba(197,160,89,0.04);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;transition:all 0.2s;">
                        <span style="font-family:'Orbitron',sans-serif;font-size:0.85rem;color:#c5a059;font-weight:700;">${p}%</span>
                    </button>`).join('')}
                </div>
                <div id="riskyStakeDisplay" style="text-align:center;margin-bottom:24px;min-height:50px;"></div>
                <div id="riskyConfirmWrap" style="display:none;text-align:center;">
                    <button id="riskyConfirmBtn" onclick="window._tributeRiskyConfirm()" style="padding:18px 56px;background:linear-gradient(135deg,rgba(197,160,89,0.18),rgba(197,160,89,0.06));border:1px solid rgba(197,160,89,0.5);border-radius:12px;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:0.85rem;color:#c5a059;letter-spacing:3px;font-weight:700;box-shadow:0 0 20px rgba(197,160,89,0.1);">GAMBLE</button>
                </div>
                <div style="margin-top:16px;">${_boostBtn}</div>
            </div>
        </div>`;
}

function _pickPercent(pct: number) {
    const w = _wallet();
    _riskyPercent = pct;
    _riskyStake = Math.floor(w * pct / 100);

    [10, 25, 50, 75, 100].forEach(p => {
        const b = document.getElementById(`riskyPct_${p}`);
        if (b) {
            b.style.border = p === pct ? '1.5px solid #c5a059' : '1px solid rgba(197,160,89,0.2)';
            b.style.background = p === pct ? 'rgba(197,160,89,0.12)' : 'rgba(197,160,89,0.04)';
            b.style.boxShadow = p === pct ? '0 0 12px rgba(197,160,89,0.15)' : 'none';
        }
    });

    const display = document.getElementById('riskyStakeDisplay');
    if (display) display.innerHTML = `
        <div style="font-family:'Rajdhani',sans-serif;font-size:0.65rem;color:rgba(255,255,255,0.3);letter-spacing:2px;margin-bottom:4px;">YOU RISK</div>
        <div style="font-family:'Orbitron',sans-serif;font-size:1.5rem;color:#c5a059;font-weight:700;">${_riskyStake.toLocaleString()} <span style="font-size:0.65rem;color:rgba(197,160,89,0.5);">COINS</span></div>`;

    const wrap = document.getElementById('riskyConfirmWrap');
    if (wrap) wrap.style.display = 'block';
}

// ─── RISKY: CARD GAME ──────────────────────────────────────────────────────

function _riskyConfirm() {
    const el = _el(); if (!el) return;
    el.innerHTML = `
        <div style="display:flex;flex-direction:column;height:100%;min-height:100%;">
            <div style="display:flex;align-items:center;gap:12px;flex-shrink:0;">
                <button onclick="window._tributeShowRisky()" style="color:rgba(197,160,89,0.5);background:transparent;border:1px solid rgba(197,160,89,0.15);border-radius:50%;width:36px;height:36px;cursor:pointer;font-size:0.9rem;display:flex;align-items:center;justify-content:center;">&#8592;</button>
            </div>
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;">
                <div style="text-align:center;margin-bottom:28px;">
                    <div style="font-family:'Cinzel',serif;font-size:1.5rem;color:#c5a059;letter-spacing:6px;margin-bottom:10px;">PICK YOUR FATE</div>
                    <div style="font-family:'Rajdhani',sans-serif;font-size:0.78rem;color:rgba(197,160,89,0.5);">Stake: <span style="color:#c5a059;font-weight:700;">${_riskyStake.toLocaleString()}</span> coins</div>
                </div>
                <div id="riskyCardGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;width:100%;max-width:340px;padding:0 10px;box-sizing:border-box;">
                    ${Array.from({ length: 9 }, (_, i) => `
                        <button id="riskyCard_${i}" onclick="window._tributeRiskyPick(${i})" style="width:100%;aspect-ratio:0.72;background:linear-gradient(160deg,rgba(197,160,89,0.1),rgba(12,10,4,0.95),rgba(197,160,89,0.03));border:1px solid rgba(197,160,89,0.3);border-radius:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1.6rem;color:rgba(197,160,89,0.4);transition:all 0.25s;-webkit-tap-highlight-color:transparent;position:relative;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.4);">
                            <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 25%,rgba(197,160,89,0.08),transparent 65%);"></div>
                            <span style="position:relative;font-family:'Cinzel',serif;text-shadow:0 0 10px rgba(197,160,89,0.2);">?</span>
                        </button>
                    `).join('')}
                </div>
                <div style="text-align:center;margin-top:28px;">
                    <div style="font-family:'Rajdhani',sans-serif;font-size:0.65rem;color:rgba(197,160,89,0.35);letter-spacing:3px;">TAP A CARD TO REVEAL YOUR FATE</div>
                </div>
            </div>
        </div>`;
}

async function _riskyPick(cardIndex: number) {
    if (_busy) return;
    _busy = true;

    for (let i = 0; i < 9; i++) {
        const c = document.getElementById(`riskyCard_${i}`);
        if (c) { c.style.pointerEvents = 'none'; }
    }

    const chosen = document.getElementById(`riskyCard_${cardIndex}`);
    if (chosen) {
        chosen.style.border = '1.5px solid #c5a059';
        chosen.style.boxShadow = '0 0 24px rgba(197,160,89,0.3)';
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

        _updateWallet(data.newWallet);

        const order = Array.from({ length: 9 }, (_, i) => i).filter(i => i !== cardIndex);
        order.push(cardIndex);

        for (let step = 0; step < order.length; step++) {
            await _delay(250);
            const idx = order[step];
            const card = document.getElementById(`riskyCard_${idx}`);
            const info = data.allCards[idx];
            if (!card || !info) continue;

            const isChosen = idx === cardIndex;
            const nameColor = info.name === 'DOUBLE' ? '#c5a059' : info.name === 'MERCY' ? '#4ade80' : info.lossPct <= 0.25 ? '#facc15' : info.lossPct <= 0.5 ? '#fb923c' : '#e03050';

            card.style.transition = 'all 0.4s ease';
            card.style.transform = 'rotateY(90deg)';

            await _delay(200);

            card.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
                    <span style="font-size:1.3rem;">${info.icon}</span>
                    <span style="font-family:'Orbitron',sans-serif;font-size:0.38rem;color:${nameColor};letter-spacing:1px;font-weight:700;">${info.name}</span>
                </div>`;
            card.style.background = isChosen ? `linear-gradient(160deg,${nameColor}20,rgba(12,10,4,0.95))` : 'rgba(12,10,4,0.85)';
            card.style.border = isChosen ? `2px solid ${nameColor}` : '1px solid rgba(255,255,255,0.06)';
            card.style.boxShadow = isChosen ? `0 0 28px ${nameColor}40` : 'none';
            card.style.transform = 'rotateY(0deg)';
        }

        await _delay(1200);
        _showRiskyResult(data);
    } catch {
        _showRiskyResult(null);
    } finally { _busy = false; }
}

function _showRiskyResult(data: any) {
    const el = _el(); if (!el) return;

    if (!data) {
        el.innerHTML = `<div style="display:flex;flex-direction:column;height:100%;min-height:100%;">
            <div style="display:flex;align-items:center;gap:12px;flex-shrink:0;">
                <button onclick="window._tributeShowMenu()" style="color:rgba(197,160,89,0.5);background:transparent;border:1px solid rgba(197,160,89,0.15);border-radius:50%;width:36px;height:36px;cursor:pointer;font-size:0.9rem;display:flex;align-items:center;justify-content:center;">&#8592;</button>
            </div>
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;">
                <div style="font-size:2rem;">\u274C</div>
                <div style="font-family:'Cinzel',serif;font-size:1rem;color:#e03050;letter-spacing:3px;">FAILED</div>
                <div style="font-family:'Rajdhani',sans-serif;font-size:0.8rem;color:rgba(255,255,255,0.4);">Something went wrong</div>
                <button onclick="window.closeStandaloneTribute()" style="margin-top:16px;padding:12px 36px;border:1px solid rgba(197,160,89,0.3);border-radius:10px;background:none;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:0.65rem;color:#c5a059;letter-spacing:2px;">CLOSE</button>
                <div style="margin-top:8px;">${_boostBtn}</div>
            </div>
        </div>`;
        return;
    }

    const isWin = data.cardName === 'DOUBLE' && data.bonusAmount > 0;
    const isMercy = data.cardName === 'MERCY' || (data.cardName === 'DOUBLE' && data.bonusAmount === 0 && data.lossAmount === 0);
    const isLoss = !isWin && !isMercy;

    const quote = isLoss ? _randomQuote(_lossQuotes) : isMercy ? _randomQuote(_mercyQuotes) : _randomQuote(_winQuotes);

    let titleColor = '#e03050';
    let bg = 'rgba(220,50,80,0.04)';
    let borderColor = 'rgba(220,50,80,0.25)';
    let glowColor = 'rgba(220,50,80,0.08)';
    let queenBorder = 'rgba(220,50,80,0.2)';
    if (isWin) { titleColor = '#c5a059'; bg = 'rgba(197,160,89,0.06)'; borderColor = 'rgba(197,160,89,0.35)'; glowColor = 'rgba(197,160,89,0.12)'; queenBorder = 'rgba(197,160,89,0.3)'; }
    else if (isMercy) { titleColor = '#4ade80'; bg = 'rgba(74,222,128,0.04)'; borderColor = 'rgba(74,222,128,0.25)'; glowColor = 'rgba(74,222,128,0.08)'; queenBorder = 'rgba(74,222,128,0.25)'; }

    el.innerHTML = `
        <div style="display:flex;flex-direction:column;height:100%;min-height:100%;">
            <div style="display:flex;align-items:center;gap:12px;flex-shrink:0;">
                <button onclick="window._tributeShowMenu()" style="color:rgba(197,160,89,0.5);background:transparent;border:1px solid rgba(197,160,89,0.15);border-radius:50%;width:36px;height:36px;cursor:pointer;font-size:0.9rem;display:flex;align-items:center;justify-content:center;">&#8592;</button>
            </div>
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;">
                <div style="font-size:3.5rem;">${data.cardIcon}</div>
                <div style="font-family:'Cinzel',serif;font-size:1.4rem;color:${titleColor};letter-spacing:5px;font-weight:700;">${data.cardName}</div>
                <div style="width:260px;padding:22px;border-radius:16px;background:${bg};border:1px solid ${borderColor};text-align:center;margin:6px 0;box-shadow:0 0 30px ${glowColor};">
                    ${isWin ? `
                        <div style="font-family:'Rajdhani',sans-serif;font-size:0.7rem;color:rgba(255,255,255,0.3);letter-spacing:2px;margin-bottom:6px;">YOU WON</div>
                        <div style="font-family:'Orbitron',sans-serif;font-size:1.5rem;color:#c5a059;font-weight:700;">+${data.bonusAmount.toLocaleString()}</div>
                        <div style="font-family:'Rajdhani',sans-serif;font-size:0.6rem;color:rgba(197,160,89,0.5);letter-spacing:1px;">COINS</div>
                    ` : isMercy ? `
                        <div style="font-family:'Rajdhani',sans-serif;font-size:0.7rem;color:rgba(255,255,255,0.3);letter-spacing:2px;margin-bottom:6px;">YOU LOST</div>
                        <div style="font-family:'Orbitron',sans-serif;font-size:1.5rem;color:#4ade80;font-weight:700;">NOTHING</div>
                        <div style="font-family:'Rajdhani',sans-serif;font-size:0.6rem;color:rgba(74,222,128,0.5);letter-spacing:1px;">QUEEN SHOWS MERCY</div>
                    ` : `
                        <div style="font-family:'Rajdhani',sans-serif;font-size:0.7rem;color:rgba(255,255,255,0.3);letter-spacing:2px;margin-bottom:6px;">YOU LOST</div>
                        <div style="font-family:'Orbitron',sans-serif;font-size:1.5rem;color:#e03050;font-weight:700;">-${data.lossAmount.toLocaleString()}</div>
                        <div style="font-family:'Rajdhani',sans-serif;font-size:0.6rem;color:rgba(220,50,80,0.5);letter-spacing:1px;">COINS</div>
                    `}
                </div>
                <div style="width:280px;padding:16px 20px;border-radius:14px;border:1px solid ${queenBorder};background:rgba(0,0,0,0.3);display:flex;gap:12px;align-items:flex-start;">
                    <img src="/queen-nav.png" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:1.5px solid rgba(197,160,89,0.5);flex-shrink:0;">
                    <div>
                        <div style="font-family:'Cinzel',serif;font-size:0.55rem;color:#c5a059;letter-spacing:2px;margin-bottom:4px;">QUEEN KARIN</div>
                        <div style="font-family:'Rajdhani',sans-serif;font-size:0.82rem;color:rgba(255,255,255,0.6);line-height:1.4;font-style:italic;">"${quote}"</div>
                    </div>
                </div>
                ${data.meritGained > 0 ? `<div style="font-family:'Rajdhani',sans-serif;font-size:0.72rem;color:rgba(167,139,250,0.7);">+${data.meritGained.toLocaleString()} MERIT EARNED</div>` : ''}
                <div style="font-family:'Rajdhani',sans-serif;font-size:0.68rem;color:rgba(255,255,255,0.25);">Balance: ${data.newWallet.toLocaleString()} coins</div>
                <button onclick="window.closeStandaloneTribute()" style="margin-top:8px;padding:14px 44px;background:linear-gradient(135deg,rgba(197,160,89,0.12),rgba(197,160,89,0.04));border:1px solid rgba(197,160,89,0.35);border-radius:10px;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:0.7rem;color:#c5a059;letter-spacing:2px;">CLOSE</button>
                <div style="margin-top:4px;">${_boostBtn}</div>
            </div>
        </div>`;
}

// ─── WISHLIST (existing overlay) ───────────────────────────────────────────

function _showWishlist() {
    closeStandaloneTribute();
    setTimeout(() => {
        if ((window as any).toggleTributeHuntGlobal) (window as any).toggleTributeHuntGlobal();
    }, 50);
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
