'use client';

import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
    getAdminDashboardData, getUnreadMessageStatus,
    adminApproveTaskAction, adminRejectTaskAction, adminAssignTaskAction,
    processCoinTransaction, updateScoreAction, setHierarchyAction, insertMessage,
} from '@/actions/velo-actions';

type Tab = 'home' | 'subjects' | 'posts' | 'queen';
type ProfileTab = 'info' | 'tasks' | 'chat' | 'controls';

const RANKS = ["Hall Boy", "Footman", "Silverman", "Butler", "Chamberlain", "Secretary", "Queen's Champion"];

interface DashUser {
    memberId: string;
    name: string;
    avatar: string;
    rank: string;
    wallet: number;
    score: number;
    parameters: any;
    reviewQueue: any[];
    lastMessageTime: string | null;
    lastSeen: string | null;
    hasActiveTask: boolean;
}

function getOnlineStatus(lastSeen: string | null): 'online' | 'recent' | 'away' | 'offline' {
    if (!lastSeen) return 'offline';
    const diff = Date.now() - new Date(lastSeen).getTime();
    if (diff < 5 * 60 * 1000) return 'online';
    if (diff < 30 * 60 * 1000) return 'recent';
    if (diff < 2 * 60 * 60 * 1000) return 'away';
    return 'offline';
}
function statusColor(s: ReturnType<typeof getOnlineStatus>) {
    if (s === 'online') return '#6bcb77';
    if (s === 'recent') return '#c5a059';
    if (s === 'away') return '#ff8c42';
    return '#222';
}
function timeAgo(iso: string | null): string {
    if (!iso) return '';
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

const RANK_COLOR: Record<string, string> = {
    "Queen's Champion": '#d4af37',
    'Secretary': '#c5a059',
    'Chamberlain': '#4a9eff',
    'Butler': '#ff8c42',
    'Silverman': '#b8b8b8',
    'Footman': '#4ecdc4',
    'Hall Boy': '#555',
    'Newbie': '#444',
};
const rc = (rank: string) => RANK_COLOR[rank] || '#777';

// ─────────────────────────────────────────────────────────────────────────────
export default function MobileDashboard({ userEmail }: { userEmail: string }) {
    const [tab, setTab] = useState<Tab>('home');
    const [users, setUsers] = useState<DashUser[]>([]);
    const [globalQueue, setGlobalQueue] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<DashUser | null>(null);
    const [profileTab, setProfileTab] = useState<ProfileTab>('chat');
    const [search, setSearch] = useState('');
    const [posts, setPosts] = useState<any[]>([]);
    const [dailyCode, setDailyCode] = useState('----');
    const [unreadMap, setUnreadMap] = useState<Record<string, string>>({});
    const [challenges, setChallenges] = useState<any[]>([]);
    const onlineJoinTimeRef = useRef<Record<string, number>>({});
    const prevOnlineStateRef = useRef<Record<string, boolean>>({});
    const pendingReadIdRef = useRef<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            const [data, unread] = await Promise.all([
                getAdminDashboardData(),
                getUnreadMessageStatus(),
            ]);
            setUnreadMap(unread);
            if (data.success && data.users) {
                const queue = data.globalQueue || [];
                setGlobalQueue(queue);
                const mapped: DashUser[] = data.users.map((u: any) => ({
                    memberId: u.memberId || u.member_id || '',
                    name: u.name || (u.memberId || '').split('@')[0] || 'Unknown',
                    avatar: u.avatar || u.avatar_url || '/queen-karin.png',
                    rank: u.rank || u.hierarchy || 'Hall Boy',
                    wallet: Number(u.wallet) || 0,
                    score: Number(u.score) || 0,
                    parameters: u.parameters || {},
                    reviewQueue: queue.filter((t: any) => t.member_id === u.memberId || t.ownerId === u.memberId),
                    lastMessageTime: u.parameters?.lastMessageTime || null,
                    lastSeen: u.lastSeen || u.last_active || u.lastWorship || null,
                    hasActiveTask: !!(u.parameters?.taskdom_active_task),
                }));
                setUsers(mapped);
            }
        } finally { setLoading(false); }
        const d = new Date();
        const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
        setDailyCode(String((seed * 7 + 1337) % 9000 + 1000));
    }, []);

    const loadPosts = useCallback(async () => {
        try {
            const supabase = createClient();
            const { data } = await supabase.from('queen_posts').select('*').order('created_at', { ascending: false }).limit(30);
            setPosts(data || []);
        } catch { setPosts([]); }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);
    useEffect(() => { const t = setInterval(loadData, 8000); return () => clearInterval(t); }, [loadData]);
    useEffect(() => { if (tab === 'posts') loadPosts(); }, [tab, loadPosts]);

    // Challenges
    useEffect(() => {
        fetch('/api/challenges')
            .then(r => r.json())
            .then(d => { if (d.success) setChallenges(d.challenges || []); })
            .catch(() => {});
        const t = setInterval(() => {
            fetch('/api/challenges').then(r => r.json()).then(d => { if (d.success) setChallenges(d.challenges || []); }).catch(() => {});
        }, 30000);
        return () => clearInterval(t);
    }, []);

    // Track online join times
    useEffect(() => {
        const now = Date.now();
        users.forEach(u => {
            const online = getOnlineStatus(u.lastSeen) === 'online';
            const wasOnline = prevOnlineStateRef.current[u.memberId] ?? false;
            if (online && !wasOnline) onlineJoinTimeRef.current[u.memberId] = now;
            if (!online) delete onlineJoinTimeRef.current[u.memberId];
            prevOnlineStateRef.current[u.memberId] = online;
        });
    }, [users]);

    // Migrate read keys
    useEffect(() => {
        if (typeof window === 'undefined' || !users.length) return;
        users.forEach(u => {
            const newKey = 'read_' + u.memberId;
            if (!localStorage.getItem(newKey)) {
                const oldVal = localStorage.getItem('chat_read_' + u.memberId);
                if (oldVal) { const ms = new Date(oldVal).getTime(); if (!isNaN(ms)) localStorage.setItem(newKey, ms.toString()); }
            }
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [users.length > 0]);

    const markPendingRead = useCallback(() => {
        const id = pendingReadIdRef.current;
        if (id) { localStorage.setItem('read_' + id, Date.now().toString()); pendingReadIdRef.current = null; }
    }, []);

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    const filtered = search
        ? users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.memberId.toLowerCase().includes(search.toLowerCase()))
        : users;

    const onlineCount = users.filter(u => getOnlineStatus(u.lastSeen) === 'online').length;
    const unreadCount = users.filter(u => {
        const lastSlaveMsg = unreadMap[u.memberId];
        if (!lastSlaveMsg) return false;
        const lastRead = typeof window !== 'undefined' ? localStorage.getItem('read_' + u.memberId) : null;
        return !lastRead || new Date(lastSlaveMsg).getTime() > parseInt(lastRead);
    }).length;
    const pendingTotal = globalQueue.length;
    const stats = {
        active: users.length,
        online: onlineCount,
        pending: pendingTotal,
        kneelMins: users.reduce((s, u) => s + (u.parameters?.totalKneelMinutes || 0), 0),
        totalMerit: users.reduce((s, u) => s + (u.score || 0), 0),
    };

    if (loading) return (
        <div style={S.loadWrap}>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <div style={S.spinner} /><p style={S.loadTxt}>LOADING SYSTEM...</p>
        </div>
    );

    return (
        <div style={S.root}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;500;700&display=swap');
                @keyframes spin{to{transform:rotate(360deg)}}
                @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
                * { box-sizing: border-box; }
                body { margin: 0; padding: 0; background: #030303; }
                input, textarea, select { font-size: 16px !important; }
                input::placeholder, textarea::placeholder { color: #444; }
                button:active { opacity: 0.75; }
                input, textarea { touch-action: manipulation; }
                ::-webkit-scrollbar { width: 0; height: 0; }
            `}</style>

            {/* TOP BAR */}
            <div style={S.topBar}>
                <span style={S.topBrand}>⚔ COMMAND CENTER</span>
                <span style={S.topCode}>{dailyCode}</span>
            </div>

            {/* CONTENT */}
            <div style={S.content}>
                {selectedUser ? (
                    <UserProfile
                        user={selectedUser}
                        profileTab={profileTab}
                        setProfileTab={setProfileTab}
                        onBack={() => { markPendingRead(); setSelectedUser(null); setProfileTab('chat'); }}
                        adminEmail={userEmail}
                        onReviewed={() => loadData()}
                        onUserUpdated={(updated) => {
                            setSelectedUser(updated);
                            setUsers(prev => prev.map(u => u.memberId === updated.memberId ? updated : u));
                        }}
                    />
                ) : tab === 'home' ? (
                    <HomeView users={users} globalQueue={globalQueue} dailyCode={dailyCode} challenges={challenges}
                        onSelectUser={(u) => { setSelectedUser(u); setProfileTab('tasks'); }}
                        onRefresh={loadData} />
                ) : tab === 'subjects' ? (
                    <SubjectsView
                        users={filtered} allCount={users.length}
                        search={search} setSearch={setSearch}
                        unreadMap={unreadMap} onlineJoinTime={onlineJoinTimeRef.current}
                        onSelect={(u) => {
                            markPendingRead();
                            const lastSlaveMsg = unreadMap[u.memberId];
                            if (lastSlaveMsg) {
                                const readTime = localStorage.getItem('read_' + u.memberId);
                                if (!readTime || new Date(lastSlaveMsg).getTime() > parseInt(readTime)) pendingReadIdRef.current = u.memberId;
                            }
                            setSelectedUser(u); setProfileTab('chat');
                        }}
                    />
                ) : tab === 'posts' ? (
                    <PostsView posts={posts} onPostCreated={loadPosts} userEmail={userEmail} />
                ) : (
                    <QueenView userEmail={userEmail} onLogout={handleLogout} users={users} stats={stats} />
                )}
            </div>

            {/* BOTTOM NAV */}
            {!selectedUser && (
                <nav style={S.nav}>
                    {([
                        { key: 'home' as Tab, icon: '⌂', label: 'HOME', badge: undefined as number | undefined, bc: '#ff8c42' },
                        { key: 'subjects' as Tab, icon: '◉', label: 'SUBS', badge: unreadCount > 0 ? unreadCount : (onlineCount > 0 ? onlineCount : undefined), bc: unreadCount > 0 ? '#4a9eff' : '#6bcb77' },
                        { key: 'posts' as Tab, icon: '✦', label: 'POSTS', badge: undefined as number | undefined, bc: '#c5a059' },
                        { key: 'queen' as Tab, icon: '♛', label: 'QUEEN', badge: undefined as number | undefined, bc: '#c5a059' },
                    ]).map(({ key, icon, label, badge, bc }) => (
                        <button key={key} style={{ ...S.navBtn, ...(tab === key ? S.navActive : {}) }} onClick={() => setTab(key)}>
                            <div style={{ position: 'relative' }}>
                                <span style={{ fontSize: '1.3rem', lineHeight: 1, color: tab === key ? '#c5a059' : '#2e2e2e' }}>{icon}</span>
                                {badge !== undefined && (
                                    <div style={{ position: 'absolute', top: -4, right: -8, minWidth: 14, height: 14, background: bc, borderRadius: 7, fontSize: '0.36rem', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Orbitron,monospace', fontWeight: 700, padding: '0 3px' }}>{badge}</div>
                                )}
                            </div>
                            <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.38rem', letterSpacing: '1.5px', color: tab === key ? '#c5a059' : '#2e2e2e', textTransform: 'uppercase' }}>{label}</span>
                        </button>
                    ))}
                </nav>
            )}
        </div>
    );
}

// ─── HOME VIEW ───────────────────────────────────────────────────────────────
function HomeView({ users, globalQueue, dailyCode, challenges, onSelectUser, onRefresh }: {
    users: DashUser[]; globalQueue: any[]; dailyCode: string; challenges: any[];
    onSelectUser: (u: DashUser) => void; onRefresh?: () => void;
}) {
    const [taskQueue, setTaskQueue] = useState<any[]>(globalQueue);
    const [reviewing, setReviewing] = useState<string | null>(null);
    const [rewardTask, setRewardTask] = useState<any | null>(null);

    useEffect(() => { setTaskQueue(globalQueue); }, [globalQueue]);

    const activeChallenge = challenges.find(c => c.status === 'active');
    const onlineUsers = users.filter(u => getOnlineStatus(u.lastSeen) === 'online');

    const getUserForTask = (task: any) => {
        const mid = (task.member_id || task.ownerId || '').toLowerCase();
        return users.find(u => u.memberId.toLowerCase() === mid);
    };

    const isRoutineTask = (task: any) => !!(task.isRoutine || task.category === 'Routine' || task.text === 'Daily Routine');

    const handleApprove = async (task: any, tier: number = 50, note: string = '') => {
        const taskId = task.id || task.taskId;
        const user = getUserForTask(task);
        if (!user) return;
        setReviewing(taskId);
        setRewardTask(null);
        try {
            await adminApproveTaskAction(taskId, user.memberId, tier, note || null);
            setTaskQueue(q => q.filter(t => (t.id || t.taskId) !== taskId));
            onRefresh?.();
        } catch (e) { console.error(e); }
        setReviewing(null);
    };

    const handleReject = async (task: any) => {
        const taskId = task.id || task.taskId;
        const user = getUserForTask(task);
        if (!user) return;
        setReviewing(taskId);
        try {
            await adminRejectTaskAction(taskId, user.memberId);
            setTaskQueue(q => q.filter(t => (t.id || t.taskId) !== taskId));
            onRefresh?.();
        } catch (e) { console.error(e); }
        setReviewing(null);
    };

    return (
        <div style={S.scroll}>
            {rewardTask && (
                <RewardModal
                    task={rewardTask}
                    onConfirm={(tier, note) => handleApprove(rewardTask, tier, note)}
                    onCancel={() => setRewardTask(null)}
                />
            )}

            {/* Online users strip */}
            {onlineUsers.length > 0 && (
                <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 2, flexShrink: 0, WebkitOverflowScrolling: 'touch' as any }}>
                    {onlineUsers.map(u => (
                        <button key={u.memberId} onClick={() => onSelectUser(u)}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: '2px 0', WebkitTapHighlightColor: 'transparent' }}>
                            <div style={{ position: 'relative' }}>
                                <img src={u.avatar} style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(107,203,119,0.5)', display: 'block' }} onError={(e) => { (e.target as any).src = '/queen-karin.png'; }} alt="" />
                                <div style={{ position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, background: '#6bcb77', borderRadius: '50%', border: '2px solid #030303', boxShadow: '0 0 5px #6bcb77' }} />
                            </div>
                            <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.32rem', color: '#6bcb77', letterSpacing: '0.5px', maxWidth: 46, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name.split(' ')[0]}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Daily code — compact */}
            <div style={{ background: 'rgba(197,160,89,0.03)', border: '1px solid rgba(197,160,89,0.12)', borderRadius: 10, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.36rem', color: '#333', letterSpacing: '2px' }}>TODAY'S CODE</span>
                <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '1.5rem', fontWeight: 900, color: '#c5a059', letterSpacing: '8px', textShadow: '0 0 18px rgba(197,160,89,0.2)' }}>{dailyCode}</span>
            </div>

            {/* Task review feed */}
            {taskQueue.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0 30px', fontFamily: 'Orbitron,monospace', fontSize: '0.48rem', color: '#1e1e1e', letterSpacing: '2.5px', flexShrink: 0 }}>
                    ✓ ALL CLEAR
                </div>
            ) : (
                <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, paddingLeft: 2 }}>
                        <span style={{ fontFamily: 'Cinzel,serif', fontSize: '0.62rem', color: '#ff8c42', letterSpacing: '3px' }}>PENDING REVIEW</span>
                        <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.52rem', fontWeight: 700, color: '#ff8c42', background: 'rgba(255,140,66,0.12)', border: '1px solid rgba(255,140,66,0.3)', borderRadius: 100, padding: '3px 12px' }}>{taskQueue.length}</span>
                    </div>

                    {taskQueue.map((task: any, i: number) => {
                        const taskId = task.id || task.taskId;
                        const user = getUserForTask(task);
                        const routine = isRoutineTask(task);
                        const busy = reviewing === taskId;
                        return (
                            <div key={i} style={{ background: '#090909', border: `1px solid ${routine ? 'rgba(197,160,89,0.18)' : 'rgba(255,140,66,0.22)'}`, borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}>
                                {/* Subject row — tappable → their profile */}
                                <button onClick={() => user && onSelectUser(user)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', width: '100%', background: 'rgba(255,255,255,0.02)', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
                                    {user && (
                                        <img src={user.avatar} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${rc(user.rank)}44`, flexShrink: 0 }} onError={(e) => { (e.target as any).src = '/queen-karin.png'; }} alt="" />
                                    )}
                                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                                        <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.82rem', color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name || (task.member_id || '').split('@')[0] || 'Unknown'}</div>
                                        {user && <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.33rem', color: rc(user.rank), letterSpacing: '1px', marginTop: 1 }}>{user.rank}</div>}
                                    </div>
                                    {routine && <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.35rem', color: '#c5a059', background: 'rgba(197,160,89,0.1)', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(197,160,89,0.28)', flexShrink: 0 }}>ROUTINE</span>}
                                    <span style={{ color: '#2a2a2a', fontSize: '1.1rem', flexShrink: 0 }}>›</span>
                                </button>

                                {/* Task content */}
                                <div style={{ padding: '12px 14px 14px' }}>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                                        {task.proof_url && (
                                            <img src={task.proof_url}
                                                style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, flexShrink: 0, border: '1px solid #1a1a1a', cursor: 'pointer' }}
                                                onClick={() => window.open(task.proof_url, '_blank')}
                                                alt="" />
                                        )}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.88rem', color: '#fff', lineHeight: 1.4, marginBottom: 5 }}>{task.taskName || task.task_name || task.text || 'Task'}</div>
                                            {task.notes && <div style={{ fontSize: '0.76rem', color: '#555', lineHeight: 1.5, marginBottom: 4 }}>{task.notes}</div>}
                                            {task.submitted_at && <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.33rem', color: '#333', letterSpacing: '1px' }}>{timeAgo(task.submitted_at)}</div>}
                                        </div>
                                    </div>

                                    {/* Action buttons */}
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        {routine ? (
                                            <>
                                                <button disabled={busy} onClick={() => handleApprove(task, 50)}
                                                    style={{ flex: 1, padding: '12px 0', background: busy ? '#111' : 'linear-gradient(135deg,#c5a059,#8b6914)', color: '#000', border: 'none', borderRadius: 8, fontFamily: 'Orbitron,monospace', fontSize: '0.46rem', fontWeight: 700, letterSpacing: '1px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1 }}>
                                                    {busy ? '...' : '✓ DONE — 50 PTS'}
                                                </button>
                                                <button disabled={busy} onClick={() => handleReject(task)}
                                                    style={{ flex: 1, padding: '12px 0', background: 'rgba(255,51,51,0.07)', color: '#ff5555', border: '1px solid rgba(255,51,51,0.2)', borderRadius: 8, fontFamily: 'Orbitron,monospace', fontSize: '0.46rem', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1 }}>
                                                    {busy ? '...' : '✕ REJECT'}
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button disabled={busy} onClick={() => setRewardTask(task)}
                                                    style={{ flex: 2, padding: '12px 0', background: busy ? '#111' : 'rgba(197,160,89,0.1)', color: '#c5a059', border: '1px solid rgba(197,160,89,0.3)', borderRadius: 8, fontFamily: 'Orbitron,monospace', fontSize: '0.46rem', fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1 }}>
                                                    {busy ? '...' : '✓ APPROVE + REWARD'}
                                                </button>
                                                <button disabled={busy} onClick={() => handleReject(task)}
                                                    style={{ flex: 1, padding: '12px 0', background: 'rgba(255,51,51,0.07)', color: '#ff5555', border: '1px solid rgba(255,51,51,0.2)', borderRadius: 8, fontFamily: 'Orbitron,monospace', fontSize: '0.46rem', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1 }}>
                                                    {busy ? '...' : '✕'}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </>
            )}

            {/* Challenge widget */}
            <button onClick={() => window.location.href = '/dashboard/challenges'}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: activeChallenge ? 'rgba(197,160,89,0.06)' : 'rgba(197,160,89,0.03)', border: `1px solid ${activeChallenge ? 'rgba(197,160,89,0.35)' : 'rgba(197,160,89,0.1)'}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', flexShrink: 0, width: '100%', textAlign: 'left', WebkitTapHighlightColor: 'transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {activeChallenge?.image_url
                        ? <img src={activeChallenge.image_url} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} alt="" />
                        : <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(197,160,89,0.1)', color: '#c5a059', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>⚔</div>
                    }
                    <div>
                        <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.8rem', color: '#c5a059', letterSpacing: '2px' }}>CHALLENGES</div>
                        <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.36rem', color: '#444', letterSpacing: '1px', marginTop: 2 }}>
                            {activeChallenge ? `LIVE: ${activeChallenge.name}` : 'CREATE · MANAGE · VERIFY'}
                        </div>
                    </div>
                </div>
                <span style={{ color: '#c5a059', fontSize: '1.2rem', opacity: 0.4 }}>›</span>
            </button>
        </div>
    );
}

// ─── SUBJECTS VIEW ───────────────────────────────────────────────────────────
function hasUnread(memberId: string, unreadMap: Record<string, string>): boolean {
    const lastSlaveMsg = unreadMap[memberId];
    if (!lastSlaveMsg) return false;
    const readTime = typeof window !== 'undefined' ? localStorage.getItem('read_' + memberId) : null;
    if (!readTime) return true;
    return new Date(lastSlaveMsg).getTime() > parseInt(readTime);
}

function SubjectsView({ users, allCount, search, setSearch, unreadMap, onSelect, onlineJoinTime }: {
    users: DashUser[]; allCount: number; search: string; setSearch: (s: string) => void;
    unreadMap: Record<string, string>; onSelect: (u: DashUser) => void;
    onlineJoinTime: Record<string, number>;
}) {
    const now = Date.now();
    const getLastSeenMs = (u: DashUser) => { const t = new Date(u.lastSeen || '').getTime(); return isNaN(t) ? 0 : t; };

    const withUnread = [...users].filter(u => hasUnread(u.memberId, unreadMap))
        .sort((a, b) => (new Date(unreadMap[a.memberId] || '').getTime()) - (new Date(unreadMap[b.memberId] || '').getTime()));
    const unreadIds = new Set(withUnread.map(u => u.memberId));
    const onlineNoUnread = [...users].filter(u => getOnlineStatus(u.lastSeen) === 'online' && !unreadIds.has(u.memberId))
        .sort((a, b) => (onlineJoinTime[a.memberId] || now) - (onlineJoinTime[b.memberId] || now));
    const offlineNoUnread = [...users].filter(u => getOnlineStatus(u.lastSeen) !== 'online' && !unreadIds.has(u.memberId))
        .sort((a, b) => getLastSeenMs(b) - getLastSeenMs(a));
    const sorted = [...withUnread, ...onlineNoUnread, ...offlineNoUnread];

    return (
        <div style={S.scroll}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(15,15,15,0.9)', border: '1px solid rgba(197,160,89,0.12)', borderRadius: 10, padding: '10px 14px', flexShrink: 0 }}>
                <span style={{ fontSize: '1rem', flexShrink: 0 }}>🔍</span>
                <input type="text" placeholder="Search subjects..." value={search} onChange={e => setSearch(e.target.value)}
                    style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontFamily: 'Rajdhani,sans-serif', fontSize: '0.95rem', letterSpacing: '1px' }} />
                {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: '#555', fontSize: '0.9rem', cursor: 'pointer', padding: 0, flexShrink: 0 }}>✕</button>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 2, flexShrink: 0 }}>
                <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.38rem', color: '#333', letterSpacing: '2px' }}>{sorted.length} OF {allCount} SUBJECTS</span>
                {sorted.filter(u => getOnlineStatus(u.lastSeen) === 'online').length > 0 && (
                    <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.38rem', color: '#6bcb77', letterSpacing: '2px' }}>
                        ● {sorted.filter(u => getOnlineStatus(u.lastSeen) === 'online').length} ONLINE
                    </span>
                )}
            </div>
            {sorted.map(u => {
                const status = getOnlineStatus(u.lastSeen);
                const dotC = statusColor(status);
                const unread = hasUnread(u.memberId, unreadMap);
                return (
                    <button key={u.memberId} onClick={() => onSelect(u)}
                        style={{ ...S.userCard, ...(unread ? { border: '1px solid rgba(74,158,255,0.3)', background: 'rgba(74,158,255,0.04)' } : {}) }}>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                            <img src={u.avatar} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${unread ? '#4a9eff' : rc(u.rank) + '44'}`, display: 'block' }} onError={(e) => { (e.target as any).src = '/queen-karin.png'; }} alt="" />
                            <div style={{ position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, background: dotC, borderRadius: '50%', border: '2px solid #030303', boxShadow: status === 'online' ? `0 0 6px ${dotC}` : 'none' }} />
                            {u.reviewQueue.length > 0 && (
                                <div style={{ position: 'absolute', top: -3, right: -3, width: 17, height: 17, background: '#ff4444', borderRadius: '50%', fontSize: '0.42rem', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Orbitron,monospace', fontWeight: 700, border: '1.5px solid #030303' }}>{u.reviewQueue.length}</div>
                            )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                            <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.9rem', color: unread ? '#fff' : '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: unread ? 700 : 400, marginBottom: 5 }}>{u.name}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.36rem', letterSpacing: '1px', padding: '2px 8px', borderRadius: 100, background: rc(u.rank) + '22', color: rc(u.rank), border: `1px solid ${rc(u.rank)}44` }}>{u.rank}</span>
                                {status === 'online' && <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.34rem', color: dotC }}>● ONLINE</span>}
                                {status === 'online' && u.hasActiveTask && <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.34rem', color: '#ff8c42' }}>WORKING</span>}
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ opacity: unread ? 1 : 0.12 }}>
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill={unread ? '#4a9eff' : '#333'} />
                                {unread && <circle cx="19" cy="5" r="4" fill="#ff4444" />}
                            </svg>
                            {u.reviewQueue.length > 0 && <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.4rem', color: '#ff8c42' }}>📋 {u.reviewQueue.length}</span>}
                        </div>
                        <div style={{ color: '#222', fontSize: '1.4rem', lineHeight: 1, flexShrink: 0, marginLeft: 4 }}>›</div>
                    </button>
                );
            })}
        </div>
    );
}

// ─── REWARD MODAL ─────────────────────────────────────────────────────────────
function RewardModal({ task, onConfirm, onCancel }: {
    task: any; onConfirm: (tier: number, note: string) => void; onCancel: () => void;
}) {
    const [tier, setTier] = useState(50);
    const [note, setNote] = useState('');
    const tiers = [25, 50, 75, 100, 150];
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9000, display: 'flex', alignItems: 'flex-end', padding: '0 0 0 0' }}>
            <div style={{ width: '100%', background: '#0a0a0a', border: '1px solid rgba(197,160,89,0.2)', borderRadius: '18px 18px 0 0', padding: '24px 18px 32px', maxHeight: '85vh', overflowY: 'auto' }}>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.7rem', color: '#c5a059', letterSpacing: '4px', marginBottom: 16 }}>REWARD PROTOCOL</div>
                <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.9rem', color: '#888', marginBottom: 18, lineHeight: 1.4 }}>
                    {task.taskName || task.task_name || task.text || 'Task'}
                </div>
                <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.44rem', color: '#555', letterSpacing: '2px', marginBottom: 10 }}>MERIT REWARD</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                    {tiers.map(t => (
                        <button key={t} onClick={() => setTier(t)}
                            style={{ flex: 1, minWidth: 48, padding: '12px 0', background: tier === t ? '#c5a059' : 'rgba(197,160,89,0.06)', border: `1px solid ${tier === t ? '#c5a059' : 'rgba(197,160,89,0.2)'}`, borderRadius: 8, color: tier === t ? '#000' : '#c5a059', fontFamily: 'Orbitron,monospace', fontSize: '0.7rem', fontWeight: tier === t ? 700 : 400, cursor: 'pointer' }}>
                            {t}
                        </button>
                    ))}
                </div>
                <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.44rem', color: '#555', letterSpacing: '2px', marginBottom: 8 }}>NOTE (OPTIONAL)</div>
                <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Leave a comment for the slave..." rows={3}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(197,160,89,0.1)', borderRadius: 8, color: '#fff', fontFamily: 'Rajdhani,sans-serif', padding: '10px 12px', resize: 'none', outline: 'none', marginBottom: 16, lineHeight: 1.5 }} />
                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={onCancel} style={{ flex: 1, padding: '13px', background: 'rgba(255,255,255,0.04)', border: '1px solid #222', borderRadius: 8, color: '#666', fontFamily: 'Orbitron,monospace', fontSize: '0.5rem', cursor: 'pointer' }}>CANCEL</button>
                    <button onClick={() => onConfirm(tier, note)} style={{ flex: 2, padding: '13px', background: 'linear-gradient(135deg,#c5a059,#8b6914)', border: 'none', borderRadius: 8, color: '#000', fontFamily: 'Orbitron,monospace', fontSize: '0.52rem', fontWeight: 700, letterSpacing: '1.5px', cursor: 'pointer' }}>APPROVE +{tier} PTS</button>
                </div>
            </div>
        </div>
    );
}

