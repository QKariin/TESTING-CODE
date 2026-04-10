"use client";

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';

const HIERARCHY = [
    { title: "HallBoy", icon: "🧹", points: "0+", status: "First line of service.", protocol: "Perform basic tasks.", duties: "Prove you live to serve.", contact: "15MIN DAILY SLOT", locked: false },
    { title: "Footman", icon: "🚶‍♂️", points: "2,000+", status: "Time to earn your place.", protocol: "Serve quickly and reliably.", duties: "Perfect Timing.", contact: "30MIN DAILY SLOT", locked: true },
    { title: "Silverman", icon: "🍴", points: "5,000+", status: "Skilled and polished sub.", protocol: "Focus on improvement.", duties: "Face all challenges.", contact: "30MIN DAILY SLOT", locked: true },
    { title: "Butler", icon: "🍷", points: "10,000+", status: "Mastered consistency.", protocol: "Notice needs without being told.", duties: "Devotion is foundation.", contact: "DAILY 2×30MIN SLOTS", locked: true },
    { title: "Chamberlain", icon: "🏰", points: "20,000+", status: "Act with excellence.", protocol: "Carry yourself with dignity.", duties: "Uphold standards.", contact: "UNLIMITED", locked: true },
    { title: "Secretary", icon: "📜", points: "50,000+", status: "Inner Circle.", protocol: "Respect and safeguard.", duties: "Authority on smaller matters.", contact: "UNLIMITED", locked: true },
    { title: "Queen's Champion", icon: "⚔️", points: "100,000+", status: "You have made it!", protocol: "2 bodies, 1 soul!", duties: "Enjoy the love you earned.", contact: "LEGENDARY", locked: true },
];

const TRACKED = [
    { label: "Tasks Completed", icon: "✓", desc: "Every task assigned, executed, and graded." },
    { label: "Kneeling Sessions", icon: "⬇", desc: "Daily worship sessions — time and frequency." },
    { label: "Tribute History", icon: "◈", desc: "Full financial devotion record." },
    { label: "Locked Time", icon: "⏱", desc: "Total time spent under lock and control." },
    { label: "Consistency Score", icon: "◉", desc: "Your reliability and daily commitment level." },
    { label: "Daily Routine", icon: "📋", desc: "Morning and evening routine upload history." },
];

// Easing
const easeOutBack = (t: number) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const SCROLL_RANGE = 500; // px of extra scroll for the pinned section
// Items start appearing almost immediately, each 0.15 apart
const itemStart = (i: number) => 0.02 + i * 0.15;
const itemEnd   = (i: number) => itemStart(i) + 0.10;

