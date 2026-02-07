-- Migration: Add flat_price, markup_percent, additional_expense_id to milestones
-- Description: Persist user-set prices and markup so they are restored when reopening document
-- Note: document_type already exists on milestones in your schema.

-- flat_price: user override for customer price (null = use cost + markup)
ALTER TABLE public.milestones ADD COLUMN IF NOT EXISTS flat_price numeric DEFAULT NULL;

-- markup_percent: markup applied to cost when flat_price is null
ALTER TABLE public.milestones ADD COLUMN IF NOT EXISTS markup_percent numeric DEFAULT 0;

-- additional_expense_id: link to project_additional_expenses for cost lookup
ALTER TABLE public.milestones ADD COLUMN IF NOT EXISTS additional_expense_id uuid REFERENCES public.project_additional_expenses(id) ON DELETE SET NULL;
