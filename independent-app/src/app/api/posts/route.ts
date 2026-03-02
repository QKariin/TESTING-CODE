import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';

const getAdmin = () => createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── GET: Public – return all posts newest-first ──────────────────────────────
export async function GET() {
    try {
        const admin = getAdmin();
        const { data, error } = await admin
            .from('social_feed')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return NextResponse.json({ success: true, posts: data || [] });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// ── POST: CEO only – create a new post ──────────────────────────────────────
export async function POST(request: Request) {
    try {
        // 1. Verify session
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const email = (user.email || '').toLowerCase().trim();
        const isCEO = email === 'ceo@qkarin.com' || email === 'queen@qkarin.com';
        if (!isCEO) {
            return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }

        // 2. Parse body
        const body = await request.json();
        const { title, content, media_url, external_url } = body;

        if (!title && !content) {
            return NextResponse.json({ success: false, error: 'Title or content required' }, { status: 400 });
        }

        // 3. Insert
        const admin = getAdmin();
        const { data, error } = await admin
            .from('social_feed')
            .insert({ title, content, media_url: media_url || null, external_url: external_url || null })
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
