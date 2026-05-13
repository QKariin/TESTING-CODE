"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import '@/css/landing.css';

/* ── TYPES ── */
interface LeaderboardEntry {
    name?: string;
    avatar?: string;
    hierarchy?: string;
    score?: number;
}

interface ReviewData {
    text?: string;
    rating?: number;
    reviewer?: {
        name?: string;
        avatar?: string;
        hierarchy?: string;
        merit?: number;
        tasksCompleted?: number;
        servingText?: string;
    };
}

interface ToastItem {
    sender_name: string;
    sender_avatar?: string | null;
    hierarchy?: string | null;
    text?: string;
    kind: string;
    created_at?: string;
    // risky tribute fields
    cardIcon?: string | null;
    cardName?: string | null;
    isWin?: boolean;
    stakeAmount?: number;
    wonAmount?: number;
    lostAmount?: number;
    // wishlist fields
    cardImage?: string | null;
}

interface GlobalMessage {
    id?: string | number;
    message?: string;
    content?: string;
    created_at?: string;
    sender_avatar?: string | null;
    hierarchy?: string | null;
}

/* ── STAR SVG for marquee ── */
const MarqueeStar = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(197,160,89,0.5)" style={{ margin: '0 14px', flexShrink: 0 }}>
        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
    </svg>
);

