import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DbService } from '@/lib/supabase-service'; // Use Admin to bypass RLS for increments

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        const { choice, memberEmail } = await req.json();

        if (!memberEmail) return NextResponse.json({ error: 'No email' }, { status: 400 });

        // Define Rewards
        const COIN_REWARD = 10;
        const POINT_REWARD = 50;

        // We use an RPC call (Stored Procedure) if you have one, 
        // BUT for simplicity, we will just read -> add -> write.
        // (For high traffic, an RPC 'increment' function is better, but this works fine for now).

        // 1. Get current balance
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('wallet, score')
            .eq('member_id', memberEmail)
            .single();

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        let updateData: any = {};

        if (choice === 'coins') {
            updateData = { wallet: (profile.wallet || 0) + COIN_REWARD };
            const { error } = await supabaseAdmin.from('profiles').update(updateData).eq('member_id', memberEmail);
            if (error) throw error;
        } else {
            await DbService.awardPoints(memberEmail, POINT_REWARD);
            updateData = { score: (profile.score || 0) + POINT_REWARD };
        }

        const logMsg = choice === 'coins' ? `REWARD CLAIMED (+${COIN_REWARD} <i class="fas fa-coins" style="color:#c5a059;"></i>)` : `REWARD CLAIMED (+${POINT_REWARD} MERIT)`;
        try { await DbService.sendMessage(memberEmail, logMsg, 'system'); } catch (_) { }


        return NextResponse.json({ success: true, ...updateData });

    } catch (err: any) {
        console.error('[Reward] Error:', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
