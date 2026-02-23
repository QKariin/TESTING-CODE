import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';

export async function POST(request: Request) {
    try {

        const body = await request.json();
        const { memberEmail, tributeId, tributeTitle, contributionAmount } = body;

        if (!memberEmail || !tributeTitle || contributionAmount === undefined || contributionAmount <= 0) {
            return NextResponse.json({ success: false, error: 'Missing or invalid parameters' }, { status: 400 });
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

        if (currentWallet < contributionAmount) {
            return NextResponse.json({ success: false, error: 'INSUFFICIENT_FUNDS', wallet: currentWallet }, { status: 400 });
        }

        // 2. Calculate New Balances (Deduct Coins, Add Merit: 1 to 2 ratio)
        const newWallet = currentWallet - contributionAmount;
        const meritGain = Math.floor(contributionAmount / 2); // 1:2 ratio meaning they get half of spend in merit points
        const newScore = currentScore + meritGain;

        // 3. Update Database Profiles Table
        const { error: updateProfileErr } = await supabase
            .from('profiles')
            .update({ wallet: newWallet, score: newScore })
            .eq('member_id', memberEmail);

        if (updateProfileErr) {
            console.error("Profile update error:", updateProfileErr);
            return NextResponse.json({ success: false, error: 'Failed to update balance' }, { status: 500 });
        }

        // 4. Update the Crowdfund raised_amount in the wishlist Table
        // Need to fetch current raised amount first
        const { data: tributeData, error: tributeErr } = await supabase
            .from('wishlist')
            .select('raised_amount')
            .eq('id', tributeId) // Assuming 'id' is the primary key and corresponds to tributeId.
            .single();

        if (tributeErr || !tributeData) {
            // Fallback: If "id" missing, maybe they use Title or _id, but id is safest.
            console.warn("Could not find tribute to increment raised amount. Check column names.", tributeErr);
        } else {
            const newRaisedAmount = (tributeData.raised_amount || 0) + contributionAmount;
            await supabase
                .from('wishlist')
                .update({ raised_amount: newRaisedAmount })
                .eq('id', tributeId);
        }

        // 5. Insert receipt into crowdfund_contributions table
        const { error: insertErr } = await supabase
            .from('crowdfund_contributions')
            .insert({
                member_id: memberEmail,
                tribute_id: tributeId.toString(),
                amount_given: contributionAmount,
                // timestamp is auto-generated based on the DB column default
            });

        if (insertErr) {
            console.error("Receipt logging error (Non-Fatal):", insertErr);
        }

        return NextResponse.json({
            success: true,
            newWallet,
            newScore,
            meritGained: meritGain,
            message: `Contribution to "${tributeTitle}" logged successfully.`
        });

    } catch (err: any) {
        console.error("Tribute Contribution API Error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