/* ── MARQUEE TRACK (repeated items) ── */
const MarqueeTrack = () => (
    <span className="home-marquee-track" style={{ display: 'inline-flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
        <span>Tasks</span><MarqueeStar />
        <span>Sessions</span><MarqueeStar />
        <span>League</span><MarqueeStar />
        <span>Tributes</span><MarqueeStar />
        <span>Tasks</span><MarqueeStar />
        <span>Sessions</span><MarqueeStar />
        <span>League</span><MarqueeStar />
        <span>Tributes</span><MarqueeStar />
    </span>
);

/* ── HELPER: timeAgo ── */
function timeAgo(dateStr: string): string {
    const utcStr = (dateStr.endsWith('Z') || dateStr.indexOf('+') > -1) ? dateStr : dateStr + 'Z';
    const diff = Date.now() - new Date(utcStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    return days + 'd ago';
}

/* ── HELPER: parseGlobalCard ── */
function parseGlobalCard(msg: GlobalMessage): ToastItem | null {
    const content = msg.message || msg.content || '';
    const created = msg.created_at;
    const avatar = msg.sender_avatar || null;
    const hier = msg.hierarchy || null;
    try {
        if (content.indexOf('RISKY_TRIBUTE_CARD::') === 0) {
            const d = JSON.parse(content.replace('RISKY_TRIBUTE_CARD::', ''));
            return { sender_name: d.senderName || 'SUBJECT', sender_avatar: d.senderAvatar || avatar, hierarchy: hier, kind: 'risky', cardIcon: d.icon || null, cardName: d.cardName || null, isWin: d.isWin, stakeAmount: d.stakeAmount || 0, wonAmount: d.wonAmount || 0, lostAmount: d.lostAmount || 0, created_at: created };
        }
        if (content.indexOf('DIRECT_TRIBUTE_CARD::') === 0) {
            const d = JSON.parse(content.replace('DIRECT_TRIBUTE_CARD::', ''));
            return { sender_name: d.senderName || 'SUBJECT', sender_avatar: d.senderAvatar || avatar, hierarchy: hier, text: 'sent a tribute of ' + (d.amount || 0).toLocaleString() + ' coins', kind: 'tribute', created_at: created };
        }
        if (content.indexOf('PROMOTION_CARD::') === 0) {
            const d = JSON.parse(content.replace('PROMOTION_CARD::', ''));
            return { sender_name: d.name || 'SUBJECT', sender_avatar: avatar, hierarchy: hier, text: 'was promoted to ' + (d.newRank || 'a new rank'), kind: 'promotion', created_at: created };
        }
        if (content.indexOf('CHALLENGE_TASK_CARD::') === 0) {
            const d = JSON.parse(content.replace('CHALLENGE_TASK_CARD::', ''));
            return { sender_name: d.senderName || 'SUBJECT', sender_avatar: d.senderAvatar || avatar, hierarchy: hier, text: 'completed a challenge task', kind: 'challenge', created_at: created };
        }
        if (content.indexOf('WELCOME_CARD::') === 0) {
            const d = JSON.parse(content.replace('WELCOME_CARD::', ''));
            return { sender_name: d.name || 'New Subject', sender_avatar: avatar, hierarchy: hier, text: 'entered the household', kind: 'welcome', created_at: created };
        }
        if (content.indexOf('UPDATE_MERIT_CARD::') === 0) {
            const d = JSON.parse(content.replace('UPDATE_MERIT_CARD::', ''));
            return { sender_name: d.senderName || 'SUBJECT', sender_avatar: d.senderAvatar || avatar, hierarchy: hier, text: 'earned ' + (d.points || 0) + ' points', kind: 'merit', created_at: created };
        }
        if (content.indexOf('UPDATE_COINS_CARD::') === 0) {
            const d = JSON.parse(content.replace('UPDATE_COINS_CARD::', ''));
            return { sender_name: d.senderName || 'SUBJECT', sender_avatar: d.senderAvatar || avatar, hierarchy: hier, text: 'claimed ' + (d.points || 0) + ' coins from kneeling', kind: 'coins', created_at: created };
        }
        if (content.indexOf('CHALLENGE_JOIN_CARD::') === 0) {
            const d = JSON.parse(content.replace('CHALLENGE_JOIN_CARD::', ''));
            return { sender_name: d.senderName || d.name || 'SUBJECT', sender_avatar: d.senderAvatar || avatar, hierarchy: hier, text: 'joined ' + (d.challengeName || 'a challenge'), kind: 'challenge_join', created_at: created };
        }
        if (content.indexOf('UPDATE_TRIBUTE_CARD::') === 0) {
            const d = JSON.parse(content.replace('UPDATE_TRIBUTE_CARD::', ''));
            return { sender_name: d.senderName || 'SUBJECT', sender_avatar: d.senderAvatar || avatar, hierarchy: hier, text: 'gifted "' + (d.title || 'a gift') + '" worth ' + (d.price || 0).toLocaleString() + ' coins', kind: 'wishlist', cardImage: d.image || null, cardName: d.title || 'GIFT', created_at: created };
        }
    } catch (e) { /* ignore parse errors */ }
    return null;
}

/* ══════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════ */
export default function TestLandingPage() {
    // State
    const [isScrolled, setIsScrolled] = useState(false);
    const [lbPeriod, setLbPeriod] = useState('weekly');
    const [lbEntries, setLbEntries] = useState<LeaderboardEntry[]>([]);
    const [reviews, setReviews] = useState<ReviewData[]>([]);
    const [activeToast, setActiveToast] = useState<ToastItem | null>(null);
    const [toastClass, setToastClass] = useState('');
    const [accessDenied, setAccessDenied] = useState<{ section: string } | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);

    // Refs
    const faqIsOpenRef = useRef(false);
    const fomoFiredRef = useRef(false);
    const lastSeenIdRef = useRef<string | number | null>(null);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const footerFrameRef = useRef<HTMLIFrameElement>(null);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    /* ── Show Toast ── */
    const showToast = useCallback((item: ToastItem) => {
        // Clear any existing timers
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setActiveToast(item);
        setToastClass('entering');

        toastTimerRef.current = setTimeout(() => {
            setToastClass('leaving');
            setTimeout(() => {
                setActiveToast(null);
                setToastClass('');
            }, 500);
        }, 8000);
    }, []);

    /* ── Trigger Fomo Toast ── */
    const triggerFomoToast = useCallback(() => {
        if (fomoFiredRef.current) return;
        fomoFiredRef.current = true;
        setTimeout(() => {
            if (faqIsOpenRef.current) return;
            fetch('/api/global/messages')
                .then(r => r.json())
                .then(data => {
                    const msgs = data.messages || data;
                    if (!Array.isArray(msgs)) return;
                    for (let i = msgs.length - 1; i >= 0; i--) {
                        const parsed = parseGlobalCard(msgs[i]);
                        if (parsed) { showToast(parsed); break; }
                    }
                }).catch(() => {});
        }, 15000);
    }, [showToast]);

    /* ── Show Access Denied ── */
    const showAccessDenied = useCallback((section: string) => {
        setAccessDenied(prev => {
            if (prev && prev.section === section) return null;
            return { section };
        });
    }, []);

    /* ── Scroll listener ── */
    useEffect(() => {
        const handleScroll = () => {
            const y = window.scrollY;
            setIsScrolled(y > window.innerHeight * 0.7);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    /* ── IntersectionObserver for funnel-section ── */
    useEffect(() => {
        const funnelObs = new IntersectionObserver((entries) => {
            entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
        }, { threshold: 0.15 });
        document.querySelectorAll('.funnel-section').forEach(s => funnelObs.observe(s));
        return () => funnelObs.disconnect();
    }, []);

    /* ── IntersectionObserver for glass-box ── */
    useEffect(() => {
        const focusObs = new IntersectionObserver((entries) => {
            entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('sharp'); });
        }, { threshold: 0.1 });
        document.querySelectorAll('.glass-box').forEach(b => focusObs.observe(b));
        return () => focusObs.disconnect();
    }, []);

    /* ── Load leaderboard ── */
    useEffect(() => {
        fetch('/api/global/leaderboard?period=' + lbPeriod)
            .then(r => r.json())
            .then(d => {
                if (d.entries) setLbEntries(d.entries.slice(0, 10));
                else setLbEntries([]);
            }).catch(() => setLbEntries([]));
    }, [lbPeriod]);

    /* ── Load reviews ── */
    useEffect(() => {
        fetch('/api/reviews/public')
            .then(r => r.json())
            .then(data => {
                const revs = data.reviews || data;
                if (Array.isArray(revs)) setReviews(revs.slice(0, 6));
            }).catch(() => {});
    }, []);

    /* ── Footer iframe message listener ── */
    useEffect(() => {
        const handleMessage = (e: MessageEvent) => {
            if (!e.data || typeof e.data.type !== 'string') return;
            const frame = footerFrameRef.current;

            if (e.data.type === 'navClick') {
                showAccessDenied(e.data.section);
            }
            if (e.data.type === 'faqOpen') {
                faqIsOpenRef.current = true;
                if (frame) { frame.style.height = '100%'; frame.style.top = '0'; }
            }
            if (e.data.type === 'faqClose') {
                faqIsOpenRef.current = false;
                setTimeout(() => {
                    if (frame) { frame.style.height = 'calc(140px + env(safe-area-inset-bottom))'; frame.style.top = 'auto'; }
                }, 400);
            }
            if (e.data.type === 'notifShow') {
                if (frame && frame.style.top !== '0') frame.style.height = 'calc(220px + env(safe-area-inset-bottom))';
            }
            if (e.data.type === 'notifHide') {
                if (frame && frame.style.top !== '0') frame.style.height = 'calc(140px + env(safe-area-inset-bottom))';
            }
            if (e.data.type === 'faqOpened') {
                triggerFomoToast();
            }
            if (e.data.type === 'dismissAccessDenied') {
                setAccessDenied(null);
            }
            if (e.data.type === 'openMenu') {
                setMenuOpen(prev => !prev);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [showAccessDenied, triggerFomoToast]);

    /* ── Realtime activity polling ── */
    useEffect(() => {
        // Get initial latest ID
        fetch('/api/global/messages')
            .then(r => r.json())
            .then(data => {
                const msgs = data.messages || data;
                if (Array.isArray(msgs) && msgs.length > 0) {
                    lastSeenIdRef.current = msgs[msgs.length - 1].id;
                }
            })
            .catch(() => {});

        // Start polling after a short delay
        const startPolling = setTimeout(() => {
            pollIntervalRef.current = setInterval(() => {
                if (faqIsOpenRef.current) return;
                fetch('/api/global/messages')
                    .then(r => r.json())
                    .then(data => {
                        const msgs = data.messages || data;
                        if (!Array.isArray(msgs) || msgs.length === 0) return;
                        const latest = msgs[msgs.length - 1];
                        if (!latest.id || latest.id === lastSeenIdRef.current) return;
                        lastSeenIdRef.current = latest.id;
                        const parsed = parseGlobalCard(latest);
                        if (parsed) showToast(parsed);
                    })
                    .catch(() => {});
            }, 30000);
        }, 1000);

        return () => {
            clearTimeout(startPolling);
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        };
    }, [showToast]);

    /* ── Apply body styles for the page ── */
    useEffect(() => {
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        const html = document.documentElement;
        html.style.scrollbarWidth = 'none';
        (html.style as any).msOverflowStyle = 'none';

        return () => {
            document.body.style.margin = '';
            document.body.style.padding = '';
            html.style.scrollbarWidth = '';
            (html.style as any).msOverflowStyle = '';
        };
    }, []);

    /* ── Render Toast HTML ── */
    const renderToast = () => {
        if (!activeToast) return null;
        const item = activeToast;
        const initial = (item.sender_name || 'S').charAt(0).toUpperCase();
        const isRisky = item.kind === 'risky' && item.cardIcon;
        const isWishlist = item.kind === 'wishlist' && item.cardImage;

        const renderAvatar = (size: number, borderColor: string) => {
            if (item.sender_avatar) {
                return <img src={item.sender_avatar} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${borderColor}`, flexShrink: 0 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />;
            }
            return (
                <div style={{ width: size, height: size, borderRadius: '50%', border: `1.5px solid rgba(197,160,89,0.35)`, background: 'linear-gradient(135deg,rgba(197,160,89,0.15),rgba(197,160,89,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cinzel,serif', fontSize: '0.9rem', color: 'rgba(197,160,89,0.6)', fontWeight: 600, flexShrink: 0 }}>
                    {initial}
                </div>
            );
        };

        if (isWishlist) {
            return (
                <div className={`home-toast ${toastClass}`} onClick={() => { setActiveToast(null); setToastClass(''); }} style={{ padding: 0 }}>
                    <div style={{ display: 'flex', minHeight: 120 }}>
                        <div style={{ flex: '0 0 28%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(197,160,89,0.04)', borderRight: '1px solid rgba(197,160,89,0.12)', padding: 12 }}>
                            <img src={item.cardImage!} style={{ width: '80%', maxWidth: 70, height: 'auto', borderRadius: 6, objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        </div>
                        <div style={{ flex: 1, padding: '12px 14px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {renderAvatar(38, 'rgba(197,160,89,0.5)')}
                                <div>
                                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.85rem', color: '#c5a059', letterSpacing: 1 }}>{item.sender_name}</div>
                                    {item.hierarchy && <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.35rem', color: 'rgba(197,160,89,0.4)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 1 }}>{item.hierarchy}</div>}
                                </div>
                            </div>
                            <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)', fontWeight: 400, marginTop: 4, letterSpacing: 0.5 }}>{item.text || ''}</div>
                        </div>
                    </div>
                </div>
            );
        }

        if (isRisky) {
            const resultText = item.isWin
                ? <span style={{ color: '#4ade80' }}>total won: {(item.wonAmount || 0).toLocaleString()}</span>
                : item.lostAmount === 0
                    ? <span style={{ color: '#c5a059' }}>lost nothing</span>
                    : <span style={{ color: '#ff0000' }}>total lost: {(item.lostAmount || 0).toLocaleString()}</span>;

            return (
                <div className={`home-toast ${toastClass}`} onClick={() => { setActiveToast(null); setToastClass(''); }} style={{ padding: 0 }}>
                    <div style={{ display: 'flex', minHeight: 130 }}>
                        <div style={{ flex: '0 0 28%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(197,160,89,0.04)', borderRight: '1px solid rgba(197,160,89,0.12)', padding: '16px 12px', gap: 8 }}>
                            <img src={item.cardIcon!} style={{ width: '65%', maxWidth: 65, height: 'auto', opacity: 0.9 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            {item.cardName && <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.4rem', color: 'rgba(197,160,89,0.45)', letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.3 }}>{item.cardName}</div>}
                        </div>
                        <div style={{ flex: 1, padding: '12px 14px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {renderAvatar(38, 'rgba(197,160,89,0.5)')}
                                <div>
                                    <div style={{ fontFamily: 'Rosella Solid,serif', fontSize: '0.85rem', color: '#c5a059', letterSpacing: 1 }}>{item.sender_name}</div>
                                    {item.hierarchy && <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.35rem', color: 'rgba(197,160,89,0.4)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 1 }}>{item.hierarchy}</div>}
                                </div>
                            </div>
                            <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)', fontWeight: 400, marginTop: 4, letterSpacing: 0.5 }}>just gambled {(item.stakeAmount || 0).toLocaleString()} coins</div>
                            <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.75rem', fontWeight: 600, marginTop: 2, letterSpacing: 0.5 }}>{resultText}</div>
                        </div>
                    </div>
                </div>
            );
        }

        // Default toast
        return (
            <div className={`home-toast ${toastClass}`} onClick={() => { setActiveToast(null); setToastClass(''); }} style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {renderAvatar(46, 'rgba(197,160,89,0.6)')}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'Rosella Solid,serif', fontSize: '0.9rem', color: '#c5a059', letterSpacing: 1, lineHeight: 1.2 }}>{item.sender_name}</div>
                        {item.hierarchy && <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.4rem', color: 'rgba(197,160,89,0.4)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 2 }}>{item.hierarchy}</div>}
                        <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)', fontWeight: 500, lineHeight: 1.4, marginTop: 4 }}>{item.text || ''}</div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className={`landing-page${isScrolled ? ' scrolled' : ''}`}>
            {/* Google Fonts */}
            {/* eslint-disable-next-line @next/next/no-page-custom-font */}
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            {/* eslint-disable-next-line @next/next/no-page-custom-font */}
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            {/* eslint-disable-next-line @next/next/no-page-custom-font */}
            <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Orbitron:wght@400;500;700&family=Rajdhani:wght@400;500;600&display=swap" rel="stylesheet" />


            {/* Loader Gate (hidden, same as current) */}
            <div id="loader-gate" style={{ display: 'none' }}>
                <div className="kneel-wrapper" id="kneelBtn">
                    <div className="kneel-text">KNEEL TO ENTER</div>
                    <div className="kneel-fill" id="kneelFill" />
                </div>
                <a href="/profile" className="btn-slave">ALREADY A SLAVE</a>
            </div>

            {/* Fixed dark tint — stays forever */}
            <div style={{ position: 'fixed', inset: 0, zIndex: 1, background: 'rgba(0,0,0,0.4)', pointerEvents: 'none' }} />

            {/* Hero header — scrolls with page */}
            <header style={{ position: 'relative', zIndex: 2, height: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10vh', background: 'rgba(5,5,6,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
                <div className="header-inner">
                    <div className="welcome">WELCOME TO</div>
                    <h1 className="royal-brand">Queen Karin&apos;s</h1>
                    <div className="mix-box">
                        <span className="s-kink">Kink</span>
                        <span className="s-dom">-dom</span>
                    </div>
                    <div className="tiny-seal">
                        <h2>NO AGENCIES &bull; NO BOTS &bull; NO FAKES</h2>
                    </div>
                    <nav className="shelf-nav-wrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '28px', marginTop: 20, width: '100%', maxWidth: 300 }}>
                        <a href="#about" className="shelf-nav-btn">About Me</a>
                        <a href="#leaderboard-section" className="shelf-nav-btn">Hierarchy</a>
                        <a href="#services" className="shelf-nav-btn">Service</a>
                        <a href="#reviews" className="shelf-nav-btn">Feedback</a>
                        <button className="shelf-nav-btn" onClick={() => { const f = document.getElementById('footerFrame') as HTMLIFrameElement; if (f?.contentWindow) f.contentWindow.postMessage({ type: 'openFaq' }, '*'); }}>FAQ</button>
                    </nav>
                    <a href="/login" className="btn-join" style={{ marginTop: 20 }}>JOIN NOW</a>
                </div>
            </header>

            {/* Sticky nav — appears after scrolling past hero */}
            {isScrolled && (
                <div className="sticky-nav" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: 'rgba(15,15,18,0.98)', backdropFilter: 'blur(25px)', WebkitBackdropFilter: 'blur(25px)', borderBottom: '1px solid rgba(197,160,89,0.1)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <span style={{ fontFamily: 'Cinzel,serif', fontSize: 14, fontWeight: 700, letterSpacing: 3, color: '#c5a059', lineHeight: 1 }}>Queen Karin&apos;s</span>
                        <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 2 }}>
                            <span style={{ fontFamily: 'Italianno,cursive', fontSize: 20, color: '#fff' }}>Kink</span>
                            <span style={{ fontFamily: 'Cinzel,serif', fontSize: 8, color: '#fff', opacity: 0.6, marginLeft: 4, letterSpacing: 4 }}>-DOM</span>
                        </div>
                    </div>
                    <a href="/login" style={{ fontFamily: 'Cinzel,serif', fontSize: 11, fontWeight: 700, letterSpacing: 3, color: '#c5a059', textDecoration: 'none', padding: '10px 28px', background: 'linear-gradient(#080604,#080604) padding-box, linear-gradient(135deg,transparent,#c5a059 40%,transparent 60%,#c5a059) border-box', border: '1.5px solid transparent', borderRadius: 999 }}>JOIN</a>
                </div>
            )}

            {/* Menu overlay from footer hamburger */}
            {menuOpen && (
                <div className="hamburger-menu" style={{ position: 'fixed', bottom: 'calc(60px + env(safe-area-inset-bottom))', left: 0, right: 0, zIndex: 9999998 }}>
                    <a href="#about" onClick={() => setMenuOpen(false)}>About Me</a>
                    <a href="#leaderboard-section" onClick={() => setMenuOpen(false)}>Hierarchy</a>
                    <a href="#services" onClick={() => setMenuOpen(false)}>Service</a>
                    <a href="#reviews" onClick={() => setMenuOpen(false)}>Feedback</a>
                    <button onClick={() => { setMenuOpen(false); const f = document.getElementById('footerFrame') as HTMLIFrameElement; if (f?.contentWindow) f.contentWindow.postMessage({ type: 'openFaq' }, '*'); }}>FAQ</button>
                    <a href="/login" onClick={() => setMenuOpen(false)}>Join Now</a>
                </div>
            )}

            {/* Main Content */}
            <main className="content-flow" style={{ position: 'relative', zIndex: 3, background: 'rgba(5,5,6,0.82)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>

                {/* ABOUT */}
                <section className="funnel-section" id="about">
                    <div className="funnel-label">THE SOVEREIGN</div>
                    <h2 className="funnel-title">Queen Karin</h2>
                    <div className="funnel-divider" />
                    <p className="funnel-text">Three years building what no platform dared to create. Not a profile on someone else&apos;s site. Not a clip store. A private world with its own economy, its own hierarchy, and one absolute ruler.</p>
                    <p className="funnel-text dim">I don&apos;t audition. I don&apos;t negotiate. I don&apos;t convince. I open doors, and I close them just as easily.</p>
                    <div className="section-gallery">
                        <div className="section-gallery-item"><img src="/queen-profile.png" alt="" /><div className="section-gallery-label">The Queen</div></div>
                        <div className="section-gallery-item"><img src="/queen-bg-mobile.jpg" alt="" /><div className="section-gallery-label">My World</div></div>
                    </div>
                </section>

                <section className="funnel-section">
                    <div className="funnel-label">FEMDOM</div>
                    <div className="funnel-divider" />
                    <p className="funnel-text">Control is not a roleplay I put on. It is who I am. Every interaction, every rule, every punishment exists because I designed it that way. Obedience is not requested. It is the price of entry.</p>
                    <p className="funnel-text dim">I don&apos;t play Domme. I live it. The difference is everything.</p>
                    <div className="section-gallery">
                        <div className="section-gallery-item"><img src="/queen-karin.png" alt="" /><div className="section-gallery-label">Authority</div></div>
                        <div className="section-gallery-item"><img src="/login-bg.png" alt="" /><div className="section-gallery-label">Discipline</div></div>
                    </div>
                </section>

                <section className="funnel-section">
                    <div className="funnel-label">KINKS</div>
                    <div className="funnel-divider" />
                    <p className="funnel-text">Chastity. Financial domination. Sissification. Task training. Body worship. Humiliation. Not a menu to pick from. A system to be placed into, based on what I decide you need.</p>
                    <p className="funnel-text dim">You don&apos;t choose your kink here. I do.</p>
                    <div className="section-gallery three-up">
                        <div className="section-gallery-item"><img src="/collar-placeholder.png" alt="" /><div className="section-gallery-label">Chastity</div></div>
                        <div className="section-gallery-item"><img src="/academy-obedience.png" alt="" /><div className="section-gallery-label">Training</div></div>
                        <div className="section-gallery-item"><img src="/hero-bg.png" alt="" /><div className="section-gallery-label">Worship</div></div>
                    </div>
                </section>

                <section className="funnel-section">
                    <div className="funnel-label">VANILLA</div>
                    <div className="funnel-divider" />
                    <p className="funnel-text">Behind the protocol there is a real woman. I travel, I cook, I laugh too loud, I overthink everything. I build things obsessively and care deeply about the people in my world.</p>
                    <p className="funnel-text dim">Kink without personality is just noise. You are not serving a character. You are serving a person.</p>
                    <div className="section-gallery">
                        <div className="section-gallery-item wide"><img src="/og-cover.png" alt="" /><div className="section-gallery-label">The Real Me</div></div>
                    </div>
                </section>

                <section className="funnel-section">
                    <div className="funnel-label">GOALS</div>
                    <div className="funnel-divider" />
                    <p className="funnel-text">This app is only the beginning. A full ecosystem where devotion has real weight, real consequence, and real reward. A household that operates like a private empire, not a content page.</p>
                    <p className="funnel-text dim">I am not building a following. I am building a legacy.</p>
                    <div className="section-gallery">
                        <div className="section-gallery-item"><img src="/queen-bg-desktop.png" alt="" /><div className="section-gallery-label">The Vision</div></div>
                        <div className="section-gallery-item"><img src="/queen-nav.png" alt="" /><div className="section-gallery-label">The Empire</div></div>
                    </div>
                </section>

                {/* LEADERBOARD */}
                <section className="funnel-section" id="leaderboard-section">
                    <div className="funnel-label">THE HIERARCHY</div>
                    <div className="funnel-divider" />
                    <div style={{ overflow: 'hidden', margin: '0 -20px 20px', maskImage: 'linear-gradient(90deg,transparent,black 15%,black 85%,transparent)', WebkitMaskImage: 'linear-gradient(90deg,transparent,black 15%,black 85%,transparent)' }}>
                        <div className="home-marquee" style={{ display: 'flex', alignItems: 'center', gap: 0, whiteSpace: 'nowrap', fontFamily: 'Cinzel,serif', fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase' }}>
                            <MarqueeTrack />
                            <MarqueeTrack />
                        </div>
                    </div>
                    <div className="lb-tabs">
                        {(['today', 'weekly', 'monthly', 'alltime'] as const).map(period => {
                            const labels: Record<string, string> = { today: 'TODAY', weekly: 'WEEK', monthly: 'MONTH', alltime: 'ALL' };
                            return (
                                <button
                                    key={period}
                                    className={`lb-tab${lbPeriod === period ? ' active' : ''}`}
                                    onClick={() => setLbPeriod(period)}
                                >
                                    {labels[period]}
                                </button>
                            );
                        })}
                    </div>
                    <div id="lbEntries">
                        {lbEntries.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '30px 0', fontFamily: 'Cinzel,serif', fontSize: 12, color: 'rgba(255,255,255,0.12)' }}>No scores yet</div>
                        ) : (
                            lbEntries.map((e, i) => {
                                const cls = i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : 'minor';
                                const av = e.avatar ? { backgroundImage: `url(${e.avatar})` } : {};
                                return (
                                    <div key={i} className={`lb-entry ${cls}`}>
                                        <div className="lb-rank">{i + 1}</div>
                                        <div className="lb-avatar" style={av} />
                                        <div className="lb-info">
                                            <div className="lb-name">{e.name || 'Anonymous'}</div>
                                            <div className="lb-hier">{e.hierarchy || ''}</div>
                                        </div>
                                        <div className="lb-score">{e.score ? e.score.toLocaleString() : '0'}</div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </section>

                {/* SERVICES */}
                <section className="funnel-section" id="services">
                    <div className="funnel-label">SERVICES</div>
                    <div className="funnel-divider" />

                    <div className="service-card">
                        <div className="service-icon">&#9919;</div>
                        <h3>KEYHOLDING</h3>
                        <p>Your lock. Her rules. Daily check-ins, real-time control, strict accountability. Not a game, a commitment.</p>
                        <a href="/keyholder" className="service-cta">SURRENDER KEY</a>
                    </div>

                    <div className="service-card">
                        <div className="service-icon">&#9830;</div>
                        <h3>FINANCIAL DOMINATION</h3>
                        <p>Tribute isn&apos;t a transaction. It&apos;s proof of devotion. An economy built on worship, not negotiation.</p>
                        <a href="/login" className="service-cta">ENTER</a>
                    </div>

                    <div className="service-card">
                        <div className="service-icon">&#9878;</div>
                        <h3>TASK TRAINING</h3>
                        <p>Daily assignments. Photo proof. Deadlines. Real consequences. A structured system of obedience with merit and punishment.</p>
                        <a href="/login" className="service-cta">ENTER</a>
                    </div>

                    <div className="service-card">
                        <div className="service-icon">&#9733;</div>
                        <h3>SISSIFICATION</h3>
                        <p>Guided transformation under absolute authority. Wardrobe. Behavior. Identity. Nothing is optional.</p>
                        <a href="/login" className="service-cta">ENTER</a>
                    </div>

                    <div className="service-card">
                        <div className="service-icon">&#9764;</div>
                        <h3>ONLINE DOMINATION</h3>
                        <p>Real-time control from anywhere. Not a fantasy you browse, a lifestyle you live under Her command.</p>
                        <a href="/login" className="service-cta">ENTER</a>
                    </div>
                </section>

                {/* REVIEWS */}
                <section className="funnel-section" id="reviews">
                    <div className="funnel-label">TESTIMONIALS</div>
                    <div className="funnel-divider" />
                    <div id="reviewsContainer">
                        {reviews.map((r, i) => {
                            const rev = r.reviewer || {};
                            const name = rev.name || 'Loyal Subject';
                            const avatar = rev.avatar || null;
                            const hierarchy = rev.hierarchy || 'Hall Boy';
                            const merit = rev.merit || 0;
                            const tasks = rev.tasksCompleted || 0;
                            const serving = rev.servingText || '';
                            const rating = r.rating || 5;
                            const initial = name.charAt(0).toUpperCase();
                            const servingHtml = serving ? ` \u00B7 SERVING ${serving.toUpperCase()}` : '';

                            return (
                                <div key={i} className="review-card">
                                    <div className="review-header">
                                        {avatar ? (
                                            <img className="review-avatar" src={avatar} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                        ) : (
                                            <div className="review-avatar-placeholder">{initial}</div>
                                        )}
                                        <div className="review-meta">
                                            <div className="review-stars">
                                                {Array.from({ length: 5 }, (_, s) => (
                                                    <span key={s} className={s < rating ? 'star-on' : 'star-off'}>&#9733;</span>
                                                ))}
                                            </div>
                                            <div className="review-name">{name}</div>
                                            <div className="review-merit">{merit.toLocaleString()} MERIT &middot; {tasks} TASKS</div>
                                            <div className="review-hierarchy">{hierarchy.toUpperCase()}{servingHtml}</div>
                                        </div>
                                    </div>
                                    <div className="review-body clamped" id={`review-body-${i}`}>
                                        <p>&ldquo;{r.text || ''}&rdquo;</p>
                                    </div>
                                    <button className="review-read-more" onClick={(e) => {
                                        const body = document.getElementById(`review-body-${i}`);
                                        if (body) {
                                            const isClamped = body.classList.toggle('clamped');
                                            (e.target as HTMLElement).textContent = isClamped ? 'READ MORE ▸' : 'SHOW LESS ▴';
                                        }
                                    }}>READ MORE ▸</button>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* FINAL CTA */}
                <section className="funnel-section final-cta">
                    <p className="funnel-text dim" style={{ marginBottom: 15 }}>You either feel it or you don&apos;t.</p>
                    <a href="/login" className="btn-join">JOIN NOW</a>
                    <p className="funnel-text dim" style={{ marginTop: 40, fontSize: 10, opacity: 0.3 }}>I don&apos;t convince. I open doors.</p>
                </section>

                {/* Bottom padding */}
                <div style={{ height: 'calc(100px + env(safe-area-inset-bottom))' }} />
            </main>

            {/* FOOTER IFRAME */}
            <iframe
                ref={footerFrameRef}
                id="footerFrame"
                src="/footer-faq.html"
                style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    height: 'calc(140px + env(safe-area-inset-bottom))',
                    border: 'none',
                    zIndex: 9999999,
                    background: 'transparent',
                    colorScheme: 'dark',
                }}
            />

            {/* TOAST CONTAINER */}
            <div id="toastContainer" style={{ position: 'fixed', top: 0, left: 0, width: 0, height: 0, overflow: 'visible', zIndex: 99999, pointerEvents: 'none' }}>
                {renderToast()}
            </div>

            {/* ACCESS DENIED OVERLAY */}
            {accessDenied && (
                <div
                    className="access-denied-overlay"
                    onClick={() => setAccessDenied(null)}
                >
                    <div style={{ textAlign: 'center', padding: '40px 30px', maxWidth: 320 }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.5rem', color: 'rgba(197,160,89,0.5)', letterSpacing: 4, marginBottom: 16 }}>ACCESS DENIED</div>
                        <div style={{ fontFamily: 'Cinzel,serif', fontSize: '1.1rem', color: 'rgba(255,255,255,0.7)', marginBottom: 12, lineHeight: 1.5 }}>You don&apos;t have access to {accessDenied.section}</div>
                        <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.3)', lineHeight: 1.6, marginBottom: 24 }}>Unlock your experience to explore everything inside.</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                onClick={() => setAccessDenied(null)}
                                style={{ flex: 1, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 0', borderRadius: 8, fontFamily: 'Cinzel,serif', fontSize: '0.5rem', letterSpacing: 2, cursor: 'pointer' }}
                            >
                                CLOSE
                            </button>
                            <button
                                onClick={() => {
                                    setAccessDenied(null);
                                    window.location.href = '/login';
                                }}
                                style={{ flex: 2, background: 'linear-gradient(135deg,#c5a059 0%,#8a6d30 100%)', color: '#020202', border: 'none', padding: '10px 0', borderRadius: 8, fontFamily: 'Cinzel,serif', fontSize: '0.5rem', fontWeight: 700, letterSpacing: 2, cursor: 'pointer' }}
                            >
                                UNLOCK
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SEO content -- invisible to users, crawlable by Google */}
            <main aria-hidden="true" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
                <header>
                    <h1>Queen Karin -- Femdom, Findom &amp; Female Domination</h1>
                    <p>No agencies. No bots. No fakes.</p>
                    <a href="/login">Join Now</a>
                </header>
                <section>
                    <h2>The Sovereign -- Queen Karin</h2>
                    <p>Three years building what no platform dared to create. Not a profile on someone else&apos;s site. Not a clip store. A private world with its own economy, its own hierarchy, and one absolute ruler.</p>
                    <p>I don&apos;t audition. I don&apos;t negotiate. I don&apos;t convince. I open doors, and I close them just as easily.</p>
                </section>
                <section>
                    <h2>Services -- What Happens Inside</h2>
                    <article>
                        <h3>Keyholding &amp; Chastity Control</h3>
                        <p>Your lock. Her rules. Daily check-ins, real-time control, strict accountability. Not a game, a commitment.</p>
                        <a href="/keyholder">Surrender Key</a>
                    </article>
                    <article>
                        <h3>Financial Domination</h3>
                        <p>Tribute isn&apos;t a transaction. It&apos;s proof of devotion. An economy built on worship, not negotiation.</p>
                    </article>
                    <article>
                        <h3>Task Training &amp; Obedience</h3>
                        <p>Daily assignments. Photo proof. Deadlines. Real consequences. A structured system of obedience with merit and punishment.</p>
                    </article>
                    <article>
                        <h3>Sissification &amp; Guided Transformation</h3>
                        <p>Guided transformation under absolute authority. Wardrobe. Behavior. Identity. Nothing is optional.</p>
                    </article>
                    <article>
                        <h3>Online Domination</h3>
                        <p>Real-time control from anywhere. Not a fantasy you browse, a lifestyle you live under Her command.</p>
                    </article>
                </section>
                <section>
                    <h2>Testimonials -- From Those Who Knelt</h2>
                    <p>Real reviews from verified members of Queen Karin&apos;s household.</p>
                </section>
                <section>
                    <h2>The Hierarchy -- Leaderboard</h2>
                    <p>Your place is earned. Rise through the ranks by proving your devotion through tasks, tributes, and obedience.</p>
                </section>
                <footer>
                    <p>Queen Karin -- Real femdom, real control. Apply to serve or stay locked out.</p>
                    <a href="/apply">Apply to Serve</a>
                    <a href="/login">Sign In</a>
                    <a href="/keyholder">Keyholder Sessions</a>
                </footer>
            </main>
        </div>
    );
}
