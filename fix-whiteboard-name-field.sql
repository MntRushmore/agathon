-- ============================================
-- FIX: Add 'name' field to whiteboard insertions
-- ============================================
-- This script fixes the trigger function that was missing the 'name' field
-- Run this in Supabase SQL Editor to fix the 500 and 400 errors
-- Date: 2026-01-13
-- ============================================

-- Update the trigger function to include 'name' field
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

-- Verify the function was updated
SELECT 'Trigger function updated successfully!' AS status;
