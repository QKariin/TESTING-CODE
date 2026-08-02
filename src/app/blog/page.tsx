import { supabaseAdmin } from '@/lib/supabase';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog | Queen Karin',
  description:
    'Thoughts, lessons, and provocations from Queen Karin — on femdom, power dynamics, discipline, and the art of submission.',
  alternates: { canonical: 'https://throne.qkarin.com/blog' },
  openGraph: {
    title: 'Blog | Queen Karin',
    description: 'Thoughts, lessons, and provocations from Queen Karin — on femdom, power dynamics, discipline, and the art of submission.',
    url: 'https://throne.qkarin.com/blog',
    images: [{ url: '/og-cover.png', width: 1200, height: 630, alt: 'Queen Karin Blog' }],
  },
};

export const revalidate = 600;

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image: string | null;
  tags: string[];
  status: string;
  published_at: string | null;
  created_at: string;
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const { tag } = await searchParams;

  // Fetch all published posts (unfiltered) for tag collection
  const { data: allPublished } = await supabaseAdmin
    .from('blog_posts')
    .select('id, slug, title, excerpt, cover_image, tags, status, published_at, created_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false });

  const everyPost: BlogPost[] = allPublished || [];

  // Collect all unique tags across ALL published posts
  const allTags = Array.from(
    new Set(everyPost.flatMap((p) => p.tags || []))
  ).sort();

  // Filter by tag if one is active
  const allPosts = tag
    ? everyPost.filter((p) => p.tags && p.tags.includes(tag))
    : everyPost;

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: '0 auto',
        padding: '40px 20px 80px',
      }}
    >
      {/* Header */}
      <h1
        style={{
          color: '#c5a059',
          fontFamily: "'Rajdhani', sans-serif",
          fontWeight: 700,
          fontSize: '2.4rem',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        Blog
      </h1>
      <p
        style={{
          color: 'rgba(255,255,255,0.45)',
          fontFamily: "'Rajdhani', sans-serif",
          fontSize: '1.05rem',
          marginBottom: 40,
          letterSpacing: '0.02em',
        }}
      >
        Words from the throne.
      </p>

      {/* Tag filters */}
      {allTags.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: 40,
          }}
        >
          <a
            href="/blog"
            style={{
              display: 'inline-block',
              padding: '6px 16px',
              border: `1px solid ${!tag ? '#c5a059' : 'rgba(197,160,89,0.2)'}`,
              borderRadius: 20,
              color: !tag ? '#c5a059' : 'rgba(255,255,255,0.45)',
              background: !tag ? 'rgba(197,160,89,0.08)' : 'transparent',
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: '0.85rem',
              fontWeight: 600,
              textDecoration: 'none',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              transition: 'border-color 0.2s',
            }}
          >
            All
          </a>
          {allTags.map((t) => (
            <a
              key={t}
              href={`/blog?tag=${encodeURIComponent(t)}`}
              style={{
                display: 'inline-block',
                padding: '6px 16px',
                border: `1px solid ${tag === t ? '#c5a059' : 'rgba(197,160,89,0.2)'}`,
                borderRadius: 20,
                color: tag === t ? '#c5a059' : 'rgba(255,255,255,0.45)',
                background: tag === t ? 'rgba(197,160,89,0.08)' : 'transparent',
                fontFamily: "'Rajdhani', sans-serif",
                fontSize: '0.85rem',
                fontWeight: 600,
                textDecoration: 'none',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {t}
            </a>
          ))}
        </div>
      )}

      {/* Posts grid */}
      {allPosts.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '80px 20px',
            color: 'rgba(255,255,255,0.3)',
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: '1.1rem',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          No posts yet
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 28,
          }}
        >
          {allPosts.map((post) => (
            <a
              key={post.id}
              href={`/blog/${post.slug}`}
              style={{ textDecoration: 'none', display: 'block' }}
            >
              <article
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(197,160,89,0.12)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  transition: 'border-color 0.3s',
                }}
              >
                {/* Cover image */}
                {post.cover_image && (
                  <div
                    style={{
                      width: '100%',
                      height: 200,
                      overflow: 'hidden',
                    }}
                  >
                    <img
                      src={post.cover_image}
                      alt={post.title}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  </div>
                )}

                {/* Card content */}
                <div style={{ padding: '24px 24px 20px' }}>
                  {/* Date */}
                  <time
                    style={{
                      display: 'block',
                      color: 'rgba(255,255,255,0.3)',
                      fontFamily: "'Rajdhani', sans-serif",
                      fontSize: '0.78rem',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      marginBottom: 10,
                    }}
                  >
                    {post.published_at
                      ? new Date(post.published_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : ''}
                  </time>

                  {/* Title */}
                  <h2
                    style={{
                      color: '#c5a059',
                      fontFamily: "'Rajdhani', sans-serif",
                      fontWeight: 700,
                      fontSize: '1.3rem',
                      lineHeight: 1.3,
                      margin: '0 0 12px',
                    }}
                  >
                    {post.title}
                  </h2>

                  {/* Excerpt */}
                  {post.excerpt && (
                    <p
                      style={{
                        color: 'rgba(255,255,255,0.5)',
                        fontSize: '0.92rem',
                        lineHeight: 1.6,
                        margin: '0 0 16px',
                      }}
                    >
                      {post.excerpt}
                    </p>
                  )}

                  {/* Tags */}
                  {post.tags && post.tags.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 6,
                      }}
                    >
                      {post.tags.map((t) => (
                        <span
                          key={t}
                          style={{
                            display: 'inline-block',
                            padding: '3px 10px',
                            border: '1px solid rgba(197,160,89,0.18)',
                            borderRadius: 14,
                            color: 'rgba(197,160,89,0.6)',
                            fontFamily: "'Rajdhani', sans-serif",
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
