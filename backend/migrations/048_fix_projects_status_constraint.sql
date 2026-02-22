-- Migration: Ensure projects_status_check includes all valid statuses
-- Fixes "violates check constraint" errors when updating project status
-- Run this if status updates fail with projects_status_check violation

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE projects ADD CONSTRAINT projects_status_check 
  CHECK (status IN (
    'contacted',
    'lead',
    'proposal_sent',
    'proposal_signed',
    'contract_sent',
    'sold',
    'in_progress',
    'complete',
    'completed',
    'cancelled'
  ));
