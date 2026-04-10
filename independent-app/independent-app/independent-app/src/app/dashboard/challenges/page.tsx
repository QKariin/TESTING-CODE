'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import './challenges.css';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Challenge {
    id: string; name: string; theme: string; description: string;
    status: 'draft' | 'active' | 'ended';
    duration_days: number; tasks_per_day: number; window_minutes: number;
    points_per_completion: number; first_place_points: number;
    second_place_points: number; third_place_points: number;
    start_date: string | null; end_date: string | null; created_at: string;
    participant_total?: number; participant_active?: number; participant_eliminated?: number;
    is_template?: boolean; image_url?: string | null; task_names?: string[] | null;
}

interface Window_ {
    id: string; challenge_id: string;
    day_number: number; window_number: number;
    opens_at: string; closes_at: string;
    verification_code: number;
    task_name?: string | null;
}

interface LeaderboardEntry {
    member_id: string; name: string; avatar: string | null;
    status: 'active' | 'eliminated' | 'finished' | 'champion';
    completions_count: number; avg_response_seconds: number | null;
    eliminated_day: number | null; eliminated_window_num: number | null;
    final_rank: number | null; challenge_points_earned: number;
    joined_at: string;
}

interface PendingVerification {
    id: string; member_id: string; proof_url: string | null;
    completed_at: string; response_time_seconds: number | null;
    challenge_windows: { day_number: number; window_number: number; verification_code: number; opens_at: string; closes_at: string; } | null;
    profiles: { name: string; avatar_url: string | null; profile_picture_url: string | null; } | null;
}

interface ChallengeDetail {
    challenge: Challenge;
    leaderboard: LeaderboardEntry[];
    windows: Window_[];
    pending_verifications: PendingVerification[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function themeColor(theme: string) {
    if (theme === 'red') return '#e03030';
    if (theme === 'purple') return '#a855f7';
    if (theme === 'blue') return '#3b82f6';
    return '#c5a059';
}

function fmtSeconds(s: number | null) {
    if (s === null) return '—';
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function fmtDate(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function windowIsOpen(w: Window_) {
    const now = Date.now();
    return now >= new Date(w.opens_at).getTime() && now < new Date(w.closes_at).getTime();
}

function nextWindowCountdown(windows: Window_[]): { label: string; secs: number } | null {
    const now = Date.now();
    const upcoming = windows
        .filter(w => new Date(w.opens_at).getTime() > now)
        .sort((a, b) => new Date(a.opens_at).getTime() - new Date(b.opens_at).getTime());
    if (!upcoming.length) return null;
    const secs = Math.floor((new Date(upcoming[0].opens_at).getTime() - now) / 1000);
    return { label: `Day ${upcoming[0].day_number} · Task ${upcoming[0].window_number}`, secs };
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
    return <div className={`ch-toast ${type}`}>{msg}</div>;
}

// ─── Embeddable content (used by dashboard inline panel) ──────────────────────
export function ChallengesContent({ onClose }: { onClose: () => void }) {
    return <ChallengesPage _onClose={onClose} />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ChallengesPage({ _onClose }: { _onClose?: () => void } = {}) {
    const [tab, setTab] = useState<'active' | 'create' | 'history'>('active');
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [detail, setDetail] = useState<ChallengeDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [tick, setTick] = useState(0);
    const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
    const toastTimer = useRef<any>(null);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 3500);
    };

    const loadAll = useCallback(async () => {
        const res = await fetch('/api/challenges');
        const json = await res.json();
        if (json.success) setChallenges(json.challenges);
    }, []);

    const loadDetail = useCallback(async (id: string) => {
        setLoadingDetail(true);
        try {
            const res = await fetch(`/api/challenges/${id}`);
            const json = await res.json();
            if (json.success) setDetail(json);
        } finally {
            setLoadingDetail(false);
        }
    }, []);

    useEffect(() => { loadAll(); }, [loadAll]);

    // Auto-refresh detail every 10s
    useEffect(() => {
        if (!detail) return;
        const interval = setInterval(() => loadDetail(detail.challenge.id), 10000);
        return () => clearInterval(interval);
    }, [detail, loadDetail]);

    // Countdown tick
    useEffect(() => {
        const t = setInterval(() => setTick(n => n + 1), 1000);
        return () => clearInterval(t);
    }, []);

    // Auto-open active challenge on load
    useEffect(() => {
        const active = challenges.find(c => c.status === 'active');
        if (active && !detail) loadDetail(active.id);
    }, [challenges, detail, loadDetail]);

    const activeChallenge = challenges.find(c => c.status === 'active') || null;
    const endedChallenges = challenges.filter(c => c.status === 'ended');

    return (
        <div className={_onClose ? undefined : 'ch-layout'} style={_onClose ? { display: 'grid', gridTemplateRows: '52px 1fr', height: '100%', background: 'var(--bg, #04040e)', overflow: 'hidden' } : undefined}>
            {/* TOP BAR */}
            <div className="ch-topbar">
                {_onClose ? (
                    <button onClick={_onClose} className="ch-back" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <span>←</span>
                        <span>BACK</span>
                    </button>
                ) : (
                    <a href="/dashboard" className="ch-back">
                        <span>←</span>
                        <span>DASHBOARD</span>
                    </a>
                )}
                <div style={{ width: 1, height: 30, background: 'rgba(255,255,255,0.08)' }} />
                <div className="ch-topbar-title">⚔ CHALLENGE SYSTEM</div>
                <div className="ch-topbar-sub">
                    {activeChallenge
                        ? `ACTIVE: ${activeChallenge.name.toUpperCase()}`
                        : 'NO ACTIVE CHALLENGE'}
                </div>
            </div>

            {/* BODY */}
            <div className="ch-body">
                {/* SIDEBAR */}
                <div className="ch-sidebar">
                    <div className="ch-sidebar-label">NAVIGATION</div>
                    {[
                        { key: 'active' as const, icon: '◉', label: 'ACTIVE' },
                        { key: 'create' as const, icon: '+', label: 'CREATE' },
                        { key: 'history' as const, icon: '◈', label: 'HISTORY' },
                    ].map(({ key, icon, label }) => (
                        <button
                            key={key}
                            className={`ch-tab-btn ${tab === key ? 'active' : ''}`}
                            onClick={() => setTab(key)}
                        >
                            <span className="ch-tab-icon">{icon}</span>
                            {label}
                            {key === 'active' && activeChallenge && (
                                <span style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px rgba(74,222,128,0.8)', flexShrink: 0 }} />
                            )}
                        </button>
                    ))}

                    {detail && (
                        <>
                            <div className="ch-sidebar-divider" />
                            <div className="ch-sidebar-label">CHALLENGE</div>
                            <div style={{ padding: '8px 20px' }}>
                                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', color: themeColor(detail.challenge.theme), marginBottom: 4 }}>
                                    {detail.challenge.name}
                                </div>
                                <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.36rem', color: '#555', letterSpacing: '1px' }}>
                                    {detail.challenge.duration_days}d · {detail.challenge.tasks_per_day}×/day · {detail.challenge.window_minutes}min
                                </div>
                            </div>
                            {detail.challenge.status === 'active' && (() => {
                                const next = nextWindowCountdown(detail.windows);
                                if (!next) return null;
                                const h = Math.floor(next.secs / 3600);
                                const m = Math.floor((next.secs % 3600) / 60);
                                const s = next.secs % 60;
                                return (
                                    <div style={{ margin: '4px 20px 0', padding: '10px 12px', background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 8 }}>
                                        <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.36rem', color: '#4ade80', letterSpacing: '1px', marginBottom: 4 }}>NEXT WINDOW</div>
                                        <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.8rem', color: '#4ade80', fontWeight: 700 }}>
                                            {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
                                        </div>
                                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: '#555', marginTop: 2 }}>{next.label}</div>
                                    </div>
                                );
                            })()}
                        </>
                    )}
                </div>

                {/* MAIN */}
                <div className="ch-main">
                    {tab === 'active' && (
                        <ActiveTab
                            activeChallenge={activeChallenge}
                            detail={detail}
                            loading={loadingDetail}
                            tick={tick}
                            onVerify={async (completionId, verified) => {
                                if (!detail) return;
                                const res = await fetch(`/api/challenges/${detail.challenge.id}/verify`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ completionId, verified }),
                                });
                                const json = await res.json();
                                if (json.success) {
                                    const placeLabel = json.placement === 1 ? ' 🥇 +10 bonus' : json.placement === 2 ? ' 🥈 +7 bonus' : json.placement === 3 ? ' 🥉 +5 bonus' : '';
                                    showToast(verified ? `✓ Verified — ${json.points_awarded ?? 20}pts awarded${placeLabel}` : '✕ Rejected', verified ? 'success' : 'error');
                                    loadDetail(detail.challenge.id);
                                } else {
                                    showToast(json.error || 'Error', 'error');
                                }
                            }}
                            onLaunch={async () => {
                                if (!detail) return;
                                const res = await fetch(`/api/challenges/${detail.challenge.id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ status: 'active' }),
                                });
                                const json = await res.json();
                                if (json.success) {
                                    showToast('Challenge launched!');
                                    await loadAll();
                                    loadDetail(detail.challenge.id);
                                }
                            }}
                            onEnd={async () => {
                                if (!detail) return;
                                if (!confirm('End this challenge? Winners will be ranked and badges awarded.')) return;
                                const res = await fetch(`/api/challenges/${detail.challenge.id}/end`, { method: 'POST' });
                                const json = await res.json();
                                if (json.success) {
                                    showToast(`Challenge ended · ${json.survivors} survivors`);
                                    await loadAll();
                                    loadDetail(detail.challenge.id);
                                } else {
                                    showToast(json.error || 'Error', 'error');
                                }
                            }}
                            onSelectChallenge={(c) => loadDetail(c.id)}
                            draftChallenges={challenges.filter(c => c.status === 'draft')}
                            onEdit={(c) => setEditingChallenge(c)}
                            onRefresh={() => { if (detail) loadDetail(detail.challenge.id); }}
                        />
                    )}
                    {tab === 'create' && (
                        <CreateTab
                            allChallenges={challenges}
                            onCreate={async (data) => {
                                const res = await fetch('/api/challenges', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(data),
                                });
                                const json = await res.json();
                                if (json.success) {
                                    showToast(`Created! ${json.windows_created} windows generated`);
                                    await loadAll();
                                    setTab('active');
                                    loadDetail(json.challenge.id);
                                } else {
                                    showToast(json.error || 'Error', 'error');
                                }
                            }}
                        />
                    )}
                    {tab === 'history' && (
                        <HistoryTab
                            challenges={endedChallenges}
                            onView={(c) => { loadDetail(c.id); setTab('active'); }}
                            onEdit={(c) => setEditingChallenge(c)}
                        />
                    )}
                </div>
            </div>

            {toast && <Toast msg={toast.msg} type={toast.type} />}

            {editingChallenge && (
                <EditChallengeModal
                    challenge={editingChallenge}
                    onClose={() => setEditingChallenge(null)}
                    onSave={async (updates) => {
                        const res = await fetch(`/api/challenges/${editingChallenge.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(updates),
                        });
                        const json = await res.json();
                        if (json.success) {
                            showToast('Challenge updated');
                            setEditingChallenge(null);
                            await loadAll();
                            if (detail?.challenge.id === editingChallenge.id) loadDetail(editingChallenge.id);
                        } else {
                            showToast(json.error || 'Save failed', 'error');
                        }
                    }}
                />
            )}
        </div>
    );
}

