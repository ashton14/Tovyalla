-- Migration: Rename project_type to property_type, replace pool_or_spa with project_types (multi-select)
-- Generalizes app from pool/spa to all contracting

-- Add new columns
ALTER TABLE projects ADD COLUMN IF NOT EXISTS property_type VARCHAR(50);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_types JSONB DEFAULT '[]'::jsonb;

-- Migrate project_type -> property_type
UPDATE projects SET property_type = project_type WHERE project_type IS NOT NULL;

-- Migrate pool_or_spa -> project_types (legacy values map to 'other' since pool/spa removed)
UPDATE projects
SET project_types = CASE
  WHEN pool_or_spa = 'pool' OR pool_or_spa = 'spa' OR pool_or_spa = 'pool & spa' THEN '["other"]'::jsonb
  ELSE COALESCE(project_types, '[]'::jsonb)
END
WHERE pool_or_spa IS NOT NULL;

UPDATE projects SET project_types = '[]'::jsonb WHERE project_types IS NULL;

-- Drop old columns
ALTER TABLE projects DROP COLUMN IF EXISTS project_type;
ALTER TABLE projects DROP COLUMN IF EXISTS pool_or_spa;

-- Set default for property_type on new rows
ALTER TABLE projects ALTER COLUMN property_type SET DEFAULT 'residential';
