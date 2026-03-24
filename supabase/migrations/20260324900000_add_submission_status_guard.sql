-- L13: Prevent backward status transitions on submissions
CREATE OR REPLACE FUNCTION check_submission_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  old_order INTEGER;
  new_order INTEGER;
BEGIN
  old_order := CASE OLD.status
    WHEN 'not_started' THEN 1
    WHEN 'in_progress' THEN 2
    WHEN 'submitted' THEN 3
    ELSE 0
  END;
  new_order := CASE NEW.status
    WHEN 'not_started' THEN 1
    WHEN 'in_progress' THEN 2
    WHEN 'submitted' THEN 3
    ELSE 0
  END;

  -- Silently preserve the higher status instead of raising an exception,
  -- because track-ai-usage unconditionally sets 'in_progress' on all updates.
  IF new_order < old_order THEN
    NEW.status := OLD.status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_submission_status ON submissions;
CREATE TRIGGER trg_check_submission_status
  BEFORE UPDATE OF status ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION check_submission_status_transition();
