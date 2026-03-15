-- TRIGGER: Handle New User Sign-up
-- Replaces Velo's wixMembers_onMemberCreated

-- 1. Create the Function
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    member_id,
    name,
    score,
    wallet,
    hierarchy,
    avatar_url,
    parameters
  )
  values (
    new.id,
    new.email,
    CASE WHEN new.email = 'ceo@qkarin.com' THEN 'Queen Karin' ELSE split_part(new.email, '@', 1) END,
    0,
    CASE WHEN new.email = 'ceo@qkarin.com' THEN 0 ELSE 5000 END,
    CASE WHEN new.email = 'ceo@qkarin.com' THEN 'Goddess' ELSE 'Hall Boy' END,
    CASE WHEN new.email = 'ceo@qkarin.com' THEN NULL ELSE 'https://static.wixstatic.com/media/ce3e5b_78da97e06a3848df84d0b00c9e6dcfdd~mv2.png' END,
    jsonb_build_object(
      'devotion', CASE WHEN new.email = 'ceo@qkarin.com' THEN 1000 ELSE 100 END
    )
  );
  return new;
end;
$$;

-- 2. Create the Trigger
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- INSTRUCTIONS:
-- Run this SQL in your Supabase Dashboard > SQL Editor.
-- New users will now receive:
--   - hierarchy: 'Hall Boy' (lowest rank)
--   - wallet: 5000 coins (welcome gift)
--   - avatar_url: default placeholder image
