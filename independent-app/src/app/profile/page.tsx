"use client";

import React, { useEffect, useState } from 'react';
import './profile.css';
import { getState, setState } from '@/scripts/profile-state';
import { handleHoldStart, handleHoldEnd, updateKneelingUI } from '@/scripts/kneeling';
import { claimKneelReward, switchTab, toggleTributeHunt, openLobby, closeLobby } from '@/scripts/profile-logic';

export default function ProfilePage() {
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);

    useEffect(() => {
        async function loadProfile() {
            try {
                // In a real app, we'd get the memberId from auth
                const memberId = "test-member-id";
                const res = await fetch(`/api/dashboard-data?memberId=${memberId}`);
                const data = await res.json();

                if (data.profile) {
                    setProfile(data.profile);
                    setState({
                        memberId: data.profile.member_id,
                        coins: data.profile.coins || 0,
                        points: data.profile.points || 0,
                        userName: data.profile.name || "SLAVE",
                        rank: data.profile.rank || "INITIATE"
                    });
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

    if (loading) return <div className="loading">LOADING COMMAND CONSOLE...</div>;

    return (
        <div id="PROFILE_CONTAINER">
            {/* DESKTOP APP */}
            <div id="DESKTOP_APP">
                <div className="v-sidebar">
                    <div className="v-card" style={{ marginBottom: '20px', textAlign: 'center', padding: '25px 15px' }}>
                        <div className="big-profile-circle">
                            <img id="profilePic" src={profile?.profile_pic || ""} alt="Avatar" className="profile-img" />
                        </div>
                        <div className="identity-name">{getState().userName}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '20px' }}>
                            <div className="sidebar-stat-block">
                                <div className="sidebar-stat-value-row">
                                    <span style={{ color: '#fff', opacity: 0.8 }}><i className="fas fa-award"></i></span>
                                    <div>{getState().points}</div>
                                </div>
                                <div className="sidebar-stat-label">MERIT</div>
                            </div>
                            <div className="sidebar-stat-block">
                                <div className="sidebar-stat-value-row">
                                    <span style={{ color: 'var(--gold)' }}><i className="fas fa-coins"></i></span>
                                    <div>{getState().coins}</div>
                                </div>
                                <div className="sidebar-stat-label">CAPITAL</div>
                            </div>
                        </div>
                    </div>

                    <div className="nav-menu">
                        <button className="nav-btn active" onClick={() => switchTab('serve')}>🏠 DASHBOARD</button>
                        <button className="nav-btn" onClick={() => switchTab('record')}>📜 RECORDS</button>
                        <button className="nav-btn" onClick={() => switchTab('news')}>👑 QUEEN KARIN</button>
                        <button className="nav-btn" onClick={() => switchTab('vault')}>💎 VAULT</button>
                        <button className="nav-btn" onClick={() => switchTab('protocol')}>📑 PROTOCOL</button>
                        <button className="nav-btn" onClick={() => switchTab('buy')}>💰 EXCHEQUER</button>
                    </div>
                </div>

                <div id="viewServingTopDesktop" className="view-wrapper">
                    {/* STAT CARDS */}
                    <div className="v-card v-stat-card">
                        <div className="ribbon-label">KNEELING HOURS</div>
                        <div className="prog-bg">
                            <div id="deskKneelDailyFill" className="prog-fill" style={{ width: '0%' }}></div>
                        </div>
                    </div>

                    <div className="v-card v-stat-card">
                        <div className="ribbon-label">CONSISTENCY</div>
                        <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '0.6rem', opacity: 0.7 }}>STREAK</div>
                                <div id="deskStreak" style={{ fontSize: '1.5rem' }}>0</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '0.6rem', opacity: 0.7 }}>TOTAL</div>
                                <div id="deskTotal" style={{ fontSize: '1.5rem', color: 'var(--gold)' }}>0</div>
                            </div>
                        </div>
                    </div>

                    {/* HERO SECTION */}
                    <div id="gridHero" className="v-card" style={{ gridColumn: 'span 2', position: 'relative', minHeight: '300px' }}>
                        <div style={{ padding: '20px' }}>
                            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>Welcome back,</p>
                            <h2 style={{ fontFamily: 'Orbitron', fontSize: '2rem' }}>{getState().userName}</h2>

                            <button
                                id="heroKneelBtn"
                                className="mob-kneel-bar"
                                onMouseDown={handleHoldStart}
                                onMouseUp={() => handleHoldEnd()}
                                onMouseLeave={() => handleHoldEnd()}
                                onTouchStart={handleHoldStart}
                                onTouchEnd={() => handleHoldEnd()}
                                style={{ width: '220px', margin: '20px 0', cursor: 'pointer' }}
                            >
                                <div id="heroKneelFill" className="mob-bar-fill"></div>
                                <div className="mob-bar-content">
                                    <span id="heroKneelText">HOLD TO KNEEL</span>
                                </div>
                            </button>
                        </div>

                        {/* REWARD OVERLAY */}
                        <div id="kneelRewardOverlay" className="hidden mob-reward-overlay" style={{ position: 'absolute' }}>
                            <div className="mob-reward-card">
                                <h2>DEVOTION RECOGNIZED</h2>
                                <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
                                    <button className="action-btn" onClick={() => claimKneelReward('coins')}>CLAIM COINS</button>
                                    <button className="action-btn" onClick={() => claimKneelReward('points')}>CLAIM MERIT</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* CHAT PANEL */}
                    <div id="viewServingTop" className="v-card" style={{ gridColumn: 'span 2', gridRow: 'span 2', padding: 0, overflow: 'hidden' }}>
                        <div className="chat-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <div id="chatBox" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                                <div id="chatContent"></div>
                            </div>
                            <div className="chat-footer" style={{ padding: '15px', background: 'rgba(255,255,255,0.03)' }}>
                                <input type="text" id="chatMsgInput" className="chat-input" placeholder="Communicate with the Void..." />
                                <button className="chat-btn-send" style={{ marginLeft: '10px' }}>&gt;</button>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT PANEL - TRIBUTE & QUEEN */}
                    <div className="v-card" style={{ gridColumn: 'span 2' }}>
                        <div className="ribbon-label">QUEEN KARIN</div>
                        <div id="desk_LatestKarinPhoto" style={{ height: '200px', background: '#111', borderRadius: '8px' }}></div>
                    </div>
                </div>

                {/* OTHER VIEWS */}
                <div id="historySection" className="view-wrapper hidden">
                    <div className="v-card" style={{ gridColumn: 'span 4' }}>
                        <div className="ribbon-label">THE CHRONICLES</div>
                        <div id="mosaicGrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' }}></div>
                    </div>
                </div>

                <div id="viewNews" className="view-wrapper hidden">
                    <div className="v-card" style={{ gridColumn: 'span 4' }}>
                        <div className="ribbon-label">QUEEN'S WALL</div>
                        <div id="newsGrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}></div>
                    </div>
                </div>

                <div id="viewBuy" className="view-wrapper hidden">
                    <div className="v-card" style={{ gridColumn: 'span 4' }}>
                        <div className="ribbon-label">EXCHEQUER</div>
                        <div className="store-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                            <div className="v-card store-item">
                                <div>1,000 🪙</div>
                                <button className="action-btn" style={{ width: '100%', marginTop: '10px' }}>€10.00</button>
                            </div>
                            <div className="v-card store-item">
                                <div>5,500 🪙</div>
                                <button className="action-btn" style={{ width: '100%', marginTop: '10px' }}>€50.00</button>
                            </div>
                            <div className="v-card store-item">
                                <div>12,000 🪙</div>
                                <button className="action-btn" style={{ width: '100%', marginTop: '10px' }}>€100.00</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="vault" className="view-wrapper hidden">
                    <div className="v-card" style={{ gridColumn: 'span 4' }}>
                        <div className="ribbon-label">THE ROYAL VAULT</div>
                        <div style={{ textAlign: 'center', padding: '50px' }}>
                            <i className="fas fa-lock" style={{ fontSize: '3rem', color: 'var(--gold)', marginBottom: '20px' }}></i>
                            <p>SEALED BY ROYAL DECREE</p>
                        </div>
                    </div>
                </div>

                <div id="protocol" className="view-wrapper hidden">
                    <div className="v-card" style={{ gridColumn: 'span 4' }}>
                        <div className="ribbon-label">THE PROTOCOL</div>
                        <div style={{ padding: '20px', lineHeight: '1.8' }}>
                            <h3>I. ABSOLUTE SUBMISSION</h3>
                            <p>The Slave shall acknowledge the Queen's authority in all matters...</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* MOBILE APP (Simplified for now) */}
            <div id="MOBILE_APP" style={{ display: 'none' }}>
                <div className="mob-hud-row">
                    <div className="hud-circle" onClick={openLobby}>
                        <img src="https://static.wixstatic.com/media/ce3e5b_e06c7a2254d848a480eb98107c35e246~mv2.png" alt="Settings" />
                    </div>
                </div>

                <div className="halo-section">
                    <div className="halo-ring">
                        <div className="halo-name">{getState().userName}</div>
                        <div className="halo-rank">{getState().rank}</div>
                    </div>
                </div>

                <div style={{ padding: '0 20px', width: '100%', marginTop: '30px' }}>
                    <button
                        className="mob-kneel-bar mob-kneel-zone"
                        onMouseDown={handleHoldStart}
                        onMouseUp={() => handleHoldEnd()}
                        onTouchStart={handleHoldStart}
                        onTouchEnd={() => handleHoldEnd()}
                    >
                        <div id="mob_kneelFill" className="mob-bar-fill"></div>
                        <div className="mob-bar-content">
                            <span className="kneel-label">HOLD TO KNEEL</span>
                        </div>
                    </button>
                </div>

                <div id="mobKneelReward" className="hidden mob-reward-overlay">
                    <div className="mob-reward-card">
                        <h2>DEVOTION RECOGNIZED</h2>
                        <button className="action-btn" onClick={() => claimKneelReward('coins')} style={{ width: '100%', marginBottom: '10px' }}>CLAIM COINS</button>
                        <button className="action-btn" onClick={() => claimKneelReward('points')} style={{ width: '100%' }}>CLAIM MERIT</button>
                    </div>
                </div>

                <div id="lobbyOverlay" className="hidden mob-reward-overlay">
                    <div className="mob-reward-card">
                        <h2>LOBBY</h2>
                        <button className="action-btn" onClick={closeLobby} style={{ marginTop: '20px' }}>CLOSE</button>
                    </div>
                </div>
            </div>

            <audio id="msgSound" src="https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3"></audio>
        </div>
    );
}
