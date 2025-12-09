-- Migration: Add inventory_id column to project_equipment table
-- Date: 2024-12-XX

-- Add inventory_id column (nullable to support existing records)
ALTER TABLE project_equipment
ADD COLUMN IF NOT EXISTS inventory_id UUID REFERENCES inventory(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_project_equipment_inventory_id ON project_equipment(inventory_id);

-- Make name column nullable since we'll use inventory_id instead
ALTER TABLE project_equipment
ALTER COLUMN name DROP NOT NULL;

