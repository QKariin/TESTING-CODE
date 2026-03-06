import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = "force-dynamic";

const COOLDOWN_MS = 60 * 60 * 1000; // 60 minutes

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const memberEmail = searchParams.get('email');

        if (!memberEmail) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

        // Use supabaseAdmin to bypass RLS — anon client can't read tasks table
        const { data: taskRow } = await supabaseAdmin
            .from('tasks')
            .select('lastWorship, kneelCount, "today kneeling"')
            .ilike('member_id', memberEmail)
            .maybeSingle();

        const now = Date.now();
        const lastWorshipMs = taskRow?.lastWorship
            ? new Date(taskRow.lastWorship).getTime()
            : 0;

        const diffMs = now - lastWorshipMs;
        const isLocked = lastWorshipMs > 0 && diffMs < COOLDOWN_MS;
        const minLeft = isLocked ? Math.ceil((COOLDOWN_MS - diffMs) / 60000) : 0;

        return NextResponse.json({
            lastWorshipMs,
            isLocked,
            minLeft,
            kneelCount: taskRow?.kneelCount || 0,
        });
    } catch (err: any) {
        console.error('[kneel-status]', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
