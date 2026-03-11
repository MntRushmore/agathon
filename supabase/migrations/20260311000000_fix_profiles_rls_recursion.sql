-- Fix circular RLS dependency on profiles table
-- The profiles RLS policies reference profiles itself, causing infinite recursion
-- and 500 errors on all queries to profiles and whiteboards.
--
-- Solution: Create a SECURITY DEFINER function that bypasses RLS to check the
-- user's role, then use it in all role-based RLS policies.

-- ============================================================
-- 1. Create a secure role-checking function (bypasses RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = user_id LIMIT 1;
$$;

-- Revoke public access — only authenticated users should call this
REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;

-- ============================================================
-- 2. Ensure base self-access policies exist for profiles
-- ============================================================

-- Users must be able to read their own profile (this is fundamental)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (id = auth.uid());

-- Users must be able to update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- ============================================================
-- 3. Fix profiles role-based policies (remove circular refs)
-- ============================================================

DROP POLICY IF EXISTS "Teachers can view all profiles" ON public.profiles;
CREATE POLICY "Teachers can view all profiles" ON public.profiles
  FOR SELECT USING (
    public.get_user_role(auth.uid()) = 'teacher'
  );

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    public.get_user_role(auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE USING (
    public.get_user_role(auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (
    public.get_user_role(auth.uid()) = 'admin'
  );

-- ============================================================
-- 4. Fix whiteboards role-based policies (use function too)
-- ============================================================

DROP POLICY IF EXISTS "Teachers can view all whiteboards" ON public.whiteboards;
CREATE POLICY "Teachers can view all whiteboards" ON public.whiteboards
  FOR SELECT USING (
    public.get_user_role(auth.uid()) = 'teacher'
  );

DROP POLICY IF EXISTS "Admins can update any whiteboard" ON public.whiteboards;
CREATE POLICY "Admins can update any whiteboard" ON public.whiteboards
  FOR UPDATE USING (
    public.get_user_role(auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "Admins can delete any whiteboard" ON public.whiteboards;
CREATE POLICY "Admins can delete any whiteboard" ON public.whiteboards
  FOR DELETE USING (
    public.get_user_role(auth.uid()) = 'admin'
  );

-- ============================================================
-- 5. Ensure base self-access policies exist for whiteboards
-- ============================================================

-- Users must be able to read their own whiteboards
DROP POLICY IF EXISTS "Users can view own whiteboards" ON public.whiteboards;
CREATE POLICY "Users can view own whiteboards" ON public.whiteboards
  FOR SELECT USING (user_id = auth.uid());

-- Users must be able to create whiteboards
DROP POLICY IF EXISTS "Users can create whiteboards" ON public.whiteboards;
CREATE POLICY "Users can create whiteboards" ON public.whiteboards
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users must be able to update their own whiteboards
DROP POLICY IF EXISTS "Users can update own whiteboards" ON public.whiteboards;
CREATE POLICY "Users can update own whiteboards" ON public.whiteboards
  FOR UPDATE USING (user_id = auth.uid());

-- Users must be able to delete their own whiteboards
DROP POLICY IF EXISTS "Users can delete own whiteboards" ON public.whiteboards;
CREATE POLICY "Users can delete own whiteboards" ON public.whiteboards
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- 6. Fix ai_usage policy (also referenced profiles directly)
-- ============================================================

DROP POLICY IF EXISTS "Admins can view all ai_usage" ON public.ai_usage;
CREATE POLICY "Admins can view all ai_usage" ON public.ai_usage
  FOR SELECT USING (
    public.get_user_role(auth.uid()) = 'admin'
  );
