"use client";

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';

const RANKS = [
    { title: "Hall Boy", contact: "15MIN DAILY SLOT", earn: "You are noticed. Your record begins the moment you join. Queen Karin is watching.", speakCost: 20, benefits: ["Identity: You are granted a Name.", "Labor: Permission to begin Basic Tasks."], req: { tasks: 0, kneels: 0, points: 0, spent: 0, streak: 0 } },
    { title: "Footman", contact: "30MIN DAILY SLOT", earn: "You are being evaluated for reliability and speed. Daily contact slot doubles.", speakCost: 15, benefits: ["Presence: Your Face may be revealed.", "Order: Access to the Daily Routine."], req: { tasks: 5, kneels: 10, points: 2000, spent: 0, streak: 0 } },
    { title: "Silverman", contact: "30MIN DAILY SLOT", earn: "Access to advanced challenges. Queen Karin expects more. You begin to show real worth.", speakCost: 10, benefits: ["Chat Upgrade: Permission to send Photos.", "Devotion: Tasks tailored to your Desires.", "Booking: Permission to request Sessions."], req: { tasks: 25, kneels: 65, points: 5000, spent: 5000, streak: 5 } },
    { title: "Butler", contact: "DAILY 2x30MIN SLOTS", earn: "Two 30-minute sessions daily. Trust established. You are now a fixture of service.", speakCost: 5, benefits: ["Chat Upgrade: Permission to send Videos.", "Voice: Access to Audio Sessions."], req: { tasks: 100, kneels: 250, points: 10000, spent: 50000, streak: 30 } },
    { title: "Chamberlain", contact: "UNLIMITED", earn: "Unlimited contact. Senior position. Queen Karin relies on your presence and performance.", speakCost: 0, benefits: ["Speech: All messaging is Free.", "Visuals: Access to Video Sessions.", "Honor: Access to Elite Trials."], req: { tasks: 300, kneels: 750, points: 50000, spent: 150000, streak: 90 } },
    { title: "Secretary", contact: "UNLIMITED", earn: "Inner Circle access. You handle matters of trust. Unlimited and unrestricted presence.", speakCost: 0, benefits: ["The Line: A direct Audio Connection.", "Authority: Access to System Commands.", "The Throne: Total, Unfiltered Access."], req: { tasks: 500, kneels: 1500, points: 100000, spent: 500000, streak: 180 } },
    { title: "Queen's Champion", contact: "LEGENDARY", earn: "The highest honour. Legendary status. This is not a rank — it is a bond.", speakCost: 0, benefits: ["Absolute Authority.", "Manifest Will.", "Total Ownership."], req: { tasks: 1000, kneels: 3000, points: 250000, spent: 1000000, streak: 365 } },
];

const TRACKED = [
    { label: "Tasks Completed", desc: "Every task assigned, executed, and graded." },
    { label: "Kneeling Sessions", desc: "Daily worship sessions — time and frequency." },
    { label: "Tribute History", desc: "Full financial devotion record." },
    { label: "Locked Time", desc: "Total time spent under lock and control." },
    { label: "Consistency Score", desc: "Your reliability and daily commitment level." },
    { label: "Daily Routine", desc: "Morning and evening routine upload history." },
];


