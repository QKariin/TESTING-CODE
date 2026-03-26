-- Enable realtime for chats table (needed for Updates feed live updates)
-- Run this in Supabase Dashboard > SQL Editor

-- 1. Add chats table to realtime publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'chats'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
    END IF;
END $$;

-- 2. Full row included in realtime payload
ALTER TABLE public.chats REPLICA IDENTITY FULL;
