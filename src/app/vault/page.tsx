'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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

// Today's orders (mock — will be generated/set from vault_daily)
const TODAYS_ORDERS = [
    { type: 'kneel', label: 'Kneel 8 times', target: 8, done: 2 },
    { type: 'spin', label: 'Spin the wheel', target: 1, done: 0 },
    { type: 'trial', label: 'Complete daily trial', target: 1, done: 0 },
    { type: 'tribute', label: 'Tribute 5 coins', target: 5, done: 0 },
];

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

export default function VaultPage() {
    const [profile, setProfile] = useState<any>(null);
    const [vaultData, setVaultData] = useState<any>(null); // real DB data from /api/vault/session
    const [elapsed, setElapsed] = useState(fmt(Date.now() - new Date(MOCK.lockStart).getTime()));
    const [remaining, setRemaining] = useState(fmt(new Date(MOCK.lockEnd).getTime() - Date.now()));
    const [attentionCount, setAttentionCount] = useState(0);
    const [sanity, setSanity] = useState(MOCK.sanity);
    const [trialOpen, setTrialOpen] = useState(false);
    const [trialText, setTrialText] = useState('');
    const [trialDone, setTrialDone] = useState(false);
    const [spinning, setSpinning] = useState(false);
    const [wheelAngle, setWheelAngle] = useState(0);
    const [wheelResult, setWheelResult] = useState<typeof WHEEL[0] | null>(null);
    const [wheelUsed, setWheelUsed] = useState(false);
    const [showBeg, setShowBeg] = useState(false);
    const [begText, setBegText] = useState('');
    const [begSent, setBegSent] = useState(false);
    const [tab, setTab] = useState<'vault' | 'chat' | 'queen' | 'global' | 'challenge'>('vault');
    const [selectedDay, setSelectedDay] = useState<DayLog | null>(null);
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [attnHolding, setAttnHolding] = useState(false);
    const [attnFill, setAttnFill] = useState(0);
    const [attnResult, setAttnResult] = useState<typeof ATTENTION_TASKS[0] | null>(null);
    const [attnCooldownUntil, setAttnCooldownUntil] = useState(0); // timestamp when cooldown ends
    const [penaltyHours, setPenaltyHours] = useState(0); // hours added to lock sentence
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
    const [kneelToday, setKneelToday] = useState(0);
    const [kneelCooldownUntil, setKneelCooldownUntil] = useState(0);
    const [kneelDone, setKneelDone] = useState(false); // just completed animation
    const kneelTimer = useRef<ReturnType<typeof setInterval> | null>(null);
    const kneelStartTime = useRef(0);
    const kneelCooldown = kneelCooldownUntil > Date.now();
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
    const daysIn = vaultData?.daysIn ?? Math.floor((Date.now() - new Date(MOCK.lockStart).getTime()) / 86400000);
    const lockDays = vaultData?.session?.lock_days ?? MOCK.lockDays;
    const dailyRecords = vaultData?.dailyRecords || [];
    const adjustments = vaultData?.adjustments || [];
    const rawOrders = vaultData?.today?.orders;
    const todayOrders = rawOrders ? (typeof rawOrders === 'string' ? JSON.parse(rawOrders) : rawOrders) : TODAYS_ORDERS;
    const todayPerfect = vaultData?.today?.perfect ?? false;
    const todayRewardClaimed = vaultData?.today?.reward_claimed ?? false;
    const attnCooldown = attnCooldownUntil > Date.now();
    const chatGateCooldown = chatGateCooldownUntil > Date.now();

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
        const lockStart = vaultData?.session?.started_at || MOCK.lockStart;
        const lockEnd = vaultData?.session?.expires_at || MOCK.lockEnd;
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

    // Init profile state from real DB + tribute system
    useEffect(() => {
        const TEST_EMAIL = 'pr.finsko@gmail.com';
        fetch('/api/slave-profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: TEST_EMAIL, full: true }) })
            .then(r => r.json())
            .then(async (data) => {
                console.log('[VAULT] Loaded profile:', data);
                setProfile(data);
                const { initProfileState } = await import('@/scripts/profile-state');
                initProfileState(data);
                // Load vault session from real DB
                const memberId = data.member_id || data.email || TEST_EMAIL;
                fetch(`/api/vault/session?memberId=${encodeURIComponent(memberId)}`)
                    .then(r => r.json())
                    .then(vd => {
                        console.log('[VAULT] Session data:', vd);
                        if (vd.active) {
                            setVaultData(vd);
                            setPenaltyHours(vd.totalPenaltyHours || 0);
                            // Set already-done states from DB
                            if (vd.todaySpin) { setWheelUsed(true); setWheelResult({ text: vd.todaySpin.result_text, type: vd.todaySpin.result_type }); }
                            const todayTrial = (vd.trials || []).find((t: any) => t.date === vd.todayDate);
                            if (todayTrial && (todayTrial.status === 'submitted' || todayTrial.status === 'approved')) setTrialDone(true);
                            // Load kneel status
                            fetch(`/api/kneel-status?memberId=${encodeURIComponent(memberId)}&tz=${Intl.DateTimeFormat().resolvedOptions().timeZone}`)
                                .then(r => r.json())
                                .then(ks => {
                                    if (ks.todayKneeling) setKneelToday(ks.todayKneeling);
                                    if (ks.isLocked && ks.minLeft > 0) setKneelCooldownUntil(Date.now() + ks.minLeft * 60000);
                                }).catch(() => {});
                            // Ensure today's daily record exists and isn't pre-seeded, then re-fetch
                            fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ensure_today', memberId }) })
                                .then(() => fetch(`/api/vault/session?memberId=${encodeURIComponent(memberId)}`))
                                .then(r => r.json())
                                .then(vd2 => { if (vd2.active) setVaultData(vd2); })
                                .catch(() => {});
                        }
                    })
                    .catch(e => console.error('[VAULT] Session fetch failed:', e));
                const { sendChatMessage, handleChatKey, toggleAiMode, sendAiMessage, switchMobChatTab, handleMediaPlus } = await import('@/scripts/profile-logic');
                (window as any).sendChatMessage = sendChatMessage;
                (window as any).handleChatKey = handleChatKey;
                (window as any).toggleAiMode = toggleAiMode;
                (window as any).sendAiMessage = sendAiMessage;
                (window as any).switchMobChatTab = switchMobChatTab;
                (window as any).handleMediaPlus = handleMediaPlus;
                (window as any).handleAiChatKey = (e: any) => { if (e.key === 'Enter') sendAiMessage(); };
            })
            .catch(() => {});
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
            const chatId = profile.ID || profile.member_id || 'pr.finsko@gmail.com';
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
        const memberId = profile?.member_id || 'pr.finsko@gmail.com';
        const memberName = profile?.name || MOCK.name;
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
        const name = profile?.name || MOCK.name;
        const streak = profile?.parameters?.routine_streak || MOCK.streak;
        const coins = profile?.wallet ?? MOCK.coins;
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
        const memberId = profile?.member_id || profile?.ID || 'pr.finsko@gmail.com';
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
                const memberId = profile?.member_id || profile?.ID || 'pr.finsko@gmail.com';
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
                        vladReact(`Member just completed kneeling session #${data.todayKneeling} today. ${data.todayKneeling >= 8 ? 'They hit the daily target!' : `${8 - data.todayKneeling} more to go.`}`);
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
                fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'spin', memberId: profile?.member_id || profile?.email || 'pr.finsko@gmail.com', resultText: WHEEL[idx].text, resultType: WHEEL[idx].type }) }).catch(() => {});
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

    return (
        <div style={{ background: '#050508', minHeight: '100vh', maxWidth: 480, margin: '0 auto', position: 'relative', overflow: 'hidden' }}>

            {/* BG */}
            <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(139,0,0,0.05) 0%, transparent 60%)' }} />

            {/* ══════════════════════════════════════════════
                VAULT TAB — main scroll
            ══════════════════════════════════════════════ */}
            <div style={{ display: tab === 'vault' ? 'flex' : 'none', flexDirection: 'column', alignItems: 'center', paddingBottom: 100, position: 'relative', zIndex: 1, minHeight: '100vh' }}>

                {/* ── HALO HERO SECTION ── */}
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px 0' }}>

                    {/* Big circle */}
                    <div style={{
                        position: 'relative', zIndex: 2,
                        width: 300, height: 300, borderRadius: '50%',
                        border: '2px solid #8b0000',
                        boxShadow: '0 0 40px rgba(139,0,0,0.35), inset 0 0 20px rgba(139,0,0,0.15)',
                        background: 'rgba(0,0,0,0.55)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: 0, overflow: 'hidden',
                    }}>
                        {/* Lock icon */}
                        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="rgba(139,0,0,0.5)" strokeWidth="1.5" style={{ marginBottom: 8 }}>
                            <rect x="3" y="11" width="18" height="11" rx="2" />
                            <path d="M7 11V7a5 5 0 0110 0v4" />
                            <circle cx="12" cy="16" r="1.5" fill="rgba(139,0,0,0.5)" />
                        </svg>

                        {/* Name */}
                        <div style={{
                            fontFamily: 'Cinzel, serif', fontSize: '1.6rem', color: '#fff',
                            textTransform: 'uppercase', letterSpacing: '2px',
                            textShadow: '0 0 20px rgba(139,0,0,0.3)',
                            lineHeight: 1, textAlign: 'center', maxWidth: '85%',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            marginBottom: 5,
                        }}>
                            {profile?.name || MOCK.name}
                        </div>

                        {/* Rank / Status */}
                        <div style={{
                            fontFamily: 'Orbitron, sans-serif', fontSize: '0.6rem',
                            color: '#8b0000', letterSpacing: '4px', textTransform: 'uppercase',
                        }}>
                            SEALED
                        </div>

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
                                const obedient = isPast ? (dailyRecords[i]?.perfect ?? MOCK.dailyObedience[i]) : undefined;
                                const clickable = isPast || isToday;
                                const dayLog = dailyRecords[i] ? _toDayLog(dailyRecords[i]) : MOCK.dailyLogs[i];
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
                    </div>

                    {/* Stats pill — overlapping the circle (matches profile layout) */}
                    <div style={{
                        position: 'relative', zIndex: 3,
                        marginTop: -55, width: '94%',
                        background: 'rgba(10,10,10,0.85)',
                        border: '1px solid rgba(139,0,0,0.2)',
                        borderRadius: 12, padding: '14px 10px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
                        marginBottom: 30,
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: '45%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                <span id="vaultMerit" style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(1.2rem, 5vw, 1.5rem)', color: '#fff', fontWeight: 800, lineHeight: 1 }}>{profile?.score ?? MOCK.merit}</span>
                                <svg width="24" height="24" viewBox="0 0 512 512" fill="#8b0000" style={{ opacity: 0.8 }}><path d="M256 0c17.7 0 32.5 11.5 37.6 28.5l25.6 85.3 89.6-16.4c16.2-3 32.8 5.7 39.5 20.9s1.3 33-12.7 44.5l-69.8 57.6 44.8 80.1c8.4 15 3.9 34.3-10.3 43.6s-32.5 6.4-44.5-6.7L256 270 156.2 337.4c-12 13.1-30.3 16-44.5 6.7s-18.7-28.6-10.3-43.6l44.8-80.1-69.8-57.6c-14-11.5-19.4-30.6-12.7-44.5s23.3-23.9 39.5-20.9l89.6 16.4 25.6-85.3C223.5 11.5 238.3 0 256 0zm0 432c-15.1 0-29.3 6.9-38.6 18.6l-50 62.5c-11.1 13.9-6.9 34.4 7 45.5s34.4 6.9 45.5-7l36.1-45.1 36.1 45.1c11.1 13.9 31.6 18.1 45.5 7s18.1-31.6 7-45.5l-50-62.5c-9.3-11.7-23.5-18.6-38.6-18.6z" /></svg>
                            </div>
                            <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.55rem', color: 'rgba(139,0,0,0.5)', letterSpacing: '2px' }}>MERIT</span>
                        </div>
                        <div style={{ width: 1, height: 50, background: 'rgba(255,255,255,0.06)' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: '45%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                <span id="vaultCoins" style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(1.2rem, 5vw, 1.5rem)', color: '#fff', fontWeight: 800, lineHeight: 1 }}>{profile?.wallet ?? MOCK.coins}</span>
                                <svg width="24" height="24" viewBox="0 0 512 512" fill="#8b0000"><path d="M512 80c0 18-14.3 34.6-38.4 48c-29.1 16.1-72.5 27.5-122.3 30.9c-3.7-1.8-7.4-3.5-11.3-5C300.6 137.4 248.2 128 192 128c-8.3 0-16.4 .2-24.5 .6l-1.1-.6C142.3 114.6 128 98 128 80c0-44.2 86-80 192-80S512 35.8 512 80zM160.7 161.1c10.2-.7 20.7-1.1 31.3-1.1c62.2 0 117.4 12.3 152.5 31.4C369.3 210.6 384 227.2 384 245.6c0 11.4-5.5 22.1-15.2 31.4c-21.2 20.4-66.2 34.1-118.4 34.9c-10.2 .2-20.7 .3-31.3 .3c-62.2 0-117.4-12.3-152.5-31.4C42.7 261.4 28 244.8 28 226.4c0-11.4 5.5-22.1 15.2-31.4c21.2-20.4 66.2-34.1 117.5-33.9z" /></svg>
                            </div>
                            <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.55rem', color: 'rgba(139,0,0,0.5)', letterSpacing: '2px' }}>COINS</span>
                        </div>
                    </div>
                </div>

                {/* ── LOCK STATS ROW (days / denied / streak / trials) ── */}
                <div style={{
                    width: '100%', display: 'flex', justifyContent: 'space-around',
                    padding: '0 20px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    marginBottom: 8,
                }}>
                    {[
                        { v: daysIn, l: 'DAYS LOCKED' },
                        { v: vaultData?.begs?.filter((b: any) => b.status === 'denied').length ?? MOCK.denials, l: 'DENIED' },
                        { v: vaultData?.session?.current_streak ?? MOCK.streak, l: 'STREAK' },
                        { v: vaultData?.trials?.length ?? MOCK.trialsCompleted, l: 'TRIALS' },
                    ].map(s => (
                        <div key={s.l} style={{ textAlign: 'center' }}>
                            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.85rem', color: `${R}0.55)`, fontWeight: 700 }}>{s.v}</div>
                            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.28rem', color: 'rgba(255,255,255,0.1)', letterSpacing: '1.5px', marginTop: 3 }}>{s.l}</div>
                        </div>
                    ))}
                </div>

                {/* ── LOCKED X DAYS AGO ── */}
                <div style={{ textAlign: 'center', padding: '4px 0 8px' }}>
                    <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.35rem', color: 'rgba(255,255,255,0.1)', letterSpacing: '2px' }}>LOCKED </span>
                    <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.4rem', color: `${R}0.4)`, letterSpacing: '1px' }}>{elapsed.d}</span>
                    <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.35rem', color: 'rgba(255,255,255,0.1)', letterSpacing: '2px' }}> {elapsed.d === 1 ? 'DAY' : 'DAYS'} AGO</span>
                </div>

                {/* ── RELEASE COUNTDOWN — profile task timer style ── */}
                <div style={{ width: '100%', padding: '4px 20px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.35rem', color: `${R}0.25)`, letterSpacing: '4px', marginBottom: 12 }}>RELEASE IN</div>
                    {penaltyHours > 0 && (
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.4rem', color: 'rgba(255,40,40,0.4)', letterSpacing: '2px', marginBottom: 8 }}>
                            +{penaltyHours}h ADDED
                        </div>
                    )}
                    <div className="card-timer-row" style={{ gap: 10 }}>
                        <div className="card-t-box" style={{ background: `${R}0.06)`, border: `1px solid ${R}0.15)`, color: '#8b0000', textShadow: '0 0 10px rgba(139,0,0,0.3)', width: 72 }}>
                            {String(remaining.d).padStart(2, '0')}
                            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.28rem', color: `${R}0.3)`, letterSpacing: '2px', marginTop: 2 }}>DAYS</div>
                        </div>
                        <div className="t-sep" style={{ color: `${R}0.25)` }}>:</div>
                        <div className="card-t-box" style={{ background: `${R}0.06)`, border: `1px solid ${R}0.15)`, color: '#8b0000', textShadow: '0 0 10px rgba(139,0,0,0.3)', width: 72 }}>
                            {String(remaining.h).padStart(2, '0')}
                            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.28rem', color: `${R}0.3)`, letterSpacing: '2px', marginTop: 2 }}>HRS</div>
                        </div>
                        <div className="t-sep" style={{ color: `${R}0.25)` }}>:</div>
                        <div className="card-t-box" style={{ background: `${R}0.06)`, border: `1px solid ${R}0.15)`, color: '#8b0000', textShadow: '0 0 10px rgba(139,0,0,0.3)', width: 72 }}>
                            {String(remaining.m).padStart(2, '0')}
                            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.28rem', color: `${R}0.3)`, letterSpacing: '2px', marginTop: 2 }}>MIN</div>
                        </div>
                    </div>
                </div>

                {/* ── OBEDIENCE CALENDAR ── */}
                <div style={{ width: '100%', padding: '0 16px 28px' }}>
                    <button onClick={() => setCalendarOpen(!calendarOpen)} style={{
                        width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 14px', background: `${R}0.03)`, border: `1px solid ${R}0.08)`, borderRadius: 10,
                        cursor: 'pointer', outline: 'none',
                    }}>
                        <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.38rem', color: `${R}0.35)`, letterSpacing: '3px' }}>OBEDIENCE CALENDAR</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.35rem', color: 'rgba(255,255,255,0.15)' }}>
                                {(dailyRecords.length > 0 ? dailyRecords.filter((d: any) => d.perfect).length : MOCK.dailyObedience.filter(Boolean).length)}/{daysIn} PERFECT
                            </span>
                            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.6rem', transform: calendarOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>&#9662;</span>
                        </div>
                    </button>

                    {calendarOpen && (() => {
                        const lockStart = new Date(vaultData?.session?.started_at || MOCK.lockStart);
                        const startDay = (lockStart.getUTCDay() + 6) % 7; // 0=Mon
                        const totalCells = startDay + lockDays;
                        const rows = Math.ceil(totalCells / 7);

                        return (
                            <div style={{ marginTop: 10, background: `${R}0.02)`, border: `1px solid ${R}0.06)`, borderRadius: 10, padding: '14px 10px 10px', animation: 'vFadeIn 0.3s ease' }}>
                                {/* Weekday headers */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 6 }}>
                                    {WEEKDAYS.map(d => (
                                        <div key={d} style={{ textAlign: 'center', fontFamily: 'Rajdhani, sans-serif', fontSize: '0.28rem', color: 'rgba(255,255,255,0.08)', letterSpacing: '1px' }}>{d}</div>
                                    ))}
                                </div>
                                {/* Calendar grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                                    {Array.from({ length: rows * 7 }).map((_, cellIdx) => {
                                        const dayIdx = cellIdx - startDay;
                                        const isValid = dayIdx >= 0 && dayIdx < lockDays;
                                        if (!isValid) return <div key={cellIdx} />;

                                        const isToday = dayIdx === daysIn;
                                        const isPast = dayIdx < daysIn;
                                        const obedient = isPast ? (dailyRecords[dayIdx]?.perfect ?? MOCK.dailyObedience[dayIdx]) : undefined;
                                        const dayLog = dailyRecords[dayIdx] ? _toDayLog(dailyRecords[dayIdx]) : MOCK.dailyLogs[dayIdx];
                                        const cellDate = new Date(lockStart.getTime() + dayIdx * 86400000);
                                        const clickable = (isPast || isToday) && dayLog;

                                        return (
                                            <div key={cellIdx}
                                                onClick={clickable ? () => setSelectedDay(dayLog) : undefined}
                                                style={{
                                                    aspectRatio: '1', borderRadius: 4, display: 'flex', flexDirection: 'column',
                                                    alignItems: 'center', justifyContent: 'center', gap: 1,
                                                    cursor: clickable ? 'pointer' : 'default',
                                                    background: isToday
                                                        ? 'rgba(197,160,89,0.08)'
                                                        : obedient === true
                                                            ? `${R}0.06)`
                                                            : obedient === false
                                                                ? 'rgba(255,40,40,0.04)'
                                                                : 'rgba(255,255,255,0.01)',
                                                    border: `1px solid ${
                                                        isToday
                                                            ? 'rgba(197,160,89,0.25)'
                                                            : obedient === true
                                                                ? `${R}0.15)`
                                                                : obedient === false
                                                                    ? 'rgba(255,40,40,0.12)'
                                                                    : 'rgba(255,255,255,0.03)'
                                                    }`,
                                                    transition: 'all 0.2s ease',
                                                    animation: isToday ? 'vPulse 2s ease-in-out infinite' : 'none',
                                                    position: 'relative',
                                                }}>
                                                <span style={{
                                                    fontFamily: 'Orbitron, monospace', fontSize: '0.4rem',
                                                    color: isToday
                                                        ? 'rgba(197,160,89,0.6)'
                                                        : obedient === true
                                                            ? `${R}0.5)`
                                                            : obedient === false
                                                                ? 'rgba(255,40,40,0.35)'
                                                                : 'rgba(255,255,255,0.08)',
                                                }}>{cellDate.getUTCDate()}</span>
                                                {isPast && (
                                                    <div style={{
                                                        width: 4, height: 4, borderRadius: '50%',
                                                        background: obedient ? '#8b0000' : 'rgba(255,40,40,0.3)',
                                                    }} />
                                                )}
                                                {/* Seal badge on milestone days */}
                                                {dayLog?.seal && (
                                                    <div style={{
                                                        position: 'absolute', top: 1, right: 1, width: 6, height: 6, borderRadius: '50%',
                                                        background: dayLog.seal === 'bronze' ? '#cd7f32' : dayLog.seal === 'silver' ? '#c0c0c0' : dayLog.seal === 'gold' ? '#c5a059' : '#b9f2ff',
                                                    }} />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                {/* Legend */}
                                <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.02)' }}>
                                    {[
                                        { color: '#8b0000', label: 'PERFECT' },
                                        { color: 'rgba(255,40,40,0.3)', label: 'FAILED' },
                                        { color: 'rgba(197,160,89,0.5)', label: 'TODAY' },
                                    ].map(l => (
                                        <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: l.color }} />
                                            <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.28rem', color: 'rgba(255,255,255,0.08)', letterSpacing: '1px' }}>{l.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* ── KNEEL BAR ── */}
                <div style={{ width: '100%', padding: '28px 20px 12px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '100%', maxWidth: 340, position: 'relative' }}>
                        <div
                            onPointerDown={kneelDown}
                            onPointerUp={kneelUp}
                            onPointerLeave={kneelUp}
                            onPointerCancel={kneelUp}
                            onContextMenu={(e) => e.preventDefault()}
                            style={{
                                position: 'relative', width: '100%', height: 52, borderRadius: 26,
                                background: kneelDone ? 'rgba(80,200,120,0.06)' : `${R}0.06)`,
                                border: `1.5px solid ${kneelDone ? 'rgba(80,200,120,0.3)' : `${R}${kneelHolding ? '0.4' : '0.15'})`}`,
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
                                    fontFamily: 'Orbitron, sans-serif', fontSize: '0.5rem',
                                    letterSpacing: '4px',
                                    color: kneelDone ? 'rgba(80,200,120,0.5)' : kneelCooldown ? 'rgba(255,255,255,0.08)' : `${R}0.55)`,
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
                    {/* Kneel progress dots */}
                    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} style={{
                                width: 8, height: 8, borderRadius: '50%',
                                background: i < kneelToday ? '#8b0000' : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${i < kneelToday ? 'rgba(139,0,0,0.5)' : 'rgba(255,255,255,0.06)'}`,
                                transition: 'all 0.3s ease',
                            }} />
                        ))}
                    </div>
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
                            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', lineHeight: 1.8, marginBottom: 24 }}>
                                You couldn&apos;t even obey a simple order.<br />
                                Queen is disappointed.
                            </div>
                            <div style={{ width: 60, height: 1, background: `linear-gradient(90deg, transparent, ${R}0.3), transparent)`, margin: '0 auto 20px' }} />
                            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.4rem', color: `${R}0.5)`, letterSpacing: '4px', marginBottom: 8 }}>
                                5 HOUR LOCKOUT
                            </div>
                            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.35rem', color: 'rgba(255,255,255,0.1)', letterSpacing: '2px' }}>
                                PERFECT OBEDIENCE BROKEN
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TODAY'S ORDERS ── */}
                <div style={{ width: '100%', padding: '0 20px 32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.38rem', color: `${R}0.4)`, letterSpacing: '4px' }}>TODAY&apos;S ORDERS</div>
                        <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.32rem', color: 'rgba(255,255,255,0.1)', letterSpacing: '1px' }}>DAY {daysIn + 1}</div>
                    </div>
                    {attnSkippedToday && (
                        <div style={{ textAlign: 'center', padding: '8px 0 12px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.3rem', color: 'rgba(255,40,40,0.4)', letterSpacing: '3px' }}>
                            &#10005; PERFECTION BROKEN — ORDER SKIPPED
                        </div>
                    )}
                    <div style={{ background: `${R}0.03)`, border: `1px solid ${R}0.1)`, borderRadius: 12, padding: '6px 0', overflow: 'hidden' }}>
                        {todayOrders.map((o: any, i: number) => {
                            const completed = o.done >= o.target;
                            return (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px',
                                    borderBottom: i < todayOrders.length - 1 ? '1px solid rgba(255,255,255,0.02)' : 'none',
                                }}>
                                    <div style={{
                                        width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                                        border: `1.5px solid ${completed ? 'rgba(80,200,120,0.35)' : `${R}0.15)`}`,
                                        background: completed ? 'rgba(80,200,120,0.06)' : 'transparent',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        {completed && <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="rgba(80,200,120,0.6)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                                    </div>
                                    <span style={{
                                        flex: 1, fontFamily: 'Cinzel, serif', fontSize: '0.6rem',
                                        color: completed ? 'rgba(80,200,120,0.35)' : 'rgba(255,255,255,0.35)',
                                        textDecoration: completed ? 'line-through' : 'none',
                                        letterSpacing: '0.5px',
                                    }}>{o.label || (o.type === 'kneel' ? `Kneel ${o.target} times` : o.type === 'spin' ? 'Spin the wheel' : o.type === 'trial' ? 'Complete daily trial' : o.type === 'tribute' ? `Tribute ${o.target} coins` : o.type)}</span>
                                    {!completed && o.done > 0 && (
                                        <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.35rem', color: `${R}0.35)` }}>{o.done}/{o.target}</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {todayOrders.every((o: any) => o.done >= o.target) && (
                        <div style={{ textAlign: 'center', marginTop: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.38rem', color: 'rgba(80,200,120,0.4)', letterSpacing: '3px' }}>
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
                                    <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.4rem', color: 'rgba(80,200,120,0.5)', letterSpacing: '2px' }}>
                                        ENTER FREEDOM — {(() => { const left = Math.max(0, Math.ceil((rewardUntil - Date.now()) / 60000)); const h = Math.floor(left / 60); const m = left % 60; return `${h}h ${m}m left`; })()}
                                    </span>
                                </button>
                            ) : rewardUntil > 0 ? (
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.4rem', color: 'rgba(255,255,255,0.08)', letterSpacing: '2px' }}>
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
                                        fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'claim_reward', memberId: profile?.member_id || profile?.email || 'pr.finsko@gmail.com' }) }).catch(() => {});
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
                                    <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.4rem', color: 'rgba(197,160,89,0.5)', letterSpacing: '2px' }}>
                                        CLAIM FREEDOM UNTIL MIDNIGHT
                                    </span>
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* ── TRIBUTE BUTTON — opens real tribute overlay ── */}
                <div style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '0 20px 32px' }}>
                    <button onClick={() => (window as any).openStandaloneTribute?.('wishlist')} style={{
                        width: 220, height: 44,
                        background: `${R}0.06)`,
                        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                        border: `1px solid ${R}0.35)`, borderRadius: 10,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                    }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b0000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="8" width="18" height="12" rx="1"></rect>
                            <path d="M12 8v12"></path>
                            <path d="M19 8c-1.5-1.5-3-2-4.5-2C13 6 12 8 12 8s-1-2-2.5-2C8 6 6.5 6.5 5 8"></path>
                        </svg>
                        <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', color: '#8b0000', letterSpacing: 3, fontWeight: 700 }}>TRIBUTE</span>
                    </button>
                </div>

                {/* Standalone tribute overlay shell — populated by tribute-game.ts */}
                <div id="mobTributeStandalone" onClick={(e) => { if (e.target === e.currentTarget) (window as any).closeStandaloneTribute?.(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(2,5,18,0.97)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', zIndex: 2147483640, display: 'none', flexDirection: 'column' } as React.CSSProperties}>
                    <div id="mobTributeContent" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto', padding: '20px', paddingTop: 'calc(env(safe-area-inset-top) + 20px)', boxSizing: 'border-box' }}></div>
                </div>

                {/* ── PRESSURE ── */}
                <div style={{ width: '100%', padding: '0 24px 32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.38rem', color: 'rgba(255,255,255,0.15)', letterSpacing: '3px' }}>PRESSURE</span>
                        <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.45rem', color: sanity > 80 ? `${R}0.8)` : sanity > 50 ? 'rgba(197,160,89,0.5)' : 'rgba(255,255,255,0.2)' }}>{Math.floor(sanity)}%</span>
                    </div>
                    <div style={{ height: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{
                            height: '100%', width: `${sanity}%`, borderRadius: 2, transition: 'width 1s ease',
                            background: sanity > 80 ? `linear-gradient(90deg, ${R}0.5), ${R}0.8))` : sanity > 50 ? 'linear-gradient(90deg, rgba(197,160,89,0.2), rgba(197,160,89,0.5))' : 'linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.15))',
                        }} />
                    </div>
                    {sanity > 85 && <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.55rem', color: `${R}0.45)`, textAlign: 'center', marginTop: 10, letterSpacing: '1px' }}>You&apos;re breaking. Beg for mercy?</div>}
                </div>

                {/* ── MILESTONES ── */}
                <div style={{ width: '100%', padding: '0 20px 36px' }}>
                    <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.38rem', color: 'rgba(255,255,255,0.12)', letterSpacing: '4px', textAlign: 'center', marginBottom: 16 }}>SEAL MILESTONES</div>
                    <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                        {SEALS.map(m => {
                            const done = daysIn >= m.days;
                            const cur = !done && daysIn < m.days;
                            const prog = cur ? Math.min(100, (daysIn / m.days) * 100) : 0;
                            return (
                                <div key={m.key} style={{ textAlign: 'center', opacity: done ? 1 : 0.3 }}>
                                    <div style={{ width: 42, height: 42, borderRadius: '50%', margin: '0 auto 6px', border: `1.5px solid ${done ? m.color : 'rgba(255,255,255,0.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', background: done ? `radial-gradient(circle, ${m.color}11 0%, transparent 70%)` : 'none' }}>
                                        {done
                                            ? <svg viewBox="0 0 24 24" width="16" height="16" fill={m.color}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                            : <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                                        }
                                        {cur && <svg viewBox="0 0 46 46" style={{ position: 'absolute', inset: -2, transform: 'rotate(-90deg)' }}><circle cx="23" cy="23" r="21" fill="none" stroke="rgba(197,160,89,0.1)" strokeWidth="1.5" /><circle cx="23" cy="23" r="21" fill="none" stroke="rgba(197,160,89,0.35)" strokeWidth="1.5" strokeDasharray={`${prog * 1.319} ${131.9 - prog * 1.319}`} /></svg>}
                                    </div>
                                    <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.3rem', color: done ? m.color : 'rgba(255,255,255,0.1)', letterSpacing: '2px' }}>{m.label}</div>
                                    <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.28rem', color: 'rgba(255,255,255,0.06)', marginTop: 2 }}>{m.days}d</div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── LEADERBOARD ── */}
                <div style={{ width: '100%', padding: '0 20px 36px' }}>
                    <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.38rem', color: `${R}0.3)`, letterSpacing: '4px', textAlign: 'center', marginBottom: 14 }}>LEADERBOARD OF SUFFERING</div>
                    {[
                        { r: 1, n: 'Subject #12', d: 93, s: 5 },
                        { r: 2, n: 'Subject #47', d: 47, s: 3, you: true },
                        { r: 3, n: 'Subject #31', d: 34, s: 2 },
                        { r: 4, n: 'Subject #08', d: 21, s: 1 },
                    ].map(e => (
                        <div key={e.r} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: e.you ? `${R}0.03)` : 'transparent', borderLeft: e.you ? `2px solid ${R}0.25)` : '2px solid transparent', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                            <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.45rem', color: e.r === 1 ? 'rgba(197,160,89,0.5)' : 'rgba(255,255,255,0.1)', minWidth: 20 }}>{String(e.r).padStart(2, '0')}</span>
                            <span style={{ flex: 1, fontFamily: 'Cinzel, serif', fontSize: '0.55rem', color: e.you ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.25)', letterSpacing: '1px' }}>{e.n}</span>
                            <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.35rem', color: 'rgba(255,255,255,0.08)', letterSpacing: '1px' }}>{e.d}d &middot; {e.s}x</span>
                        </div>
                    ))}
                </div>

                {/* ── BEG BUTTON ── */}
                <div style={{ textAlign: 'center', padding: '20px 0 40px' }}>
                    <button onClick={() => setShowBeg(true)} style={{ padding: '14px 44px', fontFamily: 'Cinzel, serif', fontSize: '0.6rem', letterSpacing: '3px', color: `${R}0.55)`, background: `${R}0.03)`, border: `1px solid ${R}0.12)`, borderRadius: 10, cursor: 'pointer' }}>
                        BEG FOR RELEASE
                    </button>
                    <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.32rem', color: 'rgba(255,255,255,0.08)', letterSpacing: '2px', marginTop: 8 }}>DENIED {vaultData?.begs?.filter((b: any) => b.status === 'denied').length ?? MOCK.denials} TIMES</div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════
                OVERLAY TABS (chat, queen, global, challenge)
            ══════════════════════════════════════════════ */}
            {['chat', 'queen', 'global', 'challenge'].map(t => {
                const isLocked = (t === 'chat' && !chatOk) || (t === 'global' && !globalOk);
                const title = t === 'chat' ? 'QUEEN KARIN' : t === 'queen' ? "QUEEN'S WALL" : t === 'global' ? 'SUBS UNION' : 'WORK';
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
                                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '1px' }}>QUEEN KARIN</div>
                                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.35rem', color: `${R}0.35)`, letterSpacing: '2px' }}>
                                            {chatExpiresAt ? (() => { const left = Math.max(0, Math.ceil((chatExpiresAt - Date.now()) / 1000)); const m = Math.floor(left / 60); const s = left % 60; return `${m}:${s.toString().padStart(2, '0')} LEFT`; })() : 'KEYHOLDER'}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '2px' }}>{title}</span>
                            )}
                            <button onClick={() => setTab('vault')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', fontSize: '1.2rem', cursor: 'pointer' }}>&#10005;</button>
                        </div>

                        {/* Content or lock */}
                        {isLocked && t === 'chat' ? (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 24px' }}>
                                {!chatGateTask ? (
                                    <>
                                        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke={`${R}0.3)`} strokeWidth="1.5">
                                            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                                        </svg>
                                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', textAlign: 'center', lineHeight: 1.7 }}>
                                            Prove your devotion before<br />speaking to Queen Karin
                                        </div>

                                        {/* Attention bar for chat gate */}
                                        <div style={{ width: '100%', maxWidth: 300, position: 'relative', marginTop: 8 }}>
                                            <div
                                                onPointerDown={chatGateDown}
                                                onPointerUp={chatGateUp}
                                                onPointerLeave={chatGateUp}
                                                onPointerCancel={chatGateUp}
                                                onContextMenu={(e) => e.preventDefault()}
                                                style={{
                                                    position: 'relative', width: '100%', height: 48, borderRadius: 24,
                                                    background: `${R}0.06)`, border: `1.5px solid ${R}${chatGateHolding ? '0.4' : '0.15'})`,
                                                    overflow: 'hidden', cursor: 'pointer',
                                                    boxShadow: chatGateHolding ? `0 0 20px ${R}0.2)` : 'none',
                                                    transition: 'border-color 0.2s, box-shadow 0.2s',
                                                    WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none',
                                                } as React.CSSProperties}
                                            >
                                                <div style={{
                                                    position: 'absolute', left: 0, top: 0, bottom: 0,
                                                    width: `${chatGateFill}%`,
                                                    background: `linear-gradient(90deg, ${R}0.15), ${R}0.35))`,
                                                    borderRadius: 24, transition: chatGateHolding ? 'none' : 'width 0.2s',
                                                }} />
                                                <div style={{
                                                    position: 'relative', zIndex: 1, width: '100%', height: '100%',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                                }}>
                                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={`${R}0.5)`} strokeWidth="1.5">
                                                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                                                    </svg>
                                                    <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.42rem', letterSpacing: '4px', color: `${R}0.5)` }}>
                                                        {chatGateCooldown ? (() => {
                                                            const left = Math.max(0, Math.ceil((chatGateCooldownUntil - Date.now()) / 1000));
                                                            if (left < 60) return `${left}s`;
                                                            const h = Math.floor(left / 3600); const m = Math.floor((left % 3600) / 60);
                                                            return h > 0 ? `${h}h ${m}m` : `${m}m`;
                                                        })() : chatGateHolding ? 'HOLD...' : 'ATTENTION'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Skip cooldown — costs 5h lock time per hour remaining */}
                                        {chatGateCooldown && (() => {
                                            const hoursLeft = Math.ceil((chatGateCooldownUntil - Date.now()) / 3600000);
                                            const cost = hoursLeft * 5;
                                            return (
                                                <button onClick={() => {
                                                    setPenaltyHours(prev => prev + cost);
                                                    setAttnCooldownUntil(0);
                                                    setChatGateCooldownUntil(0);
                                                    setAttnSkippedToday(false);
                                                    vladReact(`Member just PAID ${cost} HOURS of extra lock time to skip their cooldown so they can talk to Queen. Desperate. Roast them.`);
                                                    // Persist adjustment to DB
                                                    if (vaultData?.session?.id) {
                                                        fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'adjust', memberId: profile?.member_id || profile?.email || 'pr.finsko@gmail.com', hours: cost, reason: `Skipped chat gate cooldown (${hoursLeft}h × 5)` }) }).catch(() => {});
                                                    }
                                                }} style={{
                                                    marginTop: 12, background: 'none', border: `1px solid ${R}0.12)`,
                                                    borderRadius: 16, padding: '8px 20px', cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', gap: 8,
                                                    WebkitTapHighlightColor: 'transparent',
                                                }}>
                                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke={`${R}0.3)`} strokeWidth="1.5">
                                                        <circle cx="12" cy="12" r="10" />
                                                        <polyline points="12 6 12 12 16 14" />
                                                    </svg>
                                                    <span style={{
                                                        fontFamily: 'Rajdhani, sans-serif', fontSize: '0.5rem',
                                                        color: `${R}0.3)`, letterSpacing: '2px',
                                                    }}>
                                                        SKIP COOLDOWN (+{cost}h lock time)
                                                    </span>
                                                </button>
                                            );
                                        })()}
                                    </>
                                ) : (
                                    <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, animation: 'vFadeIn 0.4s ease' }}>
                                        {/* Task icon */}
                                        <div style={{
                                            width: 50, height: 50, borderRadius: '50%',
                                            background: `${R}0.06)`, border: `1px solid ${R}0.2)`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <span style={{ fontSize: '1.1rem', color: `${R}0.5)` }} dangerouslySetInnerHTML={{ __html: chatGateTask.icon }} />
                                        </div>

                                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.35rem', color: `${R}0.4)`, letterSpacing: '3px' }}>TO ENTER CHAT</div>
                                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: '#8b0000', letterSpacing: '2px', textShadow: `0 0 16px ${R}0.3)`, textAlign: 'center' }}>
                                            {chatGateTask.label}
                                        </div>
                                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.55rem', color: 'rgba(255,255,255,0.25)', textAlign: 'center', lineHeight: 1.7 }}>
                                            {chatGateTask.desc}
                                        </div>

                                        {/* Action — SPIN */}
                                        {chatGateTask.type === 'spin' && (
                                            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                                                {/* Mini wheel */}
                                                <div style={{ position: 'relative', width: 140, height: 140 }}>
                                                    <div style={{ position: 'absolute', top: -5, left: '50%', transform: 'translateX(-50%)', zIndex: 2, width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: `9px solid ${R}0.6)` }} />
                                                    <div style={{ width: 140, height: 140, borderRadius: '50%', border: `1px solid ${R}0.15)`, transform: `rotate(${chatGateSpinAngle}deg)`, transition: chatGateSpinning ? 'transform 3s cubic-bezier(0.2, 0.8, 0.3, 1)' : 'none', position: 'relative', overflow: 'hidden' }}>
                                                        {WHEEL.map((_, i) => { const seg = 360 / WHEEL.length; return <div key={i} style={{ position: 'absolute', width: '50%', height: '50%', top: 0, right: 0, transformOrigin: '0% 100%', transform: `rotate(${i * seg - 90}deg) skewY(-${90 - seg}deg)`, background: i % 2 === 0 ? `${R}0.06)` : 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.03)' }} />; })}
                                                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 28, height: 28, borderRadius: '50%', background: '#0a0a0e', border: `1px solid ${R}0.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                                                            <span style={{ fontSize: '0.5rem', color: `${R}0.4)` }}>&#9819;</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                {chatGateSpinResult ? (
                                                    <div style={{ textAlign: 'center', animation: 'vFadeIn 0.4s ease' }}>
                                                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.55rem', color: `${R}0.6)`, lineHeight: 1.5, marginBottom: 6 }}>{chatGateSpinResult.text}</div>
                                                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.28rem', color: 'rgba(255,255,255,0.08)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 12 }}>{chatGateSpinResult.type}</div>
                                                        <button onClick={() => { if (chatGateTask) sendAttentionCard(chatGateTask, { completed: true, result: chatGateSpinResult?.text }); setChatExpiresAt(Date.now() + 15 * 60 * 1000); setChatGateTask(null); setChatGateDone(true); }} style={{
                                                            width: '100%', padding: '12px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.38rem', letterSpacing: '3px',
                                                            color: 'rgba(80,200,120,0.5)', background: 'rgba(80,200,120,0.04)', border: '1px solid rgba(80,200,120,0.15)', borderRadius: 10, cursor: 'pointer',
                                                        }}>ENTER CHAT</button>
                                                    </div>
                                                ) : (
                                                    <button disabled={chatGateSpinning} onClick={() => {
                                                        setChatGateSpinning(true);
                                                        const idx = Math.floor(Math.random() * WHEEL.length);
                                                        const seg = 360 / WHEEL.length;
                                                        setChatGateSpinAngle(prev => prev + 360 * 4 + (360 - idx * seg - seg / 2));
                                                        setTimeout(() => { setChatGateSpinResult(WHEEL[idx]); setChatGateSpinning(false); }, 3000);
                                                    }} style={{
                                                        padding: '10px 28px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.38rem', letterSpacing: '3px',
                                                        color: chatGateSpinning ? 'rgba(255,255,255,0.08)' : `${R}0.5)`, background: 'transparent',
                                                        border: `1px solid ${chatGateSpinning ? 'rgba(255,255,255,0.04)' : `${R}0.12)`}`, borderRadius: 8, cursor: chatGateSpinning ? 'default' : 'pointer',
                                                    }}>{chatGateSpinning ? 'SPINNING...' : 'SPIN'}</button>
                                                )}
                                            </div>
                                        )}

                                        {/* Action — TRIBUTE: pick duration */}
                                        {chatGateTask.type === 'tribute' && (
                                            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <svg width="14" height="14" viewBox="0 0 512 512" fill={`${R}0.4)`}><path d="M512 80c0 18-14.3 34.6-38.4 48c-29.1 16.1-72.5 27.5-122.3 30.9c-3.7-1.8-7.4-3.5-11.3-5C300.6 137.4 248.2 128 192 128c-8.3 0-16.4 .2-24.5 .6l-1.1-.6C142.3 114.6 128 98 128 80c0-44.2 86-80 192-80S512 35.8 512 80z" /></svg>
                                                    <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.55rem', color: 'rgba(255,255,255,0.15)', letterSpacing: 1 }}>{profile?.wallet ?? MOCK.coins}</span>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                                                    {[
                                                        { coins: 100, mins: 5, label: '5 MIN' },
                                                        { coins: 500, mins: 15, label: '15 MIN' },
                                                        { coins: 1000, mins: 60, label: '1 HOUR' },
                                                    ].map(opt => (
                                                        <button key={opt.coins} onClick={() => { if (chatGateTask) sendAttentionCard(chatGateTask, { completed: true, result: `${opt.label} for ${opt.coins} coins` }); vladReact(`Member just paid ${opt.coins} coins for ${opt.label} of chat time with Queen. They're desperate to talk to her.`); setChatExpiresAt(Date.now() + opt.mins * 60 * 1000); setChatGateTask(null); setChatGateDone(true); }} style={{
                                                            width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                            fontFamily: 'Orbitron, sans-serif', background: `${R}0.04)`, border: `1px solid ${R}0.15)`,
                                                            borderRadius: 10, cursor: 'pointer',
                                                        }}>
                                                            <span style={{ fontSize: '0.5rem', fontWeight: 700, color: `${R}0.6)`, letterSpacing: 2 }}>{opt.label}</span>
                                                            <span style={{ fontSize: '0.4rem', color: 'rgba(255,255,255,0.12)', letterSpacing: 1 }}>{opt.coins} COINS</span>
                                                        </button>
                                                    ))}
                                                </div>
                                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.25rem', color: 'rgba(255,255,255,0.05)', letterSpacing: 2 }}>BUY TIME WITH QUEEN</div>
                                            </div>
                                        )}

                                        {/* Action — PROOF */}
                                        {chatGateTask.type === 'proof' && (
                                            !chatGateProofUploaded ? (
                                                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                                    <div style={{ textAlign: 'center', marginBottom: 4 }}>
                                                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.28rem', color: 'rgba(255,255,255,0.12)', letterSpacing: '2px', marginBottom: 3 }}>WRITE THIS NUMBER ON YOUR PROOF</div>
                                                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1rem', color: `${R}0.7)`, fontWeight: 700, letterSpacing: 6, textShadow: `0 0 20px ${R}0.3)` }}>#{daysIn + 1}</div>
                                                    </div>
                                                    <label style={{
                                                        width: '100%', padding: '13px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.38rem', letterSpacing: '3px',
                                                        color: `${R}0.6)`, background: `${R}0.04)`, border: `1px solid ${R}0.15)`, borderRadius: 10, cursor: 'pointer',
                                                        textAlign: 'center', display: 'block',
                                                    }}>
                                                        UPLOAD PROOF
                                                        <input type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={() => { if (chatGateTask) sendAttentionCard(chatGateTask, { completed: true, result: 'Proof uploaded' }); setChatGateProofUploaded(true); vladReact('Member uploaded proof to earn chat access. They want to talk to Queen badly.'); setTimeout(() => { setChatExpiresAt(Date.now() + 15 * 60 * 1000); setChatGateTask(null); setChatGateDone(true); }, 1200); }} />
                                                    </label>
                                                    <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.28rem', color: 'rgba(255,255,255,0.06)', letterSpacing: '1px' }}>PHOTO OR VIDEO</div>
                                                </div>
                                            ) : (
                                                <div style={{ textAlign: 'center', animation: 'vFadeIn 0.3s ease' }}>
                                                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="rgba(80,200,120,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                                                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.35rem', color: 'rgba(80,200,120,0.4)', letterSpacing: '2px', marginTop: 6 }}>PROOF SUBMITTED — ENTERING CHAT...</div>
                                                </div>
                                            )
                                        )}

                                        {/* Action — COIN FLIP */}
                                        {chatGateTask.type === 'coinflip' && (
                                            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                                                {/* Coin */}
                                                <div style={{
                                                    width: 80, height: 80, borderRadius: '50%',
                                                    background: chatGateFlipState === 'heads'
                                                        ? 'linear-gradient(135deg, rgba(80,200,120,0.15), rgba(80,200,120,0.05))'
                                                        : chatGateFlipState === 'tails'
                                                            ? `linear-gradient(135deg, ${R}0.15), ${R}0.05))`
                                                            : `linear-gradient(135deg, rgba(197,160,89,0.12), rgba(197,160,89,0.04))`,
                                                    border: `2px solid ${
                                                        chatGateFlipState === 'heads' ? 'rgba(80,200,120,0.3)'
                                                        : chatGateFlipState === 'tails' ? `${R}0.3)`
                                                        : 'rgba(197,160,89,0.2)'
                                                    }`,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    animation: chatGateFlipState === 'flipping' ? 'vCoinFlip 0.15s linear infinite' : 'none',
                                                    transition: 'all 0.3s ease',
                                                }}>
                                                    <span style={{
                                                        fontFamily: 'Cinzel, serif', fontSize: '1.4rem', fontWeight: 700,
                                                        color: chatGateFlipState === 'heads' ? 'rgba(80,200,120,0.6)'
                                                            : chatGateFlipState === 'tails' ? `${R}0.6)`
                                                            : 'rgba(197,160,89,0.4)',
                                                    }}>
                                                        {chatGateFlipState === 'heads' ? 'H' : chatGateFlipState === 'tails' ? 'T' : '?'}
                                                    </span>
                                                </div>

                                                {chatGateFlipState === 'idle' && (
                                                    <button onClick={() => {
                                                        setChatGateFlipState('flipping');
                                                        const isHeads = Math.random() < 0.5;
                                                        setTimeout(() => {
                                                            setChatGateFlipState(isHeads ? 'heads' : 'tails');
                                                            if (isHeads) {
                                                                if (chatGateTask) sendAttentionCard(chatGateTask, { completed: true, result: 'Heads — entered chat' });
                                                                setTimeout(() => { setChatExpiresAt(Date.now() + 15 * 60 * 1000); setChatGateTask(null); setChatGateDone(true); }, 1500);
                                                            } else {
                                                                if (chatGateTask) sendAttentionCard(chatGateTask, { completed: false, result: 'Tails — locked out 5 min' });
                                                                const lockUntil = Date.now() + 5 * 60 * 1000;
                                                                setChatGateFlipLocked(lockUntil);
                                                            }
                                                        }, 1500);
                                                    }} style={{
                                                        padding: '12px 36px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.4rem', letterSpacing: '3px',
                                                        color: 'rgba(197,160,89,0.5)', background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 10, cursor: 'pointer',
                                                    }}>FLIP</button>
                                                )}

                                                {chatGateFlipState === 'flipping' && (
                                                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.38rem', color: 'rgba(197,160,89,0.3)', letterSpacing: '3px' }}>FLIPPING...</div>
                                                )}

                                                {chatGateFlipState === 'heads' && (
                                                    <div style={{ textAlign: 'center', animation: 'vFadeIn 0.4s ease' }}>
                                                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', color: 'rgba(80,200,120,0.5)', letterSpacing: '2px' }}>HEADS</div>
                                                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.35rem', color: 'rgba(80,200,120,0.3)', letterSpacing: '2px', marginTop: 4 }}>LUCKY — ENTERING CHAT...</div>
                                                    </div>
                                                )}

                                                {chatGateFlipState === 'tails' && (
                                                    <div style={{ textAlign: 'center', animation: 'vFadeIn 0.4s ease' }}>
                                                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', color: `${R}0.6)`, letterSpacing: '2px' }}>TAILS</div>
                                                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.35rem', color: `${R}0.35)`, letterSpacing: '2px', marginTop: 4 }}>DENIED — LOCKED OUT 5 MINUTES</div>
                                                        <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.7rem', color: `${R}0.4)`, marginTop: 12 }}>
                                                            {Math.max(0, Math.ceil((chatGateFlipLocked - Date.now()) / 60000))}m
                                                        </div>
                                                        <button onClick={() => { setChatGateFlipState('idle'); setChatGateTask(null); setTab('vault'); }} style={{
                                                            marginTop: 14, padding: '8px 20px', fontFamily: 'Rajdhani, sans-serif', fontSize: '0.35rem', letterSpacing: '2px',
                                                            color: 'rgba(255,255,255,0.1)', background: 'transparent', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 6, cursor: 'pointer',
                                                        }}>RETURN TO VAULT</button>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Action — PATIENCE TEST */}
                                        {chatGateTask.type === 'patience' && (
                                            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                                                {chatGateWaitTotal === 0 ? (
                                                    <button onClick={() => {
                                                        const secs = 30 + Math.floor(Math.random() * 61); // 30-90s
                                                        setChatGateWaitTotal(secs);
                                                        setChatGateWaitLeft(secs);
                                                        const iv = setInterval(() => {
                                                            setChatGateWaitLeft(prev => {
                                                                if (prev <= 1) {
                                                                    clearInterval(iv);
                                                                    if (chatGateTask) sendAttentionCard(chatGateTask, { completed: true, result: `Waited ${secs}s` });
                                                                    vladReact(`Member just sat and waited ${secs} seconds in silence to earn chat access. Patience test passed.`);
                                                                    setTimeout(() => { setChatExpiresAt(Date.now() + 15 * 60 * 1000); setChatGateTask(null); setChatGateDone(true); }, 500);
                                                                    return 0;
                                                                }
                                                                return prev - 1;
                                                            });
                                                        }, 1000);
                                                    }} style={{
                                                        padding: '12px 36px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.4rem', letterSpacing: '3px',
                                                        color: `${R}0.5)`, background: `${R}0.04)`, border: `1px solid ${R}0.15)`, borderRadius: 10, cursor: 'pointer',
                                                    }}>BEGIN WAIT</button>
                                                ) : chatGateWaitLeft > 0 ? (
                                                    <>
                                                        {/* Circular progress */}
                                                        <div style={{ position: 'relative', width: 120, height: 120 }}>
                                                            <svg viewBox="0 0 120 120" width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
                                                                <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="3" />
                                                                <circle cx="60" cy="60" r="54" fill="none" stroke="#8b0000" strokeWidth="3"
                                                                    strokeDasharray={`${((chatGateWaitTotal - chatGateWaitLeft) / chatGateWaitTotal) * 339.3} 339.3`}
                                                                    strokeLinecap="round"
                                                                    style={{ transition: 'stroke-dasharray 1s linear' }}
                                                                />
                                                            </svg>
                                                            <div style={{
                                                                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                                                                alignItems: 'center', justifyContent: 'center',
                                                            }}>
                                                                <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '1.6rem', color: `${R}0.5)` }}>
                                                                    {chatGateWaitLeft}
                                                                </div>
                                                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.28rem', color: 'rgba(255,255,255,0.08)', letterSpacing: '2px' }}>SECONDS</div>
                                                            </div>
                                                        </div>
                                                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.5rem', color: 'rgba(255,255,255,0.15)', textAlign: 'center', lineHeight: 1.7 }}>
                                                            Patience is obedience.<br />Do not leave.
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div style={{ textAlign: 'center', animation: 'vFadeIn 0.4s ease' }}>
                                                        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="rgba(80,200,120,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                                                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.38rem', color: 'rgba(80,200,120,0.4)', letterSpacing: '2px', marginTop: 8 }}>PATIENCE PROVEN</div>
                                                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.32rem', color: 'rgba(80,200,120,0.2)', letterSpacing: '2px', marginTop: 4 }}>ENTERING CHAT...</div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Action — CONFESS */}
                                        {chatGateTask.type === 'confess' && (
                                            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                                                <textarea
                                                    value={chatGateConfessText}
                                                    onChange={e => setChatGateConfessText(e.target.value)}
                                                    placeholder="Confess..."
                                                    style={{
                                                        width: '100%', minHeight: 90, background: `${R}0.02)`, border: `1px solid ${R}0.1)`,
                                                        borderRadius: 10, padding: 14, color: 'rgba(255,255,255,0.4)',
                                                        fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.75rem', lineHeight: 1.6,
                                                        resize: 'vertical', outline: 'none',
                                                    }}
                                                />
                                                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{
                                                        fontFamily: 'Rajdhani, sans-serif', fontSize: '0.3rem',
                                                        color: chatGateConfessText.split(/\s+/).filter(Boolean).length >= 20 ? 'rgba(80,200,120,0.3)' : 'rgba(255,255,255,0.08)',
                                                        letterSpacing: '1px',
                                                    }}>
                                                        {chatGateConfessText.split(/\s+/).filter(Boolean).length} / 20 WORDS
                                                    </span>
                                                </div>
                                                <button
                                                    disabled={chatGateConfessText.split(/\s+/).filter(Boolean).length < 20}
                                                    onClick={() => { if (chatGateTask) sendAttentionCard(chatGateTask, { completed: true, result: chatGateConfessText.slice(0, 100) }); vladReact(`Member just confessed to enter chat. They wrote: "${chatGateConfessText.slice(0, 80)}..." React to their confession.`); setChatExpiresAt(Date.now() + 15 * 60 * 1000); setChatGateTask(null); setChatGateDone(true); }}
                                                    style={{
                                                        width: '100%', padding: '13px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.38rem', letterSpacing: '3px',
                                                        color: chatGateConfessText.split(/\s+/).filter(Boolean).length >= 20 ? `${R}0.6)` : 'rgba(255,255,255,0.06)',
                                                        background: chatGateConfessText.split(/\s+/).filter(Boolean).length >= 20 ? `${R}0.04)` : 'transparent',
                                                        border: `1px solid ${chatGateConfessText.split(/\s+/).filter(Boolean).length >= 20 ? `${R}0.15)` : 'rgba(255,255,255,0.03)'}`,
                                                        borderRadius: 10, cursor: chatGateConfessText.split(/\s+/).filter(Boolean).length >= 20 ? 'pointer' : 'default',
                                                    }}>CONFESS &amp; ENTER</button>
                                            </div>
                                        )}

                                        {/* CANCEL — always visible on every chat gate task */}
                                        <button onClick={cancelChatGate} style={{
                                            marginTop: 12, padding: '10px 24px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.35rem', letterSpacing: '3px',
                                            color: 'rgba(255,255,255,0.1)', background: 'transparent', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, cursor: 'pointer',
                                        }}>CANCEL</button>
                                    </div>
                                )}
                            </div>
                        ) : isLocked ? (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                                <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke={`${R}0.3)`} strokeWidth="1.5">
                                    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                                </svg>
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.42rem', color: `${R}0.45)`, letterSpacing: '3px', textAlign: 'center', padding: '0 40px' }}>{lockMsg}</div>
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.35rem', color: 'rgba(255,255,255,0.08)', letterSpacing: '2px' }}>TO UNLOCK UNION</div>
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
                                        <button onClick={() => (window as any).openProfileGifPicker?.()} style={{ background: 'none', border: '1px solid rgba(197,160,89,0.2)', cursor: 'pointer', padding: '4px 8px', borderRadius: 8, fontFamily: 'Orbitron', fontSize: '0.38rem', fontWeight: 700, color: 'rgba(197,160,89,0.6)', letterSpacing: '1px', flexShrink: 0 }}>GIF</button>
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
                            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 100px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                                {/* ── DAILY TRIAL ── */}
                                <div style={{ width: '100%', padding: '0 4px 36px' }}>
                                    <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.38rem', color: `${R}0.35)`, letterSpacing: '4px', textAlign: 'center', marginBottom: 14 }}>
                                        DAILY TRIAL &middot; DAY {daysIn + 1}
                                    </div>
                                    <div style={{ background: `${R}0.03)`, border: `1px solid ${R}0.1)`, borderRadius: 12, padding: '20px 18px' }}>
                                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                                            {vaultData?.today?.trial_prompt || MOCK.todayTrial.text}
                                        </div>
                                        {!trialDone && !trialOpen && (
                                            <button onClick={() => setTrialOpen(true)} style={{
                                                marginTop: 14, width: '100%', padding: '11px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.38rem', letterSpacing: '3px',
                                                color: `${R}0.5)`, background: `${R}0.04)`, border: `1px solid ${R}0.12)`, borderRadius: 8, cursor: 'pointer',
                                            }}>SUBMIT TRIAL</button>
                                        )}
                                        {trialOpen && !trialDone && (
                                            <>
                                                <textarea value={trialText} onChange={e => setTrialText(e.target.value)} placeholder="Write here..."
                                                    style={{ width: '100%', minHeight: 90, marginTop: 14, background: 'rgba(0,0,0,0.3)', border: `1px solid ${R}0.08)`, borderRadius: 8, padding: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.75rem', lineHeight: 1.6, resize: 'vertical', outline: 'none' }} />
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                                                    <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.35rem', color: 'rgba(255,255,255,0.1)' }}>{trialText.split(/\s+/).filter(Boolean).length} / 200</span>
                                                    <button onClick={() => {
                                                        setTrialDone(true); setTrialOpen(false);
                                                        if (vaultData?.session?.id) {
                                                            const todayTrial = vaultData?.today ? null : MOCK.todayTrial;
                                                            fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'trial', memberId: profile?.member_id || profile?.email || 'pr.finsko@gmail.com', prompt: todayTrial?.text || 'Daily trial', response: trialText }) }).catch(() => {});
                                                        }
                                                    }} style={{ padding: '8px 20px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.35rem', letterSpacing: '3px', color: '#050508', background: `${R}0.5)`, border: 'none', borderRadius: 6, cursor: 'pointer' }}>SUBMIT</button>
                                                </div>
                                            </>
                                        )}
                                        {trialDone && (
                                            <div style={{ marginTop: 14, textAlign: 'center' }}>
                                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.38rem', color: 'rgba(80,200,120,0.45)', letterSpacing: '3px' }}>TRIAL COMPLETE</div>
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 12, flexWrap: 'wrap' }}>
                                        {(vaultData?.trials || MOCK.trialHistory.map((ok: boolean) => ({ status: ok ? 'submitted' : 'pending' }))).map((t: any, i: number) => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: (t === true || t.status === 'submitted' || t.status === 'approved') ? 'rgba(80,200,120,0.35)' : `${R}0.25)` }} />)}
                                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: trialDone ? 'rgba(80,200,120,0.35)' : 'rgba(197,160,89,0.25)', boxShadow: trialDone ? 'none' : '0 0 4px rgba(197,160,89,0.15)' }} />
                                    </div>
                                </div>

                                {/* ── TEMPTATION WHEEL ── */}
                                <div style={{ width: '100%', padding: '0 4px 36px', textAlign: 'center' }}>
                                    <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.38rem', color: 'rgba(197,160,89,0.25)', letterSpacing: '4px', marginBottom: 16 }}>TEMPTATION WHEEL</div>
                                    <div style={{ position: 'relative', width: 220, height: 220, margin: '0 auto 16px' }}>
                                        <div style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', zIndex: 2, width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: `12px solid ${R}0.6)` }} />
                                        <div style={{ width: 220, height: 220, borderRadius: '50%', border: `1.5px solid ${R}0.15)`, transform: `rotate(${wheelAngle}deg)`, transition: spinning ? 'transform 4s cubic-bezier(0.2, 0.8, 0.3, 1)' : 'none', position: 'relative', overflow: 'hidden' }}>
                                            {WHEEL.map((_, i) => { const seg = 360 / WHEEL.length; return <div key={i} style={{ position: 'absolute', width: '50%', height: '50%', top: 0, right: 0, transformOrigin: '0% 100%', transform: `rotate(${i * seg - 90}deg) skewY(-${90 - seg}deg)`, background: i % 2 === 0 ? `${R}0.04)` : 'rgba(255,255,255,0.015)', borderRight: '1px solid rgba(255,255,255,0.03)' }} />; })}
                                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 44, height: 44, borderRadius: '50%', background: '#0a0a0e', border: `1px solid ${R}0.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                                                <span style={{ fontSize: '0.7rem', color: `${R}0.4)` }}>&#9819;</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={spin} disabled={spinning || wheelUsed} style={{ padding: '10px 32px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.38rem', letterSpacing: '4px', color: wheelUsed ? 'rgba(255,255,255,0.1)' : `${R}0.5)`, background: 'transparent', border: `1px solid ${wheelUsed ? 'rgba(255,255,255,0.04)' : `${R}0.12)`}`, borderRadius: 8, cursor: wheelUsed ? 'default' : 'pointer' }}>
                                        {wheelUsed ? 'USED TODAY' : spinning ? 'SPINNING...' : 'SPIN'}
                                    </button>
                                    {wheelResult && (
                                        <div style={{ marginTop: 16, padding: '14px 20px', background: `${R}0.03)`, border: `1px solid ${R}0.1)`, borderRadius: 10, animation: 'vFadeIn 0.5s ease' }}>
                                            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', color: `${R}0.7)`, lineHeight: 1.5 }}>{wheelResult.text}</div>
                                            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.32rem', color: 'rgba(255,255,255,0.1)', letterSpacing: '2px', marginTop: 6, textTransform: 'uppercase' }}>{wheelResult.type}</div>
                                        </div>
                                    )}
                                </div>

                            </div>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.4rem', color: 'rgba(255,255,255,0.06)', letterSpacing: '2px' }}>{title} PREVIEW</div>
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
                BEG MODAL
            ══════════════════════════════════════════════ */}
            {showBeg && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => !begSent && setShowBeg(false)}>
                    <div style={{ width: '100%', maxWidth: 380, background: '#0a0a0e', border: `1px solid ${R}0.12)`, borderRadius: 16, padding: '28px 22px' }} onClick={e => e.stopPropagation()}>
                        {!begSent ? (
                            <>
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.4rem', color: `${R}0.45)`, letterSpacing: '4px', textAlign: 'center', marginBottom: 6 }}>BEG FOR RELEASE</div>
                                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.5rem', color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginBottom: 20, lineHeight: 1.6 }}>Choose your words carefully.<br />Queen Karin will decide your fate.</div>
                                <textarea value={begText} onChange={e => setBegText(e.target.value)} placeholder="Please, Queen Karin..." style={{ width: '100%', minHeight: 100, background: `${R}0.02)`, border: `1px solid ${R}0.08)`, borderRadius: 10, padding: 14, color: 'rgba(255,255,255,0.4)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.75rem', lineHeight: 1.6, resize: 'vertical', outline: 'none' }} />
                                <button onClick={() => {
                                    setBegSent(true);
                                    // Record beg in DB
                                    if (vaultData?.session?.id) {
                                        fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'beg', memberId: profile?.member_id || profile?.email || 'pr.finsko@gmail.com', message: begText }) }).catch(() => {});
                                    }
                                }} disabled={!begText.trim()} style={{ marginTop: 14, width: '100%', padding: '13px', fontFamily: 'Cinzel, serif', fontSize: '0.55rem', letterSpacing: '3px', color: begText.trim() ? `${R}0.6)` : 'rgba(255,255,255,0.08)', background: begText.trim() ? `${R}0.04)` : 'transparent', border: `1px solid ${begText.trim() ? `${R}0.15)` : 'rgba(255,255,255,0.04)'}`, borderRadius: 8, cursor: begText.trim() ? 'pointer' : 'default' }}>SUBMIT YOUR BEG</button>
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '16px 0' }}>
                                <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke={`${R}0.35)`} strokeWidth="1.5" style={{ marginBottom: 14 }}><path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2Z" /></svg>
                                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>Your plea has been sent.</div>
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.35rem', color: 'rgba(255,255,255,0.1)', letterSpacing: '3px' }}>AWAIT HER DECISION</div>
                                <button onClick={() => { setShowBeg(false); setBegSent(false); setBegText(''); }} style={{ marginTop: 20, padding: '8px 20px', fontFamily: 'Rajdhani, sans-serif', fontSize: '0.38rem', letterSpacing: '2px', color: 'rgba(255,255,255,0.12)', background: 'transparent', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 6, cursor: 'pointer' }}>CLOSE</button>
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
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.42rem', color: `${R}0.45)`, letterSpacing: '4px' }}>DAY {selectedDay.day}</div>
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.55rem', color: 'rgba(255,255,255,0.25)', letterSpacing: '1px', marginTop: 4 }}>{new Date(selectedDay.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {selectedDay.seal && (
                                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.32rem', color: selectedDay.seal === 'bronze' ? '#cd7f32' : selectedDay.seal === 'silver' ? '#c0c0c0' : selectedDay.seal === 'gold' ? '#c5a059' : '#b9f2ff', letterSpacing: '2px', padding: '3px 8px', border: `1px solid ${selectedDay.seal === 'bronze' ? 'rgba(205,127,50,0.3)' : selectedDay.seal === 'silver' ? 'rgba(192,192,192,0.3)' : 'rgba(197,160,89,0.3)'}`, borderRadius: 4 }}>
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
                            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.6rem', color: selectedDay.perfect ? `${R}0.6)` : 'rgba(255,40,40,0.45)', letterSpacing: '2px' }}>
                                {selectedDay.perfect ? 'PERFECT OBEDIENCE' : 'DISOBEDIENT'}
                            </div>
                        </div>

                        {/* Orders checklist */}
                        <div style={{ marginBottom: 20 }}>
                            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.35rem', color: 'rgba(255,255,255,0.12)', letterSpacing: '3px', marginBottom: 10 }}>ORDERS</div>
                            {selectedDay.orders.map((o, i) => {
                                const completed = o.done >= o.target;
                                const label = o.type === 'kneel' ? `Kneel ${o.target} times` : o.type === 'spin' ? 'Spin the wheel' : o.type === 'trial' ? 'Complete daily trial' : o.type === 'tribute' ? `Tribute ${o.target} coins` : o.type === 'silence' ? 'No messages today' : o.type;
                                return (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                        <div style={{
                                            width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                                            border: `1px solid ${completed ? `${R}0.3)` : 'rgba(255,255,255,0.06)'}`,
                                            background: completed ? `${R}0.08)` : 'transparent',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            {completed && <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#8b0000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                                        </div>
                                        <span style={{ flex: 1, fontFamily: 'Cinzel, serif', fontSize: '0.6rem', color: completed ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)', textDecoration: completed ? 'none' : 'none' }}>{label}</span>
                                        {o.type === 'kneel' && !completed && (
                                            <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.35rem', color: 'rgba(255,40,40,0.35)' }}>{o.done}/{o.target}</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Trial */}
                        {selectedDay.trial && (
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.35rem', color: 'rgba(255,255,255,0.12)', letterSpacing: '3px', marginBottom: 10 }}>TRIAL</div>
                                <div style={{ background: `${R}0.03)`, border: `1px solid ${R}0.08)`, borderRadius: 10, padding: '14px 16px' }}>
                                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.55rem', color: `${R}0.45)`, lineHeight: 1.6, marginBottom: 10 }}>{selectedDay.trial.prompt}</div>
                                    <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,0.03)', margin: '8px 0' }} />
                                    <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', lineHeight: 1.7, fontStyle: 'italic' }}>
                                        &ldquo;{selectedDay.trial.response}&rdquo;
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Spin result */}
                        {selectedDay.spin && (
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.35rem', color: 'rgba(255,255,255,0.12)', letterSpacing: '3px', marginBottom: 10 }}>WHEEL RESULT</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: `${R}0.03)`, border: `1px solid ${R}0.08)`, borderRadius: 10, padding: '12px 16px' }}>
                                    <span style={{ fontSize: '1rem', opacity: 0.4 }}>&#9819;</span>
                                    <div>
                                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>{selectedDay.spin.text}</div>
                                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.3rem', color: selectedDay.spin.type === 'reward' ? 'rgba(80,200,120,0.35)' : selectedDay.spin.type === 'punishment' ? `${R}0.35)` : 'rgba(255,255,255,0.08)', letterSpacing: '2px', marginTop: 3, textTransform: 'uppercase' }}>{selectedDay.spin.type}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tribute */}
                        {selectedDay.tribute > 0 && (
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.35rem', color: 'rgba(255,255,255,0.12)', letterSpacing: '3px', marginBottom: 10 }}>TRIBUTE</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: `${R}0.03)`, border: `1px solid ${R}0.08)`, borderRadius: 10, padding: '12px 16px' }}>
                                    <svg width="18" height="18" viewBox="0 0 512 512" fill={`${R}0.5)`}><path d="M512 80c0 18-14.3 34.6-38.4 48c-29.1 16.1-72.5 27.5-122.3 30.9c-3.7-1.8-7.4-3.5-11.3-5C300.6 137.4 248.2 128 192 128c-8.3 0-16.4 .2-24.5 .6l-1.1-.6C142.3 114.6 128 98 128 80c0-44.2 86-80 192-80S512 35.8 512 80z" /></svg>
                                    <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: `${R}0.5)`, fontWeight: 700 }}>{selectedDay.tribute}</span>
                                    <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.35rem', color: 'rgba(255,255,255,0.1)', letterSpacing: '2px' }}>COINS TRIBUTED</span>
                                </div>
                            </div>
                        )}

                        {/* Close */}
                        <button onClick={() => setSelectedDay(null)} style={{ width: '100%', padding: '12px', fontFamily: 'Rajdhani, sans-serif', fontSize: '0.4rem', letterSpacing: '3px', color: 'rgba(255,255,255,0.12)', background: 'transparent', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, cursor: 'pointer', marginTop: 4 }}>CLOSE</button>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════
                BOTTOM NAV — 5 tabs matching /profile
            ══════════════════════════════════════════════ */}
            <nav style={{
                position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
                width: '100%', maxWidth: 480,
                background: 'rgba(5,5,8,0.95)', backdropFilter: 'blur(20px)',
                borderTop: `1px solid ${R}0.08)`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-around',
                padding: '8px 0 env(safe-area-inset-bottom, 8px)',
                zIndex: 60,
            }}>
                <NavBtn active={tab === 'vault'} icon="&#9670;" label="VAULT" onClick={() => setTab('vault')} />
                <NavBtn active={tab === 'challenge'} label="WORK" onClick={() => setTab('challenge')}
                    icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 7 7 7 7"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C17 4 17 7 17 7"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>} />

                {/* Center Queen button */}
                <button onClick={() => setTab('chat')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, position: 'relative' }}>
                    <div style={{
                        width: 50, height: 50, borderRadius: '50%',
                        border: `1.5px solid ${tab === 'chat' ? `${R}0.5)` : `${R}0.15)`}`,
                        overflow: 'hidden',
                        boxShadow: tab === 'chat' ? `0 0 16px ${R}0.15)` : 'none',
                    }}>
                        <img src="/queen-nav.png" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Q" />
                    </div>
                    {!chatOk && (
                        <div style={{ position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: '50%', background: '#050508', border: `1px solid ${R}0.3)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg viewBox="0 0 24 24" width="8" height="8" fill={`${R}0.5)`}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                        </div>
                    )}
                </button>

                <NavBtn active={tab === 'queen'} icon="&#9819;" label="QUEEN" onClick={() => setTab('queen')} />
                <NavBtn active={tab === 'global'} icon="&#9678;" label="UNION" onClick={() => setTab('global')} locked={!globalOk} />
            </nav>

            {/* ── FLOATING VLAD AVATAR + SPEECH BUBBLE ── */}
            {!vladOpen && (
                <div style={{ position: 'fixed', bottom: 76, right: 12, zIndex: 150, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    {/* Speech bubble — pops up when Vlad has something to say */}
                    {vladBubble && (
                        <div onClick={() => { setVladOpen(true); setVladPulse(false); setVladBubble(''); }} style={{
                            maxWidth: 240, padding: '10px 14px',
                            background: 'rgba(10,6,14,0.95)', border: '1px solid rgba(255,0,237,0.2)',
                            borderRadius: '14px 14px 4px 14px',
                            boxShadow: '0 8px 30px rgba(0,0,0,0.7), 0 0 15px rgba(255,0,237,0.06)',
                            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.72rem',
                            color: 'rgba(255,0,237,0.6)', lineHeight: 1.6, cursor: 'pointer',
                            animation: 'vFadeIn 0.3s ease',
                        }}>{vladBubble.length > 120 ? vladBubble.slice(0, 120) + '...' : vladBubble}</div>
                    )}
                    {/* Avatar button */}
                    <button onClick={() => { setVladOpen(true); setVladPulse(false); setVladBubble(''); if (vladMsgs.length === 0) vladReact('Member just opened the vault page. Greet them — you can see they\'re locked up. Be sarcastic but welcoming.'); }} style={{
                        width: 50, height: 50, borderRadius: '50%', padding: 0,
                        border: vladPulse ? '2px solid rgba(255,0,237,0.5)' : '1.5px solid rgba(255,0,237,0.25)',
                        cursor: 'pointer', overflow: 'hidden', flexShrink: 0,
                        boxShadow: vladPulse ? '0 0 18px rgba(255,0,237,0.25)' : '0 4px 20px rgba(0,0,0,0.5)',
                        animation: vladPulse ? 'vladPulse 1.5s ease infinite' : 'none',
                        background: 'none',
                    }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/vlad-avatar.png" alt="Vlad" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%', display: 'block' }} />
                    </button>
                </div>
            )}

            {/* ── VLAD CHAT PANEL ── */}
            {vladOpen && (<>
                {/* Backdrop — prevents clicks from reaching page behind */}
                <div onClick={e => { e.stopPropagation(); setVladOpen(false); }} style={{
                    position: 'fixed', inset: 0, zIndex: 159, background: 'rgba(0,0,0,0.4)',
                }} />
                <div onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} style={{
                    position: 'fixed', bottom: 70, right: 8, left: 8, zIndex: 160,
                    maxWidth: 400, margin: '0 auto',
                    height: 400, maxHeight: '58vh',
                    background: 'linear-gradient(170deg, #0a0610 0%, #0d0818 50%, #08040e 100%)',
                    border: '1px solid rgba(255,0,237,0.15)',
                    borderRadius: 20, display: 'flex', flexDirection: 'column',
                    boxShadow: '0 16px 60px rgba(0,0,0,0.85), 0 0 40px rgba(255,0,237,0.04)',
                    animation: 'vFadeIn 0.3s ease', overflow: 'hidden',
                }}>
                    {/* Header */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 16px', borderBottom: '1px solid rgba(255,0,237,0.08)',
                        background: 'rgba(255,0,237,0.02)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(255,0,237,0.3)', flexShrink: 0 }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/vlad-avatar.png" alt="Vlad" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} />
                            </div>
                            <div>
                                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.5rem', color: 'rgba(255,0,237,0.6)', letterSpacing: '3px' }}>VLAD</div>
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.28rem', color: 'rgba(255,255,255,0.1)', letterSpacing: '1px' }}>WATCHING YOU SUFFER</div>
                            </div>
                        </div>
                        <button onClick={() => setVladOpen(false)} style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'rgba(255,0,237,0.2)', fontSize: '1.1rem', lineHeight: 1, padding: '4px 8px',
                        }}>&times;</button>
                    </div>

                    {/* Messages */}
                    <div ref={vladScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {vladMsgs.map((m, i) => (
                            <div key={i} style={{
                                display: 'flex', gap: 8,
                                flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
                                alignItems: 'flex-end',
                            }}>
                                {m.role === 'vlad' && (
                                    <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(255,0,237,0.2)', flexShrink: 0 }}>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src="/vlad-avatar.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} />
                                    </div>
                                )}
                                <div style={{
                                    maxWidth: '78%', padding: '9px 14px',
                                    borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                                    background: m.role === 'user'
                                        ? 'rgba(139,0,0,0.06)'
                                        : 'rgba(255,0,237,0.04)',
                                    border: `1px solid ${m.role === 'user' ? 'rgba(139,0,0,0.1)' : 'rgba(255,0,237,0.1)'}`,
                                    fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.75rem',
                                    color: m.role === 'user' ? 'rgba(255,255,255,0.3)' : 'rgba(255,0,237,0.5)',
                                    lineHeight: 1.6,
                                }}>{m.text}</div>
                            </div>
                        ))}
                        {vladSending && (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                                <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(255,0,237,0.2)', flexShrink: 0 }}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src="/vlad-avatar.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} />
                                </div>
                                <div style={{ padding: '9px 14px', borderRadius: '14px 14px 14px 4px', background: 'rgba(255,0,237,0.04)', border: '1px solid rgba(255,0,237,0.1)' }}>
                                    <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.75rem', color: 'rgba(255,0,237,0.25)', animation: 'vPulse 1s ease infinite' }}>typing...</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input */}
                    <div style={{
                        display: 'flex', gap: 8, padding: '10px 12px',
                        borderTop: '1px solid rgba(255,0,237,0.08)',
                        background: 'rgba(255,0,237,0.01)',
                    }}>
                        <input
                            value={vladInput}
                            onChange={e => setVladInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && vladInput.trim()) { sendVladMsg(vladInput.trim()); setVladInput(''); } }}
                            placeholder="Talk to Vlad..."
                            style={{
                                flex: 1, background: 'rgba(255,0,237,0.02)', border: '1px solid rgba(255,0,237,0.08)',
                                borderRadius: 12, padding: '10px 14px', color: 'rgba(255,255,255,0.35)',
                                fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.75rem',
                                outline: 'none',
                            }}
                        />
                        <button
                            disabled={vladSending || !vladInput.trim()}
                            onClick={() => { if (vladInput.trim()) { sendVladMsg(vladInput.trim()); setVladInput(''); } }}
                            style={{
                                padding: '8px 14px', background: 'rgba(255,0,237,0.06)',
                                border: '1px solid rgba(255,0,237,0.12)', borderRadius: 12,
                                fontFamily: 'Orbitron, sans-serif', fontSize: '0.35rem', letterSpacing: '2px',
                                color: vladSending ? 'rgba(255,0,237,0.12)' : 'rgba(255,0,237,0.45)',
                                cursor: vladSending ? 'default' : 'pointer',
                            }}>SEND</button>
                    </div>
                </div>
            </>)}

            <style>{`
                @keyframes vFadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
                @keyframes vPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
                @keyframes vCoinFlip { 0% { transform: scaleX(1); } 50% { transform: scaleX(0.05); } 100% { transform: scaleX(1); } }
                @keyframes vladPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(160,100,255,0.4); } 50% { box-shadow: 0 0 14px 4px rgba(160,100,255,0.25); } }
                * { box-sizing: border-box; }
                ::-webkit-scrollbar { display: none; }
                * { -ms-overflow-style: none; scrollbar-width: none; }
                textarea:focus, input:focus { border-color: rgba(139,0,0,0.25) !important; }

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
    const color = active ? `rgba(139,0,0,0.6)` : 'rgba(255,255,255,0.12)';
    return (
        <button onClick={onClick} style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', padding: '4px 12px', position: 'relative' }}>
            <span style={{ fontSize: typeof icon === 'string' ? '1rem' : undefined, color, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '1.1rem' }}>{icon}</span>
            <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.28rem', color, letterSpacing: '1px' }}>{label}</span>
            {locked && (
                <div style={{ position: 'absolute', top: -2, right: 2, width: 12, height: 12, borderRadius: '50%', background: '#050508', border: '1px solid rgba(139,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg viewBox="0 0 24 24" width="7" height="7" fill="rgba(139,0,0,0.4)"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                </div>
            )}
        </button>
    );
}
