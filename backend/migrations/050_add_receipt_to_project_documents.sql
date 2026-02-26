-- Migration: Add 'receipt' and 'insurance' to project_documents document_type
-- Date: 2025-02-21

ALTER TABLE project_documents DROP CONSTRAINT IF EXISTS project_documents_document_type_check;
ALTER TABLE project_documents ADD CONSTRAINT project_documents_document_type_check
    CHECK (document_type IN ('contract', 'proposal', 'change_order', 'receipt', 'insurance', 'other'));
