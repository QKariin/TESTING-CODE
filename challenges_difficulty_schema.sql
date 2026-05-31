-- ============================================================
-- DIFFICULTY & REWARDS SYSTEM — MIGRATION
-- Run in Supabase SQL Editor AFTER challenges_tiered_schema.sql
-- ============================================================

-- 1. Daily task (morning photo check-in) stored on the challenge
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS daily_task TEXT;

-- 2. Perfect day tracking + coins earned on participants
ALTER TABLE challenge_participants ADD COLUMN IF NOT EXISTS perfect_days INTEGER DEFAULT 0;
ALTER TABLE challenge_participants ADD COLUMN IF NOT EXISTS coins_earned INTEGER DEFAULT 0;

-- 3. Expand difficulty values to include soft/strict/brutal aliases
-- (keeping easy/medium/hard for backward compat, code maps display names)

-- NOTE: The tiers JSONB on challenges will now use this format per tier:
-- {
--   "days": 7, "label": "Silver",
--   "cost_soft": 4500, "cost_strict": 5000, "cost_brutal": 6500,
--   "daily_soft": 100, "daily_strict": 150, "daily_brutal": 200,
--   "finish_soft": 500, "finish_strict": 750, "finish_brutal": 1000
-- }
-- No schema change needed — JSONB is flexible.
