# Supabase Storage Setup for Project Documents

## Create the Storage Bucket

To enable document uploads for projects, you need to create a storage bucket in Supabase:

### Steps:

1. **Go to your Supabase Dashboard**
   - Navigate to your project at https://supabase.com/dashboard

2. **Open Storage**
   - Click on "Storage" in the left sidebar

3. **Create New Bucket**
   - Click the "New bucket" button
   - Or click "Create a new bucket" if you don't have any buckets yet

4. **Configure the Bucket**
   - **Name**: `project-documents` (must match exactly)
   - **Public**: 
     - `false` (recommended) - Files will be private, signed URLs will be used
     - `true` - Files will be publicly accessible via public URLs
   - **File size limit**: Set according to your needs (e.g., 50MB, 100MB)
   - **Allowed MIME types**: 
     - Leave empty to allow all file types
     - Or specify: `image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document`

5. **Click "Create bucket"**

## Storage Policies (REQUIRED if bucket is private)

**IMPORTANT:** If your bucket is private or has RLS enabled, you MUST set up these policies or you'll get "row-level security policy" errors.

The policies are included in `database_setup.sql` at the end of the file. You can run them directly, or copy the SQL below:

### Run this SQL in your Supabase SQL Editor:

```sql
-- Drop existing policies if they exist (for re-running the script)
DROP POLICY IF EXISTS "Users can upload documents for their company projects" ON storage.objects;
DROP POLICY IF EXISTS "Users can read documents for their company projects" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete documents for their company projects" ON storage.objects;
DROP POLICY IF EXISTS "Users can update documents for their company projects" ON storage.objects;

-- Policy to allow users to upload files to their company's folder
-- File path structure: {companyID}/projects/{projectId}/{fileName}
-- storage.foldername(name)[0] = companyID (first folder in path)
CREATE POLICY "Users can upload documents for their company projects"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-documents' AND
  (storage.foldername(name))[0] = (
    SELECT raw_user_meta_data->>'companyID' 
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
  (storage.foldername(name))[0] = (
    SELECT raw_user_meta_data->>'companyID' 
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
  (storage.foldername(name))[0] = (
    SELECT raw_user_meta_data->>'companyID' 
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
  (storage.foldername(name))[0] = (
    SELECT raw_user_meta_data->>'companyID' 
    FROM auth.users 
    WHERE id = auth.uid()
  )
);
```

**Quick Fix:** Just run the storage policies section from `database_setup.sql` in your Supabase SQL Editor.

## File Structure

Files are stored in the following structure:
```
project-documents/
  └── {companyID}/
      └── projects/
          └── {projectId}/
              └── {timestamp}_{random}.{ext}
```

This ensures:
- Files are organized by company
- Each project has its own folder
- Files have unique names to prevent conflicts

## Troubleshooting

### Error: "Bucket not found"
- Make sure the bucket name is exactly `project-documents`
- Check that the bucket exists in your Supabase Storage dashboard
- Verify you're using the correct Supabase project

### Error: "Permission denied"
- Check that RLS policies are set up correctly
- Verify the user is authenticated
- Check that the company ID matches

### Files not accessible
- If bucket is private, signed URLs are used (valid for 1 hour)
- If bucket is public, public URLs are used
- Check browser console for specific error messages

