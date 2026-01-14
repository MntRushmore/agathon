-- ============================================
-- COMPLETE DATABASE SETUP SCRIPT
-- ============================================
-- This is the FINAL, COMPLETE SQL script based on your actual code
-- Run this on a fresh Supabase project to set up everything
-- Date: 2026-01-13
-- Status: Production Ready
-- ============================================

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-update whiteboards updated_at
CREATE OR REPLACE FUNCTION update_whiteboards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 1. PROFILES TABLE
-- ============================================
-- Extends auth.users with additional profile info

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher')),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for role-based queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Teachers can view all profiles" ON profiles;
CREATE POLICY "Teachers can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'teacher'
    )
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. WHITEBOARDS TABLE
-- ============================================
-- Stores collaborative whiteboard canvases

CREATE TABLE IF NOT EXISTS whiteboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  preview TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whiteboards_user_id ON whiteboards(user_id);
CREATE INDEX IF NOT EXISTS idx_whiteboards_created_at ON whiteboards(created_at DESC);

-- RLS Policies
ALTER TABLE whiteboards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own whiteboards" ON whiteboards;
CREATE POLICY "Users can view own whiteboards" ON whiteboards
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own whiteboards" ON whiteboards;
CREATE POLICY "Users can create own whiteboards" ON whiteboards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own whiteboards" ON whiteboards;
CREATE POLICY "Users can update own whiteboards" ON whiteboards
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own whiteboards" ON whiteboards;
CREATE POLICY "Users can delete own whiteboards" ON whiteboards
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Teachers can view all whiteboards" ON whiteboards;
CREATE POLICY "Teachers can view all whiteboards" ON whiteboards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'teacher'
    )
  );

-- Teachers can create boards for students in their classes (for assignment distribution)
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

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_whiteboards_updated_at ON whiteboards;
CREATE TRIGGER update_whiteboards_updated_at
  BEFORE UPDATE ON whiteboards
  FOR EACH ROW
  EXECUTE FUNCTION update_whiteboards_updated_at();

-- ============================================
-- 3. BOARD_SHARES TABLE
-- ============================================
-- Tracks whiteboard sharing and permissions

CREATE TABLE IF NOT EXISTS board_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES whiteboards(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(board_id, shared_with_user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_board_shares_board_id ON board_shares(board_id);
CREATE INDEX IF NOT EXISTS idx_board_shares_shared_with ON board_shares(shared_with_user_id);

-- RLS Policies
ALTER TABLE board_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view shares for their boards" ON board_shares;
CREATE POLICY "Users can view shares for their boards" ON board_shares
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM whiteboards
      WHERE whiteboards.id = board_shares.board_id
      AND whiteboards.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Board owners can create shares" ON board_shares;
CREATE POLICY "Board owners can create shares" ON board_shares
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM whiteboards
      WHERE whiteboards.id = board_shares.board_id
      AND whiteboards.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Board owners can delete shares" ON board_shares;
CREATE POLICY "Board owners can delete shares" ON board_shares
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM whiteboards
      WHERE whiteboards.id = board_shares.board_id
      AND whiteboards.user_id = auth.uid()
    )
  );

-- Additional policy for viewing shared boards (referenced in whiteboards policies)
DROP POLICY IF EXISTS "Users can view shared whiteboards" ON whiteboards;
CREATE POLICY "Users can view shared whiteboards" ON whiteboards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM board_shares
      WHERE board_shares.board_id = whiteboards.id
      AND board_shares.shared_with_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update shared whiteboards with edit permission" ON whiteboards;
CREATE POLICY "Users can update shared whiteboards with edit permission" ON whiteboards
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM board_shares
      WHERE board_shares.board_id = whiteboards.id
      AND board_shares.shared_with_user_id = auth.uid()
      AND board_shares.permission = 'edit'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM board_shares
      WHERE board_shares.board_id = whiteboards.id
      AND board_shares.shared_with_user_id = auth.uid()
      AND board_shares.permission = 'edit'
    )
  );

-- ============================================
-- 4. CLASSES TABLE
-- ============================================
-- Teacher-created classes with unique join codes

CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 100),
  description TEXT,
  subject TEXT,
  grade_level TEXT,
  join_code TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classes_join_code ON classes(join_code);
CREATE INDEX IF NOT EXISTS idx_classes_active ON classes(is_active) WHERE is_active = true;

-- RLS Policies
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can view own classes" ON classes;
CREATE POLICY "Teachers can view own classes" ON classes
  FOR SELECT USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers can create classes" ON classes;
CREATE POLICY "Teachers can create classes" ON classes
  FOR INSERT WITH CHECK (
    auth.uid() = teacher_id AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
  );

DROP POLICY IF EXISTS "Teachers can update own classes" ON classes;
CREATE POLICY "Teachers can update own classes" ON classes
  FOR UPDATE USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers can delete own classes" ON classes;
CREATE POLICY "Teachers can delete own classes" ON classes
  FOR DELETE USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Students can view enrolled classes" ON classes;
CREATE POLICY "Students can view enrolled classes" ON classes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM class_members
      WHERE class_members.class_id = classes.id
      AND class_members.student_id = auth.uid()
    )
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_classes_updated_at ON classes;
CREATE TRIGGER update_classes_updated_at
  BEFORE UPDATE ON classes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. CLASS_MEMBERS TABLE
