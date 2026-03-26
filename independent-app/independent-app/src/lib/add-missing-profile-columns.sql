-- Add missing profile columns that exist in schema but not in the actual DB
-- Run this in Supabase SQL Editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS limits TEXT,
  ADD COLUMN IF NOT EXISTS kinks TEXT,
  ADD COLUMN IF NOT EXISTS routine TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Verify columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('limits', 'kinks', 'routine', 'notes', 'avatar_url', 'name')
ORDER BY column_name;
