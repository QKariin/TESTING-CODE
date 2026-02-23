// src/scripts/hierarchy-rules.ts

export const HIERARCHY_RULES = [
    {
        id: 0,
        name: "Queen's Champion",
        req: { tasks: 1000, kneels: 3000, points: 250000, spent: 1000000, streak: 365, prefs: true, limits: true, kinks: true, routine: true, name: true, photo: true },
        benefits: ["Absolute Authority.", "Manifest Will.", "Total Ownership."],
        speakCost: 0
    },
    {
        id: 1,
        name: "Secretary",
        req: { tasks: 500, kneels: 1500, points: 100000, spent: 500000, streak: 180, prefs: true, limits: true, kinks: true, routine: true, name: true, photo: true },
        benefits: ["The Line: A direct Audio Connection.", "Authority: Access to System Commands.", "The Throne: Total, Unfiltered Access."],
        speakCost: 0
    },
    {
        id: 2,
        name: "Chamberlain",
        req: { tasks: 300, kneels: 750, points: 50000, spent: 150000, streak: 90, prefs: true, limits: true, kinks: true, routine: true, name: true, photo: true },
        benefits: ["Speech: All messaging is Free.", "Visuals: Access to Video Sessions.", "Honor: Access to Elite Trials."],
        speakCost: 0
    },
    {
        id: 3,
        name: "Butler",
        req: { tasks: 100, kneels: 250, points: 10000, spent: 50000, streak: 30, prefs: true, limits: true, kinks: true, routine: true, name: true, photo: true },
        benefits: ["Chat Upgrade: Permission to send Videos.", "Voice: Access to Audio Sessions.", "Speak Cost: 5 Coins."],
        speakCost: 5
    },
    {
        id: 4,
        name: "Silverman",
        req: { tasks: 25, kneels: 65, points: 5000, spent: 5000, streak: 5, prefs: true, limits: true, kinks: true, routine: true, name: true, photo: true },
        benefits: ["Chat Upgrade: Permission to send Photos.", "Devotion: Tasks tailored to your Desires.", "Booking: Permission to request Sessions.", "Speak Cost: 10 Coins."],
        speakCost: 10
    },
    {
        id: 5,
        name: "Footman",
        req: { tasks: 5, kneels: 10, points: 2000, spent: 0, streak: 0, name: true, photo: true },
        benefits: ["Presence: Your Face may be revealed.", "Order: Access to the Daily Routine.", "Speak Cost: 15 Coins."],
        speakCost: 15
    },
    {
        id: 6,
        name: "Hall Boy",
        req: { tasks: 0, kneels: 0, points: 0, spent: 0, streak: 0 },
        benefits: ["Identity: You are granted a Name.", "Labor: Permission to begin Basic Tasks.", "Speak Cost: 20 Coins."],
        speakCost: 20
    }
];

// Helper to safely get number from text/number fields
const getNum = (val: any) => {
    if (!val) return 0;
    // Handle both numbers and strings like "15" or "15.0"
    const n = parseFloat(String(val));
    return isNaN(n) ? 0 : Math.floor(n);
};

function buildStatsFromProfile(profile: any) {
    const params = profile.parameters || {};

    // 1. Resolve Stats from TASKS Table (Merged into profile)
    // We check the 'tasks' table columns first, then fallback to 'parameters'
    const tasks = getNum(profile.Taskdom_CompletedTasks) || getNum(params.taskdom_completed_tasks);
    const kneels = getNum(profile.kneelCount) || getNum(params.kneel_count);
    const streak = getNum(profile.Taskdom_Streak) || getNum(params.routine_streak);

    // Score/Wallet come from PROFILES table (Integers)
    const points = profile.score || 0;
    // Spent usually isn't tracked in a simple column, defaulting to 0 or params
    const spent = getNum(params.total_coins_spent);

    // 2. Resolve Identity
    const img = profile.avatar_url || '';
    // Simply check if a URL exists
    const hasPhoto = !!(img && img.length > 5);

    const rawName = profile.name || '';
    const nameStr = rawName.toUpperCase().trim();
    // Valid if not empty and not the default "SLAVE"
    const hasName = nameStr.length > 0 && nameStr !== 'SLAVE' && nameStr !== 'NEW SLAVE';

    // 3. Resolve Details
    const hasLimits = !!(profile.limits && profile.limits.length > 2);
    const hasKinks = !!(profile.kinks && profile.kinks.length > 2);
    const hasRoutine = !!(profile.routine && profile.routine.length > 2);

    return {
        tasks,
        kneels,
        points,
        spent,
        streak,
        hasPhoto,
        hasName,
        hasLimits,
        hasKinks,
        hasRoutine
    };
}

