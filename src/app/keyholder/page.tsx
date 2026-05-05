"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

const TIERS = [
    { id: 'trial',   price: '29',  period: '3 DAYS',  label: 'TRIAL',   desc: 'Test your devotion. Three days under Her key.', badge: null },
    { id: 'weekly',  price: '55',  period: '7 DAYS',  label: 'WEEKLY',  desc: 'A full week locked. Prove you are worthy of Her attention.', badge: 'POPULAR' },
    { id: 'monthly', price: '150', period: '30 DAYS', label: 'MONTHLY', desc: 'Complete surrender. One month under absolute control.', badge: 'BEST VALUE' },
];

const QUIZ = [
    {
        q: 'Your experience with chastity?',
        opts: [
            { text: 'Never been locked', sub: 'Curious & ready to explore', value: 'beginner', icon: '?' },
            { text: 'Self-locked before', sub: 'Know the feeling, need real control', value: 'intermediate', icon: '\u26BF' },
            { text: 'Had a keyholder', sub: 'Ready for the real thing', value: 'advanced', icon: '\u2620' },
        ],
    },
    {
        q: 'What are you looking for?',
        opts: [
            { text: 'Explore & discover', sub: 'See if this is for me', value: 'curious', icon: '\u2736' },
            { text: 'Accountability', sub: 'I need someone to hold me to it', value: 'accountability', icon: '\u26D3' },
            { text: 'Total power exchange', sub: 'Complete control, no questions', value: 'tpe', icon: '\u2694' },
        ],
    },
    {
        q: 'How long can you handle?',
        opts: [
            { text: 'A few days', sub: 'Dip my toes in', value: 'short', icon: '3' },
            { text: 'One full week', sub: 'I\'m serious about this', value: 'medium', icon: '7' },
            { text: 'A month or more', sub: 'No limits. Lock me down.', value: 'long', icon: '30' },
        ],
    },
];

function getRecommendation(answers: string[]): { tier: string; title: string; text: string } {
    const [exp, motive, duration] = answers;
    if (duration === 'long' || motive === 'tpe' || exp === 'advanced') {
        return { tier: 'monthly', title: 'FULL SURRENDER', text: 'You are ready for complete control. One month under Her lock — no excuses, no escape.' };
    }
    if (duration === 'medium' || motive === 'accountability' || exp === 'intermediate') {
        return { tier: 'weekly', title: 'WEEKLY LOCKDOWN', text: 'A full week under Her key. Daily check-ins, strict accountability, real consequences.' };
    }
    return { tier: 'trial', title: 'FIRST LOCK', text: 'Three days to discover what real control feels like. Check-ins, kneeling hours, total obedience.' };
}

