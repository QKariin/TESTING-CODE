"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { initProfileState } from '@/scripts/profile-state';
import {
    openGlobalView,
    openGlobalSection,
    closeGlobalSection,
    loadLeaderboardPreview,
    loadLeaderboard,
    sendGlobalMessage,
    sendGlobalQuickMessage,
    handleGlobalTalkKey,
    handleGlobalQuickKey,
    handleGlobalPhotoUpload,
    loadTalkFull,
    openQueenTab,
    openGalleryLightbox,
    setGlReply,
    cancelGlReply,
} from '@/scripts/global-view';
import { buyRealCoins, handleSubscribe } from '@/scripts/profile-logic';

const SUB_CARDS = [
    { tier: 'BASIC',     price: '€33',  id: 'basic',     rotY: '8deg',  defaultTransform: 'translateY(15px) scale(0.82) translateZ(-60px) rotateY(8deg)',  defaultZ: 2 },
    { tier: 'ROYAL',     price: '€77',  id: 'royal',     rotY: '0deg',  defaultTransform: 'translateY(-20px) scale(1.0) translateZ(0px) rotateY(0deg)',     defaultZ: 5 },
    { tier: 'OWNERSHIP', price: '€222', id: 'ownership', rotY: '-8deg', defaultTransform: 'translateY(15px) scale(0.82) translateZ(-60px) rotateY(-8deg)', defaultZ: 2 },
];

function onSubHover(hoveredId: string) {
    SUB_CARDS.forEach(c => {
        const el = document.getElementById(`exch-card-${c.id}`);
        if (!el) return;
        if (c.id === hoveredId) {
            el.style.transform = 'translateY(-30px) scale(1.08) translateZ(0px) rotateY(0deg)';
            el.style.filter = 'brightness(1.1)';
            el.style.zIndex = '10';
        } else {
            el.style.transform = `translateY(20px) scale(0.78) translateZ(-80px) rotateY(${c.rotY})`;
            el.style.filter = 'brightness(0.6)';
            el.style.zIndex = '1';
        }
    });
}

function onSubLeave() {
    SUB_CARDS.forEach(c => {
        const el = document.getElementById(`exch-card-${c.id}`);
        if (!el) return;
        el.style.transform = c.defaultTransform;
        el.style.filter = c.id === 'royal' ? 'brightness(1.0)' : 'brightness(0.85)';
        el.style.zIndex = String(c.defaultZ);
    });
}

