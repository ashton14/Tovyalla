-- Migration: Update projects status check constraint to include 'contract_sent'
-- This replaces 'proposal_request' with 'contract_sent' as a valid status

-- Drop the existing constraint
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;

-- Add the updated constraint with 'contract_sent' included
ALTER TABLE projects ADD CONSTRAINT projects_status_check 
  CHECK (status IN ('proposal_sent', 'contract_sent', 'sold', 'complete', 'cancelled'));

-- Update any existing 'proposal_request' statuses to 'proposal_sent'
UPDATE projects SET status = 'proposal_sent' WHERE status = 'proposal_request';
