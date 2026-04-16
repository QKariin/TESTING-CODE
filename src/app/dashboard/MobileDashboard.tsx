'use client';

import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
    getAdminDashboardData, getUnreadMessageStatus,
    adminApproveTaskAction, adminRejectTaskAction, adminAssignTaskAction,
    processCoinTransaction, updateScoreAction, setHierarchyAction, insertMessage,
} from '@/actions/velo-actions';

type Tab = 'home' | 'subjects' | 'posts' | 'challenges' | 'queen';

// Convert any Supabase storage URL (signed or public) to a permanent public URL.
// The 'media' bucket is public — chat images load this way, proofs should too.
// Signed URLs expire after 7 days and can't always be re-signed; public URLs never expire.
function toPublicUrl(url: string): string {
    if (!url || !url.includes('supabase.co')) return url;
    const m = url.match(/(https?:\/\/[^/]+\/storage\/v1\/object\/)(?:public|sign)\/([^/?]+)\/([^?]+)/);
    if (!m) return url;
    return `${m[1]}public/${m[2]}/${m[3]}`;
}

// Batch-sign proof URLs from task queue items so private storage files render correctly.
async function signQueueItems(queue: any[]): Promise<any[]> {
    if (!queue.length) return queue;
    const rawUrls: string[] = [];
    const indices: Array<{ item: any; field: string }> = [];
    for (const item of queue) {
        const proof = item.proofUrl || item.proof_url;
        if (proof) { rawUrls.push(proof); indices.push({ item, field: item.proofUrl !== undefined ? 'proofUrl' : 'proof_url' }); }
        const thumb = item.thumbnail_url || item.thumbnailUrl;
        if (thumb) { rawUrls.push(thumb); indices.push({ item, field: item.thumbnail_url !== undefined ? 'thumbnail_url' : 'thumbnailUrl' }); }
    }
    if (!rawUrls.length) return queue;
    try {
        const res = await fetch('/api/sign-urls', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ urls: rawUrls }) });
        const data = await res.json();
        if (Array.isArray(data.urls)) {
            data.urls.forEach((url: string, i: number) => { if (url && indices[i]) indices[i].item[indices[i].field] = url; });
        }
    } catch { /* non-critical */ }
    return queue;
}

async function sendTaskChatFeedback(senderEmail: string, memberId: string, mediaUrl: string | null, mediaType: string | null, note: string, taskId: string | null) {
    try {
        const payload = JSON.stringify({ mediaUrl, mediaType, note, taskId, memberId });
        await fetch('/api/chat/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senderEmail, conversationId: memberId, content: 'TASK_FEEDBACK::' + payload, type: 'text' }),
        });
    } catch (e) {
        console.error('[sendTaskChatFeedback]', e);
    }
}
type ProfileTab = 'info' | 'tasks' | 'chat' | 'controls';

const RANKS = ["Hall Boy", "Footman", "Silverman", "Butler", "Chamberlain", "Secretary", "Queen's Champion"];

const PAYWALL_PRESETS = [
    "Monthly tribute not received. Pay now.",
    "Punishment — pay for your attitude.",
    "Outstanding debt. You know what you did.",
    "You've been a disappointment. Pay your dues.",
    "Access suspended. Tribute required immediately.",
];

const SILENCE_PRESETS = [
    "You are silenced until further notice.",
    "Disrespect has consequences. Speak when spoken to.",
    "Your access has been revoked.",
    "You crossed a line. Enjoy the silence.",
    "Punishment in effect. No exceptions.",
];

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
    // Root-level review modal - rendered after nav so it's always on top
    const [rootReviewTask, setRootReviewTask] = useState<any | null>(null);
    const [rootReviewing, setRootReviewing] = useState<string | null>(null);
    const onlineJoinTimeRef = useRef<Record<string, number>>({});
    const prevOnlineStateRef = useRef<Record<string, boolean>>({});
    const pendingReadIdRef = useRef<string | null>(null);
    const fetchedFullRef = useRef<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            const [listRes, unread] = await Promise.all([
                fetch('/api/dashboard-list').then(r => r.json()),
                getUnreadMessageStatus(),
            ]);
            setUnreadMap(unread);
            // Sync server-side read timestamps to localStorage (cross-device read state).
            // Desktop writes admin_chat_read via /api/chat/mark-read; mobile reads it here
            // so reads done on desktop are reflected on mobile and vice-versa.
            try {
                const readRes = await fetch('/api/chat/mark-read?type=admin');
                const readData = await readRes.json();
                const serverReadMap: Record<string, string> = readData.chatRead || {};
                Object.entries(serverReadMap).forEach(([email, ts]) => {
                    const key = 'read_' + email.toLowerCase();
                    const localTs = parseInt(localStorage.getItem(key) || '0');
                    const serverTs = new Date(ts).getTime();
                    if (serverTs > localTs) localStorage.setItem(key, serverTs.toString());
                });
            } catch { /* non-critical */ }
            if (listRes.success && listRes.users) {
                // Sign proof URLs in per-user review queues
                await Promise.all((listRes.users as any[]).map((u: any) => u.reviewQueue?.length ? signQueueItems(u.reviewQueue) : Promise.resolve()));
                const mapped: DashUser[] = listRes.users.map((u: any) => ({
                    memberId: u.memberId || '',
                    name: u.name || '',
                    avatar: u.avatar || '/collar-placeholder.png',
                    rank: u.hierarchy || 'Hall Boy',
                    wallet: 0,
                    score: 0,
                    parameters: {
                        paywall: u.paywall ? { active: true } : undefined,
                        silence: u.silence ? { active: true } : undefined,
                    },
                    reviewQueue: u.reviewQueue || [],
                    lastMessageTime: unread[(u.memberId || '').toLowerCase()] || null,
                    lastSeen: u.lastSeen || null,
                    hasActiveTask: !!u.activeTask,
                }));
                setUsers(mapped);
            }
            // Global review queue for home screen — sign all proof URLs before setting state
            if (listRes.pendingReviews) {
                const signedQueue = await signQueueItems(listRes.pendingReviews);
                setGlobalQueue(signedQueue);
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

    // Realtime: reload sidebar list when a new chat arrives or a profile changes
    useEffect(() => {
        const supabase = createClient();
        const ch = supabase
            .channel('mob-dash-live')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chats' }, () => loadData())
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => loadData())
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [loadData]);
    useEffect(() => { if (tab === 'posts') loadPosts(); }, [tab, loadPosts]);

    // Fetch full profile data (wallet, score, routine, paywall detail, silence detail)
    // when a user is opened — avoids stale 0 values from the lightweight list
    useEffect(() => {
        if (!selectedUser) { fetchedFullRef.current = null; return; }
        if (fetchedFullRef.current === selectedUser.memberId) return;
        fetchedFullRef.current = selectedUser.memberId;
        let cancelled = false;
        fetch(`/api/slave-profile?email=${encodeURIComponent(selectedUser.memberId)}&full=true`)
            .then(r => r.json())
            .then((data: any) => {
                if (cancelled || !data || data.error) return;
                setSelectedUser(prev => {
                    if (!prev || prev.memberId !== selectedUser.memberId) return prev;
                    return {
                        ...prev,
                        wallet: typeof data.wallet === 'number' ? data.wallet : prev.wallet,
                        score: typeof data.score === 'number' ? data.score : (typeof data.points === 'number' ? data.points : prev.score),
                        parameters: {
                            ...prev.parameters,
                            ...data.parameters,
                            paywall: data.parameters?.paywall,
                            silence: data.parameters?.silence,
                            kinks: data.kinks || data.parameters?.kinks || '',
                            limits: data.limits || data.parameters?.limits || '',
                            devotion: data.parameters?.devotion,
                            totalKneelMinutes: data.parameters?.totalKneelMinutes,
                            kneelCount: data.kneelCount,
                            routine: data.routine || data.parameters?.routine || '',
                        },
                    };
                });
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [selectedUser?.memberId]);

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
            const key = u.memberId.toLowerCase();
            const newKey = 'read_' + key;
            if (!localStorage.getItem(newKey)) {
                const oldVal = localStorage.getItem('chat_read_' + key) || localStorage.getItem('chat_read_' + u.memberId);
                if (oldVal) { const ms = new Date(oldVal).getTime(); if (!isNaN(ms)) localStorage.setItem(newKey, ms.toString()); }
            }
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [users.length > 0]);

    const markPendingRead = useCallback(() => {
        const id = pendingReadIdRef.current;
        if (id) { localStorage.setItem('read_' + id.toLowerCase(), Date.now().toString()); pendingReadIdRef.current = null; }
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
        const key = u.memberId.toLowerCase();
        const lastSlaveMsg = unreadMap[key];
        if (!lastSlaveMsg) return false;
        const lastRead = typeof window !== 'undefined' ? localStorage.getItem('read_' + key) : null;
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
                @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;500;700&display=swap');
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

            {/* ADD TO HOME SCREEN BANNER - shown when in browser (not PWA) */}
            {typeof window !== 'undefined' && !window.matchMedia('(display-mode: standalone)').matches && !(navigator as any).standalone && (
                <div style={{ background: 'rgba(197,160,89,0.12)', borderBottom: '1px solid rgba(197,160,89,0.3)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>📲</span>
                    <span style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.82rem', color: '#c5a059', flex: 1 }}>
                        Tap <b>Share →</b> then <b>"Add to Home Screen"</b> for fullscreen mode
                    </span>
                </div>
            )}

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
                        onBack={() => { markPendingRead(); setSelectedUser(null); setProfileTab('chat'); loadData(); }}
                        adminEmail={userEmail}
                        onReviewed={() => loadData()}
                        onOpenReview={(task) => {
                            // iOS proxy trick: focus a hidden input synchronously within the gesture
                            // so iOS shows the keyboard; modal's useEffect transfers focus to textarea
                            const proxy = document.createElement('input');
                            proxy.type = 'text';
                            proxy.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;top:0;left:0;';
                            document.body.appendChild(proxy);
                            proxy.focus();
                            (window as any).__reviewFocusProxy = proxy;
                            setRootReviewTask(task);
                        }}
                        onUserUpdated={(updated) => {
                            setSelectedUser(updated);
                            setUsers(prev => prev.map(u => u.memberId === updated.memberId ? updated : u));
                        }}
                    />
                ) : tab === 'home' ? (
                    <HomeView users={users} globalQueue={globalQueue} dailyCode={dailyCode} challenges={challenges}
                        stats={stats}
                        onSelectUser={(u) => { setSelectedUser(u); setProfileTab('tasks'); }}
                        onRefresh={loadData}
                        onOpenReview={(task) => {
                            const proxy = document.createElement('input');
                            proxy.type = 'text';
                            proxy.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;top:0;left:0;';
                            document.body.appendChild(proxy);
                            proxy.focus();
                            (window as any).__reviewFocusProxy = proxy;
                            setRootReviewTask(task);
                        }}
                        onGoToReviews={() => setTab('home')} />
                ) : tab === 'subjects' ? (
                    <SubjectsView
                        users={filtered} allCount={users.length}
                        search={search} setSearch={setSearch}
                        unreadMap={unreadMap} onlineJoinTime={onlineJoinTimeRef.current}
                        onSelect={(u) => {
                            markPendingRead();
                            // Mark as read immediately on open — any new messages that
                            // arrive while in chat will be caught when we navigate away
                            const key = u.memberId.toLowerCase();
                            localStorage.setItem('read_' + key, Date.now().toString());
                            pendingReadIdRef.current = key; // also set pending so back nav refreshes
                            setSelectedUser(u); setProfileTab('chat');
                        }}
                        onMarkAllRead={() => {
                            const now = Date.now();
                            users.forEach(u => {
                                const key = u.memberId.toLowerCase();
                                localStorage.setItem('read_' + key, now.toString());
                                fetch('/api/chat/mark-read', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ role: 'admin', slaveEmail: u.memberId, timestamp: new Date(now).toISOString() }),
                                }).catch(() => {});
                            });
                            // Force re-render by clearing unread map (will be repopulated on next poll)
                            setUnreadMap(prev => ({ ...prev }));
                        }}
                    />
                ) : tab === 'posts' ? (
                    <PostsView posts={posts} onPostCreated={loadPosts} userEmail={userEmail} />
                ) : tab === 'challenges' ? (
                    <ChallengesView />
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
                        { key: 'challenges' as Tab, icon: '⚔', label: 'WAR', badge: undefined as number | undefined, bc: '#c5a059' },
                        { key: 'queen' as Tab, icon: '♛', label: 'QUEEN', badge: undefined as number | undefined, bc: '#c5a059' },
                    ]).map(({ key, icon, label, badge, bc }) => (
                        <button key={key} style={{ ...S.navBtn, ...(tab === key ? S.navActive : {}) }} onClick={() => setTab(key)}>
                            <div style={{ position: 'relative' }}>
                                <span style={{ fontSize: '1.3rem', lineHeight: 1, color: tab === key ? '#c5a059' : '#2e2e2e' }}>{icon}</span>
                                {badge !== undefined && (
                                    <div style={{ position: 'absolute', top: -4, right: -8, minWidth: 14, height: 14, background: bc, borderRadius: 7, fontSize: '0.88rem', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Orbitron,monospace', fontWeight: 700, padding: '0 3px' }}>{badge}</div>
                                )}
                            </div>
                            <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.68rem', letterSpacing: '1.5px', color: tab === key ? '#c5a059' : '#2e2e2e', textTransform: 'uppercase' }}>{label}</span>
                        </button>
                    ))}
                </nav>
            )}

            {/* ROOT-LEVEL TASK REVIEW MODAL - rendered after nav, always on top */}
            {rootReviewTask && (() => {
                const rt = rootReviewTask;
                const rtMid = (rt.member_id || '').toLowerCase();
                const rtUser = users.find(u => u.memberId.toLowerCase() === rtMid);
                const rtProof = rt.proofUrl || rt.proof_url;
                const rtVideo = !!(rtProof && ((rt.proofType && (rt.proofType === 'video' || rt.proofType.startsWith('video/'))) || /\.(mp4|mov|webm|ogg)(\?|$)/i.test(rtProof)));
                const rtText = stripHtml(rt.taskName || rt.task_name || rt.text || 'Task');
                const rtRoutine = !!(rt.isRoutine || rt.category === 'Routine' || rt.text === 'Daily Routine');
                const rtBusy = rootReviewing === (rt.id || rt.taskId || rt.text);
                const handleApprove = async (tier: number, note: string) => {
                    if (!rtUser) return;
                    const taskId = rt.id || rt.taskId;
                    setRootReviewing(taskId || rt.text);
                    try {
                        await adminApproveTaskAction(taskId, rtUser.memberId, tier, note || null);
                        if (note?.trim()) {
                            await sendTaskChatFeedback(userEmail, rtUser.memberId, rtProof || null, rtVideo ? 'video' : rtProof ? 'image' : null, note.trim(), taskId || null);
                        }
                        setRootReviewTask(null);
                        setGlobalQueue(q => q.filter(t => {
                            const tText = (t.taskName || t.task_name || t.text || '').slice(0, 80);
                            const rText = (rt.taskName || rt.task_name || rt.text || '').slice(0, 80);
                            return !((t.member_id || '').toLowerCase() === rtMid && tText === rText);
                        }));
                        loadData();
                    } catch (e) { console.error(e); }
                    setRootReviewing(null);
                };
                const handleReject = async (note: string) => {
                    if (!rtUser) return;
                    const taskId = rt.id || rt.taskId;
                    setRootReviewing(taskId || rt.text);
                    try {
                        await adminRejectTaskAction(taskId, rtUser.memberId);
                        if (note?.trim()) {
                            await sendTaskChatFeedback(userEmail, rtUser.memberId, rtProof || null, rtVideo ? 'video' : rtProof ? 'image' : null, note.trim(), taskId || null);
                        }
                        setRootReviewTask(null);
                        setGlobalQueue(q => q.filter(t => {
                            const tText = (t.taskName || t.task_name || t.text || '').slice(0, 80);
                            const rText = (rt.taskName || rt.task_name || rt.text || '').slice(0, 80);
                            return !((t.member_id || '').toLowerCase() === rtMid && tText === rText);
                        }));
                        loadData();
                    } catch (e) { console.error(e); }
                    setRootReviewing(null);
                };
                return (
                    <TaskReviewModal
                        proofUrl={rtProof}
                        isVideo={rtVideo}
                        name={rt.memberName || rtUser?.name || 'Unknown'}
                        avatar={rt.avatarUrl || rtUser?.avatar || '/collar-placeholder.png'}
                        rank={rtUser?.rank}
                        text={rtText}
                        isRoutine={rtRoutine}
                        busy={rtBusy}
                        onClose={() => setRootReviewTask(null)}
                        onApprove={handleApprove}
                        onReject={handleReject}
                    />
                );
            })()}
        </div>
    );
}

