-- SIMPLIFIED Storage Policies - More Permissive for Testing
-- This allows any authenticated user to upload to project-documents bucket
-- We'll restrict by companyID in the path later

-- Drop existing policies
DROP POLICY IF EXISTS "Users can upload documents for their company projects" ON storage.objects;
DROP POLICY IF EXISTS "Users can read documents for their company projects" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete documents for their company projects" ON storage.objects;
DROP POLICY IF EXISTS "Users can update documents for their company projects" ON storage.objects;

-- TEMPORARY: Very permissive policy for testing (allows any authenticated user)
-- Remove this after testing and use the companyID-restricted policies below
CREATE POLICY "Allow authenticated uploads to project-documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'project-documents');

CREATE POLICY "Allow authenticated reads from project-documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'project-documents');

CREATE POLICY "Allow authenticated deletes from project-documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'project-documents');

CREATE POLICY "Allow authenticated updates to project-documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'project-documents');

-- ============================================
-- COMPANY-SPECIFIC POLICIES (Use after testing)
-- ============================================
-- Uncomment these and remove the permissive policies above once uploads work

/*
-- Drop the permissive policies
DROP POLICY IF EXISTS "Allow authenticated uploads to project-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from project-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from project-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to project-documents" ON storage.objects;

-- Create company-specific policies using a function
CREATE OR REPLACE FUNCTION auth.user_company_id()
RETURNS TEXT AS $$
  SELECT raw_user_meta_data->>'companyID' FROM auth.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE POLICY "Users can upload documents for their company projects"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-documents' AND
  (storage.foldername(name))[1] = auth.user_company_id()
);

CREATE POLICY "Users can read documents for their company projects"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-documents' AND
  (storage.foldername(name))[1] = auth.user_company_id()
);

CREATE POLICY "Users can delete documents for their company projects"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-documents' AND
  (storage.foldername(name))[1] = auth.user_company_id()
);

CREATE POLICY "Users can update documents for their company projects"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'project-documents' AND
  (storage.foldername(name))[1] = auth.user_company_id()
);
*/

