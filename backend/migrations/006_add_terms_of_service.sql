-- Migration: Add terms_of_service to companies table
-- Date: 2024-12-05

-- Add terms_of_service column to companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS terms_of_service TEXT;
