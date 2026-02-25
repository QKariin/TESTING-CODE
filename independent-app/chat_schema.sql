-- 1. Create the chats table
CREATE TABLE IF NOT EXISTS public.chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id TEXT NOT NULL REFERENCES public.profiles(member_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'text', -- 'text', 'photo', 'video', 'wishlist'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Enable Row Level Security
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies

-- Policy: Queen can read all messages
CREATE POLICY "Queen can read all chats" 
ON public.chats 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE member_id = auth.email() AND (hierarchy = 'Queen' OR hierarchy = 'Secretary')
    )
);

-- Policy: Slaves can read their own messages
CREATE POLICY "Slaves can read their own messages" 
ON public.chats 
FOR SELECT 
USING (
    member_id = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Policy: Insert permission
CREATE POLICY "Authenticated users can send messages" 
ON public.chats 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- 4. Enable Realtime
-- Use ON CONFLICT or check if already exists to avoid errors on re-run
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
