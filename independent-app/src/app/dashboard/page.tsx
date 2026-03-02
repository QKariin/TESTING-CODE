'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import '../../css/dashboard.css';
import '../../css/dashboard-modals.css';
import '../../css/dashboard-mobile.css';

// Scripts
import { initDashboard, showHome, renderMainDashboard } from '@/scripts/dashboard-main';
import { closeModal, reviewTask, cancelReward, confirmReward, toggleRewardRecord, handleRewardFileUpload, selectSticker, openTaskGallery, closeTaskGallery, filterTaskGallery, addQueueTask, deleteQueueItem, openModById } from '@/scripts/dashboard-modals';
import { toggleProtocol, toggleNewbieImmunity, closeExclusionModal, sendBroadcast, saveBroadcastPreset, togglePresets, closeBroadcastModal, handleBroadcastFile, openBroadcastModal, openExclusionModal } from '@/scripts/dashboard-protocol';
import { showProfile, switchProfileTab, openProfileUpload } from '@/scripts/dashboard-navigation';
import { switchAdminTab, adjustWallet, manageAltar, adminTaskAction, toggleTaskQueue, expandAdminCategory, updateDashboardAltar, showPosts, submitQueenPost, deleteQueenPost, loadQueenPostsDashboard } from '@/scripts/dashboard-main';
import { closeChatPreview } from '@/scripts/chat';

// State & Actions
import { setUsers, setAvailableDailyTasks, setGlobalQueue, setGlobalTributes } from '@/scripts/dashboard-state';
import { getAdminDashboardData } from '@/actions/velo-actions';
import { getOptimizedUrl } from '@/scripts/media';

