"use client";

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import PaymentModal from '@/components/PaymentModal';

/* ── time ago helper ── */
function timeAgo(dateStr: string) {
    // Supabase returns timestamps without 'Z' — force UTC interpretation
    const utcStr = dateStr.endsWith('Z') || dateStr.includes('+') ? dateStr : dateStr + 'Z';
    const diff = Date.now() - new Date(utcStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

/* no fake reviews — real data only */

export default function TributePage() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [lbPeriod, setLbPeriod] = useState<'today' | 'weekly' | 'monthly' | 'alltime'>('weekly');
    const [reviews, setReviews] = useState<any[]>([]);
    const [showAllReviews, setShowAllReviews] = useState(false);
    const [expandedFeature, setExpandedFeature] = useState<number | null>(null);
    const [heroVisible, setHeroVisible] = useState(false);
    const [toasts, setToasts] = useState<any[]>([]);
    const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());
    const [iframeFull, setIframeFull] = useState(false);
    const iframeFullRef = useRef(false);
    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const footerFrameRef = useRef<HTMLIFrameElement>(null);
    const [showTierPicker, setShowTierPicker] = useState(false);
    const [showPayment, setShowPayment] = useState(false);
    const [selectedTier, setSelectedTier] = useState<{ id: string; price: number } | null>(null);

    const TRIBUTE_TIERS = [
        { id: 'weekly',  label: '1 WEEK',  period: '7 DAYS',   price: 55,  desc: 'First step. Prove you are worthy of Her attention.' },
        { id: 'monthly', label: '1 MONTH', period: '30 DAYS',  price: 99,  desc: 'Full month under Her rule. Real commitment begins here.', badge: 'POPULAR' },
        { id: 'yearly',  label: '1 YEAR',  period: '365 DAYS', price: 299, desc: 'Total surrender for a full year. No excuses. No exits.', badge: 'BEST VALUE' },
    ];

    useEffect(() => {
        const storedRedirect = localStorage.getItem('post_login_redirect');
        if (storedRedirect) { localStorage.removeItem('post_login_redirect'); window.location.href = storedRedirect; return; }

        setMounted(true);
        const init = async () => {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    setUserEmail(user.email || (user.user_metadata?.user_name ? `@${user.user_metadata.user_name}` : null));
                    try { await (await fetch('/api/auth/link-profile', { method: 'POST' })).json(); } catch {}
                }
            } catch {}
        };
        init();
    }, []);

    /* fetch leaderboard */
    useEffect(() => {
        fetch(`/api/global/leaderboard?period=${lbPeriod}`)
            .then(r => r.json())
            .then(d => { if (d.entries) setLeaderboard(d.entries); })
            .catch(() => {});
    }, [lbPeriod]);

    /* show a toast for 8s then remove it */
    const showToast = (item: any) => {
        const id = Date.now() + Math.random();
        setToasts([{ ...item, _id: id }]);
        setTimeout(() => setToasts(prev => prev.map(t => t._id === id ? { ...t, _leaving: true } : t)), 8000);
        setTimeout(() => setToasts(prev => prev.filter(t => t._id !== id)), 8500);
    };

    /* parse global_messages card content into toast-friendly data */
    const parseGlobalCard = (msg: any) => {
        const content = msg.message || msg.content || '';
        const created = msg.created_at;
        const avatar = msg.sender_avatar || null;
        const msgHierarchy = msg.hierarchy || null;
        try {
            if (content.startsWith('RISKY_TRIBUTE_CARD::')) {
                const d = JSON.parse(content.replace('RISKY_TRIBUTE_CARD::', ''));
                const isWin = d.isWin;
                const resultText = isWin ? `won +${(d.wonAmount||0).toLocaleString()} coins` : d.lostAmount === 0 ? 'lost nothing' : `lost ${(d.lostAmount||0).toLocaleString()} coins`;
                return { sender_name: d.senderName || 'SUBJECT', sender_avatar: d.senderAvatar || avatar, hierarchy: msgHierarchy, text: `just gambled ${(d.stakeAmount||0).toLocaleString()} coins and ${resultText}`, kind: 'risky', cardIcon: d.icon || null, cardName: d.cardName || null, isWin, stakeAmount: d.stakeAmount || 0, wonAmount: d.wonAmount || 0, lostAmount: d.lostAmount || 0, created_at: created };
            }
            if (content.startsWith('DIRECT_TRIBUTE_CARD::')) {
                const d = JSON.parse(content.replace('DIRECT_TRIBUTE_CARD::', ''));
                return { sender_name: d.senderName || 'SUBJECT', sender_avatar: d.senderAvatar || avatar, hierarchy: msgHierarchy, text: `sent a tribute of ${(d.amount||0).toLocaleString()} coins`, kind: 'tribute', created_at: created };
            }
            if (content.startsWith('PROMOTION_CARD::')) {
                const d = JSON.parse(content.replace('PROMOTION_CARD::', ''));
                return { sender_name: d.name || 'SUBJECT', sender_avatar: avatar, hierarchy: msgHierarchy, text: `was promoted to ${d.newRank || 'a new rank'}`, kind: 'promotion', created_at: created };
            }
            if (content.startsWith('CHALLENGE_TASK_CARD::')) {
                const d = JSON.parse(content.replace('CHALLENGE_TASK_CARD::', ''));
                return { sender_name: d.senderName || 'SUBJECT', sender_avatar: d.senderAvatar || avatar, hierarchy: msgHierarchy, text: `completed a challenge task${d.passed !== false ? '' : ' (failed)'}`, kind: 'challenge', created_at: created };
            }
            if (content.startsWith('WELCOME_CARD::')) {
                const d = JSON.parse(content.replace('WELCOME_CARD::', ''));
                return { sender_name: d.name || 'New Subject', sender_avatar: avatar, hierarchy: msgHierarchy, text: 'entered the household', kind: 'welcome', created_at: created };
            }
            if (content.startsWith('UPDATE_MERIT_CARD::')) {
                const d = JSON.parse(content.replace('UPDATE_MERIT_CARD::', ''));
                return { sender_name: d.senderName || 'SUBJECT', sender_avatar: d.senderAvatar || avatar, hierarchy: msgHierarchy, text: `earned ${d.points || 0} points`, kind: 'merit', created_at: created };
            }
            if (content.startsWith('UPDATE_COINS_CARD::')) {
                const d = JSON.parse(content.replace('UPDATE_COINS_CARD::', ''));
                return { sender_name: d.senderName || 'SUBJECT', sender_avatar: d.senderAvatar || avatar, hierarchy: msgHierarchy, text: `claimed ${d.points || 0} coins from kneeling`, kind: 'coins', created_at: created };
            }
            if (content.startsWith('CHALLENGE_JOIN_CARD::')) {
                const d = JSON.parse(content.replace('CHALLENGE_JOIN_CARD::', ''));
                return { sender_name: d.senderName || d.name || 'SUBJECT', sender_avatar: d.senderAvatar || avatar, hierarchy: msgHierarchy, text: `joined ${d.challengeName || 'a challenge'}`, kind: 'challenge', created_at: created };
            }
            if (content.startsWith('LEADERBOARD_REWARD_CARD::')) {
                const d = JSON.parse(content.replace('LEADERBOARD_REWARD_CARD::', ''));
                return { sender_name: d.winnerName || 'SUBJECT', sender_avatar: avatar, hierarchy: msgHierarchy, text: `is the ${d.title || 'CHAMPION'} with ${(d.score || 0).toLocaleString()} pts`, kind: 'champion', created_at: created };
            }
        } catch {}
        return null;
    };

    /* FOMO notifications disabled on /tribute */

    /* Hero text fade in */
    useEffect(() => {
        if (!mounted) return;
        const t = setTimeout(() => setHeroVisible(true), 400);
        return () => clearTimeout(t);
    }, [mounted]);

    /* fetch real reviews */
    useEffect(() => {
        fetch('/api/reviews/public')
            .then(r => r.json())
            .then(d => { if (d.reviews) setReviews(d.reviews); })
            .catch(() => {});
    }, []);

    /* intersection observer for scroll animations */
    useEffect(() => {
        if (typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(e => {
                    if (e.isIntersecting) {
                        setVisibleSections(prev => new Set([...prev, e.target.id]));
                    }
                });
            },
            { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
        );
        Object.values(sectionRefs.current).forEach(el => { if (el) observer.observe(el); });
        return () => observer.disconnect();
    }, [mounted]);

    /* ── Slide-in from sides for feature items ── */
    useEffect(() => {
        const items = document.querySelectorAll('.feature-item');
        items.forEach((el, i) => {
            el.classList.add(i % 2 === 0 ? 'from-left' : 'from-right');
        });
        const obs = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (e.isIntersecting) {
                    setTimeout(() => {
                        (e.target as HTMLElement).classList.add('slide-in');
                    }, (Array.from(document.querySelectorAll('.feature-item')).indexOf(e.target as HTMLElement) % 3) * 80);
                    obs.unobserve(e.target);
                }
            });
        }, { threshold: 0.1 });
        items.forEach(el => obs.observe(el));
        return () => obs.disconnect();
    }, [mounted]);

    /* ── Grow-on-scroll for review cards ── */
    useEffect(() => {
        const obs = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (e.isIntersecting) {
                    (e.target as HTMLElement).style.opacity = '1';
                    (e.target as HTMLElement).style.transform = 'scale(1)';
                    obs.unobserve(e.target);
                }
            });
        }, { threshold: 0.1 });
        document.querySelectorAll('.trib-grow').forEach(el => obs.observe(el));
        return () => obs.disconnect();
    }, [reviews, showAllReviews]);

    /* ── Footer iframe message listener (same approach as home page) ── */
    useEffect(() => {
        const handleMessage = (e: MessageEvent) => {
            if (!e.data || typeof e.data.type !== 'string') return;
            const frame = footerFrameRef.current;
            if (e.data.type === 'navClick') {
                // Access denied — offer unlock
                const section = e.data.section || 'this section';
                const existing = document.getElementById('accessDeniedOverlay');
                if (existing) { existing.remove(); return; }
                const overlay = document.createElement('div');
                overlay.id = 'accessDeniedOverlay';
                overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:calc(60px + env(safe-area-inset-bottom));z-index:9999998;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.85);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);';
                overlay.innerHTML = '<div style="text-align:center;padding:40px 30px;max-width:320px;"><div style="font-family:Cinzel,serif;font-size:0.5rem;color:rgba(197,160,89,0.5);letter-spacing:4px;margin-bottom:16px;">ACCESS DENIED</div><div style="font-family:Cinzel,serif;font-size:1.1rem;color:rgba(255,255,255,0.7);margin-bottom:12px;line-height:1.5;">You don\'t have access to ' + section + '</div><div style="font-family:Cinzel,serif;font-size:0.85rem;color:rgba(255,255,255,0.3);line-height:1.6;margin-bottom:24px;">Unlock your experience to explore everything inside.</div><div style="display:flex;gap:8px;"><button id="adClose" style="flex:1;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);border:1px solid rgba(255,255,255,0.1);padding:10px 0;border-radius:8px;font-family:Cinzel,serif;font-size:0.5rem;letter-spacing:2px;cursor:pointer;">CLOSE</button><button id="adUnlock" style="flex:2;background:linear-gradient(135deg,#c5a059 0%,#8a6d30 100%);color:#020202;border:none;padding:10px 0;border-radius:8px;font-family:Cinzel,serif;font-size:0.5rem;font-weight:700;letter-spacing:2px;cursor:pointer;">UNLOCK</button></div></div>';
                overlay.querySelector('#adClose')?.addEventListener('click', () => overlay.remove());
                overlay.querySelector('#adUnlock')?.addEventListener('click', () => { overlay.remove(); handleTribute(); });
                overlay.addEventListener('click', () => overlay.remove());
                document.body.appendChild(overlay);
            }
            if (e.data.type === 'faqOpen') {
                iframeFullRef.current = true;
                setIframeFull(true);
            }
            if (e.data.type === 'faqClose') {
                iframeFullRef.current = false;
                setTimeout(() => setIframeFull(false), 400);
            }
            if (e.data.type === 'notifShow') {
                if (!iframeFullRef.current && frame) frame.style.height = 'calc(220px + env(safe-area-inset-bottom))';
            }
            if (e.data.type === 'notifHide') {
                if (!iframeFullRef.current && frame) frame.style.height = 'calc(140px + env(safe-area-inset-bottom))';
            }
            if (e.data.type === 'openFaqFromNotif') {
                iframeFullRef.current = true;
                setIframeFull(true);
                setTimeout(() => { frame?.contentWindow?.postMessage({ type: 'doOpenFaq' }, '*'); }, 100);
            }
            if (e.data.type === 'dismissAccessDenied') {
                document.getElementById('accessDeniedOverlay')?.remove();
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const handleTribute = () => {
        setShowTierPicker(true);
    };

    const handleLogout = async () => { const s = createClient(); await s.auth.signOut(); window.location.href = '/login'; };

    const isVisible = (id: string) => visibleSections.has(id);
    const setRef = (id: string) => (el: HTMLDivElement | null) => { sectionRefs.current[id] = el; };



    const stars = (n: number) => Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < n ? '#c5a059' : 'rgba(255,255,255,0.08)', fontSize: '0.75rem' }}>&#9733;</span>
    ));

    return (<>
        <div style={{ background: '#020202', color: '#fff', minHeight: '100dvh', overflowX: 'hidden', position: 'relative' }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Italianno&family=Rajdhani:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@300;400;500&display=swap');

                @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
                @keyframes fadeUp { from { opacity:0; transform:translateY(50px); } to { opacity:1; transform:translateY(0); } }
                @keyframes fadeUpSlow { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }
                @keyframes slideDown { from { opacity:0; transform:translateY(-20px); } to { opacity:1; transform:translateY(0); } }
                @keyframes float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-6px); } }
                @keyframes breathe { 0%,100% { opacity:0.3; } 50% { opacity:0.7; } }
                @keyframes shimmerGold {
                    0% { background-position: -200% center; }
                    100% { background-position: 200% center; }
                }
                @keyframes pulseGlow {
                    0%,100% { box-shadow: 0 0 30px rgba(197,160,89,0.05), 0 0 60px rgba(197,160,89,0.02); }
                    50% { box-shadow: 0 0 40px rgba(197,160,89,0.12), 0 0 80px rgba(197,160,89,0.05); }
                }
                @keyframes ringExpand {
                    0% { transform: scale(0.95); opacity: 0.4; }
                    50% { transform: scale(1.05); opacity: 0.8; }
                    100% { transform: scale(0.95); opacity: 0.4; }
                }
                @keyframes ctaShine {
                    0% { left: -100%; }
                    50%,100% { left: 100%; }
                }

                /* ── Kneel-style button ── */
                @property --trib-gradient-angle {
                    syntax: "<angle>";
                    initial-value: 0deg;
                    inherits: false;
                }
                @property --trib-gradient-angle-offset {
                    syntax: "<angle>";
                    initial-value: 0deg;
                    inherits: false;
                }
                @property --trib-gradient-percent {
                    syntax: "<percentage>";
                    initial-value: 5%;
                    inherits: false;
                }
                @property --trib-gradient-shine {
                    syntax: "<color>";
                    initial-value: #c5a059;
                    inherits: false;
                }
                @keyframes trib-gradient-angle {
                    to { --trib-gradient-angle: 360deg; }
                }
                @keyframes trib-shimmer {
                    to { rotate: 360deg; }
                }

                .trib-kneel-btn {
                    --kneel-bg: #080604;
                    --kneel-bg-subtle: #1a1408;
                    --kneel-highlight: #c5a059;
                    --kneel-highlight-subtle: #d4b06a;

                    width: 100%;
                    height: 64px;
                    isolation: isolate;
                    overflow: hidden !important;
                    background:
                        linear-gradient(var(--kneel-bg), var(--kneel-bg)) padding-box,
                        conic-gradient(
                            from calc(var(--trib-gradient-angle) - var(--trib-gradient-angle-offset)),
                            transparent,
                            var(--kneel-highlight) var(--trib-gradient-percent),
                            var(--trib-gradient-shine) calc(var(--trib-gradient-percent) * 2),
                            var(--kneel-highlight) calc(var(--trib-gradient-percent) * 3),
                            transparent calc(var(--trib-gradient-percent) * 4)
                        ) border-box !important;
                    border: 1.5px solid transparent !important;
                    border-radius: 999px;
                    position: relative;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow:
                        inset 0 0 0 1px var(--kneel-bg-subtle),
                        0 0 20px rgba(197, 160, 89, 0.18),
                        0 6px 24px rgba(0, 0, 0, 0.72);
                    transition: 800ms cubic-bezier(0.25, 1, 0.5, 1);
                    transition-property: --trib-gradient-angle-offset, --trib-gradient-percent, --trib-gradient-shine, box-shadow;
                    touch-action: none;
                    user-select: none;
                    -webkit-user-select: none;
                    animation: trib-gradient-angle 3s linear infinite;
                }
                .trib-kneel-btn:hover {
                    box-shadow:
                        inset 0 0 0 1px var(--kneel-bg-subtle),
                        0 0 30px rgba(197, 160, 89, 0.3),
                        0 8px 32px rgba(0, 0, 0, 0.8) !important;
                }
                .trib-kneel-btn:active {
                    --trib-gradient-percent: 20% !important;
                    --trib-gradient-angle-offset: 95deg !important;
                    --trib-gradient-shine: var(--kneel-highlight-subtle) !important;
                }
                .trib-kneel-btn::before {
                    content: '';
                    pointer-events: none;
                    position: absolute;
                    left: 50%; top: 50%;
                    translate: -50% -50%;
                    --size: calc(100% - 6px);
                    --position: 2px;
                    --space: calc(var(--position) * 2);
                    width: var(--size);
                    height: var(--size);
                    background: radial-gradient(
                        circle at var(--position) var(--position),
                        white calc(var(--position) / 4),
                        transparent 0
                    ) padding-box;
                    background-size: var(--space) var(--space);
                    background-repeat: space;
                    mask-image: conic-gradient(
                        from calc(var(--trib-gradient-angle) + 45deg),
                        black, transparent 10% 90%, black
                    );
                    border-radius: inherit;
                    opacity: 0.4;
                    z-index: 0;
                    animation: trib-gradient-angle 3s linear infinite;
                }
                .trib-kneel-btn::after {
                    content: '';
                    pointer-events: none;
                    position: absolute;
                    left: 50%; top: 50%;
                    translate: -50% -50%;
                    width: 100%;
                    aspect-ratio: 1;
                    background: linear-gradient(-50deg, transparent, var(--kneel-highlight), transparent);
                    mask-image: radial-gradient(circle at bottom, transparent 40%, black);
                    opacity: 0.5;
                    z-index: 0;
                    animation: trib-shimmer 3s linear infinite paused;
                }
                .trib-kneel-btn:active::before,
                .trib-kneel-btn:active::after {
                    animation-play-state: running !important;
                }
                .trib-kneel-btn span {
                    position: relative;
                    z-index: 1;
                }
                @keyframes gradLine {
                    0% { background-position: 0% 50%; }
                    100% { background-position: 200% 50%; }
                }
                @keyframes revealLine {
                    from { width: 0; }
                    to { width: 100%; }
                }

                .trib-section {
                    opacity: 0;
                    transform: translateY(40px);
                    transition: opacity 0.8s cubic-bezier(0.16,1,0.3,1), transform 0.8s cubic-bezier(0.16,1,0.3,1);
                }
                .trib-section.visible {
                    opacity: 1;
                    transform: translateY(0);
                }

                .trib-cta {
                    transition: transform 0.25s ease, box-shadow 0.25s ease;
                }
                .trib-cta:hover { transform: scale(1.03) !important; box-shadow: 0 8px 50px rgba(197,160,89,0.3) !important; }
                .trib-cta:active { transform: scale(0.97) !important; }

                .lb-tab { transition: all 0.3s ease; cursor: pointer; }
                .lb-tab:hover { color: #c5a059 !important; }

                .trib-grow { opacity: 0; transform: scale(0.92); transform-origin: center center; transition: opacity 0.6s ease-out, transform 0.6s ease-out; }

                .review-card {
                    transition: transform 0.4s ease, box-shadow 0.4s ease;
                    overflow: hidden;
                }
                .review-card:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 12px 40px rgba(0,0,0,0.5), 0 0 1px rgba(197,160,89,0.2);
                }
                .review-avatar {
                    width: 44px; height: 44px; border-radius: 50%; object-fit: cover;
                    border: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;
                }
                .review-avatar-placeholder {
                    width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0;
                    display: flex; align-items: center; justify-content: center;
                    font-family: 'Cinzel', serif; font-size: 0.9rem; font-weight: 600;
                }
                .review-header {
                    display: flex; align-items: center; gap: 14px; position: relative;
                }
                .review-stars { display: flex; gap: 2px; position: absolute; top: 12px; right: 16px; }
                .review-body { overflow: hidden; }
                .review-body p { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.9rem; line-height: 1.8; color: rgba(255,255,255,0.6); font-weight: 300; }
                .review-body img, .review-body video { max-width: 100%; height: auto; border-radius: 8px; display: block; }

                .review-body.clamped p { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
                .review-read-more { display: block; width: 100%; background: none; border: none; border-top: 1px solid rgba(255,255,255,0.04); cursor: pointer; font-family: Orbitron, sans-serif; letter-spacing: 3px; text-align: left; }

                .feature-item {
                    opacity: 0;
                    transition: opacity 0.55s ease-out, transform 0.55s cubic-bezier(0.22,1,0.36,1), background 0.3s ease, border-color 0.3s ease;
                }
                .feature-item.from-left { transform: translateX(-40px); }
                .feature-item.from-right { transform: translateX(40px); }
                .feature-item.slide-in { opacity: 1; transform: translateX(0); }

                @keyframes toastIn {
                    from { opacity: 0; transform: translateX(-50%) translateY(20px); }
                    to { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
                @keyframes toastOut {
                    from { opacity: 1; transform: translateX(-50%) translateY(0); }
                    to { opacity: 0; transform: translateX(-50%) translateY(20px); }
                }

                /* hide scrollbars everywhere */
                * { scrollbar-width: none; }
                *::-webkit-scrollbar { display: none; }

                /* ─── DESKTOP ─── */
                @media (min-width: 769px) {
                    .trib-container {
                        max-width: 1100px !important;
                        padding: 0 60px 80px !important;
                    }
                    .trib-hero {
                        display: flex !important;
                        align-items: center !important;
                        gap: 60px !important;
                        text-align: center !important;
                        padding-top: 48px !important;
                    }
                    .trib-hero-video {
                        flex: 0 0 380px !important;
                        max-width: 380px !important;
                        margin: 0 !important;
                        order: -1;
                    }
                    .trib-hero-text {
                        flex: 1 !important;
                    }
                    .trib-scroll-hint {
                        display: none !important;
                    }
                    .trib-two-col {
                        display: grid !important;
                        grid-template-columns: 1fr 1fr !important;
                        gap: 16px 40px !important;
                    }
                    .trib-reviews-grid {
                        display: grid !important;
                        grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)) !important;
                        gap: 20px !important;
                        max-width: 800px !important;
                        margin-left: auto !important;
                        margin-right: auto !important;
                    }
                    .trib-join-section {
                        max-width: 600px !important;
                        margin-left: auto !important;
                        margin-right: auto !important;
                    }
                    .trib-bottom-cta-section {
                        max-width: 600px !important;
                        margin-left: auto !important;
                        margin-right: auto !important;
                    }
                    .trib-toast {
                        left: auto !important;
                        right: 32px !important;
                        max-width: 420px !important;
                        bottom: 32px !important;
                        width: auto !important;
                        transform: none !important;
                    }
                    .trib-leaderboard-section {
                        max-width: 700px !important;
                        margin-left: auto !important;
                        margin-right: auto !important;
                    }
                }
            `}</style>

            {/* ─── LAYERED BACKGROUNDS ─── */}
            <div style={{ position: 'fixed', inset: 0, backgroundImage: "url('/queen-payment-bg.png')", backgroundSize: 'cover', backgroundPosition: 'center top', zIndex: 0, opacity: 0.75, filter: 'saturate(0.7) brightness(0.9) blur(3px)' }} />
            <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(180deg, rgba(2,2,2,0.2) 0%, rgba(2,2,2,0.4) 50%, rgba(2,2,2,0.6) 80%, rgba(2,2,2,0.75) 100%)', zIndex: 0 }} />
            {/* Gold accent glow top */}
            <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '120vw', height: '40vh', background: 'radial-gradient(ellipse at center top, rgba(197,160,89,0.04) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />
            {/* Noise texture */}
            <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.02, backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")', backgroundSize: '128px 128px' }} />


            {/* ─── TOAST NOTIFICATIONS (same style as queen message banner) ─── */}
            {toasts.map((t: any) => {
                const displayText = t.text || (
                    t.kind === 'tribute' ? `sent ${t.title || 'a tribute'}` :
                    t.kind === 'points' ? `earned ${t.points} points` :
                    t.kind === 'photo' ? 'shared a photo' :
                    t.content || ''
                );
                const avatar = t.sender_avatar || null;
                const initial = (t.sender_name || 'S').charAt(0).toUpperCase();
                const when = t.created_at ? timeAgo(t.created_at) : '';
                const isRisky = t.kind === 'risky' && t.cardIcon;

                return (
                <div key={t._id} className="trib-toast" style={{
                    position: 'fixed', bottom: 'calc(85px + env(safe-area-inset-bottom) + 16px)',
                    left: '50%', transform: 'translateX(-50%)', width: '80%', maxWidth: 420, zIndex: 99999,
                    background: 'linear-gradient(135deg, #0d0d1f 0%, #1a0a2e 100%)',
                    border: '1px solid rgba(197,160,89,0.4)',
                    borderRadius: 18, padding: isRisky ? '0' : '20px 22px',
                    boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(197,160,89,0.08)',
                    animation: t._leaving ? 'toastOut 0.4s ease-in forwards' : 'toastIn 0.4s ease-out forwards',
                    overflow: 'hidden',
                }}>
                    {isRisky ? (
                        /* ── RISKY GAME TOAST: card SVG left + info right ── */
                        <div style={{ display: 'flex', minHeight: 130 }}>
                            {/* Card SVG + card name — left */}
                            <div style={{
                                flex: '0 0 28%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                background: 'rgba(197,160,89,0.04)', borderRight: '1px solid rgba(197,160,89,0.12)',
                                padding: '16px 12px', gap: 8,
                            }}>
                                <img src={t.cardIcon} style={{ width: '65%', maxWidth: 65, height: 'auto', opacity: 0.9 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                {t.cardName && <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.4rem', color: 'rgba(197,160,89,0.45)', letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.3 }}>{t.cardName}</div>}
                            </div>
                            {/* Info — right */}
                            <div style={{ flex: 1, padding: '12px 14px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                                {/* Avatar + Name + Hierarchy */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    {avatar ? (
                                        <img src={avatar} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(197,160,89,0.5)', flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                    ) : (
                                        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '1.5px solid rgba(197,160,89,0.35)', background: 'linear-gradient(135deg, rgba(197,160,89,0.15), rgba(197,160,89,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cinzel, serif', fontSize: '0.75rem', color: 'rgba(197,160,89,0.6)', fontWeight: 600, flexShrink: 0 }}>{initial}</div>
                                    )}
                                    <div>
                                        <div style={{ fontFamily: "'Rosella Solid', serif", fontSize: '0.85rem', color: '#c5a059', letterSpacing: 1 }}>{t.sender_name}</div>
                                        {t.hierarchy && <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.35rem', color: 'rgba(197,160,89,0.4)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 1 }}>{t.hierarchy}</div>}
                                    </div>
                                </div>
                                {/* Gambled line */}
                                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)', fontWeight: 400, marginTop: 4, letterSpacing: 0.5 }}>
                                    just gambled {(t.stakeAmount||0).toLocaleString()} coins
                                </div>
                                {/* Result line */}
                                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.75rem', fontWeight: 600, marginTop: 2, letterSpacing: 0.5 }}>
                                    {t.isWin
                                        ? <span style={{ color: '#4ade80' }}>total won: {(t.wonAmount||0).toLocaleString()}</span>
                                        : t.lostAmount === 0
                                            ? <span style={{ color: '#c5a059' }}>lost nothing</span>
                                            : <span style={{ color: '#ff0000' }}>total lost: {(t.lostAmount||0).toLocaleString()}</span>
                                    }
                                </div>
                                <button
                                    onClick={() => setToasts(prev => prev.filter(x => x._id !== t._id))}
                                    style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)', padding: '4px 12px', borderRadius: 6, fontFamily: 'Orbitron, sans-serif', fontSize: '0.4rem', letterSpacing: 1, cursor: 'pointer', marginTop: 6 }}
                                >DISMISS</button>
                            </div>
                        </div>
                    ) : (
                        /* ── STANDARD TOAST (tribute, promotion, etc.) ── */
                        <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            {avatar ? (
                                <img src={avatar} style={{ flexShrink: 0, width: 46, height: 46, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(197,160,89,0.6)' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            ) : (
                                <div style={{ flexShrink: 0, width: 46, height: 46, borderRadius: '50%', border: '1.5px solid rgba(197,160,89,0.4)', background: 'linear-gradient(135deg, rgba(197,160,89,0.15), rgba(197,160,89,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: 'rgba(197,160,89,0.6)', fontWeight: 600 }}>{initial}</div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontFamily: "'Rosella Solid', serif", fontSize: '0.9rem', color: '#c5a059', letterSpacing: 1, lineHeight: 1.2 }}>
                                    {t.sender_name}
                                </div>
                                {t.hierarchy && <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.4rem', color: 'rgba(197,160,89,0.4)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 2 }}>{t.hierarchy}</div>}
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)', fontWeight: 500, lineHeight: 1.4, marginTop: 4 }}>
                                    {displayText}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            <button
                                onClick={() => setToasts(prev => prev.filter(x => x._id !== t._id))}
                                style={{ flex: 1, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 0', borderRadius: 8, fontFamily: 'Orbitron, sans-serif', fontSize: '0.4rem', letterSpacing: 1, cursor: 'pointer' }}
                            >DISMISS</button>
                        </div>
                        </>
                    )}
                </div>
                );
            })}

            {/* ─── FIXED HEADER ─── */}
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
                textAlign: 'center', padding: '10px 20px 8px',
                background: 'rgba(4,4,6,0.65)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(197,160,89,0.08)',
            }}>
                <div style={{
                    fontFamily: 'Rajdhani, sans-serif', fontSize: '0.5rem', fontWeight: 500,
                    color: 'rgba(197,160,89,0.4)', letterSpacing: '8px', textTransform: 'uppercase',
                    marginBottom: 2,
                }}>
                    PRESENTED BY
                </div>
                <h1 style={{
                    fontFamily: 'Cinzel, serif', fontSize: 'clamp(1.3rem, 5vw, 1.8rem)',
                    color: '#fff', letterSpacing: '4px', textTransform: 'uppercase',
                    margin: 0, fontWeight: 600, lineHeight: 1.1, whiteSpace: 'nowrap',
                }}>
                    QUEEN KARIN
                </h1>
            </div>

            {/* ─── CONTENT ─── */}
            <div className="trib-container" style={{ position: 'relative', zIndex: 1, maxWidth: 560, margin: '0 auto', padding: '0 clamp(20px,5vw,32px) 80px' }}>

                {/* spacer for the fixed header height */}
                <div style={{ paddingTop: 72 }} />

                {/* ════════════════════════════════════════════
                    SECTION 1b: HERO — VIDEO + TEXT
                   ════════════════════════════════════════════ */}
                <div className="trib-hero" style={{ paddingTop: '20vh', textAlign: 'center' }}>

                    {/* ── TEXT (mobile: first, desktop: right side) ── */}
                    <div className="trib-hero-text" style={{ animation: mounted ? 'fadeUp 1s ease-out 0.5s both' : 'none' }}>
                        <p style={{
                            fontFamily: 'Cinzel, serif', fontSize: '1.1rem',
                            color: 'rgba(255,255,255,0.4)', lineHeight: 1.6,
                            maxWidth: 420, margin: '0 auto 12px', fontWeight: 400,
                            letterSpacing: '2px',
                        }}>
                            <span style={{ display: 'block', opacity: heroVisible ? 1 : 0, transform: heroVisible ? 'translateY(0)' : 'translateY(16px)', transition: 'opacity 1s ease, transform 1s ease', marginBottom: 24 }}>A dominatrix.</span>
                            <span style={{ display: 'block', width: 1, height: 36, margin: '0 auto 24px', background: 'linear-gradient(180deg, rgba(197,160,89,0.3), transparent)', opacity: heroVisible ? 1 : 0, transition: 'opacity 1s ease 0.1s' }} />
                            <span style={{ display: 'block', opacity: heroVisible ? 1 : 0, transform: heroVisible ? 'translateY(0)' : 'translateY(16px)', transition: 'opacity 1s ease 0.15s, transform 1s ease 0.15s', marginBottom: 24 }}>A builder.</span>
                            <span style={{ display: 'block', width: 1, height: 36, margin: '0 auto 24px', background: 'linear-gradient(180deg, rgba(197,160,89,0.3), transparent)', opacity: heroVisible ? 1 : 0, transition: 'opacity 1s ease 0.25s' }} />
                            <span style={{ display: 'block', opacity: heroVisible ? 1 : 0, transform: heroVisible ? 'translateY(0)' : 'translateY(16px)', transition: 'opacity 1s ease 0.3s, transform 1s ease 0.3s' }}>A woman who turned devotion into an empire.</span>
                        </p>
                        <p style={{
                            fontFamily: "'Italianno', cursive", fontSize: '1.3rem',
                            color: 'rgba(255,255,255,0.5)', lineHeight: 1.7,
                            maxWidth: 400, margin: '48px auto 0',
                        }}>
                            What started as private sessions evolved into something far greater.
                            A digital household where structure meets surrender, and every subject
                            earns their place through genuine devotion and discipline.
                        </p>

                        {/* Scroll hint (mobile only) */}
                        <div className="trib-scroll-hint" style={{
                            marginTop: 48, animation: mounted ? 'fadeIn 1.5s ease-out 1.2s both' : 'none',
                        }}>
                            <div style={{
                                width: 1, height: 40, margin: '0 auto',
                                background: 'linear-gradient(180deg, rgba(197,160,89,0.3), transparent)',
                                animation: 'breathe 2.5s ease-in-out infinite',
                            }} />
                        </div>
                    </div>

                </div>

                {/* ════════════════════════════════════════════
                    JOIN CTA — directly below hero
                   ════════════════════════════════════════════ */}
                <div
                    id="sec-join"
                    ref={setRef('sec-join')}
                    className={`trib-section trib-join-section ${isVisible('sec-join') ? 'visible' : ''}`}
                    style={{ marginTop: 60, textAlign: 'center' }}
                >
                    <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(1.3rem, 4.5vw, 1.8rem)', color: '#fff', fontWeight: 600, letterSpacing: '3px', margin: '0 0 10px', lineHeight: 1.2 }}>
                        TAKE YOUR PLACE
                    </h2>
                    <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.7, maxWidth: 360, margin: '0 auto 32px', fontWeight: 300 }}>
                        Start your training with weekly or monthly access. Choose your commitment. Begin your service.
                    </p>
                    <div style={{ marginBottom: 28 }}>
                        <div style={{ fontFamily: 'Cinzel, serif', color: '#fff', fontWeight: 700, lineHeight: 1 }}>
                            <span style={{ fontSize: 'clamp(2.8rem, 10vw, 4rem)', textShadow: '0 4px 30px rgba(197,160,89,0.1)' }}>
                                <span style={{ fontSize: '0.55em', fontWeight: 400 }}>&euro;</span>55
                            </span>
                        </div>
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.55rem', fontWeight: 500, color: 'rgba(197,160,89,0.35)', letterSpacing: '5px', marginTop: 6 }}>
                            ACCESS FEE
                        </div>
                    </div>
                    <div style={{ maxWidth: 400, margin: '0 auto' }}>
                        <button className="trib-kneel-btn" onClick={handleTribute} disabled={loading} style={{ opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
                            <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem', color: 'white', textShadow: '0 1px 3px black', letterSpacing: 3, textTransform: 'uppercase' }}>
                                {loading ? 'PROCESSING...' : 'ENTER THE HOUSEHOLD'}
                            </span>
                        </button>
                    </div>
                    {status && (
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: '#c5a059', letterSpacing: '2px', textAlign: 'center', marginTop: 12 }}>{status}</div>
                    )}
                </div>

                {/* ════════════════════════════════════════════
                    SECTION 2: WHAT'S IN THE APP
                   ════════════════════════════════════════════ */}
                <div
                    id="sec-features"
                    ref={setRef('sec-features')}
                    className={`trib-section ${isVisible('sec-features') ? 'visible' : ''}`}
                    style={{ marginTop: 160 }}
                >
                    {/* Section header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 36 }}>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(197,160,89,0.15))' }} />
                        <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.6rem', fontWeight: 500, color: 'rgba(197,160,89,0.35)', letterSpacing: '6px' }}>THE EXPERIENCE</span>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(197,160,89,0.15), transparent)' }} />
                    </div>

                    <div className="trib-two-col" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {[
                            {
                                title: 'HIERARCHY SYSTEM',
                                desc: 'You start at the bottom.',
                                detail: 'Every subject enters at the bottom. Through consistent devotion, completed tasks, and merit earned, you climb. Each rank unlocks new privileges, closer access, and greater expectations. The hierarchy is not just a title. It is a measure of how seriously you take your place at her feet.',
                                svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.8)" strokeWidth="1.5"><path d="M12 2L15 8.5L22 9.5L17 14.5L18 21.5L12 18.5L6 21.5L7 14.5L2 9.5L9 8.5L12 2Z"/></svg>
                            },
                            {
                                title: 'DAILY TASKS & ROUTINES',
                                desc: 'Queen Karin assigns your day.',
                                detail: 'Each day brings new directives: exercises, rituals, written reflections, and acts of service. These are not optional. Completing them builds discipline, earns merit, and keeps you in Queen Karin\'s awareness. Miss them, and you fall behind. Follow them, and you become exactly what you are meant to be.',
                                svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.8)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12L11 14L15 10"/></svg>
                            },
                            {
                                title: 'CHALLENGES',
                                desc: 'Comfort is not why you are here.',
                                detail: 'Beyond daily tasks lie the Challenges. Harder, longer, designed to test your real commitment. Weekly missions push your endurance. Monthly events demand everything. Those who complete them earn recognition, rewards, and a place in the memory of the Court.',
                                svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.8)" strokeWidth="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                            },
                            {
                                title: 'KEYHOLDER',
                                desc: 'Queen Karin holds the key.',
                                detail: 'Keyholder comes with a fully dedicated app. Every day you receive tasks assigned by Queen Karin directly. You check in and out of kneeling sessions. You complete routines and submit proof. Your dashboard shows your daily progress, completed tasks, kneeling count, merit, and full history. Queen Karin can see everything in real time. Nothing goes unnoticed. You report to her, not to yourself.',
                                svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.8)" strokeWidth="1.5"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                            },
                            {
                                title: 'PRIVATE MESSAGES',
                                desc: 'Real words. Real responses. No bots.',
                                detail: 'This is not a chatbot. Queen Karin reads and responds personally. She uses this channel to correct, guide, praise, and instruct. Access is a privilege, not a right. The quality of your engagement determines how much of her attention you receive.',
                                svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.8)" strokeWidth="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                            },
                            {
                                title: 'COMPETITIONS & EVENTS',
                                desc: 'The leaderboard is public.',
                                detail: 'The leaderboard is visible to all. Your rank, your merit, your kneeling count: public. Competitions pit subjects against each other for positions of honour and recognition from the Queen herself. Live events create moments you will not forget. This is not a passive experience.',
                                svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.8)" strokeWidth="1.5"><path d="M6 9H4a2 2 0 01-2-2V4h6M18 9h2a2 2 0 002-2V4h-6M12 15V9M8 21h8M12 21v-6"/><rect x="6" y="3" width="12" height="8" rx="1"/></svg>
                            },
                        ].map((item, i) => {
                            const isOpen = expandedFeature === i;
                            return (
                            <div key={i} className="feature-item" style={{
                                borderRadius: 8,
                                borderLeft: `1.5px solid ${isOpen ? 'rgba(197,160,89,0.5)' : 'rgba(197,160,89,0.2)'}`,
                                background: isOpen ? 'rgba(197,160,89,0.06)' : 'rgba(197,160,89,0.03)',
                                backdropFilter: 'blur(24px)',
                                WebkitBackdropFilter: 'blur(24px)',
                                overflow: 'hidden',
                                cursor: 'pointer',
                            }} onClick={() => setExpandedFeature(isOpen ? null : i)}>
                                {/* Header row */}
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '16px 14px' }}>
                                    <div style={{ width: 28, textAlign: 'center', flexShrink: 0, marginTop: 2, display: 'flex', justifyContent: 'center' }}>
                                        {item.svg}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{
                                            fontFamily: 'Cinzel, serif', fontSize: '0.82rem', fontWeight: 600,
                                            color: 'rgba(197,160,89,0.8)', letterSpacing: '2px', marginBottom: 4,
                                        }}>
                                            {item.title}
                                        </div>
                                        <div style={{ height: 1, background: 'rgba(197,160,89,0.12)', margin: '6px 0' }} />
                                        <div style={{
                                            fontFamily: "'Italianno', cursive", fontSize: '1.15rem',
                                            color: 'rgba(255,255,255,0.55)', lineHeight: 1.4, fontWeight: 400,
                                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                        }}>
                                            {item.desc}
                                        </div>
                                    </div>
                                    {/* Chevron */}
                                    <div style={{ flexShrink: 0, marginTop: 2, transition: 'transform 0.3s ease', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.5)" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                                    </div>
                                </div>
                                {/* Drawer */}
                                <div style={{
                                    maxHeight: isOpen ? 300 : 0,
                                    overflow: 'hidden',
                                    transition: 'max-height 0.4s cubic-bezier(0.4,0,0.2,1)',
                                }}>
                                    <div style={{ padding: '0 14px 16px 58px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.8, fontWeight: 300, borderTop: '1px solid rgba(197,160,89,0.08)' }}>
                                        <div style={{ paddingTop: 12 }}>{item.detail}</div>
                                    </div>
                                </div>
                            </div>
                            );
                        })}
                    </div>
                </div>




                {/* ════════════════════════════════════════════
                    SECTION 4: LEADERBOARD
                   ════════════════════════════════════════════ */}
                <div
                    id="sec-leaderboard"
                    ref={setRef('sec-leaderboard')}
                    className={`trib-section trib-leaderboard-section ${isVisible('sec-leaderboard') ? 'visible' : ''}`}
                    style={{ marginTop: 80 }}
                >
                    {/* Section header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(197,160,89,0.15))' }} />
                        <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.6rem', fontWeight: 500, color: 'rgba(197,160,89,0.35)', letterSpacing: '6px' }}>LEADERBOARD</span>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(197,160,89,0.15), transparent)' }} />
                    </div>

                    {/* Period tabs */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 0, marginBottom: 24 }}>
                        {(['today', 'weekly', 'monthly', 'alltime'] as const).map(p => (
                            <button
                                key={p}
                                className="lb-tab"
                                onClick={() => setLbPeriod(p)}
                                style={{
                                    background: 'none', border: 'none', padding: '8px 16px',
                                    fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', fontWeight: 600,
                                    letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer',
                                    color: lbPeriod === p ? '#c5a059' : 'rgba(255,255,255,0.2)',
                                    borderBottom: lbPeriod === p ? '1.5px solid rgba(197,160,89,0.4)' : '1.5px solid transparent',
                                }}
                            >
                                {p === 'alltime' ? 'ALL' : p === 'today' ? 'TODAY' : p === 'weekly' ? 'WEEK' : 'MONTH'}
                            </button>
                        ))}
                    </div>

                    {/* Leaderboard entries */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {leaderboard.length === 0 && (
                            <div style={{
                                textAlign: 'center', padding: '30px 0',
                                fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.8rem',
                                color: 'rgba(255,255,255,0.12)',
                            }}>
                                No scores yet for this period
                            </div>
                        )}
                        {leaderboard.slice(0, 10).map((entry, i) => (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: 14,
                                padding: '14px 16px', borderRadius: 8,
                                background: i === 0 ? 'rgba(197,160,89,0.06)' : 'rgba(255,255,255,0.02)',
                                borderLeft: i < 3 ? `2px solid rgba(197,160,89,${0.35 - i * 0.08})` : '2px solid transparent',
                            }}>
                                {/* Rank */}
                                <div style={{
                                    fontFamily: 'Cinzel, serif', fontSize: i === 0 ? '1.3rem' : '1rem',
                                    fontWeight: 700, color: i === 0 ? '#c5a059' : i < 3 ? 'rgba(197,160,89,0.5)' : 'rgba(255,255,255,0.18)',
                                    width: 30, textAlign: 'center', flexShrink: 0,
                                }}>
                                    {i + 1}
                                </div>
                                {/* Avatar */}
                                <div style={{
                                    width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                                    background: entry.avatar
                                        ? `url(${entry.avatar}) center/cover`
                                        : 'linear-gradient(135deg, rgba(197,160,89,0.12), rgba(197,160,89,0.04))',
                                    border: '1px solid rgba(197,160,89,0.15)',
                                }} />
                                {/* Name & hierarchy */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontFamily: 'Cinzel, serif', fontSize: '0.92rem',
                                        color: i === 0 ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.55)',
                                        fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>
                                        {entry.name}
                                    </div>
                                    <div style={{
                                        fontFamily: 'Rajdhani, sans-serif', fontSize: '0.65rem', fontWeight: 500,
                                        color: 'rgba(197,160,89,0.35)', letterSpacing: '1.5px',
                                    }}>
                                        {entry.hierarchy}
                                    </div>
                                </div>
                                {/* Score */}
                                <div style={{
                                    fontFamily: 'Rajdhani, sans-serif', fontSize: '1rem', fontWeight: 700,
                                    color: i === 0 ? '#c5a059' : 'rgba(197,160,89,0.5)',
                                    flexShrink: 0,
                                }}>
                                    {entry.score?.toLocaleString()}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── VIDEO ── */}
                <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(197,160,89,0.1)', maxWidth: '75%', margin: '48px auto 0', background: '#000' }}>
                    <video
                        src="/tribute-intro.mov"
                        autoPlay muted loop playsInline
                        style={{ width: '100%', display: 'block', opacity: 0.6 }}
                    />
                </div>

                {/* ════════════════════════════════════════════
                    SECTION 6: REVIEWS
                   ════════════════════════════════════════════ */}
                <div
                    id="sec-reviews"
                    ref={setRef('sec-reviews')}
                    className={`trib-section ${isVisible('sec-reviews') ? 'visible' : ''}`}
                    style={{ marginTop: 80 }}
                >
                    {/* Section header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 32 }}>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(197,160,89,0.15))' }} />
                        <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.6rem', fontWeight: 500, color: 'rgba(197,160,89,0.35)', letterSpacing: '6px' }}>TESTIMONIALS</span>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(197,160,89,0.15), transparent)' }} />
                    </div>

                    {/* Review cards — keyholder style: 3 visible, clamped, grow animation */}
                    {reviews.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '30px 0', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.12)' }}>
                            No reviews yet
                        </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 40, margin: '0 -20px' }}>
                        {(showAllReviews ? reviews : reviews.slice(0, 3)).map((review, i) => {
                            const rev = review.reviewer || {};
                            const rName = rev.name || 'Loyal Subject';
                            const rAvatar = rev.avatar || null;
                            const rHierarchy = rev.hierarchy || 'Hall Boy';
                            const rMerit = rev.merit || 0;
                            const rTasks = rev.tasksCompleted || 0;
                            const rKneels = rev.kneelCount || 0;
                            const rServing = rev.servingText || '';
                            const rRating = review.rating || 5;
                            const initial = rName.charAt(0).toUpperCase();
                            return (
                            <div key={review.id || i} className="trib-grow">
                                <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(6,6,10,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', overflow: 'hidden' }}>

                                    {/* ── PROFILE CARD HEADER ── */}
                                    <div style={{ background: 'linear-gradient(135deg, rgba(197,160,89,0.04) 0%, rgba(255,255,255,0.01) 100%)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        {/* Top row: avatar left, identity right */}
                                        <div style={{ padding: '18px 18px 14px', display: 'flex', alignItems: 'center', gap: 16 }}>
                                            {/* Avatar — left side, bigger */}
                                            <div style={{ flexShrink: 0 }}>
                                                {rAvatar ? (
                                                    <img src={rAvatar} style={{ width: 70, height: 70, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(197,160,89,0.25)', display: 'block' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                                ) : (
                                                    <div style={{ width: 70, height: 70, borderRadius: '50%', background: 'rgba(197,160,89,0.05)', border: '1.5px solid rgba(197,160,89,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cinzel,serif', fontSize: '1.4rem', color: 'rgba(197,160,89,0.4)' }}>{initial}</div>
                                                )}
                                            </div>
                                            {/* Identity — 3 lines centered */}
                                            <div style={{ flex: 1, textAlign: 'center' }}>
                                                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.9rem', color: 'rgba(255,255,255,0.85)', fontWeight: 600, letterSpacing: 1.2, marginBottom: 4 }}>{rName}</div>
                                                <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.6rem', fontWeight: 700, letterSpacing: 2.5, color: 'rgba(197,160,89,0.7)', textTransform: 'uppercase', marginBottom: 3 }}>{rHierarchy}</div>
                                                {rServing && (
                                                    <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.55rem', color: 'rgba(255,255,255,0.45)', letterSpacing: 1.5, textTransform: 'uppercase' }}>SERVING {rServing.toUpperCase()}</div>
                                                )}
                                            </div>
                                        </div>
                                        {/* Stat bar — full width, 3 stats */}
                                        <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                            {[
                                                { label: 'MERIT', value: rMerit.toLocaleString() },
                                                { label: 'TASKS', value: rTasks },
                                                { label: 'KNEELING', value: rKneels.toLocaleString() },
                                            ].map((stat, si) => (
                                                <div key={stat.label} style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderLeft: si > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                                                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{stat.value}</div>
                                                    <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.44rem', color: 'rgba(255,255,255,0.18)', letterSpacing: 2, textTransform: 'uppercase' }}>{stat.label}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* ── REVIEW BODY ── */}
                                    <div className="review-body clamped" id={`trib-review-body-${i}`} style={{ padding: '14px 18px 16px' }}>
                                        <div style={{ display: 'flex', gap: 1, marginBottom: 8 }}>
                                            {Array.from({ length: 5 }, (_, s) => (
                                                <span key={s} style={{ fontSize: '0.65rem', color: s < rRating ? '#8b0000' : 'rgba(255,255,255,0.08)' }}>&#9733;</span>
                                            ))}
                                        </div>
                                        <p style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: '0.8rem', lineHeight: 1.8, color: 'rgba(255,255,255,0.5)', fontWeight: 300, margin: 0 }}>&ldquo;{review.text}&rdquo;</p>
                                    </div>
                                    <button className="review-read-more" style={{ fontSize: '0.6rem', padding: '8px 18px 12px', color: 'rgba(255,255,255,0.4)' }} onClick={(e) => {
                                        const body = document.getElementById(`trib-review-body-${i}`);
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
                    </div>
                </div>


                {/* ════════════════════════════════════════════
                    SECOND CTA (bottom)
                   ════════════════════════════════════════════ */}
                <div
                    id="sec-bottom-cta"
                    ref={setRef('sec-bottom-cta')}
                    className={`trib-section trib-bottom-cta-section ${isVisible('sec-bottom-cta') ? 'visible' : ''}`}
                    style={{ marginTop: 72, textAlign: 'center' }}
                >
                    <div style={{
                        width: 8, height: 8, transform: 'rotate(45deg)',
                        background: 'rgba(197,160,89,0.2)', margin: '0 auto 24px',
                    }} />
                    <h3 style={{
                        fontFamily: 'Cinzel, serif', fontSize: 'clamp(1.1rem, 3.5vw, 1.4rem)',
                        color: 'rgba(255,255,255,0.7)', fontWeight: 500, letterSpacing: '3px',
                        margin: '0 0 24px',
                    }}>
                        YOUR PLACE IS WAITING
                    </h3>
                    <div style={{ maxWidth: 400, margin: '0 auto' }}>
                        <button className="trib-kneel-btn" onClick={handleTribute} disabled={loading}
                            style={{ opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
                            <span style={{
                                fontFamily: 'Orbitron, sans-serif', fontSize: '0.75rem',
                                color: 'white', textShadow: '0 1px 3px black',
                                letterSpacing: 3, textTransform: 'uppercase',
                            }}>
                                {loading ? 'PROCESSING...' : 'ACCEPT THE CHALLENGE'}
                            </span>
                        </button>
                    </div>
                </div>


                {/* ─── FOOTER ─── */}
                <div style={{ textAlign: 'center', marginTop: 60, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 24, paddingBottom: 100 }}>
                    {userEmail && (
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', fontWeight: 500, color: 'rgba(255,255,255,0.3)', letterSpacing: '2px', marginBottom: 14 }}>{userEmail}</div>
                    )}
                    <button onClick={handleLogout}
                        style={{
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
                            fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', fontWeight: 600,
                            color: 'rgba(255,255,255,0.35)', letterSpacing: '3px', padding: '10px 28px', cursor: 'pointer',
                        }}>
                        LOGOUT
                    </button>
                </div>

            </div>

        </div>
        {/* ── TIER PICKER ── */}
        {showTierPicker && !showPayment && (
            <div style={{ position: 'fixed', inset: 0, background: '#030308', zIndex: 99999999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 28px', overflowY: 'auto' }}>
                <div style={{ width: '100%', maxWidth: 420, paddingTop: 20, paddingBottom: 40 }}>
                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '1.2rem', color: '#fff', fontWeight: 700, letterSpacing: 2, textAlign: 'center', marginBottom: 8 }}>SELECT ACCESS</div>
                    <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.65rem', color: 'rgba(197,160,89,0.5)', letterSpacing: 5, textAlign: 'center', marginBottom: 36 }}>ENTRANCE TRIBUTE</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {TRIBUTE_TIERS.map(tier => (
                            <button key={tier.id} onClick={() => { setSelectedTier(tier); setShowTierPicker(false); setShowPayment(true); }}
                                style={{ position: 'relative', width: '100%', padding: '22px 24px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}>
                                {tier.badge && (
                                    <div style={{ position: 'absolute', top: -9, right: 16, fontFamily: 'Orbitron,sans-serif', fontSize: '0.35rem', color: '#c5a059', background: '#030308', padding: '2px 8px', border: '1px solid rgba(197,160,89,0.35)', borderRadius: 3, letterSpacing: 2 }}>{tier.badge}</div>
                                )}
                                <div style={{ textAlign: 'left' }}>
                                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.7rem', color: '#fff', fontWeight: 700, letterSpacing: 2, marginBottom: 4 }}>{tier.label} <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.55rem', fontWeight: 400 }}>· {tier.period}</span></div>
                                    <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>{tier.desc}</div>
                                </div>
                                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '1.3rem', color: '#c5a059', fontWeight: 700, flexShrink: 0, marginLeft: 16 }}>€{tier.price}</div>
                            </button>
                        ))}
                    </div>
                    <button onClick={() => setShowTierPicker(false)} style={{ width: '100%', marginTop: 20, padding: '16px', background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: 'rgba(255,255,255,0.55)', fontFamily: 'Rajdhani,sans-serif', fontSize: '0.75rem', letterSpacing: 4, cursor: 'pointer' }}>CANCEL</button>
                </div>
            </div>
        )}

        {showPayment && selectedTier && (
            <PaymentModal
                amountEur={selectedTier.price}
                label="ENTRANCE TRIBUTE"
                cardBody={{ memberId: userEmail || '', amount: selectedTier.price }}
                cryptoApiPath="/api/tribute/passimpay"
                cryptoStatusApiPath="/api/tribute/passimpay-status"
                cryptoPayBody={{ memberId: userEmail || '', amount: selectedTier.price, tierId: selectedTier.id }}
                cryptoStatusBody={{ tierId: selectedTier.id }}
                confirmMessage="✓ PAYMENT CONFIRMED — ENTERING..."
                throneUrl="https://throne.com/queenkarin"
                onSuccess={() => { window.location.href = '/onboarding'; }}
                onClose={() => { setShowPayment(false); setShowTierPicker(true); }}
            />
        )}
    </>);
}
