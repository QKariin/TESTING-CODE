import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCaller, isCEO } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * DRY-RUN test for the leaderboard reward flow.
 * Does NOT give rewards or reset scores. Just traces every step
 * and reports exactly where it would succeed or fail.
 *
 * GET /api/cron/test-reward        — tests daily
 * GET /api/cron/test-reward?period=weekly
 */
export async function GET(req: Request) {
    const caller = await getCaller();
    if (!caller || !isCEO(caller.email)) {
        return NextResponse.json({ error: 'CEO only' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || 'today';
    const scoreCol = period === 'weekly' ? 'Weekly Score'
        : period === 'monthly' ? 'Monthly Score'
        : 'Daily Score';

    const log: string[] = [];
    const step = (msg: string) => { log.push(msg); console.log('[test-reward]', msg); };

    // 1. Fetch leaderboard
    const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://throne.qkarin.com';
    const url = `${base}/api/global/leaderboard?period=${period}`;
    step(`Fetching leaderboard: ${url}`);

    let lbRes: Response;
    try {
        lbRes = await fetch(url);
    } catch (e: any) {
        step(`FETCH FAILED: ${e.message}`);
        return NextResponse.json({ success: false, log });
    }

    if (!lbRes.ok) {
        step(`LEADERBOARD HTTP ERROR: ${lbRes.status} ${lbRes.statusText}`);
        const body = await lbRes.text().catch(() => '');
        step(`Response body: ${body.slice(0, 500)}`);
        return NextResponse.json({ success: false, log });
    }

    const lbData = await lbRes.json();
    const entries = lbData.entries || [];
    step(`Leaderboard returned ${entries.length} entries`);

    if (entries.length === 0) {
        step('STOP: No entries — leaderboard is empty');
        return NextResponse.json({ success: false, log });
    }

    const winner = entries[0];
    const topScore = Number(winner.score || 0);
    step(`#1: ${winner.name} — score ${topScore} — member_number: ${winner.member_number || 'NULL'}`);

    if (topScore <= 0) {
        step('STOP: Top score is 0');
        return NextResponse.json({ success: false, log });
    }

    // 2. Find winner email
    if (!winner.member_number) {
        step('STOP: winner.member_number is null — cannot look up email');
        return NextResponse.json({ success: false, log });
    }

    const { data: prof, error: profErr } = await supabaseAdmin
        .from('profiles')
        .select('member_id')
        .eq('ID', winner.member_number)
        .maybeSingle();

    if (profErr) step(`Profile lookup error: ${profErr.message}`);
    const winnerEmail = prof?.member_id?.toLowerCase() || '';
    step(`Winner email: ${winnerEmail || 'NOT FOUND'}`);

    if (!winnerEmail) {
        step('STOP: Could not find winner email');
        return NextResponse.json({ success: false, log });
    }

    // 3. Fetch full profile
    const { data: profile, error: fullProfErr } = await supabaseAdmin
        .from('profiles')
        .select('ID, name, cumpass, skippass, checkpoint, wallet')
        .ilike('member_id', winnerEmail)
        .maybeSingle();

    if (fullProfErr) step(`Full profile error: ${fullProfErr.message}`);
    if (!profile) {
        step('STOP: Full profile not found');
        return NextResponse.json({ success: false, log });
    }
    step(`Profile found: ${profile.name} — skippass=${profile.skippass}, cumpass=${profile.cumpass}, checkpoint=${profile.checkpoint}, wallet=${profile.wallet}`);

    // 4. DRY RUN: Would update profile (NOT actually updating)
    step(`[DRY RUN] Would award: skippass+1 (daily)`);

    // 5. Test chat insert
    const cardData = {
        title: 'DAILY CHAMPION',
        rewards: '1x Skip Pass',
        score: topScore,
        period: 'Daily',
    };

    const chatPayload = {
        member_id: winnerEmail,
        sender_email: 'queen',
        content: `LEADERBOARD_REWARD_CARD::${JSON.stringify(cardData)}`,
        type: 'text',
        metadata: { isQueen: true },
    };
    step(`Testing chats insert...`);
    const { error: chatErr } = await supabaseAdmin.from('chats').insert(chatPayload);
    if (chatErr) {
        step(`CHAT INSERT FAILED: ${chatErr.message} | code: ${chatErr.code} | details: ${chatErr.details}`);
    } else {
        step(`CHAT INSERT OK`);
    }

    // 6. Test global_messages insert
    const globalPayload = {
        sender_email: 'system',
        sender_name: 'SYSTEM',
        sender_avatar: null,
        message: `LEADERBOARD_REWARD_CARD::${JSON.stringify({ ...cardData, winnerName: profile.name || 'SUBJECT' })}`,
    };
    step(`Testing global_messages insert...`);
    const { error: globalErr } = await supabaseAdmin.from('global_messages').insert(globalPayload);
    if (globalErr) {
        step(`GLOBAL INSERT FAILED: ${globalErr.message} | code: ${globalErr.code} | details: ${globalErr.details}`);
    } else {
        step(`GLOBAL INSERT OK`);
    }

    step('Done — all steps traced');
    return NextResponse.json({ success: !chatErr && !globalErr, log });
}
