-- Google Classroom integration for teachers
-- Adds columns to link Agathon classes to GC courses and track posted assignments

-- Add Google Classroom course link columns to classes
ALTER TABLE classes ADD COLUMN IF NOT EXISTS gc_course_id TEXT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS gc_course_name TEXT;

-- Add Google Classroom coursework tracking to assignments
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS gc_coursework_id TEXT;

-- Index for dedup lookups when importing courses
CREATE INDEX IF NOT EXISTS idx_classes_gc_course_id ON classes(gc_course_id) WHERE gc_course_id IS NOT NULL;

-- Index for looking up assignments by GC coursework ID
CREATE INDEX IF NOT EXISTS idx_assignments_gc_coursework_id ON assignments(gc_coursework_id) WHERE gc_coursework_id IS NOT NULL;
