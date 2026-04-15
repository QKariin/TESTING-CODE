// src/app/api/kneel/route.ts
// Handles kneeling submission - updates tasks table (lastWorship, kneelCount, "today kneeling")
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DbService } from '@/lib/supabase-service';

export const dynamic = "force-dynamic";

const COOLDOWN_MS = process.env.NODE_ENV === 'development' ? 60 * 1000 : 60 * 60 * 1000; // 1 min dev / 60 min prod

const TASK_FIELDS = 'lastWorship, kneelCount, "today kneeling", kneel_history, member_id';

// Resolve the tasks row using UUID + legacy email fallback.
// Returns { task, taskMemberId } where taskMemberId is the key already in DB (to upsert correctly).
async function getTaskRow(memberId: string): Promise<{ task: any; taskMemberId: string }> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);

    if (isUuid) {
        // Try UUID lookup first
        const { data } = await supabaseAdmin.from('tasks').select(TASK_FIELDS).eq('member_id', memberId).maybeSingle();
        if (data) return { task: data, taskMemberId: data.member_id };

        // Fallback: look up profile email, then find task by email
        const { data: profile } = await supabaseAdmin.from('profiles').select('member_id').eq('id', memberId).maybeSingle();
        if (profile?.member_id) {
            const { data: row } = await supabaseAdmin.from('tasks').select(TASK_FIELDS).ilike('member_id', profile.member_id).maybeSingle();
            if (row) return { task: row, taskMemberId: row.member_id };
        }
        // No existing row — use UUID as the new key
        return { task: null, taskMemberId: memberId };
    } else {
        // Email lookup (legacy)
        const { data } = await supabaseAdmin.from('tasks').select(TASK_FIELDS).ilike('member_id', memberId).maybeSingle();
        return { task: data || null, taskMemberId: data?.member_id || memberId };
    }
}

export async function POST(req: Request) {
    try {
        const { memberId, tz = 'UTC' } = await req.json();
        if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 });

        // Fetch current record with UUID + legacy email fallback
        const { task, taskMemberId } = await getTaskRow(memberId);

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

        // Build updated kneel_history: keep today's entries + append new
        let kneelHistory: string[] = [];
        try {
            const raw = (task as any)?.kneel_history;
            const parsed: string[] = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : []);
            kneelHistory = parsed.filter((ts: string) => {
                try { return new Date(ts).toLocaleDateString('en-CA', { timeZone: tz }) === todayStr; } catch { return false; }
            });
        } catch (_) { }
        kneelHistory.push(now.toISOString());

        // Use the existing row's member_id key so we update the right row (not create a duplicate)
        const upsertPayload: any = {
            member_id: taskMemberId,
            lastWorship: now.toISOString(),
            kneelCount: String(newKneelCount),
            'today kneeling': String(newTodayKneeling),
        };

        if (kneelHistory.length > 0) upsertPayload.kneel_history = kneelHistory;

        const { error } = await supabaseAdmin
            .from('tasks')
            .upsert(upsertPayload, { onConflict: 'member_id' });

        if (error) {
            console.error('[kneel] update error:', error);
            // Retry without kneel_history in case column doesn't exist yet
            const { error: e2 } = await supabaseAdmin.from('tasks').upsert({
                member_id: taskMemberId,
                lastWorship: now.toISOString(),
                kneelCount: String(newKneelCount),
                'today kneeling': String(newTodayKneeling),
            }, { onConflict: 'member_id' });
            if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
        }

        try { await DbService.sendMessage(memberId, 'KNEELING SESSION COMPLETED', 'system'); } catch (_) { }

        // Mirror kneelCount to profiles.parameters so ENDURANCE stat is always readable
        // even when the tasks join fails (e.g. legacy UUID mismatch). Same pattern as MERIT writing to profiles.score.
        try {
            const { data: prof } = await supabaseAdmin
                .from('profiles')
                .select('id, parameters')
                .eq('id', memberId)
                .maybeSingle();
            if (prof) {
                await supabaseAdmin.from('profiles')
                    .update({ parameters: { ...(prof.parameters || {}), kneel_count: newKneelCount } })
                    .eq('id', prof.id);
            }
        } catch (_) { }

        // Return which hours today had a kneel (for dot grid)
        const kneelHours = [...new Set(kneelHistory.map(ts => {
            try {
                const h = parseInt(new Date(ts).toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false }), 10);
                return h === 24 ? 0 : h;
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
