"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import '@/css/login.css';

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

export default function LoginPage() {
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [toasts, setToasts] = useState<any[]>([]);

    const showToast = (item: any) => {
        const id = Date.now() + Math.random();
        setToasts([{ ...item, _id: id }]);
        setTimeout(() => setToasts(prev => prev.map(t => t._id === id ? { ...t, _leaving: true } : t)), 8000);
        setTimeout(() => setToasts(prev => prev.filter(t => t._id !== id)), 8500);
    };

    const parseGlobalCard = (msg: any) => {
        const content = msg.message || msg.content || '';
        const created = msg.created_at;
        const avatar = msg.sender_avatar || null;
        try {
            if (content.startsWith('RISKY_TRIBUTE_CARD::')) {
                const d = JSON.parse(content.replace('RISKY_TRIBUTE_CARD::', ''));
                const resultText = d.isWin ? `won +${(d.wonAmount||0).toLocaleString()} coins` : d.lostAmount === 0 ? 'lost nothing' : `lost ${(d.lostAmount||0).toLocaleString()} coins`;
                return { sender_name: d.senderName || 'SUBJECT', sender_avatar: d.senderAvatar || avatar, text: `just gambled ${(d.stakeAmount||0).toLocaleString()} coins and ${resultText}`, kind: 'risky', cardIcon: d.icon || null, cardName: d.cardName || null, isWin: d.isWin, stakeAmount: d.stakeAmount || 0, wonAmount: d.wonAmount || 0, lostAmount: d.lostAmount || 0, created_at: created };
            }
            if (content.startsWith('DIRECT_TRIBUTE_CARD::')) {
                const d = JSON.parse(content.replace('DIRECT_TRIBUTE_CARD::', ''));
                return { sender_name: d.senderName || 'SUBJECT', sender_avatar: d.senderAvatar || avatar, text: `sent a tribute of ${(d.amount||0).toLocaleString()} coins`, kind: 'tribute', created_at: created };
            }
            if (content.startsWith('PROMOTION_CARD::')) {
                const d = JSON.parse(content.replace('PROMOTION_CARD::', ''));
                return { sender_name: d.name || 'SUBJECT', sender_avatar: avatar, text: `was promoted to ${d.newRank || 'a new rank'}`, kind: 'promotion', created_at: created };
            }
            if (content.startsWith('WELCOME_CARD::')) {
                const d = JSON.parse(content.replace('WELCOME_CARD::', ''));
                return { sender_name: d.name || 'New Subject', sender_avatar: avatar, text: 'entered the household', kind: 'welcome', created_at: created };
            }
            if (content.startsWith('UPDATE_MERIT_CARD::')) {
                const d = JSON.parse(content.replace('UPDATE_MERIT_CARD::', ''));
                return { sender_name: d.senderName || 'SUBJECT', sender_avatar: d.senderAvatar || avatar, text: `earned +${d.points || 0} points`, kind: 'merit', created_at: created };
            }
            if (content.startsWith('CHALLENGE_TASK_CARD::')) {
                const d = JSON.parse(content.replace('CHALLENGE_TASK_CARD::', ''));
                return { sender_name: d.senderName || 'SUBJECT', sender_avatar: d.senderAvatar || avatar, text: `completed a challenge task`, kind: 'challenge', created_at: created };
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

    useEffect(() => {
        // Store redirect destination if provided (e.g. /keyholder funnel)
        const params = new URLSearchParams(window.location.search);
        const redirect = params.get('redirect');
        if (redirect) localStorage.setItem('post_login_redirect', redirect);

        setMounted(true);

        // If user already has a valid session (e.g. PWA relaunch), skip login
        const supabase = createClient();
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
                const stored = localStorage.getItem('post_login_redirect');
                if (stored) { localStorage.removeItem('post_login_redirect'); window.location.href = stored; return; }
                window.location.href = '/profile';
            }
        });

        // Fetch latest activity toast via public API (bypasses RLS)
        const timer = setTimeout(async () => {
            try {
                const res = await fetch('/api/global/messages');
                const json = await res.json();
                const messages = json.messages || [];
                // messages are oldest→newest, reverse to get newest first
                const reversed = [...messages].reverse();
                for (const msg of reversed) {
                    const parsed = parseGlobalCard(msg);
                    if (parsed) {
                        if (!parsed.sender_avatar && msg.sender_email && msg.sender_email !== 'system') {
                            try { const { data: p } = await supabase.from('profiles').select('avatar_url').ilike('member_id', msg.sender_email).limit(1); if (p && p[0]?.avatar_url) parsed.sender_avatar = p[0].avatar_url; } catch {}
                        }
                        showToast(parsed); break;
                    }
                }
            } catch (err) {
                console.log('[Login] Toast fetch error:', err);
            }
        }, 3000);

        // Realtime
        const channel = supabase.channel('login-activity')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'global_messages' }, async (payload: any) => {
                const row = payload.new;
                if (!row) return;
                const parsed = parseGlobalCard(row);
                if (parsed) {
                    if (!parsed.sender_avatar && row.sender_email && row.sender_email !== 'system') {
                        try { const { data: p } = await supabase.from('profiles').select('avatar_url').ilike('member_id', row.sender_email).limit(1); if (p && p[0]?.avatar_url) parsed.sender_avatar = p[0].avatar_url; } catch {}
                    }
                    showToast(parsed);
                }
            })
            .subscribe();

        const reset = () => setLoading(false);
        window.addEventListener('focus', reset);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) reset(); });
        return () => { window.removeEventListener('focus', reset); clearTimeout(timer); supabase.removeChannel(channel); };
    }, []);
    const [error, setError] = useState<string | null>(null);
    const [emailOpen, setEmailOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleGoogleLogin = async () => {
        setLoading(true); setError(null);
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { access_type: 'offline', prompt: 'consent' } }
        });
        if (error) { setError(error.message); setLoading(false); }
    };

    const handleTwitterLogin = async () => {
        setLoading(true); setError(null);
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'twitter',
            options: { redirectTo: `${window.location.origin}/auth/callback`, scopes: 'users.read tweet.read' }
        });
        if (error) { setError(error.message); setLoading(false); }
    };

    const handleDiscordLogin = async () => {
        setLoading(true); setError(null);
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'discord',
            options: { redirectTo: `${window.location.origin}/auth/callback` }
        });
        if (error) { setError(error.message); setLoading(false); }
    };

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError(null);
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { setError(error.message); setLoading(false); }
        else window.location.href = '/profile';
    };

    return (
        <div className="login-container">
            {/* Layered backgrounds — same as /tribute */}
            <div style={{ position: 'fixed', inset: 0, backgroundImage: "url('/queen-bg-mobile.jpg')", backgroundSize: 'cover', backgroundPosition: 'center 20%', zIndex: 0, opacity: 0.35, filter: 'saturate(0.2) brightness(0.7)' }} />
            <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(180deg, rgba(2,2,2,0.3) 0%, rgba(2,2,2,0.7) 30%, rgba(2,2,2,0.92) 55%, #020202 75%)', zIndex: 0 }} />
            <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '120vw', height: '40vh', background: 'radial-gradient(ellipse at center top, rgba(197,160,89,0.04) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.02, backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")', backgroundSize: '128px 128px' }} />

            {/* ── TOAST NOTIFICATIONS ── */}
            {toasts.map((t: any) => {
                const avatar = t.sender_avatar || null;
                const initial = (t.sender_name || 'S').charAt(0).toUpperCase();
                const when = t.created_at ? timeAgo(t.created_at) : '';
                const isRisky = t.kind === 'risky' && t.cardIcon;
                return (
                <div key={t._id} className="login-toast" style={{
                    position: 'fixed', bottom: 'calc(85px + env(safe-area-inset-bottom) + 16px)',
                    right: 12, left: 12, zIndex: 99999,
                    background: 'linear-gradient(135deg, #0d0d1f 0%, #1a0a2e 100%)',
                    border: '1px solid rgba(197,160,89,0.4)',
                    borderRadius: 18, padding: isRisky ? '0' : '20px 22px',
                    boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(197,160,89,0.08)',
                    animation: t._leaving ? 'loginToastOut 0.4s ease-in forwards' : 'loginToastIn 0.4s ease-out forwards',
                    overflow: 'hidden',
                }}>
                    {isRisky ? (
                        <div style={{ display: 'flex', minHeight: 130 }}>
                            <div style={{ flex: '0 0 30%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(197,160,89,0.04)', borderRight: '1px solid rgba(197,160,89,0.12)', padding: 16 }}>
                                <img src={t.cardIcon} style={{ width: '70%', maxWidth: 70, height: 'auto', opacity: 0.9 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            </div>
                            <div style={{ flex: 1, padding: '18px 18px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.45rem', color: 'rgba(197,160,89,0.5)', letterSpacing: 2, textTransform: 'uppercase' }}>Recent Activity</div>
                                    {when && <span style={{ fontFamily: 'Orbitron, sans-serif', color: 'rgba(197,160,89,0.3)', letterSpacing: 1, fontSize: '0.4rem' }}>{when}</span>}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    {avatar ? (
                                        <img src={avatar} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(197,160,89,0.5)', flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                    ) : (
                                        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '1.5px solid rgba(197,160,89,0.35)', background: 'linear-gradient(135deg, rgba(197,160,89,0.15), rgba(197,160,89,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: 'rgba(197,160,89,0.6)', fontWeight: 600, flexShrink: 0 }}>{initial}</div>
                                    )}
                                    <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: '#c5a059', fontWeight: 600, letterSpacing: 1 }}>{t.sender_name}</span>
                                </div>
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.4, fontWeight: 500 }}>
                                    just gambled {(t.stakeAmount||0).toLocaleString()} coins and {t.isWin ? <span style={{ color: '#4ade80' }}>won +{(t.wonAmount||0).toLocaleString()}</span> : t.lostAmount === 0 ? <span style={{ color: '#c5a059' }}>lost nothing</span> : <span style={{ color: '#ef4444' }}>lost {(t.lostAmount||0).toLocaleString()}</span>}
                                </div>
                                {t.cardName && <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.5rem', color: 'rgba(197,160,89,0.5)', letterSpacing: 3, textTransform: 'uppercase', marginTop: 2 }}>{t.cardName}</div>}
                                <button onClick={() => setToasts(prev => prev.filter(x => x._id !== t._id))} style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)', padding: '5px 16px', borderRadius: 6, fontFamily: 'Orbitron, sans-serif', fontSize: '0.4rem', letterSpacing: 1, cursor: 'pointer', marginTop: 4 }}>DISMISS</button>
                            </div>
                        </div>
                    ) : (
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
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.05rem', color: 'rgba(255,255,255,0.85)', fontWeight: 500, lineHeight: 1.4 }}>
                                    <span style={{ color: '#c5a059' }}>{t.sender_name}</span> {t.text}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                            <button onClick={() => setToasts(prev => prev.filter(x => x._id !== t._id))} style={{ flex: 1, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)', padding: '9px 0', borderRadius: 8, fontFamily: 'Orbitron, sans-serif', fontSize: '0.5rem', letterSpacing: 1, cursor: 'pointer' }}>DISMISS</button>
                        </div>
                        </>
                    )}
                </div>
                );
            })}

            {/* ── BRAND HEADER — QUEEN KARIN (same as /tribute) ── */}
            <div className="login-content-wrap" style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 440, padding: '0 clamp(20px,5vw,32px)', textAlign: 'center' }}>
                <div style={{ paddingTop: 'clamp(50px, 10vw, 80px)', animation: mounted ? 'loginFadeIn 1.2s ease-out both' : 'none' }}>
                    <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto 22px' }}>
                        <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', border: '1px solid rgba(197,160,89,0.2)', animation: 'loginRingExpand 4s ease-in-out infinite' }} />
                        <div style={{ position: 'absolute', inset: -16, borderRadius: '50%', border: '1px solid rgba(197,160,89,0.08)', animation: 'loginRingExpand 4s ease-in-out infinite 0.7s' }} />
                        <div style={{ position: 'absolute', inset: -24, borderRadius: '50%', border: '1px solid rgba(197,160,89,0.04)', animation: 'loginRingExpand 4s ease-in-out infinite 1.4s' }} />
                        <img src="/queen-karin.png" alt="Queen Karin" style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(197,160,89,0.35)', boxShadow: '0 0 60px rgba(0,0,0,0.8), 0 0 30px rgba(197,160,89,0.08)' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                    <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.55rem', fontWeight: 500, color: 'rgba(197,160,89,0.4)', letterSpacing: 8, textTransform: 'uppercase', marginBottom: 10 }}>PRESENTED BY</div>
                    <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(1.8rem, 6vw, 2.6rem)', color: '#fff', letterSpacing: 4, textTransform: 'uppercase', margin: '0 0 4px', fontWeight: 600, lineHeight: 1.05, whiteSpace: 'nowrap' }}>QUEEN KARIN</h1>
                    <div style={{ width: 50, height: '1.5px', margin: '14px auto 0', background: 'linear-gradient(90deg, transparent, #c5a059, transparent)' }} />
                </div>

                {/* ── INTRO TEXT ── */}
                <div style={{ marginTop: 'clamp(28px, 6vw, 44px)', animation: mounted ? 'loginFadeUp 1s ease-out 0.4s both' : 'none' }}>
                    <p style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(0.75rem, 2.8vw, 0.9rem)', color: 'rgba(255,255,255,0.4)', lineHeight: 1.9, fontWeight: 400, margin: '0 0 20px', letterSpacing: 1 }}>
                        Welcome to the only FemDom app run entirely by a single Domme dedicated to complete control.
                    </p>
                    <div style={{ overflow: 'hidden', margin: '36px -32px 40px', maskImage: 'linear-gradient(90deg, transparent, black 15%, black 85%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, black 15%, black 85%, transparent)' }}>
                        <div className="login-marquee" style={{ display: 'flex', alignItems: 'center', gap: 0, whiteSpace: 'nowrap', fontFamily: 'Cinzel, serif', fontSize: 'clamp(1rem, 3.5vw, 1.15rem)', color: 'rgba(255,255,255,0.75)', fontWeight: 600, letterSpacing: 4, textTransform: 'uppercase' }}>
                            {[0,1].map(i => (
                                <span key={i} className="login-marquee-track" style={{ display: 'inline-flex', alignItems: 'center', gap: 0, paddingRight: 0 }}>
                                    {['Tasks', 'Sessions', 'League', 'Tributes', 'Tasks', 'Sessions', 'League', 'Tributes'].map((w, j) => (
                                        <span key={j} style={{ display: 'inline-flex', alignItems: 'center' }}>
                                            <span>{w}</span>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(197,160,89,0.5)" style={{ margin: '0 14px', flexShrink: 0 }}><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"/></svg>
                                        </span>
                                    ))}
                                </span>
                            ))}
                        </div>
                    </div>
                    <p style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 'clamp(0.78rem, 2.8vw, 0.88rem)', color: 'rgba(255,255,255,0.25)', lineHeight: 1.7, fontWeight: 400, margin: '0 0 28px' }}>
                        What started as a one-person project became a phenomenon. A living hierarchy where every task, tribute, and act of devotion is tracked, ranked, and rewarded.
                    </p>
                </div>

            {/* ── LOGIN CARD ── */}
            <div className="login-card" style={{ animation: mounted ? 'loginFadeUp 1s ease-out 0.7s both' : 'none' }}>
                <p className="login-subtitle">Sign in to enter the household</p>

                <button onClick={handleGoogleLogin} className="oauth-btn" disabled={loading}>
                    <svg width="16" height="16" viewBox="0 0 24 24" style={{ opacity: 0.5 }}>
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="rgba(255,255,255,0.6)" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="rgba(255,255,255,0.45)" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="rgba(255,255,255,0.35)" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="rgba(255,255,255,0.5)" />
                    </svg>
                    Login with Email
                </button>

                <button onClick={handleTwitterLogin} className="oauth-btn" disabled={loading}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    Login with X
                </button>

                <button onClick={handleDiscordLogin} className="oauth-btn" disabled={loading}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                    Login with Discord
                </button>

                <button
                    className="email-toggle-btn"
                    onClick={() => { setEmailOpen(o => !o); setError(null); }}
                    disabled={loading}
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                    </svg>
                    {emailOpen ? 'Hide Email Login' : 'Login with Email'}
                </button>

                <div className={`email-form-wrap${emailOpen ? ' open' : ''}`}>
                    <form className="email-form-inner" onSubmit={handleEmailSubmit}>
                        <div className="input-group">
                            <label>Email</label>
                            <input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
                        </div>
                        <div className="input-group">
                            <label>Password</label>
                            <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
                        </div>
                        <button type="submit" className="login-btn" disabled={loading}>
                            {loading ? <><span className="loading-spinner" />Entering...</> : 'Enter'}
                        </button>
                        <div className="toggle-mode">
                            <span style={{ opacity: 0.4, fontSize: '0.7em' }}>Forgot password? Use Google or X to login.</span>
                        </div>
                    </form>
                </div>

                {error && <div className="error-msg">{error}</div>}

            </div>

                <p style={{ fontFamily: 'Italianno, cursive', fontSize: 'clamp(1.4rem, 5vw, 1.9rem)', color: 'rgba(197,160,89,0.4)', margin: '24px 0 0', lineHeight: 1.3, textAlign: 'center' }}>
                    ...you don&#39;t &ldquo;join&rdquo; me &mdash; you surrender!
                </p>

                {/* ─── FOOTER ─── */}
                <div style={{ textAlign: 'center', marginTop: 60, borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: 20 }}>
                    <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.5rem', fontWeight: 500, color: 'rgba(255,255,255,0.06)', letterSpacing: 3, textTransform: 'uppercase' }}>
                        Property of Queen Karin &nbsp;&middot;&nbsp; Est. 2024
                    </div>
                </div>

                <div style={{ height: 'calc(100px + env(safe-area-inset-bottom))' }} />
            </div>{/* close brand/content wrapper */}

            {/* Fake mobile bottom nav */}
            <nav className="login-fake-nav">
                <div className="login-nav-item">
                    <span style={{ fontSize: '1rem', opacity: 0.3 }}>◆</span>
                    <span>PROFILE</span>
                </div>
                <div className="login-nav-item">
                    <span style={{ fontSize: '1rem', opacity: 0.3 }}>▦</span>
                    <span>RECORD</span>
                </div>
                <div className="login-nav-queen-btn">
                    <div className="login-nav-queen-ring">
                        <img src="/queen-nav.png" alt="Queen" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    </div>
                </div>
                <div className="login-nav-item">
                    <span style={{ fontSize: '0.85rem', opacity: 0.3 }}>♛</span>
                    <span>QUEEN</span>
                </div>
                <div className="login-nav-item">
                    <span style={{ fontSize: '0.85rem', opacity: 0.3 }}>◎</span>
                    <span>GLOBAL</span>
                </div>
            </nav>
        </div>
    );
}
