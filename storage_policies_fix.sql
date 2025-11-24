-- Simplified Storage Policies for project-documents bucket
-- Run this in your Supabase SQL Editor

-- Drop existing policies
DROP POLICY IF EXISTS "Users can upload documents for their company projects" ON storage.objects;
DROP POLICY IF EXISTS "Users can read documents for their company projects" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete documents for their company projects" ON storage.objects;
DROP POLICY IF EXISTS "Users can update documents for their company projects" ON storage.objects;

-- Policy to allow users to upload files to their company's folder
-- Checks if file path starts with the user's companyID
CREATE POLICY "Users can upload documents for their company projects"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-documents' AND
  name LIKE (
    SELECT COALESCE(raw_user_meta_data->>'companyID', '') || '/%'
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

-- Policy to allow users to update files in their company's folder
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

