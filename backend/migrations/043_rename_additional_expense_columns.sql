-- Migration: Rename columns in project_additional_expenses for consistency
-- description -> name (main identifier)
-- category -> description (secondary text)

ALTER TABLE public.project_additional_expenses RENAME COLUMN description TO name;
ALTER TABLE public.project_additional_expenses RENAME COLUMN category TO description;
