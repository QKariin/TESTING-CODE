import { NextRequest, NextResponse } from 'next/server';
import { DbService } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const { memberEmail } = await req.json();

        if (!memberEmail) {
            return NextResponse.json({ success: false, error: 'Missing memberEmail' }, { status: 400 });
        }

        const profile = await DbService.getProfile(memberEmail);
        if (!profile || !profile.id) {
            return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
        }

        // Check wallet
        const wallet = profile.wallet || 0;
        if (wallet < 300) {
            return NextResponse.json({ success: false, error: 'Insufficient Capital. 300 coins required to skip duties.' }, { status: 403 });
        }

        // 1 & 2 & 3: Atomic Skip
        const params = { ...(profile.parameters || {}) };
        let skippedText = 'Mandatory Task';
        let skippedId = Date.now().toString();

        if (profile.parameters?.taskdom_active_task) {
            const activeTask = profile.parameters.taskdom_active_task;
            skippedText = activeTask.TaskText || activeTask.tasktext || 'Mandatory Task';
            skippedId = activeTask.id || skippedId;
            delete params.taskdom_active_task;
            delete params.taskdom_end_time;
        }

        const { supabaseAdmin } = require('@/lib/supabase');

        // Fire both DB updates in parallel
        const pUserProfile = supabaseAdmin.from('profiles').update({
            wallet: wallet - 300,
            parameters: params
        }).eq('id', profile.id);

        const pTaskHistory = (async () => {
            const { data: row } = await supabaseAdmin.from('tasks').select('Taskdom_History').eq('member_id', memberEmail).maybeSingle();
            let history: any[] = [];
            try { history = typeof row?.Taskdom_History === 'string' ? JSON.parse(row.Taskdom_History) : (row?.Taskdom_History || []); } catch { }

            history.unshift({
                id: skippedId,
                text: skippedText,
                proofUrl: 'SKIPPED',
                proofType: 'image',
                timestamp: new Date().toISOString(),
                status: 'fail',
                completed: false
            });

            if (row) {
                return supabaseAdmin.from('tasks').update({ Status: 'fail', 'Taskdom_History': JSON.stringify(history) }).eq('member_id', memberEmail);
            } else {
                return supabaseAdmin.from('tasks').insert({ member_id: memberEmail, Name: profile.name || 'Slave', Status: 'fail', 'Taskdom_History': JSON.stringify(history) });
            }
        })();

        await Promise.all([pUserProfile, pTaskHistory]);

        try { await DbService.sendMessage(profile.id, `TASK SKIPPED — 300 🪙 DEDUCTED`, 'system'); } catch (_) { }

        return NextResponse.json({
            success: true,
            newWallet: wallet - 300
        });
    } catch (error: any) {
        console.error("Failed to skip task:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
