import { DbService } from '@/lib/supabase-service';

export async function sendTaskPush(memberId: string, action: 'approve' | 'reject', points?: number) {
    try {
        const profile = await DbService.getProfile(memberId);
        const email = (profile?.member_id || memberId).toLowerCase();
        const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '761d91da-b098-44a7-8d98-75c1cce54dd0';
        const apiKey = process.env.ONESIGNAL_REST_API_KEY;
        if (!apiKey || !email) return;
        const heading = action === 'approve' ? 'Task Approved' : 'Task Rejected';
        const body = action === 'approve'
            ? `Your task was approved! +${points || 0} merit earned.`
            : 'Your task was rejected. -300 coins penalty.';
        fetch('https://api.onesignal.com/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${apiKey}` },
            body: JSON.stringify({
                app_id: appId,
                target_channel: 'push',
                include_aliases: { external_id: [email] },
                headings: { en: heading },
                contents: { en: body },
                url: 'https://throne.qkarin.com/profile',
            }),
        }).catch(() => {});
    } catch (_) {}
}
