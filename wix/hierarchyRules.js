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
// --- HELPER: RANK DETERMINATION (Dynamic Logic) ---
export function determineRank(item) {
    const report = getHierarchyReport(item);
    return report.currentRank;
}

/**
 * THE BRAIN: Audits a user record and returns exactly what the frontend should draw.
 * This keeps the frontend "dumb" and prevents flickering.
 */
export function getHierarchyReport(item) {
    if (!item) {
        return {
            currentRank: "Hall Boy",
            nextRank: HIERARCHY_RULES[HIERARCHY_RULES.length - 2].name,
            isMax: false,
            canPromote: false,
            requirements: []
        };
    }
    const clean = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const currentHierarchy = item.hierarchy || "Hall Boy";

    // Find index of current rank
    let currentIndex = HIERARCHY_RULES.findIndex(r => clean(r.name) === clean(currentHierarchy));
    if (currentIndex === -1) currentIndex = HIERARCHY_RULES.length - 1; // Default to Hall Boy

    // Determine if we should be demoted (Gatekeeper Logic)
    // 1. Photo Check
    const SILHOUETTE = "ce3e5b_e06c7a2254d848a480eb98107c35e246";
    const img = item.image_fld || item.image || item.profilePicture || "";
    const hasPhoto = (img && img.length > 5 && !img.includes(SILHOUETTE) && img !== "undefined" && img !== "null");

    // 2. Name Check
    const nameStr = (item.title_fld || item.title || "").toUpperCase().trim();
    const hasName = (nameStr.length > 0 && nameStr !== "SLAVE" && nameStr !== "NEW SLAVE");

    // 3. Demotion Logic (Surgical)
    // If rank is above Hall Boy but missing Name/Photo -> Demote to Hall Boy
    if (currentIndex < HIERARCHY_RULES.length - 1 && (!hasName || !hasPhoto)) {
        return generateReport(item, "Hall Boy");
    }

    // 4. Prefs/Routine Checks (For Silverman+)
    const hasLimits = item.limits && item.limits.length > 2;
    const hasKinks = (item.kinks || item.kink) && (item.kinks || item.kink).length > 2;
    const hasPrefs = hasLimits && hasKinks;
    const hasRoutineSet = (item.routine && item.routine.length > 5) || (item.taskdom_routine && item.taskdom_routine.length > 5);

    if (currentIndex <= 4) { // Silverman or higher
        if (!hasPrefs || !hasRoutineSet) {
            return generateReport(item, "Footman");
        }
    }

    return generateReport(item, currentHierarchy);
}

/**
 * UNIFIED STREAK LOGIC: Ensures both Profile and Dashboard entries 
 * follow the exact same 6 AM Duty Day rules.
 */
export function updateStreakLogic(item, submissionDate = new Date()) {
    const getDutyDay = (d) => {
        let date = new Date(d);
        if (date.getHours() < 6) date.setDate(date.getDate() - 1);
        return date.toISOString().split('T')[0];
    };

    const today = getDutyDay(submissionDate);
    const lastDate = item.lastRoutineDate ? getDutyDay(new Date(item.lastRoutineDate)) : null;

    if (!lastDate) {
        // First ever log
        item.routinestreak = 1;
    } else if (lastDate === today) {
        // Already logged today (Duty period 6am - 6am)
        // Do nothing, don't increment twice in same period
    } else {
        const yesterdayDate = new Date(submissionDate);
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterday = getDutyDay(yesterdayDate);

        if (lastDate === yesterday) {
            // Consecutive day!
            item.routinestreak = (item.routinestreak || 0) + 1;
        } else {
            // Gap detected -> Reset to 1
            item.routinestreak = 1;
        }
    }

    // Update the pointer
    item.lastRoutineDate = submissionDate;

    // High Water Mark (Personal Best)
    if ((item.routinestreak || 0) > (item.bestRoutinestreak || 0)) {
        item.bestRoutinestreak = item.routinestreak;
    }

    return item;
}

