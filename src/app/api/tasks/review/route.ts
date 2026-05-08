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
                const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '761d91da-b098-44a7-8d98-75c1cce54dd0';
                const apiKey = process.env.ONESIGNAL_REST_API_KEY;
                if (apiKey && email) {
                    await fetch('https://api.onesignal.com/notifications', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${apiKey}` },
                        body: JSON.stringify({
                            app_id: appId,
                            target_channel: 'push',
                            include_aliases: { external_id: [email] },
                            headings: { en: '✓ Task Approved' },
                            contents: { en: `Your task was approved! +${points} merit earned.` },
                            url: 'https://throne.qkarin.com/profile',
                        }),
                    });
                }
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
                const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '761d91da-b098-44a7-8d98-75c1cce54dd0';
                const apiKey = process.env.ONESIGNAL_REST_API_KEY;
                if (apiKey && email) {
                    await fetch('https://api.onesignal.com/notifications', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${apiKey}` },
                        body: JSON.stringify({
                            app_id: appId,
                            target_channel: 'push',
                            include_aliases: { external_id: [email] },
                            headings: { en: '✗ Task Rejected' },
                            contents: { en: 'Your task was rejected. -300 coins penalty.' },
                            url: 'https://throne.qkarin.com/profile',
                        }),
                    });
                }
            } catch (_) {}

            return NextResponse.json({ success: true, action: 'reject', penaltyApplied: 300 });
        }

        return NextResponse.json({ success: false, error: 'Invalid action. Use approve or reject.' }, { status: 400 });

    } catch (error: any) {
        console.error('Task Review Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
