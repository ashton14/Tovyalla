-- Migration: Move document_number to companies table
-- Date: 2024-12-05
-- Description: Store document number counter at company level, remove from other tables

-- ============================================
-- 1. Add next_document_number to companies
-- ============================================

-- Add column to track the next document number for each company
ALTER TABLE companies ADD COLUMN IF NOT EXISTS next_document_number INTEGER DEFAULT 1;

-- ============================================
-- 2. Remove document_number from project_documents
-- ============================================

-- Drop the index first
DROP INDEX IF EXISTS idx_project_documents_document_number;

-- Remove the column
ALTER TABLE project_documents DROP COLUMN IF EXISTS document_number;

-- ============================================
-- 3. Remove document_number from milestones
-- ============================================

-- Drop indexes
DROP INDEX IF EXISTS idx_milestones_document_number;
DROP INDEX IF EXISTS idx_milestones_project_document;

-- Remove the column
ALTER TABLE milestones DROP COLUMN IF EXISTS document_number;

-- ============================================
-- 4. Drop the old function
-- ============================================

DROP FUNCTION IF EXISTS get_next_document_number(TEXT);