function generateReport(item, currentRank) {
    const clean = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const currentIndex = HIERARCHY_RULES.findIndex(r => clean(r.name) === clean(currentRank));
    const nextIndex = currentIndex - 1;
    const isMax = nextIndex < 0;

    const nextRankObj = isMax ? HIERARCHY_RULES[0] : HIERARCHY_RULES[nextIndex];
    const req = nextRankObj.req;

    const report = {
        currentRank: currentRank,
        nextRank: nextRankObj.name,
        isMax: isMax,
        canPromote: false,
        requirements: []
    };

    if (isMax) return report;

    // Build the instruction packet
    // 1. Identity
    if (req.name || req.photo) {
        const SILHOUETTE = "ce3e5b_e06c7a2254d848a480eb98107c35e246";
        const img = item.image_fld || item.image || item.profilePicture || "";
        const hasPhoto = (img && img.length > 5 && !img.includes(SILHOUETTE));
        const nameStr = (item.title_fld || item.title || "").toUpperCase().trim();
        const hasName = (nameStr.length > 0 && nameStr !== "SLAVE" && nameStr !== "NEW SLAVE");

        if (req.name) report.requirements.push({ id: "name", label: "IDENTITY", status: hasName ? "VERIFIED" : "MISSING", type: "check" });
        if (req.photo) report.requirements.push({ id: "photo", label: "PHOTO", status: hasPhoto ? "VERIFIED" : "MISSING", type: "check" });
    }

    // 2. Prefs/Routine
    if (req.prefs || req.limits || req.kinks) {
        const hasLimits = item.limits && item.limits.length > 2;
        const hasKinks = (item.kinks || item.kink) && (item.kinks || item.kink).length > 2;
        if (req.limits) report.requirements.push({ id: "limits", label: "LIMITS", status: hasLimits ? "VERIFIED" : "MISSING", type: "check" });
        if (req.kinks) report.requirements.push({ id: "kinks", label: "KINKS", status: hasKinks ? "VERIFIED" : "MISSING", type: "check" });
    }
    if (req.routine) {
        const hasRoutine = (item.routine && item.routine.length > 5) || (item.taskdom_routine && item.taskdom_routine.length > 5);
        report.requirements.push({ id: "routine", label: "ROUTINE", status: hasRoutine ? "VERIFIED" : "MISSING", type: "check" });
    }

    // 3. Stats (Bars)
    const statsMap = [
        { key: "taskdom_completed_tasks", label: "LABOR", reqKey: "tasks" },
        { key: "kneelCount", label: "ENDURANCE", reqKey: "kneels" },
        { key: "score", label: "MERIT", reqKey: "points" },
        { key: "total_coins_spent", label: "SACRIFICE", reqKey: "spent" },
        { key: "bestRoutinestreak", label: "CONSISTENCY", reqKey: "streak", activeKey: "routinestreak" }
    ];

    statsMap.forEach(s => {
        if (req[s.reqKey] > 0 || (s.reqKey === "tasks" && req.tasks >= 0)) {
            let current = item[s.key] || 0;
            let active = item[s.activeKey] || 0;
            const target = req[s.reqKey];

            // --- STREAK FALLBACK: CALCULATE FROM HISTORY IF DATA IS MISSING ---
            if (s.reqKey === "streak" && current === 0 && active === 0) {
                const historyStr = item.routineHistory || item.routinehistory || "[]";
                const calculated = calculateInternalStreak(historyStr);
                active = calculated.current;
                current = calculated.best;
            }

            const pct = Math.min((current / (target || 1)) * 100, 100);

            const requirement = {
                id: s.reqKey,
                label: s.label,
                current: current, // Best Streak (fills progress)
                target: target,
                percent: pct,
                type: "bar"
            };

            // Add Active (Current) Streak if applicable
            if (s.activeKey) {
                requirement.active = active;
            }

            report.requirements.push(requirement);
        }
    });

    // 4. Can Promote?
    report.canPromote = report.requirements.every(r => {
        if (r.type === "check") return r.status === "VERIFIED";
        if (r.type === "bar") return r.current >= r.target;
        return true;
    });

    return report;
}

/**
 * Internal streak calculator for backend fallback
 */
function calculateInternalStreak(historyStr) {
    let history = [];
    try {
        if (typeof historyStr === 'string') history = JSON.parse(historyStr);
        else if (Array.isArray(historyStr)) history = historyStr;
    } catch (e) { return { current: 0, best: 0 }; }

    if (!history || history.length === 0) return { current: 0, best: 0 };

    // Sort Newest First
    history.sort((a, b) => new Date(b.date || b._createdDate || b) - new Date(a.date || a._createdDate || a));

    const getDutyDay = (d) => {
        let date = new Date(d);
        if (date.getHours() < 6) date.setDate(date.getDate() - 1);
        return date.toISOString().split('T')[0];
    };

    let current = 0;
    let best = 0;
    let tempCurrent = 0;

    const todayCode = getDutyDay(new Date());
    const lastSubmissionDate = history[0].date || history[0]._createdDate || history[0];
    const lastCode = getDutyDay(lastSubmissionDate);

    // Calculate Active Streak (Current)
    const diffDays = (new Date(todayCode) - new Date(lastCode)) / (1000 * 60 * 60 * 24);
    if (diffDays <= 1) {
        tempCurrent = 1;
        let lastDay = lastCode;
        for (let i = 1; i < history.length; i++) {
            const day = getDutyDay(history[i].date || history[i]._createdDate || history[i]);
            if (day === lastDay) continue;

            const prevDay = new Date(lastDay);
            prevDay.setDate(prevDay.getDate() - 1);
            if (day === prevDay.toISOString().split('T')[0]) {
                tempCurrent++;
                lastDay = day;
            } else { break; }
        }
    }
    current = tempCurrent;

    // Calculate All-Time Best (High Water Mark)
    // To be efficient, we scan the history
    let maxBest = current;
    let streakCount = 0;
    let lastDate = null;

    // Sort Oldest First for best streak scan
    const chronHistory = [...history].sort((a, b) => new Date(a.date || a._createdDate || a) - new Date(b.date || b._createdDate || b));

    chronHistory.forEach(h => {
        const day = getDutyDay(h.date || h._createdDate || h);
        if (day === lastDate) return;

        if (!lastDate) {
            streakCount = 1;
        } else {
            const yesterday = new Date(day);
            yesterday.setDate(yesterday.getDate() - 1);
            if (lastDate === yesterday.toISOString().split('T')[0]) {
                streakCount++;
            } else {
                streakCount = 1;
            }
        }
        lastDate = day;
        if (streakCount > maxBest) maxBest = streakCount;
    });

    best = maxBest;
    return { current, best };
}
