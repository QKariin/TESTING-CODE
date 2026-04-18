import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DbService } from '@/lib/supabase-service'; // Use Admin to bypass RLS for increments
import { getCaller, isOwnerOrCEO } from '@/lib/api-auth';

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { choice, memberId, memberEmail } = await req.json();
        // Accept memberId (UUID) as primary, fall back to legacy memberEmail
        const profileId = memberId || memberEmail;

        if (!profileId) return NextResponse.json({ error: 'No memberId' }, { status: 400 });

        if (!isOwnerOrCEO(caller, profileId)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Define Rewards
        const COIN_REWARD = 10;
        const POINT_REWARD = 50;

        // 1. Get current balance - look up by UUID (profiles.id) if UUID, else by member_id (email)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profileId);
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('ID, wallet, score, member_id')
            .eq(isUUID ? 'ID' : 'member_id', profileId)
            .single();

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        let updateData: any = {};

        if (choice === 'coins') {
            updateData = { wallet: (profile.wallet || 0) + COIN_REWARD };
            const { error } = await supabaseAdmin.from('profiles').update(updateData).eq('ID', profile.ID);
            if (error) throw error;
        } else {
            await DbService.awardPoints(profile.member_id || profileId, POINT_REWARD);
            updateData = { score: (profile.score || 0) + POINT_REWARD };
        }

        const logMsg = choice === 'coins' ? `REWARD CLAIMED (+${COIN_REWARD} <i class="fas fa-coins" style="color:#c5a059;"></i>)` : `REWARD CLAIMED (+${POINT_REWARD} MERIT)`;
        try { await DbService.sendMessage(profileId, logMsg, 'system'); } catch (_) { }


        return NextResponse.json({ success: true, ...updateData });

    } catch (err: any) {
        console.error('[Reward] Error:', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
