"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

/* ─── tiny helpers ─────────────────────────────────────────── */
function SectionTag({ children }: { children: string }) {
    return (
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.42rem', color: 'rgba(197,160,89,0.45)', letterSpacing: '4px', textTransform: 'uppercase', marginBottom: 8 }}>
            {children}
        </div>
    );
}

function SectionTitle({ children }: { children: string }) {
    return (
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.15rem', color: '#fff', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 10 }}>
            {children}
        </div>
    );
}

function SectionDesc({ children }: { children: string }) {
    return (
        <p style={{ fontFamily: 'Cinzel, serif', fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.9, letterSpacing: '0.5px', margin: '0 0 22px' }}>
            {children}
        </p>
    );
}

function Divider() {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '48px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, rgba(197,160,89,0.15))' }} />
            <div style={{ fontFamily: 'Cinzel', fontSize: '0.6rem', color: 'rgba(197,160,89,0.25)', letterSpacing: '4px' }}>✦</div>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(197,160,89,0.15), transparent)' }} />
        </div>
    );
}

function LockOverlay({ label = 'TRIBUTE REQUIRED TO ACCESS' }: { label?: string }) {
    return (
        <div style={{
            position: 'absolute', inset: 0, zIndex: 10, borderRadius: 'inherit',
            background: 'linear-gradient(180deg, rgba(2,5,18,0) 0%, rgba(2,5,18,0.7) 50%, rgba(2,5,18,0.95) 100%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
            padding: '20px', backdropFilter: 'blur(0px)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.38rem', color: 'rgba(197,160,89,0.45)', letterSpacing: '3px' }}>{label}</span>
            </div>
        </div>
    );
}

