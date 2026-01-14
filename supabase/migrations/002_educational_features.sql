-- ============================================
-- Educational Features Migration
-- ============================================
-- Creates tables for classes, enrollment, assignments, and submissions
-- Adds RLS policies for role-based access control

-- ============================================
-- 1. CLASSES TABLE
-- ============================================
-- Stores teacher's classes with auto-generated join codes

CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 100),
  description TEXT,
  subject TEXT,
  grade_level TEXT,
  join_code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for teacher queries
CREATE INDEX idx_classes_teacher_id ON classes(teacher_id);

-- Index for join code lookups
CREATE INDEX idx_classes_join_code ON classes(join_code);

-- Index for active classes
CREATE INDEX idx_classes_active ON classes(is_active) WHERE is_active = true;

-- ============================================
-- 2. CLASS MEMBERS TABLE
-- ============================================
-- Tracks student enrollment in classes

CREATE TABLE IF NOT EXISTS class_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(class_id, student_id)
);

-- Index for class roster queries
CREATE INDEX idx_class_members_class_id ON class_members(class_id);

-- Index for student's classes
CREATE INDEX idx_class_members_student_id ON class_members(student_id);

-- ============================================
-- 3. ASSIGNMENTS TABLE
-- ============================================
-- Stores assignments linked to template boards

CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  template_board_id UUID NOT NULL REFERENCES whiteboards(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) >= 1 AND char_length(title) <= 200),
  instructions TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for class assignments
CREATE INDEX idx_assignments_class_id ON assignments(class_id);

-- Index for template board lookups
CREATE INDEX idx_assignments_template_board_id ON assignments(template_board_id);

-- Index for published assignments
CREATE INDEX idx_assignments_published ON assignments(is_published) WHERE is_published = true;

-- ============================================
-- 4. SUBMISSIONS TABLE
-- ============================================
-- Tracks student work and completion status

CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_board_id UUID NOT NULL REFERENCES whiteboards(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'submitted')),
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(assignment_id, student_id)
);

-- Index for assignment submissions
CREATE INDEX idx_submissions_assignment_id ON submissions(assignment_id);

-- Index for student's submissions
CREATE INDEX idx_submissions_student_id ON submissions(student_id);

-- Index for status filtering
CREATE INDEX idx_submissions_status ON submissions(status);

-- Index for student board lookups
CREATE INDEX idx_submissions_student_board_id ON submissions(student_board_id);

-- ============================================
-- 5. HELPER FUNCTIONS
-- ============================================

-- Generate unique join code (6 characters, excludes I, O, 0, 1 for clarity)
CREATE OR REPLACE FUNCTION generate_join_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
  code_exists BOOLEAN;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;

    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM classes WHERE join_code = result) INTO code_exists;

    -- If unique, return it
    IF NOT code_exists THEN
      RETURN result;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_submissions_updated_at BEFORE UPDATE ON submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-generate join code on class creation
CREATE OR REPLACE FUNCTION auto_generate_join_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.join_code IS NULL OR NEW.join_code = '' THEN
    NEW.join_code := generate_join_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_join_code BEFORE INSERT ON classes
  FOR EACH ROW EXECUTE FUNCTION auto_generate_join_code();

-- Auto-set submitted_at when status changes to 'submitted'
CREATE OR REPLACE FUNCTION auto_set_submitted_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status != 'submitted') THEN
    NEW.submitted_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_submitted_at BEFORE UPDATE ON submissions
  FOR EACH ROW EXECUTE FUNCTION auto_set_submitted_at();

-- Create submissions for new class member (handles late enrollments)
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
    INSERT INTO whiteboards (user_id, title, data, metadata, preview)
    VALUES (
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

CREATE TRIGGER create_submissions_on_join
  AFTER INSERT ON class_members
  FOR EACH ROW EXECUTE FUNCTION create_submissions_for_new_member();

-- ============================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CLASSES POLICIES
-- ============================================

-- Teachers can view their own classes
CREATE POLICY "Teachers can view own classes"
  ON classes FOR SELECT
  USING (
    auth.uid() = teacher_id
  );

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

-- Teachers can create classes
CREATE POLICY "Teachers can create classes"
  ON classes FOR INSERT
  WITH CHECK (
    auth.uid() = teacher_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'teacher'
    )
  );

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
-- CLASS MEMBERS POLICIES
-- ============================================

-- Teachers can view members of their classes
CREATE POLICY "Teachers can view class members"
  ON class_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = class_members.class_id
        AND classes.teacher_id = auth.uid()
    )
  );

-- Students can view their own memberships
CREATE POLICY "Students can view own memberships"
  ON class_members FOR SELECT
  USING (student_id = auth.uid());

-- Students can join classes (insert)
CREATE POLICY "Students can join classes"
  ON class_members FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'student'
    )
  );

-- Students can leave classes (delete own membership)
CREATE POLICY "Students can leave classes"
  ON class_members FOR DELETE
  USING (student_id = auth.uid());

-- Teachers can remove students from their classes
CREATE POLICY "Teachers can remove class members"
  ON class_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = class_members.class_id
        AND classes.teacher_id = auth.uid()
    )
  );

-- ============================================
-- ASSIGNMENTS POLICIES
-- ============================================

-- Teachers can view assignments for their classes
CREATE POLICY "Teachers can view own assignments"
  ON assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = assignments.class_id
        AND classes.teacher_id = auth.uid()
    )
  );

-- Students can view published assignments for enrolled classes
CREATE POLICY "Students can view published assignments"
  ON assignments FOR SELECT
  USING (
    is_published = true
    AND EXISTS (
      SELECT 1 FROM class_members
      WHERE class_members.class_id = assignments.class_id
        AND class_members.student_id = auth.uid()
    )
  );

-- Teachers can create assignments for their classes
CREATE POLICY "Teachers can create assignments"
  ON assignments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = class_id
        AND classes.teacher_id = auth.uid()
    )
  );

-- Teachers can update their own assignments
CREATE POLICY "Teachers can update own assignments"
  ON assignments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = assignments.class_id
        AND classes.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = assignments.class_id
        AND classes.teacher_id = auth.uid()
    )
  );

-- Teachers can delete their own assignments
CREATE POLICY "Teachers can delete own assignments"
  ON assignments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = assignments.class_id
        AND classes.teacher_id = auth.uid()
    )
  );

-- ============================================
-- SUBMISSIONS POLICIES
-- ============================================

-- Teachers can view all submissions for their assignments
CREATE POLICY "Teachers can view assignment submissions"
  ON submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assignments
      JOIN classes ON classes.id = assignments.class_id
      WHERE assignments.id = submissions.assignment_id
        AND classes.teacher_id = auth.uid()
    )
  );

-- Students can view their own submissions
CREATE POLICY "Students can view own submissions"
  ON submissions FOR SELECT
  USING (student_id = auth.uid());

-- Students can update their own submissions (status changes)
CREATE POLICY "Students can update own submissions"
  ON submissions FOR UPDATE
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- System can insert submissions (handled by triggers)
CREATE POLICY "System can create submissions"
  ON submissions FOR INSERT
  WITH CHECK (true);

-- ============================================
-- COMPLETION
-- ============================================

COMMENT ON TABLE classes IS 'Teacher-created classes with auto-generated join codes';
COMMENT ON TABLE class_members IS 'Student enrollment in classes';
COMMENT ON TABLE assignments IS 'Class assignments linked to template boards';
COMMENT ON TABLE submissions IS 'Student work tracking with completion status';
