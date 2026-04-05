'use client';

import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getAdminDashboardData, getUnreadMessageStatus, adminApproveTaskAction, adminRejectTaskAction } from '@/actions/velo-actions';

type Tab = 'home' | 'subjects' | 'posts' | 'queen';
type ProfileTab = 'info' | 'tasks' | 'chat';

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
    'Goddess': '#ff69b4',
    'Chevalier': '#d4af37',
    'Sentinel': '#4a9eff',
    'Enforcer': '#ff8c42',
    'Knight': '#b8b8b8',
    'Devotee': '#4ecdc4',
    'Aspirant': '#6bcb77',
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
    const [profileTab, setProfileTab] = useState<ProfileTab>('info');
    const [search, setSearch] = useState('');
    const [posts, setPosts] = useState<any[]>([]);
    const [postTitle, setPostTitle] = useState('');
    const [postBody, setPostBody] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [dailyCode, setDailyCode] = useState('----');
    // unreadMap: memberId -> ISO timestamp of last slave message
    const [unreadMap, setUnreadMap] = useState<Record<string, string>>({});
    // Tracking refs (same pattern as desktop dashboard-sidebar.ts)
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
                    // lastSeen: prefer last_active (profile), fallback to lastWorship (tasks)
                    lastSeen: u.lastSeen || u.last_active || u.lastWorship || null,
                    hasActiveTask: !!(u.parameters?.taskdom_active_task),
                }));
                setUsers(mapped);
            }
        } finally {
            setLoading(false);
        }
        const d = new Date();
        const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
        setDailyCode(String((seed * 7 + 1337) % 9000 + 1000));
    }, []);

    const loadPosts = useCallback(async () => {
        try {
            const supabase = createClient();
            const { data } = await supabase
                .from('queen_posts')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(30);
            setPosts(data || []);
        } catch (_) { setPosts([]); }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);
    useEffect(() => {
        const interval = setInterval(loadData, 8000);
        return () => clearInterval(interval);
    }, [loadData]);
    useEffect(() => { if (tab === 'posts') loadPosts(); }, [tab, loadPosts]);

    // Track online join times (mirrors desktop renderSidebar logic)
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

    // Migrate old 'chat_read_' ISO keys → 'read_' numeric keys (one-time, on first load)
    useEffect(() => {
        if (typeof window === 'undefined' || !users.length) return;
        users.forEach(u => {
            const newKey = 'read_' + u.memberId;
            if (!localStorage.getItem(newKey)) {
                const oldVal = localStorage.getItem('chat_read_' + u.memberId);
                if (oldVal) {
                    const ms = new Date(oldVal).getTime();
                    if (!isNaN(ms)) localStorage.setItem(newKey, ms.toString());
                }
            }
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [users.length > 0]);

    const markPendingRead = useCallback(() => {
        const id = pendingReadIdRef.current;
        if (id) {
            localStorage.setItem('read_' + id, Date.now().toString());
            pendingReadIdRef.current = null;
        }
    }, []);

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    const submitPost = async () => {
        if (!postBody.trim()) return;
        setSubmitting(true);
        try {
            const supabase = createClient();
            await supabase.from('queen_posts').insert({
                title: postTitle.trim() || null,
                body: postBody.trim(),
                created_at: new Date().toISOString(),
                author: userEmail,
            });
            setPostTitle(''); setPostBody('');
            await loadPosts();
        } finally { setSubmitting(false); }
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
    const stats = {
        active: users.length,
        online: onlineCount,
        pending: globalQueue.length,
        kneelMins: users.reduce((s, u) => s + (u.parameters?.totalKneelMinutes || 0), 0),
        totalMerit: users.reduce((s, u) => s + (u.score || 0), 0),
    };

    if (loading) return (
        <div style={S.loadWrap}>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <div style={S.spinner} />
            <p style={S.loadTxt}>LOADING SYSTEM...</p>
        </div>
    );

    return (
        <div style={S.root}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;500;700&display=swap');
                @keyframes spin{to{transform:rotate(360deg)}}
                * { box-sizing: border-box; }
                body { margin: 0; padding: 0; background: #030303; }
                input, textarea, select { font-size: 16px !important; }
                input::placeholder { color: #444; }
                textarea::placeholder { color: #444; }
                button:active { opacity: 0.75; }
                input, textarea { touch-action: manipulation; }
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
                        onBack={() => { markPendingRead(); setSelectedUser(null); }}
                        adminEmail={userEmail}
                        onReviewed={() => loadData()}
                    />
                ) : tab === 'home' ? (
                    <HomeView stats={stats} users={users} dailyCode={dailyCode} />
                ) : tab === 'subjects' ? (
                    <SubjectsView
                        users={filtered} allCount={users.length}
                        search={search} setSearch={setSearch}
                        unreadMap={unreadMap}
                        onlineJoinTime={onlineJoinTimeRef.current}
                        onSelect={(u) => {
                            markPendingRead();
                            const lastSlaveMsg = unreadMap[u.memberId];
                            if (lastSlaveMsg) {
                                const readTime = localStorage.getItem('read_' + u.memberId);
                                const isUnread = readTime
                                    ? new Date(lastSlaveMsg).getTime() > parseInt(readTime)
                                    : true;
                                if (isUnread) pendingReadIdRef.current = u.memberId;
                            }
                            setSelectedUser(u);
                            setProfileTab('chat');
                        }}
                    />
                ) : tab === 'posts' ? (
                    <PostsView
                        posts={posts}
                        title={postTitle} setTitle={setPostTitle}
                        body={postBody} setBody={setPostBody}
                        submitting={submitting} onSubmit={submitPost}
                    />
                ) : (
                    <QueenView userEmail={userEmail} onLogout={handleLogout} users={users} stats={stats} />
                )}
            </div>

            {/* BOTTOM NAV */}
            {!selectedUser && (
                <nav style={S.nav}>
                    {([
                        { key: 'home' as Tab, icon: '⌂', label: 'HOME', badge: undefined as number | undefined, badgeColor: '#6bcb77' },
                        { key: 'subjects' as Tab, icon: '◉', label: 'SUBS', badge: unreadCount > 0 ? unreadCount : (onlineCount > 0 ? onlineCount : undefined), badgeColor: unreadCount > 0 ? '#4a9eff' : '#6bcb77' },
                        { key: 'posts' as Tab, icon: '✦', label: 'POSTS', badge: undefined as number | undefined, badgeColor: '#6bcb77' },
                        { key: 'queen' as Tab, icon: '♛', label: 'QUEEN', badge: undefined as number | undefined, badgeColor: '#6bcb77' },
                    ]).map(({ key, icon, label, badge, badgeColor }) => (
                        <button key={key} style={{ ...S.navBtn, ...(tab === key ? S.navActive : {}) }} onClick={() => setTab(key)}>
                            <div style={{ position: 'relative' }}>
                                <span style={{ fontSize: '1.3rem', lineHeight: 1, color: tab === key ? '#c5a059' : '#2e2e2e' }}>{icon}</span>
                                {badge !== undefined && (
                                    <div style={{ position: 'absolute', top: -4, right: -8, minWidth: 14, height: 14, background: badgeColor, borderRadius: 7, fontSize: '0.36rem', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Orbitron,monospace', fontWeight: 700, padding: '0 3px' }}>{badge}</div>
                                )}
                            </div>
                            <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.38rem', letterSpacing: '1.5px', color: tab === key ? '#c5a059' : '#2e2e2e', textTransform: 'uppercase' }}>
                                {label}
                            </span>
                        </button>
                    ))}
                </nav>
            )}
        </div>
    );
}

// ─── HOME VIEW ───────────────────────────────────────────────────────────────
function HomeView({ stats, users, dailyCode }: { stats: any; users: DashUser[]; dailyCode: string }) {
    const recent = [...users].sort((a, b) => {
        const at = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
        const bt = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
        return bt - at;
    }).slice(0, 6);
    return (
        <div style={S.scroll}>
            {/* Hero */}
            <div style={S.heroCard}>
                <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.85rem', color: 'rgba(197,160,89,0.55)', letterSpacing: '3px', marginBottom: 4 }}>WELCOME BACK</div>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '1.7rem', color: '#fff', lineHeight: 1.2 }}>Queen Karin</div>
                <div style={{ fontSize: '0.8rem', color: '#666', marginTop: 6, letterSpacing: '1px' }}>System dominance at 98%</div>
                <div style={{ marginTop: 12 }}>
                    <span style={{ background: 'rgba(107,203,119,0.15)', border: '1px solid rgba(107,203,119,0.3)', color: '#6bcb77', fontSize: '0.5rem', fontFamily: 'Orbitron,monospace', letterSpacing: '2px', padding: '4px 12px', borderRadius: 100 }}>● ONLINE</span>
                </div>
            </div>

            {/* Stats 2×2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flexShrink: 0 }}>
                {[
                    { label: 'SUBJECTS', val: stats.active, icon: '👤', c: '#4a9eff' },
                    { label: 'PENDING', val: stats.pending, icon: '📋', c: '#ff8c42' },
                    { label: 'KNEEL MIN', val: stats.kneelMins, icon: '⏱', c: '#c5a059' },
                    { label: 'MERIT POOL', val: stats.totalMerit.toLocaleString(), icon: '⚡', c: '#6bcb77' },
                ].map(item => (
                    <div key={item.label} style={S.statCard}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: item.c + '22', color: item.c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', marginBottom: 6 }}>{item.icon}</div>
                        <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '1.3rem', fontWeight: 700, color: '#fff', lineHeight: 1 }}>{item.val}</div>
                        <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.4rem', color: '#555', letterSpacing: '1.5px', marginTop: 4 }}>{item.label}</div>
                    </div>
                ))}
            </div>

            {/* Daily code */}
            <div style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 12, padding: '20px 18px', textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.42rem', color: '#555', letterSpacing: '3px', marginBottom: 10 }}>TODAY'S VERIFICATION CODE</div>
                <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '2.6rem', fontWeight: 900, color: '#c5a059', letterSpacing: '10px', textShadow: '0 0 30px rgba(197,160,89,0.25)' }}>{dailyCode}</div>
                <div style={{ fontSize: '0.68rem', color: '#3a3a3a', marginTop: 8 }}>Share with subjects to verify</div>
            </div>

            {/* Recent subjects */}
            {recent.length > 0 && (
                <div style={S.card}>
                    <div style={S.cardTitle}>RECENT SUBJECTS</div>
                    {recent.map(u => (
                        <div key={u.memberId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <img src={u.avatar} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(197,160,89,0.2)', flexShrink: 0 }} onError={(e) => { (e.target as any).src = '/queen-karin.png'; }} alt="" />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.82rem', color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
                                <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.4rem', color: rc(u.rank), letterSpacing: '1.5px', marginTop: 2 }}>{u.rank}</div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.55rem', color: '#c5a059' }}>⚡{u.score}</div>
                                <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.5rem', color: '#4ecdc4', marginTop: 2 }}>💰{u.wallet.toLocaleString()}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── SUBJECTS VIEW ───────────────────────────────────────────────────────────
function hasUnread(memberId: string, unreadMap: Record<string, string>): boolean {
    const lastSlaveMsg = unreadMap[memberId];
    if (!lastSlaveMsg) return false;
    const readTime = localStorage.getItem('read_' + memberId);
    if (!readTime) return true;
    return new Date(lastSlaveMsg).getTime() > parseInt(readTime);
}

function SubjectsView({ users, allCount, search, setSearch, unreadMap, onSelect, onlineJoinTime }: {
    users: DashUser[]; allCount: number; search: string; setSearch: (s: string) => void;
    unreadMap: Record<string, string>; onSelect: (u: DashUser) => void;
    onlineJoinTime: Record<string, number>;
}) {
    const now = Date.now();
    const getLastSeenMs = (u: DashUser) => {
        if (!u.lastSeen) return 0;
        const t = new Date(u.lastSeen).getTime();
        return isNaN(t) ? 0 : t;
    };

    // Group 1: unread — FIFO by last message time (earliest = waited longest = top)
    const withUnread = [...users]
        .filter(u => hasUnread(u.memberId, unreadMap))
        .sort((a, b) => {
            const at = unreadMap[a.memberId] ? new Date(unreadMap[a.memberId]).getTime() : 0;
            const bt = unreadMap[b.memberId] ? new Date(unreadMap[b.memberId]).getTime() : 0;
            return at - bt;
        });
    const unreadIds = new Set(withUnread.map(u => u.memberId));

    // Group 2: online, no unread — stable by first seen online time
    const onlineNoUnread = [...users]
        .filter(u => getOnlineStatus(u.lastSeen) === 'online' && !unreadIds.has(u.memberId))
        .sort((a, b) => (onlineJoinTime[a.memberId] || now) - (onlineJoinTime[b.memberId] || now));

    // Group 3: offline/away/recent, no unread — most recently seen first
    const offlineNoUnread = [...users]
        .filter(u => getOnlineStatus(u.lastSeen) !== 'online' && !unreadIds.has(u.memberId))
        .sort((a, b) => getLastSeenMs(b) - getLastSeenMs(a));

    const sorted = [...withUnread, ...onlineNoUnread, ...offlineNoUnread];
    return (
        <div style={S.scroll}>
            {/* Search bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(15,15,15,0.9)', border: '1px solid rgba(197,160,89,0.12)', borderRadius: 10, padding: '10px 14px', flexShrink: 0 }}>
                <span style={{ fontSize: '1rem', flexShrink: 0 }}>🔍</span>
                <input type="text" placeholder="Search subjects..." value={search} onChange={e => setSearch(e.target.value)}
                    style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontFamily: 'Rajdhani,sans-serif', fontSize: '0.95rem', letterSpacing: '1px' }} />
                {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: '#555', fontSize: '0.9rem', cursor: 'pointer', padding: 0, flexShrink: 0 }}>✕</button>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 2, flexShrink: 0 }}>
                <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.4rem', color: '#333', letterSpacing: '2px' }}>{sorted.length} OF {allCount} SUBJECTS</span>
                {sorted.filter(u => getOnlineStatus(u.lastSeen) === 'online').length > 0 && (
                    <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.4rem', color: '#6bcb77', letterSpacing: '2px' }}>
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
                    style={{ ...S.userCard, ...(unread ? { border: '1px solid rgba(74,158,255,0.35)', background: 'rgba(74,158,255,0.04)' } : {}) }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                        <img src={u.avatar} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${unread ? '#4a9eff' : rc(u.rank) + '44'}`, display: 'block' }} onError={(e) => { (e.target as any).src = '/queen-karin.png'; }} alt="" />
                        {/* Online status dot */}
                        <div style={{ position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, background: dotC, borderRadius: '50%', border: '2px solid #030303', boxShadow: status === 'online' ? `0 0 6px ${dotC}` : 'none' }} />
                        {/* Pending review badge (top-right of avatar) */}
                        {u.reviewQueue.length > 0 && (
                            <div style={{ position: 'absolute', top: -3, right: -3, width: 17, height: 17, background: '#ff4444', borderRadius: '50%', fontSize: '0.42rem', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Orbitron,monospace', fontWeight: 700, border: '1.5px solid #030303' }}>{u.reviewQueue.length}</div>
                        )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.9rem', color: unread ? '#fff' : '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0, fontWeight: unread ? 700 : 400 }}>{u.name}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.38rem', letterSpacing: '1px', padding: '2px 8px', borderRadius: 100, background: rc(u.rank) + '22', color: rc(u.rank), border: `1px solid ${rc(u.rank)}44` }}>{u.rank}</span>
                            {status !== 'offline' && (
                                <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.34rem', color: dotC, letterSpacing: '1px' }}>
                                    {status === 'online' ? '● ONLINE' : timeAgo(u.lastSeen)}
                                </span>
                            )}
                            {u.hasActiveTask && <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.34rem', color: '#ff8c42', letterSpacing: '1px' }}>WORKING</span>}
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                        {/* Message icon — lit up when unread */}
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ opacity: unread ? 1 : 0.15, filter: unread ? 'drop-shadow(0 0 5px #4a9eff)' : 'none', flexShrink: 0 }}>
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill={unread ? '#4a9eff' : '#333'} />
                            {unread && <circle cx="19" cy="5" r="4" fill="#ff4444" />}
                        </svg>
                        {u.reviewQueue.length > 0 && <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.44rem', color: '#ff8c42' }}>📋 {u.reviewQueue.length}</span>}
                    </div>
                    <div style={{ color: '#222', fontSize: '1.5rem', lineHeight: 1, flexShrink: 0, marginLeft: 4 }}>›</div>
                </button>
                );
            })}
        </div>
    );
}

// ─── USER PROFILE ────────────────────────────────────────────────────────────
function UserProfile({ user, profileTab, setProfileTab, onBack, adminEmail, onReviewed }: {
    user: DashUser; profileTab: ProfileTab; setProfileTab: (t: ProfileTab) => void; onBack: () => void; adminEmail: string | null; onReviewed?: () => void;
}) {
    const color = rc(user.rank);
    const devotion = user.parameters?.devotion || 0;
    const devPct = Math.min(100, (devotion / 1000) * 100);
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const [reviewing, setReviewing] = useState<string | null>(null); // taskId being processed
    const [queue, setQueue] = useState<any[]>(user.reviewQueue);

    const isRoutine = (task: any) => !!(task.isRoutine || task.category === 'Routine' || task.text === 'Daily Routine');

    const handleApprove = async (task: any) => {
        const taskId = task.id || task.taskId;
        setReviewing(taskId);
        try {
            await adminApproveTaskAction(taskId, user.memberId, task.bonus || 50, null);
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

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
    };
    const handleTouchEnd = (e: React.TouchEvent) => {
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
        if (dx > 80 && dy < 60) onBack();
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#040404' }}
            onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>

            {/* ── Profile header ── */}
            <div style={{ padding: '14px 14px 18px', background: 'rgba(6,6,6,0.97)', borderBottom: `1px solid ${color}33`, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <button onClick={onBack} style={S.backBtn}>← BACK</button>
                <img src={user.avatar} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${color}55`, boxShadow: `0 0 24px ${color}20`, marginBottom: 8 }} onError={(e) => { (e.target as any).src = '/queen-karin.png'; }} alt="" />
                <span style={{ fontFamily: 'Cinzel,serif', fontSize: '0.56rem', letterSpacing: '2px', padding: '3px 14px', borderRadius: 100, background: color + '22', color, border: `1px solid ${color}55`, marginBottom: 7 }}>{user.rank}</span>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '1.35rem', color: '#fff', letterSpacing: '2px', textAlign: 'center' }}>{user.name}</div>
                <div style={{ fontSize: '0.66rem', color: '#3a3a3a', marginTop: 3, letterSpacing: '1px' }}>{user.memberId}</div>
                {/* Stats */}
                <div style={{ display: 'flex', width: '100%', marginTop: 14, background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.1)', borderRadius: 10, padding: '10px 0' }}>
                    {[
                        { label: 'MERIT', val: user.score, color: '#c5a059' },
                        { label: 'CAPITAL', val: user.wallet.toLocaleString(), color: '#4ecdc4' },
                        { label: 'PENDING', val: user.reviewQueue.length, color: '#ff8c42' },
                    ].map((s, i) => (
                        <div key={s.label} style={{ flex: 1, textAlign: 'center', borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                            <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '1.2rem', fontWeight: 700, color: s.color }}>{s.val}</div>
                            <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.36rem', color: '#444', letterSpacing: '1.5px', marginTop: 3 }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Tabs ── */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(197,160,89,0.1)', background: 'rgba(6,6,6,0.97)', flexShrink: 0 }}>
                {(['info', 'tasks', 'chat'] as ProfileTab[]).map(t => (
                    <button key={t} onClick={() => setProfileTab(t)} style={{ flex: 1, padding: '11px', background: 'none', border: 'none', borderBottom: profileTab === t ? '2px solid #c5a059' : '2px solid transparent', color: profileTab === t ? '#c5a059' : '#444', fontFamily: 'Orbitron,monospace', fontSize: '0.5rem', letterSpacing: '2px', cursor: 'pointer' }}>
                        {t === 'info' ? 'PROFILE' : t === 'tasks' ? 'TASKS' : 'CHAT'}
                    </button>
                ))}
            </div>

            {/* ── Tab content ── */}
            {profileTab === 'chat' ? (
                <ChatView key={user.memberId} user={user} adminEmail={adminEmail} />
            ) : (
                <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: 12, WebkitOverflowScrolling: 'touch' as any }}>
                    {profileTab === 'info' && (<>
                        {/* Devotion */}
                        <div style={S.card}>
                            <div style={S.cardTitle}>DEVOTION PROGRESS</div>
                            <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 100, overflow: 'hidden', marginBottom: 6 }}>
                                <div style={{ height: '100%', width: `${devPct}%`, background: color, borderRadius: 100, transition: 'width 0.5s ease' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.46rem', color: '#444' }}>{devotion} / 1000</span>
                                <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.46rem', color }}>{devPct.toFixed(0)}%</span>
                            </div>
                        </div>

                        {/* Kneel */}
                        {user.parameters?.totalKneelMinutes > 0 && (
                            <div style={S.card}>
                                <div style={S.cardTitle}>ENDURANCE RECORD</div>
                                <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                                    {[
                                        { val: user.parameters.totalKneelMinutes, lbl: 'TOTAL MIN' },
                                        { val: user.parameters.kneelCount || 0, lbl: 'SESSIONS' },
                                        { val: user.parameters.longestKneel || 0, lbl: 'BEST MIN' },
                                    ].map(item => (
                                        <div key={item.lbl} style={{ textAlign: 'center' }}>
                                            <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '1.1rem', color: '#c5a059' }}>{item.val}</div>
                                            <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.35rem', color: '#444', letterSpacing: '1px', marginTop: 4 }}>{item.lbl}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Intel */}
                        <div style={S.card}>
                            <div style={S.cardTitle}>INTEL</div>
                            {[
                                { label: 'EMAIL', val: user.memberId },
                                { label: 'RANK', val: user.rank, valColor: color },
                                { label: 'MERIT', val: String(user.score) },
                                { label: 'CAPITAL', val: user.wallet.toLocaleString() + ' coins' },
                            ].map((row, i) => (
                                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                                    <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.46rem', color: '#444', letterSpacing: '1.5px' }}>{row.label}</span>
                                    <span style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.82rem', color: (row as any).valColor || '#aaa', maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{row.val}</span>
                                </div>
                            ))}
                        </div>
                    </>)}

                    {profileTab === 'tasks' && (<>
                        {queue.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'Orbitron,monospace', fontSize: '0.52rem', color: '#2a2a2a', letterSpacing: '2px' }}>NO PENDING TASKS</div>
                        ) : queue.map((task: any, i: number) => {
                            const taskId = task.id || task.taskId;
                            const routine = isRoutine(task);
                            const busy = reviewing === taskId;
                            return (
                                <div key={i} style={{ background: 'rgba(12,12,12,0.9)', border: `1px solid ${routine ? 'rgba(197,160,89,0.2)' : 'rgba(255,140,66,0.15)'}`, borderRadius: 10, padding: '14px', marginBottom: 10 }}>
                                    {/* Header */}
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                                        {task.proof_url && <img src={task.proof_url} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, flexShrink: 0, border: '1px solid #222' }} alt="" />}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.85rem', color: '#fff', marginBottom: 4, lineHeight: 1.3 }}>{task.taskName || task.task_name || task.text || 'Task'}</div>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                                {routine && <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.4rem', color: '#c5a059', letterSpacing: '1.5px', background: 'rgba(197,160,89,0.1)', padding: '2px 7px', borderRadius: 20, border: '1px solid rgba(197,160,89,0.3)' }}>ROUTINE</span>}
                                                <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.4rem', color: '#444', letterSpacing: '1px' }}>{task.submitted_at ? new Date(task.submitted_at).toLocaleDateString() : ''}</span>
                                            </div>
                                            {task.notes && <div style={{ fontSize: '0.78rem', color: '#666', marginTop: 6, lineHeight: 1.5 }}>{task.notes}</div>}
                                        </div>
                                    </div>
                                    {/* Action buttons */}
                                    {routine ? (
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button disabled={busy} onClick={() => handleApprove(task)}
                                                style={{ flex: 1, padding: '10px 0', background: busy ? '#1a1a1a' : 'linear-gradient(135deg,#c5a059,#8b6914)', color: '#000', border: 'none', borderRadius: 8, fontFamily: 'Orbitron,monospace', fontSize: '0.48rem', fontWeight: 700, letterSpacing: '1.5px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1 }}>
                                                {busy ? '...' : 'YES — 50 PTS'}
                                            </button>
                                            <button disabled={busy} onClick={() => setQueue(q => q.filter(t => (t.id || t.taskId) !== taskId))}
                                                style={{ flex: 1, padding: '10px 0', background: 'rgba(255,255,255,0.04)', color: '#888', border: '1px solid #222', borderRadius: 8, fontFamily: 'Orbitron,monospace', fontSize: '0.48rem', fontWeight: 700, letterSpacing: '1.5px', cursor: 'pointer' }}>
                                                NO
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button disabled={busy} onClick={() => handleApprove(task)}
                                                style={{ flex: 1, padding: '10px 0', background: busy ? '#1a1a1a' : 'linear-gradient(135deg,#1a4a1a,#2d7a2d)', color: '#6bcb77', border: '1px solid rgba(107,203,119,0.3)', borderRadius: 8, fontFamily: 'Orbitron,monospace', fontSize: '0.48rem', fontWeight: 700, letterSpacing: '1.5px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1 }}>
                                                {busy ? '...' : '✓ APPROVE'}
                                            </button>
                                            <button disabled={busy} onClick={() => handleReject(task)}
                                                style={{ flex: 1, padding: '10px 0', background: busy ? '#1a1a1a' : 'rgba(255,51,51,0.08)', color: '#ff4444', border: '1px solid rgba(255,51,51,0.25)', borderRadius: 8, fontFamily: 'Orbitron,monospace', fontSize: '0.48rem', fontWeight: 700, letterSpacing: '1.5px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1 }}>
                                                {busy ? '...' : '✕ REJECT'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </>)}
                </div>
            )}
        </div>
    );
}

// ─── Service message helper ───────────────────────────────────────────────────
function isSystemMessage(msg: any): boolean {
    if (!msg) return false;
    const sender = (msg.sender_email || msg.sender || '').toLowerCase();
    const content = (msg.content || msg.message || '').toUpperCase();
    return sender === 'system' ||
        content.includes('COINS RECEIVED') ||
        content.includes('TASK APPROVED') ||
        content.includes('POINTS RECEIVED') ||
        content.includes('TASK REJECTED') ||
        content.includes('TASK VERIFIED');
}

// ─── CHAT VIEW — same endpoints as desktop dashboard ─────────────────────────
function ChatView({ user, adminEmail }: { user: DashUser; adminEmail: string | null }) {
    const [messages, setMessages] = useState<any[]>([]);
    const [chatTab, setChatTab] = useState<'chat' | 'service'>('chat');
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState('');
    const [loadingMsgs, setLoadingMsgs] = useState(true);
    const bottomRef = useRef<HTMLDivElement>(null);
    const scrollBoxRef = useRef<HTMLDivElement>(null);

    const forceBottom = useCallback(() => {
        const scroll = () => {
            if (scrollBoxRef.current) scrollBoxRef.current.scrollTop = scrollBoxRef.current.scrollHeight + 9999;
        };
        scroll();
        setTimeout(scroll, 80);
        setTimeout(scroll, 350);
        setTimeout(scroll, 700);
    }, []);

    // Same as desktop: GET /api/chat/history?email=memberId&requester=adminEmail
    const fetchMessages = useCallback(async () => {
        try {
            const res = await fetch('/api/chat/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.memberId, ...(adminEmail ? { requester: adminEmail } : {}) }) });
            const json = await res.json();
            if (json.success && json.messages) {
                setMessages(json.messages);
            }
        } finally {
            setLoadingMsgs(false);
        }
    }, [user.memberId, adminEmail]);

    useEffect(() => {
        fetchMessages();
        const interval = setInterval(fetchMessages, 8000);
        return () => clearInterval(interval);
    }, [fetchMessages]);

    useLayoutEffect(() => {
        if (!loadingMsgs) forceBottom();
    }, [messages, loadingMsgs, forceBottom]);

    // Same as desktop: POST /api/chat/send with senderEmail + conversationId + content
    const sendMessage = async () => {
        const txt = input.trim();
        if (!txt || sending) return;
        setSending(true);
        setSendError('');
        try {
            const res = await fetch('/api/chat/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    senderEmail: adminEmail,
                    conversationId: user.memberId,
                    content: txt,
                    type: 'text',
                }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                setSendError(json.error || 'Send failed');
            } else {
                setInput('');
                await fetchMessages();
            }
        } catch (e: any) {
            setSendError(e?.message || 'Network error');
        } finally {
            setSending(false);
        }
    };

    const canSend = input.trim().length > 0 && !sending;

    const chatMsgs = messages.filter(m => !isSystemMessage(m));
    const sysMsgs  = messages.filter(m => isSystemMessage(m));

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* ── Tab bar: CHAT / SERVICE ── */}
            <div style={{ display: 'flex', flexShrink: 0, borderBottom: '1px solid rgba(197,160,89,0.15)', background: 'rgba(0,0,0,0.4)' }}>
                {(['chat', 'service'] as const).map(t => (
                    <button key={t} onClick={() => setChatTab(t)} style={{
                        flex: 1, padding: '12px 4px', background: 'none', border: 'none',
                        borderBottom: chatTab === t ? '2px solid #c5a059' : '2px solid transparent',
                        color: chatTab === t ? '#c5a059' : '#444',
                        fontFamily: 'Orbitron,monospace', fontSize: '0.5rem', letterSpacing: '2px',
                        cursor: 'pointer', textTransform: 'uppercase',
                        WebkitTapHighlightColor: 'transparent',
                    }}>
                        {t === 'chat' ? 'CHAT' : 'SERVICE'}
                    </button>
                ))}
            </div>

            {/* ── CHAT TAB ── */}
            {chatTab === 'chat' && (
                <div ref={scrollBoxRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, WebkitOverflowScrolling: 'touch' as any, overflowAnchor: 'none' as any }}>
                    {loadingMsgs && (
                        <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'Orbitron,monospace', fontSize: '0.48rem', color: '#2a2a2a', letterSpacing: '2px' }}>LOADING...</div>
                    )}
                    {!loadingMsgs && chatMsgs.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'Orbitron,monospace', fontSize: '0.48rem', color: '#222', letterSpacing: '2px' }}>NO MESSAGES YET</div>
                    )}
                    {chatMsgs.map((msg, i) => {
                        const isAdmin = msg.sender_email && msg.member_id
                            ? msg.sender_email.toLowerCase() !== msg.member_id.toLowerCase()
                            : msg.sender === 'admin' || msg.sender === 'queen';
                        const text = msg.content || msg.message || '';
                        const isPhoto = msg.type === 'photo';
                        const isVideo = msg.type === 'video';
                        const timeStr = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                        // PROMOTION CARD
                        if (text.startsWith('PROMOTION_CARD::')) {
                            try {
                                const d = JSON.parse(text.replace('PROMOTION_CARD::', ''));
                                return (
                                    <div key={msg.id || i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0' }}>
                                        <div style={{ width: '85%', maxWidth: 300, borderRadius: 16, overflow: 'hidden', background: 'linear-gradient(170deg,#0e0b06 0%,#110d04 60%,#0a0703 100%)', border: '1px solid rgba(197,160,89,0.5)', boxShadow: '0 12px 40px rgba(0,0,0,0.8)' }}>
                                            <div style={{ position: 'relative', width: '100%', height: 130, background: '#0a0703', overflow: 'hidden' }}>
                                                {d.photo && <img src={d.photo} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt="" />}
                                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,transparent 40%,#0e0b06 100%)' }} />
                                                <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', background: 'rgba(10,7,2,0.9)', border: '1px solid rgba(197,160,89,0.5)', borderRadius: 20, padding: '4px 14px', whiteSpace: 'nowrap' }}>
                                                    <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.42rem', color: '#c5a059', letterSpacing: 3, textTransform: 'uppercase' }}>✦ RANK PROMOTION</span>
                                                </div>
                                            </div>
                                            <div style={{ padding: '14px 18px 18px', textAlign: 'center' }}>
                                                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.95rem', color: '#fff', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>{d.name || ''}</div>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
                                                    <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.48rem', color: 'rgba(197,160,89,0.4)', letterSpacing: 1, textDecoration: 'line-through' }}>{(d.oldRank || '').toUpperCase()}</span>
                                                    <span style={{ color: 'rgba(197,160,89,0.7)', fontSize: '0.9rem' }}>→</span>
                                                    <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.55rem', color: '#c5a059', letterSpacing: 2, fontWeight: 700 }}>{(d.newRank || '').toUpperCase()}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.34rem', color: 'rgba(197,160,89,0.45)', marginTop: 4, letterSpacing: '0.8px' }}>{timeStr}</div>
                                    </div>
                                );
                            } catch { /* fall through */ }
                        }

                        // TASK FEEDBACK CARD
                        if (text.startsWith('TASK_FEEDBACK::')) {
                            try {
                                const data = JSON.parse(text.replace('TASK_FEEDBACK::', ''));
                                const { mediaUrl: fbMedia, mediaType: fbType, note: fbNote } = data;
                                const fbIsVideo = (fbType && (fbType === 'video' || fbType.startsWith('video/'))) || (fbMedia && /\.(mp4|mov|webm)/i.test(fbMedia));
                                return (
                                    <div key={msg.id || i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0' }}>
                                        <div style={{ width: '85%', maxWidth: 280, borderRadius: 12, overflow: 'hidden', background: '#0a080a', border: '1px solid rgba(197,160,89,0.4)', boxShadow: '0 6px 24px rgba(0,0,0,0.6)' }}>
                                            {fbMedia && (
                                                fbIsVideo
                                                    ? <video src={fbMedia} controls playsInline style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block', borderRadius: '10px 10px 0 0' }} />
                                                    : <img src={fbMedia} style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block', borderRadius: '10px 10px 0 0' }} alt="" />
                                            )}
                                            <div style={{ padding: '9px 12px 11px' }}>
                                                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.42rem', color: 'rgba(197,160,89,0.6)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 5 }}>✦ Task Feedback</div>
                                                {fbNote && <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.82)', lineHeight: 1.4 }}>{fbNote}</div>}
                                            </div>
                                        </div>
                                        <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.34rem', color: 'rgba(197,160,89,0.45)', marginTop: 4, letterSpacing: '0.8px' }}>{timeStr}</div>
                                    </div>
                                );
                            } catch { /* fall through */ }
                        }

                        return (
                            <div key={msg.id || i} style={{ display: 'flex', flexDirection: 'column', alignItems: isAdmin ? 'flex-end' : 'flex-start' }}>
                                <div style={{
                                    background: isAdmin ? '#000' : '#1c1c1e',
                                    color: '#fff',
                                    padding: (isPhoto || isVideo) ? '4px' : '10px 14px',
                                    borderRadius: isAdmin ? '16px 16px 3px 16px' : '16px 16px 16px 3px',
                                    maxWidth: '78%',
                                    fontSize: '0.95rem',
                                    lineHeight: 1.55,
                                    fontFamily: 'Cinzel,serif',
                                    letterSpacing: '0.2px',
                                    wordBreak: 'break-word',
                                    boxShadow: isAdmin ? '0 0 0 1px rgba(197,160,89,0.6)' : undefined,
                                    border: isAdmin ? undefined : '1px solid rgba(255,255,255,0.06)',
                                }}>
                                    {isPhoto
                                        ? <img src={text} style={{ display: 'block', maxWidth: 220, maxHeight: 220, borderRadius: 10, objectFit: 'cover' }} alt="" />
                                        : isVideo
                                            ? <video src={text} controls playsInline style={{ display: 'block', maxWidth: 220, borderRadius: 10 }} />
                                            : <span>{text}</span>
                                    }
                                </div>
                                <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.34rem', color: isAdmin ? '#444' : 'rgba(197,160,89,0.45)', marginTop: 3, letterSpacing: '0.8px' }}>
                                    {timeStr}
                                </div>
                            </div>
                        );
                    })}
                    <div ref={bottomRef} />
                </div>
            )}

            {/* ── SERVICE TAB ── */}
            {chatTab === 'service' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, WebkitOverflowScrolling: 'touch' as any }}>
                    {sysMsgs.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'Orbitron,monospace', fontSize: '0.48rem', color: '#222', letterSpacing: '2px' }}>NO SERVICE MESSAGES</div>
                    )}
                    {sysMsgs.map((msg, i) => {
                        const d = new Date(msg.created_at || Date.now());
                        const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
                        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const content = msg.content || msg.message || '';
                        return (
                            <div key={msg.id || i} style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)', borderLeft: '2px solid #c5a059', padding: '9px 14px', borderRadius: '0 6px 6px 0' }}>
                                <span style={{ fontFamily: 'Cinzel,serif', color: '#c5a059', fontSize: '0.82rem', lineHeight: 1.5 }}>{content}</span>
                                <span style={{ fontFamily: 'Orbitron,monospace', color: 'rgba(255,255,255,0.25)', fontSize: '0.55rem', marginTop: 5, letterSpacing: '1px' }}>{dateStr} · {timeStr}</span>
                            </div>
                        );
                    })}
                </div>
            )}

            {sendError && (
                <div style={{ padding: '6px 14px', background: 'rgba(255,0,0,0.1)', color: '#ff6666', fontFamily: 'Orbitron,monospace', fontSize: '0.42rem', letterSpacing: '1px', textAlign: 'center' }}>
                    {sendError}
                </div>
            )}

            {/* Input — only visible on CHAT tab; 16px prevents iOS zoom */}
            {chatTab === 'chat' && (
                <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: '1px solid rgba(197,160,89,0.1)', flexShrink: 0, background: 'rgba(4,4,4,0.98)' }}>
                    <input
                        type="text"
                        value={input}
                        onChange={e => { setInput(e.target.value); setSendError(''); }}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendMessage(); } }}
                        placeholder="Issue command..."
                        autoComplete="off"
                        style={{ flex: 1, background: 'rgba(14,14,14,0.95)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 8, color: '#fff', padding: '10px 14px', fontFamily: 'Rajdhani,sans-serif', fontSize: '16px', outline: 'none' }}
                    />
                    <button
                        onTouchEnd={e => { e.preventDefault(); sendMessage(); }}
                        onClick={sendMessage}
                        style={{ background: canSend ? '#c5a059' : '#111', border: '1px solid rgba(197,160,89,0.3)', borderRadius: 8, color: canSend ? '#000' : '#333', fontFamily: 'Orbitron,monospace', fontSize: '0.55rem', letterSpacing: '1px', padding: '10px 16px', cursor: canSend ? 'pointer' : 'default', flexShrink: 0, fontWeight: 700, WebkitTapHighlightColor: 'transparent' }}>
                        {sending ? '...' : 'SEND'}
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── POSTS VIEW ──────────────────────────────────────────────────────────────
function PostsView({ posts, title, setTitle, body, setBody, submitting, onSubmit }: {
    posts: any[]; title: string; setTitle: (s: string) => void; body: string; setBody: (s: string) => void; submitting: boolean; onSubmit: () => void;
}) {
    return (
        <div style={S.scroll}>
            <div style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 12, padding: '18px', display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }}>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.75rem', color: '#c5a059', letterSpacing: '4px', marginBottom: 4 }}>QUEEN'S DISPATCH</div>
                <input type="text" placeholder="Title (optional)" value={title} onChange={e => setTitle(e.target.value)}
                    style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(197,160,89,0.1)', borderRadius: 6, color: '#fff', fontFamily: 'Rajdhani,sans-serif', fontSize: '0.95rem', padding: '10px 14px', outline: 'none', width: '100%', letterSpacing: '0.5px' }} />
                <textarea placeholder="Write your decree..." value={body} onChange={e => setBody(e.target.value)} rows={4}
                    style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(197,160,89,0.1)', borderRadius: 6, color: '#fff', fontFamily: 'Rajdhani,sans-serif', fontSize: '0.95rem', padding: '10px 14px', outline: 'none', resize: 'none', lineHeight: 1.6, width: '100%' }} />
                <button onClick={onSubmit} disabled={submitting || !body.trim()}
                    style={{ background: submitting || !body.trim() ? '#222' : '#c5a059', color: submitting || !body.trim() ? '#444' : '#000', border: 'none', borderRadius: 6, fontFamily: 'Cinzel,serif', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '3px', padding: '14px', cursor: 'pointer', width: '100%' }}>
                    {submitting ? 'PUBLISHING...' : 'PUBLISH DECREE'}
                </button>
            </div>

            {posts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'Orbitron,monospace', fontSize: '0.52rem', color: '#2a2a2a', letterSpacing: '2px' }}>NO POSTS YET</div>
            ) : posts.map((post: any) => (
                <div key={post.id} style={{ background: 'rgba(12,12,12,0.9)', border: '1px solid rgba(197,160,89,0.08)', borderRadius: 10, padding: '16px' }}>
                    {post.title && <div style={{ fontFamily: 'Cinzel,serif', fontSize: '1rem', color: '#c5a059', marginBottom: 8 }}>{post.title}</div>}
                    <div style={{ fontSize: '0.9rem', color: '#bbb', lineHeight: 1.7, letterSpacing: '0.3px' }}>{post.body}</div>
                    {post.media_url && <img src={post.media_url} style={{ width: '100%', borderRadius: 8, marginTop: 10, objectFit: 'cover', maxHeight: 220 }} alt="" />}
                    <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.4rem', color: '#333', letterSpacing: '1.5px', marginTop: 12 }}>
                        {post.created_at ? new Date(post.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── QUEEN VIEW ──────────────────────────────────────────────────────────────
function QueenView({ userEmail, onLogout, users, stats }: { userEmail: string; onLogout: () => void; users: DashUser[]; stats: any }) {
    return (
        <div style={S.scroll}>
            <div style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.2)', borderRadius: 12, padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <img src="/queen-karin.png" style={{ width: 90, height: 90, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(197,160,89,0.4)', boxShadow: '0 0 40px rgba(197,160,89,0.15)' }} onError={(e) => { (e.target as any).src = '/queen-karin.png'; }} alt="" />
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '1.4rem', color: '#c5a059', letterSpacing: '4px', marginTop: 4 }}>QUEEN KARIN</div>
                <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.48rem', color: '#555', letterSpacing: '3px' }}>SYSTEM ADMINISTRATOR</div>
                <div style={{ fontSize: '0.72rem', color: '#333', letterSpacing: '1px' }}>{userEmail}</div>
            </div>

            <div style={S.card}>
                <div style={S.cardTitle}>SYSTEM OVERVIEW</div>
                {[
                    { label: 'Total Subjects', val: stats.active },
                    { label: 'Pending Reviews', val: stats.pending },
                    { label: 'Total Kneel Time', val: `${stats.kneelMins} min` },
                    { label: 'Merit Pool', val: stats.totalMerit.toLocaleString() },
                ].map((item, i) => (
                    <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.48rem', color: '#555', letterSpacing: '1px' }}>{item.label}</span>
                        <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.8rem', color: '#c5a059', fontWeight: 700 }}>{item.val}</span>
                    </div>
                ))}
            </div>

            <div style={S.card}>
                <div style={S.cardTitle}>NAVIGATE</div>
                <button onClick={() => window.location.href = '/global'} style={{ display: 'block', width: '100%', background: 'rgba(197,160,89,0.05)', border: '1px solid rgba(197,160,89,0.2)', color: '#c5a059', fontFamily: 'Cinzel,serif', fontSize: '0.75rem', letterSpacing: '3px', padding: '14px', cursor: 'pointer', borderRadius: 8, textAlign: 'center', marginBottom: 10 }}>
                    GLOBAL HUB ↗
                </button>
                <button onClick={() => window.location.href = '/profile'} style={{ display: 'block', width: '100%', background: 'rgba(197,160,89,0.03)', border: '1px solid rgba(197,160,89,0.12)', color: '#888', fontFamily: 'Cinzel,serif', fontSize: '0.75rem', letterSpacing: '3px', padding: '14px', cursor: 'pointer', borderRadius: 8, textAlign: 'center' }}>
                    SLAVE RECORDS ↗
                </button>
            </div>

            <button onClick={onLogout} style={{ background: 'rgba(255,0,0,0.06)', border: '1px solid rgba(255,0,0,0.2)', color: '#ff4444', fontFamily: 'Orbitron,monospace', fontSize: '0.58rem', letterSpacing: '3px', padding: '16px', cursor: 'pointer', borderRadius: 8, width: '100%', flexShrink: 0 }}>
                LOG OUT
            </button>
        </div>
    );
}

// ─── SHARED STYLES ───────────────────────────────────────────────────────────
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
    scroll: { height: '100%', overflowY: 'auto', overflowX: 'hidden', padding: '14px 12px 20px', display: 'flex', flexDirection: 'column', gap: 12, WebkitOverflowScrolling: 'touch' as any },
    heroCard: { background: "linear-gradient(135deg, rgba(197,160,89,0.08) 0%, rgba(8,6,2,0.95) 100%), url('/hero-bg.png') center/cover", border: '1px solid rgba(197,160,89,0.2)', borderRadius: 12, padding: '22px 20px', flexShrink: 0 },
    statCard: { background: 'rgba(14,14,14,0.95)', border: '1px solid rgba(197,160,89,0.07)', borderRadius: 10, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 6 },
    card: { background: 'rgba(11,11,11,0.95)', border: '1px solid rgba(197,160,89,0.08)', borderRadius: 10, padding: '16px 14px', flexShrink: 0 },
    cardTitle: { fontFamily: 'Cinzel,serif', fontSize: '0.62rem', color: '#c5a059', letterSpacing: '3px', marginBottom: 12, opacity: 0.8 },
    userCard: { display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(11,11,11,0.95)', border: '1px solid rgba(197,160,89,0.07)', borderRadius: 10, padding: '12px 14px', width: '100%', cursor: 'pointer', textAlign: 'left', WebkitTapHighlightColor: 'transparent', outline: 'none', flexShrink: 0 },
};
