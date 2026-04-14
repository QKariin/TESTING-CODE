import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';
import { DbService } from '@/lib/supabase-service';

export async function POST(request: Request) {
    try {

        const body = await request.json();
        const { memberEmail, tributeId, tributeTitle, contributionAmount } = body;

        if (!memberEmail || !tributeTitle || contributionAmount === undefined || contributionAmount <= 0) {
            return NextResponse.json({ success: false, error: 'Missing or invalid parameters' }, { status: 400 });
        }

        // 1. Get User Profile and Check Balance
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberEmail);
        const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('id, wallet, score, parameters, member_id')
            .eq(isUUID ? 'id' : 'member_id', memberEmail)
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
        const meritGain = Math.floor(contributionAmount / 2);
        const newScore = currentScore + meritGain;
        const params = profile.parameters || {};
        const newParams = {
            ...params,
            wishlist_spent: (Number(params.wishlist_spent) || 0) + contributionAmount,
            last_tribute: { at: new Date().toISOString(), title: tributeTitle, amount: contributionAmount },
            tributeHistory: [{ amount: -contributionAmount, message: `SACRIFICE: ${tributeTitle}`, date: new Date().toISOString(), type: 'expense' }, ...(Array.isArray((profile.parameters||{}).tributeHistory) ? (profile.parameters||{}).tributeHistory : [])].slice(0,50),
        };

        const profileUuid = profile.id;

        // 3. Update wallet + parameters (score via awardPoints below)
        const { error: updateProfileErr } = await supabase
            .from('profiles')
            .update({ wallet: newWallet, parameters: newParams })
            .eq('id', profileUuid);

        if (updateProfileErr) {
            console.error("Profile update error:", updateProfileErr);
            return NextResponse.json({ success: false, error: 'Failed to update balance' }, { status: 500 });
        }

        // Update tasks['Tribute History'] - primary source for SACRIFICE stat
        const { data: taskRow } = await supabase.from('tasks').select('"Tribute History"').eq('member_id', profileUuid).maybeSingle();
        const existingTH: any[] = (() => { try { const v = taskRow?.['Tribute History']; return Array.isArray(v) ? v : (typeof v === 'string' ? JSON.parse(v) : []); } catch { return []; } })();
        const newTH = [{ amount: -contributionAmount, title: tributeTitle, date: new Date().toISOString() }, ...existingTH].slice(0, 100);
        supabase.from('tasks').update({ 'Tribute History': newTH }).eq('member_id', profileUuid).then(() => {});

        // Award merit points via centralized function (updates all period scores)
        await DbService.awardPoints(profileUuid, meritGain);

        // 4. Update the Crowdfund raised_amount in the Wishlist table
        // The tributeId passed from the client is the Title value (the Wishlist table has no lowercase 'id' column)
        // So we match directly by Title, which is reliable
        const { data: tributeData, error: tributeErr } = await supabase
            .from('Wishlist')
            .select('"ID", "Title", raised_amount')
            .eq('Title', tributeTitle)
            .maybeSingle();

        if (tributeErr) {
            console.error(`[API/Contribute] Error fetching tribute:`, tributeErr);
        } else if (!tributeData) {
            console.error(`[API/Contribute] Could not find tribute with Title="${tributeTitle}" in Wishlist table`);
        } else {
            const currentRaised = Number(tributeData.raised_amount || 0);
            const newRaisedAmount = currentRaised + contributionAmount;

            const { error: updateErr } = await supabase
                .from('Wishlist')
                .update({ raised_amount: newRaisedAmount })
                .eq('Title', tributeTitle);

            if (updateErr) {
                console.error(`[API/Contribute] Failed to update raised_amount:`, updateErr);
            } else {
                console.log(`[API/Contribute] SUCCESS: Wishlist Title="${tributeTitle}" raised_amount updated to ${newRaisedAmount}`);
            }
        }

        // 5. Insert receipt into crowdfund_contributions table
        const { error: insertErr } = await supabase
            .from('crowdfund_contributions')
            .insert({
                member_id: profileUuid,
                tribute_id: tributeId.toString(),
                amount_given: contributionAmount,
            });

        if (insertErr) {
            console.error("Receipt logging error (Non-Fatal):", insertErr);
        }

        try { await DbService.sendMessage(profileUuid, `CONTRIBUTED TO '${tributeTitle}' ${contributionAmount} <i class="fas fa-coins" style="color:#c5a059;"></i>`, 'system'); } catch (_) { }

        return NextResponse.json({
            success: true,
            newWallet,
            newScore,
            meritGained: meritGain,
            tributeUpdate: !!tributeData,
            message: tributeData ? `Contribution to "${tributeTitle}" logged.` : `Warning: Tribute "${tributeTitle}" not found in DB, but wallet deducted.`
        });

    } catch (err: any) {
        console.error("Tribute Contribution API Error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
