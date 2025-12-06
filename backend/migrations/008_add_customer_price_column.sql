-- Migration: Add customer_price column to project_subcontractor_fees
-- Date: 2024-12-05
-- Description: Store the price charged to customer (separate from internal cost)

ALTER TABLE project_subcontractor_fees
ADD COLUMN IF NOT EXISTS customer_price DECIMAL(12, 2);

-- Add comment to explain the column
COMMENT ON COLUMN project_subcontractor_fees.customer_price IS 'The price charged to the customer for this work (may differ from flat_fee which is the cost)';
