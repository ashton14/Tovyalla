-- Migration: Create contracts table to replace contract_numbers
-- Date: 2024-12-05

-- ============================================
-- 1. Drop old contract_numbers table if it exists
-- ============================================

DROP TABLE IF EXISTS contract_numbers CASCADE;

-- Drop old function if it exists
DROP FUNCTION IF EXISTS get_next_contract_number(TEXT);

-- ============================================
-- 2. Create new contracts table
-- ============================================

CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    contract_number INTEGER NOT NULL,
    document_type VARCHAR(20) NOT NULL DEFAULT 'contract' CHECK (document_type IN ('contract', 'proposal', 'change_order')),
    contract_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed', 'cancelled', 'expired')),
    total_amount DECIMAL(12, 2),
    notes TEXT,
    signed_date DATE,
    signed_by VARCHAR(255),
    pdf_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, contract_number, document_type)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_contracts_company_id ON contracts(company_id);
CREATE INDEX IF NOT EXISTS idx_contracts_project_id ON contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_contracts_document_type ON contracts(document_type);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);

-- Enable RLS on contracts
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for contracts
CREATE POLICY "Users can view their company's contracts"
    ON contracts FOR SELECT
    USING (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users 
        WHERE id = auth.uid()
    ));

CREATE POLICY "Users can insert contracts for their company"
    ON contracts FOR INSERT
    WITH CHECK (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users 
        WHERE id = auth.uid()
    ));

CREATE POLICY "Users can update their company's contracts"
    ON contracts FOR UPDATE
    USING (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users 
        WHERE id = auth.uid()
    ));

CREATE POLICY "Users can delete their company's contracts"
    ON contracts FOR DELETE
    USING (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users 
        WHERE id = auth.uid()
    ));

-- ============================================
-- 3. Function to get the next contract number
-- ============================================

CREATE OR REPLACE FUNCTION get_next_contract_number(p_company_id TEXT, p_document_type VARCHAR DEFAULT 'contract')
RETURNS INTEGER AS $$
DECLARE
    next_number INTEGER;
BEGIN
    SELECT COALESCE(MAX(contract_number), 0) + 1 
    INTO next_number 
    FROM contracts 
    WHERE company_id = p_company_id
    AND document_type = p_document_type;
    
    RETURN next_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. Create trigger for updated_at
-- ============================================

DROP TRIGGER IF EXISTS update_contracts_updated_at ON contracts;
CREATE TRIGGER update_contracts_updated_at
    BEFORE UPDATE ON contracts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