export function getHierarchyReport(profile: any) {
    if (!profile) return null;

    const stats = buildStatsFromProfile(profile);
    const currentRankName = profile.hierarchy || 'Hall Boy';

    // Find Current Rank Index
    let rankIndex = HIERARCHY_RULES.findIndex(r => r.name.toLowerCase() === currentRankName.toLowerCase());
    if (rankIndex === -1) rankIndex = 6;

    const currentRankObj = HIERARCHY_RULES[rankIndex];
    const isMax = rankIndex === 0;

    // Determine "Next Rank"
    const nextRankIndex = isMax ? 0 : rankIndex - 1;
    const nextRankObj = HIERARCHY_RULES[nextRankIndex];
    const req = nextRankObj.req;

    // Build Requirements List
    const requirements: any[] = [];

    if (!isMax) {
        // Only show boolean requirements if they are newly introduced for the NEXT rank 
        // (i.e., the current rank DOES NOT require them)
        const curReq = currentRankObj.req;

        if (req.name && !curReq.name) requirements.push({ label: 'IDENTITY', status: stats.hasName ? 'VERIFIED' : 'MISSING', type: 'check', field: 'name' });
        if (req.photo && !curReq.photo) requirements.push({ label: 'PHOTO', status: stats.hasPhoto ? 'VERIFIED' : 'MISSING', type: 'check', field: 'avatar_url' });

        if ((req.tasks || 0) > 0) requirements.push({ label: 'LABOR', icon: '🛠️', current: stats.tasks, target: req.tasks, type: 'bar' });
        if ((req.kneels || 0) > 0) requirements.push({ label: 'ENDURANCE', icon: '🧎', current: stats.kneels, target: req.kneels, type: 'bar' });
        if ((req.points || 0) > 0) requirements.push({ label: 'MERIT', icon: '✨', current: stats.points, target: req.points, type: 'bar' });
        if ((req.spent || 0) > 0) requirements.push({ label: 'SACRIFICE', icon: '💰', current: stats.spent, target: req.spent, type: 'bar' });
        if ((req.streak || 0) > 0) requirements.push({ label: 'CONSISTENCY', icon: '📅', current: stats.streak, target: req.streak, type: 'bar' });

        if (req.limits && !curReq.limits) requirements.push({ label: 'LIMITS', status: stats.hasLimits ? 'VERIFIED' : 'MISSING', type: 'check', field: 'limits' });
        if (req.kinks && !curReq.kinks) requirements.push({ label: 'KINKS', status: stats.hasKinks ? 'VERIFIED' : 'MISSING', type: 'check', field: 'kinks' });
        if (req.routine && !curReq.routine) requirements.push({ label: 'ROUTINE', status: stats.hasRoutine ? 'VERIFIED' : 'MISSING', type: 'check', field: 'routine' });
    }

    // A user can only promote if they meet ALL cumulative requirements defined on the rank object itself.
    // We must evaluate against `req.kinks` directly, not the filtered visual `requirements` array.
    const allChecksPass = (
        (!req.name || stats.hasName) &&
        (!req.photo || stats.hasPhoto) &&
        (!req.limits || stats.hasLimits) &&
        (!req.kinks || stats.hasKinks) &&
        (!req.routine || stats.hasRoutine)
    );

    const canPromote = !isMax && allChecksPass && requirements.filter(r => r.type === 'bar').every(r => r.current >= r.target);

    return {
        currentRank: currentRankObj.name,
        currentBenefits: currentRankObj.benefits,
        nextRank: nextRankObj.name,
        nextBenefits: nextRankObj.benefits,
        isMax,
        canPromote,
        requirements,
        stats
    };
}
