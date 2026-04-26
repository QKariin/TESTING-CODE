-- ============================================================
-- EVERGREEN CHALLENGE SYSTEM MIGRATION
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Extend challenges table
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS is_evergreen BOOLEAN DEFAULT FALSE;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS evergreen_join_cost INTEGER DEFAULT 0;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS evergreen_rejoin_cost INTEGER DEFAULT 1000;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS slot_duration_minutes INTEGER DEFAULT 360; -- default = full 6hr slot

-- Make start_date/end_date nullable for evergreen (they're per-participant)
ALTER TABLE challenges ALTER COLUMN start_date DROP NOT NULL;
ALTER TABLE challenges ALTER COLUMN end_date DROP NOT NULL;

-- 2. Extend challenge_windows — personal windows for evergreen
-- NULL = shared/classic window, non-NULL = personal window for that user
ALTER TABLE challenge_windows ADD COLUMN IF NOT EXISTS member_id TEXT;
ALTER TABLE challenge_windows ALTER COLUMN opens_at DROP NOT NULL;
ALTER TABLE challenge_windows ALTER COLUMN closes_at DROP NOT NULL;

-- Index for fast personal window lookups
CREATE INDEX IF NOT EXISTS idx_challenge_windows_member
    ON challenge_windows(challenge_id, member_id, day_number);

-- 3. Extend challenge_participants — personal timeline data
ALTER TABLE challenge_participants ADD COLUMN IF NOT EXISTS timezone TEXT;
ALTER TABLE challenge_participants ADD COLUMN IF NOT EXISTS chosen_slots TEXT[];
ALTER TABLE challenge_participants ADD COLUMN IF NOT EXISTS personal_start TIMESTAMPTZ;
ALTER TABLE challenge_participants ADD COLUMN IF NOT EXISTS personal_end TIMESTAMPTZ;
ALTER TABLE challenge_participants ADD COLUMN IF NOT EXISTS rejoin_count INTEGER DEFAULT 0;
ALTER TABLE challenge_participants ADD COLUMN IF NOT EXISTS coins_paid INTEGER DEFAULT 0;

-- 4. Add timezone to profiles if not exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone TEXT;

-- ============================================================
-- END OF EVERGREEN MIGRATION
-- ============================================================
