-- Migration: Add description column to milestones table
-- Date: 2025-12-16
-- Description: Add description field for change order items

-- Add description column to milestones table
ALTER TABLE milestones 
ADD COLUMN IF NOT EXISTS description TEXT;

