import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://ntrerrxudvgbjyscmdvh.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50cmVycnh1ZHZnYmp5c2NtZHZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTE3MTAyNCwiZXhwIjoyMDg2NzQ3MDI0fQ.q1lwfVhJKIddxGyMOqwWliNScPaNAXK1uO6Q372b1c8';
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ─── HIERARCHY RULES (mirror of hierarchyRules.ts) ────────────────────────────
const HIERARCHY_RULES = [
    { name: "Queen's Champion", req: { tasks: 1000, kneels: 3000, points: 250000, spent: 1000000, streak: 365, prefs: true, limits: true, kinks: true, routine: true, name: true, photo: true } },
    { name: "Secretary",        req: { tasks: 500,  kneels: 1500, points: 100000, spent: 500000,  streak: 180, prefs: true, limits: true, kinks: true, routine: true, name: true, photo: true } },
    { name: "Chamberlain",      req: { tasks: 300,  kneels: 750,  points: 50000,  spent: 150000,  streak: 90,  prefs: true, limits: true, kinks: true, routine: true, name: true, photo: true } },
    { name: "Butler",           req: { tasks: 100,  kneels: 250,  points: 10000,  spent: 50000,   streak: 30,  prefs: true, limits: true, kinks: true, routine: true, name: true, photo: true } },
    { name: "Silverman",        req: { tasks: 25,   kneels: 65,   points: 5000,   spent: 5000,    streak: 5,   prefs: true, limits: true, kinks: true, routine: true, name: true, photo: true } },
    { name: "Footman",          req: { tasks: 5,    kneels: 10,   points: 2000,   spent: 0,       streak: 0,   name: true, photo: true } },
    { name: "Hall Boy",         req: { tasks: 0,    kneels: 0,    points: 0,      spent: 0,       streak: 0 } },
];

const SILHOUETTE = "ce3e5b_e06c7a2254d848a480eb98107c35e246";

// ─── STEP 1: UPLOAD DEFAULT AVATAR ────────────────────────────────────────────
console.log('--- Step 1: Upload default avatar ---');
const imageBuffer = fs.readFileSync('/Users/liviacechova/Desktop/livia/xxxKARINxxx/emojis discord/no (43).png');
const { error: uploadError } = await supabase.storage
    .from('media')
    .upload('default-avatar.png', imageBuffer, { contentType: 'image/png', upsert: true });

if (uploadError) {
    console.error('Upload error:', uploadError.message);
    process.exit(1);
}

const { data: { publicUrl: DEFAULT_AVATAR_URL } } = supabase.storage.from('media').getPublicUrl('default-avatar.png');
console.log('Default avatar URL:', DEFAULT_AVATAR_URL);

// ─── STEP 2: SET DEFAULT AVATAR ON ALL PROFILES ───────────────────────────────
console.log('\n--- Step 2: Set default avatar on all profiles ---');
const { error: avatarErr, count: avatarCount } = await supabase
    .from('profiles')
    .update({ avatar_url: DEFAULT_AVATAR_URL })
    .neq('member_id', '')
    .select('member_id', { count: 'exact', head: true });

if (avatarErr) { console.error('Avatar set error:', avatarErr.message); process.exit(1); }
console.log(`Set avatar on ${avatarCount ?? 'all'} profiles.`);

// ─── STEP 3: FETCH ALL DATA ────────────────────────────────────────────────────
console.log('\n--- Step 3: Fetch all data ---');

const [{ data: profiles }, { data: tasks }, { data: contributions }] = await Promise.all([
    supabase.from('profiles').select('member_id, name, score, hierarchy, limits, kinks, routine, parameters, total_coins_spent'),
    supabase.from('tasks').select('member_id, kneelCount, "Taskdom_CompletedTasks", "Taskdom_History", routinehistory, bestRoutinestreak, routinestreak'),
    supabase.from('crowdfund_contributions').select('member_id, amount_given'),
]);

console.log(`Profiles: ${profiles?.length}, Tasks: ${tasks?.length}, Contributions: ${contributions?.length}`);

// Build lookup maps
const taskMap = {};
(tasks || []).forEach(t => { taskMap[t.member_id?.toLowerCase()] = t; });

const spentMap = {};
(contributions || []).forEach(c => {
    const key = c.member_id?.toLowerCase();
    spentMap[key] = (spentMap[key] || 0) + (c.amount_given || 0);
});

// ─── STREAK CALCULATOR ────────────────────────────────────────────────────────
function calcBestStreak(historyRaw) {
    let history = [];
    try {
        if (typeof historyRaw === 'string') history = JSON.parse(historyRaw);
        else if (Array.isArray(historyRaw)) history = historyRaw;
    } catch { return 0; }
    if (!history.length) return 0;

    const getDutyDay = (d) => {
        const date = new Date(d);
        if (isNaN(date.getTime())) return '';
        if (date.getHours() < 6) date.setDate(date.getDate() - 1);
        return date.toISOString().split('T')[0];
    };

    // Sort oldest-first
    const sorted = [...history].sort((a, b) =>
        new Date(a.date || a._createdDate || a).getTime() -
        new Date(b.date || b._createdDate || b).getTime()
    );

    let best = 0, streak = 0, lastDay = null;
    for (const h of sorted) {
        const day = getDutyDay(h.date || h._createdDate || h);
        if (!day) continue;
        if (day === lastDay) continue;
        if (!lastDay) {
            streak = 1;
        } else {
            const prev = new Date(lastDay);
            prev.setDate(prev.getDate() + 1);
            streak = (day === prev.toISOString().split('T')[0]) ? streak + 1 : 1;
        }
        lastDay = day;
        if (streak > best) best = streak;
    }
    return best;
}

