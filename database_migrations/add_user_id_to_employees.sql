-- Migration: Add user_id foreign key to employees table
-- This ensures employees are deleted when auth.users are deleted

-- Step 1: Add user_id column to employees table (nullable, since employees can be created manually)
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS user_id UUID;

-- Step 2: Add foreign key constraint with CASCADE delete
-- This will delete employee records when the referenced auth user is deleted
ALTER TABLE public.employees
ADD CONSTRAINT fk_employees_user_id 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- Step 3: Create index on user_id for better query performance
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id);

-- Step 4: Update existing employees to link them to auth users by email
-- This backfills the user_id for existing records that have matching auth users
UPDATE public.employees e
SET user_id = au.id
FROM auth.users au
WHERE e.email_address = LOWER(au.email)
  AND e.user_id IS NULL;

-- Note: 
-- - user_id is nullable because employees can be created manually without auth users
-- - When an employee has a user_id, deleting the auth user will cascade delete the employee
-- - New employee records created through registration should include user_id

