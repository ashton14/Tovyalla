-- Migration: Fix project_equipment name field to ensure it's always populated
-- This ensures that when equipment is created/updated with inventory_id, the name is automatically copied from inventory

-- Step 1: Create a function to sync name from inventory when inventory_id is set
CREATE OR REPLACE FUNCTION sync_project_equipment_name()
RETURNS TRIGGER AS $$
BEGIN
  -- If inventory_id is set and name is NULL or empty, copy name from inventory
  IF NEW.inventory_id IS NOT NULL AND (NEW.name IS NULL OR NEW.name = '') THEN
    SELECT name INTO NEW.name
    FROM inventory
    WHERE id = NEW.inventory_id;
  END IF;
  
  -- If inventory_id changed and it's not NULL, update name from inventory
  IF NEW.inventory_id IS NOT NULL AND (OLD.inventory_id IS NULL OR OLD.inventory_id != NEW.inventory_id) THEN
    SELECT name INTO NEW.name
    FROM inventory
    WHERE id = NEW.inventory_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create trigger for INSERT to sync name on creation
DROP TRIGGER IF EXISTS sync_equipment_name_on_insert ON project_equipment;
CREATE TRIGGER sync_equipment_name_on_insert
  BEFORE INSERT ON project_equipment
  FOR EACH ROW
  EXECUTE FUNCTION sync_project_equipment_name();

-- Step 3: Create trigger for UPDATE to sync name when inventory_id changes
DROP TRIGGER IF EXISTS sync_equipment_name_on_update ON project_equipment;
CREATE TRIGGER sync_equipment_name_on_update
  BEFORE UPDATE ON project_equipment
  FOR EACH ROW
  EXECUTE FUNCTION sync_project_equipment_name();

-- Step 4: Backfill existing records that have inventory_id but NULL/empty name
UPDATE project_equipment pe
SET name = i.name
FROM inventory i
WHERE pe.inventory_id = i.id
  AND (pe.name IS NULL OR trim(pe.name) = '');

-- Step 4b: For any remaining records without name or inventory_id, set a default name
-- (This should be rare, but ensures data integrity)
UPDATE project_equipment
SET name = 'Equipment'
WHERE (name IS NULL OR trim(name) = '')
  AND inventory_id IS NULL;

-- Step 5: Add a check constraint to ensure name is always populated
-- Since the trigger populates name when inventory_id is set, we just need to ensure
-- name is not NULL and not empty (the trigger handles the inventory_id case)
ALTER TABLE project_equipment
DROP CONSTRAINT IF EXISTS project_equipment_name_not_empty_check;

ALTER TABLE project_equipment
ADD CONSTRAINT project_equipment_name_not_empty_check
CHECK (name IS NOT NULL AND trim(name) != '');

