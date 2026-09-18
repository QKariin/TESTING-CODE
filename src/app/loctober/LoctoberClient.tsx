"use client";

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import PaymentModal from '@/components/PaymentModal';

const PRICE = 111;
const REGULAR = 199;

const FEATURES = [
    {
        num: '01',
        title: 'Live Lock Timer',
        text: 'A real countdown running inside the app. Days, hours, minutes. You see it every time you log in. I set the duration. You watch it tick. No way to skip it. No way to pause it.',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.5)" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    },
    {
        num: '02',
        title: 'Daily Video Tasks',
        text: 'Every single morning, a new task appears in your dashboard. I tell you what to film. You record it and submit through the app. Kneeling, confessions, proof. 31 days of it.',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.5)" strokeWidth="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>,
    },
    {
        num: '03',
        title: 'Personal Review by Me',
        text: 'I watch every submission. Not an algorithm. Not a chatbot. I personally review your task, approve it or reject it, and decide your fate for the next day.',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.5)" strokeWidth="1.5"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
    },
    {
        num: '04',
        title: 'Your Personal Dashboard',
        text: 'Streaks, completion rate, points, task history. Everything tracked in one place. You see exactly where you stand. I see exactly how obedient you have been.',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.5)" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
    },
    {
        num: '05',
        title: 'Penalty System',
        text: 'Miss a task? I add penalty days to your lock. Submit something lazy? Rejected. Do it again. Skip a day entirely? I decide if you even deserve to continue.',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.5)" strokeWidth="1.5"><path d="M12 9v2m0 4h.01M5.07 19H19a2 2 0 001.75-2.95L13.75 4.1a2 2 0 00-3.5 0L3.32 16.05A2 2 0 005.07 19z"/></svg>,
    },
    {
        num: '06',
        title: 'I Control Your Lock',
        text: 'This is not a self-managed timer you can reset when it gets hard. I hold the key inside the app. I add days. I remove days. Your release date is mine to decide.',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.5)" strokeWidth="1.5"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M12 3a4 4 0 00-4 4v4h8V7a4 4 0 00-4-4z"/></svg>,
    },
    {
        num: '07',
        title: 'Daily Chastity Check-in',
        text: 'Every morning, before anything else, you prove you are still locked. Photo proof submitted through the app. No check-in means no task. No task means penalty.',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.5)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>,
    },
    {
        num: '08',
        title: 'No Other Domme Has This',
        text: 'This is not a Lovense link. Not DMs on Instagram. This is custom-built keyholder software with a real dashboard, real tracking, and real control. I built it. Nobody else has it.',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.5)" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    },
];

