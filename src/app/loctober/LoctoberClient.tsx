"use client";

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import PaymentModal from '@/components/PaymentModal';

const PRICE = 111;
const REGULAR_PRICE = 199;

const FEATURES = [
    {
        title: 'Live Lock Timer',
        desc: 'A real countdown running inside the app. Days, hours, minutes. Ticking. No way to skip it, no way to pause it. I set the duration. You watch it run.',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.55)" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
        ),
    },
    {
        title: 'Daily Video Tasks',
        desc: 'Every morning, a new task appears in your dashboard. I tell you what to film. You record it and submit it through the app. 31 days of it.',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.55)" strokeWidth="1.5">
                <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
            </svg>
        ),
    },
    {
        title: 'Personal Review by Me',
        desc: 'I watch every submission. Not an algorithm. Not a chatbot. I personally review your task, approve or reject it, and decide your fate for the next day.',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.55)" strokeWidth="1.5">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
        ),
    },
    {
        title: 'Your Personal Dashboard',
        desc: 'Streaks, completion rate, points, task history. Everything tracked in one place. You see where you stand. I see how obedient you have been.',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.55)" strokeWidth="1.5">
                <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
            </svg>
        ),
    },
    {
        title: 'Penalty System',
        desc: 'Miss a task? I add penalty days. Submit something lazy? Rejected. Do it again. Skip a day entirely? I decide if you even deserve to continue.',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.55)" strokeWidth="1.5">
                <path d="M12 9v2m0 4h.01M5.07 19H19a2 2 0 001.75-2.95L13.75 4.1a2 2 0 00-3.5 0L3.32 16.05A2 2 0 005.07 19z" />
            </svg>
        ),
    },
    {
        title: 'I Control Your Lock',
        desc: 'This is not a self-managed timer you can reset when it gets hard. I hold the key inside the app. I add days. I remove days. Your release date is mine.',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.55)" strokeWidth="1.5">
                <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M12 3a4 4 0 00-4 4v4h8V7a4 4 0 00-4-4z" />
            </svg>
        ),
    },
    {
        title: 'Daily Chastity Check-in',
        desc: 'Every morning, before anything else, you prove you are still locked. Photo proof submitted through the app. No check-in means penalty.',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.55)" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
            </svg>
        ),
    },
    {
        title: 'No Other Domme Has This',
        desc: 'This is not a Lovense link. Not DMs on Instagram. This is custom-built keyholder software with a real dashboard, real tracking, and real control.',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="rgba(197,160,89,0.55)" strokeWidth="1.5">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
        ),
    },
];

