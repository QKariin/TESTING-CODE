// src/app/api/profile-action/route.ts
import { NextResponse } from 'next/server';
import { DbService } from '@/lib/supabase-service';
import { cacheDelete } from '@/lib/api-cache';

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        const { type, memberId, payload } = await req.json();

        if (!memberId) throw new Error("Missing Member ID");

        let result: any = null;

        switch (type) {
            case 'REVEAL_FRAGMENT':
                result = await DbService.revealFragment(memberId);
                await DbService.sendMessage(memberId, `Slave revealed fragment #${result.pick} of Day ${result.progress}.`, 'system');
                break;

            case 'CLAIM_KNEEL_REWARD':
                result = await DbService.claimKneel(memberId, payload.amount, payload.type);
                await DbService.sendMessage(memberId, `Slave earned ${payload.amount} ${payload.type} for kneeling.`, 'system');
                break;

            case 'TRANSACTION':
                result = await DbService.processTransaction(memberId, payload.amount, payload.category);
                break;

            case 'UPDATE_PROFILE':
                result = await DbService.updateProfile(memberId, payload);
                break;

            case 'MESSAGE':
                result = await DbService.sendMessage(memberId, payload.text, payload.sender || 'slave', payload.mediaUrl);
                break;

            case 'SUBMIT_TASK':
                // Enforce routine window (6-10 AM local time)
                if (payload.isRoutine) {
                    const routineTz = payload.tz || 'UTC';
                    const localHour = parseInt(
                        new Intl.DateTimeFormat('en', { timeZone: routineTz, hour: '2-digit', hour12: false }).format(new Date()),
                        10
                    );
                    if (localHour < 6 || localHour >= 10) {
                        return NextResponse.json({ error: 'Routine upload window is 6:00 - 10:00 AM', success: false }, { status: 400 });
                    }
                }
                result = await DbService.submitTask(memberId, payload.proofUrl, payload.proofType, payload.taskText, payload.isRoutine, payload.thumbnailUrl, payload.tz || 'UTC');
                // Bust routine cache so next poll gets fresh uploadedToday status
                if (payload.isRoutine) cacheDelete(`routine:`);

                // Push notification to admin
                try {
                    const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '761d91da-b098-44a7-8d98-75c1cce54dd0';
                    const ONESIGNAL_KEY = process.env.ONESIGNAL_REST_API_KEY;
                    if (ONESIGNAL_KEY) {
                        const profile = await DbService.getProfile(memberId);
                        const name = profile?.name || 'A subject';
                        const label = payload.isRoutine ? 'Daily Routine' : 'Task';
                        fetch('https://api.onesignal.com/notifications', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${ONESIGNAL_KEY}` },
                            body: JSON.stringify({
                                app_id: ONESIGNAL_APP_ID,
                                target_channel: 'push',
                                include_aliases: { external_id: ['ceo@qkarin.com'] },
                                headings: { en: `${label} Submitted` },
                                subtitle: { en: 'Throne' },
                                contents: { en: `${name} submitted ${payload.isRoutine ? 'their daily routine' : 'task evidence'}` },
                                url: 'https://throne.qkarin.com/dashboard',
                            }),
                        }).catch(() => {});
                    }
                } catch (_) {}
                break;

            default:
                throw new Error("Invalid Action Type");
        }

        return NextResponse.json({ success: true, result });
    } catch (error: any) {
        console.error("Profile Action Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
