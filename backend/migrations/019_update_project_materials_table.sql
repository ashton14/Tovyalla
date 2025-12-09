-- Migration: Update project_materials table structure
-- Date: 2024-12-XX
-- Remove: unit_cost, date_used, expected_value
-- Add: date_ordered, date_received, expected_price, actual_price

-- Add new columns (if they don't already exist)
ALTER TABLE project_materials
ADD COLUMN IF NOT EXISTS date_ordered DATE,
ADD COLUMN IF NOT EXISTS date_received DATE,
ADD COLUMN IF NOT EXISTS expected_price DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS actual_price DECIMAL(12, 2);

-- Migrate existing data: copy date_used to date_ordered (only if date_used column exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'project_materials' 
        AND column_name = 'date_used'
    ) THEN
        UPDATE project_materials
        SET date_ordered = date_used
        WHERE date_ordered IS NULL AND date_used IS NOT NULL;
    END IF;
END $$;

-- Migrate existing data: calculate actual_price from unit_cost * quantity (only if unit_cost column exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'project_materials' 
        AND column_name = 'unit_cost'
    ) THEN
        UPDATE project_materials
        SET actual_price = (unit_cost * quantity)
        WHERE actual_price IS NULL AND unit_cost IS NOT NULL AND quantity IS NOT NULL;
    END IF;
END $$;

-- Migrate existing data: copy expected_value to expected_price (only if expected_value column exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'project_materials' 
        AND column_name = 'expected_value'
    ) THEN
        UPDATE project_materials
        SET expected_price = expected_value
        WHERE expected_price IS NULL AND expected_value IS NOT NULL;
    END IF;
END $$;

-- Drop old columns (only if they exist)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'project_materials' 
        AND column_name = 'unit_cost'
    ) THEN
        ALTER TABLE project_materials DROP COLUMN unit_cost;
    END IF;
    
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'project_materials' 
        AND column_name = 'date_used'
    ) THEN
        ALTER TABLE project_materials DROP COLUMN date_used;
    END IF;
    
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'project_materials' 
        AND column_name = 'expected_value'
    ) THEN
        ALTER TABLE project_materials DROP COLUMN expected_value;
    END IF;
END $$;

