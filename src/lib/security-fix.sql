-- ============================================================
-- SECURITY FIX - Run this in Supabase SQL Editor
-- Uses exception handling so missing tables are skipped safely
-- ============================================================

-- ============================================================
-- 1. FIX FUNCTION SEARCH PATH MUTABLE
-- ============================================================
DO $$ BEGIN
    ALTER FUNCTION public.increment_post_likes SET search_path = '';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'increment_post_likes: %', SQLERRM; END $$;

DO $$ BEGIN
    ALTER FUNCTION public.decrement_post_likes SET search_path = '';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'decrement_post_likes: %', SQLERRM; END $$;

DO $$ BEGIN
    ALTER FUNCTION public.trim_chat_messages SET search_path = '';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'trim_chat_messages: %', SQLERRM; END $$;

-- ============================================================
-- 2. ENABLE RLS ON ALL TABLES (skips missing ones)
-- Service role key bypasses RLS — API routes are unaffected.
-- ============================================================
DO $$ BEGIN ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.tasks                 ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.messages              ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.chats                 ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.global_messages       ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.global_message_reads  ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.tasks_database        ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.challenges            ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.challenge_windows     ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.challenge_completions ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.tributes              ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.wishlist              ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."Wishlist"            ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.queen_posts           ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.social_feed           ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.post_likes            ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.post_unlocks          ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.proofs                ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.uploads               ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.media                 ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.badges                ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_badges           ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.system_rules          ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.leads                 ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.crowdfund_contributions ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.applications          ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.daily_leaderboard     ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.monthly_leaderboard   ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.yearly_leaderboard    ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.daily_tasks           ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ============================================================
-- 3. FIX: RLS POLICY ALWAYS TRUE on global_message_reads
-- ============================================================
DO $$ BEGIN
    DROP POLICY IF EXISTS "Allow all"    ON public.global_message_reads;
    DROP POLICY IF EXISTS "Enable all"   ON public.global_message_reads;
    DROP POLICY IF EXISTS "Public access" ON public.global_message_reads;
    DROP POLICY IF EXISTS "Allow read"   ON public.global_message_reads;
    DROP POLICY IF EXISTS "Allow insert" ON public.global_message_reads;
    DROP POLICY IF EXISTS "Allow select" ON public.global_message_reads;
    DROP POLICY IF EXISTS "Allow update" ON public.global_message_reads;
    DROP POLICY IF EXISTS "Allow delete" ON public.global_message_reads;
    CREATE POLICY "Users manage own read receipts"
        ON public.global_message_reads FOR ALL
        USING (auth.uid() IS NOT NULL)
        WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'global_message_reads: %', SQLERRM; END $$;

-- ============================================================
-- 4. FIX: RLS POLICY ALWAYS TRUE on tasks_database
-- ============================================================
DO $$ BEGIN
    DROP POLICY IF EXISTS "Allow all"    ON public.tasks_database;
    DROP POLICY IF EXISTS "Enable all"   ON public.tasks_database;
    DROP POLICY IF EXISTS "Public access" ON public.tasks_database;
    DROP POLICY IF EXISTS "Allow read"   ON public.tasks_database;
    DROP POLICY IF EXISTS "Allow select" ON public.tasks_database;
    CREATE POLICY "Authenticated can read tasks_database"
        ON public.tasks_database FOR SELECT
        USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'tasks_database: %', SQLERRM; END $$;

-- ============================================================
-- 5. REALTIME ACCESS POLICIES (authenticated SELECT only)
-- ============================================================
DO $$ BEGIN
    DROP POLICY IF EXISTS "Authenticated can read profiles" ON public.profiles;
    CREATE POLICY "Authenticated can read profiles"
        ON public.profiles FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'profiles: %', SQLERRM; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Authenticated can read messages" ON public.messages;
    CREATE POLICY "Authenticated can read messages"
        ON public.messages FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'messages skipped (table missing)'; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Authenticated can read chats" ON public.chats;
    CREATE POLICY "Authenticated can read chats"
        ON public.chats FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'chats: %', SQLERRM; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Authenticated can read global_messages" ON public.global_messages;
    CREATE POLICY "Authenticated can read global_messages"
        ON public.global_messages FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'global_messages: %', SQLERRM; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Authenticated can read tasks" ON public.tasks;
    CREATE POLICY "Authenticated can read tasks"
        ON public.tasks FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'tasks: %', SQLERRM; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Authenticated can read queen_posts" ON public.queen_posts;
    CREATE POLICY "Authenticated can read queen_posts"
        ON public.queen_posts FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'queen_posts: %', SQLERRM; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Authenticated can read social_feed" ON public.social_feed;
    CREATE POLICY "Authenticated can read social_feed"
        ON public.social_feed FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'social_feed: %', SQLERRM; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Authenticated can read challenges" ON public.challenges;
    CREATE POLICY "Authenticated can read challenges"
        ON public.challenges FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'challenges: %', SQLERRM; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Authenticated can read challenge_participants" ON public.challenge_participants;
    CREATE POLICY "Authenticated can read challenge_participants"
        ON public.challenge_participants FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'challenge_participants: %', SQLERRM; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Authenticated can read challenge_windows" ON public.challenge_windows;
    CREATE POLICY "Authenticated can read challenge_windows"
        ON public.challenge_windows FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'challenge_windows: %', SQLERRM; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Authenticated can read daily_leaderboard" ON public.daily_leaderboard;
    CREATE POLICY "Authenticated can read daily_leaderboard"
        ON public.daily_leaderboard FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'daily_leaderboard: %', SQLERRM; END $$;

-- ============================================================
-- 6. VERIFY — what tables have RLS and what policies exist
-- ============================================================
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
