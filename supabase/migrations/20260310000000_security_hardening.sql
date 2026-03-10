-- ============================================
-- Security Hardening Migration
-- ============================================
-- Fixes overly permissive RLS policies that allow any authenticated user
-- to insert/modify records they shouldn't have access to.
-- No data is deleted or modified — only policies are tightened.

-- ============================================
-- 1. Fix struggle_indicators INSERT policy
-- ============================================
-- The old policy "System can insert struggle indicators" used WITH CHECK (true),
-- allowing ANY authenticated user to insert arbitrary struggle indicators.
-- Service role (used by API routes) bypasses RLS anyway, so this open policy is unnecessary.

DROP POLICY IF EXISTS "System can insert struggle indicators" ON struggle_indicators;

-- ============================================
-- 2. Fix concept_mastery open policy
-- ============================================
-- The old policy "System can manage concept mastery" used FOR ALL WITH CHECK (true),
-- allowing ANY authenticated user full read/write access to all concept mastery records.
-- Replace with a scoped policy that restricts users to their own records.

DROP POLICY IF EXISTS "System can manage concept mastery" ON concept_mastery;

CREATE POLICY "Students can manage own concept mastery"
  ON concept_mastery FOR ALL
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());
