-- Migration: Add subscription purchaser to companies (record only)
-- Stores the auth user id of who purchased the subscription; not used for permission (admins can cancel).

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS subscription_purchased_by_user_id TEXT;
