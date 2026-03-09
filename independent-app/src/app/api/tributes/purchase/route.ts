import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';
import { DbService } from '@/lib/supabase-service';

export async function POST(request: Request) {
    try {

        const body = await request.json();
        const { memberEmail, tributeId, tributeTitle, tributeCost } = body;

        if (!memberEmail || !tributeTitle || tributeCost === undefined) {
            return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 });
        }

        // 1. Get User Profile and Check Balance
        const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('wallet, score, parameters')
            .eq('member_id', memberEmail)
            .single();

        if (profileErr || !profile) {
            return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
        }

        const currentWallet = profile.wallet || 0;
        const currentScore = profile.score || 0;

        if (currentWallet < tributeCost) {
            return NextResponse.json({ success: false, error: 'INSUFFICIENT_FUNDS', wallet: currentWallet }, { status: 400 });
        }

        // 2. Calculate New Balances (Deduct Coins, Add Merit: 1 to 2 ratio)
        const newWallet = currentWallet - tributeCost;
        const meritGain = Math.floor(tributeCost / 2);
        const newScore = currentScore + meritGain;
        const params = profile.parameters || {};
        const newParams = {
            ...params,
            total_coins_spent: (params.total_coins_spent || 0) + tributeCost,
            last_tribute: { at: new Date().toISOString(), title: tributeTitle, amount: tributeCost }
        };

        // 3. Update wallet + parameters (score via awardPoints below)
        const { error: updateErr } = await supabase
            .from('profiles')
            .update({ wallet: newWallet, parameters: newParams })
            .eq('member_id', memberEmail);

        if (updateErr) {
            console.error("Profile update error:", updateErr);
            return NextResponse.json({ success: false, error: 'Failed to update balance' }, { status: 500 });
        }

        // Award merit points via centralized function (updates all period scores)
        await DbService.awardPoints(memberEmail, meritGain);

        // 4. Non-blocking: record last tribute timestamp (fails silently if columns don't exist yet)
        supabase.from('profiles').update({
            last_tribute_at: new Date().toISOString(),
            last_tribute_title: tributeTitle,
        }).eq('member_id', memberEmail).then(({ error: tsErr }: { error: any }) => {
            if (tsErr) console.warn('[Purchase] last_tribute columns not yet in DB — safe to ignore:', tsErr.message);
        });

        try { await DbService.sendMessage(memberEmail, `TRIBUTE PURCHASED: ${tributeTitle} (-${tributeCost} <i class="fas fa-coins" style="color:#c5a059;"></i>)`, 'system'); } catch (_) { }

        return NextResponse.json({
            success: true,
            newWallet,
            newScore,
            meritGained: meritGain,
            message: `Tribute "${tributeTitle}" purchased successfully.`
        });

    } catch (err: any) {
        console.error("Tribute Purchase API Error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
