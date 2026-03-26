import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getHierarchyReport } from '@/lib/hierarchyRules';
import { DbService } from '@/lib/supabase-service';

export const dynamic = "force-dynamic";

const RANK_ORDER = ["Queen's Champion", "Secretary", "Chamberlain", "Butler", "Silverman", "Footman", "Hall Boy"];
const cleanRank = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export async function POST(req: Request) {
    try {
        const { memberEmail, adminForce } = await req.json();
        if (!memberEmail) return NextResponse.json({ error: 'Missing memberEmail' }, { status: 400 });

        // 1. Fetch Profile (case-insensitive)
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .ilike('member_id', memberEmail)
            .maybeSingle();

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        const rawPic = profile.avatar_url || profile.profile_picture_url || "";
        const memberPhoto = (rawPic && rawPic.length > 5) ? rawPic : null;
        const memberName = profile.name || memberEmail.split('@')[0] || 'SLAVE';

        // 2. ADMIN FORCE PATH — skip requirements check, directly promote one rank
        if (adminForce) {
            const currentHierarchy = profile.hierarchy || "Hall Boy";
            const currentIdx = RANK_ORDER.findIndex(r => cleanRank(r) === cleanRank(currentHierarchy));
            const nextIdx = currentIdx - 1;

            if (currentIdx <= 0 || nextIdx < 0) {
                return NextResponse.json({ promoted: false, currentRank: currentHierarchy, message: 'Already at max rank' });
            }

            const nextRank = RANK_ORDER[nextIdx];

            const { error: updateError } = await supabaseAdmin
                .from('profiles')
                .update({ hierarchy: nextRank })
                .ilike('member_id', memberEmail);

            if (updateError) {
                console.error('[promote] Update error:', updateError);
                return NextResponse.json({ error: 'Failed to update database' }, { status: 500 });
            }

            const cardMsg = `PROMOTION_CARD::${JSON.stringify({ name: memberName, photo: memberPhoto, oldRank: currentHierarchy, newRank: nextRank })}`;
            try { await DbService.sendMessage(profile.member_id, cardMsg, 'system'); } catch (_) { }
            try {
                await supabaseAdmin.from('global_messages').insert({
                    sender_email: 'system', sender_name: 'SYSTEM', sender_avatar: null, message: cardMsg,
                });
            } catch (_) { }

            return NextResponse.json({ success: true, promoted: true, newRank: nextRank });
        }

        // 3. NORMAL PATH — run requirements check
        const { data: taskData } = await supabaseAdmin
            .from('tasks').select('*').ilike('member_id', memberEmail).maybeSingle();

        const profileParams = profile.parameters || {};
        let tributeTotal = 0;
        try {
            const rawTributes = taskData?.['Tribute History'];
            const arr: any[] = typeof rawTributes === 'string' ? JSON.parse(rawTributes) : (Array.isArray(rawTributes) ? rawTributes : []);
            tributeTotal = arr.reduce((s: number, e: any) => s + (e.amount < 0 ? Math.abs(e.amount) : 0), 0);
        } catch (_) {}

        const unifiedData = {
            ...profile, ...profileParams, ...(taskData || {}),
            title: profile.name || profileParams.title || "",
            image: memberPhoto || "/queen-karin.png",
            profilePicture: memberPhoto || "/queen-karin.png",
            taskdom_completed_tasks: Number(taskData?.['Taskdom_CompletedTasks'] || 0),
            total_coins_spent: tributeTotal || Number(profileParams.wishlist_spent || 0),
            kneelCount: Number(taskData?.kneelCount || profile.kneelCount || profileParams.kneel_count || 0),
            score: Number(taskData?.Score ?? taskData?.score ?? profile.score ?? 0),
            bestRoutinestreak: Number(profile.bestRoutinestreak || profileParams.routine_streak || profileParams.bestRoutinestreak || 0),
            routinestreak: Number(profile.routinestreak || profileParams.taskdom_current_streak || 0),
        };

        const report = getHierarchyReport(unifiedData);
        if (!report) return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });

        if (report.canPromote && report.nextRank && report.nextRank !== report.currentRank) {
            const { error: updateError } = await supabaseAdmin
                .from('profiles').update({ hierarchy: report.nextRank }).ilike('member_id', memberEmail);

            if (updateError) return NextResponse.json({ error: 'Failed to update database' }, { status: 500 });

            const cardMsg = `PROMOTION_CARD::${JSON.stringify({ name: memberName, photo: memberPhoto, oldRank: report.currentRank, newRank: report.nextRank })}`;
            try { await DbService.sendMessage(profile.member_id, cardMsg, 'system'); } catch (_) { }
            try {
                await supabaseAdmin.from('global_messages').insert({
                    sender_email: 'system', sender_name: 'SYSTEM', sender_avatar: null, message: cardMsg,
                });
            } catch (_) { }

            return NextResponse.json({ success: true, promoted: true, newRank: report.nextRank });
        }

        return NextResponse.json({ success: true, promoted: false, currentRank: report.currentRank });

    } catch (err: any) {
        console.error('[promote] Unexpected error:', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
