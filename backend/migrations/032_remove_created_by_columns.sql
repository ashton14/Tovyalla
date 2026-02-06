-- Migration: Remove created_by and added_by columns
-- Date: 2025-02-06
-- Description: Remove user-reference columns so deleting a user does not affect other records

-- Drop created_by from customers (if exists)
ALTER TABLE customers DROP COLUMN IF EXISTS created_by;

-- Drop created_by from projects (if exists)
ALTER TABLE projects DROP COLUMN IF EXISTS created_by;

-- Drop created_by from inventory (if exists)
ALTER TABLE inventory DROP COLUMN IF EXISTS created_by;

-- Drop created_by from subcontractors (if exists)
ALTER TABLE subcontractors DROP COLUMN IF EXISTS created_by;

-- Drop added_by from company_whitelist (if exists)
ALTER TABLE company_whitelist DROP COLUMN IF EXISTS added_by;
