/**
 * Standalone inline risky send game.
 * Works on any page — no dependency on profile-state.ts.
 * Just call `bindInlineRisky(emailFn, walletFn, walletUpdateFn)` to set up.
 */

let _irPercent = 0;
let _irStake = 0;
let _irBusy = false;

let _getEmail: () => string = () => '';
let _getWallet: () => number = () => 0;
let _onWalletUpdate: (nw: number) => void = () => {};

function _irEl(): HTMLElement | null { return document.getElementById('inlineRiskyContent'); }

function _ensureOverlay(): HTMLElement {
    let ov = document.getElementById('inlineRiskyOverlay');
    if (!ov) {
        ov = document.createElement('div');
        ov.id = 'inlineRiskyOverlay';
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(2,5,18,0.97);backdrop-filter:blur(30px);-webkit-backdrop-filter:blur(30px);z-index:2147483641;display:none;flex-direction:column;';
        ov.innerHTML = '<div id="inlineRiskyContent" style="flex:1;overflow:hidden;"></div>';
        document.body.appendChild(ov);
    }
    return ov;
}

export function openInlineRisky() {
    const ov = _ensureOverlay();
    ov.style.display = 'flex';
    _irShowStake();
}

export function closeInlineRisky() {
    const ov = document.getElementById('inlineRiskyOverlay');
    if (ov) ov.style.display = 'none';
}

function _header(sub: string) {
    return `<div style="text-align:center;padding-top:24px;margin-bottom:8px;">
        <div style="font-family:'Cinzel',serif;font-size:1.3rem;color:#c5a059;letter-spacing:6px;font-weight:700;">TRIBUTE</div>
        <div style="width:40px;height:1px;background:linear-gradient(90deg,transparent,rgba(197,160,89,0.5),transparent);margin:8px auto;"></div>
        <div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(197,160,89,0.5);letter-spacing:3px;">${sub}</div>
    </div>`;
}

function _irShowStake() {
    const el = _irEl(); if (!el) return;
    const w = _getWallet();
    _irPercent = 0;
    _irStake = 0;

    if (w < 10) {
        el.innerHTML = `<div style="overflow-y:auto;scrollbar-width:none;height:100%;padding:0 20px;">
            ${_header('RISKY SEND')}
            <div style="display:flex;flex-direction:column;align-items:center;gap:16px;margin-top:40px;">
                <div style="font-family:'Cinzel',serif;font-size:1rem;color:rgba(197,160,89,0.6);letter-spacing:3px;">NOT ENOUGH COINS</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:30px;padding-bottom:40px;">
                <button onclick="window.closeInlineRisky()" style="padding:9px 28px;background:none;border:1px solid rgba(197,160,89,0.15);border-radius:20px;cursor:pointer;"><span style="font-family:'Orbitron',sans-serif;font-size:0.5rem;color:rgba(197,160,89,0.4);letter-spacing:2px;">CLOSE</span></button>
            </div>
        </div>`;
        return;
    }

    const pcts = [10, 25, 50, 75, 100];
    el.innerHTML = `<div style="overflow-y:auto;scrollbar-width:none;height:100%;padding:0 20px;">
        ${_header('RISKY SEND')}
        <div style="display:flex;flex-direction:column;align-items:center;margin-top:20px;">
            <div style="text-align:center;margin-bottom:16px;">
                <div style="font-family:'Rajdhani',sans-serif;font-size:0.65rem;color:rgba(255,255,255,0.25);letter-spacing:2px;margin-bottom:4px;">YOUR BALANCE</div>
                <div style="font-family:'Orbitron',sans-serif;font-size:1.6rem;color:#c5a059;font-weight:700;">${w.toLocaleString()}</div>
            </div>
            <div style="text-align:center;margin-bottom:20px;">
                <div style="font-family:'Rajdhani',sans-serif;font-size:0.85rem;color:rgba(255,255,255,0.4);letter-spacing:1px;">How much do you dare to risk?</div>
            </div>
            <div style="display:flex;gap:10px;justify-content:center;margin-bottom:24px;">
                ${pcts.map(p => `<button id="irPct_${p}" onclick="window._irPickPercent(${p})" style="width:58px;padding:14px 0;border:1px solid rgba(197,160,89,0.2);border-radius:10px;background:rgba(197,160,89,0.04);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;transition:all 0.2s;">
                    <span style="font-family:'Orbitron',sans-serif;font-size:0.85rem;color:#c5a059;font-weight:700;">${p}%</span>
                </button>`).join('')}
            </div>
            <div id="irStakeDisplay" style="text-align:center;margin-bottom:24px;min-height:50px;"></div>
            <div id="irConfirmWrap" style="display:none;text-align:center;">
                <style>
                    @keyframes irShake { 0%,100%{transform:translateX(0)} 10%{transform:translateX(-3px) rotate(-1deg)} 20%{transform:translateX(3px) rotate(1deg)} 30%{transform:translateX(-3px) rotate(-0.5deg)} 40%{transform:translateX(3px) rotate(0.5deg)} 50%{transform:translateX(-2px)} 60%{transform:translateX(2px)} 70%{transform:translateX(0)} }
                    @keyframes irGlow { 0%,100%{box-shadow:0 0 20px rgba(197,160,89,0.15),0 0 40px rgba(197,160,89,0.05)} 50%{box-shadow:0 0 30px rgba(197,160,89,0.3),0 0 60px rgba(197,160,89,0.1),inset 0 0 20px rgba(197,160,89,0.05)} }
                    @keyframes irShine { 0%{transform:translateX(-100%)} 50%{transform:translateX(100%)} 100%{transform:translateX(100%)} }
                </style>
                <button onclick="window._irConfirm()" style="padding:20px 60px;background:linear-gradient(160deg,#0a0a0a 0%,rgba(197,160,89,0.12) 40%,#0a0a0a 60%,rgba(197,160,89,0.08) 100%);border:1.5px solid rgba(197,160,89,0.6);border-radius:14px;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:0.9rem;color:#c5a059;letter-spacing:4px;font-weight:700;animation:irShake 2.5s ease-in-out infinite,irGlow 2s ease-in-out infinite;position:relative;overflow:hidden;text-shadow:0 0 12px rgba(197,160,89,0.4);">
                    <span style="position:relative;z-index:1;">GAMBLE</span>
                    <div style="position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(197,160,89,0.06),transparent);animation:irShine 3s ease-in-out infinite;"></div>
                </button>
            </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:20px;padding-bottom:40px;">
            <button onclick="window.closeInlineRisky()" style="padding:9px 28px;background:none;border:1px solid rgba(197,160,89,0.15);border-radius:20px;cursor:pointer;"><span style="font-family:'Orbitron',sans-serif;font-size:0.5rem;color:rgba(197,160,89,0.4);letter-spacing:2px;">CLOSE</span></button>
        </div>
    </div>`;
}

