-- Trigger: sync profiles.name → online_users.name on update
--
-- Background: online_users.member_id is a numeric hash of the email,
-- computed by the JS emailToId() function in /api/global/presence/route.ts:
--
--   let h = 5381;
--   for each char: h = (Math.imul(h, 31) + charCode) | 0   (32-bit signed)
--   return Math.abs(h) || 1
--
-- We replicate that hash below so the trigger can locate the right row.

-- ── 1. Helper: replicate JavaScript's emailToId() in PL/pgSQL ────────────
CREATE OR REPLACE FUNCTION email_to_online_id(email TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE STRICT
AS $$
DECLARE
    h       BIGINT := 5381;
    c       BIGINT;
    i       INTEGER;
    low     TEXT;
BEGIN
    low := lower(email);
    FOR i IN 1 .. length(low) LOOP
        c := ascii(substr(low, i, 1));
        -- Replicate Math.imul(h, 31) + c then | 0 (signed 32-bit truncation)
        -- Keep h in signed 32-bit range at each step, matching JS behaviour
        h := (h * 31 + c) % 4294967296;          -- keep lower 32 bits (unsigned)
        IF h >= 2147483648 THEN h := h - 4294967296; END IF;  -- to signed
    END LOOP;
    -- Math.abs(h) || 1
    IF h < 0  THEN h := -h; END IF;
    IF h = 0  THEN RETURN 1; END IF;
    RETURN h::INTEGER;
END;
$$;

-- ── 2. Trigger function ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_name_to_online_users()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only act when name actually changed
    IF NEW.name IS NOT DISTINCT FROM OLD.name THEN
        RETURN NEW;
    END IF;

    UPDATE online_users
    SET    name = NEW.name
    WHERE  member_id = email_to_online_id(NEW.member_id);

    RETURN NEW;
END;
$$;

-- ── 3. Attach trigger to profiles ────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_sync_name_to_online_users ON profiles;

CREATE TRIGGER trg_sync_name_to_online_users
    AFTER UPDATE OF name ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION sync_name_to_online_users();
