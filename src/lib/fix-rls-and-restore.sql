-- =====================================================
-- STEP 1: Check how many profiles have real data
-- =====================================================
SELECT count(*) as total_profiles FROM profiles;
SELECT count(*) as profiles_with_data FROM profiles WHERE score > 0 OR wallet > 0;

-- Check pr.finsko@gmail.com specifically
SELECT id, member_id, name, score, wallet, hierarchy 
FROM profiles WHERE member_id = 'pr.finsko@gmail.com';

-- =====================================================
-- STEP 2: Fix RLS policy to allow member_id matching
-- This lets users read their profile row even if the UUID 
-- doesn't match (e.g. from migration)
-- =====================================================
DROP POLICY IF EXISTS "Users can see own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can see own profile" ON profiles
  FOR SELECT USING (
    auth.uid() = id 
    OR auth.jwt() ->> 'email' = member_id
  );

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (
    auth.uid() = id 
    OR auth.jwt() ->> 'email' = member_id
  );

-- =====================================================
-- STEP 3: Verify RLS policies are set
-- =====================================================
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'profiles';
