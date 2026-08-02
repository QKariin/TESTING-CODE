import { supabaseAdmin } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export const revalidate = 600;

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  cover_image: string | null;
  tags: string[];
  meta_description: string | null;
  meta_keywords: string | null;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const { data: post } = await supabaseAdmin
    .from('blog_posts')
    .select('title, excerpt, meta_description, meta_keywords, cover_image')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (!post) {
    return { title: 'Post Not Found | Queen Karin' };
  }

  const keywords =
    typeof post.meta_keywords === 'string'
      ? post.meta_keywords.split(',').map((k: string) => k.trim())
      : post.meta_keywords || [];

  return {
    title: `${post.title} | Queen Karin`,
    description: post.meta_description || post.excerpt || '',
    keywords,
    alternates: { canonical: `https://throne.qkarin.com/blog/${slug}` },
    openGraph: {
      title: post.title,
      description: post.meta_description || post.excerpt || '',
      images: post.cover_image ? [{ url: post.cover_image }] : [],
      url: `https://throne.qkarin.com/blog/${slug}`,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.meta_description || post.excerpt || '',
      images: post.cover_image ? [post.cover_image] : [],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: post, error } = await supabaseAdmin
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (error || !post) {
    notFound();
  }

  const typedPost = post as BlogPost;

  const formattedDate = typedPost.published_at
    ? new Date(typedPost.published_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  // Article structured data
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: typedPost.title,
    author: {
      '@type': 'Person',
      name: 'Queen Karin',
    },
    publisher: {
      '@type': 'Person',
      name: 'Queen Karin',
    },
    datePublished: typedPost.published_at || typedPost.created_at,
    ...(typedPost.updated_at && { dateModified: typedPost.updated_at }),
    ...(typedPost.cover_image && { image: typedPost.cover_image }),
    ...(typedPost.meta_description && { description: typedPost.meta_description }),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://throne.qkarin.com/blog/${typedPost.slug}`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      {/* Scoped styles for rendered blog content */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .blog-content h1 {
              color: #c5a059;
              font-family: 'Rajdhani', sans-serif;
              font-weight: 700;
              font-size: 2rem;
              margin: 2em 0 0.6em;
              line-height: 1.3;
            }
            .blog-content h2 {
              color: #c5a059;
              font-family: 'Rajdhani', sans-serif;
              font-weight: 700;
              font-size: 1.6rem;
              margin: 1.8em 0 0.5em;
              line-height: 1.3;
            }
            .blog-content h3 {
              color: #c5a059;
              font-family: 'Rajdhani', sans-serif;
              font-weight: 600;
              font-size: 1.3rem;
              margin: 1.5em 0 0.4em;
              line-height: 1.4;
            }
            .blog-content p {
              color: rgba(255,255,255,0.7);
              font-size: 1.05rem;
              line-height: 1.8;
              margin: 0 0 1.4em;
            }
            .blog-content a {
              color: #c5a059;
              text-decoration: underline;
              text-underline-offset: 3px;
            }
            .blog-content a:hover {
              color: #d4b06a;
            }
            .blog-content strong {
              color: rgba(255,255,255,0.85);
              font-weight: 700;
            }
            .blog-content em {
              color: rgba(255,255,255,0.65);
              font-style: italic;
            }
            .blog-content ul, .blog-content ol {
              color: rgba(255,255,255,0.6);
              padding-left: 1.6em;
              margin: 0 0 1.4em;
            }
            .blog-content li {
              color: rgba(255,255,255,0.6);
              line-height: 1.8;
              margin-bottom: 0.4em;
            }
            .blog-content blockquote {
              border-left: 3px solid #c5a059;
              margin: 1.6em 0;
              padding: 12px 20px;
              font-style: italic;
              color: rgba(255,255,255,0.55);
              background: rgba(197,160,89,0.04);
              border-radius: 0 8px 8px 0;
            }
            .blog-content blockquote p {
              margin-bottom: 0.5em;
            }
            .blog-content blockquote p:last-child {
              margin-bottom: 0;
            }
            .blog-content img {
              max-width: 100%;
              height: auto;
              border-radius: 8px;
              margin: 1em 0;
              display: block;
            }
            .blog-content hr {
              border: none;
              border-top: 1px solid rgba(197,160,89,0.15);
              margin: 2em 0;
            }
            .blog-content pre {
              background: rgba(255,255,255,0.04);
              border: 1px solid rgba(197,160,89,0.1);
              border-radius: 8px;
              padding: 16px;
              overflow-x: auto;
              margin: 1.4em 0;
            }
            .blog-content code {
              color: rgba(255,255,255,0.7);
              font-size: 0.92em;
            }
          `,
        }}
      />

      <article
        style={{
          maxWidth: 800,
          margin: '0 auto',
          padding: '40px 20px 80px',
        }}
      >
        {/* Cover image */}
        {typedPost.cover_image && (
          <div
            style={{
              width: '100%',
              maxHeight: 400,
              overflow: 'hidden',
              borderRadius: 12,
              marginBottom: 36,
            }}
          >
            <img
              src={typedPost.cover_image}
              alt={typedPost.title}
              style={{
                width: '100%',
                height: '100%',
                maxHeight: 400,
                objectFit: 'cover',
                display: 'block',
              }}
            />
          </div>
        )}

        {/* Date */}
        {formattedDate && (
          <time
            style={{
              display: 'block',
              color: 'rgba(255,255,255,0.3)',
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: '0.82rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            {formattedDate}
          </time>
        )}

        {/* Title */}
        <h1
          style={{
            color: '#c5a059',
            fontFamily: "'Rajdhani', sans-serif",
            fontWeight: 700,
            fontSize: '2.6rem',
            lineHeight: 1.2,
            margin: '0 0 20px',
            letterSpacing: '0.02em',
          }}
        >
          {typedPost.title}
        </h1>

        {/* Tags */}
        {typedPost.tags && typedPost.tags.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 36,
            }}
          >
            {typedPost.tags.map((t) => (
              <a
                key={t}
                href={`/blog?tag=${encodeURIComponent(t)}`}
                style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  border: '1px solid rgba(197,160,89,0.2)',
                  borderRadius: 16,
                  color: 'rgba(197,160,89,0.6)',
                  fontFamily: "'Rajdhani', sans-serif",
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                }}
              >
                {t}
              </a>
            ))}
          </div>
        )}

        {/* Divider */}
        <div
          style={{
            borderTop: '1px solid rgba(197,160,89,0.12)',
            marginBottom: 36,
          }}
        />

        {/* Content */}
        <div
          className="blog-content"
          dangerouslySetInnerHTML={{ __html: typedPost.content }}
        />

        {/* Bottom divider */}
        <div
          style={{
            borderTop: '1px solid rgba(197,160,89,0.12)',
            margin: '48px 0 32px',
          }}
        />

        {/* Back link */}
        <a
          href="/blog"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            color: 'rgba(197,160,89,0.5)',
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: '0.9rem',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            textDecoration: 'none',
          }}
        >
          &larr; Back to Blog
        </a>
      </article>
    </>
  );
}
