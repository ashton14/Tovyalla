-- Remove company_id from public.users. Company context is now per request (X-Company-ID)
-- and access is determined by employees + company_whitelist, not a single company on the user.

ALTER TABLE public.users
  DROP COLUMN IF EXISTS company_id;
