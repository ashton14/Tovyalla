-- Re-add document_number to project_documents so we can store the assigned number
-- when a generated document is uploaded (and only increment company.next_document_number
-- at that time). document_date already exists in your schema.
ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS document_number INTEGER;
CREATE INDEX IF NOT EXISTS idx_project_documents_document_number ON project_documents(document_number) WHERE document_number IS NOT NULL;
