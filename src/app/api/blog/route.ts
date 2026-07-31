import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCaller, isCEO } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// GET /api/blog — list all blog posts (public)
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const tag = searchParams.get('tag');

        let query = supabaseAdmin
            .from('blog_posts')
            .select('id, slug, title, excerpt, cover_image, tags, status, published_at, created_at')
            .order('published_at', { ascending: false, nullsFirst: false });

        if (status) {
            query = query.eq('status', status);
        }

        if (tag) {
            query = query.contains('tags', [tag]);
        }

        const { data, error } = await query;
        if (error) throw error;

        return NextResponse.json({ success: true, posts: data || [] });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// POST /api/blog — create a new blog post (CEO only)
export async function POST(request: Request) {
    try {
        const caller = await getCaller();
        if (!caller) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        if (!isCEO(caller.email)) {
            return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { title, content, excerpt, cover_image, tags, meta_description, meta_keywords, status } = body;

        if (!title || !content) {
            return NextResponse.json({ success: false, error: 'Title and content are required' }, { status: 400 });
        }

        // Always generate slug from title (ignore user-provided slug if it looks like content)
        const rawSlug = (body.slug && body.slug.length < 100) ? body.slug : title;
        const slug = rawSlug
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 80)
            .replace(/-$/, '');

        const now = new Date().toISOString();

        const insertData: Record<string, any> = {
            slug,
            title,
            content,
            excerpt: excerpt || null,
            cover_image: cover_image || null,
            tags: tags || [],
            meta_description: meta_description || null,
            meta_keywords: meta_keywords || null,
            status: status || 'draft',
        };

        // If publishing and no published_at provided, set it to now
        if (insertData.status === 'published' && !body.published_at) {
            insertData.published_at = now;
        } else if (body.published_at) {
            insertData.published_at = body.published_at;
        }

        const { data, error } = await supabaseAdmin
            .from('blog_posts')
            .insert(insertData)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, post: data });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
