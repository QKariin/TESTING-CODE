"use client";

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function TributePage() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0 });
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // 72h countdown — ends 72h after deploy (May 5, 2026 00:00 UTC)
    const PROMO_END = new Date('2026-05-05T00:00:00Z').getTime();

    useEffect(() => {
        const init = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { window.location.href = '/login'; return; }
            const display = user.email
                || (user.user_metadata?.user_name ? `@${user.user_metadata.user_name}` : null)
                || 'Unknown';
            setUserEmail(display);
            try {
                const res = await fetch('/api/auth/link-profile', { method: 'POST' });
                await res.json();
            } catch {}
        };
        init();
    }, []);

    useEffect(() => {
        const tick = () => {
            const diff = Math.max(0, PROMO_END - Date.now());
            setTimeLeft({
                h: Math.floor(diff / 3600000),
                m: Math.floor((diff % 3600000) / 60000),
                s: Math.floor((diff % 60000) / 1000),
            });
        };
        tick();
        timerRef.current = setInterval(tick, 1000);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, []);

    const handleTribute = async () => {
        setLoading(true);
        setStatus(null);
        try {
            const res = await fetch('/api/stripe/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'entrance_tribute' }),
            });
            const data = await res.json();
            if (data.url) window.location.href = data.url;
            else setStatus('Something went wrong. Try again.');
        } catch { setStatus('Connection error. Try again.'); }
        finally { setLoading(false); }
    };

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    const pad = (n: number) => String(n).padStart(2, '0');

    return (
        <div style={{ background: '#020512', color: '#fff', minHeight: '100dvh', overflowX: 'hidden' }}>
            {/* Fixed background */}
            <div style={{ position: 'fixed', inset: 0, backgroundImage: "url('/queen-bg-mobile.jpg')", backgroundSize: 'cover', backgroundPosition: 'center top', opacity: 0.6, zIndex: 0, pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(180deg, rgba(2,5,18,0.3) 0%, rgba(2,5,18,0.7) 40%, rgba(2,5,18,0.95) 100%)', zIndex: 0, pointerEvents: 'none' }} />

            <style>{`
                @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
                @keyframes glow { 0%,100% { box-shadow: 0 0 20px rgba(220,50,80,0.3), 0 0 60px rgba(220,50,80,0.1); } 50% { box-shadow: 0 0 30px rgba(220,50,80,0.5), 0 0 80px rgba(220,50,80,0.2); } }
                @keyframes slideUp { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }
                @keyframes countPulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.02); } }
            `}</style>

            <div style={{ position: 'relative', zIndex: 1, maxWidth: 520, margin: '0 auto', padding: 'clamp(60px,10vw,100px) clamp(20px,5vw,36px) 80px', textAlign: 'center' }}>

                {/* PROMO BADGE */}
                <div style={{ animation: 'slideUp 0.6s ease-out', marginBottom: 20 }}>
                    <div style={{ display: 'inline-block', background: 'rgba(220,50,80,0.12)', border: '1px solid rgba(220,50,80,0.4)', borderRadius: 4, padding: '6px 18px', fontFamily: 'Orbitron,sans-serif', fontSize: '0.42rem', color: '#e03050', letterSpacing: '4px', animation: 'pulse 2s infinite' }}>
                        LIMITED TIME ONLY
                    </div>
                </div>

                {/* COUNTDOWN */}
                <div style={{ animation: 'slideUp 0.8s ease-out', marginBottom: 36 }}>
                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.35rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '4px', marginBottom: 12 }}>OFFER EXPIRES IN</div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 12, animation: 'countPulse 2s infinite' }}>
                        {[
                            { val: pad(timeLeft.h), label: 'HRS' },
                            { val: pad(timeLeft.m), label: 'MIN' },
                            { val: pad(timeLeft.s), label: 'SEC' },
                        ].map(t => (
                            <div key={t.label} style={{ background: 'rgba(220,50,80,0.06)', border: '1px solid rgba(220,50,80,0.2)', borderRadius: 6, padding: '12px 16px', minWidth: 70 }}>
                                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '1.6rem', color: '#e03050', fontWeight: 700, lineHeight: 1 }}>{t.val}</div>
                                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.3rem', color: 'rgba(220,50,80,0.5)', letterSpacing: '3px', marginTop: 4 }}>{t.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* MAIN TITLE */}
                <div style={{ animation: 'slideUp 1s ease-out', marginBottom: 12 }}>
                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.7rem', color: 'rgba(197,160,89,0.3)', letterSpacing: '10px', marginBottom: 14 }}>QUEEN KARIN</div>
                    <h1 style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(1.8rem,6vw,2.8rem)', color: '#fff', letterSpacing: '4px', textTransform: 'uppercase', margin: '0 0 8px', fontWeight: 700, lineHeight: 1.15 }}>
                        FULL HOUSE<br/>
                        <span style={{ color: '#e03050' }}>OPEN CALL</span>
                    </h1>
                    <div style={{ width: 80, height: 2, background: 'linear-gradient(90deg, transparent, #e03050, transparent)', margin: '16px auto 20px' }} />
                </div>

                {/* SUBTITLE */}
                <div style={{ animation: 'slideUp 1.2s ease-out', marginBottom: 40 }}>
                    <p style={{ fontFamily: 'Cinzel,serif', fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, maxWidth: 420, margin: '0 auto' }}>
                        I am looking for committed subjects to fill the House. This is the first and only time I am offering a discount. Do not waste it.
                    </p>
                </div>

                {/* PRICE CARD */}
                <div style={{ animation: 'slideUp 1.4s ease-out, glow 3s infinite', marginBottom: 36 }}>
                    <div style={{ background: 'linear-gradient(160deg, rgba(220,50,80,0.06), rgba(2,5,18,0.95))', border: '1px solid rgba(220,50,80,0.25)', borderRadius: 12, padding: '32px 24px', position: 'relative', overflow: 'hidden' }}>
                        {/* Strike-through old price */}
                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.2)', textDecoration: 'line-through', letterSpacing: '2px', marginBottom: 4 }}>
                            &euro;55.00
                        </div>
                        {/* New price */}
                        <div style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(2.4rem,8vw,3.6rem)', color: '#fff', fontWeight: 700, lineHeight: 1, marginBottom: 4 }}>
                            &euro;29
                        </div>
                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.38rem', color: 'rgba(220,50,80,0.7)', letterSpacing: '3px', marginBottom: 18 }}>
                            ONE-TIME ACCESS FEE
                        </div>

                        {/* Divider */}
                        <div style={{ width: '60%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(220,50,80,0.3), transparent)', margin: '0 auto 18px' }} />

                        {/* Bonus coins */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
                            <i className="fas fa-coins" style={{ fontSize: '1.1rem', color: '#c5a059' }}></i>
                            <span style={{ fontFamily: 'Cinzel,serif', fontSize: '1.4rem', fontWeight: 700, color: '#c5a059' }}>1,111</span>
                            <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.35rem', color: 'rgba(197,160,89,0.5)', letterSpacing: '2px' }}>ROYAL SILVER INCLUDED</span>
                        </div>
                    </div>
                </div>

                {/* WHAT YOU GET */}
                <div style={{ animation: 'slideUp 1.6s ease-out', marginBottom: 36, textAlign: 'left' }}>
                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.38rem', color: 'rgba(255,255,255,0.25)', letterSpacing: '4px', marginBottom: 14, textAlign: 'center' }}>WHAT YOU GET</div>
                    {[
                        'Direct access to Queen Karin\'s private DMs',
                        'Exclusive content drops & media wall',
                        'Task assignments tailored to you',
                        'Daily challenges & competitions',
                        'Full hierarchy progression system',
                        '1,111 Royal Silver to start your journey',
                    ].map((item, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: i < 5 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#e03050', marginTop: 6, flexShrink: 0, boxShadow: '0 0 8px rgba(220,50,80,0.4)' }} />
                            <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{item}</div>
                        </div>
                    ))}
                </div>

                {/* CTA BUTTON */}
                <div style={{ animation: 'slideUp 1.8s ease-out', marginBottom: 20 }}>
                    <button onClick={handleTribute} disabled={loading}
                        style={{
                            fontFamily: 'Cinzel,serif', fontSize: '1rem', fontWeight: 700, letterSpacing: '4px', textTransform: 'uppercase',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            padding: '20px 0', borderRadius: 8, border: 'none', width: '100%',
                            background: 'linear-gradient(135deg, #e03050, #a01030)',
                            color: '#fff', boxShadow: '0 4px 30px rgba(220,50,80,0.35)',
                            opacity: loading ? 0.6 : 1,
                            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        }}
                        onMouseEnter={e => { if (!loading) { (e.target as HTMLElement).style.transform = 'scale(1.02)'; (e.target as HTMLElement).style.boxShadow = '0 6px 40px rgba(220,50,80,0.5)'; } }}
                        onMouseLeave={e => { (e.target as HTMLElement).style.transform = ''; (e.target as HTMLElement).style.boxShadow = '0 4px 30px rgba(220,50,80,0.35)'; }}>
                        {loading ? 'PROCESSING...' : 'CLAIM YOUR SPOT — \u20AC29'}
                    </button>
                </div>

                {status && (
                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.42rem', color: '#e03050', letterSpacing: '2px', marginBottom: 16 }}>{status}</div>
                )}

                {/* URGENCY LINE */}
                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.32rem', color: 'rgba(220,50,80,0.4)', letterSpacing: '3px', marginBottom: 40 }}>
                    THIS PRICE WILL NOT BE OFFERED AGAIN
                </div>

                {/* BOTTOM */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 20 }}>
                    {userEmail && (
                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.35rem', color: 'rgba(255,255,255,0.15)', letterSpacing: '2px', marginBottom: 10 }}>{userEmail}</div>
                    )}
                    <button onClick={handleLogout}
                        style={{ background: 'none', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 4, fontFamily: 'Orbitron,sans-serif', fontSize: '0.35rem', color: 'rgba(255,255,255,0.15)', letterSpacing: '3px', padding: '8px 20px', cursor: 'pointer' }}>
                        LOGOUT
                    </button>
                </div>
            </div>
        </div>
    );
}
