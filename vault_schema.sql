-- ============================================================
-- VAULT (KEYHOLDER) SYSTEM SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. VAULT SESSIONS
-- One row per lock period. Created when member buys keyholder access.
CREATE TABLE IF NOT EXISTS vault_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'weekly'
        CHECK (tier IN ('weekly', 'biweekly', 'monthly', 'quarterly')),
    lock_days INTEGER NOT NULL,                     -- 7, 14, 30, 90
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'completed', 'released_early')),
    released_at TIMESTAMPTZ,                        -- null until released or expired
    best_streak INTEGER DEFAULT 0,                  -- longest consecutive perfect days
    current_streak INTEGER DEFAULT 0,
    total_perfect_days INTEGER DEFAULT 0,
    total_failed_days INTEGER DEFAULT 0,
    penalty_hours INTEGER DEFAULT 0,                -- total hours added via adjustments
    seal_earned TEXT
        CHECK (seal_earned IN ('bronze', 'silver', 'gold', 'diamond', NULL)),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================

-- 2. VAULT DAILY
-- One row per day per session. Tracks today's orders and completion.
CREATE TABLE IF NOT EXISTS vault_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES vault_sessions(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL,
    day_number INTEGER NOT NULL,                    -- 1, 2, 3... within this lock
    date DATE NOT NULL,                             -- calendar date (UTC)
    orders JSONB NOT NULL DEFAULT '[]',             -- [{type:'kneel',target:8,done:0},{type:'spin',target:1,done:0},...]
    orders_completed INTEGER DEFAULT 0,             -- how many orders finished
    orders_total INTEGER DEFAULT 0,                 -- how many orders assigned
    perfect BOOLEAN DEFAULT FALSE,                  -- all orders done = true
    reward_claimed BOOLEAN DEFAULT FALSE,           -- 1h freedom claimed for this day
    streak_at_end INTEGER DEFAULT 0,                -- running streak after this day
    submissions JSONB DEFAULT '[]',                 -- [{orderIdx,text,photoUrl,videoUrl,submittedAt,status,comment}]
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, day_number),
    UNIQUE(session_id, date)
);

-- ============================================================

-- 3. VAULT TRIALS
-- Daily writing/proof submissions from locked members.
CREATE TABLE IF NOT EXISTS vault_trials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES vault_sessions(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL,
    day_number INTEGER NOT NULL,
    date DATE NOT NULL,
    prompt TEXT NOT NULL,
    response TEXT,
    proof_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'submitted', 'approved', 'rejected')),
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    queen_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, date)
);

-- ============================================================

-- 4. VAULT BEGS
-- Beg for release requests. Queen approves/denies from dashboard.
CREATE TABLE IF NOT EXISTS vault_begs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES vault_sessions(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'denied', 'granted')),
    queen_response TEXT,
    cost_coins INTEGER DEFAULT 0,
    cost_merit INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================

-- 5. VAULT TRIBUTES
-- Coin tributes from locked members to Queen.
CREATE TABLE IF NOT EXISTS vault_tributes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES vault_sessions(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================

-- 6. VAULT SPINS
-- Wheel spin results, one per day max.
CREATE TABLE IF NOT EXISTS vault_spins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES vault_sessions(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL,
    date DATE NOT NULL,
    result_text TEXT NOT NULL,
    result_type TEXT NOT NULL
        CHECK (result_type IN ('punishment', 'reward', 'challenge', 'task', 'nothing')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, date)
);

-- ============================================================

-- 7. VAULT LEADERBOARD (cached view)
CREATE TABLE IF NOT EXISTS vault_leaderboard (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id TEXT NOT NULL,
    name TEXT,
    total_days_locked INTEGER DEFAULT 0,
    total_perfect_days INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    total_tributes INTEGER DEFAULT 0,
    total_begs_denied INTEGER DEFAULT 0,
    seals JSONB DEFAULT '[]',
    rank INTEGER,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(member_id)
);

-- ============================================================

-- 8. VAULT ATTENTION
-- Tracks every attention request: task assigned, whether completed.
CREATE TABLE IF NOT EXISTS vault_attention (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES vault_sessions(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    task_type TEXT NOT NULL
        CHECK (task_type IN ('spin', 'tribute', 'proof', 'coinflip', 'patience', 'confess')),
    task_label TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    result TEXT,
    skipped BOOLEAN DEFAULT FALSE,
    next_allowed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================

-- 9. VAULT ADJUSTMENTS
-- Time added or removed from a lock sentence, with reason.
CREATE TABLE IF NOT EXISTS vault_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES vault_sessions(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL,
    hours INTEGER NOT NULL,                          -- positive = added, negative = removed
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_vault_sessions_member_active
    ON vault_sessions(member_id, status) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_vault_daily_session
    ON vault_daily(session_id, day_number);

CREATE INDEX IF NOT EXISTS idx_vault_daily_member_date
    ON vault_daily(member_id, date);

CREATE INDEX IF NOT EXISTS idx_vault_trials_session
    ON vault_trials(session_id, date);

CREATE INDEX IF NOT EXISTS idx_vault_trials_pending
    ON vault_trials(status) WHERE status = 'submitted';

CREATE INDEX IF NOT EXISTS idx_vault_begs_pending
    ON vault_begs(status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_vault_tributes_session
    ON vault_tributes(session_id);

CREATE INDEX IF NOT EXISTS idx_vault_leaderboard_rank
    ON vault_leaderboard(rank);

CREATE INDEX IF NOT EXISTS idx_vault_attention_member
    ON vault_attention(member_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_vault_attention_pending
    ON vault_attention(completed) WHERE completed = FALSE;

CREATE INDEX IF NOT EXISTS idx_vault_adjustments_session
    ON vault_adjustments(session_id, created_at);

-- ============================================================
-- END OF VAULT SYSTEM SCHEMA
-- ============================================================
