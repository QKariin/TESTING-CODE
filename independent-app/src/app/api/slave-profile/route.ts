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

        // Extract parameters JSONB and compute hierarchy fields same as mapUserForDashboard
        const params = (profileData as any)?.parameters || {};
        let taskdomHistory: any[] = [];
        if (taskData && (taskData as any).Taskdom_History) {
            try {
                const raw = (taskData as any).Taskdom_History;
                taskdomHistory = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
            } catch (e) { taskdomHistory = []; }
        }
        const approvedTasks = taskdomHistory.filter((h: any) => h.status === 'approve' && !h.isRoutine).length;

        return NextResponse.json({
            ...profileData,
            ...(taskData || {}),
            _totalSpent: crowdfundTotal,
            // Explicit mappings required by getHierarchyReport
            kneelCount: Number((taskData as any)?.kneelCount || 0),
            taskdom_completed_tasks: approvedTasks || Number((taskData as any)?.Taskdom_CompletedTasks || params.taskdom_completed_tasks || 0),
            total_coins_spent: Number(params.total_coins_spent || (profileData as any)?.total_coins_spent || 0),
            // Identity/check fields
            image: (profileData as any)?.avatar_url || (profileData as any)?.profile_picture_url || '',
            title: (profileData as any)?.name || '',
            kinks: (profileData as any)?.kinks || '',
            limits: (profileData as any)?.limits || '',
            routineHistory: taskdomHistory,
            routinehistory: taskdomHistory,
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
