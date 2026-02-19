'use client';

import React, { useEffect } from 'react';
import './dashboard.css';
import './dashboard-modals.css';
import './dashboard-mobile.css';

// Scripts
import { initDashboard, showHome } from '@/scripts/dashboard-main';
import { closeModal, reviewTask, cancelReward, confirmReward, toggleRewardRecord, handleRewardFileUpload, selectSticker } from '@/scripts/dashboard-modals';
import { toggleProtocol, toggleNewbieImmunity, closeExclusionModal, sendBroadcast, saveBroadcastPreset, togglePresets, closeBroadcastModal, handleBroadcastFile } from '@/scripts/dashboard-protocol';
import { showProfile } from '@/scripts/dashboard-navigation';

export default function DashboardPage() {
    useEffect(() => {
        // Inject scripts into window for legacy compatibility (DOM onclick handlers)
        if (typeof window !== 'undefined') {
            (window as any).closeModal = closeModal;
            (window as any).reviewTask = reviewTask;
            (window as any).cancelReward = cancelReward;
            (window as any).confirmReward = confirmReward;
            (window as any).toggleRewardRecord = toggleRewardRecord;
            (window as any).handleRewardFileUpload = handleRewardFileUpload;
            (window as any).selectSticker = selectSticker;
            (window as any).toggleProtocol = toggleProtocol;
            (window as any).toggleNewbieImmunity = toggleNewbieImmunity;
            (window as any).closeExclusionModal = closeExclusionModal;
            (window as any).sendBroadcast = sendBroadcast;
            (window as any).saveBroadcastPreset = saveBroadcastPreset;
            (window as any).togglePresets = togglePresets;
            (window as any).closeBroadcastModal = closeBroadcastModal;
            (window as any).handleBroadcastFile = handleBroadcastFile;
            (window as any).showHome = showHome;
            (window as any).showProfile = showProfile;

            // Additional Bindings from scripts
            (window as any).initDashboard = initDashboard;
        }

        initDashboard();
    }, []);

    return (
        <div className="layout">
            {/* SIDEBAR */}
            <aside className="sidebar">
                <div className="sb-dash-btn" onClick={() => (window as any).showHome()}>
                    QUEENDOM CONTROL
                </div>
                <div className="sb-head">OPERATIONS MANAGEMENT</div>
                <div id="userList" className="user-list">
                    {/* Populated by renderSidebar() */}
                </div>

                <div className="sb-footer" style={{ padding: '20px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ color: '#444', fontSize: '0.6rem', fontFamily: 'Orbitron' }}>
                        v1.0.1 // STANDALONE_CORE
                    </div>
                </div>
            </aside>

            {/* MAIN CONTENT AREA */}
            <main className="content">

                {/* 1. HOME VIEW (DASHBOARD) */}
                <div id="viewHome" className="view-container grid-view">

                    {/* STATS DECK */}
                    <div className="stats-deck">
                        <div className="d-stat-card">
                            <div id="statTributes" className="dsc-val gold">0</div>
                            <div className="dsc-lbl">TRIBUTES COLLECTED</div>
                        </div>
                        <div className="d-stat-card">
                            <div id="statActive" className="dsc-val green">0</div>
                            <div className="dsc-lbl">ACTIVE OPERATIONS</div>
                        </div>
                        <div className="d-stat-card">
                            <div id="statPending" className="dsc-val blue">0</div>
                            <div className="dsc-lbl">PENDING REVIEWS</div>
                        </div>
                        <div className="d-stat-card">
                            <div id="statSkipped" className="dsc-val red">0</div>
                            <div className="dsc-lbl">STRIKES ISSUED</div>
                        </div>
                    </div>

                    {/* PROTOCOL CENTER */}
                    <div id="protocolDeck" className="protocol-deck">
                        <div className="pd-label">
                            <div className="pd-title">SILENCE PROTOCOL</div>
                            <div className="pd-sub">SYSTEM ENFORCEMENT</div>
                        </div>
                        <div className="pd-controls">
                            <div className="pd-column-group">
                                <div className="pd-input-group">
                                    <input type="number" id="pdGoal" className="pd-input" defaultValue="1000" />
                                </div>
                            </div>
                            <button id="pdBtn" className="pd-action-btn engage" onClick={() => (window as any).toggleProtocol()}>ENGAGE</button>
                            <button className="pd-broadcast-btn" onClick={() => (window as any).sendBroadcast()}>
                                SYSTEM BROADCAST
                            </button>
                        </div>
                    </div>

                    {/* DASHBOARD SPLIT */}
                    <div className="dash-split">
                        <div className="dash-panel">
                            <div className="dp-head">OPERATIONS MONITOR</div>
                            <div id="opsList" className="dp-body">
                                {/* Populated by renderOperationsGrid() */}
                            </div>
                        </div>
                        <div className="dash-panel">
                            <div className="dp-head">SYSTEM FEED</div>
                            <div id="feedLog" className="dp-body">
                                {/* Populated by renderFeedLog() */}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. USER VIEW (CHAT & PROFILE) */}
                <div id="viewUser" className="view-container user-view" style={{ display: 'none' }}>
                    <div className="chat-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div id="adminChatBox" className="chat-box" style={{ flex: 1, padding: '20px', overflowY: 'auto' }}></div>
                        <div className="chat-input-area" style={{ padding: '15px' }}>
                            <input type="text" id="adminChatInput" className="chat-inp" placeholder="TRANSMIT DIRECTIVE..." />
                        </div>
                    </div>

                    <div className="profile-mirror" style={{ width: '400px', borderLeft: '1px solid var(--border)', background: 'rgba(0,0,0,0.3)' }}>
                        <div id="apMirrorHeader" className="mirror-header" style={{ height: '200px', backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }}>
                            <div style={{ position: 'absolute', bottom: '20px', left: '20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <img id="dProfilePic" src="" alt="Profile" className="mon-av" style={{ width: '80px', height: '80px', borderRadius: '50%', border: '2px solid var(--gold)' }} />
                                <div>
                                    <div id="dMirrorName" className="mon-name" style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>NAME</div>
                                    <div id="dMirrorHierarchy" className="mon-hierarchy" style={{ color: 'var(--gold)', fontSize: '0.8rem' }}>RANK</div>
                                    <div id="dMirrorStatus" className="mon-status">ONLINE</div>
                                </div>
                            </div>
                        </div>

                        <div className="profile-body" style={{ padding: '20px' }}>
                            <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                                <div className="stat-box">
                                    <div className="dsc-lbl">POINTS</div>
                                    <div id="dMirrorPoints" className="dsc-val gold">0</div>
                                </div>
                                <div className="stat-box">
                                    <div className="dsc-lbl">WALLET</div>
                                    <div id="dMirrorWallet" className="dsc-val gold">0</div>
                                </div>
                                <div className="stat-box">
                                    <div className="dsc-lbl">KNEEL</div>
                                    <div id="dMirrorKneel" className="dsc-val gold">0</div>
                                </div>
                            </div>

                            <div id="admin_ProgressContainer"></div>
                            <div id="userQueueSec"></div>
                            <div id="qListContainer"></div>
                        </div>
                    </div>
                </div>

                {/* 3. PROFILE VIEW (ME) */}
                <div id="viewProfile" className="view-container" style={{ display: 'none' }}>
                    <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                        SYSTEM_ADMIN_PROFILE_LOAD...
                    </div>
                </div>

            </main>

            {/* SHARED MODALS */}
            <div id="reviewModal" className="modal" style={{ display: 'none' }}>
                {/* Modal content should be filled by script as before but ensure container exists */}
                <div className="m-content">
                    <span onClick={() => (window as any).closeModal()} className="m-close">&times;</span>
                    <div id="mMediaBox" className="m-media-box"></div>
                    <div className="m-info">
                        <div id="reviewNormalContent">
                            <div id="mText" className="m-text-scroll"></div>
                            <div id="modalActions"></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* SOUND ASSETS */}
            <audio id="msgSound" src="https://static.wixstatic.com/mp3/ce3e5b_7b8a7b3...mp3" preload="auto"></audio>
        </div>
    );
}