export default function LoctoberClient() {
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [showPayment, setShowPayment] = useState(false);
    const [countdown, setCountdown] = useState({ d: 0, h: 0, m: 0, s: 0 });
    const sectionsRef = useRef<(HTMLDivElement | null)[]>([]);

    // Get user session
    useEffect(() => {
        (async () => {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (user?.email) setUserEmail(user.email);
            } catch {}
        })();
    }, []);

    // Countdown to Monday midnight (end of weekend pricing)
    useEffect(() => {
        const getTarget = () => {
            const now = new Date();
            const day = now.getDay(); // 0=Sun
            let daysUntilMon = (8 - day) % 7; // days until next Monday
            if (daysUntilMon === 0) daysUntilMon = 7;
            const target = new Date(now);
            target.setDate(now.getDate() + daysUntilMon);
            target.setHours(0, 0, 0, 0);
            return target.getTime();
        };
        const tick = () => {
            const diff = Math.max(0, getTarget() - Date.now());
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

    // Scroll-reveal observer
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((e) => {
                    if (e.isIntersecting) {
                        (e.target as HTMLElement).classList.add('loc-visible');
                        observer.unobserve(e.target);
                    }
                });
            },
            { threshold: 0.08 }
        );
        const t = setTimeout(() => {
            document.querySelectorAll('.loc-reveal').forEach((el) => observer.observe(el));
        }, 100);
        return () => { clearTimeout(t); observer.disconnect(); };
    }, []);

    const handleCheckout = () => {
        if (!userEmail) {
            window.location.href = `https://throne.qkarin.com/login?redirect=${encodeURIComponent('/loctober?pay=1')}`;
            return;
        }
        setShowPayment(true);
    };

    // Auto-open payment if redirected from login
    useEffect(() => {
        if (userEmail && typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.get('pay') === '1') {
                window.history.replaceState({}, '', '/loctober');
                setShowPayment(true);
            }
        }
    }, [userEmail]);

    const pad = (n: number) => String(n).padStart(2, '0');

    return (
        <>
            <style>{`
                /* ── BASE ── */
                html, body { background: #050505 !important; margin: 0; padding: 0; overflow-x: hidden; }
                *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

                .loc-wrap {
                    width: 100%; max-width: 720px; margin: 0 auto;
                    font-family: 'Inter', -apple-system, sans-serif;
                    color: #fff; -webkit-font-smoothing: antialiased;
                    position: relative; overflow: hidden;
                }

                /* ── ANIMATIONS ── */
                @keyframes locShimmer {
                    0% { background-position: -200% center; }
                    100% { background-position: 200% center; }
                }
                @keyframes locFadeUp {
                    from { opacity: 0; transform: translateY(40px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes locBorderGlow {
                    0%, 100% { border-color: rgba(197,160,89,0.08); }
                    50% { border-color: rgba(197,160,89,0.25); }
                }
                @keyframes locPulse {
                    0%, 100% { opacity: 0.35; }
                    50% { opacity: 1; }
                }
                @keyframes locTicker {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                @keyframes locCountGlow {
                    0%, 100% { text-shadow: 0 0 30px rgba(197,160,89,0.15); }
                    50% { text-shadow: 0 0 60px rgba(197,160,89,0.35); }
                }
                @keyframes locFloat {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-6px); }
                }

                /* ── SCROLL REVEAL ── */
                .loc-reveal {
                    opacity: 0; transform: translateY(40px);
                    transition: opacity 0.9s cubic-bezier(0.16,1,0.3,1), transform 0.9s cubic-bezier(0.16,1,0.3,1);
                }
                .loc-visible { opacity: 1; transform: translateY(0); }

                /* ── HERO ── */
                .loc-hero {
                    position: relative; width: 100%; height: 85vh; min-height: 560px; max-height: 800px;
                    overflow: hidden; background: #050505;
                }
                .loc-hero img {
                    width: 100%; height: 100%; object-fit: cover; object-position: center top;
                    filter: brightness(0.35) saturate(1.3) contrast(1.1);
                }
                .loc-hero-ov {
                    position: absolute; inset: 0; z-index: 2;
                    background:
                        radial-gradient(ellipse at center bottom, rgba(197,160,89,0.06) 0%, transparent 55%),
                        linear-gradient(180deg, rgba(5,5,5,0.1) 0%, transparent 25%, transparent 40%, rgba(5,5,5,0.6) 62%, rgba(5,5,5,0.95) 82%, #050505 100%);
                }
                .loc-hero-c {
                    position: absolute; bottom: 0; left: 0; right: 0;
                    padding: 0 44px 56px; z-index: 4; text-align: center;
                }
                .loc-hero-tag {
                    display: inline-block;
                    font-size: 9px; font-weight: 600; letter-spacing: 6px;
                    text-transform: uppercase; color: #050505;
                    background: linear-gradient(135deg, #d4af6a, #c5a059, #e8c97a, #c5a059);
                    background-size: 300% 100%;
                    animation: locFadeUp 1s ease 0.3s both, locShimmer 4s ease infinite;
                    padding: 8px 24px; margin-bottom: 24px;
                    font-family: 'Cinzel', serif;
                }
                .loc-hero-title {
                    font-family: 'Cormorant Garamond', Georgia, serif;
                    font-size: 56px; font-weight: 300; line-height: 1.05; color: #fff;
                    margin-bottom: 16px; animation: locFadeUp 1s ease 0.5s both;
                }
                .loc-hero-title em {
                    font-style: italic; color: #d4af6a; font-weight: 300;
                }
                .loc-hero-sub {
                    font-size: 13px; font-weight: 200; color: rgba(255,255,255,0.4);
                    letter-spacing: 3px; text-transform: uppercase;
                    animation: locFadeUp 1s ease 0.7s both;
                }

                /* ── TICKER ── */
                .loc-ticker {
                    background: linear-gradient(180deg, rgba(12,10,8,1) 0%, rgba(8,6,4,1) 100%);
                    border-top: 1px solid rgba(197,160,89,0.1);
                    border-bottom: 1px solid rgba(197,160,89,0.1);
                    padding: 14px 0; overflow: hidden; white-space: nowrap;
                }
                .loc-ticker-track {
                    display: inline-block; animation: locTicker 25s linear infinite;
                }
                .loc-ticker-track span {
                    font-family: 'Cinzel', serif; font-size: 11px; font-weight: 400;
                    letter-spacing: 4px; text-transform: uppercase;
                    color: rgba(255,255,255,0.3); padding: 0 16px;
                }
                .loc-ticker-track b { color: #d4af6a; font-weight: 600; }

                /* ── SEPARATOR ── */
                .loc-sep {
                    display: flex; align-items: center; justify-content: center; gap: 14px;
                    padding: 48px 0;
                }
                .loc-sep-l { width: 80px; height: 1px; background: linear-gradient(90deg, transparent, rgba(197,160,89,0.2), transparent); }
                .loc-sep-d { width: 5px; height: 5px; background: rgba(197,160,89,0.25); transform: rotate(45deg); flex-shrink: 0; }

                /* ── SECTION TEXT ── */
                .loc-txt {
                    padding: 0 48px; text-align: center;
                }
                .loc-txt-head {
                    display: block;
                    font-family: 'Cinzel', serif; font-size: 30px; font-weight: 600;
                    letter-spacing: 3px; color: #d4af6a; margin-bottom: 8px;
                }
                .loc-txt-sub {
                    display: block;
                    font-family: 'Cormorant Garamond', serif;
                    font-size: 16px; font-weight: 300; font-style: italic;
                    color: rgba(255,255,255,0.3); letter-spacing: 2px; margin-bottom: 28px;
                }
                .loc-txt p {
                    font-family: 'Cormorant Garamond', Georgia, serif;
                    font-size: 21px; font-weight: 300; line-height: 1.9;
                    color: rgba(255,255,255,0.5);
                }
                .loc-txt strong { color: rgba(255,255,255,0.9); font-weight: 400; }
                .loc-txt em { font-style: italic; color: rgba(232,201,122,0.7); }

                /* ── FEATURE GRID ── */
                .loc-features {
                    padding: 0 36px;
                    display: grid; grid-template-columns: 1fr 1fr; gap: 2px;
                }
                .loc-feat {
                    background: rgba(197,160,89,0.02);
                    border: 1px solid rgba(197,160,89,0.06);
                    padding: 32px 24px; text-align: center;
                    transition: all 0.5s cubic-bezier(0.16,1,0.3,1);
                }
                .loc-feat:hover {
                    background: rgba(197,160,89,0.04);
                    border-color: rgba(197,160,89,0.15);
                    transform: translateY(-2px);
                }
                .loc-feat-ico {
                    width: 36px; height: 36px; margin: 0 auto 16px;
                }
                .loc-feat-ico svg { width: 100%; height: 100%; }
                .loc-feat h4 {
                    font-family: 'Cinzel', serif; font-size: 10px; font-weight: 600;
                    letter-spacing: 3px; text-transform: uppercase;
                    color: rgba(255,255,255,0.75); margin-bottom: 10px;
                }
                .loc-feat p {
                    font-family: 'Cormorant Garamond', serif;
                    font-size: 15px; font-weight: 300; font-style: italic;
                    color: rgba(255,255,255,0.3); line-height: 1.6;
                }

                /* ── COUNTDOWN ── */
                .loc-countdown {
                    display: flex; justify-content: center; gap: 20px;
                    padding: 8px 0 0;
                }
                .loc-cd-unit { text-align: center; }
                .loc-cd-num {
                    font-family: 'Cinzel', serif; font-size: 42px; font-weight: 700;
                    color: #d4af6a; line-height: 1;
                    animation: locCountGlow 4s ease infinite;
                }
                .loc-cd-label {
                    font-family: 'Inter', sans-serif; font-size: 8px; font-weight: 400;
                    letter-spacing: 4px; text-transform: uppercase;
                    color: rgba(197,160,89,0.35); margin-top: 6px;
                }

                /* ── PRICE CARD ── */
                .loc-price {
                    margin: 0 36px;
                    position: relative;
                    background: linear-gradient(165deg, rgba(18,18,18,1) 0%, rgba(10,10,10,1) 50%, rgba(18,14,8,1) 100%);
                    border: 1px solid rgba(197,160,89,0.1);
                    overflow: hidden;
                    animation: locBorderGlow 5s ease infinite;
                }
                .loc-price-inner {
                    padding: 52px 40px 44px; text-align: center; position: relative; z-index: 1;
                }
                .loc-price-inner::before {
                    content: '';
                    position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%);
                    width: 300px; height: 200px;
                    background: radial-gradient(ellipse, rgba(197,160,89,0.04) 0%, transparent 70%);
                    pointer-events: none;
                }
                .loc-price-tag {
                    display: inline-block;
                    font-family: 'Inter', sans-serif; font-size: 8px; font-weight: 500;
                    letter-spacing: 5px; text-transform: uppercase; color: #050505;
                    background: linear-gradient(135deg, #d4af6a, #c5a059, #e8c97a, #c5a059);
                    background-size: 300% 100%; animation: locShimmer 4s ease infinite;
                    padding: 6px 18px; margin-bottom: 24px;
                }
                .loc-price-row {
                    display: flex; align-items: baseline; justify-content: center; gap: 14px;
                    margin-bottom: 10px;
                }
                .loc-price-cur {
                    font-family: 'Inter', sans-serif; font-size: 22px; font-weight: 300;
                    color: rgba(197,160,89,0.5); align-self: flex-start; margin-top: 14px;
                }
                .loc-price-num {
                    font-family: 'Cinzel', serif; font-size: 76px; font-weight: 700;
                    line-height: 1; letter-spacing: -2px; color: #d4af6a;
                    animation: locCountGlow 5s ease infinite;
                }
                .loc-price-old {
                    font-family: 'Cinzel', serif; font-size: 28px; font-weight: 400;
                    color: rgba(255,255,255,0.1);
                    text-decoration: line-through; text-decoration-color: rgba(197,160,89,0.3);
                }
                .loc-price-desc {
                    font-family: 'Cormorant Garamond', serif; font-size: 17px; font-weight: 300;
                    font-style: italic; color: rgba(255,255,255,0.3); margin-bottom: 18px;
                }
                .loc-price-save {
                    display: inline-block;
                    font-family: 'Cinzel', serif; font-size: 9px; font-weight: 600;
                    letter-spacing: 4px; text-transform: uppercase;
                    color: rgba(197,160,89,0.8);
                    border: 1px solid rgba(197,160,89,0.2); padding: 8px 20px;
                }

                /* ── CTA BUTTON ── */
                .loc-cta-wrap { text-align: center; padding: 32px 36px 0; }
                .loc-cta {
                    display: block; width: 100%; padding: 22px 0;
                    background: linear-gradient(135deg, #c5a059, #a8884a);
                    color: #050505; text-decoration: none;
                    font-family: 'Cinzel', serif; font-size: 13px; font-weight: 700;
                    letter-spacing: 6px; text-transform: uppercase;
                    border: none; cursor: pointer;
                    transition: all 0.5s cubic-bezier(0.16,1,0.3,1);
                    position: relative; overflow: hidden;
                }
                .loc-cta:hover {
                    background: linear-gradient(135deg, #d4af6a, #c5a059);
                    letter-spacing: 8px;
                    box-shadow: 0 4px 40px rgba(197,160,89,0.2);
                }
                .loc-cta::after {
                    content: ''; position: absolute;
                    top: 0; left: -100%; width: 100%; height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
                    transition: left 0.6s ease;
                }
                .loc-cta:hover::after { left: 100%; }
                .loc-cta-sub {
                    text-align: center; padding: 14px 36px 0;
                    font-size: 10px; font-weight: 300; letter-spacing: 3px;
                    text-transform: uppercase; color: rgba(197,160,89,0.3);
                }

                /* ── SPOTS ── */
                .loc-spots { text-align: center; padding: 40px 36px 0; }
                .loc-spots-n {
                    font-family: 'Cinzel', serif; font-size: 110px; font-weight: 700;
                    line-height: 1; letter-spacing: -4px;
                    background: linear-gradient(180deg, rgba(212,175,106,0.6) 0%, rgba(197,160,89,0.08) 100%);
                    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
                    animation: locFloat 4s ease infinite;
                }
                .loc-spots-label {
                    font-family: 'Cinzel', serif; font-size: 12px; font-weight: 600;
                    letter-spacing: 8px; text-transform: uppercase;
                    color: rgba(197,160,89,0.4); margin-top: 4px;
                }
                .loc-spots-p {
                    font-family: 'Cormorant Garamond', serif; font-size: 16px;
                    font-weight: 300; font-style: italic;
                    color: rgba(255,255,255,0.2); margin-top: 16px; line-height: 1.7;
                }

                /* ── QUOTE BOX ── */
                .loc-quote {
                    margin: 0 36px;
                    position: relative;
                    background: linear-gradient(165deg, rgba(18,18,18,1) 0%, rgba(10,10,10,1) 50%, rgba(18,14,8,1) 100%);
                    border: 1px solid rgba(197,160,89,0.1);
                    overflow: hidden; animation: locBorderGlow 5s ease infinite;
                }
                .loc-quote-inner {
                    padding: 52px 40px; text-align: center; position: relative; z-index: 1;
                }
                .loc-quote-label {
                    font-family: 'Cinzel', serif; font-size: 13px; font-weight: 600;
                    letter-spacing: 8px; text-transform: uppercase;
                    color: #d4af6a; margin-bottom: 28px;
                }
                .loc-quote-text {
                    font-family: 'Cormorant Garamond', Georgia, serif;
                    font-size: 24px; font-weight: 300; font-style: italic;
                    line-height: 1.8; color: rgba(255,255,255,0.4);
                    max-width: 480px; margin: 0 auto;
                }
                .loc-quote-text strong { color: rgba(255,255,255,0.85); font-weight: 400; }
                .loc-quote-sig {
                    margin-top: 24px; font-family: 'Inter', sans-serif;
                    font-size: 9px; font-weight: 300; letter-spacing: 5px;
                    text-transform: uppercase; color: rgba(197,160,89,0.4);
                }

                /* ── CORNER MARKS ── */
                .loc-cn { position: absolute; width: 24px; height: 24px; pointer-events: none; }
                .loc-cn::before, .loc-cn::after { content: ''; position: absolute; background: rgba(197,160,89,0.25); }
                .loc-cn::before { height: 1px; width: 100%; top: 0; left: 0; }
                .loc-cn::after { width: 1px; height: 100%; top: 0; left: 0; }
                .loc-cn-tl { top: -1px; left: -1px; }
                .loc-cn-tr { top: -1px; right: -1px; transform: scaleX(-1); }
                .loc-cn-bl { bottom: -1px; left: -1px; transform: scaleY(-1); }
                .loc-cn-br { bottom: -1px; right: -1px; transform: scale(-1); }

                /* ── FOOTER ── */
                .loc-footer {
                    border-top: 1px solid rgba(197,160,89,0.06);
                    padding: 40px; text-align: center; position: relative;
                }
                .loc-footer::before {
                    content: ''; position: absolute; top: -1px; left: 50%; transform: translateX(-50%);
                    width: 200px; height: 1px;
                    background: linear-gradient(90deg, transparent, rgba(197,160,89,0.2), transparent);
                }
                .loc-footer-brand {
                    font-family: 'Cormorant Garamond', Georgia, serif;
                    font-size: 16px; font-weight: 600; letter-spacing: 8px;
                    color: rgba(255,255,255,0.1); margin-bottom: 10px;
                }
                .loc-footer a {
                    font-size: 10px; color: rgba(255,255,255,0.08); text-decoration: none; letter-spacing: 3px;
                }

                /* ── STICKY HEADER ── */
                .loc-sticky {
                    position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
                    background: rgba(5,5,5,0.92); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
                    border-bottom: 1px solid rgba(197,160,89,0.1);
                    padding: 12px 20px;
                    display: flex; align-items: center; justify-content: space-between;
                    transform: translateY(-100%);
                    transition: transform 0.4s cubic-bezier(0.16,1,0.3,1);
                }
                .loc-sticky.show { transform: translateY(0); }
                .loc-sticky-price {
                    font-family: 'Cinzel', serif; font-size: 16px; font-weight: 700;
                    color: #d4af6a; letter-spacing: 1px;
                }
                .loc-sticky-old {
                    font-size: 12px; color: rgba(255,255,255,0.15);
                    text-decoration: line-through; margin-left: 8px;
                }
                .loc-sticky-btn {
                    padding: 10px 28px;
                    background: linear-gradient(135deg, #c5a059, #a8884a);
                    color: #050505; border: none; cursor: pointer;
                    font-family: 'Cinzel', serif; font-size: 9px; font-weight: 700;
                    letter-spacing: 4px; text-transform: uppercase;
                    transition: all 0.3s ease;
                }
                .loc-sticky-btn:hover {
                    background: linear-gradient(135deg, #d4af6a, #c5a059);
                }

                /* ── MOBILE ── */
                @media (max-width: 600px) {
                    .loc-hero { height: 75vh; min-height: 480px; }
                    .loc-hero-title { font-size: 40px; }
                    .loc-hero-c { padding: 0 24px 40px; }
                    .loc-txt { padding: 0 24px; }
                    .loc-txt-head { font-size: 24px; }
                    .loc-txt p { font-size: 18px; line-height: 1.8; }
                    .loc-features { grid-template-columns: 1fr; padding: 0 20px; }
                    .loc-feat { padding: 28px 20px; }
                    .loc-price { margin: 0 20px; }
                    .loc-price-inner { padding: 40px 24px 36px; }
                    .loc-price-num { font-size: 58px; }
                    .loc-price-old { font-size: 22px; }
                    .loc-cta-wrap { padding: 24px 20px 0; }
                    .loc-cta { font-size: 11px; letter-spacing: 4px; }
                    .loc-spots-n { font-size: 84px; }
                    .loc-quote { margin: 0 20px; }
                    .loc-quote-inner { padding: 36px 24px; }
                    .loc-quote-text { font-size: 20px; }
                    .loc-countdown { gap: 14px; }
                    .loc-cd-num { font-size: 32px; }
                    .loc-sep { padding: 36px 0; }
                    .loc-footer { padding: 30px 20px; }
                }
            `}</style>

            <div className="loc-wrap">

                {/* ── HERO ── */}
                <div className="loc-hero">
                    <img
                        src="https://ntrerrxudvgbjyscmdvh.supabase.co/storage/v1/object/public/media/promo/friday-hero-2.jpg"
                        alt=""
                    />
                    <div className="loc-hero-ov" />
                    <div className="loc-hero-c">
                        <div className="loc-hero-tag">Only 7 Spots</div>
                        <h1 className="loc-hero-title">
                            I'm Taking<br /><em>Your October.</em>
                        </h1>
                        <p className="loc-hero-sub">31 days locked. Daily video tasks. No way out.</p>
                    </div>
                </div>

                {/* ── TICKER ── */}
                <div className="loc-ticker">
                    <div className="loc-ticker-track">
                        <span><b>7</b> spots</span>
                        <span><b>31</b> days locked</span>
                        <span>daily <b>video</b> tasks</span>
                        <span>real <b>keyholder</b> app</span>
                        <span>no <b>release</b></span>
                        <span><b>7</b> spots</span>
                        <span><b>31</b> days locked</span>
                        <span>daily <b>video</b> tasks</span>
                        <span>real <b>keyholder</b> app</span>
                        <span>no <b>release</b></span>
                    </div>
                </div>

                {/* ── INTRO ── */}
                <div className="loc-sep"><div className="loc-sep-l" /><div className="loc-sep-d" /><div className="loc-sep-l" /></div>

                <div className="loc-txt loc-reveal">
                    <span className="loc-txt-head">Locktober.</span>
                    <span className="loc-txt-sub">and i built an entire app for it.</span>
                    <p>
                        I'm not some girl who asks you to send a selfie and calls it "keyholding."<br /><br />
                        I built a <strong>real keyholder application.</strong> A platform where I control your lock,
                        assign daily video tasks, review every submission personally,
                        and track your obedience across 31 days.<br /><br />
                        This October, I'm taking <strong>7 men</strong> through the entire month.
                        Locked from day one. No breaks. No mercy. No early release.
                    </p>
                </div>

                {/* ── CTA 1 ── */}
                <div className="loc-cta-wrap loc-reveal">
                    <button className="loc-cta" onClick={handleCheckout}>
                        Lock Up for &euro;{PRICE}
                    </button>
                </div>
                <div className="loc-cta-sub">7 spots. 31 days. Starts October 1st.</div>

                {/* ── FEATURES ── */}
                <div className="loc-sep"><div className="loc-sep-l" /><div className="loc-sep-d" /><div className="loc-sep-l" /></div>

                <div className="loc-txt loc-reveal" style={{ marginBottom: 32 }}>
                    <span className="loc-txt-head">How It Works</span>
                    <span className="loc-txt-sub">every feature of the keyholder app</span>
                </div>

                <div className="loc-features">
                    {FEATURES.map((f, i) => (
                        <div key={i} className="loc-feat loc-reveal" style={{ transitionDelay: `${i * 0.06}s` }}>
                            <div className="loc-feat-ico">{f.icon}</div>
                            <h4>{f.title}</h4>
                            <p>{f.desc}</p>
                        </div>
                    ))}
                </div>

                {/* ── CTA 2 ── */}
                <div className="loc-cta-wrap loc-reveal" style={{ paddingTop: 40 }}>
                    <button className="loc-cta" onClick={handleCheckout}>
                        Claim Your Spot
                    </button>
                </div>
                <div className="loc-cta-sub">&euro;{PRICE} this weekend. &euro;{REGULAR_PRICE} after Monday.</div>

                {/* ── PRICE + COUNTDOWN ── */}
                <div className="loc-sep"><div className="loc-sep-l" /><div className="loc-sep-d" /><div className="loc-sep-l" /></div>

                <div className="loc-price loc-reveal">
                    <div className="loc-cn loc-cn-tl" /><div className="loc-cn loc-cn-tr" /><div className="loc-cn loc-cn-bl" /><div className="loc-cn loc-cn-br" />
                    <div className="loc-price-inner">
                        <div className="loc-price-tag">This Weekend Only</div>
                        <div className="loc-price-row">
                            <span className="loc-price-cur">&euro;</span>
                            <span className="loc-price-num">{PRICE}</span>
                            <span className="loc-price-old">&euro;{REGULAR_PRICE}</span>
                        </div>
                        <div className="loc-price-desc">31 days of real control. Daily tasks. Personal review. Full app access.</div>
                        <div className="loc-price-save">Save &euro;{REGULAR_PRICE - PRICE}</div>

                        <div style={{ marginTop: 28 }}>
                            <div style={{
                                fontFamily: 'Cinzel, serif', fontSize: 9, fontWeight: 600,
                                letterSpacing: 5, textTransform: 'uppercase' as const,
                                color: 'rgba(197,160,89,0.4)', marginBottom: 12,
                            }}>
                                Price rises in
                            </div>
                            <div className="loc-countdown">
                                <div className="loc-cd-unit">
                                    <div className="loc-cd-num">{pad(countdown.d)}</div>
                                    <div className="loc-cd-label">Days</div>
                                </div>
                                <div className="loc-cd-unit">
                                    <div className="loc-cd-num">{pad(countdown.h)}</div>
                                    <div className="loc-cd-label">Hours</div>
                                </div>
                                <div className="loc-cd-unit">
                                    <div className="loc-cd-num">{pad(countdown.m)}</div>
                                    <div className="loc-cd-label">Min</div>
                                </div>
                                <div className="loc-cd-unit">
                                    <div className="loc-cd-num">{pad(countdown.s)}</div>
                                    <div className="loc-cd-label">Sec</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── CTA 3 ── */}
                <div className="loc-cta-wrap loc-reveal">
                    <button className="loc-cta" onClick={handleCheckout}>
                        Give Me Your October
                    </button>
                </div>
                <div className="loc-cta-sub">&euro;{PRICE} this weekend only. &euro;{REGULAR_PRICE} after Monday.</div>

                {/* ── SPOTS ── */}
                <div className="loc-sep"><div className="loc-sep-l" /><div className="loc-sep-d" /><div className="loc-sep-l" /></div>

                <div className="loc-spots loc-reveal">
                    <div className="loc-spots-n">7</div>
                    <div className="loc-spots-label">Spots Available</div>
                    <div className="loc-spots-p">Once I have my 7, enrollment closes. No waitlist. No exceptions.</div>
                </div>

                {/* ── QUEEN QUOTE ── */}
                <div className="loc-sep"><div className="loc-sep-l" /><div className="loc-sep-d" /><div className="loc-sep-l" /></div>

                <div className="loc-quote loc-reveal">
                    <div className="loc-cn loc-cn-tl" /><div className="loc-cn loc-cn-tr" /><div className="loc-cn loc-cn-bl" /><div className="loc-cn loc-cn-br" />
                    <div className="loc-quote-inner">
                        <div className="loc-quote-label">Listen</div>
                        <div className="loc-quote-text">
                            You have thought about Locktober every single year.
                            And every single year, you did <strong>nothing.</strong><br /><br />
                            You scrolled past it. You told yourself you would try it
                            <strong> next time.</strong> You spent October the same way
                            you spent September. Unlocked. Alone. Unchanged.<br /><br />
                            This year, I am offering you something different.
                            A real app. A real keyholder. A real 31-day program
                            with daily tasks, personal review, and zero way out.<br /><br />
                            <strong>7 spots. This price disappears Monday.</strong>
                        </div>
                        <div className="loc-quote-sig">Karin</div>
                    </div>
                </div>

                {/* ── FINAL CTA ── */}
                <div className="loc-cta-wrap loc-reveal" style={{ paddingTop: 44 }}>
                    <button className="loc-cta" onClick={handleCheckout}>
                        Lock Up for &euro;{PRICE}
                    </button>
                </div>
                <div className="loc-cta-sub">7 spots. &euro;{PRICE} this weekend. Starts Oct 1st.</div>

                {/* ── FOOTER ── */}
                <div className="loc-sep" style={{ paddingBottom: 0 }}>
                    <div className="loc-sep-l" /><div className="loc-sep-d" /><div className="loc-sep-l" />
                </div>
                <div className="loc-footer">
                    <div className="loc-footer-brand">QUEEN KARIN</div>
                    <a href="https://throne.qkarin.com" target="_blank" rel="noopener">throne.qkarin.com</a>
                </div>

            </div>

            {/* ── STICKY HEADER ── */}
            <StickyHeader onCheckout={handleCheckout} price={PRICE} regularPrice={REGULAR_PRICE} />

            {/* ── PAYMENT MODAL ── */}
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
                    throneUrl="https://throne.com/queenkarin"
                    onSuccess={() => { window.location.href = '/profile'; }}
                    onClose={() => setShowPayment(false)}
                />
            )}
        </>
    );
}

/* ── Sticky header that appears on scroll ── */
function StickyHeader({ onCheckout, price, regularPrice }: { onCheckout: () => void; price: number; regularPrice: number }) {
    const [show, setShow] = useState(false);

    useEffect(() => {
        const onScroll = () => setShow(window.scrollY > window.innerHeight * 0.7);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <div className={`loc-sticky ${show ? 'show' : ''}`}>
            <div>
                <span className="loc-sticky-price">&euro;{price}</span>
                <span className="loc-sticky-old">&euro;{regularPrice}</span>
            </div>
            <button className="loc-sticky-btn" onClick={onCheckout}>
                Lock Up Now
            </button>
        </div>
    );
}
