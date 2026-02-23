// src/app/api/kneel/route.ts
// Handles kneeling submission - updates tasks table (lastWorship, kneelCount, "today kneeling")
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = "force-dynamic";

const COOLDOWN_MS = 60 * 60 * 1000; // 60 minutes

export async function POST(req: Request) {
    try {
        const { memberEmail } = await req.json();
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

        // Calculate today kneeling (reset if different local day using UTC midnight)
        const todayStr = now.toISOString().split('T')[0]; // e.g. "2026-02-22"
        const lastWorshipStr = task?.lastWorship
            ? new Date(task.lastWorship).toISOString().split('T')[0]
            : null;

        const isSameDay = lastWorshipStr === todayStr;
        const prevToday = parseInt(task?.['today kneeling'] || '0', 10);
        const newTodayKneeling = isSameDay ? prevToday + 1 : 1;
        const newKneelCount = parseInt(task?.kneelCount || '0', 10) + 1;

        let dbError;
        if (task) {
            // If row exists, update it (using ilike for case insensitivity so we don't miss it)
            const { error } = await supabaseAdmin
                .from('tasks')
                .update({
                    lastWorship: now.toISOString(),
                    kneelCount: String(newKneelCount),
                    'today kneeling': String(newTodayKneeling),
                })
                .ilike('member_id', memberEmail);
            dbError = error;
        } else {
            // If row does not exist, insert a new one
            const { error } = await supabaseAdmin
                .from('tasks')
                .insert({
                    member_id: memberEmail,
                    lastWorship: now.toISOString(),
                    kneelCount: String(newKneelCount),
                    'today kneeling': String(newTodayKneeling),
                });
            dbError = error;
        }

        if (dbError) {
            console.error('[kneel] db error:', dbError);
            return NextResponse.json({ error: dbError.message }, { status: 500 });
        }

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
