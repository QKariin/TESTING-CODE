'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { MECH_ICON as _MECH_ICON, WHEEL_SEGMENTS } from '@/lib/mechanisms';

// ── Design tokens (match vault/page.tsx exactly) ──
const R = 'rgba(139,0,0,';

const WHEEL = WHEEL_SEGMENTS;

export const MECH_ICON = _MECH_ICON;

export interface MechOrder {
    type: string;
    config?: any;
    target?: number;
    done?: number;
    label?: string;
    submitted?: string;
    gambleResult?: any;
}

interface MechRunnerProps {
    order: MechOrder;
    profile?: { member_id?: string; memberId?: string; wallet?: number; skippass?: number; [key: string]: any };
    memberId?: string;
    previewMode?: boolean;
    submissions?: any[];
    alreadySubmitted?: boolean;
    trialPrompt?: string;
    onClose?: () => void;
    onComplete?: (opts: { text?: string; photoUrl?: string }) => void;
}

export default function MechRunner({
    order: o,
    profile,
    memberId: memberIdProp = '',
    previewMode = false,
    submissions = [],
    alreadySubmitted = false,
    trialPrompt,
    onClose,
    onComplete,
}: MechRunnerProps) {
    const mid = profile?.member_id || profile?.memberId || memberIdProp || '';
    const meta = MECH_ICON[o.type] || { icon: '◆', label: o.type };
    const label = (!o.label || o.label === o.type || o.label.includes('_')) ? meta.label : o.label;

    // ── Task categorisation ──
    const isPhotoTask = ['cold_shower','body_writing','exercise','photo_proof','ambush_snap','timed_photo','multi_video','endurance'].includes(o.type);
    const isTextTask  = ['journal','confession','worship','gratitude','essay','lines','writing'].includes(o.type);
    const isInteractive = ['dice_roll','coinflip','card_pick','russian_roulette','spin_wheel','truth_dare','greed_game','simon_says'].includes(o.type);
    const isSelfReport = ['edge','corner_time','denial','kneel'].includes(o.type);
    const isPayment   = o.type === 'payment';

    // ── Submission state ──
    const existingSub = submissions.find((s: any) => s.order_type === o.type);
    const isPending = existingSub?.status === 'pending' || alreadySubmitted || o.submitted === 'pending';

    // ── All mechanism state ──
    const [diceRolling, setDiceRolling]         = useState(false);
    const [diceResult, setDiceResult]           = useState<number | null>(null);
    const [coinFlipping, setCoinFlipping]       = useState(false);
    const [coinResult, setCoinResult]           = useState<string | null>(null);
    const [cardPicking, setCardPicking]         = useState(false);
    const [cardResult, setCardResult]           = useState<any>(null);
    const [rouletteSpinning, setRouletteSpinning] = useState(false);
    const [rouletteResult, setRouletteResult]   = useState<string | null>(null);
    const [mechDone, setMechDone]               = useState(false);
    const [wheelSpinning, setWheelSpinning]     = useState(false);
    const [wheelPreview, setWheelPreview]       = useState<string | null>(null);
    const [wheelResult, setWheelResult]         = useState<any>(null);
    const [truthDareChoice, setTruthDareChoice] = useState<'truth'|'dare'|null>(null);
    const [greedCoins, setGreedCoins]           = useState(0);
    const [greedBusted, setGreedBusted]         = useState(false);
    const [greedCashedOut, setGreedCashedOut]   = useState(false);
    const [quizStep, setQuizStep]               = useState(0);
    const [quizAnswers, setQuizAnswers]         = useState<number[]>([]);
    const [quizTimeLeft, setQuizTimeLeft]       = useState<number | null>(null);
    const [quizReveal, setQuizReveal]           = useState<number | null>(null);
    const [quizResult, setQuizResult]           = useState<{ correct: number; total: number; dayChange: number } | null>(null);
    const [simonStep, setSimonStep]             = useState(0);
    const [simonPhase, setSimonPhase]           = useState<'idle'|'waiting'|'task'|'complete'>('idle');
    const [simonWaitUntil, setSimonWaitUntil]   = useState(0);
    const [simonTaskSecs, setSimonTaskSecs]     = useState(0);
    const [simonTaskLimit, setSimonTaskLimit]   = useState(0);
    const [simonCurrentTask, setSimonCurrentTask] = useState<{text:string;timeLimit:number;proofType?:string}|null>(null);
    const [simonLastTask, setSimonLastTask]     = useState<{text:string}|null>(null);
    const [simonProofs, setSimonProofs]         = useState<string[]>([]);
    const [simonUploading, setSimonUploading]   = useState(false);
    const [taskText, setTaskText]               = useState('');
    const [taskUploading, setTaskUploading]     = useState(false);
    const [trialOpen, setTrialOpen]             = useState(false);
    const [trialText, setTrialText]             = useState('');
    const [trialDone, setTrialDone]             = useState(false);
    const [pendingFollowUp, setPendingFollowUp] = useState<any>(null);
    const [followUp, setFollowUp]               = useState<any>(null);
    const [followUpText, setFollowUpText]       = useState('');
    const [followUpUploading, setFollowUpUploading] = useState(false);
    const [followUpSkipping, setFollowUpSkipping]   = useState(false);
    const [skipOpen, setSkipOpen]               = useState(false);

    // ── Refs ──
    const simonWaitRef  = useRef<ReturnType<typeof setInterval>|null>(null);
    const simonTaskRef  = useRef<ReturnType<typeof setInterval>|null>(null);
    const quizTimerRef  = useRef<ReturnType<typeof setInterval>|null>(null);
    const quizRevealRef = useRef<ReturnType<typeof setTimeout>|null>(null);
    const followUpRef   = useRef<any>(null);
    followUpRef.current = followUp;

    // ── Restore gamble results on mount ──
    useEffect(() => {
        try {
            const saved = localStorage.getItem('vault_gamble_results');
            if (saved) {
                const g = JSON.parse(saved);
                if (g.wheelResult)    { setWheelResult(g.wheelResult); setMechDone(true); }
                if (g.diceResult)     { setDiceResult(g.diceResult); setMechDone(true); }
                if (g.coinResult)     { setCoinResult(g.coinResult); setMechDone(true); }
                if (g.cardResult)     { setCardResult(g.cardResult); setMechDone(true); }
                if (g.rouletteResult) { setRouletteResult(g.rouletteResult); setMechDone(true); }
                if (g.greedBusted)    { setGreedBusted(true); setMechDone(true); }
                if (g.greedCashedOut) { setGreedCashedOut(true); setGreedCoins(g.greedCoins || 0); setMechDone(true); }
                if (g.truthDareChoice){ setTruthDareChoice(g.truthDareChoice); }
            }
            const savedFU = localStorage.getItem('vault_followup');
            if (savedFU && !followUpRef.current) { setFollowUp(JSON.parse(savedFU)); }
        } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Persist follow-up to localStorage ──
    useEffect(() => {
        try {
            if (followUp) localStorage.setItem('vault_followup', JSON.stringify(followUp));
            else localStorage.removeItem('vault_followup');
        } catch {}
    }, [followUp]);

    // ── Auto-transition: pendingFollowUp → followUp (2.5s delay, matching vault) ──
    useEffect(() => {
        if (!pendingFollowUp) return;
        const t = setTimeout(() => {
            setFollowUp(pendingFollowUp);
            setPendingFollowUp(null);
            setMechDone(false);
            setDiceResult(null); setCoinResult(null); setCardResult(null);
            setRouletteResult(null); setWheelResult(null); setTruthDareChoice(null);
            try { localStorage.removeItem('vault_gamble_results'); } catch {}
        }, 2500);
        return () => clearTimeout(t);
    }, [pendingFollowUp]);

    // ── Simon Says: restore state on mount ──
    useEffect(() => {
        if (o.type !== 'simon_says') return;
        const chain: any[] = o.config?.chainTasks || [];
        try {
            const stored = localStorage.getItem('ss_state');
            if (stored) {
                const s = JSON.parse(stored);
                if (s.phase && s.phase !== 'idle') {
                    setSimonStep(s.step || 0);
                    setSimonProofs(s.proofs || []);
                    setSimonLastTask(s.lastTask || null);
                    if (s.phase === 'waiting' && s.waitUntil) {
                        if (Date.now() >= s.waitUntil) {
                            const lastTxt = s.lastTask?.text;
                            const pool = lastTxt ? chain.filter((t: any) => t.text !== lastTxt) : chain;
                            const src = pool.length > 0 ? pool : chain;
                            const task = src[Math.floor(Math.random() * src.length)];
                            if (task) {
                                setSimonCurrentTask(task); setSimonLastTask(task);
                                setSimonTaskSecs(task.timeLimit || 30); setSimonTaskLimit(task.timeLimit || 30);
                                setSimonPhase('task');
                            }
                        } else { setSimonWaitUntil(s.waitUntil); setSimonPhase('waiting'); }
                    } else if (s.phase === 'task' && s.currentTask) {
                        setSimonCurrentTask(s.currentTask);
                        setSimonTaskSecs(s.currentTask.timeLimit || 30); setSimonTaskLimit(s.currentTask.timeLimit || 30);
                        setSimonPhase('task');
                    } else if (s.phase === 'complete') { setSimonPhase('complete'); }
                    else { setSimonPhase('idle'); }
                    return;
                }
            }
        } catch {}
        setSimonPhase('idle'); setSimonStep(0); setSimonProofs([]); setSimonCurrentTask(null); setSimonLastTask(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Simon Says: wait countdown → pick random task ──
    useEffect(() => {
        if (simonPhase !== 'waiting' || !simonWaitUntil) return;
        const chain: any[] = o.config?.chainTasks || [];
        const lastTxt = simonLastTask?.text;
        simonWaitRef.current = setInterval(() => {
            if (Date.now() >= simonWaitUntil) {
                clearInterval(simonWaitRef.current!); simonWaitRef.current = null;
                const pool = lastTxt ? chain.filter((t: any) => t.text !== lastTxt) : chain;
                const src = pool.length > 0 ? pool : chain;
                if (!src.length) return;
                const task = src[Math.floor(Math.random() * src.length)];
                setSimonCurrentTask(task); setSimonLastTask(task);
                setSimonTaskSecs(task.timeLimit || 30); setSimonTaskLimit(task.timeLimit || 30);
                setSimonPhase('task');
                try { localStorage.setItem('ss_state', JSON.stringify({ phase: 'task', currentTask: task, step: simonStep, proofs: simonProofs, lastTask: task })); } catch {}
            }
        }, 1000);
        return () => { if (simonWaitRef.current) { clearInterval(simonWaitRef.current); simonWaitRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [simonPhase, simonWaitUntil]);

    // ── Simon Says: task time limit countdown ──
    useEffect(() => {
        if (simonPhase !== 'task') {
            if (simonTaskRef.current) { clearInterval(simonTaskRef.current); simonTaskRef.current = null; }
            return;
        }
        simonTaskRef.current = setInterval(() => {
            setSimonTaskSecs(prev => {
                if (prev <= 1) { clearInterval(simonTaskRef.current!); simonTaskRef.current = null; return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => { if (simonTaskRef.current) { clearInterval(simonTaskRef.current); simonTaskRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [simonPhase]);

    // ── Helpers ──
    const saveGambleResult = useCallback((data: Record<string, any>, orderType?: string) => {
        try {
            const existing = JSON.parse(localStorage.getItem('vault_gamble_results') || '{}');
            localStorage.setItem('vault_gamble_results', JSON.stringify({ ...existing, ...data }));
        } catch {}
        if (!previewMode && orderType && mid) {
            fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'save_gamble', memberId: mid, orderType, gambleResult: data }),
            }).catch(() => {});
        }
    }, [previewMode, mid]);

    const submitTask = useCallback(async (opts: { text?: string; photoUrl?: string }) => {
        if (previewMode) { onComplete?.(opts); onClose?.(); return; }
        try {
            const resp = await fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'submit_task', memberId: mid, orderType: o.type, text: opts.text || null, photoUrl: opts.photoUrl || null, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
            });
            const result = await resp.json();
            if (!resp.ok) alert('Submit failed: ' + (result.error || 'unknown error'));
            else { onComplete?.(opts); onClose?.(); }
        } catch (e: any) { alert('Submit failed: ' + e?.message); }
    }, [previewMode, mid, o.type, onComplete, onClose]);

    const submitFollowUp = useCallback(async (opts: { text?: string; photoUrl?: string }) => {
        if (previewMode) { setFollowUp(null); setFollowUpText(''); setFollowUpSkipping(false); onComplete?.(opts); return; }
        try {
            const resp = await fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'submit_task', memberId: mid, orderType: followUp?.orderType || o.type, text: opts.text || null, photoUrl: opts.photoUrl || null, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
            });
            const result = await resp.json();
            if (!resp.ok) alert('Submit failed: ' + (result.error || 'unknown error'));
            else { setFollowUp(null); setFollowUpText(''); try { localStorage.removeItem('vault_gamble_results'); localStorage.removeItem('vault_followup'); } catch {} onComplete?.(opts); }
        } catch (e: any) { alert('Submit failed: ' + e?.message); }
    }, [previewMode, mid, o.type, followUp, onComplete]);

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    if (isPending) return (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem', color: 'rgba(197,160,89,0.6)', letterSpacing: '3px', animation: 'vPulse 2s ease infinite' }}>
                ⏳ AWAITING REVIEW
            </div>
        </div>
    );

    return (
        <>
            {/* ── TASK DESCRIPTION ── */}
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.8, marginBottom: 22, padding: '14px 16px', background: 'rgba(0,0,0,0.25)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                {o.config?.instruction || o.config?.prompt || o.config?.question
                    || (o.type === 'coinflip' && o.config?.headsText ? `Heads: ${o.config.headsText} / Tails: ${o.config.tailsText}` : null)
                    || (o.type === 'multi_video' && o.config?.target ? `Record ${o.config.target} clips as instructed.` : null)
                    || meta.desc || 'Complete this task as ordered.'}
            </div>
            {o.config?.duration && <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.25)', letterSpacing: '2px', marginBottom: 12 }}>{Math.floor(o.config.duration / 60)}:{String(o.config.duration % 60).padStart(2, '0')} DURATION</div>}

            {/* ── TRIAL ── */}
            {o.type === 'trial' && (
                <div>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, marginBottom: 16 }}>
                        {trialPrompt || 'No trial assigned yet.'}
                    </div>
                    {!trialDone && !trialOpen && (
                        <button onClick={() => setTrialOpen(true)} style={{ width: '100%', padding: '14px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', letterSpacing: '3px', color: 'rgba(197,160,89,0.85)', background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.2)', borderRadius: 8, cursor: 'pointer' }}>BEGIN TRIAL</button>
                    )}
                    {trialOpen && !trialDone && (
                        <>
                            <textarea value={trialText} onChange={e => setTrialText(e.target.value)} placeholder="Write here..."
                                style={{ width: '100%', minHeight: 120, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(197,160,89,0.12)', borderRadius: 10, padding: 16, color: 'rgba(255,255,255,0.6)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '16px', lineHeight: 1.7, resize: 'vertical', outline: 'none' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                                <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)' }}>{trialText.split(/\s+/).filter(Boolean).length} / 200</span>
                                <button onClick={() => {
                                    setTrialDone(true); setTrialOpen(false);
                                    if (!previewMode && mid) {
                                        fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'trial', memberId: mid, prompt: trialPrompt || 'Daily trial', response: trialText }) }).catch(() => {});
                                    }
                                }} style={{ padding: '12px 28px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', letterSpacing: '3px', color: '#080810', background: 'rgba(197,160,89,0.7)', border: 'none', borderRadius: 8, cursor: 'pointer' }}>SUBMIT</button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── TRIBUTE ── */}
            {o.type === 'tribute' && (
                <div style={{ textAlign: 'center' }}>
                    <button onClick={() => (window as any).openStandaloneTribute?.('wishlist')} style={{ width: '100%', padding: '16px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', letterSpacing: '3px', color: 'rgba(197,160,89,0.85)', background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.2)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="8" width="18" height="12" rx="1" /><path d="M12 8v12" /><path d="M19 8c-1.5-1.5-3-2-4.5-2C13 6 12 8 12 8s-1-2-2.5-2C8 6 6.5 6.5 5 8" /></svg>
                        TRIBUTE {o.target} COINS
                    </button>
                </div>
            )}

            {/* ── SILENCE ── */}
            {o.type === 'silence' && (
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.8 }}>
                        You are forbidden from messaging today. Endure.
                    </div>
                </div>
            )}

            {/* ── QUIZ ── */}
            {o.type === 'quiz' && (() => {
                const rawCfg = o.config || {};
                const qs: any[] = rawCfg.questions?.length > 0
                    ? rawCfg.questions
                    : rawCfg.question
                        ? [{ question: rawCfg.question, answers: rawCfg.answers || [], correctIdx: rawCfg.correctIdx ?? 0, timeLimit: rawCfg.timeLimit || 60 }]
                        : [];
                if (qs.length === 0) return <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', letterSpacing: 2, textAlign: 'center' }}>No questions configured.</div>;

                const allAnswered = quizResult !== null;
                const curQ = qs[quizStep];
                const tl = curQ?.timeLimit || 60;

                const startTimer = (limit: number) => {
                    if (quizTimerRef.current) clearInterval(quizTimerRef.current);
                    setQuizTimeLeft(limit);
                    quizTimerRef.current = setInterval(() => {
                        setQuizTimeLeft(prev => {
                            if (prev === null || prev <= 1) { if (quizTimerRef.current) clearInterval(quizTimerRef.current); return 0; }
                            return prev - 1;
                        });
                    }, 1000);
                };

                const pickAnswer = (ai: number) => {
                    if (quizTimerRef.current) clearInterval(quizTimerRef.current);
                    if (quizRevealRef.current) clearTimeout(quizRevealRef.current);
                    setQuizReveal(ai); setQuizTimeLeft(null);
                    quizRevealRef.current = setTimeout(() => {
                        setQuizReveal(null);
                        const newAnswers = [...quizAnswers, ai];
                        setQuizAnswers(newAnswers);
                        if (newAnswers.length < qs.length) {
                            setQuizStep(s => s + 1);
                            startTimer(qs[newAnswers.length]?.timeLimit || 60);
                        } else {
                            const correct = newAnswers.filter((a, i) => a === qs[i]?.correctIdx).length;
                            const total = qs.length;
                            const dayChange = correct === total ? -1 : correct === 0 ? 3 : 0;
                            setQuizResult({ correct, total, dayChange });
                            if (!previewMode && mid) {
                                fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ action: 'quiz_grade', memberId: mid, orderType: o.type, correct, total, answers: newAnswers, questions: qs, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
                                }).catch(() => {});
                            }
                        }
                    }, 1500);
                };

                const timedOut = quizTimeLeft === 0 && !allAnswered && quizReveal === null;
                if (timedOut) { setTimeout(() => pickAnswer(-1), 0); return null; }

                if (allAnswered && quizResult) {
                    const { correct, total, dayChange } = quizResult;
                    const scoreColor = correct === total ? 'rgba(80,200,120,0.85)' : correct === 0 ? 'rgba(255,60,60,0.8)' : 'rgba(197,160,89,0.8)';
                    return (
                        <div style={{ textAlign: 'center', padding: '10px 0' }}>
                            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.8rem', color: scoreColor, letterSpacing: 6, marginBottom: 6 }}>{correct}/{total}</div>
                            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', marginBottom: 20, letterSpacing: 1 }}>
                                {correct === total ? 'Perfect score.' : correct === 0 ? 'Every answer wrong.' : `${correct} correct · ${total - correct} wrong`}
                            </div>
                            {dayChange === -1 && <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: 'rgba(80,200,120,0.8)', letterSpacing: 4, padding: '14px 20px', background: 'rgba(80,200,120,0.06)', border: '1px solid rgba(80,200,120,0.25)', borderRadius: 10 }}>− 1 DAY REMOVED</div>}
                            {dayChange === 3  && <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: 'rgba(255,60,60,0.8)', letterSpacing: 4, padding: '14px 20px', background: 'rgba(255,60,60,0.06)', border: '1px solid rgba(255,60,60,0.25)', borderRadius: 10 }}>+ 3 DAYS ADDED</div>}
                            {dayChange === 0  && <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.2)', letterSpacing: 4 }}>NO CHANGE</div>}
                        </div>
                    );
                }

                const isActive = quizTimeLeft !== null;
                return (
                    <div style={{ padding: '4px 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', letterSpacing: 3 }}>QUESTION {quizStep + 1} / {qs.length}</span>
                            {isActive && quizTimeLeft !== null && <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.75rem', color: quizTimeLeft < 10 ? 'rgba(255,60,60,0.7)' : 'rgba(255,255,255,0.3)', letterSpacing: 2 }}>{quizTimeLeft}s</span>}
                        </div>
                        {isActive && quizTimeLeft !== null && (
                            <div style={{ width: '100%', height: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 2, marginBottom: 14, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${(quizTimeLeft / tl) * 100}%`, background: quizTimeLeft < 10 ? 'rgba(255,40,40,0.5)' : `${R}0.4)`, transition: 'width 1s linear', borderRadius: 2 }} />
                            </div>
                        )}
                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, marginBottom: 16, textAlign: 'center' }}>{curQ?.question || 'No question set.'}</div>
                        {!isActive ? (
                            <button onClick={() => startTimer(tl)} style={{ width: '100%', padding: '14px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', letterSpacing: 4, color: '#080810', background: 'rgba(197,160,89,0.7)', border: 'none', borderRadius: 8, cursor: 'pointer' }}>START</button>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {(curQ?.answers || []).map((opt: string, ai: number) => {
                                    const isCorrect = ai === curQ.correctIdx;
                                    const isPicked = quizReveal === ai;
                                    const revealing = quizReveal !== null;
                                    const bg = revealing ? (isCorrect ? 'rgba(80,200,120,0.12)' : isPicked ? 'rgba(255,60,60,0.1)' : 'rgba(255,255,255,0.02)') : 'rgba(255,255,255,0.03)';
                                    const border = revealing ? (isCorrect ? '1px solid rgba(80,200,120,0.5)' : isPicked ? '1px solid rgba(255,60,60,0.4)' : '1px solid rgba(255,255,255,0.06)') : '1px solid rgba(197,160,89,0.12)';
                                    const color = revealing ? (isCorrect ? 'rgba(80,200,120,0.9)' : isPicked ? 'rgba(255,80,80,0.7)' : 'rgba(255,255,255,0.25)') : 'rgba(255,255,255,0.6)';
                                    return (
                                        <button key={ai} onClick={() => !revealing && pickAnswer(ai)} style={{ textAlign: 'left', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, background: bg, border, borderRadius: 8, cursor: revealing ? 'default' : 'pointer', fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color, transition: 'all 0.2s' }}>
                                            <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.75rem', color: revealing && isCorrect ? 'rgba(80,200,120,0.8)' : revealing && isPicked ? 'rgba(255,80,80,0.6)' : 'rgba(197,160,89,0.5)', width: 20 }}>
                                                {revealing && isCorrect ? '✓' : revealing && isPicked && !isCorrect ? '✗' : String.fromCharCode(65 + ai)}
                                            </span>
                                            {opt}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* ── DICE ROLL ── */}
            {o.type === 'dice_roll' && (() => {
                const diceOutcomes = o.config?.outcomes?.length > 0 ? o.config.outcomes : [
                    { text: 'Edge once — no release', followUpType: 'endurance' },
                    { text: 'Write 100 lines of devotion', followUpType: 'writing' },
                    { text: 'Hold a plank for 60 seconds — proof', followUpType: 'photo' },
                    { text: '30 squats — video proof', followUpType: 'endurance' },
                    { text: 'Cold water on your face — selfie', followUpType: 'photo' },
                    { text: 'Lucky. Nothing happens.', followUpType: 'instant' },
                ];
                return (
                    <div style={{ textAlign: 'center', padding: '10px 0' }}>
                        <div style={{ width: 80, height: 80, margin: '16px auto 24px', border: `2px solid ${diceResult ? 'rgba(197,160,89,0.4)' : `${R}0.2)`}`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: diceResult ? 'rgba(197,160,89,0.06)' : `${R}0.04)`, animation: diceRolling ? 'vPulse 0.15s linear infinite' : 'none' }}>
                            <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '2.5rem', color: diceResult ? 'rgba(197,160,89,0.9)' : `${R}0.3)` }}>{diceResult || '?'}</span>
                        </div>
                        {diceResult && !diceRolling && (
                            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, margin: '0 0 20px', padding: '14px 18px', background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 8 }}>{diceOutcomes[diceResult - 1]?.text || `Face ${diceResult}`}</div>
                        )}
                        {!diceResult || diceRolling ? (
                            <button disabled={diceRolling} onClick={() => {
                                setDiceRolling(true); setDiceResult(null);
                                const numFaces = diceOutcomes.length; let count = 0;
                                const iv = setInterval(() => {
                                    const val = Math.floor(Math.random() * numFaces) + 1;
                                    setDiceResult(val); count++;
                                    if (count > 15) { clearInterval(iv); setDiceRolling(false); setMechDone(true); saveGambleResult({ diceResult: val }, 'dice_roll'); const oc = diceOutcomes[val - 1]; const ft = oc?.followUpType || 'writing'; setPendingFollowUp({ orderType: o.type, source: `Dice Roll — ${val}`, resultText: oc?.text || `Face ${val}`, type: ft, prompt: oc?.followUpPrompt, instruction: oc?.followUpInstruction, duration: oc?.followUpDuration, target: oc?.followUpTarget }); }
                                }, 100);
                            }} style={{ padding: '16px 48px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', letterSpacing: '4px', color: '#080810', background: 'rgba(197,160,89,0.7)', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                                {diceRolling ? 'ROLLING...' : 'ROLL DICE'}
                            </button>
                        ) : mechDone ? (
                            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '4px', animation: 'vPulse 1s ease infinite', marginTop: 8 }}>YOUR FATE IS SEALED</div>
                        ) : null}
                    </div>
                );
            })()}

            {/* ── COINFLIP ── */}
            {o.type === 'coinflip' && (() => {
                const hRaw = o.config?.headsText;
                const tRaw = o.config?.tailsText;
                const headsTask = (hRaw && !/^heads?$/i.test(hRaw.trim())) ? hRaw : 'Write a 200-word confession about your weakness';
                const tailsTask = (tRaw && !/^tails?$/i.test(tRaw.trim())) ? tRaw : 'Hold a plank for 60 seconds — photo proof';
                const coinTaskText = coinResult === 'heads' ? headsTask : coinResult === 'tails' ? tailsTask : '';
                const lo = coinTaskText.toLowerCase();
                return (
                    <div style={{ textAlign: 'center', padding: '10px 0' }}>
                        <div style={{ width: 90, height: 90, margin: '16px auto 20px', borderRadius: '50%', border: `2px solid ${coinResult ? (coinResult === 'heads' ? 'rgba(197,160,89,0.5)' : 'rgba(255,80,80,0.4)') : `${R}0.2)`}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: coinResult === 'heads' ? 'rgba(197,160,89,0.08)' : coinResult === 'tails' ? 'rgba(255,80,80,0.06)' : `${R}0.04)`, animation: coinFlipping ? 'vPulse 0.12s linear infinite' : 'none' }}>
                            <span style={{ fontFamily: 'Cinzel, serif', fontSize: coinResult ? '0.85rem' : '1.5rem', color: coinResult === 'heads' ? 'rgba(197,160,89,0.9)' : coinResult === 'tails' ? 'rgba(255,80,80,0.8)' : `${R}0.3)`, letterSpacing: 2, fontWeight: 700 }}>{coinResult ? coinResult.toUpperCase() : '$'}</span>
                        </div>
                        {coinResult && !coinFlipping && (
                            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, margin: '0 0 20px', padding: '14px 18px', background: coinResult === 'heads' ? 'rgba(197,160,89,0.06)' : 'rgba(255,80,80,0.06)', border: `1px solid ${coinResult === 'heads' ? 'rgba(197,160,89,0.15)' : 'rgba(255,80,80,0.15)'}`, borderRadius: 8 }}>{coinTaskText}</div>
                        )}
                        {!coinResult || coinFlipping ? (
                            <button disabled={coinFlipping} onClick={() => {
                                setCoinFlipping(true); setCoinResult(null); let count = 0;
                                const iv = setInterval(() => {
                                    const val = Math.random() > 0.5 ? 'heads' : 'tails';
                                    setCoinResult(val); count++;
                                    if (count > 12) { clearInterval(iv); setCoinFlipping(false); setMechDone(true); saveGambleResult({ coinResult: val }, 'coinflip'); const tt = val === 'heads' ? headsTask : tailsTask; const lo2 = tt.toLowerCase(); const it = /proof|video|selfie|photo|picture|body writing/.test(lo2) ? 'photo' : /write|essay|confession|journal|list|lines|letter|words|grateful/.test(lo2) ? 'writing' : /shower|plank|hold|sit|pushup|squat|burpee|exercise|camera|edge|ice/.test(lo2) ? 'endurance' : 'writing'; setPendingFollowUp({ orderType: o.type, source: `Coinflip — ${val.toUpperCase()}`, resultText: tt, type: it }); }
                                }, 120);
                            }} style={{ padding: '16px 48px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', letterSpacing: '4px', color: '#080810', background: 'rgba(197,160,89,0.7)', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                                {coinFlipping ? 'FLIPPING...' : 'FLIP COIN'}
                            </button>
                        ) : mechDone ? (
                            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '4px', animation: 'vPulse 1s ease infinite', marginTop: 8 }}>YOUR FATE IS SEALED</div>
                        ) : null}
                    </div>
                );
            })()}

            {/* ── CARD PICK ── */}
            {o.type === 'card_pick' && (() => {
                const configCards = o.config?.cards?.length > 0 ? o.config.cards : [
                    { text: 'Edge 3 times without release', followUpType: 'endurance' },
                    { text: 'Write a confession — 200 words', followUpType: 'writing' },
                    { text: 'Cold shower — 60 seconds proof', followUpType: 'photo' },
                    { text: '50 pushups — video proof', followUpType: 'endurance' },
                    { text: 'You got lucky. Nothing happens.', followUpType: 'instant' },
                ];
                const displayCount = Math.min(Math.max(configCards.length, 3), 5);
                return (
                    <div style={{ textAlign: 'center', padding: '10px 0' }}>
                        {!cardResult ? (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: 10, margin: '16px 0 24px', flexWrap: 'wrap' }}>
                                    {Array.from({ length: displayCount }, (_, i) => (
                                        <button key={i} disabled={cardPicking} onClick={() => {
                                            setCardPicking(true);
                                            const picked = configCards[Math.floor(Math.random() * configCards.length)];
                                            setTimeout(() => { setCardResult(picked); setCardPicking(false); setMechDone(true); saveGambleResult({ cardResult: picked }, 'card_pick'); const cft = picked?.followUpType || 'writing'; setPendingFollowUp({ orderType: o.type, source: 'Card Draw', resultText: picked?.text || picked, type: cft === 'instant' ? 'writing' : cft, prompt: picked?.followUpPrompt, instruction: picked?.followUpInstruction, duration: picked?.followUpDuration, target: picked?.followUpTarget }); }, 800);
                                        }} style={{ width: 70, height: 100, background: cardPicking ? 'rgba(197,160,89,0.1)' : `${R}0.06)`, border: `1.5px solid ${R}0.2)`, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', animation: cardPicking ? 'vPulse 0.3s ease infinite' : 'none' }}>
                                            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '1.8rem', color: `${R}0.25)` }}>♠</span>
                                        </button>
                                    ))}
                                </div>
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.25)', letterSpacing: 2 }}>CHOOSE A CARD</div>
                            </>
                        ) : (
                            <>
                                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'rgba(197,160,89,0.8)', lineHeight: 1.6, margin: '16px 0 20px', padding: '16px 20px', background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 8 }}>{cardResult?.text || cardResult}</div>
                                {mechDone && <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '4px', animation: 'vPulse 1s ease infinite', marginTop: 8, textAlign: 'center' }}>YOUR FATE IS SEALED</div>}
                            </>
                        )}
                    </div>
                );
            })()}

            {/* ── RUSSIAN ROULETTE ── */}
            {o.type === 'russian_roulette' && (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                    <div style={{ width: 90, height: 90, margin: '16px auto 24px', borderRadius: '50%', border: `2px solid ${rouletteResult === 'bang' ? 'rgba(255,60,60,0.5)' : rouletteResult === 'click' ? 'rgba(80,200,120,0.4)' : 'rgba(255,60,60,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: rouletteResult === 'bang' ? 'rgba(255,60,60,0.08)' : rouletteResult === 'click' ? 'rgba(80,200,120,0.06)' : 'rgba(255,60,60,0.03)', animation: rouletteSpinning ? 'vPulse 0.1s linear infinite' : 'none' }}>
                        <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: rouletteResult ? '0.7rem' : '1.2rem', color: rouletteResult === 'bang' ? 'rgba(255,60,60,0.9)' : rouletteResult === 'click' ? 'rgba(80,200,120,0.8)' : 'rgba(255,60,60,0.4)', letterSpacing: 2 }}>{rouletteResult === 'bang' ? 'BANG' : rouletteResult === 'click' ? 'CLICK' : '⊕'}</span>
                    </div>
                    {rouletteResult && !rouletteSpinning && (() => {
                        const punishmentText = o.config?.punishment || 'Write 100 lines: "I pulled the trigger and paid the price"';
                        return (
                            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: rouletteResult === 'bang' ? 'rgba(255,80,80,0.7)' : 'rgba(80,200,120,0.7)', lineHeight: 1.6, margin: '0 0 20px', padding: '14px 18px', background: rouletteResult === 'bang' ? 'rgba(255,60,60,0.06)' : 'rgba(80,200,120,0.06)', border: `1px solid ${rouletteResult === 'bang' ? 'rgba(255,60,60,0.15)' : 'rgba(80,200,120,0.15)'}`, borderRadius: 8 }}>
                                {rouletteResult === 'bang' ? punishmentText : 'You survived. Describe the fear you felt.'}
                            </div>
                        );
                    })()}
                    {!rouletteResult ? (
                        <button disabled={rouletteSpinning} onClick={() => {
                            setRouletteSpinning(true);
                            setTimeout(() => {
                                const val = Math.random() < 0.167 ? 'bang' : 'click';
                                setRouletteResult(val); setRouletteSpinning(false); setMechDone(true);
                                saveGambleResult({ rouletteResult: val }, 'russian_roulette');
                                const rpt = o.config?.punishment || 'Write 100 lines: "I pulled the trigger and paid the price"'; const rBang = val === 'bang'; const rlo = rpt.toLowerCase();
                                const rinf = rBang ? (/proof|video|selfie|photo|picture|body writing/.test(rlo) ? 'photo' : /write|essay|confession|journal|list|lines|grateful/.test(rlo) ? 'writing' : /shower|plank|hold|sit|pushup|squat|camera|edge|ice/.test(rlo) ? 'endurance' : 'writing') : 'writing';
                                setPendingFollowUp({ orderType: o.type, source: `Russian Roulette — ${rBang ? 'BANG' : 'SURVIVED'}`, resultText: rBang ? rpt : 'You survived. Describe the fear you felt.', type: rinf });
                            }, 1500);
                        }} style={{ padding: '16px 48px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', letterSpacing: '4px', color: 'rgba(255,60,60,0.8)', background: 'rgba(255,60,60,0.06)', border: '1px solid rgba(255,60,60,0.2)', borderRadius: 8, cursor: 'pointer' }}>
                            {rouletteSpinning ? 'CHAMBER SPINNING...' : 'PULL TRIGGER'}
                        </button>
                    ) : null}
                    {rouletteResult && !rouletteSpinning && mechDone && (
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '4px', animation: 'vPulse 1s ease infinite', marginTop: 8, textAlign: 'center' }}>YOUR FATE IS SEALED</div>
                    )}
                </div>
            )}

            {/* ── SPIN WHEEL ── */}
            {o.type === 'spin_wheel' && (() => {
                const segments = o.config?.segments?.length > 0 ? o.config.segments : WHEEL.map((w: any) => ({ text: w.text, followUpType: /proof|video|selfie|photo|picture|body writing/.test(w.text.toLowerCase()) ? 'photo' : /write|essay|confession|journal|list|lines|grateful/.test(w.text.toLowerCase()) ? 'writing' : /shower|plank|hold|sit|pushup|squat|exercise|ice|edge|camera/.test(w.text.toLowerCase()) ? 'endurance' : 'instant' }));
                return (
                    <div style={{ textAlign: 'center', padding: '10px 0' }}>
                        {!wheelResult ? (
                            <>
                                <div style={{ width: 100, height: 100, margin: '12px auto 20px', borderRadius: '50%', border: `2px solid ${wheelSpinning ? 'rgba(197,160,89,0.5)' : `${R}0.2)`}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: wheelSpinning ? 'rgba(197,160,89,0.06)' : `${R}0.04)`, animation: wheelSpinning ? 'vPulse 0.08s linear infinite' : 'none', transition: 'all 0.2s' }}>
                                    <span style={{ fontFamily: 'Cinzel, serif', fontSize: '2rem', color: wheelSpinning ? 'rgba(197,160,89,0.6)' : `${R}0.3)` }}>◎</span>
                                </div>
                                {wheelSpinning && wheelPreview && (
                                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: 'rgba(197,160,89,0.4)', minHeight: 24, marginBottom: 12, animation: 'vPulse 0.15s linear infinite' }}>{wheelPreview}</div>
                                )}
                                <button disabled={wheelSpinning} onClick={() => {
                                    if (segments.length === 0) return;
                                    setWheelSpinning(true); setWheelPreview(null);
                                    let count = 0; let finalSeg: any = null;
                                    const iv = setInterval(() => {
                                        finalSeg = segments[Math.floor(Math.random() * segments.length)];
                                        setWheelPreview(finalSeg.text); count++;
                                        if (count > 20) { clearInterval(iv); setWheelSpinning(false); setWheelPreview(null); setWheelResult(finalSeg); setMechDone(true); saveGambleResult({ wheelResult: finalSeg }, 'spin_wheel'); const wft = finalSeg.followUpType || 'writing'; setPendingFollowUp({ orderType: o.type, source: 'Spin Wheel', resultText: finalSeg.text, type: wft === 'instant' ? 'writing' : wft, prompt: finalSeg.followUpPrompt, instruction: finalSeg.followUpInstruction, duration: finalSeg.followUpDuration, target: finalSeg.followUpTarget }); }
                                    }, 100);
                                }} style={{ padding: '16px 48px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', letterSpacing: '4px', color: '#080810', background: 'rgba(197,160,89,0.7)', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                                    {wheelSpinning ? 'SPINNING...' : 'SPIN'}
                                </button>
                            </>
                        ) : (
                            <>
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', color: 'rgba(197,160,89,0.6)', letterSpacing: 3, marginBottom: 8 }}>YOU LANDED ON</div>
                                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'rgba(197,160,89,0.8)', lineHeight: 1.6, margin: '0 0 16px', padding: '14px 18px', background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 8 }}>{wheelResult.text}</div>
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '4px', animation: 'vPulse 1s ease infinite', marginTop: 8, textAlign: 'center' }}>YOUR FATE IS SEALED</div>
                            </>
                        )}
                    </div>
                );
            })()}

            {/* ── TRUTH OR DARE ── */}
            {o.type === 'truth_dare' && (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                    {!truthDareChoice ? (
                        <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                            <button onClick={() => { setTruthDareChoice('truth'); saveGambleResult({ truthDareChoice: 'truth' }, 'truth_dare'); const tText = o.config?.truthText || 'Confess your deepest weakness to Queen Karin — at least 150 words'; const tFu = o.config?.truthFollowUp || 'writing'; setPendingFollowUp({ orderType: o.type, source: 'Truth or Dare (truth)', resultText: tText, type: tFu }); }}
                                style={{ flex: 1, maxWidth: 160, padding: '20px 16px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', letterSpacing: '3px', color: 'rgba(197,160,89,0.8)', background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.2)', borderRadius: 8, cursor: 'pointer' }}>TRUTH</button>
                            <button onClick={() => { setTruthDareChoice('dare'); saveGambleResult({ truthDareChoice: 'dare' }, 'truth_dare'); const dText = o.config?.dareText || 'Take a cold shower for 60 seconds — upload photo proof'; const dFu = o.config?.dareFollowUp || 'endurance'; setPendingFollowUp({ orderType: o.type, source: 'Truth or Dare (dare)', resultText: dText, type: dFu }); }}
                                style={{ flex: 1, maxWidth: 160, padding: '20px 16px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', letterSpacing: '3px', color: 'rgba(255,80,80,0.8)', background: 'rgba(255,60,60,0.04)', border: '1px solid rgba(255,60,60,0.2)', borderRadius: 8, cursor: 'pointer' }}>DARE</button>
                        </div>
                    ) : (() => {
                        const choiceText = truthDareChoice === 'truth' ? (o.config?.truthText || 'Confess your deepest weakness to Queen Karin — at least 150 words') : (o.config?.dareText || 'Take a cold shower for 60 seconds — upload photo proof');
                        return (
                            <>
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', color: truthDareChoice === 'truth' ? 'rgba(197,160,89,0.6)' : 'rgba(255,80,80,0.6)', letterSpacing: 3, marginBottom: 8 }}>{truthDareChoice.toUpperCase()}</div>
                                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, margin: '0 0 16px', padding: '14px 18px', background: truthDareChoice === 'truth' ? 'rgba(197,160,89,0.06)' : 'rgba(255,60,60,0.06)', border: `1px solid ${truthDareChoice === 'truth' ? 'rgba(197,160,89,0.15)' : 'rgba(255,60,60,0.15)'}`, borderRadius: 8 }}>{choiceText}</div>
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '4px', animation: 'vPulse 1s ease infinite', marginTop: 8, textAlign: 'center' }}>YOUR FATE IS SEALED</div>
                            </>
                        );
                    })()}
                </div>
            )}

            {/* ── GREED GAME ── */}
            {o.type === 'greed_game' && (() => {
                const ceiling = o.config?.ceiling || 50;
                return (
                    <div style={{ textAlign: 'center', padding: '10px 0' }}>
                        {!greedBusted && !greedCashedOut ? (
                            <>
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '2rem', color: 'rgba(197,160,89,0.9)', margin: '12px 0 8px' }}>{greedCoins}</div>
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.25)', letterSpacing: 2, marginBottom: 20 }}>COINS STACKED / MAX {ceiling}</div>
                                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                                    <button onClick={() => {
                                        const add = Math.floor(Math.random() * 15) + 3;
                                        const bustChance = (greedCoins + add) / ceiling;
                                        if (Math.random() < bustChance * 0.6) { setGreedBusted(true); setGreedCoins(0); setMechDone(true); saveGambleResult({ greedBusted: true }, 'greed_game'); }
                                        else { setGreedCoins(prev => Math.min(prev + add, ceiling)); }
                                    }} style={{ padding: '16px 32px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', letterSpacing: '3px', color: 'rgba(197,160,89,0.8)', background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.2)', borderRadius: 8, cursor: 'pointer' }}>PUSH</button>
                                    <button disabled={greedCoins === 0} onClick={() => { setGreedCashedOut(true); setMechDone(true); saveGambleResult({ greedCashedOut: true, greedCoins }, 'greed_game'); }}
                                        style={{ padding: '16px 32px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', letterSpacing: '3px', color: greedCoins > 0 ? 'rgba(80,200,120,0.8)' : 'rgba(255,255,255,0.1)', background: greedCoins > 0 ? 'rgba(80,200,120,0.04)' : 'transparent', border: `1px solid ${greedCoins > 0 ? 'rgba(80,200,120,0.2)' : 'rgba(255,255,255,0.04)'}`, borderRadius: 8, cursor: greedCoins > 0 ? 'pointer' : 'default' }}>CASH OUT</button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1rem', color: greedBusted ? 'rgba(255,60,60,0.9)' : 'rgba(80,200,120,0.8)', letterSpacing: 4, marginBottom: 8 }}>{greedBusted ? 'BUSTED' : `CASHED OUT: ${greedCoins} COINS`}</div>
                                {greedBusted && <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: 'rgba(255,80,80,0.5)', marginBottom: 16 }}>Greed consumed you. You walk away with nothing.</div>}
                                {mechDone && (
                                    <button onClick={() => submitTask({ text: `Greed game: ${greedBusted ? 'BUSTED — 0 coins' : `Cashed out ${greedCoins} coins`}` })}
                                        style={{ padding: '14px 36px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', letterSpacing: '3px', color: '#050508', background: 'rgba(80,200,120,0.5)', border: 'none', borderRadius: 8, cursor: 'pointer', animation: 'vFadeIn 0.3s ease' }}>SUBMIT RESULT</button>
                                )}
                            </>
                        )}
                    </div>
                );
            })()}

            {/* ── SIMON SAYS ── */}
            {o.type === 'simon_says' && (() => {
                const chain: { text: string; timeLimit: number; proofType?: 'photo'|'video' }[] = o.config?.chainTasks || [];

                if (simonPhase === 'idle') return (
                    <div style={{ textAlign: 'center', padding: '12px 0 4px', animation: 'vFadeIn 0.4s ease' }}>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.5rem', color: 'rgba(197,160,89,0.45)', letterSpacing: '7px', marginBottom: 22 }}>⚡ SIMON SAYS</div>
                        {chain.length === 0 ? (
                            <>
                                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.05rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.75, marginBottom: 12 }}>You have obeyed.</div>
                                <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.78rem', color: 'rgba(255,255,255,0.28)', lineHeight: 1.8, marginBottom: 28 }}>No commands were issued. Mark complete to continue.</div>
                                <button onClick={() => submitTask({})} style={{ width: '100%', padding: '16px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '3px', color: '#080810', background: 'rgba(197,160,89,0.7)', border: 'none', borderRadius: 8, cursor: 'pointer', marginBottom: 10 }}>MARK COMPLETE</button>
                            </>
                        ) : (
                            <>
                                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.05rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.75, marginBottom: 12 }}>{chain.length} commands are waiting.</div>
                                <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.78rem', color: 'rgba(255,255,255,0.28)', lineHeight: 1.8, marginBottom: 28 }}>Tasks will arrive at random. You will not be warned. When one appears — you obey immediately.</div>
                                <button onClick={() => {
                                    const intervalMinutes = o.config?.intervalMinutes || 60;
                                    const waitMs = Math.floor(Math.random() * intervalMinutes * 60 * 1000) + 60000;
                                    const waitUntil = Date.now() + waitMs;
                                    setSimonWaitUntil(waitUntil); setSimonStep(0); setSimonProofs([]); setSimonLastTask(null); setSimonPhase('waiting');
                                    try { localStorage.setItem('ss_state', JSON.stringify({ phase: 'waiting', step: 0, waitUntil, proofs: [], lastTask: null })); } catch {}
                                }} style={{ width: '100%', padding: '16px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '3px', color: '#080810', background: 'rgba(197,160,89,0.7)', border: 'none', borderRadius: 8, cursor: 'pointer', marginBottom: 10 }}>START THE GAME</button>
                            </>
                        )}
                        {onClose && <button onClick={onClose} style={{ width: '100%', padding: '13px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.65rem', letterSpacing: '3px', color: 'rgba(255,255,255,0.18)', background: 'transparent', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, cursor: 'pointer' }}>CLOSE</button>}
                    </div>
                );

                if (simonPhase === 'waiting') return (
                    <div style={{ textAlign: 'center', padding: '36px 10px 24px', animation: 'vFadeIn 0.8s ease' }}>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.45rem', color: 'rgba(197,160,89,0.3)', letterSpacing: '8px', marginBottom: 32 }}>SIMON IS WATCHING</div>
                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: `${R}0.75)`, margin: '0 auto 32px', animation: 'vPulse 1.5s ease infinite', boxShadow: `0 0 16px ${R}0.3)` }} />
                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.7rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '8px', marginBottom: 12 }}>Stand by.</div>
                        <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.72rem', color: 'rgba(255,255,255,0.18)', letterSpacing: '3px' }}>The next command is coming.</div>
                        <div style={{ marginTop: 36, fontFamily: 'Orbitron, sans-serif', fontSize: '0.48rem', color: 'rgba(255,255,255,0.1)', letterSpacing: '4px' }}>TASK {simonStep + 1} / {chain.length}</div>
                    </div>
                );

                if (simonPhase === 'task' && simonCurrentTask) {
                    const proofType = simonCurrentTask.proofType || 'photo';
                    const isVideo = proofType === 'video';
                    return (
                        <div style={{ animation: 'vFadeIn 0.4s ease' }}>
                            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.55rem', color: `${R}0.6)`, letterSpacing: '7px', marginBottom: 14, textAlign: 'center' }}>⚡ SIMON SAYS</div>
                            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'rgba(255,255,255,0.88)', lineHeight: 1.75, marginBottom: 18, padding: '18px 16px', background: `${R}0.06)`, border: `1px solid ${R}0.2)`, borderRadius: 10, textAlign: 'center' }}>{simonCurrentTask.text}</div>
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ height: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${simonTaskLimit > 0 ? (simonTaskSecs / simonTaskLimit) * 100 : 100}%`, background: simonTaskSecs <= Math.ceil(simonTaskLimit * 0.2) ? 'rgba(255,50,50,0.7)' : `${R}0.55)`, borderRadius: 2, transition: 'width 0.9s linear, background 0.4s' }} />
                                </div>
                            </div>
                            <label style={{ cursor: simonUploading ? 'default' : 'pointer', display: 'block' }}>
                                <div style={{ padding: '18px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '3px', color: simonUploading ? 'rgba(255,255,255,0.12)' : '#c5a059', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(197,160,89,0.3)', borderRadius: 10, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 0 15px rgba(197,160,89,0.08)' }}>
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                    {simonUploading ? 'UPLOADING...' : isVideo ? 'RECORD VIDEO PROOF' : 'UPLOAD PHOTO PROOF'}
                                </div>
                                <input type="file" accept={isVideo ? 'video/*' : 'image/*'} capture="environment" style={{ display: 'none' }} onChange={async (e) => {
                                    const file = e.target.files?.[0]; if (!file) return; e.target.value = '';
                                    if (previewMode) { const nextStep = simonStep + 1; if (nextStep >= chain.length) { setSimonPhase('complete'); try { localStorage.removeItem('ss_state'); } catch {} } else { setSimonStep(nextStep); const waitMs = 5000; const waitUntil = Date.now() + waitMs; setSimonWaitUntil(waitUntil); setSimonPhase('waiting'); } return; }
                                    setSimonUploading(true);
                                    if (simonTaskRef.current) { clearInterval(simonTaskRef.current); simonTaskRef.current = null; }
                                    try {
                                        const ext = file.name.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'jpg');
                                        const fd = new FormData(); fd.append('file', file); fd.append('folder', `vault/simon/${mid}`); fd.append('ext', ext === 'heic' ? 'jpg' : ext);
                                        const res = await fetch('/api/upload', { method: 'POST', body: fd });
                                        const uploadData = await res.json();
                                        if (uploadData.url) {
                                            const newProofs = [...simonProofs, uploadData.url];
                                            setSimonProofs(newProofs);
                                            const nextStep = simonStep + 1;
                                            if (nextStep >= chain.length) {
                                                await submitTask({ text: `Simon Says: completed ${chain.length} task${chain.length !== 1 ? 's' : ''}`, photoUrl: newProofs[0] });
                                                setSimonStep(0); setSimonProofs([]); setSimonCurrentTask(null); setSimonLastTask(null); setSimonPhase('complete');
                                                try { localStorage.removeItem('ss_state'); } catch {}
                                            } else {
                                                setSimonStep(nextStep);
                                                const intervalMinutes = o.config?.intervalMinutes || 60;
                                                const waitMs = Math.floor(Math.random() * intervalMinutes * 60 * 1000) + 60000;
                                                const waitUntil = Date.now() + waitMs;
                                                setSimonWaitUntil(waitUntil); setSimonPhase('waiting');
                                                try { localStorage.setItem('ss_state', JSON.stringify({ phase: 'waiting', step: nextStep, waitUntil, proofs: newProofs, lastTask: simonCurrentTask })); } catch {}
                                            }
                                        }
                                    } catch {} finally { setSimonUploading(false); }
                                }} />
                            </label>
                            <div style={{ marginTop: 10, fontFamily: 'Orbitron, sans-serif', fontSize: '0.45rem', color: 'rgba(255,255,255,0.1)', letterSpacing: '4px', textAlign: 'center' }}>TASK {simonStep + 1} / {chain.length}</div>
                        </div>
                    );
                }

                if (simonPhase === 'complete') return (
                    <div style={{ textAlign: 'center', padding: '24px 10px 16px', animation: 'vFadeIn 0.8s ease' }}>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.48rem', color: 'rgba(80,200,120,0.45)', letterSpacing: '8px', marginBottom: 24 }}>ALL TASKS COMPLETE</div>
                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.2rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: 14 }}>Good boy.</div>
                        <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.78rem', color: 'rgba(255,255,255,0.22)', lineHeight: 1.75, marginBottom: 28 }}>You've proven yourself today. You may rest.</div>
                        <button onClick={() => { try { localStorage.removeItem('vault_gamble_results'); localStorage.removeItem('ss_state'); } catch {} onClose?.(); }}
                            style={{ padding: '14px 40px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', letterSpacing: '4px', color: 'rgba(80,200,120,0.7)', background: 'transparent', border: '1px solid rgba(80,200,120,0.2)', borderRadius: 8, cursor: 'pointer' }}>DONE</button>
                    </div>
                );

                return null;
            })()}

            {/* ── PAYMENT ── */}
            {isPayment && (() => {
                const amount = o.config?.amount || o.target || 5;
                return (
                    <div style={{ textAlign: 'center', padding: '10px 0' }}>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '2rem', color: 'rgba(197,160,89,0.9)', margin: '8px 0 4px' }}>{amount}</div>
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.25)', letterSpacing: 2, marginBottom: 20 }}>COINS REQUIRED</div>
                        <button onClick={() => submitTask({ text: `Tribute paid: ${amount} coins` })}
                            style={{ padding: '16px 48px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', letterSpacing: '3px', color: '#050508', background: 'rgba(197,160,89,0.5)', border: 'none', borderRadius: 8, cursor: 'pointer' }}>PAY TRIBUTE</button>
                    </div>
                );
            })()}

            {/* ── TEXT WRITING TASKS ── */}
            {isTextTask && (
                <>
                    <textarea value={taskText} onChange={e => setTaskText(e.target.value)} placeholder="Write here..."
                        style={{ width: '100%', minHeight: 120, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(197,160,89,0.12)', borderRadius: 10, padding: 16, color: 'rgba(255,255,255,0.6)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '16px', lineHeight: 1.7, resize: 'vertical', outline: 'none' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                        <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)' }}>{taskText.split(/\s+/).filter(Boolean).length} words</span>
                        <button onClick={() => submitTask({ text: taskText })} disabled={!taskText.trim()}
                            style={{ padding: '12px 28px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', letterSpacing: '3px', color: taskText.trim() ? '#080810' : 'rgba(255,255,255,0.1)', background: taskText.trim() ? 'rgba(197,160,89,0.7)' : 'transparent', border: `1px solid ${taskText.trim() ? 'rgba(197,160,89,0.4)' : 'rgba(255,255,255,0.04)'}`, borderRadius: 8, cursor: taskText.trim() ? 'pointer' : 'default' }}>SUBMIT</button>
                    </div>
                </>
            )}

            {/* ── PHOTO / VIDEO PROOF TASKS ── */}
            {isPhotoTask && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <label style={{ cursor: 'pointer' }}>
                        <div style={{ padding: '18px 20px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '3px', color: taskUploading ? 'rgba(255,255,255,0.15)' : '#c5a059', background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', border: '1px solid #c5a059', borderRadius: 10, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 0 15px rgba(197,160,89,0.2)' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                            {taskUploading ? 'UPLOADING...' : 'UPLOAD PROOF'}
                        </div>
                        <input type="file" accept="image/*,video/*" capture="environment" style={{ display: 'none' }} onChange={async (e) => {
                            const file = e.target.files?.[0]; if (!file) return; e.target.value = '';
                            if (previewMode) { await submitTask({ photoUrl: 'preview://proof' }); return; }
                            setTaskUploading(true);
                            try {
                                const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
                                const fd = new FormData(); fd.append('file', file); fd.append('folder', `vault/tasks/${mid}`); fd.append('ext', ext === 'heic' ? 'jpg' : ext);
                                const res = await fetch('/api/upload', { method: 'POST', body: fd });
                                const data = await res.json();
                                if (data.url) await submitTask({ photoUrl: data.url });
                            } catch {} finally { setTaskUploading(false); }
                        }} />
                    </label>
                </div>
            )}

            {/* ── SELF-REPORT (edge, corner_time, denial, kneel) ── */}
            {isSelfReport && (
                <button onClick={() => submitTask({ text: `${o.type} completed` })}
                    style={{ width: '100%', padding: '16px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', letterSpacing: '3px', color: 'rgba(197,160,89,0.85)', background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.2)', borderRadius: 8, cursor: 'pointer', textAlign: 'center' }}>
                    MARK COMPLETE
                </button>
            )}

            {/* ── FALLBACK: text + photo for unknown types ── */}
            {!isPhotoTask && !isTextTask && !isSelfReport && !isPayment && !isInteractive && !['spin','trial','tribute','silence'].includes(o.type) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <textarea value={taskText} onChange={e => setTaskText(e.target.value)} placeholder="Describe your completion..."
                        style={{ width: '100%', minHeight: 80, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(197,160,89,0.12)', borderRadius: 10, padding: 14, color: 'rgba(255,255,255,0.6)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '16px', lineHeight: 1.6, resize: 'vertical', outline: 'none' }} />
                    <label style={{ cursor: 'pointer' }}>
                        <div style={{ padding: '14px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '2px', color: '#c5a059', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(197,160,89,0.4)', borderRadius: 10, textAlign: 'center', boxShadow: '0 0 10px rgba(197,160,89,0.1)' }}>+ ATTACH PHOTO</div>
                        <input type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={async (e) => {
                            const file = e.target.files?.[0]; if (!file) return; e.target.value = '';
                            if (previewMode) { await submitTask({ text: taskText || undefined, photoUrl: 'preview://proof' }); return; }
                            setTaskUploading(true);
                            try {
                                const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
                                const fd = new FormData(); fd.append('file', file); fd.append('folder', `vault/tasks/${mid}`); fd.append('ext', ext === 'heic' ? 'jpg' : ext);
                                const res = await fetch('/api/upload', { method: 'POST', body: fd });
                                const data = await res.json();
                                if (data.url) await submitTask({ text: taskText || undefined, photoUrl: data.url });
                            } catch {} finally { setTaskUploading(false); }
                        }} />
                    </label>
                    <button onClick={() => submitTask({ text: taskText })} disabled={!taskText.trim()}
                        style={{ padding: '14px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', letterSpacing: '3px', color: taskText.trim() ? '#080810' : 'rgba(255,255,255,0.1)', background: taskText.trim() ? 'rgba(197,160,89,0.7)' : 'transparent', border: `1px solid ${taskText.trim() ? 'rgba(197,160,89,0.4)' : 'rgba(255,255,255,0.04)'}`, borderRadius: 8, cursor: taskText.trim() ? 'pointer' : 'default' }}>SUBMIT</button>
                </div>
            )}

            {/* ── SKIP BUTTON (for non-interactive tasks) ── */}
            {!['spin','trial','tribute','silence','simon_says'].includes(o.type) && !isInteractive && (
                <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <button onClick={() => setSkipOpen(true)} style={{ width: '100%', padding: '12px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.6rem', letterSpacing: '3px', color: 'rgba(255,255,255,0.22)', background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, cursor: 'pointer' }}>SKIP THIS TASK</button>
                </div>
            )}

            {/* ══════════════════════════════════════════════
                FOLLOW-UP OVERLAY (position: fixed — floats above everything)
            ══════════════════════════════════════════════ */}
            {followUp && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'linear-gradient(rgba(4,3,10,0.78) 0%, rgba(4,3,10,0.88) 100%), url(/work-bg.jpg) center top / cover no-repeat', display: 'flex', flexDirection: 'column', overflow: 'auto' } as React.CSSProperties}>
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, background: 'radial-gradient(ellipse at 50% 20%, rgba(139,0,0,0.08) 0%, transparent 60%)' }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '70px 20px 120px', position: 'relative', zIndex: 5 }}>
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.15)', letterSpacing: 4, textAlign: 'center', marginBottom: 40 }}>{followUp.source?.toUpperCase()}</div>
                        <div style={{ width: 40, height: 1, background: `${R}0.2)`, marginBottom: 50 }} />
                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.05rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.7, textAlign: 'center', marginBottom: 40 }}>{followUp.resultText}</div>
                        {(followUp.prompt || followUp.instruction) && (
                            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', lineHeight: 1.7, textAlign: 'center', marginBottom: 40, fontStyle: 'italic' }}>{followUp.prompt || followUp.instruction}</div>
                        )}
                        {followUp.duration && (
                            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.2)', letterSpacing: 3, textAlign: 'center', marginBottom: 40 }}>{Math.floor(followUp.duration / 60)}:{String(followUp.duration % 60).padStart(2, '0')} DURATION</div>
                        )}
                        <div style={{ width: 60, height: 1, background: `${R}0.1)`, marginBottom: 80 }} />

                        {/* WRITING follow-up */}
                        {followUp.type === 'writing' && (() => {
                            const wc = followUpText.split(/\s+/).filter(Boolean).length;
                            const parsedWords = followUp.resultText?.match(/(\d+)[- ]?word/i);
                            const minW = followUp.target || (parsedWords ? parseInt(parsedWords[1]) : 20);
                            const ok = wc >= minW;
                            return (
                                <div style={{ width: '100%' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                        <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', color: ok ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)' }}>{wc} / {minW} words</span>
                                        <button onClick={() => submitFollowUp({ text: `${followUp.source}: ${followUp.resultText} — ${followUpText}` })} disabled={!ok}
                                            style={{ padding: '14px 32px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem', letterSpacing: '3px', color: ok ? '#080810' : 'rgba(255,255,255,0.08)', background: ok ? 'rgba(197,160,89,0.7)' : 'transparent', border: `1px solid ${ok ? 'rgba(197,160,89,0.4)' : 'rgba(255,255,255,0.03)'}`, borderRadius: 8, cursor: ok ? 'pointer' : 'default' }}>SUBMIT</button>
                                    </div>
                                    <textarea value={followUpText} onChange={e => setFollowUpText(e.target.value)} placeholder="Write here..."
                                        style={{ width: '100%', minHeight: '35vh', background: 'rgba(255,255,255,0.03)', border: `1px solid ${R}0.1)`, borderRadius: 10, padding: 16, color: 'rgba(255,255,255,0.5)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '16px', lineHeight: 1.7, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                            );
                        })()}

                        {/* PHOTO / VIDEO follow-up */}
                        {(followUp.type === 'photo' || followUp.type === 'video') && (
                            <div style={{ width: '75%', margin: '0 auto' }}>
                                <label style={{ cursor: 'pointer', display: 'block' }}>
                                    <div style={{ padding: '18px 20px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '3px', color: followUpUploading ? 'rgba(255,255,255,0.15)' : '#c5a059', background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', border: '1px solid #c5a059', borderRadius: 10, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 0 15px rgba(197,160,89,0.2)' }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                        {followUpUploading ? 'UPLOADING...' : (followUp.type === 'video' ? 'UPLOAD VIDEO' : 'UPLOAD PHOTO')}
                                    </div>
                                    <input type="file" accept={followUp.type === 'video' ? 'video/*' : 'image/*,video/*'} capture="environment" style={{ display: 'none' }} onChange={async (e) => {
                                        const file = e.target.files?.[0]; if (!file) return; e.target.value = '';
                                        if (previewMode) { await submitFollowUp({ text: `${followUp.source}: ${followUp.resultText}`, photoUrl: 'preview://proof' }); return; }
                                        setFollowUpUploading(true);
                                        try {
                                            const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
                                            const fd = new FormData(); fd.append('file', file); fd.append('folder', `vault/tasks/${mid}`); fd.append('ext', ext === 'heic' ? 'jpg' : ext);
                                            const res = await fetch('/api/upload', { method: 'POST', body: fd });
                                            const data = await res.json();
                                            if (data.url) await submitFollowUp({ text: `${followUp.source}: ${followUp.resultText}`, photoUrl: data.url });
                                        } catch {} finally { setFollowUpUploading(false); }
                                    }} />
                                </label>
                            </div>
                        )}

                        {/* ENDURANCE follow-up */}
                        {followUp.type === 'endurance' && (() => {
                            const wc = followUpText.split(/\s+/).filter(Boolean).length;
                            const parsedWords = followUp.resultText?.match(/(\d+)[- ]?word/i);
                            const minW = followUp.target || (parsedWords ? parseInt(parsedWords[1]) : 15);
                            const ok = wc >= minW;
                            return (
                                <div style={{ width: '100%' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                        <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', color: ok ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)' }}>{wc} / {minW} words</span>
                                        <button onClick={() => submitFollowUp({ text: `${followUp.source}: ${followUp.resultText} — ${followUpText}` })} disabled={!ok}
                                            style={{ padding: '14px 32px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem', letterSpacing: '3px', color: ok ? '#080810' : 'rgba(255,255,255,0.08)', background: ok ? 'rgba(197,160,89,0.7)' : 'transparent', border: `1px solid ${ok ? 'rgba(197,160,89,0.4)' : 'rgba(255,255,255,0.03)'}`, borderRadius: 8, cursor: ok ? 'pointer' : 'default' }}>SUBMIT</button>
                                    </div>
                                    <textarea value={followUpText} onChange={e => setFollowUpText(e.target.value)} placeholder="Describe how you completed this task..."
                                        style={{ width: '100%', minHeight: 220, background: 'rgba(255,255,255,0.03)', border: `1px solid ${R}0.1)`, borderRadius: 10, padding: 16, color: 'rgba(255,255,255,0.5)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '16px', lineHeight: 1.7, resize: 'vertical', outline: 'none', boxSizing: 'border-box', marginBottom: 12 }} />
                                    <label style={{ cursor: 'pointer', display: 'block' }}>
                                        <div style={{ padding: '14px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '2px', color: followUpUploading ? 'rgba(255,255,255,0.15)' : '#c5a059', background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', border: '1px solid #c5a059', borderRadius: 10, textAlign: 'center', boxShadow: '0 0 15px rgba(197,160,89,0.2)' }}>
                                            {followUpUploading ? 'UPLOADING...' : '+ ATTACH PROOF'}
                                        </div>
                                        <input type="file" accept="image/*,video/*" capture="environment" style={{ display: 'none' }} onChange={async (e) => {
                                            const file = e.target.files?.[0]; if (!file) return; e.target.value = '';
                                            if (previewMode) { await submitFollowUp({ text: `${followUp.source}: ${followUp.resultText} — ${followUpText || 'completed'}`, photoUrl: 'preview://proof' }); return; }
                                            setFollowUpUploading(true);
                                            try {
                                                const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
                                                const fd = new FormData(); fd.append('file', file); fd.append('folder', `vault/tasks/${mid}`); fd.append('ext', ext === 'heic' ? 'jpg' : ext);
                                                const res = await fetch('/api/upload', { method: 'POST', body: fd });
                                                const data = await res.json();
                                                if (data.url) await submitFollowUp({ text: `${followUp.source}: ${followUp.resultText} — ${followUpText || 'completed'}`, photoUrl: data.url });
                                            } catch {} finally { setFollowUpUploading(false); }
                                        }} />
                                    </label>
                                </div>
                            );
                        })()}

                        {/* INSTANT follow-up */}
                        {followUp.type === 'instant' && (
                            <button onClick={() => submitFollowUp({ text: `${followUp.source}: ${followUp.resultText}` })}
                                style={{ padding: '16px 48px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem', letterSpacing: '3px', color: '#080810', background: 'rgba(197,160,89,0.7)', border: 'none', borderRadius: 8, cursor: 'pointer' }}>ACKNOWLEDGE</button>
                        )}

                        {/* SKIP button in follow-up */}
                        {!followUpSkipping && (
                            <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)', width: '75%' }}>
                                <button onClick={() => setFollowUpSkipping(true)} style={{ width: '100%', padding: '14px 20px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.65rem', letterSpacing: '3px', color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, cursor: 'pointer' }}>SKIP THIS TASK</button>
                            </div>
                        )}

                        {/* SKIP OPTIONS */}
                        {followUpSkipping && (
                            <div style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(5,5,8,0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 30, gap: 24, animation: 'vFadeIn 0.3s ease' }}>
                                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'rgba(255,255,255,0.5)', letterSpacing: 2, textAlign: 'center', lineHeight: 1.7 }}>Skip this task?</div>
                                <div style={{ width: 40, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                                <button onClick={async () => {
                                    const coins = profile?.wallet ?? 0;
                                    if (coins < 300) { alert('Not enough coins. 300 required.'); return; }
                                    if (previewMode) { setFollowUp(null); setFollowUpText(''); setFollowUpSkipping(false); return; }
                                    try {
                                        const res = await fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'skip_order', memberId: mid, orderType: followUp.orderType, cost: 300 }) });
                                        const data = await res.json();
                                        if (data.success) { setFollowUp(null); setFollowUpText(''); setFollowUpSkipping(false); }
                                    } catch {}
                                }} style={{ width: '100%', maxWidth: 300, padding: '18px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', textAlign: 'center' }}>
                                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', letterSpacing: 3, marginBottom: 6 }}>PAY 300 COINS</div>
                                    <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: 'rgba(255,60,60,0.4)', letterSpacing: 1 }}>BREAKS OBEDIENCE STREAK</div>
                                </button>
                                <button disabled={!((profile?.skippass ?? 0) > 0)} onClick={async () => {
                                    if (previewMode) { setFollowUp(null); setFollowUpText(''); setFollowUpSkipping(false); return; }
                                    try {
                                        const res = await fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'skip_order', memberId: mid, orderType: followUp.orderType, useSkipPass: true }) });
                                        const data = await res.json();
                                        if (data.success) { setFollowUp(null); setFollowUpText(''); setFollowUpSkipping(false); }
                                    } catch {}
                                }} style={{ width: '100%', maxWidth: 300, padding: '18px 20px', borderRadius: 12, background: ((profile?.skippass ?? 0) > 0) ? 'rgba(197,160,89,0.04)' : 'transparent', border: `1px solid ${((profile?.skippass ?? 0) > 0) ? 'rgba(197,160,89,0.2)' : 'rgba(255,255,255,0.04)'}`, cursor: ((profile?.skippass ?? 0) > 0) ? 'pointer' : 'default', textAlign: 'center', opacity: ((profile?.skippass ?? 0) > 0) ? 1 : 0.3 }}>
                                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.75rem', color: ((profile?.skippass ?? 0) > 0) ? 'rgba(197,160,89,0.6)' : 'rgba(255,255,255,0.15)', letterSpacing: 3, marginBottom: 6 }}>USE SKIP PASS</div>
                                    <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', letterSpacing: 1 }}>{profile?.skippass || 0} AVAILABLE</div>
                                </button>
                                <button onClick={() => setFollowUpSkipping(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.15)', letterSpacing: 2, padding: '12px', marginTop: 8 }}>CANCEL</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════
                VAULT SKIP OVERLAY (for non-followUp skips)
            ══════════════════════════════════════════════ */}
            {skipOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(5,5,8,0.97)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 30, gap: 24, animation: 'vFadeIn 0.3s ease' }}>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'rgba(255,255,255,0.5)', letterSpacing: 2, textAlign: 'center', lineHeight: 1.7 }}>Skip this task?</div>
                    <div style={{ width: 40, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                    <button onClick={async () => {
                        const coins = profile?.wallet ?? 0;
                        if (coins < 300) { alert('Not enough coins. 300 required.'); return; }
                        if (previewMode) { setSkipOpen(false); onClose?.(); return; }
                        try {
                            const res = await fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'skip_order', memberId: mid, orderType: o.type, cost: 300 }) });
                            const data = await res.json();
                            if (data.success) { setSkipOpen(false); onClose?.(); }
                        } catch {}
                    }} style={{ width: '100%', maxWidth: 300, padding: '18px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', textAlign: 'center' }}>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', letterSpacing: 3, marginBottom: 6 }}>PAY 300 COINS</div>
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: 'rgba(255,60,60,0.4)', letterSpacing: 1 }}>BREAKS OBEDIENCE STREAK</div>
                    </button>
                    <button disabled={!((profile?.skippass ?? 0) > 0)} onClick={async () => {
                        if (previewMode) { setSkipOpen(false); onClose?.(); return; }
                        try {
                            const res = await fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'skip_order', memberId: mid, orderType: o.type, useSkipPass: true }) });
                            const data = await res.json();
                            if (data.success) { setSkipOpen(false); onClose?.(); }
                        } catch {}
                    }} style={{ width: '100%', maxWidth: 300, padding: '18px 20px', borderRadius: 12, background: ((profile?.skippass ?? 0) > 0) ? 'rgba(197,160,89,0.04)' : 'transparent', border: `1px solid ${((profile?.skippass ?? 0) > 0) ? 'rgba(197,160,89,0.2)' : 'rgba(255,255,255,0.04)'}`, cursor: ((profile?.skippass ?? 0) > 0) ? 'pointer' : 'default', textAlign: 'center', opacity: ((profile?.skippass ?? 0) > 0) ? 1 : 0.3 }}>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.75rem', color: ((profile?.skippass ?? 0) > 0) ? 'rgba(197,160,89,0.6)' : 'rgba(255,255,255,0.15)', letterSpacing: 3, marginBottom: 6 }}>USE SKIP PASS</div>
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', letterSpacing: 1 }}>{profile?.skippass || 0} AVAILABLE</div>
                    </button>
                    <button onClick={() => setSkipOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.15)', letterSpacing: 2, padding: '12px', marginTop: 8 }}>CANCEL</button>
                </div>
            )}
        </>
    );
}
