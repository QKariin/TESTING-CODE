import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DbService } from '@/lib/supabase-service';

export const dynamic = "force-dynamic";

const COOLDOWN_MS = 60 * 60 * 1000; // 60 minutes

export async function POST(req: Request) {
    try {
        const { choice, memberEmail } = await req.json();

        if (!memberEmail) return NextResponse.json({ error: 'No email' }, { status: 400 });

        const COIN_REWARD = 10;
        const POINT_REWARD = 50;

        // ── 1. Get current profile balance ──────────────────────────────────
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('wallet, score')
            .eq('member_id', memberEmail)
            .single();

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        // ── 2. Get tasks row (lastWorship lives here) ───────────────────────
        const { data: taskRow } = await supabaseAdmin
            .from('tasks')
            .select('lastWorship, kneelCount, "today kneeling"')
            .ilike('member_id', memberEmail)
            .maybeSingle();

        // ── 3. Cooldown guard (server-side, matches Wix logic) ──────────────
        const now = new Date();
        const nowMs = now.getTime();
        if (taskRow?.lastWorship) {
            const lastMs = new Date(taskRow.lastWorship).getTime();
            if (nowMs - lastMs < COOLDOWN_MS) {
                const minLeft = Math.ceil((COOLDOWN_MS - (nowMs - lastMs)) / 60000);
                return NextResponse.json({ error: 'COOLDOWN', minLeft }, { status: 429 });
            }
        }

        // ── 4. Update profiles table (wallet or score) ──────────────────────
        const profileUpdate: any = {};
        if (choice === 'coins') profileUpdate.wallet = (profile.wallet || 0) + COIN_REWARD;
        else profileUpdate.score = (profile.score || 0) + POINT_REWARD;

        const { error: profileErr } = await supabaseAdmin
            .from('profiles')
            .update(profileUpdate)
            .eq('member_id', memberEmail);

        if (profileErr) throw profileErr;

        // ── 5. Upsert tasks table: lastWorship + kneelCount + today kneeling ─
        //    This is the EXACT same logic as Wix CLAIM_KNEEL_REWARD handler
        const todayStr = now.toISOString().split('T')[0];
        const lastWorshipStr = taskRow?.lastWorship
            ? new Date(taskRow.lastWorship).toISOString().split('T')[0]
            : null;
        const isSameDay = lastWorshipStr === todayStr;
        const prevToday = parseInt(taskRow?.['today kneeling'] || '0', 10);
        const newTodayKneeling = isSameDay ? prevToday + 1 : 1;
        const newKneelCount = parseInt(taskRow?.kneelCount || '0', 10) + 1;

        await supabaseAdmin
            .from('tasks')
            .upsert({
                member_id: memberEmail,
                lastWorship: now.toISOString(),
                kneelCount: String(newKneelCount),
                'today kneeling': String(newTodayKneeling),
            }, { onConflict: 'member_id' });

        // ── 6. Chat message ─────────────────────────────────────────────────
        const logMsg = choice === 'coins'
            ? `KNEELING REWARD CLAIMED (+${COIN_REWARD} COINS)`
            : `KNEELING REWARD CLAIMED (+${POINT_REWARD} MERIT)`;
        try { await DbService.sendMessage(memberEmail, logMsg, 'system'); } catch (_) { }

        return NextResponse.json({
            success: true,
            ...profileUpdate,
            kneelCount: newKneelCount,
            todayKneeling: newTodayKneeling,
            lastWorship: now.toISOString(),
        });

    } catch (err: any) {
        console.error('[Reward] Error:', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
