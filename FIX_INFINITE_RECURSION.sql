-- ============================================
-- FIX INFINITE RECURSION IN RLS POLICIES
-- ============================================
-- This script fixes the infinite recursion errors in profiles and whiteboards RLS policies
-- Error: "infinite recursion detected in policy for relation"

-- ============================================
-- 1. DROP PROBLEMATIC POLICIES
-- ============================================

-- Drop the recursive profiles policies
DROP POLICY IF EXISTS "Teachers can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Drop the recursive whiteboards policies
DROP POLICY IF EXISTS "Teachers can view all whiteboards" ON whiteboards;
DROP POLICY IF EXISTS "Users can view own whiteboards" ON whiteboards;
DROP POLICY IF EXISTS "Users can create own whiteboards" ON whiteboards;
DROP POLICY IF EXISTS "Users can update own whiteboards" ON whiteboards;
DROP POLICY IF EXISTS "Users can delete own whiteboards" ON whiteboards;
DROP POLICY IF EXISTS "Users can view shared whiteboards" ON whiteboards;
DROP POLICY IF EXISTS "Users can update shared whiteboards with edit permission" ON whiteboards;

-- ============================================
-- 2. CREATE NON-RECURSIVE POLICIES FOR PROFILES
-- ============================================

-- Simple policy: Users can view their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Teachers can view all profiles - Fixed to avoid recursion
-- We check the role directly from auth.jwt() metadata instead of querying profiles table
CREATE POLICY "Teachers can view all profiles" ON profiles
  FOR SELECT
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'teacher'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can update any profile
CREATE POLICY "Admins can update any profile" ON profiles
  FOR UPDATE
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- ============================================
-- 3. CREATE NON-RECURSIVE POLICIES FOR WHITEBOARDS
-- ============================================

-- Users can view their own whiteboards
CREATE POLICY "Users can view own whiteboards" ON whiteboards
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own whiteboards
CREATE POLICY "Users can create own whiteboards" ON whiteboards
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own whiteboards
CREATE POLICY "Users can update own whiteboards" ON whiteboards
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own whiteboards
CREATE POLICY "Users can delete own whiteboards" ON whiteboards
  FOR DELETE
  USING (auth.uid() = user_id);

-- Teachers can view all whiteboards - Fixed to avoid recursion
CREATE POLICY "Teachers can view all whiteboards" ON whiteboards
  FOR SELECT
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'teacher'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Admins can view all whiteboards
CREATE POLICY "Admins can view all whiteboards" ON whiteboards
  FOR SELECT
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Admins can update any whiteboard
CREATE POLICY "Admins can update any whiteboard" ON whiteboards
  FOR UPDATE
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Admins can delete any whiteboard
CREATE POLICY "Admins can delete any whiteboard" ON whiteboards
  FOR DELETE
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Users can view shared whiteboards
CREATE POLICY "Users can view shared whiteboards" ON whiteboards
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM board_shares
      WHERE board_shares.board_id = whiteboards.id
        AND board_shares.shared_with_user_id = auth.uid()
    )
  );

-- Users can update shared whiteboards with edit permission
CREATE POLICY "Users can update shared whiteboards with edit permission" ON whiteboards
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM board_shares
      WHERE board_shares.board_id = whiteboards.id
        AND board_shares.shared_with_user_id = auth.uid()
        AND board_shares.permission = 'edit'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM board_shares
      WHERE board_shares.board_id = whiteboards.id
        AND board_shares.shared_with_user_id = auth.uid()
        AND board_shares.permission = 'edit'
    )
  );

-- ============================================
-- 4. VERIFY POLICIES
-- ============================================

-- Check that policies were created successfully
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'whiteboards')
ORDER BY tablename, policyname;

-- ============================================
-- COMPLETION MESSAGE
-- ============================================
SELECT '✅ Infinite recursion fix completed! RLS policies have been recreated without recursion.' as status;
