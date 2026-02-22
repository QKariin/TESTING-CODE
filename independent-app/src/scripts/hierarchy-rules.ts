// src/scripts/hierarchy-rules.ts
// Ported from Velo hierarchyRules.js — single source of truth for rank logic

const SILHOUETTE = "ce3e5b_e06c7a2254d848a480eb98107c35e246";

export const HIERARCHY_RULES = [
    {
        name: "Queen's Champion",
        req: { tasks: 1000, kneels: 3000, points: 250000, spent: 1000000, streak: 365, prefs: true, limits: true, kinks: true, routine: true },
        benefits: ["Absolute Authority.", "Manifest Will.", "Total Ownership."],
        speakCost: 0
    },
    {
        name: "Secretary",
        req: { tasks: 500, kneels: 1500, points: 100000, spent: 500000, streak: 180, prefs: true, limits: true, kinks: true, routine: true },
        benefits: ["The Line: A direct Audio Connection.", "Authority: Access to System Commands.", "The Throne: Total, Unfiltered Access."],
        speakCost: 0
    },
    {
        name: "Chamberlain",
        req: { tasks: 300, kneels: 750, points: 50000, spent: 150000, streak: 90, prefs: true, limits: true, kinks: true, routine: true },
        benefits: ["Speech: All messaging is Free.", "Visuals: Access to Video Sessions.", "Honor: Access to Elite Trials."],
        speakCost: 0
    },
    {
        name: "Butler",
        req: { tasks: 100, kneels: 250, points: 10000, spent: 50000, streak: 30, prefs: true, limits: true, kinks: true, routine: true },
        benefits: ["Chat Upgrade: Permission to send Videos.", "Voice: Access to Audio Sessions.", "Speak Cost: 5 Coins."],
        speakCost: 5
    },
    {
        name: "Silverman",
        req: { tasks: 25, kneels: 65, points: 5000, spent: 5000, streak: 5, prefs: true, limits: true, kinks: true, routine: true },
        benefits: ["Chat Upgrade: Permission to send Photos.", "Devotion: Tasks tailored to your Desires.", "Booking: Permission to request Sessions.", "Speak Cost: 10 Coins."],
        speakCost: 10
    },
    {
        name: "Footman",
        req: { tasks: 5, kneels: 10, points: 2000, spent: 0, streak: 0, name: true, photo: true },
        benefits: ["Presence: Your Face may be revealed.", "Order: Access to the Daily Routine.", "Speak Cost: 15 Coins."],
        speakCost: 15
    },
    {
        name: "Hall Boy",
        req: { tasks: 0, kneels: 0, points: 0, spent: 0, streak: 0 },
        benefits: ["Identity: You are granted a Name.", "Labor: Permission to begin Basic Tasks.", "Speak Cost: 20 Coins."],
        speakCost: 20
    }
];

// Maps Supabase profile fields to what the rules expect
function buildStatsFromProfile(profile: any) {
    const params = profile.parameters || {};
    const img = profile.avatar_url || '';
    const nameStr = (profile.name || '').toUpperCase().trim();

    return {
        tasks: params.taskdom_completed_tasks || 0,
        kneels: params.kneel_count || 0,
        points: profile.score || 0,
        spent: params.total_coins_spent || 0,
        streak: params.routine_streak || 0,
        hasPhoto: !!(img && img.length > 5 && !img.includes(SILHOUETTE) && img !== 'undefined' && img !== 'null'),
        hasName: nameStr.length > 0 && nameStr !== 'SLAVE' && nameStr !== 'NEW SLAVE',
        hasLimits: !!(profile.limits && profile.limits.length > 2),
        hasKinks: !!(profile.kinks && profile.kinks.length > 2),
        hasRoutine: !!(profile.routine && profile.routine.length > 5),
    };
}

