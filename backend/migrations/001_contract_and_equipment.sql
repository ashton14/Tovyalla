-- Migration: Add company fields, job description, equipment expenses, and contract tracking
-- Date: 2024-12-05

-- ============================================
-- 1. Add new fields to companies table
-- ============================================

-- Add phone number to companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

-- Add website to companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS website VARCHAR(255);

-- Add license numbers to companies (stored as JSON array for multiple licenses)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS license_numbers JSONB DEFAULT '[]'::jsonb;

-- ============================================
-- 2. Add job_description to project_subcontractor_fees
-- ============================================

ALTER TABLE project_subcontractor_fees ADD COLUMN IF NOT EXISTS job_description TEXT;

-- ============================================
-- 3. Create project_equipment table for equipment expenses
-- ============================================

CREATE TABLE IF NOT EXISTS project_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    company_id TEXT NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    expected_price DECIMAL(12, 2),
    actual_price DECIMAL(12, 2),
    quantity INTEGER DEFAULT 1,
    date_ordered DATE,
    date_received DATE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'ordered', 'received', 'installed', 'complete')),
    vendor VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_project_equipment_project_id ON project_equipment(project_id);
CREATE INDEX IF NOT EXISTS idx_project_equipment_company_id ON project_equipment(company_id);

-- Enable RLS on project_equipment
ALTER TABLE project_equipment ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for project_equipment
CREATE POLICY "Users can view their company's equipment expenses"
    ON project_equipment FOR SELECT
    USING (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users 
        WHERE id = auth.uid()
    ));

CREATE POLICY "Users can insert equipment expenses for their company"
    ON project_equipment FOR INSERT
    WITH CHECK (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users 
        WHERE id = auth.uid()
    ));

CREATE POLICY "Users can update their company's equipment expenses"
    ON project_equipment FOR UPDATE
    USING (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users 
        WHERE id = auth.uid()
    ));

CREATE POLICY "Users can delete their company's equipment expenses"
    ON project_equipment FOR DELETE
    USING (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users 
        WHERE id = auth.uid()
    ));

-- ============================================
-- 4. Create contract_numbers table for tracking
-- ============================================

CREATE TABLE IF NOT EXISTS contract_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    contract_number INTEGER NOT NULL,
    contract_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, contract_number),
    UNIQUE(company_id, project_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_contract_numbers_company_id ON contract_numbers(company_id);
CREATE INDEX IF NOT EXISTS idx_contract_numbers_project_id ON contract_numbers(project_id);

-- Enable RLS on contract_numbers
ALTER TABLE contract_numbers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for contract_numbers
CREATE POLICY "Users can view their company's contract numbers"
    ON contract_numbers FOR SELECT
    USING (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users 
        WHERE id = auth.uid()
    ));

CREATE POLICY "Users can insert contract numbers for their company"
    ON contract_numbers FOR INSERT
    WITH CHECK (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users 
        WHERE id = auth.uid()
    ));

-- Function to get the next contract number for a company
CREATE OR REPLACE FUNCTION get_next_contract_number(p_company_id TEXT)
RETURNS INTEGER AS $$
DECLARE
    next_number INTEGER;
BEGIN
    SELECT COALESCE(MAX(contract_number), 0) + 1 
    INTO next_number 
    FROM contract_numbers 
    WHERE company_id = p_company_id;
    
    RETURN next_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. Create trigger for updated_at on project_equipment
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_project_equipment_updated_at ON project_equipment;
CREATE TRIGGER update_project_equipment_updated_at
    BEFORE UPDATE ON project_equipment
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
