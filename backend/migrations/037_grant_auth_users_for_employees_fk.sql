-- Allow the API role to read auth.users. Required for:
-- - FK check when inserting into employees (employees.user_id -> auth.users.id)
-- - supabase.auth.getUser(token) used by update-last-logon, check-active, verify-company, etc.
-- Without this you get "permission denied for table users" (42501).
-- Run in Supabase Dashboard -> SQL Editor (as project owner), or via supabase db push.

GRANT USAGE ON SCHEMA auth TO service_role;
GRANT SELECT ON auth.users TO service_role;
