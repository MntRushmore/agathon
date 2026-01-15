-- ============================================
-- Teacher Features Migration
-- ============================================
-- Adds AI controls, struggle detection, and concept mastery tracking

-- ============================================
-- 1. ADD AI CONTROLS TO ASSIGNMENTS
-- ============================================
-- These columns control what AI assistance students can use

ALTER TABLE assignments ADD COLUMN IF NOT EXISTS allow_ai BOOLEAN DEFAULT true;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS hint_limit INTEGER DEFAULT NULL;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS allowed_modes TEXT[] DEFAULT ARRAY['feedback', 'suggest', 'answer'];

-- ============================================
-- 2. AI USAGE TRACKING TABLE
-- ============================================
-- Tracks every AI interaction for analytics

CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('feedback', 'suggest', 'answer', 'chat')),
  prompt TEXT,
  response_summary TEXT,
  concept_tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_submission ON ai_usage(submission_id);
CREATE INDEX idx_ai_usage_student ON ai_usage(student_id);
CREATE INDEX idx_ai_usage_assignment ON ai_usage(assignment_id);
CREATE INDEX idx_ai_usage_created_at ON ai_usage(created_at);

-- ============================================
-- 3. STRUGGLE DETECTION TABLE
-- ============================================
-- Tracks student struggle indicators

CREATE TABLE IF NOT EXISTS struggle_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  indicator_type TEXT NOT NULL CHECK (indicator_type IN ('repeated_hints', 'long_time', 'erasing', 'no_progress', 'explicit_help')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  details JSONB,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_struggle_submission ON struggle_indicators(submission_id);
CREATE INDEX idx_struggle_student ON struggle_indicators(student_id);
CREATE INDEX idx_struggle_assignment ON struggle_indicators(assignment_id);
CREATE INDEX idx_struggle_unresolved ON struggle_indicators(resolved) WHERE resolved = false;

-- ============================================
-- 4. CONCEPT MASTERY TABLE
-- ============================================
-- Tracks which concepts students struggle with or master

CREATE TABLE IF NOT EXISTS concept_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  concept_name TEXT NOT NULL,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  mastery_level TEXT NOT NULL DEFAULT 'learning' CHECK (mastery_level IN ('struggling', 'learning', 'proficient', 'mastered')),
  ai_help_count INTEGER DEFAULT 0,
  solve_mode_used BOOLEAN DEFAULT false,
  time_spent_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(assignment_id, concept_name, student_id)
);

CREATE INDEX idx_concept_assignment ON concept_mastery(assignment_id);
CREATE INDEX idx_concept_student ON concept_mastery(student_id);
CREATE INDEX idx_concept_level ON concept_mastery(mastery_level);

-- ============================================
-- 5. TEACHER FEEDBACK TABLE
-- ============================================
-- Stores AI-drafted and teacher-approved feedback

CREATE TABLE IF NOT EXISTS teacher_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ai_draft TEXT,
  final_feedback TEXT,
  is_ai_generated BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT false,
  sent_to_student BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_feedback_submission ON teacher_feedback(submission_id);
CREATE INDEX idx_feedback_teacher ON teacher_feedback(teacher_id);

-- ============================================
-- 6. UPDATE SUBMISSIONS TABLE
-- ============================================
-- Add fields for tracking activity and AI usage

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS ai_help_count INTEGER DEFAULT 0;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS solve_mode_count INTEGER DEFAULT 0;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER DEFAULT 0;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS is_struggling BOOLEAN DEFAULT false;

-- ============================================
-- 7. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE struggle_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE concept_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_feedback ENABLE ROW LEVEL SECURITY;

-- AI Usage policies
CREATE POLICY "Students can view own AI usage"
  ON ai_usage FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Teachers can view AI usage for their assignments"
  ON ai_usage FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assignments a
      JOIN classes c ON c.id = a.class_id
      WHERE a.id = ai_usage.assignment_id
        AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can insert own AI usage"
  ON ai_usage FOR INSERT
  WITH CHECK (student_id = auth.uid());

-- Struggle indicators policies
CREATE POLICY "Teachers can view struggle indicators for their classes"
  ON struggle_indicators FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assignments a
      JOIN classes c ON c.id = a.class_id
      WHERE a.id = struggle_indicators.assignment_id
        AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "System can insert struggle indicators"
  ON struggle_indicators FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Teachers can update struggle indicators"
  ON struggle_indicators FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM assignments a
      JOIN classes c ON c.id = a.class_id
      WHERE a.id = struggle_indicators.assignment_id
        AND c.teacher_id = auth.uid()
    )
  );

-- Concept mastery policies
CREATE POLICY "Teachers can view concept mastery"
  ON concept_mastery FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assignments a
      JOIN classes c ON c.id = a.class_id
      WHERE a.id = concept_mastery.assignment_id
        AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "System can manage concept mastery"
  ON concept_mastery FOR ALL
  WITH CHECK (true);

-- Teacher feedback policies
CREATE POLICY "Teachers can manage own feedback"
  ON teacher_feedback FOR ALL
  USING (teacher_id = auth.uid());

CREATE POLICY "Students can view feedback sent to them"
  ON teacher_feedback FOR SELECT
  USING (
    sent_to_student = true
    AND EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = teacher_feedback.submission_id
        AND s.student_id = auth.uid()
    )
  );

-- ============================================
-- 8. COMMENTS
-- ============================================

COMMENT ON TABLE ai_usage IS 'Tracks all AI interactions for analytics and teacher insights';
COMMENT ON TABLE struggle_indicators IS 'Flags students who may need teacher intervention';
COMMENT ON TABLE concept_mastery IS 'Tracks concept-level understanding for heatmaps';
COMMENT ON TABLE teacher_feedback IS 'AI-assisted and manual teacher feedback on submissions';

-- ============================================
-- 9. ASSIGNMENT TEMPLATES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS assignment_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  ai_settings JSONB DEFAULT '{"allowAI": true, "allowedModes": ["feedback", "suggest", "answer"], "hintLimit": null}',
  subject_tags TEXT[],
  grade_level TEXT,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_templates_teacher ON assignment_templates(teacher_id);

ALTER TABLE assignment_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage own templates"
  ON assignment_templates FOR ALL
  USING (teacher_id = auth.uid());
