-- Remove companyID from auth.users metadata (company context is now sent per request via X-Company-ID).
-- raw_user_meta_data is JSONB; this removes the key if present.
-- Run with a role that can update auth.users (e.g. in Supabase Dashboard SQL Editor).

UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'companyID'
WHERE raw_user_meta_data ? 'companyID';
