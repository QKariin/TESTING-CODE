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
    email,
    name,
    score,      -- Replaces 'points'
    wallet,     -- Replaces 'coins'
    hierarchy,  -- Replaces 'role' 
    parameters  -- Stores 'devotion' and other metadata
  )
  values (
    new.id,
    new.email, -- Use email as member_id for limited legacy compatibility, or just use UUID
    new.email,
    split_part(new.email, '@', 1), -- Default name from email
    0,         -- points: 0
    0,         -- coins: 0
    'Hall Boy', -- Replaces 'Subject'. Velo said 'Subject', but hierarchyRules says 'Hall Boy' is bottom.
    jsonb_build_object(
      'devotion', 100,
      'role', 'Subject' -- Store original Velo role in parameters just in case
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