-- ============================================
-- Links students to classes they've joined

CREATE TABLE IF NOT EXISTS class_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(class_id, student_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_class_members_class_id ON class_members(class_id);
CREATE INDEX IF NOT EXISTS idx_class_members_student_id ON class_members(student_id);

-- RLS Policies
ALTER TABLE class_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view own memberships" ON class_members;
CREATE POLICY "Students can view own memberships" ON class_members
  FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can join classes" ON class_members;
CREATE POLICY "Students can join classes" ON class_members
  FOR INSERT WITH CHECK (
    auth.uid() = student_id AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'student')
  );

DROP POLICY IF EXISTS "Students can leave classes" ON class_members;
CREATE POLICY "Students can leave classes" ON class_members
  FOR DELETE USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Teachers can view class members" ON class_members;
CREATE POLICY "Teachers can view class members" ON class_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = class_members.class_id
      AND classes.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers can remove class members" ON class_members;
CREATE POLICY "Teachers can remove class members" ON class_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = class_members.class_id
      AND classes.teacher_id = auth.uid()
    )
  );

-- ============================================
-- 6. ASSIGNMENTS TABLE
-- ============================================
-- Teacher-created assignments linked to template boards

CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  template_board_id UUID NOT NULL REFERENCES whiteboards(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) >= 1 AND char_length(title) <= 200),
  instructions TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  is_published BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assignments_class_id ON assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_assignments_template_board_id ON assignments(template_board_id);
CREATE INDEX IF NOT EXISTS idx_assignments_published ON assignments(is_published) WHERE is_published = true;

-- RLS Policies
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can view own assignments" ON assignments;
CREATE POLICY "Teachers can view own assignments" ON assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = assignments.class_id
      AND classes.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers can create assignments" ON assignments;
CREATE POLICY "Teachers can create assignments" ON assignments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = assignments.class_id
      AND classes.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers can update own assignments" ON assignments;
CREATE POLICY "Teachers can update own assignments" ON assignments
  FOR UPDATE USING (
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

DROP POLICY IF EXISTS "Teachers can delete own assignments" ON assignments;
CREATE POLICY "Teachers can delete own assignments" ON assignments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = assignments.class_id
      AND classes.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Students can view published assignments" ON assignments;
CREATE POLICY "Students can view published assignments" ON assignments
  FOR SELECT USING (
    is_published = true AND
    EXISTS (
      SELECT 1 FROM class_members
      WHERE class_members.class_id = assignments.class_id
      AND class_members.student_id = auth.uid()
    )
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_assignments_updated_at ON assignments;
CREATE TRIGGER update_assignments_updated_at
  BEFORE UPDATE ON assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. SUBMISSIONS TABLE
-- ============================================
-- Tracks student assignment submissions and status

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);

-- RLS Policies
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view own submissions" ON submissions;
CREATE POLICY "Students can view own submissions" ON submissions
  FOR SELECT USING (auth.uid() = student_id);

-- Teachers can create submissions for students in their classes (for assignment publishing)
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

DROP POLICY IF EXISTS "Students can update own submissions" ON submissions;
CREATE POLICY "Students can update own submissions" ON submissions
  FOR UPDATE USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Teachers can view assignment submissions" ON submissions;
CREATE POLICY "Teachers can view assignment submissions" ON submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM assignments
      JOIN classes ON classes.id = assignments.class_id
      WHERE assignments.id = submissions.assignment_id
      AND classes.teacher_id = auth.uid()
    )
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_submissions_updated_at ON submissions;
CREATE TRIGGER update_submissions_updated_at
  BEFORE UPDATE ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RPC FUNCTIONS
-- ============================================

-- Function to look up a class by join code (bypasses RLS for student enrollment)
-- Students need to be able to look up a class before they're enrolled
CREATE OR REPLACE FUNCTION get_class_by_join_code(code TEXT)
RETURNS TABLE (
  id UUID,
  teacher_id UUID,
  name TEXT,
  description TEXT,
  subject TEXT,
  grade_level TEXT,
  join_code TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.teacher_id,
    c.name,
    c.description,
    c.subject,
    c.grade_level,
    c.join_code,
    c.is_active,
    c.created_at,
    c.updated_at
  FROM classes c
  WHERE c.join_code = UPPER(code)
  AND c.is_active = true;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_class_by_join_code(TEXT) TO authenticated;

-- ============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================

-- Function to create profile when user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- VERIFICATION QUERY
-- ============================================

SELECT
    '========================================' as summary
UNION ALL
SELECT 'DATABASE SETUP COMPLETE'
UNION ALL
SELECT '========================================'
UNION ALL
SELECT ''
UNION ALL
SELECT 'Tables created: ' || COUNT(*)::text
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'whiteboards', 'board_shares', 'classes', 'class_members', 'assignments', 'submissions')
UNION ALL
SELECT 'RLS Policies: ' || COUNT(*)::text
FROM pg_policies
WHERE schemaname = 'public'
UNION ALL
SELECT ''
UNION ALL
SELECT 'Next steps:'
UNION ALL
SELECT '1. Disable email confirmation in Supabase Auth settings'
UNION ALL
SELECT '2. Set up .env.local with your Supabase credentials'
UNION ALL
SELECT '3. Run: npm run dev'
UNION ALL
SELECT '4. Test authentication flow';
