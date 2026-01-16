-- ============================================
-- DIAGNOSTIC: Check Why Admin Can't See All Users
-- ============================================
-- Run this to see what's blocking the admin dashboard

-- ============================================
-- 1. CHECK YOUR CURRENT USER
-- ============================================
SELECT '=== YOUR PROFILE ===' as section;

SELECT
  id,
  email,
  full_name,
  role,
  created_at
FROM profiles
WHERE email = 'rushilchopra123@gmail.com';

-- ============================================
-- 2. CHECK ALL USERS IN DATABASE
-- ============================================
SELECT '=== ALL PROFILES IN DATABASE ===' as section;

SELECT
  id,
  email,
  full_name,
  role,
  created_at
FROM profiles
ORDER BY created_at DESC;

-- ============================================
-- 3. CHECK METADATA SYNC
-- ============================================
SELECT '=== METADATA SYNC STATUS ===' as section;

SELECT
  p.email,
  p.role as profile_role,
  u.raw_user_meta_data->>'role' as jwt_metadata_role,
  CASE
    WHEN p.role = u.raw_user_meta_data->>'role' THEN '✅ Synced'
    ELSE '❌ NOT SYNCED - THIS IS THE PROBLEM!'
  END as sync_status
FROM profiles p
JOIN auth.users u ON u.id = p.id
ORDER BY p.created_at DESC;

-- ============================================
-- 4. CHECK ADMIN POLICIES EXIST
-- ============================================
SELECT '=== ADMIN POLICIES ===' as section;

SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname LIKE '%Admin%'
ORDER BY tablename, policyname;

-- ============================================
-- 5. CHECK ALL WHITEBOARDS
-- ============================================
SELECT '=== ALL WHITEBOARDS IN DATABASE ===' as section;

SELECT
  w.id,
  w.title,
  w.user_id,
  p.email as owner_email,
  w.created_at
FROM whiteboards w
LEFT JOIN profiles p ON p.id = w.user_id
ORDER BY w.created_at DESC
LIMIT 20;

-- ============================================
-- 6. COUNT EVERYTHING
-- ============================================
SELECT '=== COUNTS ===' as section;

SELECT
  'Total Users' as item,
  COUNT(*) as count
FROM profiles

UNION ALL

SELECT
  'Total Whiteboards' as item,
  COUNT(*) as count
FROM whiteboards

UNION ALL

SELECT
  'Total AI Usage' as item,
  COUNT(*) as count
FROM ai_usage;

-- ============================================
-- 7. FIX METADATA IF NOT SYNCED
-- ============================================
SELECT '=== ATTEMPTING TO FIX METADATA ===' as section;

-- Force sync all users right now
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

  RAISE NOTICE 'Metadata sync completed for all users';
END $$;

-- ============================================
-- 8. VERIFY THE FIX
-- ============================================
SELECT '=== VERIFICATION AFTER FIX ===' as section;

SELECT
  p.email,
  p.role as profile_role,
  u.raw_user_meta_data->>'role' as jwt_metadata_role,
  u.raw_user_meta_data as full_metadata,
  CASE
    WHEN p.role = u.raw_user_meta_data->>'role' THEN '✅ NOW SYNCED'
    ELSE '❌ STILL NOT SYNCED'
  END as sync_status
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.email = 'rushilchopra123@gmail.com';

-- ============================================
-- COMPLETION MESSAGE
-- ============================================
SELECT '✅ Diagnostic complete! Check the results above.' as status;
SELECT 'If metadata is NOW SYNCED, sign out and back in to refresh your JWT token.' as next_step;
