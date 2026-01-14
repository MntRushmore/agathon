-- ============================================
-- ADD JOIN CODE LOOKUP FUNCTION
-- ============================================
-- Run this SQL in your Supabase SQL Editor to enable student class joining
-- This function allows students to look up a class by join code
-- before they are enrolled (bypasses RLS)
-- ============================================

-- Drop existing function first (if return type changed)
DROP FUNCTION IF EXISTS get_class_by_join_code(TEXT);

-- Function to look up a class by join code
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

-- Verify the function was created
SELECT 'Function get_class_by_join_code created successfully!' as status;