function _irPickPercent(pct: number) {
    const w = _getWallet();
    _irPercent = pct;
    _irStake = Math.floor(w * pct / 100);

    if (_irStake < 1000) {
        const display = document.getElementById('irStakeDisplay');
        if (display) display.innerHTML = `
            <div style="font-family:'Rajdhani',sans-serif;font-size:0.65rem;color:rgba(220,38,38,0.6);letter-spacing:2px;margin-bottom:4px;">MINIMUM 1,000 COINS</div>
            <div style="font-family:'Orbitron',sans-serif;font-size:1.5rem;color:rgba(197,160,89,0.3);font-weight:700;">${_irStake.toLocaleString()} <span style="font-size:0.65rem;color:rgba(197,160,89,0.3);">COINS</span></div>`;
        const wrap = document.getElementById('irConfirmWrap');
        if (wrap) wrap.style.display = 'none';
        _irPercent = 0;
        _irStake = 0;
        return;
    }

    [10, 25, 50, 75, 100].forEach(p => {
        const b = document.getElementById(`irPct_${p}`);
        if (b) {
            b.style.border = p === pct ? '1.5px solid #c5a059' : '1px solid rgba(197,160,89,0.2)';
            b.style.background = p === pct ? 'rgba(197,160,89,0.12)' : 'rgba(197,160,89,0.04)';
            b.style.boxShadow = p === pct ? '0 0 12px rgba(197,160,89,0.15)' : 'none';
        }
    });

    const display = document.getElementById('irStakeDisplay');
    if (display) display.innerHTML = `
        <div style="font-family:'Rajdhani',sans-serif;font-size:0.65rem;color:rgba(255,255,255,0.3);letter-spacing:2px;margin-bottom:4px;">YOU RISK</div>
        <div style="font-family:'Orbitron',sans-serif;font-size:1.5rem;color:#c5a059;font-weight:700;">${_irStake.toLocaleString()} <span style="font-size:0.65rem;color:rgba(197,160,89,0.5);">COINS</span></div>`;

    const wrap = document.getElementById('irConfirmWrap');
    if (wrap) wrap.style.display = 'block';
}

