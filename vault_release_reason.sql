-- Add release_reason column to vault_sessions
-- Run this in Supabase SQL Editor
ALTER TABLE vault_sessions ADD COLUMN IF NOT EXISTS release_reason TEXT;
