import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getHierarchyReport } from '@/lib/hierarchyRules';
import { DbService } from '@/lib/supabase-service';

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        const { memberEmail } = await req.json();
        if (!memberEmail) return NextResponse.json({ error: 'Missing memberEmail' }, { status: 400 });

        // 1. Fetch Profile — EXACT original query
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('member_id', memberEmail)
            .maybeSingle();

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        // 2. Fetch Tasks — EXACT original query
        const { data: taskData } = await supabaseAdmin
            .from('tasks')
            .select('*')
            .ilike('member_id', memberEmail)
            .maybeSingle();

        // 3. Merge data — EXACT original mapping
        const profileParams = profile.parameters || {};
        const rawPic = profile.avatar_url || profile.profile_picture_url || "";
        const finalPic = (rawPic && rawPic.length > 5) ? rawPic : "/queen-karin.png";

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
            title:                   profile.name || profileParams.title || "",
            image:                   finalPic,
            profilePicture:          finalPic,
            taskdom_completed_tasks: Number(taskData?.['Taskdom_CompletedTasks'] || 0),
            total_coins_spent:       tributeTotal || Number(profileParams.wishlist_spent || 0),
            kneelCount:              Number(taskData?.kneelCount || profile.kneelCount || profileParams.kneel_count || 0),
            score:                   Number(taskData?.Score ?? taskData?.score ?? profile.score ?? 0),
            bestRoutinestreak:       Number(profile.bestRoutinestreak || profileParams.routine_streak || profileParams.bestRoutinestreak || 0),
            routinestreak:           Number(profile.routinestreak || profileParams.taskdom_current_streak || 0),
        };

        // 4. Run Hierarchy Report
        const report = getHierarchyReport(unifiedData);
        if (!report) return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });

        if (report.isMax || !report.nextRank || report.nextRank === report.currentRank) {
            return NextResponse.json({ success: true, promoted: false, currentRank: report.currentRank });
        }

        // 5. PROMOTE — no canPromote gate, always apply
        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({ hierarchy: report.nextRank })
            .eq('member_id', memberEmail);  // EXACT original update query

        if (updateError) {
            console.error('[promote] Update error:', updateError);
            return NextResponse.json({ error: 'Failed to update database' }, { status: 500 });
        }

        // 6. Send promotion card to private + global chat
        const memberName = profile.name || memberEmail.split('@')[0] || 'SLAVE';
        const memberPhoto = (rawPic && rawPic.length > 5) ? rawPic : null;
        const cardMsg = `PROMOTION_CARD::${JSON.stringify({
            name: memberName, photo: memberPhoto,
            oldRank: report.currentRank, newRank: report.nextRank
        })}`;
        try { await DbService.sendMessage(memberEmail, cardMsg, 'system'); } catch (_) {}
        try {
            await supabaseAdmin.from('global_messages').insert({
                sender_email: 'system', sender_name: 'SYSTEM', sender_avatar: null, message: cardMsg,
            });
        } catch (_) {}

        return NextResponse.json({ success: true, promoted: true, newRank: report.nextRank });

    } catch (err: any) {
        console.error('[promote] Unexpected error:', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
