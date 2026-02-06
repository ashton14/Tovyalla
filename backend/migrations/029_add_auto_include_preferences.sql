-- Migration: Add auto-include preferences for document generation
-- Date: 2026-02-05
-- Description: Add boolean columns to control which items are auto-included in contracts/proposals

-- Add auto_include_initial_payment column (default true to match current behavior)
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS auto_include_initial_payment BOOLEAN DEFAULT TRUE;

-- Add auto_include_final_payment column (default true to match current behavior)
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS auto_include_final_payment BOOLEAN DEFAULT TRUE;

-- Add auto_include_subcontractor column (default true to match current behavior)
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS auto_include_subcontractor BOOLEAN DEFAULT TRUE;

-- Add auto_include_equipment_materials column (default true to match current behavior)
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS auto_include_equipment_materials BOOLEAN DEFAULT TRUE;

-- Add auto_include_additional_expenses column (default true to match current behavior)
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS auto_include_additional_expenses BOOLEAN DEFAULT TRUE;

-- Add comments
COMMENT ON COLUMN companies.auto_include_initial_payment IS 'Whether to auto-include initial payment milestone in new documents';
COMMENT ON COLUMN companies.auto_include_final_payment IS 'Whether to auto-include final payment milestone in new documents';
COMMENT ON COLUMN companies.auto_include_subcontractor IS 'Whether to auto-include subcontractor work in scope/milestones';
COMMENT ON COLUMN companies.auto_include_equipment_materials IS 'Whether to auto-include equipment and materials in scope/milestones';
COMMENT ON COLUMN companies.auto_include_additional_expenses IS 'Whether to auto-include additional expenses in scope/milestones';
