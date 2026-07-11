-- VAULT LOCK APPLICATION MIGRATION
-- Run this ONCE in Supabase SQL editor
-- Fixes all constraints for the lock application flow

-- 1. Add new columns
ALTER TABLE vault_sessions ADD COLUMN IF NOT EXISTS coins_paid integer DEFAULT 0;
ALTER TABLE vault_sessions ADD COLUMN IF NOT EXISTS request_message text;
ALTER TABLE vault_sessions ADD COLUMN IF NOT EXISTS scheduled_start timestamptz;
ALTER TABLE vault_sessions ADD COLUMN IF NOT EXISTS requested_at timestamptz DEFAULT now();
ALTER TABLE vault_sessions ADD COLUMN IF NOT EXISTS video_proof_url text;
ALTER TABLE vault_sessions ADD COLUMN IF NOT EXISTS video_submitted_at timestamptz;

-- 2. Drop NOT NULL on expires_at (pending sessions don't have one yet)
ALTER TABLE vault_sessions ALTER COLUMN expires_at DROP NOT NULL;

-- 3. Drop NOT NULL on started_at (pending sessions haven't started)
ALTER TABLE vault_sessions ALTER COLUMN started_at DROP NOT NULL;

-- 4. Update status CHECK to include new statuses
ALTER TABLE vault_sessions DROP CONSTRAINT IF EXISTS vault_sessions_status_check;
ALTER TABLE vault_sessions ADD CONSTRAINT vault_sessions_status_check
    CHECK (status IN ('active', 'completed', 'released_early', 'pending', 'scheduled', 'denied', 'awaiting_video'));

-- 5. Update tier CHECK to allow coin-based tiers
ALTER TABLE vault_sessions DROP CONSTRAINT IF EXISTS vault_sessions_tier_check;
ALTER TABLE vault_sessions ADD CONSTRAINT vault_sessions_tier_check
    CHECK (tier IN ('weekly', 'biweekly', 'monthly', 'quarterly', '7d-coins', '30d-coins', '90d-coins'));

-- 6. Enable realtime for vault_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE vault_sessions;