export default function TributePage() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [taskState, setTaskState] = useState<'idle' | 'received'>('idle');

    // Scroll-driven tracked section
    const [trackedP, setTrackedP] = useState(0);
    const trackedOuterRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number>(0);

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
                const data = await res.json();
                if (data.success && data.linked) window.location.href = '/profile';
            } catch {}
        };
        init();
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(() => {
                const el = trackedOuterRef.current;
                if (!el) return;
                const top = el.getBoundingClientRect().top;
                const scrolled = -top;
                const p = clamp(scrolled / SCROLL_RANGE, 0, 1);
                setTrackedP(p);
            });
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => { window.removeEventListener('scroll', handleScroll); cancelAnimationFrame(rafRef.current); };
    }, []);

    const handleTribute = async () => {
        setLoading(true); setStatus(null);
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

    const gold = '#c5a059';

    // Compute per-item animation progress
    const itemEP = TRACKED.map((_, i) => easeOutBack(clamp((trackedP - itemStart(i)) / (itemEnd(i) - itemStart(i)), 0, 1)));
    const headerEP = clamp((trackedP - 0.02) / 0.08, 0, 1);
    const allDone = trackedP >= 0.96;

    return (
        <div style={{ background: '#020512', color: '#fff', overflowX: 'hidden' }}>
            {/* Fixed backgrounds */}
            <div style={{ position: 'fixed', inset: 0, backgroundImage: "url('/login-bg.png')", backgroundSize: 'cover', backgroundPosition: 'center top', opacity: 0.09, zIndex: 0, pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(197,160,89,0.04) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />

            {/* ── PAGE HEADER ── */}
            <div style={{ position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto', padding: 'clamp(48px,8vw,80px) clamp(20px,5vw,36px) 60px' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: '1.2rem', color: 'rgba(197,160,89,0.3)', letterSpacing: '10px', marginBottom: 14 }}>✦</div>
                    <h1 style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(1.5rem,5vw,2.4rem)', color: gold, letterSpacing: '8px', textTransform: 'uppercase', margin: '0 0 12px', fontWeight: 600 }}>Queen Karin</h1>
                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.45rem', color: 'rgba(255,255,255,0.18)', letterSpacing: '5px', textTransform: 'uppercase', marginBottom: 28 }}>EXCLUSIVE ACCESS</div>
                    <div style={{ width: 70, height: 1, background: `linear-gradient(90deg,transparent,${gold}55,transparent)`, margin: '0 auto 28px' }} />
                    <p style={{ fontFamily: 'Cinzel,serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.38)', lineHeight: 1.9, maxWidth: 460, margin: '0 auto' }}>
                        Your presence has been noted. Queen Karin is watching. This is what awaits those who choose to serve.
                    </p>
                </div>
            </div>

            {/* ── TRACKED SECTION — scroll-driven 3D presentation ── */}
            <div ref={trackedOuterRef} style={{ position: 'relative', height: `calc(100vh + ${SCROLL_RANGE}px)`, zIndex: 1 }}>
                <div style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    {/* Full-screen dark overlay so it feels like its own scene */}
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,5,18,0.92)', backdropFilter: 'blur(0px)' }} />
                    {/* Radial vignette */}
                    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, rgba(0,0,0,0.7) 100%)', pointerEvents: 'none' }} />

                    <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 580, padding: '0 24px', boxSizing: 'border-box' } as React.CSSProperties}>

                        {/* Section title */}
                        <div style={{ textAlign: 'center', marginBottom: 36 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                                <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, rgba(197,160,89,0.3))', transform: `scaleX(${headerEP})`, transformOrigin: 'right', transition: 'none' }} />
                                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.4rem', color: `rgba(197,160,89,${0.3 + headerEP * 0.4})`, letterSpacing: '6px', whiteSpace: 'nowrap', transition: 'none' }}>YOUR RECORD IS TRACKED</div>
                                <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, rgba(197,160,89,0.3))', transform: `scaleX(${headerEP})`, transformOrigin: 'left', transition: 'none' }} />
                            </div>
                            <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.72rem', color: `rgba(255,255,255,${headerEP * 0.35})`, lineHeight: 1.6, transition: 'none' }}>
                                Every action logged. Every absence noted. Queen Karin sees everything.
                            </div>
                        </div>

                        {/* 3D Items grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, perspective: '900px', perspectiveOrigin: '50% 50%' }}>
                            {TRACKED.map((item, i) => {
                                const ep = itemEP[i];
                                const rotX = (1 - ep) * -88;
                                const opa = ep;
                                const sc = 0.75 + ep * 0.25;
                                const blur = (1 - ep) * 10;
                                const ty = (1 - ep) * 50;
                                const isActive = trackedP >= itemStart(i) && trackedP < itemEnd(i) + 0.05;
                                const glowStr = isActive ? `0 0 30px rgba(197,160,89,0.35), inset 0 0 20px rgba(197,160,89,0.08)` : `0 0 0 transparent`;
                                const borderCol = isActive ? 'rgba(197,160,89,0.5)' : ep > 0.98 ? 'rgba(197,160,89,0.2)' : 'rgba(197,160,89,0.08)';

                                return (
                                    <div key={item.label} style={{
                                        padding: '18px 16px',
                                        background: 'linear-gradient(160deg, rgba(8,5,20,0.95) 0%, rgba(3,2,14,0.98) 100%)',
                                        border: `1px solid ${borderCol}`,
                                        borderTop: `2px solid ${isActive ? 'rgba(197,160,89,0.7)' : ep > 0.98 ? 'rgba(197,160,89,0.35)' : 'rgba(197,160,89,0.1)'}`,
                                        borderRadius: 4,
                                        boxShadow: glowStr,
                                        opacity: opa,
                                        transform: `rotateX(${rotX}deg) scale(${sc}) translateY(${ty}px)`,
                                        transformOrigin: 'top center',
                                        filter: `blur(${blur}px)`,
                                        willChange: 'transform, opacity, filter',
                                        transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'monospace', fontSize: '0.9rem', color: gold }}>
                                                {item.icon}
                                            </div>
                                            <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.38rem', color: 'rgba(255,255,255,0.8)', letterSpacing: '2px', lineHeight: 1.3 }}>{item.label}</div>
                                        </div>
                                        <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>{item.desc}</div>
                                        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: gold, boxShadow: `0 0 6px ${gold}`, animation: 'pulse 2s infinite' }} />
                                            <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.3rem', color: 'rgba(197,160,89,0.6)', letterSpacing: '3px' }}>TRACKED</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Progress dots */}
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 28 }}>
                            {TRACKED.map((_, i) => {
                                const filled = trackedP >= itemStart(i) + 0.05;
                                return (
                                    <div key={i} style={{ height: 4, width: filled ? 24 : 5, borderRadius: 2, background: filled ? gold : 'rgba(255,255,255,0.15)', boxShadow: filled ? `0 0 8px ${gold}` : 'none', transition: 'width 0.4s ease, background 0.4s ease, box-shadow 0.4s ease' }} />
                                );
                            })}
                        </div>

                        {/* Scroll hint — fades out as soon as scrolling starts */}
                        {trackedP < 0.06 && (
                            <div style={{ textAlign: 'center', marginTop: 20, opacity: clamp(1 - trackedP * 16, 0, 1) }}>
                                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.32rem', color: 'rgba(197,160,89,0.3)', letterSpacing: '4px', animation: 'scrollBounce 1.8s ease-in-out infinite' }}>↓ SCROLL TO REVEAL</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── REST OF PAGE ── */}
            <div style={{ position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto', padding: '80px clamp(20px,5vw,36px) 160px' }}>

                {/* ─── HIERARCHY (horizontal scroll) ─── */}
                <div style={{ marginBottom: 52 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                        <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, rgba(197,160,89,0.2))' }} />
                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.4rem', color: 'rgba(197,160,89,0.45)', letterSpacing: '5px', whiteSpace: 'nowrap' }}>THE HIERARCHY</div>
                        <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, rgba(197,160,89,0.2))' }} />
                    </div>
                    <p style={{ fontFamily: 'Cinzel,serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', lineHeight: 1.7, margin: '0 0 16px', textAlign: 'center' }}>
                        Merit is earned through tasks, challenges, and daily devotion. Higher ranks unlock more access.
                    </p>
                    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
                        {HIERARCHY.map((rank) => (
                            <div key={rank.title} style={{ position: 'relative', flexShrink: 0, width: 200, background: rank.locked ? 'rgba(6,4,16,0.7)' : 'linear-gradient(160deg, rgba(6,4,18,0.97) 0%, rgba(3,2,12,0.99) 100%)', border: rank.locked ? '1px solid rgba(197,160,89,0.07)' : '1px solid rgba(197,160,89,0.25)', borderTop: rank.locked ? '2px solid rgba(197,160,89,0.1)' : '2px solid rgba(197,160,89,0.45)', borderRadius: 3, padding: '20px 16px 18px' }}>
                                {rank.locked && (
                                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,5,18,0.7)', borderRadius: 3, zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, backdropFilter: 'blur(3px)' }}>
                                        <div style={{ fontSize: '1.4rem', opacity: 0.4 }}>🔒</div>
                                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.32rem', color: 'rgba(197,160,89,0.35)', letterSpacing: '3px' }}>LOCKED</div>
                                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.3rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '2px' }}>{rank.points} PTS</div>
                                    </div>
                                )}
                                <div style={{ fontSize: '1.4rem', marginBottom: 8 }}>{rank.icon}</div>
                                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.88rem', color: rank.title === "Queen's Champion" ? gold : '#fff', fontWeight: 600, letterSpacing: '1px', marginBottom: 10 }}>{rank.title}</div>
                                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.32rem', color: 'rgba(197,160,89,0.6)', letterSpacing: '2px', marginBottom: 12, padding: '4px 8px', background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.12)', borderRadius: 4, display: 'inline-block' }}>{rank.contact}</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                    {[rank.status, rank.protocol, rank.duties].map((txt, j) => (
                                        <div key={j} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                                            <div style={{ width: 3, height: 3, borderRadius: '50%', background: gold, opacity: 0.5, marginTop: 5, flexShrink: 0 }} />
                                            <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.6rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{txt}</div>
                                        </div>
                                    ))}
                                </div>
                                {!rank.locked && (
                                    <button onClick={handleTribute} style={{ marginTop: 18, width: '100%', padding: '10px 0', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#c5a059,#8b6914)', color: '#000', fontFamily: 'Orbitron,sans-serif', fontSize: '0.42rem', fontWeight: 700, letterSpacing: '2px' }}>
                                        START HERE →
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.32rem', color: 'rgba(197,160,89,0.25)', letterSpacing: '3px', textAlign: 'center', marginTop: 8 }}>← SCROLL TO EXPLORE RANKS →</div>
                </div>

                {/* ─── CHALLENGE CARD ─── */}
                <div style={{ marginBottom: 52 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                        <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, rgba(197,160,89,0.2))' }} />
                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.4rem', color: 'rgba(197,160,89,0.45)', letterSpacing: '5px', whiteSpace: 'nowrap' }}>ACTIVE CHALLENGE</div>
                        <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, rgba(197,160,89,0.2))' }} />
                    </div>

                    <div style={{ position: 'relative', background: 'rgba(5,8,18,0.97)', border: '1px solid rgba(197,160,89,0.18)', borderTop: '2px solid rgba(197,160,89,0.35)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 40px rgba(0,0,0,0.6)' }}>
                        <div style={{ position: 'absolute', inset: 0, backgroundImage: "url('/hero-bg.png')", backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.1, zIndex: 0 }} />

                        {/* Header bar */}
                        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 14px', borderBottom: '1px solid rgba(197,160,89,0.1)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: gold, boxShadow: `0 0 10px ${gold}`, animation: 'pulse 2s infinite', flexShrink: 0 }} />
                                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.42rem', color: gold, letterSpacing: '3px' }}>CHALLENGE ACTIVE</div>
                            </div>
                            <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.35rem', color: 'rgba(197,160,89,0.4)', letterSpacing: '2px' }}>⚔ CHALLENGE TASKS</div>
                        </div>

                        {/* Body */}
                        <div style={{ position: 'relative', zIndex: 1, padding: '20px 20px 18px' }}>
                            <div style={{ fontFamily: 'Cinzel,serif', fontSize: '1.3rem', color: '#fff', fontWeight: 600, letterSpacing: '2px', marginBottom: 6 }}>Cum Challenge</div>
                            <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginBottom: 16, lineHeight: 1.6 }}>
                                Monthly endurance challenge. Timed windows open without warning. Complete the task. Submit proof. The fastest rise.
                            </div>

                            {/* Stats row */}
                            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                                {[['30d', 'DURATION'], ['2×', 'DAILY TASKS'], ['15min', 'WINDOWS']].map(([val, lbl]) => (
                                    <div key={lbl} style={{ flex: 1, background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.1)', borderRadius: 8, padding: '10px 6px', textAlign: 'center' }}>
                                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.9rem', color: '#fff', fontWeight: 700 }}>{val}</div>
                                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.3rem', color: 'rgba(197,160,89,0.4)', letterSpacing: '2px', marginTop: 3 }}>{lbl}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Join CTA */}
                            <div style={{ background: 'rgba(197,160,89,0.05)', border: '1px solid rgba(197,160,89,0.2)', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                <div>
                                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.42rem', color: gold, letterSpacing: '2px', marginBottom: 4 }}>DO YOU WANT TO PARTICIPATE?</div>
                                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)' }}>Unlock access to join this challenge.</div>
                                </div>
                                <button onClick={handleTribute} disabled={loading} style={{ flexShrink: 0, padding: '10px 20px', background: 'linear-gradient(135deg,#c5a059,#8b6914)', border: 'none', borderRadius: 8, color: '#000', fontFamily: 'Orbitron,sans-serif', fontSize: '0.45rem', letterSpacing: '2px', cursor: loading ? 'default' : 'pointer', fontWeight: 700 }}>
                                    {loading ? '...' : '⚔ JOIN'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── TASK CARD ─── */}
                <div style={{ marginBottom: 52 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                        <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, rgba(197,160,89,0.2))' }} />
                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.4rem', color: 'rgba(197,160,89,0.45)', letterSpacing: '5px', whiteSpace: 'nowrap' }}>DIRECT ORDERS</div>
                        <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, rgba(197,160,89,0.2))' }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 16 }}>
                        <div style={{ height: 1, flex: 1, maxWidth: 60, background: 'linear-gradient(to right, transparent, rgba(197,160,89,0.3))' }} />
                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.42rem', color: 'rgba(197,160,89,0.45)', letterSpacing: '5px' }}>CURRENT STATUS</div>
                        <div style={{ height: 1, flex: 1, maxWidth: 60, background: 'linear-gradient(to left, transparent, rgba(197,160,89,0.3))' }} />
                    </div>
                    <div style={{ position: 'relative', background: 'linear-gradient(160deg, rgba(6,4,18,0.97) 0%, rgba(3,2,12,0.99) 100%)', border: '1px solid rgba(197,160,89,0.18)', borderTop: '2px solid rgba(197,160,89,0.35)', boxShadow: '0 24px 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(197,160,89,0.06)', borderRadius: 3, padding: '32px 20px 28px', overflow: 'hidden', boxSizing: 'border-box' } as React.CSSProperties}>
                        <div style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: 1, background: 'linear-gradient(to right, transparent, rgba(197,160,89,0.5), transparent)' }} />
                        {taskState === 'idle' ? (
                            <>
                                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.42rem', letterSpacing: '8px', color: 'rgba(197,160,89,0.28)', textTransform: 'uppercase', textAlign: 'center', marginBottom: 24 }}>AWAITING ORDERS</div>
                                <button onClick={() => setTaskState('received')} style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.65rem', letterSpacing: '3px', textTransform: 'uppercase', cursor: 'pointer', padding: '13px 0', borderRadius: 8, border: '1px solid rgba(197,160,89,0.35)', background: 'rgba(197,160,89,0.04)', color: '#fff', width: '100%', outline: 'none', display: 'block' }}>
                                    REQUEST TASK
                                </button>
                                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>Tasks are assigned by Queen Karin personally.</div>
                            </>
                        ) : (
                            <>
                                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 1.8, marginBottom: 24 }}>
                                    Pay your entrance tribute to unlock access to Queen Karin&apos;s <span style={{ color: gold }}>1,000+ exclusive tasks.</span>
                                </div>
                                <button onClick={handleTribute} disabled={loading} style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.65rem', letterSpacing: '3px', cursor: loading ? 'not-allowed' : 'pointer', padding: '13px 0', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#c5a059,#8b6914)', color: '#000', fontWeight: 700, width: '100%', display: 'block', boxShadow: '0 4px 20px rgba(197,160,89,0.3)' }}>
                                    {loading ? 'LOADING...' : 'SEND TRIBUTE — €55'}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* ─── PAYMENT CTA ─── */}
                <div style={{ textAlign: 'center' }}>
                    <div style={{ width: 70, height: 1, background: `linear-gradient(90deg,transparent,${gold}55,transparent)`, margin: '0 auto 36px' }} />
                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.9rem', color: 'rgba(197,160,89,0.3)', letterSpacing: '8px', marginBottom: 14 }}>✦</div>
                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.45rem', color: 'rgba(197,160,89,0.4)', letterSpacing: '5px', marginBottom: 14 }}>ENTRANCE TRIBUTE</div>
                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(2rem,6vw,3rem)', color: gold, fontWeight: 700, letterSpacing: '4px', marginBottom: 6 }}>€55</div>
                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)', letterSpacing: '2px', marginBottom: 28 }}>One-time. Permanent access.</div>
                    <button onClick={handleTribute} disabled={loading} style={{ width: '100%', padding: '20px 24px', background: 'linear-gradient(135deg,#0a0602 0%,#1a1208 30%,#c5a059 60%,#e8d5a8 80%,#c5a059 100%)', border: '1px solid rgba(197,160,89,0.5)', color: '#fff', fontFamily: 'Cinzel,serif', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '8px', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, borderRadius: 4, marginBottom: 16, boxShadow: '0 0 30px rgba(197,160,89,0.15),0 8px 40px rgba(0,0,0,0.4)' }}>
                        {loading ? 'Initializing...' : 'Send Tribute'}
                    </button>
                    {status && <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.6rem', color: gold, letterSpacing: '2px', marginBottom: 14 }}>{status}</div>}
                    {userEmail && <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.37rem', color: 'rgba(197,160,89,0.22)', letterSpacing: '2px', marginBottom: 18 }}>Logged in as <span style={{ color: 'rgba(197,160,89,0.4)' }}>{userEmail}</span></div>}
                    <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.15)', fontFamily: 'Cinzel,serif', fontSize: '0.58rem', letterSpacing: '2px', cursor: 'pointer', padding: '8px 0', display: 'block', margin: '0 auto' }}>Logout / Switch account</button>
                    <div style={{ marginTop: 36, fontFamily: 'Orbitron,sans-serif', fontSize: '0.36rem', color: 'rgba(255,255,255,0.07)', letterSpacing: '3px' }}>Property of Queen Karin &nbsp;·&nbsp; Est. 2024</div>
                </div>
            </div>


            <style>{`
                @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
                @keyframes scrollBounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(6px)} }
                ::-webkit-scrollbar { display: none; }
            `}</style>
        </div>
    );
}
