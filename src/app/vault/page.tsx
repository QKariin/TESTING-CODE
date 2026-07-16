'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import '../../css/profile.css';
import '../../css/profile-mobile.css';

// ── Mock data ──
const MOCK = {
    name: 'Subject #47',
    lockStart: new Date(Date.now() - 14 * 86400000 - 7 * 3600000 - 23 * 60000).toISOString(),
    lockEnd: new Date(Date.now() + 16 * 86400000 + 4 * 3600000).toISOString(),
    lockDays: 30, // total lock sentence in days
    streak: 3, denials: 7, trialsCompleted: 12, totalDaysLocked: 47,
    sanity: 62, tier: 'monthly', kneelsToday: 2, merit: 340, coins: 1200,
    milestones: ['bronze', 'silver'],
    todayTrial: { text: 'Write 200 words explaining why you don\'t deserve release today.', type: 'writing' },
    trialHistory: [
        true, true, false, true, true, true, true, false, true, true, true, true, true, true,
    ],
    // obedience history per day: true = perfect, false = failed, for each completed day
    dailyObedience: [
        true, true, false, true, true, true, true, false, true, true, true, true, true, true,
    ],
    // detailed daily logs (mock — will come from vault_daily + vault_trials + vault_spins)
    dailyLogs: [
        { day: 1, date: '2026-06-26', perfect: true, orders: [{ type: 'kneel', target: 8, done: 8 }, { type: 'spin', target: 1, done: 1 }, { type: 'trial', target: 1, done: 1 }], trial: { prompt: 'Why do you deserve to be locked?', response: 'Because I am weak and need Queen Karin\'s control to become worthy.' }, spin: { text: 'Queen grants 50 coins', type: 'reward' }, tribute: 10 },
        { day: 2, date: '2026-06-27', perfect: true, orders: [{ type: 'kneel', target: 8, done: 8 }, { type: 'trial', target: 1, done: 1 }, { type: 'tribute', target: 5, done: 5 }], trial: { prompt: 'Describe your weakness in 100 words.', response: 'I cannot resist temptation without guidance. Every moment unlocked is a moment wasted...' }, spin: null, tribute: 5 },
        { day: 3, date: '2026-06-28', perfect: false, orders: [{ type: 'kneel', target: 8, done: 3 }, { type: 'spin', target: 1, done: 1 }, { type: 'trial', target: 1, done: 0 }], trial: null, spin: { text: '+2 days added to sentence', type: 'punishment' }, tribute: 0 },
        { day: 4, date: '2026-06-29', perfect: true, orders: [{ type: 'kneel', target: 8, done: 8 }, { type: 'trial', target: 1, done: 1 }, { type: 'tribute', target: 5, done: 5 }], trial: { prompt: 'What would you say to Queen if she released you now?', response: 'I would beg her not to. I am not ready. I haven\'t proven myself yet.' }, spin: null, tribute: 5 },
        { day: 5, date: '2026-06-30', perfect: true, orders: [{ type: 'kneel', target: 8, done: 8 }, { type: 'spin', target: 1, done: 1 }, { type: 'silence', target: 1, done: 1 }], trial: null, spin: { text: '1 day removed', type: 'reward' }, tribute: 0 },
        { day: 6, date: '2026-07-01', perfect: true, orders: [{ type: 'kneel', target: 8, done: 8 }, { type: 'trial', target: 1, done: 1 }], trial: { prompt: 'Confess your darkest thought today.', response: 'I almost looked at the timer. I know I shouldn\'t count the days.' }, spin: null, tribute: 10 },
        { day: 7, date: '2026-07-02', perfect: true, orders: [{ type: 'kneel', target: 10, done: 10 }, { type: 'spin', target: 1, done: 1 }, { type: 'trial', target: 1, done: 1 }, { type: 'tribute', target: 10, done: 10 }], trial: { prompt: 'Bronze seal day. Why do you continue?', response: 'Because serving Queen Karin is not a choice. It is who I am.' }, spin: { text: 'Nothing happens. Suffer.', type: 'nothing' }, tribute: 10, seal: 'bronze' },
        { day: 8, date: '2026-07-03', perfect: false, orders: [{ type: 'kneel', target: 8, done: 5 }, { type: 'trial', target: 1, done: 1 }, { type: 'tribute', target: 5, done: 0 }], trial: { prompt: 'Rate your desperation 1-10. Explain.', response: '7. The pressure is building but I will not break.' }, spin: null, tribute: 0 },
        { day: 9, date: '2026-07-04', perfect: true, orders: [{ type: 'kneel', target: 8, done: 8 }, { type: 'spin', target: 1, done: 1 }, { type: 'trial', target: 1, done: 1 }], trial: { prompt: 'Write an apology for yesterday\'s failure.', response: 'I failed you, Queen. I let laziness win. It will not happen again.' }, spin: { text: 'Cold shower proof — 1 hour', type: 'challenge' }, tribute: 5 },
        { day: 10, date: '2026-07-05', perfect: true, orders: [{ type: 'kneel', target: 8, done: 8 }, { type: 'trial', target: 1, done: 1 }], trial: { prompt: 'What have you learned in 10 days?', response: 'That discipline is not punishment. It is freedom from my own weakness.' }, spin: null, tribute: 0 },
        { day: 11, date: '2026-07-06', perfect: true, orders: [{ type: 'kneel', target: 8, done: 8 }, { type: 'spin', target: 1, done: 1 }, { type: 'tribute', target: 5, done: 5 }], trial: null, spin: { text: 'Edge 3 times. No release.', type: 'punishment' }, tribute: 5 },
        { day: 12, date: '2026-07-07', perfect: true, orders: [{ type: 'kneel', target: 8, done: 8 }, { type: 'trial', target: 1, done: 1 }], trial: { prompt: 'Describe the moment you almost broke.', response: 'Day 3. I wanted to skip everything. But the red dot on my calendar haunts me.' }, spin: null, tribute: 0 },
        { day: 13, date: '2026-07-08', perfect: true, orders: [{ type: 'kneel', target: 8, done: 8 }, { type: 'spin', target: 1, done: 1 }, { type: 'trial', target: 1, done: 1 }, { type: 'tribute', target: 5, done: 5 }], trial: { prompt: 'Write a thank you to your keyholder.', response: 'Thank you for not giving up on me when I gave up on myself.' }, spin: { text: 'Queen grants 50 coins', type: 'reward' }, tribute: 5 },
        { day: 14, date: '2026-07-09', perfect: true, orders: [{ type: 'kneel', target: 10, done: 10 }, { type: 'trial', target: 1, done: 1 }, { type: 'tribute', target: 10, done: 10 }], trial: { prompt: 'Silver seal day. Has the lock changed you?', response: 'I am not the same person who started. I am quieter. More focused. More hers.' }, spin: null, tribute: 10, seal: 'silver' },
    ] as DayLog[],
};

type DayLog = {
    day: number;
    date: string;
    perfect: boolean;
    orders: { type: string; target: number; done: number }[];
    trial?: { prompt: string; response: string } | null;
    spin?: { text: string; type: string } | null;
    tribute: number;
    seal?: string;
};

const WHEEL = [
    { text: 'Edge 3 times. No release.', type: 'punishment' },
    { text: '+2 days added to sentence', type: 'punishment' },
    { text: 'Queen grants 50 coins', type: 'reward' },
    { text: 'Cold shower proof — 1 hour', type: 'challenge' },
    { text: 'Write why you\'re grateful', type: 'task' },
    { text: '1 day removed', type: 'reward' },
    { text: 'Hold ice 60s — video proof', type: 'challenge' },
    { text: 'Nothing happens. Suffer.', type: 'nothing' },
];

const SEALS = [
    { key: 'bronze', label: 'BRONZE', days: 7, color: '#cd7f32' },
    { key: 'silver', label: 'SILVER', days: 14, color: '#c0c0c0' },
    { key: 'gold', label: 'GOLD', days: 30, color: '#c5a059' },
    { key: 'diamond', label: 'DIAMOND', days: 90, color: '#b9f2ff' },
];

const KNEELS_NEEDED = 5;
const R = 'rgba(139,0,0,'; // red accent base

/* ── Mechanism icon + label lookup ── */
const MECH_ICON: Record<string, { icon: string; label: string; desc?: string }> = {
    kneel:            { icon: '\u25C7', label: 'Kneel', desc: 'Complete your required kneeling sessions.' },
    spin:             { icon: '\u265B', label: 'Spin the Wheel', desc: 'Spin the wheel of fate. Whatever it lands on, you obey.' },
    spin_wheel:       { icon: '\u25CE', label: 'Spin the Wheel', desc: 'Spin the wheel of fate. Whatever it lands on, you obey.' },
    coinflip:         { icon: '$',      label: 'Coinflip', desc: 'Heads or tails — fate decides your punishment or reward. No take-backs.' },
    card_pick:        { icon: '\u2660', label: 'Card Pick', desc: 'Draw a card from Queen\'s deck. Each card holds a task or consequence. Accept it.' },
    dice_roll:        { icon: '\u2684', label: 'Dice Roll', desc: 'Roll the dice. The number determines your punishment intensity.' },
    russian_roulette: { icon: '\u2295', label: 'Russian Roulette', desc: 'One chamber holds a penalty. Pull the trigger and hope for the best.' },
    quiz:             { icon: '\u2753', label: 'Quiz', desc: 'Answer Queen\'s question correctly. Wrong answers have consequences.' },
    writing:          { icon: '\u270E', label: 'Writing', desc: 'Write as instructed by Queen. Quality and obedience will be judged.' },
    multi_video:      { icon: '\u2736', label: 'Video Proof', desc: 'Record a video as instructed. Show clear proof of completion.' },
    photo_proof:      { icon: '\u270D', label: 'Photo Proof', desc: 'Take a clear photo as proof of task completion. No filters.' },
    timed_photo:      { icon: '\u25C7', label: 'Timed Photo', desc: 'Take a photo within the time limit. Speed and obedience matter.' },
    ambush_snap:      { icon: '!',      label: 'Ambush Snap', desc: 'Take a photo RIGHT NOW. No preparation, no posing, no delay. Show exactly where you are and what you\'re doing this instant.' },
    endurance:        { icon: '\u25A2', label: 'Endurance', desc: 'Endure the challenge for the full duration. Film yourself as proof.' },
    greed_game:       { icon: '\u2191', label: 'Greed Game', desc: 'Push your luck — the more you risk, the more you could win or lose.' },
    truth_dare:       { icon: '?',      label: 'Truth or Dare', desc: 'Choose truth or dare. Both will test you. Write your honest response.' },
    simon_says:       { icon: '\u26A1', label: 'Simon Says', desc: 'Follow the instructions exactly as given. One mistake and you fail.' },
    payment:          { icon: '\u25C6', label: 'Payment', desc: 'Complete the required payment or tribute as ordered.' },
    trial:            { icon: '\u270E', label: 'Daily Trial', desc: 'Your daily written trial. Write from the heart.' },
    tribute:          { icon: '\u2605', label: 'Tribute', desc: 'Send your tribute to Queen as ordered.' },
    chastity_check:   { icon: '\u25C8', label: 'Chastity Check', desc: 'Submit photo proof that your device is locked and secure.' },
    corner_time:      { icon: '\u23F1', label: 'Corner Time', desc: 'Stand in the corner facing the wall. No phone. No distractions. Report when done.' },
    cold_shower:      { icon: '\u2744', label: 'Cold Shower', desc: 'Take a cold shower. Film or photograph yourself as proof.' },
    silence:          { icon: '\u{1F910}', label: 'Silence', desc: 'You are forbidden from messaging today. Endure the silence.' },
    journal:          { icon: '\u270E', label: 'Journal', desc: 'Write your daily journal entry as instructed.' },
    confession:       { icon: '\u270E', label: 'Confession', desc: 'Confess honestly. Queen sees everything.' },
    worship:          { icon: '\u2605', label: 'Worship', desc: 'Write a worship message to Queen Karin.' },
    gratitude:        { icon: '\u2605', label: 'Gratitude', desc: 'List what you are grateful for.' },
    essay:            { icon: '\u270E', label: 'Essay', desc: 'Write your essay as assigned.' },
    lines:            { icon: '\u270E', label: 'Lines', desc: 'Write the assigned line repeatedly as punishment.' },
    exercise:         { icon: '\u25A2', label: 'Exercise', desc: 'Complete the required exercise reps. Photo or video proof required.' },
    body_writing:     { icon: '\u270D', label: 'Body Writing', desc: 'Write the required word on your body. Take a clear photo.' },
    edge:             { icon: '\u25C6', label: 'Edge', desc: 'Edge as instructed. Do not release. Report when done.' },
    denial:           { icon: '\u25C6', label: 'Denial', desc: 'Full denial. No touching for 24 hours. Report compliance.' },
};

// No hardcoded fallback — orders come only from vault_daily (the database)
const TODAYS_ORDERS: any[] = [];

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

// Convert a vault_daily DB record into a DayLog for the day detail modal
function _toDayLog(rec: any): DayLog {
    const orders = typeof rec.orders === 'string' ? JSON.parse(rec.orders) : (rec.orders || []);
    return {
        day: rec.day_number,
        date: rec.date,
        perfect: rec.perfect ?? false,
        orders,
        trial: null, // filled from vault_trials if available
        spin: null,  // filled from vault_spins if available
        tribute: 0,
    };
}

// Attention button outcomes
const ATTENTION_TASKS = [
    { type: 'spin', label: 'SPIN THE WHEEL', desc: 'Fate decides your suffering', icon: '&#9819;' },
    { type: 'tribute', label: 'TRIBUTE 10 COINS', desc: 'Pay for the privilege of her attention', icon: '&#9733;' },
    { type: 'proof', label: 'UPLOAD PROOF', desc: 'Show me you\'re still locked', icon: '&#9670;' },
    { type: 'tribute', label: 'TRIBUTE 25 COINS', desc: 'Queen demands a larger offering', icon: '&#9733;' },
    { type: 'proof', label: 'EDGE & UPLOAD PROOF', desc: 'Edge once. Photograph the moment you stop.', icon: '&#9670;' },
    { type: 'spin', label: 'DOUBLE SPIN', desc: 'Two spins. Both apply.', icon: '&#9819;' },
    { type: 'proof', label: 'COLD WATER PROOF', desc: '30 seconds cold water. Film it.', icon: '&#9670;' },
    { type: 'tribute', label: 'TRIBUTE 5 COINS', desc: 'A small price for obedience', icon: '&#9733;' },
    { type: 'coinflip', label: 'COIN FLIP', desc: 'Heads you enter. Tails you wait 5 minutes.', icon: '&#9673;' },
    { type: 'coinflip', label: 'COIN FLIP', desc: 'Gamble for your voice. Lose and suffer silence.', icon: '&#9673;' },
    { type: 'patience', label: 'PATIENCE TEST', desc: 'Queen makes you wait. Do not leave.', icon: '&#9201;' },
    { type: 'patience', label: 'WAIT IN SILENCE', desc: 'Prove you can endure before you speak.', icon: '&#9201;' },
    { type: 'confess', label: 'CONFESS', desc: 'Reveal something to Queen before you may speak.', icon: '&#9998;' },
    { type: 'confess', label: 'CONFESS YOUR WEAKNESS', desc: 'What are you ashamed of today?', icon: '&#9998;' },
];

function fmt(ms: number) {
    const t = Math.max(0, Math.floor(ms / 1000));
    return { d: Math.floor(t / 86400), h: Math.floor((t % 86400) / 3600), m: Math.floor((t % 3600) / 60) };
}

// Read cached data synchronously before first render — no flash
function _readCache() {
    if (typeof window === 'undefined') return { profile: null, session: null, kneel: null };
    try {
        const p = sessionStorage.getItem('_vaultProfileCache');
        const s = sessionStorage.getItem('_vaultSessionCache');
        const k = sessionStorage.getItem('_vaultKneelCache');
        return { profile: p ? JSON.parse(p) : null, session: s ? JSON.parse(s) : null, kneel: k ? JSON.parse(k) : null };
    } catch { return { profile: null, session: null, kneel: null }; }
}
const _initCache = _readCache();

