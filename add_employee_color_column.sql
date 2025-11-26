-- Add color column to employees table
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS color TEXT;

-- Add a comment to explain the column
COMMENT ON COLUMN public.employees.color IS 'Hex color code for calendar events (e.g., #0ea5e9)';

