"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import '@/css/landing.css';
import { initStreamPreview, destroyStreamPlayer } from '@/scripts/stream-player';

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
        kneelCount?: number;
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
        if (content.indexOf('LEADERBOARD_REWARD_CARD::') === 0) {
            const d = JSON.parse(content.replace('LEADERBOARD_REWARD_CARD::', ''));
            return { sender_name: d.winnerName || 'SUBJECT', sender_avatar: avatar, hierarchy: hier, text: 'is the ' + (d.title || 'CHAMPION') + ' with ' + (d.score || 0).toLocaleString() + ' pts', kind: 'champion', created_at: created };
        }
    } catch (e) { /* ignore parse errors */ }
    return null;
}

/* ══════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════ */
export default function HomeClient({ initialReviews = [] }: { initialReviews?: ReviewData[] }) {
    // State
    const [isScrolled, setIsScrolled] = useState(false);
    const [lbPeriod, setLbPeriod] = useState('weekly');
    const [lbEntries, setLbEntries] = useState<LeaderboardEntry[]>([]);
    const [reviews, setReviews] = useState<ReviewData[]>(initialReviews);
    const [reviewsLoaded, setReviewsLoaded] = useState(initialReviews.length > 0);
    const [showAllReviews, setShowAllReviews] = useState(false);
    const [showAllLb, setShowAllLb] = useState(false);
    const [activeToast, setActiveToast] = useState<ToastItem | null>(null);
    const [toastClass, setToastClass] = useState('');
    const [accessDenied, setAccessDenied] = useState<{ section: string } | null>(null);
    const [iframeFull, setIframeFull] = useState(false);
    const [faqOpen, setFaqOpen] = useState(false);

    // Refs
    const faqIsOpenRef = useRef(false);
    const fomoFiredRef = useRef(false);
    const landingPageRef = useRef<HTMLDivElement>(null);
    const lastSeenIdRef = useRef<string | number | null>(null);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const footerFrameRef = useRef<HTMLIFrameElement>(null); // kept for message listener compatibility
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const aboutImgRef = useRef<HTMLImageElement>(null);
    const aboutSectionRef = useRef<HTMLElement>(null);

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
            fetch('/api/global/messages?limit=5')
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

    /* ── Scroll listener (uses window now, no scroll hijacking) ── */
    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > window.innerHeight * 0.35);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    /* ── About section parallax zoom + fade out ── */
    useEffect(() => {
        const onScroll = () => {
            const section = aboutSectionRef.current;
            const img = aboutImgRef.current;
            if (!section || !img) return;
            const rect = section.getBoundingClientRect();
            const vh = window.innerHeight;
            // Only animate while section is in view
            if (rect.bottom < 0 || rect.top > vh) return;
            // Zoom
            const progress = Math.min(1, Math.max(0, (vh - rect.top) / (vh + section.offsetHeight)));
            const scale = 1 + progress * 0.35;
            img.style.transform = `scale(${scale})`;
            // Fade in: section top enters viewport bottom → fully visible at 70% mark
            // Fade out: when section BOTTOM crosses viewport midpoint
            const sectionBottom = rect.bottom;
            const viewMid = vh / 2;
            if (rect.top > vh * 0.7) {
                // Section just entering — fade in
                const fadeIn = Math.min(1, (vh - rect.top) / (vh * 0.3));
                section.style.opacity = `${fadeIn}`;
            } else if (sectionBottom < viewMid) {
                // Section bottom has passed viewport mid — fade out
                const fadeOut = Math.min(1, (viewMid - sectionBottom) / viewMid);
                section.style.opacity = `${1 - fadeOut}`;
            } else {
                section.style.opacity = '1';
            }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    /* ── Scroll reveal (uses window scroll) ── */
    const revealedRef = useRef(new Set<Element>());
    const runReveal = useCallback(() => {
        const vh = window.innerHeight;
        document.querySelectorAll<HTMLElement>('.funnel-section, .grow-card').forEach(el => {
            if (revealedRef.current.has(el) || el.tagName === 'HEADER') return;
            const rect = el.getBoundingClientRect();
            if (rect.top < vh * 0.92 && rect.bottom > 0) {
                el.style.opacity = '1';
                el.style.transform = 'scale(1)';
                revealedRef.current.add(el);
            }
        });
        document.querySelectorAll<HTMLElement>('.glass-box').forEach(el => {
            if (revealedRef.current.has(el)) return;
            const rect = el.getBoundingClientRect();
            if (rect.top < vh * 0.92 && rect.bottom > 0) {
                el.classList.add('sharp');
                revealedRef.current.add(el);
            }
        });
    }, []);

    useEffect(() => {
        runReveal();
        window.addEventListener('scroll', runReveal, { passive: true });
        return () => window.removeEventListener('scroll', runReveal);
    }, [runReveal]);

    // Re-check when reviews load (new .grow-card elements added to DOM)
    useEffect(() => { setTimeout(runReveal, 50); }, [reviews, runReveal]);

    /* ── Two-way scroll animation for sections + service cards ── */
    useEffect(() => {
        const els = document.querySelectorAll('.svc-card, .scroll-section');
        if (!els.length) return;
        const obs = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                const el = e.target as HTMLElement;
                if (e.isIntersecting) {
                    el.style.opacity = '1';
                    el.style.transform = 'translateY(0)';
                } else {
                    el.style.opacity = '0';
                    el.style.transform = 'translateY(30px)';
                }
            });
        }, { threshold: 0.1 });
        els.forEach(c => obs.observe(c));
        return () => obs.disconnect();
    }, []);

    /* ── Livestream blurred preview ── */
    useEffect(() => {
        initStreamPreview();
        return () => destroyStreamPlayer();
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
                if (Array.isArray(revs)) setReviews(revs);
                setReviewsLoaded(true);
            }).catch(() => { setReviewsLoaded(true); });
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
                setIframeFull(true);
            }
            if (e.data.type === 'faqClose') {
                faqIsOpenRef.current = false;
                setTimeout(() => setIframeFull(false), 400);
            }
            if (e.data.type === 'notifShow') {
                if (!faqIsOpenRef.current && frame) frame.style.height = 'calc(220px + env(safe-area-inset-bottom))';
            }
            if (e.data.type === 'notifHide') {
                if (!faqIsOpenRef.current && frame) frame.style.height = 'calc(140px + env(safe-area-inset-bottom))';
            }
            if (e.data.type === 'faqOpened') {
                triggerFomoToast();
            }
            if (e.data.type === 'openFaqFromNotif') {
                faqIsOpenRef.current = true;
                setIframeFull(true);
                setTimeout(() => { frame?.contentWindow?.postMessage({ type: 'doOpenFaq' }, '*'); }, 100);
            }
            if (e.data.type === 'dismissAccessDenied') {
                setAccessDenied(null);
            }
            if (e.data.type === 'menuNavigate') {
                const el = document.querySelector(e.data.hash);
                if (el) el.scrollIntoView({ behavior: 'smooth' });
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [showAccessDenied, triggerFomoToast]);

    /* ── Realtime activity polling ── */
    useEffect(() => {
        // Get initial latest ID (only need the 1 newest message)
        fetch('/api/global/messages?limit=1')
            .then(r => r.json())
            .then(data => {
                const msgs = data.messages || data;
                if (Array.isArray(msgs) && msgs.length > 0) {
                    lastSeenIdRef.current = msgs[msgs.length - 1].id;
                }
            })
            .catch(() => {});

        // Poll for new messages — only fetch messages after the last seen ID
        const startPolling = setTimeout(() => {
            pollIntervalRef.current = setInterval(() => {
                if (faqIsOpenRef.current) return;
                const afterParam = lastSeenIdRef.current ? `&after=${lastSeenIdRef.current}` : '';
                fetch(`/api/global/messages?limit=1${afterParam}`)
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
        if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
        window.scrollTo(0, 0);

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
                return <img src={item.sender_avatar} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${borderColor}`, flexShrink: 0 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />;
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
                            <img src={item.cardImage!} alt="" style={{ width: '80%', maxWidth: 70, height: 'auto', borderRadius: 6, objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
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
                            <img src={item.cardIcon!} alt="" style={{ width: '65%', maxWidth: 65, height: 'auto', opacity: 0.9 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
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
        <>
        <style>{`html, body { overscroll-behavior: none; background: #020202 !important; }`}</style>
        {/* Fixed background — outside landing-page so transforms can't break position:fixed */}
        <div className="landing-bg" />
        <div ref={landingPageRef} className={`landing-page${isScrolled ? ' scrolled' : ''}`}>

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
            <div style={{ position: 'fixed', top: -50, left: 0, width: '100%', height: 'calc(100lvh + 100px)', zIndex: 1, background: 'rgba(0,0,0,0.4)', pointerEvents: 'none' }} />

            {/* Hero header — scrolls with page */}
            <header className="grow-card" style={{ position: 'relative', zIndex: 2, height: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10vh', background: isScrolled ? 'transparent' : 'rgba(5,5,6,0.6)', backdropFilter: isScrolled ? 'none' : 'blur(8px)', WebkitBackdropFilter: isScrolled ? 'none' : 'blur(8px)', borderRadius: '0 0 18px 18px', marginBottom: 14, overflow: 'hidden', opacity: 1, transform: 'scale(1)', transition: 'background 0.5s ease' }}>
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
                        <a href="#about" className="shelf-nav-btn hero-fade" style={{ animationDelay: '0.6s' }}>About Me</a>
                        <a href="#leaderboard-section" className="shelf-nav-btn hero-fade" style={{ animationDelay: '1.0s' }}>Hierarchy</a>
                        <a href="#services" className="shelf-nav-btn hero-fade" style={{ animationDelay: '1.4s' }}>Service</a>
                        <a href="#keyholder-section" className="shelf-nav-btn hero-fade" style={{ animationDelay: '1.8s' }}>Keyholder</a>
                        <a href="#reviews" className="shelf-nav-btn hero-fade" style={{ animationDelay: '2.2s' }}>Feedback</a>
                    </nav>
                    {/* JOIN button only in sticky header */}
                </div>
            </header>

            {/* Fixed header — tribute style, appears on scroll */}
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 20px',
                background: 'rgba(4,4,6,0.65)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(197,160,89,0.08)',
                transition: 'transform 0.35s ease, opacity 0.35s ease',
                transform: isScrolled ? 'translateY(0)' : 'translateY(-100%)',
                opacity: isScrolled ? 1 : 0,
                pointerEvents: isScrolled ? 'auto' : 'none',
            }}>
                <div style={{ textAlign: 'center', width: '100%' }}>
                    <div style={{
                        fontFamily: 'Rajdhani, sans-serif', fontSize: '0.45rem', fontWeight: 500,
                        color: 'rgba(197,160,89,0.4)', letterSpacing: '6px', textTransform: 'uppercase',
                        marginBottom: 1,
                    }}>
                        PRESENTED BY
                    </div>
                    <div style={{
                        fontFamily: 'Cinzel, serif', fontSize: 'clamp(1rem, 4vw, 1.4rem)',
                        color: '#fff', letterSpacing: '4px', textTransform: 'uppercase',
                        fontWeight: 600, lineHeight: 1.1, whiteSpace: 'nowrap',
                        marginBottom: 6,
                    }}>
                        QUEEN KARIN
                    </div>
                    <a href="/tribute" style={{
                        fontFamily: 'Cinzel, serif', fontSize: '0.5rem', fontWeight: 600,
                        color: 'rgba(197,160,89,0.8)', letterSpacing: '5px', textDecoration: 'none',
                        padding: '6px 22px',
                        border: '1px solid rgba(197,160,89,0.3)',
                        transition: 'all 0.3s',
                        display: 'inline-block',
                    }}>
                        START NOW
                    </a>
                </div>
            </div>

            {/* Main Content */}
            <main className="content-flow" style={{ position: 'relative', zIndex: 2 }}>

                {/* ABOUT — Cinematic intro */}
                <section ref={aboutSectionRef} id="about" style={{ position: 'relative', minHeight: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', opacity: 0 }}>
                    {/* Photo */}
                    <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
                        <img ref={aboutImgRef} src="/queen-about.jpeg" alt="Queen Karin - Femdom and Online Dominatrix" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%', filter: 'brightness(0.4)', willChange: 'transform', transition: 'none' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(2,2,2,0.3) 0%, rgba(2,2,2,0.1) 40%, rgba(2,2,2,0.7) 80%, #020202 100%)' }} />
                    </div>
                    {/* Text overlay */}
                    <div className="grow-card" style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 24px', maxWidth: 700 }}>
                        <p style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(1.3rem, 5vw, 2.2rem)', color: 'rgba(255,255,255,0.85)', fontWeight: 400, letterSpacing: 3, lineHeight: 1.5, margin: '0 0 28px' }}>
                            Three years building what no platform dared to create.
                        </p>
                        <div style={{ width: 40, height: 1, background: 'rgba(197,160,89,0.4)', margin: '0 auto 28px' }} />
                        <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(1.3rem, 4.5vw, 2rem)', fontStyle: 'italic', color: 'rgba(255,255,255,0.45)', lineHeight: 2.2, margin: 0, fontWeight: 300 }}>
                            I don&apos;t convince.<br />
                            I don&apos;t negotiate.<br />
                            I don&apos;t audition.<br />
                            I open doors, and I close them just as easily.
                        </p>
                        <a href="/login" style={{
                            display: 'inline-block', marginTop: 36,
                            fontFamily: 'Cinzel, serif', fontSize: '0.85rem', letterSpacing: 6,
                            color: 'rgba(197,160,89,0.9)', textDecoration: 'none',
                            padding: '18px 56px',
                            background: 'rgba(6,6,10,0.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10,
                            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
                        }}>START NOW</a>
                    </div>
                </section>

                {/* LEADERBOARD — tribute style */}
                <div id="leaderboard-section" className="scroll-section" style={{ marginTop: 180, padding: '40px 16px 50px', position: 'relative', zIndex: 2, overflow: 'hidden', opacity: 0, transform: 'translateY(30px)', transition: 'opacity 0.7s ease, transform 0.7s ease' }}>
                    {/* Background photo */}
                    <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
                        <img src="/queen-hierarchy.jpeg" alt="Queen Karin - Hierarchy and Leaderboard" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%', filter: 'brightness(0.25)' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #020202 0%, rgba(2,2,2,0.3) 15%, rgba(2,2,2,0.3) 85%, #020202 100%)' }} />
                    </div>
                    {/* Content over background */}
                    <div style={{ position: 'relative', zIndex: 1 }}>
                    {/* Section header */}
                    <div className="grow-card" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 48 }}>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(197,160,89,0.6))' }} />
                        <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.65rem', fontWeight: 600, color: 'rgba(197,160,89,1)', letterSpacing: '12px', margin: 0 }}>HIERARCHY</h2>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(197,160,89,0.6), transparent)' }} />
                    </div>

                    {/* Period tabs */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 0, marginBottom: 24 }}>
                        {(['today', 'weekly', 'monthly', 'alltime'] as const).map(p => (
                            <button
                                key={p}
                                onClick={() => setLbPeriod(p)}
                                style={{
                                    background: 'none', border: 'none', padding: '8px 16px',
                                    fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', fontWeight: 600,
                                    letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer',
                                    color: lbPeriod === p ? '#c5a059' : 'rgba(255,255,255,0.2)',
                                    borderBottom: lbPeriod === p ? '1.5px solid rgba(197,160,89,0.4)' : '1.5px solid transparent',
                                    transition: 'all 0.3s ease',
                                }}
                            >
                                {p === 'alltime' ? 'ALL' : p === 'today' ? 'TODAY' : p === 'weekly' ? 'WEEK' : 'MONTH'}
                            </button>
                        ))}
                    </div>

                    {/* Entries */}
                    <div style={{ maxWidth: 600, margin: '0 auto' }}>
                        {lbEntries.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '30px 0', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.12)' }}>No scores yet for this period</div>
                        ) : (<>
                            {/* Top 3 — larger with rank icons */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {lbEntries.slice(0, 3).map((e, i) => {
                                    const rankIcons = [
                                        <svg key="crown" width="18" height="18" viewBox="0 0 24 24" fill="#c5a059"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm0 2v2h14v-2H5z"/></svg>,
                                        <svg key="star" width="16" height="16" viewBox="0 0 24 24" fill="rgba(197,160,89,0.5)"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"/></svg>,
                                        <svg key="shield" width="15" height="15" viewBox="0 0 24 24" fill="rgba(197,160,89,0.35)"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>,
                                    ];
                                    return (
                                        <div key={i} className="grow-card" style={{
                                            display: 'flex', alignItems: 'center', gap: 16,
                                            padding: i === 0 ? '18px 18px' : '14px 18px', borderRadius: 10,
                                            background: i === 0 ? 'rgba(197,160,89,0.08)' : 'rgba(255,255,255,0.025)',
                                            border: i === 0 ? '1px solid rgba(197,160,89,0.15)' : '1px solid rgba(255,255,255,0.04)',
                                        }}>
                                            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30 }}>
                                                {rankIcons[i]}
                                            </div>
                                            <div style={{
                                                width: i === 0 ? 52 : 44, height: i === 0 ? 52 : 44, borderRadius: '50%', flexShrink: 0,
                                                background: e.avatar
                                                    ? `url(${e.avatar}) center/cover`
                                                    : 'linear-gradient(135deg, rgba(197,160,89,0.12), rgba(197,160,89,0.04))',
                                                border: i === 0 ? '1.5px solid rgba(197,160,89,0.3)' : '1px solid rgba(197,160,89,0.12)',
                                            }} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{
                                                    fontFamily: 'Cinzel, serif', fontSize: i === 0 ? '1.05rem' : '0.92rem',
                                                    color: i === 0 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)',
                                                    fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                }}>
                                                    {e.name || 'Anonymous'}
                                                </div>
                                                <div style={{
                                                    fontFamily: 'Rajdhani, sans-serif', fontSize: '0.65rem', fontWeight: 500,
                                                    color: 'rgba(197,160,89,0.35)', letterSpacing: '1.5px',
                                                }}>
                                                    {e.hierarchy || ''}
                                                </div>
                                            </div>
                                            <div style={{
                                                fontFamily: 'Rajdhani, sans-serif', fontSize: i === 0 ? '1.1rem' : '1rem', fontWeight: 700,
                                                color: i === 0 ? '#c5a059' : 'rgba(197,160,89,0.5)',
                                                flexShrink: 0,
                                            }}>
                                                {e.score ? e.score.toLocaleString() : '0'}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {/* #4-5 compact */}
                            {lbEntries.length > 3 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
                                    {lbEntries.slice(3, showAllLb ? 10 : 5).map((e, i) => (
                                        <div key={i + 3} style={{
                                            display: 'flex', alignItems: 'center', gap: 12,
                                            padding: '10px 18px',
                                        }}>
                                            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255,255,255,0.15)', width: 30, textAlign: 'center', flexShrink: 0 }}>{i + 4}</div>
                                            <div style={{
                                                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                                                background: e.avatar ? `url(${e.avatar}) center/cover` : 'rgba(255,255,255,0.04)',
                                                border: '1px solid rgba(255,255,255,0.06)',
                                            }} />
                                            <div style={{ flex: 1, fontFamily: 'Cinzel, serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {e.name || 'Anonymous'}
                                            </div>
                                            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', fontWeight: 600, color: 'rgba(197,160,89,0.3)', flexShrink: 0 }}>
                                                {e.score ? e.score.toLocaleString() : '0'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {/* See all button */}
                            {lbEntries.length > 5 && !showAllLb && (
                                <div style={{ textAlign: 'center', marginTop: 16 }}>
                                    <button onClick={() => setShowAllLb(true)} style={{
                                        background: 'none', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 4,
                                        padding: '10px 32px', cursor: 'pointer',
                                        fontFamily: 'Cinzel, serif', fontSize: '0.5rem', fontWeight: 600,
                                        color: 'rgba(197,160,89,0.5)', letterSpacing: '4px', transition: 'all 0.25s',
                                    }}>SEE ALL</button>
                                </div>
                            )}
                            {showAllLb && (
                                <div style={{ textAlign: 'center', marginTop: 12 }}>
                                    <button onClick={() => setShowAllLb(false)} style={{
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        fontFamily: 'Cinzel, serif', fontSize: '0.45rem', color: 'rgba(255,255,255,0.12)', letterSpacing: '4px',
                                    }}>SHOW LESS</button>
                                </div>
                            )}
                        </>)}
                    </div>
                    </div>{/* end content over background */}
                </div>

                {/* SERVICES */}
                <div id="services" className="scroll-section" style={{ marginTop: 180, padding: '0 16px', position: 'relative', zIndex: 2, opacity: 0, transform: 'translateY(30px)', transition: 'opacity 0.7s ease, transform 0.7s ease' }}>
                    {/* Section header */}
                    <div className="grow-card" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 48 }}>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(197,160,89,0.6))' }} />
                        <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.65rem', fontWeight: 600, color: 'rgba(197,160,89,1)', letterSpacing: '12px', margin: 0 }}>SERVICES</h2>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(197,160,89,0.6), transparent)' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600, margin: '0 auto' }}>
                        {[
                            { title: 'KEYHOLDING', desc: 'Your lock. Her rules. Daily check-ins, real-time control, strict accountability. Not a game, a commitment.', href: '/keyholder', icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.5)" strokeWidth="1.2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg> },
                            { title: 'FINANCIAL DOMINATION', desc: 'Tribute is not a transaction. It is proof of devotion. An economy built on worship, not negotiation.', href: '/login', icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.5)" strokeWidth="1.2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
                            { title: 'TASK TRAINING', desc: 'Daily assignments. Photo proof. Deadlines. Real consequences. A structured system of obedience with merit and punishment.', href: '/login', icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.5)" strokeWidth="1.2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
                            { title: 'SISSIFICATION', desc: 'Guided transformation under absolute authority. Wardrobe. Behavior. Identity. Nothing is optional.', href: '/login', icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.5)" strokeWidth="1.2"><path d="M12 2a5 5 0 0 1 5 5c0 4-5 7-5 7s-5-3-5-7a5 5 0 0 1 5-5z"/><path d="M12 14v8M8 18h8"/></svg> },
                            { title: 'ONLINE DOMINATION', desc: 'Real-time control from anywhere. Not a fantasy you browse, a lifestyle you live under Her command.', href: '/login', icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.5)" strokeWidth="1.2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
                        ].map((s, i) => (
                            <a key={i} href={s.href} className="svc-card" style={{
                                display: 'block', textDecoration: 'none', textAlign: 'center',
                                padding: '28px 24px', borderRadius: 14,
                                background: 'rgba(12,11,16,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                                border: '1px solid rgba(197,160,89,0.08)',
                                opacity: 0, transform: 'translateY(30px)',
                                transition: 'opacity 0.7s ease, transform 0.7s ease',
                            }}>
                                <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'center' }}>{s.icon}</div>
                                <h3 style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600, letterSpacing: 5, marginBottom: 10, margin: '0 0 10px' }}>{s.title}</h3>
                                <div style={{ width: 24, height: 1, background: 'rgba(197,160,89,0.25)', margin: '0 auto 12px' }} />
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.7, maxWidth: 420, margin: '0 auto' }}>{s.desc}</div>
                            </a>
                        ))}
                    </div>
                </div>

                {/* KEYHOLDER — dedicated section */}
                <div id="keyholder-section" className="scroll-section" style={{ marginTop: 180, padding: '0 16px', position: 'relative', zIndex: 2, opacity: 0, transform: 'translateY(30px)', transition: 'opacity 0.7s ease, transform 0.7s ease' }}>
                    {/* Section header */}
                    <div className="grow-card" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 48 }}>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(139,0,0,0.5))' }} />
                        <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.65rem', fontWeight: 600, color: 'rgba(197,160,89,1)', letterSpacing: '12px', margin: 0 }}>KEYHOLDER</h2>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(139,0,0,0.5), transparent)' }} />
                    </div>
                    <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
                        <div style={{ marginBottom: 20 }}>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(139,0,0,0.6)" strokeWidth="1.2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                        </div>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.3rem', color: 'rgba(139,0,0,0.45)', letterSpacing: 6, marginBottom: 16, textTransform: 'uppercase' }}>Chastity Control</div>
                        <p style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.9rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.8, maxWidth: 440, margin: '0 auto 32px' }}>Your lock. Her rules. Daily check-ins, real-time control, strict accountability. Not a game — a commitment.</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {[
                                { title: 'DAILY TASKS', text: 'Every day you receive tasks assigned by Queen Karin directly. You complete routines and submit proof. Nothing is optional.' },
                                { title: 'KNEELING SESSIONS', text: 'You check in and out of kneeling sessions. Your progress is tracked. Queen Karin can see everything in real time.' },
                                { title: 'FULL ACCOUNTABILITY', text: 'Your dashboard shows daily progress, completed tasks, kneeling count, merit, and full history. Nothing goes unnoticed. You report to her, not to yourself.' },
                            ].map((item, i) => (
                                <div key={i} style={{
                                    padding: '20px 22px', borderRadius: 14, textAlign: 'left',
                                    background: 'rgba(12,11,16,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                                    border: '1px solid rgba(139,0,0,0.15)',
                                }}>
                                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', fontWeight: 600, color: 'rgba(197,160,89,0.7)', letterSpacing: 3, marginBottom: 8 }}>{item.title}</div>
                                    <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.7 }}>{item.text}</div>
                                </div>
                            ))}
                        </div>
                        <a href="/keyholder" style={{
                            display: 'inline-block', marginTop: 32, padding: '16px 44px',
                            fontFamily: 'Cinzel, serif', fontSize: '0.65rem', fontWeight: 700, letterSpacing: 5,
                            color: '#fff', textDecoration: 'none', textTransform: 'uppercase',
                            background: 'linear-gradient(135deg, rgba(139,0,0,0.5), rgba(139,0,0,0.25))',
                            border: '1px solid rgba(139,0,0,0.35)', borderRadius: 10,
                        }}>Surrender Key</a>
                    </div>
                </div>

                {/* REVIEWS — tribute-style profile cards */}
                <div id="reviews" className="scroll-section" style={{ marginTop: 180, paddingTop: 40, paddingBottom: 60, position: 'relative', zIndex: 2, opacity: 0, transform: 'translateY(30px)', transition: 'opacity 0.7s ease, transform 0.7s ease' }}>
                    {/* Section header — tribute style */}
                    <div className="grow-card" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 48, padding: '0 16px' }}>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(197,160,89,0.6))' }} />
                        <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.65rem', fontWeight: 600, color: 'rgba(197,160,89,1)', letterSpacing: '12px', margin: 0 }}>TESTIMONIALS</h2>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(197,160,89,0.6), transparent)' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 40, maxWidth: 600, margin: '0 auto' }}>
                        {(showAllReviews ? reviews : reviews.slice(0, 3)).map((r, i) => {
                            const rev = r.reviewer || {};
                            const rName = rev.name || 'Loyal Subject';
                            const rAvatar = rev.avatar || null;
                            const rHierarchy = rev.hierarchy || 'Hall Boy';
                            const rMerit = rev.merit || 0;
                            const rTasks = rev.tasksCompleted || 0;
                            const rKneels = rev.kneelCount || 0;
                            const rServing = rev.servingText || '';
                            const rRating = r.rating || 5;
                            const initial = rName.charAt(0).toUpperCase();

                            return (
                                <div key={i} className="grow-card">
                                    <div style={{ borderRadius: 14, border: '1px solid rgba(197,160,89,0.1)', background: 'rgba(12,11,16,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', overflow: 'hidden' }}>
                                        {/* Profile card header */}
                                        <div style={{ background: 'linear-gradient(135deg, rgba(197,160,89,0.08) 0%, rgba(20,18,24,0.6) 100%)', borderBottom: '1px solid rgba(197,160,89,0.1)' }}>
                                            <div style={{ padding: '18px 18px 14px', display: 'flex', alignItems: 'center', gap: 16 }}>
                                                <div style={{ flexShrink: 0 }}>
                                                    {rAvatar ? (
                                                        <img src={rAvatar} alt="" style={{ width: 70, height: 70, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(197,160,89,0.25)', display: 'block' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                                    ) : (
                                                        <div style={{ width: 70, height: 70, borderRadius: '50%', background: 'rgba(197,160,89,0.05)', border: '1.5px solid rgba(197,160,89,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cinzel,serif', fontSize: '1.4rem', color: 'rgba(197,160,89,0.4)' }}>{initial}</div>
                                                    )}
                                                </div>
                                                <div style={{ flex: 1, textAlign: 'center' }}>
                                                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.9rem', color: 'rgba(255,255,255,0.85)', fontWeight: 600, letterSpacing: 8, marginBottom: 4 }}>{rName}</div>
                                                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.55rem', fontWeight: 400, letterSpacing: 3, color: 'rgba(197,160,89,0.45)', textTransform: 'uppercase', marginBottom: 3 }}>{rHierarchy}</div>
                                                    {rServing && (
                                                        <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.55rem', color: 'rgba(255,255,255,0.45)', letterSpacing: 1.5, textTransform: 'uppercase' }}>SERVING {rServing.toUpperCase()}</div>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                                {[
                                                    { label: 'MERIT', value: rMerit.toLocaleString() },
                                                    { label: 'TASKS', value: rTasks },
                                                    { label: 'KNEELING', value: rKneels.toLocaleString() },
                                                ].map((stat, si) => (
                                                    <div key={stat.label} style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderLeft: si > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                                                        <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{stat.value}</div>
                                                        <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.44rem', color: 'rgba(255,255,255,0.25)', letterSpacing: 2, textTransform: 'uppercase' }}>{stat.label}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        {/* Review body */}
                                        <div className="review-body clamped" id={`review-body-${i}`} style={{ padding: '16px 20px 18px', textAlign: 'left' }}>
                                            <div style={{ display: 'flex', gap: 1, marginBottom: 10 }}>
                                                {Array.from({ length: 5 }, (_, s) => (
                                                    <span key={s} style={{ fontSize: '0.7rem', color: s < rRating ? '#8b0000' : 'rgba(255,255,255,0.08)' }}>&#9733;</span>
                                                ))}
                                            </div>
                                            <p style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: '0.9rem', lineHeight: 1.9, color: 'rgba(255,255,255,0.65)', fontWeight: 300, margin: 0 }}>&ldquo;{r.text || ''}&rdquo;</p>
                                        </div>
                                        <button className="review-read-more" style={{ display: 'block', width: '100%', background: 'none', border: 'none', borderTop: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', fontFamily: 'Orbitron, sans-serif', letterSpacing: 3, textAlign: 'left', fontSize: '0.6rem', padding: '8px 18px 12px', color: 'rgba(255,255,255,0.4)' }} onClick={(e) => {
                                            const body = document.getElementById(`review-body-${i}`);
                                            if (body) {
                                                const isClamped = body.classList.toggle('clamped');
                                                (e.target as HTMLElement).textContent = isClamped ? 'READ MORE \u25B8' : 'SHOW LESS \u25B4';
                                            }
                                        }}>READ MORE &#9656;</button>
                                    </div>
                                </div>
                            );
                        })}
                        {!showAllReviews && reviews.length > 3 && (
                            <div style={{ textAlign: 'center', marginTop: 8 }}>
                                <button onClick={() => setShowAllReviews(true)} style={{
                                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(197,160,89,0.15)',
                                    borderRadius: 4, padding: '12px 36px', cursor: 'pointer',
                                    fontFamily: 'Orbitron,sans-serif', fontSize: '0.38rem', color: 'rgba(197,160,89,0.5)',
                                    letterSpacing: 4, transition: 'all 0.25s',
                                }}>SEE ALL REVIEWS</button>
                            </div>
                        )}
                        {showAllReviews && reviews.length > 3 && (
                            <div style={{ textAlign: 'center', marginTop: 8 }}>
                                <button onClick={() => setShowAllReviews(false)} style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    fontFamily: 'Orbitron,sans-serif', fontSize: '0.3rem', color: 'rgba(255,255,255,0.12)',
                                    letterSpacing: 4, padding: '8px 16px',
                                }}>SHOW LESS</button>
                            </div>
                        )}
                        {reviewsLoaded && reviews.length === 0 && (
                            <div style={{ textAlign: 'center', fontFamily: 'Cinzel,serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.15)', letterSpacing: 4, padding: '40px 0' }}>BE THE FIRST TO LEAVE A REVIEW</div>
                        )}
                    </div>
                </div>

                {/* Bottom padding */}
                <div style={{ height: 40 }} />
            </main>

            {/* FINAL CTA */}
            <div id="final-cta" style={{ textAlign: 'center', padding: '60px 20px 0', position: 'relative', zIndex: 2 }}>
                <a href="/login" style={{
                    display: 'inline-block', fontFamily: 'Cinzel, serif', fontSize: '0.85rem', letterSpacing: 6,
                    color: 'rgba(197,160,89,0.9)', textDecoration: 'none',
                    padding: '18px 56px',
                    background: 'rgba(6,6,10,0.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10,
                    boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
                }}>START NOW</a>
                <div style={{ height: 'calc(100px + env(safe-area-inset-bottom))' }} />
            </div>

            {/* SEO content -- invisible to users, crawlable by Google */}
            <aside style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
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
            </aside>
        </div>

        {/* FAQ BUBBLE + OVERLAY */}
        {!faqOpen && (
            <button
                onClick={() => setFaqOpen(true)}
                style={{
                    position: 'fixed', bottom: 'calc(24px + env(safe-area-inset-bottom))', right: 20,
                    width: 72, height: 72, borderRadius: '50%', border: '2px solid rgba(197,160,89,0.4)',
                    background: 'rgba(2,2,2,0.8)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                    cursor: 'pointer', zIndex: 99998, padding: 0, overflow: 'hidden',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
                <img src="/queen-nav.png" alt="FAQ" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            </button>
        )}
        {faqOpen && (
            <iframe
                src="/footer-faq.html?v=7&autoOpen=1"
                style={{
                    position: 'fixed', inset: 0, width: '100%', height: '100%',
                    border: 'none', zIndex: 99999, background: '#020202',
                }}
                onLoad={() => {
                    const handler = (msg: MessageEvent) => {
                        if (msg.data?.type === 'faqClose') {
                            setFaqOpen(false);
                            window.removeEventListener('message', handler);
                        }
                    };
                    window.addEventListener('message', handler);
                }}
            />
        )}

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
        </>
    );
}
