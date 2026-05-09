"use client";

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';

/* ── time ago helper ── */
function timeAgo(dateStr: string) {
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

const TIERS = [
    { id: 'trial',   price: '29',  period: '3 DAYS',  label: 'TRIAL',   desc: 'Test your devotion. Three days under Her key.', badge: null },
    { id: 'weekly',  price: '55',  period: '7 DAYS',  label: 'WEEKLY',  desc: 'A full week locked. Prove you are worthy of Her attention.', badge: 'POPULAR' },
    { id: 'monthly', price: '150', period: '30 DAYS', label: 'MONTHLY', desc: 'Complete surrender. One month under absolute control.', badge: 'BEST VALUE' },
];

const QUIZ = [
    {
        q: 'Your experience with chastity?',
        opts: [
            { text: 'Never been locked', sub: 'Curious & ready to explore', value: 'beginner', icon: '?' },
            { text: 'Self-locked before', sub: 'Know the feeling, need real control', value: 'intermediate', icon: '\u26BF' },
            { text: 'Had a keyholder', sub: 'Ready for the real thing', value: 'advanced', icon: '\u2620' },
        ],
    },
    {
        q: 'What are you looking for?',
        opts: [
            { text: 'Explore & discover', sub: 'See if this is for me', value: 'curious', icon: '\u2736' },
            { text: 'Accountability', sub: 'I need someone to hold me to it', value: 'accountability', icon: '\u26D3' },
            { text: 'Total power exchange', sub: 'Complete control, no questions', value: 'tpe', icon: '\u2694' },
        ],
    },
    {
        q: 'How long can you handle?',
        opts: [
            { text: 'A few days', sub: 'Dip my toes in', value: 'short', icon: '3' },
            { text: 'One full week', sub: 'I\'m serious about this', value: 'medium', icon: '7' },
            { text: 'A month or more', sub: 'No limits. Lock me down.', value: 'long', icon: '30' },
        ],
    },
];

function getRecommendation(answers: string[]): { tier: string; title: string; text: string } {
    const [exp, motive, duration] = answers;
    if (duration === 'long' || motive === 'tpe' || exp === 'advanced') {
        return { tier: 'monthly', title: 'FULL SURRENDER', text: 'You are ready for complete control. One month under Her lock — no excuses, no escape.' };
    }
    if (duration === 'medium' || motive === 'accountability' || exp === 'intermediate') {
        return { tier: 'weekly', title: 'WEEKLY LOCKDOWN', text: 'A full week under Her key. Daily check-ins, strict accountability, real consequences.' };
    }
    return { tier: 'trial', title: 'FIRST LOCK', text: 'Three days to discover what real control feels like. Check-ins, kneeling hours, total obedience.' };
}

export default function KeyholderPage() {
    const [loading, setLoading] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [step, setStep] = useState(0);
    const [answers, setAnswers] = useState<string[]>([]);
    const [toasts, setToasts] = useState<any[]>([]);
    const [reviews, setReviews] = useState<any[]>([]);
    const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());
    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const [countdown, setCountdown] = useState({ d: 0, h: 0, m: 0, s: 0 });

    /* countdown to next Sunday midnight */
    useEffect(() => {
        const getNext = () => {
            const now = new Date();
            const day = now.getDay();
            const daysUntilSun = day === 0 ? 0 : 7 - day;
            const target = new Date(now);
            target.setDate(now.getDate() + daysUntilSun);
            target.setHours(23, 59, 59, 999);
            if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 7);
            return target.getTime();
        };
        const tick = () => {
            const diff = Math.max(0, getNext() - Date.now());
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

    useEffect(() => {
        setMounted(true);
        const params = new URLSearchParams(window.location.search);
        if (params.get('status') === 'success') setStatus('success');
        if (params.get('status') === 'cancelled') setStatus('cancelled');
        const init = async () => {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    setUserEmail(user.email || null);
                    // Auto-checkout if redirected back with a tier
                    const autoTier = params.get('tier');
                    if (autoTier && ['trial', 'weekly', 'monthly'].includes(autoTier)) {
                        // Clean the URL
                        window.history.replaceState({}, '', '/keyholder');
                        handleCheckout(autoTier);
                    }
                }
            } catch {}
        };
        init();
    }, []);

    /* fetch reviews */
    useEffect(() => {
        fetch('/api/reviews/public')
            .then(r => r.json())
            .then(d => { if (d.reviews) setReviews(d.reviews); })
            .catch(() => {});
    }, []);

    /* show a toast for 8s then remove it */
    const showToast = (item: any) => {
        const id = Date.now() + Math.random();
        setToasts([{ ...item, _id: id }]);
        setTimeout(() => setToasts(prev => prev.map(t => t._id === id ? { ...t, _leaving: true } : t)), 8000);
        setTimeout(() => setToasts(prev => prev.filter(t => t._id !== id)), 8500);
    };

    /* parse global_messages card content into toast data */
    const parseGlobalCard = (msg: any) => {
        const content = msg.message || msg.content || '';
        const created = msg.created_at;
        const avatar = msg.sender_avatar || null;
        const msgHierarchy = msg.hierarchy || null;
        try {
            if (content.startsWith('RISKY_TRIBUTE_CARD::')) {
                const d = JSON.parse(content.replace('RISKY_TRIBUTE_CARD::', ''));
                return { sender_name: d.senderName || 'SUBJECT', sender_avatar: d.senderAvatar || avatar, hierarchy: msgHierarchy, text: `just gambled ${(d.stakeAmount||0).toLocaleString()} coins`, kind: 'risky', cardIcon: d.icon || null, cardName: d.cardName || null, isWin: d.isWin, stakeAmount: d.stakeAmount || 0, wonAmount: d.wonAmount || 0, lostAmount: d.lostAmount || 0, created_at: created };
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
        } catch {}
        return null;
    };

    /* fetch last activity + realtime */
    useEffect(() => {
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
                            if (msg.sender_email && msg.sender_email !== 'system') {
                                try {
                                    const { data: p } = await supabase.from('profiles').select('avatar_url, hierarchy').ilike('member_id', msg.sender_email).limit(1);
                                    if (p && p[0]) {
                                        if (!parsed.sender_avatar && p[0].avatar_url) parsed.sender_avatar = p[0].avatar_url;
                                        if (p[0].hierarchy) parsed.hierarchy = p[0].hierarchy;
                                    }
                                } catch {}
                            }
                            showToast(parsed); break;
                        }
                    }
                }
            } catch {}
        }, 7000);

        const supabase = createClient();
        const channel = supabase.channel('keyholder-activity')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'global_messages' }, async (payload: any) => {
                const row = payload.new;
                if (!row) return;
                const parsed = parseGlobalCard(row);
                if (parsed) {
                    if (row.sender_email && row.sender_email !== 'system') {
                        try {
                            const { data: p } = await supabase.from('profiles').select('avatar_url, hierarchy').ilike('member_id', row.sender_email).limit(1);
                            if (p && p[0]) {
                                if (!parsed.sender_avatar && p[0].avatar_url) parsed.sender_avatar = p[0].avatar_url;
                                if (p[0].hierarchy) parsed.hierarchy = p[0].hierarchy;
                            }
                        } catch {}
                    }
                    showToast(parsed);
                }
            })
            .subscribe();

        return () => { clearTimeout(timer); supabase.removeChannel(channel); };
    }, []);

    /* intersection observer for scroll animations */
    useEffect(() => {
        if (typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver(
            (entries) => { entries.forEach(e => { if (e.isIntersecting) setVisibleSections(prev => new Set([...prev, e.target.id])); }); },
            { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
        );
        Object.values(sectionRefs.current).forEach(el => { if (el) observer.observe(el); });
        return () => observer.disconnect();
    }, [mounted]);

    const pick = (v: string) => { setAnswers([...answers, v]); setStep(step + 1); };

    const handleCheckout = async (tierId: string) => {
        // If not logged in, send to login with tier saved in URL
        if (!userEmail) {
            const url = `/login?redirect=/keyholder?tier=${tierId}`;
            try { window.top!.location.href = url; } catch { window.location.href = url; }
            return;
        }
        setLoading(tierId);
        try {
            const res = await fetch('/api/stripe/keyholder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tierId }) });
            const data = await res.json();
            if (data.url) { try { window.top!.location.href = data.url; } catch { window.location.href = data.url; } }
            else { setStatus('error'); setLoading(null); }
        } catch { setStatus('error'); setLoading(null); }
    };

    const rec = step >= 3 ? getRecommendation(answers) : null;

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
                    <button id="adUnlock" style="flex:2;background:linear-gradient(135deg,#8b0000 0%,#5a0000 100%);color:#fff;border:none;padding:10px 0;border-radius:8px;font-family:Orbitron,sans-serif;font-size:0.5rem;font-weight:700;letter-spacing:2px;cursor:pointer;">SURRENDER KEY</button>
                </div>
            </div>
        `;
        overlay.querySelector('#adClose')?.addEventListener('click', (e) => { e.stopPropagation(); overlay.remove(); });
        overlay.querySelector('#adUnlock')?.addEventListener('click', (e) => { e.stopPropagation(); overlay.remove(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
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

    const isVisible = (id: string) => visibleSections.has(id);
    const setRef = (id: string) => (el: HTMLDivElement | null) => { sectionRefs.current[id] = el; };

    const stars = (n: number) => Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < n ? '#c5a059' : 'rgba(255,255,255,0.08)', fontSize: '0.75rem' }}>&#9733;</span>
    ));

    /* ── SUCCESS STATE ── */
    if (status === 'success') {
        return (
            <div style={{ background: '#020202', color: '#fff', minHeight: '100dvh', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'fixed', inset: 0, backgroundImage: "url('/queen-bg-mobile.jpg')", backgroundSize: 'cover', backgroundPosition: 'center 20%', zIndex: 0, opacity: 0.5, filter: 'saturate(0.3)' }} />
                <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(2,2,2,0.75) 35%, rgba(2,2,2,0.95) 65%, #020202 100%)', zIndex: 0 }} />
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
                    <div style={{ textAlign: 'center', padding: 40 }}>
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#c5a059" strokeWidth="1.2" style={{ marginBottom: 20, filter: 'drop-shadow(0 0 20px rgba(197,160,89,0.4))' }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1" fill="#c5a059"/></svg>
                        <h1 style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(1.6rem,5vw,2.4rem)', color: '#c5a059', letterSpacing: 4, marginBottom: 14 }}>KEY ACCEPTED</h1>
                        <p style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '1rem', color: 'rgba(255,255,255,0.45)', maxWidth: 360, margin: '0 auto 36px', lineHeight: 1.6 }}>
                            Your key has been surrendered. Queen Karin now holds your lock. Await further instructions.
                        </p>
                        <a href="/profile" style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.65rem', color: '#c5a059', letterSpacing: 4, textDecoration: 'none', border: '1px solid rgba(197,160,89,0.3)', padding: '14px 40px', borderRadius: 2 }}>ENTER THE HOUSE</a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ background: '#020202', color: '#fff', minHeight: '100dvh', overflowX: 'hidden', position: 'relative' }}>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Italianno&family=Rajdhani:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@300;400;500&display=swap');
                @font-face {
                    font-family: 'Rosella Solid';
                    src: url('/fonts/rosella-solid.woff2') format('woff2'), url('/fonts/rosella-solid.woff') format('woff');
                    font-weight: normal; font-style: normal; font-display: swap;
                }
                @keyframes bannerFlow { 0% { background-position: 0% 0%; } 100% { background-position: 100% 100%; } }
                @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
                @keyframes fadeUp { from { opacity:0; transform:translateY(50px); } to { opacity:1; transform:translateY(0); } }
                @keyframes fadeUpSlow { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }
                @keyframes slideDown { from { opacity:0; transform:translateY(-20px); } to { opacity:1; transform:translateY(0); } }
                @keyframes float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-6px); } }
                @keyframes breathe { 0%,100% { opacity:0.3; } 50% { opacity:0.7; } }
                @keyframes ringExpand { 0% { transform: scale(0.95); opacity: 0.4; } 50% { transform: scale(1.05); opacity: 0.8; } 100% { transform: scale(0.95); opacity: 0.4; } }
                @keyframes ctaShine { 0% { left: -100%; } 50%,100% { left: 100%; } }
                @keyframes fadeSlide { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
                @keyframes borderGlow {
                    0%,100% { border-color:rgba(139,0,0,0.15); box-shadow:0 0 30px rgba(139,0,0,0.06); }
                    50% { border-color:rgba(139,0,0,0.4); box-shadow:0 0 50px rgba(139,0,0,0.12); }
                }
                @keyframes glowPulse { 0%,100%{box-shadow:0 0 20px rgba(139,0,0,0.1)} 50%{box-shadow:0 0 40px rgba(139,0,0,0.25)} }
                @keyframes pulse2 { 0%,100%{opacity:1} 50%{opacity:0.4} }
                @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
                @keyframes toastIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes toastOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(20px); } }

                .kh-section { opacity: 0; transform: translateY(40px); transition: opacity 0.8s cubic-bezier(0.16,1,0.3,1), transform 0.8s cubic-bezier(0.16,1,0.3,1); }
                .kh-section.visible { opacity: 1; transform: translateY(0); }

                .qz-card { transition: all 0.25s cubic-bezier(0.4,0,0.2,1); cursor:pointer; position:relative; overflow:hidden; }
                .qz-card::before { content:''; position:absolute; inset:0; opacity:0; transition:opacity 0.25s; background:linear-gradient(135deg, rgba(139,0,0,0.1), transparent 60%); }
                .qz-card:hover { border-color:rgba(139,0,0,0.5) !important; transform:translateY(-3px) scale(1.01); }
                .qz-card:hover::before { opacity:1; }
                .qz-card:active { transform:scale(0.98); }
                .tier-card { transition:all 0.25s; cursor:pointer; }
                .tier-card:hover { transform:translateY(-6px); box-shadow:0 16px 50px rgba(139,0,0,0.2) !important; border-color:rgba(139,0,0,0.4) !important; }
                .tier-btn { transition:all 0.2s; }
                .tier-btn:hover { background:linear-gradient(135deg,#8b0000,#5a0000) !important; color:#fff !important; border-color:#8b0000 !important; }
                .tier-btn:disabled { opacity:0.5; cursor:wait; }
                .cta-main { transition:transform 0.25s, box-shadow 0.25s; }
                .cta-main:hover { transform:scale(1.02) !important; box-shadow:0 8px 60px rgba(139,0,0,0.5) !important; }
                .cta-main:active { transform:scale(0.98) !important; }
                .review-card { transition: transform 0.4s ease, box-shadow 0.4s ease; }
                .review-card:hover { transform: translateY(-3px); box-shadow: 0 12px 40px rgba(0,0,0,0.5), 0 0 1px rgba(197,160,89,0.2); }
                .feature-item { transition: transform 0.3s ease; }
                .feature-item:hover { transform: translateX(4px); }

                * { scrollbar-width: none; }
                *::-webkit-scrollbar { display: none; }

                @media (min-width: 769px) {
                    .kh-container { max-width: 1100px !important; padding: 0 60px 80px !important; }
                    .kh-fake-nav { display: none !important; }
                    .kh-bottom-pad { height: 0 !important; }
                    .kh-toast { left: auto !important; right: 32px !important; max-width: 420px !important; bottom: 32px !important; }
                    .kh-reviews-grid { display: grid !important; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)) !important; gap: 20px !important; max-width: 800px !important; margin-left: auto !important; margin-right: auto !important; }
                    .kh-quiz-grid { grid-template-columns: repeat(3, 1fr) !important; }
                    .kh-tiers-grid { grid-template-columns: repeat(3, 1fr) !important; }
                    .kh-features-grid { grid-template-columns: repeat(3, 1fr) !important; }
                }
            `}</style>

            {/* ─── LAYERED BACKGROUNDS ─── */}
            <div style={{ position: 'fixed', inset: 0, backgroundImage: "url('/queen-bg-mobile.jpg')", backgroundSize: 'cover', backgroundPosition: 'center 20%', zIndex: 0, opacity: 0.35, filter: 'saturate(0.2) brightness(0.7)' }} />
            <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(180deg, rgba(2,2,2,0.3) 0%, rgba(2,2,2,0.7) 30%, rgba(2,2,2,0.92) 55%, #020202 75%)', zIndex: 0 }} />
            <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '120vw', height: '50vh', background: 'radial-gradient(ellipse at center top, rgba(139,0,0,0.06) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.02, backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")', backgroundSize: '128px 128px' }} />
            <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', zIndex: 0, pointerEvents: 'none', opacity: 0.03 }}>
                <div style={{ position: 'absolute', width: '100%', height: '2px', background: 'linear-gradient(90deg, transparent, rgba(139,0,0,0.8), transparent)', animation: 'scanline 8s linear infinite' }} />
            </div>

            {/* ─── TOAST NOTIFICATIONS ─── */}
            {toasts.map((t: any) => {
                const displayText = t.text || '';
                const avatar = t.sender_avatar || null;
                const initial = (t.sender_name || 'S').charAt(0).toUpperCase();
                const when = t.created_at ? timeAgo(t.created_at) : '';
                const isRisky = t.kind === 'risky' && t.cardIcon;

                return (
                <div key={t._id} className="kh-toast" style={{
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
                        <div style={{ display: 'flex', minHeight: 130 }}>
                            <div style={{ flex: '0 0 28%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(197,160,89,0.04)', borderRight: '1px solid rgba(197,160,89,0.12)', padding: '16px 12px', gap: 8 }}>
                                <img src={t.cardIcon} style={{ width: '65%', maxWidth: 65, height: 'auto', opacity: 0.9 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                {t.cardName && <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.4rem', color: 'rgba(197,160,89,0.45)', letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.3 }}>{t.cardName}</div>}
                            </div>
                            <div style={{ flex: 1, padding: '16px 18px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.45rem', color: 'rgba(197,160,89,0.5)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span>Recent Activity</span>
                                    {when && <span style={{ color: 'rgba(197,160,89,0.3)', letterSpacing: 1, fontSize: '0.4rem' }}>{when}</span>}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    {avatar ? (
                                        <img src={avatar} style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(197,160,89,0.5)', flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                    ) : (
                                        <div style={{ width: 38, height: 38, borderRadius: '50%', border: '1.5px solid rgba(197,160,89,0.35)', background: 'linear-gradient(135deg, rgba(197,160,89,0.15), rgba(197,160,89,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: 'rgba(197,160,89,0.6)', fontWeight: 600, flexShrink: 0 }}>{initial}</div>
                                    )}
                                    <div>
                                        <div style={{ fontFamily: "'Rosella Solid', serif", fontSize: '1.05rem', color: '#c5a059', letterSpacing: 1 }}>{t.sender_name}</div>
                                        {t.hierarchy && <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.35rem', color: 'rgba(197,160,89,0.4)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 1 }}>{t.hierarchy}</div>}
                                    </div>
                                </div>
                                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)', fontWeight: 400, marginTop: 6, letterSpacing: 0.5 }}>
                                    just gambled {(t.stakeAmount||0).toLocaleString()} coins
                                </div>
                                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', fontWeight: 600, marginTop: 2, letterSpacing: 0.5 }}>
                                    {t.isWin
                                        ? <span style={{ color: '#4ade80' }}>total won: {(t.wonAmount||0).toLocaleString()}</span>
                                        : t.lostAmount === 0
                                            ? <span style={{ color: '#c5a059' }}>lost nothing</span>
                                            : <span style={{ color: '#ff0000' }}>total lost: {(t.lostAmount||0).toLocaleString()}</span>
                                    }
                                </div>
                                <button onClick={() => setToasts(prev => prev.filter(x => x._id !== t._id))}
                                    style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)', padding: '5px 16px', borderRadius: 6, fontFamily: 'Orbitron, sans-serif', fontSize: '0.4rem', letterSpacing: 1, cursor: 'pointer', marginTop: 6 }}
                                >DISMISS</button>
                            </div>
                        </div>
                    ) : (
                        <>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.5rem', color: '#c5a059', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>Recent Activity</span>
                            {when && <span style={{ color: 'rgba(197,160,89,0.4)', letterSpacing: 1, fontSize: '0.45rem' }}>{when}</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            {avatar ? (
                                <img src={avatar} style={{ flexShrink: 0, width: 62, height: 62, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(197,160,89,0.6)' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            ) : (
                                <div style={{ flexShrink: 0, width: 62, height: 62, borderRadius: '50%', border: '1.5px solid rgba(197,160,89,0.4)', background: 'linear-gradient(135deg, rgba(197,160,89,0.15), rgba(197,160,89,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cinzel, serif', fontSize: '1.2rem', color: 'rgba(197,160,89,0.6)', fontWeight: 600 }}>{initial}</div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontFamily: "'Rosella Solid', serif", fontSize: '1.15rem', color: '#c5a059', letterSpacing: 1, lineHeight: 1.2 }}>{t.sender_name}</div>
                                {t.hierarchy && <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.4rem', color: 'rgba(197,160,89,0.4)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 2 }}>{t.hierarchy}</div>}
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.95rem', color: 'rgba(255,255,255,0.65)', fontWeight: 500, lineHeight: 1.4, marginTop: 4 }}>{displayText}</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                            <button onClick={() => setToasts(prev => prev.filter(x => x._id !== t._id))}
                                style={{ flex: 1, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)', padding: '9px 0', borderRadius: 8, fontFamily: 'Orbitron, sans-serif', fontSize: '0.5rem', letterSpacing: 1, cursor: 'pointer' }}
                            >DISMISS</button>
                        </div>
                        </>
                    )}
                </div>
                );
            })}

            {/* ─── CONTENT ─── */}
            <div className="kh-container" style={{ position: 'relative', zIndex: 1, maxWidth: 560, margin: '0 auto', padding: '0 clamp(20px,5vw,32px) 80px' }}>

                {/* ════════ BRAND HEADER ════════ */}
                <div style={{ paddingTop: 'clamp(80px, 14vw, 120px)', textAlign: 'center' }}>
                    <div style={{ animation: mounted ? 'fadeIn 1.2s ease-out both' : 'none' }}>
                        <div style={{ position: 'relative', width: 110, height: 110, margin: '0 auto 24px' }}>
                            <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', border: '1px solid rgba(197,160,89,0.2)', animation: 'ringExpand 4s ease-in-out infinite' }} />
                            <div style={{ position: 'absolute', inset: -16, borderRadius: '50%', border: '1px solid rgba(197,160,89,0.08)', animation: 'ringExpand 4s ease-in-out infinite 0.7s' }} />
                            <div style={{ position: 'absolute', inset: -24, borderRadius: '50%', border: '1px solid rgba(197,160,89,0.04)', animation: 'ringExpand 4s ease-in-out infinite 1.4s' }} />
                            <img src="/queen-karin.png" alt="Queen Karin" style={{ width: 110, height: 110, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(197,160,89,0.35)', boxShadow: '0 0 60px rgba(0,0,0,0.8), 0 0 30px rgba(197,160,89,0.08)' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        </div>
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.6rem', fontWeight: 500, color: 'rgba(197,160,89,0.4)', letterSpacing: '8px', textTransform: 'uppercase', marginBottom: 12 }}>
                            PRESENTED BY
                        </div>
                        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(2rem, 7vw, 3rem)', color: '#fff', letterSpacing: '4px', textTransform: 'uppercase', margin: '0 0 4px', fontWeight: 600, lineHeight: 1.05, whiteSpace: 'nowrap' }}>
                            QUEEN KARIN
                        </h1>
                        <div style={{ width: 50, height: '1.5px', margin: '16px auto 0', background: 'linear-gradient(90deg, transparent, #c5a059, transparent)' }} />
                    </div>
                </div>

                {/* ════════ HERO TEXT ════════ */}
                <div style={{ paddingTop: 40, textAlign: 'center', animation: mounted ? 'fadeUp 1s ease-out 0.5s both' : 'none' }}>
                    {/* Keyholder badge */}
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 28, background: 'rgba(139,0,0,0.06)', border: '1px solid rgba(139,0,0,0.2)', borderRadius: 2, padding: '6px 24px' }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#8b0000', animation: 'pulse2 1.5s infinite', boxShadow: '0 0 8px rgba(139,0,0,0.6)' }} />
                        <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.38rem', color: '#8b0000', letterSpacing: 5 }}>KEYHOLDER SERVICE</span>
                    </div>

                    <h2 style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(1.8rem,5.5vw,3rem)', color: '#fff', letterSpacing: 6, textTransform: 'uppercase', margin: '0 0 8px', fontWeight: 700, lineHeight: 1.05 }}>
                        SURRENDER<br/>YOUR KEY
                    </h2>
                    <div style={{ width: 80, height: 2, background: 'linear-gradient(90deg, transparent, #8b0000, transparent)', margin: '16px auto' }} />
                    <p style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '1.1rem', color: 'rgba(255,255,255,0.35)', maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
                        Professional chastity keyholding by Queen Karin. Real-time control, daily check-ins, strict accountability. Your lock, Her rules.
                    </p>
                </div>

                {/* ════════ QUIZ ════════ */}
                <div id="sec-quiz" ref={setRef('sec-quiz')} className={`kh-section ${isVisible('sec-quiz') ? 'visible' : ''}`} style={{ marginTop: 56 }}>
                {step < 3 ? (
                    <div key={step} style={{ animation: 'fadeSlide 0.45s ease-out both' }}>
                        <div style={{ maxWidth: 400, margin: '0 auto 32px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.3rem', color: 'rgba(139,0,0,0.5)', letterSpacing: 3 }}>STEP {step + 1} / 3</span>
                                <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.3rem', color: 'rgba(255,255,255,0.12)', letterSpacing: 2 }}>{Math.round(((step + 1) / 3) * 100)}%</span>
                            </div>
                            <div style={{ height: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 1 }}>
                                <div style={{ height: '100%', width: `${((step + 1) / 3) * 100}%`, background: 'linear-gradient(90deg, #8b0000, #c41020)', borderRadius: 1, transition: 'width 0.4s ease' }} />
                            </div>
                        </div>

                        <h2 style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(1.2rem,3.5vw,1.8rem)', color: 'rgba(255,255,255,0.85)', fontWeight: 400, textAlign: 'center', marginBottom: 32, letterSpacing: 2 }}>
                            {QUIZ[step].q}
                        </h2>

                        <div className="kh-quiz-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
                            {QUIZ[step].opts.map((o, i) => (
                                <div key={i} className="qz-card" onClick={() => pick(o.value)} style={{
                                    background: 'linear-gradient(170deg, rgba(15,8,12,0.9), rgba(5,2,5,0.95))',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    borderRadius: 4, padding: 'clamp(20px,3vw,28px) clamp(16px,2vw,24px)', textAlign: 'center',
                                }}>
                                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: 'clamp(1.2rem,3vw,1.6rem)', color: 'rgba(139,0,0,0.4)', marginBottom: 10, lineHeight: 1 }}>{o.icon}</div>
                                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(0.8rem,1.8vw,1rem)', color: '#fff', letterSpacing: 1, marginBottom: 6, fontWeight: 700 }}>{o.text}</div>
                                    <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 'clamp(0.72rem,1.5vw,0.85rem)', color: 'rgba(255,255,255,0.3)', lineHeight: 1.4 }}>{o.sub}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : rec && (
                    <div style={{ animation: 'fadeSlide 0.5s ease-out both' }}>
                        {/* Recommendation */}
                        <div style={{
                            position: 'relative', borderRadius: 4, overflow: 'hidden', marginBottom: 40,
                            background: 'linear-gradient(160deg, rgba(20,8,14,0.95), rgba(5,2,5,0.98))',
                            border: '1px solid rgba(139,0,0,0.2)', animation: 'borderGlow 4s ease-in-out infinite',
                        }}>
                            <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, #8b0000, transparent)' }} />
                            <div style={{ padding: 'clamp(28px,5vw,48px) clamp(20px,4vw,40px)' }}>
                                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.32rem', color: 'rgba(139,0,0,0.5)', letterSpacing: 5, marginBottom: 10 }}>YOUR SENTENCE</div>
                                <h2 style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(1.4rem,4vw,2.2rem)', color: '#fff', letterSpacing: 4, marginBottom: 12, fontWeight: 700, lineHeight: 1.1 }}>
                                    {rec.title}
                                </h2>
                                <p style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '1rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, maxWidth: 420, marginBottom: 20 }}>
                                    {rec.text}
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                                    <button className="cta-main" onClick={() => handleCheckout(rec.tier)} disabled={!!loading}
                                        style={{
                                            position: 'relative', overflow: 'hidden', padding: '16px 40px',
                                            background: 'linear-gradient(135deg, #8b0000 0%, #5a0000 50%, #8b0000 100%)', backgroundSize: '200% auto',
                                            color: '#fff', border: 'none', borderRadius: 2, cursor: loading ? 'wait' : 'pointer',
                                            fontFamily: 'Orbitron,sans-serif', fontSize: '0.5rem', letterSpacing: 5, textTransform: 'uppercase',
                                            boxShadow: '0 4px 30px rgba(139,0,0,0.3)', opacity: loading === rec.tier ? 0.6 : 1,
                                        }}>
                                        <div style={{ position: 'absolute', top: 0, left: '-100%', width: '60%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)', animation: 'ctaShine 3s ease-in-out infinite', pointerEvents: 'none' }} />
                                        {loading === rec.tier ? 'PROCESSING...' : 'SURRENDER KEY'}
                                    </button>
                                    <div style={{ textAlign: 'center' }}>
                                        {(() => { const t = TIERS.find(x => x.id === rec.tier)!; return (
                                            <>
                                                <div style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(2rem,6vw,3rem)', color: '#fff', fontWeight: 700, lineHeight: 1 }}>&euro;{t.price}</div>
                                                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.35rem', color: 'rgba(139,0,0,0.45)', letterSpacing: 4, marginTop: 2 }}>{t.period}</div>
                                            </>
                                        ); })()}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* All tiers */}
                        <div style={{ marginBottom: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                                <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06))' }} />
                                <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.3rem', color: 'rgba(255,255,255,0.12)', letterSpacing: 5 }}>ALL OPTIONS</span>
                                <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(255,255,255,0.06), transparent)' }} />
                            </div>

                            <div className="kh-tiers-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
                                {TIERS.map(t => {
                                    const isRec = t.id === rec.tier;
                                    return (
                                    <div key={t.id} className="tier-card" onClick={() => !loading && handleCheckout(t.id)} style={{
                                        position: 'relative',
                                        background: isRec ? 'linear-gradient(170deg, rgba(20,8,14,0.95), rgba(8,2,6,0.98))' : 'linear-gradient(170deg, rgba(12,10,12,0.9), rgba(5,3,5,0.95))',
                                        border: isRec ? '1px solid rgba(139,0,0,0.3)' : '1px solid rgba(255,255,255,0.05)',
                                        borderRadius: 4, padding: 'clamp(24px,3vw,32px) clamp(16px,2vw,24px)', textAlign: 'center',
                                        animation: isRec ? 'glowPulse 4s ease-in-out infinite' : 'none',
                                    }}>
                                        {(t.badge || isRec) && (
                                            <div style={{
                                                position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%,-50%)',
                                                background: isRec ? '#8b0000' : 'rgba(139,0,0,0.12)',
                                                color: isRec ? '#fff' : 'rgba(139,0,0,0.6)',
                                                fontFamily: 'Orbitron,sans-serif', fontSize: '0.26rem', letterSpacing: 3,
                                                padding: '3px 14px', borderRadius: 2, whiteSpace: 'nowrap', fontWeight: 700,
                                            }}>
                                                {isRec ? 'RECOMMENDED' : t.badge}
                                            </div>
                                        )}
                                        {isRec && <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(139,0,0,0.4), transparent)' }} />}
                                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.32rem', color: isRec ? 'rgba(139,0,0,0.5)' : 'rgba(197,160,89,0.3)', letterSpacing: 4, marginBottom: 12 }}>{t.label}</div>
                                        <div style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(1.8rem,5vw,2.6rem)', color: '#fff', fontWeight: 700, lineHeight: 1, marginBottom: 4 }}>&euro;{t.price}</div>
                                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.3rem', color: 'rgba(255,255,255,0.2)', letterSpacing: 4, marginBottom: 16 }}>{t.period}</div>
                                        <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.82rem', color: 'rgba(255,255,255,0.28)', lineHeight: 1.5, marginBottom: 20, minHeight: 44 }}>{t.desc}</div>
                                        <button className="tier-btn" disabled={!!loading} style={{
                                            width: '100%', padding: '12px 0',
                                            background: isRec ? 'rgba(139,0,0,0.12)' : 'rgba(255,255,255,0.03)',
                                            color: isRec ? '#fff' : 'rgba(255,255,255,0.35)',
                                            border: isRec ? '1px solid rgba(139,0,0,0.3)' : '1px solid rgba(255,255,255,0.06)',
                                            borderRadius: 2, fontFamily: 'Orbitron,sans-serif', fontSize: '0.38rem', letterSpacing: 4,
                                            cursor: loading ? 'wait' : 'pointer',
                                        }}>
                                            {loading === t.id ? 'PROCESSING...' : 'SELECT'}
                                        </button>
                                    </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div style={{ textAlign: 'center', marginTop: 12 }}>
                            <button onClick={() => { setStep(0); setAnswers([]); }} style={{
                                background: 'none', border: 'none', fontFamily: 'Orbitron,sans-serif', fontSize: '0.3rem',
                                color: 'rgba(255,255,255,0.12)', letterSpacing: 4, cursor: 'pointer', padding: '8px 16px',
                            }}>RETAKE QUIZ</button>
                        </div>
                    </div>
                )}
                </div>

                {/* ════════ WHAT YOU GET ════════ */}
                <div id="sec-features" ref={setRef('sec-features')} className={`kh-section ${isVisible('sec-features') ? 'visible' : ''}`} style={{ marginTop: 64 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 32 }}>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(197,160,89,0.15))' }} />
                        <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.6rem', fontWeight: 500, color: 'rgba(197,160,89,0.35)', letterSpacing: '6px' }}>WHAT YOU GET</span>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(197,160,89,0.15), transparent)' }} />
                    </div>
                    <div className="kh-features-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                        {[
                            { title: 'REAL KEYHOLDER', text: 'Your lock code held by Queen Karin. No self-unlocking. Real power exchange.' },
                            { title: 'DAILY CHECK-INS', text: 'Morning and evening reports. Missed check-in = consequences.' },
                            { title: 'TASK CONTROL', text: 'Assignments, kneeling hours, routines — all on Her schedule.' },
                            { title: 'LIVE MONITORING', text: 'She decides when and if you unlock. Real-time control.' },
                            { title: 'PRIVATE ACCESS', text: 'Direct messages with Queen Karin. Personal attention and guidance.' },
                            { title: 'STRICT RULES', text: 'Break a rule, extend your lock. No mercy, no exceptions.' },
                        ].map((item, i) => (
                            <div key={i} className="feature-item" style={{
                                padding: '14px 16px',
                                background: 'rgba(197,160,89,0.02)', borderLeft: '2px solid rgba(197,160,89,0.15)',
                                borderRadius: 4,
                            }}>
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.65rem', fontWeight: 600, color: 'rgba(197,160,89,0.7)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>{item.title}</div>
                                <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>{item.text}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ════════ REVIEWS ════════ */}
                <div id="sec-reviews" ref={setRef('sec-reviews')} className={`kh-section ${isVisible('sec-reviews') ? 'visible' : ''}`} style={{ marginTop: 80 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 32 }}>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(197,160,89,0.15))' }} />
                        <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.6rem', fontWeight: 500, color: 'rgba(197,160,89,0.35)', letterSpacing: '6px' }}>TESTIMONIALS</span>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(197,160,89,0.15), transparent)' }} />
                    </div>

                    {reviews.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '30px 0', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.12)' }}>
                            No reviews yet
                        </div>
                    )}
                    <div className="kh-reviews-grid" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {reviews.map((review: any) => {
                            const rev = review.reviewer || {};
                            const rName = rev.name || 'Loyal Subject';
                            const rAvatar = rev.avatar || null;
                            const rHierarchy = rev.hierarchy || 'Hall Boy';
                            const rMerit = rev.merit || 0;
                            const rServing = rev.servingText || '';
                            return (
                            <div key={review.id} className="review-card" style={{
                                borderRadius: 14, overflow: 'hidden',
                                border: '1px solid rgba(197,160,89,0.08)',
                            }}>
                                <div style={{
                                    padding: '16px 20px',
                                    background: 'linear-gradient(135deg, rgba(197,160,89,0.06), rgba(197,160,89,0.02))',
                                    borderBottom: '1px solid rgba(197,160,89,0.06)',
                                    display: 'flex', alignItems: 'center', gap: 14,
                                }}>
                                    {rAvatar ? (
                                        <img src={rAvatar} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(197,160,89,0.25)', flexShrink: 0 }} />
                                    ) : (
                                        <div style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, rgba(197,160,89,0.15), rgba(197,160,89,0.05))', border: '1px solid rgba(197,160,89,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: 'rgba(197,160,89,0.6)', fontWeight: 600 }}>
                                            {rName.charAt(0)}
                                        </div>
                                    )}
                                    <div style={{ flex: 1, position: 'relative' }}>
                                        <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', gap: 2 }}>{stars(review.rating)}</div>
                                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)', fontWeight: 600, marginBottom: 4 }}>{rName}</div>
                                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.6rem', fontWeight: 600, color: 'rgba(197,160,89,0.4)', letterSpacing: 2, textTransform: 'uppercase' }}>
                                            {rHierarchy} &bull; {rMerit.toLocaleString()} merit{rServing ? ` \u2022 ${rServing}` : ''}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ padding: '16px 20px' }}>
                                    <p style={{ margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.8, fontStyle: 'italic' }}>
                                        &ldquo;{review.text}&rdquo;
                                    </p>
                                </div>
                            </div>
                            );
                        })}
                    </div>
                </div>

                {/* ════════ BOTTOM QUOTE ════════ */}
                <div style={{ textAlign: 'center', marginTop: 72 }}>
                    <p style={{ fontFamily: 'Cinzel,serif', fontSize: '0.88rem', color: 'rgba(255,255,255,0.18)', fontStyle: 'italic', maxWidth: 460, margin: '0 auto', lineHeight: 1.8 }}>
                        &ldquo;Once you hand over the key, there is no going back. You will serve on My terms, on My schedule.&rdquo;
                    </p>
                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.3rem', color: 'rgba(197,160,89,0.15)', letterSpacing: 5, marginTop: 16 }}>QUEEN KARIN</div>
                </div>

                {status === 'cancelled' && (
                    <div style={{ textAlign: 'center', marginTop: 24, fontFamily: 'Rajdhani,sans-serif', fontSize: '0.9rem', color: 'rgba(255,100,100,0.5)' }}>Payment cancelled. You may try again when ready.</div>
                )}
                {status === 'error' && (
                    <div style={{ textAlign: 'center', marginTop: 24, fontFamily: 'Rajdhani,sans-serif', fontSize: '0.9rem', color: 'rgba(255,100,100,0.5)' }}>Something went wrong. Please try again.</div>
                )}

                {/* Bottom padding for fake nav */}
                <div className="kh-bottom-pad" style={{ height: 80 }} />
            </div>

            {/* ─── FAKE BOTTOM NAV ─── */}
            <nav className="kh-fake-nav" style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999999,
                height: 'calc(60px + env(safe-area-inset-bottom))',
                paddingBottom: 'env(safe-area-inset-bottom)',
                background: 'rgba(4, 4, 12, 0.96)',
                backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                borderTop: '1px solid rgba(197, 160, 89, 0.18)',
                display: 'flex', alignItems: 'stretch', justifyContent: 'space-around',
            }}>
                <button onClick={() => showAccessDenied('your Profile')} style={fakeNavBtnStyle}>
                    <span style={fakeNavIconStyle}>{'\u25C6'}</span>
                    <span style={fakeNavLabelStyle}>PROFILE</span>
                </button>
                <button onClick={() => showAccessDenied('your Record')} style={fakeNavBtnStyle}>
                    <span style={fakeNavIconStyle}>{'\u25A6'}</span>
                    <span style={fakeNavLabelStyle}>RECORD</span>
                </button>
                <button onClick={() => showAccessDenied('Queen\'s Chat')} style={{
                    flex: 1, background: 'transparent', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', padding: 0, position: 'relative',
                    marginTop: -30, transform: 'translateY(14px)',
                }}>
                    <div style={{ width: 75, height: 75, borderRadius: '50%', overflow: 'hidden', background: '#000', flexShrink: 0 }}>
                        <img src="/queen-nav.png" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} alt="Queen" />
                    </div>
                </button>
                <button onClick={() => showAccessDenied('Queen\'s Wall')} style={fakeNavBtnStyle}>
                    <span style={fakeNavIconStyle}>{'\u265B'}</span>
                    <span style={fakeNavLabelStyle}>QUEEN</span>
                </button>
                <button onClick={() => showAccessDenied('Global Chat')} style={fakeNavBtnStyle}>
                    <span style={fakeNavIconStyle}>{'\u25CE'}</span>
                    <span style={fakeNavLabelStyle}>GLOBAL</span>
                </button>
            </nav>
        </div>
    );
}
