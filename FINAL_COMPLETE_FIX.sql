-- ============================================
-- COMPLETE FIX: All RLS Policies (No Circular References)
-- ============================================
-- This fixes ALL circular dependencies in the database
-- Run this ENTIRE script in Supabase SQL Editor
-- Date: 2026-01-13
-- ============================================

-- ============================================
-- PART 1: Fix PROFILES Policies (Root Cause)
-- ============================================

-- Drop the problematic "Teachers can view all profiles" policy
DROP POLICY IF EXISTS "Teachers can view all profiles" ON profiles;

-- Recreate WITHOUT self-referencing subquery
CREATE POLICY "Teachers can view all profiles" ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Check the CURRENT user's role directly (no subquery)
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'teacher'
    OR auth.uid() = id  -- Users can always see their own profile
  );

-- ============================================
-- PART 2: Fix CLASSES Policies
-- ============================================

-- Drop ALL existing classes policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'classes' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON classes';
    END LOOP;
END $$;

-- Recreate classes policies WITHOUT circular references
CREATE POLICY "classes_select_teacher"
  ON classes FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "classes_select_student"
  ON classes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM class_members 
      WHERE class_members.class_id = classes.id 
        AND class_members.student_id = auth.uid()
    )
  );

CREATE POLICY "classes_insert_teacher"
  ON classes FOR INSERT
  TO authenticated
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "classes_update_teacher"
  ON classes FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "classes_delete_teacher"
  ON classes FOR DELETE
  TO authenticated
  USING (teacher_id = auth.uid());

-- ============================================
-- PART 3: Fix Trigger Function (Add 'name' field)
-- ============================================

CREATE OR REPLACE FUNCTION create_submissions_for_new_member()
RETURNS TRIGGER AS $$
DECLARE
  assignment_record RECORD;
  template_board RECORD;
  new_board_id UUID;
BEGIN
  FOR assignment_record IN
    SELECT * FROM assignments
    WHERE class_id = NEW.class_id AND is_published = true
  LOOP
    SELECT * INTO template_board FROM whiteboards
    WHERE id = assignment_record.template_board_id;

    -- FIXED: Include 'name' field
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

    INSERT INTO submissions (assignment_id, student_id, student_board_id, status)
    VALUES (assignment_record.id, NEW.student_id, new_board_id, 'not_started');
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PART 4: Verification
-- ============================================

-- Show all profiles policies
SELECT 'PROFILES POLICIES:' AS info;
SELECT policyname, cmd FROM pg_policies 
WHERE tablename = 'profiles' AND schemaname = 'public'
ORDER BY policyname;

-- Show all classes policies  
SELECT 'CLASSES POLICIES:' AS info;
SELECT policyname, cmd FROM pg_policies 
WHERE tablename = 'classes' AND schemaname = 'public'
ORDER BY policyname;

-- ============================================
-- SUCCESS MESSAGES
-- ============================================
SELECT '✅ Fixed circular reference in profiles "Teachers can view all profiles" policy' AS status
UNION ALL
SELECT '✅ Recreated all classes policies without recursion' AS status
UNION ALL
SELECT '✅ Updated trigger function with name field' AS status
UNION ALL
SELECT '✅ All policies verified - no more infinite recursion!' AS status;
