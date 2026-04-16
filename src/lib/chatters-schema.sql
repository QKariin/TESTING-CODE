-- Run this in Supabase SQL Editor to create the chatters table
-- and add chatter tracking to the chats table

-- 1. Chatters table
CREATE TABLE IF NOT EXISTS chatters (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT DEFAULT 'Chatter',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Track which chatter sent each message (NULL = queen herself)
ALTER TABLE chats ADD COLUMN IF NOT EXISTS chatter_email TEXT DEFAULT NULL;

-- 3. RLS policies for chatters table (admin-only access)
ALTER TABLE chatters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on chatters"
    ON chatters FOR ALL
    USING (true)
    WITH CHECK (true);
