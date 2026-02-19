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
        }

        initDashboard();
    }, []);

    return (
        <div className="dashboard-root">
            {/* HEADER */}
            <header className="dash-header">
                <div className="logo-section">
                    <div className="logo-hex">Q</div>
                    <div className="logo-text">QUEENDOM <span>CONTROL</span></div>
                </div>
                <nav className="nav-main">
                    <button className="nav-item active" onClick={() => showHome()}>OVERVIEW</button>
                    <button className="nav-item" onClick={() => showProfile()}>PROFILE</button>
                    <button className="nav-item">FINANCE</button>
                    <button className="nav-item">RECORDS</button>
                </nav>
                <div className="header-status">
                    <div className="status-indicator online"></div>
                    <span className="status-label">MASTER CONNECTION ACTIVE</span>
                </div>
            </header>

            <main className="dash-main">
                {/* LEFT BAR: USER LIST */}
                <aside className="user-sidebar">
                    <div className="sidebar-header">
                        <h3>CITIZENS</h3>
                        <span className="count" id="userCount">0</span>
                    </div>
                    <div className="user-list" id="userList">
                        {/* React or Script-driven user items */}
                    </div>
                </aside>

                {/* CENTER AREA: DYNAMIC VIEWS */}
                <section className="viewport">
                    <div id="viewHome" className="view-container grid-view">
                        {/* HOME VIEW: OPS MONITOR & PROTOCOLS */}
                        <div className="ops-monitor">
                            <div className="sec-header">
                                <h2>OPERATIONS MONITOR</h2>
                                <div className="live-badge">LIVE</div>
                            </div>
                            <div id="opsList" className="ops-list">
                                {/* Active task cards */}
                            </div>
                        </div>

                        <div className="protocol-center">
                            <div className="protocol-card">
                                <div className="card-header">SILENCE PROTOCOL</div>
                                <div className="pd-controls" id="pdControls">
                                    <input type="number" id="pdGoal" defaultValue="1000" />
                                    <button id="pdBtn" className="engage" onClick={() => toggleProtocol()}>ENGAGE</button>
                                </div>
                            </div>

                            <div className="broadcast-card">
                                <button className="br-btn" style={{ width: '100%' }} onClick={() => (window as any).openBroadcastModal()}>SYSTEM BROADCAST</button>
                            </div>
                        </div>
                    </div>

                    <div id="viewUser" className="view-container user-view" style={{ display: 'none' }}>
                        {/* USER VIEW: CHAT & PROFILE MIRROR */}
                        <div className="chat-section">
                            <div id="adminChatBox" className="chat-box"></div>
                            <div className="chat-input-area">
                                <input type="text" id="adminChatInput" placeholder="TRANSMIT DIRECTIVE..." />
                            </div>
                        </div>
                        <div className="profile-mirror">
                            <div id="apMirrorHeader" className="mirror-header">
                                <img id="dProfilePic" src="" alt="Profile" />
                                <h2 id="dMirrorName">NAME</h2>
                                <div id="dMirrorHierarchy">HIERARCHY</div>
                            </div>
                            {/* Statistics etc */}
                        </div>
                    </div>
                </section>
            </main>

            {/* MODALS */}
            <div id="reviewModal" className="modal" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
                <div className="m-content">
                    <span onClick={() => closeModal()} className="m-close">&times;</span>
                    <div id="mMediaBox" className="m-media-box"></div>
                    <div className="m-info">
                        <div id="reviewNormalContent">
                            <div id="mText" className="m-text-scroll"></div>
                            <div id="modalActions"></div>
                        </div>
                        <div id="reviewRewardOverlay" style={{ display: 'none' }}>
                            <h3 style={{ color: 'var(--green)', marginBottom: '15px', textAlign: 'center' }}>REWARD PROTOCOL</h3>
                            <div id="stickerGrid" className="sticker-grid"></div>
                            <div className="reward-inputs">
                                <input type="number" id="rewardBonus" className="rw-inp" defaultValue="50" />
                                <input type="text" id="rewardComment" className="rw-inp" placeholder="Optional message..." />
                            </div>
                            <div className="rw-media-row">
                                <div id="btnRecordReward" className="rw-icon-btn" onClick={() => toggleRewardRecord()}>REC</div>
                                <div id="rewardMediaPreview" className="rw-preview-box d-none"></div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                                <button onClick={() => cancelReward()} className="btn-sec">CANCEL</button>
                                <button onClick={() => confirmReward()} className="btn-pri">CONFIRM</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div id="broadcastModal" className="modal">
                <div className="m-content br-modal-content">
                    <div className="br-head">BROADCAST MESSAGE</div>
                    <textarea id="brText" className="br-inp" placeholder="Enter your message..."></textarea>
                    <div className="br-preset-row">
                        <button className="br-mini-btn" onClick={() => saveBroadcastPreset()}>SAVE PRESET</button>
                        <button className="br-mini-btn" onClick={() => togglePresets()}>LOAD PRESET</button>
                    </div>
                    <div id="presetList" style={{ display: 'none' }}></div>
                    <input type="file" id="brFile" accept="image/*,video/*" onChange={(e) => handleBroadcastFile(e.target)} style={{ display: 'none' }} />
                    <img id="brPreviewImg" className="br-prev" style={{ display: 'none' }} alt="Preview" />
                    <video id="brPreviewVid" className="br-prev" style={{ display: 'none' }} muted autoPlay loop></video>
                    <div id="brUserList" className="ex-list"></div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                        <button onClick={() => closeBroadcastModal()} className="btn-sec">CANCEL</button>
                        <button onClick={() => sendBroadcast()} className="br-btn">SEND BROADCAST</button>
                    </div>
                </div>
            </div>

            <div id="exclusionModal" className="modal">
                <div className="m-content">
                    <h3 style={{ color: 'var(--red)', marginBottom: '15px', textAlign: 'center' }}>PROTOCOL EXCLUSIONS</h3>
                    <div id="exclusionList" className="ex-list"></div>
                    <button onClick={() => closeExclusionModal()} className="btn-sec">CLOSE</button>
                </div>
            </div>

        </div>
    );
}
