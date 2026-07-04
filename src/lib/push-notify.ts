import { DbService } from '@/lib/supabase-service';

const APPROVE_LINES = [
    "I've acknowledged your effort. Don't disappoint me next time.",
    "Acceptable. Your obedience has been noted.",
    "Well done. You may have earned a moment of my attention.",
    "Your devotion pleases me. Keep this standard.",
    "Noted and rewarded. Now get back on your knees.",
    "I expect nothing less. But this was... satisfactory.",
    "You followed instructions. That deserves recognition.",
];

const REJECT_LINES = [
    "Pathetic. I expected more from you.",
    "This is what you call effort? Try again.",
    "Unacceptable. You've wasted my time.",
    "Did you even try? I'm not impressed.",
    "Disappointing. You know the price of failure.",
    "I gave you a chance and you squandered it.",
    "Below my standards. You will do better.",
];

function pickRandom(arr: string[]) { return arr[Math.floor(Math.random() * arr.length)]; }

export async function sendTaskPush(
    memberId: string,
    action: 'approve' | 'reject',
    points?: number,
    imageUrl?: string | null,
) {
    try {
        const profile = await DbService.getProfile(memberId);
        const email = (profile?.member_id || memberId).toLowerCase();
        const name = profile?.name || null;
        const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '761d91da-b098-44a7-8d98-75c1cce54dd0';
        const apiKey = process.env.ONESIGNAL_REST_API_KEY;
        if (!apiKey || !email) return;

        const heading = 'Queen Karin';
        const flavorText = action === 'approve' ? pickRandom(APPROVE_LINES) : pickRandom(REJECT_LINES);
        const pointsSuffix = action === 'approve'
            ? ` +${points || 0} merit.`
            : ' -300 coins.';
        const body = flavorText + pointsSuffix;

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

        fetch('https://api.onesignal.com/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${apiKey}` },
            body: JSON.stringify(payload),
        }).catch(() => {});
    } catch (_) {}
}
