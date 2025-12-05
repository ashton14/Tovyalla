-- Migration: Simplify documents - remove contracts table, add document_number to project_documents
-- Date: 2024-12-05

-- ============================================
-- 1. Drop contracts table and related objects
-- ============================================

-- Drop the contracts table (this will also drop the FK from project_documents)
DROP TABLE IF EXISTS contracts CASCADE;

-- Drop the function if it exists
DROP FUNCTION IF EXISTS get_next_contract_number(TEXT, VARCHAR);
DROP FUNCTION IF EXISTS get_next_contract_number(TEXT);

-- ============================================
-- 2. Add document_number to project_documents
-- ============================================

-- Add document_number column
ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS document_number INTEGER;

-- Add document_date column for when the document was generated
ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS document_date DATE DEFAULT CURRENT_DATE;

-- Add status column
ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft' 
    CHECK (status IN ('draft', 'sent', 'signed', 'cancelled', 'expired'));

-- Remove the contract_id column if it exists
ALTER TABLE project_documents DROP COLUMN IF EXISTS contract_id;

-- Create index on document_number
CREATE INDEX IF NOT EXISTS idx_project_documents_document_number ON project_documents(document_number);

-- ============================================
-- 3. Function to get next document number
-- ============================================

CREATE OR REPLACE FUNCTION get_next_document_number(p_company_id TEXT)
RETURNS INTEGER AS $$
DECLARE
    next_number INTEGER;
BEGIN
    SELECT COALESCE(MAX(document_number), 0) + 1 
    INTO next_number 
    FROM project_documents 
    WHERE company_id = p_company_id
    AND document_number IS NOT NULL;
    
    RETURN next_number;
END;
$$ LANGUAGE plpgsql;
