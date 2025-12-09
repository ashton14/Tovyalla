-- Migration: Update project_equipment table structure
-- Date: 2024-12-XX
-- Remove: description, vendor, name (keep for backward compatibility but make nullable)
-- Keep: inventory_id, quantity, date_ordered, date_received, status, expected_price, actual_price, notes

-- Make name column nullable (we're using inventory_id now) - only if it exists and is NOT NULL
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'project_equipment' 
        AND column_name = 'name'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE project_equipment
        ALTER COLUMN name DROP NOT NULL;
    END IF;
END $$;

-- Drop unnecessary columns (only if they exist)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'project_equipment' 
        AND column_name = 'description'
    ) THEN
        ALTER TABLE project_equipment DROP COLUMN description;
    END IF;
    
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'project_equipment' 
        AND column_name = 'vendor'
    ) THEN
        ALTER TABLE project_equipment DROP COLUMN vendor;
    END IF;
END $$;

