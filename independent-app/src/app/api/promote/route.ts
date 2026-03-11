import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getHierarchyReport } from '@/lib/hierarchyRules';
import { DbService } from '@/lib/supabase-service';

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        const { memberEmail } = await req.json();
        if (!memberEmail) return NextResponse.json({ error: 'Missing memberEmail' }, { status: 400 });

        // 1. Fetch Profile
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('member_id', memberEmail)
            .maybeSingle();

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        // 2. Fetch Tasks
        const { data: taskData } = await supabaseAdmin
            .from('tasks')
            .select('*')
            .ilike('member_id', memberEmail)
            .maybeSingle();

        // 3. Merge + normalize field names to match getHierarchyReport expectations
        //    (mirrors the mapping done in /api/slave-profile/route.ts lines 103-122)
        const profileParams = profile.parameters || {};

        const defaultPic = "https://static.wixstatic.com/media/ce3e5b_78da97e06a3848df84d0b00c9e6dcfdd~mv2.png";
        const rawPic = profile.avatar_url || profile.profile_picture_url || "";
        const finalPic = (rawPic && rawPic.length > 5) ? rawPic : defaultPic;

        let tributeTotal = 0;
        try {
            const rawTributes = taskData?.['Tribute History'];
            const arr: any[] = typeof rawTributes === 'string' ? JSON.parse(rawTributes) : (Array.isArray(rawTributes) ? rawTributes : []);
            tributeTotal = arr.reduce((s: number, e: any) => s + (e.amount < 0 ? Math.abs(e.amount) : 0), 0);
        } catch (_) {}

        const unifiedData = {
            ...profile,
            ...profileParams,
            ...(taskData || {}),
            // identity — getHierarchyReport looks for title / image / profilePicture
            title:          profile.name || profileParams.title || "",
            image:          finalPic,
            profilePicture: finalPic,
            // stats — normalize column name variants
            taskdom_completed_tasks: Number(taskData?.['Taskdom_CompletedTasks'] || profileParams.taskdom_completed_tasks || 0),
            total_coins_spent:       tributeTotal || Number(profile.total_coins_spent || profileParams.total_coins_spent || 0),
            kneelCount:              Number(taskData?.kneelCount || profile.kneelCount || profileParams.kneel_count || 0),
            score:                   Number(taskData?.Score ?? taskData?.score ?? profile.score ?? 0),
            bestRoutinestreak:       Number(profile.bestRoutinestreak || profileParams.routine_streak || profileParams.bestRoutinestreak || 0),
            routinestreak:           Number(profile.routinestreak || profileParams.taskdom_current_streak || 0),
        };

        // 4. Run Hierarchy Report securely on the backend
        const report = getHierarchyReport(unifiedData);

        if (!report) return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });

        if (report.canPromote && report.nextRank && report.nextRank !== report.currentRank) {
            // PROMOTION TIME!
            const { error: updateError } = await supabaseAdmin
                .from('profiles')
                .update({ hierarchy: report.nextRank })
                .eq('member_id', memberEmail);

            if (updateError) {
                console.error('[promote] Update error:', updateError);
                return NextResponse.json({ error: 'Failed to update database' }, { status: 500 });
            }

            try { await DbService.sendMessage(memberEmail, `RANK PROMOTED: ${report.nextRank.toUpperCase()}`, 'system'); } catch (_) { }

            return NextResponse.json({
                success: true,
                promoted: true,
                newRank: report.nextRank
            });
        }

        return NextResponse.json({
            success: true,
            promoted: false,
            currentRank: report.currentRank
        });

    } catch (err: any) {
        console.error('[promote] Unexpected error:', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
