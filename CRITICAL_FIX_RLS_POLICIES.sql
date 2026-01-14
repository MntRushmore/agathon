-- ============================================
-- CRITICAL FIX: RLS Policies and Trigger Function
-- ============================================
-- This script fixes:
-- 1. Infinite recursion error in classes RLS policies
-- 2. Missing 'name' field in trigger function
-- 3. Ensures all policies work correctly
-- 
-- Run this ENTIRE script in Supabase SQL Editor
-- Date: 2026-01-13
-- ============================================

-- ============================================
-- STEP 1: Fix Classes RLS Policies (Infinite Recursion)
-- ============================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Teachers can create classes" ON classes;
DROP POLICY IF EXISTS "Teachers can view own classes" ON classes;
DROP POLICY IF EXISTS "Students can view enrolled classes" ON classes;
DROP POLICY IF EXISTS "Teachers can update own classes" ON classes;
DROP POLICY IF EXISTS "Teachers can delete own classes" ON classes;

-- Recreate policies without circular references
-- Teachers can view their own classes (simple check, no subquery to profiles)
CREATE POLICY "Teachers can view own classes"
  ON classes FOR SELECT
  USING (auth.uid() = teacher_id);

-- Students can view classes they're enrolled in
CREATE POLICY "Students can view enrolled classes"
  ON classes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM class_members
      WHERE class_members.class_id = classes.id
        AND class_members.student_id = auth.uid()
    )
  );

-- Teachers can create classes (FIXED: removed profile role check that caused recursion)
CREATE POLICY "Teachers can create classes"
  ON classes FOR INSERT
  WITH CHECK (auth.uid() = teacher_id);

-- Teachers can update their own classes
CREATE POLICY "Teachers can update own classes"
  ON classes FOR UPDATE
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

-- Teachers can delete their own classes
CREATE POLICY "Teachers can delete own classes"
  ON classes FOR DELETE
  USING (auth.uid() = teacher_id);

-- ============================================
-- STEP 2: Fix Trigger Function (Add 'name' field)
-- ============================================

CREATE OR REPLACE FUNCTION create_submissions_for_new_member()
RETURNS TRIGGER AS $$
DECLARE
  assignment_record RECORD;
  template_board RECORD;
  new_board_id UUID;
BEGIN
  -- For each published assignment in the class
  FOR assignment_record IN
    SELECT * FROM assignments
    WHERE class_id = NEW.class_id AND is_published = true
  LOOP
    -- Get template board
    SELECT * INTO template_board FROM whiteboards
    WHERE id = assignment_record.template_board_id;

    -- Create a copy of the template board for the student
    -- FIXED: Added 'name' field which is required (NOT NULL)
    INSERT INTO whiteboards (name, user_id, title, data, metadata, preview)
    VALUES (
      assignment_record.title || ' - My Work',
      NEW.student_id,
      assignment_record.title || ' - My Work',
      template_board.data,
      jsonb_build_object(
        'isAssignment', true,
        'assignmentId', assignment_record.id,
        'templateId', template_board.id
      ) || COALESCE(template_board.metadata, '{}'::jsonb),
      template_board.preview
    )
    RETURNING id INTO new_board_id;

    -- Create submission record
    INSERT INTO submissions (assignment_id, student_id, student_board_id, status)
    VALUES (assignment_record.id, NEW.student_id, new_board_id, 'not_started');
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 3: Verify All Policies
-- ============================================

-- Check that RLS is enabled
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('classes', 'class_members', 'assignments', 'submissions', 'profiles', 'whiteboards')
ORDER BY tablename;

-- Count policies per table
SELECT 
  schemaname,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('classes', 'class_members', 'assignments', 'submissions', 'profiles', 'whiteboards')
GROUP BY schemaname, tablename
ORDER BY tablename;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT '✅ RLS policies fixed! Classes can now be created without infinite recursion.' AS status;
SELECT '✅ Trigger function updated! Student boards will now be created with name field.' AS status;
SELECT '✅ Please restart your Next.js development server for changes to take effect.' AS status;
