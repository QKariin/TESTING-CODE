-- =====================================================
-- MERGE FIX: Copy migration data INTO auth-linked rows
-- Run this in Supabase SQL Editor
-- 
-- The problem: migration created duplicate rows with random UUIDs.
-- Auth-linked rows (created by login trigger) have the real auth UUID
-- but zero data. The migration rows have real data but wrong UUID.
-- This script copies the real data into the auth-linked rows.
-- =====================================================

-- Step 1: Update auth-linked rows (id = real auth UUID) with data 
-- from migration rows (matched by member_id/email)
UPDATE profiles AS auth_row
SET
  name         = mig.name,
  hierarchy    = mig.hierarchy,
  score        = mig.score,
  wallet       = mig.wallet,
  strike_count = mig.strike_count,
  avatar_url   = COALESCE(mig.avatar_url, auth_row.avatar_url),
  parameters   = mig.parameters
FROM profiles AS mig
WHERE 
  auth_row.member_id = mig.member_id   -- same email
  AND auth_row.id != mig.id            -- different UUID (auth vs migration)
  AND mig.last_active = '2026-02-21 03:04:25.468761+00'; -- migration rows have this timestamp

-- Step 2: Delete the orphaned migration rows (random UUIDs, now duplicates)
DELETE FROM profiles
WHERE last_active = '2026-02-21 03:04:25.468761+00'
  AND id NOT IN (
    SELECT id FROM auth.users
  );

-- Step 3: Verify - check pr.finsko@gmail.com
SELECT id, member_id, name, score, wallet, hierarchy
FROM profiles
WHERE member_id = 'pr.finsko@gmail.com';
