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
    CASE WHEN new.email = 'ceo@qkarin.com' THEN 'Queen Karin' ELSE split_part(new.email, '@', 1) END,
    0,
    0,
    CASE WHEN new.email = 'ceo@qkarin.com' THEN 'Goddess' ELSE 'PENDING_TRIBUTE' END, 
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