export default function KeyholderPage() {
    const [loading, setLoading] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [step, setStep] = useState(0);
    const [answers, setAnswers] = useState<string[]>([]);

    useEffect(() => {
        setMounted(true);
        const params = new URLSearchParams(window.location.search);
        if (params.get('status') === 'success') setStatus('success');
        if (params.get('status') === 'cancelled') setStatus('cancelled');
        const init = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { window.location.href = '/login?redirect=/keyholder'; return; }
            setUserEmail(user.email || 'locked');
        };
        init();
    }, []);

    const pick = (v: string) => { setAnswers([...answers, v]); setStep(step + 1); };

    const handleCheckout = async (tierId: string) => {
        setLoading(tierId);
        try {
            const res = await fetch('/api/stripe/keyholder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tierId }) });
            const data = await res.json();
            if (data.url) window.location.href = data.url;
            else { setStatus('error'); setLoading(null); }
        } catch { setStatus('error'); setLoading(null); }
    };

    const rec = step >= 3 ? getRecommendation(answers) : null;

    /* ── SUCCESS STATE ── */
    if (status === 'success') {
        return (
            <div style={{ background: '#020202', color: '#fff', minHeight: '100dvh', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'fixed', inset: 0, backgroundImage: "url('/queen-bg-mobile.jpg')", backgroundSize: 'cover', backgroundPosition: 'center 20%', zIndex: 0, opacity: 0.5, filter: 'saturate(0.3)' }} />
                <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(2,2,2,0.75) 35%, rgba(2,2,2,0.95) 65%, #020202 100%)', zIndex: 0 }} />
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
                    <div style={{ textAlign: 'center', padding: 40 }}>
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#c5a059" strokeWidth="1.2" style={{ marginBottom: 20, filter: 'drop-shadow(0 0 20px rgba(197,160,89,0.4))' }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1" fill="#c5a059"/></svg>
                        <h1 style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(1.6rem,5vw,2.4rem)', color: '#c5a059', letterSpacing: 4, marginBottom: 14 }}>KEY ACCEPTED</h1>
                        <p style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '1rem', color: 'rgba(255,255,255,0.45)', maxWidth: 360, margin: '0 auto 36px', lineHeight: 1.6 }}>
                            Your key has been surrendered. Queen Karin now holds your lock. Await further instructions.
                        </p>
                        <a href="/profile" style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.65rem', color: '#c5a059', letterSpacing: 4, textDecoration: 'none', border: '1px solid rgba(197,160,89,0.3)', padding: '14px 40px', borderRadius: 2 }}>ENTER THE HOUSE</a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ background: '#020202', color: '#fff', minHeight: '100dvh', overflowX: 'hidden', position: 'relative' }}>
            <style>{`
                @keyframes fadeIn { from{opacity:0} to{opacity:1} }
                @keyframes slideUp { from{opacity:0;transform:translateY(40px)} to{opacity:1;transform:translateY(0)} }
                @keyframes slideDown { from{opacity:0;transform:translateY(-20px)} to{opacity:1;transform:translateY(0)} }
                @keyframes pulse2 { 0%,100%{opacity:1} 50%{opacity:0.4} }
                @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
                @keyframes ringPulse { 0%{transform:scale(0.95);opacity:0.5} 50%{transform:scale(1.05);opacity:1} 100%{transform:scale(0.95);opacity:0.5} }
                @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
                @keyframes borderGlow {
                    0%,100% { border-color:rgba(139,0,0,0.15); box-shadow:0 0 30px rgba(139,0,0,0.06); }
                    50% { border-color:rgba(139,0,0,0.4); box-shadow:0 0 50px rgba(139,0,0,0.12); }
                }
                @keyframes fadeSlide { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
                @keyframes ctaShine { 0%{left:-100%} 50%,100%{left:100%} }
                @keyframes glowPulse { 0%,100%{box-shadow:0 0 20px rgba(139,0,0,0.1)} 50%{box-shadow:0 0 40px rgba(139,0,0,0.25)} }
                .qz-card {
                    transition: all 0.25s cubic-bezier(0.4,0,0.2,1); cursor:pointer; position:relative; overflow:hidden;
                }
                .qz-card::before {
                    content:''; position:absolute; inset:0; opacity:0; transition:opacity 0.25s;
                    background:linear-gradient(135deg, rgba(139,0,0,0.1), transparent 60%);
                }
                .qz-card:hover { border-color:rgba(139,0,0,0.5) !important; transform:translateY(-3px) scale(1.01); }
                .qz-card:hover::before { opacity:1; }
                .qz-card:active { transform:scale(0.98); }
                .tier-card { transition:all 0.25s; cursor:pointer; }
                .tier-card:hover { transform:translateY(-6px); box-shadow:0 16px 50px rgba(139,0,0,0.2) !important; border-color:rgba(139,0,0,0.4) !important; }
                .tier-btn { transition:all 0.2s; }
                .tier-btn:hover { background:linear-gradient(135deg,#8b0000,#5a0000) !important; color:#fff !important; border-color:#8b0000 !important; }
                .tier-btn:disabled { opacity:0.5; cursor:wait; }
                .cta-main { transition:transform 0.25s, box-shadow 0.25s; }
                .cta-main:hover { transform:scale(1.02) !important; box-shadow:0 8px 60px rgba(139,0,0,0.5) !important; }
                .cta-main:active { transform:scale(0.98) !important; }
            `}</style>

            {/* ── BACKGROUNDS (tribute-style) ── */}
            <div style={{ position: 'fixed', inset: 0, backgroundImage: "url('/queen-bg-mobile.jpg')", backgroundSize: 'cover', backgroundPosition: 'center 20%', zIndex: 0, opacity: 0.5, filter: 'saturate(0.3)' }} />
            <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(2,2,2,0.7) 30%, rgba(2,2,2,0.92) 55%, #020202 100%)', zIndex: 0 }} />
            <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '120vw', height: '50vh', background: 'radial-gradient(ellipse at center top, rgba(139,0,0,0.08) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100vw', height: '40vh', background: 'radial-gradient(ellipse at center bottom, rgba(197,160,89,0.04) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', zIndex: 0, pointerEvents: 'none', opacity: 0.03 }}>
                <div style={{ position: 'absolute', width: '100%', height: '2px', background: 'linear-gradient(90deg, transparent, rgba(139,0,0,0.8), transparent)', animation: 'scanline 8s linear infinite' }} />
            </div>
            <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.015, backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")', backgroundSize: '128px 128px' }} />

            {/* ── CONTENT ── */}
            <div style={{ position: 'relative', zIndex: 1, maxWidth: 900, margin: '0 auto', padding: 'clamp(36px,6vw,72px) clamp(20px,4vw,48px) 60px' }}>

                {/* ── HERO ── */}
                <div style={{ textAlign: 'center', animation: mounted ? 'slideUp 0.8s ease-out both' : 'none', marginBottom: 48 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 28, background: 'rgba(139,0,0,0.06)', border: '1px solid rgba(139,0,0,0.2)', borderRadius: 2, padding: '6px 24px' }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#8b0000', animation: 'pulse2 1.5s infinite', boxShadow: '0 0 8px rgba(139,0,0,0.6)' }} />
                        <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.38rem', color: '#8b0000', letterSpacing: 5 }}>KEYHOLDER</span>
                    </div>

                    <h1 style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(2.2rem,6vw,3.8rem)', color: '#fff', letterSpacing: 6, textTransform: 'uppercase', margin: '0 0 8px', fontWeight: 700, lineHeight: 1.05 }}>
                        SURRENDER<br/>YOUR KEY
                    </h1>
                    <div style={{ width: 80, height: 2, background: 'linear-gradient(90deg, transparent, #8b0000, transparent)', margin: '16px auto' }} />
                    <p style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '1.1rem', color: 'rgba(255,255,255,0.35)', maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
                        Professional chastity keyholding by Queen Karin. Real-time control, daily check-ins, strict accountability. Your lock, Her rules.
                    </p>
                </div>

                {/* ── QUIZ ── */}
                {step < 3 ? (
                    <div key={step} style={{ animation: 'fadeSlide 0.45s ease-out both' }}>
                        {/* Progress bar */}
                        <div style={{ maxWidth: 400, margin: '0 auto 32px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.3rem', color: 'rgba(139,0,0,0.5)', letterSpacing: 3 }}>STEP {step + 1} / 3</span>
                                <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.3rem', color: 'rgba(255,255,255,0.12)', letterSpacing: 2 }}>{Math.round(((step + 1) / 3) * 100)}%</span>
                            </div>
                            <div style={{ height: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 1 }}>
                                <div style={{ height: '100%', width: `${((step + 1) / 3) * 100}%`, background: 'linear-gradient(90deg, #8b0000, #c41020)', borderRadius: 1, transition: 'width 0.4s ease' }} />
                            </div>
                        </div>

                        {/* Question */}
                        <h2 style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(1.2rem,3.5vw,1.8rem)', color: 'rgba(255,255,255,0.85)', fontWeight: 400, textAlign: 'center', marginBottom: 32, letterSpacing: 2 }}>
                            {QUIZ[step].q}
                        </h2>

                        {/* Options — horizontal cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                            {QUIZ[step].opts.map((o, i) => (
                                <div key={i} className="qz-card" onClick={() => pick(o.value)} style={{
                                    background: 'linear-gradient(170deg, rgba(15,8,12,0.9), rgba(5,2,5,0.95))',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    borderRadius: 4, padding: 'clamp(24px,3vw,36px) clamp(16px,2vw,24px)', textAlign: 'center',
                                }}>
                                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: 'clamp(1.4rem,3vw,2rem)', color: 'rgba(139,0,0,0.4)', marginBottom: 14, lineHeight: 1 }}>{o.icon}</div>
                                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(0.8rem,1.8vw,1rem)', color: '#fff', letterSpacing: 1, marginBottom: 6, fontWeight: 700 }}>{o.text}</div>
                                    <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 'clamp(0.72rem,1.5vw,0.85rem)', color: 'rgba(255,255,255,0.3)', lineHeight: 1.4 }}>{o.sub}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : rec && (
                    <div style={{ animation: 'fadeSlide 0.5s ease-out both' }}>

                        {/* ── RESULT: Full-width recommendation ── */}
                        <div style={{
                            position: 'relative', borderRadius: 4, overflow: 'hidden', marginBottom: 40,
                            background: 'linear-gradient(160deg, rgba(20,8,14,0.95), rgba(5,2,5,0.98))',
                            border: '1px solid rgba(139,0,0,0.2)', animation: 'borderGlow 4s ease-in-out infinite',
                        }}>
                            {/* Top accent line */}
                            <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, #8b0000, transparent)' }} />

                            <div style={{ padding: 'clamp(32px,5vw,56px) clamp(24px,4vw,48px)', display: 'grid', gridTemplateColumns: '1fr auto', gap: 'clamp(24px,4vw,48px)', alignItems: 'center' }}>
                                {/* Left: text */}
                                <div>
                                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.32rem', color: 'rgba(139,0,0,0.5)', letterSpacing: 5, marginBottom: 10 }}>YOUR SENTENCE</div>
                                    <h2 style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(1.6rem,4vw,2.6rem)', color: '#fff', letterSpacing: 4, marginBottom: 12, fontWeight: 700, lineHeight: 1.1 }}>
                                        {rec.title}
                                    </h2>
                                    <p style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '1rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, maxWidth: 420, marginBottom: 28 }}>
                                        {rec.text}
                                    </p>
                                    <button className="cta-main" onClick={() => handleCheckout(rec.tier)} disabled={!!loading}
                                        style={{
                                            position: 'relative', overflow: 'hidden', padding: '18px 48px',
                                            background: 'linear-gradient(135deg, #8b0000 0%, #5a0000 50%, #8b0000 100%)', backgroundSize: '200% auto',
                                            color: '#fff', border: 'none', borderRadius: 2, cursor: loading ? 'wait' : 'pointer',
                                            fontFamily: 'Orbitron,sans-serif', fontSize: '0.5rem', letterSpacing: 5, textTransform: 'uppercase',
                                            boxShadow: '0 4px 30px rgba(139,0,0,0.3)', opacity: loading === rec.tier ? 0.6 : 1,
                                        }}>
                                        <div style={{ position: 'absolute', top: 0, left: '-100%', width: '60%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)', animation: 'ctaShine 3s ease-in-out infinite', pointerEvents: 'none' }} />
                                        {loading === rec.tier ? 'PROCESSING...' : 'SURRENDER KEY'}
                                    </button>
                                </div>

                                {/* Right: price */}
                                <div style={{ textAlign: 'center', minWidth: 140 }}>
                                    {(() => { const t = TIERS.find(x => x.id === rec.tier)!; return (
                                        <>
                                            <div style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(3rem,8vw,4.5rem)', color: '#fff', fontWeight: 700, lineHeight: 1, textShadow: '0 4px 40px rgba(139,0,0,0.2)' }}>&euro;{t.price}</div>
                                            <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.4rem', color: 'rgba(139,0,0,0.45)', letterSpacing: 5, marginTop: 4 }}>{t.period}</div>
                                        </>
                                    ); })()}
                                </div>
                            </div>
                        </div>

                        {/* ── OTHER TIERS ── */}
                        <div style={{ marginBottom: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                                <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06))' }} />
                                <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.3rem', color: 'rgba(255,255,255,0.12)', letterSpacing: 5 }}>ALL OPTIONS</span>
                                <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(255,255,255,0.06), transparent)' }} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                                {TIERS.map(t => {
                                    const isRec = t.id === rec.tier;
                                    return (
                                    <div key={t.id} className="tier-card" onClick={() => !loading && handleCheckout(t.id)} style={{
                                        position: 'relative',
                                        background: isRec ? 'linear-gradient(170deg, rgba(20,8,14,0.95), rgba(8,2,6,0.98))' : 'linear-gradient(170deg, rgba(12,10,12,0.9), rgba(5,3,5,0.95))',
                                        border: isRec ? '1px solid rgba(139,0,0,0.3)' : '1px solid rgba(255,255,255,0.05)',
                                        borderRadius: 4, padding: 'clamp(24px,3vw,32px) clamp(16px,2vw,24px)', textAlign: 'center',
                                        animation: isRec ? 'glowPulse 4s ease-in-out infinite' : 'none',
                                    }}>
                                        {(t.badge || isRec) && (
                                            <div style={{
                                                position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%,-50%)',
                                                background: isRec ? '#8b0000' : 'rgba(139,0,0,0.12)',
                                                color: isRec ? '#fff' : 'rgba(139,0,0,0.6)',
                                                fontFamily: 'Orbitron,sans-serif', fontSize: '0.26rem', letterSpacing: 3,
                                                padding: '3px 14px', borderRadius: 2, whiteSpace: 'nowrap', fontWeight: 700,
                                            }}>
                                                {isRec ? 'RECOMMENDED' : t.badge}
                                            </div>
                                        )}

                                        {/* Top accent */}
                                        {isRec && <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(139,0,0,0.4), transparent)' }} />}

                                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.32rem', color: isRec ? 'rgba(139,0,0,0.5)' : 'rgba(197,160,89,0.3)', letterSpacing: 4, marginBottom: 12 }}>{t.label}</div>
                                        <div style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(1.8rem,5vw,2.6rem)', color: '#fff', fontWeight: 700, lineHeight: 1, marginBottom: 4 }}>&euro;{t.price}</div>
                                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.3rem', color: 'rgba(255,255,255,0.2)', letterSpacing: 4, marginBottom: 16 }}>{t.period}</div>
                                        <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.82rem', color: 'rgba(255,255,255,0.28)', lineHeight: 1.5, marginBottom: 20, minHeight: 44 }}>{t.desc}</div>
                                        <button className="tier-btn" disabled={!!loading} style={{
                                            width: '100%', padding: '12px 0',
                                            background: isRec ? 'rgba(139,0,0,0.12)' : 'rgba(255,255,255,0.03)',
                                            color: isRec ? '#fff' : 'rgba(255,255,255,0.35)',
                                            border: isRec ? '1px solid rgba(139,0,0,0.3)' : '1px solid rgba(255,255,255,0.06)',
                                            borderRadius: 2, fontFamily: 'Orbitron,sans-serif', fontSize: '0.38rem', letterSpacing: 4,
                                            cursor: loading ? 'wait' : 'pointer',
                                        }}>
                                            {loading === t.id ? 'PROCESSING...' : 'SELECT'}
                                        </button>
                                    </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div style={{ textAlign: 'center', marginTop: 12 }}>
                            <button onClick={() => { setStep(0); setAnswers([]); }} style={{
                                background: 'none', border: 'none', fontFamily: 'Orbitron,sans-serif', fontSize: '0.3rem',
                                color: 'rgba(255,255,255,0.12)', letterSpacing: 4, cursor: 'pointer', padding: '8px 16px',
                            }}>RETAKE QUIZ</button>
                        </div>
                    </div>
                )}

                {/* ── WHAT'S INCLUDED ── */}
                <div style={{ marginTop: 56, animation: mounted ? 'slideUp 1s ease-out 0.4s both' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06))' }} />
                        <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.3rem', color: 'rgba(255,255,255,0.12)', letterSpacing: 5 }}>WHAT YOU GET</span>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(255,255,255,0.06), transparent)' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                        {[
                            { title: 'REAL KEYHOLDER', text: 'Your lock code held by Queen Karin. No self-unlocking.', icon: '\u26BF' },
                            { title: 'DAILY CHECK-INS', text: 'Morning and evening reports. Missed check-in = consequences.', icon: '\u2709' },
                            { title: 'TASK CONTROL', text: 'Assignments, kneeling hours, routines on Her schedule.', icon: '\u2694' },
                            { title: 'LIVE MONITORING', text: 'She decides when and if you unlock. Real-time control.', icon: '\u26A1' },
                            { title: 'PRIVATE ACCESS', text: 'Direct DMs with Queen Karin. Personal attention.', icon: '\u265B' },
                            { title: 'STRICT RULES', text: 'Break a rule, extend your lock. No mercy, no exceptions.', icon: '\u2620' },
                        ].map((item, i) => (
                            <div key={i} style={{
                                padding: '22px 20px', background: 'rgba(255,255,255,0.01)',
                                border: '1px solid rgba(255,255,255,0.03)', borderRadius: 4,
                            }}>
                                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '1.1rem', color: 'rgba(139,0,0,0.3)', marginBottom: 10 }}>{item.icon}</div>
                                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.32rem', color: 'rgba(197,160,89,0.4)', letterSpacing: 3, marginBottom: 6 }}>{item.title}</div>
                                <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.82rem', color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>{item.text}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── BOTTOM QUOTE ── */}
                <div style={{ textAlign: 'center', marginTop: 56 }}>
                    <p style={{ fontFamily: 'Cinzel,serif', fontSize: '0.88rem', color: 'rgba(255,255,255,0.18)', fontStyle: 'italic', maxWidth: 460, margin: '0 auto', lineHeight: 1.8 }}>
                        &ldquo;Once you hand over the key, there is no going back. You will serve on My terms, on My schedule.&rdquo;
                    </p>
                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.3rem', color: 'rgba(197,160,89,0.15)', letterSpacing: 5, marginTop: 16 }}>QUEEN KARIN</div>
                </div>

                {status === 'cancelled' && (
                    <div style={{ textAlign: 'center', marginTop: 24, fontFamily: 'Rajdhani,sans-serif', fontSize: '0.9rem', color: 'rgba(255,100,100,0.5)' }}>Payment cancelled. You may try again when ready.</div>
                )}
                {status === 'error' && (
                    <div style={{ textAlign: 'center', marginTop: 24, fontFamily: 'Rajdhani,sans-serif', fontSize: '0.9rem', color: 'rgba(255,100,100,0.5)' }}>Something went wrong. Please try again.</div>
                )}

                {/* Footer */}
                <div style={{ textAlign: 'center', marginTop: 40, borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: 18 }}>
                    {userEmail && <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.28rem', color: 'rgba(255,255,255,0.08)', letterSpacing: 2 }}>{userEmail}</div>}
                </div>
            </div>
        </div>
    );
}
