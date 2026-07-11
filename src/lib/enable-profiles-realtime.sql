-- Enable realtime for profiles table
-- This is needed for wallet/score/silence/paywall changes to be pushed to users instantly
-- Run this ONCE in Supabase SQL Editor

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND tablename = 'profiles'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    END IF;
END $$;