export default function VaultPage() {
    const [loading, setLoading] = useState(!_initCache.profile);
    const [profile, setProfile] = useState<any>(_initCache.profile);
    const [vaultData, setVaultData] = useState<any>(_initCache.session?.active ? _initCache.session : null); // real DB data from /api/vault/session
    const [elapsed, setElapsed] = useState(() => {
        const s = _initCache.session?.session;
        return s?.started_at ? fmt(Date.now() - new Date(s.started_at).getTime()) : fmt(0);
    });
    const [remaining, setRemaining] = useState(() => {
        const s = _initCache.session?.session;
        return s?.expires_at ? fmt(new Date(s.expires_at).getTime() - Date.now()) : fmt(0);
    });
    const [attentionCount, setAttentionCount] = useState(0);
    const [sanity, setSanity] = useState(62);
    const [trialOpen, setTrialOpen] = useState(false);
    const [trialText, setTrialText] = useState('');
    const [trialDone, setTrialDone] = useState(false);
    const [chastityUploading, setChastityUploading] = useState(false);
    const [chastityStatus, setChastityStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
    const [chastityWindow, setChastityWindow] = useState<{ open: boolean; before: boolean; localHour: number; localMinute: number }>(() => {
        try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const now = new Date();
            const h = parseInt(new Intl.DateTimeFormat('en', { timeZone: tz, hour: '2-digit', hour12: false }).format(now), 10);
            const m = parseInt(new Intl.DateTimeFormat('en', { timeZone: tz, minute: '2-digit' }).format(now), 10);
            return { open: h >= 6 && h < 10, before: h < 6, localHour: h, localMinute: m };
        } catch { return { open: false, before: false, localHour: 0, localMinute: 0 }; }
    });
    const [chastityPhotoUrl, setChastityPhotoUrl] = useState<string | null>(null);
    const [spinning, setSpinning] = useState(false);
    const [wheelAngle, setWheelAngle] = useState(0);
    const [wheelResult, setWheelResult] = useState<any>(null);
    const [wheelUsed, setWheelUsed] = useState(false);
    const [showBeg, setShowBeg] = useState(false);
    const [begText, setBegText] = useState('');
    const [begSent, setBegSent] = useState(false);
    const [tab, setTab] = useState<'vault' | 'chat' | 'queen' | 'global' | 'challenge'>('vault');
    const [selectedDay, setSelectedDay] = useState<DayLog | null>(null);
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [mechOverlay, setMechOverlay] = useState<{ order: any; idx: number } | null>(null);
    const [diceRolling, setDiceRolling] = useState(false);
    const [diceResult, setDiceResult] = useState<number | null>(null);
    const [coinFlipping, setCoinFlipping] = useState(false);
    const [coinResult, setCoinResult] = useState<string | null>(null);
    const [cardPicking, setCardPicking] = useState(false);
    const [cardResult, setCardResult] = useState<any>(null);
    const [rouletteSpinning, setRouletteSpinning] = useState(false);
    const [rouletteResult, setRouletteResult] = useState<string | null>(null);
    const [mechDone, setMechDone] = useState(false);
    const [wheelSpinning, setWheelSpinning] = useState(false);
    const [wheelPreview, setWheelPreview] = useState<string | null>(null);
    const [truthDareChoice, setTruthDareChoice] = useState<'truth' | 'dare' | null>(null);
    const [simonStep, setSimonStep] = useState(0);
    const [greedCoins, setGreedCoins] = useState(0);
    const [greedBusted, setGreedBusted] = useState(false);
    const [greedCashedOut, setGreedCashedOut] = useState(false);
    const [followUp, setFollowUp] = useState<{ orderType: string; source: string; resultText: string; type: string; prompt?: string; instruction?: string; duration?: number; target?: number } | null>(null);
    const [followUpText, setFollowUpText] = useState('');
    const [followUpUploading, setFollowUpUploading] = useState(false);
    const [pendingFollowUp, setPendingFollowUp] = useState<{ orderType: string; source: string; resultText: string; type: string; prompt?: string; instruction?: string; duration?: number; target?: number } | null>(null);
    const [followUpSkipping, setFollowUpSkipping] = useState(false);

    // Persist gamble results to server + localStorage so they survive reload
    const saveGambleResult = useCallback((data: Record<string, any>, orderType?: string) => {
        try {
            const existing = JSON.parse(localStorage.getItem('vault_gamble_results') || '{}');
            localStorage.setItem('vault_gamble_results', JSON.stringify({ ...existing, ...data }));
        } catch {}
        // Also persist to server so it survives hard refresh / cleared localStorage
        if (orderType) {
            const mid = (window as any).__vaultMemberId || '';
            if (mid) {
                fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'save_gamble', memberId: mid, orderType, gambleResult: data }),
                }).catch(() => {});
            }
        }
    }, []);
    const clearGambleResults = useCallback(() => {
        try { localStorage.removeItem('vault_gamble_results'); } catch {}
    }, []);
    // Auto-transition from mechanic result to follow-up overlay
    useEffect(() => {
        if (!pendingFollowUp) return;
        const t = setTimeout(() => {
            setFollowUp(pendingFollowUp);
            setPendingFollowUp(null);
            setMechDone(false);
            setDiceResult(null); setCoinResult(null); setCardResult(null);
            setRouletteResult(null); setWheelResult(null); setTruthDareChoice(null);
            clearGambleResults();
        }, 2500);
        return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingFollowUp]);
    const [taskText, setTaskText] = useState('');
    const [taskUploading, setTaskUploading] = useState(false);
    const [taskSubmitted, setTaskSubmitted] = useState<Record<string, boolean>>({});
    const [attnHolding, setAttnHolding] = useState(false);
    const [attnFill, setAttnFill] = useState(0);
    const [attnResult, setAttnResult] = useState<typeof ATTENTION_TASKS[0] | null>(null);
    const [attnCooldownUntil, setAttnCooldownUntil] = useState(0); // timestamp when cooldown ends
    const [penaltyHours, setPenaltyHours] = useState(_initCache.session?.totalPenaltyHours || 0); // hours added to lock sentence
    const [rewardUntil, setRewardUntil] = useState(0); // timestamp when 1h freedom expires
    const [attnProofUploaded, setAttnProofUploaded] = useState(false);
    const [attnSpinning, setAttnSpinning] = useState(false);
    const [attnSpinAngle, setAttnSpinAngle] = useState(0);
    const [attnSpinResult, setAttnSpinResult] = useState<typeof WHEEL[0] | null>(null);
    const [attnSkippedToday, setAttnSkippedToday] = useState(false);
    const [chatGateHolding, setChatGateHolding] = useState(false);
    const [chatGateFill, setChatGateFill] = useState(0);
    const [chatGateTask, setChatGateTask] = useState<typeof ATTENTION_TASKS[0] | null>(null);
    const [chatGateDone, setChatGateDone] = useState(false);
    const [chatExpiresAt, setChatExpiresAt] = useState(0);
    const [chatGateProofUploaded, setChatGateProofUploaded] = useState(false);
    const [chatGateSpinning, setChatGateSpinning] = useState(false);
    const [chatGateSpinAngle, setChatGateSpinAngle] = useState(0);
    const [chatGateSpinResult, setChatGateSpinResult] = useState<typeof WHEEL[0] | null>(null);
    const [chatGateFlipState, setChatGateFlipState] = useState<'idle' | 'flipping' | 'heads' | 'tails'>('idle');
    const [chatGateFlipLocked, setChatGateFlipLocked] = useState(0); // timestamp when lockout ends
    const [chatGateWaitTotal, setChatGateWaitTotal] = useState(0);
    const [chatGateWaitLeft, setChatGateWaitLeft] = useState(0);
    const [chatGateConfessText, setChatGateConfessText] = useState('');
    const [chatGateCooldownUntil, setChatGateCooldownUntil] = useState(0);
    const [cancelShame, setCancelShame] = useState<'attn' | 'gate' | null>(null);
    // Kneel state
    const [kneelHolding, setKneelHolding] = useState(false);
    const [kneelFill, setKneelFill] = useState(0);
    const [kneelToday, setKneelToday] = useState(_initCache.kneel?.todayKneeling || 0);
    const [kneelCooldownUntil, setKneelCooldownUntil] = useState(_initCache.kneel?.isLocked && _initCache.kneel?.minLeft > 0 ? Date.now() + _initCache.kneel.minLeft * 60000 : 0);
    const [kneelDone, setKneelDone] = useState(false); // just completed animation
    const kneelTimer = useRef<ReturnType<typeof setInterval> | null>(null);
    const kneelStartTime = useRef(0);
    const kneelCooldown = kneelCooldownUntil > Date.now();
    // Release overlay
    const [releaseOverlay, setReleaseOverlay] = useState<{ reason: string } | null>(null);
    // Vlad mini-chat
    const [vladOpen, setVladOpen] = useState(false);
    const [vladMsgs, setVladMsgs] = useState<{ role: 'user' | 'vlad'; text: string }[]>([]);
    const [vladInput, setVladInput] = useState('');
    const [vladSending, setVladSending] = useState(false);
    const [vladPulse, setVladPulse] = useState(false);
    const [vladBubble, setVladBubble] = useState(''); // floating speech bubble text
    const vladBubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const vladScrollRef = useRef<HTMLDivElement>(null);
    const attnTimer = useRef<ReturnType<typeof setInterval> | null>(null);
    const attnStartTime = useRef(0);
    const chatGateTimer = useRef<ReturnType<typeof setInterval> | null>(null);
    const chatGateStartTime = useRef(0);
    const globalOk = attentionCount >= KNEELS_NEEDED;
    const chatOk = chatGateDone;
    const daysIn = vaultData?.daysIn ?? 0;
    const lockDays = vaultData?.session?.lock_days ?? 0;
    const dailyRecords = vaultData?.dailyRecords || [];
    const adjustments = vaultData?.adjustments || [];
    // Use programTasks (direct from vault_member_program) as source of truth, fallback to vault_daily orders
    const programTasks = vaultData?.programTasks;
    const rawOrders = vaultData?.today?.orders;
    const todayOrdersBase = programTasks && programTasks.length > 0
        ? programTasks
        : rawOrders ? (typeof rawOrders === 'string' ? JSON.parse(rawOrders) : rawOrders) : TODAYS_ORDERS;
    // Sync kneel order with kneelToday, and chastity with chastityStatus
    const todayOrders = todayOrdersBase.map((o: any) => {
        if (o.type === 'kneel') return { ...o, done: kneelToday };
        if (o.type === 'chastity_check') return { ...o, done: chastityStatus === 'approved' ? o.target : 0, status: chastityStatus };
        return o;
    });
    const todayPerfect = vaultData?.today?.perfect ?? false;
    const todayRewardClaimed = vaultData?.today?.reward_claimed ?? false;
    const attnCooldown = attnCooldownUntil > Date.now();
    const chatGateCooldown = chatGateCooldownUntil > Date.now();

    // Restore follow-up overlay + gamble results from localStorage on mount
    useEffect(() => {
        try {
            const savedFU = localStorage.getItem('vault_followup');
            if (savedFU) { setFollowUp(JSON.parse(savedFU)); }
            const savedGamble = localStorage.getItem('vault_gamble_results');
            if (savedGamble) {
                const g = JSON.parse(savedGamble);
                if (g.wheelResult) { setWheelResult(g.wheelResult); setMechDone(true); }
                if (g.diceResult) { setDiceResult(g.diceResult); setMechDone(true); }
                if (g.coinResult) { setCoinResult(g.coinResult); setMechDone(true); }
                if (g.cardResult) { setCardResult(g.cardResult); setMechDone(true); }
                if (g.rouletteResult) { setRouletteResult(g.rouletteResult); setMechDone(true); }
                if (g.greedBusted) { setGreedBusted(true); setMechDone(true); }
                if (g.greedCashedOut) { setGreedCashedOut(true); setGreedCoins(g.greedCoins || 0); setMechDone(true); }
                if (g.truthDareChoice) { setTruthDareChoice(g.truthDareChoice); }
                if (g.simonStep) { setSimonStep(g.simonStep); }
            }
        } catch {}
    }, []);

    // Restore gamble results from server-side order data (survives localStorage clear)
    useEffect(() => {
        if (!vaultData) return;
        const orders = vaultData?.programTasks || (vaultData?.today?.orders ? (typeof vaultData.today.orders === 'string' ? JSON.parse(vaultData.today.orders) : vaultData.today.orders) : []);
        for (const o of orders) {
            if (!o.gambleResult || o.done >= o.target) continue;
            const g = o.gambleResult;
            if (o.type === 'coinflip' && g.coinResult && !coinResult) { setCoinResult(g.coinResult); setMechDone(true); }
            if (o.type === 'dice_roll' && g.diceResult && !diceResult) { setDiceResult(g.diceResult); setMechDone(true); }
            if (o.type === 'spin_wheel' && g.wheelResult && !wheelResult) { setWheelResult(g.wheelResult); setMechDone(true); }
            if (o.type === 'card_pick' && g.cardResult && !cardResult) { setCardResult(g.cardResult); setMechDone(true); }
            if (o.type === 'russian_roulette' && g.rouletteResult && !rouletteResult) { setRouletteResult(g.rouletteResult); setMechDone(true); }
            if (o.type === 'greed_game' && g.greedBusted) { setGreedBusted(true); setMechDone(true); }
            if (o.type === 'greed_game' && g.greedCashedOut) { setGreedCashedOut(true); setGreedCoins(g.greedCoins || 0); setMechDone(true); }
            if (o.type === 'truth_dare' && g.truthDareChoice && !truthDareChoice) { setTruthDareChoice(g.truthDareChoice); }
            if (o.type === 'simon_says' && g.simonStep) { setSimonStep(g.simonStep); }
        }
    }, [vaultData]);

    // Persist follow-up overlay to localStorage
    useEffect(() => {
        try {
            if (followUp) localStorage.setItem('vault_followup', JSON.stringify(followUp));
            else localStorage.removeItem('vault_followup');
        } catch {}
    }, [followUp]);

    // Restore cooldowns from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem('vault_cooldowns');
            if (stored) {
                const cd = JSON.parse(stored);
                const now = Date.now();
                if (cd.attn && cd.attn > now) { setAttnCooldownUntil(cd.attn); setAttnSkippedToday(true); }
                if (cd.gate && cd.gate > now) setChatGateCooldownUntil(cd.gate);
                if (cd.penalty) setPenaltyHours(cd.penalty);
                if (cd.reward && cd.reward > now) setRewardUntil(cd.reward);
            }
        } catch {}
    }, []);

    // Persist cooldowns to localStorage whenever they change
    useEffect(() => {
        try {
            localStorage.setItem('vault_cooldowns', JSON.stringify({
                attn: attnCooldownUntil,
                gate: chatGateCooldownUntil,
                penalty: penaltyHours,
                reward: rewardUntil,
            }));
        } catch {}
    }, [attnCooldownUntil, chatGateCooldownUntil, penaltyHours, rewardUntil]);

    useEffect(() => {
        if (!vaultData?.session?.started_at) return;
        const lockStart = vaultData.session.started_at;
        const lockEnd = vaultData.session.expires_at || new Date(Date.now() + 86400000).toISOString();
        const iv = setInterval(() => {
            setElapsed(fmt(Date.now() - new Date(lockStart).getTime()));
            setRemaining(fmt(new Date(lockEnd).getTime() - Date.now()));
        }, 1000);
        return () => clearInterval(iv);
    }, [vaultData]);

    useEffect(() => {
        const iv = setInterval(() => setSanity(p => Math.min(100, p + 0.03)), 5000);
        return () => clearInterval(iv);
    }, []);

    // Update chastity window every minute — pure local time math, no server call
    useEffect(() => {
        const update = () => {
            try {
                const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                const now = new Date();
                const h = parseInt(new Intl.DateTimeFormat('en', { timeZone: tz, hour: '2-digit', hour12: false }).format(now), 10);
                const m = parseInt(new Intl.DateTimeFormat('en', { timeZone: tz, minute: '2-digit' }).format(now), 10);
                setChastityWindow({ open: h >= 6 && h < 10, before: h < 6, localHour: h, localMinute: m });
            } catch {}
        };
        const iv = setInterval(update, 60000);
        return () => clearInterval(iv);
    }, []);

    // Init profile state from real DB + tribute system
    useEffect(() => {
        const _splashStart = Date.now();
        // Use data pre-loaded by /profile splash (already in state via _initCache)
        const _cachedProfile = _initCache.profile;
        const _cachedSession = _initCache.session;
        const _cachedKneel = _initCache.kneel;
        // Clean up sessionStorage
        try { sessionStorage.removeItem('_vaultProfileCache'); sessionStorage.removeItem('_vaultSessionCache'); sessionStorage.removeItem('_vaultKneelCache'); } catch {}

        const supabase = createClient();
        supabase.auth.getUser().then(({ data: { user } }) => {
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            if (!user && !isLocal) { window.location.href = '/login'; return; }
            const userEmail = user?.email || user?.id || (isLocal ? 'prespamemai@gmail.com' : '');

        const profileReady = _cachedProfile
            ? Promise.resolve(_cachedProfile)
            : fetch('/api/slave-profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: userEmail, full: true }) }).then(r => r.json());

        profileReady
            .then(async (rawData: any) => {
                const data = _cachedProfile ? rawData : {
                    ...(rawData && !rawData.error ? rawData : {}),
                    member_id: rawData?.member_id || user?.email,
                    memberId: user?.id,
                    email: user?.email,
                };
                console.log('[VAULT] Loaded profile:', data);
                // Cache name + avatar for loading screen
                try { if (data.name) localStorage.setItem('_qk_name', data.name); if (data.avatar_url) localStorage.setItem('_qk_avatar', data.avatar_url); } catch {}
                setProfile(data);
                const { initProfileState } = await import('@/scripts/profile-state');
                initProfileState(data);
                const memberId = data.member_id || userEmail;
                (window as any).__vaultMemberId = memberId;

                const { sendChatMessage, handleChatKey, toggleAiMode, sendAiMessage, switchMobChatTab, handleMediaPlus } = await import('@/scripts/profile-logic');
                (window as any).sendChatMessage = sendChatMessage;
                (window as any).handleChatKey = handleChatKey;
                (window as any).toggleAiMode = toggleAiMode;
                (window as any).sendAiMessage = sendAiMessage;
                (window as any).switchMobChatTab = switchMobChatTab;
                (window as any).handleMediaPlus = handleMediaPlus;
                (window as any).handleAiChatKey = (e: any) => { if (e.key === 'Enter') sendAiMessage(); };

                // Load vault session — use cache from /profile splash if available
                const sessionReady = _cachedSession
                    ? Promise.resolve(_cachedSession)
                    : fetch(`/api/vault/session?memberId=${encodeURIComponent(memberId)}&tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`).then(r => r.json());

                sessionReady.then(vd => {
                        console.log('[VAULT] Session data:', vd);
                        if (vd.active) {
                            setVaultData(vd);
                            setPenaltyHours(vd.totalPenaltyHours || 0);
                            // Restore chat cooldown from DB
                            if (vd.chatCooldownUntil) {
                                const cdUntil = new Date(vd.chatCooldownUntil).getTime();
                                if (cdUntil > Date.now()) setChatGateCooldownUntil(cdUntil);
                            }
                            if (vd.todaySpin) { setWheelUsed(true); setWheelResult({ text: vd.todaySpin.result_text, type: vd.todaySpin.result_type }); }
                            const todayTrial = (vd.trials || []).find((t: any) => t.date === vd.todayDate);
                            if (todayTrial && (todayTrial.status === 'submitted' || todayTrial.status === 'approved')) setTrialDone(true);
                            // Check chastity check status for today
                            {
                                const todayOrd = vd.today?.orders ? (typeof vd.today.orders === 'string' ? JSON.parse(vd.today.orders) : vd.today.orders) : [];
                                const cc = todayOrd.find((o: any) => o.type === 'chastity_check');
                                // Read chastity status from vault_check_log table (source of truth)
                                const chk = vd.chastityCheck;
                                if (chk?.status === 'approved') setChastityStatus('approved');
                                else if (chk?.status === 'pending') setChastityStatus('pending');
                                else if (chk?.status === 'rejected') setChastityStatus('rejected');
                                else {
                                    // Fallback: check orders JSON for legacy approved chastity (before vault_check_log existed)
                                    const todayOrd = vd.today?.orders ? (typeof vd.today.orders === 'string' ? JSON.parse(vd.today.orders) : vd.today.orders) : [];
                                    const cc = todayOrd.find((o: any) => o.type === 'chastity_check');
                                    if (cc && cc.done >= cc.target) setChastityStatus('approved');
                                    else setChastityStatus('none');
                                }
                                if (chk?.proof_url) setChastityPhotoUrl(chk.proof_url);
                            }
                            // Chastity window from fresh API (same pattern as routine-status)
                            if (vd.chastityWindow && !_cachedSession) setChastityWindow(vd.chastityWindow);
                            if (_cachedKneel) {
                                if (_cachedKneel.todayKneeling) setKneelToday(_cachedKneel.todayKneeling);
                                if (_cachedKneel.isLocked && _cachedKneel.minLeft > 0) setKneelCooldownUntil(Date.now() + _cachedKneel.minLeft * 60000);
                            } else {
                                fetch(`/api/kneel-status?memberId=${encodeURIComponent(memberId)}&tz=${Intl.DateTimeFormat().resolvedOptions().timeZone}`)
                                    .then(r => r.json())
                                    .then(ks => {
                                        if (ks.todayKneeling) setKneelToday(ks.todayKneeling);
                                        if (ks.isLocked && ks.minLeft > 0) setKneelCooldownUntil(Date.now() + ks.minLeft * 60000);
                                    }).catch(() => {});
                            }
                            fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ensure_today', memberId, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }) })
                                .then(r => r.json())
                                .then(ensureRes => {
                                    if (ensureRes.ended) {
                                        // Chastity check failed — program terminated
                                        try { localStorage.removeItem('vault_cooldowns'); } catch {}
                                        setReleaseOverlay({ reason: 'Chastity check not submitted or approved. Program terminated.' });
                                        return;
                                    }
                                    return fetch(`/api/vault/session?memberId=${encodeURIComponent(memberId)}&tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`)
                                        .then(r2 => r2.json())
                                        .then(vd2 => {
                                            if (vd2.active) {
                                                setVaultData(vd2);
                                                if (vd2.chastityWindow) setChastityWindow(vd2.chastityWindow);
                                                // Re-read chastity status from fresh data
                                                const chk2 = vd2.chastityCheck;
                                                if (chk2?.status === 'approved') setChastityStatus('approved');
                                                else if (chk2?.status === 'pending') setChastityStatus('pending');
                                                else if (chk2?.status === 'rejected') setChastityStatus('rejected');
                                                else {
                                                    // Fallback: check orders JSON for legacy approved chastity
                                                    const freshOrd = vd2.today?.orders ? (typeof vd2.today.orders === 'string' ? JSON.parse(vd2.today.orders) : vd2.today.orders) : [];
                                                    const fcc = freshOrd.find((o: any) => o.type === 'chastity_check');
                                                    if (fcc && fcc.done >= fcc.target) setChastityStatus('approved');
                                                    else setChastityStatus('none');
                                                }
                                                if (chk2?.proof_url) setChastityPhotoUrl(chk2.proof_url);
                                            }
                                        });
                                })
                                .catch(() => {});

                            // Realtime: listen for release/completion — show overlay
                            // Listen on BOTH vault_sessions AND profiles for maximum reliability
                            const rtSub = supabase
                                .channel('vault_release_watch')
                                .on('postgres_changes', {
                                    event: 'UPDATE',
                                    schema: 'public',
                                    table: 'vault_sessions',
                                    filter: `id=eq.${vd.session.id}`,
                                }, (payload: any) => {
                                    const s = payload.new;
                                    if (s.status === 'released_early' || s.status === 'completed' || s.status === 'denied') {
                                        try { localStorage.removeItem('vault_cooldowns'); } catch {}
                                        setReleaseOverlay({ reason: s.release_reason || '' });
                                    }
                                })
                                .subscribe();
                            (window as any)._vaultRtSub = rtSub;

                            // Polling fallback: check session status every 10s (in case Realtime doesn't fire due to RLS)
                            const sessionId = vd.session.id;
                            const releasePoller = setInterval(async () => {
                                try {
                                    const mid = _cachedProfile?.member_id || _cachedProfile?.memberId || '';
                                    if (!mid) return;
                                    const res = await fetch(`/api/vault/session?memberId=${encodeURIComponent(mid)}`);
                                    const data = await res.json();
                                    if (!data.active && data.session?.status) {
                                        const st = data.session.status;
                                        if (st === 'released_early' || st === 'completed' || st === 'denied' || st === 'ended') {
                                            clearInterval(releasePoller);
                                            try { localStorage.removeItem('vault_cooldowns'); } catch {}
                                            setReleaseOverlay({ reason: data.session.release_reason || '' });
                                        }
                                    }
                                } catch {}
                            }, 10000);
                            (window as any)._vaultReleasePoller = releasePoller;

                            // Realtime: listen for Queen's review actions (broadcast from API)
                            if (_cachedProfile?.ID) {
                                const notifySub = supabase
                                    .channel(`vault-notify-${_cachedProfile.ID}`)
                                    .on('broadcast', { event: 'chastity_reviewed' }, (msg: any) => {
                                        const s = msg?.payload?.status;
                                        if (s === 'approved') setChastityStatus('approved');
                                        else if (s === 'rejected') setChastityStatus('rejected');
                                        // Also refresh full vault data so orders/streaks update
                                        const mid = _cachedProfile?.member_id || _cachedProfile?.memberId || '';
                                        if (mid) {
                                            fetch(`/api/vault/session?memberId=${encodeURIComponent(mid)}`).then(r => r.json()).then(vd2 => {
                                                if (vd2.active) setVaultData(vd2);
                                            }).catch(() => {});
                                        }
                                    })
                                    .on('broadcast', { event: 'task_reviewed' }, (msg: any) => {
                                        // Refresh full vault data so submission statuses update
                                        const mid = _cachedProfile?.member_id || _cachedProfile?.memberId || '';
                                        if (mid) {
                                            fetch(`/api/vault/session?memberId=${encodeURIComponent(mid)}`).then(r => r.json()).then(vd2 => {
                                                if (vd2.active) setVaultData(vd2);
                                            }).catch(() => {});
                                        }
                                    })
                                    .subscribe();
                                (window as any)._vaultDailySub = notifySub;
                            }
                        }

                        // ALL state set — NOW dismiss splash
                        if (_cachedProfile) {
                            setLoading(false);
                        } else {
                            const elapsed = Date.now() - _splashStart;
                            const remaining = Math.max(0, 5000 - elapsed);
                            setTimeout(() => setLoading(false), remaining);
                        }
                    })
                    .catch(e => {
                        console.error('[VAULT] Session fetch failed:', e);
                        setLoading(false);
                    });
            })
            .catch(() => { setLoading(false); });
        }).catch(() => { if (!(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) window.location.href = '/login'; });
        import('@/scripts/tribute-game').then(({ bindTributeGame }) => {
            bindTributeGame();
        });
        import('@/scripts/profile-logic').then(({ loadTributes, buyRealCoins }) => {
            loadTributes();
            // Vault mode: wrap render to filter out crowdfund items (gifts only)
            const origRender = (window as any)._renderTributeGridMobile;
            if (origRender) {
                (window as any)._renderTributeGridMobile = (grid: HTMLElement) => {
                    (window as any)._vaultHideCrowdfund = true;
                    origRender(grid);
                    delete (window as any)._vaultHideCrowdfund;
                };
            }
            // Vault boost wallet — show coin packages inline instead of navigating to exchequer
            (window as any)._showBoostWallet = () => {
                const existing = document.getElementById('_vaultBoostOverlay');
                if (existing) existing.remove();
                const R = 'rgba(139,0,0,';
                const pkgs = [
                    { amount: '2,000', price: '€20', coins: 2000 },
                    { amount: '5,500', price: '€50', coins: 5500 },
                    { amount: '12,000', price: '€100', coins: 12000 },
                    { amount: '30,000', price: '€250', coins: 30000 },
                    { amount: '70,000', price: '€500', coins: 70000 },
                    { amount: '150,000', price: '€1,000', coins: 150000 },
                ];
                const overlay = document.createElement('div');
                overlay.id = '_vaultBoostOverlay';
                overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);z-index:2147483647;display:flex;align-items:center;justify-content:center;';
                overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
                const box = document.createElement('div');
                box.style.cssText = 'background:linear-gradient(160deg,#0a0608,#08040a);border:1px solid ' + R + '0.2);border-radius:16px;padding:28px 20px;max-width:340px;width:90%;display:flex;flex-direction:column;align-items:center;gap:14px;box-shadow:0 30px 80px rgba(0,0,0,0.7);';
                box.innerHTML = `
                    <div style="font-family:Cinzel,serif;font-size:0.85rem;color:${R}0.7);letter-spacing:5px;font-weight:700;">BOOST WALLET</div>
                    <div style="width:40px;height:1px;background:linear-gradient(90deg,transparent,${R}0.3),transparent);"></div>
                    <div style="width:100%;display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px;">
                        ${pkgs.map(p => `
                            <button class="_vaultBoostPkg" data-coins="${p.coins}" style="background:${R}0.04);border:1px solid ${R}0.2);border-radius:10px;padding:14px 8px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;transition:all 0.2s;">
                                <span style="font-family:Orbitron,sans-serif;font-size:0.85rem;color:#fff;font-weight:700;">${p.amount}</span>
                                <span style="font-family:Rajdhani,sans-serif;font-size:0.5rem;color:rgba(255,255,255,0.2);letter-spacing:2px;">COINS</span>
                                <span style="font-family:Orbitron,sans-serif;font-size:0.6rem;color:${R}0.6);font-weight:600;margin-top:2px;">${p.price}</span>
                            </button>
                        `).join('')}
                    </div>
                    <button id="_vaultBoostCancel" style="background:none;border:none;color:rgba(255,255,255,0.15);font-family:Rajdhani,sans-serif;font-size:0.6rem;letter-spacing:3px;padding:8px 20px;cursor:pointer;margin-top:4px;">CANCEL</button>
                `;
                overlay.appendChild(box);
                document.body.appendChild(overlay);
                box.querySelector('#_vaultBoostCancel')!.addEventListener('click', () => overlay.remove());
                box.querySelectorAll('._vaultBoostPkg').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const coins = Number((btn as HTMLElement).dataset.coins);
                        overlay.remove();
                        buyRealCoins(coins);
                    });
                });
            };
        });
    }, []);

    // Load chat history once gate is done and chat tab is open (mob_chatContent exists in DOM)
    const chatLoaded = useRef(false);
    useEffect(() => {
        if (!chatGateDone || !profile || chatLoaded.current) return;
        // Small delay to let React render the chat DOM elements
        const t = setTimeout(async () => {
            const chatId = profile.memberId || profile.ID || profile.member_id || '';
            const { loadChatHistory } = await import('@/scripts/profile-logic');
            loadChatHistory(chatId);
            chatLoaded.current = true;
        }, 100);
        return () => clearTimeout(t);
    }, [chatGateDone, profile]);

    // Auto-close chat when time expires
    useEffect(() => {
        if (!chatExpiresAt) return;
        const iv = setInterval(() => {
            if (Date.now() >= chatExpiresAt) {
                clearInterval(iv);
                setChatGateDone(false);
                setChatGateTask(null);
                setChatExpiresAt(0);
                chatLoaded.current = false;
                setTab('vault');
            }
        }, 1000);
        return () => clearInterval(iv);
    }, [chatExpiresAt]);

    const HOLD_TIME = 2000;
    const attnDown = useCallback(() => {
        if (attnCooldown || attnResult) return;
        setAttnHolding(true);
        attnStartTime.current = Date.now();
        attnTimer.current = setInterval(() => {
            const progress = Math.min(1, (Date.now() - attnStartTime.current) / HOLD_TIME);
            setAttnFill(progress * 100);
            if (progress >= 1) {
                if (attnTimer.current) clearInterval(attnTimer.current);
                setAttnHolding(false);
                setAttnFill(0);
                const task = ATTENTION_TASKS[Math.floor(Math.random() * ATTENTION_TASKS.length)];
                setAttnResult(task);
                setAttentionCount(c => c + 1);
                setAttnCooldownUntil(Date.now() + 30000); // 30s cooldown after completing
            }
        }, 30);
    }, [attnCooldown, attnResult]);

    const attnUp = useCallback(() => {
        if (attnTimer.current) clearInterval(attnTimer.current);
        setAttnHolding(false);
        setAttnFill(0);
    }, []);

    const chatGateDown = useCallback(() => {
        if (chatGateTask || chatGateDone || chatGateCooldown) return;
        setChatGateHolding(true);
        chatGateStartTime.current = Date.now();
        chatGateTimer.current = setInterval(() => {
            const progress = Math.min(1, (Date.now() - chatGateStartTime.current) / HOLD_TIME);
            setChatGateFill(progress * 100);
            if (progress >= 1) {
                if (chatGateTimer.current) clearInterval(chatGateTimer.current);
                setChatGateHolding(false);
                setChatGateFill(0);
                const task = ATTENTION_TASKS[Math.floor(Math.random() * ATTENTION_TASKS.length)];
                setChatGateTask(task);
            }
        }, 30);
    }, [chatGateTask, chatGateDone, chatGateCooldown]);

    const chatGateUp = useCallback(() => {
        if (chatGateTimer.current) clearInterval(chatGateTimer.current);
        setChatGateHolding(false);
        setChatGateFill(0);
    }, []);

    // Send attention card to dashboard
    const sendAttentionCard = useCallback((task: typeof ATTENTION_TASKS[0], opts: { completed?: boolean; skipped?: boolean; result?: string } = {}) => {
        const memberId = profile?.member_id || profile?.memberId || '';
        const memberName = profile?.name || '';
        fetch('/api/vault/attention', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                memberId, memberName,
                taskType: task.type,
                taskLabel: task.label,
                completed: opts.completed ?? false,
                skipped: opts.skipped ?? false,
                result: opts.result || null,
            }),
        }).catch(e => console.error('[vault] attention card error:', e));
    }, [profile]);

    // Build vault context string for Vlad
    const buildVaultContext = useCallback(() => {
        const name = profile?.name || '';
        const streak = profile?.parameters?.routine_streak || 0;
        const coins = profile?.wallet ?? 0;
        const cooldownLeft = attnCooldownUntil > Date.now() ? Math.ceil((attnCooldownUntil - Date.now()) / 60000) : 0;
        const lines = [
            `LOCKED MEMBER: ${name}`,
            `DAY: ${daysIn + 1} of ${lockDays} day lock`,
            `CURRENT STREAK: ${streak} perfect days`,
            `COINS: ${coins}`,
            `ATTENTION USES TODAY: ${attentionCount}`,
            attnSkippedToday ? 'JUST SKIPPED/CANCELLED A TASK — perfect obedience is BROKEN today' : 'Perfect obedience still intact',
            cooldownLeft > 0 ? `IN COOLDOWN: ${cooldownLeft} minutes remaining (punished)` : 'No active cooldown',
            chatGateDone ? 'Currently has chat access (earned it)' : 'Chat is LOCKED — hasn\'t earned access yet',
            trialDone ? 'Completed today\'s trial' : 'Has NOT done today\'s trial yet',
            wheelUsed ? `Spun the wheel today — got: "${wheelResult?.text || 'unknown'}"` : 'Has NOT spun the wheel today',
        ];
        return lines.join('\n');
    }, [profile, daysIn, attentionCount, attnSkippedToday, attnCooldownUntil, chatGateDone, trialDone, wheelUsed, wheelResult]);

    // Send message to Vlad
    const sendVladMsg = useCallback(async (msg: string, isAuto = false) => {
        if (vladSending) return;
        const memberId = profile?.member_id || profile?.memberId || profile?.ID || '';
        if (!isAuto) setVladMsgs(prev => [...prev, { role: 'user', text: msg }]);
        setVladSending(true);
        try {
            const res = await fetch('/api/ai-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: msg, memberId, vaultContext: buildVaultContext() }),
            });
            const data = await res.json();
            if (data.success && data.reply) {
                setVladMsgs(prev => [...prev, { role: 'vlad', text: data.reply }]);
                if (!vladOpen) {
                    setVladPulse(true);
                    setVladBubble(data.reply);
                    if (vladBubbleTimer.current) clearTimeout(vladBubbleTimer.current);
                    vladBubbleTimer.current = setTimeout(() => setVladBubble(''), 6000);
                }
            }
        } catch {}
        setVladSending(false);
    }, [vladSending, profile, buildVaultContext, vladOpen]);

    // Auto-trigger Vlad on key events
    const vladReact = useCallback((event: string) => {
        sendVladMsg(`[SYSTEM EVENT — react to this naturally, don't quote it verbatim] ${event}`, true);
    }, [sendVladMsg]);

    // Vlad welcome on first vault arrival (after video submission)
    useEffect(() => {
        if (loading || !profile) return;
        try {
            const first = sessionStorage.getItem('_vaultFirstArrival');
            if (first) {
                sessionStorage.removeItem('_vaultFirstArrival');
                const name = profile?.name || '';
                setTimeout(() => {
                    vladReact(`${name} has just been locked in the vault for the first time. Welcome them to their cage. Be dark, theatrical, slightly menacing but welcoming. This is their first moment inside.`);
                }, 1500);
            }
        } catch {}
    }, [loading, profile, vladReact]);

    // Kneel hold handler
    const KNEEL_HOLD_TIME = 3000; // 3 second hold to kneel
    const kneelDown = useCallback(() => {
        if (kneelCooldown || kneelDone) return;
        setKneelHolding(true);
        kneelStartTime.current = Date.now();
        kneelTimer.current = setInterval(() => {
            const progress = Math.min(1, (Date.now() - kneelStartTime.current) / KNEEL_HOLD_TIME);
            setKneelFill(progress * 100);
            if (progress >= 1) {
                if (kneelTimer.current) clearInterval(kneelTimer.current);
                setKneelHolding(false);
                setKneelFill(0);
                setKneelDone(true);
                setTimeout(() => setKneelDone(false), 2000);
                // Call kneel API
                const memberId = profile?.member_id || profile?.memberId || profile?.ID || '';
                fetch('/api/kneel', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ memberId }),
                }).then(r => r.json()).then(data => {
                    if (data.success) {
                        setKneelToday(data.todayKneeling);
                        // Set cooldown (1h prod, 1m dev)
                        const cooldownMs = process.env.NODE_ENV === 'development' ? 60000 : 3600000;
                        setKneelCooldownUntil(Date.now() + cooldownMs);
                        // Update vault daily order
                        if (vaultData?.session?.id) {
                            fetch('/api/vault/session', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'complete_order', memberId, orderType: 'kneel', amount: 1 }),
                            }).catch(() => {});
                        }
                        const kTarget = todayOrders.find((o: any) => o.type === 'kneel')?.target || 8;
                        vladReact(`Member just completed kneeling session #${data.todayKneeling} today. ${data.todayKneeling >= kTarget ? 'They hit the daily target!' : `${kTarget - data.todayKneeling} more to go.`}`);
                    } else if (data.error === 'COOLDOWN') {
                        setKneelCooldownUntil(Date.now() + data.minLeft * 60000);
                    }
                }).catch(() => {});
            }
        }, 30);
    }, [kneelCooldown, kneelDone, profile, vaultData, vladReact]);

    const kneelUp = useCallback(() => {
        if (kneelTimer.current) clearInterval(kneelTimer.current);
        setKneelHolding(false);
        setKneelFill(0);
    }, []);

    const spin = useCallback(() => {
        if (spinning || wheelUsed) return;
        setSpinning(true); setWheelResult(null);
        const idx = Math.floor(Math.random() * WHEEL.length);
        const seg = 360 / WHEEL.length;
        setWheelAngle(prev => prev + 360 * 5 + (360 - idx * seg - seg / 2));
        setTimeout(() => {
            setWheelResult(WHEEL[idx]); setSpinning(false); setWheelUsed(true);
            vladReact(`Member spun the MAIN temptation wheel and got: "${WHEEL[idx].text}" (${WHEEL[idx].type}). React to this result.`);
            // Record spin in DB
            if (vaultData?.session?.id) {
                fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'spin', memberId: profile?.member_id || profile?.memberId || '', resultText: WHEEL[idx].text, resultType: WHEEL[idx].type }) }).catch(() => {});
            }
        }, 4000);
    }, [spinning, wheelUsed, vladReact]);

    // Cancel/skip attention result — show shame, then 5h cooldown
    const cancelAttn = useCallback(() => {
        if (attnResult) sendAttentionCard(attnResult, { skipped: true });
        setCancelShame('attn');
        vladReact(`Member just CANCELLED/SKIPPED their attention task "${attnResult?.label}". They gave up. 5 hour punishment incoming.`);
        setTimeout(() => {
            setCancelShame(null);
            setAttnSkippedToday(true);
            const cooldownEnd = Date.now() + 5 * 60 * 60 * 1000;
            setAttnCooldownUntil(cooldownEnd);
            setChatGateCooldownUntil(cooldownEnd);
            setAttnResult(null); setAttnProofUploaded(false); setAttnSpinResult(null);
        }, 3500);
    }, [attnResult, sendAttentionCard, vladReact]);

    // Cancel chat gate task — show shame, then 5h lockout + back to vault
    const cancelChatGate = useCallback(() => {
        if (chatGateTask) sendAttentionCard(chatGateTask, { skipped: true });
        setCancelShame('gate');
        vladReact(`Member tried to enter chat but CANCELLED the gate task "${chatGateTask?.label}". Couldn't handle it. 5 hour lockout.`);
        setTimeout(() => {
            setCancelShame(null);
            setChatGateTask(null);
            setChatGateProofUploaded(false);
            setChatGateSpinResult(null);
            setChatGateSpinning(false);
            setChatGateFlipState('idle');
            setChatGateWaitTotal(0);
            setChatGateWaitLeft(0);
            setChatGateConfessText('');
            setAttnSkippedToday(true);
            const cooldownEnd = Date.now() + 5 * 60 * 60 * 1000;
            setAttnCooldownUntil(cooldownEnd);
            setChatGateCooldownUntil(cooldownEnd);
            setTab('vault');
        }, 3500);
    }, [chatGateTask, sendAttentionCard, vladReact]);

    // Scroll vlad chat to bottom
    useEffect(() => {
        if (vladScrollRef.current) vladScrollRef.current.scrollTop = vladScrollRef.current.scrollHeight;
    }, [vladMsgs]);

    // Vlad reacts when attention task is assigned
    const prevAttnResult = useRef<typeof ATTENTION_TASKS[0] | null>(null);
    useEffect(() => {
        if (attnResult && attnResult !== prevAttnResult.current) {
            vladReact(`Queen just assigned attention task: "${attnResult.label}" — ${attnResult.desc}. Comment on what they have to do.`);
        }
        prevAttnResult.current = attnResult;
    }, [attnResult, vladReact]);

    // Vlad reacts when chat gate task is assigned
    const prevGateTask = useRef<typeof ATTENTION_TASKS[0] | null>(null);
    useEffect(() => {
        if (chatGateTask && chatGateTask !== prevGateTask.current) {
            vladReact(`Member tried to enter chat and got gate task: "${chatGateTask.label}" — ${chatGateTask.desc}. They have to do this before they can talk to Queen.`);
        }
        prevGateTask.current = chatGateTask;
    }, [chatGateTask, vladReact]);

    // Vlad reacts when trial is submitted
    const prevTrialDone = useRef(false);
    useEffect(() => {
        if (trialDone && !prevTrialDone.current) {
            vladReact('Member just submitted their daily trial writing. Acknowledge the effort.');
        }
        prevTrialDone.current = trialDone;
    }, [trialDone, vladReact]);

    // Vlad reacts when beg is sent
    const prevBegSent = useRef(false);
    useEffect(() => {
        if (begSent && !prevBegSent.current) {
            vladReact('Member just sent a BEG FOR RELEASE request to Queen. They\'re cracking. Mock them for begging.');
        }
        prevBegSent.current = begSent;
    }, [begSent, vladReact]);

    // Vlad reacts when chat gate coinflip lands
    const prevFlipState = useRef<string>('idle');
    useEffect(() => {
        if (chatGateFlipState === 'heads' && prevFlipState.current !== 'heads') {
            vladReact('Member got HEADS on the coin flip — they lucked into chat access. React to their luck.');
        } else if (chatGateFlipState === 'tails' && prevFlipState.current !== 'tails') {
            vladReact('Member got TAILS on the coin flip — DENIED and locked out 5 minutes. Laugh at them.');
        }
        prevFlipState.current = chatGateFlipState;
    }, [chatGateFlipState, vladReact]);

    // Vlad reacts when member tries chat tab during cooldown
    const prevTab = useRef(tab);
    useEffect(() => {
        // Close tribute overlay on any tab change
        (window as any).closeStandaloneTribute?.();
        if (tab === 'chat' && prevTab.current !== 'chat' && chatGateCooldown) {
            vladReact('Member just tried to open the chat tab but they\'re in COOLDOWN. They can see the timer ticking. Mock their impatience.');
        }
        prevTab.current = tab;
    }, [tab, chatGateCooldown, vladReact]);

    // No splash — profile page splash already covered the loading
    if (loading) return <div style={{ height: '100dvh', width: '100vw', background: '#050508' }} />;

    // ── Release overlay — inescapable, shown when Queen unlocks ──
    if (releaseOverlay) return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2147483647, background: 'linear-gradient(180deg, #050508 0%, #0a0008 50%, #050508 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
            <div style={{ width: 48, height: 1, background: 'rgba(139,0,0,0.4)', marginBottom: 32 }} />
            <div style={{ fontFamily: "'Cinzel', serif", fontSize: '1.1rem', color: 'rgba(139,0,0,0.9)', letterSpacing: 6, fontWeight: 700, textAlign: 'center', marginBottom: 16 }}>LOCK RELEASED</div>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 32 }}>Message from Queen Karin</div>
            {releaseOverlay.reason && (
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', textAlign: 'center', maxWidth: 320, lineHeight: 1.6, marginBottom: 40, fontStyle: 'italic' }}>
                    &ldquo;{releaseOverlay.reason}&rdquo;
                </div>
            )}
            {!releaseOverlay.reason && (
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', textAlign: 'center', maxWidth: 320, lineHeight: 1.6, marginBottom: 40 }}>
                    Your sentence has ended. You are free to go.
                </div>
            )}
            <div style={{ width: 48, height: 1, background: 'rgba(139,0,0,0.2)', marginBottom: 40 }} />
            <button onClick={() => { window.location.href = '/profile'; }} style={{ padding: '14px 40px', background: 'none', border: '1px solid rgba(139,0,0,0.4)', borderRadius: 6, color: 'rgba(139,0,0,0.9)', fontFamily: "'Cinzel', serif", fontSize: '0.55rem', letterSpacing: 4, cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.3s' }}>
                THANK YOU QUEEN KARIN
            </button>
        </div>
    );

    // ── Pressure: actual percentage based on days elapsed vs total ──
    const pressurePct = Math.min(100, Math.round((daysIn / Math.max(lockDays, 1)) * 100));

    return (
        <div style={{ background: '#080810', minHeight: '100vh', maxWidth: 480, margin: '0 auto', position: 'relative', overflow: 'hidden' }}>

            {/* BG — queen photo + layered red glow */}
            <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -50, left: -50, right: -50, bottom: -50, background: "url('/queen-bg-mobile.jpg') center 20%/cover no-repeat", opacity: 0.5, filter: 'saturate(0.4)' }} />
            </div>
            <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, background: 'linear-gradient(180deg, rgba(8,8,16,0.1) 0%, rgba(8,8,16,0.55) 60%, rgba(8,8,16,0.85) 100%)' }} />

            {/* ══════════════════════════════════════════════
                VAULT TAB — main scroll
            ══════════════════════════════════════════════ */}
            <div style={{ display: tab === 'vault' ? 'flex' : 'none', flexDirection: 'column', alignItems: 'center', paddingBottom: 100, position: 'relative', zIndex: 1, minHeight: '100vh' }}>

                {/* ── HALO HERO SECTION ── */}
                {(() => {
                    const hasChastityTask = todayOrders.some((o: any) => o.type === 'chastity_check') && daysIn >= 1;
                    const cWindowOpen = chastityWindow.open;
                    const cBeforeWindow = chastityWindow.before;
                    const cMissed = !cWindowOpen && !cBeforeWindow && chastityStatus === 'none' && hasChastityTask;
                    const cMinsLeft = cWindowOpen ? (10 - chastityWindow.localHour) * 60 - chastityWindow.localMinute : 0;
                    const cCanUpload = hasChastityTask && (cWindowOpen || chastityStatus === 'rejected') && chastityStatus !== 'pending' && chastityStatus !== 'approved';

                    // Color scheme based on chastity status
                    const borderColor = !hasChastityTask ? '#a01020'
                        : chastityStatus === 'approved' ? 'rgba(197,160,89,0.8)'
                        : chastityStatus === 'pending' ? 'rgba(197,160,89,0.6)'
                        : chastityStatus === 'rejected' ? 'rgba(255,50,50,0.6)'
                        : cWindowOpen ? '#a01020'
                        : 'rgba(80,60,60,0.5)';
                    const glowColor = !hasChastityTask ? '0 0 60px rgba(160,16,32,0.3), 0 0 120px rgba(139,0,0,0.15), inset 0 0 30px rgba(139,0,0,0.2)'
                        : chastityStatus === 'approved' ? '0 0 60px rgba(197,160,89,0.25), 0 0 120px rgba(197,160,89,0.1), inset 0 0 30px rgba(197,160,89,0.15)'
                        : chastityStatus === 'pending' ? '0 0 60px rgba(197,160,89,0.2), 0 0 100px rgba(197,160,89,0.08), inset 0 0 25px rgba(197,160,89,0.1)'
                        : chastityStatus === 'rejected' ? '0 0 60px rgba(255,50,50,0.2), inset 0 0 30px rgba(255,50,50,0.1)'
                        : '0 0 60px rgba(160,16,32,0.3), 0 0 120px rgba(139,0,0,0.15), inset 0 0 30px rgba(139,0,0,0.2)';
                    const lockStroke = !hasChastityTask ? 'rgba(180,30,30,0.7)'
                        : chastityStatus === 'approved' ? 'rgba(197,160,89,0.8)'
                        : chastityStatus === 'pending' ? 'rgba(197,160,89,0.6)'
                        : 'rgba(180,30,30,0.7)';
                    const sealedColor = !hasChastityTask ? '#c03030'
                        : chastityStatus === 'approved' ? 'rgba(197,160,89,0.85)'
                        : chastityStatus === 'pending' ? 'rgba(197,160,89,0.65)'
                        : '#c03030';

                    return (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px 0' }}>

                    {/* Concentric rings — outermost */}
                    <div style={{
                        position: 'relative', zIndex: 1,
                        width: 380, height: 380, borderRadius: '50%',
                        border: `1px solid ${borderColor}15`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'border-color 0.6s ease',
                    }}>
                    {/* Middle ring */}
                    <div style={{
                        position: 'relative',
                        width: 360, height: 360, borderRadius: '50%',
                        border: `1px solid ${borderColor}30`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'border-color 0.6s ease',
                    }}>
                    {/* Main circle */}
                    <div style={{
                        position: 'relative', zIndex: 2,
                        width: 340, height: 340, borderRadius: '50%',
                        border: `2px solid ${borderColor}`,
                        boxShadow: glowColor,
                        background: '#000',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: 0, overflow: 'hidden',
                        transition: 'border-color 0.6s ease, box-shadow 0.6s ease',
                    }}>
                        {/* Background: chastity photo (day 2+) or video thumbnail (day 1) */}
                        {(() => {
                            const bgUrl = chastityPhotoUrl && (chastityStatus === 'pending' || chastityStatus === 'approved')
                                ? chastityPhotoUrl
                                : daysIn === 0
                                    ? (vaultData?.session?.video_thumb_url || vaultData?.session?.video_proof_url || null)
                                    : null;
                            if (!bgUrl) return null;
                            const isVideo = daysIn === 0 && bgUrl === vaultData?.session?.video_proof_url && !vaultData?.session?.video_thumb_url;
                            return isVideo ? (
                                <video src={bgUrl} muted playsInline autoPlay loop style={{
                                    position: 'absolute', inset: 0, width: '100%', height: '100%',
                                    objectFit: 'cover', borderRadius: '50%',
                                    opacity: 0.45, filter: 'blur(0.5px)',
                                }} />
                            ) : (
                                <div style={{
                                    position: 'absolute', inset: 0, borderRadius: '50%',
                                    backgroundImage: `url(${bgUrl})`,
                                    backgroundSize: 'cover', backgroundPosition: 'center',
                                    opacity: chastityStatus === 'approved' ? 0.5 : 0.45,
                                    filter: 'blur(0.5px)',
                                    transition: 'opacity 0.6s ease',
                                }} />
                            );
                        })()}

                        {/* Lock icon */}
                        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke={lockStroke} strokeWidth="1.5" style={{ marginBottom: 8, position: 'relative', zIndex: 1, transition: 'stroke 0.6s ease' }}>
                            <rect x="3" y="11" width="18" height="11" rx="2" />
                            <path d="M7 11V7a5 5 0 0110 0v4" />
                            <circle cx="12" cy="16" r="1.5" fill={lockStroke} />
                        </svg>

                        {/* Name */}
                        <div style={{
                            fontFamily: 'Cinzel, serif', fontSize: '1.6rem', color: '#fff',
                            textTransform: 'uppercase', letterSpacing: '2px',
                            textShadow: chastityStatus === 'approved' ? '0 0 20px rgba(197,160,89,0.3)' : '0 0 20px rgba(139,0,0,0.3)',
                            lineHeight: 1, textAlign: 'center', maxWidth: '85%',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            marginBottom: 5, position: 'relative', zIndex: 1,
                        }}>
                            {profile?.name || ''}
                        </div>

                        {/* Rank / Status */}
                        <div style={{
                            fontFamily: 'Orbitron, sans-serif', fontSize: '0.75rem',
                            color: sealedColor, letterSpacing: '4px', textTransform: 'uppercase',
                            textShadow: `0 0 12px ${sealedColor}40`,
                            position: 'relative', zIndex: 1,
                            transition: 'color 0.6s ease',
                        }}>
                            SEALED
                        </div>

                        {/* Chastity status badge inside circle */}
                        {hasChastityTask && (
                            <div style={{
                                position: 'relative', zIndex: 1, marginTop: 6,
                                fontFamily: 'Orbitron, sans-serif', fontSize: '0.5rem', letterSpacing: '2px',
                                color: chastityStatus === 'approved' ? 'rgba(197,160,89,0.9)'
                                    : chastityStatus === 'pending' ? 'rgba(197,160,89,0.7)'
                                    : chastityStatus === 'rejected' ? 'rgba(255,60,60,0.7)'
                                    : cMissed ? 'rgba(255,60,60,0.5)'
                                    : cBeforeWindow ? 'rgba(255,255,255,0.25)'
                                    : cWindowOpen ? `${R}0.6)`
                                    : 'rgba(255,255,255,0.2)',
                                padding: '3px 10px', borderRadius: 12,
                                background: chastityStatus === 'approved' ? 'rgba(197,160,89,0.1)'
                                    : chastityStatus === 'pending' ? 'rgba(197,160,89,0.08)'
                                    : chastityStatus === 'rejected' ? 'rgba(255,60,60,0.08)'
                                    : 'rgba(255,255,255,0.03)',
                                animation: chastityStatus === 'pending' ? 'vPulse 2s ease infinite' : cWindowOpen && chastityStatus === 'none' ? 'vPulse 2s ease infinite' : 'none',
                            }}>
                                {chastityStatus === 'approved' ? '✓ VERIFIED'
                                    : chastityStatus === 'pending' ? '⏳ AWAITING REVIEW'
                                    : chastityStatus === 'rejected' ? '✕ REJECTED'
                                    : cMissed ? '✕ MISSED'
                                    : cBeforeWindow ? 'CHECK OPENS 6 AM'
                                    : cWindowOpen ? `CHECK · ${cMinsLeft}MIN LEFT`
                                    : ''}
                            </div>
                        )}

                        {/* Lock calendar — one lock per day of sentence */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${Math.min(lockDays, 7)}, 1fr)`,
                            gap: lockDays > 30 ? 4 : 6,
                            width: '82%',
                            marginTop: 14, marginBottom: 10,
                        }}>
                            {Array.from({ length: lockDays }).map((_, i) => {
                                const isToday = i === daysIn;
                                const isPast = i < daysIn;
                                const obedient = isPast ? (dailyRecords[i]?.perfect ?? undefined) : undefined;
                                const clickable = isPast || isToday;
                                const dayLog = dailyRecords[i] ? _toDayLog(dailyRecords[i]) : null;
                                const lockSize = lockDays > 30 ? 14 : lockDays > 14 ? 18 : 22;

                                // Colors per state
                                const fill = isToday
                                    ? 'rgba(197,160,89,0.7)'
                                    : obedient === true
                                        ? 'rgba(139,0,0,0.85)'
                                        : obedient === false
                                            ? 'rgba(255,40,40,0.15)'
                                            : 'rgba(255,255,255,0.05)';
                                const stroke = isToday
                                    ? 'rgba(197,160,89,0.9)'
                                    : obedient === true
                                        ? 'rgba(180,60,60,0.7)'
                                        : obedient === false
                                            ? 'rgba(255,40,40,0.3)'
                                            : 'rgba(255,255,255,0.08)';
                                const glow = isToday
                                    ? '0 0 8px rgba(197,160,89,0.5)'
                                    : obedient === true
                                        ? '0 0 6px rgba(139,0,0,0.4)'
                                        : 'none';

                                return (
                                    <div key={i}
                                        onClick={clickable && dayLog ? () => setSelectedDay(dayLog) : undefined}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: clickable && dayLog ? 'pointer' : 'default',
                                            filter: isToday ? 'drop-shadow(0 0 4px rgba(197,160,89,0.4))' : obedient === true ? 'drop-shadow(0 0 3px rgba(139,0,0,0.3))' : 'none',
                                            animation: isToday ? 'vPulse 2s ease-in-out infinite' : 'none',
                                            transition: 'all 0.3s ease',
                                        }}
                                    >
                                        {obedient === false ? (
                                            /* Unlocked / broken lock for failed days */
                                            <svg width={lockSize} height={lockSize} viewBox="0 0 24 24" fill="none">
                                                <rect x="3" y="11" width="18" height="11" rx="2" fill={fill} stroke={stroke} strokeWidth="1.5" />
                                                <path d="M7 11V7a5 5 0 0 1 9.9-1" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
                                                <circle cx="12" cy="16" r="1.5" fill={stroke} />
                                            </svg>
                                        ) : (
                                            /* Closed lock for obedient / today / future */
                                            <svg width={lockSize} height={lockSize} viewBox="0 0 24 24" fill="none">
                                                <rect x="3" y="11" width="18" height="11" rx="2" fill={fill} stroke={stroke} strokeWidth="1.5" />
                                                <path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none" stroke={stroke} strokeWidth="1.5" />
                                                <circle cx="12" cy="16" r="1.5" fill={stroke} />
                                            </svg>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Chastity upload button inside circle */}
                        {cCanUpload && (
                            chastityUploading ? (
                                <div style={{
                                    position: 'relative', zIndex: 1, marginTop: 4,
                                    fontFamily: 'Orbitron, sans-serif', fontSize: '0.6rem', letterSpacing: '2px',
                                    color: 'rgba(197,160,89,0.6)', display: 'flex', alignItems: 'center', gap: 6,
                                    animation: 'vPulse 1s ease infinite',
                                }}>
                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="rgba(197,160,89,0.5)" strokeWidth="2" strokeLinecap="round" style={{ animation: 'vSpin 1s linear infinite' }}>
                                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                    </svg>
                                    UPLOADING...
                                </div>
                            ) : (
                                <label style={{
                                    position: 'relative', zIndex: 1, marginTop: 6,
                                    display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                                    fontFamily: 'Orbitron, sans-serif', fontSize: '0.6rem', letterSpacing: '2px',
                                    color: chastityStatus === 'rejected' ? 'rgba(255,200,200,0.8)' : `${R}0.8)`,
                                    background: chastityStatus === 'rejected' ? 'rgba(255,60,60,0.12)' : `${R}0.12)`,
                                    border: `1px solid ${chastityStatus === 'rejected' ? 'rgba(255,60,60,0.3)' : `${R}0.35)`}`,
                                    borderRadius: 20, padding: '6px 14px',
                                    WebkitTapHighlightColor: 'transparent',
                                }}>
                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                        <circle cx="12" cy="13" r="4" />
                                    </svg>
                                    {chastityStatus === 'rejected' ? 'RETRY' : 'SUBMIT CHECK'}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        style={{ display: 'none' }}
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            e.target.value = '';
                                            setChastityUploading(true);
                                            try {
                                                const mid = profile?.member_id || profile?.memberId || '';
                                                const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
                                                const fd = new FormData();
                                                fd.append('file', file);
                                                fd.append('folder', `vault/chastity/${mid}`);
                                                fd.append('ext', ext === 'heic' ? 'jpg' : ext);
                                                const res = await fetch('/api/upload', { method: 'POST', body: fd });
                                                const data = await res.json();
                                                if (data.url && vaultData?.session?.id) {
                                                    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                                                    // Submit to vault_daily via complete_order (stores in orders JSON + submissions)
                                                    const submitRes = await fetch('/api/vault/session', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ action: 'complete_order', memberId: mid, orderType: 'chastity_check', photoUrl: data.url, tz }),
                                                    });
                                                    if (submitRes.ok) {
                                                        setChastityStatus('pending');
                                                        setChastityPhotoUrl(data.url);
                                                        vladReact('Member just submitted their daily chastity check photo. Good boy — or is he hiding something?');
                                                    } else {
                                                        const err = await submitRes.json().catch(() => ({}));
                                                        if (err.windowClosed) setChastityWindow(w => ({ ...w, open: false, before: false }));
                                                    }
                                                }
                                            } catch {} finally {
                                                setChastityUploading(false);
                                            }
                                        }}
                                    />
                                </label>
                            )
                        )}
                    </div>
                    {/* Close middle ring */}
                    </div>
                    {/* Close outer ring */}
                    </div>

                    {/* Stats pill — overlapping the circle (matches profile layout) */}
                    <div style={{
                        position: 'relative', zIndex: 3,
                        marginTop: -55, width: '94%',
                        background: 'rgba(18,12,14,0.92)',
                        border: `1px solid ${hasChastityTask && chastityStatus === 'approved' ? 'rgba(197,160,89,0.2)' : hasChastityTask && chastityStatus === 'pending' ? 'rgba(197,160,89,0.15)' : 'rgba(160,20,20,0.25)'}`,
                        borderRadius: 12, padding: '16px 10px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.8), 0 0 20px rgba(139,0,0,0.06)',
                        marginBottom: 30,
                        transition: 'border-color 0.6s ease',
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: '45%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                <span id="vaultMerit" style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(1.2rem, 5vw, 1.5rem)', color: '#fff', fontWeight: 800, lineHeight: 1 }}>{profile?.score ?? 0}</span>
                                <svg width="24" height="24" viewBox="0 0 512 512" fill="#8b0000" style={{ opacity: 0.8 }}><path d="M256 0c17.7 0 32.5 11.5 37.6 28.5l25.6 85.3 89.6-16.4c16.2-3 32.8 5.7 39.5 20.9s1.3 33-12.7 44.5l-69.8 57.6 44.8 80.1c8.4 15 3.9 34.3-10.3 43.6s-32.5 6.4-44.5-6.7L256 270 156.2 337.4c-12 13.1-30.3 16-44.5 6.7s-18.7-28.6-10.3-43.6l44.8-80.1-69.8-57.6c-14-11.5-19.4-30.6-12.7-44.5s23.3-23.9 39.5-20.9l89.6 16.4 25.6-85.3C223.5 11.5 238.3 0 256 0zm0 432c-15.1 0-29.3 6.9-38.6 18.6l-50 62.5c-11.1 13.9-6.9 34.4 7 45.5s34.4 6.9 45.5-7l36.1-45.1 36.1 45.1c11.1 13.9 31.6 18.1 45.5 7s18.1-31.6 7-45.5l-50-62.5c-9.3-11.7-23.5-18.6-38.6-18.6z" /></svg>
                            </div>
                            <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.75rem', color: 'rgba(180,40,40,0.65)', letterSpacing: '2px' }}>MERIT</span>
                        </div>
                        <div style={{ width: 1, height: 50, background: 'rgba(139,0,0,0.15)' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: '45%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                <span id="vaultCoins" style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(1.2rem, 5vw, 1.5rem)', color: '#fff', fontWeight: 800, lineHeight: 1 }}>{profile?.wallet ?? 0}</span>
                                <svg width="24" height="24" viewBox="0 0 512 512" fill="#a01020"><path d="M512 80c0 18-14.3 34.6-38.4 48c-29.1 16.1-72.5 27.5-122.3 30.9c-3.7-1.8-7.4-3.5-11.3-5C300.6 137.4 248.2 128 192 128c-8.3 0-16.4 .2-24.5 .6l-1.1-.6C142.3 114.6 128 98 128 80c0-44.2 86-80 192-80S512 35.8 512 80zM160.7 161.1c10.2-.7 20.7-1.1 31.3-1.1c62.2 0 117.4 12.3 152.5 31.4C369.3 210.6 384 227.2 384 245.6c0 11.4-5.5 22.1-15.2 31.4c-21.2 20.4-66.2 34.1-118.4 34.9c-10.2 .2-20.7 .3-31.3 .3c-62.2 0-117.4-12.3-152.5-31.4C42.7 261.4 28 244.8 28 226.4c0-11.4 5.5-22.1 15.2-31.4c21.2-20.4 66.2-34.1 117.5-33.9z" /></svg>
                            </div>
                            <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.75rem', color: 'rgba(180,40,40,0.65)', letterSpacing: '2px' }}>COINS</span>
                        </div>
                    </div>
                </div>
                    );
                })()}

                {/* ── RELEASE COUNTDOWN — full-width hero panel ── */}
                <div style={{
                    width: '100%', padding: '0 16px', marginBottom: 8,
                }}>
                    <div style={{
                        width: '100%', borderRadius: 16, padding: '28px 20px 24px',
                        background: 'rgba(139,0,0,0.04)',
                        border: `1px solid ${R}0.12)`,
                        backdropFilter: 'blur(12px)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                    }}>
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', letterSpacing: '6px', marginBottom: 4 }}>RELEASE IN</div>
                        {penaltyHours > 0 && (
                            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.65rem', color: 'rgba(255,40,40,0.5)', letterSpacing: '2px', marginBottom: 8 }}>
                                +{penaltyHours}h ADDED
                            </div>
                        )}
                        <div style={{ display: 'flex', width: '100%', gap: 8, marginTop: 8 }}>
                            <div style={{
                                flex: 1, borderRadius: 12, padding: '18px 0',
                                background: 'rgba(0,0,0,0.4)', border: `1px solid ${R}0.15)`,
                                textAlign: 'center',
                            }}>
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '2rem', color: '#fff', fontWeight: 800, lineHeight: 1, textShadow: '0 0 20px rgba(139,0,0,0.3)' }}>
                                    {String(remaining.d).padStart(2, '0')}
                                </div>
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '3px', marginTop: 6 }}>DAYS</div>
                            </div>
                            <div style={{
                                flex: 1, borderRadius: 12, padding: '18px 0',
                                background: 'rgba(0,0,0,0.4)', border: `1px solid ${R}0.15)`,
                                textAlign: 'center',
                            }}>
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '2rem', color: '#fff', fontWeight: 800, lineHeight: 1, textShadow: '0 0 20px rgba(139,0,0,0.3)' }}>
                                    {String(remaining.h).padStart(2, '0')}
                                </div>
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '3px', marginTop: 6 }}>HRS</div>
                            </div>
                            <div style={{
                                flex: 1, borderRadius: 12, padding: '18px 0',
                                background: 'rgba(0,0,0,0.4)', border: `1px solid ${R}0.15)`,
                                textAlign: 'center',
                            }}>
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '2rem', color: '#fff', fontWeight: 800, lineHeight: 1, textShadow: '0 0 20px rgba(139,0,0,0.3)' }}>
                                    {String(remaining.m).padStart(2, '0')}
                                </div>
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '3px', marginTop: 6 }}>MIN</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── KNEEL BAR ── */}
                <div style={{ width: '100%', padding: '32px 20px 16px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '100%', maxWidth: 360, position: 'relative' }}>
                        <div
                            onPointerDown={kneelDown}
                            onPointerUp={kneelUp}
                            onPointerLeave={kneelUp}
                            onPointerCancel={kneelUp}
                            onContextMenu={(e) => e.preventDefault()}
                            style={{
                                position: 'relative', width: '100%', height: 56, borderRadius: 28,
                                background: kneelDone ? 'rgba(80,200,120,0.08)' : `${R}0.08)`,
                                border: `1.5px solid ${kneelDone ? 'rgba(80,200,120,0.4)' : `${R}${kneelHolding ? '0.5' : '0.25'})`}`,
                                overflow: 'hidden', cursor: kneelCooldown ? 'default' : 'pointer',
                                boxShadow: kneelHolding ? `0 0 20px ${R}0.2)` : kneelDone ? '0 0 20px rgba(80,200,120,0.1)' : 'none',
                                transition: 'border-color 0.3s, box-shadow 0.3s, background 0.3s',
                                WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none',
                            } as React.CSSProperties}
                        >
                            {/* Fill bar */}
                            <div style={{
                                position: 'absolute', left: 0, top: 0, bottom: 0,
                                width: `${kneelFill}%`,
                                background: `linear-gradient(90deg, ${R}0.15), ${R}0.35))`,
                                borderRadius: 26, transition: kneelHolding ? 'none' : 'width 0.2s',
                            }} />
                            {/* Content */}
                            <div style={{
                                position: 'relative', zIndex: 1, width: '100%', height: '100%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                            }}>
                                {/* Kneeling person icon */}
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={kneelDone ? 'rgba(80,200,120,0.5)' : `${R}${kneelCooldown ? '0.2' : '0.6'})`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="4" r="2" />
                                    <path d="M12 6v6l-3 4" />
                                    <path d="M12 12l3 4" />
                                    <path d="M9 10l-2 1" />
                                    <path d="M15 10l2 1" />
                                </svg>
                                <span style={{
                                    fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem',
                                    letterSpacing: '4px',
                                    color: kneelDone ? 'rgba(80,200,120,0.6)' : kneelCooldown ? 'rgba(255,255,255,0.12)' : `${R}0.65)`,
                                }}>
                                    {kneelDone ? 'KNELT' : kneelCooldown ? (() => {
                                        const left = Math.max(0, Math.ceil((kneelCooldownUntil - Date.now()) / 1000));
                                        if (left < 60) return `${left}s`;
                                        const h = Math.floor(left / 3600); const m = Math.floor((left % 3600) / 60);
                                        return h > 0 ? `${h}h ${m}m` : `${m}m`;
                                    })() : kneelHolding ? 'HOLD...' : 'KNEEL'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Kneel progress dots — under kneel button */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '6px 0 0' }}>
                    {Array.from({ length: todayOrders.find((o: any) => o.type === 'kneel')?.target || 8 }).map((_, i) => (
                        <div key={i} style={{
                            width: 10, height: 10, borderRadius: '50%',
                            background: i < kneelToday ? '#b82020' : 'rgba(255,255,255,0.08)',
                            border: `1px solid ${i < kneelToday ? 'rgba(184,32,32,0.7)' : 'rgba(255,255,255,0.15)'}`,
                            boxShadow: i < kneelToday ? '0 0 6px rgba(184,32,32,0.3)' : 'none',
                            transition: 'all 0.3s ease',
                        }} />
                    ))}
                </div>

                {/* ── SHAME OVERLAY — shown when cancelling ── */}
                {cancelShame && (
                    <div style={{
                        position: 'fixed', inset: 0, zIndex: 200,
                        background: 'rgba(0,0,0,0.96)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 30, animation: 'vFadeIn 0.3s ease',
                    }}>
                        <div style={{ textAlign: 'center', maxWidth: 320 }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: 20, opacity: 0.6 }}>&#128081;</div>
                            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: '#8b0000', letterSpacing: '3px', textShadow: `0 0 30px ${R}0.4)`, marginBottom: 16, lineHeight: 1.5 }}>
                                PATHETIC
                            </div>
                            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, marginBottom: 24 }}>
                                You couldn&apos;t even obey a simple order.<br />
                                Queen is disappointed.
                            </div>
                            <div style={{ width: 60, height: 1, background: `linear-gradient(90deg, transparent, ${R}0.3), transparent)`, margin: '0 auto 20px' }} />
                            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: `${R}0.5)`, letterSpacing: '4px', marginBottom: 8 }}>
                                5 HOUR LOCKOUT
                            </div>
                            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '2px' }}>
                                PERFECT OBEDIENCE BROKEN
                            </div>
                        </div>
                    </div>
                )}


                {/* ── TODAY'S ORDERS ── */}
                <div style={{ width: '100%', padding: '0 16px 36px', marginTop: 20 }}>
                    <div style={{
                        width: '100%', borderRadius: 16, padding: '24px 20px 16px',
                        background: 'rgba(139,0,0,0.04)',
                        border: `1px solid ${R}0.12)`,
                        backdropFilter: 'blur(12px)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: 'rgba(255,255,255,0.55)', letterSpacing: '4px', fontWeight: 600 }}>TODAY&apos;S ORDERS</div>
                            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)', letterSpacing: '1px' }}>DAY {daysIn + 1}</div>
                        </div>
                        {attnSkippedToday && (
                            <div style={{ textAlign: 'center', padding: '10px 0 14px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem', color: 'rgba(255,40,40,0.55)', letterSpacing: '3px' }}>
                                &#10005; PERFECTION BROKEN — ORDER SKIPPED
                            </div>
                        )}
                        {todayOrders.filter((o: any) => o.type !== 'chastity_check' && o.type !== 'kneel').length === 0 && (
                            <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '2px' }}>
                                {vaultData?.today ? 'NO ADDITIONAL TASKS' : 'LOADING...'}
                            </div>
                        )}
                        {todayOrders.filter((o: any) => o.type !== 'chastity_check' && o.type !== 'kneel').map((o: any, i: number, arr: any[]) => {
                            const completed = o.done >= o.target;
                            const subs = vaultData?.submissions || [];
                            const pending = !completed && (taskSubmitted[o.type] || o.submitted === 'pending' || subs.some((s: any) => s.order_type === o.type && s.status === 'pending'));
                            return (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0',
                                    borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                }}>
                                    <div style={{
                                        width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                                        border: `2px solid ${completed ? 'rgba(80,200,120,0.6)' : pending ? 'rgba(197,160,89,0.5)' : 'rgba(255,255,255,0.12)'}`,
                                        background: completed ? 'rgba(80,200,120,0.1)' : pending ? 'rgba(197,160,89,0.08)' : 'transparent',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        {completed ? (
                                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="rgba(80,200,120,0.7)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                                        ) : pending ? (
                                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="rgba(197,160,89,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                                            </svg>
                                        ) : null}
                                    </div>
                                    <span style={{
                                        flex: 1, fontFamily: 'Cinzel, serif', fontSize: '0.9rem',
                                        color: completed ? 'rgba(80,200,120,0.55)' : pending ? 'rgba(197,160,89,0.6)' : 'rgba(255,255,255,0.55)',
                                        textDecoration: completed ? 'line-through' : 'none',
                                        letterSpacing: '0.5px',
                                    }}>{o.label || (({ kneel: `Kneel ${o.target} times`, chastity_check: 'Chastity Check', spin: 'Spin the Wheel', spin_wheel: 'Spin the Wheel', trial: 'Daily Trial', tribute: `Tribute ${o.target} Coins`, coinflip: 'Coin Flip', card_pick: 'Card Draw', dice_roll: 'Dice Roll', russian_roulette: 'Russian Roulette', truth_dare: 'Truth or Dare', greed_game: 'Greed Game' } as Record<string, string>)[o.type] || o.type.replace(/_/g, ' '))}</span>
                                    {pending ? (
                                        <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.6rem', color: 'rgba(197,160,89,0.45)', letterSpacing: '2px' }}>PENDING</span>
                                    ) : !completed && o.done > 0 ? (
                                        <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)' }}>{o.done}/{o.target}</span>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                    {todayOrders.filter((o: any) => o.type !== 'chastity_check' && o.type !== 'kneel').length > 0 && todayOrders.filter((o: any) => o.type !== 'chastity_check' && o.type !== 'kneel').every((o: any) => o.done >= o.target) && (
                        <div style={{ textAlign: 'center', marginTop: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', color: 'rgba(80,200,120,0.55)', letterSpacing: '3px' }}>
                                ALL ORDERS COMPLETE
                            </div>
                            {/* 1 Hour Freedom Reward */}
                            {rewardUntil > Date.now() ? (
                                <button onClick={() => { window.location.href = '/profile'; }} style={{
                                    padding: '12px 28px', background: 'linear-gradient(135deg, rgba(80,200,120,0.08), rgba(80,200,120,0.02))',
                                    border: '1px solid rgba(80,200,120,0.25)', borderRadius: 12, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    WebkitTapHighlightColor: 'transparent', animation: 'vPulse 2s ease infinite',
                                }}>
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="rgba(80,200,120,0.5)" strokeWidth="1.5">
                                        <path d="M7 11V7a5 5 0 0 1 9.9-1" /><rect x="3" y="11" width="18" height="11" rx="2" />
                                    </svg>
                                    <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', color: 'rgba(80,200,120,0.6)', letterSpacing: '2px' }}>
                                        ENTER FREEDOM — {(() => { const left = Math.max(0, Math.ceil((rewardUntil - Date.now()) / 60000)); const h = Math.floor(left / 60); const m = left % 60; return `${h}h ${m}m left`; })()}
                                    </span>
                                </button>
                            ) : rewardUntil > 0 ? (
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.45)', letterSpacing: '2px' }}>
                                    FREEDOM USED
                                </div>
                            ) : (
                                <button onClick={() => {
                                    // Freedom until user's local midnight
                                    const now = new Date();
                                    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
                                    const until = midnight.getTime();
                                    setRewardUntil(until);
                                    vladReact('Member just UNLOCKED their freedom until midnight by completing all daily orders. They earned it. Congratulate them sarcastically — remind them it ends at midnight.');
                                    // Record reward claim in DB
                                    if (vaultData?.session?.id) {
                                        fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'claim_reward', memberId: profile?.member_id || profile?.memberId || '' }) }).catch(() => {});
                                    }
                                }} style={{
                                    padding: '12px 28px', background: 'linear-gradient(135deg, rgba(197,160,89,0.08), rgba(197,160,89,0.02))',
                                    border: '1px solid rgba(197,160,89,0.25)', borderRadius: 12, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    WebkitTapHighlightColor: 'transparent',
                                }}>
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="rgba(197,160,89,0.5)" strokeWidth="1.5">
                                        <path d="M7 11V7a5 5 0 0 1 9.9-1" /><rect x="3" y="11" width="18" height="11" rx="2" />
                                    </svg>
                                    <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', color: 'rgba(197,160,89,0.6)', letterSpacing: '2px' }}>
                                        CLAIM FREEDOM UNTIL MIDNIGHT
                                    </span>
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* ── TRIBUTE BUTTON — under today's orders ── */}
                <div style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '0 20px 32px' }}>
                    <button onClick={() => (window as any).openStandaloneTribute?.('wishlist')} style={{
                        width: 240, height: 48,
                        background: `${R}0.08)`,
                        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                        border: `1px solid ${R}0.35)`, borderRadius: 12,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                    }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b0000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="8" width="18" height="12" rx="1"></rect>
                            <path d="M12 8v12"></path>
                            <path d="M19 8c-1.5-1.5-3-2-4.5-2C13 6 12 8 12 8s-1-2-2.5-2C8 6 6.5 6.5 5 8"></path>
                        </svg>
                        <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: '#8b0000', letterSpacing: 3, fontWeight: 700 }}>TRIBUTE</span>
                    </button>
                </div>

                {/* Standalone tribute overlay shell — populated by tribute-game.ts */}
                <div id="mobTributeStandalone" onClick={(e) => { if (e.target === e.currentTarget) (window as any).closeStandaloneTribute?.(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(2,5,18,0.97)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', zIndex: 2147483640, display: 'none', flexDirection: 'column' } as React.CSSProperties}>
                    <div id="mobTributeContent" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto', padding: '20px', paddingTop: 'calc(env(safe-area-inset-top) + 20px)', boxSizing: 'border-box' }}></div>
                </div>


                {/* ── BEG BUTTON ── */}
                <div style={{ textAlign: 'center', padding: '20px 0 40px' }}>
                    <button onClick={() => setShowBeg(true)} style={{ padding: '16px 48px', fontFamily: 'Cinzel, serif', fontSize: '0.9rem', letterSpacing: '3px', color: `${R}0.6)`, background: `${R}0.04)`, border: `1px solid ${R}0.15)`, borderRadius: 10, cursor: 'pointer' }}>
                        BEG FOR RELEASE
                    </button>
                    <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.45)', letterSpacing: '2px', marginTop: 8 }}>DENIED {vaultData?.begs?.filter((b: any) => b.status === 'denied').length ?? 0} TIMES</div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════
                RECORD TAB — stats, calendar, pressure
            ══════════════════════════════════════════════ */}
            <div style={{ display: tab === 'queen' ? 'flex' : 'none', flexDirection: 'column', position: 'fixed', inset: 0, zIndex: 40, background: '#050508' }}>
                {/* Header */}
                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${R}0.1)`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '2px' }}>RECORD</span>
                    <button onClick={() => setTab('vault')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', fontSize: '1.2rem', cursor: 'pointer' }}>&#10005;</button>
                </div>

                {/* Scrollable content */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 100 }}>

                {/* ── LOCK STATS ROW ── */}
                <div style={{
                    width: '100%', display: 'flex', justifyContent: 'space-around',
                    padding: '32px 20px 24px',
                }}>
                    {[
                        { v: daysIn, l: 'DAYS LOCKED' },
                        { v: vaultData?.begs?.filter((b: any) => b.status === 'denied').length ?? 0, l: 'DENIED' },
                        { v: vaultData?.session?.current_streak ?? 0, l: 'STREAK' },
                        { v: vaultData?.trials?.length ?? 0, l: 'TRIALS' },
                    ].map(s => (
                        <div key={s.l} style={{ textAlign: 'center' }}>
                            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '1.3rem', color: `${R}0.7)`, fontWeight: 700 }}>{s.v}</div>
                            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', letterSpacing: '1.5px', marginTop: 4 }}>{s.l}</div>
                        </div>
                    ))}
                </div>

                {/* ── LOCKED X DAYS AGO ── */}
                <div style={{ textAlign: 'center', padding: '0 0 24px' }}>
                    <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '2px' }}>LOCKED </span>
                    <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.95rem', color: `${R}0.75)`, letterSpacing: '1px' }}>{elapsed.d}</span>
                    <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '2px' }}> {elapsed.d === 1 ? 'DAY' : 'DAYS'} AGO</span>
                </div>

                {/* ── PRESSURE ── */}
                <div style={{ width: '100%', padding: '0 24px 32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '3px' }}>PRESSURE</span>
                        <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.9rem', color: pressurePct > 80 ? `${R}0.8)` : pressurePct > 50 ? 'rgba(197,160,89,0.6)' : 'rgba(255,255,255,0.5)' }}>{pressurePct}%</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                            height: '100%', width: `${pressurePct}%`, borderRadius: 3, transition: 'width 1s ease',
                            background: pressurePct > 80 ? `linear-gradient(90deg, ${R}0.5), ${R}0.8))` : pressurePct > 50 ? 'linear-gradient(90deg, rgba(197,160,89,0.3), rgba(197,160,89,0.6))' : 'linear-gradient(90deg, rgba(255,255,255,0.12), rgba(255,255,255,0.25))',
                        }} />
                    </div>
                    {pressurePct > 85 && <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: `${R}0.6)`, textAlign: 'center', marginTop: 10, letterSpacing: '1px' }}>You&apos;re breaking. Beg for mercy?</div>}
                </div>

                {/* ── OBEDIENCE CALENDAR — always open ── */}
                <div style={{ width: '100%', padding: '0 16px 28px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px', marginBottom: 12 }}>
                        <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', color: `${R}0.7)`, letterSpacing: '3px' }}>OBEDIENCE CALENDAR</span>
                        <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)' }}>
                            {(dailyRecords.filter((d: any) => d.perfect).length)}/{daysIn} PERFECT
                        </span>
                    </div>

                    {(() => {
                        const lockStart = new Date(vaultData?.session?.started_at || new Date().toISOString());
                        const startDay = (lockStart.getUTCDay() + 6) % 7;
                        const totalCells = startDay + lockDays;
                        const rows = Math.ceil(totalCells / 7);

                        return (
                            <div style={{ background: `${R}0.04)`, border: `1px solid ${R}0.12)`, borderRadius: 12, padding: '16px 12px 12px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 8 }}>
                                    {WEEKDAYS.map(d => (
                                        <div key={d} style={{ textAlign: 'center', fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', letterSpacing: '1px' }}>{d}</div>
                                    ))}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                                    {Array.from({ length: rows * 7 }).map((_, cellIdx) => {
                                        const dayIdx = cellIdx - startDay;
                                        const isValid = dayIdx >= 0 && dayIdx < lockDays;
                                        if (!isValid) return <div key={cellIdx} />;

                                        const isToday = dayIdx === daysIn;
                                        const isPast = dayIdx < daysIn;
                                        const obedient = isPast ? (dailyRecords[dayIdx]?.perfect ?? undefined) : undefined;
                                        const dayLog = dailyRecords[dayIdx] ? _toDayLog(dailyRecords[dayIdx]) : null;
                                        const cellDate = new Date(lockStart.getTime() + dayIdx * 86400000);
                                        const clickable = (isPast || isToday) && dayLog;

                                        return (
                                            <div key={cellIdx}
                                                onClick={clickable ? () => setSelectedDay(dayLog) : undefined}
                                                style={{
                                                    aspectRatio: '1', borderRadius: 4, display: 'flex', flexDirection: 'column',
                                                    alignItems: 'center', justifyContent: 'center', gap: 1,
                                                    cursor: clickable ? 'pointer' : 'default',
                                                    background: isToday ? 'rgba(197,160,89,0.08)' : obedient === true ? `${R}0.06)` : obedient === false ? 'rgba(255,40,40,0.04)' : 'rgba(255,255,255,0.01)',
                                                    border: `1px solid ${isToday ? 'rgba(197,160,89,0.25)' : obedient === true ? `${R}0.15)` : obedient === false ? 'rgba(255,40,40,0.12)' : 'rgba(255,255,255,0.03)'}`,
                                                    transition: 'all 0.2s ease',
                                                    animation: isToday ? 'vPulse 2s ease-in-out infinite' : 'none',
                                                    position: 'relative',
                                                }}>
                                                <span style={{
                                                    fontFamily: 'Orbitron, monospace', fontSize: '0.8rem',
                                                    color: isToday ? 'rgba(197,160,89,0.8)' : obedient === true ? `${R}0.65)` : obedient === false ? 'rgba(255,40,40,0.5)' : 'rgba(255,255,255,0.12)',
                                                }}>{cellDate.getUTCDate()}</span>
                                                {isPast && (
                                                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: obedient ? '#a01010' : 'rgba(255,40,40,0.4)' }} />
                                                )}
                                                {dayLog?.seal && (
                                                    <div style={{ position: 'absolute', top: 1, right: 1, width: 6, height: 6, borderRadius: '50%', background: dayLog.seal === 'bronze' ? '#cd7f32' : dayLog.seal === 'silver' ? '#c0c0c0' : dayLog.seal === 'gold' ? '#c5a059' : '#b9f2ff' }} />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(139,0,0,0.1)' }}>
                                    {[
                                        { color: '#a01010', label: 'PERFECT' },
                                        { color: 'rgba(255,40,40,0.4)', label: 'FAILED' },
                                        { color: 'rgba(197,160,89,0.6)', label: 'TODAY' },
                                    ].map(l => (
                                        <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: l.color }} />
                                            <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '1px' }}>{l.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* ── SEAL MILESTONES ── */}
                <div style={{ width: '100%', padding: '0 20px 36px' }}>
                    <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '4px', textAlign: 'center', marginBottom: 16 }}>SEAL MILESTONES</div>
                    <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                        {SEALS.map(m => {
                            const done = daysIn >= m.days;
                            const cur = !done && daysIn < m.days;
                            return (
                                <div key={m.label} style={{ textAlign: 'center', opacity: done ? 1 : 0.35 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: done ? m.color : 'rgba(255,255,255,0.06)', border: `1px solid ${done ? m.color : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px', boxShadow: done ? `0 0 12px ${m.color}40` : 'none' }}>
                                        {done && <span style={{ fontSize: '0.85rem' }}>&#10003;</span>}
                                    </div>
                                    <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.75rem', color: done ? m.color : 'rgba(255,255,255,0.3)', letterSpacing: '1px' }}>{m.label}</div>
                                    <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)', marginTop: 2 }}>{m.days}d</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                </div>{/* end scrollable content */}
            </div>

            {/* ══════════════════════════════════════════════
                OVERLAY TABS (chat, global, challenge)
            ══════════════════════════════════════════════ */}
            {['chat', 'global', 'challenge'].map(t => {
                const isLocked = (t === 'chat' && !chatOk) || (t === 'global' && !globalOk);
                const title = t === 'chat' ? 'QUEEN KARIN' : t === 'global' ? 'SUBS UNION' : 'WORK';
                const lockMsg = t === 'chat' ? 'COMPLETE YOUR DAILY TRIAL' : 'KNEEL 5 TIMES TODAY';
                return (
                    <div key={t} style={{ display: tab === t ? 'flex' : 'none', flexDirection: 'column', position: 'fixed', inset: 0, zIndex: 40, background: '#050508' }}>
                        {/* Header */}
                        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${R}0.1)`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            {t === 'chat' ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: '50%', border: `1px solid ${R}0.2)`, overflow: 'hidden' }}>
                                        <img src="/queen-nav.png" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Q" />
                                    </div>
                                    <div>
                                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', letterSpacing: '1px' }}>QUEEN KARIN</div>
                                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.75rem', color: `${R}0.65)`, letterSpacing: '2px' }}>
                                            {chatExpiresAt ? (() => { const left = Math.max(0, Math.ceil((chatExpiresAt - Date.now()) / 1000)); const m = Math.floor(left / 60); const s = left % 60; return `${m}:${s.toString().padStart(2, '0')} LEFT`; })() : 'KEYHOLDER'}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '2px' }}>{title}</span>
                            )}
                            <button onClick={() => setTab('vault')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', fontSize: '1.2rem', cursor: 'pointer' }}>&#10005;</button>
                        </div>

                        {/* Content or lock — coin flip gate */}
                        {isLocked && t === 'chat' ? (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '0 24px' }}>
                                {chatGateCooldown ? (
                                    <>
                                        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5">
                                            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                                        </svg>
                                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 1.7 }}>
                                            Queen denied your audience
                                        </div>
                                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.4rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '3px' }}>
                                            {(() => {
                                                const left = Math.max(0, Math.ceil((chatGateCooldownUntil - Date.now()) / 1000));
                                                const h = Math.floor(left / 3600); const m = Math.floor((left % 3600) / 60); const s = left % 60;
                                                return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
                                            })()}
                                        </div>
                                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '3px' }}>UNTIL NEXT ATTEMPT</div>
                                    </>
                                ) : chatGateFlipState === 'flipping' ? (
                                    <>
                                        <div style={{
                                            width: 120, height: 120, borderRadius: '50%',
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.12)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            animation: 'vCoinFlip 0.15s linear infinite',
                                        }}>
                                            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '2.2rem', fontWeight: 700, color: 'rgba(255,255,255,0.25)' }}>?</span>
                                        </div>
                                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '4px', marginTop: 8 }}>FLIPPING...</div>
                                    </>
                                ) : chatGateFlipState === 'heads' ? (
                                    <>
                                        <div style={{
                                            width: 120, height: 120, borderRadius: '50%',
                                            background: 'rgba(255,255,255,0.04)',
                                            border: '1px solid rgba(255,255,255,0.15)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            animation: 'vFadeIn 0.4s ease',
                                        }}>
                                            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                                        </div>
                                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: 'rgba(255,255,255,0.55)', letterSpacing: '3px', marginTop: 4 }}>GRANTED</div>
                                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)', letterSpacing: '2px' }}>ENTERING CHAT — 15 MINUTES</div>
                                    </>
                                ) : chatGateFlipState === 'tails' ? (
                                    <>
                                        <div style={{
                                            width: 120, height: 120, borderRadius: '50%',
                                            background: 'rgba(255,255,255,0.02)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            animation: 'vFadeIn 0.4s ease',
                                        }}>
                                            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                            </svg>
                                        </div>
                                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: 'rgba(255,255,255,0.45)', letterSpacing: '3px', marginTop: 4 }}>DENIED</div>
                                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '2px' }}>8 HOUR COOLDOWN</div>
                                    </>
                                ) : (
                                    <>
                                        <div style={{
                                            width: 120, height: 120, borderRadius: '50%',
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '2.2rem', fontWeight: 700, color: 'rgba(255,255,255,0.2)' }}>?</span>
                                        </div>

                                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: 'rgba(255,255,255,0.4)', textAlign: 'center', letterSpacing: '1px', marginTop: 4 }}>
                                            Flip to request an audience
                                        </div>

                                        <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 280, marginTop: 4 }}>
                                            <div style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '2px', marginBottom: 4 }}>HEADS</div>
                                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.15)', letterSpacing: '1px' }}>15 MIN CHAT</div>
                                            </div>
                                            <div style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '2px', marginBottom: 4 }}>TAILS</div>
                                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.15)', letterSpacing: '1px' }}>8 HOUR WAIT</div>
                                            </div>
                                        </div>

                                        <button onClick={() => {
                                            setChatGateFlipState('flipping');
                                            const isHeads = Math.random() < 0.5;
                                            setTimeout(() => {
                                                setChatGateFlipState(isHeads ? 'heads' : 'tails');
                                                if (isHeads) {
                                                    vladReact('Member flipped HEADS! They get 15 minutes of chat with Queen. Lucky bastard.');
                                                    setTimeout(() => { setChatExpiresAt(Date.now() + 15 * 60 * 1000); setChatGateDone(true); setChatGateFlipState('idle'); }, 2000);
                                                } else {
                                                    vladReact('Member flipped TAILS. Denied. 8 hour cooldown. Better luck next time.');
                                                    setTimeout(() => {
                                                        const cooldownUntil = Date.now() + 8 * 3600 * 1000;
                                                        setChatGateCooldownUntil(cooldownUntil);
                                                        setChatGateFlipState('idle');
                                                        // Persist to DB
                                                        const mid = profile?.member_id || profile?.memberId || '';
                                                        if (mid) fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_chat_cooldown', memberId: mid, until: cooldownUntil }) }).catch(() => {});
                                                    }, 2500);
                                                }
                                            }, 1500);
                                        }} style={{
                                            padding: '14px 48px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem', letterSpacing: '4px',
                                            color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, cursor: 'pointer',
                                            marginTop: 4, animation: 'vShake 2.5s ease-in-out infinite',
                                        }}>FLIP</button>
                                    </>
                                )}
                            </div>
                        ) : isLocked ? (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                                <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke={`${R}0.3)`} strokeWidth="1.5">
                                    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                                </svg>
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.65rem', color: `${R}0.7)`, letterSpacing: '3px', textAlign: 'center', padding: '0 40px' }}>{lockMsg}</div>
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', letterSpacing: '2px' }}>TO UNLOCK UNION</div>
                            </div>
                        ) : t === 'chat' ? (
                            <div id="mobChatOverlay" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                {/* Tab bar — same as profile */}
                                <div className="mob-gl-tabs">
                                    <button id="mobChatBtnChat" className="mob-gl-tab active" onClick={() => { (window as any).toggleAiMode?.(false); (window as any).switchMobChatTab?.('chat'); }}>CHAT</button>
                                    <button id="mobChatBtnAi" className="mob-gl-tab" onClick={() => { (window as any).toggleAiMode?.(true); (window as any).switchMobChatTab?.('chat'); }}>@VLAD</button>
                                    <button id="mobChatBtnService" className="mob-gl-tab" onClick={() => { (window as any).toggleAiMode?.(false); (window as any).switchMobChatTab?.('service'); }}>SERVICE</button>
                                </div>

                                {/* Chat panel */}
                                <div id="mobChatTabChat" className="mob-gl-panel" style={{ flexDirection: 'column', flex: 1, overflow: 'hidden', position: 'relative' }}>
                                    <div id="mob_chatBox" className="mob-gl-scroll" style={{ flex: 1, position: 'relative' }}>
                                        <div id="mob_systemTicker" className="system-ticker" style={{ cursor: 'pointer' }} onClick={() => (window as any).switchMobChatTab?.('service')}>SYSTEM ONLINE</div>
                                        <div id="mob_chatContent" className="chat-area"></div>
                                        <div id="mob_aiChatContent" className="chat-area" style={{ display: 'none' }}></div>
                                    </div>
                                    {/* Normal chat footer */}
                                    <div id="mobChatFooterNormal" className="chat-footer">
                                        <div className="chat-input-wrapper">
                                            <button className="chat-btn-plus" onClick={() => (window as any).handleMediaPlus?.()}>+</button>
                                            <input type="text" id="mob_chatMsgInput" className="chat-input" placeholder="Transmit..." onKeyPress={(e: any) => (window as any).handleChatKey?.(e)} />
                                        </div>
                                        <button onClick={() => (window as any).openProfileGifPicker?.()} style={{ background: 'none', border: '1px solid rgba(197,160,89,0.2)', cursor: 'pointer', padding: '4px 8px', borderRadius: 8, fontFamily: 'Orbitron', fontSize: '0.65rem', fontWeight: 700, color: 'rgba(197,160,89,0.6)', letterSpacing: '1px', flexShrink: 0 }}>GIF</button>
                                        <button className="chat-btn-send" onClick={() => (window as any).sendChatMessage?.()}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M22 2L11 13" stroke="#c5a059" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="#c5a059" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </button>
                                    </div>
                                    {/* AI chat footer */}
                                    <div id="mobChatAiFooter" className="chat-footer ai-footer footer-hidden">
                                        <div className="chat-input-wrapper" style={{ flex: 1 }}>
                                            <input type="text" id="mob_aiMsgInput" className="chat-input ai-input" placeholder="Ask me anything..." onKeyPress={(e: any) => (window as any).handleAiChatKey?.(e)} />
                                        </div>
                                        <button id="mobAiSendBtn" className="chat-btn-send ai-send-btn" onClick={() => (window as any).sendAiMessage?.()}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M22 2L11 13" stroke="rgba(160,100,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="rgba(160,100,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                {/* Service panel */}
                                <div id="mobChatTabService" style={{ display: 'none', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                                    <div id="mob_systemLogContent" className="chat-area mob-gl-scroll" style={{ flex: 1 }}></div>
                                </div>
                                <div id="mobSystemLogContainer" style={{ display: 'none' }}></div>
                            </div>
                        ) : t === 'challenge' ? (
                            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 100px', display: 'flex', flexDirection: 'column' }}>
                                {(() => {
                                    const tasks = todayOrders.filter((o: any) => o.type !== 'chastity_check' && o.type !== 'kneel');
                                    const subs = vaultData?.submissions || [];
                                    const isPending = (o: any) => taskSubmitted[o.type] || o.submitted === 'pending' || subs.some((s: any) => s.order_type === o.type && s.status === 'pending');
                                    const doneCount = tasks.filter((o: any) => o.done >= o.target).length;
                                    const pendingCount = tasks.filter((o: any) => o.done < o.target && isPending(o)).length;
                                    const allDone = (doneCount + pendingCount) >= tasks.length;
                                    // Skip done AND pending tasks — show the next actionable one
                                    const currentTask = tasks.find((o: any) => o.done < o.target && !isPending(o));

                                    return (
                                        <>
                                            {/* ── Header: day + task count ── */}
                                            <div style={{ textAlign: 'center', marginBottom: 28 }}>
                                                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.6rem', color: 'rgba(255,255,255,0.75)', letterSpacing: '6px', fontWeight: 700 }}>DAY {daysIn + 1}</div>
                                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '4px', marginTop: 6 }}>
                                                    {allDone && pendingCount === 0 ? 'ALL ORDERS COMPLETE' : allDone ? 'AWAITING REVIEW' : `${tasks.length} TASKS TODAY`}
                                                </div>
                                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', color: allDone && pendingCount === 0 ? 'rgba(80,200,120,0.8)' : allDone ? 'rgba(197,160,89,0.7)' : 'rgba(255,255,255,0.5)', letterSpacing: '3px', marginTop: 8 }}>
                                                    {doneCount} / {tasks.length} DONE{pendingCount > 0 ? ` · ${pendingCount} PENDING` : ''}
                                                </div>
                                            </div>

                                            {/* ── Progress circles: each task = one circle ── */}
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 32, flexWrap: 'wrap' }}>
                                                {tasks.map((o: any, i: number) => {
                                                    const isDone = o.done >= o.target;
                                                    const pending = !isDone && isPending(o);
                                                    const isCurrent = o === currentTask;
                                                    const meta = MECH_ICON[o.type] || { icon: '\u25C6', label: o.type };
                                                    return (
                                                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                                            <div style={{
                                                                width: 36, height: 36, borderRadius: '50%',
                                                                border: `2px solid ${isDone ? 'rgba(80,200,120,0.5)' : pending ? 'rgba(197,160,89,0.5)' : isCurrent ? `${R}0.5)` : 'rgba(255,255,255,0.08)'}`,
                                                                background: isDone ? 'rgba(80,200,120,0.08)' : pending ? 'rgba(197,160,89,0.06)' : isCurrent ? `${R}0.06)` : 'transparent',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                transition: 'all 0.3s',
                                                                boxShadow: isCurrent ? `0 0 12px ${R}0.15)` : pending ? '0 0 10px rgba(197,160,89,0.1)' : 'none',
                                                                animation: pending ? 'vPulse 2s ease infinite' : 'none',
                                                            }}>
                                                                {isDone ? (
                                                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="rgba(80,200,120,0.8)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                                                                ) : pending ? (
                                                                    <span style={{ fontSize: '0.65rem', color: 'rgba(197,160,89,0.7)' }}>⏳</span>
                                                                ) : (
                                                                    <span style={{ fontSize: '0.8rem', opacity: isCurrent ? 0.7 : 0.2 }}>{meta.icon}</span>
                                                                )}
                                                            </div>
                                                            <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.55rem', color: isDone ? 'rgba(80,200,120,0.5)' : pending ? 'rgba(197,160,89,0.5)' : isCurrent ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)', letterSpacing: '1px', maxWidth: 50, textAlign: 'center', lineHeight: 1.2 }}>{pending ? 'Pending' : meta.label}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* ── All complete / all pending celebration ── */}
                                            {allDone && pendingCount === 0 && (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', animation: 'vFadeIn 0.6s ease', flex: 1 }}>
                                                    <div style={{
                                                        width: 90, height: 90, borderRadius: '50%',
                                                        border: '2px solid rgba(80,200,120,0.3)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        boxShadow: '0 0 40px rgba(80,200,120,0.1), inset 0 0 20px rgba(80,200,120,0.05)',
                                                        marginBottom: 28,
                                                    }}>
                                                        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="rgba(80,200,120,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                                                    </div>
                                                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.5rem', color: 'rgba(80,200,120,0.7)', letterSpacing: '6px', marginBottom: 10, fontWeight: 700 }}>PERFECT</div>
                                                    <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.9rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '3px' }}>ALL ORDERS FULFILLED</div>
                                                </div>
                                            )}
                                            {allDone && pendingCount > 0 && !currentTask && (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', animation: 'vFadeIn 0.6s ease', flex: 1 }}>
                                                    <div style={{
                                                        width: 90, height: 90, borderRadius: '50%',
                                                        border: '2px solid rgba(197,160,89,0.25)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        boxShadow: '0 0 40px rgba(197,160,89,0.08), inset 0 0 20px rgba(197,160,89,0.04)',
                                                        marginBottom: 28,
                                                    }}>
                                                        <span style={{ fontSize: '2rem', animation: 'vPulse 2s ease infinite' }}>&#9203;</span>
                                                    </div>
                                                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.5rem', color: 'rgba(197,160,89,0.7)', letterSpacing: '6px', marginBottom: 10, fontWeight: 700 }}>SUBMITTED</div>
                                                    <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.9rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '3px' }}>{pendingCount} TASK{pendingCount > 1 ? 'S' : ''} AWAITING REVIEW</div>
                                                </div>
                                            )}

                                            {/* ── Current active task (ONE at a time) ── */}
                                            {currentTask && (() => {
                                                const o = currentTask;
                                                const meta = MECH_ICON[o.type] || { icon: '\u25C6', label: o.type };
                                                const label = o.label || meta.label;
                                                const isMech = false; // All types now handled by generic submission below

                                                return (
                                                    <div
                                                        style={{ background: `${R}0.05)`, border: `1px solid ${R}0.15)`, borderRadius: 16, animation: 'vFadeIn 0.3s ease' }}>

                                                        {/* Card header */}
                                                        <div style={{ padding: '20px 22px 16px', borderBottom: `1px solid ${R}0.08)` }}>
                                                            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.65rem', color: `${R}0.4)`, letterSpacing: '4px', marginBottom: 6 }}>CURRENT ORDER</div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                                                <span style={{ fontSize: '1.4rem', opacity: 0.5 }}>{meta.icon}</span>
                                                                <span style={{ flex: 1, fontFamily: 'Cinzel, serif', fontSize: '1.05rem', color: 'rgba(255,255,255,0.75)', letterSpacing: '1px', lineHeight: 1.3 }}>{label}</span>
                                                            </div>
                                                            {o.done > 0 && (
                                                                <div style={{ marginTop: 10 }}>
                                                                    <div style={{ height: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
                                                                        <div style={{ height: '100%', width: `${Math.min(100, (o.done / o.target) * 100)}%`, background: `${R}0.5)`, borderRadius: 2, transition: 'width 0.5s' }} />
                                                                    </div>
                                                                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: `${R}0.5)`, letterSpacing: '2px', marginTop: 6, textAlign: 'right' }}>{o.done} / {o.target}</div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Task-specific content */}
                                                        <div style={{ padding: '20px 22px' }}>
                                                            {/* SPIN (old type) */}
                                                            {o.type === 'spin' && (
                                                                <div style={{ textAlign: 'center' }}>
                                                                    <div style={{ position: 'relative', width: 220, height: 220, margin: '0 auto 20px' }}>
                                                                        <div style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', zIndex: 2, width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: `14px solid ${R}0.6)` }} />
                                                                        <div style={{ width: 220, height: 220, borderRadius: '50%', border: `1.5px solid ${R}0.12)`, transform: `rotate(${wheelAngle}deg)`, transition: spinning ? 'transform 4s cubic-bezier(0.2, 0.8, 0.3, 1)' : 'none', position: 'relative', overflow: 'hidden' }}>
                                                                            {WHEEL.map((_, wi) => { const seg = 360 / WHEEL.length; return <div key={wi} style={{ position: 'absolute', width: '50%', height: '50%', top: 0, right: 0, transformOrigin: '0% 100%', transform: `rotate(${wi * seg - 90}deg) skewY(-${90 - seg}deg)`, background: wi % 2 === 0 ? `${R}0.04)` : 'rgba(255,255,255,0.015)', borderRight: '1px solid rgba(255,255,255,0.03)' }} />; })}
                                                                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 44, height: 44, borderRadius: '50%', background: '#0a0a0e', border: `1px solid ${R}0.12)`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                                                                                <span style={{ fontSize: '0.8rem', color: `${R}0.6)` }}>&#9819;</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <button onClick={spin} disabled={spinning || wheelUsed} style={{ padding: '14px 44px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', letterSpacing: '4px', color: wheelUsed ? 'rgba(255,255,255,0.12)' : `${R}0.5)`, background: 'transparent', border: `1px solid ${wheelUsed ? 'rgba(255,255,255,0.05)' : `${R}0.12)`}`, borderRadius: 8, cursor: wheelUsed ? 'default' : 'pointer' }}>
                                                                        {spinning ? 'SPINNING...' : 'SPIN'}
                                                                    </button>
                                                                </div>
                                                            )}

                                                            {/* TRIAL */}
                                                            {o.type === 'trial' && (
                                                                <div>
                                                                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, marginBottom: 16 }}>
                                                                        {vaultData?.today?.trial_prompt || 'No trial assigned yet.'}
                                                                    </div>
                                                                    {!trialDone && !trialOpen && (
                                                                        <button onClick={() => setTrialOpen(true)} style={{
                                                                            width: '100%', padding: '14px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', letterSpacing: '3px',
                                                                            color: `${R}0.5)`, background: `${R}0.04)`, border: `1px solid ${R}0.12)`, borderRadius: 8, cursor: 'pointer',
                                                                        }}>BEGIN TRIAL</button>
                                                                    )}
                                                                    {trialOpen && !trialDone && (
                                                                        <>
                                                                            <textarea value={trialText} onChange={e => setTrialText(e.target.value)} placeholder="Write here..."
                                                                                style={{ width: '100%', minHeight: 120, background: 'rgba(0,0,0,0.3)', border: `1px solid ${R}0.08)`, borderRadius: 10, padding: 16, color: 'rgba(255,255,255,0.5)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '16px', lineHeight: 1.7, resize: 'vertical', outline: 'none' }} />
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                                                                                <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)' }}>{trialText.split(/\s+/).filter(Boolean).length} / 200</span>
                                                                                <button onClick={() => {
                                                                                    setTrialDone(true); setTrialOpen(false);
                                                                                    if (vaultData?.session?.id) {
                                                                                        fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'trial', memberId: profile?.member_id || profile?.memberId || '', prompt: vaultData?.today?.trial_prompt || 'Daily trial', response: trialText }) }).catch(() => {});
                                                                                    }
                                                                                }} style={{ padding: '12px 28px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', letterSpacing: '3px', color: '#050508', background: `${R}0.5)`, border: 'none', borderRadius: 8, cursor: 'pointer' }}>SUBMIT</button>
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* TRIBUTE */}
                                                            {o.type === 'tribute' && (
                                                                <div style={{ textAlign: 'center' }}>
                                                                    <button onClick={() => (window as any).openStandaloneTribute?.('wishlist')} style={{
                                                                        width: '100%', padding: '16px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', letterSpacing: '3px',
                                                                        color: `${R}0.5)`, background: `${R}0.04)`, border: `1px solid ${R}0.12)`, borderRadius: 8, cursor: 'pointer',
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                                                    }}>
                                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="8" width="18" height="12" rx="1" /><path d="M12 8v12" /><path d="M19 8c-1.5-1.5-3-2-4.5-2C13 6 12 8 12 8s-1-2-2.5-2C8 6 6.5 6.5 5 8" /></svg>
                                                                        TRIBUTE {o.target} COINS
                                                                    </button>
                                                                </div>
                                                            )}

                                                            {/* SILENCE */}
                                                            {o.type === 'silence' && (
                                                                <div style={{ textAlign: 'center' }}>
                                                                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.8 }}>
                                                                        You are forbidden from messaging today. Endure.
                                                                    </div>
                                                                </div>
                                                            )}


                                                            {/* ── GENERIC TASK SUBMISSION (all non-handled types) ── */}
                                                            {!['spin','trial','tribute','silence'].includes(o.type) && (() => {
                                                                const isPhotoTask = ['cold_shower','body_writing','exercise','photo_proof','ambush_snap','timed_photo','multi_video','endurance'].includes(o.type);
                                                                const isTextTask = ['journal','confession','worship','gratitude','essay','lines','writing','quiz'].includes(o.type);
                                                                const isInteractive = ['dice_roll','coinflip','card_pick','russian_roulette','spin_wheel','truth_dare','greed_game','simon_says'].includes(o.type);
                                                                const isSelfReport = ['edge','corner_time','denial','kneel'].includes(o.type);
                                                                const isPayment = o.type === 'payment';
                                                                const alreadySubmitted = taskSubmitted[o.type];
                                                                const existingSub = (vaultData?.submissions || []).find((s: any) => s.order_type === o.type);
                                                                const isPending = existingSub?.status === 'pending' || alreadySubmitted || o.submitted === 'pending';
                                                                const mid = profile?.member_id || profile?.memberId || '';
                                                                const submitTask = async (opts: { text?: string; photoUrl?: string }) => {
                                                                    console.log('[vault] submitTask called:', o.type, 'mid:', mid);
                                                                    setTaskSubmitted(p => ({ ...p, [o.type]: true }));
                                                                    try {
                                                                        const resp = await fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                                                                            body: JSON.stringify({ action: 'submit_task', memberId: mid, orderType: o.type, text: opts.text || null, photoUrl: opts.photoUrl || null, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
                                                                        });
                                                                        const result = await resp.json();
                                                                        console.log('[vault] submit_task response:', resp.status, result);
                                                                        if (!resp.ok) alert('Submit failed: ' + (result.error || 'unknown error'));
                                                                        setTaskText('');
                                                                        // Refresh vault data to get updated submissions
                                                                        if (mid) {
                                                                            fetch(`/api/vault/session?memberId=${encodeURIComponent(mid)}`).then(r => r.json()).then(vd2 => {
                                                                                if (vd2.active) {
                                                                                    console.log('[vault] refreshed data, programTasks submitted states:', vd2.programTasks?.map((t: any) => `${t.type}:${t.submitted || 'none'}`));
                                                                                    setVaultData(vd2);
                                                                                }
                                                                            }).catch(() => {});
                                                                        }
                                                                    } catch (e: any) { console.error('[vault] submit_task fetch error:', e); alert('Submit failed: ' + e?.message); }
                                                                };

                                                                if (isPending) return (
                                                                    <div style={{ textAlign: 'center', padding: '8px 0' }}>
                                                                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem', color: 'rgba(197,160,89,0.6)', letterSpacing: '3px', animation: 'vPulse 2s ease infinite' }}>
                                                                            ⏳ AWAITING REVIEW
                                                                        </div>
                                                                    </div>
                                                                );

                                                                return (
                                                                    <div>
                                                                        {/* Task description — priority: config fields > meta desc > fallback */}
                                                                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, marginBottom: 16 }}>
                                                                            {o.config?.instruction || o.config?.prompt || o.config?.question
                                                                                || (o.type === 'coinflip' && o.config?.headsText ? `Heads: ${o.config.headsText} / Tails: ${o.config.tailsText}` : null)
                                                                                || (o.type === 'multi_video' && o.config?.target ? `Record ${o.config.target} clips as instructed.` : null)
                                                                                || meta.desc || 'Complete this task as ordered.'}
                                                                        </div>
                                                                        {o.config?.duration && <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.25)', letterSpacing: '2px', marginBottom: 12 }}>{Math.floor(o.config.duration / 60)}:{String(o.config.duration % 60).padStart(2, '0')} DURATION</div>}

                                                                        {/* ── INTERACTIVE MECHANISMS ── */}

                                                                        {/* DICE ROLL */}
                                                                        {o.type === 'dice_roll' && (() => {
                                                                            const diceOutcomes = o.config?.outcomes?.length > 0 ? o.config.outcomes : [{ text: 'Edge once — no release', followUpType: 'endurance' }, { text: 'Write 100 lines of devotion', followUpType: 'writing' }, { text: 'Hold a plank for 60 seconds — proof', followUpType: 'photo' }, { text: '30 squats — video proof', followUpType: 'endurance' }, { text: 'Cold water on your face — selfie', followUpType: 'photo' }, { text: 'Lucky. Nothing happens.', followUpType: 'instant' }];
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
                                                                                        const numFaces = diceOutcomes.length;
                                                                                        let count = 0;
                                                                                        const iv = setInterval(() => {
                                                                                            const val = Math.floor(Math.random() * numFaces) + 1;
                                                                                            setDiceResult(val);
                                                                                            count++;
                                                                                            if (count > 15) { clearInterval(iv); setDiceRolling(false); setMechDone(true); saveGambleResult({ diceResult: val }, 'dice_roll'); const oc = diceOutcomes[val - 1]; const ft = oc?.followUpType || 'writing'; setPendingFollowUp({ orderType: o.type, source: `Dice Roll — ${val}`, resultText: oc?.text || `Face ${val}`, type: ft, prompt: oc?.followUpPrompt, instruction: oc?.followUpInstruction, duration: oc?.followUpDuration, target: oc?.followUpTarget }); }
                                                                                        }, 100);
                                                                                    }} style={{ padding: '16px 48px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', letterSpacing: '4px', color: '#050508', background: `${R}0.5)`, border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                                                                                        {diceRolling ? 'ROLLING...' : 'ROLL DICE'}
                                                                                    </button>
                                                                                ) : mechDone ? (
                                                                                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '4px', animation: 'vPulse 1s ease infinite', marginTop: 8 }}>YOUR FATE IS SEALED</div>
                                                                                ) : null}
                                                                            </div>
                                                                            );
                                                                        })()}

                                                                        {/* COINFLIP */}
                                                                        {o.type === 'coinflip' && (() => {
                                                                            const hRaw = o.config?.headsText;
                                                                            const tRaw = o.config?.tailsText;
                                                                            const headsTask = (hRaw && !/^heads?$/i.test(hRaw.trim())) ? hRaw : 'Write a 200-word confession about your weakness';
                                                                            const tailsTask = (tRaw && !/^tails?$/i.test(tRaw.trim())) ? tRaw : 'Hold a plank for 60 seconds — photo proof';
                                                                            const taskText = coinResult === 'heads' ? headsTask : coinResult === 'tails' ? tailsTask : '';
                                                                            const lower = taskText.toLowerCase();
                                                                            const inferredType = /proof|video|selfie|photo|picture|body writing/.test(lower) ? 'photo'
                                                                                : /write|essay|confession|journal|list|lines|letter|words|grateful/.test(lower) ? 'writing'
                                                                                : /shower|plank|hold|sit|pushup|squat|burpee|exercise|camera|edge|ice/.test(lower) ? 'endurance'
                                                                                : 'writing';
                                                                            return (
                                                                            <div style={{ textAlign: 'center', padding: '10px 0' }}>
                                                                                <div style={{ width: 90, height: 90, margin: '16px auto 20px', borderRadius: '50%', border: `2px solid ${coinResult ? (coinResult === 'heads' ? 'rgba(197,160,89,0.5)' : 'rgba(255,80,80,0.4)') : `${R}0.2)`}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: coinResult === 'heads' ? 'rgba(197,160,89,0.08)' : coinResult === 'tails' ? 'rgba(255,80,80,0.06)' : `${R}0.04)`, animation: coinFlipping ? 'vPulse 0.12s linear infinite' : 'none' }}>
                                                                                    <span style={{ fontFamily: 'Cinzel, serif', fontSize: coinResult ? '0.85rem' : '1.5rem', color: coinResult === 'heads' ? 'rgba(197,160,89,0.9)' : coinResult === 'tails' ? 'rgba(255,80,80,0.8)' : `${R}0.3)`, letterSpacing: 2, fontWeight: 700 }}>{coinResult ? coinResult.toUpperCase() : '$'}</span>
                                                                                </div>
                                                                                {coinResult && !coinFlipping && (
                                                                                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, margin: '0 0 20px', padding: '14px 18px', background: coinResult === 'heads' ? 'rgba(197,160,89,0.06)' : 'rgba(255,80,80,0.06)', border: `1px solid ${coinResult === 'heads' ? 'rgba(197,160,89,0.15)' : 'rgba(255,80,80,0.15)'}`, borderRadius: 8 }}>{taskText}</div>
                                                                                )}
                                                                                {!coinResult || coinFlipping ? (
                                                                                    <button disabled={coinFlipping} onClick={() => {
                                                                                        setCoinFlipping(true); setCoinResult(null);
                                                                                        let count = 0;
                                                                                        const iv = setInterval(() => {
                                                                                            const val = Math.random() > 0.5 ? 'heads' : 'tails';
                                                                                            setCoinResult(val);
                                                                                            count++;
                                                                                            if (count > 12) { clearInterval(iv); setCoinFlipping(false); setMechDone(true); saveGambleResult({ coinResult: val }, 'coinflip'); const tt = val === 'heads' ? headsTask : tailsTask; const lo2 = tt.toLowerCase(); const it = /proof|video|selfie|photo|picture|body writing/.test(lo2) ? 'photo' : /write|essay|confession|journal|list|lines|letter|words|grateful/.test(lo2) ? 'writing' : /shower|plank|hold|sit|pushup|squat|burpee|exercise|camera|edge|ice/.test(lo2) ? 'endurance' : 'writing'; setPendingFollowUp({ orderType: o.type, source: `Coinflip — ${val.toUpperCase()}`, resultText: tt, type: it }); }
                                                                                        }, 120);
                                                                                    }} style={{ padding: '16px 48px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', letterSpacing: '4px', color: '#050508', background: `${R}0.5)`, border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                                                                                        {coinFlipping ? 'FLIPPING...' : 'FLIP COIN'}
                                                                                    </button>
                                                                                ) : mechDone ? (
                                                                                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '4px', animation: 'vPulse 1s ease infinite', marginTop: 8 }}>YOUR FATE IS SEALED</div>
                                                                                ) : null}
                                                                            </div>
                                                                            );
                                                                        })()}

                                                                        {/* CARD PICK */}
                                                                        {o.type === 'card_pick' && (() => {
                                                                            const configCards = o.config?.cards?.length > 0 ? o.config.cards : [{ text: 'Edge 3 times without release', followUpType: 'endurance' }, { text: 'Write a confession — 200 words', followUpType: 'writing' }, { text: 'Cold shower — 60 seconds proof', followUpType: 'photo' }, { text: '50 pushups — video proof', followUpType: 'endurance' }, { text: 'You got lucky. Nothing happens.', followUpType: 'instant' }];
                                                                            const numCards = Math.max(configCards.length, 3);
                                                                            const displayCount = Math.min(numCards, 5);
                                                                            return (
                                                                            <div style={{ textAlign: 'center', padding: '10px 0' }}>
                                                                                {!cardResult ? (
                                                                                    <>
                                                                                        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, margin: '16px 0 24px', flexWrap: 'wrap' }}>
                                                                                            {Array.from({ length: displayCount }, (_, i) => (
                                                                                                <button key={i} disabled={cardPicking} onClick={() => {
                                                                                                    setCardPicking(true);
                                                                                                    const picked = configCards.length > 0
                                                                                                        ? configCards[Math.floor(Math.random() * configCards.length)]
                                                                                                        : { text: 'Unknown card' };
                                                                                                    setTimeout(() => { setCardResult(picked); setCardPicking(false); setMechDone(true); saveGambleResult({ cardResult: picked }, 'card_pick'); const cft = picked?.followUpType || 'writing'; setPendingFollowUp({ orderType: o.type, source: 'Card Draw', resultText: picked?.text || picked, type: cft === 'instant' ? 'writing' : cft, prompt: picked?.followUpPrompt, instruction: picked?.followUpInstruction, duration: picked?.followUpDuration, target: picked?.followUpTarget }); }, 800);
                                                                                                }} style={{ width: 70, height: 100, background: cardPicking ? 'rgba(197,160,89,0.1)' : `${R}0.06)`, border: `1.5px solid ${R}0.2)`, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', animation: cardPicking ? 'vPulse 0.3s ease infinite' : 'none' }}>
                                                                                                    <span style={{ fontFamily: 'Cinzel, serif', fontSize: '1.8rem', color: `${R}0.25)` }}>{'\u2660'}</span>
                                                                                                </button>
                                                                                            ))}
                                                                                        </div>
                                                                                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.25)', letterSpacing: 2 }}>CHOOSE A CARD</div>
                                                                                    </>
                                                                                ) : (
                                                                                    <>
                                                                                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'rgba(197,160,89,0.8)', lineHeight: 1.6, margin: '16px 0 20px', padding: '16px 20px', background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 8 }}>
                                                                                            {cardResult?.text || cardResult}
                                                                                        </div>
                                                                                        {mechDone && (
                                                                                            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '4px', animation: 'vPulse 1s ease infinite', marginTop: 8, textAlign: 'center' }}>YOUR FATE IS SEALED</div>
                                                                                        )}
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                            );
                                                                        })()}

                                                                        {/* RUSSIAN ROULETTE */}
                                                                        {o.type === 'russian_roulette' && (
                                                                            <div style={{ textAlign: 'center', padding: '10px 0' }}>
                                                                                <div style={{ width: 90, height: 90, margin: '16px auto 24px', borderRadius: '50%', border: `2px solid ${rouletteResult === 'bang' ? 'rgba(255,60,60,0.5)' : rouletteResult === 'click' ? 'rgba(80,200,120,0.4)' : 'rgba(255,60,60,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: rouletteResult === 'bang' ? 'rgba(255,60,60,0.08)' : rouletteResult === 'click' ? 'rgba(80,200,120,0.06)' : 'rgba(255,60,60,0.03)', animation: rouletteSpinning ? 'vPulse 0.1s linear infinite' : 'none' }}>
                                                                                    <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: rouletteResult ? '0.7rem' : '1.2rem', color: rouletteResult === 'bang' ? 'rgba(255,60,60,0.9)' : rouletteResult === 'click' ? 'rgba(80,200,120,0.8)' : 'rgba(255,60,60,0.4)', letterSpacing: 2 }}>{rouletteResult === 'bang' ? 'BANG' : rouletteResult === 'click' ? 'CLICK' : '\u2295'}</span>
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
                                                                                            setRouletteResult(val);
                                                                                            setRouletteSpinning(false);
                                                                                            setMechDone(true);
                                                                                            saveGambleResult({ rouletteResult: val }, 'russian_roulette');
                                                                                            const rpt = o.config?.punishment || 'Write 100 lines: "I pulled the trigger and paid the price"'; const rBang = val === 'bang'; const rlo = rpt.toLowerCase(); const rinf = rBang ? (/proof|video|selfie|photo|picture|body writing/.test(rlo) ? 'photo' : /write|essay|confession|journal|list|lines|grateful/.test(rlo) ? 'writing' : /shower|plank|hold|sit|pushup|squat|camera|edge|ice/.test(rlo) ? 'endurance' : 'writing') : 'writing';
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

                                                                        {/* SPIN WHEEL */}
                                                                        {o.type === 'spin_wheel' && (() => {
                                                                            const segments = o.config?.segments?.length > 0 ? o.config.segments : WHEEL.map((w: any) => ({ text: w.text, followUpType: /proof|video|selfie|photo|picture|body writing/.test(w.text.toLowerCase()) ? 'photo' : /write|essay|confession|journal|list|lines|grateful/.test(w.text.toLowerCase()) ? 'writing' : /shower|plank|hold|sit|pushup|squat|exercise|ice|edge|camera/.test(w.text.toLowerCase()) ? 'endurance' : 'instant' }));
                                                                            return (
                                                                            <div style={{ textAlign: 'center', padding: '10px 0' }}>
                                                                                {!wheelResult ? (
                                                                                    <>
                                                                                        <div style={{ width: 100, height: 100, margin: '12px auto 20px', borderRadius: '50%', border: `2px solid ${wheelSpinning ? 'rgba(197,160,89,0.5)' : `${R}0.2)`}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: wheelSpinning ? 'rgba(197,160,89,0.06)' : `${R}0.04)`, animation: wheelSpinning ? 'vPulse 0.08s linear infinite' : 'none', transition: 'all 0.2s' }}>
                                                                                            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '2rem', color: wheelSpinning ? 'rgba(197,160,89,0.6)' : `${R}0.3)` }}>{'\u25CE'}</span>
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
                                                                                                setWheelPreview(finalSeg.text);
                                                                                                count++;
                                                                                                if (count > 20) { clearInterval(iv); setWheelSpinning(false); setWheelPreview(null); setWheelResult(finalSeg); setMechDone(true); saveGambleResult({ wheelResult: finalSeg }, 'spin_wheel'); const wft = finalSeg.followUpType || 'writing'; setPendingFollowUp({ orderType: o.type, source: 'Spin Wheel', resultText: finalSeg.text, type: wft === 'instant' ? 'writing' : wft, prompt: finalSeg.followUpPrompt, instruction: finalSeg.followUpInstruction, duration: finalSeg.followUpDuration, target: finalSeg.followUpTarget }); }
                                                                                            }, 100);
                                                                                        }} style={{ padding: '16px 48px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', letterSpacing: '4px', color: '#050508', background: `${R}0.5)`, border: 'none', borderRadius: 8, cursor: 'pointer' }}>
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

                                                                        {/* TRUTH OR DARE */}
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
                                                                                    const tdFollowUp = truthDareChoice === 'truth' ? (o.config?.truthFollowUp || 'writing') : (o.config?.dareFollowUp || 'endurance');
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

                                                                        {/* GREED GAME */}
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
                                                                                            <button onClick={() => { submitTask({ text: `Greed game: ${greedBusted ? 'BUSTED — 0 coins' : `Cashed out ${greedCoins} coins`}` }); setGreedCoins(0); setGreedBusted(false); setGreedCashedOut(false); setMechDone(false); clearGambleResults(); }}
                                                                                                style={{ padding: '14px 36px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', letterSpacing: '3px', color: '#050508', background: 'rgba(80,200,120,0.5)', border: 'none', borderRadius: 8, cursor: 'pointer', animation: 'vFadeIn 0.3s ease' }}>SUBMIT RESULT</button>
                                                                                        )}
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                            );
                                                                        })()}

                                                                        {/* SIMON SAYS */}
                                                                        {o.type === 'simon_says' && (() => {
                                                                            const chain = o.config?.chainTasks?.length > 0 ? o.config.chainTasks : [{ text: 'Stand at attention for 30 seconds', timeLimit: 30 }, { text: 'Drop and give 10 pushups', timeLimit: 60 }, { text: 'Write "I obey" 10 times', timeLimit: 120 }];
                                                                            const current = chain[simonStep];
                                                                            const allDone = simonStep >= chain.length;
                                                                            return (
                                                                            <div style={{ textAlign: 'center', padding: '10px 0' }}>
                                                                                {!allDone && current ? (
                                                                                    <>
                                                                                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.25)', letterSpacing: 2, marginBottom: 8 }}>TASK {simonStep + 1} OF {chain.length}</div>
                                                                                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, margin: '0 0 12px', padding: '14px 18px', background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 8 }}>{current.text}</div>
                                                                                        {current.timeLimit && <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', letterSpacing: 2, marginBottom: 16 }}>{current.timeLimit}s TIME LIMIT</div>}
                                                                                        <button onClick={() => setSimonStep(prev => prev + 1)}
                                                                                            style={{ padding: '14px 36px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', letterSpacing: '3px', color: '#050508', background: `${R}0.5)`, border: 'none', borderRadius: 8, cursor: 'pointer' }}>DONE — NEXT</button>
                                                                                    </>
                                                                                ) : (
                                                                                    <>
                                                                                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1rem', color: 'rgba(80,200,120,0.8)', letterSpacing: 4, marginBottom: 16 }}>ALL TASKS COMPLETE</div>
                                                                                        <button onClick={() => { submitTask({ text: `Simon Says: completed ${chain.length} tasks` }); setSimonStep(0); clearGambleResults(); }}
                                                                                            style={{ padding: '14px 36px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', letterSpacing: '3px', color: '#050508', background: 'rgba(80,200,120,0.5)', border: 'none', borderRadius: 8, cursor: 'pointer', animation: 'vFadeIn 0.3s ease' }}>SUBMIT RESULT</button>
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                            );
                                                                        })()}

                                                                        {/* PAYMENT / TRIBUTE */}
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

                                                                        {/* Text input for writing tasks */}
                                                                        {isTextTask && (
                                                                            <>
                                                                                <textarea value={taskText} onChange={e => setTaskText(e.target.value)} placeholder="Write here..."
                                                                                    style={{ width: '100%', minHeight: 120, background: 'rgba(0,0,0,0.3)', border: `1px solid ${R}0.08)`, borderRadius: 10, padding: 16, color: 'rgba(255,255,255,0.5)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '16px', lineHeight: 1.7, resize: 'vertical', outline: 'none' }} />
                                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                                                                                    <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)' }}>{taskText.split(/\s+/).filter(Boolean).length} words</span>
                                                                                    <button onClick={() => submitTask({ text: taskText })} disabled={!taskText.trim()}
                                                                                        style={{ padding: '12px 28px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', letterSpacing: '3px', color: taskText.trim() ? '#050508' : 'rgba(255,255,255,0.1)', background: taskText.trim() ? `${R}0.5)` : 'transparent', border: `1px solid ${taskText.trim() ? `${R}0.3)` : 'rgba(255,255,255,0.04)'}`, borderRadius: 8, cursor: taskText.trim() ? 'pointer' : 'default' }}>SUBMIT</button>
                                                                                </div>
                                                                            </>
                                                                        )}

                                                                        {/* Photo upload for proof tasks */}
                                                                        {isPhotoTask && (
                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                                                <label style={{ cursor: 'pointer' }}>
                                                                                    <div style={{ padding: '16px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', letterSpacing: '3px', color: taskUploading ? 'rgba(255,255,255,0.2)' : `${R}0.5)`, background: `${R}0.04)`, border: `1px solid ${R}0.12)`, borderRadius: 8, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                                                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                                                                        {taskUploading ? 'UPLOADING...' : 'UPLOAD PROOF'}
                                                                                    </div>
                                                                                    <input type="file" accept="image/*,video/*" capture="environment" style={{ display: 'none' }} onChange={async (e) => {
                                                                                        const file = e.target.files?.[0]; if (!file) return; e.target.value = '';
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

                                                                        {/* Self-report button */}
                                                                        {isSelfReport && (
                                                                            <button onClick={() => submitTask({ text: `${o.type} completed` })}
                                                                                style={{ width: '100%', padding: '16px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', letterSpacing: '3px', color: `${R}0.5)`, background: `${R}0.04)`, border: `1px solid ${R}0.12)`, borderRadius: 8, cursor: 'pointer', textAlign: 'center' }}>
                                                                                MARK COMPLETE
                                                                            </button>
                                                                        )}

                                                                        {/* Fallback for unknown types: show both text + photo */}
                                                                        {!isPhotoTask && !isTextTask && !isSelfReport && !isPayment && !isInteractive && (
                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                                                <textarea value={taskText} onChange={e => setTaskText(e.target.value)} placeholder="Describe your completion..."
                                                                                    style={{ width: '100%', minHeight: 80, background: 'rgba(0,0,0,0.3)', border: `1px solid ${R}0.08)`, borderRadius: 10, padding: 14, color: 'rgba(255,255,255,0.5)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '16px', lineHeight: 1.6, resize: 'vertical', outline: 'none' }} />
                                                                                <label style={{ cursor: 'pointer' }}>
                                                                                    <div style={{ padding: '12px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.75rem', letterSpacing: '2px', color: `${R}0.4)`, background: `${R}0.03)`, border: `1px solid ${R}0.08)`, borderRadius: 8, textAlign: 'center' }}>
                                                                                        + ATTACH PHOTO
                                                                                    </div>
                                                                                    <input type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={async (e) => {
                                                                                        const file = e.target.files?.[0]; if (!file) return; e.target.value = '';
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
                                                                                    style={{ padding: '14px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', letterSpacing: '3px', color: taskText.trim() ? '#050508' : 'rgba(255,255,255,0.1)', background: taskText.trim() ? `${R}0.5)` : 'transparent', border: `1px solid ${taskText.trim() ? `${R}0.3)` : 'rgba(255,255,255,0.04)'}`, borderRadius: 8, cursor: taskText.trim() ? 'pointer' : 'default' }}>SUBMIT</button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </>
                                    );
                                })()}
                            </div>
                        ) : (
                            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 100px' }}>
                                {/* ── LEADERBOARD OF SUFFERING ── */}
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', color: `${R}0.6)`, letterSpacing: '4px', textAlign: 'center', marginBottom: 14 }}>LEADERBOARD OF SUFFERING</div>
                                {[
                                    { r: 1, n: 'Subject #12', d: 93, s: 5 },
                                    { r: 2, n: 'Subject #47', d: 47, s: 3, you: true },
                                    { r: 3, n: 'Subject #31', d: 34, s: 2 },
                                    { r: 4, n: 'Subject #08', d: 21, s: 1 },
                                ].map(e => (
                                    <div key={e.r} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', background: e.you ? `${R}0.03)` : 'transparent', borderLeft: e.you ? `2px solid ${R}0.25)` : '2px solid transparent', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.8rem', color: e.r === 1 ? 'rgba(197,160,89,0.6)' : 'rgba(255,255,255,0.2)', minWidth: 20 }}>{String(e.r).padStart(2, '0')}</span>
                                        <span style={{ flex: 1, fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: e.you ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.35)', letterSpacing: '1px' }}>{e.n}</span>
                                        <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', letterSpacing: '1px' }}>{e.d}d &middot; {e.s}x</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Chat footer */}
                        {t === 'chat' && !isLocked && (
                            <div style={{ padding: '12px 16px', borderTop: `1px solid ${R}0.08)`, display: 'flex', gap: 10 }}>
                                <input type="text" placeholder="Transmit..." style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: `1px solid ${R}0.1)`, borderRadius: 8, padding: '10px 14px', color: 'rgba(255,255,255,0.4)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.75rem', outline: 'none' }} />
                                <button style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke={`${R}0.5)`} strokeWidth="2" strokeLinecap="round" /><path d="M22 2L15 22L11 13L2 9L22 2Z" stroke={`${R}0.5)`} strokeWidth="2" strokeLinecap="round" /></svg>
                                </button>
                            </div>
                        )}
                    </div>
                );
            })}

            {/* ══════════════════════════════════════════════
                FOLLOW-UP TASK OVERLAY (after gamble result)
            ══════════════════════════════════════════════ */}
            {followUp && (() => {
                const mid = profile?.member_id || profile?.memberId || '';
                const submitFollowUp = async (opts: { text?: string; photoUrl?: string }) => {
                    setTaskSubmitted(p => ({ ...p, [followUp.orderType]: true }));
                    try {
                        const resp = await fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'submit_task', memberId: mid, orderType: followUp.orderType, text: opts.text || null, photoUrl: opts.photoUrl || null, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
                        });
                        const result = await resp.json();
                        if (!resp.ok) alert('Submit failed: ' + (result.error || 'unknown error'));
                        setFollowUp(null); setFollowUpText(''); clearGambleResults();
                        if (mid) {
                            fetch(`/api/vault/session?memberId=${encodeURIComponent(mid)}`).then(r => r.json()).then(vd2 => {
                                if (vd2.active) setVaultData(vd2);
                            }).catch(() => {});
                        }
                    } catch (e: any) { alert('Submit failed: ' + e?.message); }
                };
                return (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#050508', display: 'flex', flexDirection: 'column', overflow: 'auto' } as React.CSSProperties}>
                        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, background: 'radial-gradient(ellipse at 50% 20%, rgba(139,0,0,0.08) 0%, transparent 60%)' }} />
                        {/* Skip button */}
                        <button onClick={() => setFollowUpSkipping(!followUpSkipping)} style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Orbitron, sans-serif', fontSize: '0.6rem', color: 'rgba(255,255,255,0.15)', letterSpacing: 2, padding: '8px 12px' }}>{followUpSkipping ? 'BACK' : 'SKIP'}</button>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '70px 20px 24px', position: 'relative', zIndex: 5 }}>
                            {/* Source label */}
                            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.15)', letterSpacing: 4, textAlign: 'center', marginBottom: 40 }}>{followUp.source.toUpperCase()}</div>
                            {/* Thin gold line */}
                            <div style={{ width: 40, height: 1, background: `${R}0.2)`, marginBottom: 50 }} />
                            {/* What they got */}
                            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.05rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.7, textAlign: 'center', marginBottom: 40 }}>{followUp.resultText}</div>
                            {/* Follow-up instruction */}
                            {(followUp.prompt || followUp.instruction) && (
                                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', lineHeight: 1.7, textAlign: 'center', marginBottom: 40, fontStyle: 'italic' }}>{followUp.prompt || followUp.instruction}</div>
                            )}
                            {followUp.duration && (
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.2)', letterSpacing: 3, textAlign: 'center', marginBottom: 40 }}>{Math.floor(followUp.duration / 60)}:{String(followUp.duration % 60).padStart(2, '0')} DURATION</div>
                            )}
                            {/* Another thin line */}
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
                                            style={{ padding: '14px 32px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem', letterSpacing: '3px', color: ok ? '#050508' : 'rgba(255,255,255,0.08)', background: ok ? `${R}0.5)` : 'transparent', border: `1px solid ${ok ? `${R}0.3)` : 'rgba(255,255,255,0.03)'}`, borderRadius: 8, cursor: ok ? 'pointer' : 'default' }}>SUBMIT</button>
                                    </div>
                                    <textarea value={followUpText} onChange={e => setFollowUpText(e.target.value)} placeholder="Write here..."
                                        style={{ width: '100%', minHeight: '35vh', background: 'rgba(255,255,255,0.03)', border: `1px solid ${R}0.1)`, borderRadius: 10, padding: 16, color: 'rgba(255,255,255,0.5)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.9rem', lineHeight: 1.7, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
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

                            {/* ENDURANCE follow-up — requires written report of completion */}
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
                                            style={{ padding: '14px 32px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem', letterSpacing: '3px', color: ok ? '#050508' : 'rgba(255,255,255,0.08)', background: ok ? `${R}0.5)` : 'transparent', border: `1px solid ${ok ? `${R}0.3)` : 'rgba(255,255,255,0.03)'}`, borderRadius: 8, cursor: ok ? 'pointer' : 'default' }}>SUBMIT</button>
                                    </div>
                                    <textarea value={followUpText} onChange={e => setFollowUpText(e.target.value)} placeholder="Describe how you completed this task..."
                                        style={{ width: '100%', minHeight: 220, background: 'rgba(255,255,255,0.03)', border: `1px solid ${R}0.1)`, borderRadius: 10, padding: 16, color: 'rgba(255,255,255,0.5)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.9rem', lineHeight: 1.7, resize: 'vertical', outline: 'none', boxSizing: 'border-box', marginBottom: 12 }} />
                                    <label style={{ cursor: 'pointer', display: 'block' }}>
                                        <div style={{ padding: '14px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '2px', color: followUpUploading ? 'rgba(255,255,255,0.15)' : '#c5a059', background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', border: '1px solid #c5a059', borderRadius: 10, textAlign: 'center', boxShadow: '0 0 15px rgba(197,160,89,0.2)' }}>
                                            {followUpUploading ? 'UPLOADING...' : '+ ATTACH PROOF'}
                                        </div>
                                        <input type="file" accept="image/*,video/*" capture="environment" style={{ display: 'none' }} onChange={async (e) => {
                                            const file = e.target.files?.[0]; if (!file) return; e.target.value = '';
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

                            {/* INSTANT follow-up — auto-acknowledged */}
                            {followUp.type === 'instant' && (
                                <button onClick={() => submitFollowUp({ text: `${followUp.source}: ${followUp.resultText}` })}
                                    style={{ padding: '16px 48px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem', letterSpacing: '3px', color: '#050508', background: `${R}0.5)`, border: 'none', borderRadius: 8, cursor: 'pointer' }}>ACKNOWLEDGE</button>
                            )}

                            {/* SKIP OPTIONS OVERLAY */}
                            {followUpSkipping && (
                                <div style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(5,5,8,0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 30, gap: 24, animation: 'vFadeIn 0.3s ease' }}>
                                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'rgba(255,255,255,0.5)', letterSpacing: 2, textAlign: 'center', lineHeight: 1.7 }}>Skip this task?</div>
                                    <div style={{ width: 40, height: 1, background: 'rgba(255,255,255,0.06)' }} />

                                    {/* Pay 300 coins */}
                                    <button onClick={async () => {
                                        const coins = profile?.wallet ?? 0;
                                        if (coins < 300) { alert('Not enough coins. 300 required.'); return; }
                                        try {
                                            const res = await fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'skip_order', memberId: mid, orderType: followUp.orderType, cost: 300 }) });
                                            const data = await res.json();
                                            if (data.success) {
                                                setProfile((p: any) => ({ ...p, wallet: (p?.wallet || 0) - 300 }));
                                                setFollowUp(null); setFollowUpText(''); setFollowUpSkipping(false);
                                                if (mid) { fetch(`/api/vault/session?memberId=${encodeURIComponent(mid)}`).then(r => r.json()).then(vd2 => { if (vd2.active) setVaultData(vd2); }); }
                                            }
                                        } catch {}
                                    }} style={{
                                        width: '100%', maxWidth: 300, padding: '18px 20px', borderRadius: 12,
                                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                                        cursor: 'pointer', textAlign: 'center',
                                    }}>
                                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', letterSpacing: 3, marginBottom: 6 }}>PAY 300 COINS</div>
                                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: 'rgba(255,60,60,0.4)', letterSpacing: 1 }}>BREAKS OBEDIENCE STREAK</div>
                                    </button>

                                    {/* Use skip pass */}
                                    <button disabled={!(profile?.skippass > 0)} onClick={async () => {
                                        try {
                                            const res = await fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'skip_order', memberId: mid, orderType: followUp.orderType, useSkipPass: true }) });
                                            const data = await res.json();
                                            if (data.success) {
                                                setProfile((p: any) => ({ ...p, skippass: Math.max(0, (p?.skippass || 0) - 1) }));
                                                setFollowUp(null); setFollowUpText(''); setFollowUpSkipping(false);
                                                if (mid) { fetch(`/api/vault/session?memberId=${encodeURIComponent(mid)}`).then(r => r.json()).then(vd2 => { if (vd2.active) setVaultData(vd2); }); }
                                            }
                                        } catch {}
                                    }} style={{
                                        width: '100%', maxWidth: 300, padding: '18px 20px', borderRadius: 12,
                                        background: (profile?.skippass > 0) ? 'rgba(197,160,89,0.04)' : 'transparent',
                                        border: `1px solid ${(profile?.skippass > 0) ? 'rgba(197,160,89,0.2)' : 'rgba(255,255,255,0.04)'}`,
                                        cursor: (profile?.skippass > 0) ? 'pointer' : 'default', textAlign: 'center',
                                        opacity: (profile?.skippass > 0) ? 1 : 0.3,
                                    }}>
                                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.75rem', color: (profile?.skippass > 0) ? 'rgba(197,160,89,0.6)' : 'rgba(255,255,255,0.15)', letterSpacing: 3, marginBottom: 6 }}>USE SKIP PASS</div>
                                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', letterSpacing: 1 }}>{profile?.skippass || 0} AVAILABLE</div>
                                    </button>

                                    <button onClick={() => setFollowUpSkipping(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.15)', letterSpacing: 2, padding: '12px', marginTop: 8 }}>CANCEL</button>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* ══════════════════════════════════════════════
                BEG MODAL
            ══════════════════════════════════════════════ */}
            {showBeg && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => !begSent && setShowBeg(false)}>
                    <div style={{ width: '100%', maxWidth: 380, background: '#0a0a0e', border: `1px solid ${R}0.12)`, borderRadius: 16, padding: '28px 22px' }} onClick={e => e.stopPropagation()}>
                        {!begSent ? (
                            <>
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', color: `${R}0.7)`, letterSpacing: '4px', textAlign: 'center', marginBottom: 6 }}>BEG FOR RELEASE</div>
                                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 20, lineHeight: 1.6 }}>Choose your words carefully.<br />Queen Karin will decide your fate.</div>
                                <textarea value={begText} onChange={e => setBegText(e.target.value)} placeholder="Please, Queen Karin..." style={{ width: '100%', minHeight: 110, background: `${R}0.02)`, border: `1px solid ${R}0.1)`, borderRadius: 10, padding: 14, color: 'rgba(255,255,255,0.5)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '16px', lineHeight: 1.6, resize: 'vertical', outline: 'none' }} />
                                <button onClick={() => {
                                    setBegSent(true);
                                    // Record beg in DB
                                    if (vaultData?.session?.id) {
                                        fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'beg', memberId: profile?.member_id || profile?.memberId || '', message: begText }) }).catch(() => {});
                                    }
                                }} disabled={!begText.trim()} style={{ marginTop: 14, width: '100%', padding: '14px', fontFamily: 'Cinzel, serif', fontSize: '0.9rem', letterSpacing: '3px', color: begText.trim() ? `${R}0.65)` : 'rgba(255,255,255,0.08)', background: begText.trim() ? `${R}0.04)` : 'transparent', border: `1px solid ${begText.trim() ? `${R}0.18)` : 'rgba(255,255,255,0.04)'}`, borderRadius: 8, cursor: begText.trim() ? 'pointer' : 'default' }}>SUBMIT YOUR BEG</button>
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '16px 0' }}>
                                <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke={`${R}0.35)`} strokeWidth="1.5" style={{ marginBottom: 14 }}><path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2Z" /></svg>
                                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>Your plea has been sent.</div>
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '3px' }}>AWAIT HER DECISION</div>
                                <button onClick={() => { setShowBeg(false); setBegSent(false); setBegText(''); }} style={{ marginTop: 20, padding: '10px 24px', fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', letterSpacing: '2px', color: 'rgba(255,255,255,0.5)', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, cursor: 'pointer' }}>CLOSE</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════
                DAY DETAIL MODAL — tap a calendar dot to see
            ══════════════════════════════════════════════ */}
            {selectedDay && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setSelectedDay(null)}>
                    <div style={{ width: '100%', maxWidth: 400, maxHeight: '85vh', overflowY: 'auto', background: '#0a0a0e', border: `1px solid ${R}0.15)`, borderRadius: 16, padding: '24px 20px' }} onClick={e => e.stopPropagation()}>

                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <div>
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: `${R}0.7)`, letterSpacing: '4px' }}>DAY {selectedDay.day}</div>
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', letterSpacing: '1px', marginTop: 4 }}>{new Date(selectedDay.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {selectedDay.seal && (
                                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: selectedDay.seal === 'bronze' ? '#cd7f32' : selectedDay.seal === 'silver' ? '#c0c0c0' : selectedDay.seal === 'gold' ? '#c5a059' : '#b9f2ff', letterSpacing: '2px', padding: '3px 8px', border: `1px solid ${selectedDay.seal === 'bronze' ? 'rgba(205,127,50,0.3)' : selectedDay.seal === 'silver' ? 'rgba(192,192,192,0.3)' : 'rgba(197,160,89,0.3)'}`, borderRadius: 4 }}>
                                        {selectedDay.seal.toUpperCase()} SEAL
                                    </div>
                                )}
                                <div style={{
                                    width: 24, height: 24, borderRadius: '50%',
                                    background: selectedDay.perfect ? `${R}0.08)` : 'rgba(255,40,40,0.06)',
                                    border: `1px solid ${selectedDay.perfect ? `${R}0.3)` : 'rgba(255,40,40,0.2)'}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    {selectedDay.perfect
                                        ? <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#8b0000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                                        : <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="rgba(255,40,40,0.5)" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                    }
                                </div>
                            </div>
                        </div>

                        {/* Status banner */}
                        <div style={{
                            textAlign: 'center', padding: '10px 14px', marginBottom: 20, borderRadius: 8,
                            background: selectedDay.perfect ? `${R}0.04)` : 'rgba(255,40,40,0.03)',
                            border: `1px solid ${selectedDay.perfect ? `${R}0.1)` : 'rgba(255,40,40,0.08)'}`,
                        }}>
                            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: selectedDay.perfect ? `${R}0.65)` : 'rgba(255,40,40,0.55)', letterSpacing: '2px' }}>
                                {selectedDay.perfect ? 'PERFECT OBEDIENCE' : 'DISOBEDIENT'}
                            </div>
                        </div>

                        {/* Orders checklist */}
                        <div style={{ marginBottom: 20 }}>
                            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '3px', marginBottom: 10 }}>ORDERS</div>
                            {selectedDay.orders.map((o, i) => {
                                const completed = o.done >= o.target;
                                const label = o.type === 'kneel' ? `Kneel ${o.target} times` : o.type === 'chastity_check' ? 'Chastity check photo' : o.type === 'spin' ? 'Spin the wheel' : o.type === 'trial' ? 'Complete daily trial' : o.type === 'tribute' ? `Tribute ${o.target} coins` : o.type === 'silence' ? 'No messages today' : o.type;
                                return (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        <div style={{
                                            width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                                            border: `1px solid ${completed ? `${R}0.3)` : 'rgba(255,255,255,0.06)'}`,
                                            background: completed ? `${R}0.08)` : 'transparent',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            {completed && <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#8b0000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                                        </div>
                                        <span style={{ flex: 1, fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: completed ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.25)', textDecoration: completed ? 'none' : 'none' }}>{label}</span>
                                        {o.type === 'kneel' && !completed && (
                                            <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.75rem', color: 'rgba(255,40,40,0.45)' }}>{o.done}/{o.target}</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Trial */}
                        {selectedDay.trial && (
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '3px', marginBottom: 10 }}>TRIAL</div>
                                <div style={{ background: `${R}0.03)`, border: `1px solid ${R}0.1)`, borderRadius: 10, padding: '16px 18px' }}>
                                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: `${R}0.7)`, lineHeight: 1.6, marginBottom: 10 }}>{selectedDay.trial.prompt}</div>
                                    <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,0.05)', margin: '8px 0' }} />
                                    <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, fontStyle: 'italic' }}>
                                        &ldquo;{selectedDay.trial.response}&rdquo;
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Spin result */}
                        {selectedDay.spin && (
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '3px', marginBottom: 10 }}>WHEEL RESULT</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: `${R}0.03)`, border: `1px solid ${R}0.1)`, borderRadius: 10, padding: '14px 16px' }}>
                                    <span style={{ fontSize: '1.1rem', opacity: 0.5 }}>&#9819;</span>
                                    <div>
                                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{selectedDay.spin.text}</div>
                                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', color: selectedDay.spin.type === 'reward' ? 'rgba(80,200,120,0.45)' : selectedDay.spin.type === 'punishment' ? `${R}0.45)` : 'rgba(255,255,255,0.15)', letterSpacing: '2px', marginTop: 3, textTransform: 'uppercase' }}>{selectedDay.spin.type}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tribute */}
                        {selectedDay.tribute > 0 && (
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '3px', marginBottom: 10 }}>TRIBUTE</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: `${R}0.03)`, border: `1px solid ${R}0.1)`, borderRadius: 10, padding: '14px 16px' }}>
                                    <svg width="18" height="18" viewBox="0 0 512 512" fill={`${R}0.55)`}><path d="M512 80c0 18-14.3 34.6-38.4 48c-29.1 16.1-72.5 27.5-122.3 30.9c-3.7-1.8-7.4-3.5-11.3-5C300.6 137.4 248.2 128 192 128c-8.3 0-16.4 .2-24.5 .6l-1.1-.6C142.3 114.6 128 98 128 80c0-44.2 86-80 192-80S512 35.8 512 80z" /></svg>
                                    <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', color: `${R}0.6)`, fontWeight: 700 }}>{selectedDay.tribute}</span>
                                    <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '2px' }}>COINS TRIBUTED</span>
                                </div>
                            </div>
                        )}

                        {/* Close */}
                        <button onClick={() => setSelectedDay(null)} style={{ width: '100%', padding: '13px', fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', letterSpacing: '3px', color: 'rgba(255,255,255,0.5)', background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, cursor: 'pointer', marginTop: 4 }}>CLOSE</button>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════
                BOTTOM NAV — 5 tabs matching /profile
            ══════════════════════════════════════════════ */}
            <nav style={{
                position: 'fixed', bottom: 0, left: 0, right: 0,
                width: '100%',
                background: 'rgba(5,5,8,0.95)', backdropFilter: 'blur(20px)',
                borderTop: `1px solid ${R}0.12)`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-around',
                height: 'calc(68px + env(safe-area-inset-bottom, 0px))',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                zIndex: 60,
            }}>
                <NavBtn active={tab === 'vault'} icon="&#9670;" label="VAULT" onClick={() => { setVladOpen(false); setTab('vault'); }} />
                <NavBtn active={tab === 'challenge'} label="WORK" onClick={() => { setVladOpen(false); setTab('challenge'); }}
                    icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 7 7 7 7"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C17 4 17 7 17 7"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>} />

                {/* Center Queen button */}
                <button onClick={() => { setVladOpen(false); setTab('chat'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, position: 'relative', transform: 'translateY(6px)', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 0, overflow: 'visible' }}>
                    <div style={{
                        width: 112, height: 112, borderRadius: '50%',
                        border: `2px solid ${tab === 'chat' ? `${R}0.5)` : `${R}0.15)`}`,
                        overflow: 'hidden',
                        boxShadow: tab === 'chat' ? `0 0 16px ${R}0.15)` : 'none',
                        flexShrink: 0,
                    }}>
                        <img src="/queen-nav.png" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Q" />
                    </div>
                    {!chatOk && (
                        <div style={{ position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: '50%', background: '#050508', border: `1px solid ${R}0.3)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg viewBox="0 0 24 24" width="8" height="8" fill={`${R}0.5)`}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                        </div>
                    )}
                </button>

                <NavBtn active={tab === 'queen'} icon="&#9819;" label="RECORD" onClick={() => { setVladOpen(false); setTab('queen'); }} />
                <NavBtn active={tab === 'global'} icon="&#9678;" label="UNION" onClick={() => { setVladOpen(false); setTab('global'); }} locked={!globalOk} />
            </nav>

            {/* ── FLOATING VLAD AVATAR + SPEECH BUBBLE ── */}
            {!vladOpen && (
                <div style={{ position: 'fixed', bottom: 90, right: 12, zIndex: 150, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
                    {/* Speech bubble — pops up when Vlad has something to say */}
                    {vladBubble && (
                        <div onClick={() => { setVladOpen(true); setVladPulse(false); setVladBubble(''); }} style={{
                            maxWidth: 250, padding: '12px 16px',
                            background: 'rgba(8,4,12,0.97)', border: '1px solid rgba(197,160,89,0.12)',
                            borderRadius: '16px 16px 4px 16px',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.8), 0 0 20px rgba(139,0,0,0.06), inset 0 1px 0 rgba(197,160,89,0.05)',
                            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.73rem',
                            color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, cursor: 'pointer',
                            animation: 'vFadeIn 0.3s ease', letterSpacing: '0.3px',
                        }}>{vladBubble.length > 120 ? vladBubble.slice(0, 120) + '...' : vladBubble}</div>
                    )}
                    {/* Avatar button */}
                    <button onClick={() => { setVladOpen(true); setVladPulse(false); setVladBubble(''); if (vladMsgs.length === 0) vladReact('Member just opened the vault page. Greet them — you can see they\'re locked up. Be sarcastic but welcoming.'); }} style={{
                        width: 80, height: 80, borderRadius: '50%', padding: 0,
                        border: vladPulse ? '2.5px solid rgba(139,0,0,0.7)' : '2px solid rgba(139,0,0,0.45)',
                        cursor: 'pointer', overflow: 'hidden', flexShrink: 0,
                        boxShadow: vladPulse
                            ? '0 0 24px rgba(197,160,89,0.35), 0 0 8px rgba(139,0,0,0.4), 0 4px 20px rgba(0,0,0,0.6)'
                            : '0 0 15px rgba(197,160,89,0.15), 0 4px 24px rgba(0,0,0,0.6)',
                        animation: vladPulse ? 'vladPulse 1.5s ease infinite' : 'none',
                        background: 'none',
                    }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/vlad-avatar.png" alt="Vlad" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%', display: 'block' }} />
                    </button>
                </div>
            )}

            {/* ── VLAD CHAT PANEL — full-screen overlay ── */}
            {vladOpen && (
                <div onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} style={{
                    position: 'fixed', top: 0, left: 0, right: 0,
                    bottom: 'calc(68px + env(safe-area-inset-bottom, 0px))',
                    zIndex: 55,
                    background: 'linear-gradient(170deg, #06050a 0%, #0a0810 40%, #080712 100%)',
                    display: 'flex', flexDirection: 'column',
                    animation: 'vFadeIn 0.2s ease', overflow: 'hidden',
                }}>
                    {/* BG glow */}
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at 50% 15%, rgba(139,0,0,0.04) 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, rgba(197,160,89,0.02) 0%, transparent 50%)' }} />

                    {/* Header */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '16px 20px', paddingTop: 'calc(env(safe-area-inset-top, 16px) + 10px)',
                        borderBottom: '1px solid rgba(197,160,89,0.08)',
                        background: 'rgba(139,0,0,0.02)',
                        position: 'relative', zIndex: 1,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(139,0,0,0.5)', flexShrink: 0, boxShadow: '0 0 18px rgba(197,160,89,0.15), 0 0 6px rgba(139,0,0,0.2)' }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/vlad-avatar.png" alt="Vlad" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} />
                            </div>
                            <div>
                                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: 'rgba(197,160,89,0.65)', letterSpacing: '5px' }}>VLAD</div>
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', letterSpacing: '2px' }}>GUARDIAN DEMON</div>
                            </div>
                        </div>
                        <button onClick={() => setVladOpen(false)} style={{
                            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 10, cursor: 'pointer', width: 36, height: 36,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'rgba(255,255,255,0.3)', fontSize: '1.2rem', lineHeight: 1,
                        }}>&times;</button>
                    </div>

                    {/* Messages */}
                    <div ref={vladScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', zIndex: 1 }}>
                        {vladMsgs.map((m, i) => (
                            <div key={i} style={{
                                display: 'flex', gap: 10,
                                flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
                                alignItems: 'flex-end',
                            }}>
                                {m.role === 'vlad' && (
                                    <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', border: '1.5px solid rgba(139,0,0,0.35)', flexShrink: 0, boxShadow: '0 0 8px rgba(197,160,89,0.08)' }}>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src="/vlad-avatar.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} />
                                    </div>
                                )}
                                <div style={{
                                    maxWidth: '80%', padding: '12px 16px',
                                    borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                    background: m.role === 'user'
                                        ? 'rgba(255,255,255,0.03)'
                                        : 'rgba(139,0,0,0.04)',
                                    border: `1px solid ${m.role === 'user' ? 'rgba(255,255,255,0.07)' : 'rgba(197,160,89,0.08)'}`,
                                    fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.88rem',
                                    color: m.role === 'user' ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.55)',
                                    lineHeight: 1.7, letterSpacing: '0.2px',
                                }}>{m.text}</div>
                            </div>
                        ))}
                        {vladSending && (
                            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', border: '1.5px solid rgba(139,0,0,0.35)', flexShrink: 0, boxShadow: '0 0 8px rgba(197,160,89,0.08)' }}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src="/vlad-avatar.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} />
                                </div>
                                <div style={{ padding: '12px 16px', borderRadius: '16px 16px 16px 4px', background: 'rgba(139,0,0,0.04)', border: '1px solid rgba(197,160,89,0.08)' }}>
                                    <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.88rem', color: 'rgba(255,255,255,0.2)', animation: 'vPulse 1s ease infinite' }}>typing...</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input — fontSize 16px to prevent iOS zoom */}
                    <div style={{
                        display: 'flex', gap: 10, padding: '12px 16px 14px',
                        borderTop: '1px solid rgba(197,160,89,0.06)',
                        background: 'rgba(0,0,0,0.2)',
                        position: 'relative', zIndex: 1,
                    }}>
                        <input
                            value={vladInput}
                            onChange={e => setVladInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && vladInput.trim()) { sendVladMsg(vladInput.trim()); setVladInput(''); } }}
                            placeholder="Talk to Vlad..."
                            style={{
                                flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                                borderRadius: 14, padding: '12px 16px', color: 'rgba(255,255,255,0.5)',
                                fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '16px',
                                outline: 'none',
                            }}
                        />
                        <button
                            disabled={vladSending || !vladInput.trim()}
                            onClick={() => { if (vladInput.trim()) { sendVladMsg(vladInput.trim()); setVladInput(''); } }}
                            style={{
                                padding: '10px 18px', background: 'rgba(139,0,0,0.08)',
                                border: '1px solid rgba(197,160,89,0.12)', borderRadius: 14,
                                fontFamily: 'Orbitron, sans-serif', fontSize: '0.75rem', letterSpacing: '2px',
                                color: vladSending ? 'rgba(255,255,255,0.1)' : 'rgba(197,160,89,0.5)',
                                cursor: vladSending ? 'default' : 'pointer',
                            }}>SEND</button>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes vFadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
                @keyframes vPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
                @keyframes vCoinFlip { 0% { transform: scaleX(1); } 50% { transform: scaleX(0.05); } 100% { transform: scaleX(1); } }
                @keyframes vShake { 0%, 100% { transform: translateX(0) rotate(0deg); } 15% { transform: translateX(-2px) rotate(-1deg); } 30% { transform: translateX(2px) rotate(1deg); } 45% { transform: translateX(-1px) rotate(-0.5deg); } 60% { transform: translateX(1px) rotate(0.5deg); } 75% { transform: translateX(0); } }
                @keyframes vSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes vladPulse { 0%, 100% { box-shadow: 0 0 12px rgba(197,160,89,0.15), 0 0 4px rgba(139,0,0,0.3); } 50% { box-shadow: 0 0 28px rgba(197,160,89,0.35), 0 0 10px rgba(139,0,0,0.45); } }
                * { box-sizing: border-box; }
                ::-webkit-scrollbar { display: none; }
                * { -ms-overflow-style: none; scrollbar-width: none; }
                textarea:focus, input:focus { border-color: rgba(139,0,0,0.25) !important; }
                body { background-image: none !important; background-color: #080810 !important; }

                /* Vault timer boxes: red override */
                .card-t-box {
                    color: #8b0000 !important;
                    text-shadow: 0 0 10px rgba(139,0,0,0.3) !important;
                }
            `}</style>
        </div>
    );
}

function NavBtn({ active, icon, label, onClick, locked }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void; locked?: boolean }) {
    const color = active ? `rgba(139,0,0,0.7)` : 'rgba(255,255,255,0.2)';
    return (
        <button onClick={onClick} style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', padding: '8px 0', position: 'relative', flex: 1 }}>
            <span style={{ fontSize: typeof icon === 'string' ? '1.6rem' : undefined, color, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '1.6rem' }}>{icon}</span>
            <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.55rem', color, letterSpacing: '2px' }}>{label}</span>
            {locked && (
                <div style={{ position: 'absolute', top: -2, right: 2, width: 12, height: 12, borderRadius: '50%', background: '#050508', border: '1px solid rgba(139,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg viewBox="0 0 24 24" width="7" height="7" fill="rgba(139,0,0,0.4)"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                </div>
            )}
        </button>
    );
}
