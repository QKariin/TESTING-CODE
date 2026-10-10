-- Add missing columns to stories table
ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS expires_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS source      TEXT,
  ADD COLUMN IF NOT EXISTS source_id   TEXT;

-- Reload PostgREST schema cache so it sees the new columns
NOTIFY pgrst, 'reload schema';
