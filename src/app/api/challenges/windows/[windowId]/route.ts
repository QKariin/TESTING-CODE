import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function PATCH(request: Request, { params }: { params: Promise<{ windowId: string }> }) {
    try {
        const { windowId } = await params;
        const body = await request.json();

        let challengeId: string | null = null;
        let challengeName = '';
        let taskLabel = '';

        if (body.push_now) {
            // Fetch the window + challenge info
            const { data: win, error: wErr } = await supabaseAdmin
                .from('challenge_windows')
                .select('challenge_id, day_number, window_number, challenges(window_minutes, name, tasks_per_day, task_names)')
                .eq('id', windowId)
                .single();
            if (wErr || !win) return NextResponse.json({ success: false, error: 'Window not found' }, { status: 404 });

            const ch = (win as any).challenges;
            const minutes: number = ch?.window_minutes ?? 30;
            const now = new Date();
            const closes = new Date(now.getTime() + minutes * 60 * 1000);
            delete body.push_now;
            body.opens_at = now.toISOString();
            body.closes_at = closes.toISOString();

            // Prepare notification info
            challengeId = (win as any).challenge_id;
            challengeName = ch?.name || 'Challenge';
            const tpd = ch?.tasks_per_day || 1;
            const idx = ((win as any).day_number - 1) * tpd + ((win as any).window_number - 1);
            const taskNameFromArr = (ch?.task_names || [])[idx];
            taskLabel = taskNameFromArr || `Day ${(win as any).day_number} · Task ${(win as any).window_number}`;
        }

        const { data, error } = await supabaseAdmin
            .from('challenge_windows')
            .update(body)
            .eq('id', windowId)
            .select()
            .single();

        if (error) throw error;

        // Send push notifications to all active participants
        if (challengeId) {
            notifyParticipants(challengeId, challengeName, taskLabel).catch(() => {});
        }

        return NextResponse.json({ success: true, window: data });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

async function notifyParticipants(challengeId: string, challengeName: string, taskLabel: string) {
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '761d91da-b098-44a7-8d98-75c1cce54dd0';
    const apiKey = process.env.ONESIGNAL_REST_API_KEY;
    if (!apiKey) return;

    // Get all active participant emails
    const { data: participants } = await supabaseAdmin
        .from('challenge_participants')
        .select('member_id')
        .eq('challenge_id', challengeId)
        .eq('status', 'active');

    if (!participants?.length) return;

    const emails = participants.map((p: any) => p.member_id.toLowerCase());

    await fetch('https://api.onesignal.com/notifications', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${apiKey}`,
        },
        body: JSON.stringify({
            app_id: appId,
            target_channel: 'push',
            include_aliases: { external_id: emails },
            headings: { en: `⚔ CHALLENGE LIVE!` },
            contents: { en: `${challengeName}: ${taskLabel} — Submit now!` },
            url: 'https://throne.qkarin.com/profile',
        }),
    });
}
