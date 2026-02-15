// --- CENTRAL HIERARCHY CONFIGURATION (Source of Truth) ---
// PLACE THIS FILE IN: Public > hierarchyRules.js

export const HIERARCHY_RULES = [
    {
        name: "Queen's Champion",
        req: { tasks: 1000, kneels: 3000, points: 250000, spent: 1000000, streak: 365, prefs: true, limits: true, kinks: true, routine: true },
        benefits: ["Absolute Authority.", "Manifest Will.", "Total Ownership."]
    },
    {
        name: "Secretary",
        req: { tasks: 500, kneels: 1500, points: 100000, spent: 500000, streak: 180, prefs: true, limits: true, kinks: true, routine: true },
        benefits: ["The Line: A direct Audio Connection.", "Authority: Access to System Commands.", "The Throne: Total, Unfiltered Access."]
    },
    {
        name: "Chamberlain",
        req: { tasks: 300, kneels: 750, points: 50000, spent: 150000, streak: 90, prefs: true, limits: true, kinks: true, routine: true },
        benefits: ["Speech: All messaging is Free.", "Visuals: Access to Video Sessions.", "Honor: Access to Elite Trials."]
    },
    {
        name: "Butler",
        req: { tasks: 100, kneels: 250, points: 10000, spent: 50000, streak: 30, prefs: true, limits: true, kinks: true, routine: true },
        benefits: ["Chat Upgrade: Permission to send Videos.", "Voice: Access to Audio Sessions.", "Speak Cost: 5 Coins."]
    },
    {
        name: "Silverman",
        req: { tasks: 25, kneels: 65, points: 5000, spent: 5000, streak: 5, prefs: true, limits: true, kinks: true, routine: true },
        benefits: ["Chat Upgrade: Permission to send Photos.", "Devotion: Tasks tailored to your Desires.", "Booking: Permission to request Sessions.", "Speak Cost: 10 Coins."]
    },
    {
        name: "Footman",
        req: { tasks: 5, kneels: 10, points: 2000, spent: 0, streak: 0, name: true, photo: true },
        benefits: ["Presence: Your Face may be revealed.", "Order: Access to the Daily Routine.", "Speak Cost: 15 Coins."]
    },
    {
        name: "Hall Boy",
        req: { tasks: 0, kneels: 0, points: 0, spent: 0, streak: 0 },
        benefits: ["Identity: You are granted a Name.", "Labor: Permission to begin Basic Tasks.", "Speak Cost: 20 Coins."]
    }
];

// --- HELPER: RANK DETERMINATION (Dynamic Logic) ---
export function determineRank(item) {
    const tasks = item.taskdom_completed_tasks || 0;
    const kneels = item.kneelCount || 0;
    const points = item.score || 0;
    const spent = item.total_coins_spent || 0;
    const streak = item.routinestreak || 0;
    const name = item.title_fld || item.title || "";

    // 1. GATEKEEPER: MUST HAVE PROFILE IMAGE (image_fld)
    // Must exist AND not be the default silhouette
    const SILHOUETTE = "ce3e5b_e06c7a2254d848a480eb98107c35e246";
    let img = item.image_fld || item.image || item.profilePicture;

    // Sanitize
    if (typeof img !== 'string') img = "";

    // Check for "undefined" string, "null" string, or empty
    if (!img || img === "undefined" || img === "null" || img.trim() === "") {
        return "Hall Boy";
    }

    // Check for specific silhouette ID
    if (img.includes(SILHOUETTE)) {
        return "Hall Boy";
    }

    // 2. GATEKEEPER: MUST HAVE VALID NAME
    // Case insensitive check against forbidden names
    const n = name.toUpperCase().trim();
    if (!n || n === "SLAVE" || n === "NEW SLAVE") {
        return "Hall Boy";
    }

    // 3. GATEKEEPER: MUST HAVE 10+ KNEELS (Footman Minimum)
    if (kneels < 10) {
        return "Hall Boy";
    }

    // --- PREFS CHECK ---
    const hasLimits = item.limits && item.limits.length > 2;
    const hasKinks = (item.kinks || item.kink) && (item.kinks || item.kink).length > 2;
    const hasPrefs = hasLimits && hasKinks;

    // --- ROUTINE CHECK ---
    const hasRoutineSet = (item.routine && item.routine.length > 5) || (item.taskdom_routine && item.taskdom_routine.length > 5);

    // --- ITERATE RULES (Descending) ---
    for (const rank of HIERARCHY_RULES) {
        // Skip Hall Boy in loop (default return)
        if (rank.name === "Hall Boy") continue;

        const req = rank.req;

        // Check Metrics
        if (tasks < req.tasks) continue;
        if (kneels < req.kneels) continue;
        if (points < req.points) continue;
        if (spent < req.spent) continue;
        if (streak < req.streak) continue;

        // Check Flags
        if (req.prefs && !hasPrefs) continue;
        if (req.routine && !hasRoutineSet) continue;

        // If we passed all checks for this rank, return it!
        return rank.name;
    }

    return "Hall Boy";
}
