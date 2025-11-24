-- Check user metadata for all users
-- This will show you what's stored in user_metadata
SELECT 
  id,
  email,
  raw_user_meta_data,
  raw_user_meta_data->>'companyID' as company_id,
  created_at
FROM auth.users
ORDER BY created_at DESC;

-- If you want to check a specific user by email:
-- SELECT 
--   id,
--   email,
--   raw_user_meta_data,
--   raw_user_meta_data->>'companyID' as company_id
-- FROM auth.users
-- WHERE email = 'your-email@example.com';

