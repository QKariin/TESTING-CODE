"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

const TIERS = [
    { id: 'trial',   price: '29',  period: '3 DAYS',  label: 'TRIAL',   desc: 'Test your devotion. Three days under Her key.', badge: null },
    { id: 'weekly',  price: '55',  period: '7 DAYS',  label: 'WEEKLY',  desc: 'A full week locked. Prove you are worthy of Her attention.', badge: 'POPULAR' },
    { id: 'monthly', price: '150', period: '30 DAYS', label: 'MONTHLY', desc: 'Complete surrender. One month under absolute control.', badge: 'BEST VALUE' },
];

const QUIZ_QUESTIONS = [
    {
        q: 'How experienced are you with chastity?',
        options: [
            { text: 'Completely new — never been locked', value: 'beginner' },
            { text: 'I\'ve tried it on my own before', value: 'intermediate' },
            { text: 'I\'ve had a keyholder before', value: 'advanced' },
        ],
    },
    {
        q: 'What draws you to keyholding?',
        options: [
            { text: 'Curiosity — I want to explore', value: 'curious' },
            { text: 'I need real accountability & control', value: 'accountability' },
            { text: 'Total power exchange — I want to be owned', value: 'tpe' },
        ],
    },
    {
        q: 'How long are you ready to stay locked?',
        options: [
            { text: 'A few days to start', value: 'short' },
            { text: 'A full week — I\'m serious', value: 'medium' },
            { text: 'A month or more — no limits', value: 'long' },
        ],
    },
];

function getRecommendation(answers: string[]): { tier: string; title: string; text: string } {
    const [exp, motive, duration] = answers;
    if (duration === 'long' || motive === 'tpe' || exp === 'advanced') {
        return { tier: 'monthly', title: 'FULL SURRENDER', text: 'You are ready for complete control. One month under Her lock — no excuses, no escape. This is what you need.' };
    }
    if (duration === 'medium' || motive === 'accountability' || exp === 'intermediate') {
        return { tier: 'weekly', title: 'WEEKLY LOCKDOWN', text: 'A full week under Her key. Daily check-ins, task assignments, and strict accountability. Prove you deserve Her attention.' };
    }
    return { tier: 'trial', title: 'FIRST LOCK', text: 'Three days to discover what real control feels like. Daily check-ins, kneeling hours, and a taste of surrender.' };
}

