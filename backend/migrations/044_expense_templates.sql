-- Migration: Create expense templates for reusable project expense setup
-- Date: 2025-02-11
-- Description: Templates store common expense configurations (subcontractors, materials, equipment, additional)
-- that can be applied to projects. No dates or statuses - those are project-specific.

-- ============================================
-- 1. Create expense_templates table
-- ============================================

CREATE TABLE IF NOT EXISTS expense_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_templates_company_id ON expense_templates(company_id);

-- ============================================
-- 2. Create expense_template_subcontractor_fees
-- ============================================

CREATE TABLE IF NOT EXISTS expense_template_subcontractor_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES expense_templates(id) ON DELETE CASCADE,
    subcontractor_id UUID NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
    flat_fee NUMERIC(12, 2),
    expected_value NUMERIC(12, 2),
    job_description TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_template_subcontractor_fees_template_id ON expense_template_subcontractor_fees(template_id);

-- ============================================
-- 3. Create expense_template_materials
-- ============================================

CREATE TABLE IF NOT EXISTS expense_template_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES expense_templates(id) ON DELETE CASCADE,
    inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
    quantity NUMERIC(12, 2),
    expected_price NUMERIC(12, 2),
    actual_price NUMERIC(12, 2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_template_materials_template_id ON expense_template_materials(template_id);

-- ============================================
-- 4. Create expense_template_equipment
-- ============================================

CREATE TABLE IF NOT EXISTS expense_template_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES expense_templates(id) ON DELETE CASCADE,
    inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
    quantity NUMERIC(12, 2),
    expected_price NUMERIC(12, 2),
    actual_price NUMERIC(12, 2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_template_equipment_template_id ON expense_template_equipment(template_id);

-- ============================================
-- 5. Create expense_template_additional
-- ============================================

CREATE TABLE IF NOT EXISTS expense_template_additional (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES expense_templates(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    expected_value NUMERIC(12, 2),
    description TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_template_additional_template_id ON expense_template_additional(template_id);

-- ============================================
-- 6. Enable RLS on expense_templates
-- ============================================

ALTER TABLE expense_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company's expense templates"
    ON expense_templates FOR SELECT
    USING (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users
        WHERE id = auth.uid()
    ));

CREATE POLICY "Users can insert expense templates for their company"
    ON expense_templates FOR INSERT
    WITH CHECK (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users
        WHERE id = auth.uid()
    ));

CREATE POLICY "Users can update their company's expense templates"
    ON expense_templates FOR UPDATE
    USING (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users
        WHERE id = auth.uid()
    ));

CREATE POLICY "Users can delete their company's expense templates"
    ON expense_templates FOR DELETE
    USING (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users
        WHERE id = auth.uid()
    ));

-- ============================================
-- 7. RLS on item tables (via template join)
-- ============================================

ALTER TABLE expense_template_subcontractor_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_template_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_template_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_template_additional ENABLE ROW LEVEL SECURITY;

-- Subcontractor fees: allow access if user can access the template
CREATE POLICY "Users can manage template subcontractor fees"
    ON expense_template_subcontractor_fees FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM expense_templates t
            WHERE t.id = template_id
            AND t.company_id IN (
                SELECT raw_user_meta_data->>'companyID'
                FROM auth.users
                WHERE id = auth.uid()
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM expense_templates t
            WHERE t.id = template_id
            AND t.company_id IN (
                SELECT raw_user_meta_data->>'companyID'
                FROM auth.users
                WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can manage template materials"
    ON expense_template_materials FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM expense_templates t
            WHERE t.id = template_id
            AND t.company_id IN (
                SELECT raw_user_meta_data->>'companyID'
                FROM auth.users
                WHERE id = auth.uid()
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM expense_templates t
            WHERE t.id = template_id
            AND t.company_id IN (
                SELECT raw_user_meta_data->>'companyID'
                FROM auth.users
                WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can manage template equipment"
    ON expense_template_equipment FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM expense_templates t
            WHERE t.id = template_id
            AND t.company_id IN (
                SELECT raw_user_meta_data->>'companyID'
                FROM auth.users
                WHERE id = auth.uid()
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM expense_templates t
            WHERE t.id = template_id
            AND t.company_id IN (
                SELECT raw_user_meta_data->>'companyID'
                FROM auth.users
                WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can manage template additional"
    ON expense_template_additional FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM expense_templates t
            WHERE t.id = template_id
            AND t.company_id IN (
                SELECT raw_user_meta_data->>'companyID'
                FROM auth.users
                WHERE id = auth.uid()
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM expense_templates t
            WHERE t.id = template_id
            AND t.company_id IN (
                SELECT raw_user_meta_data->>'companyID'
                FROM auth.users
                WHERE id = auth.uid()
            )
        )
    );

-- ============================================
-- 8. Trigger for updated_at on expense_templates
-- ============================================

DROP TRIGGER IF EXISTS update_expense_templates_updated_at ON expense_templates;
CREATE TRIGGER update_expense_templates_updated_at
    BEFORE UPDATE ON expense_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
