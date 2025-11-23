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

