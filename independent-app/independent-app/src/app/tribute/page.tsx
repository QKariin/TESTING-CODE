"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

const HIERARCHY = [
    { title: "HallBoy", icon: "🧹", points: "0+", contact: "15MIN DAILY SLOT" },
    { title: "Footman", icon: "🚶‍♂️", points: "2,000+", contact: "30MIN DAILY SLOT" },
    { title: "Silverman", icon: "🍴", points: "5,000+", contact: "30MIN DAILY SLOT" },
    { title: "Butler", icon: "🍷", points: "10,000+", contact: "DAILY 2×30MIN" },
    { title: "Chamberlain", icon: "🏰", points: "20,000+", contact: "UNLIMITED" },
    { title: "Secretary", icon: "📜", points: "50,000+", contact: "UNLIMITED" },
    { title: "Queen's Champion", icon: "⚔️", points: "100,000", contact: "LEGENDARY" },
];

export default function TributePage() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [taskState, setTaskState] = useState<'idle' | 'received'>('idle');

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
    const cardBg = 'rgba(6,4,16,0.92)';
    const border = '1px solid rgba(197,160,89,0.2)';

    return (
        <div style={{ background: '#020512', minHeight: '100vh', color: '#fff', overflowX: 'hidden' }}>
            <div style={{ position: 'fixed', inset: 0, backgroundImage: "url('/login-bg.png')", backgroundSize: 'cover', backgroundPosition: 'center top', opacity: 0.09, zIndex: 0, pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(197,160,89,0.04) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />

            <div style={{ position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto', padding: 'clamp(48px,8vw,80px) clamp(20px,5vw,36px) 100px' }}>

                {/* HEADER */}
                <div style={{ textAlign: 'center', marginBottom: 52 }}>
                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: '1.2rem', color: 'rgba(197,160,89,0.3)', letterSpacing: '10px', marginBottom: 14 }}>✦</div>
                    <h1 style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(1.5rem,5vw,2.4rem)', color: gold, letterSpacing: '8px', textTransform: 'uppercase', margin: '0 0 12px', fontWeight: 600 }}>Queen Karin</h1>
                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.45rem', color: 'rgba(255,255,255,0.18)', letterSpacing: '5px', textTransform: 'uppercase', marginBottom: 28 }}>EXCLUSIVE ACCESS</div>
                    <div style={{ width: 70, height: 1, background: `linear-gradient(90deg,transparent,${gold}55,transparent)`, margin: '0 auto 28px' }} />
                    <p style={{ fontFamily: 'Cinzel,serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.38)', lineHeight: 1.9, maxWidth: 460, margin: '0 auto' }}>
                        Your presence has been noted. Queen Karin is watching. This is what awaits those who choose to serve.
                    </p>
                </div>

                {/* TRACKING NOTICE */}
                <div style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.12)', borderRadius: 10, padding: '14px 18px', marginBottom: 44, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: gold, boxShadow: `0 0 10px ${gold}`, flexShrink: 0, animation: 'pulse 2s infinite' }} />
                    <div>
                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.4rem', color: gold, letterSpacing: '3px', marginBottom: 3 }}>YOUR RECORD IS BEING TRACKED</div>
                        <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>
                            Queen Karin monitors every visit, every interaction, every tribute paid. Your devotion — or lack of it — does not go unnoticed.
                        </div>
                    </div>
                </div>

                {/* HIERARCHY */}
                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.42rem', color: 'rgba(197,160,89,0.45)', letterSpacing: '4px', marginBottom: 8 }}>THE HIERARCHY</div>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '1.1rem', color: '#fff', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 10 }}>Where Will You Stand?</div>
                <p style={{ fontFamily: 'Cinzel,serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.32)', lineHeight: 1.8, margin: '0 0 18px' }}>
                    Every member is ranked. Merit is earned through tasks, challenges, and daily devotion. Higher ranks unlock more access, more contact time, more privilege.
                </p>
                <div style={{ background: cardBg, border, borderRadius: 14, overflow: 'hidden', marginBottom: 44 }}>
                    {HIERARCHY.map((rank, i) => (
                        <div key={rank.title} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', borderBottom: i < HIERARCHY.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: i === 0 ? 'rgba(197,160,89,0.04)' : 'transparent' }}>
                            <div style={{ fontSize: '1.1rem', width: 28, textAlign: 'center', flexShrink: 0 }}>{rank.icon}</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.82rem', color: i === HIERARCHY.length - 1 ? gold : '#fff', fontWeight: i === HIERARCHY.length - 1 ? 700 : 400, letterSpacing: '1px' }}>{rank.title}</div>
                                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.35rem', color: 'rgba(197,160,89,0.4)', letterSpacing: '2px', marginTop: 2 }}>{rank.contact}</div>
                            </div>
                            <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.42rem', color: 'rgba(255,255,255,0.25)', letterSpacing: '1px', flexShrink: 0 }}>{rank.points} pts</div>
                        </div>
                    ))}
                </div>

                {/* CHALLENGE CARD */}
                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.42rem', color: 'rgba(197,160,89,0.45)', letterSpacing: '4px', marginBottom: 8 }}>ACTIVE CHALLENGE</div>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '1.1rem', color: '#fff', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 10 }}>Compete Against Others.</div>
                <p style={{ fontFamily: 'Cinzel,serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.32)', lineHeight: 1.8, margin: '0 0 18px' }}>
                    Monthly challenges are issued to all members. Timed task windows open without warning. Complete them. Submit proof. The best performers rise.
                </p>
                <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(197,160,89,0.25)', marginBottom: 44 }}>
                    <div style={{ position: 'absolute', inset: 0, backgroundImage: "url('/hero-bg.png')", backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.12 }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg,rgba(8,5,22,0.9) 0%,rgba(2,3,14,0.97) 100%)' }} />
                    <div style={{ position: 'relative', padding: '20px 20px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: gold, boxShadow: `0 0 8px ${gold}`, animation: 'pulse 2s infinite' }} />
                            <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.38rem', color: gold, letterSpacing: '3px' }}>ACTIVE CHALLENGE</div>
                        </div>
                        <div style={{ fontFamily: 'Cinzel,serif', fontSize: '1.3rem', fontWeight: 700, color: '#fff', letterSpacing: '2px', marginBottom: 4 }}>Cum Challenge</div>
                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.36rem', color: 'rgba(197,160,89,0.45)', letterSpacing: '2px', marginBottom: 18 }}>NEXT WINDOW OPENS IN 03:41:22</div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                            {[['31', 'ENROLLED'], ['4', 'WINDOWS LEFT'], ['6', 'DAYS LEFT']].map(([val, lbl]) => (
                                <div key={lbl} style={{ flex: 1, background: 'rgba(197,160,89,0.05)', border: '1px solid rgba(197,160,89,0.12)', borderRadius: 8, padding: '9px 6px', textAlign: 'center' }}>
                                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '1rem', color: '#fff', fontWeight: 700 }}>{val}</div>
                                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.33rem', color: 'rgba(197,160,89,0.4)', letterSpacing: '1.5px', marginTop: 2 }}>{lbl}</div>
                                </div>
                            ))}
                        </div>
                        <button onClick={handleTribute} disabled={loading} style={{ width: '100%', padding: '11px 0', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#c5a059,#8b6914)', color: '#000', fontFamily: 'Orbitron,sans-serif', fontSize: '0.55rem', fontWeight: 700, letterSpacing: '2px', boxShadow: '0 4px 20px rgba(197,160,89,0.3)' }}>
                            JOIN CHALLENGE
                        </button>
                    </div>
                </div>

                {/* TASK CARD */}
                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.42rem', color: 'rgba(197,160,89,0.45)', letterSpacing: '4px', marginBottom: 8 }}>DIRECT ORDERS</div>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '1.1rem', color: '#fff', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 10 }}>Receive Your Task.</div>
                <p style={{ fontFamily: 'Cinzel,serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.32)', lineHeight: 1.8, margin: '0 0 18px' }}>
                    Tasks are assigned personally by Queen Karin. You request. She decides. You execute and submit proof.
                </p>
                <div style={{ background: cardBg, border, borderRadius: 14, padding: '18px 20px', marginBottom: 44 }}>
                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.42rem', color: 'rgba(197,160,89,0.5)', letterSpacing: '3px', marginBottom: 14 }}>CURRENT ORDERS</div>
                    {taskState === 'idle' ? (
                        <div style={{ textAlign: 'center' }}>
                            <button onClick={() => setTaskState('received')} style={{ width: '100%', borderRadius: 12, background: '#0075ff', color: 'white', padding: '14px 0', fontFamily: 'Orbitron,sans-serif', fontWeight: 700, fontSize: '0.6rem', letterSpacing: '2px', border: 'none', cursor: 'pointer' }}>
                                REQUEST TASK
                            </button>
                            <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', marginTop: 12 }}>Awaiting direct orders from Queen Karin...</div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div style={{ fontFamily: 'Cinzel,serif', fontSize: '1rem', color: '#fff', lineHeight: 1.6, textAlign: 'center' }}>
                                Pay your entrance tribute to unlock access to Queen Karin&apos;s 1,000+ exclusive tasks.
                            </div>
                            <button onClick={handleTribute} disabled={loading} style={{ width: '100%', padding: '13px 0', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#c5a059,#8b6914)', color: '#000', fontFamily: 'Orbitron,sans-serif', fontSize: '0.55rem', fontWeight: 700, letterSpacing: '2px', boxShadow: '0 4px 20px rgba(197,160,89,0.3)' }}>
                                {loading ? 'LOADING...' : 'SEND TRIBUTE — €55'}
                            </button>
                        </div>
                    )}
                </div>

                {/* PAYMENT CTA */}
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
            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
        </div>
    );
}
