import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = "force-dynamic";

const COOLDOWN_MS = process.env.NODE_ENV === 'development' ? 60 * 1000 : 60 * 60 * 1000; // 1 min dev / 60 min prod

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const memberEmail = searchParams.get('email');
        const tz = searchParams.get('tz') || 'UTC';

        if (!memberEmail) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

        // Use supabaseAdmin to bypass RLS — anon client can't read tasks table
        const { data: taskRow } = await supabaseAdmin
            .from('tasks')
            .select('lastWorship, kneelCount, "today kneeling", kneel_history')
            .ilike('member_id', memberEmail)
            .maybeSingle();

        const now = Date.now();
        const lastWorshipMs = taskRow?.lastWorship
            ? new Date(taskRow.lastWorship).getTime()
            : 0;

        const diffMs = now - lastWorshipMs;
        const isLocked = lastWorshipMs > 0 && diffMs < COOLDOWN_MS;
        const minLeft = isLocked ? Math.ceil((COOLDOWN_MS - diffMs) / 60000) : 0;

        // Midnight reset: compare in user's local timezone
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: tz });
        const lastStr = lastWorshipMs > 0
            ? new Date(lastWorshipMs).toLocaleDateString('en-CA', { timeZone: tz })
            : null;
        const isSameDay = lastStr === todayStr;
        const todayKneeling = isSameDay
            ? parseInt(taskRow?.['today kneeling'] || '0', 10)
            : 0;

        // Parse kneel_history and extract which hours today had a kneel
        let kneelHours: number[] = [];
        try {
            const raw = (taskRow as any)?.kneel_history;
            const history: string[] = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : []);
            if (history.length) {
                const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: tz });
                kneelHours = [...new Set(
                    history
                        .filter(ts => { try { return new Date(ts).toLocaleDateString('en-CA', { timeZone: tz }) === todayStr; } catch { return false; } })
                        .map(ts => { try { return new Date(ts).getHours(); } catch { return -1; } })
                        .filter(h => h >= 0)
                )];
            }
        } catch (_) { }

        return NextResponse.json({
            lastWorshipMs,
            isLocked,
            minLeft,
            kneelCount: taskRow?.kneelCount || 0,
            todayKneeling,
            kneelHours,
        });
    } catch (err: any) {
        console.error('[kneel-status]', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
