import { NextRequest, NextResponse } from 'next/server';
import { DbService } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const { memberId, useSkipPass } = await req.json();

        if (!memberId) {
            return NextResponse.json({ success: false, error: 'Missing memberId' }, { status: 400 });
        }

        // Look up profile by UUID (profiles.id = UUID)
        const { supabaseAdmin } = require('@/lib/supabase');
        const { data: profileData } = await supabaseAdmin.from('profiles').select('*').eq('ID', memberId).maybeSingle();
        const profile = profileData;
        if (!profile || !profile.ID) {
            return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
        }

        const wallet = profile.wallet || 0;

        // Skip pass: consume pass instead of coins
        if (useSkipPass) {
            const skipCount = Number(profile.skippass || 0);
            if (skipCount <= 0) {
                return NextResponse.json({ success: false, error: 'No skip passes available' }, { status: 400 });
            }
            // Decrement skip pass
            await supabaseAdmin.from('profiles').update({ skippass: skipCount - 1 }).eq('ID', profile.ID);
        } else {
            // Check wallet for coin penalty
            if (wallet < 300) {
                return NextResponse.json({ success: false, error: 'Insufficient Capital. 300 coins required to skip duties.' }, { status: 403 });
            }
        }

        const { data: row } = await supabaseAdmin.from('tasks').select('Taskdom_History, taskdom_active_task').eq('ID', memberId).maybeSingle();

        // 1 & 2 & 3: Atomic Skip
        const params = { ...(profile.parameters || {}) };

        // Cleanup old profile params if they exist
        if (params.taskdom_active_task) {
            delete params.taskdom_active_task;
            delete params.taskdom_end_time;
        }

        let skippedText = 'Mandatory Task';
        let skippedId = Date.now().toString();

        if (row && row.taskdom_active_task) {
            try {
                const activeTask = typeof row.taskdom_active_task === 'string' ? JSON.parse(row.taskdom_active_task) : row.taskdom_active_task;
                skippedText = activeTask.TaskText || activeTask.tasktext || activeTask.text || 'Mandatory Task';
                skippedId = activeTask.id || skippedId;
            } catch (e) { }
        }

        const profileUpdate: any = { parameters: params };
        if (!useSkipPass) profileUpdate.wallet = wallet - 300;
        const profileDbUpdate = await supabaseAdmin.from('profiles').update(profileUpdate).eq('ID', profile.ID);

        let taskDbUpdate;
        let history: any[] = [];
        try { history = typeof row?.Taskdom_History === 'string' ? JSON.parse(row.Taskdom_History) : (row?.Taskdom_History || []); } catch { }

        history.unshift({
            id: skippedId,
            text: skippedText,
            proofUrl: useSkipPass ? 'SKIP_PASS' : 'SKIPPED',
            proofType: 'image',
            timestamp: new Date().toISOString(),
            status: useSkipPass ? 'skip_pass' : 'fail',
            completed: false
        });

        if (row) {
            taskDbUpdate = await supabaseAdmin.from('tasks').update({
                Status: 'fail',
                'Taskdom_History': JSON.stringify(history),
                taskdom_active_task: null,
                taskdom_pending_state: null
            }).eq('ID', memberId);
        } else {
            taskDbUpdate = await supabaseAdmin.from('tasks').insert({
                ID: memberId,
                member_id: profile.member_id || '',
                Name: profile.name || 'Slave',
                Status: 'fail',
                'Taskdom_History': JSON.stringify(history),
                taskdom_active_task: null,
                taskdom_pending_state: null
            });
        }

        console.log("Profile update:", profileDbUpdate.error ? profileDbUpdate.error : "SUCCESS");
        console.log("Task update:", taskDbUpdate.error ? taskDbUpdate.error : "SUCCESS");

        const sysMsg = useSkipPass
            ? `TASK SKIPPED - SKIP PASS USED`
            : `TASK SKIPPED - 300 <i class="fas fa-coins" style="color:#c5a059;"></i> DEDUCTED`;
        try { await DbService.sendMessage(memberId, sysMsg, 'system'); } catch (_) { }

        return NextResponse.json({
            success: true,
            newWallet: useSkipPass ? wallet : wallet - 300,
            usedSkipPass: !!useSkipPass,
        });
    } catch (error: any) {
        console.error("Failed to skip task:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
