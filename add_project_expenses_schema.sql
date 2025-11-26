-- Project Expenses Schema
-- This file contains all tables needed for tracking project expenses

-- Table: project_subcontractor_hours
-- Tracks hours worked by subcontractors on projects
CREATE TABLE IF NOT EXISTS public.project_subcontractor_hours (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  subcontractor_id UUID NOT NULL REFERENCES public.subcontractors(id) ON DELETE CASCADE,
  hours DECIMAL(10, 2) NOT NULL CHECK (hours >= 0),
  rate DECIMAL(10, 2) NOT NULL CHECK (rate >= 0),
  date_worked DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Add rate column to existing table if it doesn't exist
ALTER TABLE public.project_subcontractor_hours 
ADD COLUMN IF NOT EXISTS rate DECIMAL(10, 2);

-- Add check constraint if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'project_subcontractor_hours_rate_check'
  ) THEN
    ALTER TABLE public.project_subcontractor_hours 
    ADD CONSTRAINT project_subcontractor_hours_rate_check 
    CHECK (rate >= 0);
  END IF;
END $$;

-- Update existing rows to use subcontractor's default rate if rate is NULL
UPDATE public.project_subcontractor_hours psh
SET rate = COALESCE(
  (SELECT s.rate FROM public.subcontractors s WHERE s.id = psh.subcontractor_id),
  0
)
WHERE rate IS NULL;

-- Make rate NOT NULL after updating existing data
ALTER TABLE public.project_subcontractor_hours 
ALTER COLUMN rate SET NOT NULL;

-- Remove unique constraint if it exists (allows multiple entries per subcontractor per day)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'project_subcontractor_hours_project_id_subcontractor_id_dat_key'
  ) THEN
    ALTER TABLE public.project_subcontractor_hours 
    DROP CONSTRAINT project_subcontractor_hours_project_id_subcontractor_id_dat_key;
  END IF;
END $$;

-- Table: project_materials
-- Tracks materials used from inventory on projects
CREATE TABLE IF NOT EXISTS public.project_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  quantity DECIMAL(10, 2) NOT NULL CHECK (quantity > 0),
  unit_cost DECIMAL(10, 2) NOT NULL CHECK (unit_cost >= 0),
  date_used DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Table: project_additional_expenses
-- Tracks additional expenses not covered by subcontractors or materials
CREATE TABLE IF NOT EXISTS public.project_additional_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
  expense_date DATE NOT NULL,
  category TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_project_subcontractor_hours_project_id ON public.project_subcontractor_hours(project_id);
CREATE INDEX IF NOT EXISTS idx_project_subcontractor_hours_subcontractor_id ON public.project_subcontractor_hours(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_project_materials_project_id ON public.project_materials(project_id);
CREATE INDEX IF NOT EXISTS idx_project_materials_inventory_id ON public.project_materials(inventory_id);
CREATE INDEX IF NOT EXISTS idx_project_additional_expenses_project_id ON public.project_additional_expenses(project_id);

-- Enable Row Level Security
ALTER TABLE public.project_subcontractor_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_additional_expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_subcontractor_hours
CREATE POLICY "Users can view subcontractor hours for their company projects"
  ON public.project_subcontractor_hours FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE company_id = (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users
        WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert subcontractor hours for their company projects"
  ON public.project_subcontractor_hours FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects
      WHERE company_id = (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users
        WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update subcontractor hours for their company projects"
  ON public.project_subcontractor_hours FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE company_id = (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users
        WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete subcontractor hours for their company projects"
  ON public.project_subcontractor_hours FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE company_id = (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users
        WHERE id = auth.uid()
      )
    )
  );

-- RLS Policies for project_materials
CREATE POLICY "Users can view materials for their company projects"
  ON public.project_materials FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE company_id = (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users
        WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert materials for their company projects"
  ON public.project_materials FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects
      WHERE company_id = (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users
        WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update materials for their company projects"
  ON public.project_materials FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE company_id = (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users
        WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete materials for their company projects"
  ON public.project_materials FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE company_id = (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users
        WHERE id = auth.uid()
      )
    )
  );

-- RLS Policies for project_additional_expenses
CREATE POLICY "Users can view additional expenses for their company projects"
  ON public.project_additional_expenses FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE company_id = (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users
        WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert additional expenses for their company projects"
  ON public.project_additional_expenses FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects
      WHERE company_id = (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users
        WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update additional expenses for their company projects"
  ON public.project_additional_expenses FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE company_id = (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users
        WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete additional expenses for their company projects"
  ON public.project_additional_expenses FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE company_id = (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users
        WHERE id = auth.uid()
      )
    )
  );

