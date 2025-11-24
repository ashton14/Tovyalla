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

-- Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  address TEXT,
  project_type TEXT NOT NULL CHECK (project_type IN ('residential', 'commercial', 'HOA')),
  pool_or_spa TEXT NOT NULL CHECK (pool_or_spa IN ('pool', 'spa', 'pool & spa')),
  sq_feet DECIMAL(10, 2),
  status TEXT NOT NULL DEFAULT 'proposal_request' CHECK (status IN ('proposal_request', 'proposal_sent', 'sold', 'complete', 'cancelled')),
  accessories_features TEXT,
  est_value DECIMAL(10, 2),
  project_manager TEXT,
  notes TEXT,
  documents JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_projects_company_id ON public.projects(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_customer_id ON public.projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_project_type ON public.projects(project_type);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON public.projects(updated_at DESC);

-- Drop existing policies if they exist (for re-running the script)
DROP POLICY IF EXISTS "Users can view projects for their company" ON public.projects;
DROP POLICY IF EXISTS "Users can insert projects for their company" ON public.projects;
DROP POLICY IF EXISTS "Users can update projects for their company" ON public.projects;
DROP POLICY IF EXISTS "Users can delete projects for their company" ON public.projects;

-- Create policy to allow users to view projects for their company
CREATE POLICY "Users can view projects for their company" ON public.projects
  FOR SELECT USING (
    company_id = (
      SELECT raw_user_meta_data->>'companyID' 
      FROM auth.users 
      WHERE id = auth.uid()
    )
  );

-- Create policy to allow users to insert projects for their company
CREATE POLICY "Users can insert projects for their company" ON public.projects
  FOR INSERT WITH CHECK (
    company_id = (
      SELECT raw_user_meta_data->>'companyID' 
      FROM auth.users 
      WHERE id = auth.uid()
    )
  );

-- Create policy to allow users to update projects for their company
CREATE POLICY "Users can update projects for their company" ON public.projects
  FOR UPDATE USING (
    company_id = (
      SELECT raw_user_meta_data->>'companyID' 
      FROM auth.users 
      WHERE id = auth.uid()
    )
  );

-- Create policy to allow users to delete projects for their company
CREATE POLICY "Users can delete projects for their company" ON public.projects
  FOR DELETE USING (
    company_id = (
      SELECT raw_user_meta_data->>'companyID' 
      FROM auth.users 
      WHERE id = auth.uid()
    )
  );

-- Note: You need to create a Supabase Storage bucket named 'project-documents'
-- Go to Storage in your Supabase dashboard and create a bucket with:
-- Name: project-documents
-- Public: false (or true if you want public access)
-- File size limit: Set according to your needs
-- Allowed MIME types: Leave empty to allow all types, or specify types like 'image/*,application/pdf'

-- Storage Policies for project-documents bucket
-- These policies allow authenticated users to upload, read, and delete files for their company

-- Drop existing policies if they exist (for re-running the script)
DROP POLICY IF EXISTS "Users can upload documents for their company projects" ON storage.objects;
DROP POLICY IF EXISTS "Users can read documents for their company projects" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete documents for their company projects" ON storage.objects;

-- Policy to allow users to upload files to their company's folder
-- File path structure: {companyID}/projects/{projectId}/{fileName}
-- Using LIKE pattern match which checks if path starts with companyID/
CREATE POLICY "Users can upload documents for their company projects"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-documents' AND
  (
    SELECT (raw_user_meta_data->>'companyID') || '/%'
    FROM auth.users 
    WHERE id = auth.uid()
    AND raw_user_meta_data->>'companyID' IS NOT NULL
  ) IS NOT NULL
  AND
  name LIKE (
    SELECT (raw_user_meta_data->>'companyID') || '/%'
    FROM auth.users 
    WHERE id = auth.uid()
  )
);

-- Policy to allow users to read files from their company's folder
CREATE POLICY "Users can read documents for their company projects"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-documents' AND
  name LIKE (
    SELECT COALESCE(raw_user_meta_data->>'companyID', '') || '/%'
    FROM auth.users 
    WHERE id = auth.uid()
  )
);

-- Policy to allow users to delete files from their company's folder
CREATE POLICY "Users can delete documents for their company projects"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-documents' AND
  name LIKE (
    SELECT COALESCE(raw_user_meta_data->>'companyID', '') || '/%'
    FROM auth.users 
    WHERE id = auth.uid()
  )
);

-- Policy to allow users to update files in their company's folder (for replacing files)
CREATE POLICY "Users can update documents for their company projects"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'project-documents' AND
  name LIKE (
    SELECT COALESCE(raw_user_meta_data->>'companyID', '') || '/%'
    FROM auth.users 
    WHERE id = auth.uid()
  )
);

