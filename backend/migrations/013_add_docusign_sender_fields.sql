-- Migration: Add DocuSign sender fields to project_documents table
-- Date: 2024-12-06
-- Description: Store sender email and company ID for two-step signing workflow

-- Add sender tracking columns
ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS docusign_sender_email VARCHAR(255);
ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS docusign_sender_company_id TEXT;

-- Create index for faster lookups by sender email
CREATE INDEX IF NOT EXISTS idx_project_documents_docusign_sender_email ON project_documents(docusign_sender_email);

-- Add comment
COMMENT ON COLUMN project_documents.docusign_sender_email IS 'Email of the user who sent the document for signature';
COMMENT ON COLUMN project_documents.docusign_sender_company_id IS 'Company ID of the sender (for adding company signer after customer signs)';
