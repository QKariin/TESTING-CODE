-- ============================================================
-- TIERED CHALLENGE SYSTEM — MIGRATION
-- Run in Supabase SQL Editor AFTER challenges_schema.sql
-- ============================================================

-- 1. New columns on challenges
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS is_tiered BOOLEAN DEFAULT FALSE;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS tiers JSONB;
-- tiers format: [{"days":3,"label":"Bronze","cost":500},{"days":7,"label":"Silver","cost":1000}, ...]

-- 2. New columns on challenge_participants
ALTER TABLE challenge_participants ADD COLUMN IF NOT EXISTS tier_days INTEGER;
ALTER TABLE challenge_participants ADD COLUMN IF NOT EXISTS current_tier TEXT;

-- 3. task_name on windows (may already exist from prior migration)
ALTER TABLE challenge_windows ADD COLUMN IF NOT EXISTS task_name TEXT;

-- 4. Task pool — all available tasks for a challenge
CREATE TABLE IF NOT EXISTS challenge_task_pool (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    task_name TEXT NOT NULL,
    task_description TEXT,
    difficulty TEXT DEFAULT 'medium'
        CHECK (difficulty IN ('easy', 'medium', 'hard')),
    is_milestone BOOLEAN DEFAULT FALSE,
    milestone_day INTEGER,              -- only set if is_milestone = true
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Task assignments — tracks which pool task was given to which user on which day
CREATE TABLE IF NOT EXISTS challenge_task_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL,
    day_number INTEGER NOT NULL,
    task_pool_id UUID REFERENCES challenge_task_pool(id) ON DELETE SET NULL,
    attempt_number INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Expand badge types for tier milestones
ALTER TABLE badges DROP CONSTRAINT IF EXISTS badges_type_check;
ALTER TABLE badges ADD CONSTRAINT badges_type_check
    CHECK (type IN ('participant', 'finisher', 'champion', 'tier_milestone'));
ALTER TABLE badges ADD COLUMN IF NOT EXISTS tier_level TEXT;
-- tier_level values: 'bronze', 'silver', 'gold', 'legendary'

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_task_pool_challenge
    ON challenge_task_pool(challenge_id);
CREATE INDEX IF NOT EXISTS idx_task_pool_milestone
    ON challenge_task_pool(challenge_id, is_milestone, milestone_day);
CREATE INDEX IF NOT EXISTS idx_task_assignments_member
    ON challenge_task_assignments(challenge_id, member_id, attempt_number);