export default function TributePage() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [activeRank, setActiveRank] = useState(0);

    const [visibleItems, setVisibleItems] = useState<boolean[]>(Array(6).fill(false));
    const [sectionVisible, setSectionVisible] = useState(false);
    const trackedOuterRef = useRef<HTMLDivElement>(null);
    const touchStartXRef = useRef<number>(0);

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
        const el = trackedOuterRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting) return;
            observer.disconnect();
            setSectionVisible(true);
            TRACKED.forEach((_, i) => {
                setTimeout(() => {
                    setVisibleItems(prev => { const n = [...prev]; n[i] = true; return n; });
                }, 200 + i * 350);
            });
        }, { threshold: 0.2 });
        observer.observe(el);
        return () => observer.disconnect();
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
        <div style={{ background: '#020512', color: '#fff', overflowX: 'hidden' }}>
            {/* Fixed backgrounds */}
            <div style={{ position: 'fixed', inset: 0, backgroundImage: "url('/hero-bg.png')", backgroundSize: 'cover', backgroundPosition: 'center top', opacity: 0.42, zIndex: 0, pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(180deg, rgba(2,5,18,0.55) 0%, rgba(2,5,18,0.75) 60%, rgba(2,5,18,0.92) 100%)', zIndex: 0, pointerEvents: 'none' }} />

            {/* ── ALL CONTENT ── */}
            <div style={{ position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto', padding: 'clamp(48px,8vw,80px) clamp(20px,5vw,36px) 160px' }}>

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

                {/* ─── TRACKED ITEMS ─── */}
                <div style={{ marginBottom: 52 }}>
                    <div ref={trackedOuterRef} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
                        <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, rgba(197,160,89,0.2))' }} />
                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.4rem', color: 'rgba(197,160,89,0.45)', letterSpacing: '5px', whiteSpace: 'nowrap' }}>YOUR RECORD IS TRACKED</div>
                        <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, rgba(197,160,89,0.2))' }} />
                    </div>
                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)', lineHeight: 1.7, textAlign: 'center', marginBottom: 20 }}>
                        Every action logged. Every absence noted. Queen Karin sees everything.
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, perspective: '800px' }}>
                        {TRACKED.map((item, i) => (
                            <div key={item.label} style={{
                                display: 'flex', alignItems: 'center', gap: 14,
                                padding: '14px 18px',
                                background: 'linear-gradient(160deg, rgba(8,5,20,0.95) 0%, rgba(3,2,14,0.98) 100%)',
                                border: `1px solid ${visibleItems[i] ? 'rgba(197,160,89,0.18)' : 'rgba(197,160,89,0.04)'}`,
                                borderLeft: `2px solid ${visibleItems[i] ? 'rgba(197,160,89,0.5)' : 'rgba(197,160,89,0.06)'}`,
                                borderRadius: 4,
                                opacity: visibleItems[i] ? 1 : 0,
                                transform: visibleItems[i] ? 'rotateX(0deg) translateX(0)' : 'rotateX(-55deg) translateX(-20px)',
                                transformOrigin: 'left center',
                                filter: visibleItems[i] ? 'blur(0)' : 'blur(3px)',
                                transition: 'opacity 0.5s cubic-bezier(0.16,1,0.3,1), transform 0.5s cubic-bezier(0.16,1,0.3,1), filter 0.4s ease, border-color 0.4s ease',
                            }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: gold, boxShadow: `0 0 6px ${gold}`, flexShrink: 0, animation: 'pulse 2s infinite' }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '11px', color: 'rgba(255,255,255,0.85)', letterSpacing: '1.5px', marginBottom: 3 }}>{item.label}</div>
                                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: '13px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>{item.desc}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: gold, boxShadow: `0 0 5px ${gold}`, animation: 'pulse 2s infinite' }} />
                                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '9px', color: 'rgba(197,160,89,0.55)', letterSpacing: '2px' }}>TRACKED</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ─── HIERARCHY ─── */}
                <div style={{ marginBottom: 52 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                        <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, rgba(197,160,89,0.2))' }} />
                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '10px', color: 'rgba(197,160,89,0.45)', letterSpacing: '5px', whiteSpace: 'nowrap' }}>THE HIERARCHY</div>
                        <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, rgba(197,160,89,0.2))' }} />
                    </div>

                    {/* Swipeable carousel */}
                    <div
                        style={{ overflow: 'hidden', borderRadius: 4 }}
                        onTouchStart={(e) => { touchStartXRef.current = e.touches[0].clientX; }}
                        onTouchEnd={(e) => {
                            const diff = touchStartXRef.current - e.changedTouches[0].clientX;
                            if (Math.abs(diff) > 45) {
                                if (diff > 0) setActiveRank(r => Math.min(RANKS.length - 1, r + 1));
                                else setActiveRank(r => Math.max(0, r - 1));
                            }
                        }}
                    >
                        <div style={{ display: 'flex', transform: `translateX(-${activeRank * 100}%)`, transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)' }}>
                            {RANKS.map((rank, i) => {
                                const unlocked = i <= 1;
                                const isFirst = i === 0;
                                const isLast = i === RANKS.length - 1;
                                const reqItems = [
                                    rank.req.tasks > 0 ? { val: rank.req.tasks.toLocaleString(), label: 'TASKS COMPLETED' } : null,
                                    rank.req.kneels > 0 ? { val: rank.req.kneels.toLocaleString(), label: 'KNEELING SESSIONS' } : null,
                                    rank.req.points > 0 ? { val: rank.req.points.toLocaleString(), label: 'MERIT POINTS' } : null,
                                    rank.req.spent > 0 ? { val: rank.req.spent.toLocaleString(), label: 'COINS SPENT' } : null,
                                    rank.req.streak > 0 ? { val: String(rank.req.streak), label: 'DAY STREAK' } : null,
                                ].filter(Boolean) as { val: string; label: string }[];

                                return (
                                    <div key={rank.title} style={{ minWidth: '100%', flex: '0 0 100%' }}>
                                        <div style={{ background: 'linear-gradient(160deg, rgba(6,4,18,0.97) 0%, rgba(3,2,12,0.99) 100%)', border: `1px solid rgba(197,160,89,${unlocked ? '0.25' : '0.08'})`, borderTop: `2px solid rgba(197,160,89,${unlocked ? '0.45' : '0.15'})`, borderRadius: 4, padding: '26px 22px 22px', position: 'relative', overflow: 'hidden' }}>
                                            <div style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: 1, background: 'linear-gradient(to right, transparent, rgba(197,160,89,0.4), transparent)' }} />

                                            {/* Rank counter */}
                                            <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '9px', color: 'rgba(197,160,89,0.35)', letterSpacing: '4px', marginBottom: 10 }}>
                                                RANK {i + 1} OF {RANKS.length}
                                            </div>

                                            {/* Title */}
                                            <div style={{ fontFamily: 'Cinzel,serif', fontSize: '24px', color: isLast ? gold : '#fff', fontWeight: 600, letterSpacing: '2px', marginBottom: 10 }}>{rank.title}</div>

                                            {/* Lock badge for locked ranks */}
                                            {!unlocked && <div style={{ display: 'inline-block', fontFamily: 'Orbitron,sans-serif', fontSize: '9px', color: 'rgba(197,160,89,0.4)', letterSpacing: '3px', padding: '5px 10px', border: '1px solid rgba(197,160,89,0.12)', borderRadius: 3, marginBottom: 22 }}>LOCKED</div>}
                                            {unlocked && <div style={{ marginBottom: 22 }} />}

                                            {/* Body: unlocked or locked */}
                                            {unlocked ? (
                                                <>
                                                    {/* TO REACH THIS RANK */}
                                                    <div style={{ marginBottom: 18 }}>
                                                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '9px', color: 'rgba(197,160,89,0.4)', letterSpacing: '4px', marginBottom: 12 }}>
                                                            {isFirst ? 'YOUR STARTING RANK' : 'TO REACH THIS RANK'}
                                                        </div>
                                                        {isFirst ? (
                                                            <div style={{ fontFamily: 'Cinzel,serif', fontSize: '13px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>This is where every member begins. No requirements. Your record starts here the moment you join.</div>
                                                        ) : (
                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
                                                                {reqItems.map(item => (
                                                                    <div key={item.label} style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.1)', borderLeft: '2px solid rgba(197,160,89,0.3)', borderRadius: 3, padding: '8px 10px' }}>
                                                                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '13px', color: gold, fontWeight: 700, letterSpacing: '0.5px', marginBottom: 2 }}>{item.val}</div>
                                                                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '8px', color: 'rgba(255,255,255,0.3)', letterSpacing: '2px' }}>{item.label}</div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Voice cost */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, padding: '8px 12px', background: 'rgba(197,160,89,0.03)', border: '1px solid rgba(197,160,89,0.1)', borderRadius: 3 }}>
                                                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: gold, flexShrink: 0 }} />
                                                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '9px', color: 'rgba(197,160,89,0.5)', letterSpacing: '3px' }}>VOICE COSTS</div>
                                                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '12px', color: gold, letterSpacing: '1px', marginLeft: 'auto' }}>{rank.speakCost} COINS</div>
                                                    </div>

                                                    {/* Divider */}
                                                    <div style={{ height: 1, background: 'linear-gradient(to right, transparent, rgba(197,160,89,0.15), transparent)', marginBottom: 18 }} />

                                                    {/* WHAT YOU EARN */}
                                                    <div style={{ marginBottom: 22 }}>
                                                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '9px', color: 'rgba(197,160,89,0.4)', letterSpacing: '4px', marginBottom: 10 }}>WHAT YOU EARN</div>
                                                        <div style={{ fontFamily: 'Cinzel,serif', fontSize: '14px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: 12 }}>{rank.earn}</div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                                            {rank.benefits.map((b, j) => (
                                                                <div key={j} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                                                    <div style={{ width: 3, height: 3, background: gold, opacity: 0.5, marginTop: 6, flexShrink: 0, borderRadius: 1 }} />
                                                                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: '13px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{b}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <button onClick={handleTribute} style={{ width: '100%', padding: '13px 0', borderRadius: 4, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#c5a059,#8b6914)', color: '#000', fontFamily: 'Orbitron,sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '3px' }}>
                                                        {isFirst ? 'START HERE' : 'UNLOCK ACCESS'}
                                                    </button>
                                                </>
                                            ) : (
                                                <div style={{ position: 'relative' }}>
                                                    {/* Blurred preview of content */}
                                                    <div style={{ filter: 'blur(5px)', userSelect: 'none', pointerEvents: 'none', opacity: 0.5 }}>
                                                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '9px', color: 'rgba(197,160,89,0.4)', letterSpacing: '4px', marginBottom: 12 }}>TO REACH THIS RANK</div>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', marginBottom: 16 }}>
                                                            {reqItems.map(item => (
                                                                <div key={item.label} style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.1)', borderLeft: '2px solid rgba(197,160,89,0.3)', borderRadius: 3, padding: '8px 10px' }}>
                                                                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '13px', color: gold, fontWeight: 700 }}>{item.val}</div>
                                                                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '8px', color: 'rgba(255,255,255,0.3)', letterSpacing: '2px' }}>{item.label}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '9px', color: 'rgba(197,160,89,0.4)', letterSpacing: '4px', marginBottom: 10 }}>WHAT YOU EARN</div>
                                                        <div style={{ fontFamily: 'Cinzel,serif', fontSize: '14px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: 12 }}>{rank.earn}</div>
                                                        {rank.benefits.map((b, j) => (
                                                            <div key={j} style={{ fontFamily: 'Cinzel,serif', fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: 5 }}>{b}</div>
                                                        ))}
                                                    </div>
                                                    {/* Lock overlay */}
                                                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,5,18,0.82)', backdropFilter: 'blur(3px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, borderRadius: 2 }}>
                                                        <div style={{ width: 32, height: 32, border: `2px solid rgba(197,160,89,0.4)`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <div style={{ width: 10, height: 12, position: 'relative' }}>
                                                                <div style={{ position: 'absolute', top: 4, left: 0, right: 0, bottom: 0, background: 'rgba(197,160,89,0.5)', borderRadius: 2 }} />
                                                                <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 8, height: 7, border: '2px solid rgba(197,160,89,0.5)', borderBottom: 'none', borderRadius: '4px 4px 0 0' }} />
                                                            </div>
                                                        </div>
                                                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '10px', color: 'rgba(197,160,89,0.55)', letterSpacing: '5px', textAlign: 'center' }}>RANK LOCKED</div>
                                                        <div style={{ fontFamily: 'Cinzel,serif', fontSize: '12px', color: 'rgba(255,255,255,0.3)', textAlign: 'center', lineHeight: 1.6, maxWidth: 220 }}>Join and earn your way through the hierarchy to unlock this rank.</div>
                                                        <button onClick={handleTribute} disabled={loading} style={{ marginTop: 4, padding: '11px 28px', background: 'linear-gradient(135deg,#c5a059,#8b6914)', border: 'none', borderRadius: 4, color: '#000', fontFamily: 'Orbitron,sans-serif', fontSize: '10px', letterSpacing: '3px', fontWeight: 700, cursor: 'pointer' }}>
                                                            {loading ? '...' : 'JOIN TO UNLOCK'}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Navigation */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
                        <button onClick={() => setActiveRank(r => Math.max(0, r - 1))} disabled={activeRank === 0} style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '10px', color: activeRank === 0 ? 'rgba(255,255,255,0.1)' : 'rgba(197,160,89,0.6)', background: 'none', border: 'none', cursor: activeRank === 0 ? 'default' : 'pointer', letterSpacing: '2px', padding: '8px 0' }}>
                            PREV
                        </button>
                        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                            {RANKS.map((_, i) => (
                                <div key={i} onClick={() => setActiveRank(i)} style={{ width: i === activeRank ? 18 : 5, height: 5, borderRadius: 3, background: i === activeRank ? gold : i <= 1 ? 'rgba(197,160,89,0.35)' : 'rgba(255,255,255,0.1)', cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: i === activeRank ? `0 0 8px ${gold}` : 'none' }} />
                            ))}
                        </div>
                        <button onClick={() => setActiveRank(r => Math.min(RANKS.length - 1, r + 1))} disabled={activeRank === RANKS.length - 1} style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '10px', color: activeRank === RANKS.length - 1 ? 'rgba(255,255,255,0.1)' : 'rgba(197,160,89,0.6)', background: 'none', border: 'none', cursor: activeRank === RANKS.length - 1 ? 'default' : 'pointer', letterSpacing: '2px', padding: '8px 0' }}>
                            NEXT
                        </button>
                    </div>
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
                            <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.35rem', color: 'rgba(197,160,89,0.4)', letterSpacing: '2px' }}>CHALLENGE TASKS</div>
                        </div>

                        {/* Locked body */}
                        <div style={{ position: 'relative', zIndex: 1 }}>
                            {/* Blurred content behind lock */}
                            <div style={{ padding: '20px 20px 18px', filter: 'blur(5px)', userSelect: 'none', pointerEvents: 'none' }}>
                                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '1.3rem', color: '#fff', fontWeight: 600, marginBottom: 6 }}>Cum Challenge</div>
                                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '13px', color: 'rgba(255,255,255,0.35)', marginBottom: 16 }}>Monthly endurance challenge. Timed windows open without warning.</div>
                                <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                                    {[['30d', 'DURATION'], ['2×', 'DAILY TASKS'], ['15min', 'WINDOWS']].map(([val, lbl]) => (
                                        <div key={lbl} style={{ flex: 1, background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.1)', borderRadius: 8, padding: '10px 6px', textAlign: 'center' }}>
                                            <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '1rem', color: '#fff', fontWeight: 700 }}>{val}</div>
                                            <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '9px', color: 'rgba(197,160,89,0.4)', letterSpacing: '2px', marginTop: 3 }}>{lbl}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* Lock overlay */}
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,5,18,0.75)', backdropFilter: 'blur(2px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                                <div style={{ width: 28, height: 28, border: `2px solid rgba(197,160,89,0.5)`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <div style={{ width: 10, height: 12, borderTop: `2px solid ${gold}`, borderLeft: `2px solid ${gold}`, borderRight: `2px solid ${gold}`, borderRadius: '2px 2px 0 0' }} />
                                </div>
                                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '11px', color: 'rgba(197,160,89,0.7)', letterSpacing: '4px' }}>UNLOCK ACCESS</div>
                                <button onClick={handleTribute} disabled={loading} style={{ marginTop: 4, padding: '10px 28px', background: 'linear-gradient(135deg,#c5a059,#8b6914)', border: 'none', borderRadius: 8, color: '#000', fontFamily: 'Orbitron,sans-serif', fontSize: '11px', letterSpacing: '2px', fontWeight: 700, cursor: 'pointer' }}>
                                    {loading ? '...' : 'JOIN CHALLENGE'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── TASK CARD ─── */}
                <div style={{ marginBottom: 52 }}>
                    {/* duty-label */}
                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontWeight: 400, fontSize: '0.42rem', color: 'rgba(197,160,89,0.45)', letterSpacing: '5px', textTransform: 'uppercase', textAlign: 'center', marginBottom: 16, marginTop: 32, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                        <div style={{ height: 1, flex: 1, maxWidth: 60, background: 'linear-gradient(to right, transparent, rgba(197,160,89,0.3))' }} />
                        CURRENT STATUS
                        <div style={{ height: 1, flex: 1, maxWidth: 60, background: 'linear-gradient(to left, transparent, rgba(197,160,89,0.3))' }} />
                    </div>
                    {/* luxury-card */}
                    <div style={{ background: 'linear-gradient(160deg, rgba(6,4,18,0.97) 0%, rgba(3,2,12,0.99) 100%)', border: '1px solid rgba(197,160,89,0.18)', borderTop: '2px solid rgba(197,160,89,0.35)', boxShadow: '0 24px 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(197,160,89,0.06)', borderRadius: 3, padding: '32px 20px 28px', position: 'relative', overflow: 'hidden', width: '95%', margin: '10px auto', boxSizing: 'border-box', backdropFilter: 'blur(24px)' } as React.CSSProperties}>
                        <div style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: 1, background: 'linear-gradient(to right, transparent, rgba(197,160,89,0.5), transparent)' }} />
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.42rem', fontWeight: 400, letterSpacing: '8px', color: 'rgba(197,160,89,0.28)', textTransform: 'uppercase', textAlign: 'center', marginBottom: 24 }}>AWAITING ORDERS</div>
                            <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, padding: '18px 16px', background: 'rgba(197,160,89,0.03)', borderRadius: 2, marginBottom: 22, border: '1px solid rgba(197,160,89,0.1)', borderLeft: '2px solid rgba(197,160,89,0.3)', letterSpacing: '0.3px', textAlign: 'left' }}>
                                Pay tribute to Queen Karin and gain full access to everything she has built.
                            </div>
                            <button onClick={handleTribute} disabled={loading} style={{ fontFamily: 'Cinzel,serif', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '4px', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', padding: '18px 0', borderRadius: 2, border: 'none', background: 'linear-gradient(135deg,#c5a059,#8b6914)', color: '#000', display: 'block', width: '88%', margin: '0 auto', boxShadow: '0 4px 20px rgba(197,160,89,0.3)', opacity: loading ? 0.6 : 1 }}>
                                {loading ? '...' : 'Send Tribute'}
                            </button>
                        </div>
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
                ::-webkit-scrollbar { display: none; }
            `}</style>
        </div>
    );
}
