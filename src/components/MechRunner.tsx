'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MECH_ICON as _MECH_ICON, WHEEL_SEGMENTS, PROOF_TYPES } from '@/lib/mechanisms';

// ── Design tokens (match vault/page.tsx exactly) ──
const R = 'rgba(139,0,0,';

const WHEEL = WHEEL_SEGMENTS;

// ── Pending review — proof submitted, Queen Karin inspects ──
const MSGS_PENDING = [
    'Proof received. I will decide if it is sufficient.',
    'Under inspection now. Wait for me.',
    'I have it. My standards are my business.',
    'Your proof is in my hands now.',
    'Received. I will review it when I am ready.',
    'Logged. Do not assume anything just yet.',
    'I see it. My verdict comes when it comes.',
    'Under inspection. I will be in touch.',
    'Received. The rest is mine to decide.',
    'Good boy for submitting. Whether it is enough is for me to say.',
    'Noted. You are under my control, and so is this.',
    'Mine now. Everything at my pace.',
    'Received. Stand by.',
    'It is in my queue. I do not rush for anyone.',
    'You will hear from me when I am ready.',
    'Submission received. My terms, my inspection.',
    'Good boy for obeying. The rest is not your concern.',
    'Your proof is mine. Everything is under control.',
    'Noted. My inspection, my timeline, my decision.',
    'Received. Now you wait. That is how this works.',
];

// ── Instantly completed — result resolved, nothing to review ──
const MSGS_DONE = [
    'Done. The result stands.',
    'Accepted. Do not overthink it.',
    'Noted. That is all.',
    'I see the outcome. It is logged.',
    'Logged. Move on.',
    'The result is what it is. I have it.',
    'Done. Whether I am satisfied is a separate matter.',
    'Accepted. Everything at my pace from here.',
    'Noted. I will use this as I see fit.',
    'Good boy for completing it. That is as far as my praise goes.',
    'Done. I do not comment on obvious things.',
    'The outcome is mine now. You may continue.',
    'I see it. Logged.',
    'That is concluded. Next comes when I decide.',
    'Noted. I expect nothing less.',
    'Done. No applause. Just obedience.',
    'I see what you did. That does not mean I approve.',
    'Accepted. Keep moving.',
    'That is what it is. I have logged it.',
    'Done. I am already thinking about what comes next.',
];

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

