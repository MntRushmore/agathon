-- ============================================
-- AGGRESSIVE FIX: Remove ALL Classes Policies and Recreate
-- ============================================
-- This completely drops and recreates all classes policies
-- to eliminate any circular dependencies
-- Date: 2026-01-13
-- ============================================

-- ============================================
-- STEP 1: Drop ALL policies on classes table
-- ============================================
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'classes' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON classes';
    END LOOP;
END $$;

-- ============================================
-- STEP 2: Recreate MINIMAL policies (no recursion)
-- ============================================

-- Allow authenticated users to view classes where they are the teacher
CREATE POLICY "classes_select_teacher"
  ON classes FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

-- Allow authenticated users to view classes they're enrolled in (via class_members)
CREATE POLICY "classes_select_student"
  ON classes FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT class_id FROM class_members WHERE student_id = auth.uid()
    )
  );

-- Allow authenticated users to insert classes where they are the teacher
-- CRITICAL: No subquery to profiles table - this prevents recursion
CREATE POLICY "classes_insert_teacher"
  ON classes FOR INSERT
  TO authenticated
  WITH CHECK (teacher_id = auth.uid());

-- Allow teachers to update their own classes
CREATE POLICY "classes_update_teacher"
  ON classes FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- Allow teachers to delete their own classes
CREATE POLICY "classes_delete_teacher"
  ON classes FOR DELETE
  TO authenticated
  USING (teacher_id = auth.uid());

-- ============================================
-- STEP 3: Verify policies
-- ============================================
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'classes' AND schemaname = 'public'
ORDER BY policyname;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT '✅ All classes policies recreated without circular dependencies!' AS status;