/* ─── main page ────────────────────────────────────────────── */
export default function PreviewPage() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);

    useEffect(() => {
        const init = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { window.location.href = '/login'; return; }
            const display = user.email
                || (user.user_metadata?.user_name ? `@${user.user_metadata.user_name}` : null)
                || 'Unknown';
            setUserEmail(display);
            // Re-check if they already have a profile
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

    return (
        <div style={{ background: '#020512', minHeight: '100vh', color: '#fff', overflowX: 'hidden' }}>

            {/* Fixed bg */}
            <div style={{ position: 'fixed', inset: 0, backgroundImage: "url('/login-bg.png')", backgroundSize: 'cover', backgroundPosition: 'center top', opacity: 0.08, zIndex: 0, pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(197,160,89,0.05) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />

            {/* Content */}
            <div style={{ position: 'relative', zIndex: 1, maxWidth: 660, margin: '0 auto', padding: 'clamp(48px, 8vw, 80px) clamp(20px, 5vw, 40px) 100px' }}>

                {/* ── HERO ── */}
                <div style={{ textAlign: 'center', marginBottom: 64 }}>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.3rem', color: 'rgba(197,160,89,0.35)', letterSpacing: '10px', marginBottom: 18 }}>✦</div>
                    <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(1.5rem, 5vw, 2.4rem)', color: '#c5a059', letterSpacing: '8px', textTransform: 'uppercase', margin: '0 0 14px', fontWeight: 600 }}>
                        Queen Karin
                    </h1>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.48rem', color: 'rgba(255,255,255,0.18)', letterSpacing: '5px', textTransform: 'uppercase', marginBottom: 36 }}>
                        MEMBERSHIP PREVIEW
                    </div>
                    <div style={{ width: 80, height: 1, background: 'linear-gradient(90deg, transparent, rgba(197,160,89,0.35), transparent)', margin: '0 auto 36px' }} />
                    <p style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(0.78rem, 2vw, 0.9rem)', color: 'rgba(255,255,255,0.4)', lineHeight: 1.9, letterSpacing: '0.5px', maxWidth: 460, margin: '0 auto' }}>
                        You have been granted a glimpse behind the gates. This is what awaits those who earn the right to serve.
                    </p>
                </div>

                {/* ══════════════════════════════════════════ */}
                {/* I. THE CHALLENGE */}
                {/* ══════════════════════════════════════════ */}
                <SectionTag>I — The Challenge</SectionTag>
                <SectionTitle>Compete. Prove. Ascend.</SectionTitle>
                <SectionDesc>Every cycle, a new challenge is issued to all members. Tasks are assigned in timed windows — miss them and your rank suffers. Those who perform best rise. Those who fail, fall.</SectionDesc>

                <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(197,160,89,0.2)', marginBottom: 10 }}>
                    {/* BG layers */}
                    <div style={{ position: 'absolute', inset: 0, backgroundImage: "url('/hero-bg.png')", backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.15 }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, rgba(8,5,22,0.88) 0%, rgba(2,3,14,0.97) 100%)' }} />
                    <div style={{ position: 'relative', padding: '22px 22px 28px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#c5a059', boxShadow: '0 0 10px rgba(197,160,89,0.9)', animation: 'pulse 2s infinite' }} />
                            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.4rem', color: '#c5a059', letterSpacing: '3px' }}>ACTIVE CHALLENGE</div>
                        </div>
                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.35rem', fontWeight: 700, color: '#fff', letterSpacing: '2px', marginBottom: 6 }}>The Devotion Trial</div>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.38rem', color: 'rgba(197,160,89,0.45)', letterSpacing: '2px', marginBottom: 22 }}>NEXT WINDOW OPENS IN 04:32:17</div>
                        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
                            {[['24', 'ENROLLED'], ['3', 'WINDOWS LEFT'], ['7', 'DAYS REMAINING']].map(([val, lbl]) => (
                                <div key={lbl} style={{ flex: 1, background: 'rgba(197,160,89,0.05)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 8, padding: '10px 6px', textAlign: 'center' }}>
                                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.1rem', color: '#fff', fontWeight: 700 }}>{val}</div>
                                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.34rem', color: 'rgba(197,160,89,0.45)', letterSpacing: '1.5px', marginTop: 3 }}>{lbl}</div>
                                </div>
                            ))}
                        </div>
                        <button style={{ width: '100%', padding: '11px 0', borderRadius: 8, border: '1px solid rgba(197,160,89,0.3)', cursor: 'not-allowed', background: 'rgba(197,160,89,0.08)', color: '#c5a059', fontFamily: 'Orbitron, sans-serif', fontSize: '0.5rem', fontWeight: 700, letterSpacing: '2px' }} disabled>
                            JOIN CHALLENGE
                        </button>
                    </div>
                    <LockOverlay />
                </div>

                <Divider />

                {/* ══════════════════════════════════════════ */}
                {/* II. DIRECT ORDERS */}
                {/* ══════════════════════════════════════════ */}
                <SectionTag>II — Direct Orders</SectionTag>
                <SectionTitle>Serve on Command.</SectionTitle>
                <SectionDesc>Tasks are issued directly by Queen Karin. You pay a small coin fee to receive your orders — then you execute. Evidence is required. Every task shapes your standing.</SectionDesc>

                <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(197,160,89,0.18)', background: 'rgba(6,4,16,0.9)', marginBottom: 10 }}>
                    <div style={{ padding: '20px 22px' }}>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.42rem', color: 'rgba(197,160,89,0.5)', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 14 }}>CURRENT ORDERS</div>
                        {/* Task card */}
                        <div style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.12)', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
                            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: '#fff', fontWeight: 600, lineHeight: 1.5, marginBottom: 10 }}>
                                You will kneel for 45 uninterrupted minutes. Eyes forward. No phone. No distractions. When finished, you will photograph your space and send it as proof of your dedication.
                            </div>
                            {/* Timer */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '14px 0 6px', justifyContent: 'center' }}>
                                {['45', '00', '00'].map((v, i) => (
                                    <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.6rem', color: '#fff', fontWeight: 700, background: 'rgba(0,0,0,0.4)', borderRadius: 6, padding: '4px 10px', border: '1px solid rgba(255,255,255,0.08)' }}>{v}</span>
                                        {i < 2 && <span style={{ color: 'rgba(197,160,89,0.4)', fontSize: '1.2rem', fontWeight: 700 }}>:</span>}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'not-allowed', background: 'linear-gradient(135deg, #c5a059, #8b6914)', color: '#000', fontFamily: 'Orbitron, sans-serif', fontSize: '0.5rem', fontWeight: 700, letterSpacing: '2px', opacity: 0.6 }} disabled>
                                SUBMIT PROOF
                            </button>
                            <button style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(255,60,60,0.25)', cursor: 'not-allowed', background: 'rgba(255,60,60,0.05)', color: 'rgba(255,80,80,0.4)', fontFamily: 'Orbitron, sans-serif', fontSize: '0.42rem', letterSpacing: '1px' }} disabled>
                                SKIP
                            </button>
                        </div>
                    </div>
                    <LockOverlay />
                </div>

                <Divider />

                {/* ══════════════════════════════════════════ */}
                {/* III. THE KNEELING */}
                {/* ══════════════════════════════════════════ */}
                <SectionTag>III — The Kneeling</SectionTag>
                <SectionTitle>Devotion Has a Rhythm.</SectionTitle>
                <SectionDesc>Each day you are expected to kneel — to hold the button, to give your time, to demonstrate submission. Complete your daily sessions and choose your reward: coins for your treasury, or merit to elevate your rank.</SectionDesc>

                <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(197,160,89,0.18)', background: 'rgba(6,4,16,0.9)', marginBottom: 10 }}>
                    <div style={{ padding: '20px 22px' }}>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.42rem', color: 'rgba(197,160,89,0.5)', letterSpacing: '3px', marginBottom: 14 }}>KNEELING HOURS TODAY</div>
                        {/* Progress bar */}
                        <div style={{ height: 28, borderRadius: 10, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden', position: 'relative', marginBottom: 8 }}>
                            <div style={{ width: '37.5%', height: '100%', background: 'linear-gradient(90deg, rgba(197,160,89,0.6), #c5a059)', transition: 'width 0.5s ease' }} />
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Orbitron, sans-serif', fontSize: '0.75rem', color: '#fff', textShadow: '0 1px 3px #000' }}>3 / 8</div>
                        </div>
                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)', textAlign: 'right', marginBottom: 18 }}>5 sessions remaining today</div>
                        {/* Reward cards */}
                        <div style={{ display: 'flex', gap: 10 }}>
                            <div style={{ flex: 1, background: 'linear-gradient(135deg, rgba(197,160,89,0.1), rgba(197,160,89,0.03))', border: '1px solid rgba(197,160,89,0.4)', borderRadius: 10, padding: '14px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                <div style={{ fontSize: '1.5rem', filter: 'drop-shadow(0 0 8px rgba(197,160,89,0.5))' }}>🪙</div>
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.55rem', color: '#c5a059', letterSpacing: '3px', fontWeight: 700 }}>COINS</div>
                                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.6rem', color: 'rgba(197,160,89,0.5)', textAlign: 'center', lineHeight: 1.5 }}>Add to your treasury</div>
                            </div>
                            <div style={{ flex: 1, background: 'linear-gradient(135deg, rgba(160,180,255,0.08), rgba(160,180,255,0.02))', border: '1px solid rgba(160,180,255,0.25)', borderRadius: 10, padding: '14px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                <div style={{ fontSize: '1.5rem', filter: 'drop-shadow(0 0 8px rgba(160,180,255,0.4))' }}>⭐</div>
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.55rem', color: '#a0b4ff', letterSpacing: '3px', fontWeight: 700 }}>MERIT</div>
                                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.6rem', color: 'rgba(160,180,255,0.45)', textAlign: 'center', lineHeight: 1.5 }}>Rise in rank</div>
                            </div>
                        </div>
                    </div>
                    <LockOverlay />
                </div>

                <Divider />

                {/* ══════════════════════════════════════════ */}
                {/* IV. YOUR STANDING */}
                {/* ══════════════════════════════════════════ */}
                <SectionTag>IV — Your Standing</SectionTag>
                <SectionTitle>Rank Has Consequences.</SectionTitle>
                <SectionDesc>Your classification is determined by merit earned through tasks, challenges, and daily devotion. Higher ranks unlock privileges — and carry greater expectations. Where will you stand?</SectionDesc>

                <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(197,160,89,0.18)', background: 'rgba(6,4,16,0.9)', marginBottom: 10 }}>
                    <div style={{ padding: '22px' }}>
                        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
                            {[['⭐', '4,280', 'MERIT', '#fff'], ['🪙', '1,150', 'CAPITAL', '#c5a059']].map(([icon, val, lbl, col]) => (
                                <div key={lbl} style={{ flex: 1, background: 'rgba(10,10,10,0.7)', border: '1px solid rgba(197,160,89,0.18)', borderRadius: 10, padding: '14px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                    <div style={{ fontSize: '1.1rem' }}>{icon}</div>
                                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.1rem', color: col as string, fontWeight: 800 }}>{val}</div>
                                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.38rem', color: 'rgba(197,160,89,0.5)', letterSpacing: '2px' }}>{lbl}</div>
                                </div>
                            ))}
                        </div>
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 16 }}>
                            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.5rem', color: 'rgba(197,160,89,0.5)', letterSpacing: '3px', marginBottom: 6 }}>CURRENT CLASSIFICATION</div>
                            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: '#fff', fontWeight: 700, letterSpacing: '4px', textTransform: 'uppercase', marginBottom: 12 }}>Devoted Subject</div>
                            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.45rem', color: 'rgba(197,160,89,0.4)', letterSpacing: '2px', marginBottom: 8 }}>CURRENT PRIVILEGES</div>
                            <ul style={{ margin: 0, padding: '0 0 0 16px', color: 'rgba(255,255,255,0.4)', fontFamily: 'Cinzel, serif', fontSize: '0.68rem', lineHeight: 2 }}>
                                <li>Access to Queen&apos;s chat</li>
                                <li>Challenge participation</li>
                                <li>Task assignments</li>
                                <li>Weekly leaderboard standing</li>
                            </ul>
                        </div>
                    </div>
                    <LockOverlay />
                </div>

                {/* ══════════════════════════════════════════ */}
                {/* CTA */}
                {/* ══════════════════════════════════════════ */}
                <div style={{ marginTop: 64, textAlign: 'center' }}>
                    <div style={{ width: 80, height: 1, background: 'linear-gradient(90deg, transparent, rgba(197,160,89,0.4), transparent)', margin: '0 auto 40px' }} />

                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: 'rgba(197,160,89,0.35)', letterSpacing: '8px', marginBottom: 16 }}>✦</div>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.45rem', color: 'rgba(197,160,89,0.4)', letterSpacing: '5px', marginBottom: 20 }}>ENTRANCE TRIBUTE</div>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(2rem, 6vw, 3rem)', color: '#c5a059', fontWeight: 700, letterSpacing: '4px', marginBottom: 8 }}>€55</div>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.28)', letterSpacing: '2px', marginBottom: 36 }}>One-time entrance tribute. Permanent access.</div>

                    <div style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 12, padding: '22px 24px', marginBottom: 32, textAlign: 'left' }}>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.4rem', color: 'rgba(197,160,89,0.4)', letterSpacing: '3px', marginBottom: 14 }}>WHAT YOU GAIN</div>
                        {[
                            'Full access to all challenges and task assignments',
                            'Direct communication with Queen Karin',
                            'Daily kneeling rituals with coin and merit rewards',
                            'Ranked standing on the global leaderboard',
                            'Exclusive content and Queen\'s posts',
                        ].map(item => (
                            <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                                <span style={{ color: 'rgba(197,160,89,0.5)', fontSize: '0.65rem', marginTop: 1, flexShrink: 0 }}>✦</span>
                                <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{item}</span>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={handleTribute}
                        disabled={loading}
                        style={{
                            width: '100%', padding: '20px 24px',
                            background: 'linear-gradient(135deg, #0a0602 0%, #1a1208 30%, #c5a059 60%, #e8d5a8 80%, #c5a059 100%)',
                            backgroundSize: '250% 250%', backgroundPosition: '0% 0%',
                            border: '1px solid rgba(197,160,89,0.5)',
                            color: '#fff', fontFamily: 'Cinzel, serif', fontWeight: 700,
                            fontSize: '0.8rem', letterSpacing: '8px', textTransform: 'uppercase',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.6 : 1,
                            borderRadius: 4, marginBottom: 16,
                            boxShadow: '0 0 30px rgba(197,160,89,0.15), 0 8px 40px rgba(0,0,0,0.4)',
                            transition: 'all 0.3s',
                        }}
                    >
                        {loading ? 'Initializing...' : 'Send Tribute'}
                    </button>

                    {status && (
                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.6rem', color: '#c5a059', letterSpacing: '2px', marginBottom: 16 }}>{status}</div>
                    )}

                    {userEmail && (
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.38rem', color: 'rgba(197,160,89,0.25)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 20 }}>
                            Logged in as <span style={{ color: 'rgba(197,160,89,0.45)' }}>{userEmail}</span>
                        </div>
                    )}

                    <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.18)', fontFamily: 'Cinzel, serif', fontSize: '0.6rem', letterSpacing: '2px', cursor: 'pointer', padding: '8px 0' }}>
                        Logout / Switch account
                    </button>

                    <div style={{ marginTop: 40, fontFamily: 'Orbitron, sans-serif', fontSize: '0.38rem', color: 'rgba(255,255,255,0.08)', letterSpacing: '3px', textTransform: 'uppercase' }}>
                        Property of Queen Karin &nbsp;·&nbsp; Est. 2024
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                }
            `}</style>
        </div>
    );
}
