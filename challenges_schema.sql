-- ============================================================
-- CHALLENGE SYSTEM SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. CHALLENGES
-- One row per challenge (active, past, or template)
CREATE TABLE IF NOT EXISTS challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    theme TEXT DEFAULT 'default',          -- color/icon theme slug
    description TEXT,
    status TEXT DEFAULT 'draft'            -- 'draft' | 'active' | 'ended'
        CHECK (status IN ('draft', 'active', 'ended')),
    is_template BOOLEAN DEFAULT FALSE,     -- can be reused as a template
    duration_days INTEGER NOT NULL,        -- how many days the challenge runs
    tasks_per_day INTEGER NOT NULL,        -- how many windows open per day
    window_minutes INTEGER NOT NULL,       -- how long each window stays open
    points_per_completion INTEGER DEFAULT 1, -- points per task completed
    first_place_points INTEGER DEFAULT 10,
    second_place_points INTEGER DEFAULT 7,
    third_place_points INTEGER DEFAULT 5,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,                  -- computed: start_date + duration_days
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================

-- 2. CHALLENGE WINDOWS
-- Each scheduled task slot — auto-generated when challenge starts
-- verification_code is the same for all users on this window
CREATE TABLE IF NOT EXISTS challenge_windows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL,           -- 1, 2, 3...
    window_number INTEGER NOT NULL,        -- 1, 2, 3 within that day
    opens_at TIMESTAMPTZ NOT NULL,
    closes_at TIMESTAMPTZ NOT NULL,        -- opens_at + window_minutes
    verification_code INTEGER NOT NULL,    -- random code all users must handwrite in proof photo
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================

-- 3. CHALLENGE PARTICIPANTS
-- One row per user per challenge
CREATE TABLE IF NOT EXISTS challenge_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL REFERENCES profiles(member_id) ON DELETE CASCADE,
    status TEXT DEFAULT 'active'           -- 'active' | 'eliminated' | 'finished' | 'champion'
        CHECK (status IN ('active', 'eliminated', 'finished', 'champion')),
    eliminated_on_window_id UUID REFERENCES challenge_windows(id), -- which window eliminated them
    final_rank INTEGER,                    -- 1, 2, 3... set at challenge end
    challenge_points_earned INTEGER DEFAULT 0, -- 10 / 7 / 5 or 0
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    eliminated_at TIMESTAMPTZ,
    UNIQUE(challenge_id, member_id)        -- can only join once per challenge
);

-- ============================================================

-- 4. CHALLENGE COMPLETIONS
-- One row per user per window when they submit proof
CREATE TABLE IF NOT EXISTS challenge_completions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    window_id UUID NOT NULL REFERENCES challenge_windows(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL REFERENCES profiles(member_id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    response_time_seconds INTEGER,         -- completed_at - window opens_at (for leaderboard tiebreaker)
    proof_url TEXT,                        -- photo/media proof URL
    verified BOOLEAN DEFAULT FALSE,        -- you manually verify the code is visible
    verified_at TIMESTAMPTZ,
    verification_note TEXT,                -- optional rejection note from admin
    UNIQUE(window_id, member_id)           -- one submission per window per user
);

-- ============================================================

-- 5. BADGES
-- Badge definitions — one per challenge type/tier
CREATE TABLE IF NOT EXISTS badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID REFERENCES challenges(id) ON DELETE SET NULL, -- null = global badge
    type TEXT NOT NULL                     -- 'participant' | 'finisher' | 'champion'
        CHECK (type IN ('participant', 'finisher', 'champion')),
    name TEXT NOT NULL,                    -- e.g. "Edge Week Champion"
    description TEXT,
    image_url TEXT,
    rarity TEXT DEFAULT 'common'           -- 'common' | 'rare' | 'legendary'
        CHECK (rarity IN ('common', 'rare', 'legendary')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================

-- 6. USER BADGES
-- Permanent record of which user holds which badge
CREATE TABLE IF NOT EXISTS user_badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id TEXT NOT NULL REFERENCES profiles(member_id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES challenges(id) ON DELETE SET NULL, -- which run earned it
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,        -- false if they failed and lost finisher badge
    UNIQUE(member_id, badge_id, challenge_id) -- one of each badge per challenge run
);

-- ============================================================
-- INDEXES (for fast queries)
-- ============================================================

-- Fast lookup of all windows for a challenge (ordered for display)
CREATE INDEX IF NOT EXISTS idx_challenge_windows_challenge_id
    ON challenge_windows(challenge_id, day_number, window_number);

-- Fast lookup of open windows right now
CREATE INDEX IF NOT EXISTS idx_challenge_windows_opens_at
    ON challenge_windows(opens_at, closes_at);

-- Fast lookup of all participants in a challenge
CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge_id
    ON challenge_participants(challenge_id, status);

-- Fast lookup of a user's challenges
CREATE INDEX IF NOT EXISTS idx_challenge_participants_member_id
    ON challenge_participants(member_id);

-- Fast lookup of completions per window (for elimination check)
CREATE INDEX IF NOT EXISTS idx_challenge_completions_window_id
    ON challenge_completions(window_id, member_id);

-- Fast lookup of all completions by a user
CREATE INDEX IF NOT EXISTS idx_challenge_completions_member_id
    ON challenge_completions(member_id, challenge_id);

-- Fast lookup of user badges for profile display
CREATE INDEX IF NOT EXISTS idx_user_badges_member_id
    ON user_badges(member_id);

-- ============================================================
-- END OF CHALLENGE SYSTEM SCHEMA
-- ============================================================