function _irConfirm() {
    const el = _irEl(); if (!el) return;
    el.innerHTML = `<div style="overflow-y:auto;scrollbar-width:none;height:100%;padding:0 20px;">
        ${_header('RISKY SEND')}
        <div style="display:flex;flex-direction:column;align-items:center;margin-top:16px;">
            <div style="text-align:center;margin-bottom:16px;">
                <div style="font-family:'Cinzel',serif;font-size:1.2rem;color:#c5a059;letter-spacing:5px;margin-bottom:8px;">PICK YOUR FATE</div>
                <div style="font-family:'Rajdhani',sans-serif;font-size:0.78rem;color:rgba(197,160,89,0.5);">Stake: <span style="color:#c5a059;font-weight:700;">${_irStake.toLocaleString()}</span> coins</div>
            </div>
            <div id="irCardGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;width:100%;max-width:340px;padding:0 10px;box-sizing:border-box;">
                ${Array.from({ length: 9 }, (_, i) => `
                    <button id="irCard_${i}" onclick="window._irPick(${i})" style="width:100%;aspect-ratio:0.72;background:linear-gradient(160deg,rgba(197,160,89,0.1),rgba(12,10,4,0.95),rgba(197,160,89,0.03));border:1px solid rgba(197,160,89,0.3);border-radius:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1.6rem;color:rgba(197,160,89,0.4);transition:all 0.25s;-webkit-tap-highlight-color:transparent;position:relative;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.4);">
                        <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 25%,rgba(197,160,89,0.08),transparent 65%);"></div>
                        <span style="position:relative;font-family:'Cinzel',serif;text-shadow:0 0 10px rgba(197,160,89,0.2);">?</span>
                    </button>
                `).join('')}
            </div>
            <div style="text-align:center;margin-top:16px;">
                <div style="font-family:'Rajdhani',sans-serif;font-size:0.65rem;color:rgba(197,160,89,0.35);letter-spacing:3px;">TAP A CARD TO REVEAL YOUR FATE</div>
            </div>
        </div>
    </div>`;
}