export default function KeyholderPage() {
    const [loading, setLoading] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [quizStep, setQuizStep] = useState(0); // 0,1,2 = questions, 3 = result
    const [answers, setAnswers] = useState<string[]>([]);

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

    const handleAnswer = (value: string) => {
        const next = [...answers, value];
        setAnswers(next);
        setQuizStep(quizStep + 1);
    };

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

    const recommendation = quizStep >= 3 ? getRecommendation(answers) : null;

    if (status === 'success') {
        return (
            <div style={{ background: '#020202', color: '#fff', minHeight: '100dvh', position: 'relative', overflow: 'hidden' }}>
                {/* Backgrounds */}
                <div style={{ position: 'fixed', inset: 0, backgroundImage: "url('/queen-bg-mobile.jpg')", backgroundSize: 'cover', backgroundPosition: 'center 20%', zIndex: 0, opacity: 0.5, filter: 'saturate(0.3)' }} />
                <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(2,2,2,0.75) 35%, rgba(2,2,2,0.95) 65%, #020202 100%)', zIndex: 0 }} />
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
                    <div style={{ textAlign: 'center', padding: 40 }}>
                        <div style={{ fontSize: '3rem', marginBottom: 16 }}>&#x1F512;</div>
                        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.8rem', color: '#c5a059', letterSpacing: 3, marginBottom: 12 }}>KEY ACCEPTED</h1>
                        <p style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1rem', color: 'rgba(255,255,255,0.5)', maxWidth: 340, margin: '0 auto 32px' }}>
                            Your key has been surrendered. Queen Karin now holds your lock. Await further instructions.
                        </p>
                        <a href="/profile" style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: '#c5a059', letterSpacing: 3, textDecoration: 'none', border: '1px solid rgba(197,160,89,0.4)', padding: '12px 32px', borderRadius: 4 }}>
                            ENTER THE HOUSE
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ background: '#020202', color: '#fff', minHeight: '100dvh', overflowX: 'hidden', position: 'relative' }}>
            <style>{`
                @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
                @keyframes slideUp { from { opacity:0; transform:translateY(40px); } to { opacity:1; transform:translateY(0); } }
                @keyframes slideDown { from { opacity:0; transform:translateY(-20px); } to { opacity:1; transform:translateY(0); } }
                @keyframes pulse2 { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
                @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
                @keyframes ringPulse { 0% { transform:scale(0.95); opacity:0.5; } 50% { transform:scale(1.05); opacity:1; } 100% { transform:scale(0.95); opacity:0.5; } }
                @keyframes scanline { 0% { transform:translateY(-100%); } 100% { transform:translateY(100vh); } }
                @keyframes lockFloat { 0%,100% { transform:translateY(0) rotate(0deg); } 50% { transform:translateY(-6px) rotate(-2deg); } }
                @keyframes borderGlow {
                    0%,100% { border-color: rgba(139,0,0,0.2); box-shadow: 0 0 30px rgba(139,0,0,0.08); }
                    50% { border-color: rgba(139,0,0,0.45); box-shadow: 0 0 50px rgba(139,0,0,0.15); }
                }
                @keyframes fadeSlideIn { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
                @keyframes ctaShine { 0% { left:-100%; } 50%,100% { left:100%; } }
                .kh-opt { transition: all 0.2s; cursor: pointer; }
                .kh-opt:hover { border-color: rgba(139,0,0,0.5) !important; background: rgba(139,0,0,0.08) !important; transform: translateY(-2px); }
                .kh-tier { transition: transform 0.2s, box-shadow 0.2s; cursor: pointer; }
                .kh-tier:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(139,0,0,0.2) !important; }
                .kh-tier:active { transform: scale(0.98); }
                .kh-btn { transition: all 0.2s; }
                .kh-btn:hover { background: #8b0000 !important; color: #fff !important; }
                .kh-btn:disabled { opacity: 0.5; cursor: wait; }
                .kh-cta { transition: transform 0.25s ease, box-shadow 0.25s ease; }
                .kh-cta:hover { transform: scale(1.03) !important; box-shadow: 0 8px 50px rgba(139,0,0,0.5) !important; }
                .kh-cta:active { transform: scale(0.98) !important; }
            `}</style>

            {/* ── LAYERED BACKGROUNDS (same as tribute) ── */}
            <div style={{ position: 'fixed', inset: 0, backgroundImage: "url('/queen-bg-mobile.jpg')", backgroundSize: 'cover', backgroundPosition: 'center 20%', zIndex: 0, opacity: 0.5, filter: 'saturate(0.3)' }} />
            <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(2,2,2,0.75) 35%, rgba(2,2,2,0.95) 65%, #020202 100%)', zIndex: 0 }} />
            <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '120vw', height: '50vh', background: 'radial-gradient(ellipse at center top, rgba(139,0,0,0.08) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100vw', height: '40vh', background: 'radial-gradient(ellipse at center bottom, rgba(197,160,89,0.04) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', zIndex: 0, pointerEvents: 'none', opacity: 0.03 }}>
                <div style={{ position: 'absolute', width: '100%', height: '2px', background: 'linear-gradient(90deg, transparent, rgba(139,0,0,0.8), transparent)', animation: 'scanline 8s linear infinite' }} />
            </div>
            <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.015, backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")', backgroundSize: '128px 128px' }} />

            {/* ── CONTENT ── */}
            <div style={{ position: 'relative', zIndex: 1, maxWidth: 560, margin: '0 auto', padding: 'clamp(40px,8vw,80px) clamp(20px,5vw,32px) 60px' }}>

                {/* ── HEADER ── */}
                <div style={{ textAlign: 'center', animation: mounted ? 'slideDown 0.6s ease-out both' : 'none', marginBottom: 24 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(139,0,0,0.06)', border: '1px solid rgba(139,0,0,0.25)', borderRadius: 100, padding: '5px 20px' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8b0000', animation: 'pulse2 1.5s infinite', boxShadow: '0 0 10px rgba(139,0,0,0.6)' }} />
                        <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.36rem', color: '#8b0000', letterSpacing: '4px' }}>KEYHOLDER SERVICE</span>
                    </div>
                </div>

                {/* ── LOCK ICON + TITLE ── */}
                <div style={{ textAlign: 'center', animation: mounted ? 'slideUp 0.8s ease-out 0.1s both' : 'none', marginBottom: 10 }}>
                    <div style={{ position: 'relative', width: 110, height: 110, margin: '0 auto 22px' }}>
                        <div style={{ position: 'absolute', inset: -6, borderRadius: '50%', border: '1.5px solid rgba(139,0,0,0.3)', animation: 'ringPulse 3s ease-in-out infinite' }} />
                        <div style={{ position: 'absolute', inset: -12, borderRadius: '50%', border: '1px solid rgba(139,0,0,0.1)', animation: 'ringPulse 3s ease-in-out infinite 0.5s' }} />
                        <img src="/queen-karin.png" alt="Queen Karin" style={{ width: 110, height: 110, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(197,160,89,0.4)', boxShadow: '0 0 40px rgba(0,0,0,0.8), 0 0 20px rgba(139,0,0,0.15)' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>

                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.32rem', color: 'rgba(197,160,89,0.35)', letterSpacing: '8px', marginBottom: 10 }}>QUEEN KARIN</div>
                    <h1 style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(1.6rem,5.5vw,2.6rem)', color: '#fff', letterSpacing: '3px', textTransform: 'uppercase', margin: '0 0 6px', fontWeight: 700, lineHeight: 1.1 }}>
                        KEYHOLDER
                    </h1>
                    <div style={{ width: 60, height: 1.5, background: 'linear-gradient(90deg, transparent, #8b0000, transparent)', margin: '14px auto 0' }} />
                </div>

                {/* ── INTRO TEXT ── */}
                <div style={{ textAlign: 'center', animation: mounted ? 'slideUp 1s ease-out 0.2s both' : 'none', marginBottom: 36 }}>
                    <p style={{ fontFamily: 'Cinzel,serif', fontSize: '0.88rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.85, maxWidth: 420, margin: '0 auto', fontStyle: 'italic' }}>
                        &ldquo;Surrender your key. Submit to real-time control. Your lock, My rules, My schedule.&rdquo;
                    </p>
                </div>

                {/* ── QUIZ OR RESULTS ── */}
                {quizStep < 3 ? (
                    <div key={quizStep} style={{ animation: 'fadeSlideIn 0.5s ease-out both' }}>
                        {/* Progress */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
                            {[0, 1, 2].map(i => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{
                                        width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontFamily: 'Orbitron,sans-serif', fontSize: '0.4rem', fontWeight: 700,
                                        background: i < quizStep ? 'rgba(139,0,0,0.3)' : i === quizStep ? 'rgba(139,0,0,0.15)' : 'rgba(255,255,255,0.03)',
                                        border: i === quizStep ? '1px solid rgba(139,0,0,0.5)' : '1px solid rgba(255,255,255,0.06)',
                                        color: i <= quizStep ? '#fff' : 'rgba(255,255,255,0.2)',
                                    }}>
                                        {i < quizStep ? '\u2713' : i + 1}
                                    </div>
                                    {i < 2 && <div style={{ width: 32, height: 1, background: i < quizStep ? 'rgba(139,0,0,0.3)' : 'rgba(255,255,255,0.06)' }} />}
                                </div>
                            ))}
                        </div>

                        {/* Question */}
                        <div style={{ textAlign: 'center', marginBottom: 20 }}>
                            <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.28rem', color: 'rgba(139,0,0,0.4)', letterSpacing: 4, marginBottom: 10 }}>QUESTION {quizStep + 1} OF 3</div>
                            <h2 style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(1rem,3.5vw,1.3rem)', color: 'rgba(255,255,255,0.8)', fontWeight: 400, lineHeight: 1.4 }}>
                                {QUIZ_QUESTIONS[quizStep].q}
                            </h2>
                        </div>

                        {/* Options */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {QUIZ_QUESTIONS[quizStep].options.map((opt, i) => (
                                <button key={i} className="kh-opt" onClick={() => handleAnswer(opt.value)} style={{
                                    display: 'block', width: '100%', textAlign: 'left', padding: '18px 20px',
                                    background: 'rgba(255,255,255,0.015)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    borderRadius: 10, color: 'rgba(255,255,255,0.65)',
                                    fontFamily: 'Rajdhani,sans-serif', fontSize: '0.95rem', lineHeight: 1.4,
                                    cursor: 'pointer',
                                }}>
                                    <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.32rem', color: 'rgba(139,0,0,0.4)', marginRight: 12, letterSpacing: 2 }}>{String.fromCharCode(65 + i)}</span>
                                    {opt.text}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : recommendation && (
                    <div style={{ animation: 'fadeSlideIn 0.6s ease-out both' }}>
                        {/* Recommendation card */}
                        <div style={{
                            position: 'relative', borderRadius: 16, padding: '36px 28px 32px', overflow: 'hidden', marginBottom: 28,
                            background: 'linear-gradient(160deg, rgba(15,5,10,0.95), rgba(5,2,8,0.98))',
                            border: '1px solid rgba(139,0,0,0.2)',
                            animation: 'borderGlow 4s ease-in-out infinite',
                        }}>
                            <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '80%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(139,0,0,0.4), transparent)' }} />

                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.28rem', color: 'rgba(139,0,0,0.5)', letterSpacing: 4, marginBottom: 10 }}>YOUR SENTENCE</div>
                                <h2 style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(1.4rem,5vw,2rem)', color: '#fff', letterSpacing: 3, marginBottom: 8, fontWeight: 700 }}>
                                    {recommendation.title}
                                </h2>
                                <div style={{ width: 40, height: 1.5, background: 'linear-gradient(90deg, transparent, rgba(139,0,0,0.6), transparent)', margin: '0 auto 16px' }} />
                                <p style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.95rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, maxWidth: 380, margin: '0 auto 24px' }}>
                                    {recommendation.text}
                                </p>

                                {/* Recommended tier price */}
                                {(() => {
                                    const t = TIERS.find(t => t.id === recommendation.tier)!;
                                    return (
                                        <>
                                            <div style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(2.4rem,8vw,3.6rem)', color: '#fff', fontWeight: 700, lineHeight: 1, marginBottom: 2, textShadow: '0 4px 30px rgba(139,0,0,0.2)' }}>
                                                &euro;{t.price}
                                            </div>
                                            <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.34rem', color: 'rgba(139,0,0,0.5)', letterSpacing: 4, marginBottom: 24 }}>{t.period}</div>
                                            <button className="kh-cta" onClick={() => handleCheckout(t.id)} disabled={!!loading}
                                                style={{
                                                    position: 'relative', overflow: 'hidden', width: '100%', padding: '20px 0',
                                                    background: 'linear-gradient(135deg, #8b0000 0%, #5a0000 50%, #8b0000 100%)', backgroundSize: '200% auto',
                                                    color: '#fff', border: 'none', borderRadius: 10, cursor: loading ? 'wait' : 'pointer',
                                                    fontFamily: 'Cinzel,serif', fontSize: 'clamp(0.8rem,2.5vw,1rem)', fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase',
                                                    boxShadow: '0 6px 40px rgba(139,0,0,0.3)', opacity: loading === t.id ? 0.6 : 1,
                                                }}>
                                                <div style={{ position: 'absolute', top: 0, left: '-100%', width: '60%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)', animation: 'ctaShine 3s ease-in-out infinite', pointerEvents: 'none' }} />
                                                {loading === t.id ? 'PROCESSING...' : 'SURRENDER YOUR KEY'}
                                            </button>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Divider */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 auto 20px', maxWidth: 300 }}>
                            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06))' }} />
                            <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.28rem', color: 'rgba(255,255,255,0.15)', letterSpacing: 4 }}>OR CHOOSE</span>
                            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(255,255,255,0.06), transparent)' }} />
                        </div>

                        {/* All tiers */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                            {TIERS.map(t => (
                                <div key={t.id} className="kh-tier" onClick={() => !loading && handleCheckout(t.id)} style={{
                                    position: 'relative',
                                    background: 'linear-gradient(170deg, rgba(10,8,10,0.95), rgba(5,3,5,0.98))',
                                    border: t.id === recommendation.tier ? '1px solid rgba(139,0,0,0.35)' : '1px solid rgba(255,255,255,0.06)',
                                    borderRadius: 12, padding: '22px 12px 20px', textAlign: 'center',
                                    opacity: t.id === recommendation.tier ? 1 : 0.6,
                                }}>
                                    {t.badge && (
                                        <div style={{ position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)', background: t.id === recommendation.tier ? '#8b0000' : 'rgba(139,0,0,0.15)', color: '#fff', fontFamily: 'Orbitron,sans-serif', fontSize: '0.24rem', letterSpacing: 2, padding: '2px 10px', borderRadius: 20, whiteSpace: 'nowrap', fontWeight: 700 }}>
                                            {t.id === recommendation.tier ? 'RECOMMENDED' : t.badge}
                                        </div>
                                    )}
                                    {!t.badge && t.id === recommendation.tier && (
                                        <div style={{ position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)', background: '#8b0000', color: '#fff', fontFamily: 'Orbitron,sans-serif', fontSize: '0.24rem', letterSpacing: 2, padding: '2px 10px', borderRadius: 20, whiteSpace: 'nowrap', fontWeight: 700 }}>
                                            RECOMMENDED
                                        </div>
                                    )}
                                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.28rem', color: 'rgba(197,160,89,0.4)', letterSpacing: 3, marginBottom: 8 }}>{t.label}</div>
                                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(1.4rem,5vw,2rem)', color: '#fff', fontWeight: 700, lineHeight: 1, marginBottom: 2 }}>
                                        &euro;{t.price}
                                    </div>
                                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.28rem', color: 'rgba(255,255,255,0.2)', letterSpacing: 3, marginBottom: 10 }}>{t.period}</div>
                                    <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', lineHeight: 1.4, marginBottom: 14, minHeight: 40 }}>{t.desc}</div>
                                    <button className="kh-btn" disabled={!!loading} style={{
                                        width: '100%', padding: '10px 0',
                                        background: t.id === recommendation.tier ? 'rgba(139,0,0,0.15)' : 'rgba(255,255,255,0.04)',
                                        color: t.id === recommendation.tier ? '#c5a059' : 'rgba(255,255,255,0.4)',
                                        border: t.id === recommendation.tier ? '1px solid rgba(139,0,0,0.4)' : '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: 6, fontFamily: 'Orbitron,sans-serif', fontSize: '0.34rem', letterSpacing: 3,
                                        cursor: loading ? 'wait' : 'pointer',
                                    }}>
                                        {loading === t.id ? 'PROCESSING...' : 'SELECT'}
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Retake */}
                        <div style={{ textAlign: 'center', marginTop: 20 }}>
                            <button onClick={() => { setQuizStep(0); setAnswers([]); }} style={{
                                background: 'none', border: 'none', fontFamily: 'Orbitron,sans-serif', fontSize: '0.3rem',
                                color: 'rgba(255,255,255,0.15)', letterSpacing: 3, cursor: 'pointer', padding: '8px 16px',
                            }}>
                                RETAKE QUIZ
                            </button>
                        </div>
                    </div>
                )}

                {/* ── WHAT'S INCLUDED (shown below quiz) ── */}
                <div style={{ marginTop: 48, animation: mounted ? 'slideUp 1s ease-out 0.5s both' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06))' }} />
                        <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.28rem', color: 'rgba(255,255,255,0.15)', letterSpacing: 5 }}>WHAT YOU GET</span>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(255,255,255,0.06), transparent)' }} />
                    </div>
                    {[
                        { icon: '\u1F512', text: 'Real keyholder — your lock code held by Queen Karin' },
                        { icon: '\u2709', text: 'Daily check-ins and progress reports required' },
                        { icon: '\u2694', text: 'Task assignments, kneeling hours, and routines' },
                        { icon: '\u26A1', text: 'Live monitoring — She decides when (and if) you unlock' },
                        { icon: '\u265B', text: 'Direct access to Queen Karin\'s private DMs' },
                        { icon: '\u2B50', text: 'Strict accountability — no self-unlocking allowed' },
                    ].map((item, i) => (
                        <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 14, padding: '11px 16px', marginBottom: 4,
                            background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent', borderRadius: 6,
                        }}>
                            <div style={{ fontSize: '0.9rem', width: 24, textAlign: 'center', flexShrink: 0, filter: 'grayscale(0.5) brightness(0.8)' }}>{item.icon}</div>
                            <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>{item.text}</div>
                        </div>
                    ))}
                </div>

                {/* ── BOTTOM QUOTE ── */}
                <div style={{ textAlign: 'center', marginTop: 40 }}>
                    <p style={{ fontFamily: 'Cinzel,serif', fontSize: '0.78rem', color: 'rgba(255,255,255,0.2)', fontStyle: 'italic', maxWidth: 380, margin: '0 auto', lineHeight: 1.7 }}>
                        &ldquo;Once you hand over the key, there is no going back. You will serve on My terms, on My schedule.&rdquo;
                    </p>
                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.28rem', color: 'rgba(197,160,89,0.2)', letterSpacing: 4, marginTop: 16 }}>QUEEN KARIN</div>
                </div>

                {status === 'cancelled' && (
                    <div style={{ textAlign: 'center', marginTop: 24, fontFamily: 'Rajdhani,sans-serif', fontSize: '0.85rem', color: 'rgba(255,100,100,0.6)' }}>
                        Payment cancelled. You may try again when ready.
                    </div>
                )}
                {status === 'error' && (
                    <div style={{ textAlign: 'center', marginTop: 24, fontFamily: 'Rajdhani,sans-serif', fontSize: '0.85rem', color: 'rgba(255,100,100,0.6)' }}>
                        Something went wrong. Please try again.
                    </div>
                )}

                {/* Footer */}
                <div style={{ textAlign: 'center', marginTop: 36, borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: 18 }}>
                    {userEmail && (
                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.3rem', color: 'rgba(255,255,255,0.1)', letterSpacing: '2px' }}>{userEmail}</div>
                    )}
                </div>
            </div>
        </div>
    );
}
