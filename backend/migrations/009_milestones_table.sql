-- Migration: Create milestones table for storing customer pricing
-- Date: 2024-12-05
-- Description: Store milestone pricing separately from internal costs

-- Create milestones table
CREATE TABLE IF NOT EXISTS milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    milestone_type VARCHAR(50) NOT NULL CHECK (milestone_type IN ('initial_fee', 'subcontractor', 'equipment', 'materials', 'additional', 'final_inspection')),
    cost DECIMAL(12, 2) DEFAULT 0,
    customer_price DECIMAL(12, 2) DEFAULT 0,
    subcontractor_fee_id UUID REFERENCES project_subcontractor_fees(id) ON DELETE SET NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_milestones_company_id ON milestones(company_id);
CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_type ON milestones(milestone_type);

-- Enable RLS
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their company's milestones"
    ON milestones FOR SELECT
    USING (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users 
        WHERE id = auth.uid()
    ));

CREATE POLICY "Users can insert milestones for their company"
    ON milestones FOR INSERT
    WITH CHECK (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users 
        WHERE id = auth.uid()
    ));

CREATE POLICY "Users can update their company's milestones"
    ON milestones FOR UPDATE
    USING (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users 
        WHERE id = auth.uid()
    ));

CREATE POLICY "Users can delete their company's milestones"
    ON milestones FOR DELETE
    USING (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users 
        WHERE id = auth.uid()
    ));

-- Remove customer_price column from project_subcontractor_fees (if it exists)
ALTER TABLE project_subcontractor_fees DROP COLUMN IF EXISTS customer_price;
