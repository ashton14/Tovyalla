-- Remove 'active' column from employees table if it exists
-- This migration removes the 'active' column and ensures we use 'current' instead

-- Drop the 'active' column if it exists
ALTER TABLE public.employees 
DROP COLUMN IF EXISTS active;

-- Drop the index on 'active' if it exists
DROP INDEX IF EXISTS idx_employees_active;

-- Note: The 'current' column should already exist as BOOLEAN DEFAULT FALSE
-- If it doesn't exist or is still TEXT, run this:
-- ALTER TABLE public.employees 
-- ALTER COLUMN current TYPE BOOLEAN USING (current::boolean);

-- If 'current' column doesn't exist at all, add it:
-- ALTER TABLE public.employees 
-- ADD COLUMN IF NOT EXISTS current BOOLEAN DEFAULT FALSE;

-- Create index on 'current' if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_employees_current ON public.employees(current);

