-- ============================================================
-- LIVESTREAM CHAT — MIGRATION
-- Run in Supabase SQL Editor
-- ============================================================

-- Add channel column to global_messages for stream chat separation
ALTER TABLE global_messages ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'global';

-- Index for fast filtering
CREATE INDEX IF NOT EXISTS idx_global_messages_channel ON global_messages(channel);