export default function DashboardPage() {
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const router = useRouter();

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/'); // Redirect to home/login
    };
    useEffect(() => {
        // Fetch current user email
        const getCurrUser = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) setUserEmail(user.email);
        };
        getCurrUser();

        // Inject scripts into window for legacy compatibility (DOM onclick handlers)
        if (typeof window !== 'undefined') {
            (window as any).showHome = showHome;
            (window as any).showProfile = showProfile;
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
            (window as any).openBroadcastModal = openBroadcastModal;
            (window as any).openExclusionModal = openExclusionModal;
            (window as any).switchAdminTab = switchAdminTab;
            (window as any).adjustWallet = adjustWallet;
            (window as any).manageAltar = manageAltar;
            (window as any).adminTaskAction = adminTaskAction;
            (window as any).toggleTaskQueue = toggleTaskQueue;
            (window as any).expandAdminCategory = expandAdminCategory;
            (window as any).updateDashboardAltar = updateDashboardAltar;
            (window as any).openTaskGallery = openTaskGallery;
            (window as any).closeTaskGallery = closeTaskGallery;
            (window as any).filterTaskGallery = filterTaskGallery;
            (window as any).addQueueTask = addQueueTask;
            (window as any).deleteQueueItem = deleteQueueItem;
            (window as any).openModById = openModById;
            (window as any).switchProfileTab = switchProfileTab;
            (window as any).openProfileUpload = openProfileUpload;
            (window as any).showPosts = showPosts;
            (window as any).submitQueenPost = submitQueenPost;
            (window as any).deleteQueenPost = deleteQueenPost;
            (window as any).loadQueenPostsDashboard = loadQueenPostsDashboard;
            (window as any).closeChatPreview = closeChatPreview;

            // Additional Bindings from scripts
            (window as any).initDashboard = initDashboard;
            (window as any).handleLogout = handleLogout;
        }

        // 1. Initialize System (UI Listeners)
        initDashboard();

        // 2. Fetch Real Data & Hydrate State
        const loadLiveAction = async () => {
            console.log("Fetching Admin Dashboard Data...");
            const data = await getAdminDashboardData();

            if (data.success && data.users) {
                // Map Supabase (snake_case) to Dashboard (camelCase)
                const mappedUsers = data.users.map((u: any) => ({
                    ...u,
                    memberId: u.member_id,
                    avatar: getOptimizedUrl(u.avatar_url || u.profile_picture_url || 'https://via.placeholder.com/150', 100),
                    points: u.score || 0,
                    // Parse JSON params if needed
                    activeTask: u.parameters?.taskdom_active_task || null,
                    endTime: u.parameters?.taskdom_end_time || null,
                    status: u.parameters?.status || u.hierarchy,
                    kneelCount: u.kneel_history?.totalSessions || 0,
                    kneelHistory: u.kneel_history || {}
                }));

                setUsers(mappedUsers);
                setAvailableDailyTasks(data.dailyTasks || []);

                // Build Global Queue from Taskdom_History in each user's tasks data
                const allQueues: any[] = [];
                mappedUsers.forEach((u: any) => {
                    const hist = u['Taskdom_History'];
                    let histArr: any[] = [];
                    try { histArr = typeof hist === 'string' ? JSON.parse(hist || '[]') : (hist || []); } catch { }
                    histArr.filter((t: any) => t.status === 'pending').forEach((t: any) => {
                        allQueues.push({ ...t, ownerId: u.memberId, ownerName: u.name, ownerAvatar: u.avatar });
                    });
                });
                setGlobalQueue(allQueues);

                // Aggregate Global Tributes
                const allTributes = mappedUsers.flatMap((u: any) => {
                    let history = [];
                    try {
                        const raw = u.parameters?.tributeHistory;
                        if (raw) {
                            history = typeof raw === 'string' ? JSON.parse(raw) : raw;
                        }
                    } catch (e) { }

                    return history.map((t: any) => ({
                        ...t,
                        memberId: u.memberId,
                        memberName: u.name,
                        memberAvatar: u.avatar
                    }));
                }).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

                setGlobalTributes(allTributes);

                console.log("Dashboard Hydrated with Live Data:", mappedUsers.length, "users");
                renderMainDashboard();
            }
        };

        loadLiveAction();
    }, []);

    return (
        <div className="layout">
            {/* SIDEBAR */}
            <div className="sidebar">
                <div className="sb-dash-btn" onClick={() => (window as any).showHome()}>DASHBOARD</div>
                <div
                    className="sb-dash-btn"
                    onClick={() => (window as any).showPosts()}
                    style={{ backgroundImage: 'linear-gradient(135deg,rgba(197,160,89,0.08),transparent)', borderBottom: '1px solid rgba(197,160,89,0.2)', color: '#c5a059' }}
                >✦ POSTS</div>
                <div style={{ textAlign: 'center', padding: '5px', borderBottom: '1px solid #333' }}>
                    <div style={{ fontSize: '0.5rem', color: '#666' }}>TODAY'S ID</div>
                    <div id="adminDailyCode" style={{ color: 'var(--blue)', fontWeight: 900, fontFamily: 'Share Tech Mono', fontSize: '1.1rem' }}>----</div>
                </div>
                <div className="sb-head">SUB LIST</div>
                <div id="userList" className="user-list"></div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="content">

                {/* 1. HOME VIEW */}
                <div id="viewHome">
                    <div className="v-header">
                        <div className="v-header-left">
                            <div className="v-breadcrumb">Pages / Dashboard</div>
                            <div className="v-title">Dashboard</div>
                        </div>
                    </div>

                    <div className="v-grid-stats">
                        <div className="v-stat-card glass-card">
                            <div className="vs-info">
                                <div className="vs-label">Today's Tributes</div>
                                <div className="vs-val" id="statTributes">0 <span className="vs-perc">+55%</span></div>
                            </div>
                            <div className="vs-icon blue-bg">💰</div>
                        </div>
                        <div className="v-stat-card glass-card">
                            <div className="vs-info">
                                <div className="vs-label">Active Slaves</div>
                                <div className="vs-val" id="statActive">0 <span className="vs-perc">+5%</span></div>
                            </div>
                            <div className="vs-icon blue-bg">👤</div>
                        </div>
                        <div className="v-stat-card glass-card">
                            <div className="vs-info">
                                <div className="vs-label">Pending Reviews</div>
                                <div className="vs-val" id="statPending">0 <span className="vs-perc neg">-14%</span></div>
                            </div>
                            <div className="vs-icon blue-bg">📝</div>
                        </div>
                        <div className="v-stat-card glass-card">
                            <div className="vs-info">
                                <div className="vs-label">Total Failures</div>
                                <div className="vs-val" id="statSkipped">0 <span className="vs-perc">+8%</span></div>
                            </div>
                            <div className="vs-icon blue-bg">⚠️</div>
                        </div>
                    </div>

                    <div className="v-grid-main">
                        {/* HERO CARD */}
                        <div className="v-hero-card glass-card span-2"
                            style={{ backgroundImage: `linear-gradient(rgba(6, 11, 40, 0.8), rgba(6, 11, 40, 0.8)), url('/hero-bg.png')` }}>
                            <div className="vh-content">
                                <div className="vh-title">Welcome back,<br />Queen Karin</div>
                                <div className="vh-sub" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    <div>System dominance is at 98%. <br />Manage your subjects below.</div>
                                    <div style={{ color: '#aaa', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                                        <span>Logged in as: <b>{userEmail || '...'}</b></span>
                                        <button
                                            onClick={handleLogout}
                                            style={{ background: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,0,0,0.3)', color: '#ff4444', fontSize: '0.6rem', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Orbitron' }}
                                        >LOGOUT</button>
                                    </div>
                                </div>
                            </div>
                            <div className="vh-footer">Tap to record →</div>
                        </div>

                        {/* GAUGE CARD */}
                        <div className="v-gauge-card glass-card span-1">
                            <div className="vg-header">
                                <div className="vg-title">Silence Protocol</div>
                                <div className="vg-sub">System Health</div>
                            </div>
                            <div className="vg-gauge-con">
                                <div className="vg-circle">
                                    <div className="vg-val" id="pdPercentage">0%</div>
                                    <div className="vg-label">of Goal</div>
                                </div>
                            </div>
                            <div className="vg-controls">
                                <div className="vgc-row">
                                    <div className="vgc-input-group">
                                        <span className="vgc-label">GOAL</span>
                                        <input type="number" id="pdGoal" className="vgc-input" defaultValue="1000" />
                                    </div>
                                    <div className="vgc-switch" onClick={() => (window as any).toggleNewbieImmunity()}>
                                        <div id="pdImmunity" className="vgc-checkbox checked">✕</div>
                                        <span>NEWBIE SAFE</span>
                                    </div>
                                </div>
                                <div className="vgc-actions">
                                    <button className="vgc-btn" onClick={() => (window as any).openExclusionModal()} title="Exclusions">EXCLUDE</button>
                                    <button className="vgc-btn pink" onClick={() => (window as any).openBroadcastModal()}>BROADCAST</button>
                                </div>
                            </div>
                            <div className="vg-stats">
                                <button id="pdBtn" onClick={() => (window as any).toggleProtocol()} className="vg-action-btn">ENGAGE</button>
                            </div>
                        </div>

                        {/* BEST SUB */}
                        <div className="v-best-sub glass-card span-1">
                            <div className="vb-header">
                                <div className="vb-title">Top Subject</div>
                                <div className="vb-sub">Merit Leader</div>
                            </div>
                            <div className="vb-content">
                                <div className="vb-av-box glow-blue">
                                    <img id="bestSubAvatar" src="https://via.placeholder.com/100" className="vb-av" alt="Top Subject" />
                                </div>
                                <div id="bestSubName" className="vb-name">Searching...</div>
                                <div id="bestSubValue" className="vb-val">0 PTS</div>
                            </div>
                        </div>

                        {/* ENDURANCE COUNTER */}
                        <div className="v-kneel-card glass-card span-2">
                            <div className="vk-header">
                                <div className="vk-title">Endurance Tracking</div>
                                <div className="vk-sub">Total Community Kneel</div>
                            </div>
                            <div className="vk-counter-box">
                                <div id="totalKneelMins" className="vk-val">0</div>
                                <div className="vk-unit">MINUTES</div>
                            </div>
                            <div className="vk-footer-stats">
                                <div className="vk-sub-stat">
                                    <span className="vks-label">Sessions</span>
                                    <span id="totalKneelSessions" className="vks-val">0</span>
                                </div>
                                <div className="vk-sub-stat">
                                    <span className="vks-label">Active</span>
                                    <span id="activeKneelers" className="vks-val">0</span>
                                </div>
                            </div>
                        </div>

                        {/* OPERATIONS MONITOR */}
                        <div className="v-monitor-card glass-card span-2">
                            <div className="vm-header">Operations Monitor</div>
                            <div id="opsList" className="vm-body"></div>
                        </div>

                        {/* INTEL FEED */}
                        <div className="v-feed-card glass-card span-4">
                            <div className="vf-header">Revenue & Intel Stream</div>
                            <div id="feedLog" className="vf-body feed-log"></div>
                        </div>
                    </div>
                </div>

                {/* POSTS VIEW */}
                <div id="viewPosts" style={{ display: 'none', flexDirection: 'column', gap: '25px', padding: '30px', overflowY: 'auto', height: '100%' }}>
                    <div style={{ borderBottom: '1px solid #222', paddingBottom: '20px' }}>
                        <div style={{ fontFamily: 'Cinzel', fontSize: '1.5rem', color: '#c5a059', letterSpacing: '4px', marginBottom: '5px' }}>QUEEN'S DISPATCH</div>
                        <div style={{ fontFamily: 'Rajdhani', fontSize: '0.75rem', color: '#555', letterSpacing: '2px' }}>PUBLISH POSTS · VISIBLE TO ALL SUBJECTS</div>
                    </div>

                    {/* COMPOSE */}
                    <div style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.2)', borderRadius: '8px', padding: '25px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div style={{ fontFamily: 'Orbitron', fontSize: '0.65rem', color: '#c5a059', letterSpacing: '3px', marginBottom: '5px' }}>NEW POST</div>
                        <input
                            id="postTitleInput"
                            type="text"
                            placeholder="TITLE (optional)"
                            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid #333', color: '#fff', fontFamily: 'Cinzel', fontSize: '0.85rem', padding: '12px 16px', outline: 'none', letterSpacing: '2px', borderRadius: '4px' }}
                        />
                        <textarea
                            id="postBodyInput"
                            placeholder="Write your decree..."
                            rows={5}
                            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid #333', color: '#fff', fontFamily: 'Rajdhani', fontSize: '0.9rem', padding: '12px 16px', outline: 'none', resize: 'vertical', borderRadius: '4px', lineHeight: 1.6 }}
                        />
                        {/* Image upload */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <label htmlFor="postImageInput" style={{ background: '#111', border: '1px solid #333', color: '#888', fontFamily: 'Orbitron', fontSize: '0.6rem', padding: '8px 16px', cursor: 'pointer', letterSpacing: '2px', borderRadius: '4px' }}>+ IMAGE</label>
                            <input type="file" id="postImageInput" accept="image/*,video/*" style={{ display: 'none' }} onChange={(e) => {
                                const file = e.target.files?.[0];
                                const preview = document.getElementById('postImagePreview') as HTMLImageElement;
                                if (file && preview) {
                                    preview.src = URL.createObjectURL(file);
                                    preview.style.display = 'block';
                                }
                            }} />
                            <span style={{ fontFamily: 'Rajdhani', fontSize: '0.75rem', color: '#555' }}>Optional — image or video attachment</span>
                        </div>
                        <img id="postImagePreview" src="" alt="preview" style={{ display: 'none', maxHeight: '180px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #333' }} />
                        <button
                            id="postSubmitBtn"
                            onClick={() => (window as any).submitQueenPost()}
                            style={{ background: '#c5a059', color: '#000', border: 'none', fontFamily: 'Cinzel', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '4px', padding: '14px', cursor: 'pointer', borderRadius: '4px', transition: 'all 0.3s' }}
                        >PUBLISH</button>
                    </div>

                    {/* POSTS LIST */}
                    <div id="postsListContainer" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div style={{ color: '#444', fontFamily: 'Cinzel', fontSize: '0.8rem', padding: '20px', textAlign: 'center' }}>Click POSTS to load...</div>
                    </div>
                </div>

                {/* 2. PROFILE VIEW */}
                <div id="viewProfile" style={{ display: 'none' }}>
                    <div className="qp-header">
                        <div className="qp-cover"></div>
                        <div className="qp-av-con">
                            <img src="https://static.wixstatic.com/media/ce3e5b_1bd27ba758ce465fa89a36d70a68f355~mv2.png" className="qp-av" alt="Profile" />
                        </div>
                        <div className="qp-name">QUEEN KARIN</div>
                        <div className="qp-status">SYSTEM ADMINISTRATOR</div>
                        <div className="qp-stats-row">
                            <div className="qp-stat">
                                <div className="qp-s-val" id="cntPosts">0</div>
                                <div className="qp-s-lbl">POSTS</div>
                            </div>
                            <div className="qp-stat">
                                <div className="qp-s-val" id="cntSubs">0</div>
                                <div className="qp-s-lbl">SUBJECTS</div>
                            </div>
                            <div className="qp-stat">
                                <div className="qp-s-val" id="cntStories">0</div>
                                <div className="qp-s-lbl">STORIES</div>
                            </div>
                        </div>
                    </div>
                    <div className="story-rail" id="storyRail">
                        <div className="story-ring story-add" onClick={() => (window as any).openProfileUpload(true)}>+</div>
                    </div>
                    <div className="qp-tabs">
                        <div className="qp-tab active" onClick={() => (window as any).switchProfileTab('media')}>GRID</div>
                        <div className="qp-tab" onClick={() => (window as any).switchProfileTab('text')}>WRITINGS</div>
                    </div>
                    <div id="profileMediaGrid" className="media-grid"></div>
                    <div id="profileTextGrid" className="text-grid d-none"></div>
                    <button className="upload-fab" onClick={() => (window as any).openProfileUpload(false)}>+</button>
                </div>

                {/* 3. USER VIEW */}
                <div id="viewUser" style={{ display: 'none' }}>
                    <div className="split">
                        <div className="chat-panel">
                            <div className="cp-head">ENCRYPTED FEED</div>
                            <div className="admin-dash-top" style={{ display: 'flex', flexDirection: 'column', height: '35%', borderBottom: '1px solid #333', background: '#080808' }}>
                                <div className="ap-nav" style={{ display: 'flex', borderBottom: '1px solid #333', background: '#0a0a0a', flexShrink: 0 }}>
                                    <button className="ap-tab active" onClick={() => (window as any).switchAdminTab('ops')} style={{ flex: 1, padding: '8px', background: 'transparent', border: 'none', color: '#666', fontFamily: 'Orbitron', cursor: 'pointer', borderBottom: '2px solid transparent', fontSize: '0.7rem' }}>OPS</button>
                                    <button className="ap-tab" onClick={() => (window as any).switchAdminTab('intel')} style={{ flex: 1, padding: '8px', background: 'transparent', border: 'none', color: '#666', fontFamily: 'Orbitron', cursor: 'pointer', borderBottom: '2px solid transparent', fontSize: '0.7rem' }}>INTEL</button>
                                    <button className="ap-tab" onClick={() => (window as any).switchAdminTab('record')} style={{ flex: 1, padding: '8px', background: 'transparent', border: 'none', color: '#666', fontFamily: 'Orbitron', cursor: 'pointer', borderBottom: '2px solid transparent', fontSize: '0.7rem' }}>RECORD</button>
                                </div>

                                <div className="ap-content" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                                    <div id="tabOps" className="ap-view active" style={{ padding: '10px' }}>
                                        <div className="active-task-card gold-theme">
                                            <div className="at-header">
                                                <div className="at-label">CURRENT STATUS</div>
                                                <div id="dActiveStatus" className="at-status-text">UNPRODUCTIVE</div>
                                            </div>
                                            <div id="activeTaskContent">
                                                <div className="at-sub-label">ACTIVE DIRECTIVE</div>
                                                <div id="dActiveText" className="at-text">None</div>
                                                <div className="at-timer-row">
                                                    <div className="at-timer-label">TIME REMAINING</div>
                                                    <div id="dActiveTimer" className="at-timer-large">--:--</div>
                                                </div>
                                                <div className="at-actions">
                                                    <button className="at-btn at-fail" onClick={() => (window as any).adminTaskAction((window as any).currId, 'skip')}>CANCEL TASK</button>
                                                </div>
                                            </div>
                                            <div id="idleActions" style={{ display: 'none', paddingTop: '10px' }}>
                                                <button className="at-btn at-send" onClick={() => (window as any).adminTaskAction(null, 'send')}>SEND NEW TASK</button>
                                            </div>
                                        </div>
                                        <button className="schedule-btn" onClick={() => (window as any).toggleTaskQueue()}>SCHEDULE TASKS</button>
                                        <div id="taskQueueContainer" className="task-queue-box hidden" style={{ marginTop: '10px' }}>
                                            <div className="sec-title clickable-title" onClick={() => (window as any).openTaskGallery()} style={{ color: 'var(--blue)' }}>TASK QUEUE</div>
                                            <div id="qListContainer" className="q-list-vertical" style={{ maxHeight: '150px' }}></div>
                                            <div className="q-input-row">
                                                <input type="text" id="qInput" className="q-input" placeholder="Add task..." list="cmsTasksList" />
                                                <button className="q-add-btn" onClick={() => (window as any).addQueueTask()}>+</button>
                                            </div>
                                        </div>
                                    </div>

                                    <div id="tabIntel" className="ap-view hidden" style={{ padding: '10px' }}>
                                        <div id="userQueueSec" style={{ display: 'none', flexDirection: 'column', gap: '8px' }}></div>
                                        <div className="sec-box">
                                            <div className="sec-title">ENDURANCE TELEMETRY</div>
                                            <div id="kneelStatsBox" className="telemetry-grid">
                                                <div className="t-stat"><span>TOTAL</span><strong id="dTotalKneel">0h</strong></div>
                                                <div className="t-stat"><span>SESSION</span><strong id="dLastKneel">--</strong></div>
                                            </div>
                                        </div>
                                        <div className="sec-box">
                                            <div className="sec-title" style={{ color: 'var(--pink)' }}>DOSSIER</div>
                                            <div id="dossierGrid" className="dossier-grid"></div>
                                        </div>
                                        <div className="sec-box">
                                            <div className="sec-title" style={{ color: 'var(--gold)' }}>TRIBUTE INVENTORY</div>
                                            <div id="inventoryGrid" className="inv-grid"></div>
                                        </div>
                                    </div>

                                    <div id="tabRecord" className="ap-view hidden" style={{ padding: '10px', height: '100%', position: 'relative' }}>
                                        <div id="adminOrbitalCanvas" className="admin-orbital-canvas">
                                            <div className="altar-label">THE SUPREME ALTAR</div>
                                            <div className="altar-admin-row">
                                                <div className="aa-slot" id="adminAltarSlot1" onClick={() => (window as any).manageAltar(1)}>
                                                    <div className="aa-slot-label">I</div>
                                                    <img src="" id="adminAltarImg1" className="aa-img hidden" alt="Altar 1" />
                                                    <div className="aa-glow"></div>
                                                </div>
                                                <div className="aa-slot central" id="adminAltarSlot2" onClick={() => (window as any).manageAltar(2)}>
                                                    <div className="aa-slot-label">II</div>
                                                    <img src="" id="adminAltarImg2" className="aa-img hidden" alt="Altar 2" />
                                                    <div className="aa-glow"></div>
                                                </div>
                                                <div className="aa-slot" id="adminAltarSlot3" onClick={() => (window as any).manageAltar(3)}>
                                                    <div className="aa-slot-label">III</div>
                                                    <img src="" id="adminAltarImg3" className="aa-img hidden" alt="Altar 3" />
                                                    <div className="aa-glow"></div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="admin-record-bento">
                                            <div className="admin-bento-node node-accepted" onClick={() => (window as any).expandAdminCategory('accepted')}>
                                                <div className="node-icon">✔️</div>
                                                <div className="node-label">ACCEPTED</div>
                                                <div className="node-count" id="adminAcceptedCount">0</div>
                                            </div>
                                            <div className="admin-bento-node node-routine" onClick={() => (window as any).expandAdminCategory('routine')}>
                                                <div className="node-icon">⚓</div>
                                                <div className="node-label">ROUTINE</div>
                                                <div className="node-count" id="adminRoutineCount">0</div>
                                            </div>
                                            <div className="admin-bento-node node-pending" onClick={() => (window as any).expandAdminCategory('pending')}>
                                                <div className="node-icon">⏳</div>
                                                <div className="node-label">PENDING</div>
                                                <div className="node-count" id="adminPendingCount">0</div>
                                            </div>
                                            <div className="admin-bento-node node-denied" onClick={() => (window as any).expandAdminCategory('denied')}>
                                                <div className="node-icon">💀</div>
                                                <div className="node-label">THE VOID</div>
                                                <div className="node-count" id="adminDeniedCount">0</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div id="chatMediaOverlay" className="hidden" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 500, backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div id="mediaOverlayClose" onClick={() => (window as any).closeChatPreview()} style={{ position: 'absolute', top: '20px', right: '20px', cursor: 'pointer', fontSize: '2rem', color: 'white', fontWeight: 300 }}>&times;</div>
                                <div id="chatMediaOverlayContent" style={{ width: '100%', maxWidth: '90%', maxHeight: '90%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}></div>
                            </div>
                            <div className="c-body" id="adminChatBox"></div>
                            <div className="hierarchy-top" id="mirrorRank">SLAVE</div>
                            <div id="lastSeen" style={{ textAlign: 'center', fontFamily: 'Rajdhani', fontSize: '0.7rem', color: '#666', marginTop: '-20px', marginBottom: '20px', letterSpacing: '1px' }}>OFFLINE</div>
                            <div className="c-foot">
                                <input type="file" id="adminMediaInput" accept="image/*,video/*" className="hidden-input" onChange={(e) => (window as any).handleAdminUpload(e.target)} />
                                <button className="btn-plus" onClick={() => document.getElementById('adminMediaInput')?.click()}>+</button>
                                <input type="text" id="adminInp" className="inp" placeholder="Command..." onKeyPress={(e) => { if (e.key === 'Enter') (window as any).sendMsg(); }} />
                                <button onClick={() => (window as any).sendMsg()} className="btn-send">{'>'}</button>
                            </div>
                        </div>

                        <div className="action-panel" style={{ background: '#050505', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
                            <div id="apMirrorHeader" className="ap-mirror-header" style={{ padding: '20px', textAlign: 'center', borderBottom: '1px solid #333', backgroundSize: 'cover', backgroundPosition: 'center' }}>
                                <div id="dMirrorHierarchy" className="hierarchy-top" style={{ margin: '0 auto 15px auto', display: 'inline-block' }} title="Current Rank">LOADING...</div>
                                <div className="avatar-container" style={{ width: '120px', height: '140px', margin: '0 auto 15px' }}>
                                    <img id="dProfilePic" src="https://static.wixstatic.com/media/ce3e5b_78da97e06a3848df84d0b00c9e6dcfdd~mv2.png" alt="Profile" />
                                </div>
                                <div id="dMirrorName" className="identity-name" style={{ marginBottom: '5px', fontSize: '1.2rem' }}>SLAVE</div>
                                <div id="dMirrorStatus" style={{ fontFamily: 'Orbitron', color: '#00ff00', fontSize: '0.7rem', letterSpacing: '1px', marginBottom: '15px' }}>ONLINE</div>
                                <div className="stats-stack-row" style={{ marginBottom: '15px' }}>
                                    <div className="stat-item">
                                        <span className="stat-lbl">MERIT</span>
                                        <span id="dMirrorPoints" className="stat-val">0</span>
                                    </div>
                                    <div className="stat-divider"></div>
                                    <div className="stat-item">
                                        <span className="stat-lbl">CAPITAL</span>
                                        <span id="dMirrorWallet" className="stat-val">0</span>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginTop: '5px' }}>
                                            <button onClick={() => (window as any).adjustWallet('sub')} style={{ background: '#222', border: '1px solid #444', color: 'var(--red)', fontSize: '10px', cursor: 'pointer' }}>-</button>
                                            <button onClick={() => (window as any).adjustWallet('add')} style={{ background: '#222', border: '1px solid #444', color: 'var(--green)', fontSize: '10px', cursor: 'pointer' }}>+</button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="ap-vitals-mirror" style={{ padding: '15px', background: '#080808', display: 'block' }}>
                                <div className="kneel-sidebar-wrapper" style={{ marginBottom: '15px' }}>
                                    <div className="kneel-bar-graphic" style={{ cursor: 'default' }}>
                                        <div className="graphic-fill" style={{ width: '0%' }}></div>
                                        <span className="graphic-text">KNEEL TIME: <span id="dMirrorKneel">0h</span></span>
                                        <div style={{ position: 'absolute', right: '5px', top: 0, bottom: 0, display: 'flex', alignItems: 'center' }}>
                                            <button onClick={() => (window as any).adjustKneel('add')} style={{ background: '#222', border: '1px solid #444', color: 'var(--green)', fontSize: '10px', padding: '2px 5px', cursor: 'pointer' }}>+1H</button>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ width: '100%', textAlign: 'center', paddingBottom: '15px', borderBottom: '1px solid #333', marginBottom: '15px' }}>
                                    <div style={{ fontFamily: 'Cinzel', fontSize: '0.6rem', color: '#666', letterSpacing: '2px' }}>CURRENT CLASSIFICATION</div>
                                    <div id="admin_CurrentRank" style={{ fontFamily: 'Cinzel', fontSize: '1.2rem', color: '#fff', margin: '5px 0', textTransform: 'uppercase' }}>LOADING...</div>
                                    <div id="admin_CurrentBenefits" style={{ fontFamily: 'Cinzel', fontSize: '0.65rem', color: '#888', fontStyle: 'italic', padding: '0 10px', lineHeight: 1.4 }}></div>
                                </div>

                                <div style={{ width: '100%', textAlign: 'center', marginBottom: '15px' }}>
                                    <div style={{ fontFamily: 'Orbitron', fontSize: '0.6rem', color: '#c5a059', letterSpacing: '2px' }}>WORKING ON PROMOTION TO</div>
                                    <div id="admin_NextRank" style={{ fontFamily: 'Orbitron', fontSize: '1.4rem', color: '#c5a059', fontWeight: 900, letterSpacing: '1px', marginTop: '5px', textShadow: '0 0 15px rgba(197, 160, 89, 0.3)', textTransform: 'uppercase' }}>LOADING...</div>
                                </div>

                                <div id="admin_ProgressContainer" style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid #333', borderRadius: '4px', padding: '15px', marginBottom: '20px' }}></div>

                                <div style={{ width: '100%', textAlign: 'left', padding: '0 5px', marginBottom: '15px' }}>
                                    <div style={{ fontFamily: 'Orbitron', fontSize: '0.6rem', color: '#c5a059', marginBottom: '8px' }}>PRIVILEGES GRANTED</div>
                                    <ul id="admin_NextBenefits" style={{ color: '#ccc', fontSize: '0.75rem', fontFamily: 'Cinzel', paddingLeft: '20px', lineHeight: 1.6, margin: 0 }}></ul>
                                </div>

                                <div className="stat-line"><span>Routine</span> <strong id="dMirrorRoutine">PENDING</strong></div>
                                <div className="stat-footer">
                                    <div style={{ color: '#666', fontSize: '0.7rem', letterSpacing: '2px', marginBottom: '5px' }}>SLAVE SINCE</div>
                                    <strong id="dMirrorSlaveSince" style={{ color: '#ccc', fontSize: '0.9rem' }}>--/--/--</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* SHARED MODALS */}
            <div id="reviewModal" className="modal" style={{ display: 'none' }}>
                <div className="m-content" style={{ position: 'relative' }}>
                    <span onClick={() => (window as any).closeModal()} style={{ position: 'absolute', top: '15px', right: '20px', fontSize: '2.5rem', color: '#666', cursor: 'pointer', zIndex: 1100, lineHeight: 1 }}>&times;</span>
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
                                <div className="rw-group">
                                    <div className="rw-label">BONUS COINS</div>
                                    <input type="number" id="rewardBonus" className="rw-inp" defaultValue="50" />
                                </div>
                                <div className="rw-group">
                                    <div className="rw-label">COMMENT</div>
                                    <input type="text" id="rewardComment" className="rw-inp" placeholder="Optional message..." />
                                </div>
                            </div>
                            <div className="rw-media-row">
                                <label htmlFor="rewardFileUpload" className="rw-icon-btn">📁</label>
                                <div id="btnRecordReward" className="rw-icon-btn" onClick={() => (window as any).toggleRewardRecord()}>🎤</div>
                                <div id="rewardMediaPreview" className="rw-preview-box d-none"></div>
                            </div>
                            <input type="file" id="rewardFileUpload" accept="image/*,video/*,audio/*" onChange={(e) => (window as any).handleRewardFileUpload(e.target)} style={{ display: 'none' }} />
                            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                                <button onClick={() => (window as any).cancelReward()} style={{ flex: 1, padding: '10px', background: '#666', color: 'white', border: 'none', borderRadius: '4px' }}>CANCEL</button>
                                <button onClick={() => (window as any).confirmReward()} style={{ flex: 1, padding: '10px', background: 'var(--green)', color: 'black', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>CONFIRM</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div id="exclusionModal" className="modal" style={{ display: 'none' }}>
                <div className="m-content" style={{ width: '400px', height: 'auto', maxHeight: '70vh', display: 'flex', flexDirection: 'column', padding: '20px' }}>
                    <h3 style={{ color: 'var(--red)', marginBottom: '15px', textAlign: 'center' }}>PROTOCOL EXCLUSIONS</h3>
                    <div id="exclusionList" className="ex-list"></div>
                    <button onClick={() => (window as any).closeExclusionModal()} style={{ marginTop: '15px', padding: '10px', background: '#666', color: 'white', border: 'none', borderRadius: '4px' }}>CLOSE</button>
                </div>
            </div>

            <div id="broadcastModal" className="modal" style={{ display: 'none' }}>
                <div className="m-content" style={{ display: 'flex', flexDirection: 'column', width: '600px', height: 'auto', maxHeight: '80vh', padding: '20px', border: '1px solid var(--pink)', boxShadow: '0 0 20px rgba(255,0,222,0.1)' }}>
                    <div className="br-head">BROADCAST MESSAGE</div>
                    <textarea id="brText" className="br-inp" placeholder="Enter your message..."></textarea>
                    <div className="br-preset-row">
                        <button className="br-mini-btn" onClick={() => (window as any).saveBroadcastPreset()}>SAVE PRESET</button>
                        <button className="br-mini-btn" onClick={() => (window as any).togglePresets()}>LOAD PRESET</button>
                    </div>
                    <div id="presetList"></div>
                    <label htmlFor="brFile" className="br-file-label">ATTACH MEDIA</label>
                    <input type="file" id="brFile" accept="image/*,video/*" onChange={(e) => (window as any).handleBroadcastFile(e.target)} style={{ display: 'none' }} />
                    <img id="brPreviewImg" className="br-prev" alt="Preview" />
                    <video id="brPreviewVid" className="br-prev" muted autoPlay loop></video>
                    <h4 style={{ color: 'var(--pink)', margin: '15px 0 10px 0', fontSize: '0.9rem' }}>EXCLUDE USERS:</h4>
                    <div id="brUserList" className="ex-list" style={{ maxHeight: '150px', overflowY: 'auto' }}></div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                        <button onClick={() => (window as any).closeBroadcastModal()} style={{ flex: 1, padding: '15px', background: '#666', color: 'white', border: 'none', borderRadius: '4px' }}>CANCEL</button>
                        <button onClick={() => (window as any).sendBroadcast()} className="br-btn">SEND BROADCAST</button>
                    </div>
                </div>
            </div>

            <div id="taskGalleryModal" className="modal" style={{ display: 'none' }}>
                <div className="m-content" style={{ width: '98%', maxWidth: '1300px', height: '92vh', display: 'flex', flexDirection: 'column', padding: 0, border: '1px solid var(--blue)', background: 'rgba(5,5,5,0.98)', borderRadius: '15px', overflow: 'hidden' }}>
                    <div style={{ padding: '20px', borderBottom: '1px solid #222', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', background: 'rgba(0,0,0,0.8)', flexShrink: 0, position: 'relative' }}>
                        <button onClick={() => (window as any).closeTaskGallery()} style={{ position: 'absolute', right: '20px', top: '15px', background: 'transparent', border: 'none', color: '#444', fontSize: '2rem', cursor: 'pointer' }}>&times;</button>
                        <div id="armoryTitle" style={{ color: 'white', fontWeight: 900, fontSize: '1.6rem', letterSpacing: '4px', fontFamily: 'Orbitron', textTransform: 'uppercase' }}>SLAVE TASKS</div>
                        <input type="text" id="taskSearchInput" onKeyUp={() => (window as any).filterTaskGallery()} placeholder="SEARCH DIRECTIVES..." style={{ width: '300px', background: '#000', border: '1px solid #333', borderRadius: '15px', padding: '6px 15px', color: 'white', fontFamily: 'Rajdhani', fontSize: '0.75rem', outline: 'none', letterSpacing: '1px', textAlign: 'center' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', flex: 1, overflow: 'hidden' }}>
                        <div style={{ borderRight: '1px solid #222', background: 'rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <div id="armoryLiveQueue" style={{ flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}></div>
                        </div>
                        <div id="glassTaskGrid" style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#050505' }}></div>
                    </div>
                </div>
            </div>

            {/* SOUND ASSETS */}
            <audio id="msgSound" src="https://static.wixstatic.com/mp3/ce3e5b_7b8a7b3cdcdf542e6b6fd01ef272d75bc.mp3" preload="auto"></audio>
            <audio id="sfx-notify" src="https://static.wixstatic.com/mp3/ce3e5b_31aab32ecdf542e6b6fd01ef272d75bc.mp3" preload="auto"></audio>
        </div>
    );
}