// ─── HOME VIEW ───────────────────────────────────────────────────────────────
function dedupeQueue(queue: any[]): any[] {
    const seen = new Set<string>();
    return queue.filter(t => {
        // Dedupe by member + task text to collapse repeated submissions of same task
        const text = (t.taskName || t.task_name || t.text || '').slice(0, 80);
        const key = `${(t.member_id || '').toLowerCase()}|${text}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function stripHtml(s: string): string {
    return (s || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function HomeView({ users, globalQueue, dailyCode, challenges, stats, onSelectUser, onRefresh, onOpenReview, onGoToReviews }: {
    users: DashUser[]; globalQueue: any[]; dailyCode: string; challenges: any[];
    stats: { active: number; online: number; pending: number; kneelMins: number; totalMerit: number };
    onSelectUser: (u: DashUser) => void; onRefresh?: () => void;
    onOpenReview: (task: any) => void; onGoToReviews: () => void;
}) {
    const [taskQueue, setTaskQueue] = useState<any[]>(() => dedupeQueue(globalQueue));
    const [reviewing, setReviewing] = useState<string | null>(null);
    const [reviewsExpanded, setReviewsExpanded] = useState(() => dedupeQueue(globalQueue).length > 0);

    useEffect(() => {
        const q = dedupeQueue(globalQueue);
        setTaskQueue(q);
        if (q.length > 0) setReviewsExpanded(true);
    }, [globalQueue]);

    const activeChallenge = challenges.find(c => c.status === 'active');
    const onlineUsers = users.filter(u => getOnlineStatus(u.lastSeen) === 'online');

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'GOOD MORNING' : hour < 18 ? 'GOOD AFTERNOON' : 'GOOD EVENING';

    const getUserForTask = (task: any) => {
        const mid = (task.member_id || task.ownerId || '').toLowerCase();
        return users.find(u => u.memberId.toLowerCase() === mid);
    };
    const isRoutineTask = (task: any) => !!(task.isRoutine || task.category === 'Routine' || task.text === 'Daily Routine');

    const handleApprove = async (task: any, tier = 50, note = '') => {
        const taskId = task.id || task.taskId;
        const user = getUserForTask(task);
        if (!user) return;
        setReviewing(taskId);
        try {
            await adminApproveTaskAction(taskId, user.memberId, tier, note || null);
            setTaskQueue(q => q.filter(t => {
                const tText = (t.taskName || t.task_name || t.text || '').slice(0, 80);
                const rText = (task.taskName || task.task_name || task.text || '').slice(0, 80);
                return !((t.member_id || '').toLowerCase() === (task.member_id || '').toLowerCase() && tText === rText);
            }));
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
            setTaskQueue(q => q.filter(t => {
                const tText = (t.taskName || t.task_name || t.text || '').slice(0, 80);
                const rText = (task.taskName || task.task_name || task.text || '').slice(0, 80);
                return !((t.member_id || '').toLowerCase() === (task.member_id || '').toLowerCase() && tText === rText);
            }));
            onRefresh?.();
        } catch (e) { console.error(e); }
        setReviewing(null);
    };

    return (
        <div style={S.scroll}>

            {/* ── HERO: Queen portrait + greeting ── */}
            <div style={{ background: 'linear-gradient(160deg, rgba(197,160,89,0.1) 0%, rgba(140,100,20,0.04) 40%, rgba(0,0,0,0) 100%)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 18, padding: '24px 20px 20px', display: 'flex', alignItems: 'center', gap: 18, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                {/* Subtle ambient glow behind avatar */}
                <div style={{ position: 'absolute', top: -20, left: -20, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(197,160,89,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
                <div style={{ position: 'relative', flexShrink: 0 }}>
                    <img src="/queen-karin.png" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(197,160,89,0.4)', boxShadow: '0 0 24px rgba(197,160,89,0.18), 0 0 6px rgba(197,160,89,0.08)', display: 'block' }} alt="" />
                    <div style={{ position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: '50%', background: '#4ade80', border: '2px solid #030303', boxShadow: '0 0 6px #4ade80' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.62rem', color: 'rgba(197,160,89,0.45)', letterSpacing: '3px', marginBottom: 4 }}>{greeting}</div>
                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '1.3rem', color: '#c5a059', fontWeight: 700, letterSpacing: '3px', lineHeight: 1.1 }}>QUEEN KARIN</div>
                    <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.64rem', color: '#333', letterSpacing: '2px', marginTop: 5 }}>COMMAND CENTER</div>
                </div>
                {/* Daily code - tucked top-right */}
                <div style={{ flexShrink: 0, textAlign: 'center' }}>
                    <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.60rem', color: '#2e2e2e', letterSpacing: '2px', marginBottom: 3 }}>TODAY</div>
                    <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '1.25rem', fontWeight: 900, color: '#c5a059', letterSpacing: '5px', textShadow: '0 0 14px rgba(197,160,89,0.25)' }}>{dailyCode}</div>
                </div>
            </div>

            {/* ── STATS ROW ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, flexShrink: 0 }}>
                {[
                    { val: stats.online, label: 'ONLINE', color: '#4ade80', glow: 'rgba(74,222,128,0.15)' },
                    { val: stats.active, label: 'SUBJECTS', color: '#c5a059', glow: 'rgba(197,160,89,0.1)' },
                    { val: taskQueue.length, label: 'REVIEW', color: taskQueue.length > 0 ? '#ff8c42' : '#333', glow: taskQueue.length > 0 ? 'rgba(255,140,66,0.1)' : 'transparent' },
                    { val: stats.totalMerit.toLocaleString(), label: 'MERIT', color: '#a78bfa', glow: 'rgba(167,139,250,0.08)' },
                ].map(s => (
                    <div key={s.label} style={{ background: `linear-gradient(135deg, ${s.glow}, rgba(0,0,0,0.6))`, border: `1px solid ${s.color}18`, borderRadius: 10, padding: '11px 8px', textAlign: 'center' }}>
                        <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '1.05rem', fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.val}</div>
                        <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.60rem', color: '#333', letterSpacing: '1.5px', marginTop: 4 }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* ── ONLINE subjects strip ── */}
            {onlineUsers.length > 0 && (
                <div style={{ flexShrink: 0 }}>
                    <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.62rem', color: '#2a2a2a', letterSpacing: '2px', marginBottom: 8 }}>● ONLINE NOW</div>
                    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 2, WebkitOverflowScrolling: 'touch' as any }}>
                        {onlineUsers.map(u => (
                            <button key={u.memberId} onClick={() => onSelectUser(u)}
                                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: '2px 0', WebkitTapHighlightColor: 'transparent' }}>
                                <div style={{ position: 'relative' }}>
                                    <img src={u.avatar} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(74,222,128,0.4)', display: 'block' }} onError={(e) => { (e.target as any).src = '/collar-placeholder.png'; }} alt="" />
                                    <div style={{ position: 'absolute', bottom: 1, right: 1, width: 9, height: 9, background: '#4ade80', borderRadius: '50%', border: '2px solid #030303', boxShadow: '0 0 4px #4ade80' }} />
                                </div>
                                <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.94rem', color: '#888', maxWidth: 44, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name.split(' ')[0]}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── ACTIVE CHALLENGE widget ── */}
            {activeChallenge && (
                <div style={{ background: 'linear-gradient(135deg, rgba(197,160,89,0.07), rgba(0,0,0,0.5))', border: '1px solid rgba(197,160,89,0.2)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                    {activeChallenge.image_url && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${activeChallenge.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.07 }} />}
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(197,160,89,0.1)', color: '#c5a059', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0, border: '1px solid rgba(197,160,89,0.2)' }}>⚔</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#c5a059', boxShadow: '0 0 6px #c5a059', animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
                                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.94rem', color: '#c5a059', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeChallenge.name}</div>
                            </div>
                            <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.62rem', color: '#444', letterSpacing: '1px', marginTop: 2 }}>LIVE · {activeChallenge.participant_active ?? '-'} ACTIVE · {activeChallenge.participant_total ?? '-'} TOTAL</div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── PENDING REVIEWS ── */}
            {taskQueue.length > 0 ? (
                <div style={{ flexShrink: 0 }}>
                    {/* Notification button */}
                    <button onClick={() => setReviewsExpanded(v => !v)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: reviewsExpanded ? 'rgba(255,140,66,0.06)' : 'rgba(255,140,66,0.04)', border: '1px solid rgba(255,140,66,0.25)', borderRadius: 12, padding: '13px 16px', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#ff8c42', boxShadow: '0 0 6px #ff8c42', animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
                            <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.8rem', color: '#ff8c42', letterSpacing: '2px' }}>PENDING REVIEW</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.95rem', fontWeight: 700, color: '#ff8c42', background: 'rgba(255,140,66,0.12)', border: '1px solid rgba(255,140,66,0.3)', borderRadius: 100, padding: '3px 12px' }}>{taskQueue.length}</span>
                            <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.86rem', color: '#555' }}>{reviewsExpanded ? '▲' : '▼'}</span>
                        </div>
                    </button>

                    {/* Expanded review feed */}
                    {reviewsExpanded && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                            {taskQueue.map((task: any, i: number) => {
                                const taskId = task.id || task.taskId;
                                const user = getUserForTask(task);
                                const routine = isRoutineTask(task);
                                const busy = reviewing === taskId;
                                const displayName = user?.name || task.memberName || (task.member_id || '').split('@')[0] || 'Unknown';
                                const displayAvatar = user?.avatar || task.avatarUrl || '/collar-placeholder.png';
                                const proofUrl = task.proofUrl || task.proof_url;
                                const isVideo = !!(proofUrl && ((task.proofType && (task.proofType === 'video' || task.proofType.startsWith('video/'))) || /\.(mp4|mov|webm|ogg)(\?|$)/i.test(proofUrl)));
                                const previewUrl = isVideo ? (task.thumbnail_url || task.thumbnailUrl || '/collar-placeholder.png') : proofUrl;
                                const cleanText = stripHtml(task.taskName || task.task_name || task.text || 'Task');
                                return (
                                    <div key={taskId || i} style={{ background: '#090909', border: `1px solid ${routine ? 'rgba(197,160,89,0.15)' : 'rgba(255,140,66,0.12)'}`, borderRadius: 12, overflow: 'hidden' }}>
                                        <button onClick={() => user && onSelectUser(user)}
                                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', width: '100%', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
                                            <img src={displayAvatar} style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${user ? rc(user.rank) + '55' : '#333'}`, flexShrink: 0 }} onError={(e) => { (e.target as any).src = '/collar-placeholder.png'; }} alt="" />
                                            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                                                <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.8rem', color: '#ccc' }}>{displayName}</span>
                                                {user && <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.62rem', color: rc(user.rank), marginLeft: 8 }}>{user.rank}</span>}
                                            </div>
                                            {routine && <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.62rem', color: '#c5a059', background: 'rgba(197,160,89,0.08)', padding: '2px 7px', borderRadius: 20, border: '1px solid rgba(197,160,89,0.25)', flexShrink: 0 }}>ROUTINE</span>}
                                        </button>
                                        <button onClick={() => onOpenReview(task)} style={{ display: 'block', width: '100%', padding: 0, background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                {proofUrl ? (
                                                    <img src={toPublicUrl(previewUrl || '')} onError={(e) => { const t = e.target as HTMLImageElement; if (!t.src.includes('/api/media')) t.src = `/api/media?url=${encodeURIComponent(toPublicUrl(previewUrl || ''))}`; else t.style.display = 'none'; }} style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block', background: '#000' }} alt="" />
                                                ) : (
                                                    <div style={{ background: 'rgba(197,160,89,0.04)', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                                        <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.62rem', color: '#555', letterSpacing: '2px' }}>NO PROOF ATTACHED</span>
                                                    </div>
                                                )}
                                                <div style={{ background: 'rgba(0,0,0,0.55)', padding: '6px 14px', fontFamily: 'Orbitron,monospace', fontSize: '0.62rem', color: '#c5a059', letterSpacing: '2px', textAlign: 'center' }}>TAP TO REVIEW</div>
                                            </button>
                                        <div style={{ padding: '10px 14px 12px' }}>
                                            <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.85rem', color: '#888', lineHeight: 1.4, marginBottom: 10 }}>{cleanText}</div>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                {routine ? (
                                                    <>
                                                        <button disabled={busy} onClick={() => onOpenReview(task)} style={{ flex: 1, padding: '11px 0', background: busy ? '#111' : 'rgba(197,160,89,0.1)', color: '#c5a059', border: '1px solid rgba(197,160,89,0.3)', borderRadius: 8, fontFamily: 'Orbitron,monospace', fontSize: '0.74rem', fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1 }}>{busy ? '...' : '✓ REVIEW PROOF'}</button>
                                                        <button disabled={busy} onClick={() => handleReject(task)} style={{ width: 44, padding: '11px 0', background: 'rgba(255,51,51,0.07)', color: '#ff5555', border: '1px solid rgba(255,51,51,0.2)', borderRadius: 8, fontFamily: 'Orbitron,monospace', fontSize: '0.86rem', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1 }}>{busy ? '·' : '✕'}</button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button disabled={busy} onClick={() => onOpenReview(task)} style={{ flex: 1, padding: '11px 0', background: busy ? '#111' : 'rgba(197,160,89,0.08)', color: '#c5a059', border: '1px solid rgba(197,160,89,0.25)', borderRadius: 8, fontFamily: 'Orbitron,monospace', fontSize: '0.74rem', fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1 }}>{busy ? '...' : '✓ REVIEW + REWARD'}</button>
                                                        <button disabled={busy} onClick={() => handleReject(task)} style={{ width: 44, padding: '11px 0', background: 'rgba(255,51,51,0.07)', color: '#ff5555', border: '1px solid rgba(255,51,51,0.2)', borderRadius: 8, fontFamily: 'Orbitron,monospace', fontSize: '0.86rem', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1 }}>{busy ? '·' : '✕'}</button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '20px 0', fontFamily: 'Orbitron,monospace', fontSize: '0.90rem', color: '#1a1a1a', letterSpacing: '3px', flexShrink: 0 }}>✓ ALL CLEAR</div>
            )}

        </div>
    );
}

// ─── SUBJECTS VIEW ───────────────────────────────────────────────────────────
function hasUnread(memberId: string, unreadMap: Record<string, string>): boolean {
    const key = memberId.toLowerCase();
    const lastSlaveMsg = unreadMap[key];
    if (!lastSlaveMsg) return false;
    const readTime = typeof window !== 'undefined' ? localStorage.getItem('read_' + key) : null;
    if (!readTime) return true;
    return new Date(lastSlaveMsg).getTime() > parseInt(readTime);
}

function SubjectsView({ users, allCount, search, setSearch, unreadMap, onSelect, onlineJoinTime, onMarkAllRead }: {
    users: DashUser[]; allCount: number; search: string; setSearch: (s: string) => void;
    unreadMap: Record<string, string>; onSelect: (u: DashUser) => void;
    onlineJoinTime: Record<string, number>; onMarkAllRead: () => void;
}) {
    const now = Date.now();
    const getLastSeenMs = (u: DashUser) => { const t = new Date(u.lastSeen || '').getTime(); return isNaN(t) ? 0 : t; };

    const withUnread = [...users].filter(u => hasUnread(u.memberId, unreadMap))
        .sort((a, b) => (new Date(unreadMap[b.memberId.toLowerCase()] || '').getTime()) - (new Date(unreadMap[a.memberId.toLowerCase()] || '').getTime()));
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 2, flexShrink: 0 }}>
                <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.68rem', color: '#333', letterSpacing: '2px' }}>{sorted.length} OF {allCount} SUBJECTS</span>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {withUnread.length > 0 && (
                        <button onClick={onMarkAllRead} style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.62rem', color: '#4a9eff', letterSpacing: '1px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, opacity: 0.8 }}>
                            MARK ALL READ
                        </button>
                    )}
                    {sorted.filter(u => getOnlineStatus(u.lastSeen) === 'online').length > 0 && (
                        <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.68rem', color: '#6bcb77', letterSpacing: '2px' }}>
                            ● {sorted.filter(u => getOnlineStatus(u.lastSeen) === 'online').length} ONLINE
                        </span>
                    )}
                </div>
            </div>
            {sorted.map(u => {
                const status = getOnlineStatus(u.lastSeen);
                const dotC = statusColor(status);
                const unread = hasUnread(u.memberId, unreadMap);
                const isOnline = status === 'online';
                const hasPending = u.reviewQueue.length > 0;
                // Format last seen for offline users
                const lastSeenMs = u.lastSeen ? Date.now() - new Date(u.lastSeen).getTime() : null;
                const lastSeenText = lastSeenMs === null ? 'never seen' : lastSeenMs < 60000 ? 'just now' : lastSeenMs < 3600000 ? `${Math.floor(lastSeenMs / 60000)}m ago` : lastSeenMs < 86400000 ? `${Math.floor(lastSeenMs / 3600000)}h ago` : `${Math.floor(lastSeenMs / 86400000)}d ago`;
                // SVG paths matching desktop sidebar icons
                const mailPath = "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z";
                const timerPath = "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z";
                const starPath = "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z";
                return (
                    <button key={u.memberId} onClick={() => onSelect(u)}
                        style={{ ...S.userCard, ...(unread ? { border: '1px solid rgba(74,158,255,0.3)', background: 'rgba(74,158,255,0.04)' } : !isOnline ? { opacity: 0.65 } : {}) }}>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                            <img src={u.avatar} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${unread ? '#4a9eff' : rc(u.rank) + '44'}`, display: 'block' }} onError={(e) => { (e.target as any).src = '/collar-placeholder.png'; }} alt="" />
                            <div style={{ position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, background: dotC, borderRadius: '50%', border: '2px solid #030303', boxShadow: isOnline ? `0 0 6px ${dotC}` : 'none' }} />
                            {hasPending && (
                                <div style={{ position: 'absolute', top: -3, right: -3, width: 17, height: 17, background: '#ff4444', borderRadius: '50%', fontSize: '0.90rem', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Orbitron,monospace', fontWeight: 700, border: '1.5px solid #030303' }}>{u.reviewQueue.length}</div>
                            )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                            <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.9rem', color: unread ? '#fff' : '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: unread ? 700 : 400, marginBottom: 4 }}>{u.name}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.62rem', letterSpacing: '1px', padding: '1px 6px', borderRadius: 100, background: rc(u.rank) + '22', color: rc(u.rank), border: `1px solid ${rc(u.rank)}44` }}>{u.rank}</span>
                            </div>
                            {!isOnline && (
                                <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.56rem', color: '#3a3a3a', letterSpacing: '1px', marginTop: 4 }}>last seen {lastSeenText}</div>
                            )}
                        </div>
                        {/* 3-icon row: mail · clock · star — matching desktop sidebar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" style={{ fill: unread ? '#ff00de' : '#333', opacity: unread ? 1 : 0.2 }}><path d={mailPath} /></svg>
                            <svg width="16" height="16" viewBox="0 0 24 24" style={{ fill: u.hasActiveTask ? '#888' : '#333', opacity: u.hasActiveTask ? 1 : 0.2 }}><path d={timerPath} /></svg>
                            <svg width="16" height="16" viewBox="0 0 24 24" style={{ fill: hasPending ? '#ff00de' : '#333', opacity: hasPending ? 1 : 0.2 }}><path d={starPath} /></svg>
                        </div>
                        <div style={{ color: '#222', fontSize: '1.4rem', lineHeight: 1, flexShrink: 0, marginLeft: 4 }}>›</div>
                    </button>
                );
            })}
        </div>
    );
}

// ─── CHALLENGES VIEW ──────────────────────────────────────────────────────────
type ChallengesTab = 'live' | 'create' | 'history';

interface MChallenge {
    id: string; name: string; theme: string; description: string;
    status: 'draft' | 'active' | 'ended';
    duration_days: number; tasks_per_day: number; window_minutes: number;
    points_per_completion: number; first_place_points: number;
    second_place_points: number; third_place_points: number;
    start_date: string | null; end_date: string | null; created_at: string;
    participant_total?: number; participant_active?: number; participant_eliminated?: number;
    image_url?: string | null; task_names?: string[] | null;
}
interface MWindow {
    id: string; challenge_id: string;
    day_number: number; window_number: number;
    opens_at: string; closes_at: string; verification_code: number;
    task_name?: string | null;
}
interface MPendingVerification {
    id: string; member_id: string; proof_url: string | null;
    completed_at: string; response_time_seconds: number | null;
    challenge_windows: { day_number: number; window_number: number; verification_code: number; opens_at: string; closes_at: string; } | null;
    profiles: { name: string; avatar_url: string | null; profile_picture_url: string | null; } | null;
}
interface MLeaderboardEntry {
    member_id: string; name: string; avatar: string | null;
    status: 'active' | 'eliminated' | 'finished' | 'champion';
    completions_count: number; eliminated_day: number | null; final_rank: number | null;
}

function chThemeColor(theme: string) {
    if (theme === 'red') return '#e03030';
    if (theme === 'purple') return '#a855f7';
    if (theme === 'blue') return '#3b82f6';
    return '#c5a059';
}

function ChallengesView() {
    const [cTab, setCTab] = useState<ChallengesTab>('live');
    const [challenges, setChallenges] = useState<MChallenge[]>([]);
    const [detail, setDetail] = useState<{ challenge: MChallenge; leaderboard: MLeaderboardEntry[]; windows: MWindow[]; pending_verifications: MPendingVerification[] } | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
    const [tick, setTick] = useState(0);
    const toastRef = useRef<any>(null);

    const showToast = (msg: string, ok = true) => {
        setToast({ msg, ok });
        if (toastRef.current) clearTimeout(toastRef.current);
        toastRef.current = setTimeout(() => setToast(null), 3500);
    };

    const loadAll = useCallback(async () => {
        try {
            const res = await fetch('/api/challenges');
            const json = await res.json();
            if (json.success) setChallenges(json.challenges);
        } catch { }
    }, []);

    const loadDetail = useCallback(async (id: string) => {
        setLoadingDetail(true);
        try {
            const res = await fetch(`/api/challenges/${id}`);
            const json = await res.json();
            if (json.success) setDetail(json);
        } finally { setLoadingDetail(false); }
    }, []);

    useEffect(() => { loadAll(); }, [loadAll]);

    // Auto-open active/draft challenge on first load
    useEffect(() => {
        if (!challenges.length || detail) return;
        const pick = challenges.find(c => c.status === 'active') || challenges.find(c => c.status === 'draft');
        if (pick) loadDetail(pick.id);
    }, [challenges, detail, loadDetail]);

    // No auto-refresh detail - loads fresh on click only

    // Countdown tick
    useEffect(() => {
        const t = setInterval(() => setTick(n => n + 1), 1000);
        return () => clearInterval(t);
    }, []);

    const activeChallenge = challenges.find(c => c.status === 'active') || null;
    const draftChallenges = challenges.filter(c => c.status === 'draft');
    const endedChallenges = challenges.filter(c => c.status === 'ended');
    const pendingCount = detail?.pending_verifications?.length || 0;

    return (
        <div style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Tab bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(197,160,89,0.12)', flexShrink: 0, background: '#050505' }}>
                {([
                    { key: 'live' as ChallengesTab, label: 'LIVE', badge: pendingCount > 0 ? pendingCount : undefined },
                    { key: 'create' as ChallengesTab, label: 'CREATE' },
                    { key: 'history' as ChallengesTab, label: 'HISTORY' },
                ] as { key: ChallengesTab; label: string; badge?: number }[]).map(({ key, label, badge }) => (
                    <button key={key} onClick={() => setCTab(key)}
                        style={{ flex: 1, padding: '13px 0', background: 'none', border: 'none', borderBottom: `2px solid ${cTab === key ? '#c5a059' : 'transparent'}`, color: cTab === key ? '#c5a059' : '#333', fontFamily: 'Orbitron,monospace', fontSize: '0.90rem', letterSpacing: '2px', cursor: 'pointer', position: 'relative', WebkitTapHighlightColor: 'transparent' }}>
                        {label}
                        {badge !== undefined && (
                            <span style={{ position: 'absolute', top: 8, right: '20%', background: '#ff8c42', color: '#000', borderRadius: 10, minWidth: 16, height: 16, fontSize: '0.68rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{badge}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {cTab === 'live' && (
                    <ChLiveTab
                        activeChallenge={activeChallenge}
                        draftChallenges={draftChallenges}
                        detail={detail}
                        loading={loadingDetail}
                        tick={tick}
                        onSelectChallenge={(c) => loadDetail(c.id)}
                        onVerify={async (completionId, verified) => {
                            if (!detail) return;
                            const res = await fetch(`/api/challenges/${detail.challenge.id}/verify`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ completionId, verified }),
                            });
                            const json = await res.json();
                            if (json.success) {
                                showToast(verified ? `✓ Verified - ${json.points_awarded ?? 20}pts` : '✕ Rejected', verified);
                                loadDetail(detail.challenge.id);
                            } else {
                                showToast(json.error || 'Error', false);
                            }
                        }}
                        onLaunch={async () => {
                            if (!detail) return;
                            const res = await fetch(`/api/challenges/${detail.challenge.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'active' }) });
                            const json = await res.json();
                            if (json.success) { showToast('Challenge launched!'); await loadAll(); loadDetail(detail.challenge.id); }
                        }}
                        onEnd={async () => {
                            if (!detail) return;
                            if (!confirm('End this challenge? Winners will be ranked and badges awarded.')) return;
                            const res = await fetch(`/api/challenges/${detail.challenge.id}/end`, { method: 'POST' });
                            const json = await res.json();
                            if (json.success) { showToast(`Ended · ${json.survivors} survivors`); await loadAll(); loadDetail(detail.challenge.id); }
                            else showToast(json.error || 'Error', false);
                        }}
                        onRefresh={() => { if (detail) loadDetail(detail.challenge.id); }}
                    />
                )}
                {cTab === 'create' && (
                    <ChCreateTab
                        allChallenges={challenges}
                        onCreate={async (data) => {
                            const res = await fetch('/api/challenges', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                            const json = await res.json();
                            if (json.success) {
                                showToast(`Created! ${json.windows_created} windows`);
                                await loadAll();
                                setCTab('live');
                                loadDetail(json.challenge.id);
                            } else {
                                showToast(json.error || 'Error', false);
                            }
                        }}
                    />
                )}
                {cTab === 'history' && (
                    <ChHistoryTab challenges={endedChallenges} onView={(c) => { loadDetail(c.id); setCTab('live'); }} />
                )}
            </div>

            {/* Toast */}
            {toast && (
                <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: toast.ok ? 'rgba(74,222,128,0.12)' : 'rgba(224,48,48,0.12)', border: `1px solid ${toast.ok ? 'rgba(74,222,128,0.4)' : 'rgba(224,48,48,0.4)'}`, color: toast.ok ? '#4ade80' : '#e03030', fontFamily: 'Orbitron,monospace', fontSize: '0.74rem', padding: '10px 20px', borderRadius: 8, letterSpacing: '1px', zIndex: 9999, whiteSpace: 'nowrap' }}>
                    {toast.msg}
                </div>
            )}
        </div>
    );
}

