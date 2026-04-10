"use client";

import { useState, useEffect } from 'react';
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
    { label: "Tasks Completed", icon: "✓", value: "Tracked" },
    { label: "Kneeling Sessions", icon: "⬇", value: "Tracked" },
    { label: "Tribute History", icon: "◈", value: "Tracked" },
    { label: "Locked Time", icon: "⏱", value: "Tracked" },
    { label: "Consistency Score", icon: "◉", value: "Tracked" },
    { label: "Daily Routine", icon: "📋", value: "Tracked" },
];

export default function TributePage() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [taskState, setTaskState] = useState<'idle' | 'received'>('idle');
    const [challengeDismissed, setChallengeDismissed] = useState(false);

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

    return (
        <div style={{ background: '#020512', minHeight: '100vh', color: '#fff', overflowX: 'hidden' }}>
            {/* Background */}
            <div style={{ position: 'fixed', inset: 0, backgroundImage: "url('/login-bg.png')", backgroundSize: 'cover', backgroundPosition: 'center top', opacity: 0.09, zIndex: 0, pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(197,160,89,0.04) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />

            <div style={{ position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto', padding: 'clamp(48px,8vw,80px) clamp(20px,5vw,36px) 160px' }}>

                {/* HEADER */}
                <div style={{ textAlign: 'center', marginBottom: 48 }}>
                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: '1.2rem', color: 'rgba(197,160,89,0.3)', letterSpacing: '10px', marginBottom: 14 }}>✦</div>
                    <h1 style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(1.5rem,5vw,2.4rem)', color: gold, letterSpacing: '8px', textTransform: 'uppercase', margin: '0 0 12px', fontWeight: 600 }}>Queen Karin</h1>
                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.45rem', color: 'rgba(255,255,255,0.18)', letterSpacing: '5px', textTransform: 'uppercase', marginBottom: 28 }}>EXCLUSIVE ACCESS</div>
                    <div style={{ width: 70, height: 1, background: `linear-gradient(90deg,transparent,${gold}55,transparent)`, margin: '0 auto 28px' }} />
                    <p style={{ fontFamily: 'Cinzel,serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.38)', lineHeight: 1.9, maxWidth: 460, margin: '0 auto' }}>
                        Your presence has been noted. Queen Karin is watching. This is what awaits those who choose to serve.
                    </p>
                </div>

                {/* ─── WHAT IS TRACKED ─── */}
                <div style={{ marginBottom: 52 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                        <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, rgba(197,160,89,0.2))' }} />
                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.4rem', color: 'rgba(197,160,89,0.45)', letterSpacing: '5px', whiteSpace: 'nowrap' }}>YOUR RECORD IS TRACKED</div>
                        <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, rgba(197,160,89,0.2))' }} />
                    </div>
                    <div style={{ background: 'rgba(6,4,16,0.92)', border: '1px solid rgba(197,160,89,0.15)', borderTop: '2px solid rgba(197,160,89,0.3)', borderRadius: 3, padding: '14px 16px 10px', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: gold, boxShadow: `0 0 10px ${gold}`, flexShrink: 0, animation: 'pulse 2s infinite' }} />
                            <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>
                                Every action is logged. Every absence is noted. Queen Karin sees everything.
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            {TRACKED.map((item) => (
                                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'rgba(197,160,89,0.03)', border: '1px solid rgba(197,160,89,0.09)', borderRadius: 6 }}>
                                    <div style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'rgba(197,160,89,0.5)', width: 16, textAlign: 'center', flexShrink: 0 }}>{item.icon}</div>
                                    <div>
                                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.33rem', color: 'rgba(255,255,255,0.55)', letterSpacing: '2px' }}>{item.label}</div>
                                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.28rem', color: 'rgba(197,160,89,0.4)', letterSpacing: '1px', marginTop: 2 }}>{item.value}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

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
                    {/* Horizontal scroll container */}
                    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
                        {HIERARCHY.map((rank) => (
                            <div key={rank.title} style={{ position: 'relative', flexShrink: 0, width: 200, background: rank.locked ? 'rgba(6,4,16,0.7)' : 'linear-gradient(160deg, rgba(6,4,18,0.97) 0%, rgba(3,2,12,0.99) 100%)', border: rank.locked ? '1px solid rgba(197,160,89,0.07)' : '1px solid rgba(197,160,89,0.25)', borderTop: rank.locked ? '2px solid rgba(197,160,89,0.1)' : '2px solid rgba(197,160,89,0.45)', borderRadius: 3, padding: '20px 16px 18px', filter: rank.locked ? 'blur(0px)' : 'none' }}>
                                {/* Lock overlay */}
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
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                                        <div style={{ width: 3, height: 3, borderRadius: '50%', background: gold, opacity: 0.5, marginTop: 5, flexShrink: 0 }} />
                                        <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.6rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{rank.status}</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                                        <div style={{ width: 3, height: 3, borderRadius: '50%', background: gold, opacity: 0.5, marginTop: 5, flexShrink: 0 }} />
                                        <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.6rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{rank.protocol}</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                                        <div style={{ width: 3, height: 3, borderRadius: '50%', background: gold, opacity: 0.5, marginTop: 5, flexShrink: 0 }} />
                                        <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.6rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{rank.duties}</div>
                                    </div>
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

                {/* ─── TASK CARD (luxury-card style) ─── */}
                <div style={{ marginBottom: 52 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                        <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, rgba(197,160,89,0.2))' }} />
                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.4rem', color: 'rgba(197,160,89,0.45)', letterSpacing: '5px', whiteSpace: 'nowrap' }}>DIRECT ORDERS</div>
                        <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, rgba(197,160,89,0.2))' }} />
                    </div>

                    {/* duty-label style */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 16 }}>
                        <div style={{ height: 1, flex: 1, maxWidth: 60, background: 'linear-gradient(to right, transparent, rgba(197,160,89,0.3))' }} />
                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.42rem', color: 'rgba(197,160,89,0.45)', letterSpacing: '5px', textTransform: 'uppercase' }}>CURRENT STATUS</div>
                        <div style={{ height: 1, flex: 1, maxWidth: 60, background: 'linear-gradient(to left, transparent, rgba(197,160,89,0.3))' }} />
                    </div>

                    {/* luxury-card style */}
                    <div style={{ position: 'relative', background: 'linear-gradient(160deg, rgba(6,4,18,0.97) 0%, rgba(3,2,12,0.99) 100%)', border: '1px solid rgba(197,160,89,0.18)', borderTop: '2px solid rgba(197,160,89,0.35)', boxShadow: '0 24px 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(197,160,89,0.06)', borderRadius: 3, padding: '32px 20px 28px', overflow: 'hidden', width: '100%', boxSizing: 'border-box' } as React.CSSProperties}>
                        {/* ::before shimmer line */}
                        <div style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: 1, background: 'linear-gradient(to right, transparent, rgba(197,160,89,0.5), transparent)' }} />

                        {taskState === 'idle' ? (
                            <>
                                {/* txt-status-red style */}
                                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.42rem', fontWeight: 400, letterSpacing: '8px', color: 'rgba(197,160,89,0.28)', textTransform: 'uppercase', textAlign: 'center', marginBottom: 24 }}>
                                    AWAITING ORDERS
                                </div>
                                {/* lobby-btn style */}
                                <button onClick={() => setTaskState('received')} style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.65rem', letterSpacing: '3px', textTransform: 'uppercase', cursor: 'pointer', padding: '13px 0', borderRadius: 8, border: '1px solid rgba(197,160,89,0.35)', background: 'rgba(197,160,89,0.04)', color: '#fff', transition: 'all 0.2s', WebkitTapHighlightColor: 'transparent', width: '100%', outline: 'none', display: 'block' }}>
                                    REQUEST TASK
                                </button>
                                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>
                                    Tasks are assigned by Queen Karin personally.
                                </div>
                            </>
                        ) : (
                            <>
                                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 1.8, marginBottom: 24 }}>
                                    Pay your entrance tribute to unlock access to Queen Karin&apos;s <span style={{ color: gold }}>1,000+ exclusive tasks.</span>
                                </div>
                                <button onClick={handleTribute} disabled={loading} style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.65rem', letterSpacing: '3px', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', padding: '13px 0', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#c5a059,#8b6914)', color: '#000', fontWeight: 700, width: '100%', display: 'block', boxShadow: '0 4px 20px rgba(197,160,89,0.3)' }}>
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
                    <button onClick={handleTribute} disabled={loading} style={{ width: '100%', padding: '20px 24px', background: 'linear-gradient(135deg,#0a0602 0%,#1a1208 30%,#c5a059 60%,#e8d5a8 80%,#c5a059 100%)', backgroundSize: '250% 250%', backgroundPosition: '0% 0%', border: '1px solid rgba(197,160,89,0.5)', color: '#fff', fontFamily: 'Cinzel,serif', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '8px', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, borderRadius: 4, marginBottom: 16, boxShadow: '0 0 30px rgba(197,160,89,0.15),0 8px 40px rgba(0,0,0,0.4)' }}>
                        {loading ? 'Initializing...' : 'Send Tribute'}
                    </button>
                    {status && <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.6rem', color: gold, letterSpacing: '2px', marginBottom: 14 }}>{status}</div>}
                    {userEmail && <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.37rem', color: 'rgba(197,160,89,0.22)', letterSpacing: '2px', marginBottom: 18 }}>Logged in as <span style={{ color: 'rgba(197,160,89,0.4)' }}>{userEmail}</span></div>}
                    <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.15)', fontFamily: 'Cinzel,serif', fontSize: '0.58rem', letterSpacing: '2px', cursor: 'pointer', padding: '8px 0', display: 'block', margin: '0 auto' }}>Logout / Switch account</button>
                    <div style={{ marginTop: 36, fontFamily: 'Orbitron,sans-serif', fontSize: '0.36rem', color: 'rgba(255,255,255,0.07)', letterSpacing: '3px' }}>Property of Queen Karin &nbsp;·&nbsp; Est. 2024</div>
                </div>
            </div>

            {/* ─── CHALLENGE BANNER (fixed bottom, exact mobile style) ─── */}
            {!challengeDismissed && (
                <div style={{ position: 'fixed', bottom: 24, left: 12, right: 12, zIndex: 10000002, background: 'rgba(5,8,18,0.97)', border: '1px solid rgba(74,222,128,0.4)', borderRadius: 14, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', maxWidth: 640, margin: '0 auto' } as React.CSSProperties}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.78rem', color: '#fff', fontWeight: 600 }}>Cum Challenge</div>
                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.38rem', color: '#4ade80', letterSpacing: '2px', marginTop: 2 }}>CHALLENGE ACTIVE</div>
                    </div>
                    <button onClick={handleTribute} disabled={loading} style={{ background: 'linear-gradient(135deg,#4ade80,#16a34a)', borderRadius: 8, padding: '5px 12px', fontFamily: 'Orbitron,sans-serif', fontSize: '0.38rem', color: '#000', fontWeight: 700, border: 'none', cursor: 'pointer', letterSpacing: '1px', flexShrink: 0 }}>
                        JOIN
                    </button>
                    <button onClick={() => setChallengeDismissed(true)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '5px 10px', color: 'rgba(255,255,255,0.4)', fontFamily: 'Orbitron,sans-serif', fontSize: '0.36rem', cursor: 'pointer', flexShrink: 0, letterSpacing: '1px' }}>
                        DISMISS
                    </button>
                </div>
            )}

            <style>{`
                @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
                ::-webkit-scrollbar { display: none; }
            `}</style>
        </div>
    );
}
