-- Fix realtime for global_messages table
-- Run this in Supabase Dashboard > SQL Editor

-- 1. Enable Realtime publication (so Supabase broadcasts INSERTs)
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

-- 2. Set REPLICA IDENTITY FULL so the full row is included in the realtime payload
ALTER TABLE public.global_messages REPLICA IDENTITY FULL;

-- 3. Allow authenticated users to read global_messages
--    (required so realtime payload.new is not empty when using anon/auth key)
ALTER TABLE public.global_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read global messages" ON public.global_messages;
DROP POLICY IF EXISTS "Anyone can read global messages" ON public.global_messages;
CREATE POLICY "Anyone can read global messages"
ON public.global_messages FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert global messages" ON public.global_messages;
CREATE POLICY "Authenticated users can insert global messages"
ON public.global_messages FOR INSERT
WITH CHECK (auth.role() = 'authenticated');
