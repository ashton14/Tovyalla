-- Migration: Allow multiple contracts per project + Add change_order document type
-- Date: 2024-12-05

-- Drop any existing unique constraint on project_id (if exists from old schema)
ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_company_id_project_id_key;
ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_project_id_document_type_key;

-- Update document_type check constraint to include 'change_order'
ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_document_type_check;
ALTER TABLE contracts ADD CONSTRAINT contracts_document_type_check 
    CHECK (document_type IN ('contract', 'proposal', 'change_order'));

-- The only unique constraint should be on contract_number per company/type
-- UNIQUE(company_id, contract_number, document_type) - this stays as-is
