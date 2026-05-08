"use client";

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';

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
    const [toasts, setToasts] = useState<any[]>([]);
    const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());
    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const [countdown, setCountdown] = useState({ d: 0, h: 0, m: 0, s: 0 });

    /* countdown to next Sunday midnight (local time) */
    useEffect(() => {
        const getNext = () => {
            const now = new Date();
            const day = now.getDay(); // 0=Sun
            const daysUntilSun = day === 0 ? 0 : 7 - day;
            const target = new Date(now);
            target.setDate(now.getDate() + daysUntilSun);
            target.setHours(23, 59, 59, 999);
            // If it's Sunday and past 23:59, target next Sunday
            if (target.getTime() <= now.getTime()) {
                target.setDate(target.getDate() + 7);
            }
            return target.getTime();
        };
        const tick = () => {
            const diff = Math.max(0, getNext() - Date.now());
            const s = Math.floor(diff / 1000) % 60;
            const m = Math.floor(diff / 60000) % 60;
            const h = Math.floor(diff / 3600000) % 24;
            const d = Math.floor(diff / 86400000);
            setCountdown({ d, h, m, s });
        };
        tick();
        const iv = setInterval(tick, 1000);
        return () => clearInterval(iv);
    }, []);

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
        try {
            if (content.startsWith('RISKY_TRIBUTE_CARD::')) {
                const d = JSON.parse(content.replace('RISKY_TRIBUTE_CARD::', ''));
                const isWin = d.isWin;
                const resultText = isWin ? `won +${(d.wonAmount||0).toLocaleString()} coins` : d.lostAmount === 0 ? 'lost nothing' : `lost ${(d.lostAmount||0).toLocaleString()} coins`;
                return { sender_name: d.senderName || 'SUBJECT', sender_avatar: d.senderAvatar || avatar, text: `just gambled ${(d.stakeAmount||0).toLocaleString()} coins and ${resultText}`, kind: 'risky', cardIcon: d.icon || null, cardName: d.cardName || null, isWin, stakeAmount: d.stakeAmount || 0, wonAmount: d.wonAmount || 0, lostAmount: d.lostAmount || 0, created_at: created };
            }
            if (content.startsWith('DIRECT_TRIBUTE_CARD::')) {
                const d = JSON.parse(content.replace('DIRECT_TRIBUTE_CARD::', ''));
                return { sender_name: d.senderName || 'SUBJECT', sender_avatar: d.senderAvatar || avatar, text: `sent a tribute of ${(d.amount||0).toLocaleString()} coins`, kind: 'tribute', created_at: created };
            }
            if (content.startsWith('PROMOTION_CARD::')) {
                const d = JSON.parse(content.replace('PROMOTION_CARD::', ''));
                return { sender_name: d.name || 'SUBJECT', sender_avatar: avatar, text: `was promoted to ${d.newRank || 'a new rank'}`, kind: 'promotion', created_at: created };
            }
            if (content.startsWith('CHALLENGE_TASK_CARD::')) {
                const d = JSON.parse(content.replace('CHALLENGE_TASK_CARD::', ''));
                return { sender_name: d.senderName || 'SUBJECT', sender_avatar: d.senderAvatar || avatar, text: `completed a challenge task${d.passed !== false ? '' : ' (failed)'}`, kind: 'challenge', created_at: created };
            }
            if (content.startsWith('WELCOME_CARD::')) {
                const d = JSON.parse(content.replace('WELCOME_CARD::', ''));
                return { sender_name: d.name || 'New Subject', sender_avatar: avatar, text: 'entered the household', kind: 'welcome', created_at: created };
            }
            if (content.startsWith('UPDATE_MERIT_CARD::')) {
                const d = JSON.parse(content.replace('UPDATE_MERIT_CARD::', ''));
                return { sender_name: d.senderName || 'SUBJECT', sender_avatar: d.senderAvatar || avatar, text: `earned +${d.points || 0} points`, kind: 'merit', created_at: created };
            }
            if (content.startsWith('UPDATE_COINS_CARD::')) {
                const d = JSON.parse(content.replace('UPDATE_COINS_CARD::', ''));
                return { sender_name: d.senderName || 'SUBJECT', sender_avatar: d.senderAvatar || avatar, text: `claimed +${d.points || 0} coins from kneeling`, kind: 'coins', created_at: created };
            }
            if (content.startsWith('CHALLENGE_JOIN_CARD::')) {
                const d = JSON.parse(content.replace('CHALLENGE_JOIN_CARD::', ''));
                return { sender_name: d.senderName || d.name || 'SUBJECT', sender_avatar: d.senderAvatar || avatar, text: `joined ${d.challengeName || 'a challenge'}`, kind: 'challenge', created_at: created };
            }
        } catch {}
        return null;
    };

    /* fetch last activity item + realtime for new ones */
    useEffect(() => {
        // Fetch latest global_messages card as initial toast
        const timer = setTimeout(async () => {
            try {
                const supabase = createClient();
                const { data } = await supabase
                    .from('global_messages')
                    .select('message, sender_name, sender_avatar, sender_email, created_at')
                    .order('created_at', { ascending: false })
                    .limit(10);
                if (data) {
                    for (const msg of data) {
                        const parsed = parseGlobalCard(msg);
                        if (parsed) {
                            // If no avatar, look it up from profiles
                            if (!parsed.sender_avatar && msg.sender_email && msg.sender_email !== 'system') {
                                try {
                                    const { data: p } = await supabase.from('profiles').select('avatar_url').ilike('member_id', msg.sender_email).limit(1);
                                    if (p && p[0]?.avatar_url) parsed.sender_avatar = p[0].avatar_url;
                                } catch {}
                            }
                            showToast(parsed); break;
                        }
                    }
                }
            } catch {}
        }, 7000);

        // Realtime: global_messages for risky game, tributes, promotions, etc.
        const supabase = createClient();
        const channel = supabase.channel('tribute-activity')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'global_messages' }, async (payload: any) => {
                const row = payload.new;
                if (!row) return;
                const parsed = parseGlobalCard(row);
                if (parsed) {
                    if (!parsed.sender_avatar && row.sender_email && row.sender_email !== 'system') {
                        try {
                            const { data: p } = await supabase.from('profiles').select('avatar_url').ilike('member_id', row.sender_email).limit(1);
                            if (p && p[0]?.avatar_url) parsed.sender_avatar = p[0].avatar_url;
                        } catch {}
                    }
                    showToast(parsed);
                }
            })
            .subscribe();

        return () => {
            clearTimeout(timer);
            supabase.removeChannel(channel);
        };
    }, []);

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

    const handleTribute = async () => {
        setLoading(true); setStatus(null);
        try {
            const res = await fetch('/api/stripe/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'entrance_tribute' }) });
            const data = await res.json();
            if (data.url) window.location.href = data.url;
            else setStatus('Something went wrong. Try again.');
        } catch { setStatus('Connection error. Try again.'); }
        finally { setLoading(false); }
    };

    const handleLogout = async () => { const s = createClient(); await s.auth.signOut(); window.location.href = '/login'; };

    const isVisible = (id: string) => visibleSections.has(id);
    const setRef = (id: string) => (el: HTMLDivElement | null) => { sectionRefs.current[id] = el; };

    const showAccessDenied = (section?: string) => {
        const label = section || 'this section';
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.85);backdrop-filter:blur(10px);';
        overlay.innerHTML = `
            <div style="text-align:center;padding:40px 30px;max-width:320px;">
                <div style="font-family:Orbitron,sans-serif;font-size:0.5rem;color:rgba(197,160,89,0.5);letter-spacing:4px;margin-bottom:16px;">ACCESS DENIED</div>
                <div style="font-family:Cinzel,serif;font-size:1.1rem;color:rgba(255,255,255,0.7);margin-bottom:12px;line-height:1.5;">You don't have access to ${label}</div>
                <div style="font-family:Rajdhani,sans-serif;font-size:0.85rem;color:rgba(255,255,255,0.3);line-height:1.6;margin-bottom:24px;">Unlock your experience to explore everything inside.</div>
                <div style="display:flex;gap:8px;">
                    <button id="adClose" style="flex:1;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);border:1px solid rgba(255,255,255,0.1);padding:10px 0;border-radius:8px;font-family:Orbitron,sans-serif;font-size:0.5rem;letter-spacing:2px;cursor:pointer;">CLOSE</button>
                    <button id="adUnlock" style="flex:2;background:linear-gradient(135deg,#c5a059 0%,#8a6d30 100%);color:#020202;border:none;padding:10px 0;border-radius:8px;font-family:Orbitron,sans-serif;font-size:0.5rem;font-weight:700;letter-spacing:2px;cursor:pointer;">UNLOCK</button>
                </div>
            </div>
        `;
        overlay.querySelector('#adClose')?.addEventListener('click', (e) => { e.stopPropagation(); overlay.remove(); });
        overlay.querySelector('#adUnlock')?.addEventListener('click', (e) => { e.stopPropagation(); overlay.remove(); handleTribute(); });
        overlay.addEventListener('click', () => overlay.remove());
        document.body.appendChild(overlay);
    };

    const fakeNavBtnStyle: React.CSSProperties = {
        flex: 1, background: 'transparent', border: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 5, cursor: 'pointer', padding: 0,
    };
    const fakeNavIconStyle: React.CSSProperties = { fontSize: '1.6rem', color: 'rgba(197, 160, 89, 0.35)', lineHeight: 1 };
    const fakeNavLabelStyle: React.CSSProperties = { fontFamily: 'Orbitron, sans-serif', fontSize: '0.55rem', color: 'rgba(197, 160, 89, 0.35)', letterSpacing: 1.5, textTransform: 'uppercase' };

    const stars = (n: number) => Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < n ? '#c5a059' : 'rgba(255,255,255,0.08)', fontSize: '0.75rem' }}>&#9733;</span>
    ));

    return (
        <div style={{ background: '#020202', color: '#fff', minHeight: '100dvh', overflowX: 'hidden', position: 'relative' }}>
            {/* Promo countdown banner — fixed top */}
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10000001,
                background: 'linear-gradient(135deg, rgba(197,160,89,0.15), rgba(5,8,18,0.98))',
                borderBottom: '1px solid rgba(197,160,89,0.35)',
                padding: '8px 14px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                boxShadow: '0 2px 24px rgba(0,0,0,0.6)',
                backdropFilter: 'blur(16px)',
            }}>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', color: '#fff', letterSpacing: '14px', fontWeight: 700, textTransform: 'uppercase' }}>Special Access</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {[countdown.h + countdown.d * 24, countdown.m, countdown.s].map((val, i, arr) => (
                            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{
                                    background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.25)',
                                    borderRadius: 6, width: 52, height: 30,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.85rem', color: '#fff', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                                        {String(val).padStart(2, '0')}
                                    </span>
                                </div>
                                {i < arr.length - 1 && <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.9rem', color: 'rgba(197,160,89,0.5)', fontWeight: 700 }}>:</span>}
                            </span>
                        ))}
                    </div>
                    <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.3, whiteSpace: 'nowrap' }}>ends sunday midnight</div>
                </div>
                {/* Diagonal "DON'T MISS" ribbon */}
                <div style={{
                    position: 'absolute', top: 0, left: -20, width: 120, height: '100%',
                    overflow: 'hidden', pointerEvents: 'none',
                }}>
                    <div style={{
                        position: 'absolute', top: '50%', left: -10,
                        transform: 'translateY(-50%) rotate(35deg)',
                        background: 'linear-gradient(90deg, #8b1a1a, #c0392b, #8b1a1a)',
                        padding: '2px 30px',
                        fontFamily: 'Cinzel, serif', fontSize: '0.4rem', fontWeight: 700,
                        color: '#000', letterSpacing: '2px', whiteSpace: 'nowrap',
                        animation: 'dontMissPulse 2s ease-in-out infinite',
                        boxShadow: '0 0 12px rgba(192,57,43,0.5)',
                    }}>
                        DON&apos;T MISS
                    </div>
                </div>
            </div>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Italianno&family=Rajdhani:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@300;400;500&display=swap');
                @keyframes dontMissPulse {
                    0%, 100% { opacity: 0.7; }
                    50% { opacity: 1; }
                }

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

                .review-card {
                    transition: transform 0.4s ease, box-shadow 0.4s ease;
                }
                .review-card:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 12px 40px rgba(0,0,0,0.5), 0 0 1px rgba(197,160,89,0.2);
                }

                .feature-item {
                    transition: transform 0.3s ease;
                }
                .feature-item:hover {
                    transform: translateX(4px);
                }

                @keyframes toastIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes toastOut {
                    from { opacity: 1; transform: translateY(0); }
                    to { opacity: 0; transform: translateY(20px); }
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
                    .trib-fake-nav {
                        display: none !important;
                    }
                    .trib-bottom-pad {
                        height: 0 !important;
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
                    }
                    .trib-leaderboard-section {
                        max-width: 700px !important;
                        margin-left: auto !important;
                        margin-right: auto !important;
                    }
                }
            `}</style>

            {/* ─── LAYERED BACKGROUNDS ─── */}
            <div style={{ position: 'fixed', inset: 0, backgroundImage: "url('/queen-bg-mobile.jpg')", backgroundSize: 'cover', backgroundPosition: 'center 20%', zIndex: 0, opacity: 0.35, filter: 'saturate(0.2) brightness(0.7)' }} />
            <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(180deg, rgba(2,2,2,0.3) 0%, rgba(2,2,2,0.7) 30%, rgba(2,2,2,0.92) 55%, #020202 75%)', zIndex: 0 }} />
            {/* Gold accent glow top */}
            <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '120vw', height: '40vh', background: 'radial-gradient(ellipse at center top, rgba(197,160,89,0.04) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />
            {/* Noise texture */}
            <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.02, backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")', backgroundSize: '128px 128px' }} />


            {/* ─── TOAST NOTIFICATIONS (same style as queen message banner) ─── */}
            {toasts.map((t: any) => {
                const displayText = t.text || (
                    t.kind === 'tribute' ? `sent ${t.title || 'a tribute'}` :
                    t.kind === 'points' ? `earned +${t.points} points` :
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
                    right: 12, left: 12, zIndex: 99999,
                    background: 'linear-gradient(135deg, #0d0d1f 0%, #1a0a2e 100%)',
                    border: '1px solid rgba(197,160,89,0.4)',
                    borderRadius: 18, padding: isRisky ? '0' : '20px 22px',
                    boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(197,160,89,0.08)',
                    animation: t._leaving ? 'toastOut 0.4s ease-in forwards' : 'toastIn 0.4s ease-out forwards',
                    overflow: 'hidden',
                }}>
                    {isRisky ? (
                        /* ── RISKY GAME TOAST: card SVG 30% left + info right ── */
                        <div style={{ display: 'flex', minHeight: 130 }}>
                            {/* Card SVG — 30% left */}
                            <div style={{
                                flex: '0 0 30%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'rgba(197,160,89,0.04)', borderRight: '1px solid rgba(197,160,89,0.12)',
                                padding: 16,
                            }}>
                                <img src={t.cardIcon} style={{ width: '70%', maxWidth: 70, height: 'auto', opacity: 0.9 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            </div>
                            {/* Info — 70% right */}
                            <div style={{ flex: 1, padding: '18px 18px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.45rem', color: 'rgba(197,160,89,0.5)', letterSpacing: 2, textTransform: 'uppercase' }}>Recent Activity</div>
                                    {when && <span style={{ fontFamily: 'Orbitron, sans-serif', color: 'rgba(197,160,89,0.3)', letterSpacing: 1, fontSize: '0.4rem' }}>{when}</span>}
                                </div>
                                {/* Avatar + Name */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    {avatar ? (
                                        <img src={avatar} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(197,160,89,0.5)', flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                    ) : (
                                        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '1.5px solid rgba(197,160,89,0.35)', background: 'linear-gradient(135deg, rgba(197,160,89,0.15), rgba(197,160,89,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: 'rgba(197,160,89,0.6)', fontWeight: 600, flexShrink: 0 }}>{initial}</div>
                                    )}
                                    <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: '#c5a059', fontWeight: 600, letterSpacing: 1 }}>{t.sender_name}</span>
                                </div>
                                {/* Gambled text */}
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.4, fontWeight: 500 }}>
                                    just gambled {(t.stakeAmount||0).toLocaleString()} coins and {t.isWin ? <span style={{ color: '#4ade80' }}>won +{(t.wonAmount||0).toLocaleString()}</span> : t.lostAmount === 0 ? <span style={{ color: '#c5a059' }}>lost nothing</span> : <span style={{ color: '#ef4444' }}>lost {(t.lostAmount||0).toLocaleString()}</span>}
                                </div>
                                {/* Card name */}
                                {t.cardName && (
                                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.5rem', color: 'rgba(197,160,89,0.5)', letterSpacing: 3, textTransform: 'uppercase', marginTop: 2 }}>{t.cardName}</div>
                                )}
                                <button
                                    onClick={() => setToasts(prev => prev.filter(x => x._id !== t._id))}
                                    style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)', padding: '5px 16px', borderRadius: 6, fontFamily: 'Orbitron, sans-serif', fontSize: '0.4rem', letterSpacing: 1, cursor: 'pointer', marginTop: 4 }}
                                >DISMISS</button>
                            </div>
                        </div>
                    ) : (
                        /* ── STANDARD TOAST (tribute, promotion, etc.) ── */
                        <>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                            {avatar ? (
                                <img src={avatar} style={{ flexShrink: 0, width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(197,160,89,0.6)' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            ) : (
                                <div style={{ flexShrink: 0, width: 44, height: 44, borderRadius: '50%', border: '1.5px solid rgba(197,160,89,0.4)', background: 'linear-gradient(135deg, rgba(197,160,89,0.15), rgba(197,160,89,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: 'rgba(197,160,89,0.6)', fontWeight: 600 }}>{initial}</div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.5rem', color: '#c5a059', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span>Recent Activity</span>
                                    {when && <span style={{ color: 'rgba(197,160,89,0.4)', letterSpacing: 1, fontSize: '0.45rem' }}>{when}</span>}
                                </div>
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.05rem', color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', fontWeight: 500, lineHeight: 1.4 }}>
                                    <span style={{ color: '#c5a059' }}>{t.sender_name}</span>
                                    {' '}{displayText}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                            <button
                                onClick={() => setToasts(prev => prev.filter(x => x._id !== t._id))}
                                style={{ flex: 1, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)', padding: '9px 0', borderRadius: 8, fontFamily: 'Orbitron, sans-serif', fontSize: '0.5rem', letterSpacing: 1, cursor: 'pointer' }}
                            >DISMISS</button>
                        </div>
                        </>
                    )}
                </div>
                );
            })}

            {/* ─── CONTENT ─── */}
            <div className="trib-container" style={{ position: 'relative', zIndex: 1, maxWidth: 560, margin: '0 auto', padding: '0 clamp(20px,5vw,32px) 80px' }}>

                {/* ════════════════════════════════════════════
                    SECTION 1: BRAND HEADER — QUEEN KARIN
                   ════════════════════════════════════════════ */}
                <div style={{ paddingTop: 'clamp(60px, 12vw, 100px)', textAlign: 'center' }}>
                    {/* Queen avatar with animated rings + name — brand header */}
                    <div style={{ animation: mounted ? 'fadeIn 1.2s ease-out both' : 'none' }}>
                        <div className="trib-brand-avatar" style={{
                            position: 'relative', width: 110, height: 110, margin: '0 auto 24px',
                        }}>
                            <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', border: '1px solid rgba(197,160,89,0.2)', animation: 'ringExpand 4s ease-in-out infinite' }} />
                            <div style={{ position: 'absolute', inset: -16, borderRadius: '50%', border: '1px solid rgba(197,160,89,0.08)', animation: 'ringExpand 4s ease-in-out infinite 0.7s' }} />
                            <div style={{ position: 'absolute', inset: -24, borderRadius: '50%', border: '1px solid rgba(197,160,89,0.04)', animation: 'ringExpand 4s ease-in-out infinite 1.4s' }} />
                            <img
                                src="/queen-karin.png" alt="Queen Karin"
                                style={{
                                    width: 110, height: 110, borderRadius: '50%', objectFit: 'cover',
                                    border: '1.5px solid rgba(197,160,89,0.35)',
                                    boxShadow: '0 0 60px rgba(0,0,0,0.8), 0 0 30px rgba(197,160,89,0.08)',
                                }}
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                        </div>
                        <div style={{
                            fontFamily: 'Rajdhani, sans-serif', fontSize: '0.6rem', fontWeight: 500,
                            color: 'rgba(197,160,89,0.4)', letterSpacing: '8px', textTransform: 'uppercase',
                            marginBottom: 12,
                        }}>
                            PRESENTED BY
                        </div>
                        <h1 style={{
                            fontFamily: 'Cinzel, serif', fontSize: 'clamp(2rem, 7vw, 3rem)',
                            color: '#fff', letterSpacing: '4px', textTransform: 'uppercase',
                            margin: '0 0 4px', fontWeight: 600, lineHeight: 1.05, whiteSpace: 'nowrap',
                        }}>
                            QUEEN KARIN
                        </h1>
                        <div style={{
                            width: 50, height: '1.5px', margin: '16px auto 0',
                            background: 'linear-gradient(90deg, transparent, #c5a059, transparent)',
                        }} />
                    </div>
                </div>

                {/* ════════════════════════════════════════════
                    SECTION 1b: HERO — VIDEO + TEXT
                   ════════════════════════════════════════════ */}
                <div className="trib-hero" style={{ paddingTop: 40, textAlign: 'center' }}>

                    {/* ── TEXT (mobile: first, desktop: right side) ── */}
                    <div className="trib-hero-text" style={{ animation: mounted ? 'fadeUp 1s ease-out 0.5s both' : 'none' }}>
                        <p style={{
                            fontFamily: 'Cinzel, serif', fontSize: '0.95rem',
                            color: 'rgba(255,255,255,0.4)', lineHeight: 2.4,
                            maxWidth: 420, margin: '0 auto 12px', fontWeight: 400,
                            letterSpacing: '2px',
                        }}>
                            A dominatrix.<br />A builder.<br /><span style={{ fontFamily: "'Italianno', cursive", fontSize: '1.8rem', letterSpacing: '1px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.2, display: 'inline-block', marginTop: 6 }}>A woman who turned devotion<br />into an empire.</span>
                        </p>
                        <p style={{
                            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.85rem',
                            color: 'rgba(255,255,255,0.25)', lineHeight: 1.9,
                            maxWidth: 400, margin: '0 auto',
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

                    {/* ── VIDEO (mobile: after text, desktop: left via order:-1) ── */}
                    <div className="trib-hero-video" style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(197,160,89,0.1)', maxWidth: '75%', margin: '24px auto 0' }}>
                        <video
                            src="/tribute-intro.mov"
                            autoPlay muted loop playsInline
                            style={{ width: '100%', display: 'block', opacity: 0.6 }}
                        />
                    </div>
                </div>

                {/* ════════════════════════════════════════════
                    SECTION 2: WHAT'S IN THE APP
                   ════════════════════════════════════════════ */}
                <div
                    id="sec-features"
                    ref={setRef('sec-features')}
                    className={`trib-section ${isVisible('sec-features') ? 'visible' : ''}`}
                    style={{ marginTop: 80 }}
                >
                    {/* Section header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 36 }}>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(197,160,89,0.15))' }} />
                        <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.6rem', fontWeight: 500, color: 'rgba(197,160,89,0.35)', letterSpacing: '6px' }}>THE EXPERIENCE</span>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(197,160,89,0.15), transparent)' }} />
                    </div>

                    <div className="trib-two-col" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {[
                            { title: 'HIERARCHY SYSTEM', desc: 'Rise from Hall Boy to Champion through devotion, tasks, and merit earned over time', svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.8)" strokeWidth="1.5"><path d="M12 2L15 8.5L22 9.5L17 14.5L18 21.5L12 18.5L6 21.5L7 14.5L2 9.5L9 8.5L12 2Z"/></svg> },
                            { title: 'DAILY TASKS & ROUTINES', desc: 'Structured assignments from Queen Karin herself. Discipline that shapes your days', svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.8)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12L11 14L15 10"/></svg> },
                            { title: 'CHALLENGES', desc: 'Push your limits with weekly and monthly challenges. Prove yourself and climb the ranks', svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.8)" strokeWidth="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> },
                            { title: 'ROYAL SILVER ECONOMY', desc: 'Earn and spend coins through tributes, games of chance, and loyalty rewards', svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.8)" strokeWidth="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7V17M9 9.5C9 8.67 10.34 8 12 8S15 8.67 15 9.5 13.66 11 12 11 9 11.67 9 12.5 10.34 14 12 14S15 14.67 15 15.5"/></svg> },
                            { title: 'PRIVATE MESSAGES', desc: 'Direct communication with Queen Karin. Guidance, praise, and correction', svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.8)" strokeWidth="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> },
                            { title: 'COMPETITIONS & EVENTS', desc: 'Weekly challenges, leaderboard battles, and live events with real stakes', svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.8)" strokeWidth="1.5"><path d="M6 9H4a2 2 0 01-2-2V4h6M18 9h2a2 2 0 002-2V4h-6M12 15V9M8 21h8M12 21v-6"/><rect x="6" y="3" width="12" height="8" rx="1"/></svg> },
                        ].map((item, i) => (
                            <div key={i} className="feature-item" style={{
                                display: 'flex', alignItems: 'flex-start', gap: 16, padding: '16px 14px',
                                borderRadius: 8,
                                borderLeft: '1.5px solid rgba(197,160,89,0.2)',
                                background: 'rgba(197,160,89,0.03)',
                                transitionDelay: `${i * 0.07}s`,
                            }}>
                                <div style={{ width: 28, textAlign: 'center', flexShrink: 0, marginTop: 2, display: 'flex', justifyContent: 'center' }}>
                                    {item.svg}
                                </div>
                                <div>
                                    <div style={{
                                        fontFamily: 'Rajdhani, sans-serif', fontSize: '0.65rem', fontWeight: 600,
                                        color: 'rgba(197,160,89,0.8)', letterSpacing: '3px', marginBottom: 4,
                                    }}>
                                        {item.title}
                                    </div>
                                    <div style={{
                                        fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.82rem',
                                        color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, fontWeight: 300,
                                    }}>
                                        {item.desc}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>


                {/* ════════════════════════════════════════════
                    SECTION 3: JOIN CTA
                   ════════════════════════════════════════════ */}
                <div
                    id="sec-join"
                    ref={setRef('sec-join')}
                    className={`trib-section trib-join-section ${isVisible('sec-join') ? 'visible' : ''}`}
                    style={{ marginTop: 72, textAlign: 'center' }}
                >
                    {/* Decorative diamond */}
                    <div style={{
                        width: 8, height: 8, transform: 'rotate(45deg)',
                        background: 'rgba(197,160,89,0.25)', margin: '0 auto 28px',
                    }} />

                    <h2 style={{
                        fontFamily: 'Cinzel, serif', fontSize: 'clamp(1.3rem, 4.5vw, 1.8rem)',
                        color: '#fff', fontWeight: 600, letterSpacing: '3px',
                        margin: '0 0 10px', lineHeight: 1.2,
                    }}>
                        TAKE YOUR PLACE
                    </h2>
                    <p style={{
                        fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.85rem',
                        color: 'rgba(255,255,255,0.25)', lineHeight: 1.7, maxWidth: 360,
                        margin: '0 auto 32px', fontWeight: 300,
                    }}>
                        Your entrance tribute. The first act of devotion.
                        This is where your journey begins.
                    </p>

                    {/* Price */}
                    <div style={{ marginBottom: 28 }}>
                        <div style={{
                            fontFamily: 'Cinzel, serif', color: '#fff', fontWeight: 700, lineHeight: 1,
                            position: 'relative', display: 'inline-block',
                        }}>
                            <span style={{
                                position: 'absolute', right: '100%', bottom: '0.15em', marginRight: '10px',
                                fontSize: 'clamp(1.1rem, 3.5vw, 1.5rem)',
                                color: 'rgba(255,255,255,0.3)',
                                textDecoration: 'line-through',
                                textDecorationColor: 'rgba(197,160,89,0.5)',
                                fontWeight: 400, whiteSpace: 'nowrap',
                            }}>
                                <span style={{ fontSize: '0.7em' }}>&euro;</span>55
                            </span>
                            <span style={{
                                fontSize: 'clamp(2.8rem, 10vw, 4rem)',
                                textShadow: '0 4px 30px rgba(197,160,89,0.1)',
                            }}>
                                <span style={{ fontSize: '0.55em', fontWeight: 400 }}>&euro;</span>29
                            </span>
                        </div>
                        <div style={{
                            fontFamily: 'Rajdhani, sans-serif', fontSize: '0.55rem', fontWeight: 500,
                            color: 'rgba(197,160,89,0.35)', letterSpacing: '5px', marginTop: 6,
                        }}>
                            ENTRANCE TRIBUTE
                        </div>
                    </div>


                    {/* CTA Button — kneel style */}
                    <div style={{ maxWidth: 400, margin: '0 auto' }}>
                        <button className="trib-kneel-btn" onClick={handleTribute} disabled={loading}
                            style={{ opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
                            <span style={{
                                fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem',
                                color: 'white', textShadow: '0 1px 3px black',
                                letterSpacing: 3, textTransform: 'uppercase',
                            }}>
                                {loading ? 'PROCESSING...' : 'ENTER THE HOUSEHOLD'}
                            </span>
                        </button>
                    </div>

                    {status && (
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: '#c5a059', letterSpacing: '2px', textAlign: 'center', marginTop: 12 }}>{status}</div>
                    )}
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

                    {/* Review cards */}
                    {reviews.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '30px 0', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.12)' }}>
                            No reviews yet
                        </div>
                    )}
                    <div className="trib-reviews-grid" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {reviews.map((review, i) => {
                            const rev = review.reviewer || {};
                            const rName = rev.name || 'Loyal Subject';
                            const rAvatar = rev.avatar || null;
                            const rHierarchy = rev.hierarchy || 'Hall Boy';
                            const rMerit = rev.merit || 0;
                            const rTasks = rev.tasksCompleted || 0;
                            const rServing = rev.servingText || '';
                            return (
                            <div key={review.id} className="review-card" style={{
                                borderRadius: 14, overflow: 'hidden',
                                border: '1px solid rgba(197,160,89,0.08)',
                            }}>
                                {/* Header block */}
                                <div style={{
                                    padding: '16px 20px',
                                    background: 'linear-gradient(135deg, rgba(197,160,89,0.06), rgba(197,160,89,0.02))',
                                    borderBottom: '1px solid rgba(197,160,89,0.06)',
                                    display: 'flex', alignItems: 'center', gap: 14,
                                }}>
                                    {/* Avatar */}
                                    {rAvatar ? (
                                        <img src={rAvatar} style={{
                                            width: 44, height: 44, borderRadius: '50%', objectFit: 'cover',
                                            border: '1px solid rgba(197,160,89,0.25)', flexShrink: 0,
                                        }} />
                                    ) : (
                                        <div style={{
                                            width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                                            background: 'linear-gradient(135deg, rgba(197,160,89,0.15), rgba(197,160,89,0.05))',
                                            border: '1px solid rgba(197,160,89,0.2)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: 'rgba(197,160,89,0.6)', fontWeight: 600,
                                        }}>
                                            {rName.charAt(0)}
                                        </div>
                                    )}
                                    <div style={{ flex: 1, position: 'relative' }}>
                                        {/* Stars top right */}
                                        <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', gap: 2 }}>{stars(review.rating)}</div>
                                        {/* Line 1: Name */}
                                        <div style={{
                                            fontFamily: 'Cinzel, serif', fontSize: '0.82rem',
                                            color: 'rgba(255,255,255,0.65)', fontWeight: 600, marginBottom: 4,
                                        }}>
                                            {rName}
                                        </div>
                                        {/* Line 2: Merit + Tasks */}
                                        <div style={{
                                            fontFamily: 'Rajdhani, sans-serif', fontSize: '0.6rem', fontWeight: 600,
                                            color: 'rgba(197,160,89,0.5)', letterSpacing: '1.5px', marginBottom: 3,
                                        }}>
                                            {rMerit.toLocaleString()} MERIT &middot; {rTasks} TASKS
                                        </div>
                                        {/* Line 3: Hierarchy + serving */}
                                        <div style={{
                                            fontFamily: 'Rajdhani, sans-serif', fontSize: '0.52rem', fontWeight: 500,
                                            color: 'rgba(255,255,255,0.2)', letterSpacing: '1.5px',
                                        }}>
                                            {rHierarchy.toUpperCase()} {rServing ? <>&middot; SERVING {rServing.toUpperCase()}</> : ''}
                                        </div>
                                    </div>
                                </div>

                                {/* Review text */}
                                <div style={{ padding: '18px 20px 22px', background: 'linear-gradient(160deg, rgba(12,10,6,0.7), rgba(6,5,3,0.8))' }}>
                                    <p style={{
                                        fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.84rem',
                                        color: 'rgba(255,255,255,0.45)', lineHeight: 1.8, margin: 0,
                                        fontWeight: 300,
                                    }}>
                                        &ldquo;{review.text}&rdquo;
                                    </p>
                                </div>
                            </div>
                            );
                        })}
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
                <div style={{ textAlign: 'center', marginTop: 60, borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: 20 }}>
                    {userEmail && (
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.55rem', fontWeight: 500, color: 'rgba(255,255,255,0.08)', letterSpacing: '2px', marginBottom: 8 }}>{userEmail}</div>
                    )}
                    <button onClick={handleLogout}
                        style={{
                            background: 'none', border: '1px solid rgba(255,255,255,0.03)', borderRadius: 4,
                            fontFamily: 'Rajdhani, sans-serif', fontSize: '0.55rem', fontWeight: 500,
                            color: 'rgba(255,255,255,0.08)', letterSpacing: '3px', padding: '6px 16px', cursor: 'pointer',
                        }}>
                        LOGOUT
                    </button>
                </div>

            {/* extra padding so content doesn't hide behind bottom nav */}
                <div className="trib-bottom-pad" style={{ height: 'calc(100px + env(safe-area-inset-bottom))' }} />
            </div>

            {/* ─── FAKE BOTTOM NAV (same as /profile, mobile only) ─── */}
            <nav className="trib-fake-nav" style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999999,
                height: 'calc(60px + env(safe-area-inset-bottom))',
                paddingBottom: 'env(safe-area-inset-bottom)',
                background: 'rgba(4, 4, 12, 0.96)',
                backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                borderTop: '1px solid rgba(197, 160, 89, 0.18)',
                display: 'flex', alignItems: 'stretch', justifyContent: 'space-around',
            }}>
                {/* PROFILE */}
                <button onClick={() => showAccessDenied('your Profile')} style={fakeNavBtnStyle}>
                    <span style={fakeNavIconStyle}>{'\u25C6'}</span>
                    <span style={fakeNavLabelStyle}>PROFILE</span>
                </button>
                {/* RECORD */}
                <button onClick={() => showAccessDenied('your Record')} style={fakeNavBtnStyle}>
                    <span style={fakeNavIconStyle}>{'\u25A6'}</span>
                    <span style={fakeNavLabelStyle}>RECORD</span>
                </button>
                {/* QUEEN CIRCLE (center) */}
                <button onClick={() => showAccessDenied('Queen\'s Chat')} style={{
                    flex: 1, background: 'transparent', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', padding: 0, position: 'relative',
                    marginTop: -30, transform: 'translateY(14px)',
                }}>
                    <div style={{
                        width: 75, height: 75, borderRadius: '50%',
                        overflow: 'hidden', background: '#000', flexShrink: 0,
                    }}>
                        <img src="/queen-nav.png" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} alt="Queen" />
                    </div>
                </button>
                {/* QUEEN */}
                <button onClick={() => showAccessDenied('Queen\'s Wall')} style={fakeNavBtnStyle}>
                    <span style={fakeNavIconStyle}>{'\u265B'}</span>
                    <span style={fakeNavLabelStyle}>QUEEN</span>
                </button>
                {/* GLOBAL */}
                <button onClick={() => showAccessDenied('Global Chat')} style={fakeNavBtnStyle}>
                    <span style={fakeNavIconStyle}>{'\u25CE'}</span>
                    <span style={fakeNavLabelStyle}>GLOBAL</span>
                </button>
            </nav>
        </div>
    );
}
