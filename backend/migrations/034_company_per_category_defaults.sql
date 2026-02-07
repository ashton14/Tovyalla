-- Migration: Per-category default markup and fee min/max for document defaults
-- Allows setting default markup %, min, and max for subcontractor, equipment+materials, and additional expenses.
-- Also adds default_markup_percent if missing (global fallback).

-- Global default markup (used when per-category not set)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_markup_percent numeric DEFAULT 30;

-- Subcontractor defaults
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_subcontractor_markup_percent numeric DEFAULT NULL;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_subcontractor_fee_min numeric DEFAULT NULL;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_subcontractor_fee_max numeric DEFAULT NULL;

-- Equipment & materials defaults
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_equipment_materials_markup_percent numeric DEFAULT NULL;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_equipment_materials_fee_min numeric DEFAULT NULL;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_equipment_materials_fee_max numeric DEFAULT NULL;

-- Additional expenses defaults
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_additional_expenses_markup_percent numeric DEFAULT NULL;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_additional_expenses_fee_min numeric DEFAULT NULL;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_additional_expenses_fee_max numeric DEFAULT NULL;
