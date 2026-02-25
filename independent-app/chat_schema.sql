-- 1. Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id TEXT NOT NULL, -- The Slave's ID (Conversation Context)
    sender_email TEXT NOT NULL, -- Who actually sent the message
    content TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'text', -- 'text', 'photo', 'video', 'wishlist'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 1b. Fix for existing tables: Ensure sender_email column exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chats' AND column_name='sender_email') THEN
        ALTER TABLE public.chats ADD COLUMN sender_email TEXT;
        -- Default existing messages to be from the member_id if we want
        UPDATE public.chats SET sender_email = member_id WHERE sender_email IS NULL;
        ALTER TABLE public.chats ALTER COLUMN sender_email SET NOT NULL;
    END IF;
END $$;

-- 2. Enable Row Level Security
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

-- 3. DROP OLD POLICIES (To avoid "already exists" errors)
DROP POLICY IF EXISTS "Queen can read all chats" ON public.chats;
DROP POLICY IF EXISTS "Slaves can read their own messages" ON public.chats;
DROP POLICY IF EXISTS "Authenticated users can send messages" ON public.chats;

-- 4. Create New FIXED RLS Policies
-- Queen/Secretary can read all chats
CREATE POLICY "Queen can read all chats" 
ON public.chats FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE member_id = (auth.jwt() ->> 'email') 
        AND (hierarchy = 'Queen' OR hierarchy = 'Secretary')
    )
);

-- Slaves can read messages in their own conversation
CREATE POLICY "Slaves can read their own messages" 
ON public.chats FOR SELECT 
USING (
    member_id = (auth.jwt() ->> 'email')
);

-- Insert permission
-- Both Slave (to themselves) and Queen (to anyone) can insert
CREATE POLICY "Users can send messages" 
ON public.chats FOR INSERT 
WITH CHECK (
    (auth.role() = 'authenticated') AND 
    (
        -- Is the Slave sending to themselves?
        (member_id = (auth.jwt() ->> 'email') AND sender_email = (auth.jwt() ->> 'email'))
        OR
        -- Is the Queen sending to a Slave?
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE member_id = (auth.jwt() ->> 'email') 
            AND (hierarchy = 'Queen' OR hierarchy = 'Secretary')
        )
    )
);

-- 5. Enable Realtime
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
