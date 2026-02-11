-- Add sms_opt_in to employees (opt in to text message notifications)
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS sms_opt_in BOOLEAN DEFAULT false;
