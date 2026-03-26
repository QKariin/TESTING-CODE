-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/ntrerrxudvgbjyscmdvh/sql

-- 1. Extend social_feed with new columns
ALTER TABLE social_feed ADD COLUMN IF NOT EXISTS min_rank    text    NOT NULL DEFAULT 'Hall Boy';
ALTER TABLE social_feed ADD COLUMN IF NOT EXISTS price       integer NOT NULL DEFAULT 0;
ALTER TABLE social_feed ADD COLUMN IF NOT EXISTS likes       integer NOT NULL DEFAULT 0;
ALTER TABLE social_feed ADD COLUMN IF NOT EXISTS media_type  text    NOT NULL DEFAULT 'text';
ALTER TABLE social_feed ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;

-- 2. Post unlocks (tracks who paid to see locked content)
CREATE TABLE IF NOT EXISTS post_unlocks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid        NOT NULL REFERENCES social_feed(id) ON DELETE CASCADE,
  member_id   text        NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, member_id)
);
CREATE INDEX IF NOT EXISTS post_unlocks_member_idx ON post_unlocks (member_id);
CREATE INDEX IF NOT EXISTS post_unlocks_post_idx   ON post_unlocks (post_id);

-- 3. Post likes
CREATE TABLE IF NOT EXISTS post_likes (
  id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id   uuid        NOT NULL REFERENCES social_feed(id) ON DELETE CASCADE,
  member_id text        NOT NULL,
  liked_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, member_id)
);
CREATE INDEX IF NOT EXISTS post_likes_post_idx ON post_likes (post_id);

-- 4. Atomic like counter functions
CREATE OR REPLACE FUNCTION increment_post_likes(post_id uuid)
RETURNS void LANGUAGE sql AS $$
  UPDATE social_feed SET likes = likes + 1 WHERE id = post_id;
$$;

CREATE OR REPLACE FUNCTION decrement_post_likes(post_id uuid)
RETURNS void LANGUAGE sql AS $$
  UPDATE social_feed SET likes = GREATEST(likes - 1, 0) WHERE id = post_id;
$$;
