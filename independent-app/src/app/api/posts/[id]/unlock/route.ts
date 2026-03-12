import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { rankMeetsRequirement } from '@/lib/hierarchyRules';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const body = await request.json();
        const email = (body.email || '').toLowerCase().trim();
        if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

        const { id: postId } = await params;

        const { data: post } = await supabaseAdmin
            .from('social_feed')
            .select('id, price, min_rank, is_published')
            .eq('id', postId)
            .single();
        if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

        const { data: existing } = await supabaseAdmin
            .from('post_unlocks')
            .select('id')
            .eq('post_id', postId)
            .ilike('member_id', email)
            .maybeSingle();
        if (existing) return NextResponse.json({ success: true, alreadyUnlocked: true });

        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('wallet, hierarchy')
            .ilike('member_id', email)
            .single();
        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        if (rankMeetsRequirement(profile.hierarchy, post.min_rank)) {
            return NextResponse.json({ success: true, freeAccess: true });
        }

        if (profile.wallet < post.price) {
            return NextResponse.json({ error: 'INSUFFICIENT_FUNDS', wallet: profile.wallet }, { status: 400 });
        }

        const newWallet = profile.wallet - post.price;
        const { error: walletErr } = await supabaseAdmin
            .from('profiles')
            .update({ wallet: newWallet })
            .ilike('member_id', email);
        if (walletErr) return NextResponse.json({ error: 'Failed to deduct coins' }, { status: 500 });

        const { error: unlockErr } = await supabaseAdmin
            .from('post_unlocks')
            .insert({ post_id: postId, member_id: email });
        if (unlockErr) {
            await supabaseAdmin.from('profiles').update({ wallet: profile.wallet }).ilike('member_id', email);
            return NextResponse.json({ error: unlockErr.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, newWallet });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
