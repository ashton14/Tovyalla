-- Migration: Add parent_id to scope_of_work for subscopes
-- Date: 2025-02-11
-- Description: Allows scope items to be nested under parent items (subscopes).
-- Subscopes display as subheaders in generated documents.

-- Add parent_id column (nullable, self-referential)
ALTER TABLE scope_of_work ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES scope_of_work(id) ON DELETE CASCADE;

-- Index for efficient child lookups
CREATE INDEX IF NOT EXISTS idx_scope_of_work_parent_id ON scope_of_work(parent_id);
