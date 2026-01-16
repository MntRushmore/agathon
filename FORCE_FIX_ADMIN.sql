-- ============================================
-- FORCE FIX: Admin Access (Quick Version)
-- ============================================
-- Run this if you already ran V2 but still can't see users

-- ============================================
-- STEP 1: Ensure you are admin
-- ============================================
UPDATE profiles
SET role = 'admin'
WHERE email = 'rushilchopra123@gmail.com';

-- ============================================
-- STEP 2: Force sync YOUR metadata immediately
-- ============================================
UPDATE auth.users
SET raw_user_meta_data =
  COALESCE(raw_user_meta_data, '{}'::jsonb) ||
  jsonb_build_object('role', 'admin')
WHERE id IN (
  SELECT id FROM profiles WHERE email = 'rushilchopra123@gmail.com'
);

-- ============================================
-- STEP 3: Force sync ALL users metadata
-- ============================================
DO $$
DECLARE
  profile_record RECORD;
BEGIN
  FOR profile_record IN SELECT id, role FROM profiles LOOP
    UPDATE auth.users
    SET raw_user_meta_data =
      COALESCE(raw_user_meta_data, '{}'::jsonb) ||
      jsonb_build_object('role', profile_record.role)
    WHERE id = profile_record.id;
  END LOOP;
END $$;

-- ============================================
-- STEP 4: Verify your metadata
-- ============================================
SELECT
  p.email,
  p.role as db_role,
  u.raw_user_meta_data->>'role' as jwt_role,
  CASE
    WHEN p.role = u.raw_user_meta_data->>'role' THEN '✅ SYNCED - Now sign out and back in!'
    ELSE '❌ NOT SYNCED - Contact support'
  END as status
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.email = 'rushilchopra123@gmail.com';

-- ============================================
-- STEP 5: Show what you SHOULD be able to see
-- ============================================
SELECT '=== Users you SHOULD see after signing out/in ===' as message;

SELECT
  email,
  full_name,
  role,
  created_at
FROM profiles
ORDER BY created_at DESC;

SELECT '=== Whiteboards you SHOULD see ===' as message;

SELECT
  w.id,
  w.title,
  p.email as owner,
  w.created_at
FROM whiteboards w
LEFT JOIN profiles p ON p.id = w.user_id
ORDER BY w.created_at DESC
LIMIT 20;

-- ============================================
-- COMPLETION
-- ============================================
SELECT '✅ Force fix completed!' as status;
SELECT '⚠️ IMPORTANT: You MUST sign out and sign back in for this to work!' as warning;
SELECT 'Your JWT token needs to be refreshed with the new admin role metadata.' as explanation;
