import type { MetadataRoute } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://throne.qkarin.com'

    // Fetch all published blog posts for dynamic sitemap entries
    let blogEntries: MetadataRoute.Sitemap = [];
    try {
        const { data: posts } = await supabaseAdmin
            .from('blog_posts')
            .select('slug, updated_at, published_at')
            .eq('status', 'published')
            .order('published_at', { ascending: false });

        if (posts) {
            blogEntries = posts.map((p: any) => ({
                url: `${baseUrl}/blog/${p.slug}`,
                lastModified: new Date(p.updated_at || p.published_at),
                changeFrequency: 'weekly' as const,
                priority: 0.8,
            }));
        }
    } catch {}

    return [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 1,
        },
        {
            url: `${baseUrl}/home`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 1,
        },
        {
            url: `${baseUrl}/blog`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.9,
        },
        ...blogEntries,
        {
            url: `${baseUrl}/keyholder`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/tribute`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/login`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/apply`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.8,
        },
    ]
}
