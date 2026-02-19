"use client";

import React, { useEffect, useState } from 'react';
import './profile.css';
import { getState, setState, initProfileState } from '@/scripts/profile-state';
import { handleHoldStart, handleHoldEnd, updateKneelingUI } from '@/scripts/kneeling';
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
    mobileRequestTask,
    mobileSkipTask,
    mobileUploadEvidence,
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
    showLobbyAction,
    confirmLobbyAction,
    backToLobbyMenu,
    selectRoutineItem,
    getRandomTask,
    cancelPendingTask,
    renderProfileSidebar
} from '@/scripts/profile-logic';

export default function ProfilePage() {
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);

    useEffect(() => {
        // Inject scripts into window for legacy compatibility (DOM onclick handlers)
        if (typeof window !== 'undefined') {
            (window as any).handleHoldStart = handleHoldStart;
            (window as any).handleHoldEnd = handleHoldEnd;
            (window as any).claimKneelReward = claimKneelReward;
            (window as any).switchTab = switchTab;
            (window as any).toggleTributeHunt = toggleTributeHunt;
            (window as any).openLobby = openLobby;
            (window as any).closeLobby = closeLobby;
            (window as any).openQueenMenu = openQueenMenu;
            (window as any).closeQueenMenu = closeQueenMenu;
            (window as any).toggleMobileStats = toggleMobileStats;
            (window as any).toggleMobileChat = toggleMobileChat;
            (window as any).mobileRequestTask = mobileRequestTask;
            (window as any).mobileSkipTask = mobileSkipTask;
            (window as any).mobileUploadEvidence = mobileUploadEvidence;
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
            (window as any).showLobbyAction = showLobbyAction;
            (window as any).confirmLobbyAction = confirmLobbyAction;
            (window as any).backToLobbyMenu = backToLobbyMenu;
            (window as any).selectRoutineItem = selectRoutineItem;
            (window as any).getRandomTask = getRandomTask;
            (window as any).cancelPendingTask = cancelPendingTask;
        }

        async function loadProfile() {
            try {
                const memberId = "test-member-id"; // In real app, from auth
                const res = await fetch(`/api/dashboard-data?memberId=${memberId}`);
                const data = await res.json();

                if (data.profile) {
                    setProfile(data.profile);
                    initProfileState(data.profile);
                    renderProfileSidebar(data.profile);
                }
            } catch (err) {
                console.error("Failed to load profile", err);
            } finally {
                setLoading(false);
            }
        }

        loadProfile();

        const timer = setInterval(() => {
            updateKneelingUI();
        }, 1000);

        return () => clearInterval(timer);
    }, []);

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
            {/* SOUNDS & INPUTS */}
            <audio id="msgSound" src="https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3"></audio>
            <audio id="coinSound" src="/audio/2019-preview1.mp3"></audio>
            <audio id="skipSound" src="https://static.wixstatic.com/mp3/ce3e5b_3b5b34d4083847e2b123b6fd9a8551fd.mp3"></audio>

            <input type="file" id="profileUploadInput" accept="image/*" className="hidden" />
            <input type="file" id="routineUploadInput" accept="image/*" className="hidden" />
            <input type="file" id="evidenceInputMob" accept="image/*" className="hidden" />
            <input type="file" id="chatMediaInput" accept="image/*,video/*" className="hidden" />

            {/* CELEBRATION OVERLAY */}
            <div id="celebrationOverlay" className="hidden" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 2147483647, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.3s' }}>
                <div className="glass-card" style={{ border: '2px solid #00ff00', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#00ff00', textShadow: '0 0 20px #00ff00', fontFamily: 'Orbitron' }}>
                        TASK<br />SUBMITTED
                    </div>
                </div>
            </div>

            {/* UNIVERSAL DESKTOP APP */}
            <div id="DESKTOP_APP">
                {/* TRIBUTE STORE OVERLAY */}
                <div id="tributeHuntOverlay" className="hidden" style={{ position: 'fixed', inset: 0, background: 'rgba(2,5,18,0.98)', zIndex: 10000, flexDirection: 'column', padding: '60px', backdropFilter: 'blur(20px)' }}>
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
                            <img id="profilePic" src={profile?.profile_pic || "https://static.wixstatic.com/media/ce3e5b_78da97e06a3848df84d0b00c9e6dcfdd~mv2.png"} alt="Avatar" className="profile-img" />
                        </div>
                        <div id="subName" className="identity-name" style={{ fontSize: '1.2rem', letterSpacing: 4, marginBottom: 15, fontWeight: 'bold' }}>
                            {profile?.name || "SLAVE"}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', marginTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 15 }}>
                            <div className="sidebar-stat-block">
                                <div className="sidebar-stat-value-row">
                                    <span style={{ color: '#fff', opacity: 0.8 }}><i className="fas fa-award"></i></span>
                                    <div id="points">{profile?.points || 0}</div>
                                </div>
                                <div className="sidebar-stat-label">MERIT</div>
                            </div>
                            <div style={{ height: 30, width: 1, background: 'rgba(255,255,255,0.05)' }}></div>
                            <div className="sidebar-stat-block">
                                <div className="sidebar-stat-value-row">
                                    <span style={{ color: '#c5a059' }}><i className="fas fa-coins"></i></span>
                                    <div id="coins">{profile?.coins || 0}</div>
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

                        <div id="kneelRewardOverlay" className="hidden" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 5000, backdropFilter: 'blur(20px)', alignItems: 'center', justifyContent: 'center' }}>
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
                            <button id="heroKneelBtn" className="mob-kneel-bar" style={{ height: 48, width: 220, cursor: 'pointer', borderRadius: 4, overflow: 'hidden', position: 'relative', background: 'rgba(0,0,0,0.5)', border: '1px solid #c5a059', margin: '20px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, outline: 'none', transition: '0.3s' }} onMouseDown={handleHoldStart} onMouseUp={() => handleHoldEnd()} onMouseLeave={() => handleHoldEnd()} onTouchStart={handleHoldStart} onTouchEnd={() => handleHoldEnd()}>
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
                                <div id="uploadBtnContainer" className="hidden" style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 10, alignItems: 'center' }}>
                                    <button id="uploadBtn" className="action-btn" style={{ width: 180, background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', color: '#c5a059', fontWeight: 'bold', border: '1px solid #c5a059', boxShadow: '0 0 15px rgba(197,160,89,0.2)' }} onClick={() => (document.getElementById('routineUploadInput') as any)?.click()}>UPDATE TASK</button>
                                    <button id="btnSkip" onClick={() => cancelPendingTask()} className="text-btn" style={{ color: '#aaa', fontFamily: 'Orbitron', fontSize: '0.7rem', letterSpacing: 1, background: 'none', border: 'none', padding: 5, width: 180 }}>SKIP TASK (-300 🪙)</button>
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

            {/* MOBILE APP */}
            <div id="MOBILE_APP" style={{ display: 'none' }}>
                <div id="viewMobileHome" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', maxWidth: '100vw', height: '100dvh', overflowY: 'auto', overflowX: 'hidden', display: 'block', padding: 0, zIndex: 1, background: 'transparent' }}>
                    <div className="mob-hud-row">
                        <div className="hud-circle slave" onClick={() => openLobby()}>
                            <img src="https://static.wixstatic.com/media/ce3e5b_e06c7a2254d848a480eb98107c35e246~mv2.png" />
                            <div className="hud-gear">⚙</div>
                        </div>
                        <div className="hud-circle queen" onClick={() => openQueenMenu()}>
                            <img id="hudSlavePic" src={profile?.profile_pic || ""} />
                            <div id="hudDomStatus" className="hud-status-dot offline"></div>
                        </div>
                    </div>

                    <div id="mobHomeScroll" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 5px 10px 5px', boxSizing: 'border-box' }}>
                        <div className="halo-section">
                            <div className="halo-ring">
                                <div id="mob_slaveName" className="halo-name">{profile?.name || "SLAVE"}</div>
                                <div id="mob_rankStamp" className="halo-rank">{profile?.rank || "INITIATE"}</div>
                                <div id="mob_streakGrid" className="mob-streak-strip"></div>
                            </div>
                        </div>

                        <div className="halo-stats-card">
                            <div className="h-stat"><span className="h-val" id="mobPoints">{profile?.points || 0}</span><span className="h-lbl">MERIT</span></div>
                            <div className="h-divider"></div>
                            <div className="h-stat"><span className="h-val" id="mobCoins">{profile?.coins || 0}</span><span className="h-lbl">NET</span></div>
                        </div>

                        <div className="mob-stats-toggle-btn" onClick={() => toggleMobileStats()}>
                            SLAVE STATS <span id="mobStatsArrow">▼</span>
                        </div>

                        <div id="mobStatsContent" className="mob-internal-drawer">
                            <div id="drawer_CurrentRank" style={{ fontFamily: 'Cinzel', fontSize: '1.2rem', color: '#fff', margin: '5px 0', textTransform: 'uppercase', textAlign: 'center' }}>{profile?.rank || "LOADING..."}</div>
                            <div id="drawer_ProgressContainer"></div>
                        </div>

                        <div className="halo-stack" style={{ padding: '0 20px', width: '100%', marginTop: '15px', marginBottom: '30px' }}>
                            <div className="mob-kneel-bar mob-kneel-zone" onMouseDown={handleHoldStart} onMouseUp={() => handleHoldEnd()} onTouchStart={handleHoldStart} onTouchEnd={() => handleHoldEnd()}>
                                <div id="mob_kneelFill" className="mob-bar-fill"></div>
                                <div className="mob-bar-content">
                                    <span className="kneel-icon-sm">◈</span>
                                    <span id="mob_kneelText" className="kneel-text kneel-label">HOLD TO KNEEL</span>
                                </div>
                            </div>
                        </div>

                        <div id="mobChatSection" style={{ width: '100%', margin: 0, background: '#000', borderTop: '1px solid #333', borderBottom: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
                            <div id="btnEnterChatPanel" onClick={() => toggleMobileChat(true)} style={{ width: '100%', padding: 12, textAlign: 'center', background: '#000', color: '#666', fontFamily: 'Orbitron', fontSize: '0.7rem', letterSpacing: 3, cursor: 'pointer' }}>▼ ENTER CHAT</div>

                            <div id="inlineChatPanel" className="hidden" style={{ width: '100%', height: 450, background: '#050505', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                                <div id="mob_chatBox" className="chat-body-frame" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', paddingBottom: 70, overflowY: 'auto' }}>
                                    <div id="mob_chatContent" className="chat-area"></div>
                                </div>
                                <div className="chat-footer" style={{ position: 'absolute', bottom: 0, width: '100%', height: 65, zIndex: 20, background: '#080808', borderTop: '1px solid #222' }}>
                                    <div className="chat-input-wrapper">
                                        <button className="chat-btn-plus" onClick={() => handleMediaPlus()}>+</button>
                                        <input type="text" id="mob_chatMsgInput" className="chat-input" placeholder="Transmit..." onKeyPress={handleChatKey} />
                                    </div>
                                    <button className="chat-btn-send" onClick={() => sendChatMessage()}>{' > '}</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* REWARD & MODAL OVERLAYS */}
            <div id="lobbyOverlay" className="mob-reward-overlay hidden">
                <div className="mob-reward-card lobby-card">
                    <button className="lobby-btn close" onClick={() => closeLobby()}>CLOSE</button>
                </div>
            </div>

            <div id="queenOverlay" className="mob-reward-overlay hidden">
                <div className="mob-reward-card queen-card-layout">
                    <button onClick={() => closeQueenMenu()}>×</button>
                </div>
            </div>

            <div id="mobKneelReward" className="mob-reward-overlay hidden">
                <div className="mob-reward-card">
                    <button onClick={() => claimKneelReward('coins')} className="mob-action-btn">CLAIM COINS</button>
                    <button onClick={() => claimKneelReward('points')} className="mob-action-btn">CLAIM MERIT</button>
                </div>
            </div>
        </div >
    );
}
