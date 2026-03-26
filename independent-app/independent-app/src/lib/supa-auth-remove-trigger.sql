-- 1. Remove the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Remove the function
DROP FUNCTION IF EXISTS public.handle_new_user();

-- CLEANUP: If you have "PENDING_TRIBUTE" users in your profiles table that you want to start fresh with, 
-- you can run this (OPTIONAL):
-- DELETE FROM public.profiles WHERE hierarchy = 'PENDING_TRIBUTE';
