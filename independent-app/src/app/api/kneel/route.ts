// src/app/api/kneel/route.ts
// Handles kneeling submission - updates tasks table (lastWorship, kneelCount, "today kneeling")
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DbService } from '@/lib/supabase-service';
import { getCallerEmail, isCEO } from '@/lib/api-auth';

export const dynamic = "force-dynamic";

const COOLDOWN_MS = process.env.NODE_ENV === 'development' ? 60 * 1000 : 60 * 60 * 1000; // 1 min dev / 60 min prod

export async function POST(req: Request) {
    const caller = await getCallerEmail();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { memberEmail, tz = 'UTC' } = await req.json();
        if (!memberEmail) return NextResponse.json({ error: 'Missing memberEmail' }, { status: 400 });

        if (!isCEO(caller) && caller !== memberEmail.toLowerCase()) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Fetch current record from tasks table (member_id = email, case-insensitive)
        const { data: task } = await supabaseAdmin
            .from('tasks')
            .select('lastWorship, kneelCount, "today kneeling", kneel_history')
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

        // Build updated kneel_history: array of ISO timestamps for today only + new entry
        let kneelHistory: string[] = [];
        try {
            const raw = (task as any)?.kneel_history;
            const parsed: string[] = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : []);
            const todayStr = now.toLocaleDateString('en-CA', { timeZone: tz });
            // Keep only today's entries, then append new
            kneelHistory = parsed.filter((ts: string) => {
                try { return new Date(ts).toLocaleDateString('en-CA', { timeZone: tz }) === todayStr; } catch { return false; }
            });
        } catch (_) { }
        kneelHistory.push(now.toISOString());

        const upsertPayload: any = {
            member_id: memberEmail,
            lastWorship: now.toISOString(),
            kneelCount: String(newKneelCount),
            'today kneeling': String(newTodayKneeling),
        };

        // Only include kneel_history if we successfully built it (column may not exist yet)
        if (kneelHistory.length > 0) upsertPayload.kneel_history = kneelHistory;

        const { error } = await supabaseAdmin
            .from('tasks')
            .upsert(upsertPayload, { onConflict: 'member_id' });

        if (error) {
            console.error('[kneel] update error:', error);
            // Retry without kneel_history in case column doesn't exist yet
            const { error: e2 } = await supabaseAdmin.from('tasks').upsert({
                member_id: memberEmail,
                lastWorship: now.toISOString(),
                kneelCount: String(newKneelCount),
                'today kneeling': String(newTodayKneeling),
            }, { onConflict: 'member_id' });
            if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
        }

        try { await DbService.sendMessage(memberEmail, 'KNEELING SESSION COMPLETED', 'system'); } catch (_) { }

        // Return which hours today had a kneel (for dot grid)
        const kneelHours = [...new Set(kneelHistory.map(ts => {
            try {
                const h = parseInt(new Date(ts).toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false }), 10);
                return h === 24 ? 0 : h; // midnight edge case
            } catch { return -1; }
        }).filter(h => h >= 0))];

        return NextResponse.json({
            success: true,
            kneelCount: newKneelCount,
            todayKneeling: newTodayKneeling,
            kneelHours,
        });
    } catch (err: any) {
        console.error('[kneel] unexpected error:', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
