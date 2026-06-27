-- SCORE AUDIT TRIGGER
-- Run this in Supabase Dashboard > SQL Editor
-- This will log EVERY change to "Daily Score" so we can catch what's resetting it

-- 1. Create audit log table
CREATE TABLE IF NOT EXISTS score_audit_log (
    id BIGSERIAL PRIMARY KEY,
    task_id TEXT,
    member_id TEXT,
    old_daily_score NUMERIC,
    new_daily_score NUMERIC,
    old_weekly_score NUMERIC,
    new_weekly_score NUMERIC,
    operation TEXT,  -- UPDATE, INSERT, DELETE
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create trigger function
CREATE OR REPLACE FUNCTION log_score_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD."Daily Score" IS DISTINCT FROM NEW."Daily Score"
           OR OLD."Weekly Score" IS DISTINCT FROM NEW."Weekly Score" THEN
            INSERT INTO score_audit_log (task_id, member_id, old_daily_score, new_daily_score, old_weekly_score, new_weekly_score, operation)
            VALUES (NEW."ID", NEW.member_id, OLD."Daily Score", NEW."Daily Score", OLD."Weekly Score", NEW."Weekly Score", 'UPDATE');
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO score_audit_log (task_id, member_id, old_daily_score, new_daily_score, old_weekly_score, new_weekly_score, operation)
        VALUES (NEW."ID", NEW.member_id, NULL, NEW."Daily Score", NULL, NEW."Weekly Score", 'INSERT');
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO score_audit_log (task_id, member_id, old_daily_score, new_daily_score, old_weekly_score, new_weekly_score, operation)
        VALUES (OLD."ID", OLD.member_id, OLD."Daily Score", NULL, OLD."Weekly Score", NULL, 'DELETE');
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach trigger to tasks table (catches ALL operations)
DROP TRIGGER IF EXISTS trg_score_audit ON tasks;

CREATE TRIGGER trg_score_audit
AFTER INSERT OR UPDATE OR DELETE ON tasks
FOR EACH ROW EXECUTE FUNCTION log_score_change();

-- 4. Quick query to check the log:
-- SELECT * FROM score_audit_log ORDER BY changed_at DESC LIMIT 50;
--
-- To find the Australian user specifically:
-- SELECT * FROM score_audit_log WHERE member_id ILIKE '%their_email%' ORDER BY changed_at DESC;
