-- Add missing columns to vault_sessions
-- Run this in Supabase SQL Editor
ALTER TABLE vault_sessions ADD COLUMN IF NOT EXISTS release_reason TEXT;
ALTER TABLE vault_sessions ADD COLUMN IF NOT EXISTS video_reviewed BOOLEAN DEFAULT FALSE;
ALTER TABLE vault_sessions ADD COLUMN IF NOT EXISTS video_reviewed_at TIMESTAMPTZ;
ALTER TABLE vault_sessions ADD COLUMN IF NOT EXISTS video_thumb_url TEXT;
