'use client';

import { useState, useRef, useEffect } from 'react';

const CRYPTO_OPTIONS = [
    { id: 70, label: 'USDT', sub: 'TRC20 · Stablecoin', color: '#26a17b', icon: '₮', ticker: 'USDT' },
    { id: 10, label: 'BITCOIN', sub: 'BTC · ~10 min', color: '#f7931a', icon: '₿', ticker: 'BTC' },
    { id: 20, label: 'ETHEREUM', sub: 'ETH · ~2 min', color: '#627eea', icon: 'Ξ', ticker: 'ETH' },
    { id: 60, label: 'LITECOIN', sub: 'LTC · ~2 min', color: '#bfbbbb', icon: 'Ł', ticker: 'LTC' },
];

const TICKER_COLORS: Record<string, string> = {
    USDT: '#26a17b', BTC: '#f7931a', ETH: '#627eea', LTC: '#bfbbbb',
};

type Screen = 'method' | 'crypto-picker' | 'loading' | 'qr';

interface PaymentModalProps {
    amountEur: number;
    label: string;
    cardBody: Record<string, any>;
    cryptoApiPath: string;
    cryptoStatusApiPath: string;
    cryptoPayBody: Record<string, any>;
    cryptoStatusBody?: Record<string, any>;
    confirmMessage?: string;
    onSuccess?: () => void;
    onClose: () => void;
}

