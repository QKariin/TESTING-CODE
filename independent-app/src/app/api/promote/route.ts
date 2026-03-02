import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getHierarchyReport } from '@/scripts/hierarchy-rules';
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

        // 3. Merge for logic check (simulating exactly what the frontend does)
        const profileParams = profile.parameters || {};
        const unifiedData = {
            ...profile,
            ...profileParams,
            ...(taskData || {})
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
