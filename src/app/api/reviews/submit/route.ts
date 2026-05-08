import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCaller, isOwnerOrCEO } from '@/lib/api-auth';

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { memberId, text, rating } = await req.json();
        const profileId = memberId || caller.email;

        if (!profileId) return NextResponse.json({ error: 'No memberId' }, { status: 400 });
        if (!text || text.trim().length < 10) return NextResponse.json({ error: 'Review must be at least 10 characters' }, { status: 400 });
        if (!rating || rating < 1 || rating > 5) return NextResponse.json({ error: 'Rating must be 1-5' }, { status: 400 });

        if (!isOwnerOrCEO(caller, profileId)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Resolve email from profileId
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profileId);
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('ID, member_id, wallet, parameters')
            .eq(isUUID ? 'ID' : 'member_id', profileId)
            .single();

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        const email = (profile.member_id || '').toLowerCase();

        // Check if already submitted
        const { data: existing } = await supabaseAdmin
            .from('reviews')
            .select('id')
            .ilike('member_id', email)
            .limit(1);

        if (existing && existing.length > 0) {
            return NextResponse.json({ error: 'You have already submitted a review' }, { status: 409 });
        }

        // Insert review
        const { error: insertError } = await supabaseAdmin
            .from('reviews')
            .insert({
                member_id: email,
                text: text.trim(),
                rating: Math.round(rating),
                status: 'pending',
            });

        if (insertError) throw insertError;

        // Award 500 coins
        const newWallet = (profile.wallet || 0) + 500;
        await supabaseAdmin
            .from('profiles')
            .update({ wallet: newWallet })
            .eq('ID', profile.ID);

        return NextResponse.json({ success: true, coinsAwarded: 500, newWallet });

    } catch (err: any) {
        console.error('[Reviews] Submit error:', err);
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
    }
}
