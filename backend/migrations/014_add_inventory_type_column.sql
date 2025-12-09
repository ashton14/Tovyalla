-- Add type column to inventory table
-- Type can be 'material' or 'equipment'

ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'material' CHECK (type IN ('material', 'equipment'));

-- Update existing records to have type 'material' by default
UPDATE inventory
SET type = 'material'
WHERE type IS NULL;

-- Make type NOT NULL after setting defaults
ALTER TABLE inventory
ALTER COLUMN type SET NOT NULL;

