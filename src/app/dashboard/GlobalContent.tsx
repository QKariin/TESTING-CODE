'use client';

import { useEffect } from 'react';
import { initProfileState } from '@/scripts/profile-state';
import {
    openGlobalView,
    openGlobalSection,
    closeGlobalSection,
    loadLeaderboardPreview,
    loadLeaderboard,
    sendGlobalMessage,
    handleGlobalTalkKey,
    handleGlobalPhotoUpload,
    handleGlobalChatPhotoUpload,
    loadTalkFull,
    openQueenTab,
    openGalleryLightbox,
    setGlReply,
    cancelGlReply,
    openGifPicker,
    closeGifPicker,
} from '@/scripts/global-view';

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

const SVG_CAMERA = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
        <circle cx="12" cy="13" r="4"/>
    </svg>
);

export function GlobalContent({ onClose, userEmail }: { onClose: () => void; userEmail: string | null }) {
    useEffect(() => {
        (window as any).openGlobalSection = openGlobalSection;
        (window as any).closeGlobalSection = closeGlobalSection;
        (window as any).loadLeaderboardPreview = loadLeaderboardPreview;
        (window as any).loadLeaderboard = loadLeaderboard;
        (window as any).sendGlobalMessage = sendGlobalMessage;
        (window as any).handleGlobalTalkKey = handleGlobalTalkKey;
        (window as any).handleGlobalPhotoUpload = handleGlobalPhotoUpload;
        (window as any).handleGlobalChatPhotoUpload = handleGlobalChatPhotoUpload;
        (window as any).loadTalkFull = loadTalkFull;
        (window as any).openQueenTab = openQueenTab;
        (window as any).openGalleryLightbox = openGalleryLightbox;
        (window as any).setGlReply = setGlReply;
        (window as any).cancelGlReply = cancelGlReply;
        (window as any).openGifPicker = openGifPicker;
        (window as any).closeGifPicker = closeGifPicker;

        initProfileState({ member_id: userEmail || 'queen@qkarin.com', email: userEmail, name: 'QUEEN' });
        setTimeout(() => openGlobalView(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: '#04040e', display: 'flex', flexDirection: 'column' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid rgba(var(--gold-rgb),0.15)', flexShrink: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                        </svg>
                        <div style={{ fontFamily: 'Orbitron', fontSize: '0.85rem', color: 'var(--gold)', letterSpacing: '4px', fontWeight: 700 }}>GLOBAL</div>
                    </div>
                    <div id="globalBreadcrumb" style={{ fontFamily: 'Orbitron', fontSize: '0.42rem', color: 'rgba(var(--gold-rgb),0.45)', letterSpacing: '3px', borderLeft: '1px solid rgba(var(--gold-rgb),0.2)', paddingLeft: '12px' }}></div>
                    <button id="globalBackBtn" onClick={() => closeGlobalSection()} style={{ display: 'none', background: 'none', border: '1px solid rgba(var(--gold-rgb),0.3)', color: 'var(--gold)', fontFamily: 'Orbitron', fontSize: '0.45rem', padding: '4px 11px', cursor: 'pointer', borderRadius: '4px', letterSpacing: '1px' }}>← BACK</button>
                </div>
                <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.45)', fontFamily: 'Orbitron', fontSize: '0.45rem', padding: '5px 14px', cursor: 'pointer', borderRadius: '4px', letterSpacing: '1px' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 5 5 12 12 19"/></svg>
                    CLOSE
                </button>
            </div>

            {/* Global view */}
            <div id="globalViewOverlay" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

                {/* Main grid */}
                <div id="globalMainView" style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.7fr 1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '10px', padding: '10px', overflow: 'hidden', minHeight: 0 }}>

                    {/* TALK */}
                    <div style={{ gridRow: '1 / 3', display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '12px', overflow: 'hidden', minHeight: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                            <div style={{ width: '3px', height: '14px', background: 'rgba(74,222,128,0.7)', borderRadius: '2px' }}></div>
                            <span style={{ fontFamily: 'Orbitron', fontSize: '0.55rem', color: 'rgba(255,255,255,0.75)', letterSpacing: '2px' }}>GLOBAL TALK</span>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80', display: 'inline-block', flexShrink: 0 }}></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(120,120,120,0.03)', flexShrink: 0, minHeight: '70px', overflowX: 'auto' }}>
                            <div id="globalOnlineStrip" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'nowrap' }}></div>
                        </div>
                        <div id="globalTalkFeed" style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingTop: '8px' }}></div>
                        <div style={{ display: 'flex', gap: '8px', padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, background: 'rgba(0,0,0,0.25)' }}>
                            <input id="globalTalkPhotoInput" type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => (window as any).handleGlobalChatPhotoUpload?.(e.target)} />
                            <input id="globalTalkInput" type="text" placeholder="Say something to everyone..." onKeyDown={(e) => handleGlobalTalkKey(e as any)} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontFamily: 'Rajdhani', fontSize: '0.9rem', padding: '8px 12px', outline: 'none', borderRadius: '6px', minWidth: 0 }} />
                            <button onClick={() => document.getElementById('globalTalkPhotoInput')?.click()} title="Send photo" style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)', cursor: 'pointer', borderRadius: '6px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {SVG_CAMERA}
                            </button>
                            <button onClick={() => openGifPicker()} title="Send GIF" style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontFamily: 'Orbitron', fontSize: '0.42rem', fontWeight: 700, cursor: 'pointer', borderRadius: '6px', letterSpacing: '1px', flexShrink: 0 }}>GIF</button>
                            <button onClick={() => sendGlobalMessage()} style={{ padding: '8px 18px', background: 'linear-gradient(135deg,var(--gold),var(--accent))', border: 'none', color: '#000', fontFamily: 'Orbitron', fontSize: '0.48rem', fontWeight: 700, cursor: 'pointer', borderRadius: '6px', letterSpacing: '1px', flexShrink: 0 }}>SEND</button>
                        </div>
                    </div>

                    {/* LEADERBOARD */}
                    <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(var(--gold-rgb),0.03)', border: '1px solid rgba(var(--gold-rgb),0.18)', borderRadius: '12px', overflow: 'hidden', minHeight: 0 }}>
                        <div style={{ padding: '10px 14px 0', flexShrink: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                    <div style={{ width: '3px', height: '14px', background: 'linear-gradient(var(--gold),var(--accent))', borderRadius: '2px' }}></div>
                                    <span style={{ fontFamily: 'Orbitron', fontSize: '0.52rem', color: 'var(--gold)', letterSpacing: '2px' }}>LEADERBOARD</span>
                                </div>
                                <button onClick={() => openGlobalSection('leaderboard')} style={{ background: 'rgba(var(--gold-rgb),0.08)', border: '1px solid rgba(var(--gold-rgb),0.2)', color: 'var(--gold)', fontFamily: 'Orbitron', fontSize: '0.36rem', padding: '3px 8px', cursor: 'pointer', borderRadius: '3px', letterSpacing: '1px' }}>EXPAND</button>
                            </div>
                            <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                                {(['today', 'weekly', 'monthly', 'alltime'] as const).map(p => (
                                    <button key={p} id={`lbChip_${p}`} onClick={() => loadLeaderboardPreview(p)} style={{ padding: '2px 7px', background: p === 'today' ? 'rgba(var(--gold-rgb),0.18)' : 'transparent', border: `1px solid ${p === 'today' ? 'rgba(var(--gold-rgb),0.4)' : 'rgba(255,255,255,0.07)'}`, color: p === 'today' ? 'var(--gold)' : 'rgba(255,255,255,0.3)', fontFamily: 'Orbitron', fontSize: '0.36rem', cursor: 'pointer', borderRadius: '3px', letterSpacing: '1px' }}>
                                        {p === 'alltime' ? 'ALL' : p.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                            <div style={{ height: '1px', background: 'rgba(var(--gold-rgb),0.1)', marginLeft: '-14px', marginRight: '-14px' }}></div>
                        </div>
                        <div id="globalPreview_leaderboard" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}></div>
                    </div>

                    {/* ACADEMY */}
                    <div style={{ display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, rgba(var(--gold-rgb),0.07), rgba(var(--gold-rgb),0.02))', border: '1px solid rgba(var(--gold-rgb),0.25)', borderRadius: '12px', overflow: 'hidden', minHeight: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', padding: '11px 14px', borderBottom: '1px solid rgba(var(--gold-rgb),0.12)', flexShrink: 0 }}>
                            <div style={{ width: '3px', height: '14px', background: 'var(--gold)', borderRadius: '2px', marginRight: '8px' }}></div>
                            <span style={{ fontFamily: 'Orbitron', fontSize: '0.55rem', color: 'var(--gold)', letterSpacing: '2px', fontWeight: 700 }}>ACADEMY</span>
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 10px', gap: '10px' }}>
                            <img src="/academy-obedience.png" alt="Obedience Academy" style={{ width: '85%', maxWidth: '240px' }} />
                            <span style={{ fontFamily: 'Orbitron', fontSize: '0.5rem', color: 'rgba(var(--gold-rgb),0.5)', letterSpacing: '3px', textTransform: 'uppercase' }}>Coming Soon</span>
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
                                <button onClick={(e) => { e.stopPropagation(); document.getElementById('globalPhotoInput')?.click(); }} style={{ padding: '3px 8px', background: 'rgba(var(--gold-rgb),0.08)', border: '1px solid rgba(var(--gold-rgb),0.25)', color: 'var(--gold)', fontFamily: 'Orbitron', fontSize: '0.36rem', cursor: 'pointer', borderRadius: '3px' }}>+ SHARE</button>
                                <button onClick={() => openGlobalSection('updates')} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)', fontFamily: 'Orbitron', fontSize: '0.36rem', padding: '3px 8px', cursor: 'pointer', borderRadius: '3px' }}>VIEW</button>
                            </div>
                        </div>
                        <div id="globalPreview_updates" style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px' }}></div>
                    </div>

                    {/* CHALLENGES */}
                    <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(74,222,128,0.03)', border: '1px solid rgba(74,222,128,0.18)', borderRadius: '12px', overflow: 'hidden', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderBottom: '1px solid rgba(74,222,128,0.1)', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <div style={{ width: '3px', height: '14px', background: '#4ade80', borderRadius: '2px', marginRight: '8px' }}></div>
                                <span style={{ fontFamily: 'Orbitron', fontSize: '0.55rem', color: '#4ade80', letterSpacing: '2px', fontWeight: 700 }}>CHALLENGES</span>
                            </div>
                            <a href="/dashboard/challenges" style={{ fontFamily: 'Orbitron', fontSize: '0.36rem', color: 'rgba(74,222,128,0.5)', letterSpacing: '1px', textDecoration: 'none' }}>MANAGE</a>
                        </div>
                        <div id="globalPreview_challenges"></div>
                    </div>

                </div>

                {/* Expanded panels */}
                <div id="gPanel_leaderboard" style={{ flex: 1, display: 'none', flexDirection: 'column', overflow: 'hidden', margin: '0 10px 10px' }}>
                    <div style={{ display: 'flex', gap: '8px', padding: '10px 0', flexShrink: 0, borderBottom: '1px solid rgba(var(--gold-rgb),0.1)' }}>
                        {(['today', 'alltime', 'weekly', 'monthly'] as const).map(p => (
                            <button key={p} id={`lbPeriod_${p}`} onClick={() => loadLeaderboard(p)} style={{ padding: '5px 16px', background: p === 'today' ? 'rgba(var(--gold-rgb),0.18)' : 'transparent', border: `1px solid ${p === 'today' ? 'rgba(var(--gold-rgb),0.45)' : 'rgba(255,255,255,0.08)'}`, color: p === 'today' ? 'var(--gold)' : 'rgba(255,255,255,0.35)', fontFamily: 'Orbitron', fontSize: '0.5rem', letterSpacing: '1px', cursor: 'pointer', borderRadius: '4px' }}>
                                {p === 'alltime' ? 'ALL TIME' : p.toUpperCase()}
                            </button>
                        ))}
                    </div>
                    <div id="leaderboardList" style={{ flex: 1, overflowY: 'auto' }}></div>
                </div>

                <div id="gPanel_talk" style={{ display: 'none' }}></div>

                <div id="gPanel_updates" style={{ flex: 1, display: 'none', flexDirection: 'column', overflow: 'hidden', margin: '0 10px 10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 0 10px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <button id="globalUploadBtn" onClick={() => document.getElementById('globalPhotoInput')?.click()} style={{ padding: '7px 18px', background: 'linear-gradient(135deg,var(--gold),var(--accent))', border: 'none', color: '#000', fontFamily: 'Orbitron', fontSize: '0.52rem', fontWeight: 700, cursor: 'pointer', borderRadius: '4px', letterSpacing: '1px' }}>+ SHARE PHOTO</button>
                    </div>
                    <div id="globalUpdatesGrid" style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', padding: '12px 0', alignContent: 'flex-start' }}></div>
                </div>

                <div id="gPanel_spenders" style={{ flex: 1, display: 'none', flexDirection: 'column', overflow: 'hidden', margin: '0 10px 10px' }}>
                    <div id="spendersList" style={{ flex: 1, overflowY: 'auto' }}></div>
                </div>

                <div id="gPanel_queen" style={{ flex: 1, display: 'none', flexDirection: 'column', overflow: 'hidden', overflowY: 'auto', margin: '0 10px 10px' }}>
                    <div style={{ display: 'flex', gap: 6, padding: '10px 12px 0', flexShrink: 0 }}>
                        <button id="queenTab_profile" onClick={() => (window as any).openQueenTab('profile')} style={{ background: 'rgba(var(--gold-rgb),0.18)', color: 'var(--gold)', border: '1px solid rgba(var(--gold-rgb),0.25)', fontFamily: 'Orbitron', fontSize: '0.5rem', padding: '6px 16px', letterSpacing: '2px', cursor: 'pointer', borderRadius: '4px', transition: 'all 0.15s' }}>PROFILE</button>
                        <button id="queenTab_gallery" onClick={() => (window as any).openQueenTab('gallery')} style={{ background: 'transparent', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'Orbitron', fontSize: '0.5rem', padding: '6px 16px', letterSpacing: '2px', cursor: 'pointer', borderRadius: '4px', transition: 'all 0.15s' }}>GALLERY</button>
                    </div>
                    <div id="queenProfileContent"><div id="queenFullContent"></div></div>
                    <div id="queenGalleryContent" style={{ display: 'none' }}></div>
                </div>

                <div id="gPanel_exchequer" suppressHydrationWarning style={{ flex: 1, display: 'none', flexDirection: 'column', overflowY: 'auto', margin: '0 10px 10px', position: 'relative' }}>
                    <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at center, #18120a 0%, #0a0808 55%, #060606 100%)', opacity: 0.18, pointerEvents: 'none', zIndex: 0 }} />
                    <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 20px 80px', width: '100%' }}>
                        <div style={{ width: '100%', marginBottom: 50, display: 'flex', justifyContent: 'center' }}>
                            <div style={{ perspective: '1000px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 0, width: '100%', maxWidth: 900, paddingBottom: 20 }}>
                                {SUB_CARDS.map((sub, i) => (
                                    <div key={sub.id} id={`exch-card-${sub.id}`}
                                        onMouseEnter={() => onSubHover(sub.id)}
                                        onMouseLeave={() => onSubLeave()}
                                        style={{ position: 'relative', width: '26%', flexShrink: 0, marginLeft: i === 0 ? 0 : '-6%', transform: sub.defaultTransform, transition: 'all 0.4s cubic-bezier(0.23,1,0.32,1)', zIndex: sub.defaultZ, cursor: 'pointer', filter: sub.id === 'royal' ? 'brightness(1.0)' : 'brightness(0.85)', transformStyle: 'preserve-3d' }}>
                                        <div style={{ width: '100%', paddingBottom: '140%', background: 'linear-gradient(160deg,#1a1008,#0d0a04)', display: 'block' }} />
                                        <div style={{ position: 'absolute', top: '19%', left: '8%', right: '8%', display: 'flex', justifyContent: 'center' }}>
                                            <div style={{ fontFamily: 'Orbitron', fontSize: 'clamp(0.5rem,1.2vw,0.9rem)', color: '#d4af37', letterSpacing: 'clamp(2px,0.5vw,6px)', fontWeight: 'bold', textShadow: '0 2px 8px rgba(0,0,0,0.9)', whiteSpace: 'nowrap' }}>{sub.tier}</div>
                                        </div>
                                        <div style={{ position: 'absolute', top: '35%', left: '10%', right: '10%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                            <span style={{ fontFamily: 'Orbitron', fontSize: 'clamp(1.5rem,3.5vw,3rem)', fontWeight: 900, color: '#f3e5ab', textShadow: '0 4px 30px rgba(0,0,0,1), 0 0 20px rgba(212,175,55,0.3)', lineHeight: 1 }}>{sub.price}</span>
                                            <div style={{ fontFamily: 'Orbitron', fontSize: 'clamp(0.35rem,0.7vw,0.5rem)', color: '#d4af37', letterSpacing: 4 }}>/ MONTH</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div style={{ width: '100%', maxWidth: 900, display: 'flex', alignItems: 'center', margin: '0 0 30px' }}>
                            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.7))' }} />
                            <div style={{ padding: '0 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                                <div style={{ fontFamily: 'Orbitron', fontSize: '2rem', fontWeight: 900, letterSpacing: 8, background: 'linear-gradient(to bottom, #fff8d0, #c8960c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', whiteSpace: 'nowrap' }}>ROYAL EXCHEQUER</div>
                                <div style={{ fontFamily: 'Orbitron', fontSize: '0.6rem', color: 'rgba(212,175,55,0.6)', letterSpacing: 6 }}>THE EMPEROR&apos;S TREASURY</div>
                            </div>
                            <div style={{ flex: 1, height: 1, background: 'linear-gradient(270deg, transparent, rgba(212,175,55,0.7))' }} />
                        </div>
                    </div>
                </div>

            </div>

            <input type="file" id="globalPhotoInput" accept="image/*,video/*" style={{ display: 'none' }} onChange={(e) => handleGlobalPhotoUpload(e.target as HTMLInputElement)} />
        </div>
    );
}
