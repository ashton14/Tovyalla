-- Create company table to store company information
CREATE TABLE IF NOT EXISTS public.companies (
  company_id TEXT PRIMARY KEY,
  company_name TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT DEFAULT 'USA',
  phone TEXT,
  email TEXT,
  website TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_companies_company_id ON public.companies(company_id);

-- Create RLS policies

-- Policy: Users can view company info for their company
CREATE POLICY "Users can view their company info" ON public.companies
  FOR SELECT USING (
    company_id = (
      SELECT raw_user_meta_data->>'companyID' 
      FROM auth.users 
      WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert company info for their company
CREATE POLICY "Users can insert their company info" ON public.companies
  FOR INSERT WITH CHECK (
    company_id = (
      SELECT raw_user_meta_data->>'companyID' 
      FROM auth.users 
      WHERE id = auth.uid()
    )
  );

-- Policy: Users can update company info for their company
CREATE POLICY "Users can update their company info" ON public.companies
  FOR UPDATE USING (
    company_id = (
      SELECT raw_user_meta_data->>'companyID' 
      FROM auth.users 
      WHERE id = auth.uid()
    )
  );

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_companies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to call the function on update
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_companies_updated_at();

