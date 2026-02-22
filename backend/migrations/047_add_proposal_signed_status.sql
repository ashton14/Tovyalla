-- Migration: Add 'proposal_signed' to projects status check constraint
-- Date: 2025-02-21
-- Description: Adds 'proposal_signed' as a valid project status (between proposal_sent and contract_sent).

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE projects ADD CONSTRAINT projects_status_check 
  CHECK (status IN ('contacted', 'proposal_sent', 'proposal_signed', 'contract_sent', 'sold', 'complete', 'cancelled', 'lead', 'in_progress', 'completed'));
