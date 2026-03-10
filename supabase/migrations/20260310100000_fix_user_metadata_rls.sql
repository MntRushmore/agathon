-- Fix RLS policies that insecurely reference auth.jwt()->'user_metadata'
-- user_metadata is editable by end users and should never be used for authorization.
-- Instead, reference the profiles table which is protected by its own RLS.

-- ============================================================
-- 1. Fix whiteboards policies
-- ============================================================

-- Drop insecure policies
DROP POLICY IF EXISTS "Teachers can view all whiteboards" ON public.whiteboards;
DROP POLICY IF EXISTS "Admins can update any whiteboard" ON public.whiteboards;
DROP POLICY IF EXISTS "Admins can delete any whiteboard" ON public.whiteboards;

-- Recreate with secure profiles-based checks
CREATE POLICY "Teachers can view all whiteboards" ON public.whiteboards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'teacher'
    )
  );

CREATE POLICY "Admins can update any whiteboard" ON public.whiteboards
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete any whiteboard" ON public.whiteboards
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================
-- 2. Fix profiles policies
-- ============================================================

DROP POLICY IF EXISTS "Teachers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;

CREATE POLICY "Teachers can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid()
      AND p.role = 'teacher'
    )
  );

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- ============================================================
-- 3. Fix ai_usage policies
-- ============================================================

DROP POLICY IF EXISTS "Admins can view all ai_usage" ON public.ai_usage;

CREATE POLICY "Admins can view all ai_usage" ON public.ai_usage
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================
-- 4. Fix ai_cost_summary view (SECURITY DEFINER -> INVOKER)
-- ============================================================

-- Drop and recreate the view with security_invoker = true
DROP VIEW IF EXISTS public.ai_cost_summary;

CREATE VIEW public.ai_cost_summary WITH (security_invoker = true) AS
SELECT
  count(*) AS total_interactions,
  coalesce(sum(input_tokens), 0) AS total_input_tokens,
  coalesce(sum(output_tokens), 0) AS total_output_tokens,
  coalesce(sum(total_cost), 0) AS total_cost_usd,
  count(DISTINCT student_id) AS unique_users,
  date(created_at) AS date
FROM public.ai_usage
GROUP BY date(created_at);
