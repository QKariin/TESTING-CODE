// src/app/api/kneel/route.ts
// Handles kneeling submission - updates tasks table (lastWorship, kneelCount, "today kneeling")
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DbService } from '@/lib/supabase-service';

export const dynamic = "force-dynamic";

const COOLDOWN_MS = process.env.NODE_ENV === 'development' ? 60 * 1000 : 60 * 60 * 1000; // 1 min dev / 60 min prod

export async function POST(req: Request) {
    try {
        const { memberEmail, tz = 'UTC' } = await req.json();
        if (!memberEmail) return NextResponse.json({ error: 'Missing memberEmail' }, { status: 400 });

        // Fetch current record from tasks table (member_id = email, case-insensitive)
        const { data: task } = await supabaseAdmin
            .from('tasks')
            .select('lastWorship, kneelCount, "today kneeling"')
            .ilike('member_id', memberEmail)
            .maybeSingle();

        const now = new Date();
        const nowMs = now.getTime();

        // Cooldown check
        if (task?.lastWorship) {
            const lastMs = new Date(task.lastWorship).getTime();
            if (nowMs - lastMs < COOLDOWN_MS) {
                const minLeft = Math.ceil((COOLDOWN_MS - (nowMs - lastMs)) / 60000);
                return NextResponse.json({ error: 'COOLDOWN', minLeft }, { status: 429 });
            }
        }

        // Calculate today kneeling (reset at midnight in user's local timezone)
        const todayStr = now.toLocaleDateString('en-CA', { timeZone: tz });
        const lastWorshipStr = task?.lastWorship
            ? new Date(task.lastWorship).toLocaleDateString('en-CA', { timeZone: tz })
            : null;

        const isSameDay = lastWorshipStr === todayStr;
        const prevToday = parseInt(task?.['today kneeling'] || '0', 10);
        const newTodayKneeling = isSameDay ? prevToday + 1 : 1;
        const newKneelCount = parseInt(task?.kneelCount || '0', 10) + 1;

        const { error } = await supabaseAdmin
            .from('tasks')
            .upsert({
                member_id: memberEmail, // Keep this here since upsert might create a new row
                lastWorship: now.toISOString(),
                kneelCount: String(newKneelCount),
                'today kneeling': String(newTodayKneeling),
            }, { onConflict: 'member_id' });

        if (error) {
            console.error('[kneel] update error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        try { await DbService.sendMessage(memberEmail, 'KNEELING SESSION COMPLETED', 'system'); } catch (_) { }

        return NextResponse.json({
            success: true,
            kneelCount: newKneelCount,
            todayKneeling: newTodayKneeling,
        });
    } catch (err: any) {
        console.error('[kneel] unexpected error:', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
