-- ============================================
-- Fix AI Usage Tracking
-- ============================================
-- Make submission_id and assignment_id nullable for non-assignment boards,
-- and add missing columns for token/cost tracking.

-- Make foreign keys nullable so regular board AI usage can be tracked
ALTER TABLE ai_usage ALTER COLUMN submission_id DROP NOT NULL;
ALTER TABLE ai_usage ALTER COLUMN assignment_id DROP NOT NULL;

-- Add missing columns that the API route expects
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS input_tokens INTEGER DEFAULT 0;
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS output_tokens INTEGER DEFAULT 0;
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS total_cost DECIMAL(10, 6) DEFAULT 0;
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS model_used TEXT DEFAULT 'unknown';

-- Add whiteboard_id so we can track which board the usage came from
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS whiteboard_id UUID REFERENCES whiteboards(id) ON DELETE SET NULL;

-- Update RLS: allow students to read their own usage (needed for billing page)
DROP POLICY IF EXISTS "Students can view own AI usage" ON ai_usage;
CREATE POLICY "Students can view own AI usage"
  ON ai_usage FOR SELECT
  USING (student_id = auth.uid());
