-- MIGRATION: Convert routines table from per-submission rows to per-user rows
-- Run this in Supabase SQL Editor
-- This preserves ALL data: photos, thumbnails, statuses, timestamps, streaks

-- Step 1: Create the new table
CREATE TABLE IF NOT EXISTS user_routines (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    member_id text NOT NULL UNIQUE,
    routine_name text DEFAULT 'Daily Routine',
    current_streak integer DEFAULT 0,
    best_streak integer DEFAULT 0,
    last_approved_date text,
    pending_id text,
    pending_proof_url text,
    pending_proof_type text,
    pending_thumbnail_url text,
    pending_submitted_at timestamptz,
    history jsonb DEFAULT '[]'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Step 2: Migrate all existing data
INSERT INTO user_routines (member_id, routine_name, history)
SELECT
    r.member_id,
    COALESCE(p.routine, 'Daily Routine'),
    COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', r.id,
                'date', to_char(r.submitted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
                'submitted_at', r.submitted_at,
                'reviewed_at', r.reviewed_at,
                'status', r.status,
                'proof_url', r.proof_url,
                'proof_type', COALESCE(r.proof_type, 'image'),
                'thumbnail_url', r.thumbnail_url,
                'points_awarded', COALESCE(r.points_awarded, 0)
            ) ORDER BY r.submitted_at ASC
        ),
        '[]'::jsonb
    )
FROM routines r
LEFT JOIN profiles p ON lower(p.member_id) = lower(r.member_id)
GROUP BY r.member_id, p.routine
ON CONFLICT (member_id) DO NOTHING;

-- Step 3: Calculate streaks from the migrated history
-- This function calculates current and best streak for each user
DO $$
DECLARE
    rec RECORD;
    entry jsonb;
    entries jsonb;
    prev_date date;
    curr_date date;
    curr_streak int;
    best int;
    last_date text;
BEGIN
    FOR rec IN SELECT id, member_id, history FROM user_routines LOOP
        curr_streak := 0;
        best := 0;
        prev_date := NULL;
        last_date := NULL;

        -- Loop through approved entries in reverse chronological order
        entries := rec.history;
        FOR entry IN SELECT * FROM jsonb_array_elements(entries) e ORDER BY (e->>'submitted_at')::timestamptz DESC LOOP
            IF entry->>'status' != 'approve' THEN
                CONTINUE;
            END IF;

            curr_date := (entry->>'submitted_at')::date;

            IF prev_date IS NULL THEN
                -- First approved entry
                -- Only start streak if it was today or yesterday
                IF curr_date >= CURRENT_DATE - 1 THEN
                    curr_streak := 1;
                    last_date := entry->>'date';
                END IF;
                prev_date := curr_date;
            ELSE
                IF prev_date - curr_date = 1 THEN
                    -- Consecutive day
                    curr_streak := curr_streak + 1;
                    prev_date := curr_date;
                ELSIF prev_date = curr_date THEN
                    -- Same day, skip (dedup)
                    CONTINUE;
                ELSE
                    -- Gap found, stop counting current streak
                    -- But continue to find best streak
                    IF curr_streak > best THEN
                        best := curr_streak;
                    END IF;
                    -- Don't break - we need to count all streaks for best
                    curr_streak := 1;
                    prev_date := curr_date;
                END IF;
            END IF;
        END LOOP;

        -- Final check
        IF curr_streak > best THEN
            best := curr_streak;
        END IF;

        -- Also check profiles.parameters for existing best streak (might be higher from old system)
        DECLARE
            old_best int;
        BEGIN
            SELECT GREATEST(
                COALESCE((parameters->>'routine_streak')::int, 0),
                COALESCE("bestRoutinestreak", 0)
            ) INTO old_best
            FROM profiles WHERE lower(member_id) = lower(rec.member_id);

            IF old_best IS NOT NULL AND old_best > best THEN
                best := old_best;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;

        UPDATE user_routines
        SET current_streak = curr_streak,
            best_streak = best,
            last_approved_date = last_date
        WHERE id = rec.id;
    END LOOP;
END $$;

-- Step 4: Set pending fields for users who have a pending routine
UPDATE user_routines ur
SET pending_id = sub.id,
    pending_proof_url = sub.proof_url,
    pending_proof_type = sub.proof_type,
    pending_thumbnail_url = sub.thumbnail_url,
    pending_submitted_at = sub.submitted_at
FROM (
    SELECT DISTINCT ON (member_id) *
    FROM routines
    WHERE status = 'pending'
    ORDER BY member_id, submitted_at DESC
) sub
WHERE lower(ur.member_id) = lower(sub.member_id);

-- Step 5: Enable RLS
ALTER TABLE user_routines ENABLE ROW LEVEL SECURITY;

-- Step 6: Rename old table as backup (don't delete yet)
ALTER TABLE routines RENAME TO routines_old_backup;

-- Done! Verify with:
-- SELECT member_id, current_streak, best_streak, jsonb_array_length(history) as total_submissions FROM user_routines ORDER BY best_streak DESC;
