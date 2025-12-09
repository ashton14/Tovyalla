-- Migration: Create subcontractor_documents table for document metadata
-- Date: 2024-12-XX

-- ============================================
-- 1. Create subcontractor_documents table
-- ============================================

CREATE TABLE IF NOT EXISTS subcontractor_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL,
    subcontractor_id UUID NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    document_type VARCHAR(50) NOT NULL DEFAULT 'other' CHECK (document_type IN ('coi', 'license', 'insurance', 'contract', 'other')),
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_subcontractor_documents_company_id ON subcontractor_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_documents_subcontractor_id ON subcontractor_documents(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_documents_document_type ON subcontractor_documents(document_type);

-- Enable RLS on subcontractor_documents
ALTER TABLE subcontractor_documents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for subcontractor_documents
CREATE POLICY "Users can view their company's subcontractor documents"
    ON subcontractor_documents FOR SELECT
    USING (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users 
        WHERE id = auth.uid()
    ));

CREATE POLICY "Users can insert subcontractor documents for their company"
    ON subcontractor_documents FOR INSERT
    WITH CHECK (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users 
        WHERE id = auth.uid()
    ));

CREATE POLICY "Users can update their company's subcontractor documents"
    ON subcontractor_documents FOR UPDATE
    USING (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users 
        WHERE id = auth.uid()
    ));

CREATE POLICY "Users can delete their company's subcontractor documents"
    ON subcontractor_documents FOR DELETE
    USING (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users 
        WHERE id = auth.uid()
    ));

-- ============================================
-- 2. Create trigger for updated_at
-- ============================================

-- Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_subcontractor_documents_updated_at ON subcontractor_documents;
CREATE TRIGGER update_subcontractor_documents_updated_at
    BEFORE UPDATE ON subcontractor_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