const clean = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function getHierarchyReport(profile: any) {
    const stats = buildStatsFromProfile(profile);
    const storedRank = profile?.hierarchy || 'Hall Boy';

    // Find stored rank index
    let currentIndex = HIERARCHY_RULES.findIndex(r => clean(r.name) === clean(storedRank));
    if (currentIndex === -1) currentIndex = HIERARCHY_RULES.length - 1; // default Hall Boy

    // --- DEMOTION GATES ---
    // Gate 1: Must have name + photo to be above Hall Boy
    if (currentIndex < HIERARCHY_RULES.length - 1 && (!stats.hasName || !stats.hasPhoto)) {
        currentIndex = HIERARCHY_RULES.length - 1; // demote to Hall Boy
    }

    // Gate 2: Must have limits + kinks + routine to be at Silverman (index 4) or above
    if (currentIndex <= 4 && (!stats.hasLimits || !stats.hasKinks || !stats.hasRoutine)) {
        currentIndex = 5; // demote to Footman
    }

    // --- PROMOTION CHECK ---
    // Walk UP the ranks and promote as far as requirements are met
    // (only from the gated currentIndex)
    let promotedIndex = currentIndex;
    for (let i = currentIndex - 1; i >= 0; i--) {
        const r = HIERARCHY_RULES[i];
        const req = r.req;

        const statsMet =
            stats.tasks >= (req.tasks || 0) &&
            stats.kneels >= (req.kneels || 0) &&
            stats.points >= (req.points || 0) &&
            stats.spent >= (req.spent || 0) &&
            stats.streak >= (req.streak || 0);

        const prefsMet = !req.prefs || (stats.hasLimits && stats.hasKinks);
        const routineMet = !req.routine || stats.hasRoutine;
        const nameMet = !req.name || stats.hasName;
        const photoMet = !req.photo || stats.hasPhoto;

        if (statsMet && prefsMet && routineMet && nameMet && photoMet) {
            promotedIndex = i;
        } else {
            break; // can't skip ranks
        }
    }

    currentIndex = promotedIndex;

    const currentRankObj = HIERARCHY_RULES[currentIndex];
    const isMax = currentIndex === 0;
    const nextRankObj = isMax ? currentRankObj : HIERARCHY_RULES[currentIndex - 1];
    const req = nextRankObj.req;

    // Build requirements list for sidebar
    const requirements: any[] = [];

    if (!isMax) {
        if (req.name) requirements.push({ id: 'name', label: 'IDENTITY', status: stats.hasName ? 'VERIFIED' : 'MISSING', type: 'check' });
        if (req.photo) requirements.push({ id: 'photo', label: 'PHOTO', status: stats.hasPhoto ? 'VERIFIED' : 'MISSING', type: 'check' });
        if (req.limits) requirements.push({ id: 'limits', label: 'LIMITS', status: stats.hasLimits ? 'VERIFIED' : 'MISSING', type: 'check' });
        if (req.kinks) requirements.push({ id: 'kinks', label: 'KINKS', status: stats.hasKinks ? 'VERIFIED' : 'MISSING', type: 'check' });
        if (req.routine) requirements.push({ id: 'routine', label: 'ROUTINE', status: stats.hasRoutine ? 'VERIFIED' : 'MISSING', type: 'check' });

        const bars = [
            { label: 'LABOR', icon: '🛠️', current: stats.tasks, target: req.tasks || 0 },
            { label: 'ENDURANCE', icon: '🧎', current: stats.kneels, target: req.kneels || 0 },
            { label: 'MERIT', icon: '✨', current: stats.points, target: req.points || 0 },
            { label: 'SACRIFICE', icon: '💰', current: stats.spent, target: req.spent || 0 },
            { label: 'CONSISTENCY', icon: '📅', current: stats.streak, target: req.streak || 0 },
        ];
        bars.forEach(b => {
            if (b.target > 0) requirements.push({ ...b, type: 'bar', percent: Math.min((b.current / b.target) * 100, 100) });
        });
    }

    const canPromote = requirements.every(r =>
        r.type === 'check' ? r.status === 'VERIFIED' : r.current >= r.target
    );

    return {
        currentRank: currentRankObj.name,
        currentBenefits: currentRankObj.benefits,
        nextRank: nextRankObj.name,
        nextBenefits: nextRankObj.benefits,
        isMax,
        canPromote,
        requirements,
        stats,
    };
}
