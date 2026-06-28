'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import '../challenges/challenges.css';

const TIERS = ['Hall Boy', 'Footman', 'Silverman', 'Butler', 'Chamberlain', 'Secretary', "Queen's Champion"];

function themeColor(theme: string) {
    if (theme === 'red') return '#e03030';
    if (theme === 'purple') return '#a855f7';
    if (theme === 'blue') return '#3b82f6';
    return '#c5a059';
}

// ─── Embeddable content (used by dashboard inline panel) ──────────────────────
export function VideoChallengesContent({ onClose }: { onClose: () => void }) {
    return <VideoChallengesPage _onClose={onClose} />;
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function VideoChallengesPage({ _onClose }: { _onClose?: () => void } = {}) {
    const [tab, setTab] = useState<'list' | 'create' | 'review'>('list');
    const [challenges, setChallenges] = useState<any[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [detail, setDetail] = useState<any>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const toastTimer = useRef<any>(null);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 3500);
    };

    const loadAll = useCallback(async () => {
        const res = await fetch('/api/video-challenges');
        const json = await res.json();
        if (json.success) setChallenges(json.challenges || []);
    }, []);

    const loadDetail = useCallback(async (id: string) => {
        const res = await fetch(`/api/video-challenges/${id}`);
        const json = await res.json();
        if (json.success) setDetail(json);
    }, []);

    useEffect(() => { loadAll(); }, [loadAll]);
    useEffect(() => {
        const t = setInterval(() => { loadAll(); if (selectedId) loadDetail(selectedId); }, 30000);
        return () => clearInterval(t);
    }, [loadAll, loadDetail, selectedId]);

    const selectChallenge = (id: string) => { setSelectedId(id); loadDetail(id); setTab('list'); };

    const totalPending = challenges.reduce((s: number, c: any) => s + (c.pending_review_count || 0), 0);

    return (
        <div className={_onClose ? undefined : 'ch-layout'} style={_onClose ? { display: 'grid', gridTemplateRows: '52px 1fr', height: '100%', background: 'var(--bg, #04040e)', overflow: 'hidden' } : undefined}>
            {/* TOP BAR */}
            <div className="ch-topbar">
                {_onClose ? (
                    <button onClick={_onClose} className="ch-back" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <span style={{ color: '#666' }}>←</span><span>BACK</span>
                    </button>
                ) : (
                    <a href="/dashboard" className="ch-back"><span>←</span><span>DASHBOARD</span></a>
                )}
                <div style={{ width: 1, height: 30, background: 'rgba(255,255,255,0.08)' }} />
                <div className="ch-topbar-title">VIDEO CHALLENGES</div>
                <div className="ch-topbar-sub">
                    {challenges.filter(c => c.status === 'active').length} ACTIVE
                </div>
            </div>

            {/* BODY */}
            <div className="ch-body">
                {/* SIDEBAR */}
                <div className="ch-sidebar">
                    <div className="ch-sidebar-label">NAVIGATION</div>
                    {([
                        { key: 'list' as const, icon: '◉', label: 'CHALLENGES' },
                        { key: 'create' as const, icon: '+', label: 'CREATE' },
                        { key: 'review' as const, icon: '⚑', label: 'REVIEW', badge: totalPending },
                    ]).map(({ key, icon, label, badge }) => (
                        <button key={key} className={`ch-tab-btn ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
                            <span className="ch-tab-icon">{icon}</span>
                            {label}
                            {badge ? <span style={{ marginLeft: 'auto', background: '#ff8c42', color: '#000', fontFamily: 'Orbitron', fontSize: '0.32rem', fontWeight: 700, padding: '2px 6px', borderRadius: 10, minWidth: 18, textAlign: 'center' }}>{badge}</span> : null}
                        </button>
                    ))}

                    {challenges.length > 0 && (
                        <>
                            <div className="ch-sidebar-divider" />
                            <div className="ch-sidebar-label">ALL VIDEO CHALLENGES</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 8px' }}>
                                {challenges.map((c: any) => {
                                    const isSelected = selectedId === c.id;
                                    const color = c.status === 'active' ? '#4ade80' : c.status === 'draft' ? '#fbbf24' : '#555';
                                    return (
                                        <button key={c.id} onClick={() => selectChallenge(c.id)}
                                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: isSelected ? 'rgba(197,160,89,0.08)' : 'transparent', border: isSelected ? '1px solid rgba(197,160,89,0.2)' : '1px solid transparent', borderRadius: 8, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.55rem', color: isSelected ? '#c5a059' : '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                                                <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.3rem', color: '#444', letterSpacing: '1px', marginTop: 1 }}>{c.status.toUpperCase()} · {c.task_count || 0} tasks · {c.participant_active ?? 0} in</div>
                                            </div>
                                            {(c.pending_review_count || 0) > 0 && <span style={{ background: '#ff8c42', color: '#000', fontFamily: 'Orbitron', fontSize: '0.32rem', fontWeight: 700, padding: '2px 6px', borderRadius: 10, minWidth: 18, textAlign: 'center' }}>{c.pending_review_count}</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                {/* MAIN CONTENT */}
                <div className="ch-main">
                    {toast && <div className={`ch-toast ${toast.type}`}>{toast.msg}</div>}

                    {tab === 'list' && (
                        selectedId && detail
                            ? <DetailView detail={detail} onRefresh={() => loadDetail(selectedId)} showToast={showToast} onBack={() => { setSelectedId(null); setDetail(null); }} />
                            : <ListView challenges={challenges} onSelect={selectChallenge} onRefresh={loadAll} showToast={showToast} />
                    )}
                    {tab === 'create' && <CreateForm showToast={showToast} onCreated={() => { loadAll(); setTab('list'); }} />}
                    {tab === 'review' && <ReviewQueue challenges={challenges} showToast={showToast} onRefresh={loadAll} />}
                </div>
            </div>
        </div>
    );
}

// ─── LIST VIEW ───────────────────────────────────────────────────────────────
function ListView({ challenges, onSelect, onRefresh, showToast }: { challenges: any[]; onSelect: (id: string) => void; onRefresh: () => void; showToast: (m: string, t: 'success' | 'error') => void }) {
    if (challenges.length === 0) {
        return <div className="ch-empty">NO VIDEO CHALLENGES YET — CREATE ONE IN THE CREATE TAB</div>;
    }

    const toggleStatus = async (id: string, newStatus: string) => {
        const res = await fetch(`/api/video-challenges/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
        });
        const json = await res.json();
        if (json.success) { showToast(`Status → ${newStatus.toUpperCase()}`, 'success'); onRefresh(); }
        else showToast(json.error || 'Failed', 'error');
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 24 }}>
            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.42rem', color: '#555', letterSpacing: '2px', marginBottom: 8 }}>ALL VIDEO CHALLENGES</div>
            {challenges.map((c: any) => {
                const color = themeColor(c.theme);
                return (
                    <div key={c.id} className="ch-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', borderColor: `${color}33` }} onClick={() => onSelect(c.id)}>
                        {c.image_url && <img src={c.image_url} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, border: `1px solid ${color}33`, flexShrink: 0 }} alt="" />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                {c.status === 'active' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px rgba(74,222,128,0.8)' }} />}
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', color: '#fff', fontWeight: 700 }}>{c.name}</div>
                                <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.3rem', color: '#555', letterSpacing: '1px', textTransform: 'uppercase' }}>{c.status}</span>
                            </div>
                            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.36rem', color: '#555', letterSpacing: '1px' }}>
                                {c.task_count || 0} tasks · {c.window_minutes}min windows · {c.scheduling_mode} · {c.participant_active ?? 0} active / {c.participant_total ?? 0} total
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                            {c.status === 'draft' && <button className="ch-action-btn green" style={{ padding: '6px 14px', fontSize: '0.4rem' }} onClick={() => toggleStatus(c.id, 'active')}>LAUNCH</button>}
                            {c.status === 'active' && <button className="ch-action-btn red" style={{ padding: '6px 14px', fontSize: '0.4rem' }} onClick={() => toggleStatus(c.id, 'ended')}>END</button>}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── DETAIL VIEW ─────────────────────────────────────────────────────────────
function DetailView({ detail, onRefresh, showToast, onBack }: { detail: any; onRefresh: () => void; showToast: (m: string, t: 'success' | 'error') => void; onBack: () => void }) {
    const { challenge, tasks, counts, admin } = detail;
    const color = themeColor(challenge.theme);
    const [reviewing, setReviewing] = useState<string | null>(null);

    const handleReview = async (submissionId: string, action: 'approve' | 'reject') => {
        setReviewing(submissionId);
        try {
            const res = await fetch(`/api/video-challenges/${challenge.id}/review`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submission_id: submissionId, action }),
            });
            const json = await res.json();
            if (json.success) { showToast(`${action === 'approve' ? 'Approved' : 'Rejected'}`, 'success'); onRefresh(); }
            else showToast(json.error || 'Failed', 'error');
        } finally { setReviewing(null); }
    };

    const toggleStatus = async (newStatus: string) => {
        const res = await fetch(`/api/video-challenges/${challenge.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
        });
        const json = await res.json();
        if (json.success) { showToast(`Status → ${newStatus.toUpperCase()}`, 'success'); onRefresh(); }
        else showToast(json.error || 'Failed', 'error');
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 24 }}>
            {/* BACK + HEADER */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button onClick={onBack} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 14px', color: '#666', fontFamily: 'Orbitron', fontSize: '0.4rem', cursor: 'pointer', letterSpacing: '1px' }}>← BACK</button>
                <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.1rem', color: '#fff', fontWeight: 700 }}>{challenge.name}</div>
                    <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.36rem', color: '#555', marginTop: 2 }}>
                        {challenge.status.toUpperCase()} · {tasks?.length || 0} tasks · {challenge.window_minutes}min · {challenge.scheduling_mode} · {challenge.min_tier ? `Min: ${challenge.min_tier}` : 'All tiers'}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {challenge.status === 'draft' && <button className="ch-action-btn green" style={{ padding: '6px 14px', fontSize: '0.4rem' }} onClick={() => toggleStatus('active')}>LAUNCH</button>}
                    {challenge.status === 'active' && <button className="ch-action-btn red" style={{ padding: '6px 14px', fontSize: '0.4rem' }} onClick={() => toggleStatus('ended')}>END</button>}
                </div>
            </div>

            {/* STATS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {[
                    { val: counts?.active ?? 0, lbl: 'ACTIVE', clr: '#4ade80' },
                    { val: counts?.completed ?? 0, lbl: 'COMPLETED', clr: '#c5a059' },
                    { val: counts?.kicked ?? 0, lbl: 'KICKED', clr: '#e03030' },
                    { val: counts?.total ?? 0, lbl: 'TOTAL', clr: '#666' },
                ].map(s => (
                    <div key={s.lbl} className="ch-card" style={{ padding: '16px 20px', textAlign: 'center' }}>
                        <div style={{ fontFamily: 'Orbitron', fontSize: '1.4rem', fontWeight: 700, color: s.clr }}>{s.val}</div>
                        <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.32rem', color: '#444', letterSpacing: '1.5px', marginTop: 4 }}>{s.lbl}</div>
                    </div>
                ))}
            </div>

            {/* INFO */}
            {(challenge.topic || challenge.items_needed) && (
                <div className="ch-card" style={{ padding: '16px 20px' }}>
                    {challenge.topic && <div style={{ fontFamily: 'Rajdhani', fontSize: '0.85rem', color: '#aaa', marginBottom: 8 }}><strong style={{ color: color }}>Topic:</strong> {challenge.topic}</div>}
                    {challenge.items_needed && <div style={{ fontFamily: 'Rajdhani', fontSize: '0.85rem', color: '#aaa' }}><strong style={{ color: color }}>Items Needed:</strong> {challenge.items_needed}</div>}
                </div>
            )}

            {/* TASKS LIST */}
            <div>
                <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.42rem', color: '#555', letterSpacing: '2px', marginBottom: 12 }}>TASKS ({tasks?.length || 0})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(tasks || []).map((t: any) => (
                        <div key={t.position} className="ch-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, border: `1px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Orbitron', fontSize: '0.7rem', color, fontWeight: 700, flexShrink: 0 }}>{t.position}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.65rem', color: '#ddd' }}>{t.title || `Task ${t.position}`}</div>
                                {t.description && <div style={{ fontFamily: 'Rajdhani', fontSize: '0.7rem', color: '#666', marginTop: 2 }}>{t.description}</div>}
                            </div>
                            {t.video_url && <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.3rem', color: '#4ade80', letterSpacing: '1px' }}>VIDEO SET</span>}
                        </div>
                    ))}
                </div>
            </div>

            {/* PENDING SUBMISSIONS */}
            {admin?.pending_submissions?.length > 0 && (
                <div>
                    <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.42rem', color: '#ff8c42', letterSpacing: '2px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff8c42', animation: 'pulse 1.5s infinite' }} />
                        {admin.pending_submissions.length} PENDING REVIEW
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {admin.pending_submissions.map((s: any) => (
                            <SubmissionCard key={s.id} submission={s} participants={admin.participants} onReview={handleReview} reviewing={reviewing} />
                        ))}
                    </div>
                </div>
            )}

            {/* PARTICIPANTS */}
            {admin?.participants?.length > 0 && (
                <div>
                    <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.42rem', color: '#555', letterSpacing: '2px', marginBottom: 12 }}>PARTICIPANTS ({admin.participants.length})</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {admin.participants.map((p: any) => {
                            const statusColor = p.status === 'active' ? '#4ade80' : p.status === 'completed' ? '#c5a059' : '#e03030';
                            return (
                                <div key={p.id} className="ch-card" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <img src={p.avatar_url || '/queen-karin.png'} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }} onError={(e: any) => { e.target.src = '/queen-karin.png'; }} alt="" />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.6rem', color: '#ddd' }}>{p.name || p.member_id}</div>
                                        <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.3rem', color: '#444', letterSpacing: '1px' }}>
                                            Task {p.current_task}/{tasks?.length || '?'} · {p.total_points} pts · {p.hierarchy}
                                            {p.rejoin_count > 0 && ` · ${p.rejoin_count} rejoin${p.rejoin_count > 1 ? 's' : ''}`}
                                        </div>
                                    </div>
                                    <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.35rem', color: statusColor, letterSpacing: '1px' }}>{p.status.toUpperCase()}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── SUBMISSION CARD ─────────────────────────────────────────────────────────
function SubmissionCard({ submission, participants, onReview, reviewing }: { submission: any; participants: any[]; onReview: (id: string, action: 'approve' | 'reject') => void; reviewing: string | null }) {
    const participant = participants?.find((p: any) => p.member_id === submission.member_id);
    const isVideo = submission.proof_type === 'video' || /\.(mp4|mov|webm|ogg)(\?|$)/i.test(submission.proof_url || '');

    return (
        <div className="ch-card" style={{ padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'flex-start', borderColor: 'rgba(255,140,66,0.25)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0, width: 72 }}>
                <img src={participant?.avatar_url || '/queen-karin.png'} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(197,160,89,0.3)' }} onError={(e: any) => { e.target.src = '/queen-karin.png'; }} alt="" />
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.55rem', color: '#ddd', textAlign: 'center' }}>{participant?.name || submission.member_id?.split('@')[0]}</div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.4rem', color: '#666', letterSpacing: '1px' }}>
                    TASK {submission.task_position}
                </div>
                <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.34rem', color: '#444' }}>
                    Submitted {submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : '-'}
                </div>
            </div>
            {submission.proof_url && (
                <div style={{ flexShrink: 0 }}>
                    <a href={submission.proof_url} target="_blank" rel="noreferrer">
                        {isVideo ? (
                            <video src={submission.proof_url} style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)' }} muted />
                        ) : (
                            <img src={submission.thumbnail_url || submission.proof_url} style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', display: 'block' }} alt="proof" />
                        )}
                    </a>
                </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                <button disabled={reviewing === submission.id} onClick={() => onReview(submission.id, 'approve')}
                    style={{ padding: '10px 20px', background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 8, fontFamily: 'Orbitron, monospace', fontSize: '0.45rem', letterSpacing: '2px', cursor: 'pointer', fontWeight: 700 }}>
                    {reviewing === submission.id ? '...' : 'APPROVE'}
                </button>
                <button disabled={reviewing === submission.id} onClick={() => onReview(submission.id, 'reject')}
                    style={{ padding: '10px 20px', background: 'rgba(224,48,48,0.08)', color: '#e03030', border: '1px solid rgba(224,48,48,0.25)', borderRadius: 8, fontFamily: 'Orbitron, monospace', fontSize: '0.45rem', letterSpacing: '2px', cursor: 'pointer', fontWeight: 700 }}>
                    {reviewing === submission.id ? '...' : 'REJECT'}
                </button>
            </div>
        </div>
    );
}

// ─── REVIEW QUEUE (ALL CHALLENGES) ───────────────────────────────────────────
function ReviewQueue({ challenges, showToast, onRefresh }: { challenges: any[]; showToast: (m: string, t: 'success' | 'error') => void; onRefresh: () => void }) {
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [reviewing, setReviewing] = useState<string | null>(null);

    const loadQueue = useCallback(async () => {
        const activeChallenges = challenges.filter(c => c.status === 'active' || c.pending_review_count > 0);
        const allSubs: any[] = [];
        for (const c of activeChallenges) {
            try {
                const res = await fetch(`/api/video-challenges/${c.id}/review`);
                const json = await res.json();
                if (json.success) {
                    allSubs.push(...(json.submissions || []).map((s: any) => ({ ...s, challenge_name: c.name, challenge_id: c.id })));
                }
            } catch (_) {}
        }
        setSubmissions(allSubs);
        setLoading(false);
    }, [challenges]);

    useEffect(() => { loadQueue(); }, [loadQueue]);

    const handleReview = async (challengeId: string, submissionId: string, action: 'approve' | 'reject') => {
        setReviewing(submissionId);
        try {
            const res = await fetch(`/api/video-challenges/${challengeId}/review`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submission_id: submissionId, action }),
            });
            const json = await res.json();
            if (json.success) { showToast(`${action === 'approve' ? 'Approved' : 'Rejected'}`, 'success'); loadQueue(); onRefresh(); }
            else showToast(json.error || 'Failed', 'error');
        } finally { setReviewing(null); }
    };

    if (loading) return <div className="ch-empty">LOADING...</div>;
    if (submissions.length === 0) return <div className="ch-empty">NO PENDING SUBMISSIONS</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 24 }}>
            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.42rem', color: '#ff8c42', letterSpacing: '2px', marginBottom: 8 }}>
                {submissions.length} PENDING REVIEW{submissions.length !== 1 ? 'S' : ''}
            </div>
            {submissions.map((s: any) => (
                <div key={s.id} className="ch-card" style={{ padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'center', borderColor: 'rgba(255,140,66,0.2)' }}>
                    <img src={s.member_avatar || '/queen-karin.png'} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }} onError={(e: any) => { e.target.src = '/queen-karin.png'; }} alt="" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.6rem', color: '#ddd' }}>{s.member_name || s.member_id}</div>
                        <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.3rem', color: '#555', letterSpacing: '1px', marginTop: 2 }}>
                            {s.challenge_name} · {s.task_title || `Task ${s.task_position}`}
                        </div>
                    </div>
                    {s.proof_url && (
                        <a href={s.proof_url} target="_blank" rel="noreferrer" style={{ flexShrink: 0 }}>
                            <img src={s.thumbnail_url || s.proof_url} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }} alt="" />
                        </a>
                    )}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button disabled={reviewing === s.id} onClick={() => handleReview(s.challenge_id, s.id, 'approve')}
                            style={{ padding: '8px 16px', background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 8, fontFamily: 'Orbitron', fontSize: '0.4rem', letterSpacing: '1px', cursor: 'pointer', fontWeight: 700 }}>
                            {reviewing === s.id ? '...' : 'APPROVE'}
                        </button>
                        <button disabled={reviewing === s.id} onClick={() => handleReview(s.challenge_id, s.id, 'reject')}
                            style={{ padding: '8px 16px', background: 'rgba(224,48,48,0.08)', color: '#e03030', border: '1px solid rgba(224,48,48,0.25)', borderRadius: 8, fontFamily: 'Orbitron', fontSize: '0.4rem', letterSpacing: '1px', cursor: 'pointer', fontWeight: 700 }}>
                            {reviewing === s.id ? '...' : 'REJECT'}
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── FILE UPLOAD HELPER ──────────────────────────────────────────────────────
async function uploadFile(file: File, folder: string): Promise<string> {
    const ext = file.name.split('.').pop() || 'mp4';
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const res = await fetch('/api/upload/signed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket: 'media', path }),
    });
    const json = await res.json();
    if (!json.signedUrl) throw new Error(json.error || 'Failed to get upload URL');
    const up = await fetch(json.signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
    if (!up.ok) throw new Error('Upload failed');
    return json.publicUrl;
}

// ─── UPLOAD BUTTON COMPONENT ────────────────────────────────────────────────
function UploadButton({ label, accept, value, onChange, uploading, setUploading, showToast }: {
    label: string; accept: string; value: string;
    onChange: (url: string) => void; uploading: boolean; setUploading: (v: boolean) => void;
    showToast: (m: string, t: 'success' | 'error') => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const isVideo = accept.includes('video');
    const fileName = value ? decodeURIComponent(value.split('/').pop()?.split('?')[0] || '').slice(14) : '';

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const url = await uploadFile(file, isVideo ? 'video-challenges' : 'video-challenge-images');
            onChange(url);
        } catch (err: any) { showToast(err.message || 'Upload failed', 'error'); }
        finally { setUploading(false); if (inputRef.current) inputRef.current.value = ''; }
    };

    return (
        <div>
            <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }} onChange={handleFile} />
            {value ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, padding: '10px 16px', background: 'rgba(22,163,74,0.04)', border: '1px solid rgba(22,163,74,0.15)', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span style={{ color: '#16a34a', fontSize: '0.9rem' }}>{isVideo ? '▶' : '◻'}</span>
                        <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '0.85rem', color: '#16a34a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName || 'Uploaded'}</span>
                    </div>
                    <button onClick={() => onChange('')} style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 10, padding: '8px 14px', color: '#dc2626', fontFamily: 'Rajdhani, sans-serif', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', letterSpacing: '1px', flexShrink: 0 }}>REMOVE</button>
                </div>
            ) : (
                <button onClick={() => inputRef.current?.click()} disabled={uploading}
                    style={{ width: '100%', padding: '18px 16px', background: uploading ? '#f0efed' : '#faf9f7', border: '2px dashed rgba(168,85,247,0.2)', borderRadius: 14, color: uploading ? '#aaa' : '#a855f7', fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '2px', cursor: uploading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.25s' }}
                    onMouseEnter={e => { if (!uploading) { e.currentTarget.style.borderColor = 'rgba(168,85,247,0.4)'; e.currentTarget.style.background = 'rgba(168,85,247,0.03)'; } }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(168,85,247,0.2)'; e.currentTarget.style.background = '#faf9f7'; }}>
                    {uploading ? 'UPLOADING...' : label}
                </button>
            )}
        </div>
    );
}

