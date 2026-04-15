/**
 * Single source of truth for mapping raw Supabase profile + task rows
 * into the unified user object used by both the profile page and dashboard.
 */

function parseTributeTotal(tributeHistory: any): number {
    try {
        const arr = typeof tributeHistory === 'string' ? JSON.parse(tributeHistory) : tributeHistory;
        if (!Array.isArray(arr)) return 0;
        return arr.reduce((sum: number, e: any) => sum + (e.amount < 0 ? Math.abs(e.amount) : 0), 0);
    } catch { return 0; }
}

export function mapUserProfile(p: any, t: any, crowdfundTotal: number = 0): any {
    const params = p.parameters || {};

    let history: any[] = [];
    try { history = typeof t?.Taskdom_History === 'string' ? JSON.parse(t.Taskdom_History) : (t?.Taskdom_History || []); } catch { }

    let pQueue: any[] = [];
    try { pQueue = typeof t?.taskQueue === 'string' ? JSON.parse(t.taskQueue) : (t?.taskQueue || []); } catch { }

    let activeTask = t?.taskdom_active_task || null;
    let endTime = null;
    try {
        if (typeof activeTask === 'string') {
            const parsed = JSON.parse(activeTask);
            endTime = parsed.endTime || null;
            activeTask = parsed;
        } else if (activeTask?.endTime) {
            endTime = activeTask.endTime;
        }
    } catch { }

    const routineUploads = history.filter((h: any) => h.isRoutine && h.status === 'approve').length;
    const tributeTotal = parseTributeTotal(t?.['Tribute History']);

    const rawPic = p.avatar_url || p.profile_picture_url || params?.avatar_url || params?.photoUrl || '';
    const finalPic = (rawPic && rawPic.length > 5 && rawPic !== 'undefined' && rawPic !== 'null') ? rawPic : '/queen-karin.png';
    // Normalise so page.tsx and profile-logic both find it regardless of original column name
    if (finalPic !== '/queen-karin.png' && !p.avatar_url) p.avatar_url = finalPic;

    return {
        ...p,
        id: p.ID || p.id,
        memberId: p.ID || p.id,        // UUID — use p.member_id (email) via spread for display
        name: p.name || p.title || 'Unknown',
        hierarchy: p.hierarchy || 'Hall Boy',
        score: Math.max(Number(p.score || 0), Number(t?.Score || 0), Number(t?.score || 0)),
        wallet: Number(p.wallet || 0),
        Taskdom_History: t?.Taskdom_History || null,
        queue: pQueue,
        activeTask,
        endTime,
        pendingState: t?.taskdom_pending_state || null,
        taskdom_active_task: activeTask,
        taskdom_pending_state: t?.taskdom_pending_state || null,
        kneelCount: Number(t?.kneelCount || p.kneelCount || p.kneel_count || params.kneel_count || 0),
        'today kneeling': t?.['today kneeling'] || '0',
        lastWorship: t?.lastWorship || p.lastWorship || null,
        kneelHistory: p.kneel_history || t?.kneel_history || {},
        taskdom_completed_tasks: Number(t?.['Taskdom_CompletedTasks'] || 0),
        total_coins_spent: Number(params.wishlist_spent || 0) || tributeTotal,
        bestRoutinestreak: routineUploads || Number(p.bestRoutinestreak || params.routine_streak || 0),
        routinestreak: Number(p.routinestreak || params.taskdom_current_streak || 0),
        routineHistory: history,
        routinehistory: history,
        joinedDate: p.joined_date,
        points: Number(t?.Score ?? t?.score ?? p.score ?? 0),
        routine: p.routine || 'None',
        routineDoneToday: p.routine_done_today || false,
        strikeCount: p.strike_count || 0,
        lastSeen: p.last_active,
        image: finalPic,
        profilePicture: finalPic,
        avatar: finalPic,
        title: p.name || '',
        kinks: p.kinks || '',
        limits: p.limits || '',
        silence: p.silence === true,
        parameters: {
            ...params,
            taskdom_active_task: activeTask,
            taskdom_end_time: endTime,
            status: t?.taskdom_pending_state || p.hierarchy,
            lastMessageTime: params.lastMessageTime || 0,
        },
        _totalSpent: crowdfundTotal,
    };
}
