"use client";

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import PaymentModal from '@/components/PaymentModal';

const PRICE = 111;
const REGULAR = 199;

const TICKER = [
    'slave_r*** is viewing this page',
    'sub_k*** is checking the price right now',
    'cage_b*** is reading the program details',
    'locked_*** is on the checkout page',
    'pet_m*** is looking at the spots left',
    'slave_t*** just opened this page',
    'sub_j*** is considering locking up',
    'obey_*** is reading the Queen\'s message',
];

export default function LoctoberClient() {
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [showPayment, setShowPayment] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [showSticky, setShowSticky] = useState(false);
    const [countdown, setCountdown] = useState({ d: 0, h: 0, m: 0, s: 0 });
    const [tickerIdx, setTickerIdx] = useState(0);

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        (async () => {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (user?.email) setUserEmail(user.email);
            } catch {}
        })();
    }, []);

    useEffect(() => {
        if (userEmail && typeof window !== 'undefined') {
            const p = new URLSearchParams(window.location.search);
            if (p.get('pay') === '1') { window.history.replaceState({}, '', '/locktober'); setShowPayment(true); }
        }
    }, [userEmail]);

    useEffect(() => {
        const getTarget = () => {
            const now = new Date();
            let d = (8 - now.getDay()) % 7;
            if (d === 0) d = 7;
            const t = new Date(now); t.setDate(now.getDate() + d); t.setHours(0, 0, 0, 0);
            return t.getTime();
        };
        const tick = () => {
            const diff = Math.max(0, getTarget() - Date.now());
            setCountdown({ d: Math.floor(diff / 86400000), h: Math.floor(diff / 3600000) % 24, m: Math.floor(diff / 60000) % 60, s: Math.floor(diff / 1000) % 60 });
        };
        tick(); const iv = setInterval(tick, 1000); return () => clearInterval(iv);
    }, []);

    useEffect(() => {
        const getScroller = () => document.querySelector('[data-loc-scroll]') as HTMLElement | null;
        const fn = () => { const s = getScroller(); if (s) setShowSticky(s.scrollTop > window.innerHeight * 0.75); };
        const t = setTimeout(() => { const s = getScroller(); s?.addEventListener('scroll', fn, { passive: true }); }, 50);
        return () => { const s = getScroller(); s?.removeEventListener('scroll', fn); clearTimeout(t); };
    }, []);

    useEffect(() => {
        const obs = new IntersectionObserver((entries) => {
            entries.forEach((e) => { if (e.isIntersecting) { (e.target as HTMLElement).style.animation = 'locFadeUp 0.7s ease-out forwards'; obs.unobserve(e.target); } });
        }, { threshold: 0.01, rootMargin: '50px' });
        document.querySelectorAll('.loc-anim').forEach((el) => obs.observe(el));
        return () => obs.disconnect();
    }, []);

    useEffect(() => {
        const iv = setInterval(() => setTickerIdx(i => (i + 1) % TICKER.length), 4000);
        return () => clearInterval(iv);
    }, []);

    const handleCheckout = () => {
        if (!userEmail) { window.location.href = `https://throne.qkarin.com/login?redirect=${encodeURIComponent('/locktober?pay=1')}`; return; }
        setShowPayment(true);
    };

    const pad = (n: number) => String(n).padStart(2, '0');

    return (<>
        {/* ── FIXED BG ── */}
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: -50, background: "url('https://ntrerrxudvgbjyscmdvh.supabase.co/storage/v1/object/public/media/promo/locktober-bg.png') center top/cover no-repeat", filter: 'brightness(0.18) saturate(1.1)', opacity: 0.55 }} />
        </div>
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: -50, background: 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.95) 65%)' }} />
        </div>
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden', opacity: 0.02 }}>
            <div style={{ position: 'absolute', inset: -50, backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")', backgroundSize: '128px 128px' }} />
        </div>

        {/* ── STICKY TOP HEADER ── */}
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: 'rgba(4,4,6,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(197,160,89,0.15)', transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1), opacity 0.4s ease', transform: showSticky ? 'translateY(0)' : 'translateY(-100%)', opacity: showSticky ? 1 : 0, pointerEvents: showSticky ? 'auto' : 'none' }}>
            <div style={{ textAlign: 'center', width: '100%' }}>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(0.55rem,2vw,0.65rem)', fontWeight: 400, letterSpacing: 4, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>LOCKTOBER 2026 &middot; QUEEN KARIN &middot; 5 SPOTS LEFT</div>
                <button onClick={handleCheckout} style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(0.55rem,2vw,0.7rem)', fontWeight: 700, color: '#000', letterSpacing: 4, background: 'linear-gradient(135deg,#d4af6a,#b8860b)', border: 'none', padding: '10px 32px', cursor: 'pointer', animation: 'casinoPulse 2s ease infinite' }}>CLAIM MY SPOT &euro;{PRICE}</button>
            </div>
        </div>

        {/* ── FIXED BOTTOM URGENCY BAR — always visible ── */}
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 99998, padding: '12px 16px 20px', background: 'rgba(8,0,0,0.97)', borderTop: '1px solid rgba(139,0,0,0.8)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, animation: 'bottomBarPulse 3s ease infinite' }}>
            <div>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(0.55rem,2vw,0.7rem)', fontWeight: 700, color: '#fff', letterSpacing: 2 }}>LAST 5 SPOTS</div>
                <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', letterSpacing: 1 }}>Price rises Monday</div>
            </div>
            <button onClick={handleCheckout} style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(0.6rem,2vw,0.75rem)', fontWeight: 700, color: '#000', letterSpacing: 3, background: 'linear-gradient(135deg,#d4af6a,#b8860b)', border: 'none', padding: '14px 28px', cursor: 'pointer', whiteSpace: 'nowrap', animation: 'casinoPulse 2s ease infinite', flexShrink: 0 }}>BUY NOW &euro;{PRICE}</button>
        </div>

        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Dancing+Script:wght@400;500;600;700&family=Inter:wght@200;300;400;500&family=Rajdhani:wght@300;400;500;600;700&display=swap" />
        <style>{`
            html, body { background:#020202!important; overflow:hidden!important; height:100%!important; }
            @keyframes locFadeUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
            @keyframes locFadeIn{from{opacity:0}to{opacity:1}}
            @keyframes locShimmer{0%{background-position:-200% center}100%{background-position:200% center}}
            @keyframes locFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
            @keyframes locGlow{0%,100%{text-shadow:0 0 30px rgba(197,160,89,0.15)}50%{text-shadow:0 0 60px rgba(197,160,89,0.4)}}
            @keyframes locPulse{0%,100%{opacity:1}50%{opacity:0.4}}
            @keyframes locRing{0%{transform:scale(0.95);opacity:0.3}50%{transform:scale(1.06);opacity:0.7}100%{transform:scale(0.95);opacity:0.3}}
            @keyframes locBorder{0%,100%{border-color:rgba(197,160,89,0.08);box-shadow:0 0 30px rgba(197,160,89,0.03)}50%{border-color:rgba(197,160,89,0.25);box-shadow:0 0 50px rgba(197,160,89,0.08)}}
            @keyframes locCtaShine{0%{left:-100%}50%,100%{left:100%}}
            @keyframes casinoPulse{0%,100%{box-shadow:0 0 25px rgba(197,160,89,0.5),0 0 50px rgba(197,160,89,0.25)}50%{box-shadow:0 0 40px rgba(197,160,89,0.8),0 0 80px rgba(197,160,89,0.4),0 0 120px rgba(197,160,89,0.15)}}
            @keyframes tickerSlide{0%{opacity:0;transform:translateY(8px)}15%,85%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-8px)}}
            @keyframes bottomBarPulse{0%,100%{background:rgba(100,0,0,0.98)}50%{background:rgba(139,0,0,1)}}
            .loc-divider{width:100%;display:flex;align-items:center;gap:20px;padding:100px 0}
            .loc-divider::before,.loc-divider::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,transparent,rgba(197,160,89,0.2),rgba(197,160,89,0.05))}
            .loc-divider::after{background:linear-gradient(90deg,rgba(197,160,89,0.05),rgba(197,160,89,0.2),transparent)}
            .loc-divider span{font-family:Cinzel,serif;font-size:0.6rem;color:rgba(197,160,89,0.4);letter-spacing:6px;white-space:nowrap}
            .loc-section{position:relative;margin-left:calc(-1*clamp(20px,5vw,40px));margin-right:calc(-1*clamp(20px,5vw,40px));padding-left:clamp(20px,5vw,40px);padding-right:clamp(20px,5vw,40px);border-top:1px solid rgba(197,160,89,0.04);border-bottom:1px solid rgba(197,160,89,0.04);background:rgba(0,0,0,0.5)}
            .loc-section-alt{background:rgba(0,0,0,0.85);border-top:1px solid rgba(197,160,89,0.08);border-bottom:1px solid rgba(197,160,89,0.08)}
            .loc-cta-btn{position:relative;overflow:hidden;transition:all 0.2s ease;display:inline-block;width:auto}
            .loc-cta-btn:hover{filter:brightness(1.2);transform:translateY(-2px)}
            .loc-cta-btn:active{transform:scale(0.96)}
            .loc-need-item{transition:background 0.3s ease}
            .loc-need-item:hover{background:rgba(197,160,89,0.02)}
            @media(min-width:769px){
                .loc-container{max-width:1000px!important;padding-left:60px!important;padding-right:60px!important}
                .loc-section{margin-left:calc(-50vw + 50%);margin-right:calc(-50vw + 50%);padding-left:calc(50vw - 50% + 60px);padding-right:calc(50vw - 50% + 60px)}
                .loc-week-grid{grid-template-columns:1fr 1fr!important}
            }
        `}</style>

        <div data-loc-scroll style={{ position: 'fixed', inset: 0, overflowY: 'scroll', overflowX: 'hidden', zIndex: 1, color: '#fff', WebkitOverflowScrolling: 'touch' }}>
        <div className="loc-container" style={{ position: 'relative', maxWidth: 700, margin: '0 auto', padding: '0 clamp(20px,5vw,32px) 80px' }}>

            {/* ════ HERO ════ */}
            <div style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', position: 'relative', padding: '40px 0' }}>

                {/* ── SCARCITY STICKER ── */}
                <div style={{ position: 'absolute', top: 'clamp(16px,5vw,28px)', right: 'clamp(-8px,1vw,0px)', animation: mounted ? 'locFadeIn 0.6s ease-out both' : 'none', zIndex: 2 }}>
                    <div style={{ background: 'linear-gradient(135deg,#8b0000,#6b0000)', color: '#fff', fontFamily: 'Cinzel,serif', fontSize: 'clamp(0.65rem,2vw,0.85rem)', fontWeight: 700, letterSpacing: 3, padding: '14px 26px', textTransform: 'uppercase', boxShadow: '0 4px 32px rgba(139,0,0,0.7)', transform: 'rotate(2deg)', animation: 'locPulse 2s ease infinite', lineHeight: 1.4 }}>
                        LAST 5 SPOTS
                    </div>
                </div>

                {/* ── Title ── */}
                <div style={{ animation: mounted ? 'locFadeIn 0.8s ease-out both' : 'none', marginBottom: 8 }}>
                    <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.45rem', fontWeight: 500, letterSpacing: 6, color: 'rgba(197,160,89,0.35)', textTransform: 'uppercase', marginBottom: 12 }}>QUEEN KARIN PRESENTS</div>
                    <h1 style={{ position: 'relative', display: 'inline-block', fontFamily: 'Cinzel,serif', fontSize: 'clamp(2.6rem,9vw,4rem)', color: '#fff', letterSpacing: 6, textTransform: 'uppercase', margin: 0, fontWeight: 700, lineHeight: 1 }}>
                        LOCKTOBER
                        <span style={{ position: 'absolute', right: 'clamp(-24px,-4vw,-40px)', top: 'clamp(-14px,-2vw,-20px)', fontFamily: 'Dancing Script,cursive', fontSize: 'clamp(1.4rem,5vw,2.2rem)', color: '#d4af6a', fontWeight: 400, letterSpacing: 0, textTransform: 'none', transform: 'rotate(-8deg)' }}>fest</span>
                    </h1>
                </div>

                {/* ── Differentiator ── */}
                <div style={{ animation: mounted ? 'locFadeIn 0.8s ease-out 0.2s both' : 'none', marginBottom: 36 }}>
                    <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: 'clamp(1.05rem,3vw,1.35rem)', fontStyle: 'italic', color: 'rgba(255,255,255,0.45)', fontWeight: 300, letterSpacing: 1 }}>The only Locktober with a real keyholder app.</div>
                </div>

                {/* ── PRICE ── */}
                <div style={{ animation: mounted ? 'locFadeUp 0.7s ease-out 0.35s both' : 'none', marginBottom: 8 }}>
                    <span style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(5rem,18vw,8rem)', fontWeight: 700, color: '#d4af6a', lineHeight: 0.9, letterSpacing: -4, display: 'block' }}>&euro;{PRICE}</span>
                </div>
                <div style={{ animation: mounted ? 'locFadeIn 0.6s ease-out 0.5s both' : 'none', marginBottom: 32 }}>
                    <span style={{ fontFamily: 'Inter,sans-serif', fontSize: '1rem', fontWeight: 300, color: 'rgba(255,255,255,0.15)', textDecoration: 'line-through', textDecorationColor: 'rgba(255,255,255,0.2)' }}>&euro;{REGULAR}</span>
                    <span style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.6rem', fontWeight: 600, color: '#8b0000', marginLeft: 10, letterSpacing: 1 }}>SAVE &euro;{REGULAR - PRICE}</span>
                </div>

                {/* ── Countdown ── */}
                <div style={{ animation: mounted ? 'locFadeIn 0.8s ease-out 0.55s both' : 'none', marginBottom: 28 }}>
                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.4rem', fontWeight: 600, letterSpacing: 5, color: 'rgba(139,0,0,0.7)', textTransform: 'uppercase', marginBottom: 12 }}>Price rises to &euro;{REGULAR} in</div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(12px,4vw,24px)' }}>
                        {[{ v: pad(countdown.d), l: 'Days' }, { v: pad(countdown.h), l: 'Hrs' }, { v: pad(countdown.m), l: 'Min' }, { v: pad(countdown.s), l: 'Sec' }].map((u) => (
                            <div key={u.l} style={{ textAlign: 'center' }}>
                                <div style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(1.8rem,6vw,2.6rem)', fontWeight: 700, color: '#8b0000', lineHeight: 1, textShadow: '0 0 30px rgba(139,0,0,0.4)' }}>{u.v}</div>
                                <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.35rem', fontWeight: 500, letterSpacing: 3, color: 'rgba(139,0,0,0.5)', marginTop: 4, textTransform: 'uppercase' }}>{u.l}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── SOLID CTA ── */}
                <div style={{ animation: mounted ? 'locFadeUp 0.7s ease-out 0.7s both' : 'none', marginBottom: 16 }}>
                    <button className="loc-cta-btn" onClick={handleCheckout} style={{ padding: '22px 60px', background: 'linear-gradient(135deg,#d4af6a,#a07830)', color: '#000', border: 'none', cursor: 'pointer', fontFamily: 'Cinzel,serif', fontSize: 'clamp(0.65rem,2.5vw,0.85rem)', fontWeight: 700, letterSpacing: 5, textTransform: 'uppercase', boxShadow: '0 4px 40px rgba(197,160,89,0.4)' }}>
                        CLAIM MY SPOT &euro;{PRICE}
                    </button>
                </div>

                {/* ── Participant Ticker ── */}
                {mounted && (
                    <div style={{ animation: 'locFadeIn 0.5s ease-out 1s both', height: 28, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                        <div key={tickerIdx} style={{ display: 'flex', alignItems: 'center', gap: 8, animation: 'tickerSlide 4s ease forwards' }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', flexShrink: 0, boxShadow: '0 0 8px rgba(74,222,128,0.8)', animation: 'locPulse 1s ease infinite' }} />
                            <span style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', letterSpacing: 1 }}>{TICKER[tickerIdx]}</span>
                        </div>
                    </div>
                )}

                <div style={{ animation: mounted ? 'locFadeIn 0.6s ease-out 0.9s both' : 'none' }}>
                    <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.48rem', color: 'rgba(197,160,89,0.2)', letterSpacing: 3, animation: 'locPulse 3s ease infinite' }}>5 SPOTS &middot; STARTS OCTOBER 1ST</div>
                </div>
            </div>

            {/* ════ VIDEO ════ */}
            <div style={{ paddingTop: 20, paddingBottom: 60, textAlign: 'center' }}>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(1rem,3vw,1.5rem)', color: 'rgba(255,255,255,0.85)', fontWeight: 600, letterSpacing: 3, marginBottom: 10, lineHeight: 1.3 }}>I built an entire keyholder application.</div>
                <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.95rem', color: 'rgba(255,255,255,0.3)', lineHeight: 1.7, maxWidth: 420, margin: '0 auto 28px' }}>
                    Not a DM arrangement. Not a timer on your phone.<br/>A real platform where I control your lock, your tasks, your 31 days.
                </div>
                <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(197,160,89,0.1)', maxWidth: 340, margin: '0 auto 32px', background: '#000' }}>
                    <video src="https://ntrerrxudvgbjyscmdvh.supabase.co/storage/v1/object/public/media/tribute-intro.mov#t=0.1" controls playsInline preload="metadata" style={{ width: '100%', display: 'block' }} />
                </div>
                <button className="loc-cta-btn" onClick={handleCheckout} style={{ padding: '20px 60px', background: 'linear-gradient(135deg,#d4af6a,#a07830)', color: '#000', border: 'none', cursor: 'pointer', fontFamily: 'Cinzel,serif', fontSize: '0.62rem', fontWeight: 700, letterSpacing: 5, textTransform: 'uppercase', boxShadow: '0 4px 32px rgba(197,160,89,0.35)' }}>
                    CLAIM MY SPOT &euro;{PRICE}
                </button>
                <div style={{ marginTop: 16 }}>
                    <a href="/keyholder" style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.2)', letterSpacing: 2, textDecoration: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 1 }}>New to keyholding? Learn more &rarr;</a>
                </div>
            </div>

            <div className="loc-divider"><span>HOW IT WORKS</span></div>

            {/* ════ 3-STEP TIMELINE ════ */}
            <div className="loc-section" style={{ paddingTop: 40, paddingBottom: 60 }}>
                <h2 style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(1.4rem,4vw,2.2rem)', color: 'rgba(255,255,255,0.85)', fontWeight: 600, letterSpacing: 3, margin: '0 0 40px', textAlign: 'center' }}>Three steps. No way back.</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxWidth: 480, margin: '0 auto', width: '100%' }}>
                    {[
                        { num: '01', title: 'Lock up on October 1st', text: 'You cage yourself, seal it with a numbered lock, and submit photo proof through the app. Your lock code comes to me. You no longer control your own release.' },
                        { num: '02', title: 'Serve daily for 31 days', text: 'Every morning: chastity check-in photo. Then your video task appears. You film it, submit it, I review it. Miss one and I add penalty days to your sentence.' },
                        { num: '03', title: 'Survive or suffer', text: 'Complete all 31 days and you have earned something real. Fail, and the consequences are mine to decide. There is no quitting halfway. There is no begging for release.' },
                    ].map((s, i) => (
                        <div key={i} className="loc-anim" style={{ display: 'flex', gap: 24, position: 'relative', transitionDelay: `${i*0.12}s` }}>
                            {i < 2 && <div style={{ position: 'absolute', left: 19, top: 44, bottom: -4, width: 1, background: 'linear-gradient(180deg,rgba(197,160,89,0.3),rgba(197,160,89,0.05))' }} />}
                            <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(197,160,89,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cinzel,serif', fontSize: '0.5rem', color: 'rgba(197,160,89,0.5)', background: 'rgba(197,160,89,0.06)' }}>{s.num}</div>
                            <div style={{ paddingBottom: 40 }}>
                                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '1.05rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>{s.title}</div>
                                <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.9rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.7 }}>{s.text}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="loc-divider"><span>WHAT YOU GET</span></div>

            {/* ════ 4 WEEKS — selling, not explaining ════ */}
            <div className="loc-section loc-section-alt" style={{ paddingTop: 40, paddingBottom: 60 }}>
                <h2 style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(1.4rem,4vw,2.2rem)', color: 'rgba(255,255,255,0.85)', fontWeight: 600, letterSpacing: 3, margin: '0 0 10px', textAlign: 'center' }}>31 days. 4 phases.</h2>
                <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '1.05rem', fontStyle: 'italic', color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginBottom: 40 }}>Each week escalates. There is no plateau.</div>
                <div className="loc-week-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, maxWidth: 560, margin: '0 auto' }}>
                    {[
                        { week: 'WEEK 1', title: 'Foundation', desc: 'Daily check-ins. First video tasks. I watch how well you follow instructions.', color: 'rgba(197,160,89,0.3)' },
                        { week: 'WEEK 2', title: 'Discipline', desc: 'Tasks get harder. Kneeling sessions increase. Confessions. You feel what real accountability costs.', color: 'rgba(197,160,89,0.45)' },
                        { week: 'WEEK 3', title: 'Endurance', desc: 'The cravings hit. The cage is no longer new. This is where most men fail. My penalty system ensures you do not.', color: 'rgba(197,160,89,0.6)' },
                        { week: 'WEEK 4', title: 'Total Surrender', desc: 'You are no longer locked because of the cage. You are locked because I told you to be.', color: 'rgba(197,160,89,0.8)' },
                    ].map((w, i) => (
                        <div key={i} className="loc-anim" style={{ padding: 'clamp(18px,3vw,24px)', background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(197,160,89,0.08)', borderRadius: 4, position: 'relative', overflow: 'hidden', transitionDelay: `${i*0.08}s` }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: w.color }} />
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
                                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.42rem', color: w.color, letterSpacing: 4 }}>{w.week}</div>
                                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '1rem', color: 'rgba(255,255,255,0.85)', fontWeight: 600, letterSpacing: 1 }}>{w.title}</div>
                            </div>
                            <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.88rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>{w.desc}</div>
                        </div>
                    ))}
                </div>
                <div style={{ textAlign: 'center', marginTop: 40 }}>
                    <button className="loc-cta-btn" onClick={handleCheckout} style={{ padding: '20px 60px', background: 'linear-gradient(135deg,#d4af6a,#a07830)', color: '#000', border: 'none', cursor: 'pointer', fontFamily: 'Cinzel,serif', fontSize: '0.62rem', fontWeight: 700, letterSpacing: 5, textTransform: 'uppercase', boxShadow: '0 4px 32px rgba(197,160,89,0.35)' }}>
                        YES. LOCK ME IN. &euro;{PRICE}
                    </button>
                </div>
            </div>

            {/* ════ QUEEN QUOTE ════ */}
            <div className="loc-section loc-section-alt" style={{ paddingTop: 70, paddingBottom: 70, animation: 'locBorder 5s ease infinite' }}>
                <div style={{ textAlign: 'center', maxWidth: 500, margin: '0 auto', position: 'relative', zIndex: 1 }}>
                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.7rem', fontWeight: 600, letterSpacing: 8, color: '#d4af6a', marginBottom: 28, textTransform: 'uppercase' }}>From the Queen</div>
                    <div style={{ fontFamily: 'Cormorant Garamond,Georgia,serif', fontSize: 'clamp(1.2rem,3.5vw,1.5rem)', fontStyle: 'italic', fontWeight: 300, lineHeight: 1.85, color: 'rgba(255,255,255,0.4)' }}>
                        You have thought about Locktober every single year. And every single year, you did <strong style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 400 }}>nothing.</strong><br/><br/>
                        You scrolled past it. You told yourself you would try it <strong style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 400 }}>next time.</strong> You spent October the same way you spent September. Unlocked. Alone. Unchanged.<br/><br/>
                        This year, I am offering you something no one else can. A real app. A real keyholder. 31 days of daily tasks, personal review, and zero way out.<br/><br/>
                        <strong style={{ color: '#d4af6a', fontWeight: 400 }}>5 spots left. This price disappears Monday.</strong>
                    </div>
                    <div style={{ marginTop: 28, fontFamily: 'Inter,sans-serif', fontSize: '0.5rem', fontWeight: 300, letterSpacing: 5, color: 'rgba(197,160,89,0.4)', textTransform: 'uppercase' }}>Karin</div>
                </div>
            </div>

            {/* ════ FINAL CTA ════ */}
            <div className="loc-anim" style={{ textAlign: 'center', paddingTop: 80, paddingBottom: 20 }}>
                <h2 style={{ fontFamily: 'Cinzel,serif', fontSize: 'clamp(1.4rem,4vw,2rem)', fontWeight: 600, letterSpacing: 3, color: 'rgba(255,255,255,0.8)', marginBottom: 10 }}>Buy now. Lock October 1st.</h2>
                <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '1.1rem', fontStyle: 'italic', fontWeight: 300, color: 'rgba(255,255,255,0.3)', marginBottom: 36 }}>Your spot is reserved today. Your cage locks October 1st.</div>
                <button className="loc-cta-btn" onClick={handleCheckout} style={{ padding: '22px 72px', background: 'linear-gradient(135deg,#d4af6a,#a07830)', color: '#000', border: 'none', cursor: 'pointer', fontFamily: 'Cinzel,serif', fontSize: 'clamp(0.65rem,2.5vw,0.85rem)', fontWeight: 700, letterSpacing: 5, textTransform: 'uppercase', boxShadow: '0 4px 40px rgba(197,160,89,0.4)' }}>
                    CLAIM MY SPOT &euro;{PRICE}
                </button>
                <div style={{ marginTop: 14, fontFamily: 'Inter,sans-serif', fontSize: '0.55rem', color: 'rgba(197,160,89,0.25)', letterSpacing: 3, animation: 'locPulse 3s ease infinite' }}>5 spots left. &euro;{PRICE} until Monday.</div>
            </div>

            {/* ════ FOOTER ════ */}
            <footer style={{ borderTop: '1px solid rgba(197,160,89,0.1)', padding: '40px 20px 32px', textAlign: 'center', marginTop: 80 }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 18 }}>
                    <a href="https://www.reddit.com/r/QKarin/" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, opacity: 0.5 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)"><path d="M12 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 01-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 01.042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 014.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 01.14-.197.35.35 0 01.238-.042l2.906.617a1.214 1.214 0 011.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 00-.231.094.33.33 0 000 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 000-.463.327.327 0 00-.462 0c-.545.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 00-.205-.094z"/></svg></a>
                    <a href="https://discord.gg/yaZdtReeyX" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, opacity: 0.5 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg></a>
                    <a href="https://x.com/QKarin_com" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, opacity: 0.5 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
                    <a href="https://www.loyalfans.com/qkarin" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, opacity: 0.5 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)"><path d="M12 2a10 10 0 1010 10A10 10 0 0012 2zm1 14.93V17a1 1 0 01-2 0v-.07A7.06 7.06 0 015 10a1 1 0 012 0 5 5 0 005 5 5 5 0 005-5 1 1 0 012 0 7.06 7.06 0 01-6 6.93zM12 9a1 1 0 111-1 1 1 0 01-1 1z"/></svg></a>
                    <a href="https://www.patreon.com/QKArin/posts/locktober-169936709?source=storefront" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, opacity: 0.5 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)"><path d="M14.82 2.41c3.96 0 7.18 3.24 7.18 7.21 0 3.96-3.22 7.18-7.18 7.18-3.97 0-7.21-3.22-7.21-7.18 0-3.97 3.24-7.21 7.21-7.21M2 21.6h3.5V2.41H2V21.6z"/></svg></a>
                </div>
                <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em' }}>&copy; 2023-2026 All rights reserved by Queen Karin.</div>
                <a href="/privacy" style={{ display: 'inline-block', marginTop: 14, fontFamily: 'Rajdhani,sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.15em', textTransform: 'uppercase', textDecoration: 'none' }}>Privacy Policy</a>
            </footer>

        </div>
        </div>

        {showPayment && (
            <PaymentModal
                amountEur={PRICE}
                label="LOCKTOBER PROGRAM"
                cardBody={{ memberId: userEmail || '', amount: PRICE }}
                cryptoApiPath="/api/keyholder/passimpay"
                cryptoStatusApiPath="/api/keyholder/passimpay-status"
                cryptoPayBody={{ tierId: 'loctober' }}
                cryptoStatusBody={{ tierId: 'loctober' }}
                confirmMessage="PAYMENT CONFIRMED. SEE YOU OCTOBER 1ST."
                throneUrl="https://throne.com/queenkarin/item/52b32815-98d6-47da-97ed-85ac83d16e58"
                patreonUrl="https://www.patreon.com/QKarin/posts/locktoberfest-169936709?source=storefront"
                onSuccess={() => { window.location.href = '/profile'; }}
                onClose={() => setShowPayment(false)}
            />
        )}
    </>);
}