async function _irPick(cardIndex: number) {
    if (_irBusy) return;
    _irBusy = true;

    for (let i = 0; i < 9; i++) {
        const c = document.getElementById(`irCard_${i}`);
        if (c) c.style.pointerEvents = 'none';
    }

    const chosen = document.getElementById(`irCard_${cardIndex}`);
    if (chosen) {
        chosen.style.border = '1.5px solid #c5a059';
        chosen.style.boxShadow = '0 0 24px rgba(197,160,89,0.3)';
    }

    try {
        const res = await fetch('/api/tribute/direct', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memberEmail: _getEmail(), type: 'risky', stakePercent: _irPercent, cardIndex }),
        });
        const data = await res.json();
        if (!data.success) { _irShowResult(null); return; }

        _onWalletUpdate(data.newWallet);

        const order = Array.from({ length: 9 }, (_, i) => i).filter(i => i !== cardIndex);
        order.push(cardIndex);

        for (let step = 0; step < order.length; step++) {
            await new Promise(r => setTimeout(r, 250));
            const idx = order[step];
            const card = document.getElementById(`irCard_${idx}`);
            const info = data.allCards[idx];
            if (!card || !info) continue;

            const isChosen = idx === cardIndex;
            const nameColor = info.name === 'JACKPOT' ? '#c5a059' : info.name === 'MY LUCKY BITCH' ? '#4ade80' : info.lossPct <= 0.25 ? '#facc15' : info.lossPct <= 0.5 ? '#fb923c' : '#e03050';

            card.style.transition = 'all 0.4s ease';
            card.style.transform = 'rotateY(90deg)';

            await new Promise(r => setTimeout(r, 200));

            card.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;padding:4px;">
                <img src="${info.icon}" style="width:100%;height:auto;max-height:70%;object-fit:contain;">
                <span style="font-family:'Orbitron',sans-serif;font-size:0.3rem;color:${nameColor};letter-spacing:1px;font-weight:700;white-space:nowrap;">${info.name}</span>
            </div>`;
            card.style.background = isChosen ? `linear-gradient(160deg,${nameColor}20,rgba(12,10,4,0.95))` : 'rgba(12,10,4,0.85)';
            card.style.border = isChosen ? `2px solid ${nameColor}` : '1px solid rgba(255,255,255,0.06)';
            card.style.boxShadow = isChosen ? `0 0 28px ${nameColor}40` : 'none';
            card.style.transform = 'rotateY(0deg)';
        }

        await new Promise(r => setTimeout(r, 1200));
        _irShowResult(data);
    } catch {
        _irShowResult(null);
    } finally { _irBusy = false; }
}

const _lossQ = ["Your coins look better in my collection.", "Did you really think you'd win? How cute.", "The house always wins. I am the house.", "Better luck next time... or not.", "Your sacrifice pleases me."];
const _mercyQ = ["Consider yourself lucky. I was feeling generous.", "I'll let you keep your coins... this time.", "Don't mistake my mercy for weakness."];
const _winQ = ["Fine. Take your coins. You won't be this lucky twice.", "Enjoy it while it lasts. I always get what's mine.", "Lucky you. Now come back and try again."];

function _irShowResult(data: any) {
    const el = _irEl(); if (!el) return;

    if (!data) {
        el.innerHTML = `<div style="overflow-y:auto;scrollbar-width:none;height:100%;padding:0 20px;">
            ${_header('RISKY SEND')}
            <div style="display:flex;flex-direction:column;align-items:center;gap:16px;margin-top:40px;">
                <div style="font-size:2rem;">X</div>
                <div style="font-family:'Cinzel',serif;font-size:1rem;color:#e03050;letter-spacing:3px;">FAILED</div>
                <div style="font-family:'Rajdhani',sans-serif;font-size:0.8rem;color:rgba(255,255,255,0.4);">Something went wrong</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:30px;padding-bottom:40px;">
                <button onclick="window.closeInlineRisky()" style="padding:9px 28px;background:none;border:1px solid rgba(197,160,89,0.15);border-radius:20px;cursor:pointer;"><span style="font-family:'Orbitron',sans-serif;font-size:0.5rem;color:rgba(197,160,89,0.4);letter-spacing:2px;">CLOSE</span></button>
            </div>
        </div>`;
        return;
    }

    const isWin = data.cardName === 'JACKPOT' && data.bonusAmount > 0;
    const isMercy = data.cardName === 'MY LUCKY BITCH' || (data.cardName === 'JACKPOT' && data.bonusAmount === 0 && data.lossAmount === 0);
    const isLoss = !isWin && !isMercy;
    const quotes = isLoss ? _lossQ : isMercy ? _mercyQ : _winQ;
    const quote = quotes[Math.floor(Math.random() * quotes.length)];

    let titleColor = '#e03050', bg = 'rgba(220,50,80,0.04)', borderColor = 'rgba(220,50,80,0.25)', glowColor = 'rgba(220,50,80,0.08)', queenBorder = 'rgba(220,50,80,0.2)';
    if (isWin) { titleColor = '#c5a059'; bg = 'rgba(197,160,89,0.06)'; borderColor = 'rgba(197,160,89,0.35)'; glowColor = 'rgba(197,160,89,0.12)'; queenBorder = 'rgba(197,160,89,0.3)'; }
    else if (isMercy) { titleColor = '#4ade80'; bg = 'rgba(74,222,128,0.04)'; borderColor = 'rgba(74,222,128,0.25)'; glowColor = 'rgba(74,222,128,0.08)'; queenBorder = 'rgba(74,222,128,0.25)'; }

    el.innerHTML = `<div style="overflow-y:auto;scrollbar-width:none;height:100%;padding:0 20px;">
        ${_header('RISKY SEND')}
        <div style="display:flex;flex-direction:column;align-items:center;gap:12px;margin-top:20px;">
            <img src="${data.cardIcon}" style="width:120px;height:auto;">
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
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:20px;padding-bottom:40px;">
            <button onclick="window._irShowStake()" style="padding:12px 36px;background:linear-gradient(160deg,#0a0a0a,rgba(197,160,89,0.12),#0a0a0a);border:1.5px solid rgba(197,160,89,0.5);border-radius:20px;cursor:pointer;"><span style="font-family:'Orbitron',sans-serif;font-size:0.55rem;color:#c5a059;letter-spacing:3px;font-weight:700;">PLAY AGAIN</span></button>
            <button onclick="window.closeInlineRisky()" style="padding:9px 28px;background:none;border:1px solid rgba(197,160,89,0.15);border-radius:20px;cursor:pointer;"><span style="font-family:'Orbitron',sans-serif;font-size:0.5rem;color:rgba(197,160,89,0.4);letter-spacing:2px;">CLOSE</span></button>
        </div>
    </div>`;
}

export function bindInlineRisky(emailFn: () => string, walletFn: () => number, walletUpdateFn: (nw: number) => void) {
    _getEmail = emailFn;
    _getWallet = walletFn;
    _onWalletUpdate = walletUpdateFn;

    (window as any).openInlineRisky = openInlineRisky;
    (window as any).closeInlineRisky = closeInlineRisky;
    (window as any)._irPickPercent = _irPickPercent;
    (window as any)._irConfirm = _irConfirm;
    (window as any)._irPick = _irPick;
    (window as any)._irShowStake = _irShowStake;
}
