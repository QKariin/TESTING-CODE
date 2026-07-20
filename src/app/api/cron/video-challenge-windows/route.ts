import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DbService } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

// Runs every 5 minutes — expires overdue video challenge windows and kicks users
export async function GET(req: Request) {
    const envSecret = (process.env.CRON_SECRET || '').trim();
    if (!envSecret) {
        console.error('[cron/video-windows] CRON_SECRET env var is not set — refusing to run');
        return NextResponse.json({ error: 'Cron secret not configured' }, { status: 500 });
    }
    const authHeader = req.headers.get('authorization') || '';
    const incoming = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
    if (incoming !== envSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const now = new Date().toISOString();

        // Find all active submissions (no proof submitted) where window has closed
        const { data: expired, error } = await supabaseAdmin
            .from('video_challenge_submissions')
            .select('id, challenge_id, member_id, task_position')
            .eq('status', 'active')
            .lt('window_closes_at', now);

        if (error) throw error;

        if (!expired || expired.length === 0) {
            return NextResponse.json({ success: true, expired: 0, kicked: 0 });
        }

        let kickedCount = 0;

        for (const sub of expired) {
            // Mark submission as expired
            await supabaseAdmin.from('video_challenge_submissions')
                .update({ status: 'expired' })
                .eq('id', sub.id);

            // Kick participant (only if still active)
            const { data: participant } = await supabaseAdmin
                .from('video_challenge_participants')
                .select('status')
                .eq('challenge_id', sub.challenge_id)
                .eq('member_id', sub.member_id)
                .maybeSingle();

            if (participant?.status === 'active') {
                await supabaseAdmin.from('video_challenge_participants')
                    .update({ status: 'kicked', kicked_at: now })
                    .eq('challenge_id', sub.challenge_id)
                    .eq('member_id', sub.member_id);

                kickedCount++;

                // Notify user via chat
                try {
                    const { data: profile } = await supabaseAdmin.from('profiles')
                        .select('ID').ilike('member_id', sub.member_id).maybeSingle();
                    if (profile) {
                        await DbService.sendMessage(
                            profile.ID,
                            `You missed the window for Video Challenge task ${sub.task_position}. You have been removed from the challenge. Use a Checkpoint or pay coins to rejoin.`,
                            'system'
                        );
                    }
                } catch (_) {}
            }
        }

        console.log(`[cron/video-challenge-windows] Expired: ${expired.length}, Kicked: ${kickedCount}`);
        return NextResponse.json({ success: true, expired: expired.length, kicked: kickedCount });
    } catch (err: any) {
        console.error('[cron/video-challenge-windows]', err.message);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
