"use client";

import React, { useEffect, useState } from 'react';
import '../../css/profile.css';
import '../../css/profile-mobile.css';
import { initProfileState, setState } from '@/scripts/profile-state';
import { updateKneelingUI, attachKneelListeners, renderKneelDots } from '@/scripts/kneeling';
import { createClient } from '@/utils/supabase/client';
import { getOptimizedUrl } from '@/scripts/media';
import { toggleSystemLog } from '@/scripts/chat';
import { trackUserAnalytics } from '@/scripts/telemetry';
import {
    claimKneelReward,
    switchTab,
    toggleTributeHunt,
    openLobby,
    closeLobby,
    openQueenMenu,
    closeQueenMenu,
    toggleMobileStats,
    toggleMobileChat,
    handleRoutineUpload,
    handleTaskEvidenceUpload,
    handleProfileUpload,
    handleAdminUpload,
    handleMediaPlus,
    handleChatKey,
    sendChatMessage,
    buyRealCoins,
    handleSubscribe,
    toggleRewardGrid,
    toggleRewardSubMenu,
    buyRewardFragment,
    closeModal,
    closePoverty,
    goToExchequer,
    closeRewardCard,
    closeExchequer,
    showLobbyAction,
    confirmLobbyAction,
    backToLobbyMenu,
    selectRoutineItem,
    getRandomTask,
    skipTask,
    executeSkipTask,
    cancelSkipTask,
    cancelSkipWarning,
    cancelRequestWarning,
    resetTaskUI,
    renderProfileSidebar,
    handleLogout,
    debugBytescale,
    mobileUploadEvidence,
    initChatSystem,
    loadQueenPosts,
    renderHistoryAndAltar,
    openAltarDrawer,
    closeAltarDrawer,
    toggleAltarSection,
    mobNavTo,
    openMobChatOverlay,
    closeMobChatOverlay,
    switchMobChatTab,
    openMobQueenWall,
    closeMobQueenWall,
    openMobGlobal,
    closeMobGlobal,
    switchMobGlTab,
    switchMobGlPeriod,
    sendMobGlMessage,
    handleMobGlKey,
} from '@/scripts/profile-logic';

