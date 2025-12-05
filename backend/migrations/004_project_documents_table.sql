-- Migration: Create project_documents table for document metadata
-- Date: 2024-12-05

-- ============================================
-- 1. Create project_documents table
-- ============================================

CREATE TABLE IF NOT EXISTS project_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    document_type VARCHAR(50) NOT NULL DEFAULT 'other' CHECK (document_type IN ('contract', 'proposal', 'change_order', 'other')),
    contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_project_documents_company_id ON project_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_project_documents_project_id ON project_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_project_documents_document_type ON project_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_project_documents_contract_id ON project_documents(contract_id);

-- Enable RLS on project_documents
ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for project_documents
CREATE POLICY "Users can view their company's project documents"
    ON project_documents FOR SELECT
    USING (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users 
        WHERE id = auth.uid()
    ));

CREATE POLICY "Users can insert project documents for their company"
    ON project_documents FOR INSERT
    WITH CHECK (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users 
        WHERE id = auth.uid()
    ));

CREATE POLICY "Users can update their company's project documents"
    ON project_documents FOR UPDATE
    USING (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users 
        WHERE id = auth.uid()
    ));

CREATE POLICY "Users can delete their company's project documents"
    ON project_documents FOR DELETE
    USING (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users 
        WHERE id = auth.uid()
    ));

-- ============================================
-- 2. Create trigger for updated_at
-- ============================================

DROP TRIGGER IF EXISTS update_project_documents_updated_at ON project_documents;
CREATE TRIGGER update_project_documents_updated_at
    BEFORE UPDATE ON project_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
