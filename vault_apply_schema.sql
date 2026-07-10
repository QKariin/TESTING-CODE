-- Add new columns to vault_sessions for the lock application flow
-- Run this in Supabase SQL editor

ALTER TABLE vault_sessions ADD COLUMN IF NOT EXISTS coins_paid integer DEFAULT 0;
ALTER TABLE vault_sessions ADD COLUMN IF NOT EXISTS request_message text;
ALTER TABLE vault_sessions ADD COLUMN IF NOT EXISTS scheduled_start timestamptz;
ALTER TABLE vault_sessions ADD COLUMN IF NOT EXISTS requested_at timestamptz DEFAULT now();

-- Allow 'pending', 'scheduled', 'denied' as status values (if using a check constraint)
-- Most likely status is just text, so no constraint change needed.
