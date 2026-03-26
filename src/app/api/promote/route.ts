import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getHierarchyReport } from '@/lib/hierarchyRules';
import { DbService } from '@/lib/supabase-service';

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const memberEmail = body.memberEmail;
        if (!memberEmail) return NextResponse.json({ error: 'Missing memberEmail' }, { status: 400 });

        // Fetch profile — same as original route
        const { data: profile } = await supabaseAdmin
            .from('profiles').select('*').ilike('member_id', memberEmail).maybeSingle();
        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        const { data: taskData } = await supabaseAdmin
            .from('tasks').select('*').ilike('member_id', memberEmail).maybeSingle();

        const profileParams = profile.parameters || {};
        const rawPic = profile.avatar_url || profile.profile_picture_url || "";
        const memberPhoto = (rawPic && rawPic.length > 5) ? rawPic : null;

        let tributeTotal = 0;
        try {
            const arr = typeof taskData?.['Tribute History'] === 'string'
                ? JSON.parse(taskData['Tribute History']) : (taskData?.['Tribute History'] || []);
            tributeTotal = arr.reduce((s: number, e: any) => s + (e.amount < 0 ? Math.abs(e.amount) : 0), 0);
        } catch (_) {}

        const unifiedData = {
            ...profile, ...profileParams, ...(taskData || {}),
            title: profile.name || profileParams.title || "",
            image: memberPhoto || "/queen-karin.png",
            profilePicture: memberPhoto || "/queen-karin.png",
            taskdom_completed_tasks: Number(taskData?.['Taskdom_CompletedTasks'] || 0),
            total_coins_spent: tributeTotal || Number(profileParams.wishlist_spent || 0),
            kneelCount: Number(taskData?.kneelCount || profileParams.kneel_count || 0),
            score: Number(taskData?.Score ?? taskData?.score ?? profile.score ?? 0),
            bestRoutinestreak: Number(profile.bestRoutinestreak || profileParams.routine_streak || 0),
            routinestreak: Number(profile.routinestreak || profileParams.taskdom_current_streak || 0),
        };

        const report = getHierarchyReport(unifiedData);
        if (!report || report.isMax) {
            return NextResponse.json({ success: true, promoted: false, currentRank: report?.currentRank });
        }

        // Always promote — no canPromote gate
        const { error: updateError } = await supabaseAdmin
            .from('profiles').update({ hierarchy: report.nextRank }).eq('id', profile.id);
        if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

        const memberName = profile.name || memberEmail.split('@')[0] || 'SLAVE';
        const cardMsg = `PROMOTION_CARD::${JSON.stringify({
            name: memberName, photo: memberPhoto,
            oldRank: report.currentRank, newRank: report.nextRank
        })}`;
        try { await DbService.sendMessage(profile.member_id, cardMsg, 'system'); } catch (_) {}
        try {
            await supabaseAdmin.from('global_messages').insert({
                sender_email: 'system', sender_name: 'SYSTEM', sender_avatar: null, message: cardMsg,
            });
        } catch (_) {}

        return NextResponse.json({ success: true, promoted: true, newRank: report.nextRank });

    } catch (err: any) {
        console.error('[promote] error:', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
