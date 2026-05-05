"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

const TIERS = [
    { id: 'trial',   price: '29',  period: '3 DAYS',  label: 'TRIAL',   desc: 'Test your devotion. Three days under Her key.', badge: null },
    { id: 'weekly',  price: '55',  period: '7 DAYS',  label: 'WEEKLY',  desc: 'A full week locked. Prove you are worthy of Her attention.', badge: 'POPULAR' },
    { id: 'monthly', price: '150', period: '30 DAYS', label: 'MONTHLY', desc: 'Complete surrender. One month under absolute control.', badge: 'BEST VALUE' },
];

export default function KeyholderPage() {
    const [loading, setLoading] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
        const params = new URLSearchParams(window.location.search);
        if (params.get('status') === 'success') setStatus('success');
        if (params.get('status') === 'cancelled') setStatus('cancelled');

        const init = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/login?redirect=/keyholder';
                return;
            }
            setUserEmail(user.email || 'locked');
        };
        init();
    }, []);

    const handleCheckout = async (tierId: string) => {
        setLoading(tierId);
        try {
            const res = await fetch('/api/stripe/keyholder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tierId }),
            });
            const data = await res.json();
            if (data.url) window.location.href = data.url;
            else { setStatus('error'); setLoading(null); }
        } catch {
            setStatus('error');
            setLoading(null);
        }
    };

    if (status === 'success') {
        return (
            <div style={{ background: '#020202', color: '#fff', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cinzel, serif' }}>
                <div style={{ textAlign: 'center', padding: 40 }}>
                    <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔒</div>
                    <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.8rem', color: '#c5a059', letterSpacing: 3, marginBottom: 12 }}>KEY ACCEPTED</h1>
                    <p style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1rem', color: 'rgba(255,255,255,0.5)', maxWidth: 340, margin: '0 auto 32px' }}>
                        Your key has been surrendered. Queen Karin now holds your lock. Await further instructions.
                    </p>
                    <a href="/profile" style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: '#c5a059', letterSpacing: 3, textDecoration: 'none', border: '1px solid rgba(197,160,89,0.4)', padding: '12px 32px', borderRadius: 4 }}>
                        ENTER THE HOUSE
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div style={{ background: '#020202', color: '#fff', minHeight: '100dvh', overflowX: 'hidden', position: 'relative' }}>
            <style>{`
                @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
                @keyframes slideUp { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }
                @keyframes pulse2 { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
                @keyframes lockFloat { 0%,100% { transform:translateY(0) rotate(0deg); } 50% { transform:translateY(-6px) rotate(-2deg); } }
                @keyframes borderGlow {
                    0%,100% { border-color: rgba(197,160,89,0.15); box-shadow: 0 0 20px rgba(197,160,89,0.05); }
                    50% { border-color: rgba(197,160,89,0.4); box-shadow: 0 0 40px rgba(197,160,89,0.1); }
                }
                @keyframes chainDrift {
                    0% { background-position: 0% 0%; }
                    100% { background-position: 100% 100%; }
                }
                .kh-tier { transition: transform 0.2s, box-shadow 0.2s; cursor: pointer; }
                .kh-tier:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(197,160,89,0.15) !important; }
                .kh-tier:active { transform: scale(0.98); }
                .kh-btn { transition: all 0.2s; }
                .kh-btn:hover { background: #c5a059 !important; color: #000 !important; }
                .kh-btn:disabled { opacity: 0.5; cursor: wait; }
            `}</style>

            {/* Backgrounds */}
            <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(197,160,89,0.04) 0%, transparent 60%)', zIndex: 0, pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at 50% 100%, rgba(139,0,0,0.03) 0%, transparent 50%)', zIndex: 0, pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.012, backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")', backgroundSize: '128px 128px' }} />

            {/* Content */}
            <div style={{ position: 'relative', zIndex: 1, maxWidth: 640, margin: '0 auto', padding: 'clamp(40px,8vw,80px) clamp(16px,4vw,32px) 60px' }}>

                {/* Lock icon */}
                <div style={{ textAlign: 'center', animation: mounted ? 'slideUp 0.6s ease-out both' : 'none', marginBottom: 20 }}>
                    <div style={{ display: 'inline-block', animation: 'lockFloat 4s ease-in-out infinite' }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            <circle cx="12" cy="16" r="1" fill="rgba(197,160,89,0.6)"/>
                        </svg>
                    </div>
                </div>

                {/* Title */}
                <div style={{ textAlign: 'center', animation: mounted ? 'slideUp 0.7s ease-out 0.1s both' : 'none', marginBottom: 8 }}>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.32rem', color: 'rgba(197,160,89,0.3)', letterSpacing: 8, marginBottom: 12 }}>QUEEN KARIN</div>
                    <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(1.8rem,6vw,3rem)', color: '#fff', letterSpacing: 4, textTransform: 'uppercase', margin: '0 0 4px', fontWeight: 700, lineHeight: 1.1 }}>
                        KEYHOLDER
                    </h1>
                    <div style={{ width: 50, height: 1.5, background: 'linear-gradient(90deg, transparent, #c5a059, transparent)', margin: '14px auto' }} />
                    <p style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.95rem', color: 'rgba(255,255,255,0.35)', maxWidth: 380, margin: '0 auto', lineHeight: 1.6 }}>
                        Surrender your key. Submit to real-time control.<br/>Your lock, Her rules, Her schedule.
                    </p>
                </div>

                {/* How it works */}
                <div style={{ animation: mounted ? 'slideUp 0.8s ease-out 0.2s both' : 'none', margin: '36px 0 40px' }}>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.3rem', color: 'rgba(197,160,89,0.25)', letterSpacing: 5, textAlign: 'center', marginBottom: 20 }}>HOW IT WORKS</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                        {[
                            { step: '01', title: 'LOCK', text: 'Secure your device and surrender the key digitally.' },
                            { step: '02', title: 'OBEY', text: 'Complete daily tasks, routines, and kneeling hours.' },
                            { step: '03', title: 'EARN', text: 'Prove devotion to earn unlock consideration.' },
                        ].map(s => (
                            <div key={s.step} style={{ textAlign: 'center', padding: '20px 10px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8 }}>
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: 'rgba(197,160,89,0.3)', marginBottom: 8 }}>{s.step}</div>
                                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', color: '#c5a059', letterSpacing: 2, marginBottom: 6 }}>{s.title}</div>
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', lineHeight: 1.4 }}>{s.text}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Pricing tiers */}
                <div style={{ animation: mounted ? 'slideUp 0.9s ease-out 0.3s both' : 'none' }}>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.3rem', color: 'rgba(197,160,89,0.25)', letterSpacing: 5, textAlign: 'center', marginBottom: 20 }}>SELECT YOUR SENTENCE</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                        {TIERS.map((t, i) => (
                            <div key={t.id} className="kh-tier" onClick={() => !loading && handleCheckout(t.id)} style={{
                                position: 'relative',
                                background: 'linear-gradient(170deg, rgba(10,8,10,0.95), rgba(5,3,5,0.98))',
                                border: t.id === 'weekly' ? '1px solid rgba(197,160,89,0.35)' : '1px solid rgba(255,255,255,0.06)',
                                borderRadius: 12,
                                padding: '28px 16px 24px',
                                textAlign: 'center',
                                animation: t.id === 'weekly' ? 'borderGlow 4s ease-in-out infinite' : 'none',
                            }}>
                                {t.badge && (
                                    <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: t.id === 'weekly' ? '#c5a059' : 'rgba(197,160,89,0.15)', color: t.id === 'weekly' ? '#000' : '#c5a059', fontFamily: 'Orbitron, sans-serif', fontSize: '0.28rem', letterSpacing: 2, padding: '3px 12px', borderRadius: 20, whiteSpace: 'nowrap', fontWeight: 700 }}>
                                        {t.badge}
                                    </div>
                                )}
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.32rem', color: 'rgba(197,160,89,0.4)', letterSpacing: 3, marginBottom: 12 }}>{t.label}</div>
                                <div style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(2rem,6vw,2.8rem)', color: '#fff', fontWeight: 700, lineHeight: 1, marginBottom: 2 }}>
                                    &euro;{t.price}
                                </div>
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.34rem', color: 'rgba(255,255,255,0.25)', letterSpacing: 3, marginBottom: 14 }}>{t.period}</div>
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', lineHeight: 1.4, marginBottom: 20, minHeight: 50 }}>{t.desc}</div>
                                <button
                                    className="kh-btn"
                                    disabled={!!loading}
                                    style={{
                                        width: '100%',
                                        padding: '12px 0',
                                        background: t.id === 'weekly' ? 'rgba(197,160,89,0.15)' : 'rgba(255,255,255,0.04)',
                                        color: t.id === 'weekly' ? '#c5a059' : 'rgba(255,255,255,0.5)',
                                        border: t.id === 'weekly' ? '1px solid rgba(197,160,89,0.4)' : '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: 6,
                                        fontFamily: 'Orbitron, sans-serif',
                                        fontSize: '0.4rem',
                                        letterSpacing: 3,
                                        cursor: loading ? 'wait' : 'pointer',
                                    }}
                                >
                                    {loading === t.id ? 'PROCESSING...' : 'SURRENDER KEY'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom text */}
                <div style={{ textAlign: 'center', marginTop: 40, animation: mounted ? 'slideUp 1s ease-out 0.4s both' : 'none' }}>
                    <p style={{ fontFamily: 'Cinzel, serif', fontSize: '0.78rem', color: 'rgba(255,255,255,0.2)', fontStyle: 'italic', maxWidth: 380, margin: '0 auto', lineHeight: 1.7 }}>
                        &ldquo;Once you hand over the key, there is no going back. You will serve on My terms, on My schedule.&rdquo;
                    </p>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.28rem', color: 'rgba(197,160,89,0.2)', letterSpacing: 4, marginTop: 16 }}>QUEEN KARIN</div>
                </div>

                {status === 'cancelled' && (
                    <div style={{ textAlign: 'center', marginTop: 24, fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', color: 'rgba(255,100,100,0.6)' }}>
                        Payment cancelled. You may try again when ready.
                    </div>
                )}
                {status === 'error' && (
                    <div style={{ textAlign: 'center', marginTop: 24, fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', color: 'rgba(255,100,100,0.6)' }}>
                        Something went wrong. Please try again.
                    </div>
                )}
            </div>
        </div>
    );
}
