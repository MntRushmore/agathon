-- L8: Fix submissions INSERT policy to verify class enrollment
DROP POLICY IF EXISTS "Students can create own submissions" ON submissions;

CREATE POLICY "Students can create own submissions"
  ON submissions FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM assignments a
      JOIN class_members cm ON cm.class_id = a.class_id
      WHERE a.id = submissions.assignment_id
        AND cm.student_id = auth.uid()
    )
  );