// ─── USER PROFILE ─────────────────────────────────────────────────────────────
function UserProfile({ user, profileTab, setProfileTab, onBack, adminEmail, onReviewed, onUserUpdated }: {
    user: DashUser; profileTab: ProfileTab; setProfileTab: (t: ProfileTab) => void;
    onBack: () => void; adminEmail: string | null; onReviewed?: () => void;
    onUserUpdated?: (u: DashUser) => void;
}) {
    const color = rc(user.rank);
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const [reviewing, setReviewing] = useState<string | null>(null);
    const [queue, setQueue] = useState<any[]>(user.reviewQueue);
    const [rewardTask, setRewardTask] = useState<any | null>(null);

    const isRoutine = (task: any) => !!(task.isRoutine || task.category === 'Routine' || task.text === 'Daily Routine');

    const handleApprove = async (task: any, tier: number = 50, note: string = '') => {
        const taskId = task.id || task.taskId;
        setReviewing(taskId);
        setRewardTask(null);
        try {
            await adminApproveTaskAction(taskId, user.memberId, tier, note || null);
            setQueue(q => q.filter(t => (t.id || t.taskId) !== taskId));
            onReviewed?.();
        } catch (e) { console.error(e); }
        setReviewing(null);
    };

    const handleReject = async (task: any) => {
        const taskId = task.id || task.taskId;
        setReviewing(taskId);
        try {
            await adminRejectTaskAction(taskId, user.memberId);
            setQueue(q => q.filter(t => (t.id || t.taskId) !== taskId));
            onReviewed?.();
        } catch (e) { console.error(e); }
        setReviewing(null);
    };

    const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; touchStartY.current = e.touches[0].clientY; };
    const handleTouchEnd = (e: React.TouchEvent) => {
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
        if (dx > 80 && dy < 60) onBack();
    };

    const tabs: { key: ProfileTab; label: string; badge?: number }[] = [
        { key: 'chat', label: 'CHAT' },
        { key: 'tasks', label: 'TASKS', badge: queue.length || undefined },
        { key: 'info', label: 'PROFILE' },
        { key: 'controls', label: 'CONTROLS' },
    ];

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#040404' }}
            onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>

            {/* Reward modal overlay */}
            {rewardTask && (
                <RewardModal
                    task={rewardTask}
                    onConfirm={(tier, note) => handleApprove(rewardTask, tier, note)}
                    onCancel={() => setRewardTask(null)}
                />
            )}

            {/* Header */}
            <div style={{ padding: '12px 14px 16px', background: 'rgba(6,6,6,0.97)', borderBottom: `1px solid ${color}33`, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <button onClick={onBack} style={S.backBtn}>← BACK</button>
                <img src={user.avatar} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${color}55`, marginBottom: 8 }} onError={(e) => { (e.target as any).src = '/queen-karin.png'; }} alt="" />
                <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.48rem', letterSpacing: '2px', padding: '2px 12px', borderRadius: 100, background: color + '22', color, border: `1px solid ${color}44`, marginBottom: 6 }}>{user.rank}</span>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '1.2rem', color: '#fff', letterSpacing: '2px', textAlign: 'center' }}>{user.name}</div>
                {/* Stats row */}
                <div style={{ display: 'flex', width: '100%', marginTop: 12, background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.1)', borderRadius: 10, padding: '8px 0' }}>
                    {[
                        { label: 'MERIT', val: user.score, c: '#c5a059' },
                        { label: 'COINS', val: user.wallet.toLocaleString(), c: '#4ecdc4' },
                        { label: 'PENDING', val: queue.length, c: queue.length > 0 ? '#ff8c42' : '#555' },
                    ].map((s, i) => (
                        <div key={s.label} style={{ flex: 1, textAlign: 'center', borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                            <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '1.1rem', fontWeight: 700, color: s.c }}>{s.val}</div>
                            <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.34rem', color: '#444', letterSpacing: '1.5px', marginTop: 2 }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(197,160,89,0.1)', background: 'rgba(6,6,6,0.97)', flexShrink: 0, overflowX: 'auto' }}>
                {tabs.map(t => (
                    <button key={t.key} onClick={() => setProfileTab(t.key)} style={{ flex: 1, minWidth: 70, padding: '11px 4px', background: 'none', border: 'none', borderBottom: profileTab === t.key ? '2px solid #c5a059' : '2px solid transparent', color: profileTab === t.key ? '#c5a059' : '#444', fontFamily: 'Orbitron,monospace', fontSize: '0.46rem', letterSpacing: '1.5px', cursor: 'pointer', position: 'relative', WebkitTapHighlightColor: 'transparent' }}>
                        {t.label}
                        {t.badge ? <span style={{ position: 'absolute', top: 6, right: 4, background: '#ff4444', color: '#fff', borderRadius: 100, minWidth: 14, height: 14, fontSize: '0.36rem', fontFamily: 'Orbitron,monospace', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>{t.badge}</span> : null}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            {profileTab === 'chat' ? (
                <ChatView key={user.memberId} user={user} adminEmail={adminEmail} />
            ) : profileTab === 'controls' ? (
                <ControlsView user={user} onUserUpdated={onUserUpdated} />
            ) : (
                <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: 12, WebkitOverflowScrolling: 'touch' as any }}>
                    {profileTab === 'info' && (
                        <>
                            {/* Devotion */}
                            <div style={S.card}>
                                <div style={S.cardTitle}>DEVOTION PROGRESS</div>
                                {(() => {
                                    const devotion = user.parameters?.devotion || 0;
                                    const devPct = Math.min(100, (devotion / 1000) * 100);
                                    return <>
                                        <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 100, overflow: 'hidden', marginBottom: 6 }}>
                                            <div style={{ height: '100%', width: `${devPct}%`, background: color, borderRadius: 100 }} />
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.44rem', color: '#444' }}>{devotion} / 1000</span>
                                            <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.44rem', color }}>{devPct.toFixed(0)}%</span>
                                        </div>
                                    </>;
                                })()}
                            </div>

                            {/* Intel */}
                            <div style={S.card}>
                                <div style={S.cardTitle}>INTEL</div>
                                {[
                                    { label: 'EMAIL', val: user.memberId },
                                    { label: 'RANK', val: user.rank, c: color },
                                    { label: 'MERIT', val: String(user.score) },
                                    { label: 'CAPITAL', val: user.wallet.toLocaleString() + ' ₡' },
                                    { label: 'KNEEL MIN', val: String(user.parameters?.totalKneelMinutes || 0) },
                                    { label: 'SESSIONS', val: String(user.parameters?.kneelCount || 0) },
                                ].map((row, i) => (
                                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                                        <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.44rem', color: '#444', letterSpacing: '1.5px' }}>{row.label}</span>
                                        <span style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.82rem', color: (row as any).c || '#aaa', maxWidth: '58%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{row.val}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Kinks & limits */}
                            {(user.parameters?.kinks || user.parameters?.limits) && (
                                <div style={S.card}>
                                    <div style={S.cardTitle}>KINKS & LIMITS</div>
                                    {user.parameters?.kinks && (
                                        <div style={{ marginBottom: 10 }}>
                                            <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.4rem', color: '#c5a059', letterSpacing: '2px', marginBottom: 6 }}>KINKS</div>
                                            <div style={{ fontSize: '0.82rem', color: '#888', lineHeight: 1.6 }}>{user.parameters.kinks}</div>
                                        </div>
                                    )}
                                    {user.parameters?.limits && (
                                        <div>
                                            <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.4rem', color: '#ff8c42', letterSpacing: '2px', marginBottom: 6 }}>LIMITS</div>
                                            <div style={{ fontSize: '0.82rem', color: '#888', lineHeight: 1.6 }}>{user.parameters.limits}</div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Routine */}
                            {user.parameters?.routine && (
                                <div style={S.card}>
                                    <div style={S.cardTitle}>ASSIGNED ROUTINE</div>
                                    <div style={{ fontSize: '0.82rem', color: '#888', lineHeight: 1.6 }}>{user.parameters.routine}</div>
                                </div>
                            )}
                        </>
                    )}

                    {profileTab === 'tasks' && (
                        <>
                            {queue.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '50px 0', fontFamily: 'Orbitron,monospace', fontSize: '0.5rem', color: '#2a2a2a', letterSpacing: '2px' }}>NO PENDING TASKS</div>
                            ) : queue.map((task: any, i: number) => {
                                const taskId = task.id || task.taskId;
                                const routine = isRoutine(task);
                                const busy = reviewing === taskId;
                                return (
                                    <div key={i} style={{ background: 'rgba(12,12,12,0.9)', border: `1px solid ${routine ? 'rgba(197,160,89,0.2)' : 'rgba(255,140,66,0.15)'}`, borderRadius: 10, padding: '14px' }}>
                                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                                            {task.proof_url && <img src={task.proof_url} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, flexShrink: 0, border: '1px solid #222' }} alt="" />}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.85rem', color: '#fff', marginBottom: 5, lineHeight: 1.3 }}>{task.taskName || task.task_name || task.text || 'Task'}</div>
                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                                    {routine && <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.38rem', color: '#c5a059', background: 'rgba(197,160,89,0.1)', padding: '2px 7px', borderRadius: 20, border: '1px solid rgba(197,160,89,0.3)' }}>ROUTINE</span>}
                                                    {task.submitted_at && <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.38rem', color: '#444' }}>{new Date(task.submitted_at).toLocaleDateString()}</span>}
                                                </div>
                                                {task.notes && <div style={{ fontSize: '0.76rem', color: '#666', marginTop: 6, lineHeight: 1.5 }}>{task.notes}</div>}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            {routine ? (
                                                <>
                                                    <button disabled={busy} onClick={() => handleApprove(task, 50)}
                                                        style={{ flex: 1, padding: '11px 0', background: busy ? '#111' : 'linear-gradient(135deg,#c5a059,#8b6914)', color: '#000', border: 'none', borderRadius: 8, fontFamily: 'Orbitron,monospace', fontSize: '0.48rem', fontWeight: 700, letterSpacing: '1px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1 }}>
                                                        {busy ? '...' : '✓ YES — 50 PTS'}
                                                    </button>
                                                    <button disabled={busy} onClick={() => handleReject(task)}
                                                        style={{ flex: 1, padding: '11px 0', background: 'rgba(255,51,51,0.07)', color: '#ff4444', border: '1px solid rgba(255,51,51,0.2)', borderRadius: 8, fontFamily: 'Orbitron,monospace', fontSize: '0.48rem', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1 }}>
                                                        {busy ? '...' : '✕ NO'}
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button disabled={busy} onClick={() => setRewardTask(task)}
                                                        style={{ flex: 2, padding: '11px 0', background: busy ? '#111' : 'rgba(197,160,89,0.1)', color: '#c5a059', border: '1px solid rgba(197,160,89,0.3)', borderRadius: 8, fontFamily: 'Orbitron,monospace', fontSize: '0.48rem', fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1 }}>
                                                        {busy ? '...' : '✓ APPROVE'}
                                                    </button>
                                                    <button disabled={busy} onClick={() => handleReject(task)}
                                                        style={{ flex: 1, padding: '11px 0', background: 'rgba(255,51,51,0.07)', color: '#ff4444', border: '1px solid rgba(255,51,51,0.2)', borderRadius: 8, fontFamily: 'Orbitron,monospace', fontSize: '0.48rem', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1 }}>
                                                        {busy ? '...' : '✕ REJECT'}
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── CONTROLS VIEW ────────────────────────────────────────────────────────────
function ControlsView({ user, onUserUpdated }: { user: DashUser; onUserUpdated?: (u: DashUser) => void }) {
    const [status, setStatus] = useState('');
    const [busy, setBusy] = useState(false);

    // Lock states from parameters
    const paywallActive = !!(user.parameters?.paywall?.active);
    const silenceActive = !!(user.parameters?.silence?.active);

    // Wallet
    const [walletAmt, setWalletAmt] = useState('100');
    // Merit
    const [meritAmt, setMeritAmt] = useState('50');
    // Rank
    const [newRank, setNewRank] = useState(user.rank);
    // Issue task
    const [taskText, setTaskText] = useState('');
    // Lock reason
    const [lockReason, setLockReason] = useState('');
    const [paywallAmt, setPaywallAmt] = useState('500');

    const flash = (msg: string) => { setStatus(msg); setTimeout(() => setStatus(''), 3500); };

    const adjustWallet = async (dir: 1 | -1) => {
        const amount = parseInt(walletAmt) || 100;
        setBusy(true);
        try {
            const res = await processCoinTransaction(user.memberId, dir * amount, 'Admin Adjustment');
            if (res.success) {
                flash(`✓ Wallet ${dir > 0 ? '+' : '-'}${amount} → ${res.newBalance} ₡`);
                onUserUpdated?.({ ...user, wallet: res.newBalance });
            } else { flash('✕ ' + (res.error || 'Failed')); }
        } catch (e: any) { flash('✕ ' + e.message); }
        setBusy(false);
    };

    const adjustMerit = async (dir: 1 | -1) => {
        const amount = parseInt(meritAmt) || 50;
        setBusy(true);
        try {
            await updateScoreAction(user.memberId, dir * amount);
            const newScore = Math.max(0, user.score + dir * amount);
            flash(`✓ Merit ${dir > 0 ? '+' : '-'}${amount} → ${newScore}`);
            onUserUpdated?.({ ...user, score: newScore });
        } catch (e: any) { flash('✕ ' + e.message); }
        setBusy(false);
    };

    const changeRank = async () => {
        if (newRank === user.rank) { flash('Already at this rank'); return; }
        setBusy(true);
        try {
            await setHierarchyAction(user.memberId, newRank);
            flash(`✓ Rank → ${newRank}`);
            onUserUpdated?.({ ...user, rank: newRank });
        } catch (e: any) { flash('✕ ' + e.message); }
        setBusy(false);
    };

    const promoteNext = async () => {
        setBusy(true);
        try {
            const res = await fetch('/api/promote', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memberEmail: user.memberId }),
            });
            const d = await res.json();
            if (d.success || d.newRank) {
                flash(`✓ Promoted to ${d.newRank || 'next rank'}`);
                if (d.newRank) onUserUpdated?.({ ...user, rank: d.newRank });
            } else { flash('✕ ' + (d.error || 'Failed')); }
        } catch (e: any) { flash('✕ ' + e.message); }
        setBusy(false);
    };

    const issueTask = async () => {
        if (!taskText.trim()) return;
        setBusy(true);
        try {
            await adminAssignTaskAction(user.memberId, taskText.trim());
            flash('✓ Task issued');
            setTaskText('');
        } catch (e: any) { flash('✕ ' + e.message); }
        setBusy(false);
    };

    const togglePaywall = async () => {
        setBusy(true);
        try {
            if (paywallActive) {
                const res = await fetch('/api/paywall/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId: user.memberId }) });
                const d = await res.json();
                if (d.success) { flash('✓ Paywall removed'); onUserUpdated?.({ ...user, parameters: { ...user.parameters, paywall: { active: false } } }); }
                else flash('✕ ' + (d.error || 'Failed'));
            } else {
                if (!lockReason.trim()) { flash('Enter a reason first'); setBusy(false); return; }
                const res = await fetch('/api/paywall/lock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId: user.memberId, reason: lockReason, amount: parseInt(paywallAmt) || 500 }) });
                const d = await res.json();
                if (d.success) { flash('✓ Paywall set'); onUserUpdated?.({ ...user, parameters: { ...user.parameters, paywall: { active: true, reason: lockReason, amount: parseInt(paywallAmt) } } }); setLockReason(''); }
                else flash('✕ ' + (d.error || 'Failed'));
            }
        } catch (e: any) { flash('✕ ' + e.message); }
        setBusy(false);
    };

    const toggleSilence = async () => {
        setBusy(true);
        try {
            if (silenceActive) {
                const res = await fetch('/api/silence/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId: user.memberId }) });
                const d = await res.json();
                if (d.success) { flash('✓ Silence lifted'); onUserUpdated?.({ ...user, parameters: { ...user.parameters, silence: { active: false } } }); }
                else flash('✕ ' + (d.error || 'Failed'));
            } else {
                if (!lockReason.trim()) { flash('Enter a reason first'); setBusy(false); return; }
                const res = await fetch('/api/silence/lock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId: user.memberId, reason: lockReason }) });
                const d = await res.json();
                if (d.success) { flash('✓ Silenced'); onUserUpdated?.({ ...user, parameters: { ...user.parameters, silence: { active: true, reason: lockReason } } }); setLockReason(''); }
                else flash('✕ ' + (d.error || 'Failed'));
            }
        } catch (e: any) { flash('✕ ' + e.message); }
        setBusy(false);
    };

    const inp: React.CSSProperties = { width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(197,160,89,0.12)', borderRadius: 8, color: '#fff', fontFamily: 'Rajdhani,sans-serif', padding: '10px 12px', outline: 'none' };
    const smInp: React.CSSProperties = { ...inp, width: '90px', textAlign: 'center', padding: '10px 8px' };
    const actionBtn = (active: boolean): React.CSSProperties => ({ flex: 1, padding: '12px 0', background: active ? 'rgba(255,51,51,0.12)' : 'rgba(197,160,89,0.08)', border: `1px solid ${active ? 'rgba(255,51,51,0.4)' : 'rgba(197,160,89,0.2)'}`, borderRadius: 8, color: active ? '#ff6666' : '#c5a059', fontFamily: 'Orbitron,monospace', fontSize: '0.5rem', fontWeight: 700, letterSpacing: '1px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1 });

    return (
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: 14, WebkitOverflowScrolling: 'touch' as any }}>
            {/* Status flash */}
            {status && (
                <div style={{ background: status.startsWith('✓') ? 'rgba(107,203,119,0.12)' : 'rgba(255,51,51,0.12)', border: `1px solid ${status.startsWith('✓') ? 'rgba(107,203,119,0.3)' : 'rgba(255,51,51,0.3)'}`, borderRadius: 8, padding: '12px 14px', fontFamily: 'Orbitron,monospace', fontSize: '0.5rem', color: status.startsWith('✓') ? '#6bcb77' : '#ff6666', letterSpacing: '1px', textAlign: 'center' }}>
                    {status}
                </div>
            )}

            {/* Lock status pills */}
            <div style={{ display: 'flex', gap: 8 }}>
                {paywallActive && <div style={{ flex: 1, textAlign: 'center', padding: '8px', background: 'rgba(255,51,51,0.1)', border: '1px solid rgba(255,51,51,0.3)', borderRadius: 8, fontFamily: 'Orbitron,monospace', fontSize: '0.4rem', color: '#ff6666', letterSpacing: '1px' }}>🔒 PAYWALL ACTIVE<br /><span style={{ fontSize: '0.35rem', color: '#ff8888', marginTop: 3, display: 'block' }}>{user.parameters?.paywall?.reason}</span></div>}
                {silenceActive && <div style={{ flex: 1, textAlign: 'center', padding: '8px', background: 'rgba(255,140,66,0.1)', border: '1px solid rgba(255,140,66,0.3)', borderRadius: 8, fontFamily: 'Orbitron,monospace', fontSize: '0.4rem', color: '#ff8c42', letterSpacing: '1px' }}>🔇 SILENCED<br /><span style={{ fontSize: '0.35rem', color: '#ffaa66', marginTop: 3, display: 'block' }}>{user.parameters?.silence?.reason}</span></div>}
            </div>

            {/* Lock/Silence */}
            <div style={S.card}>
                <div style={S.cardTitle}>LOCK CONTROLS</div>
                {(!paywallActive || !silenceActive) && (
                    <>
                        <input style={inp} placeholder="Reason..." value={lockReason} onChange={e => setLockReason(e.target.value)} />
                        {!paywallActive && (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                                <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.4rem', color: '#555', letterSpacing: '1px', flexShrink: 0 }}>AMOUNT ₡</span>
                                <input style={{ ...smInp, flex: 1 }} value={paywallAmt} onChange={e => setPaywallAmt(e.target.value)} placeholder="500" />
                            </div>
                        )}
                    </>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button disabled={busy} onClick={togglePaywall} style={actionBtn(paywallActive)}>
                        {paywallActive ? '🔓 UNLOCK PAYWALL' : '🔒 PAYWALL'}
                    </button>
                    <button disabled={busy} onClick={toggleSilence} style={actionBtn(silenceActive)}>
                        {silenceActive ? '🔊 UNSILENCE' : '🔇 SILENCE'}
                    </button>
                </div>
            </div>

            {/* Wallet */}
            <div style={S.card}>
                <div style={S.cardTitle}>WALLET — {user.wallet.toLocaleString()} ₡</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input style={{ ...smInp, flex: 1 }} value={walletAmt} onChange={e => setWalletAmt(e.target.value)} placeholder="100" />
                    <button disabled={busy} onClick={() => adjustWallet(1)}
                        style={{ flex: 1, padding: '11px', background: 'rgba(107,203,119,0.1)', border: '1px solid rgba(107,203,119,0.25)', borderRadius: 8, color: '#6bcb77', fontFamily: 'Orbitron,monospace', fontSize: '0.52rem', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1 }}>
                        + ADD
                    </button>
                    <button disabled={busy} onClick={() => adjustWallet(-1)}
                        style={{ flex: 1, padding: '11px', background: 'rgba(255,51,51,0.07)', border: '1px solid rgba(255,51,51,0.2)', borderRadius: 8, color: '#ff6666', fontFamily: 'Orbitron,monospace', fontSize: '0.52rem', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1 }}>
                        − TAKE
                    </button>
                </div>
            </div>

            {/* Merit */}
            <div style={S.card}>
                <div style={S.cardTitle}>MERIT — {user.score}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input style={{ ...smInp, flex: 1 }} value={meritAmt} onChange={e => setMeritAmt(e.target.value)} placeholder="50" />
                    <button disabled={busy} onClick={() => adjustMerit(1)}
                        style={{ flex: 1, padding: '11px', background: 'rgba(197,160,89,0.1)', border: '1px solid rgba(197,160,89,0.25)', borderRadius: 8, color: '#c5a059', fontFamily: 'Orbitron,monospace', fontSize: '0.52rem', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1 }}>
                        + ADD
                    </button>
                    <button disabled={busy} onClick={() => adjustMerit(-1)}
                        style={{ flex: 1, padding: '11px', background: 'rgba(255,51,51,0.07)', border: '1px solid rgba(255,51,51,0.2)', borderRadius: 8, color: '#ff6666', fontFamily: 'Orbitron,monospace', fontSize: '0.52rem', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1 }}>
                        − TAKE
                    </button>
                </div>
            </div>

            {/* Rank */}
            <div style={S.card}>
                <div style={S.cardTitle}>RANK — {user.rank}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <select value={newRank} onChange={e => setNewRank(e.target.value)}
                        style={{ flex: 1, background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 8, color: '#c5a059', fontFamily: 'Orbitron,monospace', fontSize: '0.5rem', padding: '11px 10px', outline: 'none', cursor: 'pointer' }}>
                        {RANKS.map(r => <option key={r} value={r} style={{ background: '#111', color: '#c5a059' }}>{r}</option>)}
                    </select>
                    <button disabled={busy} onClick={changeRank}
                        style={{ padding: '11px 16px', background: 'rgba(197,160,89,0.1)', border: '1px solid rgba(197,160,89,0.3)', borderRadius: 8, color: '#c5a059', fontFamily: 'Orbitron,monospace', fontSize: '0.5rem', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1, flexShrink: 0 }}>
                        SET
                    </button>
                    <button disabled={busy} onClick={promoteNext}
                        style={{ padding: '11px 12px', background: 'linear-gradient(135deg,rgba(197,160,89,0.18),rgba(197,160,89,0.06))', border: '1px solid rgba(197,160,89,0.35)', borderRadius: 8, color: '#c5a059', fontFamily: 'Orbitron,monospace', fontSize: '0.5rem', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1, flexShrink: 0, fontWeight: 700 }}>
                        ↑ PROMOTE
                    </button>
                </div>
            </div>

            {/* Issue task */}
            <div style={S.card}>
                <div style={S.cardTitle}>ISSUE TASK</div>
                <textarea value={taskText} onChange={e => setTaskText(e.target.value)} placeholder="Describe the task for this subject..." rows={3}
                    style={{ ...inp, resize: 'none', lineHeight: 1.5, marginBottom: 10 } as React.CSSProperties} />
                <button disabled={busy || !taskText.trim()} onClick={issueTask}
                    style={{ width: '100%', padding: '12px', background: taskText.trim() ? 'rgba(197,160,89,0.12)' : '#111', border: `1px solid ${taskText.trim() ? 'rgba(197,160,89,0.35)' : '#222'}`, borderRadius: 8, color: taskText.trim() ? '#c5a059' : '#444', fontFamily: 'Orbitron,monospace', fontSize: '0.52rem', fontWeight: 700, letterSpacing: '1.5px', cursor: taskText.trim() && !busy ? 'pointer' : 'default', opacity: busy ? 0.4 : 1 }}>
                    {busy ? 'SENDING...' : 'ISSUE COMMAND'}
                </button>
            </div>
        </div>
    );
}

// ─── CHAT VIEW ─────────────────────────────────────────────────────────────────
function ChatView({ user, adminEmail }: { user: DashUser; adminEmail: string | null }) {
    const [messages, setMessages] = useState<any[]>([]);
    const [chatTab, setChatTab] = useState<'chat' | 'service'>('chat');
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState('');
    const [loadingMsgs, setLoadingMsgs] = useState(true);
    const scrollBoxRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const prevMsgCountRef = useRef(-1);

    const scrollToBottom = useCallback(() => {
        if (scrollBoxRef.current) scrollBoxRef.current.scrollTop = scrollBoxRef.current.scrollHeight + 9999;
    }, []);

    const fetchMessages = useCallback(async () => {
        try {
            const res = await fetch('/api/chat/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.memberId, ...(adminEmail ? { requester: adminEmail } : {}) }) });
            const json = await res.json();
            if (json.success && json.messages) setMessages(json.messages);
        } finally { setLoadingMsgs(false); }
    }, [user.memberId, adminEmail]);

    useEffect(() => { fetchMessages(); const t = setInterval(fetchMessages, 8000); return () => clearInterval(t); }, [fetchMessages]);

    // Only scroll to bottom when message count changes (new message) or on initial load
    useLayoutEffect(() => {
        if (loadingMsgs) return;
        if (messages.length !== prevMsgCountRef.current) {
            scrollToBottom();
            setTimeout(scrollToBottom, 120);
            prevMsgCountRef.current = messages.length;
        }
    }, [messages, loadingMsgs, scrollToBottom]);

    const sendMessage = async () => {
        const txt = input.trim();
        if (!txt || sending) return;
        setSending(true); setSendError('');
        try {
            const res = await fetch('/api/chat/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ senderEmail: adminEmail, conversationId: user.memberId, content: txt, type: 'text' }) });
            const json = await res.json();
            if (!res.ok || !json.success) setSendError(json.error || 'Send failed');
            else { setInput(''); await fetchMessages(); }
        } catch (e: any) { setSendError(e?.message || 'Network error'); }
        setSending(false);
    };

    const chatMsgs = messages.filter(m => !isSystemMessage(m));
    const sysMsgs = messages.filter(m => isSystemMessage(m));
    const canSend = input.trim().length > 0 && !sending;

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexShrink: 0, borderBottom: '1px solid rgba(197,160,89,0.12)', background: 'rgba(0,0,0,0.4)' }}>
                {(['chat', 'service'] as const).map(t => (
                    <button key={t} onClick={() => setChatTab(t)} style={{ flex: 1, padding: '12px', background: 'none', border: 'none', borderBottom: chatTab === t ? '2px solid #c5a059' : '2px solid transparent', color: chatTab === t ? '#c5a059' : '#444', fontFamily: 'Orbitron,monospace', fontSize: '0.48rem', letterSpacing: '2px', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
                        {t === 'chat' ? 'CHAT' : 'SERVICE'}
                    </button>
                ))}
            </div>

            {chatTab === 'chat' && (
                <div ref={scrollBoxRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, WebkitOverflowScrolling: 'touch' as any, background: '#030303' }}>
                    {loadingMsgs && <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'Orbitron,monospace', fontSize: '0.46rem', color: '#2a2a2a', letterSpacing: '2px' }}>LOADING...</div>}
                    {!loadingMsgs && chatMsgs.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'Orbitron,monospace', fontSize: '0.46rem', color: '#1e1e1e', letterSpacing: '2px' }}>NO MESSAGES YET</div>}
                    {chatMsgs.map((msg, i) => {
                        const isAdmin = msg.sender_email && msg.member_id ? msg.sender_email.toLowerCase() !== msg.member_id.toLowerCase() : msg.sender === 'admin' || msg.sender === 'queen';
                        const text = msg.content || msg.message || '';
                        const isPhoto = msg.type === 'photo';
                        const isVideo = msg.type === 'video';
                        const timeStr = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                        if (text.startsWith('PROMOTION_CARD::')) {
                            try {
                                const d = JSON.parse(text.replace('PROMOTION_CARD::', ''));
                                return (
                                    <div key={msg.id || i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0' }}>
                                        <div style={{ width: '80%', maxWidth: 300, borderRadius: 14, overflow: 'hidden', background: 'linear-gradient(170deg,#0e0b06,#110d04)', border: '1px solid rgba(197,160,89,0.45)' }}>
                                            {d.photo && <img src={d.photo} style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }} alt="" />}
                                            <div style={{ padding: '12px 16px 14px', textAlign: 'center' }}>
                                                <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.38rem', color: '#c5a059', letterSpacing: '3px', marginBottom: 8 }}>✦ RANK PROMOTION</div>
                                                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.9rem', color: '#fff', fontWeight: 700, marginBottom: 8 }}>{d.name}</div>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                                                    <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.44rem', color: 'rgba(197,160,89,0.35)', textDecoration: 'line-through' }}>{d.oldRank}</span>
                                                    <span style={{ color: '#c5a059', fontSize: '0.8rem' }}>→</span>
                                                    <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.52rem', color: '#c5a059', fontWeight: 700 }}>{d.newRank}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.32rem', color: 'rgba(197,160,89,0.35)', marginTop: 4 }}>{timeStr}</span>
                                    </div>
                                );
                            } catch { /* fall through */ }
                        }

                        if (text.startsWith('TASK_FEEDBACK::')) {
                            try {
                                const data = JSON.parse(text.replace('TASK_FEEDBACK::', ''));
                                const { mediaUrl, mediaType, note } = data;
                                const fbIsVideo = mediaType === 'video' || (mediaUrl && /\.(mp4|mov|webm)/i.test(mediaUrl));
                                return (
                                    <div key={msg.id || i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0' }}>
                                        <div style={{ width: '82%', maxWidth: 280, borderRadius: 10, overflow: 'hidden', background: '#0a080a', border: '1px solid rgba(197,160,89,0.35)' }}>
                                            {mediaUrl && (fbIsVideo ? <video src={mediaUrl} controls playsInline style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block' }} /> : <img src={mediaUrl} style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block' }} alt="" />)}
                                            <div style={{ padding: '8px 12px 10px' }}>
                                                <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.38rem', color: 'rgba(197,160,89,0.55)', letterSpacing: '2px', marginBottom: 4 }}>TASK FEEDBACK</div>
                                                {note && <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>{note}</div>}
                                            </div>
                                        </div>
                                        <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.32rem', color: 'rgba(197,160,89,0.35)', marginTop: 4 }}>{timeStr}</span>
                                    </div>
                                );
                            } catch { /* fall through */ }
                        }

                        return (
                            <div key={msg.id || i} style={{ display: 'flex', flexDirection: 'column', alignItems: isAdmin ? 'flex-end' : 'flex-start' }}>
                                <div style={{ background: isAdmin ? '#000' : '#1c1c1e', color: '#fff', padding: (isPhoto || isVideo) ? '4px' : '10px 14px', borderRadius: isAdmin ? '16px 16px 3px 16px' : '16px 16px 16px 3px', maxWidth: '78%', fontSize: '0.95rem', lineHeight: 1.55, fontFamily: 'Cinzel,serif', wordBreak: 'break-word', boxShadow: isAdmin ? '0 0 0 1px rgba(197,160,89,0.55)' : undefined, border: !isAdmin ? '1px solid rgba(255,255,255,0.06)' : undefined }}>
                                    {isPhoto ? <img src={text} style={{ display: 'block', maxWidth: 220, maxHeight: 220, borderRadius: 10, objectFit: 'cover' }} alt="" />
                                        : isVideo ? <video src={text} controls playsInline style={{ display: 'block', maxWidth: 220, borderRadius: 10 }} />
                                            : <span>{text}</span>}
                                </div>
                                <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.32rem', color: isAdmin ? '#444' : 'rgba(197,160,89,0.4)', marginTop: 3 }}>{timeStr}</span>
                            </div>
                        );
                    })}
                    <div ref={bottomRef} />
                </div>
            )}

            {chatTab === 'service' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, WebkitOverflowScrolling: 'touch' as any, background: '#030303' }}>
                    {sysMsgs.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'Orbitron,monospace', fontSize: '0.46rem', color: '#1e1e1e', letterSpacing: '2px' }}>NO SERVICE MESSAGES</div>}
                    {sysMsgs.map((msg, i) => {
                        const d = new Date(msg.created_at || Date.now());
                        const content = msg.content || msg.message || '';
                        return (
                            <div key={msg.id || i} style={{ background: 'rgba(255,255,255,0.02)', borderLeft: '2px solid rgba(197,160,89,0.4)', padding: '9px 14px', borderRadius: '0 6px 6px 0' }}>
                                <span style={{ fontFamily: 'Cinzel,serif', color: '#c5a059', fontSize: '0.82rem', lineHeight: 1.5, display: 'block', marginBottom: 4 }}>{content}</span>
                                <span style={{ fontFamily: 'Orbitron,monospace', color: '#333', fontSize: '0.46rem', letterSpacing: '1px' }}>{d.toLocaleDateString()} · {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        );
                    })}
                </div>
            )}

            {sendError && <div style={{ padding: '6px 14px', background: 'rgba(255,0,0,0.08)', color: '#ff6666', fontFamily: 'Orbitron,monospace', fontSize: '0.4rem', textAlign: 'center' }}>{sendError}</div>}

            {chatTab === 'chat' && (
                <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: '1px solid rgba(197,160,89,0.1)', flexShrink: 0, background: 'rgba(4,4,4,0.98)' }}>
                    <input type="text" value={input} onChange={e => { setInput(e.target.value); setSendError(''); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendMessage(); } }}
                        placeholder="Issue command..." autoComplete="off"
                        style={{ flex: 1, background: 'rgba(14,14,14,0.95)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 8, color: '#fff', padding: '10px 14px', fontFamily: 'Rajdhani,sans-serif', fontSize: '16px', outline: 'none' }} />
                    <button onTouchEnd={e => { e.preventDefault(); sendMessage(); }} onClick={sendMessage}
                        style={{ background: canSend ? '#c5a059' : '#111', border: '1px solid rgba(197,160,89,0.3)', borderRadius: 8, color: canSend ? '#000' : '#333', fontFamily: 'Orbitron,monospace', fontSize: '0.52rem', letterSpacing: '1px', padding: '10px 14px', cursor: canSend ? 'pointer' : 'default', flexShrink: 0, fontWeight: 700, WebkitTapHighlightColor: 'transparent' }}>
                        {sending ? '...' : 'SEND'}
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── POSTS VIEW ───────────────────────────────────────────────────────────────
function PostsView({ posts, onPostCreated, userEmail }: { posts: any[]; onPostCreated: () => void; userEmail: string }) {
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImageFile(file);
        const reader = new FileReader();
        reader.onload = (ev) => setImagePreview(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    const submitPost = async () => {
        if (!body.trim()) return;
        setSubmitting(true);
        let mediaUrl: string | null = null;

        try {
            // Upload image if present
            if (imageFile) {
                setUploadProgress('Uploading image...');
                const path = `queen_posts/${Date.now()}_${imageFile.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
                const signRes = await fetch('/api/upload/signed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bucket: 'media', path }) });
                const signData = await signRes.json();
                if (signData.signedUrl) {
                    await fetch(signData.signedUrl, { method: 'PUT', body: imageFile, headers: { 'Content-Type': imageFile.type } });
                    mediaUrl = signData.publicUrl;
                }
                setUploadProgress('');
            }

            const supabase = createClient();
            await supabase.from('queen_posts').insert({
                title: title.trim() || null,
                body: body.trim(),
                media_url: mediaUrl,
                created_at: new Date().toISOString(),
                author: userEmail,
            });
            setTitle(''); setBody(''); setImageFile(null); setImagePreview(null);
            await onPostCreated();
        } catch (e) { console.error(e); }
        setSubmitting(false);
    };

    const inp: React.CSSProperties = { background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(197,160,89,0.1)', borderRadius: 8, color: '#fff', fontFamily: 'Rajdhani,sans-serif', fontSize: '0.95rem', padding: '10px 14px', outline: 'none', width: '100%' };

    return (
        <div style={S.scroll}>
            {/* Compose */}
            <div style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 12, padding: '18px', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.7rem', color: '#c5a059', letterSpacing: '4px', marginBottom: 2 }}>QUEEN'S DISPATCH</div>
                <input type="text" placeholder="Title (optional)" value={title} onChange={e => setTitle(e.target.value)} style={inp} />
                <textarea placeholder="Write your decree..." value={body} onChange={e => setBody(e.target.value)} rows={4}
                    style={{ ...inp, resize: 'none', lineHeight: 1.6 } as React.CSSProperties} />

                {/* Image upload */}
                <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleImagePick} style={{ display: 'none' }} />
                {imagePreview ? (
                    <div style={{ position: 'relative', width: '100%' }}>
                        <img src={imagePreview} style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(197,160,89,0.2)' }} alt="" />
                        <button onClick={() => { setImageFile(null); setImagePreview(null); }} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.8)', border: '1px solid #333', borderRadius: '50%', width: 28, height: 28, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>✕</button>
                    </div>
                ) : (
                    <button onClick={() => fileInputRef.current?.click()} style={{ width: '100%', padding: '10px', background: 'rgba(197,160,89,0.03)', border: '1px dashed rgba(197,160,89,0.15)', borderRadius: 8, color: '#555', fontFamily: 'Orbitron,monospace', fontSize: '0.46rem', letterSpacing: '2px', cursor: 'pointer' }}>
                        + ADD PHOTO / VIDEO
                    </button>
                )}

                {uploadProgress && <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.42rem', color: '#c5a059', textAlign: 'center', letterSpacing: '1px' }}>{uploadProgress}</div>}

                <button onClick={submitPost} disabled={submitting || !body.trim()}
                    style={{ background: !submitting && body.trim() ? '#c5a059' : '#1a1a1a', color: !submitting && body.trim() ? '#000' : '#444', border: 'none', borderRadius: 8, fontFamily: 'Cinzel,serif', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '3px', padding: '14px', cursor: !submitting && body.trim() ? 'pointer' : 'default' }}>
                    {submitting ? 'PUBLISHING...' : 'PUBLISH DECREE'}
                </button>
            </div>

            {posts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'Orbitron,monospace', fontSize: '0.5rem', color: '#1e1e1e', letterSpacing: '2px' }}>NO POSTS YET</div>
            ) : posts.map((post: any) => (
                <div key={post.id} style={{ background: 'rgba(12,12,12,0.95)', border: '1px solid rgba(197,160,89,0.08)', borderRadius: 10, padding: '16px' }}>
                    {post.title && <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.95rem', color: '#c5a059', marginBottom: 8 }}>{post.title}</div>}
                    <div style={{ fontSize: '0.9rem', color: '#bbb', lineHeight: 1.7 }}>{post.body}</div>
                    {post.media_url && (
                        post.media_url.match(/\.(mp4|mov|webm)/i)
                            ? <video src={post.media_url} controls playsInline style={{ width: '100%', borderRadius: 8, marginTop: 10, maxHeight: 220 }} />
                            : <img src={post.media_url} style={{ width: '100%', borderRadius: 8, marginTop: 10, objectFit: 'cover', maxHeight: 220 }} alt="" />
                    )}
                    <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.38rem', color: '#2a2a2a', letterSpacing: '1.5px', marginTop: 12 }}>
                        {post.created_at ? new Date(post.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── QUEEN VIEW ───────────────────────────────────────────────────────────────
function QueenView({ userEmail, onLogout, users, stats }: { userEmail: string; onLogout: () => void; users: DashUser[]; stats: any }) {
    const [broadcastText, setBroadcastText] = useState('');
    const [broadcasting, setBroadcasting] = useState(false);
    const [broadcastStatus, setBroadcastStatus] = useState('');

    const sendBroadcast = async () => {
        if (!broadcastText.trim() || broadcasting) return;
        if (!window.confirm(`Send broadcast to ${users.length} subjects?`)) return;
        setBroadcasting(true); setBroadcastStatus('');
        let count = 0;
        try {
            for (const u of users) {
                await insertMessage({ memberId: u.memberId, message: broadcastText.trim(), sender: 'queen', type: 'text', read: false });
                count++;
            }
            setBroadcastStatus(`✓ Sent to ${count} subjects`);
            setBroadcastText('');
        } catch (e: any) {
            setBroadcastStatus('✕ Error: ' + e.message);
        }
        setBroadcasting(false);
        setTimeout(() => setBroadcastStatus(''), 4000);
    };

    return (
        <div style={S.scroll}>
            {/* Profile card */}
            <div style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.18)', borderRadius: 12, padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <img src="/queen-karin.png" style={{ width: 84, height: 84, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(197,160,89,0.35)', boxShadow: '0 0 30px rgba(197,160,89,0.12)' }} alt="" />
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '1.35rem', color: '#c5a059', letterSpacing: '4px', marginTop: 4 }}>QUEEN KARIN</div>
                <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.44rem', color: '#444', letterSpacing: '3px' }}>SYSTEM ADMINISTRATOR</div>
                <div style={{ fontSize: '0.68rem', color: '#2e2e2e', letterSpacing: '1px' }}>{userEmail}</div>
            </div>

            {/* Stats */}
            <div style={S.card}>
                <div style={S.cardTitle}>SYSTEM OVERVIEW</div>
                {[
                    { label: 'Total Subjects', val: stats.active },
                    { label: 'Pending Reviews', val: stats.pending },
                    { label: 'Total Kneel Min', val: `${stats.kneelMins}` },
                    { label: 'Merit Pool', val: stats.totalMerit.toLocaleString() },
                    { label: 'Online Now', val: stats.online },
                ].map((item, i) => (
                    <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.44rem', color: '#444', letterSpacing: '1px' }}>{item.label}</span>
                        <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.8rem', color: '#c5a059', fontWeight: 700 }}>{item.val}</span>
                    </div>
                ))}
            </div>

            {/* Broadcast */}
            <div style={S.card}>
                <div style={S.cardTitle}>BROADCAST MESSAGE</div>
                <textarea value={broadcastText} onChange={e => setBroadcastText(e.target.value)} placeholder="Write message to all subjects..." rows={3}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(197,160,89,0.1)', borderRadius: 8, color: '#fff', fontFamily: 'Rajdhani,sans-serif', padding: '10px 12px', resize: 'none', outline: 'none', lineHeight: 1.5, marginBottom: 10 }} />
                {broadcastStatus && (
                    <div style={{ background: broadcastStatus.startsWith('✓') ? 'rgba(107,203,119,0.1)' : 'rgba(255,51,51,0.1)', border: `1px solid ${broadcastStatus.startsWith('✓') ? 'rgba(107,203,119,0.3)' : 'rgba(255,51,51,0.3)'}`, borderRadius: 6, padding: '8px 12px', fontFamily: 'Orbitron,monospace', fontSize: '0.44rem', color: broadcastStatus.startsWith('✓') ? '#6bcb77' : '#ff6666', marginBottom: 8, textAlign: 'center' }}>{broadcastStatus}</div>
                )}
                <button disabled={broadcasting || !broadcastText.trim()} onClick={sendBroadcast}
                    style={{ width: '100%', padding: '13px', background: !broadcasting && broadcastText.trim() ? 'rgba(197,160,89,0.12)' : '#111', border: `1px solid ${!broadcasting && broadcastText.trim() ? 'rgba(197,160,89,0.35)' : '#222'}`, borderRadius: 8, color: !broadcasting && broadcastText.trim() ? '#c5a059' : '#333', fontFamily: 'Orbitron,monospace', fontSize: '0.52rem', fontWeight: 700, letterSpacing: '1.5px', cursor: !broadcasting && broadcastText.trim() ? 'pointer' : 'default' }}>
                    {broadcasting ? `SENDING TO ${users.length} SUBJECTS...` : `BROADCAST TO ALL (${users.length})`}
                </button>
            </div>

            {/* Navigate */}
            <div style={S.card}>
                <div style={S.cardTitle}>NAVIGATE</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                        { label: '⚔ CHALLENGES', href: '/dashboard/challenges', c: 'rgba(197,160,89,0.25)' },
                        { label: '◉ GLOBAL HUB', href: '/global', c: 'rgba(197,160,89,0.15)' },
                        { label: '♛ SLAVE RECORDS', href: '/profile', c: 'rgba(197,160,89,0.1)' },
                    ].map(item => (
                        <button key={item.href} onClick={() => window.location.href = item.href}
                            style={{ display: 'block', width: '100%', background: 'rgba(197,160,89,0.04)', border: `1px solid ${item.c}`, color: '#c5a059', fontFamily: 'Cinzel,serif', fontSize: '0.72rem', letterSpacing: '3px', padding: '14px', cursor: 'pointer', borderRadius: 8, textAlign: 'center' }}>
                            {item.label} ↗
                        </button>
                    ))}
                </div>
            </div>

            <button onClick={onLogout} style={{ background: 'rgba(255,0,0,0.06)', border: '1px solid rgba(255,0,0,0.18)', color: '#ff4444', fontFamily: 'Orbitron,monospace', fontSize: '0.56rem', letterSpacing: '3px', padding: '16px', cursor: 'pointer', borderRadius: 8, width: '100%', flexShrink: 0 }}>
                LOG OUT
            </button>
        </div>
    );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function isSystemMessage(msg: any): boolean {
    if (!msg) return false;
    const sender = (msg.sender_email || msg.sender || '').toLowerCase();
    const content = (msg.content || msg.message || '').toUpperCase();
    return sender === 'system' || content.includes('COINS RECEIVED') || content.includes('TASK APPROVED') || content.includes('POINTS RECEIVED') || content.includes('TASK REJECTED') || content.includes('TASK VERIFIED');
}

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
    root: { display: 'flex', flexDirection: 'column', height: '100dvh', background: '#030303', color: '#fff', fontFamily: "'Rajdhani', sans-serif", overflow: 'hidden', WebkitFontSmoothing: 'antialiased' },
    topBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 50, minHeight: 50, background: 'rgba(4,4,4,0.99)', borderBottom: '1px solid rgba(197,160,89,0.15)', padding: '0 16px', flexShrink: 0, zIndex: 10 },
    topBrand: { fontFamily: 'Cinzel,serif', fontSize: '0.68rem', color: '#c5a059', letterSpacing: '3px' },
    topCode: { fontFamily: 'Orbitron,monospace', fontSize: '0.85rem', color: '#c5a059', fontWeight: 900, letterSpacing: '2px', background: 'rgba(197,160,89,0.07)', padding: '3px 10px', borderRadius: 4, border: '1px solid rgba(197,160,89,0.12)' },
    content: { flex: 1, minHeight: 0, overflow: 'hidden' },
    nav: { display: 'flex', alignItems: 'stretch', height: 60, minHeight: 60, background: 'rgba(4,4,4,0.99)', borderTop: '1px solid rgba(197,160,89,0.15)', flexShrink: 0 },
    navBtn: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'none', border: 'none', borderTop: '2px solid transparent', cursor: 'pointer', padding: '6px 0', outline: 'none', WebkitTapHighlightColor: 'transparent' },
    navActive: { borderTopColor: 'rgba(197,160,89,0.5)' },
    loadWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#030303', gap: 16 },
    spinner: { width: 32, height: 32, border: '2px solid rgba(197,160,89,0.1)', borderTopColor: '#c5a059', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
    loadTxt: { fontFamily: 'Cinzel,serif', fontSize: '0.7rem', color: '#c5a059', letterSpacing: '4px', margin: 0 },
    scroll: { height: '100%', overflowY: 'auto', overflowX: 'hidden', padding: '14px 12px 24px', display: 'flex', flexDirection: 'column', gap: 12, WebkitOverflowScrolling: 'touch' as any },
    heroCard: { background: "linear-gradient(135deg, rgba(197,160,89,0.08) 0%, rgba(8,6,2,0.96) 100%)", border: '1px solid rgba(197,160,89,0.18)', borderRadius: 12, padding: '22px 20px', flexShrink: 0 },
    statCard: { background: 'rgba(14,14,14,0.95)', border: '1px solid rgba(197,160,89,0.07)', borderRadius: 10, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 6 },
    card: { background: 'rgba(11,11,11,0.95)', border: '1px solid rgba(197,160,89,0.08)', borderRadius: 10, padding: '16px 14px', flexShrink: 0 },
    cardTitle: { fontFamily: 'Cinzel,serif', fontSize: '0.6rem', color: '#c5a059', letterSpacing: '3px', marginBottom: 12, opacity: 0.8 },
    userCard: { display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(11,11,11,0.95)', border: '1px solid rgba(197,160,89,0.07)', borderRadius: 10, padding: '12px 14px', width: '100%', cursor: 'pointer', textAlign: 'left', WebkitTapHighlightColor: 'transparent', outline: 'none', flexShrink: 0 },
    backBtn: { alignSelf: 'flex-start', background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.15)', color: '#c5a059', fontFamily: 'Orbitron,monospace', fontSize: '0.44rem', letterSpacing: '2px', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', marginBottom: 14, WebkitTapHighlightColor: 'transparent' },
};
