"use client";

import React, { useEffect, useState } from 'react';
import '../../css/profile.css';
import '../../css/profile-mobile.css';
import { initProfileState } from '@/scripts/profile-state';
// 👇 Import the new robust kneeling logic
import { updateKneelingUI, attachKneelListeners } from '@/scripts/kneeling';
import { createClient } from '@/utils/supabase/client';
import {
    // ... keep your imports ...
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
    handleProfileUpload,
    handleAdminUpload,
    handleMediaPlus,
    handleChatKey,
    sendChatMessage,
    buyRealCoins,
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
    renderProfileSidebar,
    handleLogout
} from '@/scripts/profile-logic';

export default function ProfilePage() {
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const supabase = createClient();

    // ─── 1. FETCH PROFILE DATA ───────────────────────────────────────────
    useEffect(() => {
        // Legacy Window Assignments (Only keep the ones NOT handled by kneeling.ts)
        if (typeof window !== 'undefined') {
            (window as any).claimKneelReward = claimKneelReward; // Needed for inline onclick in JSX
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
            (window as any).mobileUploadEvidence = (input: HTMLInputElement) => { console.log("Upload evidence", input.files); };
            (window as any).handleRoutineUpload = handleRoutineUpload;
            (window as any).handleProfileUpload = handleProfileUpload;
            (window as any).handleAdminUpload = handleAdminUpload;
            (window as any).handleMediaPlus = handleMediaPlus;
            (window as any).handleChatKey = handleChatKey;
            (window as any).sendChatMessage = sendChatMessage;
            (window as any).buyRealCoins = buyRealCoins;
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
            (window as any).handleLogout = handleLogout;
        }

        async function loadProfile() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    window.location.href = '/login';
                    return;
                }

                const { data: profileData, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('member_id', user.email)
                    .maybeSingle();

                if (error) console.error('Profile fetch error:', error);

                // Use profile data or fallback
                const finalProfile = profileData || (await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()).data;

                if (finalProfile) {
                    setProfile(finalProfile);
                    initProfileState(finalProfile);
                    
                    // Initialize UI logic that doesn't depend on DOM elements yet
                    setTimeout(() => {
                        renderProfileSidebar(finalProfile);
                        switchTab('serve'); 
                        getRandomTask(true);
                    }, 100);
                }
            } catch (err) {
                console.error("Failed to load profile", err);
            } finally {
                // 👇 This triggers the re-render that shows the buttons
                setLoading(false); 
            }
        }

        loadProfile();
    }, []);

    // ─── 2. ATTACH KNEEL LISTENERS (THE FIX) ─────────────────────────────
    // This runs ONLY after 'loading' becomes false and the buttons exist
    useEffect(() => {
        if (!loading) {
            console.log("DOM Loaded. Attaching Kneel Listeners...");
            // Small timeout to ensure the browser has painted the <div>s
            const timer = setTimeout(() => {
                attachKneelListeners();
                updateKneelingUI();
            }, 300);

            // Start the UI update loop
            const interval = setInterval(updateKneelingUI, 1000);

            return () => {
                clearTimeout(timer);
                clearInterval(interval);
            };
        }
    }, [loading]); // <--- Dependent on loading state

    if (loading) return (
        <div id="loading" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: 'var(--gold)', fontFamily: 'Cinzel' }}>
            LOADING COMMAND CONSOLE...
        </div>
    );

    return (
        <div id="PROFILE_CONTAINER" style={{
            backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), url(https://static.wixstatic.com/media/ce3e5b_13b4c9faf6c5471ca7d292968d40feee~mv2.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed',
            minHeight: '100vh',
            width: '100vw',
            overflowX: 'hidden'
        }}>
           {/* ... REST OF YOUR JSX IS PERFECT, DO NOT CHANGE IT ... */}
           {/* Just verify your mobile button has id="mobKneelBar" */}
           
            {/* SOUNDS & INPUTS */}
            <audio id="msgSound" src="https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3"></audio>
            <audio id="coinSound" src="/audio/2019-preview1.mp3"></audio>
            <audio id="skipSound" src="https://static.wixstatic.com/mp3/ce3e5b_3b5b34d4083847e2b123b6fd9a8551fd.mp3"></audio>

            <input type="file" id="profileUploadInput" accept="image/*" className="hidden" />
            <input type="file" id="routineUploadInput" accept="image/*" className="hidden" />
            <input type="file" id="evidenceInputMob" accept="image/*" className="hidden" />
            <input type="file" id="chatMediaInput" accept="image/*,video/*" className="hidden" />

            {/* CELEBRATION OVERLAY */}
            <div id="celebrationOverlay" className="hidden" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 2147483647, display: 'none', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.3s' }}>
                <div className="glass-card" style={{ border: '2px solid #00ff00', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#00ff00', textShadow: '0 0 20px #00ff00', fontFamily: 'Orbitron' }}>
                        TASK<br />SUBMITTED
                    </div>
                </div>
            </div>

            {/* UNIVERSAL DESKTOP APP */}
            <div id="DESKTOP_APP">
                {/* TRIBUTE STORE OVERLAY */}
                <div id="tributeHuntOverlay" className="hidden" style={{ position: 'fixed', inset: 0, background: 'rgba(2,5,18,0.98)', zIndex: 10000, display: 'none', flexDirection: 'column', padding: '60px', backdropFilter: 'blur(20px)' }}>
                    <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid #333', paddingBottom: '20px' }}>
                        <span style={{ fontFamily: 'Cinzel', color: '#c5a059', fontSize: '2rem', letterSpacing: '6px', fontWeight: 700 }}>TRIBUTE STORE</span>
                        <button onClick={() => toggleTributeHunt()} style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Orbitron', fontSize: '2.5rem', transition: '0.3s' }}>×</button>
                    </div>
                    <div id="huntStoreGridDesk" className="store-grid" style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '25px', padding: '10px' }}></div>
                </div>

                {/* SIDEBAR: SLAVE PROFILE STYLE */}
                <div className="v-sidebar" style={{ backgroundColor: 'transparent', backdropFilter: 'blur(25px)' }}>
                    <div className="v-card" style={{ marginBottom: 20, textAlign: 'center', padding: '25px 15px', marginTop: 20, marginRight: 20, position: 'relative' }}>
                        <div className="big-profile-circle" onClick={() => (document.getElementById('profileUploadInput') as any)?.click()}>
                            <img id="profilePic" src={profile?.avatar_url || profile?.profile_picture_url || "https://static.wixstatic.com/media/ce3e5b_78da97e06a3848df84d0b00c9e6dcfdd~mv2.png"} alt="Avatar" className="profile-img" />
                        </div>
                        <div id="subName" className="identity-name" style={{ fontSize: '1.2rem', letterSpacing: 4, marginBottom: 5, fontWeight: 'bold' }}>
                            {profile?.name || "SLAVE"}
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
                    </div>

                    {/* DESKTOP SIDEBAR SCROLLABLE AREA */}
                    <div className="sidebar-scrollable-area" style={{ flex: 1, overflowY: 'auto', width: '100%', display: 'flex', flexDirection: 'column', padding: '0 15px 0 15px', boxSizing: 'border-box', paddingRight: 30 }}>

                        {/* 1. WHO YOU ARE (Current) */}
                        <div id="deskStatsContent" style={{ width: '100%', textAlign: 'center', paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: 12, flexShrink: 0 }}>
                            <div style={{ fontFamily: 'Cinzel', fontSize: '0.55rem', color: 'rgba(255,255,255,0.4)', letterSpacing: 2 }}>CURRENT CLASSIFICATION</div>
                            <div id="desk_CurrentRank" style={{ fontFamily: 'Cinzel', fontSize: '1.1rem', color: '#fff', margin: '4px 0', textTransform: 'uppercase' }}>{profile?.rank || "LOADING..."}</div>
                            <div id="desk_CurrentBenefits" style={{ fontFamily: 'Cinzel', fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', padding: '0 5px', lineHeight: 1.4 }}></div>
                        </div>

                        {/* 2. THE TARGET (Next Rank - WORKING ON) */}
                        <div id="desk_WorkingOnSection" style={{ width: '100%', textAlign: 'center', paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: 15, flexShrink: 0 }}>
                            <div style={{ fontFamily: 'Orbitron', fontSize: '0.55rem', color: '#c5a059', letterSpacing: 2, marginBottom: 2 }}>WORKING ON</div>
                            <div id="desk_WorkingOnRank" style={{ fontFamily: 'Orbitron', fontSize: '0.9rem', color: '#fff', textTransform: 'uppercase', fontWeight: 'bold' }}>...</div>
                        </div>

                        {/* 3. THE MATH (Progress Bars) */}
                        <div id="desk_ProgressContainer" style={{ width: '100%', marginBottom: 15, flexShrink: 0 }}></div>

                        {/* 4. THE PRIZE (Next Benefits) */}
                        <div style={{ width: '100%', textAlign: 'left', padding: '0 2px', marginBottom: 25, flexShrink: 0 }}>
                            <div style={{ fontFamily: 'Orbitron', fontSize: '0.55rem', color: '#c5a059', marginBottom: 6 }}>PRIVILEGES GRANTED</div>
                            <ul id="desk_NextBenefits" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.7rem', fontFamily: 'Cinzel', paddingLeft: 15, lineHeight: 1.5, margin: 0 }}></ul>
                        </div>

                        {/* 5. NAVIGATION MENU (Inside scrollable flow) */}
                        <div className="nav-menu" style={{ width: '100%', padding: '15px 0', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 20 }}>
                            <button className="nav-btn" onClick={() => switchTab('serve')}>
                                <span style={{ fontSize: '1.2rem', marginRight: 10 }}>🏠</span> DASHBOARD
                            </button>
                            <button className="nav-btn active" onClick={() => switchTab('record')}>
                                <span style={{ fontSize: '1.2rem', marginRight: 10 }}>📜</span> RECORDS
                            </button>
                            <button className="nav-btn" onClick={() => switchTab('news')}>
                                <span style={{ fontSize: '1.2rem', marginRight: 10 }}>👑</span> QUEEN KARIN
                            </button>
                            <button className="nav-btn" onClick={() => switchTab('buy')}>
                                <span style={{ fontSize: '1.2rem', marginRight: 10 }}>💰</span> EXCHEQUER
                            </button>
                            <button className="nav-btn" onClick={() => (window as any).handleLogout()} style={{ marginTop: 20, borderColor: 'rgba(255,0,0,0.3)', color: 'rgba(255,0,0,0.6)' }}>
                                <span style={{ fontSize: '1.2rem', marginRight: 10 }}>🔓</span> LOGOUT
                            </button>
                        </div>
                    </div>
                </div>

                {/* MAIN CONTENT STAGE */}
                <div id="viewServingTopDesktop" className="view-wrapper hidden">
                    <div id="gridStat1" className="v-card v-stat-card serve-grid-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
                        <div className="ribbon-label" style={{ textAlign: 'center' }}>KNEELING HOURS</div>
                        <div className="prog-bg" style={{ height: 25, borderRadius: 12, position: 'relative', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                            <div id="deskKneelDailyFill" className="prog-fill" style={{ width: '0%', background: '#c5a059', height: '100%', transition: 'width 0.5s ease' }}></div>
                            <div id="deskKneelDailyText" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Orbitron', fontSize: '0.8rem', color: 'white', textShadow: '0 1px 3px black' }}>0 / 8</div>
                        </div>
                    </div>

                    <div id="gridStat2" className="v-card v-stat-card serve-grid-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 5 }}>
                        <div className="ribbon-label" style={{ textAlign: 'center' }}>DAILY ROUTINE</div>
                        <div id="deskRoutineDisplay" style={{ fontFamily: 'Orbitron', fontSize: '0.75rem', color: 'white', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 5 }}>LOADING...</div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 5, alignItems: 'center', marginTop: 5, flexDirection: 'column' }}>
                            <button id="deskRoutineUploadBtn" className="v-icon-box" style={{ width: 30, height: 30, borderRadius: 8, fontSize: '0.8rem', cursor: 'pointer', background: '#0075ff' }} onClick={() => (document.getElementById('routineUploadInput') as any)?.click()}>
                                <i className="fas fa-upload"></i>
                            </button>
                            <div id="deskRoutineTimeMsg" className="hidden" style={{ color: '#666', fontFamily: 'Orbitron', fontSize: '0.6rem', textAlign: 'center' }}>NO PROTOCOL</div>
                            <div id="deskRoutineDoneMsg" className="hidden" style={{ color: '#00ff00', fontFamily: 'Orbitron', fontSize: '0.7rem', textAlign: 'center', lineHeight: 1.3 }}>✔ DONE</div>
                        </div>
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

                    <div id="gridStat4" className="v-card v-stat-card serve-grid-item" style={{ flexDirection: 'column', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }} onClick={() => switchTab('record')}>
                        <div className="ribbon-label" style={{ textAlign: 'center' }}>CLASSIFICATION</div>
                        <div id="desk_DashboardRank" style={{ fontFamily: 'Orbitron', fontSize: '1.1rem', color: '#fff', marginTop: 5, textTransform: 'uppercase', fontWeight: 'bold', textShadow: '0 0 10px rgba(197, 160, 89, 0.4)' }}>LOADING...</div>
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
                            <div id="mainButtonsArea" style={{ width: '100%', textAlign: 'center' }}>
                                <button id="newTaskBtn" onClick={() => getRandomTask()} className="action-btn" style={{ width: '100%', borderRadius: 12, background: '#0075ff', color: 'white', padding: 15, fontWeight: 'bold', letterSpacing: 2 }}>REQUEST TASK</button>
                                <div id="idleMessage" style={{ fontFamily: 'Cinzel', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: 10 }}>Awaiting direct orders from the Void...</div>
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
                                <div id="uploadBtnContainer" style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 10, alignItems: 'center' }}>
                                    <button id="uploadBtn" className="action-btn" style={{ width: 180, background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', color: '#c5a059', fontWeight: 'bold', border: '1px solid #c5a059', boxShadow: '0 0 15px rgba(197,160,89,0.2)' }} onClick={() => (document.getElementById('routineUploadInput') as any)?.click()}>UPDATE TASK</button>
                                    <button id="btnSkip" onClick={() => (window as any).skipTask()} className="text-btn" style={{ color: '#aaa', fontFamily: 'Orbitron', fontSize: '0.7rem', letterSpacing: 1, background: 'none', border: 'none', padding: 5, width: 180 }}>SKIP TASK (-300 🪙)</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div id="viewServingTop" className="v-card serve-grid-item" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', borderRadius: 20 }}>
                        <div id="chatCard" className="chat-container" style={{ flex: 1, minHeight: 0, background: 'transparent', margin: 0, border: 'none', borderRadius: 0, display: 'flex', flexDirection: 'column' }}>
                            <div id="chatBox" className="chat-body-frame" style={{ background: 'transparent', flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 !important' }}>
                                <div id="systemTicker" className="system-ticker">SYSTEM ONLINE</div>
                                <div id="chatContent" className="chat-area" style={{ padding: 20 }}></div>
                            </div>
                            <div className="chat-footer" style={{ background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.1)', padding: 15, display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div className="chat-input-wrapper" style={{ flexGrow: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 15 }}>
                                    <button id="btnMediaPlus" className="chat-btn-plus" onClick={() => handleMediaPlus()}>+</button>
                                    <input type="text" id="chatMsgInput" className="chat-input" placeholder="Communicate with the Void..." onKeyPress={handleChatKey} />
                                </div>
                                <button className="chat-btn-send" onClick={() => sendChatMessage()} style={{ background: '#c5a059', borderRadius: 15, width: 45, height: 45, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{'>'}</button>
                            </div>
                        </div>
                    </div>

                    <div id="gridRightSection" className="serve-grid-item" style={{ display: 'flex', flexDirection: 'row', gap: 25, overflow: 'hidden' }}>
                        <div className="v-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <div className="ribbon-label" style={{ marginBottom: 15 }}>TRIBUTE</div>
                            <div id="desk_QuickTribute" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'space-around' }}></div>
                            <button className="action-btn" onClick={() => toggleTributeHunt()} style={{ width: '100%', fontSize: '0.6rem', padding: 6, borderRadius: 8, marginTop: 10, background: 'rgba(255,255,255,0.05)', color: '#888' }}>SEE MORE</button>
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
                        <header className="chronicle-header"><h1 className="chronicle-title">THE CHRONICLES</h1></header>
                        <section className="chronicle-section">
                            <div className="chronicle-section-label">THE SOVEREIGN ALTAR</div>
                            <div className="chronicle-hero">
                                <div id="altarMain" className="hero-main mosaic-card">
                                    <img id="imgAltarMain" src="" className="hero-img" />
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

                <div id="viewNews" className="view-wrapper hidden alt-grid-view" style={{ padding: 0 }}>
                    <div id="newsGrid" className="gallery-grid"></div>
                </div>

                <div id="viewBuy" className="view-wrapper hidden alt-grid-view">
                    <div className="ribbon-label" style={{ alignSelf: 'flex-start' }}>EXCHEQUER</div>
                    <div id="buyCoinsGrid" className="store-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                        <div className="v-card store-item" style={{ background: 'rgba(255,255,255,0.03)' }}>
                            <div style={{ fontSize: '1.2rem', marginBottom: 10 }}>1,000 🪙</div>
                            <button className="action-btn" onClick={() => buyRealCoins(1000)} style={{ fontSize: '0.8rem', background: '#0075ff', color: 'white', border: 'none' }}>€10.00</button>
                        </div>
                        <div className="v-card store-item" style={{ background: 'rgba(255,255,255,0.03)' }}>
                            <div style={{ fontSize: '1.2rem', marginBottom: 10 }}>5,500 🪙</div>
                            <button className="action-btn" onClick={() => buyRealCoins(5500)} style={{ fontSize: '0.8rem', background: '#0075ff', color: 'white', border: 'none' }}>€50.00</button>
                        </div>
                        <div className="v-card store-item" style={{ background: 'rgba(255,255,255,0.03)' }}>
                            <div style={{ fontSize: '1.2rem', marginBottom: 10 }}>12,000 🪙</div>
                            <button className="action-btn" onClick={() => buyRealCoins(12000)} style={{ fontSize: '0.8rem', background: '#0075ff', color: 'white', border: 'none' }}>€100.00</button>
                        </div>
                    </div>
                </div>
            </div>

           {/* 🟢 MOBILE UNIVERSE */}
            <div id="MOBILE_APP" style={{ display: 'none' }}>
                <div id="viewMobileHome" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', maxWidth: '100vw', height: '100dvh', overflowY: 'auto', overflowX: 'hidden', display: 'block', padding: 0, zIndex: 1, background: 'transparent' }}>
                    <div className="mob-hud-row">
                        <div className="hud-circle slave" onClick={() => (window as any).openLobby()}>
                            <img id="hudUserPic" src={profile?.avatar_url || profile?.profile_picture_url || "https://static.wixstatic.com/media/ce3e5b_e06c7a2254d848a480eb98107c35e246~mv2.png"} alt="Your Avatar" />
                            <div className="hud-gear">⚙</div>
                        </div>
                        <div className="hud-circle queen" onClick={() => (window as any).openQueenMenu()}>
                            <img id="hudSlavePic" src="https://static.wixstatic.com/media/ce3e5b_e06c7a2254d848a480eb98107c35e246~mv2.png" alt="Queen Avatar" />
                            <div id="hudDomStatus" className="hud-status-dot offline"></div>
                        </div>
                    </div>

                    {/* === POPUP OVERLAYS === */}
                    <div id="lobbyOverlay" className="mob-reward-overlay hidden" style={{ display: 'none' }}>
                        <div className="mob-reward-card lobby-card">
                            <div id="lobbyMenu" className="lobby-content">
                                <button className="lobby-btn" onClick={() => (window as any).showLobbyAction('name')}>ADD YOUR NAME</button>
                                <button className="lobby-btn" onClick={() => (window as any).showLobbyAction('photo')}>UPLOAD PHOTO</button>
                                <button className="lobby-btn" onClick={() => (window as any).showLobbyAction('routine')}>GET ROUTINE</button>
                                <button className="lobby-btn" onClick={() => (window as any).showLobbyAction('kinks')}>ADD KINKS</button>
                                <button className="lobby-btn" onClick={() => (window as any).showLobbyAction('limits')}>ADD LIMITS</button>
                                <div className="lobby-divider"></div>
                                <button className="lobby-btn" style={{ color: '#ff4444' }} onClick={() => (window as any).handleLogout()}>LOGOUT</button>
                                <button className="lobby-btn close" onClick={() => (window as any).closeLobby()}>CLOSE</button>
                            </div>
                            <div id="lobbyActionView" className="lobby-content hidden">
                                <div id="lobbyPrompt" className="lobby-prompt">...</div>
                                <input type="text" id="lobbyInputText" className="lobby-input hidden" placeholder="Type here..." />
                                <button id="lobbyInputFileBtn" className="lobby-file-btn hidden" onClick={() => document.getElementById('lobbyFile')?.click()}>PICK PHOTO</button>
                                <input type="file" id="lobbyFile" hidden onChange={(e: any) => { const btn = document.getElementById('lobbyInputFileBtn'); if (btn) btn.innerText = 'PHOTO UPLOADED'; }} />
                                <div id="routineSelectionArea" className="hidden" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div className="routine-grid">
                                        <div className="routine-tile" onClick={(e: any) => (window as any).selectRoutineItem(e.currentTarget, 'Morning Kneel')}>Morning Kneel</div>
                                        <div className="routine-tile" onClick={(e: any) => (window as any).selectRoutineItem(e.currentTarget, 'Chastity Check')}>Chastity Check</div>
                                        <div className="routine-tile" onClick={(e: any) => (window as any).selectRoutineItem(e.currentTarget, 'Cleanliness Check')}>Cleanliness Check</div>
                                        <div className="routine-tile special" onClick={(e: any) => (window as any).selectRoutineItem(e.currentTarget, 'custom')}>CREATE OWN (+1000)</div>
                                    </div>
                                    <input type="text" id="routineCustomInput" className="lobby-input hidden" placeholder="Describe..." style={{ marginTop: '10px' }} />
                                </div>
                                <div id="kinkSelectionArea" className="hidden" style={{ width: '100%' }}>
                                    <div id="kinkGrid" className="routine-grid"></div>
                                </div>
                                <div className="lobby-cost-area"><span className="cost-lbl">COST:</span><span id="lobbyCostDisplay" className="cost-val">0</span></div>
                                <button id="btnLobbyConfirm" className="lobby-btn gold" onClick={() => (window as any).confirmLobbyAction()}>SUBMIT</button>
                                <button className="lobby-btn close" onClick={() => (window as any).backToLobbyMenu()}>BACK</button>
                            </div>
                        </div>
                    </div>

                    <div id="queenOverlay" className="mob-reward-overlay hidden" style={{ display: 'none' }}>
                        <div className="mob-reward-card queen-card-layout" style={{ width: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
                            <div className="mob-chat-header" style={{ width: '100%', justifyContent: 'space-between', marginBottom: '20px', background: 'transparent', border: 'none', padding: 0 }}>
                                <div className="chat-queen-name" style={{ color: '#c5a059', fontSize: '1.2rem' }}>DAILY DUTIES</div>
                                <button onClick={() => (window as any).closeQueenMenu()} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '2rem', cursor: 'pointer' }}>×</button>
                            </div>
                            <div style={{ width: '100%', marginBottom: '25px', borderBottom: '1px solid #333', paddingBottom: '20px' }}>
                                <div className="duty-label">MANDATORY PROTOCOL</div>
                                <div id="mobRoutineDisplay" style={{ color: 'white', fontFamily: 'Orbitron', textAlign: 'center', margin: '15px 0', fontSize: '1.1rem', letterSpacing: '2px' }}>LOADING...</div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                    <button id="btnRoutineUpload" className="action-btn" onClick={() => document.getElementById('routineUploadInput')?.click()}>UPLOAD PROOF</button>
                                    <div id="routineTimeMsg" className="hidden" style={{ color: '#666', fontSize: '0.7rem', fontStyle: 'italic' }}>WINDOW CLOSED</div>
                                    <div id="routineDoneMsg" className="hidden" style={{ color: '#00ff00', fontSize: '0.9rem', fontFamily: 'Orbitron', textShadow: '0 0 10px #00ff00' }}>✔ SUBMITTED</div>
                                </div>
                            </div>
                            <div style={{ width: '100%', marginBottom: '25px', borderBottom: '1px solid #333', paddingBottom: '20px' }}>
                                <div className="duty-label">KNEELING HOURS</div>
                                <div className="mob-kneel-bar" style={{ height: '35px', marginTop: '15px', cursor: 'default', background: '#000', border: '1px solid #444' }}>
                                    <div id="kneelDailyFill" className="mob-bar-fill" style={{ width: '0%', background: '#c5a059' }}></div>
                                    <div className="mob-bar-content" style={{ width: '100%', justifyContent: 'center' }}>
                                        <span id="kneelDailyText" style={{ fontFamily: 'Orbitron', fontSize: '0.9rem', color: '#fff', zIndex: 2 }}>0 / 8</span>
                                    </div>
                                </div>
                            </div>
                            <div style={{ width: '100%' }}>
                                <div className="duty-label">LABOR COMPLETED</div>
                                <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '15px' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.6rem', color: '#888', fontFamily: 'Cinzel', marginBottom: '5px' }}>CURRENT STREAK</div>
                                        <div id="mobStreak" style={{ fontSize: '1.8rem', color: 'white', fontFamily: 'Orbitron' }}>0</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.6rem', color: '#888', fontFamily: 'Cinzel', marginBottom: '5px' }}>TOTAL SERVED</div>
                                        <div id="mobTotal" style={{ fontSize: '1.8rem', color: '#c5a059', fontFamily: 'Orbitron' }}>0</div>
                                    </div>
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

                    <div id="mobHomeScroll" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 5px 10px 5px', boxSizing: 'border-box' }}>

                        {/* 1. TOP BLOCK (HALO + KNEEL) */}
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div className="halo-section">
                                <div className="halo-ring">
                                    <div id="mob_slaveName" className="halo-name">{profile?.name || "SLAVE"}</div>
                                    <div id="mob_slaveEmail" style={{ fontFamily: 'Orbitron', fontSize: '0.45rem', color: 'rgba(255,255,255,0.2)', marginBottom: '5px', letterSpacing: '1px' }}>{profile?.member_id || ""}</div>
                                    <div id="mob_rankStamp" className="halo-rank">{profile?.rank || "INITIATE"}</div>
                                    <div className="mob-section-wrapper" style={{ width: '100%' }}>
                                        <div className="mob-grid-label-center">DAILY PROGRESS</div>
                                        <div id="mob_streakGrid" className="mob-streak-strip"></div>
                                    </div>
                                </div>
                            </div>

                            {/* Stats Card */}
                            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 3 }}>
                                <div className="halo-stats-card">
                                    <div className="h-stat"><span className="h-val" id="mobPoints">{profile?.score || 0}</span><span className="h-lbl">MERIT</span></div>
                                    <div className="h-divider"></div>
                                    <div className="h-stat"><span className="h-val" id="mobCoins">{profile?.wallet || 0}</span><span className="h-lbl">NET</span></div>
                                </div>

                                <div className="mob-stats-toggle-btn" onClick={() => (window as any).toggleMobileStats()}>
                                    SLAVE STATS <span id="mobStatsArrow">▼</span>
                                </div>

                                <div id="mobStatsContent" className="mob-internal-drawer">
                                    <div style={{ width: '100%', textAlign: 'center', paddingBottom: '15px', borderBottom: '1px solid #333', marginBottom: '15px' }}>
                                        <div style={{ fontFamily: 'Cinzel', fontSize: '0.6rem', color: '#666', letterSpacing: '2px' }}>CURRENT CLASSIFICATION</div>
                                        <div id="drawer_CurrentRank" style={{ fontFamily: 'Cinzel', fontSize: '1.2rem', color: '#fff', margin: '5px 0', textTransform: 'uppercase' }}>{profile?.rank || "LOADING..."}</div>
                                        <div id="drawer_CurrentBenefits" style={{ fontFamily: 'Cinzel', fontSize: '0.65rem', color: '#888', fontStyle: 'italic', padding: '0 10px', lineHeight: 1.4 }}></div>
                                    </div>
                                    <div style={{ width: '100%', textAlign: 'center', marginBottom: '15px' }}>
                                        <div style={{ fontFamily: 'Orbitron', fontSize: '0.6rem', color: '#c5a059', letterSpacing: '2px' }}>WORKING ON PROMOTION TO</div>
                                        <div id="drawer_NextRank" style={{ fontFamily: 'Orbitron', fontSize: '1.4rem', color: '#c5a059', fontWeight: 900, letterSpacing: '1px', marginTop: '5px', textShadow: '0 0 15px rgba(197, 160, 89, 0.3)', textTransform: 'uppercase' }}>LOADING...</div>
                                    </div>
                                    <div id="drawer_ProgressContainer" style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid #333', borderRadius: '4px', padding: '15px', marginBottom: '20px' }}></div>
                                    <div style={{ width: '100%', textAlign: 'left', padding: '0 5px' }}>
                                        <div style={{ fontFamily: 'Orbitron', fontSize: '0.6rem', color: '#c5a059', marginBottom: '8px' }}>PRIVILEGES GRANTED</div>
                                        <ul id="drawer_NextBenefits" style={{ color: '#ccc', fontSize: '0.75rem', fontFamily: 'Cinzel', paddingLeft: '20px', lineHeight: 1.6, margin: 0 }}></ul>
                                    </div>
                                </div>
                            </div>

                            {/* MOBILE KNEELING BUTTON (CONNECTED TO kneeling.ts) */}
                            <div className="halo-stack" style={{ padding: '0 20px', width: '100%', marginTop: '15px', marginBottom: '30px' }}>
                                <div id="mobKneelBar" className="mob-kneel-bar mob-kneel-zone">
                                    <div id="mob_kneelFill" className="mob-bar-fill"></div>
                                    <div className="mob-bar-content">
                                        <span className="kneel-icon-sm">◈</span>
                                        <span id="mob_kneelText" className="kneel-text kneel-label">HOLD TO KNEEL</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* CHAT SECTION */}
                        <div id="mobChatSection" style={{ width: '100%', margin: 0, background: '#000', borderTop: '1px solid #333', borderBottom: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '15px', background: 'linear-gradient(180deg, #111 0%, #050505 100%)' }}>
                                <div style={{ position: 'relative', width: '45px', height: '45px' }}>
                                    <img src="https://static.wixstatic.com/media/ce3e5b_19faff471a434690b7a40aacf5bf42c4~mv2.png" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '1px solid #c5a059' }} alt="Queen Karin" />
                                    <div id="mobChatOnlineDot" className="status-dot online" style={{ position: 'absolute', bottom: 0, right: 0 }}></div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ fontFamily: 'Cinzel', fontWeight: 700, fontSize: '1rem', color: '#fff' }}>QUEEN KARIN</div>
                                    <div id="mobChatStatusText" style={{ fontFamily: 'Orbitron', fontSize: '0.55rem', color: '#888' }}>ONLINE</div>
                                </div>
                            </div>
                            <div id="mob_systemTicker" className="system-ticker">SYSTEM ONLINE</div>
                            <div id="btnEnterChatPanel" onClick={() => (window as any).toggleMobileChat(true)} style={{ width: '100%', padding: 12, textAlign: 'center', background: '#000', color: '#666', fontFamily: 'Orbitron', fontSize: '0.7rem', letterSpacing: 3, cursor: 'pointer', transition: '0.2s' }}>▼ ENTER CHAT</div>

                            <div id="inlineChatPanel" className="hidden" style={{ width: '100%', height: '450px', background: '#050505', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                                <div id="mob_chatBox" className="chat-body-frame" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', paddingBottom: 70, overflowY: 'auto' }}>
                                    <div id="tributeHuntOverlay" className="hidden overlay-center" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.98)', zIndex: 50, flexDirection: 'column', padding: '20px' }}>
                                        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
                                            <span style={{ fontFamily: 'Cinzel', color: '#c5a059' }}>TRIBUTE STORE</span>
                                            <button onClick={() => (window as any).toggleTributeHunt()} style={{ color: 'white', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Orbitron', fontSize: '1.2rem' }}>X</button>
                                        </div>
                                        <div id="huntStoreGrid" className="store-grid" style={{ width: '100%', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}></div>
                                    </div>
                                    <div id="mob_chatContent" className="chat-area"></div>
                                </div>
                                <div onClick={() => (window as any).toggleMobileChat(false)} style={{ position: 'absolute', top: 0, right: '10px', zIndex: 25, color: '#333', fontSize: '1.5rem', cursor: 'pointer' }}>×</div>
                                <div className="chat-footer" style={{ position: 'absolute', bottom: 0, width: '100%', height: '65px', zIndex: 20, background: '#080808', borderTop: '1px solid #222' }}>
                                    <div className="chat-input-wrapper">
                                        <button className="chat-btn-plus" onClick={() => (window as any).handleMediaPlus()}>+</button>
                                        <input type="text" id="mob_chatMsgInput" className="chat-input" placeholder="Transmit..." onKeyPress={(e: any) => (window as any).handleChatKey(e)} />
                                    </div>
                                    <button className="chat-btn-tribute" onClick={() => (window as any).toggleTributeHunt()}>🎁</button>
                                    <button className="chat-btn-send" onClick={() => (window as any).sendChatMessage()}>{' > '}</button>
                                </div>
                            </div>
                        </div>

                        {/* CURRENT STATUS */}
                        <div style={{ width: '100%', marginTop: '20px' }}>
                            <div className="duty-label">CURRENT STATUS</div>
                            <div className="luxury-card" style={{ padding: '15px 5px' }}>
                                <div id="qm_TaskIdle" className="hidden" style={{ textAlign: 'center' }}>
                                    <div className="txt-status-red" style={{ marginBottom: '10px' }}>UNPRODUCTIVE</div>
                                    <button className="lobby-btn" style={{ width: '100%', borderColor: '#c5a059', color: '#c5a059' }} onClick={() => (window as any).mobileRequestTask()}>REQUEST TASK</button>
                                </div>
                                <div id="qm_TaskActive" className="hidden" style={{ textAlign: 'center' }}>
                                    <div className="txt-status-green" style={{ marginBottom: '5px' }}>WORKING</div>
                                    <div id="mobTaskText" style={{ marginBottom: '10px', minHeight: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', lineHeight: 1.3, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>LOADING ORDER...</div>
                                    <div className="card-timer-row">
                                        <div id="qm_timerH" className="card-t-box">00</div>:
                                        <div id="qm_timerM" className="card-t-box">00</div>:
                                        <div id="qm_timerS" className="card-t-box">00</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '5px', marginTop: '10px' }}>
                                        <button id="mobBtnUpload" className="btn-upload-sm" style={{ flex: 1 }} onClick={() => document.getElementById('evidenceInputMob')?.click()}>UPLOAD</button>
                                        <button id="mobBtnSkip" className="btn-skip-sm" style={{ flex: 1 }} onClick={() => (window as any).mobileSkipTask()}>SKIP (-300)</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* THE ALTAR */}
                        <div style={{ width: '100%', marginTop: '20px' }} onClick={() => document.getElementById('altarHistoryPanel')?.classList.toggle('hidden')}>
                            <div className="duty-label">THE ALTAR</div>
                            <div className="mob-pyramid-stage" style={{ height: '240px', cursor: 'pointer' }}>
                                <div className="mob-idol side"><img id="mobRec_Slot2" src="" alt="Slot 2" /><div className="mob-rank-badge">II</div></div>
                                <div className="mob-idol side right"><img id="mobRec_Slot3" src="" alt="Slot 3" /><div className="mob-rank-badge">III</div></div>
                                <div className="mob-idol center"><img id="mobRec_Slot1" src="" alt="Slot 1" /><div className="mob-rank-badge main">I</div></div>
                            </div>
                            <div style={{ textAlign: 'center', fontFamily: 'Cinzel', fontSize: '0.6rem', color: '#666', marginTop: '-10px' }}>TAP TO REVEAL DATABASE</div>
                        </div>
                        <div id="altarHistoryPanel" className="hidden" style={{ width: '100%' }}>
                            <div className="mob-grid-label-center" style={{ textAlign: 'left', paddingLeft: '10px', color: '#666', marginTop: '15px' }}>ACCEPTED PROTOCOLS</div>
                            <div id="mobRec_Grid" className="mob-horiz-scroll"></div>
                            <div className="mob-grid-label-center" style={{ textAlign: 'left', paddingLeft: '10px', color: '#ff003c', marginTop: '15px' }}>FAILED / DENIED</div>
                            <div id="mobRec_Heap" className="mob-horiz-scroll small"></div>
                        </div>

                        {/* QUEEN'S WALL */}
                        <div style={{ width: '100%', marginTop: '20px' }}>
                            <div className="duty-label">QUEEN'S WALL</div>
                            <div id="qWall_ScrollTrack" className="mob-horiz-scroll" style={{ marginTop: '15px', paddingBottom: '10px', minHeight: '100px' }}>
                                <div style={{ color: '#333', fontSize: '0.7rem', padding: '20px' }}>LOADING FEED...</div>
                            </div>
                        </div>

                        {/* SLAVE RECORDS */}
                        <div style={{ width: '100%', marginTop: '20px' }}>
                            <div className="duty-label">SLAVE RECORDS</div>
                            <div style={{ width: '100%', marginBottom: '20px' }}>
                                <div className="duty-label" style={{ color: '#c5a059', borderColor: 'rgba(197, 160, 89, 0.3)' }}>DAILY DISCIPLINE</div>
                                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                    <div style={{ flex: '0 0 90px', height: '90px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid #c5a059', background: 'linear-gradient(180deg, #1a1a1a 0%, #000 100%)', borderRadius: '4px', boxShadow: '0 0 15px rgba(197, 160, 89, 0.1)' }}>
                                        <div id="dispStreakVal" style={{ fontFamily: 'Orbitron', fontSize: '2rem', color: '#c5a059', lineHeight: 1, textShadow: '0 0 10px rgba(197, 160, 89, 0.3)' }}>0</div>
                                        <div style={{ fontFamily: 'Cinzel', fontSize: '0.55rem', color: '#888', marginTop: '5px', letterSpacing: '2px' }}>STREAK</div>
                                    </div>
                                    <div id="shelfRoutine" className="mob-horiz-scroll" style={{ flex: 1, height: '90px', alignItems: 'center' }}>
                                        <div style={{ color: '#444', fontSize: '0.6rem', padding: '10px', fontFamily: 'Cinzel' }}>AWAITING PROOF</div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'center', fontFamily: 'Cinzel', fontSize: '0.6rem', color: '#666', marginTop: '5px', letterSpacing: '1px' }}>PERSONAL BEST: <span id="dispBestStreak" style={{ color: '#888' }}>0</span> DAYS</div>
                            </div>

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
            </div>
        </div>
    );
}
