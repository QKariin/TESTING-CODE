-- Enable Realtime for global_messages table
-- Run this in Supabase Dashboard > SQL Editor

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'global_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.global_messages;
    END IF;
END $$;
