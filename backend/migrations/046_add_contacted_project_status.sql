-- Migration: Add 'contacted' to projects status check constraint
-- Date: 2025-02-11
-- Description: Adds 'contacted' as a valid project status (first/default option).

-- Drop the existing constraint
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;

-- Add the updated constraint with 'contacted' included
ALTER TABLE projects ADD CONSTRAINT projects_status_check 
  CHECK (status IN ('contacted', 'proposal_sent', 'contract_sent', 'sold', 'complete', 'cancelled', 'lead', 'in_progress', 'completed'));
