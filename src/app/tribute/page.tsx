"use client";

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function TributePage() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0 });
    const [mounted, setMounted] = useState(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const PROMO_END = new Date('2026-05-05T00:00:00Z').getTime();

    useEffect(() => {
        setMounted(true);
        const init = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { window.location.href = '/login'; return; }
            setUserEmail(user.email || (user.user_metadata?.user_name ? `@${user.user_metadata.user_name}` : 'Unknown'));
            try { await (await fetch('/api/auth/link-profile', { method: 'POST' })).json(); } catch {}
        };
        init();
    }, []);

    useEffect(() => {
        const tick = () => {
            const diff = Math.max(0, PROMO_END - Date.now());
            setTimeLeft({ h: Math.floor(diff / 3600000), m: Math.floor((diff % 3600000) / 60000), s: Math.floor((diff % 60000) / 1000) });
        };
        tick();
        timerRef.current = setInterval(tick, 1000);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, []);

    const handleTribute = async () => {
        setLoading(true); setStatus(null);
        try {
            const res = await fetch('/api/stripe/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'entrance_tribute' }) });
            const data = await res.json();
            if (data.url) window.location.href = data.url;
            else setStatus('Something went wrong. Try again.');
        } catch { setStatus('Connection error. Try again.'); }
        finally { setLoading(false); }
    };

    const handleLogout = async () => { const s = createClient(); await s.auth.signOut(); window.location.href = '/login'; };
    const pad = (n: number) => String(n).padStart(2, '0');

    return (
        <div style={{ background: '#020202', color: '#fff', minHeight: '100dvh', overflowX: 'hidden', position: 'relative' }}>
            <style>{`
                @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
                @keyframes slideUp { from { opacity:0; transform:translateY(40px); } to { opacity:1; transform:translateY(0); } }
                @keyframes slideDown { from { opacity:0; transform:translateY(-20px); } to { opacity:1; transform:translateY(0); } }
                @keyframes pulse2 { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
                @keyframes borderGlow {
                    0%,100% { border-color: rgba(220,50,80,0.2); box-shadow: 0 0 30px rgba(220,50,80,0.08), inset 0 0 30px rgba(220,50,80,0.03); }
                    50% { border-color: rgba(220,50,80,0.45); box-shadow: 0 0 50px rgba(220,50,80,0.15), inset 0 0 50px rgba(220,50,80,0.05); }
                }
                @keyframes shimmer {
                    0% { background-position: -200% center; }
                    100% { background-position: 200% center; }
                }
                @keyframes float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-8px); } }
                @keyframes scanline {
                    0% { transform: translateY(-100%); }
                    100% { transform: translateY(100vh); }
                }
                @keyframes countTick {
                    0% { transform: scale(1); }
                    15% { transform: scale(1.06); }
                    30% { transform: scale(1); }
                }
                @keyframes ringPulse {
                    0% { transform: scale(0.95); opacity: 0.5; }
                    50% { transform: scale(1.05); opacity: 1; }
                    100% { transform: scale(0.95); opacity: 0.5; }
                }
                @keyframes ctaShine {
                    0% { left: -100%; }
                    50%,100% { left: 100%; }
                }
                .tribute-cta:hover { transform: scale(1.03) !important; box-shadow: 0 8px 50px rgba(220,50,80,0.5) !important; }
                .tribute-cta:active { transform: scale(0.98) !important; }
            `}</style>

            {/* ─── LAYERED BACKGROUNDS ─── */}
            {/* Base photo */}
            <div style={{ position: 'fixed', inset: 0, backgroundImage: "url('/queen-bg-mobile.jpg')", backgroundSize: 'cover', backgroundPosition: 'center 20%', zIndex: 0, opacity: 0.5, filter: 'saturate(0.3)' }} />
            {/* Dark gradient overlay */}
            <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(2,2,2,0.75) 35%, rgba(2,2,2,0.95) 65%, #020202 100%)', zIndex: 0 }} />
            {/* Red accent glow at top */}
            <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '120vw', height: '50vh', background: 'radial-gradient(ellipse at center top, rgba(220,50,80,0.08) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />
            {/* Gold accent glow bottom */}
            <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100vw', height: '40vh', background: 'radial-gradient(ellipse at center bottom, rgba(197,160,89,0.04) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />
            {/* Scanline effect */}
            <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', zIndex: 0, pointerEvents: 'none', opacity: 0.03 }}>
                <div style={{ position: 'absolute', width: '100%', height: '2px', background: 'linear-gradient(90deg, transparent, rgba(220,50,80,0.8), transparent)', animation: 'scanline 8s linear infinite' }} />
            </div>
            {/* Noise texture */}
            <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.015, backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")', backgroundSize: '128px 128px' }} />

            {/* ─── CONTENT ─── */}
            <div style={{ position: 'relative', zIndex: 1, maxWidth: 560, margin: '0 auto', padding: 'clamp(40px,8vw,80px) clamp(20px,5vw,32px) 60px' }}>

                {/* ── TOP BADGE ── */}
                <div style={{ textAlign: 'center', animation: mounted ? 'slideDown 0.6s ease-out both' : 'none', marginBottom: 28 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(220,50,80,0.06)', border: '1px solid rgba(220,50,80,0.25)', borderRadius: 100, padding: '5px 20px' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#e03050', animation: 'pulse2 1.5s infinite', boxShadow: '0 0 10px rgba(220,50,80,0.6)' }} />
                        <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.36rem', color: '#e03050', letterSpacing: '4px' }}>LIVE — 72H ONLY</span>
                    </div>
                </div>

                {/* ── HERO: QUEEN IMAGE + TITLE ── */}
                <div style={{ textAlign: 'center', animation: mounted ? 'slideUp 0.8s ease-out 0.1s both' : 'none', marginBottom: 10 }}>
                    {/* Queen avatar with animated ring */}
                    <div style={{ position: 'relative', width: 110, height: 110, margin: '0 auto 22px' }}>
                        <div style={{ position: 'absolute', inset: -6, borderRadius: '50%', border: '1.5px solid rgba(220,50,80,0.3)', animation: 'ringPulse 3s ease-in-out infinite' }} />
                        <div style={{ position: 'absolute', inset: -12, borderRadius: '50%', border: '1px solid rgba(220,50,80,0.1)', animation: 'ringPulse 3s ease-in-out infinite 0.5s' }} />
                        <img src="/queen-karin.png" alt="Queen Karin" style={{ width: 110, height: 110, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(197,160,89,0.4)', boxShadow: '0 0 40px rgba(0,0,0,0.8), 0 0 20px rgba(220,50,80,0.15)' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>

                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.32rem', color: 'rgba(197,160,89,0.35)', letterSpacing: '8px', marginBottom: 10 }}>QUEEN KARIN PRESENTS</div>
                    <h1 style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(1.6rem,5.5vw,2.6rem)', color: '#fff', letterSpacing: '3px', textTransform: 'uppercase', margin: '0 0 6px', fontWeight: 700, lineHeight: 1.1 }}>
                        FULL HOUSE
                    </h1>
                    <h2 style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(1.1rem,4vw,1.8rem)', margin: 0, fontWeight: 400, lineHeight: 1.1, background: 'linear-gradient(90deg, #e03050, #ff6080, #e03050)', backgroundSize: '200% auto', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', animation: 'shimmer 3s linear infinite', letterSpacing: '6px' }}>
                        OPEN CALL
                    </h2>
                    <div style={{ width: 60, height: 1.5, background: 'linear-gradient(90deg, transparent, #e03050, transparent)', margin: '18px auto 0' }} />
                </div>

                {/* ── QUOTE ── */}
                <div style={{ textAlign: 'center', animation: mounted ? 'slideUp 1s ease-out 0.2s both' : 'none', marginBottom: 32 }}>
                    <p style={{ fontFamily: 'Cinzel,serif', fontSize: '0.88rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.85, maxWidth: 400, margin: '0 auto', fontStyle: 'italic' }}>
                        &ldquo;I am filling the House. This is the first and last time I offer a discount. You will not see this again.&rdquo;
                    </p>
                </div>

                {/* ── COUNTDOWN ── */}
                <div style={{ animation: mounted ? 'slideUp 1s ease-out 0.3s both' : 'none', marginBottom: 32 }}>
                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.3rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '5px', textAlign: 'center', marginBottom: 10 }}>OFFER EXPIRES IN</div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                        {[
                            { val: pad(timeLeft.h), label: 'HOURS' },
                            { val: pad(timeLeft.m), label: 'MINS' },
                            { val: pad(timeLeft.s), label: 'SECS' },
                        ].map((t, i) => (
                            <div key={t.label} style={{ position: 'relative' }}>
                                <div style={{
                                    background: 'rgba(220,50,80,0.04)', border: '1px solid rgba(220,50,80,0.15)', borderRadius: 8,
                                    padding: '14px 0', minWidth: 80, textAlign: 'center',
                                    backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                                    animation: 'countTick 1s ease-in-out infinite',
                                    animationDelay: `${i * 0.15}s`,
                                }}>
                                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: 'clamp(1.4rem,4vw,2rem)', color: '#fff', fontWeight: 700, lineHeight: 1, textShadow: '0 0 20px rgba(220,50,80,0.3)' }}>{t.val}</div>
                                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.26rem', color: 'rgba(220,50,80,0.4)', letterSpacing: '3px', marginTop: 5 }}>{t.label}</div>
                                </div>
                                {i < 2 && <div style={{ position: 'absolute', right: -8, top: '35%', fontFamily: 'Orbitron', fontSize: '1.2rem', color: 'rgba(220,50,80,0.25)', fontWeight: 700 }}>:</div>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── PRICE CARD ── */}
                <div style={{ animation: mounted ? 'slideUp 1s ease-out 0.4s both' : 'none', marginBottom: 28 }}>
                    <div style={{
                        position: 'relative', borderRadius: 16, padding: '36px 28px 32px', overflow: 'hidden',
                        background: 'linear-gradient(160deg, rgba(15,5,10,0.95), rgba(5,2,8,0.98))',
                        border: '1px solid rgba(220,50,80,0.2)',
                        animation: 'borderGlow 4s ease-in-out infinite',
                    }}>
                        {/* Inner glow */}
                        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '80%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(220,50,80,0.4), transparent)' }} />
                        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '40%', height: '60px', background: 'radial-gradient(ellipse, rgba(220,50,80,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

                        {/* Discount badge */}
                        <div style={{ position: 'absolute', top: 14, right: 14, background: '#e03050', borderRadius: 4, padding: '3px 10px', fontFamily: 'Orbitron,sans-serif', fontSize: '0.35rem', color: '#fff', letterSpacing: '1.5px', fontWeight: 700 }}>-47%</div>

                        <div style={{ textAlign: 'center' }}>
                            {/* Old price struck */}
                            <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.18)', textDecoration: 'line-through', letterSpacing: '2px', marginBottom: 2 }}>&euro;55</div>
                            {/* New price */}
                            <div style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(2.6rem,9vw,4rem)', color: '#fff', fontWeight: 700, lineHeight: 1, marginBottom: 2, textShadow: '0 4px 30px rgba(220,50,80,0.2)' }}>
                                &euro;29
                            </div>
                            <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.34rem', color: 'rgba(220,50,80,0.6)', letterSpacing: '4px', marginBottom: 22 }}>ONE-TIME ACCESS</div>

                            {/* Divider with diamond */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 auto 20px', maxWidth: 260 }}>
                                <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(197,160,89,0.2))' }} />
                                <div style={{ width: 6, height: 6, transform: 'rotate(45deg)', background: 'rgba(197,160,89,0.3)', flexShrink: 0 }} />
                                <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(197,160,89,0.2), transparent)' }} />
                            </div>

                            {/* Coins bonus */}
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 8, padding: '10px 20px', animation: 'float 4s ease-in-out infinite' }}>
                                <div style={{ fontSize: '1.3rem' }}>&#x1FA99;</div>
                                <div>
                                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: '1.3rem', fontWeight: 700, color: '#c5a059', lineHeight: 1 }}>1,111</div>
                                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.28rem', color: 'rgba(197,160,89,0.45)', letterSpacing: '2.5px' }}>ROYAL SILVER INCLUDED</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── WHAT YOU GET ── */}
                <div style={{ animation: mounted ? 'slideUp 1s ease-out 0.5s both' : 'none', marginBottom: 32 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06))' }} />
                        <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.32rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '5px' }}>INCLUDED</span>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(255,255,255,0.06), transparent)' }} />
                    </div>
                    {[
                        { icon: '\u2709', text: 'Direct access to Queen Karin\'s private DMs' },
                        { icon: '\u2B50', text: 'Exclusive content drops & media wall' },
                        { icon: '\u2694', text: 'Personal task assignments & daily routine' },
                        { icon: '\u26A1', text: 'Challenges, competitions & live events' },
                        { icon: '\u265B', text: 'Full hierarchy progression — Hall Boy to Champion' },
                        { icon: '\u1FA99', text: '1,111 Royal Silver deposited instantly' },
                    ].map((item, i) => (
                        <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 14, padding: '11px 16px', marginBottom: 4,
                            background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                            borderRadius: 6,
                            animation: mounted ? `slideUp 0.6s ease-out ${0.6 + i * 0.08}s both` : 'none',
                        }}>
                            <div style={{ fontSize: '0.9rem', width: 24, textAlign: 'center', flexShrink: 0, filter: 'grayscale(0.5) brightness(0.8)' }}>{item.icon}</div>
                            <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}>{item.text}</div>
                        </div>
                    ))}
                </div>

                {/* ── CTA BUTTON ── */}
                <div style={{ animation: mounted ? 'slideUp 1s ease-out 0.7s both' : 'none', marginBottom: 16 }}>
                    <button className="tribute-cta" onClick={handleTribute} disabled={loading}
                        style={{
                            position: 'relative', overflow: 'hidden',
                            fontFamily: 'Cinzel,serif', fontSize: 'clamp(0.85rem,2.5vw,1.05rem)', fontWeight: 700, letterSpacing: '4px', textTransform: 'uppercase',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            padding: '22px 0', borderRadius: 10, border: 'none', width: '100%',
                            background: 'linear-gradient(135deg, #e03050 0%, #c01030 50%, #e03050 100%)',
                            backgroundSize: '200% auto',
                            color: '#fff', boxShadow: '0 6px 40px rgba(220,50,80,0.3)',
                            opacity: loading ? 0.6 : 1,
                            transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                        }}>
                        {/* Shine sweep */}
                        <div style={{ position: 'absolute', top: 0, left: '-100%', width: '60%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)', animation: 'ctaShine 3s ease-in-out infinite', pointerEvents: 'none' }} />
                        {loading ? 'PROCESSING...' : 'CLAIM YOUR SPOT — \u20AC29'}
                    </button>
                </div>

                {status && (
                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.4rem', color: '#e03050', letterSpacing: '2px', textAlign: 'center', marginBottom: 12 }}>{status}</div>
                )}

                {/* ── URGENCY ── */}
                <div style={{ textAlign: 'center', animation: mounted ? 'slideUp 1s ease-out 0.8s both' : 'none', marginBottom: 36 }}>
                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.28rem', color: 'rgba(220,50,80,0.35)', letterSpacing: '4px', marginBottom: 6 }}>
                        THIS PRICE WILL NOT BE OFFERED AGAIN
                    </div>
                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.65rem', color: 'rgba(255,255,255,0.18)' }}>
                        After 72 hours the fee returns to &euro;55
                    </div>
                </div>

                {/* ── FOOTER ── */}
                <div style={{ textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: 18 }}>
                    {userEmail && (
                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.3rem', color: 'rgba(255,255,255,0.1)', letterSpacing: '2px', marginBottom: 8 }}>{userEmail}</div>
                    )}
                    <button onClick={handleLogout}
                        style={{ background: 'none', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 4, fontFamily: 'Orbitron,sans-serif', fontSize: '0.3rem', color: 'rgba(255,255,255,0.1)', letterSpacing: '3px', padding: '6px 16px', cursor: 'pointer' }}>
                        LOGOUT
                    </button>
                </div>
            </div>
        </div>
    );
}
