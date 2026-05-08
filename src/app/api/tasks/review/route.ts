// src/app/api/tasks/review/route.ts
import { NextResponse } from 'next/server';
import { DbService } from '@/lib/supabase-service';
import { getCaller, isCEO } from '@/lib/api-auth';
import { discordTaskReviewed } from '@/lib/discord';

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!isCEO(caller.email)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    try {
        const { submissionId, memberId, action, bonus } = await req.json();

        if (!submissionId || !memberId || !action) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        if (action === 'approve') {
            const points = typeof bonus === 'number' ? bonus : 500;
            await DbService.approveTask(submissionId, memberId, points, null, null);
            const profile = await DbService.getProfile(memberId);
            const name = profile?.name || 'A subject';
            discordTaskReviewed(name, 'approve', points).catch(() => {});

            // Push notification to the member
            try {
                const email = (profile?.member_id || memberId).toLowerCase();
                const pushUrl = new URL('/api/push', req.url);
                fetch(pushUrl.toString(), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        externalId: email,
                        title: '✓ Task Approved',
                        message: `Your task was approved! +${points} merit earned.`,
                    }),
                }).catch(() => {});
            } catch (_) {}

            return NextResponse.json({ success: true, action: 'approve', pointsAwarded: points });
        }

        if (action === 'reject') {
            await DbService.rejectTask(submissionId, memberId);
            const profile = await DbService.getProfile(memberId);
            const name = profile?.name || 'A subject';
            discordTaskReviewed(name, 'reject').catch(() => {});

            // Push notification to the member
            try {
                const email = (profile?.member_id || memberId).toLowerCase();
                const pushUrl = new URL('/api/push', req.url);
                fetch(pushUrl.toString(), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        externalId: email,
                        title: '✗ Task Rejected',
                        message: 'Your task was rejected. -300 coins penalty.',
                    }),
                }).catch(() => {});
            } catch (_) {}

            return NextResponse.json({ success: true, action: 'reject', penaltyApplied: 300 });
        }

        return NextResponse.json({ success: false, error: 'Invalid action. Use approve or reject.' }, { status: 400 });

    } catch (error: any) {
        console.error('Task Review Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
