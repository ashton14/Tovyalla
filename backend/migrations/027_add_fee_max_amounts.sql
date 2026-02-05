-- Migration: Add minimum and maximum fee amounts to companies table
-- These allow users to set bounds on the default signing fees (e.g., "10% with min $500 and max $1000")

-- Add default_initial_fee_min column (null means no minimum)
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS default_initial_fee_min NUMERIC(10,2) DEFAULT NULL;

-- Add default_initial_fee_max column (null means no maximum)
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS default_initial_fee_max NUMERIC(10,2) DEFAULT NULL;

-- Add default_final_fee_min column (null means no minimum)
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS default_final_fee_min NUMERIC(10,2) DEFAULT NULL;

-- Add default_final_fee_max column (null means no maximum)
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS default_final_fee_max NUMERIC(10,2) DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN companies.default_initial_fee_min IS 'Minimum amount for initial fee in dollars (null = no min).';
COMMENT ON COLUMN companies.default_initial_fee_max IS 'Maximum amount for initial fee in dollars (null = no max).';
COMMENT ON COLUMN companies.default_final_fee_min IS 'Minimum amount for final fee in dollars (null = no min).';
COMMENT ON COLUMN companies.default_final_fee_max IS 'Maximum amount for final fee in dollars (null = no max).';