// ─── ACTIVE TAB ───────────────────────────────────────────────────────────────
function ActiveTab({ activeChallenge, detail, loading, tick, onVerify, onLaunch, onEnd, onSelectChallenge, draftChallenges, onEdit, onRefresh }: {
    activeChallenge: Challenge | null;
    detail: ChallengeDetail | null;
    loading: boolean;
    tick: number;
    onVerify: (id: string, verified: boolean) => void;
    onLaunch: () => void;
    onEnd: () => void;
    onSelectChallenge: (c: Challenge) => void;
    draftChallenges: Challenge[];
    onEdit: (c: Challenge) => void;
    onRefresh: () => void;
}) {
    const [verifying, setVerifying] = useState<string | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(true);
    const [addEmail, setAddEmail] = useState('');
    const [addingParticipant, setAddingParticipant] = useState(false);
    const [addMsg, setAddMsg] = useState<{ text: string; ok: boolean } | null>(null);

    if (loading && !detail) {
        return <div className="ch-empty">LOADING CHALLENGE DATA...</div>;
    }

    if (!detail) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div className="ch-section-header">
                    <div>
                        <div className="ch-section-title">ACTIVE CHALLENGE</div>
                        <div className="ch-section-sub">No challenge is currently running</div>
                    </div>
                </div>
                {draftChallenges.length > 0 && (
                    <div className="ch-card" style={{ padding: 24 }}>
                        <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.42rem', color: '#555', letterSpacing: '2px', marginBottom: 16 }}>DRAFT CHALLENGES — READY TO LAUNCH</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {draftChallenges.map(c => (
                                <button key={c.id} onClick={() => onSelectChallenge(c)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 10, cursor: 'pointer', textAlign: 'left' }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: themeColor(c.theme), flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontFamily: 'Cinzel, serif', color: '#ddd', fontSize: '0.9rem' }}>{c.name}</div>
                                        <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.36rem', color: '#555', marginTop: 2 }}>{c.duration_days}d · {c.tasks_per_day}×/day · starts {fmtDate(c.start_date)}</div>
                                    </div>
                                    <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.38rem', color: '#c5a059', letterSpacing: '1px' }}>SELECT →</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                <div className="ch-empty">NO ACTIVE CHALLENGE — CREATE ONE IN THE CREATE TAB</div>
            </div>
        );
    }

    const { challenge, leaderboard, windows, pending_verifications } = detail;
    const color = themeColor(challenge.theme);
    const activeCount = leaderboard.filter(p => p.status === 'active').length;
    const elimCount = leaderboard.filter(p => p.status === 'eliminated').length;
    const totalCount = leaderboard.length;
    const openWindows = windows.filter(w => windowIsOpen(w));
    const currentWindow = openWindows[0] || null;
    const daysLeft = challenge.end_date
        ? Math.max(0, Math.ceil((new Date(challenge.end_date).getTime() - Date.now()) / 86400000))
        : null;

    const handleAddParticipant = async () => {
        if (!addEmail.trim()) return;
        setAddingParticipant(true);
        try {
            const res = await fetch(`/api/challenges/${detail.challenge.id}/participants`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: addEmail.trim().toLowerCase(), waive_fee: true }),
            });
            const json = await res.json();
            if (json.success) {
                setAddMsg({ text: `Added ${addEmail}`, ok: true });
                setAddEmail('');
                onRefresh();
            } else {
                setAddMsg({ text: json.error || 'Failed', ok: false });
            }
        } finally {
            setAddingParticipant(false);
            setTimeout(() => setAddMsg(null), 3000);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* CHALLENGE CARD — clickable to toggle drawer */}
            <div
                className="ch-card"
                onClick={() => setDrawerOpen(o => !o)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
                    cursor: 'pointer', borderColor: `${color}44`,
                    background: challenge.image_url ? 'rgba(0,0,0,0.6)' : `linear-gradient(135deg, ${color}08, rgba(0,0,0,0.4))`,
                    position: 'relative', overflow: 'hidden',
                    transition: 'border-color 0.2s',
                }}
            >
                {challenge.image_url && (
                    <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${challenge.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.15, zIndex: 0 }} />
                )}
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
                    {challenge.image_url && (
                        <img src={challenge.image_url} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, border: `1px solid ${color}44`, flexShrink: 0 }} alt="" />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                            {challenge.status === 'active' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}`, flexShrink: 0, animation: 'pulse 1.5s infinite' }} />}
                            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: '#fff', fontWeight: 700, letterSpacing: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{challenge.name}</div>
                            {currentWindow && (
                                <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.36rem', color, background: `${color}18`, border: `1px solid ${color}44`, borderRadius: 20, padding: '2px 8px', flexShrink: 0 }}>
                                    WINDOW OPEN · D{currentWindow.day_number}T{currentWindow.window_number}
                                </span>
                            )}
                        </div>
                        <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.38rem', color: '#555', letterSpacing: '1px' }}>
                            {challenge.status === 'active' ? `${daysLeft}d left · ${challenge.tasks_per_day}×/day · ${challenge.window_minutes}min windows` : challenge.status.toUpperCase()}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 20, flexShrink: 0, position: 'relative', zIndex: 1 }}>
                        {[
                            { val: activeCount, lbl: 'IN', color: '#4ade80' },
                            { val: elimCount, lbl: 'OUT', color: '#e03030' },
                            { val: totalCount, lbl: 'TOTAL', color: '#666' },
                        ].map(s => (
                            <div key={s.lbl} style={{ textAlign: 'center' }}>
                                <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '1.1rem', fontWeight: 700, color: s.color }}>{s.val}</div>
                                <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.32rem', color: '#444', letterSpacing: '1px' }}>{s.lbl}</div>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0, position: 'relative', zIndex: 2 }} onClick={e => e.stopPropagation()}>
                        <button className="ch-action-btn gold" style={{ padding: '6px 14px', fontSize: '0.4rem', letterSpacing: '1.5px' }} onClick={() => onEdit(challenge)}>✎ EDIT</button>
                        {challenge.status === 'draft' && (
                            <button className="ch-action-btn green" style={{ padding: '6px 14px', fontSize: '0.4rem' }} onClick={onLaunch}>▶ LAUNCH</button>
                        )}
                        {challenge.status === 'active' && (
                            <button className="ch-action-btn red" style={{ padding: '6px 14px', fontSize: '0.4rem' }} onClick={onEnd}>■ END</button>
                        )}
                    </div>
                    <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.8rem', color: '#444', flexShrink: 0 }}>{drawerOpen ? '▲' : '▼'}</div>
                </div>
            </div>

            {/* DRAWER CONTENT */}
            {drawerOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* PENDING VERIFICATIONS */}
                    {pending_verifications.length > 0 && (
                        <div>
                            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.42rem', color: '#ff8c42', letterSpacing: '2px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff8c42', animation: 'pulse 1.5s infinite' }} />
                                {pending_verifications.length} PENDING VERIFICATION{pending_verifications.length !== 1 ? 'S' : ''}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                {pending_verifications.map(pv => {
                                    const w = pv.challenge_windows;
                                    const prof = pv.profiles;
                                    const avatar = prof?.avatar_url || prof?.profile_picture_url;
                                    const isOpen = w ? (Date.now() < new Date(w.closes_at).getTime()) : false;
                                    return (
                                        <div key={pv.id} className="ch-card" style={{ padding: '20px 24px', display: 'flex', gap: 20, alignItems: 'flex-start', borderColor: 'rgba(255,140,66,0.25)' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0, width: 72 }}>
                                                <img src={avatar || '/queen-karin.png'} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(197,160,89,0.3)' }} onError={(e) => { (e.target as any).src = '/queen-karin.png'; }} alt="" />
                                                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.6rem', color: '#ddd', textAlign: 'center', wordBreak: 'break-word' }}>{prof?.name || pv.member_id?.split('@')[0] || pv.member_id}</div>
                                                {pv.response_time_seconds !== null && (
                                                    <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.34rem', color: '#4ade80' }}>{fmtSeconds(pv.response_time_seconds)}</div>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                                                {w && (
                                                    <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.4rem', color: '#666', letterSpacing: '1px' }}>
                                                        DAY {w.day_number} · TASK {w.window_number}
                                                        {!isOpen && <span style={{ marginLeft: 8, color: '#e03030' }}>WINDOW CLOSED</span>}
                                                    </div>
                                                )}
                                                {w && (
                                                    <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '2.8rem', fontWeight: 900, color, letterSpacing: '8px', lineHeight: 1 }}>
                                                        {w.verification_code}
                                                    </div>
                                                )}
                                                <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.34rem', color: '#555', letterSpacing: '1px' }}>EXPECTED CODE</div>
                                            </div>
                                            {pv.proof_url && (
                                                <div style={{ flexShrink: 0 }}>
                                                    <a href={pv.proof_url} target="_blank" rel="noreferrer">
                                                        <img src={pv.proof_url} style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', display: 'block' }} alt="proof" />
                                                    </a>
                                                    <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.32rem', color: '#444', textAlign: 'center', marginTop: 4 }}>TAP TO ENLARGE</div>
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                                                <button
                                                    disabled={verifying === pv.id}
                                                    onClick={async () => { setVerifying(pv.id); await onVerify(pv.id, true); setVerifying(null); }}
                                                    style={{ padding: '10px 20px', background: verifying === pv.id ? '#1a1a1a' : 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 8, fontFamily: 'Orbitron, monospace', fontSize: '0.45rem', letterSpacing: '2px', cursor: 'pointer', fontWeight: 700 }}>
                                                    {verifying === pv.id ? '...' : '✓ VERIFY'}
                                                </button>
                                                <button
                                                    disabled={verifying === pv.id}
                                                    onClick={async () => { setVerifying(pv.id); await onVerify(pv.id, false); setVerifying(null); }}
                                                    style={{ padding: '10px 20px', background: verifying === pv.id ? '#1a1a1a' : 'rgba(224,48,48,0.08)', color: '#e03030', border: '1px solid rgba(224,48,48,0.25)', borderRadius: 8, fontFamily: 'Orbitron, monospace', fontSize: '0.45rem', letterSpacing: '2px', cursor: 'pointer', fontWeight: 700 }}>
                                                    {verifying === pv.id ? '...' : '✕ REJECT'}
                                                </button>
                                                {!isOpen && <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.32rem', color: '#e03030', textAlign: 'center', letterSpacing: '1px' }}>REJECT = ELIMINATE</div>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Add Participant */}
                    <div style={{ marginBottom: 20, display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                            type="email"
                            placeholder="Add participant by email..."
                            value={addEmail}
                            onChange={e => setAddEmail(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddParticipant()}
                            style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(197,160,89,0.25)', borderRadius: 8, color: '#ddd', fontFamily: 'Cinzel, serif', fontSize: '0.78rem', padding: '9px 14px', outline: 'none' }}
                        />
                        <button onClick={handleAddParticipant} disabled={addingParticipant || !addEmail.trim()}
                            style={{ padding: '9px 18px', background: 'rgba(197,160,89,0.1)', border: '1px solid rgba(197,160,89,0.35)', borderRadius: 8, color: '#c5a059', fontFamily: 'Cinzel, serif', fontSize: '0.72rem', cursor: 'pointer', flexShrink: 0 }}>
                            {addingParticipant ? '...' : '+ Add'}
                        </button>
                        {addMsg && <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.38rem', color: addMsg.ok ? '#4ade80' : '#e03030' }}>{addMsg.text}</span>}
                    </div>

                    {/* TWO-COLUMN: TASKS + LEADERBOARD */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>
                        {/* LEFT — task schedule */}
                        <WindowsManager
                            windows={windows}
                            challengeId={challenge.id}
                            windowMinutes={challenge.window_minutes}
                            tasksPerDay={challenge.tasks_per_day}
                            taskNames={challenge.task_names || []}
                            onRefresh={onRefresh}
                        />

                        {/* RIGHT — leaderboard */}
                        <div>
                            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.42rem', color: '#555', letterSpacing: '2px', marginBottom: 14 }}>
                                LEADERBOARD — {leaderboard.length} PARTICIPANTS
                            </div>
                            <div className="ch-card" style={{ overflow: 'hidden' }}>
                                <table className="ch-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>PARTICIPANT</th>
                                            <th>STATUS</th>
                                            <th>TASKS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leaderboard.length === 0 && (
                                            <tr><td colSpan={4} style={{ textAlign: 'center', color: '#333', fontFamily: 'Orbitron, monospace', fontSize: '0.42rem', letterSpacing: '2px', padding: '32px' }}>NO PARTICIPANTS YET</td></tr>
                                        )}
                                        {leaderboard.map((p, i) => {
                                            const isElim = p.status === 'eliminated';
                                            const isChamp = p.status === 'champion';
                                            const rank = isChamp ? 1 : (p.final_rank || (isElim ? null : i + 1));
                                            return (
                                                <tr key={p.member_id} style={{
                                                    opacity: isElim ? 0.35 : 1,
                                                    background: isChamp ? 'linear-gradient(90deg, rgba(197,160,89,0.12), transparent)' : undefined,
                                                    borderLeft: isElim ? 'none' : `3px solid ${isChamp ? '#c5a059' : color}`,
                                                }}>
                                                    <td>
                                                        <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.9rem', fontWeight: 700, color: isChamp ? '#c5a059' : '#aaa' }}>
                                                            {isChamp ? '♛' : (rank || '—')}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <img src={p.avatar || '/queen-karin.png'} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }} onError={(e) => { (e.target as any).src = '/queen-karin.png'; }} alt="" />
                                                            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.8rem', color: isChamp ? '#c5a059' : '#ddd' }}>{p.name}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`ch-status ${isElim ? 'ended' : 'active'}`} style={{ background: isChamp ? 'rgba(197,160,89,0.15)' : undefined, color: isChamp ? '#c5a059' : undefined, fontSize: '0.36rem' }}>
                                                            {isChamp ? '♛' : isElim ? `ELIM D${p.eliminated_day}` : 'ACTIVE'}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontFamily: 'Orbitron, monospace', color: '#4ade80' }}>{p.completions_count}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── WINDOWS MANAGER ─────────────────────────────────────────────────────────
function WindowsManager({ windows, challengeId, windowMinutes, tasksPerDay, taskNames, onRefresh }: {
    windows: Window_[];
    challengeId: string;
    windowMinutes: number;
    tasksPerDay: number;
    taskNames: string[];
    onRefresh: () => void;
}) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editDate, setEditDate] = useState('');
    const [editTime, setEditTime] = useState('');
    const [editName, setEditName] = useState('');
    const [saving, setSaving] = useState<string | null>(null);
    const [pushing, setPushing] = useState<string | null>(null);
    const [stopping, setStopping] = useState<string | null>(null);
    const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

    const now = Date.now();
    const byDay = windows.reduce((acc, w) => {
        const d = w.day_number;
        if (!acc[d]) acc[d] = [];
        acc[d].push(w);
        return acc;
    }, {} as Record<number, Window_[]>);

    const getTaskName = (w: Window_) => {
        const idx = (w.day_number - 1) * tasksPerDay + (w.window_number - 1);
        return taskNames[idx] || '';
    };

    const showMsg = (text: string, ok: boolean) => {
        setMsg({ text, ok });
        setTimeout(() => setMsg(null), 3000);
    };

    const startEdit = (w: Window_) => {
        const d = new Date(w.opens_at);
        setEditDate(d.toISOString().slice(0, 10));
        setEditTime(d.toTimeString().slice(0, 5));
        setEditName(getTaskName(w));
        setEditingId(w.id);
    };

    const saveEdit = async (w: Window_) => {
        setSaving(w.id);
        try {
            // Save window time
            const opensAt = new Date(`${editDate}T${editTime}`);
            const closesAt = new Date(opensAt.getTime() + windowMinutes * 60 * 1000);
            const res = await fetch(`/api/challenges/windows/${w.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ opens_at: opensAt.toISOString(), closes_at: closesAt.toISOString() }),
            });
            const json = await res.json();
            if (!json.success) { showMsg(json.error || 'Save failed', false); return; }

            // Save task name to challenge.task_names
            const idx = (w.day_number - 1) * tasksPerDay + (w.window_number - 1);
            const newNames = [...taskNames];
            while (newNames.length <= idx) newNames.push('');
            newNames[idx] = editName;
            await fetch(`/api/challenges/${challengeId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task_names: newNames }),
            });

            showMsg('Saved', true);
            setEditingId(null);
            onRefresh();
        } finally { setSaving(null); }
    };

    const pushNow = async (w: Window_) => {
        if (!confirm(`Push Day ${w.day_number} · Task ${w.window_number} LIVE NOW?`)) return;
        setPushing(w.id);
        try {
            const res = await fetch(`/api/challenges/windows/${w.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ push_now: true }),
            });
            const json = await res.json();
            if (json.success) { showMsg(`Day ${w.day_number} · Task ${w.window_number} is LIVE`, true); onRefresh(); }
            else showMsg(json.error || 'Push failed', false);
        } finally { setPushing(null); }
    };

    const stopNow = async (w: Window_) => {
        if (!confirm(`Stop Day ${w.day_number} · Task ${w.window_number} now? Window will close immediately.`)) return;
        setStopping(w.id);
        try {
            const res = await fetch(`/api/challenges/windows/${w.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ closes_at: new Date().toISOString() }),
            });
            const json = await res.json();
            if (json.success) { showMsg(`Day ${w.day_number} · Task ${w.window_number} stopped`, true); onRefresh(); }
            else showMsg(json.error || 'Stop failed', false);
        } finally { setStopping(null); }
    };

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: 'rgba(197,160,89,0.6)', letterSpacing: '3px', fontWeight: 700, textTransform: 'uppercase' }}>
                    Task Schedule <span style={{ color: '#333', fontFamily: 'Orbitron, monospace', fontSize: '0.5rem' }}>— {windows.length} windows</span>
                </div>
                {msg && <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.38rem', color: msg.ok ? '#4ade80' : '#e03030', letterSpacing: '1px' }}>{msg.text}</div>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {Object.keys(byDay).sort((a, b) => Number(a) - Number(b)).map(day => (
                    <div key={day}>
                        {/* Day label */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', color: '#c5a059', letterSpacing: '4px', fontWeight: 700 }}>DAY {day}</div>
                            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, rgba(197,160,89,0.25), transparent)' }} />
                        </div>

                        {/* Task cards */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {byDay[Number(day)].map(w => {
                                const isOpen = now >= new Date(w.opens_at).getTime() && now < new Date(w.closes_at).getTime();
                                const isPast = now >= new Date(w.closes_at).getTime();
                                const isEditing = editingId === w.id;
                                const isSaving = saving === w.id;
                                const isPushing = pushing === w.id;
                                const opensDate = new Date(w.opens_at);
                                const closesDate = new Date(w.closes_at);
                                const taskName = getTaskName(w);

                                const cardBg = isOpen
                                    ? 'linear-gradient(135deg, rgba(74,222,128,0.07) 0%, rgba(0,0,0,0.5) 100%)'
                                    : 'linear-gradient(135deg, rgba(18,14,30,0.95) 0%, rgba(8,6,18,0.98) 100%)';
                                const cardBorder = isOpen ? 'rgba(74,222,128,0.4)' : 'rgba(197,160,89,0.12)';
                                const cardShadow = isOpen
                                    ? '0 0 24px rgba(74,222,128,0.08), 0 4px 20px rgba(0,0,0,0.6)'
                                    : '0 2px 16px rgba(0,0,0,0.5)';

                                return (
                                    <div key={w.id} style={{
                                        background: cardBg,
                                        border: `1px solid ${cardBorder}`,
                                        borderLeft: `3px solid ${isOpen ? '#4ade80' : isPast ? '#222' : 'rgba(197,160,89,0.45)'}`,
                                        borderRadius: 10,
                                        boxShadow: cardShadow,
                                        opacity: isPast && !isOpen ? 0.38 : 1,
                                        overflow: 'hidden',
                                        transition: 'opacity 0.2s',
                                    }}>
                                        {/* Card header */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px 0' }}>
                                            {/* Task number badge */}
                                            <div style={{
                                                flexShrink: 0,
                                                background: isOpen ? 'rgba(74,222,128,0.12)' : 'rgba(197,160,89,0.07)',
                                                border: `1px solid ${isOpen ? 'rgba(74,222,128,0.3)' : 'rgba(197,160,89,0.2)'}`,
                                                borderRadius: 6,
                                                padding: '4px 10px',
                                                fontFamily: 'Orbitron, monospace',
                                                fontSize: '0.55rem',
                                                fontWeight: 700,
                                                color: isOpen ? '#4ade80' : isPast ? '#444' : '#c5a059',
                                                letterSpacing: '2px',
                                            }}>
                                                TASK {w.window_number}
                                            </div>

                                            {/* Verification code */}
                                            <div style={{
                                                fontFamily: 'Orbitron, monospace',
                                                fontSize: '1.1rem',
                                                fontWeight: 900,
                                                color: isOpen ? 'rgba(74,222,128,0.9)' : 'rgba(197,160,89,0.55)',
                                                letterSpacing: '6px',
                                                flexShrink: 0,
                                            }}>
                                                {w.verification_code}
                                            </div>

                                            {isOpen && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                                                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px rgba(74,222,128,1)', animation: 'pulse 1.2s infinite' }} />
                                                    <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.42rem', color: '#4ade80', fontWeight: 700, letterSpacing: '2px' }}>LIVE NOW</span>
                                                </div>
                                            )}

                                            <div style={{ flex: 1 }} />

                                            {/* Action buttons */}
                                            {!isEditing && (
                                                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                                    {!isPast && (
                                                        <button onClick={() => startEdit(w)} style={{
                                                            padding: '5px 13px',
                                                            background: 'rgba(197,160,89,0.07)',
                                                            border: '1px solid rgba(197,160,89,0.3)',
                                                            borderRadius: 6,
                                                            color: '#c5a059',
                                                            fontFamily: 'Cinzel, serif',
                                                            fontSize: '0.58rem',
                                                            letterSpacing: '1px',
                                                            cursor: 'pointer',
                                                        }}>Edit</button>
                                                    )}
                                                    {isOpen && (
                                                        <button onClick={() => stopNow(w)} disabled={stopping === w.id} style={{
                                                            padding: '5px 13px',
                                                            background: stopping === w.id ? 'rgba(255,255,255,0.03)' : 'rgba(224,48,48,0.1)',
                                                            border: `1px solid ${stopping === w.id ? 'rgba(255,255,255,0.08)' : 'rgba(224,48,48,0.45)'}`,
                                                            borderRadius: 6,
                                                            color: stopping === w.id ? '#444' : '#e03030',
                                                            fontFamily: 'Cinzel, serif',
                                                            fontSize: '0.58rem',
                                                            fontWeight: 700,
                                                            cursor: stopping === w.id ? 'default' : 'pointer',
                                                        }}>{stopping === w.id ? '...' : '■ Stop'}</button>
                                                    )}
                                                    {!isOpen && !isPast && (
                                                        <button onClick={() => pushNow(w)} disabled={isPushing} style={{
                                                            padding: '5px 13px',
                                                            background: isPushing ? 'rgba(255,255,255,0.03)' : 'rgba(74,222,128,0.1)',
                                                            border: `1px solid ${isPushing ? 'rgba(255,255,255,0.08)' : 'rgba(74,222,128,0.45)'}`,
                                                            borderRadius: 6,
                                                            color: isPushing ? '#444' : '#4ade80',
                                                            fontFamily: 'Cinzel, serif',
                                                            fontSize: '0.58rem',
                                                            fontWeight: 700,
                                                            cursor: isPushing ? 'default' : 'pointer',
                                                        }}>{isPushing ? '...' : '⚡ Push Live'}</button>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Task description */}
                                        {!isEditing && (
                                            <div style={{ padding: '10px 18px 6px' }}>
                                                <div style={{
                                                    fontFamily: taskName ? 'Cinzel, serif' : 'Rajdhani, sans-serif',
                                                    fontSize: taskName ? '0.85rem' : '0.75rem',
                                                    color: taskName ? 'rgba(220,215,200,0.88)' : 'rgba(255,255,255,0.18)',
                                                    fontStyle: taskName ? 'normal' : 'italic',
                                                    lineHeight: 1.6,
                                                    fontWeight: taskName ? 400 : 300,
                                                }}>
                                                    {taskName || 'No task description set — click Edit to add one'}
                                                </div>
                                            </div>
                                        )}

                                        {/* Time footer */}
                                        {!isEditing && (
                                            <div style={{ padding: '8px 18px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.38rem', color: isOpen ? 'rgba(74,222,128,0.6)' : isPast ? '#2a2a2a' : 'rgba(197,160,89,0.35)', letterSpacing: '1px' }}>
                                                    {opensDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {opensDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} — {closesDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        )}

                                        {/* Edit panel */}
                                        {isEditing && (
                                            <div style={{ padding: '12px 18px 16px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 10 }}>
                                                <textarea
                                                    placeholder="Task description shown to participants..."
                                                    value={editName}
                                                    onChange={e => setEditName(e.target.value)}
                                                    rows={3}
                                                    style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(197,160,89,0.3)', borderRadius: 7, color: '#ddd', fontFamily: 'Cinzel, serif', fontSize: '0.82rem', padding: '10px 14px', outline: 'none', resize: 'vertical', lineHeight: 1.6 }}
                                                />
                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                                    <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                                                        style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(197,160,89,0.25)', borderRadius: 6, color: '#c5a059', fontFamily: 'Orbitron, monospace', fontSize: '0.42rem', padding: '7px 12px', outline: 'none' }} />
                                                    <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)}
                                                        style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(197,160,89,0.25)', borderRadius: 6, color: '#c5a059', fontFamily: 'Orbitron, monospace', fontSize: '0.42rem', padding: '7px 12px', outline: 'none' }} />
                                                    <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.34rem', color: '#444' }}>+{windowMinutes}m window</span>
                                                    <div style={{ flex: 1 }} />
                                                    <button onClick={() => saveEdit(w)} disabled={isSaving} style={{ padding: '7px 20px', background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.4)', borderRadius: 7, color: '#4ade80', fontFamily: 'Cinzel, serif', fontSize: '0.65rem', cursor: 'pointer', fontWeight: 700, letterSpacing: '1px' }}>
                                                        {isSaving ? 'Saving...' : '✓ Save'}
                                                    </button>
                                                    <button onClick={() => setEditingId(null)} style={{ padding: '7px 14px', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#555', fontFamily: 'Cinzel, serif', fontSize: '0.65rem', cursor: 'pointer' }}>
                                                        Cancel
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
        </div>
    );
}

// ─── CREATE TAB ───────────────────────────────────────────────────────────────
function CreateTab({ allChallenges, onCreate }: {
    allChallenges: Challenge[];
    onCreate: (data: any) => Promise<void>;
}) {
    const [form, setForm] = useState({
        name: '', theme: 'gold', description: '',
        duration_days: 7, tasks_per_day: 3, window_minutes: 30,
        points_per_completion: 20,
        first_place_points: 10, second_place_points: 7, third_place_points: 5,
        start_date: '', start_time: '08:00',
        image_url: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [imageUploading, setImageUploading] = useState(false);
    const [imageError, setImageError] = useState('');
    const imageInputRef = useRef<HTMLInputElement>(null);

    const DEFAULT_TIMES = ['09:00', '13:00', '18:00', '08:00', '11:00', '15:00', '19:00', '07:00', '12:00', '21:00'];
    const makeDayTimes = (tpd: number) => DEFAULT_TIMES.slice(0, tpd);
    const makeDayNames = (tpd: number) => Array(tpd).fill('');

    const [taskTimes, setTaskTimes] = useState<string[][]>(() =>
        Array(7).fill(null).map(() => makeDayTimes(3))
    );
    const [taskNames, setTaskNames] = useState<string[][]>(() =>
        Array(7).fill(null).map(() => makeDayNames(3))
    );
    const [expandedDay, setExpandedDay] = useState<number>(0);

    const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

    const handleDurationChange = (n: number) => {
        set('duration_days', n);
        setTaskTimes(prev => {
            if (n > prev.length) return [...prev, ...Array(n - prev.length).fill(null).map(() => makeDayTimes(form.tasks_per_day))];
            return prev.slice(0, n);
        });
        setTaskNames(prev => {
            if (n > prev.length) return [...prev, ...Array(n - prev.length).fill(null).map(() => makeDayNames(form.tasks_per_day))];
            return prev.slice(0, n);
        });
    };

    const handleTasksPerDayChange = (n: number) => {
        set('tasks_per_day', n);
        setTaskTimes(prev => prev.map(d => n > d.length ? [...d, ...DEFAULT_TIMES.slice(d.length, n)] : d.slice(0, n)));
        setTaskNames(prev => prev.map(d => n > d.length ? [...d, ...Array(n - d.length).fill('')] : d.slice(0, n)));
    };

    const prefill = (c: Challenge) => {
        set('name', c.name);
        set('theme', c.theme);
        set('description', c.description || '');
        set('duration_days', c.duration_days);
        set('tasks_per_day', c.tasks_per_day);
        set('window_minutes', c.window_minutes);
        set('points_per_completion', c.points_per_completion);
        set('first_place_points', c.first_place_points);
        set('second_place_points', c.second_place_points);
        set('third_place_points', c.third_place_points);
        set('image_url', (c as any).image_url || '');
        // Support both 1D (legacy) and 2D (per-day) stored arrays
        const srcTimes = DEFAULT_TIMES.slice(0, c.tasks_per_day);
        const srcNames = (c.task_names || []).concat(Array(Math.max(0, c.tasks_per_day - ((c.task_names as any[])?.length || 0))).fill('')).slice(0, c.tasks_per_day) as string[];
        setTaskTimes(Array(c.duration_days).fill(null).map(() => [...srcTimes]));
        setTaskNames(Array(c.duration_days).fill(null).map(() => [...srcNames]));
        setExpandedDay(0);
    };

    const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImageUploading(true);
        setImageError('');
        try {
            const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
            const fd = new FormData();
            fd.append('file', file);
            fd.append('bucket', 'media');
            fd.append('folder', 'challenge-covers');
            fd.append('ext', ext);
            const res = await fetch('/api/upload', { method: 'POST', body: fd });
            const json = await res.json();
            if (json.url) {
                set('image_url', json.url);
            } else {
                setImageError(json.error || 'Upload failed — try again');
            }
        } catch {
            setImageError('Upload failed — check connection');
        } finally {
            setImageUploading(false);
            if (imageInputRef.current) imageInputRef.current.value = '';
        }
    };

    const handleSubmit = async () => {
        if (!form.name || !form.start_date) return;
        setSubmitting(true);
        try {
            const startDt = new Date(`${form.start_date}T${form.start_time}:00`);
            await onCreate({ ...form, start_date: startDt.toISOString(), task_times: taskTimes, task_names: taskNames });
        } finally {
            setSubmitting(false);
        }
    };

    const themes = [
        { key: 'gold', label: 'GOLD' }, { key: 'red', label: 'RED' },
        { key: 'purple', label: 'PURPLE' }, { key: 'blue', label: 'BLUE' },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div className="ch-section-header">
                <div>
                    <div className="ch-section-title">CREATE CHALLENGE</div>
                    <div className="ch-section-sub">All challenges are saved as templates for reuse</div>
                </div>
            </div>

            {/* Past challenges */}
            {allChallenges.length > 0 && (
                <div>
                    <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.42rem', color: '#555', letterSpacing: '2px', marginBottom: 12 }}>USE A PAST CHALLENGE</div>
                    <div className="ch-templates-grid">
                        {allChallenges.map(c => (
                            <div key={c.id} className="ch-template-card" onClick={() => prefill(c)}>
                                <span className={`ch-template-badge badge-${c.status}`}>{c.status.toUpperCase()}</span>
                                <div className="ch-template-name">{c.name}</div>
                                <div className="ch-template-meta">
                                    <span>{c.duration_days} days · {c.tasks_per_day}×/day · {c.window_minutes}min windows</span>
                                    <span style={{ color: themeColor(c.theme) }}>◉ {c.theme.toUpperCase()}</span>
                                    {c.participant_total != null && <span>{c.participant_total} participants</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Form */}
            <div className="ch-card">
                <div className="ch-form">
                    {/* Name + Theme */}
                    <div className="ch-form-grid">
                        <div className="ch-field">
                            <label className="ch-label">CHALLENGE NAME</label>
                            <input className="ch-input" placeholder="e.g. Iron Week" value={form.name} onChange={e => set('name', e.target.value)} />
                        </div>
                        <div className="ch-field">
                            <label className="ch-label">THEME</label>
                            <div className="ch-theme-row">
                                {themes.map(t => (
                                    <button key={t.key} type="button" className={`ch-theme-chip ${form.theme === t.key ? 'active' : ''}`} data-theme={t.key} onClick={() => set('theme', t.key)}>
                                        <div className="dot" />
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="ch-field">
                        <label className="ch-label">DESCRIPTION (OPTIONAL)</label>
                        <textarea className="ch-input" placeholder="What is this challenge about..." value={form.description} onChange={e => set('description', e.target.value)} />
                    </div>

                    {/* Cover Image */}
                    <div className="ch-field">
                        <label className="ch-label">COVER IMAGE (OPTIONAL)</label>
                        <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImagePick} />
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                            {form.image_url ? (
                                <div style={{ position: 'relative', flexShrink: 0 }}>
                                    <img src={form.image_url} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10, border: '2px solid rgba(74,222,128,0.4)' }} alt="cover" />
                                    <button type="button" onClick={() => { set('image_url', ''); setImageError(''); }} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#e03030', border: 'none', color: '#fff', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>✕</button>
                                </div>
                            ) : null}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <button type="button" onClick={() => imageInputRef.current?.click()}
                                    style={{ padding: '10px 18px', background: form.image_url ? 'rgba(74,222,128,0.06)' : 'rgba(197,160,89,0.06)', border: `1px solid ${form.image_url ? 'rgba(74,222,128,0.3)' : 'rgba(197,160,89,0.2)'}`, borderRadius: 8, color: imageUploading ? '#555' : form.image_url ? '#4ade80' : '#c5a059', fontFamily: 'Orbitron, monospace', fontSize: '0.42rem', letterSpacing: '1.5px', cursor: imageUploading ? 'default' : 'pointer' }}
                                    disabled={imageUploading}>
                                    {imageUploading ? '⏳ UPLOADING...' : form.image_url ? '✓ UPLOADED — CHANGE?' : '⬆ UPLOAD COVER'}
                                </button>
                                {imageError && (
                                    <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.38rem', color: '#e03030', letterSpacing: '1px' }}>⚠ {imageError}</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Schedule */}
                    <div className="ch-form-grid-3">
                        <div className="ch-field">
                            <label className="ch-label">DURATION (DAYS)</label>
                            <input type="number" className="ch-input" min={1} max={30} value={form.duration_days} onChange={e => handleDurationChange(Math.min(30, Math.max(1, Number(e.target.value))))} />
                        </div>
                        <div className="ch-field">
                            <label className="ch-label">TASKS PER DAY</label>
                            <input type="number" className="ch-input" min={1} max={10} value={form.tasks_per_day} onChange={e => handleTasksPerDayChange(Math.min(10, Math.max(1, Number(e.target.value))))} />
                        </div>
                        <div className="ch-field">
                            <label className="ch-label">WINDOW DURATION (MIN)</label>
                            <input type="number" className="ch-input" min={5} max={120} value={form.window_minutes} onChange={e => set('window_minutes', Number(e.target.value))} />
                        </div>
                    </div>

                    {/* Start date */}
                    <div className="ch-form-grid">
                        <div className="ch-field">
                            <label className="ch-label">START DATE</label>
                            <input type="date" className="ch-input" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
                        </div>
                        <div className="ch-field">
                            <label className="ch-label">START TIME</label>
                            <input type="time" className="ch-input" value={form.start_time} onChange={e => set('start_time', e.target.value)} />
                        </div>
                    </div>

                    {/* Daily Task Schedule — per day */}
                    <div>
                        <label className="ch-label" style={{ display: 'block', marginBottom: 4 }}>DAILY TASK SCHEDULE</label>
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.75rem', color: '#555', marginBottom: 12 }}>
                            Set tasks and times for each day individually. Window stays open for {form.window_minutes} minutes.
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {taskTimes.map((dayTimes, dayIdx) => (
                                <div key={dayIdx} style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }}>
                                    {/* Day header */}
                                    <button type="button" onClick={() => setExpandedDay(expandedDay === dayIdx ? -1 : dayIdx)}
                                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', background: expandedDay === dayIdx ? 'rgba(197,160,89,0.06)' : 'rgba(255,255,255,0.01)', border: 'none', cursor: 'pointer' }}>
                                        <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.42rem', color: '#c5a059', letterSpacing: '2px', flexShrink: 0 }}>
                                            DAY {dayIdx + 1}
                                        </div>
                                        {expandedDay !== dayIdx && taskNames[dayIdx]?.some(n => n) && (
                                            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.75rem', color: '#555', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', textAlign: 'left' }}>
                                                {taskNames[dayIdx].filter(n => n).join(' · ')}
                                            </div>
                                        )}
                                        {expandedDay !== dayIdx && dayTimes.some(t => t) && (
                                            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.36rem', color: '#444', flexShrink: 0 }}>
                                                {dayTimes.join(' · ')}
                                            </div>
                                        )}
                                        <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.5rem', color: '#444', marginLeft: 'auto', flexShrink: 0 }}>
                                            {expandedDay === dayIdx ? '▲' : '▼'}
                                        </div>
                                    </button>
                                    {expandedDay === dayIdx && (
                                        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            {dayTimes.map((t, taskIdx) => {
                                                const [h, m] = t.split(':').map(Number);
                                                const closeH = Math.floor((h * 60 + m + form.window_minutes) / 60) % 24;
                                                const closeM = (m + form.window_minutes) % 60;
                                                const closeStr = `${String(closeH).padStart(2,'0')}:${String(closeM).padStart(2,'0')}`;
                                                return (
                                                    <div key={taskIdx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                        <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.38rem', color: '#666', letterSpacing: '2px' }}>TASK {taskIdx + 1}</div>
                                                        <input type="text" className="ch-input"
                                                            placeholder="Task name (e.g. Morning run, Cold shower...)"
                                                            value={taskNames[dayIdx]?.[taskIdx] || ''}
                                                            onChange={e => setTaskNames(prev => { const n = prev.map(d => [...d]); n[dayIdx][taskIdx] = e.target.value; return n; })}
                                                        />
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', color: '#555', flexShrink: 0 }}>Opens at</div>
                                                            <input type="time" className="ch-input" style={{ flex: 1 }} value={t}
                                                                onChange={e => setTaskTimes(prev => { const n = prev.map(d => [...d]); n[dayIdx][taskIdx] = e.target.value; return n; })}
                                                            />
                                                            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.38rem', color: '#444', flexShrink: 0, letterSpacing: '1px' }}>closes {closeStr}</div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                                                {dayIdx > 0 && (
                                                    <button type="button" onClick={() => {
                                                        setTaskTimes(prev => { const n = prev.map(d => [...d]); n[dayIdx] = [...taskTimes[0]]; return n; });
                                                        setTaskNames(prev => { const n = prev.map(d => [...d]); n[dayIdx] = [...taskNames[0]]; return n; });
                                                    }} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: '#555', fontFamily: 'Orbitron, monospace', fontSize: '0.35rem', letterSpacing: '1px', cursor: 'pointer' }}>
                                                        COPY FROM DAY 1
                                                    </button>
                                                )}
                                                {dayIdx === 0 && form.duration_days > 1 && (
                                                    <button type="button" onClick={() => {
                                                        setTaskTimes(prev => prev.map(() => [...taskTimes[0]]));
                                                        setTaskNames(prev => prev.map(() => [...taskNames[0]]));
                                                    }} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid rgba(197,160,89,0.2)', borderRadius: 6, color: '#c5a059', fontFamily: 'Orbitron, monospace', fontSize: '0.35rem', letterSpacing: '1px', cursor: 'pointer' }}>
                                                        COPY TO ALL DAYS
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Points */}
                    <div>
                        <label className="ch-label" style={{ display: 'block', marginBottom: 4 }}>FLAT POINTS PER VERIFIED TASK</label>
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.75rem', color: '#555', marginBottom: 10 }}>Every participant who gets a task verified earns this. Default: 20.</div>
                        <input type="number" className="ch-input" style={{ maxWidth: 120 }} min={0} value={form.points_per_completion} onChange={e => set('points_per_completion', Number(e.target.value))} />
                    </div>

                    <div>
                        <label className="ch-label" style={{ display: 'block', marginBottom: 4 }}>SPEED BONUS PER TASK (1ST/2ND/3RD)</label>
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.75rem', color: '#555', marginBottom: 10 }}>Bonus points awarded per task to the fastest 3 verified submissions.</div>
                        <div className="ch-points-row">
                            {[
                                { rank: '🥇', label: '1ST PLACE', key: 'first_place_points' },
                                { rank: '🥈', label: '2ND PLACE', key: 'second_place_points' },
                                { rank: '🥉', label: '3RD PLACE', key: 'third_place_points' },
                            ].map(({ rank, label, key }) => (
                                <div key={key} className="ch-points-card">
                                    <div className="ch-points-rank">{rank}</div>
                                    <div className="ch-points-label">{label}</div>
                                    <input type="number" className="ch-points-input" min={0}
                                        value={(form as any)[key]}
                                        onChange={e => set(key, Number(e.target.value))} />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Total windows preview */}
                    <div style={{ padding: '12px 16px', background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.1)', borderRadius: 8 }}>
                        <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.4rem', color: '#555', letterSpacing: '2px' }}>
                            TOTAL WINDOWS: </span>
                        <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.8rem', color: '#c5a059', fontWeight: 700 }}>
                            {form.duration_days * form.tasks_per_day}
                        </span>
                        <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.4rem', color: '#555', letterSpacing: '1px', marginLeft: 16 }}>
                            ({form.duration_days} days × {form.tasks_per_day} tasks)
                        </span>
                    </div>

                    <button className="ch-submit-btn" disabled={submitting || !form.name || !form.start_date} onClick={handleSubmit}>
                        {submitting ? 'CREATING...' : '⚔ CREATE & GENERATE WINDOWS'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── HISTORY TAB ──────────────────────────────────────────────────────────────
function HistoryTab({ challenges, onView, onEdit }: {
    challenges: Challenge[];
    onView: (c: Challenge) => void;
    onEdit: (c: Challenge) => void;
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div className="ch-section-header">
                <div>
                    <div className="ch-section-title">HISTORY</div>
                    <div className="ch-section-sub">{challenges.length} challenges completed</div>
                </div>
            </div>

            {challenges.length === 0 ? (
                <div className="ch-empty">NO COMPLETED CHALLENGES YET</div>
            ) : (
                <div className="ch-card" style={{ overflow: 'hidden' }}>
                    <table className="ch-table">
                        <thead>
                            <tr>
                                <th>CHALLENGE</th>
                                <th>DATES</th>
                                <th>PARTICIPANTS</th>
                                <th>SURVIVORS</th>
                                <th>THEME</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {challenges.map(c => {
                                const survived = (c.participant_total || 0) - (c.participant_eliminated || 0);
                                return (
                                    <tr key={c.id}>
                                        <td>
                                            <div style={{ fontFamily: 'Cinzel, serif', color: '#ddd' }}>{c.name}</div>
                                            {c.description && <div style={{ fontSize: '0.75rem', color: '#444', marginTop: 2 }}>{c.description}</div>}
                                        </td>
                                        <td style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.72rem', color: '#555' }}>
                                            {fmtDate(c.start_date)}<br />
                                            <span style={{ fontSize: '0.65rem' }}>→ {fmtDate(c.end_date)}</span>
                                        </td>
                                        <td style={{ fontFamily: 'Orbitron, monospace', color: '#aaa' }}>{c.participant_total || 0}</td>
                                        <td style={{ fontFamily: 'Orbitron, monospace', color: '#4ade80' }}>{survived}</td>
                                        <td>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Orbitron, monospace', fontSize: '0.38rem', color: themeColor(c.theme) }}>
                                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: themeColor(c.theme), display: 'inline-block' }} />
                                                {c.theme.toUpperCase()}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button className="ch-action-btn gold" onClick={() => onView(c)}>VIEW →</button>
                                                <button className="ch-action-btn" style={{ padding: '6px 12px', fontSize: '0.38rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#888' }} onClick={() => onEdit(c)}>✎</button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ─── EDIT CHALLENGE MODAL ─────────────────────────────────────────────────────
function EditChallengeModal({ challenge, onClose, onSave }: {
    challenge: Challenge;
    onClose: () => void;
    onSave: (updates: Record<string, any>) => Promise<void>;
}) {
    const [form, setForm] = useState({
        name: challenge.name,
        description: challenge.description || '',
        theme: challenge.theme,
        image_url: challenge.image_url || '',
        duration_days: challenge.duration_days,
        tasks_per_day: challenge.tasks_per_day,
        window_minutes: challenge.window_minutes,
        points_per_completion: challenge.points_per_completion,
        first_place_points: challenge.first_place_points,
        second_place_points: challenge.second_place_points,
        third_place_points: challenge.third_place_points,
        start_date: challenge.start_date ? challenge.start_date.slice(0, 10) : '',
        end_date: challenge.end_date ? challenge.end_date.slice(0, 10) : '',
    });
    const [saving, setSaving] = useState(false);
    const [imageUploading, setImageUploading] = useState(false);
    const [imageError, setImageError] = useState('');
    const imageInputRef = useRef<HTMLInputElement>(null);

    const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

    const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImageUploading(true);
        setImageError('');
        try {
            const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
            const fd = new FormData();
            fd.append('file', file);
            fd.append('bucket', 'media');
            fd.append('folder', 'challenge-covers');
            fd.append('ext', ext);
            const res = await fetch('/api/upload', { method: 'POST', body: fd });
            const json = await res.json();
            if (json.url) set('image_url', json.url);
            else setImageError(json.error || 'Upload failed');
        } catch { setImageError('Upload failed'); }
        finally {
            setImageUploading(false);
            if (imageInputRef.current) imageInputRef.current.value = '';
        }
    };

    const handleSave = async () => {
        if (!form.name) return;
        setSaving(true);
        try {
            const updates: Record<string, any> = {
                name: form.name,
                description: form.description,
                theme: form.theme,
                image_url: form.image_url || null,
                duration_days: Number(form.duration_days),
                tasks_per_day: Number(form.tasks_per_day),
                window_minutes: Number(form.window_minutes),
                points_per_completion: Number(form.points_per_completion),
                first_place_points: Number(form.first_place_points),
                second_place_points: Number(form.second_place_points),
                third_place_points: Number(form.third_place_points),
            };
            // Only update dates if challenge is not currently active (prevents disrupting live windows)
            if (challenge.status !== 'active') {
                updates.start_date = form.start_date ? new Date(form.start_date).toISOString() : challenge.start_date;
                updates.end_date = form.end_date ? new Date(form.end_date).toISOString() : challenge.end_date;
            }
            await onSave(updates);
        } finally { setSaving(false); }
    };

    const themes = [
        { key: 'gold', label: 'GOLD' }, { key: 'red', label: 'RED' },
        { key: 'purple', label: 'PURPLE' }, { key: 'blue', label: 'BLUE' },
    ];

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#0d0d0d', border: '1px solid rgba(197,160,89,0.2)', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                    <div>
                        <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.5rem', color: '#c5a059', letterSpacing: '3px' }}>EDIT CHALLENGE</div>
                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: '#ddd', marginTop: 3 }}>{challenge.name}</div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#666', fontSize: '1rem', cursor: 'pointer', padding: '6px 12px' }}>✕</button>
                </div>

                {/* Form */}
                <div style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImagePick} />

                    <div className="ch-field">
                        <label className="ch-label">CHALLENGE NAME</label>
                        <input className="ch-input" value={form.name} onChange={e => set('name', e.target.value)} />
                    </div>

                    <div className="ch-field">
                        <label className="ch-label">DESCRIPTION</label>
                        <textarea className="ch-input" value={form.description} onChange={e => set('description', e.target.value)} />
                    </div>

                    <div className="ch-field">
                        <label className="ch-label">THEME</label>
                        <div className="ch-theme-row">
                            {themes.map(t => (
                                <button key={t.key} type="button" className={`ch-theme-chip ${form.theme === t.key ? 'active' : ''}`} data-theme={t.key} onClick={() => set('theme', t.key)}>
                                    <div className="dot" />{t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="ch-field">
                        <label className="ch-label">COVER IMAGE</label>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                            {form.image_url && (
                                <div style={{ position: 'relative', flexShrink: 0 }}>
                                    <img src={form.image_url} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10, border: '2px solid rgba(74,222,128,0.4)' }} alt="cover" />
                                    <button type="button" onClick={() => set('image_url', '')} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#e03030', border: 'none', color: '#fff', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>✕</button>
                                </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <button type="button" onClick={() => imageInputRef.current?.click()}
                                    style={{ padding: '9px 16px', background: form.image_url ? 'rgba(74,222,128,0.06)' : 'rgba(197,160,89,0.06)', border: `1px solid ${form.image_url ? 'rgba(74,222,128,0.3)' : 'rgba(197,160,89,0.2)'}`, borderRadius: 8, color: imageUploading ? '#555' : form.image_url ? '#4ade80' : '#c5a059', fontFamily: 'Orbitron, monospace', fontSize: '0.4rem', letterSpacing: '1.5px', cursor: imageUploading ? 'default' : 'pointer' }}
                                    disabled={imageUploading}>
                                    {imageUploading ? '⏳ UPLOADING...' : form.image_url ? '✓ UPLOADED — CHANGE?' : '⬆ UPLOAD COVER'}
                                </button>
                                {imageError && <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.36rem', color: '#e03030' }}>⚠ {imageError}</div>}
                            </div>
                        </div>
                    </div>

                    <div className="ch-form-grid">
                        <div className="ch-field">
                            <label className="ch-label">START DATE</label>
                            <input type="date" className="ch-input" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
                        </div>
                        <div className="ch-field">
                            <label className="ch-label">END DATE</label>
                            <input type="date" className="ch-input" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
                        </div>
                    </div>

                    <div className="ch-form-grid">
                        <div className="ch-field">
                            <label className="ch-label">DURATION (DAYS)</label>
                            <input type="number" className="ch-input" min={1} value={form.duration_days} onChange={e => set('duration_days', e.target.value)} />
                        </div>
                        <div className="ch-field">
                            <label className="ch-label">TASKS PER DAY</label>
                            <input type="number" className="ch-input" min={1} value={form.tasks_per_day} onChange={e => set('tasks_per_day', e.target.value)} />
                        </div>
                    </div>

                    <div className="ch-field">
                        <label className="ch-label">WINDOW (MINUTES)</label>
                        <input type="number" className="ch-input" style={{ maxWidth: 120 }} min={1} value={form.window_minutes} onChange={e => set('window_minutes', e.target.value)} />
                    </div>

                    <div className="ch-field">
                        <label className="ch-label">FLAT POINTS PER TASK</label>
                        <input type="number" className="ch-input" style={{ maxWidth: 120 }} min={0} value={form.points_per_completion} onChange={e => set('points_per_completion', e.target.value)} />
                    </div>

                    <div>
                        <label className="ch-label" style={{ display: 'block', marginBottom: 12 }}>SPEED BONUS (1ST / 2ND / 3RD)</label>
                        <div className="ch-points-row">
                            {([['🥇', 'first_place_points'], ['🥈', 'second_place_points'], ['🥉', 'third_place_points']] as const).map(([rank, key]) => (
                                <div key={key} className="ch-points-card">
                                    <div className="ch-points-rank">{rank}</div>
                                    <input type="number" className="ch-points-input" min={0}
                                        value={(form as any)[key]}
                                        onChange={e => set(key, Number(e.target.value))} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
                    <button onClick={onClose} style={{ padding: '10px 20px', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#666', fontFamily: 'Orbitron, monospace', fontSize: '0.42rem', letterSpacing: '1.5px', cursor: 'pointer' }}>
                        CANCEL
                    </button>
                    <button onClick={handleSave} disabled={saving || !form.name}
                        style={{ padding: '10px 24px', background: saving ? 'rgba(197,160,89,0.1)' : 'linear-gradient(135deg,#c5a059,#8b6914)', border: 'none', borderRadius: 8, color: saving ? '#555' : '#000', fontFamily: 'Orbitron, monospace', fontSize: '0.42rem', letterSpacing: '1.5px', cursor: saving ? 'default' : 'pointer', fontWeight: 700 }}>
                        {saving ? 'SAVING...' : '✓ SAVE CHANGES'}
                    </button>
                </div>
            </div>
        </div>
    );
}
