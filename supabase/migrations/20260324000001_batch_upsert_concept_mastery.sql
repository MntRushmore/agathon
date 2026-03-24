-- Batch upsert concept mastery to eliminate N+1 queries
CREATE OR REPLACE FUNCTION batch_upsert_concept_mastery(
  p_student_id UUID,
  p_assignment_id UUID,
  p_concepts TEXT[],
  p_mode TEXT,
  p_time_spent_seconds INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_concept TEXT;
BEGIN
  FOREACH v_concept IN ARRAY p_concepts LOOP
    INSERT INTO concept_mastery (
      assignment_id, concept_name, student_id,
      ai_help_count, solve_mode_used, mastery_level, time_spent_seconds
    )
    VALUES (
      p_assignment_id, v_concept, p_student_id,
      1,
      (p_mode = 'answer'),
      CASE WHEN p_mode = 'answer' THEN 'struggling' ELSE 'learning' END,
      COALESCE(p_time_spent_seconds, 0)
    )
    ON CONFLICT (student_id, assignment_id, concept_name)
    DO UPDATE SET
      ai_help_count = concept_mastery.ai_help_count + 1,
      solve_mode_used = concept_mastery.solve_mode_used OR (p_mode = 'answer'),
      mastery_level = CASE
        WHEN p_mode = 'answer' THEN 'struggling'
        WHEN concept_mastery.ai_help_count + 1 >= 3 AND concept_mastery.mastery_level != 'struggling'
          THEN 'learning'
        ELSE concept_mastery.mastery_level
      END,
      time_spent_seconds = concept_mastery.time_spent_seconds + COALESCE(p_time_spent_seconds, 0);
  END LOOP;
END;
$$;
