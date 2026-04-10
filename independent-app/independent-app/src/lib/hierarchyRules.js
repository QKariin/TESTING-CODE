"use strict";
// --- CENTRAL HIERARCHY CONFIGURATION (Source of Truth) ---
// PLACE THIS FILE IN: Public > hierarchyRules.js
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HIERARCHY_RULES = void 0;
exports.determineRank = determineRank;
exports.getHierarchyReport = getHierarchyReport;
exports.updateStreakLogic = updateStreakLogic;
exports.rankMeetsRequirement = rankMeetsRequirement;
exports.HIERARCHY_RULES = [
    {
        name: "Queen's Champion",
        req: { tasks: 1000, kneels: 3000, points: 250000, spent: 1000000, streak: 365, prefs: true, limits: true, kinks: true, routine: true, name: true, photo: true },
        benefits: ["Absolute Authority.", "Manifest Will.", "Total Ownership."],
        speakCost: 0
    },
    {
        name: "Secretary",
        req: { tasks: 500, kneels: 1500, points: 100000, spent: 500000, streak: 180, prefs: true, limits: true, kinks: true, routine: true, name: true, photo: true },
        benefits: ["The Line: A direct Audio Connection.", "Authority: Access to System Commands.", "The Throne: Total, Unfiltered Access."],
        speakCost: 0
    },
    {
        name: "Chamberlain",
        req: { tasks: 300, kneels: 750, points: 50000, spent: 150000, streak: 90, prefs: true, limits: true, kinks: true, routine: true, name: true, photo: true },
        benefits: ["Speech: All messaging is Free.", "Visuals: Access to Video Sessions.", "Honor: Access to Elite Trials."],
        speakCost: 0
    },
    {
        name: "Butler",
        req: { tasks: 100, kneels: 250, points: 10000, spent: 50000, streak: 30, prefs: true, limits: true, kinks: true, routine: true, name: true, photo: true },
        benefits: ["Chat Upgrade: Permission to send Videos.", "Voice: Access to Audio Sessions.", "Speak Cost: 5 Coins."],
        speakCost: 5
    },
    {
        name: "Silverman",
        req: { tasks: 25, kneels: 65, points: 5000, spent: 5000, streak: 5, prefs: true, limits: true, kinks: true, routine: true, name: true, photo: true },
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
// --- HELPER: RANK DETERMINATION (Dynamic Logic) ---
function determineRank(item) {
    var report = getHierarchyReport(item);
    return report.currentRank;
}
/**
 * THE BRAIN: Audits a user record and returns exactly what the frontend should draw.
 * This keeps the frontend "dumb" and prevents flickering.
 */
function getHierarchyReport(item) {
    if (!item) {
        return {
            currentRank: "Hall Boy",
            nextRank: exports.HIERARCHY_RULES[exports.HIERARCHY_RULES.length - 2].name,
            isMax: false,
            canPromote: false,
            requirements: [],
            currentBenefits: exports.HIERARCHY_RULES[exports.HIERARCHY_RULES.length - 1].benefits,
            nextBenefits: exports.HIERARCHY_RULES[exports.HIERARCHY_RULES.length - 2].benefits
        };
    }
    var clean = function (s) { return (s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); };
    var currentHierarchy = item.hierarchy || "Hall Boy";
    // Find index of current rank
    var currentIndex = exports.HIERARCHY_RULES.findIndex(function (r) { return clean(r.name) === clean(currentHierarchy); });
    if (currentIndex === -1)
        currentIndex = exports.HIERARCHY_RULES.length - 1; // Default to Hall Boy
    return generateReport(item, currentHierarchy);
}
/**
 * UNIFIED STREAK LOGIC: Ensures both Profile and Dashboard entries
 * follow the exact same 6 AM Duty Day rules.
 */
function updateStreakLogic(item, submissionDate) {
    if (submissionDate === void 0) { submissionDate = new Date(); }
    var getDutyDay = function (d) {
        var date = new Date(d);
        if (isNaN(date.getTime()))
            return '';
        if (date.getHours() < 6)
            date.setDate(date.getDate() - 1);
        return date.toISOString().split('T')[0];
    };
    var today = getDutyDay(submissionDate);
    var lastDate = item.lastRoutineDate ? getDutyDay(item.lastRoutineDate) : null;
    if (!lastDate) {
        // First ever log
        item.routinestreak = 1;
    }
    else if (lastDate === today) {
        // Already logged today (Duty period 6am - 6am)
        // Do nothing, don't increment twice in same period
    }
    else {
        var yesterdayDate = new Date(submissionDate);
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        var yesterday = getDutyDay(yesterdayDate);
        if (lastDate === yesterday) {
            // Consecutive day!
            item.routinestreak = (item.routinestreak || 0) + 1;
        }
        else {
            // Gap detected -> Reset to 1
            item.routinestreak = 1;
        }
    }
    // Update the pointer
    item.lastRoutineDate = submissionDate.toISOString();
    // High Water Mark (Personal Best)
    if ((item.routinestreak || 0) > (item.bestRoutinestreak || 0)) {
        item.bestRoutinestreak = item.routinestreak;
    }
    return item;
}
function generateReport(item, currentRank) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    var clean = function (s) { return (s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); };
    var currentIndex = exports.HIERARCHY_RULES.findIndex(function (r) { return clean(r.name) === clean(currentRank); });
    var nextIndex = currentIndex - 1;
    var isMax = nextIndex < 0;
    var currentRankObj = currentIndex >= 0 ? exports.HIERARCHY_RULES[currentIndex] : exports.HIERARCHY_RULES[exports.HIERARCHY_RULES.length - 1];
    var nextRankObj = isMax ? exports.HIERARCHY_RULES[0] : exports.HIERARCHY_RULES[nextIndex];
    var req = nextRankObj.req;
    var report = {
        currentRank: currentRank,
        nextRank: nextRankObj.name,
        isMax: isMax,
        canPromote: false,
        requirements: [],
        currentBenefits: currentRankObj.benefits,
        nextBenefits: isMax ? [] : nextRankObj.benefits
    };
    if (isMax)
        return report;
    // Build the instruction packet
    // 1. Identity
    if (req.name || req.photo) {
        var SILHOUETTE = "ce3e5b_e06c7a2254d848a480eb98107c35e246";
        var img = item.image_fld || item.image || item.profilePicture || "";
        var hasPhoto = (img && img.length > 5 && !img.includes(SILHOUETTE));
        var nameStr = (item.title_fld || item.title || "").toUpperCase().trim();
        var hasName = (nameStr.length > 0 && nameStr !== "SLAVE" && nameStr !== "NEW SLAVE");
        if (req.name)
            report.requirements.push({ id: "name", label: "IDENTITY", status: hasName ? "VERIFIED" : "MISSING", type: "check" });
        if (req.photo)
            report.requirements.push({ id: "photo", label: "PHOTO", status: hasPhoto ? "VERIFIED" : "MISSING", type: "check" });
    }
    // 2. Prefs/Routine
    if (req.prefs || req.limits || req.kinks) {
        var hasLimits = ((_b = (_a = item.limits) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) > 2;
        var hasKinks = ((_d = (_c = (item.kinks || item.kink)) === null || _c === void 0 ? void 0 : _c.length) !== null && _d !== void 0 ? _d : 0) > 2;
        if (req.limits)
            report.requirements.push({ id: "limits", label: "LIMITS", status: hasLimits ? "VERIFIED" : "MISSING", type: "check" });
        if (req.kinks)
            report.requirements.push({ id: "kinks", label: "KINKS", status: hasKinks ? "VERIFIED" : "MISSING", type: "check" });
    }
    if (req.routine) {
        var hasRoutine = ((_f = (_e = item.routine) === null || _e === void 0 ? void 0 : _e.length) !== null && _f !== void 0 ? _f : 0) > 5 || ((_h = (_g = item.taskdom_routine) === null || _g === void 0 ? void 0 : _g.length) !== null && _h !== void 0 ? _h : 0) > 5;
        report.requirements.push({ id: "routine", label: "ROUTINE", status: hasRoutine ? "VERIFIED" : "MISSING", type: "check" });
    }
    // 3. Stats (Bars)
    var statsMap = [
        { key: "taskdom_completed_tasks", label: "LABOR", reqKey: "tasks" },
        { key: "kneelCount", label: "ENDURANCE", reqKey: "kneels" },
        { key: "score", label: "MERIT", reqKey: "points" },
        { key: "total_coins_spent", label: "SACRIFICE", reqKey: "spent" },
        { key: "bestRoutinestreak", label: "CONSISTENCY", reqKey: "streak", activeKey: "routinestreak" }
    ];
    statsMap.forEach(function (s) {
        var target = req[s.reqKey];
        if (req[s.reqKey] > 0 || (s.reqKey === "tasks" && req.tasks >= 0)) {
            var current = item[s.key] || 0;
            var active = s.activeKey ? (item[s.activeKey] || 0) : 0;
            // --- STREAK FALLBACK: CALCULATE FROM HISTORY IF DATA IS MISSING ---
            if (s.reqKey === "streak" && current === 0 && active === 0) {
                var historyStr = item.routineHistory || item.routinehistory || "[]";
                var calculated = calculateInternalStreak(historyStr);
                active = calculated.current;
                current = calculated.best;
            }
            var pct = Math.min((current / (target || 1)) * 100, 100);
            var requirement = {
                id: String(s.reqKey),
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
    report.canPromote = report.requirements.every(function (r) {
        var _a, _b;
        if (r.type === "check")
            return r.status === "VERIFIED";
        if (r.type === "bar")
            return ((_a = r.current) !== null && _a !== void 0 ? _a : 0) >= ((_b = r.target) !== null && _b !== void 0 ? _b : 0);
        return true;
    });
    return report;
}
function rankMeetsRequirement(userRank, requiredRank) {
    var clean = function (s) { return (s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); };
    var userIdx = exports.HIERARCHY_RULES.findIndex(function (r) { return clean(r.name) === clean(userRank); });
    var reqIdx = exports.HIERARCHY_RULES.findIndex(function (r) { return clean(r.name) === clean(requiredRank); });
    var safeUser = userIdx === -1 ? exports.HIERARCHY_RULES.length - 1 : userIdx;
    var safeReq = reqIdx === -1 ? exports.HIERARCHY_RULES.length - 1 : reqIdx;
    return safeUser <= safeReq;
}
/**
 * Internal streak calculator for backend fallback
 */
function calculateInternalStreak(historyStr) {
    var history = [];
    try {
        if (typeof historyStr === 'string')
            history = JSON.parse(historyStr);
        else if (Array.isArray(historyStr))
            history = historyStr;
    }
    catch (e) {
        return { current: 0, best: 0 };
    }
    if (!history || history.length === 0)
        return { current: 0, best: 0 };
    // Sort Newest First
    history.sort(function (a, b) { return new Date(b.date || b._createdDate || b).getTime() - new Date(a.date || a._createdDate || a).getTime(); });
    var getDutyDay = function (d) {
        var date = new Date(d);
        if (isNaN(date.getTime()))
            return '';
        if (date.getHours() < 6)
            date.setDate(date.getDate() - 1);
        return date.toISOString().split('T')[0];
    };
    var current = 0;
    var best = 0;
    var tempCurrent = 0;
    var todayCode = getDutyDay(new Date());
    var lastSubmissionDate = history[0].date || history[0]._createdDate || history[0];
    var lastCode = getDutyDay(lastSubmissionDate);
    // Calculate Active Streak (Current)
    var diffDays = (new Date(todayCode).getTime() - new Date(lastCode).getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays <= 1) {
        tempCurrent = 1;
        var lastDay = lastCode;
        for (var i = 1; i < history.length; i++) {
            var day = getDutyDay(history[i].date || history[i]._createdDate || history[i]);
            if (day === lastDay)
                continue;
            var prevDay = new Date(lastDay);
            prevDay.setDate(prevDay.getDate() - 1);
            if (day === prevDay.toISOString().split('T')[0]) {
                tempCurrent++;
                lastDay = day;
            }
            else {
                break;
            }
        }
    }
    current = tempCurrent;
    // Calculate All-Time Best (High Water Mark)
    var maxBest = current;
    var streakCount = 0;
    var lastDate = null;
    // Sort Oldest First for best streak scan
    var chronHistory = __spreadArray([], history, true).sort(function (a, b) { return new Date(a.date || a._createdDate || a).getTime() - new Date(b.date || b._createdDate || b).getTime(); });
    chronHistory.forEach(function (h) {
        var day = getDutyDay(h.date || h._createdDate || h);
        if (day === lastDate)
            return;
        if (!lastDate) {
            streakCount = 1;
        }
        else {
            var yesterday = new Date(day);
            yesterday.setDate(yesterday.getDate() - 1);
            if (lastDate === yesterday.toISOString().split('T')[0]) {
                streakCount++;
            }
            else {
                streakCount = 1;
            }
        }
        lastDate = day;
        if (streakCount > maxBest)
            maxBest = streakCount;
    });
    best = maxBest;
    return { current: current, best: best };
}
