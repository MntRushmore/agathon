-- ============================================
-- FIX TEMPLATE BOARD READ ACCESS
-- ============================================
-- This ensures teachers can fully read their own boards when creating assignments.
-- The issue might be that RLS is limiting which columns are returned.
-- Run this in your Supabase SQL Editor.
-- ============================================

-- First, let's check what policies exist on whiteboards
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
WHERE tablename = 'whiteboards'
ORDER BY policyname;

-- Ensure owners can fully read their own whiteboards (all columns including data)
DROP POLICY IF EXISTS "Users can read own whiteboards" ON whiteboards;
CREATE POLICY "Users can read own whiteboards" ON whiteboards
  FOR SELECT USING (user_id = auth.uid());

-- Ensure owners can update their own whiteboards
DROP POLICY IF EXISTS "Users can update own whiteboards" ON whiteboards;
CREATE POLICY "Users can update own whiteboards" ON whiteboards
  FOR UPDATE USING (user_id = auth.uid());

-- Ensure owners can insert their own whiteboards
DROP POLICY IF EXISTS "Users can insert own whiteboards" ON whiteboards;
CREATE POLICY "Users can insert own whiteboards" ON whiteboards
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Ensure owners can delete their own whiteboards
DROP POLICY IF EXISTS "Users can delete own whiteboards" ON whiteboards;
CREATE POLICY "Users can delete own whiteboards" ON whiteboards
  FOR DELETE USING (user_id = auth.uid());

-- Also allow users to read boards shared with them
DROP POLICY IF EXISTS "Users can read shared boards" ON whiteboards;
CREATE POLICY "Users can read shared boards" ON whiteboards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM board_shares
      WHERE board_shares.board_id = whiteboards.id
      AND board_shares.shared_with_user_id = auth.uid()
    )
  );

-- Allow students to read their assignment boards
DROP POLICY IF EXISTS "Students can read their assignment boards" ON whiteboards;
CREATE POLICY "Students can read their assignment boards" ON whiteboards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM submissions
      WHERE submissions.student_board_id = whiteboards.id
      AND submissions.student_id = auth.uid()
    )
  );

-- Allow teachers to read student assignment boards in their classes
DROP POLICY IF EXISTS "Teachers can read student boards in their classes" ON whiteboards;
CREATE POLICY "Teachers can read student boards in their classes" ON whiteboards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM submissions s
      JOIN assignments a ON a.id = s.assignment_id
      JOIN classes c ON c.id = a.class_id
      WHERE s.student_board_id = whiteboards.id
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
WHERE tablename = 'whiteboards'
ORDER BY policyname;