// ─────────────────────────────────────────────────────────────────────────
// ONE UNIVERSAL SHELL — module-level so React sees a stable component type
// (defining inside a component causes unmount/remount on every re-render)
// ─────────────────────────────────────────────────────────────────────────
function GameShell({ title, onClose, children, footer, zIndex = 9990 }: {
    title: string;
    onClose?: () => void;
    children: React.ReactNode;
    footer?: React.ReactNode;
    zIndex?: number;
}) {
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex,
            background: 'linear-gradient(rgba(4,3,10,0.96) 0%, rgba(4,3,10,0.99) 100%), url(/work-bg.jpg) center top/cover no-repeat',
            display: 'flex', flexDirection: 'column', animation: 'vFadeIn 0.3s ease',
        } as React.CSSProperties}>
            {/* ── Standard header ── */}
            <div style={{ flexShrink: 0, padding: '18px 24px 16px', borderBottom: '1px solid rgba(197,160,89,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: 'rgba(197,160,89,0.72)', letterSpacing: '3px', textAlign: 'center' }}>{title}</div>
                {onClose && <button onClick={onClose} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.2)', fontSize: '1.4rem', padding: '4px 8px', lineHeight: 1 }}>×</button>}
            </div>
            {/* ── Scrollable content — centered vertically ── */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '32px 24px', maxWidth: 480, width: '100%', margin: '0 auto' }}>
                {children}
            </div>
            {/* ── Pinned footer buttons ── */}
            {footer && (
                <div style={{ flexShrink: 0, padding: '0 24px 18dvh', width: '100%', maxWidth: 420, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {footer}
                </div>
            )}
        </div>
    );
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
    const isInteractive = ['dice_roll','coinflip','card_pick','russian_roulette','spin_wheel','truth_dare','greed_game','simon_says','quiz'].includes(o.type);
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
    const [cardPhase, setCardPhase]             = useState<'reveal'|'shuffling'|'pick'|'done'>('reveal');
    const shuffledCardsRef                      = useRef<any[]>([]);
    const [mechStarted, setMechStarted]         = useState(false);
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
    const [quizDone, setQuizDone]               = useState(false);
    const [simonStep, setSimonStep]             = useState(0);
    const [simonPhase, setSimonPhase]           = useState<'idle'|'waiting'|'ready'|'task'|'complete'>('idle');
    const [simonWaitUntil, setSimonWaitUntil]   = useState(0);
    const [simonTaskSecs, setSimonTaskSecs]     = useState(0);
    const [simonTaskLimit, setSimonTaskLimit]   = useState(0);
    const [simonReadySecs, setSimonReadySecs]   = useState(60);
    const [simonCurrentTask, setSimonCurrentTask] = useState<{text:string;timeLimit:number;proofType?:string}|null>(null);
    const [simonLastTask, setSimonLastTask]     = useState<{text:string}|null>(null);
    const [simonProofs, setSimonProofs]         = useState<string[]>([]);
    const [simonUploading, setSimonUploading]   = useState(false);
    const [taskText, setTaskText]               = useState('');
    const [taskUploading, setTaskUploading]     = useState(false);
    const [trialOpen, setTrialOpen]             = useState(false);
    const [trialText, setTrialText]             = useState('');
    const [trialDone, setTrialDone]             = useState(false);
    const [pendingAccept, setPendingAccept]     = useState<any>(null);
    const [pendingAcceptSkip, setPendingAcceptSkip] = useState(false);
    const [followUp, setFollowUp]               = useState<any>(null);
    const [followUpText, setFollowUpText]       = useState('');
    const [followUpUploading, setFollowUpUploading] = useState(false);
    const [slotIdx, setSlotIdx]                 = useState(0);
    const [followUpSkipping, setFollowUpSkipping]   = useState(false);
    const [skipOpen, setSkipOpen]               = useState(false);
    const [completionMsg, setCompletionMsg]     = useState<string | null>(null);
    const [completionOpts, setCompletionOpts]   = useState<{ text?: string; photoUrl?: string; quizResult?: { correct: number; total: number; dayChange: number } }>({});

    // ── Refs ──
    const simonWaitRef  = useRef<ReturnType<typeof setInterval>|null>(null);
    const simonTaskRef  = useRef<ReturnType<typeof setInterval>|null>(null);
    const simonReadyRef = useRef<ReturnType<typeof setInterval>|null>(null);
    const slotIdxRef    = useRef(0);
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
                if (g.wheelResult)    { setWheelResult(g.wheelResult); setMechDone(true); setMechStarted(true); }
                if (g.diceResult)     { setDiceResult(g.diceResult); setMechDone(true); setMechStarted(true); }
                if (g.coinResult)     { setCoinResult(g.coinResult); setMechDone(true); setMechStarted(true); }
                if (g.cardResult)     { setCardResult(g.cardResult); setCardPhase('done'); setMechDone(true); setMechStarted(true); }
                if (g.rouletteResult) { setRouletteResult(g.rouletteResult); setMechDone(true); setMechStarted(true); }
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
                                setSimonReadySecs(60);
                                setSimonPhase('ready');
                            }
                        } else { setSimonWaitUntil(s.waitUntil); setSimonPhase('waiting'); }
                    } else if (s.phase === 'ready' && s.currentTask) {
                        setSimonCurrentTask(s.currentTask);
                        setSimonReadySecs(s.readySecs ?? 60);
                        setSimonPhase('ready');
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
                setSimonTaskLimit(task.timeLimit || 30);
                setSimonReadySecs(60);
                setSimonPhase('ready');
                try { localStorage.setItem('ss_state', JSON.stringify({ phase: 'ready', currentTask: task, step: simonStep, proofs: simonProofs, lastTask: task, readySecs: 60 })); } catch {}
            }
        }, 1000);
        return () => { if (simonWaitRef.current) { clearInterval(simonWaitRef.current); simonWaitRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [simonPhase, simonWaitUntil]);

    // ── Simon Says: 1-minute get-ready countdown ──
    useEffect(() => {
        if (simonPhase !== 'ready') {
            if (simonReadyRef.current) { clearInterval(simonReadyRef.current); simonReadyRef.current = null; }
            return;
        }
        simonReadyRef.current = setInterval(() => {
            setSimonReadySecs(prev => {
                if (prev <= 1) {
                    clearInterval(simonReadyRef.current!); simonReadyRef.current = null;
                    setSimonTaskSecs(simonCurrentTask?.timeLimit || 30);
                    setSimonPhase('task');
                    try { localStorage.setItem('ss_state', JSON.stringify({ phase: 'task', currentTask: simonCurrentTask, step: simonStep, proofs: simonProofs, lastTask: simonCurrentTask })); } catch {}
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => { if (simonReadyRef.current) { clearInterval(simonReadyRef.current); simonReadyRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [simonPhase]);

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

    const showCompletion = (opts: { text?: string; photoUrl?: string; quizResult?: { correct: number; total: number; dayChange: number } }) => {
        // Instantly resolved: quiz scores, payments, game outcomes, self-reports (short text, no photo upload)
        // Pending review: anything with a photo upload or a long written submission
        const wordCount = opts.text ? opts.text.trim().split(/\s+/).filter(Boolean).length : 0;
        const isPending = !!opts.photoUrl || (!opts.quizResult && wordCount >= 15);
        const pool = isPending ? MSGS_PENDING : MSGS_DONE;
        setCompletionOpts(opts);
        setCompletionMsg(pool[Math.floor(Math.random() * pool.length)]);
    };

    const submitTask = useCallback(async (opts: { text?: string; photoUrl?: string }) => {
        if (previewMode) { showCompletion(opts); return; }
        try {
            const resp = await fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'submit_task', memberId: mid, orderType: o.type, text: opts.text || null, photoUrl: opts.photoUrl || null, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
            });
            const result = await resp.json();
            if (!resp.ok) alert('Submit failed: ' + (result.error || 'unknown error'));
            else showCompletion(opts);
        } catch (e: any) { alert('Submit failed: ' + e?.message); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [previewMode, mid, o.type]);

    const submitFollowUp = useCallback(async (opts: { text?: string; photoUrl?: string }) => {
        if (previewMode) { setFollowUp(null); setFollowUpText(''); setFollowUpSkipping(false); showCompletion(opts); return; }
        try {
            const resp = await fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'submit_task', memberId: mid, orderType: followUp?.orderType || o.type, text: opts.text || null, photoUrl: opts.photoUrl || null, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
            });
            const result = await resp.json();
            if (!resp.ok) alert('Submit failed: ' + (result.error || 'unknown error'));
            else { setFollowUp(null); setFollowUpText(''); try { localStorage.removeItem('vault_gamble_results'); localStorage.removeItem('vault_followup'); } catch {} showCompletion(opts); }
        } catch (e: any) { alert('Submit failed: ' + e?.message); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [previewMode, mid, o.type, followUp]);

    // Auto follow-up: add/remove coins or days — applied immediately, no proof needed
    const submitAutoFollowUp = useCallback(async () => {
        const fu = followUp;
        const summaryText = fu?.type === 'add_coins'    ? `+${fu.amount || 50} coins awarded`
                          : fu?.type === 'remove_coins' ? `−${fu.amount || 50} coins deducted`
                          : fu?.type === 'add_day'      ? `+${fu.amount || 1} day${(fu.amount || 1) !== 1 ? 's' : ''} added`
                          : fu?.type === 'remove_day'   ? `−${fu.amount || 1} day${(fu.amount || 1) !== 1 ? 's' : ''} removed`
                          :                               `+${fu.amount || 1} skip pass${(fu.amount || 1) !== 1 ? 'es' : ''} awarded`;
        if (previewMode) {
            setFollowUp(null); setFollowUpText(''); setFollowUpSkipping(false);
            try { localStorage.removeItem('vault_gamble_results'); localStorage.removeItem('vault_followup'); } catch {}
            showCompletion({ text: summaryText });
            return;
        }
        try {
            const resp = await fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'apply_followup', memberId: mid, orderType: fu?.orderType || o.type, followUpType: fu?.type, amount: fu?.amount, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
            });
            const result = await resp.json();
            if (!resp.ok) alert('Apply failed: ' + (result.error || 'unknown error'));
            else {
                setFollowUp(null); setFollowUpText('');
                try { localStorage.removeItem('vault_gamble_results'); localStorage.removeItem('vault_followup'); } catch {}
                showCompletion({ text: summaryText });
            }
        } catch (e: any) { alert('Apply failed: ' + e?.message); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [previewMode, mid, o.type, followUp]);

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
            {/* ── START SCREEN — shown in card before game begins, standardised for all mechanisms ── */}
            {!mechStarted && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '16px 0 8px' }}>
                    <div style={{ fontSize: '2.4rem', marginBottom: 16 }}>{meta.icon}</div>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: 'rgba(255,255,255,0.78)', letterSpacing: '2px', marginBottom: 32 }}>{label}</div>
                    <button className="coin-flip-btn" style={{ width: '100%' }} onClick={() => setMechStarted(true)}>
                        <span>START</span>
                    </button>
                </div>
            )}

            {/* ── GAME OVERLAY — always visible while mechStarted; higher-z overlays fade in on top ── */}
            {mechStarted && typeof document !== 'undefined' && createPortal(
                <GameShell title={label} onClose={() => setMechStarted(false)} zIndex={9990}
                    footer={!['spin','trial','tribute','silence','simon_says'].includes(o.type) && !isInteractive ? (
                        <button onClick={() => setSkipOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Cinzel, serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.15)', letterSpacing: '3px', padding: '10px', textAlign: 'center', width: '100%' }}>SKIP THIS TASK</button>
                    ) : undefined}
                >

            {/* ── TASK DESCRIPTION — hidden for interactive mechanisms that show outcomes inline ── */}
            {!isInteractive && (
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.8, marginBottom: 22, padding: '14px 16px', background: 'rgba(0,0,0,0.25)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                    {o.config?.instruction || o.config?.prompt || o.config?.question
                        || (o.type === 'multi_video' && o.config?.target ? `Record ${o.config.target} clips as instructed.` : null)
                        || meta.desc || 'Complete this task as ordered.'}
                </div>
            )}
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
                                    showCompletion({ text: trialText });
                                }} className="coin-flip-btn" style={{ padding: '12px 28px' }}><span>SUBMIT</span></button>
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
                            setQuizDone(true);
                            if (!previewMode && mid) {
                                fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ action: 'quiz_grade', memberId: mid, orderType: o.type, correct, total, answers: newAnswers, questions: qs, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
                                }).catch(() => {});
                            }
                            showCompletion({ text: `Quiz: ${correct}/${total} correct`, quizResult: { correct, total, dayChange } });
                        }
                    }, 1500);
                };

                const timedOut = quizTimeLeft === 0 && quizAnswers.length < qs.length && quizReveal === null;
                if (timedOut) { setTimeout(() => pickAnswer(-1), 0); return null; }

                // All done — completion overlay is showing on top
                if (quizDone && quizReveal === null) return null;

                // ── INTRO: shown before the timer starts ──
                if (quizTimeLeft === null && quizAnswers.length === 0 && quizReveal === null) {
                    return (
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.32rem', color: 'rgba(197,160,89,0.4)', letterSpacing: '6px', marginBottom: 14 }}>QUIZ</div>
                            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.25rem', color: 'rgba(255,255,255,0.88)', lineHeight: 1.5, marginBottom: 8 }}>
                                {rawCfg.topic || label}
                            </div>
                            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.22)', letterSpacing: '2px', marginBottom: 32 }}>
                                {qs.length} question{qs.length !== 1 ? 's' : ''} · {tl}s per question · timed
                            </div>

                            {/* Stakes */}
                            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 36, borderTop: '1px solid rgba(197,160,89,0.08)', borderBottom: '1px solid rgba(197,160,89,0.08)' }}>
                                {[
                                    { label: 'All correct', value: '-1 day', dim: false },
                                    { label: 'Mixed',       value: 'Mediocre', dim: true },
                                    { label: 'All wrong',   value: '500 coins', dim: false },
                                ].map(({ label: l, value, dim }, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 4px', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                                        <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.8rem', color: dim ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.4)' }}>{l}</span>
                                        <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.58rem', color: dim ? 'rgba(255,255,255,0.18)' : 'rgba(197,160,89,0.65)', letterSpacing: '3px' }}>{value}</span>
                                    </div>
                                ))}
                            </div>

                            <button onClick={() => startTimer(tl)} className="coin-flip-btn" style={{ width: '100%' }}>
                                <span>I'M READY</span>
                            </button>
                        </div>
                    );
                }

                // ── ACTIVE: question + answers + countdown bar at bottom ──
                return (
                    <div style={{ padding: '4px 0' }}>
                        {/* Header row: step counter + live seconds */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                            <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.22)', letterSpacing: 3 }}>QUESTION {quizStep + 1} / {qs.length}</span>
                            {quizTimeLeft !== null && <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.75rem', color: quizTimeLeft < 10 ? 'rgba(255,60,60,0.6)' : 'rgba(255,255,255,0.25)', letterSpacing: 2 }}>{quizTimeLeft}s</span>}
                        </div>

                        {/* Question */}
                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.75, marginBottom: 18, textAlign: 'center' }}>{curQ?.question || 'No question set.'}</div>

                        {/* Answers */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                            {(curQ?.answers || []).map((opt: string, ai: number) => {
                                const isCorrect = ai === curQ.correctIdx;
                                const isPicked = quizReveal === ai;
                                const revealing = quizReveal !== null;
                                const bg = revealing ? (isCorrect ? 'rgba(80,200,120,0.12)' : isPicked ? 'rgba(255,60,60,0.1)' : 'rgba(255,255,255,0.02)') : 'rgba(255,255,255,0.03)';
                                const border = revealing ? (isCorrect ? '1px solid rgba(80,200,120,0.5)' : isPicked ? '1px solid rgba(255,60,60,0.4)' : '1px solid rgba(255,255,255,0.06)') : '1px solid rgba(197,160,89,0.12)';
                                const color = revealing ? (isCorrect ? 'rgba(80,200,120,0.9)' : isPicked ? 'rgba(255,80,80,0.7)' : 'rgba(255,255,255,0.25)') : 'rgba(255,255,255,0.6)';
                                return (
                                    <button key={ai} onClick={() => !revealing && pickAnswer(ai)} style={{ textAlign: 'left', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, background: bg, border, borderRadius: 8, cursor: revealing ? 'default' : 'pointer', fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color, transition: 'all 0.25s' }}>
                                        <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.75rem', color: revealing && isCorrect ? 'rgba(80,200,120,0.8)' : revealing && isPicked ? 'rgba(255,80,80,0.6)' : 'rgba(197,160,89,0.5)', width: 20, flexShrink: 0 }}>
                                            {revealing && isCorrect ? '✓' : revealing && isPicked && !isCorrect ? '✗' : String.fromCharCode(65 + ai)}
                                        </span>
                                        {opt}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Countdown bar — pinned below answers */}
                        {quizTimeLeft !== null && (
                            <div style={{ width: '100%', height: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${(quizTimeLeft / tl) * 100}%`, background: quizTimeLeft < 10 ? 'rgba(255,40,40,0.5)' : `${R}0.4)`, transition: 'width 1s linear', borderRadius: 2 }} />
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
                                    if (count > 15) { clearInterval(iv); setDiceRolling(false); setMechDone(true); saveGambleResult({ diceResult: val }, 'dice_roll'); const oc = diceOutcomes[val - 1]; const ft = oc?.followUpType || 'instant'; setPendingAccept({ orderType: o.type, source: `Dice Roll — ${val}`, resultText: oc?.text || `Face ${val}`, type: ft, prompt: oc?.followUpPrompt, instruction: oc?.followUpInstruction, duration: oc?.followUpDuration, target: oc?.followUpTarget, amount: oc?.followUpAmount }); }
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
                const isHeads = coinResult === 'heads';
                const isTails = coinResult === 'tails';
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: '8px 0 4px' }}>

                        {/* ── Coin ── */}
                        <div style={{
                            width: 136, height: 136, borderRadius: '50%',
                            background: coinResult
                                ? (isHeads ? 'radial-gradient(circle at 35% 35%, rgba(230,195,110,0.18), rgba(197,160,89,0.07))' : 'radial-gradient(circle at 35% 35%, rgba(255,80,80,0.12), rgba(139,0,0,0.06))')
                                : 'radial-gradient(circle at 35% 35%, rgba(197,160,89,0.1), rgba(10,8,18,0.6))',
                            border: `2px solid ${coinResult ? (isHeads ? 'rgba(197,160,89,0.7)' : 'rgba(200,60,60,0.55)') : 'rgba(197,160,89,0.22)'}`,
                            boxShadow: coinResult
                                ? (isHeads ? '0 0 40px rgba(197,160,89,0.18), inset 0 0 30px rgba(197,160,89,0.06)' : '0 0 40px rgba(200,60,60,0.15), inset 0 0 30px rgba(139,0,0,0.08)')
                                : '0 0 20px rgba(197,160,89,0.06), inset 0 0 20px rgba(0,0,0,0.4)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                            animation: coinFlipping ? 'vPulse 0.1s linear infinite' : 'none',
                            transition: 'all 0.4s ease',
                        }}>
                            <span style={{ fontFamily: 'Cinzel, serif', fontSize: coinResult ? '1.1rem' : '2.4rem', color: coinResult ? (isHeads ? 'rgba(197,160,89,0.95)' : 'rgba(220,80,80,0.9)') : 'rgba(197,160,89,0.35)', fontWeight: 700, letterSpacing: coinResult ? 3 : 0, transition: 'all 0.3s' }}>
                                {coinResult ? coinResult.toUpperCase() : '♛'}
                            </span>
                            {!coinResult && <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.28rem', color: 'rgba(197,160,89,0.2)', letterSpacing: 3 }}>FATE</span>}
                        </div>

                        {/* ── Outcome cards — always visible ── */}
                        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                            {([['heads', headsTask, 'rgba(197,160,89,', 'HEADS'] , ['tails', tailsTask, 'rgba(200,60,60,', 'TAILS']] as const).map(([side, text, col, label]) => {
                                const active = coinResult === side;
                                const dimmed = !!coinResult && !active;
                                return (
                                    <div key={side} style={{
                                        flex: 1, padding: '14px 12px', borderRadius: 10, textAlign: 'center',
                                        background: active ? `${col}0.08)` : 'rgba(255,255,255,0.02)',
                                        border: `1px solid ${active ? `${col}0.35)` : 'rgba(255,255,255,0.06)'}`,
                                        opacity: dimmed ? 0.3 : 1, transition: 'all 0.35s',
                                    }}>
                                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.3rem', color: active ? `${col}0.7)` : 'rgba(255,255,255,0.22)', letterSpacing: 4, marginBottom: 8 }}>{label}</div>
                                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.72rem', color: active ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.35)', lineHeight: 1.55 }}>{text}</div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* ── Button ── */}
                        {!coinResult || coinFlipping ? (
                            <button disabled={coinFlipping} style={{ marginTop: 12, width: '80%' }} onClick={() => {
                                setCoinFlipping(true); setCoinResult(null); let count = 0;
                                const iv = setInterval(() => {
                                    const val = Math.random() > 0.5 ? 'heads' : 'tails';
                                    setCoinResult(val); count++;
                                    if (count > 12) { clearInterval(iv); setCoinFlipping(false); setMechDone(true); saveGambleResult({ coinResult: val }, 'coinflip'); const tt = val === 'heads' ? headsTask : tailsTask; const lo2 = tt.toLowerCase(); const configType = val === 'heads' ? o.config?.headsFollowUpType : o.config?.tailsFollowUpType; const configAmount = val === 'heads' ? o.config?.headsFollowUpAmount : o.config?.tailsFollowUpAmount; const it = configType || (/proof|video|selfie|photo|picture|body writing/.test(lo2) ? 'photo' : /write|essay|confession|journal|list|lines|letter|words|grateful/.test(lo2) ? 'writing' : /shower|plank|hold|sit|pushup|squat|burpee|exercise|camera|edge|ice/.test(lo2) ? 'endurance' : 'instant'); setPendingAccept({ orderType: o.type, source: `Coinflip — ${val.toUpperCase()}`, resultText: tt, type: it, amount: configAmount }); }
                                }, 120);
                            }} className="coin-flip-btn">
                                <span>{coinFlipping ? 'Flipping...' : 'Flip the Coin'}</span>
                            </button>
                        ) : (
                            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.55rem', color: 'rgba(255,255,255,0.15)', letterSpacing: '5px', animation: 'vPulse 1s ease infinite' }}>YOUR FATE IS SEALED</div>
                        )}
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
                const isOdd = configCards.length % 2 !== 0;
                return (
                    <div style={{ textAlign: 'center', padding: '6px 0 8px' }}>

                        {/* ── Phase 1: Reveal — show all cards face-up ── */}
                        {cardPhase === 'reveal' && (
                            <>
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.3rem', color: 'rgba(197,160,89,0.38)', letterSpacing: '5px', marginBottom: 18 }}>WHAT FATE AWAITS YOU</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
                                    {configCards.map((card: any, i: number) => (
                                        <div key={i} style={{
                                            padding: '14px 10px 12px',
                                            background: 'rgba(139,0,0,0.07)',
                                            border: '1px solid rgba(139,0,0,0.22)',
                                            borderRadius: 10,
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                                            gridColumn: isOdd && i === configCards.length - 1 ? 'span 2' : undefined,
                                        }}>
                                            <span style={{ fontSize: '1.1rem', color: `${R}0.45)` }}>♠</span>
                                            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.68rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.55 }}>{card.text}</div>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={() => {
                                    shuffledCardsRef.current = [...configCards].sort(() => Math.random() - 0.5);
                                    setCardPhase('shuffling');
                                    setTimeout(() => setCardPhase('pick'), 1400);
                                }} style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.3rem', letterSpacing: '4px', color: 'rgba(197,160,89,0.75)', background: 'rgba(197,160,89,0.07)', border: '1px solid rgba(197,160,89,0.22)', borderRadius: 8, padding: '12px 28px', cursor: 'pointer' }}>
                                    SHUFFLE
                                </button>
                            </>
                        )}

                        {/* ── Phase 2: Shuffling ── */}
                        {cardPhase === 'shuffling' && (
                            <div style={{ padding: '32px 0 28px' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
                                    {configCards.map((_: any, i: number) => (
                                        <div key={i} style={{
                                            width: 64, height: 96, borderRadius: 9,
                                            background: `${R}0.1)`,
                                            border: `1.5px solid ${R}0.28)`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            animation: `vPulse 0.${3 + (i % 3)}s ease ${i * 0.08}s infinite`,
                                        }}>
                                            <span style={{ fontSize: '1.6rem', color: `${R}0.35)` }}>♠</span>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.3rem', color: 'rgba(197,160,89,0.3)', letterSpacing: '5px', animation: 'vPulse 0.5s ease infinite' }}>SHUFFLING...</div>
                            </div>
                        )}

                        {/* ── Phase 3: Pick ── */}
                        {cardPhase === 'pick' && (
                            <>
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.3rem', color: 'rgba(197,160,89,0.38)', letterSpacing: '5px', marginBottom: 24 }}>CHOOSE YOUR FATE</div>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
                                    {(shuffledCardsRef.current.length ? shuffledCardsRef.current : configCards).map((card: any, i: number) => (
                                        <button key={i} disabled={cardPicking} onClick={() => {
                                            setCardPicking(true);
                                            setTimeout(() => {
                                                setCardResult(card);
                                                setCardPhase('done');
                                                setCardPicking(false);
                                                setMechDone(true);
                                                saveGambleResult({ cardResult: card }, 'card_pick');
                                                const cft = card?.followUpType || 'instant';
                                                setPendingAccept({ orderType: o.type, source: 'Card Draw', resultText: card?.text || card, type: cft, prompt: card?.followUpPrompt, instruction: card?.followUpInstruction, duration: card?.followUpDuration, target: card?.followUpTarget, amount: card?.followUpAmount });
                                            }, 600);
                                        }} style={{
                                            width: 76, height: 112,
                                            background: cardPicking ? 'rgba(197,160,89,0.06)' : `${R}0.08)`,
                                            border: `1.5px solid ${cardPicking ? 'rgba(197,160,89,0.15)' : `${R}0.28)`}`,
                                            borderRadius: 10, cursor: cardPicking ? 'default' : 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            transition: 'all 0.2s',
                                            animation: cardPicking ? 'vPulse 0.3s ease infinite' : 'none',
                                            boxShadow: `0 4px 18px ${R}0.12)`,
                                        }}>
                                            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '2.2rem', color: `${R}0.32)` }}>♠</span>
                                        </button>
                                    ))}
                                </div>
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.78rem', color: 'rgba(255,255,255,0.2)', letterSpacing: 2 }}>TAP TO REVEAL YOUR FATE</div>
                            </>
                        )}

                        {/* ── Phase 4: Done ── */}
                        {cardPhase === 'done' && cardResult && (
                            <>
                                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'rgba(197,160,89,0.82)', lineHeight: 1.6, margin: '16px 0 20px', padding: '18px 20px', background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 10 }}>{cardResult?.text || cardResult}</div>
                                {mechDone && <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.55rem', color: 'rgba(255,255,255,0.15)', letterSpacing: '4px', animation: 'vPulse 1s ease infinite', textAlign: 'center' }}>YOUR FATE IS SEALED</div>}
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
                                const rinf = rBang ? (/proof|video|selfie|photo|picture|body writing/.test(rlo) ? 'photo' : /write|essay|confession|journal|list|lines|letter|words|grateful/.test(rlo) ? 'writing' : /shower|plank|hold|sit|pushup|squat|camera|edge|ice/.test(rlo) ? 'endurance' : 'instant') : 'writing';
                                setPendingAccept({ orderType: o.type, source: `Russian Roulette — ${rBang ? 'BANG' : 'SURVIVED'}`, resultText: rBang ? rpt : 'You survived. Describe the fear you felt.', type: rinf });
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
                const slotDelay = (step: number, total: number) => {
                    const p = step / total;
                    if (p < 0.4) return 55;
                    if (p < 0.7) return 55 + Math.floor((p - 0.4) / 0.3 * 160);
                    return 215 + Math.floor((p - 0.7) / 0.3 * 700);
                };
                const ROW = 72;   // px per dim row
                const MID = 88;   // px for highlighted middle row
                const DRUM = ROW * 2 + MID;
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
                        {/* ── Slot drum — each row its own width ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                            {/* top row — dim, narrower box */}
                            <div style={{ width: '68%', height: ROW, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 14px', opacity: 0.22, border: '1px solid rgba(255,255,255,0.06)', borderBottom: 'none', borderRadius: '10px 10px 0 0' }}>
                                <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.9)', textAlign: 'center', lineHeight: 1.4 }}>{segments[(slotIdx - 1 + segments.length) % segments.length]?.text}</span>
                            </div>
                            {/* middle row — full width, selected */}
                            <div style={{ width: '100%', height: MID, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px', background: wheelResult ? 'rgba(197,160,89,0.08)' : wheelSpinning ? 'rgba(197,160,89,0.03)' : 'rgba(255,255,255,0.015)', border: `1px solid rgba(197,160,89,${wheelResult ? '0.4' : '0.18'})`, borderRadius: 10, transition: 'all 0.3s' }}>
                                <span style={{ fontFamily: 'Cinzel, serif', fontSize: '1.05rem', color: wheelResult ? 'rgba(197,160,89,0.95)' : 'rgba(255,255,255,0.72)', textAlign: 'center', lineHeight: 1.45, fontWeight: wheelResult ? 600 : 400, transition: 'color 0.3s' }}>{segments[slotIdx % segments.length]?.text || '—'}</span>
                            </div>
                            {/* bottom row — dim, narrower box */}
                            <div style={{ width: '68%', height: ROW, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 14px', opacity: 0.22, border: '1px solid rgba(255,255,255,0.06)', borderTop: 'none', borderRadius: '0 0 10px 10px' }}>
                                <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.9)', textAlign: 'center', lineHeight: 1.4 }}>{segments[(slotIdx + 1) % segments.length]?.text}</span>
                            </div>
                        </div>

                        {/* ── Button ── */}
                        {!wheelResult ? (
                            <button disabled={wheelSpinning} className="coin-flip-btn" style={{ width: '100%' }} onClick={() => {
                                if (segments.length === 0) return;
                                setWheelSpinning(true);
                                const finalIdx = Math.floor(Math.random() * segments.length);
                                const totalSteps = 28 + Math.floor(Math.random() * 8);
                                let step = 0;
                                const runStep = () => {
                                    step++;
                                    const idx = step < totalSteps ? Math.floor(Math.random() * segments.length) : finalIdx;
                                    slotIdxRef.current = idx; setSlotIdx(idx);
                                    if (step >= totalSteps) {
                                        setWheelSpinning(false);
                                        const finalSeg = segments[finalIdx];
                                        setWheelResult(finalSeg); setMechDone(true);
                                        saveGambleResult({ wheelResult: finalSeg }, 'spin_wheel');
                                        const wft = finalSeg.followUpType || 'instant';
                                        setPendingAccept({ orderType: o.type, source: 'Spin Wheel', resultText: finalSeg.text, type: wft, prompt: finalSeg.followUpPrompt, instruction: finalSeg.followUpInstruction, duration: finalSeg.followUpDuration, target: finalSeg.followUpTarget, amount: finalSeg.followUpAmount });
                                    } else {
                                        setTimeout(runStep, slotDelay(step, totalSteps));
                                    }
                                };
                                setTimeout(runStep, slotDelay(0, totalSteps));
                            }}>
                                <span>{wheelSpinning ? 'SPINNING...' : 'SPIN'}</span>
                            </button>
                        ) : (
                            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.55rem', color: 'rgba(255,255,255,0.15)', letterSpacing: '5px', animation: 'vPulse 1s ease infinite' }}>YOUR FATE IS SEALED</div>
                        )}
                    </div>
                );
            })()}

            {/* ── TRUTH OR DARE ── */}
            {o.type === 'truth_dare' && (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                    {!truthDareChoice ? (
                        <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                            <button onClick={() => { setTruthDareChoice('truth'); saveGambleResult({ truthDareChoice: 'truth' }, 'truth_dare'); const tText = o.config?.truthText || 'Confess your deepest weakness to Queen Karin — at least 150 words'; const tFu = o.config?.truthFollowUp || 'writing'; setPendingAccept({ orderType: o.type, source: 'Truth or Dare (truth)', resultText: tText, type: tFu }); }}
                                style={{ flex: 1, maxWidth: 160, padding: '20px 16px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', letterSpacing: '3px', color: 'rgba(197,160,89,0.8)', background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.2)', borderRadius: 8, cursor: 'pointer' }}>TRUTH</button>
                            <button onClick={() => { setTruthDareChoice('dare'); saveGambleResult({ truthDareChoice: 'dare' }, 'truth_dare'); const dText = o.config?.dareText || 'Take a cold shower for 60 seconds — upload photo proof'; const dFu = o.config?.dareFollowUp || 'endurance'; setPendingAccept({ orderType: o.type, source: 'Truth or Dare (dare)', resultText: dText, type: dFu }); }}
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
                                    <button className="coin-flip-btn" style={{ width: '100%', animation: 'vFadeIn 0.3s ease' }}
                                        onClick={() => submitTask({ text: `Greed game: ${greedBusted ? 'BUSTED - 0 coins' : `Cashed out ${greedCoins} coins`}` })}>
                                        <span>SUBMIT RESULT</span>
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                );
            })()}

            {/* ── SIMON SAYS ── */}
            {o.type === 'simon_says' && (() => {
                const chain: { text: string; timeLimit: number; proofType?: 'photo'|'video' }[] = o.config?.chainTasks || [];
                const intervalMinutes = o.config?.intervalMinutes || 60;

                // ── IDLE: intro screen ──
                if (simonPhase === 'idle') return (
                    <div style={{ textAlign: 'center', padding: '8px 0 4px', animation: 'vFadeIn 0.4s ease' }}>
                        {chain.length === 0 ? (
                            <>
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.48rem', color: 'rgba(197,160,89,0.4)', letterSpacing: '6px', marginBottom: 20 }}>⚡ SIMON SAYS</div>
                                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginBottom: 28 }}>No commands were issued.</div>
                                <button onClick={() => submitTask({})} style={{ width: '100%', padding: '16px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '3px', color: '#080810', background: 'rgba(197,160,89,0.7)', border: 'none', borderRadius: 8, cursor: 'pointer' }}>MARK COMPLETE</button>
                            </>
                        ) : (
                            <>
                                {/* header */}
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.48rem', color: `${R}0.5)`, letterSpacing: '6px', marginBottom: 20 }}>⚡ SIMON SAYS</div>

                                {/* warning card */}
                                <div style={{ background: `${R}0.04)`, border: `1px solid ${R}0.18)`, borderRadius: 12, padding: '22px 18px', marginBottom: 20, textAlign: 'left' }}>
                                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.38rem', color: `${R}0.45)`, letterSpacing: '5px', marginBottom: 14 }}>BEFORE YOU START</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: `${R}0.6)`, flexShrink: 0, marginTop: 5 }} />
                                            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                                                Queen Karin will test you <strong style={{ color: 'rgba(255,255,255,0.9)' }}>{chain.length} {chain.length === 1 ? 'time' : 'times'}</strong> over the next few hours.
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: `${R}0.6)`, flexShrink: 0, marginTop: 5 }} />
                                            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                                                You will <strong style={{ color: 'rgba(255,255,255,0.9)' }}>not be warned</strong> when a task is coming.
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(197,160,89,0.7)', flexShrink: 0, marginTop: 5 }} />
                                            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                                                Once a task drops, you have <strong style={{ color: '#c5a059' }}>1 minute</strong> to get ready and begin.
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button onClick={() => {
                                    const waitMs = Math.floor(Math.random() * intervalMinutes * 60 * 1000) + 60000;
                                    const waitUntil = Date.now() + waitMs;
                                    setSimonWaitUntil(waitUntil); setSimonStep(0); setSimonProofs([]); setSimonLastTask(null); setSimonPhase('waiting');
                                    try { localStorage.setItem('ss_state', JSON.stringify({ phase: 'waiting', step: 0, waitUntil, proofs: [], lastTask: null })); } catch {}
                                }} style={{ width: '100%', padding: '17px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '4px', color: '#080810', background: 'rgba(197,160,89,0.85)', border: 'none', borderRadius: 10, cursor: 'pointer', marginBottom: 10 }}>I UNDERSTAND</button>
                                {onClose && <button onClick={onClose} style={{ width: '100%', padding: '13px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.6rem', letterSpacing: '3px', color: 'rgba(255,255,255,0.15)', background: 'transparent', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, cursor: 'pointer' }}>CLOSE</button>}
                            </>
                        )}
                    </div>
                );

                // ── WAITING: stay alerted ──
                if (simonPhase === 'waiting') return (
                    <div style={{ textAlign: 'center', padding: '20px 0 8px', animation: 'vFadeIn 0.6s ease' }}>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.4rem', color: 'rgba(197,160,89,0.3)', letterSpacing: '8px', marginBottom: 28 }}>STAY ALERTED</div>
                        <div style={{ width: 14, height: 14, borderRadius: '50%', background: `${R}0.8)`, margin: '0 auto 28px', animation: 'vPulse 1.8s ease infinite', boxShadow: `0 0 20px ${R}0.35)` }} />
                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: 'rgba(255,255,255,0.45)', letterSpacing: '6px', marginBottom: 8 }}>Queen Karin</div>
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '2px', marginBottom: 32 }}>is watching. Your task will arrive.</div>

                        {/* completed thumbnails */}
                        {simonProofs.length > 0 && (
                            <div style={{ marginBottom: 24 }}>
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.35rem', color: 'rgba(197,160,89,0.3)', letterSpacing: '4px', marginBottom: 12 }}>{simonProofs.length} OF {chain.length} COMPLETED</div>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    {simonProofs.map((url, i) => (
                                        <div key={i} style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(197,160,89,0.25)', flexShrink: 0 }}>
                                            <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                                        </div>
                                    ))}
                                    {Array.from({ length: chain.length - simonProofs.length }).map((_, i) => (
                                        <div key={`empty-${i}`} style={{ width: 52, height: 52, borderRadius: 8, border: `1px dashed ${R}0.15)`, background: `${R}0.03)`, flexShrink: 0 }} />
                                    ))}
                                </div>
                            </div>
                        )}

                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.35rem', color: 'rgba(255,255,255,0.07)', letterSpacing: '3px' }}>TASK {simonStep + 1} / {chain.length}</div>
                    </div>
                );

                // ── READY: 1-minute get-ready countdown ──
                if (simonPhase === 'ready') return (
                    <div style={{ textAlign: 'center', padding: '20px 0 8px', animation: 'vFadeIn 0.35s ease' }}>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.4rem', color: `${R}0.6)`, letterSpacing: '8px', marginBottom: 28 }}>⚡ TASK INCOMING</div>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '3.2rem', fontWeight: 900, color: simonReadySecs <= 15 ? 'rgba(255,60,60,0.9)' : 'rgba(255,255,255,0.85)', letterSpacing: 2, lineHeight: 1, marginBottom: 8, transition: 'color 0.4s' }}>{simonReadySecs}</div>
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '4px', marginBottom: 28 }}>SECONDS TO GET READY</div>
                        <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden', marginBottom: 32 }}>
                            <div style={{ height: '100%', width: `${(simonReadySecs / 60) * 100}%`, background: simonReadySecs <= 15 ? 'rgba(255,60,60,0.7)' : `${R}0.6)`, borderRadius: 2, transition: 'width 0.9s linear, background 0.4s' }} />
                        </div>
                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.78rem', color: 'rgba(255,255,255,0.22)', lineHeight: 1.6 }}>Your task will begin automatically.<br />Be ready.</div>
                        <div style={{ marginTop: 24, fontFamily: 'Orbitron, sans-serif', fontSize: '0.35rem', color: 'rgba(255,255,255,0.07)', letterSpacing: '3px' }}>TASK {simonStep + 1} / {chain.length}</div>
                    </div>
                );

                // ── TASK ──
                if (simonPhase === 'task' && simonCurrentTask) {
                    const proofType = simonCurrentTask.proofType || 'photo';
                    const isVideo = proofType === 'video';
                    return (
                        <div style={{ animation: 'vFadeIn 0.4s ease' }}>
                            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.52rem', color: `${R}0.65)`, letterSpacing: '7px', marginBottom: 14, textAlign: 'center' }}>⚡ SIMON SAYS</div>
                            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'rgba(255,255,255,0.88)', lineHeight: 1.75, marginBottom: 18, padding: '18px 16px', background: `${R}0.06)`, border: `1px solid ${R}0.2)`, borderRadius: 10, textAlign: 'center' }}>{simonCurrentTask.text}</div>
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ height: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${simonTaskLimit > 0 ? (simonTaskSecs / simonTaskLimit) * 100 : 100}%`, background: simonTaskSecs <= Math.ceil(simonTaskLimit * 0.2) ? 'rgba(255,50,50,0.7)' : `${R}0.55)`, borderRadius: 2, transition: 'width 0.9s linear, background 0.4s' }} />
                                </div>
                            </div>
                            <label style={{ cursor: simonUploading ? 'default' : 'pointer', display: 'block' }}>
                                <div style={{ padding: '18px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '3px', color: simonUploading ? 'rgba(255,255,255,0.12)' : '#c5a059', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(197,160,89,0.3)', borderRadius: 10, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 0 15px rgba(197,160,89,0.08)' }}>
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                    {simonUploading ? 'UPLOADING...' : isVideo ? 'RECORD VIDEO PROOF' : 'UPLOAD PHOTO PROOF'}
                                </div>
                                <input type="file" accept={isVideo ? 'video/*' : 'image/*'} capture="environment" style={{ display: 'none' }} onChange={async (e) => {
                                    const file = e.target.files?.[0]; if (!file) return; e.target.value = '';
                                    if (previewMode) {
                                        const nextStep = simonStep + 1;
                                        if (nextStep >= chain.length) { setSimonPhase('complete'); try { localStorage.removeItem('ss_state'); } catch {} }
                                        else { setSimonStep(nextStep); const waitUntil = Date.now() + 5000; setSimonWaitUntil(waitUntil); setSimonPhase('waiting'); }
                                        return;
                                    }
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
                                                const waitMs = Math.floor(Math.random() * intervalMinutes * 60 * 1000) + 60000;
                                                const waitUntil = Date.now() + waitMs;
                                                setSimonWaitUntil(waitUntil); setSimonPhase('waiting');
                                                try { localStorage.setItem('ss_state', JSON.stringify({ phase: 'waiting', step: nextStep, waitUntil, proofs: newProofs, lastTask: simonCurrentTask })); } catch {}
                                            }
                                        }
                                    } catch {} finally { setSimonUploading(false); }
                                }} />
                            </label>
                            <div style={{ marginTop: 12, fontFamily: 'Orbitron, sans-serif', fontSize: '0.38rem', color: 'rgba(255,255,255,0.08)', letterSpacing: '4px', textAlign: 'center' }}>TASK {simonStep + 1} / {chain.length}</div>
                        </div>
                    );
                }

                // ── COMPLETE ──
                if (simonPhase === 'complete') return (
                    <div style={{ textAlign: 'center', padding: '24px 10px 16px', animation: 'vFadeIn 0.8s ease' }}>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.45rem', color: 'rgba(197,160,89,0.4)', letterSpacing: '8px', marginBottom: 24 }}>ALL TASKS COMPLETE</div>
                        {simonProofs.length > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
                                {simonProofs.map((url, i) => (
                                    <div key={i} style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(197,160,89,0.3)' }}>
                                        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                ))}
                            </div>
                        )}
                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 32 }}>Every command obeyed.</div>
                        <button className="coin-flip-btn" style={{ width: '100%' }}
                            onClick={() => { try { localStorage.removeItem('vault_gamble_results'); localStorage.removeItem('ss_state'); } catch {} showCompletion({}); }}>
                            <span>CONTINUE</span>
                        </button>
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
                        <button className="coin-flip-btn" style={{ width: '100%' }}
                            onClick={() => submitTask({ text: `Tribute paid: ${amount} coins` })}>
                            <span>PAY TRIBUTE</span>
                        </button>
                    </div>
                );
            })()}

            {/* ── TEXT WRITING TASKS ── */}
            {isTextTask && (() => {
                const minW = o.config?.minWords || 50;
                const wc = taskText.trim().split(/\s+/).filter(Boolean).length;
                const ok = wc >= minW;
                return (
                    <>
                        <textarea value={taskText} onChange={e => setTaskText(e.target.value)} placeholder="Write here..."
                            style={{ width: '100%', minHeight: 120, background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(197,160,89,${ok ? '0.2' : '0.12'})`, borderRadius: 10, padding: 16, color: 'rgba(255,255,255,0.6)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '16px', lineHeight: 1.7, resize: 'vertical', outline: 'none', transition: 'border-color 0.2s' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 10 }}>
                            <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', color: ok ? 'rgba(197,160,89,0.5)' : 'rgba(255,255,255,0.25)' }}>{wc} / {minW} words</span>
                        </div>
                        <button onClick={() => submitTask({ text: taskText })} disabled={!ok}
                            className="coin-flip-btn" style={{ width: '100%', opacity: ok ? 1 : 0.3 }}>
                            <span>SUBMIT</span>
                        </button>
                    </>
                );
            })()}

            {/* ── PHOTO / VIDEO PROOF TASKS ── */}
            {isPhotoTask && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <label style={{ cursor: 'pointer', display: 'block' }}>
                        <div className="coin-flip-btn" style={{ opacity: taskUploading ? 0.4 : 1 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                {taskUploading ? 'UPLOADING...' : 'SNAP PROOF'}
                            </span>
                        </div>
                        <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={async (e) => {
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
                    <label style={{ cursor: 'pointer', display: 'block' }}>
                        <div className="coin-flip-btn"><span>+ SNAP PHOTO</span></div>
                        <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={async (e) => {
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
                        className="coin-flip-btn" style={{ width: '100%', opacity: taskText.trim() ? 1 : 0.3 }}>
                        <span>SUBMIT</span>
                    </button>
                </div>
            )}

                </GameShell>,
                document.body
            )}

            {/* ══════════════════════════════════════════════
                ACCEPT / SKIP OVERLAY — shown after mechanism reveals a task,
                before committing to the full task overlay.
            ══════════════════════════════════════════════ */}
            {pendingAccept && typeof document !== 'undefined' && createPortal(
                <GameShell title={pendingAccept.source || label} zIndex={9998}
                    footer={!pendingAcceptSkip ? (
                        <>
                            <button className="coin-flip-btn" style={{ width: '100%' }}
                                onClick={() => {
                                    const fu = pendingAccept;
                                    setPendingAccept(null);
                                    setPendingAcceptSkip(false);
                                    setMechDone(false);
                                    setDiceResult(null); setCoinResult(null); setCardResult(null);
                                    setRouletteResult(null); setWheelResult(null); setTruthDareChoice(null);
                                    try { localStorage.removeItem('vault_gamble_results'); } catch {}
                                    setFollowUp(fu);
                                }}>
                                <span>ACCEPT</span>
                            </button>
                            <button onClick={() => setPendingAcceptSkip(true)}
                                style={{ background: 'none', border: 'none', fontFamily: 'Cinzel, serif', fontSize: '0.7rem', letterSpacing: '3px', color: 'rgba(255,255,255,0.15)', cursor: 'pointer', padding: '8px', textAlign: 'center' }}>
                                skip
                            </button>
                        </>
                    ) : (
                        <div style={{ animation: 'vFadeIn 0.25s ease', display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <button className="coin-flip-btn" style={{ width: '100%' }} onClick={async () => {
                                if (previewMode) { setPendingAccept(null); setPendingAcceptSkip(false); setMechDone(false); setWheelResult(null); setDiceResult(null); setCoinResult(null); setCardResult(null); setCardPhase('reveal'); setRouletteResult(null); return; }
                                try {
                                    const res = await fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'skip_order', memberId: mid, orderType: pendingAccept.orderType, useSkipPass: true }) });
                                    const data = await res.json();
                                    if (data.success) { setPendingAccept(null); setPendingAcceptSkip(false); onClose?.(); }
                                } catch {}
                            }}>
                                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                    <span>USE SKIP PASS</span>
                                    <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.65rem', letterSpacing: '3px', color: 'rgba(197,160,89,0.5)' }}>{profile?.skippass ?? 0} LEFT</span>
                                </span>
                            </button>
                            <button className="coin-flip-btn" style={{ width: '100%' }} onClick={async () => {
                                if (previewMode) { setPendingAccept(null); setPendingAcceptSkip(false); setMechDone(false); setWheelResult(null); setDiceResult(null); setCoinResult(null); setCardResult(null); setCardPhase('reveal'); setRouletteResult(null); return; }
                                try {
                                    const res = await fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'skip_order', memberId: mid, orderType: pendingAccept.orderType, useSkipPass: false }) });
                                    const data = await res.json();
                                    if (data.success) { setPendingAccept(null); setPendingAcceptSkip(false); onClose?.(); }
                                } catch {}
                            }}><span>PAY 300 COINS</span></button>
                            <button onClick={() => setPendingAcceptSkip(false)} style={{ background: 'none', border: 'none', fontFamily: 'Cinzel, serif', fontSize: '0.7rem', letterSpacing: '3px', color: 'rgba(255,255,255,0.15)', cursor: 'pointer', padding: '8px', textAlign: 'center' }}>back</button>
                        </div>
                    )}
                >
                    <div style={{ textAlign: 'center', width: '100%' }}>
                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.75rem', color: 'rgba(197,160,89,0.4)', letterSpacing: '5px', marginBottom: 20 }}>Your fate is</div>
                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.5rem', color: 'rgba(255,255,255,0.92)', lineHeight: 1.55, letterSpacing: '0.5px' }}>{pendingAccept.resultText}</div>
                    </div>
                </GameShell>,
                document.body
            )}

            {/* ══════════════════════════════════════════════
                FOLLOW-UP OVERLAY — empty shell, reads from config
                No skip. No logic. Displays what the keyholder set.
            ══════════════════════════════════════════════ */}
            {followUp && (() => {
                const AUTO_TYPES = ['add_coins', 'remove_coins', 'add_day', 'remove_day', 'add_skippass'];
                const isAutoType = AUTO_TYPES.includes(followUp.type);
                const proof = isAutoType ? PROOF_TYPES['instant'] : (PROOF_TYPES[followUp.type] ?? PROOF_TYPES['instant']);
                const taskName = followUp.resultText || followUp.instruction || '';
                const duration = followUp.duration;
                const durationLabel = duration
                    ? duration < 90 ? `${duration} sec`
                      : duration % 60 === 0 ? `${duration / 60} min`
                      : `${Math.floor(duration / 60)} min ${duration % 60} sec`
                    : null;
                const wc = followUpText.split(/\s+/).filter(Boolean).length;
                const minW = followUp.target || followUp.minWords || 20;
                const writingOk = wc >= minW;

                const autoLabel = followUp.type === 'add_coins'    ? `+${followUp.amount || 50} coins`
                                : followUp.type === 'remove_coins' ? `−${followUp.amount || 50} coins`
                                : followUp.type === 'add_day'      ? `+${followUp.amount || 1} day${(followUp.amount || 1) !== 1 ? 's' : ''}`
                                : followUp.type === 'remove_day'   ? `−${followUp.amount || 1} day${(followUp.amount || 1) !== 1 ? 's' : ''}`
                                :                                    `+${followUp.amount || 1} skip pass${(followUp.amount || 1) !== 1 ? 'es' : ''}`;

                return typeof document !== 'undefined' ? createPortal(
                    <GameShell title={followUp.source} zIndex={9999}
                        footer={<>
                            {/* AUTO TYPES — applied immediately */}
                            {isAutoType && (
                                <button onClick={() => submitAutoFollowUp()}
                                    className="coin-flip-btn" style={{ width: '100%' }}>
                                    <span>CONFIRM</span>
                                </button>
                            )}
                            {/* WRITING SUBMIT */}
                            {!isAutoType && proof.isWriting && (
                                <button onClick={() => submitFollowUp({ text: `${followUp.source}: ${taskName} — ${followUpText}` })} disabled={!writingOk}
                                    className="coin-flip-btn" style={{ width: '100%', opacity: writingOk ? 1 : 0.3 }}>
                                    <span>SUBMIT</span>
                                </button>
                            )}
                            {/* PHOTO / VIDEO */}
                            {!isAutoType && (proof.isVideo || (!proof.isWriting && !proof.isInstant)) && (
                                <label style={{ cursor: followUpUploading ? 'default' : 'pointer', display: 'block', width: '100%' }}>
                                    <div className="coin-flip-btn" style={{ width: '100%', opacity: followUpUploading ? 0.4 : 1 }}>
                                        <span>{followUpUploading ? 'UPLOADING...' : proof.isVideo ? 'RECORD VIDEO' : 'OPEN CAMERA'}</span>
                                    </div>
                                    <input type="file" accept={proof.accept} capture="environment" style={{ display: 'none' }} onChange={async (e) => {
                                        const file = e.target.files?.[0]; if (!file) return; e.target.value = '';
                                        if (previewMode) { await submitFollowUp({ text: `${followUp.source}: ${taskName}`, photoUrl: 'preview://proof' }); return; }
                                        setFollowUpUploading(true);
                                        try {
                                            const ext = file.name.split('.').pop()?.toLowerCase() || (proof.isVideo ? 'mp4' : 'jpg');
                                            const fd = new FormData(); fd.append('file', file); fd.append('folder', `vault/tasks/${mid}`); fd.append('ext', ext === 'heic' ? 'jpg' : ext);
                                            const res = await fetch('/api/upload', { method: 'POST', body: fd });
                                            const data = await res.json();
                                            if (data.url) await submitFollowUp({ text: `${followUp.source}: ${taskName}`, photoUrl: data.url });
                                        } catch {} finally { setFollowUpUploading(false); }
                                    }} />
                                </label>
                            )}
                            {/* INSTANT */}
                            {!isAutoType && proof.isInstant && (
                                <button onClick={() => submitFollowUp({ text: `${followUp.source}: ${taskName}` })}
                                    className="coin-flip-btn" style={{ width: '100%' }}>
                                    <span>DONE</span>
                                </button>
                            )}
                        </>}
                    >
                        <div style={{ textAlign: 'center', width: '100%' }}>
                            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.6rem', color: 'rgba(255,255,255,0.92)', lineHeight: 1.4, marginBottom: durationLabel ? 12 : 28 }}>
                                {taskName}
                            </div>
                            {durationLabel && (
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.32rem', color: 'rgba(197,160,89,0.4)', letterSpacing: '5px', marginBottom: 28 }}>
                                    {durationLabel}
                                </div>
                            )}
                            <div style={{ width: '100%', height: 1, background: 'rgba(197,160,89,0.1)', marginBottom: 24 }} />
                            {isAutoType ? (
                                <div style={{ background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.2)', borderRadius: 12, padding: '20px 24px', textAlign: 'center' }}>
                                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.28rem', color: 'rgba(197,160,89,0.4)', letterSpacing: '6px', marginBottom: 10 }}>AUTOMATIC</div>
                                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '2rem', color: 'rgba(197,160,89,0.92)', fontWeight: 700, marginBottom: 10 }}>{autoLabel}</div>
                                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.25rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '4px' }}>WILL BE APPLIED ON CONFIRM</div>
                                </div>
                            ) : (
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.28rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '5px', marginBottom: proof.isWriting ? 20 : 0 }}>
                                    {proof.label}
                                </div>
                            )}
                            {!isAutoType && proof.isWriting && (
                                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
                                    <textarea value={followUpText} onChange={e => setFollowUpText(e.target.value)}
                                        placeholder="Write here..."
                                        style={{ width: '100%', minHeight: '28vh', background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(197,160,89,${writingOk ? '0.2' : '0.07'})`, borderRadius: 10, padding: 16, color: 'rgba(255,255,255,0.7)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '16px', lineHeight: 1.75, resize: 'none', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }} />
                                    <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', color: writingOk ? 'rgba(197,160,89,0.5)' : 'rgba(255,255,255,0.18)' }}>{wc} / {minW} words</span>
                                </div>
                            )}
                        </div>
                    </GameShell>,
                    document.body
                ) : null;
            })()}

            {/* ══════════════════════════════════════════════
                VAULT SKIP OVERLAY (for non-followUp skips)
            ══════════════════════════════════════════════ */}
            {skipOpen && typeof document !== 'undefined' && createPortal(
                <GameShell title={label} onClose={() => setSkipOpen(false)} zIndex={9998}
                    footer={<>
                        <button onClick={async () => {
                            const coins = profile?.wallet ?? 0;
                            if (coins < 300) { alert('Not enough coins. 300 required.'); return; }
                            if (previewMode) { setSkipOpen(false); onClose?.(); return; }
                            try {
                                const res = await fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'skip_order', memberId: mid, orderType: o.type, cost: 300 }) });
                                const data = await res.json();
                                if (data.success) { setSkipOpen(false); onClose?.(); }
                            } catch {}
                        }} className="coin-flip-btn" style={{ width: '100%' }}>
                            <span>PAY 300 COINS</span>
                        </button>
                        <button disabled={!((profile?.skippass ?? 0) > 0)} onClick={async () => {
                            if (previewMode) { setSkipOpen(false); onClose?.(); return; }
                            try {
                                const res = await fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'skip_order', memberId: mid, orderType: o.type, useSkipPass: true }) });
                                const data = await res.json();
                                if (data.success) { setSkipOpen(false); onClose?.(); }
                            } catch {}
                        }} className="coin-flip-btn" style={{ width: '100%', opacity: ((profile?.skippass ?? 0) > 0) ? 1 : 0.3 }}>
                            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                                <span>USE SKIP PASS</span>
                                <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.65rem', letterSpacing: '3px', color: 'rgba(197,160,89,0.5)' }}>{profile?.skippass || 0} LEFT</span>
                            </span>
                        </button>
                        <button onClick={() => setSkipOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Cinzel, serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.18)', letterSpacing: '3px', padding: '14px' }}>CANCEL</button>
                    </>}
                >
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '3px', textAlign: 'center' }}>SKIP THIS TASK?</div>
                </GameShell>,
                document.body
            )}

            {/* ══════════════════════════════════════════════
                COMPLETION SCREEN — shown after every submission
            ══════════════════════════════════════════════ */}
            {completionMsg && typeof document !== 'undefined' && createPortal(
                <GameShell title="✦" zIndex={10000}
                    footer={
                        <button className="coin-flip-btn" style={{ width: '100%' }} onClick={() => {
                            setCompletionMsg(null);
                            setMechStarted(false);
                            onComplete?.(completionOpts);
                            onClose?.();
                        }}>
                            <span style={{ fontFamily: 'Dancing Script, cursive', fontSize: '1.1rem', letterSpacing: '1px' }}>Thank you, Queen Karin</span>
                        </button>
                    }
                >
                    <div style={{ textAlign: 'center', padding: '0 4px' }}>
                        {/* Crown */}
                        <div style={{ fontSize: '1.8rem', color: 'rgba(197,160,89,0.4)', marginBottom: 24, animation: 'vFadeIn 0.8s ease' }}>♛</div>

                        {/* Summary — what was submitted */}
                        {(() => {
                            const qr = completionOpts.quizResult;
                            const hasPhoto = !!completionOpts.photoUrl;
                            const txt = completionOpts.text;
                            const isLong = txt && (txt.length > 80 || txt.includes('\n'));
                            const wc = isLong ? txt!.trim().split(/\s+/).filter(Boolean).length : 0;

                            if (qr) return (
                                <div style={{ marginBottom: 24, animation: 'vFadeIn 0.4s ease' }}>
                                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '2rem', color: 'rgba(197,160,89,0.82)', letterSpacing: 6, marginBottom: 6 }}>
                                        {qr.correct}/{qr.total}
                                    </div>
                                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.72rem', color: 'rgba(255,255,255,0.28)', letterSpacing: 1, marginBottom: 8 }}>
                                        {qr.correct === qr.total ? 'Every answer correct.' : qr.correct === 0 ? 'Every answer wrong.' : `${qr.correct} correct, ${qr.total - qr.correct} wrong`}
                                    </div>
                                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.42rem', color: 'rgba(197,160,89,0.4)', letterSpacing: '5px' }}>
                                        {qr.dayChange === -1 ? '— 1 DAY' : qr.dayChange === 3 ? '+ 3 DAYS' : 'NO CHANGE'}
                                    </div>
                                </div>
                            );
                            if (hasPhoto) return (
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.38rem', color: 'rgba(197,160,89,0.4)', letterSpacing: '5px', marginBottom: 24, animation: 'vFadeIn 0.4s ease' }}>
                                    PHOTO RECEIVED
                                </div>
                            );
                            if (isLong) return (
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.38rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '4px', marginBottom: 24, animation: 'vFadeIn 0.4s ease' }}>
                                    {wc} WORDS SUBMITTED
                                </div>
                            );
                            if (txt) return (
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.35rem', color: 'rgba(255,255,255,0.18)', letterSpacing: '3px', marginBottom: 24, animation: 'vFadeIn 0.4s ease', textTransform: 'uppercase' }}>
                                    {txt.length > 60 ? txt.slice(0, 60) + '…' : txt}
                                </div>
                            );
                            return null;
                        })()}

                        {/* Note card */}
                        <div style={{
                            background: 'rgba(197,160,89,0.04)',
                            border: '1px solid rgba(197,160,89,0.14)',
                            borderRadius: 18,
                            padding: '32px 28px 28px',
                            animation: 'vFadeIn 0.55s ease 0.15s both',
                        }}>
                            {/* Message */}
                            <div style={{
                                fontFamily: 'Dancing Script, cursive',
                                fontSize: '1.5rem',
                                fontWeight: 500,
                                color: 'rgba(255,255,255,0.88)',
                                lineHeight: 1.65,
                                marginBottom: 28,
                            }}>
                                {completionMsg}
                            </div>

                            {/* Thin gold rule */}
                            <div style={{ width: 56, height: 1, background: 'rgba(197,160,89,0.35)', margin: '0 auto 20px' }} />

                            {/* Signature */}
                            <div style={{
                                fontFamily: 'Dancing Script, cursive',
                                fontSize: '1.35rem',
                                fontWeight: 700,
                                color: 'rgba(197,160,89,0.7)',
                                letterSpacing: '0.5px',
                                animation: 'vFadeIn 0.5s ease 0.35s both',
                            }}>
                                Queen Karin
                            </div>
                        </div>
                    </div>
                </GameShell>,
                document.body
            )}
        </>
    );
}
