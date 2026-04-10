-- TRIGGER: Announce new user in global_messages
-- Fires after a new profile is inserted (which happens via handle_new_user on auth signup)

-- 1. Create the Function
CREATE OR REPLACE FUNCTION public.announce_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Skip announcement for the Queen
  IF NEW.member_id = 'ceo@qkarin.com' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.global_messages (
    sender_email,
    sender_name,
    sender_avatar,
    message
  )
  VALUES (
    'system@qkarin.com',
    'System',
    NULL,
    NEW.name || ' has joined the court.'
  );

  RETURN NEW;
END;
$$;

-- 2. Create the Trigger
CREATE OR REPLACE TRIGGER on_new_profile_announce
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.announce_new_user();

-- INSTRUCTIONS:
-- Run this SQL in your Supabase Dashboard > SQL Editor.
-- This trigger fires whenever a new profile is created (i.e. when a new user signs up).
-- It posts a welcome announcement to global_messages using the profile's name.
