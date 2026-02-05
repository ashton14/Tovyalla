-- Migration: Update milestone types to include new types
-- Date: 2025-02-05
-- Description: Add equipment_materials and custom milestone types

-- Drop the existing check constraint
ALTER TABLE milestones DROP CONSTRAINT IF EXISTS milestones_milestone_type_check;

-- Add the updated check constraint with new types
ALTER TABLE milestones ADD CONSTRAINT milestones_milestone_type_check 
    CHECK (milestone_type IN ('initial_fee', 'subcontractor', 'equipment', 'materials', 'equipment_materials', 'additional', 'final_inspection', 'custom'));
