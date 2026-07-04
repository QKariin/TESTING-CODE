export async function sendTaskPush(
    memberId: string,
    action: 'approve' | 'reject',
    points?: number,
    imageUrl?: string | null,
) {
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '761d91da-b098-44a7-8d98-75c1cce54dd0';
    const apiKey = process.env.ONESIGNAL_REST_API_KEY;
    if (!apiKey || !memberId) return;

    const email = memberId.toLowerCase();
    const heading = action === 'approve' ? 'Task Approved' : 'Task Rejected';
    const body = action === 'approve'
        ? `+${points || 0} merit earned.`
        : '-300 coins penalty.';

    const payload: any = {
        app_id: appId,
        target_channel: 'push',
        include_aliases: { external_id: [email] },
        headings: { en: heading },
        contents: { en: body },
        url: 'https://throne.qkarin.com/profile',
    };

    if (imageUrl) {
        payload.big_picture = imageUrl;
        payload.ios_attachments = { image: imageUrl };
        payload.chrome_web_image = imageUrl;
    }

    try {
        await fetch('https://api.onesignal.com/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${apiKey}` },
            body: JSON.stringify(payload),
        });
    } catch (_) {}
}
