-- ============================================================
-- VIDEO CHALLENGE SYSTEM SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. VIDEO CHALLENGES
CREATE TABLE IF NOT EXISTS video_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    topic TEXT,                            -- challenge description/topic
    items_needed TEXT,                     -- what items users need to prepare
    tier_video_url TEXT,                   -- preview/intro video everyone can see
    image_url TEXT,                        -- banner image
    status TEXT DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'ended')),
    window_minutes INTEGER NOT NULL DEFAULT 60,
    scheduling_mode TEXT DEFAULT 'scheduled'
        CHECK (scheduling_mode IN ('scheduled', 'on_request')),
    duration_days INTEGER DEFAULT 7,       -- for scheduled: total challenge duration
    min_tier TEXT,                          -- minimum hierarchy tier (null = all allowed)
    join_cost INTEGER DEFAULT 0,
    rejoin_cost INTEGER DEFAULT 0,
    points_per_task INTEGER DEFAULT 100,
    theme TEXT DEFAULT 'default',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. VIDEO CHALLENGE TASKS (fixed order, each has instruction video)
CREATE TABLE IF NOT EXISTS video_challenge_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID NOT NULL REFERENCES video_challenges(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,             -- 1-indexed order
    video_url TEXT NOT NULL,               -- instruction video URL
    title TEXT,                            -- optional task title
    description TEXT,                      -- optional text description
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(challenge_id, position)
);

-- 3. VIDEO CHALLENGE PARTICIPANTS
CREATE TABLE IF NOT EXISTS video_challenge_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID NOT NULL REFERENCES video_challenges(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL,                -- email
    status TEXT DEFAULT 'active'
        CHECK (status IN ('active', 'kicked', 'completed')),
    current_task INTEGER DEFAULT 1,         -- which task position they're on (1-indexed)
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    kicked_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    rejoin_count INTEGER DEFAULT 0,
    total_points INTEGER DEFAULT 0,
    UNIQUE(challenge_id, member_id)
);

-- 4. VIDEO CHALLENGE SUBMISSIONS (window + proof in one row)
CREATE TABLE IF NOT EXISTS video_challenge_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID NOT NULL REFERENCES video_challenges(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL,
    task_id UUID NOT NULL REFERENCES video_challenge_tasks(id),
    task_position INTEGER NOT NULL,
    window_opens_at TIMESTAMPTZ NOT NULL,
    window_closes_at TIMESTAMPTZ NOT NULL,
    proof_url TEXT,
    proof_type TEXT,                        -- 'image' or 'video'
    thumbnail_url TEXT,
    submitted_at TIMESTAMPTZ,
    status TEXT DEFAULT 'active'
        CHECK (status IN ('active', 'pending', 'approved', 'rejected', 'expired')),
    reviewed_at TIMESTAMPTZ,
    points_awarded INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_vc_tasks_challenge
    ON video_challenge_tasks(challenge_id, position);
CREATE INDEX IF NOT EXISTS idx_vc_participants_challenge
    ON video_challenge_participants(challenge_id, status);
CREATE INDEX IF NOT EXISTS idx_vc_participants_member
    ON video_challenge_participants(member_id);
CREATE INDEX IF NOT EXISTS idx_vc_submissions_challenge
    ON video_challenge_submissions(challenge_id, member_id, task_position);
CREATE INDEX IF NOT EXISTS idx_vc_submissions_active
    ON video_challenge_submissions(status, window_closes_at)
    WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_vc_submissions_pending
    ON video_challenge_submissions(status)
    WHERE status = 'pending';
