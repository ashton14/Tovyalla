-- Migration: Add DocuSign fields to project_documents table
-- Date: 2024-12-05
-- Description: Track DocuSign envelope IDs and signing status

-- Add DocuSign tracking columns
ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS docusign_envelope_id VARCHAR(255);
ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS docusign_status VARCHAR(50) CHECK (docusign_status IN ('sent', 'delivered', 'signed', 'completed', 'declined', 'voided'));
ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS docusign_sent_at TIMESTAMPTZ;
ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS docusign_completed_at TIMESTAMPTZ;

-- Create index for faster lookups by envelope ID
CREATE INDEX IF NOT EXISTS idx_project_documents_docusign_envelope_id ON project_documents(docusign_envelope_id);

-- Create index for status lookups
CREATE INDEX IF NOT EXISTS idx_project_documents_docusign_status ON project_documents(docusign_status);
