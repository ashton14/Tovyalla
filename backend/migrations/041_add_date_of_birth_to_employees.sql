-- Add date_of_birth to employees
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS date_of_birth DATE;
