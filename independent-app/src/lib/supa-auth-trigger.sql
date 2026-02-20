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
    parameters
  )
  values (
    new.id,
    new.email,
    split_part(new.email, '@', 1), -- Default name from email
    0,         --- score: 0
    0,         --- wallet: 0
    'Hall Boy', 
    jsonb_build_object(
      'devotion', 100
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
