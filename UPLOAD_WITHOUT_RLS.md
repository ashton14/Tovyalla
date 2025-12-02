# Upload Files Without RLS - Options Guide

You have several options to upload files without Row Level Security (RLS) restrictions:

## Option 1: Upload via Backend API (RECOMMENDED) ✅

**Best approach** - Uses service role key to bypass RLS while maintaining security.

### How it works:
- Frontend sends file to your backend API
- Backend uses service role key (bypasses RLS)
- Backend still verifies user authentication and company ownership
- More secure than disabling RLS entirely

### Implementation:

**Backend endpoint is already updated** in `server.js` to accept base64 file uploads.

**Update frontend** to use the backend endpoint:

```javascript
// In DocumentsModal.jsx, replace the upload function:

const handleFileUpload = async (event) => {
  const file = event.target.files[0]
  if (!file || !supabase) return

  setUploading(true)
  setError('')
  setSuccess('')

  try {
    const token = await getAuthToken()
    if (!token) {
      throw new Error('Not authenticated')
    }

    // Convert file to base64
    const reader = new FileReader()
    reader.onloadend = async () => {
      try {
        const response = await fetch(
          `/api/documents/${entityType}/${entityId}/upload`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fileData: reader.result, // base64 string
              fileName: file.name,
              contentType: file.type,
            }),
          }
        )

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Upload failed')
        }

        setSuccess('Document uploaded successfully!')
        setTimeout(() => setSuccess(''), 3000)
        fetchDocuments()
        event.target.value = ''
      } catch (err) {
        console.error('Upload error:', err)
        setError(err.message || 'Failed to upload document')
      } finally {
        setUploading(false)
      }
    }
    reader.readAsDataURL(file)
  } catch (err) {
    console.error('Error:', err)
    setError(err.message || 'Failed to upload document')
    setUploading(false)
  }
}
```

---

## Option 2: Disable RLS Entirely (NOT RECOMMENDED) ⚠️

**Security risk** - Removes all security from storage bucket.

### Run this SQL in Supabase SQL Editor:

```sql
-- Disable RLS on storage.objects
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
```

**To re-enable later:**
```sql
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
```

**⚠️ Warning:** This allows anyone with access to upload/delete any files. Only use for development/testing.

---

## Option 3: Permissive RLS Policies (NOT RECOMMENDED) ⚠️

**Less secure** - Allows all authenticated users to access any files.

### Run this SQL in Supabase SQL Editor:

```sql
-- Drop existing policies
DROP POLICY IF EXISTS "Allow all authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow all authenticated views" ON storage.objects;
DROP POLICY IF EXISTS "Allow all authenticated deletes" ON storage.objects;

-- Allow any authenticated user to upload
CREATE POLICY "Allow all authenticated uploads"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' AND
  auth.uid() IS NOT NULL
);

-- Allow any authenticated user to view
CREATE POLICY "Allow all authenticated views"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' AND
  auth.uid() IS NOT NULL
);

-- Allow any authenticated user to delete
CREATE POLICY "Allow all authenticated deletes"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' AND
  auth.uid() IS NOT NULL
);
```

**⚠️ Warning:** Users can access other companies' files. Not recommended for production.

---

## Option 4: Fix RLS Policies Properly (BEST LONG-TERM) ✅

**Recommended for production** - Fixes the RLS policies to work correctly.

### Run `fix-storage-rls.sql` in Supabase SQL Editor:

This creates proper policies that check companyID at index [1] in the path.

**Why this is best:**
- Maintains security
- Users can only access their company's files
- Properly configured RLS policies

---

## Quick Comparison

| Option | Security | Recommended | Use Case |
|--------|----------|-------------|----------|
| Backend API Upload | ✅ High | ✅ Yes | Production |
| Fix RLS Policies | ✅ High | ✅ Yes | Production |
| Disable RLS | ❌ None | ❌ No | Dev/Testing only |
| Permissive Policies | ⚠️ Low | ❌ No | Dev/Testing only |

---

## Recommendation

**For immediate fix:** Use Option 1 (Backend API Upload) - it's already implemented in your backend.

**For long-term:** Fix the RLS policies (Option 4) using `fix-storage-rls.sql` - this is the proper solution.

