import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
    try {
        const { memberId, memberName, explored, totalItems, durationSeconds } = await req.json();
        if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 });

        const mins = Math.floor(durationSeconds / 60);
        const secs = Math.round(durationSeconds % 60);
        const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

        const payload = {
            userName: memberName || 'Unknown',
            explored: explored || [],
            totalItems: totalItems || 0,
            durationSeconds: durationSeconds || 0,
            timeFormatted: timeStr,
        };

        await adminClient.from('chats').insert({
            member_id: memberId,
            sender_email: 'ceo@qkarin.com',
            content: `TOUR_REPORT::${JSON.stringify(payload)}`,
            type: 'chat',
            metadata: { isTourReport: true, isQueen: true },
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('[tour-report] Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
