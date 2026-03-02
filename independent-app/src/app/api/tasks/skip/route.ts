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

        // 1. Deduct 300 coins
        await DbService.processTransaction(memberEmail, -300, 'Skip Task Fee');

        // 2. Add to Taskdom_History as Failed/Skipped
        if (profile.parameters?.taskdom_active_task) {
            const activeTask = profile.parameters.taskdom_active_task;
            await DbService.submitTask(memberEmail, 'SKIPPED', 'image', activeTask.TaskText || activeTask.tasktext || 'Mandatory Task');

            // The submitTask marks it as 'pending', so we need to immediately mark it as 'fail'
            const row = await (DbService as any)._getTaskRow(memberEmail);
            const history = (DbService as any)._parseHistory(row);
            if (history.length > 0) {
                history[0].status = 'fail';
                history[0].id = activeTask.id || Date.now().toString(); // Use actual task ID if available
                await DbService.updateProfile(profile.id, { parameters: profile.parameters }); // Just dummy save, actual save below

                // Real save to tasks table
                const { supabaseAdmin } = require('@/lib/supabase');
                await supabaseAdmin.from('tasks').update({
                    Status: 'fail',
                    'Taskdom_History': JSON.stringify(history)
                }).eq('member_id', memberEmail);
            }
        }

        // 3. Clear active task
        await DbService.clearTask(memberEmail);

        return NextResponse.json({
            success: true,
            newWallet: wallet - 300
        });
    } catch (error: any) {
        console.error("Failed to skip task:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
