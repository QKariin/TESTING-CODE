// src/app/api/profile-action/route.ts
import { NextResponse } from 'next/server';
import { DbService } from '@/lib/supabase-service';
import { supabaseAdmin } from '@/lib/supabase';
import { cacheDelete } from '@/lib/api-cache';
import { discordRoutineSubmitted } from '@/lib/discord';

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
                // Enforce routine window (6-10 AM local time) + once-per-day
                if (payload.isRoutine) {
                    const routineTz = payload.tz || 'UTC';
                    const localHour = parseInt(
                        new Intl.DateTimeFormat('en', { timeZone: routineTz, hour: '2-digit', hour12: false }).format(new Date()),
                        10
                    );
                    if (localHour < 6 || localHour >= 10) {
                        return NextResponse.json({ error: 'Routine upload window is 6:00 - 10:00 AM', success: false }, { status: 400 });
                    }

                    // Block duplicate routine submission for today
                    // memberId can be UUID or email — resolve to email for user_routines lookup
                    const isUuid0 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);
                    let routineEmail = memberId.toLowerCase();
                    if (isUuid0) {
                        const { data: p0 } = await supabaseAdmin.from('profiles').select('member_id').eq('ID', memberId).maybeSingle();
                        if (p0?.member_id) routineEmail = p0.member_id.toLowerCase();
                    }
                    const { data: existingRoutine } = await supabaseAdmin
                        .from('user_routines')
                        .select('pending_submitted_at, history')
                        .eq('member_id', routineEmail)
                        .maybeSingle();
                    if (existingRoutine) {
                        // Compare using BOTH UTC date and sub's local date to catch all cases
                        const now0 = new Date();
                        const todayLocal = now0.toLocaleDateString('en-CA', { timeZone: routineTz });
                        const todayUTC = now0.toISOString().split('T')[0];
                        // Check pending submission (still waiting for approval)
                        if (existingRoutine.pending_submitted_at) {
                            const pendingLocal = new Date(existingRoutine.pending_submitted_at).toLocaleDateString('en-CA', { timeZone: routineTz });
                            const pendingUTC = new Date(existingRoutine.pending_submitted_at).toISOString().split('T')[0];
                            if (pendingLocal === todayLocal || pendingUTC === todayUTC) {
                                return NextResponse.json({ error: 'Routine already submitted today', success: false }, { status: 400 });
                            }
                        }
                        // Check ALL history entries for today (approved, rejected, or any status)
                        if (existingRoutine.history && Array.isArray(existingRoutine.history)) {
                            for (const entry of existingRoutine.history) {
                                try {
                                    // entry.date is stored in UTC, submitted_at is ISO string
                                    const entryDateUTC = entry.date || new Date(entry.submitted_at).toISOString().split('T')[0];
                                    const entryDateLocal = new Date(entry.submitted_at).toLocaleDateString('en-CA', { timeZone: routineTz });
                                    if (entryDateUTC === todayUTC || entryDateLocal === todayLocal) {
                                        return NextResponse.json({ error: 'Routine already submitted today', success: false }, { status: 400 });
                                    }
                                } catch {}
                            }
                        }
                    }
                }
                result = await DbService.submitTask(memberId, payload.proofUrl, payload.proofType, payload.taskText, payload.isRoutine, payload.thumbnailUrl, payload.tz || 'UTC');
                // Bust routine cache so next poll gets fresh uploadedToday status
                if (payload.isRoutine) cacheDelete(`routine:`);

                // Push notification to admin + Discord
                try {
                    const profile = await DbService.getProfile(memberId);
                    const name = profile?.name || 'A subject';
                    const label = payload.isRoutine ? 'Daily Routine' : 'Task';

                    const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '761d91da-b098-44a7-8d98-75c1cce54dd0';
                    const ONESIGNAL_KEY = process.env.ONESIGNAL_REST_API_KEY;
                    if (ONESIGNAL_KEY) {
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

                    if (payload.isRoutine) discordRoutineSubmitted(name).catch(() => {});
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
