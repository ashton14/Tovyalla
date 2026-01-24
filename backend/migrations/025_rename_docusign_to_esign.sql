-- Migration: Rename DocuSign fields to generic eSign fields
-- Date: 2025-01-24
-- Description: Rename DocuSign-specific columns to generic eSign columns for eSignatures.com integration

-- Rename columns in project_documents table
ALTER TABLE project_documents RENAME COLUMN docusign_envelope_id TO esign_contract_id;
ALTER TABLE project_documents RENAME COLUMN docusign_status TO esign_status;
ALTER TABLE project_documents RENAME COLUMN docusign_sent_at TO esign_sent_at;
ALTER TABLE project_documents RENAME COLUMN docusign_completed_at TO esign_completed_at;
ALTER TABLE project_documents RENAME COLUMN docusign_sender_email TO esign_sender_email;
ALTER TABLE project_documents RENAME COLUMN docusign_sender_company_id TO esign_sender_company_id;

-- Rename indexes
ALTER INDEX IF EXISTS idx_project_documents_docusign_envelope_id RENAME TO idx_project_documents_esign_contract_id;
ALTER INDEX IF EXISTS idx_project_documents_docusign_status RENAME TO idx_project_documents_esign_status;
ALTER INDEX IF EXISTS idx_project_documents_docusign_sender_email RENAME TO idx_project_documents_esign_sender_email;

-- Update column comments
COMMENT ON COLUMN project_documents.esign_contract_id IS 'eSignatures.com contract ID for tracking signature status';
COMMENT ON COLUMN project_documents.esign_status IS 'Current signature status (sent, delivered, signed, completed, declined, voided)';
COMMENT ON COLUMN project_documents.esign_sent_at IS 'Timestamp when document was sent for signature';
COMMENT ON COLUMN project_documents.esign_completed_at IS 'Timestamp when all signatures were completed';
COMMENT ON COLUMN project_documents.esign_sender_email IS 'Email of the user who sent the document for signature';
COMMENT ON COLUMN project_documents.esign_sender_company_id IS 'Company ID of the sender (for adding company signer after customer signs)';

