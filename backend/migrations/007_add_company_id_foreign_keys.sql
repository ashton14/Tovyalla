-- Migration: Add company_id foreign keys to all tables
-- Date: 2024-12-05
-- Description: Ensure all tables with company_id have proper foreign key constraints

-- Note: These ALTER statements will fail silently if the constraint already exists
-- or if there's data integrity issues. Run them one at a time if needed.

-- Note: project_subcontractor_fees, project_materials, and project_additional_expenses
-- do NOT have company_id columns - they reference company through the projects table.

-- 1. company_whitelist
ALTER TABLE company_whitelist
DROP CONSTRAINT IF EXISTS company_whitelist_company_id_fkey;

ALTER TABLE company_whitelist
ADD CONSTRAINT company_whitelist_company_id_fkey
FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE CASCADE;

-- 2. employees
ALTER TABLE employees
DROP CONSTRAINT IF EXISTS employees_company_id_fkey;

ALTER TABLE employees
ADD CONSTRAINT employees_company_id_fkey
FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE CASCADE;

-- 3. customers
ALTER TABLE customers
DROP CONSTRAINT IF EXISTS customers_company_id_fkey;

ALTER TABLE customers
ADD CONSTRAINT customers_company_id_fkey
FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE CASCADE;

-- 4. customer_status_history
ALTER TABLE customer_status_history
DROP CONSTRAINT IF EXISTS customer_status_history_company_id_fkey;

ALTER TABLE customer_status_history
ADD CONSTRAINT customer_status_history_company_id_fkey
FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE CASCADE;

-- 5. projects
ALTER TABLE projects
DROP CONSTRAINT IF EXISTS projects_company_id_fkey;

ALTER TABLE projects
ADD CONSTRAINT projects_company_id_fkey
FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE CASCADE;

-- 6. project_status_history
ALTER TABLE project_status_history
DROP CONSTRAINT IF EXISTS project_status_history_company_id_fkey;

ALTER TABLE project_status_history
ADD CONSTRAINT project_status_history_company_id_fkey
FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE CASCADE;

-- 7. inventory
ALTER TABLE inventory
DROP CONSTRAINT IF EXISTS inventory_company_id_fkey;

ALTER TABLE inventory
ADD CONSTRAINT inventory_company_id_fkey
FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE CASCADE;

-- 8. subcontractors
ALTER TABLE subcontractors
DROP CONSTRAINT IF EXISTS subcontractors_company_id_fkey;

ALTER TABLE subcontractors
ADD CONSTRAINT subcontractors_company_id_fkey
FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE CASCADE;

-- 9. events
ALTER TABLE events
DROP CONSTRAINT IF EXISTS events_company_id_fkey;

ALTER TABLE events
ADD CONSTRAINT events_company_id_fkey
FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE CASCADE;

-- 10. goals
ALTER TABLE goals
DROP CONSTRAINT IF EXISTS goals_company_id_fkey;

ALTER TABLE goals
ADD CONSTRAINT goals_company_id_fkey
FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE CASCADE;
