import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { rankMeetsRequirement } from '@/lib/hierarchyRules';

const getAdmin = () => createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── GET: Public – return all published posts newest-first, annotated ──────────
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const email = (searchParams.get('email') || '').toLowerCase().trim();

    const { data: posts, error } = await supabaseAdmin
        .from('social_feed')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    if (!posts?.length) return NextResponse.json({ success: true, posts: [] });

    if (!email) {
        return NextResponse.json({ success: true, posts: posts.map((p: any) => ({ ...p, userHasAccess: true, userHasLiked: false })) });
    }

    const [profileRes, unlocksRes, likesRes] = await Promise.all([
        supabaseAdmin.from('profiles').select('hierarchy').ilike('member_id', email).maybeSingle(),
        supabaseAdmin.from('post_unlocks').select('post_id').ilike('member_id', email),
        supabaseAdmin.from('post_likes').select('post_id').ilike('member_id', email),
    ]);

    const userRank = profileRes.data?.hierarchy || 'Hall Boy';
    const unlockedIds = new Set((unlocksRes.data || []).map((r: any) => r.post_id));
    const likedIds    = new Set((likesRes.data  || []).map((r: any) => r.post_id));

    const annotated = posts.map((p: any) => ({
        ...p,
        userHasAccess: rankMeetsRequirement(userRank, p.min_rank || 'Hall Boy') || unlockedIds.has(p.id),
        userHasLiked:  likedIds.has(p.id),
    }));

    return NextResponse.json({ success: true, posts: annotated });
}

// ── POST: CEO only – create a new post ──────────────────────────────────────
export async function POST(request: Request) {
    try {
        // 1. Verify session
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        let email = (user?.email || '').toLowerCase().trim();

        // Local Dev Bypass
        if (!user && process.env.NODE_ENV === 'development') {
            email = 'ceo@qkarin.com';
        } else if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const isCEO = email === 'ceo@qkarin.com' || email === 'queen@qkarin.com';
        if (!isCEO) {
            return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }

        // 2. Parse body
        const body = await request.json();
        const { title, content, media_url, external_url, min_rank, price, media_type, is_published } = body;

        if (!title && !content) {
            return NextResponse.json({ success: false, error: 'Title or content required' }, { status: 400 });
        }

        // 3. Insert
        const admin = getAdmin();
        const { data, error } = await admin
            .from('social_feed')
            .insert({
                title,
                content,
                media_url: media_url || null,
                external_url: external_url || null,
                min_rank: min_rank || 'Hall Boy',
                price: price || 0,
                media_type: media_type || 'text',
                is_published: is_published !== undefined ? is_published : true,
            })
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ success: true, post: data });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// ── DELETE: CEO only – delete a post ────────────────────────────────────────
export async function DELETE(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const email = (user.email || '').toLowerCase().trim();
        if (email !== 'ceo@qkarin.com' && email !== 'queen@qkarin.com') {
            return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await request.json();
        if (!id) return NextResponse.json({ success: false, error: 'No ID' }, { status: 400 });

        const admin = getAdmin();
        const { error } = await admin.from('social_feed').delete().eq('id', id);
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
