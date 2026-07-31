-- Blog posts table for SEO content
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS blog_posts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    slug text UNIQUE NOT NULL,
    title text NOT NULL,
    excerpt text,
    content text NOT NULL,
    cover_image text,
    tags text[] DEFAULT '{}',
    meta_description text,
    meta_keywords text,
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    published_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Index for fast slug lookups
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts (slug);
-- Index for listing published posts
CREATE INDEX IF NOT EXISTS idx_blog_posts_status_published ON blog_posts (status, published_at DESC);
-- GIN index for tag filtering
CREATE INDEX IF NOT EXISTS idx_blog_posts_tags ON blog_posts USING GIN (tags);

-- RLS
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Public read for published posts
DO $$ BEGIN
    DROP POLICY IF EXISTS "Public can read published blog posts" ON blog_posts;
    CREATE POLICY "Public can read published blog posts"
        ON blog_posts FOR SELECT
        USING (status = 'published');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Service role full access (for dashboard CRUD)
DO $$ BEGIN
    DROP POLICY IF EXISTS "Service role full access to blog posts" ON blog_posts;
    CREATE POLICY "Service role full access to blog posts"
        ON blog_posts FOR ALL
        USING (auth.role() = 'service_role');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