// ─── CHALLENGES LIVE TAB ───────────────────────────────────────────────────────
function ChLiveTab({ activeChallenge, draftChallenges, detail, loading, tick, onSelectChallenge, onVerify, onLaunch, onEnd, onRefresh }: {
    activeChallenge: MChallenge | null; draftChallenges: MChallenge[];
    detail: { challenge: MChallenge; leaderboard: MLeaderboardEntry[]; windows: MWindow[]; pending_verifications: MPendingVerification[] } | null;
    loading: boolean; tick: number;
    onSelectChallenge: (c: MChallenge) => void;
    onVerify: (id: string, verified: boolean) => void;
    onLaunch: () => void; onEnd: () => void; onRefresh: () => void;
}) {
    const [verifying, setVerifying] = useState<string | null>(null);
    const [addEmail, setAddEmail] = useState('');
    const [addingParticipant, setAddingParticipant] = useState(false);
    const [addMsg, setAddMsg] = useState<{ text: string; ok: boolean } | null>(null);
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [showSchedule, setShowSchedule] = useState(false);
    const [proofPreview, setProofPreview] = useState<string | null>(null);

    if (loading && !detail) {
        return <div style={{ textAlign: 'center', padding: '60px 0', fontFamily: 'Orbitron,monospace', fontSize: '0.74rem', color: '#333', letterSpacing: '2px' }}>LOADING...</div>;
    }

    if (!detail) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {draftChallenges.length > 0 ? (
                    <>
                        <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.90rem', color: '#555', letterSpacing: '2px' }}>DRAFTS - TAP TO SELECT</div>
                        {draftChallenges.map(c => (
                            <button key={c.id} onClick={() => onSelectChallenge(c)}
                                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px', background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.2)', borderRadius: 12, cursor: 'pointer', textAlign: 'left', width: '100%', WebkitTapHighlightColor: 'transparent' }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: chThemeColor(c.theme), flexShrink: 0 }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontFamily: 'Orbitron,sans-serif', color: '#ddd', fontSize: '0.88rem' }}>{c.name}</div>
                                    <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.64rem', color: '#555', marginTop: 3 }}>{c.duration_days}d · {c.tasks_per_day}×/day</div>
                                </div>
                                <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.88rem', color: '#c5a059' }}>→</span>
                            </button>
                        ))}
                    </>
                ) : (
                    <div style={{ textAlign: 'center', padding: '60px 0', fontFamily: 'Orbitron,monospace', fontSize: '0.74rem', color: '#222', letterSpacing: '2px' }}>NO ACTIVE CHALLENGE<br /><span style={{ color: '#1a1a1a' }}>CREATE ONE IN THE CREATE TAB</span></div>
                )}
            </div>
        );
    }

    const { challenge, leaderboard, windows, pending_verifications } = detail;
    const color = chThemeColor(challenge.theme);
    const activeCount = leaderboard.filter(p => p.status === 'active').length;
    const elimCount = leaderboard.filter(p => p.status === 'eliminated').length;
    const openWindows = windows.filter(w => {
        const now = Date.now();
        return now >= new Date(w.opens_at).getTime() && now < new Date(w.closes_at).getTime();
    });
    const currentWindow = openWindows[0] || null;
    const daysLeft = challenge.end_date ? Math.max(0, Math.ceil((new Date(challenge.end_date).getTime() - Date.now()) / 86400000)) : null;

    // Next window countdown
    const now = Date.now();
    const upcoming = windows.filter(w => new Date(w.opens_at).getTime() > now).sort((a, b) => new Date(a.opens_at).getTime() - new Date(b.opens_at).getTime());
    const nextWindow = upcoming[0] || null;
    const nextSecs = nextWindow ? Math.floor((new Date(nextWindow.opens_at).getTime() - now) / 1000) : 0;
    const nextH = Math.floor(nextSecs / 3600);
    const nextM = Math.floor((nextSecs % 3600) / 60);
    const nextS = nextSecs % 60;

    const handleAddParticipant = async () => {
        if (!addEmail.trim()) return;
        setAddingParticipant(true);
        try {
            const res = await fetch(`/api/challenges/${challenge.id}/participants`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: addEmail.trim().toLowerCase(), waive_fee: true }) });
            const json = await res.json();
            if (json.success) { setAddMsg({ text: `Added`, ok: true }); setAddEmail(''); onRefresh(); }
            else setAddMsg({ text: json.error || 'Failed', ok: false });
        } finally { setAddingParticipant(false); setTimeout(() => setAddMsg(null), 3000); }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Challenge header card */}
            <div style={{ background: challenge.image_url ? 'rgba(0,0,0,0.7)' : `linear-gradient(135deg,${color}08,rgba(0,0,0,0.5))`, border: `1px solid ${color}44`, borderRadius: 14, overflow: 'hidden', position: 'relative' }}>
                {challenge.image_url && (
                    <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${challenge.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.12 }} />
                )}
                <div style={{ position: 'relative', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                {challenge.status === 'active' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}`, animation: 'pulse 1.5s infinite', flexShrink: 0 }} />}
                                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '1rem', color: '#fff', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{challenge.name}</div>
                            </div>
                            <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.68rem', color: '#555', letterSpacing: '1px' }}>
                                {challenge.status === 'active' ? `${daysLeft}d left · ${challenge.tasks_per_day}×/day · ${challenge.window_minutes}min windows` : challenge.status.toUpperCase()}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            {challenge.status === 'draft' && <button onClick={onLaunch} style={{ padding: '7px 14px', background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.4)', borderRadius: 8, color: '#4ade80', fontFamily: 'Orbitron,monospace', fontSize: '0.70rem', letterSpacing: '1px', cursor: 'pointer' }}>▶ LAUNCH</button>}
                            {challenge.status === 'active' && <button onClick={onEnd} style={{ padding: '7px 14px', background: 'rgba(224,48,48,0.08)', border: '1px solid rgba(224,48,48,0.3)', borderRadius: 8, color: '#e03030', fontFamily: 'Orbitron,monospace', fontSize: '0.70rem', letterSpacing: '1px', cursor: 'pointer' }}>■ END</button>}
                        </div>
                    </div>
                    {/* Stats row */}
                    <div style={{ display: 'flex', gap: 16 }}>
                        {[{ v: activeCount, l: 'IN', c: '#4ade80' }, { v: elimCount, l: 'OUT', c: '#e03030' }, { v: leaderboard.length, l: 'TOTAL', c: '#555' }].map(s => (
                            <div key={s.l} style={{ textAlign: 'center' }}>
                                <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '1.1rem', fontWeight: 700, color: s.c }}>{s.v}</div>
                                <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.62rem', color: '#444', letterSpacing: '1px' }}>{s.l}</div>
                            </div>
                        ))}
                        {nextWindow && (
                            <div style={{ marginLeft: 'auto', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 8, padding: '6px 12px', textAlign: 'right' }}>
                                <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.62rem', color: '#4ade80', letterSpacing: '1px', marginBottom: 2 }}>NEXT</div>
                                <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.90rem', color: '#4ade80', fontWeight: 700 }}>{String(nextH).padStart(2, '0')}:{String(nextM).padStart(2, '0')}:{String(nextS).padStart(2, '0')}</div>
                                <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.88rem', color: '#555' }}>D{nextWindow.day_number}·T{nextWindow.window_number}</div>
                            </div>
                        )}
                    </div>
                    {currentWindow && (
                        <div style={{ marginTop: 10, background: `${color}12`, border: `1px solid ${color}44`, borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}`, animation: 'pulse 1.2s infinite' }} />
                            <div>
                                <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.68rem', color, letterSpacing: '1px' }}>WINDOW OPEN - D{currentWindow.day_number}·T{currentWindow.window_number}</div>
                                <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '1.4rem', fontWeight: 900, color, letterSpacing: '6px', lineHeight: 1.2 }}>{currentWindow.verification_code}</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Pending verifications */}
            {pending_verifications.length > 0 && (
                <div>
                    <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.90rem', color: '#ff8c42', letterSpacing: '2px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#ff8c42', animation: 'pulse 1.5s infinite' }} />
                        {pending_verifications.length} PENDING VERIFICATION{pending_verifications.length !== 1 ? 'S' : ''}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {pending_verifications.map(pv => {
                            const w = pv.challenge_windows;
                            const prof = pv.profiles;
                            const avatar = prof?.avatar_url || prof?.profile_picture_url;
                            const name = prof?.name || pv.member_id?.split('@')[0] || pv.member_id;
                            const isOpen = w ? (Date.now() < new Date(w.closes_at).getTime()) : false;
                            const isBusy = verifying === pv.id;
                            return (
                                <div key={pv.id} style={{ background: 'rgba(10,8,5,0.98)', border: '1px solid rgba(255,140,66,0.2)', borderRadius: 12, overflow: 'hidden' }}>
                                    {/* Header */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        <img src={avatar || '/collar-placeholder.png'} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(197,160,89,0.3)', flexShrink: 0 }} onError={(e) => { (e.target as any).src = '/collar-placeholder.png'; }} alt="" />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.85rem', color: '#ddd' }}>{name}</div>
                                            <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.64rem', color: '#555', letterSpacing: '1px' }}>
                                                {w ? `DAY ${w.day_number} · TASK ${w.window_number}` : ''}
                                                {!isOpen && w && <span style={{ color: '#e03030', marginLeft: 8 }}>WINDOW CLOSED</span>}
                                            </div>
                                        </div>
                                        {w && (
                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.62rem', color: '#555', letterSpacing: '1px' }}>CODE</div>
                                                <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '1.2rem', fontWeight: 900, color, letterSpacing: '4px', lineHeight: 1 }}>{w.verification_code}</div>
                                            </div>
                                        )}
                                    </div>
                                    {/* Proof image */}
                                    {pv.proof_url && (
                                        <button onClick={() => setProofPreview(pv.proof_url!)}
                                            style={{ display: 'block', width: '100%', padding: 0, background: 'none', border: 'none', cursor: 'pointer' }}>
                                            <img src={toPublicUrl(pv.proof_url)} style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }} alt="proof" onError={(e) => { (e.target as any).style.display = 'none'; }} />
                                            <div style={{ background: 'rgba(0,0,0,0.55)', padding: '4px', fontFamily: 'Orbitron,monospace', fontSize: '0.62rem', color: '#666', letterSpacing: '1px', textAlign: 'center' }}>TAP TO ENLARGE</div>
                                        </button>
                                    )}
                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: 8, padding: '10px 14px' }}>
                                        <button disabled={isBusy} onClick={async () => { setVerifying(pv.id); await onVerify(pv.id, true); setVerifying(null); }}
                                            style={{ flex: 2, padding: '12px 0', background: isBusy ? '#111' : 'rgba(74,222,128,0.1)', color: isBusy ? '#333' : '#4ade80', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 9, fontFamily: 'Orbitron,monospace', fontSize: '0.76rem', fontWeight: 700, cursor: isBusy ? 'default' : 'pointer' }}>
                                            {isBusy ? '...' : '✓ VERIFY'}
                                        </button>
                                        <button disabled={isBusy} onClick={async () => { setVerifying(pv.id); await onVerify(pv.id, false); setVerifying(null); }}
                                            style={{ flex: 1, padding: '12px 0', background: isBusy ? '#111' : 'rgba(224,48,48,0.08)', color: isBusy ? '#333' : '#e03030', border: '1px solid rgba(224,48,48,0.25)', borderRadius: 9, fontFamily: 'Orbitron,monospace', fontSize: '0.76rem', cursor: isBusy ? 'default' : 'pointer' }}>
                                            {isBusy ? '...' : '✕'}
                                        </button>
                                    </div>
                                    {!isOpen && <div style={{ textAlign: 'center', fontFamily: 'Orbitron,monospace', fontSize: '0.62rem', color: '#e03030', padding: '0 14px 8px', letterSpacing: '1px' }}>REJECT = ELIMINATE</div>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Add participant */}
            <div style={{ display: 'flex', gap: 8 }}>
                <input type="email" placeholder="Add participant by email..." value={addEmail} onChange={e => setAddEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddParticipant()}
                    style={{ flex: 1, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(197,160,89,0.2)', borderRadius: 8, color: '#ddd', fontFamily: 'Orbitron,sans-serif', fontSize: '0.96rem', padding: '10px 14px', outline: 'none' }} />
                <button onClick={handleAddParticipant} disabled={addingParticipant || !addEmail.trim()}
                    style={{ padding: '10px 16px', background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.3)', borderRadius: 8, color: '#c5a059', fontFamily: 'Orbitron,sans-serif', fontSize: '0.90rem', cursor: 'pointer', flexShrink: 0 }}>
                    {addingParticipant ? '...' : '+ Add'}
                </button>
            </div>
            {addMsg && <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.68rem', color: addMsg.ok ? '#4ade80' : '#e03030', letterSpacing: '1px' }}>{addMsg.text}</div>}

            {/* Leaderboard collapsible */}
            <button onClick={() => setShowLeaderboard(v => !v)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 14px', background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 10, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
                <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.90rem', color: '#555', letterSpacing: '2px' }}>LEADERBOARD - {leaderboard.length}</span>
                <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.86rem', color: '#333' }}>{showLeaderboard ? '▲' : '▼'}</span>
            </button>
            {showLeaderboard && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: -6 }}>
                    {leaderboard.length === 0 && <div style={{ textAlign: 'center', padding: '20px 0', fontFamily: 'Orbitron,monospace', fontSize: '0.90rem', color: '#222' }}>NO PARTICIPANTS</div>}
                    {leaderboard.map((p, i) => {
                        const isElim = p.status === 'eliminated';
                        const isChamp = p.status === 'champion';
                        const rank = isChamp ? 1 : (p.final_rank || (isElim ? null : i + 1));
                        return (
                            <div key={p.member_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: isChamp ? 'rgba(197,160,89,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isChamp ? 'rgba(197,160,89,0.3)' : 'rgba(255,255,255,0.04)'}`, borderLeft: `3px solid ${isElim ? '#222' : isChamp ? '#c5a059' : color}`, borderRadius: 8, opacity: isElim ? 0.4 : 1 }}>
                                <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.85rem', fontWeight: 700, color: isChamp ? '#c5a059' : '#555', width: 24, flexShrink: 0, textAlign: 'center' }}>{isChamp ? '♛' : (rank || '-')}</div>
                                <img src={p.avatar || '/collar-placeholder.png'} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} onError={(e) => { (e.target as any).src = '/collar-placeholder.png'; }} alt="" />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.8rem', color: isChamp ? '#c5a059' : '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                                </div>
                                <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.9rem', color: '#4ade80', fontWeight: 700 }}>{p.completions_count}</div>
                                        <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.62rem', color: '#444' }}>DONE</div>
                                    </div>
                                    {isElim && p.eliminated_day && (
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.86rem', color: '#e03030' }}>D{p.eliminated_day}</div>
                                            <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.62rem', color: '#444' }}>ELIM</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Task schedule collapsible */}
            <button onClick={() => setShowSchedule(v => !v)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 14px', background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 10, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
                <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.90rem', color: '#555', letterSpacing: '2px' }}>TASK SCHEDULE - {windows.length} WINDOWS</span>
                <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.86rem', color: '#333' }}>{showSchedule ? '▲' : '▼'}</span>
            </button>
            {showSchedule && (
                <ChWindowsManager
                    windows={windows}
                    challengeId={challenge.id}
                    windowMinutes={challenge.window_minutes}
                    tasksPerDay={challenge.tasks_per_day}
                    taskNames={challenge.task_names || []}
                    onRefresh={onRefresh}
                />
            )}

            {/* Proof preview full-screen */}
            {proofPreview && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 99999, display: 'flex', flexDirection: 'column' }} onClick={() => setProofPreview(null)}>
                    <button onClick={() => setProofPreview(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '1.2rem', width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', zIndex: 1 }}>✕</button>
                    <img src={toPublicUrl(proofPreview)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="proof" />
                </div>
            )}
        </div>
    );
}

// ─── CHALLENGES WINDOWS MANAGER ───────────────────────────────────────────────
function ChWindowsManager({ windows, challengeId, windowMinutes, tasksPerDay, taskNames, onRefresh }: {
    windows: MWindow[]; challengeId: string; windowMinutes: number; tasksPerDay: number; taskNames: string[] | any[]; onRefresh: () => void;
}) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editDate, setEditDate] = useState('');
    const [editTime, setEditTime] = useState('');
    const [editName, setEditName] = useState('');
    const [saving, setSaving] = useState<string | null>(null);
    const [pushing, setPushing] = useState<string | null>(null);
    const [stopping, setStopping] = useState<string | null>(null);

    const now = Date.now();
    const byDay = windows.reduce((acc, w) => {
        if (!acc[w.day_number]) acc[w.day_number] = [];
        acc[w.day_number].push(w);
        return acc;
    }, {} as Record<number, MWindow[]>);

    const getTaskName = (w: MWindow) => {
        const idx = (w.day_number - 1) * tasksPerDay + (w.window_number - 1);
        return (taskNames as string[])[idx] || '';
    };

    const saveEdit = async (w: MWindow) => {
        setSaving(w.id);
        try {
            const opensAt = new Date(`${editDate}T${editTime}`);
            const closesAt = new Date(opensAt.getTime() + windowMinutes * 60 * 1000);
            const res = await fetch(`/api/challenges/windows/${w.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ opens_at: opensAt.toISOString(), closes_at: closesAt.toISOString() }) });
            if (!res.ok) return;
            // Save task name
            const idx = (w.day_number - 1) * tasksPerDay + (w.window_number - 1);
            const newNames = [...(taskNames as string[])];
            while (newNames.length <= idx) newNames.push('');
            newNames[idx] = editName;
            await fetch(`/api/challenges/${challengeId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task_names: newNames }) });
            setEditingId(null);
            onRefresh();
        } finally { setSaving(null); }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Object.keys(byDay).sort((a, b) => Number(a) - Number(b)).map(day => (
                <div key={day}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.88rem', color: '#c5a059', letterSpacing: '3px' }}>DAY {day}</div>
                        <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right,rgba(197,160,89,0.2),transparent)' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {byDay[Number(day)].map(w => {
                            const isOpen = now >= new Date(w.opens_at).getTime() && now < new Date(w.closes_at).getTime();
                            const isPast = now >= new Date(w.closes_at).getTime();
                            const isEditing = editingId === w.id;
                            const opensDate = new Date(w.opens_at);
                            const closesDate = new Date(w.closes_at);
                            const taskName = getTaskName(w);

                            return (
                                <div key={w.id} style={{ background: isOpen ? 'rgba(74,222,128,0.04)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isOpen ? 'rgba(74,222,128,0.3)' : 'rgba(197,160,89,0.1)'}`, borderLeft: `3px solid ${isOpen ? '#4ade80' : isPast ? '#181818' : 'rgba(197,160,89,0.4)'}`, borderRadius: 10, overflow: 'hidden', opacity: isPast && !isOpen ? 0.4 : 1 }}>
                                    {/* Header row */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                                        <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.90rem', fontWeight: 900, color: isOpen ? '#4ade80' : isPast ? '#333' : '#c5a059', letterSpacing: '4px', flexShrink: 0 }}>{w.verification_code}</div>
                                        <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.88rem', color: isOpen ? '#4ade80' : '#555', flexShrink: 0 }}>T{w.window_number}</div>
                                        {isOpen && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80', animation: 'pulse 1.2s infinite', flexShrink: 0 }} />}
                                        <div style={{ flex: 1 }} />
                                        {!isEditing && !isPast && (
                                            <button onClick={() => { setEditDate(opensDate.toISOString().slice(0, 10)); setEditTime(opensDate.toTimeString().slice(0, 5)); setEditName(taskName); setEditingId(w.id); }}
                                                style={{ padding: '5px 10px', background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.25)', borderRadius: 6, color: '#c5a059', fontFamily: 'Orbitron,sans-serif', fontSize: '0.78rem', cursor: 'pointer' }}>Edit</button>
                                        )}
                                        {!isEditing && isOpen && (
                                            <button disabled={stopping === w.id} onClick={async () => { if (!confirm(`Stop T${w.window_number}?`)) return; setStopping(w.id); await fetch(`/api/challenges/windows/${w.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ closes_at: new Date().toISOString() }) }); setStopping(null); onRefresh(); }}
                                                style={{ padding: '5px 10px', background: 'rgba(224,48,48,0.08)', border: '1px solid rgba(224,48,48,0.35)', borderRadius: 6, color: '#e03030', fontFamily: 'Orbitron,sans-serif', fontSize: '0.78rem', cursor: 'pointer' }}>■ Stop</button>
                                        )}
                                        {!isEditing && !isOpen && !isPast && (
                                            <button disabled={pushing === w.id} onClick={async () => { if (!confirm(`Push T${w.window_number} live now?`)) return; setPushing(w.id); await fetch(`/api/challenges/windows/${w.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ push_now: true }) }); setPushing(null); onRefresh(); }}
                                                style={{ padding: '5px 10px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.35)', borderRadius: 6, color: '#4ade80', fontFamily: 'Orbitron,sans-serif', fontSize: '0.78rem', cursor: 'pointer' }}>⚡ Push</button>
                                        )}
                                    </div>
                                    {/* Task name + time */}
                                    {!isEditing && (
                                        <div style={{ padding: '0 12px 10px' }}>
                                            {taskName && <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.94rem', color: 'rgba(220,215,200,0.8)', marginBottom: 4, lineHeight: 1.5 }}>{taskName}</div>}
                                            <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.62rem', color: isOpen ? 'rgba(74,222,128,0.5)' : isPast ? '#1e1e1e' : 'rgba(197,160,89,0.3)', letterSpacing: '1px' }}>
                                                {opensDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {opensDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} - {closesDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    )}
                                    {/* Edit panel */}
                                    {isEditing && (
                                        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            <textarea placeholder="Task description..." value={editName} onChange={e => setEditName(e.target.value)} rows={2}
                                                style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(197,160,89,0.25)', borderRadius: 7, color: '#ddd', fontFamily: 'Orbitron,sans-serif', fontSize: '0.96rem', padding: '8px 12px', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                                                    style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(197,160,89,0.2)', borderRadius: 6, color: '#c5a059', fontFamily: 'Orbitron,monospace', fontSize: '0.94rem', padding: '7px 10px', outline: 'none' }} />
                                                <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)}
                                                    style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(197,160,89,0.2)', borderRadius: 6, color: '#c5a059', fontFamily: 'Orbitron,monospace', fontSize: '0.94rem', padding: '7px 10px', outline: 'none' }} />
                                            </div>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button onClick={() => saveEdit(w)} disabled={saving === w.id}
                                                    style={{ flex: 2, padding: '9px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.35)', borderRadius: 7, color: '#4ade80', fontFamily: 'Orbitron,monospace', fontSize: '0.90rem', cursor: 'pointer' }}>
                                                    {saving === w.id ? '...' : '✓ SAVE'}
                                                </button>
                                                <button onClick={() => setEditingId(null)}
                                                    style={{ flex: 1, padding: '9px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, color: '#555', fontFamily: 'Orbitron,monospace', fontSize: '0.90rem', cursor: 'pointer' }}>
                                                    CANCEL
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── CHALLENGES CREATE TAB ─────────────────────────────────────────────────────
function ChCreateTab({ allChallenges, onCreate }: { allChallenges: MChallenge[]; onCreate: (data: any) => Promise<void>; }) {
    const DEFAULT_TIMES = ['09:00', '13:00', '18:00', '08:00', '11:00', '15:00', '19:00'];
    const [form, setForm] = useState({ name: '', theme: 'gold', description: '', duration_days: 7, tasks_per_day: 3, window_minutes: 30, points_per_completion: 20, first_place_points: 10, second_place_points: 7, third_place_points: 5, start_date: '', start_time: '08:00', image_url: '' });
    const [taskTimes, setTaskTimes] = useState<string[][]>(() => Array(7).fill(null).map(() => DEFAULT_TIMES.slice(0, 3)));
    const [taskNames, setTaskNames] = useState<string[][]>(() => Array(7).fill(null).map(() => Array(3).fill('')));
    const [expandedDay, setExpandedDay] = useState<number>(0);
    const [submitting, setSubmitting] = useState(false);
    const [imageUploading, setImageUploading] = useState(false);
    const imgRef = useRef<HTMLInputElement>(null);

    const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

    const handleDuration = (n: number) => {
        set('duration_days', n);
        setTaskTimes(p => n > p.length ? [...p, ...Array(n - p.length).fill(null).map(() => DEFAULT_TIMES.slice(0, form.tasks_per_day))] : p.slice(0, n));
        setTaskNames(p => n > p.length ? [...p, ...Array(n - p.length).fill(null).map(() => Array(form.tasks_per_day).fill(''))] : p.slice(0, n));
    };
    const handleTPD = (n: number) => {
        set('tasks_per_day', n);
        setTaskTimes(p => p.map(d => n > d.length ? [...d, ...DEFAULT_TIMES.slice(d.length, n)] : d.slice(0, n)));
        setTaskNames(p => p.map(d => n > d.length ? [...d, ...Array(n - d.length).fill('')] : d.slice(0, n)));
    };

    const prefill = (c: MChallenge) => {
        set('name', c.name); set('theme', c.theme); set('description', c.description || '');
        set('duration_days', c.duration_days); set('tasks_per_day', c.tasks_per_day); set('window_minutes', c.window_minutes);
        set('points_per_completion', c.points_per_completion);
        set('first_place_points', c.first_place_points); set('second_place_points', c.second_place_points); set('third_place_points', c.third_place_points);
        set('image_url', c.image_url || '');
        const srcTimes = DEFAULT_TIMES.slice(0, c.tasks_per_day);
        const srcNames = (c.task_names || []).concat(Array(Math.max(0, c.tasks_per_day - (c.task_names?.length || 0))).fill('')).slice(0, c.tasks_per_day) as string[];
        setTaskTimes(Array(c.duration_days).fill(null).map(() => [...srcTimes]));
        setTaskNames(Array(c.duration_days).fill(null).map(() => [...srcNames]));
        setExpandedDay(0);
    };

    const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImageUploading(true);
        try {
            const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
            const fd = new FormData();
            fd.append('file', file); fd.append('bucket', 'media'); fd.append('folder', 'challenge-covers'); fd.append('ext', ext);
            const res = await fetch('/api/upload', { method: 'POST', body: fd });
            const json = await res.json();
            if (json.url) set('image_url', json.url);
        } finally { setImageUploading(false); if (imgRef.current) imgRef.current.value = ''; }
    };

    const handleSubmit = async () => {
        if (!form.name || !form.start_date) return;
        setSubmitting(true);
        try {
            const startDt = new Date(`${form.start_date}T${form.start_time}:00`);
            await onCreate({ ...form, start_date: startDt.toISOString(), task_times: taskTimes, task_names: taskNames });
        } finally { setSubmitting(false); }
    };

    const field: React.CSSProperties = { background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(197,160,89,0.2)', borderRadius: 8, color: '#ddd', fontFamily: 'Orbitron,sans-serif', fontSize: '0.88rem', padding: '11px 14px', outline: 'none', width: '100%', boxSizing: 'border-box' };
    const label: React.CSSProperties = { fontFamily: 'Orbitron,monospace', fontSize: '0.88rem', color: '#555', letterSpacing: '2px', display: 'block', marginBottom: 6 };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Past challenges to prefill */}
            {allChallenges.length > 0 && (
                <div>
                    <div style={{ ...label, marginBottom: 10 }}>USE A PAST CHALLENGE AS TEMPLATE</div>
                    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                        {allChallenges.map(c => (
                            <button key={c.id} onClick={() => prefill(c)}
                                style={{ flexShrink: 0, padding: '8px 14px', background: 'rgba(197,160,89,0.04)', border: `1px solid ${chThemeColor(c.theme)}44`, borderRadius: 8, cursor: 'pointer', textAlign: 'left', WebkitTapHighlightColor: 'transparent' }}>
                                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.75rem', color: chThemeColor(c.theme), whiteSpace: 'nowrap' }}>{c.name}</div>
                                <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.62rem', color: '#444', marginTop: 2 }}>{c.duration_days}d · {c.tasks_per_day}×</div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Name */}
            <div><span style={label}>CHALLENGE NAME</span><input style={field} placeholder="e.g. Iron Week" value={form.name} onChange={e => set('name', e.target.value)} /></div>

            {/* Theme */}
            <div>
                <span style={label}>THEME</span>
                <div style={{ display: 'flex', gap: 8 }}>
                    {(['gold', 'red', 'purple', 'blue'] as const).map(t => (
                        <button key={t} onClick={() => set('theme', t)}
                            style={{ flex: 1, padding: '9px 0', background: form.theme === t ? `${chThemeColor(t)}18` : 'rgba(255,255,255,0.02)', border: `1px solid ${form.theme === t ? chThemeColor(t) : 'rgba(255,255,255,0.06)'}`, borderRadius: 8, color: form.theme === t ? chThemeColor(t) : '#444', fontFamily: 'Orbitron,monospace', fontSize: '0.68rem', letterSpacing: '1px', cursor: 'pointer' }}>
                            {t.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Description */}
            <div><span style={label}>DESCRIPTION (OPTIONAL)</span><textarea style={{ ...field, resize: 'none', lineHeight: 1.5 }} rows={2} placeholder="What this challenge is about..." value={form.description} onChange={e => set('description', e.target.value)} /></div>

            {/* Cover image */}
            <div>
                <span style={label}>COVER IMAGE (OPTIONAL)</span>
                <input ref={imgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImagePick} />
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {form.image_url && <img src={form.image_url} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(74,222,128,0.3)' }} alt="" />}
                    <button onClick={() => imgRef.current?.click()} disabled={imageUploading}
                        style={{ padding: '10px 16px', background: form.image_url ? 'rgba(74,222,128,0.06)' : 'rgba(197,160,89,0.06)', border: `1px solid ${form.image_url ? 'rgba(74,222,128,0.3)' : 'rgba(197,160,89,0.2)'}`, borderRadius: 8, color: imageUploading ? '#555' : form.image_url ? '#4ade80' : '#c5a059', fontFamily: 'Orbitron,monospace', fontSize: '0.68rem', letterSpacing: '1px', cursor: 'pointer' }}>
                        {imageUploading ? '⏳ UPLOADING...' : form.image_url ? '✓ CHANGE IMAGE' : '⬆ UPLOAD COVER'}
                    </button>
                    {form.image_url && <button onClick={() => set('image_url', '')} style={{ padding: '10px 12px', background: 'rgba(255,0,0,0.06)', border: '1px solid rgba(255,0,0,0.2)', borderRadius: 8, color: '#ff4444', fontFamily: 'Orbitron,monospace', fontSize: '0.68rem', cursor: 'pointer' }}>✕</button>}
                </div>
            </div>

            {/* Duration / Tasks per day / Window */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div><span style={label}>DAYS</span><input type="number" style={field} min={1} max={30} value={form.duration_days} onChange={e => handleDuration(Math.min(30, Math.max(1, Number(e.target.value))))} /></div>
                <div><span style={label}>TASKS/DAY</span><input type="number" style={field} min={1} max={10} value={form.tasks_per_day} onChange={e => handleTPD(Math.min(10, Math.max(1, Number(e.target.value))))} /></div>
                <div><span style={label}>WIN. (MIN)</span><input type="number" style={field} min={5} max={120} value={form.window_minutes} onChange={e => set('window_minutes', Number(e.target.value))} /></div>
            </div>

            {/* Start date + time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><span style={label}>START DATE</span><input type="date" style={field} value={form.start_date} onChange={e => set('start_date', e.target.value)} /></div>
                <div><span style={label}>START TIME</span><input type="time" style={field} value={form.start_time} onChange={e => set('start_time', e.target.value)} /></div>
            </div>

            {/* Points config */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                <div><span style={label}>PTS/TASK</span><input type="number" style={field} min={1} value={form.points_per_completion} onChange={e => set('points_per_completion', Number(e.target.value))} /></div>
                <div><span style={label}>🥇 BONUS</span><input type="number" style={field} min={0} value={form.first_place_points} onChange={e => set('first_place_points', Number(e.target.value))} /></div>
                <div><span style={label}>🥈 BONUS</span><input type="number" style={field} min={0} value={form.second_place_points} onChange={e => set('second_place_points', Number(e.target.value))} /></div>
                <div><span style={label}>🥉 BONUS</span><input type="number" style={field} min={0} value={form.third_place_points} onChange={e => set('third_place_points', Number(e.target.value))} /></div>
            </div>

            {/* Daily task schedule */}
            <div>
                <span style={label}>DAILY TASK SCHEDULE</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {taskTimes.map((dayTimes, dayIdx) => (
                        <div key={dayIdx} style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }}>
                            <button type="button" onClick={() => setExpandedDay(expandedDay === dayIdx ? -1 : dayIdx)}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: expandedDay === dayIdx ? 'rgba(197,160,89,0.05)' : 'none', border: 'none', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
                                <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.70rem', color: '#c5a059', letterSpacing: '2px' }}>DAY {dayIdx + 1}</span>
                                {expandedDay !== dayIdx && (
                                    <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.64rem', color: '#444' }}>{dayTimes.join(' · ')}</span>
                                )}
                                <span style={{ marginLeft: 'auto', fontFamily: 'Orbitron,monospace', fontSize: '0.76rem', color: '#333' }}>{expandedDay === dayIdx ? '▲' : '▼'}</span>
                            </button>
                            {expandedDay === dayIdx && (
                                <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {dayTimes.map((t, ti) => (
                                        <div key={ti} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.88rem', color: '#555', flexShrink: 0, width: 16 }}>T{ti + 1}</span>
                                            <input type="time" value={t} onChange={e => setTaskTimes(p => { const n = p.map(d => [...d]); n[dayIdx][ti] = e.target.value; return n; })}
                                                style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(197,160,89,0.2)', borderRadius: 6, color: '#c5a059', fontFamily: 'Orbitron,monospace', fontSize: '0.94rem', padding: '7px 10px', outline: 'none' }} />
                                            <input placeholder="Task description..." value={taskNames[dayIdx]?.[ti] || ''} onChange={e => setTaskNames(p => { const n = p.map(d => [...d]); n[dayIdx][ti] = e.target.value; return n; })}
                                                style={{ flex: 2, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 6, color: '#ddd', fontFamily: 'Orbitron,sans-serif', fontSize: '0.94rem', padding: '7px 10px', outline: 'none' }} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Submit */}
            <button disabled={submitting || !form.name || !form.start_date} onClick={handleSubmit}
                style={{ width: '100%', padding: '16px', background: submitting || !form.name || !form.start_date ? '#111' : 'linear-gradient(135deg,rgba(197,160,89,0.2),rgba(140,105,20,0.15))', border: `1px solid ${submitting || !form.name || !form.start_date ? '#222' : 'rgba(197,160,89,0.4)'}`, borderRadius: 10, color: submitting || !form.name || !form.start_date ? '#333' : '#c5a059', fontFamily: 'Orbitron,monospace', fontSize: '0.94rem', fontWeight: 700, letterSpacing: '2px', cursor: 'pointer' }}>
                {submitting ? 'CREATING...' : '⚔ CREATE CHALLENGE'}
            </button>
        </div>
    );
}

// ─── CHALLENGES HISTORY TAB ────────────────────────────────────────────────────
function ChHistoryTab({ challenges, onView }: { challenges: MChallenge[]; onView: (c: MChallenge) => void; }) {
    if (!challenges.length) return (
        <div style={{ textAlign: 'center', padding: '60px 0', fontFamily: 'Orbitron,monospace', fontSize: '0.74rem', color: '#222', letterSpacing: '2px' }}>NO ENDED CHALLENGES</div>
    );
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {challenges.map(c => (
                <button key={c.id} onClick={() => onView(c)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderLeft: `3px solid ${chThemeColor(c.theme)}44`, borderRadius: 12, cursor: 'pointer', textAlign: 'left', width: '100%', WebkitTapHighlightColor: 'transparent' }}>
                    {c.image_url && <img src={c.image_url} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} alt="" />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.88rem', color: '#aaa', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                        <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.64rem', color: '#444', letterSpacing: '1px' }}>{c.duration_days}d · {c.tasks_per_day}×/day · {c.participant_total ?? 0} participants</div>
                        {c.start_date && <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.62rem', color: '#333', letterSpacing: '1px', marginTop: 2 }}>{new Date(c.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>}
                    </div>
                    <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.88rem', color: '#333' }}>→</span>
                </button>
            ))}
        </div>
    );
}

// ─── TASK REVIEW MODAL ────────────────────────────────────────────────────────
// Full-screen: media on top, actions at bottom. Single step - no extra dialogs.
function TaskReviewModal({ proofUrl, isVideo, name, avatar, rank, text, isRoutine, busy, onClose, onApprove, onReject }: {
    proofUrl?: string; isVideo: boolean; name: string; avatar: string; rank?: string;
    text: string; isRoutine: boolean; busy: boolean;
    onClose: () => void; onApprove: (tier: number, note: string) => void; onReject: (note: string) => void;
}) {
    const [tier, setTier] = useState(50);
    const [note, setNote] = useState('');
    // Convert signed URL → public URL (media bucket is public, same as chat images)
    const [displayUrl] = useState(() => toPublicUrl(proofUrl || ''));
    const tiers = [50, 70, 100];
    const noteRef = useRef<HTMLTextAreaElement>(null);
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);

    // Auto-focus note field when modal opens (skip for routine — no note shown)
    // iOS trick: proxy input was focused synchronously in the tap handler to capture the keyboard.
    // useEffect fires after DOM commit — noteRef is populated, proxy is still focused (keyboard open).
    // Calling focus() here transfers keyboard from proxy to textarea without dismissing it.
    useEffect(() => {
        if (isRoutine) return;
        noteRef.current?.focus();
        const proxy = (window as any).__reviewFocusProxy;
        if (proxy) { proxy.remove(); delete (window as any).__reviewFocusProxy; }
    }, [isRoutine]);
    const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; touchStartY.current = e.touches[0].clientY; };
    const handleTouchEnd = (e: React.TouchEvent) => {
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
        if (dx > 80 && dy < 60) onClose();
    };
    return (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 99999, display: 'flex', flexDirection: 'column' }}
            onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            {/* Top bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: '#050505', flexShrink: 0 }}>
                <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', fontSize: '1.1rem', width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent' }}>←</button>
                <img src={avatar} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '1px solid #333', flexShrink: 0 }} onError={(e) => { (e.target as any).src = '/collar-placeholder.png'; }} alt="" />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.85rem', color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                    {rank && <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.62rem', color: rc(rank), letterSpacing: '1px' }}>{rank}</div>}
                </div>
                {isRoutine && <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.62rem', color: '#c5a059', background: 'rgba(197,160,89,0.08)', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(197,160,89,0.25)', flexShrink: 0 }}>ROUTINE</span>}
            </div>

            {/* Media area - scrollable if needed */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                {displayUrl ? (
                    isVideo ? (
                        <video src={displayUrl} controls autoPlay playsInline style={{ width: '100%', maxHeight: '55vh', objectFit: 'contain', background: '#000', flexShrink: 0 }} onError={(e) => { const t = e.target as HTMLVideoElement; if (!t.src.includes('/api/media')) t.src = `/api/media?url=${encodeURIComponent(displayUrl)}`; }} />
                    ) : (
                        <img src={displayUrl} onError={(e) => { const t = e.target as HTMLImageElement; if (!t.src.includes('/api/media')) t.src = `/api/media?url=${encodeURIComponent(displayUrl)}`; }} style={{ width: '100%', maxHeight: '55vh', objectFit: 'contain', background: '#000', flexShrink: 0 }} alt="" />
                    )
                ) : (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#222', fontFamily: 'Orbitron,monospace', fontSize: '0.70rem', letterSpacing: '2px' }}>NO MEDIA</div>
                )}
                <div style={{ padding: '12px 16px', fontFamily: 'Rajdhani,sans-serif', fontSize: '0.9rem', color: '#777', lineHeight: 1.5 }}>{text}</div>
            </div>

            {/* Actions - always visible at bottom */}
            <div style={{ background: '#080808', borderTop: '1px solid rgba(197,160,89,0.1)', padding: '14px 16px', paddingBottom: 'max(32px, env(safe-area-inset-bottom, 16px))', flexShrink: 0 }}>
                {!isRoutine && (
                    <>
                        <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.68rem', color: '#444', letterSpacing: '2px', marginBottom: 8 }}>MERIT REWARD</div>
                        <div style={{ display: 'flex', gap: 7, marginBottom: 12 }}>
                            {tiers.map(t => (
                                <button key={t} onClick={() => setTier(t)}
                                    style={{ flex: 1, padding: '10px 0', background: tier === t ? '#c5a059' : 'rgba(197,160,89,0.05)', border: `1px solid ${tier === t ? '#c5a059' : 'rgba(197,160,89,0.15)'}`, borderRadius: 8, color: tier === t ? '#000' : '#c5a059', fontFamily: 'Orbitron,monospace', fontSize: '0.88rem', fontWeight: tier === t ? 700 : 400, cursor: 'pointer' }}>
                                    {t}
                                </button>
                            ))}
                        </div>
                        <textarea ref={noteRef} value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)..." rows={2}
                            style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(197,160,89,0.1)', borderRadius: 8, color: '#fff', fontFamily: 'Rajdhani,sans-serif', fontSize: '0.85rem', padding: '8px 12px', resize: 'none', outline: 'none', marginBottom: 12, lineHeight: 1.5, boxSizing: 'border-box' }} />
                    </>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                    <button disabled={busy} onClick={() => onReject(note)}
                        style={{ flex: 1, padding: '14px 0', background: 'rgba(255,51,51,0.07)', color: busy ? '#333' : '#ff5555', border: '1px solid rgba(255,51,51,0.2)', borderRadius: 10, fontFamily: 'Orbitron,monospace', fontSize: '0.76rem', cursor: busy ? 'default' : 'pointer' }}>
                        {busy ? '...' : '✕ REJECT'}
                    </button>
                    <button disabled={busy} onClick={() => onApprove(isRoutine ? 50 : tier, note)}
                        style={{ flex: 2, padding: '14px 0', background: busy ? '#111' : 'linear-gradient(135deg,#c5a059,#8b6914)', color: '#000', border: 'none', borderRadius: 10, fontFamily: 'Orbitron,monospace', fontSize: '0.76rem', fontWeight: 700, letterSpacing: '1px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1 }}>
                        {busy ? '...' : isRoutine ? '✓ APPROVE +50' : `✓ APPROVE +${tier}`}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── USER PROFILE ─────────────────────────────────────────────────────────────
function UserProfile({ user, profileTab, setProfileTab, onBack, adminEmail, onReviewed, onOpenReview, onUserUpdated }: {
    user: DashUser; profileTab: ProfileTab; setProfileTab: (t: ProfileTab) => void;
    onBack: () => void; adminEmail: string | null; onReviewed?: () => void;
    onOpenReview: (task: any) => void;
    onUserUpdated?: (u: DashUser) => void;
}) {
    const color = rc(user.rank);
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const [reviewing, setReviewing] = useState<string | null>(null);
    const [queue, setQueue] = useState<any[]>(user.reviewQueue);

    const isRoutine = (task: any) => !!(task.isRoutine || task.category === 'Routine' || task.text === 'Daily Routine');

    const handleApprove = async (task: any, tier: number = 50, note: string = '') => {
        const taskId = task.id || task.taskId;
        setReviewing(taskId);
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

            {/* Header */}
            <div style={{ padding: '12px 14px 16px', background: 'rgba(6,6,6,0.97)', borderBottom: `1px solid ${color}33`, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <button onClick={onBack} style={S.backBtn}>← BACK</button>
                <img src={user.avatar} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${color}55`, marginBottom: 8 }} onError={(e) => { (e.target as any).src = '/collar-placeholder.png'; }} alt="" />
                <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.76rem', letterSpacing: '2px', padding: '2px 12px', borderRadius: 100, background: color + '22', color, border: `1px solid ${color}44`, marginBottom: 6 }}>{user.rank}</span>
                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '1.2rem', color: '#fff', letterSpacing: '2px', textAlign: 'center' }}>{user.name}</div>
                {/* Stats row */}
                <div style={{ display: 'flex', width: '100%', marginTop: 12, background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.1)', borderRadius: 10, padding: '8px 0' }}>
                    {[
                        { label: 'MERIT', val: user.score, c: '#c5a059' },
                        { label: 'COINS', val: user.wallet.toLocaleString(), c: '#4ecdc4' },
                        { label: 'PENDING', val: queue.length, c: queue.length > 0 ? '#ff8c42' : '#555' },
                    ].map((s, i) => (
                        <div key={s.label} style={{ flex: 1, textAlign: 'center', borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                            <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '1.1rem', fontWeight: 700, color: s.c }}>{s.val}</div>
                            <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.64rem', color: '#444', letterSpacing: '1.5px', marginTop: 2 }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(197,160,89,0.1)', background: 'rgba(6,6,6,0.97)', flexShrink: 0, overflowX: 'auto' }}>
                {tabs.map(t => (
                    <button key={t.key} onClick={() => setProfileTab(t.key)} style={{ flex: 1, minWidth: 70, padding: '11px 4px', background: 'none', border: 'none', borderBottom: profileTab === t.key ? '2px solid #c5a059' : '2px solid transparent', color: profileTab === t.key ? '#c5a059' : '#444', fontFamily: 'Orbitron,monospace', fontSize: '0.76rem', letterSpacing: '1.5px', cursor: 'pointer', position: 'relative', WebkitTapHighlightColor: 'transparent' }}>
                        {t.label}
                        {t.badge ? <span style={{ position: 'absolute', top: 6, right: 4, background: '#ff4444', color: '#fff', borderRadius: 100, minWidth: 14, height: 14, fontSize: '0.88rem', fontFamily: 'Orbitron,monospace', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>{t.badge}</span> : null}
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
                                            <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.74rem', color: '#444' }}>{devotion} / 1000</span>
                                            <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.74rem', color }}>{devPct.toFixed(0)}%</span>
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
                                        <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.74rem', color: '#444', letterSpacing: '1.5px' }}>{row.label}</span>
                                        <span style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.96rem', color: (row as any).c || '#aaa', maxWidth: '58%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{row.val}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Kinks & limits */}
                            {(user.parameters?.kinks || user.parameters?.limits) && (
                                <div style={S.card}>
                                    <div style={S.cardTitle}>KINKS & LIMITS</div>
                                    {user.parameters?.kinks && (
                                        <div style={{ marginBottom: 10 }}>
                                            <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.70rem', color: '#c5a059', letterSpacing: '2px', marginBottom: 6 }}>KINKS</div>
                                            <div style={{ fontSize: '0.96rem', color: '#888', lineHeight: 1.6 }}>{user.parameters.kinks}</div>
                                        </div>
                                    )}
                                    {user.parameters?.limits && (
                                        <div>
                                            <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.70rem', color: '#ff8c42', letterSpacing: '2px', marginBottom: 6 }}>LIMITS</div>
                                            <div style={{ fontSize: '0.96rem', color: '#888', lineHeight: 1.6 }}>{user.parameters.limits}</div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Routine */}
                            {user.parameters?.routine && (
                                <div style={S.card}>
                                    <div style={S.cardTitle}>ASSIGNED ROUTINE</div>
                                    <div style={{ fontSize: '0.96rem', color: '#888', lineHeight: 1.6 }}>{user.parameters.routine}</div>
                                </div>
                            )}
                        </>
                    )}

                    {profileTab === 'tasks' && (
                        <>
                            {queue.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '50px 0', fontFamily: 'Orbitron,monospace', fontSize: '0.76rem', color: '#2a2a2a', letterSpacing: '2px' }}>NO PENDING TASKS</div>
                            ) : queue.map((task: any, i: number) => {
                                const taskId = task.id || task.taskId;
                                const routine = isRoutine(task);
                                const busy = reviewing === taskId;
                                return (
                                    <div key={i} style={{ background: 'rgba(12,12,12,0.9)', border: `1px solid ${routine ? 'rgba(197,160,89,0.2)' : 'rgba(255,140,66,0.15)'}`, borderRadius: 10, padding: '14px' }}>
                                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                                            {(task.proofUrl || task.proof_url) && (
                                                <img src={toPublicUrl(task.proofUrl || task.proof_url)} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, flexShrink: 0, border: '1px solid #222', cursor: 'pointer' }} onClick={() => onOpenReview(task)} onError={(e) => { const t = e.target as HTMLImageElement; if (!t.src.includes('/api/media')) t.src = `/api/media?url=${encodeURIComponent(toPublicUrl(task.proofUrl || task.proof_url))}`; else t.style.display = 'none'; }} alt="" />
                                            )}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.85rem', color: '#fff', marginBottom: 5, lineHeight: 1.3 }}>{stripHtml(task.taskName || task.task_name || task.text || 'Task')}</div>
                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                                    {routine && <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.68rem', color: '#c5a059', background: 'rgba(197,160,89,0.1)', padding: '2px 7px', borderRadius: 20, border: '1px solid rgba(197,160,89,0.3)' }}>ROUTINE</span>}
                                                    {(task.timestamp || task.submitted_at) && <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.68rem', color: '#444' }}>{new Date(task.timestamp || task.submitted_at).toLocaleDateString()}</span>}
                                                </div>
                                                {task.notes && <div style={{ fontSize: '0.76rem', color: '#666', marginTop: 6, lineHeight: 1.5 }}>{task.notes}</div>}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            {routine ? (
                                                <>
                                                    <button disabled={busy} onClick={() => onOpenReview(task)}
                                                        style={{ flex: 2, padding: '11px 0', background: busy ? '#111' : 'rgba(197,160,89,0.1)', color: '#c5a059', border: '1px solid rgba(197,160,89,0.3)', borderRadius: 8, fontFamily: 'Orbitron,monospace', fontSize: '0.76rem', fontWeight: 700, letterSpacing: '1px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1 }}>
                                                        {busy ? '...' : '✓ REVIEW PROOF'}
                                                    </button>
                                                    <button disabled={busy} onClick={() => handleReject(task)}
                                                        style={{ flex: 1, padding: '11px 0', background: 'rgba(255,51,51,0.07)', color: '#ff4444', border: '1px solid rgba(255,51,51,0.2)', borderRadius: 8, fontFamily: 'Orbitron,monospace', fontSize: '0.76rem', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1 }}>
                                                        {busy ? '...' : '✕ REJECT'}
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button disabled={busy} onClick={() => onOpenReview(task)}
                                                        style={{ flex: 2, padding: '11px 0', background: busy ? '#111' : 'rgba(197,160,89,0.1)', color: '#c5a059', border: '1px solid rgba(197,160,89,0.3)', borderRadius: 8, fontFamily: 'Orbitron,monospace', fontSize: '0.76rem', fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1 }}>
                                                        {busy ? '...' : '✓ APPROVE'}
                                                    </button>
                                                    <button disabled={busy} onClick={() => handleReject(task)}
                                                        style={{ flex: 1, padding: '11px 0', background: 'rgba(255,51,51,0.07)', color: '#ff4444', border: '1px solid rgba(255,51,51,0.2)', borderRadius: 8, fontFamily: 'Orbitron,monospace', fontSize: '0.76rem', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1 }}>
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
    // Lock controls
    const [lockReason, setLockReason] = useState('');
    const [paywallAmt, setPaywallAmt] = useState('500');
    const [showPaywallPresets, setShowPaywallPresets] = useState(false);
    const [showSilencePresets, setShowSilencePresets] = useState(false);
    // Routine
    const [routineText, setRoutineText] = useState(user.parameters?.routine || '');
    const [savingRoutine, setSavingRoutine] = useState(false);

    // Sync routine from parent when full profile loads
    useEffect(() => {
        const r = user.parameters?.routine || '';
        if (r) setRoutineText(r);
    }, [user.parameters?.routine]);

    const flash = (msg: string) => { setStatus(msg); setTimeout(() => setStatus(''), 3500); };

    const saveRoutine = async () => {
        setSavingRoutine(true);
        try {
            const res = await fetch('/api/slave-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.memberId, routine: routineText.trim() || 'None' }),
            });
            const d = await res.json();
            if (d.success) {
                flash('✓ Routine saved');
                onUserUpdated?.({ ...user, parameters: { ...user.parameters, routine: routineText.trim() || 'None' } });
            } else { flash('✕ ' + (d.error || 'Failed')); }
        } catch (e: any) { flash('✕ ' + e.message); }
        setSavingRoutine(false);
    };

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
    const actionBtn = (active: boolean): React.CSSProperties => ({ flex: 1, padding: '12px 0', background: active ? 'rgba(255,51,51,0.12)' : 'rgba(197,160,89,0.08)', border: `1px solid ${active ? 'rgba(255,51,51,0.4)' : 'rgba(197,160,89,0.2)'}`, borderRadius: 8, color: active ? '#ff6666' : '#c5a059', fontFamily: 'Orbitron,monospace', fontSize: '0.76rem', fontWeight: 700, letterSpacing: '1px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1 });

    return (
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: 14, WebkitOverflowScrolling: 'touch' as any }}>
            {/* Status flash */}
            {status && (
                <div style={{ background: status.startsWith('✓') ? 'rgba(107,203,119,0.12)' : 'rgba(255,51,51,0.12)', border: `1px solid ${status.startsWith('✓') ? 'rgba(107,203,119,0.3)' : 'rgba(255,51,51,0.3)'}`, borderRadius: 8, padding: '12px 14px', fontFamily: 'Orbitron,monospace', fontSize: '0.76rem', color: status.startsWith('✓') ? '#6bcb77' : '#ff6666', letterSpacing: '1px', textAlign: 'center' }}>
                    {status}
                </div>
            )}

            {/* Lock status pills */}
            {(paywallActive || silenceActive) && (
                <div style={{ display: 'flex', gap: 8 }}>
                    {paywallActive && <div style={{ flex: 1, textAlign: 'center', padding: '8px 10px', background: 'rgba(255,51,51,0.08)', border: '1px solid rgba(255,51,51,0.3)', borderRadius: 8, fontFamily: 'Orbitron,monospace', fontSize: '0.68rem', color: '#ff6666', letterSpacing: '1px' }}>PAYWALL ACTIVE<br /><span style={{ fontSize: '0.62rem', color: '#ff9999', marginTop: 2, display: 'block', fontFamily: 'Rajdhani,sans-serif', fontWeight: 400, letterSpacing: 0 }}>{user.parameters?.paywall?.reason}</span></div>}
                    {silenceActive && <div style={{ flex: 1, textAlign: 'center', padding: '8px 10px', background: 'rgba(255,140,66,0.08)', border: '1px solid rgba(255,140,66,0.3)', borderRadius: 8, fontFamily: 'Orbitron,monospace', fontSize: '0.68rem', color: '#ff8c42', letterSpacing: '1px' }}>SILENCED<br /><span style={{ fontSize: '0.62rem', color: '#ffaa77', marginTop: 2, display: 'block', fontFamily: 'Rajdhani,sans-serif', fontWeight: 400, letterSpacing: 0 }}>{user.parameters?.silence?.reason}</span></div>}
                </div>
            )}

            {/* PAYWALL */}
            <div style={S.card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={S.cardTitle}>PAYWALL</div>
                    {paywallActive && <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.62rem', color: '#ff6666', background: 'rgba(255,51,51,0.1)', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(255,51,51,0.25)' }}>ACTIVE</span>}
                </div>
                {!paywallActive && (
                    <>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                            <button onClick={() => setShowPaywallPresets(v => !v)} style={{ background: showPaywallPresets ? 'rgba(197,160,89,0.12)' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(197,160,89,0.2)', borderRadius: 6, color: '#888', fontFamily: 'Orbitron,monospace', fontSize: '0.62rem', padding: '5px 10px', cursor: 'pointer', letterSpacing: '1px' }}>
                                PRESETS {showPaywallPresets ? '▲' : '▼'}
                            </button>
                        </div>
                        {showPaywallPresets && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                                {PAYWALL_PRESETS.map((p, i) => (
                                    <button key={i} onClick={() => { setLockReason(p); setShowPaywallPresets(false); }}
                                        style={{ textAlign: 'left', background: lockReason === p ? 'rgba(255,51,51,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${lockReason === p ? 'rgba(255,51,51,0.3)' : 'rgba(255,255,255,0.05)'}`, borderRadius: 6, padding: '8px 10px', color: lockReason === p ? '#ff9999' : '#666', fontFamily: 'Rajdhani,sans-serif', fontSize: '0.84rem', cursor: 'pointer', lineHeight: 1.3 }}>
                                        {p}
                                    </button>
                                ))}
                            </div>
                        )}
                        <input style={inp} placeholder="Reason (required)..." value={lockReason} onChange={e => setLockReason(e.target.value)} />
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                            <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.68rem', color: '#555', letterSpacing: '1px', flexShrink: 0 }}>AMOUNT ₡</span>
                            <input style={{ ...smInp, flex: 1 }} value={paywallAmt} onChange={e => setPaywallAmt(e.target.value)} placeholder="500" />
                        </div>
                    </>
                )}
                <button disabled={busy} onClick={togglePaywall} style={{ width: '100%', marginTop: 12, padding: '12px', background: paywallActive ? 'rgba(107,203,119,0.1)' : 'rgba(255,51,51,0.1)', border: `1px solid ${paywallActive ? 'rgba(107,203,119,0.3)' : 'rgba(255,51,51,0.3)'}`, borderRadius: 8, color: paywallActive ? '#6bcb77' : '#ff6666', fontFamily: 'Orbitron,monospace', fontSize: '0.80rem', fontWeight: 700, letterSpacing: '1.5px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1 }}>
                    {paywallActive ? 'UNLOCK PAYWALL' : 'ACTIVATE PAYWALL'}
                </button>
            </div>

            {/* SILENCE */}
            <div style={S.card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={S.cardTitle}>SILENCE</div>
                    {silenceActive && <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.62rem', color: '#ff8c42', background: 'rgba(255,140,66,0.1)', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(255,140,66,0.25)' }}>ACTIVE</span>}
                </div>
                {!silenceActive && (
                    <>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                            <button onClick={() => setShowSilencePresets(v => !v)} style={{ background: showSilencePresets ? 'rgba(197,160,89,0.12)' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(197,160,89,0.2)', borderRadius: 6, color: '#888', fontFamily: 'Orbitron,monospace', fontSize: '0.62rem', padding: '5px 10px', cursor: 'pointer', letterSpacing: '1px' }}>
                                PRESETS {showSilencePresets ? '▲' : '▼'}
                            </button>
                        </div>
                        {showSilencePresets && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                                {SILENCE_PRESETS.map((p, i) => (
                                    <button key={i} onClick={() => { setLockReason(p); setShowSilencePresets(false); }}
                                        style={{ textAlign: 'left', background: lockReason === p ? 'rgba(255,140,66,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${lockReason === p ? 'rgba(255,140,66,0.3)' : 'rgba(255,255,255,0.05)'}`, borderRadius: 6, padding: '8px 10px', color: lockReason === p ? '#ffaa77' : '#666', fontFamily: 'Rajdhani,sans-serif', fontSize: '0.84rem', cursor: 'pointer', lineHeight: 1.3 }}>
                                        {p}
                                    </button>
                                ))}
                            </div>
                        )}
                        <input style={inp} placeholder="Reason (required)..." value={lockReason} onChange={e => setLockReason(e.target.value)} />
                    </>
                )}
                <button disabled={busy} onClick={toggleSilence} style={{ width: '100%', marginTop: 12, padding: '12px', background: silenceActive ? 'rgba(107,203,119,0.1)' : 'rgba(255,140,66,0.1)', border: `1px solid ${silenceActive ? 'rgba(107,203,119,0.3)' : 'rgba(255,140,66,0.3)'}`, borderRadius: 8, color: silenceActive ? '#6bcb77' : '#ff8c42', fontFamily: 'Orbitron,monospace', fontSize: '0.80rem', fontWeight: 700, letterSpacing: '1.5px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1 }}>
                    {silenceActive ? 'LIFT SILENCE' : 'SILENCE SUBJECT'}
                </button>
            </div>

            {/* Wallet + Merit row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={S.card}>
                    <div style={S.cardTitle}>WALLET</div>
                    <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '1.1rem', color: '#4ecdc4', fontWeight: 700, marginBottom: 10 }}>{user.wallet.toLocaleString()} ₡</div>
                    <input style={{ ...inp, marginBottom: 8, padding: '8px 10px' }} value={walletAmt} onChange={e => setWalletAmt(e.target.value)} placeholder="100" />
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button disabled={busy} onClick={() => adjustWallet(1)} style={{ flex: 1, padding: '9px 0', background: 'rgba(107,203,119,0.1)', border: '1px solid rgba(107,203,119,0.25)', borderRadius: 7, color: '#6bcb77', fontFamily: 'Orbitron,monospace', fontSize: '0.78rem', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1 }}>+ADD</button>
                        <button disabled={busy} onClick={() => adjustWallet(-1)} style={{ flex: 1, padding: '9px 0', background: 'rgba(255,51,51,0.07)', border: '1px solid rgba(255,51,51,0.2)', borderRadius: 7, color: '#ff6666', fontFamily: 'Orbitron,monospace', fontSize: '0.78rem', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1 }}>-TAKE</button>
                    </div>
                </div>
                <div style={S.card}>
                    <div style={S.cardTitle}>MERIT</div>
                    <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '1.1rem', color: '#c5a059', fontWeight: 700, marginBottom: 10 }}>{user.score}</div>
                    <input style={{ ...inp, marginBottom: 8, padding: '8px 10px' }} value={meritAmt} onChange={e => setMeritAmt(e.target.value)} placeholder="50" />
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button disabled={busy} onClick={() => adjustMerit(1)} style={{ flex: 1, padding: '9px 0', background: 'rgba(197,160,89,0.1)', border: '1px solid rgba(197,160,89,0.25)', borderRadius: 7, color: '#c5a059', fontFamily: 'Orbitron,monospace', fontSize: '0.78rem', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1 }}>+ADD</button>
                        <button disabled={busy} onClick={() => adjustMerit(-1)} style={{ flex: 1, padding: '9px 0', background: 'rgba(255,51,51,0.07)', border: '1px solid rgba(255,51,51,0.2)', borderRadius: 7, color: '#ff6666', fontFamily: 'Orbitron,monospace', fontSize: '0.78rem', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1 }}>-TAKE</button>
                    </div>
                </div>
            </div>

            {/* Rank */}
            <div style={S.card}>
                <div style={S.cardTitle}>RANK — {user.rank}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <select value={newRank} onChange={e => setNewRank(e.target.value)}
                        style={{ flex: 1, background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 8, color: '#c5a059', fontFamily: 'Orbitron,monospace', fontSize: '0.76rem', padding: '11px 10px', outline: 'none', cursor: 'pointer' }}>
                        {RANKS.map(r => <option key={r} value={r} style={{ background: '#111', color: '#c5a059' }}>{r}</option>)}
                    </select>
                    <button disabled={busy} onClick={changeRank}
                        style={{ padding: '11px 14px', background: 'rgba(197,160,89,0.1)', border: '1px solid rgba(197,160,89,0.3)', borderRadius: 8, color: '#c5a059', fontFamily: 'Orbitron,monospace', fontSize: '0.76rem', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1, flexShrink: 0 }}>
                        SET
                    </button>
                    <button disabled={busy} onClick={promoteNext}
                        style={{ padding: '11px 10px', background: 'linear-gradient(135deg,rgba(197,160,89,0.18),rgba(197,160,89,0.06))', border: '1px solid rgba(197,160,89,0.35)', borderRadius: 8, color: '#c5a059', fontFamily: 'Orbitron,monospace', fontSize: '0.76rem', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1, flexShrink: 0, fontWeight: 700 }}>
                        ↑ UP
                    </button>
                </div>
            </div>

            {/* Routine */}
            <div style={S.card}>
                <div style={S.cardTitle}>ASSIGNED ROUTINE</div>
                <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.68rem', color: '#444', marginBottom: 8, letterSpacing: '1px' }}>
                    {user.parameters?.routine && user.parameters.routine !== 'None' ? 'CURRENT: ' + user.parameters.routine.slice(0, 60) + (user.parameters.routine.length > 60 ? '...' : '') : 'NO ROUTINE ASSIGNED'}
                </div>
                <textarea value={routineText} onChange={e => setRoutineText(e.target.value)} placeholder="Describe the daily routine for this subject..." rows={3}
                    style={{ ...inp, resize: 'none', lineHeight: 1.5, marginBottom: 10 } as React.CSSProperties} />
                <button disabled={savingRoutine} onClick={saveRoutine}
                    style={{ width: '100%', padding: '11px', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 8, color: '#a78bfa', fontFamily: 'Orbitron,monospace', fontSize: '0.80rem', fontWeight: 700, letterSpacing: '1.5px', cursor: savingRoutine ? 'default' : 'pointer', opacity: savingRoutine ? 0.5 : 1 }}>
                    {savingRoutine ? 'SAVING...' : 'SAVE ROUTINE'}
                </button>
            </div>

            {/* Issue task */}
            <div style={S.card}>
                <div style={S.cardTitle}>ISSUE TASK</div>
                <textarea value={taskText} onChange={e => setTaskText(e.target.value)} placeholder="Describe the task for this subject..." rows={3}
                    style={{ ...inp, resize: 'none', lineHeight: 1.5, marginBottom: 10 } as React.CSSProperties} />
                <button disabled={busy || !taskText.trim()} onClick={issueTask}
                    style={{ width: '100%', padding: '12px', background: taskText.trim() ? 'rgba(197,160,89,0.12)' : '#111', border: `1px solid ${taskText.trim() ? 'rgba(197,160,89,0.35)' : '#222'}`, borderRadius: 8, color: taskText.trim() ? '#c5a059' : '#444', fontFamily: 'Orbitron,monospace', fontSize: '0.94rem', fontWeight: 700, letterSpacing: '1.5px', cursor: taskText.trim() && !busy ? 'pointer' : 'default', opacity: busy ? 0.4 : 1 }}>
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

    useEffect(() => {
        fetchMessages();
        const supabase = createClient();
        const ch = supabase
            .channel('mob-chat-live-' + user.memberId)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chats' }, (payload: any) => {
                const msg = payload.new;
                if (!msg) return;
                const msgEmail = (msg.member_id || '').toLowerCase();
                const userEmail = (user.memberId || '').toLowerCase();
                if (msgEmail !== userEmail) return;
                // Append new message directly without refetching all history
                setMessages(prev => [...prev, msg]);
            })
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [fetchMessages, user.memberId]);

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
                    <button key={t} onClick={() => setChatTab(t)} style={{ flex: 1, padding: '12px', background: 'none', border: 'none', borderBottom: chatTab === t ? '2px solid #c5a059' : '2px solid transparent', color: chatTab === t ? '#c5a059' : '#444', fontFamily: 'Orbitron,monospace', fontSize: '0.76rem', letterSpacing: '2px', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
                        {t === 'chat' ? 'CHAT' : 'SERVICE'}
                    </button>
                ))}
            </div>

            {chatTab === 'chat' && (
                <div ref={scrollBoxRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, WebkitOverflowScrolling: 'touch' as any, background: '#030303' }}>
                    {loadingMsgs && <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'Orbitron,monospace', fontSize: '0.76rem', color: '#2a2a2a', letterSpacing: '2px' }}>LOADING...</div>}
                    {!loadingMsgs && chatMsgs.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'Orbitron,monospace', fontSize: '0.76rem', color: '#1e1e1e', letterSpacing: '2px' }}>NO MESSAGES YET</div>}
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
                                                <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.68rem', color: '#c5a059', letterSpacing: '3px', marginBottom: 8 }}>✦ RANK PROMOTION</div>
                                                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.9rem', color: '#fff', fontWeight: 700, marginBottom: 8 }}>{d.name}</div>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                                                    <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.74rem', color: 'rgba(197,160,89,0.35)', textDecoration: 'line-through' }}>{d.oldRank}</span>
                                                    <span style={{ color: '#c5a059', fontSize: '0.8rem' }}>→</span>
                                                    <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.94rem', color: '#c5a059', fontWeight: 700 }}>{d.newRank}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.62rem', color: 'rgba(197,160,89,0.35)', marginTop: 4 }}>{timeStr}</span>
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
                                                <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.68rem', color: 'rgba(197,160,89,0.55)', letterSpacing: '2px', marginBottom: 4 }}>TASK FEEDBACK</div>
                                                {note && <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.96rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>{note}</div>}
                                            </div>
                                        </div>
                                        <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.62rem', color: 'rgba(197,160,89,0.35)', marginTop: 4 }}>{timeStr}</span>
                                    </div>
                                );
                            } catch { /* fall through */ }
                        }

                        return (
                            <div key={msg.id || i} style={{ display: 'flex', flexDirection: 'column', alignItems: isAdmin ? 'flex-end' : 'flex-start' }}>
                                <div style={{ background: isAdmin ? '#000' : '#1c1c1e', color: '#fff', padding: (isPhoto || isVideo) ? '4px' : '10px 14px', borderRadius: isAdmin ? '16px 16px 3px 16px' : '16px 16px 16px 3px', maxWidth: '78%', fontSize: '0.95rem', lineHeight: 1.55, fontFamily: 'Orbitron,sans-serif', wordBreak: 'break-word', boxShadow: isAdmin ? '0 0 0 1px rgba(197,160,89,0.55)' : undefined, border: !isAdmin ? '1px solid rgba(255,255,255,0.06)' : undefined }}>
                                    {isPhoto ? <img src={text} style={{ display: 'block', maxWidth: 220, maxHeight: 220, borderRadius: 10, objectFit: 'cover' }} alt="" />
                                        : isVideo ? <video src={text} controls playsInline style={{ display: 'block', maxWidth: 220, borderRadius: 10 }} />
                                            : <span>{text}</span>}
                                </div>
                                <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.62rem', color: isAdmin ? '#444' : 'rgba(197,160,89,0.4)', marginTop: 3 }}>{timeStr}</span>
                            </div>
                        );
                    })}
                    <div ref={bottomRef} />
                </div>
            )}

            {chatTab === 'service' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, WebkitOverflowScrolling: 'touch' as any, background: '#030303' }}>
                    {sysMsgs.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'Orbitron,monospace', fontSize: '0.76rem', color: '#1e1e1e', letterSpacing: '2px' }}>NO SERVICE MESSAGES</div>}
                    {sysMsgs.map((msg, i) => {
                        const d = new Date(msg.created_at || Date.now());
                        const content = msg.content || msg.message || '';
                        return (
                            <div key={msg.id || i} style={{ background: 'rgba(255,255,255,0.02)', borderLeft: '2px solid rgba(197,160,89,0.4)', padding: '9px 14px', borderRadius: '0 6px 6px 0' }}>
                                <span style={{ fontFamily: 'Orbitron,sans-serif', color: '#c5a059', fontSize: '0.96rem', lineHeight: 1.5, display: 'block', marginBottom: 4 }}>{content}</span>
                                <span style={{ fontFamily: 'Orbitron,monospace', color: '#333', fontSize: '0.76rem', letterSpacing: '1px' }}>{d.toLocaleDateString()} · {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        );
                    })}
                </div>
            )}

            {sendError && <div style={{ padding: '6px 14px', background: 'rgba(255,0,0,0.08)', color: '#ff6666', fontFamily: 'Orbitron,monospace', fontSize: '0.70rem', textAlign: 'center' }}>{sendError}</div>}

            {chatTab === 'chat' && (
                <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: '1px solid rgba(197,160,89,0.1)', flexShrink: 0, background: 'rgba(4,4,4,0.98)' }}>
                    <input type="text" value={input} onChange={e => { setInput(e.target.value); setSendError(''); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendMessage(); } }}
                        placeholder="Issue command..." autoComplete="off"
                        style={{ flex: 1, background: 'rgba(14,14,14,0.95)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 8, color: '#fff', padding: '10px 14px', fontFamily: 'Rajdhani,sans-serif', fontSize: '16px', outline: 'none' }} />
                    <button onTouchEnd={e => { e.preventDefault(); sendMessage(); }} onClick={sendMessage}
                        style={{ background: canSend ? '#c5a059' : '#111', border: '1px solid rgba(197,160,89,0.3)', borderRadius: 8, color: canSend ? '#000' : '#333', fontFamily: 'Orbitron,monospace', fontSize: '0.94rem', letterSpacing: '1px', padding: '10px 14px', cursor: canSend ? 'pointer' : 'default', flexShrink: 0, fontWeight: 700, WebkitTapHighlightColor: 'transparent' }}>
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
                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.86rem', color: '#c5a059', letterSpacing: '4px', marginBottom: 2 }}>QUEEN'S DISPATCH</div>
                <input type="text" placeholder="Title (optional)" value={title} onChange={e => setTitle(e.target.value)} style={inp} />
                <textarea placeholder="Write your decree..." value={body} onChange={e => setBody(e.target.value)} rows={4}
                    style={{ ...inp, resize: 'none', lineHeight: 1.6 } as React.CSSProperties} />

                {/* Image upload */}
                <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleImagePick} style={{ display: 'none' }} />
                {imagePreview ? (
                    <div style={{ position: 'relative', width: '100%' }}>
                        <img src={imagePreview} style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(197,160,89,0.2)' }} alt="" />
                        <button onClick={() => { setImageFile(null); setImagePreview(null); }} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.8)', border: '1px solid #333', borderRadius: '50%', width: 28, height: 28, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.86rem' }}>✕</button>
                    </div>
                ) : (
                    <button onClick={() => fileInputRef.current?.click()} style={{ width: '100%', padding: '10px', background: 'rgba(197,160,89,0.03)', border: '1px dashed rgba(197,160,89,0.15)', borderRadius: 8, color: '#555', fontFamily: 'Orbitron,monospace', fontSize: '0.76rem', letterSpacing: '2px', cursor: 'pointer' }}>
                        + ADD PHOTO / VIDEO
                    </button>
                )}

                {uploadProgress && <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.90rem', color: '#c5a059', textAlign: 'center', letterSpacing: '1px' }}>{uploadProgress}</div>}

                <button onClick={submitPost} disabled={submitting || !body.trim()}
                    style={{ background: !submitting && body.trim() ? '#c5a059' : '#1a1a1a', color: !submitting && body.trim() ? '#000' : '#444', border: 'none', borderRadius: 8, fontFamily: 'Orbitron,sans-serif', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '3px', padding: '14px', cursor: !submitting && body.trim() ? 'pointer' : 'default' }}>
                    {submitting ? 'PUBLISHING...' : 'PUBLISH DECREE'}
                </button>
            </div>

            {posts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'Orbitron,monospace', fontSize: '0.76rem', color: '#1e1e1e', letterSpacing: '2px' }}>NO POSTS YET</div>
            ) : posts.map((post: any) => (
                <div key={post.id} style={{ background: 'rgba(12,12,12,0.95)', border: '1px solid rgba(197,160,89,0.08)', borderRadius: 10, padding: '16px' }}>
                    {post.title && <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.95rem', color: '#c5a059', marginBottom: 8 }}>{post.title}</div>}
                    <div style={{ fontSize: '0.9rem', color: '#bbb', lineHeight: 1.7 }}>{post.body}</div>
                    {post.media_url && (
                        post.media_url.match(/\.(mp4|mov|webm)/i)
                            ? <video src={post.media_url} controls playsInline style={{ width: '100%', borderRadius: 8, marginTop: 10, maxHeight: 220 }} />
                            : <img src={post.media_url} style={{ width: '100%', borderRadius: 8, marginTop: 10, objectFit: 'cover', maxHeight: 220 }} alt="" />
                    )}
                    <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.68rem', color: '#2a2a2a', letterSpacing: '1.5px', marginTop: 12 }}>
                        {post.created_at ? new Date(post.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── QUEEN VIEW ───────────────────────────────────────────────────────────────
function useNotifStatus() {
    const getStatus = () => {
        if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
        return (window as any).Notification.permission as 'default' | 'granted' | 'denied';
    };
    const [status, setStatus] = useState<string>(getStatus);
    const refresh = () => setStatus(getStatus());
    return { status, refresh };
}

async function initAndRequestPush(userEmail: string, onDone: () => void) {
    const w = window as any;
    // Init OneSignal if not already done
    w.OneSignalDeferred = w.OneSignalDeferred || [];
    w.OneSignalDeferred.push(async (OS: any) => {
        try {
            await OS.init({
                appId: '761d91da-b098-44a7-8d98-75c1cce54dd0',
                safari_web_id: 'web.onesignal.auto.5f8d50ad-7ec3-4f1c-a2de-134e8949294e',
                notifyButton: { enable: false },
                allowLocalhostAsSecureOrigin: true,
            });
            await OS.login(userEmail);
            // Always persist subscription ID after init (it may change between sessions)
            const subId = OS?.User?.PushSubscription?.id;
            if (subId) {
                fetch('/api/push', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subscriptionId: subId }),
                }).catch(() => {});
            }
        } catch { /* already inited */ }
    });

    // Request permission
    const perm = ('Notification' in window) ? (window as any).Notification.permission : 'unsupported';
    if (perm === 'denied') {
        alert('Notifications are blocked. Go to browser Settings → Site Settings → Notifications → find this site → Allow.');
    } else if (perm === 'granted') {
        alert('Notifications are already enabled.');
    } else {
        const OS = w.OneSignal;
        if (OS?.Notifications?.requestPermission) {
            await OS.Notifications.requestPermission();
        } else {
            await (window as any).Notification.requestPermission();
        }
    }

    // Save subscription ID to DB so incoming message pushes can reach this device
    try {
        const OS = w.OneSignal;
        const subId = OS?.User?.PushSubscription?.id;
        if (subId) {
            await fetch('/api/push', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriptionId: subId }),
            });
        }
    } catch { /* non-critical */ }

    onDone();
}

function QueenView({ userEmail, onLogout, users, stats }: { userEmail: string; onLogout: () => void; users: DashUser[]; stats: any }) {
    const [broadcastText, setBroadcastText] = useState('');
    const [broadcasting, setBroadcasting] = useState(false);
    const [broadcastStatus, setBroadcastStatus] = useState('');
    const { status: notifStatus, refresh: refreshNotif } = useNotifStatus();

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
                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '1.35rem', color: '#c5a059', letterSpacing: '4px', marginTop: 4 }}>QUEEN KARIN</div>
                <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.74rem', color: '#444', letterSpacing: '3px' }}>SYSTEM ADMINISTRATOR</div>
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
                        <span style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.74rem', color: '#444', letterSpacing: '1px' }}>{item.label}</span>
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
                    <div style={{ background: broadcastStatus.startsWith('✓') ? 'rgba(107,203,119,0.1)' : 'rgba(255,51,51,0.1)', border: `1px solid ${broadcastStatus.startsWith('✓') ? 'rgba(107,203,119,0.3)' : 'rgba(255,51,51,0.3)'}`, borderRadius: 6, padding: '8px 12px', fontFamily: 'Orbitron,monospace', fontSize: '0.74rem', color: broadcastStatus.startsWith('✓') ? '#6bcb77' : '#ff6666', marginBottom: 8, textAlign: 'center' }}>{broadcastStatus}</div>
                )}
                <button disabled={broadcasting || !broadcastText.trim()} onClick={sendBroadcast}
                    style={{ width: '100%', padding: '13px', background: !broadcasting && broadcastText.trim() ? 'rgba(197,160,89,0.12)' : '#111', border: `1px solid ${!broadcasting && broadcastText.trim() ? 'rgba(197,160,89,0.35)' : '#222'}`, borderRadius: 8, color: !broadcasting && broadcastText.trim() ? '#c5a059' : '#333', fontFamily: 'Orbitron,monospace', fontSize: '0.94rem', fontWeight: 700, letterSpacing: '1.5px', cursor: !broadcasting && broadcastText.trim() ? 'pointer' : 'default' }}>
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
                            style={{ display: 'block', width: '100%', background: 'rgba(197,160,89,0.04)', border: `1px solid ${item.c}`, color: '#c5a059', fontFamily: 'Orbitron,sans-serif', fontSize: '0.90rem', letterSpacing: '3px', padding: '14px', cursor: 'pointer', borderRadius: 8, textAlign: 'center' }}>
                            {item.label} ↗
                        </button>
                    ))}
                </div>
            </div>

            {/* Notifications */}
            <div style={S.card}>
                <div style={S.cardTitle}>PUSH NOTIFICATIONS</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '0.88rem', color: '#666', lineHeight: 1.4 }}>
                        {notifStatus === 'granted' ? 'Enabled — you will receive alerts when subjects message you.' :
                         notifStatus === 'denied' ? 'Blocked in browser settings. Tap below for instructions.' :
                         notifStatus === 'unsupported' ? 'Not supported on this browser.' :
                         'Enable to receive alerts when subjects message you.'}
                    </div>
                    <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.72rem', fontWeight: 700, color: notifStatus === 'granted' ? '#6bcb77' : notifStatus === 'denied' ? '#ff4444' : '#555', marginLeft: 12, flexShrink: 0 }}>
                        {notifStatus === 'granted' ? 'ON' : notifStatus === 'denied' ? 'BLOCKED' : 'OFF'}
                    </div>
                </div>
                {notifStatus !== 'unsupported' && (
                    <button
                        onClick={() => initAndRequestPush(userEmail, refreshNotif)}
                        style={{ width: '100%', padding: '13px', background: notifStatus === 'granted' ? 'rgba(107,203,119,0.06)' : 'linear-gradient(135deg,rgba(197,160,89,0.18),rgba(139,105,20,0.12))', border: `1px solid ${notifStatus === 'granted' ? 'rgba(107,203,119,0.25)' : 'rgba(197,160,89,0.4)'}`, borderRadius: 8, color: notifStatus === 'granted' ? '#6bcb77' : '#c5a059', fontFamily: 'Orbitron,monospace', fontSize: '0.80rem', fontWeight: 700, letterSpacing: '2px', cursor: 'pointer' }}>
                        {notifStatus === 'granted' ? '🔔 NOTIFICATIONS ON' : notifStatus === 'denied' ? '⚙ HOW TO UNBLOCK' : '🔔 ENABLE NOTIFICATIONS'}
                    </button>
                )}
            </div>

            <button onClick={onLogout} style={{ background: 'rgba(255,0,0,0.06)', border: '1px solid rgba(255,0,0,0.18)', color: '#ff4444', fontFamily: 'Orbitron,monospace', fontSize: '0.80rem', letterSpacing: '3px', padding: '16px', cursor: 'pointer', borderRadius: 8, width: '100%', flexShrink: 0 }}>
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
    topBrand: { fontFamily: 'Orbitron,sans-serif', fontSize: '0.68rem', color: '#c5a059', letterSpacing: '3px' },
    topCode: { fontFamily: 'Orbitron,monospace', fontSize: '0.85rem', color: '#c5a059', fontWeight: 900, letterSpacing: '2px', background: 'rgba(197,160,89,0.07)', padding: '3px 10px', borderRadius: 4, border: '1px solid rgba(197,160,89,0.12)' },
    content: { flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative', zIndex: 1 },
    nav: { display: 'flex', alignItems: 'stretch', height: 60, minHeight: 60, background: 'rgba(4,4,4,0.99)', borderTop: '1px solid rgba(197,160,89,0.15)', flexShrink: 0 },
    navBtn: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'none', border: 'none', borderTop: '2px solid transparent', cursor: 'pointer', padding: '6px 0', outline: 'none', WebkitTapHighlightColor: 'transparent' },
    navActive: { borderTopColor: 'rgba(197,160,89,0.5)' },
    loadWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#030303', gap: 16 },
    spinner: { width: 32, height: 32, border: '2px solid rgba(197,160,89,0.1)', borderTopColor: '#c5a059', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
    loadTxt: { fontFamily: 'Orbitron,sans-serif', fontSize: '0.86rem', color: '#c5a059', letterSpacing: '4px', margin: 0 },
    scroll: { height: '100%', overflowY: 'auto', overflowX: 'hidden', padding: '14px 12px 24px', display: 'flex', flexDirection: 'column', gap: 12, WebkitOverflowScrolling: 'touch' as any },
    heroCard: { background: "linear-gradient(135deg, rgba(197,160,89,0.08) 0%, rgba(8,6,2,0.96) 100%)", border: '1px solid rgba(197,160,89,0.18)', borderRadius: 12, padding: '22px 20px', flexShrink: 0 },
    statCard: { background: 'rgba(14,14,14,0.95)', border: '1px solid rgba(197,160,89,0.07)', borderRadius: 10, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 6 },
    card: { background: 'rgba(11,11,11,0.95)', border: '1px solid rgba(197,160,89,0.08)', borderRadius: 10, padding: '16px 14px', flexShrink: 0 },
    cardTitle: { fontFamily: 'Orbitron,sans-serif', fontSize: '0.72rem', color: '#c5a059', letterSpacing: '3px', marginBottom: 12, opacity: 0.8 },
    userCard: { display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(11,11,11,0.95)', border: '1px solid rgba(197,160,89,0.07)', borderRadius: 10, padding: '12px 14px', width: '100%', cursor: 'pointer', textAlign: 'left', WebkitTapHighlightColor: 'transparent', outline: 'none', flexShrink: 0 },
    backBtn: { alignSelf: 'flex-start', background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.15)', color: '#c5a059', fontFamily: 'Orbitron,monospace', fontSize: '0.74rem', letterSpacing: '2px', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', marginBottom: 14, WebkitTapHighlightColor: 'transparent' },
};
