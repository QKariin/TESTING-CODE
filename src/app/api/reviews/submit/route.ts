import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCaller, isOwnerOrCEO } from '@/lib/api-auth';
import { discordReviewSubmitted } from '@/lib/discord';
import { invalidateReviewsCache } from '@/app/api/reviews/public/route';

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { memberId, text, rating } = await req.json();
        const profileId = memberId || caller.email;

        if (!profileId) return NextResponse.json({ error: 'No memberId' }, { status: 400 });
        if (!text || text.trim().length < 100) return NextResponse.json({ error: 'Review must be at least 100 characters' }, { status: 400 });
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
                status: 'approved',
            });

        if (insertError) throw insertError;

        // Bust the public reviews cache so new review shows up immediately
        invalidateReviewsCache();

        // Award 500 coins + mark reviewSubmitted in parameters
        const newWallet = (profile.wallet || 0) + 500;
        const params = profile.parameters || {};
        await supabaseAdmin
            .from('profiles')
            .update({
                wallet: newWallet,
                parameters: { ...params, reviewSubmitted: true },
            })
            .eq('ID', profile.ID);

        // Discord notification
        const { data: nameProfile } = await supabaseAdmin
            .from('profiles')
            .select('name')
            .eq('ID', profile.ID)
            .single();
        const memberName = nameProfile?.name || email;
        discordReviewSubmitted(memberName, Math.round(rating)).catch(() => {});

        // Push notification to CEO
        try {
            const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '761d91da-b098-44a7-8d98-75c1cce54dd0';
            const apiKey = process.env.ONESIGNAL_REST_API_KEY;
            const ceoEmail = 'ceo@qkarin.com';
            if (apiKey) {
                await fetch('https://api.onesignal.com/notifications', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${apiKey}` },
                    body: JSON.stringify({
                        app_id: appId,
                        target_channel: 'push',
                        include_aliases: { external_id: [ceoEmail] },
                        headings: { en: 'New Review Submitted' },
                        contents: { en: `${memberName} left a ${Math.round(rating)}-star review.` },
                        url: 'https://throne.qkarin.com/dashboard',
                    }),
                });
            }
        } catch (_) {}

        return NextResponse.json({ success: true, coinsAwarded: 500, newWallet });

    } catch (err: any) {
        console.error('[Reviews] Submit error:', err);
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
    }
}
