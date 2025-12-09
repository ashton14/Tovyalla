-- Migration: Create inventory_documents table for document metadata
-- Date: 2024-12-XX

-- ============================================
-- 1. Create inventory_documents table
-- ============================================

CREATE TABLE IF NOT EXISTS inventory_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL,
    inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    document_type VARCHAR(50) NOT NULL DEFAULT 'other' CHECK (document_type IN ('warranty', 'manual', 'receipt', 'invoice', 'other')),
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_inventory_documents_company_id ON inventory_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_documents_inventory_id ON inventory_documents(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_documents_document_type ON inventory_documents(document_type);

-- Enable RLS on inventory_documents
ALTER TABLE inventory_documents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for inventory_documents
CREATE POLICY "Users can view their company's inventory documents"
    ON inventory_documents FOR SELECT
    USING (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users 
        WHERE id = auth.uid()
    ));

CREATE POLICY "Users can insert inventory documents for their company"
    ON inventory_documents FOR INSERT
    WITH CHECK (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users 
        WHERE id = auth.uid()
    ));

CREATE POLICY "Users can update their company's inventory documents"
    ON inventory_documents FOR UPDATE
    USING (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users 
        WHERE id = auth.uid()
    ));

CREATE POLICY "Users can delete their company's inventory documents"
    ON inventory_documents FOR DELETE
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

DROP TRIGGER IF EXISTS update_inventory_documents_updated_at ON inventory_documents;
CREATE TRIGGER update_inventory_documents_updated_at
    BEFORE UPDATE ON inventory_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