export default function ProfilePage() {
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [benefitsOpen, setBenefitsOpen] = useState(false);
    const [hoveredSub, setHoveredSub] = useState<string | null>(null);

    // ─── 1. FETCH PROFILE DATA ───────────────────────────────────────────
    useEffect(() => {
        // Legacy Window Assignments
        if (typeof window !== 'undefined') {
            (window as any).claimKneelReward = claimKneelReward;
            (window as any).switchTab = switchTab;
            (window as any).toggleTributeHunt = toggleTributeHunt;
            (window as any).openLobby = openLobby;
            (window as any).closeLobby = closeLobby;
            (window as any).openQueenMenu = openQueenMenu;
            (window as any).closeQueenMenu = closeQueenMenu;
            (window as any).toggleMobileStats = toggleMobileStats;
            (window as any).toggleMobileChat = toggleMobileChat;
            (window as any).mobileRequestTask = () => { getRandomTask(); };
            (window as any).mobileSkipTask = () => { skipTask(); };
            (window as any).executeSkipTask = executeSkipTask;
            (window as any).cancelSkipTask = cancelSkipTask;
            (window as any).cancelSkipWarning = cancelSkipWarning;
            (window as any).cancelRequestWarning = cancelRequestWarning;
            (window as any).mobileUploadEvidence = mobileUploadEvidence;
            (window as any).handleRoutineUpload = handleRoutineUpload;
            (window as any).handleTaskEvidenceUpload = handleTaskEvidenceUpload;
            (window as any).handleProfileUpload = handleProfileUpload;
            (window as any).handleAdminUpload = handleAdminUpload;
            (window as any).handleMediaPlus = handleMediaPlus;
            (window as any).handleChatKey = handleChatKey;
            (window as any).sendChatMessage = sendChatMessage;
            (window as any).buyRealCoins = buyRealCoins;
            (window as any).handleSubscribe = handleSubscribe;
            (window as any).toggleRewardGrid = toggleRewardGrid;
            (window as any).toggleRewardSubMenu = toggleRewardSubMenu;
            (window as any).buyRewardFragment = buyRewardFragment;
            (window as any).closeModal = closeModal;
            (window as any).closePoverty = closePoverty;
            (window as any).goToExchequer = goToExchequer;
            (window as any).closeRewardCard = closeRewardCard;
            (window as any).closeExchequer = closeExchequer;
            (window as any).showLobbyAction = showLobbyAction;
            (window as any).confirmLobbyAction = confirmLobbyAction;
            (window as any).backToLobbyMenu = backToLobbyMenu;
            (window as any).selectRoutineItem = selectRoutineItem;
            (window as any).getRandomTask = getRandomTask;
            (window as any).skipTask = skipTask;
            (window as any).resetTaskUI = resetTaskUI;
            (window as any).handleLogout = handleLogout;
            (window as any).debugBytescale = debugBytescale;
            (window as any).loadQueenPosts = loadQueenPosts;
            (window as any).renderHistoryAndAltar = renderHistoryAndAltar;
            (window as any).openAltarDrawer = openAltarDrawer;
            (window as any).closeAltarDrawer = closeAltarDrawer;
            (window as any).toggleAltarSection = toggleAltarSection;
            (window as any).mobNavTo = mobNavTo;
            (window as any).openMobChatOverlay = openMobChatOverlay;
            (window as any).closeMobChatOverlay = closeMobChatOverlay;
            (window as any).switchMobChatTab = switchMobChatTab;
            (window as any).openMobQueenWall = openMobQueenWall;
            (window as any).closeMobQueenWall = closeMobQueenWall;
            (window as any).openMobGlobal = openMobGlobal;
            (window as any).closeMobGlobal = closeMobGlobal;
            (window as any).switchMobGlTab = switchMobGlTab;
            (window as any).switchMobGlPeriod = switchMobGlPeriod;
            (window as any).sendMobGlMessage = sendMobGlMessage;
            (window as any).handleMobGlKey = handleMobGlKey;
            (window as any).toggleSystemLog = toggleSystemLog;
            (window as any).renderKneelDots = renderKneelDots;
        }

        async function loadProfile() {
            try {
                // ─── LOCAL DEV BYPASS ────────────────────────────────────────
                // Skips login when running on localhost so you can see UI changes instantly.
                const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
                if (isLocal) {
                    const TEST_EMAIL = 'pr.finsko@gmail.com';
                    const res = await fetch(`/api/slave-profile?email=${encodeURIComponent(TEST_EMAIL)}&full=true`);
                    const unifiedData = await res.json();
                    console.log('[DEV MODE] Loaded real user:', unifiedData);
                    setProfile(unifiedData);
                    initProfileState(unifiedData);
                    setState({ cooldownMinutes: 1 }); // DEV: 1 min cooldown on localhost
                    setTimeout(() => {
                        renderProfileSidebar(unifiedData);
                        updateKneelingUI();
                        attachKneelListeners();
                        const urlParams = new URLSearchParams(window.location.search);
                        if (urlParams.get('exchequer') === 'open') {
                            (window as any).goToExchequer();
                        } else if (urlParams.get('tab') === 'record') {
                            switchTab('record');
                        } else {
                            switchTab('serve');
                        }
                        getRandomTask(true);
                        loadQueenPosts();
                        renderHistoryAndAltar(unifiedData);

                        // Initialize Chat & Tracking
                        initChatSystem();
                        trackUserAnalytics(unifiedData.id);
                    }, 150);
                    return;
                }
                // ─────────────────────────────────────────────────────────────

                // Get the authenticated user's email from the client-side auth session
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    window.location.href = '/login';
                    return;
                }

                // Fetch all data via the admin API route (same as dashboard) — bypasses RLS
                // Uses supabaseAdmin internally, returns merged profiles + tasks + crowdfund
                const res = await fetch(`/api/slave-profile?email=${encodeURIComponent(user.email!)}&full=true`);
                const unifiedData = await res.json();

                if (unifiedData && !unifiedData.error && unifiedData.member_id) {
                    console.log("[PROFILE] Loaded Data:", unifiedData);

                    setProfile(unifiedData);
                    initProfileState(unifiedData);

                    setTimeout(() => {
                        renderProfileSidebar(unifiedData);
                        updateKneelingUI();
                        attachKneelListeners();
                        const urlParams = new URLSearchParams(window.location.search);
                        if (urlParams.get('exchequer') === 'open') {
                            (window as any).goToExchequer();
                        } else if (urlParams.get('tab') === 'record') {
                            switchTab('record');
                        } else {
                            switchTab('serve');
                        }
                        getRandomTask(true);
                        loadQueenPosts();
                        renderHistoryAndAltar(unifiedData);

                        // Initialize Chat & Tracking
                        initChatSystem();
                        trackUserAnalytics(unifiedData.id);
                    }, 150);
                }
            } catch (err) {
                console.error("Critical Load Error:", err);
            } finally {
                setLoading(false);
            }
        }

        loadProfile();
    }, []);

    // ─── 2. ATTACH KNEEL LISTENERS ────────────────────────────────────────
    useEffect(() => {
        if (!loading) {
            const timer = setTimeout(() => {
                attachKneelListeners();
                updateKneelingUI();
            }, 300);

            const interval = setInterval(updateKneelingUI, 1000);

            return () => {
                clearTimeout(timer);
                clearInterval(interval);
            };
        }
    }, [loading]);

    if (loading) return (
        <div id="loading" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: 'var(--gold)', fontFamily: 'Cinzel' }}>
            LOADING COMMAND CONSOLE...
        </div>
    );

    return (
        <div id="PROFILE_CONTAINER" style={{
            background: '#020512',
            minHeight: '100vh',
            width: '100vw',
            overflowX: 'hidden'
        }}>

            {/* SOUNDS & INPUTS */}
            <audio id="msgSound" src="https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3"></audio>
            <audio id="coinSound" src="/audio/2019-preview1.mp3"></audio>
            <audio id="skipSound" src="https://static.wixstatic.com/mp3/ce3e5b_3b5b34d4083847e2b123b6fd9a8551fd.mp3"></audio>

            <input type="file" id="profileUploadInput" accept="image/*" className="hidden" />
            <input type="file" id="routineUploadInput" accept="image/*" className="hidden" onChange={(e: any) => handleRoutineUpload(e.target)} />
            <input type="file" id="taskEvidenceInput" accept="image/*,video/*" className="hidden" onChange={(e: any) => handleTaskEvidenceUpload(e.target)} />
            <input type="file" id="evidenceInputMob" accept="image/*,video/*" className="hidden" onChange={(e: any) => mobileUploadEvidence(e.target)} />
            <input type="file" id="chatMediaInput" accept="image/*,video/*" className="hidden" />


            {/* UNIVERSAL DESKTOP APP */}
            <div id="DESKTOP_APP">
                {/* SIDEBAR */}
                <div className="v-sidebar" style={{ backgroundColor: 'transparent', backdropFilter: 'blur(25px)' }}>
                    <div style={{ marginBottom: 40, textAlign: 'center', padding: '25px 15px', marginTop: 20, marginRight: 20, position: 'relative' }}>
                        <div className="big-profile-circle" onClick={() => (window as any).handleProfileUpload?.()} style={{ width: 140, height: 200, borderRadius: '70px / 100px', margin: '0 auto 25px', position: 'relative', zIndex: 1, padding: 0, boxShadow: '0 10px 40px rgba(0,0,0,0.6)', overflow: 'hidden' }}>
                            <img id="profilePic" src={profile?.avatar_url || profile?.profile_picture_url || "https://static.wixstatic.com/media/ce3e5b_78da97e06a3848df84d0b00c9e6dcfdd~mv2.png"} alt="Avatar" className="profile-img" style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }} onError={(e) => { e.currentTarget.src = 'https://static.wixstatic.com/media/ce3e5b_78da97e06a3848df84d0b00c9e6dcfdd~mv2.png' }} />
                        </div>

                        <div onClick={() => (window as any).openManageProfileModal?.()} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 8, position: 'relative', zIndex: 2, backgroundColor: 'rgba(0,0,0,0.6)', padding: '10px 20px', borderRadius: '10px', border: '1px solid rgba(197,160,89,0.2)', width: 'fit-content', margin: '0 auto', backdropFilter: 'blur(5px)', cursor: 'pointer', userSelect: 'none' }}>
                            <div id="subName" className="identity-name" style={{ fontSize: '1.5rem', letterSpacing: 5, margin: '0', fontWeight: 'bold', color: '#c5a059', pointerEvents: 'none' }}>
                                {profile?.name || "SLAVE"}
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); (window as any).openManageProfileModal?.(); }}
                                style={{ background: 'none', border: 'none', color: '#c5a059', cursor: 'pointer', padding: 0, display: 'flex' }}
                                title="Manage Profile Options"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"></path>
                                    <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"></path>
                                    <path d="M12 2v2"></path>
                                    <path d="M12 20v2"></path>
                                    <path d="m4.93 4.93 1.41 1.41"></path>
                                    <path d="m17.66 17.66 1.41 1.41"></path>
                                    <path d="M2 12h2"></path>
                                    <path d="M20 12h2"></path>
                                    <path d="m6.34 17.66-1.41 1.41"></path>
                                    <path d="m19.07 4.93-1.41 1.41"></path>
                                </svg>
                            </button>
                        </div>
                        <div id="subEmail" style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'Orbitron', marginBottom: 15, letterSpacing: 1 }}>
                            {profile?.member_id || ""}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', marginTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 15 }}>
                            <div className="sidebar-stat-block">
                                <div className="sidebar-stat-value-row">
                                    <span style={{ color: '#fff', opacity: 0.8 }}><i className="fas fa-award"></i></span>
                                    <div id="points">{profile?.score || 0}</div>
                                </div>
                                <div className="sidebar-stat-label">MERIT</div>
                            </div>
                            <div style={{ height: 30, width: 1, background: 'rgba(255,255,255,0.05)' }}></div>
                            <div className="sidebar-stat-block">
                                <div className="sidebar-stat-value-row">
                                    <span style={{ color: '#c5a059' }}><i className="fas fa-coins"></i></span>
                                    <div id="coins">{profile?.wallet || 0}</div>
                                </div>
                                <div className="sidebar-stat-label">CAPITAL</div>
                            </div>
                        </div>

                        <div style={{ marginTop: 25, width: '100%', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 15 }}>
                            <div style={{ fontFamily: 'Orbitron', fontSize: '0.65rem', color: '#c5a059', letterSpacing: 2, marginBottom: 5 }}>CURRENT CLASSIFICATION</div>
                            <div id="desk_DashboardRank" style={{ fontFamily: 'Cinzel', fontSize: '1.4rem', color: '#fff', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: 20 }}>...</div>

                            <button id="desk_BenefitsToggle" style={{ background: 'none', border: 'none', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                                <span style={{ fontFamily: 'Orbitron', fontSize: '0.65rem', color: '#c5a059', letterSpacing: 1 }}>CURRENT PRIVILEGES</span>
                                <span style={{ fontSize: '0.6rem', color: '#c5a059' }}>▼</span>
                            </button>
                            <ul id="desk_CurrentBenefits" className="hidden" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.7rem', fontFamily: 'Cinzel', paddingLeft: 15, lineHeight: 1.5, marginTop: 10, textAlign: 'left' }}></ul>
                        </div>

                        <button onClick={() => (window as any).handleLogout?.()} style={{ marginTop: 20, width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)', fontFamily: 'Orbitron', fontSize: '0.55rem', letterSpacing: 2, padding: '10px 0', cursor: 'pointer', borderRadius: 6, transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(197,160,89,0.4)'; e.currentTarget.style.color = '#c5a059'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}>
                            LOG OUT
                        </button>
                    </div>

                    <div className="sidebar-scrollable-area" style={{ flex: 1, overflowY: 'auto', width: '100%', display: 'flex', flexDirection: 'column', padding: '0 15px 0 15px', boxSizing: 'border-box', paddingRight: 30 }}>
                        <div id="desk_WorkingOnSection" style={{ width: '100%', textAlign: 'center', paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: 15, flexShrink: 0 }}>
                            <div style={{ fontFamily: 'Orbitron', fontSize: '0.55rem', color: '#c5a059', letterSpacing: 2, marginBottom: 2 }}>WORKING ON</div>
                            <div id="desk_WorkingOnRank" style={{ fontFamily: 'Orbitron', fontSize: '0.9rem', color: '#fff', textTransform: 'uppercase', fontWeight: 'bold' }}>...</div>
                        </div>

                        <div id="desk_ProgressContainer" style={{ width: '100%', marginBottom: 15, flexShrink: 0 }}></div>

                        <div style={{ width: '100%', textAlign: 'left', padding: '0 2px', marginBottom: 25, flexShrink: 0 }}>
                            <div style={{ fontFamily: 'Orbitron', fontSize: '0.55rem', color: '#c5a059', marginBottom: 6 }}>PRIVILEGES GRANTED</div>
                            <ul id="desk_NextBenefits" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.7rem', fontFamily: 'Cinzel', paddingLeft: 15, lineHeight: 1.5, margin: 0 }}></ul>
                        </div>

                    </div>
                </div>

                {/* MAIN CONTENT STAGE */}
                <div id="viewServingTopDesktop" className="view-wrapper hidden" style={{ position: 'relative' }}>
                    <div id="gridStat1" className="v-card v-stat-card serve-grid-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
                        <div className="ribbon-label" style={{ textAlign: 'center' }}>KNEELING HOURS</div>
                        <div className="prog-bg" style={{ height: 25, borderRadius: 12, position: 'relative', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                            <div id="deskKneelDailyFill" className="prog-fill" style={{ width: '0%', background: '#c5a059', height: '100%', transition: 'width 0.5s ease' }}></div>
                            <div id="deskKneelDailyText" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Orbitron', fontSize: '0.8rem', color: 'white', textShadow: '0 1px 3px black' }}>0 / 8</div>
                        </div>
                    </div>

                    <div id="gridStat2" className="v-card v-stat-card serve-grid-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                        <div className="ribbon-label" style={{ textAlign: 'center' }}>DAILY ROUTINE</div>
                        <div id="deskRoutineDisplay" style={{ fontFamily: 'Cinzel', fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 1.4, minHeight: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>LOADING...</div>
                        <button
                            id="deskRoutineActionBtn"
                            style={{
                                width: '100%', padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                                background: 'linear-gradient(135deg, #c5a059 0%, #8b6914 100%)',
                                color: '#000', fontFamily: 'Orbitron', fontSize: '0.55rem', fontWeight: 700,
                                letterSpacing: '1px', textTransform: 'uppercase',
                                boxShadow: '0 4px 15px rgba(197,160,89,0.3)', transition: 'all 0.2s'
                            }}
                            onClick={() => (window as any).__routineAction?.()}
                        >
                            LOADING...
                        </button>
                        <div id="deskRoutineTimeMsg" className="hidden" style={{ color: '#666', fontFamily: 'Orbitron', fontSize: '0.55rem', textAlign: 'center' }}>NEXT UPLOAD 6AM</div>
                    </div>

                    <div id="gridStat3" className="v-card v-stat-card serve-grid-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
                        <div className="ribbon-label" style={{ textAlign: 'center' }}>CONSISTENCY</div>
                        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-around', alignItems: 'center', flex: 1 }}>
                            <div style={{ textAlign: 'center' }}>
                                <div className="ribbon-label" style={{ fontSize: '0.55rem', opacity: 0.7, marginBottom: 5 }}>STREAK</div>
                                <div id="deskStreak" style={{ fontFamily: 'Orbitron', fontSize: '1.5rem', color: 'white' }}>0</div>
                            </div>
                            <div style={{ height: 30, width: 1, background: 'rgba(255,255,255,0.1)' }}></div>
                            <div style={{ textAlign: 'center' }}>
                                <div className="ribbon-label" style={{ fontSize: '0.55rem', opacity: 0.7, marginBottom: 5 }}>TOTAL</div>
                                <div id="deskTotal" style={{ fontFamily: 'Orbitron', fontSize: '1.5rem', color: '#c5a059' }}>0</div>
                            </div>
                        </div>
                    </div>

                    <div id="gridStat4" className="v-card v-stat-card serve-grid-item" style={{ flexDirection: 'column', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', background: 'linear-gradient(135deg, rgba(197,160,89,0.07), rgba(197,160,89,0.02))', border: '1px solid rgba(197,160,89,0.22)', gap: 6 }} onClick={() => window.location.href = '/global'}>
                        <div style={{ fontFamily: 'Orbitron', fontSize: '0.42rem', color: 'rgba(197,160,89,0.5)', letterSpacing: '3px' }}>TAP TO OPEN</div>
                        <div style={{ fontFamily: 'Cinzel', fontSize: '1.05rem', color: '#fff', fontWeight: 700, letterSpacing: '3px' }}>GLOBAL</div>
                        <div style={{ fontFamily: 'Orbitron', fontSize: '0.4rem', color: 'rgba(255,255,255,0.22)', letterSpacing: '1px', textAlign: 'center', lineHeight: 1.8 }}>LEADERBOARD · TALK · UPDATES</div>
                    </div>

                    <div id="gridHero" className="v-card serve-grid-item" style={{ background: "url('https://static.wixstatic.com/media/ce3e5b_13b4c9faf6c5471ca7d292968d40feee~mv2.png')", backgroundSize: 'cover', backgroundPosition: 'center', minHeight: 'unset', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(2,5,18,0.9) 0%, rgba(2,5,18,0.4) 100%)' }}></div>

                        <div id="kneelRewardOverlay" className="hidden" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 5000, backdropFilter: 'blur(20px)', display: 'none', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ textAlign: 'center', width: '100%', padding: 20 }}>
                                <div className="mob-reward-card" style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0, width: '100%', maxHeight: 'unset', overflow: 'visible' }}>
                                    <h2 style={{ fontFamily: 'Cinzel', color: '#c5a059', fontSize: '1.2rem', letterSpacing: 4, marginBottom: 20, textTransform: 'uppercase' }}>DEVOTION RECOGNIZED</h2>
                                    <div className="mob-reward-actions" style={{ display: 'flex', flexDirection: 'row', gap: 20, width: '100%', justifyContent: 'center' }}>
                                        <button onClick={() => claimKneelReward('coins')} className="action-btn" style={{ borderColor: '#c5a059', color: '#c5a059', background: 'rgba(197,160,89,0.08)', fontSize: '0.85rem', flex: 1, maxWidth: 180, padding: '10px 0', height: 45 }}>CLAIM COINS</button>
                                        <button onClick={() => claimKneelReward('points')} className="action-btn" style={{ borderColor: '#888', color: '#888', background: 'rgba(136,136,136,0.08)', fontSize: '0.85rem', flex: 1, maxWidth: 180, padding: '10px 0', height: 45 }}>CLAIM POINTS</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ position: 'relative', zIndex: 10, padding: 10, boxSizing: 'border-box' }}>
                            <p style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Cinzel', fontSize: '0.8rem', letterSpacing: 2, margin: 0, textTransform: 'uppercase' }}>Welcome back,</p>
                            <h2 id="heroUserName" style={{ fontFamily: 'Orbitron', fontSize: '2rem', margin: '5px 0', color: 'white', letterSpacing: 2, fontWeight: 700 }}>{profile?.name || "LOYAL SUBJECT"}</h2>
                            <button id="heroKneelBtn" className="mob-kneel-bar" style={{ height: 48, width: 220, cursor: 'pointer', borderRadius: 4, overflow: 'hidden', position: 'relative', background: 'rgba(0,0,0,0.5)', border: '1px solid #c5a059', margin: '20px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, outline: 'none', transition: '0.3s' }}>
                                <div id="heroKneelFill" className="mob-bar-fill" style={{ width: '0%', background: 'linear-gradient(90deg, #4b0000 0%, #000000 100%)', height: '100%', position: 'absolute', left: 0, top: 0, transition: 'width 0.3s ease', pointerEvents: 'none' }}></div>
                                <div className="mob-bar-content" style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', pointerEvents: 'none' }}>
                                    <span id="heroKneelText" style={{ fontFamily: 'Orbitron', fontSize: '0.8rem', color: 'white', textShadow: '0 1px 3px black', letterSpacing: 2 }}>HOLD TO KNEEL</span>
                                </div>
                            </button>
                            <p style={{ color: '#c5a059', fontFamily: 'Cinzel', fontSize: '0.85rem', letterSpacing: 1, margin: 0, opacity: 0.8, fontStyle: 'italic' }}>"Your devotion determines your destiny."</p>
                        </div>
                    </div>

                    <div id="gridTask" className="v-card serve-grid-item" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10, minHeight: 'unset' }}>
                        <div className="ribbon-label">CURRENT ORDERS</div>
                        <div className="task-interface-container" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <div id="mainButtonsArea" style={{ width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <button id="newTaskBtn" onClick={() => getRandomTask()} className="action-btn" style={{ width: '100%', borderRadius: 12, background: '#0075ff', color: 'white', padding: 15, fontWeight: 'bold', letterSpacing: 2 }}>REQUEST TASK</button>
                                <div id="idleMessage" style={{ fontFamily: 'Cinzel', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: 10 }}>Awaiting direct orders from Queen Karin...</div>
                                <div id="requestWarningBox" style={{ display: 'none', flexDirection: 'column', gap: 10, marginTop: 15, alignItems: 'center', width: '100%', border: '1px solid rgba(255,0,60,0.5)', background: 'rgba(20,0,0,0.8)', padding: '15px', borderRadius: '8px', backdropFilter: 'blur(5px)' }}>
                                    <div style={{ color: '#ff003c', fontFamily: 'Cinzel', fontSize: '1rem', textAlign: 'center', fontWeight: 'bold', letterSpacing: '1px' }}>INSUFFICIENT CAPITAL</div>
                                    <button className="action-btn" onClick={() => (window as any).goToExchequer()} style={{ width: '100%', background: 'linear-gradient(90deg, #ff003c 0%, #8b0000 100%)', color: 'white', fontWeight: 'bold', border: '1px solid #ff003c', boxShadow: '0 0 15px rgba(255,0,60,0.4)', borderRadius: '12px', padding: '15px', fontSize: '0.9rem', letterSpacing: '2px' }}>ADD COINS</button>
                                    <button className="text-btn" onClick={() => (window as any).cancelRequestWarning()} style={{ color: '#aaa', fontFamily: 'Orbitron', fontSize: '0.75rem', letterSpacing: 1, background: 'none', border: 'none', padding: '10px', width: '100%' }}>RETURN TO SERVE</button>
                                </div>
                            </div>
                            <div id="activeTaskContent" className="hidden" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <h2 id="readyText" style={{ fontFamily: 'Cinzel', fontSize: '1.1rem', textAlign: 'center', margin: 0, lineHeight: 1.4, color: 'white' }}>-</h2>
                                <div id="activeTimerRow" className="card-timer-row">
                                    <div id="timerH" className="card-t-box">00</div>
                                    <div className="t-sep">:</div>
                                    <div id="timerM" className="card-t-box">00</div>
                                    <div className="t-sep">:</div>
                                    <div id="timerS" className="card-t-box">00</div>
                                </div>
                                <div id="skipWarningBox" style={{ display: 'none', flexDirection: 'column', gap: 10, marginTop: 10, alignItems: 'center', width: '100%', border: '1px solid rgba(255,0,60,0.5)', background: 'rgba(20,0,0,0.8)', padding: '15px', borderRadius: '8px', backdropFilter: 'blur(5px)' }}>
                                    <div style={{ color: '#ff003c', fontFamily: 'Cinzel', fontSize: '1rem', textAlign: 'center', fontWeight: 'bold', letterSpacing: '1px' }}>INSUFFICIENT CAPITAL</div>
                                    <button className="action-btn" onClick={() => (window as any).goToExchequer()} style={{ width: 240, background: 'linear-gradient(90deg, #ff003c 0%, #8b0000 100%)', color: 'white', fontWeight: 'bold', border: '1px solid #ff003c', boxShadow: '0 0 15px rgba(255,0,60,0.4)', borderRadius: '8px', padding: '10px', fontSize: '0.8rem', letterSpacing: '2px' }}>ADD COINS</button>
                                    <button className="text-btn" onClick={() => (window as any).cancelSkipWarning()} style={{ color: '#aaa', fontFamily: 'Orbitron', fontSize: '0.7rem', letterSpacing: 1, background: 'none', border: 'none', padding: '5px', width: 240 }}>RETURN TO SERVE</button>
                                </div>
                                <div id="uploadBtnContainer" style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 10, alignItems: 'center' }}>
                                    <button id="uploadBtn" className="action-btn" style={{ width: 240, background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', color: '#c5a059', fontWeight: 'bold', border: '1px solid #c5a059', boxShadow: '0 0 15px rgba(197,160,89,0.2)' }} onClick={() => (document.getElementById('taskEvidenceInput') as any)?.click()}>UPDATE TASK</button>
                                    <button id="btnSkip" onClick={() => (window as any).skipTask()} className="text-btn" style={{ color: '#aaa', fontFamily: 'Orbitron', fontSize: '0.7rem', letterSpacing: 1, background: 'none', border: 'none', padding: 5, width: 240 }}>SKIP TASK</button>
                                </div>
                                <div id="skipConfirmContainer" style={{ display: 'none', flexDirection: 'column', gap: 10, marginTop: 10, alignItems: 'center', width: '100%', border: '1px solid rgba(255,0,60,0.4)', background: 'rgba(20,0,0,0.8)', padding: '15px', borderRadius: '8px', backdropFilter: 'blur(5px)' }}>
                                    <div style={{ color: '#ff003c', fontFamily: 'Cinzel', fontSize: '0.9rem', textAlign: 'center', fontWeight: 'bold', letterSpacing: '1px', textShadow: '0 0 10px rgba(255,0,0,0.5)' }}>DISOBEDIENCE HAS A PRICE</div>
                                    <div style={{ color: '#ccc', fontFamily: 'Cinzel', fontSize: '0.75rem', textAlign: 'center', marginBottom: 5 }}>Is that skip worth of <span style={{ color: '#ff003c', fontWeight: 'bold' }}>300 coins</span>, pet?</div>
                                    <button id="btnConfirmSkip" onClick={() => (window as any).executeSkipTask()} className="action-btn" style={{ width: 280, background: 'linear-gradient(90deg, #ff003c 0%, #8b0000 100%)', color: 'white', fontWeight: 'bold', border: '1px solid #ff003c', boxShadow: '0 0 15px rgba(255,0,60,0.4)', borderRadius: '8px', padding: '10px', fontSize: '0.8rem', letterSpacing: '2px' }}>ACCEPT PENALTY</button>
                                    <button id="btnCancelSkip" onClick={() => (window as any).cancelSkipTask()} className="text-btn" style={{ color: '#aaa', fontFamily: 'Orbitron', fontSize: '0.7rem', letterSpacing: 1, background: 'none', border: 'none', padding: 5, width: 280, whiteSpace: 'nowrap' }}>NEVERMIND, I WILL SERVE</button>
                                </div>
                                <div id="dismissTaskContainer" style={{ display: 'none', flexDirection: 'column', gap: 5, marginTop: 15, alignItems: 'center', width: '100%' }}>
                                    <button id="btnDismissTask" onClick={() => (window as any).resetTaskUI()} className="action-btn" style={{ width: '70%', background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 'bold', border: '2px solid white', padding: '15px', fontSize: '0.75rem', letterSpacing: '1px', whiteSpace: 'nowrap' }}>THANK YOU, QUEEN KARIN</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div id="viewServingTop" className="v-card serve-grid-item" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', borderRadius: 20 }}>
                        <div id="chatCard" className="chat-container" style={{ flex: 1, minHeight: 0, background: 'transparent', margin: 0, border: 'none', borderRadius: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                            <div id="chatBox" className="chat-body-frame" style={{ background: 'transparent', flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 !important' }}>
                                <div id="systemTicker" className="system-ticker" style={{ cursor: 'pointer', margin: '0 20px 10px 20px', borderRadius: '0 0 12px 12px', borderLeft: '1px solid rgba(197,160,89,0.2)', borderRight: '1px solid rgba(197,160,89,0.2)', borderBottom: '1px solid rgba(197,160,89,0.2)', width: 'auto' }} onClick={() => (window as any).toggleSystemLog()}>SYSTEM ONLINE</div>
                                <div id="chatContent" className="chat-area" style={{ padding: '0 20px 20px 20px' }}></div>
                            </div>

                            {/* NEW SYSTEM LOG CONTAINER */}
                            <div id="systemLogContainer" className="hidden" style={{ position: 'absolute', top: 15, left: 15, right: 15, bottom: 90, background: 'rgba(5,5,5,0.95)', border: '1px solid rgba(197,160,89,0.3)', borderRadius: 12, boxShadow: '0 15px 35px rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 50, display: 'none', flexDirection: 'column', overflow: 'hidden' }}>
                                <div style={{ width: '100%', padding: '15px 20px', background: 'rgba(197,160,89,0.05)', borderBottom: '1px solid rgba(197,160,89,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontFamily: 'Cinzel', color: '#c5a059', fontWeight: 'bold' }}>SYSTEM LOGS</span>
                                    <button onClick={() => (window as any).toggleSystemLog()} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontFamily: 'Orbitron', fontSize: '1.2rem' }}>×</button>
                                </div>
                                <div id="systemLogContent" className="chat-area" style={{ flex: 1, overflowY: 'auto', padding: 20 }}></div>
                            </div>

                            <div className="chat-footer" style={{ background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.1)', padding: 15, display: 'flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 15 }}>
                                <div className="chat-input-wrapper" style={{ flexGrow: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 15 }}>
                                    <button id="btnMediaPlus" className="chat-btn-plus" onClick={() => handleMediaPlus()}>+</button>
                                    <input type="text" id="chatMsgInput" className="chat-input" placeholder="Communicate with Queen Karin..." onKeyPress={(e: any) => handleChatKey(e)} />
                                </div>
                                <button className="chat-btn-send" onClick={() => sendChatMessage()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M22 2L11 13" stroke="#c5a059" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="#c5a059" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* OVERLAY TRIBUTE MODAL - SCRAPBOOK NOTEBOOK THEME + CROWDFUND FROSTED GLASS */}
                    <div id="tributeHuntOverlay" className="hidden" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 10000, display: 'none', flexDirection: 'column', padding: '40px 40px 40px 80px', borderRadius: '12px', overflow: 'hidden' }}>
                        {/* Dynamic Background Image */}
                        <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-deep)', zIndex: -2 }}></div>
                        {/* Frosted Glass Effect */}
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255, 255, 255, 0.5)', backdropFilter: 'blur(15px)', zIndex: -1, border: '1px solid rgba(255,255,255,0.4)', borderRadius: '12px' }}></div>

                        {/* Pink Accent Line */}
                        <div style={{ position: 'absolute', left: '60px', top: 0, bottom: 0, width: '2px', background: 'rgba(255, 105, 180, 0.4)', zIndex: 0 }}></div>

                        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '30px', zIndex: 10, position: 'relative' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <span style={{ fontFamily: "'Cinzel', serif", color: '#fff', fontSize: '1.6rem', letterSpacing: '6px', fontWeight: 700, textTransform: 'uppercase', textShadow: '0 0 30px rgba(197,160,89,0.3)' }}>QUEEN<span style={{ color: '#c5a059', margin: '0 8px' }}>✦</span>WISHLIST</span>
                            </div>
                            <button onClick={() => toggleTributeHunt()} style={{ position: 'absolute', right: 0, top: 0, color: '#111', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: "'Patrick Hand', cursive", fontSize: '2rem', transition: 'all 0.2s', padding: 0, fontWeight: 'bold' }} onMouseOver={(e) => { e.currentTarget.style.color = '#ff4b72'; e.currentTarget.style.transform = 'scale(1.2) rotate(10deg)'; }} onMouseOut={(e) => { e.currentTarget.style.color = '#111'; e.currentTarget.style.transform = 'scale(1) rotate(0deg)'; }}>X</button>
                        </div>
                        <div id="huntStoreGridDesk" className="store-grid" style={{ width: '100%', flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '30px', padding: '20px 10px', paddingBottom: '30px', zIndex: 10, position: 'relative' }}></div>
                    </div>

                    <div id="gridRightSection" className="serve-grid-item" style={{ display: 'flex', flexDirection: 'row', gap: 25, overflow: 'hidden' }}>

                        {/* CENTER COLUMN: two separate boxes stacked vertically */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>

                            {/* TOP BOX — tribute card, unchanged */}
                            <div className="v-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                <div id="desk_QuickTribute" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden', minHeight: 0 }}></div>
                                <button className="action-btn" onClick={() => toggleTributeHunt()} style={{ width: '100%', fontSize: '0.6rem', padding: 6, borderRadius: 8, marginTop: 10, background: 'rgba(255,255,255,0.05)', color: '#888', flexShrink: 0 }}>SPOIL ME ♥</button>
                            </div>

                            {/* BOTTOM BOX — link to record / gallery */}
                            <div className="v-card" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '22px 16px', cursor: 'pointer' }} onClick={() => (window as any).switchTab('record')}>
                                <div style={{ fontFamily: 'Orbitron', fontSize: '0.42rem', color: 'rgba(197,160,89,0.5)', letterSpacing: '3px' }}>TAP TO OPEN</div>
                                <div style={{ fontFamily: 'Cinzel', fontSize: '1.05rem', color: '#fff', fontWeight: 700, letterSpacing: '3px' }}>MY RECORD</div>
                                <div style={{ fontFamily: 'Orbitron', fontSize: '0.38rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '1px', textAlign: 'center', lineHeight: 1.8 }}>ALTAR · GALLERY · HISTORY</div>
                            </div>
                        </div>

                        <div className="v-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0, cursor: 'pointer', position: 'relative' }} onClick={() => switchTab('news')}>
                            <div className="ribbon-label" style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, margin: 0 }}>QUEEN KARIN</div>
                            <div id="desk_LatestKarinPhoto" style={{ width: '100%', height: '100%', background: '#000', position: 'relative' }}></div>
                        </div>
                    </div>
                </div>


                {/* OTHER VIEWS */}
                <div id="historySection" className="view-wrapper" style={{ perspective: 1000, padding: 0, minHeight: '80vh' }}>
                    <div className="record-landing">
                        <header className="chronicle-header" style={{ position: 'relative' }}>
                            <button onClick={() => switchTab('serve')} style={{ position: 'absolute', right: 20, top: 20, background: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,0,0,0.3)', color: '#ff4444', padding: '5px 15px', borderRadius: 20, cursor: 'pointer', fontFamily: 'Orbitron', fontSize: '0.7rem', letterSpacing: 2 }}>✕ CLOSE</button>
                            <h1 className="chronicle-title">SLAVE RECORD</h1>
                        </header>
                        <section className="chronicle-section">
                            <div className="chronicle-section-label">THE SOVEREIGN ALTAR</div>
                            <div className="chronicle-hero">
                                <div id="altarMain" className="hero-main mosaic-card">
                                    <img id="imgAltarMain" src="" className="hero-img" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                                    <div className="hero-overlay">
                                        <div className="hero-label">SUPREME HIGHLIGHT</div>
                                        <h2 id="titleAltarMain" className="hero-title">...</h2>
                                    </div>
                                </div>
                                <div id="altarSub1" className="hero-sub mosaic-card">
                                    <div className="mini-grid-label">DAILY ROUTINES</div>
                                    <div id="gridAltarRoutine" className="altar-mini-grid"></div>
                                </div>
                                <div id="altarSub2" className="hero-sub mosaic-card">
                                    <div className="mini-grid-label">FAILED / VOID</div>
                                    <div id="gridAltarFailed" className="altar-mini-grid"></div>
                                </div>
                            </div>
                        </section>
                        <section className="chronicle-section">
                            <div className="chronicle-section-label">DEDICATED ENTRIES</div>
                            <div id="mosaicGrid" className="chronicle-mosaic"></div>
                        </section>
                    </div>
                </div>

                <div id="viewNews" className="view-wrapper hidden alt-grid-view" style={{ padding: 0, position: 'relative' }}>
                    <div style={{ padding: '20px', display: 'flex', justifyContent: 'flex-end', background: 'linear-gradient(180deg, rgba(0,0,0,0.8), transparent)', position: 'absolute', top: 0, right: 0, left: 0, zIndex: 10 }}>
                        <button onClick={() => switchTab('serve')} style={{ background: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,0,0,0.3)', color: '#ff4444', padding: '5px 15px', borderRadius: 20, cursor: 'pointer', fontFamily: 'Orbitron', fontSize: '0.7rem', letterSpacing: 2 }}>✕ CLOSE</button>
                    </div>
                    <div id="newsGrid" className="gallery-grid" style={{ marginTop: 50 }}></div>
                </div>

                <div id="viewBuy" className="view-wrapper hidden alt-grid-view" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto', padding: '0 0 120px 0', width: '100%', height: '100%', background: '#000' }}>

                    {/* BG: Gothic Throne Room */}
                    <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url("https://upcdn.io/kW2K8hR/raw/pictures/kling_20260304_%E4%BD%9C%E5%93%81_make_me_si_1244_0-6V52.png")', backgroundSize: 'cover', backgroundPosition: 'center center', backgroundRepeat: 'no-repeat', opacity: 0.3, pointerEvents: 'none' }} />

                    <div style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 20px' }}>

                        {/* CLOSE */}
                        <div style={{ position: 'absolute', top: 10, right: 0 }}>
                            <button onClick={() => switchTab('serve')} style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(212,175,55,0.45)', color: '#d4af37', padding: '5px 14px', borderRadius: 4, cursor: 'pointer', fontFamily: 'Cinzel', fontSize: '0.65rem', letterSpacing: 3 }}>✕ CLOSE</button>
                        </div>

                        {/* top spacer for close button */}
                        <div style={{ height: 50 }} />


                        {/* ── SECTION 1: SUBSCRIPTIONS — 3D TIER FAN ── */}
                        <div style={{ width: '100%', marginBottom: 50, display: 'flex', justifyContent: 'center' }}>
                            <div style={{ perspective: '1000px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 0, width: '100%', paddingBottom: 20 }}>
                                {([
                                    { tier: 'BASIC', label: 'INITIATE', price: '€33', id: 'basic', defaultX: '-8%', defaultRotY: '8deg', defaultScale: 0.82, defaultZ: -60 },
                                    { tier: 'ROYAL', label: 'PATRONAGE', price: '€77', id: 'royal', defaultX: '0', defaultRotY: '0deg', defaultScale: 1.0, defaultZ: 0 },
                                    { tier: 'OWNERSHIP', label: 'ABSOLUTE', price: '€222', id: 'ownership', defaultX: '8%', defaultRotY: '-8deg', defaultScale: 0.82, defaultZ: -60 },
                                ] as { tier: string, label: string, price: string, id: string, defaultX: string, defaultRotY: string, defaultScale: number, defaultZ: number }[]).map((sub, i) => {
                                    const isHovered = hoveredSub === sub.id;
                                    const anyHovered = hoveredSub !== null;
                                    const isCenter = sub.id === 'royal';
                                    // Active = hovered card comes forward; if nothing hovered, Royal is active
                                    const isActive = anyHovered ? isHovered : isCenter;
                                    const isBehind = anyHovered && !isHovered;

                                    const transform = isActive
                                        ? `translateY(-30px) scale(1.08) translateZ(0px) rotateY(0deg)`
                                        : isBehind
                                            ? `translateY(20px) scale(0.78) translateZ(-80px) rotateY(${sub.defaultRotY})`
                                            : `translateY(${isCenter ? '-20px' : '15px'}) scale(${sub.defaultScale}) translateZ(${sub.defaultZ}px) rotateY(${sub.defaultRotY})`;

                                    return (
                                        <div key={sub.id}
                                            onMouseEnter={() => setHoveredSub(sub.id)}
                                            onMouseLeave={() => setHoveredSub(null)}
                                            style={{
                                                position: 'relative',
                                                width: '26%',
                                                flexShrink: 0,
                                                marginLeft: i === 0 ? 0 : '-6%',
                                                transform,
                                                transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
                                                zIndex: isActive ? 10 : isBehind ? 1 : isCenter ? 5 : 2,
                                                cursor: 'pointer',
                                                filter: isBehind ? 'brightness(0.6)' : isActive ? 'brightness(1.1)' : 'brightness(0.85)',
                                                transformStyle: 'preserve-3d',
                                            }}>
                                            <img src="https://upcdn.io/kW2K8hR/raw/pictures/unnamed%20(2)%20(1).png" alt="" loading="lazy" decoding="async" style={{ width: '100%', display: 'block', pointerEvents: 'none', userSelect: 'none' }} />

                                            {/* TOP STRIP */}
                                            <div style={{ position: 'absolute', top: '19%', left: '8%', right: '8%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                                <div style={{ fontFamily: 'Cinzel', fontSize: 'clamp(0.5rem, 1.2vw, 0.9rem)', color: '#d4af37', letterSpacing: 'clamp(2px, 0.5vw, 6px)', fontWeight: 'bold', textShadow: '0 2px 8px rgba(0,0,0,0.9)', textAlign: 'center', whiteSpace: 'nowrap' }}>{sub.tier}</div>
                                            </div>

                                            {/* CENTER — PRICE */}
                                            <div style={{ position: 'absolute', top: '35%', left: '10%', right: '10%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                                <span style={{ fontFamily: 'Cinzel', fontSize: 'clamp(1.5rem, 3.5vw, 3rem)', fontWeight: 900, color: '#f3e5ab', textShadow: '0 4px 30px rgba(0,0,0,1), 0 0 20px rgba(212,175,55,0.3)', lineHeight: 1 }}>{sub.price}</span>
                                                <div style={{ fontFamily: 'Cinzel', fontSize: 'clamp(0.35rem, 0.7vw, 0.5rem)', color: '#d4af37', letterSpacing: 4 }}>/ MONTH</div>
                                            </div>

                                            {/* BOTTOM STRIP */}
                                            <div style={{ position: 'absolute', bottom: '11%', left: '8%', right: '8%', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }}
                                                onClick={() => (window as any).handleSubscribe?.(sub.id)}>
                                                <div style={{ fontFamily: 'Cinzel', fontSize: 'clamp(0.5rem, 1.1vw, 0.8rem)', color: '#f3e5ab', letterSpacing: 'clamp(2px, 0.5vw, 5px)', textShadow: '0 2px 8px rgba(0,0,0,0.9)', fontWeight: 'bold', whiteSpace: 'nowrap' }}>SUBSCRIBE</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* TITLE — between subscriptions and coins */}
                        <div style={{ width: '100%', display: 'flex', alignItems: 'center', margin: '10px 0 30px' }}>
                            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.7))' }} />
                            <div style={{ padding: '0 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                                <div style={{ fontFamily: 'Cinzel', fontSize: '2rem', fontWeight: 900, letterSpacing: 8, background: 'linear-gradient(to bottom, #fff8d0, #c8960c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', whiteSpace: 'nowrap' }}>ROYAL EXCHEQUER</div>
                                <div style={{ fontFamily: 'Cinzel', fontSize: '0.6rem', color: 'rgba(212,175,55,0.6)', letterSpacing: 6 }}>THE EMPEROR'S TREASURY</div>
                            </div>
                            <div style={{ flex: 1, height: 1, background: 'linear-gradient(270deg, transparent, rgba(212,175,55,0.7))' }} />
                        </div>

                        {/* ── SECTION 2: BUY COINS ── */}
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 30 }}>
                            <div style={{ fontFamily: 'Cinzel', fontSize: '0.7rem', color: 'rgba(212,175,55,0.65)', letterSpacing: 6, marginBottom: 10 }}>TREASURY VAULT</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 18, width: '100%' }}>
                                {([
                                    { amount: '150,000', price: '€1,000', coins: 150000, badge: 'EMPEROR' },
                                    { amount: '70,000', price: '€500', coins: 70000, badge: 'BEST VALUE' },
                                    { amount: '30,000', price: '€250', coins: 30000, badge: null },
                                    { amount: '12,000', price: '€100', coins: 12000, badge: null },
                                    { amount: '5,500', price: '€50', coins: 5500, badge: null },
                                ] as { amount: string, price: string, coins: number, badge: string | null }[]).map(pkg => (
                                    <div key={pkg.coins} onClick={() => (window as any).buyRealCoins(pkg.coins)}
                                        style={{ position: 'relative', cursor: 'pointer', transition: 'transform 0.25s ease', width: 320, flexShrink: 0 }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.04)'; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; }}>
                                        <img src="https://upcdn.io/kW2K8hR/raw/pictures/unnamed%20(1).png" alt="" loading="lazy" decoding="async" style={{ width: '100%', display: 'block', userSelect: 'none', pointerEvents: 'none' }} />
                                        <div style={{ position: 'absolute', top: '16%', left: '18%', right: '18%', bottom: '20%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                            {pkg.badge && (
                                                <div style={{ fontFamily: 'Cinzel', fontSize: '0.5rem', color: '#c8960c', letterSpacing: 2, border: '1px solid #c8960c', padding: '2px 6px', borderRadius: 2 }}>{pkg.badge}</div>
                                            )}
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
            </div>

            <div id="MOBILE_APP" style={{ display: 'none' }}>
                <div id="viewMobileHome" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', maxWidth: '100vw', height: '100dvh', overflowY: 'auto', overflowX: 'hidden', display: 'block', padding: 0, zIndex: 1, background: 'transparent' }}>
                    <div className="mob-hud-row">
                        <div className="hud-circle slave" onClick={() => (window as any).openLobby()}>
                            <div className="hud-avatar">
                                <img id="hudUserPic" src={getOptimizedUrl(profile?.avatar_url || profile?.profile_picture_url || "https://static.wixstatic.com/media/ce3e5b_e06c7a2254d848a480eb98107c35e246~mv2.png", 100)} alt="Your Avatar" onError={(e) => { e.currentTarget.src = 'https://static.wixstatic.com/media/ce3e5b_78da97e06a3848df84d0b00c9e6dcfdd~mv2.png' }} />
                            </div>
                            <div className="hud-gear">⚙</div>
                        </div>
                        <div className="hud-circle queen" onClick={() => (window as any).openQueenMenu()}>
                            <img id="hudSlavePic" src="https://static.wixstatic.com/media/ce3e5b_e06c7a2254d848a480eb98107c35e246~mv2.png" alt="Queen Avatar" onError={(e) => { e.currentTarget.src = 'https://static.wixstatic.com/media/ce3e5b_78da97e06a3848df84d0b00c9e6dcfdd~mv2.png' }} />
                            <div id="hudDomStatus" className="hud-status-dot offline"></div>
                        </div>
                    </div>

                    {/* === SLAVE IDENTITY HUB === */}
                    <div id="lobbyOverlay" className="hub-overlay hidden" style={{ display: 'none' }}>
                        <div className="hub-header">
                            <div>
                                <div className="hub-title">SLAVE IDENTITY HUB</div>
                                <div id="hubEmail" className="hub-subtitle">{profile?.member_id || ""}</div>
                            </div>
                            <button className="hub-close-btn" onClick={() => (window as any).closeLobby()}>✕</button>
                        </div>

                        <div className="hub-scroll">
                            {/* MAIN MENU */}
                            <div id="lobbyMenu" className="lobby-content">
                                <button className="hub-action-row" onClick={() => (window as any).showLobbyAction('name')}>
                                    <div className="hub-action-left">
                                        <div className="hub-action-icon-wrap">✎</div>
                                        <div>
                                            <div className="hub-action-label">CHANGE NAME</div>
                                            <div className="hub-action-desc">Update your display name</div>
                                        </div>
                                    </div>
                                    <span className="hub-action-cost">100 ₡</span>
                                </button>
                                <button className="hub-action-row" onClick={() => (window as any).showLobbyAction('photo')}>
                                    <div className="hub-action-left">
                                        <div className="hub-action-icon-wrap">◉</div>
                                        <div>
                                            <div className="hub-action-label">UPDATE PHOTO</div>
                                            <div className="hub-action-desc">Replace profile picture</div>
                                        </div>
                                    </div>
                                    <span className="hub-action-cost">500 ₡</span>
                                </button>
                                <button className="hub-action-row" onClick={() => (window as any).showLobbyAction('routine')}>
                                    <div className="hub-action-left">
                                        <div className="hub-action-icon-wrap">◈</div>
                                        <div>
                                            <div className="hub-action-label">SET ROUTINE</div>
                                            <div className="hub-action-desc">Select mandatory protocol</div>
                                        </div>
                                    </div>
                                    <span className="hub-action-cost">300 ₡</span>
                                </button>
                                <button className="hub-action-row" onClick={() => (window as any).showLobbyAction('kinks')}>
                                    <div className="hub-action-left">
                                        <div className="hub-action-icon-wrap">⬡</div>
                                        <div>
                                            <div className="hub-action-label">KINKS</div>
                                            <div className="hub-action-desc">Define your preferences</div>
                                        </div>
                                    </div>
                                    <span className="hub-action-cost">50 ₡</span>
                                </button>
                                <button className="hub-action-row" onClick={() => (window as any).showLobbyAction('limits')}>
                                    <div className="hub-action-left">
                                        <div className="hub-action-icon-wrap">⊗</div>
                                        <div>
                                            <div className="hub-action-label">LIMITS</div>
                                            <div className="hub-action-desc">Set your hard boundaries</div>
                                        </div>
                                    </div>
                                    <span className="hub-action-cost">50 ₡</span>
                                </button>
                                <div className="hub-logout-row">
                                    <button className="hub-logout-btn" onClick={() => (window as any).handleLogout()}>LOGOUT</button>
                                </div>
                            </div>

                            {/* ACTION SUB-VIEW (shown by showLobbyAction) */}
                            <div id="lobbyActionView" className="lobby-content hidden hub-action-view">
                                <div id="lobbyPrompt" className="hub-prompt"></div>
                                <input type="text" id="lobbyInputText" className="lobby-input hidden hub-text-input" placeholder="Type here..." />
                                <button id="lobbyInputFileBtn" className="hub-file-btn hidden" onClick={() => document.getElementById('lobbyFile')?.click()}>PICK PHOTO</button>
                                <input type="file" id="lobbyFile" hidden onChange={(e: any) => { const btn = document.getElementById('lobbyInputFileBtn'); if (btn) btn.innerText = 'PHOTO SELECTED ✓'; }} />
                                <div id="routineSelectionArea" className="hidden" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div className="routine-grid">
                                        <div className="routine-tile" onClick={(e: any) => (window as any).selectRoutineItem(e.currentTarget, 'Morning Kneel')}>Morning Kneel</div>
                                        <div className="routine-tile" onClick={(e: any) => (window as any).selectRoutineItem(e.currentTarget, 'Chastity Check')}>Chastity Check</div>
                                        <div className="routine-tile" onClick={(e: any) => (window as any).selectRoutineItem(e.currentTarget, 'Cleanliness Check')}>Cleanliness Check</div>
                                        <div className="routine-tile special" onClick={(e: any) => (window as any).selectRoutineItem(e.currentTarget, 'custom')}>CREATE OWN (+1000)</div>
                                    </div>
                                    <input type="text" id="routineCustomInput" className="lobby-input hidden" placeholder="Describe your routine..." style={{ marginTop: '10px' }} />
                                </div>
                                <div id="kinkSelectionArea" className="hidden" style={{ width: '100%' }}>
                                    <div id="kinkGrid" className="routine-grid"></div>
                                </div>
                                <div className="hub-cost-row"><span className="hub-cost-label">COST</span><span id="lobbyCostDisplay" className="hub-cost-val">0 ₡</span></div>
                                <button id="btnLobbyConfirm" className="hub-confirm-btn" onClick={() => (window as any).confirmLobbyAction()}>CONFIRM & PAY</button>
                                <button className="hub-back-btn" onClick={() => (window as any).backToLobbyMenu()}>← BACK</button>
                            </div>
                        </div>
                    </div>

                    {/* === QUEEN COMMAND HUB === */}
                    <div id="queenOverlay" className="hub-overlay hidden" style={{ display: 'none' }}>
                        <div className="hub-header">
                            <div>
                                <div className="hub-title">QUEEN COMMAND HUB</div>
                                <div className="hub-subtitle">SUPREME AUTHORITY PORTAL</div>
                            </div>
                            <button className="hub-close-btn" onClick={() => (window as any).closeQueenMenu()}>✕</button>
                        </div>

                        <div className="hub-scroll">
                            {/* MANDATORY PROTOCOL */}
                            <div className="hub-section">
                                <div className="hub-section-label">MANDATORY PROTOCOL</div>
                                <div id="mobRoutineDisplay" className="hub-routine-text">LOADING...</div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginTop: '14px' }}>
                                    <button id="btnRoutineUpload" className="hub-confirm-btn" onClick={() => document.getElementById('routineUploadInput')?.click()}>UPLOAD PROOF</button>
                                    <div id="routineTimeMsg" className="hidden" style={{ fontFamily: 'Orbitron', fontSize: '0.55rem', color: '#555', letterSpacing: '1px' }}>WINDOW CLOSED</div>
                                    <div id="routineDoneMsg" className="hidden" style={{ fontFamily: 'Orbitron', fontSize: '0.75rem', color: '#00cc66', letterSpacing: '2px', textShadow: '0 0 10px rgba(0,204,102,0.5)' }}>✔ SUBMITTED</div>
                                </div>
                            </div>

                            {/* KNEELING HISTORY */}
                            <div className="hub-section">
                                <div className="hub-section-label">KNEELING HISTORY</div>
                                <div id="queen_kneelDots" className="halo-dots-grid" style={{ margin: '14px 0 10px' }}></div>
                                <div className="hub-kneel-bar-wrap">
                                    <div className="mob-kneel-bar" style={{ height: '32px', cursor: 'default', border: '1px solid rgba(197,160,89,0.3)', borderRadius: '4px', background: 'rgba(0,0,0,0.4)' }}>
                                        <div id="kneelDailyFill" className="mob-bar-fill" style={{ background: 'linear-gradient(90deg,#c5a059,#f0d080)' }}></div>
                                        <div className="mob-bar-content" style={{ width: '100%', justifyContent: 'center' }}>
                                            <span id="kneelDailyText" style={{ fontFamily: 'Orbitron', fontSize: '0.75rem', color: '#fff', fontWeight: 700 }}>0 / 8</span>
                                        </div>
                                    </div>
                                    <div className="hub-kneel-legend">
                                        <span className="hub-legend-dot lit"></span><span>KNEELED</span>
                                        <span className="hub-legend-dot dim"></span><span>MISSED</span>
                                        <span className="hub-legend-dot off"></span><span>AHEAD</span>
                                    </div>
                                </div>
                            </div>

                            {/* LABOR RECORDS */}
                            <div className="hub-section">
                                <div className="hub-section-label">LABOR RECORDS</div>
                                <div className="hub-stats-row">
                                    <div className="hub-stat-block">
                                        <div id="mobStreak" className="hub-stat-val">0</div>
                                        <div className="hub-stat-lbl">DAY STREAK</div>
                                    </div>
                                    <div className="hub-stat-divider"></div>
                                    <div className="hub-stat-block">
                                        <div id="mobTotal" className="hub-stat-val gold">0</div>
                                        <div className="hub-stat-lbl">TOTAL SERVED</div>
                                    </div>
                                </div>
                            </div>

                            {/* SYSTEM DIAGNOSTICS */}
                            <div className="hub-section">
                                <div className="hub-section-label">SYSTEM DIAGNOSTICS</div>
                                <div className="hub-diag-row">
                                    <span className="hub-diag-dot ok"></span>
                                    <span className="hub-diag-text">SUPABASE CONNECTED</span>
                                </div>
                                <div className="hub-diag-row">
                                    <span className="hub-diag-dot ok"></span>
                                    <span className="hub-diag-text">REALTIME ACTIVE</span>
                                </div>
                                <div className="hub-diag-row">
                                    <span className="hub-diag-dot ok"></span>
                                    <span id="diagSyncTime" className="hub-diag-text">LAST SYNC: —</span>
                                </div>
                                <div className="hub-diag-row">
                                    <span className="hub-diag-dot ok"></span>
                                    <span id="diagUserEmail" className="hub-diag-text">SESSION: —</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div id="povertyOverlay" className="mob-reward-overlay hidden" style={{ display: 'none' }}>
                        <div className="mob-reward-card" style={{ borderColor: '#ff003c', boxShadow: '0 0 30px rgba(255, 0, 60, 0.2)' }}>
                            <div className="mob-hex-wrap small-reward" style={{ background: 'linear-gradient(135deg, #ff003c, #000)' }}>
                                <div className="mob-rank-stamp" style={{ right: 'auto', left: '-5px', color: '#fff', borderColor: '#fff' }}>DENIED</div>
                            </div>
                            <h2 className="mob-reward-title" style={{ color: '#ff003c' }}>INSUFFICIENT CAPITAL</h2>
                            <div id="povertyInsult" style={{ fontFamily: 'Cinzel', color: '#ccc', fontSize: '0.85rem', lineHeight: 1.4, padding: '0 10px' }}>"You cannot afford my attention."</div>
                            <div className="mob-reward-actions" style={{ marginTop: '10px' }}>
                                <button onClick={() => (window as any).goToExchequer()} className="mob-action-btn" style={{ borderColor: '#ff003c', color: '#ff003c' }}>BOOST WALLET</button>
                                <button onClick={() => (window as any).closePoverty()} className="mob-action-btn" style={{ borderColor: '#444', color: '#888' }}>APOLOGIZE & RETURN</button>
                            </div>
                        </div>
                    </div>


                    <div id="mobKneelReward" className="mob-reward-overlay hidden" style={{ display: 'none' }}>
                        <div className="mob-reward-card">
                            <div className="mob-hex-wrap small-reward">
                                <div className="mob-rank-stamp" style={{ right: 'auto', left: '-5px', color: '#fff', borderColor: '#fff' }}>AUTHORIZED</div>
                            </div>
                            <h2 className="mob-reward-title" style={{ color: '#c5a059', fontFamily: 'Cinzel', letterSpacing: '2px' }}>DEVOTION RECOGNIZED</h2>
                            <div className="mob-reward-actions" style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                                <button onClick={() => (window as any).claimKneelReward('coins')} className="mob-action-btn" style={{ borderColor: '#ffd700', color: '#ffd700' }}>CLAIM COINS</button>
                                <button onClick={() => (window as any).claimKneelReward('points')} className="mob-action-btn" style={{ borderColor: '#fff', color: '#fff' }}>CLAIM MERIT</button>
                            </div>
                        </div>
                    </div>

                    <div id="rewardCardOverlay" className="mob-reward-overlay hidden" style={{ display: 'none' }} onClick={() => (window as any).closeRewardCard()}>
                        <div className="mob-reward-card" onClick={(e) => e.stopPropagation()}>
                            <div className="rc-header">
                                <div id="rcIcon" className="rc-icon-large"></div>
                                <div className="rc-meta">
                                    <div id="rcTitle" className="rc-title">TITLE</div>
                                    <div id="rcStatus" className="rc-status">LOCKED</div>
                                </div>
                            </div>
                            <div id="rcQuote" className="rc-quote">...</div>
                            <div className="rc-progress-wrap">
                                <div className="rc-progress-labels"><span id="rcCurrent">0</span><span id="rcTarget">/ 100</span></div>
                                <div className="rc-track">
                                    <div id="rcFill" className="rc-fill"></div>
                                </div>
                            </div>
                            <button className="mob-action-btn" onClick={() => (window as any).closeRewardCard()}>ACKNOWLEDGE</button>
                        </div>
                    </div>

                    <div id="mobExchequer" className="mob-reward-overlay hidden" style={{ zIndex: 2147483640, display: 'none' }}>
                        <div className="mob-reward-card lobby-card" style={{ border: '1px solid #c5a059' }}>
                            <div className="lobby-header">
                                <div className="lobby-title">EXCHEQUER</div>
                            </div>
                            <div className="coin-grid">
                                <div className="coin-tile" onClick={() => (window as any).buyRealCoins(1000)}>
                                    <div className="coin-amount">1,000</div>
                                    <div className="coin-price">€10.00</div>
                                </div>
                                <div className="coin-tile" onClick={() => (window as any).buyRealCoins(5500)}>
                                    <div className="coin-amount">5,500</div>
                                    <div className="coin-price">€50.00</div>
                                </div>
                                <div className="coin-tile" onClick={() => (window as any).buyRealCoins(12000)}>
                                    <div className="coin-amount">12,000</div>
                                    <div className="coin-price">€100.00</div>
                                </div>
                                <div className="coin-tile" onClick={() => (window as any).buyRealCoins(30000)}>
                                    <div className="coin-amount">30,000</div>
                                    <div className="coin-price">€250.00</div>
                                </div>
                                <div className="coin-tile" onClick={() => (window as any).buyRealCoins(70000)}>
                                    <div className="coin-amount">70,000</div>
                                    <div className="coin-price">€500.00</div>
                                </div>
                                <div className="coin-tile" onClick={() => (window as any).buyRealCoins(150000)}>
                                    <div className="coin-amount">150,000</div>
                                    <div className="coin-price">€1000.00</div>
                                </div>
                            </div>
                            <button className="lobby-btn close" onClick={() => (window as any).closeExchequer()} style={{ marginTop: '20px' }}>CLOSE</button>
                        </div>
                    </div>

                    <div id="mobHomeScroll" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 0, boxSizing: 'border-box' }}>

                        {/* 1. HALO HERO SECTION */}
                        <div className="halo-hero">
                            {/* Large halo circle */}
                            <div className="halo-circle-lg">
                                <div id="mob_slaveName" className="halo-name-lg">{profile?.name || "SLAVE"}</div>
                                <div id="mob_rankStamp" className="halo-rank-lg">{profile?.hierarchy || profile?.rank || "INITIATE"}</div>
                                <div className="halo-progress-label">DAILY PROGRESS</div>
                                <div id="mob_kneelDots" className="halo-dots-grid"></div>
                            </div>

                            {/* Stats pill */}
                            <div className="halo-stats-pill">
                                <div className="h-stat">
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                        <span className="h-val" id="mobPoints">{profile?.score || 0}</span>
                                        <svg width="24" height="24" viewBox="0 0 512 512" fill="#c5a059" style={{ opacity: 0.8 }}><path d="M256 0c17.7 0 32.5 11.5 37.6 28.5l25.6 85.3 89.6-16.4c16.2-3 32.8 5.7 39.5 20.9s1.3 33-12.7 44.5l-69.8 57.6 44.8 80.1c8.4 15 3.9 34.3-10.3 43.6s-32.5 6.4-44.5-6.7L256 270 156.2 337.4c-12 13.1-30.3 16-44.5 6.7s-18.7-28.6-10.3-43.6l44.8-80.1-69.8-57.6c-14-11.5-19.4-30.6-12.7-44.5s23.3-23.9 39.5-20.9l89.6 16.4 25.6-85.3C223.5 11.5 238.3 0 256 0zm0 432c-15.1 0-29.3 6.9-38.6 18.6l-50 62.5c-11.1 13.9-6.9 34.4 7 45.5s34.4 6.9 45.5-7l36.1-45.1 36.1 45.1c11.1 13.9 31.6 18.1 45.5 7s18.1-31.6 7-45.5l-50-62.5c-9.3-11.7-23.5-18.6-38.6-18.6z" /></svg>
                                    </div>
                                    <span className="h-lbl">MERIT</span>
                                </div>
                                <div className="h-divider"></div>
                                <div className="h-stat">
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                        <span className="h-val" id="mobCoins">{profile?.wallet || 0}</span>
                                        <svg width="24" height="24" viewBox="0 0 512 512" fill="#c5a059"><path d="M512 80c0 18-14.3 34.6-38.4 48c-29.1 16.1-72.5 27.5-122.3 30.9c-3.7-1.8-7.4-3.5-11.3-5C300.6 137.4 248.2 128 192 128c-8.3 0-16.4 .2-24.5 .6l-1.1-.6C142.3 114.6 128 98 128 80c0-44.2 86-80 192-80S512 35.8 512 80zM160.7 161.1c10.2-.7 20.7-1.1 31.3-1.1c62.2 0 117.4 12.3 152.5 31.4C369.3 210.6 384 227.2 384 245.6c0 11.4-5.5 22.1-15.2 31.4c-21.2 20.4-66.2 34.1-118.4 34.9c-10.2 .2-20.7 .3-31.3 .3c-62.2 0-117.4-12.3-152.5-31.4C42.7 261.4 28 244.8 28 226.4c0-11.4 5.5-22.1 15.2-31.4c21.2-20.4 66.2-34.1 117.5-33.9zM512 192c0 18-14.3 34.6-38.4 48c-29.1 16.1-72.5 27.5-122.3 30.9c-3.7-1.8-7.4-3.5-11.3-5c27.6-11 48-28.7 54.1-49.3c5-16.7-2.6-33.8-19.1-44.9c-10-6.7-22.9-12-38.2-16.2c-5.8-1.6-11.8-3-18.1-4.2C384 167.6 448 183.3 512 192zM512 304c0 18-14.3 34.6-38.4 48c-29.1 16.1-72.5 27.5-122.3 30.9c-3.7-1.8-7.4-3.5-11.3-5c27.6-11 48-28.7 54.1-49.3c5-16.7-2.6-33.8-19.1-44.9c-10-6.7-22.9-12-38.2-16.2c-5.8-1.6-11.8-3-18.1-4.2C384 279.6 448 295.3 512 304zM512 416c0 18-14.3 34.6-38.4 48c-29.1 16.1-72.5 27.5-122.3 30.9c-3.7-1.8-7.4-3.5-11.3-5c27.6-11 48-28.7 54.1-49.3c5-16.7-2.6-33.8-19.1-44.9c-10-6.7-22.9-12-38.2-16.2c-5.8-1.6-11.8-3-18.1-4.2C384 391.6 448 407.3 512 416zM320 388c0 30.6-55.8 56-128 56S64 418.6 64 388v-43c30.2 18 73.1 29 128 29s97.8-11 128-29v43zM320 276c0 30.6-55.8 56-128 56S64 306.6 64 276v-43c30.2 18 73.1 29 128 29s97.8-11 128-29v43zM192 128c-72.2 0-128 25.4-128 56s55.8 56 128 56s128-25.4 128-56s-55.8-56-128-56z" /></svg>
                                    </div>
                                    <span className="h-lbl">COINS</span>
                                </div>
                            </div>
                        </div>

                        {/* SLAVE STATS DRAWER */}
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 16px', boxSizing: 'border-box' }}>
                            <div className="mob-stats-toggle-btn" onClick={() => (window as any).toggleMobileStats()}>
                                SLAVE STATS <span id="mobStatsArrow">▼</span>
                            </div>
                            <div id="mobStatsContent" className="mob-internal-drawer">
                                <div style={{ width: '100%', textAlign: 'center', paddingBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '15px' }}>
                                    <div style={{ fontFamily: 'Cinzel', fontSize: '0.6rem', color: '#666', letterSpacing: '2px' }}>CURRENT CLASSIFICATION</div>
                                    <div id="drawer_CurrentRank" style={{ fontFamily: 'Cinzel', fontSize: '1.2rem', color: '#fff', margin: '5px 0', textTransform: 'uppercase' }}>{profile?.hierarchy || '—'}</div>
                                    <div id="drawer_CurrentBenefits" style={{ fontFamily: 'Cinzel', fontSize: '0.65rem', color: '#888', fontStyle: 'italic', padding: '0 10px', lineHeight: 1.4 }}></div>
                                </div>
                                <div style={{ width: '100%', textAlign: 'center', marginBottom: '15px' }}>
                                    <div style={{ fontFamily: 'Orbitron', fontSize: '0.6rem', color: '#c5a059', letterSpacing: '2px' }}>WORKING ON PROMOTION TO</div>
                                    <div id="drawer_NextRank" style={{ fontFamily: 'Orbitron', fontSize: '1.4rem', color: '#c5a059', fontWeight: 900, letterSpacing: '1px', marginTop: '5px', textShadow: '0 0 15px rgba(197,160,89,0.3)', textTransform: 'uppercase' }}>—</div>
                                </div>
                                <div id="drawer_ProgressContainer" style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '15px', marginBottom: '20px' }}></div>
                                <div style={{ width: '100%', textAlign: 'left', padding: '0 5px' }}>
                                    <div style={{ fontFamily: 'Orbitron', fontSize: '0.6rem', color: '#c5a059', marginBottom: '8px' }}>PRIVILEGES GRANTED</div>
                                    <ul id="drawer_NextBenefits" style={{ color: '#ccc', fontSize: '0.75rem', fontFamily: 'Cinzel', paddingLeft: '20px', lineHeight: 1.6, margin: 0 }}></ul>
                                </div>
                            </div>
                        </div>

                        {/* MOBILE KNEELING BUTTON */}
                        <div style={{ padding: '12px 20px 24px', width: '100%', boxSizing: 'border-box' }}>
                            <div id="mobKneelBar" className="mob-kneel-bar mob-kneel-zone"
                                onContextMenu={(e) => e.preventDefault()}
                                style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' } as React.CSSProperties}>
                                <div id="mob_kneelFill" className="mob-bar-fill"></div>
                                <div className="mob-bar-content">
                                    <span className="kneel-icon-sm">◈</span>
                                    <span id="mob_kneelText" className="kneel-text kneel-label">HOLD TO KNEEL</span>
                                </div>
                            </div>
                        </div>


                        {/* CURRENT STATUS */}
                        <div style={{ width: '100%', marginTop: '20px' }}>
                            <div className="duty-label">CURRENT STATUS</div>
                            <div className="luxury-card">
                                <div id="qm_TaskIdle" className="hidden" style={{ textAlign: 'center' }}>
                                    <div className="txt-status-red" style={{ marginBottom: '16px' }}>UNPRODUCTIVE</div>
                                    <button id="mobNewTaskBtn" className="lobby-btn" onClick={() => (window as any).mobileRequestTask()}>REQUEST TASK</button>
                                    <div id="mobRequestWarningBox" style={{ display: 'none', flexDirection: 'column', gap: 12, marginTop: '10px', alignItems: 'center', width: '100%', border: '1px solid rgba(255,0,60,0.5)', background: 'rgba(20,0,0,0.8)', padding: '20px', borderRadius: '8px', backdropFilter: 'blur(5px)' }}>
                                        <div style={{ color: '#ff003c', fontFamily: 'Cinzel', fontSize: '0.9rem', textAlign: 'center', fontWeight: 'bold', letterSpacing: '1px' }}>INSUFFICIENT CAPITAL</div>
                                        <button className="action-btn" onClick={() => (window as any).goToExchequer()} style={{ width: '100%', background: 'linear-gradient(90deg, #ff003c 0%, #8b0000 100%)', color: 'white', fontWeight: 'bold', border: '1px solid #ff003c', padding: '15px', borderRadius: '8px', fontSize: '0.8rem', letterSpacing: '2px' }}>ADD COINS</button>
                                        <button className="text-btn" onClick={() => (window as any).cancelRequestWarning()} style={{ width: '100%', color: '#ccc', fontFamily: 'Orbitron', fontSize: '0.75rem', letterSpacing: 1, background: 'none', border: 'none', padding: '10px' }}>RETURN TO SERVE</button>
                                    </div>
                                </div>
                                <div id="qm_TaskActive" className="hidden" style={{ textAlign: 'center' }}>
                                    <div className="txt-status-green" style={{ marginBottom: '5px' }}>
                                        <span className="working-dot"></span> WORKING
                                    </div>
                                    <div id="mobTaskText" style={{ marginBottom: '10px', minHeight: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', lineHeight: 1.3, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>LOADING ORDER...</div>
                                    <div className="card-timer-row">
                                        <div id="qm_timerH" className="card-t-box">00</div>:
                                        <div id="qm_timerM" className="card-t-box">00</div>:
                                        <div id="qm_timerS" className="card-t-box">00</div>
                                    </div>
                                    <div id="mobSkipWarningBox" style={{ display: 'none', flexDirection: 'column', gap: 12, marginTop: '10px', marginBottom: '10px', alignItems: 'center', width: '100%', border: '1px solid rgba(255,0,60,0.5)', background: 'rgba(20,0,0,0.8)', padding: '20px', borderRadius: '8px', backdropFilter: 'blur(5px)' }}>
                                        <div style={{ color: '#ff003c', fontFamily: 'Cinzel', fontSize: '0.9rem', textAlign: 'center', fontWeight: 'bold', letterSpacing: '1px' }}>INSUFFICIENT CAPITAL</div>
                                        <button className="action-btn" onClick={() => (window as any).goToExchequer()} style={{ width: '100%', background: 'linear-gradient(90deg, #ff003c 0%, #8b0000 100%)', color: 'white', fontWeight: 'bold', border: '1px solid #ff003c', padding: '12px', borderRadius: '8px', fontSize: '0.8rem', letterSpacing: '2px' }}>ADD COINS</button>
                                        <button className="text-btn" onClick={() => (window as any).cancelSkipWarning()} style={{ width: '100%', color: '#ccc', fontFamily: 'Orbitron', fontSize: '0.75rem', letterSpacing: 1, background: 'none', border: 'none', padding: '5px' }}>RETURN TO SERVE</button>
                                    </div>
                                    <div id="mobUploadBtnContainer" style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '15px' }}>
                                        <button id="mobBtnUpload" className="btn-upload-sm" onClick={() => document.getElementById('evidenceInputMob')?.click()}>UPLOAD TASK</button>
                                        <button id="mobBtnSkip" className="btn-skip-sm" onClick={() => (window as any).mobileSkipTask()}>SKIP TASK</button>
                                    </div>
                                    <div id="mobSkipConfirmContainer" style={{ display: 'none', flexDirection: 'column', gap: 15, marginTop: 15, alignItems: 'center', background: 'rgba(20, 0, 0, 0.6)', border: '1px solid rgba(255, 0, 60, 0.4)', boxShadow: '0 0 20px rgba(255, 0, 60, 0.1)', backdropFilter: 'blur(10px)', padding: '25px', borderRadius: '12px', width: '100%' }}>
                                        <div style={{ color: '#ff003c', fontFamily: 'Cinzel', fontSize: '1rem', textAlign: 'center', fontWeight: 'bold', letterSpacing: '2px', textShadow: '0 0 10px rgba(255,0,0,0.5)' }}>DISOBEDIENCE HAS A PRICE</div>
                                        <div style={{ color: '#ccc', fontFamily: 'Cinzel', fontSize: '0.8rem', textAlign: 'center', marginBottom: 10, lineHeight: 1.5 }}>Is that skip worth of<br /><span style={{ color: '#ff003c', fontWeight: 'bold' }}>300 coins</span>, pet?</div>
                                        <button id="btnMobConfirmSkip" onClick={() => (window as any).executeSkipTask()} className="action-btn" style={{ width: '90%', background: 'linear-gradient(90deg, #ff003c 0%, #8b0000 100%)', color: 'white', fontWeight: 'bold', border: '1px solid #ff003c', boxShadow: '0 0 15px rgba(255,0,60,0.4)', borderRadius: '8px', padding: '12px', fontSize: '0.85rem', letterSpacing: '2px', cursor: 'pointer', transition: 'all 0.3s ease' }}>ACCEPT PENALTY</button>
                                        <button id="btnMobCancelSkip" onClick={() => (window as any).cancelSkipTask()} className="text-btn" style={{ color: '#888', fontFamily: 'Orbitron', fontSize: '0.75rem', letterSpacing: '1px', padding: 5, width: '95%', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.2s', whiteSpace: 'nowrap' }}>NEVERMIND, I WILL SERVE</button>
                                    </div>
                                    <div id="mobDismissContainer" style={{ display: 'none', flexDirection: 'column', gap: '5px', marginTop: '15px', alignItems: 'center' }}>
                                        <button id="mobBtnDismissTask" className="btn-upload-sm" style={{ borderColor: 'rgba(255,255,255,0.4)', borderWidth: '2px', color: 'white', padding: '15px 0', fontSize: '0.75rem', whiteSpace: 'nowrap', width: '70%' }} onClick={() => (window as any).resetTaskUI()}>THANK YOU, QUEEN KARIN</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* THE ALTAR */}
                        <div id="mobSectionAltar" style={{ width: '100%', marginTop: '20px' }}>
                            <div className="duty-label">THE ALTAR</div>
                            <div className="mob-pyramid-stage" style={{ height: '240px', cursor: 'pointer' }} onClick={() => (window as any).openAltarDrawer()}>
                                <div className="mob-idol side"><img id="mobRec_Slot2" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="Slot 2" onError={(e) => { if (e.currentTarget.dataset.loaded) e.currentTarget.style.display = 'none'; }} /><div className="mob-rank-badge">II</div></div>
                                <div className="mob-idol side right"><img id="mobRec_Slot3" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="Slot 3" onError={(e) => { if (e.currentTarget.dataset.loaded) e.currentTarget.style.display = 'none'; }} /><div className="mob-rank-badge">III</div></div>
                                <div className="mob-idol center"><img id="mobRec_Slot1" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="Slot 1" onError={(e) => { if (e.currentTarget.dataset.loaded) e.currentTarget.style.display = 'none'; }} /><div className="mob-rank-badge main">I</div></div>
                            </div>
                            <div style={{ textAlign: 'center', fontFamily: 'Cinzel', fontSize: '0.6rem', color: '#666', marginTop: '4px' }}>TAP TO VIEW RECORD</div>
                        </div>

                        {/* SLAVE RECORDS */}
                        <div style={{ width: '100%', marginTop: '20px' }}>
                            <div className="duty-label">SLAVE RECORDS</div>
                            <div id="trophySectionJail" style={{ position: 'relative', width: '100%', minHeight: '400px', overflow: 'hidden' }}>
                                <div className="mob-grid-label-center" style={{ textAlign: 'left', paddingLeft: '10px', color: '#666' }}>HIERARCHY</div>
                                <div id="shelfRanks" className="reward-shelf mob-horiz-scroll"></div>
                                <div className="mob-grid-label-center" style={{ textAlign: 'left', paddingLeft: '10px', color: '#666', marginTop: '15px' }}>LABOR MEDALS</div>
                                <div id="shelfTasks" className="reward-shelf mob-horiz-scroll"></div>
                                <div className="mob-grid-label-center" style={{ textAlign: 'left', paddingLeft: '10px', color: '#666', marginTop: '15px' }}>ENDURANCE</div>
                                <div id="shelfKneel" className="reward-shelf mob-horiz-scroll"></div>
                                <div className="mob-grid-label-center" style={{ textAlign: 'left', paddingLeft: '10px', color: '#666', marginTop: '15px' }}>SACRIFICE</div>
                                <div id="shelfSpend" className="reward-shelf mob-horiz-scroll"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ALTAR BACKDROP + DRAWER — siblings of viewMobileHome so position:fixed is relative to viewport, not transformed scroll container */}
                <div id="altarBackdrop" className="altar-backdrop" onClick={() => (window as any).closeAltarDrawer()}></div>

                <div id="altarDrawer" className="altar-drawer">
                    <div className="altar-drawer-topbar">
                        <span className="altar-drawer-title">SLAVE RECORD</span>
                        <button className="altar-drawer-close" onClick={() => (window as any).closeAltarDrawer()}>✕ CLOSE</button>
                    </div>

                    <div className="altar-drawer-content">
                        <div className="altar-section">
                            <button className="altar-section-header" onClick={() => (window as any).toggleAltarSection('routine')}>
                                <span className="altar-section-label">DAILY ROUTINE</span>
                                <span id="altarSec_arrow_routine" className="altar-section-arrow">›</span>
                            </button>
                            <div id="altarSec_routine" className="altar-section-body">
                                <div id="altarGrid_routine" className="altar-photo-grid"></div>
                            </div>
                        </div>

                        <div className="altar-section">
                            <button className="altar-section-header" onClick={() => (window as any).toggleAltarSection('accepted')}>
                                <span className="altar-section-label">ACCEPTED PROTOCOLS</span>
                                <span id="altarSec_arrow_accepted" className="altar-section-arrow">›</span>
                            </button>
                            <div id="altarSec_accepted" className="altar-section-body">
                                <div id="altarGrid_accepted" className="altar-photo-grid"></div>
                            </div>
                        </div>

                        <div className="altar-section">
                            <button className="altar-section-header" onClick={() => (window as any).toggleAltarSection('rejected')}>
                                <span className="altar-section-label" style={{ color: '#ff4444' }}>FAILED / DENIED</span>
                                <span id="altarSec_arrow_rejected" className="altar-section-arrow">›</span>
                            </button>
                            <div id="altarSec_rejected" className="altar-section-body">
                                <div id="altarGrid_rejected" className="altar-photo-grid"></div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Global view lives at /global route — not rendered here */}
            <div id="globalViewOverlay" style={{ display: 'none' }}></div>

            {/* ── MOB CHAT OVERLAY — root level, above MOBILE_APP ── */}
            <div id="mobChatOverlay" className="mob-overlay" style={{ display: 'none' }}>
                <div className="mob-overlay-header">
                    <div className="mob-overlay-title-wrap">
                        <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
                            <img src="/queen-karin.png" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(197,160,89,0.4)' }} alt="Queen" />
                            <div id="mobChatOnlineDot" style={{ position: 'absolute', bottom: 2, right: 2, width: 11, height: 11, borderRadius: '50%', background: '#22c55e', border: '2px solid #000', display: 'none' }}></div>
                        </div>
                        <div>
                            <div className="mob-overlay-title">QUEEN KARIN</div>
                            <div id="mobChatStatusText2" style={{ fontFamily: 'Orbitron', fontSize: '0.42rem', color: '#888', letterSpacing: '1px' }}>—</div>
                        </div>
                    </div>
                    <button className="mob-overlay-close" onClick={() => (window as any).closeMobChatOverlay()}>✕</button>
                </div>

                {/* TAB BAR */}
                <div className="mob-gl-tabs">
                    <button id="mobChatBtnChat" className="mob-gl-tab active" onClick={() => (window as any).switchMobChatTab('chat')}>CHAT</button>
                    <button id="mobChatBtnService" className="mob-gl-tab" onClick={() => (window as any).switchMobChatTab('service')}>SERVICE</button>
                </div>

                {/* CHAT TAB */}
                <div id="mobChatTabChat" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                    <div id="mob_chatBox" className="chat-body-frame" style={{ flex: 1, minHeight: 0, position: 'relative', overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none' } as any}>
                        <div id="mob_TributeOverlay" className="hidden" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.98)', zIndex: 9999, display: 'none', flexDirection: 'column', padding: '20px' }}>
                            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
                                <span style={{ fontFamily: 'Cinzel', color: '#c5a059' }}>TRIBUTE STORE</span>
                                <button onClick={() => (window as any).toggleTributeHunt()} style={{ color: 'white', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Orbitron', fontSize: '1.2rem' }}>X</button>
                            </div>
                            <div id="mob_huntStoreGrid" style={{ width: '100%', overflowY: 'auto', paddingBottom: '30px' }}></div>
                        </div>
                        <div id="mob_chatContent" className="chat-area"></div>
                    </div>
                    <div className="chat-footer">
                        <div className="chat-input-wrapper">
                            <button className="chat-btn-plus" onClick={() => (window as any).handleMediaPlus()}>+</button>
                            <input type="text" id="mob_chatMsgInput" className="chat-input" placeholder="Transmit..." onKeyPress={(e: any) => (window as any).handleChatKey(e)} />
                        </div>
                        <button className="chat-btn-tribute" onClick={() => (window as any).toggleTributeHunt()} style={{ background: 'none', border: 'none', outline: 'none', cursor: 'pointer', padding: '0 10px' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#c5a059' }}>
                                <rect x="3" y="8" width="18" height="12" rx="1"></rect>
                                <path d="M12 8v12"></path>
                                <path d="M19 8c-1.5-1.5-3-2-4.5-2C13 6 12 8 12 8s-1-2-2.5-2C8 6 6.5 6.5 5 8"></path>
                            </svg>
                        </button>
                        <button className="chat-btn-send" onClick={() => (window as any).sendChatMessage()}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22 2L11 13" stroke="#c5a059" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="#c5a059" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* SERVICE TAB */}
                <div id="mobChatTabService" style={{ display: 'none', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    <div id="mob_systemLogContent" className="chat-area mob-gl-scroll" style={{ flex: 1 }}></div>
                </div>

                {/* Hidden stub so existing desktop toggle code doesn't error */}
                <div id="mobSystemLogContainer" style={{ display: 'none' }}></div>
            </div>

            {/* ── MOB QUEEN'S WALL OVERLAY — root level ── */}
            <div id="mobQueenWallOverlay" className="mob-overlay" style={{ display: 'none' }}>
                <div className="mob-overlay-header">
                    <div className="mob-overlay-title-wrap">
                        <span className="mob-overlay-title">QUEEN'S WALL</span>
                    </div>
                    <button className="mob-overlay-close" onClick={() => (window as any).closeMobQueenWall()}>✕</button>
                </div>
                <div className="mob-qwall-scroll">
                    <div id="mobQWallContent"></div>
                </div>
            </div>

            {/* ── GLOBAL OVERLAY ── */}
            <div id="mobGlobalOverlay" className="mob-overlay" style={{ display: 'none', flexDirection: 'column' }}>
                <div className="mob-overlay-header">
                    <span className="mob-overlay-title">◎ GLOBAL</span>
                    <button className="mob-overlay-close" onClick={() => (window as any).closeMobGlobal()}>✕</button>
                </div>

                {/* Tab bar */}
                <div className="mob-gl-tabs">
                    <button id="mobGlTab_rank" className="mob-gl-tab active" onClick={() => (window as any).switchMobGlTab('rank')}>RANK</button>
                    <button id="mobGlTab_talk" className="mob-gl-tab" onClick={() => (window as any).switchMobGlTab('talk')}>TALK</button>
                    <button id="mobGlTab_queen" className="mob-gl-tab" onClick={() => (window as any).switchMobGlTab('queen')}>QUEEN</button>
                    <button id="mobGlTab_updates" className="mob-gl-tab" onClick={() => (window as any).switchMobGlTab('updates')}>NEWS</button>
                </div>

                {/* RANK panel */}
                <div id="mobGlPanel_rank" className="mob-gl-panel" style={{ flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    <div className="mob-gl-period-bar">
                        <button id="mobGlPeriod_today" className="mob-gl-period-btn active" onClick={() => (window as any).switchMobGlPeriod('today')}>TODAY</button>
                        <button id="mobGlPeriod_weekly" className="mob-gl-period-btn" onClick={() => (window as any).switchMobGlPeriod('weekly')}>WEEK</button>
                        <button id="mobGlPeriod_monthly" className="mob-gl-period-btn" onClick={() => (window as any).switchMobGlPeriod('monthly')}>MONTH</button>
                        <button id="mobGlPeriod_alltime" className="mob-gl-period-btn" onClick={() => (window as any).switchMobGlPeriod('alltime')}>ALL</button>
                    </div>
                    <div id="mobGlRankList" className="mob-gl-scroll"></div>
                </div>

                {/* TALK panel */}
                <div id="mobGlPanel_talk" className="mob-gl-panel" style={{ flexDirection: 'column', flex: 1, overflow: 'hidden', display: 'none' }}>
                    <div id="mobGlTalkFeed" className="mob-gl-scroll" style={{ flex: 1 }}></div>
                    <div className="mob-gl-talk-footer">
                        <input
                            type="text"
                            id="mobGlTalkInput"
                            className="mob-gl-talk-input"
                            placeholder="speak..."
                            onKeyDown={(e) => (window as any).handleMobGlKey(e.nativeEvent)}
                        />
                        <button className="mob-gl-talk-send" onClick={() => (window as any).sendMobGlMessage()}>▶</button>
                    </div>
                </div>

                {/* QUEEN panel */}
                <div id="mobGlPanel_queen" className="mob-gl-panel" style={{ flexDirection: 'column', flex: 1, overflow: 'hidden', display: 'none' }}>
                    <div id="mobGlQueenFeed" className="mob-gl-scroll"></div>
                </div>

                {/* UPDATES panel */}
                <div id="mobGlPanel_updates" className="mob-gl-panel" style={{ flexDirection: 'column', flex: 1, overflow: 'hidden', display: 'none' }}>
                    <div id="mobGlUpdatesFeed" className="mob-gl-scroll"></div>
                </div>
            </div>

            {/* ── MOBILE BOTTOM NAV — at root level, no stacking context conflicts ── */}
            <nav id="mobBottomNav" className="mob-bottom-nav">
                <button id="mobNavProfile" className="mob-nav-item active" onClick={() => (window as any).mobNavTo('profile')}>
                    <span className="mob-nav-icon">◆</span>
                    <span className="mob-nav-label">PROFILE</span>
                </button>
                <button id="mobNavRecord" className="mob-nav-item" onClick={() => (window as any).openAltarDrawer()}>
                    <span className="mob-nav-icon">▦</span>
                    <span className="mob-nav-label">RECORD</span>
                </button>
                <button className="mob-nav-queen-btn" onClick={() => (window as any).openMobChatOverlay()}>
                    <div className="mob-nav-queen-ring">
                        <img id="navQueenPic" src="/queen-karin.png" className="mob-nav-queen-img" alt="Queen" />
                    </div>
                </button>
                <button id="mobNavQueen" className="mob-nav-item" onClick={() => (window as any).openMobQueenWall()}>
                    <span className="mob-nav-icon">♛</span>
                    <span className="mob-nav-label">QUEEN</span>
                </button>
                <button id="mobNavGlobal" className="mob-nav-item" onClick={() => (window as any).openMobGlobal()}>
                    <span className="mob-nav-icon">◎</span>
                    <span className="mob-nav-label">GLOBAL</span>
                </button>
            </nav>

        </div >
    );
}
