-- Add streak columns to routines table
ALTER TABLE routines ADD COLUMN IF NOT EXISTS current_streak integer DEFAULT 0;
ALTER TABLE routines ADD COLUMN IF NOT EXISTS best_streak integer DEFAULT 0;

-- Backfill: calculate streaks from existing approved routines
-- This sets current_streak and best_streak on each user's latest approved routine
-- by counting consecutive days backwards

WITH ordered AS (
    SELECT id, member_id, submitted_at,
           ROW_NUMBER() OVER (PARTITION BY member_id ORDER BY submitted_at DESC) as rn,
           DATE(submitted_at - interval '6 hours') as routine_day
    FROM routines
    WHERE status = 'approve'
),
with_gaps AS (
    SELECT *,
           routine_day - (ROW_NUMBER() OVER (PARTITION BY member_id ORDER BY routine_day DESC))::int as grp
    FROM (SELECT DISTINCT ON (member_id, routine_day) * FROM ordered ORDER BY member_id, routine_day DESC, rn) deduped
),
streaks AS (
    SELECT member_id,
           COUNT(*) as streak_length,
           MAX(routine_day) as last_day
    FROM with_gaps
    GROUP BY member_id, grp
),
current_streaks AS (
    SELECT DISTINCT ON (member_id) member_id, streak_length
    FROM streaks
    ORDER BY member_id, last_day DESC
),
best_streaks AS (
    SELECT member_id, MAX(streak_length) as best
    FROM streaks
    GROUP BY member_id
)
UPDATE routines r
SET current_streak = COALESCE(cs.streak_length, 0),
    best_streak = COALESCE(bs.best, 0)
FROM current_streaks cs
JOIN best_streaks bs ON cs.member_id = bs.member_id
WHERE r.member_id = cs.member_id
  AND r.id = (
      SELECT id FROM routines
      WHERE member_id = r.member_id AND status = 'approve'
      ORDER BY submitted_at DESC LIMIT 1
  );
