import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCaller, isCEO } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// GET /api/blog/[slug] — fetch single post by slug (public)
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const { slug } = await params;

        const { data, error } = await supabaseAdmin
            .from('blog_posts')
            .select('*')
            .eq('slug', slug)
            .single();

        if (error || !data) {
            return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, post: data });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// PUT /api/blog/[slug] — update a post (CEO only)
export async function PUT(req: Request, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const { slug } = await params;

        const caller = await getCaller();
        if (!caller) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        if (!isCEO(caller.email)) {
            return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }

        const body = await req.json();
        const now = new Date().toISOString();

        const updates: Record<string, any> = { updated_at: now };

        const allowed = ['title', 'slug', 'excerpt', 'content', 'cover_image', 'tags', 'meta_description', 'meta_keywords', 'status', 'published_at'];
        for (const key of allowed) {
            if (body[key] !== undefined) {
                updates[key] = body[key];
            }
        }

        // If changing status to 'published' and no published_at set, auto-set it
        if (updates.status === 'published' && !body.published_at) {
            // Check current post to see if published_at is already set
            const { data: existing } = await supabaseAdmin
                .from('blog_posts')
                .select('published_at')
                .eq('slug', slug)
                .single();

            if (!existing?.published_at) {
                updates.published_at = now;
            }
        }

        const { data, error } = await supabaseAdmin
            .from('blog_posts')
            .update(updates)
            .eq('slug', slug)
            .select()
            .single();

        if (error) throw error;
        if (!data) {
            return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, post: data });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// DELETE /api/blog/[slug] — delete a post (CEO only)
export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const { slug } = await params;

        const caller = await getCaller();
        if (!caller) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        if (!isCEO(caller.email)) {
            return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }

        const { error, count } = await supabaseAdmin
            .from('blog_posts')
            .delete()
            .eq('slug', slug);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
