'use client';

import { useState, useRef, useEffect } from 'react';

const CRYPTO_OPTIONS = [
    { id: 70, label: 'USDT', sub: 'TRC20 · Stablecoin · Recommended', color: '#26a17b', icon: '₮', ticker: 'USDT' },
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
    throneUrl?: string;
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
    throneUrl,
    onSuccess,
    onClose,
}: PaymentModalProps) {
    const [screen, setScreen] = useState<Screen>('method');
    const [cardLoading, setCardLoading] = useState(false);
    const [cardError, setCardError] = useState('');
    const [cryptoError, setCryptoError] = useState('');
    const [cardStep, setCardStep] = useState<null|'story'|'options'|'revolut'|'moonpay'|'throne'>(null);
    const [cryptoData, setCryptoData] = useState<any>(null);
    const [confirmed, setConfirmed] = useState(false);
    const [copied, setCopied] = useState(false);
    const [inlineAddress, setInlineAddress] = useState<any>(null);
    const [inlineLoading, setInlineLoading] = useState(false);
    const [inlineCopied, setInlineCopied] = useState(false);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, []);

    useEffect(() => {
        if ((cardStep === 'revolut' || cardStep === 'moonpay') && !inlineAddress && !inlineLoading) {
            fetchInlineAddress();
        }
    }, [cardStep]);

    const fetchInlineAddress = async () => {
        setInlineLoading(true);
        try {
            const res = await fetch(cryptoApiPath, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...cryptoPayBody, currencyId: 20 }),
            });
            const data = await res.json();
            if (data.success) {
                setInlineAddress({ ...data, currency: 'USDT' });
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
            }
        } catch {}
        setInlineLoading(false);
    };

    const copyInlineAddress = () => {
        const addr = inlineAddress?.address || '';
        if (!addr) return;
        const fallback = () => {
            const ta = document.createElement('textarea');
            ta.value = addr;
            ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;width:1px;height:1px';
            document.body.appendChild(ta); ta.focus(); ta.select();
            try { document.execCommand('copy'); } catch {}
            document.body.removeChild(ta);
            setInlineCopied(true); setTimeout(() => setInlineCopied(false), 2000);
        };
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(addr).then(() => { setInlineCopied(true); setTimeout(() => setInlineCopied(false), 2000); }).catch(fallback);
        } else { fallback(); }
    };

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
    const BASE: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 2147483647, overflow: 'hidden', scrollbarWidth: 'none' } as React.CSSProperties;
    // Blurred background layer — slightly oversized so blur edges don't show
    const BG: React.CSSProperties = {
        position: 'absolute', inset: '-20px',
        backgroundImage: 'url(/queen-payment-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        backgroundRepeat: 'no-repeat',
        filter: 'blur(28px)',
        transform: 'scale(1.05)',
    };
    const OVERLAY: React.CSSProperties = {
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(2,2,12,0.5) 0%, rgba(2,2,12,0.75) 50%, rgba(2,2,12,0.92) 100%)',
    };
    // Glassy card behind content
    const CARD: React.CSSProperties = {
        position: 'relative',
        background: 'rgba(4,4,16,0.6)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 20,
        padding: '36px 28px 28px',
        width: '100%',
        maxWidth: 400,
        textAlign: 'center' as const,
    };

    /* ── LOADING ── */
    if (screen === 'loading') return (
        <div style={{ ...BASE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={BG} />
            <div style={OVERLAY} />
            <style>{`@keyframes _pmSpin{to{transform:rotate(360deg)}}`}</style>
            <div style={{ ...CARD, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
                <div style={{ width: 40, height: 40, border: '2px solid rgba(197,160,89,0.15)', borderTopColor: 'rgba(197,160,89,0.6)', borderRadius: '50%', animation: '_pmSpin 0.8s linear infinite' }} />
                <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', letterSpacing: 4 }}>PREPARING PAYMENT...</div>
            </div>
        </div>
    );

    /* ── QR OVERLAY ── */
    if (screen === 'qr' && cryptoData) return (
        <div style={{ ...BASE, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflowY: 'scroll', scrollbarWidth: 'none', padding: '28px 24px 48px' }}>
            <div style={BG} />
            <div style={OVERLAY} />
            <style>{`@keyframes _pmPulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
            <div style={{ ...CARD, display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: 420 }}>
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
                <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px 16px', wordBreak: 'break-all', textAlign: 'center', lineHeight: 1.7, textTransform: 'none', fontVariant: 'normal' }}>{cryptoData.address}</div>
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
        </div>
    );

    /* ── CRYPTO PICKER ── */
    if (screen === 'crypto-picker') return (
        <div style={{ ...BASE, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
            <div style={BG} />
            <div style={OVERLAY} />
            <div style={{ ...CARD, maxWidth: 420, textAlign: 'left' }}>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '1.2rem', color: '#fff', fontWeight: 700, letterSpacing: 2, textAlign: 'center', marginBottom: 6 }}>SELECT CURRENCY</div>
                <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.6rem', color: 'rgba(197,160,89,0.5)', letterSpacing: 5, textAlign: 'center', marginBottom: 28 }}>{label}</div>
                {cryptoError && <div style={{ fontSize: '0.65rem', color: 'rgba(255,80,80,0.8)', fontFamily: 'Rajdhani,sans-serif', textAlign: 'center', marginBottom: 16, letterSpacing: 1 }}>{cryptoError}</div>}
                {CRYPTO_OPTIONS.map((opt, i) => (
                    <button key={opt.id} onClick={() => handleCryptoPick(opt.id, opt.ticker)}
                        style={{ width: '100%', padding: '18px 0', background: 'none', border: 'none', borderTop: i === 0 ? '1px solid rgba(255,255,255,0.1)' : 'none', borderBottom: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 18, textAlign: 'left' }}>
                        <div style={{ width: 42, height: 42, borderRadius: '50%', background: `${opt.color}20`, border: `1px solid ${opt.color}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: '1.2rem', color: opt.color, fontFamily: 'Cinzel,serif', fontWeight: 700 }}>{opt.icon}</span>
                        </div>
                        <div style={{ flex: 1, textAlign: 'left' }}>
                            <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.8rem', color: '#fff', letterSpacing: 2, fontWeight: 600 }}>{opt.label}</div>
                            <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginTop: 2 }}>{opt.sub}</div>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.5)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                ))}
                <button onClick={() => setScreen('method')} style={{ width: '100%', padding: '16px', marginTop: 20, background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: 'rgba(255,255,255,0.55)', fontFamily: 'Rajdhani,sans-serif', fontSize: '0.75rem', letterSpacing: 4, cursor: 'pointer' }}>BACK</button>
            </div>
        </div>
    );

    /* ── CARD STORY SCREENS ── */
    if (cardStep === 'story') return (
        <div style={{ ...BASE, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
            <div style={BG} />
            <div style={OVERLAY} />
            <div style={{ ...CARD, maxWidth: 420 }}>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.45rem', color: 'rgba(197,160,89,0.45)', letterSpacing: 5, marginBottom: 20, textAlign: 'center' }}>A QUICK WORD</div>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '1.3rem', color: '#fff', fontWeight: 700, lineHeight: 1.45, marginBottom: 20, textAlign: 'center' }}>
                    Stripe and I broke up.
                </div>
                <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.95rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.8, marginBottom: 24, textAlign: 'center' }}>
                    You had this chance for 3 years.<br/>It is gone now.
                </div>
                <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.95rem', color: 'rgba(255,255,255,0.6)', lineHeight: 2, marginBottom: 24, textAlign: 'center', padding: '0 16px' }}>
                    Setting up a new processor means adding a <span style={{ color: '#fff', fontWeight: 700 }}>50% lazy tax to your bill.</span><br/>I'd rather not do that to you.<br/>Especially when you can use that exact same card to grab crypto in under 5 minutes.
                </div>
                <style>{`@import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600&display=swap');`}</style>
                <div style={{ fontFamily: "'Dancing Script', cursive", fontSize: '1.1rem', color: '#c5a059', fontWeight: 600, textAlign: 'center', marginBottom: 28 }}>
                    Let's call it the first step of submission.
                </div>
                <button className="coin-flip-btn" onClick={() => setCardStep('options')} style={{ width: '100%', marginBottom: 12 }}>
                    <span style={{ fontFamily: 'Cinzel,serif', fontSize: '0.8rem', fontWeight: 700, letterSpacing: 2 }}>HOW TO GET CRYPTO</span>
                </button>
                <button onClick={() => { setCardStep(null); setScreen('crypto-picker'); }}
                    style={{ width: '100%', padding: '16px', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.5)', fontFamily: 'Rajdhani,sans-serif', fontSize: '0.75rem', letterSpacing: 3, cursor: 'pointer' }}>
                    I ALREADY HAVE CRYPTO
                </button>
            </div>
        </div>
    );

    if (cardStep === 'options') return (
        <div style={{ ...BASE, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
            <div style={BG} />
            <div style={OVERLAY} />
            <div style={{ ...CARD, maxWidth: 420 }}>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '1.1rem', color: '#fff', fontWeight: 700, textAlign: 'center', marginBottom: 6 }}>How do you want to get it?</div>
                <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', textAlign: 'center', letterSpacing: 2, marginBottom: 28 }}>PICK YOUR METHOD</div>

                <button onClick={() => setCardStep('revolut')}
                    style={{ width: '100%', padding: '20px 18px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, textAlign: 'left' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,0,180,0.1)', border: '1px solid rgba(255,0,180,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M13.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9.5L13.5 2z" stroke="rgba(255,0,180,0.9)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M13 2v8h8" stroke="rgba(255,0,180,0.9)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 13h6M9 17h4" stroke="rgba(255,0,180,0.9)" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.85rem', color: '#fff', fontWeight: 600, marginBottom: 3 }}>Revolut</div>
                        <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', letterSpacing: 1 }}>Already have Revolut?</div>
                        <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.7rem', color: '#fff', fontWeight: 700, letterSpacing: 1 }}>Buy crypto in 2 min</div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,0,180,0.6)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>


                <button onClick={() => setCardStep('moonpay')}
                    style={{ width: '100%', padding: '20px 18px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, textAlign: 'left' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(80,180,255,0.1)', border: '1px solid rgba(80,180,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" stroke="rgba(80,180,255,0.8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.85rem', color: '#fff', fontWeight: 600, marginBottom: 3 }}>MoonPay</div>
                        <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', letterSpacing: 1 }}>Card to crypto directly</div>
                        <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.7rem', color: '#fff', fontWeight: 700, letterSpacing: 1 }}>No wallet needed</div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(80,180,255,0.6)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>

                <button onClick={() => setCardStep('story')}
                    style={{ width: '100%', padding: '14px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontFamily: 'Rajdhani,sans-serif', fontSize: '0.75rem', letterSpacing: 3, cursor: 'pointer' }}>BACK</button>
            </div>
        </div>
    );

    if (cardStep === 'revolut') return (
        <div style={{ ...BASE, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', overflowY: 'scroll', scrollbarWidth: 'none' }}>
            <div style={BG} />
            <div style={OVERLAY} />
            <div style={{ ...CARD, maxWidth: 420 }}>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.45rem', color: 'rgba(197,160,89,0.5)', letterSpacing: 5, marginBottom: 12, textAlign: 'center' }}>REVOLUT</div>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '1rem', color: '#fff', fontWeight: 700, textAlign: 'center', marginBottom: 4 }}>2 minutes. That's it.</div>
                <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginBottom: 24, letterSpacing: 1 }}>Anonymous. No one knows. Not even your bank.</div>
                {[
                    { n: '1', text: 'Open Revolut. At the bottom you will see 5 icons. Tap the coin one.' },
                    { n: '2', text: 'Search Ethereum (ETH). Select it.' },
                    { n: '3', text: `Tap Buy. Enter €${Number(amountEur).toFixed(2)}. Confirm.` },
                    { n: '4', text: 'Tap Send. Select To crypto address. Copy the address below and paste it in. Send.' },
                ].map(s => (
                    <div key={s.n} style={{ display: 'flex', gap: 14, marginBottom: 16, alignItems: 'flex-start' }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(197,160,89,0.12)', border: '1px solid rgba(197,160,89,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontFamily: 'Cinzel,serif', fontSize: '0.65rem', color: '#c5a059', fontWeight: 700 }}>{s.n}</span>
                        </div>
                        <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.88rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, paddingTop: 2, textAlign: 'left' }}>{s.text}</div>
                    </div>
                ))}
                <div style={{ marginTop: 20 }}>
                    {inlineLoading && (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
                            <style>{`@keyframes _pmSpin{to{transform:rotate(360deg)}}`}</style>
                            <div style={{ width: 28, height: 28, border: '2px solid rgba(197,160,89,0.15)', borderTopColor: 'rgba(197,160,89,0.6)', borderRadius: '50%', animation: '_pmSpin 0.8s linear infinite' }} />
                        </div>
                    )}
                    {inlineAddress && !inlineLoading && (
                        <>
                            <div style={{ height: 1, width: '100%', background: 'rgba(255,255,255,0.06)', marginBottom: 20 }} />
                            <div style={{ textAlign: 'center', marginBottom: 12 }}>
                                <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', letterSpacing: 4, marginBottom: 4 }}>SEND EXACTLY</div>
                                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '1.6rem', color: '#fff', fontWeight: 900 }}>{inlineAddress.cryptoAmount}</div>
                                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.75rem', color: '#627eea', letterSpacing: 3, marginTop: 2 }}>ETH <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span> <span style={{ color: '#c5a059' }}>€{Number(amountEur).toFixed(2)}</span></div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(inlineAddress.address)}`} alt="QR" style={{ width: 180, height: 180, background: '#fff', borderRadius: 10, padding: 8 }} />
                            </div>
                            <div style={{ fontFamily: 'monospace', fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '10px 12px', wordBreak: 'break-all', textAlign: 'center', lineHeight: 1.7, marginBottom: 8, textTransform: 'none', fontVariant: 'normal' }}>{inlineAddress.address}</div>
                            <button onClick={copyInlineAddress} style={{ width: '100%', padding: '14px', background: inlineCopied ? 'rgba(76,175,80,0.08)' : 'rgba(197,160,89,0.07)', border: `1px solid ${inlineCopied ? 'rgba(76,175,80,0.35)' : 'rgba(197,160,89,0.25)'}`, borderRadius: 8, color: inlineCopied ? '#66bb6a' : '#c5a059', fontFamily: 'Orbitron,sans-serif', fontSize: '0.55rem', fontWeight: 700, letterSpacing: 4, cursor: 'pointer', marginBottom: 10 }}>
                                {inlineCopied ? '✓ COPIED' : 'COPY ADDRESS'}
                            </button>
                            {confirmed ? (
                                <div style={{ textAlign: 'center', fontFamily: 'Rajdhani,sans-serif', fontSize: '0.9rem', color: '#66bb6a', letterSpacing: 2, fontWeight: 700, marginBottom: 10 }}>{confirmMessage}</div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
                                    <style>{`@keyframes _pmPulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c5a059', display: 'inline-block', animation: '_pmPulse 1.5s infinite' }} />
                                    <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.55rem', color: 'rgba(255,255,255,0.5)', letterSpacing: 3 }}>WAITING FOR PAYMENT</span>
                                </div>
                            )}
                        </>
                    )}
                </div>
                <button onClick={() => setCardStep('options')}
                    style={{ width: '100%', padding: '14px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontFamily: 'Rajdhani,sans-serif', fontSize: '0.75rem', letterSpacing: 3, cursor: 'pointer' }}>BACK</button>
            </div>
        </div>
    );

    if (cardStep === 'moonpay') return (
        <div style={{ ...BASE, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', overflowY: 'scroll', scrollbarWidth: 'none' }}>
            <div style={BG} />
            <div style={OVERLAY} />
            <div style={{ ...CARD, maxWidth: 420 }}>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.45rem', color: 'rgba(197,160,89,0.5)', letterSpacing: 5, marginBottom: 12, textAlign: 'center' }}>MOONPAY</div>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '1rem', color: '#fff', fontWeight: 700, textAlign: 'center', marginBottom: 4 }}>No account. No wallet. Just your card.</div>
                <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginBottom: 24, letterSpacing: 1 }}>Anonymous. Sends crypto straight to the address.</div>
                {[
                    { n: '1', text: '__MOONPAY__' },
                    { n: '2', text: '__USDT__' },
                    { n: '3', text: `In "You pay" type €${Number(amountEur).toFixed(2)}.` },
                    { n: '4', text: 'Tap Continue. It will ask for a wallet address.' },
                    { n: '5', text: 'Copy the address shown below and paste it in. Enter your card details and confirm.' },
                ].map(s => (
                    <div key={s.n} style={{ display: 'flex', gap: 14, marginBottom: 16, alignItems: 'flex-start' }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(80,180,255,0.1)', border: '1px solid rgba(80,180,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontFamily: 'Cinzel,serif', fontSize: '0.65rem', color: 'rgba(80,180,255,0.8)', fontWeight: 700 }}>{s.n}</span>
                        </div>
                        <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.88rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, paddingTop: 2, textAlign: 'left' }}>
                            {s.text === '__MOONPAY__'
                                ? <>Open <a href="https://www.moonpay.com" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(80,180,255,0.9)', textDecoration: 'underline' }}>Moonpay.com</a> in your browser.</>
                                : s.text === '__USDT__'
                                ? <>Make sure <strong style={{ color: '#fff' }}>USDT is selected.</strong></>
                                : s.text}
                        </div>
                    </div>
                ))}
                <div style={{ marginTop: 20 }}>
                    {inlineLoading && (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
                            <div style={{ width: 28, height: 28, border: '2px solid rgba(197,160,89,0.15)', borderTopColor: 'rgba(197,160,89,0.6)', borderRadius: '50%', animation: '_pmSpin 0.8s linear infinite' }} />
                        </div>
                    )}
                    {inlineAddress && !inlineLoading && (
                        <>
                            <div style={{ height: 1, width: '100%', background: 'rgba(255,255,255,0.06)', marginBottom: 20 }} />
                            <div style={{ textAlign: 'center', marginBottom: 12 }}>
                                <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', letterSpacing: 4, marginBottom: 4 }}>SEND EXACTLY</div>
                                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '1.6rem', color: '#fff', fontWeight: 900 }}>{inlineAddress.cryptoAmount}</div>
                                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.75rem', color: '#627eea', letterSpacing: 3, marginTop: 2 }}>ETH <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span> <span style={{ color: '#c5a059' }}>€{Number(amountEur).toFixed(2)}</span></div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(inlineAddress.address)}`} alt="QR" style={{ width: 180, height: 180, background: '#fff', borderRadius: 10, padding: 8 }} />
                            </div>
                            <div style={{ fontFamily: 'monospace', fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '10px 12px', wordBreak: 'break-all', textAlign: 'center', lineHeight: 1.7, marginBottom: 8, textTransform: 'none', fontVariant: 'normal' }}>{inlineAddress.address}</div>
                            <button onClick={copyInlineAddress} style={{ width: '100%', padding: '14px', background: inlineCopied ? 'rgba(76,175,80,0.08)' : 'rgba(197,160,89,0.07)', border: `1px solid ${inlineCopied ? 'rgba(76,175,80,0.35)' : 'rgba(197,160,89,0.25)'}`, borderRadius: 8, color: inlineCopied ? '#66bb6a' : '#c5a059', fontFamily: 'Orbitron,sans-serif', fontSize: '0.55rem', fontWeight: 700, letterSpacing: 4, cursor: 'pointer', marginBottom: 10 }}>
                                {inlineCopied ? '✓ COPIED' : 'COPY ADDRESS'}
                            </button>
                            {confirmed ? (
                                <div style={{ textAlign: 'center', fontFamily: 'Rajdhani,sans-serif', fontSize: '0.9rem', color: '#66bb6a', letterSpacing: 2, fontWeight: 700, marginBottom: 10 }}>{confirmMessage}</div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c5a059', display: 'inline-block', animation: '_pmPulse 1.5s infinite' }} />
                                    <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.55rem', color: 'rgba(255,255,255,0.5)', letterSpacing: 3 }}>WAITING FOR PAYMENT</span>
                                </div>
                            )}
                        </>
                    )}
                </div>
                <button onClick={() => setCardStep('options')}
                    style={{ width: '100%', padding: '14px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontFamily: 'Rajdhani,sans-serif', fontSize: '0.75rem', letterSpacing: 3, cursor: 'pointer' }}>BACK</button>
            </div>
        </div>
    );

    /* ── THRONE ── */
    if (cardStep === 'throne') {
        const throneAmount = Math.ceil(amountEur * 1.2 * 100) / 100;
        return (
            <div style={{ ...BASE, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
                <div style={BG} />
                <div style={OVERLAY} />
                <div style={{ ...CARD, maxWidth: 420 }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M2 19h20v2H2v-2zm2-3l2-8 4 4 2-6 2 6 4-4 2 8H4z" fill="rgba(197,160,89,0.85)"/></svg>
                        </div>
                    </div>
                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: '1.1rem', color: '#fff', fontWeight: 700, textAlign: 'center', marginBottom: 6 }}>The comfortable option.</div>
                    <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', textAlign: 'center', letterSpacing: 1, marginBottom: 16 }}>For those who prefer the familiar.</div>

                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(197,160,89,0.6)', flexShrink: 0 }} />
                        <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                            Available for <strong style={{ color: 'rgba(255,255,255,0.75)' }}>Week Entry Program only.</strong><br/>
                            Usual price €55.00 + 20% lazy tax = <strong style={{ color: '#c5a059' }}>€66.00</strong>
                        </div>
                    </div>

                    <div style={{ background: 'rgba(197,160,89,0.05)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 12, padding: '20px', marginBottom: 20, textAlign: 'center' }}>
                        <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', letterSpacing: 4, marginBottom: 6 }}>YOU WILL PAY</div>
                        <div style={{ fontFamily: 'Cinzel,serif', fontSize: '2.4rem', color: '#c5a059', fontWeight: 700, lineHeight: 1, marginBottom: 4 }}>€{throneAmount.toFixed(2)}</div>
                        <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', letterSpacing: 1 }}>instead of €{Number(amountEur).toFixed(2)} — Throne takes a cut</div>
                    </div>

                    <div style={{ background: 'rgba(255,80,80,0.04)', border: '1px solid rgba(255,80,80,0.12)', borderRadius: 10, padding: '14px 16px', marginBottom: 12, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,120,120,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
                            Your access will <strong style={{ color: '#fff' }}>not open automatically.</strong><br/>Expect it within 24 hours.
                        </div>
                    </div>

                    <div style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 10, padding: '14px 16px', marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                        <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
                            <strong style={{ color: '#c5a059' }}>Include your email in the Throne gift message.</strong><br/>
                            That is how I find your account.
                        </div>
                    </div>

                    <style>{`@import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600&display=swap');`}</style>
                    <div style={{ fontFamily: "'Dancing Script', cursive", fontSize: '1rem', color: 'rgba(197,160,89,0.6)', textAlign: 'center', marginBottom: 24 }}>
                        Patience is also a virtue.
                    </div>

                    <a href={throneUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', width: '100%', padding: '18px', background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.3)', borderRadius: 10, color: '#c5a059', fontFamily: 'Orbitron,sans-serif', fontSize: '0.6rem', fontWeight: 700, letterSpacing: 3, cursor: 'pointer', textAlign: 'center', textDecoration: 'none', marginBottom: 10, boxSizing: 'border-box' as const }}>
                        OPEN THRONE
                    </a>
                    <button onClick={() => { setCardStep(null); setScreen('crypto-picker'); }}
                        style={{ width: '100%', padding: '16px', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.55)', fontFamily: 'Orbitron,sans-serif', fontSize: '0.6rem', fontWeight: 700, letterSpacing: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M9 9h4.5a1.5 1.5 0 010 3H9m1.5 0H15a1.5 1.5 0 010 3H9"/></svg>
                        SWITCH TO CRYPTO
                    </button>
                    <button onClick={() => setCardStep(null)} style={{ width: '100%', padding: '14px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontFamily: 'Rajdhani,sans-serif', fontSize: '0.75rem', letterSpacing: 3, cursor: 'pointer' }}>BACK</button>
                </div>
            </div>
        );
    }

    /* ── METHOD PICKER (default) ── */
    return (
        <div style={{ ...BASE, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
            <style>{`*::-webkit-scrollbar{display:none!important}`}</style>
            <div style={BG} />
            <div style={OVERLAY} />
            <div style={{ ...CARD }}>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '2rem', color: '#c5a059', marginBottom: 8 }}>✦</div>
                <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.6rem', color: 'rgba(197,160,89,0.7)', letterSpacing: 5, marginBottom: 28 }}>{label}</div>
                <div style={{ marginBottom: 32 }}>
                    <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.55rem', color: 'rgba(255,255,255,0.5)', letterSpacing: 4, marginBottom: 10 }}>QUEEN KARIN REQUIRES</div>
                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: '2.8rem', color: '#fff', fontWeight: 700, lineHeight: 1 }}>€{Number(amountEur).toFixed(2)}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* CARD button — visible, tappable */}
                    <button onClick={() => setCardStep('story')}
                        style={{ width: '100%', padding: '18px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.55)', fontFamily: 'Orbitron,sans-serif', fontSize: '0.6rem', fontWeight: 700, letterSpacing: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                        PAY WITH CARD
                    </button>
                    <button onClick={() => setScreen('crypto-picker')}
                        style={{ width: '100%', padding: '18px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontFamily: 'Orbitron,sans-serif', fontSize: '0.6rem', fontWeight: 700, letterSpacing: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M9 9h4.5a1.5 1.5 0 010 3H9m1.5 0H15a1.5 1.5 0 010 3H9"/></svg>
                        PAY WITH CRYPTO
                    </button>
                    {throneUrl && (
                        <button onClick={() => setCardStep('throne')}
                            style={{ width: '100%', padding: '18px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'Orbitron,sans-serif', fontSize: '0.6rem', fontWeight: 700, letterSpacing: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M2 19h20v2H2v-2zm2-3l2-8 4 4 2-6 2 6 4-4 2 8H4z" fill="rgba(255,255,255,0.35)"/></svg>
                            PAY WITH THRONE
                        </button>
                    )}
                </div>
                <button onClick={onClose} style={{ width: '100%', marginTop: 8, padding: '16px', background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: 'rgba(255,255,255,0.55)', fontFamily: 'Rajdhani,sans-serif', fontSize: '0.75rem', letterSpacing: 4, cursor: 'pointer' }}>CANCEL</button>
            </div>
        </div>
    );
}
