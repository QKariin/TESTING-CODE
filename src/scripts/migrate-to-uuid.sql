-- ==========================================
-- UUID MIGRATION SCRIPT (Option A)
-- ==========================================
-- This script safely migrates the system from email strings ('member_id')
-- to Supabase UUIDs ('profile_id') for robust relational integrity.

-- 1. CHATS TABLE MIGRATION
-- Add temporary UUID columns
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Backfill profile_id using member_id (email)
UPDATE public.chats c
SET profile_id = p.id
FROM public.profiles p
WHERE c.member_id = p.member_id;

-- Backfill sender_id using sender_email (email)
UPDATE public.chats c
SET sender_id = p.id
FROM public.profiles p
WHERE c.sender_email = p.member_id;

-- If there are rows where sender_email was a UUID (the bug), map those too
UPDATE public.chats c
SET sender_id = p.id
FROM public.profiles p
WHERE c.sender_email = p.id::text;

-- Make profile_id NOT NULL and Swap Columns
ALTER TABLE public.chats ALTER COLUMN profile_id SET NOT NULL;

-- 2. GLOBAL MESSAGES MIGRATION
ALTER TABLE public.global_messages ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Backfill sender_id using sender_email
UPDATE public.global_messages g
SET sender_id = p.id
FROM public.profiles p
WHERE g.sender_email = p.member_id;

-- Fix the bug where sender_email logged the UUID directly
UPDATE public.global_messages g
SET sender_id = p.id
FROM public.profiles p
WHERE g.sender_email = p.id::text;

ALTER TABLE public.global_messages ALTER COLUMN sender_id SET NOT NULL;

-- 3. DROP OLD STRING COLUMNS (After ensuring frontend is updated!!!)
-- NOTE: Do NOT run this part until the codebase is fully refactored.
-- ALTER TABLE public.chats DROP COLUMN member_id;
-- ALTER TABLE public.chats DROP COLUMN sender_email;
-- ALTER TABLE public.global_messages DROP COLUMN sender_email;

-- 4. UPDATE RLS POLICIES FOR CHATS
DROP POLICY IF EXISTS "Queen can read all chats" ON public.chats;
DROP POLICY IF EXISTS "Slaves can read their own messages" ON public.chats;
DROP POLICY IF EXISTS "Users can send messages" ON public.chats;

CREATE POLICY "Queen can read all chats" 
ON public.chats FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND (hierarchy = 'Queen' OR hierarchy = 'Secretary')
    )
);

CREATE POLICY "Slaves can read their own messages" 
ON public.chats FOR SELECT 
USING (
    profile_id = auth.uid()
);

CREATE POLICY "Users can send messages" 
ON public.chats FOR INSERT 
WITH CHECK (
    (auth.role() = 'authenticated') AND 
    (
        (profile_id = auth.uid() AND sender_id = auth.uid()) -- Slave to self
        OR
        EXISTS ( -- Queen to slave
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND (hierarchy = 'Queen' OR hierarchy = 'Secretary')
        )
    )
);

-- ==========================================
-- END OF MIGRATION
-- ==========================================
