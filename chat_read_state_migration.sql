-- ============================================================
-- CHAT READ STATE MIGRATION
-- Replaces JSON-blob read tracking with atomic per-user rows
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Dedicated table for admin read state per user
CREATE TABLE IF NOT EXISTS chat_read_state (
    admin_email TEXT NOT NULL,
    member_email TEXT NOT NULL,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (admin_email, member_email)
);

-- 2. Migrate existing read state from profiles.parameters.admin_chat_read
-- This extracts the JSON blob into proper rows
DO $$
DECLARE
    rec RECORD;
    chat_read JSONB;
    email TEXT;
    ts TEXT;
BEGIN
    SELECT parameters->'admin_chat_read' INTO chat_read
    FROM profiles
    WHERE LOWER(member_id) = 'ceo@qkarin.com'
    LIMIT 1;

    IF chat_read IS NOT NULL AND chat_read != 'null'::jsonb THEN
        FOR email, ts IN SELECT * FROM jsonb_each_text(chat_read)
        LOOP
            INSERT INTO chat_read_state (admin_email, member_email, last_read_at)
            VALUES ('ceo@qkarin.com', LOWER(email), ts::timestamptz)
            ON CONFLICT (admin_email, member_email) DO UPDATE SET last_read_at = GREATEST(chat_read_state.last_read_at, ts::timestamptz);
        END LOOP;
    END IF;
END $$;

-- 3. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_chat_read_state_admin ON chat_read_state(admin_email);

-- 4. Materialized view for last message per user (fast unread detection)
-- This replaces the 500-row limit query
CREATE OR REPLACE VIEW chat_last_message AS
SELECT
    member_id,
    MAX(created_at) AS last_message_at
FROM chats
WHERE type IS DISTINCT FROM 'system'
  AND sender_email IS DISTINCT FROM 'system'
  AND (metadata->>'isQueen')::boolean IS DISTINCT FROM true
GROUP BY member_id;

-- ============================================================
-- END OF CHAT READ STATE MIGRATION
-- ============================================================
