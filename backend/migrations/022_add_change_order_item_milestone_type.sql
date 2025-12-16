-- Migration: Add 'change_order_item' to allowed milestone types
-- Date: 2025-12-16
-- Description: Allow change_order_item as a valid milestone_type for change orders

-- First, find and drop the existing check constraint by name
-- The constraint name might vary, so we'll try common variations
DO $$ 
DECLARE
    constraint_name text;
BEGIN
    -- Find the constraint name
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'milestones'::regclass
      AND contype = 'c'
      AND conname LIKE '%milestone_type%';
    
    -- Drop the constraint if found
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE milestones DROP CONSTRAINT IF EXISTS %I', constraint_name);
    END IF;
END $$;

-- Alternative: Try dropping by common names if the above doesn't work
ALTER TABLE milestones DROP CONSTRAINT IF EXISTS milestones_milestone_type_check;
ALTER TABLE milestones DROP CONSTRAINT IF EXISTS milestones_check;

-- Add the new check constraint with change_order_item included
ALTER TABLE milestones 
ADD CONSTRAINT milestones_milestone_type_check 
CHECK (milestone_type IN (
  'initial_fee', 
  'subcontractor', 
  'equipment', 
  'materials', 
  'additional', 
  'final_inspection',
  'change_order_item'
));

