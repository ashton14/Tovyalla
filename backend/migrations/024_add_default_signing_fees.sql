-- Migration: Add default signing fee percentages to companies table
-- These are used as default values when creating new contract milestones

-- Add default_initial_fee_percent column (default 20%)
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS default_initial_fee_percent NUMERIC(5,2) DEFAULT 10;

-- Add default_final_fee_percent column (default 80%)
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS default_final_fee_percent NUMERIC(5,2) DEFAULT 90;

-- Add comments for documentation
COMMENT ON COLUMN companies.default_initial_fee_percent IS 'Default percentage for initial contract signing fee (e.g., 20 means 20%)';
COMMENT ON COLUMN companies.default_final_fee_percent IS 'Default percentage for final payment at project completion (e.g., 80 means 80%)';