export default function GlobalPage() {
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Expose functions window needs
        (window as any).openGlobalSection = openGlobalSection;
        (window as any).closeGlobalSection = closeGlobalSection;
        (window as any).buyRealCoins = buyRealCoins;
        (window as any).handleSubscribe = handleSubscribe;
        (window as any).loadLeaderboardPreview = loadLeaderboardPreview;
        (window as any).loadLeaderboard = loadLeaderboard;
        (window as any).sendGlobalMessage = sendGlobalMessage;
        (window as any).sendGlobalQuickMessage = sendGlobalQuickMessage;
        (window as any).handleGlobalTalkKey = handleGlobalTalkKey;
        (window as any).handleGlobalQuickKey = handleGlobalQuickKey;
        (window as any).handleGlobalPhotoUpload = handleGlobalPhotoUpload;
        (window as any).loadTalkFull = loadTalkFull;
        (window as any).openQueenTab = openQueenTab;
        (window as any).openGalleryLightbox = openGalleryLightbox;
        (window as any).setGlReply = setGlReply;
        (window as any).cancelGlReply = cancelGlReply;

        async function init() {
            try {
                const isLocal = window.location.hostname === 'localhost';
                if (isLocal) {
                    const res = await fetch('/api/slave-profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'pr.finsko@gmail.com', full: true }) });
                    const data = await res.json();
                    initProfileState(data);
                    setLoading(false);
                    setTimeout(() => openGlobalView(), 50);
                    return;
                }

                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) { window.location.href = '/login'; return; }

                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .maybeSingle();

                // If no profile row (e.g. admin/queen), init with auth email so send + isMe work
                initProfileState(profileData || { member_id: user.email, email: user.email, name: 'QUEEN' });
            } catch (err) {
                console.error('[GLOBAL] init error:', err);
            } finally {
                setLoading(false);
                setTimeout(() => openGlobalView(), 50);
            }
        }

        init();
    }, []);

    if (loading) return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#04040e', color: '#c5a059', fontFamily: 'Cinzel', letterSpacing: 4 }}>
            LOADING...
        </div>
    );

    return (
        <div style={{ width: '100vw', height: '100dvh', background: 'linear-gradient(160deg, #04040e 0%, #060612 60%, #08080f 100%)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* ── GLOBAL VIEW CONTAINER (global-view.ts targets #globalViewOverlay) ── */}
            <div id="globalViewOverlay" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid rgba(197,160,89,0.15)', flexShrink: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)' }}>
                    {/* Left: title + breadcrumb + back */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ fontFamily: 'Cinzel', fontSize: '0.85rem', color: '#c5a059', letterSpacing: '4px', fontWeight: 700 }}>GLOBAL</div>
                        <div id="globalBreadcrumb" style={{ fontFamily: 'Orbitron', fontSize: '0.42rem', color: 'rgba(197,160,89,0.45)', letterSpacing: '3px', borderLeft: '1px solid rgba(197,160,89,0.2)', paddingLeft: '12px' }}></div>
                        <button id="globalBackBtn" onClick={() => closeGlobalSection()} style={{ display: 'none', background: 'none', border: '1px solid rgba(197,160,89,0.3)', color: '#c5a059', fontFamily: 'Orbitron', fontSize: '0.45rem', padding: '4px 11px', cursor: 'pointer', borderRadius: '4px', letterSpacing: '1px' }}>← BACK</button>
                    </div>
                    {/* Right: back to dashboard */}
                    <div>
                        <button onClick={() => window.location.href = '/dashboard'} style={{ background: 'none', border: '1px solid rgba(197,160,89,0.3)', color: '#c5a059', fontFamily: 'Orbitron', fontSize: '0.5rem', padding: '5px 16px', cursor: 'pointer', borderRadius: '4px', letterSpacing: '1px' }}>← DASHBOARD</button>
                    </div>
                </div>

                {/* ── DASHBOARD GRID ── */}
                <div id="globalMainView" style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.7fr 1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '10px', padding: '10px', overflow: 'hidden', minHeight: 0 }}>

                    {/* TALK — big left column, full chat */}
                    <div style={{ gridRow: '1 / 3', display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '12px', overflow: 'hidden', minHeight: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                            <div style={{ width: '3px', height: '14px', background: 'rgba(74,222,128,0.7)', borderRadius: '2px' }}></div>
                            <span style={{ fontFamily: 'Orbitron', fontSize: '0.55rem', color: 'rgba(255,255,255,0.75)', letterSpacing: '2px' }}>GLOBAL TALK</span>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80', display: 'inline-block', flexShrink: 0 }}></span>
                        </div>
                        {/* Online users strip */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(74,222,128,0.03)', flexShrink: 0, minHeight: '46px', overflowX: 'auto' }}>
                            <div id="globalOnlineStrip" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}></div>
                        </div>
                        <div id="globalTalkFeed" style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingTop: '8px' }}></div>
                        <div style={{ display: 'flex', gap: '8px', padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, background: 'rgba(0,0,0,0.25)' }}>
                            <input id="globalTalkInput" type="text" placeholder="Say something to everyone..." onKeyDown={(e) => handleGlobalTalkKey(e as any)} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontFamily: 'Rajdhani', fontSize: '0.9rem', padding: '8px 12px', outline: 'none', borderRadius: '6px', minWidth: 0 }} />
                            <button onClick={() => sendGlobalMessage()} style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#c5a059,#8b6914)', border: 'none', color: '#000', fontFamily: 'Orbitron', fontSize: '0.48rem', fontWeight: 700, cursor: 'pointer', borderRadius: '6px', letterSpacing: '1px', flexShrink: 0 }}>SEND</button>
                        </div>
                    </div>

                    {/* LEADERBOARD — top right */}
                    <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(197,160,89,0.03)', border: '1px solid rgba(197,160,89,0.18)', borderRadius: '12px', overflow: 'hidden', minHeight: 0 }}>
                        <div style={{ padding: '10px 14px 0', flexShrink: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                    <div style={{ width: '3px', height: '14px', background: 'linear-gradient(#c5a059,#8b6914)', borderRadius: '2px' }}></div>
                                    <span style={{ fontFamily: 'Orbitron', fontSize: '0.52rem', color: '#c5a059', letterSpacing: '2px' }}>LEADERBOARD</span>
                                </div>
                                <button onClick={() => openGlobalSection('leaderboard')} style={{ background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.2)', color: '#c5a059', fontFamily: 'Orbitron', fontSize: '0.36rem', padding: '3px 8px', cursor: 'pointer', borderRadius: '3px', letterSpacing: '1px' }}>EXPAND ↗</button>
                            </div>
                            <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                                {(['today', 'weekly', 'monthly', 'alltime'] as const).map(p => (
                                    <button key={p} id={`lbChip_${p}`} onClick={() => loadLeaderboardPreview(p)} style={{ padding: '2px 7px', background: p === 'today' ? 'rgba(197,160,89,0.18)' : 'transparent', border: `1px solid ${p === 'today' ? 'rgba(197,160,89,0.4)' : 'rgba(255,255,255,0.07)'}`, color: p === 'today' ? '#c5a059' : 'rgba(255,255,255,0.3)', fontFamily: 'Orbitron', fontSize: '0.36rem', cursor: 'pointer', borderRadius: '3px', letterSpacing: '1px' }}>
                                        {p === 'alltime' ? 'ALL' : p.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                            <div style={{ height: '1px', background: 'rgba(197,160,89,0.1)', marginLeft: '-14px', marginRight: '-14px' }}></div>
                        </div>
                        <div id="globalPreview_leaderboard" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}></div>
                    </div>

                    {/* ACADEMY */}
                    <div style={{ display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, rgba(197,160,89,0.07), rgba(197,160,89,0.02))', border: '1px solid rgba(197,160,89,0.25)', borderRadius: '12px', overflow: 'hidden', minHeight: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', padding: '11px 14px', borderBottom: '1px solid rgba(197,160,89,0.12)', flexShrink: 0 }}>
                            <div style={{ width: '3px', height: '14px', background: '#c5a059', borderRadius: '2px', marginRight: '8px' }}></div>
                            <span style={{ fontFamily: 'Cinzel', fontSize: '0.55rem', color: '#c5a059', letterSpacing: '2px', fontWeight: 700 }}>ACADEMY</span>
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 10px', gap: '10px' }}>
                            <img src="/academy-obedience.png" alt="Obedience Academy" style={{ width: '85%', maxWidth: '240px' }} />
                            <span style={{ fontFamily: 'Cinzel', fontSize: '0.5rem', color: 'rgba(197,160,89,0.5)', letterSpacing: '3px', textTransform: 'uppercase' }}>Coming Soon</span>
                        </div>
                    </div>

                    {/* UPDATES */}
                    <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '12px', overflow: 'hidden', minHeight: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '3px', height: '14px', background: 'rgba(139,109,255,0.7)', borderRadius: '2px' }}></div>
                                <span style={{ fontFamily: 'Orbitron', fontSize: '0.52rem', color: 'rgba(255,255,255,0.7)', letterSpacing: '2px' }}>UPDATES</span>
                            </div>
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <button onClick={(e) => { e.stopPropagation(); document.getElementById('globalPhotoInput')?.click(); }} style={{ padding: '3px 8px', background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.25)', color: '#c5a059', fontFamily: 'Orbitron', fontSize: '0.36rem', cursor: 'pointer', borderRadius: '3px' }}>+ SHARE</button>
                                <button onClick={() => openGlobalSection('updates')} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)', fontFamily: 'Orbitron', fontSize: '0.36rem', padding: '3px 8px', cursor: 'pointer', borderRadius: '3px' }}>VIEW ↗</button>
                            </div>
                        </div>
                        <div id="globalPreview_updates" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}></div>
                    </div>

                    {/* CHALLENGES */}
                    <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(197,160,89,0.02)', border: '1px solid rgba(197,160,89,0.14)', borderRadius: '12px', overflow: 'hidden', minHeight: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', padding: '11px 14px', borderBottom: '1px solid rgba(197,160,89,0.08)', flexShrink: 0 }}>
                            <div style={{ width: '3px', height: '14px', background: '#c5a059', borderRadius: '2px', marginRight: '8px' }}></div>
                            <span style={{ fontFamily: 'Cinzel', fontSize: '0.55rem', color: '#c5a059', letterSpacing: '2px', fontWeight: 700 }}>CHALLENGES</span>
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', gap: '8px' }}>
                            <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: '#c5a059', letterSpacing: '4px', fontWeight: 700 }}>CHALLENGES</span>
                            <span style={{ fontFamily: 'Cinzel', fontSize: '0.5rem', color: 'rgba(197,160,89,0.5)', letterSpacing: '3px', textTransform: 'uppercase' }}>Coming Soon</span>
                        </div>
                    </div>

                </div>

                {/* ── EXPANDED PANELS ── */}
                <div id="gPanel_leaderboard" style={{ flex: 1, display: 'none', flexDirection: 'column', overflow: 'hidden', margin: '0 10px 10px' }}>
                    <div style={{ display: 'flex', gap: '8px', padding: '10px 0', flexShrink: 0, borderBottom: '1px solid rgba(197,160,89,0.1)' }}>
                        {(['today', 'alltime', 'weekly', 'monthly'] as const).map(p => (
                            <button key={p} id={`lbPeriod_${p}`} onClick={() => loadLeaderboard(p)} style={{ padding: '5px 16px', background: p === 'today' ? 'rgba(197,160,89,0.18)' : 'transparent', border: `1px solid ${p === 'today' ? 'rgba(197,160,89,0.45)' : 'rgba(255,255,255,0.08)'}`, color: p === 'today' ? '#c5a059' : 'rgba(255,255,255,0.35)', fontFamily: 'Orbitron', fontSize: '0.5rem', letterSpacing: '1px', cursor: 'pointer', borderRadius: '4px' }}>
                                {p === 'alltime' ? 'ALL TIME' : p.toUpperCase()}
                            </button>
                        ))}
                    </div>
                    <div id="leaderboardList" style={{ flex: 1, overflowY: 'auto' }}></div>
                </div>

                {/* gPanel_talk is unused — TALK is the main panel */}
                <div id="gPanel_talk" style={{ display: 'none' }}></div>

                <div id="gPanel_updates" style={{ flex: 1, display: 'none', flexDirection: 'column', overflow: 'hidden', margin: '0 10px 10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 0 10px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <button id="globalUploadBtn" onClick={() => document.getElementById('globalPhotoInput')?.click()} style={{ padding: '7px 18px', background: 'linear-gradient(135deg,#c5a059,#8b6914)', border: 'none', color: '#000', fontFamily: 'Orbitron', fontSize: '0.52rem', fontWeight: 700, cursor: 'pointer', borderRadius: '4px', letterSpacing: '1px' }}>+ SHARE PHOTO</button>
                    </div>
                    <div id="globalUpdatesGrid" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px 0' }}></div>
                </div>

                <div id="gPanel_spenders" style={{ flex: 1, display: 'none', flexDirection: 'column', overflow: 'hidden', margin: '0 10px 10px' }}>
                    <div id="spendersList" style={{ flex: 1, overflowY: 'auto' }}></div>
                </div>

                <div id="gPanel_queen" style={{ flex: 1, display: 'none', flexDirection: 'column', overflow: 'hidden', overflowY: 'auto', margin: '0 10px 10px' }}>
                    {/* Tab bar */}
                    <div style={{ display: 'flex', gap: 6, padding: '10px 12px 0', flexShrink: 0 }}>
                        <button id="queenTab_profile" onClick={() => (window as any).openQueenTab('profile')} style={{ background: 'rgba(197,160,89,0.18)', color: '#c5a059', border: '1px solid rgba(197,160,89,0.25)', fontFamily: 'Orbitron', fontSize: '0.5rem', padding: '6px 16px', letterSpacing: '2px', cursor: 'pointer', borderRadius: '4px', transition: 'all 0.15s' }}>PROFILE</button>
                        <button id="queenTab_gallery" onClick={() => (window as any).openQueenTab('gallery')} style={{ background: 'transparent', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'Orbitron', fontSize: '0.5rem', padding: '6px 16px', letterSpacing: '2px', cursor: 'pointer', borderRadius: '4px', transition: 'all 0.15s' }}>GALLERY</button>
                    </div>
                    {/* Profile content */}
                    <div id="queenProfileContent">
                        <div id="queenFullContent"></div>
                    </div>
                    {/* Gallery content */}
                    <div id="queenGalleryContent" style={{ display: 'none' }}></div>
                </div>

                {/* ── EXCHEQUER PANEL ── */}
                {/* NOTE: display toggled by openGlobalSection() DOM manipulation, not React state */}
                <div id="gPanel_exchequer" suppressHydrationWarning style={{ flex: 1, display: 'none', flexDirection: 'column', overflowY: 'auto', margin: '0 10px 10px', position: 'relative' }}>

                    {/* BG */}
                    <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at center, #18120a 0%, #0a0808 55%, #060606 100%)', opacity: 0.18, pointerEvents: 'none', zIndex: 0 }} />

                    <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 20px 80px', width: '100%' }}>

                        {/* ── SUBSCRIPTIONS ── */}
                        <div style={{ width: '100%', marginBottom: 50, display: 'flex', justifyContent: 'center' }}>
                            <div style={{ perspective: '1000px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 0, width: '100%', maxWidth: 900, paddingBottom: 20 }}>
                                {SUB_CARDS.map((sub, i) => (
                                    <div key={sub.id}
                                        id={`exch-card-${sub.id}`}
                                        onMouseEnter={() => onSubHover(sub.id)}
                                        onMouseLeave={() => onSubLeave()}
                                        style={{ position: 'relative', width: '26%', flexShrink: 0, marginLeft: i === 0 ? 0 : '-6%', transform: sub.defaultTransform, transition: 'all 0.4s cubic-bezier(0.23,1,0.32,1)', zIndex: sub.defaultZ, cursor: 'pointer', filter: sub.id === 'royal' ? 'brightness(1.0)' : 'brightness(0.85)', transformStyle: 'preserve-3d' }}>
                                        <div style={{ width: '100%', paddingBottom: '140%', background: 'linear-gradient(160deg,#1a1008,#0d0a04)', display: 'block' }} />
                                        <div style={{ position: 'absolute', top: '19%', left: '8%', right: '8%', display: 'flex', justifyContent: 'center' }}>
                                            <div style={{ fontFamily: 'Cinzel', fontSize: 'clamp(0.5rem,1.2vw,0.9rem)', color: '#d4af37', letterSpacing: 'clamp(2px,0.5vw,6px)', fontWeight: 'bold', textShadow: '0 2px 8px rgba(0,0,0,0.9)', whiteSpace: 'nowrap' }}>{sub.tier}</div>
                                        </div>
                                        <div style={{ position: 'absolute', top: '35%', left: '10%', right: '10%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                            <span style={{ fontFamily: 'Cinzel', fontSize: 'clamp(1.5rem,3.5vw,3rem)', fontWeight: 900, color: '#f3e5ab', textShadow: '0 4px 30px rgba(0,0,0,1), 0 0 20px rgba(212,175,55,0.3)', lineHeight: 1 }}>{sub.price}</span>
                                            <div style={{ fontFamily: 'Cinzel', fontSize: 'clamp(0.35rem,0.7vw,0.5rem)', color: '#d4af37', letterSpacing: 4 }}>/ MONTH</div>
                                        </div>
                                        <div onClick={() => handleSubscribe(sub.id)} style={{ position: 'absolute', bottom: '11%', left: '8%', right: '8%', display: 'flex', justifyContent: 'center', cursor: 'pointer' }}>
                                            <div style={{ fontFamily: 'Cinzel', fontSize: 'clamp(0.5rem,1.1vw,0.8rem)', color: '#f3e5ab', letterSpacing: 'clamp(2px,0.5vw,5px)', textShadow: '0 2px 8px rgba(0,0,0,0.9)', fontWeight: 'bold', whiteSpace: 'nowrap' }}>SUBSCRIBE</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ── DIVIDER TITLE ── */}
                        <div style={{ width: '100%', maxWidth: 900, display: 'flex', alignItems: 'center', margin: '0 0 30px' }}>
                            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.7))' }} />
                            <div style={{ padding: '0 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                                <div style={{ fontFamily: 'Cinzel', fontSize: '2rem', fontWeight: 900, letterSpacing: 8, background: 'linear-gradient(to bottom, #fff8d0, #c8960c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', whiteSpace: 'nowrap' }}>ROYAL EXCHEQUER</div>
                                <div style={{ fontFamily: 'Cinzel', fontSize: '0.6rem', color: 'rgba(212,175,55,0.6)', letterSpacing: 6 }}>THE EMPEROR'S TREASURY</div>
                            </div>
                            <div style={{ flex: 1, height: 1, background: 'linear-gradient(270deg, transparent, rgba(212,175,55,0.7))' }} />
                        </div>

                        {/* ── COIN PACKAGES ── */}
                        <div style={{ width: '100%', maxWidth: 900, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                            <div style={{ fontFamily: 'Cinzel', fontSize: '0.7rem', color: 'rgba(212,175,55,0.65)', letterSpacing: 6, marginBottom: 10 }}>TREASURY VAULT</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 18, width: '100%' }}>
                                {([
                                    { amount: '150,000', price: '€1,000', coins: 150000, badge: 'EMPEROR'    },
                                    { amount: '70,000',  price: '€500',   coins: 70000,  badge: 'BEST VALUE' },
                                    { amount: '30,000',  price: '€250',   coins: 30000,  badge: null         },
                                    { amount: '12,000',  price: '€100',   coins: 12000,  badge: null         },
                                    { amount: '5,500',   price: '€50',    coins: 5500,   badge: null         },
                                ]).map(pkg => (
                                    <div key={pkg.coins} onClick={() => buyRealCoins(pkg.coins)}
                                        style={{ position: 'relative', cursor: 'pointer', transition: 'transform 0.25s ease', width: 280, flexShrink: 0 }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.04)'; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; }}>
                                        <div style={{ width: '100%', paddingBottom: '120%', background: 'linear-gradient(160deg,#1a1008,#0d0a04)', display: 'block' }} />
                                        <div style={{ position: 'absolute', top: '16%', left: '18%', right: '18%', bottom: '20%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                            {pkg.badge && <div style={{ fontFamily: 'Cinzel', fontSize: '0.5rem', color: '#c8960c', letterSpacing: 2, border: '1px solid #c8960c', padding: '2px 6px', borderRadius: 2 }}>{pkg.badge}</div>}
                                            <i className="fas fa-coins" style={{ fontSize: '1.6rem', color: '#c5a059', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.9))' }}></i>
                                            <div style={{ fontFamily: 'Cinzel', fontSize: '1.2rem', fontWeight: 900, color: '#fff', letterSpacing: 1, textShadow: '0 3px 12px rgba(0,0,0,1)', lineHeight: 1 }}>{pkg.amount}</div>
                                            <div style={{ fontFamily: 'Cinzel', fontSize: '0.42rem', color: '#d4af37', letterSpacing: 3 }}>ROYAL SILVER</div>
                                            <div style={{ marginTop: 4, background: 'rgba(0,0,0,0.7)', border: '1px solid #c8960c', borderRadius: 2, padding: '4px 10px' }}>
                                                <span style={{ fontFamily: 'Cinzel', fontSize: '0.8rem', color: '#f3e5ab', fontWeight: 'bold' }}>{pkg.price}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>

                <input type="file" id="globalPhotoInput" accept="image/*,video/*" style={{ display: 'none' }} onChange={(e) => handleGlobalPhotoUpload(e.target as HTMLInputElement)} />
            </div>
        </div>
    );
}
