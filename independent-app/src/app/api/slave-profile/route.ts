import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const full = searchParams.get('full') === 'true';

    if (!email) {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (full) {
        // Returns merged profiles + tasks using admin client (bypasses RLS)
        const { data: profileData, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .ilike('member_id', email)
            .maybeSingle();

        if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

        const { data: taskData } = await supabaseAdmin
            .from('tasks')
            .select('*')
            .ilike('member_id', email)
            .maybeSingle();

        // Sum all crowdfund contributions for this user
        const { data: contribData } = await supabaseAdmin
            .from('crowdfund_contributions')
            .select('amount_given')
            .eq('member_id', email);
        const crowdfundTotal = (contribData || []).reduce((sum: number, r: any) => sum + (r.amount_given || 0), 0);

        // --- Same mapping as mapUserForDashboard in velo-actions.ts ---
        const p = profileData as any || {};
        const t = taskData as any || {};
        const params = p.parameters || {};

        // Parse Taskdom_History
        let history: any[] = [];
        if (t.Taskdom_History) {
            try { history = typeof t.Taskdom_History === 'string' ? JSON.parse(t.Taskdom_History) : t.Taskdom_History; } catch (e) { history = []; }
        }

        // Parse taskQueue
        let pQueue: any[] = [];
        if (t.taskQueue) {
            try { pQueue = typeof t.taskQueue === 'string' ? JSON.parse(t.taskQueue) : (t.taskQueue || []); } catch (e) { }
        }

        // Parse active task
        let activeTask = t?.taskdom_active_task || null;
        let endTime = null;
        try {
            if (typeof activeTask === 'string') {
                const parsed = JSON.parse(activeTask);
                endTime = parsed.endTime || null;
                activeTask = parsed;
            } else if (activeTask && activeTask.endTime) {
                endTime = activeTask.endTime;
            }
        } catch (e) { }

        const routineUploads = history.filter((h: any) => h.isRoutine && h.status === 'approve').length;

        // Sacrifice: sum absolute values of negative entries in Tribute History
        let tributeTotal = 0;
        try {
            const rawTributes = t?.['Tribute History'];
            const tributeArr: any[] = typeof rawTributes === 'string' ? JSON.parse(rawTributes) : (Array.isArray(rawTributes) ? rawTributes : []);
            tributeTotal = tributeArr.reduce((sum: number, e: any) => sum + (e.amount < 0 ? Math.abs(e.amount) : 0), 0);
        } catch (e) { }

        const defaultPic = "https://static.wixstatic.com/media/ce3e5b_78da97e06a3848df84d0b00c9e6dcfdd~mv2.png";
        const rawPic = p.avatar_url || p.profile_picture_url || "";
        const finalPic = (rawPic && rawPic.length > 5 && rawPic !== "undefined" && rawPic !== "null") ? rawPic : defaultPic;

        return NextResponse.json({
            // Exact same output as mapUserForDashboard in velo-actions.ts
            ...p,
            id: p.member_id || p.id,
            memberId: p.member_id || p.id,
            name: p.name || p.title || "Unknown",
            hierarchy: p.hierarchy || "Hall Boy",
            score: Number(t?.Score ?? t?.score ?? p.score ?? 0),
            wallet: Number(p.wallet || 0),
            // Task fields
            Taskdom_History: t.Taskdom_History || null,
            queue: pQueue,
            activeTask: activeTask,
            endTime: endTime,
            pendingState: t?.taskdom_pending_state || null,
            taskdom_active_task: activeTask,
            taskdom_pending_state: t?.taskdom_pending_state || null,
            kneelCount: Number(t?.kneelCount || p.kneelCount || p.kneel_count || params.kneel_count || 0),
            'today kneeling': t['today kneeling'] || '0',
            lastWorship: t.lastWorship || p.lastWorship || null,
            kneelHistory: p.kneel_history || t.kneel_history || {},
            // Computed hierarchy fields
            taskdom_completed_tasks: Number(t?.['Taskdom_CompletedTasks'] || 0),
            total_coins_spent: tributeTotal || Number(params.wishlist_spent || 0),
            bestRoutinestreak: routineUploads || Number(p.bestRoutinestreak || params.routine_streak || 0),
            routinestreak: Number(p.routinestreak || params.taskdom_current_streak || 0),
            routineHistory: history,
            routinehistory: history,
            // Profile details
            joinedDate: p.joined_date,
            points: Number(t?.Score ?? t?.score ?? p.score ?? 0),
            routine: p.routine || "None",
            routineDoneToday: p.routine_done_today || false,
            strikeCount: p.strike_count || 0,
            lastSeen: p.last_active,
            // Identity fields for getHierarchyReport
            image: finalPic,
            profilePicture: finalPic,
            avatar: finalPic,
            title: p.name || "",
            kinks: p.kinks || "",
            limits: p.limits || "",
            // Parameters (enhanced, same as dashboard)
            parameters: {
                ...params,
                taskdom_active_task: activeTask,
                taskdom_end_time: endTime,
                status: t?.taskdom_pending_state || p.hierarchy,
                lastMessageTime: params.lastMessageTime || 0,
            },
            // Crowdfund total
            _totalSpent: crowdfundTotal,
        });
    }

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('member_id', email)
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { email, ...updates } = body;

    if (!email) {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('member_id', email)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, profile: data });
}
