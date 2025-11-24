-- Test and Fix Storage Policies
-- This uses a helper function approach which is more reliable

-- First, let's verify the user's companyID is accessible
-- Run this to check your companyID:
-- SELECT id, raw_user_meta_data->>'companyID' as company_id FROM auth.users WHERE id = auth.uid();

-- Drop existing policies
DROP POLICY IF EXISTS "Users can upload documents for their company projects" ON storage.objects;
DROP POLICY IF EXISTS "Users can read documents for their company projects" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete documents for their company projects" ON storage.objects;
DROP POLICY IF EXISTS "Users can update documents for their company projects" ON storage.objects;

-- Create a helper function to get company ID (more reliable than subquery in policy)
CREATE OR REPLACE FUNCTION auth.user_company_id()
RETURNS TEXT AS $$
  SELECT raw_user_meta_data->>'companyID' FROM auth.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Policy to allow users to upload files to their company's folder
CREATE POLICY "Users can upload documents for their company projects"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-documents' AND
  name LIKE (auth.user_company_id() || '/%')
);

-- Policy to allow users to read files from their company's folder
CREATE POLICY "Users can read documents for their company projects"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-documents' AND
  name LIKE (auth.user_company_id() || '/%')
);

-- Policy to allow users to delete files from their company's folder
CREATE POLICY "Users can delete documents for their company projects"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-documents' AND
  name LIKE (auth.user_company_id() || '/%')
);

-- Policy to allow users to update files in their company's folder
CREATE POLICY "Users can update documents for their company projects"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'project-documents' AND
  name LIKE (auth.user_company_id() || '/%')
);