export default function PaymentModal({
    amountEur,
    label,
    cardBody,
    cryptoApiPath,
    cryptoStatusApiPath,
    cryptoPayBody,
    cryptoStatusBody,
    confirmMessage = '✓ PAYMENT CONFIRMED',
    onSuccess,
    onClose,
}: PaymentModalProps) {
    const [screen, setScreen] = useState<Screen>('method');
    const [cardLoading, setCardLoading] = useState(false);
    const [cardError, setCardError] = useState('');
    const [cryptoError, setCryptoError] = useState('');
    const [cryptoData, setCryptoData] = useState<any>(null);
    const [confirmed, setConfirmed] = useState(false);
    const [copied, setCopied] = useState(false);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, []);

    const copyAddress = () => {
        const addr = cryptoData?.address || '';
        if (!addr) return;
        const fallback = () => {
            const ta = document.createElement('textarea');
            ta.value = addr;
            ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;width:1px;height:1px';
            document.body.appendChild(ta); ta.focus(); ta.select();
            try { document.execCommand('copy'); } catch {}
            document.body.removeChild(ta);
            setCopied(true); setTimeout(() => setCopied(false), 2000);
        };
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(addr).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(fallback);
        } else { fallback(); }
    };

    const handleCard = async () => {
        setCardLoading(true);
        setCardError('');
        try {
            const res = await fetch('/api/paywall/wix-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cardBody),
            });
            const data = await res.json();
            if (data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
            } else {
                setCardError('Could not start checkout. Try crypto instead.');
                setCardLoading(false);
            }
        } catch {
            setCardError('Network error. Try crypto instead.');
            setCardLoading(false);
        }
    };

    const handleCryptoPick = async (currencyId: number, ticker: string) => {
        setScreen('loading');
        setCryptoError('');
        try {
            const res = await fetch(cryptoApiPath, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...cryptoPayBody, currencyId }),
            });
            const data = await res.json();
            if (!data.success) {
                setCryptoError(data.error || 'Payment setup failed. Try again.');
                setScreen('crypto-picker');
                return;
            }
            setCryptoData({ ...data, currency: ticker });
            setScreen('qr');

            if (pollRef.current) clearInterval(pollRef.current);
            let polls = 0;
            pollRef.current = setInterval(async () => {
                polls++;
                if (polls > 120) { if (pollRef.current) clearInterval(pollRef.current); return; }
                try {
                    const r = await fetch(cryptoStatusApiPath, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...cryptoStatusBody, orderId: data.orderId }),
                    });
                    const d = await r.json();
                    if (d.paid) {
                        if (pollRef.current) clearInterval(pollRef.current);
                        setConfirmed(true);
                        setTimeout(() => onSuccess?.(), 2500);
                    }
                } catch {}
            }, 5000);
        } catch (e: any) {
            setCryptoError(e.message || 'Network error. Try again.');
            setScreen('crypto-picker');
        }
    };

    const tickerColor = TICKER_COLORS[cryptoData?.currency] || '#bfbbbb';
    const BASE: React.CSSProperties = { position: 'fixed', inset: 0, background: '#030308', zIndex: 99999999 };

    /* ── LOADING ── */
    if (screen === 'loading') return (
        <div style={{ ...BASE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <style>{`@keyframes _pmSpin{to{transform:rotate(360deg)}}`}</style>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
                <div style={{ width: 40, height: 40, border: '2px solid rgba(197,160,89,0.15)', borderTopColor: 'rgba(197,160,89,0.6)', borderRadius: '50%', animation: '_pmSpin 0.8s linear infinite' }} />
                <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', letterSpacing: 4 }}>PREPARING PAYMENT...</div>
            </div>
        </div>
    );

    /* ── QR OVERLAY ── */
    if (screen === 'qr' && cryptoData) return (
        <div style={{ ...BASE, display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto', padding: '36px 28px 60px' }}>
            <style>{`@keyframes _pmPulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>

            {/* AMOUNT — first, biggest, unmissable */}
            <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', letterSpacing: 6, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>SEND EXACTLY</div>
            <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: 'clamp(2.8rem,9vw,4rem)', color: '#fff', fontWeight: 900, lineHeight: 1, marginBottom: 6, textAlign: 'center' }}>{cryptoData.cryptoAmount}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '1.1rem', color: tickerColor, letterSpacing: 4, fontWeight: 700 }}>{cryptoData.currency}</span>
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '1rem' }}>·</span>
                <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '1.1rem', color: '#c5a059', fontWeight: 600 }}>€{Number(cryptoData.amountEur).toFixed(2)}</span>
            </div>
            <div style={{ height: 1, width: 60, background: 'rgba(255,255,255,0.08)', margin: '16px 0 24px' }} />

            {/* QR — after the amount */}
            <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(cryptoData.address)}`}
                alt="QR"
                style={{ width: 240, height: 240, background: '#fff', borderRadius: 14, padding: 10, display: 'block', marginBottom: 28, flexShrink: 0 }}
            />
            <div style={{ width: '100%', maxWidth: 400 }}>
                <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)', letterSpacing: 4, textAlign: 'center', marginBottom: 10 }}>WALLET ADDRESS</div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px 16px', wordBreak: 'break-all', textAlign: 'center', lineHeight: 1.7 }}>{cryptoData.address}</div>
                <button onClick={copyAddress} style={{ width: '100%', marginTop: 10, padding: '16px', background: copied ? 'rgba(76,175,80,0.08)' : 'rgba(197,160,89,0.07)', border: `1px solid ${copied ? 'rgba(76,175,80,0.35)' : 'rgba(197,160,89,0.25)'}`, borderRadius: 10, color: copied ? '#66bb6a' : '#c5a059', fontFamily: 'Orbitron,sans-serif', fontSize: '0.6rem', fontWeight: 700, letterSpacing: 4, cursor: 'pointer' }}>
                    {copied ? '✓ COPIED' : 'COPY ADDRESS'}
                </button>
            </div>
            {confirmed ? (
                <div style={{ marginTop: 32, fontFamily: 'Rajdhani,sans-serif', fontSize: '1rem', color: '#66bb6a', letterSpacing: 3, fontWeight: 700 }}>{confirmMessage}</div>
            ) : (
                <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#c5a059', display: 'inline-block', flexShrink: 0, animation: '_pmPulse 1.5s infinite' }} />
                    <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', letterSpacing: 3, fontWeight: 600 }}>WAITING FOR PAYMENT</span>
                </div>
            )}
            <div style={{ marginTop: 10, fontFamily: 'Rajdhani,sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', textAlign: 'center', maxWidth: 300, lineHeight: 1.7 }}>Send the exact amount. Confirms automatically.</div>
            <button onClick={() => { setCryptoData(null); if (pollRef.current) clearInterval(pollRef.current); setScreen('method'); }}
                style={{ marginTop: 24, width: '100%', maxWidth: 400, padding: '16px', background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: 'rgba(255,255,255,0.55)', fontFamily: 'Rajdhani,sans-serif', fontSize: '0.75rem', letterSpacing: 4, cursor: 'pointer' }}>CANCEL</button>
        </div>
    );

    /* ── CRYPTO PICKER ── */
    if (screen === 'crypto-picker') return (
        <div style={{ ...BASE, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 28px' }}>
            <div style={{ width: '100%', maxWidth: 420 }}>
                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '1.2rem', color: '#fff', fontWeight: 700, letterSpacing: 2, textAlign: 'center', marginBottom: 8 }}>SELECT CURRENCY</div>
                <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.6rem', color: 'rgba(197,160,89,0.5)', letterSpacing: 5, textAlign: 'center', marginBottom: 32 }}>{label}</div>
                {cryptoError && <div style={{ fontSize: '0.65rem', color: 'rgba(255,80,80,0.8)', fontFamily: 'Rajdhani,sans-serif', textAlign: 'center', marginBottom: 16, letterSpacing: 1 }}>{cryptoError}</div>}
                {CRYPTO_OPTIONS.map((opt, i) => (
                    <button key={opt.id} onClick={() => handleCryptoPick(opt.id, opt.ticker)}
                        style={{ width: '100%', padding: '20px 0', background: 'none', border: 'none', borderTop: i === 0 ? '1px solid rgba(255,255,255,0.07)' : 'none', borderBottom: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 18, textAlign: 'left' }}>
                        <div style={{ width: 42, height: 42, borderRadius: '50%', background: `${opt.color}14`, border: `1px solid ${opt.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: '1.2rem', color: opt.color, fontFamily: 'Orbitron,sans-serif', fontWeight: 700 }}>{opt.icon}</span>
                        </div>
                        <div style={{ flex: 1, textAlign: 'left' }}>
                            <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.65rem', color: '#fff', letterSpacing: 3, fontWeight: 600 }}>{opt.label}</div>
                            <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.65rem', color: 'rgba(255,255,255,0.28)', letterSpacing: 1, marginTop: 2 }}>{opt.sub}</div>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.4)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                ))}
                <button onClick={() => setScreen('method')} style={{ width: '100%', padding: '16px', marginTop: 24, background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: 'rgba(255,255,255,0.55)', fontFamily: 'Rajdhani,sans-serif', fontSize: '0.75rem', letterSpacing: 4, cursor: 'pointer' }}>BACK</button>
            </div>
        </div>
    );

    /* ── METHOD PICKER (default) ── */
    return (
        <div style={{ ...BASE, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 28px' }}>
            <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '2rem', color: '#c5a059', marginBottom: 8 }}>✦</div>
                <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.6rem', color: 'rgba(197,160,89,0.5)', letterSpacing: 5, marginBottom: 36 }}>{label}</div>
                <div style={{ marginBottom: 40 }}>
                    <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)', letterSpacing: 4, marginBottom: 10 }}>QUEEN KARIN REQUIRES</div>
                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '2.8rem', color: '#fff', fontWeight: 700, lineHeight: 1 }}>€{Number(amountEur).toFixed(2)}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <button onClick={handleCard} disabled={cardLoading}
                        style={{ width: '100%', padding: '18px', background: 'linear-gradient(135deg,#c5a059,#8b6914)', border: 'none', borderRadius: 10, color: '#000', fontFamily: 'Orbitron,sans-serif', fontSize: '0.6rem', fontWeight: 700, letterSpacing: 3, cursor: cardLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: cardLoading ? 0.6 : 1 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1.5"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                        {cardLoading ? 'LOADING...' : 'PAY WITH CARD'}
                    </button>
                    {cardError && <div style={{ fontSize: '0.6rem', color: 'rgba(255,80,80,0.7)', fontFamily: 'Rajdhani,sans-serif', textAlign: 'center' }}>{cardError}</div>}
                    <button onClick={() => setScreen('crypto-picker')}
                        style={{ width: '100%', padding: '18px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontFamily: 'Orbitron,sans-serif', fontSize: '0.6rem', fontWeight: 700, letterSpacing: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M9 9h4.5a1.5 1.5 0 010 3H9m1.5 0H15a1.5 1.5 0 010 3H9"/></svg>
                        PAY WITH CRYPTO
                    </button>
                </div>
                <button onClick={onClose} style={{ width: '100%', marginTop: 8, padding: '16px', background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: 'rgba(255,255,255,0.55)', fontFamily: 'Rajdhani,sans-serif', fontSize: '0.75rem', letterSpacing: 4, cursor: 'pointer' }}>CANCEL</button>
            </div>
        </div>
    );
}
