-- Simple version: Add 'change_order_item' to allowed milestone types
-- Run this directly in Supabase SQL Editor

-- Drop the existing check constraint (try multiple possible names)
DO $$ 
BEGIN
    -- Try to drop by exact name first
    ALTER TABLE milestones DROP CONSTRAINT IF EXISTS milestones_milestone_type_check;
    
    -- If that doesn't work, find and drop any check constraint on milestone_type
    EXECUTE (
        SELECT 'ALTER TABLE milestones DROP CONSTRAINT ' || quote_ident(conname)
        FROM pg_constraint
        WHERE conrelid = 'milestones'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%milestone_type%'
        LIMIT 1
    );
EXCEPTION
    WHEN OTHERS THEN
        -- Ignore errors if constraint doesn't exist
        NULL;
END $$;

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

