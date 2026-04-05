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
    is_template?: boolean; image_url?: string | null;
}

interface Window_ {
    id: string; challenge_id: string;
    day_number: number; window_number: number;
    opens_at: string; closes_at: string;
    verification_code: number;
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

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ChallengesPage() {
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
        <div className="ch-layout">
            {/* TOP BAR */}
            <div className="ch-topbar">
                <a href="/dashboard" className="ch-back">
                    <span>←</span>
                    <span>DASHBOARD</span>
                </a>
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
function ActiveTab({ activeChallenge, detail, loading, tick, onVerify, onLaunch, onEnd, onSelectChallenge, draftChallenges, onEdit }: {
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
}) {
    const [verifying, setVerifying] = useState<string | null>(null);

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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {/* HEADER */}
            <div className="ch-section-header">
                <div>
                    <div className="ch-section-title" style={{ color }}>{challenge.name}</div>
                    <div className="ch-section-sub">
                        {challenge.status === 'active' ? `${daysLeft} days remaining · ${challenge.tasks_per_day}×/day · ${challenge.window_minutes}min windows` : challenge.status.toUpperCase()}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="ch-action-btn gold" style={{ padding: '8px 20px', fontSize: '0.45rem', letterSpacing: '2px' }} onClick={() => onEdit(challenge)}>
                        ✎ EDIT
                    </button>
                    {challenge.status === 'draft' && (
                        <button className="ch-action-btn green" style={{ padding: '8px 20px', fontSize: '0.45rem', letterSpacing: '2px' }} onClick={onLaunch}>
                            ▶ LAUNCH
                        </button>
                    )}
                    {challenge.status === 'active' && (
                        <button className="ch-action-btn red" style={{ padding: '8px 20px', fontSize: '0.45rem', letterSpacing: '2px' }} onClick={onEnd}>
                            ■ END CHALLENGE
                        </button>
                    )}
                </div>
            </div>

            {/* BANNER */}
            <div className="ch-active-banner" style={{ borderColor: `${color}44`, background: challenge.image_url ? undefined : `linear-gradient(135deg, ${color}08, rgba(0,0,0,0.3))`, overflow: 'hidden', position: 'relative' }}>
                {challenge.image_url && (
                    <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${challenge.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.18, zIndex: 0 }} />
                )}
                {challenge.status === 'active' && <div className="ch-active-dot" style={{ background: color, boxShadow: `0 0 10px ${color}`, position: 'relative', zIndex: 1 }} />}
                <div className="ch-active-info" style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    {challenge.image_url && (
                        <img src={challenge.image_url} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10, border: `1px solid ${color}44`, flexShrink: 0 }} alt="" />
                    )}
                    <div>
                    <div className="ch-active-name">{challenge.name}</div>
                    {challenge.description && <div className="ch-active-meta">{challenge.description}</div>}
                    {currentWindow && (
                        <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px', background: `${color}15`, border: `1px solid ${color}44`, borderRadius: 20 }}>
                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, animation: 'pulse 1.5s infinite' }} />
                            <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.42rem', color, letterSpacing: '1px' }}>
                                WINDOW OPEN · Day {currentWindow.day_number} Task {currentWindow.window_number}
                            </span>
                        </div>
                    )}
                    </div>
                </div>
                <div className="ch-stats-row">
                    {[
                        { val: activeCount, lbl: 'STILL IN', color: '#4ade80' },
                        { val: elimCount, lbl: 'ELIMINATED', color: '#e03030' },
                        { val: totalCount, lbl: 'TOTAL', color: '#aaa' },
                    ].map(s => (
                        <div key={s.lbl} className="ch-stat-item">
                            <div className="ch-stat-val" style={{ color: s.color }}>{s.val}</div>
                            <div className="ch-stat-lbl">{s.lbl}</div>
                        </div>
                    ))}
                </div>
            </div>

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
                                    {/* User */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0, width: 72 }}>
                                        <img src={avatar || '/queen-karin.png'} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(197,160,89,0.3)' }} onError={(e) => { (e.target as any).src = '/queen-karin.png'; }} alt="" />
                                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.6rem', color: '#ddd', textAlign: 'center', wordBreak: 'break-word' }}>{prof?.name || pv.member_id}</div>
                                        {pv.response_time_seconds !== null && (
                                            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.34rem', color: '#4ade80' }}>{fmtSeconds(pv.response_time_seconds)}</div>
                                        )}
                                    </div>

                                    {/* Window info + code */}
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

                                    {/* Proof photo */}
                                    {pv.proof_url && (
                                        <div style={{ flexShrink: 0 }}>
                                            <a href={pv.proof_url} target="_blank" rel="noreferrer">
                                                <img src={pv.proof_url} style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', display: 'block' }} alt="proof" />
                                            </a>
                                            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.32rem', color: '#444', textAlign: 'center', marginTop: 4 }}>TAP TO ENLARGE</div>
                                        </div>
                                    )}

                                    {/* Actions */}
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

            {/* LEADERBOARD */}
            <div>
                <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.42rem', color: '#555', letterSpacing: '2px', marginBottom: 14 }}>
                    LEADERBOARD — {leaderboard.length} PARTICIPANTS
                </div>
                <div className="ch-card" style={{ overflow: 'hidden' }}>
                    <table className="ch-table">
                        <thead>
                            <tr>
                                <th>RANK</th>
                                <th>PARTICIPANT</th>
                                <th>STATUS</th>
                                <th>TASKS</th>
                                <th>AVG SPEED</th>
                                <th>ELIMINATED ON</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leaderboard.length === 0 && (
                                <tr><td colSpan={6} style={{ textAlign: 'center', color: '#333', fontFamily: 'Orbitron, monospace', fontSize: '0.42rem', letterSpacing: '2px', padding: '32px' }}>NO PARTICIPANTS YET</td></tr>
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
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <img src={p.avatar || '/queen-karin.png'} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }} onError={(e) => { (e.target as any).src = '/queen-karin.png'; }} alt="" />
                                                <span style={{ fontFamily: 'Cinzel, serif', color: isChamp ? '#c5a059' : '#ddd' }}>{p.name}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`ch-status ${isElim ? 'ended' : 'active'}`} style={{ background: isChamp ? 'rgba(197,160,89,0.15)' : undefined, color: isChamp ? '#c5a059' : undefined }}>
                                                {isChamp ? '♛ CHAMPION' : isElim ? 'ELIMINATED' : 'ACTIVE'}
                                            </span>
                                        </td>
                                        <td style={{ fontFamily: 'Orbitron, monospace', color: '#4ade80' }}>{p.completions_count}</td>
                                        <td style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.8rem', color: '#aaa' }}>{fmtSeconds(p.avg_response_seconds)}</td>
                                        <td style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.75rem', color: '#e03030' }}>
                                            {isElim && p.eliminated_day != null
                                                ? `Day ${p.eliminated_day} · Task ${p.eliminated_window_num}`
                                                : '—'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
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
    const [taskTimes, setTaskTimes] = useState<string[]>(() => DEFAULT_TIMES.slice(0, 3));

    const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

    // Resize taskTimes when tasks_per_day changes
    const handleTasksPerDayChange = (n: number) => {
        set('tasks_per_day', n);
        setTaskTimes(prev => {
            if (n > prev.length) return [...prev, ...DEFAULT_TIMES.slice(prev.length, n)];
            return prev.slice(0, n);
        });
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
        setTaskTimes(DEFAULT_TIMES.slice(0, c.tasks_per_day));
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
            await onCreate({ ...form, start_date: startDt.toISOString(), task_times: taskTimes });
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
                            <input type="number" className="ch-input" min={1} max={30} value={form.duration_days} onChange={e => set('duration_days', Number(e.target.value))} />
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

                    {/* Daily Task Schedule */}
                    <div>
                        <label className="ch-label" style={{ display: 'block', marginBottom: 4 }}>DAILY TASK SCHEDULE</label>
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.75rem', color: '#555', marginBottom: 12 }}>
                            Set when each task window opens. Same times repeat every day. Window stays open for {form.window_minutes} minutes.
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {taskTimes.map((t, i) => {
                                const [h, m] = t.split(':').map(Number);
                                const closeH = Math.floor((h * 60 + m + form.window_minutes) / 60) % 24;
                                const closeM = (m + form.window_minutes) % 60;
                                const closeStr = `${String(closeH).padStart(2,'0')}:${String(closeM).padStart(2,'0')}`;
                                return (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.4rem', color: '#555', width: 52, flexShrink: 0, letterSpacing: '1px' }}>TASK {i + 1}</div>
                                        <input type="time" className="ch-input" style={{ flex: 1 }} value={t}
                                            onChange={e => { const arr = [...taskTimes]; arr[i] = e.target.value; setTaskTimes(arr); }} />
                                        <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.38rem', color: '#444', flexShrink: 0, letterSpacing: '1px' }}>→ {closeStr}</div>
                                    </div>
                                );
                            })}
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
            await onSave({
                name: form.name,
                description: form.description,
                theme: form.theme,
                image_url: form.image_url || null,
                points_per_completion: Number(form.points_per_completion),
                first_place_points: Number(form.first_place_points),
                second_place_points: Number(form.second_place_points),
                third_place_points: Number(form.third_place_points),
                start_date: form.start_date ? new Date(form.start_date).toISOString() : challenge.start_date,
                end_date: form.end_date ? new Date(form.end_date).toISOString() : challenge.end_date,
            });
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
