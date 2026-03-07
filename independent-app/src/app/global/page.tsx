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
} from '@/scripts/global-view';

export default function GlobalPage() {
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Expose functions window needs
        (window as any).openGlobalSection = openGlobalSection;
        (window as any).closeGlobalSection = closeGlobalSection;
        (window as any).loadLeaderboardPreview = loadLeaderboardPreview;
        (window as any).loadLeaderboard = loadLeaderboard;
        (window as any).sendGlobalMessage = sendGlobalMessage;
        (window as any).sendGlobalQuickMessage = sendGlobalQuickMessage;
        (window as any).handleGlobalTalkKey = handleGlobalTalkKey;
        (window as any).handleGlobalQuickKey = handleGlobalQuickKey;
        (window as any).handleGlobalPhotoUpload = handleGlobalPhotoUpload;

        async function init() {
            try {
                const isLocal = window.location.hostname === 'localhost';
                if (isLocal) {
                    const res = await fetch(`/api/slave-profile?email=${encodeURIComponent('pr.finsko@gmail.com')}&full=true`);
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
                    .eq('member_id', user.email)
                    .maybeSingle();

                if (profileData) initProfileState(profileData);
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
                    {/* Center: nav links back to profile */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {(['DASHBOARD', 'RECORDS', 'EXCHEQUER'] as const).map((label) => (
                            <button key={label} onClick={() => { window.location.href = '/profile'; }} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)', fontFamily: 'Orbitron', fontSize: '0.4rem', padding: '4px 12px', cursor: 'pointer', borderRadius: '4px', letterSpacing: '1px', transition: 'all 0.15s' }}
                                onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = 'rgba(197,160,89,0.4)'; (e.target as HTMLElement).style.color = '#c5a059'; }}
                                onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.35)'; }}>
                                {label}
                            </button>
                        ))}
                    </div>
                    {/* Right: back to profile */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button onClick={() => window.location.href = '/profile'} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)', fontFamily: 'Orbitron', fontSize: '0.5rem', padding: '4px 14px', cursor: 'pointer', borderRadius: '4px', letterSpacing: '1px' }}>← PROFILE</button>
                    </div>
                </div>

                {/* ── DASHBOARD GRID ── */}
                <div id="globalMainView" style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.7fr 1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '10px', padding: '10px', overflow: 'hidden', minHeight: 0 }}>

                    {/* LEADERBOARD */}
                    <div style={{ gridRow: '1 / 3', display: 'flex', flexDirection: 'column', background: 'rgba(197,160,89,0.03)', border: '1px solid rgba(197,160,89,0.18)', borderRadius: '12px', overflow: 'hidden' }}>
                        <div style={{ padding: '12px 16px 0', flexShrink: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '3px', height: '16px', background: 'linear-gradient(#c5a059,#8b6914)', borderRadius: '2px' }}></div>
                                    <span style={{ fontFamily: 'Orbitron', fontSize: '0.6rem', color: '#c5a059', letterSpacing: '3px' }}>LEADERBOARD</span>
                                </div>
                                <button onClick={() => openGlobalSection('leaderboard')} style={{ background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.2)', color: '#c5a059', fontFamily: 'Orbitron', fontSize: '0.38rem', padding: '3px 10px', cursor: 'pointer', borderRadius: '3px', letterSpacing: '1px' }}>EXPAND ↗</button>
                            </div>
                            <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                                {(['today', 'weekly', 'monthly', 'alltime'] as const).map(p => (
                                    <button key={p} id={`lbChip_${p}`} onClick={() => loadLeaderboardPreview(p)} style={{ padding: '3px 9px', background: p === 'today' ? 'rgba(197,160,89,0.18)' : 'transparent', border: `1px solid ${p === 'today' ? 'rgba(197,160,89,0.4)' : 'rgba(255,255,255,0.07)'}`, color: p === 'today' ? '#c5a059' : 'rgba(255,255,255,0.3)', fontFamily: 'Orbitron', fontSize: '0.4rem', cursor: 'pointer', borderRadius: '3px', letterSpacing: '1px' }}>
                                        {p === 'alltime' ? 'ALL TIME' : p.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                            <div style={{ height: '1px', background: 'rgba(197,160,89,0.1)', marginLeft: '-16px', marginRight: '-16px' }}></div>
                        </div>
                        <div id="globalPreview_leaderboard" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}></div>
                        <div style={{ flexShrink: 0, borderTop: '1px solid rgba(197,160,89,0.1)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
                            <div style={{ borderRight: '1px solid rgba(255,255,255,0.05)', padding: '8px 0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0 10px 6px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    <div style={{ width: '2px', height: '10px', background: 'rgba(74,222,128,0.7)', borderRadius: '1px', flexShrink: 0 }}></div>
                                    <span style={{ fontFamily: 'Orbitron', fontSize: '0.35rem', color: 'rgba(74,222,128,0.8)', letterSpacing: '1.5px' }}>BEST KNEELER</span>
                                </div>
                                <div id="lbMini_kneelers"></div>
                            </div>
                            <div style={{ borderRight: '1px solid rgba(255,255,255,0.05)', padding: '8px 0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0 10px 6px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    <div style={{ width: '2px', height: '10px', background: '#c5a059', borderRadius: '1px', flexShrink: 0 }}></div>
                                    <span style={{ fontFamily: 'Orbitron', fontSize: '0.35rem', color: 'rgba(197,160,89,0.85)', letterSpacing: '1.5px' }}>BEST SPENDER</span>
                                </div>
                                <div id="lbMini_spenders"></div>
                            </div>
                            <div style={{ padding: '8px 0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0 10px 6px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    <div style={{ width: '2px', height: '10px', background: 'rgba(255,120,80,0.8)', borderRadius: '1px', flexShrink: 0 }}></div>
                                    <span style={{ fontFamily: 'Orbitron', fontSize: '0.35rem', color: 'rgba(255,140,100,0.8)', letterSpacing: '1.5px' }}>STREAK</span>
                                </div>
                                <div id="lbMini_streakers"></div>
                            </div>
                        </div>
                    </div>

                    {/* TALK */}
                    <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '12px', overflow: 'hidden', minHeight: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '3px', height: '14px', background: 'rgba(74,222,128,0.7)', borderRadius: '2px' }}></div>
                                <span style={{ fontFamily: 'Orbitron', fontSize: '0.52rem', color: 'rgba(255,255,255,0.7)', letterSpacing: '2px' }}>TALK</span>
                                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80', display: 'inline-block' }}></span>
                            </div>
                            <button onClick={() => openGlobalSection('talk')} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)', fontFamily: 'Orbitron', fontSize: '0.36rem', padding: '3px 8px', cursor: 'pointer', borderRadius: '3px' }}>OPEN ↗</button>
                        </div>
                        <div id="globalPreview_talk" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}></div>
                        <div style={{ display: 'flex', gap: '6px', padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, background: 'rgba(0,0,0,0.2)' }}>
                            <input id="globalQuickInput" type="text" placeholder="Quick message..." onKeyDown={(e) => handleGlobalQuickKey(e as any)} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: '#fff', fontFamily: 'Rajdhani', fontSize: '0.8rem', padding: '5px 9px', outline: 'none', borderRadius: '4px', minWidth: 0 }} />
                            <button onClick={() => sendGlobalQuickMessage()} style={{ padding: '5px 11px', background: 'rgba(197,160,89,0.15)', border: '1px solid rgba(197,160,89,0.3)', color: '#c5a059', fontFamily: 'Orbitron', fontSize: '0.42rem', cursor: 'pointer', borderRadius: '4px', flexShrink: 0, fontWeight: 700 }}>→</button>
                        </div>
                    </div>

                    {/* QUEEN KARIN */}
                    <div style={{ display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, rgba(197,160,89,0.07), rgba(197,160,89,0.02))', border: '1px solid rgba(197,160,89,0.25)', borderRadius: '12px', overflow: 'hidden', minHeight: 0, cursor: 'pointer' }} onClick={() => openGlobalSection('queen')}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', borderBottom: '1px solid rgba(197,160,89,0.12)', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '3px', height: '14px', background: '#c5a059', borderRadius: '2px' }}></div>
                                <span style={{ fontFamily: 'Cinzel', fontSize: '0.55rem', color: '#c5a059', letterSpacing: '2px', fontWeight: 700 }}>QUEEN KARIN</span>
                            </div>
                            <span style={{ fontFamily: 'Orbitron', fontSize: '0.36rem', color: 'rgba(197,160,89,0.45)', background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.18)', padding: '3px 8px', borderRadius: '3px' }}>VIEW ↗</span>
                        </div>
                        <div id="globalPreview_queen" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}></div>
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

                    {/* BEST SPENDER */}
                    <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(197,160,89,0.02)', border: '1px solid rgba(197,160,89,0.14)', borderRadius: '12px', overflow: 'hidden', minHeight: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', borderBottom: '1px solid rgba(197,160,89,0.08)', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '3px', height: '14px', background: '#c5a059', borderRadius: '2px' }}></div>
                                <span style={{ fontFamily: 'Orbitron', fontSize: '0.52rem', color: '#c5a059', letterSpacing: '2px' }}>BEST SPENDER</span>
                            </div>
                            <button onClick={() => openGlobalSection('spenders')} style={{ background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.2)', color: 'rgba(197,160,89,0.5)', fontFamily: 'Orbitron', fontSize: '0.36rem', padding: '3px 8px', cursor: 'pointer', borderRadius: '3px' }}>FULL ↗</button>
                        </div>
                        <div id="globalPreview_spenders" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}></div>
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

                <div id="gPanel_talk" style={{ flex: 1, display: 'none', flexDirection: 'column', overflow: 'hidden', margin: '0 10px 10px' }}>
                    <div id="globalTalkFeed" style={{ flex: 1, overflowY: 'auto', paddingTop: '12px' }}></div>
                    <div style={{ display: 'flex', gap: '10px', padding: '12px 0 0', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
                        <input id="globalTalkInput" type="text" placeholder="Say something to everyone..." onKeyDown={(e) => handleGlobalTalkKey(e as any)} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontFamily: 'Rajdhani', fontSize: '0.9rem', padding: '9px 14px', outline: 'none', borderRadius: '6px' }} />
                        <button onClick={() => sendGlobalMessage()} style={{ padding: '9px 20px', background: 'linear-gradient(135deg,#c5a059,#8b6914)', border: 'none', color: '#000', fontFamily: 'Orbitron', fontSize: '0.55rem', fontWeight: 700, cursor: 'pointer', borderRadius: '6px', letterSpacing: '1px', flexShrink: 0 }}>SEND</button>
                    </div>
                </div>

                <div id="gPanel_updates" style={{ flex: 1, display: 'none', flexDirection: 'column', overflow: 'hidden', margin: '0 10px 10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 0 10px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <button id="globalUploadBtn" onClick={() => document.getElementById('globalPhotoInput')?.click()} style={{ padding: '7px 18px', background: 'linear-gradient(135deg,#c5a059,#8b6914)', border: 'none', color: '#000', fontFamily: 'Orbitron', fontSize: '0.52rem', fontWeight: 700, cursor: 'pointer', borderRadius: '4px', letterSpacing: '1px' }}>+ SHARE PHOTO</button>
                    </div>
                    <div id="globalUpdatesGrid" style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', padding: '12px 0', alignContent: 'start' }}></div>
                </div>

                <div id="gPanel_spenders" style={{ flex: 1, display: 'none', flexDirection: 'column', overflow: 'hidden', margin: '0 10px 10px' }}>
                    <div id="spendersList" style={{ flex: 1, overflowY: 'auto' }}></div>
                </div>

                <div id="gPanel_queen" style={{ flex: 1, display: 'none', flexDirection: 'column', overflow: 'hidden', overflowY: 'auto', margin: '0 10px 10px' }}>
                    <div id="queenFullContent"></div>
                </div>

                <input type="file" id="globalPhotoInput" accept="image/*,video/*" style={{ display: 'none' }} onChange={(e) => handleGlobalPhotoUpload(e.target as HTMLInputElement)} />
            </div>
        </div>
    );
}
