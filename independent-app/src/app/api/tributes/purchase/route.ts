import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';

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
            .select('wallet, score')
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
        const meritGain = Math.floor(tributeCost / 2); // 1:2 ratio meaning they get half of spend in merit points
        const newScore = currentScore + meritGain;

        // 3. Update Database Profiles Table
        const { error: updateErr, data: updatedProfile } = await supabase
            .from('profiles')
            .update({ wallet: newWallet, score: newScore })
            .eq('member_id', memberEmail)
            .select()
            .single();

        if (updateErr) {
            console.error("Profile update error:", updateErr);
            return NextResponse.json({ success: false, error: 'Failed to update balance' }, { status: 500 });
        }

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
