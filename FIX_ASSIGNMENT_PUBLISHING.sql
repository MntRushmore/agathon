-- ============================================
-- FIX ASSIGNMENT PUBLISHING
-- ============================================
-- This SQL adds the necessary RLS policies for teachers to create
-- student board copies when publishing assignments.
-- Run this in your Supabase SQL Editor.
-- ============================================

-- Allow teachers to create whiteboards for students in their classes
-- This is needed for assignment distribution (copying template boards to students)
DROP POLICY IF EXISTS "Teachers can create boards for students" ON whiteboards;
CREATE POLICY "Teachers can create boards for students" ON whiteboards
  FOR INSERT WITH CHECK (
    -- The current user must be a teacher
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'teacher'
    )
    AND
    -- The board being created must be for a student in one of the teacher's classes
    EXISTS (
      SELECT 1 FROM class_members cm
      JOIN classes c ON c.id = cm.class_id
      WHERE cm.student_id = whiteboards.user_id
      AND c.teacher_id = auth.uid()
    )
  );

-- Allow teachers to create submissions for students in their classes
-- This is needed when publishing assignments
DROP POLICY IF EXISTS "Teachers can create submissions for students" ON submissions;
CREATE POLICY "Teachers can create submissions for students" ON submissions
  FOR INSERT WITH CHECK (
    -- The assignment must belong to a class owned by this teacher
    EXISTS (
      SELECT 1 FROM assignments a
      JOIN classes c ON c.id = a.class_id
      WHERE a.id = submissions.assignment_id
      AND c.teacher_id = auth.uid()
    )
  );

-- Verify the policies were created
SELECT
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('whiteboards', 'submissions')
AND policyname LIKE 'Teachers can%'
ORDER BY tablename, policyname;
