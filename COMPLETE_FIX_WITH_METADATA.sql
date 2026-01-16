-- ============================================
-- COMPLETE FIX: RLS Policies + Metadata Sync
-- ============================================
-- This script fixes infinite recursion AND sets up metadata sync
-- Run this entire script in your Supabase SQL Editor

-- ============================================
-- PART 1: FIX INFINITE RECURSION
-- ============================================

-- Drop problematic recursive policies
DROP POLICY IF EXISTS "Teachers can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Teachers can view all whiteboards" ON whiteboards;
DROP POLICY IF EXISTS "Users can view own whiteboards" ON whiteboards;
DROP POLICY IF EXISTS "Users can create own whiteboards" ON whiteboards;
DROP POLICY IF EXISTS "Users can update own whiteboards" ON whiteboards;
DROP POLICY IF EXISTS "Users can delete own whiteboards" ON whiteboards;
DROP POLICY IF EXISTS "Users can view shared whiteboards" ON whiteboards;
DROP POLICY IF EXISTS "Users can update shared whiteboards with edit permission" ON whiteboards;

-- ============================================
-- PART 2: UPDATE ROLE CONSTRAINT
-- ============================================

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'teacher', 'admin'));

-- ============================================
-- PART 3: CREATE METADATA SYNC FUNCTION
-- ============================================

-- Function to sync role to user metadata (required for JWT-based policies)
CREATE OR REPLACE FUNCTION sync_role_to_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the user's metadata in auth.users
  UPDATE auth.users
  SET raw_user_meta_data =
    COALESCE(raw_user_meta_data, '{}'::jsonb) ||
    jsonb_build_object('role', NEW.role)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-sync role changes
DROP TRIGGER IF EXISTS sync_role_to_metadata_trigger ON profiles;
CREATE TRIGGER sync_role_to_metadata_trigger
  AFTER INSERT OR UPDATE OF role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_role_to_metadata();

-- ============================================
-- PART 4: SYNC EXISTING USERS
-- ============================================

-- Sync all existing users' roles to their metadata
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
-- PART 5: CREATE NON-RECURSIVE POLICIES FOR PROFILES
-- ============================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Teachers can view all profiles (using JWT metadata - no recursion!)
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

-- Admins can insert profiles (for user management)
CREATE POLICY "Admins can insert profiles" ON profiles
  FOR INSERT
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- ============================================
-- PART 6: CREATE NON-RECURSIVE POLICIES FOR WHITEBOARDS
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

-- Teachers can view all whiteboards (using JWT metadata - no recursion!)
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
-- PART 7: VERIFY EVERYTHING
-- ============================================

-- Check policies were created
SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'whiteboards')
ORDER BY tablename, policyname;

-- Check that metadata was synced
SELECT
  p.email,
  p.role as profile_role,
  u.raw_user_meta_data->>'role' as metadata_role,
  CASE
    WHEN p.role = u.raw_user_meta_data->>'role' THEN '✅ Synced'
    ELSE '❌ Not Synced'
  END as sync_status
FROM profiles p
JOIN auth.users u ON u.id = p.id
ORDER BY p.created_at DESC
LIMIT 10;

-- ============================================
-- COMPLETION MESSAGE
-- ============================================
SELECT '✅ Complete fix applied! All policies updated and metadata synced.' as status;

-- ============================================
-- NEXT STEPS
-- ============================================
-- 1. Make yourself an admin (replace with your email):
--    UPDATE profiles SET role = 'admin' WHERE email = 'your-email@example.com';
--
-- 2. Sign out and sign back in to refresh your JWT token
--
-- 3. The admin dashboard should now work perfectly!
