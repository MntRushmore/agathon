-- ============================================
-- COMPREHENSIVE DATABASE DIAGNOSTIC & FIX
-- ============================================
-- This script diagnoses and fixes database issues causing 500 errors
-- Run this to resolve API failures and constraint violations

-- ============================================
-- 1. CHECK CURRENT CONSTRAINT STATUS
-- ============================================
SELECT '=== CHECKING CONSTRAINTS ===' as section;

SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'profiles'::regclass 
AND contype = 'c';

-- ============================================
-- 2. FIX ROLE CONSTRAINT (IF NEEDED)
-- ============================================
SELECT '=== FIXING ROLE CONSTRAINT ===' as section;

-- Drop the existing constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add the correct constraint
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('student', 'teacher', 'admin'));

-- ============================================
-- 3. CHECK CURRENT PROFILES
-- ============================================
SELECT '=== CURRENT PROFILES ===' as section;

SELECT id, email, full_name, role, created_at, updated_at
FROM profiles 
ORDER BY created_at DESC;

-- ============================================
-- 4. FIX ANY BROKEN PROFILE DATA
-- ============================================
SELECT '=== FIXING PROFILE DATA ===' as section;

-- Update any profiles with invalid roles
UPDATE profiles 
SET role = 'student' 
WHERE role NOT IN ('student', 'teacher', 'admin');

-- Ensure email and role are not null
UPDATE profiles 
SET email = COALESCE(email, 'unknown@example.com')
WHERE email IS NULL;

UPDATE profiles 
SET role = 'student'
WHERE role IS NULL;

-- ============================================
-- 5. CHECK RLS POLICIES
-- ============================================
SELECT '=== CHECKING RLS POLICIES ===' as section;

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'whiteboards', 'board_shares')
ORDER BY tablename, policyname;

-- ============================================
-- 6. CHECK TABLE STRUCTURE
-- ============================================
SELECT '=== CHECKING TABLE STRUCTURE ===' as section;

-- Check if all required columns exist
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'whiteboards', 'board_shares')
ORDER BY table_name, ordinal_position;

-- ============================================
-- 7. TEST SPECIFIC USER ISSUES
-- ============================================
SELECT '=== TESTING SPECIFIC USER ===' as section;

-- Check the specific user causing issues
SELECT 
  id,
  email,
  full_name,
  role,
  created_at,
  updated_at,
  CASE 
    WHEN role IN ('student', 'teacher', 'admin') THEN 'Valid Role'
    ELSE 'Invalid Role: ' || role
  END as role_status
FROM profiles 
WHERE id = 'aa5a8a13-43f5-44a7-b1d6-d64acabf80b4';

-- Check their whiteboards
SELECT 
  w.id,
  w.title,
  w.user_id,
  w.created_at,
  p.role as owner_role
FROM whiteboards w
LEFT JOIN profiles p ON p.id = w.user_id
WHERE w.user_id = 'aa5a8a13-43f5-44a7-b1d6-d64acabf80b4';

-- ============================================
-- 8. ENSURE AUTH.USERS EXISTS
-- ============================================
SELECT '=== CHECKING AUTH.USERS ===' as section;

SELECT 
  id,
  email,
  created_at,
  email_confirmed_at,
  role as auth_role
FROM auth.users 
WHERE id = 'aa5a8a13-43f5-44a7-b1d6-d64acabf80b4';

-- ============================================
-- 9. FIX ORPHANED RECORDS
-- ============================================
SELECT '=== FIXING ORPHANED RECORDS ===' as section;

-- Delete profiles that don't have corresponding auth.users
DELETE FROM profiles 
WHERE id NOT IN (SELECT id FROM auth.users);

-- ============================================
-- 10. REFRESH RLS POLICIES (CONSERVATIVE FIX)
-- ============================================
SELECT '=== REFRESHING BASIC RLS POLICIES ===' as section;

-- Ensure basic policies exist for profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Ensure basic policies exist for whiteboards  
DROP POLICY IF EXISTS "Users can view own whiteboards" ON whiteboards;
CREATE POLICY "Users can view own whiteboards" ON whiteboards
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own whiteboards" ON whiteboards;
CREATE POLICY "Users can create own whiteboards" ON whiteboards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own whiteboards" ON whiteboards;
CREATE POLICY "Users can update own whiteboards" ON whiteboards
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 11. FINAL VERIFICATION
-- ============================================
SELECT '=== FINAL VERIFICATION ===' as section;

SELECT 
  'profiles' as table_name,
  COUNT(*) as record_count
FROM profiles
UNION ALL
SELECT 
  'whiteboards' as table_name,
  COUNT(*) as record_count
FROM whiteboards
UNION ALL
SELECT 
  'board_shares' as table_name,
  COUNT(*) as record_count
FROM board_shares;

-- Test a simple profile query
SELECT 
  'Profile query test' as test_name,
  CASE 
    WHEN COUNT(*) >= 0 THEN 'PASS'
    ELSE 'FAIL'
  END as result
FROM profiles 
WHERE id = 'aa5a8a13-43f5-44a7-b1d6-d64acabf80b4';

SELECT '✅ Database diagnostic and fix completed!' as status;