-- Fix "Database error creating new user" after removing company_id from public.users.
-- If you have a trigger on auth.users that inserts into public.users, it may still
-- reference company_id. This replaces the trigger function to only insert id and email.

-- Replace the function so it no longer references company_id (column was dropped in 039).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

-- Trigger is usually already there; ensure it uses the updated function.
-- If the trigger doesn't exist, create it.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
