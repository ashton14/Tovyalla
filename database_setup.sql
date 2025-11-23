-- Create company_whitelist table
CREATE TABLE IF NOT EXISTS public.company_whitelist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL,
  email TEXT NOT NULL,
  added_by UUID REFERENCES auth.users(id),
  registered BOOLEAN DEFAULT FALSE,
  registered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(company_id, email)
);

-- Enable Row Level Security
ALTER TABLE public.company_whitelist ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_company_whitelist_company_id ON public.company_whitelist(company_id);
CREATE INDEX IF NOT EXISTS idx_company_whitelist_email ON public.company_whitelist(email);

-- Drop existing policies if they exist (for re-running the script)
DROP POLICY IF EXISTS "Users can view whitelist for their company" ON public.company_whitelist;
DROP POLICY IF EXISTS "Users can add to their company whitelist" ON public.company_whitelist;
DROP POLICY IF EXISTS "Users can delete from their company whitelist" ON public.company_whitelist;

-- Create policy to allow users to view whitelist for their company
CREATE POLICY "Users can view whitelist for their company" ON public.company_whitelist
  FOR SELECT USING (
    company_id = (
      SELECT raw_user_meta_data->>'companyID' 
      FROM auth.users 
      WHERE id = auth.uid()
    )
  );

-- Create policy to allow users to add emails to their company whitelist
CREATE POLICY "Users can add to their company whitelist" ON public.company_whitelist
  FOR INSERT WITH CHECK (
    company_id = (
      SELECT raw_user_meta_data->>'companyID' 
      FROM auth.users 
      WHERE id = auth.uid()
    )
  );

-- Create policy to allow users to delete from their company whitelist
CREATE POLICY "Users can delete from their company whitelist" ON public.company_whitelist
  FOR DELETE USING (
    company_id = (
      SELECT raw_user_meta_data->>'companyID' 
      FROM auth.users 
      WHERE id = auth.uid()
    )
  );

-- Note: The backend uses service_role key, so it can bypass RLS for registration checks
-- This is necessary to allow registration before the user is authenticated

-- Create customers table
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT DEFAULT 'USA',
  referred_by TEXT,
  pipeline_status TEXT NOT NULL DEFAULT 'lead' CHECK (pipeline_status IN ('lead', 'contacted', 'quoted', 'signed', 'in_progress', 'completed', 'lost', 'on_hold')),
  notes TEXT,
  estimated_value DECIMAL(10, 2),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON public.customers(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_pipeline_status ON public.customers(pipeline_status);
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON public.customers(created_at DESC);

-- Drop existing policies if they exist (for re-running the script)
DROP POLICY IF EXISTS "Users can view customers for their company" ON public.customers;
DROP POLICY IF EXISTS "Users can insert customers for their company" ON public.customers;
DROP POLICY IF EXISTS "Users can update customers for their company" ON public.customers;
DROP POLICY IF EXISTS "Users can delete customers for their company" ON public.customers;

-- Create policy to allow users to view customers for their company
CREATE POLICY "Users can view customers for their company" ON public.customers
  FOR SELECT USING (
    company_id = (
      SELECT raw_user_meta_data->>'companyID' 
      FROM auth.users 
      WHERE id = auth.uid()
    )
  );

-- Create policy to allow users to insert customers for their company
CREATE POLICY "Users can insert customers for their company" ON public.customers
  FOR INSERT WITH CHECK (
    company_id = (
      SELECT raw_user_meta_data->>'companyID' 
      FROM auth.users 
      WHERE id = auth.uid()
    )
  );

-- Create policy to allow users to update customers for their company
CREATE POLICY "Users can update customers for their company" ON public.customers
  FOR UPDATE USING (
    company_id = (
      SELECT raw_user_meta_data->>'companyID' 
      FROM auth.users 
      WHERE id = auth.uid()
    )
  );

-- Create policy to allow users to delete customers for their company
CREATE POLICY "Users can delete customers for their company" ON public.customers
  FOR DELETE USING (
    company_id = (
      SELECT raw_user_meta_data->>'companyID' 
      FROM auth.users 
      WHERE id = auth.uid()
    )
  );

