import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';

const ADMIN_EMAILS = ['ceo@qkarin.com'];

async function getCallerEmail(): Promise<string | null> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        return user?.email?.toLowerCase() || null;
    } catch {
        return null;
    }
}

function stripSensitive(response: any, isAdmin: boolean): any {
    if (!response || typeof response !== 'object') return response;

    // Strip member_id (email) from API responses — use memberId alias if needed
    const { member_id, ...rest } = response;

    if (isAdmin) return rest;

    // Non-admin (user viewing own profile): strip tracking data (IP/location)
    const params = rest.parameters ? { ...rest.parameters } : {};
    delete params.tracking_data;
    return { ...rest, parameters: params };
}

async function buildFullProfile(email: string) {
    const [{ data: profileData, error: profileError }, { data: taskData }, { data: contribData }] = await Promise.all([
        supabaseAdmin.from('profiles').select('*').ilike('member_id', email).maybeSingle(),
        supabaseAdmin.from('tasks').select('*').ilike('member_id', email).maybeSingle(),
        supabaseAdmin.from('crowdfund_contributions').select('amount_given').eq('member_id', email),
    ]);

    if (profileError) throw profileError;

    const p: any = profileData || {};
    const t: any = taskData || {};
    const params = p.parameters || {};
    const crowdfundTotal = (contribData || []).reduce((sum: number, r: any) => sum + (r.amount_given || 0), 0);

    let history: any[] = [];
    try { history = typeof t.Taskdom_History === 'string' ? JSON.parse(t.Taskdom_History) : (t.Taskdom_History || []); } catch { }

    let pQueue: any[] = [];
    try { pQueue = typeof t.taskQueue === 'string' ? JSON.parse(t.taskQueue) : (t.taskQueue || []); } catch { }

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

    let tributeTotal = 0;
    try {
        const rawTributes = t?.['Tribute History'];
        const tributeArr: any[] = typeof rawTributes === 'string' ? JSON.parse(rawTributes) : (Array.isArray(rawTributes) ? rawTributes : []);
        tributeTotal = tributeArr.reduce((sum: number, e: any) => sum + (e.amount < 0 ? Math.abs(e.amount) : 0), 0);
    } catch { }

    const rawPic = p.avatar_url || p.profile_picture_url || '';
    const finalPic = (rawPic && rawPic.length > 5 && rawPic !== 'undefined' && rawPic !== 'null') ? rawPic : '/queen-karin.png';

    return {
        ...p,
        id: p.id,
        memberId: p.member_id,
        name: p.name || p.title || 'Unknown',
        hierarchy: p.hierarchy || 'Hall Boy',
        score: Number(t?.Score ?? t?.score ?? p.score ?? 0),
        wallet: Number(p.wallet || 0),
        Taskdom_History: t.Taskdom_History || null,
        queue: pQueue,
        activeTask,
        endTime,
        pendingState: t?.taskdom_pending_state || null,
        taskdom_active_task: activeTask,
        taskdom_pending_state: t?.taskdom_pending_state || null,
        kneelCount: Number(t?.kneelCount || p.kneelCount || p.kneel_count || params.kneel_count || 0),
        'today kneeling': t['today kneeling'] || '0',
        lastWorship: t.lastWorship || p.lastWorship || null,
        kneelHistory: p.kneel_history || t.kneel_history || {},
        taskdom_completed_tasks: Number(t?.['Taskdom_CompletedTasks'] || 0),
        total_coins_spent: tributeTotal || Number(params.wishlist_spent || 0),
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

export async function GET(request: NextRequest) {
    const callerEmail = await getCallerEmail();
    if (!callerEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email')?.toLowerCase();
    const full = searchParams.get('full') === 'true';

    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

    const isAdmin = ADMIN_EMAILS.includes(callerEmail);
    const isSelf = callerEmail === email;

    if (!isAdmin && !isSelf) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        if (full) {
            const data = await buildFullProfile(email);
            return NextResponse.json(stripSensitive(data, isAdmin));
        }

        const { data, error } = await supabaseAdmin.from('profiles').select('*').ilike('member_id', email).maybeSingle();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json(stripSensitive(data, isAdmin));
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const callerEmail = await getCallerEmail();
    if (!callerEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { email: rawEmail, full, ...updates } = body;
    const email = rawEmail?.toLowerCase();

    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

    const isAdmin = ADMIN_EMAILS.includes(callerEmail);
    const isSelf = callerEmail === email;

    if (!isAdmin && !isSelf) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Update mode
    if (Object.keys(updates).length > 0) {
        if (!isAdmin && !isSelf) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .update(updates)
            .ilike('member_id', email)
            .select()
            .single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, profile: data });
    }

    // Lookup mode
    try {
        if (full === true) {
            const data = await buildFullProfile(email);
            return NextResponse.json(stripSensitive(data, isAdmin));
        }

        const { data, error } = await supabaseAdmin.from('profiles').select('*').ilike('member_id', email).maybeSingle();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json(stripSensitive(data, isAdmin));
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