export default function LoctoberClient() {
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [showPayment, setShowPayment] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [showSticky, setShowSticky] = useState(false);
    const [countdown, setCountdown] = useState({ d: 0, h: 0, m: 0, s: 0 });

    useEffect(() => { setMounted(true); }, []);

    // Auth
    useEffect(() => {
        (async () => {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (user?.email) setUserEmail(user.email);
            } catch {}
        })();
    }, []);

    // Auto-open payment from redirect
    useEffect(() => {
        if (userEmail && typeof window !== 'undefined') {
            const p = new URLSearchParams(window.location.search);
            if (p.get('pay') === '1') {
                window.history.replaceState({}, '', '/loctober');
                setShowPayment(true);
            }
        }
    }, [userEmail]);

    // Countdown to Monday
    useEffect(() => {
        const getTarget = () => {
            const now = new Date();
            let d = (8 - now.getDay()) % 7;
            if (d === 0) d = 7;
            const t = new Date(now);
            t.setDate(now.getDate() + d);
            t.setHours(0, 0, 0, 0);
            return t.getTime();
        };
        const tick = () => {
            const diff = Math.max(0, getTarget() - Date.now());
            setCountdown({
                d: Math.floor(diff / 86400000),
                h: Math.floor(diff / 3600000) % 24,
                m: Math.floor(diff / 60000) % 60,
                s: Math.floor(diff / 1000) % 60,
            });
        };
        tick();
        const iv = setInterval(tick, 1000);
        return () => clearInterval(iv);
    }, []);

    // Sticky header
    useEffect(() => {
        const fn = () => setShowSticky(window.scrollY > window.innerHeight * 0.75);
        window.addEventListener('scroll', fn, { passive: true });
        return () => window.removeEventListener('scroll', fn);
    }, []);

    // Scroll reveal
    useEffect(() => {
        const obs = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (e.isIntersecting) {
                    (e.target as HTMLElement).classList.add('loc-vis');
                    obs.unobserve(e.target);
                }
            });
        }, { threshold: 0.06 });
        const t = setTimeout(() => document.querySelectorAll('.loc-r').forEach((el) => obs.observe(el)), 150);
        return () => { clearTimeout(t); obs.disconnect(); };
    }, []);

    const handleCheckout = () => {
        if (!userEmail) {
            window.location.href = `https://throne.qkarin.com/login?redirect=${encodeURIComponent('/loctober?pay=1')}`;
            return;
        }
        setShowPayment(true);
    };

    const pad = (n: number) => String(n).padStart(2, '0');

    const s: Record<string, React.CSSProperties> = {
        section: { position: 'relative', marginLeft: 'calc(-1 * clamp(20px,5vw,40px))', marginRight: 'calc(-1 * clamp(20px,5vw,40px))', paddingLeft: 'clamp(20px,5vw,40px)', paddingRight: 'clamp(20px,5vw,40px)', borderTop: '1px solid rgba(197,160,89,0.04)', borderBottom: '1px solid rgba(197,160,89,0.04)', background: 'rgba(0,0,0,0.5)' },
        sectionAlt: { background: 'rgba(0,0,0,0.85)', borderTop: '1px solid rgba(197,160,89,0.08)', borderBottom: '1px solid rgba(197,160,89,0.08)' },
        h2: { fontFamily: 'Cinzel, serif', fontSize: 'clamp(1.4rem,4vw,2.2rem)', color: 'rgba(255,255,255,0.85)', fontWeight: 600, letterSpacing: 3, margin: '0 0 12px', textAlign: 'center' as const, lineHeight: 1.3 },
        sub: { fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 'clamp(0.95rem,2.5vw,1.15rem)', fontStyle: 'italic' as const, color: 'rgba(255,255,255,0.3)', textAlign: 'center' as const, marginBottom: 40, letterSpacing: 1 },
        body: { fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 'clamp(1.1rem,3vw,1.3rem)', fontWeight: 300, lineHeight: 1.9, color: 'rgba(255,255,255,0.5)', textAlign: 'center' as const, maxWidth: 520, margin: '0 auto' },
        gold: { color: '#d4af6a' },
        white: { color: 'rgba(255,255,255,0.9)', fontWeight: 400 },
        em: { fontStyle: 'italic' as const, color: 'rgba(232,201,122,0.7)' },
    };

    return (<>
        {/* ── FIXED BACKGROUNDS ── */}
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: -50, background: "url('https://ntrerrxudvgbjyscmdvh.supabase.co/storage/v1/object/public/media/promo/friday-hero-2.jpg') center 20%/cover no-repeat", filter: 'brightness(0.25) saturate(1.2)', opacity: 0.5 }} />
        </div>
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: -50, background: 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.95) 65%)' }} />
        </div>
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden', opacity: 0.02 }}>
            <div style={{ position: 'absolute', inset: -50, backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")', backgroundSize: '128px 128px' }} />
        </div>

        {/* ── STICKY HEADER ── */}
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px',
            background: 'rgba(4,4,6,0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(197,160,89,0.1)',
            transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1), opacity 0.4s ease',
            transform: showSticky ? 'translateY(0)' : 'translateY(-100%)',
            opacity: showSticky ? 1 : 0,
            pointerEvents: showSticky ? 'auto' : 'none',
        }}>
            <div>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.55rem', fontWeight: 600, letterSpacing: 5, color: 'rgba(197,160,89,0.5)', textTransform: 'uppercase' }}>LOCKTOBER</div>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', fontWeight: 700, color: '#d4af6a', letterSpacing: 1 }}>
                    &euro;{PRICE} <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.15)', textDecoration: 'line-through', marginLeft: 6 }}>&euro;{REGULAR}</span>
                </div>
            </div>
            <button onClick={handleCheckout} style={{
                padding: '10px 28px', background: 'linear-gradient(135deg, #c5a059, #a8884a)',
                color: '#050505', border: 'none', cursor: 'pointer',
                fontFamily: 'Cinzel, serif', fontSize: '0.5rem', fontWeight: 700,
                letterSpacing: 4, textTransform: 'uppercase',
            }}>Lock Up Now</button>
        </div>

        <style>{`
            html, body { overflow-x: hidden; background: #020202 !important; }
            @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Inter:wght@200;300;400;500&display=swap');
            @keyframes locFadeUp { from { opacity:0; transform:translateY(50px); } to { opacity:1; transform:translateY(0); } }
            @keyframes locFadeIn { from { opacity:0; } to { opacity:1; } }
            @keyframes locShimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
            @keyframes locFloat { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-8px); } }
            @keyframes locGlow { 0%,100% { text-shadow: 0 0 30px rgba(197,160,89,0.15); } 50% { text-shadow: 0 0 60px rgba(197,160,89,0.4); } }
            @keyframes locPulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
            @keyframes locRing { 0% { transform:scale(0.95); opacity:0.3; } 50% { transform:scale(1.06); opacity:0.7; } 100% { transform:scale(0.95); opacity:0.3; } }
            @keyframes locBorder { 0%,100% { border-color:rgba(197,160,89,0.08); box-shadow:0 0 30px rgba(197,160,89,0.03); } 50% { border-color:rgba(197,160,89,0.25); box-shadow:0 0 50px rgba(197,160,89,0.08); } }
            @keyframes locTicker { 0% { transform:translateX(0); } 100% { transform:translateX(-50%); } }
            @keyframes locCtaShine { 0% { left:-100%; } 50%,100% { left:100%; } }
            .loc-r { opacity:0; transform:translateY(30px); transition: opacity 0.8s cubic-bezier(0.16,1,0.3,1), transform 0.8s cubic-bezier(0.16,1,0.3,1); }
            .loc-vis { opacity:1; transform:translateY(0); }
            .loc-divider { width:100%; display:flex; align-items:center; gap:20px; padding:100px 0; }
            .loc-divider::before, .loc-divider::after { content:''; flex:1; height:1px; background:linear-gradient(90deg, transparent, rgba(197,160,89,0.2), rgba(197,160,89,0.05)); }
            .loc-divider::after { background:linear-gradient(90deg, rgba(197,160,89,0.05), rgba(197,160,89,0.2), transparent); }
            .loc-divider span { font-family:Cinzel,serif; font-size:0.6rem; color:rgba(197,160,89,0.4); letter-spacing:6px; white-space:nowrap; }
            .loc-feat-card { transition:all 0.3s cubic-bezier(0.16,1,0.3,1); }
            .loc-feat-card:hover { transform:translateY(-4px); border-color:rgba(197,160,89,0.2) !important; background:rgba(197,160,89,0.03) !important; }
            .loc-cta-btn { position:relative; overflow:hidden; transition:all 0.4s cubic-bezier(0.16,1,0.3,1); }
            .loc-cta-btn:hover { transform:scale(1.02); box-shadow:0 8px 60px rgba(197,160,89,0.25) !important; }
            .loc-cta-btn:active { transform:scale(0.98); }
            * { scrollbar-width:none; }
            *::-webkit-scrollbar { display:none; }
            @media (min-width: 769px) {
                .loc-container { max-width:1000px !important; padding-left:60px !important; padding-right:60px !important; }
                .loc-section-full { margin-left:calc(-50vw + 50%); margin-right:calc(-50vw + 50%); padding-left:calc(50vw - 50% + 60px); padding-right:calc(50vw - 50% + 60px); }
                .loc-features-grid { grid-template-columns:1fr 1fr !important; }
            }
        `}</style>

        <div style={{ position: 'relative', zIndex: 1, color: '#fff' }}>
            <div className="loc-container" style={{ position: 'relative', maxWidth: 700, margin: '0 auto', padding: '0 clamp(20px,5vw,32px) 80px' }}>

                {/* ════ HERO ════ */}
                <div style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', position: 'relative' }}>
                    <div style={{ animation: mounted ? 'locFadeIn 1.2s ease-out both' : 'none' }}>
                        {/* Lock icon with rings */}
                        <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 36px' }}>
                            <div style={{ position: 'absolute', inset: -12, borderRadius: '50%', border: '1px solid rgba(197,160,89,0.2)', animation: 'locRing 4s ease-in-out infinite' }} />
                            <div style={{ position: 'absolute', inset: -24, borderRadius: '50%', border: '1px solid rgba(197,160,89,0.1)', animation: 'locRing 4s ease-in-out infinite 0.7s' }} />
                            <div style={{ position: 'absolute', inset: -36, borderRadius: '50%', border: '1px solid rgba(197,160,89,0.05)', animation: 'locRing 4s ease-in-out infinite 1.4s' }} />
                            <div style={{ width: 120, height: 120, borderRadius: '50%', border: '1.5px solid rgba(197,160,89,0.3)', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 60px rgba(0,0,0,0.8), 0 0 30px rgba(197,160,89,0.1)' }}>
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#c5a059" strokeWidth="1.2" style={{ filter: 'drop-shadow(0 0 15px rgba(197,160,89,0.3))' }}>
                                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1" fill="#c5a059"/>
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div style={{ animation: mounted ? 'locFadeUp 1s ease-out 0.4s both' : 'none' }}>
                        <div style={{ display: 'inline-block', fontFamily: 'Cinzel, serif', fontSize: '0.5rem', fontWeight: 600, letterSpacing: 6, color: '#050505', background: 'linear-gradient(135deg, #d4af6a, #c5a059, #e8c97a, #c5a059)', backgroundSize: '300% 100%', animation: 'locShimmer 4s ease infinite', padding: '7px 24px', marginBottom: 24, textTransform: 'uppercase' }}>
                            Only 7 Spots
                        </div>

                        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(2.4rem,8vw,4rem)', color: '#fff', letterSpacing: 4, textTransform: 'uppercase', margin: '0 0 8px', fontWeight: 700, lineHeight: 1.05 }}>
                            LOCKTOBER
                        </h1>
                        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(1.3rem,4vw,1.8rem)', fontStyle: 'italic', color: '#d4af6a', fontWeight: 300, marginBottom: 20, letterSpacing: 2 }}>
                            I'm taking your October.
                        </div>
                        <div style={{ width: 80, height: 2, background: 'linear-gradient(90deg, transparent, rgba(197,160,89,0.5), transparent)', margin: '0 auto 20px' }} />
                        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 300, color: 'rgba(255,255,255,0.35)', letterSpacing: 2, marginBottom: 36 }}>
                            31 DAYS LOCKED. DAILY VIDEO TASKS. NO WAY OUT.
                        </div>

                        <button className="loc-cta-btn" onClick={handleCheckout} style={{
                            padding: '18px 56px', background: 'linear-gradient(135deg, #c5a059 0%, #a8884a 50%, #c5a059 100%)', backgroundSize: '200% auto',
                            color: '#050505', border: 'none', cursor: 'pointer',
                            fontFamily: 'Cinzel, serif', fontSize: '0.6rem', fontWeight: 700, letterSpacing: 5, textTransform: 'uppercase',
                            boxShadow: '0 4px 30px rgba(197,160,89,0.2)',
                        }}>
                            <div style={{ position: 'absolute', top: 0, left: '-100%', width: '60%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)', animation: 'locCtaShine 3s ease-in-out infinite', pointerEvents: 'none' }} />
                            LOCK UP FOR &euro;{PRICE}
                        </button>
                        <div style={{ marginTop: 12, fontFamily: 'Inter, sans-serif', fontSize: '0.6rem', color: 'rgba(197,160,89,0.3)', letterSpacing: 3 }}>
                            <span style={{ textDecoration: 'line-through', color: 'rgba(255,255,255,0.12)' }}>&euro;{REGULAR}</span> &nbsp; This weekend only
                        </div>
                    </div>

                    {/* Corner countdown */}
                    <div style={{ position: 'absolute', bottom: 30, right: 0, fontFamily: 'Cinzel,serif', fontSize: '0.55rem', color: 'rgba(197,160,89,0.25)', letterSpacing: 2, animation: mounted ? 'locFadeIn 1.5s ease-out 1.2s both' : 'none' }}>
                        {countdown.d}d {pad(countdown.h)}h {pad(countdown.m)}m
                    </div>
                </div>

                {/* ════ DIVIDER ════ */}
                <div className="loc-divider"><span>THE APP</span></div>

                {/* ════ INTRO ════ */}
                <div className="loc-r loc-section-full" style={{ ...s.section, paddingTop: 60, paddingBottom: 60 }}>
                    <h2 style={s.h2}>I built an entire app for this.</h2>
                    <div style={s.sub}>this is not what you think keyholding is.</div>
                    <div style={s.body}>
                        I'm not some girl who asks you to send a selfie and calls it "keyholding."<br/><br/>
                        I built a <strong style={s.white}>real keyholder application.</strong> A platform where I control your lock,
                        assign daily video tasks, review every submission personally,
                        and track your obedience across 31 days.<br/><br/>
                        This October, I'm taking <strong style={s.white}>7 men</strong> through the entire month.
                        Locked from day one. No breaks. No mercy. <span style={s.em}>No early release.</span>
                    </div>
                </div>

                {/* ════ DIVIDER ════ */}
                <div className="loc-divider"><span>HOW IT WORKS</span></div>

                {/* ════ FEATURES ════ */}
                <div className="loc-r" style={{ paddingBottom: 20 }}>
                    <h2 style={s.h2}>Every feature. Every function.</h2>
                    <div style={s.sub}>what happens inside the keyholder app for 31 days</div>
                </div>

                <div className="loc-features-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 0, maxWidth: 600, margin: '0 auto' }}>
                    {FEATURES.map((f, i) => (
                        <div key={i} className="loc-feat-card loc-r" style={{
                            display: 'flex', gap: 20, padding: '28px 0',
                            borderBottom: i < FEATURES.length - 1 ? '1px solid rgba(197,160,89,0.06)' : 'none',
                            transitionDelay: `${i * 0.05}s`,
                        }}>
                            <div style={{
                                flexShrink: 0, width: 48, height: 48, borderRadius: 4,
                                border: '1px solid rgba(197,160,89,0.15)', background: 'rgba(197,160,89,0.03)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <div style={{ width: 22, height: 22 }}>{f.icon}</div>
                            </div>
                            <div>
                                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '1rem', color: 'rgba(255,255,255,0.85)', fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>{f.title}</div>
                                <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '1rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, fontWeight: 300 }}>{f.text}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ════ CTA ════ */}
                <div className="loc-r" style={{ textAlign: 'center', paddingTop: 50 }}>
                    <button className="loc-cta-btn" onClick={handleCheckout} style={{
                        padding: '20px 60px', background: 'linear-gradient(135deg, #c5a059, #a8884a)',
                        color: '#050505', border: 'none', cursor: 'pointer',
                        fontFamily: 'Cinzel, serif', fontSize: '0.6rem', fontWeight: 700,
                        letterSpacing: 5, textTransform: 'uppercase',
                        boxShadow: '0 4px 30px rgba(197,160,89,0.2)',
                    }}>
                        <div style={{ position: 'absolute', top: 0, left: '-100%', width: '60%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)', animation: 'locCtaShine 3s ease-in-out infinite', pointerEvents: 'none' }} />
                        Claim Your Spot
                    </button>
                    <div style={{ marginTop: 12, fontFamily: 'Inter,sans-serif', fontSize: '0.6rem', color: 'rgba(197,160,89,0.3)', letterSpacing: 3 }}>
                        &euro;{PRICE} this weekend. &euro;{REGULAR} after Monday.
                    </div>
                </div>

                {/* ════ DIVIDER ════ */}
                <div className="loc-divider"><span>PRICING</span></div>

                {/* ════ PRICE + COUNTDOWN ════ */}
                <div className="loc-r loc-section-full" style={{ ...s.section, ...s.sectionAlt, paddingTop: 70, paddingBottom: 70 }}>
                    <div style={{ textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
                        <div style={{ display: 'inline-block', fontFamily: 'Inter, sans-serif', fontSize: '0.45rem', fontWeight: 500, letterSpacing: 5, color: '#050505', background: 'linear-gradient(135deg, #d4af6a, #c5a059, #e8c97a, #c5a059)', backgroundSize: '300% 100%', animation: 'locShimmer 4s ease infinite', padding: '5px 16px', marginBottom: 28, textTransform: 'uppercase' }}>
                            This Weekend Only
                        </div>

                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 14, marginBottom: 10 }}>
                            <span style={{ fontFamily: 'Inter,sans-serif', fontSize: '1.3rem', fontWeight: 300, color: 'rgba(197,160,89,0.5)', alignSelf: 'flex-start', marginTop: 14 }}>&euro;</span>
                            <span style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(4rem,12vw,5.5rem)', fontWeight: 700, lineHeight: 1, letterSpacing: -2, color: '#d4af6a', animation: 'locGlow 5s ease infinite' }}>{PRICE}</span>
                            <span style={{ fontFamily: 'Cinzel,serif', fontSize: '1.6rem', fontWeight: 400, color: 'rgba(255,255,255,0.1)', textDecoration: 'line-through', textDecorationColor: 'rgba(197,160,89,0.3)' }}>&euro;{REGULAR}</span>
                        </div>

                        <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '1.05rem', fontStyle: 'italic', fontWeight: 300, color: 'rgba(255,255,255,0.3)', marginBottom: 20 }}>
                            31 days of real control. Daily tasks. Personal review. Full app access.
                        </div>

                        <div style={{ display: 'inline-block', fontFamily: 'Cinzel,serif', fontSize: '0.5rem', fontWeight: 600, letterSpacing: 4, color: 'rgba(197,160,89,0.8)', border: '1px solid rgba(197,160,89,0.2)', padding: '8px 20px', marginBottom: 36, textTransform: 'uppercase' }}>
                            Save &euro;{REGULAR - PRICE}
                        </div>

                        {/* Countdown */}
                        <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.5rem', fontWeight: 600, letterSpacing: 5, color: 'rgba(197,160,89,0.35)', marginBottom: 16, textTransform: 'uppercase' }}>
                            Price rises in
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(12px,4vw,28px)' }}>
                            {[
                                { v: pad(countdown.d), l: 'Days' },
                                { v: pad(countdown.h), l: 'Hours' },
                                { v: pad(countdown.m), l: 'Min' },
                                { v: pad(countdown.s), l: 'Sec' },
                            ].map((u) => (
                                <div key={u.l} style={{ textAlign: 'center' }}>
                                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(2rem,6vw,2.8rem)', fontWeight: 700, color: '#d4af6a', lineHeight: 1, animation: 'locGlow 4s ease infinite' }}>{u.v}</div>
                                    <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.45rem', fontWeight: 400, letterSpacing: 4, color: 'rgba(197,160,89,0.3)', marginTop: 6, textTransform: 'uppercase' }}>{u.l}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ════ DIVIDER ════ */}
                <div className="loc-divider"><span>7 SPOTS</span></div>

                {/* ════ SPOTS ════ */}
                <div className="loc-r" style={{ textAlign: 'center', paddingBottom: 20 }}>
                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(5rem,18vw,8rem)', fontWeight: 700, lineHeight: 1, letterSpacing: -4, background: 'linear-gradient(180deg, rgba(212,175,106,0.6) 0%, rgba(197,160,89,0.06) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', animation: 'locFloat 4s ease infinite' }}>7</div>
                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.65rem', fontWeight: 600, letterSpacing: 8, color: 'rgba(197,160,89,0.4)', marginTop: 4, textTransform: 'uppercase' }}>Spots Available</div>
                    <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '1rem', fontStyle: 'italic', fontWeight: 300, color: 'rgba(255,255,255,0.2)', marginTop: 16, lineHeight: 1.7 }}>
                        Once I have my 7, enrollment closes. No waitlist. No exceptions.
                    </div>
                </div>

                {/* ════ CTA ════ */}
                <div className="loc-r" style={{ textAlign: 'center', paddingTop: 30 }}>
                    <button className="loc-cta-btn" onClick={handleCheckout} style={{
                        padding: '20px 60px', background: 'linear-gradient(135deg, #c5a059, #a8884a)',
                        color: '#050505', border: 'none', cursor: 'pointer',
                        fontFamily: 'Cinzel, serif', fontSize: '0.6rem', fontWeight: 700,
                        letterSpacing: 5, textTransform: 'uppercase',
                        boxShadow: '0 4px 30px rgba(197,160,89,0.2)',
                    }}>
                        <div style={{ position: 'absolute', top: 0, left: '-100%', width: '60%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)', animation: 'locCtaShine 3s ease-in-out infinite', pointerEvents: 'none' }} />
                        Give Me Your October
                    </button>
                </div>

                {/* ════ DIVIDER ════ */}
                <div className="loc-divider"><span>LISTEN</span></div>

                {/* ════ QUEEN QUOTE ════ */}
                <div className="loc-r loc-section-full" style={{ ...s.section, ...s.sectionAlt, paddingTop: 70, paddingBottom: 70, position: 'relative', animation: 'locBorder 5s ease infinite' }}>
                    <div style={{ textAlign: 'center', maxWidth: 500, margin: '0 auto', position: 'relative', zIndex: 1 }}>
                        <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.7rem', fontWeight: 600, letterSpacing: 8, color: '#d4af6a', marginBottom: 28, textTransform: 'uppercase' }}>From the Queen</div>
                        <div style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 'clamp(1.2rem,3.5vw,1.5rem)', fontStyle: 'italic', fontWeight: 300, lineHeight: 1.85, color: 'rgba(255,255,255,0.4)' }}>
                            You have thought about Locktober every single year.
                            And every single year, you did <strong style={s.white}>nothing.</strong><br/><br/>
                            You scrolled past it. You told yourself you would try it
                            <strong style={s.white}> next time.</strong> You spent October the same way
                            you spent September. Unlocked. Alone. Unchanged.<br/><br/>
                            This year, I am offering you something different.
                            A real app. A real keyholder. A real 31-day program
                            with daily tasks, personal review, and zero way out.<br/><br/>
                            <strong style={{ color: '#d4af6a', fontWeight: 400 }}>7 spots. This price disappears Monday.</strong>
                        </div>
                        <div style={{ marginTop: 28, fontFamily: 'Inter,sans-serif', fontSize: '0.5rem', fontWeight: 300, letterSpacing: 5, color: 'rgba(197,160,89,0.4)', textTransform: 'uppercase' }}>Karin</div>
                    </div>
                </div>

                {/* ════ FINAL CTA ════ */}
                <div className="loc-r" style={{ textAlign: 'center', paddingTop: 80, paddingBottom: 20 }}>
                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(1.4rem,4vw,2rem)', fontWeight: 600, letterSpacing: 3, color: 'rgba(255,255,255,0.8)', marginBottom: 10 }}>
                        October 1st.
                    </div>
                    <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '1.1rem', fontStyle: 'italic', fontWeight: 300, color: 'rgba(255,255,255,0.3)', marginBottom: 36 }}>
                        Your lock starts. Your excuses end.
                    </div>
                    <button className="loc-cta-btn" onClick={handleCheckout} style={{
                        padding: '22px 64px', background: 'linear-gradient(135deg, #c5a059 0%, #a8884a 50%, #c5a059 100%)', backgroundSize: '200% auto',
                        color: '#050505', border: 'none', cursor: 'pointer',
                        fontFamily: 'Cinzel, serif', fontSize: '0.65rem', fontWeight: 700,
                        letterSpacing: 6, textTransform: 'uppercase',
                        boxShadow: '0 4px 40px rgba(197,160,89,0.25)',
                    }}>
                        <div style={{ position: 'absolute', top: 0, left: '-100%', width: '60%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)', animation: 'locCtaShine 3s ease-in-out infinite', pointerEvents: 'none' }} />
                        Lock Up for &euro;{PRICE}
                    </button>
                    <div style={{ marginTop: 14, fontFamily: 'Inter,sans-serif', fontSize: '0.55rem', color: 'rgba(197,160,89,0.25)', letterSpacing: 3, animation: 'locPulse 3s ease infinite' }}>
                        7 spots. &euro;{PRICE} this weekend. Starts Oct 1st.
                    </div>
                </div>

                {/* ════ FOOTER ════ */}
                <div style={{ marginTop: 80, borderTop: '1px solid rgba(197,160,89,0.06)', paddingTop: 40, textAlign: 'center', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)', width: 200, height: 1, background: 'linear-gradient(90deg, transparent, rgba(197,160,89,0.2), transparent)' }} />
                    <div style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: '1rem', fontWeight: 600, letterSpacing: 8, color: 'rgba(255,255,255,0.08)', marginBottom: 10 }}>QUEEN KARIN</div>
                    <a href="https://throne.qkarin.com" target="_blank" rel="noopener" style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.06)', textDecoration: 'none', letterSpacing: 3 }}>throne.qkarin.com</a>
                </div>

            </div>
        </div>

        {/* ── PAYMENT MODAL ── */}
        {showPayment && (
            <PaymentModal
                amountEur={PRICE}
                label="LOCKTOBER PROGRAM"
                cardBody={{ memberId: userEmail || '', amount: PRICE }}
                cryptoApiPath="/api/keyholder/passimpay"
                cryptoStatusApiPath="/api/keyholder/passimpay-status"
                cryptoPayBody={{ tierId: 'loctober' }}
                cryptoStatusBody={{ tierId: 'loctober' }}
                confirmMessage="PAYMENT CONFIRMED. SEE YOU OCTOBER 1ST."
                throneUrl="https://throne.com/queenkarin"
                onSuccess={() => { window.location.href = '/profile'; }}
                onClose={() => setShowPayment(false)}
            />
        )}
    </>);
}