// ─── CREATE FORM ─────────────────────────────────────────────────────────────
function CreateForm({ showToast, onCreated }: { showToast: (m: string, t: 'success' | 'error') => void; onCreated: () => void }) {
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [form, setForm] = useState({
        name: '', topic: '',
        tier_video_url: '', image_url: '',
        scheduling_mode: 'on_request',
        duration_days: 7, window_minutes: 60,
        min_tier: '', join_cost: 0, rejoin_cost: 0,
        points_per_task: 100, theme: 'default',
    });
    const [items, setItems] = useState<string[]>([]);
    const [itemInput, setItemInput] = useState('');
    const [tasks, setTasks] = useState<{ video_url: string; title: string; description: string }[]>([
        { video_url: '', title: '', description: '' },
    ]);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

    const addItem = () => {
        const trimmed = itemInput.trim();
        if (trimmed && !items.includes(trimmed)) { setItems(i => [...i, trimmed]); setItemInput(''); }
    };
    const removeItem = (idx: number) => setItems(i => i.filter((_, j) => j !== idx));

    const addTask = () => setTasks(t => [...t, { video_url: '', title: '', description: '' }]);
    const removeTask = (i: number) => setTasks(t => t.filter((_, idx) => idx !== i));
    const updateTask = (i: number, key: string, val: string) => {
        setTasks(t => t.map((task, idx) => idx === i ? { ...task, [key]: val } : task));
    };

    const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const url = await uploadFile(file, 'video-challenge-images');
            set('image_url', url);
        } catch (err: any) { showToast(err.message || 'Upload failed', 'error'); }
        finally { setUploading(false); if (imageInputRef.current) imageInputRef.current.value = ''; }
    };

    const handleCreate = async () => {
        if (!form.name) return showToast('Name is required', 'error');
        const validTasks = tasks.filter(t => t.video_url.trim());
        if (validTasks.length === 0) return showToast('At least one task with a video is required', 'error');

        setSaving(true);
        try {
            const res = await fetch('/api/video-challenges', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    items_needed: items.length > 0 ? items.join('|||') : '',
                    duration_days: Number(form.duration_days),
                    window_minutes: Number(form.window_minutes),
                    join_cost: Number(form.join_cost),
                    rejoin_cost: Number(form.rejoin_cost),
                    points_per_task: Number(form.points_per_task),
                    min_tier: form.min_tier || null,
                    tasks: validTasks,
                }),
            });
            const json = await res.json();
            if (json.success) { showToast('Video Challenge created!', 'success'); onCreated(); }
            else showToast(json.error || 'Failed', 'error');
        } finally { setSaving(false); }
    };

    const PINK = '#a855f7';
    const gradMain = `linear-gradient(135deg, #a855f7, #6d28d9)`;
    const card: React.CSSProperties = { background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 20, padding: 28, marginBottom: 14, boxShadow: '0 2px 16px rgba(0,0,0,0.04)' };

    const Divider = ({ label }: { label: string }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <div style={{ height: 1, flex: 1, background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.15))' }} />
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.65rem', fontWeight: 600, color: 'rgba(168,85,247,0.5)', letterSpacing: '4px' }}>{label}</div>
            <div style={{ height: 1, flex: 1, background: 'linear-gradient(90deg, rgba(109,40,217,0.15), transparent)' }} />
        </div>
    );

    const themes = [
        { key: 'default', label: 'GOLD' }, { key: 'red', label: 'RED' },
        { key: 'purple', label: 'PURPLE' }, { key: 'blue', label: 'BLUE' },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative', background: '#f8f7f5', borderRadius: 24, padding: '32px 24px', margin: '-12px -12px 0', overflowY: 'auto', maxHeight: '100%' }}>
            <style>{`
                .vc-input { background: #f0efed; border: 1px solid rgba(0,0,0,0.06); border-radius: 14px; color: #1a1a1a; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.95rem; padding: 14px 18px; width: 100%; outline: none; transition: all 0.25s; box-sizing: border-box; }
                .vc-input:focus { border-color: rgba(168,85,247,0.35); box-shadow: 0 0 0 3px rgba(168,85,247,0.06); background: #fff; }
                .vc-input::placeholder { color: rgba(0,0,0,0.25); }
                .vc-select { background: #f0efed; border: 1px solid rgba(0,0,0,0.06); border-radius: 14px; color: #1a1a1a; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.95rem; padding: 14px 18px; width: 100%; outline: none; transition: all 0.25s; box-sizing: border-box; appearance: auto; }
                .vc-num::-webkit-inner-spin-button, .vc-num::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
                .vc-num[type=number] { -moz-appearance: textfield; }
                .vc-num { background: transparent; border: none; border-bottom: 2px solid rgba(0,0,0,0.08); color: #1a1a1a; font-family: 'Rajdhani', sans-serif; font-size: 1.6rem; font-weight: 700; text-align: center; padding: 6px 4px; width: 100%; outline: none; transition: border-color 0.2s; }
                .vc-num:focus { border-bottom-color: rgba(168,85,247,0.5); }
            `}</style>

            {/* HEADER */}
            <div style={{ textAlign: 'center', marginBottom: 36 }}>
                <div style={{ fontFamily: "'Cinzel', serif", fontSize: 'clamp(1.6rem, 4.5vw, 2.2rem)', background: gradMain, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '8px', fontWeight: 600 }}>FORGE</div>
                <div style={{ width: 80, height: 2, background: gradMain, margin: '10px auto 0', borderRadius: 1, boxShadow: '0 0 12px rgba(168,85,247,0.3)' }} />
                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', fontWeight: 500, color: '#999', marginTop: 8, letterSpacing: '3px' }}>CREATE A VIDEO CHALLENGE</div>
            </div>

            {/* IDENTITY */}
            <div style={card}>
                <Divider label="IDENTITY" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 24, alignItems: 'start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <input className="vc-input" placeholder="Challenge name..." value={form.name} onChange={e => set('name', e.target.value)} style={{ fontSize: '1.15rem', fontFamily: "'Cinzel', serif", letterSpacing: '2px' }} />
                        <textarea className="vc-input" placeholder="Topic / description..." value={form.topic} onChange={e => set('topic', e.target.value)} rows={3} style={{ resize: 'none' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                        <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImagePick} />
                        <div onClick={() => !uploading && imageInputRef.current?.click()} style={{ width: 120, height: 120, borderRadius: 18, border: form.image_url ? 'none' : '2px dashed rgba(168,85,247,0.2)', background: form.image_url ? 'transparent' : '#f0efed', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', transition: 'all 0.3s' }}>
                            {form.image_url ? (
                                <>
                                    <img src={form.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                    <button type="button" onClick={e => { e.stopPropagation(); set('image_url', ''); }} style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: '0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>x</button>
                                </>
                            ) : (
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.6rem', background: gradMain, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 4 }}>+</div>
                                    <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.6rem', fontWeight: 600, color: '#bbb', letterSpacing: '2px' }}>COVER</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                {/* Theme colors */}
                <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'center' }}>
                    {themes.map(t => {
                        const active = form.theme === t.key;
                        const c = themeColor(t.key);
                        return (
                            <button key={t.key} type="button" onClick={() => set('theme', t.key)} style={{ width: 34, height: 34, borderRadius: '50%', padding: 0, cursor: 'pointer', border: `2.5px solid ${active ? c : 'rgba(0,0,0,0.08)'}`, background: active ? `radial-gradient(circle, ${c}25, transparent)` : '#f5f4f2', transition: 'all 0.25s', boxShadow: active ? `0 0 12px ${c}40` : 'none' }}>
                                <div style={{ width: 12, height: 12, borderRadius: '50%', background: c, margin: 'auto' }} />
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ITEMS NEEDED */}
            <div style={card}>
                <Divider label="ITEMS NEEDED" />
                {items.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                        {items.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'linear-gradient(135deg, rgba(168,85,247,0.06), rgba(109,40,217,0.04))', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 24, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '0.88rem', color: '#555' }}>
                                {item}
                                <button onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.75rem', padding: 0, lineHeight: 1, opacity: 0.6 }}>x</button>
                            </div>
                        ))}
                    </div>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                    <input className="vc-input" value={itemInput} onChange={e => setItemInput(e.target.value)} placeholder="e.g. Rope, blindfold, ice cubes..." style={{ flex: 1 }}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }} />
                    <button onClick={addItem} disabled={!itemInput.trim()}
                        style={{ padding: '12px 22px', background: itemInput.trim() ? gradMain : '#e8e7e5', border: 'none', borderRadius: 14, color: itemInput.trim() ? '#fff' : '#aaa', fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', fontWeight: 700, cursor: itemInput.trim() ? 'pointer' : 'default', letterSpacing: '2px', flexShrink: 0, transition: 'all 0.25s' }}>
                        ADD
                    </button>
                </div>
            </div>

            {/* TIER VIDEO */}
            <div style={card}>
                <Divider label="TIER VIDEO" />
                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.75rem', color: '#aaa', marginBottom: 12 }}>Preview video shown to all users before they join</div>
                <UploadButton label="UPLOAD TIER VIDEO" accept="video/*" value={form.tier_video_url}
                    onChange={url => set('tier_video_url', url)} uploading={uploading} setUploading={setUploading} showToast={showToast} />
            </div>

            {/* SCHEDULING */}
            <div style={card}>
                <Divider label="SCHEDULING" />
                <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                    {(['scheduled', 'on_request'] as const).map(mode => {
                        const active = form.scheduling_mode === mode;
                        return (
                            <button key={mode} onClick={() => set('scheduling_mode', mode)}
                                style={{ flex: 1, padding: '18px 14px', borderRadius: 16, border: `2px solid ${active ? PINK : 'rgba(0,0,0,0.05)'}`, background: active ? 'linear-gradient(135deg, rgba(168,85,247,0.05), rgba(109,40,217,0.05))' : '#faf9f7', cursor: 'pointer', textAlign: 'center', transition: 'all 0.3s', boxShadow: active ? '0 4px 20px rgba(168,85,247,0.1)' : 'none' }}>
                                <div style={{ fontSize: '1.2rem', color: active ? PINK : '#ccc', marginBottom: 6 }}>{mode === 'scheduled' ? '📅' : '🎯'}</div>
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.72rem', fontWeight: 700, color: active ? '#1a1a1a' : '#999', letterSpacing: '3px' }}>{mode === 'scheduled' ? 'SCHEDULED' : 'ON REQUEST'}</div>
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.68rem', color: '#aaa', lineHeight: 1.4, marginTop: 4 }}>{mode === 'scheduled' ? 'Fixed timeline, auto windows' : 'User requests next task'}</div>
                            </button>
                        );
                    })}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: form.scheduling_mode === 'scheduled' ? '1fr 1fr 1fr' : '1fr 1fr', gap: 20 }}>
                    {form.scheduling_mode === 'scheduled' && (
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.65rem', fontWeight: 600, color: '#aaa', letterSpacing: '3px', marginBottom: 10 }}>DURATION</div>
                            <input type="number" className="vc-num" min={1} value={form.duration_days} onChange={e => set('duration_days', e.target.value)} />
                            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: '#bbb', marginTop: 4 }}>days</div>
                        </div>
                    )}
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.65rem', fontWeight: 600, color: '#aaa', letterSpacing: '3px', marginBottom: 10 }}>WINDOW</div>
                        <input type="number" className="vc-num" min={1} value={form.window_minutes} onChange={e => set('window_minutes', e.target.value)} />
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: '#bbb', marginTop: 4 }}>minutes</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.65rem', fontWeight: 600, color: '#aaa', letterSpacing: '3px', marginBottom: 10 }}>POINTS</div>
                        <input type="number" className="vc-num" min={0} value={form.points_per_task} onChange={e => set('points_per_task', e.target.value)} />
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: '#bbb', marginTop: 4 }}>per task</div>
                    </div>
                </div>
            </div>

            {/* ACCESS */}
            <div style={card}>
                <Divider label="ACCESS" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
                    <div>
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.65rem', fontWeight: 600, color: '#aaa', letterSpacing: '3px', marginBottom: 8 }}>MIN TIER</div>
                        <select className="vc-select" value={form.min_tier} onChange={e => set('min_tier', e.target.value)}>
                            <option value="">All Tiers</option>
                            {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.65rem', fontWeight: 600, color: '#aaa', letterSpacing: '3px', marginBottom: 8 }}>JOIN COST</div>
                        <input type="number" className="vc-num" min={0} value={form.join_cost} onChange={e => set('join_cost', e.target.value)} />
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: '#bbb', marginTop: 4 }}>coins</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.65rem', fontWeight: 600, color: '#aaa', letterSpacing: '3px', marginBottom: 8 }}>REJOIN COST</div>
                        <input type="number" className="vc-num" min={0} value={form.rejoin_cost} onChange={e => set('rejoin_cost', e.target.value)} />
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: '#bbb', marginTop: 4 }}>coins</div>
                    </div>
                </div>
            </div>

            {/* VIDEO TASKS */}
            <div style={card}>
                <Divider label="VIDEO TASKS" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {tasks.map((task, i) => (
                        <div key={i} style={{ background: '#faf9f7', border: '1px solid rgba(0,0,0,0.04)', borderRadius: 16, padding: '18px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                                <div style={{ width: 36, height: 36, borderRadius: 10, background: gradMain, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Rajdhani, sans-serif', fontSize: '1rem', color: '#fff', fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                                <div style={{ flex: 1, fontFamily: 'Rajdhani, sans-serif', fontSize: '0.75rem', fontWeight: 600, color: '#999', letterSpacing: '2px' }}>TASK {i + 1}</div>
                                {tasks.length > 1 && (
                                    <button onClick={() => removeTask(i)} style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 10, padding: '6px 14px', color: '#dc2626', fontFamily: 'Rajdhani, sans-serif', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', letterSpacing: '1px' }}>REMOVE</button>
                                )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <UploadButton label="UPLOAD TASK VIDEO" accept="video/*" value={task.video_url}
                                    onChange={url => updateTask(i, 'video_url', url)} uploading={uploading} setUploading={setUploading} showToast={showToast} />
                                <input className="vc-input" placeholder="Task title (optional)" value={task.title} onChange={e => updateTask(i, 'title', e.target.value)} />
                                <input className="vc-input" placeholder="Description (optional)" value={task.description} onChange={e => updateTask(i, 'description', e.target.value)} />
                            </div>
                        </div>
                    ))}
                </div>
                <button onClick={addTask} style={{ width: '100%', marginTop: 14, padding: '16px', background: '#faf9f7', border: '2px dashed rgba(168,85,247,0.2)', borderRadius: 16, color: PINK, fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', letterSpacing: '3px', transition: 'all 0.25s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(168,85,247,0.4)'; e.currentTarget.style.background = 'rgba(168,85,247,0.03)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(168,85,247,0.2)'; e.currentTarget.style.background = '#faf9f7'; }}>
                    + ADD TASK
                </button>
            </div>

            {/* SUBMIT */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8, marginBottom: 32 }}>
                <button onClick={handleCreate} disabled={saving || uploading || !form.name}
                    style={{ padding: '16px 48px', background: (saving || uploading) ? '#e8e7e5' : gradMain, border: 'none', borderRadius: 16, color: (saving || uploading) ? '#aaa' : '#fff', fontFamily: "'Cinzel', serif", fontSize: '1rem', letterSpacing: '4px', cursor: (saving || uploading) ? 'default' : 'pointer', fontWeight: 600, boxShadow: (saving || uploading) ? 'none' : '0 4px 24px rgba(168,85,247,0.3)', transition: 'all 0.3s' }}>
                    {saving ? 'FORGING...' : uploading ? 'UPLOADING...' : 'FORGE'}
                </button>
            </div>
        </div>
    );
}
