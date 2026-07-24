'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
    const [silenced, setSilenced] = useState(false);
    const [silenceReason, setSilenceReason] = useState('');
    const [paywalled, setPaywalled] = useState(false);
    const [paywallReason, setPaywallReason] = useState('');
    const [paywallAmount, setPaywallAmount] = useState(0);
    const [email, setEmail] = useState('');
    const [paid, setPaid] = useState(false);
    const [wixLoading, setWixLoading] = useState(false);
    const [wixError, setWixError] = useState('');
    const [paypalRequested, setPaypalRequested] = useState(false);
    const [paypalRequesting, setPaypalRequesting] = useState(false);
    const [showCryptoPicker, setShowCryptoPicker] = useState(false);
    const [cryptoLoading, setCryptoLoading] = useState(false);
    const [cryptoError, setCryptoError] = useState('');
    const [cryptoData, setCryptoData] = useState<any>(null);
    const [cryptoConfirmed, setCryptoConfirmed] = useState(false);
    const [cryptoPending, setCryptoPending] = useState(false);
    const cryptoPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        // Detect return from Wix checkout
        const params = new URLSearchParams(window.location.search);
        if (params.get('wix_paid') === '1') {
            const cid = params.get('cid');
            const mid = params.get('mid');
            if (cid && mid) {
                fetch('/api/paywall/wix-verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ checkoutId: cid, memberId: mid }),
                }).then(r => r.json()).then(d => {
                    if (d.paid) handleSuccess();
                }).catch(() => {});
            }
            window.history.replaceState({}, '', '/profile');
        }
        // Detect return from PassimPay crypto checkout
        if (params.get('crypto_paid') === '1') {
            setCryptoPending(true);
            window.history.replaceState({}, '', '/profile');
        }
    }, []);

    useEffect(() => {
        if (sessionStorage.getItem('__silenced') === '1') {
            setSilenced(true);
            setSilenceReason(sessionStorage.getItem('__silenceReason') || '');
        }
        if (sessionStorage.getItem('__paywalled') === '1') {
            setPaywalled(true);
            setPaywallReason(sessionStorage.getItem('__paywallReason') || '');
            setPaywallAmount(Number(sessionStorage.getItem('__paywallAmount') || '0'));
        }

        let active = true;
        let pollInterval: ReturnType<typeof setInterval> | null = null;
        let realtimeChannel: any = null;

        function applyFromRow(fresh: any, userEmail: string) {
            if (!active) return;
            // Silence
            if (fresh.silence === true) {
                const reason = fresh.parameters?.silence_reason || '';
                sessionStorage.setItem('__silenced', '1');
                sessionStorage.setItem('__silenceReason', reason);
                setSilenced(true);
                setSilenceReason(reason);
            } else {
                sessionStorage.removeItem('__silenced');
                sessionStorage.removeItem('__silenceReason');
                setSilenced(false);
            }
            // Paywall
            const paywall = fresh.parameters?.paywall;
            if (paywall?.active) {
                const reason = paywall.reason || '';
                const amount = paywall.amount || 0;
                sessionStorage.setItem('__paywalled', '1');
                sessionStorage.setItem('__paywallReason', reason);
                sessionStorage.setItem('__paywallAmount', String(amount));
                setPaywalled(true);
                setPaywallReason(reason);
                setPaywallAmount(amount);
            } else {
                sessionStorage.removeItem('__paywalled');
                sessionStorage.removeItem('__paywallReason');
                sessionStorage.removeItem('__paywallAmount');
                setPaywalled(false);
            }
        }

        async function init() {
            try {
                const supabase = createClient();
                const { data: { session } } = await supabase.auth.getSession();
                const userEmail = session?.user?.email;
                if (!userEmail || !active) return;
                setEmail(userEmail);
                const emailLower = userEmail.toLowerCase();

                async function check() {
                    try {
                        const res = await fetch('/api/silence-check', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ memberId: userEmail }),
                        });
                        const data = await res.json();
                        if (!active) return;

                        if (data.silence === true) {
                            sessionStorage.setItem('__silenced', '1');
                            sessionStorage.setItem('__silenceReason', data.reason || '');
                            setSilenced(true);
                            setSilenceReason(data.reason || '');
                        } else {
                            sessionStorage.removeItem('__silenced');
                            sessionStorage.removeItem('__silenceReason');
                            setSilenced(false);
                        }

                        if (data.paywall === true) {
                            sessionStorage.setItem('__paywalled', '1');
                            sessionStorage.setItem('__paywallReason', data.paywallReason || '');
                            sessionStorage.setItem('__paywallAmount', String(data.paywallAmount || 0));
                            setPaywalled(true);
                            setPaywallReason(data.paywallReason || '');
                            setPaywallAmount(data.paywallAmount || 0);
                        } else {
                            sessionStorage.removeItem('__paywalled');
                            sessionStorage.removeItem('__paywallReason');
                            sessionStorage.removeItem('__paywallAmount');
                            setPaywalled(false);
                        }
                    } catch {}
                }

                // Initial check on load
                await check();

                // ── Realtime subscription - fires INSTANTLY when admin updates the profile ──
                // No row filter: avoids case-sensitive eq() mismatch. Filter in JS below.
                realtimeChannel = supabase
                    .channel('layout-lock-' + emailLower)
                    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload: any) => {
                        const fresh = payload.new;
                        if (!fresh) return;
                        if ((fresh.member_id || '').toLowerCase() !== emailLower) return;
                        applyFromRow(fresh, emailLower);
                    })
                    .subscribe();

                // Polling fallback: re-check every 15s in case realtime misses the update
                pollInterval = setInterval(check, 15000);
            } catch {}
        }

        init();
        return () => {
            active = false;
            if (pollInterval) clearInterval(pollInterval);
            if (realtimeChannel) {
                try { createClient().removeChannel(realtimeChannel); } catch {}
            }
        };
    }, []);

    async function handleWixCardPay() {
        setWixLoading(true);
        setWixError('');
        try {
            const res = await fetch('/api/paywall/wix-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memberId: email, amount: paywallAmount }),
            });
            const text = await res.text();
            const data = text ? JSON.parse(text) : {};
            if (data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
            } else {
                setWixError(`HTTP ${res.status}: ${JSON.stringify(data.error || text || 'empty response')}`);
                setWixLoading(false);
            }
        } catch (e: any) {
            setWixError(e.message || 'Network error');
            setWixLoading(false);
        }
    }

    async function handleRequestPaypal() {
        if (paypalRequested || paypalRequesting) return;
        setPaypalRequesting(true);
        try {
            await fetch('/api/profile-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    memberId: email,
                    type: 'MESSAGE',
                    payload: { text: `PAYWALL_PAYPAL_REQUEST::${JSON.stringify({ amount: paywallAmount })}`, sender: 'slave' },
                }),
            });
            setPaypalRequested(true);
        } catch {}
        setPaypalRequesting(false);
    }

    function handleSuccess() {
        sessionStorage.removeItem('__paywalled');
        sessionStorage.removeItem('__paywallReason');
        sessionStorage.removeItem('__paywallAmount');
        setPaid(true);
        setPaywalled(false);
        window.location.reload();
    }

    const CRYPTO_OPTIONS = [
        { id: 70, label: 'USDT', sub: 'TRC20 · Stablecoin', color: '#26a17b', icon: '₮', ticker: 'USDT' },
        { id: 10, label: 'BITCOIN', sub: 'BTC · ~10 min', color: '#f7931a', icon: '₿', ticker: 'BTC' },
        { id: 20, label: 'ETHEREUM', sub: 'ETH · ~2 min', color: '#627eea', icon: 'Ξ', ticker: 'ETH' },
        { id: 60, label: 'LITECOIN', sub: 'LTC · ~2 min', color: '#bfbbbb', icon: 'Ł', ticker: 'LTC' },
    ];

    async function handleCryptoPay(currencyId: number, ticker: string) {
        setShowCryptoPicker(false);
        setCryptoLoading(true);
        setCryptoError('');
        try {
            const res = await fetch('/api/paywall/passimpay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memberId: email, amount: paywallAmount, currencyId }),
            });
            const data = await res.json();
            if (!data.success) {
                setCryptoError(data.error || 'Failed to get wallet');
                setCryptoLoading(false);
                return;
            }
            setCryptoData({ ...data, currency: ticker });
            setCryptoLoading(false);
            // Poll for confirmation
            let polls = 0;
            if (cryptoPollRef.current) clearInterval(cryptoPollRef.current);
            cryptoPollRef.current = setInterval(async () => {
                polls++;
                if (polls > 120) { if (cryptoPollRef.current) clearInterval(cryptoPollRef.current); return; }
                try {
                    const r = await fetch('/api/paywall/passimpay-status', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ orderId: data.orderId, memberId: email }),
                    });
                    const v = await r.json();
                    if (v.paid) {
                        if (cryptoPollRef.current) clearInterval(cryptoPollRef.current);
                        setCryptoConfirmed(true);
                        setTimeout(() => handleSuccess(), 1500);
                    }
                } catch {}
            }, 5000);
        } catch (e: any) {
            setCryptoError(e.message || 'Network error');
            setCryptoLoading(false);
        }
    }

    if (silenced) return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2147483647, background: 'rgba(8,2,2,0.97)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="rgba(220,60,60,0.7)">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.68L5.68 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.68L18.32 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z" />
                    </svg>
                </div>
                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.55rem', color: 'rgba(220,60,60,0.6)', letterSpacing: '4px', textTransform: 'uppercase', marginBottom: 24 }}>ACCESS REVOKED</div>
                <div style={{ background: 'rgba(220,60,60,0.04)', border: '1px solid rgba(220,60,60,0.2)', borderRadius: 14, padding: '28px 24px' }}>
                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.38rem', color: 'rgba(220,60,60,0.4)', letterSpacing: '3px', marginBottom: 12 }}>MESSAGE FROM QUEEN KARIN</div>
                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '1.05rem', color: '#fff', lineHeight: 1.6, letterSpacing: '0.5px' }}>{silenceReason}</div>
                </div>
            </div>
        </div>
    );

    if (paywalled && !paid) return (<>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;600;700&display=swap');`}</style>
        <div style={{ position: 'fixed', inset: 0, zIndex: 2147483647, background: 'rgba(2,5,18,0.97)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', overflowY: 'auto' }}>
            <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '2rem', color: '#c5a059', marginBottom: 8 }}>✦</div>
                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.55rem', color: 'rgba(197,160,89,0.5)', letterSpacing: '4px', textTransform: 'uppercase', marginBottom: 24 }}>ACCESS SUSPENDED</div>
                <div style={{ background: 'rgba(197,160,89,0.05)', border: '1px solid rgba(197,160,89,0.25)', borderRadius: 14, padding: '28px 24px', marginBottom: 28 }}>
                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.38rem', color: 'rgba(197,160,89,0.45)', letterSpacing: '3px', marginBottom: 12 }}>MESSAGE FROM QUEEN KARIN</div>
                    <div style={{ fontFamily: 'Dancing Script,cursive', fontSize: '1.2rem', color: '#fff', lineHeight: 1.6 }}>{paywallReason}</div>
                    <div style={{ height: 1, background: 'linear-gradient(to right,transparent,rgba(197,160,89,0.2),transparent)', margin: '20px 0' }}></div>
                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '1.4rem', color: '#c5a059', fontWeight: 700, letterSpacing: '2px' }}>€{Number(paywallAmount).toFixed(2)}</div>
                </div>
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <button onClick={handleWixCardPay} disabled={wixLoading} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg,#c5a059,#8b6914)', border: 'none', borderRadius: 10, color: '#000', fontFamily: 'Orbitron,sans-serif', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '3px', cursor: wixLoading ? 'not-allowed' : 'pointer', boxShadow: '0 8px 30px rgba(197,160,89,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: wixLoading ? 0.6 : 1 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1.5"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                        {wixLoading ? 'LOADING...' : 'PAY WITH CARD'}
                    </button>
                    {wixError && <div style={{ fontSize: '0.6rem', color: 'rgba(255,80,80,0.7)', fontFamily: 'Rajdhani,sans-serif', textAlign: 'center', padding: '4px 8px', wordBreak: 'break-all' }}>{wixError}</div>}
                    <button onClick={() => setShowCryptoPicker(true)} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg,#14081e,#0e0618)', border: '1px solid rgba(160,100,220,0.3)', borderRadius: 10, color: '#d4b0f0', fontFamily: 'Orbitron,sans-serif', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '3px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(160,100,220,0.8)" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M9 9h4.5a1.5 1.5 0 010 3H9m1.5 0H15a1.5 1.5 0 010 3H9"/></svg>
                        PAY WITH CRYPTO
                    </button>
                    <button onClick={handleRequestPaypal} disabled={paypalRequested || paypalRequesting} style={{ width: '100%', padding: '14px', background: 'none', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 10, color: paypalRequested ? 'rgba(197,160,89,0.5)' : 'rgba(197,160,89,0.7)', fontFamily: 'Orbitron,sans-serif', fontSize: '0.55rem', fontWeight: 500, letterSpacing: '3px', cursor: paypalRequested ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        {paypalRequested ? '✓ REQUEST SENT' : paypalRequesting ? 'SENDING...' : 'REQUEST PAYPAL'}
                    </button>
                </div>
                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.35rem', color: 'rgba(255,255,255,0.12)', letterSpacing: '1px', marginTop: 14 }}>Crypto only · PayPal on request</div>
            </div>
        </div>

        {/* ══ CRYPTO COIN PICKER ══ */}
        {showCryptoPicker && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', zIndex: 2147483647, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={(e) => { if (e.target === e.currentTarget) setShowCryptoPicker(false); }}>
                <div style={{ background: 'linear-gradient(160deg,#0c0c1a,#08060f)', border: '1px solid rgba(160,100,220,0.15)', borderRadius: 18, padding: '48px 52px', maxWidth: 480, width: '90%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}>
                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: '1rem', color: '#d4b0f0', letterSpacing: 5, fontWeight: 700 }}>SELECT CURRENCY</div>
                    <div style={{ width: 40, height: 1, background: 'linear-gradient(90deg,transparent,rgba(160,100,220,0.25),transparent)' }} />
                    <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', letterSpacing: 3, fontWeight: 500 }}>€{Number(paywallAmount).toFixed(2)} PAYWALL</div>
                    {cryptoError && <div style={{ fontSize: '0.6rem', color: 'rgba(255,80,80,0.7)', fontFamily: 'Rajdhani,sans-serif', textAlign: 'center', wordBreak: 'break-all' }}>{cryptoError}</div>}
                    <div style={{ width: '100%', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {CRYPTO_OPTIONS.map((opt) => {
                            const rgb = opt.color === '#f7931a' ? '247,147,26' : opt.color === '#26a17b' ? '38,161,123' : opt.color === '#627eea' ? '98,126,234' : '191,187,187';
                            return (
                                <button key={opt.id} onClick={() => handleCryptoPay(opt.id, opt.ticker)}
                                    style={{ width: '100%', padding: '18px 22px', background: `linear-gradient(135deg,rgba(${rgb},0.05),rgba(${rgb},0.02))`, border: `1px solid rgba(${rgb},0.15)`, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
                                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: `rgba(${rgb},0.08)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span style={{ fontSize: '1.3rem', color: opt.color }}>{opt.icon}</span>
                                    </div>
                                    <div style={{ textAlign: 'left', flex: 1 }}>
                                        <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.8rem', color: '#f3e5ab', letterSpacing: 2, fontWeight: 600 }}>{opt.label}</div>
                                        <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)', letterSpacing: 1, marginTop: 2 }}>{opt.sub}</div>
                                    </div>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                                </button>
                            );
                        })}
                    </div>
                    <button onClick={() => setShowCryptoPicker(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', fontFamily: 'Rajdhani,sans-serif', fontSize: '0.65rem', letterSpacing: 3, padding: '8px 20px', cursor: 'pointer', marginTop: 4 }}>BACK</button>
                </div>
            </div>
        )}

        {/* ══ CRYPTO LOADING ══ */}
        {cryptoLoading && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', zIndex: 2147483647, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
                    <div style={{ width: 40, height: 40, border: '2px solid rgba(160,100,220,0.15)', borderTopColor: 'rgba(160,100,220,0.6)', borderRadius: '50%', animation: '_paywallSpin 0.8s linear infinite' }} />
                    <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', letterSpacing: 4, fontWeight: 500 }}>PREPARING PAYMENT...</div>
                </div>
                <style>{`@keyframes _paywallSpin{to{transform:rotate(360deg)}}`}</style>
            </div>
        )}

        {/* ══ CRYPTO WALLET OVERLAY ══ */}
        {cryptoData && !cryptoLoading && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', zIndex: 2147483647, display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto', padding: 20 }}>
                <div style={{ background: 'linear-gradient(160deg,#0c0c1a,#08060f)', border: '1px solid rgba(160,100,220,0.12)', borderRadius: 20, padding: '44px 48px', maxWidth: 520, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, boxShadow: '0 40px 100px rgba(0,0,0,0.7)' }}>
                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: '1.05rem', color: '#d4b0f0', letterSpacing: 6, fontWeight: 700 }}>CRYPTO PAYMENT</div>
                    <div style={{ width: 50, height: 1, background: 'linear-gradient(90deg,transparent,rgba(160,100,220,0.25),transparent)' }} />
                    <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', letterSpacing: 3, fontWeight: 500 }}>PAYWALL TRIBUTE</div>
                    <div style={{ background: '#fff', borderRadius: 14, padding: 16, marginTop: 6 }}>
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(cryptoData.address)}`} alt="QR" style={{ width: 240, height: 240, borderRadius: 6, display: 'block' }} />
                    </div>
                    <div style={{ textAlign: 'center', marginTop: 4 }}>
                        <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', letterSpacing: 2, fontWeight: 500, marginBottom: 6 }}>SEND EXACTLY</div>
                        {cryptoData.cryptoAmount && (
                            <div style={{ fontFamily: 'Cinzel,serif', fontSize: '1.6rem', color: '#f3e5ab', letterSpacing: 1, fontWeight: 700 }}>
                                {cryptoData.cryptoAmount} <span style={{ fontSize: '0.75rem', color: 'rgba(160,100,220,0.7)', fontWeight: 500, letterSpacing: 2 }}>{cryptoData.currency}</span>
                            </div>
                        )}
                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '1.2rem', color: '#c5a059', fontWeight: 700, letterSpacing: 2, marginTop: 8 }}>€{Number(cryptoData.amountEur).toFixed(2)}</div>
                    </div>
                    <div style={{ width: '100%', marginTop: 4 }}>
                        <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', letterSpacing: 2, fontWeight: 500, textAlign: 'center', marginBottom: 6 }}>WALLET ADDRESS</div>
                        <div onClick={() => navigator.clipboard.writeText(cryptoData.address)}
                            style={{ fontFamily: "'SF Mono',Menlo,Consolas,monospace", fontSize: '0.75rem', color: '#d4b0f0', background: 'rgba(160,100,220,0.05)', border: '1px solid rgba(160,100,220,0.12)', borderRadius: 8, padding: '14px 18px', wordBreak: 'break-all', textAlign: 'center', cursor: 'pointer', width: '100%', boxSizing: 'border-box' }}>
                            {cryptoData.address}
                        </div>
                    </div>
                    <button onClick={() => navigator.clipboard.writeText(cryptoData.address)}
                        style={{ background: 'rgba(160,100,220,0.08)', border: '1px solid rgba(160,100,220,0.2)', color: '#d4b0f0', fontFamily: 'Cinzel,serif', fontSize: '0.6rem', letterSpacing: 3, fontWeight: 600, padding: '10px 28px', cursor: 'pointer', borderRadius: 6 }}>
                        COPY ADDRESS
                    </button>
                    <div style={{ width: '100%', height: 1, background: 'linear-gradient(90deg,transparent,rgba(160,100,220,0.1),transparent)', margin: '4px 0' }} />
                    {cryptoConfirmed ? (
                        <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.75rem', color: '#4caf50', letterSpacing: 3, fontWeight: 700 }}>✓ PAYMENT CONFIRMED — UNLOCKING...</div>
                    ) : (
                        <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', letterSpacing: 3, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#a064dc', animation: '_paywallPulse 1.5s infinite' }} />
                            WAITING FOR PAYMENT...
                        </div>
                    )}
                    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: '0.7rem', color: 'rgba(255,255,255,0.18)', textAlign: 'center', lineHeight: 1.7, maxWidth: 400 }}>
                        Send the exact amount shown. Access restores automatically once confirmed.
                    </div>
                    <button onClick={() => { setCryptoData(null); if (cryptoPollRef.current) clearInterval(cryptoPollRef.current); }}
                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', fontFamily: 'Rajdhani,sans-serif', fontSize: '0.65rem', letterSpacing: 3, padding: '8px 20px', cursor: 'pointer', marginTop: 4 }}>CLOSE</button>
                </div>
                <style>{`@keyframes _paywallPulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
            </div>
        )}
    </>);

    return <>{children}</>;
}
