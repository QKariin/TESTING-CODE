import { NextResponse } from 'next/server';
import { supabaseAdmin, getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const body = await request.json();
        const email = (body.email || '').toLowerCase().trim();
        if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

        const { id: postId } = await params;

        // Resolve UUID from profiles
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .ilike('member_id', email)
            .maybeSingle();
        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        const memberId = profile.id;

        const { data: existing } = await supabaseAdmin
            .from('post_likes')
            .select('id')
            .eq('post_id', postId)
            .eq('member_id', memberId)
            .maybeSingle();

        const admin = getSupabaseAdmin();

        if (existing) {
            await supabaseAdmin.from('post_likes').delete().eq('id', existing.id);
            await admin.rpc('decrement_post_likes', { post_id: postId });
            return NextResponse.json({ success: true, liked: false });
        } else {
            await supabaseAdmin.from('post_likes').insert({ post_id: postId, member_id: memberId });
            await admin.rpc('increment_post_likes', { post_id: postId });
            return NextResponse.json({ success: true, liked: true });
        }
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