// ─── COUNT APPROVED TASKS FROM HISTORY ───────────────────────────────────────
function countApprovedTasks(historyRaw) {
    let history = [];
    try {
        if (typeof historyRaw === 'string') history = JSON.parse(historyRaw);
        else if (Array.isArray(historyRaw)) history = historyRaw;
    } catch { return 0; }
    return history.filter(h => h.status === 'approve' && !h.isRoutine).length;
}

// ─── RANK EVALUATOR ───────────────────────────────────────────────────────────
function computeCorrectRank(p, t, totalSpent, avatarUrl) {
    const params = p.parameters || {};
    const name = (p.name || '').toUpperCase().trim();
    const hasName = name.length > 0 && name !== 'SLAVE' && name !== 'NEW SLAVE';
    const hasPhoto = !!(avatarUrl && avatarUrl.length > 5 && !avatarUrl.includes(SILHOUETTE));

    const historyRaw = t?.Taskdom_History || null;
    const approvedFromHistory = countApprovedTasks(historyRaw);
    const completedTasks = approvedFromHistory || Number(t?.Taskdom_CompletedTasks || params.taskdom_completed_tasks || 0);

    const kneels = Number(t?.kneelCount || params.kneel_count || 0);
    const points = Number(p.score || 0);
    const spent  = totalSpent || Number(p.total_coins_spent || params.total_coins_spent || 0);

    // Best streak: stored value OR calculated from history
    let bestStreak = Number(t?.bestRoutinestreak || params.routine_streak || 0);
    if (bestStreak === 0) {
        bestStreak = calcBestStreak(t?.routinehistory || null);
    }

    const hasLimits  = (p.limits || '').length > 2;
    const hasKinks   = (p.kinks || '').length > 2;
    const hasRoutine = (p.routine || '').length > 5;

    // Walk ranks from highest to lowest, return first one user qualifies for
    for (const rule of HIERARCHY_RULES) {
        const r = rule.req;
        if (r.name   && !hasName)                          continue;
        if (r.photo  && !hasPhoto)                         continue;
        if (r.limits && !hasLimits)                        continue;
        if (r.kinks  && !hasKinks)                         continue;
        if (r.routine && !hasRoutine)                      continue;
        if ((r.tasks  || 0) > 0 && completedTasks < r.tasks)  continue;
        if ((r.kneels || 0) > 0 && kneels < r.kneels)         continue;
        if ((r.points || 0) > 0 && points < r.points)         continue;
        if ((r.spent  || 0) > 0 && spent  < r.spent)          continue;
        if ((r.streak || 0) > 0 && bestStreak < r.streak)     continue;
        return rule.name;
    }
    return 'Hall Boy';
}

// ─── STEP 4: COMPUTE & UPDATE RANKS ──────────────────────────────────────────
console.log('\n--- Step 4: Compute correct ranks ---');

const updates = [];
const summary = {};

for (const p of (profiles || [])) {
    const key = p.member_id?.toLowerCase();
    const t = taskMap[key] || {};
    const spent = spentMap[key] || 0;

    const correctRank = computeCorrectRank(p, t, spent, DEFAULT_AVATAR_URL);
    const oldRank = p.hierarchy || 'Hall Boy';

    summary[correctRank] = (summary[correctRank] || 0) + 1;

    if (correctRank !== oldRank) {
        updates.push({ member_id: p.member_id, old: oldRank, new: correctRank });
    }
}

console.log('\nRank distribution after recalc:');
for (const [rank, count] of Object.entries(summary).sort((a,b) => b[1]-a[1])) {
    console.log(`  ${rank}: ${count}`);
}

console.log(`\n${updates.length} profiles need rank updates:`);
updates.forEach(u => console.log(`  ${u.member_id}: ${u.old} → ${u.new}`));

// ─── STEP 5: APPLY UPDATES ────────────────────────────────────────────────────
if (updates.length === 0) {
    console.log('\nAll ranks already correct. Done.');
    process.exit(0);
}

console.log('\n--- Step 5: Applying rank updates ---');
let successCount = 0, failCount = 0;

for (const u of updates) {
    const { error } = await supabase
        .from('profiles')
        .update({ hierarchy: u.new })
        .eq('member_id', u.member_id);

    if (error) {
        console.error(`  FAIL ${u.member_id}: ${error.message}`);
        failCount++;
    } else {
        console.log(`  ✓ ${u.member_id}: ${u.old} → ${u.new}`);
        successCount++;
    }
}

console.log(`\nDone. Updated: ${successCount}, Failed: ${failCount}`);
