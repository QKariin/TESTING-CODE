'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { getOptimizedUrl } from '@/scripts/media';
import { uploadToSupabase } from '@/scripts/mediaSupabase';

// ─── Types ───────────────────────────────────────────────────────────────────
interface ChatUser {
    memberId: string;
    name: string;
    avatar: string;
    hierarchy: string;
    lastSeen: string | null;
    lastMessageTime?: string | null;
}

interface ChatMessage {
    id?: string;
    member_id: string;
    sender_email: string;
    content: string;
    type: string;
    metadata?: any;
    created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isSystemMessage(msg: ChatMessage): boolean {
    const sender = (msg.sender_email || '').toLowerCase();
    const content = (msg.content || '').toUpperCase();
    return sender === 'system' ||
        content.includes('COINS RECEIVED') ||
        content.includes('TASK APPROVED') ||
        content.includes('POINTS RECEIVED') ||
        content.includes('TASK REJECTED') ||
        content.includes('TASK VERIFIED');
}

function timeAgo(dateStr: string | null): string {
    if (!dateStr) return '';
    const diff = (Date.now() - new Date(dateStr).getTime()) / 60000;
    if (diff < 1) return 'now';
    if (diff < 60) return `${Math.floor(diff)}m`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h`;
    return `${Math.floor(diff / 1440)}d`;
}

// ─── Main Chat Page ──────────────────────────────────────────────────────────
export default function ChatterChatPage() {
    const [chatterEmail, setChatterEmail] = useState<string | null>(null);
    const [users, setUsers] = useState<ChatUser[]>([]);
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [chatLoading, setChatLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const chatBoxRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const renderedIds = useRef(new Set<string>());
    const channelRef = useRef<any>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastTimestampRef = useRef<string | null>(null);
    const router = useRouter();

    // ── Auth + Role Check ────────────────────────────────────────────────
    useEffect(() => {
        (async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user?.email) { router.push('/login'); return; }

            const roleRes = await fetch('/api/chatter/role');
            const roleData = await roleRes.json();
            if (roleData.role !== 'chatter') {
                // Not a chatter - redirect
                if (roleData.role === 'queen') router.push('/dashboard');
                else router.push('/profile');
                return;
            }
            setChatterEmail(user.email.toLowerCase());
        })();
    }, [router]);

    // ── Load Users ───────────────────────────────────────────────────────
    const loadUsers = useCallback(async () => {
        try {
            const res = await fetch('/api/dashboard-list');
            const data = await res.json();
            if (data.success) {
                setUsers(data.users || []);
            }
        } catch { }
        setLoading(false);
    }, []);

    useEffect(() => {
        if (!chatterEmail) return;
        loadUsers();
        const interval = setInterval(loadUsers, 30000);
        return () => clearInterval(interval);
    }, [chatterEmail, loadUsers]);

    // ── Load Chat History ────────────────────────────────────────────────
    const loadChat = useCallback(async (memberId: string) => {
        setChatLoading(true);
        renderedIds.current.clear();
        try {
            const res = await fetch('/api/chat/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memberId }),
            });
            const data = await res.json();
            if (data.success) {
                const msgs = (data.messages || []).filter((m: ChatMessage) => !isSystemMessage(m));
                msgs.forEach((m: ChatMessage) => { if (m.id) renderedIds.current.add(String(m.id)); });
                setMessages(msgs);
                if (msgs.length > 0) {
                    lastTimestampRef.current = msgs[msgs.length - 1].created_at;
                } else {
                    lastTimestampRef.current = new Date().toISOString();
                }
            }
        } catch { }
        setChatLoading(false);
    }, []);

    // ── Select User ──────────────────────────────────────────────────────
    const selectUser = useCallback((memberId: string) => {
        // Mark previous user as read
        if (selectedUser) {
            localStorage.setItem('read_' + selectedUser, Date.now().toString());
        }
        setSelectedUser(memberId);
        setMessages([]);
        loadChat(memberId);
        setSidebarOpen(false);
    }, [selectedUser, loadChat]);

    // ── Realtime + Polling ───────────────────────────────────────────────
    useEffect(() => {
        if (!selectedUser) return;
        const supabase = createClient();

        // Realtime subscription
        const channel = supabase
            .channel('chatter-chat-' + selectedUser)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chats',
                filter: `member_id=eq.${selectedUser}`
            }, (payload) => {
                const msg = payload.new as ChatMessage;
                const id = msg.id ? String(msg.id) : null;
                if (id && renderedIds.current.has(id)) return;
                if (id) renderedIds.current.add(id);
                if (isSystemMessage(msg)) return;
                if (msg.created_at) lastTimestampRef.current = msg.created_at;
                setMessages(prev => [...prev, msg]);
            })
            .subscribe();
        channelRef.current = channel;

        // Polling fallback
        const poll = setInterval(async () => {
            if (!lastTimestampRef.current) return;
            try {
                const res = await fetch('/api/chat/history', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ memberId: selectedUser, since: lastTimestampRef.current }),
                });
                const data = await res.json();
                if (!data.success) return;
                const newMsgs = (data.messages || []).filter((m: ChatMessage) => {
                    if (isSystemMessage(m)) return false;
                    const id = m.id ? String(m.id) : null;
                    if (id && renderedIds.current.has(id)) return false;
                    if (id) renderedIds.current.add(id);
                    if (m.created_at) lastTimestampRef.current = m.created_at;
                    return true;
                });
                if (newMsgs.length > 0) setMessages(prev => [...prev, ...newMsgs]);
            } catch { }
        }, 60000);
        pollRef.current = poll;

        return () => {
            supabase.removeChannel(channel);
            clearInterval(poll);
        };
    }, [selectedUser]);

    // ── Auto-scroll ──────────────────────────────────────────────────────
    useEffect(() => {
        if (chatBoxRef.current) {
            requestAnimationFrame(() => {
                if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
            });
        }
    }, [messages]);

    // ── Send Message ─────────────────────────────────────────────────────
    const sendMessage = async () => {
        if (!inputText.trim() || !selectedUser || !chatterEmail || sending) return;
        setSending(true);
        try {
            const res = await fetch('/api/chat/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    senderEmail: chatterEmail,
                    conversationId: selectedUser,
                    content: inputText.trim(),
                    type: 'text',
                }),
            });
            const data = await res.json();
            if (data.success && data.data) {
                const id = data.data.id ? String(data.data.id) : null;
                if (id) renderedIds.current.add(id);
                setMessages(prev => [...prev, data.data]);
                setInputText('');
                inputRef.current?.focus();
            } else {
                alert(data.error || 'Failed to send');
            }
        } catch {
            alert('Network error');
        }
        setSending(false);
    };

    // ── Send Media ───────────────────────────────────────────────────────
    const handleMediaUpload = async (file: File) => {
        if (!selectedUser || !chatterEmail) return;
        const isVideo = file.type.startsWith('video/');
        const msgType = isVideo ? 'video' : 'photo';

        try {
            const url = await uploadToSupabase('media', 'chatter-chat', file);
            if (url === 'failed') { alert('Upload failed'); return; }

            const res = await fetch('/api/chat/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    senderEmail: chatterEmail,
                    conversationId: selectedUser,
                    content: url,
                    type: msgType,
                }),
            });
            const data = await res.json();
            if (data.success && data.data) {
                const id = data.data.id ? String(data.data.id) : null;
                if (id) renderedIds.current.add(id);
                setMessages(prev => [...prev, data.data]);
            }
        } catch {
            alert('Upload error');
        }
    };

    // ── Logout ───────────────────────────────────────────────────────────
    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/login');
    };

    // ── Filter users ─────────────────────────────────────────────────────
    const filteredUsers = users.filter(u => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (u.name || '').toLowerCase().includes(q) || (u.hierarchy || '').toLowerCase().includes(q);
    });

    // ── Get selected user info ───────────────────────────────────────────
    const selectedUserInfo = users.find(u => u.memberId === selectedUser);

    // ── Render ───────────────────────────────────────────────────────────
    if (!chatterEmail) {
        return (
            <div style={{ minHeight: '100vh', background: '#050508', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', color: 'rgba(197,160,89,0.5)', fontSize: '0.7rem', letterSpacing: '4px' }}>AUTHENTICATING...</div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', height: '100vh', background: '#050508', overflow: 'hidden' }}>
            {/* Mobile sidebar toggle */}
            <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                style={{
                    display: 'none',
                    position: 'fixed', top: 12, left: 12, zIndex: 1001,
                    background: 'rgba(197,160,89,0.15)', border: '1px solid rgba(197,160,89,0.3)',
                    color: '#c5a059', fontFamily: 'Orbitron', fontSize: '0.5rem',
                    padding: '8px 12px', borderRadius: 6, cursor: 'pointer', letterSpacing: '1px',
                }}
                className="chat-mob-toggle"
            >
                {sidebarOpen ? '✕' : 'SUBS'}
            </button>

            {/* SIDEBAR */}
            <div
                className={`chat-sidebar ${sidebarOpen ? 'chat-sidebar-open' : ''}`}
                style={{
                    width: 280, flexShrink: 0, background: '#0a0a0f',
                    borderRight: '1px solid rgba(197,160,89,0.1)',
                    display: 'flex', flexDirection: 'column', height: '100%',
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '18px 16px 12px', borderBottom: '1px solid rgba(197,160,89,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <div>
                        <div style={{ fontFamily: 'Orbitron', fontSize: '0.65rem', color: '#c5a059', letterSpacing: '3px' }}>QUEEN KARIN</div>
                        <div style={{ fontFamily: 'Orbitron', fontSize: '0.32rem', color: 'rgba(100,200,255,0.5)', letterSpacing: '2px', marginTop: 4 }}>CHATTER MODE</div>
                    </div>
                    <button onClick={handleLogout} style={{
                        background: 'none', border: '1px solid rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.3)', fontFamily: 'Orbitron', fontSize: '0.35rem',
                        padding: '5px 10px', borderRadius: 4, cursor: 'pointer', letterSpacing: '1px',
                    }}>
                        EXIT
                    </button>
                </div>

                {/* Search */}
                <div style={{ padding: '10px 12px' }}>
                    <input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search subjects..."
                        style={{
                            width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)',
                            color: '#fff', fontFamily: 'Rajdhani', fontSize: '0.85rem',
                            padding: '8px 12px', borderRadius: 6, outline: 'none', boxSizing: 'border-box',
                        }}
                    />
                </div>

                {/* User list */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {loading ? (
                        <div style={{ padding: 30, textAlign: 'center', fontFamily: 'Orbitron', fontSize: '0.42rem', color: 'rgba(255,255,255,0.15)', letterSpacing: '2px' }}>LOADING...</div>
                    ) : filteredUsers.length === 0 ? (
                        <div style={{ padding: 30, textAlign: 'center', fontFamily: 'Orbitron', fontSize: '0.42rem', color: 'rgba(255,255,255,0.12)', letterSpacing: '2px' }}>NO SUBJECTS</div>
                    ) : (
                        filteredUsers.map(u => {
                            const isSelected = selectedUser === u.memberId;
                            const isOnline = u.lastSeen && (Date.now() - new Date(u.lastSeen).getTime()) < 300000;
                            return (
                                <div
                                    key={u.memberId}
                                    onClick={() => selectUser(u.memberId)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '10px 14px', cursor: 'pointer',
                                        background: isSelected ? 'rgba(197,160,89,0.08)' : 'transparent',
                                        borderLeft: isSelected ? '2px solid #c5a059' : '2px solid transparent',
                                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                                        transition: 'background 0.15s',
                                    }}
                                >
                                    <div style={{ position: 'relative', flexShrink: 0 }}>
                                        <img
                                            src={u.avatar || '/collar-placeholder.png'}
                                            alt=""
                                            style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
                                            onError={(e: any) => { e.target.src = '/collar-placeholder.png'; }}
                                        />
                                        {isOnline && (
                                            <div style={{
                                                position: 'absolute', bottom: 0, right: 0,
                                                width: 8, height: 8, borderRadius: '50%',
                                                background: '#00cc66', border: '2px solid #0a0a0f',
                                            }} />
                                        )}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontFamily: 'Rajdhani', fontSize: '0.9rem', color: isSelected ? '#fff' : 'rgba(255,255,255,0.7)',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>
                                            {u.name || 'Unknown'}
                                        </div>
                                        <div style={{
                                            fontFamily: 'Orbitron', fontSize: '0.3rem', color: 'rgba(197,160,89,0.4)',
                                            letterSpacing: '1px', marginTop: 1,
                                        }}>
                                            {(u.hierarchy || 'Hall Boy').toUpperCase()}
                                            {u.lastSeen ? ` · ${timeAgo(u.lastSeen)}` : ''}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* CHAT PANEL */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                {/* Chat header */}
                <div style={{
                    padding: '14px 20px', borderBottom: '1px solid rgba(197,160,89,0.12)',
                    display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
                    background: 'rgba(0,0,0,0.3)',
                }}>
                    {selectedUserInfo ? (
                        <>
                            <img
                                src={selectedUserInfo.avatar || '/collar-placeholder.png'}
                                alt=""
                                style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                                onError={(e: any) => { e.target.src = '/collar-placeholder.png'; }}
                            />
                            <div>
                                <div style={{ fontFamily: 'Orbitron', fontSize: '0.7rem', color: '#fff', letterSpacing: '1px' }}>
                                    {selectedUserInfo.name}
                                </div>
                                <div style={{ fontFamily: 'Orbitron', fontSize: '0.3rem', color: 'rgba(197,160,89,0.5)', letterSpacing: '1px' }}>
                                    {(selectedUserInfo.hierarchy || '').toUpperCase()} · ENCRYPTED FEED
                                </div>
                            </div>
                        </>
                    ) : (
                        <div style={{ fontFamily: 'Orbitron', fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '3px' }}>
                            SELECT A SUBJECT
                        </div>
                    )}
                </div>

                {/* Messages */}
                <div
                    ref={chatBoxRef}
                    style={{
                        flex: 1, overflowY: 'auto', padding: '16px',
                        display: 'flex', flexDirection: 'column', gap: 4,
                    }}
                >
                    {!selectedUser ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '2.5rem', opacity: 0.1, marginBottom: 16 }}>👑</div>
                                <div style={{ fontFamily: 'Orbitron', fontSize: '0.55rem', color: 'rgba(255,255,255,0.12)', letterSpacing: '4px' }}>SELECT A SUBJECT TO BEGIN</div>
                            </div>
                        </div>
                    ) : chatLoading ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ fontFamily: 'Orbitron', fontSize: '0.45rem', color: 'rgba(197,160,89,0.3)', letterSpacing: '3px' }}>ESTABLISHING ENCRYPTED LINK...</div>
                        </div>
                    ) : messages.length === 0 ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ fontFamily: 'Orbitron', fontSize: '0.45rem', color: 'rgba(255,255,255,0.12)', letterSpacing: '3px' }}>NO MESSAGES YET</div>
                        </div>
                    ) : (
                        messages.map((msg, i) => {
                            const isQueen = msg.metadata?.isQueen === true;
                            const time = new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                            // Tribute card
                            if (msg.type === 'wishlist') {
                                const item = msg.metadata || {};
                                return (
                                    <div key={msg.id || i} style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
                                        <div style={{ width: 200, borderRadius: 12, overflow: 'hidden', background: '#0a080a', border: '1px solid rgba(197,160,89,0.3)' }}>
                                            {item.image && (
                                                <div style={{ height: 110, backgroundImage: `url(${getOptimizedUrl(item.image, 200)})`, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }}>
                                                    {item.price > 0 && (
                                                        <div style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.8)', borderRadius: 12, padding: '2px 8px', fontFamily: 'Orbitron', fontSize: '0.4rem', color: '#c5a059' }}>
                                                            {Number(item.price).toLocaleString()}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            <div style={{ padding: '8px 10px' }}>
                                                <div style={{ fontFamily: 'Orbitron', fontSize: '0.3rem', color: 'rgba(197,160,89,0.5)', letterSpacing: '1px' }}>TRIBUTE SENT</div>
                                                <div style={{ fontFamily: 'Rajdhani', fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{item.title || msg.content}</div>
                                            </div>
                                        </div>
                                        <div style={{ fontFamily: 'Orbitron', fontSize: '0.3rem', color: 'rgba(255,255,255,0.15)', textAlign: 'center', marginTop: 4 }}>{time}</div>
                                    </div>
                                );
                            }

                            // Regular message
                            return (
                                <div
                                    key={msg.id || i}
                                    style={{
                                        display: 'flex',
                                        justifyContent: isQueen ? 'flex-end' : 'flex-start',
                                        padding: '2px 0',
                                    }}
                                >
                                    <div style={{ maxWidth: '72%' }}>
                                        {msg.type === 'photo' ? (
                                            <div style={{
                                                padding: 4,
                                                background: isQueen ? '#000' : '#1c1c1e',
                                                border: isQueen ? '1px solid rgba(197,160,89,0.5)' : '1px solid rgba(255,255,255,0.08)',
                                                borderRadius: 12,
                                            }}>
                                                <img
                                                    src={getOptimizedUrl(msg.content, 300)}
                                                    alt=""
                                                    style={{ maxWidth: 240, maxHeight: 260, borderRadius: 10, display: 'block' }}
                                                    onError={(e: any) => { e.target.style.display = 'none'; }}
                                                />
                                            </div>
                                        ) : msg.type === 'video' ? (
                                            <div style={{
                                                padding: 4,
                                                background: isQueen ? '#000' : '#1c1c1e',
                                                border: isQueen ? '1px solid rgba(197,160,89,0.5)' : '1px solid rgba(255,255,255,0.08)',
                                                borderRadius: 12,
                                            }}>
                                                <video
                                                    src={msg.content}
                                                    controls
                                                    playsInline
                                                    preload="none"
                                                    style={{ maxWidth: 240, maxHeight: 260, borderRadius: 10, display: 'block' }}
                                                />
                                            </div>
                                        ) : (
                                            <div style={{
                                                padding: '10px 14px',
                                                background: isQueen ? '#000' : '#1c1c1e',
                                                border: isQueen ? '1px solid rgba(197,160,89,0.5)' : '1px solid rgba(255,255,255,0.08)',
                                                borderRadius: isQueen ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                                                color: isQueen ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.8)',
                                                fontFamily: 'Rajdhani, sans-serif',
                                                fontSize: '0.95rem',
                                                lineHeight: 1.4,
                                                wordBreak: 'break-word',
                                            }}>
                                                {msg.content}
                                            </div>
                                        )}
                                        <div style={{
                                            fontFamily: 'Orbitron', fontSize: '0.3rem',
                                            color: 'rgba(255,255,255,0.15)', letterSpacing: '0.5px',
                                            marginTop: 3,
                                            textAlign: isQueen ? 'right' : 'left',
                                            padding: '0 4px',
                                        }}>
                                            {time}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Input area */}
                {selectedUser && (
                    <div style={{
                        padding: '10px 14px', borderTop: '1px solid rgba(197,160,89,0.12)',
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: 'rgba(0,0,0,0.3)', flexShrink: 0,
                    }}>
                        <button
                            onClick={() => {
                                const inp = document.createElement('input');
                                inp.type = 'file';
                                inp.accept = 'image/*,video/*';
                                inp.onchange = () => {
                                    const file = inp.files?.[0];
                                    if (file) handleMediaUpload(file);
                                };
                                inp.click();
                            }}
                            style={{
                                width: 36, height: 36, borderRadius: '50%',
                                background: 'rgba(255,0,222,0.15)', border: '1px solid rgba(255,0,222,0.3)',
                                color: '#ff00de', fontSize: '1.1rem', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                            }}
                        >
                            +
                        </button>
                        <input
                            ref={inputRef}
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
                            placeholder="Issue Command..."
                            disabled={sending}
                            style={{
                                flex: 1, background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.08)',
                                color: '#fff', fontFamily: 'Rajdhani, sans-serif', fontSize: '0.95rem',
                                padding: '10px 14px', borderRadius: 6, outline: 'none',
                            }}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={sending || !inputText.trim()}
                            style={{
                                width: 42, height: 38, flexShrink: 0,
                                background: inputText.trim() ? 'rgba(197,160,89,0.2)' : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${inputText.trim() ? 'rgba(197,160,89,0.4)' : 'rgba(255,255,255,0.06)'}`,
                                color: inputText.trim() ? '#c5a059' : 'rgba(255,255,255,0.15)',
                                fontFamily: 'Rajdhani', fontSize: '1.1rem', fontWeight: 700,
                                borderRadius: 6, cursor: inputText.trim() ? 'pointer' : 'default',
                                transition: 'all 0.15s',
                            }}
                        >
                            {'>'}
                        </button>
                    </div>
                )}
            </div>

            {/* Mobile-only styles */}
            <style>{`
                @media (max-width: 768px) {
                    .chat-mob-toggle { display: block !important; }
                    .chat-sidebar {
                        position: fixed !important;
                        left: -300px !important;
                        top: 0 !important;
                        height: 100vh !important;
                        z-index: 1000 !important;
                        transition: left 0.25s ease !important;
                        box-shadow: none !important;
                    }
                    .chat-sidebar-open {
                        left: 0 !important;
                        box-shadow: 4px 0 30px rgba(0,0,0,0.8) !important;
                    }
                }
            `}</style>
        </div>
    );
}
