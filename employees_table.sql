-- Create employees table
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  user_type TEXT NOT NULL DEFAULT 'employee',
  user_role TEXT,
  email_address TEXT NOT NULL,
  phone TEXT,
  last_logon TIMESTAMP WITH TIME ZONE,
  current BOOLEAN DEFAULT FALSE,
  is_project_manager BOOLEAN DEFAULT FALSE,
  is_sales_person BOOLEAN DEFAULT FALSE,
  is_foreman BOOLEAN DEFAULT FALSE,
  registered_time_zone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_employees_company_id ON public.employees(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_email ON public.employees(email_address);
CREATE INDEX IF NOT EXISTS idx_employees_current ON public.employees(current);

-- Create RLS policies

-- Policy: Users can view employees for their company
CREATE POLICY "Users can view employees for their company" ON public.employees
  FOR SELECT USING (
    company_id = (
      SELECT raw_user_meta_data->>'companyID' 
      FROM auth.users 
      WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert employees for their company
CREATE POLICY "Users can insert employees for their company" ON public.employees
  FOR INSERT WITH CHECK (
    company_id = (
      SELECT raw_user_meta_data->>'companyID' 
      FROM auth.users 
      WHERE id = auth.uid()
    )
  );

-- Policy: Users can update employees for their company
CREATE POLICY "Users can update employees for their company" ON public.employees
  FOR UPDATE USING (
    company_id = (
      SELECT raw_user_meta_data->>'companyID' 
      FROM auth.users 
      WHERE id = auth.uid()
    )
  );

-- Policy: Users can delete employees for their company
CREATE POLICY "Users can delete employees for their company" ON public.employees
  FOR DELETE USING (
    company_id = (
      SELECT raw_user_meta_data->>'companyID' 
      FROM auth.users 
      WHERE id = auth.uid()
    )
  );

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_employees_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to call the function on update
CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_employees_updated_at();

